// Minha Carteira (D40): ATIVO DIGITADO À MÃO. É uma POSIÇÃO ("tenho 1.600 BBAS3 a R$ 19,50 de preço médio"),
// e não uma compra datada. Antes, quem digitava a posição inteira via o app gravá-la como "Compra, hoje",
// o que é falso e ainda se somava às compras reais do histórico.
//
// Serve para o que a B3 não traz nos extratos: CDB, LCI, previdência, fundos fora da bolsa, investimentos no
// exterior, ou uma posição de quem não quer importar nada. A pessoa informa quantidade, preço médio, o valor
// atual (opcional) e a CLASSE do ativo, que é o que alimenta a comparação com a carteira sugerida.
import { normalizarBusca } from './rendaFii'
import type { ClasseCarteira } from './classificadorAtivo'
import type { CategoriaPosicao } from './importacao/planilha'
import { tipoPorId } from './tiposInvestimento'

export interface AtivoManual {
  /** Chave única, em maiúsculas e sem acento (como os tickers). */
  ativo: string
  /** Nome como a pessoa digitou. */
  nome: string
  quantidade: number
  precoMedio: number
  /** Valor atual TOTAL do ativo. null = não informado (usa o custo, sem resultado). */
  valorAtual: number | null
  classe: ClasseCarteira
  /** Tipo escolhido na lista "Adicionar posição" (id de tiposInvestimento). Ativos antigos não têm. */
  tipo?: string
  /** Vencimento (AAAA-MM-DD), opcional: renda fixa e COE. */
  vencimento?: string
  /** Taxa em texto livre ("110% do CDI", "IPCA + 6,2% a.a."), opcional. */
  taxa?: string
}

export const chaveDoAtivoManual = (nome: string): string => normalizarBusca(nome).replace(/\s+/g, ' ').trim()

/** Em qual bloco de "Posições" cada classe aparece (os blocos são os mesmos da Área do Investidor da B3). */
export function categoriaDaClasse(classe: ClasseCarteira): CategoriaPosicao {
  switch (classe) {
    case 'acoesETFs':
      return 'acoes'
    case 'fiis':
      return 'fundos'
    case 'bdrs':
      return 'bdr'
    case 'fundosInternacionais':
      return 'etf'
    case 'tesouroSelic':
    case 'tesouroIPCA':
    case 'tesouroPrefixado':
      return 'tesouro'
    case 'cdbLiquidez':
    case 'lciLca':
      return 'rendaFixa'
    case 'ouro':
      return 'ouro'
    case 'cripto':
      return 'cripto'
    default:
      return 'outra'
  }
}

/** Bloco de Posições de um ativo digitado: o do tipo escolhido na lista ou, nos antigos, o da classe. */
export function categoriaDoManual(m: Pick<AtivoManual, 'classe' | 'tipo'>): CategoriaPosicao {
  const t = tipoPorId(m.tipo)
  // "Outro investimento" não define bloco: segue a classe que a pessoa escolheu.
  return t && t.classe !== null ? t.categoria : categoriaDaClasse(m.classe)
}

/** Mensagem do que está errado, ou null se o ativo é válido. */
export const TAXA_MAX = 60

/** AAAA-MM-DD que existe no calendário. */
export function ehDataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
}

export function validarAtivoManual(m: { nome: string; quantidade: number; precoMedio: number; valorAtual: number | null; vencimento?: string; taxa?: string }): string | null {
  if (!chaveDoAtivoManual(m.nome)) return 'Informe o nome do ativo (ex.: PETR4, CDB Banco X, Tesouro Selic 2029).'
  if (!(m.quantidade > 0) || !Number.isFinite(m.quantidade)) return 'Informe a quantidade (maior que zero).'
  if (!(m.precoMedio > 0) || !Number.isFinite(m.precoMedio)) return 'Informe o preço médio (maior que zero).'
  if (m.valorAtual !== null && (!(m.valorAtual > 0) || !Number.isFinite(m.valorAtual))) return 'O valor atual, se informado, deve ser maior que zero.'
  if (m.vencimento !== undefined && !ehDataValida(m.vencimento)) return 'Confira a data de vencimento.'
  if (m.taxa !== undefined && m.taxa.length > TAXA_MAX) return `A taxa pode ter até ${TAXA_MAX} caracteres.`
  return null
}
