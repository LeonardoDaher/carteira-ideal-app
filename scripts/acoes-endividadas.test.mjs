// Top 15 empresas mais endividadas (D94): cálculo à mão, exclusões, auditoria, modo diário e publicação.

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { calcularEndividadas, canonico, hashDoResultado, sha256, verificarSanidade } from './acoes-endividadas-calculo.mjs'
import { concluir, csvRanking, executar, montarSnapshotApp, semNotas } from './atualizar-acoes-endividadas.mjs'
import { verificar } from './acoes-endividadas-verificar.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const lerJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'))
const base = lerJson(RAIZ, 'config', 'acoes-baratas.json')
const cfgArquivo = lerJson(RAIZ, 'config', 'acoes-endividadas.json')
const cfg = { ...cfgArquivo, tamanhoDaLista: 3, publicacao: { ...cfgArquivo.publicacao, aprovadoPeloResponsavel: false, sanidade: { minimoAvaliadas: 2, maximoFracaoSemDados: 0.9 } } }
const aprovado = (c) => ({ ...c, publicacao: { ...c.publicacao, aprovadoPeloResponsavel: true } })

// ---------------------------------------------------------------------------------------
// Empresa fabricada (R$): ativo 2.000, caixa 100, dívida 50 (CP) + 150 (LP), EBIT 100, PL 800, 100 ações a R$ 10.
// Dívida líquida = dívida bruta − caixa; EBITDA = EBIT + |depreciação da DVA|; sem a linha da DVA o EBITDA não existe.
// ---------------------------------------------------------------------------------------

function empresa(ticker, o = {}) {
  const R = '2025-12-31'
  const L = (dem, cd, ds, valor) => ({ doc: 'DFP', dtRefer: R, versao: 1, dem, cons: 'con', ordem: 'ULTIMO', dtIni: dem === 'BPA' || dem === 'BPP' ? null : '2025-01-01', dtFim: R, cd, ds, valor, linkDoc: `https://exemplo/${ticker}` })
  const linhas = [
    ...(o.da === undefined ? [] : [L('DVA', '7.04.01', 'Depreciação, Amortização e Exaustão', o.da)]),
    L('DRE', '3.01', 'Receita', 1000), L('DRE', '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', o.ebit ?? 100), L('DRE', '3.11', 'Lucro/Prejuízo do Período', o.lucro ?? 60),
    L('DFC', '6.01', 'Caixa Líquido das Atividades Operacionais', o.fco ?? 90),
    L('BPA', '1', 'Ativo Total', 2000), L('BPA', '1.01.01', 'Caixa e Equivalentes de Caixa', o.caixa ?? 100),
    L('BPP', '2', 'Passivo Total', 2000), L('BPP', '2.03', 'Patrimônio Líquido', o.pl ?? 800),
    L('BPP', '2.01.04', 'Empréstimos e Financiamentos', o.divCP ?? 50), L('BPP', '2.02.01', 'Empréstimos e Financiamentos', o.divLP ?? 150),
  ]
  const serie = Array.from({ length: 200 }, (_, i) => 10 * (1 + (o.amp ?? 0.01) * (i % 2 ? 1 : -1)))
  return {
    ticker, nome: `Empresa ${ticker}`, setor: o.setor ?? 'Mineração', cnpj: o.cnpj === null ? null : `00.000.000/${ticker.charCodeAt(0)}${ticker.charCodeAt(1)}-00`, origemCnpj: 'teste',
    preco: o.semPreco ? { ref: null, motivoSemPreco: 'teste' } : { ref: { ticker, fechamento: 10, data: '2026-09-30' }, classes: [{ classe: 'ON', ticker, fechamento: 10, data: '2026-09-30' }], volumeMedioEmissor: o.volume ?? 50e6, serieAjustada: serie, saltosNaoResolvidos: [] },
    contabil: { docs: [{ doc: 'DFP', dtRefer: R, versao: 1, dtReceb: '2026-03-01', linkDoc: `https://exemplo/${ticker}` }], linhas, capital: [{ doc: 'DFP', dtRefer: R, versao: 1, ordinarias: 100, preferenciais: 0, tesouroOrd: 0, tesouroPref: 0 }] },
  }
}
const insumosDe = (empresas) => ({ esquema: 1, dataCorte: '2026-03-31', dataPrecos: '2026-09-30', empresas })
const rodar = (empresas, c = cfg) => calcularEndividadas(insumosDe(empresas), c, base)
const codigos = (r) => Object.fromEntries(r.resultado.exclusoes.map((e) => [e.ticker, e.codigo]))

// ---------------------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------------------

