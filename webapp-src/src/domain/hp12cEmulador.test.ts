import { describe, expect, it } from 'vitest'
import { estadoInicial, pressionar, visor } from './hp12cEmulador'
import type { Estado } from './hp12cEmulador'

/** Digita uma sequência de teclas separadas por espaço; números como "1450.5" viram dígito a dígito. */
function teclas(seq: string, inicial: Estado = estadoInicial()) {
  let e = inicial
  for (const t of seq.split(/\s+/).filter(Boolean)) {
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      if (t.startsWith('-')) {
        for (const c of t.slice(1)) e = pressionar(e, c)
        e = pressionar(e, 'chs')
      } else for (const c of t) e = pressionar(e, c)
    } else e = pressionar(e, t)
  }
  return e
}
const x = (e: Estado) => e.pilha[0]

describe('emulador HP-12C', () => {
  it('RPN: 2 ENTER 3 + = 5 e a conta encadeada (1+2)×(3+4) = 21 sem parênteses', () => {
    expect(x(teclas('2 enter 3 +'))).toBe(5)
    const e = teclas('1 enter 2 + 3 enter 4 + *')
    expect(x(e)).toBe(21)
    expect(visor(e)).toBe('21,00')
  })

  it('digitar mostra o que a pessoa escreve e CHS troca o sinal', () => {
    let e = teclas('1 2 . 5')
    expect(visor(e)).toBe('12,5')
    e = pressionar(e, 'chs')
    expect(visor(e)).toBe('-12,5')
    expect(visor(pressionar(e, 'enter'))).toBe('-12,50')
  })

  it('a pilha tem quatro níveis: T se repete ao descer e R↓ gira', () => {
    let e = teclas('1 enter 2 enter 3 enter 4')
    expect(e.pilha).toEqual([4, 3, 2, 1])
    e = pressionar(e, 'rdown')
    expect(e.pilha).toEqual([3, 2, 1, 4])
    e = teclas('xy', e)
    expect(e.pilha).toEqual([2, 3, 1, 4])
  })

  it('LAST X devolve o último X (g +)', () => {
    const e = teclas('3 enter 4 + g +')
    expect(e.pilha[0]).toBe(4)
    expect(e.pilha[1]).toBe(7)
  })

  it('subtração, divisão e divisão por zero', () => {
    expect(x(teclas('10 enter 4 -'))).toBe(6)
    expect(x(teclas('1 enter 4 /'))).toBe(0.25)
    const erro = teclas('5 enter 0 /')
    expect(visor(erro)).toBe('Error 0')
    expect(visor(pressionar(erro, 'clx'))).toBe('0,00')
  })

  it('percentuais: %, Δ% e %T', () => {
    const p = teclas('200 enter 10 pct')
    expect(x(p)).toBe(20)
    expect(p.pilha[1]).toBe(200)
    expect(x(teclas('50 enter 60 dpct'))).toBeCloseTo(20, 10)
    expect(x(teclas('200 enter 50 pctt'))).toBe(25)
  })

  it('funções g: √x, x², 1/x, e^x, LN, FRAC, INTG e n!', () => {
    expect(x(teclas('16 g pow'))).toBe(4)
    expect(x(teclas('7 g *'))).toBe(49)
    expect(x(teclas('4 inv'))).toBe(0.25)
    expect(x(teclas('1 g inv'))).toBeCloseTo(Math.E, 10)
    expect(x(teclas('1 g pctt'))).toBe(0)
    expect(x(teclas('5 g 3'))).toBe(120)
    expect(x(teclas('2 enter 10 pow'))).toBe(1024)
  })

  it('f e um dígito escolhem as casas decimais do visor', () => {
    const e = teclas('1 enter 3 / f 4')
    expect(visor(e)).toBe('0,3333')
  })

  it('STO e RCL guardam e devolvem das memórias 0 a 9', () => {
    const e = teclas('42 sto 5 7 enter 0 rcl 5')
    expect(x(e)).toBe(42)
  })

  it('financiamento: PMT de 36 parcelas a 1,5% sobre 40.000 (PV com CHS)', () => {
    const e = teclas('f xy 36 n 1.5 i 40000 chs pv pmt')
    const esperado = (40000 * 0.015) / (1 - Math.pow(1.015, -36))
    expect(x(e)).toBeCloseTo(esperado, 6)
    expect(visor(e)).toBe(esperado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  })

  it('depósitos: FV de 24 depósitos de 500 a 0,8% ao mês', () => {
    expect(x(teclas('24 n 0.8 i 500 chs pmt fv'))).toBeCloseTo(13171.58, 2)
  })

  it('taxa e prazo: i do parcelamento e n arredondado para cima', () => {
    expect(x(teclas('12 n 3000 pv 280 chs pmt i'))).toBeCloseTo(1.7881, 4)
    expect(x(teclas('2 i 15000 pv 1200 chs pmt n'))).toBe(15)
  })

  it('BEGIN e END mudam a conta: PV antecipado é maior', () => {
    const fim = teclas('12 n 1 i 100 chs pmt pv')
    const ini = teclas('g 7 12 n 1 i 100 chs pmt pv')
    expect(ini.inicio).toBe(true)
    expect(x(fim)).toBeCloseTo(1125.51, 2)
    expect(x(ini)).toBeCloseTo(1136.76, 2)
    expect(teclas('g 8', ini).inicio).toBe(false)
  })

  it('g 12× e g 12÷ guardam em n e i', () => {
    expect(teclas('3 g n').fin.n).toBe(36)
    expect(teclas('18 g i').fin.i).toBe(1.5)
  })

  it('f CLEAR FIN zera os financeiros e f CLEAR REG zera tudo', () => {
    let e = teclas('36 n 1.5 i 100 pv')
    e = teclas('f xy', e)
    expect(e.fin).toEqual({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 })
    e = teclas('9 sto 1 f clx', e)
    expect(e.reg[1]).toBe(0)
  })

  it('fluxo de caixa: NPV e IRR com CFo, CFj e Nj', () => {
    const base = teclas('10000 chs g pv 4000 g pmt 4 g fv 10 i')
    expect(x(teclas('f pv', base))).toBeCloseTo(2679.46, 2)
    expect(x(teclas('f fv', base))).toBeCloseTo(21.8623, 3)
  })

  it('juros simples com f INT (360 dias): 95 dias, 18% ao ano sobre 450', () => {
    expect(x(teclas('95 n 18 i 450 chs pv f i'))).toBeCloseTo(21.375, 6)
  })

  it('financeira sem solução dá Error 5', () => {
    expect(visor(teclas('12 n 0 i 0 pv 0 pmt i'))).toBe('Error 5')
  })

  it('f RND arredonda X para as casas do visor', () => {
    const e = teclas('f 2 1 enter 3 / f pmt f 9')
    expect(x(e)).toBe(0.33)
  })
})
