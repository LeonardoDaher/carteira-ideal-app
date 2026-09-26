/**
 * Meu Mês (D21, Etapa 3) — Modo Recuperação: dívidas e plano de quitação.
 *
 * Funções puras, sem tela e sem armazenamento, e sem depender do resto do orçamento:
 * `orcamento.ts` importa daqui (e não o contrário), para não haver ciclo de imports.
 *
 * Conteúdo educativo. Nada aqui indica banco, produto de crédito ou estratégia jurídica.
 */

export type TipoDivida =
  | 'cartao-rotativo'
  | 'cartao-parcelado'
  | 'cheque-especial'
  | 'emprestimo-pessoal'
  | 'dolar'
  | 'consignado'
  | 'financiamento'
  | 'outra'

export type Divida = {
  id: string
  /** Como a pessoa chama a dívida ("Cartão roxo", "Empréstimo do banco"). */
  nome: string
  tipo: TipoDivida
  /** Quanto deve hoje. Atualizado pela pessoa, com o extrato na mão. */
  saldo: number
  /** Maior saldo já registrado: a régua da barra de progresso. */
  saldoInicial: number
  /** Juros ao mês, em %. 8 = 8% ao mês. */
  jurosMensal: number
  /** Pagamento mínimo ou parcela do mês. */
  parcelaMinima: number
}

export type MetodoQuitacao = 'avalanche' | 'bola-de-neve'

export type Recuperacao = {
  /** Ligado pela própria pessoa. O modo também liga sozinho quando há dívida cara. */
  ligadoManual: boolean
  dividas: Divida[]
  metodo: MetodoQuitacao
  /** Mês ("AAAA-MM") em que a pessoa fez o pacto de não parcelar; null = sem pacto. */
  pactoDesde: string | null
}

export const RECUPERACAO_VAZIA: Recuperacao = { ligadoManual: false, dividas: [], metodo: 'avalanche', pactoDesde: null }

/**
 * A partir de quantos % ao mês uma dívida é "cara", seja qual for o tipo. 3% ao mês (cerca de
 * 42% ao ano) é quase o triplo do que a Selic de 2026 paga: nenhum investimento seguro compensa.
 * Consignado e financiamento de carro ou imóvel, na casa de 1% a 2% ao mês, ficam abaixo, como
 * na opção [B] do Pilar 2 ("dívidas estruturadas/longas com taxa baixa").
 */
export const LIMIAR_JUROS_CARO = 3

/**
 * Tipos de dívida. `cara: true` segue o texto literal da opção [A] do Pilar 2 ("cartão, cheque
 * especial, empréstimo pessoal ou passivos em dólar"): esses tipos ligam o Modo Recuperação
 * mesmo que a pessoa digite juros baixos por engano.
 *
 * `jurosReferencia` é só um ponto de partida para quem não sabe a taxa (médias de mercado do
 * Banco Central no início de 2026, arredondadas para baixo; cheque especial no teto legal de
 * 8% ao mês). Revisar a cada seis meses (docs/06). Tipos sem média confiável ficam em null.
 */
export const TIPOS_DE_DIVIDA: Record<TipoDivida, { rotulo: string; cara: boolean; jurosReferencia: number | null }> = {
  'cartao-rotativo': { rotulo: 'Rotativo do cartão', cara: true, jurosReferencia: 14 },
  'cartao-parcelado': { rotulo: 'Fatura do cartão parcelada', cara: true, jurosReferencia: 9 },
  'cheque-especial': { rotulo: 'Cheque especial', cara: true, jurosReferencia: 8 },
  'emprestimo-pessoal': { rotulo: 'Empréstimo pessoal', cara: true, jurosReferencia: 6 },
  dolar: { rotulo: 'Dívida em dólar', cara: true, jurosReferencia: null },
  consignado: { rotulo: 'Consignado', cara: false, jurosReferencia: null },
  financiamento: { rotulo: 'Financiamento (carro, imóvel)', cara: false, jurosReferencia: null },
  outra: { rotulo: 'Outra (loja, carnê, parente)', cara: false, jurosReferencia: null },
}

export const ORDEM_DOS_TIPOS = Object.keys(TIPOS_DE_DIVIDA) as TipoDivida[]

function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Converte a taxa ao ano em taxa equivalente ao mês, por juros compostos (12% ao ano ≈ 0,9489% ao
 * mês, e não 1%). Financiamentos costumam informar a taxa ao ano; cartão e cheque especial, ao mês.
 * Quatro casas decimais: o bastante para o plano de quitação sem inventar precisão.
 */
