// Atualização diária dos dados da aba de BDRs (decisão D19).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-bdrs.yml), depois do
// fechamento da B3, ou manualmente com:  BRAPI_TOKEN=... node scripts/atualizar-bdrs.mjs
//
// O que faz:
//   1. Uma chamada à listagem da brapi traz todos os BDRs (fechamento, volume do dia, setor).
//   2. Separa BDRs de ações (códigos 31 a 35) e BDRs de ETF (39), tira os da lista de
//      exclusão e escolhe os candidatos pelo volume financeiro do dia (papéis × fechamento:
//      o campo volume da brapi é quantidade de papéis, não reais).
//   3. Para cada candidato, uma chamada com histórico de 3 meses: volume financeiro médio dos
//      21 últimos pregões COMPLETOS (o pregão em andamento é descartado), variação no período,
//      nome da empresa e proporção BDR/ação.
//   4. Publica os 35 BDRs de ações e os 5 de ETF com maior volume médio, acima do piso de cada
//      grupo, em webapp-src/src/data/bdrs.json, junto com a lista de busca: todos os demais
//      BDRs com o dado resumido da própria listagem (fechamento, setor, volume do dia).
//
// Regras de segurança: listagem pequena demais, BDRs de controle sem dado ou lista final
// abaixo do mínimo = o script termina com erro SEM gravar o arquivo. O app continua com os
// dados do último dia bom, e o GitHub avisa da falha.
//
// Telas estritamente descritivas (D19): o arquivo não traz múltiplos de avaliação (P/L, LPA)
// nem nada que ordene por "melhor"; a ordem é sempre por volume.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { formatarSnapshot, volumeMedioDiario } from './atualizar-rendimentos-fii.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'bdrs.json')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'bdrs.json')
// limit=1000 cobre todos os BDRs listados (879 em 25/09/2026) numa única requisição.
const URL_LISTA = 'https://brapi.dev/api/quote/list?type=bdr&limit=1000&sortBy=volume&sortOrder=desc'
const URL_COTACAO = (ticker) => `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=3mo&interval=1d`
// Mesma régua dos FIIs (D13): média de cerca de um mês de pregões.
const SESSOES_LIQUIDEZ = 21
// Fuso da B3, sem horário de verão desde 2019.
const OFFSET_BRASILIA_MS = -3 * 3_600_000

// Faixas plausíveis. Fora delas, o dado provavelmente está errado e o BDR não é publicado.
const PRECO_MIN = 0.1
const PRECO_MAX = 10_000
const VARIACAO_MIN_PCT = -90
const VARIACAO_MAX_PCT = 500

// ---------------------------------------------------------------------------------------
// Funções puras (exportadas para os testes em atualizar-bdrs.test.mjs)
// ---------------------------------------------------------------------------------------

/** 'acao' para códigos terminados em 31 a 35, 'etf' para 39, null para o resto. */
export function tipoPorCodigo(ticker) {
  const codigo = String(ticker ?? '').toUpperCase()
  if (/^[A-Z0-9]{4}3[1-5]$/.test(codigo)) return 'acao'
  if (/^[A-Z0-9]{4}39$/.test(codigo)) return 'etf'
  return null
}

/** Códigos 31, 32 e 33 costumam ser de empresas com vínculo brasileiro: pedem decisão manual. */
export function precisaRevisar(ticker, excluir = [], revisados = []) {
  return /3[123]$/.test(ticker) && !excluir.includes(ticker) && !revisados.includes(ticker)
}

/** Volume financeiro do dia na listagem: o campo volume é quantidade de papéis. */
export function volumeFinanceiroDoDia(item) {
  const papeis = Number(item?.volume)
  const preco = Number(item?.close)
  return papeis > 0 && preco > 0 ? papeis * preco : 0
}

/**
 * Separa a listagem em candidatos a ações e a ETFs, pelo volume financeiro do dia.
 * `obrigatorios` (controle e lista publicada no dia anterior) entram sempre, para a lista
 * não oscilar só porque um BDR teve um dia fraco.
 */
