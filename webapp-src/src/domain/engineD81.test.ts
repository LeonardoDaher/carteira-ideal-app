import { describe, expect, it } from 'vitest'
import { VERSAO_MOTOR, gerarRecomendacao } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

// D81: o piso de liquidez de quem não tem reserva sai primeiro da renda fixa longa, não do risco.

const RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
const risco = (c: Carteira) => RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)

// Moderado (18 pontos), sem reserva, prazo médio, experiência básica, reação calma.
const semReserva: RespostasQuestionario = {
  objetivo: 'c', prazo: 'b', tolerancia: 'c', reserva: 'a', patrimonio: 'c', experiencia: 'c', reacao: 'c',
}
const equilibrado: RespostasArquitetura = {
  capacidadeFinanceira: 'b', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}

describe('D81 — piso de liquidez sai da renda fixa longa', () => {
  it('a versão do motor registra a mudança', () => {
    // a versão segue em frente a cada mudança de regra; aqui só o formato é conferido.
    expect(VERSAO_MOTOR).toMatch(/^2026\.10\.\d+-D\d+$/)
  })

  it('sem reserva, o piso de 20% é cumprido sem reduzir o risco que o teto já permitia', () => {
    const r = gerarRecomendacao(semReserva, { idade: 35 }, equilibrado)
    expect(r.regrasAcionadas).toContain('piso:liquidez-sem-reserva')
    expect((r.carteira.tesouroSelic ?? 0) + (r.carteira.cdbLiquidez ?? 0)).toBeGreaterThanOrEqual(20)
    // Equilibrado de médio prazo: 6 + 11 + 12 + 4 + 4 = 37 de risco, dentro do teto do Moderado (45).
    expect(risco(r.carteira)).toBe(37)
  })

  it('quem declara mais capacidade (sem veto) não recebe menos risco do que quem caiu no veto', () => {
    const s: RespostasQuestionario = { objetivo: 'a', prazo: 'd', tolerancia: 'b', reserva: 'a', patrimonio: 'c', experiencia: 'b', reacao: 'a' }
    const a: RespostasArquitetura = {
      capacidadeFinanceira: 'c', passivoDividas: 'b', janelaLiquidez: 'b',
      comportamentoEstresse: 'a', dependenciaRenda: 'a', capitalHumano: 'a', eficienciaFiscal: 'a',
    }
    const semVeto = gerarRecomendacao(s, { idade: 35 }, a)
    const comVeto = gerarRecomendacao(s, { idade: 35 }, { ...a, passivoDividas: 'a' })
    expect(comVeto.vetoAplicado).toBe(true)
    expect(risco(semVeto.carteira)).toBeGreaterThanOrEqual(risco(comVeto.carteira))
  })
})
