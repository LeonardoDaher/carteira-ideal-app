/**
 * Meu Mês (D21) — controle do orçamento mensal no molde dos Três Potes de Duda.
 *
 * Funções puras, sem tela e sem armazenamento. Diferente do engine.ts, este arquivo roda no
 * navegador: aqui não há regra a proteger, e o dado sensível (salário, contas) é da pessoa,
 * então nada sai do aparelho.
 *
 * Ordem do dinheiro no Dia do Salário:
 *   salário − contas do mês − cofrinhos das contas anuais = sobra
 *   sobra → 🔵 Guardar (reserva) + 🟡 Fazer Crescer (investimento) + 🟢 Gastar (o resto)
 *
 * No Modo Recuperação (Etapa 3), o pote 🔴 Quitar ocupa o lugar do 🟡 Fazer Crescer, e as
 * parcelas mínimas das dívidas saem junto com as contas. As regras das dívidas estão em
 * `recuperacao.ts`; aqui elas só entram no caminho do salário.
 *
 * Meses são sempre chaves "AAAA-MM". Valores em reais, arredondados a centavos.
 */

import { RECUPERACAO_VAZIA, ehDividaCara, simularQuitacao, somaParcelasMinimas, validarRecuperacao } from './recuperacao'
import type { Divida, Plano, Recuperacao } from './recuperacao'

export type TipoConta = 'mensal' | 'anual'

export type Conta = {
  id: string
  nome: string
  /** Mensal: valor de todo mês. Anual: valor total da conta no ano (IPVA, IPTU, seguro...). */
  valor: number
  tipo: TipoConta
  /** Só para contas anuais: mês do vencimento, de 1 (janeiro) a 12 (dezembro). */
  mesVencimento?: number
}

/** Compra no cartão. `mes` é o mês da compra; a parcela de cada mês entra na fatura do seguinte. */
export type Compra = {
  id: string
  descricao: string
  /** Valor total da compra (todas as parcelas). */
  valor: number
  mes: string
  /** 1 = à vista. */
  parcelas: number
}

export type Cartao = {
  /** Teto mensal escolhido pela pessoa (não o limite do banco). 0 = ainda não definido. */
  teto: number
  compras: Compra[]
}

export type Orcamento = {
  salario: number
  contas: Conta[]
  /** Quanto a pessoa tem hoje guardado para emergências. */
  reserva: number
  /**
   * Quanto vai para cada pote todo mês. O pote Gastar é o que sobra. `quitar` (Etapa 3) é o
   * valor a mais, além das parcelas mínimas, para acelerar as dívidas; só vale no Modo
   * Recuperação. Opcional para dados e cópias das Etapas 1 e 2 continuarem idênticos.
   */
  potes: { guardar: number; crescer: number; quitar?: number }
  /** Por mês ("2026-10"), o valor pago ou depositado em cada conta ticada. */
  pagamentos: Record<string, Record<string, number>>
  /** Etapa 2 da D21. Opcional no armazenamento e nas cópias antigas: ausente = cartão vazio. */
  cartao: Cartao
  /** Etapa 3 da D21. Ausente = sem dívidas cadastradas (use `recuperacaoDe`). */
  recuperacao?: Recuperacao
}

export const CARTAO_VAZIO: Cartao = { teto: 0, compras: [] }

export const ORCAMENTO_VAZIO: Orcamento = {
  salario: 0,
  contas: [],
  reserva: 0,
  potes: { guardar: 0, crescer: 0 },
  pagamentos: {},
  cartao: CARTAO_VAZIO,
}

/** Id reservado da fatura na lista do mês (não é uma conta cadastrada). */
export const ID_FATURA = 'cartao:fatura'

/** Prefixo dos pagamentos de dívidas na lista do mês: "divida:<id da dívida>". */
export const PREFIXO_DIVIDA = 'divida:'

export const NOMES_DOS_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const

// ---------------------------------------------------------------- valores e meses

export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Lê um valor digitado em reais: "1.234,56", "1234,5", "R$ 800" ou "800.00".
 * O último separador seguido de 1 ou 2 dígitos é o decimal; os demais são de milhar.
 * Texto sem número vira 0; nunca devolve negativo.
 */
