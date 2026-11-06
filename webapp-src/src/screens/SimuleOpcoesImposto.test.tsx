import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx
const snapshot: SnapshotOpcoes = { geradoEm: '2026-10-17T15:00:00Z', dataPregao: '2026-10-16', fonte: 'B3', ativos: [] }

describe('SimuleOpcoes: aba Imposto', () => {
  beforeEach(() => window.localStorage.clear())

  it('lança um ganho de swing e apura 15% de DARF no mês', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Imposto/ }))
    expect(screen.getByTestId('imposto-intro')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Data do resultado'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Valor do ganho'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect((screen.getByTestId('imposto-darf-2026-10').textContent ?? '').replace(/\s/g, ' ')).toMatch(/150,00/)
    expect(JSON.parse(window.localStorage.getItem('carteira-ideal:imposto-opcoes:v1') ?? '[]')).toHaveLength(1)
  })
})
