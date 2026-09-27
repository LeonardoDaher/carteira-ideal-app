// Atualização diária dos dados da aba de ETFs (decisão D23).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-etfs.yml), às 22h de
// Brasília, ou manualmente:
//   BRAPI_TOKEN=... node scripts/atualizar-etfs.mjs                     (dia a dia)
//   BRAPI_TOKEN=... node scripts/atualizar-etfs.mjs --carga-inicial=260 (uma vez, histórico)
//
// O que faz:
//   1. Universo: a lista de ETFs e o nome oficial vêm da brapi (/api/v2/tickers?subType=etf,
//      3 requisições). Se a brapi falhar ou a cota acabar, usa o universo guardado no
//      histórico, com aviso no log: o preço não depende da brapi.
//   2. Preço e volume: Boletim de Preços oficial da B3 (scripts/b3-boletim.mjs), um arquivo
//      por pregão, com volume em reais (inclusive ETFs de renda fixa, que não estão no COTAHIST).
//   3. Histórico próprio (historico/etfs.json): fechamento, mínima, máxima e volume de cada
//      ETF nos últimos pregões. Dele saem a média de 21 pregões, a variação de 3 meses e a
//      faixa de 52 semanas, sem requisição nenhuma.
//   4. Publica os 40 ETFs de maior volume médio, acima do piso, em
//      webapp-src/src/data/etfs.json, com a lista de busca de todos os demais.
//
// Regras de segurança: boletim com poucos ETFs, ETFs de controle sem dado, histórico curto
// ou lista final abaixo do mínimo = o script termina com erro SEM gravar nada. Dia sem pregão
// (feriado) ou pregão já processado: nada muda, sem commit e sem deploy.
//
// Telas estritamente descritivas (D19, D23): sem múltiplos, sem ranking de "melhor"; a ordem
// é sempre por volume.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, datasCandidatas, lerBoletim } from './b3-boletim.mjs'
import { formatarSnapshot } from './atualizar-rendimentos-fii.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'etfs.json')
const ARQUIVO_HISTORICO = path.join(RAIZ, 'historico', 'etfs.json')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'etfs.json')
const URL_LISTA = (pagina) => `https://brapi.dev/api/v2/tickers?subType=etf&limit=100&page=${pagina}`

export const SESSOES_LIQUIDEZ = 21 // mesma régua dos FIIs (D13) e BDRs (D19)
export const SESSOES_3_MESES = 63
export const SESSOES_52_SEMANAS = 252
// Com menos pregões que isso no histórico, a faixa de 52 semanas não é publicada.
export const MINIMO_PARA_52_SEMANAS = 240
export const MAXIMO_PREGOES_GUARDADOS = 260

const PRECO_MIN = 0.1
const PRECO_MAX = 10_000
const VARIACAO_MIN_PCT = -90
const VARIACAO_MAX_PCT = 500

// ---------------------------------------------------------------------------------------
// Funções puras (exportadas para os testes em atualizar-etfs.test.mjs)
// ---------------------------------------------------------------------------------------

const semAcento = (texto) => String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const arredondar = (valor, casas = 2) => (valor === null || valor === undefined ? null : Math.round(valor * 10 ** casas) / 10 ** casas)

/**
 * Nome exibido a partir do nome oficial, sem o texto jurídico do fundo:
 * "Trend ETF S&P 500 Quanto Classe de Indice - Responsabilidade Limitada" -> "Trend ETF S&P 500 Quanto".
 */
export function limparNome(nomeOficial, ticker, nomesManuais = {}) {
  if (nomesManuais[ticker]) return nomesManuais[ticker]
  const bruto = String(nomeOficial ?? '').replace(/\s+/g, ' ').trim()
  if (!bruto || bruto.toUpperCase() === ticker) return ticker
  const limpo = bruto
    .split(/\s+-?\s*(?:fundo|fun|classe)\s+(?:de\s+|do\s+)?(?:[íi]ndice|investimento|invest)\b/i)[0]
    .split(/\s+-\s+(?:responsabilidade|investimento no exterior|rl\b)/i)[0]
    .replace(/[\s,.;-]+$/, '')
    .trim()
  return limpo || ticker
}

/** Nome com palavra de alerta (ex.: "Infra") e sem decisão no config: pede revisão manual. */
export function precisaRevisar(ticker, nomeOficial, config) {
  if ((config.excluir?.tickers ?? []).includes(ticker)) return false
  if ((config.revisados?.tickers ?? []).includes(ticker)) return false
  const nome = semAcento(nomeOficial)
  return (config.palavrasRevisar?.palavras ?? []).some((p) => nome.includes(semAcento(p)))
}

