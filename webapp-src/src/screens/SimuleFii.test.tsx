import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleFii } from './SimuleFii'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotRendimentosFii } from '../domain/rendaFii'

const ctx = { screen: 'simuleFii', setScreen: vi.fn() } as unknown as AppCtx

const snapshot: SnapshotRendimentosFii = {
  geradoEm: '2026-09-20T12:00:00Z',
  vigenciaIfix: 'set a dez/2026',
  fundos: [
    {
      ticker: 'AAAA11',
      nome: 'FUNDO A',
      cotacao: 9.02,
      dataCotacao: '2026-09-19',
      rendimentos: [
        { competencia: '2026-07', valorPorCota: 0.1 },
        { competencia: '2026-06', valorPorCota: 0.08 },
        { competencia: '2026-05', valorPorCota: 0.09 },
      ],
    },
    {
      ticker: 'BBBB11',
      nome: 'FUNDO B',
      cotacao: 100,
      dataCotacao: '2026-09-19',
      rendimentos: [{ competencia: '2026-07', valorPorCota: 0.8 }],
    },
  ],
}

describe('SimuleFii', () => {
  it('mostra cotação, último rendimento e a tabela com investimento necessário', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText('AAAA11', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText('R$ 9,02')).toBeDefined()
    expect(screen.getByText('R$ 45.100,00')).toBeDefined() // 5.000 cotas
    expect(screen.getByText('R$ 500,00')).toBeDefined()
  })

  it('sempre exibe o aviso de atraso da CVM e o de rentabilidade passada', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText(/dados com atraso/i)).toBeDefined()
    expect(screen.getByText(/último rendimento exibido é de jul\/2026/i)).toBeDefined()
    expect(screen.getByText(/Rentabilidade obtida no passado não representa garantia/i)).toBeDefined()
  })

  it('recalcula a tabela pela média quando o usuário troca a base', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Média dos meses' }))
    // média (0,10 + 0,08 + 0,09) / 3 = 0,09 → 5.000 cotas = R$ 450
    expect(screen.getByText('R$ 450,00')).toBeDefined()
  })

  it('troca de fundo pelos chips e calcula uma quantidade livre', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'BBBB11' }))
    fireEvent.change(screen.getByLabelText('Outra quantidade de cotas'), { target: { value: '37' } })
    expect(screen.getByText('R$ 3.700,00')).toBeDefined() // 37 × R$ 100
    expect(screen.getByText('R$ 29,60')).toBeDefined() // 37 × R$ 0,80
  })

  it('orienta o usuário quando o job mensal ainda não rodou', () => {
    render(<SimuleFii ctx={ctx} snapshot={{ geradoEm: null, vigenciaIfix: null, fundos: [] }} />)
    expect(screen.getByText(/ainda não foram carregados/i)).toBeDefined()
    expect(screen.getByText(/dados com atraso/i)).toBeDefined()
  })
})
