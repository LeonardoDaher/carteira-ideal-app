import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'
import { ALFABETO, gerarCodigo } from './gerar-codigo-top15.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { modulos, limpar } = await carregarTs(path.join(RAIZ, 'api'), ['_top15.ts', 'top15.ts'])
test.after(() => limpar())
const A = modulos['_top15.ts']

const DADOS = { publicado: true, versaoMetodologia: '1.0.0', ranking: [{ ticker: 'AAAA3' }], exclusoes: [] }

function resFalsa() {
  const r = { statusCode: null, cabecalhos: {}, corpo: undefined, terminou: false }
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.corpo = b; r.terminou = true; return r }
  r.end = () => { r.terminou = true; return r }
  return r
}
const req = (corpo, { metodo = 'POST', ip = '203.0.113.7' } = {}) => ({ method: metodo, headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` }, body: corpo, socket: { remoteAddress: '10.0.0.1' } })

function montar(over = {}) {
  const eventos = []
  const chavesVistas = new Set()
  let agora = 1_000_000
  const memoria = A.limitadorEmMemoria(() => agora)
  const limitador = { falhas: (k) => (chavesVistas.add(k), memoria.falhas(k)), registrarFalha: (k) => (chavesVistas.add(k), memoria.registrarFalha(k)) }
  const dep = { codigos: () => 'CI-ABCD-EFGH', lerDados: async () => DADOS, limitador, contar: async (e) => { eventos.push(e) }, sal: 'sal-de-teste', ...over }
  return { handler: A.criarHandler(dep), eventos, chavesVistas, avancar: (s) => { agora += s * 1000 } }
}
const chamar = async (h, corpo, opts) => { const r = resFalsa(); await h(req(corpo, opts), r); return r }

test('código: normalização, lista de códigos e comparação', () => {
  assert.equal(A.normalizarCodigo(' ci-abcd efgh '), 'CIABCDEFGH')
  assert.equal(A.normalizarCodigo('ci_abcd.efgh'), 'CIABCDEFGH')
  assert.equal(A.normalizarCodigo(123), '')
  assert.equal(A.normalizarCodigo('x'.repeat(65)), '', 'entrada gigante é descartada')
  assert.deepEqual(A.listaDeCodigos('CI-AAAA-BBBB, ci-cccc-dddd'), ['CIAAAABBBB', 'CICCCCDDDD'])
  assert.deepEqual(A.listaDeCodigos('abc, 1234567'), [], 'códigos com menos de 8 caracteres são ignorados')
  assert.deepEqual(A.listaDeCodigos(undefined), [])
  const validos = A.listaDeCodigos('CI-AAAA-BBBB,CI-CCCC-DDDD')
  assert.equal(A.codigoConfere('ci aaaa bbbb', validos), true)
  assert.equal(A.codigoConfere('CI-CCCC-DDDD', validos), true)
  assert.equal(A.codigoConfere('CI-AAAA-BBBC', validos), false)
  assert.equal(A.codigoConfere('', validos), false)
  assert.equal(A.codigoConfere('CI-AAAA-BBBB', []), false)
})

test('IP: usa o primeiro do x-forwarded-for; a chave guarda só hash, nunca o IP', () => {
  assert.equal(A.ipDe({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), '203.0.113.7')
  assert.equal(A.ipDe({ 'x-real-ip': '198.51.100.2' }), '198.51.100.2')
  assert.equal(A.ipDe({}, '10.1.1.1'), '10.1.1.1')
  assert.equal(A.ipDe({}), 'desconhecido')
  const k = A.chaveDeFalhas('203.0.113.7', 'sal')
  assert.match(k, /^top15:falhas:[0-9a-f]{24}$/)
  assert.ok(!k.includes('203') && !k.includes('113'))
  assert.notEqual(A.chaveDeFalhas('203.0.113.7', 'outro-sal'), k)
})

test('porta fechada: método errado, preflight, sem código configurado e código ausente', async () => {
  const { handler } = montar()
  assert.equal((await chamar(handler, {}, { metodo: 'GET' })).statusCode, 405)
  assert.equal((await chamar(handler, {}, { metodo: 'OPTIONS' })).statusCode, 204)
  const semConfig = montar({ codigos: () => undefined })
  const r = await chamar(semConfig.handler, { codigo: 'CI-ABCD-EFGH' })
  assert.equal(r.statusCode, 503)
  assert.equal(r.corpo.motivo, 'nao_configurado', 'sem TOP15_CODIGOS a porta fica FECHADA, nunca aberta')
  assert.equal((await chamar(montar({ codigos: () => 'abc' }).handler, { codigo: 'abc' })).statusCode, 503, 'código curto na configuração não abre a porta')
  const vazio = await chamar(handler, {})
  assert.deepEqual([vazio.statusCode, vazio.corpo.motivo], [400, 'codigo_vazio'])
})

test('código errado: 401, conta a falha, não devolve dado algum', async () => {
  const { handler, eventos } = montar()
  const r = await chamar(handler, { codigo: 'CI-ZZZZ-ZZZZ' })
  assert.equal(r.statusCode, 401)
  assert.equal(r.corpo.motivo, 'invalido')
  assert.ok(!JSON.stringify(r.corpo).includes('AAAA3'))
  assert.deepEqual(eventos, ['falha'])
})

test('código certo: 200 com a lista, sem cache; aceita minúsculas, espaços e corpo em texto', async () => {
  const { handler, eventos } = montar()
  const r = await chamar(handler, { codigo: 'ci-abcd efgh' })
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.corpo, DADOS)
  assert.equal(r.cabecalhos['cache-control'], 'private, no-store')
  assert.equal((await chamar(handler, JSON.stringify({ codigo: 'CIABCDEFGH' }))).statusCode, 200, 'corpo como string JSON')
  assert.equal((await chamar(handler, '{quebrado')).statusCode, 400)
  assert.deepEqual(eventos, ['ok', 'ok'])
})

test('virada do mês: dois códigos valem ao mesmo tempo', async () => {
  const { handler } = montar({ codigos: () => 'CI-NOVO-2222,CI-ANTI-1111' })
  assert.equal((await chamar(handler, { codigo: 'CI-NOVO-2222' })).statusCode, 200)
  assert.equal((await chamar(handler, { codigo: 'CI-ANTI-1111' })).statusCode, 200)
  const so = montar({ codigos: () => 'CI-NOVO-2222' })
  assert.equal((await chamar(so.handler, { codigo: 'CI-ANTI-1111' })).statusCode, 401, 'depois de remover o antigo, ele deixa de valer')
})

test('limite: 10 erros por IP trancam por 15 minutos, inclusive para o código certo; outro IP não é afetado', async () => {
  const { handler, eventos, avancar } = montar()
  for (let i = 0; i < A.MAX_FALHAS; i++) assert.equal((await chamar(handler, { codigo: `CI-ERRO-${1000 + i}` })).statusCode, 401)
  const trancado = await chamar(handler, { codigo: 'CI-ABCD-EFGH' })
  assert.equal(trancado.statusCode, 429, 'mesmo o código certo é recusado durante a trava')
  assert.equal(trancado.cabecalhos['retry-after'], String(A.JANELA_SEGUNDOS))
  assert.equal(trancado.corpo.motivo, 'limite')
  assert.ok(eventos.includes('bloqueado'))
  assert.equal((await chamar(handler, { codigo: 'CI-ABCD-EFGH' }, { ip: '198.51.100.9' })).statusCode, 200, 'outro IP segue normal')
  avancar(A.JANELA_SEGUNDOS + 1)
  assert.equal((await chamar(handler, { codigo: 'CI-ABCD-EFGH' })).statusCode, 200, 'passada a janela, a trava expira')
})

test('privacidade: o IP em texto puro nunca chega ao limitador', async () => {
  const { handler, chavesVistas } = montar()
  await chamar(handler, { codigo: 'CI-ERRO-0000' })
  assert.ok(chavesVistas.size > 0)
  for (const k of chavesVistas) assert.ok(!k.includes('203.0.113'), k)
})

test('dados ainda não publicados: com o código certo, 503 "indisponivel"; falha interna dá 500 sem vazar detalhe', async () => {
  const sem = await chamar(montar({ lerDados: async () => null }).handler, { codigo: 'CI-ABCD-EFGH' })
  assert.deepEqual([sem.statusCode, sem.corpo.motivo], [503, 'indisponivel'])
  const naoPub = await chamar(montar({ lerDados: async () => ({ publicado: false }) }).handler, { codigo: 'CI-ABCD-EFGH' })
  assert.equal(naoPub.statusCode, 503)
  const erro = await chamar(montar({ lerDados: async () => { throw new Error('segredo: /var/task/caminho-interno') } }).handler, { codigo: 'CI-ABCD-EFGH' })
  assert.equal(erro.statusCode, 500)
  assert.ok(!JSON.stringify(erro.corpo).includes('segredo'))
})

test('métrica que falha nunca derruba o acesso', async () => {
  const { handler } = montar({ contar: async () => { throw new Error('redis fora') } })
  assert.equal((await chamar(handler, { codigo: 'CI-ABCD-EFGH' })).statusCode, 200)
  assert.equal((await chamar(handler, { codigo: 'CI-XXXX-XXXX' })).statusCode, 401)
})

test('limitador Redis: comandos usados e fallback em memória quando o Redis falha', async () => {
  const enviados = []
  const redis = A.limitadorRedis(async (cmds) => { enviados.push(...cmds); return cmds.map((c) => (c[0] === 'GET' ? '4' : 1)) })
  assert.equal(await redis.falhas('top15:falhas:abc'), 4)
  await redis.registrarFalha('top15:falhas:abc')
  assert.deepEqual(enviados, [['GET', 'top15:falhas:abc'], ['INCR', 'top15:falhas:abc'], ['EXPIRE', 'top15:falhas:abc', A.JANELA_SEGUNDOS]])

  const quebrado = { falhas: async () => { throw new Error('fora') }, registrarFalha: async () => { throw new Error('fora') } }
  const l = A.limitadorComReserva(quebrado, A.limitadorEmMemoria())
  for (let i = 0; i < A.MAX_FALHAS; i++) await l.registrarFalha('k')
  assert.ok((await l.falhas('k')) >= A.MAX_FALHAS, 'com o Redis fora, a reserva em memória ainda limita')
})

test('wiring real (top15.ts): sem TOP15_CODIGOS no ambiente a porta responde 503', async () => {
  delete process.env.TOP15_CODIGOS
  const r = await chamar(modulos['top15.ts'].default, { codigo: 'CI-ABCD-EFGH' })
  assert.deepEqual([r.statusCode, r.corpo.motivo], [503, 'nao_configurado'])
})

test('gerador de código: formato, alfabeto sem símbolos ambíguos, sem repetição e atende ao tamanho mínimo do servidor', () => {
  assert.equal(new Set(ALFABETO).size, ALFABETO.length)
  assert.ok(!/[01258BILOSZ]/.test(ALFABETO), 'sem 0/O, 1/I/L, 2/Z, 5/S, 8/B')
  const vistos = new Set()
  for (let i = 0; i < 300; i++) {
    const c = gerarCodigo()
    assert.match(c, /^CI-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    assert.ok(A.normalizarCodigo(c).length >= A.TAMANHO_MINIMO_CODIGO)
    assert.deepEqual(A.listaDeCodigos(c), [A.normalizarCodigo(c)])
    vistos.add(c)
  }
  assert.ok(vistos.size > 295, 'sorteio sem repetição prática')
})