/**
 * Universo de ETFs a partir da listagem v2 da brapi: Map ticker -> nome oficial, sem os
 * excluídos. Também devolve os códigos que pedem revisão.
 */
export function montarUniverso(itens, config) {
  const excluir = config.excluir?.tickers ?? []
  const universo = new Map()
  const revisar = []
  for (const item of itens) {
    const ticker = String(item?.symbol ?? '').toUpperCase()
    if (!/^[A-Z0-9]{4}11$/.test(ticker) || item?.subType !== 'etf' || item?.isActive === false) continue
    if (excluir.includes(ticker)) continue
    const nome = item?.longName || item?.name || ticker
    if (precisaRevisar(ticker, nome, config)) revisar.push(ticker)
    universo.set(ticker, nome)
  }
  return { universo, revisar }
}

/** Histórico vazio no formato do arquivo historico/etfs.json. */
export function historicoVazio() {
  return { pregoes: [], nomes: {}, ativos: {} }
}

/**
 * Inclui (ou substitui) o pregão `data` no histórico. `instrumentos` é o Map do boletim.
 * Cada ativo guarda um valor por pregão, alinhado com `pregoes`: [fechamento, mínima,
 * máxima, volume] ou null (não negociou). Mantém só os `maximo` pregões mais recentes.
 */
export function incorporarPregao(historico, data, instrumentos, universo, maximo = MAXIMO_PREGOES_GUARDADOS) {
  const pregoes = [...historico.pregoes]
  const ativos = Object.fromEntries(Object.entries(historico.ativos).map(([t, serie]) => [t, [...serie]]))
  let indice = pregoes.indexOf(data)
  if (indice === -1) {
    indice = pregoes.findIndex((p) => p > data)
    if (indice === -1) indice = pregoes.length
    pregoes.splice(indice, 0, data)
    for (const serie of Object.values(ativos)) serie.splice(indice, 0, null)
  }
  const nomes = { ...historico.nomes }
  for (const [ticker, nome] of universo) {
    nomes[ticker] = nome
    if (!ativos[ticker]) ativos[ticker] = pregoes.map(() => null)
    const item = instrumentos.get(ticker)
    ativos[ticker][indice] =
      item && item.fechamento > 0 ? [item.fechamento, item.minima ?? item.fechamento, item.maxima ?? item.fechamento, arredondar(item.volume ?? 0)] : null
  }
  const corte = Math.max(0, pregoes.length - maximo)
  const recortados = Object.fromEntries(
    Object.entries(ativos)
      .map(([t, serie]) => [t, serie.slice(corte)])
      .filter(([, serie]) => serie.some((v) => v !== null)),
  )
  return { pregoes: pregoes.slice(corte), nomes, ativos: recortados }
}

/**
 * Números de um ETF a partir do histórico. Dia sem negócio conta como volume zero na média
 * (um ETF que quase não negocia não pode parecer líquido por ter negociado bem em 3 dias).
 */
export function metricas(historico, ticker) {
  const serie = historico.ativos[ticker]
  const pregoes = historico.pregoes
  if (!serie || pregoes.length === 0) return null
  let ultimo = -1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i]) {
      ultimo = i
      break
    }
  }
  if (ultimo === -1) return null

  const janela = serie.slice(-SESSOES_LIQUIDEZ)
  const volumeMedio = janela.reduce((soma, v) => soma + (v ? v[3] : 0), 0) / janela.length

  // Variação de 3 meses: último fechamento contra o fechamento de 63 pregões antes do fim
  // do histórico (ou o último negócio antes disso).
  let variacao3m = null
  const alvo = pregoes.length - 1 - SESSOES_3_MESES
  if (alvo >= 0) {
    let base = null
    for (let i = alvo; i >= 0 && base === null; i--) if (serie[i]) base = serie[i][0]
    if (base > 0) variacao3m = arredondar((serie[ultimo][0] / base - 1) * 100, 1)
  }

  let minima52 = null
  let maxima52 = null
  if (pregoes.length >= MINIMO_PARA_52_SEMANAS) {
    const ano = serie.slice(-SESSOES_52_SEMANAS).filter(Boolean)
    minima52 = arredondar(Math.min(...ano.map((v) => v[1])))
    maxima52 = arredondar(Math.max(...ano.map((v) => v[2])))
  }

  return {
    cotacao: arredondar(serie[ultimo][0]),
    dataCotacao: pregoes[ultimo],
    volumeMedio: Math.round(volumeMedio),
    variacao3m,
    minima52,
    maxima52,
  }
}

