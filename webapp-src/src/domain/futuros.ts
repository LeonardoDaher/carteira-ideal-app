// Simule Futuros: contas puras do simulador de resultado e leitura gráfica do contínuo (INDFUT, WINFUT, DOLFUT...).
// Estritamente descritivo (D19): a leitura de tendência olha o passado e não prevê preço. Sem recomendação de operar.

/** [data, abertura, máxima, mínima, fechamento, contratos negociados] */
export type Candle = [string, number, number, number, number, number]

export type TipoProduto = 'pontos' | 'preco' | 'taxa'

export interface ContratoFuturo {
  ticker: string
  /** AAAA-MM */
  vencimento: string
  /** Preço de ajuste do dia (no DI, o PU). */
  ajuste: number
  ajusteAnterior: number | null
  abertura: number | null
  maxima: number | null
  minima: number | null
  /** Último preço negociado (no DI, a taxa ao ano). Sem negócio no dia, null. */
  ultimo: number | null
  volume: number | null
  posicaoAberta: number | null
}

export interface ProdutoFuturo {
  codigo: string
  /** Nome de plataforma do contínuo, ex.: WINFUT. */
  apelido: string
  nome: string
  grupo: string
  tipo: TipoProduto
  multiplicador: number
  moeda: 'BRL' | 'USD'
  tick: number
  especificacao: string
  vertice: string | null
  contratos: ContratoFuturo[]
  serie: Candle[]
}

export interface SnapshotFuturos {
  geradoEm: string | null
  dataPregao: string | null
  fonte: string
  pregoesNoHistorico: number
  produtos: ProdutoFuturo[]
}

export type Lado = 'compra' | 'venda'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-12" -> "dez/26". */
export function rotuloVencimento(vencimento: string) {
  const [ano, mes] = vencimento.split('-')
  return `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`
}

export function moedaDe(produto: Pick<ProdutoFuturo, 'moeda'>, valor: number, casas = 2) {
  const n = valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  return `${produto.moeda === 'USD' ? 'US$' : 'R$'} ${n}`
}

// ---------------------------------------------------------------------------------------
// Simulador de resultado (pontos e preço)
// ---------------------------------------------------------------------------------------

export interface EntradaResultado {
  lado: Lado
  contratos: number
  entrada: number
  saida: number
  multiplicador: number
  /** Margem de garantia por contrato, informada pela pessoa (a B3 não publica no boletim). 0 = não informada. */
  margemPorContrato: number
}

export interface Resultado {
  /** Pontos (ou reais, nos de preço) ganhos por contrato, já com o sinal do lado. */
  porContrato: number
  /** Resultado financeiro total, na moeda do contrato. */
  total: number
  margemTotal: number
  /** Resultado sobre a margem, em %. null sem margem informada. */
  sobreMargemPct: number | null
  /** Variação do preço, em %. */
  variacaoPct: number
}

/** Resultado bruto: sem corretagem, emolumentos, IR e custo da margem. Compra ganha se o preço sobe; venda, se cai. */
export function resultadoPosicao(e: EntradaResultado): Resultado {
  const sinal = e.lado === 'compra' ? 1 : -1
  const porContrato = (e.saida - e.entrada) * sinal
  const total = porContrato * e.multiplicador * e.contratos
  const margemTotal = e.margemPorContrato * e.contratos
  return {
    porContrato,
    total,
    margemTotal,
    sobreMargemPct: margemTotal > 0 ? (total / margemTotal) * 100 : null,
    variacaoPct: e.entrada > 0 ? ((e.saida - e.entrada) / e.entrada) * 100 : 0,
  }
}

/** Preços de saída para variações simétricas do preço de entrada, para a tabela de cenários. */
export function cenariosDePreco(entrada: number, pcts = [-3, -2, -1, 1, 2, 3], tick = 0): { pct: number; preco: number }[] {
  return pcts.map((pct) => {
    const bruto = entrada * (1 + pct / 100)
    return { pct, preco: tick > 0 ? Math.round(bruto / tick) * tick : bruto }
  })
}

// ---------------------------------------------------------------------------------------
// DI de 1 dia (juros)
// ---------------------------------------------------------------------------------------

/** Valor de face do contrato no vencimento, em reais. */
export const VALOR_FACE_DI = 100_000
export const DIAS_UTEIS_ANO = 252

