import { describe, expect, it } from 'vitest'
import { cenariosNoPrimeiroVencimento, desmontar, rolar, sigmaDaPerna, valorNoCenario } from './rolagem'
import type { PernaDaEstrutura } from './rolagem'
import { analisar, precoBs, resultadoNoVencimento } from './simulaOpcoes'
import type { SerieOpcao } from './opcoes'

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, ultimo: number): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 1000,
})
const r = Math.log(1.14)
const m = { precoHoje: 60, r, sigmaPadrao: 0.35 }
const sem = { acoes: 0, precoAcao: 0 }
const diasAte = (v: string) => (v === '2026-11-19' ? 22 : 42)

// Venda de put K60 de 22 dias úteis, recebendo o preço do modelo com volatilidade de 30% (100 opções).
const putVendida = (): PernaDaEstrutura[] => [{
  perna: { tipo: 'put', lado: 'venda', strike: 60, premio: precoBs({ tipo: 'put', s: 60, strike: 60, t: 22 / 252, r, sigma: 0.3 }), quantidade: 100, dias: 22 },
  serie: serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
}]

describe('valor das opções no cenário', () => {
  it('a volatilidade implícita do preço pago faz a perna valer o que custou, hoje', () => {
    const [{ perna }] = putVendida()
    const sigma = sigmaDaPerna(perna, 22, m)
    expect(sigma).toBeCloseTo(0.3, 3)
    expect(valorNoCenario(perna, sigma, { preco: 60, diasPassados: 0 }, m, 22)).toBeCloseTo(perna.premio, 4)
  })

  it('no dia do vencimento, vale só o valor intrínseco', () => {
    const [{ perna }] = putVendida()
    expect(valorNoCenario(perna, 0.3, { preco: 55, diasPassados: 22 }, m, 22)).toBeCloseTo(5, 6)
    expect(valorNoCenario(perna, 0.3, { preco: 65, diasPassados: 22 }, m, 22)).toBe(0)
  })
})

describe('desmontar', () => {
  it('encerrar uma put vendida com o ativo em queda dá prejuízo; com ele parado e o tempo passando, dá lucro', () => {
    const queda = desmontar(putVendida(), sem, { preco: 55, diasPassados: 10 }, m, 22)
    expect(queda.total).toBeLessThan(0)
    const parado = desmontar(putVendida(), sem, { preco: 60, diasPassados: 10 }, m, 22)
    expect(parado.total).toBeGreaterThan(0) // o valor de tempo derreteu a favor de quem vendeu
  })

  it('conta as ações vendidas no cenário', () => {
    const d = desmontar(putVendida(), { acoes: 100, precoAcao: 60 }, { preco: 62, diasPassados: 0 }, m, 22)
    const semAcoes = desmontar(putVendida(), sem, { preco: 62, diasPassados: 0 }, m, 22)
    expect(d.total - semAcoes.total).toBeCloseTo(200, 6)
  })
})

