import type { ExclusaoTriagem } from './acoesBaratas'
import type { CampoAuditoriaDiaria } from './auditoriaDiaria'

/**
 * Triagem "Top 15 FIIs baratos" (D59 a D65). O ranking é calculado FORA do app, pelo job
 * scripts/atualizar-fii-baratos.mjs, e chega pronto (com a nota e a posição de cada fundo já fixadas) pela
 * função api/top15-fiis, depois de conferido o código do mês. O app nunca recalcula nota nem reordena, para a
 * tela ser sempre igual à pasta de auditoria.
 */

export type GrupoFii = 'tijolo' | 'papel'

export interface ConferenciaFii {
  em: string
  fonte: string
  nota: string | null
}

export interface ItemFii {
  posicao: number | null
  ticker: string
  nome: string | null
  setorDeclarado: string | null
  cnpj: string
  tipo: GrupoFii
  /** Média dos ranks percentuais de P/VP (menor é melhor) e DY de 12 meses (maior é melhor), dentro do grupo (0 a 1). */
  nota: number | null
  pvp: number | null
  dy12: number | null
  /** DY dos últimos meses, anualizado: mediana dos 3 últimos meses × 12 ÷ cotação. */
  dyRecente: number | null
  razaoRendimentoRecente: number | null
  picoDeRendimento: number | null
  cotacao: number | null
  dataCotacao: string | null
  /** Valor patrimonial por cota (do Informe Mensal da CVM). */
  vp: number | null
  /** Soma dos rendimentos por cota dos últimos 12 meses (estimada: DY do mês × valor patrimonial). */
  rendimento12m: number | null
  rentabPatrimonial12m: number | null
  patrimonio: number | null
  cotistas: number | null
  alavancagem: number | null
  volumeMedio: number | null
  volumeMediano: number | null
  volumeLiquidez: number | null
  fonteLiquidez: 'mediana' | 'média' | null
  /** "B3 (boletim diário)", "brapi (histórico diário)" ou "brapi (job mensal de FIIs)". */
  fonteCotacao: string | null
  saltoMaximo: number | null
  fatias: { imoveis: number; recebiveis: number; cotas: number } | null
  mesesComDados: number
  alertas: string[]
  alertasLiberados?: string[]
  conferido?: ConferenciaFii
  conferenciaVencida?: string
  grupo?: GrupoFii
}

export interface ParametrosFiltroFii {
  volumeMinimoDiario: number
  patrimonioMinimo: number
  cotistasMinimos: number
  rentabPatrimonial12mMinima: number
  alavancagemMaxima: number
  pvpMinimo: number
  dy12Maximo?: number
}

export interface SnapshotFiiBaratos extends CampoAuditoriaDiaria {
  publicado: boolean
  /** Acesso por código (D50): o arquivo do app traz só o cabeçalho; a lista vem de /api/top15-fiis. */
  acessoRestrito?: boolean
  /** Perfil do Instagram onde o código do mês é divulgado (sem @). */
  instagram?: string | null
  versaoMetodologia: string
  geradoEm: string | null
  dataExecucao: string | null
  dataCotacoes: string | null
  ultimoPregaoDiario: string | null
  competenciaReferencia: string | null
  pastaAuditoria: string | null
  hashResultado: string | null
  hashInsumos: string | null
  hashConfig: string | null
  tamanhoDaLista: number
  universo: number
  /** Texto de aviso mostrado no fim da tela (vem da configuração do job). */
  aviso: string | null
  parametros: {
    filtros: { tijolo: ParametrosFiltroFii; papel: ParametrosFiltroFii }
    classificacao: { fatiaMinimaDoTipo: number }
    alertas: { pvpMuitoBaixo: number; dy12Alto: number; rendimentoRecenteMinimoSobre12m: number; picoDeRendimentoMaximo: number; saltoDePrecoDiario: number }
    mesesHistorico: number
    pregoesPrecoDiario: number
    conferenciaValidadeDias: number | null
  }
  contagens: { tijolo: number; papel: number; aConferir: number; exclusoes: number }
  tijolo: ItemFii[]
  papel: ItemFii[]
  aConferir: ItemFii[]
  exclusoes: ExclusaoTriagem[]
}

