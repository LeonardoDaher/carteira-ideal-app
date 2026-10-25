// Proventos em dinheiro por ação (dividendos, juros sobre capital próprio, rendimentos) lidos da B3 (D122).
//
// A B3 tem DUAS listas públicas, as mesmas que alimentam a página de cada empresa (sistemaswebb3-listados.b3.com.br), e nenhuma
// basta sozinha:
//   - HISTÓRICO (`GetListedCashDividends`): anos de proventos, mas filtra pelo NOME DE PREGÃO da época (a Ambev, por exemplo, não
//     devolve nada com o nome atual) e demora a listar o que já foi aprovado e ainda não foi pago.
//   - CADASTRO DA EMPRESA (`GetListedSupplementCompany`, pelo código de quatro letras): só os proventos recentes ou a pagar, com
//     o ISIN de cada classe, mas sem esses defeitos.
// Este módulo baixa as duas, lê cada resposta validando o formato e UNE as listas (`unirProventos`). O cálculo do ranking
// (acoes-dividendos-calculo.mjs) recebe a lista já limpa e não toca na rede.
import crypto from 'node:crypto'

const BASE = 'https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall'

/** Classe de ação (como a B3 escreve em `typeStock`) a partir do final do código: PETR4 → PN, TAEE11 → UNT. */
const CLASSE_POR_FINAL = { 3: 'ON', 4: 'PN', 5: 'PNA', 6: 'PNB', 7: 'PNC', 8: 'PND', 11: 'UNT' }
export function classeDoTicker(ticker) {
  const m = /^[A-Z0-9]{4}(\d{1,2})$/.exec(String(ticker ?? '').trim().toUpperCase())
  return (m && CLASSE_POR_FINAL[Number(m[1])]) || null
}

/**
 * Classe a partir do ISIN do cadastro da empresa: BRPETRACNPR7 → "ACNPR" → PN. O tipo ocupa as posições 6 a 10 do ISIN
 * (ACNOR ordinária, ACNPR preferencial, ACNPA/ACNPB classes A e B, CDAM1 e UNT00 units). Qualquer outro tipo vira "OUTRA" e não
 * entra na conta: BDR, e as séries A04OR e A05OR do Banco do Brasil, que repetem o provento das ações ordinárias (ACNOR) e
 * contariam três vezes o mesmo pagamento.
 */
export function classeDoIsin(isin) {
  const tipo = String(isin ?? '').slice(6, 11).toUpperCase()
  if (tipo === 'ACNOR') return 'ON'
  if (tipo === 'ACNPR') return 'PN'
  if (/^ACNP[A-H]$/.test(tipo)) return `PN${tipo[4]}`
  if (tipo === 'CDAM1' || tipo.startsWith('UNT')) return 'UNT'
  return 'OUTRA'
}

/** Endereço de uma chamada: os parâmetros vão em JSON codificado em base64 (e em URL, porque o base64 pode ter "/" e "+"). */
export function urlB3(chamada, parametros) {
  return `${BASE}/${chamada}/${encodeURIComponent(Buffer.from(JSON.stringify(parametros)).toString('base64'))}`
}
export const urlCadastro = (raiz) => urlB3('GetListedSupplementCompany', { language: 'pt-br', issuingCompany: raiz })
export const urlProventos = (nomeDePregao, pagina = 1, tamanho = 100) =>
  urlB3('GetListedCashDividends', { language: 'pt-br', pageNumber: pagina, pageSize: tamanho, tradingName: nomeDePregao })

/** "0,67407131" → 0.67407131; "1.234,5" → 1234.5; vazio ou lixo → null. */
export function numeroBr(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  const t = String(texto ?? '').trim()
  if (!/^-?[\d.]*(,\d+)?$/.test(t) || t === '' || t === '-') return null
  return Number(t.replace(/\./g, '').replace(',', '.'))
}

