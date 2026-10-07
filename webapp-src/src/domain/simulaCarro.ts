// Comparativo de CARRO: comprar à vista, financiar, consórcio, alugar (locação) ou ficar sem carro (D47, D69).
//
// Mesmo molde do imóvel (simulaImovel.ts, D44 a D46), com a diferença que define tudo: o carro PERDE valor.
// Por isso o resultado sai em duas leituras lado a lado, que são a mesma conta vista de dois ângulos:
//   1. CUSTO de mobilidade (destaque): quanto o caminho custou, no total e por mês, já descontado o que o dinheiro rendeu.
//   2. PATRIMÔNIO líquido final: o que sobra no último dia (carro a preço de mercado − dívida + investimentos líquidos de IR).
// Como todos os caminhos partem do mesmo dinheiro e gastam o mesmo orçamento, `custo líquido = dinheiro colocado − patrimônio`
// e a ordem por custo é exatamente a inversa da ordem por patrimônio. A tela diz isso; não são dois critérios concorrentes.
//
// É conta matemática sobre premissas informadas pela pessoa: não indica banco, administradora de consórcio, locadora,
// aplicativo nem produto, e não é recomendação de investimento. Como o imóvel, roda no navegador.
//
// ── Regra do mesmo dinheiro (igual à do imóvel) ─────────────────────────────────────────
// 1. Capital inicial comum (C): o que a pessoa tem hoje. Sem informar, C = entrada + custos de aquisição do financiamento (K0).
//    Cada caminho gasta o que precisa na compra e mantém o resto aplicado desde o mês 0. Sem carro e consórcio aplicam C inteiro.
//    A rota à vista só entra se C cobrir o carro mais os custos de aquisição (nunca se inventa dinheiro).
// 2. Orçamento mensal comum: em cada mês, o orçamento de referência é o MAIOR desembolso entre os caminhos. Quem gasta menos
//    investe a diferença.
// 3. Patrimônio = carro a preço de mercado − dívida + fundo de investimento (líquido de IR). Opcionalmente desconta a perda
//    na revenda (a loja paga abaixo da tabela).
//
// ── O que muda em relação ao imóvel ─────────────────────────────────────────────────────
// - Depreciação: o valor cai de forma não linear, mais forte no 1º ano (curva em dois trechos, taxas nominais ao ano).
//   Entra na contabilidade como "valorização" NEGATIVA.
// - Custos de dono: IPVA e seguro (% do valor de mercado no início de cada ano de posse), manutenção (% do preço de compra,
//   sobe com a inflação e com a idade) e uso (combustível, estacionamento, pedágio: R$ por mês, corrigido pela inflação).
// - Aquisição: emplacamento/transferência (% do carro) em todo caminho que compra; IOF e gravame só no financiamento.
// - Financiamento sempre em Price, com juros informados em % ao MÊS. O CET é resultado (TIR), nunca entrada.
// - Consórcio: carta = valor do carro; parcela = carta × (1 + adm + fundo de reserva) / prazo; carta e parcela corrigidas
//   1 vez por ano. Até a contemplação a pessoa paga parcela E a mobilidade sem carro. Na contemplação compra o carro
//   equivalente pelo preço daquele mês (a diferença para a carta sai do fundo, ou sobra) e paga o emplacamento.
// - "Sem carro" não é aluguel de carro: é o custo mensal TOTAL de se mover sem ter o bem (assinatura, locação, aplicativo),
//   informado pela pessoa, corrigido pela inflação. Quem tem o carro paga o uso por conta própria; este valor já o inclui.
//
// Simplificações NÃO modeladas (ditas na tela): ganho ou prejuízo de capital na venda, multas, IPVA pago em parcela única
// no início do ano (aqui é diluído por mês), desconto de IPVA/IPI para PCD, seguro prestamista, troca de carro no meio do
// horizonte, valor do tempo e da conveniência, e o valor de um carro que roda pouco ou muito.

import { aliquotaIr } from './simulaTesouro'
import { calcularCet, tabelaFinanciamento } from './simulaImovel'
import type { SnapshotMercado } from './mercadoOficial'

export type TipoCarro = 'zeroKm' | 'seminovo'
/** Qual bem o motor simula. O cálculo é o mesmo; muda só o vocabulário das mensagens (D48: moto reaproveita este motor). */
export type Bem = 'carro' | 'moto'
export type RegraLanceCarro = 'prazo' | 'parcela'
export type ChaveCarro = 'avista' | 'financiamento' | 'consorcio' | 'semCarro' | 'locacao'

export const NOMES_CARRO: Record<ChaveCarro, string> = {
  financiamento: 'Financiar',
  consorcio: 'Consórcio',
  avista: 'Comprar à vista',
  semCarro: 'Sem carro',
  locacao: 'Locação',
}

/** Ordem fixa dos caminhos na tela e no seletor. */
export const TODOS_CAMINHOS_CARRO: ChaveCarro[] = ['avista', 'financiamento', 'consorcio', 'locacao', 'semCarro']
/** Sem escolha (`caminhos` ausente ou null), valem os quatro caminhos que existiam antes da locação (D69): nada do que estava publicado muda. */
export const CAMINHOS_ANTES_DA_LOCACAO: ChaveCarro[] = ['avista', 'financiamento', 'consorcio', 'semCarro']

/** Nomes dos caminhos para cada bem: só "sem carro" vira "sem moto". */
export function nomesRotas(bem: Bem): Record<ChaveCarro, string> {
  return bem === 'moto' ? { ...NOMES_CARRO, semCarro: 'Sem moto' } : NOMES_CARRO
}

/** Pedaços de texto que variam com o bem (gênero incluído), para as mensagens do motor. */
const VOCAB: Record<Bem, { n: string; do: string; ficaVelho: string; trocar: string }> = {
  carro: { n: 'carro', do: 'do carro', ficaVelho: 'o carro fica velho', trocar: 'trocar de carro' },
  moto: { n: 'moto', do: 'da moto', ficaVelho: 'a moto fica velha', trocar: 'trocar de moto' },
}

export interface InputsCarro {
  /** Qual bem: define só o vocabulário das mensagens. Padrão `carro`. */
  bem: Bem
  tipo: TipoCarro
  valorCarro: number
  horizonteAnos: number

  // Mercado (% ao ano)
  rendimentoAA: number
  /** true = a taxa de rendimento é bruta e o IR regressivo incide no resgate. */
  aplicarIR: boolean
  inflacaoAA: number

  // Depreciação (nominal, % ao ano, sobre o valor corrente)
  /** Perda de valor nos primeiros 12 meses. */
  deprecAno1Pct: number
  /** Perda de valor por ano, a partir do 13º mês. */
  deprecDemaisPct: number

  // Custos de dono
  /** IPVA, % do valor de mercado ao ano. Varia por estado. */
  ipvaPct: number
  /** Seguro, % do valor de mercado ao ano. */
  seguroPct: number
  /** Manutenção e revisões, % do preço de compra ao ano (no 1º ano de posse). */
  manutencaoAA: number
  /** Aumento anual extra da manutenção por causa da idade, além da inflação. */
  envelhecimentoManutencaoAA: number
  /** Combustível, estacionamento, pedágio e lavagem, R$ por mês de hoje. */
  usoMensal: number

