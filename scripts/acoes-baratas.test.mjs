import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  calcular, calcularFundamentos, canonico, diasEntre, diaAnterior, hashDoResultado, ltmDaConta, percentilPosto, quantil,
  ranksPercentuais, valorDeMercado, volatilidadeAnualizada, zscoresWinsorizados, CONTAS,
} from './acoes-baratas-calculo.mjs'
import { dividirLinha, extrairZip, fatorEscala, indiceDasColunas, mapaTickerCnpj, numeroCvm, resolverCnpjs } from './acoes-baratas-cvm.mjs'
import { agruparPorCnpj, concluir, csvRanking, extrairPreco, mesclarDesdobramentos, montarInsumos, montarSnapshotApp, separarSnapshot, verificar, verificarSanidade } from './atualizar-acoes-baratas.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const FIX = path.join(AQUI, 'fixtures', 'cvm')
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'acoes-baratas.json'), 'utf8'))
const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`)

// ---------------------------------------------------------------------------------------
// Utilidades numéricas
// ---------------------------------------------------------------------------------------

test('datas: diferença em dias e dia anterior', () => {
  assert.equal(diasEntre('2025-01-01', '2025-12-31'), 364)
  assert.equal(diasEntre('2026-06-30', '2026-09-30'), 92)
  assert.equal(diaAnterior('2026-01-01'), '2025-12-31')
  assert.equal(diaAnterior('2024-03-01'), '2024-02-29')
})

test('ranks percentuais: maior valor = 1, menor = 0, empates recebem a média', () => {
  assert.deepEqual(ranksPercentuais([10, 30, 20]), [0, 1, 0.5])
  assert.deepEqual(ranksPercentuais([5, 5, 9]), [0.25, 0.25, 1])
  assert.deepEqual(ranksPercentuais([7]), [1])
  assert.deepEqual(ranksPercentuais([]), [])
})

test('quantil (interpolação linear) e percentil por posto', () => {
  perto(quantil([1, 2, 3, 4, 5], 0.5), 3)
  perto(quantil([1, 2, 3, 4], 0.5), 2.5)
  perto(quantil([10, 20], 0.01), 10.1)
  assert.equal(percentilPosto([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9)
  assert.equal(percentilPosto([5], 0.9), 5)
})

test('z-score winsorizado: outlier extremo é cortado antes da padronização', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000]
  const z = zscoresWinsorizados(v, 0.1, 0.9)
  const bruto = zscoresWinsorizados(v, 0, 1)
  assert.ok(z[9] < bruto[9], 'cortado, o outlier pesa menos que sem winsorização')
  perto(z.reduce((s, x) => s + x, 0), 0, 1e-9)
  const teto = quantil(v, 0.9)
  const piso = quantil(v, 0.1)
  const cortados = v.map((x) => Math.min(teto, Math.max(piso, x)))
  const media = cortados.reduce((a, b) => a + b, 0) / 10
  const dp = Math.sqrt(cortados.reduce((a, b) => a + (b - media) ** 2, 0) / 10)
  perto(z[9], (teto - media) / dp)
  assert.deepEqual(zscoresWinsorizados([4, 4, 4], 0.01, 0.99), [0, 0, 0])
})

test('volatilidade anualizada: série constante = 0; alternância ±1% bate com a conta manual', () => {
  assert.equal(volatilidadeAnualizada([10, 10, 10, 10]).volatilidade, 0)
  const s = [100]
  for (let i = 1; i <= 100; i++) s.push(s[i - 1] * (i % 2 ? 1.01 : 1 / 1.01))
  const { volatilidade, retornos } = volatilidadeAnualizada(s)
  assert.equal(retornos, 100)
  const r = Math.log(1.01)
  // retornos alternam +r e −r (média 0): desvio amostral = r·sqrt(100/99)
  perto(volatilidade, r * Math.sqrt(100 / 99) * Math.sqrt(252), 1e-9)
})

// ---------------------------------------------------------------------------------------
// Leitura de CSV da CVM
// ---------------------------------------------------------------------------------------

test('CSV: divisão com aspas, números e escala', () => {
  assert.deepEqual(dividirLinha('a;"b;c";d'), ['a', 'b;c', 'd'])
  assert.equal(numeroCvm('1234.50'), 1234.5)
  assert.equal(numeroCvm('1.234,50'), 1234.5)
  assert.equal(numeroCvm(''), null)
  assert.equal(fatorEscala('MIL'), 1000)
  assert.equal(fatorEscala('UNIDADE'), 1)
  assert.throws(() => fatorEscala('MILHÃO'), /desconhecida/)
})

test('CSV: cabeçalho fora do esperado FALHA com mensagem clara (nunca em silêncio)', () => {
  assert.throws(() => indiceDasColunas('A;B;C', { x: 'CD_CONTA' }, 'arq.csv'), /Layout inesperado em arq\.csv: faltam as colunas x/)
  const i = indiceDasColunas('\uFEFFCNPJ_CIA;VL_CONTA', { c: 'cnpj_cia', v: /^VL_/ }, 'a')
  assert.deepEqual(i, { c: 0, v: 1 })
})

// ---------------------------------------------------------------------------------------
// Cenário ALFA, calculado à mão (R$ milhões → ver scripts/fixtures/gerar-fixtures-cvm.py)
//   LTM = DFP 2025 + ITR 1S26 acumulado − ITR 1S25 acumulado
//   EBIT 1.500+900−700=1.700 · equiv. 200+120−90=230 · outras rec. 100+60−40=120 · outras desp. −50−30+20=−60
//   EBIT ajustado = 1.700 − 230 − (120 − 60) = 1.410 · FCO 1.400+800−650=1.550 · D&A 400+210−190=420
//   caixa 1.000+500 · dívida 700+3.300 → DL 2.500 · PL 9.000 · minoritários 400 → PL ctrl 8.600
//   valor de mercado = 490M ON × R$ 8 + 500M PN × R$ 7 = 7.420 · EV = 7.420 + 2.500 + 400 = 10.320
// ---------------------------------------------------------------------------------------

const CNPJ_ALFA = '11.111.111/0001-11'
const precoAlfa = {
  ref: { ticker: 'ALFA4', fechamento: 7, data: '2026-09-30' },
  classes: [{ classe: 'ON', ticker: 'ALFA3', fechamento: 8, data: '2026-09-30' }, { classe: 'PN', ticker: 'ALFA4', fechamento: 7, data: '2026-09-30' }],
}

async function contabilAlfa() {
  const cnpjs = new Set(['11111111000111'])
  const dfp = await extrairZip(path.join(FIX, 'dfp_cia_aberta_2025.zip'), 'DFP', cnpjs)
  const itr = await extrairZip(path.join(FIX, 'itr_cia_aberta_2026.zip'), 'ITR', cnpjs)
  const historicas = []
  for (const ano of [2021, 2022, 2023, 2024]) historicas.push(await extrairZip(path.join(FIX, `dfp_cia_aberta_${ano}.zip`), 'DFP', cnpjs, { somenteHistorico: true }))
  return { dfp, itr, historicas, contabil: agruparPorCnpj([dfp, itr, ...historicas]).get('11111111000111') }
}

test('extração: pega só a versão vigente, só a empresa pedida, descarta moeda estrangeira', async () => {
  const { dfp, itr } = await contabilAlfa()
  assert.equal(dfp.docs.length, 1)
  assert.equal(dfp.docs[0].versao, 2, 'a versão 1 foi reapresentada')
  assert.ok(!dfp.linhas.some((l) => l.cd === '3.05' && l.valor === 9999e3 * 1000), 'valor da versão antiga não pode entrar')
  assert.ok(dfp.linhas.every((l) => l.cnpj === '11111111000111'))
  assert.equal(dfp.estatisticas.moedaDiferente, 1)
  const ebitDfp = dfp.linhas.filter((l) => l.dem === 'DRE' && l.cd === '3.05')
  assert.deepEqual(ebitDfp.map((l) => [l.cons, l.valor]).sort(), [['con', 1.5e9], ['ind', 777e6]])
  assert.equal(itr.docs.length, 2)
  assert.equal(itr.capital.length, 1)
  assert.equal(itr.linhas.find((l) => l.dem === 'DFC' && l.ordem === 'ULTIMO').valor, 800e6, 'escala MIL aplicada')
  assert.equal(itr.linhas.find((l) => l.dem === 'BPP' && l.cd === '2.03').ds, 'Patrimônio Líquido Consolidado', 'ISO-8859-1 decodificado')
})

test('extração histórica: só lucro e FCO, só a coluna ÚLTIMO (o comparativo reapresentado é ignorado)', async () => {
  const { historicas } = await contabilAlfa()
  const h = historicas[0] // exercício 2021
  assert.deepEqual([...new Set(h.linhas.map((l) => `${l.dem}|${l.cd}`))].sort(), ['DFC|6.01', 'DRE|3.11', 'DRE|3.11.01'])
  assert.ok(h.linhas.every((l) => l.ordem === 'ULTIMO'))
  assert.ok(!h.linhas.some((l) => l.valor === 99999e3), 'comparativo PENÚLTIMO não pode entrar')
})

test('LTM: ITR usa exercício anterior + acumulado − acumulado do ano anterior (ignora o trimestre isolado)', async () => {
  const { contabil } = await contabilAlfa()
  const ultimo = { doc: 'ITR', dtRefer: '2026-06-30' }
  const ebit = ltmDaConta(contabil.linhas, ultimo, 'con', CONTAS.ebit)
  assert.equal(ebit.valor, 1700e6)
  assert.equal(ebit.componentes.length, 3)
  assert.deepEqual(ebit.componentes.map((c) => c.papel), ['exercicio_anterior (+)', 'acumulado_atual (+)', 'acumulado_ano_anterior (−)'])
  assert.match(ebit.formula, /2025-12-31 \+ acumulado 2026-01-01→2026-06-30 − acumulado 2025-01-01→2025-06-30/)
  assert.equal(ltmDaConta(contabil.linhas, ultimo, 'con', CONTAS.fco).valor, 1550e6)
  // A DVA da CVM traz a depreciação NEGATIVA: −400 + (−210) − (−190) = −420. O cálculo usa o valor absoluto.
  assert.equal(ltmDaConta(contabil.linhas, ultimo, 'con', CONTAS.depreciacao).valor, -420e6)
  // último documento = DFP → o próprio exercício
  assert.equal(ltmDaConta(contabil.linhas, { doc: 'DFP', dtRefer: '2025-12-31' }, 'con', CONTAS.ebit).valor, 1500e6)
})

test('LTM: falta de dado obrigatório vira erro explícito; conta opcional ausente vale zero', async () => {
  const { contabil } = await contabilAlfa()
  const semDfp = contabil.linhas.filter((l) => l.doc !== 'DFP')
  const r = ltmDaConta(semDfp, { doc: 'ITR', dtRefer: '2026-06-30' }, 'con', CONTAS.ebit)
  assert.match(r.erro, /falta a DFP do exercício encerrado em 2025-12-31/)
  const opc = ltmDaConta(contabil.linhas, { doc: 'DFP', dtRefer: '2025-12-31' }, 'con', CONTAS.recuperabilidade)
  assert.equal(opc.valor, 0)
})

test('indicadores da ALFA batem com a conta feita à mão', async () => {
  const { contabil } = await contabilAlfa()
  const emp = { ticker: 'ALFA4', contabil }
  const r = calcularFundamentos(emp, precoAlfa, cfg, '2026-09-30')
  assert.ok(!r.excluida, JSON.stringify(r.excluida))
  const m = r.metricas
  assert.equal(m.mktcap, 7420e6)
  assert.equal(m.ev, 10320e6)
  assert.equal(m.ebitAjustado, 1410e6)
  assert.equal(m.fcoLtm, 1550e6)
  assert.equal(m.lucroLtm, 1060e6, 'lucro CONSOLIDADO (3.11): 900+560−400')
  assert.equal(m.plControladores, 8600e6)
  perto(m.plSobreValorDeMercado, 8600 / 7420)
  perto(m.fcoSobreEv, 1550 / 10320)
  perto(m.ebitAjustadoSobreEv, 1410 / 10320)
  perto(m.pvp, 7420 / 8600, 1e-4)
  perto(m.roic, (1410 * 0.66) / 11500, 1e-5)
  perto(m.dlEbitda, 2500 / 1830, 1e-4)
  assert.deepEqual([m.passaRoic, m.passaDlEbitda, m.passaFco], [false, true, true])
  // cobertura de juros: despesas financeiras 12m = −400 + (−200) − (−180) = −420 → 1.410 ÷ 420
  perto(m.coberturaJuros, 1410 / 420, 1e-4)
  assert.equal(r.memoria.indicadores.coberturaJuros.despesaFinanceira, 420e6)
  assert.equal(m.passaCobertura, true)
  // consistência: lucro dos controladores 2021..2025 = 700, −150, 800, 820, 850 (4 de 5); FCO sempre positivo (5 de 5)
  assert.deepEqual([m.exerciciosAnalisados, m.exerciciosComLucro, m.exerciciosComFco, m.passaConsistencia], [5, 4, 5, true])
  assert.deepEqual(r.memoria.consistencia.exercicios.map((e) => [e.exercicio.slice(0, 4), e.lucro]), [['2025', 900e6], ['2024', 870e6], ['2023', 850e6], ['2022', -100e6], ['2021', 750e6]])
  assert.deepEqual(r.memoria.consistencia.exercicios.map((e) => e.lucroControladores), [850e6, 820e6, 800e6, -150e6, 700e6], 'o dos controladores fica registrado, como informação')
  assert.equal(r.memoria.demonstracao.consolidacao, 'consolidada')
  assert.equal(r.memoria.demonstracao.linkDoc, 'https://exemplo.cvm/doc?id=3002')
  assert.equal(r.memoria.valorDeMercado.metodo, 'por_classe')
  assert.match(r.memoria.derivados.ebitAjustado.formula, /EBIT \(3\.05\) − equivalência patrimonial \(3\.04\.06\)/)
  assert.ok(r.memoria.fluxos12m.ebit.componentes.every((c) => c.linkDoc), 'cada componente aponta o documento de origem')
})

test('valor de mercado: classe sem preço usa o da OUTRA classe e é marcada como aproximada', () => {
  const cap = { ordinarias: 100, preferenciais: 100, tesouroOrd: 0, tesouroPref: 0 }
  const r = valorDeMercado(cap, { ref: { ticker: 'XXXX4', fechamento: 10, data: 'd' }, classes: [{ classe: 'PN', ticker: 'XXXX4', fechamento: 10, data: 'd' }] })
  assert.equal(r.valor, 2000)
  assert.equal(r.metodo, 'preco_da_outra_classe')
  assert.equal(r.fracaoAproximada, 0.5)
  const on = r.classes.find((c) => c.classe === 'ON')
  assert.deepEqual([on.aproximado, on.origemPreco, on.ticker], [true, 'outra_classe', 'XXXX4'])
  assert.match(valorDeMercado({ ordinarias: 1, preferenciais: 0, tesouroOrd: 5, tesouroPref: 0 }, precoAlfa).erro, /tesouraria/)
})

test('UNIT (final 11) nunca é preço de classe: a Taesa tinha a PN a R$ 42,85 (preço da unit) contra a ON a R$ 14,03', () => {
  const cap = { ordinarias: 590, preferenciais: 443, tesouroOrd: 0, tesouroPref: 0 }
  // Antes do conserto, TAEE11 entrava como "PN" e valia 443 × 42,85. Agora a PN é avaliada pelo preço da PN (TAEE4).
  const certo = valorDeMercado(cap, { ref: { ticker: 'TAEE11', fechamento: 42.85, data: 'd' }, classes: [{ classe: 'ON', ticker: 'TAEE3', fechamento: 14.03, data: 'd' }, { classe: 'PN', ticker: 'TAEE4', fechamento: 14.2, data: 'd' }] })
  assert.equal(certo.metodo, 'por_classe')
  perto(certo.valor, 590 * 14.03 + 443 * 14.2)
  // se a PN não negociou, vale o preço da ON (aproximado); nunca o da unit
  const semPn = valorDeMercado(cap, { ref: { ticker: 'TAEE11', fechamento: 42.85, data: 'd' }, classes: [{ classe: 'ON', ticker: 'TAEE3', fechamento: 14.03, data: 'd' }] })
  perto(semPn.valor, (590 + 443) * 14.03)
  assert.equal(semPn.classes.find((c) => c.classe === 'PN').origemPreco, 'outra_classe')
  // sem preço de NENHUMA classe e referência sendo unit: não há como avaliar
  const nada = valorDeMercado(cap, { ref: { ticker: 'TAEE11', fechamento: 42.85, data: 'd' }, classes: [] })
  assert.match(nada.erro, /TAEE11 é uma unit/)
  // referência que É classe (final 3 a 6) e é a única com preço: serve
  assert.equal(valorDeMercado(cap, { ref: { ticker: 'XXXX3', fechamento: 10, data: 'd' }, classes: [] }).classes.every((c) => c.origemPreco === 'referencia'), true)
})

test('extração de preço: a unit conta no volume do emissor, mas não vira classe', () => {
  const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const v = (p, vol) => [p, p, p, vol]
  const historico = { pregoes: dias, ativos: {
    SAPR3: dias.map(() => v(14, 1_000_000)), SAPR4: dias.map(() => v(11, 2_000_000)), SAPR11: dias.map(() => v(52, 20_000_000)) } }
  const c = { ...cfg, filtros: { ...cfg.filtros, sessoesLiquidez: 10 } }
  const p = extrairPreco(historico, 'SAPR11', { desdobramentos: {} }, c)
  assert.deepEqual(p.classes.map((x) => [x.classe, x.ticker, x.fechamento]), [['ON', 'SAPR3', 14], ['PN', 'SAPR4', 11]], 'SAPR11 não é classe')
  assert.equal(p.ref.ticker, 'SAPR11')
  assert.equal(p.volumeMedioEmissor, 23_000_000, 'volume = ON + PN + unit (a unit é onde está a liquidez)')
})

test('mapeamento ticker → CNPJ: FCA vigente, correção manual e ambiguidade', async () => {
  const mapa = await mapaTickerCnpj(path.join(FIX, 'fca_cia_aberta_2026.zip'))
  const r = Object.fromEntries(resolverCnpjs(['ALFA3', 'ALFA4', 'GAMA3', 'AMBI3', 'ZZZZ3', 'BETA3'], mapa, { BETA3: '99999999000199' }).map((x) => [x.ticker, x]))
  assert.equal(r.ALFA3.cnpj, CNPJ_ALFA)
  assert.equal(r.ALFA4.origem, 'FCA (vigente)')
  assert.equal(r.GAMA3.cnpj, '44.444.444/0001-44', 'o CNPJ com negociação encerrada perde')
  assert.equal(r.AMBI3.cnpj, null)
  assert.match(r.AMBI3.origem, /ambíguo/)
  assert.equal(r.ZZZZ3.cnpj, null)
  assert.equal(r.BETA3.cnpj, '99.999.999/0001-99', 'correção manual vence o FCA')
})

// ---------------------------------------------------------------------------------------
// Universo sintético: filtros, ranking, determinismo
// ---------------------------------------------------------------------------------------

/** Empresa com DFP de 2025 e números controlados (R$). */
function fabricar(ticker, o = {}) {
  const R = '2025-12-31'
  const cfgLinha = (dem, cd, ds, valor) => ({ doc: 'DFP', dtRefer: R, versao: 1, dem, cons: 'con', ordem: 'ULTIMO', dtIni: dem === 'BPA' || dem === 'BPP' ? null : '2025-01-01', dtFim: R, cd, ds, valor, linkDoc: `https://exemplo/${ticker}` })
  const ebit = o.ebit ?? 100, fco = o.fco ?? 90, pl = o.pl ?? 800, lucro = o.lucro ?? 60
  const linhas = [
    ...(o.despFin === undefined ? [] : [cfgLinha('DRE', '3.06.02', 'Despesas Financeiras', o.despFin)]),
    ...(o.da === undefined ? [] : [cfgLinha('DVA', '7.04.01', 'Depreciação, Amortização e Exaustão', o.da)]),
    cfgLinha('DRE', '3.01', 'Receita', 1000), cfgLinha('DRE', '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', ebit),
    cfgLinha('DRE', '3.11', 'Lucro/Prejuízo do Período', lucro), cfgLinha('DFC', '6.01', 'Caixa Líquido das Atividades Operacionais', fco),
    cfgLinha('BPA', '1', 'Ativo Total', o.ativo ?? 2000), cfgLinha('BPA', '1.01.01', 'Caixa e Equivalentes de Caixa', 100),
    cfgLinha('BPP', '2', 'Passivo Total', 2000), cfgLinha('BPP', '2.03', 'Patrimônio Líquido', pl),
    cfgLinha('BPP', '2.01.04', 'Empréstimos e Financiamentos', 50), cfgLinha('BPP', '2.02.01', 'Empréstimos e Financiamentos', 150),
  ]
  // Exercícios anteriores (padrão: 5 no total, todos com lucro e FCO positivos). `lucros`/`fcos` listam do mais antigo ao mais recente anterior.
  const docs = [{ doc: 'DFP', dtRefer: R, versao: 1, dtReceb: '2026-03-01', linkDoc: `https://exemplo/${ticker}` }]
  const anteriores = o.lucros ?? [10, 10, 10, 10]
  anteriores.forEach((lucroAno, k) => {
    const ano = 2024 - (anteriores.length - 1 - k) - (o.buraco && k < o.buraco ? 1 : 0)
    const dt = `${ano}-12-31`
    docs.push({ doc: 'DFP', dtRefer: dt, versao: 1, dtReceb: `${ano + 1}-03-01`, linkDoc: `https://exemplo/${ticker}/${ano}` })
    for (const [dem, cd, ds, v] of [['DRE', '3.11', 'Lucro/Prejuízo do Período', lucroAno], ['DFC', '6.01', 'Caixa Líquido das Atividades Operacionais', (o.fcos ?? [])[k] ?? 20]]) {
      linhas.push({ doc: 'DFP', dtRefer: dt, versao: 1, dem, cons: 'con', ordem: 'ULTIMO', dtIni: `${ano}-01-01`, dtFim: dt, cd, ds, valor: v, linkDoc: null })
    }
  })
  const amp = o.amp ?? 0.01
  const serie = Array.from({ length: 200 }, (_, i) => 10 * (1 + amp * (i % 2 ? 1 : -1)))
  return {
    ticker, nome: `Empresa ${ticker}`, setor: o.setor ?? 'Mineração', cnpj: o.cnpj === null ? null : `00.000.000/${ticker.charCodeAt(0)}${ticker.charCodeAt(1)}-00`,
    preco: { ref: { ticker, fechamento: 10, data: '2026-09-30' }, classes: [{ classe: 'ON', ticker, fechamento: 10, data: '2026-09-30' }], volumeMedioEmissor: o.volume ?? 50e6, serieAjustada: serie, saltosNaoResolvidos: o.saltos ?? [] },
    contabil: { docs, linhas, capital: [{ doc: 'DFP', dtRefer: R, versao: 1, ordinarias: o.acoes ?? 100, preferenciais: 0, tesouroOrd: 0, tesouroPref: 0 }] },
  }
}
// DFP de 31/12/2025 fica "fresca" com corte em 31/03/2026 (90 dias; o limite é 200).
const insumosDe = (empresas, dataCorte = '2026-03-31') => ({ esquema: 1, dataCorte, dataPrecos: '2026-09-30', empresas })

