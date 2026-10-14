// Atualização diária dos dados da aba de BDRs (decisões D19 e D24).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-bdrs.yml), às 22h30 de
// Brasília, ou manualmente:
//   BRAPI_TOKEN=... node scripts/atualizar-bdrs.mjs                     (dia a dia)
//   BRAPI_TOKEN=... node scripts/atualizar-bdrs.mjs --carga-inicial=260 (uma vez, histórico)
//
// D24 (27/09/2026): preço e volume saem da brapi e passam a vir do Boletim de Preços oficial
// da B3 (scripts/b3-boletim.mjs, o mesmo leitor dos ETFs, D23), sem cota. A brapi fica só para
// o que a B3 não traz, com teto mensal próprio e cache no histórico:
//   - nome e setor: listagem de BDRs (1 requisição), no máximo uma vez por semana;
//   - proporção BDR/ação e nome longo: 1 requisição por BDR da lista, a cada 60 dias, ou antes
//     se o preço der um salto de desdobramento.
// Sem token, com a cota esgotada ou com a brapi fora do ar, o job publica do mesmo jeito,
// com o cadastro guardado.
//
// Histórico próprio (historico/bdrs.json):
//   - série longa (até 260 pregões) só dos BDRs "acompanhados": os mais negociados de cada
//     tipo, com folga sobre a lista publicada. Deles saem a variação de 3 meses e a faixa de
//     52 semanas;
//   - série curta (21 pregões) dos demais, o suficiente para o volume médio e a busca;
//   - séries alinhadas pela DIREITA: o último valor de cada série é o último pregão; o que
//     falta no começo é "sem dado". Assim uma série curta não ocupa 260 posições.
//
// Desdobramentos: o boletim traz preço bruto, sem ajuste. Um salto de preço de um pregão para
// o outro (queda de 45% ou mais, ou alta de 80% ou mais) é tratado como possível desdobramento
// ou grupamento: o BDR sai publicado sem variação de 3 meses e sem faixa de 52 semanas até o
// responsável confirmar o evento em "desdobramentos" (config/bdrs.json), e o log mostra a
// linha [desdobramento]. Confirmado, os preços anteriores são ajustados no cálculo (o histórico
// guardado continua bruto).
//
// Telas estritamente descritivas (D19): sem múltiplos de avaliação, sem ranking de "melhor";
// a ordem é sempre por volume.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, dataEmBrasilia, datasCandidatas, lerBoletim } from './b3-boletim.mjs'
import { datasAProcessar } from './atualizar-etfs.mjs'
import { formatarSnapshot } from './atualizar-rendimentos-fii.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const URL_LISTA = 'https://brapi.dev/api/quote/list?type=bdr&limit=1000&sortBy=volume&sortOrder=desc'
const URL_COTACAO = (ticker) => `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`

export const SESSOES_LIQUIDEZ = 21 // mesma régua dos FIIs (D13) e dos ETFs (D23)
export const SESSOES_3_MESES = 63
export const SESSOES_52_SEMANAS = 252
export const MINIMO_PARA_52_SEMANAS = 240
export const MAXIMO_PREGOES_GUARDADOS = 260
export const FONTE = 'B3 - Boletim de Preços (BVBG.086)'

const PRECO_MIN = 0.1
const PRECO_MAX = 10_000
const VARIACAO_MIN_PCT = -90
const VARIACAO_MAX_PCT = 500
// Salto entre dois fechamentos seguidos que pede confirmação de desdobramento/grupamento.
const SALTO_QUEDA = 0.55 // preço novo até 55% do anterior (queda de 45% ou mais)
const SALTO_ALTA = 1.8 // preço novo 80% ou mais acima do anterior

const arredondar = (valor, casas = 2) => (valor === null || valor === undefined ? null : Math.round(valor * 10 ** casas) / 10 ** casas)

// ---------------------------------------------------------------------------------------
// Classificação, nome e setor (regras da D19, mantidas)
// ---------------------------------------------------------------------------------------

/** 'acao' para códigos terminados em 31 a 35, 'etf' para 39, null para o resto. */
export function tipoPorCodigo(ticker) {
  const codigo = String(ticker ?? '').toUpperCase()
  if (/^[A-Z0-9]{4}3[1-5]$/.test(codigo)) return 'acao'
  if (/^[A-Z0-9]{4}39$/.test(codigo)) return 'etf'
  return null
}

/**
 * Raízes de contratos futuros e FRAs da B3 cujo código termina no ano de vencimento: DI1F31
 * (DI janeiro de 2031), FRCF31 (FRA de cupom), DAPK35 (cupom de IPCA). Com vencimento em 2031
 * a 2035 ou 2039, o código tem o mesmo formato de um BDR (4 caracteres + 31 a 35 ou 39) e o
 * boletim traz todos eles. Na primeira carga (27/09/2026) 18 futuros entraram na lista de BDRs.
 */
export const PREFIXOS_DERIVATIVOS = ['DI1', 'DAP', 'DDI', 'DCO', 'FRC', 'FRO', 'FRP', 'IAP', 'IDI', 'DOL', 'WDO', 'IND', 'WIN', 'ISP', 'WSP', 'CCM', 'BGI', 'ICF', 'SJC', 'ETH', 'BIT', 'SOL']

/** Código de derivativo pela raiz (lista fixa + a do config). */
export function ehDerivativo(ticker, config = {}) {
  const prefixos = [...PREFIXOS_DERIVATIVOS, ...(config.derivativos?.prefixos ?? [])]
  return prefixos.some((p) => ticker.startsWith(p))
}

