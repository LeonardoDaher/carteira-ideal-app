import assert from 'node:assert/strict'
import test from 'node:test'
import { prazoLegal, proximaDivulgacao, proximoPeriodo, rotuloDoTrimestre, trimestresDaEmpresa, verificarSanidadeBalancos } from './balancos-calculo.mjs'

const linha = (doc, dtRefer, dem, cd, valor, dtIni = null, dtFim = dtRefer, ds = '') => ({ doc, dtRefer, versao: 1, dem, cons: 'con', ordem: 'ULTIMO', dtIni, dtFim, cd, ds, valor })
const dre = (doc, dtRefer, ini, rec, lucro) => [linha(doc, dtRefer, 'DRE', '3.01', rec, ini), linha(doc, dtRefer, 'DRE', '3.05', rec / 2, ini), linha(doc, dtRefer, 'DRE', '3.11', lucro, ini)]
const bal = (doc, dtRefer) => [linha(doc, dtRefer, 'BPA', '1', 1000), linha(doc, dtRefer, 'BPP', '2.03', 400)]

test('rótulo, próximo período e prazo legal', () => {
  assert.equal(rotuloDoTrimestre('2026-06-30'), '2T26')
  assert.equal(proximoPeriodo('2026-09-30'), '2026-12-31')
  assert.equal(proximoPeriodo('2026-12-31'), '2027-03-31')
  assert.equal(prazoLegal('2026-09-30', 'ITR'), '2026-11-14')
  assert.equal(prazoLegal('2026-12-31', 'DFP'), '2027-03-31')
})

test('quarto trimestre = exercício menos os 9 meses', () => {
  const docs = [
    { doc: 'ITR', dtRefer: '2025-09-30', dtReceb: '2025-11-05' },
    { doc: 'DFP', dtRefer: '2025-12-31', dtReceb: '2026-03-10' },
  ]
  const linhas = [
    ...dre('ITR', '2025-09-30', '2025-07-01', 300, 30), ...dre('ITR', '2025-09-30', '2025-01-01', 900, 90), ...bal('ITR', '2025-09-30'),
    ...dre('DFP', '2025-12-31', '2025-01-01', 1300, 100), ...bal('DFP', '2025-12-31'),
  ]
  const t = trimestresDaEmpresa({ c: { docs, linhas }, dataCorte: '2026-10-30' })
  assert.deepEqual(t.map((x) => x.rotulo), ['3T25', '4T25'])
  assert.equal(t[0].receita, 0) // 300 em reais = 0,3 mil, arredondado
  const q4 = t[1]
  assert.equal(q4.tipo, 'DFP')
  assert.equal(q4.lucroLiquido, Math.round((100 - 90) / 1000))
})

