// Atualização diária dos dados da aba Simule Ações (decisão D43).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-acoes.yml), às 23h de
// Brasília, ou manualmente:
//   node scripts/atualizar-acoes.mjs                      (dia a dia)
//   node scripts/atualizar-acoes.mjs --carga-inicial=260  (uma vez, histórico)
//
// Molde dos BDRs (D24) e dos ETFs (D23), com uma diferença que resolve o problema de cota:
// este job NÃO usa a brapi. Preço e volume vêm do Boletim de Preços oficial da B3 (BVBG.086,
// scripts/b3-boletim.mjs), que é gratuito e sem cota; setor e nome vêm do cadastro curado em
// config/acoes.json. Não há chamada a API nenhuma, então o tamanho da lista não pesa no plano.
//
// Publica:
//   - "setores": cada setor do cadastro, com as empresas que negociaram nos últimos 21 pregões,
//     em ordem de volume. O que não negociou aparece como [sem negócio] no log e some da tela;
//   - "busca": todo código de ação (4 caracteres + 3, 4, 5 ou 6) com negócio nos últimos 63
//     pregões, inclusive os fora do cadastro (setor "Outros"), mais as units do cadastro (11).
//
// Histórico próprio (historico/acoes.json), no mesmo formato dos BDRs: séries alinhadas pela
// DIREITA, [fechamento, mínima, máxima, volume]. Série longa (até 260 pregões) para as empresas
// do cadastro; série curta (21) para o resto.
//
// Desdobramentos, grupamentos e bonificações: o boletim traz preço bruto. Um salto de um pregão
// para o outro (queda de 45% ou mais, alta de 80% ou mais) tira a variação de 3 meses e a faixa de
// 52 semanas da empresa até o responsável confirmar o evento em "desdobramentos"
// (config/acoes.json). Dividendos não geram salto e não entram na variação: é só preço.
//
// Telas estritamente descritivas: sem múltiplos de avaliação, sem ranking de "melhor".

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, dataEmBrasilia, datasCandidatas, lerBoletim } from './b3-boletim.mjs'
import { datasAProcessar } from './atualizar-etfs.mjs'
import { MAXIMO_PREGOES_GUARDADOS, SESSOES_LIQUIDEZ, aplicarDesdobramentos, detectarSaltos, incorporarPregao, metricas, semVariacaoDia } from './atualizar-bdrs.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export { SESSOES_LIQUIDEZ, MAXIMO_PREGOES_GUARDADOS }
export const FONTE = 'B3 - Boletim de Preços (BVBG.086)'

const PRECO_MIN = 0.05
const PRECO_MAX = 50_000
const VARIACAO_MIN_PCT = -95
const VARIACAO_MAX_PCT = 1000

// ---------------------------------------------------------------------------------------
// Cadastro e filtro de códigos
// ---------------------------------------------------------------------------------------

/**
 * Código de ação: 4 caracteres e um dígito de 3 a 6 (ON, PN, PNA, PNB). Fora: units (11), que só
 * entram quando estão no cadastro; BDRs, FIIs e ETFs (6 caracteres); opções, termo e fracionário.
 */
export function ehCodigoDeAcao(ticker) {
  return /^[A-Z0-9]{3}[A-Z][3-6]$/.test(String(ticker ?? '').toUpperCase())
}

/**
 * Lê "setores" do config e devolve o Map ticker -> { nome, setor, grupoB3, revisar }.
 * Falha se houver ticker repetido, vazio ou sem nome: erro de digitação no cadastro não pode
 * virar tela errada.
 */
export function montarCadastro(config) {
  const mapa = new Map()
  for (const s of config.setores ?? []) {
    if (!s.setor || !s.grupoB3 || !Array.isArray(s.empresas)) throw new Error(`Setor mal formado em config/acoes.json: ${JSON.stringify(s).slice(0, 80)}`)
    for (const e of s.empresas) {
      const ticker = String(e.ticker ?? '').toUpperCase()
      if (!/^[A-Z0-9]{4}\d{1,2}$/.test(ticker)) throw new Error(`Código inválido em "${s.setor}": ${JSON.stringify(e.ticker)}.`)
      if (!e.nome) throw new Error(`${ticker} está sem nome em config/acoes.json.`)
      if (mapa.has(ticker)) throw new Error(`${ticker} aparece duas vezes em config/acoes.json (${mapa.get(ticker).setor} e ${s.setor}).`)
      mapa.set(ticker, { nome: e.nome, setor: s.setor, grupoB3: s.grupoB3, revisar: e.revisar === true })
    }
  }
  return mapa
}

