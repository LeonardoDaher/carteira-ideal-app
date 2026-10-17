import type { AtivoComOpcoes } from './opcoes'

// Primeiro gráfico da aba Gráficos: negócios (ou volume) por strike, para os vencimentos escolhidos. Conta as séries que
// negociaram no último pregão, de calls e puts, americanas e europeias juntas (o estilo não entra no filtro).

export type Metrica = 'negocios' | 'volume'
/** 'separados': uma linha de calls e outra de puts por vencimento; 'soma': calls + puts; ou só um dos tipos. */
export type ModoTipos = 'separados' | 'soma' | 'calls' | 'puts'
export type TipoDaLinha = 'call' | 'put' | 'soma'

export interface LinhaDoGrafico {
  id: string
  vencimento: string
  tipo: TipoDaLinha
  /** Um valor por strike de `strikes`, na mesma ordem (0 onde a série não negociou). */
  valores: number[]
  total: number
  /** Strike com o maior valor da linha, ou null se a linha é toda zero. */
  picoStrike: number | null
  picoValor: number
}

export interface DadosDoGrafico {
  strikes: number[]
  linhas: LinhaDoGrafico[]
  maximo: number
}

export const FAIXAS_DO_GRAFICO: (number | null)[] = [10, 20, 30, null]

/**
 * Valores por strike. A série só conta se negociou no `dataPregao`; as que só negociaram em dias anteriores entram como zero
 * (o eixo mostra todos os strikes listados). `faixaPct` limita os strikes a ±% do preço do ativo; null mostra todos. Séries
 * diferentes do mesmo tipo, vencimento e strike (como as ajustadas por proventos) somam.
 */
export function dadosNegociosPorStrike(
  ativo: AtivoComOpcoes, vencimentos: string[], modo: ModoTipos, metrica: Metrica, dataPregao: string | null, faixaPct: number | null,
): DadosDoGrafico {
  const escolhidos = new Set(vencimentos)
  const minimo = faixaPct === null ? -Infinity : ativo.cotacao * (1 - faixaPct / 100)
  const maximo = faixaPct === null ? Infinity : ativo.cotacao * (1 + faixaPct / 100)
  const series = ativo.series.filter((s) => escolhidos.has(s.vencimento) && s.strike >= minimo && s.strike <= maximo)
  const strikes = [...new Set(series.map((s) => s.strike))].sort((a, b) => a - b)
  const posicao = new Map(strikes.map((k, i) => [k, i]))
  const valorDe = (s: (typeof series)[number]) => (s.dataUltimo === dataPregao ? (metrica === 'negocios' ? s.negocios : s.volume) : 0)

  const tipos: TipoDaLinha[] = modo === 'separados' ? ['call', 'put'] : modo === 'soma' ? ['soma'] : modo === 'calls' ? ['call'] : ['put']
  const linhas: LinhaDoGrafico[] = []
  for (const vencimento of [...escolhidos].sort()) {
    for (const tipo of tipos) {
      const valores = Array<number>(strikes.length).fill(0)
      for (const s of series) {
        if (s.vencimento !== vencimento || (tipo !== 'soma' && s.tipo !== tipo)) continue
        valores[posicao.get(s.strike)!] += valorDe(s)
      }
      const picoValor = Math.max(0, ...valores)
      linhas.push({
        id: `${vencimento}-${tipo}`,
        vencimento,
        tipo,
        valores,
        total: valores.reduce((a, b) => a + b, 0),
        picoStrike: picoValor > 0 ? strikes[valores.indexOf(picoValor)] : null,
        picoValor,
      })
    }
  }
  return { strikes, linhas, maximo: Math.max(0, ...linhas.map((l) => l.picoValor)) }
}

/** Posição (em %) do strike em relação ao preço do ativo: 0 é no preço, negativo é abaixo. */
export function distanciaDoPreco(strike: number, cotacao: number): number {
  return (strike / cotacao - 1) * 100
}