export const GRUPOS_FII: { id: GrupoFii; titulo: string; descricao: string }[] = [
  { id: 'tijolo', titulo: 'Tijolo', descricao: 'Fundos que têm imóveis (60% ou mais do ativo)' },
  { id: 'papel', titulo: 'Papel', descricao: 'Fundos de crédito imobiliário: CRI, LCI e semelhantes (60% ou mais do ativo)' },
]

/** O que cada alerta quer dizer, em linguagem direta. */
export const ROTULO_ALERTA: Record<string, { titulo: string; texto: string }> = {
  pvp_muito_baixo: { titulo: 'P/VP muito baixo', texto: 'A cota está muito abaixo do valor patrimonial. Pode ser desconto real e grande, ou cota e valor patrimonial em bases diferentes (por exemplo, depois de um desdobramento).' },
  dy_alto: { titulo: 'Rendimento de 12 meses muito alto', texto: 'O rendimento dos últimos 12 meses é alto demais para ser regra: costuma incluir distribuição que não se repete, ou refletir risco de crédito alto.' },
  rendimento_em_queda: { titulo: 'Rendimento em queda', texto: 'A mediana dos 3 últimos meses está bem abaixo da mediana dos 12 meses: o fundo cortou o rendimento, e o rendimento de 12 meses mostra o passado.' },
  rendimento_com_pico: { titulo: 'Rendimento com pico', texto: 'O rendimento de 12 meses depende de poucos meses fora do comum (pagamento extra, pico no informe ou rendimento de antes de um corte).' },
  salto_de_preco: { titulo: 'Salto de preço', texto: 'A cota variou mais de 25% de um dia para o outro: pode ter havido desdobramento ou grupamento, e o P/VP deixa de fazer sentido.' },
}

/** Motivo de exclusão (código do job) em português para a contagem "por que ficou de fora". */
export const ROTULO_EXCLUSAO: Record<string, string> = {
  sem_cnpj: 'Fundo não encontrado no informe da CVM',
  sem_cotacao: 'Sem cotação',
  sem_preco_diario: 'Sem preço diário da B3',
  cotacao_defasada: 'Cotação desatualizada',
  dados_insuficientes: 'Informe da CVM incompleto',
  fundo_de_fundos: 'Fundo de fundos (investe em cotas de outros fundos)',
  misto: 'Fundo misto (nem tijolo nem papel)',
  sem_ativo: 'Sem composição do ativo no informe',
  liquidez_baixa: 'Pouca liquidez',
  patrimonio_pequeno: 'Patrimônio pequeno',
  poucos_cotistas: 'Poucos cotistas',
  pvp_suspeito: 'P/VP abaixo do mínimo do grupo',
  dy_implausivel: 'Rendimento de 12 meses implausível',
  sem_rentabilidade_patrimonial: 'Sem rentabilidade patrimonial',
  patrimonio_em_queda: 'Patrimônio em queda',
  alavancado: 'Muito alavancado',
}

/** Agrupa as exclusões por motivo, do mais frequente para o menos. */
export function contarExclusoes(exclusoes: ExclusaoTriagem[]): { codigo: string; rotulo: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const e of exclusoes) mapa.set(e.codigo, (mapa.get(e.codigo) ?? 0) + 1)
  return [...mapa.entries()]
    .map(([codigo, total]) => ({ codigo, rotulo: ROTULO_EXCLUSAO[codigo] ?? codigo, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

/** P/VP com duas casas: 0,7363 → "0,74". */
export function formatarPvp(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Volume diário em reais: "R$ 850 mil" ou "R$ 2,5 mi". */
export function formatarVolumeDiario(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
  return `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil`
}

/** Data em que a conferência manual deixa de valer (conferidoEm + validade em dias). */
export function validadeDaConferencia(em: string, dias: number | null): string | null {
  if (dias == null) return null
  const d = new Date(`${em}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
