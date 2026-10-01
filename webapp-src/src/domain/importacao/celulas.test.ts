import { describe, expect, it } from 'vitest'
import { lerData, lerNumero, normalizarCabecalho } from './celulas'

describe('lerNumero', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['R$ 1.234,56', 1234.56],
    ['R$\u00a010,05', 10.05],
    ['10,05', 10.05],
    ['(123,45)', -123.45],
    ['-5,5', -5.5],
    ['1.000', 1000], // milhar, não decimal
    ['12.345.678', 12345678],
    ['0.125', 0.125], // decimal (zero à esquerda)
    ['12.5', 12.5],
    ['1,234.50', 1234.5], // formato inglês
    ['1,5', 1.5],
    [12.5, 12.5],
  ])('%j -> %s', (entrada, esperado) => {
    expect(lerNumero(entrada as string | number)).toBeCloseTo(esperado as number, 8)
  })
  it.each([['-'], ['--'], [''], ['abc'], [null], [undefined], [true], [new Date()]])('%j -> null', (entrada) => {
    expect(lerNumero(entrada as never)).toBeNull()
  })
})

describe('lerData', () => {
  it('lê dia primeiro, nunca mês primeiro', () => {
    expect(lerData('05/03/2026')).toBe('2026-03-05')
    expect(lerData('5/3/26')).toBe('2026-03-05')
    expect(lerData('13/01/2026')).toBe('2026-01-13')
  })
  it('lê ISO, com ou sem hora', () => {
    expect(lerData('2026-03-05')).toBe('2026-03-05')
    expect(lerData('2026-03-05T10:30:00')).toBe('2026-03-05')
    expect(lerData('05/03/2026 10:30')).toBe('2026-03-05')
  })
  it('Date do Excel (meia-noite UTC) não volta um dia no fuso do Brasil', () => {
    expect(lerData(new Date(Date.UTC(2026, 2, 5)))).toBe('2026-03-05')
  })
  it('data serial do Excel', () => {
    expect(lerData(45658)).toBe('2025-01-01')
  })
  it('rejeita datas impossíveis e lixo', () => {
    expect(lerData('31/02/2026')).toBeNull()
    expect(lerData('32/01/2026')).toBeNull()
    expect(lerData('xx')).toBeNull()
    expect(lerData(5)).toBeNull()
    expect(lerData('')).toBeNull()
    expect(lerData(null)).toBeNull()
  })
})

describe('normalizarCabecalho', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizarCabecalho('Preço unitário')).toBe('PRECO UNITARIO')
    expect(normalizarCabecalho(' Valor da  Operação ')).toBe('VALOR DA OPERACAO')
    expect(normalizarCabecalho('Qtd.')).toBe('QTD')
    expect(normalizarCabecalho('Entrada/Saída')).toBe('ENTRADA/SAIDA')
  })
})
