import { normalizarBusca } from './rendaFii'

/**
 * Triagem "Top 15 ações mais baratas" (D49). O ranking é calculado FORA do app, pelo job
 * scripts/atualizar-acoes-baratas.mjs, e chega pronto em data/acoesBaratas.json, com a nota de
 * cada empresa já fixada. Aqui só se filtra (qualidade, opcional) e se formata: o app nunca
 * recalcula nota nem reordena, para que a tela seja sempre igual à pasta de auditoria.
 */

export interface DemonstracaoUsada {
  doc: 'DFP' | 'ITR'
  dtRefer: string
  dtReceb: string | null
  linkDoc: string | null
}

/** Um pedaço do valor de 12 meses: exercício, acumulado do ano atual ou acumulado do ano anterior (este último subtrai). */
export interface ComponenteLtm {
  papel: string
  de: string | null
  ate: string
  doc: string
  valor: number
}

export interface ComposicaoLtm {
  valor: number
  componentes: ComponenteLtm[]
  /** Só no lucro: conta CVM usada e os dois valores de 12 meses (consolidado e dos controladores). */
  conta?: string
  consolidado?: number
  controladores?: number | null
}

export interface ExercicioHistorico {
  exercicio: string
  conta: string
  lucro: number
  fco: number
}

export interface ItemRanking {
  posicao: number
  ticker: string
  nome: string
  setor: string
  cotacao: number
  dataCotacao: string
  /** Média dos ranks percentuais dos três rendimentos (0 a 1; 1 = o mais barato). */
  nota: number
  plSobreValorDeMercado: number
  fcoSobreEv: number | null
  ebitAjustadoSobreEv: number | null
  pvp: number | null
  mktcap: number
  ev: number
  ebitAjustado: number
  fcoLtm: number
  lucroLtm: number
  roic: number | null
  dlEbitda: number | null
  caixaLiquido: boolean
  passaRoic: boolean
  passaDlEbitda: boolean
  passaFco: boolean
  /** EBIT ajustado ÷ |despesas financeiras| (12 meses). Nulo se não há despesa financeira ou a conta não existe. */
  coberturaJuros: number | null
  semDespesaFinanceira: boolean
  passaCobertura: boolean
  /** Exercícios (DFP) encontrados entre os N últimos, e quantos tiveram lucro e caixa operacional positivos. */
  exerciciosAnalisados: number
  exerciciosComLucro: number
  exerciciosComFco: number
  passaConsistencia: boolean
  composicaoLtm?: { ebit: ComposicaoLtm; fco: ComposicaoLtm; lucro: ComposicaoLtm }
  historico?: ExercicioHistorico[]
  volatilidade: number | null
  volumeMedio: number | null
  demonstracao: DemonstracaoUsada
  metodoValorDeMercado: 'por_classe' | 'preco_da_classe_de_referencia'
}

export interface ExclusaoTriagem {
  ticker: string
  nome: string
  setor: string
  etapa: string
  codigo: string
  motivo: string
}

export interface EtapaTriagem {
  id: string
  descricao: string
  entram: number
  saem: number
}

export interface SnapshotAcoesBaratas {
  publicado: boolean
  /** Acesso por código (D50): o arquivo do app traz só o cabeçalho; a lista vem de /api/top15. */
  acessoRestrito?: boolean
  /** Perfil do Instagram onde o código do mês é divulgado (sem @). */
  instagram?: string | null
  versaoMetodologia: string
  geradoEm: string | null
  dataPrecos: string | null
  dataCorte: string | null
  pastaAuditoria: string | null
  hashResultado: string | null
  hashInsumos: string | null
  hashConfig: string | null
  tamanhoDaLista: number
  universo: number
  parametros: {
    liquidezMinimaDiariaReais: number
    sessoesLiquidez: number
    percentilVolatilidadeExcluir: number
    sessoesVolatilidade: number
    metodoComposicao: string
    componentes: string[]
    setoresExcluidos: string[]
  }
  qualidade: {
    roicMinimo: number
    aliquotaImpostoNopat: number
    dlEbitdaMaximo: number
    fcoPositivo: boolean
    coberturaJurosMinima: number
    exerciciosConsistencia: number
    minimoComLucro: number
    minimoComFco: number
  }
  etapas: EtapaTriagem[]
  ranking: ItemRanking[]
  exclusoes: ExclusaoTriagem[]
}

