import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleAcoes } from './SimuleAcoes'
import { agruparPorGrupo, buscarAcoes, simularCompraAcoes, totaisDe } from '../domain/acoes'
import type { SnapshotAcoes } from '../domain/acoes'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'simuleAcoes', setScreen: vi.fn() } as unknown as AppCtx

const acao = (ticker: string, nome: string, cotacao: number, volumeMedio: number, variacao3m: number | null = 3.2) => ({
  ticker, nome, cotacao, dataCotacao: '2026-10-01', variacao3m, volumeMedio, minima52: cotacao * 0.8, maxima52: cotacao * 1.1,
})

const snapshot: SnapshotAcoes = {
  geradoEm: '2026-10-01T23:05:00Z',
  dataPregao: '2026-10-01',
  fonte: 'B3 - Boletim de Preços (BVBG.086)',
  sessoesLiquidez: 21,
  totais: { setores: 3, empresas: 5 },
  gruposOrdem: ['Petróleo, Gás e Biocombustíveis', 'Materiais Básicos', 'Financeiro'],
  setores: [
    { setor: 'Bancos', grupoB3: 'Financeiro', empresas: [acao('ITUB4', 'Itaú Unibanco', 40, 900_000_000), acao('BBAS3', 'Banco do Brasil', 25, 500_000_000, -4)] },
    { setor: 'Petróleo e gás', grupoB3: 'Petróleo, Gás e Biocombustíveis', empresas: [acao('PETR4', 'Petrobras', 38.5, 1_200_000_000), acao('PRIO3', 'PRIO', 42, 400_000_000)] },
    { setor: 'Mineração', grupoB3: 'Materiais Básicos', empresas: [acao('VALE3', 'Vale', 60, 800_000_000)] },
  ],
  busca: [
    { ticker: 'PETR4', nome: 'Petrobras', setor: 'Petróleo e gás', cotacao: 38.5, dataCotacao: '2026-10-01', volumeDia: 1_000_000_000 },
    { ticker: 'ABCD3', nome: null, setor: 'Outros', cotacao: 12.3, dataCotacao: '2026-09-29', volumeDia: 0 },
  ],
}

describe('domínio das ações', () => {
  it('agrupa os setores nos grupos da B3, na ordem do config, com as contagens', () => {
    const g = agruparPorGrupo(snapshot.setores, snapshot.gruposOrdem)
    expect(g.map((x) => x.grupo)).toEqual(['Petróleo, Gás e Biocombustíveis', 'Materiais Básicos', 'Financeiro'])
    expect(g[2]).toMatchObject({ empresas: 2 })
    expect(totaisDe(snapshot.setores)).toEqual({ setores: 3, empresas: 5 })
  })
  it('grupo fora da ordem do config vai para o fim', () => {
    const novo = { setor: 'Novo setor', grupoB3: 'Novo grupo', empresas: [acao('NOVO3', 'Nova', 10, 1)] }
    const g = agruparPorGrupo([novo, ...snapshot.setores], ['Financeiro', 'Saúde'])
    expect(g.map((x) => x.grupo)).toEqual(['Financeiro', 'Novo grupo', 'Petróleo, Gás e Biocombustíveis', 'Materiais Básicos'])
  })
  it('busca por código, prefixo e nome sem acento; mínimo de 2 letras', () => {
    expect(buscarAcoes(snapshot.busca, 'petr4')[0].ticker).toBe('PETR4')
    expect(buscarAcoes(snapshot.busca, 'petrobras')[0].ticker).toBe('PETR4')
    expect(buscarAcoes(snapshot.busca, 'p')).toEqual([])
  })
  it('simula a compra com lotes de 100 e fracionário', () => {
    expect(simularCompraAcoes(5000, 38.5)).toEqual({ quantidade: 129, lotes: 1, fracionario: 29, investido: 4966.5, sobra: 33.5 })
    expect(simularCompraAcoes(10, 38.5)?.quantidade).toBe(0)
    expect(simularCompraAcoes(0, 10)).toBeNull()
  })
})

describe('SimuleAcoes', () => {
  it('mostra quantos setores e quantas empresas a lista tem', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByTestId('total-setores').textContent).toBe('3')
    expect(screen.getByTestId('total-empresas').textContent).toBe('5')
  })

  it('agrupa pelos setores da B3 (h2) e mostra cada setor com a contagem (h3)', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Petróleo, Gás e Biocombustíveis', 'Materiais Básicos', 'Financeiro'])
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Petróleo e gás (2)', 'Mineração (1)', 'Bancos (2)'])
    expect(screen.getAllByText('1 setor, 2 empresas')).toHaveLength(2)
    expect(screen.getByText('1 setor, 1 empresa')).toBeDefined()
  })

  it('abre com a primeira empresa: preço, variação e simulação padrão de R$ 5 mil', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    // primeira empresa na ordem dos setores do arquivo: ITUB4 (R$ 40)
    expect(screen.getByText('fechamento de 01/10/2026')).toBeDefined()
    expect(screen.getByText('+3,2%')).toBeDefined()
    expect(screen.getByText('125')).toBeDefined() // R$ 5.000 / R$ 40
    expect(screen.getByText('1 lote + 25 no fracionário')).toBeDefined()
  })

  it('troca de ação e recalcula com outro valor', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'BBAS3' }))
    expect(screen.getByText('−4,0%')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Outro valor em reais'), { target: { value: '1000' } })
    expect(screen.getByText('40')).toBeDefined() // R$ 1.000 / R$ 25
  })

  it('abre pela busca uma ação fora da lista, com o aviso e sem dados que ela não tem', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ação por código ou nome'), { target: { value: 'ABCD' } })
    fireEvent.click(within(screen.getByRole('list', { name: 'Ações encontradas' })).getByRole('button'))
    expect(screen.getByText('Fora da lista de setores.')).toBeDefined()
    expect(screen.getByText('fechamento de 29/09/2026')).toBeDefined()
    expect(screen.queryByText('Variação em 3 meses')).toBeNull()
  })

  it('busca de ação da lista abre o cartão completo', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ação por código ou nome'), { target: { value: 'petrobras' } })
    fireEvent.click(within(screen.getByRole('list', { name: 'Ações encontradas' })).getByRole('button'))
    expect(screen.getByText('Variação em 3 meses')).toBeDefined()
    expect(screen.getByRole('button', { name: 'PETR4', pressed: true })).toBeDefined()
  })

  it('avisa quando a busca não acha nada', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ação por código ou nome'), { target: { value: 'ZZZZ9' } })
    expect(screen.getByText(/Nenhuma ação encontrada/)).toBeDefined()
  })

  it('antes da primeira carga, avisa que os dados ainda não foram carregados', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, setores: [], busca: [] }} />)
    expect(screen.getByText('Os dados das ações ainda não foram carregados.')).toBeDefined()
  })

  it('volta ao Simule Ativos, sem barra de abas, e não faz ranking nem mostra múltiplos (D19)', () => {
    const { container } = render(<SimuleAcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('link', { name: '← Simule Ativos' }).getAttribute('href')).toBe('./?tela=simuleAtivos')
    expect(container.querySelector('.tabbar')).toBeNull()
    expect(screen.queryByText(/P\/L|lucro por ação|melhores|maior alta|recomendamos/i)).toBeNull()
  })
})