export function jurosMensalDeAnual(anual: number): number {
  if (anual <= 0) return 0
  return Math.round(((1 + anual / 100) ** (1 / 12) - 1) * 1_000_000) / 10_000
}

/** O caminho inverso, para mostrar a taxa ao ano de uma taxa ao mês (3% ao mês ≈ 42,58% ao ano). */
export function jurosAnualDeMensal(mensal: number): number {
  if (mensal <= 0) return 0
  return Math.round(((1 + mensal / 100) ** 12 - 1) * 10_000) / 100
}

/** Dívida cara em aberto: tipo caro ou juros a partir de LIMIAR_JUROS_CARO ao mês. */
export function ehDividaCara(d: Divida): boolean {
  return d.saldo > 0 && (TIPOS_DE_DIVIDA[d.tipo].cara || d.jurosMensal >= LIMIAR_JUROS_CARO)
}

/** Juros de um mês sobre o saldo de hoje. */
export function jurosDoMes(d: Divida): number {
  return centavos((d.saldo * d.jurosMensal) / 100)
}

/** A parcela mínima não cobre nem os juros: a dívida cresce mesmo pagando em dia. */
export function minimoNaoCobreJuros(d: Divida): boolean {
  return d.saldo > 0 && d.jurosMensal > 0 && d.parcelaMinima <= jurosDoMes(d)
}

/** Soma das parcelas mínimas das dívidas em aberto (nenhuma passa do próprio saldo). */
export function somaParcelasMinimas(dividas: Divida[]): number {
  return centavos(dividas.reduce((t, d) => t + (d.saldo > 0 ? Math.min(d.parcelaMinima, d.saldo) : 0), 0))
}

// ---------------------------------------------------------------- plano de quitação

/** Horizonte máximo da simulação: 30 anos. Passou disso, o plano "não termina". */
export const MESES_MAXIMOS = 360

export type Plano = {
  metodo: MetodoQuitacao
  /**
   * ok: tudo quitado dentro do horizonte.
   * nao-termina: os juros crescem mais rápido do que os pagamentos.
   * sem-dividas: nada em aberto.
   */
  status: 'ok' | 'nao-termina' | 'sem-dividas'
  /** Meses até a última dívida zerar (1 = este mês). Em "nao-termina", MESES_MAXIMOS. */
  meses: number
  jurosTotais: number
  totalPago: number
  /** Ids na ordem de ataque. */
  ordem: string[]
  /** Id → mês em que a dívida zera (1 = este mês). Só as que zeram dentro do horizonte. */
  quitacoes: Record<string, number>
  /** Quanto pagar em cada dívida neste mês: a parcela mínima e o que vem a mais do pote Quitar. */
  primeiroMes: Record<string, { minimo: number; extra: number }>
}

/**
 * Ordem de ataque, fixada no início do plano.
 * Avalanche: juros mais altos primeiro (paga menos juros no total).
 * Bola de neve: menor saldo primeiro (a primeira vitória chega antes).
 * Empates caem para o outro critério e, por fim, para o id, para a ordem nunca oscilar.
 */
export function ordemDeAtaque(dividas: Divida[], metodo: MetodoQuitacao): Divida[] {
  const porJuros = (a: Divida, b: Divida) => b.jurosMensal - a.jurosMensal
  const porSaldo = (a: Divida, b: Divida) => a.saldo - b.saldo
  const [primeiro, segundo] = metodo === 'avalanche' ? [porJuros, porSaldo] : [porSaldo, porJuros]
  return dividas
    .filter((d) => d.saldo > 0)
    .sort((a, b) => primeiro(a, b) || segundo(a, b) || a.id.localeCompare(b.id))
}

/**
 * Simula o pagamento mês a mês com um valor fixo por mês (`orcamentoMensal`): primeiro os
 * juros do mês entram no saldo; depois paga a parcela mínima de cada dívida; o que sobra vai
 * inteiro para a primeira da ordem de ataque ainda em aberto. Quando uma dívida zera, a parcela
 * dela passa a reforçar a seguinte (é o "efeito bola de neve", presente nos dois métodos).
 *
 * Simplificações, ditas na tela: juros constantes, sem multa, IOF, novas compras ou o teto de
 * juros do rotativo. Por isso o saldo deve ser atualizado pelo extrato todo mês.
 */