export interface FiltrosQualidade {
  roic: boolean
  dlEbitda: boolean
  fco: boolean
  cobertura: boolean
  consistencia: boolean
}

export const SEM_FILTROS: FiltrosQualidade = { roic: false, dlEbitda: false, fco: false, cobertura: false, consistencia: false }

/** Mantém a ordem do ranking e retira só quem reprova nos filtros ligados. Não altera nota nem posição. */
export function aplicarQualidade(ranking: ItemRanking[], filtros: FiltrosQualidade): ItemRanking[] {
  return ranking.filter(
    (r) =>
      (!filtros.roic || r.passaRoic) &&
      (!filtros.dlEbitda || r.passaDlEbitda) &&
      (!filtros.fco || r.passaFco) &&
      (!filtros.cobertura || r.passaCobertura) &&
      (!filtros.consistencia || r.passaConsistencia),
  )
}

export function selecionarTop(ranking: ItemRanking[], filtros: FiltrosQualidade, tamanho: number) {
  const elegiveis = aplicarQualidade(ranking, filtros)
  return { lista: elegiveis.slice(0, tamanho), elegiveis: elegiveis.length, retiradosPorQualidade: ranking.length - elegiveis.length }
}

/** Quem está fora da triagem, por código ou nome (reaproveita a normalização da busca de FIIs). */
export function buscarExclusao(exclusoes: ExclusaoTriagem[], termo: string): ExclusaoTriagem[] {
  const t = normalizarBusca(termo)
  if (t.length < 2) return []
  return exclusoes.filter((e) => normalizarBusca(e.ticker).includes(t) || normalizarBusca(e.nome).includes(t)).slice(0, 8)
}

const NF = (casas: number) => ({ minimumFractionDigits: casas, maximumFractionDigits: casas })

/** 0,1234 → "12,3%". */
export function formatarPercentual(v: number | null | undefined, casas = 1): string {
  return v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('pt-BR', NF(casas))}%`
}

/** 1,3661 → "1,4x". */
export function formatarMultiplo(v: number | null | undefined, casas = 1): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', NF(casas))}x`
}

/** Reais em mil / milhão / bilhão, para valores de empresa. */
export function formatarReaisCompacto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const sinal = v < 0 ? '−' : ''
  if (a >= 1e9) return `${sinal}R$ ${(a / 1e9).toLocaleString('pt-BR', NF(1))} bi`
  if (a >= 1e6) return `${sinal}R$ ${(a / 1e6).toLocaleString('pt-BR', NF(0))} mi`
  return `${sinal}R$ ${a.toLocaleString('pt-BR', NF(0))}`
}

export const CONTAGEM_POR_ETAPA: Record<string, string> = {
  universo: 'Setor fora do escopo ou sem CNPJ',
  liquidez: 'Pouca liquidez',
  volatilidade: 'Entre as 10% mais voláteis (ou preço sem histórico confiável)',
  dados_contabeis: 'Demonstrações incompletas, defasadas ou incoerentes',
  lucro: 'Sem lucro nos últimos 12 meses',
  indicador: 'Rendimento sobre EV indefinido',
}

/** Como ler um componente do valor de 12 meses: sinal e descrição curta. */
export function descreverComponente(c: ComponenteLtm, formatarData: (iso: string) => string): { sinal: '+' | '−'; texto: string } {
  const sinal = c.papel.includes('(−)') ? '−' : '+'
  if (c.papel.startsWith('exercicio')) return { sinal, texto: `exercício encerrado em ${formatarData(c.ate)}` }
  return { sinal, texto: `acumulado de ${c.de ? formatarData(c.de) : '—'} a ${formatarData(c.ate)}` }
}
