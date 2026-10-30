// Balanço recém-divulgado, lido da página da empresa na B3 (as mesmas chamadas que alimentam sistemaswebb3-listados.b3.com.br).
//
// A CVM publica os arquivos abertos (ITR/DFP) com atraso de dias; a B3 mostra o balanço no mesmo dia:
//   - `GetListedFinancial` (pelo código CVM): resumo econômico-financeiro do ÚLTIMO balanço, ACUMULADO no exercício (por exemplo, 9 meses
//     no 3º trimestre), com o mesmo período do ano anterior ao lado. R$ mil. Receita, lucro, ativo e patrimônio líquido.
//   - `GetListedHeadLines` (agência 18 = CVM): o aviso "Demonstracoes Financeiras - ITR de 30/09/26", com a data e a hora em que a
//     empresa entregou o documento e o link da CVM. A chamada devolve no máximo 4 avisos por consulta, então a busca é por janelas de dias.
// Este módulo só baixa e lê as respostas validando o formato; as contas ficam em balancos-calculo.mjs.

const BASE = 'https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall'
const CABECALHO = { 'user-agent': 'Mozilla/5.0 (carteira-ideal; balancos)' }

const url = (chamada, parametros) => `${BASE}/${chamada}/${encodeURIComponent(Buffer.from(JSON.stringify(parametros)).toString('base64'))}`
export const urlCadastroB3 = (raiz) => url('GetListedSupplementCompany', { language: 'pt-br', issuingCompany: raiz })
export const urlFinanceiro = (codigoCvm) => url('GetListedFinancial', { codeCVM: String(codigoCvm), language: 'pt-br' })
export const urlAvisos = (raiz, de, ate) => url('GetListedHeadLines', { agency: '18', dateInitial: de, dateFinal: ate, issuingCompany: `(${raiz}` })

