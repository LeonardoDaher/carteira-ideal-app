// CSP por hash dos scripts inline (D87).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { conferirHtml, hashDe, injetarCspMeta, scriptsInline, usosInlineProibidos } from './csp-hashes.mjs'

const hash = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>T</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>
  <script>(function(){ document.title = "tema" })()</script>
  <script type="module">export const a = 1</script>
  <script defer src="/script.js"></script>
</head>
<body><button id="b">Ok</button></body>
</html>`

test('só os scripts inline que executam entram: dados JSON-LD e scripts com src ficam de fora', () => {
  const lista = scriptsInline(PAGINA)
  assert.equal(lista.length, 2)
  assert.deepEqual(lista.map((s) => s.tipo).sort(), ['js', 'module'])
})

test('a meta lista o hash exato de cada script inline, usa script-src self e não tem unsafe-inline', () => {
  const novo = injetarCspMeta(PAGINA)
  const meta = /<meta id="csp-scripts" http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(novo)
  assert.ok(meta, 'meta ausente')
  const politica = meta[1]
  assert.match(politica, /^script-src 'self' /)
  assert.ok(!politica.includes("'unsafe-inline'"))
  assert.ok(politica.includes("script-src-attr 'none'"))
  assert.ok(politica.includes(hash('(function(){ document.title = "tema" })()')))
  assert.ok(politica.includes(hash('export const a = 1')))
  assert.ok(!politica.includes(hash('{"@context":"https://schema.org","@type":"Organization"}')), 'JSON-LD não é script')
  assert.deepEqual(conferirHtml(novo), [])
})

test('a meta entra logo depois do charset, antes de qualquer script', () => {
  const novo = injetarCspMeta(PAGINA)
  assert.ok(novo.indexOf('csp-scripts') > novo.indexOf('<meta charset'))
  assert.ok(novo.indexOf('csp-scripts') < novo.search(/<script\b/i))
})

test('rodar de novo não duplica a meta e mantém os hashes', () => {
  const uma = injetarCspMeta(PAGINA)
  const duas = injetarCspMeta(uma)
  assert.equal(duas, uma)
  assert.equal((duas.match(/id="csp-scripts"/g) ?? []).length, 1)
})

test('mudar um script muda o hash e a conferência acusa meta velha', () => {
  const novo = injetarCspMeta(PAGINA)
  const alterado = novo.replace('document.title = "tema"', 'document.title = "outro"')
  const problemas = conferirHtml(alterado)
  assert.equal(problemas.length, 1)
  assert.match(problemas[0], /hash ausente/)
})

test('atributo de evento inline e URL javascript: fazem o build falhar', () => {
  const comOnclick = PAGINA.replace('<button id="b">', '<button id="b" onclick="alert(1)">')
  assert.throws(() => injetarCspMeta(comOnclick, 'x.html'), /onclick/)
  const comJs = PAGINA.replace('<body>', '<body><a href="javascript:void(0)">x</a>')
  assert.throws(() => injetarCspMeta(comJs, 'y.html'), /javascript:/)
  assert.deepEqual(usosInlineProibidos(PAGINA), [])
})

test('texto "onclick" dentro de script ou de comentário não conta como atributo', () => {
  const ok = PAGINA.replace('</head>', '<script>var s = "<a onclick=\'x\'>";</script><!-- <b onclick="y"> --></head>')
  assert.deepEqual(usosInlineProibidos(ok), [])
  assert.doesNotThrow(() => injetarCspMeta(ok))
})

test('arquivo que não é documento HTML (verificação do Google) fica idêntico', () => {
  const google = 'google-site-verification: google5f0b815b0517184a.html'
  assert.equal(injetarCspMeta(google, 'google.html'), google)
  assert.deepEqual(conferirHtml(google), [])
})

test('documento com script e sem head não é aceito em silêncio', () => {
  assert.throws(() => injetarCspMeta('<p>oi</p><script>x()</script>', 'z.html'), /não tem <head>/)
})

test('o hash é do texto exato entre as tags (espaço e quebra de linha contam)', () => {
  assert.notEqual(hashDe(' a '), hashDe('a'))
  const com = '<html><head><meta charset="utf-8"><script>\n  var a = 1\n</script></head></html>'
  const novo = injetarCspMeta(com)
  assert.ok(novo.includes(hash('\n  var a = 1\n')))
})
