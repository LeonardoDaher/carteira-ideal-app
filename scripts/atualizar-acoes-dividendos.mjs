// "Top 15 ações pagadoras de dividendos" (D122): job com trilha de auditoria, no desenho da D89 (diário, auditoria completa mensal).
//
//   node scripts/atualizar-acoes-dividendos.mjs                 execução diária (grava a pasta de auditoria só na primeira do mês)
//   node scripts/atualizar-acoes-dividendos.mjs --completa      força a auditoria completa
//   node scripts/atualizar-acoes-dividendos.mjs --verificar     refaz o cálculo da última auditoria completa
//
// COM REDE (só aqui): baixa da B3 os proventos em dinheiro de cada empresa do cadastro (config/acoes.json) e usa o preço de
// fechamento já guardado em historico/acoes.json. O cálculo (acoes-dividendos-calculo.mjs) é puro.
//   - Primeira execução do mês (ou parâmetros/código de cálculo mudaram, ou --completa): grava auditoria/acoes-dividendos/<data>/
//     (manifesto com sha256, insumos baixados da B3, config, resultado, memória de cálculo, CSVs).
//   - Demais dias úteis: recalcula e CONFERE de forma independente em memória (relê insumos e config, refaz o cálculo, compara
//     os hashes) e publica sem pasta nova.
// PUBLICAÇÃO: só leva a lista ao app se config/acoes-dividendos.json → publicacao.aprovadoPeloResponsavel === true E a trava de
// sanidade passar. Acesso ABERTO (sem código): webapp-src/src/data/acoesDividendos.json traz tudo.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarProventosDaEmpresa } from './b3-proventos.mjs'
import { calcularDividendos, canonico, hashDoResultado, sha256, somarDias, verificarSanidade } from './acoes-dividendos-calculo.mjs'
import { conferirEmMemoria, decidirModo, lerAuditoriaCompleta } from './auditoria-diaria.mjs'
import { executarCli, verificar } from './acoes-dividendos-verificar.mjs'

export { verificar }

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ESQUEMA = 1
const PASTA = 'acoes-dividendos'
export const ARQUIVO_APP = path.join('webapp-src', 'src', 'data', 'acoesDividendos.json')

const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const gravarJson = (arquivo, obj) => fs.writeFileSync(arquivo, JSON.stringify(obj, null, 2) + '\n')
const gravarGz = (arquivo, obj) => fs.writeFileSync(arquivo, zlib.gzipSync(JSON.stringify(obj), { level: 9 }))
const hashArquivo = (caminho) => crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex')
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/** Hash do código que decide o resultado: o cálculo desta lista e o leitor da B3. */
export const hashDoCodigo = (raiz) => sha256(hashArquivo(path.join(raiz, 'scripts', 'acoes-dividendos-calculo.mjs')) + hashArquivo(path.join(raiz, 'scripts', 'b3-proventos.mjs')))

// ---------------------------------------------------------------------------------------
// CSVs e LEIA-ME
// ---------------------------------------------------------------------------------------

const csvNum = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','))
const csvTxt = (t) => `"${String(t ?? '').replace(/"/g, '""')}"`
const csv = (cabecalho, linhas) => '﻿' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n') + '\r\n'
export const csvRanking = (lista) =>
  csv(['posicao', 'ticker', 'nome', 'setor', 'classe', 'cotacao', 'data_cotacao', 'DY_12m', 'proventos_por_acao_R$', 'dividendos_R$', 'jcp_bruto_R$', 'rendimentos_R$', 'pagamentos', 'primeira_data_com', 'ultima_data_com', 'alertas'],
    lista.map((r) => [r.posicao, r.ticker, csvTxt(r.nome), csvTxt(r.setor), r.classe, csvNum(r.cotacao), r.dataCotacao, csvNum(r.dy), csvNum(r.proventosPorAcao), csvNum(r.dividendos), csvNum(r.jcp), csvNum(r.rendimentos), r.pagamentos, r.primeiraDataCom, r.ultimaDataCom, csvTxt(r.alertas.join(','))]))
export const csvProventos = (lista) =>
  csv(['ticker', 'data_com', 'tipo', 'valor_por_acao_R$'], lista.flatMap((r) => r.proventos.map((p) => [r.ticker, p.dataCom, p.tipo, csvNum(p.valor)])))
export const csvExclusoes = (resultado) => csv(['ticker', 'nome', 'setor', 'etapa', 'codigo', 'motivo'], resultado.exclusoes.map((e) => [e.ticker, csvTxt(e.nome), csvTxt(e.setor), e.etapa, e.codigo, csvTxt(e.motivo)]))