export function lerReais(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '')
  if (!/\d/.test(limpo)) return 0
  const m = /^(.*)[.,](\d{1,2})$/.exec(limpo)
  const inteiro = (m ? m[1] : limpo).replace(/[.,]/g, '')
  const decimal = m ? m[2].padEnd(2, '0') : '00'
  const valor = Number(`${inteiro || '0'}.${decimal}`)
  return Number.isFinite(valor) ? Math.min(valor, 99_999_999) : 0
}

export function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function partesMes(mes: string): { ano: number; mes: number } {
  const [ano, m] = mes.split('-').map(Number)
  return { ano, mes: m }
}

/** "2026-10" + 3 → "2027-01"; aceita deslocamento negativo. */
export function somarMeses(mes: string, n: number): string {
  const p = partesMes(mes)
  const total = p.ano * 12 + (p.mes - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "2026-10" → "outubro de 2026" */
export function mesPorExtenso(mes: string): string {
  const p = partesMes(mes)
  return `${NOMES_DOS_MESES[p.mes - 1]} de ${p.ano}`
}

// ---------------------------------------------------------------- cofrinhos das contas anuais

/** Quantos meses faltam, a partir de `mes`, até o próximo vencimento (0 se vence no próprio mês). */
export function mesesAteVencimento(mes: string, mesVencimento: number): number {
  return (mesVencimento - partesMes(mes).mes + 12) % 12
}

/**
 * Quanto já está no cofrinho de uma conta anual antes de `mes`: a soma dos depósitos feitos
 * no ciclo atual, que são os 12 meses que terminam no próximo vencimento.
 */
export function guardadoNoCofrinho(conta: Conta, pagamentos: Orcamento['pagamentos'], mes: string): number {
  if (conta.tipo !== 'anual' || !conta.mesVencimento) return 0
  const vencimento = somarMeses(mes, mesesAteVencimento(mes, conta.mesVencimento))
  const inicioDoCiclo = somarMeses(vencimento, -11)
  let soma = 0
  for (let m = inicioDoCiclo; m < mes; m = somarMeses(m, 1)) {
    soma += pagamentos[m]?.[conta.id] ?? 0
  }
  return centavos(soma)
}

/**
 * Quanto depositar neste mês no cofrinho de uma conta anual. Divide o que falta guardar pelos
 * meses que restam, contando o mês atual e o do vencimento: quem cadastra o IPVA de janeiro em
 * outubro guarda 1/4 por mês, e não 1/12. No mês do vencimento, é o que falta para pagar.
 */
export function aporteDoCofrinho(conta: Conta, pagamentos: Orcamento['pagamentos'], mes: string): number {
  if (conta.tipo !== 'anual' || !conta.mesVencimento) return 0
  const falta = Math.max(0, conta.valor - guardadoNoCofrinho(conta, pagamentos, mes))
  return centavos(falta / (mesesAteVencimento(mes, conta.mesVencimento) + 1))
}

// ---------------------------------------------------------------- o mês

export type ItemDoMes = {
  /** Na fatura do cartão e nas dívidas, uma conta sintética (ID_FATURA ou PREFIXO_DIVIDA + id). */
  conta: Conta
  origem: 'conta' | 'fatura' | 'divida'
  /** Quanto sai do salário por esta conta neste mês. */
  valorDoMes: number
  /** Conta anual que vence neste mês: o item é o pagamento, e não um depósito no cofrinho. */
  venceNesteMes: boolean
  /** Conta anual: quanto já estava no cofrinho antes deste mês. */
  guardadoAntes: number
  ticado: boolean
  /**
   * Só nas dívidas: quanto do valor é a parcela mínima (sai junto com as contas) e quanto vem
   * a mais do pote Quitar. Num item ticado, é o valor registrado dividido pela mínima de hoje.
   */
  divida?: { minimo: number; extra: number }
}

export function itensDoMes(orc: Orcamento, mes: string): ItemDoMes[] {
  const pagosNoMes = orc.pagamentos[mes] ?? {}
  const itens: ItemDoMes[] = orc.contas.map((conta) => {
    const ticado = conta.id in pagosNoMes
    const anual = conta.tipo === 'anual' && !!conta.mesVencimento
    const venceNesteMes = anual && mesesAteVencimento(mes, conta.mesVencimento!) === 0
    // Item já ticado mostra o valor registrado no dia do tique, para o total não mudar depois.
    const valorDoMes = ticado ? pagosNoMes[conta.id] : anual ? aporteDoCofrinho(conta, orc.pagamentos, mes) : conta.valor
    return { conta, origem: 'conta' as const, valorDoMes, venceNesteMes, guardadoAntes: guardadoNoCofrinho(conta, orc.pagamentos, mes), ticado }
  })
  // A fatura do mês (compras do mês anterior) entra como mais uma conta a ticar.
  const fatura = faturaDoMes(orc, mes)
  const faturaTicada = ID_FATURA in pagosNoMes
  if (fatura > 0 || faturaTicada) {
    itens.push({
      conta: { id: ID_FATURA, nome: 'Fatura do cartão', valor: fatura, tipo: 'mensal' },
      origem: 'fatura',
      valorDoMes: faturaTicada ? pagosNoMes[ID_FATURA] : fatura,
      venceNesteMes: false,
      guardadoAntes: 0,
      ticado: faturaTicada,
    })
  }
  // Dívidas: o pagamento do mês que o plano de quitação manda fazer em cada uma. O plano parte
  // do saldo de hoje, então é o mesmo em qualquer mês ainda não ticado.
  const previstos = pagamentosDoMes(orc)
  for (const d of recuperacaoDe(orc).dividas) {
    const id = PREFIXO_DIVIDA + d.id
    const ticado = id in pagosNoMes
    const previsto = previstos[d.id]
    if (!ticado && !previsto) continue
    const valorDoMes = ticado ? pagosNoMes[id] : centavos(previsto.minimo + previsto.extra)
    const minimo = ticado ? Math.min(valorDoMes, d.parcelaMinima) : previsto.minimo
    itens.push({
      conta: { id, nome: d.nome, valor: valorDoMes, tipo: 'mensal' },
      origem: 'divida',
      valorDoMes,
      venceNesteMes: false,
      guardadoAntes: 0,
      ticado,
      divida: { minimo: centavos(minimo), extra: centavos(valorDoMes - minimo) },
    })
  }
  return itens
}

export type SituacaoDoMes = 'folga' | 'apertado' | 'negativo'

export type ResumoDoMes = {
  salario: number
  contasMensais: number
  cofrinhos: number
  /** Fatura do cartão paga neste mês (compras do mês anterior). */
  fatura: number
  /** Parcelas mínimas das dívidas: saem junto com as contas, antes de qualquer pote. */
  dividas: number
  /** Contas mensais + cofrinhos + fatura + parcelas mínimas: o que sai antes de qualquer pote. */
  comprometido: number
  sobra: number
  guardar: number
  /** Fazer Crescer. Zero no Modo Recuperação: o valor planejado fica guardado em `orc.potes`. */
  crescer: number
  /** Pote Quitar: o que vai a mais para as dívidas, além das mínimas. Só no Modo Recuperação. */
  quitar: number
  recuperacao: boolean
  /** O pote Gastar: o que fica para o dia a dia depois de tudo. Pode ser negativo. */
  gastar: number
  pago: number
  falta: number
  itensTicados: number
  totalItens: number
  /**
   * folga: sobra cobre os potes e ainda fica dinheiro para gastar.
   * apertado: as contas cabem no salário, mas os potes planejados não.
   * negativo: as contas sozinhas já passam do salário.
   */
  situacao: SituacaoDoMes
}

export function resumoDoMes(orc: Orcamento, mes: string): ResumoDoMes {
  const itens = itensDoMes(orc, mes)
  const soma = (lista: ItemDoMes[]) => centavos(lista.reduce((t, i) => t + i.valorDoMes, 0))
  const contasMensais = soma(itens.filter((i) => i.origem === 'conta' && i.conta.tipo === 'mensal'))
  const cofrinhos = soma(itens.filter((i) => i.conta.tipo === 'anual'))
  const fatura = soma(itens.filter((i) => i.origem === 'fatura'))
  const doDivida = itens.filter((i) => i.origem === 'divida')
  const dividas = centavos(doDivida.reduce((t, i) => t + i.divida!.minimo, 0))
  const quitar = centavos(doDivida.reduce((t, i) => t + i.divida!.extra, 0))
  const comprometido = centavos(contasMensais + cofrinhos + fatura + dividas)
  const sobra = centavos(orc.salario - comprometido)
  const recuperacao = modoRecuperacaoAtivo(orc)
  const guardar = orc.potes.guardar
  const crescer = recuperacao ? 0 : orc.potes.crescer
  const gastar = centavos(sobra - guardar - crescer - quitar)
  const pago = soma(itens.filter((i) => i.ticado))
  return {
    salario: orc.salario,
    contasMensais,
    cofrinhos,
    fatura,
    dividas,
    comprometido,
    sobra,
    guardar,
    crescer,
    quitar,
    recuperacao,
    gastar,
    pago,
    falta: centavos(soma(itens) - pago),
    itensTicados: itens.filter((i) => i.ticado).length,
    totalItens: itens.length,
    situacao: sobra < 0 ? 'negativo' : gastar < 0 ? 'apertado' : 'folga',
  }
}

/** Marca ou desmarca uma conta no mês, guardando o valor do momento do tique. Não altera `orc`. */
export function alternarPagamento(orc: Orcamento, mes: string, contaId: string, valor: number): Orcamento {
  const doMes = { ...orc.pagamentos[mes] }
  if (contaId in doMes) delete doMes[contaId]
  else doMes[contaId] = centavos(valor)
  const pagamentos = { ...orc.pagamentos }
  if (Object.keys(doMes).length) pagamentos[mes] = doMes
  else delete pagamentos[mes]
  return { ...orc, pagamentos }
}

// ---------------------------------------------------------------- cartão de crédito

/**
 * Valor da parcela de uma compra que cai em `mes` (0 se não cai). As parcelas são arredondadas
 * para baixo em centavos e a última leva a diferença, para a soma bater com o valor da compra.
 */
export function parcelaNoMes(compra: Compra, mes: string): number {
  const n = Math.max(1, compra.parcelas)
  const fim = somarMeses(compra.mes, n - 1)
  if (mes < compra.mes || mes > fim) return 0
  const base = Math.floor((compra.valor / n) * 100) / 100
  return mes === fim ? centavos(compra.valor - base * (n - 1)) : base
}

/** Quanto foi para o cartão em `mes`: compras à vista do mês e parcelas que caem nele. */
export function gastoNoCartao(orc: Orcamento, mes: string): number {
  return centavos(orc.cartao.compras.reduce((t, c) => t + parcelaNoMes(c, mes), 0))
}

/** A fatura paga em `mes` traz as compras do mês anterior. */
export function faturaDoMes(orc: Orcamento, mes: string): number {
  return gastoNoCartao(orc, somarMeses(mes, -1))
}

export type Semaforo = 'sem-teto' | 'verde' | 'amarelo' | 'vermelho'

/** Verde até 70% do teto, amarelo até 100%, vermelho acima. */
export function semaforoDoCartao(gasto: number, teto: number): Semaforo {
  if (teto <= 0) return 'sem-teto'
  const uso = gasto / teto
  return uso <= 0.7 ? 'verde' : uso <= 1 ? 'amarelo' : 'vermelho'
}

/** Compras cujas parcelas caem em `mes`, com o número da parcela ("2 de 3"). */
export function comprasDoMes(orc: Orcamento, mes: string): { compra: Compra; parcela: number; valor: number }[] {
  return orc.cartao.compras
    .map((compra) => ({ compra, valor: parcelaNoMes(compra, mes), parcela: diferencaMeses(compra.mes, mes) + 1 }))
    .filter((x) => x.valor > 0)
}

/** Meses de `de` até `ate` ("2026-10" → "2027-01" = 3). */
export function diferencaMeses(de: string, ate: string): number {
  const a = partesMes(de)
  const b = partesMes(ate)
  return (b.ano - a.ano) * 12 + (b.mes - a.mes)
}

/** Parcelas já assumidas para os meses depois de `mes`, até 12 meses à frente, só os meses com valor. */
export function parcelasFuturas(orc: Orcamento, mes: string): { mes: string; valor: number }[] {
  const lista: { mes: string; valor: number }[] = []
  for (let i = 1; i <= 12; i++) {
    const m = somarMeses(mes, i)
    const valor = gastoNoCartao(orc, m)
    if (valor > 0) lista.push({ mes: m, valor })
  }
  return lista
}

/**
 * Teto que cabe no orçamento: o pote Gastar de um mês típico (salário − contas mensais − 1/12
 * das anuais − parcelas mínimas − Guardar − Fazer Crescer, ou Quitar no Modo Recuperação).
 * O cartão é pago com o salário do mês seguinte, então gastar mais do que isso aperta o
 * próximo mês. `null` quando não sobra nada.
 */
export function tetoSugerido(orc: Orcamento): number | null {
  const terceiroPote = modoRecuperacaoAtivo(orc) ? (orc.potes.quitar ?? 0) : orc.potes.crescer
  const livre = orc.salario - custoMensalDeVida(orc) - orc.potes.guardar - terceiroPote
  return livre > 0 ? Math.floor(livre / 10) * 10 : null
}

// ---------------------------------------------------------------- reserva

/**
 * Custo de vida de um mês típico: contas mensais, 1/12 de cada conta anual e as parcelas
 * mínimas das dívidas (que também não podem parar num imprevisto). É a régua da reserva de
 * emergência, e não depende do mês escolhido na tela.
 */
export function custoMensalDeVida(orc: Orcamento): number {
  const contas = orc.contas.reduce((t, c) => t + (c.tipo === 'anual' ? c.valor / 12 : c.valor), 0)
  return centavos(contas + somaParcelasMinimas(recuperacaoDe(orc).dividas))
}

/** Quantos meses a reserva paga as contas. `null` sem contas cadastradas (não há régua). */
export function mesesDeReserva(orc: Orcamento): number | null {
  const custo = custoMensalDeVida(orc)
  return custo > 0 ? Math.floor((orc.reserva / custo) * 10) / 10 : null
}

/**
 * Sugestão para o Pilar 1 da Arquitetura Patrimonial, com as mesmas faixas da pergunta:
 * [A] menos de 3 meses, [B] de 3 a 12, [C] mais de 12. Usada na ponte com o questionário
 * (Etapa 4 da D21); a resposta continua sendo da pessoa.
 */
export function sugestaoPilar1(orc: Orcamento): 'a' | 'b' | 'c' | null {
  const meses = mesesDeReserva(orc)
  if (meses == null) return null
  return meses < 3 ? 'a' : meses <= 12 ? 'b' : 'c'
}

// ---------------------------------------------------------------- Modo Recuperação (Etapa 3)

export function recuperacaoDe(orc: Orcamento): Recuperacao {
  return orc.recuperacao ?? RECUPERACAO_VAZIA
}

/**
 * Liga quando há dívida cara em aberto (o mesmo critério da opção [A] do Pilar 2) ou quando a
 * pessoa liga por conta própria. Desliga sozinho quando a última dívida cara é quitada.
 */
export function modoRecuperacaoAtivo(orc: Orcamento): boolean {
  const r = recuperacaoDe(orc)
  return r.ligadoManual || r.dividas.some(ehDividaCara)
}

export function temDividaCara(orc: Orcamento): boolean {
  return recuperacaoDe(orc).dividas.some(ehDividaCara)
}

/**
 * Dívidas que o plano ataca. No Modo Recuperação, só as caras: é para elas que vai o pote
 * Quitar, e o modo desliga quando elas acabam (o dinheiro volta para o Fazer Crescer, e não
 * para antecipar um financiamento barato). Sem dívida cara (modo ligado à mão, ou desligado),
 * o plano abrange todas.
 */
export function dividasDoPlano(orc: Orcamento): Divida[] {
  const abertas = recuperacaoDe(orc).dividas.filter((d) => d.saldo > 0)
  const caras = abertas.filter(ehDividaCara)
  return modoRecuperacaoAtivo(orc) && caras.length > 0 ? caras : abertas
}

/** Quanto vai para o plano por mês: as mínimas das dívidas do plano + o pote Quitar (no modo). */
export function valorDoPlano(orc: Orcamento): number {
  const minimos = somaParcelasMinimas(dividasDoPlano(orc))
  return centavos(minimos + (modoRecuperacaoAtivo(orc) ? (orc.potes.quitar ?? 0) : 0))
}

/** Plano de quitação das dívidas do plano, com o valor do mês. */
export function planoDoMes(orc: Orcamento, metodo = recuperacaoDe(orc).metodo): Plano {
  return simularQuitacao(dividasDoPlano(orc), valorDoPlano(orc), metodo)
}

/**
 * Quanto pagar em cada dívida neste mês: o que o plano manda nas dívidas do plano e só a
 * parcela em dia nas que ficam fora dele (baratas, no Modo Recuperação).
 */
export function pagamentosDoMes(orc: Orcamento): Record<string, { minimo: number; extra: number }> {
  const doPlano = planoDoMes(orc).primeiroMes
  const todos: Record<string, { minimo: number; extra: number }> = {}
  for (const d of recuperacaoDe(orc).dividas) {
    if (d.saldo <= 0) continue
    todos[d.id] = doPlano[d.id] ?? { minimo: centavos(Math.min(d.parcelaMinima, d.saldo)), extra: 0 }
  }
  return todos
}

/**
 * Mini-reserva: metade de um mês de custo de vida, arredondada para cima em R$ 100, e nunca
 * menos de R$ 500. É o bastante para um remédio ou um conserto não virarem dívida nova, e
 * pequena o bastante para não adiar muito o ataque às dívidas.
 */
export function metaMiniReserva(orc: Orcamento): number {
  return Math.max(500, Math.ceil(custoMensalDeVida(orc) / 2 / 100) * 100)
}

/**
 * Fases do Modo Recuperação:
 *   1. mini-reserva: juntar a mini-reserva no pote Guardar, pagando as mínimas em dia;
 *   2. quitar: mini-reserva pronta, tudo o que der vai para o pote Quitar.
 * A fase 3 (completar a reserva de 3 meses e voltar a investir) já é fora do modo.
 */
export type FaseRecuperacao = 'mini-reserva' | 'quitar'

export function faseRecuperacao(orc: Orcamento): FaseRecuperacao {
  return orc.reserva < metaMiniReserva(orc) ? 'mini-reserva' : 'quitar'
}

/** Compras parceladas lançadas a partir do mês do pacto de não parcelar. */
export function parceladasDesdeOPacto(orc: Orcamento): Compra[] {
  const desde = recuperacaoDe(orc).pactoDesde
  if (!desde) return []
  return orc.cartao.compras.filter((c) => c.parcelas > 1 && c.mes >= desde)
}

/**
 * Sugestão para o Pilar 2 da Arquitetura Patrimonial (Etapa 4): [A] dívida cara em aberto;
 * [C] nenhuma dívida e custo de vida até metade do salário; [B] o resto (dívidas baratas ou
 * custo fixo alto). A resposta continua sendo da pessoa.
 */
export function sugestaoPilar2(orc: Orcamento): 'a' | 'b' | 'c' | null {
  if (temDividaCara(orc)) return 'a'
  if (orc.salario <= 0) return null
  const semDividas = recuperacaoDe(orc).dividas.every((d) => d.saldo <= 0)
  return semDividas && custoMensalDeVida(orc) <= orc.salario / 2 ? 'c' : 'b'
}

// ---------------------------------------------------------------- cópia de segurança

export const FORMATO_COPIA = 'carteiraideal.meumes'

export function gerarCopia(orc: Orcamento, agora: Date): string {
  return JSON.stringify({ formato: FORMATO_COPIA, versao: 1, geradoEm: agora.toISOString(), orcamento: orc }, null, 2)
}

const numeroValido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/**
 * Lê uma cópia salva e devolve o orçamento, ou `null` se o arquivo não for uma cópia válida.
 * Valida campo a campo: um arquivo estranho nunca pode quebrar o app nem apagar os dados atuais.
 */
export function lerCopia(texto: string): Orcamento | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (!bruto || typeof bruto !== 'object') return null
  const envelope = bruto as { formato?: unknown; orcamento?: unknown }
  if (envelope.formato !== FORMATO_COPIA) return null
  return validarOrcamento(envelope.orcamento)
}

/** Confere a estrutura de um orçamento vindo de fora (cópia ou armazenamento). */
export function validarOrcamento(bruto: unknown): Orcamento | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  if (!numeroValido(o.salario) || !numeroValido(o.reserva) || !Array.isArray(o.contas)) return null
  const potes = o.potes as Record<string, unknown> | undefined
  if (!potes || !numeroValido(potes.guardar) || !numeroValido(potes.crescer)) return null
  if (potes.quitar !== undefined && !numeroValido(potes.quitar)) return null

  const contas: Conta[] = []
  for (const c of o.contas as unknown[]) {
    if (!c || typeof c !== 'object') return null
    const k = c as Record<string, unknown>
    if (typeof k.id !== 'string' || typeof k.nome !== 'string' || !numeroValido(k.valor)) return null
    if (k.tipo === 'mensal') contas.push({ id: k.id, nome: k.nome, valor: k.valor, tipo: 'mensal' })
    else if (k.tipo === 'anual' && Number.isInteger(k.mesVencimento) && (k.mesVencimento as number) >= 1 && (k.mesVencimento as number) <= 12)
      contas.push({ id: k.id, nome: k.nome, valor: k.valor, tipo: 'anual', mesVencimento: k.mesVencimento as number })
    else return null
  }

  const pagamentos: Orcamento['pagamentos'] = {}
  const pg = o.pagamentos
  if (pg && typeof pg === 'object') {
    for (const [mes, doMes] of Object.entries(pg as Record<string, unknown>)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !doMes || typeof doMes !== 'object') return null
      const limpo: Record<string, number> = {}
      for (const [id, v] of Object.entries(doMes as Record<string, unknown>)) {
        if (!numeroValido(v)) return null
        limpo[id] = v
      }
      pagamentos[mes] = limpo
    }
  }

  let cartao: Cartao = CARTAO_VAZIO
  if (o.cartao !== undefined) {
    const k = o.cartao as Record<string, unknown> | null
    if (!k || typeof k !== 'object' || !numeroValido(k.teto) || !Array.isArray(k.compras)) return null
    const compras: Compra[] = []
    for (const c of k.compras as unknown[]) {
      if (!c || typeof c !== 'object') return null
      const x = c as Record<string, unknown>
      if (
        typeof x.id !== 'string' ||
        typeof x.descricao !== 'string' ||
        !numeroValido(x.valor) ||
        typeof x.mes !== 'string' ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(x.mes) ||
        !Number.isInteger(x.parcelas) ||
        (x.parcelas as number) < 1 ||
        (x.parcelas as number) > 24
      )
        return null
      compras.push({ id: x.id, descricao: x.descricao, valor: x.valor, mes: x.mes, parcelas: x.parcelas as number })
    }
    cartao = { teto: k.teto, compras }
  }

  let recuperacao: Recuperacao | undefined
  if (o.recuperacao !== undefined) {
    const r = validarRecuperacao(o.recuperacao)
    if (!r) return null
    recuperacao = r
  }

  // Campos das etapas novas só entram se vieram: o dado das etapas anteriores volta idêntico.
  const potesLimpos: Orcamento['potes'] = { guardar: potes.guardar, crescer: potes.crescer }
  if (potes.quitar !== undefined) potesLimpos.quitar = potes.quitar as number
  const orc: Orcamento = { salario: o.salario, reserva: o.reserva, potes: potesLimpos, contas, pagamentos, cartao }
  if (recuperacao) orc.recuperacao = recuperacao
  return orc
}

