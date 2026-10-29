import { useState } from 'react'
import { RadarDividendos } from './RadarDividendos'
import { RadarInteligente } from './RadarInteligente'

type Visao = 'agenda' | 'inteligente'

const CARTOES: { id: Visao; emoji: string; titulo: string; descricao: string }[] = [
  { id: 'agenda', emoji: '📅', titulo: 'Agenda de dividendos', descricao: 'O que a empresa já anunciou' },
  { id: 'inteligente', emoji: '🔮', titulo: 'Radar de dividendos inteligente', descricao: 'Meses em que costuma pagar' },
]

/** Aba "Agenda de dividendos" do Simule Ações: dois cartões, a agenda (fato anunciado) e o radar inteligente (projeção pelo histórico). */
export function AgendaDeDividendos() {
  const [visao, setVisao] = useState<Visao>('agenda')
  return (
    <div className="col" style={{ gap: 14 }}>
      <div role="tablist" aria-label="Agenda ou radar" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {CARTOES.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`aba-agenda-${c.id}`}
            aria-selected={visao === c.id}
            aria-controls="painel-agenda"
            className={`vehicle-card ${visao === c.id ? 'selected' : ''}`}
            onClick={() => setVisao(c.id)}
          >
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</span>
            <span style={{ fontSize: 14 }}>{c.titulo}</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{c.descricao}</span>
          </button>
        ))}
      </div>
      <div id="painel-agenda" role="tabpanel" aria-labelledby={`aba-agenda-${visao}`}>
        {visao === 'agenda' ? <RadarDividendos /> : <RadarInteligente />}
      </div>
    </div>
  )
}
