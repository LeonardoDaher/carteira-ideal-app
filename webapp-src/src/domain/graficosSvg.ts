// Geometria dos gráficos do painel (área e barras), como funções puras: recebem números e
// devolvem coordenadas e caminhos SVG. Assim o desenho é testável sem navegador e os componentes
// React só repassam o resultado. O app não usa biblioteca de gráficos; tudo é SVG próprio.

export interface PontoXY {
  x: number
  y: number
}

export interface GeometriaArea {
  /** Caminho da linha (M x y L x y ...). */
  linha: string
  /** Caminho da área sob a linha, fechado na base. */
  area: string
  pontos: PontoXY[]
  /** y da linha de base (valor mínimo do eixo). */
  yBase: number
}

export interface MargemGrafico {
  topo: number
  direita: number
  base: number
  esquerda: number
}

const MARGEM_PADRAO: MargemGrafico = { topo: 8, direita: 6, base: 6, esquerda: 6 }
const f = (n: number) => String(Math.round(n * 100) / 100)

/**
 * Linha e área de uma série. O eixo vai de 0 até o maior valor (nunca "corta" a base): um
 * gráfico de capital que começa em 80% da altura exagera o que cresceu. Com um ponto só ou com
 * tudo igual, desenha uma linha reta em vez de dividir por zero.
 */
export function geometriaArea(valores: number[], largura: number, altura: number, margem: Partial<MargemGrafico> = {}): GeometriaArea {
  const m = { ...MARGEM_PADRAO, ...margem }
  const w = Math.max(1, largura - m.esquerda - m.direita)
  const h = Math.max(1, altura - m.topo - m.base)
  const yBase = m.topo + h
  if (!valores.length) return { linha: '', area: '', pontos: [], yBase }

  const maximo = Math.max(...valores, 0)
  const escala = maximo > 0 ? maximo : 1
  const pontos: PontoXY[] = valores.map((v, i) => ({
    x: m.esquerda + (valores.length === 1 ? w / 2 : (w * i) / (valores.length - 1)),
    y: m.topo + h - (Math.max(v, 0) / escala) * h,
  }))
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ')
  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  const area = `${linha} L${f(ultimo.x)} ${f(yBase)} L${f(primeiro.x)} ${f(yBase)} Z`
  return { linha, area, pontos, yBase }
}

export interface BarraGeometria {
  x: number
  y: number
  largura: number
  altura: number
  /** true nas últimas barras, que recebem o destaque dourado. */
  destaque: boolean
}

/**
 * Barras de largura igual. As últimas `destaques` ficam em destaque (como no radar de proventos:
 * barras cinzas e as mais recentes em dourado). Valor zero vira uma barrinha de 2 px, para o mês
 * sem provento não "sumir" do eixo.
 */
export function geometriaBarras(
  valores: number[],
  largura: number,
  altura: number,
  destaques = 2,
  margem: Partial<MargemGrafico> = {},
): BarraGeometria[] {
  const m = { ...MARGEM_PADRAO, ...margem }
  const n = valores.length
  if (!n) return []
  const w = Math.max(1, largura - m.esquerda - m.direita)
  const h = Math.max(1, altura - m.topo - m.base)
  const passo = w / n
  const larg = passo * 0.62
  const maximo = Math.max(...valores, 0)
  const escala = maximo > 0 ? maximo : 1
  return valores.map((v, i) => {
    const alt = v > 0 ? Math.max(2, (v / escala) * h) : 2
    return {
      x: m.esquerda + passo * i + (passo - larg) / 2,
      y: m.topo + h - alt,
      largura: larg,
      altura: alt,
      destaque: i >= n - Math.max(0, destaques),
    }
  })
}