describe('rolagem', () => {
  const nova = serie('PETRW550', 'put', 55, '2026-12-18', 2.5)

  it('rolar a put vendida para frente e para baixo realiza a perda e abre a nova perna com prazo contado do cenário', () => {
    const c = { preco: 55, diasPassados: 10 }
    const x = rolar(putVendida(), sem, [{ indice: 0, nova }], c, m, diasAte)
    const antiga = desmontar(putVendida(), sem, c, m, 22)
    expect(x.realizado).toBeCloseTo(antiga.total, 6)
    expect(x.realizado).toBeLessThan(0)
    expect(x.posicao.pernas).toHaveLength(1)
    expect(x.posicao.pernas[0]).toMatchObject({ tipo: 'put', lado: 'venda', strike: 55, quantidade: 100, dias: 32 })
    expect(x.diasAteVencer).toBe(32)
    expect(x.posicao.realizado).toBeCloseTo(x.realizado, 10)
    expect(x.detalhes[0]).toMatchObject({ de: 'PETRW600', para: 'PETRW550' })
    // vendida: recomprar a antiga custa (negativo) e abrir a nova rende (positivo); o líquido é a soma
    expect(x.detalhes[0].encerramento).toBeLessThan(0)
    expect(x.detalhes[0].abertura).toBeGreaterThan(0)
    expect(x.liquido).toBeCloseTo(x.detalhes[0].encerramento + x.detalhes[0].abertura, 10)
  })

  it('a posição depois da rolagem leva o resultado realizado para o gráfico (soma em qualquer preço)', () => {
    const c = { preco: 55, diasPassados: 10 }
    const x = rolar(putVendida(), sem, [{ indice: 0, nova }], c, m, diasAte)
    const semRealizado = { ...x.posicao, realizado: 0 }
    expect(resultadoNoVencimento(x.posicao, 70) - resultadoNoVencimento(semRealizado, 70)).toBeCloseTo(x.realizado, 8)
    // o ganho máximo da posição nova é o prêmio recebido pela nova perna mais o que já se realizou (negativo)
    const a = analisar(x.posicao)
    expect(a.ganhoMaximo!).toBeCloseTo(x.posicao.pernas[0].premio * 100 + x.realizado, 1)
  })

  it('sem alvos, nada muda além do prazo que resta', () => {
    const x = rolar(putVendida(), sem, [], { preco: 58, diasPassados: 10 }, m, diasAte)
    expect(x.detalhes).toEqual([])
    expect(x.realizado).toBe(0)
    expect(x.posicao.pernas[0]).toMatchObject({ strike: 60, dias: 12 })
  })

  it('pernas que não rolam e já venceram até o cenário são encerradas pelo valor intrínseco', () => {
    const duas: PernaDaEstrutura[] = [
      ...putVendida(),
      { perna: { tipo: 'put', lado: 'compra', strike: 55, premio: 0.8, quantidade: 100, dias: 22 }, serie: serie('PETRW550B', 'put', 55, '2026-11-19', 0.8) },
    ]
    const x = rolar(duas, sem, [], { preco: 52, diasPassados: 22 }, m, diasAte)
    // vendida K60: paga 8 (e recebeu o prêmio); comprada K55: vale 3 (pagou 0,8)
    const esperado = -(8 - duas[0].perna.premio) * 100 + (3 - 0.8) * 100
    expect(x.realizado).toBeCloseTo(esperado, 4)
    expect(x.posicao.pernas).toHaveLength(0)
    expect(x.diasAteVencer).toBeNull()
  })

  it('perna comprada: encerrar rende o valor e abrir custa o preço da nova', () => {
    const comprada: PernaDaEstrutura[] = [{ perna: { ...putVendida()[0].perna, lado: 'compra' }, serie: putVendida()[0].serie }]
    const x = rolar(comprada, sem, [{ indice: 0, nova }], { preco: 55, diasPassados: 10 }, m, diasAte)
    expect(x.detalhes[0].encerramento).toBeGreaterThan(0)
    expect(x.detalhes[0].abertura).toBeLessThan(0)
  })

  it('as ações continuam na posição rolada', () => {
    const x = rolar(putVendida(), { acoes: 100, precoAcao: 60 }, [{ indice: 0, nova }], { preco: 55, diasPassados: 5 }, m, diasAte)
    expect(x.posicao.acoes).toBe(100)
    expect(x.posicao.precoAcao).toBe(60)
  })
})

describe('cenários no primeiro vencimento', () => {
  it('put vendida: prejuízo se cai, o prêmio se sobe, e a série só entra na lista das exercidas dentro do dinheiro', () => {
    const [{ perna }] = putVendida()
    const linhas = cenariosNoPrimeiroVencimento(putVendida(), sem, m, [-0.1, 0, 0.1])
    expect(linhas[0].preco).toBeCloseTo(54, 8)
    expect(linhas[0].resultado).toBeCloseTo(-(6 - perna.premio) * 100, 4)
    expect(linhas[2].resultado).toBeCloseTo(perna.premio * 100, 4)
    expect(linhas[0].exercidas).toEqual(['PETRW600'])
    expect(linhas[1].exercidas).toEqual([]) // no strike não está dentro do dinheiro
    expect(linhas[2].exercidas).toEqual([])
  })

  it('call vendida é exercida quando o ativo passa do strike', () => {
    const call: PernaDaEstrutura[] = [{ perna: { tipo: 'call', lado: 'venda', strike: 65, premio: 1, quantidade: 100, dias: 22 }, serie: serie('PETRK650', 'call', 65, '2026-11-19', 1) }]
    const linhas = cenariosNoPrimeiroVencimento(call, { acoes: 100, precoAcao: 60 }, m, [0, 0.1])
    expect(linhas[0].exercidas).toEqual([])
    expect(linhas[1].exercidas).toEqual(['PETRK650'])
    expect(linhas[1].resultado).toBeCloseTo((65 - 60 + 1) * 100, 4) // venda coberta: ganho máximo (5 + 1) × 100
  })
})
