import { describe, expect, it } from 'vitest'
import { VERSAO_MOTOR, gerarRecomendacao } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

// D82: veto (reserva curta, dívida cara ou saque em até 24 meses) recebe no máximo o modelo de médio prazo.

const RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
const risco = (c: Carteira) => RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)

// Moderado, prazo longo (> 5 anos), com reserva, experiência básica, reação calma.
const prazoLongo: RespostasQuestionario = {
  objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'c', patrimonio: 'c', experiencia: 'c', reacao: 'c',
}
const semVeto: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}
const dados = { idade: 35 }

describe('D82 — veto recebe no máximo o modelo de médio prazo', () => {
  it('a versão do motor registra a mudança', () => {
    expect(VERSAO_MOTOR).toMatch(/^2026\.10\.\d+-D\d+$/)
  })

  it.each([
    ['reserva menor que 3 meses (Pilar 1)', { capacidadeFinanceira: 'a' }],
    ['dívida cara (Pilar 2)', { passivoDividas: 'a' }],
  ] as const)('veto por %s com prazo longo cai para médio e fica com 20%% de risco', (_nome, troca) => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...semVeto, ...troca })
    expect(r.vetoAplicado).toBe(true)
    expect(r.prazo).toBe('medio')
    expect(r.regrasAcionadas).toContain('prazo:veto-medio')
    expect(risco(r.carteira)).toBe(20)
    expect(r.alertas.some((a) => a.includes('modelo de médio prazo'))).toBe(true)
  })

  it('sem veto, o prazo longo continua longo', () => {
    const r = gerarRecomendacao(prazoLongo, dados, semVeto)
    expect(r.vetoAplicado).toBe(false)
    expect(r.prazo).toBe('longo')
    expect(r.regrasAcionadas).not.toContain('prazo:veto-medio')
  })

  it('o veto não eleva prazo curto nem médio, e o saque em 24 meses segue como curto', () => {
    expect(gerarRecomendacao({ ...prazoLongo, prazo: 'a' }, dados, { ...semVeto, capacidadeFinanceira: 'a' }).prazo).toBe('curto')
    expect(gerarRecomendacao({ ...prazoLongo, prazo: 'b' }, dados, { ...semVeto, passivoDividas: 'a' }).prazo).toBe('medio')
    const saque = gerarRecomendacao(prazoLongo, dados, { ...semVeto, janelaLiquidez: 'a' })
    expect(saque.prazo).toBe('curto')
    expect(saque.regrasAcionadas).not.toContain('prazo:veto-medio')
  })

  it('veto por Pilar 3 [A] e Pilar 1 [A] ao mesmo tempo continua curto', () => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...semVeto, janelaLiquidez: 'a', capacidadeFinanceira: 'a' })
    expect(r.prazo).toBe('curto')
    expect(risco(r.carteira)).toBeLessThanOrEqual(10)
  })
})
