/**
 * Destaques dos ativos nos radares do app (D131): liga cada ativo do Simule Ações, FII, BDR e ETF ao que os rankings abertos e o radar
 * de dividendos já dizem sobre ele. Módulo PURO: só cruza arquivos já publicados, sem recalcular nota nem reordenar. Só usa listas de
 * acesso aberto; os rankings liberados por código (Top 15 mais baratas, FIIs baratos, BDRs com desconto) não entram aqui.
 */

import type { SnapshotAcoesDividendos } from './acoesDividendos'
import type { SnapshotAcoesEndividadas } from './acoesEndividadas'
import type { PagamentoAnunciado, SnapshotRadarDividendos } from './radarDividendos'
import type { SnapshotIndice, SnapshotMaisNegociados } from './top15Mercado'

export interface DestaquesDoAtivo {
  /** Posição e dividend yield de 12 meses, quando a ação está no Top 15 pagadoras de dividendos. */
  dividendos?: { posicao: number; dy: number }
  /** Posição e dívida líquida ÷ EBITDA, quando a ação está no Top 15 mais endividadas (ponto de atenção, não de compra). */
  endividada?: { posicao: number; dlEbitda: number }
  /** Proventos já anunciados e ainda a pagar, do pagamento mais próximo ao mais distante. */
  radar?: { proximo: PagamentoAnunciado; total: number; aindaTemDireito: boolean }
  /** Posição no Top 15 mais negociados da classe (ordem de volume). */
  maisNegociado?: { posicao: number }
  /** Posição entre os mais negociados da própria categoria ou setor (ex.: "Logística", "Bolsa exterior"). */
  naCategoria?: { posicao: number; categoria: string }
  /** Posição e peso (%) no índice (Ibovespa ou IFIX), quando está entre os maiores pesos. */
  indice?: { nome: string; posicao: number; peso: number }
}

export type IndiceDeDestaques = Map<string, DestaquesDoAtivo>

export const temDestaque = (d?: DestaquesDoAtivo): d is DestaquesDoAtivo => Boolean(d && Object.values(d).some(Boolean))

export function indexarDestaques({
  dividendos, endividadas, radar, maisNegociados, indice: indiceDoMercado, hoje,
}: {
  dividendos?: Pick<SnapshotAcoesDividendos, 'publicado' | 'ranking' | 'tamanhoDaLista'>
  endividadas?: Pick<SnapshotAcoesEndividadas, 'publicado' | 'ranking' | 'tamanhoDaLista'>
  radar?: Pick<SnapshotRadarDividendos, 'publicado' | 'pagamentos'>
  maisNegociados?: Pick<SnapshotMaisNegociados, 'publicado' | 'geral' | 'porCategoria'>
  indice?: Pick<SnapshotIndice, 'publicado' | 'indice' | 'ranking'>
  hoje: string
}): IndiceDeDestaques {
  const indice: IndiceDeDestaques = new Map()
  const de = (t: string) => {
    let d = indice.get(t)
    if (!d) indice.set(t, (d = {}))
    return d
  }

  if (dividendos?.publicado) {
    for (const r of dividendos.ranking.slice(0, dividendos.tamanhoDaLista)) de(r.ticker).dividendos = { posicao: r.posicao, dy: r.dy }
  }
  if (endividadas?.publicado) {
    endividadas.ranking.slice(0, endividadas.tamanhoDaLista).forEach((r, i) => {
      if (r.dlEbitda !== null) de(r.ticker).endividada = { posicao: r.posicao ?? i + 1, dlEbitda: r.dlEbitda }
    })
  }
  if (radar?.publicado) {
    const porTicker = new Map<string, PagamentoAnunciado[]>()
    // A agenda guarda também o que já foi pago; o cartão da ação só fala do que ainda vai cair na conta.
    for (const p of radar.pagamentos.filter((x) => x.pagamentoEm === null || x.pagamentoEm >= hoje)) porTicker.set(p.ticker, [...(porTicker.get(p.ticker) ?? []), p])
    for (const [ticker, lista] of porTicker) {
      // Sem data de pagamento vai por último; as demais, da mais próxima para a mais distante.
      const ordenados = [...lista].sort((a, b) => (a.pagamentoEm ?? '9999').localeCompare(b.pagamentoEm ?? '9999'))
      de(ticker).radar = { proximo: ordenados[0], total: lista.length, aindaTemDireito: lista.some((p) => p.dataCom >= hoje) }
    }
  }
  if (maisNegociados?.publicado) {
    maisNegociados.geral.forEach((r, i) => { de(r.ticker).maisNegociado = { posicao: r.posicaoGeral ?? i + 1 } })
    for (const [categoria, lista] of Object.entries(maisNegociados.porCategoria)) {
      lista.forEach((r, i) => { de(r.ticker).naCategoria = { posicao: r.posicaoNaCategoria ?? i + 1, categoria } })
    }
  }
  if (indiceDoMercado?.publicado) {
    for (const r of indiceDoMercado.ranking) de(r.ticker).indice = { nome: indiceDoMercado.indice, posicao: r.posicao, peso: r.peso }
  }
  return indice
}