  // Aquisição e revenda
  /** Emplacamento, licenciamento ou transferência, % do valor do carro. */
  emplacamentoPct: number
  /** true = o patrimônio final desconta o deságio da revenda. */
  descontarCustosVenda: boolean
  /** Quanto a loja paga abaixo do valor de mercado, % (usado só se descontarCustosVenda). */
  descontoRevendaPct: number

  // Financiamento (Price)
  entrada: number
  /** Juros da proposta, % ao mês. */
  jurosMensalPct: number
  prazoFinanciamentoMeses: number
  /** IOF do financiamento, % sobre o valor financiado, pago no início. */
  iofPct: number
  /** Gravame (registro da alienação), R$. */
  gravame: number

  // Consórcio
  taxaAdmTotalPct: number
  fundoReservaPct: number
  prazoConsorcioMeses: number
  reajusteConsorcioAA: number
  /** Lance com recursos próprios, em R$ de hoje (0 = sem lance). */
  lance: number
  regraLance: RegraLanceCarro
  /** Mês da contemplação (1 até o prazo do consórcio e o horizonte). */
  mesContemplacao: number

  // Sem carro
  /** Quanto custa se mover sem o carro (assinatura, locação, aplicativo), R$ por mês de hoje. */
  mobilidadeMensal: number

  // Locação (D69): mensalidade com IPVA, seguro e manutenção incluídos; a pessoa paga o uso (combustível etc.)
  /** Mensalidade da locação, R$ por mês de hoje. Já inclui IPVA, seguro e manutenção. */
  locacaoMensal: number
  /** Reajuste anual da mensalidade e do quilômetro excedente, % ao ano. */
  locacaoReajusteAA: number
  /** Caução paga no início e devolvida no fim, sem rendimento, R$. */
  locacaoCaucao: number
  /** Taxa de entrada ou de adesão paga no início e NÃO devolvida, R$. */
  locacaoTaxaEntrada: number
  /** Quilômetros por mês incluídos na mensalidade. */
  locacaoKmIncluido: number
  /** Quilômetros que a pessoa roda por mês. */
  locacaoKmRodado: number
  /** Preço do quilômetro excedente, R$ por km de hoje. */
  locacaoKmExcedente: number
  /** true = no último mês do horizonte a pessoa compra o veículo pelo valor combinado em contrato. */
  locacaoComprarNoFim: boolean
  /** Valor da compra no fim do contrato, R$ nominais (fixado em contrato). Usado só se `locacaoComprarNoFim`. */
  locacaoValorCompra: number

  // Dinheiro disponível
  /** Quanto a pessoa tem hoje. `null` = só a entrada e os custos de aquisição do financiamento (modo padrão). */
  dinheiroDisponivel: number | null

  // Caminhos a comparar (D69)
  /**
   * Quais caminhos entram na comparação (mínimo dois). Ausente ou `null` = os quatro de antes da locação
   * (à vista, financiar, consórcio e sem o bem), exatamente o comportamento anterior à D69.
   */
  caminhos?: ChaveCarro[] | null
}

/** Valores de partida que dependem de o carro ser 0 km ou seminovo. São nossos e editáveis; a tabela FIPE é a fonte para o seu modelo. */
export const PRESET_TIPO: Record<TipoCarro, Pick<InputsCarro, 'deprecAno1Pct' | 'deprecDemaisPct' | 'manutencaoAA' | 'envelhecimentoManutencaoAA'>> = {
  zeroKm: { deprecAno1Pct: 14, deprecDemaisPct: 9, manutencaoAA: 1, envelhecimentoManutencaoAA: 10 },
  seminovo: { deprecAno1Pct: 9, deprecDemaisPct: 7, manutencaoAA: 2.5, envelhecimentoManutencaoAA: 8 },
}

export const NOMES_TIPO: Record<TipoCarro, string> = { zeroKm: '0 km', seminovo: 'Seminovo' }

export interface PontoMensalCarro {
  mes: number
  avista: number
  financiamento: number
  consorcio: number
  semCarro: number
  locacao: number
}

export interface CustosDono {
  ipva: number
  seguro: number
  manutencao: number
  uso: number
  total: number
}

export interface DetalheCenarioCarro {
  /** Patrimônio líquido final, em R$ do ano final (nominal). */
  patrimonioFinal: number
  /** O mesmo valor, em R$ de hoje. */
  patrimonioFinalHoje: number
  /** Valor de mercado do carro no fim (0 se a pessoa não tem carro). */
  carro: number
  saldoDevedor: number
  fundoLiquido: number
  totalPagoDeBolso: number
  /** Juros, taxas, custos de dono e aluguel/mobilidade: o que sai e não vira patrimônio (sem a perda de valor do carro). */
  custoTotal: number
  custoDescricao: string
  /** Perda de valor do carro no período (positivo = perdeu). */
  depreciacao: number
  /** Custo de mobilidade que sai do bolso e não volta: custos + depreciação + deságio da revenda (se ligado). Antes do rendimento. */
  custoBruto: number
  custoBrutoMensal: number
  /** Dinheiro colocado − patrimônio: o custo já descontado o que o dinheiro rendeu (e o IR). Mesma ordem do patrimônio, invertida. */
  custoLiquido: number
  custoLiquidoMensal: number
}

export interface DetalheInvestimentosCarro {
  aportado: number
  capitalInicial: number
  aportesMensais: number
  gastoPrimeiroMes: number
  primeiroAporte: number
  retirado: number
  rendimentoBruto: number
  irPago: number
  saldoLiquido: number
}

export interface ContabilidadeCarro {
  totalColocado: number
  custos: number
  /** Variação do valor do carro desde a compra. NEGATIVA quando o carro perde valor. */
  valorizacaoCarro: number
  rendimentoBruto: number
  irSobreRendimento: number
  custosDeVenda: number
  patrimonioFinal: number
  /** Deve ser 0 (centavos de arredondamento). */
  diferenca: number
}

export interface DetalheFinanciamentoCarro {
  entrada: number
  emplacamento: number
  iof: number
  gravame: number
  parcelasPagas: number
  amortizacaoPaga: number
  jurosPagos: number
  custosDono: CustosDono
  saldoDevedor: number
}

export interface DetalheAvistaCarro {
  valorPago: number
  emplacamento: number
  custosDono: CustosDono
}

export interface DetalheSemCarro {
  mobilidadeInicial: number
  mobilidadeFinal: number
  mobilidadePaga: number
}

export interface DetalheLocacao {
  mensalidadeInicial: number
  mensalidadeFinal: number
  mensalidadesPagas: number
  kmExcedentePago: number
  /** Uso por conta da pessoa (combustível, estacionamento, pedágio): a locação não o inclui. */
  usoPago: number
  taxaEntrada: number
  /** Caução paga no início e devolvida no fim (não é custo). */
  caucao: number
  compra: { feita: boolean; valorCompra: number; transferencia: number; valorDeMercado: number }
}

