// D26 (Etapa 3): testes do gerador de páginas estáticas para o Google.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gerarPaginas, limparTexto, criteriosPublicos, semMetodologia, resumir, esc, montarPagina, DOMINIO, AUTOR } from './gerar-paginas.mjs'
import { reescreverImports } from './ts-loader.mjs'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const SNAPSHOT_VAZIO = { geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }
const SNAPSHOT = {
  geradoEm: '2026-09-22T13:00:00Z',
  indicadores: {
    selicMeta: { nome: 'Selic meta', unidade: '% a.a.', codigoSgs: 432, data: '2026-09-21', valor: 13.75 },
    ipca12m: { nome: 'IPCA 12m', unidade: '%', codigoSgs: 13522, data: '2026-08-01', valor: 4.22 },
  },
  derivados: { jurosReaisExPost: { nome: 'Juro real', unidade: '% a.a.', valor: 9.14 } },
  tesouro: {
    dataBase: '2026-09-25',
    titulos: [
      { nome: 'Tesouro Selic 2031', tipo: 'Tesouro Selic', familia: 'Tesouro Selic', indexador: 'selic', tipoTaxa: 'agioSobreSelic', cupom: 'sem', vencimento: '2031-03-01', aVenda: true, taxaCompra: 0.05, puCompra: 17500.1, taxaVenda: 0.04, puVenda: 17490 },
      { nome: 'Tesouro IPCA+ 2035', tipo: 'Tesouro IPCA+', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', cupom: 'sem', vencimento: '2035-05-15', aVenda: true, taxaCompra: 7.6, puCompra: 2100.55, taxaVenda: 7.7, puVenda: 2090 },
      { nome: 'Tesouro Prefixado 2029', tipo: 'Tesouro Prefixado', familia: 'Tesouro Prefixado', indexador: 'prefixado', tipoTaxa: 'nominal', cupom: 'sem', vencimento: '2029-01-01', aVenda: true, taxaCompra: 13.2, puCompra: 700.1, taxaVenda: 13.3, puVenda: 699 },
      { nome: 'Tesouro Selic 2027', tipo: 'Tesouro Selic', familia: 'Tesouro Selic', indexador: 'selic', tipoTaxa: 'agioSobreSelic', cupom: 'sem', vencimento: '2027-03-01', aVenda: false, taxaCompra: null, puCompra: null, taxaVenda: 0.02, puVenda: 17000 },
    ],
  },
}

const textoVisivel = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('gera as páginas esperadas, sem repetir endereço', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  const caminhos = paginas.map((p) => p.caminho)
  assert.equal(new Set(caminhos).size, caminhos.length)
  for (const c of [
    '/teste-perfil-de-investidor/',
    '/simulador-tesouro-direto/',
    '/simulador-fii/',
    '/simulador-bdr/',
    '/simulador-etf/',
    '/minha-carteira/',
    '/meu-mes/',
    '/aprender/',
    '/aprender/sair-das-dividas/',
    '/aprender/sair-das-dividas/juros-sobre-juros/',
    '/aprender/ativos/tesouro-selic/',
    '/aprender/ativos/criptomoedas/',
    '/taxas-tesouro-direto-hoje/',
    '/sobre/',
    '/metodologia-e-fontes/',
  ]) {
    assert.ok(caminhos.includes(c), `faltou ${c}`)
  }
  // 7 ferramentas (com a Minha Carteira) + hub Aprender + Sobre e Metodologia + 11 ativos + hub e 9 aulas das dívidas + taxas
  assert.equal(paginas.length, 7 + 1 + 2 + 11 + 1 + 9 + 1)
})

test('sem dados do Tesouro, a página de taxas não é gerada e ninguém aponta para ela', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT_VAZIO })
  assert.ok(!paginas.some((p) => p.caminho === '/taxas-tesouro-direto-hoje/'))
  assert.ok(!paginas.some((p) => p.html.includes('/taxas-tesouro-direto-hoje/')))
})

test('toda página tem um h1, canonical certo, título e descrição de bom tamanho, JSON-LD válido e o aviso', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  for (const p of paginas) {
    const { html, caminho } = p
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, `${caminho}: h1`)
    assert.ok(html.includes(`<link rel="canonical" href="${DOMINIO}${caminho}" />`), `${caminho}: canonical`)
    const titulo = /<title>(.*?)<\/title>/.exec(html)[1]
    assert.ok(titulo.length >= 20 && titulo.length <= 75, `${caminho}: título com ${titulo.length} caracteres`)
    const desc = /<meta name="description" content="(.*?)" \/>/.exec(html)[1]
    assert.ok(desc.length >= 60 && desc.length <= 165, `${caminho}: descrição com ${desc.length} caracteres`)
    const ld = JSON.parse(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html)[1])
    assert.ok(ld['@graph'].some((g) => g['@type'] === 'BreadcrumbList'), `${caminho}: breadcrumb`)
    assert.match(html, /Conteúdo educacional\. Não é recomendação de investimento\./, `${caminho}: aviso`)
    assert.match(p.lastmod, /^\d{4}-\d{2}-\d{2}$/)
  }
})

