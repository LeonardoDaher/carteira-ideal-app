// Minha Carteira (D36): confere o histórico de lançamentos contra a POSIÇÃO da B3 (a foto do
// que a pessoa tem em custódia) e diz, ativo a ativo, se o preço médio calculado é confiável.
//
// Por que existe: o preço médio só está certo se o histórico estiver completo. Quem exporta
// um período da B3 (digamos, 12 meses) e já tinha ações antes dele terá vendas "sem saldo" e
// quantidades menores que as reais. A Posição é o gabarito: se a quantidade derivada dos
// lançamentos bate com ela, o histórico está completo; se não bate, o app mostra o que falta.
//
// Validado com extratos reais da B3 (13 meses de Negociação x Posição): 62 dos 71 ativos
// bateram exatamente, e as 9 diferenças tinham duas causas, ambas tratadas aqui:
//   1) negócios ainda NÃO LIQUIDADOS: a custódia só reflete o negócio em D+2 dias úteis;
//   2) posse ANTERIOR ao período exportado: falta um saldo inicial.
//
// REGRA: a Posição manda no que a pessoa tem. Só entram na conferência os ativos que ESTÃO na Posição.
// Ativo que não está nela tem quantidade zero em custódia (vendido, convertido, transferido): não há o que
// conferir nem corrigir, e ele não polui a lista. O que fica de fora é devolvido em `foraDaPosicao`, só
// para o painel reconhecer compras muito recentes que a custódia ainda não mostra (D+2).
//
// Por isso só existem DOIS resultados, sem "inconsistência": o ativo BATE (mesmo que os lançamentos mostrem
// MAIS do que a Posição: venda ou ajuste fora do histórico; a Posição manda e o preço médio não muda) ou
// FALTA o preço de compra de cotas que a Posição mostra e o histórico importado não explica.
//
// Módulo puro: sem rede, sem React.
import type { ItemPosicaoB3 } from './importacao/planilha'
import { ordenarLancamentos, somarDiasUteis, type Lancamento, type LancamentoNovo } from './lancamentos'

const EPS = 1e-6

export type StatusConferencia =
  /** O histórico explica a Posição (ou até mostra a mais: a Posição manda). O preço médio é confiável. */
  | 'confere'
  /** A Posição tem cotas cuja compra não está no histórico importado: falta o preço médio desse saldo. */
  | 'faltaSaldoAnterior'

export interface ItemConferencia {
  ativo: string
  status: StatusConferencia
  quantidadePosicao: number
  /** Quantidade dos lançamentos já liquidados na data da Posição. */
  quantidadeLancamentos: number
  /** Soma líquida de negócios feitos mas ainda não liquidados na data da Posição (informativo). */
  naoLiquidado: number
  /** Quantidade cujo preço de compra falta (só em faltaSaldoAnterior). */
  faltante: number
  /** Quanto os lançamentos liquidados somam A MAIS do que a Posição mostra (0 se não há). Só informativo: a Posição manda e o preço médio não muda. */
  excesso: number
  /** Dia útil anterior ao primeiro lançamento do ativo (ou do livro), para o saldo inicial entrar antes de tudo. A pessoa pode trocar. */
  dataSugeridaSaldo: string
  explicacao: string
}

/** Ativo com lançamentos que NÃO está na Posição: já foi zerado. Fica de fora da conferência. */
export interface ForaDaPosicao {
  ativo: string
  /** Soma líquida dos lançamentos já liquidados (informativa: pode estar errada se faltam vendas no histórico). */
  quantidadeLancamentos: number
  /** Compras (ou vendas) recentes que a custódia ainda não mostra. Se for > 0, é uma compra a caminho da custódia. */
  naoLiquidado: number
}

export interface Conferencia {
  dataPosicao: string
  /** Só ativos que estão na Posição. */
  itens: ItemConferencia[]
  resumo: Record<StatusConferencia, number>
  foraDaPosicao: ForaDaPosicao[]
}

type Evento = { data: string; tipo: Lancamento['tipo']; q: number; liquidado: boolean }