/** Identificador curto do cadastro: muda quando uma empresa ou setor muda, para regravar a tela. */
export function idDoCadastro(cadastro) {
  const texto = [...cadastro].map(([t, c]) => `${t}|${c.setor}|${c.nome}`).join('\n')
  return crypto.createHash('sha1').update(texto).digest('hex').slice(0, 10)
}

// ---------------------------------------------------------------------------------------
// Histórico próprio
// ---------------------------------------------------------------------------------------

export function historicoVazio() {
  return { pregoes: [], ativos: {}, ultimoNegocio: {} }
}

export function normalizarHistorico(bruto) {
  const vazio = historicoVazio()
  if (!bruto || typeof bruto !== 'object') return vazio
  return {
    pregoes: Array.isArray(bruto.pregoes) ? bruto.pregoes : [],
    ativos: bruto.ativos ?? {},
    ultimoNegocio: bruto.ultimoNegocio ?? {},
  }
}

/** Série longa só do cadastro e dos de controle; as demais guardam os últimos `janelaCurta` pregões. */
export function compactar(historico, longos, janelaCurta = SESSOES_LIQUIDEZ) {
  const manter = new Set(longos)
  const ativos = {}
  for (const [ticker, serie] of Object.entries(historico.ativos)) {
    const guardada = manter.has(ticker) ? serie : serie.slice(-janelaCurta)
    if (guardada.some(Boolean)) ativos[ticker] = guardada
  }
  const primeiro = historico.pregoes[0] ?? ''
  const ultimoNegocio = Object.fromEntries(Object.entries(historico.ultimoNegocio).filter(([, [data]]) => data >= primeiro))
  return { ...historico, ativos, ultimoNegocio }
}

/** Histórico em texto: uma empresa por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico) {
  const bloco = (objeto) =>
    Object.keys(objeto)
      .sort()
      .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(objeto[t])}`)
      .join(',\n')
  return [
    '{',
    '  "_leia": "Histórico próprio das ações (decisão D43), gerado por scripts/atualizar-acoes.mjs a partir do Boletim de Preços da B3. Séries alinhadas pela DIREITA: o último valor de cada série é o último pregão de \\"pregoes\\"; o que falta no começo é sem dado. Cada valor: [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Série longa (até 260 pregões) só das empresas do cadastro (config/acoes.json); as demais guardam 21. Preços brutos, sem ajuste de desdobramento (os ajustes ficam em config/acoes.json). Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "ultimoNegocio": {\n${bloco(historico.ultimoNegocio)}\n  },`,
    `  "ativos": {\n${bloco(historico.ativos)}\n  }`,
    '}',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------------------
// Montagem da tela
// ---------------------------------------------------------------------------------------

/** Motivo para não publicar uma empresa, ou null se o dado for plausível. */
export function motivoInvalido(item) {
  if (!(item.cotacao >= PRECO_MIN && item.cotacao <= PRECO_MAX)) return `cotação fora da faixa plausível (${item.cotacao})`
  if (!(item.volumeMedio > 0)) return 'sem negócio nos últimos 21 pregões'
  if (item.variacao3m !== null && (item.variacao3m < VARIACAO_MIN_PCT || item.variacao3m > VARIACAO_MAX_PCT)) {
    return `variação de 3 meses fora da faixa plausível (${item.variacao3m}%)`
  }
  return null
}

/**
 * Setores publicados: para cada setor do cadastro, as empresas com dado válido em ordem de
 * volume. Setor sem nenhuma empresa válida não é publicado. Devolve também o que ficou de fora
 * (para o log) e os saltos de preço ainda não confirmados.
 */
