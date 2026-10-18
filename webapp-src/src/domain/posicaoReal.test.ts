import { describe, expect, it } from 'vitest'
import { analisarPosicao, identificarEstrutura, possibilidadesDeSaida, resolverPosicao, situacaoDeHoje } from './posicaoReal'
import type { AcoesCadastradas, PosicaoCadastrada } from './posicaoReal'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'
import { DIAS_UTEIS_ANO, precoBs, resultadoNoVencimento } from './simulaOpcoes'
import type { Lado } from './simulaOpcoes'

const HOJE = '2026-10-16'
const NOV = '2026-11-19' // 22 dias úteis
const DEZ = '2026-12-18' // 42 dias úteis
const r = Math.log(1.1375)
const SPOT = 10

const serie = (tipo: 'call' | 'put', strike: number, venc: string): SerieOpcao => ({
  codigo: `${tipo === 'call' ? 'C' : 'P'}${Math.round(strike * 100)}${venc === DEZ ? 'D' : ''}`,
  tipo, estilo: 'europeia', strike, vencimento: venc,
  ultimo: Math.max(Math.round(precoBs({ tipo, s: SPOT, strike, t: (venc === DEZ ? 42 : 22) / DIAS_UTEIS_ANO, r, sigma: 0.4 }) * 100) / 100, 0.01),
  dataUltimo: HOJE, variacao: null, negocios: 50, volume: 100_000,
})
const strikes = Array.from({ length: 9 }, (_, i) => 8 + i * 0.5)
const ativo: AtivoComOpcoes = {
  ticker: 'TESTE3', nome: 'TESTE', cotacao: SPOT, volumeOpcoes: 1, lote: 100,
  series: [NOV, DEZ].flatMap((v) => strikes.flatMap((k) => [serie('call', k, v), serie('put', k, v)])),
}
const porCodigo = (c: string) => ativo.series.find((s) => s.codigo === c)!

type Item = [codigo: string, lado: Lado, quantidade?: number, premio?: number]
const cadastrar = (itens: Item[], acoes: AcoesCadastradas | null = null): PosicaoCadastrada => ({
  ticker: 'TESTE3',
  pernas: itens.map(([codigo, lado, q = 100, premio], i) => ({ id: String(i), codigo, lado, quantidade: q, premio: premio ?? porCodigo(codigo)?.ultimo ?? 1 })),
  acoes, montadaEm: null, precoNaMontagem: null,
})
const resolver = (pos: PosicaoCadastrada) => resolverPosicao(pos, ativo, HOJE, r)
const nome = (itens: Item[], acoes: AcoesCadastradas | null = null) => identificarEstrutura(resolver(cadastrar(itens, acoes)).resolvidas, acoes).titulo
const c = (k: number, v = '') => `C${k * 100}${v}`
const p = (k: number, v = '') => `P${k * 100}${v}`

describe('resolver a posição cadastrada', () => {
  it('liga cada perna à série real e separa as que não existem mais', () => {
    const x = resolver(cadastrar([[c(10), 'compra'], ['XXXX99', 'venda']]))
    expect(x.resolvidas.map((y) => y.serie.codigo)).toEqual([c(10)])
    expect(x.semSerie.map((y) => y.codigo)).toEqual(['XXXX99'])
    expect(x.resolvidas[0].dias).toBe(22)
  })

  it('a volatilidade vem do preço de mercado de hoje: a perna vale hoje o último preço, e não o que foi pago', () => {
    const x = resolver(cadastrar([[c(10), 'venda', 100, 3]]))
    const { perna, serie: s } = x.resolvidas[0]
    expect(perna.sigma).toBeCloseTo(0.4, 2)
    expect(perna.premio).toBe(3) // o prêmio da operação continua o informado
    expect(precoBs({ tipo: 'call', s: SPOT, strike: 10, t: 22 / DIAS_UTEIS_ANO, r, sigma: perna.sigma! })).toBeCloseTo(s.ultimo, 2)
  })
})

