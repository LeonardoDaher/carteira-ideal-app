// Validação de entrada da API de recomendação.
// Mantém o handler enxuto e evita que payloads malformados cheguem ao motor (engine.ts).

import type {
  DadosComplementares,
  Letra,
  LetraArquitetura,
  RespostasArquitetura,
  RespostasQuestionario,
} from '../webapp-src/src/domain/types.js'

const LETRAS_QUESTIONARIO: readonly Letra[] = ['a', 'b', 'c', 'd']
const LETRAS_ARQUITETURA: readonly LetraArquitetura[] = ['a', 'b', 'c']

const CAMPOS_QUESTIONARIO: (keyof RespostasQuestionario)[] = [
  'objetivo',
  'prazo',
  'tolerancia',
  'reserva',
  'patrimonio',
  'experiencia',
  'reacao',
]

const CAMPOS_ARQUITETURA: (keyof RespostasArquitetura)[] = [
  'capacidadeFinanceira',
  'passivoDividas',
  'janelaLiquidez',
  'comportamentoEstresse',
  'dependenciaRenda',
  'capitalHumano',
  'eficienciaFiscal',
]

export type ResultadoValidacao =
  | { ok: true; respostas: RespostasQuestionario; dados: DadosComplementares; respostasArquitetura?: RespostasArquitetura }
  | { ok: false; erro: string }

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

export function validarPayload(body: unknown): ResultadoValidacao {
  if (!ehObjeto(body)) {
    return { ok: false, erro: 'Corpo da requisição inválido: esperado um objeto JSON.' }
  }

  const { respostas, dados, respostasArquitetura } = body as Record<string, unknown>

  if (!ehObjeto(respostas)) {
    return { ok: false, erro: 'Campo "respostas" ausente ou inválido.' }
  }
  for (const campo of CAMPOS_QUESTIONARIO) {
    const valor = respostas[campo]
    if (typeof valor !== 'string' || !LETRAS_QUESTIONARIO.includes(valor as Letra)) {
      return { ok: false, erro: `Resposta inválida ou ausente para "${campo}".` }
    }
  }

  if (!ehObjeto(dados) || typeof dados.idade !== 'number' || !Number.isFinite(dados.idade)) {
    return { ok: false, erro: 'Campo "dados.idade" ausente ou inválido.' }
  }
  if (dados.idade < 0 || dados.idade > 130) {
    return { ok: false, erro: 'Campo "dados.idade" fora de uma faixa plausível.' }
  }

  let arquiteturaValidada: RespostasArquitetura | undefined
  if (respostasArquitetura !== undefined) {
    if (!ehObjeto(respostasArquitetura)) {
      return { ok: false, erro: 'Campo "respostasArquitetura" inválido.' }
    }
    for (const campo of CAMPOS_ARQUITETURA) {
      const valor = respostasArquitetura[campo]
      if (typeof valor !== 'string' || !LETRAS_ARQUITETURA.includes(valor as LetraArquitetura)) {
        return { ok: false, erro: `Resposta de arquitetura inválida ou ausente para "${campo}".` }
      }
    }
    // Complemento do Pilar 3 (D83): opcional, mas, se vier, tem de ser uma letra válida.
    const parte = respostasArquitetura.parteDoSaque
    if (parte !== undefined && (typeof parte !== 'string' || !LETRAS_ARQUITETURA.includes(parte as LetraArquitetura))) {
      return { ok: false, erro: 'Resposta de arquitetura inválida para "parteDoSaque".' }
    }
    arquiteturaValidada = respostasArquitetura as unknown as RespostasArquitetura
  }

  return {
    ok: true,
    respostas: respostas as unknown as RespostasQuestionario,
    dados: dados as unknown as DadosComplementares,
    respostasArquitetura: arquiteturaValidada,
  }
}
