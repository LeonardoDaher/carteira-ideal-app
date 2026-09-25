// Testes do job semanal de dados oficiais (node --test). O CSV abaixo imita o arquivo
// "PrecoTaxaTesouroDireto.csv" do Tesouro Transparente: ";" como separador, vírgula decimal,
// datas dd/mm/aaaa e o histórico de várias datas-base no mesmo arquivo.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  citadosForaDeVenda,
  classificarTitulo,
  consolidarHistorico,
  janelasDeConsulta,
  lerFocus,
  lerHistoricoSgs,
  validarFocus,
  validarHistorico,
  dataBrParaIso,
  decodificarTexto,
  diasDesde,
  executar,
  formatarMercado,
  jurosReaisExPost,
  lerSerieSgs,
  montarTesouro,
  nomeDoTitulo,
  titulosCitados,
  validarIndicador,
  validarTesouro,
} from './atualizar-mercado-oficial.mjs'
import { lerCsv } from './atualizar-rendimentos-fii.mjs'

const CSV_TESOURO = `Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
Tesouro IPCA+;15/05/2035;18/09/2026;7,40;7,52;2100,10;2080,55;2080,00
Tesouro Selic;01/03/2029;21/09/2026;0,05;0,06;17500,20;17490,10;17489,00
Tesouro Selic;01/03/2031;21/09/2026;0,09;0,10;17380,00;17370,00;17369,00
Tesouro Prefixado;01/01/2029;21/09/2026;13,90;14,02;730,50;728,90;728,50
Tesouro Prefixado;01/01/2032;21/09/2026;14,10;14,22;460,30;458,10;458,00
Tesouro Prefixado com Juros Semestrais;01/01/2035;21/09/2026;14,20;14,32;905,00;899,00;898,50
Tesouro IPCA+;15/05/2029;21/09/2026;7,90;8,02;3200,00;3190,00;3189,00
Tesouro IPCA+;15/05/2035;21/09/2026;7,45;7,57;2090,00;2070,00;2069,00
Tesouro IPCA+;15/05/2045;21/09/2026;7,05;7,17;980,00;970,00;969,00
Tesouro IPCA+ com Juros Semestrais;15/08/2040;21/09/2026;7,10;7,22;4300,00;4280,00;4279,00
Tesouro IPCA+;15/08/2026;21/09/2026;0,00;6,50;0,00;4500,00;4499,00
Tesouro Educa+;15/12/2030;21/09/2026;7,30;7,42;3100,00;3090,00;3089,00
Tesouro Renda+ Aposentadoria Extra;15/12/2084;21/09/2026;6,90;7,02;1500,00;1490,00;1489,00
Tesouro IPCA+;15/05/2050;21/09/2026;74,00;74,12;10,00;9,00;9,00
Tesouro IGPM+ com Juros Semestrais;01/01/2031;21/09/2026;0,00;7,00;0,00;6000,00;5999,00
Tesouro Novo Indexador;01/01/2040;21/09/2026;5,00;5,10;1000,00;990,00;989,00
`

const FAIXAS = { selic: [-0.5, 1.5], prefixado: [2, 30], ipca: [0, 15], igpm: [0, 15] }
const HOJE = new Date('2026-09-25T12:00:00Z')

describe('datas', () => {
  it('converte dd/mm/aaaa para ISO e rejeita formato inválido', () => {
    assert.equal(dataBrParaIso('21/09/2026'), '2026-09-21')
    assert.equal(dataBrParaIso('2026-09-21'), null)
    assert.equal(dataBrParaIso(''), null)
  })
  it('conta dias corridos até hoje', () => {
    assert.equal(diasDesde('2026-09-21', HOJE), 4)
    assert.equal(diasDesde('2026-09-25', HOJE), 0)
  })
})

describe('decodificarTexto', () => {
  it('lê UTF-8 e remove o BOM', () => {
    assert.equal(decodificarTexto(new TextEncoder().encode('\uFEFFTítulo')), 'Título')
  })
  it('cai para latin1 quando o UTF-8 é inválido', () => {
    assert.equal(decodificarTexto(Uint8Array.from([0x54, 0xed, 0x74])), 'Tít')
  })
})

describe('lerSerieSgs', () => {
  it('devolve o último valor e o anterior, em ordem de data', () => {
    const r = lerSerieSgs([{ data: '24/09/2026', valor: '5.3120' }, { data: '23/09/2026', valor: '5.3000' }])
    assert.deepEqual(r, { data: '2026-09-24', valor: 5.312, dataAnterior: '2026-09-23', valorAnterior: 5.3 })
  })
  it('falha com lista vazia ou formato inesperado', () => {
    assert.throws(() => lerSerieSgs([], 'X'), /não devolveu dados/)
    assert.throws(() => lerSerieSgs({ erro: 'html' }, 'X'), /não devolveu dados/)
    assert.throws(() => lerSerieSgs([{ data: '2026-09-24', valor: '1' }], 'X'), /formato inesperado/)
  })
})