export interface DetalheConsorcioCarro {
  parcelaInicial: number
  parcelaFinal: number
  parcelasPagas: number
  taxaAdministracao: number
  fundoReserva: number
  mobilidadeAteContemplacao: number
  emplacamento: number
  complementoCarta: number
  lance: number
  custosDono: CustosDono
  reajusteDasParcelas: number
  saldoDevedor: number
}

export interface PontoDeViradaCarro {
  /** Gasto mensal sem carro (R$ de hoje) a partir do qual a rota empata com "sem carro"; null = não muda no intervalo, ou à vista indisponível. */
  avista: number | null
  financiamento: number | null
  consorcio: number | null
  /**
   * Mensalidade da locação (R$ de hoje) a partir da qual cada rota de ter o carro empata com alugar. Só existe com a locação na
   * comparação; null em cada rota = a ordem não muda no intervalo.
   */
  contraLocacao?: { avista: number | null; financiamento: number | null; consorcio: number | null }
  /** Intervalo testado, em R$ por mês. */
  intervalo: [number, number]
}

export interface ResultadoCarro {
  rotas: ChaveCarro[]
  /** Caminhos que a pessoa pediu para comparar (antes de tirar `avista` se o dinheiro não cobre). */
  caminhosEscolhidos: ChaveCarro[]
  avista: { disponivel: boolean; necessario: number; falta: number }
  /** Menor custo líquido = maior patrimônio. */
  vencedor: ChaveCarro
  nomeVencedor: string
  /** Quanto o vencedor termina à frente do segundo (R$, nominal). */
  vantagemSobreSegundo: number
  ranking: ChaveCarro[]
  cenarios: Record<ChaveCarro, DetalheCenarioCarro>
  patrimonioSemCustosVenda: Record<ChaveCarro, number>
  patrimonioComCustosVenda: Record<ChaveCarro, number>
  serieMensal: PontoMensalCarro[]
  financiamento: { financiado: number; primeiraParcela: number; ultimaParcela: number; cetAA: number; jurosPagos: number }
  consorcio: { cartaNaContemplacao: number; precoCarroNaContemplacao: number; complementoPago: number; parcelaInicial: number }
  capitalInicial: number
  detalhe: {
    financiamento: DetalheFinanciamentoCarro
    avista: DetalheAvistaCarro
    semCarro: DetalheSemCarro
    locacao: DetalheLocacao
    consorcio: DetalheConsorcioCarro
    investimentos: Record<ChaveCarro, DetalheInvestimentosCarro>
    contabilidade: Record<ChaveCarro, ContabilidadeCarro>
    orcamentoInicial: { valor: number; definidoPor: ChaveCarro }
  }
  orcamentoReferencia: number[]
  avisos: string[]
  pontoDeVirada?: PontoDeViradaCarro
  sensibilidadeContemplacao?: { mes: number; patrimonio: number; vencedor: ChaveCarro }[]
}

// ───────────────────────────── utilidades ─────────────────────────────

const mensal = (aa: number) => Math.pow(1 + aa / 100, 1 / 12) - 1
const arred = (n: number) => Math.round(n * 100) / 100

export function inputsCarroPadrao(parcial: Partial<InputsCarro> = {}): InputsCarro {
  const tipo = parcial.tipo ?? 'zeroKm'
  return {
    bem: 'carro',
    tipo,
    valorCarro: 100_000,
    horizonteAnos: 5,
    rendimentoAA: 10,
    aplicarIR: true,
    inflacaoAA: 4.5,
    ...PRESET_TIPO[tipo],
    ipvaPct: 3,
    seguroPct: 4,
    usoMensal: 800,
    emplacamentoPct: 1.5,
    descontarCustosVenda: false,
    descontoRevendaPct: 5,
    entrada: 30_000,
    jurosMensalPct: 1.9,
    prazoFinanciamentoMeses: 48,
    iofPct: 3,
    gravame: 400,
    taxaAdmTotalPct: 15,
    fundoReservaPct: 2,
    prazoConsorcioMeses: 72,
    reajusteConsorcioAA: 4.5,
    lance: 0,
    regraLance: 'prazo',
    mesContemplacao: 18,
    mobilidadeMensal: 1_800,
    locacaoMensal: 3_000,
    locacaoReajusteAA: 4.5,
    locacaoCaucao: 3_000,
    locacaoTaxaEntrada: 0,
    locacaoKmIncluido: 2_000,
    locacaoKmRodado: 1_000,
    locacaoKmExcedente: 0.8,
    locacaoComprarNoFim: false,
    locacaoValorCompra: 50_000,
    dinheiroDisponivel: null,
    caminhos: null,
    ...parcial,
  }
}

/** Troca 0 km por seminovo (ou o contrário) e recarrega só os valores de partida que dependem do tipo. */
export function aplicarTipoCarro(i: InputsCarro, tipo: TipoCarro): InputsCarro {
  return { ...i, tipo, ...PRESET_TIPO[tipo] }
}

/** Custos de aquisição que o financiamento paga na compra (e que, sem dinheiro informado, definem o capital inicial). */
export function custosAquisicaoFinanciamento(i: InputsCarro) {
  const emplacamento = (i.valorCarro * i.emplacamentoPct) / 100
  const financiado = Math.max(0, i.valorCarro - i.entrada)
  const iof = (financiado * i.iofPct) / 100
  const gravame = financiado > 0 ? i.gravame : 0
  return { emplacamento, iof, gravame, total: emplacamento + iof + gravame }
}

