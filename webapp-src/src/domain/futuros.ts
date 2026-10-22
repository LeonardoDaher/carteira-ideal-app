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

const DIA_MS = 86_400_000
const chaveData = (d: Date) => d.toISOString().slice(0, 10)

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), ao meio-dia UTC. */
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia, 12))
}

const feriadosEmCache = new Map<number, Set<string>>()

/**
 * Feriados nacionais que fecham a B3 e não contam como dia útil no DI: Ano Novo, Carnaval (segunda e terça), Sexta-feira
 * Santa, Tiradentes, Dia do Trabalho, Corpus Christi, Independência, Nossa Senhora Aparecida, Finados, Proclamação da
 * República, Consciência Negra (nacional desde 2024) e Natal. 24 e 31 de dezembro contam como dias úteis. Lei nova ou
 * feriado extraordinário não entram: por isso a contagem é uma boa aproximação, não a da B3.
 */
export function feriadosNacionais(ano: number): Set<string> {
  const guardado = feriadosEmCache.get(ano)
  if (guardado) return guardado
  const p = pascoa(ano).getTime()
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25']
  if (ano >= 2024) fixos.push('11-20')
  const conjunto = new Set<string>(fixos.map((md) => `${ano}-${md}`))
  for (const dias of [-48, -47, -2, 60]) conjunto.add(chaveData(new Date(p + dias * DIA_MS)))
  feriadosEmCache.set(ano, conjunto)
  return conjunto
}

/** Segunda a sexta que não é feriado nacional. */
export function ehDiaUtil(data: Date): boolean {
  const dia = data.getUTCDay()
  return dia !== 0 && dia !== 6 && !feriadosNacionais(data.getUTCFullYear()).has(chaveData(data))
}

