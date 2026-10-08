import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import {
  ajustarDesdobramentos, calcularAcoes, calcularBdrs, calcularBdrsNegociados, calcularEtfs, calcularFiis, calcularIndice, hashDoResultado, mediana, saltosDePreco, verificarSanidade,
} from './top15-mercado-calculo.mjs'
import { CLASSES, arquivosCsv, concluir, executarIndice, montarInsumosIndice, montarInsumosAcoes, montarInsumosBdrs, montarInsumosBdrsNegociados, montarInsumosEtfs, montarInsumosFiis, semNotas } from './atualizar-top15-mercado.mjs'
import { verificar } from './top15-mercado-verificar.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const lerJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'))
const cfgEtfsArquivo = lerJson(RAIZ, 'config', 'top15-etfs.json')
const cfgBdrsArquivo = lerJson(RAIZ, 'config', 'top15-bdrs.json')

// Janelas pequenas para os cálculos à mão (os valores reais do arquivo são conferidos no teste de configuração).
const cfgEtf = { ...cfgEtfsArquivo, tamanhoDaLista: 3, tamanhoPorCategoria: 1, janelaLiquidez: 5, janela3Meses: 8, volumeMinimoDiario: 100, diasNegociadosMinimos: 3, pregoesMaxSemNegocio: 2,
  publicacao: { ...cfgEtfsArquivo.publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoNaLista: 1, maximoFracaoSemCotacao: 0.9 } } }
const cfgBdr = { ...cfgBdrsArquivo, tamanhoDaLista: 3, janelaLiquidez: 5, janela3Meses: 8, janelaMaxima: 12, pregoesMinimosHistorico: 10, volumeMinimoDiario: 100, diasNegociadosMinimos: 3, pregoesMaxSemNegocio: 2,
  publicacao: { ...cfgBdrsArquivo.publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoNaLista: 1, maximoFracaoSemCotacao: 0.9 } } }

const N = 14
const datas = (n = N) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))
// dia = [fechamento, mínima, máxima, volume]
const dia = (c, v) => [c, c * 0.99, c * 1.01, v]
const serieDe = (precos, volumes) => precos.map((p, i) => (p === null ? null : dia(p, volumes[i])))
const plana = (preco, volume, n = N) => serieDe(new Array(n).fill(preco), new Array(n).fill(volume))
const insumosEtf = (ativos, extra = {}) => ({ classe: 'etfs', dataExecucao: '2026-10-08', pregoes: datas(), ordemCategorias: ['Bolsa', 'Renda fixa'], excluidos: [], ativos, ...extra })
const etf = (ticker, serie, categoria = 'Bolsa') => ({ ticker, nome: `ETF ${ticker}`, categoria, serie })

// ---------------------------------------------------------------------------------------
// ETFs
// ---------------------------------------------------------------------------------------

test('mediana: ímpar, par e vazio', () => {
  assert.equal(mediana([5, 1, 3]), 3)
  assert.equal(mediana([4, 1, 3, 2]), 2.5)
  assert.equal(mediana([]), 0)
})

test('ETF: ordena pela MEDIANA dos últimos 5 pregões, não pela média (um dia gigante não faz um fundo subir)', () => {
  // últimos 5 volumes: A = 100,100,100,100,100 (mediana 100, média 100); B = 10,10,10,10,1000 (mediana 10, média 208)
  const A = plana(10, 100)
  const B = serieDe(new Array(N).fill(10), [...new Array(N - 1).fill(10), 1000])
  const { resultado } = calcularEtfs(insumosEtf([etf('BBBB11', B), etf('AAAA11', A)]), { ...cfgEtf, volumeMinimoDiario: 5 })
  assert.deepEqual(resultado.geral.map((x) => x.ticker), ['AAAA11', 'BBBB11'])
  assert.equal(resultado.geral[0].volumeMediano, 100)
  assert.equal(resultado.geral[1].volumeMediano, 10)
  assert.equal(resultado.geral[1].volumeMedio, 208, '(10×4 + 1000) ÷ 5 = 208')
  assert.deepEqual(resultado.geral.map((x) => x.posicaoGeral), [1, 2])
})

test('ETF: dia sem negócio conta zero na mediana e nos dias negociados', () => {
  // últimos 5: sem negócio, 500, sem negócio, 500, 500 → volumes 0,500,0,500,500 → mediana 500; 3 dias negociados
  const s = serieDe(new Array(N).fill(10), new Array(N).fill(500))
  s[N - 5] = null
  s[N - 3] = null
  const { resultado } = calcularEtfs(insumosEtf([etf('AAAA11', s)]), cfgEtf)
  assert.equal(resultado.geral[0].volumeMediano, 500)
  assert.equal(resultado.geral[0].diasNegociados, 3)
  // um dia a menos negociado: mediana cai a zero e o ETF sai por liquidez
  const t = [...s]
  t[N - 1] = null
  const r = calcularEtfs(insumosEtf([etf('AAAA11', t)]), cfgEtf).resultado
  assert.deepEqual(r.exclusoes.map((e) => [e.ticker, e.codigo]), [['AAAA11', 'poucos_dias_negociados']])
})

test('ETF: cada motivo de exclusão, com o código e o texto certos', () => {
  const ins = insumosEtf([
    etf('MANU11', plana(10, 1000)),
    etf('NADA11', new Array(N).fill(null)),
    etf('VELH11', serieDe([...new Array(N - 3).fill(10), null, null, null], [...new Array(N - 3).fill(500), 0, 0, 0])),
    etf('POUC11', serieDe(new Array(N).fill(10), [...new Array(N - 5).fill(500), 0, 0, 0, 500, 500]).map((v, i) => (i >= N - 5 && i < N - 2 ? null : v))),
    etf('ILIQ11', plana(10, 50)),
    etf('BOM11', plana(10, 1000)),
  ], { excluidos: ['MANU11'] })
  const { resultado } = calcularEtfs(ins, cfgEtf)
  const por = Object.fromEntries(resultado.exclusoes.map((e) => [e.ticker, e.codigo]))
  assert.deepEqual(por, { MANU11: 'excluido_manual', NADA11: 'sem_negocio', VELH11: 'cotacao_defasada', POUC11: 'poucos_dias_negociados', ILIQ11: 'liquidez_baixa' })
  assert.deepEqual(resultado.geral.map((x) => x.ticker), ['BOM11'])
  assert.equal(resultado.universo, 6)
  assert.equal(resultado.elegiveis, 1)
  assert.match(resultado.exclusoes.find((e) => e.ticker === 'VELH11').motivo, /Último negócio há 3 pregões \(máximo 2\)/)
  assert.match(resultado.exclusoes.find((e) => e.ticker === 'ILIQ11').motivo, /R\$ 50 por dia/)
})

test('ETF: o limite de liquidez e o de dias são inclusivos (exatamente no mínimo entra)', () => {
  const { resultado } = calcularEtfs(insumosEtf([etf('AAAA11', plana(10, 100))]), cfgEtf)
  assert.equal(resultado.geral.length, 1, 'mediana de R$ 100 com mínimo de R$ 100 entra')
  const abaixo = calcularEtfs(insumosEtf([etf('AAAA11', plana(10, 99))]), cfgEtf).resultado
  assert.equal(abaixo.geral.length, 0)
})

test('ETF: desempate por dias negociados e depois por ticker; lista cortada em tamanhoDaLista', () => {
  const mesmaMediana = (extra) => serieDe(new Array(N).fill(10), [...new Array(N - 5).fill(0), 200, 200, 200, ...extra])
  const ins = insumosEtf([
    etf('CCCC11', mesmaMediana([200, 200])),
    etf('BBBB11', mesmaMediana([200, 200])),
    etf('AAAA11', mesmaMediana([200, 0])), // mediana 200 também, mas 4 dias negociados
    etf('DDDD11', plana(10, 1)),
    etf('EEEE11', mesmaMediana([200, 200])),
  ])
  const { resultado } = calcularEtfs(ins, { ...cfgEtf, volumeMinimoDiario: 1 })
  assert.deepEqual(resultado.geral.map((x) => x.ticker), ['BBBB11', 'CCCC11', 'EEEE11'], 'tamanhoDaLista = 3; empate: mais dias negociados primeiro, depois ordem alfabética')
  assert.equal(resultado.elegiveis, 5)
})

