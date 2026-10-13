import type {
  AtivoKey,
  Carteira,
  CapacidadeReal,
  DadosComplementares,
  ExperienciaNivel,
  Letra,
  LetraArquitetura,
  PerfilFinalCarteira,
  PilarDeVeto,
  PerfilInvestidor,
  PerfilPatrimonial,
  PrazoBucket,
  ResultadoRecomendacao,
  RespostasArquitetura,
  RespostasQuestionario,
} from './types'

const PONTOS: Record<Letra, number> = { a: 1, b: 2, c: 3, d: 4 }

const ORDEM_PERFIL: PerfilInvestidor[] = ['Conservador', 'Moderado', 'Arrojado']

/** Pontos da Arquitetura Patrimonial: [A] = 1, [B] = 2, [C] = 3. Soma dos 6 pilares que
 * medem capacidade de risco (1 a 6): varia de 6 a 18. O Pilar 7 (Eficiência Fiscal) é só
 * informativo: o regime de declaração do IR não diz nada sobre capacidade de assumir risco
 * (D73), então não pontua. */
const PONTOS_ARQUITETURA: Record<LetraArquitetura, number> = { a: 1, b: 2, c: 3 }

const PILARES_PONTUAM: (Exclude<keyof RespostasArquitetura, 'eficienciaFiscal' | 'parteDoSaque'>)[] = [
  'capacidadeFinanceira',
  'passivoDividas',
  'janelaLiquidez',
  'comportamentoEstresse',
  'dependenciaRenda',
  'capitalHumano',
]

/** Pilares com poder de veto — ver docs/02-metodologia.md, seção 3.2. Uma resposta 'a' em qualquer um deles rebaixa o perfil
 * final para Defensivo, independentemente do score consolidado ou do suitability. */
/** Identifica a versão das regras do motor em cada resultado (D78). Mude a cada alteração de regra. */
export const VERSAO_MOTOR = '2026.10.12-D83'

/** Texto de cada pilar duro para explicar o veto ao cliente, em linguagem simples. */
const MOTIVO_DO_VETO: Record<PilarDeVeto, string> = {
  capacidadeFinanceira: 'sua reserva cobre menos de 3 meses de despesas',
  passivoDividas: 'você tem dívida cara ou passivo em dólar',
  janelaLiquidez: 'você vai precisar de uma parte relevante do dinheiro em até 24 meses',
}

const PILARES_RESTRICAO_DURA: PilarDeVeto[] = [
  'capacidadeFinanceira',
  'passivoDividas',
  'janelaLiquidez',
]

/** Capacidade real → Vetor da Arquitetura Patrimonial (D73). A capacidade define SÓ o
 * vetor; o suitability entra depois como teto de risco da carteira (TETO_RISCO_SUITABILITY)
 * e como a outra metade do nome do Perfil-Mãe. Assim os 9 Perfis-Mãe são todos
 * alcançáveis (antes, 2, 3 e 6 nunca apareciam) sem que um Conservador receba mais risco
 * do que declarou tolerar. */
const VETOR_PELA_CAPACIDADE: Record<CapacidadeReal, PerfilPatrimonial> = {
  baixa: 'Defensivo',
  media: 'Equilibrado',
  alta: 'Crescimento Pleno',
}

/** Teto de risco (soma de ouro, FIIs, ações, BDRs, internacionais e cripto, em % da
 * carteira) por suitability e prazo. Os do Conservador são os da carteira Defensivo; os do
 * Moderado deixam passar o Equilibrado de hoje e cortam só o Crescimento Pleno. O Arrojado
 * não tem teto. Cripto só para Arrojado (doc 02, seção 5.1). */
const TETO_RISCO_SUITABILITY: Record<PerfilInvestidor, Record<PrazoBucket, number>> = {
  Conservador: { curto: 10, medio: 20, longo: 30 },
  Moderado: { curto: 35, medio: 45, longo: 55 },
  Arrojado: { curto: 100, medio: 100, longo: 100 },
}

/** Piso de liquidez (Tesouro Selic + CDB) quando o investidor não tem reserva. */
const PISO_LIQUIDEZ_SEM_RESERVA = 20