/** Mensagens em português para entradas impossíveis; vazio = pode simular. */
export function validarInputsCarro(i: InputsCarro): string[] {
  const erros: string[] = []
  const V = VOCAB[i.bem ?? 'carro']
  const numeros = Object.entries(i).filter(([, v]) => typeof v === 'number') as [string, number][]
  if (numeros.some(([, v]) => !Number.isFinite(v))) erros.push('Há um campo com valor inválido.')
  if (i.valorCarro <= 0) erros.push(`Informe o valor ${V.do}.`)
  if (i.horizonteAnos < 1 || i.horizonteAnos > 10) erros.push('O horizonte deve ficar entre 1 e 10 anos.')
  if (i.entrada < 0 || i.entrada > i.valorCarro) erros.push(`A entrada não pode ser negativa nem maior que o valor ${V.do}.`)
  if (i.prazoFinanciamentoMeses < 6 || i.prazoFinanciamentoMeses > 96) erros.push('O prazo do financiamento deve ficar entre 6 e 96 meses.')
  if (i.mobilidadeMensal < 0) erros.push(`O gasto mensal sem ${V.n} não pode ser negativo.`)
  if (i.usoMensal < 0) erros.push('O gasto mensal de uso não pode ser negativo.')
  if (i.deprecAno1Pct < 0 || i.deprecAno1Pct > 60 || i.deprecDemaisPct < 0 || i.deprecDemaisPct > 60) erros.push('A depreciação deve ficar entre 0% e 60% ao ano.')
  if (i.prazoConsorcioMeses < 12 || i.prazoConsorcioMeses > 120) erros.push('O prazo do consórcio deve ficar entre 12 e 120 meses.')
  const horizonteMeses = Math.round(i.horizonteAnos * 12)
  if (i.mesContemplacao < 1 || i.mesContemplacao > Math.min(i.prazoConsorcioMeses, horizonteMeses)) {
    erros.push('A contemplação deve ocorrer entre o mês 1 e o fim do prazo do consórcio ou do horizonte, o que vier primeiro.')
  }
  if (i.lance < 0 || i.lance > i.valorCarro) erros.push(`O lance não pode ser negativo nem maior que o valor ${V.do}.`)
  if (i.jurosMensalPct < 0 || i.rendimentoAA < -50) erros.push('Confira as taxas informadas.')
  if (i.dinheiroDisponivel !== null) {
    const minimo = i.entrada + custosAquisicaoFinanciamento(i).total
    if (!Number.isFinite(i.dinheiroDisponivel) || i.dinheiroDisponivel < 0) erros.push('O dinheiro disponível não pode ser negativo.')
    else if (i.dinheiroDisponivel < minimo - 0.005) {
      erros.push(`O dinheiro disponível precisa cobrir ao menos a entrada mais o emplacamento, o IOF e o gravame (${minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`)
    }
  }
  if (i.locacaoMensal < 0 || i.locacaoCaucao < 0 || i.locacaoTaxaEntrada < 0 || i.locacaoKmExcedente < 0 || i.locacaoKmIncluido < 0 || i.locacaoKmRodado < 0) {
    erros.push('Na locação, os valores não podem ser negativos.')
  }
  if (i.locacaoComprarNoFim && i.locacaoValorCompra <= 0) erros.push('Informe o valor da compra no fim da locação.')
  if (i.caminhos != null) {
    const validos = i.caminhos.every((c) => TODOS_CAMINHOS_CARRO.includes(c)) && new Set(i.caminhos).size === i.caminhos.length
    if (!validos) erros.push('Há um caminho inválido na comparação.')
    else if (i.caminhos.length < 2) erros.push('Escolha pelo menos dois caminhos para comparar.')
    else if (i.valorCarro > 0 && i.caminhos.length === 2 && i.caminhos.includes('avista')) {
      // À vista mais um só: se o dinheiro não cobre o veículo e o emplacamento, sobra um caminho único e não há o que comparar.
      const necessario = i.valorCarro + (i.valorCarro * i.emplacamentoPct) / 100
      const dinheiro = i.dinheiroDisponivel ?? i.entrada + custosAquisicaoFinanciamento(i).total
      if (dinheiro < necessario - 0.005) erros.push(`Com o dinheiro informado não dá para comprar à vista: informe mais dinheiro disponível ou escolha outros caminhos.`)
    }
  }
  return erros
}

// ───────────────────────── fundo de investimento ─────────────────────────

/** Fundo com custo de aquisição, para o IR incidir só sobre o ganho (mesma regra do imóvel). */
class Fundo {
  saldo = 0
  custo = 0
  aportado = 0
  retirado = 0
  constructor(inicial = 0) {
    this.saldo = inicial
    this.custo = inicial
    this.aportado = inicial
  }
  render(taxaMensal: number) {
    this.saldo *= 1 + taxaMensal
  }
  aportar(v: number) {
    this.saldo += v
    this.custo += v
    this.aportado += v
  }
  retirar(v: number) {
    if (this.saldo > 0) {
      const fracao = Math.min(1, v / this.saldo)
      this.custo -= this.custo * fracao
    }
    this.saldo -= v
    this.retirado += v
  }
  rendimentoBruto() {
    return this.saldo + this.retirado - this.aportado
  }
  liquido(aliquotaPct: number) {
    const ganho = Math.max(0, this.saldo - this.custo)
    return this.saldo - (ganho * aliquotaPct) / 100
  }
}

function degrau(taxaAA: number, mes: number) {
  return Math.pow(1 + taxaAA / 100, Math.floor((mes - 1) / 12))
}

/** Valor de mercado de um carro comprado por `p0`, `meses` meses depois da compra. Dois trechos: 1º ano e demais. */
export function valorDeMercado(p0: number, meses: number, deprecAno1Pct: number, deprecDemaisPct: number): number {
  const m = Math.max(0, meses)
  const d1 = 1 - deprecAno1Pct / 100
  const d2 = 1 - deprecDemaisPct / 100
  if (m <= 12) return p0 * Math.pow(d1, m / 12)
  return p0 * d1 * Math.pow(d2, (m - 12) / 12)
}

// ───────────────────────── simulação mês a mês ─────────────────────────