test('cálculo à mão: dívida líquida ÷ EBITDA, ordem decrescente (A 100÷120, B 600÷150, C 300÷100)', () => {
  const A = empresa('AAAA3', { da: 20 })                         // DL = 200 − 100 = 100 · EBITDA = 100 + 20 · razão 0,8333
  const B = empresa('BBBB3', { da: 50, divLP: 650 })              // DL = 700 − 100 = 600 · EBITDA = 150 · razão 4,0
  const C = empresa('CCCC3', { da: 0, divLP: 350 })               // DL = 400 − 100 = 300 · EBITDA = 100 · razão 3,0
  const { resultado, memoria } = rodar([A, B, C])
  assert.deepEqual(resultado.ranking.map((r) => [r.posicao, r.ticker]), [[1, 'BBBB3'], [2, 'CCCC3'], [3, 'AAAA3']])
  const [b, c, a] = resultado.ranking
  assert.equal(b.dlEbitda, 4)
  assert.equal(c.dlEbitda, 3)
  assert.equal(a.dlEbitda, 0.8333)
  assert.deepEqual([b.dividaBruta, b.caixa, b.dividaLiquida, b.ebitda], [700, 100, 600, 150])
  assert.equal(resultado.avaliadas, 3)
  assert.equal(resultado.universo, 3)
  assert.equal(memoria.BBBB3.ranking.posicao, 1)
  // a memória de cada item mostra a conta da CVM de cada parcela
  assert.deepEqual([b.calculo.dividaCurta.cd, b.calculo.dividaLonga.cd, b.calculo.caixaEEquivalentes.cd], ['2.01.04', '2.02.01', '1.01.01'])
  assert.equal(b.calculo.dividaLonga.valor, 650)
  assert.equal(b.calculo.depreciacaoEAmortizacao.cd, '7.04.01')
  assert.equal(b.calculo.dividaLiquida.formula, 'dívida bruta − caixa')
  assert.match(b.calculo.ebitda.formula, /EBIT ajustado \+ \|depreciação/)
  assert.equal(b.demonstracao.doc, 'DFP')
})

test('o sinal da depreciação na DVA não importa (vem negativa em algumas empresas): EBITDA soma o valor absoluto', () => {
  const r = rodar([empresa('AAAA3', { da: -50, divLP: 650 })]).resultado
  assert.equal(r.ranking[0].ebitda, 150)
  assert.equal(r.ranking[0].dlEbitda, 4)
})

test('empate na razão: desempata pelo código; a ordem das empresas na entrada não muda o resultado nem o hash', () => {
  const todas = [empresa('ZZZZ3', { da: 50, divLP: 650 }), empresa('AAAA3', { da: 50, divLP: 650 }), empresa('MMMM3', { da: 20 })]
  const a = rodar(todas).resultado
  const b = rodar([...todas].reverse()).resultado
  assert.deepEqual(a.ranking.map((r) => r.ticker), ['AAAA3', 'ZZZZ3', 'MMMM3'])
  assert.equal(hashDoResultado(a), hashDoResultado(b))
})

test('cada motivo de exclusão, com o código certo: setor, CNPJ, preço, liquidez, sem EBITDA e caixa líquido', () => {
  const r = rodar([
    empresa('BANC3', { da: 20, setor: 'Bancos' }),
    empresa('SEMC3', { da: 20, cnpj: null }),
    empresa('SEMP3', { da: 20, semPreco: true }),
    empresa('LIQU3', { da: 20, volume: 1e6 }),
    empresa('SEME3'),                                              // sem a linha de depreciação: EBITDA não existe
    empresa('CAIX3', { da: 20, caixa: 900 }),                      // dívida bruta 200 < caixa 900: dívida líquida −700
    empresa('BOAA3', { da: 20, divLP: 650 }),
  ])
  assert.deepEqual(codigos(r), { BANC3: 'setor_excluido', SEMC3: 'sem_cnpj', SEMP3: 'sem_preco', LIQU3: 'liquidez_baixa', SEME3: 'sem_ebitda', CAIX3: 'caixa_liquido' })
  assert.deepEqual(r.resultado.ranking.map((x) => x.ticker), ['BOAA3'])
  assert.match(r.resultado.exclusoes.find((e) => e.ticker === 'CAIX3').motivo, /Dívida líquida de R\$ -700/)
  assert.deepEqual(r.resultado.etapas.map((e) => [e.id, e.entram, e.saem]), [['universo', 7, 3], ['liquidez', 4, 1], ['dados_contabeis', 3, 0], ['endividamento', 3, 2], ['ranking', 1, 0]])
})

