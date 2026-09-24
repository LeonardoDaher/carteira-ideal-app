import { TRILHAS, totalDeAulas, aulasDisponiveis } from '../data/trilhas'
import { VoltarInicio } from '../ui/VoltarInicio'
import { MateriaisExtras } from '../ui/MateriaisExtras'
import { ChevronDownIcon, GraduationCapIcon } from '../ui/Icon'
import type { AppCtx } from '../state/useAppState'

export function Aprender({ ctx }: { ctx: AppCtx }) {
  return (
    <div className="screen">
      <VoltarInicio />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Trilhas de aprendizagem</h1>
        <div className="muted small">Aulas de ~2 minutos, organizadas em ordem para você seguir passo a passo.</div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {TRILHAS.map((trilha) => {
          const total = totalDeAulas(trilha)
          const disponiveis = aulasDisponiveis(trilha)
          const emConstrucao = trilha.topicos.length === 0

          return (
            <button
              key={trilha.id}
              className="card-outline col trilha-card"
              onClick={() => !emConstrucao && ctx.abrirTrilha(trilha.id)}
              disabled={emConstrucao}
              style={{ textAlign: 'left', gap: 10, cursor: emConstrucao ? 'default' : 'pointer' }}
            >
              <div className="row-between">
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div className="trilha-badge">
                    <GraduationCapIcon size={17} />
                  </div>
                  <div className="col" style={{ gap: 1 }}>
                    <span className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Trilha {trilha.numero}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{trilha.titulo}</span>
                  </div>
                </div>
                {!emConstrucao && <ChevronDownIcon size={16} className="muted" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />}
              </div>

              <span className="muted small justify" style={{ lineHeight: 1.5 }}>{trilha.descricao}</span>

              {!emConstrucao && (
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className="tiny" style={{ padding: '3px 8px', borderRadius: 999, background: 'var(--surface2)', fontWeight: 600 }}>
                    {trilha.topicos.length} tópicos
                  </span>
                  <span className="tiny" style={{ padding: '3px 8px', borderRadius: 999, background: 'var(--surface2)', fontWeight: 600 }}>
                    {disponiveis} de {total} aulas disponíveis
                  </span>
                </div>
              )}

              {emConstrucao && (
                <span
                  className="tiny"
                  style={{ alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700 }}
                >
                  Em construção
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="col" style={{ gap: 10, marginTop: 6 }}>
        <h2 style={{ fontSize: 16 }}>Mais conteúdo</h2>
        <MateriaisExtras />
      </div>
    </div>
  )
}