test('ranking: nota = média dos ranks percentuais dos 3 rendimentos; ordem decrescente', () => {
  // mktcap = 100 ações × R$ 10 = 1.000 → EV = 1.000 + (200 − 100) = 1.100. PL/VM = PL/1.000.
  const A = fabricar('AAAA3', { pl: 900, fco: 150, ebit: 160 })   // melhor nos três
  const B = fabricar('BBBB3', { pl: 800, fco: 100, ebit: 110 })
  const C = fabricar('CCCC3', { pl: 700, fco: 50, ebit: 60 })
  const { resultado, memoria } = calcular(insumosDe([C, A, B]), cfg)
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['AAAA3', 'BBBB3', 'CCCC3'])
  assert.deepEqual(resultado.ranking.map((r) => r.nota), [1, 0.5, 0])
  perto(resultado.ranking[0].fcoSobreEv, 150 / 1100, 1e-6)
  perto(resultado.ranking[0].ebitAjustadoSobreEv, 160 / 1100, 1e-6)
  assert.deepEqual(memoria.BBBB3.ranking.ranksPercentuais, { plSobreValorDeMercado: 0.5, fcoSobreEv: 0.5, ebitAjustadoSobreEv: 0.5 })
  assert.equal(resultado.ranking[0].posicao, 1)
})

