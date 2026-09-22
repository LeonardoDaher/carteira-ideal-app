import { useMemo, useState } from 'react'

interface OpcoesQuestionario {
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
>(perguntas: TPergunta[], opcoes: OpcoesQuestionario) {
  type Respostas = Partial<Record<TId, TLetra>>

  const [respostas, setRespostas] = useState<Respostas>({})
  const [passo, setPasso] = useState(0)

  function responder(letra: TLetra) {
    const pergunta = perguntas[passo]
    setRespostas((atual) => ({ ...atual, [pergunta.id]: letra }))

    const proximo = passo + 1
    if (proximo >= perguntas.length) {
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
    const todasRespondidas = perguntas.every((p) => respostas[p.id as TId] !== undefined)
    return todasRespondidas ? (respostas as Record<TId, TLetra>) : null
  }, [respostas, perguntas])

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