function simularNucleo(i: InputsCarro, leve = false): ResultadoCarro {
  const n = Math.round(i.horizonteAnos * 12)
  const rm = mensal(i.rendimentoAA)
  const aliqIr = i.aplicarIR ? (n * 30 > 720 ? 15 : aliquotaIr(n * 30)) : 0
  const avisos: string[] = []
  const T = VOCAB[i.bem ?? 'carro']
  const nomes = nomesRotas(i.bem ?? 'carro')

  const V = i.valorCarro
  const valorEm = (p0: number, meses: number) => valorDeMercado(p0, meses, i.deprecAno1Pct, i.deprecDemaisPct)
  const emplac = (p: number) => (p * i.emplacamentoPct) / 100
  const aquis = custosAquisicaoFinanciamento(i)
  const K0 = i.entrada + aquis.total
  const C = i.dinheiroDisponivel ?? K0
  const emplacV = emplac(V)
  const necessarioAvista = V + emplacV
  const avistaOk = C >= necessarioAvista - 0.005

  // Caminhos da comparação (D69). Sem escolha, valem os quatro de antes da locação; à vista só concorre se o dinheiro cobre o
  // veículo e o emplacamento, sem inventar dinheiro. A ordem é fixa, para o desempate do ranking não mudar.
  const ordemMotor: ChaveCarro[] = ['financiamento', 'semCarro', 'consorcio', 'avista', 'locacao']
  const escolhidosBrutos = i.caminhos == null ? CAMINHOS_ANTES_DA_LOCACAO : i.caminhos
  const caminhosEscolhidos = ordemMotor.filter((c) => escolhidosBrutos.includes(c))
  const rotas: ChaveCarro[] = caminhosEscolhidos.filter((c) => c !== 'avista' || avistaOk)

  // Custos de dono do mês `t` (calendário) para um carro comprado por `p0` no mês `m0`.
  const custosDonoMes = (p0: number, m0: number, t: number): CustosDono => {
    const idade = t - m0
    const anoPosse = Math.floor((idade - 1) / 12)
    const valorInicioAno = valorEm(p0, anoPosse * 12)
    const ipva = (valorInicioAno * i.ipvaPct) / 100 / 12
    const seguro = (valorInicioAno * i.seguroPct) / 100 / 12
    const manutencao = ((p0 * i.manutencaoAA) / 100 / 12) * Math.pow((1 + i.inflacaoAA / 100) * (1 + i.envelhecimentoManutencaoAA / 100), anoPosse)
    const uso = i.usoMensal * degrau(i.inflacaoAA, t)
    return { ipva, seguro, manutencao, uso, total: ipva + seguro + manutencao + uso }
  }
  const zeroDono = (): CustosDono => ({ ipva: 0, seguro: 0, manutencao: 0, uso: 0, total: 0 })
  const somar = (a: CustosDono, b: CustosDono): CustosDono => ({
    ipva: a.ipva + b.ipva,
    seguro: a.seguro + b.seguro,
    manutencao: a.manutencao + b.manutencao,
    uso: a.uso + b.uso,
    total: a.total + b.total,
  })
  const arredDono = (d: CustosDono): CustosDono => ({ ipva: arred(d.ipva), seguro: arred(d.seguro), manutencao: arred(d.manutencao), uso: arred(d.uso), total: arred(d.total) })

  // Financiamento (Price)
  const financiado = Math.max(0, V - i.entrada)
  const prazoFin = Math.round(i.prazoFinanciamentoMeses)
  const tabela = tabelaFinanciamento(financiado, i.jurosMensalPct * 12, prazoFin, 'PRICE')
  const fluxoCet = leve ? [] : tabela.map((l) => l.parcela)

  // Consórcio
  const fracAdm = (i.taxaAdmTotalPct + i.fundoReservaPct) / 100
  const parcelaBase = (V * (1 + fracAdm)) / i.prazoConsorcioMeses
  const fracTaxaNaParcela = fracAdm / (1 + fracAdm)
  const M = i.mesContemplacao
  // O carro equivalente acompanha a inflação até a contemplação; depois dela, cai pela curva de depreciação.
  const precoEquivalente = (mes: number) => V * Math.pow(1 + i.inflacaoAA / 100, mes / 12)
  const PM = precoEquivalente(M)

  // Estado
  const fFin = new Fundo(C - K0)
  const fSem = new Fundo(C)
  const fCon = new Fundo(C)
  const fAv = new Fundo(C - necessarioAvista)
  // Locação: a caução e a taxa de entrada saem do dinheiro no mês 0; a caução volta no fim (fora do fundo, sem rendimento).
  const caucao = i.locacaoCaucao
  const taxaEntradaLoc = i.locacaoTaxaEntrada
  const fLoc = new Fundo(C - caucao - taxaEntradaLoc)
  const compraLoc = i.locacaoComprarNoFim
  let saldoFin = financiado
  let juros = 0
  let amortPaga = 0
  let parcelasPagasFin = 0
  let somaOrcamento = 0
  let orc1 = { valor: 0, definidoPor: 'financiamento' as ChaveCarro }
  let gasto1: Record<ChaveCarro, number> = { financiamento: 0, semCarro: 0, consorcio: 0, avista: 0, locacao: 0 }
  let pagoLoc = 0
  let mensalidadesLoc = 0
  let excedenteLoc = 0
  let usoLoc = 0
  let mensalidadeFinalLoc = i.locacaoMensal
  let emplacLocFim = 0
  let mobilidadeFinal = i.mobilidadeMensal
  let parcelaFinalCon = 0
  let donoFin = zeroDono()
  let donoAv = zeroDono()
  let donoCon = zeroDono()
  let pagoFin = K0
  let pagoAv = necessarioAvista
  let pagoSem = 0
  let pagoCon = 0
  let mobilidadePagaCon = 0
  let parcelasPagasCon = 0
  let restanteCon = i.prazoConsorcioMeses
  let multLance = 1
  let ultimaParcelaFin = 0
  let primeiraParcelaFin = 0
  let complemento = 0
  let cartaNaContemplacao = 0
  let emplacCon = 0
  let lancePago = 0
  let capitalInsuficiente = false
  const serie: PontoMensalCarro[] = []
  const orcamentoRef: number[] = []
  let saldoCon = 0

  const carroFinEm = (mes: number) => valorEm(V, mes)
  const carroConEm = (mes: number) => (mes >= M ? valorEm(PM, mes - M) : 0)

  const patrimonios = (mes: number) => {
    const fin = carroFinEm(mes) - saldoFin + fFin.liquido(aliqIr)
    const sem = fSem.liquido(aliqIr)
    // Antes da contemplação não há carro nem dívida na série: as parcelas pagas são custo.
    const con = mes >= M ? carroConEm(mes) - saldoCon + fCon.liquido(aliqIr) : fCon.liquido(aliqIr)
    const av = carroFinEm(mes) + fAv.liquido(aliqIr)
    // Locação: o fundo, a caução (um ativo que volta) e, depois da compra no fim, o veículo a preço de mercado.
    const loc = fLoc.liquido(aliqIr) + caucao + (compraLoc && mes >= n ? carroFinEm(mes) : 0)
    return { fin, sem, con, av, loc }
  }

  if (!leve) {
    const p0 = patrimonios(0)
    serie.push({ mes: 0, financiamento: arred(p0.fin), semCarro: arred(p0.sem), consorcio: arred(p0.con), avista: arred(p0.av), locacao: arred(p0.loc) })
  }

  for (let t = 1; t <= n; t++) {
    const mobilidade = i.mobilidadeMensal * degrau(i.inflacaoAA, t)

    // — Financiamento: parcela (se ainda há) + custos de dono desde o mês 1 —
    const donoF = custosDonoMes(V, 0, t)
    let outFin = donoF.total
    const linha = tabela[t - 1]
    if (linha) {
      outFin += linha.parcela
      juros += linha.juros
      amortPaga += linha.amortizacao
      parcelasPagasFin += linha.parcela
      saldoFin = linha.saldoDevedor
      if (t === 1) primeiraParcelaFin = linha.parcela
      ultimaParcelaFin = linha.parcela
    }
    donoFin = somar(donoFin, donoF)

    // — Consórcio: parcela + mobilidade sem carro até a contemplação; depois, parcela + custos de dono —
    const fatorCon = degrau(i.reajusteConsorcioAA, t)
    const parcelaCon = restanteCon > 0 ? parcelaBase * fatorCon * multLance * Math.min(1, restanteCon) : 0
    restanteCon = Math.max(0, restanteCon - 1)
    parcelasPagasCon += parcelaCon
    if (parcelaCon > 0) parcelaFinalCon = parcelaCon
    mobilidadeFinal = mobilidade
    let outCon = parcelaCon
    if (t <= M) {
      outCon += mobilidade
      mobilidadePagaCon += mobilidade
    } else {
      const d = custosDonoMes(PM, M, t)
      outCon += d.total
      donoCon = somar(donoCon, d)
    }

    // — À vista: só custos de dono —
    const donoA = custosDonoMes(V, 0, t)
    const outAv = donoA.total
    donoAv = somar(donoAv, donoA)

    // — Sem carro: a mobilidade informada —
    const outSem = mobilidade

    // — Locação: mensalidade (com IPVA, seguro e manutenção), quilômetro excedente e o uso, que é por conta de quem aluga —
    const fatorLoc = degrau(i.locacaoReajusteAA, t)
    const mensalidade = i.locacaoMensal * fatorLoc
    const excedente = Math.max(0, i.locacaoKmRodado - i.locacaoKmIncluido) * i.locacaoKmExcedente * fatorLoc
    const usoMes = i.usoMensal * degrau(i.inflacaoAA, t)
    const outLoc = mensalidade + excedente + usoMes
    mensalidadesLoc += mensalidade
    excedenteLoc += excedente
    usoLoc += usoMes
    mensalidadeFinalLoc = mensalidade

    // — Orçamento de referência: o maior desembolso entre os caminhos que estão sendo comparados —
    const saida: Record<ChaveCarro, number> = { financiamento: outFin, semCarro: outSem, consorcio: outCon, avista: outAv, locacao: outLoc }
    const ref = Math.max(...rotas.map((c) => saida[c]))
    somaOrcamento += ref
    if (t === 1) {
      gasto1 = { ...saida }
      const quem = (['financiamento', 'consorcio', 'avista', 'locacao', 'semCarro'] as ChaveCarro[]).find((c) => rotas.includes(c) && saida[c] === ref)
      orc1 = { valor: ref, definidoPor: quem ?? 'semCarro' }
    }
    if ((t - 1) % 12 === 0) orcamentoRef.push(arred(ref))

    pagoFin += outFin
    pagoSem += outSem
    pagoCon += outCon
    pagoAv += outAv
    pagoLoc += outLoc

    fFin.render(rm)
    fSem.render(rm)
    fCon.render(rm)
    fAv.render(rm)
    fLoc.render(rm)
    fFin.aportar(ref - outFin)
    fSem.aportar(ref - outSem)
    fCon.aportar(ref - outCon)
    fAv.aportar(ref - outAv)
    fLoc.aportar(ref - outLoc)

    // — Locação, compra no fim: no último mês paga o valor do contrato e a transferência —
    if (compraLoc && t === n) {
      emplacLocFim = emplac(carroFinEm(n))
      fLoc.retirar(i.locacaoValorCompra + emplacLocFim)
    }

    // — Contemplação (fim do mês M) —
    if (t === M) {
      cartaNaContemplacao = V * fatorCon
      emplacCon = emplac(PM)
      complemento = PM - cartaNaContemplacao
      const lanceM = i.lance * fatorCon
      lancePago = lanceM
      const dividaAntes = parcelaBase * fatorCon * multLance * restanteCon
      if (lanceM > 0 && dividaAntes > 0) {
        const abate = Math.min(lanceM, dividaAntes)
        if (i.regraLance === 'prazo') restanteCon = Math.max(0, restanteCon - abate / (parcelaBase * fatorCon * multLance))
        else multLance *= (dividaAntes - abate) / dividaAntes
      }
      fCon.retirar(lanceM + emplacCon + complemento)
      pagoCon += lanceM + emplacCon + Math.max(0, complemento)
      if (fCon.saldo < 0) capitalInsuficiente = true
    }

    saldoCon = parcelaBase * fatorCon * multLance * restanteCon

    if (!leve) {
      const p = patrimonios(t)
      serie.push({ mes: t, financiamento: arred(p.fin), semCarro: arred(p.sem), consorcio: arred(p.con), avista: arred(p.av), locacao: arred(p.loc) })
    }
  }

  if (capitalInsuficiente) {
    avisos.push(`No consórcio, o capital inicial não cobriu o lance, o emplacamento e a diferença entre a carta e o preço ${T.do} na contemplação. O resultado trata esse buraco como dinheiro tomado ao mesmo custo do rendimento: na prática, seria preciso mais capital.`)
  }
  if (fFin.saldo < 0 || fSem.saldo < 0) avisos.push('O capital inicial e os aportes não bastaram em algum cenário; confira os valores informados.')
  if (rotas.includes('locacao') && fLoc.saldo < 0) {
    avisos.push(`Na locação, o dinheiro aplicado não cobriu a caução, a taxa de entrada${compraLoc ? ' e a compra no fim' : ''}: o resultado trata esse buraco como dinheiro tomado ao mesmo custo do rendimento. Na prática, seria preciso mais capital.`)
  }
  if (n > prazoFin) avisos.push('O horizonte é maior que o prazo do financiamento: depois de quitado, a pessoa deixa de pagar parcela e passa a investir essa folga.')
  if (n > 8) avisos.push(`Em horizontes longos ${T.ficaVelho}: a curva de depreciação, a manutenção e a necessidade de ${T.trocar} pesam mais, e esta conta não troca ${T.n === 'carro' ? 'o carro' : 'a moto'} no meio do caminho.`)

  const carroFim = carroFinEm(n)
  const carroConFim = M <= n ? carroConEm(n) : 0
  const deflator = Math.pow(1 + i.inflacaoAA / 100, n / 12)

  const desagio = (valor: number) => (valor * i.descontoRevendaPct) / 100
  const finSem = carroFim - saldoFin + fFin.liquido(aliqIr)
  const semSem = fSem.liquido(aliqIr)
  const conSem = carroConFim - saldoCon + fCon.liquido(aliqIr)
  const avSem = carroFim + fAv.liquido(aliqIr)
  const finCom = finSem - desagio(carroFim)
  const avCom = avSem - desagio(carroFim)
  const conCom = conSem - (carroConFim > 0 ? desagio(carroConFim) : 0)
  const semCom = semSem
  const locSem = fLoc.liquido(aliqIr) + caucao + (compraLoc ? carroFim : 0)
  const locCom = locSem - (compraLoc ? desagio(carroFim) : 0)
  const base: Record<ChaveCarro, number> = i.descontarCustosVenda
    ? { financiamento: finCom, semCarro: semCom, consorcio: conCom, avista: avCom, locacao: locCom }
    : { financiamento: finSem, semCarro: semSem, consorcio: conSem, avista: avSem, locacao: locSem }

  const ranking = [...rotas].sort((a, b) => base[b] - base[a])
  const [primeiro, segundo] = ranking

  const totalContratadoCon = parcelasPagasCon + lancePago + saldoCon
  const taxasConsorcio = totalContratadoCon * fracTaxaNaParcela
  const reajusteParcelas = totalContratadoCon - taxasConsorcio - cartaNaContemplacao

  const totalColocado = C + somaOrcamento
  const vendaDe = (sem: number, com: number) => (i.descontarCustosVenda ? sem - com : 0)

  // Custos "que não voltam" (sem a perda de valor do carro, que entra à parte como depreciação)
  const custoFin = juros + aquis.iof + aquis.gravame + emplacV + donoFin.total
  const custoAv = emplacV + donoAv.total
  const custoSem = pagoSem
  const custoCon = taxasConsorcio + mobilidadePagaCon + (M <= n ? emplacCon : 0) + donoCon.total + reajusteParcelas
  const custoLoc = taxaEntradaLoc + pagoLoc + emplacLocFim

  const deprecFin = V - carroFim
  const deprecCon = carroConFim > 0 ? PM - carroConFim : 0
  const custosVenda: Record<ChaveCarro, number> = {
    financiamento: vendaDe(finSem, finCom),
    avista: vendaDe(avSem, avCom),
    consorcio: vendaDe(conSem, conCom),
    semCarro: 0,
    locacao: compraLoc ? vendaDe(locSem, locCom) : 0,
  }

  const montarCenario = (chave: ChaveCarro, dados: Omit<DetalheCenarioCarro, 'custoBruto' | 'custoBrutoMensal' | 'custoLiquido' | 'custoLiquidoMensal' | 'patrimonioFinal' | 'patrimonioFinalHoje'>): DetalheCenarioCarro => {
    const bruto = dados.custoTotal + dados.depreciacao + custosVenda[chave]
    const liquido = totalColocado - base[chave]
    return {
      ...dados,
      patrimonioFinal: arred(base[chave]),
      patrimonioFinalHoje: arred(base[chave] / deflator),
      custoBruto: arred(bruto),
      custoBrutoMensal: arred(bruto / n),
      custoLiquido: arred(liquido),
      custoLiquidoMensal: arred(liquido / n),
    }
  }

  const cenarios: Record<ChaveCarro, DetalheCenarioCarro> = {
    financiamento: montarCenario('financiamento', {
      carro: arred(carroFim),
      saldoDevedor: arred(saldoFin),
      fundoLiquido: arred(fFin.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoFin),
      custoTotal: arred(custoFin),
      custoDescricao: 'juros, IOF, gravame, emplacamento, IPVA, seguro, manutenção e uso',
      depreciacao: arred(deprecFin),
    }),
    avista: montarCenario('avista', {
      carro: arred(carroFim),
      saldoDevedor: 0,
      fundoLiquido: arred(fAv.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoAv),
      custoTotal: arred(custoAv),
      custoDescricao: 'emplacamento, IPVA, seguro, manutenção e uso (não há juros nem parcelas)',
      depreciacao: arred(deprecFin),
    }),
    semCarro: montarCenario('semCarro', {
      carro: 0,
      saldoDevedor: 0,
      fundoLiquido: arred(fSem.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoSem),
      custoTotal: arred(custoSem),
      custoDescricao: `todo o gasto mensal de mobilidade sem ${T.n} (assinatura, locação ou aplicativo)`,
      depreciacao: 0,
    }),
    locacao: montarCenario('locacao', {
      carro: compraLoc ? arred(carroFim) : 0,
      saldoDevedor: 0,
      fundoLiquido: arred(fLoc.liquido(aliqIr)),
      totalPagoDeBolso: arred(taxaEntradaLoc + pagoLoc + (compraLoc ? i.locacaoValorCompra + emplacLocFim : 0)),
      custoTotal: arred(custoLoc),
      custoDescricao: `mensalidades (que já incluem IPVA, seguro e manutenção), quilômetro excedente, ${T.n === 'carro' ? 'combustível e demais gastos de uso' : 'combustível e demais gastos de uso'}, taxa de entrada${compraLoc ? ' e transferência na compra' : ''}`,
      depreciacao: compraLoc ? arred(i.locacaoValorCompra - carroFim) : 0,
    }),
    consorcio: montarCenario('consorcio', {
      carro: arred(carroConFim),
      saldoDevedor: arred(saldoCon),
      fundoLiquido: arred(fCon.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoCon),
      custoTotal: arred(custoCon),
      custoDescricao: `taxa de administração e fundo de reserva (pagos e embutidos na dívida restante), mobilidade sem ${T.n} até a contemplação, emplacamento, custos de dono e reajuste das parcelas`,
      depreciacao: arred(deprecCon),
    }),
  }

  const resumoFundo = (f: Fundo, capitalInicial: number, chave: ChaveCarro): DetalheInvestimentosCarro => ({
    aportado: arred(f.aportado),
    capitalInicial: arred(capitalInicial),
    aportesMensais: arred(f.aportado - capitalInicial),
    gastoPrimeiroMes: arred(gasto1[chave]),
    primeiroAporte: arred(orc1.valor - gasto1[chave]),
    retirado: arred(f.retirado),
    rendimentoBruto: arred(f.rendimentoBruto()),
    irPago: arred(f.saldo - f.liquido(aliqIr)),
    saldoLiquido: arred(f.liquido(aliqIr)),
  })
  const investimentos: Record<ChaveCarro, DetalheInvestimentosCarro> = {
    financiamento: resumoFundo(fFin, C - K0, 'financiamento'),
    semCarro: resumoFundo(fSem, C, 'semCarro'),
    consorcio: resumoFundo(fCon, C, 'consorcio'),
    avista: resumoFundo(fAv, C - necessarioAvista, 'avista'),
    locacao: resumoFundo(fLoc, C - caucao - taxaEntradaLoc, 'locacao'),
  }
  const montarConta = (chave: ChaveCarro, valorizacao: number): ContabilidadeCarro => {
    const inv = investimentos[chave]
    const custos = cenarios[chave].custoTotal
    const venda = custosVenda[chave]
    const soma = totalColocado - custos + valorizacao + inv.rendimentoBruto - inv.irPago - venda
    return {
      totalColocado: arred(totalColocado),
      custos,
      valorizacaoCarro: arred(valorizacao),
      rendimentoBruto: inv.rendimentoBruto,
      irSobreRendimento: inv.irPago,
      custosDeVenda: arred(venda),
      patrimonioFinal: cenarios[chave].patrimonioFinal,
      diferenca: arred(base[chave] - soma),
    }
  }
  const contabilidade: Record<ChaveCarro, ContabilidadeCarro> = {
    financiamento: montarConta('financiamento', carroFim - V),
    semCarro: montarConta('semCarro', 0),
    consorcio: montarConta('consorcio', carroConFim > 0 ? carroConFim - PM : 0),
    avista: montarConta('avista', carroFim - V),
    locacao: montarConta('locacao', compraLoc ? carroFim - i.locacaoValorCompra : 0),
  }
  const emplacConPago = M <= n ? emplacCon : 0
  const adm = fracAdm > 0 ? i.taxaAdmTotalPct / (i.taxaAdmTotalPct + i.fundoReservaPct) : 0

  return {
    rotas,
    caminhosEscolhidos,
    avista: { disponivel: avistaOk, necessario: arred(necessarioAvista), falta: arred(Math.max(0, necessarioAvista - C)) },
    vencedor: primeiro,
    nomeVencedor: nomes[primeiro],
    vantagemSobreSegundo: arred(base[primeiro] - base[segundo]),
    ranking,
    cenarios,
    patrimonioSemCustosVenda: { financiamento: arred(finSem), semCarro: arred(semSem), consorcio: arred(conSem), avista: arred(avSem), locacao: arred(locSem) },
    patrimonioComCustosVenda: { financiamento: arred(finCom), semCarro: arred(semCom), consorcio: arred(conCom), avista: arred(avCom), locacao: arred(locCom) },
    serieMensal: serie,
    financiamento: {
      financiado: arred(financiado),
      primeiraParcela: arred(primeiraParcelaFin),
      ultimaParcela: arred(ultimaParcelaFin),
      // O banco entrega o financiado e o cliente paga IOF e gravame de seu bolso: o CET parte do líquido recebido.
      cetAA: leve ? 0 : Math.round(calcularCet(financiado - aquis.iof - aquis.gravame, fluxoCet) * 100) / 100,
      jurosPagos: arred(juros),
    },
    consorcio: { cartaNaContemplacao: arred(cartaNaContemplacao), precoCarroNaContemplacao: arred(PM), complementoPago: arred(complemento), parcelaInicial: arred(parcelaBase) },
    capitalInicial: arred(C),
    detalhe: {
      financiamento: {
        entrada: arred(i.entrada),
        emplacamento: arred(emplacV),
        iof: arred(aquis.iof),
        gravame: arred(aquis.gravame),
        parcelasPagas: arred(parcelasPagasFin),
        amortizacaoPaga: arred(amortPaga),
        jurosPagos: arred(juros),
        custosDono: arredDono(donoFin),
        saldoDevedor: arred(saldoFin),
      },
      avista: { valorPago: arred(V), emplacamento: arred(emplacV), custosDono: arredDono(donoAv) },
      semCarro: { mobilidadeInicial: arred(i.mobilidadeMensal), mobilidadeFinal: arred(mobilidadeFinal), mobilidadePaga: arred(pagoSem) },
      locacao: {
        mensalidadeInicial: arred(i.locacaoMensal),
        mensalidadeFinal: arred(mensalidadeFinalLoc),
        mensalidadesPagas: arred(mensalidadesLoc),
        kmExcedentePago: arred(excedenteLoc),
        usoPago: arred(usoLoc),
        taxaEntrada: arred(taxaEntradaLoc),
        caucao: arred(caucao),
        compra: { feita: compraLoc, valorCompra: compraLoc ? arred(i.locacaoValorCompra) : 0, transferencia: arred(emplacLocFim), valorDeMercado: compraLoc ? arred(carroFim) : 0 },
      },
      consorcio: {
        parcelaInicial: arred(parcelaBase),
        parcelaFinal: arred(parcelaFinalCon),
        parcelasPagas: arred(parcelasPagasCon),
        taxaAdministracao: arred(taxasConsorcio * adm),
        fundoReserva: arred(taxasConsorcio * (1 - adm)),
        mobilidadeAteContemplacao: arred(mobilidadePagaCon),
        emplacamento: arred(emplacConPago),
        complementoCarta: arred(complemento),
        lance: arred(lancePago),
        custosDono: arredDono(donoCon),
        reajusteDasParcelas: arred(reajusteParcelas),
        saldoDevedor: arred(saldoCon),
      },
      investimentos,
      contabilidade,
      orcamentoInicial: { valor: arred(orc1.valor), definidoPor: orc1.definidoPor },
    },
    orcamentoReferencia: orcamentoRef,
    avisos,
  }
}

