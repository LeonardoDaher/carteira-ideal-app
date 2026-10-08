/**
 * Tipos e textos dos rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" (D70).
 * Os rankings são calculados FORA do app, pelo job scripts/atualizar-top15-mercado.mjs, e chegam prontos: o app só
 * mostra, sem recalcular nem reordenar, para a tela ser sempre igual à pasta de auditoria.
 */

export interface ExclusaoMercado {
  ticker: string
  nome: string | null
  categoria?: string
  setor?: string
  codigo: string
  motivo: string
}

export interface CabecalhoMercado {
  publicado: boolean
  versaoMetodologia: string
  geradoEm: string | null
  dataExecucao: string | null
  ultimoPregao: string | null
  pastaAuditoria: string | null
  hashResultado: string | null
  hashInsumos: string | null
  hashConfig: string | null
  tamanhoDaLista: number
  universo: number
  elegiveis: number
  aviso: string | null
}

// ---------------------------------------------------------------------------------------
// ETFs
// ---------------------------------------------------------------------------------------

export interface ItemEtfTop {
  ticker: string
  nome: string
  categoria: string
  /** Mediana do volume financeiro diário dos últimos pregões da janela (dia sem negócio conta zero). */
  volumeMediano: number
  volumeMedio: number
  diasNegociados: number
  cotacao: number | null
  dataCotacao: string | null
  variacao3m: number | null
  posicaoGeral: number
  posicaoNaCategoria?: number
}

export interface SnapshotEtfsMaisNegociados extends CabecalhoMercado {
  parametros: {
    tamanhoPorCategoria: number
    janelaLiquidez: number
    janela3Meses: number
    volumeMinimoDiario: number
    diasNegociadosMinimos: number
    pregoesMaxSemNegocio: number
  }
  geral: ItemEtfTop[]
  porCategoria: Record<string, ItemEtfTop[]>
  exclusoes: ExclusaoMercado[]
}

/** Mesmo formato para ETFs, FIIs, ações e BDRs mais negociados (D71): muda só a classe e a categoria (segmento, setor). */
export type SnapshotMaisNegociados = SnapshotEtfsMaisNegociados

export const ROTULO_EXCLUSAO_ETF: Record<string, string> = {
  excluido_manual: 'Fora por decisão registrada (não é fundo de índice comum)',
  sem_negocio: 'Sem negócio no período',
  cotacao_defasada: 'Cotação desatualizada',
  poucos_dias_negociados: 'Negocia em poucos dias',
  liquidez_baixa: 'Pouca liquidez',
}

// ---------------------------------------------------------------------------------------
// BDRs
// ---------------------------------------------------------------------------------------

export interface ItemBdrTop {
  posicao?: number
  ticker: string
  nome: string | null
  setor: string | null
  cotacao: number
  dataCotacao: string
  maximaFechamento12m: number
  dataMaxima: string | null
  /** Fração: 0,4 = 40% abaixo da máxima de fechamento dos últimos 252 pregões. */
  desconto: number
  variacao3m: number | null
  volumeMediano: number
  diasNegociados: number
  pregoesComDado: number
  acoesPorBdr: number | null
  alertas?: string[]
}

export interface SnapshotBdrsDesconto extends CabecalhoMercado {
  acessoRestrito: boolean
  instagram: string | null
  parametros: {
    janelaLiquidez: number
    janela3Meses: number
    janelaMaxima: number
    pregoesMinimosHistorico: number
    volumeMinimoDiario: number
    diasNegociadosMinimos: number
    pregoesMaxSemNegocio: number
    saltoQueda: number
    saltoAlta: number
    descontoParaConferir: number
  }
  contagens: { ranking: number; aConferir: number; exclusoes: number }
  ranking: ItemBdrTop[]
  aConferir: ItemBdrTop[]
  exclusoes: ExclusaoMercado[]
}

export const ROTULO_EXCLUSAO_BDR: Record<string, string> = {
  excluido_manual: 'Empresa brasileira listada no exterior',
  sem_negocio: 'Sem negócio no período',
  cotacao_defasada: 'Cotação desatualizada',
  poucos_dias_negociados: 'Negocia em poucos dias',
  liquidez_baixa: 'Pouca liquidez',
  historico_curto: 'Histórico curto (menos de 12 meses de negócios)',
}

export const ROTULO_ALERTA_BDR: Record<string, { titulo: string; texto: string }> = {
  salto_de_preco: {
    titulo: 'Salto de preço',
    texto: 'O preço mudou de forma brusca de um pregão para o outro. Pode ser desdobramento ou grupamento ainda não confirmado, o que distorce o desconto, ou um evento real da empresa.',
  },
  desconto_extremo: {
    titulo: 'Desconto muito grande',
    texto: 'O desconto passa do limite que a triagem aceita sem conferência. Pode ser desdobramento não confirmado ou uma queda real e grave da empresa.',
  },
}

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por código ou nome entre os ativos que ficaram de fora (no mínimo 2 caracteres, até 8 resultados). */
export function buscarExclusaoMercado(exclusoes: ExclusaoMercado[], termo: string): ExclusaoMercado[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []
  return exclusoes.filter((e) => semAcento(e.ticker).includes(t) || semAcento(e.nome ?? '').includes(t)).slice(0, 8)
}

/** Conta as exclusões por motivo, do mais frequente para o menos; desempata pelo rótulo. */
export function contarExclusoesMercado(exclusoes: ExclusaoMercado[], rotulos: Record<string, string>): { codigo: string; rotulo: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const e of exclusoes) mapa.set(e.codigo, (mapa.get(e.codigo) ?? 0) + 1)
  return [...mapa.entries()]
    .map(([codigo, total]) => ({ codigo, rotulo: rotulos[codigo] ?? codigo, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