function eventoDe(l: Lancamento, limiteLiquidacao: string, dataPosicao: string): Evento | null {
  if (l.data > dataPosicao) return null // depois da foto: não faz parte dela
  switch (l.tipo) {
    case 'compra':
      return { data: l.data, tipo: l.tipo, q: l.quantidade, liquidado: l.data <= limiteLiquidacao }
    case 'venda':
      return { data: l.data, tipo: l.tipo, q: -l.quantidade, liquidado: l.data <= limiteLiquidacao }
    case 'saldoInicial':
    case 'bonificacao':
      return { data: l.data, tipo: l.tipo, q: l.quantidade, liquidado: true }
    case 'ajusteQuantidade':
      return { data: l.data, tipo: l.tipo, q: l.quantidade, liquidado: true }
    default:
      return null // proventos não mexem na quantidade
  }
}

const fmt = (n: number) => String(Number(n.toFixed(6)))

/** Ativos cuja Posição traz o valor aplicado em TODAS as linhas (Tesouro Direto): o custo vem da B3. */
export function ativosComValorAplicado(posicao: ItemPosicaoB3[]): Set<string> {
  const por = new Map<string, { soma: number; todos: boolean }>()
  for (const p of posicao) {
    const a = por.get(p.ativo) ?? { soma: 0, todos: true }
    if (p.valorAplicado === null || !(p.valorAplicado > 0)) a.todos = false
    else a.soma += p.valorAplicado
    por.set(p.ativo, a)
  }
  return new Set([...por].filter(([, a]) => a.todos && a.soma > 0).map(([ativo]) => ativo))
}

/**
 * @param dataPosicao data a que a Posição se refere (AAAA-MM-DD): o último pregão antes do download.
 * @param informados ativos cujo preço médio a PESSOA informou: não há mais o que pedir deles.
 *
 * O preço de compra também é conhecido, sem pedir nada, quando a própria Posição traz o VALOR APLICADO
 * (é o caso do Tesouro Direto): ele é o custo, informado pela B3.
 */