export function montarSetores(historico, cadastro, config) {
  const porTicker = new Map()
  const semNegocio = []
  const invalidos = []
  const saltos = new Map()
  for (const [ticker] of cadastro) {
    const numeros = metricas(historico, ticker, config)
    if (!numeros) {
      semNegocio.push(ticker)
      continue
    }
    const { saltos: s, ...resto } = numeros
    const motivo = motivoInvalido(resto)
    if (motivo) {
      if (resto.volumeMedio > 0) invalidos.push(`${ticker}: ${motivo}`)
      else semNegocio.push(ticker)
      continue
    }
    if (s.length) saltos.set(ticker, s)
    porTicker.set(ticker, { ticker, nome: cadastro.get(ticker).nome, ...resto })
  }
  const setores = []
  for (const s of config.setores) {
    const empresas = s.empresas
      .map((e) => porTicker.get(String(e.ticker).toUpperCase()))
      .filter(Boolean)
      .sort((a, b) => b.volumeMedio - a.volumeMedio || a.ticker.localeCompare(b.ticker))
    if (empresas.length) setores.push({ setor: s.setor, grupoB3: s.grupoB3, empresas })
  }
  return { setores, semNegocio, invalidos, saltos }
}

/**
 * Lista de busca: todo código de ação (ou unit do cadastro) com negócio nos últimos `pregoesBusca`
 * pregões, com o preço e a data do último negócio e o volume do último pregão. Fora do cadastro:
 * setor "Outros" e nome nulo (o boletim não traz nome).
 */
export function montarBusca(historico, cadastro, config) {
  const pregoes = historico.pregoes
  const limite = pregoes[Math.max(0, pregoes.length - (config.pregoesBusca ?? 63))] ?? ''
  const busca = []
  for (const [ticker, [data, cotacao]] of Object.entries(historico.ultimoNegocio)) {
    const noCadastro = cadastro.get(ticker)
    if (!noCadastro && !ehCodigoDeAcao(ticker)) continue
    if (data < limite || !(cotacao >= PRECO_MIN && cotacao <= PRECO_MAX)) continue
    const serie = historico.ativos[ticker]
    const ultimoPregao = serie && serie.length ? serie[serie.length - 1] : null
    busca.push({
      ticker,
      nome: noCadastro?.nome ?? null,
      setor: noCadastro?.setor ?? 'Outros',
      cotacao,
      dataCotacao: data,
      volumeDia: ultimoPregao ? ultimoPregao[3] : 0,
    })
  }
  return busca.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

// ---------------------------------------------------------------------------------------
// Séries para a análise técnica (D119)
// ---------------------------------------------------------------------------------------

/** Referência de mercado da análise técnica: o BOVA11 (ETF do Ibovespa), lido do histórico próprio dos ETFs. */
export const REFERENCIA_DE_MERCADO = 'BOVA11'

const casasDoPreco = (v) => (v < 1 ? 3 : 2)
const arredondaPreco = (v) => Number(v.toFixed(casasDoPreco(v)))

/** [fechamento, mínima, máxima, volume em R$ mil], ou null (sem negócio). Preço ajustado a desdobramentos. */
function pontoDaSerie(v) {
  return v ? [arredondaPreco(v[0]), arredondaPreco(v[1]), arredondaPreco(v[2]), Math.round(v[3] / 1000)] : null
}

/**
 * Séries diárias das empresas do cadastro (até 260 pregões), com os desdobramentos confirmados aplicados, para a análise
 * técnica do app. Salto de preço ainda não confirmado entra em "alertas": a série não é ajustável e o app avisa que o gráfico
 * pode estar distorcido. A referência de mercado vem do histórico dos ETFs, alinhada pelas datas dos pregões das ações.
 */
export function montarSeries(historico, cadastro, config, historicoEtfs = null) {
  const ativos = {}
  const alertas = {}
  for (const [ticker] of cadastro) {
    const bruta = historico.ativos[ticker]
    if (!bruta?.length) continue
    const datas = historico.pregoes.slice(historico.pregoes.length - bruta.length)
    const serie = aplicarDesdobramentos(bruta, datas, config.desdobramentos?.[ticker])
    if (!serie.some(Boolean)) continue
    ativos[ticker] = serie.map(pontoDaSerie)
    const saltos = detectarSaltos(serie, datas, serie.length)
    if (saltos.length) alertas[ticker] = saltos.map((s) => ({ data: s.data, de: s.de, para: s.para }))
  }
  let referencia = null
  const etf = historicoEtfs?.ativos?.[REFERENCIA_DE_MERCADO]
  if (etf?.length && Array.isArray(historicoEtfs.pregoes)) {
    const datasEtf = historicoEtfs.pregoes.slice(historicoEtfs.pregoes.length - etf.length)
    const porData = new Map(datasEtf.map((d, i) => [d, etf[i]]))
    const alinhada = historico.pregoes.map((d) => porData.get(d) ?? null)
    if (alinhada.some(Boolean)) referencia = { ticker: REFERENCIA_DE_MERCADO, serie: alinhada.map(pontoDaSerie) }
  }
  return { pregoes: historico.pregoes, ativos, alertas, referencia }
}

/** acoes-series.json: uma série por linha, para o diff do GitHub continuar legível. */
export function formatarSeries({ geradoEm, dataPregao, fonte, series }) {
  const bloco = (objeto) => Object.keys(objeto).sort().map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(objeto[t])}`).join(',\n')
  return [
    '{',
    `  "geradoEm": ${JSON.stringify(geradoEm)},`,
    `  "dataPregao": ${JSON.stringify(dataPregao)},`,
    `  "fonte": ${JSON.stringify(fonte)},`,
    '  "_leia": "Séries diárias para a análise técnica (D119), geradas por scripts/atualizar-acoes.mjs. Alinhadas pela DIREITA com \\"pregoes\\". Cada ponto: [fechamento, mínima, máxima, volume em R$ mil] ou null (sem negócio). Não há preço de abertura no Boletim de Preços. Desdobramentos confirmados já aplicados. Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(series.pregoes)},`,
    `  "referencia": ${JSON.stringify(series.referencia)},`,
    `  "alertas": ${JSON.stringify(series.alertas)},`,
    `  "ativos": {\n${bloco(series.ativos)}\n  }`,
    '}',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

function argumentoCarga(argv) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? MAXIMO_PREGOES_GUARDADOS)
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAXIMO_PREGOES_GUARDADOS) : MAXIMO_PREGOES_GUARDADOS
}

