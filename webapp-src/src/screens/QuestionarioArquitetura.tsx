import type { AppCtx } from '../state/useAppState'

/**
 * Segunda leva do questionário: as 7 perguntas da Arquitetura Patrimonial, aplicadas
 * logo depois das 7 perguntas de suitability já existentes (ver Questionario.tsx).
 * A numeração do passo continua a partir de 8 (de 14), para deixar claro ao cliente
 * que é um único questionário de 14 perguntas, não dois questionários separados.
 */
export function QuestionarioArquitetura({ ctx }: { ctx: AppCtx }) {
  const pergunta = ctx.perguntaArquiteturaAtual
  const passoCombinado = ctx.totalPerguntas + ctx.passoArquitetura
  const progresso = Math.round(((passoCombinado + 1) / ctx.totalPerguntasCombinado) * 100)
  const respostaAtual = ctx.respostasArquitetura[pergunta.id]

  return (
    <div className="screen">
      <div className="col" style={{ gap: 6 }}>
        <div className="row-between small muted" style={{ fontWeight: 600 }}>
          <span>Pergunta {passoCombinado + 1} de {ctx.totalPerguntasCombinado}</span>
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
            onClick={() => ctx.responderPerguntaArquitetura(opcao.letra)}
          >
            <span className="quiz-option-letter">{opcao.letra.toUpperCase()}</span>
            <span>{opcao.texto}</span>
          </button>
        ))}
      </div>

      <div className="grow" />
      <button className="btn btn-ghost" onClick={ctx.voltarPerguntaArquitetura}>
        Voltar
      </button>
    </div>
  )
}
