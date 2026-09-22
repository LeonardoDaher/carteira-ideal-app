import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function ComponenteComErro(): never {
  throw new Error('falha proposital de teste')
}

describe('ErrorBoundary', () => {
  it('renderiza os filhos normalmente quando não há erro', () => {
    render(
      <ErrorBoundary>
        <div>conteúdo normal</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('conteúdo normal')).toBeDefined()
  })

  it('exibe a tela de fallback em vez de quebrar quando um filho lança uma exceção', () => {
    // React (e o jsdom) logam o erro no console durante o teste; silenciamos aqui de propósito.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ComponenteComErro />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Algo deu errado')).toBeDefined()
    expect(screen.getByText('Recomeçar o app')).toBeDefined()

    consoleErrorSpy.mockRestore()
  })
})
