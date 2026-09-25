// Leitura dos dados oficiais de mercado (decisão D15): taxas do Tesouro Direto, indicadores
// do Banco Central e o histórico da Selic e do IPCA para o gráfico.
//
// O arquivo vem de scripts/atualizar-mercado-oficial.mjs (job semanal). Como em rendaFii.ts,
// nada aqui é metodologia proprietária: só formatação e contas simples sobre dados públicos,
// separadas da tela para serem testadas sem renderizar nada.

import type { AtivoKey } from './types'

export type Indexador = 'selic' | 'prefixado' | 'ipca' | 'igpm'
export type TipoTaxa = 'agioSobreSelic' | 'jurosReais' | 'nominal'

export interface TituloTesouro {
  nome: string
  tipo: string
  familia: string
  indexador: Indexador
  tipoTaxa: TipoTaxa
  cupom: string
  /** AAAA-MM-DD */
  vencimento: string
  aVenda: boolean
  taxaCompra: number | null
  puCompra: number | null
  taxaVenda: number | null
  puVenda: number | null
}

export interface Indicador {
  nome: string
  unidade: string
  codigoSgs: number
  /** AAAA-MM-DD. Nas séries mensais (IPCA), o dia 01 representa o mês de referência. */
  data: string
  valor: number
  dataAnterior?: string
  valorAnterior?: number
}

/** Ponto do histórico: [data AAAA-MM-DD, valor]. */
export type PontoHistorico = [string, number]

export interface SerieHistorica {
  nome: string
  unidade: string
  /** true = série em degrau (Selic meta): o valor vale até o próximo ponto. */
  degrau: boolean
  pontos: PontoHistorico[]
}

export interface SnapshotMercado {
  /** `null` = o job ainda não rodou. */
  geradoEm: string | null
  fontes?: { indicadores: string; tesouro: string }
  indicadores: Partial<Record<'selicMeta' | 'cdi' | 'ipcaMes' | 'ipca12m' | 'dolarPtax', Indicador>>
  derivados: { jurosReaisExPost?: { nome: string; unidade: string; valor: number | null } }
  historico?: Partial<Record<'selicMeta' | 'ipca12m', SerieHistorica>>
  /** Mediana do Boletim Focus por ano (premissa do simulador). */
  focus?: { data: string; ipca: Record<string, number>; selic: Record<string, number> }
  tesouro: { dataBase: string | null; titulos: TituloTesouro[] }
}

/** Classes da carteira que são títulos do Tesouro, e a família de título de cada uma. */
export const TESOURO_POR_ATIVO: Partial<Record<AtivoKey, { indexador: Indexador; familia: string }>> = {
  tesouroSelic: { indexador: 'selic', familia: 'Tesouro Selic' },
  tesouroPrefixado: { indexador: 'prefixado', familia: 'Tesouro Prefixado' },
  tesouroIPCA: { indexador: 'ipca', familia: 'Tesouro IPCA+' },
}

/** Classes de renda fixa em que o cenário de juros ajuda a ler a tela. */
export const ATIVOS_COM_CENARIO: AtivoKey[] = ['tesouroSelic', 'tesouroIPCA', 'tesouroPrefixado', 'cdbLiquidez', 'lciLca']

/** A partir de quantos dias o dado ganha aviso de possível desatualização na tela. */
export const DIAS_PARA_AVISO_DEFASAGEM = 10

// ---------------------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------------------

