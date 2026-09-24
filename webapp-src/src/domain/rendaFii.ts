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
  /** Rendimentos do mais recente para o mais antigo (até 3). */
  rendimentos: RendimentoMensal[]
}

/** Formato do arquivo gerado todo mês por scripts/atualizar-rendimentos-fii.mjs. */
export interface SnapshotRendimentosFii {
  /** Momento em que o job mensal gerou o arquivo (ISO 8601). `null` = nunca rodou. */
  geradoEm: string | null
  /** Período de vigência da carteira teórica do IFIX usada para escolher os fundos. */
  vigenciaIfix: string | null
  fundos: FundoFii[]
}

export type BaseCalculo = 'ultimo' | 'media3'

export const QUANTIDADES_PADRAO = [10, 50, 100, 500, 1000, 5000] as const

export function ultimoRendimento(fundo: FundoFii): RendimentoMensal | null {
  return fundo.rendimentos[0] ?? null
}

/** Média dos últimos `n` rendimentos disponíveis (usa menos meses se não houver `n`). */
export function mediaRendimentos(fundo: FundoFii, n = 3): number | null {
  const considerados = fundo.rendimentos.slice(0, n)
  if (considerados.length === 0) return null
  const soma = considerados.reduce((total, r) => total + r.valorPorCota, 0)
  return soma / considerados.length
}

export function rendimentoBase(fundo: FundoFii, base: BaseCalculo): number | null {
  if (base === 'media3') return mediaRendimentos(fundo, 3)
  return ultimoRendimento(fundo)?.valorPorCota ?? null
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
