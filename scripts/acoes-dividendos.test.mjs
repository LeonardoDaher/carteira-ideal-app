// Top 15 ações pagadoras de dividendos (D122): leitor da B3, cálculo à mão, auditoria, modo diário e publicação. Sem rede.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { baixarProventos, baixarProventosDaEmpresa, classeDoIsin, classeDoTicker, dataBr, lerCadastro, lerProventos, numeroBr, unirProventos, urlCadastro, urlProventos } from './b3-proventos.mjs'
import { ajustarPorDesdobramento, calcularDividendos, canonico, hashDoResultado, ordenarEventos, sha256, somarDias, verificarSanidade } from './acoes-dividendos-calculo.mjs'
import { ajustesDoHistorico, concluir, csvRanking, empresasDoCadastro, montarInsumos, montarSnapshotApp } from './atualizar-acoes-dividendos.mjs'
import { verificar } from './acoes-dividendos-verificar.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const cfgArquivo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'acoes-dividendos.json'), 'utf8'))
const cfg = { ...cfgArquivo, tamanhoDaLista: 2, publicacao: { ...cfgArquivo.publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoComProventos: 2, maximoFracaoSemDadosB3: 0.9, dyMaximoPlausivel: 1 } } }
const aprovado = (c) => ({ ...c, publicacao: { ...c.publicacao, aprovadoPeloResponsavel: true } })

// ---------------------------------------------------------------------------------------
// Leitor da B3
// ---------------------------------------------------------------------------------------

const linhaB3 = (o = {}) => ({ typeStock: 'ON', dateApproval: '06/08/2026', valueCash: '0,67407131', ratio: '1', corporateAction: 'JRS CAP PROPRIO', lastDatePriorEx: '21/08/2026', dateClosingPricePriorExDate: '21/08/2026', closingPricePriorExDate: '49,34', quotedPerShares: '1', corporateActionPrice: '1,366176', lastDateTimePriorEx: '2026-08-21T00:00:00', ...o })
const paginaB3 = (results, page = {}) => ({ page: { pageNumber: 1, pageSize: 100, totalRecords: results.length, totalPages: 1, ...page }, results })

test('numeroBr e dataBr: formato da B3; lixo vira null', () => {
  assert.equal(numeroBr('0,67407131'), 0.67407131)
  assert.equal(numeroBr('1.234,5'), 1234.5)
  for (const ruim of ['', '-', 'abc', null, undefined, '1,2,3']) assert.equal(numeroBr(ruim), null, String(ruim))
  assert.equal(dataBr('21/08/2026'), '2026-08-21')
  for (const ruim of ['2026-08-21', '21/08/26', '', null]) assert.equal(dataBr(ruim), null, String(ruim))
})

test('classeDoTicker: final do código → classe que a B3 escreve', () => {
  assert.deepEqual(['PETR3', 'PETR4', 'BPAC11', 'ITSA4', 'ELET5', 'BRSR6', 'B3SA3', 'XXXX9', 'PETR', null].map(classeDoTicker), ['ON', 'PN', 'UNT', 'PN', 'PNA', 'PNB', 'ON', null, null, null])
})

test('urlProventos: base64 do JSON, codificado em URL (nome com barra não quebra o endereço)', () => {
  const url = urlProventos('AMBEV S/A', 2, 50)
  assert.ok(url.startsWith('https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedCashDividends/'))
  const bruto = decodeURIComponent(url.split('/').pop())
  assert.deepEqual(JSON.parse(Buffer.from(bruto, 'base64').toString('utf8')), { language: 'pt-br', pageNumber: 2, pageSize: 50, tradingName: 'AMBEV S/A' })
  assert.equal(url.split('/').length, 7, 'só um segmento depois de GetListedCashDividends')
})

test('classeDoIsin: o tipo do ISIN dá a classe; units entram; BDR, séries A04OR e desconhecido viram OUTRA (não entram na conta)', () => {
  assert.deepEqual(['BRPETRACNPR7', 'BRPETRACNOR9', 'BRBBASA04OR8', 'BRBPACUNT006', 'BRTAEECDAM10', 'BRITUBACNPA4', 'BRJBSSBDR002', null].map(classeDoIsin), ['PN', 'ON', 'OUTRA', 'UNT', 'UNT', 'PNA', 'OUTRA', 'OUTRA'])
})

