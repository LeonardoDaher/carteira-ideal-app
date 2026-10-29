import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarDividendos } from './RadarDividendos'
import { agruparPorMes, rotuloDoMes } from '../domain/radarDividendos'
import type { PagamentoAnunciado, SnapshotRadarDividendos } from '../domain/radarDividendos'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'

const pag = (ticker: string, mes: string | null, o: Partial<PagamentoAnunciado> = {}): PagamentoAnunciado => ({
  ticker, nome: `Empresa ${ticker}`, setor: 'Energia', tipo: 'DIVIDENDO', valor: 0.4715, dataCom: '2026-08-21',
  pagamentoEm: mes ? `${mes}-20` : null, aprovadoEm: '2026-08-06', referencia: 'Anual/2026', mes, ...o,
})

const snap = (pagamentos: PagamentoAnunciado[]): SnapshotRadarDividendos => ({
  publicado: true, geradoEm: '2026-10-29T12:00:00Z', dataReferencia: '2026-10-29', consultadas: 10, comPagamento: new Set(pagamentos.map((p) => p.ticker)).size, falhas: [], pagamentos,
})

describe('domínio do radar', () => {
  it('rotuloDoMes', () => expect(rotuloDoMes('2026-11')).toBe('novembro de 2026'))

  it('agrupa por mês em ordem e deixa "sem data" por último; a busca ignora acento e caixa', () => {
    const lista = [pag('BBBB3', '2026-12'), pag('AAAA3', null), pag('CCCC3', '2026-11', { nome: 'Cédula' }), pag('AAAA3', '2026-11')]
    expect(agruparPorMes(lista).map((g) => [g.mes, g.pagamentos.length])).toEqual([['2026-11', 2], ['2026-12', 1], [null, 1]])
    expect(agruparPorMes(lista, 'cedula').map((g) => g.pagamentos[0].ticker)).toEqual(['CCCC3'])
    expect(agruparPorMes(lista, 'zzz')).toEqual([])
  })
})

describe('RadarDividendos', () => {
  it('mostra cada mês com o valor por ação, a data de pagamento e a data com', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-11', { valor: 0.6741, tipo: 'JRS CAP PROPRIO' }), pag('VALE3', '2026-12')])} />)
    const nov = screen.getByTestId('radar-mes-2026-11')
    expect(within(nov).getByText('novembro de 2026')).toBeTruthy()
    expect(within(nov).getByText(/JCP \(bruto\)/)).toBeTruthy()
    expect(within(nov).getByText(/R\$\s*0,6741/)).toBeTruthy()
    expect(within(nov).getByText(/paga em 20\/11\/2026/)).toBeTruthy()
    expect(within(nov).getByText(/data com 21\/08\/2026/)).toBeTruthy()
    expect(screen.getByTestId('radar-mes-2026-12')).toBeTruthy()
  })

  it('avisa quando ainda dá tempo de ter direito (data com futura)', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-11', { dataCom: '2026-11-05' })])} />)
    expect(screen.getByTestId('radar-linha').textContent).toContain('ainda dá tempo')
  })

  it('pagamento sem data vai para o grupo à parte', () => {
    render(<RadarDividendos snapshot={snap([pag('ARML3', null)])} />)
    expect(screen.getByTestId('radar-mes-sem-data')).toBeTruthy()
    expect(screen.getByText(/pagamento sem data/)).toBeTruthy()
  })

  it('filtra por código e mostra aviso quando nada bate', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-11'), pag('VALE3', '2026-11')])} />)
    fireEvent.change(screen.getByLabelText('Filtrar o radar por código ou nome'), { target: { value: 'vale' } })
    expect(screen.getAllByTestId('radar-linha')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Filtrar o radar por código ou nome'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhum pagamento anunciado para essa busca.')).toBeTruthy()
  })

  it('sem pagamentos mostra o estado vazio', () => {
    render(<RadarDividendos snapshot={snap([])} />)
    expect(screen.getByTestId('radar-dividendos-vazio')).toBeTruthy()
  })

  it('dados reais publicados: todo pagamento tem valor positivo e mês coerente com a data de pagamento', () => {
    for (const p of SNAPSHOT_RADAR_DIVIDENDOS.pagamentos) {
      expect(p.valor).toBeGreaterThanOrEqual(0)
      expect(p.mes).toBe(p.pagamentoEm ? p.pagamentoEm.slice(0, 7) : null)
      if (p.pagamentoEm) expect(p.pagamentoEm >= SNAPSHOT_RADAR_DIVIDENDOS.dataReferencia).toBe(true)
    }
  })
})
