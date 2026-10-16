// Auditoria diária dos Top 15 (D89): o ranking é recalculado todo dia útil, mas a pasta de auditoria completa só é
// gravada na primeira execução do mês (ou quando parâmetros/código mudam). Estes testes fixam:
//   - a regra de decisão (completa x diária) e a conferência independente em memória;
//   - o comportamento do job dos "mais negociados" (sem pasta nova, sem mexer em ultima.json, ranking com o preço do dia);
//   - o modo diário dos FIIs baratos e das ações baratas (insumos congelados + preço do dia = o mesmo que a execução completa).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { conferirEmMemoria, dataDaPasta, decidirModo, lerAuditoriaCompleta, mesDe } from './auditoria-diaria.mjs'
import { calcularEtfs, canonico, hashDoResultado, sha256 } from './top15-mercado-calculo.mjs'
import { concluir } from './atualizar-top15-mercado.mjs'
import { verificar } from './top15-mercado-verificar.mjs'
import { subtrairMes } from './fii-baratos-calculo.mjs'
import { atualizarPrecosDosInsumos as atualizarFii, concluir as concluirFii, executar as executarFii, montarInsumos as montarInsumosFii } from './atualizar-fii-baratos.mjs'
import { verificar as verificarFii } from './fii-baratos-verificar.mjs'
import { atualizarPrecosDosInsumos as atualizarAcoes, concluir as concluirAcoes, executar as executarAcoes, montarInsumos as montarInsumosAcoes } from './atualizar-acoes-baratas.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const lerJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'))

// ---------------------------------------------------------------------------------------
// Regra de decisão
// ---------------------------------------------------------------------------------------

const ultima = { pasta: 'auditoria/top15-etfs/2026-10-08', dataExecucao: '2026-10-08' }
const manifesto = { hashes: { config: 'cfg1' }, codigo: { calculoSha256: 'calc1' } }
const base = { ultima, manifesto, hoje: '2026-10-15', hashConfig: 'cfg1', calculoSha256: 'calc1' }

test('decidirModo: mesmo mês, mesma config e mesmo código = diária', () => {
  const d = decidirModo(base)
  assert.equal(d.modo, 'diaria')
  assert.match(d.motivo, /2026-10-08/)
})

test('decidirModo: cada gatilho da auditoria completa (sem pasta, virada de mês, config, código e pedido)', () => {
  assert.equal(decidirModo({ ...base, ultima: null, manifesto: null }).modo, 'completa')
  assert.match(decidirModo({ ...base, ultima: null, manifesto: null }).motivo, /ainda não há/)
  assert.match(decidirModo({ ...base, hoje: '2026-11-02' }).motivo, /primeira execução do mês/)
  assert.match(decidirModo({ ...base, hashConfig: 'cfg2' }).motivo, /parâmetros mudaram/)
  assert.match(decidirModo({ ...base, calculoSha256: 'calc2' }).motivo, /código de cálculo mudou/)
  assert.match(decidirModo({ ...base, forcarCompleta: true }).motivo, /pedida/)
  for (const d of [{ ...base, hoje: '2026-11-02' }, { ...base, hashConfig: 'cfg2' }, { ...base, calculoSha256: 'calc2' }, { ...base, forcarCompleta: true }]) assert.equal(decidirModo(d).modo, 'completa')
})

test('decidirModo: vale a data de EXECUÇÃO, não o nome da pasta (a das ações usa o último pregão, que pode ser do mês anterior)', () => {
  const u = { pasta: 'auditoria/acoes-baratas/2026-10-30', dataExecucao: '2026-11-02' }
  assert.equal(decidirModo({ ...base, ultima: u, hoje: '2026-11-03' }).modo, 'diaria')
  // ultima.json antigo, sem dataExecucao: cai para o nome da pasta
  assert.equal(decidirModo({ ...base, ultima: { pasta: 'auditoria/acoes-baratas/2026-10-05' }, hoje: '2026-10-20' }).modo, 'diaria')
  assert.equal(decidirModo({ ...base, ultima: { pasta: 'auditoria/acoes-baratas/2026-10-05' }, hoje: '2026-11-03' }).modo, 'completa')
})

test('mesDe e dataDaPasta', () => {
  assert.equal(mesDe('2026-10-08'), '2026-10')
  assert.equal(dataDaPasta({ pasta: 'auditoria/x/2026-10-08' }), '2026-10-08')
  assert.equal(dataDaPasta(null), null)
})

test('lerAuditoriaCompleta: sem arquivos devolve nulos (força a completa)', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-diaria-'))
  assert.deepEqual(lerAuditoriaCompleta(raiz, 'top15-etfs'), { ultima: null, manifesto: null })
})

