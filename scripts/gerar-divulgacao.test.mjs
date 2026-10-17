// Divulgação mensal (D91): o texto das publicações sai só de rankings publicados e abertos, nunca de ranking com código,
// e sempre com o aviso de que não é recomendação.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { AVISO_CURTO, diaMes, executar, gerarPosts, lerDados, mesPadrao, nomeDoMes, pct, razao } from './gerar-divulgacao.mjs'

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
    endividadas: { publicado: true, dataPrecos: '2026-10-16', dataCorte: '2026-10-05', ranking: tick('END', 15).map((ticker, i) => ({ ticker, dlEbitda: 35.27 - i * 2 })), semEbitdaPositivo: [] },
  }
}

test('formatação: dia/mês, mês por extenso, percentual e razão', () => {
  assert.equal(razao(9.7035), '9,7x')
  assert.equal(razao(35.27), '35,3x')
  assert.equal(diaMes('2026-10-15'), '15/10')
  assert.equal(nomeDoMes('2026-10'), 'outubro/2026')
  assert.equal(pct(9.021), '9,0%')
  assert.throws(() => diaMes('x'))
  assert.throws(() => nomeDoMes('2026-13'))
})

test('gera os quatro posts, com as 15 posições de cada lista e as datas dos pregões', () => {
  const posts = gerarPosts(dadosFalsos(), '2026-10')
  assert.deepEqual(posts.map((p) => p.arquivo), ['post-1-mais-negociados.md', 'post-2-indices.md', 'post-3-listas-com-codigo.md', 'post-4-endividadas.md'])
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

test('post das empresas mais endividadas (D95): as 15 empresas com a razão, as datas, o aviso de que dívida alta não é risco e a lista à parte só quando existe', () => {
  const p4 = gerarPosts(dadosFalsos(), '2026-10')[3].texto
  assert.match(p4, /1 END1 \(35,3x\), 2 END2 \(33,3x\)/)
  assert.match(p4, /15 END15 \(7,3x\)\./)
  assert.match(p4, /preços até 16\/10, balanços publicados até 05\/10/)
  assert.match(p4, /outubro\/2026/)
  assert.match(p4, /Dívida alta não quer dizer empresa em risco/)
  assert.match(p4, /não mostra prazo, custo nem moeda da dívida/)
  assert.match(p4, /Bancos e seguradoras ficam de fora/)
  assert.match(p4, /Slide 3 \(aviso\)/)
  assert.doesNotMatch(p4, /à parte/, 'sem empresa na lista sem EBITDA positivo, não há slide sobre ela')
  const d = dadosFalsos()
  d.endividadas = { ...d.endividadas, semEbitdaPositivo: [{ ticker: 'XXXX3' }] }
  const um = gerarPosts(d, '2026-10')[3].texto
  assert.match(um, /Slide 3: "1 empresa tem dívida líquida e EBITDA zero ou negativo: a razão não existe e ela fica à parte/)
  assert.match(um, /Slide 4 \(aviso\)/)
  assert.doesNotMatch(um, /XXXX3/, 'a empresa da lista à parte não é citada pelo código')
  d.endividadas = { ...d.endividadas, semEbitdaPositivo: [{ ticker: 'A' }, { ticker: 'B' }] }
  assert.match(gerarPosts(d, '2026-10')[3].texto, /2 empresas têm dívida líquida e EBITDA zero ou negativo: a razão não existe e elas ficam à parte/)
})

test('empresas mais endividadas: ranking não publicado, com código, lista curta, repetida ou sem razão param o script', () => {
  const com = (mudanca) => { const d = dadosFalsos(); d.endividadas = { ...d.endividadas, ...mudanca }; return d }
  assert.throws(() => gerarPosts(com({ publicado: false }), '2026-10'), /Empresas mais endividadas: ranking não publicado/)
  assert.throws(() => gerarPosts(com({ acessoRestrito: true }), '2026-10'), /Empresas mais endividadas: ranking com código/)
  assert.throws(() => gerarPosts(com({ ranking: dadosFalsos().endividadas.ranking.slice(0, 14) }), '2026-10'), /Empresas mais endividadas: a lista deve ter 15/)
  assert.throws(() => gerarPosts(com({ ranking: dadosFalsos().endividadas.ranking.map((x, i) => (i === 3 ? { ...x, ticker: 'END1' } : x)) }), '2026-10'), /Empresas mais endividadas: ativo repetido/)
  assert.throws(() => gerarPosts(com({ ranking: dadosFalsos().endividadas.ranking.map((x, i) => (i === 0 ? { ticker: x.ticker } : x)) }), '2026-10'), /sem a razão dívida líquida ÷ EBITDA/)
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

test('executar grava os quatro arquivos na pasta do mês', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'divulg-'))
  try {
    const r = executar({ dados: dadosFalsos(), saida: tmp })
    assert.equal(path.basename(r.pasta), '2026-10')
    assert.equal(r.arquivos.length, 4)
    for (const a of r.arquivos) assert.ok(fs.existsSync(path.join(r.pasta, a)), a)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('com os arquivos públicos reais do repositório, gera sem erro e sem ativo de ranking com código', () => {
  const dados = lerDados()
  const posts = gerarPosts(dados, mesPadrao(dados))
  assert.equal(posts.length, 4)
  assert.doesNotMatch(posts[2].texto, /\b[A-Z]{4}\d{1,2}\b/)
  assert.match(posts[3].texto, /^# Post 4 \(carrossel\): as empresas mais endividadas/)
  assert.equal(posts[3].texto.match(/\d+ [A-Z]{4}\d{1,2} \(\d+,\dx\)/g).length, 15, 'as 15 empresas do arquivo público real, cada uma com a razão')
})
