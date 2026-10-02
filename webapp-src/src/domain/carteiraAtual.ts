// Minha Carteira (D36): compara a carteira que a pessoa TEM com a carteira de REFERÊNCIA
// que o motor devolveu (ResultadoRecomendacao.carteira, em %).
//
// Módulo puro: sem rede, sem React, sem localStorage. Os dados da pessoa (posições) nunca
// vão para a API — o comparativo roda no navegador usando só a referência já recebida.
//
// Decisões de método (documentar no docs/07 como D36):
// - Todo o patrimônio entra no denominador, inclusive o que está "Fora da régua".
// - O que está fora da régua tem alvo 0%, então pesa contra a aderência. Isso é proposital:
//   a referência não prevê esse ativo. A tela mostra o valor separado para a pessoa entender.
// - Tolerância por classe = o maior entre 2 pp e 20% do alvo, para classes de alvo pequeno
//   (ex.: cripto 3%) não ficarem "fora" por 1 pp de oscilação.
// - Aporte guiado só distribui dinheiro NOVO; nunca manda vender (venda gera IR).
import type { AtivoKey, Carteira } from './types'
import type { ClasseCarteira } from './classificadorAtivo'

/** Ordem de exibição: a mesma dos grupos da referência (docs/02, seção 5.1). */
export const ORDEM_CLASSES: AtivoKey[] = [
  'tesouroSelic',
  'cdbLiquidez',
  'tesouroIPCA',
  'tesouroPrefixado',
  'lciLca',
  'ouro',
  'fiis',
  'acoesETFs',
  'bdrs',
  'fundosInternacionais',
  'cripto',
]

export interface Posicao {
  id: string
  /** Como a pessoa digitou (ticker ou nome). */
  entrada: string
  quantidade: number
  precoMedio: number
  /** Cotação atual, se houver (catálogos do app ou informada à mão). */
  cotacao?: number | null
  /** Classe já confirmada pela pessoa. */
  classe: ClasseCarteira
}

export function valorAtual(p: Posicao): number {
  const preco = p.cotacao != null && p.cotacao > 0 ? p.cotacao : p.precoMedio
  return p.quantidade * preco
}

export function valorInvestido(p: Posicao): number {
  return p.quantidade * p.precoMedio
}

export interface ResumoPosicoes {
  patrimonio: number
  investido: number
  lucro: number
  /** null quando não há nada investido. */
  rentabilidadePct: number | null
  /** Posições avaliadas pelo preço médio por falta de cotação. */
  semCotacao: string[]
}

export function resumirPosicoes(posicoes: Posicao[]): ResumoPosicoes {
  let patrimonio = 0
  let investido = 0
  const semCotacao: string[] = []
  for (const p of posicoes) {
    patrimonio += valorAtual(p)
    investido += valorInvestido(p)
    if (!(p.cotacao != null && p.cotacao > 0)) semCotacao.push(p.entrada)
  }
  const lucro = patrimonio - investido
  return { patrimonio, investido, lucro, rentabilidadePct: investido > 0 ? (lucro / investido) * 100 : null, semCotacao }
}

export function valoresPorClasse(posicoes: Posicao[]): Partial<Record<ClasseCarteira, number>> {
  const out: Partial<Record<ClasseCarteira, number>> = {}
  for (const p of posicoes) out[p.classe] = (out[p.classe] ?? 0) + valorAtual(p)
  return out
}

export type Situacao = 'dentro' | 'abaixo' | 'acima'

export interface LinhaClasse {
  classe: ClasseCarteira
  valor: number
  pctAtual: number
  pctReferencia: number
  /** pctAtual − pctReferencia, em pontos percentuais. Negativo = falta. */
  difPp: number
  /** Quanto sobra (+) ou falta (−) em reais para chegar na referência. */
  difReais: number
  /** Tolerância em pp usada para classificar a situação. */
  tolerancia: number
  situacao: Situacao
}

export interface Comparativo {
  patrimonio: number
  linhas: LinhaClasse[]
  /** 0 a 100; 100 = carteira idêntica à referência. null sem patrimônio. */
  aderencia: number | null
  /** % do patrimônio em ativos sem classe na régua. */
  foraDaReguaPct: number
}

export function toleranciaPp(pctReferencia: number): number {
  return Math.max(2, pctReferencia * 0.2)
}

