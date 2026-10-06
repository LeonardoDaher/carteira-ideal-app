// Triagem "Top 15 ações mais baratas" (D49).
//
//   node scripts/atualizar-acoes-baratas.mjs                       gera tudo (baixa os dados da CVM)
//   node scripts/atualizar-acoes-baratas.mjs --dados-locais=PASTA  usa zips já baixados (offline)
//   node scripts/atualizar-acoes-baratas.mjs --verificar=PASTA     AUDITORIA: refaz o cálculo a partir
//                                                                   dos insumos congelados e confere hashes
//   node scripts/atualizar-acoes-baratas.mjs --verificar=ultima    o mesmo, na execução mais recente
//
// Fluxo (cada etapa deixa rastro em auditoria/acoes-baratas/<data>/):
//   1. EXTRAÇÃO  : CVM (DFP, ITR, FCA) + histórico de preços da B3 → insumos.json.gz (linhas exatas usadas)
//   2. CÁLCULO   : scripts/acoes-baratas-calculo.mjs (puro) → resultado.json + memoria-de-calculo.json.gz
//   3. REGISTRO  : manifesto.json com sha256 de fontes, config, insumos, resultado e do código de cálculo
//   4. PUBLICAÇÃO: só leva o ranking se config/acoes-baratas.json → publicacao.aprovadoPeloResponsavel === true.
//                  Com acesso por código (padrão): cabeçalho em webapp-src/src/data/acoesBaratas.json e a lista
//                  completa em dados-privados/acoes-baratas.json (só api/top15.ts lê, com o código do mês).
//                  Sem acesso por código: tudo em webapp-src/src/data/acoesBaratas.json.
//
// Se algo falhar (layout da CVM mudou, poucos dados), o job termina com erro SEM alterar arquivos.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { aplicarDesdobramentos, detectarSaltos, volumeMedio } from './atualizar-bdrs.mjs'
import { calcular, canonico, hashDoResultado, sha256 } from './acoes-baratas-calculo.mjs'
import { baixar, cnpjDigitos, extrairZip, mapaTickerCnpj, resolverCnpjs, sha256Arquivo, urlDemonstracoes, urlFca } from './acoes-baratas-cvm.mjs'
import { executarCli, verificar } from './acoes-baratas-verificar.mjs'

export { verificar }

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ESQUEMA = 1

const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const gravarJson = (arquivo, obj, bonito = true) => fs.writeFileSync(arquivo, JSON.stringify(obj, null, bonito ? 2 : 0) + '\n')
const gravarGz = (arquivo, obj) => fs.writeFileSync(arquivo, zlib.gzipSync(JSON.stringify(obj), { level: 9 }))
const lerGz = (arquivo) => JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8'))

// ---------------------------------------------------------------------------------------
// Preços (histórico próprio da B3, mantido pelo job de Ações)
// ---------------------------------------------------------------------------------------

const classeDe = (ticker) => (ticker.endsWith('3') ? 'ON' : 'PN')

/** Junta desdobramentos de várias fontes (config/acoes.json e config/acoes-baratas.json) sem duplicar a mesma data. */
export function mesclarDesdobramentos(...fontes) {
  const saida = {}
  for (const f of fontes) {
    for (const [ticker, eventos] of Object.entries(f ?? {})) {
      if (ticker.startsWith('_') || !Array.isArray(eventos)) continue
      const lista = (saida[ticker] ??= [])
      for (const e of eventos) if (e && !lista.some((x) => x.data === e.data)) lista.push(e)
      lista.sort((a, b) => (a.data < b.data ? -1 : 1))
    }
  }
  return saida
}

/** Empresas do cadastro curado, na ordem do arquivo. */
export function empresasDoCadastro(configAcoes) {
  const lista = []
  for (const s of configAcoes.setores ?? []) for (const e of s.empresas) lista.push({ ticker: e.ticker.toUpperCase(), nome: e.nome, setor: s.setor })
  return lista
}

/**
 * Bloco de preço de UMA empresa: referência, demais classes (mesmo prefixo de 4 letras),
 * liquidez do emissor (soma das classes) e série de fechamentos ajustada para a volatilidade.
 */
