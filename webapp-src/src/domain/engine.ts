import type {
  AtivoKey,
  Carteira,
  CapacidadeReal,
  DadosComplementares,
  ExperienciaNivel,
  Letra,
  LetraArquitetura,
  PerfilFinalCarteira,
  PerfilInvestidor,
  PerfilPatrimonial,
  PrazoBucket,
  ResultadoRecomendacao,
  RespostasArquitetura,
  RespostasQuestionario,
} from './types'

const PONTOS: Record<Letra, number> = { a: 1, b: 2, c: 3, d: 4 }

const ORDEM_PERFIL: PerfilInvestidor[] = ['Conservador', 'Moderado', 'Arrojado']

/** Pontos da Arquitetura Patrimonial: [A] = 1, [B] = 2, [C] = 3. Soma das 7 respostas
 * varia de 7 a 21. */
const PONTOS_ARQUITETURA: Record<LetraArquitetura, number> = { a: 1, b: 2, c: 3 }

/** Pilares com poder de veto — ver Seção 4.2 do documento "Estrutura de uma carteira
 * verdadeiramente personalizada". Uma resposta 'a' em qualquer um deles rebaixa o perfil
 * final para Defensivo, independentemente do score consolidado ou do suitability. */
const PILARES_RESTRICAO_DURA: (keyof RespostasArquitetura)[] = [
  'capacidadeFinanceira',
  'passivoDividas',
  'janelaLiquidez',
]

/** Matriz cruzada 3x3 (Seção 4.3): capacidade real (linha) x resultado do suitability
 * (coluna) → perfil final da carteira. */
const MATRIZ_PATRIMONIAL: Record<CapacidadeReal, Record<PerfilInvestidor, PerfilPatrimonial>> = {
  baixa: { Conservador: 'Defensivo', Moderado: 'Defensivo', Arrojado: 'Defensivo' },
  media: { Conservador: 'Defensivo', Moderado: 'Equilibrado', Arrojado: 'Equilibrado' },
  alta: { Conservador: 'Defensivo', Moderado: 'Equilibrado', Arrojado: 'Crescimento Pleno' },
}

/** Os 9 Perfis-Mãe de Carteira: cruzamento dos 3 Perfis de Suitability (linha) com os
 * 3 Vetores da Arquitetura Patrimonial (coluna) — resultado de MATRIZ_PATRIMONIAL acima,
 * já com a regra de veto aplicada quando for o caso. Este é o nome final exibido ao
 * cliente (ResultadoRecomendacao.perfilFinalCarteira), não o Perfil Patrimonial sozinho. */
const MATRIZ_PERFIL_FINAL: Record<PerfilInvestidor, Record<PerfilPatrimonial, PerfilFinalCarteira>> = {
  Conservador: {
    Defensivo: '1. Conservador Puro',
    Equilibrado: '2. Conservador Renda',
    'Crescimento Pleno': '3. Conservador Acúmulo',
  },
  Moderado: {
    Defensivo: '4. Moderado Defensivo',
    Equilibrado: '5. Moderado Renda (Equilíbrio)',
    'Crescimento Pleno': '6. Moderado Expansão',
  },
  Arrojado: {
    Defensivo: '7. Arrojado Travado (Falso Arrojado)',
    Equilibrado: '8. Arrojado Gerador de Renda',
    'Crescimento Pleno': '9. Arrojado Pleno / Global',
  },
}

/**
 * Carteiras-modelo das 13 classes por perfil da Arquitetura Patrimonial x prazo — a
 * "Carteira Ideal" propriamente dita. O documento "Estrutura de uma carteira
 * verdadeiramente personalizada" (Seção 2) define uma única alocação por perfil; aqui
 * ela vira a variante "medio", e as variantes "curto"/"longo" seguem a mesma lógica já
 * usada em MATRIZ_BASE: mais liquidez e menos duração/risco no curto prazo, mais IPCA+/
 * ações/global no longo prazo. Cada uma das 9 combinações soma exatamente 100%.
 *
 * Fundos DI, Fundos Multimercado, Fundos de Ações líquidos e CRI/CRA saíram da régua de
 * ativos do app; onde apareciam nas alocações originais, a fatia foi redistribuída assim:
 * Fundos DI → 100% Tesouro Selic; Fundos de Ações líquidos → 100% Ações; CRI/CRA → 100%
 * LCI/LCA; Fundos Multimercado → 20% Ouro, 20% BDRs, 20% Fundos Internacionais/ETFs e
 * 40% FIIs.
 */