export function escolherCandidatos(lista, config, obrigatorios = []) {
  const excluir = config.excluir?.tickers ?? []
  const revisados = config.revisados?.tickers ?? []
  const porTipo = { acao: [], etf: [] }
  const revisar = []
  let ignorados = 0
  for (const item of lista) {
    const ticker = String(item?.stock ?? '').toUpperCase()
    const tipo = tipoPorCodigo(ticker)
    if (!tipo) {
      ignorados++
      continue
    }
    if (excluir.includes(ticker)) continue
    if (precisaRevisar(ticker, excluir, revisados)) revisar.push(ticker)
    porTipo[tipo].push({ ticker, volumeDia: volumeFinanceiroDoDia(item), item })
  }
  const topo = (itens, n) => itens.sort((a, b) => b.volumeDia - a.volumeDia).slice(0, n).map((x) => x.ticker)
  const acoes = new Set(topo(porTipo.acao, config.candidatosAcoes ?? 100))
  const etfs = new Set(topo(porTipo.etf, config.candidatosEtfs ?? 30))
  for (const ticker of obrigatorios) {
    if (excluir.includes(ticker)) continue
    const tipo = tipoPorCodigo(ticker)
    if (tipo === 'acao') acoes.add(ticker)
    if (tipo === 'etf') etfs.add(ticker)
  }
  const itemPorTicker = new Map([...porTipo.acao, ...porTipo.etf].map((x) => [x.ticker, x.item]))
  return { acoes: [...acoes], etfs: [...etfs], revisar, ignorados, itemPorTicker }
}

/** Data (AAAA-MM-DD) em Brasília de um instante. */
export function dataEmBrasilia(instante) {
  return new Date(instante.getTime() + OFFSET_BRASILIA_MS).toISOString().slice(0, 10)
}

/** Data (AAAA-MM-DD) de um ponto do histórico da brapi (segundos Unix, meia-noite de Brasília). */
export function dataDoPonto(ponto) {
  return dataEmBrasilia(new Date(Number(ponto.date) * 1000))
}

/**
 * Pregões completos: descarta o do dia se o script rodar antes do horário de corte (ex.:
 * execução manual com a bolsa aberta). Em 25/09/2026, com o pregão aberto, o AAPL34 aparecia
 * com 42.540 papéis no dia, contra 200 a 500 mil num dia normal.
 */
export function pregoesCompletos(historico, agora = new Date(), horarioCorte = '18:30') {
  if (!Array.isArray(historico)) return []
  const pontos = historico
    .filter((p) => p && typeof p.close === 'number' && p.close > 0 && Number.isFinite(Number(p.date)))
    .sort((a, b) => a.date - b.date)
  const [hora, minuto] = horarioCorte.split(':').map(Number)
  const local = new Date(agora.getTime() + OFFSET_BRASILIA_MS)
  const antesDoCorte = local.getUTCHours() * 60 + local.getUTCMinutes() < hora * 60 + minuto
  const hoje = dataEmBrasilia(agora)
  return antesDoCorte ? pontos.filter((p) => dataDoPonto(p) !== hoje) : pontos
}

/** Variação (%) entre o primeiro e o último fechamento do período. */
export function variacaoPeriodo(pregoes) {
  if (!Array.isArray(pregoes) || pregoes.length < 2) return null
  const inicio = pregoes[0].close
  const fim = pregoes[pregoes.length - 1].close
  if (!(inicio > 0) || !(fim > 0)) return null
  return Math.round(((fim / inicio - 1) * 100) * 10) / 10
}

/**
 * Proporção BDR/ação a partir do nome longo da brapi. "… Repr 0.05 Sh" = cada BDR
 * representa 0,05 ação, ou seja, 20 BDRs = 1 ação. Devolve ações por BDR, ou null.
 */
export function extrairProporcao(nomeLongo) {
  const achado = /repr\.?\s*([\d.,]+)\s*sh/i.exec(String(nomeLongo ?? ''))
  if (!achado) return null
  const valor = Number(achado[1].replace(',', '.'))
  return valor > 0 && Number.isFinite(valor) ? valor : null
}

/** Nome da empresa sem o texto técnico do recibo ("Shs Unsponsored Brazilian Depository…"). */
export function extrairNome(nomeLongo, ticker, nomesManuais = {}) {
  if (nomesManuais[ticker]) return nomesManuais[ticker]
  const bruto = String(nomeLongo ?? '').trim()
  if (!bruto || bruto.toUpperCase() === ticker) return ticker
  const limpo = bruto
    .split(/\s+(?:shs?\b|unsponsored\b|sponsored\b|brazilian\s+depositar|brazilian\s+depositor|bdr\b|drn\b|repr\b)/i)[0]
    .replace(/[\s,.;-]+$/, (fim) => (fim.trim() === '.' ? '.' : ''))
    .trim()
  return limpo || ticker
}

