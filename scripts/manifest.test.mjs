// D29: o app instalado abre na página inicial e o escopo cobre o site inteiro.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const raiz = new URL('../', import.meta.url)
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf-8')

test('manifest abre na página inicial e cobre o site inteiro', async () => {
  const m = JSON.parse(await ler('manifest.webmanifest'))
  assert.equal(m.start_url, '/')
  assert.equal(m.scope, '/')
  assert.equal(m.id, '/app/', 'o id é a identidade do app instalado: não mudar')
  assert.equal(m.display, 'standalone')
  assert.ok(m.icons.some((i) => i.sizes === '192x192'))
  assert.ok(m.icons.some((i) => i.sizes === '512x512'))
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'))
})

test('atalhos ficam dentro do escopo', async () => {
  const m = JSON.parse(await ler('manifest.webmanifest'))
  assert.ok(m.shortcuts.length >= 1 && m.shortcuts.length <= 4)
  for (const a of m.shortcuts) assert.ok(a.url.startsWith('/'), a.url)
})

test('landing e app apontam para o mesmo manifest', async () => {
  const landing = await ler('index.html')
  const app = await ler('webapp-src/index.html')
  assert.match(landing, /<link rel="manifest" href="\/manifest\.webmanifest"/)
  assert.match(app, /<link rel="manifest" href="\/manifest\.webmanifest"/)
})

test('o build da landing copia o manifest', async () => {
  const build = await ler('scripts/build-site.mjs')
  assert.match(build, /'manifest\.webmanifest'/)
})
