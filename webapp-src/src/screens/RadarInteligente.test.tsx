import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarInteligente } from './RadarInteligente'
import { AgendaDeDividendos } from './AgendaDeDividendos'
import { atrasoEmMeses, montarGrade } from '../domain/radarInteligente'
import type { EmpresaDoRadar, SnapshotRadarInteligente } from '../domain/radarInteligente'
import type { PagamentoAnunciado } from '../domain/radarDividendos'
import { SNAPSHOT_RADAR_INTELIGENTE } from '../data/snapshotRadarInteligente'

const meses = (...m: number[]) => Array.from({ length: 12 }, (_, i) => (m.includes(i + 1) ? 3 : 0))
const emp = (ticker: string, m: number[], o: Partial<EmpresaDoRadar> = {}): EmpresaDoRadar => ({ ticker, nome: `Empresa ${ticker}`, setor: 'Energia', meses: meses(...m), anosComHistorico: 3, ...o })
const radar = (empresas: EmpresaDoRadar[]): SnapshotRadarInteligente => ({ publicado: true, geradoEm: null, dataReferencia: '2026-10-29', anos: 3, minimoDeAnos: 2, consultadas: empresas.length, falhas: [], empresas })
const pag = (ticker: string, dataCom: string, pagamentoEm: string | null): PagamentoAnunciado => ({
  ticker, nome: `Empresa ${ticker}`, setor: 'Energia', tipo: 'DIVIDENDO', valor: 0.5, dataCom, pagamentoEm, aprovadoEm: null, referencia: null, mes: pagamentoEm ? pagamentoEm.slice(0, 7) : null,
})
const HOJE = '2026-10-29'

describe('montarGrade', () => {
  it('provável só para o que ainda vem; passado sem anúncio fica vazio', () => {
    const [l] = montarGrade({ radar: radar([emp('PETR4', [3, 11])]), agenda: [], ano: 2026, base: 'com', hoje: HOJE })
    expect(l.celulas[2]).toBeNull() // março já passou
    expect(l.celulas[10]).toEqual({ status: 'provavel', anos: 3 })
  })

  it('anunciado vira confirmado (futuro) ou pago (passado), e vence o provável', () => {
    const agenda = [pag('PETR4', '2026-11-05', '2026-12-10'), pag('PETR4', '2026-03-05', '2026-04-10')]
    const [l] = montarGrade({ radar: radar([emp('PETR4', [11])]), agenda, ano: 2026, base: 'com', hoje: HOJE })
    expect(l.celulas[10]).toEqual({ status: 'confirmado' })
    expect(l.celulas[2]).toEqual({ status: 'pago' })
    const [p] = montarGrade({ radar: radar([emp('PETR4', [11])]), agenda, ano: 2026, base: 'pagamento', hoje: HOJE })
    expect(p.celulas[11]).toEqual({ status: 'confirmado' })
    expect(p.celulas[3]).toEqual({ status: 'pago' })
  })

  it('mês com pagamento em só 1 dos anos não é provável (mínimo 2)', () => {
    const e = emp('PETR4', [], { meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2] })
    const [l] = montarGrade({ radar: radar([e]), agenda: [], ano: 2026, base: 'com', hoje: HOJE })
    expect(l.celulas[10]).toBeNull()
    expect(l.celulas[11]).toEqual({ status: 'provavel', anos: 2 })
  })

  it('na visão por pagamento o provável é deslocado pelo prazo costumeiro da empresa', () => {
    const agenda = [pag('PETR4', '2026-02-01', '2026-03-05')] // prazo de ~1 mês
    const [l] = montarGrade({ radar: radar([emp('PETR4', [11])]), agenda, ano: 2026, base: 'pagamento', hoje: HOJE })
    expect(l.celulas[10]).toBeNull()
    expect(l.celulas[11]).toEqual({ status: 'provavel', anos: 3 })
    expect(atrasoEmMeses(agenda).porTicker.get('PETR4')).toBe(1)
  })

  it('filtra por setor e por busca; ano passado não tem provável', () => {
    const r = radar([emp('PETR4', [11], { setor: 'Petróleo' }), emp('VALE3', [11], { nome: 'Vale Mineração', setor: 'Mineração' })])
    expect(montarGrade({ radar: r, agenda: [], ano: 2026, base: 'com', hoje: HOJE, setor: 'Mineração' }).map((l) => l.ticker)).toEqual(['VALE3'])
    expect(montarGrade({ radar: r, agenda: [], ano: 2026, base: 'com', hoje: HOJE, busca: 'mineracao' }).map((l) => l.ticker)).toEqual(['VALE3'])
    expect(montarGrade({ radar: r, agenda: [], ano: 2025, base: 'com', hoje: HOJE })).toEqual([])
  })
})

