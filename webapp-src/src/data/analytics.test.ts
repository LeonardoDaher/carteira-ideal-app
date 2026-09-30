import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarEvento } from './analytics'

describe('registrarEvento (métricas anônimas)', () => {
  let beacon: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    beacon = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true })
  })
  afterEach(() => vi.restoreAllMocks())

  async function corpoEnviado(i = 0) {
    const blob = beacon.mock.calls[i][1] as Blob
    return JSON.parse(await blob.text())
  }

  it('envia o evento com um id anônimo que se mantém entre chamadas', async () => {
    await registrarEvento('questionario_iniciado')
    await registrarEvento('suitability_concluido')
    const a = await corpoEnviado(0)
    const b = await corpoEnviado(1)
    expect(a.evento).toBe('questionario_iniciado')
    expect(a.id).toMatch(/^[a-zA-Z0-9-]{8,64}$/)
    expect(b.id).toBe(a.id)
  })

  it('com "unicoPorSessao", conta uma vez só', async () => {
    await registrarEvento('visita', undefined, { unicoPorSessao: true })
    await registrarEvento('visita', undefined, { unicoPorSessao: true })
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it('não envia nada quando o navegador pede "Não rastrear"', async () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    await registrarEvento('visita')
    expect(beacon).not.toHaveBeenCalled()
  })

  it('leva só rótulos agregados no resultado, sem respostas individuais', async () => {
    await registrarEvento('recomendacao_gerada', { perfil: '7. Arrojado Travado (Falso Arrojado)', prazo: 'longo', veto: true })
    const c = await corpoEnviado()
    expect(Object.keys(c.props).sort()).toEqual(['perfil', 'prazo', 'veto'])
  })

  it('nunca lança erro, mesmo se o envio falhar', async () => {
    beacon.mockImplementation(() => {
      throw new Error('falhou')
    })
    await expect(registrarEvento('visita')).resolves.toBeUndefined()
  })
})
