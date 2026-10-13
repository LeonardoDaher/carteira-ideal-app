import { describe, expect, it } from 'vitest'
import { validarPayload } from '../../../api/_validacao'

// D83: a API aceita o complemento do Pilar 3 (parteDoSaque) como opcional e rejeita letra inválida.

const respostas = { objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'c', patrimonio: 'c', experiencia: 'c', reacao: 'c' }
const arquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'a',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}

describe('validarPayload — parteDoSaque', () => {
  it('aceita sem o campo (clientes e estados antigos)', () => {
    expect(validarPayload({ respostas, dados: { idade: 35 }, respostasArquitetura: arquitetura }).ok).toBe(true)
  })

  it('aceita as letras a, b e c e as repassa ao motor', () => {
    for (const parte of ['a', 'b', 'c']) {
      const r = validarPayload({ respostas, dados: { idade: 35 }, respostasArquitetura: { ...arquitetura, parteDoSaque: parte } })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.respostasArquitetura?.parteDoSaque).toBe(parte)
    }
  })

  it('rejeita letra inválida ou tipo errado', () => {
    for (const parte of ['d', 'x', 1, null, {}]) {
      const r = validarPayload({ respostas, dados: { idade: 35 }, respostasArquitetura: { ...arquitetura, parteDoSaque: parte } })
      expect(r.ok).toBe(false)
    }
  })
})
