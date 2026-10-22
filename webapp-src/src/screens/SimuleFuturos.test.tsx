import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleFuturos } from './SimuleFuturos'
import type { AppCtx } from '../state/useAppState'
import type { Candle, ProdutoFuturo, SnapshotFuturos } from '../domain/futuros'

const ctx = { screen: 'simuleFuturos', setScreen: vi.fn() } as unknown as AppCtx

const serie = (n: number): Candle[] =>
  Array.from({ length: n }, (_, i) => [`2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, 130_000 + i * 100, 130_200 + i * 100, 129_900 + i * 100, 130_100 + i * 100, 1000 + i])

const win: ProdutoFuturo = {
  codigo: 'WIN', apelido: 'WINFUT', nome: 'Mini índice', grupo: 'Índice', tipo: 'pontos', multiplicador: 0.2, moeda: 'BRL', tick: 5,
  especificacao: 'R$ 0,20 por ponto.', vertice: 'WINZ26',
  contratos: [
    { ticker: 'WINV26', vencimento: '2026-10', ajuste: 130_000, ajusteAnterior: 129_500, abertura: null, maxima: null, minima: null, ultimo: null, volume: null, posicaoAberta: 100 },
    { ticker: 'WINZ26', vencimento: '2026-12', ajuste: 131_000, ajusteAnterior: 130_000, abertura: 130_500, maxima: 131_500, minima: 130_000, ultimo: 131_000, volume: 5000, posicaoAberta: 900 },
  ],
  serie: serie(100),
}

const di: ProdutoFuturo = {
  codigo: 'DI1', apelido: 'DI1FUT', nome: 'Juros (DI de 1 dia)', grupo: 'Juros', tipo: 'taxa', multiplicador: 1, moeda: 'BRL', tick: 0.005,
  especificacao: 'R$ 100.000 no vencimento.', vertice: 'DI1F28',
  contratos: [{ ticker: 'DI1F28', vencimento: '2028-01', ajuste: 82_000, ajusteAnterior: 81_900, abertura: 12.5, maxima: 12.6, minima: 12.4, ultimo: 12.5, volume: 100, posicaoAberta: 5000 }],
  serie: serie(100).map((c) => [c[0], 12, 12.5, 11.5, 12.2, 10] as Candle),
}

const snapshot: SnapshotFuturos = { geradoEm: '2026-10-22T01:05:00Z', dataPregao: '2026-10-21', fonte: 'B3', pregoesNoHistorico: 100, produtos: [win, di] }

describe('SimuleFuturos', () => {
  it('sem dados, avisa que ainda não carregou', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={{ ...snapshot, produtos: [] }} />)
    expect(screen.getByText(/ainda não foram carregados/i)).toBeTruthy()
  })

  it('volta ao hub Simule Ativos', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('link', { name: '← Simule Ativos' }).getAttribute('href')).toBe('./?tela=simuleAtivos')
  })

  it('mostra um botão por contínuo e começa pelo vencimento mais líquido', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('button', { name: 'WINFUT' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'DI1FUT' })).toBeTruthy()
    expect((screen.getByLabelText('Vencimento') as HTMLSelectElement).value).toBe('WINZ26')
  })

  it('simula o mini índice: comprado, de 131.000 para 132.000 em 1 contrato = +R$ 200,00', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Preço de saída'), { target: { value: '132000' } })
    expect(screen.getByRole('status').textContent).toContain('200,00')
  })

  it('o DI mostra a regra: comprado ganha com a queda da taxa', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'DI1FUT' }))
    expect(screen.getByText(/ganha se a taxa/i).textContent).toContain('cai')
  })

  it('a aba Tendência mostra o gráfico e a leitura', () => {
    render(<SimuleFuturos ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Tendência/ }))
    expect(screen.getByRole('img', { name: /Gráfico de candles de WINFUT/ })).toBeTruthy()
    expect(screen.getByText('Alta')).toBeTruthy()
  })

  it('com histórico curto, avisa em vez de desenhar', () => {
    const curto = { ...snapshot, produtos: [{ ...win, serie: serie(30) }] }
    render(<SimuleFuturos ctx={ctx} snapshot={curto} />)
    fireEvent.click(screen.getByRole('tab', { name: /Tendência/ }))
    expect(screen.getByText(/Histórico ainda curto/)).toBeTruthy()
  })
})