/** Dias úteis entre duas datas AAAA-MM-DD (exclui a inicial, inclui a final), sem fim de semana e sem feriados nacionais. */
export function diasUteisAproximados(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T12:00:00Z`)
  const b = Date.parse(`${fim}T12:00:00Z`)
  if (!(b > a)) return 0
  let n = 0
  for (let t = a + DIA_MS; t <= b; t += DIA_MS) if (ehDiaUtil(new Date(t))) n++
  return n
}

/** Primeiro dia útil do mês de vencimento AAAA-MM, sem fim de semana e sem feriados nacionais. */
export function dataVencimentoDI(vencimento: string): string {
  const [ano, mes] = vencimento.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, 1, 12))
  while (!ehDiaUtil(d)) d.setUTCDate(d.getUTCDate() + 1)
  return chaveData(d)
}

/** Preço unitário (PU) do DI para uma taxa (% ao ano) e dias úteis até o vencimento. */
export function puDI(taxaPct: number, diasUteis: number): number {
  return VALOR_FACE_DI / Math.pow(1 + taxaPct / 100, diasUteis / DIAS_UTEIS_ANO)
}

/** Taxa (% ao ano) que corresponde a um PU. */
export function taxaDoPU(pu: number, diasUteis: number): number {
  return (Math.pow(VALOR_FACE_DI / pu, DIAS_UTEIS_ANO / diasUteis) - 1) * 100
}

/** Vencimentos com menos dias úteis que isso ficam fora da curva: a taxa implícita no PU fica instável. */
export const MINIMO_DIAS_CURVA = 5

export interface PontoCurvaDI {
  ticker: string
  vencimento: string
  /** Data do vencimento (primeiro dia útil do mês). */
  data: string
  diasUteis: number
  /** Taxa implícita no PU de ajuste, % ao ano (base 252). */
  taxa: number
  /** Taxa a termo, % ao ano, entre o vencimento anterior e este. null no primeiro. */
  taxaATermo: number | null
  /** Último negócio do dia, % ao ano, quando o vencimento negociou. */
  taxaUltimo: number | null
}

/** Taxa a termo (% ao ano) entre dois vértices, a partir das taxas e dos dias úteis de cada um. */
export function taxaATermo(taxa1: number, du1: number, taxa2: number, du2: number): number | null {
  if (du2 <= du1) return null
  const fator = Math.pow(1 + taxa2 / 100, du2 / DIAS_UTEIS_ANO) / Math.pow(1 + taxa1 / 100, du1 / DIAS_UTEIS_ANO)
  return (Math.pow(fator, DIAS_UTEIS_ANO / (du2 - du1)) - 1) * 100
}

/**
 * Curva de juros do DI1: a taxa de cada vencimento, tirada do PU de ajuste do pregão (o mesmo critério para todos os
 * vencimentos, negociados ou não), e a taxa a termo entre vértices vizinhos. Ordenada por vencimento.
 */
export function curvaDI(contratos: ContratoFuturo[], dataPregao: string): PontoCurvaDI[] {
  const base = [...contratos]
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((c) => {
      const data = dataVencimentoDI(c.vencimento)
      return { c, data, diasUteis: diasUteisAproximados(dataPregao, data) }
    })
    .filter((p) => p.diasUteis >= MINIMO_DIAS_CURVA && p.c.ajuste > 0)
  return base.map((p, i) => {
    const taxa = taxaDoPU(p.c.ajuste, p.diasUteis)
    const anterior = i > 0 ? base[i - 1] : null
    return {
      ticker: p.c.ticker,
      vencimento: p.c.vencimento,
      data: p.data,
      diasUteis: p.diasUteis,
      taxa,
      taxaATermo: anterior ? taxaATermo(taxaDoPU(anterior.c.ajuste, anterior.diasUteis), anterior.diasUteis, taxa, p.diasUteis) : null,
      taxaUltimo: p.c.ultimo,
    }
  })
}

export type FormatoCurva = 'inclinada para cima' | 'inclinada para baixo' | 'plana'

/** Formato da curva: compara o primeiro vértice com pelo menos 21 dias úteis e o último; até 0,25 ponto percentual é "plana". */
export function resumoCurva(curva: PontoCurvaDI[]): { curto: PontoCurvaDI; longo: PontoCurvaDI; spread: number; formato: FormatoCurva } | null {
  const curto = curva.find((p) => p.diasUteis >= 21)
  const longo = curva[curva.length - 1]
  if (!curto || !longo || curto === longo) return null
  const spread = longo.taxa - curto.taxa
  return { curto, longo, spread, formato: spread > 0.25 ? 'inclinada para cima' : spread < -0.25 ? 'inclinada para baixo' : 'plana' }
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
  sma80: number | null
  /** Retorno em 21 e 80 candles, em %. */
  retorno21: number | null
  retorno80: number | null
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

/** Retorno mínimo de 80 candles (%) para a leitura deixar de ser lateral, mesmo limiar da análise das ações (tendencia.ts). */
export const RETORNO_MINIMO_PCT = 3

const pct = (v: number, sinal = false) => `${sinal && v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * Leitura do passado do contínuo, com a mesma regra da aba Tendência das ações (média e retorno de 80 candles): alta = preço acima da média de 21, que está
 * acima da de 80, com retorno de 80 candles de pelo menos +3%; baixa = o inverso; o resto é lateral. No DI, o retorno é da
 * taxa. Precisa de pelo menos 80 candles; com menos, devolve null.
 */
export function analisarSerie(candles: Candle[], unidade: 'preco' | 'taxa' = 'preco'): AnaliseGrafica | null {
  if (candles.length < 80) return null
  const fech = candles.map((c) => c[4])
  const ultimo = fech[fech.length - 1]
  const sma21 = mediaMovel(fech, 21)[fech.length - 1]
  const sma80 = mediaMovel(fech, 80)[fech.length - 1]
  const retorno = (n: number) => (fech.length > n && fech[fech.length - 1 - n] > 0 ? (ultimo / fech[fech.length - 1 - n] - 1) * 100 : null)
  const retorno21 = retorno(21)
  const retorno80 = retorno(80)
  const ult20 = candles.slice(-20)
  const janela = candles.slice(-252)
  const minima20 = Math.min(...ult20.map((c) => c[3]))
  const maxima20 = Math.max(...ult20.map((c) => c[2]))
  const minima52s = Math.min(...janela.map((c) => c[3]))
  const maxima52s = Math.max(...janela.map((c) => c[2]))
  const posicao52s = maxima52s > minima52s ? ((ultimo - minima52s) / (maxima52s - minima52s)) * 100 : 50
  const mediaVol = mediaMovel(candles.map((c) => c[5]), 21)[candles.length - 1]
  const volumeRelativo = mediaVol && mediaVol > 0 ? candles[candles.length - 1][5] / mediaVol : null

  const acima = sma21 !== null && sma80 !== null && ultimo > sma21 && sma21 > sma80
  const abaixo = sma21 !== null && sma80 !== null && ultimo < sma21 && sma21 < sma80
  const r80 = retorno80 ?? 0
  const leitura: LeituraGrafica = acima && r80 >= RETORNO_MINIMO_PCT ? 'alta' : abaixo && r80 <= -RETORNO_MINIMO_PCT ? 'baixa' : 'lateral'
  const nome = unidade === 'taxa' ? 'taxa' : 'preço'
  const casas = unidade === 'taxa' ? 3 : 2

  const motivos = [
    `Último fechamento ${num(ultimo, casas)}, média de 21 candles ${sma21 === null ? '-' : num(sma21, casas)} e de 80 candles ${sma80 === null ? '-' : num(sma80, casas)}.`,
    `Variação ${unidade === 'taxa' ? 'da taxa' : 'do preço'} de ${retorno21 === null ? '-' : pct(retorno21, true)} em 21 candles e de ${retorno80 === null ? '-' : pct(retorno80, true)} em 80.`,
    `Suporte recente ${num(minima20, casas)} e resistência recente ${num(maxima20, casas)} (mínima e máxima dos últimos 20 candles).`,
    `Na faixa dos últimos ${janela.length} candles, o ${nome} está em ${posicao52s.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% (0% é a mínima, 100% a máxima).`,
  ]
  if (leitura === 'lateral') {
    motivos.push(acima || abaixo ? `As médias apontam ${acima ? 'alta' : 'baixa'}, mas o movimento de 80 candles é pequeno (menos de ${RETORNO_MINIMO_PCT}%): leitura lateral.` : 'Preço e médias não estão alinhados em uma direção: leitura lateral.')
  }
  const rsi = ifr(fech)
  if (rsi !== null) motivos.push(`IFR de 14 candles em ${num(rsi, 0)}${rsi >= 70 ? ' (região de sobrecompra, acima de 70)' : rsi <= 30 ? ' (região de sobrevenda, abaixo de 30)' : ''}.`)
  const atr = atrPct(candles)
  if (atr !== null) motivos.push(`Amplitude média diária de ${pct(atr)} do preço (ATR de 14 candles): é o tamanho típico de um dia, útil para medir risco.`)
  if (volumeRelativo !== null) motivos.push(`Negociação do último candle em ${num(volumeRelativo, 1)}× a média de 21.`)

  return { leitura, fechamento: ultimo, sma21, sma80, retorno21, retorno80, ifr14: rsi, atr14Pct: atr, minima20, maxima20, minima52s, maxima52s, posicao52s, candlesNaJanela: janela.length, volumeRelativo, motivos }
}

export const ROTULO_LEITURA: Record<LeituraGrafica, string> = { alta: 'Alta', baixa: 'Baixa', lateral: 'Lateral' }
