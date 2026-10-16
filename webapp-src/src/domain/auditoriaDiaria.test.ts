import { describe, expect, it } from 'vitest'
import { introAuditoria, notaAuditoriaDiaria } from './auditoriaDiaria'

describe('textos da auditoria diária (D89)', () => {
  it('arquivo antigo, sem o campo, ou execução completa: o texto de sempre e nenhuma nota extra', () => {
    for (const s of [{}, { modoAuditoria: 'completa' as const }, { modoAuditoria: null }]) {
      expect(introAuditoria(s)).toBe('Toda execução grava, no repositório do projeto, a pasta')
      expect(notaAuditoriaDiaria(s)).toBeNull()
    }
  })

  it('execução diária: diz que o ranking é do dia, conferido, e que a pasta completa é mensal, com a data dela', () => {
    const s = { modoAuditoria: 'diaria' as const, auditoriaCompletaEm: '2026-10-08' }
    const intro = introAuditoria(s)
    expect(intro).toContain('recalculado todo dia útil')
    expect(intro).toContain('segundo cálculo independente')
    expect(intro).toContain('uma vez por mês')
    expect(intro).toContain('08/10/2026')
    expect(intro).not.toContain('Toda execução grava')
    expect(notaAuditoriaDiaria(s)).toContain('impressão digital do resultado')
  })

  it('execução diária sem a data da pasta: não inventa data', () => {
    const intro = introAuditoria({ modoAuditoria: 'diaria' })
    expect(intro).not.toMatch(/\(de /)
    expect(intro.endsWith('é')).toBe(true)
  })
})