/** "21/08/2026" → "2026-08-21"; qualquer outro formato → null. */
export function dataBr(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Lê uma página do HISTÓRICO. Devolve { totalRegistros, totalPaginas, eventos }, cada evento com:
 * classe (ON, PN, UNT…), tipo (DIVIDENDO, JRS CAP PROPRIO, RENDIMENTO, REST CAP DIN), valor POR AÇÃO (já dividido por
 * `quotedPerShares`, porque algumas linhas vêm por lote de 1.000), dataCom (último dia com direito, ISO) e aprovadoEm.
 * Erra (em vez de adivinhar) se o formato mudou ou se um valor/data veio ilegível.
 */
export function lerProventos(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.results)) throw new Error('Resposta da B3 sem a lista "results": o formato mudou.')
  const eventos = json.results.map((r, i) => {
    const valorBruto = numeroBr(r?.valueCash)
    const porLote = numeroBr(r?.quotedPerShares)
    const dataCom = dataBr(r?.lastDatePriorEx)
    const classe = String(r?.typeStock ?? '').trim().toUpperCase()
    const tipo = String(r?.corporateAction ?? '').trim().toUpperCase()
    if (valorBruto === null || valorBruto < 0) throw new Error(`Provento ${i + 1} da B3 com valor ilegível: ${JSON.stringify(r?.valueCash)}.`)
    if (porLote === null || porLote <= 0) throw new Error(`Provento ${i + 1} da B3 com quantidade por lote inválida: ${JSON.stringify(r?.quotedPerShares)}.`)
    if (!dataCom) throw new Error(`Provento ${i + 1} da B3 com data com ilegível: ${JSON.stringify(r?.lastDatePriorEx)}.`)
    if (!classe || !tipo) throw new Error(`Provento ${i + 1} da B3 sem classe ou tipo.`)
    return { classe, tipo, valor: valorBruto / porLote, dataCom, aprovadoEm: dataBr(r?.dateApproval), precoAntesEx: numeroBr(r?.closingPricePriorExDate) }
  })
  return { totalRegistros: Number(json.page?.totalRecords) || 0, totalPaginas: Number(json.page?.totalPages) || 1, eventos }
}

/**
 * Lê a resposta do CADASTRO DA EMPRESA. Devolve { nomeDePregao, cnpj, codigoCvm, eventos } com os mesmos campos de `lerProventos`
 * (a classe vem do ISIN) ou null se a B3 não conhece o código. O valor (`rate`) já é por ação.
 */
export function lerCadastro(json) {
  const r = Array.isArray(json) ? json[0] : json
  if (r == null || (typeof r === 'object' && !Object.keys(r).length)) return null
  if (typeof r !== 'object' || !('tradingName' in r)) throw new Error('Cadastro da B3 sem "tradingName": o formato mudou.')
  const lista = r.cashDividends ?? []
  if (!Array.isArray(lista)) throw new Error('Cadastro da B3 com "cashDividends" que não é uma lista: o formato mudou.')
  const eventos = lista.map((c, i) => {
    const valor = numeroBr(c?.rate)
    const dataCom = dataBr(c?.lastDatePrior)
    const tipo = String(c?.label ?? '').trim().toUpperCase()
    if (valor === null || valor < 0) throw new Error(`Provento ${i + 1} do cadastro da B3 com valor ilegível: ${JSON.stringify(c?.rate)}.`)
    if (!dataCom) throw new Error(`Provento ${i + 1} do cadastro da B3 com data com ilegível: ${JSON.stringify(c?.lastDatePrior)}.`)
    if (!tipo) throw new Error(`Provento ${i + 1} do cadastro da B3 sem tipo.`)
    return { classe: classeDoIsin(c?.isinCode ?? c?.assetIssued), tipo, valor, dataCom, aprovadoEm: dataBr(c?.approvedOn), precoAntesEx: null }
  })
  return { nomeDePregao: String(r.tradingName ?? '').trim() || null, cnpj: r.cnpj ?? null, codigoCvm: r.codeCVM ?? null, eventos }
}

/**
 * Une as duas listas sem contar duas vezes o mesmo pagamento. Linhas iguais DENTRO de uma lista são parcelas e ficam todas; entre
 * as listas, para cada (classe, tipo, data com) vale a que tiver MAIS linhas (empate: o histórico). Assim o histórico completa o
 * que o cadastro já esqueceu e o cadastro completa o que o histórico ainda não listou. O valor fica fora da chave porque as duas
 * listas arredondam diferente (0,0402 × 0,040223 para o mesmo pagamento) e somariam as duas versões.
 */