// ---------------------------------------------------------------------------------------
// Conferência independente em memória
// ---------------------------------------------------------------------------------------

const insumosMini = { v: 1 }
const cfgMini = { versaoMetodologia: '1.0.0' }
const calcMini = (ins) => ({ resultado: { soma: ins.v + 1 }, memoria: {} })
const hashesMini = { insumos: sha256(canonico(insumosMini)), config: sha256(canonico(cfgMini)), resultado: hashDoResultado({ soma: 2 }) }

test('conferirEmMemoria: cálculo consistente = nenhum problema', () => {
  assert.deepEqual(conferirEmMemoria({ calcular: calcMini, canonico, sha256, hashDoResultado, insumos: insumosMini, cfg: cfgMini, hashes: hashesMini }), [])
})

test('conferirEmMemoria: DETECTA resultado que não se reproduz, insumos e config que mudam ao gravar e reler', () => {
  const naoDeterministico = (() => { let n = 0; return (ins) => ({ resultado: { soma: ins.v + 1 + ++n }, memoria: {} }) })() // a "segunda" conta dá outro número
  const p1 = conferirEmMemoria({ calcular: naoDeterministico, canonico, sha256, hashDoResultado, insumos: insumosMini, cfg: cfgMini, hashes: { ...hashesMini, resultado: hashDoResultado({ soma: 2 }) } })
  assert.ok(p1.some((x) => /resultado recalculado diverge/.test(x)))
  // uma data (objeto Date) vira texto ao gravar em JSON: o que foi gravado não é o que foi calculado
  const comBuraco = { v: 1, quando: new Date(0) }
  const p2 = conferirEmMemoria({ calcular: calcMini, canonico, sha256, hashDoResultado, insumos: comBuraco, cfg: cfgMini, hashes: { ...hashesMini, insumos: sha256(canonico(comBuraco)) } })
  assert.ok(p2.some((x) => /insumos diverge/.test(x)))
  const cfgBuraco = { ...cfgMini, quando: new Date(0) }
  const p3 = conferirEmMemoria({ calcular: calcMini, canonico, sha256, hashDoResultado, insumos: insumosMini, cfg: cfgBuraco, hashes: { ...hashesMini, config: sha256(canonico(cfgBuraco)) } })
  assert.ok(p3.some((x) => /config diverge/.test(x)))
})

// ---------------------------------------------------------------------------------------
// Job dos "mais negociados": execução diária
// ---------------------------------------------------------------------------------------

const cfgArquivo = lerJson(RAIZ, 'config', 'top15-etfs.json')
const cfg = { ...cfgArquivo, tamanhoDaLista: 3, tamanhoPorCategoria: 1, janelaLiquidez: 5, janela3Meses: 8, volumeMinimoDiario: 100, diasNegociadosMinimos: 3, pregoesMaxSemNegocio: 2,
  publicacao: { ...cfgArquivo.publicacao, aprovadoPeloResponsavel: true, sanidade: { minimoNaLista: 1, maximoFracaoSemCotacao: 0.9 } } }
const N = 14
const datas = (ate = N) => Array.from({ length: ate }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))
const serie = (preco, volume) => new Array(N).fill(null).map(() => [preco, preco * 0.99, preco * 1.01, volume])
const insumos = (dataExecucao, volA, volB) => ({ classe: 'etfs', dataExecucao, pregoes: datas(), ordemCategorias: ['Bolsa'], excluidos: [],
  ativos: [{ ticker: 'AAAA11', nome: 'A', categoria: 'Bolsa', serie: serie(10, volA) }, { ticker: 'BBBB11', nome: 'B', categoria: 'Bolsa', serie: serie(11, volB) }] })

const raizTemporaria = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-diaria-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const f of ['top15-mercado-calculo.mjs', 'atualizar-top15-mercado.mjs']) fs.copyFileSync(path.join(AQUI, f), path.join(raiz, 'scripts', f))
  return raiz
}
const executar = (raiz, ins, extra = {}) => { const logs = []; const r = concluir({ raiz, classe: 'etfs', cfg, insumos: ins, log: (m) => logs.push(m), diaria: true, ...extra }); return { ...r, logs } }
const pastasDeAuditoria = (raiz) => fs.readdirSync(path.join(raiz, 'auditoria', 'top15-etfs')).filter((n) => /^\d{4}-/.test(n)).sort()
const appEtfs = (raiz) => lerJson(raiz, 'webapp-src', 'src', 'data', 'etfsMaisNegociados.json')