export function extrairPreco(historico, ticker, configAcoes, cfg, maxIdadeDias = 10) {
  const { pregoes, ativos } = historico
  const total = pregoes.length
  const ultimoPregao = pregoes[total - 1]
  const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000)
  const serie = ativos[ticker]
  if (!serie?.length) return { ref: null, motivoSemPreco: 'ticker sem série no histórico da B3' }

  const datas = pregoes.slice(total - serie.length)
  const ajustada = aplicarDesdobramentos(serie, datas, configAcoes.desdobramentos?.[ticker])
  let iu = -1
  for (let i = ajustada.length - 1; i >= 0; i--) if (ajustada[i]) { iu = i; break }
  if (iu < 0) return { ref: null, motivoSemPreco: 'sem nenhum negócio no histórico' }
  if (dias(datas[iu], ultimoPregao) > maxIdadeDias) return { ref: null, motivoSemPreco: `último negócio em ${datas[iu]}, há mais de ${maxIdadeDias} dias do último pregão (${ultimoPregao})` }

  const janela = cfg.filtros.sessoesVolatilidade
  const saltos = detectarSaltos(ajustada, datas, janela).map((s) => ({ data: s.data, de: s.de, para: s.para, fator: s.fator }))
  const fechamentos = ajustada.slice(-(janela + 1)).filter(Boolean).map((v) => Math.round(v[0] * 1e6) / 1e6)

  const prefixo = ticker.slice(0, 4)
  // Classes = só ON/PN de verdade (cinco caracteres, final 3 a 6). A UNIT (final 11) NÃO é classe: vale várias ações juntas.
  const irmaos = Object.keys(ativos).filter((t) => t.length === 5 && t.startsWith(prefixo) && /[3-6]$/.test(t)).sort()
  // Já o VOLUME do emissor soma tudo o que negocia, inclusive a unit (é onde costuma estar a liquidez).
  const paraVolume = [...new Set([...irmaos, ticker])]

  const classes = []
  for (const t of irmaos) {
    const s = ativos[t]
    const d = pregoes.slice(total - s.length)
    let k = -1
    for (let i = s.length - 1; i >= 0; i--) if (s[i]) { k = i; break }
    if (k < 0 || dias(d[k], ultimoPregao) > maxIdadeDias) continue
    classes.push({ classe: classeDe(t), ticker: t, fechamento: Math.round(s[k][0] * 1e4) / 1e4, data: d[k], volume: volumeMedio(s, total) })
  }
  // Uma linha por classe: a mais negociada entre as preferenciais.
  const porClasse = new Map()
  for (const c of classes) {
    const atual = porClasse.get(c.classe)
    if (!atual || c.volume > atual.volume || (c.volume === atual.volume && c.ticker < atual.ticker)) porClasse.set(c.classe, c)
  }

  const sessoes = Math.min(cfg.filtros.sessoesLiquidez, total)
  let soma = 0
  for (const t of paraVolume) {
    const s = ativos[t]
    for (let j = 0; j < sessoes; j++) {
      const v = s[s.length - 1 - j]
      if (v) soma += v[3]
    }
  }

  return {
    ref: { ticker, fechamento: Math.round(ajustada[iu][0] * 1e4) / 1e4, data: datas[iu] },
    classes: [...porClasse.values()].map(({ volume, ...resto }) => resto),
    tickersDoEmissor: paraVolume,
    volumeMedioEmissor: Math.round(soma / sessoes),
    serieAjustada: fechamentos,
    saltosNaoResolvidos: saltos,
  }
}

// ---------------------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------------------

/**
 * Junta tudo que o cálculo precisa. Não decide nada: cada exclusão acontece em acoes-baratas-calculo.mjs.
 */
export function montarInsumos({ empresas, historico, configAcoes, cfg, mapeamento, contabeis, dataCorte }) {
  const dataPrecos = historico.pregoes.at(-1)
  const porTicker = new Map(mapeamento.map((m) => [m.ticker, m]))
  return {
    esquema: ESQUEMA,
    dataCorte,
    dataPrecos,
    empresas: empresas.map((e) => {
      const m = porTicker.get(e.ticker)
      const cnpj = m?.cnpj ?? null
      const c = cnpj ? contabeis.get(cnpjDigitos(cnpj)) : null
      return { ...e, cnpj, origemCnpj: m?.origem ?? null, preco: extrairPreco(historico, e.ticker, configAcoes, cfg), contabil: c ?? null }
    }),
  }
}

