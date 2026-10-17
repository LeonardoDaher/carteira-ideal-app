// Testes do job do Simule Opções (node --test): leitura do cadastro de instrumentos, parser do COTAHIST e snapshot.
// As linhas imitam o layout real conferido em 16/10/2026 (COTAHIST de 245 caracteres; cadastro CSV com ";").
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CONFIG, URL_COTAHIST, adicionarMeses, calcularTendencia, tendenciasDosHistoricos, URL_PEDIDO_CADASTRO, lerCadastro, lerLinha, lerPregao, montarSnapshot, motivoInvalido, numeroBr,
} from './atualizar-opcoes.mjs'

const campo = (valor, tamanho, direita = false) => (direita ? String(valor).padStart(tamanho, '0') : String(valor).padEnd(tamanho, ' '))
const centavos = (reais) => campo(Math.round(reais * 100), 13, true)

/** Monta uma linha de 245 caracteres com só os campos que o parser lê; o resto fica em branco. */
function linha({ bdi, codigo, mercado, nome = 'PETROBRAS', ultimo, negocios = 5, volume = 10_000, data = '20261016' }) {
  const buf = new Array(245).fill(' ')
  // Posições reais (base 1): DATA 3-10, CODBDI 11-12, CODNEG 13-24, TPMERC 25-27, NOMRES 28-39, PREULT 109-121,
  // TOTNEG 148-152, VOLTOT 171-188.
  const poe = (ini, texto) => { for (let i = 0; i < texto.length; i++) buf[ini - 1 + i] = texto[i] }
  poe(1, '01'); poe(3, data); poe(11, bdi); poe(13, campo(codigo, 12)); poe(25, mercado); poe(28, campo(nome, 12))
  poe(109, centavos(ultimo)); poe(148, campo(negocios, 5, true)); poe(171, campo(Math.round(volume * 100), 18, true))
  return buf.join('')
}

const arquivoDia = (data, linhas) => ['00COTAHIST.2026BOVESPA ' + data, ...linhas.map((l) => l(data)), '99COTAHIST.2026BOVESPA ' + data].join('\n')
const vista = (codigo, ultimo) => (data) => linha({ bdi: '02', codigo, mercado: '010', ultimo, data })
const opcao = (codigo, tipo, ultimo, extra = {}) => (data) =>
  linha({ bdi: tipo === 'call' ? '78' : '82', codigo, mercado: tipo === 'call' ? '070' : '080', ultimo, data, ...extra })

const CABECALHO = 'RptDt;TckrSymb;Asst;AsstDesc;SgmtNm;MktNm;SctyCtgyNm;XprtnDt;OptnTp;AllcnRndLot;ExrcPric;OptnStyle'
const reg = (cod, ativo, tipo, venc, strike, estilo, categoria = 'OPTION ON EQUITIES', lote = 100) =>
  ['2026-10-16', cod, ativo, ativo.slice(0, 4), 'EQUITY CALL', 'EQUITY-DERIVATE', categoria, venc, tipo, lote, strike, estilo].join(';')
const cadastroTexto = [
  'Status do Arquivo: Final',
  CABECALHO,
  reg('PETRK600', 'PETR4', 'Call', '2026-11-19', '6,01', 'EURO'),
  reg('PETRW600', 'PETR4', 'Put', '2026-11-19', '6,01', 'EURO'),
  reg('PETRK450', 'PETR4', 'Call', '2026-11-19', '4,50', 'AMER'),
  reg('PETRJ600', 'PETR4', 'Call', '2026-10-16', '6,00', 'AMER'), // vence no pregão: sai
  reg('IBOVK100', 'IBOV', 'Call', '2026-11-19', '100', 'EURO', 'OPTION ON INDEX'), // opção de índice: fora
  reg('SEMPRECO', 'PETR4', 'Call', '2026-11-19', '5,00', 'AMER'), // nunca negociou: fora
  reg('VALEK700', 'VALE3', 'Call', '2026-11-19', '7,00', 'AMER'), // sem papel à vista: fora
  reg('BOVAW200', 'BOVA11', 'Put', '2026-11-19', '201', 'EURO', 'OPTION ON EQUITIES', 1),
].join('\n')

const hoje = arquivoDia('20261016', [
  vista('PETR4', 60), vista('BOVA11', 202.3),
  opcao('PETRK600', 'call', 2.8, { negocios: 30, volume: 300_000 }),
  opcao('PETRW600', 'put', 2.2, { negocios: 20, volume: 200_000 }),
  opcao('BOVAW200', 'put', 0.5, { negocios: 4, volume: 4_000 }),
])
const ontem = arquivoDia('20261015', [
  vista('PETR4', 59),
  opcao('PETRK600', 'call', 3.0, { negocios: 10, volume: 100_000 }),
  opcao('PETRK450', 'call', 14.0, { negocios: 2, volume: 2_800 }),
])

