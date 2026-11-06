import { describe, expect, it } from 'vitest'
import { apurarNegocios, juntarLeituras, lerMatrizesDoArquivo, lerNegociosOpcoes, vencimentoInferido } from './extratoOpcoesB3'
import type { NegocioOpcao } from './extratoOpcoesB3'
import { apurarMeses } from './impostoOpcoes'

const n = (data: string, lado: 'compra' | 'venda', quantidade: number, preco: number, codigo = 'PETRK600'): NegocioOpcao => ({
  data, codigo, lado, quantidade, preco, valor: quantidade * preco, vencimento: null,
})

describe('extrato de negociação da B3 (opções)', () => {
  const cab = ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Prazo/Vencimento', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor']

  it('lê só as linhas de opções e ignora ações', () => {
    const l = lerNegociosOpcoes([
      ['Extrato de Negociação'],
      cab,
      ['15/10/2026', 'Venda', 'Opção de Compra', '-', 'XP', 'PETRK600', 100, 2.5, 250],
      ['16/10/2026', 'Compra', 'Mercado à Vista', '-', 'XP', 'PETR4', 100, 60, 6000],
      ['20/10/2026', 'Compra', 'Opção de Venda', '-', 'XP', 'BOVAW120', '200', '1,10', '220,00'],
    ])
    expect(l.reconhecido).toBe(true)
    expect(l.negocios).toHaveLength(2)
    expect(l.ignoradas).toBe(1)
    expect(l.negocios[1]).toMatchObject({ data: '2026-10-20', codigo: 'BOVAW120', lado: 'compra', quantidade: 200, preco: 1.1, valor: 220 })
  })

  it('aba sem o cabeçalho esperado não é reconhecida', () => {
    expect(lerNegociosOpcoes([['a', 'b']]).reconhecido).toBe(false)
  })

  it('lê CSV com ponto e vírgula', async () => {
    const csv = `${cab.join(';')}\n15/10/2026;Venda;Opção de Compra;-;XP;PETRK600;100;2,50;250,00\n`
    const mats = await lerMatrizesDoArquivo('extrato.csv', new TextEncoder().encode(csv).buffer as ArrayBuffer)
    expect(juntarLeituras(mats.map(lerNegociosOpcoes)).negocios).toHaveLength(1)
  })

  it('day trade: compra e venda no mesmo dia', () => {
    const r = apurarNegocios([n('2026-10-05', 'compra', 100, 1), n('2026-10-05', 'venda', 100, 1.5)], '2026-10-30')
    expect(r.operacoes).toHaveLength(1)
    expect(r.operacoes[0]).toMatchObject({ categoria: 'daytrade', resultado: 50 })
  })

  it('swing vendido e recomprado: resultado e base do IRRF', () => {
    const r = apurarNegocios([n('2026-10-05', 'venda', 100, 2), n('2026-10-15', 'compra', 100, 0.5)], '2026-10-30')
    const res = r.operacoes.find((o) => o.resultado !== 0)
    expect(res).toMatchObject({ categoria: 'swing', data: '2026-10-15', resultado: 150 })
    expect(r.operacoes.find((o) => o.vendido > 0)).toMatchObject({ data: '2026-10-05', vendido: 200 })
    expect(r.abertas).toHaveLength(0)
  })

  it('preço médio e inversão de posição', () => {
    const r = apurarNegocios([n('2026-10-01', 'compra', 100, 1), n('2026-10-02', 'compra', 100, 2), n('2026-10-10', 'venda', 300, 3)], '2026-10-30')
    // PM 1,50 sobre 200 = 300 de ganho; sobram 100 vendidas a 3,00 (posição vendida aberta)
    expect(r.operacoes.find((o) => o.resultado !== 0)?.resultado).toBe(300)
    expect(r.abertas[0]).toMatchObject({ lado: 'vendida', quantidade: 100, precoMedio: 3 })
  })

  it('posição aberta vencida vira resultado no vencimento, a menos que marcada como exercida', () => {
    expect(vencimentoInferido('PETRK600', '2026-10-05')).toBe('2026-11-20')
    const ab = [n('2026-10-05', 'venda', 100, 2)]
    const r = apurarNegocios(ab, '2026-11-30')
    expect(r.abertas[0].vencida).toBe(true)
    expect(r.operacoes.find((o) => o.resultado !== 0)).toMatchObject({ data: '2026-11-20', resultado: 200 })
    const ex = apurarNegocios(ab, '2026-11-30', new Set(['PETRK600']))
    expect(ex.operacoes.some((o) => o.resultado !== 0)).toBe(false)
    expect(apurarNegocios(ab, '2026-11-10').operacoes.some((o) => o.resultado !== 0)).toBe(false)
  })

  it('alimenta a apuração mensal', () => {
    const r = apurarNegocios([n('2026-10-05', 'venda', 100, 2), n('2026-10-15', 'compra', 100, 0.5)], '2026-10-30')
    const [m] = apurarMeses(r.operacoes)
    expect(m.resultadoSwing).toBe(150)
    expect(m.impostoSwing).toBe(22.5)
  })
})