/** Item publicado, com os dados manuais do config, e o que faltou (para o log). */
export function montarItem(ticker, historico, config) {
  const numeros = metricas(historico, ticker)
  if (!numeros) return null
  const categoria = config.categorias?.[ticker] ?? 'Outros'
  const indice = config.indices?.[ticker] ?? null
  const cambio = categoria === 'Bolsa exterior' && typeof config.cambio?.[ticker] === 'boolean' ? config.cambio[ticker] : null
  return {
    item: {
      ticker,
      nome: limparNome(historico.nomes[ticker], ticker, config.nomes),
      categoria,
      indice,
      cambio,
      ...numeros,
    },
    faltou: {
      categoria: categoria === 'Outros',
      indice: indice === null,
      cambio: categoria === 'Bolsa exterior' && cambio === null,
    },
  }
}

/** Motivo para não publicar um ETF, ou null se o dado for plausível. */
export function motivoInvalido(item) {
  if (!(item.cotacao >= PRECO_MIN && item.cotacao <= PRECO_MAX)) return `cotação fora da faixa plausível (${item.cotacao})`
  if (item.variacao3m !== null && (item.variacao3m < VARIACAO_MIN_PCT || item.variacao3m > VARIACAO_MAX_PCT)) {
    return `variação de 3 meses fora da faixa plausível (${item.variacao3m}%)`
  }
  return null
}

/** Os `maximo` com maior volume médio, acima do piso, em ordem de volume. */
export function selecionar(itens, maximo, piso) {
  return itens
    .filter((i) => i.volumeMedio >= piso)
    .sort((a, b) => b.volumeMedio - a.volumeMedio || a.ticker.localeCompare(b.ticker))
    .slice(0, maximo)
}

/** Lista de busca: todos os ETFs com cotação válida, em ordem alfabética. */
export function montarBusca(itens) {
  return itens
    .map(({ ticker, nome, categoria, cotacao, dataCotacao, volumeMedio }) => ({ ticker, nome, categoria, cotacao, dataCotacao, volumeMedio }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/**
 * Datas que faltam processar, entre as candidatas (que vêm da mais recente para a mais antiga).
 * Dia a dia: para na primeira que já está no histórico e devolve da mais antiga para a mais nova.
 * Carga inicial: pula as que já estão no histórico e devolve da MAIS NOVA para a mais antiga,
 * para que, ao atingir a quantidade pedida, fiquem os pregões mais recentes. (Na primeira carga,
 * em 27/09/2026, a ordem inversa guardou os 260 pregões mais antigos e deixou de fora o último
 * mês: a trava de dado velho barrou a publicação.)
 */
export function datasAProcessar(candidatas, pregoesNoHistorico, cargaInicial = false) {
  const ja = new Set(pregoesNoHistorico)
  const faltam = []
  for (const data of candidatas) {
    if (ja.has(data)) {
      if (!cargaInicial) break
      continue
    }
    faltam.push(data)
  }
  return cargaInicial ? faltam : faltam.reverse()
}

/** Histórico em texto: um ETF por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico) {
  const linhas = Object.keys(historico.ativos)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.ativos[t])}`)
  const nomes = Object.keys(historico.nomes)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.nomes[t])}`)
  return [
    '{',
    '  "_leia": "Histórico próprio dos ETFs (decisão D23), gerado por scripts/atualizar-etfs.mjs a partir do Boletim de Preços da B3. Cada ativo tem um valor por pregão, alinhado com \\"pregoes\\": [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "nomes": {\n${nomes.join(',\n')}\n  },`,
    `  "ativos": {\n${linhas.join(',\n')}\n  }`,
    '}',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

/** Listagem v2 da brapi, página a página. Devolve null se falhar (o job segue sem ela). */
async function buscarListagem(token, config) {
  if (!token) {
    console.warn('[aviso] BRAPI_TOKEN não definido: usando o universo de ETFs guardado no histórico.')
    return null
  }
  const itens = []
  try {
    for (let pagina = 1; pagina <= (config.maxPaginasListagem ?? 5); pagina++) {
      const resposta = await fetch(URL_LISTA(pagina), { headers: { Authorization: `Bearer ${token}` } })
      if (!resposta.ok) throw new Error(`brapi respondeu ${resposta.status}`)
      const corpo = await resposta.json()
      itens.push(...(corpo?.results ?? []))
      if (!corpo?.pagination?.hasNextPage) break
    }
  } catch (erro) {
    console.warn(`[aviso] Listagem da brapi indisponível (${erro.message}): usando o universo guardado no histórico.`)
    return null
  }
  return itens
}

function argumentoCarga(argv) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? MAXIMO_PREGOES_GUARDADOS)
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAXIMO_PREGOES_GUARDADOS) : MAXIMO_PREGOES_GUARDADOS
}

