// Radar de dividendos (D130): leitor do cadastro, filtro do que ainda vai ser pago, montagem e trava. Sem rede.

import assert from 'node:assert/strict'
import test from 'node:test'
import { lerPagamentos, montarRadar, pagamentosAnunciados, verificarSanidadeRadar } from './radar-dividendos-calculo.mjs'
import { empresasDoCadastro, gerarRadar, hojeEmBrasilia } from './atualizar-radar-dividendos.mjs'

const linha = (o = {}) => ({ assetIssued: 'BRPETRACNOR9', isinCode: 'BRPETRACNOR9', paymentDate: '21/12/2026', rate: '0,47156696000', relatedTo: 'Anual/2026', approvedOn: '06/08/2026', label: 'DIVIDENDO', lastDatePrior: '21/08/2026', ...o })
const cadastro = (cash) => [{ tradingName: 'PETROBRAS', cashDividends: cash }]

test('lerPagamentos: valor, datas, tipo, classe pelo ISIN e data de pagamento', () => {
  const r = lerPagamentos(cadastro([linha()]))
  assert.equal(r.nomeDePregao, 'PETROBRAS')
  assert.deepEqual(r.eventos[0], { classe: 'ON', tipo: 'DIVIDENDO', valor: 0.47156696, dataCom: '2026-08-21', pagamentoEm: '2026-12-21', aprovadoEm: '2026-08-06', referencia: 'Anual/2026' })
})

test('lerPagamentos: sem data de pagamento fica null; código desconhecido devolve null', () => {
  assert.equal(lerPagamentos(cadastro([linha({ paymentDate: '' })])).eventos[0].pagamentoEm, null)
  assert.equal(lerPagamentos([]), null)
  assert.equal(lerPagamentos({}), null)
})

test('lerPagamentos: erra em vez de adivinhar quando o formato muda', () => {
  assert.throws(() => lerPagamentos([{ nome: 'x' }]), /formato mudou/)
  assert.throws(() => lerPagamentos(cadastro([linha({ rate: 'abc' })])), /valor ilegível/)
  assert.throws(() => lerPagamentos(cadastro([linha({ lastDatePrior: '2026-08-21' })])), /data com ilegível/)
  assert.throws(() => lerPagamentos(cadastro([linha({ paymentDate: '31-12' })])), /pagamento ilegível/)
})

test('pagamentosAnunciados: só o que ainda será pago, da classe do código e dos tipos do radar', () => {
  const ev = lerPagamentos(cadastro([
    linha({ paymentDate: '21/12/2026' }),
    linha({ paymentDate: '23/11/2026', label: 'JRS CAP PROPRIO' }),
    linha({ paymentDate: '15/10/2026' }), // já pago
    linha({ paymentDate: '29/10/2026' }), // paga hoje: ainda conta
    linha({ paymentDate: '21/12/2026', label: 'REST CAP DIN' }), // devolução de capital
    linha({ paymentDate: '21/12/2026', isinCode: 'BRBBASA04OR4' }), // série que repete o provento
    linha({ paymentDate: '21/12/2026', isinCode: 'BRPETRACNPR7' }), // PN, e o código é PETR3 (ON)
  ])).eventos
  const r = pagamentosAnunciados(ev, 'PETR3', '2026-10-29')
  assert.deepEqual(r.map((p) => [p.tipo, p.pagamentoEm]), [['DIVIDENDO', '2026-12-21'], ['JRS CAP PROPRIO', '2026-11-23'], ['DIVIDENDO', '2026-10-29']])
})

test('pagamentosAnunciados: sem data de pagamento (vazia ou 31/12/9999) fica no grupo à parte; parcelas iguais ficam todas', () => {
  const ev = lerPagamentos(cadastro([
    linha({ paymentDate: '', lastDatePrior: '05/11/2026' }),
    linha({ paymentDate: '31/12/9999' }),
    linha({ paymentDate: '10/12/2026' }),
    linha({ paymentDate: '10/12/2026' }),
    linha({ paymentDate: '10/01/2026' }), // já pago
  ])).eventos
  assert.equal(ev[1].pagamentoEm, null)
  assert.equal(pagamentosAnunciados(ev, 'PETR3', '2026-10-29').length, 4)
})

