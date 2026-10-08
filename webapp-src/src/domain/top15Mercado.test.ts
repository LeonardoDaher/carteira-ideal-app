import { describe, expect, it } from 'vitest'
import { ROTULO_ALERTA_BDR, ROTULO_EXCLUSAO_BDR, ROTULO_EXCLUSAO_ETF, buscarExclusaoMercado, contarExclusoesMercado } from './top15Mercado'
import type { ExclusaoMercado } from './top15Mercado'
import { buscarTop15Bdrs } from './acessoTop15'

const ex = (ticker: string, codigo: string, nome: string | null = `Ativo ${ticker}`): ExclusaoMercado => ({ ticker, nome, codigo, motivo: 'motivo' })

describe('buscarExclusaoMercado', () => {
  const lista = [ex('HASH11', 'liquidez_baixa', 'Hashdex Nasdaq Crypto'), ex('AAPL34', 'liquidez_baixa', 'Apple'), ex('ÁGUA34', 'sem_negocio', null)]
  it('busca por código ou nome, sem diferenciar maiúsculas nem acentos, a partir de 2 caracteres', () => {
    expect(buscarExclusaoMercado(lista, 'hash').map((e) => e.ticker)).toEqual(['HASH11'])
    expect(buscarExclusaoMercado(lista, 'APPLE').map((e) => e.ticker)).toEqual(['AAPL34'])
    expect(buscarExclusaoMercado(lista, 'agua').map((e) => e.ticker)).toEqual(['ÁGUA34'])
    expect(buscarExclusaoMercado(lista, 'h')).toEqual([])
    expect(buscarExclusaoMercado(lista, '  ')).toEqual([])
    expect(buscarExclusaoMercado(lista, 'zzzz')).toEqual([])
  })
  it('devolve no máximo 8 resultados', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ex(`ABC${i}34`, 'liquidez_baixa'))
    expect(buscarExclusaoMercado(muitos, 'abc')).toHaveLength(8)
  })
})

describe('contarExclusoesMercado', () => {
  it('agrupa por motivo, do mais frequente ao menos, desempata pelo rótulo e usa o código se o motivo for novo', () => {
    const r = contarExclusoesMercado([ex('A', 'liquidez_baixa'), ex('B', 'liquidez_baixa'), ex('C', 'sem_negocio'), ex('D', 'excluido_manual'), ex('E', 'novo')], ROTULO_EXCLUSAO_ETF)
    expect(r.map((x) => [x.codigo, x.total])).toEqual([['liquidez_baixa', 2], ['excluido_manual', 1], ['novo', 1], ['sem_negocio', 1]])
    expect(r[0].rotulo).toBe('Pouca liquidez')
    expect(r.find((x) => x.codigo === 'novo')?.rotulo).toBe('novo')
    expect(contarExclusoesMercado([], ROTULO_EXCLUSAO_BDR)).toEqual([])
  })
})

describe('rótulos', () => {
  it('há texto para todos os motivos de exclusão que o cálculo gera e para os dois alertas dos BDRs', () => {
    for (const c of ['excluido_manual', 'sem_negocio', 'cotacao_defasada', 'poucos_dias_negociados', 'liquidez_baixa']) {
      expect(ROTULO_EXCLUSAO_ETF[c], `ETF ${c}`).toBeTruthy()
      expect(ROTULO_EXCLUSAO_BDR[c], `BDR ${c}`).toBeTruthy()
    }
    expect(ROTULO_EXCLUSAO_BDR.historico_curto).toBeTruthy()
    expect(Object.keys(ROTULO_ALERTA_BDR).sort()).toEqual(['desconto_extremo', 'salto_de_preco'])
    for (const a of Object.values(ROTULO_ALERTA_BDR)) expect(a.titulo.length > 5 && a.texto.length > 30).toBe(true)
  })
})

describe('buscarTop15Bdrs', () => {
  const resposta = (status: number, corpo: unknown) =>
    (async () => ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response) as unknown as typeof fetch
  const lista = { publicado: true, ranking: [{ ticker: 'ORCL34' }], aConferir: [], exclusoes: [] }

  it('pede à função dos BDRs (/api/top15-bdrs) com o código por POST', async () => {
    const chamadas: [string, RequestInit][] = []
    const f = (async (url: string, init: RequestInit) => { chamadas.push([url, init]); return { ok: true, status: 200, json: async () => lista } as unknown as Response }) as unknown as typeof fetch
    const r = await buscarTop15Bdrs('CIABCDEFGH', f)
    expect(r.ok).toBe(true)
    expect(chamadas[0][0]).toBe('/api/top15-bdrs')
    expect(chamadas[0][1].method).toBe('POST')
    expect(JSON.parse(chamadas[0][1].body as string)).toEqual({ codigo: 'CIABCDEFGH' })
  })
  it('mapeia os erros do servidor e rejeita corpo que não é a lista dos BDRs', async () => {
    expect(await buscarTop15Bdrs('x', resposta(401, { motivo: 'invalido' }))).toEqual({ ok: false, motivo: 'invalido' })
    expect(await buscarTop15Bdrs('x', resposta(429, { espera: 900 }))).toEqual({ ok: false, motivo: 'limite', espera: 900 })
    expect(await buscarTop15Bdrs('x', resposta(503, { motivo: 'nao_configurado' }))).toEqual({ ok: false, motivo: 'nao_configurado' })
    expect(await buscarTop15Bdrs('x', (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toEqual({ ok: false, motivo: 'rede' })
    expect(await buscarTop15Bdrs('x', resposta(200, { publicado: true, tijolo: [], papel: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15Bdrs('x', resposta(200, { publicado: false, ranking: [], aConferir: [] }))).toEqual({ ok: false, motivo: 'resposta' })
    expect(await buscarTop15Bdrs('x', resposta(200, { publicado: true, ranking: [] }))).toEqual({ ok: false, motivo: 'resposta' })
  })
})