describe('identificar a estrutura', () => {
  it('uma perna', () => {
    expect(nome([[c(10), 'compra']])).toBe('Compra de call')
    expect(nome([[c(10), 'venda']])).toBe('Venda de call descoberta')
    expect(nome([[c(10), 'venda']], { quantidade: 100, precoMedio: 9 })).toBe('Venda coberta')
    expect(nome([[p(9), 'compra']])).toBe('Compra de put')
    expect(nome([[p(9), 'venda']])).toBe('Venda de put')
  })

  it('travas', () => {
    expect(nome([[c(10), 'compra'], [c(11), 'venda']])).toBe('Trava de alta com calls')
    expect(nome([[c(10), 'venda'], [c(11), 'compra']])).toBe('Trava de baixa com calls')
    expect(nome([[p(10), 'compra'], [p(9), 'venda']])).toBe('Trava de baixa com puts')
    expect(nome([[p(10), 'venda'], [p(9), 'compra']])).toBe('Trava de alta com puts')
  })

  it('straddle, strangle e collar', () => {
    expect(nome([[c(10), 'compra'], [p(10), 'compra']])).toBe('Straddle comprado')
    expect(nome([[c(10), 'venda'], [p(10), 'venda']])).toBe('Straddle vendido')
    expect(nome([[c(11), 'compra'], [p(9), 'compra']])).toBe('Strangle comprado')
    expect(nome([[c(11), 'venda'], [p(9), 'venda']])).toBe('Strangle vendido')
    expect(nome([[c(11), 'venda'], [p(9), 'compra']], { quantidade: 100, precoMedio: 10 })).toBe('Collar')
  })

  it('borboletas, condors e as de três pernas', () => {
    expect(nome([[c(9), 'compra'], [c(10), 'venda', 200], [c(11), 'compra']])).toBe('Borboleta de calls')
    expect(nome([[p(9), 'compra'], [p(10), 'venda', 200], [p(11), 'compra']])).toBe('Borboleta de puts')
    expect(nome([[p(8.5), 'compra'], [p(9), 'venda'], [c(11), 'venda'], [c(11.5), 'compra']])).toBe('Condor de ferro')
    expect(nome([[p(9), 'compra'], [p(10), 'venda'], [c(10), 'venda'], [c(11), 'compra']])).toBe('Borboleta de ferro')
    expect(nome([[c(9), 'compra'], [c(9.5), 'venda'], [c(10.5), 'venda'], [c(11), 'compra']])).toBe('Condor de calls')
    expect(nome([[p(9), 'venda'], [c(11), 'venda'], [c(11.5), 'compra']])).toBe('Put vendida otimizada')
    expect(nome([[p(10), 'compra'], [p(9.5), 'venda'], [p(9), 'venda']])).toBe('Slide com put')
  })

  it('vencimentos diferentes: THL e diagonal', () => {
    expect(nome([[c(10, 'D'), 'compra'], [c(10), 'venda']])).toBe('Trava horizontal de calls (THL)')
    expect(nome([[c(10, 'D'), 'compra'], [c(11), 'venda']])).toBe('Trava diagonal de calls')
  })

  it('pernas que não formam uma estrutura conhecida', () => {
    expect(nome([[c(10), 'compra'], [c(11), 'compra']])).toBe('Estrutura personalizada')
    expect(identificarEstrutura([], null).titulo).toBe('Estrutura personalizada')
  })
})

describe('situação de hoje', () => {
  it('resultado de cada perna pelo último preço contra o preço da operação, e das ações pelo preço médio', () => {
    const ultimo = porCodigo(c(10)).ultimo
    const pos = cadastrar([[c(10), 'venda', 100, ultimo + 0.5]], { quantidade: 100, precoMedio: 9 })
    const s = situacaoDeHoje(pos, resolver(pos), ativo, r)
    expect(s.linhas[0].resultado).toBeCloseTo(0.5 * 100, 6) // vendeu 0,50 acima do preço de hoje: lucro em papel
    expect(s.resultadoAcoes).toBeCloseTo((SPOT - 9) * 100, 6)
    expect(s.total).toBeCloseTo(s.resultadoOpcoes + s.resultadoAcoes, 8)
    expect(s.linhas[0].situacao).toBe('ATM')
  })

  it('compra: ganha quando o último preço sobe acima do pago', () => {
    const ultimo = porCodigo(c(10)).ultimo
    const s = situacaoDeHoje(cadastrar([[c(10), 'compra', 100, ultimo - 0.3]]), resolver(cadastrar([[c(10), 'compra', 100, ultimo - 0.3]])), ativo, r)
    expect(s.total).toBeCloseTo(30, 6)
  })

  it('mede quanto do ganho máximo já foi capturado', () => {
    // venda de put: ganho máximo = prêmio recebido; se hoje a put vale metade, capturou metade
    const ultimo = porCodigo(p(9)).ultimo
    const pos = cadastrar([[p(9), 'venda', 100, ultimo * 2]])
    const s = situacaoDeHoje(pos, resolver(pos), ativo, r)
    expect(s.capturado).toBeCloseTo(0.5, 2)
    expect(s.pontosDeAtencao.join(' ')).toMatch(/capturou 50%/)
  })

  it('avisa da vendida dentro do dinheiro, da perda sem limite e dos poucos dias', () => {
    const pos = cadastrar([[c(9), 'venda']]) // call de strike 9 com o ativo a 10: dentro do dinheiro; venda descoberta
    const s = situacaoDeHoje(pos, resolver(pos), ativo, r)
    const texto = s.pontosDeAtencao.join(' ')
    expect(texto).toMatch(/está dentro do dinheiro/)
    expect(texto).toMatch(/não tem limite/)
    expect(s.analise.perdaMaxima).toBeNull()
  })

  it('perda já realizada em papel como parte da perda máxima', () => {
    const ultimo = porCodigo(c(10)).ultimo
    const pos = cadastrar([[c(10), 'compra', 100, ultimo + 1]]) // pagou 1,00 a mais do que vale hoje
    const s = situacaoDeHoje(pos, resolver(pos), ativo, r)
    expect(s.total).toBeCloseTo(-100, 6)
    expect(s.daPerdaMaxima!).toBeCloseTo(100 / ((ultimo + 1) * 100), 4)
  })
})