test('ETF: por categoria na ordem do config, com o melhor de cada uma; série curta é alinhada à direita', () => {
  const curta = plana(10, 900, 6) // só 6 pregões de histórico: vira null à esquerda
  const ins = insumosEtf([
    etf('RF1111', plana(10, 400), 'Renda fixa'),
    etf('BOL111', plana(10, 300), 'Bolsa'),
    etf('BOL222', curta, 'Bolsa'),
    etf('XXX111', plana(10, 200), 'Cripto'),
  ])
  const { resultado } = calcularEtfs(ins, cfgEtf)
  assert.deepEqual(Object.keys(resultado.porCategoria), ['Bolsa', 'Renda fixa', 'Cripto'], 'ordem do config primeiro, categoria nova depois')
  assert.deepEqual(resultado.porCategoria.Bolsa.map((x) => [x.ticker, x.posicaoNaCategoria]), [['BOL222', 1]], 'tamanhoPorCategoria = 1')
  assert.equal(resultado.geral[0].ticker, 'BOL222')
  assert.deepEqual(resultado.geral.map((x) => x.ticker), ['BOL222', 'RF1111', 'BOL111'])
})

test('ETF: variação de 3 meses = último fechamento ÷ fechamento 8 pregões antes − 1', () => {
  const precos = Array.from({ length: N }, (_, i) => 10 + i) // 10..23; alvo = índice 13 − 8 = 5 → 15; 23/15 − 1 = 53,3%
  const { resultado } = calcularEtfs(insumosEtf([etf('AAAA11', serieDe(precos, new Array(N).fill(500)))]), cfgEtf)
  assert.equal(resultado.geral[0].variacao3m, 53.3)
  assert.equal(resultado.geral[0].cotacao, 23)
  assert.equal(resultado.geral[0].dataCotacao, datas()[N - 1])
})

test('ETF: determinismo (mesmo resultado, mesmo hash, qualquer ordem dos ativos)', () => {
  const a = [etf('AAAA11', plana(10, 500)), etf('BBBB11', plana(11, 700), 'Renda fixa')]
  const h1 = hashDoResultado(calcularEtfs(insumosEtf(a), cfgEtf).resultado)
  const h2 = hashDoResultado(calcularEtfs(insumosEtf([...a].reverse()), cfgEtf).resultado)
  assert.equal(h1, h2)
})

// ---------------------------------------------------------------------------------------
// BDRs
// ---------------------------------------------------------------------------------------

const insumosBdr = (ativos, extra = {}) => ({ classe: 'bdrs', dataExecucao: '2026-10-08', pregoes: datas(), excluidos: [], ativos, ...extra })
const bdr = (ticker, serie, extra = {}) => ({ ticker, nome: `BDR ${ticker}`, setor: 'Tecnologia', acoesPorBdr: null, desdobramentos: [], serie, ...extra })
const volume = new Array(N).fill(500)

test('BDR: desconto = 1 − fechamento atual ÷ maior fechamento (60 contra máxima 100 → 40%)', () => {
  const precos = [80, 100, 90, 85, 80, 75, 70, 70, 65, 65, 62, 61, 60, 60]
  const { resultado } = calcularBdrs(insumosBdr([bdr('AAAA34', serieDe(precos, volume))]), { ...cfgBdr, janelaMaxima: 14, pregoesMinimosHistorico: 14 })
  const r = resultado.ranking[0]
  assert.equal(r.desconto, 0.4)
  assert.equal(r.maximaFechamento12m, 100)
  assert.equal(r.dataMaxima, datas()[1])
  assert.equal(r.cotacao, 60)
  assert.equal(r.posicao, 1)
})

test('BDR: a máxima só vale dentro da janela (um pico mais antigo que janelaMaxima é ignorado)', () => {
  const precos = [500, 100, 90, 85, 80, 75, 70, 70, 65, 65, 62, 61, 60, 60]
  const { resultado } = calcularBdrs(insumosBdr([bdr('AAAA34', serieDe(precos, volume))]), { ...cfgBdr, janelaMaxima: 12, pregoesMinimosHistorico: 10, saltoQueda: 0.1, saltoAlta: 99 })
  assert.equal(resultado.ranking[0].maximaFechamento12m, 90, 'janela de 12 pregões começa no 3º dia (índice 2): o 500 e o 100 ficam de fora')
  assert.equal(resultado.ranking[0].desconto, 0.3333)
})

test('BDR: ordena do maior para o menor desconto; empate por volume e ticker', () => {
  const lento = serieDe([100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 90, 90, 90], volume) // 10%
  const fundo = serieDe([100, 95, 90, 85, 80, 75, 70, 70, 70, 70, 70, 70, 70, 70], volume) // 30%
  const igualA = serieDe([100, 100, 100, 100, 100, 100, 100, 100, 90, 85, 80, 75, 72, 72], volume.map(() => 800)) // 28%
  const igualB = serieDe([100, 100, 100, 100, 100, 100, 100, 100, 90, 85, 80, 75, 72, 72], volume) // 28%, menos volume
  const { resultado } = calcularBdrs(insumosBdr([bdr('LENT34', lento), bdr('IGUB34', igualB), bdr('FUND34', fundo), bdr('IGUA34', igualA)]), { ...cfgBdr, tamanhoDaLista: 10, janelaMaxima: 14, pregoesMinimosHistorico: 14, saltoQueda: 0.1, saltoAlta: 99 })
  assert.deepEqual(resultado.ranking.map((r) => [r.posicao, r.ticker, r.desconto]), [[1, 'FUND34', 0.3], [2, 'IGUA34', 0.28], [3, 'IGUB34', 0.28], [4, 'LENT34', 0.1]])
})

test('BDR: desdobramento confirmado é aplicado antes de medir (sem ele o salto vai para "a conferir")', () => {
  // Preço cai de 100 para 50 de um dia para o outro por um desdobramento 1:2 (fator 2) na data do 8º pregão.
  const precos = [100, 100, 100, 100, 100, 100, 100, 50, 50, 50, 50, 50, 50, 50]
  const semEvento = calcularBdrs(insumosBdr([bdr('SPLT34', serieDe(precos, volume))]), { ...cfgBdr, janelaMaxima: 14, pregoesMinimosHistorico: 14 }).resultado
  assert.equal(semEvento.ranking.length, 0)
  assert.deepEqual(semEvento.aConferir.map((x) => x.ticker), ['SPLT34'])
  assert.ok(semEvento.aConferir[0].alertas.includes('salto_de_preco'), 'o salto de 100 para 50 sem evento confirmado manda o BDR para a conferência')
  const evento = [{ data: datas()[7], fator: 2 }]
  const com = calcularBdrs(insumosBdr([bdr('SPLT34', serieDe(precos, volume), { desdobramentos: evento })]), { ...cfgBdr, janelaMaxima: 14, pregoesMinimosHistorico: 14 }).resultado
  assert.equal(com.aConferir.length, 0)
  assert.equal(com.ranking[0].desconto, 0, 'ajustado, o preço ficou em 50 o tempo todo: desconto zero')
  assert.equal(com.ranking[0].maximaFechamento12m, 50)
  assert.equal(com.ranking[0].cotacao, 50)
})

