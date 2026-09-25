// Cálculos da aba "Simule FII" (renda estimada com fundos imobiliários).
//
// Diferente do motor de alocação (engine.ts), nada aqui é metodologia proprietária: são
// contas aritméticas simples sobre dados públicos (Informe Mensal da CVM + cotação da B3).
// Por isso este arquivo pode ser empacotado no app sem problema, e fica separado da tela
// para ser testado sem renderizar nada.

/** Rendimento de um mês de competência, em R$ por cota. */
export interface RendimentoMensal {
  /** Mês de competência do Informe Mensal da CVM, no formato AAAA-MM. */
  competencia: string
  valorPorCota: number
}

export interface FundoFii {
  ticker: string
  nome: string
  /** Última cotação obtida na atualização mensal (R$). `null` se a cotação falhou. */
  cotacao: number | null
  /** Data da cotação, no formato AAAA-MM-DD. */
  dataCotacao: string | null
  /**
   * Rendimento publicado pelo job mensal: um único mês, o mais recente considerado típico
   * (ver escolherRendimento em scripts/atualizar-rendimentos-fii.mjs). É um array para o
   * formato aceitar mais meses no futuro; a tela usa sempre o primeiro.
   */
  rendimentos: RendimentoMensal[]
  /**
   * Presente quando a estimativa merece menos confiança (decisão D12). O fundo é exibido,
   * mas com aviso. Ver avaliarConfianca em scripts/atualizar-rendimentos-fii.mjs.
   */
  confianca?: 'baixa'
  motivosConfianca?: MotivoConfianca[]
}

export type MotivoConfianca = 'poucos-meses' | 'rendimento-variavel' | 'mes-antigo' | 'valor-repetido' | 'pouca-negociacao'

export type MotivoIndisponivel = 'sem-informe-recente' | 'cadastro-ambiguo' | 'rendimento-atipico' | 'sem-rendimento' | 'sem-cotacao' | 'fora-da-faixa'

/** Fundo conhecido pelo job, mas sem dado publicável neste mês (e o porquê). */
export interface FundoIndisponivel {
  ticker: string
  nome: string
  motivo: MotivoIndisponivel
}

/** Formato do arquivo gerado todo mês por scripts/atualizar-rendimentos-fii.mjs. */
export interface SnapshotRendimentosFii {
  /** Momento em que o job mensal gerou o arquivo (ISO 8601). `null` = nunca rodou. */
  geradoEm: string | null
  /** Período de vigência da carteira teórica do IFIX usada para escolher os fundos. */
  vigenciaIfix: string | null
  /** Tickers exibidos como atalho (os maiores do IFIX), na ordem de participação no índice.
   * Ausente em arquivos anteriores à D12: aí os destaques são os 10 primeiros fundos. */
  destaques?: string[]
  /** Todos os fundos com dado publicável: destaques primeiro, depois do maior patrimônio
   * para o menor. */
  fundos: FundoFii[]
  indisponiveis?: FundoIndisponivel[]
}

export const QUANTIDADES_PADRAO = [10, 50, 100, 500, 1000, 5000] as const

export function ultimoRendimento(fundo: FundoFii): RendimentoMensal | null {
  return fundo.rendimentos[0] ?? null
}

/** Rendimento mensal sobre o preço da cota, em % (ex.: 0,10 / 9,02 → 1,11). */
export function rendimentoMensalPct(valorPorCota: number, cotacao: number): number | null {
  if (!(cotacao > 0)) return null
  return (valorPorCota / cotacao) * 100
}

export interface LinhaSimulacao {
  cotas: number
  /** Quanto custaria comprar essa quantidade de cotas pela cotação exibida (R$). */
  investimento: number | null
  /** Renda mensal estimada com base no rendimento escolhido (R$). */
  rendaMensal: number
}

export function simularCotas(cotas: number, cotacao: number | null, valorPorCota: number): LinhaSimulacao {
  return {
    cotas,
    investimento: cotacao != null && cotacao > 0 ? cotas * cotacao : null,
    rendaMensal: cotas * valorPorCota,
  }
}

export function tabelaSimulacao(
  cotacao: number | null,
  valorPorCota: number,
  quantidades: readonly number[] = QUANTIDADES_PADRAO,
): LinhaSimulacao[] {
  return quantidades.map((q) => simularCotas(q, cotacao, valorPorCota))
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-07" → "jul/2026". Devolve a entrada sem mudança se o formato for inesperado. */
export function formatarCompetencia(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!m) return competencia
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return competencia
  return `${MESES_ABREV[mes - 1]}/${m[1]}`
}

/** "2026-09-19" → "19/09/2026". */
export function formatarData(data: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data
}

/**
 * Quantos meses separam a competência do rendimento exibido do mês de referência (hoje).
 * Usado para deixar explícito o atraso do Informe Mensal da CVM.
 */
