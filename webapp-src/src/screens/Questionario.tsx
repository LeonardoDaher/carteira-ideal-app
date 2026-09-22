import type { AppCtx } from '../state/useAppState'

export function Questionario({ ctx }: { ctx: AppCtx }) {
  const pergunta = ctx.perguntaAtual
  const progresso = Math.round(((ctx.passoAtual + 1) / ctx.totalPerguntas) * 100)
  const respostaAtual = ctx.respostas[pergunta.id]

  return (
    <div className="screen">
      <div className="col" style={{ gap: 6 }}>
        <div className="row-between small muted" style={{ fontWeight: 600 }}>
          <span>Pergunta {ctx.passoAtual + 1} de {ctx.totalPerguntas}</span>
          <span>{progresso}%</span>
        </div>
        <div className="progressbar"><div style={{ width: `${progresso}%` }} /></div>
      </div>

      <div className="col" style={{ gap: 6, marginTop: 8 }}>
        <h1 style={{ fontSize: 21, lineHeight: 1.3 }}>{pergunta.titulo}</h1>
        <div className="muted small justify">{pergunta.ajuda}</div>
      </div>

      <div className="col" style={{ gap: 8, marginTop: 4 }}>
        {pergunta.opcoes.map((opcao) => (
          <button
            key={opcao.letra}
            className={`quiz-option ${respostaAtual === opcao.letra ? 'selected' : ''}`}
            onClick={() => ctx.responderPergunta(opcao.letra)}
          >
            <span className="quiz-option-letter">{opcao.letra.toUpperCase()}</span>
            <span>{opcao.texto}</span>
          </button>
        ))}
      </div>

      <div className="grow" />
      <button className="btn btn-ghost" onClick={ctx.voltarPergunta}>
        Voltar
      </button>
    </div>
  )
}