function leiaMe(pasta, versao, dataPrecos) {
  return `# Auditoria: Top 15 ações pagadoras de dividendos

Execução com preços de **${dataPrecos}** · metodologia **v${versao}**. Os proventos vêm da API pública da B3 (aba "Proventos em dinheiro" de cada empresa).

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| \`manifesto.json\` | Origem dos insumos, hashes da config, dos insumos, do resultado e do código de cálculo |
| \`config.json\` | Parâmetros desta lista |
| \`insumos.json.gz\` | Proventos de cada empresa como a B3 publicou (classe, tipo, valor por ação, data com) e o preço de fechamento usado |
| \`resultado.json\` | Ranking, etapas e exclusões (o que o hash do resultado cobre) |
| \`memoria-de-calculo.json.gz\` | Para cada empresa: os proventos que entraram na soma e os que ficaram de fora |
| \`ranking.csv\`, \`proventos.csv\`, \`exclusoes.csv\` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

\`\`\`
node scripts/acoes-dividendos-verificar.mjs ${pasta}
\`\`\`

O comando recalcula o resultado só com \`insumos.json.gz\` + \`config.json\` e compara com o hash do manifesto. Sem internet. Ele não prova que os insumos reproduzem a B3: para isso, compare um código com a página de proventos da empresa em b3.com.br.
`
}

// ---------------------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------------------

/** Empresas do cadastro com preço de fechamento e liquidez média, a partir do histórico de preços (sem rede). */
export function empresasDoCadastro({ cadastro, historico, cfg, lerAjustes = () => [] }) {
  const ultimoPregao = historico.pregoes.at(-1)
  const saida = []
  const somenteDy = []
  for (const setor of cadastro.setores) {
    for (const e of setor.empresas) {
      // Ações só da tela (D136) não entram no ranking (o universo dele não muda), mas precisam do DY de 12 meses para o preço teto
      // e a análise fundamentalista (D141): vão para uma lista à parte.
      const destino = e.extra ? somenteDy : saida
      const serie = historico.ativos?.[e.ticker] ?? []
      const ultimo = historico.ultimoNegocio?.[e.ticker]
      const recentes = serie.slice(-cfg.sessoesLiquidez)
      const liquidez = recentes.length ? recentes.reduce((s, c) => s + (c?.[3] ?? 0), 0) / cfg.sessoesLiquidez : 0
      // Só vale o preço de quem negociou nos últimos pregões: papel parado há meses não tem preço de referência.
      const cotacao = ultimo && ultimo[0] >= somarDias(ultimoPregao, -10) ? ultimo[1] : null
      destino.push({ ticker: e.ticker, nome: e.nome, setor: setor.setor, cotacao, dataCotacao: cotacao ? ultimo[0] : null, liquidezDiaria: Math.round(liquidez), ajustes: lerAjustes(e.ticker) })
    }
  }
  return { dataPrecos: ultimoPregao, empresas: saida, somenteDy }
}

/**
 * Baixa os proventos de cada empresa com preço (a liquidez só filtra o ranking; o DY de todas alimenta a análise da ação). `baixar` é injetável
 * para os testes. Uma empresa que falha no download fica com `motivoSemDados` e o job segue; a trava de sanidade decide se o
 * conjunto ainda serve.
 */
export async function montarInsumos({ cadastro, historico, cfg, baixar = baixarProventosDaEmpresa, log = console.log, opcoesRede = {}, lerAjustes }) {
  const { dataPrecos, empresas, somenteDy } = empresasDoCadastro({ cadastro, historico, cfg, lerAjustes })
  const inicio = somarDias(dataPrecos, -cfg.janelaDias - 30)
  const cache = new Map()
  let feitas = 0
  const todas = [...empresas, ...somenteDy]
  const alvo = todas.filter((e) => e.cotacao > 0)
  for (const emp of todas) {
    emp.eventos = []
    if (!alvo.includes(emp)) continue
    const raiz = emp.ticker.slice(0, 4)
    if (!cache.has(raiz)) {
      try {
        cache.set(raiz, await baixar(raiz, { pausaEntreChamadasMs: cfg.pausaEntreChamadasMs, ...opcoesRede }))
      } catch (e) {
        cache.set(raiz, { erro: String(e?.message ?? e) })
      }
      feitas++
      if (cfg.pausaEntreChamadasMs) await pausa(cfg.pausaEntreChamadasMs)
    }
    const r = cache.get(raiz)
    if (r.erro) { emp.motivoSemDados = `Falha ao baixar da B3: ${r.erro}`; continue }
    emp.nomeDePregao = r.nomeDePregao ?? null
    emp.historicoDisponivel = r.historicoDisponivel
    emp.sha256B3 = r.sha256
    if (r.motivo) emp.motivoSemDados = r.motivo
    emp.eventos = r.eventos.filter((ev) => ev.dataCom >= inicio)
  }
  log(`B3: proventos baixados de ${feitas} empresas (${alvo.length} tickers no escopo).`)
  return { esquema: ESQUEMA, fonte: 'B3, sistemaswebb3-listados.b3.com.br (GetListedSupplementCompany e GetListedCashDividends)', dataPrecos, empresas, somenteDy }
}