test('método z-score winsorizado também ordena corretamente (alternativa de composição)', () => {
  const cfgZ = { ...cfg, indicador: { ...cfg.indicador, metodoComposicao: 'zscore_winsorizado' } }
  const { resultado } = calcular(insumosDe([fabricar('CCCC3', { pl: 700, fco: 50, ebit: 60 }), fabricar('AAAA3', { pl: 900, fco: 150, ebit: 160 }), fabricar('BBBB3')]), cfgZ)
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['AAAA3', 'BBBB3', 'CCCC3'])
})

test('cada filtro exclui com etapa, código e motivo legíveis (nada some em silêncio)', () => {
  const base = ['AAAA3', 'BBBB3', 'CCCC3'].map((t, i) => fabricar(t, { pl: 900 - i * 100, fco: 150 - i * 50, ebit: 160 - i * 50 }))
  const ruins = [
    fabricar('BANC3', { setor: 'Bancos' }),
    fabricar('SEMC3', { cnpj: null }),
    fabricar('LIQD3', { volume: 2_999_999 }),
    fabricar('PREJ3', { lucro: -5 }),
    fabricar('BALA3', { ativo: 2300 }),
    fabricar('SALT3', { saltos: [{ data: '2026-05-04', de: 40, para: 10, fator: 4 }] }),
    fabricar('PLAU3', { acoes: 1e9 }),
    fabricar('EVNE3', { acoes: 1 }),
  ]
  const { resultado } = calcular(insumosDe([...base, ...ruins]), cfg)
  const por = Object.fromEntries(resultado.exclusoes.map((e) => [e.ticker, e]))
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['AAAA3', 'BBBB3', 'CCCC3'])
  assert.equal(por.BANC3.codigo, 'setor_excluido')
  assert.equal(por.SEMC3.codigo, 'sem_cnpj')
  assert.equal(por.LIQD3.codigo, 'liquidez_baixa')
  assert.equal(por.SALT3.codigo, 'salto_de_preco')
  assert.equal(por.BALA3.codigo, 'balanco_nao_fecha')
  assert.equal(por.PLAU3.codigo, 'capital_implausivel')
  assert.equal(por.PREJ3.codigo, 'prejuizo_12m')
  assert.ok(por.EVNE3, 'EV/valor de mercado minúsculo deve sair por alguma regra')
  for (const e of resultado.exclusoes) assert.ok(e.motivo.length > 10 && e.etapa, `${e.ticker} sem motivo`)
  assert.equal(resultado.universo, base.length + ruins.length)
  assert.equal(resultado.etapas[0].entram, resultado.universo)
  // contabilidade das etapas: o que sai de uma etapa não entra na seguinte
  for (let i = 1; i < resultado.etapas.length; i++) assert.equal(resultado.etapas[i].entram, resultado.etapas[i - 1].entram - resultado.etapas[i - 1].saem)
})

test('decil de maior volatilidade sai (10 empresas → a mais volátil)', () => {
  const emps = Array.from({ length: 10 }, (_, k) => fabricar(`V${String.fromCharCode(65 + k)}VV3`, { amp: 0.005 * (k + 1) }))
  const { resultado } = calcular(insumosDe(emps), cfg)
  const vol = resultado.exclusoes.filter((e) => e.etapa === 'volatilidade')
  assert.deepEqual(vol.map((e) => e.ticker), ['VJVV3'])
  assert.equal(vol[0].codigo, 'volatilidade_alta')
  assert.equal(resultado.ranking.length, 9)
})

