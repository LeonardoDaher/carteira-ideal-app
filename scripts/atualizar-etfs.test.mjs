// Testes do leitor do Boletim de Preços da B3 e do job diário de ETFs (node --test).
// Os blocos XML e os números imitam o boletim real de 25/09/2026 (BVBG.086.01, última
// versão do dia) e a listagem v2 da brapi conferida em 27/09/2026.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { codigoBoletim, datasCandidatas, escolherUltimaVersao, extrairPricRpt, lerBoletim } from './b3-boletim.mjs'
import {
  datasAProcessar,
  formatarHistorico,
  historicoVazio,
  incorporarPregao,
  limparNome,
  metricas,
  montarBusca,
  montarItem,
  montarUniverso,
  motivoInvalido,
  precisaRevisar,
  selecionar,
} from './atualizar-etfs.mjs'

const bloco = (ticker, { data = '2026-09-25', ult, min, max, vol, qtd } = {}) =>
  [
    '          <PricRpt>',
    '            <TradDt>',
    `              <Dt>${data}</Dt>`,
    '            </TradDt>',
    '            <SctyId>',
    `              <TckrSymb>${ticker}</TckrSymb>`,
    '            </SctyId>',
    '            <FinInstrmAttrbts>',
    vol !== undefined ? `              <NtlFinVol Ccy="BRL">${vol}</NtlFinVol>` : '',
    qtd !== undefined ? `              <FinInstrmQty>${qtd}</FinInstrmQty>` : '',
    min !== undefined ? `              <MinPric Ccy="BRL">${min}</MinPric>` : '',
    max !== undefined ? `              <MaxPric Ccy="BRL">${max}</MaxPric>` : '',
    ult !== undefined ? `              <LastPric Ccy="BRL">${ult}</LastPric>` : '',
    '            </FinInstrmAttrbts>',
    '          </PricRpt>',
  ]
    .filter(Boolean)
    .join('\r\n')

const CONFIG = {
  excluir: { tickers: ['FNAM11', 'CDII11'] },
  revisados: { tickers: [] },
  palavrasRevisar: { palavras: ['INFRA', 'INCENTIVAD', 'FINAM'] },
  categorias: { BOVA11: 'Bolsa brasileira', IVVB11: 'Bolsa exterior', SPXH11: 'Bolsa exterior', LFTS11: 'Renda fixa' },
  indices: { BOVA11: 'Ibovespa', IVVB11: 'S&P 500' },
  cambio: { IVVB11: true },
  nomes: { IMBB11: 'ETF Bradesco IMA-B' },
}

const serieDePregoes = (n, inicio = '2025-01-01') => {
  const datas = []
  const d = new Date(`${inicio}T00:00:00Z`)
  while (datas.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) datas.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return datas
}

