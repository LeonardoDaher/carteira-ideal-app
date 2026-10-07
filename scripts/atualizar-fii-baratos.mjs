// Triagem "FIIs baratos" (Tijolo e Papel).
//
//   node scripts/atualizar-fii-baratos.mjs                       baixa o Informe Mensal da CVM e gera a auditoria
//   node scripts/atualizar-fii-baratos.mjs --dados-locais=PASTA  usa zips já baixados (offline)
//   node scripts/atualizar-fii-baratos.mjs --verificar=PASTA     AUDITORIA: refaz o cálculo dos insumos congelados
//   node scripts/atualizar-fii-baratos.mjs --verificar=ultima    o mesmo, na execução mais recente
//
// Fluxo (cada etapa deixa rastro em auditoria/fii-baratos/<data>/):
//   1. EXTRAÇÃO : Informe Mensal de FII da CVM (complemento, geral, ativo_passivo) + cotação e volume do job de
//                 FIIs (webapp-src/src/data/rendimentosFii.json) → insumos.json.gz (linhas exatas usadas)
//   2. CÁLCULO  : scripts/fii-baratos-calculo.mjs (puro) → resultado.json + memoria-de-calculo.json.gz
//   3. REGISTRO : manifesto.json com sha256 de fontes, config, insumos, resultado e do código de cálculo
//   4. PUBLICAÇÃO: só leva o ranking ao app se config/fii-baratos.json → publicacao.aprovadoPeloResponsavel === true E a trava
//                  de sanidade passar. Com acesso por código (padrão): cabeçalho em webapp-src/src/data/fiiBaratos.json e lista
//                  completa em dados-privados/fii-baratos.json (só api/top15-fiis.ts lê, com o código do mês).
// Se algo falhar, termina com erro SEM alterar o app.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixar, lerEntradaDoZip, listarZip, sha256Arquivo } from './acoes-baratas-cvm.mjs'
import { competenciaDe, lerCsv, lerNumero, prefixoTickerDoIsin, somenteDigitos } from './atualizar-rendimentos-fii.mjs'
import { ultimosPregoes } from './atualizar-fiis-historico.mjs'
import { calcular, canonico, hashDoResultado, sha256, verificarSanidade } from './fii-baratos-calculo.mjs'
import { executarCli, verificar } from './fii-baratos-verificar.mjs'

export { verificar }

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ESQUEMA = 1
export const urlInformes = (ano) => `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${ano}.zip`

const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const gravarJson = (arquivo, obj) => fs.writeFileSync(arquivo, JSON.stringify(obj, null, 2) + '\n')
const gravarGz = (arquivo, obj) => fs.writeFileSync(arquivo, zlib.gzipSync(JSON.stringify(obj), { level: 9 }))

// Campos copiados do informe (nada é interpretado aqui: toda conta fica em fii-baratos-calculo.mjs).
const CAMPOS_COMPLEMENTO = { dy: 'Percentual_Dividend_Yield_Mes', vp: 'Valor_Patrimonial_Cotas', pat: 'Percentual_Rentabilidade_Patrimonial_Mes', efetiva: 'Percentual_Rentabilidade_Efetiva_Mes', pl: 'Patrimonio_Liquido', cotistas: 'Total_Numero_Cotistas', valorAtivo: 'Valor_Ativo' }
const CAMPOS_EXTRAS_ATIVO = ['Total_Investido', 'Total_Passivo', 'Rendimentos_Distribuir', 'Taxa_Administracao_Pagar', 'Taxa_Performance_Pagar']

export function camposDoAtivo(cfg) {
  const c = cfg.classificacao
  return [...new Set([...c.imoveis, ...c.recebiveis, ...c.cotas, ...c.outros, ...CAMPOS_EXTRAS_ATIVO])]
}

const mediana = (valores) => {
  const positivos = valores.filter((v) => v != null && v > 0).sort((a, b) => a - b)
  return positivos.length ? positivos[Math.floor(positivos.length / 2)] : null
}

