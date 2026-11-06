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
      series: [serie('PETRL660', 'call', 66, 1.5), serie('PETRX560', 'put', 56, 1.52), serie('PETRL600', 'call', 60, 4.1)],
    },
  ],
}

describe('SimuleOpcoes: aba Custo zero', () => {
  it('lista o par compra de call + venda de put com saldo quase zero', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Custo zero/ }))
    expect(screen.getByTestId('custozero-intro')).toBeDefined()
    const lista = screen.getByTestId('custozero-lista').textContent ?? ''
    expect(lista).toMatch(/Compra PETRL660.*Vende PETRX560/)
    expect(lista).not.toMatch(/PETRL600/)
    expect(screen.getByTestId('custozero-saldo').textContent).toMatch(/crédito/)
  })

  it('o preço simulado do gráfico mexe no resultado mostrado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Custo zero/ }))
    const controle = screen.getByLabelText(/Mova o preço do ativo/) as HTMLInputElement
    fireEvent.change(controle, { target: { value: '70' } })
    // compra call 66 a 1,50 e vende put 56 a 1,52 (100 un.): com o ativo a 70, ganho = (4 − 1,5 + 1,52) × 100 = 402
    expect((screen.getByTestId('sim-resultado-venc-custozero').textContent ?? '').replace(/\s/g, ' ')).toMatch(/402,00/)
    expect(screen.getByTestId('cursor-preco')).toBeDefined()
  })
})
