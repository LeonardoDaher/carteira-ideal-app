import { DIAS_UTEIS_ANO, gregas, precoBs, volatilidadeImplicita } from './simulaOpcoes'
import { normalizarBusca } from './rendaFii'

// Dados do Simule Opções, gerados por scripts/atualizar-opcoes.mjs (cadastro de instrumentos + COTAHIST da B3).

export type EstiloOpcao = 'americana' | 'europeia'

export interface SerieOpcao {
  codigo: string
  tipo: 'call' | 'put'
  estilo: EstiloOpcao
  strike: number
  /** AAAA-MM-DD */
  vencimento: string
  /** Preço do último negócio da opção (por unidade do ativo), dentro dos últimos pregões lidos. */
  ultimo: number
  /** Pregão desse último negócio, AAAA-MM-DD. */
  dataUltimo: string
  /** Variação (%) contra o fechamento anterior da própria série; null se ela não negociou antes na janela. */
  variacao: number | null
  negocios: number
  /** Volume financeiro (R$) do dia do último negócio. */
  volume: number
}

export interface AtivoComOpcoes {
  ticker: string
  nome: string
  /** Preço do ativo-objeto no mercado à vista (fechamento). */
  cotacao: number
  /** Pregão dessa cotação, AAAA-MM-DD. */
  dataCotacao?: string
  /** Variação (%) da cotação contra o pregão anterior; null/ausente se não houver. */
  variacao?: number | null
  /** Volume financeiro de opções do ativo no último pregão. */
  volumeOpcoes: number
  /** Lote de contrato (100 nas ações, 1 em alguns ETFs). */
  lote: number
  series: SerieOpcao[]
}

export interface SnapshotOpcoes {
  geradoEm: string | null
  dataPregao: string | null
  fonte?: string
  pregoesNaJanela?: number
  ativos: AtivoComOpcoes[]
}

/** Tupla do arquivo publicado: [código, 'C'|'P', 'A'|'E', strike, vencimento, último, data, variação, negócios, volume]. */
export type SerieCompacta = [string, 'C' | 'P', 'A' | 'E', number, string, number, string, number | null, number, number]

export interface SnapshotOpcoesBruto {
  geradoEm: string | null
  dataPregao: string | null
  fonte?: string
  pregoesNaJanela?: number
  ativos: (Omit<AtivoComOpcoes, 'series'> & { series: SerieCompacta[] })[]
}

/** Converte o arquivo compacto (tuplas) no formato de objetos que a tela usa. */
export function expandirSnapshot(bruto: SnapshotOpcoesBruto): SnapshotOpcoes {
  return {
    ...bruto,
    ativos: bruto.ativos.map((a) => ({
      ...a,
      series: a.series.map(([codigo, t, e, strike, vencimento, ultimo, dataUltimo, variacao, negocios, volume]) => ({
        codigo,
        tipo: t === 'C' ? 'call' : 'put',
        estilo: e === 'A' ? 'americana' : 'europeia',
        strike,
        vencimento,
        ultimo,
        dataUltimo,
        variacao,
        negocios,
        volume,
      })),
    })),
  }
}

// ---------------------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------------------

export type FiltroTipo = 'todas' | 'call' | 'put'
export type FiltroEstilo = 'todos' | EstiloOpcao

export interface FiltroSeries {
  tipo: FiltroTipo
  estilo: FiltroEstilo
  /** Vazio = todos os vencimentos. */
  vencimentos: string[]
  /** Strike mínimo e máximo em reais; null = sem limite. */
  strikeMin: number | null
  strikeMax: number | null
  /** true = só séries que negociaram no último pregão. */
  soUltimoPregao: boolean
}

export const FILTRO_VAZIO: FiltroSeries = { tipo: 'todas', estilo: 'todos', vencimentos: [], strikeMin: null, strikeMax: null, soUltimoPregao: false }

/** Filtra as séries por tipo, estilo, vencimentos e faixa de strike (limites incluídos). */
export function filtrarSeries(series: SerieOpcao[], f: FiltroSeries, dataPregao: string | null = null): SerieOpcao[] {
  return series.filter(
    (s) =>
      (f.tipo === 'todas' || s.tipo === f.tipo) &&
      (f.estilo === 'todos' || s.estilo === f.estilo) &&
      (f.vencimentos.length === 0 || f.vencimentos.includes(s.vencimento)) &&
      (f.strikeMin === null || s.strike >= f.strikeMin) &&
      (f.strikeMax === null || s.strike <= f.strikeMax) &&
      (!f.soUltimoPregao || dataPregao === null || s.dataUltimo === dataPregao),
  )
}

/** Faixa de strike a ±pct% do preço do ativo (atalho "perto do preço"), com 2 casas. */
export function faixaPerto(cotacao: number, pct: number): { strikeMin: number; strikeMax: number } {
  const r = (v: number) => Math.round(v * 100) / 100
  return { strikeMin: r(cotacao * (1 - pct / 100)), strikeMax: r(cotacao * (1 + pct / 100)) }
}

