import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, premio: number): SerieOpcao => ({
  codigo, tipo, strike, vencimento, premio, negocios: 10, volume: 50_000,
})

// Formato do pregão real de 16/10/2026 (COTAHIST da B3), com poucas séries.
const snapshot: SnapshotOpcoes = {
  geradoEm: '2026-10-17T15:00:00Z',
  dataPregao: '2026-10-16',
  fonte: 'COTAHIST diário da B3',
  ativos: [
    {
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, volumeOpcoes: 9_000_000,
      series: [
        serie('PETRK550', 'call', 55, '2026-11-20', 6.1),
        serie('PETRK600', 'call', 60, '2026-11-20', 2.8),
        serie('PETRK650', 'call', 65, '2026-11-20', 0.9),
        serie('PETRW600', 'put', 60, '2026-11-20', 2.2),
        serie('PETRL600', 'call', 60, '2026-12-18', 4.1),
      ],
    },
    { ticker: 'VALE3', nome: 'VALE', cotacao: 66, volumeOpcoes: 5_000_000, series: [serie('VALEK660', 'call', 66, '2026-11-20', 3.3)] },
  ],
}

const linhas = () => screen.queryAllByTestId('serie-opcao')
const txt = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')
const codigos = () => linhas().map((l) => within(l).getAllByText(/^[A-Z]{4}[A-Z]\d+$/)[0].textContent)

describe('SimuleOpcoes: séries da B3', () => {
  it('abre no primeiro ativo, com todas as séries, e volta ao hub', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('link', { name: '← Simule Ativos' }).getAttribute('href')).toBe('./?tela=simuleAtivos')
    expect(screen.getByText('5 séries de PETR4')).toBeDefined()
    expect(codigos()).toEqual(['PETRK550', 'PETRK600', 'PETRK650', 'PETRW600', 'PETRL600'])
  })

  it('filtra por faixa de strike (mínimo e máximo)', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    const min = screen.getByLabelText('Strike mínimo')
    fireEvent.focus(min)
    fireEvent.change(min, { target: { value: '58' } })
    fireEvent.blur(min)
    expect(screen.getByText('4 séries de PETR4')).toBeDefined()
    expect(codigos()).toEqual(['PETRK600', 'PETRK650', 'PETRW600', 'PETRL600'])

    const max = screen.getByLabelText('Strike máximo')
    fireEvent.focus(max)
    fireEvent.change(max, { target: { value: '60' } })
    fireEvent.blur(max)
    expect(screen.getByText('3 séries de PETR4')).toBeDefined()
    expect(codigos()).not.toContain('PETRK650')
  })

  it('atalho "perto do preço" usa ±% do fechamento e "Limpar filtros" desfaz', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±5%)' })) // 57 a 63
    expect(codigos().sort()).toEqual(['PETRK600', 'PETRL600', 'PETRW600'])
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±10%)' })) // 54 a 66
    expect(linhas()).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±5%)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(linhas()).toHaveLength(5)
  })

  it('combina strike com tipo e vencimento', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Só calls' }))
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±5%)' }))
    expect(codigos()).toEqual(['PETRK600'])
  })

  it('avisa quando o mínimo passa do máximo e quando nenhuma série atende', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    const min = screen.getByLabelText('Strike mínimo')
    fireEvent.focus(min)
    fireEvent.change(min, { target: { value: '90' } })
    fireEvent.blur(min)
    expect(screen.getByText('0 séries de PETR4')).toBeDefined()
    expect(screen.getByText('Nenhuma série nessa faixa.')).toBeDefined()
    const max = screen.getByLabelText('Strike máximo')
    fireEvent.focus(max)
    fireEvent.change(max, { target: { value: '50' } })
    fireEvent.blur(max)
    expect(screen.getByText('O strike mínimo é maior que o máximo.')).toBeDefined()
  })

  it('trocar de ativo zera os filtros', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Só puts' }))
    expect(linhas()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'VALE3' }))
    expect(screen.getByText('1 série de VALE3')).toBeDefined()
    expect(codigos()).toEqual(['VALEK660'])
  })

  it('sem dados, mostra o aviso de que ainda não foram carregados', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, ativos: [] }} />)
    expect(screen.getByText('Os dados de opções ainda não foram carregados.')).toBeDefined()
  })
})

describe('SimuleOpcoes: estratégias', () => {
  const abrirEstrategias = () => fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))

  it('compra de call padrão: perda limitada ao prêmio, ganho sem limite e equilíbrio em strike + prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(txt('perda-maxima')).toBe('−R$ 150,00')
    expect(txt('ganho-maximo')).toBe('Sem limite')
    expect(txt('equilibrio')).toBe('R$ 31,50')
  })

  it('venda coberta e trava de alta têm ganho limitado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Trava de alta' }))
    // 100 opções, compra 30 por 1,50 e vende 33 por 0,60: débito 90, ganho máximo 210
    expect(txt('ganho-maximo')).toBe('R$ 210,00')
    expect(txt('perda-maxima')).toBe('−R$ 90,00')
    fireEvent.click(screen.getByRole('button', { name: 'Venda coberta' }))
    expect(txt('ganho-maximo')).not.toBe('Sem limite')
    expect(screen.getByText(/Precisa ter 100 ações/)).toBeDefined()
  })

  it('"Simular" numa série real leva à aba de estratégias já preenchida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Simular estratégia com PETRK600' }))
    expect(screen.getByText('PETRK600')).toBeDefined()
    expect((screen.getByLabelText('Strike') as HTMLInputElement).value).toBe('60,00')
    expect((screen.getByLabelText('Prêmio por opção') as HTMLInputElement).value).toBe('2,80')
    expect(txt('equilibrio')).toBe('R$ 62,80')
  })

  it('mostra as gregas e a passagem do tempo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.getByText(/Gregas da posição \(hoje\)/)).toBeDefined()
    fireEvent.change(screen.getByLabelText(/Passagem do tempo/), { target: { value: '10' } })
    expect(screen.getByText(/Gregas da posição \(daqui a 10 dias\)/)).toBeDefined()
    expect(screen.getByText(/o resultado nesse dia seria/)).toBeDefined()
  })

  it('trava com strikes invertidos pede correção em vez de calcular', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Trava de alta' }))
    const alto = screen.getByLabelText('Strike maior')
    fireEvent.focus(alto)
    fireEvent.change(alto, { target: { value: '20' } })
    fireEvent.blur(alto)
    expect(screen.getByText(/O strike maior precisa ser maior que o menor/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })
})
