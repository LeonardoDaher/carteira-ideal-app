// Histórico de preço DIÁRIO dos FIIs (decisão D63).
//
//   node scripts/atualizar-fiis-historico.mjs                      baixa o boletim da B3 dos pregões que faltam
//   node scripts/atualizar-fiis-historico.mjs --carga-inicial=60   carga inicial: os 60 pregões mais recentes
//
// Fonte: Boletim de Preços oficial da B3 (BVBG.086), sem chave e sem cota (o mesmo módulo b3-boletim.mjs
// dos jobs de ações, BDRs e ETFs). O universo é a lista de fundos de webapp-src/src/data/rendimentosFii.json.
// Grava historico/fiis.json e webapp-src/src/data/fiisPreco.json (cotação e variação do dia para o app): cada fundo tem um valor por pregão, alinhado com "pregoes":
// [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Não altera nada do app.
//
// Se algo estiver errado (boletim com data inesperada, poucos fundos no boletim, B3 fora do ar), o job falha SEM
// alterar o arquivo. Feriado da B3 (zip vazio) ou pregão já processado: nada muda.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, dataEmBrasilia, datasCandidatas, lerBoletim } from './b3-boletim.mjs'
import { datasAProcessar, historicoVazio, incorporarPregao } from './atualizar-etfs.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'fiis-preco.json')
const ARQUIVO_FIIS = path.join(RAIZ, 'webapp-src', 'src', 'data', 'rendimentosFii.json')
const ARQUIVO_HISTORICO = path.join(RAIZ, 'historico', 'fiis.json')

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em atualizar-fiis-historico.test.mjs)
// ---------------------------------------------------------------------------------------

/** Universo: ticker → nome, dos fundos do job de FIIs mais os extras da config. */
export function universoDosFiis(snapshot, extras = []) {
  const universo = new Map()
  for (const f of snapshot?.fundos ?? []) if (f?.ticker) universo.set(String(f.ticker).toUpperCase(), f.nome ?? '')
  for (const t of extras) universo.set(String(t).toUpperCase(), universo.get(String(t).toUpperCase()) ?? '')
  return universo
}

/** Histórico em texto: um fundo por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico, complementados = historico.complementadosPelaBrapi ?? []) {
  const linhas = Object.keys(historico.ativos)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.ativos[t])}`)
  const nomes = Object.keys(historico.nomes)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.nomes[t])}`)
  return [
    '{',
    '  "_leia": "Histórico de preço diário dos FIIs (decisão D63), gerado por scripts/atualizar-fiis-historico.mjs a partir do Boletim de Preços da B3. Cada fundo tem um valor por pregão, alinhado com \\"pregoes\\": [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Os fundos de \\"complementadosPelaBrapi\\" não vêm no boletim da B3 e têm os dias completados pelas barras diárias da brapi. Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "complementadosPelaBrapi": ${JSON.stringify([...new Set(complementados)].sort())},`,
    `  "nomes": {\n${nomes.join(',\n')}\n  },`,
    `  "ativos": {\n${linhas.join(',\n')}\n  }`,
    '}',
    '',
  ].join('\n')
}

/**
 * Últimos `n` pregões do histórico para um fundo: { datas, serie }, com `serie[i]` = [fechamento, volume em reais]
 * ou null (não negociou) alinhada com `datas`. Fundo fora do histórico: serie null.
 */
export function ultimosPregoes(historico, ticker, n) {
  const pregoes = historico?.pregoes ?? []
  const total = pregoes.length
  const datas = pregoes.slice(Math.max(0, total - n))
  const serieCompleta = historico?.ativos?.[ticker]
  if (!serieCompleta) return { datas, serie: null }
  const serie = serieCompleta.slice(Math.max(0, serieCompleta.length - datas.length)).map((v) => (v && v[0] > 0 ? [v[0], v[3] ?? 0] : null))
  return { datas, serie }
}

// ---------------------------------------------------------------------------------------
// Preço do dia para o app (Simule FII)
// ---------------------------------------------------------------------------------------

