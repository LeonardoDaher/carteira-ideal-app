import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PonteMeuMes } from './PonteMeuMes'
import type { AppCtx } from '../state/useAppState'

const ctxCom = (respostasArquitetura: AppCtx['respostasArquitetura']) =>
  ({ respostasArquitetura, setScreen: vi.fn() }) as unknown as AppCtx

describe('PonteMeuMes (resultado → Meu Mês)', () => {
  it('Pilar 2 em [A]: fala da dívida cara e abre o Meu Mês', () => {
    const ctx = ctxCom({ passivoDividas: 'a', capacidadeFinanceira: 'a' })
    render(<PonteMeuMes ctx={ctx} />)
    expect(screen.getByText('Antes de investir: a dívida cara')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Meu Mês' }))
    expect(ctx.setScreen).toHaveBeenCalledWith('meuMes')
  })

  it('só o Pilar 1 em [A]: fala da reserva', () => {
    render(<PonteMeuMes ctx={ctxCom({ passivoDividas: 'b', capacidadeFinanceira: 'a' })} />)
    expect(screen.getByText('Antes de investir: a reserva')).toBeTruthy()
    expect(screen.queryByText(/dívida cara/)).toBeNull()
  })

  it('sem [A] nos Pilares 1 e 2: não aparece nada', () => {
    const { container } = render(<PonteMeuMes ctx={ctxCom({ passivoDividas: 'b', capacidadeFinanceira: 'c', janelaLiquidez: 'a' })} />)
    expect(container.textContent).toBe('')
  })
})