/** Última versão (reapresentação) de cada documento do informe, por fundo e competência. */
function ultimasVersoes(linhas, chaveCnpj = 'CNPJ_Fundo_Classe') {
  const mapa = new Map()
  for (const l of linhas) {
    const cnpj = somenteDigitos(l[chaveCnpj])
    const comp = competenciaDe(l.Data_Referencia)
    if (!cnpj || !comp) continue
    const chave = `${cnpj}|${comp}`
    const v = lerNumero(l.Versao) ?? 0
    const atual = mapa.get(chave)
    if (!atual || v >= atual.v) mapa.set(chave, { v, cnpj, comp, linha: l })
  }
  return mapa
}

/**
 * Junta tudo que o cálculo precisa. Não decide nada: cada exclusão acontece em fii-baratos-calculo.mjs.
 * Entradas já lidas (linhas de CSV como objetos): complemento, geral e ativo_passivo do informe; snapshot = rendimentosFii.json.
 */
export function montarInsumos({ complemento, geral, ativo, snapshot, cfg, dataExecucao, historicoPrecos = null }) {
  const informes = ultimasVersoes(complemento)
  const ativos = ultimasVersoes(ativo)

  const cnpjsPorComp = new Map()
  const dyPorComp = new Map()
  for (const { cnpj, comp, linha } of informes.values()) {
    if (!cnpjsPorComp.has(comp)) cnpjsPorComp.set(comp, new Set())
    cnpjsPorComp.get(comp).add(cnpj)
    if (!dyPorComp.has(comp)) dyPorComp.set(comp, [])
    dyPorComp.get(comp).push(lerNumero(linha.Percentual_Dividend_Yield_Mes))
  }
  const todasComp = [...cnpjsPorComp.keys()].sort()
  const guardadas = todasComp.slice(-cfg.dados.mesesGuardadosNosInsumos)
  const contagemPorCompetencia = Object.fromEntries(guardadas.map((c) => [c, cnpjsPorComp.get(c).size]))
  const medianaDyPorCompetencia = Object.fromEntries(guardadas.map((c) => [c, mediana(dyPorComp.get(c))]))

  const cadastro = new Map()
  for (const l of geral) {
    const cnpj = somenteDigitos(l.CNPJ_Fundo_Classe)
    if (!cnpj) continue
    const ant = cadastro.get(cnpj) ?? {}
    cadastro.set(cnpj, { prefixo: prefixoTickerDoIsin(l.Codigo_ISIN) ?? ant.prefixo ?? null, nome: l.Nome_Fundo_Classe || ant.nome || null, segmento: l.Segmento_Atuacao || ant.segmento || null })
  }
  const ultimaCompDoCnpj = (cnpj) => guardadas.filter((c) => informes.has(`${cnpj}|${c}`)).at(-1) ?? ''
  const camposAtivo = camposDoAtivo(cfg)

  const fundos = snapshot.fundos.map((f) => {
    const prefixo = f.ticker.slice(0, 4)
    const candidatos = [...cadastro].filter(([, i]) => i.prefixo === prefixo).map(([c]) => c)
    // Migração pela Resolução 175: o ISIN passa para um CNPJ novo; vale o que tem o informe mais recente.
    const ordenados = candidatos.map((c) => ({ cnpj: c, ultima: ultimaCompDoCnpj(c) })).sort((a, b) => (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : a.cnpj < b.cnpj ? 1 : -1))
    const cnpj = ordenados[0]?.cnpj ?? null
    // Preço diário da B3: últimos pregões do histórico, alinhados com pregoesDiarios ([fechamento, volume em reais] ou null).
    const base = { ticker: f.ticker, nome: f.nome ?? null, setor: f.setor ?? null, cotacao: f.cotacao ?? null, dataCotacao: f.dataCotacao ?? null, volumeMedio: f.volumeMedio ?? null, volumeMediano: f.volumeMediano ?? null, precoDiario: historicoPrecos ? ultimosPregoes(historicoPrecos, f.ticker.toUpperCase(), cfg.dados.pregoesPrecoDiario).serie : null, precoDiarioFonte: (historicoPrecos?.complementadosPelaBrapi ?? []).includes(f.ticker.toUpperCase()) ? 'brapi' : 'B3' }
    if (!cnpj) return { ...base, segmento: null, cnpj: null, origemCnpj: candidatos.length ? 'ISIN sem informe' : 'ISIN não encontrado no informe' }
    const infs = {}
    const ats = {}
    for (const c of guardadas) {
      const i = informes.get(`${cnpj}|${c}`)
      if (i) infs[c] = { versao: lerNumero(i.linha.Versao) ?? 0, ...Object.fromEntries(Object.entries(CAMPOS_COMPLEMENTO).map(([k, col]) => [k, lerNumero(i.linha[col])])) }
      const a = ativos.get(`${cnpj}|${c}`)
      if (a) ats[c] = Object.fromEntries(camposAtivo.map((col) => [col, lerNumero(a.linha[col])]).filter(([, v]) => v != null && v !== 0))
    }
    return {
      ...base,
      segmento: cadastro.get(cnpj)?.segmento ?? null,
      cnpj,
      origemCnpj: candidatos.length > 1 ? `ISIN ${prefixo} em ${candidatos.length} CNPJs; usado o de informe mais recente (${ordenados[0].ultima})` : `ISIN ${prefixo}`,
      informes: infs,
      ativos: ats,
    }
  })

  const pregoesDiarios = historicoPrecos ? (historicoPrecos.pregoes ?? []).slice(-cfg.dados.pregoesPrecoDiario) : []
  return { esquema: ESQUEMA, dataExecucao, dataCotacoes: (snapshot.geradoEm ?? '').slice(0, 10), pregoesDiarios, contagemPorCompetencia, medianaDyPorCompetencia, fundos }
}

