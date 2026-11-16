import { describe, expect, it } from 'vitest'
import { baseDoBalanco, rotuloDoPeriodo } from './baseDoBalanco'
import type { BalancoNovo } from './analiseFundamentalista'

describe('rotuloDoPeriodo', () => {
  it('converte o fim do trimestre no rótulo', () => {
    expect(rotuloDoPeriodo('2026-03-31')).toBe('1T26')
    expect(rotuloDoPeriodo('2026-06-30')).toBe('2T26')
    expect(rotuloDoPeriodo('2026-09-30')).toBe('3T26')
    expect(rotuloDoPeriodo('2025-12-31')).toBe('4T25')
  })
  it('exercício fora do calendário vira mês/ano', () => {
    expect(rotuloDoPeriodo('2026-08-31')).toBe('08/2026')
  })
})

describe('baseDoBalanco', () => {
  const novo = (situacao: BalancoNovo['situacao']): BalancoNovo => ({ situacao, periodo: '2026-09-30', rotulo: '3T26', dtReceb: '2026-11-12', aproximada: false })

  it('empresa em dia: só a base, sem pendência', () => {
    const b = baseDoBalanco('2026-09-30')
    expect(b).toMatchObject({ rotulo: '3T26', estado: 'atualizado', pendencia: null, texto: 'Base: 3T26 · balanço de 30/09/2026' })
  })
  it('banco com balanço novo aguardando a CVM (caso BBAS3): base antiga + pendência', () => {
    const b = baseDoBalanco('2026-06-30', novo('aguardando-cvm'))
    expect(b.estado).toBe('aguardando-cvm')
    expect(b.texto).toBe('Base: 2T26 · balanço de 30/06/2026')
    expect(b.pendencia).toContain('3T26')
  })
  it('provisório da B3: marca a base como provisória e não tem pendência', () => {
    const b = baseDoBalanco('2026-09-30', novo('provisorio-b3'))
    expect(b.estado).toBe('provisorio')
    expect(b.texto).toBe('Base: 3T26 provisório · balanço de 30/09/2026')
    expect(b.pendencia).toBeNull()
  })
})
