import type { SerieOpcao } from './opcoes'
import { DIAS_UTEIS_ANO, chanceDeExercicio, precoBs, volatilidadeImplicita } from './simulaOpcoes'

/**
 * A "roda" (wheel): vende-se uma put coberta por caixa até ser exercida; com as ações em carteira, vende-se uma call coberta
 * até ser exercida; vendidas as ações, volta-se à put. Aqui só os números de UM giro: o passo da put e, se ela for exercida,
 * o passo da call. O prêmio da call é uma ESTIMATIVA: ele só será conhecido quando a put for exercida, com o ativo no strike
 * da put (e não no preço de hoje), então a série escolhida é valorizada por Black-Scholes nesse cenário, com a volatilidade
 * implícita do último preço dela. Tudo descritivo, sem indicar operação.
 */

/** Dias úteis de um mês de negociação, usados para comparar prêmios de prazos diferentes. */
export const DIAS_UTEIS_NO_MES = 21

export interface PassoDaPut {
  /** Dinheiro que fica reservado até o vencimento: strike × quantidade. */
  caixa: number
  /** Prêmio recebido, em reais. */
  premioTotal: number
  /** Prêmio sobre o caixa, no prazo da opção. */
  rendimentoNoPrazo: number
  /** O mesmo rendimento levado a 21 dias úteis pela regra de três (só para comparar; não é previsão). */
  rendimentoPorMes: number
  /** Preço efetivo de compra se for exercida: strike menos o prêmio, por ação. */
  custoEfetivo: number
  /** Quanto o custo efetivo está abaixo do preço de hoje (positivo = "desconto"). */
  descontoSobreAtivo: number
  /** Chance de a put terminar dentro do dinheiro (e ser exercida), pelo modelo e pela volatilidade implícita; null se não calculável. */
  chanceDeExercicio: number | null
  /** Volatilidade implícita do preço da put (ex.: 0,32), ou null. */
  volatilidade: number | null
}

export function passoDaPut(put: SerieOpcao, preco: number, dias: number, r: number, quantidade: number): PassoDaPut {
  const caixa = put.strike * quantidade
  const premioTotal = put.ultimo * quantidade
  const rendimentoNoPrazo = caixa > 0 ? premioTotal / caixa : 0
  const t = dias / DIAS_UTEIS_ANO
  const vol = dias > 0 ? volatilidadeImplicita({ tipo: 'put', s: preco, strike: put.strike, t, r }, put.ultimo) : null
  return {
    caixa,
    premioTotal,
    rendimentoNoPrazo,
    rendimentoPorMes: dias > 0 ? rendimentoNoPrazo * (DIAS_UTEIS_NO_MES / dias) : 0,
    custoEfetivo: put.strike - put.ultimo,
    descontoSobreAtivo: preco > 0 ? (preco - (put.strike - put.ultimo)) / preco : 0,
    chanceDeExercicio: vol ? chanceDeExercicio({ tipo: 'put', s: preco, strike: put.strike, t, r, sigma: vol }) : null,
    volatilidade: vol,
  }
}

export interface PassoDaCall {
  /** Prêmio estimado por ação, com o ativo no strike da put quando a call é vendida. */
  premioEstimado: number
  premioTotal: number
  /** Dias úteis entre o vencimento da put e o da call. */
  diasDaCall: number
  /** Volatilidade implícita usada, ou a padrão quando a série não tem implícita. */
  volatilidade: number
  /** Chance de a call terminar dentro do dinheiro (ações vendidas), partindo do strike da put. */
  chanceDeExercicio: number
  /** Ganho do giro completo se a put e a call forem exercidas: (strike da call − strike da put + prêmios) × quantidade. */
  ganhoDoGiroCompleto: number
  /** Giro completo sobre o caixa da put. */
  rendimentoDoGiroCompleto: number
  /** Preço do ativo abaixo do qual a posição (ações mais prêmios das duas pontas) perde dinheiro: strike da put − prêmios. */
  equilibrioDasAcoes: number
}

/**
 * Passo da call depois de a put ser exercida. `diasPut` e `diasCall` são dias úteis de hoje até o vencimento de cada uma;
 * `chamadaHoje` é a série da call, cujo último preço calibra a volatilidade.
 */
export function passoDaCall(
  call: SerieOpcao, put: SerieOpcao, preco: number, diasPut: number, diasCall: number, r: number, quantidade: number, volatilidadePadrao = 0.35,
): PassoDaCall {
  const restante = Math.max(diasCall - diasPut, 1)
  const vol = (diasCall > 0 ? volatilidadeImplicita({ tipo: 'call', s: preco, strike: call.strike, t: diasCall / DIAS_UTEIS_ANO, r }, call.ultimo) : null) ?? volatilidadePadrao
  const t = restante / DIAS_UTEIS_ANO
  const premioEstimado = precoBs({ tipo: 'call', s: put.strike, strike: call.strike, t, r, sigma: vol })
  const ganhoPorAcao = call.strike - put.strike + put.ultimo + premioEstimado
  const caixa = put.strike * quantidade
  return {
    premioEstimado,
    premioTotal: premioEstimado * quantidade,
    diasDaCall: restante,
    volatilidade: vol,
    chanceDeExercicio: chanceDeExercicio({ tipo: 'call', s: put.strike, strike: call.strike, t, r, sigma: vol }),
    ganhoDoGiroCompleto: ganhoPorAcao * quantidade,
    rendimentoDoGiroCompleto: caixa > 0 ? (ganhoPorAcao * quantidade) / caixa : 0,
    equilibrioDasAcoes: put.strike - put.ultimo - premioEstimado,
  }
}
