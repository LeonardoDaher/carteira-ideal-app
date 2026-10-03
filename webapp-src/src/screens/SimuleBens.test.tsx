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

  it('a moto aparece como "Em breve", sem link e sinalizada como indisponível', () => {
    render(<SimuleBens ctx={ctx} />)
    expect(screen.queryByRole('link', { name: /Moto/ })).toBeNull()
    const selos = screen.getAllByText('Em breve')
    expect(selos).toHaveLength(1)
    expect(selos[0].closest('[aria-disabled="true"]')).toBeTruthy()
    expect(screen.getByText('Moto')).toBeTruthy()
  })

  it('a lista tem os três bens e só imóvel e carro estão disponíveis', () => {
    expect(BENS.map((b) => b.titulo)).toEqual(['Imóvel', 'Carro', 'Moto'])
    expect(BENS.filter((b) => b.disponivel).map((b) => b.tela)).toEqual(['simuleImovel', 'simuleCarro'])
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
