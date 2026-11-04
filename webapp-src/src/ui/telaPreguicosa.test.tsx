import { cleanup, render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { telaPreguicosa } from './telaPreguicosa'

// D138: cada tela é um arquivo próprio. Aqui o que importa é o que acontece quando o arquivo não vem.
const CHAVE = 'ci:recarga-por-arquivo-antigo'
const ctx = {} as never

describe('telaPreguicosa', () => {
  const recarregar = vi.fn()

  beforeEach(() => {
    sessionStorage.clear()
    recarregar.mockReset()
    vi.stubGlobal('location', { ...window.location, reload: recarregar })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('mostra a tela quando o arquivo chega e limpa a trava de recarga', async () => {
    sessionStorage.setItem(CHAVE, '1')
    const Tela = telaPreguicosa(() => Promise.resolve({ Oi: () => <p>olá</p> }), 'Oi')
    render(
      <Suspense fallback={<p>carregando</p>}>
        <Tela ctx={ctx} />
      </Suspense>,
    )
    expect(await screen.findByText('olá')).toBeTruthy()
    expect(sessionStorage.getItem(CHAVE)).toBeNull()
    expect(recarregar).not.toHaveBeenCalled()
  })

  it('arquivo ausente: na primeira falha recarrega a página uma vez e guarda a trava', async () => {
    const Tela = telaPreguicosa(() => Promise.reject(new Error('404')), 'Oi')
    render(
      <Suspense fallback={<p>carregando</p>}>
        <Tela ctx={ctx} />
      </Suspense>,
    )
    await vi.waitFor(() => expect(recarregar).toHaveBeenCalledTimes(1))
    expect(sessionStorage.getItem(CHAVE)).toBe('1')
    expect(screen.getByText('carregando')).toBeTruthy() // fica esperando a recarga, sem piscar erro
  })

  it('arquivo ausente de novo depois da recarga: NÃO recarrega outra vez, o erro sobe para a tela de erro', async () => {
    sessionStorage.setItem(CHAVE, '1')
    const Tela = telaPreguicosa(() => Promise.reject(new Error('404')), 'Oi')
    const { ErrorBoundary } = await import('../ErrorBoundary')
    render(
      <ErrorBoundary>
        <Suspense fallback={<p>carregando</p>}>
          <Tela ctx={ctx} />
        </Suspense>
      </ErrorBoundary>,
    )
    expect(await screen.findByText('Algo deu errado')).toBeTruthy()
    expect(recarregar).not.toHaveBeenCalled()
  })

  it('preload() baixa o arquivo sem derrubar nada se falhar', async () => {
    const importar = vi.fn(() => Promise.reject(new Error('sem rede')))
    const Tela = telaPreguicosa(importar, 'Oi')
    await expect(Tela.preload()).resolves.toBeUndefined()
    expect(importar).toHaveBeenCalledTimes(1)
  })
})
