import { diasUteis, montarLinha } from './opcoes'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'
import { DIAS_UTEIS_ANO, analisar, custoDeMontagem, resultadoNoVencimento } from './simulaOpcoes'
import type { Lado, Perna, Posicao } from './simulaOpcoes'
import type { Visao } from './tendencia'

// Motor de estruturas por visão de mercado (aba "Tendência"). Para um ativo, um vencimento e uma visão (alta,
// baixa, lateral ou muita oscilação), monta as estruturas que combinam com a visão usando as séries reais do último pregão e
// mede cada candidata: custo ou crédito, ganho e perda máximos, equilíbrios, chance de lucro e retorno no cenário.
//
// Sobre "melhor": no modelo de preços, nenhuma estrutura tem vantagem esperada (a esperança do resultado, no mundo neutro ao
// risco, é o custo de montar). O que muda de uma para outra é o PERFIL: quanto se arrisca, quanto se pode ganhar e com que
// chance. Por isso o motor não elege uma "melhor": ordena por um critério que a pessoa escolhe e mostra os três números.
// Só estruturas de risco limitado entram (não há strangle vendido nem call descoberta).

export type EstruturaId =
  | 'compraCall' | 'travaAltaDebito' | 'travaAltaCredito' | 'vendaPut'
  | 'compraPut' | 'travaBaixaDebito' | 'travaBaixaCredito'
  | 'condorDeFerro' | 'borboleta' | 'vendaCoberta'
  | 'straddleComprado' | 'strangleComprado'
  | 'borboletaPut' | 'borboletaFerro' | 'condorCall' | 'putOtimizada' | 'slidePut'
  | 'strangleFinanciado' | 'collar' | 'booster'
  | 'bullishRiskReversal' | 'bearishRiskReversal'

export interface InfoEstrutura {
  id: EstruturaId
  titulo: string
  descricao: string
  /** Etiquetas do perfil: crédito ou débito, e como o risco é limitado. */
  perfil: string[]
}