test('NÃO aplica os filtros das ações baratas que não cabem aqui: prejuízo, volatilidade alta e caixa operacional muito acima do EBITDA ficam', () => {
  // prejuízo de 12 meses: nas ações baratas sai ("prejuizo_12m"); aqui é justamente a empresa que interessa
  // volatilidade de 80% ao dia nas séries: nas ações baratas o decil mais volátil sai
  // FCO de 10× o EBITDA: nas ações baratas sai ("fco_incoerente", protege o indicador caixa operacional ÷ EV); aqui não
  const normais = [empresa('AAAA3', { da: 20 }), empresa('BBBB3', { da: 20 }), empresa('CCCC3', { da: 20 })]
  const alvo = [empresa('PREJ3', { da: 50, divLP: 650, lucro: -500 }), empresa('VOLA3', { da: 50, divLP: 650, amp: 0.8 }), empresa('FCOO3', { da: 50, divLP: 650, fco: 1500 })]
  const r = rodar([...normais, ...alvo])
  assert.deepEqual(r.resultado.exclusoes, [])
  assert.deepEqual(r.resultado.ranking.slice(0, 3).map((x) => x.ticker), ['FCOO3', 'PREJ3', 'VOLA3'])
  assert.equal(r.resultado.ranking.length, 6)
  // ... e, de fato, as ações baratas os teriam barrado (a diferença é de propósito)
  const barato = calcularEndividadas(insumosDe([...normais, ...alvo]), cfg, { ...base, verificacoes: { ...base.verificacoes } })
  assert.equal(barato.resultado.exclusoes.length, 0)
})

test('dívida líquida positiva com EBITDA zero ou negativo: razão indefinida, lista à parte, maior dívida primeiro, fora da ordem numérica', () => {
  const r = rodar([
    empresa('OKAY3', { da: 50, divLP: 650 }),
    empresa('NEGA3', { ebit: -100, da: 20, divLP: 650 }),          // EBITDA = −100 + 20 = −80
    empresa('ZERA3', { ebit: 100, da: -100 }),                       // EBITDA = 100 + 100... = 200 (não zera)
    empresa('ZERO3', { ebit: 0, da: 0, divLP: 1250 }),               // EBITDA = 0, DL = 1.300 − 100 = 1.200
  ]).resultado
  assert.deepEqual(r.ranking.map((x) => x.ticker), ['OKAY3', 'ZERA3'])
  assert.deepEqual(r.semEbitdaPositivo.map((x) => x.ticker), ['ZERO3', 'NEGA3'])
  assert.deepEqual(r.semEbitdaPositivo.map((x) => x.dividaLiquida), [1200, 600])
  assert.equal(r.semEbitdaPositivo[0].dlEbitda, null)
  assert.equal(r.semEbitdaPositivo[0].posicao, undefined)
})

test('as demais verificações de integridade das ações baratas continuam valendo (balanço que não fecha sai)', () => {
  const ruim = empresa('RUIM3', { da: 20 })
  ruim.contabil.linhas = ruim.contabil.linhas.map((l) => (l.cd === '2' ? { ...l, valor: 5000 } : l))
  const r = rodar([ruim, empresa('BOAA3', { da: 20 })])
  assert.equal(codigos(r).RUIM3, 'balanco_nao_fecha')
})

test('o resultado leva a versão, as datas e as contagens do universo', () => {
  const { resultado } = rodar([empresa('AAAA3', { da: 20 }), empresa('BANC3', { da: 20, setor: 'Bancos' })])
  assert.equal(resultado.versaoMetodologia, cfg.versaoMetodologia)
  assert.equal(resultado.dataPrecos, '2026-09-30')
  assert.equal(resultado.dataCorte, '2026-03-31')
  assert.equal(resultado.universo, 2)
  assert.equal(resultado.avaliadas, 1)
})

test('trava de sanidade: poucas empresas avaliadas ou muitas sem dado derrubam a publicação', () => {
  const s = { publicacao: { sanidade: { minimoAvaliadas: 2, maximoFracaoSemDados: 0.5 } } }
  const um = rodar([empresa('AAAA3', { da: 20 })]).resultado
  assert.match(verificarSanidade(um, s)[0], /só 1 empresas avaliadas \(mínimo 2\)/)
  const bom = rodar([empresa('AAAA3', { da: 20 }), empresa('BBBB3', { da: 20 })]).resultado
  assert.deepEqual(verificarSanidade(bom, s), [])
  const semDados = rodar([empresa('AAAA3', { da: 20 }), empresa('BBBB3', { da: 20 }), empresa('CCCC3', { da: 20, cnpj: null }), empresa('DDDD3', { da: 20, cnpj: null }), empresa('EEEE3', { da: 20, cnpj: null })]).resultado
  assert.match(verificarSanidade(semDados, s)[0], /3 de 5 empresas no escopo sem dados utilizáveis \(60%; máximo 50%\)/)
  assert.deepEqual(verificarSanidade(bom, {}), [])
})

