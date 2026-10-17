/** Série de opção (call ou put) do último pregão, gerada por scripts/atualizar-opcoes.mjs a partir do COTAHIST da B3. */
export interface SerieOpcao {
  codigo: string
  tipo: 'call' | 'put'
  strike: number
  /** AAAA-MM-DD */
  vencimento: string
  /** Preço de fechamento (último negócio) da opção, por unidade do ativo. */
  premio: number
  negocios: number
  /** Volume financeiro (R$) do dia. */
  volume: number
}

export interface AtivoComOpcoes {
  ticker: string
  nome: string
  cotacao: number
  volumeOpcoes: number
  series: SerieOpcao[]
}

export interface SnapshotOpcoes {
  geradoEm: string | null
  dataPregao: string | null
  fonte?: string
  criterio?: { maxAtivos: number; vencimentosPorAtivo: number; faixaStrikePct: number; minimoNegocios: number }
  ativos: AtivoComOpcoes[]
}

export type FiltroTipo = 'todas' | 'call' | 'put'

export interface FiltroSeries {
  tipo: FiltroTipo
  /** Vazio = todos os vencimentos. */
  vencimento: string
  /** Strike mínimo e máximo em reais; null = sem limite. */
  strikeMin: number | null
  strikeMax: number | null
}

export const FILTRO_VAZIO: FiltroSeries = { tipo: 'todas', vencimento: '', strikeMin: null, strikeMax: null }

/** Filtra as séries por tipo, vencimento e faixa de strike (limites incluídos). */
export function filtrarSeries(series: SerieOpcao[], f: FiltroSeries): SerieOpcao[] {
  return series.filter(
    (s) =>
      (f.tipo === 'todas' || s.tipo === f.tipo) &&
      (!f.vencimento || s.vencimento === f.vencimento) &&
      (f.strikeMin === null || s.strike >= f.strikeMin) &&
      (f.strikeMax === null || s.strike <= f.strikeMax),
  )
}

/** Faixa de strike a ±pct% do preço do ativo (atalho "perto do preço"), com 2 casas. */
export function faixaPerto(cotacao: number, pct: number): { strikeMin: number; strikeMax: number } {
  const r = (v: number) => Math.round(v * 100) / 100
  return { strikeMin: r(cotacao * (1 - pct / 100)), strikeMax: r(cotacao * (1 + pct / 100)) }
}

/** Vencimentos distintos, em ordem crescente. */
export function vencimentosDe(series: SerieOpcao[]): string[] {
  return [...new Set(series.map((s) => s.vencimento))].sort()
}

/** Menor e maior strike das séries, ou null se não houver. */
export function limitesDeStrike(series: SerieOpcao[]): { min: number; max: number } | null {
  if (series.length === 0) return null
  const strikes = series.map((s) => s.strike)
  return { min: Math.min(...strikes), max: Math.max(...strikes) }
}

/**
 * Situação da opção em relação ao preço do ativo: call com strike abaixo do preço está "dentro do dinheiro",
 * com strike muito próximo "no dinheiro" (até 1%), e acima "fora do dinheiro". A put é o inverso.
 */
export function moneyness(tipo: 'call' | 'put', strike: number, cotacao: number): 'dentro' | 'no' | 'fora' {
  if (Math.abs(strike - cotacao) / cotacao <= 0.01) return 'no'
  const dentro = tipo === 'call' ? strike < cotacao : strike > cotacao
  return dentro ? 'dentro' : 'fora'
}

/** Dias corridos entre duas datas AAAA-MM-DD (negativo se o vencimento já passou). */
export function diasAte(vencimento: string, hoje: string): number {
  const a = Date.UTC(+vencimento.slice(0, 4), +vencimento.slice(5, 7) - 1, +vencimento.slice(8, 10))
  const b = Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10))
  return Math.round((a - b) / 86_400_000)
}