/** Agrupa as linhas extraídas por CNPJ. */
export function agruparPorCnpj(extracoes) {
  const mapa = new Map()
  const pega = (cnpj) => {
    if (!mapa.has(cnpj)) mapa.set(cnpj, { docs: [], linhas: [], capital: [] })
    return mapa.get(cnpj)
  }
  for (const ex of extracoes) {
    for (const d of ex.docs) { const { cnpj, ...resto } = d; pega(cnpj).docs.push(resto) }
    for (const l of ex.linhas) { const { cnpj, ...resto } = l; pega(cnpj).linhas.push(resto) }
    for (const k of ex.capital) { const { cnpj, ...resto } = k; pega(cnpj).capital.push(resto) }
  }
  const ordenar = (a, b) => canonico(a).localeCompare(canonico(b))
  for (const v of mapa.values()) { v.docs.sort(ordenar); v.linhas.sort(ordenar); v.capital.sort(ordenar) }
  return mapa
}

// ---------------------------------------------------------------------------------------
// Saída: CSVs, snapshot do app, auditoria
// ---------------------------------------------------------------------------------------

const csvNum = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const csvTxt = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`
const csv = (cabecalho, linhas) => '\uFEFF' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n') + '\r\n'

export function csvRanking(resultado) {
  return csv(
    ['posicao', 'ticker', 'nome', 'setor', 'cotacao', 'data_cotacao', 'nota', 'PL/VM', 'FCO/EV', 'EBIT_aj/EV', 'P/VP', 'mktcap_R$', 'ev_R$', 'ebit_aj_12m_R$', 'fco_12m_R$', 'lucro_12m_R$', 'roic', 'dl/ebitda', 'cobertura_juros', 'exercicios_lucro', 'exercicios_fco', 'exercicios_analisados', 'passa_roic', 'passa_dl_ebitda', 'passa_fco', 'passa_cobertura', 'passa_consistencia', 'volatilidade', 'volume_medio_R$', 'metodo_valor_mercado', 'ajuste_unidade_capital', 'alertas', 'demonstracao', 'data_base', 'link_documento'],
    resultado.ranking.map((r) => [r.posicao, r.ticker, csvTxt(r.nome), csvTxt(r.setor), csvNum(r.cotacao), r.dataCotacao, csvNum(r.nota), csvNum(r.plSobreValorDeMercado), csvNum(r.fcoSobreEv), csvNum(r.ebitAjustadoSobreEv), csvNum(r.pvp), csvNum(r.mktcap), csvNum(r.ev), csvNum(r.ebitAjustado), csvNum(r.fcoLtm), csvNum(r.lucroLtm), csvNum(r.roic), csvNum(r.dlEbitda), csvNum(r.coberturaJuros), r.exerciciosComLucro, r.exerciciosComFco, r.exerciciosAnalisados, r.passaRoic ? 'S' : 'N', r.passaDlEbitda ? 'S' : 'N', r.passaFco ? 'S' : 'N', r.passaCobertura ? 'S' : 'N', r.passaConsistencia ? 'S' : 'N', csvNum(r.volatilidade), csvNum(r.volumeMedio), r.metodoValorDeMercado, csvTxt(r.ajusteUnidadeCapital ?? ''), csvTxt((r.alertas ?? []).join(',')), r.demonstracao.doc, r.demonstracao.dtRefer, csvTxt(r.demonstracao.linkDoc)]),
  )
}

export const csvExclusoes = (resultado) => csv(['ticker', 'nome', 'setor', 'etapa', 'codigo', 'motivo'], resultado.exclusoes.map((e) => [e.ticker, csvTxt(e.nome), csvTxt(e.setor), e.etapa, e.codigo, csvTxt(e.motivo)]))
export const csvMapeamento = (mapeamento, empresas) => csv(['ticker', 'nome_no_cadastro', 'cnpj', 'origem'], mapeamento.map((m) => [m.ticker, csvTxt(empresas.find((e) => e.ticker === m.ticker)?.nome), m.cnpj ?? '', csvTxt(m.origem)]))

/**
 * Separa o snapshot em duas metades quando o acesso é por código (D50):
 *  - publico : vai no arquivo do app (cabeçalho, parâmetros, hashes). NENHUM nome de ação, NENHUM número de empresa.
 *  - privado : lista completa, só lida por api/top15.ts depois de conferir o código.
 * Sem acesso restrito, o arquivo do app leva tudo (modo aberto) e o privado fica vazio.
 */
export function separarSnapshot(completo) {
  if (!completo.acessoRestrito) return { publico: completo, privado: { publicado: false } }
  const publico = { ...completo, etapas: [], ranking: [], exclusoes: [] }
  return { publico, privado: completo.publicado ? completo : { publicado: false } }
}

/** O que o app lê. Sem aprovação do responsável, vai só o cabeçalho (o app mostra "em validação"). */
export function montarSnapshotApp({ resultado, cfg, manifesto, pasta, publicado }) {
  const q = cfg.qualidade
  const acesso = cfg.publicacao?.acesso ?? {}
  return {
    publicado,
    acessoRestrito: acesso.restritoPorCodigo === true,
    instagram: acesso.instagram ?? null,
    versaoMetodologia: cfg.versaoMetodologia,
    geradoEm: manifesto.geradoEm,
    dataPrecos: resultado.dataPrecos,
    dataCorte: resultado.dataCorte,
    pastaAuditoria: pasta,
    hashResultado: manifesto.hashes.resultado,
    hashInsumos: manifesto.hashes.insumos,
    hashConfig: manifesto.hashes.config,
    tamanhoDaLista: cfg.tamanhoDaLista,
    universo: resultado.universo,
    parametros: {
      liquidezMinimaDiariaReais: cfg.filtros.liquidezMinimaDiariaReais,
      sessoesLiquidez: cfg.filtros.sessoesLiquidez,
      percentilVolatilidadeExcluir: cfg.filtros.percentilVolatilidadeExcluir,
      sessoesVolatilidade: cfg.filtros.sessoesVolatilidade,
      metodoComposicao: cfg.indicador.metodoComposicao,
      componentes: cfg.indicador.componentes,
      setoresExcluidos: cfg.universo.setoresExcluidos,
    },
    qualidade: {
      roicMinimo: q.roic.minimo, aliquotaImpostoNopat: q.roic.aliquotaImpostoNopat, dlEbitdaMaximo: q.dividaLiquidaSobreEbitda.maximo, fcoPositivo: q.fcoPositivo,
      coberturaJurosMinima: q.coberturaJuros.minimo, exerciciosConsistencia: q.consistencia.exercicios, minimoComLucro: q.consistencia.minimoComLucro, minimoComFco: q.consistencia.minimoComFcoPositivo,
    },
    etapas: publicado ? resultado.etapas : [],
    ranking: publicado ? resultado.ranking : [],
    exclusoes: publicado ? resultado.exclusoes : [],
  }
}

function lerMe(pasta, versaoMetodologia, dataPrecos) {
  return `# Auditoria da triagem "Top 15 ações mais baratas"

