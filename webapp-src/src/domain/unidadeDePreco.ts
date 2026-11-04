// Unidade dos textos da análise técnica: ação cota em reais; índice (IBOV, IFIX) vale em pontos.
//
// Os textos da leitura ("Fechamento abaixo de R$ 159.398,00") são montados por dezenas de funções puras. Em vez de repassar a unidade
// por todas elas, a leitura roda dentro de `comUnidade`, que troca a unidade só durante a chamada (síncrona) e a restaura no fim,
// mesmo se der erro. Fora de `comUnidade` a unidade é reais, como sempre foi.

export type UnidadeDePreco = 'reais' | 'pontos'

let atual: UnidadeDePreco = 'reais'

export function comUnidade<T>(unidade: UnidadeDePreco, calcular: () => T): T {
  const anterior = atual
  atual = unidade
  try {
    return calcular()
  } finally {
    atual = anterior
  }
}

/** "R$ 1.234,56" (ação) ou "1.234,56 pts" (índice), conforme a unidade em vigor. */
export function moedaAtual(v: number, casas = 2): string {
  const n = v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  return atual === 'pontos' ? `${n} pts` : `R$ ${n}`
}