export const ESTRUTURAS: Record<EstruturaId, InfoEstrutura> = {
  compraCall: { id: 'compraCall', titulo: 'Compra de call', descricao: 'Aposta na alta com pouco dinheiro. O ganho não tem teto; a perda é o prêmio pago.', perfil: ['Débito', 'Perda limitada ao prêmio'] },
  travaAltaDebito: { id: 'travaAltaDebito', titulo: 'Trava de alta com calls', descricao: 'Compra uma call e vende outra de strike maior: custa menos que a call seca, mas o ganho tem teto.', perfil: ['Débito', 'Ganho e perda limitados'] },
  travaAltaCredito: { id: 'travaAltaCredito', titulo: 'Trava de alta com puts', descricao: 'Vende uma put e compra outra de strike menor: recebe prêmio e ganha se o ativo não cair abaixo do strike vendido.', perfil: ['Crédito', 'Ganho e perda limitados'] },
  vendaPut: { id: 'vendaPut', titulo: 'Venda de put', descricao: 'Recebe prêmio e pode ter de comprar o ativo pelo strike. Exige o dinheiro do strike reservado.', perfil: ['Crédito', 'Perda limitada ao strike menos o prêmio'] },
  compraPut: { id: 'compraPut', titulo: 'Compra de put', descricao: 'Aposta na queda ou protege uma carteira. O ganho cresce até o ativo zerar; a perda é o prêmio pago.', perfil: ['Débito', 'Perda limitada ao prêmio'] },
  travaBaixaDebito: { id: 'travaBaixaDebito', titulo: 'Trava de baixa com puts', descricao: 'Compra uma put e vende outra de strike menor: custa menos que a put seca, mas o ganho tem teto.', perfil: ['Débito', 'Ganho e perda limitados'] },
  travaBaixaCredito: { id: 'travaBaixaCredito', titulo: 'Trava de baixa com calls', descricao: 'Vende uma call e compra outra de strike maior: recebe prêmio e ganha se o ativo não subir acima do strike vendido.', perfil: ['Crédito', 'Ganho e perda limitados'] },
  condorDeFerro: { id: 'condorDeFerro', titulo: 'Condor de ferro', descricao: 'Vende uma put e uma call afastadas do preço e compra as asas de proteção. Ganha se o ativo ficar dentro de uma faixa.', perfil: ['Crédito', 'Ganho e perda limitados', '4 séries'] },
  borboleta: { id: 'borboleta', titulo: 'Borboleta com calls', descricao: 'Compra uma call, vende duas do meio e compra outra acima. Ganha mais se o ativo terminar exatamente no strike do meio.', perfil: ['Débito', 'Ganho e perda limitados', '3 séries'] },
  vendaCoberta: { id: 'vendaCoberta', titulo: 'Venda coberta', descricao: 'Para quem já tem a ação: vende uma call, recebe prêmio e abre mão da alta acima do strike.', perfil: ['Crédito', 'Exige ter a ação'] },
  straddleComprado: { id: 'straddleComprado', titulo: 'Straddle comprado', descricao: 'Compra call e put do mesmo strike. Ganha se o ativo se mexer bastante, para qualquer lado.', perfil: ['Débito', 'Perda limitada ao prêmio'] },
  strangleComprado: { id: 'strangleComprado', titulo: 'Strangle comprado', descricao: 'Compra uma put abaixo e uma call acima do preço. Mais barato que o straddle, exige um movimento maior.', perfil: ['Débito', 'Perda limitada ao prêmio'] },
  borboletaPut: { id: 'borboletaPut', titulo: 'Borboleta com puts', descricao: 'Compra uma put abaixo, vende duas no meio e compra outra acima. Igual à de calls: ganha mais se o ativo terminar no strike do meio.', perfil: ['Débito', 'Ganho e perda limitados', '3 séries'] },
  borboletaFerro: { id: 'borboletaFerro', titulo: 'Borboleta de ferro', descricao: 'Vende uma call e uma put no mesmo strike e compra uma call acima e uma put abaixo como proteção. Recebe crédito e ganha mais com o ativo parado.', perfil: ['Crédito', 'Ganho e perda limitados', '4 séries'] },
  condorCall: { id: 'condorCall', titulo: 'Condor com calls', descricao: 'Compra uma call baixa, vende duas intermediárias e compra uma alta. Ganha se o ativo terminar entre os strikes do meio.', perfil: ['Débito', 'Ganho e perda limitados', '4 séries'] },
  putOtimizada: { id: 'putOtimizada', titulo: 'Put vendida otimizada', descricao: 'Vende uma put e uma trava de baixa com calls. O crédito das calls soma ao da put; o risco de baixo continua o da put vendida.', perfil: ['Crédito', 'Perda limitada ao strike menos o crédito', '3 séries'] },
  slidePut: { id: 'slidePut', titulo: 'Slide com put', descricao: 'Compra uma put de strike maior e vende duas de strikes menores. Sai com crédito ou custo baixo e lucra com o ativo parado ou caindo pouco; arrisca se ele cair abaixo dos strikes vendidos.', perfil: ['Crédito ou custo baixo', 'Perda limitada ao strike menos o crédito', '3 séries'] },
  strangleFinanciado: { id: 'strangleFinanciado', titulo: 'Strangle comprado financiado', descricao: 'Compra um strangle e vende opções mais afastadas para pagar parte dele: custa menos, mas o ganho também tem teto.', perfil: ['Débito', 'Ganho e perda limitados', '4 séries'] },
  collar: { id: 'collar', titulo: 'Collar', descricao: 'Para quem já tem a ação: compra uma put de proteção e vende uma call para pagar parte dela. Limita a perda e também o ganho.', perfil: ['Exige ter a ação', 'Ganho e perda limitados'] },
  bullishRiskReversal: { id: 'bullishRiskReversal', titulo: 'Bullish Risk Reversal', descricao: 'Vende uma put abaixo do preço e compra uma call acima, no mesmo vencimento. Aposta na alta: costuma sair com crédito ou perto de zero, e o ativo tem espaço para andar entre os dois strikes. Ganha com a alta acima da call; abaixo da put vendida, a perda cresce até o ativo zerar.', perfil: ['Crédito ou custo baixo', 'Perda limitada ao strike menos o crédito', '2 séries'] },
  bearishRiskReversal: { id: 'bearishRiskReversal', titulo: 'Bearish Risk Reversal', descricao: 'Vende uma call acima do preço e compra uma put abaixo, no mesmo vencimento. Aposta na queda: costuma sair com crédito ou perto de zero, e o ativo tem espaço entre os dois strikes. Ganha com a queda abaixo da put; acima da call vendida, a perda NÃO tem limite.', perfil: ['Crédito ou custo baixo', 'Perda sem limite se o ativo subir', '2 séries'] },
  booster: { id: 'booster', titulo: 'Booster', descricao: 'Para quem já tem a ação: compra uma call perto do preço, vende outra acima e paga o débito com uma put vendida abaixo. Dobra a alta dentro da faixa; abaixo da put, a perda aumenta.', perfil: ['Exige ter a ação', 'Débito próximo de zero', '3 séries'] },
}

