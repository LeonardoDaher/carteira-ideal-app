// Motor de análise técnica das ações (D119). Módulo PURO: recebe a série diária de uma ação e devolve números e frases
// calculados por regra, sem internet, sem relógio e sem IA. Tudo é leitura do PASSADO: não prevê preço, não promete retorno
// e não é recomendação (D19). A metodologia completa está em docs/15-metodologia-analise-acoes.md.
//
// Limite dos dados: o Boletim de Preços da B3 traz fechamento, mínima, máxima e volume em reais, mas NÃO a abertura. Por isso
// não há candlestick (martelo, engolfo, doji...), e o "gap" é medido entre mínima e máxima de dias seguidos. O volume é
// financeiro (R$), não quantidade de ações nem número de negócios. O histórico guarda até 260 pregões (cerca de 12 meses).

import { mediaMovel } from './futuros'

// ---------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------

/** [fechamento, mínima, máxima, volume em R$ mil] ou null (sem negócio no dia). */
export type PontoSerie = [number, number, number, number] | null

export interface SnapshotSeries {
  geradoEm: string | null
  dataPregao: string | null
  fonte: string
  pregoes: string[]
  referencia: { ticker: string; serie: PontoSerie[] } | null
  alertas: Record<string, { data: string; de: number; para: number }[]>
  ativos: Record<string, PontoSerie[]>
}

export interface Barra {
  data: string
  fech: number
  min: number
  max: number
  /** Volume financeiro em R$ mil. */
  vol: number
}

export type Horizonte = 'curto' | 'medio' | 'longo'
export type Leitura = 'alta' | 'baixa' | 'consolidacao' | 'transicao' | 'insuficiente'
export type Viés = 'altista' | 'moderadamente-altista' | 'neutro' | 'moderadamente-baixista' | 'baixista'

export interface QualidadeDados {
  pregoes: number
  primeiraData: string
  ultimaData: string
  diasSemNegocio: number
  /** Salto de preço entre pregões ainda não confirmado como desdobramento/grupamento (a série pode estar distorcida). */
  saltosNaoConfirmados: { data: string; de: number; para: number }[]
  avisos: string[]
}

export interface TendenciaPeriodo {
  periodo: 'diario' | 'semanal' | 'mensal'
  barras: number
  leitura: Leitura
  /** Estrutura de topos e fundos: dois últimos topos e dois últimos fundos. */
  estrutura: 'alta' | 'baixa' | 'mista' | 'indefinida'
  adx: number | null
  mediaRef: { periodo: number; valor: number } | null
  inclinacaoPct: number | null
  historicoCurto: boolean
  explicacao: string
}

export interface LinhaMedia {
  nome: string
  tipo: 'SMA' | 'EMA'
  periodo: number
  valor: number | null
  distanciaPct: number | null
  /** Variação da média em 5 pregões, em %. */
  inclinacaoPct: number | null
}

export interface Cruzamento {
  data: string
  descricao: string
  direcao: 'alta' | 'baixa'
  pregoesAtras: number
}

export interface Divergencia {
  tipo: 'altista' | 'baixista'
  descricao: string
}

export interface Momentum {
  rsi: { valor: number | null; zona: 'sobrecompra' | 'sobrevenda' | 'neutra' | null; inclinacao: number | null; divergencia: Divergencia | null; leitura: string }
  macd: { linha: number | null; sinal: number | null; histograma: number | null; cruzamentoRecente: Cruzamento | null; acimaDeZero: boolean | null; aceleracao: 'acelerando' | 'desacelerando' | null; divergencia: Divergencia | null; leitura: string }
}

export interface VolumeAnalise {
  /** Média dos últimos 21 pregões, em R$ mil por dia. */
  mediaFinanceira21: number | null
  media20: number | null
  /** Volume do último pregão sobre a média de 20. */
  relativo: number | null
  /** Volume médio nos dias de alta sobre o dos dias de queda, nos últimos 20 pregões. */
  altaSobreQueda: number | null
  /** OBV financeiro: soma do volume em R$ com o sinal da variação do dia (aproximação, sem quantidade de ações). */
  obvTendencia: 'sobe' | 'cai' | 'estavel' | null
  obvConfirmaPreco: boolean | null
  liquidez: 'alta' | 'moderada' | 'baixa'
  leitura: string
}

export interface ZonaPreco {
  tipo: 'suporte' | 'resistencia'
  inferior: number
  superior: number
  distanciaPct: number
  toques: number
  relevancia: 'alta' | 'media' | 'baixa'
  ultimaReacao: string
  confirmacao: string
  invalidacao: string
}

export interface Rompimento {
  zona: { inferior: number; superior: number; tipo: 'suporte' | 'resistencia' }
  situacao: 'confirmado' | 'tentativa' | 'falso'
  data: string
  descricao: string
}

export interface Fibonacci {
  de: number
  ate: number
  direcao: 'alta' | 'baixa'
  niveis: { razao: number; preco: number }[]
}

export interface PadraoGrafico {
  nome: string
  localizacao: string
  criterios: string[]
  direcao: 'alta' | 'baixa' | 'neutra'
  confirmacao: 'confirmado' | 'em formacao'
  invalidacao: string
  objetivo: string | null
  limitacoes: string
}

export interface Volatilidade {
  atr14: number | null
  atrPct: number | null
  /** ATR% atual sobre o de 20 pregões atrás. */
  tendenciaAtr: 'expansao' | 'contracao' | 'estavel' | null
  gaps: { data: string; tipo: 'alta' | 'baixa'; tamanhoPct: number }[]
  movimentoAbruptoPct: number | null
  leitura: string
}

export interface HipoteseOperacional {
  regiaoEntrada: { inferior: number; superior: number }
  confirmacao: string
  invalidacao: number
  stop: number
  metodoStop: string
  alvos: number[]
  riscoRetorno: number | null
  aviso: string | null
}

export interface Cenario {
  nome: 'altista' | 'neutro' | 'baixista'
  ativacao: string
  niveis: number[]
  invalidacao: string
  confirmacoes: string[]
  riscos: string
}

export interface Multitemporal {
  alinhamento: 'alinhado-alta' | 'alinhado-baixa' | 'conflito' | 'sem-direcao'
  situacao: string
  pesos: { diario: number; semanal: number; mensal: number }
  explicacao: string
}

export interface ContextoMercado {
  referencia: string
  tendenciaReferencia: Leitura
  relativo63: number | null
  relativo126: number | null
  linhaRelativa: 'melhorando' | 'piorando' | 'estavel' | null
  leitura: string
}

export interface ComponenteNota {
  nome: string
  peso: number
  nota: number
  porque: string
}

export interface SinalHistorico {
  data: string
  sinal: string
  direcao: 'alta' | 'baixa'
  /** Variação do preço nos 10 pregões seguintes, quando já existem. */
  retorno10: number | null
}

export interface AnaliseTecnica {
  ticker: string
  horizonte: Horizonte
  dataReferencia: string
  preco: number
  qualidade: QualidadeDados
  tendencia: { diario: TendenciaPeriodo; semanal: TendenciaPeriodo; mensal: TendenciaPeriodo }
  medias: LinhaMedia[]
  cruzamentos: Cruzamento[]
  momentum: Momentum
  volume: VolumeAnalise
  zonas: ZonaPreco[]
  rompimentos: Rompimento[]
  fibonacci: Fibonacci | null
  padroes: PadraoGrafico[]
  volatilidade: Volatilidade
  hipotese: HipoteseOperacional | null
  motivoSemHipotese: string | null
  cenarios: Cenario[]
  multitemporal: Multitemporal
  contexto: ContextoMercado | null
  pontuacao: { total: number; componentes: ComponenteNota[]; vies: Viés }
  confianca: { nivel: 'alta' | 'media' | 'baixa'; valor: number; motivos: string[] }
  sinais: SinalHistorico[]
  conclusao: { vies: Viés; semSinal: boolean; resumo: string; favoraveis: string[]; desfavoraveis: string[]; monitorar: string[] }
}

export const PESOS_TECNICOS = { tendencia: 0.3, momentum: 0.2, volume: 0.2, localizacao: 0.15, risco: 0.15 } as const

export const ROTULO_VIES: Record<Viés, string> = {
  altista: 'Viés altista',
  'moderadamente-altista': 'Viés moderadamente altista',
  neutro: 'Neutro ou indefinido',
  'moderadamente-baixista': 'Viés moderadamente baixista',
  baixista: 'Viés baixista',
}

export const ROTULO_LEITURA: Record<Leitura, string> = {
  alta: 'Tendência de alta',
  baixa: 'Tendência de baixa',
  consolidacao: 'Consolidação',
  transicao: 'Transição ou indefinida',
  insuficiente: 'Dados insuficientes',
}

export const SEM_SINAL = 'Sem sinal técnico suficientemente consistente neste momento'

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------