const MATRIZ_PATRIMONIAL_CARTEIRA: Record<PerfilPatrimonial, Record<PrazoBucket, Carteira>> = {
  Defensivo: {
    curto: { tesouroSelic: 55, cdbLiquidez: 25, tesouroIPCA: 5, tesouroPrefixado: 5, ouro: 6, bdrs: 1, fundosInternacionais: 1, fiis: 2 },
    medio: { tesouroSelic: 35, cdbLiquidez: 5, lciLca: 10, tesouroIPCA: 20, tesouroPrefixado: 10, ouro: 6, fiis: 7, acoesETFs: 5, bdrs: 1, fundosInternacionais: 1 },
    longo: { tesouroSelic: 20, cdbLiquidez: 5, lciLca: 10, tesouroIPCA: 25, tesouroPrefixado: 10, ouro: 6, fiis: 12, acoesETFs: 10, bdrs: 1, fundosInternacionais: 1 },
  },
  Equilibrado: {
    curto: { tesouroSelic: 35, cdbLiquidez: 15, tesouroIPCA: 10, tesouroPrefixado: 5, ouro: 7, fiis: 12, acoesETFs: 12, bdrs: 2, fundosInternacionais: 2 },
    medio: { tesouroSelic: 15, tesouroIPCA: 25, tesouroPrefixado: 10, ouro: 6, fiis: 11, acoesETFs: 12, bdrs: 4, fundosInternacionais: 4, lciLca: 13 },
    longo: { tesouroSelic: 10, tesouroIPCA: 20, tesouroPrefixado: 5, ouro: 6, fiis: 14, acoesETFs: 17, bdrs: 6, fundosInternacionais: 6, cripto: 3, lciLca: 13 },
  },
  'Crescimento Pleno': {
    curto: { tesouroSelic: 30, cdbLiquidez: 15, tesouroIPCA: 5, ouro: 7, fiis: 14, acoesETFs: 25, bdrs: 2, fundosInternacionais: 2 },
    medio: { tesouroSelic: 10, tesouroIPCA: 20, tesouroPrefixado: 5, ouro: 6, fiis: 12, acoesETFs: 17, bdrs: 6, fundosInternacionais: 8, cripto: 3, lciLca: 13 },
    longo: { tesouroSelic: 5, tesouroIPCA: 15, tesouroPrefixado: 5, ouro: 6, fiis: 17, acoesETFs: 17, bdrs: 6, fundosInternacionais: 11, cripto: 5, lciLca: 13 },
  },
}

export function calcularScoreArquitetura(respostas: RespostasArquitetura): number {
  const letras = Object.values(respostas) as LetraArquitetura[]
  return letras.reduce((soma, letra) => soma + PONTOS_ARQUITETURA[letra], 0)
}

export function capacidadePeloScore(score: number): CapacidadeReal {
  if (score <= 11) return 'baixa'
  if (score <= 16) return 'media'
  return 'alta'
}

export function vetoAplicado(respostas: RespostasArquitetura): boolean {
  return PILARES_RESTRICAO_DURA.some((pilar) => respostas[pilar] === 'a')
}

/**
 * Cruza o perfil já calculado pelo suitability (perfilFinal, após as travas de segurança
 * existentes) com as 7 respostas da Arquitetura Patrimonial, aplicando a regra de veto
 * quando necessário. Ver Seção 4 do documento para a lógica completa.
 */
