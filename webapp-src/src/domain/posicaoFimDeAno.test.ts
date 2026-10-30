import { describe, expect, it } from 'vitest'
import { anosDosLancamentos, posicaoEm31Dez, posicaoParaCsv } from './posicaoFimDeAno'
import type { Lancamento } from './lancamentos'

let n = 0
function op(tipo: 'compra' | 'venda', data: string, ativo: string, quantidade: number, preco: number, taxas = 0): Lancamento {
  return { id: `t${n++}`, data, tipo, ativo, quantidade, preco, valor: quantidade * preco, taxas, origem: 'manual' }
}

const lancs = [
  op('compra', '2025-03-10', 'PETR4', 100, 30),
  op('compra', '2025-12-31', 'PETR4', 100, 40), // entra: 31/12 conta
  op('compra', '2026-01-02', 'PETR4', 100, 50), // não entra em 2025
  op('compra', '2025-05-05', 'MXRF11', 100, 10, 2),
  op('venda', '2026-02-02', 'MXRF11', 100, 11),
]

describe('posicaoEm31Dez', () => {
  it('considera só o que aconteceu até 31/12 do ano', () => {
    const { linhas } = posicaoEm31Dez(lancs, '2025')
    const petr = linhas.find((l) => l.ativo === 'PETR4')!
    expect(petr.quantidade).toBe(200)
    expect(petr.precoMedio).toBeCloseTo(35)
    expect(petr.custoTotal).toBeCloseTo(7000)
    expect(linhas.find((l) => l.ativo === 'MXRF11')!.precoMedio).toBeCloseTo(10.02)
  })
  it('ativo zerado depois do fim do ano some da posição seguinte', () => {
    expect(posicaoEm31Dez(lancs, '2026').linhas.map((l) => l.ativo)).toEqual(['PETR4'])
  })
  it('lista os anos e gera o CSV', () => {
    expect(anosDosLancamentos(lancs)).toEqual(['2026', '2025'])
    const csv = posicaoParaCsv(posicaoEm31Dez(lancs, '2025').linhas, '2025').trim().split('\r\n')
    expect(csv[0]).toBe('Ativo;Quantidade em 31/12/2025;Preço médio (R$);Custo total (R$)')
    expect(csv[2]).toBe('PETR4;200;35,0000;7000,00')
  })
})

describe('posicaoEm31Dez: categoria', () => {
  it('marca cada ativo com a categoria dada', () => {
    const { linhas } = posicaoEm31Dez(lancs, '2025', (a) => (a === 'PETR4' ? 'acao' : 'fii'))
    expect(linhas.map((l) => [l.ativo, l.categoria])).toEqual([['MXRF11', 'fii'], ['PETR4', 'acao']])
  })
})
