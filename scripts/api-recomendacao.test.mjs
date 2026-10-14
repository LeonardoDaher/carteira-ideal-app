// Testes do endpoint POST /api/recomendacao (D88): método, validação, resultado, veto, limite por IP e formato da resposta.
// O motor em si é testado em webapp-src/src/domain/engine*.test.ts; aqui o que importa é o contrato da API.
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Sem Redis: contagem do limite em memória, métricas desligadas.
for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'ALLOWED_ORIGIN']) delete process.env[k]

const { modulos, limpar } = await carregarTs(path.join(RAIZ, 'api'), ['recomendacao.ts'])
test.after(() => limpar())
const handler = modulos['recomendacao.ts'].default

function resFalsa() {
  const r = { statusCode: null, cabecalhos: {}, corpo: undefined }
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.corpo = b; return r }
  r.end = () => r
  return r
}
let contadorIp = 0
const ipNovo = () => `198.51.100.${(contadorIp += 1)}`
const req = ({ metodo = 'POST', corpo, ip = ipNovo(), origin } = {}) => ({
  method: metodo,
  headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}) },
  body: corpo,
  socket: { remoteAddress: ip },
})
async function chamar(opcoes) {
  const r = resFalsa()
  await handler(req(opcoes), r)
  return r
}

const SUITABILITY = { objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'c', patrimonio: 'c', experiencia: 'c', reacao: 'c' }
const ARQUITETURA = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}
const corpoBom = (extra = {}) => ({ respostas: SUITABILITY, dados: { idade: 35 }, respostasArquitetura: ARQUITETURA, ...extra })
const soma = (c) => Object.values(c).reduce((s, v) => s + v, 0)
const risco = (c) => ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'].reduce((s, k) => s + (c[k] ?? 0), 0)

const CAMPOS_PERMITIDOS = new Set([
  'score', 'perfilBase', 'perfilFinal', 'prazo', 'carteira', 'alertas', 'scoreArquitetura', 'capacidadeReal',
  'vetoAplicado', 'perfilPatrimonial', 'perfilFinalCarteira', 'pilaresDoVeto', 'versaoMotor', 'regrasAcionadas',
])

test('200: devolve o resultado completo, com a carteira somando 100 e a versão do motor', async () => {
  const r = await chamar({ corpo: corpoBom() })
  assert.equal(r.statusCode, 200)
  assert.equal(soma(r.corpo.carteira), 100)
  assert.ok(Object.values(r.corpo.carteira).every((v) => v >= 0))
  assert.match(r.corpo.versaoMotor, /^2026\.\d{2}\.\d{2}-D\d+$/)
  assert.ok(Array.isArray(r.corpo.alertas))
  assert.ok(Array.isArray(r.corpo.regrasAcionadas))
  assert.equal(r.corpo.vetoAplicado, false)
  assert.ok(['Conservador', 'Moderado', 'Arrojado'].includes(r.corpo.perfilFinal))
})

test('a resposta só tem os campos do contrato (nada de matriz, peso ou configuração interna)', async () => {
  const r = await chamar({ corpo: corpoBom() })
  for (const k of Object.keys(r.corpo)) assert.ok(CAMPOS_PERMITIDOS.has(k), `campo inesperado na resposta: ${k}`)
  const texto = JSON.stringify(r.corpo)
  for (const proibido of ['MATRIZ', 'PONTOS', 'TETO_RISCO', 'VETOR_PELA']) assert.ok(!texto.includes(proibido))
})

test('determinístico: o mesmo corpo dá a mesma resposta', async () => {
  const a = await chamar({ corpo: corpoBom() })
  const b = await chamar({ corpo: corpoBom() })
  assert.deepEqual(a.corpo, b.corpo)
})

test('sem as perguntas da arquitetura, calcula só pelo suitability (sem campos de veto)', async () => {
  const r = await chamar({ corpo: { respostas: SUITABILITY, dados: { idade: 35 } } })
  assert.equal(r.statusCode, 200)
  assert.equal(soma(r.corpo.carteira), 100)
  assert.equal(r.corpo.vetoAplicado, undefined)
  assert.equal(r.corpo.perfilPatrimonial, undefined)
})

test('veto: reserva curta (Pilar 1 [A]) vai para o Defensivo, prazo no máximo médio e 20% em risco', async () => {
  const r = await chamar({ corpo: corpoBom({ respostasArquitetura: { ...ARQUITETURA, capacidadeFinanceira: 'a' } }) })
  assert.equal(r.statusCode, 200)
  assert.equal(r.corpo.vetoAplicado, true)
  assert.deepEqual(r.corpo.pilaresDoVeto, ['capacidadeFinanceira'])
  assert.equal(r.corpo.perfilPatrimonial, 'Defensivo')
  assert.equal(r.corpo.prazo, 'medio')
  assert.ok(r.corpo.regrasAcionadas.includes('veto:capacidadeFinanceira'))
  assert.ok(risco(r.corpo.carteira) <= 20)
})