test('demonstração defasada e histórico de preço curto saem com motivo', () => {
  const velha = fabricar('VELH3')
  velha.contabil.docs[0].dtRefer = '2025-12-31'
  const { resultado } = calcular(insumosDe([velha], '2026-09-30'), cfg) // 273 dias > 200
  assert.equal(resultado.exclusoes[0].codigo, 'demonstracao_defasada')
  assert.match(resultado.exclusoes[0].motivo, /273 dias/)
  const curta = fabricar('CURT3')
  curta.preco.serieAjustada = curta.preco.serieAjustada.slice(0, 50)
  assert.equal(calcular(insumosDe([curta]), cfg).resultado.exclusoes[0].codigo, 'historico_insuficiente')
})

test('filtros de qualidade: flags por empresa (ROIC, dívida líquida/EBITDA, FCO)', () => {
  const boa = fabricar('BOAA3', { ebit: 300, fco: 200 })
  const fcoNeg = fabricar('FCON3', { fco: -10 })
  const { resultado } = calcular(insumosDe([boa, fcoNeg]), cfg)
  const r = Object.fromEntries(resultado.ranking.map((x) => [x.ticker, x]))
  // capital investido = PL 800 + dívida 200 − caixa 100 = 900 → ROIC = 300·0,66/900 = 22%
  perto(r.BOAA3.roic, (300 * 0.66) / 900, 1e-5)
  assert.equal(r.BOAA3.passaRoic, true)
  assert.equal(r.FCON3.passaRoic, false) // 100·0,66/900 = 7,3% < 10%
  assert.equal(r.FCON3.passaFco, false)
  assert.equal(r.BOAA3.passaDlEbitda, false, 'sem DVA 7.04.01 não há EBITDA: o filtro reprova (conservador)')
  assert.equal(r.BOAA3.dlEbitda, null)
  assert.equal(r.BOAA3.passaConsistencia, true)
  assert.equal(r.BOAA3.passaCobertura, false, 'fixture sem 3.06.02')
})

test('cobertura de juros: sem despesa financeira passa; conta ausente reprova; EBIT baixo reprova', () => {
  const r = (o) => calcular(insumosDe([fabricar('COBE3', o)]), cfg).resultado.ranking[0]
  // EBIT ajustado 100: despesa 20 → 5,0x passa; despesa 50 → 2,0x reprova; despesa 0 → sem despesa passa
  const ok = r({ despFin: -20 })
  assert.equal(ok.coberturaJuros, 5)
  assert.equal(ok.passaCobertura, true)
  assert.equal(r({ despFin: -50 }).coberturaJuros, 2)
  assert.equal(r({ despFin: -50 }).passaCobertura, false)
  const zero = r({ despFin: 0 })
  assert.deepEqual([zero.coberturaJuros, zero.semDespesaFinanceira, zero.passaCobertura], [null, true, true])
  const ausente = r({})
  assert.deepEqual([ausente.coberturaJuros, ausente.semDespesaFinanceira, ausente.passaCobertura], [null, false, false], 'sem a conta 3.06.02 não dá para afirmar: reprova por cautela')
  assert.equal(r({ despFin: -10, ebit: -40 }).passaCobertura, false, 'EBIT ajustado negativo nunca passa')
  assert.equal(r({ despFin: -33.4 }).passaCobertura, false, '2,99x < 3,0x')
  assert.equal(r({ despFin: -33.3 }).passaCobertura, true, '3,003x ≥ 3,0x')
})

test('consistência de 5 exercícios: conta lucro e FCO positivos nos últimos 5 DFP consecutivos', () => {
  const r = (o) => calcular(insumosDe([fabricar('CONS3', o)]), cfg)
  // atual (lucro 60, FCO 90) + 4 anteriores positivos → 5 de 5
  const cheio = r({}).resultado.ranking[0]
  assert.deepEqual([cheio.exerciciosAnalisados, cheio.exerciciosComLucro, cheio.exerciciosComFco, cheio.passaConsistencia], [5, 5, 5, true])
  // um prejuízo em 5: 4 de 5 → passa; dois prejuízos: 3 de 5 → reprova
  assert.equal(r({ lucros: [10, -5, 10, 10] }).resultado.ranking[0].passaConsistencia, true)
  const dois = r({ lucros: [-1, -5, 10, 10] }).resultado.ranking[0]
  assert.deepEqual([dois.exerciciosComLucro, dois.passaConsistencia], [3, false])
  // FCO negativo em dois exercícios reprova mesmo com lucro
  const fco = r({ fcos: [-1, -1, 20, 20] }).resultado.ranking[0]
  assert.deepEqual([fco.exerciciosComLucro, fco.exerciciosComFco, fco.passaConsistencia], [5, 3, false])
  // menos de 5 exercícios (empresa nova): reprova por cautela, mas segue no ranking
  const nova = r({ lucros: [10, 10] }).resultado.ranking[0]
  assert.deepEqual([nova.exerciciosAnalisados, nova.passaConsistencia], [3, false])
  // buraco na série (falta o exercício de 2023): a cadeia para antes do buraco, não "pula" ano
  const furo = r({ buraco: 2 }).resultado.ranking[0]
  assert.ok(furo.exerciciosAnalisados < 5 && furo.passaConsistencia === false)
  // memória de cálculo lista cada exercício, com o link do documento
  const m = r({}).memoria.CONS3.consistencia
  assert.equal(m.exercicios.length, 5)
  assert.equal(m.exercicios[0].exercicio, '2025-12-31')
  assert.ok(m.exercicios.every((e) => e.linkDoc))
})

test('determinismo: ordem de entrada não altera o hash; qualquer mudança de insumo altera', () => {
  const emps = ['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3'].map((t, i) => fabricar(t, { pl: 900 - i * 50, fco: 150 - i * 20, ebit: 160 - i * 20 }))
  const h1 = hashDoResultado(calcular(insumosDe(emps), cfg).resultado)
  const h2 = hashDoResultado(calcular(insumosDe([...emps].reverse()), cfg).resultado)
  assert.equal(h1, h2)
  const alterado = JSON.parse(JSON.stringify(emps))
  alterado[0].contabil.linhas.find((l) => l.cd === '3.05').valor += 1
  assert.notEqual(hashDoResultado(calcular(insumosDe(alterado), cfg).resultado), h1)
  assert.equal(canonico({ b: 1, a: [2, { d: 1, c: 2 }] }), canonico({ a: [2, { c: 2, d: 1 }], b: 1 }))
})

// ---------------------------------------------------------------------------------------
// Preços a partir do histórico da B3
// ---------------------------------------------------------------------------------------

test('preço: classes pelo prefixo, liquidez do emissor soma as classes, desdobramento ajusta a série', () => {
  const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const v = (p, vol) => [p, p, p, vol]
  const historico = {
    pregoes: dias,
    ativos: {
      ALFA3: dias.map(() => v(8, 1_000_000)),
      ALFA4: dias.map((_, i) => (i === 29 ? null : v(7, 2_000_000))),
      ALFA11: dias.map(() => v(30, 9e9)), // unit: fora
      ZETA3: dias.map((_, i) => v(i < 15 ? 40 : 10, 5_000_000)),
    },
  }
  const c = { ...cfg, filtros: { ...cfg.filtros, sessoesLiquidez: 10 } }
  const p = extrairPreco(historico, 'ALFA4', { desdobramentos: {} }, c)
  assert.equal(p.ref.fechamento, 7)
  assert.equal(p.ref.data, '2026-09-29')
  assert.deepEqual(p.classes.map((x) => [x.classe, x.ticker, x.fechamento]), [['ON', 'ALFA3', 8], ['PN', 'ALFA4', 7]])
  // últimos 10 pregões: ALFA3 10×1M; ALFA4 9×2M (um dia sem negócio) → 28M / 10
  assert.equal(p.volumeMedioEmissor, 2_800_000)
  const z = extrairPreco(historico, 'ZETA3', { desdobramentos: {} }, c)
  assert.equal(z.saltosNaoResolvidos.length, 1, 'queda de 75% sem evento confirmado')
  const z2 = extrairPreco(historico, 'ZETA3', { desdobramentos: { ZETA3: [{ data: '2026-09-16', fator: 4 }] } }, c)
  assert.equal(z2.saltosNaoResolvidos.length, 0, 'com o desdobramento 4:1 confirmado a série fica contínua')
  assert.ok(z2.serieAjustada.every((x) => Math.abs(x - 10) < 1e-9))
  assert.equal(extrairPreco(historico, 'NADA3', { desdobramentos: {} }, c).ref, null)
})

// ---------------------------------------------------------------------------------------
// Auditoria ponta a ponta: grava, verifica, detecta adulteração
// ---------------------------------------------------------------------------------------

function raizTemporaria() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-teste-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['acoes-baratas-calculo.mjs', 'acoes-baratas-cvm.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  return raiz
}

