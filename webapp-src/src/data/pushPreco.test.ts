import { describe, expect, it, vi } from 'vitest'
import { ativarPush, chaveParaBytes, desativarPush, pushLigado, sincronizarPush } from './pushPreco'
import type { PushSubscriptionLike } from './pushPreco'

const DADOS = { tickers: ['CMIG4'], taxa: 0.06, avisados: [] as string[] }

function sub(): PushSubscriptionLike {
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/x',
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'AAAAAAAAAA', auth: 'BBBBBBBBBB' } }),
    unsubscribe: vi.fn(async () => true),
  }
}

function ambiente(opc: { suporta?: boolean; ios?: boolean; permissao?: string; pedir?: string; existente?: PushSubscriptionLike | null; chaveOk?: boolean; postOk?: boolean } = {}) {
  const s = opc.existente === undefined ? null : opc.existente
  const criada = sub()
  const pushManager = {
    getSubscription: vi.fn(async () => s),
    subscribe: vi.fn(async () => criada),
  }
  const chamadas: { url: string; init?: RequestInit }[] = []
  const buscar = vi.fn(async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    if (url === '/api/push-chave') return { ok: opc.chaveOk !== false, json: async () => ({ chave: 'BAAAAA' }) }
    return { ok: opc.postOk !== false, status: 204 }
  })
  return {
    amb: {
      suporta: opc.suporta ?? true,
      iosSemInstalar: opc.ios ?? false,
      permissao: () => opc.permissao ?? 'granted',
      pedirPermissao: async () => opc.pedir ?? 'granted',
      registro: async () => ({ pushManager }),
      buscar: buscar as unknown as typeof fetch,
    },
    pushManager, chamadas, criada,
  }
}

describe('aviso de preço teto no aparelho', () => {
  it('liga: pega a chave, pede permissão, cria a inscrição e manda ao servidor', async () => {
    const { amb, pushManager, chamadas } = ambiente({ permissao: 'default', pedir: 'granted' })
    expect(await ativarPush(DADOS, amb)).toBe('ligado')
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    const post = chamadas.find((c) => c.url === '/api/push-inscrever')!
    const corpo = JSON.parse(post.init!.body as string)
    expect(corpo.tickers).toEqual(['CMIG4'])
    expect(corpo.taxa).toBe(0.06)
    expect(corpo.inscricao.keys.auth).toBe('BBBBBBBBBB')
  })

  it('reaproveita a inscrição que já existe em vez de criar outra', async () => {
    const { amb, pushManager } = ambiente({ existente: sub() })
    expect(await ativarPush(DADOS, amb)).toBe('ligado')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('permissão negada, iPhone sem instalar, navegador sem suporte e servidor desligado têm respostas próprias', async () => {
    expect(await ativarPush(DADOS, ambiente({ permissao: 'default', pedir: 'denied' }).amb)).toBe('negado')
    expect(await ativarPush(DADOS, ambiente({ permissao: 'denied' }).amb)).toBe('negado')
    expect(await ativarPush(DADOS, ambiente({ suporta: false }).amb)).toBe('indisponivel')
    expect(await ativarPush(DADOS, ambiente({ suporta: false, ios: true }).amb)).toBe('precisa-instalar')
    expect(await ativarPush(DADOS, ambiente({ chaveOk: false }).amb)).toBe('indisponivel')
  })

  it('se o servidor recusar a inscrição, desfaz a inscrição local', async () => {
    const { amb, criada } = ambiente({ postOk: false })
    expect(await ativarPush(DADOS, amb)).toBe('erro')
    expect(criada.unsubscribe).toHaveBeenCalled()
  })

  it('sincroniza a lista só quando há inscrição, e desliga apagando no servidor e no aparelho', async () => {
    expect(await sincronizarPush(DADOS, ambiente({ existente: null }).amb)).toBe(false)
    const com = ambiente({ existente: sub() })
    expect(await sincronizarPush({ ...DADOS, tickers: ['BBAS3'] }, com.amb)).toBe(true)
    expect(JSON.parse(com.chamadas[0].init!.body as string).tickers).toEqual(['BBAS3'])

    const existente = sub()
    const des = ambiente({ existente })
    await desativarPush(des.amb)
    expect(des.chamadas[0].init?.method).toBe('DELETE')
    expect(existente.unsubscribe).toHaveBeenCalled()
  })

  it('pushLigado só olha a inscrição quando a permissão já foi dada', async () => {
    expect(await pushLigado(ambiente({ permissao: 'default', existente: sub() }).amb)).toBe(false)
    expect(await pushLigado(ambiente({ existente: sub() }).amb)).toBe(true)
    expect(await pushLigado(ambiente({ existente: null }).amb)).toBe(false)
  })

  it('converte a chave pública (base64url) em bytes', () => {
    expect(Array.from(chaveParaBytes('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(chaveParaBytes('_-8'))).toEqual([255, 239])
  })
})
