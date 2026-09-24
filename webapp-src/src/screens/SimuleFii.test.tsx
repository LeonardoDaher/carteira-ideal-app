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

  it('mostra só o último rendimento, sem média nem seletor de base (decisão D10)', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.queryByRole('button', { name: /média/i })).toBeNull()
    expect(screen.queryByText(/média de/i)).toBeNull()
    expect(screen.getByText(/1,11%/)).toBeDefined() // 0,10 / 9,02
    // tabela calculada pelo último rendimento (0,10), não pela média dos meses (0,09)
    expect(screen.getByText('R$ 500,00')).toBeDefined()
    expect(screen.queryByText('R$ 450,00')).toBeNull()
  })

  it('explica no aviso que a estimativa se distorce em meses de emissão e fechamento de semestre', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText(/emissão de cotas ou de fechamento de semestre/i)).toBeDefined()
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

describe('SimuleFii: busca livre (D12)', () => {
  const amplo: SnapshotRendimentosFii = {
    ...snapshot,
    destaques: ['AAAA11'],
    fundos: [
      ...snapshot.fundos,
      {
        ticker: 'CCCC11',
        nome: 'FUNDO DE INVESTIMENTO IMOBILIÁRIO PÁTRIA LOGÍSTICA - RESPONSABILIDADE LIMITADA',
        cotacao: 50,
        dataCotacao: '2026-08-01',
        rendimentos: [{ competencia: '2026-07', valorPorCota: 0.4 }],
        confianca: 'baixa',
        motivosConfianca: ['pouca-negociacao'],
      },
    ],
    indisponiveis: [{ ticker: 'ZZZZ11', nome: 'FUNDO Z', motivo: 'rendimento-atipico' }],
  }
  const buscar = (texto: string) =>
    fireEvent.change(screen.getByLabelText(/buscar fundo imobiliário/i), { target: { value: texto } })

  it('mostra só os destaques como atalho e conta os fundos disponíveis', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    expect(screen.getByRole('button', { name: 'AAAA11' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'CCCC11' })).toBeNull()
    expect(screen.getByText(/3 fundos com dados/)).toBeDefined()
  })

  it('acha um fundo fora dos destaques pelo nome, sem acento, e abre a simulação', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('patria')
    fireEvent.click(screen.getByRole('button', { name: /CCCC11/ }))
    expect(screen.getByText('CCCC11', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined() // 5.000 cotas × R$ 0,40
    expect(screen.queryByRole('list', { name: /fundos encontrados/i })).toBeNull() // busca limpa
  })

  it('Enter escolhe o primeiro resultado', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('bbbb')
    fireEvent.keyDown(screen.getByLabelText(/buscar fundo imobiliário/i), { key: 'Enter' })
    expect(screen.getByText('BBBB11', { selector: '.font-display' })).toBeDefined()
  })

  it('avisa quando a estimativa do fundo é menos confiável', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('CCCC11')
    fireEvent.click(screen.getByRole('button', { name: /CCCC11/ }))
    expect(screen.getByText(/estimativa menos confiável/i)).toBeDefined()
    expect(screen.getByText(/quase não foi negociada/i)).toBeDefined()
  })

  it('explica por que um fundo conhecido está sem dados neste mês', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('zzzz')
    expect(screen.getByText(/ZZZZ11 está sem dados neste mês/)).toBeDefined()
    expect(screen.getByText(/variaram demais/)).toBeDefined()
  })

  it('orienta quando nada é encontrado', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('QWER11')
    expect(screen.getByText(/Nenhum fundo encontrado para “QWER11”/)).toBeDefined()
  })
})