/** Dias úteis entre duas datas AAAA-MM-DD (exclui a inicial, inclui a final), contando só sábado e domingo como não úteis. */
export function diasUteisAproximados(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T12:00:00Z`)
  const b = Date.parse(`${fim}T12:00:00Z`)
  if (!(b > a)) return 0
  let n = 0
  for (let t = a + 86_400_000; t <= b; t += 86_400_000) {
    const dia = new Date(t).getUTCDay()
    if (dia !== 0 && dia !== 6) n++
  }
  return n
}

/** Primeiro dia útil (sem feriados) do mês de vencimento AAAA-MM. */
export function dataVencimentoDI(vencimento: string): string {
  const [ano, mes] = vencimento.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, 1, 12))
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Preço unitário (PU) do DI para uma taxa (% ao ano) e dias úteis até o vencimento. */
export function puDI(taxaPct: number, diasUteis: number): number {
  return VALOR_FACE_DI / Math.pow(1 + taxaPct / 100, diasUteis / DIAS_UTEIS_ANO)
}

/** Taxa (% ao ano) que corresponde a um PU. */
export function taxaDoPU(pu: number, diasUteis: number): number {
  return (Math.pow(VALOR_FACE_DI / pu, DIAS_UTEIS_ANO / diasUteis) - 1) * 100
}

export interface EntradaDI {
  lado: Lado
  contratos: number
  taxaEntrada: number
  taxaSaida: number
  /** Dias úteis entre a entrada e o vencimento. */
  diasAteVencimento: number
  /** Dias úteis que a posição fica aberta antes de sair. */
  diasNaPosicao: number
  margemPorContrato: number
}

export interface ResultadoDI {
  puEntrada: number
  puSaida: number
  porContrato: number
  total: number
  margemTotal: number
  sobreMargemPct: number | null
}

/**
 * Quem COMPRA o DI ganha se a taxa CAI (o PU sobe); quem vende ganha se a taxa sobe. A conta compara o PU na saída (taxa de
 * saída, com os dias que faltam depois do tempo na posição) com o PU na entrada. Aproximação: a B3 liquida o ajuste todo dia e
 * corrige o saldo pelo CDI, o que muda pouco o total; os dias úteis ignoram feriados.
 */
export function resultadoDI(e: EntradaDI): ResultadoDI {
  const restante = Math.max(1, e.diasAteVencimento - e.diasNaPosicao)
  const puEntrada = puDI(e.taxaEntrada, e.diasAteVencimento)
  const puSaida = puDI(e.taxaSaida, restante)
  const sinal = e.lado === 'compra' ? 1 : -1
  const porContrato = (puSaida - puEntrada) * sinal
  const total = porContrato * e.contratos
  const margemTotal = e.margemPorContrato * e.contratos
  return { puEntrada, puSaida, porContrato, total, margemTotal, sobreMargemPct: margemTotal > 0 ? (total / margemTotal) * 100 : null }
}

// ---------------------------------------------------------------------------------------
// Leitura gráfica do contínuo
// ---------------------------------------------------------------------------------------

/** Média móvel simples terminando em cada candle (null enquanto faltam candles). */
export function mediaMovel(valores: number[], periodo: number): (number | null)[] {
  const saida: (number | null)[] = []
  let soma = 0
  for (let i = 0; i < valores.length; i++) {
    soma += valores[i]
    if (i >= periodo) soma -= valores[i - periodo]
    saida.push(i >= periodo - 1 ? soma / periodo : null)
  }
  return saida
}

/** IFR (RSI) de Wilder; null se faltarem candles. */
export function ifr(fechamentos: number[], periodo = 14): number | null {
  if (fechamentos.length <= periodo) return null
  let ganho = 0
  let perda = 0
  for (let i = 1; i <= periodo; i++) {
    const d = fechamentos[i] - fechamentos[i - 1]
    if (d >= 0) ganho += d
    else perda -= d
  }
  ganho /= periodo
  perda /= periodo
  for (let i = periodo + 1; i < fechamentos.length; i++) {
    const d = fechamentos[i] - fechamentos[i - 1]
    ganho = (ganho * (periodo - 1) + Math.max(d, 0)) / periodo
    perda = (perda * (periodo - 1) + Math.max(-d, 0)) / periodo
  }
  if (perda === 0) return ganho === 0 ? 50 : 100
  return 100 - 100 / (1 + ganho / perda)
}

/** Amplitude média verdadeira (ATR) dos últimos `periodo` candles, em % do último fechamento. */
export function atrPct(candles: Candle[], periodo = 14): number | null {
  if (candles.length <= periodo) return null
  const faixa = candles.slice(-periodo - 1)
  let soma = 0
  for (let i = 1; i < faixa.length; i++) {
    const [, , h, l] = faixa[i]
    const fechAnterior = faixa[i - 1][4]
    soma += Math.max(h - l, Math.abs(h - fechAnterior), Math.abs(l - fechAnterior))
  }
  const ultimo = candles[candles.length - 1][4]
  return ultimo > 0 ? (soma / periodo / ultimo) * 100 : null
}

export type LeituraGrafica = 'alta' | 'baixa' | 'lateral'

export interface AnaliseGrafica {
  leitura: LeituraGrafica
  fechamento: number
  sma21: number | null
  sma63: number | null
  /** Retorno em 21 e 63 candles, em %. */
  retorno21: number | null
  retorno63: number | null
  ifr14: number | null
  atr14Pct: number | null
  /** Suporte e resistência: mínima e máxima dos últimos 20 candles e da janela de até 252. */
  minima20: number
  maxima20: number
  minima52s: number
  maxima52s: number
  /** 0 a 100: onde o preço está entre a mínima e a máxima da janela de até 252 candles. */
  posicao52s: number
  /** Candles usados na janela longa (252 ou menos, se o histórico for menor). */
  candlesNaJanela: number
  /** Volume do último candle sobre a média de 21, em vezes. null se não houver volume. */
  volumeRelativo: number | null
  motivos: string[]
}

/** Retorno mínimo de 63 candles (%) para a leitura deixar de ser lateral, igual ao das ações (tendencia.ts). */
export const RETORNO_MINIMO_PCT = 3

const pct = (v: number, sinal = false) => `${sinal && v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * Leitura do passado do contínuo, com a mesma regra da aba Tendência das ações: alta = preço acima da média de 21, que está
 * acima da de 63, com retorno de 63 candles de pelo menos +3%; baixa = o inverso; o resto é lateral. No DI, o retorno é da
 * taxa. Precisa de pelo menos 63 candles; com menos, devolve null.
 */
export function analisarSerie(candles: Candle[], unidade: 'preco' | 'taxa' = 'preco'): AnaliseGrafica | null {
  if (candles.length < 63) return null
  const fech = candles.map((c) => c[4])
  const ultimo = fech[fech.length - 1]
  const sma21 = mediaMovel(fech, 21)[fech.length - 1]
  const sma63 = mediaMovel(fech, 63)[fech.length - 1]
  const retorno = (n: number) => (fech.length > n && fech[fech.length - 1 - n] > 0 ? (ultimo / fech[fech.length - 1 - n] - 1) * 100 : null)
  const retorno21 = retorno(21)
  const retorno63 = retorno(63)
  const ult20 = candles.slice(-20)
  const janela = candles.slice(-252)
  const minima20 = Math.min(...ult20.map((c) => c[3]))
  const maxima20 = Math.max(...ult20.map((c) => c[2]))
  const minima52s = Math.min(...janela.map((c) => c[3]))
  const maxima52s = Math.max(...janela.map((c) => c[2]))
  const posicao52s = maxima52s > minima52s ? ((ultimo - minima52s) / (maxima52s - minima52s)) * 100 : 50
  const mediaVol = mediaMovel(candles.map((c) => c[5]), 21)[candles.length - 1]
  const volumeRelativo = mediaVol && mediaVol > 0 ? candles[candles.length - 1][5] / mediaVol : null

  const acima = sma21 !== null && sma63 !== null && ultimo > sma21 && sma21 > sma63
  const abaixo = sma21 !== null && sma63 !== null && ultimo < sma21 && sma21 < sma63
  const r63 = retorno63 ?? 0
  const leitura: LeituraGrafica = acima && r63 >= RETORNO_MINIMO_PCT ? 'alta' : abaixo && r63 <= -RETORNO_MINIMO_PCT ? 'baixa' : 'lateral'
  const nome = unidade === 'taxa' ? 'taxa' : 'preço'
  const casas = unidade === 'taxa' ? 3 : 2

  const motivos = [
    `Último fechamento ${num(ultimo, casas)}, média de 21 candles ${sma21 === null ? '-' : num(sma21, casas)} e de 63 candles ${sma63 === null ? '-' : num(sma63, casas)}.`,
    `Variação ${unidade === 'taxa' ? 'da taxa' : 'do preço'} de ${retorno21 === null ? '-' : pct(retorno21, true)} em 21 candles e de ${retorno63 === null ? '-' : pct(retorno63, true)} em 63.`,
    `Suporte recente ${num(minima20, casas)} e resistência recente ${num(maxima20, casas)} (mínima e máxima dos últimos 20 candles).`,
    `Na faixa dos últimos ${janela.length} candles, o ${nome} está em ${posicao52s.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% (0% é a mínima, 100% a máxima).`,
  ]
  if (leitura === 'lateral') {
    motivos.push(acima || abaixo ? `As médias apontam ${acima ? 'alta' : 'baixa'}, mas o movimento de 63 candles é pequeno (menos de ${RETORNO_MINIMO_PCT}%): leitura lateral.` : 'Preço e médias não estão alinhados em uma direção: leitura lateral.')
  }
  const rsi = ifr(fech)
  if (rsi !== null) motivos.push(`IFR de 14 candles em ${num(rsi, 0)}${rsi >= 70 ? ' (região de sobrecompra, acima de 70)' : rsi <= 30 ? ' (região de sobrevenda, abaixo de 30)' : ''}.`)
  const atr = atrPct(candles)
  if (atr !== null) motivos.push(`Amplitude média diária de ${pct(atr)} do preço (ATR de 14 candles): é o tamanho típico de um dia, útil para medir risco.`)
  if (volumeRelativo !== null) motivos.push(`Negociação do último candle em ${num(volumeRelativo, 1)}× a média de 21.`)

  return { leitura, fechamento: ultimo, sma21, sma63, retorno21, retorno63, ifr14: rsi, atr14Pct: atr, minima20, maxima20, minima52s, maxima52s, posicao52s, candlesNaJanela: janela.length, volumeRelativo, motivos }
}

export const ROTULO_LEITURA: Record<LeituraGrafica, string> = { alta: 'Alta', baixa: 'Baixa', lateral: 'Lateral' }
