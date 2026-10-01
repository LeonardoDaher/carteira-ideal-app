import { SemResultado } from '../ui/SemResultado'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { AllocLegend, PieChart } from '../ui/AllocBar'
import { TabBar } from '../ui/TabBar'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'

export function Carteira({ ctx }: { ctx: AppCtx }) {
  const resultado = ctx.resultado

  if (!resultado) {
    return <SemResultado ctx={ctx} convite="Responda o questionário para ver a carteira de referência." />
  }

  return (
    <div className="screen">
      <div className="col" style={{ gap: 4, paddingTop: 8 }}>
        <h1 style={{ fontSize: 21 }}>Carteira de referência, explicada</h1>
        <div className="muted small">
          <span className="so-toque">Toque</span><span className="so-mouse">Clique</span> em qualquer item para ver a análise completa daquela classe.
        </div>
      </div>

      {/* No computador: gráfico fixo à esquerda, explicação das classes à direita (D20). */}
      <div className="desk-split">
        <div className="desk-side desk-side-esquerda">
          <div style={{ padding: '4px 0 8px' }}>
            <PieChart carteira={carteiraParaExibicao(resultado.carteira)} onSlicePress={ctx.abrirDetalheAtivo} />
          </div>
        </div>
        <div className="desk-main">
          <AllocLegend carteira={carteiraParaExibicao(resultado.carteira)} comDescricao onItemPress={ctx.abrirDetalheAtivo} />
          <AvisoEducacional />
        </div>
      </div>

      <div className="card-outline col" style={{ gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>E a carteira que você realmente tem?</div>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Importe os extratos da B3 e acompanhe o preço médio, os proventos e a evolução do que você já investiu. Grátis, sem cadastro; seus dados ficam só neste aparelho.
        </div>
        <button className="btn btn-outline" onClick={() => ctx.setScreen('minhaCarteira')}>
          Abrir Minha carteira
        </button>
      </div>

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