export function unirProventos(historico, cadastro) {
  const chave = (e) => `${e.classe}|${e.tipo}|${e.dataCom}`
  const contar = (lista) => {
    const m = new Map()
    for (const e of lista) m.set(chave(e), [...(m.get(chave(e)) ?? []), e])
    return m
  }
  const h = contar(historico)
  const c = contar(cadastro)
  const saida = []
  for (const k of new Set([...h.keys(), ...c.keys()])) {
    const a = h.get(k) ?? []
    const b = c.get(k) ?? []
    saida.push(...(a.length >= b.length ? a : b))
  }
  return saida
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
// Sem `accept: application/json`: com ele a B3 devolve o JSON dentro de uma string (codificado duas vezes).
const CABECALHO = { 'user-agent': 'Mozilla/5.0 (carteira-ideal; auditoria)' }

async function buscarJson(url, { fetchImpl, tentativas, pausaMs }) {
  let ultimoErro
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(url, { headers: CABECALHO })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const bruto = await resp.text()
      // Código desconhecido: a B3 responde 200 com o corpo vazio.
      const lido = bruto.trim() === '' ? null : JSON.parse(bruto)
      return { json: typeof lido === 'string' ? JSON.parse(lido) : lido, bruto }
    } catch (e) {
      ultimoErro = e
      if (t < tentativas) await pausa(pausaMs)
    }
  }
  throw new Error(`${ultimoErro?.message ?? ultimoErro}`)
}

const sha = (...textos) => {
  const h = crypto.createHash('sha256')
  for (const t of textos) h.update(t)
  return h.digest('hex')
}

/** Cadastro da empresa pelo código de quatro letras. Devolve a leitura (ou null) e o texto bruto. */
export async function baixarCadastro(raiz, { fetchImpl = fetch, tentativas = 3, pausaMs = 1500 } = {}) {
  const { json, bruto } = await buscarJson(urlCadastro(raiz), { fetchImpl, tentativas, pausaMs })
  return { cadastro: json == null ? null : lerCadastro(json), bruto }
}

/** Baixa todas as páginas do histórico de um nome de pregão. Devolve { eventos, totalRegistros, sha256 (do texto bruto) }. */
export async function baixarProventos(nomeDePregao, { fetchImpl = fetch, tentativas = 3, pausaMs = 1500, tamanho = 100 } = {}) {
  const brutos = []
  const eventos = []
  let totalRegistros = 0
  for (let pagina = 1, total = 1; pagina <= total; pagina++) {
    const { json, bruto } = await buscarJson(urlProventos(nomeDePregao, pagina, tamanho), { fetchImpl, tentativas, pausaMs })
    const lida = lerProventos(json)
    brutos.push(bruto)
    eventos.push(...lida.eventos)
    totalRegistros = lida.totalRegistros
    total = Math.min(lida.totalPaginas, 40)
  }
  if (eventos.length !== totalRegistros) throw new Error(`A B3 informa ${totalRegistros} proventos de "${nomeDePregao}", mas vieram ${eventos.length}: a resposta está incompleta.`)
  return { eventos, totalRegistros, sha256: sha(...brutos) }
}

/**
 * Proventos de uma empresa pelo código de quatro letras: o cadastro (nome de pregão e proventos recentes) e o histórico
 * (pelo nome de pregão do cadastro), unidos. `historicoDisponivel` é false quando o histórico não devolveu nada com esse nome:
 * então só valem os proventos do cadastro, que cobrem os últimos meses mas podem não alcançar o começo da janela de 12 meses.
 */
export async function baixarProventosDaEmpresa(raiz, opcoes = {}) {
  const { cadastro, bruto } = await baixarCadastro(raiz, opcoes)
  if (!cadastro) return { raiz, nomeDePregao: null, historicoDisponivel: false, eventos: [], contagens: { historico: 0, cadastro: 0, unidos: 0 }, sha256: null, motivo: 'A B3 não tem cadastro para este código.' }
  if (opcoes.pausaEntreChamadasMs) await pausa(opcoes.pausaEntreChamadasMs)
  const historico = cadastro.nomeDePregao ? await baixarProventos(cadastro.nomeDePregao, opcoes) : { eventos: [], sha256: null }
  const eventos = unirProventos(historico.eventos, cadastro.eventos)
  return {
    raiz,
    nomeDePregao: cadastro.nomeDePregao,
    cnpj: cadastro.cnpj,
    codigoCvm: cadastro.codigoCvm,
    historicoDisponivel: historico.eventos.length > 0,
    eventos,
    contagens: { historico: historico.eventos.length, cadastro: cadastro.eventos.length, unidos: eventos.length },
    sha256: sha(bruto, historico.sha256 ?? ''),
    motivo: eventos.length ? null : 'A B3 não tem proventos publicados para esta empresa.',
  }
}
