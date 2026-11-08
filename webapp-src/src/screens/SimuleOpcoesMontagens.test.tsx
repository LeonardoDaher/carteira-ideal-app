import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number): SerieOpcao => ({
  codigo, tipo, estilo: tipo === 'call' ? 'americana' : 'europeia', strike, vencimento: '2026-12-18', ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 50_000,
})

const snapshot: SnapshotOpcoes = {
  geradoEm: '2026-10-17T15:00:00Z',
  dataPregao: '2026-10-16',
  fonte: 'Cadastro de instrumentos e COTAHIST da B3',
  ativos: [
    {
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1, volumeOpcoes: 9_000_000, lote: 100,
      series: [serie('PETRL640', 'call', 64, 2), serie('PETRL660', 'call', 66, 0.8), serie('PETRX540', 'put', 54, 1), serie('PETRX560', 'put', 56, 1.5)],
    },
  ],
}

describe('SimuleOpcoes: aba Receber p/ montar', () => {
  it('mostra a melhor montagem de alta e a de baixa, e leva a simulação para as estratégias', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Receber p\/ montar/ }))
    expect(screen.getByTestId('montagens-intro')).toBeDefined()
    const alta = screen.getByTestId('montagem-PETR4').textContent ?? ''
    expect(alta).toMatch(/Vende PETRX560/)
    expect(alta).toMatch(/Compra PETRL660/)
    expect(alta).toMatch(/R\$\s*70,00/)

    fireEvent.click(screen.getByRole('button', { name: /Tendência de baixa/ }))
    const baixa = screen.getByTestId('montagem-PETR4').textContent ?? ''
    expect(baixa).toMatch(/Vende PETRL640/)
    expect(baixa).toMatch(/Compra PETRX540/)

    fireEvent.click(screen.getByRole('button', { name: 'Simular esta montagem' }))
    expect(screen.getByRole('tab', { name: /Estratégias/ }).getAttribute('aria-selected')).toBe('true')
  })
})