export function conferirComPosicao(lancamentos: Lancamento[], posicao: ItemPosicaoB3[], dataPosicao: string, informados: ReadonlySet<string> = new Set()): Conferencia {
  // Negócio feito no dia d só aparece na custódia em d + 2 dias úteis.
  const limiteLiquidacao = somarDiasUteis(dataPosicao, -2)

  const naPosicao = new Map<string, number>()
  for (const p of posicao) naPosicao.set(p.ativo, (naPosicao.get(p.ativo) ?? 0) + p.quantidade)
  const custoDaB3 = ativosComValorAplicado(posicao)

  const porAtivo = new Map<string, Lancamento[]>()
  for (const l of ordenarLancamentos(lancamentos)) {
    if (!porAtivo.has(l.ativo)) porAtivo.set(l.ativo, [])
    porAtivo.get(l.ativo)!.push(l)
  }

  // Ativo que está só na Posição não tem lançamento: o saldo anterior entra antes do início do livro.
  const inicioDoLivro = lancamentos.length ? [...lancamentos].map((l) => l.data).sort()[0] : null

  // Só o que está na Posição (com quantidade) entra: o resto já foi zerado e não interessa.
  const ativos = new Set([...naPosicao.entries()].filter(([, q]) => q > EPS).map(([a]) => a))
  const itens: ItemConferencia[] = []

  for (const ativo of ativos) {
    const ls = porAtivo.get(ativo) ?? []
    const eventos = ls.map((l) => eventoDe(l, limiteLiquidacao, dataPosicao)).filter((e): e is Evento => e !== null)
    const liquidados = eventos.filter((e) => e.liquidado)

    let correndo = 0
    let minimo = 0
    for (const e of liquidados) {
      correndo += e.q
      if (correndo < minimo) minimo = correndo
    }
    const liquido = correndo
    const naoLiquidado = eventos.filter((e) => !e.liquidado).reduce((s, e) => s + e.q, 0)
    const qPos = naPosicao.get(ativo) ?? 0

    // A Posição manda. Menor saldo ANTERIOR ao histórico que explica tudo: o que cobre a Posição e o que evita
    // o histórico ficar negativo no meio do caminho (vendeu antes de ter). Lançamentos a MAIS não pedem nada.
    const faltante = qPos - liquido
    const exigidoPeloHistorico = -minimo
    const saldoAnterior = Math.max(faltante, exigidoPeloHistorico, 0)
    const excesso = faltante < -EPS ? -faltante : 0
    const primeira = ls.length ? ls[0].data : inicioDoLivro
    const dataSugeridaSaldo = primeira ? somarDiasUteis(primeira, -1) : dataPosicao

    let status: StatusConferencia
    let explicacao: string
    if (saldoAnterior > EPS) {
      if (informados.has(ativo) || custoDaB3.has(ativo)) {
        // O preço médio já é conhecido (informado pela pessoa ou pelo valor aplicado da B3): nada a pedir.
        status = 'confere'
        explicacao = informados.has(ativo) ? 'O preço médio foi informado por você.' : 'O preço médio vem do valor aplicado informado pela B3.'
      } else {
        status = 'faltaSaldoAnterior'
        explicacao =
          ls.length === 0
            ? `Você tem ${fmt(qPos)} na Posição, mas nenhum lançamento: a compra é anterior ao período importado. Informe o preço médio para registrar o saldo inicial.`
            : `Faltam ${fmt(saldoAnterior)} que você já tinha antes do período importado. Informe o preço médio desse saldo ou importe um período mais longo.`
      }
    } else {
      status = 'confere'
      explicacao =
        excesso > EPS
          ? `Confere com a Posição, que é quem manda. Seus lançamentos mostram ${fmt(excesso)} a mais (uma venda ou ajuste fora do histórico). Isso não muda o preço médio.`
          : naoLiquidado !== 0
            ? `Confere com a Posição. ${fmt(Math.abs(naoLiquidado))} em negócios recentes ainda não liquidados (D+2) entram na custódia nos próximos dias.`
            : 'Confere com a Posição.'
    }

    itens.push({
      ativo,
      status,
      quantidadePosicao: qPos,
      quantidadeLancamentos: liquido,
      naoLiquidado,
      faltante: status === 'faltaSaldoAnterior' ? saldoAnterior : 0,
      excesso,
      dataSugeridaSaldo,
      explicacao,
    })
  }

  const ordem: Record<StatusConferencia, number> = { faltaSaldoAnterior: 0, confere: 1 }
  itens.sort((a, b) => ordem[a.status] - ordem[b.status] || a.ativo.localeCompare(b.ativo))

  const resumo: Conferencia['resumo'] = { confere: 0, faltaSaldoAnterior: 0 }
  for (const i of itens) resumo[i.status]++
  const foraDaPosicao: ForaDaPosicao[] = []
  for (const [ativo, ls] of porAtivo) {
    if (ativos.has(ativo)) continue
    const eventos = ls.map((l) => eventoDe(l, limiteLiquidacao, dataPosicao)).filter((e): e is Evento => e !== null)
    foraDaPosicao.push({
      ativo,
      quantidadeLancamentos: eventos.filter((e) => e.liquidado).reduce((s, e) => s + e.q, 0),
      naoLiquidado: eventos.filter((e) => !e.liquidado).reduce((s, e) => s + e.q, 0),
    })
  }
  foraDaPosicao.sort((a, b) => a.ativo.localeCompare(b.ativo))
  return { dataPosicao, itens, resumo, foraDaPosicao }
}

/** Transforma uma pendência da conferência em lançamento de saldo inicial, com o preço médio informado. */
export function criarSaldoInicial(item: ItemConferencia, precoMedio: number): LancamentoNovo | null {
  if (item.status !== 'faltaSaldoAnterior' || !(precoMedio > 0)) return null
  const quantidade = item.faltante
  return {
    data: item.dataSugeridaSaldo,
    tipo: 'saldoInicial',
    ativo: item.ativo,
    quantidade,
    preco: precoMedio,
    valor: quantidade * precoMedio,
    taxas: 0,
    origem: 'manual',
  }
}