/** Setor exibido e se faltou tradução (para o log). */
export function setorDe(ticker, tipo, setorBrapi, config) {
  if (tipo === 'etf') {
    const grupo = config.gruposEtf?.[ticker]
    return grupo ? { setor: grupo, semMapa: false } : { setor: 'Outros', semMapa: true }
  }
  const manual = config.setorPorTicker?.[ticker]
  if (manual) return { setor: manual, semMapa: false }
  const traduzido = config.setores?.[setorBrapi]
  if (traduzido) return { setor: traduzido, semMapa: false }
  return { setor: setorBrapi || 'Outros', semMapa: true }
}

/** Motivo para não publicar um BDR, ou null se o dado for plausível. */
export function motivoInvalido(item) {
  if (!(item.cotacao >= PRECO_MIN && item.cotacao <= PRECO_MAX)) return `cotação fora da faixa plausível (${item.cotacao})`
  if (!(item.volumeMedio > 0)) return 'sem histórico de volume'
  if (item.variacao3m !== null && (item.variacao3m < VARIACAO_MIN_PCT || item.variacao3m > VARIACAO_MAX_PCT)) {
    return `variação de 3 meses fora da faixa plausível (${item.variacao3m}%)`
  }
  return null
}

/**
 * Lista de busca: todos os BDRs da listagem (menos os excluídos), com o dado que a própria
 * listagem traz, sem requisição extra. Não tem média de 21 pregões nem variação de 3 meses:
 * o volume é só o do último pregão. O nome vem dos BDRs publicados (nome longo limpo) ou da
 * listagem, quando ela traz um nome diferente do código; senão fica null e a busca é só pelo
 * código.
 */