/** BDR que apareceu na listagem de BDRs da brapi (marca nova ou setor gravado pela listagem). */
export function naListagem(entrada) {
  return Boolean(entrada && (entrada.listado === true || 'setorBrapi' in entrada))
}

/**
 * Filtro de BDR: formato do código, fora das raízes de derivativos e, quando o cadastro já tem
 * a listagem da brapi, presente nela (segunda barreira contra qualquer outro instrumento com o
 * mesmo formato). Sem listagem nenhuma (nunca houve brapi), vale só o formato e as raízes.
 * Devolve 'acao', 'etf' ou null.
 */
export function criarFiltroBdr(cadastro, config = {}) {
  const exigirListagem = Object.values(cadastro ?? {}).some(naListagem)
  return (ticker) => {
    const tipo = tipoPorCodigo(ticker)
    if (!tipo || ehDerivativo(ticker, config)) return null
    if (exigirListagem && !naListagem(cadastro[ticker])) return null
    return tipo
  }
}

/** Códigos 31, 32 e 33 costumam ser de empresas com vínculo brasileiro: pedem decisão manual. */
export function precisaRevisar(ticker, excluir = [], revisados = []) {
  return /3[123]$/.test(ticker) && !excluir.includes(ticker) && !revisados.includes(ticker)
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

/** Nome exibido: correção manual, nome longo da brapi, nome da listagem ou nada. */
export function nomeDe(ticker, cadastro, config) {
  return config.nomes?.[ticker] ?? cadastro?.nome ?? cadastro?.nomeLista ?? null
}

// ---------------------------------------------------------------------------------------
// Histórico próprio (séries alinhadas pela direita)
// ---------------------------------------------------------------------------------------

/** Histórico vazio no formato do arquivo historico/bdrs.json. */
export function historicoVazio() {
  return { pregoes: [], acompanhados: [], ativos: {}, ultimoNegocio: {}, cadastro: {}, brapi: { mes: null, requisicoes: 0, ultimaListagem: null } }
}

/** Completa campos que faltem (arquivo antigo, parcial ou ausente). */
export function normalizarHistorico(bruto) {
  const vazio = historicoVazio()
  if (!bruto || typeof bruto !== 'object') return vazio
  return {
    pregoes: Array.isArray(bruto.pregoes) ? bruto.pregoes : [],
    acompanhados: Array.isArray(bruto.acompanhados) ? bruto.acompanhados : [],
    ativos: bruto.ativos ?? {},
    ultimoNegocio: bruto.ultimoNegocio ?? {},
    cadastro: bruto.cadastro ?? {},
    brapi: { ...vazio.brapi, ...(bruto.brapi ?? {}) },
  }
}

/** Valor guardado de um instrumento do boletim: [fechamento, mínima, máxima, volume] ou null. */
function valorDoPregao(item) {
  if (!item || !(item.fechamento > 0)) return null
  return [item.fechamento, item.minima ?? item.fechamento, item.maxima ?? item.fechamento, Math.round(item.volume ?? 0)]
}

/**
 * Inclui (ou substitui) o pregão `data` no histórico. `instrumentos` é o Map do boletim (só
 * BDRs). Funciona para o pregão novo do dia (fim da série), para a carga inicial (pregões mais
 * antigos, no começo) e para um buraco no meio. Mantém só os `maximo` pregões mais recentes.
 */
export function incorporarPregao(historico, data, instrumentos, maximo = MAXIMO_PREGOES_GUARDADOS) {
  const pregoes = [...historico.pregoes]
  const ativos = Object.fromEntries(Object.entries(historico.ativos).map(([t, s]) => [t, [...s]]))
  const ultimoNegocio = { ...historico.ultimoNegocio }
  const n = pregoes.length
  let indice = pregoes.indexOf(data)
  const novo = indice === -1
  if (novo) {
    indice = pregoes.findIndex((p) => p > data)
    if (indice === -1) indice = n
  }
  // Posição a partir da direita: quantos pregões ficam depois do ponto de inserção.
  const daDireita = novo ? n - indice : n - 1 - indice
  const tickers = new Set([...Object.keys(ativos), ...instrumentos.keys()])
  for (const ticker of tickers) {
    const valor = valorDoPregao(instrumentos.get(ticker))
    const serie = ativos[ticker] ?? []
    if (!serie.length && !valor) continue // sem série e sem negócio: nada a guardar
    if (!novo) {
      // Pregão já guardado: substitui, se a série alcança esse pregão.
      if (serie.length > daDireita) serie[serie.length - 1 - daDireita] = valor
      else if (valor) serie.unshift(valor, ...Array(daDireita - serie.length).fill(null))
    } else if (serie.length >= daDireita) {
      serie.splice(serie.length - daDireita, 0, valor)
    } else if (valor) {
      // A série começa depois deste pregão: só estende se houve negócio.
      serie.unshift(valor, ...Array(daDireita - serie.length).fill(null))
    }
    if (serie.length) ativos[ticker] = serie
    if (valor && (!ultimoNegocio[ticker] || data >= ultimoNegocio[ticker][0])) ultimoNegocio[ticker] = [data, arredondar(valor[0])]
  }
  if (novo) pregoes.splice(indice, 0, data)
  const corte = Math.max(0, pregoes.length - maximo)
  const restantes = pregoes.slice(corte)
  for (const [ticker, serie] of Object.entries(ativos)) {
    if (serie.length > restantes.length) ativos[ticker] = serie.slice(-restantes.length)
  }
  return { ...historico, pregoes: restantes, ativos, ultimoNegocio }
}

/** Datas dos pregões cobertos por uma série alinhada pela direita. */
function datasDaSerie(pregoes, serie) {
  return pregoes.slice(pregoes.length - serie.length)
}

/**
 * Aplica os desdobramentos confirmados: `eventos` = [{ data, fator }], com `fator` = BDRs novos
 * para cada BDR antigo (desdobramento 1:10 → 10; grupamento 10:1 → 0.1). Os preços ANTES da
 * data são divididos pelo fator; o volume em reais não muda.
 */
export function aplicarDesdobramentos(serie, datas, eventos = []) {
  const validos = eventos.filter((e) => e && typeof e.data === 'string' && e.fator > 0)
  if (!validos.length) return serie
  return serie.map((v, i) => {
    if (!v) return v
    const fator = validos.filter((e) => datas[i] < e.data).reduce((f, e) => f * e.fator, 1)
    return fator === 1 ? v : [v[0] / fator, v[1] / fator, v[2] / fator, v[3]]
  })
}

/** Fator sugerido para um salto (preço anterior / preço novo), arredondado ao inteiro mais próximo. */
export function fatorSugerido(anterior, atual) {
  const razao = anterior / atual
  return razao >= 1 ? Math.round(razao) : arredondar(1 / Math.round(1 / razao), 4)
}

/**
 * Saltos de preço entre dois fechamentos seguidos (pulando dias sem negócio) nos últimos
 * `janela` pregões: possíveis desdobramentos ou grupamentos ainda não confirmados.
 */
export function detectarSaltos(serie, datas, janela = SESSOES_52_SEMANAS) {
  const saltos = []
  let anterior = null
  const inicio = Math.max(0, serie.length - janela - 1)
  for (let i = inicio; i < serie.length; i++) {
    const v = serie[i]
    if (!v) continue
    if (anterior && i >= serie.length - janela) {
      const razao = v[0] / anterior[0]
      if (razao <= SALTO_QUEDA || razao >= SALTO_ALTA) {
        saltos.push({ data: datas[i], de: arredondar(anterior[0]), para: arredondar(v[0]), fator: fatorSugerido(anterior[0], v[0]), indiceDaDireita: serie.length - 1 - i })
      }
    }
    anterior = v
  }
  return saltos
}

/** Volume médio (R$) dos últimos 21 pregões; dia sem negócio conta como zero (régua da D23). */
export function volumeMedio(serie, totalPregoes) {
  const janela = Math.min(SESSOES_LIQUIDEZ, totalPregoes)
  if (!serie || janela === 0) return 0
  return Math.round(serie.slice(-janela).reduce((soma, v) => soma + (v ? v[3] : 0), 0) / janela)
}

/**
 * Números de um BDR a partir do histórico, já com os desdobramentos confirmados. Salto não
 * confirmado dentro da janela apaga a variação de 3 meses e/ou a faixa de 52 semanas.
 */
export function metricas(historico, ticker, config = {}) {
  const bruta = historico.ativos[ticker]
  const pregoes = historico.pregoes
  if (!bruta || !bruta.length || pregoes.length === 0) return null
  const datas = datasDaSerie(pregoes, bruta)
  const serie = aplicarDesdobramentos(bruta, datas, config.desdobramentos?.[ticker])
  let ultimo = -1
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i]) {
      ultimo = i
      break
    }
  }
  if (ultimo === -1) return null

  const saltos = detectarSaltos(serie, datas)
  const saltoEm = (pregoesAtras) => saltos.some((s) => s.indiceDaDireita < pregoesAtras)

  let variacao3m = null
  const alvo = serie.length - 1 - SESSOES_3_MESES
  if (alvo >= 0 && !saltoEm(SESSOES_3_MESES + 1)) {
    let base = null
    for (let i = alvo; i >= 0 && base === null; i--) if (serie[i]) base = serie[i][0]
    if (base > 0) variacao3m = arredondar((serie[ultimo][0] / base - 1) * 100, 1)
  }

  let minima52 = null
  let maxima52 = null
  if (pregoes.length >= MINIMO_PARA_52_SEMANAS && serie.length >= MINIMO_PARA_52_SEMANAS && !saltoEm(SESSOES_52_SEMANAS)) {
    const ano = serie.slice(-SESSOES_52_SEMANAS).filter(Boolean)
    minima52 = arredondar(Math.min(...ano.map((v) => v[1])))
    maxima52 = arredondar(Math.max(...ano.map((v) => v[2])))
  }

  return {
    cotacao: arredondar(serie[ultimo][0]),
    dataCotacao: datas[ultimo],
    variacao3m,
    volumeMedio: volumeMedio(serie, pregoes.length),
    minima52,
    maxima52,
    saltos,
  }
}