test('lerProventos: valor por ação (divide pela quantidade por lote), data com ISO, classe e tipo em caixa alta', () => {
  const r = lerProventos(paginaB3([linhaB3(), linhaB3({ typeStock: 'pn', corporateAction: 'Dividendo', valueCash: '12,5', quotedPerShares: '1000', ratio: '1000' })]))
  assert.equal(r.totalRegistros, 2)
  assert.deepEqual(r.eventos[0], { classe: 'ON', tipo: 'JRS CAP PROPRIO', valor: 0.67407131, dataCom: '2026-08-21', aprovadoEm: '2026-08-06', precoAntesEx: 49.34 })
  assert.equal(r.eventos[1].classe, 'PN')
  assert.equal(r.eventos[1].tipo, 'DIVIDENDO')
  assert.equal(r.eventos[1].valor, 0.0125)
})

test('lerProventos: formato mudado ou valor/data ilegível é erro, não palpite', () => {
  assert.throws(() => lerProventos({}), /formato mudou/)
  assert.throws(() => lerProventos(paginaB3([linhaB3({ valueCash: 'abc' })])), /valor ilegível/)
  assert.throws(() => lerProventos(paginaB3([linhaB3({ valueCash: '-1,0' })])), /valor ilegível/)
  assert.throws(() => lerProventos(paginaB3([linhaB3({ quotedPerShares: '0' })])), /quantidade por lote/)
  assert.throws(() => lerProventos(paginaB3([linhaB3({ lastDatePriorEx: '2026-08-21' })])), /data com ilegível/)
  assert.throws(() => lerProventos(paginaB3([linhaB3({ typeStock: '' })])), /sem classe ou tipo/)
})

const respostaFalsa = (corpo, ok = true, status = 200) => ({ ok, status, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)) })

test('baixarProventos: junta as páginas, confere o total e dá o sha256 do texto bruto', async () => {
  const paginas = [paginaB3([linhaB3(), linhaB3({ valueCash: '1,0' })], { totalRecords: 3, totalPages: 2 }), paginaB3([linhaB3({ valueCash: '2,0' })], { pageNumber: 2, totalRecords: 3, totalPages: 2 })]
  let n = 0
  const r = await baixarProventos('TESTE', { fetchImpl: async () => respostaFalsa(paginas[n++]), pausaMs: 0 })
  assert.equal(r.eventos.length, 3)
  assert.match(r.sha256, /^[0-9a-f]{64}$/)
  await assert.rejects(baixarProventos('TESTE', { fetchImpl: async () => respostaFalsa(paginaB3([linhaB3()], { totalRecords: 5 })), pausaMs: 0 }), /incompleta/)
})

test('baixarProventos: tenta de novo e aceita a resposta em JSON dentro de string (cabeçalho accept)', async () => {
  let n = 0
  const r = await baixarProventos('TESTE', { fetchImpl: async () => (++n < 3 ? respostaFalsa('', false, 503) : respostaFalsa(JSON.stringify(JSON.stringify(paginaB3([linhaB3()]))))), pausaMs: 0, tentativas: 3 })
  assert.equal(n, 3)
  assert.equal(r.eventos.length, 1)
  await assert.rejects(baixarProventos('TESTE', { fetchImpl: async () => respostaFalsa('', false, 500), pausaMs: 0, tentativas: 2 }), /HTTP 500/)
})

const itemCadastro = (o = {}) => ({ assetIssued: 'BRABEVACNOR1', paymentDate: '31/12/2026', rate: '0,07130000000', relatedTo: 'Anual/2026', approvedOn: '29/07/2026', isinCode: 'BRABEVACNOR1', label: 'JRS CAP PROPRIO', lastDatePrior: '21/09/2026', remarks: '', ...o })
const cadastroB3 = (itens, o = {}) => [{ tradingName: 'AMBEV S/A   ', cnpj: '7526557000100', codeCVM: '23264', cashDividends: itens, ...o }]

test('lerCadastro: nome de pregão aparado, classe pelo ISIN, valor por ação e data com ISO; código desconhecido é null; formato mudado é erro', () => {
  const r = lerCadastro(cadastroB3([itemCadastro(), itemCadastro({ isinCode: 'BRABEVACNPR1', label: 'dividendo', rate: '1,5', lastDatePrior: '18/12/2025' })]))
  assert.equal(r.nomeDePregao, 'AMBEV S/A')
  assert.equal(r.codigoCvm, '23264')
  assert.deepEqual(r.eventos[0], { classe: 'ON', tipo: 'JRS CAP PROPRIO', valor: 0.0713, dataCom: '2026-09-21', aprovadoEm: '2026-07-29', precoAntesEx: null })
  assert.deepEqual([r.eventos[1].classe, r.eventos[1].tipo, r.eventos[1].valor], ['PN', 'DIVIDENDO', 1.5])
  assert.equal(lerCadastro([]), null)
  assert.equal(lerCadastro({}), null)
  assert.throws(() => lerCadastro([{ nome: 'x' }]), /formato mudou/)
  assert.throws(() => lerCadastro(cadastroB3([itemCadastro({ rate: 'abc' })])), /valor ilegível/)
  assert.throws(() => lerCadastro(cadastroB3([itemCadastro({ lastDatePrior: '2026-09-21' })])), /data com ilegível/)
  assert.throws(() => lerCadastro(cadastroB3({})), /não é uma lista/)
})

