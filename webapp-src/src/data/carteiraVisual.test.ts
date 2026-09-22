import { describe, expect, it } from 'vitest'
import { carteiraParaExibicao } from './carteiraVisual'
import type { Carteira } from '../domain/types'

describe('carteiraParaExibicao', () => {
  it('soma Tesouro Selic, IPCA+ e Prefixado numa única chave (tesouroIPCA)', () => {
    const carteira: Carteira = { tesouroSelic: 10, tesouroIPCA: 20, tesouroPrefixado: 5, fiis: 20, acoesETFs: 45 }
    const exibicao = carteiraParaExibicao(carteira)
    expect(exibicao.tesouroIPCA).toBe(35)
    expect(exibicao.tesouroSelic).toBeUndefined()
    expect(exibicao.tesouroPrefixado).toBeUndefined()
    expect(exibicao.fiis).toBe(20)
    expect(exibicao.acoesETFs).toBe(45)
  })

  it('não altera a carteira original (imutável)', () => {
    const carteira: Carteira = { tesouroSelic: 10, tesouroIPCA: 20, fiis: 70 }
    carteiraParaExibicao(carteira)
    expect(carteira.tesouroSelic).toBe(10)
    expect(carteira.tesouroIPCA).toBe(20)
  })

  it('funciona quando só um dos três tipos de Tesouro está presente', () => {
    const carteira: Carteira = { tesouroSelic: 70, cdbLiquidez: 30 }
    const exibicao = carteiraParaExibicao(carteira)
    expect(exibicao.tesouroIPCA).toBe(70)
    expect(exibicao.tesouroSelic).toBeUndefined()
    expect(exibicao.cdbLiquidez).toBe(30)
  })

  it('mantém a soma total em 100', () => {
    const carteira: Carteira = { tesouroSelic: 10, tesouroIPCA: 20, tesouroPrefixado: 5, fiis: 20, acoesETFs: 45 }
    const exibicao = carteiraParaExibicao(carteira)
    const soma = Object.values(exibicao).reduce((s, v) => s + (v ?? 0), 0)
    expect(soma).toBe(100)
  })

  it('devolve a carteira como veio quando não há nenhum Tesouro', () => {
    const carteira: Carteira = { cdbLiquidez: 100 }
    expect(carteiraParaExibicao(carteira)).toEqual(carteira)
  })
})