export function simularQuitacao(dividas: Divida[], orcamentoMensal: number, metodo: MetodoQuitacao): Plano {
  const ordem = ordemDeAtaque(dividas, metodo)
  const vazio: Plano = { metodo, status: 'sem-dividas', meses: 0, jurosTotais: 0, totalPago: 0, ordem: [], quitacoes: {}, primeiroMes: {} }
  if (ordem.length === 0) return vazio

  const saldos = new Map(ordem.map((d) => [d.id, d.saldo]))
  const quitacoes: Record<string, number> = {}
  const primeiroMes: Plano['primeiroMes'] = {}
  let jurosTotais = 0
  let totalPago = 0

  for (let mes = 1; mes <= MESES_MAXIMOS; mes++) {
    const abertas = ordem.filter((d) => saldos.get(d.id)! > 0)
    for (const d of abertas) {
      const juros = centavos((saldos.get(d.id)! * d.jurosMensal) / 100)
      saldos.set(d.id, centavos(saldos.get(d.id)! + juros))
      jurosTotais += juros
    }

    let disponivel = orcamentoMensal
    const pagos = new Map<string, { minimo: number; extra: number }>()
    for (const d of abertas) {
      const minimo = centavos(Math.max(0, Math.min(d.parcelaMinima, saldos.get(d.id)!, disponivel)))
      saldos.set(d.id, centavos(saldos.get(d.id)! - minimo))
      disponivel = centavos(disponivel - minimo)
      pagos.set(d.id, { minimo, extra: 0 })
    }
    for (const d of abertas) {
      if (disponivel <= 0) break
      const extra = centavos(Math.min(disponivel, saldos.get(d.id)!))
      if (extra <= 0) continue
      saldos.set(d.id, centavos(saldos.get(d.id)! - extra))
      disponivel = centavos(disponivel - extra)
      pagos.get(d.id)!.extra = extra
    }

    for (const d of abertas) {
      const p = pagos.get(d.id)!
      totalPago += p.minimo + p.extra
      if (mes === 1) primeiroMes[d.id] = p
      if (saldos.get(d.id)! <= 0 && quitacoes[d.id] == null) quitacoes[d.id] = mes
    }

    if (ordem.every((d) => saldos.get(d.id)! <= 0)) {
      return {
        metodo,
        status: 'ok',
        meses: mes,
        jurosTotais: centavos(jurosTotais),
        totalPago: centavos(totalPago),
        ordem: ordem.map((d) => d.id),
        quitacoes,
        primeiroMes,
      }
    }
  }

  return {
    metodo,
    status: 'nao-termina',
    meses: MESES_MAXIMOS,
    jurosTotais: centavos(jurosTotais),
    totalPago: centavos(totalPago),
    ordem: ordem.map((d) => d.id),
    quitacoes,
    primeiroMes,
  }
}

/** Mês da primeira dívida quitada (a "primeira vitória"), ou null se nenhuma zera. */
export function primeiraVitoria(plano: Plano): { id: string; mes: number } | null {
  let melhor: { id: string; mes: number } | null = null
  for (const id of plano.ordem) {
    const mes = plano.quitacoes[id]
    if (mes != null && (melhor == null || mes < melhor.mes)) melhor = { id, mes }
  }
  return melhor
}

// ---------------------------------------------------------------- validação

const numeroValido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/

/** Confere o bloco `recuperacao` vindo de fora. `undefined` = dado antigo (Etapas 1 e 2). */
export function validarRecuperacao(bruto: unknown): Recuperacao | null {
  if (!bruto || typeof bruto !== 'object') return null
  const r = bruto as Record<string, unknown>
  if (typeof r.ligadoManual !== 'boolean' || !Array.isArray(r.dividas)) return null
  if (r.metodo !== 'avalanche' && r.metodo !== 'bola-de-neve') return null
  if (r.pactoDesde !== null && (typeof r.pactoDesde !== 'string' || !MES_VALIDO.test(r.pactoDesde))) return null

  const dividas: Divida[] = []
  for (const x of r.dividas as unknown[]) {
    if (!x || typeof x !== 'object') return null
    const d = x as Record<string, unknown>
    if (
      typeof d.id !== 'string' ||
      typeof d.nome !== 'string' ||
      typeof d.tipo !== 'string' ||
      !(d.tipo in TIPOS_DE_DIVIDA) ||
      !numeroValido(d.saldo) ||
      !numeroValido(d.saldoInicial) ||
      !numeroValido(d.jurosMensal) ||
      d.jurosMensal > 100 ||
      !numeroValido(d.parcelaMinima)
    )
      return null
    dividas.push({
      id: d.id,
      nome: d.nome,
      tipo: d.tipo as TipoDivida,
      saldo: d.saldo,
      saldoInicial: d.saldoInicial,
      jurosMensal: d.jurosMensal,
      parcelaMinima: d.parcelaMinima,
    })
  }
  return { ligadoManual: r.ligadoManual, dividas, metodo: r.metodo, pactoDesde: r.pactoDesde as string | null }
}
