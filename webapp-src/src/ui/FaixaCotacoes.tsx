import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import type { SnapshotAcoes } from '../domain/acoes'
import type { SnapshotBdrs } from '../domain/bdrs'
import type { SnapshotEtfs } from '../domain/etfs'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import { dataCurta } from '../domain/mercadoOficial'
import type { SnapshotOpcoes } from '../domain/opcoes'
import type { SnapshotRendimentosFii } from '../domain/rendaFii'

export interface ItemCotacao {
  rotulo: string
  /** Preço no último fechamento, em reais. */
  cotacao: number
  /** Variação em %, quando existir. */
  variacao?: number | null
  /** Casas decimais do preço (o dólar usa 4). */
  casas?: number
}

const QUANTIDADE = 14

function brl(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

interface ComVolume {
  ticker: string
  cotacao: number | null
  volumeMedio?: number | null
  /** Variação do último pregão, quando o arquivo traz (verde/vermelho na faixa). */
  variacaoDia?: number | null
}

/** Os de maior volume negociado, no último fechamento. */
function maisNegociados(lista: ComVolume[]): ItemCotacao[] {
  return lista
    .filter((a): a is ComVolume & { cotacao: number } => a.cotacao != null)
    .sort((a, b) => (b.volumeMedio ?? 0) - (a.volumeMedio ?? 0))
    .slice(0, QUANTIDADE)
    .map((a) => ({ rotulo: a.ticker, cotacao: a.cotacao, variacao: a.variacaoDia ?? null }))
}

export const itensDeAcoes = (s: SnapshotAcoes) => maisNegociados(s.setores.flatMap((x) => x.empresas))
export const itensDeFiis = (s: SnapshotRendimentosFii) => maisNegociados(s.fundos)
export const itensDeBdrs = (s: SnapshotBdrs) => maisNegociados([...s.acoes, ...s.etfs])
export const itensDeEtfs = (s: SnapshotEtfs) => maisNegociados(s.etfs)

/** Ativos com mais negócios em opções, com a variação do dia quando o arquivo traz. */
export function itensDeOpcoes(s: SnapshotOpcoes): ItemCotacao[] {
  return [...s.ativos]
    .sort((a, b) => b.volumeOpcoes - a.volumeOpcoes)
    .slice(0, QUANTIDADE)
    .map((a) => ({ rotulo: a.ticker, cotacao: a.cotacao, variacao: a.variacao ?? null }))
}

/** Dólar PTAX (Banco Central) como primeiro item, quando o arquivo de mercado tem. */
export function itemDolar(mercado: SnapshotMercado = SNAPSHOT_MERCADO): ItemCotacao | null {
  const d = mercado.indicadores.dolarPtax
  if (!d) return null
  const variacao = d.valorAnterior ? (d.valor / d.valorAnterior - 1) * 100 : null
  return { rotulo: `Dólar PTAX (${dataCurta(d.data)})`, cotacao: d.valor, variacao, casas: 4 }
}

/**
 * Faixa de cotações que rola da direita para a esquerda, para qualquer tela de ativos: cada tela passa
 * a sua lista. Mostra o último fechamento (o app não tem cotação em tempo real) e a data na legenda.
 * Pausa ao passar o mouse e respeita "reduzir movimento".
 */
export function FaixaCotacoes({ itens, dataPregao }: { itens: ItemCotacao[]; dataPregao: string | null }) {
  const dolar = itemDolar()
  const todos = dolar ? [dolar, ...itens] : itens
  if (todos.length === 0) return null
  const lista = (oculto: boolean) => (
    <ul className="faixa-cotacoes-lista" aria-hidden={oculto || undefined}>
      {todos.map((i) => (
        <li key={i.rotulo}>
          <strong>{i.rotulo}</strong> <span>R$ {brl(i.cotacao, i.casas ?? 2)}</span>
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
      {dataPregao && (
        <div className="tiny muted" style={{ marginTop: 4 }}>
          Fechamento de {dataCurta(dataPregao)} (B3). Não é cotação em tempo real.
        </div>
      )}
    </div>
  )
}