Execução com preços de **${dataPrecos}** · metodologia **v${versaoMetodologia}**.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| \`manifesto.json\` | Origem de cada dado (URL + sha256), hashes da config, dos insumos, do resultado e do código de cálculo |
| \`config.json\` | Cópia exata dos parâmetros usados |
| \`insumos.json.gz\` | Cada linha das demonstrações da CVM (conta, versão, período, link do documento) e cada preço usados |
| \`resultado.json\` | Ranking, etapas e exclusões (o que o hash do resultado cobre) |
| \`memoria-de-calculo.json.gz\` | Para cada empresa: cada fórmula com cada número e a conta da CVM de origem |
| \`ranking.csv\`, \`exclusoes.csv\` | Mesmas informações, abertas em planilha |
| \`mapeamento-ticker-cnpj.csv\` | Qual CNPJ foi associado a cada código, e por quê |

## Como refazer o cálculo e conferir

\`\`\`
node scripts/acoes-baratas-verificar.mjs ${pasta}
\`\`\`

O comando recalcula o resultado só com \`insumos.json.gz\` + \`config.json\` e compara com o hash do manifesto.
Sem internet. Se o hash bater, o ranking publicado é exatamente o que a metodologia produz com aqueles insumos.

## Como conferir os insumos contra a fonte

1. Escolha uma empresa em \`ranking.csv\` e abra o \`link_documento\` (documento original na CVM).
2. Em \`memoria-de-calculo.json.gz\`, localize o ticker: cada componente traz conta (CD_CONTA), descrição, período, versão e valor.
3. Compare com a demonstração do documento. Um roteiro de conferência manual está em \`docs/09-metodologia-acoes-baratas.md\`.
`
}