test('montarRadar: ordena por data de pagamento, depois ticker; mês vem do pagamento', () => {
  const emp = (ticker, cash) => ({ ticker, nome: ticker, setor: 'X', eventos: lerPagamentos(cadastro(cash)).eventos })
  const radar = montarRadar({
    hoje: '2026-10-29',
    falhas: ['ZZZZ3'],
    empresas: [
      emp('PETR3', [linha({ paymentDate: '21/12/2026' }), linha({ paymentDate: '23/11/2026' })]),
      emp('AAAA3', [linha({ paymentDate: '23/11/2026', isinCode: 'BRAAAAACNOR1' }), linha({ paymentDate: '', lastDatePrior: '10/11/2026', isinCode: 'BRAAAAACNOR1' })]),
      emp('BBBB3', []),
    ],
  })
  assert.deepEqual(radar.pagamentos.map((p) => [p.ticker, p.pagamentoEm, p.mes]), [['AAAA3', '2026-11-23', '2026-11'], ['PETR3', '2026-11-23', '2026-11'], ['PETR3', '2026-12-21', '2026-12'], ['AAAA3', null, null]])
  assert.equal(radar.comPagamento, 2)
  assert.equal(radar.consultadas, 4)
  assert.deepEqual(radar.falhas, ['ZZZZ3'])
})

test('verificarSanidadeRadar: poucas empresas ou muitas falhas travam a publicação', () => {
  assert.deepEqual(verificarSanidadeRadar({ consultadas: 100, falhas: ['A'] }), [])
  assert.equal(verificarSanidadeRadar({ consultadas: 10, falhas: [] }).length, 1)
  assert.equal(verificarSanidadeRadar({ consultadas: 100, falhas: new Array(40).fill('A') }).length, 1)
})

test('hojeEmBrasilia: de madrugada em UTC ainda é o dia anterior', () => {
  assert.equal(hojeEmBrasilia(new Date('2026-10-29T02:00:00Z')), '2026-10-28')
  assert.equal(hojeEmBrasilia(new Date('2026-10-29T12:00:00Z')), '2026-10-29')
})

test('empresasDoCadastro + gerarRadar: uma chamada por código e falha isolada não derruba', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-'))
  fs.mkdirSync(path.join(raiz, 'config'))
  fs.writeFileSync(path.join(raiz, 'config', 'acoes.json'), JSON.stringify({ setores: [{ setor: 'S', empresas: [{ ticker: 'PETR4', nome: 'Petrobras' }, { ticker: 'ERRO3' }, { ticker: 'VAZI3' }] }] }))
  assert.equal(empresasDoCadastro(JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'acoes.json'), 'utf8'))).length, 3)
  const chamadas = []
  const fetchImpl = async (url) => {
    chamadas.push(url)
    const cod = JSON.parse(Buffer.from(decodeURIComponent(url.split('/').pop()), 'base64').toString()).issuingCompany
    if (cod === 'ERRO') return { ok: false, status: 500, text: async () => '' }
    if (cod === 'VAZI') return { ok: true, text: async () => '' }
    return { ok: true, text: async () => JSON.stringify(cadastro([linha({ isinCode: 'BRPETRACNPR7' })])) }
  }
  const radar = await gerarRadar({ raiz, fetchImpl, hoje: '2026-10-29', pausaEntreChamadasMs: 0, log: () => {} })
  assert.equal(radar.pagamentos.length, 1)
  assert.equal(radar.pagamentos[0].ticker, 'PETR4')
  assert.deepEqual(radar.falhas, ['ERRO3', 'VAZI3'])
  assert.equal(chamadas.length, 3 + 2) // ERRO3 tenta 3 vezes (1 + 2 repetições)
})
