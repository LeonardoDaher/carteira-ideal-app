import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BENS, SimuleBens } from './SimuleBens'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'simuleBens', setScreen: vi.fn() } as unknown as AppCtx

describe('SimuleBens (hub)', () => {
  it('o imóvel é um link para o comparativo, no mesmo endereço ?tela= de sempre', () => {
    render(<SimuleBens ctx={ctx} />)
    const link = screen.getByRole('link', { name: /Imóvel/ })
    expect(link.getAttribute('href')).toBe('./?tela=simuleImovel')
    expect(within(link).getByText(/Comprar à vista, financiar, consórcio ou alugar/)).toBeTruthy()
  })

  it('o carro é um link para o comparativo de carro, no endereço ?tela= de sempre', () => {
    render(<SimuleBens ctx={ctx} />)
    const link = screen.getByRole('link', { name: /Carro/ })
    expect(link.getAttribute('href')).toBe('./?tela=simuleCarro')
    expect(within(link).getByText(/ficar sem carro/)).toBeTruthy()
  })

  it('a moto é um link para o comparativo de moto', () => {
    render(<SimuleBens ctx={ctx} />)
    const link = screen.getByRole('link', { name: /Moto/ })
    expect(link.getAttribute('href')).toBe('./?tela=simuleMoto')
    expect(within(link).getByText(/ficar sem moto/)).toBeTruthy()
  })

  it('com os três bens no ar, nenhum cartão fica como "Em breve"', () => {
    render(<SimuleBens ctx={ctx} />)
    expect(screen.queryByText('Em breve')).toBeNull()
    expect(document.querySelector('[aria-disabled="true"]')).toBeNull()
  })

  it('a lista tem os três bens e todos estão disponíveis', () => {
    expect(BENS.map((b) => b.titulo)).toEqual(['Imóvel', 'Carro', 'Moto'])
    expect(BENS.filter((b) => b.disponivel).map((b) => b.tela)).toEqual(['simuleImovel', 'simuleCarro', 'simuleMoto'])
  })

  it('diz que é conta matemática e não indica banco, consórcio nem produto', () => {
    render(<SimuleBens ctx={ctx} />)
    expect(screen.getByText(/não\s+indica banco, administradora de consórcio nem produto/)).toBeTruthy()
  })

  it('volta para a landing e não mostra a barra de abas do questionário', () => {
    const { container } = render(<SimuleBens ctx={ctx} />)
    expect(screen.getByRole('link', { name: '← Início' }).getAttribute('href')).toBe('../')
    expect(container.querySelector('.tabbar')).toBeNull()
  })
})
