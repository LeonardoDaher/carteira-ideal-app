// Top 15 confluência (D123): ordena as ações do cadastro pela confluência entre a leitura técnica e a fundamentalista (confluencia.ts).
// Módulo PURO: cada ação passa pelas mesmas análises da aba Confluência, então o número é o mesmo nas duas telas. Há duas listas:
// positivas (fundamentos favoráveis e gráfico a favor, da maior nota combinada para a menor) e negativas (fundamentos fracos e gráfico
// em baixa, da menor nota para a maior). Ações de liquidez baixa ficam de fora. Não é recomendação (D19).

import type { Premissas, SnapshotFundamentos } from './analiseFundamentalista'
import { analisarFundamentos } from './analiseFundamentalista'
import type { Horizonte, SnapshotSeries } from './analiseTecnica'
import { analisarTecnica } from './analiseTecnica'
import type { Confluencia } from './confluencia'
import { analisarConfluencia } from './confluencia'

export interface ItemConfluencia {
  posicao: number
  ticker: string
  nome: string | null
  preco: number
  confluencia: Confluencia
}

export interface RankingConfluencia {
  horizonte: Horizonte
  /** Ações com as duas análises calculadas. */
  avaliadas: number
  /** Ações do cadastro de preços sem as duas análises (histórico curto ou sem fundamentos). */
  semAnalise: number
  /** Ações em confluência positiva ou negativa retiradas por liquidez baixa. */
  semLiquidez: number
  positivas: ItemConfluencia[]
  negativas: ItemConfluencia[]
}

const ORDEM_CONVICCAO = { alta: 0, media: 1, baixa: 2 } as const

export function rankingDeConfluencia({
  series, fundamentos, precoDe, dataPreco, horizonte, premissas, nomeDe,
}: {
  series: SnapshotSeries
  fundamentos: SnapshotFundamentos
  precoDe: (ticker: string) => number | null
  dataPreco: string
  horizonte: Horizonte
  premissas?: Partial<Premissas>
  nomeDe?: (ticker: string) => string | null
}): RankingConfluencia {
  const todas = Object.values(fundamentos.empresas)
  const pos: Omit<ItemConfluencia, 'posicao'>[] = []
  const neg: Omit<ItemConfluencia, 'posicao'>[] = []
  let avaliadas = 0
  let semAnalise = 0
  let semLiquidez = 0

  for (const [ticker, pontos] of Object.entries(series.ativos)) {
    const empresa = fundamentos.empresas[ticker]
    const tecnica = analisarTecnica({ ticker, pregoes: series.pregoes, pontos, referencia: series.referencia, alertas: series.alertas[ticker], horizonte })
    const fundamentalista = empresa
      ? analisarFundamentos({ empresa, precoDe, todas, geradoEm: fundamentos.geradoEm, dataCorte: fundamentos.dataCorte, dataPreco, premissas })
      : null
    if (!tecnica || !fundamentalista) {
      semAnalise++
      continue
    }
    const c = analisarConfluencia({ ticker, tecnica, fundamentalista, horizonte })
    if (c.pontuacao.valor === null) {
      semAnalise++
      continue
    }
    avaliadas++
    if (c.situacao !== 'confluencia-positiva' && c.situacao !== 'confluencia-negativa') continue
    if (tecnica.volume.liquidez === 'baixa') {
      semLiquidez++
      continue
    }
    ;(c.situacao === 'confluencia-positiva' ? pos : neg).push({ ticker, nome: nomeDe?.(ticker) ?? null, preco: tecnica.preco, confluencia: c })
  }

  const nota = (x: Omit<ItemConfluencia, 'posicao'>) => x.confluencia.pontuacao.valor ?? 0
  const ordenar = (l: Omit<ItemConfluencia, 'posicao'>[], sentido: 1 | -1) =>
    l
      .sort((a, b) => sentido * (nota(b) - nota(a)) || ORDEM_CONVICCAO[a.confluencia.conviccao] - ORDEM_CONVICCAO[b.confluencia.conviccao] || a.ticker.localeCompare(b.ticker))
      .map((x, i) => ({ ...x, posicao: i + 1 }))
  return { horizonte, avaliadas, semAnalise, semLiquidez, positivas: ordenar(pos, 1), negativas: ordenar(neg, -1) }
}