test('configuração: versão 1.1.0, publicação aprovada pelo responsável em 17/10/2026, acesso aberto e aviso de "não é recomendação"', () => {
  assert.equal(cfgArquivo.versaoMetodologia, '1.1.0')
  assert.equal(cfgArquivo.publicacao.aprovadoPeloResponsavel, true)
  assert.equal(cfgArquivo.publicacao.aprovacao.data, '2026-10-17')
  assert.equal(cfgArquivo.historicoDeVersoes.at(-1).versao, cfgArquivo.versaoMetodologia)
  assert.equal(cfgArquivo.tamanhoDaLista, 15)
  assert.equal(cfgArquivo.criterio.indicador, 'dlEbitda')
  assert.equal(cfgArquivo.publicacao.acesso, undefined, 'aberto, sem código')
  assert.match(cfgArquivo.publicacao.avisoProposto, /^Não é recomendação de investimento\./)
  assert.match(cfgArquivo.publicacao.avisoProposto, /não captura prazo, custo, moeda nem garantias/)
  assert.equal(typeof cfgArquivo.publicacao.sanidade.minimoAvaliadas, 'number')
})

// ---------------------------------------------------------------------------------------
// Auditoria: grava, verifica, detecta adulteração
// ---------------------------------------------------------------------------------------

function raizTemporaria() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'end-teste-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['acoes-endividadas-calculo.mjs', 'acoes-baratas-calculo.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  for (const d of ['config', 'historico', path.join('webapp-src', 'src', 'data')]) fs.mkdirSync(path.join(raiz, d), { recursive: true })
  return raiz
}
const gravar = (raiz, rel, obj) => { fs.mkdirSync(path.dirname(path.join(raiz, ...rel.split('/'))), { recursive: true }); fs.writeFileSync(path.join(raiz, ...rel.split('/')), JSON.stringify(obj)) }
const app = (raiz) => lerJson(raiz, 'webapp-src', 'src', 'data', 'acoesEndividadas.json')
const pastas = (raiz) => fs.readdirSync(path.join(raiz, 'auditoria', 'acoes-endividadas')).filter((n) => /^\d{4}-/.test(n)).sort()
const log0 = () => {}
const trio = () => [empresa('AAAA3', { da: 20 }), empresa('BBBB3', { da: 50, divLP: 650 }), empresa('CCCC3', { da: 0, divLP: 350 })]

test('auditoria: grava a pasta, a verificação refaz o cálculo e confere; adulterar um arquivo, um insumo ou uma config é detectado', () => {
  const raiz = raizTemporaria()
  const r = concluir({ raiz, cfg, base, insumos: insumosDe(trio()), fontes: [{ papel: 'teste', url: 'x' }], log: log0, agora: new Date('2026-10-05T12:00:00Z'), dataExecucao: '2026-10-05', origemInsumos: 'auditoria/acoes-baratas/2026-10-02' })
  assert.equal(r.publicado, false)
  const pasta = path.join(raiz, 'auditoria', 'acoes-endividadas', '2026-10-05')
  assert.deepEqual(fs.readdirSync(pasta).sort(), ['LEIA-ME.md', 'config-base.json', 'config.json', 'exclusoes.csv', 'insumos.json.gz', 'manifesto.json', 'memoria-de-calculo.json.gz', 'ranking.csv', 'resultado.json', 'sem-ebitda-positivo.csv'])
  const man = lerJson(pasta, 'manifesto.json')
  assert.equal(man.hashes.resultado, hashDoResultado(r.resultado))
  assert.equal(man.origemInsumos, 'auditoria/acoes-baratas/2026-10-02')
  assert.equal(man.publicadoNoApp, false)
  assert.match(man.codigo.calculoSha256, /^[0-9a-f]{64}$/)
  assert.equal(lerJson(raiz, 'auditoria', 'acoes-endividadas', 'ultima.json').pasta, 'auditoria/acoes-endividadas/2026-10-05')
  const ok = verificar(pasta, raiz)
  assert.equal(ok.ok, true, JSON.stringify(ok.mensagens.filter((m) => !m.ok)))
  assert.ok(ok.mensagens.some((m) => /resultado recalculado.*confere/.test(m.m)))

  // 1) resultado.json editado à mão
  const original = fs.readFileSync(path.join(pasta, 'resultado.json'), 'utf8')
  fs.writeFileSync(path.join(pasta, 'resultado.json'), original.replace('BBBB3', 'CCCC3'))
  assert.equal(verificar(pasta, raiz).ok, false)
  fs.writeFileSync(path.join(pasta, 'resultado.json'), original)
  assert.equal(verificar(pasta, raiz).ok, true)

  // 2) config-base alterada e manifesto "consertado" para os hashes dos arquivos: o hash canônico das configs diverge
  const cb = lerJson(pasta, 'config-base.json')
  cb.filtros.liquidezMinimaDiariaReais = 1
  fs.writeFileSync(path.join(pasta, 'config-base.json'), JSON.stringify(cb, null, 2))
  const m2 = lerJson(pasta, 'manifesto.json')
  m2.hashes.arquivos['config-base.json'] = crypto.createHash('sha256').update(fs.readFileSync(path.join(pasta, 'config-base.json'))).digest('hex')
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify(m2))
  const v2 = verificar(pasta, raiz)
  assert.equal(v2.ok, false)
  assert.ok(v2.mensagens.some((m) => !m.ok && /configs: hash canônico DIVERGE/.test(m.m)))
})