test('unirProventos: parcelas repetidas dentro de uma lista ficam; entre as listas vale a que tem mais linhas; o que só uma lista tem entra', () => {
  const e = (dataCom, valor, tipo = 'DIVIDENDO') => ({ classe: 'PN', tipo, valor, dataCom })
  const historico = [e('2026-06-23', 0.11), e('2026-06-23', 0.11), e('2026-03-01', 0.2)]
  const cadastro = [e('2026-06-23', 0.11), e('2026-06-23', 0.11), e('2026-10-08', 0.19), e('2026-03-01', 0.2), e('2026-03-01', 0.2)]
  const u = unirProventos(historico, cadastro)
  const conta = (d) => u.filter((x) => x.dataCom === d).length
  assert.deepEqual([conta('2026-06-23'), conta('2026-03-01'), conta('2026-10-08')], [2, 2, 1], 'não soma as duas listas; usa a maior')
  assert.equal(u.length, 5)
  assert.equal(unirProventos([], []).length, 0)
  // Mesmo pagamento com arredondamento diferente nas duas listas (0,0402 × 0,040223) conta uma vez só, com o valor do histórico.
  const arred = unirProventos([e('2026-09-24', 0.0402)], [e('2026-09-24', 0.040223)])
  assert.deepEqual(arred.map((x) => x.valor), [0.0402])
  // Pagamentos diferentes na mesma data (TAEE11: dois dividendos no mesmo dia) ficam os dois quando uma lista tem os dois.
  assert.deepEqual(unirProventos([e('2026-04-29', 0.7553)], [e('2026-04-29', 0.7553), e('2026-04-29', 0.1535)]).map((x) => x.valor).sort(), [0.1535, 0.7553])
})

test('baixarProventosDaEmpresa: cadastro + histórico pelo nome de pregão, unidos; sem histórico, só o cadastro, marcado como parcial', async () => {
  const historicoDe = (nome) => (nome === 'AMBEV S/A' ? paginaB3([linhaB3({ lastDatePriorEx: '18/12/2025', valueCash: '0,2690' }), linhaB3({ lastDatePriorEx: '21/09/2026', valueCash: '0,0713' })]) : paginaB3([]))
  const chamadas = []
  const fetchImpl = async (url) => {
    chamadas.push(url)
    if (url.includes('GetListedSupplementCompany')) return respostaFalsa(cadastroB3([itemCadastro(), itemCadastro({ lastDatePrior: '22/06/2026', rate: '0,0449' })]))
    return respostaFalsa(historicoDe(JSON.parse(Buffer.from(decodeURIComponent(url.split('/').pop()), 'base64').toString('utf8')).tradingName))
  }
  const r = await baixarProventosDaEmpresa('ABEV', { fetchImpl, pausaMs: 0 })
  assert.equal(r.nomeDePregao, 'AMBEV S/A')
  assert.equal(r.historicoDisponivel, true)
  assert.deepEqual(r.contagens, { historico: 2, cadastro: 2, unidos: 3 })
  assert.deepEqual(r.eventos.map((x) => x.dataCom).sort(), ['2025-12-18', '2026-06-22', '2026-09-21'])
  assert.match(r.sha256, /^[0-9a-f]{64}$/)
  assert.equal(chamadas.length, 2)
  // Nome que o histórico não conhece: só o cadastro vale.
  const soCadastro = await baixarProventosDaEmpresa('ABEV', { fetchImpl: async (url) => (url.includes('GetListedSupplementCompany') ? respostaFalsa(cadastroB3([itemCadastro()], { tradingName: 'NOME NOVO' })) : respostaFalsa(paginaB3([]))), pausaMs: 0 })
  assert.equal(soCadastro.historicoDisponivel, false)
  assert.equal(soCadastro.eventos.length, 1)
  // Código que a B3 não conhece (corpo vazio) e empresa sem nenhum provento.
  const sem = await baixarProventosDaEmpresa('XXXX', { fetchImpl: async () => respostaFalsa(''), pausaMs: 0 })
  assert.equal(sem.eventos.length, 0)
  assert.match(sem.motivo, /não tem cadastro/)
  const vazia = await baixarProventosDaEmpresa('YYYY', { fetchImpl: async (url) => (url.includes('GetListedSupplementCompany') ? respostaFalsa(cadastroB3([])) : respostaFalsa(paginaB3([]))), pausaMs: 0 })
  assert.match(vazia.motivo, /não tem proventos publicados/)
  assert.equal(urlCadastro('ABEV').split('/').length, 7)
})