// ---------------------------------------------------------------------------------------
// Saída: CSVs e auditoria
// ---------------------------------------------------------------------------------------

const csvNum = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const csvTxt = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`
const csv = (cabecalho, linhas) => '﻿' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n') + '\r\n'
const pct = (v) => (v == null ? '' : csvNum(Math.round(v * 1e6) / 1e4))

export function csvRanking(lista, { comPosicao = true } = {}) {
  return csv(
    [comPosicao ? 'posicao' : 'grupo', 'ticker', 'nome', 'setor_declarado', 'cnpj', 'nota', 'P/VP', 'DY_12m_%', 'DY_recente_anualizado_%', 'rendimento_recente_sobre_12m', 'pico_de_rendimento', 'cotacao', 'data_cotacao', 'vp_cota', 'rendimento_12m_por_cota', 'rentab_patrimonial_12m_%', 'patrimonio_R$', 'cotistas', 'passivo_sobre_ativo_%', 'volume_medio_R$', 'volume_mediano_R$', 'liquidez_pela', 'fonte_cotacao', 'salto_maximo_%', 'fatia_imoveis_%', 'fatia_recebiveis_%', 'fatia_cotas_%', 'meses_com_dados', 'alertas', 'alertas_liberados', 'conferido'],
    lista.map((f) => [comPosicao ? f.posicao : f.grupo, f.ticker, csvTxt(f.nome), csvTxt(f.setorDeclarado), f.cnpj, csvNum(f.nota), csvNum(f.pvp), pct(f.dy12), pct(f.dyRecente), csvNum(f.razaoRendimentoRecente), csvNum(f.picoDeRendimento), csvNum(f.cotacao), f.dataCotacao ?? '', csvNum(f.vp), csvNum(f.rendimento12m), pct(f.rentabPatrimonial12m), csvNum(f.patrimonio), f.cotistas ?? '', pct(f.alavancagem), csvNum(f.volumeMedio), csvNum(f.volumeMediano), f.fonteLiquidez ?? '', f.fonteCotacao ?? '', pct(f.saltoMaximo), pct(f.fatias?.imoveis), pct(f.fatias?.recebiveis), pct(f.fatias?.cotas), f.mesesComDados, csvTxt((f.alertas ?? []).join(',')), csvTxt((f.alertasLiberados ?? []).join(',')), csvTxt(f.conferido ? `${f.conferido.em}: ${f.conferido.fonte}` : f.conferenciaVencida ? `conferência vencida (${f.conferenciaVencida})` : '')]),
  )
}
export const csvExclusoes = (resultado) => csv(['ticker', 'nome', 'setor', 'etapa', 'codigo', 'motivo'], resultado.exclusoes.map((e) => [e.ticker, csvTxt(e.nome), csvTxt(e.setor), e.etapa, e.codigo, csvTxt(e.motivo)]))

function lerMe(pasta, versao, dataCotacoes, competencia) {
  return `# Auditoria da triagem "FIIs baratos" (Tijolo e Papel)

