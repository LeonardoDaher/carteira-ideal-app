// Backtest dos sinais de candle (D132): simula a entrada pelo gatilho e a saída pelo stop ou pelo tempo, em múltiplos de risco (R),
// sem olhar o futuro para decidir o sinal. Funções puras. Não inclui custos, corretagem nem dividendos: é para comparar sinal contra
// referência, não para prometer retorno (docs/18-calibragem-dos-sinais.md).

import type { Barra } from './analiseTecnica'

export interface Gatilho {
  /** Índice do candle de sinal. */
  indice: number
  lado: 'compra' | 'venda'
  gatilho: number
  stop: number
}

export interface Operacao {
  indiceSinal: number
  indiceEntrada: number
  dataEntrada: string
  lado: 'compra' | 'venda'
  entrada: number
  stop: number
  /** Risco em % da entrada. */
  riscoPct: number
  /** Resultado final em R (stop ou fechamento ao fim do horizonte). */
  r: number
  saida: 'stop' | 'tempo'
  /** O preço andou 1R a favor antes de tocar o stop. */
  bateu1R: boolean
  /** Maior movimento a favor em R durante a operação. */
  favoravelR: number
  /** Retorno em % da entrada ao fim do horizonte, sem stop (para comparar com o resultado com stop). */
  retornoSemStopPct: number
}

export interface OpcoesDaSimulacao {
  /** Candles depois do sinal em que o gatilho ainda vale. */
  validade: number
  /** Candles de permanência depois da entrada. */
  horizonte: number
}

export const SIMULACAO_PADRAO: OpcoesDaSimulacao = { validade: 5, horizonte: 20 }

/**
 * Entrada no primeiro candle depois do sinal que supera o gatilho (compra) ou perde o gatilho (venda); se o candle abre além do
 * gatilho, a entrada é na abertura. Stop perdido antes do gatilho cancela. Se no candle da entrada o stop também é tocado,
 * assume-se o stop (hipótese conservadora). Devolve null se o gatilho não aciona ou se não há candles suficientes para o horizonte.
 */
export function simular(barras: Barra[], g: Gatilho, o: OpcoesDaSimulacao = SIMULACAO_PADRAO): Operacao | null {
  const dir = g.lado === 'compra' ? 1 : -1
  const aFavor = (p: number, ref: number) => (p - ref) * dir
  let j = -1
  for (let k = g.indice + 1; k <= g.indice + o.validade && k < barras.length; k++) {
    const b = barras[k]
    const acionou = g.lado === 'compra' ? b.max >= g.gatilho : b.min <= g.gatilho
    const perdeu = g.lado === 'compra' ? b.min <= g.stop : b.max >= g.stop
    if (acionou) {
      j = k
      break
    }
    if (perdeu) return null
  }
  if (j < 0 || j + o.horizonte >= barras.length) return null
  const b0 = barras[j]
  const abre = b0.abe ?? g.gatilho
  const entrada = g.lado === 'compra' ? Math.max(g.gatilho, abre) : Math.min(g.gatilho, abre)
  const risco = (entrada - g.stop) * dir
  if (risco <= 0) return null
  const base = { indiceSinal: g.indice, indiceEntrada: j, dataEntrada: b0.data, lado: g.lado, entrada, stop: g.stop, riscoPct: (risco / entrada) * 100 }
  const semStop = (barras[j + o.horizonte].fech - entrada) * dir / entrada * 100

  const toqueNoStop = (b: Barra) => (g.lado === 'compra' ? b.min <= g.stop : b.max >= g.stop)
  const extremoAFavor = (b: Barra) => (g.lado === 'compra' ? b.max : b.min)
  const saidaNoStop = (b: Barra) => (g.lado === 'compra' ? Math.min(g.stop, b.abe ?? g.stop) : Math.max(g.stop, b.abe ?? g.stop))
  // candle da entrada: o stop vale primeiro
  if (toqueNoStop(b0)) return { ...base, r: (g.stop - entrada) * dir / risco, saida: 'stop', bateu1R: false, favoravelR: 0, retornoSemStopPct: semStop }
  let favoravel = Math.max(0, aFavor(extremoAFavor(b0), entrada) / risco)
  let bateu = favoravel >= 1
  for (let k = j + 1; k <= j + o.horizonte; k++) {
    const b = barras[k]
    if (toqueNoStop(b)) return { ...base, r: (saidaNoStop(b) - entrada) * dir / risco, saida: 'stop', bateu1R: bateu, favoravelR: favoravel, retornoSemStopPct: semStop }
    favoravel = Math.max(favoravel, aFavor(extremoAFavor(b), entrada) / risco)
    if (favoravel >= 1) bateu = true
  }
  return { ...base, r: (barras[j + o.horizonte].fech - entrada) * dir / risco, saida: 'tempo', bateu1R: bateu, favoravelR: favoravel, retornoSemStopPct: semStop }
}

export interface Resumo {
  n: number
  /** Média do resultado em R. */
  mediaR: number
  /** Erro-padrão da média em R. */
  erroR: number
  /** Parcela das operações que andou 1R a favor antes do stop. */
  taxa1R: number
  /** Parcela que terminou no stop. */
  taxaStop: number
  /** Mediana do risco em % da entrada. */
  riscoMedianoPct: number
}

export function resumir(ops: Operacao[]): Resumo {
  const n = ops.length
  if (!n) return { n: 0, mediaR: 0, erroR: 0, taxa1R: 0, taxaStop: 0, riscoMedianoPct: 0 }
  const media = ops.reduce((a, o) => a + o.r, 0) / n
  const variancia = n > 1 ? ops.reduce((a, o) => a + (o.r - media) ** 2, 0) / (n - 1) : 0
  const riscos = ops.map((o) => o.riscoPct).sort((a, b) => a - b)
  return {
    n,
    mediaR: media,
    erroR: Math.sqrt(variancia / n),
    taxa1R: ops.filter((o) => o.bateu1R).length / n,
    taxaStop: ops.filter((o) => o.saida === 'stop').length / n,
    riscoMedianoPct: riscos[Math.floor(n / 2)],
  }
}

/** Agrupa as operações por uma chave e resume cada grupo. */
export function agrupar<T extends string>(ops: Operacao[], chave: (o: Operacao) => T): Record<T, Resumo> {
  const grupos = new Map<T, Operacao[]>()
  for (const o of ops) {
    const k = chave(o)
    const l = grupos.get(k)
    if (l) l.push(o)
    else grupos.set(k, [o])
  }
  const saida = {} as Record<T, Resumo>
  for (const [k, l] of grupos) saida[k] = resumir(l)
  return saida
}