// ---------------------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------------------

const ev = (dataCom, valor, tipo = 'DIVIDENDO', classe = 'ON', extra = {}) => ({ classe, tipo, valor, dataCom, aprovadoEm: dataCom, precoAntesEx: null, ...extra })
const emp = (ticker, o = {}) => ({ ticker, nome: `Empresa ${ticker}`, setor: 'Energia', cotacao: 10, dataCotacao: '2026-10-22', liquidezDiaria: 10e6, nomeDePregao: ticker, historicoDisponivel: true, ajustes: [], eventos: [], ...o })
const insumosDe = (empresas) => ({ esquema: 1, dataPrecos: '2026-10-22', empresas })
const rodar = (empresas, c = cfg) => calcularDividendos(insumosDe(empresas), c)
const codigos = (r) => Object.fromEntries(r.resultado.exclusoes.map((e) => [e.ticker, e.codigo]))

test('somarDias: volta no tempo atravessando mês e ano', () => {
  assert.equal(somarDias('2026-10-22', -365), '2025-10-22')
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28')
})

test('DY à mão: dividendo + JCP bruto da classe da ação ÷ cotação, só com data com na janela', () => {
  const r = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 0.5), ev('2026-05-20', 0.3, 'JRS CAP PROPRIO'), ev('2025-10-22', 9), ev('2025-10-21', 9), ev('2026-08-21', 7, 'DIVIDENDO', 'PN')] })]).resultado
  const a = r.ranking[0]
  assert.equal(a.ticker, 'AAAA3')
  assert.equal(a.dy, 0.08)
  assert.equal(a.proventosPorAcao, 0.8)
  assert.equal(a.dividendos, 0.5)
  assert.equal(a.jcp, 0.3)
  assert.equal(a.pagamentos, 2)
  assert.equal(a.primeiraDataCom, '2026-05-20')
  assert.equal(a.ultimaDataCom, '2026-08-21')
  assert.deepEqual(a.proventos.map((p) => [p.dataCom, p.tipo, p.valor]), [['2026-08-21', 'DIVIDENDO', 0.5], ['2026-05-20', 'JRS CAP PROPRIO', 0.3]])
  assert.deepEqual(r.janela, { inicio: '2025-10-22', fim: '2026-10-22', dias: 365 })
})

test('classe: PETR4 só conta linhas PN, TAEE11 só UNT; a data com no último pregão entra, no dia da janela de início não', () => {
  const r = rodar([
    emp('PETR4', { eventos: [ev('2026-08-21', 1, 'DIVIDENDO', 'PN'), ev('2026-08-21', 5, 'DIVIDENDO', 'ON')] }),
    emp('TAEE11', { eventos: [ev('2026-10-22', 2, 'DIVIDENDO', 'UNT'), ev('2026-10-22', 1, 'DIVIDENDO', 'ON'), ev('2025-10-22', 3, 'DIVIDENDO', 'UNT')] }),
  ]).resultado
  const por = Object.fromEntries(r.ranking.map((x) => [x.ticker, x.proventosPorAcao]))
  assert.deepEqual(por, { PETR4: 1, TAEE11: 2 })
})

test('parcelas: linhas idênticas da B3 (mesma data com e valor) são pagamentos diferentes e todas entram na soma', () => {
  const r = rodar([emp('CMIG4', { eventos: [ev('2026-06-23', 0.11, 'JRS CAP PROPRIO', 'PN'), ev('2026-06-23', 0.11, 'JRS CAP PROPRIO', 'PN')] })]).resultado
  assert.equal(r.ranking[0].proventosPorAcao, 0.22)
  assert.equal(r.ranking[0].pagamentos, 1, 'duas parcelas na mesma data com contam um dia de pagamento')
  assert.equal(r.ranking[0].proventos.length, 2)
})

test('restituição de capital não é provento: não soma e aparece só nos "não usados" da memória', () => {
  const x = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 0.5), ev('2026-08-21', 4, 'REST CAP DIN')] }), emp('BBBB3', { eventos: [ev('2026-08-21', 4, 'REST CAP DIN')] })])
  assert.equal(x.resultado.ranking[0].proventosPorAcao, 0.5)
  assert.equal(x.memoria.AAAA3.naoUsados.length, 1)
  assert.equal(codigos(x).BBBB3, 'sem_proventos')
  assert.match(x.resultado.exclusoes.find((e) => e.ticker === 'BBBB3').motivo, /devolução de capital/i)
})

