import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraficoPorStrike } from './GraficoPorStrike'

// Geometria do componente: viewBox de 360 de largura, margens de 46 (esquerda) e 12 (direita): o centro do eixo é o x 197.
const CENTRO = 46 + (360 - 46 - 12) / 2

const desenhar = (strikes: number[], preco: number) =>
  render(
    <GraficoPorStrike
      strikes={strikes}
      linhas={[{ id: 'a', rotulo: '19/11', cor: '#2563eb', valores: strikes.map((_, i) => i + 1) }]}
      precoAtivo={preco}
      formatarValor={(v) => String(Math.round(v))}
      descricao="teste"
    />,
  )
const linhaDoPreco = (c: HTMLElement) => c.querySelector('line[stroke-dasharray="3 3"]')!
const xDe = (el: Element) => Number(el.getAttribute('x1'))
const xsDosPontos = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="linha-a"] circle')].map((p) => Number(p.getAttribute('cx')))

describe('GraficoPorStrike: o preço do ativo fica no centro', () => {
  it('com strikes simétricos em torno do preço', () => {
    const { container } = desenhar([8, 9, 10, 11, 12], 10)
    expect(xDe(linhaDoPreco(container))).toBeCloseTo(CENTRO, 5)
  })

  it('com mais strikes de um lado só, o preço continua exatamente no meio', () => {
    const { container } = desenhar([9, 10, 11, 12, 13, 14, 15], 10)
    expect(xDe(linhaDoPreco(container))).toBeCloseTo(CENTRO, 5)
    // o strike mais distante (15) encosta na borda direita; o outro lado fica com espaço livre
    const xs = xsDosPontos(container)
    expect(Math.max(...xs)).toBeCloseTo(360 - 12, 5)
    expect(Math.min(...xs)).toBeGreaterThan(46)
  })

  it('com todos os strikes acima do preço, o preço ainda é o centro', () => {
    const { container } = desenhar([10.5, 11, 12], 10)
    expect(xDe(linhaDoPreco(container))).toBeCloseTo(CENTRO, 5)
  })

  it('o eixo tem o preço como o valor do meio', () => {
    const { container } = desenhar([8, 9, 10, 11, 12], 10)
    const rotulos = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(rotulos).toContain('10') // 5 marcas: 8, 9, 10, 11, 12, com o preço no meio
    expect(rotulos).toContain('preço')
  })

  it('um strike só no preço não quebra o eixo', () => {
    const { container } = desenhar([10], 10)
    expect(xDe(linhaDoPreco(container))).toBeCloseTo(CENTRO, 5)
  })

  it('strikes muito acima do preço não criam eixo negativo (o excesso é recortado)', () => {
    const { container } = desenhar([10, 11, 50], 10)
    const marcas = [...container.querySelectorAll('text')].map((t) => t.textContent ?? '').filter((t) => /^[\d,.]+$/.test(t))
    for (const m of marcas) expect(Number(m.replace('.', '').replace(',', '.'))).toBeGreaterThanOrEqual(0)
    expect(container.querySelector('clipPath')).not.toBeNull()
  })

  it('a leitura por teclado continua achando o strike mais perto do preço', () => {
    const { container, getByTestId } = desenhar([8, 9, 10, 11, 12], 10)
    fireEvent.keyDown(container.querySelector('svg')!, { key: 'ArrowRight' })
    expect(getByTestId('leitura-grafico').textContent).toMatch(/Strike R\$\s11,00/)
  })
})