test('verificação: insumo trocado com manifesto "consertado" é pego pelo recálculo', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, cfg, base, insumos: insumosDe(trio()), log: log0, dataExecucao: '2026-10-05' })
  const pasta = path.join(raiz, 'auditoria', 'acoes-endividadas', '2026-10-05')
  const ins = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pasta, 'insumos.json.gz'))).toString('utf8'))
  ins.empresas.find((e) => e.ticker === 'BBBB3').contabil.linhas.find((l) => l.cd === '2.02.01').valor = 1
  fs.writeFileSync(path.join(pasta, 'insumos.json.gz'), zlib.gzipSync(Buffer.from(JSON.stringify(ins))))
  const man = lerJson(pasta, 'manifesto.json')
  man.hashes.arquivos['insumos.json.gz'] = crypto.createHash('sha256').update(fs.readFileSync(path.join(pasta, 'insumos.json.gz'))).digest('hex')
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify(man))
  const v = verificar(pasta, raiz)
  assert.equal(v.ok, false)
  assert.ok(v.mensagens.some((m) => !m.ok && /insumos: hash canônico DIVERGE|resultado recalculado DIVERGE/.test(m.m)))
})

test('executar de novo com os mesmos dados não altera a auditoria já gravada (mesmo conteúdo, mesmo hash)', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, cfg, base, insumos: insumosDe(trio()), log: log0, dataExecucao: '2026-10-05', agora: new Date('2026-10-05T12:00:00Z') })
  const h1 = lerJson(raiz, 'auditoria', 'acoes-endividadas', '2026-10-05', 'manifesto.json').hashes
  concluir({ raiz, cfg, base, insumos: insumosDe(trio()), log: log0, dataExecucao: '2026-10-05', agora: new Date('2030-01-01T00:00:00Z') })
  const h2 = lerJson(raiz, 'auditoria', 'acoes-endividadas', '2026-10-05', 'manifesto.json').hashes
  assert.deepEqual([h2.resultado, h2.insumos, h2.config], [h1.resultado, h1.insumos, h1.config])
})

// ---------------------------------------------------------------------------------------
// Publicação
// ---------------------------------------------------------------------------------------

test('publicação: sem aprovação só o cabeçalho "em validação"; com aprovação, o Top N, o restante, a lista sem EBITDA positivo e as exclusões', () => {
  const todas = [...trio(), empresa('DDDD3', { da: 40, divLP: 450 }), empresa('EEEE3', { ebit: -100, da: 20, divLP: 650 }), empresa('BANC3', { da: 20, setor: 'Bancos' })]
  const fechado = raizTemporaria()
  concluir({ raiz: fechado, cfg, base, insumos: insumosDe(todas), log: log0, dataExecucao: '2026-10-05' })
  const a = app(fechado)
  assert.equal(a.publicado, false)
  assert.deepEqual([a.ranking, a.restante, a.semEbitdaPositivo, a.exclusoes, a.etapas], [[], [], [], [], []])
  assert.deepEqual(a.contagens, { ranking: 4, semEbitdaPositivo: 1, exclusoes: 1 })
  assert.equal(a.modoAuditoria, 'completa')
  assert.ok(!JSON.stringify(a).includes('"_leia"'))

  const aberto = raizTemporaria()
  const r = concluir({ raiz: aberto, cfg: aprovado(cfg), base, insumos: insumosDe(todas), log: log0, dataExecucao: '2026-10-05' })
  assert.equal(r.publicado, true)
  const b = app(aberto)
  assert.equal(b.publicado, true)
  assert.deepEqual(b.ranking.map((x) => x.ticker), ['BBBB3', 'CCCC3', 'DDDD3'], 'Top 3 do cfg de teste')
  assert.deepEqual(b.restante, [{ ticker: 'AAAA3', nome: 'Empresa AAAA3', setor: 'Mineração', posicao: 4, dlEbitda: 0.8333 }])
  assert.deepEqual(b.semEbitdaPositivo.map((x) => x.ticker), ['EEEE3'])
  assert.deepEqual(b.exclusoes.map((x) => [x.ticker, x.codigo]), [['BANC3', 'setor_excluido']])
  assert.equal(b.hashResultado, hashDoResultado(r.resultado))
  assert.equal(b.parametros.liquidezMinimaDiariaReais, base.filtros.liquidezMinimaDiariaReais)
  assert.ok(b.parametros.setoresExcluidos.includes('Bancos'))
  assert.match(b.aviso, /^Não é recomendação de investimento\./)
  assert.ok(!fs.existsSync(path.join(aberto, 'dados-privados')), 'acesso aberto: nada em dados-privados')
})