Execução com cotações de **${dataCotacoes}** · Informe Mensal da CVM de **${competencia}** · metodologia **v${versao}**.

**Esta triagem NÃO está publicada no app.** É uma trilha de auditoria para o responsável revisar (ver \`config/fii-baratos.json → publicacao\`).

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| \`manifesto.json\` | Origem de cada dado (URL + sha256), hashes da config, dos insumos, do resultado e do código de cálculo |
| \`config.json\` | Cópia exata dos parâmetros usados |
| \`insumos.json.gz\` | Cada linha do Informe Mensal usada (por fundo e competência) e cada cotação |
| \`resultado.json\` | Rankings, lista "a conferir", etapas e exclusões (o que o hash do resultado cobre) |
| \`memoria-de-calculo.json.gz\` | Para cada fundo: classificação, série de 12 meses, cada fórmula com seus números |
| \`ranking-tijolo.csv\`, \`ranking-papel.csv\`, \`a-conferir.csv\`, \`exclusoes.csv\` | Mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

\`\`\`
node scripts/fii-baratos-verificar.mjs ${pasta}
\`\`\`

O comando recalcula o resultado só com \`insumos.json.gz\` + \`config.json\` e compara com o hash do manifesto. Sem internet.

## Como conferir os insumos contra a fonte

Em \`memoria-de-calculo.json.gz\`, localize o ticker: cada competência traz o DY, o valor patrimonial da cota e a rentabilidade patrimonial como estavam no arquivo \`inf_mensal_fii_complemento_AAAA.csv\` da CVM (sha256 do zip no manifesto). A composição do ativo vem de \`inf_mensal_fii_ativo_passivo_AAAA.csv\`. Roteiro completo: \`docs/10-metodologia-fii-baratos.md\`.
`
}

// ---------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------

export async function executar({ raiz = RAIZ_PADRAO, dadosLocais = null, hoje = null, log = console.log, fetchImpl = fetch } = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'fii-baratos.json'))
  const snapshot = lerJson(path.join(raiz, 'webapp-src', 'src', 'data', 'rendimentosFii.json'))
  if (!snapshot.fundos?.length) throw new Error('rendimentosFii.json sem fundos: rode antes o job de FIIs.')
  const dataExecucao = hoje ?? new Date().toISOString().slice(0, 10)
  const ano = Number(dataExecucao.slice(0, 4))
  log(`Triagem de FIIs baratos: ${snapshot.fundos.length} fundos no job de FIIs · cotações de ${(snapshot.geradoEm ?? '?').slice(0, 10)} · execução em ${dataExecucao}`)

  const pastaTemp = dadosLocais ?? fs.mkdtempSync(path.join(os.tmpdir(), 'fii-baratos-'))
  const fontes = []
  const zips = []
  for (const a of [ano - 1, ano]) {
    const nome = `inf_mensal_fii_${a}.zip`
    const destino = path.join(pastaTemp, nome)
    if (dadosLocais) {
      if (!fs.existsSync(destino)) continue
      fontes.push({ papel: `Informe Mensal de FII ${a}`, url: urlInformes(a), arquivo: nome, bytes: fs.statSync(destino).size, sha256: sha256Arquivo(destino), baixadoEm: fs.statSync(destino).mtime.toISOString() })
    } else {
      log(`  baixando ${nome}…`)
      const r = await baixar(urlInformes(a), destino, { fetchImpl })
      if (!r) { log(`  ${a}: não publicado, seguindo sem ele`); continue }
      fontes.push({ papel: `Informe Mensal de FII ${a}`, url: urlInformes(a), arquivo: nome, bytes: r.bytes, sha256: r.sha256, baixadoEm: r.baixadoEm })
    }
    zips.push({ ano: a, destino })
  }
  if (!zips.length) throw new Error('Informe Mensal de FII da CVM indisponível.')

  const lerTipo = (tipo) => zips.flatMap((z) => {
    const entrada = listarZip(z.destino).find((e) => e.toLowerCase().includes(tipo) && e.toLowerCase().endsWith('.csv'))
    if (!entrada) throw new Error(`Arquivo "${tipo}" não encontrado no zip de ${z.ano}.`)
    return lerCsv(lerEntradaDoZip(z.destino, entrada)) // CSVs da CVM em ISO-8859-1
  })
  const complemento = lerTipo('complemento')
  const geral = lerTipo('geral')
  const ativo = lerTipo('ativo_passivo')
  for (const [nome, linhas, colunas] of [['complemento', complemento, ['CNPJ_Fundo_Classe', 'Data_Referencia', 'Percentual_Dividend_Yield_Mes', 'Valor_Patrimonial_Cotas']], ['geral', geral, ['CNPJ_Fundo_Classe', 'Codigo_ISIN']], ['ativo_passivo', ativo, ['CNPJ_Fundo_Classe', 'Data_Referencia', 'Total_Passivo']]]) {
    if (!linhas.length) throw new Error(`Arquivo "${nome}" da CVM veio vazio.`)
    const faltam = colunas.filter((c) => !(c in linhas[0]))
    if (faltam.length) throw new Error(`Layout inesperado em "${nome}": faltam as colunas ${faltam.join(', ')}. Cabeçalho lido: ${Object.keys(linhas[0]).join(' | ')}`)
  }
  log(`  informe: ${complemento.length} linhas de complemento, ${geral.length} de cadastro, ${ativo.length} de ativo/passivo`)

  const arquivoPrecos = path.join(raiz, 'historico', 'fiis.json')
  let historicoPrecos = null
  if (fs.existsSync(arquivoPrecos)) {
    historicoPrecos = lerJson(arquivoPrecos)
    fontes.push({ papel: 'Histórico de preço diário dos FIIs (B3, boletim BVBG.086)', url: 'historico/fiis.json (neste repositório)', arquivo: 'fiis.json', bytes: fs.statSync(arquivoPrecos).size, sha256: sha256Arquivo(arquivoPrecos), pregoes: historicoPrecos.pregoes?.length ?? 0, ultimoPregao: historicoPrecos.pregoes?.at(-1) ?? null })
    log(`  preço diário: ${historicoPrecos.pregoes?.length ?? 0} pregões, último de ${historicoPrecos.pregoes?.at(-1) ?? '?'}`)
  } else {
    log('  preço diário: historico/fiis.json não existe (rode a carga inicial de FIIs); vale o preço mensal do job de FIIs')
  }
  const insumos = montarInsumos({ complemento, geral, ativo, snapshot, cfg, dataExecucao, historicoPrecos })
  return concluir({ raiz, cfg, insumos, fontes, log })
}

