import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx
const serie = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento: '2026-12-18', ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 50_000,
})
const strikes = [48, 52, 56, 60, 64, 68, 72]
const snapshot: SnapshotOpcoes = {
  geradoEm: '2026-10-17T15:00:00Z', dataPregao: '2026-10-16', fonte: 'B3',
  ativos: [{
    ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1, volumeOpcoes: 9_000_000, lote: 100,
    series: strikes.flatMap((k) => [serie(`C${k}`, 'call', k, 3), serie(`P${k}`, 'put', k, 3)]),
  }],
}

describe('SimuleOpcoes: Estratégias com Risk Reversal e faixa de strike', () => {
  it('lista o grupo Risk Reversal e a faixa de strike limita as séries sugeridas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))
    const grupo = screen.getByRole('group', { name: 'Risk Reversal' })
    expect(within(grupo).getByRole('button', { name: /Bullish Risk Reversal/ })).toBeDefined()
    expect(within(grupo).getByRole('button', { name: /Bearish Risk Reversal/ })).toBeDefined()
    expect(document.body.textContent).not.toMatch(/Prefiro/i)

    fireEvent.click(within(grupo).getByRole('button', { name: /Bullish Risk Reversal/ }))
    expect(screen.getByTestId('faixa-estrategia')).toBeDefined()
    const serieDaPerna = (n: number) => (screen.getByLabelText(`Série da perna ${n}`) as HTMLSelectElement).value
    expect([serieDaPerna(1), serieDaPerna(2)]).toEqual(['P52', 'C68']) // sugestão sem faixa (dois degraus de cada lado)

    fireEvent.click(screen.getByRole('button', { name: /Perto do preço \(±10%\)/ })) // 54 a 66
    const perna1 = screen.getByLabelText('Série da perna 1') as HTMLSelectElement
    const strikesNaPerna = [...perna1.options].map((o) => o.value)
    expect(strikesNaPerna).toEqual(['P56', 'P60', 'P64'])
    expect(serieDaPerna(1)).toBe('P56')
    expect(serieDaPerna(2)).toBe('C64')
  })
})
