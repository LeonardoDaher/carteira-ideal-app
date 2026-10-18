import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import type { SnapshotAcoes } from '../domain/acoes'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import { dataCurta } from '../domain/mercadoOficial'

export interface ItemCotacao {
  rotulo: string
  valor: string
  /** Variação em %, quando existir. */
  variacao?: number | null
}

const QUANTIDADE_ACOES = 14

function brl(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Itens da faixa: dólar PTAX (Banco Central) e as ações de maior volume da lista, no último fechamento. */
export function itensDaFaixa(snapshot: SnapshotAcoes, mercado: SnapshotMercado = SNAPSHOT_MERCADO): ItemCotacao[] {
  const itens: ItemCotacao[] = []
  const dolar = mercado.indicadores.dolarPtax
  if (dolar) {
    const variacao = dolar.valorAnterior ? ((dolar.valor / dolar.valorAnterior) - 1) * 100 : null
    itens.push({ rotulo: `Dólar PTAX (${dataCurta(dolar.data)})`, valor: `R$ ${brl(dolar.valor, 4)}`, variacao })
  }
  const acoes = snapshot.setores
    .flatMap((s) => s.empresas)
    .sort((a, b) => b.volumeMedio - a.volumeMedio)
    .slice(0, QUANTIDADE_ACOES)
  for (const a of acoes) itens.push({ rotulo: a.ticker, valor: `R$ ${brl(a.cotacao)}` })
  return itens
}

/**
 * Faixa de cotações que rola da direita para a esquerda. Mostra o último fechamento (o app não tem
 * cotação em tempo real); a legenda diz a data. Pausa ao passar o mouse e respeita "reduzir movimento".
 */
export function FaixaCotacoes({ snapshot }: { snapshot: SnapshotAcoes }) {
  const itens = itensDaFaixa(snapshot)
  if (itens.length === 0) return null
  const lista = (oculto: boolean) => (
    <ul className="faixa-cotacoes-lista" aria-hidden={oculto || undefined}>
      {itens.map((i) => (
        <li key={i.rotulo}>
          <strong>{i.rotulo}</strong> <span>{i.valor}</span>
          {i.variacao != null && (
            <span className={i.variacao >= 0 ? 'faixa-alta' : 'faixa-baixa'}>
              {' '}{i.variacao >= 0 ? '▲' : '▼'} {brl(Math.abs(i.variacao))}%
            </span>
          )}
        </li>
      ))}
    </ul>
  )
  return (
    <div className="faixa-cotacoes" role="region" aria-label="Cotações no último fechamento">
      <div className="faixa-cotacoes-trilho">
        {lista(false)}
        {lista(true)}
      </div>
      {snapshot.dataPregao && (
        <div className="tiny muted" style={{ marginTop: 4 }}>
          Ações: fechamento de {dataCurta(snapshot.dataPregao)} (B3). Não é cotação em tempo real.
        </div>
      )}
    </div>
  )
}
