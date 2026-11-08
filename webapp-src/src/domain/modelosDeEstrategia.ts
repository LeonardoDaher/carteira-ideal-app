import { tipoVencimento } from './opcoes'
import type { SerieOpcao } from './opcoes'
import type { Lado, Perna, Posicao, TipoOpcao } from './simulaOpcoes'

/**
 * Catálogo de estruturas da aba "Monte sua estratégia". Cada modelo diz quais pernas (call ou put, compra ou venda, quantas
 * vezes o lote) e em que posição da escada de strikes elas ficam: 0 é o strike mais perto do preço do ativo, +1 o seguinte
 * acima, −1 o seguinte abaixo. É só o ponto de partida: o usuário troca a série de cada perna.
 */
export type ModeloId =
  | 'travaAltaCall' | 'travaAltaPut' | 'travaBaixaPut' | 'travaBaixaCall'
  | 'borboletaCall' | 'borboletaPut' | 'borboletaFerro' | 'condorFerro' | 'condorCall'
  | 'straddleComprado' | 'strangleComprado' | 'straddleVendido' | 'strangleVendido'
  | 'vendaCoberta' | 'collar'
  | 'thlCall' | 'thlPut' | 'diagonalCall' | 'diagonalPut'
  | 'bullishRiskReversal' | 'bearishRiskReversal'
  | 'slidePut' | 'putOtimizada' | 'strangleFinanciado' | 'booster'

export interface PernaDoModelo {
  tipo: TipoOpcao
  lado: Lado
  /** Múltiplo do lote (a asa central da borboleta tem 2). */
  fator: number
  /** Degraus de strike em relação ao mais perto do preço. */
  degrau: number
  /** Perna de vencimento mais longo (o seguinte ao escolhido para a estrutura). Sem isso, vale o vencimento escolhido. */
  longa?: boolean
}

export interface Modelo {
  id: ModeloId
  titulo: string
  grupo: 'Travas' | 'Risk Reversal' | 'Borboletas e condors' | 'Volatilidade' | 'Com ações' | 'Vários vencimentos' | 'Renda e proteção'
  /** Uma frase sobre quando faz sentido e como o resultado é limitado. */
  descricao: string
  pernas: PernaDoModelo[]
  /** Posse de ações junto com as opções (venda coberta e collar). */
  comAcoes?: boolean
  aviso?: string
}

const c = (lado: Lado, degrau: number, fator = 1): PernaDoModelo => ({ tipo: 'call', lado, degrau, fator })
const p = (lado: Lado, degrau: number, fator = 1): PernaDoModelo => ({ tipo: 'put', lado, degrau, fator })
const cl = (lado: Lado, degrau: number): PernaDoModelo => ({ tipo: 'call', lado, degrau, fator: 1, longa: true })
const pl = (lado: Lado, degrau: number): PernaDoModelo => ({ tipo: 'put', lado, degrau, fator: 1, longa: true })

const AVISO_DESCOBERTA =
  'Venda de opções sem limitar o risco: se o ativo andar muito para o lado errado a perda pode ser muito maior que o prêmio recebido (e, na call, sem limite). A B3 exige margem de garantia.'

const AVISO_PUT_SEM_PROTECAO =
  'Há put vendida sem proteção abaixo: se o ativo cair muito, a perda pode chegar perto do strike vezes a quantidade (menos o crédito), e a B3 exige margem de garantia.'
const NOTA_LEITURA = ' (Montagem pela definição mais comum, a partir de material público; as pernas exatas variam de uma mesa para outra, então confira e ajuste as séries.)'