describe('validarIndicador', () => {
  const ind = { nome: 'Selic meta', codigoSgs: 432, faixa: [2, 30], maxDiasAtraso: 10 }
  it('aceita valor plausível e recente', () => {
    assert.deepEqual(validarIndicador(ind, { data: '2026-09-24', valor: 15 }, HOJE), [])
  })
  it('acusa valor fora da faixa (ex.: código de série trocado)', () => {
    assert.match(validarIndicador(ind, { data: '2026-09-24', valor: 5312 }, HOJE)[0], /fora da faixa/)
  })
  it('acusa dado velho', () => {
    assert.match(validarIndicador(ind, { data: '2026-08-01', valor: 15 }, HOJE)[0], /dias atrás/)
  })
})

describe('classificarTitulo e nomeDoTitulo', () => {
  it('reconhece indexador, tipo de taxa e cupom', () => {
    assert.equal(classificarTitulo('Tesouro Selic').tipoTaxa, 'agioSobreSelic')
    assert.equal(classificarTitulo('Tesouro Prefixado com Juros Semestrais').cupom, 'semestral')
    assert.equal(classificarTitulo('Tesouro IPCA+').cupom, 'sem cupom')
    assert.equal(classificarTitulo('Tesouro Renda+ Aposentadoria Extra').familia, 'Tesouro Renda+')
    assert.equal(classificarTitulo('Tesouro Educa+').indexador, 'ipca')
    assert.equal(classificarTitulo('Tesouro IGPM+ com Juros Semestrais').indexador, 'igpm')
    assert.equal(classificarTitulo('Tesouro Novo Indexador'), null)
  })
  it('usa o ano do vencimento no nome, exceto Renda+ e Educa+', () => {
    assert.equal(nomeDoTitulo('Tesouro IPCA+', '2035-05-15', classificarTitulo('Tesouro IPCA+')), 'Tesouro IPCA+ 2035')
    assert.equal(nomeDoTitulo('Tesouro Educa+', '2030-12-15', classificarTitulo('Tesouro Educa+')), 'Tesouro Educa+ (vencimento 2030)')
  })
})

describe('montarTesouro', () => {
  const r = montarTesouro(lerCsv(CSV_TESOURO), FAIXAS)
  const porNome = Object.fromEntries(r.titulos.map((t) => [t.nome, t]))

  it('usa só a data-base mais recente', () => {
    assert.equal(r.dataBase, '2026-09-21')
    assert.equal(porNome['Tesouro IPCA+ 2035'].taxaCompra, 7.45) // não o 7,40 de 18/09
  })
  it('marca como "só resgate" o título com PU de compra zero', () => {
    assert.equal(porNome['Tesouro IPCA+ 2026'].aVenda, false)
    assert.equal(porNome['Tesouro IPCA+ 2026'].taxaCompra, null)
    assert.equal(porNome['Tesouro IPCA+ 2026'].puVenda, 4500)
  })
  it('descarta título à venda com taxa implausível e ignora tipo desconhecido', () => {
    assert.equal(porNome['Tesouro IPCA+ 2050'], undefined)
    assert.match(r.descartados[0].motivo, /fora da faixa/)
    assert.deepEqual(r.tiposDesconhecidos, ['Tesouro Novo Indexador'])
  })
  it('lê números com vírgula decimal', () => {
    assert.equal(porNome['Tesouro Selic 2029'].puCompra, 17500.2)
    assert.equal(porNome['Tesouro Selic 2029'].taxaCompra, 0.05)
  })
  it('falha se faltar coluna obrigatória', () => {
    assert.throws(() => montarTesouro(lerCsv('Titulo;Data\nX;01/01/2030\n'), FAIXAS), /Coluna não encontrada/)
  })
})

describe('validarTesouro', () => {
  const t = montarTesouro(lerCsv(CSV_TESOURO), FAIXAS)
  it('passa com dados recentes e os três indexadores à venda', () => {
    assert.deepEqual(validarTesouro(t, { maxDiasAtraso: 7, minimoTitulosAVenda: 5 }, HOJE), [])
  })
  it('trava com data-base velha, poucos títulos ou indexador faltando', () => {
    const p = validarTesouro(
      { dataBase: '2026-09-01', titulos: t.titulos.filter((x) => x.indexador !== 'prefixado') },
      { maxDiasAtraso: 7, minimoTitulosAVenda: 50 },
      HOJE,
    )
    assert.equal(p.length, 3)
  })
})

