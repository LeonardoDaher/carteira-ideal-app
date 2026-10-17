/**
 * Tipos e textos do "Top 15 empresas mais endividadas" (D94). O ranking é calculado FORA do app, pelo job
 * scripts/atualizar-acoes-endividadas.mjs, e chega pronto em data/acoesEndividadas.json: o app só mostra, sem recalcular nem
 * reordenar, para a tela ser sempre igual à pasta de auditoria. Acesso aberto, sem código.
 */

import type { CampoAuditoriaDiaria } from './auditoriaDiaria'

/** Conta da CVM usada: código, valor em R$ e como foi montada (exercício + acumulado atual − acumulado do ano anterior). */
export interface ContaCalculo {
  cd: string
  valor: number | null
  formula: string
}

export interface CalculoEndividada {
  dividaCurta: ContaCalculo | null
  dividaLonga: ContaCalculo | null
  caixaEEquivalentes: ContaCalculo | null
  aplicacoesFinanceiras: ContaCalculo | null
  ebit: ContaCalculo | null
  depreciacaoEAmortizacao: ContaCalculo | null
  ebitAjustado: { formula: string; valor: number | null }
  ebitda: { formula: string; valor: number | null }
  dividaLiquida: { formula: string; valor: number | null }
}

export interface ItemEndividada {
  /** Ausente na lista "sem EBITDA positivo" (a razão é indefinida). */
  posicao?: number
  ticker: string
  nome: string | null
  setor: string | null
  cotacao: number | null
  dataCotacao: string | null
  /** Dívida líquida ÷ EBITDA dos últimos 12 meses; nulo quando o EBITDA é zero ou negativo. */
  dlEbitda: number | null
  dividaLiquida: number
  dividaBruta: number
  caixa: number
  ebitda: number
  ebitAjustado: number | null
  plControladores: number | null
  mktcap: number | null
  /** EBIT ajustado ÷ despesa financeira; nulo sem despesa financeira. */
  coberturaJuros: number | null
  semDespesaFinanceira: boolean
  alertas: string[]
  demonstracao: { doc: string; dtRefer: string; dtReceb: string | null; linkDoc: string | null; consolidacao: string }
  calculo: CalculoEndividada
}

export interface ItemEndividadaResumo {
  ticker: string
  nome: string | null
  setor: string | null
  posicao: number
  dlEbitda: number
}

export interface ExclusaoEndividada {
  ticker: string
  nome: string | null
  setor: string | null
  etapa: string
  codigo: string
  motivo: string
}

export interface EtapaEndividada {
  id: string
  descricao: string
  entram: number
  saem: number
}

export interface SnapshotAcoesEndividadas extends CampoAuditoriaDiaria {
  publicado: boolean
  versaoMetodologia: string
  geradoEm: string | null
  dataExecucao: string | null
  dataPrecos: string | null
  /** Data de corte contábil: os balanços usados são os publicados até esta data. */
  dataCorte: string | null
  pastaAuditoria: string | null
  hashResultado: string | null
  hashInsumos: string | null
  hashConfig: string | null
  tamanhoDaLista: number
  universo: number
  avaliadas: number
  aviso: string | null
  parametros: {
    indicador: string
    liquidezMinimaDiariaReais: number
    sessoesLiquidez: number
    idadeMaximaDemonstracaoDias: number
    setoresExcluidos: string[]
  }
  contagens: { ranking: number; semEbitdaPositivo: number; exclusoes: number }
  etapas: EtapaEndividada[]
  ranking: ItemEndividada[]
  /** Quem está depois do Top N, só com a razão (para a busca "por que ficou de fora?"). */
  restante: ItemEndividadaResumo[]
  semEbitdaPositivo: ItemEndividada[]
  exclusoes: ExclusaoEndividada[]
}

export const ROTULO_EXCLUSAO_ENDIVIDADA: Record<string, string> = {
  setor_excluido: 'Setor financeiro (dívida é o negócio)',
  duplicidade_economica: 'Duplicidade com outra empresa da lista',
  sem_cnpj: 'Sem CNPJ mapeado na CVM',
  sem_preco: 'Sem preço recente na B3',
  liquidez_baixa: 'Pouca liquidez',
  sem_ebitda: 'Sem como calcular o EBITDA',
  caixa_liquido: 'Caixa maior que a dívida',
  sem_demonstracao: 'Sem demonstração na CVM',
  demonstracao_defasada: 'Demonstração desatualizada',
  sem_dre: 'DRE incompleta',
  dados_incompletos_ou_incoerentes: 'Dados da CVM incompletos ou incoerentes',
  balanco_nao_fecha: 'Balanço que não fecha',
  dre_nao_fecha: 'DRE que não fecha',
  sem_capital: 'Sem a quantidade de ações',
  capital_invalido: 'Quantidade de ações inválida',
  classe_sem_preco: 'Classe de ação sem preço',
  capital_implausivel: 'Valor de mercado implausível',
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface SituacaoEmpresa {
  ticker: string
  nome: string | null
  /** 'restante' = está no ranking, fora do Top N; 'semEbitda' = lista à parte; 'excluida' = não entrou. */
  tipo: 'restante' | 'semEbitda' | 'excluida'
  texto: string
}

/** Onde está uma empresa que não aparece no Top N, para a busca "por que ficou de fora?". */
export function buscarSituacao(s: SnapshotAcoesEndividadas, termo: string): SituacaoEmpresa[] {
  const t = semAcento(termo.trim())
  if (t.length < 2) return []
  const bate = (ticker: string, nome: string | null) => semAcento(ticker).includes(t) || semAcento(nome ?? '').includes(t)
  const dentro = new Set(s.ranking.map((r) => r.ticker))
  const saida: SituacaoEmpresa[] = []
  for (const r of s.restante) {
    if (bate(r.ticker, r.nome)) saida.push({ ticker: r.ticker, nome: r.nome, tipo: 'restante', texto: `Está na ${r.posicao}ª posição, com dívida líquida de ${r.dlEbitda.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x o EBITDA: fora do Top ${s.tamanhoDaLista}.` })
  }
  for (const r of s.semEbitdaPositivo) {
    if (bate(r.ticker, r.nome)) saida.push({ ticker: r.ticker, nome: r.nome, tipo: 'semEbitda', texto: 'Tem dívida líquida e EBITDA zero ou negativo: a razão não existe e ela está na lista à parte, fora da ordem.' })
  }
  for (const e of s.exclusoes) {
    if (!dentro.has(e.ticker) && bate(e.ticker, e.nome)) saida.push({ ticker: e.ticker, nome: e.nome, tipo: 'excluida', texto: e.motivo })
  }
  return saida.slice(0, 8)
}

/** Conta as exclusões por motivo, do mais frequente para o menos; desempata pelo rótulo. */
export function contarExclusoesEndividadas(exclusoes: ExclusaoEndividada[]): { codigo: string; rotulo: string; total: number }[] {
  const mapa = new Map<string, number>()
  for (const e of exclusoes) mapa.set(e.codigo, (mapa.get(e.codigo) ?? 0) + 1)
  return [...mapa.entries()]
    .map(([codigo, total]) => ({ codigo, rotulo: ROTULO_EXCLUSAO_ENDIVIDADA[codigo] ?? codigo, total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