test('auditoria: gera a pasta, a verificação refaz o cálculo e confere; adulterar um byte é detectado', () => {
  const raiz = raizTemporaria()
  const emps = ['AAAA3', 'BBBB3', 'CCCC3'].map((t, i) => fabricar(t, { pl: 900 - i * 100, fco: 150 - i * 50, ebit: 160 - i * 50 }))
  const empresas = emps.map((e) => ({ ticker: e.ticker, nome: e.nome, setor: e.setor }))
  const mapeamento = emps.map((e) => ({ ticker: e.ticker, cnpj: e.cnpj, origem: 'teste' }))
  const insumos = insumosDe(emps)
  const logs = []
  const cfgTravado = { ...cfg, publicacao: { ...cfg.publicacao, aprovadoPeloResponsavel: false } }
  const r = concluir({ raiz, cfg: cfgTravado, empresas, mapeamento, insumos, log: (m) => logs.push(m), agora: new Date('2026-10-04T12:00:00Z') })
  assert.equal(r.publicado, false, 'sem aprovação do responsável, nada é publicado no app')

  const pasta = path.join(raiz, 'auditoria', 'acoes-baratas', '2026-09-30')
  for (const a of ['manifesto.json', 'insumos.json.gz', 'config.json', 'resultado.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'exclusoes.csv', 'mapeamento-ticker-cnpj.csv', 'LEIA-ME.md']) assert.ok(fs.existsSync(path.join(pasta, a)), a)
  const manifesto = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'))
  assert.equal(manifesto.versaoMetodologia, cfg.versaoMetodologia)
  assert.match(manifesto.hashes.resultado, /^[0-9a-f]{64}$/)
  assert.match(manifesto.codigo.calculoSha256, /^[0-9a-f]{64}$/)

  // app: sem aprovação, só o cabeçalho
  const snap = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesBaratas.json'), 'utf8'))
  assert.equal(snap.publicado, false)
  assert.deepEqual(snap.ranking, [])
  assert.equal(snap.hashResultado, manifesto.hashes.resultado)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(raiz, 'dados-privados/acoes-baratas.json'), 'utf8')), { publicado: false }, 'sem aprovação, nem o arquivo privado leva dados')

  const v = verificar(pasta, raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
  assert.ok(v.mensagens.some((m) => /resultado recalculado/.test(m.m)))

  // memória de cálculo legível e completa
  const memoria = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pasta, 'memoria-de-calculo.json.gz'))))
  assert.ok(memoria.AAAA3.derivados.ev.formula && memoria.AAAA3.ranking.posicao === 1)

  // segunda execução idêntica: nada a regravar
  concluir({ raiz, cfg: cfgTravado, empresas, mapeamento, insumos, log: (m) => logs.push(m), agora: new Date('2026-10-05T12:00:00Z') })
  assert.ok(logs.some((m) => /Sem mudança/.test(m)))
  assert.equal(JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8')).geradoEm, manifesto.geradoEm)

  // adulteração dos insumos: muda 1 valor e regrava o arquivo
  const ins = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pasta, 'insumos.json.gz'))))
  ins.empresas[0].contabil.linhas.find((l) => l.cd === '3.05').valor += 1
  fs.writeFileSync(path.join(pasta, 'insumos.json.gz'), zlib.gzipSync(JSON.stringify(ins)))
  const v2 = verificar(pasta, raiz)
  assert.equal(v2.ok, false)
  assert.ok(v2.mensagens.some((m) => !m.ok && /insumos/.test(m.m)))
})

test('publicação: com a aprovação do responsável o app recebe o ranking; sem ela, nunca', () => {
  const manifesto = { geradoEm: 'x', hashes: { resultado: 'r', insumos: 'i', config: 'c' } }
  const { resultado } = calcular(insumosDe(['AAAA3', 'BBBB3'].map((t) => fabricar(t))), cfg)
  const com = montarSnapshotApp({ resultado, cfg, manifesto, pasta: 'p', publicado: true })
  const sem = montarSnapshotApp({ resultado, cfg, manifesto, pasta: 'p', publicado: false })
  assert.equal(com.ranking.length, 2)
  assert.equal(sem.ranking.length, 0)
  assert.equal(sem.exclusoes.length, 0)
  assert.equal(com.qualidade.roicMinimo, cfg.qualidade.roic.minimo)
})

test('end-to-end: fixtures no layout CVM → insumos → ranking (ALFA fica com os números à mão)', async () => {
  const { contabil } = await contabilAlfa()
  const alfa = { ticker: 'ALFA4', nome: 'Alfa', setor: 'Mineração', cnpj: CNPJ_ALFA, preco: { ...precoAlfa, volumeMedioEmissor: 40e6, serieAjustada: Array.from({ length: 200 }, (_, i) => 7 * (1 + 0.01 * (i % 2 ? 1 : -1))), saltosNaoResolvidos: [] }, contabil }
  const { resultado, memoria } = calcular(insumosDe([alfa], '2026-09-30'), cfg)
  assert.equal(resultado.ranking.length, 1, JSON.stringify(resultado.exclusoes))
  assert.equal(resultado.ranking[0].ev, 10320e6)
  assert.equal(memoria.ALFA4.demonstracao.doc, 'ITR')
})

test('trava de coerência (D49): com a publicação aprovada, o texto público não pode negar o ranking', () => {
  if (cfg.publicacao.aprovadoPeloResponsavel !== true) return // enquanto travado, nada a conferir
  const paginas = fs.readFileSync(path.join(AQUI, 'gerar-paginas.mjs'), 'utf8')
  const negaRanking = paginas.split('\n').filter((l) => /simuladores de ativos/.test(l) && /não fazem ranking/.test(l))
  assert.deepEqual(negaRanking, [], 'A página de Metodologia diz que os simuladores de ativos "não fazem ranking". Revise o texto (scripts/gerar-paginas.mjs) antes de publicar o Top 15.')
  assert.ok(fs.existsSync(path.join(RAIZ, 'docs', '09-metodologia-acoes-baratas.md')), 'a metodologia precisa estar documentada')
})