export function montarBusca(lista, config, publicados = []) {
  const excluir = config.excluir?.tickers ?? []
  const nomePublicado = new Map(publicados.map((i) => [i.ticker, i.nome]))
  const busca = []
  for (const item of lista) {
    const ticker = String(item?.stock ?? '').toUpperCase()
    const tipo = tipoPorCodigo(ticker)
    const cotacao = Number(item?.close)
    if (!tipo || excluir.includes(ticker) || !(cotacao >= PRECO_MIN && cotacao <= PRECO_MAX)) continue
    const nomeLista = String(item?.name ?? '').trim()
    const nome = config.nomes?.[ticker] ?? nomePublicado.get(ticker) ?? (nomeLista && nomeLista.toUpperCase() !== ticker ? nomeLista : null)
    busca.push({
      ticker,
      tipo,
      nome,
      setor: setorDe(ticker, tipo, item?.sector ?? null, config).setor,
      cotacao: Math.round(cotacao * 100) / 100,
      volumeDia: Math.round(volumeFinanceiroDoDia(item)),
    })
  }
  return busca.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** Os `maximo` com maior volume médio, acima do piso, em ordem de volume. */
export function selecionar(itens, maximo, piso) {
  return itens
    .filter((i) => i.volumeMedio >= piso)
    .sort((a, b) => b.volumeMedio - a.volumeMedio || a.ticker.localeCompare(b.ticker))
    .slice(0, maximo)
}

/** Monta o item publicado a partir da resposta individual da brapi. */
export function montarItem(ticker, tipo, resultado, itemLista, config, agora = new Date()) {
  const pregoes = pregoesCompletos(resultado?.historicalDataPrice, agora, config.horarioCorteFechamento)
  const ultimo = pregoes[pregoes.length - 1]
  const { setor, semMapa } = setorDe(ticker, tipo, itemLista?.sector ?? null, config)
  const preco = ultimo?.close ?? resultado?.regularMarketPrice
  return {
    item: {
      ticker,
      nome: extrairNome(resultado?.longName || itemLista?.name, ticker, config.nomes),
      setor,
      cotacao: typeof preco === 'number' ? Math.round(preco * 100) / 100 : null,
      dataCotacao: ultimo ? dataDoPonto(ultimo) : null,
      variacao3m: variacaoPeriodo(pregoes),
      volumeMedio: Math.round(volumeMedioDiario(pregoes, SESSOES_LIQUIDEZ) ?? 0),
      minima52: typeof resultado?.fiftyTwoWeekLow === 'number' ? resultado.fiftyTwoWeekLow : null,
      maxima52: typeof resultado?.fiftyTwoWeekHigh === 'number' ? resultado.fiftyTwoWeekHigh : null,
      acoesPorBdr: extrairProporcao(resultado?.longName),
    },
    semMapa,
  }
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

class ErroBrapi extends Error {
  constructor(mensagem, status) {
    super(mensagem)
    this.status = status
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function chamarBrapi(url, token) {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resposta.ok) throw new ErroBrapi(`brapi respondeu ${resposta.status} (${url.split('?')[0]}).`, resposta.status)
  return resposta.json()
}

function lerPublicacaoAnterior() {
  try {
    const anterior = JSON.parse(fs.readFileSync(ARQUIVO_SAIDA, 'utf8'))
    return [...(anterior.acoes ?? []), ...(anterior.etfs ?? [])].map((i) => i.ticker)
  } catch {
    return []
  }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG, 'utf8'))
  if (config.conferidoPeloResponsavel !== true) {
    throw new Error('config/bdrs.json ainda não foi conferido. Revise as listas de exclusão e marque "conferidoPeloResponsavel": true.')
  }
  const token = process.env.BRAPI_TOKEN
  if (!token) throw new Error('Variável BRAPI_TOKEN não definida (GitHub: Settings > Secrets and variables > Actions).')
  const agora = new Date()

  // 1. Listagem (1 requisição)
  const listagem = await chamarBrapi(URL_LISTA, token)
  const lista = (listagem?.stocks ?? []).filter((s) => s?.type === 'bdr')
  if (lista.length < config.minimoBdrsNaLista) {
    throw new Error(`A listagem da brapi trouxe só ${lista.length} BDRs (mínimo ${config.minimoBdrsNaLista}). Arquivo NÃO atualizado.`)
  }

  const controle = config.controle?.tickers ?? []
  const obrigatorios = [...new Set([...controle, ...lerPublicacaoAnterior()])]
  const candidatos = escolherCandidatos(lista, config, obrigatorios)
  for (const ticker of candidatos.revisar) {
    console.log(`[revisar] ${ticker}: código de BDR patrocinado (31 a 33). Se for empresa de origem ou operação brasileira, inclua em "excluir"; se não, em "revisados" (config/bdrs.json).`)
  }
  console.log(`[info] Listagem: ${lista.length} BDRs, ${candidatos.acoes.length} candidatos de ações e ${candidatos.etfs.length} de ETF (${candidatos.ignorados} códigos fora de 31-35 e 39 ignorados).`)

  // 2. Consulta individual dos candidatos (1 requisição cada)
  const fila = [...candidatos.acoes.map((t) => [t, 'acao']), ...candidatos.etfs.map((t) => [t, 'etf'])]
  const itens = { acao: [], etf: [] }
  const semMapa = { acao: new Set(), etf: new Set() }
  const indisponiveis = []
  let requisicoes = 1
  let limiteAtingido = false
  for (const [ticker, tipo] of fila) {
    if (requisicoes >= config.maxRequisicoesBrapi) {
      limiteAtingido = true
      break
    }
    let resultado
    try {
      requisicoes++
      resultado = (await chamarBrapi(URL_COTACAO(ticker), token))?.results?.[0]
    } catch (erro) {
      if (erro instanceof ErroBrapi && erro.status === 429) {
        console.warn(`[aviso] brapi pediu para desacelerar (429) em ${ticker}; nova tentativa em ${Math.round(config.pausaAposLimiteMs / 1000)} s.`)
        await esperar(config.pausaAposLimiteMs)
        try {
          requisicoes++
          resultado = (await chamarBrapi(URL_COTACAO(ticker), token))?.results?.[0]
        } catch (segundo) {
          indisponiveis.push(`${ticker}: ${segundo.message}`)
          continue
        }
      } else if (erro instanceof ErroBrapi && (erro.status === 401 || erro.status === 403)) {
        throw new Error(`brapi respondeu ${erro.status}: chave inválida ou plano sem acesso. Arquivo NÃO atualizado.`)
      } else {
        indisponiveis.push(`${ticker}: ${erro.message}`)
        continue
      }
    } finally {
      await esperar(config.pausaEntreRequisicoesMs)
    }
    const { item, semMapa: faltouSetor } = montarItem(ticker, tipo, resultado, candidatos.itemPorTicker.get(ticker), config, agora)
    const motivo = motivoInvalido(item)
    if (motivo) {
      indisponiveis.push(`${ticker}: ${motivo}`)
      continue
    }
    if (faltouSetor) semMapa[tipo].add(`${ticker} (${candidatos.itemPorTicker.get(ticker)?.sector ?? 'sem setor'})`)
    itens[tipo].push(item)
  }
  console.log(`[info] brapi: ${requisicoes} requisições${limiteAtingido ? ' (limite maxRequisicoesBrapi atingido)' : ''}, ${indisponiveis.length} BDRs sem dado válido.`)
  for (const linha of indisponiveis) console.log(`[info] ${linha}`)

  // 3. Travas
  const validos = new Set([...itens.acao, ...itens.etf].map((i) => i.ticker))
  const controleOk = controle.filter((t) => validos.has(t))
  const minimoControle = config.controle?.minimo ?? controle.length
  if (controleOk.length < minimoControle) {
    throw new Error(`Só ${controleOk.length} de ${controle.length} BDRs de controle ficaram válidos (mínimo ${minimoControle}). Arquivo NÃO atualizado.`)
  }
  const acoes = selecionar(itens.acao, config.maxAcoes, config.pisoVolumeAcoes)
  const etfs = selecionar(itens.etf, config.maxEtfs, config.pisoVolumeEtfs)
  if (acoes.length < config.minimoAcoesParaPublicar) {
    throw new Error(`Só ${acoes.length} BDRs de ações passaram no piso de liquidez (mínimo ${config.minimoAcoesParaPublicar}). Arquivo NÃO atualizado.`)
  }
  if (etfs.length < config.minimoEtfsParaPublicar) {
    throw new Error(`Só ${etfs.length} BDRs de ETF passaram no piso de liquidez (mínimo ${config.minimoEtfsParaPublicar}). Arquivo NÃO atualizado.`)
  }

  // 4. Logs de conferência
  const publicados = new Set([...acoes, ...etfs].map((i) => i.ticker))
  for (const t of semMapa.acao) if (publicados.has(t.split(' ')[0])) console.log(`[setor] ${t}: setor sem tradução em "setores" (config/bdrs.json).`)
  for (const t of semMapa.etf) if (publicados.has(t.split(' ')[0])) console.log(`[categoria] ${t.split(' ')[0]}: BDR de ETF sem grupo em "gruposEtf" (config/bdrs.json); aparece em "Outros".`)
  const porSetor = {}
  for (const i of acoes) porSetor[i.setor] = (porSetor[i.setor] ?? 0) + 1
  console.log(`[info] Setores: ${Object.entries(porSetor).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ')}.`)
  const reais = (v) => `R$ ${(v / 1e6).toFixed(1)} mi/dia`
  console.log(`[info] Mais negociados: ${acoes.slice(0, 3).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}. Menos negociados da lista: ${acoes.slice(-2).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}.`)
  console.log(`[info] ETFs: ${etfs.map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}.`)

  const datas = [...acoes, ...etfs].map((i) => i.dataCotacao).filter(Boolean).sort()
  // Trava de dado velho: feriados emendados cabem em 7 dias; mais que isso é histórico parado.
  const diasDesdePregao = datas.length ? (agora.getTime() - Date.parse(`${datas[datas.length - 1]}T21:00:00Z`)) / 86_400_000 : Infinity
  if (diasDesdePregao > 7) {
    throw new Error(`O pregão mais recente no histórico é de ${datas[datas.length - 1] ?? 'data nenhuma'}, mais de 7 dias atrás. Arquivo NÃO atualizado.`)
  }
  const snapshot = {
    geradoEm: agora.toISOString(),
    dataPregao: datas[datas.length - 1] ?? null,
    sessoesLiquidez: SESSOES_LIQUIDEZ,
    criterio: { maxAcoes: config.maxAcoes, maxEtfs: config.maxEtfs, pisoVolumeAcoes: config.pisoVolumeAcoes, pisoVolumeEtfs: config.pisoVolumeEtfs },
    acoes,
    etfs,
    busca: montarBusca(lista, config, [...acoes, ...etfs]),
  }
  // Feriado da B3 ou execução repetida no mesmo dia: dados iguais, só o horário mudaria.
  // Não regrava, para não gerar commit e deploy sem novidade.
  try {
    const anterior = JSON.parse(fs.readFileSync(ARQUIVO_SAIDA, 'utf8'))
    const semHorario = (s) => JSON.stringify({ ...s, geradoEm: null })
    if (semHorario(anterior) === semHorario(snapshot)) {
      console.log(`Sem pregão novo desde ${snapshot.dataPregao}: arquivo mantido.`)
      return
    }
  } catch {
    // arquivo ausente ou ilegível: grava normalmente
  }
  fs.writeFileSync(ARQUIVO_SAIDA, formatarSnapshot(snapshot))
  console.log(`bdrs.json atualizado: ${acoes.length} BDRs de ações e ${etfs.length} de ETF na lista, ${snapshot.busca.length} na busca, pregão de ${snapshot.dataPregao}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