test('ajustarDesdobramentos: divide os preços anteriores à data, mantém o volume e ignora evento inválido', () => {
  const s = serieDe([100, 100, 50, 50], [10, 10, 10, 10])
  const ajustada = ajustarDesdobramentos(s, ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'], [{ data: '2026-01-03', fator: 2 }, { data: 'x', fator: -1 }, null])
  assert.deepEqual(ajustada.map((v) => v[0]), [50, 50, 50, 50])
  assert.deepEqual(ajustada.map((v) => v[3]), [10, 10, 10, 10])
  assert.equal(ajustarDesdobramentos(s, ['a', 'b', 'c', 'd'], []), s)
})

test('saltosDePreco: queda de 45% ou mais e alta de 80% ou mais entre fechamentos seguidos (pulando dias sem negócio)', () => {
  const ds = datas(6)
  const cfg = { saltoQueda: 0.55, saltoAlta: 1.8 }
  assert.deepEqual(saltosDePreco(serieDe([100, 100, 55, 55, 55, 55], new Array(6).fill(1)), ds, 6, cfg).map((s) => s.data), [ds[2]], '55/100 = 0,55: exatamente no limite conta')
  assert.equal(saltosDePreco(serieDe([100, 100, 56, 56, 56, 56], new Array(6).fill(1)), ds, 6, cfg).length, 0, '0,56 não conta')
  assert.equal(saltosDePreco(serieDe([100, 179, 179, 179, 179, 179], new Array(6).fill(1)), ds, 6, cfg).length, 0)
  assert.equal(saltosDePreco(serieDe([100, 180, 180, 180, 180, 180], new Array(6).fill(1)), ds, 6, cfg).length, 1, '1,8: exatamente no limite conta')
  assert.equal(saltosDePreco(serieDe([100, null, null, 40, 40, 40], new Array(6).fill(1)), ds, 6, cfg).length, 1, 'dias sem negócio no meio não escondem o salto')
})

test('BDR: desconto acima de 60% vai para "a conferir", fora do ranking, e não distorce as posições', () => {
  const extremo = serieDe([100, 98, 95, 90, 80, 70, 60, 50, 45, 40, 38, 36, 35, 35], volume) // 65%
  const normal = serieDe([100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 85, 80, 80], volume) // 20%
  const { resultado } = calcularBdrs(insumosBdr([bdr('EXTR34', extremo), bdr('NORM34', normal)]), { ...cfgBdr, janelaMaxima: 14, pregoesMinimosHistorico: 14, saltoQueda: 0.1, saltoAlta: 99 })
  assert.deepEqual(resultado.ranking.map((r) => [r.ticker, r.posicao]), [['NORM34', 1]])
  assert.deepEqual(resultado.aConferir.map((r) => [r.ticker, r.alertas]), [['EXTR34', ['desconto_extremo']]])
  assert.equal(resultado.aConferir[0].desconto, 0.65)
})

test('BDR: cada motivo de exclusão (manual, sem negócio, defasada, poucos dias, liquidez, histórico curto)', () => {
  const longa = (v) => serieDe([100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 88], v)
  const ins = insumosBdr([
    bdr('MANU34', longa(volume)),
    bdr('NADA34', new Array(N).fill(null)),
    bdr('VELH34', serieDe([...new Array(N - 3).fill(10), null, null, null], [...new Array(N - 3).fill(500), 0, 0, 0])),
    bdr('POUC34', serieDe(new Array(N).fill(10), new Array(N).fill(500)).map((v, i) => (i >= N - 5 && i < N - 2 ? null : v))),
    bdr('ILIQ34', longa(new Array(N).fill(50))),
    bdr('CURT34', [...new Array(N - 8).fill(null), ...serieDe(new Array(8).fill(10), new Array(8).fill(500))]),
    bdr('BOM34', longa(volume)),
  ], { excluidos: ['MANU34'] })
  const { resultado } = calcularBdrs(ins, { ...cfgBdr, saltoQueda: 0.1, saltoAlta: 99 })
  const por = Object.fromEntries(resultado.exclusoes.map((e) => [e.ticker, e.codigo]))
  assert.deepEqual(por, { MANU34: 'excluido_manual', NADA34: 'sem_negocio', VELH34: 'cotacao_defasada', POUC34: 'poucos_dias_negociados', ILIQ34: 'liquidez_baixa', CURT34: 'historico_curto' })
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['BOM34'])
  assert.match(resultado.exclusoes.find((e) => e.ticker === 'CURT34').motivo, /Só 8 pregões de histórico \(mínimo 10\)/)
})

// ---------------------------------------------------------------------------------------
// Trava de sanidade
// ---------------------------------------------------------------------------------------

test('sanidade: lista pequena demais e histórico desatualizado derrubam o resultado', () => {
  const san = { sanidade: { minimoNaLista: 2, maximoFracaoSemCotacao: 0.5 } }
  const bom = { classe: 'etfs', geral: [{}, {}], universo: 4, elegiveis: 2, exclusoes: [{ codigo: 'liquidez_baixa' }, { codigo: 'liquidez_baixa' }] }
  assert.deepEqual(verificarSanidade(bom, san), [])
  assert.match(verificarSanidade({ ...bom, geral: [{}] }, san)[0], /só 1 ativos na lista \(mínimo 2\)/)
  const velho = { classe: 'bdrs', ranking: [{}, {}], universo: 4, elegiveis: 2, exclusoes: [{ codigo: 'cotacao_defasada' }, { codigo: 'sem_negocio' }, { codigo: 'cotacao_defasada' }] }
  assert.match(verificarSanidade(velho, san)[0], /3 de 4 ativos sem cotação recente.*desatualizado/)
  assert.deepEqual(verificarSanidade({ ...velho, exclusoes: [{ codigo: 'cotacao_defasada' }, { codigo: 'sem_negocio' }] }, san), [], '2 de 4 = 50%: exatamente no limite passa')
})

// ---------------------------------------------------------------------------------------
// Insumos a partir do histórico
// ---------------------------------------------------------------------------------------

test('insumos de ETF: recorta as últimas pregoesNosInsumos, alinha séries curtas, limpa o nome e usa a categoria do config', () => {
  const pregoes = datas(10)
  const historico = { pregoes, nomes: { AAAA11: 'ISHARES AAAA INDEX FUND', BBBB11: 'Fundo B' }, ativos: { AAAA11: serieDe(new Array(10).fill(10), new Array(10).fill(500)), BBBB11: serieDe([5, 5, 5], [1, 1, 1]) } }
  const ins = montarInsumosEtfs({ historico, configEtfs: { nomes: { BBBB11: 'Nome Manual' }, categorias: { AAAA11: 'Bolsa' }, ordemCategorias: ['Bolsa'], excluir: { tickers: ['ZZZ11', 'AAA11'] } }, cfg: { pregoesNosInsumos: 6 }, dataExecucao: '2026-10-08' })
  assert.deepEqual(ins.pregoes, pregoes.slice(-6))
  assert.deepEqual(ins.ativos.map((a) => [a.ticker, a.categoria, a.serie.length]), [['AAAA11', 'Bolsa', 6], ['BBBB11', 'Outros', 6]])
  assert.equal(ins.ativos[1].nome, 'Nome Manual')
  assert.deepEqual(ins.ativos[1].serie.slice(0, 3), [null, null, null], 'série curta completada com null à esquerda')
  assert.deepEqual(ins.excluidos, ['AAA11', 'ZZZ11'], 'exclusões ordenadas (hash estável)')
})

test('insumos de BDR: só BDR de ação (31 a 35), sem derivativo e sem BDR de ETF (39)', () => {
  const pregoes = datas(5)
  const s = serieDe(new Array(5).fill(10), new Array(5).fill(500))
  const historico = { pregoes, cadastro: {}, ativos: { AAPL34: s, MSFT35: s, SPXI39: s, DI1F31: s, PETR4: s, ABCD11: s } }
  const ins = montarInsumosBdrs({ historico, configBdrs: { desdobramentos: { AAPL34: [{ data: '2026-09-03', fator: 2, extra: 'x' }] }, excluir: { tickers: ['XPBR31'] } }, cfg: { janelaMaxima: 252 }, dataExecucao: '2026-10-08' })
  assert.deepEqual(ins.ativos.map((a) => a.ticker), ['AAPL34', 'MSFT35'])
  assert.deepEqual(ins.ativos[0].desdobramentos, [{ data: '2026-09-03', fator: 2 }])
  assert.deepEqual(ins.excluidos, ['XPBR31'])
})

// ---------------------------------------------------------------------------------------
// Auditoria, publicação e verificação independente
// ---------------------------------------------------------------------------------------

const raizTemporaria = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'top15-mercado-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const f of ['top15-mercado-calculo.mjs', 'atualizar-top15-mercado.mjs']) fs.copyFileSync(path.join(AQUI, f), path.join(raiz, 'scripts', f))
  return raiz
}
const insumosEtfPub = () => insumosEtf([etf('AAAA11', plana(10, 500)), etf('BBBB11', plana(11, 900), 'Renda fixa')])
const insumosBdrPub = () => insumosBdr([
  bdr('FUND34', serieDe([100, 95, 90, 85, 80, 75, 70, 70, 70, 70, 70, 70, 70, 70], volume)),
  bdr('LENT34', serieDe([100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 90, 90, 90], volume)),
])
const cfgBdrAcesso = { ...cfgBdr, saltoQueda: 0.1, saltoAlta: 99, janelaMaxima: 14, pregoesMinimosHistorico: 14 }
const aprovado = (cfg) => ({ ...cfg, publicacao: { ...cfg.publicacao, aprovadoPeloResponsavel: true } })
const saida = (raiz, arq) => lerJson(raiz, ...arq.split('/'))

