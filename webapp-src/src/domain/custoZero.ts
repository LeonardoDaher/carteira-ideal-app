import type { SerieOpcao } from './opcoes'

// Operações de custo (quase) zero com opções: compra de uma ponta paga pela venda da outra, no mesmo vencimento.
//  - 'alta': compra call + venda put (reversão de risco de alta; o que se ganha na call paga o risco da put).
//  - 'baixa': compra put + venda call (reversão de risco de baixa).
// Contas puras, sobre o último preço negociado de cada série. Sem corretagem, margem nem imposto.

export type DirecaoCustoZero = 'alta' | 'baixa'

export interface ParCustoZero {
  /** Ponta comprada (paga prêmio). */
  compra: SerieOpcao
  /** Ponta vendida (recebe prêmio). */
  venda: SerieOpcao
  /** Prêmio recebido menos prêmio pago, por unidade: positivo é crédito, negativo é débito. */
  saldo: number
}

export const TOLERANCIAS_CUSTO_ZERO = [0.02, 0.05, 0.1, 0.2] as const

/** Vencimentos que têm ao menos uma call e uma put. */
export function vencimentosComCallEPut(series: SerieOpcao[]): string[] {
  const calls = new Set(series.filter((s) => s.tipo === 'call').map((s) => s.vencimento))
  const puts = new Set(series.filter((s) => s.tipo === 'put').map((s) => s.vencimento))
  return [...calls].filter((v) => puts.has(v)).sort()
}

/**
 * Pares do vencimento em que o saldo dos prêmios fica dentro da tolerância (em reais por unidade). Só entram pares com o strike
 * da put igual ou abaixo do da call (fora disso a operação vira uma posição sintética no ativo, e não uma reversão de risco).
 * Ordenados pelo saldo mais perto de zero e, no empate, pelos strikes mais perto do preço do ativo.
 */
export function buscarParesCustoZero(
  series: SerieOpcao[], direcao: DirecaoCustoZero, vencimento: string, cotacao: number, tolerancia: number, limite = 10,
): ParCustoZero[] {
  const calls = series.filter((s) => s.tipo === 'call' && s.vencimento === vencimento && s.ultimo > 0)
  const puts = series.filter((s) => s.tipo === 'put' && s.vencimento === vencimento && s.ultimo > 0)
  const pares: ParCustoZero[] = []
  for (const c of calls) {
    for (const p of puts) {
      if (p.strike > c.strike) continue
      const [compra, venda] = direcao === 'alta' ? [c, p] : [p, c]
      const saldo = Math.round((venda.ultimo - compra.ultimo) * 100) / 100
      if (Math.abs(saldo) <= tolerancia + 1e-9) pares.push({ compra, venda, saldo })
    }
  }
  const distancia = (x: ParCustoZero) => Math.abs(x.compra.strike - cotacao) + Math.abs(x.venda.strike - cotacao)
  return pares.sort((a, b) => Math.abs(a.saldo) - Math.abs(b.saldo) || distancia(a) - distancia(b)).slice(0, limite)
}