describe('jurosReaisExPost', () => {
  it('aplica Fisher e arredonda em 2 casas', () => {
    assert.equal(jurosReaisExPost(15, 5), 9.52)
    assert.equal(jurosReaisExPost(null, 5), null)
  })
})

describe('conferência do conteúdo educacional', () => {
  const texto = "'Tesouro IPCA+ 2045, Tesouro IPCA+ 2048 e Tesouro Prefixado 2033' e 'Tesouro Prefixado com Juros Semestrais 2035'"
  it('extrai os títulos citados', () => {
    assert.deepEqual(titulosCitados(texto), [
      'Tesouro IPCA+ 2045',
      'Tesouro IPCA+ 2048',
      'Tesouro Prefixado 2033',
      'Tesouro Prefixado com Juros Semestrais 2035',
    ])
  })
  it('aponta os que não estão à venda', () => {
    const { titulos } = montarTesouro(lerCsv(CSV_TESOURO), FAIXAS)
    assert.deepEqual(citadosForaDeVenda(titulosCitados(texto), titulos), ['Tesouro IPCA+ 2048', 'Tesouro Prefixado 2033'])
  })
})

describe('histórico', () => {
  it('divide o período em janelas contíguas de até 10 anos, terminando hoje', () => {
    const j = janelasDeConsulta('1999-03-05', HOJE, 9)
    assert.deepEqual(j[0], { inicio: '05/03/1999', fim: '04/03/2008' })
    assert.deepEqual(j[1].inicio, '05/03/2008')
    assert.equal(j.at(-1).fim, '25/09/2026')
    assert.equal(j.length, 4)
    for (let i = 1; i < j.length; i++) assert.notEqual(j[i].inicio, j[i - 1].fim)
  })

  it('lê a resposta por período e ordena', () => {
    assert.deepEqual(lerHistoricoSgs([{ data: '02/01/2020', valor: '4.5' }, { data: '01/01/2020', valor: '4.5' }]), [
      ['2020-01-01', 4.5],
      ['2020-01-02', 4.5],
    ])
    assert.throws(() => lerHistoricoSgs([{ data: 'x', valor: '1' }]), /ponto inválido/)
  })

  it('comprime a série em degrau: primeiro ponto, mudanças e último dia', () => {
    const diarios = [
      ['2025-01-01', 12], ['2025-01-02', 12], ['2025-01-30', 13.25],
      ['2025-01-31', 13.25], ['2025-03-20', 14.25], ['2025-09-24', 14.25],
    ]
    assert.deepEqual(consolidarHistorico(diarios, true), [
      ['2025-01-01', 12], ['2025-01-30', 13.25], ['2025-03-20', 14.25], ['2025-09-24', 14.25],
    ])
  })

  it('remove a data repetida na borda entre duas janelas e não comprime série mensal', () => {
    const r = consolidarHistorico([['2020-01-01', 4], ['2020-02-01', 4], ['2020-01-01', 4]], false)
    assert.deepEqual(r, [['2020-01-01', 4], ['2020-02-01', 4]])
  })

  it('trava com poucos pontos, valor fora da faixa ou último ponto diferente do atual', () => {
    const serie = { nome: 'Selic meta', minimoPontos: 3, faixa: [1, 50] }
    const pontos = [['2025-01-01', 12], ['2025-09-24', 90]]
    const p = validarHistorico(serie, pontos, { data: '2025-09-24', valor: 15 })
    assert.equal(p.length, 3)
    assert.deepEqual(validarHistorico({ ...serie, minimoPontos: 1 }, [['2025-09-24', 15]], { data: '2025-09-24', valor: 15 }), [])
  })
})