test('mais negociados: a primeira execução (sem auditoria) grava a pasta completa; o dia seguinte NÃO grava pasta nova', () => {
  const raiz = raizTemporaria()
  const r1 = executar(raiz, insumos('2026-10-08', 500, 900))
  assert.equal(r1.modo, 'completa')
  assert.deepEqual(pastasDeAuditoria(raiz), ['2026-10-08'])
  const ultimaAntes = fs.readFileSync(path.join(raiz, 'auditoria', 'top15-etfs', 'ultima.json'), 'utf8')

  const r2 = executar(raiz, insumos('2026-10-09', 500, 900))
  assert.equal(r2.modo, 'diaria')
  assert.deepEqual(pastasDeAuditoria(raiz), ['2026-10-08'], 'nenhuma pasta nova')
  assert.equal(fs.readFileSync(path.join(raiz, 'auditoria', 'top15-etfs', 'ultima.json'), 'utf8'), ultimaAntes, 'ultima.json continua apontando para a pasta completa')
  assert.ok(r2.logs.some((l) => /Conferência independente: OK/.test(l)))
  const app = appEtfs(raiz)
  assert.equal(app.dataExecucao, '2026-10-09')
  assert.equal(app.modoAuditoria, 'diaria')
  assert.equal(app.auditoriaCompletaEm, '2026-10-08')
  assert.equal(app.pastaAuditoria, 'auditoria/top15-etfs/2026-10-08')
})

test('mais negociados: o ranking do dia reflete o volume do dia; a impressão digital é a do dia, e a pasta do mês continua verificável', () => {
  const raiz = raizTemporaria()
  executar(raiz, insumos('2026-10-08', 500, 900))
  assert.deepEqual(appEtfs(raiz).geral.map((x) => x.ticker), ['BBBB11', 'AAAA11'])
  const r2 = executar(raiz, insumos('2026-10-09', 2000, 900))
  const app = appEtfs(raiz)
  assert.deepEqual(app.geral.map((x) => x.ticker), ['AAAA11', 'BBBB11'], 'a ordem mudou com o dado do dia')
  assert.equal(app.hashResultado, hashDoResultado(r2.resultado))
  assert.equal(app.hashResultado, hashDoResultado(calcularEtfs(insumos('2026-10-09', 2000, 900), cfg).resultado))
  const v = verificar(path.join(raiz, 'auditoria', 'top15-etfs', '2026-10-08'), raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
})

test('mais negociados: virada de mês, mudança de parâmetro e --completa gravam a pasta completa', () => {
  const raiz = raizTemporaria()
  executar(raiz, insumos('2026-10-08', 500, 900))
  assert.equal(executar(raiz, insumos('2026-10-09', 500, 900)).modo, 'diaria')

  const novoMes = executar(raiz, insumos('2026-11-03', 500, 900))
  assert.equal(novoMes.modo, 'completa')
  assert.deepEqual(pastasDeAuditoria(raiz), ['2026-10-08', '2026-11-03'])
  assert.equal(lerJson(raiz, 'auditoria', 'top15-etfs', 'ultima.json').pasta, 'auditoria/top15-etfs/2026-11-03')
  assert.equal(executar(raiz, insumos('2026-11-04', 500, 900)).modo, 'diaria')

  const outraConfig = executar(raiz, insumos('2026-11-05', 500, 900), { cfg: { ...cfg, tamanhoDaLista: 2 } })
  assert.equal(outraConfig.modo, 'completa')
  assert.ok(outraConfig.logs.some((l) => /parâmetros mudaram/.test(l)))

  const forcada = executar(raiz, insumos('2026-11-06', 500, 900), { forcarCompleta: true, cfg: { ...cfg, tamanhoDaLista: 2 } })
  assert.equal(forcada.modo, 'completa')
  assert.ok(pastasDeAuditoria(raiz).includes('2026-11-06'))
})

test('mais negociados: mudança no código de cálculo exige auditoria completa', () => {
  const raiz = raizTemporaria()
  executar(raiz, insumos('2026-10-08', 500, 900))
  fs.appendFileSync(path.join(raiz, 'scripts', 'top15-mercado-calculo.mjs'), '\n// alteração qualquer\n')
  const r = executar(raiz, insumos('2026-10-09', 500, 900))
  assert.equal(r.modo, 'completa')
  assert.ok(r.logs.some((l) => /código de cálculo mudou/.test(l)))
})

test('mais negociados: sem a opção `diaria` o comportamento é o de sempre (pasta por execução)', () => {
  const raiz = raizTemporaria()
  concluir({ raiz, classe: 'etfs', cfg, insumos: insumos('2026-10-08', 500, 900), log: () => {} })
  concluir({ raiz, classe: 'etfs', cfg, insumos: insumos('2026-10-09', 500, 900), log: () => {} })
  assert.deepEqual(pastasDeAuditoria(raiz), ['2026-10-08', '2026-10-09'])
})

test('mais negociados: a trava de sanidade também vale na execução diária (nada é publicado, nenhuma pasta é gravada)', () => {
  const raiz = raizTemporaria()
  executar(raiz, insumos('2026-10-08', 500, 900))
  const antes = fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'etfsMaisNegociados.json'), 'utf8')
  // com a MESMA config (senão viraria completa), a trava falha porque o dia não tem nenhum ETF elegível
  assert.throws(() => executar(raiz, { ...insumos('2026-10-09', 500, 900), ativos: [] }), /trava de sanidade.*Nenhuma pasta foi gravada.*o app não foi alterado/)
  assert.equal(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'etfsMaisNegociados.json'), 'utf8'), antes)
  assert.deepEqual(pastasDeAuditoria(raiz), ['2026-10-08'])
})

