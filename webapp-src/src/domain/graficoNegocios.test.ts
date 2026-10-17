import { describe, expect, it } from 'vitest'
import { dadosNegociosPorStrike, distanciaDoPreco } from './graficoNegocios'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'

const HOJE = '2026-10-16'
const V1 = '2026-11-19'
const V2 = '2026-12-18'

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, negocios: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo, tipo, estilo: tipo === 'call' ? 'americana' : 'europeia', strike, vencimento, ultimo: 1, dataUltimo: HOJE, variacao: null, negocios, volume: negocios * 1000, ...extra,
})

const ativo: AtivoComOpcoes = {
  ticker: 'TESTE3', nome: 'TESTE', cotacao: 10, volumeOpcoes: 1, lote: 100,
  series: [
    serie('C900', 'call', 9, V1, 5),
    serie('P900', 'put', 9, V1, 7, { estilo: 'americana' }), // americana ou europeia: as duas contam
    serie('C1000', 'call', 10, V1, 30),
    serie('P1000', 'put', 10, V1, 20),
    serie('C1000X', 'call', 10, V1, 10), // ajustada: mesmo strike, mesmo tipo e vencimento: soma
    serie('C1100', 'call', 11, V1, 4),
    serie('C1000B', 'call', 10, V2, 8),
    serie('C1500', 'call', 15, V1, 99, { dataUltimo: '2026-10-15' }), // não negociou no último pregão: zero
    serie('C300', 'call', 3, V1, 50),
  ],
}

const linha = (d: ReturnType<typeof dadosNegociosPorStrike>, id: string) => d.linhas.find((l) => l.id === id)!

describe('dadosNegociosPorStrike', () => {
  it('separa calls e puts por vencimento, somando séries do mesmo strike, e alinha os valores aos strikes', () => {
    const d = dadosNegociosPorStrike(ativo, [V1], 'separados', 'negocios', HOJE, null)
    expect(d.strikes).toEqual([3, 9, 10, 11, 15])
    expect(d.linhas.map((l) => l.id)).toEqual([`${V1}-call`, `${V1}-put`])
    expect(linha(d, `${V1}-call`).valores).toEqual([50, 5, 40, 4, 0]) // C1000 + C1000X no strike 10; a de 15 não negociou hoje
    expect(linha(d, `${V1}-put`).valores).toEqual([0, 7, 20, 0, 0])
  })

  it('"soma" junta calls e puts; "calls" e "puts" mostram só um tipo', () => {
    const soma = dadosNegociosPorStrike(ativo, [V1], 'soma', 'negocios', HOJE, null)
    expect(soma.linhas).toHaveLength(1)
    expect(soma.linhas[0].valores).toEqual([50, 12, 60, 4, 0])
    expect(dadosNegociosPorStrike(ativo, [V1], 'calls', 'negocios', HOJE, null).linhas.map((l) => l.tipo)).toEqual(['call'])
    expect(dadosNegociosPorStrike(ativo, [V1], 'puts', 'negocios', HOJE, null).linhas[0].valores).toEqual([0, 7, 20, 0, 0])
  })

  it('várias vencimentos viram linhas separadas, em ordem de data, e o eixo une os strikes de todos', () => {
    const d = dadosNegociosPorStrike(ativo, [V2, V1], 'soma', 'negocios', HOJE, 30)
    expect(d.linhas.map((l) => l.vencimento)).toEqual([V1, V2])
    expect(d.strikes).toEqual([9, 10, 11]) // faixa de ±30% de 10: de 7 a 13; o strike 3 e o 15 ficam fora
    expect(linha(d, `${V2}-soma`).valores).toEqual([0, 8, 0])
  })

  it('a faixa em torno do preço corta os strikes, e null mostra todos', () => {
    expect(dadosNegociosPorStrike(ativo, [V1], 'soma', 'negocios', HOJE, 10).strikes).toEqual([9, 10, 11])
    expect(dadosNegociosPorStrike(ativo, [V1], 'soma', 'negocios', HOJE, null).strikes).toEqual([3, 9, 10, 11, 15])
  })

  it('o volume financeiro usa o volume em vez dos negócios', () => {
    const d = dadosNegociosPorStrike(ativo, [V1], 'soma', 'volume', HOJE, 10)
    expect(d.linhas[0].valores).toEqual([12_000, 60_000, 4_000])
  })

  it('acha o pico, o total e o máximo de cada linha', () => {
    const d = dadosNegociosPorStrike(ativo, [V1], 'separados', 'negocios', HOJE, null)
    const calls = linha(d, `${V1}-call`)
    expect(calls.picoStrike).toBe(3)
    expect(calls.picoValor).toBe(50)
    expect(calls.total).toBe(99)
    expect(d.maximo).toBe(50)
  })

  it('linha sem negócio nenhum não tem pico, e sem vencimentos o resultado é vazio', () => {
    const parado: AtivoComOpcoes = { ...ativo, series: [serie('C1', 'call', 10, V1, 5, { dataUltimo: '2026-10-14' })] }
    const l = dadosNegociosPorStrike(parado, [V1], 'calls', 'negocios', HOJE, null).linhas[0]
    expect(l.picoStrike).toBeNull()
    expect(l.picoValor).toBe(0)
    expect(dadosNegociosPorStrike(ativo, [], 'soma', 'negocios', HOJE, null)).toEqual({ strikes: [], linhas: [], maximo: 0 })
  })

  it('distanciaDoPreco: percentual do strike em relação ao preço', () => {
    expect(distanciaDoPreco(11, 10)).toBeCloseTo(10)
    expect(distanciaDoPreco(9, 10)).toBeCloseTo(-10)
  })
})
