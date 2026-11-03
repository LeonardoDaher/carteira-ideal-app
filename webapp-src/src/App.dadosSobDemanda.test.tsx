import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * Teste de integração do carregamento sob demanda (D137), na ORDEM DE PRODUÇÃO. Os outros testes recebem os JSON de mercado
 * antes de qualquer módulo carregar (testes/prepararDados.ts), e por isso nunca viram um erro que só acontece no navegador:
 * um módulo que copia um SNAPSHOT_* no nível do módulo (como o SimuleTesouro fazia) fica com a cópia vazia. Aqui cada tela abre
 * com os módulos recém-carregados e o registro VAZIO, e os arquivos só chegam por `fetch`, como no site publicado.
 */
const jsons = import.meta.glob<{ default: unknown }>('./data/*.json', { eager: true })

// Telas abertas por ?tela= (o `carteira`, o `simulador` e o `detalheAtivo` exigem o questionário respondido e têm teste próprio).
const TELAS = ['simuleFii', 'simuleTesouro', 'simuleBdr', 'simuleEtf', 'simuleFuturos', 'simuleOpcoes', 'simuleAcoes', 'simuleImovel', 'simuleCarro', 'simuleMoto', 'minhaCarteira'] as const

describe('telas abertas com o registro de dados vazio, como em produção', () => {
  let baixados: string[]

  beforeEach(() => {
    localStorage.clear()
    baixados = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) => {
        const m = String(url).match(/dados\/(\w+)\.json$/)
        const modulo = m && jsons[`./data/${m[1]}.json`]
        if (!modulo) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) } as Response)
        baixados.push(m[1])
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(modulo.default) } as Response)
      }),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  for (const tela of TELAS) {
    it(`${tela}: baixa só o que a tabela diz e abre sem erro`, async () => {
      vi.resetModules() // módulos novos + registro vazio (a pré-carga dos testes ficou na instância antiga)
      const { default: App } = await import('./App')
      const { DADOS_DA_TELA } = await import('./data/dadosDaTela')
      const { CHAVES_DE_DADOS } = await import('./data/arquivosMercado')
      window.history.replaceState(null, '', `/app/?tela=${tela}`)

      render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>,
      )
      await waitFor(() => expect(screen.queryByText(/Carregando os dados de mercado/)).toBeNull(), { timeout: 20000 })
      // Dá um instante para efeitos que rodam depois da primeira pintura da tela.
      await new Promise((r) => setTimeout(r, 50))

      expect(screen.queryByText('Algo deu errado')).toBeNull()
      expect(screen.queryByText(/Não consegui carregar os dados/)).toBeNull()
      const esperados = [...(DADOS_DA_TELA as Record<string, readonly string[] | undefined>)[tela] ?? []].sort()
      expect([...new Set(baixados)].filter((c) => (CHAVES_DE_DADOS as readonly string[]).includes(c)).sort()).toEqual(esperados)
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(200)
    }, 60000)
  }

  it('a tela inicial não baixa nenhum arquivo de mercado', async () => {
    vi.resetModules()
    const { default: App } = await import('./App')
    window.history.replaceState(null, '', '/app/')
    render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    )
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50))
    expect(baixados).toEqual([])
  })
})