// ---------------------------------------------------------------------------------------
// Zip de insumos usado como "congelado": a pasta completa precisa poder ser relida
// ---------------------------------------------------------------------------------------

test('a pasta completa guarda os insumos que o modo diário reaproveita (insumos.json.gz legível)', () => {
  const raiz = raizTemporaria()
  executar(raiz, insumos('2026-10-08', 500, 900))
  const gz = fs.readFileSync(path.join(raiz, 'auditoria', 'top15-etfs', '2026-10-08', 'insumos.json.gz'))
  assert.equal(JSON.parse(zlib.gunzipSync(gz).toString('utf8')).classe, 'etfs')
})

// ---------------------------------------------------------------------------------------
// FIIs baratos: insumos congelados do informe + preço do dia
// ---------------------------------------------------------------------------------------

const cfgFiiArquivo = lerJson(RAIZ, 'config', 'fii-baratos.json')
const cfgFii = {
  ...cfgFiiArquivo,
  dados: { ...cfgFiiArquivo.dados, precoDiarioObrigatorio: false },
  publicacao: { ...cfgFiiArquivo.publicacao, aprovadoPeloResponsavel: true, acesso: { ...cfgFiiArquivo.publicacao.acesso, restritoPorCodigo: false }, sanidade: { minimoNoRankingTijolo: 1, minimoNoRankingPapel: 0, maximoFracaoSemDados: 1 } },
}
const MESES_FII = Array.from({ length: 14 }, (_, i) => subtrairMes('2026-08', 13 - i))
const fundoFii = (ticker, cotacao) => {
  const informes = Object.fromEntries(MESES_FII.map((m) => [m, { versao: 1, dy: 0.008, vp: 100, pat: 0.001, efetiva: 0.009, pl: 5e8, cotistas: 10000, valorAtivo: 5.1e8 }]))
  const ativo = { Direitos_Bens_Imoveis: 900, Fundos_Renda_Fixa: 100, Total_Passivo: 2e7, Rendimentos_Distribuir: 1e6, Taxa_Administracao_Pagar: 1e6 }
  return { ticker, nome: `Fundo ${ticker}`, setor: 'Outros', segmento: 'Multicategoria', cnpj: `${ticker.charCodeAt(0)}${ticker.charCodeAt(1)}`.padStart(14, '0'), origemCnpj: 'ISIN teste', cotacao, dataCotacao: '2026-09-25', volumeMedio: 2e6, volumeMediano: 2e6, informes, ativos: Object.fromEntries(MESES_FII.map((m) => [m, ativo])), precoDiario: null, precoDiarioFonte: 'B3' }
}
const insumosFiiCompletos = () => ({
  esquema: 1, dataExecucao: '2026-10-06', dataCotacoes: '2026-09-25', pregoesDiarios: [],
  contagemPorCompetencia: Object.fromEntries(MESES_FII.map((m) => [m, m === '2026-09' ? 8 : 1300])), medianaDyPorCompetencia: Object.fromEntries(MESES_FII.map((m) => [m, 0.008])),
  fundos: [fundoFii('ALFA11', 80), fundoFii('BETA11', 70)],
})
const pregoes21 = Array.from({ length: 21 }, (_, i) => new Date(Date.UTC(2026, 8, 18 + i)).toISOString().slice(0, 10)) // 18/09 a 08/10
const historicoFii = (precoAlfa, precoBeta) => ({ pregoes: pregoes21, nomes: {}, complementadosPelaBrapi: [], ativos: {
  ALFA11: pregoes21.map(() => [precoAlfa, precoAlfa, precoAlfa, 2e6]),
  BETA11: pregoes21.map(() => [precoBeta, precoBeta, precoBeta, 2e6]),
} })
const raizFii = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-fii-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['fii-baratos-calculo.mjs', 'atualizar-fii-baratos.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  for (const d of ['config', 'historico', path.join('webapp-src', 'src', 'data')]) fs.mkdirSync(path.join(raiz, d), { recursive: true })
  return raiz
}
const gravar = (raiz, rel, obj) => fs.writeFileSync(path.join(raiz, ...rel.split('/')), JSON.stringify(obj))
const snapshotFii = { geradoEm: '2026-09-25T01:00:00Z', fundos: [
  { ticker: 'ALFA11', nome: 'Fundo ALFA11', setor: 'Outros', cotacao: 80, dataCotacao: '2026-09-25', volumeMedio: 2e6, volumeMediano: 2e6 },
  { ticker: 'BETA11', nome: 'Fundo BETA11', setor: 'Outros', cotacao: 70, dataCotacao: '2026-09-25', volumeMedio: 2e6, volumeMediano: 2e6 },
] }
const pastasFii = (raiz) => fs.readdirSync(path.join(raiz, 'auditoria', 'fii-baratos')).filter((n) => /^\d{4}-/.test(n))
const appFii = (raiz) => lerJson(raiz, 'webapp-src', 'src', 'data', 'fiiBaratos.json')

