import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleBdr } from './SimuleBdr'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotBdrs } from '../domain/bdrs'

const ctx = { screen: 'simuleBdr', setScreen: vi.fn() } as unknown as AppCtx

const snapshot: SnapshotBdrs = {
  geradoEm: '2026-09-25T22:05:00Z',
  dataPregao: '2026-09-25',
  sessoesLiquidez: 21,
  criterio: { maxAcoes: 35, maxEtfs: 5, pisoVolumeAcoes: 300000, pisoVolumeEtfs: 100000 },
  acoes: [
    { ticker: 'AAPL34', nome: 'Apple Inc.', setor: 'Semicondutores e hardware', cotacao: 87.84, dataCotacao: '2026-09-25', variacao3m: 20.4, volumeMedio: 26_000_000, minima52: 63.42, maxima52: 88.51, acoesPorBdr: 0.05 },
    { ticker: 'MSFT34', nome: 'Microsoft Corp.', setor: 'Software e internet', cotacao: 111.19, dataCotacao: '2026-09-25', variacao3m: -3.2, volumeMedio: 30_000_000, minima52: 90, maxima52: 120, acoesPorBdr: 0.04 },
  ],
  etfs: [
    { ticker: 'BSLV39', nome: 'ISHARES SILVER TRUST', setor: 'Metais preciosos', cotacao: 100.11, dataCotacao: '2026-09-25', variacao3m: 8, volumeMedio: 400_000, minima52: 70, maxima52: 105, acoesPorBdr: 1 },
  ],
  busca: [
    { ticker: 'AAPL34', tipo: 'acao', nome: 'Apple Inc.', setor: 'Semicondutores e hardware', cotacao: 87.84, volumeDia: 3_700_000 },
    { ticker: 'KOCH34', tipo: 'acao', nome: null, setor: 'Consumo não durável', cotacao: 25.5, volumeDia: 0 },
  ],
}

describe('SimuleBdr', () => {
  it('lista por setor, com os BDRs de ETF num bloco próprio', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('heading', { name: 'Semicondutores e hardware' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Software e internet' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'BDRs de ETF' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'BSLV39' })).toBeDefined()
  })

  it('mostra fechamento, variação de 3 meses, proporção e a simulação padrão de R$ 5 mil', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'AAPL34' }))
    expect(screen.getByText('fechamento de 25/09/2026')).toBeDefined()
    expect(screen.getByText('+20,4%')).toBeDefined()
    expect(screen.getByText('20 BDRs = 1 ação')).toBeDefined()
    expect(screen.getByText('56')).toBeDefined() // R$ 5.000 / R$ 87,84
    expect(screen.getByText('2,8 ações')).toBeDefined()
  })

  it('recalcula com outro valor digitado', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'AAPL34' }))
    fireEvent.change(screen.getByLabelText('Outro valor em reais'), { target: { value: '1000' } })
    expect(screen.getByText('11')).toBeDefined()
  })

  it('não mostra múltiplos de avaliação nem ranking (D19)', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    expect(screen.queryByText(/P\/L|lucro por ação|melhores|maior alta/i)).toBeNull()
  })

  it('abre um BDR fora da lista pela busca, com o aviso de volume e sem dados que ele não tem', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar BDR por código ou nome'), { target: { value: 'KOCH' } })
    fireEvent.click(screen.getByRole('button', { name: /KOCH34/ }))
    expect(screen.getByText('KOCH34', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText(/Fora da lista por volume/)).toBeDefined()
    expect(screen.getByText(/não teve negócios no último pregão/)).toBeDefined()
    expect(screen.queryByText('Variação em 3 meses')).toBeNull()
  })

  it('pela busca, um BDR da lista abre o cartão completo', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'MSFT34' }))
    fireEvent.change(screen.getByLabelText('Buscar BDR por código ou nome'), { target: { value: 'apple' } })
    fireEvent.click(within(screen.getByRole('list', { name: 'BDRs encontrados' })).getByRole('button', { name: /AAPL34/ }))
    expect(screen.getByText('20 BDRs = 1 ação')).toBeDefined()
    expect(screen.queryByText(/Fora da lista por volume/)).toBeNull()
  })

  it('sempre mostra IR, risco cambial e rentabilidade passada', () => {
    render(<SimuleBdr ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText(/Como o IR funciona nos BDRs/)).toBeDefined()
    expect(screen.getByText(/isenção para vendas de até R\$ 20 mil/)).toBeDefined()
    expect(screen.getByText(/alta ou a queda do dólar/)).toBeDefined()
    expect(screen.getByText(/Rentabilidade obtida no passado não representa garantia/)).toBeDefined()
  })

  it('sem dados, avisa que ainda não carregou', () => {
    render(<SimuleBdr ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, acoes: [], etfs: [], busca: [] }} />)
    expect(screen.getByText(/ainda não foram carregados/)).toBeDefined()
  })
  it('com dados da B3 (D24): data do último negócio na busca e a fonte no rodapé', () => {
    const daB3: SnapshotBdrs = {
      ...snapshot,
      fonte: 'B3 - Boletim de Preços (BVBG.086)',
      pregoesNoHistorico: 260,
      busca: [{ ticker: 'KOCH34', tipo: 'acao', nome: null, setor: 'Consumo não durável', cotacao: 25.5, dataCotacao: '2026-09-18', volumeDia: 0 }],
    }
    render(<SimuleBdr ctx={ctx} snapshot={daB3} />)
    expect(screen.getByText(/Preços e volumes oficiais da B3 \(Boletim de Preços\)/)).toBeDefined()
    expect(screen.queryByText(/Dados da brapi/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar BDR por código ou nome'), { target: { value: 'KOCH' } })
    fireEvent.click(screen.getByRole('button', { name: /KOCH34/ }))
    expect(screen.getByText('fechamento de 18/09/2026')).toBeDefined()
    expect(screen.getByText(/o preço exibido é o do último negócio, em 18\/09\/2026/)).toBeDefined()
  })
})
