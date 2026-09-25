import { ATIVOS } from '../data/assets'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { TabBar } from '../ui/TabBar'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'
import type { AtivoKey } from '../domain/types'

function formatarReais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function Simulador({ ctx }: { ctx: AppCtx }) {
  const resultado = ctx.resultado

  if (!resultado) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="muted small">Responda o questionário para simular valores.</div>
      </div>
    )
  }

  const entradas = Object.entries(carteiraParaExibicao(resultado.carteira)) as [AtivoKey, number][]

  return (
    <div className="screen">
      <div className="col" style={{ gap: 4, paddingTop: 8 }}>
        <h1 style={{ fontSize: 21 }}>Simular valores</h1>
        <div className="muted small justify">Quanto você pretende investir? A carteira de referência se ajusta automaticamente.</div>
      </div>

      {/* No computador: controle do valor fixo à esquerda, divisão por classe em grade à direita (D20). */}
      <div className="desk-split">
      <div className="desk-side desk-side-esquerda">
      <div className="card col" style={{ gap: 10 }}>
        <div className="row-between">
          <span className="small muted">Valor a investir</span>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
            {formatarReais(ctx.valorSimulacao)}
          </span>
        </div>
        <input
          type="range"
          min={100}
          max={100000}
          step={100}
          value={ctx.valorSimulacao}
          onChange={(e) => ctx.setValorSimulacao(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div className="row-between small muted">
          <span>R$ 100</span>
          <span>R$ 100 mil</span>
        </div>
      </div>
      </div>

      <div className="desk-main">
      <div className="col grade-simulador" style={{ gap: 8 }}>
        {entradas
          .sort((a, b) => b[1] - a[1])
          .map(([ativo, pct]) => (
            <div key={ativo} className="card row-between" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                <div className="alloc-dot" style={{ background: ATIVOS[ativo].cor, width: 12, height: 12, flexShrink: 0 }} />
                <div className="col" style={{ gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{ATIVOS[ativo].label}</span>
                  <span className="muted tiny">{pct}% da carteira</span>
                </div>
              </div>
              <span className="font-display" style={{ fontWeight: 700, fontSize: 14, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {formatarReais(Math.round((ctx.valorSimulacao * pct) / 100))}
              </span>
            </div>
          ))}
      </div>

      <AvisoEducacional />
      </div>
      </div>

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