async function main() {
  const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG, 'utf8'))
  if (config.conferidoPeloResponsavel !== true) {
    throw new Error('config/etfs.json ainda não foi conferido. Revise categorias, índices, câmbio e exclusões e marque "conferidoPeloResponsavel": true.')
  }
  const agora = new Date()
  const carga = argumentoCarga(process.argv)
  let historico = lerJson(ARQUIVO_HISTORICO, historicoVazio())

  // 1. Universo (brapi, com o histórico como reserva)
  const listagem = await buscarListagem(process.env.BRAPI_TOKEN, config)
  let universo
  if (listagem && listagem.length >= config.minimoEtfsNaListagem) {
    const montado = montarUniverso(listagem, config)
    universo = montado.universo
    for (const ticker of montado.revisar) {
      console.log(`[revisar] ${ticker} (${universo.get(ticker)}): nome com palavra de alerta. Se não for fundo de índice, inclua em "excluir"; se for, em "revisados" (config/etfs.json).`)
    }
    console.log(`[info] Listagem da brapi: ${listagem.length} ETFs, ${universo.size} no universo depois das exclusões.`)
  } else {
    if (listagem) console.warn(`[aviso] Listagem da brapi com só ${listagem.length} ETFs (mínimo ${config.minimoEtfsNaListagem}): usando o universo guardado.`)
    const excluir = config.excluir?.tickers ?? []
    universo = new Map(Object.entries(historico.nomes).filter(([t]) => !excluir.includes(t)))
    if (universo.size < config.minimoEtfsNaListagem) {
      throw new Error(`Sem listagem da brapi e com só ${universo.size} ETFs guardados no histórico. Arquivo NÃO atualizado.`)
    }
  }

  // 2. Boletins da B3 que faltam no histórico
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim ?? 5
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'etfs-b3-'))
  let novos = 0
  let semPregao = 0
  try {
    for (const data of faltam) {
      if (carga > 0 && historico.pregoes.length >= carga) break
      const inicioDia = Date.now()
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
      if (lido.instrumentos.size < config.minimoEtfsNoBoletim) {
        const msg = `${data}: só ${lido.instrumentos.size} ETFs do universo no boletim (mínimo ${config.minimoEtfsNoBoletim}).`
        if (carga > 0) {
          console.warn(`[aviso] ${msg} Ignorado.`)
          continue
        }
        throw new Error(`${msg} Arquivo NÃO atualizado.`)
      }
      historico = incorporarPregao(historico, data, lido.instrumentos, universo)
      novos++
      console.log(`[info] ${data}: ${lido.instrumentos.size} ETFs lidos (${lido.blocos} instrumentos no boletim, ${((Date.now() - inicioDia) / 1000).toFixed(1)} s).`)
      if (carga > 0) {
        // Grava a cada 20 pregões: se a execução for interrompida, o workflow publica o que já veio.
        if (novos % 20 === 0) {
          fs.mkdirSync(path.dirname(ARQUIVO_HISTORICO), { recursive: true })
          fs.writeFileSync(ARQUIVO_HISTORICO, formatarHistorico(historico))
          console.log(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  // Na carga inicial, o histórico é gravado sempre: uma carga interrompida (B3 negou dias
  // antigos, tempo esgotado) não perde o que já baixou, e rodar de novo só busca o que falta.
  if (carga > 0 && novos > 0) {
    fs.mkdirSync(path.dirname(ARQUIVO_HISTORICO), { recursive: true })
    fs.writeFileSync(ARQUIVO_HISTORICO, formatarHistorico(historico))
    console.log(`[info] Histórico gravado: ${historico.pregoes.length} pregões (${novos} novos nesta carga).`)
    if (historico.pregoes.length < config.minimoPregoesHistorico) {
      console.warn(`[aviso] Ainda são só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico} para publicar). Rode a carga inicial de novo: ela continua de onde parou. etfs.json NÃO atualizado.`)
      return
    }
  }

  const saidaAtual = lerJson(ARQUIVO_SAIDA, null)
  if (novos === 0 && saidaAtual?.dataPregao) {
    console.log(`Sem pregão novo desde ${historico.pregoes[historico.pregoes.length - 1] ?? 'nenhum'}${semPregao ? ' (feriado ou fim de semana)' : ''}: arquivos mantidos.`)
    return
  }

  // 3. Travas sobre o histórico
  if (historico.pregoes.length < config.minimoPregoesHistorico) {
    throw new Error(`O histórico tem só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico}). Rode a carga inicial (workflow "Carga inicial de ETFs"). Arquivo NÃO atualizado.`)
  }
  const dataPregao = historico.pregoes[historico.pregoes.length - 1]
  const diasDesdePregao = (agora.getTime() - Date.parse(`${dataPregao}T21:00:00Z`)) / 86_400_000
  if (diasDesdePregao > 7) {
    throw new Error(`O pregão mais recente do histórico é de ${dataPregao}, mais de 7 dias atrás. Arquivo NÃO atualizado.`)
  }

  // 4. Itens, validação e seleção
  const itens = []
  const faltou = { categoria: [], indice: [], cambio: [] }
  const invalidos = []
  for (const ticker of universo.keys()) {
    const montado = montarItem(ticker, historico, config)
    if (!montado) continue
    const motivo = motivoInvalido(montado.item)
    if (motivo) {
      invalidos.push(`${ticker}: ${motivo}`)
      continue
    }
    itens.push(montado.item)
    for (const campo of Object.keys(faltou)) if (montado.faltou[campo]) faltou[campo].push(ticker)
  }
  for (const linha of invalidos) console.log(`[info] ${linha}`)

  const controle = config.controle?.tickers ?? []
  const controleOk = controle.filter((t) => itens.some((i) => i.ticker === t && i.dataCotacao === dataPregao))
  const minimoControle = config.controle?.minimo ?? controle.length
  if (controleOk.length < minimoControle) {
    throw new Error(`Só ${controleOk.length} de ${controle.length} ETFs de controle negociaram em ${dataPregao} com dado válido (mínimo ${minimoControle}). Arquivo NÃO atualizado.`)
  }
  const lista = selecionar(itens, config.maxEtfs, config.pisoVolume)
  if (lista.length < config.minimoEtfsParaPublicar) {
    throw new Error(`Só ${lista.length} ETFs passaram no piso de liquidez (mínimo ${config.minimoEtfsParaPublicar}). Arquivo NÃO atualizado.`)
  }

  // 5. Logs de conferência (só dos publicados na lista)
  const naLista = new Set(lista.map((i) => i.ticker))
  for (const t of faltou.categoria) if (naLista.has(t)) console.log(`[categoria] ${t} (${historico.nomes[t]}): sem categoria em "categorias" (config/etfs.json); aparece em "Outros".`)
  for (const t of faltou.indice) if (naLista.has(t)) console.log(`[indice] ${t} (${historico.nomes[t]}): sem índice em "indices" (config/etfs.json); o cartão omite a linha.`)
  for (const t of faltou.cambio) if (naLista.has(t)) console.log(`[cambio] ${t} (${historico.nomes[t]}): bolsa exterior sem "cambio" (config/etfs.json); o cartão omite a linha.`)
  const porCategoria = {}
  for (const i of lista) porCategoria[i.categoria] = (porCategoria[i.categoria] ?? 0) + 1
  console.log(`[info] Categorias: ${Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ')}.`)
  const reais = (v) => `R$ ${(v / 1e6).toFixed(1)} mi/dia`
  console.log(`[info] Mais negociados: ${lista.slice(0, 3).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}. Menos negociados da lista: ${lista.slice(-2).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}.`)

  // 6. Gravação (histórico e arquivo do app juntos)
  const snapshot = {
    geradoEm: agora.toISOString(),
    dataPregao,
    fonte: 'B3 - Boletim de Preços (BVBG.086)',
    pregoesNoHistorico: historico.pregoes.length,
    sessoesLiquidez: SESSOES_LIQUIDEZ,
    criterio: { maxEtfs: config.maxEtfs, pisoVolume: config.pisoVolume },
    ordemCategorias: config.ordemCategorias,
    etfs: lista,
    busca: montarBusca(itens),
  }
  fs.mkdirSync(path.dirname(ARQUIVO_HISTORICO), { recursive: true })
  fs.writeFileSync(ARQUIVO_HISTORICO, formatarHistorico(historico))
  fs.writeFileSync(ARQUIVO_SAIDA, formatarSnapshot(snapshot))
  console.log(`etfs.json atualizado: ${lista.length} ETFs na lista, ${snapshot.busca.length} na busca, pregão de ${dataPregao}, ${historico.pregoes.length} pregões no histórico (${novos} novos).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
