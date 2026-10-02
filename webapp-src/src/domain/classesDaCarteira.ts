// Minha Carteira (D36): leva os ativos da pessoa para as classes da carteira sugerida, para a
// comparação "o que eu tenho x o que é sugerido". Funções puras.
//
// Regra de ouro: NUNCA classificar em silêncio o que é duvidoso. Cada ativo sai com a classe, a
// confiança e o motivo; o que o app não sabe classificar fica de fora da comparação e a tela pede
// para a pessoa escolher. Uma classe errada distorceria todo o resultado.
import { classificarAtivo, precisaConfirmar, type CatalogoAtivos, type ClasseCarteira } from './classificadorAtivo'
import type { LinhaPosicao } from './painelCarteira'
import type { AtivoKey } from './types'
import { tipoPorId } from './tiposInvestimento'

/** Rótulos para a escolha da classe (distintos dos de exibição: lá o Tesouro aparece agrupado). */
export const ROTULO_CLASSE: Record<ClasseCarteira, string> = {
  tesouroSelic: 'Tesouro Selic',
  tesouroIPCA: 'Tesouro IPCA+',
  tesouroPrefixado: 'Tesouro Prefixado',
  cdbLiquidez: 'CDB com liquidez diária',
  lciLca: 'LCI / LCA',
  ouro: 'Ouro',
  fiis: 'Fundos imobiliários (FIIs)',
  acoesETFs: 'Ações e ETFs de ações',
  bdrs: 'BDRs',
  fundosInternacionais: 'Fundos internacionais / ETFs',
  cripto: 'Criptomoedas',
  foraDaRegua: 'Outro (não existe na carteira sugerida)',
}

export const CLASSES_ESCOLHA: ClasseCarteira[] = [
  'tesouroSelic', 'tesouroIPCA', 'tesouroPrefixado', 'cdbLiquidez', 'lciLca', 'ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto', 'foraDaRegua',
]

export function ehClasseValida(x: unknown): x is ClasseCarteira {
  return typeof x === 'string' && (CLASSES_ESCOLHA as string[]).includes(x)
}

export type OrigemClasse = 'pessoa' | 'posicao' | 'automatica'

export interface AtivoClassificado {
  ativo: string
  /** Valor usado na comparação: valor atual (Posição) ou, sem ela, o custo. */
  valor: number
  /** null = não foi possível deduzir: fica de fora da comparação até a pessoa escolher. */
  classe: ClasseCarteira | null
  origem: OrigemClasse
  motivo: string
  /** Classe provável mas não certa: entra na conta e pede conferência. */
  precisaConfirmar: boolean
  alternativas: ClasseCarteira[]
  /** Observação quando o ativo foi alocado numa classe PARECIDA da carteira sugerida (ex.: CRI contado como LCI / LCA). */
  equivalencia?: string
  /** Ativo repartido entre várias classes (fundo multimercado): quanto vai para cada uma. */
  partes?: { classe: ClasseCarteira; valor: number }[]
}

const EPS = 1e-9

/**
 * Classifica as posições. Ordem de prioridade: 1) a escolha da pessoa; 2) a aba da B3 em que o ativo
 * aparece na Posição (uma ação é ação mesmo sendo unit com final 11); 3) o classificador por nome e
 * ticker, com as listas de FIIs, ETFs e BDRs do app.
 */
