// Tipos de domínio do Carteira Ideal — motor de suitability e recomendação de carteira.

export type Letra = 'a' | 'b' | 'c' | 'd'

/** As 7 perguntas da Arquitetura Patrimonial têm sempre 3 opções (a a c). */
export type LetraArquitetura = 'a' | 'b' | 'c'

export type PerfilInvestidor = 'Conservador' | 'Moderado' | 'Arrojado'

/** Faixa de capacidade real, derivada do score da Arquitetura Patrimonial (7 a 21 pontos). */
export type CapacidadeReal = 'baixa' | 'media' | 'alta'

/** Perfil final da carteira depois de cruzar o suitability com a Arquitetura Patrimonial. */
export type PerfilPatrimonial = 'Defensivo' | 'Equilibrado' | 'Crescimento Pleno'

/**
 * Os 9 Perfis-Mãe de Carteira, resultado de cruzar os 3 Perfis de Suitability
 * (Conservador/Moderado/Arrojado) com os 3 Vetores da Arquitetura Patrimonial
 * (Defensivo-Caixa/Equilibrado-Renda/Crescimento Pleno). Este é o nome que deve
 * aparecer para o cliente como resultado final — não o Perfil Patrimonial sozinho
 * (que é só um dos dois eixos usados para chegar até aqui).
 */
export type PerfilFinalCarteira =
  | '1. Conservador Puro'
  | '2. Conservador Renda'
  | '3. Conservador Acúmulo'
  | '4. Moderado Defensivo'
  | '5. Moderado Renda (Equilíbrio)'
  | '6. Moderado Expansão'
  | '7. Arrojado Travado (Falso Arrojado)'
  | '8. Arrojado Gerador de Renda'
  | '9. Arrojado Pleno / Global'

export type PrazoBucket = 'curto' | 'medio' | 'longo'

export type ExperienciaNivel = 'nenhuma' | 'basica' | 'avancada'

/** Chave interna de cada classe de ativo usada na carteira e no glossário. */
export type AtivoKey =
  | 'tesouroSelic'
  | 'tesouroIPCA'
  | 'tesouroPrefixado'
  | 'cdbLiquidez'
  | 'lciLca'
  | 'fiis'
  | 'acoesETFs'
  | 'bdrs'
  | 'ouro'
  | 'fundosInternacionais'
  | 'cripto'

/** Respostas brutas do questionário de 7 perguntas (uma letra por pergunta). */
export interface RespostasQuestionario {
  objetivo: Letra
  prazo: Letra
  tolerancia: Letra
  reserva: Letra
  patrimonio: Letra
  experiencia: Letra
  reacao: Letra
}

/** Dados complementares (não vêm do questionário de 7 perguntas, mas ajustam a régua). */
export interface DadosComplementares {
  idade: number
}

export interface PerguntaOpcao {
  letra: Letra
  texto: string
}

export interface Pergunta {
  id: keyof RespostasQuestionario
  titulo: string
  ajuda: string
  opcoes: PerguntaOpcao[]
}

/** As 7 respostas da Arquitetura Patrimonial (uma letra a/b/c por pilar). Os 3 primeiros
 * pilares (capacidadeFinanceira, passivoDividas, janelaLiquidez) são "restrições duras":
 * uma resposta 'a' neles aciona a regra de veto, independentemente do score. */
export interface RespostasArquitetura {
  capacidadeFinanceira: LetraArquitetura
  passivoDividas: LetraArquitetura
  janelaLiquidez: LetraArquitetura
  comportamentoEstresse: LetraArquitetura
  dependenciaRenda: LetraArquitetura
  capitalHumano: LetraArquitetura
  eficienciaFiscal: LetraArquitetura
}

export interface PerguntaArquiteturaOpcao {
  letra: LetraArquitetura
  texto: string
}

export interface PerguntaArquitetura {
  id: keyof RespostasArquitetura
  titulo: string
  ajuda: string
  /** Pilar 1, 2 ou 3 tem poder de veto (ver RespostasArquitetura). */
  restricaoDura: boolean
  opcoes: PerguntaArquiteturaOpcao[]
}

export type Carteira = Partial<Record<AtivoKey, number>>

export interface ResultadoRecomendacao {
  score: number
  perfilBase: PerfilInvestidor
  perfilFinal: PerfilInvestidor
  prazo: PrazoBucket
  carteira: Carteira
  alertas: string[]
  /** Score de capacidade real (7 a 21) somado a partir das 7 respostas da Arquitetura
   * Patrimonial. Só existe quando o questionário de Arquitetura foi respondido. */
  scoreArquitetura?: number
  capacidadeReal?: CapacidadeReal
  /** true quando algum dos 3 pilares-restrição-dura veio como resposta 'a'. */
  vetoAplicado?: boolean
  /** Perfil final depois de cruzar perfilFinal (suitability) x capacidadeReal na matriz 3x3. */
  perfilPatrimonial?: PerfilPatrimonial
  /** Um dos 9 Perfis-Mãe de Carteira (suitability x Vetor da Arquitetura Patrimonial).
   * É ESTE o nome que deve ser exibido ao cliente como resultado final — ver
   * PerfilFinalCarteira. */
  perfilFinalCarteira?: PerfilFinalCarteira
}