/** Item publicado e o que faltou (para o log). */
export function montarItem(ticker, tipo, historico, config) {
  const numeros = metricas(historico, ticker, config)
  if (!numeros) return null
  const cadastro = historico.cadastro[ticker]
  const { setor, semMapa } = setorDe(ticker, tipo, cadastro?.setorBrapi ?? null, config)
  const { saltos, ...resto } = numeros
  return {
    item: {
      ticker,
      nome: nomeDe(ticker, cadastro, config) ?? ticker,
      setor,
      cotacao: resto.cotacao,
      dataCotacao: resto.dataCotacao,
      variacao3m: resto.variacao3m,
      volumeMedio: resto.volumeMedio,
      minima52: resto.minima52,
      maxima52: resto.maxima52,
      acoesPorBdr: cadastro?.acoesPorBdr ?? null,
    },
    semMapa,
    semNome: nomeDe(ticker, cadastro, config) === null,
    saltos,
  }
}

/** Motivo para não publicar um BDR, ou null se o dado for plausível. */
export function motivoInvalido(item) {
  if (!(item.cotacao >= PRECO_MIN && item.cotacao <= PRECO_MAX)) return `cotação fora da faixa plausível (${item.cotacao})`
  if (!(item.volumeMedio > 0)) return 'sem volume nos últimos 21 pregões'
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

/**
 * BDRs com série longa: os `acompanharAcoes`/`acompanharEtfs` de maior volume médio, mais os
 * de controle e os publicados. Quem já era acompanhado só sai se cair abaixo do dobro do
 * limite (folga, para a série não ser cortada por uma semana fraca).
 */
export function atualizarAcompanhados(historico, config, obrigatorios = []) {
  const excluir = new Set(config.excluir?.tickers ?? [])
  const limites = { acao: config.acompanharAcoes ?? 150, etf: config.acompanharEtfs ?? 40 }
  const porTipo = { acao: [], etf: [] }
  const filtro = criarFiltroBdr(historico.cadastro, config)
  for (const [ticker, serie] of Object.entries(historico.ativos)) {
    const tipo = filtro(ticker)
    if (!tipo || excluir.has(ticker)) continue
    porTipo[tipo].push({ ticker, volume: volumeMedio(serie, historico.pregoes.length) })
  }
  const anteriores = new Set(historico.acompanhados)
  const escolhidos = new Set(obrigatorios.filter((t) => !excluir.has(t) && filtro(t)))
  for (const tipo of ['acao', 'etf']) {
    const ordem = porTipo[tipo].filter((x) => x.volume > 0).sort((a, b) => b.volume - a.volume || a.ticker.localeCompare(b.ticker))
    ordem.forEach((x, posicao) => {
      if (posicao < limites[tipo] || (anteriores.has(x.ticker) && posicao < 2 * limites[tipo])) escolhidos.add(x.ticker)
    })
  }
  return [...escolhidos].sort()
}

/**
 * Corta as séries dos BDRs não acompanhados para os últimos `janelaCurta` pregões e apaga o
 * que ficou sem nenhum negócio. O último negócio de cada BDR fica em `ultimoNegocio` enquanto
 * estiver dentro do histórico; o cadastro, enquanto o BDR tiver algum dado guardado.
 */
export function compactar(historico, acompanhados, janelaCurta = SESSOES_LIQUIDEZ, config = {}) {
  const longos = new Set(acompanhados)
  const ativos = {}
  for (const [ticker, serie] of Object.entries(historico.ativos)) {
    if (ehDerivativo(ticker, config)) continue
    const guardada = longos.has(ticker) ? serie : serie.slice(-janelaCurta)
    if (guardada.some(Boolean)) ativos[ticker] = guardada
  }
  const primeiro = historico.pregoes[0] ?? ''
  const ultimoNegocio = Object.fromEntries(Object.entries(historico.ultimoNegocio).filter(([t, [data]]) => data >= primeiro && !ehDerivativo(t, config)))
  const cadastro = Object.fromEntries(Object.entries(historico.cadastro).filter(([t]) => ativos[t] || ultimoNegocio[t]))
  return { ...historico, acompanhados: [...longos].filter((t) => ativos[t]).sort(), ativos, ultimoNegocio, cadastro }
}

/**
 * Lista de busca: todos os BDRs (menos os excluídos) com negócio nos últimos `pregoesBusca`
 * pregões, com o preço e a data do último negócio e o volume do último pregão.
 */
export function montarBusca(historico, config) {
  const excluir = new Set(config.excluir?.tickers ?? [])
  const pregoes = historico.pregoes
  const limite = pregoes[Math.max(0, pregoes.length - (config.pregoesBusca ?? 63))] ?? ''
  const filtro = criarFiltroBdr(historico.cadastro, config)
  const busca = []
  for (const [ticker, [data, cotacao]] of Object.entries(historico.ultimoNegocio)) {
    const tipo = filtro(ticker)
    if (!tipo || excluir.has(ticker) || data < limite || !(cotacao >= PRECO_MIN && cotacao <= PRECO_MAX)) continue
    const serie = historico.ativos[ticker]
    const ultimoPregao = serie && serie.length ? serie[serie.length - 1] : null
    busca.push({
      ticker,
      tipo,
      nome: nomeDe(ticker, historico.cadastro[ticker], config),
      setor: setorDe(ticker, tipo, historico.cadastro[ticker]?.setorBrapi ?? null, config).setor,
      cotacao,
      dataCotacao: data,
      volumeDia: ultimoPregao ? ultimoPregao[3] : 0,
    })
  }
  return busca.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

// ---------------------------------------------------------------------------------------
// Cadastro pela brapi (nome, setor, proporção), com teto mensal
// ---------------------------------------------------------------------------------------

/** Consumo do mês corrente (zera na virada do mês). */
export function consumoDoMes(brapi, hoje) {
  const mes = hoje.slice(0, 7)
  return brapi?.mes === mes ? { ...brapi } : { ...brapi, mes, requisicoes: 0 }
}

/** Dias corridos entre duas datas AAAA-MM-DD. */
export function diasEntre(de, ate) {
  if (!de || !ate) return Infinity
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

/** Atualiza nome da listagem e setor de todos os BDRs a partir da listagem da brapi. */
export function aplicarListagem(cadastro, lista) {
  const novo = { ...cadastro }
  for (const item of lista) {
    const ticker = String(item?.stock ?? '').toUpperCase()
    if (!tipoPorCodigo(ticker)) continue
    const nomeLista = String(item?.name ?? '').trim()
    novo[ticker] = {
      ...novo[ticker],
      listado: true,
      nomeLista: nomeLista && nomeLista.toUpperCase() !== ticker ? nomeLista : novo[ticker]?.nomeLista ?? null,
      setorBrapi: item?.sector ?? novo[ticker]?.setorBrapi ?? null,
    }
  }
  return novo
}

/**
 * BDRs publicados que precisam de consulta individual (nome longo e proporção), em ordem de
 * prioridade: salto de preço depois da última consulta, nunca consultados, consulta mais
 * antiga que `diasValidade`. `suspeitos` = { ticker: data do salto mais recente }.
 */
export function filaDeConsultas(publicados, cadastro, suspeitos, hoje, diasValidade, maximo) {
  const itens = publicados.map((ticker) => {
    const quando = cadastro[ticker]?.proporcaoEm ?? null
    const idade = diasEntre(quando, hoje)
    const salto = suspeitos[ticker]
    const prioridade = salto && (!quando || quando < salto) ? 0 : !quando ? 1 : idade >= diasValidade ? 2 : null
    return { ticker, prioridade, idade }
  })
  return itens
    .filter((x) => x.prioridade !== null)
    .sort((a, b) => a.prioridade - b.prioridade || b.idade - a.idade || a.ticker.localeCompare(b.ticker))
    .slice(0, Math.max(0, maximo))
    .map((x) => x.ticker)
}

/** Grava o resultado da consulta individual. Devolve o cadastro novo e a mudança de proporção. */
export function aplicarConsulta(cadastro, ticker, resultado, hoje) {
  const anterior = cadastro[ticker] ?? {}
  const nomeLongo = resultado?.longName ?? null
  const acoesPorBdr = extrairProporcao(nomeLongo) ?? anterior.acoesPorBdr ?? null
  const nome = nomeLongo ? extrairNome(nomeLongo, ticker) : anterior.nome ?? null
  const mudou = anterior.acoesPorBdr != null && acoesPorBdr != null && anterior.acoesPorBdr !== acoesPorBdr ? { de: anterior.acoesPorBdr, para: acoesPorBdr } : null
  return {
    cadastro: { ...cadastro, [ticker]: { ...anterior, nome: nome && nome !== ticker ? nome : anterior.nome ?? null, acoesPorBdr, proporcaoEm: hoje } },
    mudou,
  }
}

// ---------------------------------------------------------------------------------------
// Arquivo do histórico
// ---------------------------------------------------------------------------------------

/** Histórico em texto: um BDR por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico) {
  const bloco = (objeto) =>
    Object.keys(objeto)
      .sort()
      .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(objeto[t])}`)
      .join(',\n')
  return [
    '{',
    '  "_leia": "Histórico próprio dos BDRs (decisão D24), gerado por scripts/atualizar-bdrs.mjs a partir do Boletim de Preços da B3. Séries alinhadas pela DIREITA: o último valor de cada série é o último pregão de \\"pregoes\\"; o que falta no começo é sem dado. Cada valor: [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Série longa (até 260 pregões) só dos \\"acompanhados\\"; os demais guardam 21. Preços brutos, sem ajuste de desdobramento (os ajustes ficam em config/bdrs.json). \\"cadastro\\": nome, setor e proporção vindos da brapi; \\"brapi\\": consumo do mês. Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "acompanhados": ${JSON.stringify(historico.acompanhados)},`,
    `  "brapi": ${JSON.stringify(historico.brapi)},`,
    `  "cadastro": {\n${bloco(historico.cadastro)}\n  },`,
    `  "ultimoNegocio": {\n${bloco(historico.ultimoNegocio)}\n  },`,
    `  "ativos": {\n${bloco(historico.ativos)}\n  }`,
    '}',
    '',
  ].join('\n')
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

async function chamarBrapiReal(url, token) {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
  if (!resposta.ok) throw new ErroBrapi(`brapi respondeu ${resposta.status}`, resposta.status)
  return resposta.json()
}

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
 * Fase da brapi: nunca derruba o job. Atualiza o cadastro (listagem semanal e consultas dos
 * publicados) dentro do teto mensal e devolve o histórico com o cadastro e o consumo novos.
 */
async function atualizarCadastro(historico, publicados, suspeitos, { token, hoje, config, carga, chamar, esperar, log }) {
  const regras = config.brapi ?? {}
  const teto = regras.tetoMensal ?? 80
  let consumo = consumoDoMes(historico.brapi, hoje)
  let cadastro = historico.cadastro
  const resumo = () => ({ ...historico, cadastro, brapi: consumo })
  if (!token) {
    log.warn('[aviso] BRAPI_TOKEN não definido: nomes, setores e proporções seguem os guardados no histórico.')
    return resumo()
  }
  const podeGastar = () => consumo.requisicoes < teto
  const tratarErro = (erro, onde) => {
    if (erro instanceof ErroBrapi && (erro.status === 401 || erro.status === 403)) {
      log.warn(`[aviso] brapi respondeu ${erro.status} (${onde}): chave inválida ou plano sem acesso. Nomes e setores seguem os guardados.`)
      return 'parar'
    }
    if (erro instanceof ErroBrapi && erro.status === 429) {
      log.warn(`[aviso] brapi respondeu 429 (${onde}): limite atingido. O resto fica para a próxima execução.`)
      return 'parar'
    }
    log.warn(`[aviso] brapi indisponível (${onde}): ${erro.message}.`)
    return 'seguir'
  }

  const listagemVencida = diasEntre(consumo.ultimaListagem, hoje) >= (regras.diasEntreListagens ?? 7) || Object.keys(cadastro).length === 0
  if (listagemVencida) {
    if (!podeGastar()) {
      log.warn(`[aviso] Teto mensal da brapi para BDRs atingido (${consumo.requisicoes}/${teto}): listagem adiada.`)
      return resumo()
    }
    try {
      consumo.requisicoes++
      const corpo = await chamar(URL_LISTA, token)
      const lista = (corpo?.stocks ?? []).filter((s) => s?.type === 'bdr')
      if (lista.length >= (regras.minimoNaListagem ?? 300)) {
        cadastro = aplicarListagem(cadastro, lista)
        consumo.ultimaListagem = hoje
        log.info(`[info] Listagem da brapi: ${lista.length} BDRs (nome e setor atualizados).`)
      } else {
        log.warn(`[aviso] Listagem da brapi com só ${lista.length} BDRs: cadastro mantido.`)
      }
    } catch (erro) {
      if (tratarErro(erro, 'listagem') === 'parar') return resumo()
    }
  }

  const maximo = Math.min(carga > 0 ? regras.maxConsultasCargaInicial ?? 45 : regras.maxConsultasPorExecucao ?? 6, teto - consumo.requisicoes)
  const fila = filaDeConsultas(publicados, cadastro, suspeitos, hoje, regras.diasValidadeProporcao ?? 60, maximo)
  let feitas = 0
  for (const ticker of fila) {
    if (!podeGastar()) break
    try {
      consumo.requisicoes++
      const resultado = (await chamar(URL_COTACAO(ticker), token))?.results?.[0]
      const aplicado = aplicarConsulta(cadastro, ticker, resultado, hoje)
      cadastro = aplicado.cadastro
      feitas++
      if (aplicado.mudou) {
        log.info(`[proporcao] ${ticker}: a brapi passou de ${aplicado.mudou.de} para ${aplicado.mudou.para} ação por BDR. Se houve desdobramento ou grupamento, confira a linha [desdobramento] e confirme em "desdobramentos" (config/bdrs.json).`)
      }
    } catch (erro) {
      if (tratarErro(erro, ticker) === 'parar') break
    }
    await esperar(regras.pausaEntreRequisicoesMs ?? 300)
  }
  const pendentes = filaDeConsultas(publicados, cadastro, {}, hoje, regras.diasValidadeProporcao ?? 60, Infinity).length
  log.info(`[info] brapi: ${consumo.requisicoes} de ${teto} requisições no mês (${feitas} consultas nesta execução${pendentes ? `, ${pendentes} BDRs da lista ainda sem proporção atualizada` : ''}).`)
  return resumo()
}

/**
 * Execução completa. As dependências de rede entram por parâmetro para o teste de ponta a
 * ponta (atualizar-bdrs.test.mjs) rodar sem internet.
 */
export async function executar({
  raiz = RAIZ_PADRAO,
  agora = new Date(),
  argv = process.argv,
  token = process.env.BRAPI_TOKEN,
  baixar = baixarBoletim,
  ler = lerBoletim,
  chamar = chamarBrapiReal,
  esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = { info: console.log, warn: console.warn },
} = {}) {
  const arquivoConfig = path.join(raiz, 'config', 'bdrs.json')
  const arquivoHistorico = path.join(raiz, 'historico', 'bdrs.json')
  const arquivoSaida = path.join(raiz, 'webapp-src', 'src', 'data', 'bdrs.json')
  const gravarHistorico = (h) => {
    fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
    fs.writeFileSync(arquivoHistorico, formatarHistorico(h))
  }

  const config = JSON.parse(fs.readFileSync(arquivoConfig, 'utf8'))
  if (config.conferidoPeloResponsavel !== true) {
    throw new Error('config/bdrs.json ainda não foi conferido. Revise as listas de exclusão e marque "conferidoPeloResponsavel": true.')
  }
  const carga = argumentoCarga(argv)
  const hoje = dataEmBrasilia(agora)
  let historico = normalizarHistorico(lerJson(arquivoHistorico, null))

  // 1. Boletins da B3 que faltam no histórico
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim ?? 5
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bdrs-b3-'))
  let novos = 0
  let semPregao = 0
  // Data sem resposta da B3 (tempo esgotado ou erro) não bloqueia o job se uma data MAIS NOVA
  // responder: feriado que a B3 não atende não pode travar os pregões seguintes (12/10/2026).
  // Se a mais recente não responde, o job falha como antes.
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
        if (carga === 0 && data !== faltam[faltam.length - 1]) {
          log.warn(`[aviso] ${data}: ${erro.message} Data antiga ignorada se uma mais nova responder.`)
          continue
        }
        falhar(`${data}: ${erro.message}`)
        continue
      }
      if (!xml) {
        semPregao++
        log.info(`[info] ${data}: sem pregão na B3 (zip vazio).`)
        continue
      }
      const lido = await ler(xml, (t) => tipoPorCodigo(t) !== null && !ehDerivativo(t, config))
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      if (lido.datas.length !== 1 || lido.datas[0] !== data) {
        falhar(`${data}: o boletim trouxe a(s) data(s) ${lido.datas.join(', ') || 'nenhuma'}.`)
        continue
      }
      const negociados = [...lido.instrumentos.values()].filter((i) => i.fechamento > 0).length
      if (negociados < config.minimoBdrsNegociadosNoBoletim) {
        falhar(`${data}: só ${negociados} BDRs negociados no boletim (mínimo ${config.minimoBdrsNegociadosNoBoletim}).`)
        continue
      }
      historico = incorporarPregao(historico, data, lido.instrumentos)
      novos++
      log.info(`[info] ${data}: ${negociados} BDRs negociados de ${lido.instrumentos.size} no boletim (${((Date.now() - inicio) / 1000).toFixed(1)} s).`)
      if (carga > 0) {
        // Grava a cada 20 pregões: se a execução for interrompida, o workflow publica o que já veio.
        if (novos % 20 === 0) {
          gravarHistorico(historico)
          log.info(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  if (carga > 0 && novos > 0) {
    gravarHistorico(historico)
    log.info(`[info] Histórico gravado: ${historico.pregoes.length} pregões (${novos} novos nesta carga).`)
    if (historico.pregoes.length < config.minimoPregoesHistorico) {
      log.warn(`[aviso] Ainda são só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico} para publicar). Rode a carga inicial de novo: ela continua de onde parou. bdrs.json NÃO atualizado.`)
      return { publicado: false, motivo: 'carga incompleta' }
    }
  }

  // O arquivo antigo, da brapi, não tem "fonte": é trocado já na primeira execução possível.
  const saidaAtual = lerJson(arquivoSaida, null)
  const filtroSaida = criarFiltroBdr(historico.cadastro, config)
  const publicadosAntes = [...(saidaAtual?.acoes ?? []), ...(saidaAtual?.etfs ?? []), ...(saidaAtual?.busca ?? [])]
  const recusados = publicadosAntes.filter((i) => !filtroSaida(i.ticker) || (config.excluir?.tickers ?? []).includes(i.ticker))
  if (recusados.length) {
    log.info(`[info] O arquivo publicado tem ${recusados.length} códigos que não passam no filtro atual (ex.: ${recusados.slice(0, 3).map((i) => i.ticker).join(', ')}): será regravado.`)
  }
  if (novos === 0 && saidaAtual?.dataPregao && saidaAtual?.fonte === FONTE && recusados.length === 0) {
    log.info(`Sem pregão novo desde ${historico.pregoes[historico.pregoes.length - 1] ?? 'nenhum'}${semPregao ? ' (feriado ou fim de semana)' : ''}: arquivos mantidos.`)
    return { publicado: false, motivo: 'sem pregão novo' }
  }

  // 2. Travas sobre o histórico
  if (historico.pregoes.length < config.minimoPregoesHistorico) {
    throw new Error(`O histórico tem só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico}). Rode a carga inicial (workflow "Carga inicial de BDRs"). Arquivo NÃO atualizado.`)
  }
  const dataPregao = historico.pregoes[historico.pregoes.length - 1]
  const diasDesdePregao = (agora.getTime() - Date.parse(`${dataPregao}T21:00:00Z`)) / 86_400_000
  if (diasDesdePregao > 7) {
    throw new Error(`O pregão mais recente do histórico é de ${dataPregao}, mais de 7 dias atrás. Arquivo NÃO atualizado.`)
  }

  // 3. Números de todos os BDRs, validação e seleção (só volume: não depende da brapi)
  const excluir = new Set(config.excluir?.tickers ?? [])
  const itens = { acao: [], etf: [] }
  const saltosPorTicker = new Map()
  const invalidos = []
  const filtroBdr = criarFiltroBdr(historico.cadastro, config)
  for (const ticker of Object.keys(historico.ativos)) {
    const tipo = filtroBdr(ticker)
    if (!tipo || excluir.has(ticker)) continue
    const montado = montarItem(ticker, tipo, historico, config)
    if (!montado) continue
    const motivo = motivoInvalido(montado.item)
    if (motivo) {
      if (montado.item.volumeMedio >= Math.min(config.pisoVolumeAcoes, config.pisoVolumeEtfs)) invalidos.push(`${ticker}: ${motivo}`)
      continue
    }
    if (montado.saltos.length) saltosPorTicker.set(ticker, montado.saltos)
    itens[tipo].push(montado.item)
  }
  for (const linha of invalidos) log.info(`[info] ${linha}`)

  const controle = config.controle?.tickers ?? []
  const todos = [...itens.acao, ...itens.etf]
  const controleOk = controle.filter((t) => todos.some((i) => i.ticker === t && i.dataCotacao === dataPregao))
  const minimoControle = config.controle?.minimo ?? controle.length
  if (controleOk.length < minimoControle) {
    throw new Error(`Só ${controleOk.length} de ${controle.length} BDRs de controle negociaram em ${dataPregao} com dado válido (mínimo ${minimoControle}). Arquivo NÃO atualizado.`)
  }
  let acoes = selecionar(itens.acao, config.maxAcoes, config.pisoVolumeAcoes)
  let etfs = selecionar(itens.etf, config.maxEtfs, config.pisoVolumeEtfs)
  if (acoes.length < config.minimoAcoesParaPublicar) {
    throw new Error(`Só ${acoes.length} BDRs de ações passaram no piso de liquidez (mínimo ${config.minimoAcoesParaPublicar}). Arquivo NÃO atualizado.`)
  }
  if (etfs.length < config.minimoEtfsParaPublicar) {
    throw new Error(`Só ${etfs.length} BDRs de ETF passaram no piso de liquidez (mínimo ${config.minimoEtfsParaPublicar}). Arquivo NÃO atualizado.`)
  }

  // 4. Cadastro pela brapi (nunca derruba o job) e itens completados com ele
  const publicados = [...acoes, ...etfs].map((i) => i.ticker)
  const suspeitos = Object.fromEntries(publicados.filter((t) => saltosPorTicker.has(t)).map((t) => [t, saltosPorTicker.get(t).at(-1).data]))
  historico = await atualizarCadastro(historico, publicados, suspeitos, { token, hoje, config, carga, chamar, esperar, log })
  // A listagem pode ter chegado agora (primeira execução): refaz a lista só com o que ela
  // confirma como BDR. Foi assim que 18 futuros entraram na primeira carga real.
  const filtroFinal = criarFiltroBdr(historico.cadastro, config)
  const antes = publicados.length
  acoes = selecionar(itens.acao.filter((i) => filtroFinal(i.ticker)), config.maxAcoes, config.pisoVolumeAcoes)
  etfs = selecionar(itens.etf.filter((i) => filtroFinal(i.ticker)), config.maxEtfs, config.pisoVolumeEtfs)
  const fora = publicados.filter((t) => !filtroFinal(t))
  if (fora.length) log.info(`[info] ${fora.length} de ${antes} códigos saíram da lista por não estarem na listagem de BDRs da brapi: ${fora.join(', ')}.`)
  if (acoes.length < config.minimoAcoesParaPublicar || etfs.length < config.minimoEtfsParaPublicar) {
    throw new Error(`Depois do filtro da listagem, sobraram ${acoes.length} BDRs de ações e ${etfs.length} de ETF (mínimos ${config.minimoAcoesParaPublicar} e ${config.minimoEtfsParaPublicar}). Arquivo NÃO atualizado.`)
  }
  const completar = (lista, tipo) => lista.map((i) => montarItem(i.ticker, tipo, historico, config))
  const acoesMontadas = completar(acoes, 'acao')
  const etfsMontados = completar(etfs, 'etf')
  acoes = acoesMontadas.map((m) => m.item)
  etfs = etfsMontados.map((m) => m.item)

  // 5. Logs de conferência (só dos publicados)
  const revisados = config.revisados?.tickers ?? []
  for (const t of historico.acompanhados.length ? historico.acompanhados : publicados) {
    if (tipoPorCodigo(t) === 'acao' && precisaRevisar(t, [...excluir], revisados)) {
      log.info(`[revisar] ${t}: código de BDR patrocinado (31 a 33). Se for empresa de origem ou operação brasileira, inclua em "excluir"; se não, em "revisados" (config/bdrs.json).`)
    }
  }
  for (const m of acoesMontadas) if (m.semMapa) log.info(`[setor] ${m.item.ticker} (${historico.cadastro[m.item.ticker]?.setorBrapi ?? 'sem setor'}): setor sem tradução em "setores" (config/bdrs.json).`)
  for (const m of etfsMontados) if (m.semMapa) log.info(`[categoria] ${m.item.ticker}: BDR de ETF sem grupo em "gruposEtf" (config/bdrs.json); aparece em "Outros".`)
  for (const m of [...acoesMontadas, ...etfsMontados]) if (m.semNome) log.info(`[nome] ${m.item.ticker}: ainda sem nome da brapi; a tela mostra só o código.`)
  for (const t of publicados) {
    for (const s of saltosPorTicker.get(t) ?? []) {
      log.info(`[desdobramento] ${t}: fechamento foi de R$ ${s.de} para R$ ${s.para} em ${s.data} (fator ≈ ${s.fator}). Se foi desdobramento ou grupamento, inclua em "desdobramentos" (config/bdrs.json): "${t}": [{ "data": "${s.data}", "fator": ${s.fator} }]. Até lá, o BDR sai sem variação de 3 meses e/ou faixa de 52 semanas.`)
    }
  }
  const porSetor = {}
  for (const i of acoes) porSetor[i.setor] = (porSetor[i.setor] ?? 0) + 1
  log.info(`[info] Setores: ${Object.entries(porSetor).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ')}.`)
  const reais = (v) => `R$ ${(v / 1e6).toFixed(1)} mi/dia`
  log.info(`[info] Mais negociados: ${acoes.slice(0, 3).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}. Menos negociados da lista: ${acoes.slice(-2).map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}.`)
  log.info(`[info] ETFs: ${etfs.map((i) => `${i.ticker} ${reais(i.volumeMedio)}`).join(', ')}.`)

  // 6. Séries longas só dos acompanhados, e gravação (histórico e arquivo do app juntos)
  const acompanhados = atualizarAcompanhados(historico, config, [...controle, ...publicados])
  historico = compactar(historico, acompanhados, SESSOES_LIQUIDEZ, config)
  const snapshot = {
    geradoEm: agora.toISOString(),
    dataPregao,
    fonte: FONTE,
    pregoesNoHistorico: historico.pregoes.length,
    sessoesLiquidez: SESSOES_LIQUIDEZ,
    criterio: { maxAcoes: config.maxAcoes, maxEtfs: config.maxEtfs, pisoVolumeAcoes: config.pisoVolumeAcoes, pisoVolumeEtfs: config.pisoVolumeEtfs },
    acoes,
    etfs,
    busca: montarBusca(historico, config),
  }
  gravarHistorico(historico)
  fs.writeFileSync(arquivoSaida, formatarSnapshot(snapshot))
  log.info(`bdrs.json atualizado: ${acoes.length} BDRs de ações e ${etfs.length} de ETF na lista, ${snapshot.busca.length} na busca, pregão de ${dataPregao}, ${historico.pregoes.length} pregões no histórico (${novos} novos, ${historico.acompanhados.length} com série longa).`)
  return { publicado: true, snapshot, historico }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