test('FIIs baratos: com os mesmos dados de entrada, "informe congelado + preço do dia" dá EXATAMENTE os insumos da execução completa', () => {
  const A = '11.111.111/0001-11'
  const meses = ['2026-06', '2026-07', '2026-08']
  const cfgBase = lerJson(RAIZ, 'config', 'fii-baratos.json')
  const complemento = meses.map((m) => ({ CNPJ_Fundo_Classe: A, Data_Referencia: `${m}-01`, Versao: '1', Percentual_Dividend_Yield_Mes: '0.008', Valor_Patrimonial_Cotas: '100', Percentual_Rentabilidade_Patrimonial_Mes: '0.001', Percentual_Rentabilidade_Efetiva_Mes: '0.009', Patrimonio_Liquido: '500000000', Total_Numero_Cotistas: '9000', Valor_Ativo: '510000000' }))
  const geral = [{ CNPJ_Fundo_Classe: A, Codigo_ISIN: 'BRXXXXCTF001', Nome_Fundo_Classe: 'NOVO', Segmento_Atuacao: 'Shoppings' }]
  const ativo = meses.map((m) => ({ CNPJ_Fundo_Classe: A, Data_Referencia: `${m}-01`, Versao: '1', Direitos_Bens_Imoveis: '900', Fundos_Renda_Fixa: '100', Total_Passivo: '20000000', Rendimentos_Distribuir: '1000000', Taxa_Administracao_Pagar: '0' }))
  const snapshot = { geradoEm: '2026-09-25T01:00:00Z', fundos: [{ ticker: 'XXXX11', nome: 'Novo', setor: 'Shoppings', cotacao: 80, dataCotacao: '2026-09-25', volumeMedio: 2e6, volumeMediano: 1.5e6 }, { ticker: 'NADA11', cotacao: 10, dataCotacao: '2026-09-25', volumeMedio: 1 }] }
  const datasH = Array.from({ length: 25 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const historicoPrecos = { pregoes: datasH, nomes: {}, complementadosPelaBrapi: ['NADA11'], ativos: { XXXX11: datasH.map((_, i) => (i === 24 ? null : [80 + i, 79, 81 + i, 1e6 + i])) } }
  const completos = montarInsumosFii({ complemento, geral, ativo, snapshot, cfg: cfgBase, dataExecucao: '2026-10-06', historicoPrecos })
  // os "congelados" são os insumos de um dia anterior, com preços velhos
  const velhos = { ...completos, dataExecucao: '2026-10-01', fundos: completos.fundos.map((f) => ({ ...f, precoDiario: null, cotacao: 1 })) }
  const atualizados = atualizarFii({ congelados: velhos, snapshot, historicoPrecos, cfg: cfgBase, dataExecucao: '2026-10-06' })
  assert.equal(canonico(atualizados), canonico(completos))
  assert.equal(canonico(atualizados.fundos.map((f) => f.informes)), canonico(velhos.fundos.map((f) => f.informes)), 'o informe da CVM vem do congelado')
})

test('FIIs baratos: o dia seguinte reaproveita o informe, usa o preço novo, não grava pasta e a pasta do mês continua verificável', async () => {
  const raiz = raizFii()
  gravar(raiz, 'config/fii-baratos.json', cfgFii)
  gravar(raiz, 'webapp-src/src/data/rendimentosFii.json', snapshotFii)
  gravar(raiz, 'historico/fiis.json', historicoFii(80, 70))
  const completa = concluirFii({ raiz, cfg: cfgFii, insumos: insumosFiiCompletos(), log: () => {} })
  assert.equal(completa.modo, 'completa')
  assert.deepEqual(appFii(raiz).tijolo.map((x) => x.ticker), ['BETA11', 'ALFA11'], 'preço mensal: BETA11 (70) é mais barato que ALFA11 (80)')
  const ultimaAntes = fs.readFileSync(path.join(raiz, 'auditoria', 'fii-baratos', 'ultima.json'), 'utf8')

  // o mercado vira: ALFA11 cai para 65 e BETA11 sobe para 90
  gravar(raiz, 'historico/fiis.json', historicoFii(65, 90))
  const logs = []
  const dia = await executarFii({ raiz, hoje: '2026-10-09', diaria: true, log: (m) => logs.push(m) })
  assert.equal(dia.modo, 'diaria')
  assert.ok(logs.some((l) => /Auditoria: diária/.test(l)))
  assert.ok(logs.some((l) => /Conferência independente: OK/.test(l)))
  assert.deepEqual(pastasFii(raiz), ['2026-10-06'], 'nenhuma pasta nova')
  assert.equal(fs.readFileSync(path.join(raiz, 'auditoria', 'fii-baratos', 'ultima.json'), 'utf8'), ultimaAntes)
  const app = appFii(raiz)
  assert.deepEqual(app.tijolo.map((x) => x.ticker), ['ALFA11', 'BETA11'], 'o ranking acompanhou o preço do dia')
  assert.equal(app.tijolo[0].cotacao, 65)
  assert.equal(app.dataExecucao, '2026-10-09')
  assert.equal(app.ultimoPregaoDiario, '2026-10-08')
  assert.equal(app.modoAuditoria, 'diaria')
  assert.equal(app.auditoriaCompletaEm, '2026-10-06')
  assert.equal(app.pastaAuditoria, 'auditoria/fii-baratos/2026-10-06')
  assert.equal(app.hashResultado, dia.hashes.resultado)
  const v = verificarFii(path.join(raiz, 'auditoria', 'fii-baratos', '2026-10-06'), raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
})

test('FIIs baratos: virada de mês e parâmetros novos pedem a auditoria completa (aqui sem rede: o informe não baixa e a execução falha)', async () => {
  const raiz = raizFii()
  gravar(raiz, 'config/fii-baratos.json', cfgFii)
  gravar(raiz, 'webapp-src/src/data/rendimentosFii.json', snapshotFii)
  gravar(raiz, 'historico/fiis.json', historicoFii(80, 70))
  concluirFii({ raiz, cfg: cfgFii, insumos: insumosFiiCompletos(), log: () => {} })
  const semRede = async () => ({ status: 404, ok: false }) // a CVM "não publicou": a execução falha logo, sem tentar de novo
  const logs = []
  // novo mês → tenta a completa e vai à CVM (que, no teste, está fora do ar)
  await assert.rejects(() => executarFii({ raiz, hoje: '2026-11-03', diaria: true, fetchImpl: semRede, log: (m) => logs.push(m) }))
  assert.ok(logs.some((l) => /Auditoria: COMPLETA · primeira execução do mês/.test(l)))
  // parâmetros mudaram no mesmo mês
  gravar(raiz, 'config/fii-baratos.json', { ...cfgFii, tamanhoDaLista: 7 })
  const logs2 = []
  await assert.rejects(() => executarFii({ raiz, hoje: '2026-10-09', diaria: true, fetchImpl: semRede, log: (m) => logs2.push(m) }))
  assert.ok(logs2.some((l) => /COMPLETA · os parâmetros mudaram/.test(l)))
  // e a opção explícita
  gravar(raiz, 'config/fii-baratos.json', cfgFii)
  const logs3 = []
  await assert.rejects(() => executarFii({ raiz, hoje: '2026-10-09', diaria: true, forcarCompleta: true, fetchImpl: semRede, log: (m) => logs3.push(m) }))
  assert.ok(logs3.some((l) => /COMPLETA · pedida/.test(l)))
})

test('FIIs baratos: sem o histórico de preço diário não há como atualizar o preço: cai para a completa', async () => {
  const raiz = raizFii()
  gravar(raiz, 'config/fii-baratos.json', cfgFii)
  gravar(raiz, 'webapp-src/src/data/rendimentosFii.json', snapshotFii)
  concluirFii({ raiz, cfg: cfgFii, insumos: insumosFiiCompletos(), log: () => {} })
  const logs = []
  await assert.rejects(() => executarFii({ raiz, hoje: '2026-10-09', diaria: true, fetchImpl: async () => ({ status: 404, ok: false }), log: (m) => logs.push(m) }))
  assert.ok(logs.some((l) => /COMPLETA · não foi possível reaproveitar/.test(l)))
})

// ---------------------------------------------------------------------------------------
// Ações baratas: demonstrações congeladas + preço do dia
// ---------------------------------------------------------------------------------------

const cfgAcoes = lerJson(RAIZ, 'config', 'acoes-baratas.json')
const diasAcoes = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)) // 01/09 a 30/09
const historicoAcoes = (ate, precoAAAA, precoBBBB) => {
  const datas = ate ? diasAcoes.slice(0, ate) : diasAcoes
  return { pregoes: datas, ativos: {
    AAAA3: datas.map(() => [precoAAAA, precoAAAA, precoAAAA, 5e7]),
    BBBB3: datas.map(() => [precoBBBB, precoBBBB, precoBBBB, 5e7]),
  } }
}
const configAcoesMini = { setores: [{ setor: 'Mineração', empresas: [{ ticker: 'AAAA3', nome: 'Empresa A' }, { ticker: 'BBBB3', nome: 'Empresa B' }] }], desdobramentos: {} }
const empresasMini = [{ ticker: 'AAAA3', nome: 'Empresa A', setor: 'Mineração' }, { ticker: 'BBBB3', nome: 'Empresa B', setor: 'Mineração' }]
const mapeamentoMini = [{ ticker: 'AAAA3', cnpj: '11.111.111/0001-11', origem: 'teste' }, { ticker: 'BBBB3', cnpj: '22.222.222/0001-22', origem: 'teste' }]
const contabeisMini = new Map([['11111111000111', { docs: [], linhas: [], capital: [] }], ['22222222000122', { docs: [], linhas: [], capital: [] }]])

test('ações baratas: "demonstrações congeladas + preço do dia" dá EXATAMENTE os insumos da execução completa (só o preço muda)', () => {
  const hist1 = historicoAcoes(29, 10, 12)
  const hist2 = historicoAcoes(30, 14, 12)
  const congelados = montarInsumosAcoes({ empresas: empresasMini, historico: hist1, configAcoes: configAcoesMini, cfg: cfgAcoes, mapeamento: mapeamentoMini, contabeis: contabeisMini, dataCorte: '2026-03-31' })
  const completos = montarInsumosAcoes({ empresas: empresasMini, historico: hist2, configAcoes: configAcoesMini, cfg: cfgAcoes, mapeamento: mapeamentoMini, contabeis: contabeisMini, dataCorte: '2026-03-31' })
  const atualizados = atualizarAcoes({ congelados, historico: hist2, configAcoes: configAcoesMini, cfg: cfgAcoes })
  assert.equal(canonico(atualizados), canonico(completos))
  assert.equal(atualizados.dataPrecos, '2026-09-30')
  assert.equal(atualizados.empresas[0].preco.ref.fechamento, 14, 'o preço novo')
  assert.equal(atualizados.empresas[1].preco.ref.fechamento, 12)
  assert.equal(canonico(atualizados.empresas.map((e) => e.contabil)), canonico(congelados.empresas.map((e) => e.contabil)), 'a contabilidade é a congelada')
  assert.equal(atualizados.dataCorte, '2026-03-31')
})

const raizAcoes = () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-acoes-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['acoes-baratas-calculo.mjs', 'acoes-baratas-cvm.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  for (const d of ['config', 'historico', path.join('webapp-src', 'src', 'data')]) fs.mkdirSync(path.join(raiz, d), { recursive: true })
  return raiz
}
const cfgAcoesLivre = { ...cfgAcoes, publicacao: { ...cfgAcoes.publicacao, aprovadoPeloResponsavel: false } }
const pastasAcoes = (raiz) => fs.readdirSync(path.join(raiz, 'auditoria', 'acoes-baratas')).filter((n) => /^\d{4}-/.test(n))

test('ações baratas: o dia seguinte reaproveita as demonstrações, usa o preço novo, não grava pasta e a pasta do mês continua verificável', async () => {
  const raiz = raizAcoes()
  gravar(raiz, 'config/acoes-baratas.json', cfgAcoesLivre)
  gravar(raiz, 'config/acoes.json', configAcoesMini)
  gravar(raiz, 'historico/acoes.json', historicoAcoes(29, 10, 12))
  const completos = montarInsumosAcoes({ empresas: empresasMini, historico: historicoAcoes(29, 10, 12), configAcoes: configAcoesMini, cfg: cfgAcoesLivre, mapeamento: mapeamentoMini, contabeis: contabeisMini, dataCorte: '2026-03-31' })
  const r1 = concluirAcoes({ raiz, cfg: cfgAcoesLivre, empresas: empresasMini, mapeamento: mapeamentoMini, insumos: completos, log: () => {}, agora: new Date('2026-10-05T12:00:00Z') })
  assert.equal(r1.publicado, false)
  assert.deepEqual(pastasAcoes(raiz), ['2026-09-29'])
  assert.equal(lerJson(raiz, 'auditoria', 'acoes-baratas', 'ultima.json').dataExecucao, '2026-10-05')
  const ultimaAntes = fs.readFileSync(path.join(raiz, 'auditoria', 'acoes-baratas', 'ultima.json'), 'utf8')

  gravar(raiz, 'historico/acoes.json', historicoAcoes(30, 14, 12))
  const logs = []
  const dia = await executarAcoes({ raiz, hoje: '2026-10-06', diaria: true, log: (m) => logs.push(m) })
  assert.equal(dia.modo, 'diaria')
  assert.ok(logs.some((l) => /Auditoria: diária/.test(l)))
  assert.ok(logs.some((l) => /Conferência independente: OK/.test(l)))
  assert.deepEqual(pastasAcoes(raiz), ['2026-09-29'], 'nenhuma pasta nova')
  assert.equal(fs.readFileSync(path.join(raiz, 'auditoria', 'acoes-baratas', 'ultima.json'), 'utf8'), ultimaAntes)
  const app = lerJson(raiz, 'webapp-src', 'src', 'data', 'acoesBaratas.json')
  assert.equal(app.dataPrecos, '2026-09-30')
  assert.equal(app.modoAuditoria, 'diaria')
  assert.equal(app.auditoriaCompletaEm, '2026-09-29')
  assert.equal(app.pastaAuditoria, 'auditoria/acoes-baratas/2026-09-29')
  assert.equal(app.hashResultado, dia.hashes.resultado)
  assert.notEqual(app.hashResultado, r1.hashes.resultado, 'a impressão digital é a do dia')
  const { verificar: verificarAcoes } = await import('./acoes-baratas-verificar.mjs')
  const v = verificarAcoes(path.join(raiz, 'auditoria', 'acoes-baratas', '2026-09-29'), raiz)
  assert.equal(v.ok, true, JSON.stringify(v.mensagens.filter((m) => !m.ok)))
})

test('ações baratas: data de corte manual, virada de mês e parâmetros novos pedem a auditoria completa (sem rede, a CVM não baixa)', async () => {
  const raiz = raizAcoes()
  gravar(raiz, 'config/acoes-baratas.json', cfgAcoesLivre)
  gravar(raiz, 'config/acoes.json', configAcoesMini)
  gravar(raiz, 'historico/acoes.json', historicoAcoes(29, 10, 12))
  const completos = montarInsumosAcoes({ empresas: empresasMini, historico: historicoAcoes(29, 10, 12), configAcoes: configAcoesMini, cfg: cfgAcoesLivre, mapeamento: mapeamentoMini, contabeis: contabeisMini, dataCorte: '2026-03-31' })
  concluirAcoes({ raiz, cfg: cfgAcoesLivre, empresas: empresasMini, mapeamento: mapeamentoMini, insumos: completos, log: () => {}, agora: new Date('2026-10-05T12:00:00Z') })
  const semRede = async () => ({ status: 404, ok: false }) // a CVM "não publicou": a execução falha logo, sem tentar de novo
  const tentar = async (opcoes) => { const logs = []; await assert.rejects(() => executarAcoes({ raiz, diaria: true, fetchImpl: semRede, log: (m) => logs.push(m), ...opcoes })); return logs }
  assert.ok((await tentar({ hoje: '2026-11-03' })).some((l) => /COMPLETA · primeira execução do mês/.test(l)))
  assert.ok((await tentar({ hoje: '2026-10-06', dataCorte: '2026-06-30' })).some((l) => /COMPLETA · pedida/.test(l)))
  assert.ok((await tentar({ hoje: '2026-10-06', forcarCompleta: true })).some((l) => /COMPLETA · pedida/.test(l)))
  gravar(raiz, 'config/acoes-baratas.json', { ...cfgAcoesLivre, tamanhoDaLista: 5 })
  assert.ok((await tentar({ hoje: '2026-10-06' })).some((l) => /COMPLETA · os parâmetros mudaram/.test(l)))
})