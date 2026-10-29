import { useMemo, useState } from 'react'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'
import { SNAPSHOT_RADAR_INTELIGENTE } from '../data/snapshotRadarInteligente'
import { MESES_CURTOS, montarGrade, setoresDoRadar } from '../domain/radarInteligente'
import type { CelulaDoMes, SnapshotRadarInteligente } from '../domain/radarInteligente'
import type { BaseDaData, PagamentoAnunciado } from '../domain/radarDividendos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'

const ROTULO: Record<CelulaDoMes['status'], string> = { pago: 'Já pago', confirmado: 'Anunciado pela empresa', provavel: 'Provável pelo histórico' }

function Celula({ c, mes }: { c: CelulaDoMes | null; mes: string }) {
  if (!c) return <span aria-hidden="true" />
  const confirmado = c.status !== 'provavel'
  const texto = c.status === 'provavel' ? `${ROTULO.provavel}: pagou em ${mes} em ${c.anos} dos últimos anos` : `${ROTULO[c.status]} em ${mes}`
  return (
    <span
      role="img"
      aria-label={texto}
      title={texto}
      data-testid={`celula-${c.status}`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, fontSize: 13, fontWeight: 700,
        background: confirmado ? 'color-mix(in oklch, var(--success) 28%, transparent)' : 'transparent',
        color: confirmado ? 'var(--success)' : 'var(--text-muted)',
        border: confirmado ? '1.5px solid var(--success)' : '1.5px dashed var(--text-muted)',
        opacity: c.status === 'pago' ? 0.7 : 1,
      }}
    >
      {c.status === 'pago' ? '✓' : confirmado ? '$' : '?'}
    </span>
  )
}

/**
 * Radar de dividendos inteligente (D132): em que meses do ano cada empresa costuma pagar, pelo que pagou nos últimos anos,
 * com o que já foi anunciado por cima. É projeção estatística simples (repete o padrão dos últimos anos), sem valor e sem
 * promessa: a empresa decide a cada ano se paga e quando.
 */
export function RadarInteligente({ radar, agenda, hoje }: { radar?: SnapshotRadarInteligente; agenda?: PagamentoAnunciado[]; hoje?: string }) {
  const r = radar ?? SNAPSHOT_RADAR_INTELIGENTE
  const pagamentos = agenda ?? SNAPSHOT_RADAR_DIVIDENDOS.pagamentos
  const dia = hoje ?? r.dataReferencia
  const [base, setBase] = useState<BaseDaData>('com')
  const [ano, setAno] = useState(Number(dia.slice(0, 4)))
  const [busca, setBusca] = useState('')
  const [setor, setSetor] = useState('')
  const grade = useMemo(() => montarGrade({ radar: r, agenda: pagamentos, ano, base, hoje: dia, busca, setor }), [r, pagamentos, ano, base, dia, busca, setor])
  const setores = useMemo(() => setoresDoRadar(r), [r])
  const anoDeHoje = Number(dia.slice(0, 4))

  if (!r.publicado || r.empresas.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid="radar-inteligente-vazio">
        <span style={{ fontWeight: 700 }}>Radar de dividendos inteligente: em preparação</span>
        <span className="muted small justify">O padrão de pagamento das empresas aparece aqui assim que o histórico da B3 for processado.</span>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }} data-testid="radar-inteligente">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Radar de dividendos inteligente</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Olha o que cada empresa pagou nos <strong>últimos {r.anos} anos</strong> e marca os meses em que ela <strong>costuma</strong> pagar. Quando a empresa já anunciou o provento, o mês aparece como anunciado. <strong>É uma projeção, não uma promessa</strong>:
          a empresa decide a cada ano se paga e quando, e o app <strong>não estima o valor</strong>. Um mês só é marcado como provável se houve pagamento nele em pelo menos {r.minimoDeAnos} dos últimos {r.anos} anos.
        </div>
        <div className="tiny muted" data-testid="radar-inteligente-resumo">
          {r.empresas.length} empresas com padrão · dados da B3 de {formatarData(r.dataReferencia)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" className="chip" aria-label="Ano anterior" disabled={ano <= anoDeHoje} onClick={() => setAno((a) => a - 1)}>‹</button>
          <strong data-testid="radar-inteligente-ano" style={{ minWidth: 60, textAlign: 'center' }}>{ano}</strong>
          <button type="button" className="chip" aria-label="Próximo ano" disabled={ano >= anoDeHoje + 1} onClick={() => setAno((a) => a + 1)}>›</button>
        </div>
        <div role="group" aria-label="Organizar por" style={{ display: 'flex', gap: 6 }}>
          {(['com', 'pagamento'] as const).map((b) => (
            <button key={b} type="button" className={`chip ${base === b ? 'selected' : ''}`} aria-pressed={base === b} onClick={() => setBase(b)}>
              {b === 'com' ? 'Data com' : 'Data pagamento'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresas ou ativos"
          aria-label="Filtrar o radar inteligente por código ou nome"
          className="input-cotas"
          style={{ flex: '1 1 200px' }}
        />
        <select value={setor} onChange={(e) => setSetor(e.target.value)} aria-label="Filtrar por setor" className="input-cotas" style={{ flex: '0 1 220px' }}>
          <option value="">Todos os setores</option>
          {setores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="tiny muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }} aria-label="Legenda">
        <span><Celula c={{ status: 'confirmado' }} mes="" /> anunciado</span>
        <span><Celula c={{ status: 'pago' }} mes="" /> já pago</span>
        <span><Celula c={{ status: 'provavel', anos: r.minimoDeAnos }} mes="" /> provável pelo histórico</span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }} data-testid="radar-inteligente-grade">
        {grade.length === 0 ? (
          <span className="muted small" role="status" style={{ display: 'block', padding: 14 }}>Nenhuma empresa {busca || setor ? 'para esse filtro ' : ''}com pagamento esperado em {ano}.</span>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: 760, width: '100%' }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }} className="small muted">Empresa</th>
                {MESES_CURTOS.map((m) => <th key={m} scope="col" className="tiny muted" style={{ padding: '10px 4px', fontWeight: 600 }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {grade.map((l) => (
                <tr key={l.ticker} data-testid={`radar-linha-${l.ticker}`} style={{ borderTop: '1px solid var(--border, rgba(128,128,128,.2))' }}>
                  <th scope="row" style={{ textAlign: 'left', padding: '8px 12px', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1, fontWeight: 400 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <LogoAtivo ticker={l.ticker} tamanho={30} />
                      <div className="col" style={{ gap: 0, minWidth: 0 }}>
                        <span style={{ fontWeight: 700 }}>{l.ticker}</span>
                        <span className="tiny muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{l.nome}</span>
                      </div>
                    </div>
                  </th>
                  {l.celulas.map((c, i) => (
                    <td key={i} style={{ textAlign: 'center', padding: '6px 2px' }}><Celula c={c} mes={MESES_CURTOS[i]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {r.falhas.length > 0 && <div className="tiny muted justify" role="note">Não foi possível ler da B3 neste dia: {r.falhas.join(', ')}.</div>}
      <div className="tiny muted justify" role="note">
        Projeção estatística simples a partir do histórico de proventos da B3 (data com), sem previsão de valor. {base === 'pagamento' ? 'Na visão por data de pagamento, o mês provável é deslocado pelo prazo que a empresa costuma levar entre a data com e o pagamento. ' : ''}
        O passado não garante o futuro. Não é recomendação de investimento.
      </div>
    </div>
  )
}