/** Estruturas que combinam com cada visão, na ordem em que aparecem na tela. */
export const ESTRUTURAS_DA_VISAO: Record<Visao, EstruturaId[]> = {
  alta: ['compraCall', 'travaAltaDebito', 'travaAltaCredito', 'vendaPut', 'bullishRiskReversal', 'slidePut', 'booster'],
  baixa: ['compraPut', 'travaBaixaDebito', 'travaBaixaCredito', 'bearishRiskReversal', 'collar'],
  lateral: ['condorDeFerro', 'borboleta', 'borboletaPut', 'borboletaFerro', 'condorCall', 'putOtimizada', 'vendaCoberta'],
  oscilacao: ['straddleComprado', 'strangleComprado', 'strangleFinanciado'],
}

/** Estruturas que, ao serem enviadas à aba Estratégias, abrem o modelo correspondente (as pernas seguem a ordem do modelo). */
export const MODELO_DA_ESTRUTURA: Partial<Record<EstruturaId, 'collar' | 'booster' | 'bullishRiskReversal' | 'bearishRiskReversal'>> = {
  collar: 'collar', booster: 'booster', bullishRiskReversal: 'bullishRiskReversal', bearishRiskReversal: 'bearishRiskReversal',
}

/**
 * Estruturas que, por definição, têm perda sem limite (call vendida sem ter o ativo). As demais só entram com risco limitado. O risco usado nas
 * contas de retorno é, então, a perda com o ativo 50% acima do preço de hoje, e a tela mostra "Sem limite" na perda máxima.
 */
export const ESTRUTURAS_DE_RISCO_ILIMITADO: EstruturaId[] = ['bearishRiskReversal']
export const ALTA_DE_REFERENCIA = 0.5

export interface PernaCandidata {
  serie: SerieOpcao
  lado: Lado
  /** Múltiplo da quantidade base (a borboleta vende 2x a série do meio). */
  fator: number
}

export interface Candidata {
  estrutura: EstruturaId
  pernas: PernaCandidata[]
  /** Venda coberta: a estrutura inclui ter a ação. */
  comAcoes: boolean
  vencimento: string
  diasUteis: number
  quantidade: number
  /** Dinheiro ao montar as opções, em R$: positivo = recebe (crédito), negativo = paga (débito). */
  credito: number
  ganhoMaximo: number | null
  /** Valor negativo; null (sem limite) só nas estruturas de ESTRUTURAS_DE_RISCO_ILIMITADO. */
  perdaMaxima: number | null
  /** Risco em R$ (positivo) usado no retorno no cenário: a perda máxima ou, sem limite, a perda com o ativo 50% acima. */
  riscoReferencia: number
  equilibrios: number[]
  /** Chance de a operação terminar no lucro, em %, pelo modelo (neutro ao risco, com a volatilidade implícita das séries). */
  chanceDeLucro: number
  /** Volatilidade implícita média das séries usadas, % ao ano. */
  volImplicita: number
  /** Resultado (R$) com o ativo a um desvio-padrão do período a favor da visão (parado, na lateral). */
  resultadoNoCenario: number
  /** Resultado no cenário dividido pelo risco (perda máxima), em %. */
  retornoNoCenario: number
  /** Tamanho do movimento do cenário, em % do preço (0 na lateral). */
  movimentoDoCenario: number
  negociosMinimos: number
}

export type CriterioIdeia = 'chance' | 'retorno' | 'risco'