/** Vencimentos distintos, em ordem crescente. */
export function vencimentosDe(series: SerieOpcao[]): string[] {
  return [...new Set(series.map((s) => s.vencimento))].sort()
}

/** Menor e maior strike das séries, ou null se não houver. */
export function limitesDeStrike(series: SerieOpcao[]): { min: number; max: number } | null {
  if (series.length === 0) return null
  const strikes = series.map((s) => s.strike)
  return { min: Math.min(...strikes), max: Math.max(...strikes) }
}

/** Busca ativos por código ou parte do nome. Código exato primeiro. Até `limite` resultados. */
export function buscarAtivos(ativos: AtivoComOpcoes[], termo: string, limite = 8): AtivoComOpcoes[] {
  const t = normalizarBusca(termo)
  if (t.length < 1) return []
  const pontuar = (a: AtivoComOpcoes) => {
    if (a.ticker === t) return 0
    if (a.ticker.startsWith(t)) return 1
    if (normalizarBusca(a.nome).includes(t)) return 2
    if (a.ticker.includes(t)) return 3
    return null
  }
  return ativos
    .map((a) => ({ a, p: pontuar(a) }))
    .filter((x): x is { a: AtivoComOpcoes; p: number } => x.p !== null)
    .sort((x, y) => x.p - y.p || y.a.volumeOpcoes - x.a.volumeOpcoes)
    .slice(0, limite)
    .map((x) => x.a)
}

// ---------------------------------------------------------------------------------------
// Tempo: dias úteis da B3
// ---------------------------------------------------------------------------------------

/** Feriados em que a B3 não abre (dias de semana), 2026 a 2028. Conferir a cada ano: a B3 publica o calendário. */
const FERIADOS_B3 = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07',
  '2026-10-12', '2026-11-02', '2026-11-20', '2026-12-24', '2026-12-25', '2026-12-31',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-27', '2027-09-07', '2027-10-12',
  '2027-11-02', '2027-11-15', '2027-12-24', '2027-12-31',
  '2028-02-28', '2028-02-29', '2028-04-14', '2028-04-21', '2028-05-01', '2028-06-15', '2028-09-07', '2028-10-12',
  '2028-11-02', '2028-11-15', '2028-11-20', '2028-12-25',
])

const paraUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** Dias corridos entre duas datas AAAA-MM-DD (negativo se o vencimento já passou). */
export function diasAte(vencimento: string, hoje: string): number {
  return Math.round((paraUtc(vencimento) - paraUtc(hoje)) / 86_400_000)
}

/**
 * Dias úteis entre `hoje` e o `vencimento`, sem contar nenhum dos dois (a conta que a B3 e as plataformas de opções
 * mostram: de 16/10/2026 a 19/11/2026 são 22). Zero se o vencimento é amanhã ou já passou.
 */
export function diasUteis(vencimento: string, hoje: string): number {
  let total = 0
  const fim = paraUtc(vencimento)
  for (let t = paraUtc(hoje) + 86_400_000; t < fim; t += 86_400_000) {
    const d = new Date(t)
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6) continue
    if (FERIADOS_B3.has(d.toISOString().slice(0, 10))) continue
    total++
  }
  return total
}

/** Prazo máximo dos vencimentos mostrados: os próximos 6 meses a partir do último pregão. */
export const MESES_DE_VENCIMENTOS = 6

/** Soma meses a uma data AAAA-MM-DD, limitando o dia ao último do mês de destino (31/08 + 6 meses = 28/02). */
export function adicionarMeses(iso: string, meses: number): string {
  const ano = +iso.slice(0, 4)
  const mes = +iso.slice(5, 7) - 1 + meses
  const alvo = Date.UTC(ano + Math.floor(mes / 12), ((mes % 12) + 12) % 12, 1)
  const ultimoDia = new Date(Date.UTC(new Date(alvo).getUTCFullYear(), new Date(alvo).getUTCMonth() + 1, 0)).getUTCDate()
  const d = new Date(alvo)
  d.setUTCDate(Math.min(+iso.slice(8, 10), ultimoDia))
  return d.toISOString().slice(0, 10)
}

/** Só as séries que vencem dentro dos próximos 6 meses (limite incluído). */
export function seriesDosProximosMeses(series: SerieOpcao[], hoje: string, meses = MESES_DE_VENCIMENTOS): SerieOpcao[] {
  const limite = adicionarMeses(hoje, meses)
  return series.filter((s) => s.vencimento <= limite)
}

/**
 * Vencimento mensal ou semanal. As opções mensais vencem na terceira sexta-feira do mês (na quinta, se essa sexta for
 * feriado da B3, como em 19/11/2026); as semanais, nas outras sextas.
 */