export function classificarPosicoes(linhas: LinhaPosicao[], catalogo: CatalogoAtivos, escolhas: Readonly<Record<string, ClasseCarteira>>): AtivoClassificado[] {
  const saida: AtivoClassificado[] = []
  for (const l of linhas) {
    const valor = l.valorAtual ?? l.custoTotal ?? 0
    if (!(valor > EPS)) continue

    const escolhida = escolhas[l.ativo]
    if (escolhida) {
      // Equivalência vale enquanto a pessoa não trocou a classe sugerida pelo tipo (se trocou, ela manda).
      const tipo = tipoPorId(l.tipoManual)
      const sugeridaPeloTipo = !!tipo && tipo.classe === escolhida
      const equivalencia = sugeridaPeloTipo ? tipo.equivalencia : undefined
      const partes = sugeridaPeloTipo && tipo.distribuicao ? Object.entries(tipo.distribuicao).map(([classe, peso]) => ({ classe: classe as ClasseCarteira, valor: valor * (peso ?? 0) })) : undefined
      saida.push({ ativo: l.ativo, valor, classe: escolhida, origem: 'pessoa', motivo: equivalencia ?? 'Escolhida por você.', precisaConfirmar: false, alternativas: [], ...(equivalencia ? { equivalencia } : {}), ...(partes ? { partes } : {}) })
      continue
    }

    const c = classificarAtivo(l.ativo, catalogo)
    if (l.categoria === 'acoes') {
      saida.push({ ativo: l.ativo, valor, classe: 'acoesETFs', origem: 'posicao', motivo: 'Está na aba Ações da sua Posição na B3.', precisaConfirmar: false, alternativas: [] })
      continue
    }
    // BDR de ETF (final 39) é, na prática, um ETF de bolsa estrangeira: respeita o classificador.
    if (l.categoria === 'bdr' && c.classe !== 'fundosInternacionais') {
      saida.push({ ativo: l.ativo, valor, classe: 'bdrs', origem: 'posicao', motivo: 'Está na aba BDR da sua Posição na B3.', precisaConfirmar: false, alternativas: [] })
      continue
    }
    saida.push({
      ativo: l.ativo,
      valor,
      classe: c.classe,
      origem: 'automatica',
      motivo: c.motivo,
      precisaConfirmar: precisaConfirmar(c),
      alternativas: c.alternativas,
    })
  }
  return saida.sort((a, b) => b.valor - a.valor)
}

export interface ValoresPorClasse {
  valores: Partial<Record<ClasseCarteira, number>>
  /** Ativos sem classe (ficam de fora) e quanto valem juntos. */
  pendentes: AtivoClassificado[]
  valorPendente: number
}

export function valoresPorClasse(classificados: AtivoClassificado[]): ValoresPorClasse {
  const valores: Partial<Record<ClasseCarteira, number>> = {}
  const pendentes: AtivoClassificado[] = []
  for (const a of classificados) {
    if (a.classe === null) pendentes.push(a)
    else if (a.partes) for (const p of a.partes) valores[p.classe] = (valores[p.classe] ?? 0) + p.valor
    else valores[a.classe] = (valores[a.classe] ?? 0) + a.valor
  }
  return { valores, pendentes, valorPendente: pendentes.reduce((s, p) => s + p.valor, 0) }
}

const TESOUROS: AtivoKey[] = ['tesouroSelic', 'tesouroIPCA', 'tesouroPrefixado']

/** Em qual linha da comparação a classe aparece (os três Tesouros dividem a linha "Tesouro Direto", sob a chave tesouroIPCA). */
export const classeNaComparacao = (c: ClasseCarteira): ClasseCarteira => ((TESOUROS as ClasseCarteira[]).includes(c) ? 'tesouroIPCA' : c)

/** Observações por linha da comparação: o que foi contado ali por EQUIVALÊNCIA (ex.: CRI na linha LCI / LCA), agrupado pelo texto. */
export interface ObservacaoDaClasse {
  texto: string
  ativos: { ativo: string; valor: number }[]
}
export function observacoesPorClasse(classificados: AtivoClassificado[]): Partial<Record<ClasseCarteira, ObservacaoDaClasse[]>> {
  const saida: Partial<Record<ClasseCarteira, ObservacaoDaClasse[]>> = {}
  for (const a of classificados) {
    if (!a.equivalencia || a.classe === null) continue
    for (const d of a.partes ?? [{ classe: a.classe, valor: a.valor }]) {
      const linha = classeNaComparacao(d.classe)
      const lista = (saida[linha] ??= [])
      const grupo = lista.find((o) => o.texto === a.equivalencia)
      if (grupo) grupo.ativos.push({ ativo: a.ativo, valor: d.valor })
      else lista.push({ texto: a.equivalencia, ativos: [{ ativo: a.ativo, valor: d.valor }] })
    }
  }
  return saida
}

/**
 * Soma Tesouro Selic, IPCA+ e Prefixado numa fatia só ("Tesouro Direto", sob a chave tesouroIPCA),
 * como a tela Carteira já mostra a carteira sugerida. Sem isso, a pessoa veria 40% de Tesouro numa
 * tela e 3 números diferentes na comparação.
 */
export function agruparTesouroDireto(valores: Partial<Record<ClasseCarteira, number>>): Partial<Record<ClasseCarteira, number>> {
  const soma = TESOUROS.reduce((s, k) => s + (valores[k] ?? 0), 0)
  if (soma <= 0) return valores
  const saida = { ...valores }
  for (const k of TESOUROS) delete saida[k]
  saida.tesouroIPCA = soma
  return saida
}
