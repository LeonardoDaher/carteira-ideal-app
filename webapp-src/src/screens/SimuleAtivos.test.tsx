import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleAtivos, SIMULADORES } from './SimuleAtivos'
import { SimuleAcoes } from './SimuleAcoes'
import { SimuleBdr } from './SimuleBdr'
import { SimuleEtf } from './SimuleEtf'
import { SimuleFii } from './SimuleFii'
import { SimuleTesouro } from './SimuleTesouro'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'simuleAtivos', setScreen: vi.fn() } as unknown as AppCtx

describe('SimuleAtivos (hub)', () => {
  it('mostra um cartão para cada simulador, com o endereço ?tela= que a landing usava', () => {
    render(<SimuleAtivos ctx={ctx} />)
    const esperado: Record<string, string> = {
      'Simule Ações': './?tela=simuleAcoes',
      'Simule FII': './?tela=simuleFii',
      'Simule Tesouro Direto': './?tela=simuleTesouro',
      'Simule BDR': './?tela=simuleBdr',
      'Simule ETF': './?tela=simuleEtf',
      'Simule Opções': './?tela=simuleOpcoes',
    }
    for (const [titulo, href] of Object.entries(esperado)) {
      const link = screen.getByRole('link', { name: new RegExp(titulo) })
      expect(link.getAttribute('href')).toBe(href)
    }
    expect(SIMULADORES).toHaveLength(6)
  })

  it('o Simule Opções vem logo depois do Simule Ações', () => {
    const ordem = SIMULADORES.map((s) => s.titulo)
    expect(ordem.indexOf('Simule Opções')).toBe(ordem.indexOf('Simule Ações') + 1)
    expect(ordem.slice(0, 2)).toEqual(['Simule Ações', 'Simule Opções'])
  })

  it('volta para a landing e não mostra a barra de abas do questionário', () => {
    const { container } = render(<SimuleAtivos ctx={ctx} />)
    expect(screen.getByRole('link', { name: '← Início' }).getAttribute('href')).toBe('../')
    expect(container.querySelector('.tabbar')).toBeNull()
  })
})

describe('simuladores abertos pelo hub', () => {
  it.each([
    ['Ações', () => render(<SimuleAcoes ctx={ctx} />)],
    ['FII', () => render(<SimuleFii ctx={ctx} />)],
    ['Tesouro', () => render(<SimuleTesouro ctx={ctx} />)],
    ['BDR', () => render(<SimuleBdr ctx={ctx} />)],
    ['ETF', () => render(<SimuleEtf ctx={ctx} />)],
  ] as const)('Simule %s volta para o Simule Ativos', (_nome, montar) => {
    montar()
    expect(screen.getByRole('link', { name: '← Simule Ativos' }).getAttribute('href')).toBe('./?tela=simuleAtivos')
  })
})
