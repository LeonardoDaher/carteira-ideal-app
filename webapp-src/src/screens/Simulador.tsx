import { useState } from 'react'
import { SemResultado } from '../ui/SemResultado'
import { SimularComMeusAtivos } from '../ui/SimularComMeusAtivos'
import { ATIVOS } from '../data/assets'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { TabBar } from '../ui/TabBar'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'
import type { AtivoKey } from '../domain/types'

function formatarReais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

type Aba = 'percentual' | 'meusAtivos'

export function Simulador({ ctx }: { ctx: AppCtx }) {
  const resultado = ctx.resultado
  const [aba, setAba] = useState<Aba>('percentual')

  if (!resultado) {
    return <SemResultado ctx={ctx} convite="Responda o questionário para simular valores." />
  }

  const entradas = Object.entries(carteiraParaExibicao(resultado.carteira)) as [AtivoKey, number][]

  return (
    <div className="screen">
      <div className="col" style={{ gap: 4, paddingTop: 8 }}>
        <h1 style={{ fontSize: 21 }}>Simular valores</h1>
        <div className="muted small justify">
          {aba === 'percentual'
            ? 'Quanto você pretende investir? A carteira de referência se ajusta automaticamente.'
            : 'Com o que você já tem em Meus Ativos, veja o que atacar primeiro para chegar aos percentuais da carteira sugerida.'}
        </div>
      </div>

      <div className="mc-modos" role="tablist" aria-label="Tipo de simulação">
        <button type="button" role="tab" id="sim-tab-percentual" aria-selected={aba === 'percentual'} aria-controls="sim-painel" className="mc-modo" onClick={() => setAba('percentual')}>
          Pelo percentual
        </button>
        <button type="button" role="tab" id="sim-tab-meus-ativos" aria-selected={aba === 'meusAtivos'} aria-controls="sim-painel" className="mc-modo" onClick={() => setAba('meusAtivos')}>
          Com os meus ativos
        </button>
      </div>

      {aba === 'meusAtivos' && (
        <div id="sim-painel" role="tabpanel" aria-labelledby="sim-tab-meus-ativos" className="col" style={{ gap: 14 }}>
          <SimularComMeusAtivos ctx={ctx} referencia={carteiraParaExibicao(resultado.carteira)} />
        </div>
      )}

      {aba === 'percentual' && (
      <div id="sim-painel" role="tabpanel" aria-labelledby="sim-tab-percentual" style={{ display: 'contents' }}>

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
      </div>
      )}

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