export interface ParametrosIdeias {
  vencimento: string
  /** Data do último pregão, AAAA-MM-DD. */
  hoje: string
  jurosAnual: number
  /** Quantidade base de opções (o pacote da tela). */
  quantidade?: number
  /** Negócios mínimos de cada série usada. */
  negociosMinimos?: number
}

export const QUANTIDADE_BASE = 100
export const NEGOCIOS_MINIMOS_IDEIAS = 5
export const DIAS_UTEIS_MINIMOS_IDEIAS = 3
/** Ganho máximo abaixo disto (0,5% do risco) não entra: chance alta de ganhar centavos arriscando muito. Venda de put comum rende cerca de 1% a 3%. */
export const RETORNO_MINIMO_SOBRE_RISCO = 0.005
/**
 * Estruturas de débito com ganho máximo (travas, borboleta) precisam render ao menos 25% do risco: pagar quase a largura inteira para
 * ganhar centavos é sinal de preço velho ou incoerente no último negócio de uma das pernas, não de oportunidade.
 */
export const RETORNO_MINIMO_DEBITO = 0.25
const TOLERANCIA = 1e-6

/**
 * Chance de a posição terminar no lucro: integra a densidade lognormal do preço no vencimento (neutra ao risco, com a
 * volatilidade dada) sobre os preços em que o resultado é positivo. Em %.
 */
export function chanceDeLucro(posicao: Posicao, preco: number, dias: number, jurosAnual: number, sigma: number): number {
  const t = dias / DIAS_UTEIS_ANO
  if (t <= 0 || sigma <= 0) return resultadoNoVencimento(posicao, preco) > 0 ? 100 : 0
  const r = Math.log(1 + jurosAnual / 100)
  const deriva = (r - (sigma * sigma) / 2) * t
  const desvio = sigma * Math.sqrt(t)
  const passo = 0.02
  let probabilidade = 0
  for (let z = -6; z <= 6; z += passo) {
    const s = preco * Math.exp(deriva + desvio * z)
    if (resultadoNoVencimento(posicao, s) > 0.005) probabilidade += Math.exp((-z * z) / 2) * passo
  }
  return Math.min(100, (probabilidade / Math.sqrt(2 * Math.PI)) * 100)
}

function posicaoDe(c: { pernas: PernaCandidata[]; comAcoes: boolean }, quantidade: number, preco: number): Posicao {
  const pernas: Perna[] = c.pernas.map((p) => ({
    tipo: p.serie.tipo, lado: p.lado, strike: p.serie.strike, premio: p.serie.ultimo, quantidade: quantidade * p.fator,
  }))
  return { pernas, acoes: c.comAcoes ? quantidade : 0, precoAcao: c.comAcoes ? preco : 0 }
}

interface Rascunho {
  estrutura: EstruturaId
  pernas: PernaCandidata[]
  comAcoes?: boolean
}

const compra = (serie: SerieOpcao, fator = 1): PernaCandidata => ({ serie, lado: 'compra', fator })
const venda = (serie: SerieOpcao, fator = 1): PernaCandidata => ({ serie, lado: 'venda', fator })

