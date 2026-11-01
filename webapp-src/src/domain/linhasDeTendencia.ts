// Linhas de tendência (D134): LTA (reta ligando fundos ascendentes) e LTB (reta ligando topos descendentes), com a linha de retorno
// paralela do canal. Funções puras sobre as barras do app. Usa só pivôs já confirmados (k candles de cada lado), então nada aqui
// olha o futuro. Os limiares marcados como "provisório" são ponto de partida (docs/17). A reta é uma leitura geométrica que depende
// da escolha dos pivôs: descreve onde o preço esteve, não prevê onde irá.

import type { Barra, Pivo } from './analiseTecnica'
import { pivos } from './analiseTecnica'

export interface LinhaDeTendencia {
  tipo: 'LTA' | 'LTB'
  /** Índices e datas dos dois pivôs que definem a reta. */
  i1: number
  i2: number
  d1: string
  d2: string
  p1: number
  p2: number
  /** Variação do preço da reta por candle. */
  inclinacao: number
  /** Valor da reta no último candle. */
  valorAtual: number
  /** Distância do fechamento atual à reta, em % da reta (positivo = acima). */
  distanciaPct: number
  /** Pivôs que encostaram na reta (inclui os dois que a definem). */
  toques: number
  /** Deslocamento da linha de retorno paralela (acima da LTA, abaixo da LTB), em preço. */
  deslocamentoRetorno: number
  /** Primeiro fechamento além da reta depois do segundo pivô, se houve. */
  rompida: { indice: number; data: string } | null
  explicacao: string
}

export interface OpcoesDeLinha {
  /** Candles de cada lado para confirmar um pivô (provisório: 5). */
  janelaPivo: number
  /** Distância mínima entre os dois pivôs que definem a reta (provisório: 10). */
  separacaoMinima: number
  /** Quanto para trás se procura o primeiro pivô (provisório: 250). */
  alcance: number
  /** Folga dos extremos entre os dois pivôs em relação à reta, fração (provisório: 0,5%). */
  tolerancia: number
  /** Distância máxima de um pivô à reta para contar como toque, fração (provisório: 0,6%). */
  toleranciaToque: number
  /** Fechamento além da reta, fração, para dar a linha como rompida (provisório: 1%). */
  folgaRompimento: number
  /** Linha rompida há mais de tantos candles é descartada (provisório: 20). */
  validadeDaRuptura: number
}

export const OPCOES_DE_LINHA: OpcoesDeLinha = { janelaPivo: 5, separacaoMinima: 10, alcance: 250, tolerancia: 0.005, toleranciaToque: 0.006, folgaRompimento: 0.01, validadeDaRuptura: 20 }

export const valorDaLinha = (l: Pick<LinhaDeTendencia, 'i1' | 'p1' | 'inclinacao'>, indice: number) => l.p1 + l.inclinacao * (indice - l.i1)

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`

function melhorLinha(barras: Barra[], tipo: 'LTA' | 'LTB', o: OpcoesDeLinha): LinhaDeTendencia | null {
  const n = barras.length
  const { altos, baixos } = pivos(barras, o.janelaPivo)
  const lista: Pivo[] = tipo === 'LTA' ? baixos : altos
  const oposto: Pivo[] = tipo === 'LTA' ? altos : baixos
  const dir = tipo === 'LTA' ? 1 : -1
  // Preço do pivô na direção da reta: fundos usam a mínima, topos a máxima.
  const extremo = (j: number) => (tipo === 'LTA' ? barras[j].min : barras[j].max)

  // Segundo pivô: um dos 4 mais recentes. Vale o mais recente que tenha reta válida.
  for (let bi = lista.length - 1; bi >= Math.max(0, lista.length - 4); bi--) {
    const b = lista[bi]
    let melhor: { a: Pivo; toques: number; inclinacao: number } | null = null
    for (let ai = bi - 1; ai >= 0; ai--) {
      const a = lista[ai]
      if (b.i - a.i > o.alcance) break
      if (b.i - a.i < o.separacaoMinima) continue
      if ((b.preco - a.preco) * dir <= 0) continue
      const inclinacao = (b.preco - a.preco) / (b.i - a.i)
      const reta = (j: number) => a.preco + inclinacao * (j - a.i)
      let valida = true
      for (let j = a.i; j <= b.i; j++) {
        // fundos não podem furar a reta por mais que a tolerância (nem topos, na LTB)
        if ((extremo(j) - reta(j)) * dir < -o.tolerancia * reta(j)) {
          valida = false
          break
        }
      }
      if (!valida) continue
      let toques = 2
      for (const p of lista) if (p.i > a.i && p.i !== b.i && Math.abs(p.preco - reta(p.i)) <= o.toleranciaToque * reta(p.i)) toques++
      if (!melhor || toques > melhor.toques || (toques === melhor.toques && b.i - a.i > b.i - melhor.a.i)) melhor = { a, toques, inclinacao }
    }
    if (!melhor) continue
    const { a, toques, inclinacao } = melhor
    const reta = (j: number) => a.preco + inclinacao * (j - a.i)
    let rompida: LinhaDeTendencia['rompida'] = null
    for (let j = b.i + 1; j < n; j++) {
      if ((barras[j].fech - reta(j)) * dir < -o.folgaRompimento * reta(j)) {
        rompida = { indice: j, data: barras[j].data }
        break
      }
    }
    if (rompida && n - 1 - rompida.indice > o.validadeDaRuptura) continue
    // Linha de retorno: paralela passando pelo pivô oposto mais afastado entre os dois pontos e agora.
    let desloc = 0
    for (const p of oposto) if (p.i >= a.i) if (Math.abs(p.preco - reta(p.i)) > Math.abs(desloc) && (p.preco - reta(p.i)) * dir > 0) desloc = p.preco - reta(p.i)
    const valorAtual = reta(n - 1)
    const distanciaPct = ((barras[n - 1].fech - valorAtual) / valorAtual) * 100
    const nome = tipo === 'LTA' ? 'fundos' : 'topos'
    const posicao = rompida ? `rompida em ${dataCurta(rompida.data)}` : `preço ${Math.abs(distanciaPct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ${distanciaPct >= 0 ? 'acima' : 'abaixo'} da reta`
    return {
      tipo,
      i1: a.i,
      i2: b.i,
      d1: barras[a.i].data,
      d2: barras[b.i].data,
      p1: a.preco,
      p2: b.preco,
      inclinacao,
      valorAtual,
      distanciaPct,
      toques,
      deslocamentoRetorno: desloc,
      rompida,
      explicacao: `${tipo} ligando os ${nome} de ${dataCurta(barras[a.i].data)} (${brl(a.preco)}) e ${dataCurta(barras[b.i].data)} (${brl(b.preco)}), ${toques} toques; vale ${brl(valorAtual)} no último candle, ${posicao}`,
    }
  }
  return null
}

/** LTA e LTB vigentes nos candles dados (cada uma pode não existir). Precisa de pelo menos 40 candles. */
export function linhasDeTendencia(barras: Barra[], opcoes: Partial<OpcoesDeLinha> = {}): LinhaDeTendencia[] {
  if (barras.length < 40) return []
  const o = { ...OPCOES_DE_LINHA, ...opcoes }
  return (['LTA', 'LTB'] as const).map((t) => melhorLinha(barras, t, o)).filter((l): l is LinhaDeTendencia => l !== null)
}