export function porcentagem(valor: number, casas = 2, maxCasas = casas): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: maxCasas })}%`
}

export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-09-21" → "21/09/2026" */
export function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08-01" → "ago/2026" */
export function mesAno(iso: string): string {
  const [a, m] = iso.split('-')
  return `${MESES[Number(m) - 1]}/${a}`
}

export function diasDesde(iso: string, hoje: Date = new Date()): number {
  const [a, m, d] = iso.split('-').map(Number)
  const inicio = Date.UTC(a, m - 1, d)
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  return Math.round((fim - inicio) / 86_400_000)
}

/**
 * A taxa como o investidor lê no Tesouro Direto. As três famílias usam réguas diferentes,
 * por isso o texto sempre diz a régua junto com o número.
 */
export function formatarTaxa(t: Pick<TituloTesouro, 'tipoTaxa' | 'indexador' | 'taxaCompra'>): string {
  if (t.taxaCompra == null) return 'só resgate'
  if (t.tipoTaxa === 'agioSobreSelic') {
    const sinal = t.taxaCompra < 0 ? '−' : '+'
    return `Selic ${sinal} ${porcentagem(Math.abs(t.taxaCompra), 2, 4)}`
  }
  if (t.tipoTaxa === 'jurosReais') return `${t.indexador === 'igpm' ? 'IGP-M' : 'IPCA'} + ${porcentagem(t.taxaCompra)}`
  return `${porcentagem(t.taxaCompra)} a.a.`
}

/** Frase curta que explica a régua da taxa de cada família. */
export const LEITURA_DA_TAXA: Record<Indexador, string> = {
  selic:
    'No Tesouro Selic, a taxa é um ajuste sobre a Selic: "Selic + 0,05%" rende a Selic do período mais 0,05% ao ano. Por isso os números são tão pequenos.',
  prefixado: 'No Prefixado, a taxa é o retorno total ao ano, já conhecido na compra, para quem leva o título até o vencimento.',
  ipca: 'No IPCA+, a taxa é o ganho acima da inflação: o título rende o IPCA do período mais essa taxa ao ano, se levado até o vencimento.',
  igpm: 'No IGP-M+, a taxa é o ganho acima do IGP-M, se o título for levado até o vencimento.',
}

// ---------------------------------------------------------------------------------------
// Consultas ao snapshot
// ---------------------------------------------------------------------------------------

export function temTesouro(s: SnapshotMercado): boolean {
  return s.tesouro.dataBase != null && s.tesouro.titulos.length > 0
}

export function temIndicadores(s: SnapshotMercado): boolean {
  return s.geradoEm != null && s.indicadores.selicMeta != null
}

/** Títulos à venda de uma família, em ordem de vencimento (nunca por maior taxa). */
export function titulosAVenda(s: SnapshotMercado, familia: string): TituloTesouro[] {
  return s.tesouro.titulos
    .filter((t) => t.aVenda && t.familia === familia)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.cupom.localeCompare(b.cupom))
}

// ---------------------------------------------------------------------------------------
// Histórico (gráfico)
// ---------------------------------------------------------------------------------------

/** Valor da série numa data: o último ponto com data menor ou igual. `null` antes do início. */
export function valorEm(pontos: PontoHistorico[], dataIso: string): number | null {
  let valor: number | null = null
  for (const [d, v] of pontos) {
    if (d > dataIso) break
    valor = v
  }
  return valor
}

export type Periodo = '5a' | '10a' | 'tudo'

export const PERIODOS: { id: Periodo; rotulo: string; anos: number | null }[] = [
  { id: '5a', rotulo: '5 anos', anos: 5 },
  { id: '10a', rotulo: '10 anos', anos: 10 },
  { id: 'tudo', rotulo: 'Desde 1999', anos: null },
]

/** Data inicial do período, contada a partir do último ponto da Selic (não do relógio). */
export function inicioDoPeriodo(fimIso: string, periodo: Periodo, primeiroIso: string): string {
  const anos = PERIODOS.find((p) => p.id === periodo)?.anos
  if (anos == null) return primeiroIso
  const [a, m, d] = fimIso.split('-')
  const inicio = `${Number(a) - anos}-${m}-${d}`
  return inicio < primeiroIso ? primeiroIso : inicio
}

/**
 * Recorta a série no período. Na série em degrau, o valor vigente no início do período
 * entra como primeiro ponto, para a linha não começar no meio do gráfico.
 */
export function recortar(serie: SerieHistorica, inicioIso: string, fimIso: string): PontoHistorico[] {
  const dentro = serie.pontos.filter(([d]) => d >= inicioIso && d <= fimIso)
  if (serie.degrau) {
    const vigente = valorEm(serie.pontos, inicioIso)
    if (vigente != null && dentro[0]?.[0] !== inicioIso) dentro.unshift([inicioIso, vigente])
  }
  return dentro
}

/** Uma leitura por mês do período, usada no toque/teclado sobre o gráfico. */
export interface LeituraMensal {
  /** Primeiro dia do mês, AAAA-MM-01 */
  mes: string
  /** Data usada para posicionar a leitura no eixo do tempo */
  data: string
  selic: number | null
  /** `null` quando o IPCA daquele mês ainda não foi divulgado */
  ipca12m: number | null
  jurosReais: number | null
}

/**
 * Meses do período, cada um com a Selic meta vigente no fim do mês (ou no último dia com
 * dado, no mês corrente) e o IPCA 12 meses daquele mês de referência.
 */
export function leiturasMensais(
  selic: SerieHistorica,
  ipca: SerieHistorica | undefined,
  inicioIso: string,
  fimIso: string,
): LeituraMensal[] {
  const ipcaPorMes = new Map((ipca?.pontos ?? []).map(([d, v]) => [d.slice(0, 7), v]))
  const leituras: LeituraMensal[] = []
  let [a, m] = inicioIso.split('-').map(Number)
  const [fa, fm] = fimIso.split('-').map(Number)
  while (a < fa || (a === fa && m <= fm)) {
    const mes = `${a}-${String(m).padStart(2, '0')}`
    const ultimoDia = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
    const data = ultimoDia > fimIso ? fimIso : ultimoDia
    const s = valorEm(selic.pontos, data)
    const i = ipcaPorMes.get(mes) ?? null
    leituras.push({ mes: `${mes}-01`, data, selic: s, ipca12m: i, jurosReais: s != null && i != null ? jurosReais(s, i) : null })
    m++
    if (m > 12) {
      m = 1
      a++
    }
  }
  return leituras.filter((l) => l.selic != null)
}

/** Juro real pela fórmula de Fisher, em % a.a., 2 casas. */
export function jurosReais(selic: number, ipca12m: number): number {
  return Math.round(((1 + selic / 100) / (1 + ipca12m / 100) - 1) * 10_000) / 100
}

/** Topo do eixo Y: múltiplo de 5 acima do maior valor. */
export function topoDoEixo(valores: number[]): number {
  const max = Math.max(5, ...valores)
  return Math.ceil(max / 5) * 5
}

/** Anos marcados no eixo X, espaçados conforme a extensão do período. */
export function anosDoEixo(inicioIso: string, fimIso: string): number[] {
  const a0 = Number(inicioIso.slice(0, 4)) + 1
  const a1 = Number(fimIso.slice(0, 4))
  const extensao = a1 - a0
  const passo = extensao > 16 ? 5 : extensao > 7 ? 2 : 1
  const anos: number[] = []
  for (let a = Math.ceil(a0 / passo) * passo; a <= a1; a += passo) anos.push(a)
  return anos
}

/**
 * Desde quando vale o valor atual de uma série em degrau (ex.: a Selic meta vigente desde
 * a última decisão do Copom que a alterou). `null` se não houver histórico.
 */
export function vigenteDesde(serie: SerieHistorica | undefined): string | null {
  const pontos = serie?.pontos ?? []
  if (pontos.length === 0) return null
  const atual = pontos.at(-1)![1]
  let desde = pontos.at(-1)![0]
  for (let i = pontos.length - 1; i >= 0 && pontos[i][1] === atual; i--) desde = pontos[i][0]
  return desde
}
