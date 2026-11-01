// Indicadores e níveis do gráfico de preço da análise técnica (D121): bandas de Bollinger, abertura da semana, gaps abertos,
// média de 200 semanas e caixa da base. Funções puras, sem rede nem relógio, sobre as barras do app (com ou sem abertura real).
// Os limiares marcados como "provisório" são ponto de partida e devem ser calibrados com o histórico de 5 anos
// (docs/17-criterios-analise-grafica-farol.md). Nada aqui é recomendação: descreve o que o preço fez.

import type { Barra } from './analiseTecnica'
import { agregar } from './analiseTecnica'
import { mediaMovel } from './futuros'

export interface Bandas {
  meio: (number | null)[]
  superior: (number | null)[]
  inferior: (number | null)[]
}

/** Bandas de Bollinger: média simples de `periodo` e `desvios` desvios-padrão (populacional) acima e abaixo. */
export function bollinger(fech: number[], periodo = 21, desvios = 2): Bandas {
  const meio = mediaMovel(fech, periodo)
  const superior: (number | null)[] = []
  const inferior: (number | null)[] = []
  fech.forEach((_, i) => {
    const m = meio[i]
    if (m === null || i < periodo - 1) {
      superior.push(null)
      inferior.push(null)
      return
    }
    let soma = 0
    for (let j = i - periodo + 1; j <= i; j++) soma += (fech[j] - m) ** 2
    const dp = Math.sqrt(soma / periodo)
    superior.push(m + desvios * dp)
    inferior.push(m - desvios * dp)
  })
  return { meio, superior, inferior }
}

/** Largura relativa das bandas, (superior - inferior) / meio, em cada ponto. */
export function larguraDasBandas(b: Bandas): (number | null)[] {
  return b.meio.map((m, i) => (m === null || b.superior[i] === null || b.inferior[i] === null || m === 0 ? null : ((b.superior[i] as number) - (b.inferior[i] as number)) / m))
}

/**
 * Situação das bandas no último ponto, comparando a largura atual com as `janela` anteriores: "estreitas" (largura no quinto
 * mais baixo da janela, provisório), "abrindo" (largura subiu pelo menos 15% em 3 pontos) ou "normais".
 */
export function regimeDasBandas(b: Bandas, janela = 120): 'estreitas' | 'abrindo' | 'normais' | null {
  const l = larguraDasBandas(b)
  const validas = l.filter((v): v is number => v !== null)
  const atual = l[l.length - 1]
  if (atual === null || validas.length < 30) return null
  const recentes = validas.slice(-janela)
  const abaixo = recentes.filter((v) => v < atual).length / recentes.length
  const antes = l[l.length - 4]
  if (antes !== null && antes !== undefined && atual > antes * 1.15) return 'abrindo'
  return abaixo <= 0.2 ? 'estreitas' : 'normais'
}

function chaveDaSemana(data: string) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export interface NivelDePreco {
  /** Identificador estável (para chave de lista e testes). */
  chave: string
  preco: number
  /** Texto curto com a origem, no estilo "abertura da semana de 26/10". */
  rotulo: string
}

/** Abertura do primeiro pregão da semana do último candle. Sem abertura real, usa o fechamento anterior (aproximação). */
export function aberturaDaSemana(barras: Barra[]): (NivelDePreco & { real: boolean; data: string }) | null {
  if (barras.length < 2) return null
  const ultima = barras[barras.length - 1]
  const semana = chaveDaSemana(ultima.data)
  let i = barras.length - 1
  while (i > 0 && chaveDaSemana(barras[i - 1].data) === semana) i--
  const primeira = barras[i]
  const real = primeira.abe !== undefined
  const preco = primeira.abe ?? (i > 0 ? barras[i - 1].fech : primeira.fech)
  return { chave: 'abertura-semana', preco, rotulo: `abertura da semana de ${primeira.data.slice(8, 10)}/${primeira.data.slice(5, 7)}`, real, data: primeira.data }
}

export interface GapAberto {
  data: string
  tipo: 'alta' | 'baixa'
  /** Limites do espaço ainda não preenchido (inferior < superior). */
  inferior: number
  superior: number
  /** Ponto médio do gap original (a "regra dos 50%"). */
  meio: number
  /** Parte do gap original já preenchida, de 0 a 1. */
  preenchido: number
}

