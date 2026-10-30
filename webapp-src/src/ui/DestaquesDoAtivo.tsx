import { temDestaque } from '../domain/destaquesRadares'
import type { DestaquesDoAtivo, IndiceDeDestaques } from '../domain/destaquesRadares'
import { ROTULO_TIPO_RADAR } from '../domain/radarDividendos'
import { formatarData } from '../domain/rendaFii'

type Selo = keyof DestaquesDoAtivo

const pct = (v: number, casas = 1) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
const reaisPorCota = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })

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

const REGEX_CODIGO = /\b[A-Z0-9]{4}\d{1,2}\b/g

/** Códigos citados num texto de exemplo, sem repetir e na ordem em que aparecem. */
export function codigosDoTexto(texto: string): string[] {
  return [...new Set(texto.match(REGEX_CODIGO) ?? [])]
}

/** Frases curtas do que um ativo tem nos radares, uma por radar. */
function frasesDoAtivo(d: DestaquesDoAtivo): string[] {
  const f: string[] = []
  if (d.dividendos) f.push(`💰 ${d.dividendos.posicao}º no Top 15 de dividendos (dividend yield de ${pct(d.dividendos.dy * 100)} em 12 meses)`)
  if (d.radar) {
    const p = d.radar.proximo
    f.push(`📅 ${ROTULO_TIPO_RADAR[p.tipo] ?? p.tipo} de ${reaisPorCota(p.valor)} por ação${p.pagamentoEm ? `, pago em ${formatarData(p.pagamentoEm)}` : ''}${d.radar.aindaTemDireito ? `, data com ${formatarData(p.dataCom)}` : ''}`)
  }
  if (d.maisNegociado) f.push(`🔥 ${d.maisNegociado.posicao}º no Top 15 mais negociados`)
  else if (d.naCategoria) f.push(`📊 ${d.naCategoria.posicao}º mais negociado de ${d.naCategoria.categoria}`)
  if (d.indice) f.push(`🏛️ ${d.indice.posicao}º maior peso do ${d.indice.nome} (${pct(d.indice.peso, 2)})`)
  if (d.endividada) f.push(`⚠️ ${d.endividada.posicao}ª no Top 15 mais endividadas`)
  return f
}

/**
 * Nos exemplos da carteira de referência: dos códigos citados no texto, mostra o que cada um tem hoje nos radares do app. Quem não
 * aparece em nenhum radar não ganha linha. Só fato publicado, não é recomendação.
 */
export function RadaresDosExemplos({ texto, indice }: { texto: string; indice: IndiceDeDestaques }) {
  const itens = codigosDoTexto(texto).flatMap((t) => {
    const d = indice.get(t)
    return temDestaque(d) ? [{ ticker: t, frases: frasesDoAtivo(d) }] : []
  })
  if (itens.length === 0) return null
  return (
    <div className="col" style={{ gap: 4, marginTop: 6 }} data-testid="radares-dos-exemplos">
      <span className="tiny" style={{ fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Nos nossos radares hoje</span>
      {itens.map((i) => (
        <span key={i.ticker} className="muted tiny justify" style={{ lineHeight: 1.5, display: 'block' }}>
          <strong style={{ color: 'var(--text)' }}>{i.ticker}</strong>: {i.frases.join(' · ')}
        </span>
      ))}
      <span className="tiny muted justify" style={{ lineHeight: 1.4 }}>Cruzamento de listas do app, só fato publicado: não é recomendação de compra.</span>
    </div>
  )
}