// ---------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------

export async function executar({ raiz = RAIZ_PADRAO, dadosLocais = null, dataCorte = null, log = console.log, fetchImpl = fetch } = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'acoes-baratas.json'))
  const configAcoes = lerJson(path.join(raiz, 'config', 'acoes.json'))
  const historico = lerJson(path.join(raiz, 'historico', 'acoes.json'))
  const manualCnpj = fs.existsSync(path.join(raiz, 'config', 'acoes-baratas-cnpj.json')) ? lerJson(path.join(raiz, 'config', 'acoes-baratas-cnpj.json')) : {}
  delete manualCnpj._leia

  if (!historico.pregoes?.length) throw new Error('historico/acoes.json vazio: rode antes a carga inicial de Ações.')
  const dataPrecos = historico.pregoes.at(-1)
  const corte = dataCorte ?? cfg.dataCorteContabil ?? dataPrecos
  const ano = Number(corte.slice(0, 4))
  const empresas = empresasDoCadastro(configAcoes)
  log(`Triagem de valor: ${empresas.length} empresas no cadastro · preços de ${dataPrecos} · corte contábil ${corte}`)

  const pastaTemp = dadosLocais ?? fs.mkdtempSync(path.join(os.tmpdir(), 'acoes-baratas-'))
  const fontes = []
  const obter = async (papel, url, nome) => {
    const destino = path.join(pastaTemp, nome)
    if (dadosLocais) {
      if (!fs.existsSync(destino)) return null
      const bytes = fs.statSync(destino).size
      fontes.push({ papel, url, arquivo: nome, bytes, sha256: sha256Arquivo(destino), baixadoEm: fs.statSync(destino).mtime.toISOString() })
      return destino
    }
    log(`  baixando ${nome}…`)
    const r = await baixar(url, destino, { fetchImpl })
    if (!r) return null
    fontes.push({ papel, url, arquivo: nome, bytes: r.bytes, sha256: r.sha256, baixadoEm: r.baixadoEm })
    return destino
  }

  // 1) Mapeamento ticker → CNPJ (FCA do ano; se ainda não existe, o do ano anterior)
  // FCA do ano e do ano anterior: a empresa que ainda não entregou o do ano corrente (ou mudou de código) é achada no anterior.
  // O mais recente vale; o anterior só preenche os códigos que o recente não traz.
  const zipsFca = []
  for (const a of [ano, ano - 1]) {
    const z = await obter('FCA (valores mobiliários)', urlFca(a), `fca_cia_aberta_${a}.zip`)
    if (z) zipsFca.push(z)
  }
  if (!zipsFca.length) throw new Error('FCA da CVM indisponível: sem ele não há como ligar código de negociação a CNPJ.')
  const mapaFca = await mapaTickerCnpj(zipsFca)
  const mapeamento = resolverCnpjs(empresas.map((e) => e.ticker), mapaFca, manualCnpj)
  const cnpjs = new Set(mapeamento.filter((m) => m.cnpj).map((m) => cnpjDigitos(m.cnpj)))
  log(`  CNPJ resolvido para ${cnpjs.size} de ${empresas.length} empresas`)

  // 2) Demonstrações: DFP (3 exercícios) e ITR (2 anos), necessários para o LTM
  const extracoes = []
  const estatisticas = []
  const N = cfg.qualidade.consistencia.exercicios
  const anosDfp = Array.from({ length: N + 1 }, (_, k) => ano - N + k) // N exercícios para trás + o do ano corrente (se já houver)
  for (const [tipo, anos] of [['DFP', anosDfp], ['ITR', [ano - 1, ano]]]) {
    for (const a of anos) {
      const zip = await obter(`${tipo} ${a}`, urlDemonstracoes(tipo, a), `${tipo.toLowerCase()}_cia_aberta_${a}.zip`)
      if (!zip) { log(`  ${tipo} ${a}: não publicado, seguindo sem ele`); continue }
      // DFP de 3+ anos atrás só servem à consistência de N exercícios: guardamos apenas lucro e FCO.
      const ex = await extrairZip(zip, tipo, cnpjs, { log, somenteHistorico: tipo === 'DFP' && a < ano - 2 })
      extracoes.push(ex)
      estatisticas.push({ arquivo: path.basename(zip), ...ex.estatisticas, arquivos: ex.estatisticas.arquivos.length })
    }
  }
  if (!extracoes.some((e) => e.linhas.length)) throw new Error('Nenhuma linha de demonstração extraída: layout da CVM mudou ou o mapeamento de CNPJ falhou.')
  const contabeis = agruparPorCnpj(extracoes)

  const configPrecos = { ...configAcoes, desdobramentos: mesclarDesdobramentos(configAcoes.desdobramentos, cfg.desdobramentos) }
  const insumos = montarInsumos({ empresas, historico, configAcoes: configPrecos, cfg, mapeamento, contabeis, dataCorte: corte })
  return concluir({ raiz, cfg, empresas, mapeamento, insumos, fontes, estatisticas, log })
}