/** Calcula e grava a auditoria. Separado para os testes poderem alimentar insumos prontos. */
export function concluir({ raiz, cfg, insumos, fontes = [], log = console.log, agora = new Date() }) {
  const { resultado, memoria } = calcular(insumos, cfg)
  const hashes = { config: sha256(canonico(cfg)), insumos: sha256(canonico(insumos)), resultado: hashDoResultado(resultado), memoria: sha256(canonico(memoria)) }

  const rel = path.join('auditoria', 'fii-baratos', insumos.dataExecucao)
  const pasta = path.join(raiz, rel)
  const anterior = fs.existsSync(path.join(pasta, 'manifesto.json')) ? lerJson(path.join(pasta, 'manifesto.json')) : null
  const inalterado = anterior && anterior.hashes.insumos === hashes.insumos && anterior.hashes.resultado === hashes.resultado && anterior.hashes.config === hashes.config
  if (inalterado) {
    log('Sem mudança em relação à auditoria já gravada para esta data (mesmos insumos, config e resultado).')
  } else {
    fs.mkdirSync(pasta, { recursive: true })
    gravarGz(path.join(pasta, 'insumos.json.gz'), insumos)
    gravarJson(path.join(pasta, 'config.json'), cfg)
    gravarJson(path.join(pasta, 'resultado.json'), resultado)
    gravarGz(path.join(pasta, 'memoria-de-calculo.json.gz'), memoria)
    fs.writeFileSync(path.join(pasta, 'ranking-tijolo.csv'), csvRanking(resultado.tijolo))
    fs.writeFileSync(path.join(pasta, 'ranking-papel.csv'), csvRanking(resultado.papel))
    fs.writeFileSync(path.join(pasta, 'a-conferir.csv'), csvRanking(resultado.aConferir, { comPosicao: false }))
    fs.writeFileSync(path.join(pasta, 'exclusoes.csv'), csvExclusoes(resultado))
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.md'), lerMe(rel.replace(/\\/g, '/'), cfg.versaoMetodologia, insumos.dataCotacoes, resultado.competenciaReferencia))
    const arquivosHash = {}
    for (const a of ['insumos.json.gz', 'config.json', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking-tijolo.csv', 'ranking-papel.csv', 'a-conferir.csv', 'exclusoes.csv']) arquivosHash[a] = sha256Arquivo(path.join(pasta, a))
    gravarJson(path.join(pasta, 'manifesto.json'), {
      esquema: ESQUEMA,
      versaoMetodologia: cfg.versaoMetodologia,
      geradoEm: agora.toISOString(),
      dataExecucao: insumos.dataExecucao,
      dataCotacoes: insumos.dataCotacoes,
      competenciaReferencia: resultado.competenciaReferencia,
      ambiente: { node: process.version, plataforma: process.platform, commit: process.env.GITHUB_SHA ?? null, execucao: process.env.GITHUB_RUN_ID ?? null },
      codigo: { calculoSha256: sha256Arquivo(path.join(raiz, 'scripts', 'fii-baratos-calculo.mjs')), extracaoSha256: sha256Arquivo(path.join(raiz, 'scripts', 'atualizar-fii-baratos.mjs')) },
      hashes: { ...hashes, arquivos: arquivosHash },
      fontes: [...fontes, { papel: 'Cotação e volume dos FIIs (job de FIIs)', url: 'webapp-src/src/data/rendimentosFii.json (neste repositório)', dataCotacoes: insumos.dataCotacoes }],
      contagens: { universo: resultado.universo, tijolo: resultado.tijolo.length, papel: resultado.papel.length, aConferir: resultado.aConferir.length, exclusoes: resultado.exclusoes.length, etapas: resultado.etapas },
      publicadoNoApp: cfg.publicacao?.aprovadoPeloResponsavel === true,
    })
    gravarJson(path.join(raiz, 'auditoria', 'fii-baratos', 'ultima.json'), { pasta: rel.replace(/\\/g, '/'), dataExecucao: insumos.dataExecucao, hashResultado: hashes.resultado, versaoMetodologia: cfg.versaoMetodologia })
  }

  const topo = (l) => l.slice(0, cfg.tamanhoDaLista).map((r) => r.ticker).join(' ')
  log(`Preço: diário em ${resultado.precoDiarioEm} fundos (${resultado.precoDiarioViaBrapiEm} completados pela brapi), mensal (brapi) em ${resultado.precoMensalEm}; último pregão do histórico: ${resultado.ultimoPregaoDiario ?? 'nenhum'}`)
  log(`Liquidez: mediana em ${resultado.liquidezPorMediana} fundos, média em ${resultado.liquidezPorMedia} (sem mediana no job de FIIs)`)
  log(`Universo ${resultado.universo} · competência ${resultado.competenciaReferencia} · tijolo ${resultado.tijolo.length}, papel ${resultado.papel.length}, a conferir ${resultado.aConferir.length}, fora ${resultado.exclusoes.length}`)
  log(`Top ${cfg.tamanhoDaLista} TIJOLO: ${topo(resultado.tijolo)}`)
  log(`Top ${cfg.tamanhoDaLista} PAPEL: ${topo(resultado.papel)}`)
  log(`A conferir (fora do ranking): ${resultado.aConferir.map((f) => `${f.ticker}[${f.alertas.join(',')}]`).join(' ') || 'nenhum'}`)

  // Trava de sanidade ANTES de tocar no app: resultado inverossímil derruba o job e o app fica como estava.
  const problemas = verificarSanidade(resultado, cfg)
  if (problemas.length) throw new Error(`Resultado barrado pela trava de sanidade: ${problemas.join('; ')}. A auditoria foi gravada em ${rel} para diagnóstico (veja exclusoes.csv); o app não foi alterado.`)

  // Publicação (decisão D65): só com a aprovação do responsável. Sem ela, o app recebe só o cabeçalho (mostra "em validação").
  const publicado = cfg.publicacao?.aprovadoPeloResponsavel === true
  const manifesto = lerJson(path.join(pasta, 'manifesto.json'))
  if (manifesto.publicadoNoApp !== publicado) gravarJson(path.join(pasta, 'manifesto.json'), { ...manifesto, publicadoNoApp: publicado })
  const snapshot = montarSnapshotApp({ resultado, cfg, manifesto, pasta: rel.replace(/\\/g, '/'), publicado })
  const { publico, privado } = separarSnapshot(snapshot)
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  gravarJson(path.join(raiz, 'webapp-src', 'src', 'data', 'fiiBaratos.json'), publico)
  fs.mkdirSync(path.join(raiz, 'dados-privados'), { recursive: true })
  gravarJson(path.join(raiz, 'dados-privados', 'fii-baratos.json'), privado)
  log(publicado ? (snapshot.acessoRestrito ? 'App: ranking PUBLICADO com acesso por código (lista em dados-privados/, servida por api/top15-fiis).' : 'App: ranking PUBLICADO (acesso aberto).') : 'App: ranking NÃO publicado (aprovadoPeloResponsavel = false). A auditoria completa foi gravada.')
  return { resultado, hashes, pasta, publicado }
}

/**
 * O que o app lê. Sem aprovação do responsável, vai só o cabeçalho (o app mostra "em validação").
 * Com acesso por código (D50), o arquivo do app traz SÓ o cabeçalho e a lista vai para dados-privados/.
 */
export function montarSnapshotApp({ resultado, cfg, manifesto, pasta, publicado }) {
  const acesso = cfg.publicacao?.acesso ?? {}
  const f = cfg.filtros
  return {
    publicado,
    acessoRestrito: acesso.restritoPorCodigo === true,
    instagram: acesso.instagram ?? null,
    versaoMetodologia: cfg.versaoMetodologia,
    geradoEm: manifesto.geradoEm,
    dataExecucao: resultado.dataExecucao,
    dataCotacoes: resultado.dataCotacoes,
    ultimoPregaoDiario: resultado.ultimoPregaoDiario ?? null,
    competenciaReferencia: resultado.competenciaReferencia,
    pastaAuditoria: pasta,
    hashResultado: manifesto.hashes.resultado,
    hashInsumos: manifesto.hashes.insumos,
    hashConfig: manifesto.hashes.config,
    tamanhoDaLista: cfg.tamanhoDaLista,
    universo: resultado.universo,
    aviso: cfg.publicacao?.aviso ?? cfg.publicacao?.avisoProposto ?? null,
    parametros: {
      filtros: { tijolo: f.tijolo, papel: f.papel },
      classificacao: { fatiaMinimaDoTipo: cfg.classificacao.fatiaMinimaDoTipo },
      alertas: cfg.alertas,
      mesesHistorico: cfg.dados.mesesHistorico,
      pregoesPrecoDiario: cfg.dados.pregoesPrecoDiario,
      conferenciaValidadeDias: cfg.conferencia?.validadeDias ?? null,
    },
    contagens: { tijolo: resultado.tijolo.length, papel: resultado.papel.length, aConferir: resultado.aConferir.length, exclusoes: resultado.exclusoes.length },
    tijolo: publicado ? resultado.tijolo : [],
    papel: publicado ? resultado.papel : [],
    aConferir: publicado ? resultado.aConferir : [],
    exclusoes: publicado ? resultado.exclusoes : [],
  }
}

/**
 * Separa o snapshot em duas metades quando o acesso é por código:
 *  - publico : vai no arquivo do app (cabeçalho, parâmetros, hashes). NENHUM código de fundo, NENHUM número de fundo.
 *  - privado : lista completa, só lida por api/top15-fiis.ts depois de conferir o código.
 * Sem acesso restrito, o arquivo do app leva tudo (modo aberto) e o privado fica vazio.
 */
export function separarSnapshot(completo) {
  if (!completo.acessoRestrito) return { publico: completo, privado: { publicado: false } }
  const publico = { ...completo, tijolo: [], papel: [], aConferir: [], exclusoes: [] }
  return { publico, privado: completo.publicado ? completo : { publicado: false } }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

function argumento(nome) {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : null
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const pastaVerificar = argumento('verificar')
    if (pastaVerificar) process.exit(executarCli(pastaVerificar))
    await executar({ dadosLocais: argumento('dados-locais') ? path.resolve(argumento('dados-locais')) : null, hoje: argumento('data') })
  } catch (e) {
    console.error(`ERRO: ${e.message}`)
    process.exit(1)
  }
}