test('publicação: trava de sanidade derruba o job, a auditoria completa fica gravada e o app NÃO muda', () => {
  const raiz = raizTemporaria()
  fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesEndividadas.json'), '{"sentinela":true}')
  const exigente = { ...aprovado(cfg), publicacao: { ...aprovado(cfg).publicacao, sanidade: { minimoAvaliadas: 50, maximoFracaoSemDados: 0.35 } } }
  assert.throws(() => concluir({ raiz, cfg: exigente, base, insumos: insumosDe(trio()), log: log0, dataExecucao: '2026-10-05' }), /Publicação barrada pela trava de sanidade.*só 3 empresas avaliadas \(mínimo 50\).*foi gravada em auditoria\/acoes-endividadas\/2026-10-05.*o app não foi alterado/)
  assert.equal(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoesEndividadas.json'), 'utf8'), '{"sentinela":true}')
  assert.deepEqual(pastas(raiz), ['2026-10-05'])
})

test('CSV: cabeçalho e linhas com o mesmo número de colunas; nome com ; ou aspas é protegido; lista sem posição não quebra', () => {
  const { resultado } = rodar([empresa('AAAA3', { da: 50, divLP: 650 }), empresa('NEGA3', { ebit: -100, da: 20, divLP: 650 })])
  const nomeEsquisito = { ...resultado.ranking[0], nome: 'Empresa "X"; Y' }
  for (const lista of [[nomeEsquisito], resultado.semEbitdaPositivo]) {
    const linhas = csvRanking(lista).trim().split('\r\n')
    assert.equal(linhas.length, 2)
    const colunas = (l) => { let n = 1; let aspas = false; for (const ch of l) { if (ch === '"') aspas = !aspas; else if (ch === ';' && !aspas) n++ } return n }
    assert.equal(colunas(linhas[0]), colunas(linhas[1]))
  }
  assert.match(csvRanking([nomeEsquisito]), /"Empresa ""X""; Y"/)
})

test('semNotas remove as chaves _ em qualquer nível', () => {
  assert.deepEqual(semNotas({ a: 1, _x: 2, b: { _y: 3, c: [{ _z: 1, d: 4 }] } }), { a: 1, b: { c: [{ d: 4 }] } })
})

// ---------------------------------------------------------------------------------------
// Modo diário (D89): insumos congelados + preço do dia, sem rede
// ---------------------------------------------------------------------------------------

const dias = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))
const historico = (ate, precos) => {
  const datas = dias.slice(0, ate)
  return { pregoes: datas, ativos: Object.fromEntries(Object.entries(precos).map(([t, p]) => [t, datas.map(() => [p, p, p, 5e7])])) }
}
const configAcoesMini = { setores: [{ setor: 'Mineração', empresas: [] }], desdobramentos: {} }

/** Raiz com a auditoria das ações baratas (origem), os configs e o histórico de preços; devolve a raiz. */
function raizComOrigem({ cfgEnd = cfg, hist = historico(29, { AAAA3: 10, BBBB3: 10, CCCC3: 10 }), pastaOrigem = 'auditoria/acoes-baratas/2026-10-05' } = {}) {
  const raiz = raizTemporaria()
  gravar(raiz, 'config/acoes-endividadas.json', cfgEnd)
  gravar(raiz, 'config/acoes-baratas.json', base)
  gravar(raiz, 'config/acoes.json', configAcoesMini)
  gravar(raiz, 'historico/acoes.json', hist)
  const insumos = insumosDe(trio().map((e) => ({ ...e, preco: { ref: null } })))
  fs.mkdirSync(path.join(raiz, pastaOrigem), { recursive: true })
  fs.writeFileSync(path.join(raiz, pastaOrigem, 'insumos.json.gz'), zlib.gzipSync(Buffer.from(JSON.stringify(insumos))))
  gravar(raiz, `${pastaOrigem}/manifesto.json`, { hashes: {} })
  gravar(raiz, 'auditoria/acoes-baratas/ultima.json', { pasta: pastaOrigem })
  return raiz
}
const rodarJob = (raiz, extra = {}) => { const logs = []; const r = executar({ raiz, diaria: true, log: (m) => logs.push(m), ...extra }); return { ...r, logs } }

