/**
 * Tipos e textos do "Top 15 ações pagadoras de dividendos" (D122). O ranking é calculado FORA do app, pelo job
 * scripts/atualizar-acoes-dividendos.mjs, e chega pronto em data/acoesDividendos.json: o app só mostra, sem recalcular nem
 * reordenar, para a tela ser sempre igual à pasta de auditoria. Acesso aberto, sem código.
 */

import type { CampoAuditoriaDiaria } from './auditoriaDiaria'

export interface ProventoPago {
  /** Último dia com direito ao provento (data com), AAAA-MM-DD. */
  dataCom: string
  tipo: 'DIVIDENDO' | 'JRS CAP PROPRIO' | 'RENDIMENTO' | string
  /** Valor bruto por ação, já ajustado a desdobramentos posteriores. */
  valor: number
}

export interface ItemDividendos {
  posicao: number
  ticker: string
  nome: string | null
  setor: string | null
  classe: string
  cotacao: number
  dataCotacao: string
  /** Dividend yield dos últimos 12 meses: proventos por ação ÷ cotação (0,0925 = 9,25%). */
  dy: number
  proventosPorAcao: number
  dividendos: number
  jcp: number
  rendimentos: number
  pagamentos: number
  ultimaDataCom: string
  primeiraDataCom: string
  /** A B3 não devolveu o histórico desta empresa: só os proventos do cadastro dela (últimos meses), que podem não alcançar o início da janela. */
  historicoParcial: boolean
  ajustesAplicados: { data: string; fator: number }[]
  alertas: string[]
  proventos: ProventoPago[]
}

export interface ExclusaoDividendos {
  ticker: string
  nome: string | null
  setor: string | null
  etapa: string
  codigo: string
  motivo: string
}

export interface EtapaDividendos {
  id: string
  descricao: string
  entram: number
  saem: number
}

export interface SnapshotAcoesDividendos extends CampoAuditoriaDiaria {
  publicado: boolean
  versaoMetodologia: string
  geradoEm: string | null
  dataExecucao: string | null
  dataPrecos: string | null
  pastaAuditoria: string | null
  hashResultado: string | null
  hashInsumos: string | null
  hashConfig: string | null
  tamanhoDaLista: number
  rankingAteOnde: number
  universo: number
  avaliadas: number
  aviso: string | null
  parametros: {
    janelaDias: number
    janelaInicio: string
    liquidezMinimaDiariaReais: number
    sessoesLiquidez: number
    alertaDyAcimaDe: number
  }
  contagens: { ranking: number; exclusoes: number }
  etapas: EtapaDividendos[]
  ranking: ItemDividendos[]
  exclusoes: ExclusaoDividendos[]
}

export const ROTULO_TIPO_PROVENTO: Record<string, string> = {
  DIVIDENDO: 'Dividendo',
  'JRS CAP PROPRIO': 'Juros sobre capital próprio (bruto)',
  RENDIMENTO: 'Rendimento',
}

export const ROTULO_EXCLUSAO_DIVIDENDOS: Record<string, string> = {
  sem_preco: 'Sem preço recente na B3',
  liquidez_baixa: 'Pouca liquidez',
  sem_dados_b3: 'Sem proventos publicados pela B3',
  sem_proventos: 'Não pagou proventos em 12 meses',
  classe_desconhecida: 'Classe da ação não identificada',
}

/** Conta as exclusões por motivo, do mais frequente para o menos; desempata pelo rótulo. */
export function contarExclusoesDividendos(exclusoes: ExclusaoDividendos[]): { codigo: string; rotulo: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const e of exclusoes) mapa.set(e.codigo, (mapa.get(e.codigo) ?? 0) + 1)
  return [...mapa.entries()]
    .map(([codigo, total]) => ({ codigo, rotulo: ROTULO_EXCLUSAO_DIVIDENDOS[codigo] ?? codigo, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Quem ficou fora do ranking (ou além das posições mostradas) e por quê, para a busca "por que uma ação ficou de fora?". */
export function buscarSituacaoDividendos(s: SnapshotAcoesDividendos, termo: string): { ticker: string; nome: string | null; texto: string }[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []
  const bate = (ticker: string, nome: string | null) => semAcento(ticker).includes(t) || semAcento(nome ?? '').includes(t)
  const saida: { ticker: string; nome: string | null; texto: string }[] = []
  for (const r of s.ranking) {
    if (bate(r.ticker, r.nome)) saida.push({ ticker: r.ticker, nome: r.nome, texto: `Está na ${r.posicao}ª posição, com dividend yield de ${(r.dy * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% em 12 meses.` })
  }
  for (const e of s.exclusoes) {
    if (bate(e.ticker, e.nome)) saida.push({ ticker: e.ticker, nome: e.nome, texto: e.motivo })
  }
  return saida.slice(0, 8)
}
