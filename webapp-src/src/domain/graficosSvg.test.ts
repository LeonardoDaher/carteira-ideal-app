import { describe, expect, it } from 'vitest'
import { geometriaArea, geometriaBarras } from './graficosSvg'

describe('geometriaArea', () => {
  it('o maior valor encosta no topo da área útil e o zero na base (eixo sempre parte de 0)', () => {
    const g = geometriaArea([0, 50, 100], 100, 60, { topo: 10, base: 10, esquerda: 0, direita: 0 })
    expect(g.pontos.map((p) => p.y)).toEqual([50, 30, 10])
    expect(g.yBase).toBe(50)
  })
  it('os pontos se distribuem uniformemente da esquerda para a direita', () => {
    const g = geometriaArea([1, 2, 3, 4, 5], 100, 50, { esquerda: 0, direita: 0 })
    expect(g.pontos.map((p) => p.x)).toEqual([0, 25, 50, 75, 100])
  })
  it('a área fecha na base: começa na linha e volta pelo chão', () => {
    const g = geometriaArea([10, 20], 100, 50, { esquerda: 0, direita: 0, topo: 0, base: 0 })
    expect(g.linha).toBe('M0 25 L100 0')
    expect(g.area).toBe('M0 25 L100 0 L100 50 L0 50 Z')
  })
  it('um ponto só: desenha no meio, sem dividir por zero', () => {
    const g = geometriaArea([5], 100, 50, { esquerda: 0, direita: 0 })
    expect(g.pontos).toHaveLength(1)
    expect(Number.isFinite(g.pontos[0].x) && Number.isFinite(g.pontos[0].y)).toBe(true)
    expect(g.pontos[0].x).toBe(50)
  })
  it('tudo zero ou série vazia: sem NaN', () => {
    const z = geometriaArea([0, 0, 0], 100, 50)
    expect(z.pontos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    expect(z.pontos.every((p) => p.y === z.yBase)).toBe(true)
    expect(geometriaArea([], 100, 50)).toMatchObject({ linha: '', area: '', pontos: [] })
  })
  it('valor negativo é tratado como zero (capital aplicado não fica abaixo da base)', () => {
    const g = geometriaArea([-5, 10], 100, 50, { esquerda: 0, direita: 0, topo: 0, base: 0 })
    expect(g.pontos[0].y).toBe(50)
  })
  it('tamanho minúsculo não gera coordenadas inválidas', () => {
    const g = geometriaArea([1, 2], 2, 2)
    expect(g.pontos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('geometriaBarras', () => {
  it('a barra maior ocupa a altura útil; as demais, proporcionais', () => {
    const b = geometriaBarras([50, 100], 100, 100, 1, { topo: 0, base: 0, esquerda: 0, direita: 0 })
    expect(b[1].altura).toBe(100)
    expect(b[0].altura).toBe(50)
    expect(b[1].y).toBe(0)
  })
  it('as últimas N barras ficam em destaque', () => {
    const b = geometriaBarras([1, 2, 3, 4, 5], 100, 50, 2)
    expect(b.map((x) => x.destaque)).toEqual([false, false, false, true, true])
  })
  it('valor zero vira uma barrinha visível de 2 px', () => {
    const b = geometriaBarras([0, 10], 100, 100, 1, { topo: 0, base: 0, esquerda: 0, direita: 0 })
    expect(b[0].altura).toBe(2)
  })
  it('nenhuma barra sai da área nem sobrepõe a vizinha', () => {
    const b = geometriaBarras([3, 9, 1, 7], 120, 80, 2, { esquerda: 5, direita: 5 })
    for (let i = 0; i < b.length; i++) {
      expect(b[i].x).toBeGreaterThanOrEqual(5)
      expect(b[i].x + b[i].largura).toBeLessThanOrEqual(115 + 1e-9)
      if (i > 0) expect(b[i].x).toBeGreaterThan(b[i - 1].x + b[i - 1].largura)
    }
  })
  it('série vazia e tudo zero: sem NaN', () => {
    expect(geometriaBarras([], 100, 50)).toEqual([])
    expect(geometriaBarras([0, 0], 100, 50).every((x) => Number.isFinite(x.altura) && Number.isFinite(x.y))).toBe(true)
  })
})
