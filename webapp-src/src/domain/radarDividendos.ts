/**
 * Agenda de dividendos (D130): proventos que a B3 anunciou, já pagos e a pagar, navegáveis mês a mês. O arquivo chega pronto do
 * job scripts/atualizar-radar-dividendos.mjs; o app só filtra e mostra. Só fato publicado, sem projeção.
 */

export interface PagamentoAnunciado {
  ticker: string
  nome: string | null
  setor: string | null
  tipo: 'DIVIDENDO' | 'JRS CAP PROPRIO' | 'RENDIMENTO' | string
  /** Valor bruto por ação. */
  valor: number
  /** Último dia com direito (AAAA-MM-DD). */
  dataCom: string
  /** Data de pagamento; null quando a B3 ainda não a definiu. */
  pagamentoEm: string | null
  aprovadoEm: string | null
  referencia: string | null
  /** AAAA-MM do pagamento, ou null sem data. */
  mes: string | null
}

export interface SnapshotRadarDividendos {
  publicado: boolean
  geradoEm: string | null
  dataReferencia: string
  consultadas: number
  comPagamento: number
  falhas: string[]
  pagamentos: PagamentoAnunciado[]
}

/** Qual data organiza a agenda: a de pagamento ou a data com (último dia para ter direito). */
export type BaseDaData = 'pagamento' | 'com'

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-11" → "Novembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  return m ? `${NOMES_MESES[Number(m[2]) - 1][0].toUpperCase()}${NOMES_MESES[Number(m[2]) - 1].slice(1)} de ${m[1]}` : mes
}

export const ROTULO_TIPO_RADAR: Record<string, string> = {
  DIVIDENDO: 'Dividendo',
  'JRS CAP PROPRIO': 'JCP (bruto)',
  RENDIMENTO: 'Rendimento',
}

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const mesDe = (p: PagamentoAnunciado, base: BaseDaData) => (base === 'com' ? p.dataCom.slice(0, 7) : p.mes)
const dataDe = (p: PagamentoAnunciado, base: BaseDaData) => (base === 'com' ? p.dataCom : p.pagamentoEm)

/** Soma um número de meses a um AAAA-MM (negativo volta). */
export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const t = a * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Primeiro e último mês com pagamento na base escolhida, para limitar as setas. null se não houver nenhum. */
export function limitesDosMeses(pagamentos: PagamentoAnunciado[], base: BaseDaData): { primeiro: string; ultimo: string } | null {
  const meses = pagamentos.map((p) => mesDe(p, base)).filter((m): m is string => m !== null).sort()
  return meses.length ? { primeiro: meses[0], ultimo: meses[meses.length - 1] } : null
}

/** Os pagamentos de um mês, filtrados por código ou nome (sem acento nem caixa), em ordem de data e depois de código. */
export function doMes(pagamentos: PagamentoAnunciado[], mes: string, base: BaseDaData, busca = ''): PagamentoAnunciado[] {
  const q = semAcento(busca)
  return pagamentos
    .filter((p) => mesDe(p, base) === mes && (!q || semAcento(p.ticker).includes(q) || semAcento(p.nome ?? '').includes(q)))
    .sort((a, b) => (dataDe(a, base) ?? '').localeCompare(dataDe(b, base) ?? '') || a.ticker.localeCompare(b.ticker) || a.tipo.localeCompare(b.tipo) || a.valor - b.valor)
}

/** Anunciados que ainda não têm data de pagamento (a diretoria define depois). */
export function semDataDePagamento(pagamentos: PagamentoAnunciado[], busca = ''): PagamentoAnunciado[] {
  const q = semAcento(busca)
  return pagamentos
    .filter((p) => p.pagamentoEm === null && (!q || semAcento(p.ticker).includes(q) || semAcento(p.nome ?? '').includes(q)))
    .sort((a, b) => a.ticker.localeCompare(b.ticker) || a.dataCom.localeCompare(b.dataCom))
}

/** Ainda dá para ter direito: a data com é hoje ou futura. */
export const aindaTemDireito = (p: PagamentoAnunciado, hoje: string) => p.dataCom >= hoje

/** O mês em que a agenda abre: o de hoje se tiver pagamentos; senão o mais próximo com pagamentos. */
export function mesInicial(pagamentos: PagamentoAnunciado[], base: BaseDaData, hoje: string): string {
  const atual = hoje.slice(0, 7)
  const lim = limitesDosMeses(pagamentos, base)
  if (!lim) return atual
  return atual < lim.primeiro ? lim.primeiro : atual > lim.ultimo ? lim.ultimo : atual
}
