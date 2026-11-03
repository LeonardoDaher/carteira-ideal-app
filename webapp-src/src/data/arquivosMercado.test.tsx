import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComDados } from '../ui/ComDados'
import { SNAPSHOT_MERCADO } from './snapshotMercado'
import { carregarDados, dadosProntos, definirDados, limparDadosParaTeste } from './arquivosMercado'

// Aqui o registro começa vazio, ao contrário dos outros testes (que recebem os JSON do disco em testes/prepararDados.ts).
function Tela() {
  return <p>mercado: {SNAPSHOT_MERCADO.indicadores?.selicMeta?.valor ?? 'sem selic'}</p>
}

function respostaJson(corpo: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(corpo) } as Response)
}

describe('carregamento sob demanda dos dados de mercado (D137)', () => {
  beforeEach(() => limparDadosParaTeste())
  afterEach(() => vi.unstubAllGlobals())

  it('mostra "carregando", baixa dados/<chave>.json e só então renderiza a tela, com a constante preenchida', async () => {
    const fetchFalso = vi.fn((..._args: unknown[]) => respostaJson({ indicadores: { selicMeta: { valor: 14.5 } } }))
    vi.stubGlobal('fetch', fetchFalso)
    render(
      <ComDados chaves={['mercadoOficial']}>
        <Tela />
      </ComDados>,
    )
    expect(screen.getByRole('status').textContent).toMatch(/Carregando/)
    expect(screen.queryByText(/mercado:/)).toBeNull()
    await waitFor(() => expect(screen.getByText('mercado: 14.5')).toBeTruthy())
    expect(fetchFalso).toHaveBeenCalledTimes(1)
    expect(String(fetchFalso.mock.calls[0]?.[0])).toMatch(/dados\/mercadoOficial\.json$/)
  })

  it('não baixa de novo o que já está em memória e renderiza na hora, sem passar por "carregando"', () => {
    const fetchFalso = vi.fn()
    vi.stubGlobal('fetch', fetchFalso)
    definirDados('mercadoOficial', { indicadores: { selicMeta: { valor: 10 } } })
    render(
      <ComDados chaves={['mercadoOficial']}>
        <Tela />
      </ComDados>,
    )
    expect(screen.getByText('mercado: 10')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('pedidos simultâneos do mesmo arquivo dividem uma busca só', async () => {
    const fetchFalso = vi.fn(() => respostaJson({ ok: true }))
    vi.stubGlobal('fetch', fetchFalso)
    await Promise.all([carregarDados(['etfs', 'bdrs']), carregarDados(['etfs'])])
    expect(fetchFalso).toHaveBeenCalledTimes(2)
    expect(dadosProntos(['etfs', 'bdrs'])).toBe(true)
  })

  it('se a rede falha, avisa e oferece "Tentar de novo", que baixa outra vez e libera a tela', async () => {
    let tentativa = 0
    vi.stubGlobal('fetch', vi.fn(() => (++tentativa === 1 ? respostaJson({}, false, 503) : respostaJson({ indicadores: { selicMeta: { valor: 12 } } }))))
    render(
      <ComDados chaves={['mercadoOficial']}>
        <Tela />
      </ComDados>,
    )
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Não consegui carregar/))
    expect(screen.queryByText(/mercado:/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByText('mercado: 12')).toBeTruthy())
  })

  it('falha não fica guardada: um novo pedido tenta a rede outra vez', async () => {
    const fetchFalso = vi.fn().mockReturnValueOnce(respostaJson({}, false, 500)).mockReturnValueOnce(respostaJson({ a: 1 }))
    vi.stubGlobal('fetch', fetchFalso)
    await expect(carregarDados(['futuros'])).rejects.toThrow()
    await carregarDados(['futuros'])
    expect(dadosProntos(['futuros'])).toBe(true)
  })
})
