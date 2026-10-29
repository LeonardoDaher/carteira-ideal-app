import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DetalheAtivo } from './DetalheAtivo'
import type { AppCtx } from '../state/useAppState'

const ctx = {
  ativoSelecionado: 'acoesETFs',
  resultado: { carteira: { acoesETFs: 17 } },
  voltarDoDetalhe: vi.fn(),
} as unknown as AppCtx

describe('exemplos da carteira de referência com os radares (D131)', () => {
  it('ao abrir um segmento de ações, mostra o que os códigos do exemplo têm nos radares', () => {
    render(<DetalheAtivo ctx={ctx} />)
    expect(screen.queryByTestId('radares-dos-exemplos')).toBeNull()
    const bancos = screen.getAllByRole('button').find((b) => b.textContent?.includes('Financeiro / Bancos'))
    expect(bancos).toBeTruthy()
    fireEvent.click(bancos!)
    const radares = screen.getByTestId('radares-dos-exemplos')
    expect(radares.textContent).toContain('Nos nossos radares hoje')
    // ITUB4 é um dos maiores pesos do Ibovespa nos dados publicados.
    expect(radares.textContent).toContain('ITUB4')
    expect(radares.textContent).toContain('maior peso do IBOV')
  })
})