export const MODELOS: Modelo[] = [
  { id: 'travaAltaCall', titulo: 'Trava de alta (com calls)', grupo: 'Travas', descricao: 'Compra uma call e vende outra de strike maior. Ganha se o ativo subir, com ganho e perda limitados. Começa com débito.', pernas: [c('compra', 0), c('venda', 2)] },
  { id: 'travaAltaPut', titulo: 'Trava de alta (com puts)', grupo: 'Travas', descricao: 'Vende uma put e compra outra de strike menor. Ganha se o ativo ficar parado ou subir, com ganho e perda limitados. Começa com crédito.', pernas: [p('venda', 0), p('compra', -2)] },
  { id: 'travaBaixaPut', titulo: 'Trava de baixa (com puts)', grupo: 'Travas', descricao: 'Compra uma put e vende outra de strike menor. Ganha se o ativo cair, com ganho e perda limitados. Começa com débito.', pernas: [p('compra', 0), p('venda', -2)] },
  { id: 'travaBaixaCall', titulo: 'Trava de baixa (com calls)', grupo: 'Travas', descricao: 'Vende uma call e compra outra de strike maior. Ganha se o ativo ficar parado ou cair, com ganho e perda limitados. Começa com crédito.', pernas: [c('venda', 0), c('compra', 2)] },
  { id: 'bullishRiskReversal', titulo: 'Bullish Risk Reversal (vende put, compra call)', grupo: 'Risk Reversal', descricao: 'Vende uma put abaixo do preço e compra uma call acima, no mesmo vencimento. Aposta na alta: costuma sair com crédito ou perto de zero, e o ativo tem espaço para andar entre os dois strikes sem custo. Ganha com a alta acima da call; abaixo da put vendida, a perda cresce até zero.' + NOTA_LEITURA, pernas: [p('venda', -2), c('compra', 2)], aviso: AVISO_PUT_SEM_PROTECAO },
  { id: 'bearishRiskReversal', titulo: 'Bearish Risk Reversal (vende call, compra put)', grupo: 'Risk Reversal', descricao: 'Vende uma call acima do preço e compra uma put abaixo, no mesmo vencimento. Aposta na baixa: costuma sair com crédito ou perto de zero, e o ativo tem espaço entre os dois strikes. Ganha com a queda abaixo da put; acima da call vendida, a perda não tem limite.' + NOTA_LEITURA, pernas: [c('venda', 2), p('compra', -2)], aviso: AVISO_DESCOBERTA },
  { id: 'borboletaCall', titulo: 'Borboleta de calls', grupo: 'Borboletas e condors', descricao: 'Compra uma call abaixo, vende duas no meio e compra uma acima. Aposta que o ativo termina perto do strike do meio; ganho e perda limitados.', pernas: [c('compra', -2), c('venda', 0, 2), c('compra', 2)] },
  { id: 'borboletaPut', titulo: 'Borboleta de puts', grupo: 'Borboletas e condors', descricao: 'Mesma ideia da borboleta de calls, feita com puts: o ganho é máximo se o ativo terminar no strike do meio.', pernas: [p('compra', 2), p('venda', 0, 2), p('compra', -2)] },
  { id: 'borboletaFerro', titulo: 'Borboleta de ferro', grupo: 'Borboletas e condors', descricao: 'Vende uma call e uma put no mesmo strike e compra uma call acima e uma put abaixo como proteção. Começa com crédito; ganho máximo com o ativo parado.', pernas: [p('compra', -2), p('venda', 0), c('venda', 0), c('compra', 2)] },
  { id: 'condorFerro', titulo: 'Condor de ferro', grupo: 'Borboletas e condors', descricao: 'Vende uma put e uma call de strikes diferentes e compra uma put mais abaixo e uma call mais acima. Ganha o crédito se o ativo ficar numa faixa; ganho e perda limitados.', pernas: [p('compra', -4), p('venda', -2), c('venda', 2), c('compra', 4)] },
  { id: 'condorCall', titulo: 'Condor de calls', grupo: 'Borboletas e condors', descricao: 'Compra uma call baixa, vende duas intermediárias e compra uma alta. Ganha se o ativo terminar entre os strikes do meio.', pernas: [c('compra', -3), c('venda', -1), c('venda', 1), c('compra', 3)] },
  { id: 'straddleComprado', titulo: 'Straddle comprado', grupo: 'Volatilidade', descricao: 'Compra uma call e uma put no mesmo strike. Ganha se o ativo andar muito para qualquer lado; perde o prêmio pago se ficar parado.', pernas: [c('compra', 0), p('compra', 0)] },
  { id: 'strangleComprado', titulo: 'Strangle comprado', grupo: 'Volatilidade', descricao: 'Compra uma put abaixo e uma call acima do preço. Mais barato que o straddle, mas o ativo precisa andar mais para dar lucro.', pernas: [p('compra', -2), c('compra', 2)] },
  { id: 'straddleVendido', titulo: 'Straddle vendido', grupo: 'Volatilidade', descricao: 'Vende uma call e uma put no mesmo strike: recebe os dois prêmios se o ativo ficar parado.', pernas: [c('venda', 0), p('venda', 0)], aviso: AVISO_DESCOBERTA },
  { id: 'strangleVendido', titulo: 'Strangle vendido', grupo: 'Volatilidade', descricao: 'Vende uma put abaixo e uma call acima do preço: recebe os prêmios se o ativo ficar entre os strikes.', pernas: [p('venda', -2), c('venda', 2)], aviso: AVISO_DESCOBERTA },
  { id: 'vendaCoberta', titulo: 'Venda coberta', grupo: 'Com ações', descricao: 'Tem as ações e vende uma call: recebe o prêmio e limita a alta.', pernas: [c('venda', 1)], comAcoes: true },
  { id: 'collar', titulo: 'Collar (proteção com custo menor)', grupo: 'Com ações', descricao: 'Tem as ações, compra uma put de proteção e vende uma call para pagar parte dela. Limita a perda e também o ganho.', pernas: [p('compra', -2), c('venda', 2)], comAcoes: true },
  { id: 'thlCall', titulo: 'Trava horizontal de calls (THL)', grupo: 'Vários vencimentos', descricao: 'Compra uma call de vencimento mais longo e vende outra, no mesmo strike, de vencimento mais curto. Colhe o valor de tempo da opção curta, que perde valor mais rápido; ganha mais se o ativo estiver perto do strike no primeiro vencimento. A perda é no máximo o débito pago.', pernas: [cl('compra', 0), c('venda', 0)] },
  { id: 'thlPut', titulo: 'Trava horizontal de puts (THL)', grupo: 'Vários vencimentos', descricao: 'Mesma ideia com puts: compra a de vencimento mais longo e vende a mais curta no mesmo strike. A perda é no máximo o débito pago.', pernas: [pl('compra', 0), p('venda', 0)] },
  { id: 'diagonalCall', titulo: 'Trava diagonal de calls', grupo: 'Vários vencimentos', descricao: 'Compra uma call de vencimento mais longo e vende outra, de strike maior, de vencimento mais curto. Combina a trava de alta com a colheita do valor de tempo.', pernas: [cl('compra', 0), c('venda', 2)] },
  { id: 'diagonalPut', titulo: 'Trava diagonal de puts', grupo: 'Vários vencimentos', descricao: 'Compra uma put de vencimento mais longo e vende outra, de strike menor, de vencimento mais curto. Combina a trava de baixa com a colheita do valor de tempo.', pernas: [pl('compra', 0), p('venda', -2)] },
  { id: 'slidePut', titulo: 'Slide com put', grupo: 'Renda e proteção', descricao: 'Compra uma put de strike maior e vende duas puts de strikes menores (uma intermediária e uma inferior). Costuma sair com crédito ou sem custo e lucra com o ativo parado ou caindo pouco, mas tem risco se ele cair abaixo dos strikes vendidos.' + NOTA_LEITURA, pernas: [p('compra', 0), p('venda', -2), p('venda', -3)], aviso: AVISO_PUT_SEM_PROTECAO },
  { id: 'putOtimizada', titulo: 'Put vendida otimizada (put + trava de baixa com calls)', grupo: 'Renda e proteção', descricao: 'Vende uma put e, junto, uma trava de baixa com calls (vende uma call e compra outra de strike maior). O crédito das calls soma ao da put, sem aumentar o risco do lado de baixo, que continua o da put vendida.' + NOTA_LEITURA, pernas: [p('venda', -2), c('venda', 2), c('compra', 4)], aviso: AVISO_PUT_SEM_PROTECAO },
  { id: 'strangleFinanciado', titulo: 'Strangle comprado financiado (risco menor)', grupo: 'Renda e proteção', descricao: 'Compra um strangle (put abaixo e call acima) e vende opções mais afastadas para pagar parte dele. Custa menos e o prejuízo máximo é o débito, mas o ganho também fica limitado: é uma aposta em movimento grande para qualquer lado, sem os extremos.' + NOTA_LEITURA, pernas: [p('compra', -2), p('venda', -4), c('compra', 2), c('venda', 4)] },
  { id: 'booster', titulo: 'Booster (ações + trava de alta financiada por put)', grupo: 'Renda e proteção', descricao: 'Tem as ações, compra uma call perto do preço e vende outra acima (trava de alta), pagando o débito com o prêmio de uma put vendida abaixo. Dentro da faixa entre os dois strikes das calls, o ganho é cerca do dobro do da ação sozinha; abaixo da put vendida, a perda aumenta.' + NOTA_LEITURA, pernas: [c('compra', 0), c('venda', 2), p('venda', -2)], comAcoes: true, aviso: AVISO_PUT_SEM_PROTECAO },
]

