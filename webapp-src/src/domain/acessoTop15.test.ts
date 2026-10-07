import { describe, expect, it, vi } from 'vitest'
import { buscarTop15, buscarTop15Fiis, formatarCodigo, limparCodigoDigitado, mensagemDaFalha } from './acessoTop15'

const resposta = (status: number, corpo: unknown) =>
  vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response) as unknown as typeof fetch

describe('código digitado', () => {
  it('limpa e formata enquanto digita, aceitando minúsculas, espaços e hífens', () => {
    expect(limparCodigoDigitado(' ci-abcd efgh ')).toBe('CIABCDEFGH')
    expect(formatarCodigo('ciabcdefgh')).toBe('CI-ABCD-EFGH')
    expect(formatarCodigo('ci-ab')).toBe('CI-AB')
    expect(formatarCodigo('ci')).toBe('CI')
    expect(formatarCodigo('xyz')).toBe('XYZ')
    expect(formatarCodigo('ciabcdefghijklmnop')).toBe('CI-ABCD-EFGH')
  })
})

describe('buscarTop15', () => {
  const lista = { publicado: true, ranking: [{ ticker: 'AAAA3' }], exclusoes: [] }

  it('200 devolve a lista e envia o código por POST em JSON', async () => {
    const f = resposta(200, lista)
    const r = await buscarTop15('CIABCDEFGH', f)
    expect(r.ok).toBe(true)
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/top15')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ codigo: 'CIABCDEFGH' })
  })
  it('mapeia cada erro do servidor', async () => {
    expect(await buscarTop15('x', resposta(401, { motivo: 'invalido' }))).toEqual({ ok: false, motivo: 'invalido' })
    expect(await buscarTop15('x', resposta(429, { espera: 900 }))).toEqual({ ok: false, motivo: 'limite', espera: 900 })
    expect(await buscarTop15('x', resposta(503, { motivo: 'nao_configurado' }))).toEqual({ ok: false, motivo: 'nao_configurado' })
    expect(await buscarTop15('x', resposta(503, { motivo: 'indisponivel' }))).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(await buscarTop15('x', resposta(500, {}))).toEqual({ ok: false, motivo: 'resposta' })
  })
  it('rede fora e resposta malformada não quebram a tela', async () => {
    expect(await buscarTop15('x', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toEqual({ ok: false, motivo: 'rede' })
    expect(await buscarTop15('x', resposta(200, { publicado: false, ranking: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15('x', resposta(200, { publicado: true }))).toEqual({ ok: false, motivo: 'resposta' })
  })
  it('mensagens em português, sem expor detalhe técnico (e as ações continuam em /api/top15)', () => {
    expect(mensagemDaFalha({ motivo: 'invalido' })).toContain('Instagram')
    expect(mensagemDaFalha({ motivo: 'limite', espera: 900 })).toContain('15 minutos')
    expect(mensagemDaFalha({ motivo: 'rede' })).toContain('internet')
    expect(mensagemDaFalha({ motivo: 'indisponivel' })).toContain('ainda não está disponível')
  })
})

describe('buscarTop15Fiis (D65)', () => {
  const lista = { publicado: true, tijolo: [{ ticker: 'AAAA11' }], papel: [{ ticker: 'BBBB11' }], aConferir: [], exclusoes: [] }

  it('pede à função dos FIIs (e não à das ações), com o mesmo formato de requisição', async () => {
    const f = resposta(200, lista)
    const r = await buscarTop15Fiis('CIABCDEFGH', f)
    expect(r.ok).toBe(true)
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/top15-fiis')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ codigo: 'CIABCDEFGH' })
  })
  it('mapeia cada erro do servidor como na lista de ações', async () => {
    expect(await buscarTop15Fiis('x', resposta(401, { motivo: 'invalido' }))).toEqual({ ok: false, motivo: 'invalido' })
    expect(await buscarTop15Fiis('x', resposta(429, { espera: 900 }))).toEqual({ ok: false, motivo: 'limite', espera: 900 })
    expect(await buscarTop15Fiis('x', resposta(503, { motivo: 'nao_configurado' }))).toEqual({ ok: false, motivo: 'nao_configurado' })
    expect(await buscarTop15Fiis('x', resposta(503, { motivo: 'indisponivel' }))).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(await buscarTop15Fiis('x', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toEqual({ ok: false, motivo: 'rede' })
  })
  it('só aceita 200 com a lista dos FIIs publicada: a lista de ações ou um corpo incompleto não valem', async () => {
    expect(await buscarTop15Fiis('x', resposta(200, { publicado: true, ranking: [{ ticker: 'AAAA3' }], exclusoes: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15Fiis('x', resposta(200, { publicado: false, tijolo: [], papel: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15Fiis('x', resposta(200, { publicado: true, tijolo: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15('x', resposta(200, lista))).toEqual({ ok: false, motivo: 'resposta' })
  })
})