/** A partir desta idade o app avisa sobre previdência e sucessão (o Pilar 7 já não
 * pergunta sobre sucessão — D73). */
const IDADE_ALERTA_SUCESSAO = 50

/** Os 9 Perfis-Mãe de Carteira: cruzamento dos 3 Perfis de Suitability (linha) com os
 * 3 Vetores da Arquitetura Patrimonial (coluna) — resultado de VETOR_PELA_CAPACIDADE acima,
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
    Defensivo: '7. Arrojado Travado (Quase Arrojado)',
    Equilibrado: '8. Arrojado Gerador de Renda',
    'Crescimento Pleno': '9. Arrojado Pleno / Global',
  },
}

/**
 * Carteiras-modelo das 11 classes por perfil da Arquitetura Patrimonial x prazo — a
 * "Carteira Ideal" propriamente dita. O documento docs/02-metodologia.md (seção 5.2) define as carteiras-modelo; aqui
 * a do prazo médio é a referência, e as variantes "curto"/"longo" seguem a mesma lógica já
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
  return PILARES_PONTUAM.reduce((soma, pilar) => soma + PONTOS_ARQUITETURA[respostas[pilar]], 0)
}

export function capacidadePeloScore(score: number): CapacidadeReal {
  if (score <= 9) return 'baixa'
  if (score <= 14) return 'media'
  return 'alta'
}

/** O Pilar 3 [A] só veta quando o saque é grande (D83): quem declarou que vai sacar menos da metade
 * em até 24 meses ('b' ou 'c' em `parteDoSaque`) não é vetado. Sem a resposta de complemento
 * (estado salvo antigo, API sem o campo), vale o comportamento anterior: veta. */
function janelaVeta(respostas: RespostasArquitetura): boolean {
  return respostas.janelaLiquidez === 'a' && (respostas.parteDoSaque === undefined || respostas.parteDoSaque === 'a')
}

function pilarVeta(respostas: RespostasArquitetura, pilar: PilarDeVeto): boolean {
  return pilar === 'janelaLiquidez' ? janelaVeta(respostas) : respostas[pilar] === 'a'
}

/** Quais pilares duros vetam, na ordem das perguntas. */
export function pilaresQueVetam(respostas: RespostasArquitetura): PilarDeVeto[] {
  return (PILARES_RESTRICAO_DURA as PilarDeVeto[]).filter((pilar) => pilarVeta(respostas, pilar))
}

export function vetoAplicado(respostas: RespostasArquitetura): boolean {
  return pilaresQueVetam(respostas).length > 0
}

/**
 * Cruza o perfil já calculado pelo suitability (perfilFinal, após as travas de segurança
 * existentes) com as 7 respostas da Arquitetura Patrimonial, aplicando a regra de veto
 * quando necessário. Ver docs/02-metodologia.md, seções 3.2 e 3.3, para a lógica completa.
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
  const perfilPatrimonial: PerfilPatrimonial = veto ? 'Defensivo' : VETOR_PELA_CAPACIDADE[capacidadeReal]
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
export interface OpcoesCalibradores {
  /** false numa carteira vetada/Defensiva: os calibradores que AUMENTAM risco (Pilar 4 [C]
   * e Pilar 6 [C]) não rodam, para não furar o teto que o veto acabou de impor (D73). */
  permitirAumentoRisco?: boolean
  /** false quando a pergunta de reação do suitability disse que o investidor se abala com
   * quedas: o Pilar 4 [C] ("comprar mais na queda") então não vale (D73). */
  reacaoCalma?: boolean
}