export const GRUPOS_DE_MODELOS: Modelo['grupo'][] = ['Travas', 'Risk Reversal', 'Borboletas e condors', 'Volatilidade', 'Com ações', 'Vários vencimentos', 'Renda e proteção']

/**
 * Escada de strikes de um tipo no vencimento: uma série por strike, a mais negociada quando há americana e europeia no
 * mesmo strike. Ordenada do menor para o maior.
 */
export function escadaDeStrikes(series: SerieOpcao[], tipo: TipoOpcao, vencimento: string): SerieOpcao[] {
  const porStrike = new Map<number, SerieOpcao>()
  for (const s of series) {
    if (s.tipo !== tipo || s.vencimento !== vencimento || !(s.ultimo > 0)) continue
    const atual = porStrike.get(s.strike)
    if (!atual || s.negocios > atual.negocios) porStrike.set(s.strike, s)
  }
  return [...porStrike.values()].sort((a, b) => a.strike - b.strike)
}

/**
 * Vencimento da perna longa: o primeiro mensal depois de `depois` que tenha séries do tipo; sem mensal, o primeiro de qualquer
 * tipo. null quando não há vencimento posterior.
 */
export function proximoVencimento(series: SerieOpcao[], tipo: TipoOpcao, depois: string): string | null {
  const todos = [...new Set(series.filter((x) => x.tipo === tipo && x.vencimento > depois).map((x) => x.vencimento))].sort()
  const comEscada = todos.filter((v) => escadaDeStrikes(series, tipo, v).length > 0)
  return comEscada.find((v) => tipoVencimento(v) === 'mensal') ?? comEscada[0] ?? null
}