describe('b3-boletim: funções puras', () => {
  it('monta o código do arquivo pela data', () => {
    assert.equal(codigoBoletim('2026-09-25'), 'PR260925')
    assert.equal(codigoBoletim('2027-01-04'), 'PR270104')
  })

  it('extrai fechamento, faixa e volume em reais de um bloco real (LFTS11)', () => {
    const item = extrairPricRpt(bloco('LFTS11', { ult: '160.46', min: '160.38', max: '160.54', vol: '18121778.9', qtd: '112965' }))
    assert.deepEqual(item, { ticker: 'LFTS11', data: '2026-09-25', fechamento: 160.46, minima: 160.38, maxima: 160.54, volume: 18121778.9, quantidade: 112965 })
  })

  it('instrumento sem negócio vem sem preço e sem volume', () => {
    const item = extrairPricRpt(bloco('XXXX11'))
    assert.equal(item.fechamento, null)
    assert.equal(item.volume, null)
  })

  it('bloco sem código ou sem data é ignorado', () => {
    assert.equal(extrairPricRpt('<PricRpt><TradDt><Dt>2026-09-25</Dt></TradDt></PricRpt>'), null)
    assert.equal(extrairPricRpt('<PricRpt><TckrSymb>BOVA11</TckrSymb></PricRpt>'), null)
  })

  it('escolhe a última versão do dia pelo nome (crescente)', () => {
    const nomes = [
      'BVBG.086.01_BV000328202609250328000001904515920.xml',
      'BVBG.086.01_BV000328202609250328000002031233494.xml',
      'BVBG.086.01_BV000328202609250328000001837534655.xml',
      'LEIAME.txt',
    ]
    assert.equal(escolherUltimaVersao(nomes), 'BVBG.086.01_BV000328202609250328000002031233494.xml')
    assert.equal(escolherUltimaVersao(['outro.xml']), null)
  })

  it('datas candidatas pulam fim de semana e, antes das 21h, o dia de hoje', () => {
    // sexta, 25/09/2026, 20h de Brasília (23h UTC): o boletim de hoje ainda pode mudar
    assert.deepEqual(datasCandidatas(new Date('2026-09-25T23:00:00Z'), 3, '21:00'), ['2026-09-24', '2026-09-23', '2026-09-22'])
    // sexta, 22h de Brasília: hoje entra
    assert.deepEqual(datasCandidatas(new Date('2026-09-26T01:00:00Z'), 2, '21:00'), ['2026-09-25', '2026-09-24'])
    // domingo: começa na sexta
    assert.deepEqual(datasCandidatas(new Date('2026-09-27T15:00:00Z'), 2, '21:00'), ['2026-09-25', '2026-09-24'])
  })
})

describe('b3-boletim: leitura em fluxo', () => {
  it('lê só os códigos aceitos e informa a data do pregão', async () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'boletim-teste-'))
    const arquivo = path.join(pasta, 'BVBG.086.01_teste.xml')
    const xml = [
      '\uFEFF<?xml version="1.0" encoding="utf-8"?>',
      '<Document><BizGrp>',
      bloco('BOVA11', { ult: '180.82', min: '179.27', max: '181.44', vol: '782311451.47', qtd: '4333605' }),
      bloco('PETR4', { ult: '30', min: '29', max: '31', vol: '1000' }),
      bloco('LFTS11', { ult: '160.46', min: '160.38', max: '160.54', vol: '18121778.9' }),
      '</BizGrp></Document>',
    ].join('\r\n')
    fs.writeFileSync(arquivo, xml)
    try {
      const lido = await lerBoletim(arquivo, (t) => /11$/.test(t))
      assert.equal(lido.blocos, 3)
      assert.deepEqual([...lido.instrumentos.keys()], ['BOVA11', 'LFTS11'])
      assert.deepEqual(lido.datas, ['2026-09-25'])
      assert.equal(lido.instrumentos.get('BOVA11').volume, 782311451.47)
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true })
    }
  })
})