describe('Boletim Focus', () => {
  const corpo = {
    value: [
      { Indicador: 'IPCA', Data: '2026-09-19', DataReferencia: '2026', Mediana: 4.8, baseCalculo: 0 },
      { Indicador: 'IPCA', Data: '2026-09-19', DataReferencia: '2027', Mediana: 4.0, baseCalculo: 0 },
      { Indicador: 'IPCA', Data: '2026-09-19', DataReferencia: '2028', Mediana: 3.6, baseCalculo: 0 },
      { Indicador: 'IPCA', Data: '2026-09-19', DataReferencia: '2029', Mediana: 3.5, baseCalculo: 0 },
      { Indicador: 'IPCA', Data: '2026-09-12', DataReferencia: '2026', Mediana: 4.9, baseCalculo: 0 },
      { Indicador: 'IPCA', Data: '2026-09-19', DataReferencia: '2025', Mediana: 4.4, baseCalculo: 0 },
    ],
  }
  it('fica só com a coleta mais recente e anos a partir do corrente', () => {
    assert.deepEqual(lerFocus(corpo, 2026), { data: '2026-09-19', porAno: { 2026: 4.8, 2027: 4.0, 2028: 3.6, 2029: 3.5 } })
  })
  it('falha com resposta vazia', () => {
    assert.throws(() => lerFocus({ value: [] }, 2026), /sem dados/)
    assert.throws(() => lerFocus('<html>', 2026), /sem dados/)
  })
  it('trava coleta velha, ano faltando ou valor fora da faixa', () => {
    const ind = { nomeFocus: 'IPCA', faixa: [-2, 20] }
    const cfg = { maxDiasAtraso: 14, minimoAnos: 3 }
    assert.deepEqual(validarFocus(ind, lerFocus(corpo, 2026), cfg, HOJE), [])
    const p = validarFocus(ind, { data: '2026-08-01', porAno: { 2026: 45 } }, cfg, HOJE)
    assert.equal(p.length, 4) // velho + 2027 e 2028 faltando + 45 fora da faixa
  })
})

describe('formatarMercado', () => {
  it('gera JSON válido com um título por linha', () => {
    const { titulos } = montarTesouro(lerCsv(CSV_TESOURO), FAIXAS)
    const historico = { selicMeta: { nome: 'Selic meta', unidade: '% a.a.', degrau: true, pontos: [['2025-01-01', 12], ['2025-09-24', 15]] } }
    const snap = { geradoEm: 'x', indicadores: { a: { valor: 1 } }, historico, tesouro: { dataBase: '2026-09-21', titulos } }
    const texto = formatarMercado(snap)
    assert.deepEqual(JSON.parse(texto), snap)
    assert.equal(texto.split('\n').filter((l) => l.includes('"vencimento"')).length, titulos.length)
  })
})

// ---------------------------------------------------------------------------------------
// Ponta a ponta com fetch falso: confirma que o arquivo só é gravado quando tudo passa.
// ---------------------------------------------------------------------------------------

function montarRaiz() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mercado-'))
  fs.mkdirSync(path.join(raiz, 'config'))
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data', 'analises'), { recursive: true })
  const config = JSON.parse(fs.readFileSync(new URL('../config/mercado-oficial.json', import.meta.url), 'utf8'))
  fs.writeFileSync(path.join(raiz, 'config', 'mercado-oficial.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'analises', 'tesouroIPCA.ts'), "'Tesouro IPCA+ 2048'")
  const saida = path.join(raiz, 'webapp-src', 'src', 'data', 'mercadoOficial.json')
  fs.writeFileSync(saida, 'ANTERIOR')
  return { raiz, saida, config }
}

const VALORES_SGS = { 432: '15.00', 4389: '14.90', 433: '0.40', 13522: '5.10', 1: '5.3120' }

/** Histórico sintético mensal dentro da janela pedida, terminando no valor "atual". */
function historicoFalso(codigo, inicioBr, fimBr) {
  const ini = dataBrParaIso(inicioBr)
  const fim = dataBrParaIso(fimBr)
  const pontos = []
  const ehSelic = codigo === '432'
  const ultimaData = ehSelic ? '2026-09-24' : '2026-08-01'
  for (let a = 1999; a <= 2026; a++) {
    for (let m = 1; m <= 12; m++) {
      const iso = `${a}-${String(m).padStart(2, '0')}-${ehSelic ? '15' : '01'}`
      if (iso < ini || iso > fim || iso > ultimaData) continue
      const valor = ehSelic ? 10 + ((a * 12 + m) % 7) : 3 + ((a * 12 + m) % 5)
      pontos.push({ data: dataIsoParaBrTeste(iso), valor: String(valor) })
    }
  }
  if (ultimaData >= ini && ultimaData <= fim) {
    const final = { data: dataIsoParaBrTeste(ultimaData), valor: ehSelic ? '15.00' : '5.10' }
    if (!pontos.some((p) => p.data === final.data)) pontos.push(final)
    else pontos[pontos.findIndex((p) => p.data === final.data)] = final
  }
  return pontos
}

const dataIsoParaBrTeste = (iso) => iso.split('-').reverse().join('/')

function fetchFalso({ sgs = VALORES_SGS, csv = CSV_TESOURO, falhasSgs = 0 } = {}) {
  let falhas = falhasSgs
  return async (url) => {
    const focus = /ExpectativasMercadoAnuais.*Indicador%20eq%20'(\w+)'/.exec(url)
    if (focus) {
      const valores = focus[1] === 'IPCA' ? [4.8, 4.0, 3.6, 3.5, 3.5] : [14.75, 12.5, 10.5, 10, 10]
      const value = valores.map((Mediana, i) => ({ Indicador: focus[1], Data: '2026-09-19', DataReferencia: String(2026 + i), Mediana, baseCalculo: 0 }))
      return { ok: true, status: 200, json: async () => ({ value }) }
    }
    const periodo = /bcdata\.sgs\.(\d+)\/dados\?formato=json&dataInicial=([\d/]+)&dataFinal=([\d/]+)/.exec(url)
    if (periodo) {
      return { ok: true, status: 200, json: async () => historicoFalso(periodo[1], periodo[2], periodo[3]) }
    }
    const m = /bcdata\.sgs\.(\d+)\//.exec(url)
    if (m) {
      if (falhas-- > 0) return { ok: false, status: 503 }
      const mensal = ['433', '13522'].includes(m[1])
      const datas = mensal ? ['01/07/2026', '01/08/2026'] : ['23/09/2026', '24/09/2026']
      return { ok: true, status: 200, json: async () => datas.map((data) => ({ data, valor: sgs[m[1]] })) }
    }
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(csv).buffer }
  }
}