/**
 * Gaps de preço ainda abertos: espaço vazio entre a máxima de um dia e a mínima do seguinte (alta) ou o contrário (baixa), maior que
 * `minimoPct` do preço (provisório: 0,8%). Um gap deixa de existir quando algum pregão posterior cruza a borda de onde ele partiu;
 * antes disso, o espaço restante encolhe conforme o preço entra nele. Devolve os `maximo` mais recentes.
 */
export function gapsAbertos(barras: Barra[], minimoPct = 0.8, maximo = 3): GapAberto[] {
  const saida: GapAberto[] = []
  for (let i = barras.length - 1; i >= 1 && saida.length < maximo; i--) {
    const ant = barras[i - 1]
    const b = barras[i]
    const depois = barras.slice(i + 1)
    if (b.min > ant.max) {
      const original = b.min - ant.max
      const piso = depois.length ? Math.min(...depois.map((x) => x.min)) : Infinity
      if (piso <= ant.max) continue
      const topo = Math.min(b.min, piso)
      if ((topo - ant.max) / ant.max < minimoPct / 100) continue
      saida.push({ data: b.data, tipo: 'alta', inferior: ant.max, superior: topo, meio: ant.max + original / 2, preenchido: 1 - (topo - ant.max) / original })
    } else if (b.max < ant.min) {
      const original = ant.min - b.max
      const teto = depois.length ? Math.max(...depois.map((x) => x.max)) : -Infinity
      if (teto >= ant.min) continue
      const base = Math.max(b.max, teto)
      if ((ant.min - base) / ant.min < minimoPct / 100) continue
      saida.push({ data: b.data, tipo: 'baixa', inferior: base, superior: ant.min, meio: b.max + original / 2, preenchido: 1 - (ant.min - base) / original })
    }
  }
  return saida
}

/** Média simples de 200 semanas (fechamento semanal) no último ponto, ou null se não há 200 semanas de histórico. */
export function mediaDe200Semanas(barras: Barra[]): { preco: number; data: string; semanas: number } | null {
  const semanal = agregar(barras, 'semana')
  if (semanal.length < 200) return null
  const m = mediaMovel(semanal.map((s) => s.fech), 200)
  const ultimo = m[m.length - 1]
  return ultimo === null ? null : { preco: ultimo, data: semanal[semanal.length - 1].data, semanas: semanal.length }
}

export interface CaixaDaBase {
  inicio: string
  fim: string
  indiceInicio: number
  indiceFim: number
  topo: number
  fundo: number
  candles: number
  /** O último candle fechou fora da caixa (acima ou abaixo, com 0,3% de folga). */
  rompeu: 'acima' | 'abaixo' | null
}

/**
 * Base de consolidação: a janela mais longa (de `minimoCandles` a `maximoCandles`) terminando no último candle, ou até 2 antes
 * dele (para enxergar a base quando o último candle já a rompeu), em que a amplitude (máxima menos mínima, sobre a mínima)
 * fica até `amplitudeMaxPct` (provisório: 12 candles e 12%). null se não há base.
 */
export function caixaDaBase(barras: Barra[], minimoCandles = 12, maximoCandles = 80, amplitudeMaxPct = 12): CaixaDaBase | null {
  const n = barras.length
  for (const folga of [0, 1, 2]) {
    const fim = n - 1 - folga
    if (fim < minimoCandles - 1) continue
    let topo = -Infinity
    let fundo = Infinity
    let melhor: { inicio: number; topo: number; fundo: number } | null = null
    for (let inicio = fim; inicio >= Math.max(0, fim - maximoCandles + 1); inicio--) {
      topo = Math.max(topo, barras[inicio].max)
      fundo = Math.min(fundo, barras[inicio].min)
      if ((topo - fundo) / fundo > amplitudeMaxPct / 100) break
      if (fim - inicio + 1 >= minimoCandles) melhor = { inicio, topo, fundo }
    }
    if (!melhor) continue
    const ultimo = barras[n - 1].fech
    const rompeu = folga === 0 ? null : ultimo > melhor.topo * 1.003 ? 'acima' : ultimo < melhor.fundo * 0.997 ? 'abaixo' : null
    if (folga > 0 && rompeu === null) continue
    return { inicio: barras[melhor.inicio].data, fim: barras[fim].data, indiceInicio: melhor.inicio, indiceFim: fim, topo: melhor.topo, fundo: melhor.fundo, candles: fim - melhor.inicio + 1, rompeu }
  }
  return null
}
