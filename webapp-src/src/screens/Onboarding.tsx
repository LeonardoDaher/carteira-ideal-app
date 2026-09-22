import { BarChartIcon, ClipboardListIcon, CompassIcon, MoonIcon, SunIcon } from '../ui/Icon'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'

export function Onboarding({ ctx }: { ctx: AppCtx }) {
  return (
    <div className="screen">
      <div className="theme-toggle">
        <button className={ctx.tema === 'light' ? 'selected' : ''} onClick={() => ctx.setTema('light')}>
          <SunIcon size={14} /> Claro
        </button>
        <button className={ctx.tema === 'dark' ? 'selected' : ''} onClick={() => ctx.setTema('dark')}>
          <MoonIcon size={14} /> Escuro
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 10, paddingTop: 4 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M3 17 9 11 13 15 21 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-display" style={{ fontWeight: 700, fontSize: 22, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          Carteira Ideal
        </span>
      </div>

      <div className="col" style={{ gap: 8, marginTop: 10 }}>
        <h1 style={{ fontSize: 23 }}>Quais investimentos combinam com o seu momento de vida?</h1>
        <div className="muted small justify">
          Em menos de 3 minutos, você descobre seu perfil de investidor e vê um exemplo de carteira
          de referência, com a lógica explicada em cada etapa.
        </div>
      </div>

      <div className="card-outline col" style={{ gap: 10, marginTop: 6 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="icon-btn" style={{ color: 'var(--accent)' }}><ClipboardListIcon /></div>
          <div className="col" style={{ gap: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>14 perguntas no total</div>
            <div className="muted tiny">7 de suitability e 7 da sua Arquitetura Patrimonial</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="icon-btn" style={{ color: 'var(--accent)' }}><CompassIcon /></div>
          <div className="col" style={{ gap: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>1 dos 9 Perfis-Mãe de Carteira</div>
            <div className="muted tiny">Cruza seu suitability com sua capacidade real de risco</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="icon-btn" style={{ color: 'var(--accent)' }}><BarChartIcon /></div>
          <div className="col" style={{ gap: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Carteira de referência em %</div>
            <div className="muted tiny">Simule quanto isso representa em reais</div>
          </div>
        </div>
      </div>

      <div className="grow" />

      <AvisoEducacional variante="completo" />

      <button className="btn btn-primary" onClick={ctx.iniciarQuestionario}>
        Descobrir meu perfil e carteira de referência
      </button>
    </div>
  )
}
