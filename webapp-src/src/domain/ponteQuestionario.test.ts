import { describe, expect, it } from 'vitest'
import { meuMesTemDados, sugestoesDoMeuMes } from './ponteQuestionario'
import type { Orcamento } from './orcamento'
import type { Divida } from './recuperacao'

const base: Orcamento = {
  salario: 5000,
  reserva: 0,
  potes: { guardar: 0, crescer: 0 },
  contas: [{ id: 'aluguel', nome: 'Aluguel', valor: 2000, tipo: 'mensal' }],
  pagamentos: {},
  cartao: { teto: 0, compras: [] },
}

const divida = (p: Partial<Divida>): Divida => ({
  id: 'd1',
  nome: 'Dívida',
  tipo: 'outra',
  saldo: 1000,
  saldoInicial: 1000,
  jurosMensal: 1.5,
  parcelaMinima: 100,
  ...p,
})

const comDividas = (dividas: Divida[], p: Partial<Orcamento> = {}): Orcamento => ({
  ...base,
  recuperacao: { ligadoManual: false, dividas, metodo: 'avalanche', pactoDesde: null },
  ...p,
})

/** Normaliza o espaço não separável do Intl ("R$ 1.500,00"). */
const limpo = (s: string | undefined) => s?.replace(/\s+/g, ' ')

describe('ponte do Meu Mês com o questionário', () => {
  it('Meu Mês vazio: nenhuma sugestão', () => {
    const vazio: Orcamento = { ...base, salario: 0, contas: [] }
    expect(meuMesTemDados(vazio)).toBe(false)
    expect(sugestoesDoMeuMes(vazio)).toEqual({})
  })

  it('Pilar 1: reserva zerada sugere [A] e diz o custo de vida', () => {
    const s = sugestoesDoMeuMes(base).capacidadeFinanceira
    expect(s?.letra).toBe('a')
    expect(limpo(s?.motivo)).toContain('reserva está zerada')
    expect(limpo(s?.motivo)).toContain('R$ 2.000,00 por mês')
  })

  it('Pilar 1: segue as faixas da pergunta (menos de 3, 3 a 12, mais de 12 meses)', () => {
    expect(sugestoesDoMeuMes({ ...base, reserva: 5000 }).capacidadeFinanceira?.letra).toBe('a') // 2,5 meses
    const b = sugestoesDoMeuMes({ ...base, reserva: 10000 }).capacidadeFinanceira
    expect(b?.letra).toBe('b')
    expect(limpo(b?.motivo)).toContain('reserva de R$ 10.000,00 paga 5 meses')
    expect(sugestoesDoMeuMes({ ...base, reserva: 24000 }).capacidadeFinanceira?.letra).toBe('b') // 12 meses
    expect(sugestoesDoMeuMes({ ...base, reserva: 26000 }).capacidadeFinanceira?.letra).toBe('c')
  })

  it('Pilar 1: abaixo de 2 meses, singular', () => {
    expect(limpo(sugestoesDoMeuMes({ ...base, reserva: 600 }).capacidadeFinanceira?.motivo)).toContain('paga 0,3 mês do')
    expect(limpo(sugestoesDoMeuMes({ ...base, reserva: 3000 }).capacidadeFinanceira?.motivo)).toContain('paga 1,5 mês do')
  })

  it('Pilar 1: sem contas não há régua, então não sugere', () => {
    expect(sugestoesDoMeuMes({ ...base, contas: [] }).capacidadeFinanceira).toBeUndefined()
  })

  it('Pilar 2: dívida cara sugere [A], mesmo com juros digitados baixos', () => {
    const s = sugestoesDoMeuMes(comDividas([divida({ tipo: 'cheque-especial', jurosMensal: 1 })])).passivoDividas
    expect(s?.letra).toBe('a')
    expect(s?.motivo).toContain('uma dívida cara')
  })

  it('Pilar 2: conta as dívidas caras no plural', () => {
    const s = sugestoesDoMeuMes(
      comDividas([divida({ id: 'x', tipo: 'cartao-rotativo' }), divida({ id: 'y', jurosMensal: 4 })]),
    ).passivoDividas
    expect(s?.motivo).toContain('2 dívidas caras')
  })

  it('Pilar 2: dívida em dólar com juros baixos sugere [B] e cita o dólar (D84)', () => {
    const s = sugestoesDoMeuMes(comDividas([divida({ tipo: 'dolar', jurosMensal: 0.8 })])).passivoDividas
    expect(s?.letra).toBe('b')
    expect(s?.motivo).toContain('dívida em dólar')
  })

  it('Pilar 2: só dívida barata sugere [B]', () => {
    const s = sugestoesDoMeuMes(comDividas([divida({ tipo: 'financiamento', jurosMensal: 1.2 })])).passivoDividas
    expect(s?.letra).toBe('b')
    expect(s?.motivo).toContain('abaixo de 3% ao mês')
  })

  it('Pilar 2: sem dívidas, [C] até metade do salário e [B] acima', () => {
    const c = sugestoesDoMeuMes(base).passivoDividas
    expect(c?.letra).toBe('c')
    expect(c?.motivo).toContain('40% do salário')
    const b = sugestoesDoMeuMes({ ...base, contas: [{ id: 'a', nome: 'Aluguel', valor: 3000, tipo: 'mensal' }] }).passivoDividas
    expect(b?.letra).toBe('b')
    expect(b?.motivo).toContain('acima da metade')
  })

  it('Pilar 2: dívida quitada (saldo zero) não conta', () => {
    const s = sugestoesDoMeuMes(comDividas([divida({ tipo: 'cheque-especial', saldo: 0 })])).passivoDividas
    expect(s?.letra).toBe('c')
  })

  it('Pilar 2: sem salário não sugere, a não ser que haja dívida cara', () => {
    expect(sugestoesDoMeuMes({ ...base, salario: 0 }).passivoDividas).toBeUndefined()
    const s = sugestoesDoMeuMes(comDividas([divida({ tipo: 'emprestimo-pessoal' })], { salario: 0 })).passivoDividas
    expect(s?.letra).toBe('a')
  })
})