test('rendimento (tipo RENDIMENTO) entra na soma e aparece separado', () => {
  const a = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 0.5, 'RENDIMENTO'), ev('2026-07-21', 0.25)] })]).resultado.ranking[0]
  assert.equal(a.rendimentos, 0.5)
  assert.equal(a.proventosPorAcao, 0.75)
})

test('ajustarPorDesdobramento: divide pelo fator dos eventos DEPOIS da data com; grupamento multiplica', () => {
  const e = ev('2026-03-19', 2.5)
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-04-29', fator: 5 }]).valor, 0.5)
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-04-29', fator: 5 }]).valorOriginal, 2.5)
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-03-19', fator: 5 }]), e, 'evento na data do ajuste já está na base nova')
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-01-01', fator: 5 }]), e)
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-04-29', fator: 0.1 }]).valor, 25)
  assert.equal(ajustarPorDesdobramento(e, [{ data: '2026-04-01', fator: 2 }, { data: '2026-05-01', fator: 5 }]).valor, 0.25)
})

test('Sabesp (SBSP3): desdobramento 5:1 depois dos proventos tira o yield de 11% para 2%', () => {
  const sem = rodar([emp('SBSP3', { cotacao: 31.8, eventos: [ev('2026-03-19', 0.8334, 'JRS CAP PROPRIO'), ev('2025-12-23', 2.6439, 'JRS CAP PROPRIO')] })]).resultado.ranking[0]
  assert.equal(Math.round(sem.dy * 100), 11)
  const com = rodar([emp('SBSP3', { cotacao: 31.8, ajustes: [{ data: '2026-04-29', fator: 5 }], eventos: [ev('2026-03-19', 0.8334, 'JRS CAP PROPRIO'), ev('2025-12-23', 2.6439, 'JRS CAP PROPRIO')] })]).resultado.ranking[0]
  assert.equal(Math.round(com.dy * 1000) / 10, 2.2)
  assert.deepEqual(com.ajustesAplicados, [{ data: '2026-04-29', fator: 5 }])
  assert.ok(com.alertas.includes('ajustado_por_desdobramento'))
  assert.equal(sem.ajustesAplicados.length, 0)
})

test('ordem: maior yield primeiro; empate pelo código; o ranking guarda até rankingAteOnde', () => {
  const r = rodar([emp('CCCC3', { eventos: [ev('2026-08-21', 1)] }), emp('AAAA3', { eventos: [ev('2026-08-21', 1)] }), emp('BBBB3', { eventos: [ev('2026-08-21', 2)] }), emp('DDDD3', { eventos: [ev('2026-08-21', 0.1)] })], { ...cfg, rankingAteOnde: 3 }).resultado
  assert.deepEqual(r.ranking.map((x) => [x.posicao, x.ticker]), [[1, 'BBBB3'], [2, 'AAAA3'], [3, 'CCCC3']])
  assert.equal(r.avaliadas, 4)
})

test('exclusões: sem preço, pouca liquidez, sem dados da B3, sem proventos, classe desconhecida — cada uma com código e motivo', () => {
  const x = rodar([
    emp('AAAA3', { eventos: [ev('2026-08-21', 1)] }),
    emp('SEMP3', { cotacao: null, dataCotacao: null, eventos: [ev('2026-08-21', 1)] }),
    emp('LIQU3', { liquidezDiaria: 1000, eventos: [ev('2026-08-21', 1)] }),
    emp('SEMB3', { eventos: [], motivoSemDados: 'A B3 não tem cadastro para este código.' }),
    emp('VELH3', { eventos: [ev('2024-08-21', 1)] }),
    emp('XXXX9', { eventos: [ev('2026-08-21', 1)] }),
  ])
  assert.deepEqual(codigos(x), { SEMP3: 'sem_preco', LIQU3: 'liquidez_baixa', SEMB3: 'sem_dados_b3', VELH3: 'sem_proventos', XXXX9: 'classe_desconhecida' })
  assert.equal(x.resultado.exclusoes.find((e) => e.ticker === 'SEMB3').motivo, 'A B3 não tem cadastro para este código.')
  assert.deepEqual(x.resultado.etapas.map((e) => [e.id, e.entram, e.saem]), [['preco', 6, 1], ['liquidez', 5, 1], ['dados_b3', 4, 1], ['proventos', 3, 2]])
})

test('alertas: yield acima do limite e histórico parcial (só o cadastro da B3)', () => {
  const a = rodar([emp('AAAA3', { historicoDisponivel: false, eventos: [ev('2026-08-21', 3)] })]).resultado.ranking[0]
  assert.deepEqual(a.alertas, ['dy_muito_alto', 'historico_parcial'])
  assert.equal(rodar([emp('BBBB3', { eventos: [ev('2026-08-21', 1)] })]).resultado.ranking[0].alertas.length, 0)
})

