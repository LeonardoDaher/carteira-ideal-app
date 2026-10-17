import type { SnapshotAcoesEndividadas } from './acoesEndividadas'

// Cruzamento do ranking de prêmios com as listas do app (D98): um prêmio alto vem de incerteza alta, e a dívida da empresa
// é parte dessa incerteza. A lista das mais endividadas é aberta (dívida líquida ÷ EBITDA, D94); a das mais baratas só
// chega com o código de acesso, então só é usada quando a pessoa já liberou essa lista.

export interface FundamentoEmpresa {
  /** Posição na lista das mais endividadas (1 = a mais endividada); null se a empresa está na lista "sem EBITDA positivo". */
  posicao: number | null
  /** Dívida líquida ÷ EBITDA dos últimos 12 meses; null quando o EBITDA é zero ou negativo. */
  dlEbitda: number | null
  /** Dívida líquida positiva com EBITDA zero ou negativo: a razão não existe, e é o caso mais frágil. */
  semEbitdaPositivo: boolean
  /** Está entre as N mais endividadas (o Top 15 da lista). */
  noTop: boolean
}

export interface IndiceFundamentos {
  empresas: Map<string, FundamentoEmpresa>
  /** Quantas empresas têm a razão calculada (ranking inteiro, não só o Top 15). */
  total: number
  tamanhoDoTop: number
  dataCorte: string | null
  dataPrecos: string | null
}

/** Raiz do código: as 4 primeiras letras identificam a empresa (PETR3 e PETR4 são a mesma). */
export const raizDoTicker = (ticker: string) => ticker.slice(0, 4).toUpperCase()

/** Índice por empresa a partir da lista das mais endividadas; null se ela ainda não foi publicada. */
export function montarIndiceFundamentos(s: SnapshotAcoesEndividadas | null | undefined): IndiceFundamentos | null {
  if (!s || !s.publicado) return null
  const empresas = new Map<string, FundamentoEmpresa>()
  s.ranking.forEach((item, i) => {
    const posicao = item.posicao ?? i + 1
    empresas.set(raizDoTicker(item.ticker), { posicao, dlEbitda: item.dlEbitda, semEbitdaPositivo: false, noTop: posicao <= s.tamanhoDaLista })
  })
  for (const item of s.restante) {
    empresas.set(raizDoTicker(item.ticker), { posicao: item.posicao, dlEbitda: item.dlEbitda, semEbitdaPositivo: false, noTop: item.posicao <= s.tamanhoDaLista })
  }
  const total = empresas.size
  for (const item of s.semEbitdaPositivo) {
    empresas.set(raizDoTicker(item.ticker), { posicao: null, dlEbitda: null, semEbitdaPositivo: true, noTop: false })
  }
  if (empresas.size === 0) return null
  return { empresas, total, tamanhoDoTop: s.tamanhoDaLista, dataCorte: s.dataCorte, dataPrecos: s.dataPrecos }
}

/** Fundamentos do ativo-objeto, ou null se a empresa não está no universo (banco, ETF, pouca liquidez, setor excluído). */
export function fundamentoDoAtivo(indice: IndiceFundamentos | null, ticker: string): FundamentoEmpresa | null {
  return indice?.empresas.get(raizDoTicker(ticker)) ?? null
}

/** Limites de dívida líquida ÷ EBITDA oferecidos na tela (null = sem limite). */
export const LIMITES_DE_DIVIDA: (number | null)[] = [3, 5, null]
