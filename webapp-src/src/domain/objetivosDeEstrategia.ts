import type { Modelo, ModeloId } from './modelosDeEstrategia'

/**
 * Por onde começar na aba Estratégias: a pessoa diz o que quer (renda, proteção, alta, baixa, ativo parado ou movimento forte)
 * e vê as estruturas que costumam servir àquele objetivo, cada uma com a razão. Descritivo: não é recomendação de operação.
 */

export type ObjetivoId = 'renda' | 'protecao' | 'alta' | 'baixa' | 'parado' | 'movimento'

export interface Objetivo {
  id: ObjetivoId
  titulo: string
  /** Frase na voz da pessoa, para ela se reconhecer. */
  frase: string
  /** Como o objetivo costuma ser buscado com opções, em poucas linhas. */
  resumo: string
  /** Estruturas que combinam, com a razão de cada uma. */
  modelos: { id: ModeloId; porque: string }[]
  /** Aviso próprio do objetivo, quando houver. */
  cuidado?: string
}

export const OBJETIVOS: Objetivo[] = [
  {
    id: 'renda', titulo: 'Renda com prêmios', frase: 'Quero receber prêmios todo mês',
    resumo: 'A renda vem de vender opções e receber o prêmio. Quem vende assume um risco, e o prêmio é o que o mercado paga por ele: quanto maior o prêmio, em geral, maior o risco.',
    modelos: [
      { id: 'vendaCoberta', porque: 'Você já tem as ações e vende uma call: recebe o prêmio e abre mão da alta acima do strike.' },
      { id: 'travaAltaPut', porque: 'Vende uma put e compra outra mais baixa: recebe crédito, com a perda limitada pela proteção.' },
      { id: 'travaBaixaCall', porque: 'Vende uma call e compra outra mais alta: recebe crédito se o ativo não subir muito, com a perda limitada.' },
      { id: 'condorFerro', porque: 'Recebe crédito se o ativo ficar numa faixa, com perda e ganho limitados nas duas pontas.' },
      { id: 'borboletaFerro', porque: 'Recebe crédito com o ativo parado perto de um strike; risco limitado pelas asas.' },
      { id: 'putOtimizada', porque: 'Soma o crédito de uma trava de baixa com calls ao da put vendida; o risco de baixo continua o da put.' },
      { id: 'slidePut', porque: 'Com duas puts vendidas e uma comprada, sai com crédito ou custo baixo; arrisca se o ativo cair abaixo dos strikes vendidos.' },
      { id: 'thlCall', porque: 'A "malha de renda": vende a call curta contra uma longa e repete a cada vencimento, colhendo o valor de tempo.' },
    ],
    cuidado: 'Para comprar uma ação com desconto, recebendo prêmio enquanto espera, veja a aba Roda. Nenhuma estrutura garante renda: ela só mostra o que se recebe no cenário bom e o que se perde no ruim.',
  },
  {
    id: 'protecao', titulo: 'Proteger o que já tenho', frase: 'Tenho ações e quero limitar a perda',
    resumo: 'Proteger é comprar uma put: ela ganha valor se o ativo cair. O custo da proteção pode ser reduzido vendendo uma call, ao preço de limitar o ganho.',
    modelos: [
      { id: 'collar', porque: 'Compra a put de proteção e vende uma call para pagar parte dela: limita a perda e também o ganho.' },
      { id: 'vendaCoberta', porque: 'Não protege da queda, mas o prêmio recebido amortece uma queda pequena.' },
      { id: 'booster', porque: 'Para quem aceita arriscar mais na queda em troca de ganhar mais na alta (tem put vendida).' },
    ],
    cuidado: 'A put comprada sozinha, a proteção mais simples, se monta em Séries da B3, com o botão C.',
  },
  {
    id: 'alta', titulo: 'Apostar na alta', frase: 'Acho que o ativo vai subir',
    resumo: 'Dá para apostar na alta comprando call, ou com uma trava, que custa menos, mas limita o ganho.',
    modelos: [
      { id: 'travaAltaCall', porque: 'Compra uma call e vende outra mais alta: custa menos que a call seca; ganho e perda limitados.' },
      { id: 'travaAltaPut', porque: 'Vende uma put e compra outra mais baixa: ganha se o ativo subir ou ficar parado, e recebe crédito.' },
      { id: 'bullishRiskReversal', porque: 'Vende uma put abaixo e compra uma call acima: costuma sair com crédito ou sem custo e deixa espaço para o ativo andar; arrisca se ele cair abaixo da put vendida.' },
      { id: 'diagonalCall', porque: 'Compra uma call longa e vende uma curta mais alta: combina a trava de alta com a colheita do valor de tempo.' },
      { id: 'booster', porque: 'Para quem já tem as ações: dobra o ganho dentro de uma faixa de alta, financiado por uma put vendida.' },
      { id: 'slidePut', porque: 'Lucra com o ativo parado ou subindo; tem risco se ele cair abaixo dos strikes vendidos.' },
    ],
    cuidado: 'A compra de uma call seca, a mais simples, se monta em Séries da B3, com o botão C.',
  },
  {
    id: 'baixa', titulo: 'Apostar na queda', frase: 'Acho que o ativo vai cair',
    resumo: 'Dá para apostar na queda comprando put, ou com uma trava, que custa menos e limita o ganho.',
    modelos: [
      { id: 'travaBaixaPut', porque: 'Compra uma put e vende outra mais baixa: custa menos que a put seca; ganho e perda limitados.' },
      { id: 'travaBaixaCall', porque: 'Vende uma call e compra outra mais alta: ganha se o ativo cair ou ficar parado, e recebe crédito.' },
      { id: 'bearishRiskReversal', porque: 'Vende uma call acima e compra uma put abaixo: costuma sair com crédito ou sem custo e deixa espaço para o ativo andar; arrisca se ele subir acima da call vendida.' },
      { id: 'diagonalPut', porque: 'Compra uma put longa e vende uma curta mais baixa: trava de baixa com a colheita do valor de tempo.' },
      { id: 'collar', porque: 'Para quem tem as ações e teme a queda: a put limita a perda.' },
    ],
    cuidado: 'A compra de uma put seca se monta em Séries da B3, com o botão C.',
  },
  {
    id: 'parado', titulo: 'Lucrar com o ativo parado', frase: 'Acho que o ativo vai ficar numa faixa',
    resumo: 'Estruturas que ganham quando o ativo termina perto de um preço ou dentro de uma faixa, e perdem se ele se afastar muito.',
    modelos: [
      { id: 'borboletaCall', porque: 'Ganha mais se o ativo terminar no strike do meio; custa pouco e o risco é o débito.' },
      { id: 'borboletaPut', porque: 'Igual à de calls, com puts.' },
      { id: 'borboletaFerro', porque: 'Recebe crédito; ganho máximo com o ativo parado, risco limitado pelas asas.' },
      { id: 'condorFerro', porque: 'Recebe crédito se o ativo ficar numa faixa mais larga que a da borboleta.' },
      { id: 'condorCall', porque: 'Ganha se o ativo terminar entre os strikes do meio; débito pequeno.' },
      { id: 'thlCall', porque: 'Lucra com a call curta perdendo valor mais rápido que a longa, com o ativo perto do strike.' },
      { id: 'thlPut', porque: 'O mesmo, com puts.' },
    ],
  },
  {
    id: 'movimento', titulo: 'Lucrar com movimento forte', frase: 'Acho que vai se mexer muito, mas não sei para que lado',
    resumo: 'Estruturas que ganham quando o ativo anda bastante, para qualquer lado (por exemplo, antes de um resultado trimestral). Se ele ficar parado, perde-se o que foi pago.',
    modelos: [
      { id: 'straddleComprado', porque: 'Compra call e put no mesmo strike: ganha com movimento grande; a perda é o prêmio pago.' },
      { id: 'strangleComprado', porque: 'Compra put abaixo e call acima: mais barato que o straddle, exige um movimento maior.' },
      { id: 'strangleFinanciado', porque: 'Strangle com opções mais afastadas vendidas para pagar parte dele: custa menos, mas o ganho tem teto.' },
    ],
    cuidado: 'Antes de eventos, as opções costumam estar caras (volatilidade implícita alta): se o movimento vier menor que o esperado, o resultado pode ser prejuízo mesmo com o ativo andando.',
  },
]

export interface PerfilDoModelo {
  rotulo: string
  /** 'atencao' pede cuidado (risco grande); 'info' é informação neutra; 'limitado' é risco com teto. */
  tom: 'atencao' | 'info' | 'limitado'
}

/** Etiqueta curta do perfil de risco de um modelo, para a pessoa comparar antes de escolher. */
export function perfilDoModelo(m: Modelo): PerfilDoModelo {
  if (m.aviso) return { rotulo: 'Risco grande se for contra', tom: 'atencao' }
  if (m.comAcoes) return { rotulo: 'Exige ter as ações', tom: 'info' }
  if (m.pernas.some((p) => p.longa)) return { rotulo: 'Vencimentos diferentes (resultado estimado)', tom: 'info' }
  if (m.id === 'straddleComprado' || m.id === 'strangleComprado') return { rotulo: 'Perda limitada ao prêmio pago', tom: 'limitado' }
  return { rotulo: 'Ganho e perda limitados', tom: 'limitado' }
}
