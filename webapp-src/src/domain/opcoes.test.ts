import { describe, expect, it } from 'vitest'
import {
  FILTRO_VAZIO, adicionarMeses, buscarAtivos, diasAte, diasUteis, seriesDosProximosMeses, tipoVencimento, expandirSnapshot, faixaPerto, filtrarSeries, limitesDeStrike, montarLinha,
  moneyness, ordenarLinhas, vencimentosDe,
} from './opcoes'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoesBruto } from './opcoes'
import { precoBs } from './simulaOpcoes'

const s = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo, tipo, estilo: tipo === 'call' ? 'americana' : 'europeia', strike, vencimento, ultimo: 1, dataUltimo: '2026-10-16', variacao: null, negocios: 5, volume: 1000, ...extra,
})
const series = [
  s('A', 'call', 30, '2026-11-20'), s('B', 'call', 35, '2026-11-20', { estilo: 'europeia' }), s('C', 'put', 35, '2026-11-20'),
  s('D', 'call', 40, '2026-12-18', { dataUltimo: '2026-10-15' }), s('E', 'put', 28, '2026-12-18'),
]
const codigos = (l: SerieOpcao[]) => l.map((x) => x.codigo)

describe('expandirSnapshot', () => {
  it('converte as tuplas do arquivo em objetos', () => {
    const bruto: SnapshotOpcoesBruto = {
      geradoEm: null, dataPregao: '2026-10-16',
      ativos: [{ ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 59.68, volumeOpcoes: 1, lote: 100, series: [['PETRK600', 'C', 'E', 60, '2026-11-19', 2.8, '2026-10-16', -7.5, 30, 300000]] }],
    }
    expect(expandirSnapshot(bruto).ativos[0].series[0]).toEqual({
      codigo: 'PETRK600', tipo: 'call', estilo: 'europeia', strike: 60, vencimento: '2026-11-19', ultimo: 2.8, dataUltimo: '2026-10-16', variacao: -7.5, negocios: 30, volume: 300000,
    })
  })
})

describe('filtrarSeries', () => {
  it('sem filtro devolve tudo', () => expect(filtrarSeries(series, FILTRO_VAZIO)).toHaveLength(5))

  it('filtra pela faixa de strike com limites incluídos', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 30, strikeMax: 35 }))).toEqual(['A', 'B', 'C'])
  })

  it('aceita só o mínimo ou só o máximo', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 36 }))).toEqual(['D'])
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMax: 29 }))).toEqual(['E'])
  })

  it('aceita vários vencimentos, tipo e estilo ao mesmo tempo', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, vencimentos: ['2026-11-20', '2026-12-18'], tipo: 'call' }))).toEqual(['A', 'B', 'D'])
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, estilo: 'europeia' }))).toEqual(['B', 'C', 'E'])
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, tipo: 'put', vencimentos: ['2026-11-20'], strikeMin: 30, strikeMax: 40 }))).toEqual(['C'])
  })

  it('"só último pregão" tira séries que não negociaram na data do pregão', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, soUltimoPregao: true }, '2026-10-16'))).toEqual(['A', 'B', 'C', 'E'])
  })

  it('faixa sem séries dá lista vazia', () => {
    expect(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 50, strikeMax: 60 })).toEqual([])
  })
})

describe('apoios', () => {
  it('faixaPerto calcula ±pct% do preço', () => expect(faixaPerto(60, 10)).toEqual({ strikeMin: 54, strikeMax: 66 }))

  it('vencimentos distintos em ordem e limites de strike', () => {
    expect(vencimentosDe(series)).toEqual(['2026-11-20', '2026-12-18'])
    expect(limitesDeStrike(series)).toEqual({ min: 28, max: 40 })
    expect(limitesDeStrike([])).toBeNull()
  })

  it('moneyness: call e put em lados opostos', () => {
    expect(moneyness('call', 30, 35)).toBe('ITM')
    expect(moneyness('call', 40, 35)).toBe('OTM')
    expect(moneyness('put', 40, 35)).toBe('ITM')
    expect(moneyness('put', 30, 35)).toBe('OTM')
    expect(moneyness('call', 35.2, 35)).toBe('ATM')
  })

  it('diasAte conta dias corridos', () => {
    expect(diasAte('2026-11-20', '2026-10-16')).toBe(35)
    expect(diasAte('2026-10-10', '2026-10-16')).toBe(-6)
  })
})

describe('diasUteis (calendário da B3)', () => {
  it('bate com a conta das plataformas de opções: 22 d.u. até 19/11/2026 e 42 até 18/12/2026, a partir de 16/10', () => {
    expect(diasUteis('2026-11-19', '2026-10-16')).toBe(22)
    expect(diasUteis('2026-12-18', '2026-10-16')).toBe(42)
  })

  it('pula fim de semana e feriado, e dá zero para amanhã ou data passada', () => {
    expect(diasUteis('2026-10-19', '2026-10-16')).toBe(0) // sexta -> segunda: nenhum dia útil entre os dois
    expect(diasUteis('2026-10-21', '2026-10-16')).toBe(2) // segunda e terça
    expect(diasUteis('2026-10-10', '2026-10-16')).toBe(0)
  })
})