test('auditoria: grava os arquivos, o manifesto confere com o disco e a verificação independente aprova', () => {
  const raiz = raizTemporaria()
  const r = concluir({ raiz, classe: 'etfs', cfg: cfgEtf, insumos: insumosEtfPub(), log: () => {} })
  const pasta = path.join(raiz, 'auditoria', 'top15-etfs', '2026-10-08')
  for (const a of ['manifesto.json', 'config.json', 'resultado.json', 'insumos.json.gz', 'memoria-de-calculo.json.gz', 'ranking-geral.csv', 'ranking-por-categoria.csv', 'exclusoes.csv', 'LEIA-ME.md']) assert.ok(fs.existsSync(path.join(pasta, a)), a)
  const man = lerJson(pasta, 'manifesto.json')
  assert.equal(man.hashes.resultado, hashDoResultado(r.resultado))
  assert.equal(man.classe, 'etfs')
  assert.equal(man.publicadoNoApp, false)
  assert.equal(saida(raiz, 'auditoria/top15-etfs/ultima.json').pasta, 'auditoria/top15-etfs/2026-10-08')
  const v = verificar(pasta, raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
  assert.ok(v.mensagens.some((m) => /resultado recalculado.*confere/.test(m.m)))
})

test('auditoria: a verificação DETECTA arquivo editado, insumo trocado com manifesto "consertado" e config alterada', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, classe: 'bdrs', cfg: cfgBdrAcesso, insumos: insumosBdrPub(), log: () => {} })
  const pasta = path.join(raiz, 'auditoria', 'top15-bdrs', '2026-10-08')
  assert.equal(verificar(pasta, raiz).ok, true)

  // 1) resultado.json editado à mão
  const original = fs.readFileSync(path.join(pasta, 'resultado.json'), 'utf8')
  fs.writeFileSync(path.join(pasta, 'resultado.json'), original.replace('FUND34', 'LENT34'))
  assert.equal(verificar(pasta, raiz).ok, false)
  fs.writeFileSync(path.join(pasta, 'resultado.json'), original)
  assert.equal(verificar(pasta, raiz).ok, true)

  // 2) insumo trocado e manifesto "consertado" para os hashes dos arquivos: o recálculo diverge do resultado gravado
  const ins = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pasta, 'insumos.json.gz'))).toString('utf8'))
  ins.ativos[0].serie[ins.ativos[0].serie.length - 1][0] = 1
  fs.writeFileSync(path.join(pasta, 'insumos.json.gz'), zlib.gzipSync(Buffer.from(JSON.stringify(ins))))
  const man = lerJson(pasta, 'manifesto.json')
  man.hashes.arquivos['insumos.json.gz'] = sha256Arquivo(path.join(pasta, 'insumos.json.gz'))
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify(man))
  const v2 = verificar(pasta, raiz)
  assert.equal(v2.ok, false)
  assert.ok(v2.mensagens.some((m) => !m.ok && /insumos: hash canônico DIVERGE|resultado recalculado DIVERGE/.test(m.m)))
})

const sha256Arquivo = (arquivo) => crypto.createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex')

test('publicação ETF: sem aprovação o app recebe só o cabeçalho "em validação"; com aprovação, o ranking completo e aberto', () => {
  const fechado = raizTemporaria()
  concluir({ raiz: fechado, classe: 'etfs', cfg: cfgEtf, insumos: insumosEtfPub(), log: () => {} })
  const a = saida(fechado, 'webapp-src/src/data/etfsMaisNegociados.json')
  assert.equal(a.publicado, false)
  assert.deepEqual([a.geral, a.porCategoria, a.exclusoes], [[], {}, []])
  assert.ok(!fs.existsSync(path.join(fechado, 'dados-privados')), 'ETF não tem arquivo privado')

  const aberto = raizTemporaria()
  const r = concluir({ raiz: aberto, classe: 'etfs', cfg: aprovado(cfgEtf), insumos: insumosEtfPub(), log: () => {} })
  assert.equal(r.publicado, true)
  const b = saida(aberto, 'webapp-src/src/data/etfsMaisNegociados.json')
  assert.equal(b.publicado, true)
  assert.equal(b.acessoRestrito, false)
  assert.deepEqual(b.geral.map((x) => x.ticker), ['BBBB11', 'AAAA11'])
  assert.deepEqual(Object.keys(b.porCategoria), ['Bolsa', 'Renda fixa'])
  assert.equal(b.aviso, cfgEtf.publicacao.avisoProposto)
  assert.equal(b.hashResultado, lerJson(aberto, 'auditoria', 'top15-etfs', '2026-10-08', 'manifesto.json').hashes.resultado)
  assert.ok(!JSON.stringify(b).includes('"_leia"'), 'notas internas fora do arquivo do app')
})

test('publicação BDR com código: o arquivo do app traz só o cabeçalho (NENHUM ticker) e a lista vai para dados-privados', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, classe: 'bdrs', cfg: aprovado(cfgBdrAcesso), insumos: insumosBdrPub(), log: () => {} })
  const publico = saida(raiz, 'webapp-src/src/data/bdrsDesconto.json')
  const privado = saida(raiz, 'dados-privados/bdr-desconto.json')
  assert.equal(publico.publicado, true)
  assert.equal(publico.acessoRestrito, true)
  assert.equal(publico.instagram, 'acarteiraideal')
  assert.deepEqual([publico.ranking, publico.aConferir, publico.exclusoes], [[], [], []])
  const texto = JSON.stringify(publico)
  assert.ok(!/\b[A-Z0-9]{4}3[1-5]\b/.test(texto), 'nenhum código de BDR no arquivo público')
  assert.ok(!texto.includes('"_leia"'))
  assert.deepEqual(publico.contagens, { ranking: 2, aConferir: 0, exclusoes: 0 })
  assert.deepEqual(privado.ranking.map((x) => x.ticker), ['FUND34', 'LENT34'])
  assert.equal(privado.hashResultado, publico.hashResultado)
})

test('publicação BDR sem aprovação: cabeçalho público e arquivo privado "não publicado"', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, classe: 'bdrs', cfg: cfgBdrAcesso, insumos: insumosBdrPub(), log: () => {} })
  assert.equal(saida(raiz, 'webapp-src/src/data/bdrsDesconto.json').publicado, false)
  assert.deepEqual(saida(raiz, 'dados-privados/bdr-desconto.json'), { publicado: false })
})

test('trava de sanidade: o job falha, a auditoria fica gravada e os arquivos do app NÃO mudam', () => {
  const raiz = raizTemporaria()
  const pub = path.join(raiz, 'webapp-src', 'src', 'data')
  fs.mkdirSync(pub, { recursive: true })
  fs.mkdirSync(path.join(raiz, 'dados-privados'), { recursive: true })
  fs.writeFileSync(path.join(pub, 'bdrsDesconto.json'), '{"sentinela":"publico"}')
  fs.writeFileSync(path.join(raiz, 'dados-privados', 'bdr-desconto.json'), '{"sentinela":"privado"}')
  const exigente = { ...aprovado(cfgBdrAcesso), publicacao: { ...aprovado(cfgBdrAcesso).publicacao, sanidade: { minimoNaLista: 15, maximoFracaoSemCotacao: 0.5 } } }
  assert.throws(() => concluir({ raiz, classe: 'bdrs', cfg: exigente, insumos: insumosBdrPub(), log: () => {} }), /trava de sanidade.*o app não foi alterado/)
  assert.equal(fs.readFileSync(path.join(pub, 'bdrsDesconto.json'), 'utf8'), '{"sentinela":"publico"}')
  assert.equal(fs.readFileSync(path.join(raiz, 'dados-privados', 'bdr-desconto.json'), 'utf8'), '{"sentinela":"privado"}')
  assert.ok(fs.existsSync(path.join(raiz, 'auditoria', 'top15-bdrs', '2026-10-08', 'manifesto.json')))
})

