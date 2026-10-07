// Comparativo "Financiamento × Aluguel × Consórcio" (D44).
//
// Diz qual das três rotas termina com o MAIOR PATRIMÔNIO LÍQUIDO depois de N anos. É conta
// matemática sobre premissas de taxa informadas pela pessoa: não indica banco, consórcio nem
// produto, e não é recomendação de investimento. Como em simulaTesouro.ts e rendaFii.ts, é
// aritmética sem metodologia proprietária, por isso roda no navegador.
//
// ── Regra que torna a comparação justa ("apples to apples") ──────────────────────────────
// 1. Capital inicial comum (C): o dinheiro que a pessoa tem hoje. Se ela não informar, C = entrada +
//    ITBI/cartório do financiamento (K0). Cada caminho gasta o que precisa na compra e mantém o resto
//    aplicado desde o mês 0: quem aluga e o consórcio aplicam C inteiro; quem financia aplica C − K0;
//    quem compra à vista (D46) paga o imóvel e o ITBI e aplica C − V − ITBI. Sem dinheiro para pagar o
//    imóvel à vista, essa rota fica de fora do ranking (nunca se inventa dinheiro).
// 2. Orçamento mensal comum: em cada mês, o orçamento de referência é o MAIOR desembolso entre
//    cenários (à vista nunca define: só paga custos de dono). Quem desembolsa menos investe a
//    diferença. Assim todos "gastam" o mesmo dinheiro de bolso e só muda para onde ele vai
//    (imóvel, aluguel, juros, taxas).
// 3. Patrimônio líquido final = imóvel (a preço de mercado) − dívida + fundo de investimento
//    (líquido de IR). Opcionalmente, ainda desconta os custos de venda do imóvel.
//
// ── Convenções ───────────────────────────────────────────────────────────────────────────
// - Rendimento: taxa efetiva anual convertida em mensal por (1+r)^(1/12) − 1. O aporte do mês
//   entra no fim do mês, depois do rendimento.
// - Financiamento: a taxa informada é NOMINAL ao ano e a mensal é taxa/12 (como os bancos
//   cotam). TR considerada zero. Seguros: MIP sobre o saldo devedor e DFI sobre o valor do
//   imóvel. O CET é RESULTADO (TIR do fluxo do banco), nunca entrada: assim os custos não
//   são contados duas vezes.
// - Aluguel e custos de propriedade (IPTU, condomínio, manutenção) reajustados 1 vez por ano.
// - Consórcio: carta = valor do imóvel; parcela = carta × (1 + adm + fundo de reserva) / prazo;
//   parcela e carta corrigidas 1 vez por ano. Até o mês M a pessoa paga parcela E aluguel. No
//   fim do mês M é contemplada, compra o imóvel pelo preço de mercado daquele mês (a diferença
//   para a carta corrigida sai do fundo, ou sobra para ele) e paga ITBI/cartório. A partir
//   do mês M+1 mora no imóvel e deixa de pagar aluguel.
// - IR do rendimento: tabela regressiva aplicada ao ganho do fundo na data final, pela duração
//   do horizonte (simplificação: todos os aportes são tratados com a idade do horizonte).
//
// Simplificações NÃO modeladas (ditas na tela): imposto de ganho de capital com isenção,
// seguro do consórcio, taxa de transferência, vacância, reformas, FGTS, queda do preço do
// imóvel por região, mudança de taxa do financiamento (TR) e antecipação de parcelas.

import { aliquotaIr } from './simulaTesouro'
import type { SnapshotMercado } from './mercadoOficial'

export type SistemaAmortizacao = 'SAC' | 'PRICE'
export type RegraLance = 'prazo' | 'parcela'

export interface InputsComparativo {
  // Imóvel e horizonte
  valorImovel: number
  horizonteAnos: number
  // Mercado (% ao ano)
  rendimentoAA: number
  /** true = a taxa de rendimento é bruta e o IR regressivo incide no resgate. */
  aplicarIR: boolean
  inflacaoAA: number
  valorizacaoImovelAA: number
  /** IPTU + condomínio + manutenção de quem é dono, em % do valor do imóvel ao ano. */
  custosPropriedadeAA: number
  /** true = o patrimônio final desconta corretagem e IR sobre ganho de capital da venda. */
  descontarCustosVenda: boolean
  /** Corretagem na venda, em % do valor do imóvel (usada só se descontarCustosVenda). */
  corretagemVendaPct: number

  // Financiamento
  entrada: number
  jurosNominalAA: number
  prazoFinanciamentoAnos: number
  sistema: SistemaAmortizacao
  /** MIP (morte e invalidez), % ao mês sobre o saldo devedor. */
  mipMensalPct: number
  /** DFI (danos físicos), % ao mês sobre o valor do imóvel. */
  dfiMensalPct: number
  /** Tarifa de administração do banco, R$ ao mês. */
  tarifaMensal: number
  /** ITBI, escritura e registro, % sobre o valor do imóvel. */
  custosIniciaisPct: number

  // Aluguel
  aluguelMensal: number
  reajusteAluguelAA: number

  // Consórcio
  taxaAdmTotalPct: number
  fundoReservaPct: number
  prazoConsorcioMeses: number
  reajusteConsorcioAA: number
  /** Lance com recursos próprios, em R$ de hoje (0 = sem lance). */
  lance: number
  regraLance: RegraLance
  /** Mês da contemplação (1 a prazo do consórcio e ao horizonte). */
  mesContemplacao: number

  // Dinheiro disponível (D46)
  /**
   * Quanto a pessoa tem hoje, em R$. `null` = só o necessário para a entrada e o ITBI do financiamento (comportamento
   * anterior à D46). Se for maior, a sobra fica aplicada em todos os caminhos; se cobrir o imóvel inteiro mais o ITBI,
   * a rota "comprar à vista" entra na comparação.
   */
  dinheiroDisponivel: number | null

  // Caminhos a comparar (D67)
  /**
   * Quais caminhos entram na comparação (mínimo dois). Ausente ou `null` = todos os que o dinheiro permite, exatamente o
   * comportamento anterior à D67. O orçamento de referência (o maior desembolso mensal) considera só os caminhos escolhidos.
   */
  caminhos?: ChaveCenario[] | null
}