const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number, sinal = false) => `${sinal && v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const num = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const ultimo = <T,>(v: T[]) => v[v.length - 1]
const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Série do app -> barras, sem os pregões anteriores ao primeiro negócio. Dia sem negócio repete o último fechamento, com volume 0. */
export function montarBarras(pregoes: string[], pontos: PontoSerie[]): { barras: Barra[]; diasSemNegocio: number } {
  const datas = pregoes.slice(pregoes.length - pontos.length)
  const barras: Barra[] = []
  let semNegocio = 0
  pontos.forEach((p, i) => {
    if (p) {
      barras.push({ data: datas[i], fech: p[0], min: p[1], max: p[2], vol: p[3] })
    } else if (barras.length) {
      const f = ultimo(barras).fech
      barras.push({ data: datas[i], fech: f, min: f, max: f, vol: 0 })
      semNegocio++
    }
  })
  return { barras, diasSemNegocio: semNegocio }
}

function chaveDaSemana(data: string) {
  const d = new Date(`${data}T12:00:00Z`)
  const dia = (d.getUTCDay() + 6) % 7 // segunda = 0
  d.setUTCDate(d.getUTCDate() - dia)
  return d.toISOString().slice(0, 10)
}

/** Junta pregões em semanas (segunda a sexta) ou meses; a data da barra é a do último pregão do período. */
export function agregar(barras: Barra[], por: 'semana' | 'mes'): Barra[] {
  const grupos = new Map<string, Barra[]>()
  for (const b of barras) {
    const chave = por === 'mes' ? b.data.slice(0, 7) : chaveDaSemana(b.data)
    const g = grupos.get(chave)
    if (g) g.push(b)
    else grupos.set(chave, [b])
  }
  return [...grupos.values()].map((g) => ({
    data: ultimo(g).data,
    fech: ultimo(g).fech,
    min: Math.min(...g.map((b) => b.min)),
    max: Math.max(...g.map((b) => b.max)),
    vol: g.reduce((s, b) => s + b.vol, 0),
  }))
}

export function ema(valores: number[], periodo: number): (number | null)[] {
  const saida: (number | null)[] = []
  if (valores.length < periodo) return valores.map(() => null)
  const k = 2 / (periodo + 1)
  let atual = media(valores.slice(0, periodo))
  for (let i = 0; i < valores.length; i++) {
    if (i < periodo - 1) saida.push(null)
    else if (i === periodo - 1) saida.push(atual)
    else {
      atual = valores[i] * k + atual * (1 - k)
      saida.push(atual)
    }
  }
  return saida
}

/** IFR (RSI) de Wilder em cada ponto; null enquanto faltam candles. */
export function rsiSerie(fech: number[], periodo = 14): (number | null)[] {
  const saida: (number | null)[] = fech.map(() => null)
  if (fech.length <= periodo) return saida
  let ganho = 0
  let perda = 0
  for (let i = 1; i <= periodo; i++) {
    const d = fech[i] - fech[i - 1]
    if (d >= 0) ganho += d
    else perda -= d
  }
  ganho /= periodo
  perda /= periodo
  const valor = () => (perda === 0 ? (ganho === 0 ? 50 : 100) : 100 - 100 / (1 + ganho / perda))
  saida[periodo] = valor()
  for (let i = periodo + 1; i < fech.length; i++) {
    const d = fech[i] - fech[i - 1]
    ganho = (ganho * (periodo - 1) + Math.max(d, 0)) / periodo
    perda = (perda * (periodo - 1) + Math.max(-d, 0)) / periodo
    saida[i] = valor()
  }
  return saida
}

export function macdSerie(fech: number[], rapida = 12, lenta = 26, sinal = 9) {
  const er = ema(fech, rapida)
  const el = ema(fech, lenta)
  const linha: (number | null)[] = fech.map((_, i) => (er[i] !== null && el[i] !== null ? (er[i] as number) - (el[i] as number) : null))
  const primeiro = linha.findIndex((v) => v !== null)
  const sig: (number | null)[] = fech.map(() => null)
  if (primeiro >= 0) {
    const validos = linha.slice(primeiro) as number[]
    const es = ema(validos, sinal)
    es.forEach((v, j) => (sig[primeiro + j] = v))
  }
  const hist = linha.map((v, i) => (v !== null && sig[i] !== null ? v - (sig[i] as number) : null))
  return { linha, sinal: sig, hist }
}

/** Amplitude média verdadeira (suavização de Wilder) em cada ponto. */
export function atrSerie(b: Barra[], periodo = 14): (number | null)[] {
  const saida: (number | null)[] = b.map(() => null)
  if (b.length <= periodo) return saida
  const tr = (i: number) => Math.max(b[i].max - b[i].min, Math.abs(b[i].max - b[i - 1].fech), Math.abs(b[i].min - b[i - 1].fech))
  let atr = 0
  for (let i = 1; i <= periodo; i++) atr += tr(i)
  atr /= periodo
  saida[periodo] = atr
  for (let i = periodo + 1; i < b.length; i++) {
    atr = (atr * (periodo - 1) + tr(i)) / periodo
    saida[i] = atr
  }
  return saida
}

/** ADX de Wilder (força da tendência, sem direção); null se faltarem candles. */
export function adxSerie(b: Barra[], periodo = 14): (number | null)[] {
  const n = b.length
  const saida: (number | null)[] = b.map(() => null)
  if (n < periodo * 2 + 1) return saida
  const tr: number[] = [0]
  const mmMais: number[] = [0]
  const mmMenos: number[] = [0]
  for (let i = 1; i < n; i++) {
    const cima = b[i].max - b[i - 1].max
    const baixo = b[i - 1].min - b[i].min
    mmMais.push(cima > baixo && cima > 0 ? cima : 0)
    mmMenos.push(baixo > cima && baixo > 0 ? baixo : 0)
    tr.push(Math.max(b[i].max - b[i].min, Math.abs(b[i].max - b[i - 1].fech), Math.abs(b[i].min - b[i - 1].fech)))
  }
  let trS = tr.slice(1, periodo + 1).reduce((s, v) => s + v, 0)
  let maisS = mmMais.slice(1, periodo + 1).reduce((s, v) => s + v, 0)
  let menosS = mmMenos.slice(1, periodo + 1).reduce((s, v) => s + v, 0)
  const dx: number[] = []
  const calcDx = () => {
    const di1 = trS > 0 ? (100 * maisS) / trS : 0
    const di2 = trS > 0 ? (100 * menosS) / trS : 0
    return di1 + di2 > 0 ? (100 * Math.abs(di1 - di2)) / (di1 + di2) : 0
  }
  dx.push(calcDx())
  for (let i = periodo + 1; i < n; i++) {
    trS = trS - trS / periodo + tr[i]
    maisS = maisS - maisS / periodo + mmMais[i]
    menosS = menosS - menosS / periodo + mmMenos[i]
    dx.push(calcDx())
  }
  // dx[j] corresponde ao índice periodo + j
  let adx = media(dx.slice(0, periodo))
  saida[periodo * 2 - 1] = adx
  for (let j = periodo; j < dx.length; j++) {
    adx = (adx * (periodo - 1) + dx[j]) / periodo
    saida[periodo + j] = adx
  }
  return saida
}

export interface Pivo {
  i: number
  preco: number
}

/** Topos e fundos locais: o ponto é o maior (menor) de `k` barras de cada lado. Só pivôs já confirmados (com `k` barras depois). */
export function pivos(b: Barra[], k: number): { altos: Pivo[]; baixos: Pivo[] } {
  const altos: Pivo[] = []
  const baixos: Pivo[] = []
  for (let i = k; i < b.length - k; i++) {
    let alto = true
    let baixo = true
    for (let j = 1; j <= k; j++) {
      if (b[i].max < b[i - j].max || b[i].max <= b[i + j].max) alto = false
      if (b[i].min > b[i - j].min || b[i].min >= b[i + j].min) baixo = false
    }
    if (alto) altos.push({ i, preco: b[i].max })
    if (baixo) baixos.push({ i, preco: b[i].min })
  }
  return { altos, baixos }
}

function inclinacaoMedia(serie: (number | null)[], janela: number): number | null {
  const n = serie.length
  const atual = serie[n - 1]
  const antes = serie[n - 1 - janela]
  return atual !== null && antes !== null && antes > 0 ? (atual / antes - 1) * 100 : null
}

// ---------------------------------------------------------------------------------------
// Tendência
// ---------------------------------------------------------------------------------------

const MINIMO_BARRAS: Record<TendenciaPeriodo['periodo'], number> = { diario: 60, semanal: 30, mensal: 10 }
const PIVO_K: Record<TendenciaPeriodo['periodo'], number> = { diario: 5, semanal: 3, mensal: 1 }

/** Estrutura pelos dois últimos topos e fundos (com folga de 0,2% para ruído). */
function estruturaDe(b: Barra[], k: number): TendenciaPeriodo['estrutura'] {
  const { altos, baixos } = pivos(b, k)
  if (altos.length < 2 || baixos.length < 2) return 'indefinida'
  const [a1, a2] = altos.slice(-2)
  const [b1, b2] = baixos.slice(-2)
  const topoSobe = a2.preco > a1.preco * 1.002
  const topoCai = a2.preco < a1.preco * 0.998
  const fundoSobe = b2.preco > b1.preco * 1.002
  const fundoCai = b2.preco < b1.preco * 0.998
  if (topoSobe && fundoSobe) return 'alta'
  if (topoCai && fundoCai) return 'baixa'
  return 'mista'
}

export function tendenciaDoPeriodo(b: Barra[], periodo: TendenciaPeriodo['periodo']): TendenciaPeriodo {
  const n = b.length
  const base = { periodo, barras: n, historicoCurto: false }
  if (n < MINIMO_BARRAS[periodo]) {
    return { ...base, leitura: 'insuficiente', estrutura: 'indefinida', adx: null, mediaRef: null, inclinacaoPct: null, explicacao: `Só ${n} ${periodo === 'mensal' ? 'meses' : periodo === 'semanal' ? 'semanas' : 'pregões'} de histórico: dados insuficientes para a leitura (mínimo ${MINIMO_BARRAS[periodo]}).` }
  }
  const fech = b.map((x) => x.fech)
  // Média de referência: 50 pregões no diário, 21 semanas no semanal e 6 meses no mensal (o histórico guardado é curto), sempre
  // com folga para medir a inclinação.
  const janelaInclinacao = periodo === 'diario' ? 10 : periodo === 'semanal' ? 6 : 3
  const periodoMedia = Math.min(periodo === 'diario' ? 50 : periodo === 'semanal' ? 21 : 6, n - janelaInclinacao - 1)
  const mm = mediaMovel(fech, periodoMedia)
  const valorMedia = ultimo(mm)
  const inclinacao = inclinacaoMedia(mm, janelaInclinacao)
  const estrutura = estruturaDe(b, PIVO_K[periodo])
  const adx = ultimo(adxSerie(b))
  const preco = ultimo(fech)

  const votoPreco = valorMedia === null ? 0 : preco > valorMedia ? 1 : -1
  const votoInclinacao = inclinacao === null ? 0 : inclinacao > 0.5 ? 1 : inclinacao < -0.5 ? -1 : 0
  // Movimento sem nenhuma correção não forma topos e fundos: com ADX forte, a direção da inclinação faz o papel da estrutura.
  const semCorrecao = estrutura === 'indefinida' && adx !== null && adx >= 25
  const votoEstrutura = estrutura === 'alta' ? 1 : estrutura === 'baixa' ? -1 : semCorrecao ? votoInclinacao : 0
  const soma = votoEstrutura + votoPreco + votoInclinacao
  // Alta ou baixa exige que a estrutura de topos e fundos ou a inclinação concorde com o preço: nunca só o preço contra uma média.
  const leitura: Leitura =
    soma >= 2 && (votoEstrutura === 1 || votoInclinacao === 1) ? 'alta' : soma <= -2 && (votoEstrutura === -1 || votoInclinacao === -1) ? 'baixa' : adx !== null && adx < 20 ? 'consolidacao' : 'transicao'

  const nomeEstrutura = { alta: 'topos e fundos ascendentes', baixa: 'topos e fundos descendentes', mista: 'topos e fundos sem sequência definida', indefinida: semCorrecao ? 'movimento direcional sem correções relevantes (poucos topos e fundos)' : 'poucos topos e fundos para avaliar' }[estrutura]
  const unidade = periodo === 'mensal' ? 'meses' : periodo === 'semanal' ? 'semanas' : 'pregões'
  const explicacao = [
    `Estrutura: ${nomeEstrutura}.`,
    valorMedia === null ? null : `Preço ${preco > valorMedia ? 'acima' : 'abaixo'} da média de ${periodoMedia} ${unidade} (${reais(valorMedia)})${inclinacao === null ? '' : `, que ${inclinacao > 0.5 ? 'sobe' : inclinacao < -0.5 ? 'cai' : 'está estável'} (${pct(inclinacao, true)} em ${janelaInclinacao} ${unidade})`}.`,
    adx === null ? null : `ADX ${num(adx, 0)}: ${adx >= 25 ? 'tendência forte' : adx >= 20 ? 'tendência moderada' : 'sem tendência definida'}.`,
    periodo === 'mensal' ? 'Histórico curto (menos de 24 meses): leitura de baixa confiança.' : null,
  ]
    .filter(Boolean)
    .join(' ')
  return { ...base, historicoCurto: periodo === 'mensal', leitura, estrutura, adx, mediaRef: valorMedia === null ? null : { periodo: periodoMedia, valor: valorMedia }, inclinacaoPct: inclinacao, explicacao }
}

// ---------------------------------------------------------------------------------------
// Médias móveis e cruzamentos
// ---------------------------------------------------------------------------------------

export const PERIODOS_PADRAO = { sma: [9, 21, 50, 200], ema: [9, 21] } as const

export function linhasDeMedias(fech: number[], periodos: { sma: readonly number[]; ema: readonly number[] } = PERIODOS_PADRAO): LinhaMedia[] {
  const preco = ultimo(fech)
  const linha = (tipo: 'SMA' | 'EMA', periodo: number): LinhaMedia => {
    const serie = tipo === 'SMA' ? mediaMovel(fech, periodo) : ema(fech, periodo)
    const valor = ultimo(serie)
    return { nome: `${tipo} ${periodo}`, tipo, periodo, valor, distanciaPct: valor === null ? null : (preco / valor - 1) * 100, inclinacaoPct: inclinacaoMedia(serie, 5) }
  }
  return [...periodos.sma.map((p) => linha('SMA', p)), ...periodos.ema.map((p) => linha('EMA', p))]
}

function cruzamentosEntre(b: Barra[], curta: (number | null)[], longa: (number | null)[], nomeCurta: string, nomeLonga: string, janela: number): Cruzamento[] {
  const saida: Cruzamento[] = []
  const n = b.length
  for (let i = Math.max(1, n - janela); i < n; i++) {
    const a0 = curta[i - 1]
    const b0 = longa[i - 1]
    const a1 = curta[i]
    const b1 = longa[i]
    if (a0 === null || b0 === null || a1 === null || b1 === null) continue
    if (a0 <= b0 && a1 > b1) saida.push({ data: b[i].data, descricao: `${nomeCurta} cruzou ${nomeLonga} para cima`, direcao: 'alta', pregoesAtras: n - 1 - i })
    if (a0 >= b0 && a1 < b1) saida.push({ data: b[i].data, descricao: `${nomeCurta} cruzou ${nomeLonga} para baixo`, direcao: 'baixa', pregoesAtras: n - 1 - i })
  }
  return saida
}

// ---------------------------------------------------------------------------------------
// Momentum
// ---------------------------------------------------------------------------------------

/** Divergência entre preço e indicador nos dois últimos topos (baixista) ou fundos (altista). */
function divergenciaDe(pv: { altos: Pivo[]; baixos: Pivo[] }, indicador: (number | null)[], nome: string): Divergencia | null {
  const [a1, a2] = pv.altos.slice(-2)
  const [b1, b2] = pv.baixos.slice(-2)
  const i = (p: Pivo) => indicador[p.i]
  if (a1 && a2 && i(a1) !== null && i(a2) !== null && a2.preco > a1.preco && (i(a2) as number) < (i(a1) as number)) {
    return { tipo: 'baixista', descricao: `Preço fez topo mais alto, mas o ${nome} fez topo mais baixo (divergência baixista).` }
  }
  if (b1 && b2 && i(b1) !== null && i(b2) !== null && b2.preco < b1.preco && (i(b2) as number) > (i(b1) as number)) {
    return { tipo: 'altista', descricao: `Preço fez fundo mais baixo, mas o ${nome} fez fundo mais alto (divergência altista).` }
  }
  return null
}

function analisarMomentum(b: Barra[], tendenciaDiaria: Leitura): Momentum {
  const fech = b.map((x) => x.fech)
  const n = b.length
  const rsi = rsiSerie(fech)
  const r = ultimo(rsi)
  const r5 = n > 5 ? rsi[n - 6] : null
  const pv = pivos(b, 5)
  const divRsi = divergenciaDe(pv, rsi, 'IFR')
  const zona = r === null ? null : r >= 70 ? 'sobrecompra' : r <= 30 ? 'sobrevenda' : 'neutra'
  let leituraRsi = r === null ? 'IFR indisponível (histórico curto).' : `IFR de 14 pregões em ${num(r, 0)}`
  if (r !== null) {
    if (zona === 'sobrecompra') leituraRsi += tendenciaDiaria === 'alta' ? ': acima de 70, mas em tendência de alta forte o IFR pode permanecer alto por semanas; não é ordem de venda.' : ': região de sobrecompra, sem tendência de alta que a sustente; atenção a realização.'
    else if (zona === 'sobrevenda') leituraRsi += tendenciaDiaria === 'baixa' ? ': abaixo de 30, mas em tendência de baixa o IFR pode seguir baixo; não é ordem de compra.' : ': região de sobrevenda, sem tendência de baixa que a sustente; possível repique.'
    else leituraRsi += r >= 50 ? ': acima de 50, momentum comprador moderado.' : ': abaixo de 50, momentum vendedor moderado.'
  }

  const m = macdSerie(fech)
  const linha = ultimo(m.linha)
  const sig = ultimo(m.sinal)
  const hist = ultimo(m.hist)
  const histAnt = n > 1 ? m.hist[n - 2] : null
  const cruz = cruzamentosEntre(b, m.linha, m.sinal, 'MACD', 'linha de sinal', 10).pop() ?? null
  const divMacd = divergenciaDe(pv, m.linha, 'MACD')
  const aceleracao = hist === null || histAnt === null ? null : Math.abs(hist) > Math.abs(histAnt) ? 'acelerando' : 'desacelerando'
  let leituraMacd = 'MACD indisponível (histórico curto).'
  if (linha !== null && sig !== null && hist !== null) {
    leituraMacd = `MACD ${linha > sig ? 'acima' : 'abaixo'} da linha de sinal e ${linha > 0 ? 'acima' : 'abaixo'} de zero; histograma ${hist >= 0 ? 'positivo' : 'negativo'}${aceleracao ? ` e ${aceleracao === 'acelerando' ? 'ganhando' : 'perdendo'} força` : ''}.`
    if (cruz) leituraMacd += ` Cruzamento recente: ${cruz.descricao} em ${dataBr(cruz.data)}.`
  }
  return {
    rsi: { valor: r, zona, inclinacao: r !== null && r5 !== null ? r - r5 : null, divergencia: divRsi, leitura: leituraRsi + (divRsi ? ` ${divRsi.descricao}` : '') },
    macd: { linha, sinal: sig, histograma: hist, cruzamentoRecente: cruz, acimaDeZero: linha === null ? null : linha > 0, aceleracao, divergencia: divMacd, leitura: leituraMacd + (divMacd ? ` ${divMacd.descricao}` : '') },
  }
}

// ---------------------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------------------

function analisarVolume(b: Barra[]): VolumeAnalise {
  const n = b.length
  const vol = b.map((x) => x.vol)
  const m21 = n >= 21 ? media(vol.slice(-21)) : null
  const m20 = n >= 20 ? media(vol.slice(-20)) : null
  const relativo = m20 && m20 > 0 ? ultimo(vol) / m20 : null
  const alta: number[] = []
  const queda: number[] = []
  for (let i = Math.max(1, n - 20); i < n; i++) (b[i].fech >= b[i - 1].fech ? alta : queda).push(b[i].vol)
  const altaSobreQueda = alta.length && queda.length && media(queda) > 0 ? media(alta) / media(queda) : null

  // OBV financeiro e sua tendência em 20 pregões, comparada à do preço.
  const obv: number[] = [0]
  for (let i = 1; i < n; i++) obv.push(obv[i - 1] + (b[i].fech > b[i - 1].fech ? b[i].vol : b[i].fech < b[i - 1].fech ? -b[i].vol : 0))
  let obvTendencia: VolumeAnalise['obvTendencia'] = null
  let obvConfirma: boolean | null = null
  if (n > 21) {
    const dObv = obv[n - 1] - obv[n - 21]
    const refVol = (m20 ?? 0) * 20
    const rel = refVol > 0 ? dObv / refVol : 0
    obvTendencia = rel > 0.1 ? 'sobe' : rel < -0.1 ? 'cai' : 'estavel'
    const dPreco = b[n - 1].fech - b[n - 21].fech
    obvConfirma = obvTendencia === 'estavel' ? null : (obvTendencia === 'sobe') === dPreco > 0
  }
  // Liquidez pelo volume financeiro médio diário (R$ mil): abaixo de R$ 1 mi é baixa; até R$ 10 mi, moderada.
  const liquidez: VolumeAnalise['liquidez'] = m21 === null || m21 < 1000 ? 'baixa' : m21 < 10000 ? 'moderada' : 'alta'
  const partes: string[] = []
  if (relativo !== null) partes.push(`Volume do último pregão em ${num(relativo, 1)}× a média de 20.`)
  if (altaSobreQueda !== null) partes.push(`Nos últimos 20 pregões, os dias de alta negociaram ${num(altaSobreQueda, 2)}× o volume dos dias de queda${altaSobreQueda > 1.1 ? ' (participação compradora maior)' : altaSobreQueda < 0.9 ? ' (participação vendedora maior)' : ''}.`)
  if (obvConfirma !== null) partes.push(obvConfirma ? 'O OBV financeiro confirma a direção do preço.' : 'O OBV financeiro diverge do preço (sem confirmação pelo volume).')
  if (liquidez === 'baixa') partes.push('Liquidez baixa: sinais falsos, spreads maiores e dificuldade de execução são mais prováveis.')
  partes.push('O volume é financeiro (R$), sem quantidade de ações e sem número de negócios; não indica, por si só, atuação de investidores institucionais.')
  return { mediaFinanceira21: m21, media20: m20, relativo, altaSobreQueda, obvTendencia, obvConfirmaPreco: obvConfirma, liquidez, leitura: partes.join(' ') }
}

// ---------------------------------------------------------------------------------------
// Suportes, resistências, rompimentos, Fibonacci
// ---------------------------------------------------------------------------------------

interface Aglomerado {
  precos: number[]
  indices: number[]
}

/** Agrupa pivôs próximos (até `tolerancia` de distância relativa) em zonas. */
function aglomerar(pivosTodos: Pivo[], tolerancia: number): Aglomerado[] {
  const ordenados = [...pivosTodos].sort((a, c) => a.preco - c.preco)
  const grupos: Aglomerado[] = []
  for (const p of ordenados) {
    const g = grupos[grupos.length - 1]
    if (g && p.preco <= Math.max(...g.precos) * (1 + tolerancia)) {
      g.precos.push(p.preco)
      g.indices.push(p.i)
    } else grupos.push({ precos: [p.preco], indices: [p.i] })
  }
  return grupos
}

export function zonasDePreco(b: Barra[], atrPct: number | null): ZonaPreco[] {
  const n = b.length
  const preco = ultimo(b).fech
  const { altos, baixos } = pivos(b, 4)
  // Tolerância: metade do ATR% (entre 0,8% e 3%), para a zona acompanhar a volatilidade do papel.
  const tol = limitar((atrPct ?? 2) / 100 / 2, 0.008, 0.03)
  const grupos = aglomerar([...altos, ...baixos], tol)
  const zonas: ZonaPreco[] = []
  for (const g of grupos) {
    const toques = g.precos.length
    if (toques < 2) continue
    const inferior = Math.min(...g.precos)
    const superior = Math.max(...g.precos)
    const meio = (inferior + superior) / 2
    const tipo: ZonaPreco['tipo'] = meio < preco ? 'suporte' : 'resistencia'
    // Zona que o preço atravessou há pouco e que fica do outro lado vira suporte/resistência pelo lado atual.
    const recente = Math.max(...g.indices)
    const idade = n - 1 - recente
    const relevancia: ZonaPreco['relevancia'] = toques >= 4 || (toques >= 3 && idade <= 90) ? 'alta' : toques >= 3 || idade <= 60 ? 'media' : 'baixa'
    zonas.push({
      tipo,
      inferior,
      superior,
      distanciaPct: ((meio / preco) - 1) * 100,
      toques,
      relevancia,
      ultimaReacao: b[recente].data,
      confirmacao: tipo === 'resistencia' ? `Fechamento acima de ${reais(superior)} (de preferência por 2 pregões e com volume acima da média).` : `Reação do preço (fechamento voltando acima de ${reais(superior)}) a partir da zona.`,
      invalidacao: tipo === 'resistencia' ? `Rejeição: fechamentos que não superam ${reais(inferior)} e voltam abaixo da zona.` : `Fechamento abaixo de ${reais(inferior)}.`,
    })
  }
  return zonas.sort((a, c) => Math.abs(a.distanciaPct) - Math.abs(c.distanciaPct)).slice(0, 8)
}

/** Rompimentos nos últimos 15 pregões: confirmado (2 fechamentos além da zona, com volume), tentativa ou falso. */
export function detectarRompimentos(b: Barra[], zonas: ZonaPreco[]): Rompimento[] {
  const n = b.length
  const saida: Rompimento[] = []
  const m20 = n >= 20 ? media(b.slice(-21, -1).map((x) => x.vol)) : 0
  for (const z of zonas) {
    // Procura o primeiro pregão recente em que o máximo (resistência) ou a mínima (suporte) passou da zona.
    for (let i = Math.max(1, n - 15); i < n; i++) {
      const rompeu = z.tipo === 'resistencia' ? b[i].max > z.superior && b[i - 1].max <= z.superior : b[i].min < z.inferior && b[i - 1].min >= z.inferior
      if (!rompeu) continue
      const alem = (j: number) => (z.tipo === 'resistencia' ? b[j].fech > z.superior : b[j].fech < z.inferior)
      const fechouAlem = alem(i)
      const dois = i + 1 < n && fechouAlem && alem(i + 1)
      const voltou = i + 1 < n && !alem(n - 1) && n - 1 > i
      const comVolume = m20 > 0 && b[i].vol >= 1.2 * m20
      const verbo = z.tipo === 'resistencia' ? 'acima' : 'abaixo'
      let situacao: Rompimento['situacao']
      let descricao: string
      if (dois && alem(n - 1)) {
        situacao = 'confirmado'
        descricao = `Rompimento ${z.tipo === 'resistencia' ? 'da resistência' : 'do suporte'} confirmado: fechamentos ${verbo} da zona${comVolume ? ', com volume acima da média' : ', mas sem volume expressivo'}.`
      } else if (voltou || (fechouAlem === false && i < n - 1)) {
        situacao = 'falso'
        descricao = `Falso rompimento: o preço passou da zona em ${dataBr(b[i].data)} e voltou para dentro dela.`
      } else {
        situacao = 'tentativa'
        descricao = `Tentativa de rompimento: o preço passou da zona ${fechouAlem ? 'e fechou além dela uma vez' : 'durante o dia, mas não fechou além dela'}; falta confirmação.`
      }
      saida.push({ zona: { inferior: z.inferior, superior: z.superior, tipo: z.tipo }, situacao, data: b[i].data, descricao })
      break
    }
  }
  return saida
}

/** Retração de Fibonacci do maior movimento entre o topo e o fundo dos últimos 252 pregões. */
export function fibonacciDoPeriodo(b: Barra[]): Fibonacci | null {
  const janela = b.slice(-252)
  if (janela.length < 40) return null
  let iTopo = 0
  let iFundo = 0
  janela.forEach((x, i) => {
    if (x.max > janela[iTopo].max) iTopo = i
    if (x.min < janela[iFundo].min) iFundo = i
  })
  const topo = janela[iTopo].max
  const fundo = janela[iFundo].min
  if (!(topo > fundo * 1.05)) return null
  const direcao: Fibonacci['direcao'] = iFundo < iTopo ? 'alta' : 'baixa'
  const razoes = [0.236, 0.382, 0.5, 0.618, 0.786]
  const niveis = razoes.map((r) => ({ razao: r, preco: direcao === 'alta' ? topo - (topo - fundo) * r : fundo + (topo - fundo) * r }))
  return { de: direcao === 'alta' ? fundo : topo, ate: direcao === 'alta' ? topo : fundo, direcao, niveis }
}

// ---------------------------------------------------------------------------------------
// Padrões gráficos (conservador: só o que as regras comprovam)
// ---------------------------------------------------------------------------------------

function regressao(y: number[]): { inclinacao: number; r2: number } {
  const n = y.length
  const mx = (n - 1) / 2
  const my = media(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  y.forEach((v, i) => {
    sxy += (i - mx) * (v - my)
    sxx += (i - mx) ** 2
    syy += (v - my) ** 2
  })
  const inclinacao = sxx ? sxy / sxx : 0
  return { inclinacao, r2: syy ? (sxy * sxy) / (sxx * syy) : 0 }
}

export function detectarPadroes(b: Barra[]): PadraoGrafico[] {
  const n = b.length
  const padroes: PadraoGrafico[] = []
  if (n < 60) return padroes
  const preco = ultimo(b).fech
  const pv = pivos(b, 5)
  const limitacao = 'Padrões são identificados por regra e podem falhar; o histórico guardado tem cerca de 12 meses e a série não traz preço de abertura.'

  // Topo duplo / fundo duplo: dois pivôs a até 3% um do outro, separados por 10 a 80 pregões, com vale/pico intermediário de pelo menos 4%.
  const [a1, a2] = pv.altos.slice(-2)
  if (a1 && a2 && a2.i - a1.i >= 10 && a2.i - a1.i <= 80 && Math.abs(a2.preco / a1.preco - 1) <= 0.03 && n - 1 - a2.i <= 40) {
    const vale = Math.min(...b.slice(a1.i, a2.i + 1).map((x) => x.min))
    const topo = Math.max(a1.preco, a2.preco)
    if (vale <= topo * 0.96) {
      const confirmado = preco < vale
      padroes.push({
        nome: 'Topo duplo',
        localizacao: `${dataBr(b[a1.i].data)} e ${dataBr(b[a2.i].data)}`,
        criterios: [`Dois topos em ${reais(a1.preco)} e ${reais(a2.preco)} (diferença de ${pct(Math.abs(a2.preco / a1.preco - 1) * 100)}).`, `Vale intermediário em ${reais(vale)} (linha de pescoço).`],
        direcao: 'baixa',
        confirmacao: confirmado ? 'confirmado' : 'em formacao',
        invalidacao: `Fechamento acima de ${reais(topo)}.`,
        objetivo: confirmado ? `${reais(vale - (topo - vale))} (altura do padrão projetada abaixo da linha de pescoço)` : null,
        limitacoes: confirmado ? limitacao : `Só vale como sinal de baixa com fechamento abaixo de ${reais(vale)}. ${limitacao}`,
      })
    }
  }
  const [f1, f2] = pv.baixos.slice(-2)
  if (f1 && f2 && f2.i - f1.i >= 10 && f2.i - f1.i <= 80 && Math.abs(f2.preco / f1.preco - 1) <= 0.03 && n - 1 - f2.i <= 40) {
    const pico = Math.max(...b.slice(f1.i, f2.i + 1).map((x) => x.max))
    const fundo = Math.min(f1.preco, f2.preco)
    if (pico >= fundo * 1.04) {
      const confirmado = preco > pico
      padroes.push({
        nome: 'Fundo duplo',
        localizacao: `${dataBr(b[f1.i].data)} e ${dataBr(b[f2.i].data)}`,
        criterios: [`Dois fundos em ${reais(f1.preco)} e ${reais(f2.preco)} (diferença de ${pct(Math.abs(f2.preco / f1.preco - 1) * 100)}).`, `Pico intermediário em ${reais(pico)} (linha de pescoço).`],
        direcao: 'alta',
        confirmacao: confirmado ? 'confirmado' : 'em formacao',
        invalidacao: `Fechamento abaixo de ${reais(fundo)}.`,
        objetivo: confirmado ? `${reais(pico + (pico - fundo))} (altura do padrão projetada acima da linha de pescoço)` : null,
        limitacoes: confirmado ? limitacao : `Só vale como sinal de alta com fechamento acima de ${reais(pico)}. ${limitacao}`,
      })
    }
  }

  // Ombro-cabeça-ombro: três topos, o do meio o maior, ombros a até 5% um do outro.
  const ult3 = pv.altos.slice(-3)
  if (ult3.length === 3 && ult3[2].i - ult3[0].i <= 120 && n - 1 - ult3[2].i <= 40) {
    const [oe, cabeca, od] = ult3
    if (cabeca.preco > oe.preco * 1.03 && cabeca.preco > od.preco * 1.03 && Math.abs(od.preco / oe.preco - 1) <= 0.05) {
      const v1 = Math.min(...b.slice(oe.i, cabeca.i + 1).map((x) => x.min))
      const v2 = Math.min(...b.slice(cabeca.i, od.i + 1).map((x) => x.min))
      const pescoco = Math.max(v1, v2)
      const confirmado = preco < Math.min(v1, v2)
      padroes.push({
        nome: 'Ombro-cabeça-ombro',
        localizacao: `${dataBr(b[oe.i].data)} a ${dataBr(b[od.i].data)}`,
        criterios: [`Ombros em ${reais(oe.preco)} e ${reais(od.preco)}; cabeça em ${reais(cabeca.preco)}.`, `Linha de pescoço entre ${reais(Math.min(v1, v2))} e ${reais(pescoco)}.`],
        direcao: 'baixa',
        confirmacao: confirmado ? 'confirmado' : 'em formacao',
        invalidacao: `Fechamento acima de ${reais(cabeca.preco)}.`,
        objetivo: confirmado ? `${reais(Math.min(v1, v2) - (cabeca.preco - Math.min(v1, v2)))} (altura da cabeça projetada abaixo do pescoço)` : null,
        limitacoes: limitacao,
      })
    }
  }
  const ult3b = pv.baixos.slice(-3)
  if (ult3b.length === 3 && ult3b[2].i - ult3b[0].i <= 120 && n - 1 - ult3b[2].i <= 40) {
    const [oe, cabeca, od] = ult3b
    if (cabeca.preco < oe.preco * 0.97 && cabeca.preco < od.preco * 0.97 && Math.abs(od.preco / oe.preco - 1) <= 0.05) {
      const p1 = Math.max(...b.slice(oe.i, cabeca.i + 1).map((x) => x.max))
      const p2 = Math.max(...b.slice(cabeca.i, od.i + 1).map((x) => x.max))
      const pescoco = Math.min(p1, p2)
      const confirmado = preco > Math.max(p1, p2)
      padroes.push({
        nome: 'Ombro-cabeça-ombro invertido',
        localizacao: `${dataBr(b[oe.i].data)} a ${dataBr(b[od.i].data)}`,
        criterios: [`Ombros em ${reais(oe.preco)} e ${reais(od.preco)}; cabeça em ${reais(cabeca.preco)}.`, `Linha de pescoço entre ${reais(pescoco)} e ${reais(Math.max(p1, p2))}.`],
        direcao: 'alta',
        confirmacao: confirmado ? 'confirmado' : 'em formacao',
        invalidacao: `Fechamento abaixo de ${reais(cabeca.preco)}.`,
        objetivo: confirmado ? `${reais(Math.max(p1, p2) + (Math.max(p1, p2) - cabeca.preco))} (altura da cabeça projetada acima do pescoço)` : null,
        limitacoes: limitacao,
      })
    }
  }

  // Retângulo/consolidação: últimos 30 a 60 pregões dentro de uma faixa de até 12%, com pelo menos 2 toques em cada extremo.
  for (const janela of [60, 40, 30]) {
    const f = b.slice(-janela)
    const topo = Math.max(...f.map((x) => x.max))
    const fundo = Math.min(...f.map((x) => x.min))
    if (fundo > 0 && topo / fundo - 1 <= 0.12) {
      const toquesTopo = f.filter((x) => x.max >= topo * 0.985).length
      const toquesFundo = f.filter((x) => x.min <= fundo * 1.015).length
      if (toquesTopo >= 2 && toquesFundo >= 2) {
        padroes.push({
          nome: 'Consolidação (retângulo)',
          localizacao: `últimos ${janela} pregões`,
          criterios: [`Faixa de ${reais(fundo)} a ${reais(topo)} (amplitude de ${pct((topo / fundo - 1) * 100)}).`, `${toquesTopo} toques perto do topo e ${toquesFundo} perto do fundo.`],
          direcao: 'neutra',
          confirmacao: 'em formacao',
          invalidacao: `Fechamento acima de ${reais(topo)} ou abaixo de ${reais(fundo)}.`,
          objetivo: `${reais(topo + (topo - fundo))} em caso de rompimento para cima, ${reais(fundo - (topo - fundo))} para baixo (altura da faixa projetada)`,
          limitacoes: `O lado do rompimento não é conhecido de antemão. ${limitacao}`,
        })
        break
      }
    }
  }

  // Canal de tendência: regressão dos fechamentos dos últimos 60 pregões com R² de pelo menos 0,6 e inclinação relevante.
  const reg = regressao(b.slice(-60).map((x) => x.fech))
  const inclTotal = (reg.inclinacao * 59) / b[n - 60].fech
  if (reg.r2 >= 0.6 && Math.abs(inclTotal) >= 0.05) {
    padroes.push({
      nome: inclTotal > 0 ? 'Canal de alta' : 'Canal de baixa',
      localizacao: 'últimos 60 pregões',
      criterios: [`Os fechamentos se alinham a uma reta (R² ${num(reg.r2, 2)}), com variação de ${pct(inclTotal * 100, true)} no período.`],
      direcao: inclTotal > 0 ? 'alta' : 'baixa',
      confirmacao: 'confirmado',
      invalidacao: inclTotal > 0 ? 'Perda da parte inferior do canal (fechamentos abaixo da reta de regressão por vários pregões).' : 'Recuperação da parte superior do canal (fechamentos acima da reta de regressão por vários pregões).',
      objetivo: null,
      limitacoes: `Canal ajustado por regressão linear dos fechamentos, não por linhas traçadas sobre topos e fundos. ${limitacao}`,
    })
  }

  // Triângulo: topos e fundos dos últimos 80 pregões convergindo.
  const altos = pv.altos.filter((p) => p.i >= n - 80)
  const baixos = pv.baixos.filter((p) => p.i >= n - 80)
  if (altos.length >= 3 && baixos.length >= 3) {
    const ra = regressao(altos.map((p) => p.preco))
    const rb = regressao(baixos.map((p) => p.preco))
    const passoA = ra.inclinacao / media(altos.map((p) => p.preco))
    const passoB = rb.inclinacao / media(baixos.map((p) => p.preco))
    const plano = 0.004
    let nome: string | null = null
    let direcao: PadraoGrafico['direcao'] = 'neutra'
    if (Math.abs(passoA) <= plano && passoB > plano) {
      nome = 'Triângulo ascendente'
      direcao = 'alta'
    } else if (Math.abs(passoB) <= plano && passoA < -plano) {
      nome = 'Triângulo descendente'
      direcao = 'baixa'
    } else if (passoA < -plano && passoB > plano) {
      nome = 'Triângulo simétrico'
    }
    if (nome) {
      padroes.push({
        nome,
        localizacao: 'últimos 80 pregões',
        criterios: [`${altos.length} topos e ${baixos.length} fundos convergindo.`],
        direcao,
        confirmacao: 'em formacao',
        invalidacao: direcao === 'alta' ? `Fechamento abaixo do último fundo (${reais(ultimo(baixos).preco)}).` : direcao === 'baixa' ? `Fechamento acima do último topo (${reais(ultimo(altos).preco)}).` : `Rompimento da figura em qualquer direção muda a leitura.`,
        objetivo: null,
        limitacoes: `Sem rompimento, é só uma figura em formação. ${limitacao}`,
      })
    }
  }
  return padroes
}

// ---------------------------------------------------------------------------------------
// Volatilidade
// ---------------------------------------------------------------------------------------

function analisarVolatilidade(b: Barra[]): Volatilidade {
  const n = b.length
  const atr = atrSerie(b)
  const atual = ultimo(atr)
  const preco = ultimo(b).fech
  const atrPct = atual !== null ? (atual / preco) * 100 : null
  const antes = n > 20 ? atr[n - 21] : null
  const atrPctAntes = antes !== null ? (antes / b[n - 21].fech) * 100 : null
  const tendenciaAtr = atrPct === null || atrPctAntes === null ? null : atrPct > atrPctAntes * 1.15 ? 'expansao' : atrPct < atrPctAntes * 0.85 ? 'contracao' : 'estavel'
  const gaps: Volatilidade['gaps'] = []
  for (let i = Math.max(1, n - 60); i < n; i++) {
    if (b[i].min > b[i - 1].max) gaps.push({ data: b[i].data, tipo: 'alta', tamanhoPct: (b[i].min / b[i - 1].max - 1) * 100 })
    else if (b[i].max < b[i - 1].min) gaps.push({ data: b[i].data, tipo: 'baixa', tamanhoPct: (b[i].max / b[i - 1].min - 1) * 100 })
  }
  let maior = 0
  for (let i = Math.max(1, n - 60); i < n; i++) maior = Math.max(maior, Math.abs(b[i].fech / b[i - 1].fech - 1) * 100)
  const partes: string[] = []
  if (atrPct !== null) partes.push(`O ATR de 14 pregões é de ${reais(atual as number)} (${pct(atrPct)} do preço): tamanho típico de um dia de oscilação.`)
  if (tendenciaAtr === 'expansao') partes.push('A amplitude dos pregões está se expandindo em relação a 20 pregões atrás.')
  if (tendenciaAtr === 'contracao') partes.push('A amplitude dos pregões está se contraindo; contrações costumam preceder movimentos mais fortes, sem indicar a direção.')
  if (gaps.length) partes.push(`${gaps.length} gap${gaps.length > 1 ? 's' : ''} nos últimos 60 pregões (mínima e máxima de dias seguidos sem sobreposição).`)
  if (maior >= 6) partes.push(`Maior variação diária recente: ${pct(maior)}.`)
  return { atr14: atual, atrPct, tendenciaAtr, gaps: gaps.slice(-5), movimentoAbruptoPct: maior || null, leitura: partes.join(' ') }
}

// ---------------------------------------------------------------------------------------
// Multitemporal, contexto de mercado, pontuação
// ---------------------------------------------------------------------------------------

export const PESOS_POR_HORIZONTE: Record<Horizonte, { diario: number; semanal: number; mensal: number }> = {
  curto: { diario: 0.5, semanal: 0.3, mensal: 0.2 },
  medio: { diario: 0.25, semanal: 0.5, mensal: 0.25 },
  longo: { diario: 0.1, semanal: 0.3, mensal: 0.6 },
}

const notaDaLeitura: Record<Leitura, number> = { alta: 85, baixa: 15, consolidacao: 50, transicao: 50, insuficiente: 50 }

function multitemporal(t: AnaliseTecnica['tendencia'], horizonte: Horizonte): Multitemporal {
  const pesos = PESOS_POR_HORIZONTE[horizonte]
  const { diario: d, semanal: s, mensal: m } = t
  const lido = [d, s, m].filter((x) => x.leitura !== 'insuficiente')
  const altas = lido.filter((x) => x.leitura === 'alta').length
  const baixas = lido.filter((x) => x.leitura === 'baixa').length
  let alinhamento: Multitemporal['alinhamento'] = 'sem-direcao'
  if (lido.length && altas === lido.length) alinhamento = 'alinhado-alta'
  else if (lido.length && baixas === lido.length) alinhamento = 'alinhado-baixa'
  else if (altas && baixas) alinhamento = 'conflito'
  let situacao = 'Sem direção predominante nos períodos analisados.'
  if (alinhamento === 'alinhado-alta') situacao = 'Alta em todos os períodos com dados: tendência de longo, médio e curto prazo na mesma direção.'
  else if (alinhamento === 'alinhado-baixa') situacao = 'Baixa em todos os períodos com dados: tendência de longo, médio e curto prazo na mesma direção.'
  else if (s.leitura === 'alta' && d.leitura !== 'alta') situacao = 'Tendência de alta no semanal com correção ou pausa no diário: o movimento de curto prazo contraria a tendência intermediária.'
  else if (s.leitura === 'baixa' && d.leitura !== 'baixa') situacao = 'Tendência de baixa no semanal com repique ou pausa no diário: o movimento de curto prazo contraria a tendência intermediária.'
  else if (alinhamento === 'conflito') situacao = 'Conflito entre períodos: há leitura de alta e de baixa ao mesmo tempo.'
  else if (d.leitura === 'consolidacao' && s.leitura === 'consolidacao') situacao = 'Consolidação no diário e no semanal.'
  else if (d.leitura === 'alta' && (s.leitura === 'transicao' || s.leitura === 'consolidacao')) situacao = 'Alta no diário, ainda sem confirmação de tendência no semanal: o movimento de curto prazo ainda não virou tendência intermediária.'
  else if (d.leitura === 'baixa' && (s.leitura === 'transicao' || s.leitura === 'consolidacao')) situacao = 'Baixa no diário, ainda sem confirmação de tendência no semanal.'
  else if (d.leitura === 'consolidacao' && (s.leitura === 'alta' || s.leitura === 'baixa')) situacao = `Consolidação no diário dentro de uma tendência de ${s.leitura} no semanal.`
  const maior = (['diario', 'semanal', 'mensal'] as const).reduce((a, c) => (pesos[c] > pesos[a] ? c : a), 'diario' as 'diario' | 'semanal' | 'mensal')
  const explicacao = `Para o horizonte ${horizonte === 'curto' ? 'de curto prazo' : horizonte === 'medio' ? 'de médio prazo' : 'de longo prazo'}, o gráfico ${maior === 'diario' ? 'diário' : maior === 'semanal' ? 'semanal' : 'mensal'} tem o maior peso (${Math.round(pesos[maior] * 100)}%). Um sinal diário isolado não anula uma tendência semanal consolidada.${m.historicoCurto ? ' O mensal usa histórico curto e tem baixa confiança.' : ''}`
  return { alinhamento, situacao, pesos, explicacao }
}

function contextoDeMercado(b: Barra[], pregoes: string[], referencia: SnapshotSeries['referencia']): ContextoMercado | null {
  if (!referencia) return null
  const datas = new Set(b.map((x) => x.data))
  const { barras: ref } = montarBarras(pregoes, referencia.serie)
  const refPorData = new Map(ref.map((x) => [x.data, x.fech]))
  const comuns = b.filter((x) => datas.has(x.data) && refPorData.has(x.data))
  if (comuns.length < 70) return null
  const retorno = (serie: number[], janela: number) => (serie.length > janela ? (serie[serie.length - 1] / serie[serie.length - 1 - janela] - 1) * 100 : null)
  const a = comuns.map((x) => x.fech)
  const r = comuns.map((x) => refPorData.get(x.data) as number)
  const rel = (janela: number) => {
    const ra = retorno(a, janela)
    const rr = retorno(r, janela)
    return ra === null || rr === null ? null : ra - rr
  }
  const razao = a.map((v, i) => v / r[i])
  const mm50 = mediaMovel(razao, 50)
  const linha = ultimo(mm50) === null ? null : ultimo(razao) > (ultimo(mm50) as number) * 1.01 ? 'melhorando' : ultimo(razao) < (ultimo(mm50) as number) * 0.99 ? 'piorando' : 'estavel'
  const tendenciaRef = tendenciaDoPeriodo(ref.filter((x) => datas.has(x.data)), 'diario').leitura
  const r63 = rel(63)
  const r126 = rel(126)
  const partes = [`${referencia.ticker} (ETF do Ibovespa) em ${ROTULO_LEITURA[tendenciaRef].toLowerCase()} no diário.`]
  if (r63 !== null) partes.push(`Em 63 pregões, a ação ${r63 >= 0 ? 'superou' : 'ficou atrás do'} ${referencia.ticker} em ${num(Math.abs(r63))} pontos percentuais.`)
  if (linha) partes.push(`A força relativa ${linha === 'melhorando' ? 'está melhorando' : linha === 'piorando' ? 'está piorando' : 'está estável'} (razão preço da ação ÷ ${referencia.ticker} frente à média de 50 pregões).`)
  partes.push('A leitura do mercado é separada da leitura do ativo; não se atribuem movimentos a notícias.')
  return { referencia: referencia.ticker, tendenciaReferencia: tendenciaRef, relativo63: r63, relativo126: r126, linhaRelativa: linha, leitura: partes.join(' ') }
}

// ---------------------------------------------------------------------------------------
// Sinais históricos
// ---------------------------------------------------------------------------------------

function sinaisHistoricos(b: Barra[]): SinalHistorico[] {
  const n = b.length
  const fech = b.map((x) => x.fech)
  const out: { i: number; sinal: string; direcao: 'alta' | 'baixa' }[] = []
  const adicionar = (cs: Cruzamento[]) => cs.forEach((c) => out.push({ i: n - 1 - c.pregoesAtras, sinal: c.descricao, direcao: c.direcao }))
  const janela = 120
  adicionar(cruzamentosEntre(b, ema(fech, 9), ema(fech, 21), 'MME 9', 'MME 21', janela))
  adicionar(cruzamentosEntre(b, mediaMovel(fech, 50), mediaMovel(fech, 200), 'MMS 50', 'MMS 200', janela))
  const m = macdSerie(fech)
  adicionar(cruzamentosEntre(b, m.linha, m.sinal, 'MACD', 'sinal', janela))
  const rsi = rsiSerie(fech)
  for (let i = Math.max(1, n - janela); i < n; i++) {
    const a = rsi[i - 1]
    const c = rsi[i]
    if (a === null || c === null) continue
    if (a < 70 && c >= 70) out.push({ i, sinal: 'IFR entrou na sobrecompra (70)', direcao: 'baixa' })
    if (a > 30 && c <= 30) out.push({ i, sinal: 'IFR entrou na sobrevenda (30)', direcao: 'alta' })
  }
  for (let i = Math.max(21, n - janela); i < n; i++) {
    const ant = b.slice(i - 20, i)
    if (b[i].fech > Math.max(...ant.map((x) => x.max))) out.push({ i, sinal: 'Fechamento acima da máxima dos 20 pregões anteriores', direcao: 'alta' })
    if (b[i].fech < Math.min(...ant.map((x) => x.min))) out.push({ i, sinal: 'Fechamento abaixo da mínima dos 20 pregões anteriores', direcao: 'baixa' })
  }
  return out
    .sort((a, c) => c.i - a.i)
    .slice(0, 14)
    .map((s) => ({ data: b[s.i].data, sinal: s.sinal, direcao: s.direcao, retorno10: s.i + 10 < n ? (fech[s.i + 10] / fech[s.i] - 1) * 100 : null }))
}

// ---------------------------------------------------------------------------------------
// Pontuação e confiança
// ---------------------------------------------------------------------------------------

export function vieSDaNota(nota: number): Viés {
  return nota >= 65 ? 'altista' : nota >= 55 ? 'moderadamente-altista' : nota > 45 ? 'neutro' : nota > 35 ? 'moderadamente-baixista' : 'baixista'
}

function notaMomentum(m: Momentum): ComponenteNota {
  let nota = 50
  const porque: string[] = []
  if (m.rsi.valor !== null) {
    nota = limitar(50 + (m.rsi.valor - 50), 15, 85)
    porque.push(`IFR ${num(m.rsi.valor, 0)}`)
  }
  if (m.macd.linha !== null && m.macd.sinal !== null && m.macd.histograma !== null) {
    let macd = 50
    macd += m.macd.linha > m.macd.sinal ? 15 : -15
    macd += m.macd.acimaDeZero ? 10 : -10
    macd += m.macd.histograma > 0 ? (m.macd.aceleracao === 'acelerando' ? 10 : 5) : m.macd.aceleracao === 'acelerando' ? -10 : -5
    nota = (nota + limitar(macd, 10, 90)) / 2
    porque.push(`MACD ${m.macd.linha > m.macd.sinal ? 'acima' : 'abaixo'} do sinal`)
  }
  if (m.rsi.divergencia) {
    nota += m.rsi.divergencia.tipo === 'altista' ? 5 : -5
    porque.push(`divergência ${m.rsi.divergencia.tipo}`)
  }
  return { nome: 'Momentum', peso: PESOS_TECNICOS.momentum, nota: Math.round(limitar(nota, 0, 100)), porque: porque.join('; ') || 'dados insuficientes' }
}

function notaVolume(v: VolumeAnalise): ComponenteNota {
  let nota = 50
  const porque: string[] = []
  if (v.altaSobreQueda !== null) {
    nota += limitar((v.altaSobreQueda - 1) * 30, -25, 25)
    porque.push(`volume nas altas ${num(v.altaSobreQueda, 2)}× o das quedas`)
  }
  if (v.obvConfirmaPreco !== null) {
    nota += v.obvTendencia === 'sobe' ? 15 : -15
    porque.push(`OBV ${v.obvTendencia === 'sobe' ? 'sobe' : 'cai'}`)
  }
  if (v.liquidez === 'baixa') {
    nota = 50 + (nota - 50) * 0.5
    porque.push('liquidez baixa reduz o peso do sinal')
  }
  return { nome: 'Volume e confirmação', peso: PESOS_TECNICOS.volume, nota: Math.round(limitar(nota, 0, 100)), porque: porque.join('; ') || 'dados insuficientes' }
}

function notaLocalizacao(zonas: ZonaPreco[], preco: number): ComponenteNota {
  const sup = zonas.filter((z) => z.tipo === 'suporte').sort((a, c) => c.superior - a.superior)[0]
  const res = zonas.filter((z) => z.tipo === 'resistencia').sort((a, c) => a.inferior - c.inferior)[0]
  if (!sup && !res) return { nome: 'Suportes e resistências', peso: PESOS_TECNICOS.localizacao, nota: 50, porque: 'sem zonas relevantes identificadas' }
  const dSup = sup ? (preco - sup.superior) / preco : 0.15
  const dRes = res ? (res.inferior - preco) / preco : 0.15
  const nota = limitar((100 * dRes) / (dSup + dRes || 1), 10, 90)
  return {
    nome: 'Suportes e resistências',
    peso: PESOS_TECNICOS.localizacao,
    nota: Math.round(nota),
    porque: `${res ? `resistência a ${pct(dRes * 100)} do preço` : 'sem resistência próxima (preço perto das máximas do período)'}; ${sup ? `suporte a ${pct(dSup * 100)}` : 'sem suporte próximo'}`,
  }
}

function notaRisco(vol: Volatilidade, liquidez: VolumeAnalise['liquidez']): ComponenteNota {
  const porque: string[] = []
  let nota = 60
  if (vol.atrPct !== null) {
    nota = limitar(100 - (vol.atrPct - 1) * 20, 10, 95)
    porque.push(`ATR de ${pct(vol.atrPct)} do preço`)
  }
  if (vol.gaps.length >= 2) {
    nota -= 8
    porque.push('gaps recentes')
  }
  if (vol.tendenciaAtr === 'expansao') {
    nota -= 5
    porque.push('volatilidade em expansão')
  }
  if (liquidez === 'baixa') {
    nota -= 15
    porque.push('liquidez baixa')
  }
  return { nome: 'Volatilidade e risco', peso: PESOS_TECNICOS.risco, nota: Math.round(limitar(nota, 0, 100)), porque: porque.join('; ') || 'dados insuficientes' }
}

// ---------------------------------------------------------------------------------------
// Cenários e hipótese operacional
// ---------------------------------------------------------------------------------------

function montarCenarios(zonas: ZonaPreco[], m: Momentum, v: VolumeAnalise): Cenario[] {
  const sups = zonas.filter((z) => z.tipo === 'suporte').sort((a, c) => c.superior - a.superior)
  const ress = zonas.filter((z) => z.tipo === 'resistencia').sort((a, c) => a.inferior - c.inferior)
  const s1 = sups[0]
  const s2 = sups[1]
  const r1 = ress[0]
  const r2 = ress[1]
  const volTxt = v.media20 ? 'volume acima da média de 20 pregões' : 'volume acima da média'
  return [
    {
      nome: 'altista',
      ativacao: r1 ? `Fechamento acima de ${reais(r1.superior)} (resistência mais próxima), de preferência por 2 pregões.` : 'Sem resistência próxima identificada: a continuidade depende de o preço fazer novas máximas.',
      niveis: [r1?.superior, r2?.superior].filter((x): x is number => x !== undefined),
      invalidacao: s1 ? `Fechamento abaixo de ${reais(s1.inferior)} (suporte mais próximo).` : 'Perda da mínima dos últimos 20 pregões.',
      confirmacoes: [`${volTxt}`, 'MACD acima da linha de sinal', 'IFR acima de 50'],
      riscos: 'Rompimentos falham com frequência, em especial sem volume; ativos com liquidez baixa dão mais sinais falsos.',
    },
    {
      nome: 'neutro',
      ativacao: s1 && r1 ? `Preço entre ${reais(s1.superior)} (suporte) e ${reais(r1.inferior)} (resistência), sem fechamentos fora da faixa.` : 'Preço sem romper as regiões próximas.',
      niveis: [s1?.superior, r1?.inferior].filter((x): x is number => x !== undefined),
      invalidacao: 'Fechamento fora da faixa, com volume, encerra a consolidação.',
      confirmacoes: ['Amplitude dos pregões em contração', 'IFR perto de 50', 'MACD perto da linha zero'],
      riscos: 'Faixas estreitas podem ser rompidas para os dois lados; operar dentro da faixa exige gestão rigorosa do risco.',
    },
    {
      nome: 'baixista',
      ativacao: s1 ? `Fechamento abaixo de ${reais(s1.inferior)} (suporte mais próximo), de preferência por 2 pregões.` : 'Perda da mínima dos últimos 20 pregões.',
      niveis: [s1?.inferior, s2?.inferior].filter((x): x is number => x !== undefined),
      invalidacao: r1 ? `Fechamento acima de ${reais(r1.superior)} (resistência mais próxima).` : 'Recuperação da máxima dos últimos 20 pregões.',
      confirmacoes: ['Volume acima da média na queda', 'MACD abaixo da linha de sinal', `IFR abaixo de 50${m.rsi.valor !== null ? ` (hoje ${num(m.rsi.valor, 0)})` : ''}`],
      riscos: 'Perdas de suporte também revertem (falso rompimento); a queda pode ter gap, e o stop pode ser executado pior que o preço definido.',
    },
  ]
}

function montarHipotese(b: Barra[], zonas: ZonaPreco[], vol: Volatilidade, vies: Viés, liquidez: VolumeAnalise['liquidez']): { hipotese: HipoteseOperacional | null; motivo: string | null } {
  const preco = ultimo(b).fech
  if (vies !== 'altista' && vies !== 'moderadamente-altista') {
    return { hipotese: null, motivo: `Não há hipótese de compra consistente: o viés atual é "${ROTULO_VIES[vies].toLowerCase()}".` }
  }
  if (liquidez === 'baixa') return { hipotese: null, motivo: 'Liquidez baixa: a execução tem custo e risco altos, e o sinal técnico é pouco confiável.' }
  if (vol.atr14 === null) return { hipotese: null, motivo: 'Sem ATR para medir o risco (histórico curto).' }
  const sups = zonas.filter((z) => z.tipo === 'suporte').sort((a, c) => c.superior - a.superior)
  const ress = zonas.filter((z) => z.tipo === 'resistencia').sort((a, c) => a.inferior - c.inferior)
  const s1 = sups[0]
  if (!s1) return { hipotese: null, motivo: 'Sem suporte identificado para definir o ponto de invalidação.' }
  const stop = s1.inferior - 0.5 * vol.atr14
  const regiao = { inferior: s1.superior, superior: Math.min(preco, s1.superior + vol.atr14) }
  const entrada = (regiao.inferior + regiao.superior) / 2
  const alvos = ress.slice(0, 2).map((z) => z.inferior)
  if (!alvos.length) return { hipotese: null, motivo: 'O preço está perto das máximas do período e não há resistência no histórico guardado para servir de alvo: o risco-retorno não pode ser medido com os dados disponíveis.' }
  const risco = entrada - stop
  const rr = risco > 0 ? (alvos[0] - entrada) / risco : null
  if (rr === null || rr < 1) return { hipotese: null, motivo: `O primeiro alvo está perto demais frente ao risco (relação ${rr === null ? 'indefinida' : num(rr, 1)}): sem hipótese consistente.` }
  const distante = preco - regiao.superior > vol.atr14
  return {
    hipotese: {
      regiaoEntrada: regiao,
      confirmacao: `Reação positiva do preço na região (fechamento acima de ${reais(regiao.superior)}) com IFR acima de 40 e volume sem queda.`,
      invalidacao: s1.inferior,
      stop,
      metodoStop: `Abaixo do suporte mais próximo (${reais(s1.inferior)}) menos meio ATR de 14 pregões (${reais(0.5 * vol.atr14)}).`,
      alvos,
      riscoRetorno: rr,
      aviso: distante ? `O preço está mais de 1 ATR acima da região de entrada: a relação risco-retorno pode ter piorado; esperar recuo ou nova confirmação.` : null,
    },
    motivo: null,
  }
}

// ---------------------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------------------

export interface EntradaTecnica {
  ticker: string
  pregoes: string[]
  pontos: PontoSerie[]
  referencia?: SnapshotSeries['referencia']
  alertas?: SnapshotSeries['alertas'][string]
  horizonte?: Horizonte
}

/** Mínimo de pregões para a análise; abaixo disso devolve null. */
export const MINIMO_PREGOES_TECNICA = 60

export function analisarTecnica(entrada: EntradaTecnica): AnaliseTecnica | null {
  const horizonte = entrada.horizonte ?? 'medio'
  const { barras: b, diasSemNegocio } = montarBarras(entrada.pregoes, entrada.pontos)
  if (b.length < MINIMO_PREGOES_TECNICA) return null
  const n = b.length
  const atual = ultimo(b)
  const preco = atual.fech
  const fech = b.map((x) => x.fech)

  const semanal = agregar(b, 'semana')
  const mensal = agregar(b, 'mes')
  const tendencia = { diario: tendenciaDoPeriodo(b, 'diario'), semanal: tendenciaDoPeriodo(semanal, 'semanal'), mensal: tendenciaDoPeriodo(mensal, 'mensal') }
  const medias = linhasDeMedias(fech)
  const cruzamentos = [
    ...cruzamentosEntre(b, mediaMovel(fech, 9), mediaMovel(fech, 21), 'MMS 9', 'MMS 21', 30),
    ...cruzamentosEntre(b, mediaMovel(fech, 50), mediaMovel(fech, 200), 'MMS 50', 'MMS 200', 120),
  ].sort((a, c) => a.pregoesAtras - c.pregoesAtras)
  const momentum = analisarMomentum(b, tendencia.diario.leitura)
  const volume = analisarVolume(b)
  const volatilidade = analisarVolatilidade(b)
  const zonas = zonasDePreco(b, volatilidade.atrPct)
  const rompimentos = detectarRompimentos(b, zonas)
  const fibonacci = fibonacciDoPeriodo(b)
  const padroes = detectarPadroes(b)
  const multi = multitemporal(tendencia, horizonte)
  const contexto = contextoDeMercado(b, entrada.pregoes, entrada.referencia ?? null)
  const sinais = sinaisHistoricos(b)

  // Nota de tendência: média das leituras dos três períodos pelo peso do horizonte (períodos sem dados saem da conta).
  const pesos = PESOS_POR_HORIZONTE[horizonte]
  const periodos = (['diario', 'semanal', 'mensal'] as const).filter((p) => tendencia[p].leitura !== 'insuficiente')
  const somaPesos = periodos.reduce((s, p) => s + pesos[p], 0)
  let notaTend = somaPesos ? periodos.reduce((s, p) => s + pesos[p] * notaDaLeitura[tendencia[p].leitura], 0) / somaPesos : 50
  const adxD = tendencia.diario.adx
  if (adxD !== null && adxD >= 25) notaTend += notaTend >= 50 ? 5 : -5
  const nTend: ComponenteNota = {
    nome: 'Tendência e estrutura',
    peso: PESOS_TECNICOS.tendencia,
    nota: Math.round(limitar(notaTend, 0, 100)),
    porque: periodos.map((p) => `${p === 'diario' ? 'diário' : p} em ${ROTULO_LEITURA[tendencia[p].leitura].toLowerCase()}`).join('; '),
  }
  const componentes = [nTend, notaMomentum(momentum), notaVolume(volume), notaLocalizacao(zonas, preco), notaRisco(volatilidade, volume.liquidez)]
  const total = Math.round(componentes.reduce((s, c) => s + c.peso * c.nota, 0))
  const vies = vieSDaNota(total)

  // Confiança: qualidade dos dados, concordância entre as evidências e clareza da estrutura. Não é probabilidade de lucro.
  const motivosConf: string[] = []
  let conf = 100
  const saltos = entrada.alertas ?? []
  if (n < 200) { conf -= 15; motivosConf.push(`Só ${n} pregões: a média de 200 pregões não existe.`) }
  if (saltos.length) { conf -= 25; motivosConf.push('Há salto de preço não confirmado como desdobramento: o gráfico pode estar distorcido.') }
  if (diasSemNegocio / n > 0.05) { conf -= 10; motivosConf.push(`${diasSemNegocio} dias sem negócio no período.`) }
  if (volume.liquidez === 'baixa') { conf -= 20; motivosConf.push('Liquidez baixa.') }
  else if (volume.liquidez === 'moderada') conf -= 5
  const sinaisBase = [tendencia.diario.leitura, tendencia.semanal.leitura].map((l) => (l === 'alta' ? 1 : l === 'baixa' ? -1 : 0))
  const sinaisInd = [momentum.rsi.valor === null ? 0 : momentum.rsi.valor > 50 ? 1 : -1, momentum.macd.linha === null || momentum.macd.sinal === null ? 0 : momentum.macd.linha > momentum.macd.sinal ? 1 : -1, volume.obvTendencia === 'sobe' ? 1 : volume.obvTendencia === 'cai' ? -1 : 0]
  const todos = [...sinaisBase, ...sinaisInd]
  const dir = Math.sign(todos.reduce((s, v) => s + v, 0))
  const concordam = todos.filter((v) => v !== 0 && v === dir).length
  const contrarios = todos.filter((v) => v !== 0 && v === -dir).length
  if (dir === 0 || contrarios >= 2) { conf -= 20; motivosConf.push('Os indicadores apontam em direções diferentes.') }
  else if (concordam >= 4) motivosConf.push('Tendência e indicadores concordam.')
  if (tendencia.diario.estrutura === 'indefinida' || tendencia.diario.estrutura === 'mista') { conf -= 10; motivosConf.push('Estrutura de topos e fundos pouco clara.') }
  if (multi.alinhamento === 'conflito') { conf -= 10; motivosConf.push('Períodos gráficos em conflito.') }
  const valorConf = Math.round(limitar(conf, 5, 100))
  const nivelConf = valorConf >= 75 ? 'alta' : valorConf >= 50 ? 'media' : 'baixa'

  const { hipotese, motivo } = montarHipotese(b, zonas, volatilidade, vies, volume.liquidez)
  const cenarios = montarCenarios(zonas, momentum, volume)

  const semSinal = vies === 'neutro' && (nivelConf === 'baixa' || tendencia.diario.leitura === 'consolidacao' || tendencia.diario.leitura === 'transicao')
  const favoraveis: string[] = []
  const desfavoraveis: string[] = []
  const pol = (cond: boolean | null, bom: string, ruim: string) => {
    if (cond === null) return
    ;(cond ? favoraveis : desfavoraveis).push(cond ? bom : ruim)
  }
  pol(tendencia.diario.leitura === 'alta' ? true : tendencia.diario.leitura === 'baixa' ? false : null, 'Tendência diária de alta.', 'Tendência diária de baixa.')
  pol(tendencia.semanal.leitura === 'alta' ? true : tendencia.semanal.leitura === 'baixa' ? false : null, 'Tendência semanal de alta.', 'Tendência semanal de baixa.')
  pol(momentum.macd.linha === null || momentum.macd.sinal === null ? null : momentum.macd.linha > momentum.macd.sinal, 'MACD acima da linha de sinal.', 'MACD abaixo da linha de sinal.')
  pol(momentum.rsi.valor === null ? null : momentum.rsi.valor >= 50, 'IFR acima de 50.', 'IFR abaixo de 50.')
  pol(volume.obvConfirmaPreco === null ? null : volume.obvConfirmaPreco, 'Volume confirma a direção do preço.', 'Volume não confirma a direção do preço.')
  pol(contexto?.linhaRelativa === 'melhorando' ? true : contexto?.linhaRelativa === 'piorando' ? false : null, `Força relativa frente ao ${contexto?.referencia} melhorando.`, `Força relativa frente ao ${contexto?.referencia} piorando.`)
  if (momentum.rsi.zona === 'sobrecompra') desfavoraveis.push('IFR em sobrecompra.')
  if (momentum.rsi.zona === 'sobrevenda') favoraveis.push('IFR em sobrevenda (possível repique).')
  if (momentum.rsi.divergencia) (momentum.rsi.divergencia.tipo === 'altista' ? favoraveis : desfavoraveis).push(momentum.rsi.divergencia.descricao)
  if (volume.liquidez === 'baixa') desfavoraveis.push('Liquidez baixa.')
  const resProx = zonas.filter((z) => z.tipo === 'resistencia')[0]
  const supProx = zonas.filter((z) => z.tipo === 'suporte')[0]
  const monitorar: string[] = []
  if (resProx) monitorar.push(`Fechamento acima de ${reais(resProx.superior)} (resistência a ${pct(resProx.distanciaPct, true)}).`)
  if (supProx) monitorar.push(`Preservação de ${reais(supProx.inferior)} (suporte a ${pct(supProx.distanciaPct, true)}).`)
  monitorar.push('Cruzamento do MACD com a linha de sinal e o IFR em torno de 50.')

  const resumo = semSinal
    ? `${SEM_SINAL}. A pontuação técnica é ${total} de 100 e a confiança, ${nivelConf}.`
    : `${ROTULO_VIES[vies]} (pontuação ${total} de 100, confiança ${nivelConf}). ${multi.situacao}`

  const qualidade: QualidadeDados = {
    pregoes: n,
    primeiraData: b[0].data,
    ultimaData: atual.data,
    diasSemNegocio,
    saltosNaoConfirmados: saltos,
    avisos: [
      'Dados de fim de dia do Boletim de Preços da B3 (não são em tempo real); o último candle é o do último pregão encerrado.',
      'Sem preço de abertura: não há leitura de candlestick (martelo, engolfo, doji).',
      'Preços ajustados apenas a desdobramentos e grupamentos confirmados; dividendos e proventos não ajustam a série.',
      ...(n < 200 ? [`Histórico de ${n} pregões: a média de 200 pregões e o gráfico mensal ficam limitados.`] : []),
      ...(saltos.length ? [`Salto de preço de ${reais(saltos[0].de)} para ${reais(saltos[0].para)} em ${dataBr(saltos[0].data)} ainda não confirmado como desdobramento.`] : []),
    ],
  }

  return {
    ticker: entrada.ticker,
    horizonte,
    dataReferencia: atual.data,
    preco,
    qualidade,
    tendencia,
    medias,
    cruzamentos,
    momentum,
    volume,
    zonas,
    rompimentos,
    fibonacci,
    padroes,
    volatilidade,
    hipotese,
    motivoSemHipotese: motivo,
    cenarios,
    multitemporal: multi,
    contexto,
    pontuacao: { total, componentes, vies },
    confianca: { nivel: nivelConf, valor: valorConf, motivos: motivosConf },
    sinais,
    conclusao: { vies, semSinal, resumo, favoraveis, desfavoraveis, monitorar },
  }
}
