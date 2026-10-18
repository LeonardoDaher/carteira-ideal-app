import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FaixaCotacoes } from './FaixaCotacoes'
import { montarCotacoes } from '../../../api/_cotacoes'
import type { SnapshotAcoes } from '../domain/acoes'

const snapshot = {
  dataPregao: '2026-10-16',
  setores: [{ setor: 'Petróleo e gás', empresas: [{ ticker: 'PETR4', nome: 'Petrobras', cotacao: 38.5, volumeMedio: 1e9 }] }],
} as unknown as SnapshotAcoes

afterEach(() => vi.unstubAllGlobals())

describe('FaixaCotacoes', () => {
  it('sem fonte ao vivo, mostra o último fechamento', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem rede')))
    render(<FaixaCotacoes snapshot={snapshot} />)
    expect((await screen.findAllByText('PETR4')).length).toBeGreaterThan(0)
    expect(screen.getByText(/fechamento de/)).toBeTruthy()
  })

  it('com a fonte ao vivo, mostra Ibovespa e dólar', async () => {
    const corpo = {
      atualizadoEm: '2026-10-19T14:00:00Z',
      itens: [
        { rotulo: 'Ibovespa', valor: 130000, variacao: 0.5, tipo: 'indice' },
        { rotulo: 'Dólar', valor: 5.4321, variacao: -0.2, tipo: 'moeda' },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => corpo }))
    render(<FaixaCotacoes snapshot={snapshot} />)
    expect((await screen.findAllByText('Ibovespa')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('R$ 5,4321').length).toBeGreaterThan(0)
  })
})

describe('montarCotacoes', () => {
  it('descarta o que a fonte não devolve e mantém o resto', async () => {
    const busca = vi.fn(async (url: string) => {
      if (url.includes('PETR4')) return { ok: true, json: async () => ({ results: [{ regularMarketPrice: 38.5, regularMarketChangePercent: 1.2 }] }) }
      if (url.includes('currency')) return { ok: true, json: async () => ({ currency: [{ bidPrice: '5.43', percentageChange: '-0.1' }] }) }
      return { ok: false, json: async () => ({}) }
    })
    const r = await montarCotacoes(busca, 'tok', new Date('2026-10-19T14:00:00Z'))
    expect(r.itens.map((i) => i.rotulo)).toEqual(['Dólar', 'PETR4'])
    expect(busca.mock.calls.every(([u]) => u.includes('token=tok'))).toBe(true)
  })
})
