import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { useAppState } from './useAppState'

// A recomendação agora vem de uma chamada de rede (/api/recomendacao), que não existe
// neste ambiente de teste. Substituímos o cliente da API por uma versão que roda o
// mesmo motor (engine.ts) localmente, síncrona por baixo de uma Promise — assim os
// testes continuam validando o comportamento real do fluxo sem precisar de um servidor.
vi.mock('../data/apiRecomendacao', async () => {
  const engine = await import('../domain/engine')
  class ErroRecomendacao extends Error {}
  return {
    ErroRecomendacao,
    buscarRecomendacao: vi.fn((respostas, dados, respostasArquitetura) =>
      Promise.resolve(engine.gerarRecomendacao(respostas, dados, respostasArquitetura)),
    ),
  }
})

/** Responde todas as perguntas de suitability com a letra 'b' (perfil Moderado, sem travas). */
function responderSuitability(result: { current: ReturnType<typeof useAppState> }) {
  for (let i = 0; i < PERGUNTAS.length; i++) {
    act(() => result.current.responderPergunta('b'))
  }
}

/** Responde todas as perguntas de Arquitetura Patrimonial com a letra 'b' (sem acionar veto). */
function responderArquitetura(result: { current: ReturnType<typeof useAppState> }) {
  for (let i = 0; i < PERGUNTAS_ARQUITETURA.length; i++) {
    act(() => result.current.responderPerguntaArquitetura('b'))
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useAppState — navegação', () => {
  it('começa na tela de onboarding e hidrata sem dado salvo', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))
    expect(result.current.screen).toBe('onboarding')
  })

  it('percorre o fluxo completo: onboarding → idade → questionario → questionarioArquitetura → processando → resultado', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.iniciarQuestionario())
    expect(result.current.screen).toBe('idade')

    act(() => result.current.confirmarIdade(35))
    expect(result.current.screen).toBe('questionario')
    expect(result.current.idade).toBe(35)

    responderSuitability(result)
    expect(result.current.screen).toBe('questionarioArquitetura')

    responderArquitetura(result)
    expect(result.current.screen).toBe('processando')

    // O cálculo agora é assíncrono (chamada a /api/recomendacao, mockada acima).
    await waitFor(() => expect(result.current.resultado).not.toBeNull())

    act(() => result.current.finalizarProcessamento())
    expect(result.current.screen).toBe('resultado')
    expect(result.current.resultado).not.toBeNull()
    expect(result.current.resultado?.perfilFinalCarteira).toBeDefined()
  })

  it('voltar na primeira pergunta da Arquitetura Patrimonial devolve à última pergunta de suitability', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.iniciarQuestionario())
    act(() => result.current.confirmarIdade(35))
    responderSuitability(result)
    expect(result.current.screen).toBe('questionarioArquitetura')
    expect(result.current.passoArquitetura).toBe(0)

    // Ao completar o suitability, o cálculo assíncrono já dispara em segundo plano
    // (ele só precisa das 7 respostas de suitability; a Arquitetura é opcional). Aguarda
    // esse efeito terminar antes de seguir, para não vazar uma atualização de estado
    // fora de act() para o próximo teste.
    await act(async () => {
      await Promise.resolve()
    })

    act(() => result.current.voltarPerguntaArquitetura())
    expect(result.current.screen).toBe('questionario')
    expect(result.current.passoAtual).toBe(PERGUNTAS.length - 1)
  })

  it('voltar na primeira pergunta de suitability devolve para a tela de idade', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.iniciarQuestionario())
    act(() => result.current.confirmarIdade(35))
    act(() => result.current.voltarPergunta())
    expect(result.current.screen).toBe('idade')
  })

  it('abrirDetalheAtivo lembra a tela de origem para voltarDoDetalhe', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.setScreen('carteira'))
    act(() => result.current.abrirDetalheAtivo('tesouroSelic'))
    expect(result.current.screen).toBe('detalheAtivo')

    act(() => result.current.voltarDoDetalhe())
    expect(result.current.screen).toBe('carteira')
  })

  it('limparDados reseta idade, respostas e volta para onboarding', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.iniciarQuestionario())
    act(() => result.current.confirmarIdade(50))
    responderSuitability(result)

    await act(async () => result.current.limparDados())

    expect(result.current.screen).toBe('onboarding')
    expect(result.current.idade).toBe(30)
    expect(result.current.respostas).toEqual({})
    expect(result.current.respostasArquitetura).toEqual({})
  })
})