test('todo link interno aponta para uma página que existe', async () => {
  for (const snapshot of [SNAPSHOT, SNAPSHOT_VAZIO]) {
    const paginas = await gerarPaginas({ raiz, snapshot })
    const existentes = new Set([...paginas.map((p) => p.caminho), '/', '/app/', '/privacidade/'])
    for (const p of paginas) {
      const html = p.html.replace(/<script[\s\S]*?<\/script>/g, '')
      for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
        const [alvo] = m[1].split('?')
        if (/\.(css|svg|png|xml|txt)$/.test(alvo) || alvo.startsWith('/assets/')) continue
        assert.ok(existentes.has(alvo), `${p.caminho} aponta para ${m[1]}, que não existe`)
      }
    }
  }
})

test('guias de ativos não citam produtos, percentuais de alocação nem "exemplos acima"', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT_VAZIO })
  const guias = paginas.filter((p) => p.caminho.startsWith('/aprender/ativos/'))
  assert.equal(guias.length, 11)
  for (const g of guias) {
    const texto = textoVisivel(g.html)
    assert.doesNotMatch(texto, /\b[A-Z0-9]{4}\d{2}\b/, `${g.caminho}: código de produto`)
    assert.doesNotMatch(texto, /alocação de referência/i, `${g.caminho}: alocação de referência`)
    assert.doesNotMatch(texto, /exemplos? (acima|abaixo)|nomes acima/i, `${g.caminho}: referência a exemplos`)
    assert.doesNotMatch(texto, /\d+\s?% (a \d+\s?% )?(da carteira|do total)/i, `${g.caminho}: percentual de carteira`)
    assert.doesNotMatch(texto, /\btoque\b/i, `${g.caminho}: texto de interface do app`)
  }
})

test('nenhuma página explica a metodologia do motor (veto, matrizes, calibradores)', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  for (const p of paginas) {
    assert.doesNotMatch(textoVisivel(p.html), /\bveto\b|matriz|restrição dura|calibrador|pilar \d/i, p.caminho)
  }
})

test('as 9 aulas de "Sair das dívidas" trazem o texto completo e as fontes oficiais', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT_VAZIO })
  const aulas = paginas.filter((p) => p.caminho.startsWith('/aprender/sair-das-dividas/') && p.caminho !== '/aprender/sair-das-dividas/')
  assert.equal(aulas.length, 9)
  for (const a of aulas) assert.ok(textoVisivel(a.html).length > 900, `${a.caminho} está curta`)
  const registrato = aulas.find((a) => a.caminho.endsWith('/registrato/'))
  assert.match(registrato.html, /https:\/\/www\.bcb\.gov\.br\/cidadaniafinanceira\/registrato/)
})

test('taxas do Tesouro: mostra só títulos à venda, em ordem de vencimento, com a régua da taxa', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  const taxas = paginas.find((p) => p.caminho === '/taxas-tesouro-direto-hoje/')
  assert.equal(taxas.lastmod, '2026-09-25')
  const texto = textoVisivel(taxas.html)
  assert.match(texto, /25\/09\/2026/)
  assert.match(texto, /Tesouro Selic 2031/)
  assert.doesNotMatch(texto, /Tesouro Selic 2027/, 'título que não está à venda não entra')
  assert.match(texto, /Selic \+ 0,05%/)
  assert.match(texto, /IPCA \+ 7,60%/)
  assert.match(texto, /13,20% a\.a\./)
  assert.match(texto, /Selic meta:\s*13,75%/)
  // ordem das famílias: Selic, Prefixado, IPCA+
  assert.ok(taxas.html.indexOf('>Tesouro Selic<') < taxas.html.indexOf('>Tesouro Prefixado<'))
  assert.ok(taxas.html.indexOf('>Tesouro Prefixado<') < taxas.html.indexOf('>Tesouro IPCA+<'))
  // a página do simulador passa a apontar para ela
  const sim = paginas.find((p) => p.caminho === '/simulador-tesouro-direto/')
  assert.match(sim.html, /href="\/taxas-tesouro-direto-hoje\/"/)
})

