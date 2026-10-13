import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuestionario } from './useQuestionario'

const PERGUNTAS_TESTE: { id: 'p1' | 'p2' | 'p3'; opcoes: { letra: 'a' | 'b' }[] }[] = [
  { id: 'p1', opcoes: [{ letra: 'a' }, { letra: 'b' }] },
  { id: 'p2', opcoes: [{ letra: 'a' }, { letra: 'b' }] },
  { id: 'p3', opcoes: [{ letra: 'a' }, { letra: 'b' }] },
]

function configurar() {
  const onCompletar = vi.fn()
  const onVoltarAntesDoInicio = vi.fn()
  const hook = renderHook(() => useQuestionario(PERGUNTAS_TESTE, { onCompletar, onVoltarAntesDoInicio }))
  return { hook, onCompletar, onVoltarAntesDoInicio }
}

describe('useQuestionario', () => {
  it('começa no passo 0, sem respostas completas', () => {
    const { hook } = configurar()
    expect(hook.result.current.passo).toBe(0)
    expect(hook.result.current.atual.id).toBe('p1')
    expect(hook.result.current.completas).toBeNull()
  })

  it('avança um passo por resposta e não chama onCompletar antes da última pergunta', () => {
    const { hook, onCompletar } = configurar()
    act(() => hook.result.current.responder('a'))
    expect(hook.result.current.passo).toBe(1)
    expect(hook.result.current.respostas.p1).toBe('a')
    expect(onCompletar).not.toHaveBeenCalled()
  })

  it('chama onCompletar e preenche `completas` ao responder a última pergunta', () => {
    const { hook, onCompletar } = configurar()
    act(() => hook.result.current.responder('a'))
    act(() => hook.result.current.responder('b'))
    act(() => hook.result.current.responder('a'))
    expect(onCompletar).toHaveBeenCalledTimes(1)
    expect(hook.result.current.completas).toEqual({ p1: 'a', p2: 'b', p3: 'a' })
  })

  it('voltar em qualquer passo além do primeiro apenas decrementa o passo', () => {
    const { hook, onVoltarAntesDoInicio } = configurar()
    act(() => hook.result.current.responder('a'))
    act(() => hook.result.current.voltar())
    expect(hook.result.current.passo).toBe(0)
    expect(onVoltarAntesDoInicio).not.toHaveBeenCalled()
  })

  it('voltar no passo 0 chama onVoltarAntesDoInicio em vez de decrementar', () => {
    const { hook, onVoltarAntesDoInicio } = configurar()
    act(() => hook.result.current.voltar())
    expect(onVoltarAntesDoInicio).toHaveBeenCalledTimes(1)
    expect(hook.result.current.passo).toBe(0)
  })

  it('reiniciar limpa respostas e volta ao passo 0', () => {
    const { hook } = configurar()
    act(() => hook.result.current.responder('a'))
    act(() => hook.result.current.reiniciar())
    expect(hook.result.current.passo).toBe(0)
    expect(hook.result.current.respostas).toEqual({})
  })

  it('restaurar substitui as respostas sem alterar o passo atual', () => {
    const { hook } = configurar()
    act(() => hook.result.current.responder('a')) // passo vai para 1
    act(() => hook.result.current.restaurar({ p1: 'b', p2: 'b' }))
    expect(hook.result.current.passo).toBe(1)
    expect(hook.result.current.respostas).toEqual({ p1: 'b', p2: 'b' })
  })
})

describe('useQuestionario — perguntas condicionais (D83)', () => {
  type Id = 'p1' | 'extra' | 'p2'
  const PERGUNTAS: { id: Id; opcoes: { letra: 'a' | 'b' }[]; opcional?: boolean }[] = [
    { id: 'p1', opcoes: [{ letra: 'a' }, { letra: 'b' }] },
    { id: 'extra', opcoes: [{ letra: 'a' }, { letra: 'b' }], opcional: true },
    { id: 'p2', opcoes: [{ letra: 'a' }, { letra: 'b' }] },
  ]
  const visivel = (p: { id: string }, r: Partial<Record<Id, 'a' | 'b'>>) => p.id !== 'extra' || r.p1 === 'a'
  const opcional = (p: { opcional?: boolean }) => p.opcional === true

  function montar() {
    const onCompletar = vi.fn()
    const hook = renderHook(() => useQuestionario(PERGUNTAS, { visivel, opcional, onCompletar, onVoltarAntesDoInicio: vi.fn() }))
    return { hook, onCompletar }
  }

  it('a pergunta condicional só entra no fluxo e na contagem quando a condição vale', () => {
    const { hook } = montar()
    expect(hook.result.current.total).toBe(2)
    act(() => hook.result.current.responder('b'))
    expect(hook.result.current.atual.id).toBe('p2')

    const outro = montar()
    act(() => outro.hook.result.current.responder('a'))
    expect(outro.hook.result.current.total).toBe(3)
    expect(outro.hook.result.current.atual.id).toBe('extra')
  })

  it('completa ao responder a última visível e descarta a resposta de pergunta que deixou de aparecer', () => {
    const { hook, onCompletar } = montar()
    act(() => hook.result.current.responder('a')) // p1 = a -> extra aparece
    act(() => hook.result.current.responder('b')) // extra
    act(() => hook.result.current.voltar())
    act(() => hook.result.current.voltar()) // de volta em p1
    act(() => hook.result.current.responder('b')) // p1 = b -> extra some
    expect(hook.result.current.atual.id).toBe('p2')
    act(() => hook.result.current.responder('a'))
    expect(onCompletar).toHaveBeenCalledTimes(1)
    expect(hook.result.current.completas).toEqual({ p1: 'b', p2: 'a' })
  })

  it('pergunta opcional sem resposta não impede `completas`', () => {
    const { hook } = montar()
    act(() => hook.result.current.restaurar({ p1: 'a', p2: 'b' })) // estado antigo: p1 = a, sem o extra
    expect(hook.result.current.completas).toEqual({ p1: 'a', p2: 'b' })
  })
})