describe('atualizar-etfs: universo e nomes', () => {
  const LISTAGEM = [
    { symbol: 'FNAM11', longName: 'Fundo de Investimento da Amazonia Cotas', subType: 'etf', isActive: true },
    { symbol: 'BOVA11', longName: 'iShares Ibovespa Fundo de Indice', subType: 'etf', isActive: true },
    { symbol: 'CDII11', longName: 'Sparta Infra CDI FIC ... Infraestrutura RF', subType: 'etf', isActive: true },
    { symbol: 'NOVO11', longName: 'Gestora X Infra Debentures Incentivadas', subType: 'etf', isActive: true },
    { symbol: 'MXRF11', longName: 'Maxi Renda', subType: 'fii', isActive: true },
    { symbol: 'VELH11', longName: 'Fundo encerrado', subType: 'etf', isActive: false },
  ]

  it('tira excluídos, FIIs e inativos, e marca nome com palavra de alerta', () => {
    const { universo, revisar } = montarUniverso(LISTAGEM, CONFIG)
    assert.deepEqual([...universo.keys()], ['BOVA11', 'NOVO11'])
    assert.deepEqual(revisar, ['NOVO11'])
  })

  it('palavra de alerta não pede revisão para excluídos e revisados', () => {
    assert.equal(precisaRevisar('CDII11', 'Sparta Infra', CONFIG), false)
    assert.equal(precisaRevisar('NOVO11', 'Infra', { ...CONFIG, revisados: { tickers: ['NOVO11'] } }), false)
    assert.equal(precisaRevisar('NOVO11', 'Debêntures Incentivadas', CONFIG), true)
  })

  it('limpa o texto jurídico do nome oficial', () => {
    assert.equal(limparNome('iShares Ibovespa Fundo de Indice', 'BOVA11'), 'iShares Ibovespa')
    assert.equal(limparNome('Trend ETF S&P 500 Quanto Classe de Indice - Responsabilidade Limitada', 'SPXH11'), 'Trend ETF S&P 500 Quanto')
    assert.equal(limparNome('iShares S&P 500 Fundo de Investimento em Cotas de Fundo de Indice - Investimento no Exterior', 'IVVB11'), 'iShares S&P 500')
    assert.equal(limparNome('BB ETF Ibovespa Fun de Indice', 'BBOV11'), 'BB ETF Ibovespa')
    assert.equal(limparNome('Investo Teva Tesouro Selic ETF', 'LFTS11'), 'Investo Teva Tesouro Selic ETF')
  })

  it('nome manual vence; sem nome, fica o código', () => {
    assert.equal(limparNome('FII - Classe de Investimento ETF Bradesco IMA-B - RL', 'IMBB11', CONFIG.nomes), 'ETF Bradesco IMA-B')
    assert.equal(limparNome('', 'XXXX11'), 'XXXX11')
    assert.equal(limparNome('XXXX11', 'XXXX11'), 'XXXX11')
  })
})

describe('atualizar-etfs: histórico', () => {
  const universo = new Map([['BOVA11', 'iShares Ibovespa Fundo de Indice'], ['LFTS11', 'Investo Teva Tesouro Selic ETF']])
  const boletim = (itens) => new Map(itens.map((i) => [i.ticker, i]))

  it('inclui um pregão, com null para quem não negociou', () => {
    const h = incorporarPregao(historicoVazio(), '2026-09-25', boletim([{ ticker: 'BOVA11', fechamento: 180.82, minima: 179.27, maxima: 181.44, volume: 782311451.47 }]), universo)
    assert.deepEqual(h.pregoes, ['2026-09-25'])
    assert.deepEqual(h.ativos.BOVA11, [[180.82, 179.27, 181.44, 782311451.47]])
    assert.equal(h.ativos.LFTS11, undefined) // só null: não guarda
    assert.equal(h.nomes.LFTS11, 'Investo Teva Tesouro Selic ETF')
  })

  it('pregão fora de ordem entra no lugar certo, e repetir o mesmo dia não duplica', () => {
    let h = incorporarPregao(historicoVazio(), '2026-09-25', boletim([{ ticker: 'BOVA11', fechamento: 180, volume: 10 }]), universo)
    h = incorporarPregao(h, '2026-09-23', boletim([{ ticker: 'BOVA11', fechamento: 178, volume: 5 }, { ticker: 'LFTS11', fechamento: 160, volume: 3 }]), universo)
    h = incorporarPregao(h, '2026-09-25', boletim([{ ticker: 'BOVA11', fechamento: 181, volume: 11 }]), universo)
    assert.deepEqual(h.pregoes, ['2026-09-23', '2026-09-25'])
    assert.deepEqual(h.ativos.BOVA11.map((v) => v[0]), [178, 181])
    assert.deepEqual(h.ativos.LFTS11, [[160, 160, 160, 3], null])
  })

  it('guarda só os pregões mais recentes e descarta ETF que sumiu da janela', () => {
    let h = historicoVazio()
    const datas = serieDePregoes(5)
    datas.forEach((d, i) => {
      const itens = [{ ticker: 'BOVA11', fechamento: 100 + i, volume: 1 }]
      if (i === 0) itens.push({ ticker: 'LFTS11', fechamento: 150, volume: 1 })
      h = incorporarPregao(h, d, boletim(itens), universo, 3)
    })
    assert.deepEqual(h.pregoes, datas.slice(-3))
    assert.deepEqual(h.ativos.BOVA11.map((v) => v[0]), [102, 103, 104])
    assert.equal(h.ativos.LFTS11, undefined)
  })

  it('datas a processar: para no primeiro dia já guardado; na carga, pula os guardados', () => {
    const candidatas = ['2026-09-25', '2026-09-24', '2026-09-23', '2026-09-22']
    assert.deepEqual(datasAProcessar(candidatas, ['2026-09-23']), ['2026-09-24', '2026-09-25'])
    assert.deepEqual(datasAProcessar(candidatas, ['2026-09-25']), [])
    assert.deepEqual(datasAProcessar(candidatas, ['2026-09-24'], true), ['2026-09-22', '2026-09-23', '2026-09-25'])
  })

  it('o arquivo formatado volta idêntico ao ser lido', () => {
    const h = incorporarPregao(historicoVazio(), '2026-09-25', boletim([{ ticker: 'BOVA11', fechamento: 180.82, minima: 179.27, maxima: 181.44, volume: 782311451.47 }]), universo)
    const lido = JSON.parse(formatarHistorico(h))
    assert.deepEqual({ pregoes: lido.pregoes, nomes: lido.nomes, ativos: lido.ativos }, h)
  })
})

