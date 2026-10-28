// Motor de análise fundamentalista das ações (D119). Módulo PURO: recebe os fundamentos da CVM (scripts/atualizar-fundamentos.mjs) e o
// preço do dia e devolve indicadores, valor justo por cenário, notas e alertas calculados por regra, sem internet e sem IA. Não é
// recomendação (D19): é uma leitura quantitativa e educacional. Metodologia em docs/15-metodologia-analise-acoes.md.
//
// Limite dos dados: a CVM traz demonstrações, não texto. Por isso vantagem competitiva, gestão, governança qualitativa, TAM e
// projeções de mercado NÃO são inventados: aparecem como "dados insuficientes" ou como indício financeiro, rotulado como tal.

// ---------------------------------------------------------------------------------------
// Tipos dos dados (fundamentos.json)
// ---------------------------------------------------------------------------------------

/** Exercício ou 12 meses, em R$ MIL; null quando o dado não existe na demonstração (nunca zero por omissão). */
export interface PeriodoFundamental {
  exercicio?: string
  periodoAte?: string
  documento?: string
  consolidacao: 'consolidada' | 'individual'
  receita: number | null
  lucroBruto: number | null
  ebit: number | null
  ebitda: number | null
  depreciacao: number | null
  resultadoFinanceiro: number | null
  despesaFinanceira: number | null
  equivalencia: number | null
  lucroLiquido: number | null
  lucroControladores: number | null
  fco: number | null
  capex: number | null
  dividendosPagos: number | null
  ativoTotal: number | null
  ativoCirculante: number | null
  passivoCirculante: number | null
  caixa: number | null
  divida: number | null
  patrimonioLiquido: number | null
  plControladores: number | null
  minoritarios: number | null
  acoes?: number | null
  link: string | null
}

export interface ClasseDeAcao {
  classe: 'ON' | 'PN'
  ticker: string
  quantidade: number
  precoAproximado: boolean
}

export interface EmpresaFundamentos {
  ticker: string
  nome: string
  setor: string
  financeira: boolean
  cnpj: string
  ultimaDemonstracao: { doc: 'DFP' | 'ITR'; dtRefer: string; dtReceb: string | null; versao: number; link: string | null }
  anual: PeriodoFundamental[]
  ttm: PeriodoFundamental | null
  acoes: { classes: ClasseDeAcao[]; documento: string; ajusteUnidade: string | null; ajusteDesdobramento: number | null; pvpImplicito: number | null } | null
  alertas: string[]
}

export interface SnapshotFundamentos {
  versao: string
  geradoEm: string | null
  dataCorte: string | null
  fonte: string
  excluidas: { ticker: string; etapa: string; motivo: string }[]
  empresas: Record<string, EmpresaFundamentos>
}

/** Preço de fechamento de um código, ou null se não houver. */
export type PrecoDe = (ticker: string) => number | null

// ---------------------------------------------------------------------------------------
// Premissas (configuráveis) e tipos do resultado
// ---------------------------------------------------------------------------------------

export interface Premissas {
  /** Taxa de desconto nominal ao ano (custo do capital próprio). */
  taxaDesconto: { pessimista: number; base: number; otimista: number }
  /** Crescimento perpétuo nominal (limitado pela inflação de longo prazo mais um pouco de crescimento real). */
  crescimentoTerminal: { pessimista: number; base: number; otimista: number }
  /** Margem de segurança desejada, em fração do valor justo. */
  margemSegurancaAlvo: number
  /** Alíquota para o NOPAT (a mesma do Top 15 mais baratas). */
  aliquotaNopat: number
  pesos: { qualidade: number; valuation: number; risco: number }
}

export const PREMISSAS_PADRAO: Premissas = {
  taxaDesconto: { pessimista: 0.17, base: 0.15, otimista: 0.13 },
  crescimentoTerminal: { pessimista: 0.03, base: 0.04, otimista: 0.05 },
  margemSegurancaAlvo: 0.25,
  aliquotaNopat: 0.34,
  pesos: { qualidade: 0.4, valuation: 0.35, risco: 0.25 },
}

/**
 * Premissas ancoradas na renda fixa: o custo do capital próprio parte da Selic meta (o que a pessoa ganharia sem risco) mais um
 * prêmio pequeno de 1 ponto percentual; o pessimista soma mais 2 pontos e o otimista subtrai 2. O crescimento terminal parte da
 * inflação de longo prazo (Focus) mais meio ponto de crescimento real. Sem os dados, valem as premissas padrão.
 */
export function premissasDaSelic(selicMetaPct: number | null, ipcaLongoPrazoPct: number | null = null): Partial<Premissas> {
  if (!ok(selicMetaPct)) return {}
  const base = selicMetaPct / 100 + 0.01
  const g = ok(ipcaLongoPrazoPct) ? ipcaLongoPrazoPct / 100 + 0.005 : 0.04
  return {
    taxaDesconto: { pessimista: base + 0.02, base, otimista: Math.max(base - 0.02, g + 0.03) },
    crescimentoTerminal: { pessimista: Math.max(g - 0.01, 0.02), base: g, otimista: g + 0.01 },
  }
}

export type FormatoIndicador = 'pct' | 'x' | 'reais' | 'numero' | 'milhoes'

export interface Indicador {
  id: string
  nome: string
  valor: number | null
  formato: FormatoIndicador
  /** Série dos exercícios (mais antigo ao mais recente) e, no fim, o TTM. */
  historico?: (number | null)[]
  rotulosHistorico?: string[]
  referenciaSetor?: number | null
  interpretacao: string
  formula: string
  fonte: string
  dataReferencia: string
}

export interface ColunaHistorica {
  rotulo: string
  ttm: boolean
  receita: number | null
  crescimentoReceita: number | null
  margemBruta: number | null
  ebitda: number | null
  margemEbitda: number | null
  ebit: number | null
  margemEbit: number | null
  lucroLiquido: number | null
  margemLiquida: number | null
  lpa: number | null
  acoes: number | null
  fco: number | null
  capex: number | null
  fcf: number | null
  dividaLiquida: number | null
  patrimonioLiquido: number | null
  dividendosPagos: number | null
}

export type Cenario = 'pessimista' | 'base' | 'otimista'

export interface CenarioValor {
  cenario: Cenario
  valorJusto: number | null
  potencialPct: number | null
  metodos: { nome: string; valor: number | null; premissas: string }[]
  premissas: string
  invalidacao: string
}

export interface ValorJusto {
  aplicavel: boolean
  motivo: string | null
  cenarios: CenarioValor[]
  faixa: { minimo: number; maximo: number } | null
  confianca: 'alta' | 'media' | 'baixa'
  confiancaMotivos: string[]
  margemSegurancaPct: number | null
  potencialBasePct: number | null
  precoEntrada: number | null
}

export interface Nota {
  nome: string
  nota: number | null
  peso: number
  criterios: { nome: string; nota: number | null; peso: number; detalhe: string }[]
  ausentes: string[]
}

export type CategoriaAnalise = 'atrativa' | 'atrativa-com-ressalvas' | 'neutra' | 'pouco-atrativa' | 'evitar'
export type Recomendacao = 'considerar-entrada' | 'aguardar-preco' | 'manter-acompanhar' | 'reduzir-exposicao' | 'evitar-novos'

export interface Alerta {
  id: string
  titulo: string
  detalhe: string
  gravidade: 'critico' | 'atencao' | 'info'
}

export interface Risco {
  titulo: string
  descricao: string
  probabilidade: 'baixa' | 'media' | 'alta' | 'nao-avaliada'
  impacto: 'baixo' | 'medio' | 'alto'
  monitorar: string
  mitigacao: string
  efeitoNoValor: string
}

export interface AnaliseFundamentalista {
  ticker: string
  nome: string
  setor: string
  financeira: boolean
  mercado: { preco: number | null; valorMercado: number | null; ev: number | null; acoes: number | null; aproximado: boolean }
  dados: { ultimoExercicio: string | null; ultimoTrimestre: string; documento: string; dataCorte: string | null; geradoEm: string | null; exercicios: number; fonte: string; limitacoes: string[] }
  historico: ColunaHistorica[]
  cagr: { receita: number | null; lucro: number | null; lpa: number | null; anos: number }
  rentabilidade: Indicador[]
  endividamentoECaixa: Indicador[]
  multiplos: Indicador[]
  valorJusto: ValorJusto
  dividendos: { aplicavel: boolean; indicadores: Indicador[]; leitura: string }
  vantagem: { classificacao: 'forte' | 'moderada' | 'fraca' | 'nao-demonstrada'; evidencias: string[]; limite: string }
  crescimento: { leitura: string; origem: string }
  governanca: { itens: { tema: string; situacao: string }[] }
  riscos: { especificos: Risco[]; externos: Risco[] }
  pontuacao: { qualidade: Nota; valuation: Nota; risco: Nota; total: number | null; parcial: boolean; pesos: Premissas['pesos'] }
  alertas: Alerta[]
  categoria: CategoriaAnalise
  recomendacao: { categoria: Recomendacao; justificativa: string[]; reavaliar: string[] }
  resumo: string
}

export const ROTULO_CATEGORIA: Record<CategoriaAnalise, string> = {
  atrativa: 'Atrativa',
  'atrativa-com-ressalvas': 'Atrativa com ressalvas',
  neutra: 'Neutra',
  'pouco-atrativa': 'Pouco atrativa',
  evitar: 'Evitar ou reavaliar após melhora dos fundamentos',
}

export const ROTULO_RECOMENDACAO: Record<Recomendacao, string> = {
  'considerar-entrada': 'Considerar entrada',
  'aguardar-preco': 'Aguardar preço mais atrativo',
  'manter-acompanhar': 'Manter / acompanhar',
  'reduzir-exposicao': 'Reduzir exposição',
  'evitar-novos': 'Evitar novos investimentos',
}