/** Referência normalizada para somar 100 (defesa contra arredondamento). */
export function referenciaNormalizada(referencia: Carteira): Partial<Record<AtivoKey, number>> {
  const soma = ORDEM_CLASSES.reduce((s, k) => s + (referencia[k] ?? 0), 0)
  const out: Partial<Record<AtivoKey, number>> = {}
  if (soma <= 0) return out
  for (const k of ORDEM_CLASSES) if (referencia[k]) out[k] = ((referencia[k] ?? 0) * 100) / soma
  return out
}

export function compararComReferencia(
  valores: Partial<Record<ClasseCarteira, number>>,
  referencia: Carteira,
): Comparativo {
  const patrimonio = Object.values(valores).reduce<number>((s, v) => s + (v ?? 0), 0)
  const ref = referenciaNormalizada(referencia)
  const classes: ClasseCarteira[] = [...ORDEM_CLASSES, 'foraDaRegua']

  const linhas: LinhaClasse[] = []
  let somaAbsDif = 0
  for (const classe of classes) {
    const valor = valores[classe] ?? 0
    const pctReferencia = classe === 'foraDaRegua' ? 0 : (ref[classe] ?? 0)
    if (valor <= 0 && pctReferencia <= 0) continue
    const pctAtual = patrimonio > 0 ? (valor / patrimonio) * 100 : 0
    const difPp = pctAtual - pctReferencia
    const tolerancia = toleranciaPp(pctReferencia)
    const situacao: Situacao = Math.abs(difPp) <= tolerancia ? 'dentro' : difPp > 0 ? 'acima' : 'abaixo'
    linhas.push({
      classe,
      valor,
      pctAtual,
      pctReferencia,
      difPp,
      difReais: valor - (pctReferencia / 100) * patrimonio,
      tolerancia,
      situacao,
    })
    somaAbsDif += Math.abs(difPp)
  }

  const foraDaReguaPct = patrimonio > 0 ? ((valores.foraDaRegua ?? 0) / patrimonio) * 100 : 0
  return {
    patrimonio,
    linhas,
    aderencia: patrimonio > 0 ? Math.max(0, 100 - somaAbsDif / 2) : null,
    foraDaReguaPct,
  }
}

export interface AlocacaoAporte {
  classe: AtivoKey
  valor: number
}

/**
 * Distribui um aporte entre as classes que estão abaixo do alvo, sem vender nada.
 * Parte do patrimônio DEPOIS do aporte: cada classe tem direito a (alvo% × novo total); a
 * parte que já tem é descontada e só o que falta recebe dinheiro, em proporção à falta.
 * Trabalha em centavos (inteiros) e usa maiores restos para a soma fechar exata.
 */
export function distribuirAporte(
  valores: Partial<Record<ClasseCarteira, number>>,
  referencia: Carteira,
  aporte: number,
): AlocacaoAporte[] {
  const aporteC = Math.round(aporte * 100)
  if (!(aporteC > 0)) return []
  const ref = referenciaNormalizada(referencia)
  const totalAtual = Object.values(valores).reduce<number>((s, v) => s + (v ?? 0), 0)
  const totalNovo = totalAtual + aporteC / 100

  const faltas: { classe: AtivoKey; falta: number }[] = []
  for (const classe of ORDEM_CLASSES) {
    const alvo = ref[classe] ?? 0
    if (alvo <= 0) continue
    const falta = Math.max(0, (alvo / 100) * totalNovo - (valores[classe] ?? 0))
    if (falta > 0) faltas.push({ classe, falta })
  }
  const somaFaltas = faltas.reduce((s, f) => s + f.falta, 0)
  if (somaFaltas <= 0) return []

  const brutos = faltas.map((f) => ({ classe: f.classe, c: (aporteC * f.falta) / somaFaltas }))
  const pisos = brutos.map((b) => ({ classe: b.classe, c: Math.floor(b.c), resto: b.c - Math.floor(b.c) }))
  let sobra = aporteC - pisos.reduce((s, p) => s + p.c, 0)
  for (const p of [...pisos].sort((a, b) => b.resto - a.resto)) {
    if (sobra <= 0) break
    p.c += 1
    sobra -= 1
  }
  return pisos
    .filter((p) => p.c > 0)
    .sort((a, b) => b.c - a.c)
    .map((p) => ({ classe: p.classe, valor: p.c / 100 }))
}
