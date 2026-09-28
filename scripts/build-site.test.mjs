// D26: testes do sitemap.xml gerado no build.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montarSitemap } from './build-site.mjs'

test('sitemap lista cada página com o domínio próprio e a própria data', () => {
  const xml = montarSitemap([
    { caminho: '/', lastmod: '2026-09-28' },
    { caminho: '/simulador-fii/', lastmod: '2026-09-20' },
  ])
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<loc>https:\/\/carteiraideal\.app\.br\/<\/loc>\s*<lastmod>2026-09-28<\/lastmod>/)
  assert.match(xml, /<loc>https:\/\/carteiraideal\.app\.br\/simulador-fii\/<\/loc>\s*<lastmod>2026-09-20<\/lastmod>/)
})