export function calcularPerfilPatrimonial(
  perfilSuitability: PerfilInvestidor,
  respostasArquitetura: RespostasArquitetura,
): {
  scoreArquitetura: number
  capacidadeReal: CapacidadeReal
  vetoAplicado: boolean
  perfilPatrimonial: PerfilPatrimonial
  perfilFinalCarteira: PerfilFinalCarteira
} {
  const scoreArquitetura = calcularScoreArquitetura(respostasArquitetura)
  const capacidadeReal = capacidadePeloScore(scoreArquitetura)
  const veto = vetoAplicado(respostasArquitetura)
  const perfilPatrimonial: PerfilPatrimonial = veto ? 'Defensivo' : MATRIZ_PATRIMONIAL[capacidadeReal][perfilSuitability]
  // O Perfil Final da Carteira (1 a 9) sempre cruza o suitability original com o Vetor
  // da Arquitetura Patrimonial já resolvido acima — inclusive quando o veto rebaixa o
  // vetor para Defensivo, o que resulta em perfis como "7. Arrojado Travado".
  const perfilFinalCarteira = MATRIZ_PERFIL_FINAL[perfilSuitability][perfilPatrimonial]
  return { scoreArquitetura, capacidadeReal, vetoAplicado: veto, perfilPatrimonial, perfilFinalCarteira }
}

/** Carteiras-modelo por perfil x prazo. Servem de ponto de partida; o motor ainda
 * aplica as travas de segurança (reserva, patrimônio, experiência, idade) por cima.
 * O Tesouro Selic entra sempre pela liquidez; o Prefixado aparece no prazo médio (a taxa
 * fixa combina com uma data-alvo conhecida) e o IPCA+ no prazo longo (protege o poder de
 * compra e combina com objetivos como aposentadoria). */
const MATRIZ_BASE: Record<PerfilInvestidor, Record<PrazoBucket, Carteira>> = {
  Conservador: {
    curto: { tesouroSelic: 70, cdbLiquidez: 30 },
    medio: { tesouroSelic: 45, cdbLiquidez: 15, lciLca: 10, tesouroPrefixado: 20, ouro: 2, bdrs: 2, fundosInternacionais: 2, fiis: 4 },
    longo: { tesouroSelic: 30, cdbLiquidez: 10, lciLca: 10, tesouroIPCA: 25, ouro: 3, bdrs: 3, fundosInternacionais: 3, fiis: 16 },
  },
  Moderado: {
    curto: { tesouroSelic: 70, cdbLiquidez: 30 },
    medio: { tesouroSelic: 25, cdbLiquidez: 5, lciLca: 15, tesouroPrefixado: 15, ouro: 4, bdrs: 4, fundosInternacionais: 4, fiis: 28 },
    longo: { tesouroSelic: 10, cdbLiquidez: 5, lciLca: 15, tesouroIPCA: 20, ouro: 2, acoesETFs: 20, fiis: 24, bdrs: 2, fundosInternacionais: 2 },
  },
  // Nos três prazos do Arrojado, 3% saem da posição de renda variável (acoesETFs em
  // todos os prazos) e vão para cripto, mantendo o restante da matriz intacto.
  Arrojado: {
    curto: { tesouroSelic: 40, cdbLiquidez: 30, acoesETFs: 27, cripto: 3 },
    medio: { tesouroSelic: 10, cdbLiquidez: 7, lciLca: 14, tesouroPrefixado: 10, fiis: 20, acoesETFs: 27, bdrs: 9, cripto: 3 },
    longo: { tesouroSelic: 5, cdbLiquidez: 3, lciLca: 12, tesouroIPCA: 15, fiis: 15, acoesETFs: 27, bdrs: 10, ouro: 5, fundosInternacionais: 5, cripto: 3 },
  },
}

const ATIVOS_RISCO: AtivoKey[] = ['acoesETFs', 'bdrs', 'fiis', 'ouro', 'fundosInternacionais', 'cripto']
const ATIVOS_LIQUIDEZ: AtivoKey[] = ['tesouroSelic', 'cdbLiquidez']

export function calcularScore(respostas: RespostasQuestionario): number {
  const letras = Object.values(respostas) as Letra[]
  return letras.reduce((soma, letra) => soma + PONTOS[letra], 0)
}

export function perfilPeloScore(score: number): PerfilInvestidor {
  if (score <= 14) return 'Conservador'
  if (score <= 21) return 'Moderado'
  return 'Arrojado'
}