describe('executar (ponta a ponta)', () => {
  it('grava o arquivo quando tudo passa, inclusive após uma falha temporária do SGS', async () => {
    const { raiz, saida } = montarRaiz()
    const snap = await executar({ buscar: fetchFalso({ falhasSgs: 1 }), hoje: HOJE, raiz, pausaBaseMs: 0 })
    const gravado = JSON.parse(fs.readFileSync(saida, 'utf8'))
    assert.equal(gravado.indicadores.selicMeta.valor, 15)
    assert.equal(gravado.derivados.jurosReaisExPost.valor, jurosReaisExPost(15, 5.1))
    assert.equal(gravado.tesouro.dataBase, '2026-09-21')
    assert.equal(snap.tesouro.titulos.length, gravado.tesouro.titulos.length)
    const selic = gravado.historico.selicMeta.pontos
    assert.deepEqual(selic.at(-1), ['2026-09-24', 15])
    assert.equal(selic[0][0], '1999-03-15')
    assert.ok(gravado.historico.ipca12m.pontos.length > 200)
    assert.deepEqual(gravado.focus, {
      data: '2026-09-19',
      ipca: { 2026: 4.8, 2027: 4, 2028: 3.6, 2029: 3.5, 2030: 3.5 },
      selic: { 2026: 14.75, 2027: 12.5, 2028: 10.5, 2029: 10, 2030: 10 },
    })
  })

  it('NÃO grava se o histórico não terminar no valor atual', async () => {
    const { raiz, saida } = montarRaiz()
    // Indicador atual diz 5.20; o histórico termina em 5.10
    const buscar = fetchFalso({ sgs: { ...VALORES_SGS, 13522: '5.20' } })
    await assert.rejects(executar({ buscar, hoje: HOJE, raiz, pausaBaseMs: 0 }), /NÃO atualizado/)
    assert.equal(fs.readFileSync(saida, 'utf8'), 'ANTERIOR')
  })

  it('NÃO grava se um indicador vier fora da faixa', async () => {
    const { raiz, saida } = montarRaiz()
    const buscar = fetchFalso({ sgs: { ...VALORES_SGS, 432: '1500' } })
    await assert.rejects(executar({ buscar, hoje: HOJE, raiz, pausaBaseMs: 0 }), /NÃO atualizado/)
    assert.equal(fs.readFileSync(saida, 'utf8'), 'ANTERIOR')
  })

  it('NÃO grava se o arquivo do Tesouro estiver defasado', async () => {
    const { raiz, saida } = montarRaiz()
    await assert.rejects(executar({ buscar: fetchFalso(), hoje: new Date('2026-10-15T12:00:00Z'), raiz, pausaBaseMs: 0 }), /NÃO atualizado/)
    assert.equal(fs.readFileSync(saida, 'utf8'), 'ANTERIOR')
  })

  it('NÃO grava se o SGS falhar em todas as tentativas', async () => {
    const { raiz, saida } = montarRaiz()
    await assert.rejects(executar({ buscar: fetchFalso({ falhasSgs: 99 }), hoje: HOJE, raiz, pausaBaseMs: 0 }), /falhou após 3 tentativas/)
    assert.equal(fs.readFileSync(saida, 'utf8'), 'ANTERIOR')
  })
})