export function aplicarCalibradoresSuaves(
  carteiraOriginal: Carteira,
  respostas: RespostasArquitetura,
  opcoes: OpcoesCalibradores = {},
): { carteira: Carteira; alertas: string[] } {
  const { permitirAumentoRisco = true, reacaoCalma = true } = opcoes
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
  } else if (respostas.comportamentoEstresse === 'c' && permitirAumentoRisco && reacaoCalma) {
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
  } else if (respostas.capitalHumano === 'c' && permitirAumentoRisco) {
    moverPontos(carteira, 'tesouroSelic', 'acoesETFs', 2)
    moverPontos(carteira, 'tesouroSelic', 'bdrs', 1)
  }

  // Pilar 7 — Eficiência Fiscal: só o regime de declaração do IR (uma resposta, um conceito).
  // Apenas alerta, não pontua nem move percentual (ver comentário acima e D73).
  if (respostas.eficienciaFiscal === 'a') {
    alertas.push('Considere aportar parte da fatia de Renda Fixa via PGBL para aproveitar a dedução de até 12% do IR.')
  } else if (respostas.eficienciaFiscal === 'b') {
    alertas.push('Na declaração simplificada, aportes em PGBL não reduzem o imposto a pagar; se previdência fizer sentido para você, compare com o VGBL.')
  } else if (respostas.eficienciaFiscal === 'c') {
    alertas.push('Confira se você precisa declarar o IR e qual modelo (completo ou simplificado) é mais vantajoso antes de contratar previdência.')
  }

  return { carteira, alertas }
}

function somaRisco(carteira: Carteira): number {
  return ATIVOS_RISCO.reduce((s, k) => s + (carteira[k] ?? 0), 0)
}

/** O suitability é o teto de risco (D73): cripto só para o Arrojado e, acima do teto da
 * tabela TETO_RISCO_SUITABILITY, o excesso sai de todas as classes de risco na mesma
 * proporção e vai para o Tesouro Selic (prazo curto) ou o Tesouro IPCA+ (médio e longo).
 * Devolve o alerta a mostrar, ou nada se não houve corte. */
function aplicarTetoSuitability(carteira: Carteira, perfil: PerfilInvestidor, prazo: PrazoBucket): string[] {
  const destino: AtivoKey = prazo === 'curto' ? 'tesouroSelic' : 'tesouroIPCA'
  let movido = 0
  if (perfil !== 'Arrojado' && carteira.cripto) {
    movido += moverPontos(carteira, 'cripto', destino, carteira.cripto)
  }
  const teto = TETO_RISCO_SUITABILITY[perfil][prazo]
  const total = somaRisco(carteira)
  if (total > teto) {
    // Maiores restos: cada classe mantém o piso de (atual x fator) e os pontos que sobram até o
    // teto vão, um a um, para as classes de maior resto. Sem isso o corte ficava abaixo do teto.
    const fator = teto / total
    const partes = ATIVOS_RISCO.filter((a) => (carteira[a] ?? 0) > 0).map((ativo) => {
      const exato = (carteira[ativo] ?? 0) * fator
      return { ativo, mantido: Math.floor(exato), resto: exato - Math.floor(exato) }
    })
    let sobra = teto - partes.reduce((s, p) => s + p.mantido, 0)
    for (const p of [...partes].sort((x, y) => y.resto - x.resto)) {
      if (sobra <= 0) break
      p.mantido += 1
      sobra -= 1
    }
    for (const p of partes) movido += moverPontos(carteira, p.ativo, destino, (carteira[p.ativo] ?? 0) - p.mantido)
  }
  return movido > 0
    ? [`Limitamos a fatia de maior risco ao que o seu perfil de investidor (${perfil}) tolera.`]
    : []
}

/** Garante o piso de liquidez de quem não tem reserva. A fatia que falta vem primeiro da renda
 * fixa de prazo mais longo (IPCA+, Prefixado e LCI/LCA, que não são risco) e, só se isso não bastar,
 * das classes de risco, sempre na mesma proporção dentro de cada grupo (D81). Antes todas cediam
 * juntas, e o piso reduzia o risco de quem tinha a carteira mais arrojada, o que podia deixá-la
 * com menos risco que a Defensiva do veto. Não é somada por cima: a normalização final diluiria o
 * piso abaixo de 20%. Devolve true se mexeu na carteira. */