describe('numeroBr e URLs', () => {
  it('lê número com vírgula e devolve null para vazio', () => {
    assert.equal(numeroBr('4,37'), 4.37)
    assert.equal(numeroBr('1.234,50'), 1234.5)
    assert.equal(numeroBr(''), null)
    assert.equal(numeroBr('abc'), null)
  })
  it('monta as URLs da B3', () => {
    assert.equal(URL_COTAHIST('2026-10-16'), 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D16102026.ZIP')
    assert.match(URL_PEDIDO_CADASTRO('2026-10-16'), /fileName=InstrumentsConsolidatedFile&date=2026-10-16/)
  })
})

describe('adicionarMeses', () => {
  it('mantém o dia e limita ao fim do mês', () => {
    assert.equal(adicionarMeses('2026-10-16', 6), '2027-04-16')
    assert.equal(adicionarMeses('2026-08-31', 6), '2027-02-28')
  })
})

describe('lerCadastro', () => {
  const cad = lerCadastro(cadastroTexto, '2026-10-16')

  it('guarda só opções de ações e ETFs que ainda não venceram, com estilo, strike e lote', () => {
    assert.deepEqual([...cad.keys()].sort(), ['BOVAW200', 'PETRK450', 'PETRK600', 'PETRW600', 'SEMPRECO', 'VALEK700'])
    assert.ok(!cad.has('PETRK999'))
    assert.deepEqual(cad.get('PETRK600'), { codigo: 'PETRK600', ativo: 'PETR4', tipo: 'call', estilo: 'europeia', strike: 6.01, vencimento: '2026-11-19', lote: 100 })
    assert.equal(cad.get('PETRK450').estilo, 'americana')
    assert.equal(cad.get('BOVAW200').lote, 1)
  })

  it('falha com mensagem clara se faltar cabeçalho ou coluna', () => {
    assert.throws(() => lerCadastro('nada', '2026-10-16'), /cabeçalho/)
    assert.throws(() => lerCadastro('RptDt;TckrSymb\n2026-10-16;X', '2026-10-16'), /coluna/)
  })
})

describe('lerLinha e lerPregao', () => {
  it('lê papel à vista e opção; ignora fracionário, cabeçalho e rodapé', () => {
    assert.equal(lerLinha(vista('PETR4', 60)('20261016')).tipo, 'vista')
    assert.equal(lerLinha(linha({ bdi: '96', codigo: 'PETR4F', mercado: '020', ultimo: 60 })), null)
    assert.equal(lerLinha('00COTAHIST.2026BOVESPA 20261016'), null)
    const o = lerLinha(opcao('PETRK600', 'call', 2.8, { negocios: 30, volume: 300_000 })('20261016'))
    assert.deepEqual({ tipo: o.tipo, codigo: o.codigo, ultimo: o.ultimo, negocios: o.negocios, volume: o.volume, data: o.data }, { tipo: 'opcao', codigo: 'PETRK600', ultimo: 2.8, negocios: 30, volume: 300_000, data: '2026-10-16' })
  })

  it('separa um pregão em papéis à vista e opções, por código', () => {
    const p = lerPregao(hoje)
    assert.equal(p.data, '2026-10-16')
    assert.deepEqual([...p.vista.keys()].sort(), ['BOVA11', 'PETR4'])
    assert.deepEqual([...p.opcoes.keys()].sort(), ['BOVAW200', 'PETRK600', 'PETRW600'])
  })
})

describe('montarSnapshot', () => {
  const cadastro = lerCadastro(cadastroTexto, '2026-10-16')
  const pregoes = [lerPregao(hoje), lerPregao(ontem)]
  const snap = montarSnapshot(cadastro, pregoes, new Date('2026-10-17T12:00:00Z'))

  it('junta cadastro e preços: só séries que negociaram na janela e só ativos com papel à vista', () => {
    assert.equal(snap.dataPregao, '2026-10-16')
    assert.deepEqual(snap.ativos.map((a) => a.ticker).sort(), ['BOVA11', 'PETR4'])
    const petr = snap.ativos.find((a) => a.ticker === 'PETR4')
    assert.deepEqual(petr.series.map((s) => s[0]), ['PETRK450', 'PETRK600', 'PETRW600'])
    assert.ok(!snap.ativos.some((a) => a.ticker === 'VALE3'))
  })

  it('traz estilo, último preço, data do negócio, variação contra o fechamento anterior e volume', () => {
    const petr = snap.ativos.find((a) => a.ticker === 'PETR4')
    assert.deepEqual(petr.series.find((s) => s[0] === 'PETRK600'), ['PETRK600', 'C', 'E', 6.01, '2026-11-19', 2.8, '2026-10-16', -6.67, 30, 300000])
    // PETRK450 só negociou ontem: mostra o preço de ontem, com a data de ontem e sem variação.
    assert.deepEqual(petr.series.find((s) => s[0] === 'PETRK450'), ['PETRK450', 'C', 'A', 4.5, '2026-11-19', 14, '2026-10-15', null, 2, 2800])
    assert.equal(petr.series.find((s) => s[0] === 'PETRW600')[7], null)
  })

  it('volume de opções do ativo conta só o último pregão, e o lote vem do cadastro', () => {
    const petr = snap.ativos.find((a) => a.ticker === 'PETR4')
    assert.equal(petr.volumeOpcoes, 500_000)
    assert.equal(petr.cotacao, 60)
    assert.equal(petr.dataCotacao, '2026-10-16')
    assert.equal(petr.variacao, 1.69) // 60 contra 59 do pregão anterior
    assert.equal(snap.ativos.find((a) => a.ticker === 'BOVA11').variacao, null) // só apareceu hoje
    assert.equal(snap.ativos.find((a) => a.ticker === 'BOVA11').lote, 1)
    assert.equal(snap.ativos[0].ticker, 'PETR4') // ordem por volume de opções
  })
})

describe('motivoInvalido', () => {
  const serie = (codigo) => [codigo, 'C', 'A', 10, '2026-11-19', 1, '2026-10-16', null, 5, 100]
  const ativo = (ticker, n = 1) => ({ ticker, nome: ticker, cotacao: 10, volumeOpcoes: 1, lote: 100, series: Array.from({ length: n }, (_, i) => serie(`${ticker}${i}`)) })
  const minimo = { ...CONFIG, minimoAtivosParaPublicar: 2, minimoSeriesParaPublicar: 2, controle: ['A', 'B'], minimoControle: 1 }

  it('recusa sem data, poucos ativos, poucas séries e ativos de controle ausentes', () => {
    assert.match(motivoInvalido({ dataPregao: null, ativos: [] }, minimo), /data de pregão/)
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('A', 3)] }, minimo), /Só 1 ativos/)
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('A'), ativo('B', 0)] }, minimo), /Só 1 séries/)
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('C'), ativo('D')] }, minimo), /controle/)
  })

  it('recusa série com preço zerado e aceita um snapshot bom', () => {
    const ruim = ativo('A')
    ruim.series[0][5] = 0
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ruim, ativo('B')] }, minimo), /Série inválida/)
    assert.equal(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('A'), ativo('B')] }, minimo), null)
  })
})

