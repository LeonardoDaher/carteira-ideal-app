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
    default:
      return 'outra'
  }
}

/** Mensagem do que está errado, ou null se o ativo é válido. */
export function validarAtivoManual(m: { nome: string; quantidade: number; precoMedio: number; valorAtual: number | null }): string | null {
  if (!chaveDoAtivoManual(m.nome)) return 'Informe o nome do ativo (ex.: PETR4, CDB Banco X, Tesouro Selic 2029).'
  if (!(m.quantidade > 0) || !Number.isFinite(m.quantidade)) return 'Informe a quantidade (maior que zero).'
  if (!(m.precoMedio > 0) || !Number.isFinite(m.precoMedio)) return 'Informe o preço médio (maior que zero).'
  if (m.valorAtual !== null && (!(m.valorAtual > 0) || !Number.isFinite(m.valorAtual))) return 'O valor atual, se informado, deve ser maior que zero.'
  return null
}
