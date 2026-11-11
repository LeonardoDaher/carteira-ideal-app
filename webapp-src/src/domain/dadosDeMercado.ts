/**
 * Aba "Dados de mercado" do Simule Ações: fluxo de investidor estrangeiro e posição de aluguel (empréstimo) de ações.
 * Só funções puras e tipos; os arquivos são lidos pela tela (`useArquivoDados`).
 */

/** Um pregão do fluxo de investimento na B3, em R$ milhões (positivo = entrada, negativo = saída). */
export interface RegistroFluxo {
  data: string // AAAA-MM-DD
  estrangeiro: number
  institucional: number
  pessoaFisica: number
  instFinanceira: number
  outros: number
}

export interface SnapshotFluxo {
  /** Quando o job gerou o arquivo (ISO). */
  geradoEm: string | null
  /** De onde vêm os números (texto mostrado na tela). */
  fonte: string
  /** Do mais antigo para o mais recente. */
  registros: RegistroFluxo[]
}

/** Uma ação no aluguel (empréstimo de ativos) da B3. */
export interface RegistroAluguel {
  ticker: string
  nome?: string
  /** Valor do saldo em aberto, em reais. */
  saldoFinanceiro: number
  /** Variação do saldo em relação ao dia anterior (fração: 0,05 = +5%). */
  variacaoDia?: number | null
  /** Quantidade de ações emprestadas. */
  saldoQuantidade?: number | null
  /** Taxa média anual do aluguel (fração). */
  taxaMedia?: number | null
}

export interface SnapshotAluguel {
  geradoEm: string | null
  dataReferencia: string | null
  fonte: string
  registros: RegistroAluguel[]
}

export type Periodo = 'mes' | 'ano' | '30' | '90'

export const ROTULO_PERIODO: Record<Periodo, string> = { mes: 'No mês', ano: 'No ano', '30': '30 pregões', '90': '90 pregões' }

/** Registros de um período, terminando no último pregão disponível. */
export function recortar(registros: RegistroFluxo[], periodo: Periodo): RegistroFluxo[] {
  const ultimo = registros[registros.length - 1]
  if (!ultimo) return []
  if (periodo === 'mes') return registros.filter((r) => r.data.slice(0, 7) === ultimo.data.slice(0, 7))
  if (periodo === 'ano') return registros.filter((r) => r.data.slice(0, 4) === ultimo.data.slice(0, 4))
  return registros.slice(-Number(periodo))
}

export function somar(registros: RegistroFluxo[], campo: keyof Omit<RegistroFluxo, 'data'> = 'estrangeiro'): number {
  return registros.reduce((s, r) => s + r[campo], 0)
}

/** Média móvel simples: o ponto i usa os últimos `janela` valores; antes de haver janela cheia, devolve null. */
export function mediaMovel(valores: number[], janela: number): (number | null)[] {
  return valores.map((_, i) => {
    if (i + 1 < janela) return null
    let s = 0
    for (let k = i + 1 - janela; k <= i; k++) s += valores[k]
    return s / janela
  })
}

/** Quantos pregões seguidos, até o último, o saldo teve o mesmo sinal (positivo conta como entrada). */
export function sequenciaAtual(registros: RegistroFluxo[]): { dias: number; entrada: boolean } | null {
  const ultimo = registros[registros.length - 1]
  if (!ultimo || ultimo.estrangeiro === 0) return null
  const entrada = ultimo.estrangeiro > 0
  let dias = 0
  for (let i = registros.length - 1; i >= 0 && registros[i].estrangeiro > 0 === entrada && registros[i].estrangeiro !== 0; i--) dias++
  return { dias, entrada }
}

/** "−R$ 1,7 bi", "R$ 85,9 mi": valor em milhões de reais, com sinal explícito para saída. */
export function formatarMilhoes(valorEmMilhoes: number, comSinal = true): string {
  const abs = Math.abs(valorEmMilhoes)
  const texto = abs >= 1000 ? `${(abs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi` : `${abs.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
  const sinal = valorEmMilhoes < 0 ? '−' : comSinal && valorEmMilhoes > 0 ? '+' : ''
  return `${sinal}R$ ${texto}`
}

/** "R$ 4,2 bi", "R$ 850 mi": valor em reais (saldo do aluguel). */
export function formatarReaisCurto(valor: number): string {
  if (valor >= 1e9) return `R$ ${(valor / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`
  if (valor >= 1e6) return `R$ ${(valor / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: valor >= 1e7 ? 0 : 1 })} mi`
  return `R$ ${Math.round(valor / 1000).toLocaleString('pt-BR')} mil`
}

/** As ações com maior saldo alugado, em ordem decrescente (empates por código). */
export function maisAlugadas(registros: RegistroAluguel[], quantas = 15): RegistroAluguel[] {
  return [...registros]
    .filter((r) => Number.isFinite(r.saldoFinanceiro) && r.saldoFinanceiro > 0)
    .sort((a, b) => b.saldoFinanceiro - a.saldoFinanceiro || a.ticker.localeCompare(b.ticker))
    .slice(0, quantas)
}

/** Quanto cada ação pesa no saldo total listado (fração). Usa o total de todos os registros, não só os mostrados. */
export function pesoNoTotal(registros: RegistroAluguel[]): Map<string, number> {
  const total = registros.reduce((s, r) => s + (r.saldoFinanceiro > 0 ? r.saldoFinanceiro : 0), 0)
  return new Map(registros.map((r) => [r.ticker, total > 0 ? Math.max(0, r.saldoFinanceiro) / total : 0]))
}

/** Dia AAAA-MM-DD em dd/mm/aaaa. */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
