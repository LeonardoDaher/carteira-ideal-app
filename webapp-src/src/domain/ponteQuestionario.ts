/**
 * Ponte entre o Meu Mês e o questionário da Carteira Ideal (D21, Etapa 4).
 *
 * Lê o que a pessoa anotou no Meu Mês e diz qual opção dos Pilares 1 e 2 da Arquitetura
 * Patrimonial combina com esses números, e por quê. É **sugestão, não preenchimento
 * automático**: nada é marcado sozinho, a resposta continua sendo da pessoa, e o orçamento
 * nunca vai para a API (só a letra que ela mesma escolher, como sempre).
 *
 * Funções puras. As faixas vêm de `sugestaoPilar1` e `sugestaoPilar2` (orcamento.ts), para
 * que a tela do Meu Mês e o questionário nunca discordem.
 */
import { reais } from './mercadoOficial'
import { custoMensalDeVida, mesesDeReserva, recuperacaoDe, sugestaoPilar1, sugestaoPilar2 } from './orcamento'
import type { Orcamento } from './orcamento'
import { LIMIAR_JUROS_CARO, ehDividaCaraParaOPilar2 } from './recuperacao'

export type LetraSugerida = 'a' | 'b' | 'c'

export type SugestaoDoMeuMes = {
  letra: LetraSugerida
  /** Frase curta, em segunda pessoa, com os números que levaram à sugestão. */
  motivo: string
}

/** Só os dois pilares que o Meu Mês consegue medir. As chaves são os ids das perguntas. */
export type SugestoesDoMeuMes = {
  capacidadeFinanceira?: SugestaoDoMeuMes
  passivoDividas?: SugestaoDoMeuMes
}

/** O Meu Mês foi usado de verdade? Sem salário, contas ou dívidas, não há o que sugerir. */
export function meuMesTemDados(orc: Orcamento): boolean {
  return orc.salario > 0 || orc.contas.length > 0 || recuperacaoDe(orc).dividas.length > 0
}

/** Em português, quantidades abaixo de 2 ficam no singular: "0,3 mês", "1,5 mês", "2 meses". */
function numeroDeMeses(meses: number): string {
  const texto = meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${texto} ${meses < 2 ? 'mês' : 'meses'}`
}

function porcentagem(parte: number, todo: number): string {
  return `${Math.round((parte / todo) * 100)}%`
}

function motivoPilar1(orc: Orcamento): string {
  const custo = reais(custoMensalDeVida(orc))
  const meses = mesesDeReserva(orc) ?? 0
  if (orc.reserva <= 0) {
    return `No Meu Mês, sua reserva está zerada e o custo de vida é de ${custo} por mês.`
  }
  return `No Meu Mês, sua reserva de ${reais(orc.reserva)} paga ${numeroDeMeses(meses)} do seu custo de vida (${custo} por mês).`
}

function motivoPilar2(orc: Orcamento, letra: LetraSugerida): string {
  const abertas = recuperacaoDe(orc).dividas.filter((d) => d.saldo > 0)
  if (letra === 'a') {
    const caras = abertas.filter(ehDividaCaraParaOPilar2).length
    const quantas = caras === 1 ? 'uma dívida cara' : `${caras} dívidas caras`
    return `No Meu Mês você anotou ${quantas} (cartão, cheque especial, empréstimo pessoal ou juros de ${LIMIAR_JUROS_CARO}% ao mês ou mais).`
  }
  const parteDoSalario = porcentagem(custoMensalDeVida(orc), orc.salario)
  if (abertas.length > 0) {
    return `No Meu Mês, suas dívidas têm juros abaixo de ${LIMIAR_JUROS_CARO}% ao mês (como financiamento, consignado ou dívida em dólar) e o custo de vida é ${parteDoSalario} do salário.`
  }
  return letra === 'c'
    ? `No Meu Mês você não tem dívidas e o custo de vida é ${parteDoSalario} do salário, até a metade.`
    : `No Meu Mês você não tem dívidas, mas o custo de vida é ${parteDoSalario} do salário, acima da metade.`
}

export function sugestoesDoMeuMes(orc: Orcamento): SugestoesDoMeuMes {
  if (!meuMesTemDados(orc)) return {}
  const sugestoes: SugestoesDoMeuMes = {}

  const p1 = sugestaoPilar1(orc)
  if (p1) sugestoes.capacidadeFinanceira = { letra: p1, motivo: motivoPilar1(orc) }

  const p2 = sugestaoPilar2(orc)
  if (p2) sugestoes.passivoDividas = { letra: p2, motivo: motivoPilar2(orc, p2) }

  return sugestoes
}
