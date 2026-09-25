import { describe, expect, it } from 'vitest'
import { aliquotaIr, lerValor, minimoDeCompra, projecaoDoAno, simulavel, simular, trechosPorAno } from './simulaTesouro'
import type { TituloTesouro } from './mercadoOficial'

const titulo = (p: Partial<TituloTesouro>): TituloTesouro => ({
  nome: 'Tesouro Prefixado 2028', tipo: 'Tesouro Prefixado', familia: 'Tesouro Prefixado', indexador: 'prefixado', tipoTaxa: 'nominal',
  cupom: 'sem cupom', vencimento: '2028-01-01', aVenda: true, taxaCompra: 10, puCompra: 820, taxaVenda: 10.1, puVenda: 815, ...p,
})
const FOCUS = { data: '2025-12-20', ipca: { 2026: 4.8, 2027: 4 }, selic: { 2026: 14, 2027: 12 } }
const BASE = { hojeIso: '2026-01-01', focus: FOCUS, selicHoje: 15 }

describe('regras', () => {
  it('IR regressivo pelo prazo', () => {
    expect([aliquotaIr(180), aliquotaIr(181), aliquotaIr(360), aliquotaIr(361), aliquotaIr(720), aliquotaIr(721)]).toEqual([22.5, 20, 20, 17.5, 17.5, 15])
  })
  it('só títulos sem cupom e à venda', () => {
    expect(simulavel(titulo({}))).toBe(true)
    expect(simulavel(titulo({ cupom: 'semestral' }))).toBe(false)
    expect(simulavel(titulo({ aVenda: false, taxaCompra: null }))).toBe(false)
    expect(simulavel(titulo({ familia: 'Tesouro Renda+', cupom: 'renda mensal' }))).toBe(false)
  })
  it('mínimo de compra: 1% do título, piso de R$ 30', () => {
    expect(minimoDeCompra(titulo({ puCompra: 820 }))).toBe(30)
    expect(minimoDeCompra(titulo({ puCompra: 17500 }))).toBe(175)
  })
  it('projeção repete o último ano depois do horizonte do Focus', () => {
    expect(projecaoDoAno({ 2026: 4.8, 2027: 4 }, 2035)).toBe(4)
    expect(projecaoDoAno({}, 2026)).toBeNull()
  })
  it('trechos por ano civil', () => {
    const t = trechosPorAno('2026-07-02', '2028-01-01')
    expect(t.map((x) => x.ano)).toEqual([2026, 2027])
    expect(t[0].fracao).toBeCloseTo(183 / 365)
    expect(t[1].fracao).toBe(1)
  })
  it('lê valor digitado', () => {
    expect(lerValor('R$ 5.000')).toBe(5000)
    expect(lerValor('')).toBe(0)
  })
})

describe('simular (contas conferidas à mão)', () => {
  it('Prefixado 10% por 2 anos: bruto, custódia, IR de 15% e líquido', () => {
    const r = simular(titulo({}), 10_000, BASE)!
    expect(r.dias).toBe(730)
    expect(r.bruto).toBeCloseTo(12_100, 2)
    // custódia: 0,2% sobre o valor médio de cada ano: 10.500 e 11.550
    expect(r.custodia).toBeCloseTo(44.1, 2)
    expect(r.aliquotaIr).toBe(15)
    expect(r.ir).toBeCloseTo((12_100 - 10_000 - 44.1) * 0.15, 1)
    expect(r.liquido).toBeCloseTo(12_100 - 44.1 - 308.385, 1)
    // em dinheiro de hoje: descontada a inflação do Focus (4,8% e 4%)
    expect(r.liquidoHoje).toBeCloseTo(r.liquido / (1.048 * 1.04), 1)
  })

  it('IPCA+: juro real composto com a inflação projetada; ganho real próximo da taxa menos custos', () => {
    const r = simular(titulo({ familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', taxaCompra: 7 }), 10_000, BASE)!
    expect(r.bruto).toBeCloseTo(10_000 * 1.07 * 1.048 * 1.07 * 1.04, 1)
    expect(r.ganhoRealAoAno).toBeGreaterThan(5)
    expect(r.ganhoRealAoAno).toBeLessThan(7)
  })

  it('Selic: média entre início e fim de cada ano mais o ágio; isento de custódia até R$ 10 mil', () => {
    const t = titulo({ familia: 'Tesouro Selic', indexador: 'selic', tipoTaxa: 'agioSobreSelic', taxaCompra: 0.05 })
    const r = simular(t, 5_000, BASE)!
    expect(r.bruto).toBeCloseTo(5_000 * 1.1455 * 1.1305, 1)
    expect(r.custodia).toBe(0)
    const grande = simular(t, 50_000, BASE)!
    expect(grande.custodia).toBeGreaterThan(0)
    // cobra só sobre o excedente de R$ 10 mil
    expect(grande.custodia).toBeLessThan(simular(titulo({ taxaCompra: 14.7 }), 50_000, BASE)!.custodia)
  })

  it('não simula título vencido, valor zero ou título com cupom', () => {
    expect(simular(titulo({ vencimento: '2025-12-31' }), 1000, BASE)).toBeNull()
    expect(simular(titulo({}), 0, BASE)).toBeNull()
    expect(simular(titulo({ cupom: 'semestral' }), 1000, BASE)).toBeNull()
  })
})
