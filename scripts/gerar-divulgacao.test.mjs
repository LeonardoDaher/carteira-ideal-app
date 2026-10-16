// Divulgação mensal (D91): o texto das publicações sai só de rankings publicados e abertos, nunca de ranking com código,
// e sempre com o aviso de que não é recomendação.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { AVISO_CURTO, diaMes, executar, gerarPosts, lerDados, mesPadrao, nomeDoMes, pct } from './gerar-divulgacao.mjs'

const tick = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`)

function dadosFalsos() {
  const neg = (p, pregao = '2026-10-15') => ({ publicado: true, acessoRestrito: false, ultimoPregao: pregao, geral: tick(p, 15).map((ticker) => ({ ticker })) })
  const ind = (p) => ({
    publicado: true,
    acessoRestrito: false,
    ultimoPregao: '2026-10-16',
    dataComposicao: '2026-10-16',
    somaPesosDaLista: 66.215,
    ranking: tick(p, 15).map((ticker, i) => ({ ticker, peso: 9 - i * 0.5 })),
  })
  const rest = { publicado: true, acessoRestrito: true, ranking: [], tijolo: [], papel: [] }
  return {
    acoes: neg('ACAO'), fiis: neg('FII'), etfs: neg('ETF', '2026-10-14'), bdrs: neg('BDR'),
    ibov: ind('IBOV'), ifix: ind('IFIX'),
    acoesBaratas: { ...rest }, fiisBaratos: { ...rest }, bdrsDesconto: { ...rest },
  }
}

test('formatação: dia/mês, mês por extenso e percentual', () => {
  assert.equal(diaMes('2026-10-15'), '15/10')
  assert.equal(nomeDoMes('2026-10'), 'outubro/2026')
  assert.equal(pct(9.021), '9,0%')
  assert.throws(() => diaMes('x'))
  assert.throws(() => nomeDoMes('2026-13'))
})

test('gera os três posts, com as 15 posições de cada lista e as datas dos pregões', () => {
  const posts = gerarPosts(dadosFalsos(), '2026-10')
  assert.deepEqual(posts.map((p) => p.arquivo), ['post-1-mais-negociados.md', 'post-2-indices.md', 'post-3-listas-com-codigo.md'])
  const p1 = posts[0].texto
  assert.match(p1, /1 ACAO1, 2 ACAO2/)
  assert.match(p1, /15 ACAO15\./)
  assert.match(p1, /15 ETF15\./)
  assert.match(p1, /ETFs \(até 14\/10\)/)
  assert.match(p1, /ações \(mediana do volume diário dos últimos 21 pregões, até 15\/10\)/)
  const p2 = posts[1].texto
  assert.match(p2, /1 IBOV1 \(9,0%\)/)
  assert.match(p2, /66,2% do índice/)
  assert.match(p2, /composição de 16\/10/)
})

test('todo post leva o aviso de recomendação', () => {
  for (const p of gerarPosts(dadosFalsos(), '2026-10')) {
    assert.ok(p.texto.includes(AVISO_CURTO), p.arquivo)
    assert.ok(p.texto.split('Legenda:')[1].includes(AVISO_CURTO), `legenda de ${p.arquivo}`)
    if (!p.arquivo.startsWith('post-3')) assert.ok(p.texto.split('Legenda:')[0].includes(AVISO_CURTO), `slide de aviso de ${p.arquivo}`)
  }
})

test('o post das listas com código não traz ativo nenhum', () => {
  const p3 = gerarPosts(dadosFalsos(), '2026-10')[2].texto
  assert.doesNotMatch(p3, /\b[A-Z]{4}\d{1,2}\b/)
  assert.doesNotMatch(p3, /\b\d{1,2} [A-Z]{4}\d/)
})

test('ranking com código que traga lista no arquivo público é recusado', () => {
  for (const [chave, campo] of [['acoesBaratas', 'ranking'], ['bdrsDesconto', 'ranking'], ['fiisBaratos', 'tijolo'], ['fiisBaratos', 'papel']]) {
    const d = dadosFalsos()
    d[chave] = { ...d[chave], [campo]: [{ ticker: 'XXXX11' }] }
    assert.throws(() => gerarPosts(d, '2026-10'), /não pode usar ranking com código/, `${chave}.${campo}`)
  }
})

test('ranking com código marcado como aberto é recusado', () => {
  const d = dadosFalsos()
  d.fiisBaratos = { ...d.fiisBaratos, acessoRestrito: false }
  assert.throws(() => gerarPosts(d, '2026-10'), /acessoRestrito/)
})

test('ranking não publicado, lista curta ou repetida param o script', () => {
  let d = dadosFalsos()
  d.etfs = { ...d.etfs, publicado: false }
  assert.throws(() => gerarPosts(d, '2026-10'), /não publicado/)
  d = dadosFalsos()
  d.ibov = { ...d.ibov, ranking: d.ibov.ranking.slice(0, 14) }
  assert.throws(() => gerarPosts(d, '2026-10'), /deve ter 15/)
  d = dadosFalsos()
  d.acoes = { ...d.acoes, geral: d.acoes.geral.map((x, i) => (i === 3 ? { ticker: 'ACAO1' } : x)) }
  assert.throws(() => gerarPosts(d, '2026-10'), /repetido/)
})

test('mês padrão é o do pregão mais recente', () => {
  assert.equal(mesPadrao(dadosFalsos()), '2026-10')
})

test('executar grava os três arquivos na pasta do mês', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'divulg-'))
  try {
    const r = executar({ dados: dadosFalsos(), saida: tmp })
    assert.equal(path.basename(r.pasta), '2026-10')
    for (const a of r.arquivos) assert.ok(fs.existsSync(path.join(r.pasta, a)), a)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('com os arquivos públicos reais do repositório, gera sem erro e sem ativo de ranking com código', () => {
  const dados = lerDados()
  const posts = gerarPosts(dados, mesPadrao(dados))
  assert.equal(posts.length, 3)
  assert.doesNotMatch(posts[2].texto, /\b[A-Z]{4}\d{1,2}\b/)
})