test('executar de novo com os mesmos dados não altera a auditoria já gravada', () => {
  const raiz = raizTemporaria()
  const logs = []
  concluir({ raiz, classe: 'etfs', cfg: cfgEtf, insumos: insumosEtfPub(), log: () => {} })
  const antes = fs.readFileSync(path.join(raiz, 'auditoria', 'top15-etfs', '2026-10-08', 'manifesto.json'), 'utf8')
  concluir({ raiz, classe: 'etfs', cfg: cfgEtf, insumos: insumosEtfPub(), log: (m) => logs.push(m), agora: new Date('2030-01-01') })
  assert.equal(fs.readFileSync(path.join(raiz, 'auditoria', 'top15-etfs', '2026-10-08', 'manifesto.json'), 'utf8'), antes)
  assert.ok(logs.some((l) => /Sem mudança/.test(l)))
})

test('CSV: cabeçalho e linhas com o mesmo número de colunas; texto com ; ou aspas é protegido', () => {
  const { resultado } = calcularEtfs(insumosEtf([etf('AAAA11', plana(10, 500)), { ...etf('BBBB11', plana(10, 600)), nome: 'Fundo "A"; B' }]), cfgEtf)
  const arquivos = arquivosCsv('etfs', resultado)
  assert.deepEqual(Object.keys(arquivos), ['ranking-geral.csv', 'ranking-por-categoria.csv', 'exclusoes.csv'])
  const linhas = arquivos['ranking-geral.csv'].replace('﻿', '').trim().split('\n')
  assert.equal(linhas[0], 'posicaoGeral;ticker;nome;categoria;volumeMediano;volumeMedio;diasNegociados;cotacao;dataCotacao;variacao3m')
  assert.match(linhas[1], /^1;BBBB11;"Fundo ""A""; B";Bolsa;600;/)
})

test('semNotas remove as chaves _ em qualquer nível', () => {
  assert.deepEqual(semNotas({ a: 1, _leia: 'x', b: { _leia: 'y', c: [{ _z: 1, d: 2 }] } }), { a: 1, b: { c: [{ d: 2 }] } })
})

// ---------------------------------------------------------------------------------------
// Configuração real
// ---------------------------------------------------------------------------------------

test('configuração: versões, publicação aprovada pelo responsável em 08/10/2026, ETF aberto e BDR com código próprio', () => {
  for (const cfg of [cfgEtfsArquivo, cfgBdrsArquivo]) {
    assert.equal(cfg.versaoMetodologia, '1.1.0')
    assert.equal(cfg.publicacao.aprovadoPeloResponsavel, true, 'aprovado pelo responsável (D70)')
    assert.equal(cfg.publicacao.aprovacao.data, '2026-10-08')
    assert.equal(cfg.historicoDeVersoes.at(-1).versao, cfg.versaoMetodologia)
    assert.equal(cfg.tamanhoDaLista, 15)
    assert.match(cfg.publicacao.avisoProposto, /^Não é recomendação de investimento\./)
    assert.equal(cfg.publicacao.sanidade.minimoNaLista, 15)
  }
  assert.equal(cfgEtfsArquivo.publicacao.acesso, undefined, 'ETF: acesso aberto')
  assert.equal(cfgBdrsArquivo.publicacao.acesso.restritoPorCodigo, true, 'BDR: só com código do mês')
  assert.equal(cfgBdrsArquivo.publicacao.acesso.instagram, 'acarteiraideal')
  assert.match(cfgEtfsArquivo.publicacao.avisoProposto, /liquidez/)
  assert.match(cfgBdrsArquivo.publicacao.avisoProposto, /não é desconto de valor/i)
  assert.equal(cfgBdrsArquivo.volumeMinimoDiario, 300000, 'mesmo piso dos BDRs de ação do job de BDRs')
  assert.equal(cfgEtfsArquivo.volumeMinimoDiario, 500000, 'mesmo piso do job de ETFs')
  assert.equal(cfgBdrsArquivo.janelaMaxima, 252)
})

test('ETF: dia sem negócio entra como ZERO na mediana (3 dias sem negócio em 5 derrubam a mediana a zero, mesmo com 500 nos outros)', () => {
  const s = serieDe(new Array(N).fill(10), new Array(N).fill(500)).map((v, i) => (i >= N - 5 && i < N - 2 ? null : v))
  const { resultado } = calcularEtfs(insumosEtf([etf('AAAA11', s)]), { ...cfgEtf, diasNegociadosMinimos: 1 })
  assert.deepEqual(resultado.exclusoes.map((e) => e.codigo), ['liquidez_baixa'], 'mediana de 0,0,0,500,500 = 0')
  assert.match(resultado.exclusoes[0].motivo, /R\$ 0 por dia/)
})

test('limites inclusivos, ETF e BDR: exatamente no mínimo de liquidez, de dias negociados e no máximo de pregões sem negócio ENTRA', () => {
  // Janela de 5 pregões: negociou em 3 (mínimo 3), mediana 100 (mínimo 100: volumes 0,0,100,100,100) e o último negócio
  // foi há 2 pregões (máximo 2).
  const noLimite = serieDe(new Array(N).fill(10), new Array(N).fill(100)).map((v, i) => (i >= N - 2 ? null : v))
  const e = calcularEtfs(insumosEtf([etf('AAAA11', noLimite)]), cfgEtf).resultado
  assert.deepEqual([e.geral.length, e.geral[0]?.diasNegociados, e.geral[0]?.volumeMediano], [1, 3, 100], JSON.stringify(e.exclusoes))
  const b = calcularBdrs(insumosBdr([bdr('AAAA34', noLimite)]), cfgBdr).resultado
  assert.deepEqual([b.ranking.length, b.ranking[0]?.diasNegociados, b.ranking[0]?.volumeMediano], [1, 3, 100], JSON.stringify(b.exclusoes))
})

test('BDR: desconto exatamente em 60% fica no ranking; só acima disso vai para "a conferir"', () => {
  const s = serieDe([100, 90, 80, 70, 60, 50, 45, 42, 40, 40, 40, 40, 40, 40], volume)
  const { resultado } = calcularBdrs(insumosBdr([bdr('AAAA34', s)]), { ...cfgBdr, janelaMaxima: 14, pregoesMinimosHistorico: 14 })
  assert.deepEqual(resultado.aConferir, [])
  assert.equal(resultado.ranking[0].desconto, 0.6)
})
// ---------------------------------------------------------------------------------------
// FIIs, ações e BDRs mais negociados (D71): mesmo cálculo de liquidez dos ETFs, com a classe nos insumos
// ---------------------------------------------------------------------------------------

const cfgsLiquidez = {
  fiis: lerJson(RAIZ, 'config', 'top15-fiis.json'),
  acoes: lerJson(RAIZ, 'config', 'top15-acoes.json'),
  'bdrs-negociados': lerJson(RAIZ, 'config', 'top15-bdrs-negociados.json'),
}
const calculoPorClasse = { fiis: calcularFiis, acoes: calcularAcoes, 'bdrs-negociados': calcularBdrsNegociados }
const comJanelasPequenas = (cfg) => ({ ...cfg, tamanhoDaLista: 3, tamanhoPorCategoria: 1, janelaLiquidez: 5, janela3Meses: 8, volumeMinimoDiario: 100, diasNegociadosMinimos: 3, pregoesMaxSemNegocio: 2,
  publicacao: { ...cfg.publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoNaLista: 1, maximoFracaoSemCotacao: 0.9 } } })

test('FIIs, ações e BDRs mais negociados: o resultado leva a classe certa e ordena como os ETFs (mediana do volume)', () => {
  for (const classe of ['fiis', 'acoes', 'bdrs-negociados']) {
    const ativos = [etf('BBBB11', plana(10, 300), 'Seg B'), etf('AAAA11', plana(10, 900), 'Seg A'), etf('CCCC11', serieDe(new Array(N).fill(10), [...new Array(N - 1).fill(10), 5000]), 'Seg A')]
    const { resultado } = calculoPorClasse[classe]({ ...insumosEtf(ativos), classe: undefined, ordemCategorias: ['Seg A', 'Seg B'] }, { ...comJanelasPequenas(cfgsLiquidez[classe]), volumeMinimoDiario: 5 })
    assert.equal(resultado.classe, classe)
    assert.deepEqual(resultado.geral.map((x) => x.ticker), ['AAAA11', 'BBBB11', 'CCCC11'], `${classe}: CCCC11 tem um dia gigante, mas a mediana é 10`)
    assert.deepEqual(Object.keys(resultado.porCategoria), ['Seg A', 'Seg B'])
    assert.deepEqual(resultado.porCategoria['Seg A'].map((x) => x.ticker), ['AAAA11'], 'tamanhoPorCategoria = 1')
  }
})