// ───────────────────────── análises extras ─────────────────────────

function raiz(f: (x: number) => number, a: number, b: number): number | null {
  let fa = f(a)
  const fb = f(b)
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return null
  let lo = a
  let hi = b
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (fa * fm <= 0) hi = mid
    else {
      lo = mid
      fa = fm
    }
  }
  return Math.round((lo + hi) / 2)
}

/**
 * Gasto mensal sem carro (R$ de hoje) em que cada rota de TER o carro empata com ficar sem ele. É a premissa que
 * mais pesa e a que a pessoa melhor conhece: abaixo dele, ficar sem carro termina na frente; acima, ter o carro.
 * Sempre sobre o patrimônio de mercado (sem deságio de revenda), para a conta ficar comparável.
 */
export function pontoDeViradaCarro(i: InputsCarro): PontoDeViradaCarro {
  const intervalo: [number, number] = [0, 15_000]
  const rotas = simularNucleo(i, true).rotas
  const temSem = rotas.includes('semCarro')
  const temLoc = rotas.includes('locacao')
  type Dono = 'financiamento' | 'consorcio' | 'avista'
  // Contra "sem o bem" a variável é o gasto mensal sem ele; contra a locação, a mensalidade da locação.
  const dif = (qual: Dono, contra: 'semCarro' | 'locacao') => (valor: number) => {
    const campo = contra === 'semCarro' ? { mobilidadeMensal: valor } : { locacaoMensal: valor }
    const r = simularNucleo({ ...i, ...campo, descontarCustosVenda: false }, true)
    return r.patrimonioSemCustosVenda[qual] - r.patrimonioSemCustosVenda[contra]
  }
  const ponto = (qual: Dono, contra: 'semCarro' | 'locacao'): number | null => {
    if (!rotas.includes(qual)) return null
    return raiz(dif(qual, contra), intervalo[0], intervalo[1])
  }
  return {
    avista: temSem ? ponto('avista', 'semCarro') : null,
    financiamento: temSem ? ponto('financiamento', 'semCarro') : null,
    consorcio: temSem ? ponto('consorcio', 'semCarro') : null,
    ...(temLoc ? { contraLocacao: { avista: ponto('avista', 'locacao'), financiamento: ponto('financiamento', 'locacao'), consorcio: ponto('consorcio', 'locacao') } } : {}),
    intervalo,
  }
}

