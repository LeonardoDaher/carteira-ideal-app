// Units (D142): o preço de uma unit é o de várias ações, então todo valor "por ação" precisa estar na mesma base. Os testes usam os dados
// reais publicados para garantir que nenhuma unit do cadastro fique sem composição e que o teto saia na base do preço dela.
import { describe, expect, it } from 'vitest'
import fundamentosBruto from '../../public/dados/fundamentos.json?raw'
import { SNAPSHOT_ACOES } from '../data/snapshotAcoes'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { ACOES_POR_UNIT, acoesPorPapel, analisarFundamentos, valorDeMercado } from './analiseFundamentalista'
import type { EmpresaFundamentos, SnapshotFundamentos } from './analiseFundamentalista'
import { tetoGraham } from './precoTeto'
import { calcularItensPrecoTeto, mapaDePrecos, premissasDoSnapshotMercado } from './precoTetoLote'

const fundamentos = JSON.parse(fundamentosBruto) as SnapshotFundamentos
const precoDe = mapaDePrecos(SNAPSHOT_ACOES)
const premissas = premissasDoSnapshotMercado(SNAPSHOT_MERCADO)
const units = Object.values(fundamentos.empresas).filter((e) => e.ticker.endsWith('11'))

describe('units', () => {
  it('toda unit com fundamentos tem a composição cadastrada, e ação comum vale 1', () => {
    expect(units.length).toBeGreaterThan(0)
    expect(units.filter((e) => !(e.ticker in ACOES_POR_UNIT)).map((e) => e.ticker)).toEqual([])
    expect(acoesPorPapel('SAPR11')).toBe(5)
    expect(acoesPorPapel('SAPR4')).toBe(1)
  })

  it('o valor de mercado sem preço das classes não multiplica o preço da unit pelo número de ações', () => {
    const e = units.find((x) => x.ticker === 'SAPR11') as EmpresaFundamentos
    const completo = valorDeMercado(e, precoDe)
    const soUnit = valorDeMercado(e, (t) => (t === 'SAPR11' ? precoDe(t) : null))
    expect(soUnit.aproximado).toBe(true)
    // a aproximação fica na mesma ordem de grandeza (antes saía cerca de 5 vezes maior)
    expect((soUnit.valorMercado as number) / (completo.valorMercado as number)).toBeGreaterThan(0.7)
    expect((soUnit.valorMercado as number) / (completo.valorMercado as number)).toBeLessThan(1.3)
  })

  it('o teto de Graham da unit é o de uma ação vezes as ações que ela reúne', () => {
    const itens = calcularItensPrecoTeto({ fundamentos, precoDe, premissas, dyDe: (t) => SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[t] ?? null, taxa: 0.06 })
    for (const e of units) {
      const item = itens.get(e.ticker)
      const total = valorDeMercado(e, precoDe).acoes
      if (!item?.graham.teto || total === null) continue
      const porAcao = tetoGraham(e, total).teto as number
      expect(item.graham.teto, e.ticker).toBeCloseTo(porAcao * acoesPorPapel(e.ticker), 6)
    }
  })

  it('o preço da unit e o valor justo ficam na mesma base: o P/L do mercado bate com preço ÷ lucro por unit', () => {
    const todas = Object.values(fundamentos.empresas)
    for (const e of units) {
      const a = analisarFundamentos({ empresa: e, precoDe, todas, premissas, dyB3: null })
      const preco = precoDe(e.ticker)
      const lucro = e.ttm?.lucroControladores
      if (!a || preco === null || !lucro || lucro <= 0 || !a.mercado.acoes || !a.mercado.valorMercado) continue
      const plPorUnit = preco / ((lucro * 1000) / (a.mercado.acoes / a.mercado.porPapel))
      const plDoMercado = a.mercado.valorMercado / lucro
      // as classes e a unit negociam a preços parecidos por ação: as duas contas não podem divergir em várias vezes
      expect(plPorUnit / plDoMercado, e.ticker).toBeGreaterThan(0.6)
      expect(plPorUnit / plDoMercado, e.ticker).toBeLessThan(1.6)
    }
  })
})
