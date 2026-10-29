import { useState } from 'react'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'
import { ROTULO_TIPO_RADAR, agruparPorMes, aindaTemDireito } from '../domain/radarDividendos'
import type { SnapshotRadarDividendos } from '../domain/radarDividendos'
import { formatarData } from '../domain/rendaFii'

/** Provento por ação tem centavos quebrados (0,0317); quatro casas evitam arredondar para zero. */
const reaisPorAcao = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })

/**
 * Radar de dividendos (D130): o que as empresas do cadastro já anunciaram e ainda vão pagar, mês a mês, com o valor por ação,
 * a data com e a data de pagamento. Só fato publicado pela B3, sem projeção: o que a empresa ainda não anunciou não aparece.
 */
export function RadarDividendos({ snapshot, hoje }: { snapshot?: SnapshotRadarDividendos; hoje?: string }) {
  const s = snapshot ?? SNAPSHOT_RADAR_DIVIDENDOS
  const dia = hoje ?? s.dataReferencia
  const [busca, setBusca] = useState('')
  if (!s.publicado || s.pagamentos.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid="radar-dividendos-vazio">
        <span style={{ fontWeight: 700 }}>Radar de dividendos: nenhum pagamento anunciado</span>
        <span className="muted small justify">A B3 não tem, no momento, provento anunciado e a pagar para as empresas do cadastro.</span>
      </div>
    )
  }
  const grupos = agruparPorMes(s.pagamentos, busca)

  return (
    <div className="col" style={{ gap: 14 }} data-testid="radar-dividendos">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Radar de dividendos</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Proventos que a empresa <strong>já anunciou</strong> e ainda vão cair na conta, mês a mês, com o valor <strong>por ação</strong>. Não é previsão: o que ainda não foi anunciado não aparece aqui.
          Quem tinha a ação até a <strong>data com</strong> recebe; comprar depois dela não dá direito a esse provento. O JCP está em valor bruto (há 15% de imposto retido na fonte).
        </div>
        <div className="tiny muted" data-testid="radar-dividendos-resumo">
          {s.pagamentos.length} pagamentos de {s.comPagamento} empresas · dados da B3 de {formatarData(s.dataReferencia)}
        </div>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Filtrar por código ou nome (ex.: PETR4)"
        aria-label="Filtrar o radar por código ou nome"
        className="input"
      />

      {grupos.length === 0 ? (
        <span className="muted small" role="status">Nenhum pagamento anunciado para essa busca.</span>
      ) : (
        grupos.map((g) => (
          <section key={g.mes ?? 'sem-data'} className="card col" style={{ gap: 8 }} aria-label={g.rotulo} data-testid={`radar-mes-${g.mes ?? 'sem-data'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ fontSize: 15, textTransform: 'capitalize' }}>{g.rotulo}</h3>
              <span className="tiny muted">{g.pagamentos.length} {g.pagamentos.length === 1 ? 'pagamento' : 'pagamentos'}</span>
            </div>
            <div className="col" style={{ gap: 6 }}>
              {g.pagamentos.map((p, i) => (
                <div key={`${p.ticker}-${p.tipo}-${p.dataCom}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }} data-testid="radar-linha">
                  <div className="col" style={{ gap: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700 }}>{p.ticker} <span className="muted small" style={{ fontWeight: 400 }}>{p.nome}</span></span>
                    <span className="tiny muted">
                      {ROTULO_TIPO_RADAR[p.tipo] ?? p.tipo} · {p.pagamentoEm ? `paga em ${formatarData(p.pagamentoEm)}` : 'pagamento sem data'} · data com {formatarData(p.dataCom)}
                      {aindaTemDireito(p, dia) ? ' (ainda dá tempo)' : ''}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{reaisPorAcao(p.valor)}<span className="tiny muted" style={{ fontWeight: 400 }}> /ação</span></span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {s.falhas.length > 0 && (
        <div className="tiny muted justify" role="note">Não foi possível ler da B3 neste dia: {s.falhas.join(', ')}.</div>
      )}
      <div className="tiny muted justify" role="note">
        Fonte: cadastro de cada empresa na B3 (proventos em dinheiro aprovados). A empresa pode alterar datas e valores. Não é recomendação de investimento.
      </div>
    </div>
  )
}