test('job: sem auditoria das ações baratas não há de onde partir, e o erro diz o que rodar antes', () => {
  const raiz = raizComOrigem()
  fs.rmSync(path.join(raiz, 'auditoria', 'acoes-baratas', 'ultima.json'))
  assert.throws(() => rodarJob(raiz, { hoje: '2026-10-06' }), /Sem auditoria completa das ações baratas/)
})

test('job diário: a 1ª execução do mês grava a pasta completa a partir da das ações baratas; o dia seguinte reaproveita, troca só o preço e não grava pasta', () => {
  const raiz = raizComOrigem()
  const r1 = rodarJob(raiz, { hoje: '2026-10-06' })
  assert.equal(r1.modo, 'completa')
  assert.ok(r1.logs.some((l) => /Auditoria: COMPLETA · ainda não há auditoria completa gravada/.test(l)))
  assert.deepEqual(pastas(raiz), ['2026-10-06'])
  assert.deepEqual(r1.resultado.ranking.map((x) => x.ticker), ['BBBB3', 'CCCC3', 'AAAA3'])
  assert.equal(r1.resultado.ranking[0].mktcap, 1000, '100 ações × R$ 10 do histórico')
  assert.equal(lerJson(raiz, 'auditoria', 'acoes-endividadas', '2026-10-06', 'manifesto.json').origemInsumos, 'auditoria/acoes-baratas/2026-10-05')
  const ultimaAntes = fs.readFileSync(path.join(raiz, 'auditoria', 'acoes-endividadas', 'ultima.json'), 'utf8')

  // o preço sobe 50% no dia seguinte: o valor de mercado muda; dívida líquida, EBITDA e razão NÃO (vêm do balanço)
  gravar(raiz, 'historico/acoes.json', historico(30, { AAAA3: 15, BBBB3: 15, CCCC3: 15 }))
  const r2 = rodarJob(raiz, { hoje: '2026-10-07' })
  assert.equal(r2.modo, 'diaria')
  assert.ok(r2.logs.some((l) => /Auditoria: diária/.test(l)))
  assert.ok(r2.logs.some((l) => /Conferência independente: OK/.test(l)))
  assert.deepEqual(pastas(raiz), ['2026-10-06'], 'nenhuma pasta nova')
  assert.equal(fs.readFileSync(path.join(raiz, 'auditoria', 'acoes-endividadas', 'ultima.json'), 'utf8'), ultimaAntes)
  assert.equal(r2.resultado.ranking[0].mktcap, 1500)
  assert.equal(r2.resultado.ranking[0].cotacao, 15)
  assert.deepEqual(r2.resultado.ranking.map((x) => [x.ticker, x.dlEbitda]), r1.resultado.ranking.map((x) => [x.ticker, x.dlEbitda]))
  const a = app(raiz)
  assert.equal(a.modoAuditoria, 'diaria')
  assert.equal(a.auditoriaCompletaEm, '2026-10-06')
  assert.equal(a.pastaAuditoria, 'auditoria/acoes-endividadas/2026-10-06')
  assert.equal(a.dataExecucao, '2026-10-07')
  assert.equal(a.dataPrecos, '2026-09-30')
  assert.equal(a.hashResultado, r2.hashes.resultado)
  assert.notEqual(a.hashResultado, r1.hashes.resultado, 'a impressão digital é a do dia')
  const v = verificar(path.join(raiz, 'auditoria', 'acoes-endividadas', '2026-10-06'), raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
})

test('job diário: virada de mês, parâmetros novos (desta lista ou das ações baratas), código de cálculo novo, insumos de origem novos e --completa gravam a pasta completa', () => {
  const raiz = raizComOrigem()
  rodarJob(raiz, { hoje: '2026-10-06' })
  assert.equal(rodarJob(raiz, { hoje: '2026-10-07' }).modo, 'diaria')

  assert.match(rodarJob(raiz, { hoje: '2026-11-03' }).logs.find((l) => /Auditoria:/.test(l)), /COMPLETA · primeira execução do mês/)
  assert.deepEqual(pastas(raiz), ['2026-10-06', '2026-11-03'])
  assert.equal(rodarJob(raiz, { hoje: '2026-11-04' }).modo, 'diaria')

  gravar(raiz, 'config/acoes-endividadas.json', { ...cfg, tamanhoDaLista: 2 })
  assert.match(rodarJob(raiz, { hoje: '2026-11-05' }).logs.find((l) => /Auditoria:/.test(l)), /COMPLETA · os parâmetros mudaram/)
  gravar(raiz, 'config/acoes-endividadas.json', cfg)
  assert.equal(rodarJob(raiz, { hoje: '2026-11-06' }).modo, 'completa', 'voltar ao config antigo também muda o hash da última completa')
  assert.equal(rodarJob(raiz, { hoje: '2026-11-07' }).modo, 'diaria')

  gravar(raiz, 'config/acoes-baratas.json', { ...base, filtros: { ...base.filtros, liquidezMinimaDiariaReais: 4_000_000 } })
  assert.match(rodarJob(raiz, { hoje: '2026-11-08' }).logs.find((l) => /Auditoria:/.test(l)), /COMPLETA · os parâmetros mudaram/)
  assert.equal(rodarJob(raiz, { hoje: '2026-11-09' }).modo, 'diaria')

  fs.appendFileSync(path.join(raiz, 'scripts', 'acoes-baratas-calculo.mjs'), '\n// alteração qualquer\n')
  assert.match(rodarJob(raiz, { hoje: '2026-11-10' }).logs.find((l) => /Auditoria:/.test(l)), /COMPLETA · o código de cálculo mudou/)
  assert.equal(rodarJob(raiz, { hoje: '2026-11-11' }).modo, 'diaria')

  // a triagem das ações baratas regravou a auditoria dela (balanços novos): os insumos congelados desta lista ficaram velhos
  const nova = 'auditoria/acoes-baratas/2026-11-12'
  fs.mkdirSync(path.join(raiz, nova), { recursive: true })
  fs.copyFileSync(path.join(raiz, 'auditoria/acoes-baratas/2026-10-05/insumos.json.gz'), path.join(raiz, nova, 'insumos.json.gz'))
  gravar(raiz, `${nova}/manifesto.json`, { hashes: {} })
  gravar(raiz, 'auditoria/acoes-baratas/ultima.json', { pasta: nova })
  const r = rodarJob(raiz, { hoje: '2026-11-12' })
  assert.match(r.logs.find((l) => /Auditoria:/.test(l)), /COMPLETA · os insumos de origem mudaram/)
  assert.equal(lerJson(raiz, 'auditoria', 'acoes-endividadas', '2026-11-12', 'manifesto.json').origemInsumos, nova)

  assert.equal(rodarJob(raiz, { hoje: '2026-11-13', forcarCompleta: true }).modo, 'completa')
  assert.equal(rodarJob(raiz, { hoje: '2026-11-14' }).modo, 'diaria')
})

test('job sem a opção `diaria`: sempre grava a pasta (comportamento de execução manual simples)', () => {
  const raiz = raizComOrigem()
  executar({ raiz, hoje: '2026-10-06', log: log0 })
  executar({ raiz, hoje: '2026-10-07', log: log0 })
  assert.deepEqual(pastas(raiz), ['2026-10-06', '2026-10-07'])
})

test('job: sem a pasta congelada própria (apagada), o modo diário cai sozinho para a completa', () => {
  const raiz = raizComOrigem()
  rodarJob(raiz, { hoje: '2026-10-06' })
  fs.rmSync(path.join(raiz, 'auditoria', 'acoes-endividadas', '2026-10-06', 'insumos.json.gz'))
  const r = rodarJob(raiz, { hoje: '2026-10-07' })
  assert.equal(r.modo, 'completa')
  assert.ok(r.logs.some((l) => /não foi possível reaproveitar os insumos congelados/.test(l)))
})

test('snapshot do app: montarSnapshotApp aponta para a pasta completa e leva a data da execução e do último pregão', () => {
  const { resultado } = rodar(trio())
  const manifesto = { geradoEm: '2026-10-07T01:00:00Z', hashes: { resultado: 'r'.repeat(64), insumos: 'i'.repeat(64), config: 'c'.repeat(64) } }
  const s = montarSnapshotApp({ resultado, cfg: aprovado(cfg), base, manifesto, pasta: 'auditoria/acoes-endividadas/2026-10-06', publicado: true, dataExecucao: '2026-10-07', modo: 'diaria' })
  assert.deepEqual([s.dataExecucao, s.dataPrecos, s.modoAuditoria, s.auditoriaCompletaEm, s.pastaAuditoria], ['2026-10-07', '2026-09-30', 'diaria', '2026-10-06', 'auditoria/acoes-endividadas/2026-10-06'])
  assert.equal(s.ranking.length, 3)
  assert.equal(s.tamanhoDaLista, 3)
})