/**
 * Último fechamento de cada fundo e a variação do último pregão contra o anterior, para o app mostrar a cotação
 * do dia (e não a mensal do job de rendimentos). A variação só existe se o fundo negociou nos DOIS últimos
 * pregões do histórico e sem salto de desdobramento entre eles.
 * Formato: { dataPregao, fundos: { TICKER: [cotacao, variacaoDia | null, dataDaCotacao] } }.
 */
export function precosDoDia(historico) {
  const pregoes = historico?.pregoes ?? []
  const fundos = {}
  for (const [ticker, serie] of Object.entries(historico?.ativos ?? {})) {
    let ultimo = -1
    for (let i = serie.length - 1; i >= 0; i--) {
      if (serie[i] && serie[i][0] > 0) {
        ultimo = i
        break
      }
    }
    if (ultimo === -1) continue
    const data = pregoes[pregoes.length - serie.length + ultimo]
    if (!data) continue
    const anterior = ultimo === serie.length - 1 ? serie[ultimo - 1] : null
    const razao = anterior && anterior[0] > 0 ? serie[ultimo][0] / anterior[0] : null
    const variacao = razao !== null && razao > 0.55 && razao < 1.8 ? Math.round((razao - 1) * 10_000) / 100 : null
    fundos[ticker] = [Math.round(serie[ultimo][0] * 100) / 100, variacao, data]
  }
  return { dataPregao: pregoes.at(-1) ?? null, fundos }
}

/** Arquivo do app: um fundo por linha, para o diff ficar legível no GitHub. */
export function formatarPrecos(precos, geradoEm) {
  const linhas = Object.entries(precos.fundos).map(([t, v]) => `    ${JSON.stringify(t)}: ${JSON.stringify(v)}`)
  const cabecalho = ['{', `  "geradoEm": ${JSON.stringify(geradoEm)},`, `  "dataPregao": ${JSON.stringify(precos.dataPregao)},`, '  "fundos": {']
  return [...cabecalho, linhas.join(',\n'), '  }', '}', ''].join('\n')
}

// ---------------------------------------------------------------------------------------
// Complemento pela brapi, SÓ para fundos líquidos que a B3 não traz no boletim
// ---------------------------------------------------------------------------------------
// O Boletim de Preços da B3 (BVBG.086) não tem alguns fundos que negociam normalmente (em 06/10/2026: CVBI11,
// MALL11 e BBPO11, com R$ 0,8 a 2,7 mi por dia na brapi). Para esses, e só para esses, o histórico é completado
// com as barras diárias da brapi (poucas requisições por dia). Nunca sobrescreve um dia que o boletim trouxe.

/** Fundos para completar: líquidos na brapi (mediana mensal) e sem negócio no boletim na janela recente. */
export function candidatosReserva(historico, snapshot, { volumeMinimo = 300_000, janela = 21 } = {}) {
  const lista = []
  for (const f of snapshot?.fundos ?? []) {
    const t = String(f.ticker ?? '').toUpperCase()
    if (!t || !((f.volumeMediano ?? f.volumeMedio ?? 0) >= volumeMinimo)) continue
    const serie = historico?.ativos?.[t]
    const recente = serie ? serie.slice(Math.max(0, serie.length - janela)) : []
    if (!recente.some(Boolean)) lista.push(t)
  }
  return lista
}

/** Barras diárias da resposta da brapi: [{ data, fechamento, minima, maxima, volume (R$) }], só as com preço e volume. */
export function barrasDaBrapi(corpo) {
  const bruto = corpo?.results?.[0]?.historicalDataPrice
  if (!Array.isArray(bruto)) return []
  const saida = []
  for (const b of bruto) {
    if (!b || typeof b.close !== 'number' || !(b.close > 0) || typeof b.date !== 'number') continue
    const volume = Number(b.volume) > 0 ? Number(b.volume) * b.close : 0
    saida.push({ data: dataEmBrasilia(new Date(b.date * 1000)), fechamento: b.close, minima: typeof b.low === 'number' && b.low > 0 ? b.low : b.close, maxima: typeof b.high === 'number' && b.high > 0 ? b.high : b.close, volume })
  }
  return saida
}

