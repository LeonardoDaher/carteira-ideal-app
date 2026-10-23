import { describe, expect, it } from 'vitest'
import { interpretar } from './hp12cInterpretador'
import { bancoDeQuestoes } from './matematicaFinanceira'

describe('interpretador da Sua HP12C', () => {
  it('juros compostos com "10 mil" e taxa ao mês', () => {
    const r = interpretar('Qual o montante de 10 mil reais a 2% ao mês, juros compostos, por 8 meses?')!
    expect(r.problemaId).toBe('jurosCompostos')
    expect(r.valores).toMatchObject({ capital: '10000', taxa: '2', prazo: '8', montante: '' })
  })

  it('entende números por extenso e converte anos para a unidade da taxa', () => {
    const r = interpretar('dez mil reais a um vírgula cinco por cento ao mês durante dois anos, juros simples')!
    expect(r.problemaId).toBe('jurosSimples')
    expect(r.valores).toMatchObject({ capital: '10000', taxa: '1,5', prazo: '24' })
    expect(r.avisos.join(' ')).toMatch(/Converti/)
  })

  it('avisa quando assume juros compostos', () => {
    const r = interpretar('Apliquei 5000 a 1% ao mês por 12 meses, quanto rende?')!
    expect(r.problemaId).toBe('jurosCompostos')
    expect(r.avisos.join(' ')).toMatch(/compostos/)
  })

  it('financiamento: descobre a parcela', () => {
    const r = interpretar('Um carro de 40 mil financiado em 36 parcelas a 1,5% ao mês. Qual a parcela?')!
    expect(r.problemaId).toBe('hp12c')
    expect(r.valores).toMatchObject({ n: '36', i: '1,5', pv: '40000', pmt: '', fv: '0' })
  })

  it('depósitos mensais: descobre o valor futuro', () => {
    const r = interpretar('Depositando 500 reais por mês a 0,8% ao mês durante 24 meses, quanto terei?')!
    expect(r.problemaId).toBe('hp12c')
    expect(r.valores).toMatchObject({ n: '24', i: '0,8', pv: '0', pmt: '-500', fv: '' })
  })

  it('taxa equivalente', () => {
    const r = interpretar('Qual a taxa anual equivalente a 2% ao mês?')!
    expect(r.problemaId).toBe('taxaEquivalente')
    expect(r.valores).toMatchObject({ taxa: '2', de: 'mes', para: 'ano' })
  })

  it('taxa real', () => {
    const r = interpretar('Rendeu 12% no ano e a inflação foi 5%. Qual o ganho real?')!
    expect(r.problemaId).toBe('taxaReal')
    expect(r.valores).toMatchObject({ aparente: '12', inflacao: '5', real: '' })
  })

  it('desconto, SAC e investimento', () => {
    expect(interpretar('Desconto de um título de 10 mil reais, vencimento em 3 meses, taxa de 2% ao mês')!.valores).toMatchObject({ nominal: '10000', taxa: '2', prazo: '3' })
    expect(interpretar('Financiamento de 12 mil em 4 parcelas a 2% ao mês pelo SAC')!.valores).toMatchObject({ saldo: '12000', taxa: '2', prazo: '4', sistema: 'sac' })
    const inv = interpretar('Projeto com investimento de 10000 e retornos de 4000, 4000 e 4000. TMA de 10%')!
    expect(inv.problemaId).toBe('analiseInvest')
    expect(inv.valores).toMatchObject({ fluxo: '-10000; 4000; 4000; 4000', tma: '10' })
  })

  it('devolve null quando não há como resolver', () => {
    expect(interpretar('olá, bom dia')).toBeNull()
  })

  it('reconhece todas as questões do banco como o tema certo', () => {
    for (const q of bancoDeQuestoes()) {
      const r = interpretar(q.enunciado)
      expect(r?.problemaId, q.enunciado).toBe(q.problema.id)
    }
  })
})