test('configuração dos três rankings novos: abertos, sem código, com aviso, e pisos coerentes com cada classe', () => {
  for (const [classe, cfg] of Object.entries(cfgsLiquidez)) {
    assert.equal(cfg.versaoMetodologia, '1.1.0', classe)
    assert.equal(cfg.historicoDeVersoes.at(-1).versao, cfg.versaoMetodologia, classe)
    assert.equal(cfg.publicacao.aprovadoPeloResponsavel, true, `: publicação aprovada em 08/10/2026 (D71)`)
    assert.equal(cfg.publicacao.aprovacao.data, '2026-10-08', classe)
    assert.equal(cfg.tamanhoDaLista, 15, classe)
    assert.equal(cfg.janelaLiquidez, 21, classe)
    assert.equal(cfg.publicacao.acesso, undefined, `${classe}: ranking aberto, sem código`)
    assert.match(cfg.publicacao.avisoProposto, /^Não é recomendação de investimento\./, classe)
    assert.match(cfg.publicacao.avisoProposto, /liquidez/, classe)
    assert.equal(cfg.publicacao.sanidade.minimoNaLista, 15, classe)
    assert.equal(CLASSES[classe].privado, null, `${classe}: sem arquivo privado`)
  }
  assert.equal(cfgsLiquidez.fiis.volumeMinimoDiario, 300000, 'mesmo piso dos FIIs (D13)')
  assert.equal(cfgsLiquidez.acoes.volumeMinimoDiario, 1000000)
  assert.equal(cfgsLiquidez['bdrs-negociados'].volumeMinimoDiario, 300000, 'mesmo piso dos BDRs de ação')
  assert.equal(cfgsLiquidez.fiis.janela3Meses, 60, 'o histórico de FIIs tem 61 pregões: a janela de variação é de 60')
  assert.ok(cfgsLiquidez.fiis.ordemCategorias.includes('Logística'))
})

test('insumos de FII: nome e segmento do job de FIIs, "Outros" para quem não está lá, recorte e série curta alinhada', () => {
  const pregoes = datas(10)
  const historico = { pregoes, nomes: { AAAA11: 'Nome antigo do histórico', CCCC11: 'Nome do histórico' }, ativos: { AAAA11: serieDe(new Array(10).fill(10), new Array(10).fill(500)), BBBB11: serieDe([5, 5, 5], [1, 1, 1]), CCCC11: serieDe(new Array(10).fill(10), new Array(10).fill(500)) } }
  const ins = montarInsumosFiis({ historico, fundos: [{ ticker: 'AAAA11', nome: 'Fundo A', setor: 'Logística' }, { ticker: 'BBBB11', nome: 'Fundo B', setor: 'Shoppings' }], cfg: { pregoesNosInsumos: 6, ordemCategorias: ['Logística'] }, dataExecucao: '2026-10-08' })
  assert.equal(ins.classe, 'fiis')
  assert.deepEqual(ins.pregoes, pregoes.slice(-6))
  assert.deepEqual(ins.ativos.map((a) => [a.ticker, a.nome, a.categoria, a.serie.length]), [['AAAA11', 'Fundo A', 'Logística', 6], ['BBBB11', 'Fundo B', 'Shoppings', 6], ['CCCC11', 'Nome do histórico', 'Outros', 6]])
  assert.deepEqual(ins.ativos[1].serie.slice(0, 3), [null, null, null])
  assert.deepEqual(ins.ordemCategorias, ['Logística'])
  assert.deepEqual(ins.excluidos, [])
})

test('insumos de ação: nome e setor do job de ações, ordem dos setores do app', () => {
  const pregoes = datas(8)
  const s = serieDe(new Array(8).fill(10), new Array(8).fill(500))
  const historico = { pregoes, ativos: { PETR4: s, XXXX3: s } }
  const ins = montarInsumosAcoes({ historico, busca: [{ ticker: 'PETR4', nome: 'Petrobras', setor: 'Petróleo' }], setores: [{ setor: 'Bancos' }, { setor: 'Petróleo' }], cfg: { pregoesNosInsumos: 5 }, dataExecucao: '2026-10-08' })
  assert.equal(ins.classe, 'acoes')
  assert.deepEqual(ins.ativos.map((a) => [a.ticker, a.nome, a.categoria]), [['PETR4', 'Petrobras', 'Petróleo'], ['XXXX3', 'XXXX3', 'Outros']])
  assert.deepEqual(ins.ordemCategorias, ['Bancos', 'Petróleo'])
})

test('insumos de BDR mais negociado: BDRs de ação (31 a 35) E de ETF (39), sem derivativos; empresas brasileiras vão para as exclusões', () => {
  const pregoes = datas(5)
  const s = serieDe(new Array(5).fill(10), new Array(5).fill(500))
  const historico = { pregoes, cadastro: {}, ativos: { AAPL34: s, SPXI39: s, DI1F31: s, PETR4: s, XPBR31: s } }
  const ins = montarInsumosBdrsNegociados({ historico, configBdrs: { excluir: { tickers: ['XPBR31'] } }, cfg: { pregoesNosInsumos: 5 }, dataExecucao: '2026-10-08' })
  assert.equal(ins.classe, 'bdrs-negociados')
  assert.deepEqual(ins.ativos.map((a) => [a.ticker, a.categoria === 'BDRs de ETF' ? 'etf' : 'acao']), [['AAPL34', 'acao'], ['SPXI39', 'etf'], ['XPBR31', 'acao']])
  assert.deepEqual(ins.excluidos, ['XPBR31'])
  const { resultado } = calcularBdrsNegociados(ins, comJanelasPequenas(cfgsLiquidez['bdrs-negociados']))
  assert.deepEqual(resultado.geral.map((x) => x.ticker).sort(), ['AAPL34', 'SPXI39'], 'XPBR31 sai por decisão registrada')
  assert.deepEqual(resultado.exclusoes.map((e) => [e.ticker, e.codigo]), [['XPBR31', 'excluido_manual']])
})

test('publicação aberta (sem código) dos três rankings novos: cabeçalho e lista no MESMO arquivo, sem arquivo privado, e a verificação independente aprova', () => {
  for (const classe of ['fiis', 'acoes', 'bdrs-negociados']) {
    const cfg = aprovado(comJanelasPequenas(cfgsLiquidez[classe]))
    const raiz = raizTemporaria()
    const ins = { ...insumosEtfPub(), classe }
    const r = concluir({ raiz, classe, cfg, insumos: ins, log: () => {} })
    assert.equal(r.publicado, true, classe)
    const arquivo = path.relative(raiz, path.join(raiz, CLASSES[classe].snapshotApp)).split(path.sep).join('/')
    const pub = saida(raiz, arquivo)
    assert.equal(pub.publicado, true, classe)
    assert.equal(pub.acessoRestrito, false, classe)
    assert.deepEqual(pub.geral.map((x) => x.ticker), ['BBBB11', 'AAAA11'], classe)
    assert.ok(!fs.existsSync(path.join(raiz, 'dados-privados')), `${classe}: sem arquivo privado`)
    assert.ok(!JSON.stringify(pub).includes('"_leia"'), classe)
    const pasta = path.join(raiz, 'auditoria', CLASSES[classe].pasta, '2026-10-08')
    const man = lerJson(pasta, 'manifesto.json')
    assert.equal(man.classe, classe)
    const v = verificar(pasta, raiz)
    assert.equal(v.ok, true, `${classe}: ${JSON.stringify(v.mensagens.filter((m) => !m.ok))}`)
  }
})

test('sem aprovação, cada ranking novo grava só o cabeçalho "em validação" (sem nenhum ativo)', () => {
  for (const classe of ['fiis', 'acoes', 'bdrs-negociados']) {
    const raiz = raizTemporaria()
    concluir({ raiz, classe, cfg: comJanelasPequenas(cfgsLiquidez[classe]), insumos: { ...insumosEtfPub(), classe }, log: () => {} })
    const pub = saida(raiz, CLASSES[classe].snapshotApp.split(path.sep).join('/'))
    assert.equal(pub.publicado, false, classe)
    assert.deepEqual([pub.geral, pub.porCategoria, pub.exclusoes], [[], {}, []], classe)
  }
})