export type ChaveCenario = 'financiamento' | 'aluguel' | 'consorcio' | 'avista'

export const NOMES_CENARIOS: Record<ChaveCenario, string> = {
  financiamento: 'Financiar',
  aluguel: 'Alugar e investir',
  consorcio: 'Consórcio',
  avista: 'Comprar à vista',
}

/** Ordem fixa dos caminhos, a mesma em todo o motor e na tela. */
export const TODOS_CAMINHOS: ChaveCenario[] = ['avista', 'financiamento', 'consorcio', 'aluguel']

export interface PontoMensal {
  mes: number
  avista: number
  financiamento: number
  aluguel: number
  consorcio: number
}

export interface DetalheCenario {
  /** Patrimônio líquido final, em R$ do ano final (nominal). */
  patrimonioFinal: number
  /** O mesmo valor, em R$ de hoje (deflacionado pela inflação). */
  patrimonioFinalHoje: number
  /** Valor do imóvel no fim (0 se a pessoa não tem imóvel). */
  imovel: number
  /** Dívida que sobra no fim (financiamento ou consórcio). */
  saldoDevedor: number
  /** Fundo de investimento no fim, já líquido de IR. */
  fundoLiquido: number
  /** Quanto saiu do bolso para terceiros (entrada, parcelas, aluguel, seguros, custos, lance). Não conta o que foi investido. */
  totalPagoDeBolso: number
  /** Juros, taxas e custos que não viram patrimônio (no aluguel, o próprio aluguel pago). */
  custoTotal: number
  /** Texto curto do que compõe o custo total. */
  custoDescricao: string
}

/** O que aconteceu com os investimentos de um cenário (a folga do orçamento mensal e o capital inicial). */
export interface DetalheInvestimentos {
  /** Capital inicial + aportes mensais colocados no fundo. */
  aportado: number
  /** Parte do aportado que já estava no fundo no mês 0 (entrada + ITBI/cartório, para quem não compra na hora). */
  capitalInicial: number
  /** Soma dos aportes mensais (a sobra do orçamento de referência) ao longo de todo o horizonte. */
  aportesMensais: number
  /** Quanto este caminho gasta no mês 1 e, por consequência, quanto aporta nesse mês. */
  gastoPrimeiroMes: number
  primeiroAporte: number
  /** Retiradas do fundo (no consórcio: lance, ITBI e diferença da carta na contemplação). */
  retirado: number
  /** Rendimento bruto acumulado, antes do IR. */
  rendimentoBruto: number
  /** Imposto de Renda descontado do ganho na data final. */
  irPago: number
  /** Saldo final, já líquido de IR. */
  saldoLiquido: number
}

/** "Para onde foi cada real": a conta que fecha o patrimônio final de um cenário. */
export interface ContabilidadeCenario {
  /** Capital inicial + orçamento mensal de todos os meses. É IGUAL nos três cenários. */
  totalColocado: number
  /** Tudo o que não vira patrimônio (juros, taxas, aluguel, impostos...). */
  custos: number
  /** Quanto o imóvel valorizou desde a compra (0 em quem não compra). */
  valorizacaoImovel: number
  rendimentoBruto: number
  irSobreRendimento: number
  /** Corretagem e IR do ganho de capital, só se a opção "descontar custos de venda" estiver ligada. */
  custosDeVenda: number
  patrimonioFinal: number
  /** Diferença entre o patrimônio calculado e a soma acima. Deve ser 0 (centavos de arredondamento). */
  diferenca: number
}

export interface DetalheFinanciamento {
  entrada: number
  itbiCartorio: number
  /** Soma de todas as parcelas de amortização + juros pagas até o horizonte (sem seguros e tarifa). */
  parcelasPagas: number
  /** Parte das parcelas que reduziu a dívida (vira patrimônio). */
  amortizacaoPaga: number
  jurosPagos: number
  seguroMip: number
  seguroDfi: number
  tarifas: number
  custosPropriedade: number
  saldoDevedor: number
}

export interface DetalheAluguel {
  aluguelInicial: number
  aluguelFinal: number
  aluguelPago: number
}

export interface DetalheConsorcio {
  parcelaInicial: number
  parcelaFinal: number
  /** Soma das parcelas pagas até o horizonte. */
  parcelasPagas: number
  /** Taxa de administração: paga + a que ainda está embutida na dívida restante. */
  taxaAdministracao: number
  /** Fundo de reserva: pago + o que ainda está embutido na dívida restante. */
  fundoReserva: number
  aluguelAteContemplacao: number
  itbiCartorio: number
  /** Preço do imóvel menos a carta corrigida (positivo = a pessoa completa; negativo = sobra). */
  complementoCarta: number
  lance: number
  custosPropriedade: number
  /** Quanto as parcelas pagas depois da contemplação já subiram além da carta usada. */
  reajusteDasParcelas: number
  saldoDevedor: number
}

export interface DetalheAvista {
  /** Preço do imóvel pago de uma vez no mês 0. */
  valorPago: number
  itbiCartorio: number
  custosPropriedade: number
}