describe('buscarAtivos', () => {
  const ativo = (ticker: string, nome: string, volumeOpcoes: number): AtivoComOpcoes => ({ ticker, nome, cotacao: 10, volumeOpcoes, lote: 100, series: [] })
  const lista = [ativo('PETR4', 'PETROBRAS', 5), ativo('PETR3', 'PETROBRAS', 2), ativo('VALE3', 'VALE', 9), ativo('BBAS3', 'BRASIL', 1)]

  it('código exato primeiro, depois prefixo, depois nome; mais líquido desempata', () => {
    expect(buscarAtivos(lista, 'petr').map((a) => a.ticker)).toEqual(['PETR4', 'PETR3'])
    expect(buscarAtivos(lista, 'vale3').map((a) => a.ticker)).toEqual(['VALE3'])
    expect(buscarAtivos(lista, 'brasil').map((a) => a.ticker)).toEqual(['BBAS3'])
  })

  it('sem termo ou sem achado, devolve vazio', () => {
    expect(buscarAtivos(lista, '')).toEqual([])
    expect(buscarAtivos(lista, 'xyz')).toEqual([])
  })
})

describe('montarLinha', () => {
  it('calcula distância, d.u. e as gregas a partir da volatilidade implícita no último preço', () => {
    const premio = precoBs({ tipo: 'call', s: 10, strike: 10, t: 22 / 252, r: Math.log(1.1375), sigma: 0.4 })
    const l = montarLinha(s('X', 'call', 10, '2026-11-19', { ultimo: Math.round(premio * 100) / 100 }), 10, '2026-10-16', 13.75)
    expect(l.diasUteis).toBe(22)
    expect(l.distanciaStrike).toBe(0)
    expect(l.situacao).toBe('ATM')
    expect(l.volImplicita).toBeCloseTo(40, 0)
    expect(l.delta).toBeGreaterThan(0.45)
    expect(l.delta).toBeLessThan(0.65)
    expect(l.gama).toBeGreaterThan(0)
    expect(l.tetaReais).toBeLessThan(0)
    expect(l.tetaPct).toBeLessThan(0)
  })

  it('sem dias úteis ou com preço abaixo do valor intrínseco, as colunas do modelo ficam vazias', () => {
    const vencida = montarLinha(s('X', 'call', 10, '2026-10-19', { ultimo: 1 }), 10, '2026-10-16', 13.75)
    expect(vencida.volImplicita).toBeNull()
    expect(vencida.delta).toBeNull()
    const barata = montarLinha(s('Y', 'call', 5, '2026-11-19', { ultimo: 0.5 }), 10, '2026-10-16', 13.75)
    expect(barata.volImplicita).toBeNull()
    expect(barata.tetaPct).toBeNull()
  })
})

describe('ordenarLinhas', () => {
  const l = (codigo: string, strike: number, volImplicita: number | null) =>
    ({ ...montarLinha(s(codigo, 'call', strike, '2026-11-19'), 10, '2026-10-16', 13.75), volImplicita })

  it('ordena por número nas duas direções e mantém vazios no fim', () => {
    const linhas = [l('B', 12, 50), l('A', 10, null), l('C', 11, 30)]
    expect(ordenarLinhas(linhas, { chave: 'strike', direcao: 'asc' }).map((x) => x.codigo)).toEqual(['A', 'C', 'B'])
    expect(ordenarLinhas(linhas, { chave: 'strike', direcao: 'desc' }).map((x) => x.codigo)).toEqual(['B', 'C', 'A'])
    expect(ordenarLinhas(linhas, { chave: 'volImplicita', direcao: 'asc' }).map((x) => x.codigo)).toEqual(['C', 'B', 'A'])
    expect(ordenarLinhas(linhas, { chave: 'volImplicita', direcao: 'desc' }).map((x) => x.codigo)).toEqual(['B', 'C', 'A'])
  })

  it('ordena texto e não altera a lista original', () => {
    const linhas = [l('B', 12, 1), l('A', 10, 2)]
    expect(ordenarLinhas(linhas, { chave: 'codigo', direcao: 'asc' }).map((x) => x.codigo)).toEqual(['A', 'B'])
    expect(linhas.map((x) => x.codigo)).toEqual(['B', 'A'])
  })
})

describe('vencimentos: 6 meses e mensal x semanal', () => {
  it('adicionarMeses mantém o dia e limita ao fim do mês', () => {
    expect(adicionarMeses('2026-10-16', 6)).toBe('2027-04-16')
    expect(adicionarMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(adicionarMeses('2026-11-30', 3)).toBe('2027-02-28')
    expect(adicionarMeses('2026-10-16', 14)).toBe('2027-12-16')
  })

  it('seriesDosProximosMeses guarda só o que vence em até 6 meses, com o limite incluído', () => {
    const lista = [s('A', 'call', 10, '2026-11-19'), s('B', 'call', 10, '2027-04-16'), s('C', 'call', 10, '2027-04-17'), s('D', 'call', 10, '2028-01-21')]
    expect(codigos(seriesDosProximosMeses(lista, '2026-10-16'))).toEqual(['A', 'B'])
  })

  it('tipoVencimento: terceira sexta é mensal, as outras sextas são semanais', () => {
    expect(tipoVencimento('2026-10-16')).toBe('mensal') // 3ª sexta de outubro
    expect(tipoVencimento('2026-10-23')).toBe('semanal')
    expect(tipoVencimento('2026-10-30')).toBe('semanal')
    expect(tipoVencimento('2026-12-18')).toBe('mensal')
    expect(tipoVencimento('2027-01-15')).toBe('mensal')
    expect(tipoVencimento('2027-01-08')).toBe('semanal')
  })

  it('tipoVencimento: quinta antes de sexta feriada é mensal (19/11/2026, pois 20/11 é feriado)', () => {
    expect(tipoVencimento('2026-11-19')).toBe('mensal')
    expect(tipoVencimento('2026-11-12')).toBe('semanal') // quinta comum
    expect(tipoVencimento('2026-11-27')).toBe('semanal')
  })
})