/** Rascunhos de cada estrutura com as séries elegíveis (mesmo vencimento), antes de medir. */
function rascunhosDe(estrutura: EstruturaId, calls: SerieOpcao[], puts: SerieOpcao[], preco: number): Rascunho[] {
  const m = (s: SerieOpcao) => s.strike / preco
  const larguraMax = 0.15 * preco
  const saida: Rascunho[] = []
  const add = (pernas: PernaCandidata[], comAcoes = false) => saida.push({ estrutura, pernas, comAcoes })

  switch (estrutura) {
    case 'compraCall':
      for (const c of calls) if (m(c) >= 0.97 && m(c) <= 1.1) add([compra(c)])
      break
    case 'travaAltaDebito':
      for (const c1 of calls) {
        if (m(c1) < 0.95 || m(c1) > 1.05) continue
        for (const c2 of calls) {
          const largura = c2.strike - c1.strike
          if (largura <= 0 || largura > larguraMax || m(c2) > 1.2) continue
          const debito = c1.ultimo - c2.ultimo
          if (debito > 0 && debito < largura) add([compra(c1), venda(c2)])
        }
      }
      break
    case 'travaAltaCredito':
      for (const p2 of puts) {
        if (m(p2) < 0.88 || m(p2) > 1.0) continue
        for (const p1 of puts) {
          const largura = p2.strike - p1.strike
          if (largura <= 0 || largura > larguraMax || m(p1) < 0.75) continue
          const credito = p2.ultimo - p1.ultimo
          if (credito > 0 && credito < largura) add([venda(p2), compra(p1)])
        }
      }
      break
    case 'vendaPut':
      for (const p of puts) if (m(p) >= 0.85 && m(p) <= 1.0) add([venda(p)])
      break
    case 'compraPut':
      for (const p of puts) if (m(p) >= 0.9 && m(p) <= 1.03) add([compra(p)])
      break
    case 'travaBaixaDebito':
      for (const p2 of puts) {
        if (m(p2) < 0.95 || m(p2) > 1.05) continue
        for (const p1 of puts) {
          const largura = p2.strike - p1.strike
          if (largura <= 0 || largura > larguraMax || m(p1) < 0.8) continue
          const debito = p2.ultimo - p1.ultimo
          if (debito > 0 && debito < largura) add([compra(p2), venda(p1)])
        }
      }
      break
    case 'travaBaixaCredito':
      for (const c1 of calls) {
        if (m(c1) < 1.0 || m(c1) > 1.12) continue
        for (const c2 of calls) {
          const largura = c2.strike - c1.strike
          if (largura <= 0 || largura > larguraMax || m(c2) > 1.25) continue
          const credito = c1.ultimo - c2.ultimo
          if (credito > 0 && credito < largura) add([venda(c1), compra(c2)])
        }
      }
      break
    case 'condorDeFerro': {
      const lados = (lista: SerieOpcao[], dentro: (s: SerieOpcao) => boolean) => lista.filter((s) => dentro(s))
      const putsLado = lados(puts, (s) => m(s) >= 0.75 && m(s) <= 0.98)
      const callsLado = lados(calls, (s) => m(s) >= 1.02 && m(s) <= 1.25)
      for (let i = 0; i < putsLado.length; i++) {
        const pAlta = putsLado[i]
        if (m(pAlta) < 0.85) continue
        for (let j = Math.max(0, i - 3); j < i; j++) {
          const pBaixa = putsLado[j]
          for (let k = 0; k < callsLado.length; k++) {
            const cBaixa = callsLado[k]
            if (m(cBaixa) > 1.15) break
            for (let l = k + 1; l <= Math.min(callsLado.length - 1, k + 3); l++) {
              const cAlta = callsLado[l]
              const credito = pAlta.ultimo - pBaixa.ultimo + cBaixa.ultimo - cAlta.ultimo
              const larguraMenor = Math.min(pAlta.strike - pBaixa.strike, cAlta.strike - cBaixa.strike)
              if (credito > 0 && credito < larguraMenor) add([compra(pBaixa), venda(pAlta), venda(cBaixa), compra(cAlta)])
            }
          }
        }
      }
      break
    }
    case 'borboleta':
      for (const c2 of calls) {
        if (m(c2) < 0.97 || m(c2) > 1.05) continue
        for (const c1 of calls) {
          const largura = c2.strike - c1.strike
          if (largura <= 0 || largura > 0.12 * preco) continue
          const c3 = calls.find((c) => Math.abs(c.strike - (c2.strike + largura)) < TOLERANCIA)
          if (!c3) continue
          const debito = c1.ultimo - 2 * c2.ultimo + c3.ultimo
          if (debito > 0 && debito < largura) add([compra(c1), venda(c2, 2), compra(c3)])
        }
      }
      break
    case 'vendaCoberta':
      for (const c of calls) if (m(c) >= 1.0 && m(c) <= 1.1) add([venda(c)], true)
      break
    case 'borboletaPut':
      for (const p2 of puts) {
        if (m(p2) < 0.97 || m(p2) > 1.05) continue
        for (const p1 of puts) {
          const largura = p2.strike - p1.strike
          if (largura <= 0 || largura > 0.12 * preco) continue
          const p3 = puts.find((p) => Math.abs(p.strike - (p2.strike + largura)) < TOLERANCIA)
          if (!p3) continue
          const debito = p1.ultimo - 2 * p2.ultimo + p3.ultimo
          if (debito > 0 && debito < largura) add([compra(p1), venda(p2, 2), compra(p3)])
        }
      }
      break
    case 'borboletaFerro':
      for (const c2 of calls) {
        if (m(c2) < 0.97 || m(c2) > 1.05) continue
        const p2 = puts.find((p) => Math.abs(p.strike - c2.strike) < TOLERANCIA)
        if (!p2) continue
        for (const c3 of calls) {
          const largura = c3.strike - c2.strike
          if (largura <= 0 || largura > 0.12 * preco) continue
          const p1 = puts.find((p) => Math.abs(p.strike - (c2.strike - largura)) < TOLERANCIA)
          if (!p1) continue
          const credito = p2.ultimo + c2.ultimo - p1.ultimo - c3.ultimo
          if (credito > 0 && credito < largura) add([compra(p1), venda(p2), venda(c2), compra(c3)])
        }
      }
      break
    case 'condorCall':
      for (const c2 of calls) {
        if (m(c2) < 0.95 || m(c2) > 1.04) continue
        for (const c3 of calls) {
          const meio = c3.strike - c2.strike
          if (meio <= 0 || meio > 0.08 * preco) continue
          for (const c1 of calls) {
            const largura = c2.strike - c1.strike
            if (largura <= 0 || largura > 0.1 * preco) continue
            const c4 = calls.find((c) => Math.abs(c.strike - (c3.strike + largura)) < TOLERANCIA)
            if (!c4) continue
            const debito = c1.ultimo - c2.ultimo - c3.ultimo + c4.ultimo
            if (debito > 0 && debito < largura) add([compra(c1), venda(c2), venda(c3), compra(c4)])
          }
        }
      }
      break
    case 'putOtimizada':
      for (const p of puts) {
        if (m(p) < 0.85 || m(p) > 1.0) continue
        for (const c1 of calls) {
          if (m(c1) < 1.02 || m(c1) > 1.1) continue
          for (const c2 of calls) {
            const largura = c2.strike - c1.strike
            if (largura <= 0 || largura > 0.1 * preco) continue
            if (c1.ultimo - c2.ultimo > 0) add([venda(p), venda(c1), compra(c2)])
          }
        }
      }
      break
    case 'slidePut':
      for (const alta of puts) {
        if (m(alta) < 0.97 || m(alta) > 1.02) continue
        for (const meio of puts) {
          if (meio.strike >= alta.strike || m(meio) < 0.88) continue
          for (const baixa of puts) {
            if (baixa.strike >= meio.strike || m(baixa) < 0.8 || alta.strike - baixa.strike > larguraMax) continue
            // crédito ou custo baixo (até 25% do prêmio da put comprada)
            if (alta.ultimo - meio.ultimo - baixa.ultimo <= 0.25 * alta.ultimo) add([compra(alta), venda(meio), venda(baixa)])
          }
        }
      }
      break
    case 'strangleFinanciado':
      for (const pA of puts) {
        if (m(pA) < 0.9 || m(pA) > 0.99) continue
        for (const cA of calls) {
          if (m(cA) < 1.01 || m(cA) > 1.1) continue
          for (const pB of puts) {
            const largura = pA.strike - pB.strike
            if (largura <= 0 || largura > 0.1 * preco) continue
            const cB = calls.find((c) => Math.abs(c.strike - (cA.strike + largura)) < TOLERANCIA)
            if (!cB) continue
            if (pA.ultimo - pB.ultimo + cA.ultimo - cB.ultimo > 0) add([compra(pA), venda(pB), compra(cA), venda(cB)])
          }
        }
      }
      break
    case 'collar':
      for (const p of puts) {
        if (m(p) < 0.9 || m(p) > 0.99) continue
        for (const c of calls) if (m(c) >= 1.02 && m(c) <= 1.12) add([compra(p), venda(c)], true)
      }
      break
    case 'booster':
      for (const c1 of calls) {
        if (m(c1) < 0.97 || m(c1) > 1.03) continue
        for (const c2 of calls) {
          const largura = c2.strike - c1.strike
          if (largura <= 0 || largura > larguraMax) continue
          for (const p of puts) {
            if (m(p) < 0.85 || m(p) > 0.97) continue
            // "sem desembolso": o débito da trava de alta é coberto, ou quase, pelo prêmio da put vendida
            if (c1.ultimo - c2.ultimo - p.ultimo <= 0.02) add([compra(c1), venda(c2), venda(p)], true)
          }
        }
      }
      break
    case 'bullishRiskReversal':
      for (const p of puts) {
        if (m(p) < 0.85 || m(p) > 0.97) continue
        for (const c of calls) {
          if (m(c) < 1.03 || m(c) > 1.15) continue
          // recebe para montar ou paga quase nada
          if (p.ultimo - c.ultimo >= -0.02) add([venda(p), compra(c)])
        }
      }
      break
    case 'bearishRiskReversal':
      for (const c of calls) {
        if (m(c) < 1.03 || m(c) > 1.15) continue
        for (const p of puts) {
          if (m(p) < 0.85 || m(p) > 0.97) continue
          if (c.ultimo - p.ultimo >= -0.02) add([venda(c), compra(p)])
        }
      }
      break
    case 'straddleComprado':
      for (const c of calls) {
        if (m(c) < 0.97 || m(c) > 1.03) continue
        const p = puts.find((x) => Math.abs(x.strike - c.strike) < TOLERANCIA)
        if (p) add([compra(c), compra(p)])
      }
      break
    case 'strangleComprado':
      for (const p of puts) {
        if (m(p) < 0.9 || m(p) > 0.99) continue
        for (const c of calls) if (m(c) >= 1.01 && m(c) <= 1.1) add([compra(p), compra(c)])
      }
      break
  }
  return saida
}