export interface ResultadoComparativo {
  /** Rotas que entraram na comparação: as 3 de sempre, mais `avista` quando o dinheiro disponível cobre o imóvel e o ITBI. */
  rotas: ChaveCenario[]
  /** Caminhos que a pessoa pediu para comparar (antes de tirar `avista` se o dinheiro não cobre). */
  caminhosEscolhidos: ChaveCenario[]
  /** Se dá para comprar à vista com o dinheiro informado, quanto seria preciso e quanto falta. */
  avista: { disponivel: boolean; necessario: number; falta: number }
  vencedor: ChaveCenario
  nomeVencedor: string
  /** Quanto o vencedor termina à frente do segundo colocado (R$, nominal). */
  vantagemSobreSegundo: number
  ranking: ChaveCenario[]
  cenarios: Record<ChaveCenario, DetalheCenario>
  /** Mesmo cálculo com e sem custos de venda, para mostrar os dois números. */
  patrimonioSemCustosVenda: Record<ChaveCenario, number>
  patrimonioComCustosVenda: Record<ChaveCenario, number>
  serieMensal: PontoMensal[]
  financiamento: {
    financiado: number
    primeiraParcela: number
    ultimaParcela: number
    /** CET anual, resultado (TIR do fluxo do banco), em %. */
    cetAA: number
    jurosPagos: number
  }
  consorcio: {
    cartaNaContemplacao: number
    precoImovelNaContemplacao: number
    complementoPago: number
    parcelaInicial: number
  }
  capitalInicial: number
  /** Detalhe item a item de cada cenário, para explicar ao cliente de onde vem cada custo. */
  detalhe: {
    financiamento: DetalheFinanciamento
    avista: DetalheAvista
    aluguel: DetalheAluguel
    consorcio: DetalheConsorcio
    investimentos: Record<ChaveCenario, DetalheInvestimentos>
    contabilidade: Record<ChaveCenario, ContabilidadeCenario>
    /** Orçamento de referência do mês 1 e qual caminho o define (o que mais desembolsa naquele mês). */
    orcamentoInicial: { valor: number; definidoPor: ChaveCenario }
  }
  /** Orçamento mensal de referência nos meses 1, 13, 25... (primeiro mês de cada ano). */
  orcamentoReferencia: number[]
  avisos: string[]
  /** Preenchidos por analisarComparativo. */
  pontoDeVirada?: PontoDeVirada
  sensibilidadeContemplacao?: { mes: number; patrimonio: number; vencedor: ChaveCenario }[]
}

/** Um par de caminhos e a valorização do imóvel em que eles empatam. */
export interface ParVirada {
  a: ChaveCenario
  b: ChaveCenario
  /** Valorização anual (%) do empate; null = a ordem não muda no intervalo testado. */
  ponto: number | null
  /** Quem fica na frente quando o imóvel valoriza mais que o ponto (ou em todo o intervalo, se não há ponto). */
  acima: ChaveCenario
}

export interface PontoDeVirada {
  /** Pares comparados: cada caminho contra o aluguel, se o aluguel está na comparação; senão, todos os pares entre os escolhidos. */
  pares: ParVirada[]
  /** Valorização em que comprar à vista e alugar empatam; null = não muda no intervalo, ou à vista indisponível. */
  avistaVsAluguel: number | null
  /** Valorização anual do imóvel (%) em que financiar e alugar empatam; null = não muda no intervalo testado. */
  financiamentoVsAluguel: number | null
  consorcioVsAluguel: number | null
  /** Intervalo testado, em % ao ano. */
  intervalo: [number, number]
}

// ───────────────────────────── utilidades ─────────────────────────────

const mensal = (aa: number) => Math.pow(1 + aa / 100, 1 / 12) - 1
const arred = (n: number) => Math.round(n * 100) / 100

export function inputsPadrao(parcial: Partial<InputsComparativo> = {}): InputsComparativo {
  return {
    valorImovel: 500_000,
    horizonteAnos: 20,
    rendimentoAA: 10,
    aplicarIR: true,
    inflacaoAA: 4.5,
    valorizacaoImovelAA: 4.5,
    custosPropriedadeAA: 1,
    descontarCustosVenda: false,
    corretagemVendaPct: 6,
    entrada: 100_000,
    jurosNominalAA: 10.5,
    prazoFinanciamentoAnos: 30,
    sistema: 'SAC',
    mipMensalPct: 0.03,
    dfiMensalPct: 0.012,
    tarifaMensal: 25,
    custosIniciaisPct: 4,
    aluguelMensal: 2_500,
    reajusteAluguelAA: 4.5,
    taxaAdmTotalPct: 15,
    fundoReservaPct: 1,
    prazoConsorcioMeses: 200,
    reajusteConsorcioAA: 4.5,
    lance: 0,
    regraLance: 'prazo',
    mesContemplacao: 36,
    dinheiroDisponivel: null,
    caminhos: null,
    ...parcial,
  }
}

/** Mensagens em português para entradas impossíveis; vazio = pode simular. */
export function validarInputs(i: InputsComparativo): string[] {
  const erros: string[] = []
  const numeros = Object.entries(i).filter(([, v]) => typeof v === 'number') as [string, number][]
  if (numeros.some(([, v]) => !Number.isFinite(v))) erros.push('Há um campo com valor inválido.')
  if (i.valorImovel <= 0) erros.push('Informe o valor do imóvel.')
  if (i.horizonteAnos < 1 || i.horizonteAnos > 40) erros.push('O horizonte deve ficar entre 1 e 40 anos.')
  if (i.entrada < 0 || i.entrada > i.valorImovel) erros.push('A entrada não pode ser negativa nem maior que o valor do imóvel.')
  if (i.prazoFinanciamentoAnos < 1 || i.prazoFinanciamentoAnos > 35) erros.push('O prazo do financiamento deve ficar entre 1 e 35 anos.')
  if (i.aluguelMensal < 0) erros.push('O aluguel não pode ser negativo.')
  if (i.prazoConsorcioMeses < 12 || i.prazoConsorcioMeses > 300) erros.push('O prazo do consórcio deve ficar entre 12 e 300 meses.')
  const horizonteMeses = Math.round(i.horizonteAnos * 12)
  if (i.mesContemplacao < 1 || i.mesContemplacao > Math.min(i.prazoConsorcioMeses, horizonteMeses)) {
    erros.push('A contemplação deve ocorrer entre o mês 1 e o fim do prazo do consórcio ou do horizonte, o que vier primeiro.')
  }
  if (i.lance < 0 || i.lance > i.valorImovel) erros.push('O lance não pode ser negativo nem maior que o valor do imóvel.')
  if (i.jurosNominalAA < 0 || i.rendimentoAA < -50) erros.push('Confira as taxas informadas.')
  if (i.dinheiroDisponivel !== null) {
    const minimo = i.entrada + (i.valorImovel * i.custosIniciaisPct) / 100
    if (!Number.isFinite(i.dinheiroDisponivel) || i.dinheiroDisponivel < 0) erros.push('O dinheiro disponível não pode ser negativo.')
    else if (i.dinheiroDisponivel < minimo - 0.005) erros.push(`O dinheiro disponível precisa cobrir ao menos a entrada mais o ITBI e o cartório (${minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`)
  }
  if (i.caminhos != null) {
    const validos = i.caminhos.every((c) => TODOS_CAMINHOS.includes(c)) && new Set(i.caminhos).size === i.caminhos.length
    if (!validos) erros.push('Há um caminho inválido na comparação.')
    else if (i.caminhos.length < 2) erros.push('Escolha pelo menos dois caminhos para comparar.')
    else if (i.valorImovel > 0 && i.caminhos.length === 2 && i.caminhos.includes('avista')) {
      // À vista mais um só: se o dinheiro não cobre o imóvel e o ITBI, sobra um caminho único e não há o que comparar.
      const custos = (i.valorImovel * i.custosIniciaisPct) / 100
      const dinheiro = i.dinheiroDisponivel ?? i.entrada + custos
      if (dinheiro < i.valorImovel + custos - 0.005) erros.push('Com o dinheiro informado não dá para comprar à vista: informe mais dinheiro disponível ou escolha outros caminhos.')
    }
  }
  return erros
}

