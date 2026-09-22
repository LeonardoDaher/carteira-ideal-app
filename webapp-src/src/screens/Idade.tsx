import { useState } from 'react'
import type { AppCtx } from '../state/useAppState'

export function Idade({ ctx }: { ctx: AppCtx }) {
  const [valor, setValor] = useState(ctx.idade)

  return (
    <div className="screen">
      <div className="col" style={{ gap: 6 }}>
        <div className="small muted" style={{ fontWeight: 600 }}>Antes de começar</div>
        <div className="progressbar"><div style={{ width: '8%' }} /></div>
      </div>

      <div className="col" style={{ gap: 6, marginTop: 8 }}>
        <h1 style={{ fontSize: 22 }}>Qual é a sua idade?</h1>
        <div className="muted small justify">
          Usamos isso só para calibrar o quanto de risco faz sentido perto da aposentadoria.
        </div>
      </div>

      <div className="card col" style={{ alignItems: 'center', gap: 10, padding: 24, marginTop: 8 }}>
        <div className="font-display" style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)' }}>
          {valor}
        </div>
        <input
          type="range"
          min={18}
          max={90}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div className="row-between small muted" style={{ width: '100%' }}>
          <span>18</span>
          <span>90</span>
        </div>
      </div>

      <div className="grow" />
      <button className="btn btn-primary" onClick={() => ctx.confirmarIdade(valor)}>
        Continuar
      </button>
      <button className="btn btn-ghost" onClick={() => ctx.setScreen('onboarding')}>
        Voltar
      </button>
    </div>
  )
}