describe('possibilidades de saída', () => {
  const lista = (itens: Item[], acoes: AcoesCadastradas | null = null) => {
    const pos = cadastrar(itens, acoes)
    return { pos, itens: possibilidadesDeSaida(pos, resolver(pos), ativo, HOJE, r) }
  }
  const achar = (x: ReturnType<typeof lista>, prefixo: string) => x.itens.filter((i) => i.id.startsWith(prefixo))

  it('sem pernas resolvidas, não há possibilidades', () => {
    expect(lista([['XXXX99', 'venda']]).itens).toEqual([])
  })

  it('put vendida: manter, encerrar, rolar (mesmo strike e mais abaixo) e proteger', () => {
    const x = lista([[p(9), 'venda']])
    const ids = x.itens.map((i) => i.id)
    expect(ids).toContain('manter')
    expect(ids).toContain('encerrar-tudo')
    expect(ids).toContain(`rolar-${p(9)}-igual`)
    expect(ids).toContain(`rolar-${p(9)}-defesa`)
    expect(achar(x, 'proteger-')).toHaveLength(2)
    expect(ids.some((i) => i.startsWith('encerrar-P'))).toBe(false) // com uma perna só, "encerrar só uma" é igual a encerrar tudo
  })

  it('encerrar tudo realiza o resultado de hoje e o fluxo é o preço de recompra', () => {
    const ultimo = porCodigo(p(9)).ultimo
    const x = lista([[p(9), 'venda', 100, ultimo + 0.2]])
    const e = achar(x, 'encerrar-tudo')[0]
    expect(e.realizado).toBeCloseTo(20, 6)
    expect(e.fluxoHoje).toBeCloseTo(-ultimo * 100, 6)
    expect(e.depois).toBeNull() // nada sobra
    expect(e.ganhoMaximo).toBeCloseTo(20, 6)
    expect(e.perdaMaxima).toBeCloseTo(20, 6)
    expect(e.notas).toContain('Realiza lucro')
  })

  it('manter não altera nada e mostra o ganho e a perda máximos de agora', () => {
    const ultimo = porCodigo(p(9)).ultimo
    const m = achar(lista([[p(9), 'venda']]), 'manter')[0]
    expect(m.fluxoHoje).toBe(0)
    expect(m.ganhoMaximo).toBeCloseTo(ultimo * 100, 6)
    expect(m.perdaMaxima).toBeCloseTo(-(9 - ultimo) * 100, 6)
  })

  it('proteger a put vendida limita a perda máxima ao custo da trava, em troca de um débito', () => {
    const x = lista([[p(9), 'venda']])
    const manter = achar(x, 'manter')[0]
    const prot = achar(x, 'proteger-')[0]
    expect(prot.fluxoHoje).toBeLessThan(0)
    expect(prot.notas.join(' ')).toMatch(/Débito/)
    expect(prot.perdaMaxima!).toBeGreaterThan(manter.perdaMaxima!) // perda menor (menos negativa)
    expect(prot.ganhoMaximo!).toBeLessThan(manter.ganhoMaximo!) // e ganho menor, pelo custo da proteção
  })

  it('rolar para o vencimento seguinte: encerra a antiga e abre a nova, e o resultado fica estimado (vencimentos diferentes só com outras pernas)', () => {
    const x = lista([[p(9), 'venda']])
    const rolar = achar(x, 'rolar-')[0]
    expect(rolar.depois!.pernas).toHaveLength(1)
    expect(rolar.depois!.pernas[0].dias).toBe(42)
    expect(rolar.fluxoHoje).toBeCloseTo(-porCodigo(p(9)).ultimo * 100 + porCodigo(p(9, 'D')).ultimo * 100, 1) // recompra a de novembro, vende a de dezembro
    expect(rolar.notas.join(' ')).toMatch(/Crédito na troca/) // a de dezembro vale mais que a de novembro
    expect(rolar.titulo).toMatch(/19\/11|18\/12|\/12/)
  })

  it('a rolagem para um strike mais afastado recebe menos que a do mesmo strike', () => {
    const x = lista([[p(9), 'venda']])
    const igual = achar(x, `rolar-${p(9)}-igual`)[0]
    const defesa = achar(x, `rolar-${p(9)}-defesa`)[0]
    expect(defesa.fluxoHoje).toBeLessThan(igual.fluxoHoje)
    expect(defesa.notas).toContain('Strike mais afastado')
  })

  it('trava de duas pernas: encerrar só uma perna e rolar a estrutura inteira', () => {
    const x = lista([[c(10), 'compra'], [c(11), 'venda']])
    expect(achar(x, 'encerrar-C')).toHaveLength(2)
    const tudo = achar(x, 'rolar-tudo')[0]
    expect(tudo.depois!.pernas.map((y) => y.strike)).toEqual([10, 11])
    expect(tudo.depois!.pernas.every((y) => y.dias === 42)).toBe(true)
    // a trava de alta já está "protegida" (a vendida tem uma comprada do mesmo tipo e vencimento): nada de proteger
    expect(achar(x, 'proteger-')).toHaveLength(0)
  })

  it('encerrar só a perna vendida de uma trava deixa a comprada, com o resultado realizado somado', () => {
    const x = lista([[c(10), 'compra'], [c(11), 'venda']])
    const soVendida = achar(x, `encerrar-${c(11)}`)[0]
    expect(soVendida.depois!.pernas).toHaveLength(1)
    expect(soVendida.depois!.pernas[0].lado).toBe('compra')
    expect(soVendida.depois!.realizado).toBeCloseTo(soVendida.realizado, 8)
    expect(soVendida.ganhoMaximo).toBeNull() // sobrou call comprada seca
  })

  it('venda coberta não oferece proteção, porque as ações já cobrem a call', () => {
    const x = lista([[c(11), 'venda']], { quantidade: 100, precoMedio: 9.5 })
    expect(achar(x, 'proteger-')).toHaveLength(0)
    const manter = achar(x, 'manter')[0]
    expect(manter.ganhoMaximo).not.toBeNull()
  })

  it('o resultado do cenário parado bate com a posição passada ao motor', () => {
    const pos = cadastrar([[c(10), 'compra'], [c(11), 'venda']])
    const res = resolver(pos)
    const p0 = possibilidadesDeSaida(pos, res, ativo, HOJE, r).find((i) => i.id === 'manter')!.depois!
    expect(resultadoNoVencimento(p0, 11)).toBeCloseTo(100 - (porCodigo(c(10)).ultimo - porCodigo(c(11)).ultimo) * 100, 6)
    expect(analisarPosicao(p0, SPOT, r).estimado).toBe(false)
  })
})