// ---------------------------------------------------------------- sugestões de cadastro

/** Atalhos da tela de cadastro: as contas que mais esquecem na hora de planejar o mês. */
export const CONTAS_SUGERIDAS: { nome: string; tipo: TipoConta; mesVencimento?: number }[] = [
  { nome: 'Aluguel ou financiamento', tipo: 'mensal' },
  { nome: 'Condomínio', tipo: 'mensal' },
  { nome: 'Luz', tipo: 'mensal' },
  { nome: 'Água', tipo: 'mensal' },
  { nome: 'Internet e celular', tipo: 'mensal' },
  { nome: 'Plano de saúde', tipo: 'mensal' },
  { nome: 'Escola ou creche', tipo: 'mensal' },
  { nome: 'Mercado', tipo: 'mensal' },
  { nome: 'Transporte e combustível', tipo: 'mensal' },
  { nome: 'IPVA', tipo: 'anual', mesVencimento: 1 },
  { nome: 'IPTU', tipo: 'anual', mesVencimento: 2 },
  { nome: 'Licenciamento', tipo: 'anual' },
  { nome: 'Seguro do carro', tipo: 'anual' },
  { nome: 'Seguro da moto', tipo: 'anual' },
  { nome: 'Material escolar e matrícula', tipo: 'anual', mesVencimento: 1 },
]