// ───────────────────────── financiamento ─────────────────────────

export interface LinhaFinanciamento {
  mes: number
  juros: number
  amortizacao: number
  parcela: number
  saldoDevedor: number
}

/** Tabela de amortização (SAC ou Price) pela taxa nominal anual / 12. Sem seguros nem tarifa. */
export function tabelaFinanciamento(financiado: number, jurosNominalAA: number, prazoMeses: number, sistema: SistemaAmortizacao): LinhaFinanciamento[] {
  if (financiado <= 0 || prazoMeses <= 0) return []
  const im = jurosNominalAA / 100 / 12
  const linhas: LinhaFinanciamento[] = []
  let saldo = financiado
  const pmt = im === 0 ? financiado / prazoMeses : (financiado * im) / (1 - Math.pow(1 + im, -prazoMeses))
  for (let mes = 1; mes <= prazoMeses; mes++) {
    const juros = saldo * im
    const amortizacao = sistema === 'SAC' ? financiado / prazoMeses : pmt - juros
    const parcela = juros + amortizacao
    saldo = mes === prazoMeses ? 0 : Math.max(0, saldo - amortizacao)
    linhas.push({ mes, juros, amortizacao, parcela, saldoDevedor: saldo })
  }
  return linhas
}

/** CET anual (%) = TIR do fluxo do banco: recebe o financiado e paga parcela + seguros + tarifa. */
export function calcularCet(financiado: number, fluxoMensal: number[]): number {
  if (financiado <= 0 || fluxoMensal.length === 0) return 0
  const vp = (taxa: number) => fluxoMensal.reduce((s, p, k) => s + p / Math.pow(1 + taxa, k + 1), 0) - financiado
  let baixo = 0
  let alto = 0.1
  while (vp(alto) > 0 && alto < 10) alto *= 2
  for (let n = 0; n < 80; n++) {
    const meio = (baixo + alto) / 2
    if (vp(meio) > 0) baixo = meio
    else alto = meio
  }
  return (Math.pow(1 + (baixo + alto) / 2, 12) - 1) * 100
}

// ───────────────────────── fundo de investimento ─────────────────────────

/** Fundo com custo de aquisição, para o IR incidir só sobre o ganho. Saldo negativo = faltou capital. */
class Fundo {
  saldo = 0
  custo = 0
  /** Tudo o que entrou (capital inicial + aportes) e tudo o que saiu: para separar rendimento de principal. */
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
  /** Rendimento bruto acumulado (o que o saldo cresceu além do que entrou). */
  rendimentoBruto() {
    return this.saldo + this.retirado - this.aportado
  }
  liquido(aliquotaPct: number) {
    const ganho = Math.max(0, this.saldo - this.custo)
    return this.saldo - (ganho * aliquotaPct) / 100
  }
}

// ───────────────────────── simulação mês a mês ─────────────────────────

function degrau(taxaAA: number, mes: number) {
  return Math.pow(1 + taxaAA / 100, Math.floor((mes - 1) / 12))
}

