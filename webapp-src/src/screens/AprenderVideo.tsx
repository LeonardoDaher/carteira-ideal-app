import { ATIVOS } from '../data/assets'
import { encontrarAula, aulasEmOrdem } from '../data/trilhas'
import { TabBar } from '../ui/TabBar'
import type { AppCtx } from '../state/useAppState'

export function AprenderVideo({ ctx }: { ctx: AppCtx }) {
  const ref = ctx.aulaAtualRef
  const achado = ref ? encontrarAula(ref.trilhaId, ref.topicoId, ref.aulaId) : undefined

  if (!ref || !achado) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="muted small">Nenhuma aula selecionada.</div>
        <button className="btn btn-outline" onClick={ctx.voltarDaAula}>Voltar</button>
      </div>
    )
  }

  const { trilha, aula } = achado
  const temTexto = Boolean(aula.texto?.length)
  const cor = aula.ativo ? ATIVOS[aula.ativo].cor : 'var(--accent)'

  const ordem = aulasEmOrdem(trilha)
  const indiceAtual = ordem.findIndex((item) => item.aula.id === aula.id && item.topicoId === ref.topicoId)
  const proxima = indiceAtual >= 0 ? ordem[indiceAtual + 1] : undefined

  return (
    <div className="screen">
      <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0, fontWeight: 600, fontSize: 13 }} onClick={ctx.voltarDaAula}>
        ← Voltar para a trilha
      </button>

      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <div className="alloc-dot" style={{ background: cor, width: 14, height: 14 }} />
        <h1 style={{ fontSize: 20 }}>{aula.titulo}</h1>
      </div>

      {aula.youtubeId && (
        <div
          style={
            aula.formato === 'vertical'
              ? {
                  // YouTube Shorts (9:16): centralizado, com altura limitada para caber na tela
                  borderRadius: 14,
                  overflow: 'hidden',
                  aspectRatio: '9 / 16',
                  width: 'min(100%, calc(70vh * 9 / 16))',
                  margin: '0 auto',
                }
              : { borderRadius: 14, overflow: 'hidden', aspectRatio: '16 / 9' }
          }
        >
          <iframe
            key={aula.youtubeId}
            src={`https://www.youtube.com/embed/${aula.youtubeId}`}
            title={aula.titulo}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}

      {!aula.youtubeId && !temTexto && (
        <div
          className="card col"
          style={{ gap: 6, alignItems: 'center', textAlign: 'center', aspectRatio: '16 / 9', justifyContent: 'center' }}
        >
          <span style={{ fontWeight: 700 }}>Vídeo em breve</span>
          <span className="muted small">Estamos gravando a aula de {aula.titulo}.</span>
        </div>
      )}

      {temTexto ? (
        // Aula em texto (D21, Etapa 4). Com vídeo publicado, o texto fica abaixo dele.
        <article className="card-outline col aula-texto small justify">
          <span className="muted">{aula.resumo}</span>
          {aula.texto!.map((paragrafo, i) => (
            <p key={i}>{paragrafo}</p>
          ))}
          {aula.links && aula.links.length > 0 && (
            <div className="col aula-links">
              <span className="tiny muted" style={{ fontWeight: 700 }}>Fontes oficiais</span>
              {aula.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.rotulo} ↗
                </a>
              ))}
            </div>
          )}
        </article>
      ) : (
        <div className="card-outline col" style={{ gap: 6 }}>
          <div className="row" style={{ fontWeight: 700, fontSize: 13.5 }}>Sobre esta aula</div>
          <div className="muted small justify" style={{ lineHeight: 1.5 }}>{aula.resumo}</div>
        </div>
      )}

      {aula.acao === 'meuMes' && (
        <button className="btn btn-outline" onClick={() => ctx.setScreen('meuMes')}>
          Abrir o Meu Mês
        </button>
      )}
      {aula.acao === 'questionario' &&
        (ctx.resultado ? (
          <button className="btn btn-outline" onClick={ctx.limparDados}>
            Refazer o questionário da Carteira Ideal
          </button>
        ) : (
          <button className="btn btn-outline" onClick={ctx.iniciarQuestionario}>
            Fazer o questionário da Carteira Ideal
          </button>
        ))}

      {proxima ? (
        <button
          className="btn btn-primary"
          onClick={() => ctx.abrirAula(trilha.id, proxima.topicoId, proxima.aula.id)}
        >
          Próxima aula: {proxima.aula.titulo} →
        </button>
      ) : (
        <div className="card small" style={{ textAlign: 'center', background: 'color-mix(in oklch, var(--accent) 14%, var(--surface))', border: '1px solid var(--accent)' }}>
          🎉 Você concluiu todas as aulas desta trilha.
        </div>
      )}

      <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
        {trilha.id === 'sair-das-dividas'
          ? 'Conteúdo educativo. Não é assessoria jurídica e não indica banco nem produto de crédito.'
          : 'Conteúdo educativo com fins ilustrativos, sem caráter de recomendação de compra ou venda.'}
      </div>

      <button className="btn btn-outline" onClick={ctx.voltarDaAula}>
        Voltar para a trilha
      </button>

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
