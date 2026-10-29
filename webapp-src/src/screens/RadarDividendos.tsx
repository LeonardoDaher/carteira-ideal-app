import { useState } from 'react'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'
import { ROTULO_TIPO_RADAR, aindaTemDireito, doMes, limitesDosMeses, mesInicial, rotuloDoMes, semDataDePagamento, somarMeses } from '../domain/radarDividendos'
import type { BaseDaData, PagamentoAnunciado, SnapshotRadarDividendos } from '../domain/radarDividendos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'

/** Provento por ação tem centavos quebrados (0,0317); quatro casas evitam arredondar para zero. */
const reaisPorAcao = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })

function Linha({ p, hoje }: { p: PagamentoAnunciado; hoje: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="radar-linha">
      <LogoAtivo ticker={p.ticker} />
      <div className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 700 }}>
          {p.ticker} <span className="muted small" style={{ fontWeight: 400 }}>{p.nome}</span>
        </span>
        <span className="tiny muted">
          {ROTULO_TIPO_RADAR[p.tipo] ?? p.tipo} · Data com {formatarData(p.dataCom)}
          {aindaTemDireito(p, hoje) ? ' (ainda dá tempo)' : ''} · Pagamento {p.pagamentoEm ? formatarData(p.pagamentoEm) : 'sem data'}
        </span>
      </div>
      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        {reaisPorAcao(p.valor)}
        <span className="tiny muted" style={{ fontWeight: 400 }}> /ação</span>
      </span>
    </div>
  )
}

/**
 * Agenda de dividendos (D130): o que as empresas do cadastro anunciaram, mês a mês, com o valor por ação, a data com e a data de
 * pagamento. Só fato publicado pela B3, sem projeção: o que a empresa ainda não anunciou não aparece.
 */
export function RadarDividendos({ snapshot, hoje }: { snapshot?: SnapshotRadarDividendos; hoje?: string }) {
  const s = snapshot ?? SNAPSHOT_RADAR_DIVIDENDOS
  const dia = hoje ?? s.dataReferencia
  const [base, setBase] = useState<BaseDaData>('pagamento')
  const [mes, setMes] = useState(() => mesInicial(s.pagamentos, 'pagamento', dia))
  const [busca, setBusca] = useState('')
  if (!s.publicado || s.pagamentos.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid="radar-dividendos-vazio">
        <span style={{ fontWeight: 700 }}>Agenda de dividendos: nenhum pagamento anunciado</span>
        <span className="muted small justify">A B3 não tem, no momento, provento anunciado para as empresas do cadastro.</span>
      </div>
    )
  }
  const lim = limitesDosMeses(s.pagamentos, base)
  const linhas = doMes(s.pagamentos, mes, base, busca)
  const semData = base === 'pagamento' ? semDataDePagamento(s.pagamentos, busca) : []
  const trocarBase = (b: BaseDaData) => {
    setBase(b)
    setMes((m) => {
      const l = limitesDosMeses(s.pagamentos, b)
      return l && (m < l.primeiro || m > l.ultimo) ? mesInicial(s.pagamentos, b, dia) : m
    })
  }

  return (
    <div className="col" style={{ gap: 14 }} data-testid="radar-dividendos">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Agenda de dividendos</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Proventos que a empresa <strong>já anunciou</strong>, mês a mês, com o valor <strong>por ação</strong>. Não é previsão: o que ainda não foi anunciado não aparece aqui.
          Quem tinha a ação até a <strong>data com</strong> recebe; comprar depois dela não dá direito a esse provento. O JCP está em valor bruto (há 15% de imposto retido na fonte).
        </div>
        <div className="tiny muted" data-testid="radar-dividendos-resumo">
          {s.pagamentos.length} pagamentos de {s.comPagamento} empresas · dados da B3 de {formatarData(s.dataReferencia)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="chip" aria-label="Mês anterior" disabled={!lim || mes <= lim.primeiro} onClick={() => setMes((m) => somarMeses(m, -1))}>‹</button>
          <strong data-testid="radar-mes-atual" style={{ minWidth: 150, textAlign: 'center' }}>{rotuloDoMes(mes)}</strong>
          <button type="button" className="chip" aria-label="Próximo mês" disabled={!lim || mes >= lim.ultimo} onClick={() => setMes((m) => somarMeses(m, 1))}>›</button>
        </div>
        <div role="group" aria-label="Organizar por" style={{ display: 'flex', gap: 6 }}>
          {(['com', 'pagamento'] as const).map((b) => (
            <button key={b} type="button" className={`chip ${base === b ? 'selected' : ''}`} aria-pressed={base === b} onClick={() => trocarBase(b)}>
              {b === 'com' ? 'Data com' : 'Data pagamento'}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar ativos (ex.: PETR4)"
        aria-label="Filtrar a agenda por código ou nome"
        className="input-cotas"
      />

      <section className="card col" style={{ gap: 10 }} aria-label={rotuloDoMes(mes)} data-testid="radar-lista">
        {linhas.length === 0 ? (
          <span className="muted small" role="status">Nenhum pagamento {busca ? 'para essa busca ' : ''}em {rotuloDoMes(mes).toLowerCase()}.</span>
        ) : (
          <>
            <span className="tiny muted">{linhas.length} {linhas.length === 1 ? 'pagamento' : 'pagamentos'} · ordenados por {base === 'com' ? 'data com' : 'data de pagamento'}</span>
            {linhas.map((p, i) => <Linha key={`${p.ticker}-${p.tipo}-${p.dataCom}-${i}`} p={p} hoje={dia} />)}
          </>
        )}
      </section>

      {semData.length > 0 && (
        <section className="card col" style={{ gap: 10 }} aria-label="Sem data de pagamento definida" data-testid="radar-sem-data">
          <h3 style={{ fontSize: 15 }}>Sem data de pagamento definida</h3>
          <span className="tiny muted">A empresa anunciou o provento, mas ainda não marcou o dia do pagamento.</span>
          {semData.map((p, i) => <Linha key={`${p.ticker}-${p.tipo}-${p.dataCom}-${i}`} p={p} hoje={dia} />)}
        </section>
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