describe('calcularTendencia', () => {
  const datas = (n) => Array.from({ length: n }, (_, i) => `d${i}`)
  const rampa = (n, de, ate) => Array.from({ length: n }, (_, i) => de + ((ate - de) * i) / (n - 1))

  it('sem 64 fechamentos válidos, não calcula', () => {
    assert.equal(calcularTendencia(rampa(63, 10, 12), datas(63)), null)
    // metade dos dias sem negócio: só 35 fechamentos válidos em 70 pregões
    assert.equal(calcularTendencia(rampa(70, 10, 12).map((v, i) => (i % 2 ? null : v)), datas(70)), null)
  })

  it('numa alta constante: preço acima das médias, retorno positivo, no topo da faixa de 52 semanas', () => {
    const t = calcularTendencia(rampa(260, 10, 20), datas(260))
    assert.equal(t.fechamento, 20)
    assert.ok(t.sma21 < 20)
    assert.ok(t.sma63 < t.sma21)
    assert.ok(t.retorno21 > 0)
    assert.ok(t.retorno63 > t.retorno21)
    assert.equal(t.posicao52, 100)
    assert.equal(t.data, 'd259')
  })

  it('numa queda constante: preço abaixo das médias e no fundo da faixa', () => {
    const t = calcularTendencia(rampa(260, 20, 10), datas(260))
    assert.equal(t.fechamento, 10)
    assert.ok(t.sma21 > 10)
    assert.ok(t.retorno63 < 0)
    assert.equal(t.posicao52, 0)
  })

  it('volatilidade realizada: zero num preço parado e bem maior num que oscila', () => {
    assert.equal(calcularTendencia(Array(100).fill(10), datas(100)).volRealizada21, 0)
    const serrilha = Array.from({ length: 100 }, (_, i) => (i % 2 ? 10 : 11))
    assert.ok(calcularTendencia(serrilha, datas(100)).volRealizada21 > 100)
  })

  it('junta ações e ETFs, ignora dia sem negócio e histórico curto ou ausente', () => {
    const com = rampa(100, 10, 12)
    com[50] = null
    const mapa = tendenciasDosHistoricos([
      { pregoes: datas(100), ativos: { petr4: com.map((v) => (v === null ? null : [v, v, v, 1])), CURTO3: rampa(30, 1, 2).map((v) => [v, v, v, 1]) } },
      null,
      { pregoes: datas(100), ativos: { BOVA11: rampa(100, 100, 120).map((v) => [v, v, v, 1]) } },
    ])
    assert.deepEqual([...mapa.keys()].sort(), ['BOVA11', 'PETR4'])
    assert.equal(mapa.get('PETR4').fechamento, 12)
  })
})