/** Índice do strike mais perto do preço (o de baixo, em caso de empate). */
export function indiceDoMaisPerto(escada: SerieOpcao[], preco: number): number {
  let melhor = 0
  for (let i = 1; i < escada.length; i++) if (Math.abs(escada[i].strike - preco) < Math.abs(escada[melhor].strike - preco)) melhor = i
  return melhor
}

/**
 * Série padrão de cada perna do modelo. Os degraus são contados a partir do strike mais perto do preço e limitados às pontas
 * da escada; `null` quando o vencimento não tem séries daquele tipo.
 */
export function seriesPadrao(series: SerieOpcao[], modelo: Modelo, vencimento: string, preco: number): (SerieOpcao | null)[] {
  return modelo.pernas.map((perna) => {
    const venc = perna.longa ? proximoVencimento(series, perna.tipo, vencimento) : vencimento
    if (!venc) return null
    const escada = escadaDeStrikes(series, perna.tipo, venc)
    if (escada.length === 0) return null
    const i = Math.min(Math.max(indiceDoMaisPerto(escada, preco) + perna.degrau, 0), escada.length - 1)
    return escada[i]
  })
}

/** Vencimentos em que o modelo tem pelo menos uma série para cada tipo de perna que usa. */
export function vencimentosDoModelo(series: SerieOpcao[], modelo: Modelo, vencimentos: string[]): string[] {
  return vencimentos.filter((v) =>
    modelo.pernas.every((x) => (x.longa ? proximoVencimento(series, x.tipo, v) !== null : escadaDeStrikes(series, x.tipo, v).length > 0)),
  )
}

export interface PernaMontada {
  serie: SerieOpcao
  lado: Lado
  fator: number
  premio: number
  /** Dias úteis até o vencimento desta perna. */
  dias?: number
}

/** Posição a partir das pernas escolhidas. `lote` é o número de opções de cada unidade; `precoAcao` vale na venda coberta e no collar. */
export function montarPosicaoDoModelo(modelo: Modelo, pernas: PernaMontada[], lote: number, precoAcao: number): Posicao {
  const lista: Perna[] = pernas.map((x) => ({ tipo: x.serie.tipo, lado: x.lado, strike: x.serie.strike, premio: x.premio, quantidade: lote * x.fator, dias: x.dias }))
  return { pernas: lista, acoes: modelo.comAcoes ? lote : 0, precoAcao: modelo.comAcoes ? precoAcao : 0 }
}

/**
 * Confere se as séries escolhidas fazem sentido para o modelo (compra de strike menor na trava de alta, por exemplo, só vale
 * se a ordem dos strikes for a esperada). Devolve o motivo em português, ou null quando está certo.
 */
export function validarModelo(modelo: Modelo, pernas: (SerieOpcao | null)[]): string | null {
  if (pernas.some((x) => x === null)) return 'Escolha uma série para cada perna.'
  const curtas = modelo.pernas.flatMap((x, i) => (x.longa ? [] : [pernas[i]!.vencimento]))
  const longas = modelo.pernas.flatMap((x, i) => (x.longa ? [pernas[i]!.vencimento] : []))
  if (longas.length > 0 && curtas.length > 0 && longas.some((l) => curtas.some((c) => l <= c))) return 'A perna longa precisa vencer depois da perna curta.'
  const strikes = pernas.map((x) => x!.strike)
  const esperado = modelo.pernas.map((x) => x.degrau)
  for (let i = 0; i < strikes.length; i++) {
    for (let j = i + 1; j < strikes.length; j++) {
      if (modelo.pernas[i].tipo !== modelo.pernas[j].tipo) continue
      const ordem = Math.sign(esperado[j] - esperado[i])
      const real = Math.sign(strikes[j] - strikes[i])
      if (ordem === 0) continue
      if (real === 0) return 'Duas pernas do mesmo tipo estão no mesmo strike: troque uma delas para o resultado fazer sentido.'
      if (real !== ordem) return 'A ordem dos strikes está trocada em relação ao modelo. Veja as pernas e ajuste as séries.'
    }
  }
  return null
}