test('verificador independente: roda com SÓ dois scripts + a pasta da execução, como processo separado', () => {
  const raiz = raizTemporaria()
  const emps = ['AAAA3', 'BBBB3'].map((t, i) => fabricar(t, { pl: 900 - i * 100, fco: 150 - i * 50, ebit: 160 - i * 50 }))
  const empresas = emps.map((e) => ({ ticker: e.ticker, nome: e.nome, setor: e.setor }))
  const mapeamento = emps.map((e) => ({ ticker: e.ticker, cnpj: e.cnpj, origem: 'teste' }))
  const cfgSemPublicar = { ...cfg, publicacao: { ...cfg.publicacao, aprovadoPeloResponsavel: false } }
  concluir({ raiz, cfg: cfgSemPublicar, empresas, mapeamento, insumos: insumosDe(emps), log: () => {}, agora: new Date('2026-10-04T12:00:00Z') })

  // ambiente de terceiro: nenhum outro script (sem leitor da CVM, sem orquestrador, sem node_modules)
  const terceiro = fs.mkdtempSync(path.join(os.tmpdir(), 'terceiro-'))
  fs.mkdirSync(path.join(terceiro, 'scripts'))
  for (const a of ['acoes-baratas-calculo.mjs', 'acoes-baratas-verificar.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(terceiro, 'scripts', a))
  const pasta = path.join(terceiro, 'execucao')
  fs.cpSync(path.join(raiz, 'auditoria', 'acoes-baratas', '2026-09-30'), pasta, { recursive: true })
  assert.deepEqual(fs.readdirSync(path.join(terceiro, 'scripts')).sort(), ['acoes-baratas-calculo.mjs', 'acoes-baratas-verificar.mjs'])

  const roda = () => spawnSync(process.execPath, [path.join(terceiro, 'scripts', 'acoes-baratas-verificar.mjs'), pasta], { encoding: 'utf8' })
  const ok = roda()
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)
  assert.match(ok.stdout, /VERIFICAÇÃO: OK/)
  assert.match(ok.stdout, /resultado recalculado/)

  // adulteração do resultado publicado (ranking.csv) é pega pelo sha256 do manifesto
  fs.appendFileSync(path.join(pasta, 'ranking.csv'), 'linha extra\r\n')
  const ruim = roda()
  assert.equal(ruim.status, 1)
  assert.match(ruim.stdout, /ranking\.csv: sha256 DIVERGE/)
  assert.match(ruim.stdout, /VERIFICAÇÃO: FALHOU/)
  assert.equal(spawnSync(process.execPath, [path.join(terceiro, 'scripts', 'acoes-baratas-verificar.mjs')], { encoding: 'utf8' }).status, 2, 'sem argumento: uso')
})

test('trava de sanidade: barra a publicação de resultado inverossímil, mas deixa a auditoria para diagnóstico', () => {
  const san = { minimoNoRanking: 3, maximoFracaoSemDados: 0.35 }
  const cfgSan = { ...cfg, publicacao: { ...cfg.publicacao, aprovadoPeloResponsavel: true, sanidade: san } }
  const boas = ['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3'].map((t, i) => fabricar(t, { pl: 900 - i * 50, fco: 150 - i * 20, ebit: 160 - i * 20 }))

  // resultado saudável: publica
  const raiz1 = raizTemporaria()
  const mk = (emps) => ({ empresas: emps.map((e) => ({ ticker: e.ticker, nome: e.nome, setor: e.setor })), mapeamento: emps.map((e) => ({ ticker: e.ticker, cnpj: e.cnpj, origem: 'teste' })), insumos: insumosDe(emps) })
  const ok = concluir({ raiz: raiz1, cfg: cfgSan, ...mk(boas), log: () => {} })
  assert.equal(ok.publicado, true)
  const publicoTxt = fs.readFileSync(path.join(raiz1, 'webapp-src/src/data/acoesBaratas.json'), 'utf8')
  const privado = JSON.parse(fs.readFileSync(path.join(raiz1, 'dados-privados/acoes-baratas.json'), 'utf8'))
  assert.equal(JSON.parse(publicoTxt).ranking.length, 0, 'acesso por código: o arquivo do app NÃO leva a lista')
  assert.equal(privado.ranking.length, 4, 'a lista completa vai para dados-privados/')
  assert.equal(privado.publicado, true)

  // metade do cadastro sem CNPJ (erro típico de mapeamento): barra, grava a auditoria, NÃO toca no app
  const raiz2 = raizTemporaria()
  const semCnpj = ['EEEE3', 'FFFF3', 'GGGG3', 'HHHH3'].map((t) => fabricar(t, { cnpj: null }))
  assert.throws(() => concluir({ raiz: raiz2, cfg: cfgSan, ...mk([...boas, ...semCnpj]), log: () => {} }), /Publicação barrada pela trava de sanidade.*4 de 8 empresas no escopo sem dados utilizáveis \(50%; máximo 35%\)/)
  assert.ok(fs.existsSync(path.join(raiz2, 'auditoria/acoes-baratas/2026-09-30/exclusoes.csv')), 'auditoria gravada para diagnóstico')
  assert.ok(!fs.existsSync(path.join(raiz2, 'webapp-src/src/data/acoesBaratas.json')), 'o app não foi alterado')

  // ranking pequeno demais
  const raiz3 = raizTemporaria()
  assert.throws(() => concluir({ raiz: raiz3, cfg: cfgSan, ...mk(boas.slice(0, 2)), log: () => {} }), /só 2 empresas no ranking \(mínimo 3\)/)

  // bancos fora do escopo NÃO contam como "sem dados"; e a trava só vale para publicar
  const bancos = ['BAN1', 'BAN2', 'BAN3', 'BAN4'].map((t) => fabricar(`${t}3`, { setor: 'Bancos' }))
  const { resultado } = calcular(insumosDe([...boas, ...bancos]), cfg)
  assert.deepEqual(verificarSanidade(resultado, cfgSan), [])
  const travado = { ...cfgSan, publicacao: { ...cfgSan.publicacao, aprovadoPeloResponsavel: false } }
  assert.doesNotThrow(() => concluir({ raiz: raizTemporaria(), cfg: travado, ...mk(boas.slice(0, 1)), log: () => {} }))
})

test('configuração distribuída: aprovação registrada e trava de sanidade presente', () => {
  assert.equal(cfg.publicacao.aprovadoPeloResponsavel, true)
  assert.equal(cfg.publicacao.aprovacao.data, '2026-10-04')
  assert.equal(cfg.publicacao.aprovacao.parecerIndependente, false, 'registro honesto: não há parecer de terceiros')
  assert.ok(cfg.publicacao.sanidade.minimoNoRanking >= 30 && cfg.publicacao.sanidade.maximoFracaoSemDados <= 0.5)
})

test('acesso por código (D50): o arquivo PÚBLICO do app não contém nenhum nome de ação nem número de empresa', () => {
  const emps = ['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3'].map((t, i) => fabricar(t, { pl: 900 - i * 50, fco: 150 - i * 20, ebit: 160 - i * 20 }))
  const { resultado } = calcular(insumosDe([...emps, fabricar('PREJ3', { lucro: -5 })]), cfg)
  const manifesto = { geradoEm: 'x', hashes: { resultado: 'r', insumos: 'i', config: 'c' } }
  const completo = montarSnapshotApp({ resultado, cfg, manifesto, pasta: 'p', publicado: true })
  assert.equal(completo.acessoRestrito, true)
  assert.equal(completo.instagram, 'acarteiraideal')
  assert.equal(completo.ranking.length, 4)

  const { publico, privado } = separarSnapshot(completo)
  const txt = JSON.stringify(publico)
  for (const t of ['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3', 'PREJ3', 'Empresa AAAA3', 'Mineração']) assert.ok(!txt.includes(t), `vazou no arquivo público: ${t}`)
  assert.deepEqual([publico.ranking, publico.exclusoes, publico.etapas], [[], [], []])
  assert.equal(publico.publicado, true, 'o cabeçalho continua dizendo que está publicado, para a tela pedir o código')
  assert.equal(publico.acessoRestrito, true)
  assert.deepEqual(privado, completo, 'o privado é o snapshot completo')

  // sem aprovação: nada no privado
  const naoPub = montarSnapshotApp({ resultado, cfg, manifesto, pasta: 'p', publicado: false })
  assert.deepEqual(separarSnapshot(naoPub).privado, { publicado: false })

  // modo aberto (acesso.restritoPorCodigo = false): a lista volta para o arquivo do app
  const aberto = montarSnapshotApp({ resultado, cfg: { ...cfg, publicacao: { ...cfg.publicacao, acesso: { restritoPorCodigo: false } } }, manifesto, pasta: 'p', publicado: true })
  const partes = separarSnapshot(aberto)
  assert.equal(partes.publico.ranking.length, 4)
  assert.deepEqual(partes.privado, { publicado: false })
})

test('configuração distribuída: acesso por código ligado e perfil do Instagram definido', () => {
  assert.equal(cfg.publicacao.acesso.restritoPorCodigo, true)
  assert.match(cfg.publicacao.acesso.instagram, /^[A-Za-z0-9_.]+$/)
})

test('o arquivo privado fica fora do que vai para o navegador: não está em webapp-src nem no dist-site', () => {
  const privado = path.join(RAIZ, 'dados-privados', 'acoes-baratas.json')
  assert.ok(fs.existsSync(privado), 'precisa existir (a função o inclui no deploy)')
  assert.ok(!privado.includes(`${path.sep}webapp-src${path.sep}`))
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'))
  assert.equal(vercel.functions['api/top15.ts'].includeFiles, 'dados-privados/**', 'só a função do código enxerga o arquivo')
  assert.equal(vercel.outputDirectory, 'dist-site', 'a Vercel serve apenas dist-site; dados-privados/ não está lá')
})

test('EBITDA soma a depreciação qualquer que seja o sinal (a DVA da CVM vem negativa); nunca a subtrai', () => {
  // EBIT 100, dívida líquida 100 (dívida 200 − caixa 100), depreciação 30 → EBITDA 130 → 0,769x
  for (const da of [-30, 30]) {
    const r = calcular(insumosDe([fabricar('EBIT3', { da })]), cfg)
    const e = r.resultado.ranking[0]
    perto(e.dlEbitda, 100 / 130, 1e-4)
    assert.equal(e.passaDlEbitda, true)
    assert.equal(r.memoria.EBIT3.derivados.ebitda.valor, 130)
  }
  // O contrário (o erro da 1ª execução real) daria EBITDA 70 → 1,43x: este teste pega a regressão.
  assert.notEqual(Math.round(calcular(insumosDe([fabricar('EBIT3', { da: -30 })]), cfg).resultado.ranking[0].dlEbitda * 100) / 100, 1.43)
  // Identidade que precisa valer SEMPRE: dívida líquida/EBITDA <= (dívida líquida/EV) / (EBIT ajustado/EV)
  const e = calcular(insumosDe([fabricar('EBIT3', { da: -30 })]), cfg).resultado.ranking[0]
  assert.ok(e.dlEbitda <= 1 / e.ebitAjustadoSobreEv + 1e-9)
})

test('duplicidade econômica: holding que consolida empresa listada sai, a operacional fica', () => {
  const emps = [fabricar('GGBR4'), fabricar('GOAU4')]
  const { resultado } = calcular(insumosDe(emps), cfg)
  assert.deepEqual(resultado.ranking.map((r) => r.ticker), ['GGBR4'])
  const ex = resultado.exclusoes.find((e) => e.ticker === 'GOAU4')
  assert.deepEqual([ex.etapa, ex.codigo], ['universo', 'duplicidade_economica'])
  assert.match(ex.motivo, /holding que consolida a Gerdau/)
  assert.equal(cfg.universo.excluirTickers.GOAU4 !== undefined, true)
})

test('capital implausível: o motivo mostra valor de mercado, PL e ações para dar para diagnosticar na tela', () => {
  const { resultado } = calcular(insumosDe([fabricar('PLAU3', { acoes: 1e9 })]), cfg)
  const ex = resultado.exclusoes[0]
  assert.equal(ex.codigo, 'capital_implausivel')
  assert.match(ex.motivo, /valor de mercado R\$ .* mi ÷ PL dos controladores R\$ .* mi; ON 1\.000\.000\.000 ações × R\$ 10/)
})

test('ajuste manual de unidade do capital (VALE3 informa ações em milhares): só vale para o ticker listado, fica registrado e a plausibilidade continua valendo', () => {
  // mesmo cenário da Vale: PL 800, 0,1 "ação" × R$ 10 = valor de mercado 1 → P/VP 0,00125 (quantidade em milhares)
  const semAjuste = calcular(insumosDe([fabricar('VALE3', { acoes: 0.1 })]), { ...cfg, capital: { ajustesManuais: {} } }).resultado
  assert.equal(semAjuste.exclusoes[0].codigo, 'capital_implausivel')
  assert.equal(semAjuste.ranking.length, 0)

  const comAjuste = calcular(insumosDe([fabricar('VALE3', { acoes: 0.1 })]), cfg)
  assert.equal(comAjuste.resultado.ranking.length, 1, JSON.stringify(comAjuste.resultado.exclusoes))
  perto(comAjuste.resultado.ranking[0].pvp, 10 * 100 / 800, 1e-3)
  const reg = comAjuste.memoria.VALE3.valorDeMercado
  assert.equal(reg.ajusteManual.fatorQuantidade, 1000)
  assert.match(reg.ajusteManual.motivo, /milhares/)
  assert.equal(reg.capital.ordinarias, 0.1, 'a memória guarda a quantidade ORIGINAL da CVM, não a ajustada')

  // outro ticker com o mesmo defeito NÃO é ajustado sozinho
  assert.equal(calcular(insumosDe([fabricar('OUTR3', { acoes: 0.1 })]), cfg).resultado.exclusoes[0].codigo, 'capital_implausivel')
  // ajuste errado não esconde o problema: continua excluída, e a mensagem diz que foi com ajuste
  const errado = calcular(insumosDe([fabricar('VALE3', { acoes: 0.1 })]), { ...cfg, capital: { ajustesManuais: { VALE3: { fatorQuantidade: 2 } } } }).resultado
  assert.equal(errado.exclusoes[0].codigo, 'capital_implausivel')
  assert.match(errado.exclusoes[0].motivo, /MESMO com o ajuste de ×2/)
  assert.equal(cfg.capital.ajustesManuais.VALE3.fatorQuantidade, 1000)
})

test('caixa operacional incoerente (caso real MGLU3): FCO > 3x o EBITDA vira exclusão com motivo e números; no limite ainda passa', () => {
  // EBIT 100 + depreciação 30 = EBITDA 130 → limite 3x = 390
  const r = (fco, extra = {}) => calcular(insumosDe([fabricar('FCOI3', { da: -30, fco, ...extra })]), cfg).resultado
  const barrada = r(1000)
  assert.equal(barrada.ranking.length, 0)
  assert.deepEqual([barrada.exclusoes[0].etapa, barrada.exclusoes[0].codigo], ['dados_contabeis', 'fco_incoerente'])
  assert.match(barrada.exclusoes[0].motivo, /7,7x o EBITDA de R\$ 0 mi/)  // 1000/130, em R$ (valores do teste são pequenos)
  assert.match(barrada.exclusoes[0].motivo, /financiamento/)
  assert.equal(r(390).ranking.length, 1, 'exatamente 3,0x ainda passa')
  assert.equal(r(391).ranking.length, 0)
  // sem DVA não há EBITDA: usa o EBIT ajustado como referência (100 → limite 300)
  const semDva = (fco) => calcular(insumosDe([fabricar('FCOI3', { fco })]), cfg).resultado
  assert.equal(semDva(300).ranking.length, 1)
  assert.match(semDva(301).exclusoes[0].motivo, /3,0x o EBIT ajustado/)
  // FCO normal (parecido com o EBITDA) e FCO negativo não são barrados por esta regra
  assert.equal(r(130).ranking.length, 1)
  assert.equal(r(-50).ranking.length, 1)

  // os números do print da MGLU3: FCO R$ 16,4 bi, EBIT ajustado R$ 1,5 bi, D&A da ordem de R$ 1,1 bi → ~6x
  assert.ok(16.4 / (1.5 + 1.1) > cfg.verificacoes.fcoMaximoSobreEbitda)
  // e as 14 empresas que apareceram saudáveis no print têm FCO/EBIT de até ~1,9x, longe do limite
  for (const razao of [21.1 / 23.1, 45.8 / 29.8, 35.0 / 18.7, 15.9 / 19.1, 8.3 / 22.8]) assert.ok(razao < cfg.verificacoes.fcoMaximoSobreEbitda)
})

test('composição dos 12 meses e histórico por exercício chegam ao ranking, para conferir contra o documento da CVM', async () => {
  const { contabil } = await contabilAlfa()
  const alfa = { ticker: 'ALFA4', nome: 'Alfa', setor: 'Mineração', cnpj: CNPJ_ALFA, preco: { ...precoAlfa, volumeMedioEmissor: 40e6, serieAjustada: Array.from({ length: 200 }, (_, i) => 7 * (1 + 0.01 * (i % 2 ? 1 : -1))), saltosNaoResolvidos: [] }, contabil }
  const r = calcular(insumosDe([alfa], '2026-09-30'), cfg).resultado.ranking[0]
  // FCO: exercício 2025 (1.400) + acumulado 1S26 (800) − acumulado 1S25 (650) = 1.550
  const fco = r.composicaoLtm.fco
  assert.equal(fco.valor, 1550e6)
  assert.deepEqual(fco.componentes.map((c) => [c.papel, c.valor, c.de, c.ate]), [
    ['exercicio_anterior (+)', 1400e6, '2025-01-01', '2025-12-31'],
    ['acumulado_atual (+)', 800e6, '2026-01-01', '2026-06-30'],
    ['acumulado_ano_anterior (−)', 650e6, '2025-01-01', '2025-06-30'],
  ])
  assert.equal(fco.componentes.reduce((s, c) => s + (c.papel.includes('(−)') ? -c.valor : c.valor), 0), fco.valor, 'a soma dos componentes fecha com o total')
  assert.equal(r.composicaoLtm.lucro.conta, '3.11')
  assert.equal(r.composicaoLtm.lucro.valor, 1060e6)
  assert.equal(r.composicaoLtm.lucro.consolidado, 1060e6, 'consolidado (3.11): 900 + 560 − 400')
  assert.equal(r.composicaoLtm.lucro.controladores, 1000e6, 'controladores (3.11.01): 850 + 530 − 380')
  assert.deepEqual(r.historico.map((h) => [h.exercicio.slice(0, 4), h.lucro]), [['2025', 900e6], ['2024', 870e6], ['2023', 850e6], ['2022', -100e6], ['2021', 750e6]])
})

test('caso real SEER3: DFP com lucro dos controladores (3.11.01) ZERO em todos os anos não pode apagar o lucro consolidado (3.11)', () => {
  const emp = fabricar('SEER3', { lucros: [-20, 50, -5, 30] }) // consolidado por exercício; atual (2025) = 60
  // a DFP da Ser trazia 3.11.01 = 0 em todos os exercícios, até no de prejuízo
  for (const d of emp.contabil.docs) {
    emp.contabil.linhas.push({ doc: 'DFP', dtRefer: d.dtRefer, versao: 1, dem: 'DRE', cons: 'con', ordem: 'ULTIMO', dtIni: `${d.dtRefer.slice(0, 4)}-01-01`, dtFim: d.dtRefer, cd: '3.11.01', ds: 'Atribuído a Sócios da Empresa Controladora', valor: 0, linkDoc: null })
  }
  const r = calcular(insumosDe([emp]), cfg)
  const e = r.resultado.ranking[0]
  assert.equal(e.lucroLtm, 60, 'lucro de 12 meses = consolidado (3.11), não o 0 da 3.11.01')
  // consolidado: 2025 +60, 2024 +30, 2023 −5, 2022 +50, 2021 −20 → 3 de 5 (antes do conserto: 0 de 5)
  assert.deepEqual([e.exerciciosAnalisados, e.exerciciosComLucro], [5, 3])
  assert.deepEqual(e.historico.map((h) => [h.exercicio.slice(0, 4), h.lucro, h.lucroControladores]), [['2025', 60, 0], ['2024', 30, 0], ['2023', -5, 0], ['2022', 50, 0], ['2021', -20, 0]])
  assert.equal(e.composicaoLtm.lucro.conta, '3.11')
  assert.equal(e.composicaoLtm.lucro.controladores, 0, 'o zero dos controladores continua visível, para quem quiser conferir')
})

// Cenário em escala "de verdade" (R$): PL de R$ 8 bi, volume diário de R$ 50 mi.
const real = (ticker, o = {}) => fabricar(ticker, { pl: 8e9, ebit: 1e9, fco: 9e8, lucro: 6e8, volume: 5e7, ...o })

test('unidade AUTOMÁTICA (caso Ambev/Renner/Cemig...): quantidade em milhares é detectada por dois sinais e fica registrada', () => {
  // 1 milhão "de ações" (na verdade 1 milhão de milhares = 1 bi) × R$ 10 = R$ 10 mi; P/VP = 0,00125; giro = 5 (500%/dia: impossível)
  const r = calcular(insumosDe([real('AMBV3', { acoes: 1e6 })]), cfg)
  assert.equal(r.resultado.ranking.length, 1, JSON.stringify(r.resultado.exclusoes))
  const e = r.resultado.ranking[0]
  assert.equal(e.ajusteUnidadeCapital, 'automático ×1000')
  assert.equal(e.mktcap, 1e10)
  perto(e.pvp, 1.25, 1e-3)
  const reg = r.memoria.AMBV3.valorDeMercado
  assert.equal(reg.ajusteAutomatico.fatorQuantidade, 1000)
  assert.deepEqual(reg.ajusteAutomatico.evidencias, { pvpSemAjuste: 0.00125, giroDiarioSemAjuste: 5, pvpComAjuste: 1.25, giroDiarioComAjuste: 0.005 })
  assert.equal(reg.capital.ordinarias, 1e6, 'a memória guarda a quantidade ORIGINAL da CVM')
  assert.equal(reg.ajusteManual, null)
})

test('unidade automática NÃO mexe em empresa barata de verdade (P/VP baixo, giro normal) nem quando o ajuste não resolve', () => {
  // distressed: P/VP 0,0125 (< 0,02) mas giro 0,2 (<= 0,25): só um sinal → não ajusta → excluída com os números
  const barata = calcular(insumosDe([real('DIST3', { pl: 2e10, acoes: 2.5e7 })]), cfg).resultado
  assert.equal(barata.exclusoes[0].codigo, 'capital_implausivel')
  assert.ok(!/MESMO com o ajuste/.test(barata.exclusoes[0].motivo))
  // dois sinais acusam, mas ×1000 também não fica plausível (giro continuaria impossível): não ajusta
  const pequena = calcular(insumosDe([real('PEQU3', { acoes: 1e6, volume: 5e11 })]), cfg).resultado
  assert.equal(pequena.exclusoes[0].codigo, 'capital_implausivel')
  // empresa normal (P/VP 1,25): nada a ajustar
  const normal = calcular(insumosDe([real('NORM3', { acoes: 1e9 })]), cfg)
  assert.equal(normal.resultado.ranking[0].ajusteUnidadeCapital, null)
  // chave de segurança desligada
  const off = calcular(insumosDe([real('AMBV3', { acoes: 1e6 })]), { ...cfg, verificacoes: { ...cfg.verificacoes, unidadeAutomatica: { ...cfg.verificacoes.unidadeAutomatica, ativa: false } } }).resultado
  assert.equal(off.exclusoes[0].codigo, 'capital_implausivel')
  // o ajuste manual vence o automático (e aparece como manual)
  const manual = calcular(insumosDe([real('VALE3', { acoes: 1e6 })]), cfg).resultado.ranking[0]
  assert.equal(manual.ajusteUnidadeCapital, 'manual ×1000')
})

test('unidade automática: o ajuste não esconde um erro de ESCALA do outro lado (P/VP depois do ajuste > 100 continua excluindo)', () => {
  // quantidade em unidades corretas mas P/VP absurdo para cima: não é caso de milhares
  const r = calcular(insumosDe([real('ALTO3', { acoes: 5e11 })]), cfg).resultado
  assert.equal(r.exclusoes[0].codigo, 'capital_implausivel')
})

test('classe sem preço com mais de 10% das ações (caso TFCO4: ON = 93% das ações, sem preço próprio) sai com o motivo', () => {
  // ON 877 mi e PN 65 mi; só a PN negocia. A ON seria avaliada pelo preço da PN, mas tem direito econômico muito menor.
  const emp = real('TFCO4', { acoes: 877e6 })
  emp.contabil.capital[0] = { ...emp.contabil.capital[0], ordinarias: 877e6, preferenciais: 65e6 }
  emp.preco.ref = { ticker: 'TFCO4', fechamento: 13.4, data: '2026-09-30' }
  emp.preco.classes = [{ classe: 'PN', ticker: 'TFCO4', fechamento: 13.4, data: '2026-09-30' }]
  const r = calcular(insumosDe([emp]), cfg).resultado
  assert.equal(r.ranking.length, 0)
  assert.equal(r.exclusoes[0].codigo, 'classe_sem_preco')
  assert.match(r.exclusoes[0].motivo, /ON 93% das ações está sem preço/)
  // classe pequena sem preço (FRAS3: PN 1%) segue, avaliada pelo preço da outra classe
  const peq = real('FRAS3', { acoes: 1e9 })
  peq.contabil.capital[0] = { ...peq.contabil.capital[0], ordinarias: 1e9, preferenciais: 1e7 }
  peq.preco.classes = [{ classe: 'ON', ticker: 'FRAS3', fechamento: 10, data: '2026-09-30' }]
  const ok = calcular(insumosDe([peq]), cfg)
  assert.equal(ok.resultado.ranking.length, 1)
  assert.equal(ok.resultado.ranking[0].metodoValorDeMercado, 'preco_da_outra_classe')
})

test('alerta de P/VP muito alto (caso LAVV3: ações lidas 10x acima do real dão P/VP 15,5): aparece no ranking sem excluir', () => {
  const r = calcular(insumosDe([real('ALER3', { acoes: 1.5e10 }), real('NORM3', { acoes: 1e9 })]), cfg).resultado
  const por = Object.fromEntries(r.ranking.map((x) => [x.ticker, x]))
  assert.deepEqual(por.ALER3.alertas, ['pvp_alto'])
  assert.deepEqual(por.NORM3.alertas, [])
  assert.equal(cfg.verificacoes.pvpAlerta, 10)
})

test('sem preço: o motivo real aparece (último negócio antigo), não uma frase genérica', () => {
  const emp = fabricar('PARA3')
  emp.preco = { ref: null, motivoSemPreco: 'último negócio em 2026-08-01, há mais de 10 dias do último pregão (2026-10-02)' }
  const ex = calcular(insumosDe([emp]), cfg).resultado.exclusoes[0]
  assert.equal(ex.codigo, 'sem_preco')
  assert.match(ex.motivo, /último negócio em 2026-08-01/)
})

test('desdobramentos confirmados (SBSP3, SIMH3, ORVR3) estão na config e fecham a série de preços', () => {
  const d = cfg.desdobramentos
  assert.deepEqual([d.SBSP3[0].data, d.SBSP3[0].fator, d.SIMH3[0].data, d.SIMH3[0].fator, d.ORVR3[0].data, d.ORVR3[0].fator], ['2026-04-29', 5, '2026-02-18', 0.5, '2026-08-11', 4])
  const dias = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const salto = (fator) => ({ pregoes: dias, ativos: { ZZZZ3: dias.map((_, i) => { const p = i < 15 ? 40 : 40 / fator; return [p, p, p, 1e6] }) } })
  const merged = mesclarDesdobramentos({}, { ZZZZ3: [{ data: '2026-09-16', fator: 4 }] })
  assert.equal(extrairPreco(salto(4), 'ZZZZ3', { desdobramentos: merged }, cfg).saltosNaoResolvidos.length, 0)
  assert.equal(extrairPreco(salto(4), 'ZZZZ3', { desdobramentos: {} }, cfg).saltosNaoResolvidos.length, 1)
  // grupamento 2:1 (fator 0,5): o preço sobe para o dobro
  const grup = { pregoes: dias, ativos: { ZZZZ3: dias.map((_, i) => { const p = i < 15 ? 10 : 20; return [p, p, p, 1e6] }) } }
  assert.equal(extrairPreco(grup, 'ZZZZ3', { desdobramentos: { ZZZZ3: [{ data: '2026-09-16', fator: 0.5 }] } }, cfg).saltosNaoResolvidos.length, 0)
})

test('mesclarDesdobramentos: soma as duas fontes sem duplicar a mesma data e ignora chaves de comentário', () => {
  const m = mesclarDesdobramentos({ AAAA3: [{ data: '2026-01-02', fator: 2 }], _leia: 'x' }, { AAAA3: [{ data: '2026-01-02', fator: 2, fonte: 'y' }, { data: '2026-03-04', fator: 5 }], BBBB3: [{ data: '2026-05-06', fator: 0.5 }], _leia: 'z' })
  assert.deepEqual(m.AAAA3.map((e) => e.data), ['2026-01-02', '2026-03-04'])
  assert.deepEqual(m.BBBB3, [{ data: '2026-05-06', fator: 0.5 }])
  assert.equal(m._leia, undefined)
})

test('FCA de dois anos: o recente vale; o anterior só preenche o que falta e nunca traz de volta um CNPJ antigo', async () => {
  const f26 = path.join(FIX, 'fca_cia_aberta_2026.zip')
  const f25 = path.join(FIX, 'fca_cia_aberta_2025.zip')
  const so26 = await mapaTickerCnpj(f26)
  assert.equal(resolverCnpjs(['DELT3'], so26)[0].cnpj, null, 'só com o FCA de 2026, DELT3 não é achada (caso real dos sem_cnpj)')
  const mapa = await mapaTickerCnpj([f26, f25])
  const r = Object.fromEntries(resolverCnpjs(['DELT3', 'GAMA3', 'ALFA3', 'AMBI3'], mapa).map((x) => [x.ticker, x]))
  assert.equal(r.DELT3.cnpj, '77.777.777/0001-77', 'achada no FCA do ano anterior')
  assert.equal(r.GAMA3.cnpj, '44.444.444/0001-44', 'o CNPJ NOVO do FCA recente vence o antigo do FCA anterior')
  assert.equal(r.ALFA3.cnpj, CNPJ_ALFA)
  assert.equal(r.AMBI3.cnpj, null, 'ambiguidade continua sendo recusada')
  assert.equal((await mapaTickerCnpj(f26)).size, so26.size, 'aceitar um caminho único continua funcionando')
})

test('CSV do ranking traz as colunas novas: método do valor de mercado, ajuste de unidade e alertas', () => {
  const { resultado } = calcular(insumosDe([real('AMBV3', { acoes: 1e6 }), real('ALER3', { acoes: 1.5e10 })]), cfg)
  const csvTxt = csvRanking(resultado)
  const cab = csvTxt.split('\r\n')[0].replace('\uFEFF', '').split(';')
  assert.ok(['metodo_valor_mercado', 'ajuste_unidade_capital', 'alertas'].every((c) => cab.includes(c)))
  const linhas = csvTxt.split('\r\n').slice(1).filter(Boolean).map((l) => l.split(';'))
  const col = (n, l) => l[cab.indexOf(n)]
  const amb = linhas.find((l) => l[1] === 'AMBV3')
  assert.equal(col('ajuste_unidade_capital', amb), '"automático ×1000"')
  assert.equal(col('metodo_valor_mercado', amb), 'por_classe')
  assert.equal(col('alertas', linhas.find((l) => l[1] === 'ALER3')), '"pvp_alto"')
  assert.ok(linhas.every((l) => l.length === cab.length), 'todas as linhas têm o mesmo número de colunas do cabeçalho')
})