test('cada classe tem sua própria pasta de auditoria, seu config e seu arquivo do app (nenhuma sobrescreve a outra)', () => {
  const pastas = Object.values(CLASSES).map((c) => c.pasta)
  const apps = Object.values(CLASSES).map((c) => c.snapshotApp)
  const configs = Object.values(CLASSES).map((c) => c.config)
  for (const lista of [pastas, apps, configs]) assert.equal(new Set(lista).size, lista.length)
  assert.deepEqual(Object.keys(CLASSES).sort(), ['acoes', 'bdrs', 'bdrs-negociados', 'etfs', 'fiis', 'ibov', 'ifix'])
  for (const c of Object.values(CLASSES)) assert.ok(fs.existsSync(path.join(RAIZ, 'config', c.config)), c.config)
})
// ---------------------------------------------------------------------------------------
// IFIX e Ibovespa: os maiores pesos da carteira teórica da B3 (D72)
// ---------------------------------------------------------------------------------------

const cfgsIndice = { ifix: lerJson(RAIZ, 'config', 'top15-ifix.json'), ibov: lerJson(RAIZ, 'config', 'top15-ibov.json') }
const cfgIdx = (classe, o = {}) => ({ ...cfgsIndice[classe], tamanhoDaLista: 3, ...o, publicacao: { ...cfgsIndice[classe].publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoNaLista: 3, minimoComponentes: 5, toleranciaSomaPesos: 0.5, idadeMaximaDias: 10 }, ...(o.publicacao ?? {}) } })
const comp = (ticker, peso, extra = {}) => ({ ticker, nome: `Nome ${ticker}`, tipo: 'ON', setor: 'Setor X', peso, quantidadeTeorica: 1000, ...extra })
const insumosIdx = (classe = 'ibov', componentes = null, extra = {}) => ({
  classe, indice: classe === 'ibov' ? 'IBOV' : 'IFIX', dataExecucao: '2026-10-08', dataComposicao: '2026-10-08',
  componentes: componentes ?? [comp('CCCC3', 10), comp('AAAA3', 40), comp('BBBB3', 30), comp('DDDD3', 8), comp('EEEE3', 7), comp('FFFF3', 5)],
  mercado: { AAAA3: { cotacao: 10, dataCotacao: '2026-10-07', volumeMediano: 5000 } }, ...extra,
})

test('índice: os 3 maiores pesos, em ordem, com peso acumulado calculado à mão (40 → 70 → 80)', () => {
  const { resultado } = calcularIndice(insumosIdx(), cfgIdx('ibov'))
  assert.deepEqual(resultado.ranking.map((r) => [r.posicao, r.ticker, r.peso, r.pesoAcumulado]), [[1, 'AAAA3', 40, 40], [2, 'BBBB3', 30, 70], [3, 'CCCC3', 10, 80]])
  assert.equal(resultado.somaPesos, 100)
  assert.equal(resultado.somaPesosDaLista, 80)
  assert.equal(resultado.universo, 6)
  assert.equal(resultado.classe, 'ibov')
  assert.equal(resultado.indice, 'IBOV')
  assert.equal(resultado.ultimoPregao, '2026-10-08')
  assert.deepEqual(resultado.exclusoes, [])
})

test('índice: desempate de peso por ordem alfabética; cotação e volume são informativos e podem faltar', () => {
  const comps = [comp('ZZZZ3', 20), comp('MMMM3', 20), comp('AAAA3', 20), comp('BBBB3', 20), comp('CCCC3', 20)]
  const { resultado } = calcularIndice(insumosIdx('ibov', comps), cfgIdx('ibov'))
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['AAAA3', 'BBBB3', 'CCCC3'])
  const { resultado: r2 } = calcularIndice(insumosIdx(), cfgIdx('ibov'))
  assert.deepEqual([r2.ranking[0].cotacao, r2.ranking[0].volumeMediano, r2.ranking[1].cotacao, r2.ranking[1].volumeMediano], [10, 5000, null, null])
})

test('índice: peso acumulado e soma dos pesos não carregam erro de ponto flutuante (0,2 + 0,1 daria 0,30000000000000004)', () => {
  const comps = [comp('AAAA3', 0.2), comp('BBBB3', 0.1), comp('CCCC3', 0.05)]
  assert.equal(0.2 + 0.1, 0.30000000000000004, 'premissa do teste: a soma crua tem ruído')
  const { resultado } = calcularIndice(insumosIdx('ibov', comps), cfgIdx('ibov', { tamanhoDaLista: 3 }))
  assert.deepEqual(resultado.ranking.map((r) => r.pesoAcumulado), [0.2, 0.3, 0.35])
  assert.equal(resultado.somaPesos, 0.35)
  assert.equal(resultado.somaPesosDaLista, 0.35)
})

test('índice: determinismo, hash igual em qualquer ordem dos componentes', () => {
  const a = insumosIdx()
  const b = insumosIdx('ibov', [...a.componentes].reverse())
  assert.equal(hashDoResultado(calcularIndice(a, cfgIdx('ibov')).resultado), hashDoResultado(calcularIndice(b, cfgIdx('ibov')).resultado))
})

test('sanidade do índice: poucos ativos, carteira incompleta, pesos que não somam 100 e carteira velha derrubam o job', () => {
  const san = { sanidade: { minimoNaLista: 3, minimoComponentes: 5, toleranciaSomaPesos: 0.5, idadeMaximaDias: 10 } }
  const bom = calcularIndice(insumosIdx(), cfgIdx('ibov')).resultado
  assert.deepEqual(verificarSanidade(bom, san), [])
  assert.match(verificarSanidade({ ...bom, ranking: bom.ranking.slice(0, 2) }, san)[0], /só 2 ativos na lista \(mínimo 3\)/)
  assert.match(verificarSanidade({ ...bom, universo: 4 }, san)[0], /a carteira tem 4 ativos \(mínimo 5\)/)
  assert.match(verificarSanidade({ ...bom, somaPesos: 99.4 }, san)[0], /pesos somam 99.4%/)
  assert.deepEqual(verificarSanidade({ ...bom, somaPesos: 99.5 }, san), [], 'exatamente na tolerância passa')
  assert.deepEqual(verificarSanidade({ ...bom, somaPesos: 100.5 }, san), [])
  assert.match(verificarSanidade({ ...bom, somaPesos: 100.6 }, san)[0], /pesos somam/)
  assert.deepEqual(verificarSanidade({ ...bom, dataComposicao: '2026-09-28' }, san), [], '10 dias: exatamente no limite passa')
  assert.match(verificarSanidade({ ...bom, dataComposicao: '2026-09-27' }, san)[0], /11 dias antes da execução.*desatualizada/)
  assert.match(verificarSanidade({ ...bom, dataComposicao: '2026-10-09' }, san)[0], /-1 dias/, 'carteira do futuro também é suspeita')
})

test('insumos de índice: nome e setor do app, cotação e volume mediano do histórico da B3, nome da B3 para FII', () => {
  const pregoes = datas(8)
  const serie = serieDe([10, 10, 10, 11, 12, 12, 12, 13], [0, 100, 100, 100, 500, 500, 500, 500])
  const historico = { pregoes, ativos: { AAAA3: serie } }
  const composicao = { data: '2026-10-08', componentes: [{ ticker: 'AAAA3', nome: 'AAAA SA', tipo: 'ON', peso: 60, quantidadeTeorica: 10 }, { ticker: 'BBBB3', nome: 'BBBB SA', tipo: 'PN', peso: 40, quantidadeTeorica: 20 }] }
  const apoio = { porTicker: new Map([['AAAA3', { nome: 'Empresa A', setor: 'Bancos' }]]) }
  const acao = montarInsumosIndice({ classe: 'ibov', composicao, historico, apoio, cfg: { janelaLiquidez: 5 }, dataExecucao: '2026-10-08' })
  assert.deepEqual(acao.componentes.map((c) => [c.ticker, c.nome, c.setor]), [['AAAA3', 'Empresa A', 'Bancos'], ['BBBB3', 'BBBB SA', null]])
  assert.deepEqual(acao.mercado, { AAAA3: { cotacao: 13, dataCotacao: pregoes[7], volumeMediano: 500 } }, 'BBBB3 não tem histórico: sem dado de mercado')
  assert.equal(acao.indice, 'IBOV')
  assert.equal(acao.dataComposicao, '2026-10-08')
  const fii = montarInsumosIndice({ classe: 'ifix', composicao, historico, apoio, cfg: { janelaLiquidez: 5 }, dataExecucao: '2026-10-08' })
  assert.equal(fii.componentes[0].nome, 'AAAA SA', 'FII: o nome é o curto da B3, não o do job de FIIs')
  assert.equal(fii.componentes[0].setor, 'Bancos')
  assert.equal(fii.indice, 'IFIX')
})