export function prazoPelaLetra(letra: Letra): PrazoBucket {
  if (letra === 'a') return 'curto'
  if (letra === 'd') return 'longo'
  return 'medio'
}

export function patrimonioPelaLetra(letra: Letra): number {
  return { a: 3000, b: 25000, c: 250000, d: 600000 }[letra]
}

export function experienciaPelaLetra(letra: Letra): ExperienciaNivel {
  if (letra === 'a') return 'nenhuma'
  if (letra === 'd') return 'avancada'
  return 'basica'
}

function rebaixar(perfil: PerfilInvestidor, niveis = 1): PerfilInvestidor {
  const idx = Math.max(ORDEM_PERFIL.indexOf(perfil) - niveis, 0)
  return ORDEM_PERFIL[idx]
}

function limitarAoTeto(perfil: PerfilInvestidor, teto: PerfilInvestidor): PerfilInvestidor {
  const idxAtual = ORDEM_PERFIL.indexOf(perfil)
  const idxTeto = ORDEM_PERFIL.indexOf(teto)
  return ORDEM_PERFIL[Math.min(idxAtual, idxTeto)]
}

function normalizarPara100(carteira: Carteira): Carteira {
  const entradas = Object.entries(carteira) as [AtivoKey, number][]
  const total = entradas.reduce((soma, [, v]) => soma + v, 0)
  if (total <= 0) return carteira
  const fator = 100 / total
  const arredondado = entradas.map(([k, v]) => [k, Math.round(v * fator)] as [AtivoKey, number])
  // corrige eventual erro de arredondamento (soma final deve ser exatamente 100)
  const somaArredondada = arredondado.reduce((s, [, v]) => s + v, 0)
  const diferenca = 100 - somaArredondada
  if (diferenca !== 0 && arredondado.length > 0) {
    arredondado[0][1] += diferenca
  }
  return Object.fromEntries(arredondado)
}

/** Move até `pontos` pp de uma classe para outra dentro da mesma carteira, sem
 * nunca deixar a origem negativa. Não altera a soma total da carteira — por
 * construção, o que sai de um lado entra inteiro do outro. */
function moverPontos(carteira: Carteira, de: AtivoKey, para: AtivoKey, pontos: number): number {
  const disponivel = carteira[de] ?? 0
  const mover = Math.min(disponivel, Math.max(0, pontos))
  if (mover <= 0) return 0
  const restante = disponivel - mover
  if (restante > 0) carteira[de] = restante
  else delete carteira[de]
  carteira[para] = (carteira[para] ?? 0) + mover
  return mover
}

/**
 * Calibradores Suaves (Pilares 4 a 7 da Arquitetura Patrimonial) — ajuste fino de
 * composição DENTRO do teto de risco já definido pelos Pilares 1-3 (regra de veto)
 * e pela Matriz Cruzada (calcularPerfilPatrimonial). Roda sobre a carteira-modelo
 * já escolhida por MATRIZ_PATRIMONIAL_CARTEIRA, antes das travas de segurança
 * rígidas de gerarRecomendacao (reserva, patrimônio, experiência) — essas travas
 * sempre têm a palavra final e podem desfazer qualquer ajuste feito aqui.
 *
 * Pilar 7 (Eficiência Fiscal) não move nenhum percentual: PGBL, VGBL e Holding são
 * veículos/invólucros fiscais, não classes de ativo, então a resposta gera apenas
 * um alerta informativo para o consultor.
 */
