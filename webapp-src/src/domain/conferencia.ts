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
// Módulo puro: sem rede, sem React.
import type { ItemPosicaoB3 } from './importacao/planilha'
import { ordenarLancamentos, somarDiasUteis, type Lancamento, type LancamentoNovo } from './lancamentos'

const EPS = 1e-6

export type StatusConferencia =
  /** A quantidade dos lançamentos liquidados é igual à da Posição. */
  | 'confere'
  /** Falta histórico anterior: sugere um saldo inicial com a quantidade que falta. */
  | 'faltaSaldoAnterior'
  /** Não dá para explicar por saldo anterior (ex.: lançamentos a mais que a custódia). Exige revisão. */
  | 'inconsistente'

export interface ItemConferencia {
  ativo: string
  status: StatusConferencia
  quantidadePosicao: number
  /** Quantidade dos lançamentos já liquidados na data da Posição. */
  quantidadeLancamentos: number
  /** Soma líquida de negócios feitos mas ainda não liquidados na data da Posição (informativo). */
  naoLiquidado: number
  /** Quantidade que falta (só em faltaSaldoAnterior). */
  faltante: number
  /** Dia útil anterior ao primeiro lançamento do ativo (ou do livro), para o saldo inicial entrar antes de tudo. A pessoa pode trocar. */
  dataSugeridaSaldo: string
  explicacao: string
}

export interface Conferencia {
  dataPosicao: string
  itens: ItemConferencia[]
  resumo: Record<StatusConferencia, number>
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

/**
 * @param dataPosicao data a que a Posição se refere (AAAA-MM-DD): o último pregão antes do download.
 */
export function conferirComPosicao(lancamentos: Lancamento[], posicao: ItemPosicaoB3[], dataPosicao: string): Conferencia {
  // Negócio feito no dia d só aparece na custódia em d + 2 dias úteis.
  const limiteLiquidacao = somarDiasUteis(dataPosicao, -2)

  const naPosicao = new Map<string, number>()
  for (const p of posicao) naPosicao.set(p.ativo, (naPosicao.get(p.ativo) ?? 0) + p.quantidade)

  const porAtivo = new Map<string, Lancamento[]>()
  for (const l of ordenarLancamentos(lancamentos)) {
    if (!porAtivo.has(l.ativo)) porAtivo.set(l.ativo, [])
    porAtivo.get(l.ativo)!.push(l)
  }

  // Ativo que está só na Posição não tem lançamento: o saldo anterior entra antes do início do livro.
  const inicioDoLivro = lancamentos.length ? [...lancamentos].map((l) => l.data).sort()[0] : null

  const ativos = new Set([...naPosicao.keys(), ...porAtivo.keys()])
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

    // Saldo anterior ao primeiro lançamento que faria a conta fechar com a Posição.
    const faltante = qPos - liquido
    const exigidoPeloHistorico = -minimo // quanto era preciso ter antes para nunca ficar negativo
    const primeira = ls.length ? ls[0].data : inicioDoLivro
    const dataSugeridaSaldo = primeira ? somarDiasUteis(primeira, -1) : dataPosicao

    let status: StatusConferencia
    let explicacao: string
    if (Math.abs(faltante) <= EPS && exigidoPeloHistorico <= EPS) {
      status = 'confere'
      explicacao =
        naoLiquidado !== 0
          ? `Confere com a Posição. ${fmt(Math.abs(naoLiquidado))} em negócios recentes ainda não liquidados (D+2) entram na custódia nos próximos dias.`
          : 'Confere com a Posição.'
    } else if (faltante > EPS && faltante + EPS >= exigidoPeloHistorico) {
      status = 'faltaSaldoAnterior'
      explicacao =
        ls.length === 0
          ? `Você tem ${fmt(qPos)} na Posição, mas nenhum lançamento: a compra é anterior ao período importado. Informe o preço médio para registrar o saldo inicial.`
          : `Faltam ${fmt(faltante)} que você já tinha antes do período importado. Informe o preço médio desse saldo ou importe um período mais longo.`
    } else {
      status = 'inconsistente'
      explicacao =
        faltante < -EPS
          ? `Os lançamentos somam ${fmt(liquido)} e a Posição mostra ${fmt(qPos)}: há ${fmt(-faltante)} a mais nos lançamentos. Confira transferências entre corretoras, lançamentos repetidos ou vendas já registradas.`
          : `As vendas superam o que os lançamentos justificam e o saldo anterior necessário (${fmt(exigidoPeloHistorico)}) é maior que a diferença com a Posição (${fmt(Math.max(faltante, 0))}). Revise os lançamentos deste ativo.`
    }

    itens.push({
      ativo,
      status,
      quantidadePosicao: qPos,
      quantidadeLancamentos: liquido,
      naoLiquidado,
      faltante: status === 'faltaSaldoAnterior' ? faltante : 0,
      dataSugeridaSaldo,
      explicacao,
    })
  }

  const ordem: Record<StatusConferencia, number> = { inconsistente: 0, faltaSaldoAnterior: 1, confere: 2 }
  itens.sort((a, b) => ordem[a.status] - ordem[b.status] || a.ativo.localeCompare(b.ativo))

  const resumo: Conferencia['resumo'] = { confere: 0, faltaSaldoAnterior: 0, inconsistente: 0 }
  for (const i of itens) resumo[i.status]++
  return { dataPosicao, itens, resumo }
}

/** Transforma uma sugestão da conferência em lançamento de saldo inicial, com o preço médio informado. */
export function criarSaldoInicial(item: ItemConferencia, precoMedio: number): LancamentoNovo | null {
  if (item.status !== 'faltaSaldoAnterior' || !(precoMedio > 0)) return null
  return {
    data: item.dataSugeridaSaldo,
    tipo: 'saldoInicial',
    ativo: item.ativo,
    quantidade: item.faltante,
    preco: precoMedio,
    valor: item.faltante * precoMedio,
    taxas: 0,
    origem: 'manual',
  }
}
