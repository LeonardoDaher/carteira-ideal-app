import { useMemo, useState } from 'react'

interface OpcoesQuestionario<TPergunta = unknown, TRespostas = unknown> {
  /** Perguntas que só aparecem conforme respostas anteriores (D83). Sem isso, todas aparecem. */
  visivel?: (pergunta: TPergunta, respostas: TRespostas) => boolean
  /** Pergunta visível que pode ficar sem resposta sem impedir o resultado (estado salvo antigo). */
  opcional?: (pergunta: TPergunta) => boolean
  /** Chamado assim que a última pergunta da lista é respondida. */
  onCompletar: () => void
  /** Chamado quando o usuário tenta voltar a partir da primeira pergunta (sai do questionário). */
  onVoltarAntesDoInicio: () => void
}

/**
 * Fluxo genérico de um questionário paginado (uma pergunta por vez, com voltar/avançar
 * e detecção de quando todas as perguntas foram respondidas). Usado tanto para as 7
 * perguntas de suitability quanto para as 7 da Arquitetura Patrimonial em
 * `useAppState.ts` — a única diferença de fato entre os dois fluxos é o que acontece ao
 * completar a lista ou ao voltar antes da primeira pergunta, e isso fica a cargo de quem
 * usa o hook (via `onCompletar`/`onVoltarAntesDoInicio`), não do hook em si.
 */
export function useQuestionario<
  TPergunta extends { id: string; opcoes: { letra: string }[] },
  TId extends string = TPergunta['id'],
  TLetra extends string = TPergunta['opcoes'][number]['letra'],
>(todasAsPerguntas: TPergunta[], opcoes: OpcoesQuestionario<TPergunta, Partial<Record<TId, TLetra>>>) {
  type Respostas = Partial<Record<TId, TLetra>>

  const [respostas, setRespostas] = useState<Respostas>({})
  const [passo, setPasso] = useState(0)

  const { visivel, opcional } = opcoes
  const filtrar = (r: Respostas) =>
    visivel ? todasAsPerguntas.filter((p) => visivel(p, r)) : todasAsPerguntas
  // As perguntas que valem agora: o passo e o total contam só as visíveis.
  const perguntas = useMemo(() => filtrar(respostas), [todasAsPerguntas, respostas, visivel])

  function responder(letra: TLetra) {
    const pergunta = perguntas[passo]
    const novas = { ...respostas, [pergunta.id]: letra } as Respostas
    setRespostas(novas)

    const proximo = passo + 1
    if (proximo >= filtrar(novas).length) {
      opcoes.onCompletar()
    } else {
      setPasso(proximo)
    }
  }

  function voltar() {
    if (passo === 0) {
      opcoes.onVoltarAntesDoInicio()
    } else {
      setPasso(passo - 1)
    }
  }

  /** Limpa as respostas e volta para a primeira pergunta — usado ao reiniciar o app. */
  function reiniciar() {
    setRespostas({})
    setPasso(0)
  }

  /** Substitui as respostas por um valor restaurado do armazenamento local, sem mexer no passo atual. */
  function restaurar(salvas: Respostas | undefined) {
    setRespostas(salvas ?? {})
  }

  const completas = useMemo(() => {
    const todasRespondidas = perguntas.every((p) => respostas[p.id as TId] !== undefined || opcional?.(p))
    if (!todasRespondidas) return null
    // Resposta de pergunta que deixou de aparecer (a pessoa voltou e mudou uma anterior) não vale.
    const validas = Object.fromEntries(
      perguntas.filter((p) => respostas[p.id as TId] !== undefined).map((p) => [p.id, respostas[p.id as TId]]),
    )
    return validas as Record<TId, TLetra>
  }, [respostas, perguntas, opcional])

  return {
    respostas,
    passo,
    setPasso,
    atual: perguntas[passo],
    total: perguntas.length,
    completas,
    responder,
    voltar,
    reiniciar,
    restaurar,
  }
}
