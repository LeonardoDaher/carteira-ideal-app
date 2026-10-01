import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { PERGUNTAS } from './data/questions'
import { PERGUNTAS_ARQUITETURA } from './data/perguntasArquitetura'
import type { ResultadoRecomendacao } from './domain/types'

// A API REAL demora (rede + função serverless). Os outros testes do app usam um mock que responde na
// hora, e por isso nunca viram o "piscar" de tela que a pessoa vê ao reabrir o app: aqui a resposta
// só chega quando o teste manda, como acontece de verdade.
const pendentes = vi.hoisted(() => [] as { resolver: (r: unknown) => void; rejeitar: (e: Error) => void }[])
vi.mock('./data/apiRecomendacao', () => {
  class ErroRecomendacao extends Error {}
  return {
    ErroRecomendacao,
    buscarRecomendacao: vi.fn(() => new Promise((resolver, rejeitar) => pendentes.push({ resolver, rejeitar }))),
  }
})

const CHAVE = 'carteiraideal.estado'
const CONVITE = /Responda o questionário para (ver seu resultado|ver a carteira de referência|simular valores)/
const TODAS_AS_RESPOSTAS = Object.fromEntries(PERGUNTAS.map((p) => [p.id, 'b']))
const TODAS_DA_ARQUITETURA = Object.fromEntries(PERGUNTAS_ARQUITETURA.map((p) => [p.id, 'b']))

/** Estado que o app deixa gravado quando a pessoa já respondeu tudo e saiu da tela indicada. */
function gravarEstado(screen: string, extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    CHAVE,
    JSON.stringify({ versao: 2, screen, idade: 35, respostas: TODAS_AS_RESPOSTAS, respostasArquitetura: TODAS_DA_ARQUITETURA, tema: 'dark', ...extra }),
  )
}

async function resultadoDeVerdade(): Promise<ResultadoRecomendacao> {
  const { gerarRecomendacao } = await import('./domain/engine')
  return gerarRecomendacao(TODAS_AS_RESPOSTAS as never, { idade: 35 }, TODAS_DA_ARQUITETURA as never)
}

beforeEach(() => {
  localStorage.clear()
  pendentes.length = 0
  window.history.replaceState(null, '', '/')
})
afterEach(() => vi.clearAllMocks())

async function abrirApp() {
  render(<App />)
  // espera o app terminar de ler o aparelho (antes disso ele não desenha nada, de propósito)
  await waitFor(() => expect(document.querySelector('.app-frame[class*="tela-"]')).toBeTruthy())
}

describe('reabrir o app depois de responder o questionário (API ainda calculando)', () => {
  it.each([
    ['resultado', 'Resultado'],
    ['carteira', 'Carteira'],
    ['simulador', 'Simulador'],
  ])('tela %s: NÃO mostra "Responda o questionário" enquanto a carteira está sendo calculada', async (tela) => {
    gravarEstado(tela)
    await abrirApp()
    // Logo no primeiro quadro depois de ler o aparelho: a pessoa já respondeu tudo, então o convite para
    // responder seria falso, mesmo antes de o pedido à API ter saído.
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/Montando sua carteira/)
    // e continua assim enquanto o servidor não responde
    await waitFor(() => expect(pendentes.length).toBeGreaterThan(0))
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('em NENHUM momento o convite chega a ser inserido na tela (observa todas as mudanças, não só o estado final)', async () => {
    gravarEstado('resultado')
    let convitesInseridos = 0
    const observador = new MutationObserver((registros) => {
      for (const r of registros) for (const n of Array.from(r.addedNodes)) if (CONVITE.test(n.textContent ?? '')) convitesInseridos++
    })
    observador.observe(document.body, { childList: true, subtree: true, characterData: true })

    await abrirApp()
    await waitFor(() => expect(pendentes.length).toBeGreaterThan(0))
    const res = await resultadoDeVerdade()
    await act(async () => pendentes[pendentes.length - 1].resolver(res))
    expect(await screen.findByText(/Seu perfil de carteira de referência/)).toBeTruthy()

    observador.disconnect()
    expect(convitesInseridos).toBe(0)
  })

  it('quando a resposta chega, a tela mostra o resultado e o aviso de carregamento some', async () => {
    gravarEstado('resultado')
    await abrirApp()
    expect(screen.getByRole('status')).toBeTruthy()
    const res = await resultadoDeVerdade()
    await act(async () => pendentes[pendentes.length - 1].resolver(res))
    expect(await screen.findByText(/Seu perfil de carteira de referência/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(CONVITE)).toBeNull()
  })

  it('se a API falhar, mostra o erro com "Tentar novamente" (e não o convite para responder de novo)', async () => {
    gravarEstado('resultado')
    await abrirApp()
    await act(async () => pendentes[pendentes.length - 1].rejeitar(new Error('sem internet')))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy()

    const antes = pendentes.length
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    await waitFor(() => expect(pendentes.length).toBe(antes + 1)) // pediu de novo
    expect(screen.getByRole('status')).toBeTruthy()
    const res = await resultadoDeVerdade()
    await act(async () => pendentes[pendentes.length - 1].resolver(res))
    expect(await screen.findByText(/Seu perfil de carteira de referência/)).toBeTruthy()
  })
})

describe('quem NUNCA respondeu continua vendo o convite (sem carregamento falso)', () => {
  it('abrir a tela Resultado pela URL sem respostas mostra o convite, sem chamar a API', async () => {
    window.history.replaceState(null, '', '/?tela=resultado')
    await abrirApp()
    expect(await screen.findByText(/Responda o questionário para ver seu resultado/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(pendentes.length).toBe(0)
  })
  it('com só parte das respostas, também mostra o convite', async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ versao: 2, screen: 'questionario', idade: 30, respostas: { [PERGUNTAS[0].id]: 'b' }, respostasArquitetura: {}, tema: 'dark' }))
    window.history.replaceState(null, '', '/?tela=resultado')
    await abrirApp()
    expect(await screen.findByText(/Responda o questionário para ver seu resultado/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('reabrir na tela de detalhe de um ativo', () => {
  it('o ativo escolhido não é gravado, então a pessoa volta para o Resultado (e não para "Nenhum ativo selecionado")', async () => {
    gravarEstado('detalheAtivo')
    await abrirApp()
    expect(document.querySelector('.app-frame.tela-detalheAtivo')).toBeNull()
    expect(document.querySelector('.app-frame.tela-resultado')).toBeTruthy()
    expect(screen.queryByText(/Nenhum ativo selecionado/)).toBeNull()
  })
})
