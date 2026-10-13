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
  // 7 perguntas sempre visíveis; o complemento do Pilar 3 (D83) só aparece com o [A].
  for (let i = 0; i < PERGUNTAS_ARQUITETURA.length - 1; i++) {
    act(() => result.current.responderPerguntaArquitetura('b'))
  }
}

/** Estado salvo com as 7 respostas de suitability completas (o que um resultado de verdade deixa gravado). */
function respostasCompletasSalvas() {
  return Object.fromEntries(PERGUNTAS.map((p) => [p.id, 'b']))
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
      JSON.stringify({ versao: 2, screen: 'carteira', idade: 42, respostas: respostasCompletasSalvas(), respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('carteira')
  })

  it('estado salvo em resultado/carteira/simulador SEM respostas (gravado por engano) abre o onboarding', async () => {
    for (const tela of ['resultado', 'carteira', 'simulador', 'detalheAtivo']) {
      localStorage.setItem(
        'carteiraideal.estado',
        JSON.stringify({ versao: 2, screen: tela, idade: 30, respostas: {}, respostasArquitetura: {}, tema: 'dark' }),
      )
      window.history.replaceState(null, '', '/app/')

      const { result, unmount } = renderHook(() => useAppState())
      await waitFor(() => expect(result.current.hidratado).toBe(true))

      expect(result.current.screen).toBe('onboarding')
      unmount()
    }
  })

  it('suitability incompleto (só algumas respostas) também não restaura o resultado', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'resultado', idade: 30, respostas: { objetivo: 'b' }, respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('onboarding')
  })

  it('o fluxo no meio do questionário continua sendo restaurado (a correção não afeta quem está respondendo)', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'questionario', idade: 42, respostas: { objetivo: 'b' }, respostasArquitetura: {}, tema: 'dark' }),
    )
    window.history.replaceState(null, '', '/app/')

    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    expect(result.current.screen).toBe('questionario')
    expect(result.current.respostas.objetivo).toBe('b')
  })

  it('tocar em Perfil/Carteira sem ter respondido não grava essa tela como ponto de retomada', async () => {
    const { result } = renderHook(() => useAppState())
    await waitFor(() => expect(result.current.hidratado).toBe(true))

    act(() => result.current.setScreen('resultado'))
    expect(result.current.screen).toBe('resultado') // a pessoa vê o convite, como sempre
    await waitFor(() => {
      const salvo = JSON.parse(localStorage.getItem('carteiraideal.estado') ?? '{}')
      expect(salvo.screen).toBe('onboarding')
    })

    act(() => result.current.setScreen('carteira'))
    await waitFor(() => {
      const salvo = JSON.parse(localStorage.getItem('carteiraideal.estado') ?? '{}')
      expect(salvo.screen).toBe('onboarding')
    })
  })

  it('com as respostas completas, o resultado continua sendo gravado e restaurado', async () => {
    const primeira = renderHook(() => useAppState())
    await waitFor(() => expect(primeira.result.current.hidratado).toBe(true))
    act(() => primeira.result.current.iniciarQuestionario())
    act(() => primeira.result.current.confirmarIdade(35))
    responderSuitability(primeira.result)
    responderArquitetura(primeira.result)
    await waitFor(() => expect(primeira.result.current.resultado).not.toBeNull())
    act(() => primeira.result.current.setScreen('resultado'))
    await waitFor(() => {
      const salvo = JSON.parse(localStorage.getItem('carteiraideal.estado') ?? '{}')
      expect(salvo.screen).toBe('resultado')
    })

    const segunda = renderHook(() => useAppState())
    await waitFor(() => expect(segunda.result.current.hidratado).toBe(true))
    expect(segunda.result.current.screen).toBe('resultado')
  })

  it('estado salvo por versão anterior numa tela hoje avulsa (ex: trilha) retoma no resultado', async () => {
    localStorage.setItem(
      'carteiraideal.estado',
      JSON.stringify({ versao: 2, screen: 'trilha', idade: 42, respostas: respostasCompletasSalvas(), respostasArquitetura: {}, tema: 'dark' }),
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
    ['simuleBdr', 'simuleBdr'],
    ['simuleEtf', 'simuleEtf'],
    ['simuleAtivos', 'simuleAtivos'],
    ['simuleAcoes', 'simuleAcoes'],
    ['simuleImovel', 'simuleImovel'],
    ['simuleCarro', 'simuleCarro'],
    ['simuleMoto', 'simuleMoto'],
    ['simuleBens', 'simuleBens'],
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

describe('useAppState — complemento do Pilar 3 (D83)', () => {
  async function chegarNaArquitetura() {
    const hook = renderHook(() => useAppState())
    await waitFor(() => expect(hook.result.current.hidratado).toBe(true))
    act(() => hook.result.current.iniciarQuestionario())
    act(() => hook.result.current.confirmarIdade(35))
    responderSuitability(hook.result)
    return hook.result
  }

  it('sem saque em até 24 meses, o questionário tem 14 perguntas e o complemento não aparece', async () => {
    const result = await chegarNaArquitetura()
    expect(result.current.totalPerguntasCombinado).toBe(14)
    act(() => result.current.responderPerguntaArquitetura('b')) // Pilar 1
    act(() => result.current.responderPerguntaArquitetura('b')) // Pilar 2
    act(() => result.current.responderPerguntaArquitetura('b')) // Pilar 3 [B]
    expect(result.current.perguntaArquiteturaAtual.id).toBe('comportamentoEstresse')
    expect(result.current.totalPerguntasCombinado).toBe(14)
  })

  it('com [A] no Pilar 3 aparece o complemento (15 perguntas) e a resposta chega ao motor', async () => {
    const result = await chegarNaArquitetura()
    act(() => result.current.responderPerguntaArquitetura('c')) // Pilar 1
    act(() => result.current.responderPerguntaArquitetura('c')) // Pilar 2
    act(() => result.current.responderPerguntaArquitetura('a')) // Pilar 3 [A]
    expect(result.current.perguntaArquiteturaAtual.id).toBe('parteDoSaque')
    expect(result.current.totalPerguntasCombinado).toBe(15)

    act(() => result.current.responderPerguntaArquitetura('c')) // menos de um quarto
    expect(result.current.perguntaArquiteturaAtual.id).toBe('comportamentoEstresse')
    for (let i = 0; i < 4; i++) act(() => result.current.responderPerguntaArquitetura('b'))
    expect(result.current.screen).toBe('processando')
    await waitFor(() => expect(result.current.resultado?.vetoAplicado).toBeDefined())
    expect(result.current.resultado?.vetoAplicado).toBe(false)
    expect(result.current.resultado?.prazo).not.toBe('longo')
  })

  it('voltar ao Pilar 3 e mudar para [B] esconde o complemento e descarta a resposta dele', async () => {
    const result = await chegarNaArquitetura()
    act(() => result.current.responderPerguntaArquitetura('c'))
    act(() => result.current.responderPerguntaArquitetura('c'))
    act(() => result.current.responderPerguntaArquitetura('a'))
    act(() => result.current.responderPerguntaArquitetura('b')) // parteDoSaque [B]
    act(() => result.current.voltarPerguntaArquitetura()) // Pilar 4 -> volta ao complemento
    act(() => result.current.voltarPerguntaArquitetura()) // complemento -> Pilar 3
    expect(result.current.perguntaArquiteturaAtual.id).toBe('janelaLiquidez')
    act(() => result.current.responderPerguntaArquitetura('c')) // muda o Pilar 3
    expect(result.current.perguntaArquiteturaAtual.id).toBe('comportamentoEstresse')
    expect(result.current.totalPerguntasCombinado).toBe(14)
    for (let i = 0; i < 4; i++) act(() => result.current.responderPerguntaArquitetura('b'))
    await waitFor(() => expect(result.current.resultado?.vetoAplicado).toBeDefined())
    expect(result.current.resultado?.regrasAcionadas?.some((r) => r.startsWith('prazo:saque'))).toBe(false)
  })
})