export function tipoVencimento(iso: string): 'mensal' | 'semanal' {
  const d = new Date(paraUtc(iso))
  const diaSemana = d.getUTCDay()
  const dia = d.getUTCDate()
  if (diaSemana === 5 && dia >= 15 && dia <= 21) return 'mensal'
  if (diaSemana === 4 && dia >= 14 && dia <= 20) {
    const sexta = new Date(paraUtc(iso) + 86_400_000).toISOString().slice(0, 10)
    if (FERIADOS_B3.has(sexta)) return 'mensal'
  }
  return 'semanal'
}

// ---------------------------------------------------------------------------------------
// Colunas da tabela
// ---------------------------------------------------------------------------------------

/**
 * Situação da opção em relação ao preço do ativo: call com strike abaixo do preço está "dentro do dinheiro" (ITM), com
 * strike muito próximo "no dinheiro" (ATM, até 1%), e acima "fora do dinheiro" (OTM). A put é o inverso.
 */
export function moneyness(tipo: 'call' | 'put', strike: number, cotacao: number): 'ITM' | 'ATM' | 'OTM' {
  if (Math.abs(strike - cotacao) / cotacao <= 0.01) return 'ATM'
  const dentro = tipo === 'call' ? strike < cotacao : strike > cotacao
  return dentro ? 'ITM' : 'OTM'
}

export interface LinhaOpcao extends SerieOpcao {
  situacao: 'ITM' | 'ATM' | 'OTM'
  /** Distância (%) do strike ao preço do ativo: (strike / preço − 1) × 100. */
  distanciaStrike: number
  diasUteis: number
  /** Volatilidade implícita no último preço, em % ao ano; null se o preço não cabe no modelo. */
  volImplicita: number | null
  delta: number | null
  gama: number | null
  /** Variação do preço por dia útil, em reais por opção. */
  tetaReais: number | null
  /** O mesmo teta, em % do preço da opção. */
  tetaPct: number | null
}

/**
 * Colunas calculadas de uma série: distância do strike, dias úteis e, por Black-Scholes (europeu, sem dividendos, com
 * a volatilidade implícita no último preço), delta, gama e teta. É uma estimativa nossa: outras plataformas usam
 * outros modelos e o preço do ativo na hora do negócio, então os números podem diferir.
 */
export function montarLinha(serie: SerieOpcao, cotacao: number, hoje: string, jurosAnual: number): LinhaOpcao {
  const du = diasUteis(serie.vencimento, hoje)
  const base = {
    ...serie,
    situacao: moneyness(serie.tipo, serie.strike, cotacao),
    distanciaStrike: (serie.strike / cotacao - 1) * 100,
    diasUteis: du,
  }
  const vazio = { volImplicita: null, delta: null, gama: null, tetaReais: null, tetaPct: null }
  if (du < 1) return { ...base, ...vazio }
  const r = Math.log(1 + jurosAnual / 100)
  const modelo = { tipo: serie.tipo, s: cotacao, strike: serie.strike, t: du / DIAS_UTEIS_ANO, r }
  const vol = volatilidadeImplicita(modelo, serie.ultimo)
  if (vol === null) return { ...base, ...vazio }
  const g = gregas({ ...modelo, sigma: vol })
  // Mesma conta do preço, mas para ficar claro de onde vem: se o modelo não reproduz o último preço, não mostra.
  if (Math.abs(precoBs({ ...modelo, sigma: vol }) - serie.ultimo) > 0.02) return { ...base, ...vazio }
  return {
    ...base,
    volImplicita: vol * 100,
    delta: g.delta,
    gama: g.gama,
    tetaReais: g.teta,
    tetaPct: (g.teta / serie.ultimo) * 100,
  }
}

export type ChaveOrdem =
  | 'codigo' | 'tipo' | 'estilo' | 'strike' | 'situacao' | 'distanciaStrike' | 'ultimo' | 'variacao' | 'dataUltimo'
  | 'negocios' | 'volume' | 'volImplicita' | 'delta' | 'gama' | 'tetaReais' | 'tetaPct'

export interface Ordem {
  chave: ChaveOrdem
  direcao: 'asc' | 'desc'
}

const ORDEM_SITUACAO = { ITM: 0, ATM: 1, OTM: 2 } as const

/** Ordena sem alterar a lista. Valores vazios (null) vão sempre para o fim, em qualquer direção. */
export function ordenarLinhas(linhas: LinhaOpcao[], ordem: Ordem): LinhaOpcao[] {
  const valor = (l: LinhaOpcao): string | number | null =>
    ordem.chave === 'situacao' ? ORDEM_SITUACAO[l.situacao] : (l[ordem.chave] as string | number | null)
  const sinal = ordem.direcao === 'asc' ? 1 : -1
  return [...linhas].sort((a, b) => {
    const x = valor(a)
    const y = valor(b)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : (x as number) - (y as number)
    return c * sinal || a.codigo.localeCompare(b.codigo)
  })
}
