// Content-Security-Policy (D86): a política do vercel.json não pode afrouxar sem querer, e as páginas-fonte
// não podem passar a carregar script, estilo ou fonte de fora do próprio domínio sem que a política mude junto.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'))

function lerPolitica() {
  const cabecalhos = vercel.headers.find((h) => h.source === '/(.*)').headers
  const h = cabecalhos.find((c) => /^Content-Security-Policy(-Report-Only)?$/.test(c.key))
  assert.ok(h, 'cabeçalho Content-Security-Policy ausente')
  const diretivas = Object.fromEntries(
    h.value.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [nome, ...valores] = d.split(/\s+/)
      return [nome, valores]
    }),
  )
  return { modo: h.key, diretivas }
}

test('a política restringe o que importa e não usa curinga nem eval', () => {
  const { diretivas } = lerPolitica()
  assert.deepEqual(diretivas['default-src'], ["'self'"])
  assert.deepEqual(diretivas['object-src'], ["'none'"])
  assert.deepEqual(diretivas['base-uri'], ["'self'"])
  assert.deepEqual(diretivas['form-action'], ["'self'"])
  assert.deepEqual(diretivas['connect-src'], ["'self'"])
  assert.deepEqual(diretivas['frame-ancestors'], ["'self'"])
  for (const [nome, valores] of Object.entries(diretivas)) {
    assert.ok(!valores.includes('*'), `${nome} com curinga`)
    assert.ok(!valores.includes("'unsafe-eval'"), `${nome} com unsafe-eval`)
    for (const v of valores.filter((x) => /^https?:/.test(x))) assert.match(v, /^https:\/\//, `${nome}: só https`)
  }
})

test('só o YouTube pode ser embutido em quadro, e scripts externos não são permitidos', () => {
  const { diretivas } = lerPolitica()
  assert.deepEqual(diretivas['frame-src'].sort(), ['https://www.youtube-nocookie.com', 'https://www.youtube.com'].sort())
  assert.deepEqual(diretivas['script-src'], ["'self'", "'unsafe-inline'"]) // trava o estado atual; ver D86 (etapa seguinte: hashes)
})

test('as páginas-fonte não carregam script, estilo ou fonte de outro domínio', () => {
  const arquivos = ['index.html', 'painel.html', 'privacidade/index.html', 'webapp-src/index.html', 'scripts/gerar-paginas.mjs', 'style.css', 'paginas.css']
  for (const rel of arquivos) {
    const f = path.join(RAIZ, rel)
    if (!fs.existsSync(f)) continue
    const t = fs.readFileSync(f, 'utf8')
    assert.ok(!/<script[^>]+src\s*=\s*["']https?:/i.test(t), `${rel}: script externo`)
    assert.ok(!/<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["']https?:/i.test(t), `${rel}: estilo externo`)
    assert.ok(!/@import\s+(url\()?["']?https?:/i.test(t), `${rel}: @import externo`)
    assert.ok(!/url\(\s*["']?https?:/i.test(t), `${rel}: url() externa`)
  }
})
