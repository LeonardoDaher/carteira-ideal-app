// Radar de dividendos: o que as empresas do cadastro JÁ ANUNCIARAM e ainda vão pagar (D130). Só fato publicado pela B3, sem projeção.
//
// A fonte é o cadastro da empresa (`GetListedSupplementCompany`), que traz o provento aprovado com a data com, a data de pagamento
// e o valor por ação. Este módulo é puro: lê a resposta, valida o formato e monta o radar; a rede fica em atualizar-radar-dividendos.mjs.
import { classeDoIsin, classeDoTicker, dataBr, numeroBr } from './b3-proventos.mjs'

/** Tipos que entram, com o mesmo critério do Top 15 de dividendos: fica de fora `REST CAP DIN` (devolução de capital, não é lucro distribuído). */
export const TIPOS_DO_RADAR = ['DIVIDENDO', 'JRS CAP PROPRIO', 'RENDIMENTO']

/**
 * Lê o cadastro da empresa. Devolve { nomeDePregao, eventos } ou null se a B3 não conhece o código. Cada evento:
 * classe (pelo ISIN), tipo, valor por ação, dataCom, pagamentoEm (null se a B3 ainda não informou), aprovadoEm e referencia.
 * Erra, em vez de adivinhar, se o formato mudou ou se valor/data vieram ilegíveis.
 */
export function lerPagamentos(json) {
  const r = Array.isArray(json) ? json[0] : json
  if (r == null || (typeof r === 'object' && !Object.keys(r).length)) return null
  if (typeof r !== 'object' || !('tradingName' in r)) throw new Error('Cadastro da B3 sem "tradingName": o formato mudou.')
  const lista = r.cashDividends ?? []
  if (!Array.isArray(lista)) throw new Error('Cadastro da B3 com "cashDividends" que não é uma lista: o formato mudou.')
  const eventos = lista.map((c, i) => {
    const valor = numeroBr(c?.rate)
    const dataCom = dataBr(c?.lastDatePrior)
    const tipo = String(c?.label ?? '').trim().toUpperCase()
    const textoPagamento = String(c?.paymentDate ?? '').trim()
    // A B3 escreve 31/12/9999 quando o pagamento ainda não tem data (a diretoria define depois): vira "sem data".
    const pagamentoLido = textoPagamento ? dataBr(textoPagamento) : null
    const pagamentoEm = pagamentoLido && pagamentoLido.startsWith('9999') ? null : pagamentoLido
    if (valor === null || valor < 0) throw new Error(`Provento ${i + 1} do cadastro da B3 com valor ilegível: ${JSON.stringify(c?.rate)}.`)
    if (!dataCom) throw new Error(`Provento ${i + 1} do cadastro da B3 com data com ilegível: ${JSON.stringify(c?.lastDatePrior)}.`)
    if (textoPagamento && !pagamentoLido) throw new Error(`Provento ${i + 1} do cadastro da B3 com data de pagamento ilegível: ${JSON.stringify(c?.paymentDate)}.`)
    if (!tipo) throw new Error(`Provento ${i + 1} do cadastro da B3 sem tipo.`)
    return { classe: classeDoIsin(c?.isinCode ?? c?.assetIssued), tipo, valor, dataCom, pagamentoEm, aprovadoEm: dataBr(c?.approvedOn), referencia: String(c?.relatedTo ?? '').trim() || null }
  })
  return { nomeDePregao: String(r.tradingName ?? '').trim() || null, eventos }
}

/**
 * Pagamentos anunciados da empresa, já pagos ou a pagar: a tela navega mês a mês. Só a classe do código da empresa (as séries
 * A04OR/A05OR do Banco do Brasil e os BDRs viram "OUTRA" e saem) e só os tipos de TIPOS_DO_RADAR. Linhas iguais são parcelas e
 * ficam todas. Sem data de pagamento (a B3 ainda não a definiu), o provento fica com `pagamentoEm` null.
 */
export function pagamentosAnunciados(eventos, ticker) {
  const classe = classeDoTicker(ticker)
  return eventos
    .filter((e) => e.classe === classe && TIPOS_DO_RADAR.includes(e.tipo))
    .map((e) => ({ tipo: e.tipo, valor: e.valor, dataCom: e.dataCom, pagamentoEm: e.pagamentoEm, aprovadoEm: e.aprovadoEm, referencia: e.referencia }))
}

const ordem = (a, b) =>
  (a.pagamentoEm ?? '9999-99-99').localeCompare(b.pagamentoEm ?? '9999-99-99') || a.ticker.localeCompare(b.ticker) || a.tipo.localeCompare(b.tipo) || a.dataCom.localeCompare(b.dataCom) || a.valor - b.valor

/**
 * Monta a agenda. `empresas`: [{ ticker, nome, setor, eventos }] (eventos de lerPagamentos). `falhas`: tickers que não puderam ser
 * lidos. `anteriores`: pagamentos do arquivo anterior; os já pagos que saíram do cadastro da B3 continuam. Cada pagamento sai numa linha própria, em ordem de data de pagamento; o mês (`mes`, AAAA-MM) vem da data de pagamento
 * e fica null quando a B3 ainda não a informou.
 */
export function montarRadar({ empresas, falhas = [], hoje, anteriores = [] }) {
  const pagamentos = []
  for (const e of empresas) {
    for (const p of pagamentosAnunciados(e.eventos, e.ticker)) {
      pagamentos.push({ ticker: e.ticker, nome: e.nome ?? null, setor: e.setor ?? null, ...p, mes: p.pagamentoEm ? p.pagamentoEm.slice(0, 7) : null })
    }
  }
  // O cadastro da B3 só guarda os proventos recentes: o que já foi pago e saiu dele fica guardado do arquivo anterior.
  const base = (p) => `${p.ticker}|${p.tipo}|${p.dataCom}|${p.valor.toFixed(6)}`
  const novos = new Set(pagamentos.map(base))
  for (const p of anteriores) if (p.pagamentoEm && p.pagamentoEm < hoje && !novos.has(base(p))) pagamentos.push({ ...p })
  pagamentos.sort(ordem)
  return {
    publicado: true,
    dataReferencia: hoje,
    consultadas: empresas.length + falhas.length,
    comPagamento: new Set(pagamentos.map((p) => p.ticker)).size,
    falhas: [...falhas].sort(),
    pagamentos,
  }
}

/** A trava do job: se mais de `maximoFracaoFalhas` das empresas falharam, nada é publicado. */
export function verificarSanidadeRadar(radar, { maximoFracaoFalhas = 0.3, minimoConsultadas = 20 } = {}) {
  const erros = []
  if (radar.consultadas < minimoConsultadas) erros.push(`Só ${radar.consultadas} empresas consultadas (mínimo ${minimoConsultadas}).`)
  if (radar.consultadas && radar.falhas.length / radar.consultadas > maximoFracaoFalhas) erros.push(`${radar.falhas.length} de ${radar.consultadas} empresas falharam (máximo ${Math.round(maximoFracaoFalhas * 100)}%).`)
  return erros
}
