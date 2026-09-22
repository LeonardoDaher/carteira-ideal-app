// Cliente do front-end para a API de recomendação (api/recomendacao.ts).
//
// Antes, `useAppState` chamava `gerarRecomendacao` diretamente, o que embutia todo o
// motor (matrizes, veto, calibradores) no bundle JS enviado ao navegador. Agora o
// front-end só envia as respostas e recebe o resultado já pronto — a lógica proprietária
// fica no servidor.
import type { DadosComplementares, RespostasArquitetura, RespostasQuestionario, ResultadoRecomendacao } from '../domain/types'

export class ErroRecomendacao extends Error {}

export async function buscarRecomendacao(
  respostas: RespostasQuestionario,
  dados: DadosComplementares,
  respostasArquitetura?: RespostasArquitetura,
): Promise<ResultadoRecomendacao> {
  let resposta: Response
  try {
    resposta = await fetch('/api/recomendacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respostas, dados, respostasArquitetura }),
    })
  } catch {
    throw new ErroRecomendacao('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.')
  }

  if (!resposta.ok) {
    let mensagem = 'Não foi possível calcular sua recomendação agora.'
    try {
      const corpo = (await resposta.json()) as { erro?: string }
      if (corpo?.erro) mensagem = corpo.erro
    } catch {
      // corpo não era JSON — mantém a mensagem genérica
    }
    throw new ErroRecomendacao(mensagem)
  }

  return (await resposta.json()) as ResultadoRecomendacao
}
