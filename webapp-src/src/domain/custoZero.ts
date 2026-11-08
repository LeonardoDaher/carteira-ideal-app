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

export type ModoCustoZero = 'zero' | 'credito'

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
  /** Faixa de strike (null = sem limite): os dois strikes do par precisam estar dentro dela. */
  faixa: { strikeMin: number | null; strikeMax: number | null } = { strikeMin: null, strikeMax: null },
  /** 'zero': saldo dentro da tolerância, para mais ou para menos. 'credito': qualquer crédito (e até um pequeno débito dentro da tolerância), maiores créditos primeiro. */
  modo: ModoCustoZero = 'zero',
): ParCustoZero[] {
  const dentro = (s: SerieOpcao) => (faixa.strikeMin === null || s.strike >= faixa.strikeMin) && (faixa.strikeMax === null || s.strike <= faixa.strikeMax)
  const calls = series.filter((s) => s.tipo === 'call' && s.vencimento === vencimento && s.ultimo > 0 && dentro(s))
  const puts = series.filter((s) => s.tipo === 'put' && s.vencimento === vencimento && s.ultimo > 0 && dentro(s))
  const pares: ParCustoZero[] = []
  for (const c of calls) {
    for (const p of puts) {
      if (p.strike > c.strike) continue
      const [compra, venda] = direcao === 'alta' ? [c, p] : [p, c]
      const saldo = Math.round((venda.ultimo - compra.ultimo) * 100) / 100
      const serve = modo === 'credito' ? saldo >= -tolerancia - 1e-9 : Math.abs(saldo) <= tolerancia + 1e-9
      if (serve) pares.push({ compra, venda, saldo })
    }
  }
  const distancia = (x: ParCustoZero) => Math.abs(x.compra.strike - cotacao) + Math.abs(x.venda.strike - cotacao)
  const ordem = modo === 'credito'
    ? (a: ParCustoZero, b: ParCustoZero) => b.saldo - a.saldo || distancia(a) - distancia(b)
    : (a: ParCustoZero, b: ParCustoZero) => Math.abs(a.saldo) - Math.abs(b.saldo) || distancia(a) - distancia(b)
  return pares.sort(ordem).slice(0, limite)
}