test('veto do Pilar 3 [A] depende da parte a sacar: sem o campo e [A] vetam; [B] e [C] não', async () => {
  const saque = { ...ARQUITETURA, janelaLiquidez: 'a' }
  const sem = await chamar({ corpo: corpoBom({ respostasArquitetura: saque }) })
  assert.equal(sem.corpo.vetoAplicado, true)
  assert.equal(sem.corpo.prazo, 'curto')

  const a = await chamar({ corpo: corpoBom({ respostasArquitetura: { ...saque, parteDoSaque: 'a' } }) })
  assert.equal(a.corpo.vetoAplicado, true)

  const b = await chamar({ corpo: corpoBom({ respostasArquitetura: { ...saque, parteDoSaque: 'b' } }) })
  assert.equal(b.corpo.vetoAplicado, false)
  assert.equal(b.corpo.prazo, 'curto')

  const c = await chamar({ corpo: corpoBom({ respostasArquitetura: { ...saque, parteDoSaque: 'c' } }) })
  assert.equal(c.corpo.vetoAplicado, false)
  assert.notEqual(c.corpo.prazo, 'longo')
})

test('405: só POST (e OPTIONS) são aceitos', async () => {
  for (const metodo of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const r = await chamar({ metodo, corpo: corpoBom() })
    assert.equal(r.statusCode, 405, metodo)
    assert.match(r.corpo.erro, /POST/)
  }
  assert.equal((await chamar({ metodo: 'OPTIONS' })).statusCode, 204)
})

test('400: corpo e campos inválidos, sempre com { erro } e sem vazar detalhes internos', async () => {
  const invalidos = [
    ['sem corpo', undefined],
    ['corpo texto', 'oi'],
    ['sem respostas', { dados: { idade: 35 } }],
    ['campo do suitability ausente', { respostas: { ...SUITABILITY, reacao: undefined }, dados: { idade: 35 } }],
    ['letra inválida no suitability', { respostas: { ...SUITABILITY, prazo: 'e' }, dados: { idade: 35 } }],
    ['sem idade', { respostas: SUITABILITY, dados: {} }],
    ['idade fora da faixa', { respostas: SUITABILITY, dados: { idade: 200 } }],
    ['idade não numérica', { respostas: SUITABILITY, dados: { idade: '35' } }],
    ['arquitetura incompleta', { respostas: SUITABILITY, dados: { idade: 35 }, respostasArquitetura: { capacidadeFinanceira: 'a' } }],
    ['letra inválida na arquitetura', { respostas: SUITABILITY, dados: { idade: 35 }, respostasArquitetura: { ...ARQUITETURA, passivoDividas: 'd' } }],
    ['parteDoSaque inválida', corpoBom({ respostasArquitetura: { ...ARQUITETURA, parteDoSaque: 'x' } })],
  ]
  for (const [nome, corpo] of invalidos) {
    const r = await chamar({ corpo })
    assert.equal(r.statusCode, 400, nome)
    assert.equal(typeof r.corpo.erro, 'string', nome)
    assert.ok(!/stack|at \w+ \(|Error:/i.test(r.corpo.erro), `${nome}: vazou detalhe interno`)
  }
})

test('429: 60 chamadas por IP passam e a 61ª recebe 429 com Retry-After; outro IP não é afetado', async () => {
  const ip = ipNovo()
  for (let i = 1; i <= 60; i++) {
    const r = await chamar({ corpo: corpoBom(), ip })
    assert.equal(r.statusCode, 200, `chamada ${i}`)
  }
  const bloqueada = await chamar({ corpo: corpoBom(), ip })
  assert.equal(bloqueada.statusCode, 429)
  assert.equal(bloqueada.cabecalhos['retry-after'], '900')
  assert.match(bloqueada.corpo.erro, /Muitas consultas/)

  // o limite vem antes da validação: mesmo um corpo inválido é barrado com 429
  assert.equal((await chamar({ corpo: { x: 1 }, ip })).statusCode, 429)

  assert.equal((await chamar({ corpo: corpoBom(), ip: ipNovo() })).statusCode, 200)
})

test('o IP usado é o primeiro do x-forwarded-for (na Vercel a plataforma o define); proxies no fim da cadeia não mudam a contagem', async () => {
  const ip = ipNovo()
  const r1 = resFalsa()
  const base = { ...req({ corpo: corpoBom(), ip }) }
  base.headers = { 'x-forwarded-for': `${ip}, 10.0.0.1, 10.0.0.2` }
  for (let i = 0; i < 60; i++) await handler(base, resFalsa())
  await handler(base, r1)
  assert.equal(r1.statusCode, 429)
  // mesmo cliente com proxies diferentes no fim da cadeia continua sendo o mesmo IP
  const r2 = resFalsa()
  await handler({ ...base, headers: { 'x-forwarded-for': `${ip}, 192.0.2.99` } }, r2)
  assert.equal(r2.statusCode, 429)
})

test('sem Origin (curl) responde sem cabeçalho de origem; origem do próprio site é ecoada', async () => {
  const sem = await chamar({ corpo: corpoBom() })
  assert.equal(sem.cabecalhos['access-control-allow-origin'], undefined)
  const com = await chamar({ corpo: corpoBom(), origin: 'https://carteiraideal.app.br' })
  assert.equal(com.statusCode, 200)
  assert.equal(com.cabecalhos['access-control-allow-origin'], 'https://carteiraideal.app.br')
})