describe('useAppState — persistência', () => {
  it('salva o progresso no localStorage e restaura numa nova instância do hook', async () => {
    const primeira = renderHook(() => useAppState())
    await waitFor(() => expect(primeira.result.current.hidratado).toBe(true))

    act(() => primeira.result.current.iniciarQuestionario())
    act(() => primeira.result.current.confirmarIdade(42))
    responderSuitability(primeira.result)

    await waitFor(() => expect(localStorage.getItem('carteiraideal.estado')).not.toBeNull())

    const segunda = renderHook(() => useAppState())
    await waitFor(() => expect(segunda.result.current.hidratado).toBe(true))

    expect(segunda.result.current.idade).toBe(42)
    expect(segunda.result.current.screen).toBe('questionarioArquitetura')
    expect(segunda.result.current.respostas.objetivo).toBe('b')
  })

  it('descarta progresso de estado salvo com versão diferente, mas preserva o tema', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 999, screen: 'resultado', idade: 99, tema: 'light' }),
    )

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('onboarding')
    expect(result.current.idade).toBe(30)
    expect(result.current.tema).toBe('light')
  })

  it('usa o tema escolhido na landing (chave "theme"), mesmo com outro tema no estado do app', async () => {
    localStorage.setItem('theme', 'light')
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'onboarding', idade: 30, respostas: {}, respostasArquitetura: {}, tema: 'dark' }),
    )
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))
    expect(result.current.tema).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('trocar o tema no app grava na chave da landing, e abrir o app não apaga a escolha', async () => {
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))
    expect(localStorage.getItem('theme')).toBe('light') // não foi sobrescrito pelo padrão escuro
    act(() => result.current.setTema('dark'))
    await waitFor(() => expect(localStorage.getItem('theme')).toBe('dark'))
  })

  it('ignora estado salvo corrompido sem travar o app', async () => {
    localStorage.setItem('carteiraideal.estado', '{ isso não é json válido')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('onboarding')
  })
})

describe('useAppState — link "Ver minha carteira de referência" (?tela=resultado)', () => {
  const url = () => window.location.pathname + window.location.search + window.location.hash

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('abre direto no resultado mesmo se a última tela salva foi outra (ex: trilha)', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'trilha', idade: 42, respostas: {}, respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/?tela=resultado')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('resultado')
  })

  it('remove o parâmetro da URL depois de aplicar, para não prender a navegação seguinte', async () => {
    window.history.replaceState(null, '', '/app/?tela=resultado')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(url()).toBe('/app/')
    act(() => result.current.abrirTrilha('t1'))
    expect(result.current.screen).toBe('trilha')
  })

  it('sem o parâmetro, continua restaurando a última tela salva normalmente', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'carteira', idade: 42, respostas: {}, respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('carteira')
  })

  it('estado salvo por versão anterior numa tela hoje avulsa (ex: trilha) retoma no resultado', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'trilha', idade: 42, respostas: {}, respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('resultado')
  })
})

describe('useAppState — Aprender e Simule FII abertos pela landing (sem questionário)', () => {
  const url = () => window.location.pathname + window.location.search + window.location.hash

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it.each([
    ['aprender', 'aprender'],
    ['simuleFii', 'simuleFii'],
    ['simuleTesouro', 'simuleTesouro'],
  ] as const)('?tela=%s abre a tela sem nenhuma resposta salva', async (parametro, tela) => {
    window.history.replaceState(null, '', `/app/?tela=${parametro}`)

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe(tela)
    expect(result.current.resultado).toBeNull()
    // o parâmetro fica na URL: recarregar a página mantém a pessoa na mesma tela
    expect(url()).toBe(`/app/?tela=${parametro}`)
  })

  it('ignora valores desconhecidos no parâmetro', async () => {
    window.history.replaceState(null, '', '/app/?tela=qualquercoisa')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('onboarding')
  })

  it('não salva as telas avulsas como última tela: o botão amarelo (./app/) volta ao ponto do questionário', async () => {
    const primeira = renderHook(() => useAppState())
    await waitFor(() => expect(primeira.result.current.hidratado).toBe(true))
    act(() => primeira.result.current.iniciarQuestionario())
    act(() => primeira.result.current.confirmarIdade(42))
    responderSuitability(primeira.result)
    await waitFor(() => expect(primeira.result.current.screen).toBe('questionarioArquitetura'))
    primeira.unmount()

    // Pela landing, abre o Aprender e entra numa trilha
    window.history.replaceState(null, '', '/app/?tela=aprender')
    const segunda = renderHook(() => useAppState())
    await waitFor(() => expect(segunda.result.current.hidratado).toBe(true))
    expect(segunda.result.current.screen).toBe('aprender')
    act(() => segunda.result.current.abrirTrilha('t1'))
    expect(segunda.result.current.screen).toBe('trilha')
    await waitFor(() => {
      const salvo = JSON.parse(localStorage.getItem('carteiraideal.estado') ?? '{}')
      expect(salvo.screen).toBe('questionarioArquitetura')
    })
    segunda.unmount()

    // Depois, pelo botão amarelo (sem parâmetro), retoma de onde parou no questionário
    window.history.replaceState(null, '', '/app/')
    const terceira = renderHook(() => useAppState())
    await waitFor(() => expect(terceira.result.current.hidratado).toBe(true))
    expect(terceira.result.current.screen).toBe('questionarioArquitetura')
    expect(terceira.result.current.idade).toBe(42)
  })
})