/** A data da contemplação é a maior incerteza do consórcio: mostra o resultado em meses típicos. */
export function sensibilidadeContemplacaoCarro(i: InputsCarro) {
  if (!simularNucleo(i, true).rotas.includes('consorcio')) return []
  const limite = Math.min(i.prazoConsorcioMeses, Math.round(i.horizonteAnos * 12))
  const meses = [6, 12, 24, 36, 48, 60].filter((m) => m <= limite)
  return meses.map((mes) => {
    const r = simularNucleo({ ...i, mesContemplacao: mes }, true)
    const base = i.descontarCustosVenda ? r.patrimonioComCustosVenda : r.patrimonioSemCustosVenda
    return { mes, patrimonio: base.consorcio, vencedor: r.vencedor }
  })
}

/**
 * Função pública: recebe as entradas (JSON) e devolve o vencedor, o custo e o patrimônio de cada caminho, a evolução
 * mês a mês para o gráfico, o ponto de virada e a sensibilidade à contemplação. Lança Error com as mensagens de
 * `validarInputsCarro` se houver entrada impossível.
 */
export function simularComparativoCarro(entrada: Partial<InputsCarro>): ResultadoCarro {
  const i = inputsCarroPadrao(entrada)
  const erros = validarInputsCarro(i)
  if (erros.length) throw new Error(erros.join(' '))
  const r = simularNucleo(i)
  r.pontoDeVirada = pontoDeViradaCarro(i)
  r.sensibilidadeContemplacao = sensibilidadeContemplacaoCarro(i)
  return r
}

/**
 * Ponto de partida das premissas de mercado, vindo do snapshot oficial (projeção de longo prazo do Boletim Focus):
 * a Selic projetada vira rendimento bruto e o IPCA projetado vira inflação e reajuste do consórcio. Tudo editável.
 * Os juros do financiamento NÃO vêm do snapshot: ficam como valor nosso até a série SGS 25471 do Banco Central ser incluída.
 */
export function inputsCarroDoSnapshot(snapshot: SnapshotMercado): Partial<InputsCarro> {
  const focus = snapshot.focus
  if (!focus) return {}
  const ultimo = (porAno: Record<string, number>) => {
    const anos = Object.keys(porAno).map(Number).sort((a, b) => a - b)
    return anos.length ? porAno[String(anos.at(-1))] : null
  }
  const selic = ultimo(focus.selic)
  const ipca = ultimo(focus.ipca)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const saida: Partial<InputsCarro> = {}
  if (selic != null) saida.rendimentoAA = r2(selic)
  if (ipca != null) {
    saida.inflacaoAA = r2(ipca)
    saida.reajusteConsorcioAA = r2(ipca)
    saida.locacaoReajusteAA = r2(ipca)
  }
  return saida
}
