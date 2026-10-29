import { temDestaque } from '../domain/destaquesRadares'
import type { DestaquesDoAtivo, IndiceDeDestaques } from '../domain/destaquesRadares'
import { ROTULO_TIPO_RADAR } from '../domain/radarDividendos'
import { formatarData } from '../domain/rendaFii'

type Selo = keyof DestaquesDoAtivo

/** Um selo por radar: o emoji do código na lista, o texto da legenda e o da linha-resumo do grupo. */
const SELOS: Record<Selo, { emoji: string; legenda: string; resumo: string }> = {
  dividendos: { emoji: '💰', legenda: 'está no Top 15 pagadoras de dividendos', resumo: 'no Top 15 de dividendos' },
  radar: { emoji: '📅', legenda: 'tem provento já anunciado pela B3 a pagar (agenda de dividendos)', resumo: 'com provento anunciado' },
  endividada: { emoji: '⚠️', legenda: 'está no Top 15 mais endividadas', resumo: 'no Top 15 mais endividadas' },
  maisNegociado: { emoji: '🔥', legenda: 'está no Top 15 mais negociados', resumo: 'no Top 15 mais negociados' },
  naCategoria: { emoji: '📊', legenda: 'está entre os mais negociados da sua categoria', resumo: 'entre os mais negociados da categoria' },
  indice: { emoji: '🏛️', legenda: 'está entre os maiores pesos do índice', resumo: 'entre os maiores pesos do índice' },
}

const pct = (v: number, casas = 1) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
const reaisPorCota = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** Selos do código na lista por grupo. Decorativos para leitor de tela: o detalhe está no cartão do ativo. */
export function Selos({ d, usa }: { d?: DestaquesDoAtivo; usa: readonly Selo[] }) {
  const mostrar = usa.filter((s) => d?.[s])
  if (mostrar.length === 0) return null
  return (
    <span aria-hidden="true" data-testid="selos" title="Este ativo aparece nos radares do app" style={{ marginLeft: 4, fontSize: 11 }}>
      {mostrar.map((s) => SELOS[s].emoji).join('')}
    </span>
  )
}

export function LegendaDosSelos({ usa }: { usa: readonly Selo[] }) {
  return (
    <div className="tiny muted justify" style={{ lineHeight: 1.5 }} data-testid="legenda-selos">
      Selos nos códigos:{' '}
      {usa.map((s, i) => (
        <span key={s}><strong>{SELOS[s].emoji}</strong> {SELOS[s].legenda}{i < usa.length - 1 ? '; ' : '. '}</span>
      ))}
      Toque no código para ver os detalhes.
    </div>
  )
}

/** Uma linha por grupo (setor, categoria): quais ativos dele estão nos radares, para achar os exemplos sem abrir um a um. */
export function ResumoDoGrupo({ tickers, indice, usa }: { tickers: string[]; indice: IndiceDeDestaques; usa: readonly Selo[] }) {
  const partes = usa
    .map((s) => ({ s, lista: tickers.filter((t) => indice.get(t)?.[s]) }))
    .filter((x) => x.lista.length > 0)
    .map((x) => `${SELOS[x.s].emoji} ${SELOS[x.s].resumo}: ${x.lista.join(', ')}`)
  if (partes.length === 0) return null
  return <div className="tiny muted" style={{ lineHeight: 1.5 }} data-testid="resumo-setor">{partes.join(' · ')}</div>
}

/** Cartão "nos nossos radares": o que os rankings abertos e a agenda de dividendos já dizem sobre o ativo aberto. */
export function NosRadares({ ticker, d, usa, nenhum }: { ticker: string; d?: DestaquesDoAtivo; usa: readonly Selo[]; nenhum: string }) {
  const v = (s: Selo) => (usa.includes(s) ? d?.[s] : undefined)
  const dividendos = v('dividendos') as DestaquesDoAtivo['dividendos']
  const radar = v('radar') as DestaquesDoAtivo['radar']
  const endividada = v('endividada') as DestaquesDoAtivo['endividada']
  const maisNegociado = v('maisNegociado') as DestaquesDoAtivo['maisNegociado']
  const naCategoria = v('naCategoria') as DestaquesDoAtivo['naCategoria']
  const indice = v('indice') as DestaquesDoAtivo['indice']
  const vazio = !temDestaque({ dividendos, radar, endividada, maisNegociado, naCategoria, indice })

  return (
    <div className="card col" style={{ gap: 8 }} data-testid="nos-radares">
      <span style={{ fontWeight: 700 }}>{ticker} nos nossos radares</span>
      {vazio ? (
        <span className="small muted justify">{nenhum}</span>
      ) : (
        <>
          {dividendos && (
            <div className="small justify">💰 <strong>{dividendos.posicao}º no Top 15 pagadoras de dividendos</strong>, com dividend yield de {pct(dividendos.dy * 100)} nos últimos 12 meses.</div>
          )}
          {radar && (
            <div className="small justify">
              📅 <strong>Provento anunciado:</strong> {ROTULO_TIPO_RADAR[radar.proximo.tipo] ?? radar.proximo.tipo} de {reaisPorCota(radar.proximo.valor)} por ação,{' '}
              {radar.proximo.pagamentoEm ? `pago em ${formatarData(radar.proximo.pagamentoEm)}` : 'data de pagamento ainda não definida'}
              {radar.aindaTemDireito ? `; quem comprar até ${formatarData(radar.proximo.dataCom)} ainda tem direito` : `; a data com (${formatarData(radar.proximo.dataCom)}) já passou`}
              {radar.total > 1 ? ` (+${radar.total - 1} ${radar.total - 1 === 1 ? 'outro anunciado' : 'outros anunciados'})` : ''}.
            </div>
          )}
          {endividada && (
            <div className="small justify">⚠️ <strong>{endividada.posicao}ª no Top 15 mais endividadas</strong>, com dívida líquida de {endividada.dlEbitda.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x o EBITDA. É um ponto de atenção, não uma recomendação.</div>
          )}
          {maisNegociado && (
            <div className="small justify">🔥 <strong>{maisNegociado.posicao}º no Top 15 mais negociados</strong>: liquidez alta, o que facilita comprar e vender.</div>
          )}
          {naCategoria && (
            <div className="small justify">📊 <strong>{naCategoria.posicao}º entre os mais negociados de {naCategoria.categoria}</strong>.</div>
          )}
          {indice && (
            <div className="small justify">🏛️ <strong>{indice.posicao}º maior peso do {indice.nome}</strong>, com {pct(indice.peso, 2)} da carteira teórica do índice.</div>
          )}
        </>
      )}
      <span className="tiny muted justify">Cruzamento de listas do app, só fato publicado: não é recomendação de compra.{radar || dividendos ? ' A data com é o último dia para ter direito ao provento.' : ''}</span>
    </div>
  )
}