describe('último preço defasado', () => {
  it('avisa quando o último preço está abaixo do valor intrínseco', () => {
    const defasada: AtivoComOpcoes = { ...ativo, series: ativo.series.map((s) => (s.codigo === c(8) ? { ...s, ultimo: 1.2 } : s)) } // call de strike 8 com o ativo a 10: intrínseco 2,00
    const pos = cadastrar([[c(8), 'compra', 100, 1.5]])
    const s = situacaoDeHoje(pos, resolverPosicao(pos, defasada, HOJE, r), defasada, r)
    expect(s.pontosDeAtencao.join(' ')).toMatch(/abaixo do valor intrínseco/)
    expect(s.pontosDeAtencao.join(' ')).toMatch(/negócio antigo/)
  })

  it('não avisa com o preço normal', () => {
    const pos = cadastrar([[c(10), 'compra']])
    expect(situacaoDeHoje(pos, resolver(pos), ativo, r).pontosDeAtencao.join(' ')).not.toMatch(/intrínseco/)
  })

  it('rolar hoje usa o último preço das duas séries, então uma perna aberta ao preço de mercado não realiza prejuízo por causa do modelo', () => {
    const defasada: AtivoComOpcoes = { ...ativo, series: ativo.series.map((s) => (s.codigo === p(11) ? { ...s, ultimo: 0.5 } : s)) } // put de strike 11 vale ao menos 1,00 por dentro; último antigo de 0,50
    const pos: PosicaoCadastrada = { ...cadastrar([[p(11), 'venda', 100, 0.5]]) }
    const lista = possibilidadesDeSaida(pos, resolverPosicao(pos, defasada, HOJE, r), defasada, HOJE, r)
    const rolagem = lista.find((i) => i.id === `rolar-${p(11)}-igual`)!
    expect(rolagem.realizado).toBeCloseTo(0, 8)
  })
})
