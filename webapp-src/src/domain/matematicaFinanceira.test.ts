import { describe, expect, it } from 'vitest'
import { bancoDeQuestoes, ehErro, lerNumero, problemaPorId, tir, vpl, type Resultado } from './matematicaFinanceira'

function resolver(id: string, valores: Record<string, string>): Resultado {
  const r = problemaPorId(id)!.resolver(valores)
  if (ehErro(r)) throw new Error(r.erro)
  return r
}
const valor = (r: Resultado, rotulo: RegExp) => r.linhas.find((l) => rotulo.test(l.rotulo))!.valor

describe('matemática financeira (Sua HP12C)', () => {
  it('lê números em pt-BR', () => {
    expect(lerNumero('1.000,50')).toBe(1000.5)
    expect(lerNumero('R$ 2.500')).toBe(2500)
    expect(lerNumero('2.5')).toBe(2.5)
    expect(lerNumero('12,5 %')).toBe(12.5)
    expect(lerNumero('')).toBeNaN()
  })

  it('juros simples: montante, taxa e prazo', () => {
    expect(valor(resolver('jurosSimples', { capital: '10000', taxa: '3', prazo: '8', montante: '' }), /^Montante/)).toBe('R$ 12.400,00')
    expect(valor(resolver('jurosSimples', { capital: '5000', taxa: '', prazo: '12', montante: '6200' }), /^Taxa/)).toBe('2,00%')
    expect(valor(resolver('jurosSimples', { capital: '2000', taxa: '2', prazo: '', montante: '2800' }), /^Prazo/)).toBe('20')
  })

  it('juros compostos: montante, capital, taxa e prazo', () => {
    expect(valor(resolver('jurosCompostos', { capital: '10000', taxa: '2', prazo: '12', montante: '' }), /^Montante/)).toBe('R$ 12.682,42')
    expect(valor(resolver('jurosCompostos', { capital: '8000', taxa: '', prazo: '10', montante: '10000' }), /^Taxa/)).toBe('2,2565%')
    expect(valor(resolver('jurosCompostos', { capital: '1000', taxa: '3', prazo: '', montante: '2000' }), /^Prazo/)).toBe('23,4498')
  })

  it('pede só um campo vazio', () => {
    const r = problemaPorId('jurosCompostos')!.resolver({ capital: '1000', taxa: '', prazo: '', montante: '' })
    expect(ehErro(r)).toBe(true)
  })

  it('taxa equivalente composta e proporcional', () => {
    const r = resolver('taxaEquivalente', { taxa: '2', de: 'mes', para: 'ano' })
    expect(valor(r, /equivalente/)).toBe('26,8242%')
    expect(valor(r, /proporcional/)).toBe('24,00%')
  })

  it('taxa nominal para efetiva', () => {
    expect(valor(resolver('nominalEfetiva', { taxa: '24', periodoNominal: 'ano', capitalizacao: 'mes' }), /efetiva/)).toBe('26,8242%')
  })

  it('taxa real e aparente', () => {
    expect(valor(resolver('taxaReal', { aparente: '12', inflacao: '5', real: '' }), /real/)).toBe('6,6667%')
    expect(valor(resolver('taxaReal', { aparente: '', inflacao: '4', real: '6' }), /aparente/)).toBe('10,24%')
  })

  it('taxa acumulada', () => {
    expect(valor(resolver('taxaAcumulada', { taxas: '1,2; 0,8; 1,5' }), /acumulada/)).toBe('3,5397%')
  })

  it('desconto: racional e comercial simples', () => {
    const r = resolver('desconto', { nominal: '10000', taxa: '2', prazo: '3' })
    expect(r.tabela!.linhas[0][1]).toBe('R$ 9.433,96')
    expect(r.tabela!.linhas[1][1]).toBe('R$ 9.400,00')
    expect(valor(r, /efetiva/)).toBe('2,1277%')
  })

  it('HP12C: parcela de financiamento, FV de depósitos, taxa e prazo', () => {
    const i = 0.015
    const parcela = (40000 * i) / (1 - Math.pow(1 + i, -36))
    const esperado = parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(valor(resolver('hp12c', { n: '36', i: '1.5', pv: '40000', pmt: '', fv: '0', modo: 'fim' }), /Parcela em módulo/)).toBe(`R$ ${esperado}`)
    const fv = resolver('hp12c', { n: '24', i: '0.8', pv: '0', pmt: '-500', fv: '', modo: 'fim' })
    expect(valor(fv, /FV/)).toBe('R$ 13.171,58')
    expect(valor(resolver('hp12c', { n: '12', i: '', pv: '3000', pmt: '-280', fv: '0', modo: 'fim' }), /^i/)).toBe('1,7881%')
    expect(valor(resolver('hp12c', { n: '', i: '2', pv: '15000', pmt: '-1200', fv: '0', modo: 'fim' }), /^n/)).toBe('14,53')
  })

  it('HP12C: pagamento antecipado dá PV maior', () => {
    const fim = valor(resolver('hp12c', { n: '12', i: '1', pv: '', pmt: '-100', fv: '0', modo: 'fim' }), /PV/)
    const ini = valor(resolver('hp12c', { n: '12', i: '1', pv: '', pmt: '-100', fv: '0', modo: 'inicio' }), /PV/)
    expect(fim).toBe('R$ 1.125,51')
    expect(ini).toBe('R$ 1.136,76')
  })

  it('renda perpétua e diferida', () => {
    expect(valor(resolver('rendaPerpetua', { pmt: '2000', taxa: '1', n: '', carencia: '' }), /postecipada/)).toBe('R$ 200.000,00')
    expect(valor(resolver('rendaPerpetua', { pmt: '1000', taxa: '2', n: '10', carencia: '3' }), /diferida/)).toBe('R$ 8.464,49')
  })

  it('VPL, TIR e payback', () => {
    const r = resolver('analiseInvest', { fluxo: '-10000; 4000; 4000; 4000; 4000', tma: '10' })
    expect(valor(r, /^VPL/)).toBe('R$ 2.679,46')
    expect(valor(r, /^TIR/)).toBe('21,8623%')
    expect(valor(r, /^Payback simples/)).toBe('2,50 períodos')
    expect(vpl(0.1, [-100, 110])).toBeCloseTo(0, 6)
    expect(tir([-100, 110])).toBeCloseTo(0.1, 6)
    expect(tir([100, 110])).toBeNull()
  })

  it('SAC, Price, SAM e Americano', () => {
    const sac = resolver('amortizacao', { saldo: '12000', taxa: '2', prazo: '4', sistema: 'sac' })
    expect(sac.tabela!.linhas.map((l) => l[3])).toEqual(['3.240,00', '3.180,00', '3.120,00', '3.060,00'])
    const price = resolver('amortizacao', { saldo: '100000', taxa: '10', prazo: '5', sistema: 'price' })
    expect(price.tabela!.linhas[0][3]).toBe('26.379,75')
    expect(price.tabela!.linhas[4][4]).toBe('0,00')
    const sam = resolver('amortizacao', { saldo: '12000', taxa: '2', prazo: '4', sistema: 'sam' })
    expect(sam.tabela!.linhas[3][4]).toBe('0,00')
    const am = resolver('amortizacao', { saldo: '1000', taxa: '10', prazo: '3', sistema: 'americano' })
    expect(am.tabela!.linhas.map((l) => l[3])).toEqual(['100,00', '100,00', '1.100,00'])
  })

  it('todas as questões do banco resolvem sem erro', () => {
    const banco = bancoDeQuestoes()
    expect(banco.length).toBeGreaterThanOrEqual(25)
    for (const q of banco) expect(ehErro(q.problema.resolver(q.valores)), q.enunciado).toBe(false)
  })
})