/**
 * Todas as candidatas de uma estrutura para o ativo e o vencimento, medidas. Só entram séries que negociaram no último
 * pregão, com negócios suficientes e preço; estruturas de ganho minúsculo diante do risco, e travas de débito que custam quase a largura inteira, ficam de fora. Sem ordem.
 */
export function gerarCandidatas(ativo: AtivoComOpcoes, estrutura: EstruturaId, visao: Visao, p: ParametrosIdeias): Candidata[] {
  const quantidade = p.quantidade ?? QUANTIDADE_BASE
  const minimoNegocios = p.negociosMinimos ?? NEGOCIOS_MINIMOS_IDEIAS
  const du = diasUteis(p.vencimento, p.hoje)
  if (du < DIAS_UTEIS_MINIMOS_IDEIAS) return []
  const elegiveis = ativo.series
    .filter((s) => s.vencimento === p.vencimento && s.dataUltimo === p.hoje && s.negocios >= minimoNegocios && s.ultimo > 0)
    .sort((a, b) => a.strike - b.strike)
  const calls = elegiveis.filter((s) => s.tipo === 'call')
  const puts = elegiveis.filter((s) => s.tipo === 'put')

  const volDe = new Map<string, number | null>()
  const vol = (s: SerieOpcao) => {
    if (!volDe.has(s.codigo)) volDe.set(s.codigo, montarLinha(s, ativo.cotacao, p.hoje, p.jurosAnual).volImplicita)
    return volDe.get(s.codigo) ?? null
  }

  const candidatas: Candidata[] = []
  for (const r of rascunhosDe(estrutura, calls, puts, ativo.cotacao)) {
    const vols = r.pernas.map((x) => vol(x.serie)).filter((v): v is number => v !== null)
    if (vols.length === 0) continue
    const volMedia = vols.reduce((a, b) => a + b, 0) / vols.length
    const posicao = posicaoDe({ pernas: r.pernas, comAcoes: r.comAcoes ?? false }, quantidade, ativo.cotacao)
    const analise = analisar(posicao)
    const semLimite = analise.perdaMaxima === null
    if (semLimite && !ESTRUTURAS_DE_RISCO_ILIMITADO.includes(estrutura)) continue // só risco limitado, salvo as marcadas
    const risco = semLimite ? -resultadoNoVencimento(posicao, ativo.cotacao * (1 + ALTA_DE_REFERENCIA)) : -analise.perdaMaxima!
    if (!(risco > 0)) continue
    if (analise.ganhoMaximo !== null && analise.ganhoMaximo < RETORNO_MINIMO_SOBRE_RISCO * risco) continue
    const credito = custoDeMontagem(posicao)
    // Só vale para estruturas em que o débito é a maior parte do risco (travas, borboletas, strangle financiado); nas de custo quase zero (slide, booster) o risco vem das pernas vendidas.
    if (credito < 0 && -credito >= 0.5 * risco && analise.ganhoMaximo !== null && analise.ganhoMaximo < RETORNO_MINIMO_DEBITO * risco) continue

    const sigma = volMedia / 100
    const movimento = sigma * Math.sqrt(du / DIAS_UTEIS_ANO)
    const acima = resultadoNoVencimento(posicao, ativo.cotacao * (1 + movimento))
    const abaixo = resultadoNoVencimento(posicao, ativo.cotacao * Math.max(1 - movimento, 0.01))
    const noCenario =
      visao === 'alta' ? acima : visao === 'baixa' ? abaixo : visao === 'lateral' ? resultadoNoVencimento(posicao, ativo.cotacao) : Math.max(acima, abaixo)

    candidatas.push({
      estrutura,
      pernas: r.pernas,
      comAcoes: r.comAcoes ?? false,
      vencimento: p.vencimento,
      diasUteis: du,
      quantidade,
      credito,
      ganhoMaximo: analise.ganhoMaximo,
      perdaMaxima: analise.perdaMaxima,
      riscoReferencia: risco,
      equilibrios: analise.equilibrios,
      chanceDeLucro: chanceDeLucro(posicao, ativo.cotacao, du, p.jurosAnual, sigma),
      volImplicita: volMedia,
      resultadoNoCenario: noCenario,
      retornoNoCenario: (noCenario / risco) * 100,
      movimentoDoCenario: visao === 'lateral' ? 0 : movimento * 100,
      negociosMinimos: Math.min(...r.pernas.map((x) => x.serie.negocios)),
    })
  }
  return candidatas
}