/**
 * Desdobramentos e grupamentos de cada ação: os confirmados em config/acoes.json e os detectados no histórico longo do COTAHIST
 * (webapp-src/public/dados/acoes-historico/<código>.json, campo "ajustes"), a mesma base que ajusta os gráficos.
 */
export function ajustesDoHistorico(raiz) {
  return (ticker) => {
    try {
      const arq = lerJson(path.join(raiz, 'webapp-src', 'public', 'dados', 'acoes-historico', `${ticker}.json`))
      return (arq.ajustes ?? []).filter((a) => a.data && a.fator > 0).map((a) => ({ data: a.data, fator: a.fator }))
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------

export async function executar({ raiz = RAIZ_PADRAO, hoje = null, log = console.log, forcarCompleta = false, agora = new Date(), baixar } = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'acoes-dividendos.json'))
  const cadastro = lerJson(path.join(raiz, 'config', 'acoes.json'))
  const historico = lerJson(path.join(raiz, 'historico', 'acoes.json'))
  if (!historico.pregoes?.length) throw new Error('historico/acoes.json vazio: rode antes a carga inicial de Ações.')
  const dataExecucao = hoje ?? agora.toISOString().slice(0, 10)
  log(`Ações pagadoras de dividendos: preços de ${historico.pregoes.at(-1)} · execução em ${dataExecucao}`)
  const insumos = await montarInsumos({ cadastro, historico, cfg, baixar, log, lerAjustes: ajustesDoHistorico(raiz) })
  return concluir({ raiz, cfg, insumos, log, agora, dataExecucao, forcarCompleta })
}

/** Calcula, confere, grava a auditoria (execução completa) e o arquivo do app. Separado para os testes alimentarem insumos prontos. */
export function concluir({ raiz, cfg, insumos, log = console.log, agora = new Date(), dataExecucao = null, forcarCompleta = false }) {
  const dia = dataExecucao ?? agora.toISOString().slice(0, 10)
  const { resultado, memoria } = calcularDividendos(insumos, cfg), { ultima, manifesto: manifestoAnterior } = lerAuditoriaCompleta(raiz, PASTA)
  const hashes = { config: sha256(canonico(cfg)), insumos: sha256(canonico(insumos)), resultado: hashDoResultado(resultado), memoria: sha256(canonico(memoria)) }
  const publicado = cfg.publicacao.aprovadoPeloResponsavel === true
  const decisao = decidirModo({ ultima, manifesto: manifestoAnterior, hoje: dia, hashConfig: hashes.config, calculoSha256: hashDoCodigo(raiz), forcarCompleta })
  const diaria = decisao.modo === 'diaria'
  log(`Auditoria: ${diaria ? 'diária (recalcula e confere, sem pasta nova)' : 'COMPLETA'} · ${decisao.motivo}`)

  const rel = (diaria ? ultima.pasta : path.join('auditoria', PASTA, dia)).replace(/\\/g, '/')
  const pasta = path.join(raiz, rel)
  let manifesto
  if (diaria) {
    const problemas = conferirEmMemoria({ calcular: (ins, c) => calcularDividendos(ins, c), canonico, sha256, hashDoResultado, insumos, cfg, hashes })
    if (problemas.length) throw new Error(`Conferência independente falhou: ${problemas.join('; ')}. Nada foi publicado.`)
    log('Conferência independente: OK (insumos e config relidos, cálculo refeito do zero, hash do resultado confere).')
    manifesto = { geradoEm: agora.toISOString(), hashes }
  } else {
    fs.mkdirSync(pasta, { recursive: true })
    gravarGz(path.join(pasta, 'insumos.json.gz'), insumos)
    gravarJson(path.join(pasta, 'config.json'), cfg)
    gravarJson(path.join(pasta, 'resultado.json'), resultado)
    gravarGz(path.join(pasta, 'memoria-de-calculo.json.gz'), memoria)
    fs.writeFileSync(path.join(pasta, 'ranking.csv'), csvRanking(resultado.ranking))
    fs.writeFileSync(path.join(pasta, 'proventos.csv'), csvProventos(resultado.ranking))
    fs.writeFileSync(path.join(pasta, 'exclusoes.csv'), csvExclusoes(resultado))
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.md'), leiaMe(rel, cfg.versaoMetodologia, insumos.dataPrecos))
    const arquivosHash = {}
    for (const a of ['insumos.json.gz', 'config.json', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'proventos.csv', 'exclusoes.csv']) arquivosHash[a] = hashArquivo(path.join(pasta, a))
    manifesto = {
      esquema: ESQUEMA,
      versaoMetodologia: cfg.versaoMetodologia,
      geradoEm: agora.toISOString(),
      dataExecucao: dia,
      dataPrecos: insumos.dataPrecos,
      ambiente: { node: process.version, plataforma: process.platform, commit: process.env.GITHUB_SHA ?? null, execucao: process.env.GITHUB_RUN_ID ?? null },
      codigo: { calculoSha256: hashDoCodigo(raiz) },
      hashes: { ...hashes, arquivos: arquivosHash },
      fontes: [{ papel: 'Proventos em dinheiro por ação', url: insumos.fonte, empresasComProventos: insumos.empresas.filter((e) => e.eventos?.length).length }, { papel: 'Preço de fechamento (Boletim BVBG.086 da B3)', url: 'historico/acoes.json (neste repositório)', ultimoPregao: insumos.dataPrecos }],
      contagens: { universo: resultado.universo, avaliadas: resultado.avaliadas, noRanking: resultado.ranking.length, exclusoes: resultado.exclusoes.length, etapas: resultado.etapas },
      publicadoNoApp: publicado,
    }
    gravarJson(path.join(pasta, 'manifesto.json'), manifesto)
    gravarJson(path.join(raiz, 'auditoria', PASTA, 'ultima.json'), { pasta: rel, dataExecucao: dia, dataPrecos: insumos.dataPrecos, hashResultado: hashes.resultado, versaoMetodologia: cfg.versaoMetodologia })
  }

  const topo = resultado.ranking.slice(0, cfg.tamanhoDaLista).map((r) => `${r.ticker} ${(r.dy * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`).join(' · ')
  log(`Universo ${resultado.universo} → ${resultado.avaliadas} com proventos, ${resultado.exclusoes.length} fora. Top ${cfg.tamanhoDaLista}: ${topo}`)

  if (publicado) {
    const problemas = verificarSanidade(resultado, cfg)
    if (problemas.length) throw new Error(`Publicação barrada pela trava de sanidade: ${problemas.join('; ')}. ${diaria ? 'Nenhuma pasta foi gravada' : `A auditoria desta execução foi gravada em ${rel} para diagnóstico`}; o app não foi alterado.`)
  }

  const snapshot = montarSnapshotApp({ resultado, cfg, manifesto, pasta: rel, publicado, dataExecucao: dia, modo: diaria ? 'diaria' : 'completa' })
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  gravarJson(path.join(raiz, ARQUIVO_APP), snapshot)
  log(publicado ? 'App: lista PUBLICADA (acesso aberto).' : `App: lista NÃO publicada (aprovadoPeloResponsavel = false).${diaria ? '' : ' A auditoria completa foi gravada.'}`)
  return { resultado, hashes, pasta, publicado, modo: diaria ? 'diaria' : 'completa' }
}

/** O que o app lê. Sem aprovação do responsável, vai só o cabeçalho (o app mostra "em validação"). */
export function montarSnapshotApp({ resultado, cfg, manifesto, pasta, publicado, dataExecucao, modo }) {
  return {
    publicado,
    versaoMetodologia: cfg.versaoMetodologia,
    geradoEm: manifesto.geradoEm,
    dataExecucao,
    dataPrecos: resultado.janela.fim,
    pastaAuditoria: pasta,
    hashResultado: manifesto.hashes.resultado,
    hashInsumos: manifesto.hashes.insumos,
    hashConfig: manifesto.hashes.config,
    modoAuditoria: modo,
    auditoriaCompletaEm: path.posix.basename(pasta),
    tamanhoDaLista: cfg.tamanhoDaLista,
    rankingAteOnde: cfg.rankingAteOnde,
    universo: resultado.universo,
    avaliadas: resultado.avaliadas,
    aviso: cfg.publicacao.aviso ?? cfg.publicacao.avisoProposto ?? null,
    parametros: { janelaDias: cfg.janelaDias, janelaInicio: resultado.janela.inicio, liquidezMinimaDiariaReais: cfg.liquidezMinimaDiariaReais, sessoesLiquidez: cfg.sessoesLiquidez, alertaDyAcimaDe: cfg.alertaDyAcimaDe },
    contagens: { ranking: resultado.ranking.length, exclusoes: resultado.exclusoes.length },
    dyPorTicker: publicado ? (resultado.dyPorTicker ?? {}) : {},
    etapas: publicado ? resultado.etapas : [],
    ranking: publicado ? resultado.ranking : [],
    exclusoes: publicado ? resultado.exclusoes : [],
  }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    if (process.argv.some((x) => x.startsWith('--verificar'))) process.exit(executarCli('ultima'))
    await executar({ hoje: process.argv.find((x) => x.startsWith('--data='))?.slice(7) ?? null, forcarCompleta: process.argv.includes('--completa') })
    process.exit(executarCli('ultima'))
  } catch (e) {
    console.error(`ERRO: ${e.message}`)
    process.exit(1)
  }
}