export function aplicarCalibradoresSuaves(
  carteiraOriginal: Carteira,
  respostas: RespostasArquitetura,
): { carteira: Carteira; alertas: string[] } {
  const carteira: Carteira = { ...carteiraOriginal }
  const alertas: string[] = []

  // Pilar 4 — Comportamento sob Estresse.
  if (respostas.comportamentoEstresse === 'a') {
    let movido = 0
    for (const ativo of ['acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as AtivoKey[]) {
      movido += moverPontos(carteira, ativo, 'ouro', Math.round((carteira[ativo] ?? 0) * 0.3))
    }
    if (movido > 0) {
      alertas.push('Reduzimos a fatia mais volátil da carteira: você já reagiu a quedas fortes resgatando tudo antes.')
    }
  } else if (respostas.comportamentoEstresse === 'c') {
    moverPontos(carteira, 'tesouroSelic', 'acoesETFs', 3)
    moverPontos(carteira, 'tesouroSelic', 'bdrs', 2)
  }

  // Pilar 5 — Dependência de Renda Passiva: equilíbrio entre FIIs (renda) e
  // Ações (crescimento) dentro do mesmo bloco de risco.
  if (respostas.dependenciaRenda === 'a') {
    const movido = moverPontos(carteira, 'acoesETFs', 'fiis', Math.round((carteira.acoesETFs ?? 0) * 0.4))
    if (movido > 0) {
      alertas.push('Priorizamos FIIs sobre ações de crescimento: você depende do fluxo de caixa da carteira hoje.')
    }
  } else if (respostas.dependenciaRenda === 'c') {
    moverPontos(carteira, 'fiis', 'acoesETFs', Math.round((carteira.fiis ?? 0) * 0.3))
  }

  // Pilar 6 — Capital Humano: renda oscilante busca mais previsibilidade dentro da
  // própria Renda Fixa Estruturada; renda ultra estável libera um pouco mais de
  // risco, já que a "reserva humana" de estabilidade é maior.
  if (respostas.capitalHumano === 'a') {
    moverPontos(carteira, 'tesouroPrefixado', 'tesouroIPCA', Math.round((carteira.tesouroPrefixado ?? 0) * 0.5))
  } else if (respostas.capitalHumano === 'c') {
    moverPontos(carteira, 'tesouroSelic', 'acoesETFs', 2)
    moverPontos(carteira, 'tesouroSelic', 'bdrs', 1)
  }

  // Pilar 7 — Eficiência Fiscal e Sucessão: apenas alerta (ver comentário acima).
  if (respostas.eficienciaFiscal === 'a') {
    alertas.push('Considere aportar parte da fatia de Renda Fixa via PGBL para aproveitar a dedução de até 12% do IR.')
  } else if (respostas.eficienciaFiscal === 'c') {
    alertas.push('Considere VGBL ou Previdência em regime regressivo para os blocos de Renda Fixa e Hedge, dado o foco sucessório.')
  }

  return { carteira, alertas }
}

/**
 * Recebe as respostas do questionário e alguns dados complementares e devolve o
 * perfil calculado, o perfil final (após travas de segurança) e a carteira sugerida
 * já normalizada para somar 100%.
 */
export function gerarRecomendacao(
  respostas: RespostasQuestionario,
  dados: DadosComplementares,
  respostasArquitetura?: RespostasArquitetura,
): ResultadoRecomendacao {
  const score = calcularScore(respostas)
  const perfilBase = perfilPeloScore(score)
  const prazo = prazoPelaLetra(respostas.prazo)
  const temReserva = respostas.reserva === 'c' || respostas.reserva === 'd'
  const patrimonio = patrimonioPelaLetra(respostas.patrimonio)
  const experiencia = experienciaPelaLetra(respostas.experiencia)
  const liquidezFrequente = respostas.reacao === 'a'
  const buscaAposentadoria = respostas.objetivo === 'd'

  const alertas: string[] = []
  let perfilFinal = perfilBase

  if (prazo === 'curto' && perfilFinal === 'Arrojado') {
    perfilFinal = rebaixar(perfilFinal)
    alertas.push('Perfil ajustado para Moderado: prazo curto não combina com o risco de um perfil Arrojado.')
  }
  if (liquidezFrequente) {
    const anterior = perfilFinal
    perfilFinal = limitarAoTeto(perfilFinal, 'Moderado')
    if (perfilFinal !== anterior) {
      alertas.push('Perfil limitado a Moderado: você pode precisar do dinheiro de forma inesperada.')
    }
  }
  if (dados.idade > 60 && buscaAposentadoria) {
    const anterior = perfilFinal
    perfilFinal = rebaixar(perfilFinal)
    if (perfilFinal !== anterior) {
      alertas.push('Perfil ajustado para preservar capital, considerando idade e foco em aposentadoria.')
    }
  }

  // Quando as 7 perguntas da Arquitetura Patrimonial já foram respondidas, a "Carteira
  // Ideal" combina os dois eixos: o perfil patrimonial (Defensivo/Equilibrado/Crescimento
  // Pleno) escolhe a linha certa da MATRIZ_PATRIMONIAL_CARTEIRA, e o prazo (curto/médio/
  // longo) — que já vem do suitability — escolhe a coluna. Sem as 7 perguntas novas, o
  // motor cai de volta na matriz antiga, só por suitability x prazo.
  let arquitetura: ReturnType<typeof calcularPerfilPatrimonial> | null = null
  if (respostasArquitetura) {
    arquitetura = calcularPerfilPatrimonial(perfilFinal, respostasArquitetura)
  }

  let carteira: Carteira = arquitetura
    ? { ...MATRIZ_PATRIMONIAL_CARTEIRA[arquitetura.perfilPatrimonial][prazo] }
    : { ...MATRIZ_BASE[perfilFinal][prazo] }

  // Calibradores Suaves (Pilares 4 a 7): ajuste fino de composição dentro do teto
  // de risco já definido acima. Só roda quando a Arquitetura Patrimonial foi
  // respondida — sem ela não há pilares 4-7 para calibrar. As travas de segurança
  // rígidas logo abaixo (reserva, patrimônio, experiência) rodam depois e sempre
  // podem desfazer o que for necessário.
  if (respostasArquitetura) {
    const calibrado = aplicarCalibradoresSuaves(carteira, respostasArquitetura)
    carteira = calibrado.carteira
    alertas.push(...calibrado.alertas)
  }

  if (!temReserva) {
    const liquidezAtual = ATIVOS_LIQUIDEZ.reduce((s, k) => s + (carteira[k] ?? 0), 0)
    if (liquidezAtual < 20) {
      carteira.cdbLiquidez = (carteira.cdbLiquidez ?? 0) + (20 - liquidezAtual)
      alertas.push('Reforçamos a liquidez da carteira: você ainda não tem reserva de emergência formada.')
    }
  }

  if (patrimonio < 5000) {
    let removido = 0
    for (const ativo of ['fiis', 'acoesETFs', 'bdrs', 'ouro', 'fundosInternacionais', 'cripto'] as AtivoKey[]) {
      if (carteira[ativo]) {
        removido += carteira[ativo]!
        delete carteira[ativo]
      }
    }
    if (removido > 0) {
      carteira.tesouroSelic = (carteira.tesouroSelic ?? 0) + removido
      alertas.push('Com um valor inicial baixo, priorizamos Tesouro Direto e CDB até você diversificar mais.')
    }
  }

  if (experiencia === 'nenhuma') {
    let excedente = 0
    for (const ativo of ATIVOS_RISCO) {
      const atual = carteira[ativo]
      if (atual && atual > 10) {
        excedente += atual - 10
        carteira[ativo] = 10
      }
    }
    if (excedente > 0) {
      carteira.tesouroSelic = (carteira.tesouroSelic ?? 0) + excedente
      alertas.push('Limitamos a exposição a ativos de maior risco: você está começando agora a investir.')
    }
  }

  carteira = normalizarPara100(carteira)

  const resultado: ResultadoRecomendacao = { score, perfilBase, perfilFinal, prazo, carteira, alertas }

  if (arquitetura) {
    resultado.scoreArquitetura = arquitetura.scoreArquitetura
    resultado.capacidadeReal = arquitetura.capacidadeReal
    resultado.vetoAplicado = arquitetura.vetoAplicado
    resultado.perfilPatrimonial = arquitetura.perfilPatrimonial
    resultado.perfilFinalCarteira = arquitetura.perfilFinalCarteira
    if (arquitetura.vetoAplicado) {
      alertas.push('Perfil final levado a Defensivo: um dos pilares de restrição dura (capacidade, passivo ou liquidez) indicou risco imediato.')
    }
  }

  return resultado
}