describe('atualizar-etfs: métricas', () => {
  const historicoCom = (n, gerar) => {
    const pregoes = serieDePregoes(n)
    return { pregoes, nomes: { BOVA11: 'iShares Ibovespa Fundo de Indice' }, ativos: { BOVA11: pregoes.map((_, i) => gerar(i)) } }
  }

  it('volume médio de 21 pregões conta dia sem negócio como zero', () => {
    const h = historicoCom(30, (i) => (i % 2 === 0 ? [10, 9, 11, 2_100_000] : null))
    const m = metricas(h, 'BOVA11')
    // últimos 21 pregões (índices 9 a 29): 10 dias com negócio (pares) = 21 mi / 21
    assert.equal(m.volumeMedio, 1_000_000)
    assert.equal(m.cotacao, 10)
    assert.equal(m.dataCotacao, h.pregoes[28]) // o 29 não negociou: vale o último negócio
  })

  it('com histórico curto, a média usa os pregões que existem e não há variação nem faixa', () => {
    const m = metricas(historicoCom(10, () => [10, 9, 11, 1000]), 'BOVA11')
    assert.equal(m.volumeMedio, 1000)
    assert.equal(m.variacao3m, null)
    assert.equal(m.minima52, null)
    assert.equal(m.maxima52, null)
  })

  it('variação de 3 meses compara com 63 pregões antes do fim', () => {
    const h = historicoCom(64, (i) => [i === 0 ? 100 : 120, 0, 0, 1])
    assert.equal(metricas(h, 'BOVA11').variacao3m, 20)
  })

  it('faixa de 52 semanas só com 240 pregões ou mais, pela mínima e máxima do dia', () => {
    const h = historicoCom(260, (i) => [50, i === 10 ? 1 : 40 + (i % 5), i === 200 ? 99 : 60, 1])
    const m = metricas(h, 'BOVA11')
    // janela de 252: índices 8 a 259 (o 10 e o 200 estão dentro)
    assert.equal(m.minima52, 1)
    assert.equal(m.maxima52, 99)
    assert.equal(metricas(historicoCom(239, () => [50, 40, 60, 1]), 'BOVA11').minima52, null)
  })

  it('ETF sem nenhum negócio no histórico não gera métricas', () => {
    assert.equal(metricas({ pregoes: ['2026-09-25'], nomes: {}, ativos: {} }, 'BOVA11'), null)
  })
})