test('próxima divulgação usa a mediana do mesmo trimestre e cai no prazo legal sem histórico', () => {
  const docs = [
    { doc: 'ITR', dtRefer: '2024-09-30', dtReceb: '2024-11-04' },
    { doc: 'ITR', dtRefer: '2025-09-30', dtReceb: '2025-11-06' },
    { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-06' },
  ]
  const p = proximaDivulgacao(docs, '2026-10-30')
  assert.equal(p.periodo, '2026-09-30')
  assert.equal(p.base, 'historico')
  assert.equal(p.anosNaBase, 2)
  assert.equal(p.estimativa, '2026-11-05')
  const novo = proximaDivulgacao([{ doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-06' }], '2026-10-30')
  assert.equal(novo.base, 'prazo_legal')
  assert.equal(novo.estimativa, '2026-11-14')
})

test('sanidade recusa arquivo com poucas empresas', () => {
  assert.ok(verificarSanidadeBalancos({ empresas: {} }).length > 0)
})

import { acharEntrega, lerAvisosDeDemonstracoes, lerFinanceiro, numeroB3 } from './b3-balancos.mjs'
import { trimestreProvisorio } from './balancos-calculo.mjs'

const RESUMO_VALE = {
  consolidated: [
    { title: 'Balanço Patrimonial  - Consolidado', dateInicial: '30/09/2026', dateFinal: '31/12/2025', results: [{ describle: 'Ativo Total', value: '458.197.000' }, { describle: 'Patrimônio Líquido', value: '199.718.000' }, { describle: 'Patrimônio Líquido Atribuído à Controladora', value: '194.758.000' }] },
    { title: 'Demonstração do Resultado - Consolidado', dateInicial: '01/01/2026 a 30/09/2026', dateFinal: '01/01/2025 a 30/09/2025', results: [{ describle: 'Receita de Venda', value: '156.154.000' }, { describle: 'Resultado Financeiro', value: '(1.538.000)' }, { describle: 'Lucro (Prejuízo) do Período', value: '23.776.000' }, { describle: 'Lucro (Prejuízo) do Período Atribuído à Controladora', value: '23.236.000' }] },
  ],
}

test('números da B3 com parênteses e pontos', () => {
  assert.equal(numeroB3('156.154.000'), 156154000)
  assert.equal(numeroB3('(318.000)'), -318000)
  assert.equal(numeroB3(''), null)
})

test('lê o resumo financeiro acumulado da B3', () => {
  const r = lerFinanceiro(RESUMO_VALE)
  assert.equal(r.periodo, '2026-09-30')
  assert.equal(r.acumuladoDesde, '2026-01-01')
  assert.equal(r.lucroControladores, 23236000)
  assert.equal(r.patrimonioLiquido, 199718000)
  assert.equal(lerFinanceiro({ consolidated: [] }), null)
})

test('lê só os avisos de demonstrações e marca a reapresentação', () => {
  const avisos = lerAvisosDeDemonstracoes([
    { dateTime: '30/10/2026 08:00:12', headline: 'VALE (VALE-NM) - Demonstracoes Financeiras - ITR de 30/09/26 (R) ', url: 'u2' },
    { dateTime: '29/10/2026 19:25:08', headline: 'VALE (VALE-NM) - Demonstracoes Financeiras - ITR de 30/09/26', url: 'u1' },
    { dateTime: '30/10/2026 10:56:37', headline: 'VALE (VALE-NM) - Apresentacao a analistas/agentes mercado - 30/10/26', url: 'u3' },
  ])
  assert.equal(avisos.length, 2)
  assert.deepEqual(avisos.map((a) => [a.dia, a.tipo, a.periodo, a.reapresentacao]), [['2026-10-30', 'ITR', '2026-09-30', true], ['2026-10-29', 'ITR', '2026-09-30', false]])
})

test('acha o dia da entrega original, não o da reapresentação', async () => {
  const avisos = [
    { dateTime: '30/10/2026 08:00:12', headline: 'X (X-NM) - Demonstracoes Financeiras - ITR de 30/09/26 (R) ', url: 'u2' },
    { dateTime: '29/10/2026 19:25:08', headline: 'X (X-NM) - Demonstracoes Financeiras - ITR de 30/09/26', url: 'u1' },
  ]
  const fetchImpl = async () => ({ ok: true, text: async () => JSON.stringify(avisos) })
  const e = await acharEntrega({ raiz: 'XXXX', periodo: '2026-09-30', tipo: 'ITR', hoje: '2026-10-30', fetchImpl, pausaMs: 0 })
  assert.deepEqual(e, { dia: '2026-10-29', link: 'u1' })
})

test('trimestre provisório = acumulado da B3 menos os trimestres anteriores do ano', () => {
  const t = (periodo, rotulo, rec, ll, lc) => ({ periodo, rotulo, tipo: 'ITR', dtReceb: null, link: null, consolidacao: 'consolidada', receita: rec, ebit: 1, lucroLiquido: ll, lucroControladores: lc, ativoTotal: 1, patrimonioLiquido: 1, caixa: 1, divida: 1 })
  const trimestres = [t('2025-09-30', '3T25', 1, 1, 1), t('2025-12-31', '4T25', 1, 1, 1), t('2026-03-31', '1T26', 48680000, 10199000, 9953000), t('2026-06-30', '2T26', 53012000, 7041000, 6847000)]
  const q = trimestreProvisorio({ trimestres, b3: lerFinanceiro(RESUMO_VALE), entrega: { dia: '2026-10-29', link: 'u1' }, dataCorte: '2026-10-30' })
  assert.equal(q.rotulo, '3T26')
  assert.equal(q.receita, 156154000 - 48680000 - 53012000)
  assert.equal(q.lucroControladores, 23236000 - 9953000 - 6847000)
  assert.equal(q.provisorio, true)
  assert.equal(q.dtReceb, '2026-10-29')
  const sem = trimestreProvisorio({ trimestres, b3: lerFinanceiro(RESUMO_VALE), entrega: null, dataCorte: '2026-10-30' })
  assert.equal(sem.dtReceb, '2026-10-30')
  assert.equal(sem.dataAproximada, true)
  // CVM já tem o trimestre: não há provisório
  assert.equal(trimestreProvisorio({ trimestres: [...trimestres, t('2026-09-30', '3T26', 1, 1, 1)], b3: lerFinanceiro(RESUMO_VALE), dataCorte: '2026-10-30' }), null)
  // falta um trimestre do ano: não dá para isolar
  assert.equal(trimestreProvisorio({ trimestres: trimestres.slice(0, 3), b3: lerFinanceiro(RESUMO_VALE), dataCorte: '2026-10-30' }), null)
})

import { anoMesDoPeriodo, lerCadastro, lerCapital, raizDoCnpj, urlCapital } from './bcb-ifdata.mjs'
import { incorporarCapital } from './balancos-calculo.mjs'

test('IF.data: período, raiz do CNPJ e endereço usam os nomes exatos dos parâmetros', () => {
  assert.equal(anoMesDoPeriodo('2026-03-31'), 202603)
  assert.equal(raizDoCnpj('60.872.504/0001-23'), '60872504')
  assert.equal(raizDoCnpj('123'), null)
  const url = urlCapital(202603, ['C0080099', 'C0080075'])
  assert.ok(url.includes('IfDataValores(AnoMes=@AnoMes,TipoInstituicao=@TipoInstituicao,Relatorio=@Relatorio)'))
  assert.ok(url.includes("@Relatorio='5'"))
  assert.ok(decodeURIComponent(url).includes("CodInst eq 'C0080099' or CodInst eq 'C0080075'"))
})

test('IF.data: cadastro liga a raiz do CNPJ ao conglomerado prudencial mais frequente', () => {
  const json = {
    value: [
      { CnpjInstituicaoLider: '60872504', CodConglomeradoPrudencial: 'C0080099' },
      { CnpjInstituicaoLider: '60872504', CodConglomeradoPrudencial: 'C0080099' },
      { CnpjInstituicaoLider: '60872504', CodConglomeradoPrudencial: 'C0000001' },
      { CnpjInstituicaoLider: '00000000', CodConglomeradoPrudencial: null },
    ],
  }
  assert.deepEqual(lerCadastro(json), { 60872504: 'C0080099' })
  assert.equal(lerCadastro({}), null)
})

test('IF.data: lê os índices de capital e descarta valor fora do plausível', () => {
  const json = {
    value: [
      { CodInst: 'C1', NomeColuna: 'Índice de Basileia \n(n) = (e) / (j)', Saldo: 0.1477 },
      { CodInst: 'C1', NomeColuna: 'Índice de Capital Principal \n(l) = (a) / (j)', Saldo: 0.121 },
      { CodInst: 'C1', NomeColuna: 'Índice de Capital Nível I \n(m) = (c) / (j)', Saldo: 0.13 },
      { CodInst: 'C1', NomeColuna: 'Razão de Alavancagem \n(o) = (c) / (k)', Saldo: 7.5 },
      { CodInst: 'C1', NomeColuna: 'Índice de Imobilização \n(p)', Saldo: 0.2 },
    ],
  }
  assert.deepEqual(lerCapital(json), { C1: { basileia: 0.1477, capitalPrincipal: 0.121, nivel1: 0.13, razaoAlavancagem: null } })
  assert.equal(lerCapital({ erro: 1 }), null)
})

test('capital entra só nos trimestres que o BC já publicou', () => {
  const empresa = { ticker: 'ITUB4', trimestres: [{ periodo: '2025-12-31', rotulo: '4T25' }, { periodo: '2026-03-31', rotulo: '1T26' }] }
  const r = incorporarCapital({ empresa, capitais: { '2025-12-31': { basileia: 0.15, capitalPrincipal: 0.12, nivel1: 0.13, razaoAlavancagem: null } } })
  assert.equal(r.trimestres[0].basileia, 0.15)
  assert.equal('basileia' in r.trimestres[1], false)
  assert.equal(incorporarCapital({ empresa, capitais: {} }), empresa)
})

test('lucro bruto, custo e estoque: só entram quando a empresa reporta custo; o 4º trimestre é o ano menos 9 meses', () => {
  const docs = [
    { doc: 'ITR', dtRefer: '2025-09-30', dtReceb: '2025-11-05' },
    { doc: 'DFP', dtRefer: '2025-12-31', dtReceb: '2026-03-10' },
  ]
  const extra = (doc, dtRefer, ini, custo, bruto) => [linha(doc, dtRefer, 'DRE', '3.02', custo, ini), linha(doc, dtRefer, 'DRE', '3.03', bruto, ini)]
  const estoque = (doc, dtRefer, v) => [linha(doc, dtRefer, 'BPA', '1.01.04', v)]
  const linhas = [
    ...dre('ITR', '2025-09-30', '2025-07-01', 3e6, 3e5), ...extra('ITR', '2025-09-30', '2025-07-01', -2e6, 1e6),
    ...dre('ITR', '2025-09-30', '2025-01-01', 9e6, 9e5), ...extra('ITR', '2025-09-30', '2025-01-01', -6e6, 3e6), ...bal('ITR', '2025-09-30'), ...estoque('ITR', '2025-09-30', 5e5),
    ...dre('DFP', '2025-12-31', '2025-01-01', 13e6, 1e6), ...extra('DFP', '2025-12-31', '2025-01-01', -8.5e6, 4.5e6), ...bal('DFP', '2025-12-31'), ...estoque('DFP', '2025-12-31', 7e5),
  ]
  const [t3, t4] = trimestresDaEmpresa({ c: { docs, linhas }, dataCorte: '2026-10-30' })
  assert.equal(t3.lucroBruto, 1000)
  assert.equal(t3.cmv, 2000)
  assert.equal(t3.estoques, 500)
  assert.equal(t4.lucroBruto, 1500)
  assert.equal(t4.cmv, 2500)
  assert.equal(t4.estoques, 700)
  // Sem custo informado (3.02 ausente), não há margem bruta: fica null.
  const semCusto = trimestresDaEmpresa({ c: { docs: [docs[0]], linhas: [...dre('ITR', '2025-09-30', '2025-07-01', 3e6, 3e5), ...bal('ITR', '2025-09-30')] }, dataCorte: '2026-10-30' })[0]
  assert.equal(semCusto.lucroBruto, null)
  assert.equal(semCusto.cmv, null)
})

import { herdarSeguros, precisaDoSes } from './atualizar-balancos.mjs'
import { incorporarSeguros } from './balancos-calculo.mjs'
import { lerSeguros, mesesDoTrimestre, trimestreDeSeguros } from './susep-ses.mjs'

async function* linhasSes(linhas) {
  yield 'damesano;coenti;cogrupo;coramo;premio_direto;premio_de_seguros;premio_retido;premio_ganho;sinistro_direto;sinistro_retido;desp_com;premio_emitido2;premio_emitido_cap;despesa_resseguros;sinistro_ocorrido'
  for (const l of linhas) yield l
}

test('SES: soma os 3 meses e calcula sinistralidade e comissionamento; mês faltando ou prêmio zero não vira número', async () => {
  assert.deepEqual(mesesDoTrimestre('2026-06-30'), [202604, 202605, 202606])
  const linhas = [
    '202604;05886;00051;0531;0;0;0;1000000,50;0;0;100000;0;0;0;500000',
    '202604;05886;00051;0532;0;0;0;1000000;0;0;100000;0;0;0;400000',
    '202605;05886;00051;0531;0;0;0;2000000;0;0;200000;0;0;0;1000000',
    '202606;05886;00051;0531;0;0;0;2000000;0;0;200000;0;0;0;1100000',
    '202606;99999;00051;0531;0;0;0;9999999;0;0;1;0;0;0;1',
    '202601;05886;00051;0531;0;0;0;1;0;0;1;0;0;0;1',
  ]
  const por = await lerSeguros('x.zip', ['05886'], { desdeAnoMes: 202603, linhas: linhasSes(linhas) })
  assert.deepEqual(Object.keys(por), ['05886'])
  assert.deepEqual(Object.keys(por['05886']).map(Number), [202604, 202605, 202606])
  const q = trimestreDeSeguros(por, ['05886'], '2026-06-30')
  assert.equal(q.premioGanho, 6000)
  assert.ok(Math.abs(q.sinistralidade - 3000000 / 6000000.5) < 1e-9)
  assert.ok(Math.abs(q.comissionamento - 600000 / 6000000.5) < 1e-9)
  assert.equal(trimestreDeSeguros(por, ['05886'], '2026-09-30'), null)
  assert.equal(trimestreDeSeguros({ A: { 202604: { premioGanho: 1, sinistroOcorrido: 5, comissoes: 0 }, 202605: { premioGanho: 1, sinistroOcorrido: 5, comissoes: 0 }, 202606: { premioGanho: 1, sinistroOcorrido: 5, comissoes: 0 } } }, ['A'], '2026-06-30'), null)
})

test('SES: só baixa a base quando falta o trimestre já fechado há 50 dias, e herda o que já foi publicado', () => {
  const emp = (extra) => ({ trimestres: [{ periodo: '2026-03-31', ...extra }, { periodo: '2026-06-30' }] })
  const entidades = { PSSA3: { entidades: ['05886'] } }
  assert.equal(precisaDoSes({ saida: { PSSA3: emp({}) }, entidades, dataCorte: '2026-10-31' }), true)
  // O 2T26 fechou há 123 dias e ainda não tem dado: precisa.
  assert.equal(precisaDoSes({ saida: { PSSA3: { trimestres: [{ periodo: '2026-06-30', sinistralidade: 0.5 }] } }, entidades, dataCorte: '2026-10-31' }), false)
  // Trimestre recente demais (menos de 50 dias): ainda não vale baixar.
  assert.equal(precisaDoSes({ saida: { PSSA3: { trimestres: [{ periodo: '2026-06-30' }] } }, entidades, dataCorte: '2026-08-01' }), false)
  const saida = { PSSA3: emp({}) }
  herdarSeguros({ saida, anterior: { empresas: { PSSA3: emp({ premioGanho: 5, sinistralidade: 0.5, comissionamento: 0.1 }) } } })
  assert.equal(saida.PSSA3.trimestres[0].sinistralidade, 0.5)
  assert.equal('sinistralidade' in saida.PSSA3.trimestres[1], false)
  const r = incorporarSeguros({ empresa: emp({}), porPeriodo: { '2026-06-30': { premioGanho: 9, sinistralidade: 0.6, comissionamento: 0.2 } } })
  assert.equal(r.trimestres[1].sinistralidade, 0.6)
})
