import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarDividendos } from './RadarDividendos'
import { doMes, limitesDosMeses, mesInicial, rotuloDoMes, semDataDePagamento, somarMeses } from '../domain/radarDividendos'
import type { PagamentoAnunciado, SnapshotRadarDividendos } from '../domain/radarDividendos'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'

const pag = (ticker: string, mes: string | null, o: Partial<PagamentoAnunciado> = {}): PagamentoAnunciado => ({
  ticker, nome: `Empresa ${ticker}`, setor: 'Energia', tipo: 'DIVIDENDO', valor: 0.4715, dataCom: '2026-08-21',
  pagamentoEm: mes ? `${mes}-20` : null, aprovadoEm: '2026-08-06', referencia: 'Anual/2026', mes, ...o,
})

const snap = (pagamentos: PagamentoAnunciado[]): SnapshotRadarDividendos => ({
  publicado: true, geradoEm: '2026-10-29T12:00:00Z', dataReferencia: '2026-10-29', consultadas: 10, comPagamento: new Set(pagamentos.map((p) => p.ticker)).size, falhas: [], pagamentos,
})

const lista = [pag('BBBB3', '2026-12'), pag('AAAA3', null), pag('CCCC3', '2026-11', { nome: 'Cédula', dataCom: '2026-09-30' }), pag('AAAA3', '2026-11')]

describe('domínio da agenda', () => {
  it('rotuloDoMes e somarMeses', () => {
    expect(rotuloDoMes('2026-11')).toBe('Novembro de 2026')
    expect(somarMeses('2026-12', 1)).toBe('2027-01')
    expect(somarMeses('2026-01', -1)).toBe('2025-12')
  })

  it('doMes filtra pelo mês da base escolhida e pela busca (sem acento nem caixa)', () => {
    expect(doMes(lista, '2026-11', 'pagamento').map((p) => p.ticker)).toEqual(['AAAA3', 'CCCC3'])
    expect(doMes(lista, '2026-09', 'com').map((p) => p.ticker)).toEqual(['CCCC3'])
    expect(doMes(lista, '2026-11', 'pagamento', 'cedula').map((p) => p.ticker)).toEqual(['CCCC3'])
    expect(doMes(lista, '2026-11', 'pagamento', 'zzz')).toEqual([])
  })

  it('limites dos meses, mês inicial e pagamentos sem data', () => {
    expect(limitesDosMeses(lista, 'pagamento')).toEqual({ primeiro: '2026-11', ultimo: '2026-12' })
    expect(limitesDosMeses([], 'com')).toBeNull()
    expect(mesInicial(lista, 'pagamento', '2026-10-29')).toBe('2026-11') // antes do primeiro: abre no primeiro
    expect(mesInicial(lista, 'pagamento', '2026-12-02')).toBe('2026-12')
    expect(semDataDePagamento(lista).map((p) => p.ticker)).toEqual(['AAAA3'])
  })
})

describe('RadarDividendos (Agenda de dividendos)', () => {
  it('abre no mês de hoje e mostra valor por ação, tipo, data com e data de pagamento', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-10', { valor: 0.6741, tipo: 'JRS CAP PROPRIO' }), pag('VALE3', '2026-12')])} hoje="2026-10-29" />)
    expect(screen.getByTestId('radar-mes-atual').textContent).toBe('Outubro de 2026')
    const lista = screen.getByTestId('radar-lista')
    expect(within(lista).getByText(/JCP \(bruto\)/)).toBeTruthy()
    expect(within(lista).getByText(/R\$\s*0,6741/)).toBeTruthy()
    expect(within(lista).getByText(/Pagamento 20\/10\/2026/)).toBeTruthy()
    expect(within(lista).getByText(/Data com 21\/08\/2026/)).toBeTruthy()
    expect(screen.queryByText('VALE3')).toBeNull()
  })

  it('as setas navegam de mês e travam nos limites', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-10'), pag('VALE3', '2026-12')])} hoje="2026-10-29" />)
    expect((screen.getByLabelText('Mês anterior') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Próximo mês'))
    expect(screen.getByTestId('radar-mes-atual').textContent).toBe('Novembro de 2026')
    expect(screen.getByText(/Nenhum pagamento em novembro de 2026/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Próximo mês'))
    expect(screen.getAllByText(/VALE3/).length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Próximo mês') as HTMLButtonElement).disabled).toBe(true)
  })

  it('trocar para "Data com" reorganiza pelo mês da data com', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-11', { dataCom: '2026-10-15' }), pag('VALE3', '2026-10', { dataCom: '2026-09-10' })])} hoje="2026-10-29" />)
    expect(screen.getByTestId('radar-mes-atual').textContent).toBe('Outubro de 2026')
    expect(within(screen.getByTestId('radar-lista')).queryByText(/PETR4/)).toBeNull() // paga em novembro
    fireEvent.click(screen.getByRole('button', { name: 'Data com' }))
    expect(within(screen.getByTestId('radar-lista')).getAllByText(/PETR4/).length).toBeGreaterThan(0) // data com em outubro
  })

  it('avisa quando ainda dá tempo de ter direito (data com futura)', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-11', { dataCom: '2026-11-05' })])} hoje="2026-10-29" />)
    expect(screen.getByTestId('radar-linha').textContent).toContain('ainda dá tempo')
  })

  it('pagamento sem data vai para o grupo à parte, e cada linha tem o logo ou o selo da empresa', () => {
    render(<RadarDividendos snapshot={snap([pag('ARML3', null), pag('PETR4', '2026-10')])} hoje="2026-10-29" />)
    expect(within(screen.getByTestId('radar-sem-data')).getAllByText(/ARML3/).length).toBeGreaterThan(0)
    expect(screen.queryAllByTestId('logo-ativo-selo').length + screen.queryAllByTestId('logo-ativo').length).toBe(2)
  })

  it('filtra por código e mostra aviso quando nada bate', () => {
    render(<RadarDividendos snapshot={snap([pag('PETR4', '2026-10'), pag('VALE3', '2026-10')])} hoje="2026-10-29" />)
    fireEvent.change(screen.getByLabelText('Filtrar a agenda por código ou nome'), { target: { value: 'vale' } })
    expect(screen.getAllByTestId('radar-linha')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Filtrar a agenda por código ou nome'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhum pagamento para essa busca/)).toBeTruthy()
  })

  it('sem pagamentos mostra o estado vazio', () => {
    render(<RadarDividendos snapshot={snap([])} />)
    expect(screen.getByTestId('radar-dividendos-vazio')).toBeTruthy()
  })

  it('dados reais publicados: valor não negativo e meses coerentes com as datas', () => {
    for (const p of SNAPSHOT_RADAR_DIVIDENDOS.pagamentos) {
      expect(p.valor).toBeGreaterThanOrEqual(0)
      expect(p.mes).toBe(p.pagamentoEm ? p.pagamentoEm.slice(0, 7) : null)
    }
  })
})