export function mesesDeAtraso(competencia: string, hoje: Date): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!m) return null
  const meses = (hoje.getFullYear() - Number(m[1])) * 12 + (hoje.getMonth() + 1 - Number(m[2]))
  return Math.max(0, meses)
}

// ---------------------------------------------------------------------------------------
// Busca livre (decisão D12)
// ---------------------------------------------------------------------------------------

/** Maiúsculas, sem acento e sem espaço sobrando: "  kinéa  rend" → "KINEA REND". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Os fundos exibidos como atalho. Arquivos antigos, sem "destaques", usam os 10 primeiros. */
export function fundosEmDestaque(snapshot: SnapshotRendimentosFii): FundoFii[] {
  if (!snapshot.destaques) return snapshot.fundos.slice(0, 10)
  return snapshot.destaques
    .map((t) => snapshot.fundos.find((f) => f.ticker === t))
    .filter((f): f is FundoFii => f != null)
}

/**
 * Procura por código ou por parte do nome. Ordem: código exato ("HGLG" também acha o
 * HGLG11), depois códigos que começam pelo termo, depois nomes que contêm o termo. Dentro
 * de cada grupo, vale a ordem do arquivo (destaques e depois maior patrimônio).
 */
export function buscarFundos(fundos: FundoFii[], termo: string, limite = 8): FundoFii[] {
  const q = normalizarBusca(termo)
  if (q.length < 2) return []
  const pontuados: { fundo: FundoFii; nota: number; ordem: number }[] = []
  fundos.forEach((fundo, ordem) => {
    const ticker = fundo.ticker.toUpperCase()
    let nota: number | null = null
    if (ticker === q || ticker === `${q}11`) nota = 0
    else if (ticker.startsWith(q)) nota = 1
    else if (normalizarBusca(fundo.nome).includes(q)) nota = 2
    if (nota != null) pontuados.push({ fundo, nota, ordem })
  })
  return pontuados
    .sort((a, b) => a.nota - b.nota || a.ordem - b.ordem)
    .slice(0, limite)
    .map((p) => p.fundo)
}

/** Fundo que o job conhece mas não publicou, procurado pelo código digitado. */
export function acharIndisponivel(snapshot: SnapshotRendimentosFii, termo: string): FundoIndisponivel | null {
  const q = normalizarBusca(termo)
  if (q.length < 4) return null
  return snapshot.indisponiveis?.find((f) => f.ticker === q || f.ticker === `${q}11`) ?? null
}

/**
 * Os nomes do informe da CVM vêm por extenso ("FUNDO DE INVESTIMENTO IMOBILIÁRIO KINEA
 * RENDA IMOBILIÁRIA - RESPONSABILIDADE LIMITADA"). Na lista de resultados, o que distingue
 * um fundo do outro é o miolo.
 */
export function nomeCurto(nome: string): string {
  const curto = nome
    .replace(/^\s*(FUNDO DE INVESTIMENTO IMOBILI[AÁ]RIO|FII)\s*[-–]?\s*(FII\s*[-–]?\s*)?/i, '')
    .replace(/\s*[-–]?\s*(FUNDO DE INVESTIMENTO IMOBILI[AÁ]RIO|FII)\s*$/i, '')
    .replace(/\s*[-–]?\s*RESPONSABILIDADE LIMITADA\s*$/i, '')
    .trim()
  return curto || nome
}

export const TEXTO_MOTIVO_CONFIANCA: Record<MotivoConfianca, string> = {
  'poucos-meses': 'o fundo tem poucos meses de informe à CVM, então não deu para comparar com meses anteriores',
  'rendimento-variavel':
    'o rendimento deste fundo varia bastante de um mês para o outro (comum em fundos atrelados à inflação), então o valor exibido é o do mês mais próximo do meio da faixa dos últimos 6 meses, e a renda real pode ser maior ou menor',
  'mes-antigo':
    'o mês exibido é antigo, porque os meses mais recentes do informe deste fundo variaram demais ou não estão disponíveis, então a renda atual pode ser diferente',
  'valor-repetido': 'o informe repete o mesmo valor há vários meses, o que pode indicar dado copiado de um mês para o outro',
  'pouca-negociacao': 'a cota quase não foi negociada recentemente, então o preço exibido pode estar longe do atual',
}

export const TEXTO_MOTIVO_INDISPONIVEL: Record<MotivoIndisponivel, string> = {
  'sem-informe-recente': 'o fundo não enviou o Informe Mensal à CVM nos últimos meses',
  'cadastro-ambiguo': 'o código do fundo aparece ligado a mais de um cadastro na CVM, e não dá para saber qual é o dele sem conferência manual',
  'rendimento-atipico': 'os valores dos últimos meses variaram demais para indicar um rendimento típico',
  'sem-rendimento': 'o fundo não distribuiu rendimento no mês de referência',
  'sem-cotacao': 'não conseguimos obter a cotação do fundo nesta atualização',
  'fora-da-faixa': 'o rendimento estimado ficou fora de uma faixa plausível diante da cotação, o que indica erro no dado',
}
