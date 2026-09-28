import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleEtf } from './SimuleEtf'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotEtfs } from '../domain/etfs'

const ctx = { screen: 'simuleEtf', setScreen: vi.fn() } as unknown as AppCtx

// Números do pregão real de 25/09/2026 (Boletim de Preços da B3).
const snapshot: SnapshotEtfs = {
  geradoEm: '2026-09-28T01:05:00Z',
  dataPregao: '2026-09-25',
  fonte: 'B3 - Boletim de Preços (BVBG.086)',
  pregoesNoHistorico: 260,
  sessoesLiquidez: 21,
  criterio: { maxEtfs: 40, pisoVolume: 500000 },
  ordemCategorias: ['Bolsa brasileira', 'Bolsa exterior', 'Renda fixa', 'Ouro, dólar e commodities', 'Cripto', 'Outros'],
  etfs: [
    { ticker: 'BOVA11', nome: 'iShares Ibovespa', categoria: 'Bolsa brasileira', indice: 'Ibovespa', cambio: null, cotacao: 180.82, dataCotacao: '2026-09-25', volumeMedio: 743_000_000, variacao3m: 4.2, minima52: 120.5, maxima52: 185.1 },
    { ticker: 'IVVB11', nome: 'iShares S&P 500', categoria: 'Bolsa exterior', indice: 'S&P 500', cambio: true, cotacao: 453, dataCotacao: '2026-09-25', volumeMedio: 40_800_000, variacao3m: -1.5, minima52: 380, maxima52: 460 },
    { ticker: 'SPXH11', nome: 'Trend ETF S&P 500 Quanto', categoria: 'Bolsa exterior', indice: 'S&P 500', cambio: false, cotacao: 59.65, dataCotacao: '2026-09-25', volumeMedio: 4_900_000, variacao3m: 6, minima52: null, maxima52: null },
    { ticker: 'LFTS11', nome: 'Investo Teva Tesouro Selic ETF', categoria: 'Renda fixa', indice: 'Tesouro Selic', cambio: null, cotacao: 160.46, dataCotacao: '2026-09-25', volumeMedio: 18_100_000, variacao3m: 3.3, minima52: 144, maxima52: 160.5 },
  ],
  busca: [
    { ticker: 'BOVA11', nome: 'iShares Ibovespa', categoria: 'Bolsa brasileira', cotacao: 180.82, dataCotacao: '2026-09-25', volumeMedio: 743_000_000 },
    { ticker: 'CORN11', nome: 'BB ETF Indice Futuro de Milho B3', categoria: 'Ouro, dólar e commodities', cotacao: 7.47, dataCotacao: '2026-09-23', volumeMedio: 60_000 },
  ],
}

describe('SimuleEtf', () => {
  it('lista por categoria, na ordem do config', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Bolsa brasileira', 'Bolsa exterior', 'Renda fixa'])
    expect(screen.getByRole('button', { name: 'LFTS11' })).toBeDefined()
  })

  it('abre com o primeiro da lista: índice, fechamento, variação e simulação padrão de R$ 5 mil', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText('Ibovespa')).toBeDefined()
    expect(screen.getByText('fechamento de 25/09/2026')).toBeDefined()
    expect(screen.getByText('+4,2%')).toBeDefined()
    expect(screen.getByText('27')).toBeDefined() // R$ 5.000 / R$ 180,82
    expect(screen.getByText(/15% de IR pago pelo investidor por DARF/)).toBeDefined()
  })

  it('mostra se o ETF de bolsa exterior varia com o dólar', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'IVVB11' }))
    expect(screen.getByText('Varia também com o dólar.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'SPXH11' }))
    expect(screen.getByText('Sem a variação do dólar.')).toBeDefined()
  })

  it('ETF de renda fixa mostra o IR retido na fonte', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'LFTS11' }))
    expect(screen.getByText(/ETF de renda fixa: o IR é retido na fonte/)).toBeDefined()
    expect(screen.queryByText(/variação do dólar/)).toBeNull()
  })

  it('recalcula com outro valor digitado', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Outro valor em reais'), { target: { value: '1000' } })
    expect(screen.getByText('5')).toBeDefined() // R$ 1.000 / R$ 180,82
  })

  it('ETF da busca fora da lista abre o cartão resumido, com o aviso de preço de dia anterior', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ETF por código ou nome'), { target: { value: 'milho' } })
    fireEvent.click(screen.getByRole('button', { name: /CORN11/ }))
    expect(screen.getByText('Fora da lista por volume.')).toBeDefined()
    expect(screen.getByText(/não teve negócios no último pregão: o preço exibido é de 23\/09\/2026/)).toBeDefined()
  })

  it('busca sem resultado explica onde ficam os BDRs de ETF', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ETF por código ou nome'), { target: { value: 'BSLV39' } })
    expect(screen.getByText(/ficam no Simule BDR/)).toBeDefined()
  })

  it('sem dados, mostra o aviso de carregamento', () => {
    render(<SimuleEtf ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, etfs: [], busca: [] }} />)
    expect(screen.getByText('Os dados dos ETFs ainda não foram carregados.')).toBeDefined()
  })

  it('traz os avisos de IR, rentabilidade passada e fonte oficial', () => {
    render(<SimuleEtf ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText('Como o IR funciona nos ETFs.')).toBeDefined()
    expect(screen.getByText(/Dados oficiais da B3 \(Boletim de Preços\), atualizados em 28\/09\/2026/)).toBeDefined()
  })
})
