import { describe, expect, it } from 'vitest'
import { fundamentoDoAtivo, montarIndiceFundamentos, raizDoTicker } from './fundamentosPremios'
import { FILTRO_PREMIOS_PADRAO, calcularTopPremios } from './premios'
import type { FiltroPremios } from './premios'
import type { SnapshotAcoesEndividadas } from './acoesEndividadas'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes } from './opcoes'
import { precoBs } from './simulaOpcoes'

/** Lista das mais endividadas no formato do arquivo, só com o que o cruzamento lê (tamanho do Top = 2, para o teste). */
export const endividadasDeTeste = (parcial: Partial<SnapshotAcoesEndividadas> = {}): SnapshotAcoesEndividadas =>
  ({
    publicado: true,
    tamanhoDaLista: 2,
    dataCorte: '2026-10-05',
    dataPrecos: '2026-10-16',
    ranking: [
      { ticker: 'AGRO3', dlEbitda: 35.3 },
      { ticker: 'MGLU3', dlEbitda: 9.5, posicao: 2 },
    ],
    restante: [
      { ticker: 'VALE3', nome: 'VALE', setor: 'Mineração', posicao: 3, dlEbitda: 1.2 },
      { ticker: 'MRVE3', nome: 'MRV', setor: 'Construção', posicao: 4, dlEbitda: 3.9 },
    ],
    semEbitdaPositivo: [{ ticker: 'AMER3', dlEbitda: null }],
    ...parcial,
  }) as unknown as SnapshotAcoesEndividadas

describe('montarIndiceFundamentos', () => {
  const indice = montarIndiceFundamentos(endividadasDeTeste())!

  it('indexa por empresa, com a posição pelo lugar na lista quando ela não vem no item', () => {
    expect(fundamentoDoAtivo(indice, 'AGRO3')).toEqual({ posicao: 1, dlEbitda: 35.3, semEbitdaPositivo: false, noTop: true })
    expect(fundamentoDoAtivo(indice, 'MGLU3')).toMatchObject({ posicao: 2, noTop: true })
    expect(fundamentoDoAtivo(indice, 'VALE3')).toEqual({ posicao: 3, dlEbitda: 1.2, semEbitdaPositivo: false, noTop: false })
    expect(indice.total).toBe(4) // quem tem a razão calculada; a lista sem EBITDA positivo fica à parte
  })

  it('empresa sem EBITDA positivo é marcada à parte, sem razão', () => {
    expect(fundamentoDoAtivo(indice, 'AMER3')).toEqual({ posicao: null, dlEbitda: null, semEbitdaPositivo: true, noTop: false })
  })

  it('outra classe de ação da mesma empresa acha a mesma linha, e empresa fora do universo dá null', () => {
    expect(raizDoTicker('mglu3')).toBe('MGLU')
    expect(fundamentoDoAtivo(indice, 'MGLU4')).toMatchObject({ posicao: 2 })
    expect(fundamentoDoAtivo(indice, 'BOVA11')).toBeNull()
    expect(fundamentoDoAtivo(null, 'MGLU3')).toBeNull()
  })

  it('lista não publicada ou vazia não vira índice', () => {
    expect(montarIndiceFundamentos(endividadasDeTeste({ publicado: false }))).toBeNull()
    expect(montarIndiceFundamentos(endividadasDeTeste({ ranking: [], restante: [], semEbitdaPositivo: [] }))).toBeNull()
    expect(montarIndiceFundamentos(null)).toBeNull()
  })
})

describe('calcularTopPremios cruzado com as listas', () => {
  const HOJE = '2026-10-16'
  const r = Math.log(1.1375)
  const serie = (codigo: string, cotacao: number): SerieOpcao => ({
    codigo, tipo: 'put', estilo: 'europeia', strike: cotacao * 0.9, vencimento: '2026-11-19',
    ultimo: Math.round(precoBs({ tipo: 'put', s: cotacao, strike: cotacao * 0.9, t: 22 / 252, r, sigma: 0.8 }) * 100) / 100,
    dataUltimo: HOJE, variacao: null, negocios: 50, volume: 100_000,
  })
  const ativo = (ticker: string): AtivoComOpcoes => ({ ticker, nome: ticker, cotacao: 10, volumeOpcoes: 1, lote: 100, series: [serie(`${ticker}W`, 10)] })
  const snapshot: SnapshotOpcoes = { geradoEm: null, dataPregao: HOJE, ativos: ['AGRO3', 'MGLU3', 'VALE3', 'AMER3', 'BBAS3'].map(ativo) }
  const filtro = (parcial: Partial<FiltroPremios> = {}): FiltroPremios => ({ ...FILTRO_PREMIOS_PADRAO, chanceMaxima: null, ...parcial })
  const fundamentos = montarIndiceFundamentos(endividadasDeTeste())
  const tickers = (f: FiltroPremios, contexto = { fundamentos }) => calcularTopPremios(snapshot, f, 13.75, 15, contexto).map((l) => l.ativo.ticker).sort()

  it('sem limite de dívida, todas entram', () => {
    expect(tickers(filtro())).toEqual(['AGRO3', 'AMER3', 'BBAS3', 'MGLU3', 'VALE3'])
  })

  it('o limite de dívida tira quem passa dele e quem não tem EBITDA positivo, e mantém quem não tem o dado', () => {
    expect(tickers(filtro({ dividaMaxima: 5 }))).toEqual(['BBAS3', 'VALE3']) // AGRO3 35x e MGLU3 9,5x saem; AMER3 sem EBITDA sai; BBAS3 (banco) fica
    expect(tickers(filtro({ dividaMaxima: 3 }))).toEqual(['BBAS3', 'VALE3'])
    expect(tickers(filtro({ dividaMaxima: 10 }))).toEqual(['BBAS3', 'MGLU3', 'VALE3'])
  })

  it('sem a lista de dívida publicada, o limite não age', () => {
    expect(tickers(filtro({ dividaMaxima: 3 }), { fundamentos: null })).toHaveLength(5)
  })

  it('"só as baratas" age apenas com a lista liberada, e casa pela empresa', () => {
    const baratas = new Set(['VALE', 'BBAS'])
    expect(tickers(filtro({ soBaratas: true }), { fundamentos, baratas } as never)).toEqual(['BBAS3', 'VALE3'])
    expect(tickers(filtro({ soBaratas: true }), { fundamentos, baratas: null } as never)).toHaveLength(5) // lista não liberada: não filtra
  })
})