/** Preenche os dias SEM dado do fundo no histórico com as barras da brapi. Devolve { historico, preenchidos }. */
export function preencherComBarras(historico, ticker, barras) {
  const indice = new Map(historico.pregoes.map((d, i) => [d, i]))
  const serie = historico.ativos[ticker] ? [...historico.ativos[ticker]] : historico.pregoes.map(() => null)
  let preenchidos = 0
  for (const b of barras) {
    const i = indice.get(b.data)
    if (i === undefined || serie[i]) continue // dia que não é pregão do histórico, ou que o boletim já trouxe
    if (!(b.volume > 0)) continue // sem negócio: continua null, como no boletim
    serie[i] = [b.fechamento, b.minima, b.maxima, Math.round(b.volume * 100) / 100]
    preenchidos++
  }
  if (!preenchidos) return { historico, preenchidos: 0 }
  return { historico: { ...historico, ativos: { ...historico.ativos, [ticker]: serie } }, preenchidos }
}

/** Busca as barras na brapi e completa o histórico dos candidatos. Falha de rede nunca derruba o job. */
export async function complementarComBrapi({ historico, candidatos, token, janela = '3mo', maxRequisicoes = 20, pausaMs = 300, fetchImpl = fetch, log = console.log }) {
  let atual = historico
  const completados = []
  if (!candidatos.length) return { historico: atual, completados, requisicoes: 0 }
  if (!token) {
    log(`[aviso] BRAPI_TOKEN não definido: ${candidatos.length} fundo(s) líquido(s) fora do boletim ficam sem preço diário (${candidatos.join(', ')}).`)
    return { historico: atual, completados, requisicoes: 0 }
  }
  let requisicoes = 0
  for (const ticker of candidatos.slice(0, maxRequisicoes)) {
    try {
      const resposta = await fetchImpl(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=${janela}&interval=1d`, { headers: { Authorization: `Bearer ${token}` } })
      requisicoes++
      if (resposta.status === 429) { log('[aviso] brapi atingiu o limite de requisições: o complemento para aqui.'); break }
      if (!resposta.ok) { log(`[aviso] brapi respondeu ${resposta.status} para ${ticker}: sem complemento.`); continue }
      const r = preencherComBarras(atual, ticker, barrasDaBrapi(await resposta.json()))
      atual = r.historico
      if (r.preenchidos > 0) { completados.push(ticker); log(`[info] ${ticker}: ${r.preenchidos} pregões completados pela brapi (fora do boletim da B3).`) }
      else log(`[aviso] ${ticker}: a brapi não trouxe nenhum pregão com negócio na janela.`)
    } catch (erro) {
      log(`[aviso] brapi indisponível para ${ticker} (${erro.message}): sem complemento.`)
    }
    if (pausaMs > 0) await new Promise((r) => setTimeout(r, pausaMs))
  }
  if (candidatos.length > maxRequisicoes) log(`[aviso] ${candidatos.length - maxRequisicoes} candidato(s) além do limite de ${maxRequisicoes} requisições por execução.`)
  return { historico: atual, completados, requisicoes }
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

function argumentoCarga(argv, maximo) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? maximo)
  return Number.isInteger(n) && n > 0 ? Math.min(n, maximo) : maximo
}

export async function main({ argv = process.argv, agora = new Date(), raiz = RAIZ, fetchImpl = fetch } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'fiis-preco.json'), 'utf8'))
  const arquivoHistorico = path.join(raiz, 'historico', 'fiis.json')
  const arquivoPrecos = path.join(raiz, 'webapp-src', 'src', 'data', 'fiisPreco.json')
  const snapshot = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'rendimentosFii.json'), 'utf8'))
  const universo = universoDosFiis(snapshot, config.tickersExtras)
  if (universo.size < config.minimoFiisNoBoletim) throw new Error(`O universo tem só ${universo.size} FIIs (mínimo ${config.minimoFiisNoBoletim}): rode antes o job de FIIs. Arquivo NÃO atualizado.`)

  const carga = argumentoCarga(argv, config.maxPregoesGuardados)
  let historico = lerJson(arquivoHistorico, historicoVazio())
  const complementados = new Set(historico.complementadosPelaBrapi ?? []) // incorporarPregao devolve só pregoes/nomes/ativos
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiis-b3-'))
  let novos = 0
  let semPregao = 0
  try {
    for (const data of faltam) {
      if (carga > 0 && historico.pregoes.length >= carga) break
      let xml
      try {
        xml = await baixarBoletim(data, pastaTemp)
      } catch (erro) {
        if (carga > 0) {
          console.warn(`[aviso] ${data}: ${erro.message} (carga inicial segue).`)
          continue
        }
        throw new Error(`${erro.message} Arquivo NÃO atualizado.`)
      }
      if (!xml) {
        semPregao++
        console.log(`[info] ${data}: sem pregão na B3 (zip vazio).`)
        continue
      }
      const lido = await lerBoletim(xml, (t) => universo.has(t))
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      if (lido.datas.length !== 1 || lido.datas[0] !== data) {
        const msg = `${data}: o boletim trouxe a(s) data(s) ${lido.datas.join(', ') || 'nenhuma'}.`
        if (carga > 0) {
          console.warn(`[aviso] ${msg} Ignorado.`)
          continue
        }
        throw new Error(`${msg} Arquivo NÃO atualizado.`)
      }
      if (lido.instrumentos.size < config.minimoFiisNoBoletim) {
        const msg = `${data}: só ${lido.instrumentos.size} FIIs do universo no boletim (mínimo ${config.minimoFiisNoBoletim}).`
        if (carga > 0) {
          console.warn(`[aviso] ${msg} Ignorado.`)
          continue
        }
        throw new Error(`${msg} Arquivo NÃO atualizado.`)
      }
      historico = incorporarPregao(historico, data, lido.instrumentos, universo, config.maxPregoesGuardados)
      novos++
      console.log(`[info] ${data}: ${lido.instrumentos.size} FIIs lidos (${lido.blocos} instrumentos no boletim).`)
      if (carga > 0) {
        if (novos % 20 === 0) {
          fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
          fs.writeFileSync(arquivoHistorico, formatarHistorico(historico, [...complementados]))
          console.log(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  // Complemento pela brapi: fundos líquidos que a B3 não traz (e os já complementados, para o dia novo também ser preenchido)
  let preenchimentos = 0
  const reserva = config.reservaBrapi ?? { ativa: false }
  if (reserva.ativa) {
    const candidatos = [...new Set([...complementados, ...candidatosReserva(historico, snapshot, { volumeMinimo: reserva.volumeMinimoBrapi, janela: config.minimoPregoesParaUsar })])]
    const r = await complementarComBrapi({ historico, candidatos, token: process.env.BRAPI_TOKEN, janela: reserva.janela, maxRequisicoes: reserva.maxRequisicoes, pausaMs: reserva.pausaMs, fetchImpl })
    historico = r.historico
    for (const t of r.completados) complementados.add(t)
    preenchimentos = r.completados.length
  }

  if (novos === 0 && preenchimentos === 0 && fs.existsSync(arquivoPrecos)) {
    console.log(`Sem pregão novo desde ${historico.pregoes.at(-1) ?? 'nenhum'}${semPregao ? ' (feriado ou fim de semana)' : ''}: arquivo mantido.`)
    return { novos, historico }
  }
  fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
  fs.writeFileSync(arquivoHistorico, formatarHistorico(historico, [...complementados]))
  fs.writeFileSync(arquivoPrecos, formatarPrecos(precosDoDia(historico), agora.toISOString()))
  const ultimo = historico.pregoes.at(-1)
  const diasDesdePregao = (agora.getTime() - Date.parse(`${ultimo}T21:00:00Z`)) / 86_400_000
  console.log(`historico/fiis.json atualizado: ${historico.pregoes.length} pregões (${novos} novos), último de ${ultimo}, ${Object.keys(historico.ativos).length} fundos com preço.`)
  if (diasDesdePregao > 7) throw new Error(`O pregão mais recente do histórico é de ${ultimo}, mais de 7 dias atrás.`)
  if (historico.pregoes.length < config.minimoPregoesParaUsar) console.warn(`[aviso] Só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesParaUsar} para a triagem usar o preço diário). Rode a carga inicial de novo: ela continua de onde parou.`)
  return { novos, historico }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