test('ordenarEventos não remove nem muda nada; só ordena', () => {
  const eventos = [ev('2026-01-01', 1), ev('2026-06-01', 2), ev('2026-06-01', 2)]
  assert.deepEqual(ordenarEventos(eventos).map((e) => e.dataCom), ['2026-06-01', '2026-06-01', '2026-01-01'])
  assert.equal(eventos[0].dataCom, '2026-01-01')
})

test('hash do resultado é estável e muda com um provento a mais', () => {
  const a = hashDoResultado(rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 1)] })]).resultado)
  assert.equal(a, hashDoResultado(rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 1)] })]).resultado))
  assert.notEqual(a, hashDoResultado(rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 1), ev('2026-07-21', 1)] })]).resultado))
  assert.equal(sha256(canonico({ b: 1, a: [2, { d: 1, c: 2 }] })), sha256('{"a":[2,{"c":2,"d":1}],"b":1}'))
})

test('trava de sanidade: poucas empresas, B3 sem dados demais, yield absurdo', () => {
  const ok = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 1)] }), emp('BBBB3', { eventos: [ev('2026-08-21', 1)] })]).resultado
  assert.deepEqual(verificarSanidade(ok, cfg), [])
  assert.match(verificarSanidade(ok, { ...cfg, publicacao: { ...cfg.publicacao, sanidade: { ...cfg.publicacao.sanidade, minimoComProventos: 3 } } }).join(), /Só 2 empresas com proventos/)
  const semB3 = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 1)] }), emp('BBBB3', { eventos: [], motivoSemDados: 'x' }), emp('CCCC3', { eventos: [], motivoSemDados: 'x' })]).resultado
  assert.match(verificarSanidade(semB3, { ...cfg, publicacao: { ...cfg.publicacao, sanidade: { ...cfg.publicacao.sanidade, maximoFracaoSemDadosB3: 0.5 } } }).join(), /2 de 3 empresas sem dados na B3/)
  const absurdo = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 15)] })]).resultado
  assert.match(verificarSanidade(absurdo, cfg).join(), /DY acima de 100% em AAAA3/)
})

// ---------------------------------------------------------------------------------------
// Insumos a partir do cadastro e do histórico de preços
// ---------------------------------------------------------------------------------------

const cadastro = { setores: [{ setor: 'Energia', empresas: [{ ticker: 'AAAA3', nome: 'Alfa' }, { ticker: 'BBBB4', nome: 'Beta' }, { ticker: 'CCCC3', nome: 'Gama' }, { ticker: 'DDDD3', nome: 'Delta' }] }] }
const pregoes = Array.from({ length: 30 }, (_, i) => somarDias('2026-09-23', i))
const serie = (volume) => Array.from({ length: 30 }, () => [10, 9, 11, volume])
const historico = {
  pregoes,
  ultimoNegocio: { AAAA3: ['2026-10-22', 10], BBBB4: ['2026-10-22', 20], CCCC3: ['2026-04-01', 5], DDDD3: ['2026-10-22', 7] },
  ativos: { AAAA3: serie(10e6), BBBB4: serie(2e6), CCCC3: serie(10e6), DDDD3: serie(10e6) },
}

test('empresasDoCadastro: preço do último negócio, liquidez média da janela; papel parado há meses fica sem preço', () => {
  const { dataPrecos, empresas } = empresasDoCadastro({ cadastro, historico, cfg })
  assert.equal(dataPrecos, '2026-10-22')
  const por = Object.fromEntries(empresas.map((e) => [e.ticker, e]))
  assert.equal(por.AAAA3.cotacao, 10)
  assert.equal(por.AAAA3.liquidezDiaria, 10e6)
  assert.equal(por.BBBB4.liquidezDiaria, 2e6)
  assert.equal(por.CCCC3.cotacao, null)
  assert.equal(por.CCCC3.dataCotacao, null)
})