/**
 * Trava de sanidade da PUBLICAÇÃO. Dados da CVM que nunca foram vistos podem quebrar de formas que não
 * derrubam o job (ex.: CNPJ não mapeado para metade do cadastro). Se o resultado é claramente
 * inverossímil, a publicação é barrada. Setores fora do escopo (bancos etc.) não contam como "sem dados".
 */
export function verificarSanidade(resultado, cfg) {
  const s = cfg.publicacao?.sanidade
  if (!s) return []
  const problemas = []
  if (resultado.ranking.length < s.minimoNoRanking) problemas.push(`só ${resultado.ranking.length} empresas no ranking (mínimo ${s.minimoNoRanking})`)
  const noEscopo = resultado.universo - resultado.exclusoes.filter((e) => e.codigo === 'setor_excluido').length
  const semDados = resultado.exclusoes.filter((e) => e.etapa === 'dados_contabeis' || e.codigo === 'sem_cnpj' || e.codigo === 'sem_preco').length
  if (noEscopo > 0 && semDados / noEscopo > s.maximoFracaoSemDados) problemas.push(`${semDados} de ${noEscopo} empresas no escopo sem dados utilizáveis (${Math.round((semDados / noEscopo) * 100)}%; máximo ${Math.round(s.maximoFracaoSemDados * 100)}%)`)
  return problemas
}