/** "156.154.000" → 156154000; "(318.000)" → -318000; vazio ou lixo → null. */
export function numeroB3(texto) {
  const t = String(texto ?? '').trim()
  const neg = /^\(.*\)$/.test(t)
  const limpo = t.replace(/^\(|\)$/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null
  return (neg ? -1 : 1) * Number(limpo)
}

/** "30/09/2026" → "2026-09-30"; "01/01/2026 a 30/09/2026" → { de, ate }. */
const dataBr = (t) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(t ?? ''))
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
const intervalo = (t) => {
  const datas = [...String(t ?? '').matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`)
  return datas.length === 2 ? { de: datas[0], ate: datas[1] } : null
}

/**
 * Lê o resumo financeiro da B3. Devolve { periodo, acumuladoDesde, consolidacao, receita, lucroLiquido, lucroControladores, ativoTotal,
 * patrimonioLiquido } (R$ mil, acumulado do exercício) ou null se o formato não for o esperado. Usa o consolidado e, se não houver, o individual.
 */
export function lerFinanceiro(json) {
  for (const [chave, consolidacao] of [['consolidated', 'consolidada'], ['unconsolidated', 'individual']]) {
    const secoes = json?.[chave]
    if (!Array.isArray(secoes)) continue
    const balanco = secoes.find((s) => /^balan/i.test(s.title ?? '') && /patrimonial/i.test(s.title ?? ''))
    const resultado = secoes.find((s) => /^demonstra.*resultado/i.test(s.title ?? ''))
    if (!balanco || !resultado) continue
    const periodo = dataBr(balanco.dateInicial)
    const acum = intervalo(resultado.dateInicial)
    if (!periodo || !acum || acum.ate !== periodo) continue
    const pega = (secao, re) => {
      const l = secao.results?.find((r) => re.test(r.describle ?? ''))
      return l ? numeroB3(l.value) : null
    }
    const lucroLiquido = pega(resultado, /^lucro \(preju[ií]zo\) do per[ií]odo$/i)
    const ativoTotal = pega(balanco, /^ativo total$/i)
    const patrimonioLiquido = pega(balanco, /^patrim[oô]nio l[ií]quido$/i)
    if (lucroLiquido == null || ativoTotal == null || patrimonioLiquido == null) continue
    return {
      periodo,
      acumuladoDesde: acum.de,
      consolidacao,
      receita: pega(resultado, /^receita/i),
      lucroLiquido,
      lucroControladores: pega(resultado, /atribu[ií]do [àa] controladora/i),
      ativoTotal,
      patrimonioLiquido,
    }
  }
  return null
}

/**
 * Avisos de entrega de demonstrações: [{ dia, tipo: 'ITR' | 'DFP', periodo, reapresentacao, link }]. Só os avisos de "Demonstracoes
 * Financeiras" (o do ITR e o do DFP); apresentações, atas e comunicados ficam de fora.
 */
export function lerAvisosDeDemonstracoes(json) {
  if (!Array.isArray(json)) return []
  const saida = []
  for (const a of json) {
    const h = String(a.headline ?? '')
    const m = /Demonstracoes Financeiras.*?\b(ITR|DFP)\b de (\d{2})\/(\d{2})\/(\d{2})/i.exec(h)
    const dia = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(a.dateTime ?? '')
    if (!m || !dia) continue
    saida.push({
      dia: `${dia[3]}-${dia[2]}-${dia[1]}`,
      tipo: m[1].toUpperCase(),
      periodo: `20${m[4]}-${m[3]}-${m[2]}`,
      reapresentacao: /\(R\d*\)\s*$/.test(h.trim()),
      link: a.url ?? null,
    })
  }
  return saida
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

async function pedirJson(endereco, { fetchImpl, tentativas = 3, pausaMs = 1500 }) {
  let ultimo
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(endereco, { headers: CABECALHO })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const bruto = (await resp.text()).trim()
      return bruto === '' ? null : JSON.parse(bruto)
    } catch (e) {
      ultimo = e
      if (t < tentativas) await pausa(pausaMs)
    }
  }
  throw ultimo
}

/** Código CVM da empresa pelo cadastro da B3 (raiz de 4 letras). null se a B3 não devolver. */
export async function codigoCvmDaRaiz(raiz, { fetchImpl = fetch } = {}) {
  const j = await pedirJson(urlCadastroB3(raiz), { fetchImpl })
  const c = Array.isArray(j) ? j[0] : j
  return c?.codeCVM ? String(c.codeCVM) : null
}

export async function baixarFinanceiro(codigoCvm, { fetchImpl = fetch } = {}) {
  return lerFinanceiro(await pedirJson(urlFinanceiro(codigoCvm), { fetchImpl }))
}

const somaDias = (data, d) => new Date(Date.parse(`${data}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10)

/**
 * Dia em que a empresa entregou o documento do `periodo`, procurando de hoje para trás em janelas de `janela` dias (a B3 devolve no
 * máximo 4 avisos por consulta). Fica com a PRIMEIRA entrega, não com a reapresentação. Devolve { dia, link } ou null.
 */
export async function acharEntrega({ raiz, periodo, tipo, hoje, fetchImpl = fetch, janela = 4, maxDias = 75, pausaMs = 250 }) {
  let fim = hoje
  const limite = somaDias(hoje, -maxDias)
  let achado = null
  while (fim >= limite) {
    const ini = somaDias(fim, -(janela - 1))
    const avisos = lerAvisosDeDemonstracoes(await pedirJson(urlAvisos(raiz, ini, fim), { fetchImpl }))
    for (const a of avisos) {
      if (a.periodo !== periodo || a.tipo !== tipo) continue
      if (!achado || (achado.reapresentacao && !a.reapresentacao) || (a.reapresentacao === achado.reapresentacao && a.dia < achado.dia)) achado = a
    }
    // Janela com 4 avisos pode ter cortado outros: se já achou o documento original nesta janela, para.
    if (achado && !achado.reapresentacao) break
    if (achado && achado.dia < ini) break
    fim = somaDias(ini, -1)
    if (pausaMs) await pausa(pausaMs)
  }
  return achado ? { dia: achado.dia, link: achado.link } : null
}