test('montarInsumos: baixa quem tem preço (liquidez só filtra o ranking), uma vez por empresa; falha de uma empresa não derruba as outras', async () => {
  const baixadas = []
  const baixar = async (raiz) => {
    baixadas.push(raiz)
    if (raiz === 'DDDD') throw new Error('HTTP 503')
    return { nomeDePregao: `NOME ${raiz}`, historicoDisponivel: true, sha256: 'h', eventos: [ev('2026-08-21', 1), ev('2020-01-01', 9)] }
  }
  const ins = await montarInsumos({ cadastro, historico, cfg: { ...cfg, pausaEntreChamadasMs: 0 }, baixar, log: () => {}, lerAjustes: (t) => (t === 'AAAA3' ? [{ data: '2026-04-29', fator: 5 }] : []) })
  assert.deepEqual(baixadas, ['AAAA', 'BBBB', 'DDDD'])
  const por = Object.fromEntries(ins.empresas.map((e) => [e.ticker, e]))
  assert.deepEqual(por.AAAA3.eventos.map((e) => e.dataCom), ['2026-08-21'], 'evento de 2020 não entra nos insumos')
  assert.deepEqual(por.AAAA3.ajustes, [{ data: '2026-04-29', fator: 5 }])
  assert.equal(por.AAAA3.nomeDePregao, 'NOME AAAA')
  assert.match(por.DDDD3.motivoSemDados, /Falha ao baixar da B3: HTTP 503/)
  assert.deepEqual(por.BBBB4.eventos.map((e) => e.dataCom), ['2026-08-21'], 'sem liquidez também baixa: o DY dela alimenta a análise')
  assert.deepEqual(por.CCCC3.eventos, [])
  assert.equal(ins.dataPrecos, '2026-10-22')
})

test('ajustesDoHistorico: lê o campo "ajustes" do arquivo do código; sem arquivo, sem ajuste', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajustes-'))
  const pasta = path.join(dir, 'webapp-src', 'public', 'dados', 'acoes-historico')
  fs.mkdirSync(pasta, { recursive: true })
  fs.writeFileSync(path.join(pasta, 'SBSP3.json'), JSON.stringify({ ajustes: [{ data: '2026-04-29', fator: 5, origem: 'detectado' }, { data: null, fator: 2 }] }))
  const ler = ajustesDoHistorico(dir)
  assert.deepEqual(ler('SBSP3'), [{ data: '2026-04-29', fator: 5 }])
  assert.deepEqual(ler('XXXX3'), [])
})

// ---------------------------------------------------------------------------------------
// Auditoria, modo diário e publicação (pasta temporária)
// ---------------------------------------------------------------------------------------

function raizTemporaria() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'dividendos-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['acoes-dividendos-calculo.mjs', 'b3-proventos.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  return raiz
}
const insumosBons = () => insumosDe([
  emp('AAAA3', { eventos: [ev('2026-08-21', 1.5), ev('2026-05-20', 0.5, 'JRS CAP PROPRIO')] }),
  emp('BBBB3', { eventos: [ev('2026-08-21', 0.5)] }),
  emp('CCCC3', { eventos: [ev('2026-08-21', 0.1)] }),
  emp('DDDD3', { eventos: [], motivoSemDados: 'sem dados' }),
])
const silencio = () => {}
const lerApp = (raiz) => JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesDividendos.json'), 'utf8'))

