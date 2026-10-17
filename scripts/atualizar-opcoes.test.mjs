// Testes do parser do COTAHIST e do snapshot do Simule Opções (node --test).
// As linhas imitam o layout real conferido no pregão de 16/10/2026 (245 caracteres, largura fixa).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CONFIG, URL_COTAHIST, lerCotahist, lerLinha, montarSnapshot, motivoInvalido } from './atualizar-opcoes.mjs'

const campo = (valor, tamanho, direita = false) => (direita ? String(valor).padStart(tamanho, '0') : String(valor).padEnd(tamanho, ' '))
const centavos = (reais) => campo(Math.round(reais * 100), 13, true)

/** Monta uma linha de 245 caracteres com só os campos que o parser lê; o resto fica em branco. */
function linha({ bdi, codigo, mercado, nome = 'PETROBRAS', ultimo, negocios = 5, volume = 10_000, strike = 0, venc = '99991231', isin = 'BRPETRACNOR9', data = '20261016' }) {
  // Posições reais (base 1): PREULT 109-121, TOTNEG 148-152, VOLTOT 171-188, PREEXE 189-201, DATVEN 203-210, CODISI 231-242.
  const buf = new Array(245).fill(' ')
  const poe = (ini, texto) => { for (let i = 0; i < texto.length; i++) buf[ini - 1 + i] = texto[i] }
  poe(1, '01'); poe(3, data); poe(11, bdi); poe(13, campo(codigo, 12)); poe(25, mercado); poe(28, campo(nome, 12))
  poe(109, centavos(ultimo)); poe(148, campo(negocios, 5, true)); poe(171, campo(Math.round(volume * 100), 18, true))
  poe(189, centavos(strike)); poe(202, '0'); poe(203, venc); poe(231, campo(isin, 12))
  return buf.join('')
}

const petr3 = linha({ bdi: '02', codigo: 'PETR3', mercado: '010', ultimo: 60, volume: 5_000_000 })
const petr3f = linha({ bdi: '96', codigo: 'PETR3F', mercado: '020', ultimo: 60, volume: 100 }) // fracionário: ignorado
const callA = linha({ bdi: '78', codigo: 'PETRK600', mercado: '070', ultimo: 2.8, strike: 60, venc: '20261120', negocios: 30, volume: 300_000 })
const callB = linha({ bdi: '78', codigo: 'PETRK900', mercado: '070', ultimo: 0.05, strike: 90, venc: '20261120', negocios: 30 }) // strike longe
const callC = linha({ bdi: '78', codigo: 'PETRK610', mercado: '070', ultimo: 2.4, strike: 61, venc: '20261120', negocios: 1 }) // pouco negócio
const callD = linha({ bdi: '78', codigo: 'PETRJ600', mercado: '070', ultimo: 2.9, strike: 60, venc: '20261016', negocios: 40 }) // vence no pregão
const putA = linha({ bdi: '82', codigo: 'PETRW600', mercado: '080', ultimo: 2.2, strike: 60, venc: '20261120', negocios: 20, volume: 200_000 })
const semIsin = linha({ bdi: '78', codigo: 'XXXXK100', mercado: '070', ultimo: 1, strike: 10, venc: '20261120', isin: 'BRXXXXACNOR1' })
const arquivo = ['00COTAHIST.2026BOVESPA 20261016', petr3, petr3f, callA, callB, callC, callD, putA, semIsin, '99COTAHIST.2026BOVESPA 20261016'].join('\n')

describe('lerLinha', () => {
  it('lê papel à vista, call e put; ignora fracionário, cabeçalho e rodapé', () => {
    assert.equal(lerLinha(petr3).tipo, 'vista')
    assert.equal(lerLinha(petr3f), null)
    assert.equal(lerLinha('00COTAHIST.2026BOVESPA 20261016'), null)
    const c = lerLinha(callA)
    assert.deepEqual(
      { tipo: c.tipo, codigo: c.codigo, strike: c.strike, vencimento: c.vencimento, ultimo: c.ultimo, negocios: c.negocios, volume: c.volume, isin: c.isin },
      { tipo: 'call', codigo: 'PETRK600', strike: 60, vencimento: '2026-11-20', ultimo: 2.8, negocios: 30, volume: 300_000, isin: 'BRPETRACNOR9' },
    )
    assert.equal(lerLinha(putA).tipo, 'put')
  })
})

describe('montarSnapshot', () => {
  const lido = lerCotahist(arquivo)

  it('liga a opção ao ativo pelo ISIN e guarda só séries com negócio, na faixa e que não vencem no pregão', () => {
    const s = montarSnapshot(lido, CONFIG, new Date('2026-10-17T12:00:00Z'))
    assert.equal(s.dataPregao, '2026-10-16')
    assert.equal(s.ativos.length, 1)
    const a = s.ativos[0]
    assert.equal(a.ticker, 'PETR3')
    assert.equal(a.cotacao, 60)
    assert.deepEqual(a.series.map((x) => x.codigo), ['PETRK600', 'PETRW600'])
    assert.deepEqual(a.series[0], { codigo: 'PETRK600', tipo: 'call', strike: 60, vencimento: '2026-11-20', premio: 2.8, negocios: 30, volume: 300_000 })
  })

  it('URL do COTAHIST usa o formato DDMMAAAA', () => {
    assert.equal(URL_COTAHIST('2026-10-16'), 'https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D16102026.ZIP')
  })
})

describe('motivoInvalido', () => {
  const ativo = (ticker) => ({ ticker, nome: ticker, cotacao: 10, volumeOpcoes: 1, series: [{ codigo: 'X', tipo: 'call', strike: 10, vencimento: '2026-11-20', premio: 1, negocios: 5, volume: 1 }] })
  const minimo = { ...CONFIG, minimoAtivosParaPublicar: 2, controle: ['A', 'B'], minimoControle: 1 }

  it('recusa sem data, poucos ativos e ativos de controle ausentes', () => {
    assert.match(motivoInvalido({ dataPregao: null, ativos: [] }, minimo), /data de pregão/)
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('A')] }, minimo), /Só 1 ativos/)
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('C'), ativo('D')] }, minimo), /controle/)
  })

  it('recusa série com prêmio zerado e aceita um snapshot bom', () => {
    const ruim = ativo('A')
    ruim.series[0].premio = 0
    assert.match(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ruim, ativo('B')] }, minimo), /Série inválida/)
    assert.equal(motivoInvalido({ dataPregao: '2026-10-16', ativos: [ativo('A'), ativo('B')] }, minimo), null)
  })
})
