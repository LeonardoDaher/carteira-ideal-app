import { ATIVOS } from '../data/assets'
import { aulaDisponivel, encontrarTrilha } from '../data/trilhas'
import { NOME_ARQUIVO_MANUAL_MEU_MES, RESUMO_MANUAL_MEU_MES, TITULO_MANUAL_MEU_MES, URL_MANUAL_MEU_MES } from '../data/manualMeuMes'
import { PlayIcon } from '../ui/Icon'
import { TabBar } from '../ui/TabBar'
import type { AppCtx } from '../state/useAppState'

export function Trilha({ ctx }: { ctx: AppCtx }) {
  const trilha = ctx.trilhaSelecionadaId ? encontrarTrilha(ctx.trilhaSelecionadaId) : undefined

  if (!trilha) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="muted small">Trilha não encontrada.</div>
        <button className="btn btn-outline" onClick={ctx.voltarDaTrilha}>Voltar</button>
      </div>
    )
  }

  let contador = 0

  return (
    <div className="screen">
      <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0, fontWeight: 600, fontSize: 13 }} onClick={ctx.voltarDaTrilha}>
        ← Voltar
      </button>

      <div className="col" style={{ gap: 4 }}>
        <span className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Trilha {trilha.numero}
        </span>
        <h1 style={{ fontSize: 20 }}>{trilha.titulo}</h1>
        <span className="muted small justify" style={{ lineHeight: 1.5 }}>{trilha.descricao}</span>
      </div>

      {/* D35: o manual completo vale para a trilha toda, então fica aqui (e não repetido em cada aula). */}
      {trilha.id === 'tutorial-meu-mes' && (
        <a className="card-outline col mm-trilha" href={URL_MANUAL_MEU_MES} download={NOME_ARQUIVO_MANUAL_MEU_MES} style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>
            <span aria-hidden="true">📘 </span>
            {TITULO_MANUAL_MEU_MES}
          </span>
          <span className="muted small">{RESUMO_MANUAL_MEU_MES}</span>
        </a>
      )}

      {trilha.topicos.map((topico, indiceTopico) => (
        <div key={topico.id} className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span
              className="font-display"
              style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}
            >
              {indiceTopico + 1}
            </span>
            <h2 className="font-display" style={{ fontSize: 20 }}>{topico.titulo}</h2>
          </div>

          <div className="col" style={{ gap: 8, paddingLeft: 34 }}>
            {topico.aulas.map((aula) => {
              contador += 1
              const disponivel = aulaDisponivel(aula)
              // Aula só em texto (trilha "Sair das dívidas", D21 Etapa 4) aparece como leitura.
              const selo = aula.youtubeId ? aula.duracao : disponivel ? `Leitura · ${aula.duracao}` : 'Em breve'
              const cor = aula.ativo ? ATIVOS[aula.ativo].cor : 'var(--accent)'
              return (
                <button
                  key={aula.id}
                  className="card-outline row-between aula-card"
                  onClick={() => ctx.abrirAula(trilha.id, topico.id, aula.id)}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                >
                  <div className="row" style={{ gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <div className="aula-thumb" style={{ background: cor }}>
                      <PlayIcon size={12} />
                    </div>
                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{contador}. {aula.titulo}</span>
                      <span className="muted tiny" style={{ lineHeight: 1.4 }}>{aula.resumo}</span>
                    </div>
                  </div>
                  <span
                    className="tiny"
                    style={{
                      flexShrink: 0,
                      marginLeft: 8,
                      padding: '3px 8px',
                      borderRadius: 999,
                      fontWeight: 700,
                      background: disponivel ? 'var(--surface2)' : 'transparent',
                      color: disponivel ? 'var(--text)' : 'var(--text-muted)',
                      border: disponivel ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {selo}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
