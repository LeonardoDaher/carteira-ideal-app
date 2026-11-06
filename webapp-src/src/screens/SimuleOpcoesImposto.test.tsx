import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('lê o extrato da B3 enviado e apura o imposto do mês', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Imposto/ }))
    const csv = [
      'Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor',
      '05/10/2026;Venda;Opção de Compra;-;XP;PETRK600;100;2,00;200,00',
      '15/10/2026;Compra;Opção de Compra;-;XP;PETRK600;100;0,50;50,00',
      '16/10/2026;Compra;Mercado à Vista;-;XP;PETR4;100;60,00;6000,00',
    ].join('\n')
    const arquivo = new File([csv], 'negociacao.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Enviar extrato da B3'), { target: { files: [arquivo] } })
    await waitFor(() => expect(screen.getByTestId('imposto-resumo-extrato')).toBeDefined())
    expect(screen.getByTestId('imposto-resumo-extrato').textContent).toMatch(/2 negócios com opções/)
    expect((screen.getByTestId('imposto-darf-2026-10').textContent ?? '').replace(/\s/g, ' ')).toMatch(/22,49/)
  })

  it('arquivo que não é o extrato mostra um aviso', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Imposto/ }))
    fireEvent.change(screen.getByLabelText('Enviar extrato da B3'), { target: { files: [new File(['a;b\n1;2'], 'x.csv')] } })
    await waitFor(() => expect(screen.getByTestId('imposto-erro')).toBeDefined())
  })
})
