import { describe, expect, it } from 'vitest'
import { calcularTopMontagens, vencimentoPadraoMontagem, vencimentosDeMontagem } from './montagensComCredito'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'

const V = '2026-12-18'
const s = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number, negocios = 10): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento: V, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios, volume: 1000,
})
const ativo = (ticker: string, cotacao: number, series: SerieOpcao[]): AtivoComOpcoes => ({ ticker, nome: ticker, cotacao, volumeOpcoes: 1, lote: 100, series })
const R = Math.log(1.14)

const petr = ativo('PETR4', 60, [s('C64', 'call', 64, 2), s('C66', 'call', 66, 0.8), s('P54', 'put', 54, 1), s('P56', 'put', 56, 1.5)])

describe('montagens com crédito', () => {
  it('alta: vende put e compra call recebendo, com margem dos dois lados', () => {
    const [l] = calcularTopMontagens([petr], 'alta', V, '2026-10-16', R)
    expect(`${l.compra.codigo}/${l.venda.codigo}`).toBe('C66/P56')
    expect(l.saldo).toBe(0.7)
    expect(l.creditoLote).toBe(70)
    expect(l.retorno).toBe(1.25)
    expect(l.margemQueda).toBeGreaterThanOrEqual(5)
    expect(l.margemAlta).toBeGreaterThanOrEqual(5)
  })
  it('baixa: vende call e compra put', () => {
    const [l] = calcularTopMontagens([petr], 'baixa', V, '2026-10-16', R)
    expect(`${l.compra.codigo}/${l.venda.codigo}`).toBe('P54/C64')
    expect(l.retorno).toBe(1.56)
  })
  it('ignora séries com poucos negócios, margem curta e pares sem crédito; um por ativo, em ordem de retorno', () => {
    const pouco = ativo('VALE3', 60, [s('C66', 'call', 66, 0.8, 2), s('P56', 'put', 56, 1.5, 2)])
    const curto = ativo('ITUB4', 60, [s('C61', 'call', 61, 0.8), s('P59', 'put', 59, 1.5)])
    const semCredito = ativo('BBAS3', 60, [s('C64', 'call', 64, 3), s('P56', 'put', 56, 1)])
    const bom2 = ativo('ABEV3', 60, [s('C66', 'call', 66, 0.5), s('P54', 'put', 54, 0.7)])
    const r = calcularTopMontagens([pouco, curto, semCredito, bom2, petr], 'alta', V, '2026-10-16', R)
    expect(r.map((x) => x.ativo.ticker)).toEqual(['PETR4', 'ABEV3'])
  })
  it('lista vencimentos e escolhe o mensal padrão', () => {
    const v = vencimentosDeMontagem([petr], '2026-10-16')
    expect(v).toEqual([V])
    expect(vencimentoPadraoMontagem(v, '2026-10-16')).toBe(V)
  })
})
