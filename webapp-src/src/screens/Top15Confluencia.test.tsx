import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Top15Confluencia } from './Top15Confluencia'
import type { ItemConfluencia, RankingConfluencia } from '../domain/confluenciaRanking'
import type { Confluencia } from '../domain/confluencia'

const mock = vi.hoisted(() => ({ ranking: vi.fn() }))
vi.mock('../domain/confluenciaRanking', () => ({ rankingDeConfluencia: mock.ranking }))

function item(i: number, nota: number): ItemConfluencia {
  const ticker = `AC${i}`
  const c = {
    pontuacao: { valor: nota }, conviccao: 'alta', leitura: 'Leitura de teste.',
    fundamentalista: { nota: nota, rotulo: 'Atrativa', detalhe: 'Nota.' }, tecnica: { nota: nota, rotulo: 'Altista', detalhe: 'Pontuação.' },
  } as unknown as Confluencia
  return { posicao: i, ticker, nome: `Empresa ${i}`, preco: 10 + i, confluencia: c }
}

const ranking = (np: number, nn: number): RankingConfluencia => ({
  horizonte: 'medio', avaliadas: 100, semAnalise: 5, semLiquidez: 2,
  positivas: Array.from({ length: np }, (_, i) => item(i + 1, 90 - i)),
  negativas: Array.from({ length: nn }, (_, i) => item(i + 1, 20 + i)),
})

const props = { precoDe: () => 10, dataPregao: '2026-10-23', series: {} as never, fundamentos: {} as never }

describe('Top 15 confluência', () => {
  beforeEach(() => mock.ranking.mockReset())

  it('mostra 15 positivas e esconde o resto até o Ver mais', () => {
    mock.ranking.mockReturnValue(ranking(20, 3))
    render(<Top15Confluencia {...props} />)
    expect(screen.getByTestId('top15-confluencia-AC15')).toBeTruthy()
    expect(screen.queryByTestId('top15-confluencia-AC16')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais' }))
    expect(screen.getByTestId('top15-confluencia-AC20')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }))
    expect(screen.queryByTestId('top15-confluencia-AC16')).toBeNull()
  })

  it('alterna entre positivas e negativas', () => {
    mock.ranking.mockReturnValue(ranking(20, 3))
    render(<Top15Confluencia {...props} />)
    expect(screen.getByRole('heading').textContent).toContain('positiva')
    fireEvent.click(screen.getByRole('button', { name: /Negativas \(3\)/ }))
    expect(screen.getByRole('heading').textContent).toContain('negativa')
    expect(screen.getByTestId('nota-AC1').textContent).toBe('20')
    expect(screen.queryByRole('button', { name: 'Ver mais' })).toBeNull()
  })

  it('troca o horizonte e recalcula; lista vazia avisa', () => {
    mock.ranking.mockReturnValue(ranking(0, 0))
    render(<Top15Confluencia {...props} />)
    expect(screen.getByTestId('top15-confluencia-vazio')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Longo prazo' }))
    expect(mock.ranking).toHaveBeenLastCalledWith(expect.objectContaining({ horizonte: 'longo' }))
  })
})