describe('RadarInteligente', () => {
  it('mostra a grade com logo/selo, meses e a legenda; avisa que é projeção sem valor', () => {
    render(<RadarInteligente radar={radar([emp('PETR4', [11]), emp('VALE3', [12])])} agenda={[pag('PETR4', '2026-11-05', '2026-12-10')]} hoje={HOJE} />)
    expect(screen.getByTestId('radar-inteligente-ano').textContent).toBe('2026')
    const petr = screen.getByTestId('radar-linha-PETR4')
    expect(within(petr).getAllByTestId('celula-confirmado')).toHaveLength(1)
    expect(within(screen.getByTestId('radar-linha-VALE3')).getAllByTestId('celula-provavel')).toHaveLength(1)
    expect(screen.getByText(/não estima o valor/)).toBeTruthy()
    expect(within(petr).getByTitle('Anunciado pela empresa em Nov')).toBeTruthy()
  })

  it('trocar para Data pagamento move o anunciado para o mês do pagamento', () => {
    render(<RadarInteligente radar={radar([emp('PETR4', [])])} agenda={[pag('PETR4', '2026-11-05', '2026-12-10')]} hoje={HOJE} />)
    expect(within(screen.getByTestId('radar-linha-PETR4')).getByTitle('Anunciado pela empresa em Nov')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Data pagamento' }))
    expect(within(screen.getByTestId('radar-linha-PETR4')).getByTitle('Anunciado pela empresa em Dez')).toBeTruthy()
  })

  it('setas de ano ficam entre o ano atual e o seguinte; filtro sem resultado avisa', () => {
    render(<RadarInteligente radar={radar([emp('PETR4', [11])])} agenda={[]} hoje={HOJE} />)
    expect((screen.getByLabelText('Ano anterior') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Próximo ano'))
    expect(screen.getByTestId('radar-inteligente-ano').textContent).toBe('2027')
    expect((screen.getByLabelText('Próximo ano') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Filtrar o radar inteligente por código ou nome'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Nenhuma empresa para esse filtro/)).toBeTruthy()
  })

  it('sem dados mostra o estado em preparação', () => {
    render(<RadarInteligente radar={radar([])} agenda={[]} hoje={HOJE} />)
    expect(screen.getByTestId('radar-inteligente-vazio')).toBeTruthy()
  })

  it('dados reais publicados: 12 meses por empresa, contagens dentro do limite de anos', () => {
    for (const e of SNAPSHOT_RADAR_INTELIGENTE.empresas) {
      expect(e.meses).toHaveLength(12)
      for (const n of e.meses) expect(n).toBeLessThanOrEqual(SNAPSHOT_RADAR_INTELIGENTE.anos)
    }
  })
})

describe('AgendaDeDividendos (dois cartões)', () => {
  it('abre na agenda e alterna para o radar inteligente', () => {
    render(<AgendaDeDividendos />)
    const abas = within(screen.getByRole('tablist', { name: 'Agenda ou radar' })).getAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual([expect.stringContaining('Agenda de dividendos'), expect.stringContaining('Radar de dividendos inteligente')])
    expect(screen.getByTestId('radar-dividendos')).toBeTruthy()
    fireEvent.click(abas[1])
    expect(screen.getByTestId('radar-inteligente')).toBeTruthy()
    expect(screen.queryByTestId('radar-dividendos')).toBeNull()
  })
})