/**
 * Execução completa. As dependências de rede entram por parâmetro para o teste de ponta a
 * ponta (atualizar-acoes.test.mjs) rodar sem internet.
 */
export async function executar({
  raiz = RAIZ_PADRAO,
  agora = new Date(),
  argv = process.argv,
  baixar = baixarBoletim,
  ler = lerBoletim,
  esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = { info: console.log, warn: console.warn },
} = {}) {
  const arquivoConfig = path.join(raiz, 'config', 'acoes.json')
  const arquivoHistorico = path.join(raiz, 'historico', 'acoes.json')
  const arquivoSaida = path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json')
  const arquivoSeries = path.join(raiz, 'webapp-src', 'public', 'dados', 'acoes-series.json')
  const arquivoHistoricoEtfs = path.join(raiz, 'historico', 'etfs.json')
  const gravarHistorico = (h) => {
    fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
    fs.writeFileSync(arquivoHistorico, formatarHistorico(h))
  }

  const config = JSON.parse(fs.readFileSync(arquivoConfig, 'utf8'))
  if (config.conferidoPeloResponsavel !== true) {
    throw new Error('config/acoes.json ainda não foi conferido. Revise o cadastro e marque "conferidoPeloResponsavel": true.')
  }
  const cadastro = montarCadastro(config)
  const cadastroId = idDoCadastro(cadastro)
  const carga = argumentoCarga(argv)
  const hoje = dataEmBrasilia(agora)
  let historico = normalizarHistorico(lerJson(arquivoHistorico, null))
  const aceitar = (t) => cadastro.has(t) || ehCodigoDeAcao(t)

  // 1. Boletins da B3 que faltam no histórico
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim ?? 5
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'acoes-b3-'))
  let novos = 0
  let semPregao = 0
  const falhar = (mensagem) => {
    if (carga > 0) {
      log.warn(`[aviso] ${mensagem} Ignorado (carga inicial segue).`)
      return false
    }
    throw new Error(`${mensagem} Arquivo NÃO atualizado.`)
  }
  try {
    for (const data of faltam) {
      if (carga > 0 && historico.pregoes.length >= carga) break
      const inicio = Date.now()
      let xml
      try {
        xml = await baixar(data, pastaTemp)
      } catch (erro) {
        falhar(`${data}: ${erro.message}`)
        continue
      }
      if (!xml) {
        semPregao++
        log.info(`[info] ${data}: sem pregão na B3 (zip vazio).`)
        continue
      }
      const lido = await ler(xml, aceitar)
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      if (lido.datas.length !== 1 || lido.datas[0] !== data) {
        falhar(`${data}: o boletim trouxe a(s) data(s) ${lido.datas.join(', ') || 'nenhuma'}.`)
        continue
      }
      const negociados = [...lido.instrumentos.values()].filter((i) => i.fechamento > 0).length
      if (negociados < config.minimoCodigosNegociadosNoBoletim) {
        falhar(`${data}: só ${negociados} códigos de ação negociados no boletim (mínimo ${config.minimoCodigosNegociadosNoBoletim}).`)
        continue
      }
      historico = incorporarPregao(historico, data, lido.instrumentos)
      novos++
      log.info(`[info] ${data}: ${negociados} ações negociadas de ${lido.instrumentos.size} no boletim (${((Date.now() - inicio) / 1000).toFixed(1)} s).`)
      if (carga > 0) {
        if (novos % 20 === 0) {
          gravarHistorico(compactar(historico, cadastro.keys()))
          log.info(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  if (carga > 0 && novos > 0) {
    historico = compactar(historico, cadastro.keys())
    gravarHistorico(historico)
    log.info(`[info] Histórico gravado: ${historico.pregoes.length} pregões (${novos} novos nesta carga).`)
    if (historico.pregoes.length < config.minimoPregoesHistorico) {
      log.warn(`[aviso] Ainda são só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico} para publicar). Rode a carga inicial de novo: ela continua de onde parou. acoes.json NÃO atualizado.`)
      return { publicado: false, motivo: 'carga incompleta' }
    }
  }

  // Sem pregão novo e com o mesmo cadastro: nada a fazer.
  const saidaAtual = lerJson(arquivoSaida, null)
  if (novos === 0 && saidaAtual?.dataPregao && saidaAtual?.fonte === FONTE && saidaAtual?.cadastroId === cadastroId && !semVariacaoDia(saidaAtual) && fs.existsSync(arquivoSeries)) {
    log.info(`Sem pregão novo desde ${historico.pregoes[historico.pregoes.length - 1] ?? 'nenhum'}${semPregao ? ' (feriado ou fim de semana)' : ''}: arquivos mantidos.`)
    return { publicado: false, motivo: 'sem pregão novo' }
  }

  // 2. Travas sobre o histórico
  if (historico.pregoes.length < config.minimoPregoesHistorico) {
    throw new Error(`O histórico tem só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico}). Rode a carga inicial (workflow "Carga inicial de Ações"). Arquivo NÃO atualizado.`)
  }
  const dataPregao = historico.pregoes[historico.pregoes.length - 1]
  const diasDesdePregao = (agora.getTime() - Date.parse(`${dataPregao}T21:00:00Z`)) / 86_400_000
  if (diasDesdePregao > 7) {
    throw new Error(`O pregão mais recente do histórico é de ${dataPregao}, mais de 7 dias atrás. Arquivo NÃO atualizado.`)
  }

  // 3. Números, validação e conferência
  const montado = montarSetores(historico, cadastro, config)
  const publicadas = montado.setores.reduce((n, s) => n + s.empresas.length, 0)
  const controle = config.controle?.tickers ?? []
  const todas = montado.setores.flatMap((s) => s.empresas)
  const controleOk = controle.filter((t) => todas.some((e) => e.ticker === t && e.dataCotacao === dataPregao))
  const minimoControle = config.controle?.minimo ?? controle.length
  if (controleOk.length < minimoControle) {
    throw new Error(`Só ${controleOk.length} de ${controle.length} ações de controle negociaram em ${dataPregao} com dado válido (mínimo ${minimoControle}). Arquivo NÃO atualizado.`)
  }
  if (publicadas < config.minimoEmpresasParaPublicar) {
    throw new Error(`Só ${publicadas} empresas do cadastro passaram na validação (mínimo ${config.minimoEmpresasParaPublicar}). Arquivo NÃO atualizado.`)
  }

  for (const linha of montado.invalidos) log.info(`[info] ${linha}`)
  if (montado.semNegocio.length) {
    log.info(`[sem negócio] ${montado.semNegocio.length} códigos do cadastro não negociaram nos últimos ${SESSOES_LIQUIDEZ} pregões e ficam fora da tela: ${montado.semNegocio.join(', ')}. Se a empresa mudou de código ou saiu da bolsa, corrija ou retire de config/acoes.json.`)
  }
  for (const [ticker, info] of cadastro) {
    if (info.revisar && todas.some((e) => e.ticker === ticker)) {
      log.info(`[revisar] ${ticker} (${info.nome}) negociou normalmente. Confirme o código e tire "revisar" do cadastro.`)
    }
  }
  for (const [ticker, lista] of montado.saltos) {
    for (const s of lista) {
      log.info(`[desdobramento] ${ticker}: fechamento foi de R$ ${s.de} para R$ ${s.para} em ${s.data} (fator ≈ ${s.fator}). Se foi desdobramento ou grupamento, inclua em "desdobramentos" (config/acoes.json): "${ticker}": [{ "data": "${s.data}", "fator": ${s.fator} }]. Até lá, a empresa sai sem variação de 3 meses e/ou faixa de 52 semanas.`)
    }
  }
  const busca = montarBusca(historico, cadastro, config)
  const foraDoCadastro = busca.filter((b) => !cadastro.has(b.ticker)).length
  log.info(`[info] ${montado.setores.length} setores, ${publicadas} empresas; ${foraDoCadastro} códigos fora do cadastro só na busca.`)
  const reais = (v) => `R$ ${(v / 1e6).toFixed(1)} mi/dia`
  const porVolume = [...todas].sort((a, b) => b.volumeMedio - a.volumeMedio)
  log.info(`[info] Mais negociadas: ${porVolume.slice(0, 3).map((e) => `${e.ticker} ${reais(e.volumeMedio)}`).join(', ')}. Menos negociadas: ${porVolume.slice(-2).map((e) => `${e.ticker} ${reais(e.volumeMedio)}`).join(', ')}.`)

  // 4. Gravação (histórico e arquivo do app juntos)
  historico = compactar(historico, [...cadastro.keys(), ...controle])
  const snapshot = {
    geradoEm: agora.toISOString(),
    dataPregao,
    fonte: FONTE,
    cadastroId,
    pregoesNoHistorico: historico.pregoes.length,
    sessoesLiquidez: SESSOES_LIQUIDEZ,
    totais: { setores: montado.setores.length, empresas: publicadas },
    gruposOrdem: config.grupoB3Ordem ?? [],
    setores: montado.setores,
    busca,
  }
  gravarHistorico(historico)
  fs.writeFileSync(arquivoSaida, formatarAcoes(snapshot))
  const series = montarSeries(historico, cadastro, config, lerJson(arquivoHistoricoEtfs, null))
  fs.mkdirSync(path.dirname(arquivoSeries), { recursive: true })
  fs.writeFileSync(arquivoSeries, formatarSeries({ geradoEm: agora.toISOString(), dataPregao, fonte: FONTE, series }))
  log.info(`[info] acoes-series.json: ${Object.keys(series.ativos).length} séries${series.referencia ? `, referência ${REFERENCIA_DE_MERCADO}` : ', sem referência de mercado'}${Object.keys(series.alertas).length ? `, ${Object.keys(series.alertas).length} com salto de preço não confirmado` : ''}.`)
  log.info(`acoes.json atualizado: ${montado.setores.length} setores, ${publicadas} empresas, ${busca.length} na busca, pregão de ${dataPregao}, ${historico.pregoes.length} pregões no histórico (${novos} novos).`)
  return { publicado: true, snapshot, historico }
}

/** acoes.json legível no GitHub: uma empresa por linha dentro de cada setor. */
export function formatarAcoes(snapshot) {
  const { setores, busca, ...resto } = snapshot
  const topo = Object.entries(resto).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  const blocoSetores = setores.length
    ? `[\n${setores
        .map(
          (s) =>
            `    {"setor": ${JSON.stringify(s.setor)}, "grupoB3": ${JSON.stringify(s.grupoB3)}, "empresas": [\n${s.empresas.map((e) => `      ${JSON.stringify(e)}`).join(',\n')}\n    ]}`,
        )
        .join(',\n')}\n  ]`
    : '[]'
  const blocoBusca = busca.length ? `[\n${busca.map((b) => `    ${JSON.stringify(b)}`).join(',\n')}\n  ]` : '[]'
  return `{\n${[...topo, `  "setores": ${blocoSetores}`, `  "busca": ${blocoBusca}`].join(',\n')}\n}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