describe('atualizar-etfs: itens, validação e seleção', () => {
  const pregoes = serieDePregoes(21)
  const historico = {
    pregoes,
    nomes: {
      BOVA11: 'iShares Ibovespa Fundo de Indice',
      IVVB11: 'iShares S&P 500 Fundo de Investimento em Cotas de Fundo de Indice - Investimento no Exterior',
      SPXH11: 'Trend ETF S&P 500 Quanto Classe de Indice - Responsabilidade Limitada',
      NOVO11: 'Novo ETF Fundo de Indice',
    },
    ativos: {
      BOVA11: pregoes.map(() => [180.82, 179, 182, 780_000_000]),
      IVVB11: pregoes.map(() => [453, 451, 455, 40_000_000]),
      SPXH11: pregoes.map(() => [59.65, 59, 60, 60_000_000]),
      NOVO11: pregoes.map(() => [10, 10, 10, 100_000]),
    },
  }

  it('usa categoria, índice e câmbio do config e aponta o que falta', () => {
    const ivvb = montarItem('IVVB11', historico, CONFIG)
    assert.deepEqual(
      { ...ivvb.item },
      { ticker: 'IVVB11', nome: 'iShares S&P 500', categoria: 'Bolsa exterior', indice: 'S&P 500', cambio: true, cotacao: 453, dataCotacao: pregoes[20], volumeMedio: 40_000_000, variacao3m: null, minima52: null, maxima52: null },
    )
    assert.deepEqual(ivvb.faltou, { categoria: false, indice: false, cambio: false })
    const spxh = montarItem('SPXH11', historico, CONFIG)
    assert.equal(spxh.item.cambio, null)
    assert.deepEqual(spxh.faltou, { categoria: false, indice: true, cambio: true })
    const novo = montarItem('NOVO11', historico, CONFIG)
    assert.equal(novo.item.categoria, 'Outros')
    assert.equal(novo.faltou.categoria, true)
    assert.equal(novo.faltou.cambio, false) // câmbio só se aplica à bolsa exterior
  })

  it('câmbio informado fora da bolsa exterior não aparece', () => {
    const config = { ...CONFIG, cambio: { BOVA11: true } }
    assert.equal(montarItem('BOVA11', historico, config).item.cambio, null)
  })

  it('recusa cotação e variação implausíveis', () => {
    assert.match(motivoInvalido({ cotacao: 0.05, variacao3m: 1 }), /cotação/)
    assert.match(motivoInvalido({ cotacao: 10, variacao3m: 900 }), /variação/)
    assert.equal(motivoInvalido({ cotacao: 10, variacao3m: null }), null)
  })

  it('seleciona os maiores volumes acima do piso, em ordem', () => {
    const itens = ['BOVA11', 'IVVB11', 'SPXH11', 'NOVO11'].map((t) => montarItem(t, historico, CONFIG).item)
    assert.deepEqual(selecionar(itens, 2, 500_000).map((i) => i.ticker), ['BOVA11', 'SPXH11'])
    assert.deepEqual(selecionar(itens, 40, 500_000).map((i) => i.ticker), ['BOVA11', 'SPXH11', 'IVVB11'])
  })

  it('busca tem todos, em ordem alfabética, só com os campos resumidos', () => {
    const itens = ['SPXH11', 'BOVA11'].map((t) => montarItem(t, historico, CONFIG).item)
    const busca = montarBusca(itens)
    assert.deepEqual(busca.map((b) => b.ticker), ['BOVA11', 'SPXH11'])
    assert.deepEqual(Object.keys(busca[0]), ['ticker', 'nome', 'categoria', 'cotacao', 'dataCotacao', 'volumeMedio'])
  })
})