export const FONTE_CVM = 'CVM, dados abertos (DFP e ITR); preço de fechamento da B3'

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const ok = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)
const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
const mediana = (v: number[]) => {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}
const desvio = (v: number[]) => {
  const m = media(v)
  return m === null || v.length < 2 ? null : Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1))
}
const dividir = (a: number | null, b: number | null) => (ok(a) && ok(b) && b !== 0 ? a / b : null)
const pct = (v: number, casas = 1) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
const vezes = (v: number, casas = 1) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}×`
const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const milhoesDeMil = (v: number) => `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mi`
const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** Interpolação linear por partes: pontos [x, nota] em ordem crescente de x; fora da faixa, vale a ponta. */
export function interpolar(x: number, pontos: [number, number][]): number {
  if (x <= pontos[0][0]) return pontos[0][1]
  for (let i = 1; i < pontos.length; i++) {
    if (x <= pontos[i][0]) {
      const [x0, y0] = pontos[i - 1]
      const [x1, y1] = pontos[i]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return pontos[pontos.length - 1][1]
}

/** Taxa composta entre o primeiro e o último valor; só existe com os dois positivos. */
export function cagr(inicio: number | null, fim: number | null, anos: number): number | null {
  if (!ok(inicio) || !ok(fim) || inicio <= 0 || fim <= 0 || anos <= 0) return null
  return Math.pow(fim / inicio, 1 / anos) - 1
}

// Setores com dívida estruturalmente mais alta (receita regulada ou contratada de longo prazo): a régua de endividamento sobe.
const SETORES_ALAVANCAGEM_ALTA = /energia|el[eé]trica|saneamento|telecom|rodovia|concess|transporte|log[ií]stica|ferrovia|aeroporto|g[aá]s|utilidade|infraestrutura|geradora|transmiss/i

// ---------------------------------------------------------------------------------------
// Leitura dos períodos
// ---------------------------------------------------------------------------------------

const lucroDosAcionistas = (p: PeriodoFundamental) => (ok(p.lucroControladores) && p.lucroControladores !== 0 ? p.lucroControladores : p.lucroLiquido)
/**
 * Caixa operacional acima de 2× o EBITDA (ou o EBIT) costuma ser financiamento classificado como operação (recebíveis, crédito a
 * clientes) ou evento pontual, não geração de caixa. Mesma trava do Top 15 mais baratas. Sem referência positiva, não se julga.
 */
export function fcoCoerente(p: PeriodoFundamental): boolean {
  if (!ok(p.fco)) return false
  const ref = ok(p.ebitda) && p.ebitda > 0 ? p.ebitda : ok(p.ebit) && p.ebit > 0 ? p.ebit : null
  return ref === null ? true : p.fco <= 2 * ref
}
const fcfDe = (p: PeriodoFundamental) => (ok(p.fco) && ok(p.capex) && fcoCoerente(p) ? p.fco - p.capex : null)
const dividaLiquidaDe = (p: PeriodoFundamental) => (ok(p.divida) ? p.divida - (p.caixa ?? 0) : null)
const lpaDe = (p: PeriodoFundamental) => {
  const l = lucroDosAcionistas(p)
  return ok(l) && ok(p.acoes) && p.acoes > 0 ? (l * 1000) / p.acoes : null
}

function colunas(e: EmpresaFundamentos): ColunaHistorica[] {
  const periodos = [...e.anual.map((p) => ({ p, ttm: false })), ...(e.ttm ? [{ p: e.ttm, ttm: true }] : [])]
  return periodos.map(({ p, ttm }, i) => {
    const anterior = i > 0 && !ttm ? e.anual[i - 1] : ttm ? e.anual[e.anual.length - 1] : null
    // Crescimento do TTM contra o exercício anterior seria de períodos diferentes; só o exercício contra o exercício.
    const crescimentoReceita = ttm ? null : anterior && ok(p.receita) && ok(anterior.receita) && anterior.receita > 0 ? p.receita / anterior.receita - 1 : null
    const fcf = fcfDe(p)
    return {
      rotulo: ttm ? '12 meses' : (p.exercicio ?? '').slice(0, 4),
      ttm,
      receita: p.receita,
      crescimentoReceita,
      margemBruta: dividir(p.lucroBruto, p.receita),
      ebitda: p.ebitda,
      margemEbitda: dividir(p.ebitda, p.receita),
      ebit: p.ebit,
      margemEbit: dividir(p.ebit, p.receita),
      lucroLiquido: lucroDosAcionistas(p),
      margemLiquida: dividir(lucroDosAcionistas(p), p.receita),
      lpa: lpaDe(p),
      acoes: p.acoes ?? null,
      fco: fcoCoerente(p) ? p.fco : null,
      capex: p.capex,
      fcf,
      dividaLiquida: dividaLiquidaDe(p),
      patrimonioLiquido: p.plControladores,
      dividendosPagos: p.dividendosPagos,
    }
  })
}

// ---------------------------------------------------------------------------------------
// Mercado e múltiplos
// ---------------------------------------------------------------------------------------

export interface Mercado {
  preco: number | null
  valorMercado: number | null
  acoes: number | null
  aproximado: boolean
}

/** Valor de mercado em R$ MIL: cada classe pelo próprio preço; sem preço da classe, usa o da outra (marcado como aproximado). */
export function valorDeMercado(e: EmpresaFundamentos, precoDe: PrecoDe): Mercado {
  const preco = precoDe(e.ticker)
  // Quantidade de ações implausível frente ao patrimônio (provável erro de unidade na CVM): sem valor de mercado, sem múltiplos.
  if (!e.acoes?.classes.length || e.alertas.includes('capital_implausivel')) return { preco, valorMercado: null, acoes: null, aproximado: false }
  let total = 0
  let acoes = 0
  let aproximado = false
  for (const c of e.acoes.classes) {
    const p = precoDe(c.ticker) ?? preco
    if (!ok(p)) return { preco, valorMercado: null, acoes: null, aproximado: false }
    if (precoDe(c.ticker) === null || c.precoAproximado) aproximado = true
    total += (c.quantidade * p) / 1000
    acoes += c.quantidade
  }
  return { preco, valorMercado: total, acoes, aproximado }
}

export interface MultiplosEmpresa {
  pl: number | null
  pvp: number | null
  evEbitda: number | null
  evEbit: number | null
  pVendas: number | null
  pFcf: number | null
  dy: number | null
}

export function multiplosDe(e: EmpresaFundamentos, precoDe: PrecoDe): MultiplosEmpresa {
  const vazio: MultiplosEmpresa = { pl: null, pvp: null, evEbitda: null, evEbit: null, pVendas: null, pFcf: null, dy: null }
  const t = e.ttm ?? e.anual[e.anual.length - 1]
  const m = valorDeMercado(e, precoDe)
  if (!t || !ok(m.valorMercado) || m.valorMercado <= 0) return vazio
  const lucro = lucroDosAcionistas(t)
  const dl = dividaLiquidaDe(t)
  const ev = ok(dl) ? m.valorMercado + dl + (t.minoritarios ?? 0) : null
  const fcf = fcfDe(t)
  const positivo = (v: number | null) => (ok(v) && v > 0 ? v : null)
  return {
    pl: ok(lucro) && lucro > 0 ? m.valorMercado / lucro : null,
    pvp: ok(t.plControladores) && t.plControladores > 0 ? m.valorMercado / t.plControladores : null,
    evEbitda: ok(ev) && positivo(t.ebitda) ? ev / (t.ebitda as number) : null,
    evEbit: ok(ev) && positivo(t.ebit) ? ev / (t.ebit as number) : null,
    pVendas: positivo(t.receita) ? m.valorMercado / (t.receita as number) : null,
    pFcf: positivo(fcf) ? m.valorMercado / (fcf as number) : null,
    dy: ok(t.dividendosPagos) ? t.dividendosPagos / m.valorMercado : null,
  }
}

/**
 * Grupos de comparação pela classificação setorial da B3 (D126). O cadastro tem setores pequenos (3 a 6 empresas); quando o setor sozinho
 * não tem 4 pares com o múltiplo, a mediana vem do grupo B3 a que ele pertence. Setor fora desta tabela só se compara com ele mesmo.
 */
export const GRUPOS_B3: Record<string, string> = {
  'Moda e vestuário': 'Tecidos, vestuário e calçados',
  'Calçados e artigos esportivos': 'Tecidos, vestuário e calçados',
  'Têxtil e eletrodomésticos': 'Tecidos, vestuário e calçados',
  'Mineração': 'Materiais básicos',
  'Siderurgia e metalurgia': 'Materiais básicos',
  'Química e petroquímica': 'Materiais básicos',
  'Papel, celulose e madeira': 'Materiais básicos',
  'Energia elétrica: geração': 'Energia elétrica: geração e transmissão',
  'Energia elétrica: transmissão': 'Energia elétrica: geração e transmissão',
  'Petróleo e gás': 'Petróleo, gás e biocombustíveis',
  'Distribuição de combustíveis e etanol': 'Petróleo, gás e biocombustíveis',
  'Varejo alimentar': 'Comércio de alimentos e medicamentos',
  'Farmácias, higiene e beleza': 'Comércio de alimentos e medicamentos',
  'Carnes e proteínas': 'Alimentos processados',
  'Alimentos e bebidas': 'Alimentos processados',
  'Software e serviços de TI': 'Tecnologia da informação',
  'Hardware e eletrônicos': 'Tecnologia da informação',
  'Locação de veículos e frotas': 'Locação e serviços',
  'Serviços e locação de equipamentos': 'Locação e serviços',
  'Materiais de construção e acabamento': 'Construção',
  'Construção civil e incorporação': 'Construção',
  'Bolsa, holdings e serviços financeiros': 'Seguros, bolsa e serviços financeiros',
  'Seguros e previdência': 'Seguros, bolsa e serviços financeiros',
}

export type OrigemMultiplo = 'setor' | 'grupo'

/**
 * Mediana de cada múltiplo entre as outras empresas do mesmo setor (precisa de ao menos 4 com o múltiplo). Se o setor não alcança 4 pares
 * para um múltiplo, usa o grupo B3 (mesma regra de 4 pares). `origem` diz de onde veio cada mediana; `grupo` é o nome do grupo.
 */
export function medianaSetorial(alvo: EmpresaFundamentos, todas: EmpresaFundamentos[], precoDe: PrecoDe): { n: number; medianas: MultiplosEmpresa; origem: Partial<Record<keyof MultiplosEmpresa, OrigemMultiplo>>; grupo: string | null; nGrupo: number } {
  const chaves: (keyof MultiplosEmpresa)[] = ['pl', 'pvp', 'evEbitda', 'evEbit', 'pVendas', 'pFcf', 'dy']
  const paresDe = (filtro: (x: EmpresaFundamentos) => boolean) => todas.filter((x) => x.ticker !== alvo.ticker && x.financeira === alvo.financeira && filtro(x))
  const medianasDe = (pares: EmpresaFundamentos[]) => {
    const mult = pares.map((x) => multiplosDe(x, precoDe))
    const saida = {} as Record<keyof MultiplosEmpresa, number | null>
    for (const k of chaves) {
      const v = mult.map((m) => m[k]).filter((x): x is number => ok(x))
      saida[k] = v.length >= 4 ? mediana(v) : null
    }
    return saida
  }
  const doSetor = paresDe((x) => x.setor === alvo.setor)
  const medianas = medianasDe(doSetor)
  const origem: Partial<Record<keyof MultiplosEmpresa, OrigemMultiplo>> = {}
  for (const k of chaves) if (medianas[k] !== null) origem[k] = 'setor'
  const grupo = GRUPOS_B3[alvo.setor] ?? null
  let nGrupo = 0
  if (grupo && chaves.some((k) => medianas[k] === null)) {
    const doGrupo = paresDe((x) => GRUPOS_B3[x.setor] === grupo)
    nGrupo = doGrupo.length
    const medGrupo = medianasDe(doGrupo)
    for (const k of chaves) if (medianas[k] === null && medGrupo[k] !== null) { medianas[k] = medGrupo[k]; origem[k] = 'grupo' }
  }
  return { n: doSetor.length, medianas, origem, grupo, nGrupo }
}

// ---------------------------------------------------------------------------------------
// Valor justo
// ---------------------------------------------------------------------------------------

function crescimentoExplicito(base: number | null, cenario: Cenario): number {
  const b = limitar(base ?? 0.04, 0.02, 0.1)
  return cenario === 'pessimista' ? b * 0.5 : cenario === 'otimista' ? Math.min(b * 1.5, 0.14) : b
}

/** Valor presente de um fluxo que cresce `g1` por 5 anos e depois `gt` para sempre, descontado a `r`. */
export function descontarFluxo(fluxo0: number, g1: number, gt: number, r: number): number {
  let vp = 0
  let f = fluxo0
  for (let t = 1; t <= 5; t++) {
    f *= 1 + g1
    vp += f / Math.pow(1 + r, t)
  }
  const terminal = (f * (1 + gt)) / (r - gt)
  return vp + terminal / Math.pow(1 + r, 5)
}

function calcularValorJusto(e: EmpresaFundamentos, m: Mercado, cols: ColunaHistorica[], cagrReceita: number | null, setor: MultiplosEmpresa, pr: Premissas, grupoPl: string | null = null): ValorJusto {
  const nada = (motivo: string): ValorJusto => ({ aplicavel: false, motivo, cenarios: [], faixa: null, confianca: 'baixa', confiancaMotivos: [], margemSegurancaPct: null, potencialBasePct: null, precoEntrada: null })
  if (!ok(m.preco) || !ok(m.acoes) || m.acoes <= 0) return nada('Dados insuficientes para conclusão: sem preço ou sem quantidade de ações confiável.')
  const acoes = m.acoes
  const anuais = cols.filter((c) => !c.ttm)
  const ttm = cols.find((c) => c.ttm) ?? anuais[anuais.length - 1]
  const motivosConf: string[] = []

  const cenarios: Cenario[] = ['pessimista', 'base', 'otimista']
  const saida: CenarioValor[] = cenarios.map((cenario) => {
    const r = pr.taxaDesconto[cenario]
    const gt = pr.crescimentoTerminal[cenario]
    const g1 = crescimentoExplicito(cagrReceita, cenario)
    const metodos: CenarioValor['metodos'] = []

    if (e.financeira) {
      // P/VP justo = (ROE − g) ÷ (custo do capital − g), com o ROE médio dos últimos 3 exercícios.
      const roes = e.anual.slice(-3).map((p) => dividir(lucroDosAcionistas(p), p.plControladores)).filter((x): x is number => ok(x))
      const roe = media(roes)
      const pl = (e.ttm ?? e.anual[e.anual.length - 1]).plControladores
      if (ok(roe) && ok(pl) && pl > 0 && r > gt) {
        const roeUsado = limitar(roe * (cenario === 'pessimista' ? 0.85 : cenario === 'otimista' ? 1.1 : 1), 0, 0.35)
        const pvpJusto = (roeUsado - gt) / (r - gt)
        metodos.push({ nome: 'P/VP justo (ROE sustentável)', valor: Math.max(0, ((pl * 1000) / acoes) * pvpJusto), premissas: `ROE ${pct(roeUsado)}, custo do capital ${pct(r)}, crescimento ${pct(gt)}: P/VP justo de ${vezes(pvpJusto, 2)}.` })
      }
    } else {
      // Fluxo de caixa livre (caixa operacional menos investimentos) normalizado: média de até 3 períodos, em R$ mil.
      const fcfs = [ttm?.fcf, ...anuais.slice(-2).map((c) => c.fcf)].filter((x): x is number => ok(x))
      const fcfNorm = media(fcfs)
      if (ok(fcfNorm) && fcfNorm > 0 && fcfs.length >= 2) {
        const ajuste = cenario === 'pessimista' ? 0.8 : cenario === 'otimista' ? 1.1 : 1
        const patrimonio = descontarFluxo(fcfNorm * ajuste, g1, gt, r)
        metodos.push({ nome: 'Fluxo de caixa livre descontado', valor: (patrimonio * 1000) / acoes, premissas: `FCF normalizado de ${milhoesDeMil(fcfNorm * ajuste)} (média de ${fcfs.length} períodos${ajuste !== 1 ? `, ${ajuste < 1 ? '−' : '+'}${Math.round(Math.abs(1 - ajuste) * 100)}%` : ''}), crescimento de ${pct(g1)} por 5 anos, depois ${pct(gt)}; desconto de ${pct(r)}.` })
      }
    }

    // Múltiplo do setor sobre o lucro por ação normalizado (média dos últimos 3 LPA positivos).
    const lpas = [ttm?.lpa, ...anuais.slice(-2).map((c) => c.lpa)].filter((x): x is number => ok(x))
    const lpaNorm = media(lpas)
    if (ok(setor.pl) && ok(lpaNorm) && lpaNorm > 0 && lpas.length >= 2) {
      const fator = cenario === 'pessimista' ? 0.8 : cenario === 'otimista' ? 1.2 : 1
      metodos.push({ nome: grupoPl ? 'P/L do grupo B3' : 'P/L do setor', valor: lpaNorm * setor.pl * fator, premissas: `LPA normalizado de ${reais(lpaNorm)} × P/L de ${vezes(setor.pl * fator)} (mediana ${grupoPl ? `do grupo B3 "${grupoPl}", porque o setor tem poucos pares` : 'do setor'}${fator !== 1 ? `, ${fator < 1 ? '−' : '+'}20%` : ''}).` })
    }
    const validos = metodos.map((x) => x.valor).filter((x): x is number => ok(x))
    const valorJusto = validos.length ? (media(validos) as number) : null
    const nomeCenario = { pessimista: 'Crescimento mais fraco e desconto maior', base: 'Hipóteses neutras', otimista: 'Execução favorável, sem resultados extraordinários' }[cenario]
    return {
      cenario,
      valorJusto,
      potencialPct: valorJusto !== null ? (valorJusto / (m.preco as number) - 1) * 100 : null,
      metodos,
      premissas: `${nomeCenario}. Desconto de ${pct(r)}, crescimento terminal de ${pct(gt)}.`,
      invalidacao: cenario === 'pessimista' ? 'Piora ainda maior: queda de margens, perda de contratos ou alta dos juros além do previsto.' : cenario === 'base' ? 'Resultados 20% abaixo do normalizado por dois trimestres seguidos, ou mudança relevante de juros e câmbio.' : 'Resultados voltarem à média: o cenário supõe execução melhor que a história recente.',
    }
  })

  const base = saida.find((s) => s.cenario === 'base') as CenarioValor
  if (base.valorJusto === null) {
    return { aplicavel: false, motivo: e.financeira ? 'Dados insuficientes para conclusão: sem ROE e patrimônio líquido confiáveis para o P/VP justo.' : 'Dados insuficientes para conclusão: fluxo de caixa livre insuficiente ou negativo e sem múltiplo setorial confiável. O modelo não força um preço-alvo.', cenarios: saida, faixa: null, confianca: 'baixa', confiancaMotivos: ['Nenhum método pôde ser aplicado.'], margemSegurancaPct: null, potencialBasePct: null, precoEntrada: null }
  }
  const valores = saida.map((s) => s.valorJusto).filter((x): x is number => ok(x))
  const faixa = { minimo: Math.min(...valores), maximo: Math.max(...valores) }
  const nMetodos = base.metodos.filter((x) => ok(x.valor)).length
  if (nMetodos < 2) motivosConf.push('Só um método de avaliação pôde ser aplicado.')
  else {
    const [a, b] = base.metodos.map((x) => x.valor as number)
    if (Math.max(a, b) / Math.max(Math.min(a, b), 0.01) > 1.6) motivosConf.push('Os métodos divergem muito entre si.')
  }
  if (faixa.maximo / Math.max(faixa.minimo, 0.01) > 2.2) motivosConf.push('Faixa entre cenários muito larga (premissas frágeis).')
  if (anuais.length < 4) motivosConf.push('Menos de 4 exercícios de histórico.')
  if (m.aproximado) motivosConf.push('Valor de mercado com preço aproximado de uma das classes.')
  const confianca: ValorJusto['confianca'] = motivosConf.length === 0 ? 'alta' : motivosConf.length === 1 ? 'media' : 'baixa'
  const vb = base.valorJusto
  return {
    aplicavel: true,
    motivo: null,
    cenarios: saida,
    faixa,
    confianca,
    confiancaMotivos: motivosConf,
    margemSegurancaPct: (1 - m.preco / vb) * 100,
    potencialBasePct: (vb / m.preco - 1) * 100,
    precoEntrada: vb * (1 - pr.margemSegurancaAlvo),
  }
}

// ---------------------------------------------------------------------------------------
// Pontuação
// ---------------------------------------------------------------------------------------

function ponderar(nome: string, peso: number, criterios: Nota['criterios']): Nota {
  const validos = criterios.filter((c) => ok(c.nota))
  const soma = validos.reduce((s, c) => s + c.peso, 0)
  const nota = soma > 0 ? Math.round(validos.reduce((s, c) => s + (c.nota as number) * c.peso, 0) / soma) : null
  return { nome, nota, peso, criterios, ausentes: criterios.filter((c) => !ok(c.nota)).map((c) => c.nome) }
}

function notaQualidade(e: EmpresaFundamentos, cols: ColunaHistorica[], c: { roic: number | null; roe: number | null; cagrLpa: number | null; cagrReceita: number | null }, peso: number): Nota {
  const anuais = cols.filter((x) => !x.ttm)
  const lucros = anuais.map((x) => x.lucroLiquido).filter((x): x is number => ok(x))
  const fracaoLucro = lucros.length ? lucros.filter((x) => x > 0).length / lucros.length : null
  const margens = anuais.map((x) => x.margemEbit).filter((x): x is number => ok(x))
  // Margem estável só conta como consistência quando a margem é positiva: prejuízo estável não é qualidade.
  const dpMargem = (media(margens) ?? 0) > 0 ? desvio(margens) : null
  const fcos = anuais.map((x) => x.fco).filter((x): x is number => ok(x))
  const fracaoFco = fcos.length ? fcos.filter((x) => x > 0).length / fcos.length : null
  const conv = anuais.map((x) => dividir(x.fco, x.lucroLiquido)).filter((x): x is number => ok(x) && x > -5 && x < 20)
  const convMed = mediana(conv)

  const rent = e.financeira ? c.roe : c.roic
  const notaRent = ok(rent) ? interpolar(rent, e.financeira ? [[0, 10], [0.08, 30], [0.12, 55], [0.16, 75], [0.22, 92]] : [[-0.05, 5], [0, 15], [0.08, 40], [0.12, 60], [0.18, 80], [0.25, 95]]) : null
  const cresc = ok(c.cagrLpa) ? c.cagrLpa : c.cagrReceita
  const notaCresc = ok(cresc) ? interpolar(cresc, [[-0.15, 10], [0, 35], [0.06, 55], [0.12, 75], [0.2, 92]]) : null
  const notaCons = ok(fracaoLucro) ? 0.6 * fracaoLucro * 100 + (ok(dpMargem) && !e.financeira ? 0.4 * interpolar(dpMargem, [[0.01, 95], [0.04, 80], [0.08, 55], [0.15, 25], [0.3, 5]]) : 0.4 * fracaoLucro * 100) : null
  const notaCaixa = e.financeira ? null : ok(fracaoFco) ? 0.5 * fracaoFco * 100 + 0.5 * (ok(convMed) ? interpolar(convMed, [[0, 20], [0.6, 50], [1, 80], [1.3, 90]]) : fracaoFco * 100) : null

  return ponderar('Qualidade do negócio', peso, [
    { nome: e.financeira ? 'Rentabilidade (ROE)' : 'Rentabilidade (ROIC)', nota: notaRent, peso: 30, detalhe: ok(rent) ? `${e.financeira ? 'ROE' : 'ROIC'} de ${pct(rent)}.` : 'Sem dado.' },
    { nome: 'Crescimento do lucro por ação', nota: notaCresc, peso: 20, detalhe: ok(cresc) ? `Crescimento composto de ${pct(cresc)} ao ano${ok(c.cagrLpa) ? ' (lucro por ação)' : ' (receita)'}.` : 'Sem base positiva para calcular o crescimento composto.' },
    { nome: 'Consistência dos resultados', nota: notaCons, peso: 25, detalhe: ok(fracaoLucro) ? `Lucro em ${lucros.filter((x) => x > 0).length} de ${lucros.length} exercícios${ok(dpMargem) && !e.financeira ? `; variação da margem EBIT de ${pct(dpMargem)} (desvio-padrão).` : '.'}` : 'Sem dado.' },
    { nome: 'Geração de caixa', nota: notaCaixa, peso: 25, detalhe: e.financeira ? 'Não se aplica a instituições financeiras.' : ok(fracaoFco) ? `Caixa operacional positivo em ${fcos.filter((x) => x > 0).length} de ${fcos.length} exercícios${ok(convMed) ? `; conversão mediana do lucro em caixa de ${vezes(convMed, 2)}` : ''}.` : 'Sem dado.' },
  ])
}

function notaRisco(e: EmpresaFundamentos, cols: ColunaHistorica[], x: { dlEbitda: number | null; cobertura: number | null; liquidez: number | null; diluicao: number | null; payoutFcf: number | null; plAtivo: number | null; semDividaLiquida: boolean; setorAlavancado: boolean }, peso: number): Nota {
  const folga = x.setorAlavancado ? 1.5 : 0
  const notaAlav = e.financeira
    ? ok(x.plAtivo) ? interpolar(x.plAtivo, [[0.02, 15], [0.05, 45], [0.08, 70], [0.12, 85]]) : null
    : x.semDividaLiquida ? 95 : ok(x.dlEbitda) ? (x.dlEbitda < 0 ? 5 : interpolar(x.dlEbitda - folga, [[0, 95], [1, 85], [2, 70], [3, 50], [4, 35], [6, 10]])) : null
  const notaCob = e.financeira ? null : ok(x.cobertura) ? interpolar(x.cobertura, [[0, 5], [1.5, 30], [3, 60], [6, 85], [10, 95]]) : null
  const notaLiq = e.financeira ? null : ok(x.liquidez) ? interpolar(x.liquidez, [[0.5, 10], [0.8, 30], [1, 55], [1.5, 80], [2, 90]]) : null
  const notaDil = ok(x.diluicao) ? interpolar(x.diluicao, [[-0.05, 92], [0, 85], [0.05, 70], [0.15, 45], [0.4, 15]]) : null
  const notaDiv = ok(x.payoutFcf) ? interpolar(x.payoutFcf, [[0, 85], [0.6, 85], [1, 55], [1.5, 25], [3, 5]]) : null
  const margens = cols.filter((c) => !c.ttm).map((c) => c.margemLiquida).filter((v): v is number => ok(v))
  const dp = desvio(margens)
  const notaEst = e.financeira && ok(dp) ? interpolar(dp, [[0.02, 90], [0.06, 70], [0.12, 40], [0.25, 10]]) : null
  return ponderar('Segurança e risco', peso, [
    { nome: e.financeira ? 'Capitalização (PL ÷ ativos)' : 'Endividamento', nota: notaAlav, peso: 35, detalhe: e.financeira ? (ok(x.plAtivo) ? `PL de ${pct(x.plAtivo)} dos ativos (aproximação: não é o índice de Basileia).` : 'Sem dado.') : x.semDividaLiquida ? 'Caixa maior que a dívida.' : ok(x.dlEbitda) ? `Dívida líquida de ${vezes(x.dlEbitda)} o EBITDA${x.setorAlavancado ? ' (régua mais folgada para o setor)' : ''}.` : 'Sem dado.' },
    { nome: 'Cobertura de juros', nota: notaCob, peso: 20, detalhe: ok(x.cobertura) ? `EBIT cobre ${vezes(x.cobertura)} a despesa financeira.` : e.financeira ? 'Não se aplica.' : 'Sem despesa financeira informada.' },
    { nome: 'Liquidez corrente', nota: notaLiq, peso: 15, detalhe: ok(x.liquidez) ? `Ativo circulante de ${vezes(x.liquidez, 2)} o passivo circulante.` : 'Sem dado.' },
    { nome: 'Diluição de acionistas', nota: notaDil, peso: 15, detalhe: ok(x.diluicao) ? `Quantidade de ações ${x.diluicao >= 0 ? 'cresceu' : 'caiu'} ${pct(Math.abs(x.diluicao))} no período.` : 'Sem histórico de ações.' },
    { nome: 'Dividendos frente ao caixa', nota: notaDiv, peso: 15, detalhe: ok(x.payoutFcf) ? `Proventos pagos equivalem a ${pct(x.payoutFcf, 0)} do fluxo de caixa livre.` : 'Sem pagamento de proventos identificado ou sem fluxo de caixa livre.' },
    { nome: 'Estabilidade do lucro', nota: notaEst, peso: 20, detalhe: ok(dp) ? `Margem líquida varia ${pct(dp)} (desvio-padrão).` : 'Sem dado.' },
  ])
}

function notaValuation(vj: ValorJusto, relativo: number | null, peso: number): Nota {
  const nMs = vj.aplicavel && ok(vj.margemSegurancaPct) ? interpolar(vj.margemSegurancaPct, [[-60, 5], [-30, 20], [0, 50], [20, 72], [40, 90], [60, 98]]) : null
  const nRel = ok(relativo) ? interpolar(relativo, [[0.5, 90], [0.8, 75], [1, 55], [1.3, 35], [1.8, 15]]) : null
  return ponderar('Atratividade do valuation', peso, [
    { nome: 'Margem de segurança sobre o valor justo', nota: nMs, peso: 60, detalhe: vj.aplicavel && ok(vj.margemSegurancaPct) ? `Margem de segurança de ${vj.margemSegurancaPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% sobre o cenário base (confiança ${vj.confianca}).` : (vj.motivo ?? 'Sem valor justo.') },
    { nome: 'Múltiplos frente ao setor', nota: nRel, peso: 40, detalhe: ok(relativo) ? `Múltiplos em média ${vezes(relativo, 2)} a mediana do setor.` : 'Poucas empresas comparáveis no setor (mínimo de 4 com o múltiplo).' },
  ])
}

// ---------------------------------------------------------------------------------------
// Riscos externos típicos (descrição geral do setor, não específica da empresa)
// ---------------------------------------------------------------------------------------

const RISCOS_SETOR: { teste: RegExp; riscos: [string, string, string][] }[] = [
  { teste: /petr[oó]leo|g[aá]s|biocombust/i, riscos: [['Preço do petróleo e câmbio', 'O resultado acompanha o preço internacional e o dólar.', 'Brent e dólar'], ['Política de preços e regulação', 'Decisões do controlador e da agência reguladora afetam margens e investimentos.', 'Política de preços, leilões e regras da ANP'], ['Transição energética', 'Demanda de longo prazo pode se reduzir com a eletrificação.', 'Investimento em renováveis e demanda de combustíveis']] },
  { teste: /minera|sider|metal|a[cç]o|papel|celulose|materiais/i, riscos: [['Preço de commodities', 'Receita e margem variam com minério, aço, celulose e metais.', 'Preços internacionais'], ['Câmbio', 'Parte relevante da receita é em dólar e o custo é em reais.', 'Dólar'], ['Demanda da China', 'A economia chinesa define parte da demanda global.', 'Atividade industrial e imobiliária da China']] },
  { teste: /banco|seguro|financ|bolsa|previd/i, riscos: [['Juros e inadimplência', 'A margem financeira e a perda de crédito dependem do ciclo de juros e do emprego.', 'Selic, inadimplência e provisões'], ['Regulação e capital', 'Regras do Banco Central e da Susep mudam exigências de capital e tarifas.', 'Índice de capital e novas resoluções'], ['Concorrência de novos entrantes', 'Bancos digitais e fintechs pressionam tarifas e spreads.', 'Participação de mercado e custo de aquisição']] },
  { teste: /el[eé]trica|energia|saneamento|utilidade|g[aá]s natural|transmiss/i, riscos: [['Regulação e tarifas', 'Reajustes e revisões tarifárias definem a receita.', 'Decisões da Aneel e das agências estaduais'], ['Juros', 'Setor intensivo em capital e endividado: juros altos pesam no resultado.', 'Selic e custo da dívida'], ['Hidrologia e clima', 'Chuvas afetam geração, preços e custos.', 'Nível dos reservatórios e preço da energia']] },
  { teste: /varejo|consumo|com[eé]rcio|alimento|bebida|vestu[aá]rio|automoveis|autom[oó]veis/i, riscos: [['Juros e renda das famílias', 'Crédito caro e renda pressionada reduzem o consumo.', 'Selic, endividamento das famílias e massa de renda'], ['Concorrência e comércio eletrônico', 'Novos modelos e plataformas disputam margem.', 'Margem bruta e participação de mercado'], ['Custos e câmbio', 'Insumos e itens importados pressionam o custo.', 'Inflação de custos e dólar']] },
  { teste: /constru|imobili|incorpor/i, riscos: [['Juros e crédito imobiliário', 'Financiamento caro reduz as vendas.', 'Selic, taxas do crédito imobiliário e lançamentos'], ['Custo de construção', 'INCC e mão de obra comprimem margens.', 'INCC e margem bruta'], ['Distratos e estoque', 'Cancelamentos e estoque elevado pressionam o caixa.', 'Distratos e unidades em estoque']] },
  { teste: /sa[uú]de|hospital|farm|diagn/i, riscos: [['Regulação e preços', 'Reajustes de planos e tabelas de medicamentos são regulados.', 'ANS, ANVISA e CMED'], ['Sinistralidade e custo', 'Custos médicos crescem acima da inflação.', 'Sinistralidade e margem'], ['Concentração de pagadores', 'Poucos planos concentram a receita.', 'Concentração de clientes']] },
  { teste: /tecnolog|software|computa|internet|comunica|telecom|m[ií]dia/i, riscos: [['Competição e mudança tecnológica', 'Produtos e preços podem ser substituídos rapidamente.', 'Participação de mercado e churn'], ['Regulação', 'Regras de dados, espectro e concorrência mudam o negócio.', 'Decisões da Anatel e da ANPD'], ['Investimento intensivo', 'Atualização de rede e tecnologia consome caixa.', 'Capex sobre receita']] },
  { teste: /agro|agric|prote[ií]na|carne|a[cç][uú]car|etanol|soja|terra/i, riscos: [['Clima e safra', 'Safras e rendimentos variam com o clima.', 'Estimativas de safra da Conab'], ['Preço de commodities e câmbio', 'Receita ligada a preços em dólar.', 'Preços internacionais e dólar'], ['Barreiras comerciais', 'Embargos e tarifas afetam exportações.', 'Acordos e barreiras de países compradores']] },
  { teste: /transporte|log[ií]stica|ferrovia|rodovia|aeroporto|a[eé]reo|navega|concess/i, riscos: [['Demanda e atividade econômica', 'Volumes acompanham o PIB e o comércio.', 'Volume transportado e PIB'], ['Combustível e câmbio', 'Custos em dólar e combustível pressionam margens.', 'Preço do combustível e dólar'], ['Contratos e regulação', 'Reequilíbrios, tarifas e renovações dependem do poder concedente.', 'Cláusulas de reajuste e prazos de concessão']] },
]
const RISCOS_GENERICOS: [string, string, string][] = [
  ['Ciclo econômico e juros', 'Atividade fraca e juros altos pressionam receita, margens e custo da dívida.', 'PIB, Selic e confiança do consumidor'],
  ['Câmbio e inflação de custos', 'Dólar e inflação de insumos afetam custos e resultados.', 'Dólar, IPCA e índices de custo do setor'],
  ['Regulação e carga tributária', 'Mudanças em regras do setor e em tributos alteram a rentabilidade.', 'Propostas legislativas e decisões das agências'],
]

// ---------------------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------------------

export interface EntradaFundamentalista {
  empresa: EmpresaFundamentos
  precoDe: PrecoDe
  /** Todas as empresas do arquivo, para a mediana do setor. */
  todas: EmpresaFundamentos[]
  geradoEm?: string | null
  dataCorte?: string | null
  dataPreco?: string | null
  premissas?: Partial<Premissas>
  /** Dividend yield de 12 meses por ação (proventos com data com na janela ÷ cotação, B3), igual ao das listas de dividendos. Sem ele, usa a DFC. */
  dyB3?: number | null
}

export function analisarFundamentos(entrada: EntradaFundamentalista): AnaliseFundamentalista | null {
  const e = entrada.empresa
  if (!e.anual.length) return null
  const pr: Premissas = {
    ...PREMISSAS_PADRAO,
    ...entrada.premissas,
    taxaDesconto: { ...PREMISSAS_PADRAO.taxaDesconto, ...entrada.premissas?.taxaDesconto },
    crescimentoTerminal: { ...PREMISSAS_PADRAO.crescimentoTerminal, ...entrada.premissas?.crescimentoTerminal },
    pesos: { ...PREMISSAS_PADRAO.pesos, ...entrada.premissas?.pesos },
  }
  const { precoDe } = entrada
  const fonte = FONTE_CVM
  const cols = colunas(e)
  const anuais = cols.filter((c) => !c.ttm)
  const atual = e.ttm ?? e.anual[e.anual.length - 1]
  const ref = e.ttm ? e.ttm.periodoAte ?? e.ultimaDemonstracao.dtRefer : (e.anual[e.anual.length - 1].exercicio as string)
  const dataRef = e.ultimaDemonstracao.dtRefer
  const capitalSuspeito = e.alertas.includes('capital_implausivel')
  const mercado = valorDeMercado(e, precoDe)
  const limitacoes: string[] = [
    'Demonstrações da CVM (DFP e ITR), em base consolidada quando existe; lucro recorrente não é divulgado pela CVM, então o lucro é o reportado.',
    'Sem série de preços de 5 anos, o múltiplo atual não é comparado ao histórico da própria empresa.',
    'Sem IPCA no app: o crescimento é nominal, sem separar o efeito da inflação.',
    ...(e.financeira ? ['Instituição financeira: EBITDA, dívida líquida e fluxo de caixa livre não medem o negócio; a leitura usa lucro, ROE, P/L e P/VP.'] : []),
    ...(mercado.aproximado ? ['Valor de mercado com o preço de uma classe de ação usado para a outra (aproximação).'] : []),
    ...e.alertas.filter((a) => a.startsWith('reapresentado:')).map((a) => `Exercícios reapresentados com mudança material no lucro (${a.split(':')[1]}): usados os valores reapresentados.`),
    ...e.alertas.filter((a) => a.startsWith('capital_corrigido')).map(() => 'A quantidade de ações foi corrigida por erro de preenchimento detectado nos documentos da CVM.'),
    ...(e.acoes?.ajusteUnidade ? [`Unidade da quantidade de ações ajustada (${e.acoes.ajusteUnidade}).`] : []),
    ...(capitalSuspeito ? ['A quantidade de ações é implausível frente ao patrimônio líquido (possível erro de unidade na CVM): valor de mercado, múltiplos e valor justo foram suprimidos.'] : []),
    ...(e.alertas.filter((a) => a.startsWith('evento_de_acoes_detectado')).length ? [`Desdobramento ou bonificação detectado pela variação da quantidade de ações (${e.alertas.filter((a) => a.startsWith('evento_de_acoes_detectado')).map((a) => a.split(':')[1]).join(', ')}): ações dos anos anteriores ajustadas para o lucro por ação ficar comparável.`] : []),
    ...(e.anual.length < 5 ? [`Só ${e.anual.length} exercícios completos disponíveis.`] : []),
  ]

  // Crescimento composto sobre os exercícios completos.
  const n = anuais.length
  const anosCagr = n - 1
  const primeiro = e.anual[0]
  const ultimoAnual = e.anual[n - 1]
  const cg = {
    receita: cagr(primeiro.receita, ultimoAnual.receita, anosCagr),
    lucro: cagr(ok(lucroDosAcionistas(primeiro)) ? lucroDosAcionistas(primeiro) : null, lucroDosAcionistas(ultimoAnual), anosCagr),
    lpa: cagr(lpaDe(primeiro), lpaDe(ultimoAnual), anosCagr),
    anos: anosCagr,
  }

  // Indicadores atuais (12 meses; sem 12 meses, o último exercício).
  const lucroAtual = lucroDosAcionistas(atual)
  const dlAtual = dividaLiquidaDe(atual)
  const fcfAtual = fcfDe(atual)
  const capitalInvestido = ok(atual.patrimonioLiquido) && ok(atual.divida) ? atual.patrimonioLiquido + atual.divida - (atual.caixa ?? 0) : null
  const ebitParaNopat = ok(atual.ebit) ? atual.ebit - (atual.equivalencia ?? 0) : null
  const roic = !e.financeira && ok(ebitParaNopat) && ok(capitalInvestido) && capitalInvestido > 0 ? (ebitParaNopat * (1 - pr.aliquotaNopat)) / capitalInvestido : null
  const plAnterior = e.ttm ? ultimoAnual.plControladores : e.anual.length > 1 ? e.anual[n - 2].plControladores : null
  const plMedio = ok(atual.plControladores) && ok(plAnterior) ? (atual.plControladores + plAnterior) / 2 : atual.plControladores
  const roe = ok(lucroAtual) && ok(plMedio) && plMedio > 0 ? lucroAtual / plMedio : null
  const roa = dividir(atual.lucroLiquido, atual.ativoTotal)
  const dlEbitda = ok(dlAtual) && ok(atual.ebitda) && atual.ebitda > 0 ? dlAtual / atual.ebitda : null
  const semDividaLiquida = ok(dlAtual) && dlAtual <= 0
  const cobertura = ok(atual.ebit) && ok(atual.despesaFinanceira) && atual.despesaFinanceira > 0 ? atual.ebit / atual.despesaFinanceira : null
  const liquidez = dividir(atual.ativoCirculante, atual.passivoCirculante)
  const fcoAtualOk = fcoCoerente(atual)
  const conversao = ok(lucroAtual) && lucroAtual > 0 && fcoAtualOk && (!ok(atual.receita) || lucroAtual >= 0.01 * atual.receita) ? dividir(atual.fco, lucroAtual) : null
  const acoesIni = anuais.find((c) => ok(c.acoes))?.acoes ?? null
  const acoesFim = mercado.acoes ?? atual.acoes ?? null
  const diluicao = ok(acoesIni) && ok(acoesFim) && acoesIni > 0 ? acoesFim / acoesIni - 1 : null
  const payoutLucro = ok(lucroAtual) && lucroAtual > 0 ? dividir(atual.dividendosPagos, lucroAtual) : null
  const payoutFcf = ok(fcfAtual) && fcfAtual > 0 ? dividir(atual.dividendosPagos, fcfAtual) : null

  const rotulosHist = cols.map((c) => c.rotulo)
  const hist = (f: (c: ColunaHistorica) => number | null) => cols.map(f)
  const setorAlavancado = SETORES_ALAVANCAGEM_ALTA.test(e.setor)
  const ind = (i: Omit<Indicador, 'fonte' | 'dataReferencia' | 'rotulosHistorico'> & Partial<Pick<Indicador, 'rotulosHistorico'>>): Indicador => ({ fonte, dataReferencia: dataRef, rotulosHistorico: i.historico ? rotulosHist : undefined, ...i })

  const rentabilidade: Indicador[] = [
    ...(e.financeira ? [] : [ind({ id: 'roic', nome: 'ROIC', valor: roic, formato: 'pct', interpretacao: ok(roic) ? (roic >= 0.15 ? 'Retorno alto sobre o capital investido.' : roic >= 0.1 ? 'Retorno razoável; confirme se supera o custo de capital (acima de 12 a 15% ao ano nominal).' : 'Retorno baixo: provavelmente abaixo do custo de capital.') : 'Dados insuficientes para conclusão.', formula: `NOPAT ÷ capital investido; NOPAT = EBIT sem equivalência × (1 − ${Math.round(pr.aliquotaNopat * 100)}%); capital investido = PL + dívida bruta − caixa.` })]),
    ind({ id: 'roe', nome: 'ROE', valor: roe, formato: 'pct', historico: anuais.map((_, i) => dividir(lucroDosAcionistas(e.anual[i]), e.anual[i].plControladores)).concat(e.ttm ? [roe] : []), interpretacao: ok(roe) ? (roe >= 0.15 ? 'ROE elevado. Confira se vem de operação ou de alavancagem e patrimônio pequeno.' : roe >= 0.08 ? 'ROE moderado.' : 'ROE baixo.') : 'Dados insuficientes para conclusão.', formula: 'Lucro dos controladores ÷ patrimônio líquido médio (início e fim do período).' }),
    ind({ id: 'roa', nome: 'ROA', valor: roa, formato: 'pct', interpretacao: ok(roa) ? (roa >= 0.08 ? 'Bom retorno sobre ativos.' : roa >= 0.03 ? 'Retorno moderado sobre ativos.' : 'Retorno baixo sobre ativos.') : 'Dados insuficientes para conclusão.', formula: 'Lucro líquido ÷ ativo total.' }),
    ind({ id: 'margem-bruta', nome: 'Margem bruta', valor: dividir(atual.lucroBruto, atual.receita), formato: 'pct', historico: hist((c) => c.margemBruta), interpretacao: 'Margem bruta estável sugere poder de preço; queda sustentada indica pressão de custos ou concorrência.', formula: 'Lucro bruto ÷ receita líquida.' }),
    ...(e.financeira ? [] : [
      ind({ id: 'margem-ebitda', nome: 'Margem EBITDA', valor: dividir(atual.ebitda, atual.receita), formato: 'pct', historico: hist((c) => c.margemEbitda), interpretacao: 'Margem operacional antes de depreciação, comparável dentro do mesmo setor.', formula: 'EBITDA ÷ receita líquida; EBITDA = EBIT + depreciação e amortização (DVA ou DFC).' }),
      ind({ id: 'margem-ebit', nome: 'Margem operacional (EBIT)', valor: dividir(atual.ebit, atual.receita), formato: 'pct', historico: hist((c) => c.margemEbit), interpretacao: 'Margem operacional; tendência de queda é um alerta.', formula: 'EBIT ÷ receita líquida.' }),
    ]),
    ind({ id: 'margem-liquida', nome: 'Margem líquida', valor: dividir(lucroAtual, atual.receita), formato: 'pct', historico: hist((c) => c.margemLiquida), interpretacao: 'Lucro dos acionistas sobre a receita.', formula: 'Lucro dos controladores ÷ receita líquida (lucro reportado, não recorrente).' }),
    ind({ id: 'lpa', nome: 'Lucro por ação (LPA)', valor: lpaDe(atual), formato: 'reais', historico: hist((c) => c.lpa), interpretacao: 'Evolução do lucro por ação ajustada a desdobramentos; queda com lucro estável indica diluição.', formula: 'Lucro dos controladores ÷ quantidade de ações em circulação (todas as classes).' }),
  ]

  const endividamentoECaixa: Indicador[] = e.financeira
    ? [ind({ id: 'pl-ativo', nome: 'PL ÷ ativo total', valor: dividir(atual.plControladores, atual.ativoTotal), formato: 'pct', interpretacao: 'Aproximação da alavancagem de uma instituição financeira; não substitui o índice de Basileia.', formula: 'Patrimônio líquido dos controladores ÷ ativo total.' })]
    : [
        ind({ id: 'divida-liquida', nome: 'Dívida líquida', valor: dlAtual, formato: 'milhoes', historico: hist((c) => c.dividaLiquida), interpretacao: ok(dlAtual) ? (dlAtual <= 0 ? 'Caixa maior que a dívida.' : 'Dívida maior que o caixa.') : 'Dados insuficientes para conclusão.', formula: 'Empréstimos e financiamentos (curto + longo prazo) − caixa e aplicações financeiras. Arrendamentos podem estar fora.' }),
        ind({ id: 'dl-ebitda', nome: 'Dívida líquida ÷ EBITDA', valor: dlEbitda, formato: 'x', interpretacao: semDividaLiquida ? 'Caixa líquido: sem dívida líquida.' : ok(dlEbitda) ? (dlEbitda <= (setorAlavancado ? 3.5 : 2) ? 'Endividamento confortável para o setor.' : dlEbitda <= (setorAlavancado ? 5 : 3.5) ? 'Endividamento adequado, mas exige atenção ao custo da dívida.' : 'Endividamento elevado para o setor.') : 'Sem EBITDA positivo para a razão.', formula: 'Dívida líquida ÷ EBITDA dos últimos 12 meses.' }),
        ind({ id: 'cobertura', nome: 'Cobertura de juros', valor: cobertura, formato: 'x', interpretacao: ok(cobertura) ? (cobertura >= 5 ? 'Folga ampla para pagar juros.' : cobertura >= 2.5 ? 'Cobertura adequada.' : 'Cobertura apertada.') : 'Despesa financeira não informada ou nula.', formula: 'EBIT ÷ despesas financeiras (DRE 3.06.02) dos últimos 12 meses.' }),
        ind({ id: 'liquidez', nome: 'Liquidez corrente', valor: liquidez, formato: 'x', interpretacao: ok(liquidez) ? (liquidez >= 1.5 ? 'Folga de curto prazo.' : liquidez >= 1 ? 'Liquidez adequada.' : 'Passivo de curto prazo maior que o ativo de curto prazo.') : 'Dados insuficientes para conclusão.', formula: 'Ativo circulante ÷ passivo circulante.' }),
        ind({ id: 'fco', nome: 'Caixa operacional (FCO)', valor: atual.fco, formato: 'milhoes', historico: hist((c) => c.fco), interpretacao: ok(atual.fco) && !fcoAtualOk ? 'Mais de 2× o EBITDA: provável financiamento (recebíveis, crédito a clientes) classificado como operação, ou efeito pontual. O fluxo de caixa livre não é usado na avaliação.' : 'Caixa gerado pela operação; deve acompanhar o lucro ao longo dos anos.', formula: 'Fluxo de caixa das atividades operacionais (DFC 6.01).' }),
        ind({ id: 'fcf', nome: 'Fluxo de caixa livre (FCF)', valor: fcfAtual, formato: 'milhoes', historico: hist((c) => c.fcf), interpretacao: ok(fcfAtual) ? (fcfAtual > 0 ? 'Gera caixa depois de investir.' : 'Consome caixa depois de investir: depende de dívida ou emissão para se financiar.') : 'CAPEX não identificado na DFC: dados insuficientes para conclusão.', formula: 'FCO − CAPEX (aquisição de imobilizado e intangível, DFC 6.02).' }),
        ind({ id: 'conversao', nome: 'Conversão do lucro em caixa', valor: conversao, formato: 'x', interpretacao: ok(conversao) ? (conversao >= 0.9 ? 'O lucro vira caixa.' : conversao >= 0.5 ? 'Conversão parcial: confira capital de giro e investimentos.' : 'O lucro converte pouco em caixa: investigar.') : 'Sem lucro positivo para a razão.', formula: 'FCO ÷ lucro dos controladores.' }),
      ]

  // Múltiplos e setor
  const mult = multiplosDe(e, precoDe)
  const set = medianaSetorial(e, entrada.todas, precoDe)
  const mi = (id: string, nome: string, valor: number | null, formato: FormatoIndicador, ref: number | null, formula: string, leitura: string): Indicador =>
    ind({ id, nome, valor, formato, referenciaSetor: ref, interpretacao: ok(valor) ? (ok(ref) ? `${leitura} Frente à mediana ${set.origem[({ pl: 'pl', pvp: 'pvp', 'ev-ebitda': 'evEbitda', 'ev-ebit': 'evEbit', 'p-vendas': 'pVendas', 'p-fcf': 'pFcf' } as Record<string, keyof MultiplosEmpresa>)[id]] === 'grupo' ? `do grupo ${set.grupo} (${set.nGrupo} empresas comparadas; o setor tem poucos pares)` : `do setor (${set.n} empresas comparadas)`}, está ${valor <= ref * 0.85 ? 'abaixo' : valor >= ref * 1.15 ? 'acima' : 'em linha'}.` : `${leitura} Poucas empresas comparáveis no setor para fixar uma referência.`) : 'Dados insuficientes para conclusão (lucro, patrimônio ou caixa negativos ou ausentes).', formula })
  const multiplos: Indicador[] = [
    mi('pl', 'P/L', mult.pl, 'x', set.medianas.pl, 'Valor de mercado ÷ lucro dos controladores dos últimos 12 meses (só com lucro positivo).', 'Anos de lucro atual para pagar o preço.'),
    mi('pvp', 'P/VP', mult.pvp, 'x', set.medianas.pvp, 'Valor de mercado ÷ patrimônio líquido dos controladores.', 'Preço em relação ao patrimônio contábil.'),
    ...(e.financeira ? [] : [
      mi('ev-ebitda', 'EV/EBITDA', mult.evEbitda, 'x', set.medianas.evEbitda, 'EV ÷ EBITDA; EV = valor de mercado + dívida líquida + minoritários.', 'Valor da empresa em relação ao caixa operacional.'),
      mi('ev-ebit', 'EV/EBIT', mult.evEbit, 'x', set.medianas.evEbit, 'EV ÷ EBIT dos últimos 12 meses.', 'Valor da empresa em relação ao resultado operacional.'),
    ]),
    mi('p-vendas', 'P/Vendas', mult.pVendas, 'x', set.medianas.pVendas, 'Valor de mercado ÷ receita líquida dos últimos 12 meses.', 'Preço em relação às vendas.'),
    ...(e.financeira ? [] : [mi('p-fcf', 'P/FCF', mult.pFcf, 'x', set.medianas.pFcf, 'Valor de mercado ÷ fluxo de caixa livre dos últimos 12 meses (só com FCF positivo).', 'Preço em relação ao caixa livre.')]),
  ]

  const vj = calcularValorJusto(e, mercado, cols, cg.receita, set.medianas, pr, set.origem.pl === 'grupo' ? set.grupo : null)
  const ev = ok(mercado.valorMercado) && ok(dlAtual) ? mercado.valorMercado + dlAtual + (atual.minoritarios ?? 0) : null

  // Relação múltiplos/setor (média das razões disponíveis).
  const razoes = (['pl', 'pvp', 'evEbitda'] as const).map((k) => (ok(mult[k]) && ok(set.medianas[k]) && (set.medianas[k] as number) > 0 ? (mult[k] as number) / (set.medianas[k] as number) : null)).filter((x): x is number => ok(x))
  const relativo = media(razoes)

  // Dividendos
  const pagos = anuais.map((c) => c.dividendosPagos)
  const anosComPagamento = pagos.filter((v): v is number => ok(v) && v > 0).length
  const cortes = pagos.slice(1).filter((v, i) => ok(v) && ok(pagos[i]) && (pagos[i] as number) > 0 && v < (pagos[i] as number) * 0.7).length
  const dyDaB3 = ok(entrada.dyB3) ? entrada.dyB3 : null
  const dyValor = dyDaB3 ?? mult.dy
  const dividendos = {
    aplicavel: pagos.some((v) => ok(v)),
    indicadores: [
      ind({ id: 'dy', nome: 'Dividend yield (12 meses)', valor: dyValor, formato: 'pct', interpretacao: ok(dyValor) ? (dyDaB3 !== null ? 'Proventos por ação (dividendos e JCP brutos) com data com nos últimos 12 meses ÷ cotação.' : 'Proventos pagos nos últimos 12 meses (dividendos e JCP, do fluxo de caixa) ÷ valor de mercado.') : 'Sem pagamento identificado ou sem valor de mercado.', formula: dyDaB3 !== null ? 'Proventos por ação com data com nos últimos 12 meses (B3) ÷ cotação.' : 'Dividendos e JCP pagos (DFC 6.03) ÷ valor de mercado.' }),
      ind({ id: 'proventos', nome: 'Proventos pagos', valor: atual.dividendosPagos, formato: 'milhoes', historico: hist((c) => c.dividendosPagos), interpretacao: `Pagamentos em ${anosComPagamento} de ${pagos.length} exercícios${cortes ? `; ${cortes} queda${cortes > 1 ? 's' : ''} de mais de 30%` : ''}.`, formula: 'Soma das linhas de dividendos e juros sobre capital próprio pagos na DFC (financiamento).' }),
      ind({ id: 'payout', nome: 'Payout sobre o lucro', valor: payoutLucro, formato: 'pct', interpretacao: ok(payoutLucro) ? (payoutLucro > 1 ? 'Paga mais do que lucra: distribuição pode estar usando reservas ou caixa.' : payoutLucro > 0.8 ? 'Payout alto: pouco espaço para crescer sem dívida.' : 'Payout compatível com o lucro.') : 'Sem lucro positivo ou sem pagamento.', formula: 'Proventos pagos ÷ lucro dos controladores (reportado; o recorrente não consta na CVM).' }),
      ind({ id: 'cobertura-fcf', nome: 'Proventos ÷ FCF', valor: payoutFcf, formato: 'pct', interpretacao: ok(payoutFcf) ? (payoutFcf > 1 ? 'Os proventos superam o fluxo de caixa livre: dependem de caixa acumulado ou dívida.' : 'O fluxo de caixa livre cobre os proventos.') : 'Sem FCF positivo ou sem CAPEX identificado.', formula: 'Proventos pagos ÷ (FCO − CAPEX).' }),
    ],
    leitura: !pagos.some((v) => ok(v))
      ? 'A DFC não traz linhas de dividendos pagos: dados insuficientes para conclusão.'
      : anosComPagamento === 0
        ? 'Nenhum pagamento de proventos identificado nos exercícios analisados.'
        : `Pagou proventos em ${anosComPagamento} de ${pagos.length} exercícios${cortes ? `, com ${cortes} corte${cortes > 1 ? 's' : ''} relevante${cortes > 1 ? 's' : ''}` : ''}. ${ok(payoutFcf) && payoutFcf > 1 ? 'No último período pagou mais do que o fluxo de caixa livre gerou.' : ok(payoutLucro) && payoutLucro > 1 ? 'No último período pagou mais do que lucrou.' : 'Nada indica insustentabilidade no último período, mas o histórico não projeta o futuro.'} A DFC mistura dividendos ordinários e extraordinários: pagamentos pontuais não devem ser tratados como recorrentes.`,
  }

  // Vantagem competitiva: apenas indícios financeiros.
  const roicsAnuais = e.anual.map((p) => {
    const ebitX = ok(p.ebit) ? p.ebit - (p.equivalencia ?? 0) : null
    const cap = ok(p.patrimonioLiquido) && ok(p.divida) ? p.patrimonioLiquido + p.divida - (p.caixa ?? 0) : null
    return ok(ebitX) && ok(cap) && cap > 0 ? (ebitX * (1 - pr.aliquotaNopat)) / cap : null
  }).filter((x): x is number => ok(x))
  const retornos = e.financeira ? e.anual.map((p) => dividir(lucroDosAcionistas(p), p.plControladores)).filter((x): x is number => ok(x)) : roicsAnuais
  const limiar = 0.15
  const acima = retornos.filter((x) => x >= limiar).length
  const mb = anuais.map((c) => c.margemBruta).filter((x): x is number => ok(x))
  const dpMb = desvio(mb)
  const evidencias: string[] = []
  if (retornos.length >= 3) evidencias.push(`${e.financeira ? 'ROE' : 'ROIC'} acima de ${pct(limiar, 0)} em ${acima} de ${retornos.length} exercícios.`)
  if (ok(dpMb) && mb.length >= 3) evidencias.push(`Margem bruta ${dpMb <= 0.02 ? 'muito estável' : dpMb <= 0.05 ? 'razoavelmente estável' : 'volátil'} (variação de ${pct(dpMb)} entre exercícios), ${dpMb <= 0.02 ? 'o que sugere poder de preço' : 'sem evidência clara de poder de preço'}.`)
  if (ok(cg.receita)) evidencias.push(`Receita cresceu ${pct(cg.receita)} ao ano em ${cg.anos} anos (nominal).`)
  const classificacaoVantagem: AnaliseFundamentalista['vantagem']['classificacao'] =
    retornos.length < 3 ? 'nao-demonstrada' : acima >= retornos.length - 0 && (dpMb === null || dpMb <= 0.05) ? 'forte' : acima >= Math.ceil(retornos.length * 0.6) ? 'moderada' : acima >= 1 ? 'fraca' : 'nao-demonstrada'

  const crescimentoLeitura = (() => {
    if (!ok(cg.receita) && !ok(cg.lpa)) return 'Sem base positiva para calcular o crescimento composto.'
    const aceleracao = anuais.length >= 4 ? (() => {
      const r = anuais.map((c) => c.crescimentoReceita).filter((x): x is number => ok(x))
      const metade = Math.floor(r.length / 2)
      const antes = media(r.slice(0, metade))
      const depois = media(r.slice(metade))
      return ok(antes) && ok(depois) ? (depois > antes + 0.03 ? 'acelerando' : depois < antes - 0.03 ? 'desacelerando' : 'estável') : null
    })() : null
    return `Receita ${ok(cg.receita) ? `com crescimento composto de ${pct(cg.receita)} ao ano` : 'sem crescimento composto calculável'}, lucro por ação ${ok(cg.lpa) ? `${pct(cg.lpa)} ao ano` : 'sem crescimento composto calculável (base negativa ou ausente)'}${aceleracao ? `; ritmo ${aceleracao}` : ''}.`
  })()

  const itensGov: { tema: string; situacao: string }[] = [
    { tema: 'Classes de ação', situacao: e.acoes ? (e.acoes.classes.length > 1 ? `ON e PN: duas classes com direitos diferentes (${e.acoes.classes.map((c) => c.ticker).join(' e ')}).` : `Classe única (${e.acoes.classes[0].classe}).`) : 'Dados insuficientes para conclusão.' },
    { tema: 'Diluição e recompras', situacao: ok(diluicao) ? (diluicao > 0.05 ? `A quantidade de ações subiu ${pct(diluicao)} no período: diluição.` : diluicao < -0.03 ? `A quantidade de ações caiu ${pct(Math.abs(diluicao))}: recompras líquidas.` : 'Quantidade de ações praticamente estável.') : 'Dados insuficientes para conclusão.' },
    { tema: 'Política de dividendos', situacao: dividendos.leitura },
    { tema: 'Qualidade e transparência das divulgações', situacao: e.alertas.some((a) => a.startsWith('reapresentado')) ? 'Houve reapresentação de demonstrações com mudança material no lucro.' : 'Sem reapresentação material detectada nos exercícios analisados.' },
    { tema: 'Estrutura acionária, partes relacionadas, auditoria e controvérsias', situacao: 'Dados insuficientes para conclusão: essas informações não constam das demonstrações lidas. Consulte o Formulário de Referência e o parecer da auditoria na CVM.' },
  ]

  // Alertas
  const alertas: Alerta[] = []
  const lucrosAnuais = anuais.map((c) => c.lucroLiquido).filter((x): x is number => ok(x))
  const negativos = lucrosAnuais.filter((x) => x < 0).length
  if (negativos >= 3 || (negativos >= 2 && ok(lucroAtual) && lucroAtual < 0)) alertas.push({ id: 'lucro-negativo', titulo: 'Lucro persistentemente negativo', detalhe: `Prejuízo em ${negativos} de ${lucrosAnuais.length} exercícios${ok(lucroAtual) && lucroAtual < 0 ? ' e nos últimos 12 meses' : ''}.`, gravidade: 'critico' })
  else if (ok(lucroAtual) && lucroAtual < 0) alertas.push({ id: 'lucro-negativo-ttm', titulo: 'Prejuízo nos últimos 12 meses', detalhe: 'O lucro dos últimos 12 meses é negativo.', gravidade: 'atencao' })
  const fcfs = anuais.map((c) => c.fcf).filter((x): x is number => ok(x))
  if (!e.financeira && fcfs.length >= 3 && fcfs.filter((x) => x < 0).length >= Math.ceil(fcfs.length * 0.6) && (!ok(fcfAtual) || fcfAtual < 0)) {
    // Investimento pesado financiado por dívida (energia, saneamento, concessões) deixa o FCF negativo sem ser problema por si só:
    // só é crítico quando o prejuízo, o endividamento ou a cobertura de juros também são ruins.
    const fragil = (ok(lucroAtual) && lucroAtual < 0) || (ok(dlEbitda) && dlEbitda > (setorAlavancado ? 5 : 3.5)) || (ok(cobertura) && cobertura < 1.5)
    alertas.push({ id: 'fcf-negativo', titulo: 'Fluxo de caixa livre estruturalmente negativo', detalhe: `FCF negativo em ${fcfs.filter((x) => x < 0).length} de ${fcfs.length} exercícios${fragil ? ', com lucro, endividamento ou cobertura de juros também frágeis' : ' (típico de quem investe pesado; confira se o retorno compensa)'}.`, gravidade: fragil ? 'critico' : 'atencao' })
  }
  const tetoDl = setorAlavancado ? 5 : 3.5
  const coberturaInsuficiente = ok(cobertura) && cobertura < 1
  if (!e.financeira && ((ok(dlEbitda) && dlEbitda > tetoDl) || (ok(dlAtual) && dlAtual > 0 && ok(atual.ebitda) && atual.ebitda <= 0) || coberturaInsuficiente)) {
    alertas.push({
      id: 'endividamento',
      titulo: 'Endividamento preocupante',
      detalhe:
        ok(dlEbitda) && dlEbitda > tetoDl ? `Dívida líquida de ${vezes(dlEbitda)} o EBITDA (limite de atenção ${vezes(tetoDl)} para o setor).`
        : coberturaInsuficiente ? `O EBIT (${vezes(cobertura as number, 2)}) não cobre a despesa financeira dos últimos 12 meses.`
        : 'Há dívida líquida e o EBITDA é negativo ou nulo.',
      gravidade: 'critico',
    })
  }
  else if (!e.financeira && ok(cobertura) && cobertura < 1.5) alertas.push({ id: 'cobertura-baixa', titulo: 'Cobertura de juros apertada', detalhe: `EBIT cobre só ${vezes(cobertura)} a despesa financeira.`, gravidade: 'atencao' })
  const mEbit = anuais.map((c) => c.margemEbit).filter((x): x is number => ok(x))
  const mAtual = dividir(atual.ebit, atual.receita)
  if (!e.financeira && mEbit.length >= 3 && ok(mAtual)) {
    const mediaAnt = media(mEbit.slice(-3)) as number
    if (mediaAnt > 0 && (mAtual < mediaAnt * 0.7 || mediaAnt - mAtual > 0.05)) alertas.push({ id: 'margens', titulo: 'Deterioração de margens', detalhe: `Margem EBIT de ${pct(mAtual)} nos últimos 12 meses contra média de ${pct(mediaAnt)} nos 3 exercícios anteriores.`, gravidade: 'atencao' })
  }
  // Diluição "recorrente" exige ao menos dois aumentos de mais de 3% em exercícios diferentes; um aumento de capital isolado, mesmo
  // grande, é só atenção. (Desdobramentos e bonificações já saem da conta no job, pela variação da quantidade de ações.)
  const sequenciaAcoes = [...anuais.map((c) => c.acoes), acoesFim].filter((x): x is number => ok(x) && x > 0)
  const aumentos = sequenciaAcoes.slice(1).filter((q, i) => q > sequenciaAcoes[i] * 1.03).length
  if (ok(diluicao) && diluicao > 0.1) {
    alertas.push({
      id: 'diluicao',
      titulo: aumentos >= 2 ? 'Diluição recorrente' : 'Aumento de capital no período',
      detalhe: `A quantidade de ações subiu ${pct(diluicao)} no período, em ${aumentos} ${aumentos === 1 ? 'exercício' : 'exercícios'} com aumento de mais de 3%.`,
      gravidade: diluicao > 0.3 && aumentos >= 2 ? 'critico' : 'atencao',
    })
  }
  if ((ok(payoutLucro) && payoutLucro > 1 && ok(payoutFcf) && payoutFcf > 1) || (e.financeira && ok(payoutLucro) && payoutLucro > 1.1)) alertas.push({ id: 'dividendos', titulo: 'Dividendos aparentemente insustentáveis', detalhe: 'Os proventos pagos superam o lucro' + (e.financeira ? '.' : ' e o fluxo de caixa livre.'), gravidade: 'atencao' })
  if (!e.financeira && ok(atual.fco) && !fcoAtualOk) alertas.push({ id: 'fco-incoerente', titulo: 'Caixa operacional incoerente com o resultado', detalhe: 'O caixa operacional passa de 2× o EBITDA: pode ser financiamento ou evento pontual classificado como operação. O fluxo de caixa livre foi desconsiderado.', gravidade: 'atencao' })
  const falhas: string[] = []
  if (anuais.length < 3) falhas.push(`só ${anuais.length} exercícios`)
  if (!e.ttm) falhas.push('sem 12 meses (ITR)')
  if (!e.acoes) falhas.push('sem quantidade de ações confiável')
  if (e.alertas.includes('capital_implausivel')) falhas.push('quantidade de ações sob suspeita (P/VP implícito fora da faixa)')
  if (e.alertas.includes('classe_sem_preco')) falhas.push('classe de ação sem preço recente')
  if (!e.financeira && !ok(atual.capex)) falhas.push('CAPEX não identificado na DFC')
  if (falhas.length) alertas.push({ id: 'dados', titulo: 'Dados incompletos ou inconsistentes', detalhe: falhas.join('; ') + '.', gravidade: e.alertas.includes('capital_implausivel') || !e.acoes ? 'critico' : 'info' })
  if (vj.aplicavel && vj.confianca === 'baixa') alertas.push({ id: 'confianca-valor', titulo: 'Valor justo com baixa confiança', detalhe: vj.confiancaMotivos.join(' '), gravidade: 'info' })

  // Pontuação
  const qualidade = notaQualidade(e, cols, { roic, roe, cagrLpa: cg.lpa, cagrReceita: cg.receita }, pr.pesos.qualidade)
  const valuation = notaValuation(vj, relativo, pr.pesos.valuation)
  const plAtivo = dividir(atual.plControladores, atual.ativoTotal)
  const risco = notaRisco(e, cols, { dlEbitda, cobertura, liquidez, diluicao, payoutFcf, plAtivo, semDividaLiquida, setorAlavancado }, pr.pesos.risco)
  const dims = [qualidade, valuation, risco].filter((d) => ok(d.nota))
  const somaPesos = dims.reduce((s, d) => s + d.peso, 0)
  const total = somaPesos > 0 ? Math.round(dims.reduce((s, d) => s + (d.nota as number) * d.peso, 0) / somaPesos) : null
  const parcial = dims.length < 3

  // Categoria: uma nota alta não neutraliza risco crítico.
  // Problema de DADOS não é risco da empresa: não vira "evitar", e sim "dados insuficientes para conclusão".
  const dadosCriticos = alertas.some((a) => a.id === 'dados' && a.gravidade === 'critico')
  const criticos = alertas.filter((a) => a.gravidade === 'critico' && a.id !== 'dados')
  const q = qualidade.nota
  const v = valuation.nota
  const r = risco.nota
  let categoria: CategoriaAnalise
  if (total === null) categoria = 'neutra'
  else if (criticos.length && ((q ?? 0) < 60 || total < 50)) categoria = 'evitar'
  else if (total < 35) categoria = 'evitar'
  else if (total < 45 || (v !== null && v < 30 && (q ?? 0) < 60)) categoria = 'pouco-atrativa'
  else if (criticos.length) categoria = 'neutra'
  else if (total >= 68 && (q ?? 0) >= 65 && (v ?? 0) >= 60 && (r ?? 0) >= 55) categoria = 'atrativa'
  else if (total >= 58 && (v === null || v >= 45)) categoria = 'atrativa-com-ressalvas'
  else categoria = 'neutra'
  if (dadosCriticos) categoria = 'neutra'

  // Recomendação (decorre das condições abaixo, não só da nota)
  const just: string[] = []
  const reav: string[] = []
  let rec: Recomendacao
  const ms = vj.margemSegurancaPct
  if (dadosCriticos) {
    rec = 'manter-acompanhar'
    just.push('Dados insuficientes para conclusão: a quantidade de ações ou a demonstração não permite medir o valor da empresa com segurança.')
    reav.push('Correção do dado na CVM ou atualização do cadastro.')
  } else if (categoria === 'evitar') {
    rec = 'evitar-novos'
    just.push(criticos.length ? `Há alerta crítico: ${criticos.map((a) => a.titulo.toLowerCase()).join('; ')}.` : 'Nota consolidada baixa.')
    reav.push('Melhora dos alertas críticos nos próximos balanços.', 'Retomada de lucro e de fluxo de caixa livre positivos.')
  } else if (criticos.length) {
    rec = 'manter-acompanhar'
    just.push(`Há alerta crítico (${criticos.map((a) => a.titulo.toLowerCase()).join('; ')}) que impede considerar entrada, apesar da nota.`)
    reav.push('Melhora do alerta crítico nos próximos balanços.')
  } else if (categoria === 'pouco-atrativa' && ok(ms) && ms < 0 && vj.confianca !== 'baixa') {
    rec = 'reduzir-exposicao'
    just.push('Nota consolidada baixa e preço acima do valor justo estimado.')
    reav.push('Preço abaixo do valor justo base.', 'Melhora das notas de qualidade ou de segurança.')
  } else if ((categoria === 'atrativa' || categoria === 'atrativa-com-ressalvas') && ok(ms) && ms >= pr.margemSegurancaAlvo * 100 && vj.confianca !== 'baixa') {
    rec = 'considerar-entrada'
    just.push(`Fundamentos sólidos e margem de segurança de ${ms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% sobre o valor justo base (alvo de ${Math.round(pr.margemSegurancaAlvo * 100)}%).`)
    reav.push('Piora de margens ou de caixa nos próximos balanços.', 'Valor justo base cair abaixo do preço.')
  } else if ((q ?? 0) >= 55 && (v === null || v < 55 || (ok(ms) && ms < pr.margemSegurancaAlvo * 100))) {
    rec = 'aguardar-preco'
    just.push(ok(ms) ? `Boa qualidade, mas a margem de segurança (${ms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%) está abaixo do alvo de ${Math.round(pr.margemSegurancaAlvo * 100)}%.` : 'Boa qualidade, mas o preço não oferece margem de segurança comprovada.')
    if (vj.precoEntrada) reav.push(`Preço em torno de ${reais(vj.precoEntrada)} (margem de segurança de ${Math.round(pr.margemSegurancaAlvo * 100)}% sobre o valor base).`)
  } else {
    rec = 'manter-acompanhar'
    just.push('Sem quadro claro de oportunidade nem de risco crítico.')
    reav.push('Novo balanço trimestral e mudança relevante do preço.')
  }
  if (vj.confianca === 'baixa' && vj.aplicavel) just.push('O valor justo tem baixa confiança: trate a faixa de valores como ordem de grandeza.')

  const resumo = (() => {
    const partes: string[] = []
    partes.push(`${e.nome} (${e.ticker}) — ${ROTULO_CATEGORIA[categoria].toLowerCase()}${total !== null ? `, nota ${total} de 100${parcial ? ' (parcial)' : ''}` : ''}.`)
    if (ok(q) || ok(v) || ok(r)) partes.push(`Qualidade ${q ?? '—'}, valuation ${v ?? '—'}, segurança ${r ?? '—'}.`)
    if (vj.aplicavel && ok(ms)) partes.push(`Valor justo base de ${reais(vj.cenarios.find((c) => c.cenario === 'base')?.valorJusto as number)} (faixa ${reais(vj.faixa!.minimo)} a ${reais(vj.faixa!.maximo)}): ${ms >= 0 ? `margem de segurança de ${ms.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : `preço ${Math.abs(ms).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% acima do valor justo base`}.`)
    else partes.push('Valor justo: dados insuficientes para conclusão.')
    if (criticos.length) partes.push(`Alertas críticos: ${criticos.map((a) => a.titulo.toLowerCase()).join('; ')}.`)
    return partes.join(' ')
  })()

  // Riscos
  const setorRiscos = RISCOS_SETOR.find((s) => s.teste.test(e.setor))?.riscos ?? RISCOS_GENERICOS
  const externos: Risco[] = setorRiscos.map(([titulo, descricao, monitorar]) => ({ titulo, descricao: `${descricao} (Risco típico do setor, não específico da empresa.)`, probabilidade: 'nao-avaliada', impacto: 'medio', monitorar, mitigacao: 'Diversificação entre setores e acompanhamento dos resultados trimestrais.', efeitoNoValor: 'Altera as premissas de crescimento e de desconto do valor justo.' }))
  const especificos: Risco[] = []
  if (!e.financeira && ok(dlEbitda)) especificos.push({ titulo: 'Endividamento', descricao: `Dívida líquida de ${vezes(dlEbitda)} o EBITDA e cobertura de juros de ${ok(cobertura) ? vezes(cobertura) : 'valor indisponível'}.`, probabilidade: dlEbitda > tetoDl ? 'alta' : dlEbitda > 2 ? 'media' : 'baixa', impacto: 'alto', monitorar: 'Dívida líquida/EBITDA e cobertura de juros a cada balanço.', mitigacao: 'Geração de caixa, alongamento de prazos e venda de ativos.', efeitoNoValor: 'Dívida alta reduz o valor do acionista e eleva a taxa de desconto.' })
  if (!e.financeira && ok(fcfAtual)) especificos.push({ titulo: 'Geração de caixa', descricao: fcfAtual > 0 ? `Fluxo de caixa livre positivo de ${milhoesDeMil(fcfAtual)} nos últimos 12 meses.` : `Fluxo de caixa livre negativo de ${milhoesDeMil(fcfAtual)} nos últimos 12 meses.`, probabilidade: fcfAtual > 0 ? (fcfs.filter((x) => x < 0).length >= 2 ? 'media' : 'baixa') : 'alta', impacto: 'alto', monitorar: 'FCO, CAPEX e conversão do lucro em caixa.', mitigacao: 'Redução de investimentos e disciplina de capital de giro.', efeitoNoValor: 'O valor justo por fluxo de caixa depende diretamente desse fluxo.' })
  if (ok(mAtual) && mEbit.length >= 2 && !e.financeira) especificos.push({ titulo: 'Margens', descricao: `Margem EBIT de ${pct(mAtual)} contra média de ${pct(media(mEbit.slice(-3)) as number)} nos exercícios anteriores.`, probabilidade: alertas.some((a) => a.id === 'margens') ? 'alta' : 'media', impacto: 'medio', monitorar: 'Margem bruta e operacional trimestral.', mitigacao: 'Repasse de preços e ganhos de eficiência.', efeitoNoValor: 'Margens menores reduzem o fluxo de caixa projetado.' })
  if (e.financeira) especificos.push({ titulo: 'Qualidade da carteira e do capital', descricao: 'Para instituições financeiras, inadimplência, provisões e índices de capital são os riscos centrais e não constam das demonstrações lidas.', probabilidade: 'nao-avaliada', impacto: 'alto', monitorar: 'Índice de Basileia, inadimplência e provisões nos releases de resultado.', mitigacao: 'Diversificação da carteira e capital acima do mínimo regulatório.', efeitoNoValor: 'Afeta o ROE sustentável e, portanto, o P/VP justo.' })
  if (ok(diluicao) && diluicao > 0.05) especificos.push({ titulo: 'Diluição de acionistas', descricao: `Quantidade de ações subiu ${pct(diluicao)} no período.`, probabilidade: 'alta', impacto: 'medio', monitorar: 'Aumentos de capital e emissão de ações.', mitigacao: 'Recompras e geração de caixa que evite novas emissões.', efeitoNoValor: 'Reduz o lucro por ação e o valor por ação.' })
  if (e.ttm && ok(lucroAtual) && lucroAtual < 0) especificos.push({ titulo: 'Prejuízo recente', descricao: 'O lucro dos últimos 12 meses é negativo.', probabilidade: 'alta', impacto: 'alto', monitorar: 'Retorno ao lucro nos próximos trimestres.', mitigacao: 'Reestruturação e controle de custos.', efeitoNoValor: 'Métodos baseados em lucro deixam de se aplicar.' })
  while (especificos.length < 3) especificos.push({ titulo: 'Resultados abaixo do esperado', descricao: 'Surpresas negativas em receita ou margens podem reduzir o valor justo.', probabilidade: 'nao-avaliada', impacto: 'medio', monitorar: 'Resultado trimestral frente ao histórico.', mitigacao: 'Acompanhar guia da administração e mudanças de mercado.', efeitoNoValor: 'Reduz o fluxo de caixa e o LPA usados no valor justo.' })

  return {
    ticker: e.ticker,
    nome: e.nome,
    setor: e.setor,
    financeira: e.financeira,
    mercado: { preco: mercado.preco, valorMercado: mercado.valorMercado, ev, acoes: mercado.acoes, aproximado: mercado.aproximado },
    dados: {
      ultimoExercicio: e.anual.length ? (e.anual[e.anual.length - 1].exercicio ?? null) : null,
      ultimoTrimestre: ref,
      documento: `${e.ultimaDemonstracao.doc} de ${dataBr(e.ultimaDemonstracao.dtRefer)}`,
      dataCorte: entrada.dataCorte ?? null,
      geradoEm: entrada.geradoEm ?? null,
      exercicios: e.anual.length,
      fonte,
      limitacoes,
    },
    historico: cols,
    cagr: cg,
    rentabilidade,
    endividamentoECaixa,
    multiplos,
    valorJusto: vj,
    dividendos,
    vantagem: { classificacao: classificacaoVantagem, evidencias, limite: 'Indício financeiro, não análise do negócio: barreiras de entrada, marca, escala e tecnologia não constam das demonstrações. A conclusão qualitativa exige leitura dos documentos da empresa.' },
    crescimento: { leitura: crescimentoLeitura, origem: 'A separação entre crescimento orgânico, aquisições e preços exige o relatório da administração: dados insuficientes para conclusão. Perspectivas setoriais e TAM não são calculados aqui.' },
    governanca: { itens: itensGov },
    riscos: { especificos: especificos.slice(0, 3), externos },
    pontuacao: { qualidade, valuation, risco, total, parcial, pesos: pr.pesos },
    alertas,
    categoria,
    recomendacao: { categoria: rec, justificativa: just, reavaliar: reav },
    resumo,
  }
}