/** `leve`: usado nas simulações auxiliares (ponto de virada, sensibilidade); pula a série mensal e o CET. */
function simularNucleo(i: InputsComparativo, leve = false): ResultadoComparativo {
  const n = Math.round(i.horizonteAnos * 12)
  const rm = mensal(i.rendimentoAA)
  const aliqIr = i.aplicarIR ? (n * 30 > 720 ? 15 : aliquotaIr(n * 30)) : 0
  const avisos: string[] = []

  const V = i.valorImovel
  const preco = (mes: number) => V * Math.pow(1 + i.valorizacaoImovelAA / 100, mes / 12)
  const custosIniciais = (V * i.custosIniciaisPct) / 100
  const K0 = i.entrada + custosIniciais
  // Dinheiro que a pessoa tem hoje (D46). Sem informar, é só o que a entrada e o ITBI do financiamento exigem.
  const C = i.dinheiroDisponivel ?? K0
  const necessarioAvista = V + custosIniciais
  const avistaOk = C >= necessarioAvista - 0.005

  // Caminhos da comparação (D67). Sem escolha, valem todos; à vista só concorre se o dinheiro cobre o imóvel e o ITBI,
  // sem inventar dinheiro. A ordem é a de sempre, para o desempate do ranking não mudar.
  const ordemMotor: ChaveCenario[] = ['financiamento', 'aluguel', 'consorcio', 'avista']
  const caminhosEscolhidos = i.caminhos == null ? [...ordemMotor] : ordemMotor.filter((c) => i.caminhos!.includes(c))
  const rotas: ChaveCenario[] = caminhosEscolhidos.filter((c) => c !== 'avista' || avistaOk)

  // Financiamento
  const financiado = V - i.entrada
  const prazoFinMeses = Math.round(i.prazoFinanciamentoAnos * 12)
  const tabela = tabelaFinanciamento(financiado, i.jurosNominalAA, prazoFinMeses, i.sistema)
  const dfi = (V * i.dfiMensalPct) / 100
  const seguroMip = (saldoAnterior: number) => (saldoAnterior * i.mipMensalPct) / 100
  // Fluxo completo do banco (todo o prazo, não só o horizonte) para o CET
  let saldoAnt = financiado
  const fluxoCet = leve
    ? []
    : tabela.map((l) => {
        const f = l.parcela + seguroMip(saldoAnt) + dfi + i.tarifaMensal
        saldoAnt = l.saldoDevedor
        return f
      })

  // Consórcio
  const fracAdm = (i.taxaAdmTotalPct + i.fundoReservaPct) / 100
  const parcelaBase = (V * (1 + fracAdm)) / i.prazoConsorcioMeses
  const fracTaxaNaParcela = fracAdm / (1 + fracAdm)
  const M = i.mesContemplacao

  // Estado
  const fFin = new Fundo(C - K0) // sobra depois da entrada e do ITBI (zero se C = K0)
  const fAlu = new Fundo(C)
  const fCon = new Fundo(C)
  const fAv = new Fundo(C - necessarioAvista) // sobra depois de pagar o imóvel e o ITBI (negativa = não dá, rota fica de fora)
  let saldoFin = financiado
  let juros = 0
  let seguros = 0
  let segMip = 0
  let segDfi = 0
  let amortPaga = 0
  let parcelasPagasFin = 0
  let somaOrcamento = 0
  let orc1 = { valor: 0, definidoPor: 'financiamento' as ChaveCenario }
  let gasto1: Record<ChaveCenario, number> = { financiamento: 0, aluguel: 0, consorcio: 0, avista: 0 }
  let aluguelFinal = i.aluguelMensal
  let parcelaFinalCon = 0
  let tarifas = 0
  let custosPropFin = 0
  let pagoFin = K0 // entrada + ITBI/cartório
  let pagoAv = necessarioAvista // imóvel inteiro + ITBI/cartório
  let custosPropAv = 0
  let pagoAlu = 0
  let pagoCon = 0
  let aluguelPagoCon = 0
  let custosPropCon = 0
  let parcelasPagasCon = 0
  let restanteCon = i.prazoConsorcioMeses
  let multLance = 1
  let ultimaParcelaFin = 0
  let primeiraParcelaFin = 0
  let complemento = 0
  let cartaNaContemplacao = 0
  let precoNaContemplacao = 0
  let itbiCon = 0
  let lancePago = 0
  let capitalInsuficiente = false
  const serie: PontoMensal[] = []
  const orcamentoRef: number[] = []
  let saldoCon = 0

  const patrimonios = (mes: number): { fin: number; alu: number; con: number; av: number; imovelFin: number; imovelCon: number } => {
    const imv = preco(mes)
    const imovelFin = imv
    const imovelCon = mes >= M ? imv : 0
    const fin = imovelFin - saldoFin + fFin.liquido(aliqIr)
    const alu = fAlu.liquido(aliqIr)
    // Antes da contemplação não há imóvel nem dívida: as parcelas pagas são custo, e as futuras ainda não são obrigação de quem tem o bem.
    const con = mes >= M ? imovelCon - saldoCon + fCon.liquido(aliqIr) : fCon.liquido(aliqIr)
    const av = imv + fAv.liquido(aliqIr)
    return { fin, alu, con, av, imovelFin, imovelCon }
  }

  // Mês 0: financiamento paga entrada e custos; os outros dois mantêm K0 aplicado.
  if (!leve) {
    const p0 = patrimonios(0)
    serie.push({ mes: 0, financiamento: arred(p0.fin), aluguel: arred(p0.alu), consorcio: arred(p0.con), avista: arred(p0.av) })
  }

  for (let t = 1; t <= n; t++) {
    const fatorProp = degrau(i.inflacaoAA, t)
    const custosProp = ((V * i.custosPropriedadeAA) / 100 / 12) * fatorProp
    const aluguel = i.aluguelMensal * degrau(i.reajusteAluguelAA, t)

    // — Financiamento —
    let outFin = custosProp
    const linha = tabela[t - 1]
    if (linha) {
      const mip = seguroMip(saldoFin)
      const seg = mip + dfi
      outFin += linha.parcela + seg + i.tarifaMensal
      juros += linha.juros
      amortPaga += linha.amortizacao
      parcelasPagasFin += linha.parcela
      segMip += mip
      segDfi += dfi
      seguros += seg
      tarifas += i.tarifaMensal
      saldoFin = linha.saldoDevedor
      if (t === 1) primeiraParcelaFin = linha.parcela + seg + i.tarifaMensal
      ultimaParcelaFin = linha.parcela + seg + i.tarifaMensal
    }
    custosPropFin += custosProp

    // — Consórcio —
    const fatorCon = degrau(i.reajusteConsorcioAA, t)
    const parcelaCon = restanteCon > 0 ? parcelaBase * fatorCon * multLance * Math.min(1, restanteCon) : 0
    restanteCon = Math.max(0, restanteCon - 1)
    parcelasPagasCon += parcelaCon
    if (parcelaCon > 0) parcelaFinalCon = parcelaCon
    aluguelFinal = aluguel
    let outCon = parcelaCon
    if (t <= M) {
      outCon += aluguel
      aluguelPagoCon += aluguel
    } else {
      outCon += custosProp
      custosPropCon += custosProp
    }

    // — À vista: sem parcela nem aluguel, só os custos de quem é dono (por isso nunca define o orçamento) —
    const outAv = custosProp
    custosPropAv += custosProp

    // — Orçamento de referência: o maior desembolso entre os caminhos que estão sendo comparados —
    const saida: Record<ChaveCenario, number> = { financiamento: outFin, aluguel, consorcio: outCon, avista: outAv }
    const ref = Math.max(...rotas.map((c) => saida[c]))
    somaOrcamento += ref
    if (t === 1) {
      gasto1 = { ...saida }
      const quem = (['financiamento', 'consorcio', 'aluguel', 'avista'] as ChaveCenario[]).find((c) => rotas.includes(c) && saida[c] === ref)
      orc1 = { valor: ref, definidoPor: quem ?? 'aluguel' }
    }
    if ((t - 1) % 12 === 0) orcamentoRef.push(arred(ref))

    pagoFin += outFin
    pagoAlu += aluguel
    pagoCon += outCon
    pagoAv += outAv

    // rendimento do mês, depois aporte no fim do mês
    fFin.render(rm)
    fAlu.render(rm)
    fCon.render(rm)
    fAv.render(rm)
    fFin.aportar(ref - outFin)
    fAlu.aportar(ref - aluguel)
    fCon.aportar(ref - outCon)
    fAv.aportar(ref - outAv)

    // — Contemplação (fim do mês M) —
    if (t === M) {
      precoNaContemplacao = preco(M)
      cartaNaContemplacao = V * fatorCon
      itbiCon = (precoNaContemplacao * i.custosIniciaisPct) / 100
      complemento = precoNaContemplacao - cartaNaContemplacao
      // lance: R$ de hoje corrigido até o mês M pelo reajuste do consórcio
      const lanceM = i.lance * fatorCon
      lancePago = lanceM
      const dividaAntes = parcelaBase * fatorCon * multLance * restanteCon
      if (lanceM > 0 && dividaAntes > 0) {
        const abate = Math.min(lanceM, dividaAntes)
        if (i.regraLance === 'prazo') restanteCon = Math.max(0, restanteCon - abate / (parcelaBase * fatorCon * multLance))
        else multLance *= (dividaAntes - abate) / dividaAntes
      }
      // sai do fundo: lance, ITBI/cartório e (se positivo) o complemento acima da carta
      fCon.retirar(lanceM + itbiCon + complemento)
      pagoCon += lanceM + itbiCon + Math.max(0, complemento)
      if (fCon.saldo < 0) capitalInsuficiente = true
    }

    // dívida do consórcio em R$ do mês t: parcelas que faltam × parcela corrente
    saldoCon = parcelaBase * fatorCon * multLance * restanteCon

    if (!leve) {
      const p = patrimonios(t)
      serie.push({ mes: t, financiamento: arred(p.fin), aluguel: arred(p.alu), consorcio: arred(p.con), avista: arred(p.av) })
    }
  }

  if (capitalInsuficiente) {
    avisos.push('No consórcio, o capital inicial não cobriu o lance, o ITBI e a diferença entre a carta e o preço do imóvel na contemplação. O resultado trata esse buraco como dinheiro tomado ao mesmo custo do rendimento: na prática, seria preciso mais capital.')
  }
  if (fFin.saldo < 0 || fAlu.saldo < 0) avisos.push('O capital inicial e os aportes não bastaram em algum cenário; confira os valores informados.')
  if (n > prazoFinMeses) avisos.push('O horizonte é maior que o prazo do financiamento: depois de quitado, a pessoa deixa de pagar parcela e passa a investir essa folga.')

  const imovelFim = preco(n)
  const imovelConFim = M <= n ? imovelFim : 0
  const deflator = Math.pow(1 + i.inflacaoAA / 100, n / 12)

  // Patrimônio líquido do mercado (sem venda) e com custos de venda (corretagem + ganho de capital 15%)
  const custoVenda = (valorVenda: number, custoAquisicao: number) => {
    const corretagem = (valorVenda * i.corretagemVendaPct) / 100
    const ganho = Math.max(0, valorVenda - corretagem - custoAquisicao)
    return corretagem + ganho * 0.15
  }
  const finSem = imovelFim - saldoFin + fFin.liquido(aliqIr)
  const aluSem = fAlu.liquido(aliqIr)
  const conSem = imovelConFim - saldoCon + fCon.liquido(aliqIr)
  const avSem = imovelFim + fAv.liquido(aliqIr)
  const avCom = avSem - custoVenda(imovelFim, V + custosIniciais)
  const finCom = finSem - custoVenda(imovelFim, V + custosIniciais)
  const aluCom = aluSem
  const conCom = conSem - (imovelConFim > 0 ? custoVenda(imovelConFim, precoNaContemplacao + itbiCon) : 0)
  const base: Record<ChaveCenario, number> = i.descontarCustosVenda
    ? { financiamento: finCom, aluguel: aluCom, consorcio: conCom, avista: avCom }
    : { financiamento: finSem, aluguel: aluSem, consorcio: conSem, avista: avSem }

  const ranking = [...rotas].sort((a, b) => base[b] - base[a])
  const [primeiro, segundo] = ranking

  // taxas contratadas: as já pagas + as embutidas na dívida que ainda resta (o patrimônio desconta a dívida inteira)
  const totalContratadoCon = parcelasPagasCon + lancePago + saldoCon
  const taxasConsorcio = totalContratadoCon * fracTaxaNaParcela
  // O que as parcelas somam além da carta que foi usada na compra: o reajuste anual que continua incidindo depois da contemplação.
  const reajusteParcelas = totalContratadoCon - taxasConsorcio - cartaNaContemplacao
  const cenarios: Record<ChaveCenario, DetalheCenario> = {
    financiamento: {
      patrimonioFinal: arred(base.financiamento),
      patrimonioFinalHoje: arred(base.financiamento / deflator),
      imovel: arred(imovelFim),
      saldoDevedor: arred(saldoFin),
      fundoLiquido: arred(fFin.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoFin),
      custoTotal: arred(juros + seguros + tarifas + custosIniciais + custosPropFin),
      custoDescricao: 'juros, seguros, tarifa, ITBI/cartório e custos de propriedade',
    },
    avista: {
      patrimonioFinal: arred(base.avista),
      patrimonioFinalHoje: arred(base.avista / deflator),
      imovel: arred(imovelFim),
      saldoDevedor: 0,
      fundoLiquido: arred(fAv.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoAv),
      custoTotal: arred(custosIniciais + custosPropAv),
      custoDescricao: 'ITBI/cartório e custos de propriedade (não há juros, seguros nem parcelas)',
    },
    aluguel: {
      patrimonioFinal: arred(base.aluguel),
      patrimonioFinalHoje: arred(base.aluguel / deflator),
      imovel: 0,
      saldoDevedor: 0,
      fundoLiquido: arred(fAlu.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoAlu),
      custoTotal: arred(pagoAlu),
      custoDescricao: 'todo o aluguel pago no período',
    },
    consorcio: {
      patrimonioFinal: arred(base.consorcio),
      patrimonioFinalHoje: arred(base.consorcio / deflator),
      imovel: arred(imovelConFim),
      saldoDevedor: arred(saldoCon),
      fundoLiquido: arred(fCon.liquido(aliqIr)),
      totalPagoDeBolso: arred(pagoCon),
      custoTotal: arred(taxasConsorcio + aluguelPagoCon + (M <= n ? itbiCon : 0) + custosPropCon + reajusteParcelas),
      custoDescricao: 'taxa de administração e fundo de reserva (pagos e embutidos na dívida restante), aluguel até a contemplação, ITBI/cartório, custos de propriedade e reajuste das parcelas',
    },
  }

  const aliqEfetivaIr = (f: Fundo) => f.saldo - f.liquido(aliqIr)
  const resumoFundo = (f: Fundo, capitalInicial: number, chave: ChaveCenario): DetalheInvestimentos => ({
    aportado: arred(f.aportado),
    capitalInicial: arred(capitalInicial),
    aportesMensais: arred(f.aportado - capitalInicial),
    gastoPrimeiroMes: arred(gasto1[chave]),
    primeiroAporte: arred(orc1.valor - gasto1[chave]),
    retirado: arred(f.retirado),
    rendimentoBruto: arred(f.rendimentoBruto()),
    irPago: arred(aliqEfetivaIr(f)),
    saldoLiquido: arred(f.liquido(aliqIr)),
  })
  const investimentos: Record<ChaveCenario, DetalheInvestimentos> = {
    financiamento: resumoFundo(fFin, C - K0, 'financiamento'),
    aluguel: resumoFundo(fAlu, C, 'aluguel'),
    consorcio: resumoFundo(fCon, C, 'consorcio'),
    avista: resumoFundo(fAv, C - necessarioAvista, 'avista'),
  }
  const totalColocado = C + somaOrcamento
  const custosDeVendaDe = (sem: number, com: number) => (i.descontarCustosVenda ? sem - com : 0)
  const montarConta = (chave: ChaveCenario, valorizacao: number, sem: number, com: number): ContabilidadeCenario => {
    const inv = investimentos[chave]
    const custos = cenarios[chave].custoTotal
    const venda = custosDeVendaDe(sem, com)
    const soma = totalColocado - custos + valorizacao + inv.rendimentoBruto - inv.irPago - venda
    return {
      totalColocado: arred(totalColocado),
      custos,
      valorizacaoImovel: arred(valorizacao),
      rendimentoBruto: inv.rendimentoBruto,
      irSobreRendimento: inv.irPago,
      custosDeVenda: arred(venda),
      patrimonioFinal: cenarios[chave].patrimonioFinal,
      diferenca: arred(base[chave] - soma),
    }
  }
  const contabilidade: Record<ChaveCenario, ContabilidadeCenario> = {
    financiamento: montarConta('financiamento', imovelFim - V, finSem, finCom),
    aluguel: montarConta('aluguel', 0, aluSem, aluCom),
    consorcio: montarConta('consorcio', imovelConFim > 0 ? imovelConFim - precoNaContemplacao : 0, conSem, conCom),
    avista: montarConta('avista', imovelFim - V, avSem, avCom),
  }
  const itbiConsorcioPago = M <= n ? itbiCon : 0
  const adm = fracAdm > 0 ? i.taxaAdmTotalPct / (i.taxaAdmTotalPct + i.fundoReservaPct) : 0
  const detalhe: ResultadoComparativo['detalhe'] = {
    financiamento: {
      entrada: arred(i.entrada),
      itbiCartorio: arred(custosIniciais),
      parcelasPagas: arred(parcelasPagasFin),
      amortizacaoPaga: arred(amortPaga),
      jurosPagos: arred(juros),
      seguroMip: arred(segMip),
      seguroDfi: arred(segDfi),
      tarifas: arred(tarifas),
      custosPropriedade: arred(custosPropFin),
      saldoDevedor: arred(saldoFin),
    },
    avista: { valorPago: arred(V), itbiCartorio: arred(custosIniciais), custosPropriedade: arred(custosPropAv) },
    aluguel: { aluguelInicial: arred(i.aluguelMensal), aluguelFinal: arred(aluguelFinal), aluguelPago: arred(pagoAlu) },
    consorcio: {
      parcelaInicial: arred(parcelaBase),
      parcelaFinal: arred(parcelaFinalCon),
      parcelasPagas: arred(parcelasPagasCon),
      taxaAdministracao: arred(taxasConsorcio * adm),
      fundoReserva: arred(taxasConsorcio * (1 - adm)),
      aluguelAteContemplacao: arred(aluguelPagoCon),
      itbiCartorio: arred(itbiConsorcioPago),
      complementoCarta: arred(complemento),
      lance: arred(lancePago),
      custosPropriedade: arred(custosPropCon),
      reajusteDasParcelas: arred(reajusteParcelas),
      saldoDevedor: arred(saldoCon),
    },
    investimentos,
    contabilidade,
    orcamentoInicial: { valor: arred(orc1.valor), definidoPor: orc1.definidoPor },
  }

  return {
    rotas,
    caminhosEscolhidos,
    avista: { disponivel: avistaOk, necessario: arred(necessarioAvista), falta: arred(Math.max(0, necessarioAvista - C)) },
    vencedor: primeiro,
    nomeVencedor: NOMES_CENARIOS[primeiro],
    vantagemSobreSegundo: arred(base[primeiro] - base[segundo]),
    ranking,
    cenarios,
    patrimonioSemCustosVenda: { financiamento: arred(finSem), aluguel: arred(aluSem), consorcio: arred(conSem), avista: arred(avSem) },
    patrimonioComCustosVenda: { financiamento: arred(finCom), aluguel: arred(aluCom), consorcio: arred(conCom), avista: arred(avCom) },
    serieMensal: serie,
    financiamento: {
      financiado: arred(financiado),
      primeiraParcela: arred(primeiraParcelaFin),
      ultimaParcela: arred(ultimaParcelaFin),
      cetAA: leve ? 0 : Math.round(calcularCet(financiado, fluxoCet) * 100) / 100,
      jurosPagos: arred(juros),
    },
    consorcio: {
      cartaNaContemplacao: arred(cartaNaContemplacao),
      precoImovelNaContemplacao: arred(precoNaContemplacao),
      complementoPago: arred(complemento),
      parcelaInicial: arred(parcelaBase),
    },
    capitalInicial: arred(C),
    detalhe,
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
  for (let k = 0; k < 26; k++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (fa * fm <= 0) hi = mid
    else {
      lo = mid
      fa = fm
    }
  }
  return Math.round(((lo + hi) / 2) * 100) / 100
}

/**
 * Valorização anual do imóvel em que a ordem muda: é a variável que mais pesa e a mais incerta.
 * Sempre sobre o patrimônio de mercado (sem custos de venda), para a conta ficar comparável.
 */
export function pontoDeVirada(i: InputsComparativo): PontoDeVirada {
  const intervalo: [number, number] = [-2, 20]
  const rotas = simularNucleo(i, true).rotas
  // Com o aluguel na comparação, cada caminho é medido contra ele (como sempre foi). Sem aluguel, todos os pares entre os escolhidos.
  const pares: [ChaveCenario, ChaveCenario][] = []
  if (rotas.includes('aluguel')) {
    for (const c of ['avista', 'financiamento', 'consorcio'] as ChaveCenario[]) if (rotas.includes(c)) pares.push([c, 'aluguel'])
  } else {
    const ordem = TODOS_CAMINHOS.filter((c) => rotas.includes(c))
    for (let x = 0; x < ordem.length; x++) for (let y = x + 1; y < ordem.length; y++) pares.push([ordem[x], ordem[y]])
  }
  const lista: ParVirada[] = pares.map(([a, b]) => {
    const dif = (v: number) => {
      const r = simularNucleo({ ...i, valorizacaoImovelAA: v, descontarCustosVenda: false }, true)
      return r.patrimonioSemCustosVenda[a] - r.patrimonioSemCustosVenda[b]
    }
    const ponto = raiz(dif, intervalo[0], intervalo[1])
    return { a, b, ponto, acima: dif(intervalo[1]) >= 0 ? a : b }
  })
  const de = (c: ChaveCenario) => {
    const p = lista.find((l) => l.a === c && l.b === 'aluguel')
    return p ? p.ponto : null
  }
  return {
    pares: lista,
    avistaVsAluguel: de('avista'),
    financiamentoVsAluguel: de('financiamento'),
    consorcioVsAluguel: de('consorcio'),
    intervalo,
  }
}

/** A data da contemplação é a maior incerteza do consórcio: mostra o resultado em meses típicos. */
export function sensibilidadeContemplacao(i: InputsComparativo) {
  if (!simularNucleo(i, true).rotas.includes('consorcio')) return []
  const limite = Math.min(i.prazoConsorcioMeses, Math.round(i.horizonteAnos * 12))
  const meses = [12, 36, 60, 120, 180].filter((m) => m <= limite)
  return meses.map((mes) => {
    const r = simularNucleo({ ...i, mesContemplacao: mes }, true)
    const base = i.descontarCustosVenda ? r.patrimonioComCustosVenda : r.patrimonioSemCustosVenda
    return { mes, patrimonio: base.consorcio, vencedor: r.vencedor }
  })
}

/**
 * Função pública: recebe as entradas (JSON) e devolve o vencedor, o patrimônio e os custos de
 * cada cenário, a evolução mês a mês para os gráficos, o ponto de virada e a sensibilidade à
 * data de contemplação do consórcio. Lança Error com as mensagens de `validarInputs` se houver
 * entrada impossível.
 */
export function simularComparativoImobiliario(entrada: Partial<InputsComparativo>): ResultadoComparativo {
  const i = inputsPadrao(entrada)
  const erros = validarInputs(i)
  if (erros.length) throw new Error(erros.join(' '))
  const r = simularNucleo(i)
  r.pontoDeVirada = pontoDeVirada(i)
  r.sensibilidadeContemplacao = sensibilidadeContemplacao(i)
  return r
}

/**
 * Ponto de partida das premissas de mercado, vindo do snapshot oficial: como o horizonte é longo, usa a
 * projeção de LONGO PRAZO do Boletim Focus (último ano projetado), não a taxa de hoje. A Selic projetada
 * serve de rendimento bruto; o IPCA projetado serve de inflação, de valorização do imóvel e de reajuste do
 * aluguel e do consórcio. Tudo continua editável na tela. Sem Focus, devolve vazio (valem os padrões).
 */
export function inputsDoSnapshot(snapshot: SnapshotMercado): Partial<InputsComparativo> {
  const focus = snapshot.focus
  if (!focus) return {}
  const ultimo = (porAno: Record<string, number>) => {
    const anos = Object.keys(porAno).map(Number).sort((a, b) => a - b)
    return anos.length ? porAno[String(anos.at(-1))] : null
  }
  const selic = ultimo(focus.selic)
  const ipca = ultimo(focus.ipca)
  const r2 = (n: number) => Math.round(n * 100) / 100
  const saida: Partial<InputsComparativo> = {}
  if (selic != null) saida.rendimentoAA = r2(selic)
  if (ipca != null) {
    saida.inflacaoAA = r2(ipca)
    saida.valorizacaoImovelAA = r2(ipca)
    saida.reajusteAluguelAA = r2(ipca)
    saida.reajusteConsorcioAA = r2(ipca)
  }
  return saida
}

/** "R$ 1,5 mi", "R$ 800 mil": para o eixo do gráfico e textos curtos. */
export function reaisCompacto(valor: number): string {
  const abs = Math.abs(valor)
  const sinal = valor < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sinal}R$ ${Math.round(abs / 1_000).toLocaleString('pt-BR')} mil`
  return `${sinal}R$ ${Math.round(abs).toLocaleString('pt-BR')}`
}