/** Calcula, grava a auditoria e o snapshot do app. Separado para os testes poderem alimentar insumos prontos. */
export function concluir({ raiz, cfg, empresas, mapeamento, insumos, fontes = [], estatisticas = [], log = console.log, agora = new Date() }) {
  const { resultado, memoria } = calcular(insumos, cfg)
  const hashes = { config: sha256(canonico(cfg)), insumos: sha256(canonico(insumos)), resultado: hashDoResultado(resultado), memoria: sha256(canonico(memoria)) }

  const rel = path.join('auditoria', 'acoes-baratas', insumos.dataPrecos)
  const pasta = path.join(raiz, rel)
  const manifestoAnterior = fs.existsSync(path.join(pasta, 'manifesto.json')) ? lerJson(path.join(pasta, 'manifesto.json')) : null
  const inalterado = manifestoAnterior && manifestoAnterior.hashes.insumos === hashes.insumos && manifestoAnterior.hashes.resultado === hashes.resultado && manifestoAnterior.hashes.config === hashes.config

  const publicado = cfg.publicacao.aprovadoPeloResponsavel === true
  if (inalterado) {
    log('Sem mudança em relação à auditoria já gravada para esta data (mesmos insumos, config e resultado).')
  } else {
    fs.mkdirSync(pasta, { recursive: true })
    gravarGz(path.join(pasta, 'insumos.json.gz'), insumos)
    gravarJson(path.join(pasta, 'config.json'), cfg)
    gravarJson(path.join(pasta, 'resultado.json'), resultado)
    gravarGz(path.join(pasta, 'memoria-de-calculo.json.gz'), memoria)
    fs.writeFileSync(path.join(pasta, 'ranking.csv'), csvRanking(resultado))
    fs.writeFileSync(path.join(pasta, 'exclusoes.csv'), csvExclusoes(resultado))
    fs.writeFileSync(path.join(pasta, 'mapeamento-ticker-cnpj.csv'), csvMapeamento(mapeamento, empresas))
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.md'), lerMe(rel, cfg.versaoMetodologia, insumos.dataPrecos))
    const arquivosHash = {}
    for (const a of ['insumos.json.gz', 'config.json', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'exclusoes.csv', 'mapeamento-ticker-cnpj.csv']) arquivosHash[a] = sha256Arquivo(path.join(pasta, a))
    const manifesto = {
      esquema: ESQUEMA,
      versaoMetodologia: cfg.versaoMetodologia,
      geradoEm: agora.toISOString(),
      dataPrecos: insumos.dataPrecos,
      dataCorte: insumos.dataCorte,
      ambiente: { node: process.version, plataforma: process.platform, commit: process.env.GITHUB_SHA ?? null, execucao: process.env.GITHUB_RUN_ID ?? null },
      codigo: { calculoSha256: sha256Arquivo(path.join(raiz, 'scripts', 'acoes-baratas-calculo.mjs')), extracaoSha256: sha256Arquivo(path.join(raiz, 'scripts', 'acoes-baratas-cvm.mjs')) },
      hashes: { ...hashes, arquivos: arquivosHash },
      fontes: [...fontes, { papel: 'Histórico de preços da B3 (Boletim BVBG.086)', url: 'historico/acoes.json (neste repositório)', ultimoPregao: insumos.dataPrecos }],
      extracao: estatisticas,
      contagens: { universo: resultado.universo, noRanking: resultado.ranking.length, exclusoes: resultado.exclusoes.length, etapas: resultado.etapas },
      publicadoNoApp: publicado,
    }
    gravarJson(path.join(pasta, 'manifesto.json'), manifesto)
    gravarJson(path.join(raiz, 'auditoria', 'acoes-baratas', 'ultima.json'), { pasta: rel.replace(/\\/g, '/'), dataPrecos: insumos.dataPrecos, hashResultado: hashes.resultado, versaoMetodologia: cfg.versaoMetodologia })
  }

  if (publicado) {
    const problemas = verificarSanidade(resultado, cfg)
    if (problemas.length) {
      throw new Error(`Publicação barrada pela trava de sanidade: ${problemas.join('; ')}. A auditoria desta execução foi gravada em ${rel} para diagnóstico (veja exclusoes.csv e mapeamento-ticker-cnpj.csv); o app não foi alterado.`)
    }
  }

  const manifesto = lerJson(path.join(pasta, 'manifesto.json'))
  const snapshot = montarSnapshotApp({ resultado, cfg, manifesto, pasta: rel.replace(/\\/g, '/'), publicado })
  const { publico, privado } = separarSnapshot(snapshot)
  gravarJson(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesBaratas.json'), publico)
  fs.mkdirSync(path.join(raiz, 'dados-privados'), { recursive: true })
  gravarJson(path.join(raiz, 'dados-privados', 'acoes-baratas.json'), privado)

  const topo = resultado.ranking.slice(0, cfg.tamanhoDaLista).map((r) => r.ticker).join(' ')
  log(`Universo ${resultado.universo} → ${resultado.ranking.length} no ranking, ${resultado.exclusoes.length} fora. Top ${cfg.tamanhoDaLista}: ${topo}`)
  log(publicado ? (snapshot.acessoRestrito ? 'App: ranking PUBLICADO com acesso por código (lista em dados-privados/, servida por api/top15).' : 'App: ranking PUBLICADO (acesso aberto).') : 'App: ranking NÃO publicado (aprovadoPeloResponsavel = false). A auditoria completa foi gravada.')
  return { resultado, hashes, pasta, publicado }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

function argumento(nome) {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : null
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const pastaVerificar = argumento('verificar')
  try {
    if (pastaVerificar) {
      process.exit(executarCli(pastaVerificar))
    }
    await executar({ dadosLocais: argumento('dados-locais') ? path.resolve(argumento('dados-locais')) : null, dataCorte: argumento('data-corte') })
  } catch (e) {
    console.error(`ERRO: ${e.message}`)
    process.exit(1)
  }
}