test('execução completa: grava a pasta, o verificador independente confere e o app NÃO recebe a lista sem aprovação', () => {
  const raiz = raizTemporaria()
  const r = concluir({ raiz, cfg, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-25', agora: new Date('2026-10-25T08:00:00Z') })
  assert.equal(r.modo, 'completa')
  assert.equal(r.publicado, false)
  const pasta = path.join(raiz, 'auditoria', 'acoes-dividendos', '2026-10-25')
  for (const a of ['manifesto.json', 'config.json', 'insumos.json.gz', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'proventos.csv', 'exclusoes.csv', 'LEIA-ME.md']) assert.ok(fs.existsSync(path.join(pasta, a)), a)
  const v = verificar(pasta, raiz)
  assert.ok(v.ok, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
  const app = lerApp(raiz)
  assert.equal(app.publicado, false)
  assert.deepEqual(app.ranking, [])
  assert.deepEqual(app.exclusoes, [])
  assert.equal(app.pastaAuditoria, 'auditoria/acoes-dividendos/2026-10-25')
  assert.equal(JSON.parse(fs.readFileSync(path.join(raiz, 'auditoria', 'acoes-dividendos', 'ultima.json'), 'utf8')).pasta, 'auditoria/acoes-dividendos/2026-10-25')
})

test('verificador: arquivo alterado, ou insumo alterado, é pego', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, cfg, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-25' })
  const pasta = path.join(raiz, 'auditoria', 'acoes-dividendos', '2026-10-25')
  fs.appendFileSync(path.join(pasta, 'ranking.csv'), 'x')
  const v = verificar(pasta, raiz)
  assert.equal(v.ok, false)
  assert.ok(v.mensagens.some((m) => !m.ok && m.m.startsWith('ranking.csv')))
})

test('com aprovação e sanidade ok, o app recebe o ranking inteiro, as exclusões e o Top N; modo diário não grava pasta nova', () => {
  const raiz = raizTemporaria()
  const c = aprovado(cfg)
  concluir({ raiz, cfg: c, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-05', agora: new Date('2026-10-05T08:00:00Z') })
  const app = lerApp(raiz)
  assert.equal(app.publicado, true)
  assert.deepEqual(app.ranking.map((x) => x.ticker), ['AAAA3', 'BBBB3', 'CCCC3'])
  assert.equal(app.tamanhoDaLista, 2)
  assert.equal(app.exclusoes.length, 1)
  assert.equal(app.modoAuditoria, 'completa')
  const r2 = concluir({ raiz, cfg: c, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-06', agora: new Date('2026-10-06T08:00:00Z') })
  assert.equal(r2.modo, 'diaria')
  assert.deepEqual(fs.readdirSync(path.join(raiz, 'auditoria', 'acoes-dividendos')).sort(), ['2026-10-05', 'ultima.json'])
  const app2 = lerApp(raiz)
  assert.equal(app2.modoAuditoria, 'diaria')
  assert.equal(app2.auditoriaCompletaEm, '2026-10-05')
  assert.equal(app2.pastaAuditoria, 'auditoria/acoes-dividendos/2026-10-05')
  const r3 = concluir({ raiz, cfg: c, insumos: insumosBons(), log: silencio, dataExecucao: '2026-11-02', agora: new Date('2026-11-02T08:00:00Z') })
  assert.equal(r3.modo, 'completa', 'primeira execução do mês volta a gravar a pasta')
})

test('mudou o parâmetro: volta a gravar a auditoria completa mesmo no mesmo mês', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, cfg, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-05' })
  const r = concluir({ raiz, cfg: { ...cfg, alertaDyAcimaDe: 0.5 }, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-06' })
  assert.equal(r.modo, 'completa')
})

test('trava de sanidade barra a publicação: erro, app intacto, auditoria completa gravada para diagnóstico', () => {
  const raiz = raizTemporaria()
  const c = aprovado({ ...cfg, publicacao: { ...cfg.publicacao, sanidade: { ...cfg.publicacao.sanidade, minimoComProventos: 10 } } })
  assert.throws(() => concluir({ raiz, cfg: c, insumos: insumosBons(), log: silencio, dataExecucao: '2026-10-25' }), /Publicação barrada pela trava de sanidade/)
  assert.ok(fs.existsSync(path.join(raiz, 'auditoria', 'acoes-dividendos', '2026-10-25', 'manifesto.json')))
  assert.ok(!fs.existsSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesDividendos.json')))
})

test('montarSnapshotApp e csvRanking: sem aprovação vai só o cabeçalho; o CSV leva vírgula decimal', () => {
  const x = rodar([emp('AAAA3', { eventos: [ev('2026-08-21', 0.5)] })])
  const manifesto = { geradoEm: '2026-10-25T08:00:00Z', hashes: { resultado: 'r', insumos: 'i', config: 'c' } }
  const fechado = montarSnapshotApp({ resultado: x.resultado, cfg, manifesto, pasta: 'auditoria/acoes-dividendos/2026-10-25', publicado: false, dataExecucao: '2026-10-25', modo: 'completa' })
  assert.deepEqual([fechado.ranking, fechado.exclusoes, fechado.etapas], [[], [], []])
  assert.equal(fechado.parametros.janelaInicio, '2025-10-22')
  const aberto = montarSnapshotApp({ resultado: x.resultado, cfg, manifesto, pasta: 'auditoria/acoes-dividendos/2026-10-25', publicado: true, dataExecucao: '2026-10-25', modo: 'completa' })
  assert.equal(aberto.ranking.length, 1)
  assert.equal(aberto.aviso, cfg.publicacao.avisoProposto)
  assert.match(csvRanking(x.resultado.ranking), /AAAA3[^\r]*;0,05;/)
})

test('config: parâmetros coerentes com o que o app e a documentação dizem', () => {
  assert.equal(cfgArquivo.tamanhoDaLista, 15)
  assert.ok(cfgArquivo.rankingAteOnde > cfgArquivo.tamanhoDaLista)
  assert.deepEqual(cfgArquivo.tiposQueEntram, ['DIVIDENDO', 'JRS CAP PROPRIO', 'RENDIMENTO'])
  assert.ok(!cfgArquivo.tiposQueEntram.includes('REST CAP DIN'))
  assert.equal(typeof cfgArquivo.publicacao.aprovadoPeloResponsavel, 'boolean')
  assert.match(cfgArquivo.publicacao.avisoProposto, /Não é recomendação de investimento/)
  assert.match(cfgArquivo.publicacao.avisoProposto, /Rentabilidade passada não garante rentabilidade futura/)
})
