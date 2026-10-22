import type { Indicador } from '../domain/analiseFundamentalista'

export const reais = (v: number, casas = 2) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`
export const numero = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
export const percentual = (v: number, casas = 1, sinal = false) => `${sinal && v > 0 ? '+' : ''}${numero(v, casas)}%`
export const fracaoEmPercentual = (v: number, casas = 1, sinal = false) => percentual(v * 100, casas, sinal)
export const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`
export const dataLonga = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Valor em R$ MIL, em bilhões ou milhões. */
export function milReais(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${numero(v / 1_000_000, a >= 10_000_000 ? 0 : 1)} bi`
  if (a >= 1_000) return `R$ ${numero(v / 1_000, 0)} mi`
  return `R$ ${numero(v, 0)} mil`
}

export function formatarIndicador(i: Pick<Indicador, 'valor' | 'formato'>): string {
  const v = i.valor
  if (v === null || !Number.isFinite(v)) return '—'
  switch (i.formato) {
    case 'pct':
      return fracaoEmPercentual(v)
    case 'x':
      return `${numero(v, Math.abs(v) >= 100 ? 0 : 1)}×`
    case 'reais':
      return reais(v)
    case 'milhoes':
      return milReais(v)
    default:
      return numero(v)
  }
}

/** Cor semântica de um número: verde acima de zero, vermelho abaixo. */
export const corDoSinal = (v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? 'var(--success)' : 'var(--danger)')