test('limparTexto tira produtos, exemplos e percentuais, sem perder o resto da frase', () => {
  assert.equal(limparTexto('Um ETF (ex.: IVVB11, WRLD11) entrega diversificação pronta.'), '')
  assert.equal(
    limparTexto('Evite concentrar tudo num único setor; os nomes acima são exemplos, não recomendação.'),
    'Evite concentrar tudo num único setor.',
  )
  assert.equal(limparTexto('Uma fatia pequena (5% a 10% da carteira) já costuma bastar.'), 'Uma fatia pequena já costuma bastar.')
  assert.equal(limparTexto('Os vencimentos dos exemplos acima mudam; confira sempre no Tesouro.'), 'Confira sempre no Tesouro.')
  // números que não são alocação continuam
  assert.equal(limparTexto('O IR começa em 22,5% e cai até 15%.'), 'O IR começa em 22,5% e cai até 15%.')
  assert.deepEqual(criteriosPublicos(['Vale 33,3% cada.', 'Compare o IVVB11.', 'Confira o custo.']), ['Vale 33,3% cada.', 'Confira o custo.'].filter((t) => !/cada/.test(t)))
})

test('semMetodologia tira só a frase que fala de pilares e opções do questionário', () => {
  assert.equal(
    semMetodologia('Quitar vem primeiro. É a diferença entre as opções A e B do Pilar 2. Depois, reserva.'),
    'Quitar vem primeiro. Depois, reserva.',
  )
  assert.equal(semMetodologia('Texto comum sem nada disso.'), 'Texto comum sem nada disso.')
})

test('quem assina: nome do autor em todas as páginas, com link para /sobre/, e Person no JSON-LD', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  for (const p of paginas) {
    const ld = JSON.parse(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(p.html)[1])
    const pessoa = ld['@graph'].find((g) => g['@type'] === 'Person')
    assert.equal(pessoa?.name, AUTOR.nome, `${p.caminho}: Person`)
    assert.ok(ld['@graph'].some((g) => g['@type'] === 'Organization'), `${p.caminho}: Organization`)
    if (p.caminho === '/sobre/') {
      assert.doesNotMatch(p.html, /class="byline"/)
      assert.ok(ld['@graph'].some((g) => g['@type'] === 'AboutPage'))
    } else {
      assert.match(p.html, new RegExp(`<p class="byline">Por <a href="/sobre/">${AUTOR.nome}</a> · (Revisado em|Dados de) \\d{2}/\\d{2}/\\d{4}</p>`), `${p.caminho}: byline`)
    }
  }
  const taxas = paginas.find((p) => p.caminho === '/taxas-tesouro-direto-hoje/')
  assert.match(taxas.html, /Dados de 25\/09\/2026/)
})

test('nenhuma página afirma certificação ou registro que o responsável não tem', async () => {
  const paginas = await gerarPaginas({ raiz, snapshot: SNAPSHOT })
  for (const p of paginas) {
    const t = textoVisivel(p.html)
    assert.doesNotMatch(t, /\bCNPI(-T)?\b|\bCEA\b|\bCFP\b|\bCPA-?\d*\b|\bANBIMA\b|\bAmbima\b|\bOAB\b/i, `${p.caminho}: sigla de certificação`)
  }
  const sobre = textoVisivel(paginas.find((p) => p.caminho === '/sobre/').html)
  assert.match(sobre, new RegExp(`formado em ${AUTOR.formacao}`))
  assert.match(sobre, /não sou analista nem consultor de valores mobiliários registrado/i)
})

test('esc, resumir e reescreverImports', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  assert.ok(resumir('palavra '.repeat(40), 60).length <= 60)
  assert.equal(resumir('curto'), 'curto')
  assert.equal(reescreverImports("import { A } from './a'\nimport B from '../b/c'\nimport D from './d.js'"), "import { A } from './a.js'\nimport B from '../b/c.js'\nimport D from './d.js'")
})

test('montarPagina escapa o texto e não deixa o JSON-LD fechar o script', () => {
  const html = montarPagina({
    caminho: '/x/',
    titulo: 'Título <b>',
    descricao: 'Descrição com "aspas" e mais texto para passar do mínimo de caracteres exigido pelo teste aqui.',
    h1: 'H1 </script><img>',
    lead: 'lead',
    corpo: '<p>ok</p>',
    migalhas: [],
    lastmod: '2026-09-28',
  })
  assert.match(html, /<title>Título &lt;b&gt; \| Carteira Ideal<\/title>/)
  assert.doesNotMatch(html.split('application/ld+json')[1].split('</script>')[0], /<\/script/)
  assert.equal((html.match(/<h1>/g) ?? []).length, 1)
})