function garantirPisoLiquidez(carteira: Carteira): boolean {
  const liquidez = ATIVOS_LIQUIDEZ.reduce((s, k) => s + (carteira[k] ?? 0), 0)
  let falta = PISO_LIQUIDEZ_SEM_RESERVA - liquidez
  if (falta <= 0) return false
  // Primeiro da renda fixa de prazo mais longo (não é risco); só depois das classes de risco.
  const grupos: AtivoKey[][] = [['tesouroIPCA', 'tesouroPrefixado', 'lciLca'], ATIVOS_RISCO]
  for (const grupo of grupos) {
    const classes = grupo.filter((k) => (carteira[k] ?? 0) > 0).sort((a, b) => (carteira[b] ?? 0) - (carteira[a] ?? 0))
    const total = classes.reduce((s, k) => s + (carteira[k] ?? 0), 0)
    if (total <= 0 || falta <= 0) continue
    const tirar = Math.min(falta, total)
    const cortes = classes.map((k) => Math.floor(((carteira[k] ?? 0) * tirar) / total))
    let resto = tirar - cortes.reduce((s, c) => s + c, 0)
    for (let n = 0; resto > 0 && n < cortes.length * 2; n++) {
      const idx = n % cortes.length
      if (cortes[idx] < (carteira[classes[idx]] ?? 0)) { cortes[idx] += 1; resto -= 1 }
    }
    classes.forEach((k, idx) => moverPontos(carteira, k, 'cdbLiquidez', cortes[idx]))
    falta -= tirar
  }
  return true
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
  const prazoSuitability = prazoPelaLetra(respostas.prazo)
  let prazo = prazoSuitability
  const reservaSuitability = respostas.reserva === 'c' || respostas.reserva === 'd'
  const temReserva = reservaSuitability
  const patrimonio = patrimonioPelaLetra(respostas.patrimonio)
  const experiencia = experienciaPelaLetra(respostas.experiencia)
  const liquidezFrequente = respostas.reacao === 'a'
  const buscaAposentadoria = respostas.objetivo === 'd'

  const alertas: string[] = []
  const regras: string[] = []
  let perfilFinal = perfilBase

  if (prazoSuitability === 'curto' && perfilFinal === 'Arrojado') {
    perfilFinal = rebaixar(perfilFinal)
    alertas.push('Perfil ajustado para Moderado: prazo curto não combina com o risco de um perfil Arrojado.')
    regras.push('rebaixa:prazo-curto-arrojado')
  }
  if (liquidezFrequente) {
    const anterior = perfilFinal
    perfilFinal = limitarAoTeto(perfilFinal, 'Moderado')
    if (perfilFinal !== anterior) {
      alertas.push('Perfil limitado a Moderado: você pode precisar do dinheiro de forma inesperada.')
      regras.push('limite:reacao-ansiosa')
    }
  }
  if (dados.idade > 60 && buscaAposentadoria) {
    const anterior = perfilFinal
    perfilFinal = rebaixar(perfilFinal)
    if (perfilFinal !== anterior) {
      alertas.push('Perfil ajustado para preservar capital, considerando idade e foco em aposentadoria.')
      regras.push('rebaixa:idade-aposentadoria')
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

    // Janela de liquidez (Pilar 3) manda no prazo da carteira (D73): quem vai sacar em até
    // 24 meses recebe o modelo de curto prazo, e quem vai sacar entre 3 e 5 anos recebe, no
    // máximo, o de médio, mesmo que tenha marcado prazo longo no suitability.
    if (respostasArquitetura.janelaLiquidez === 'a' && respostasArquitetura.parteDoSaque === 'c') {
      // Saque pequeno (menos de um quarto) em até 24 meses (D83): sem veto, e no máximo o modelo
      // de médio prazo, como quem prevê o gasto entre 3 e 5 anos.
      if (prazo === 'longo') {
        prazo = 'medio'
        alertas.push('Usamos o modelo de médio prazo: você prevê sacar menos de um quarto do dinheiro em até 24 meses.')
        regras.push('prazo:saque-pequeno-24-meses')
      }
    } else if (respostasArquitetura.janelaLiquidez === 'a' && prazo !== 'curto') {
      prazo = 'curto'
      if (respostasArquitetura.parteDoSaque === 'b') {
        alertas.push('Usamos o modelo de curto prazo, que mantém cerca de metade da carteira em liquidez: você prevê sacar de um quarto até a metade do dinheiro em até 24 meses. Não tratamos isso como veto.')
        regras.push('prazo:saque-medio-24-meses')
      } else {
        alertas.push('Usamos o modelo de curto prazo: você vai precisar de uma parte relevante do dinheiro em até 24 meses.')
        regras.push('prazo:janela-24-meses')
      }
    } else if (respostasArquitetura.janelaLiquidez === 'b' && prazo === 'longo') {
      prazo = 'medio'
      alertas.push('Usamos o modelo de médio prazo: você prevê um gasto grande entre 3 e 5 anos.')
      regras.push('prazo:janela-3-a-5-anos')
    }
    // Veto (D82): quem vetou por reserva curta, dívida cara ou saque próximo recebe no máximo o modelo
    // de médio prazo. O Defensivo de longo prazo tem 30% em risco, o que contradiz o aviso de
    // "resolva isso antes de investir"; o de médio tem 20%.
    if (arquitetura.vetoAplicado && prazo === 'longo') {
      prazo = 'medio'
      alertas.push('Usamos o modelo de médio prazo: com a sua situação de reserva, dívidas ou saque próximo, a prioridade agora é segurança e liquidez, e não o crescimento de longo prazo.')
      regras.push('prazo:veto-medio')
    }
    if (reservaSuitability && respostasArquitetura.capacidadeFinanceira === 'a') {
      alertas.push('Suas respostas sobre reserva divergiram; consideramos a mais cautelosa (menos de 3 meses).')
      regras.push('aviso:reserva-divergente')
    }
    if (respostasArquitetura.passivoDividas === 'a') {
      alertas.push('Prioridade antes de investir: quitar dívida cara (cartão, cheque especial) costuma render mais do que qualquer investimento. O plano de dívidas do Meu Mês ajuda nisso.')
      regras.push('aviso:divida-cara')
    }
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
    const reacaoCalma = respostas.reacao === 'c' || respostas.reacao === 'd'
    const calibrado = aplicarCalibradoresSuaves(carteira, respostasArquitetura, {
      permitirAumentoRisco: arquitetura !== null && !arquitetura.vetoAplicado && arquitetura.perfilPatrimonial !== 'Defensivo',
      reacaoCalma,
    })
    carteira = calibrado.carteira
    alertas.push(...calibrado.alertas)
    if (respostasArquitetura.comportamentoEstresse === 'c' && !reacaoCalma) {
      alertas.push('Você disse que notícias de crise te abalam; por isso não aumentamos a exposição a ações por ver quedas como oportunidade.')
      regras.push('limite:estresse-vs-reacao')
    }
    if (dados.idade >= IDADE_ALERTA_SUCESSAO) {
      alertas.push('Se o planejamento sucessório é uma preocupação, converse com um especialista sobre VGBL/previdência e outras formas de organizar a herança.')
    }
  }

  // O limite de 10% por classe de quem nunca investiu roda ANTES do teto do suitability (D80): se rodasse
  // depois, a mesma carteira seria cortada duas vezes e a de quem declarou mais capacidade acabaria com
  // menos risco que a de quem declarou menos.
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
      regras.push('limite:sem-experiencia')
    }
  }

  // O suitability é o teto de risco da carteira, qualquer que seja o vetor patrimonial.
  const avisoTeto = aplicarTetoSuitability(carteira, perfilFinal, prazo)
  if (avisoTeto.length > 0) {
    alertas.push(...avisoTeto)
    regras.push(`teto:suitability-${perfilFinal.toLowerCase()}`)
  }

  if (!temReserva && garantirPisoLiquidez(carteira)) {
    alertas.push('Reforçamos a liquidez da carteira: você ainda não tem reserva de emergência formada.')
    regras.push('piso:liquidez-sem-reserva')
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
      regras.push('limite:patrimonio-baixo')
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
    if (arquitetura.vetoAplicado && respostasArquitetura) {
      const pilares = pilaresQueVetam(respostasArquitetura)
      resultado.pilaresDoVeto = pilares
      // O motivo do veto vem primeiro: é o que o cliente mais precisa entender do resultado.
      alertas.unshift(
        `Carteira levada a Defensivo porque ${pilares.map((p) => MOTIVO_DO_VETO[p]).join('; ')}. Resolvendo isso, o perfil pode subir numa nova avaliação.`,
      )
      regras.unshift(...pilares.map((p) => `veto:${p}`))
    }
  }

  resultado.versaoMotor = VERSAO_MOTOR
  resultado.regrasAcionadas = regras

  return resultado
}
