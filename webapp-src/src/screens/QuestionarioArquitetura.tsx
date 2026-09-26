import type { AppCtx } from '../state/useAppState'
import { useSugestoesMeuMes } from '../state/useSugestoesMeuMes'
import type { SugestoesDoMeuMes } from '../domain/ponteQuestionario'

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
  // Ponte com o Meu Mês (D21, Etapa 4): nos Pilares 1 e 2, quem usa o Meu Mês vê qual opção
  // combina com o que anotou lá. Sugestão, e não preenchimento: nada é marcado sozinho.
  const sugestoes = useSugestoesMeuMes()
  const sugestao = sugestoes[pergunta.id as keyof SugestoesDoMeuMes]

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

      {sugestao && (
        <div className="card ponte-sugestao col" role="note" aria-label="Sugestão do Meu Mês">
          <span className="small" style={{ fontWeight: 700 }}>
            <span aria-hidden="true">🗓️ </span>Pelo seu Meu Mês, a opção {sugestao.letra.toUpperCase()} combina
          </span>
          <span className="small justify">{sugestao.motivo}</span>
          <span className="tiny muted justify">
            A resposta é sua: marque a que descreve melhor a sua vida hoje. O Meu Mês foi lido só neste aparelho e não é enviado.
          </span>
        </div>
      )}

      <div className="col" style={{ gap: 8, marginTop: 4 }}>
        {pergunta.opcoes.map((opcao) => (
          <button
            key={opcao.letra}
            className={`quiz-option ${respostaAtual === opcao.letra ? 'selected' : ''} ${sugestao?.letra === opcao.letra ? 'sugerida' : ''}`}
            onClick={() => ctx.responderPerguntaArquitetura(opcao.letra)}
          >
            <span className="quiz-option-letter">{opcao.letra.toUpperCase()}</span>
            <span className="col" style={{ gap: 4 }}>
              <span>{opcao.texto}</span>
              {sugestao?.letra === opcao.letra && <span className="quiz-option-tag">Sugestão do Meu Mês</span>}
            </span>
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