const CHAVE: Record<CriterioIdeia, (c: Candidata) => number> = {
  chance: (c) => c.chanceDeLucro,
  retorno: (c) => c.retornoNoCenario,
  risco: (c) => c.perdaMaxima ?? -1e12, // negativa: a maior (mais perto de zero) é a de menor risco; sem limite fica por último
}

/** As `quantas` primeiras candidatas pelo critério. Desempate: mais negócios na série mais fraca, depois o código da primeira série. */
export function melhoresCandidatas(
  ativo: AtivoComOpcoes, estrutura: EstruturaId, visao: Visao, p: ParametrosIdeias, criterio: CriterioIdeia, quantas = 3,
): Candidata[] {
  const chave = CHAVE[criterio]
  return gerarCandidatas(ativo, estrutura, visao, p)
    .sort((a, b) => chave(b) - chave(a) || b.negociosMinimos - a.negociosMinimos || a.pernas[0].serie.codigo.localeCompare(b.pernas[0].serie.codigo))
    .slice(0, quantas)
}

/** Texto curto das pernas: "Compra PETRK600, vende PETRK650". */
export function descreverPernas(c: Candidata): string {
  const partes = c.pernas.map((p) => `${p.lado === 'compra' ? 'compra' : 'vende'} ${p.fator > 1 ? `${p.fator}x ` : ''}${p.serie.codigo}`)
  const texto = (c.comAcoes ? ['tem a ação', ...partes] : partes).join(', ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Faz uma candidata virar a escolha de séries do simulador de estratégias. */
export function escolhaDaCandidata(ativo: AtivoComOpcoes, c: Candidata) {
  const modelo = MODELO_DA_ESTRUTURA[c.estrutura]
  return {
    ativo,
    series: c.pernas.map((p) => p.serie),
    detalhes: Object.fromEntries(c.pernas.map((p) => [p.serie.codigo, { lado: p.lado, fator: p.fator }])),
    // Só a venda coberta (uma call) usa o atalho "coberta"; collar e booster abrem o próprio modelo, com as ações.
    coberta: c.comAcoes && !modelo,
    ...(modelo ? { modelo } : {}),
  }
}