function raizComDados(classe) {
  const raiz = raizTemporaria()
  const pregoes = datas(30)
  fs.mkdirSync(path.join(raiz, 'historico'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'config'), { recursive: true })
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  const ativos = { AAAA3: serieDe(new Array(30).fill(10), new Array(30).fill(500)), AAAA11: serieDe(new Array(30).fill(10), new Array(30).fill(500)) }
  fs.writeFileSync(path.join(raiz, 'historico', classe === 'ibov' ? 'acoes.json' : 'fiis.json'), JSON.stringify({ pregoes, ativos }))
  fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), JSON.stringify({ busca: [{ ticker: 'AAAA3', nome: 'Empresa A', setor: 'Bancos' }] }))
  fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'rendimentosFii.json'), JSON.stringify({ fundos: [{ ticker: 'AAAA11', setor: 'Logística' }] }))
  const cfg = cfgIdx(classe, { tamanhoDaLista: 2, publicacao: { sanidade: { minimoNaLista: 2, minimoComponentes: 5, toleranciaSomaPesos: 0.5, idadeMaximaDias: 10 } } })
  fs.writeFileSync(path.join(raiz, 'config', `top15-${classe}.json`), JSON.stringify(cfg))
  return { raiz, cfg }
}
const composicaoFalsa = (classe) => ({ url: 'https://exemplo/b3', sha256: 'f'.repeat(64), bytes: 1234, baixadoEm: '2026-10-08T10:00:00Z', data: '2026-10-08', componentes: [
  { ticker: classe === 'ibov' ? 'AAAA3' : 'AAAA11', nome: 'AAAA', tipo: 'ON', peso: 50, quantidadeTeorica: 1 },
  ...['BBBB', 'CCCC', 'DDDD', 'EEEE'].map((t, i) => ({ ticker: `${t}${classe === 'ibov' ? '3' : '11'}`, nome: t, tipo: 'ON', peso: 12.5, quantidadeTeorica: i })),
] })

test('executarIndice: monta fontes (carteira da B3 com sha256, histórico, nomes), grava a auditoria e a verificação independente aprova', async () => {
  for (const classe of ['ibov', 'ifix']) {
    const { raiz } = raizComDados(classe)
    const r = await executarIndice({ classe, raiz, hoje: '2026-10-08', log: () => {}, composicaoLocal: composicaoFalsa(classe) })
    assert.equal(r.publicado, false)
    const pasta = path.join(raiz, 'auditoria', CLASSES[classe].pasta, '2026-10-08')
    const man = lerJson(pasta, 'manifesto.json')
    assert.equal(man.classe, classe)
    assert.equal(man.fontes[0].sha256, 'f'.repeat(64))
    assert.equal(man.fontes[0].dataDaCarteira, '2026-10-08')
    assert.equal(man.fontes.length, 3)
    assert.ok(man.fontes.every((f) => f.url))
    const res = lerJson(pasta, 'resultado.json')
    assert.equal(res.ranking[0].peso, 50)
    assert.equal(res.ranking[0].volumeMediano, 500)
    const v = verificar(pasta, raiz)
    assert.equal(v.ok, true, `${classe}: ${JSON.stringify(v.mensagens.filter((m) => !m.ok))}`)
    assert.ok(fs.existsSync(path.join(pasta, 'ranking.csv')))
  }
})

test('executarIndice: sem histórico, classe errada e carteira velha (trava) deixam o app intacto ou nem começam', async () => {
  await assert.rejects(executarIndice({ classe: 'etfs', raiz: raizTemporaria(), log: () => {} }), /Classe de índice inválida/)
  const sem = raizComDados('ibov')
  fs.rmSync(path.join(sem.raiz, 'historico'), { recursive: true })
  await assert.rejects(executarIndice({ classe: 'ibov', raiz: sem.raiz, hoje: '2026-10-08', log: () => {}, composicaoLocal: composicaoFalsa('ibov') }), /historico\/acoes.json não existe/)

  const { raiz } = raizComDados('ifix')
  const pub = path.join(raiz, 'webapp-src', 'src', 'data', 'ifixMaioresPesos.json')
  fs.writeFileSync(pub, '{"sentinela":"publico"}')
  const velha = { ...composicaoFalsa('ifix'), data: '2026-09-01' }
  await assert.rejects(executarIndice({ classe: 'ifix', raiz, hoje: '2026-10-08', log: () => {}, composicaoLocal: velha }), /trava de sanidade.*desatualizada.*o app não foi alterado/)
  assert.equal(fs.readFileSync(pub, 'utf8'), '{"sentinela":"publico"}')
})

test('publicação aberta do índice: cabeçalho e lista no mesmo arquivo, sem arquivo privado; sem aprovação só o cabeçalho', async () => {
  const { raiz, cfg } = raizComDados('ibov')
  await executarIndice({ classe: 'ibov', raiz, hoje: '2026-10-08', log: () => {}, composicaoLocal: composicaoFalsa('ibov') })
  const fechado = saida(raiz, 'webapp-src/src/data/ibovMaioresPesos.json')
  assert.equal(fechado.publicado, false)
  assert.deepEqual(fechado.ranking, [])
  assert.deepEqual([fechado.indice, fechado.dataComposicao, fechado.somaPesos], ['IBOV', '2026-10-08', 100])

  fs.writeFileSync(path.join(raiz, 'config', 'top15-ibov.json'), JSON.stringify(aprovado(cfg)))
  const r = await executarIndice({ classe: 'ibov', raiz, hoje: '2026-10-08', log: () => {}, composicaoLocal: composicaoFalsa('ibov') })
  assert.equal(r.publicado, true)
  const aberto = saida(raiz, 'webapp-src/src/data/ibovMaioresPesos.json')
  assert.equal(aberto.publicado, true)
  assert.equal(aberto.acessoRestrito, false)
  assert.deepEqual(aberto.ranking.map((x) => [x.ticker, x.peso, x.pesoAcumulado]), [['AAAA3', 50, 50], ['BBBB3', 12.5, 62.5]])
  assert.equal(aberto.somaPesosDaLista, 62.5)
  assert.ok(!fs.existsSync(path.join(raiz, 'dados-privados')))
  assert.ok(!JSON.stringify(aberto).includes('"_leia"'))
})

test('configuração dos índices: abertos, sem código, com aviso e limites de sanidade', () => {
  for (const [classe, cfg] of Object.entries(cfgsIndice)) {
    assert.equal(cfg.versaoMetodologia, '1.0.0', classe)
    assert.equal(cfg.historicoDeVersoes.at(-1).versao, cfg.versaoMetodologia, classe)
    assert.equal(cfg.tamanhoDaLista, 15, classe)
    assert.equal(cfg.publicacao.acesso, undefined, `${classe}: aberto, sem código`)
    assert.match(cfg.publicacao.avisoProposto, /^Não é recomendação de investimento\./, classe)
    assert.match(cfg.publicacao.avisoProposto, /composição oficial/, classe)
    assert.equal(cfg.publicacao.sanidade.toleranciaSomaPesos, 0.5, classe)
    assert.equal(cfg.publicacao.sanidade.idadeMaximaDias, 10, classe)
    assert.equal(CLASSES[classe].privado, null, classe)
  }
  assert.equal(cfgsIndice.ifix.publicacao.sanidade.minimoComponentes, 50)
  assert.equal(cfgsIndice.ibov.publicacao.sanidade.minimoComponentes, 40)
  assert.equal(CLASSES.ifix.indice, 'IFIX')
  assert.equal(CLASSES.ibov.indice, 'IBOV')
})