// D24: testes do sitemap.xml gerado no build.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarSitemap, PAGINAS_SITEMAP } from './build-site.mjs'

test('sitemap lista a home e o app com o domínio próprio e a data do build', () => {
  const xml = montarSitemap(PAGINAS_SITEMAP, new Date('2026-09-28T12:00:00Z'))
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<loc>https:\/\/carteiraideal\.app\.br\/<\/loc>/)
  assert.match(xml, /<loc>https:\/\/carteiraideal\.app\.br\/app\/<\/loc>/)
  assert.equal((xml.match(/<lastmod>2026-09-28<\/lastmod>/g) ?? []).length, 2)
})

test('sitemap não inclui endereços com ?tela=', () => {
  const xml = montarSitemap(PAGINAS_SITEMAP, new Date())
  assert.doesNotMatch(xml, /\?tela=/)
})
