// Composição teórica de um índice da B3 (IBOV, IFIX) com o peso de cada ativo (D72).
//
// A B3 publica a carteira do dia na mesma API que alimenta a página do índice no site dela
// (sistemaswebb3-listados.b3.com.br). Este módulo só sabe montar o endereço, baixar e LER a resposta,
// validando o formato: o cálculo do ranking (top15-mercado-calculo.mjs) recebe a lista já limpa.
import crypto from 'node:crypto'

export const INDICES = {
  IBOV: { nome: 'Ibovespa', segmento: '1' },
  IFIX: { nome: 'Índice de Fundos Imobiliários (IFIX)', segmento: '1' },
}

/** Endereço da carteira do dia: os parâmetros vão em JSON codificado em base64, como no site da B3. */
export function urlComposicao(indice, { pagina = 1, tamanho = 200 } = {}) {
  if (!INDICES[indice]) throw new Error(`Índice desconhecido: ${indice}. Use ${Object.keys(INDICES).join(' ou ')}.`)
  const parametros = { language: 'pt-br', pageNumber: pagina, pageSize: tamanho, index: indice, segment: INDICES[indice].segmento }
  return `https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/${Buffer.from(JSON.stringify(parametros)).toString('base64')}`
}

/** "2,256" → 2.256; "1.335.651.252" → 1335651252; vazio ou lixo → null. */
export function numeroBr(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  const t = String(texto ?? '').trim()
  if (!/^-?[\d.]*(,\d+)?$/.test(t) || t === '' || t === '-') return null
  return Number(t.replace(/\./g, '').replace(',', '.'))
}

/** "08/10/26" → "2026-10-08" (ano de dois dígitos = 20xx). */
export function dataBr(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(String(texto ?? '').trim())
  if (!m) return null
  const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${ano}-${m[2]}-${m[1]}`
}

/**
 * Lê a resposta da B3. Devolve { data, componentes:[{ticker, nome, tipo, peso, quantidadeTeorica}], totalRegistros }.
 * Erra (em vez de adivinhar) se o formato mudou: sem data, sem lista, peso ilegível, código repetido ou vazio.
 */
export function lerComposicao(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.results)) throw new Error('Resposta da B3 sem a lista "results": o formato mudou.')
  const data = dataBr(json.header?.date)
  if (!data) throw new Error(`Resposta da B3 sem data da carteira válida (header.date = ${JSON.stringify(json.header?.date)}).`)
  const vistos = new Set()
  const componentes = json.results.map((r, i) => {
    const ticker = String(r?.cod ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{4,6}$/.test(ticker)) throw new Error(`Linha ${i + 1} da B3 com código inválido: ${JSON.stringify(r?.cod)}.`)
    if (vistos.has(ticker)) throw new Error(`Código repetido na carteira da B3: ${ticker}.`)
    vistos.add(ticker)
    const peso = numeroBr(r.part)
    if (peso === null || peso < 0 || peso > 100) throw new Error(`Peso ilegível para ${ticker}: ${JSON.stringify(r.part)}.`)
    return { ticker, nome: String(r.asset ?? '').trim() || ticker, tipo: String(r.type ?? '').replace(/\s+/g, ' ').trim(), peso, quantidadeTeorica: numeroBr(r.theoricalQty) }
  })
  if (!componentes.length) throw new Error('Carteira da B3 vazia.')
  const total = Number(json.page?.totalRecords)
  if (Number.isFinite(total) && total !== componentes.length) throw new Error(`A B3 informa ${total} registros, mas vieram ${componentes.length}: a resposta está incompleta (paginação).`)
  return { data, componentes, totalRegistros: componentes.length }
}

/** Baixa a carteira do dia. Devolve a leitura e o sha256 e o tamanho do texto bruto, para o manifesto. */
export async function baixarComposicao(indice, { fetchImpl = fetch, tentativas = 3, pausaMs = 2000 } = {}) {
  const url = urlComposicao(indice)
  let ultimoErro
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(url, { headers: { 'user-agent': 'Mozilla/5.0 (carteira-ideal; auditoria)', accept: 'application/json' } })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const bruto = await resp.text()
      return { url, bytes: Buffer.byteLength(bruto), sha256: crypto.createHash('sha256').update(bruto).digest('hex'), baixadoEm: new Date().toISOString(), ...lerComposicao(JSON.parse(bruto)) }
    } catch (e) {
      ultimoErro = e
      if (t < tentativas) await new Promise((r) => setTimeout(r, pausaMs))
    }
  }
  throw new Error(`Não foi possível obter a carteira do ${indice} na B3: ${ultimoErro?.message ?? ultimoErro}`)
}
