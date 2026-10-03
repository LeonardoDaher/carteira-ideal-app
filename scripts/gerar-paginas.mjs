// Gerador das páginas estáticas para o Google (decisão D26, Etapa 3).
//
// O app é uma página só, renderizada por JavaScript. Para o Google ele parece vazio. Este script
// gera, a cada build, páginas HTML comuns, com texto pronto no código-fonte, para:
//   - cada ferramenta (teste de perfil, simuladores de Tesouro, FII, BDR e ETF, Meu Mês);
//   - a trilha "Sair das dívidas" (9 aulas, lidas de data/trilhas.ts);
//   - um guia por classe de ativo (11, lidos de data/analises/*.ts);
//   - "Taxas do Tesouro Direto hoje" (lida de mercadoOficial.json, atualizado toda semana).
// Cada página tem um botão que abre a ferramenta no app.
//
// REGRAS DE CONTEÚDO (não mexer sem ler a D26 no docs/07):
//   1. Os guias de ativos NÃO citam produtos (códigos como IVVB11) nem percentuais de alocação.
//      Os exemplos ilustrativos e os gráficos continuam só dentro do app. O filtro está em
//      `limparTexto`/`criteriosPublicos` e tem teste.
//   2. Nenhuma página explica a metodologia da carteira (matrizes, veto, pesos): ela roda só na API
//      (D2/D6). As páginas falam do que o cliente recebe, não de como o motor decide.
//   3. Toda página termina com o aviso educacional.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { carregarTs } from './ts-loader.mjs'

export const DOMINIO = 'https://carteiraideal.app.br'

/** Data da última revisão do conteúdo escrito à mão. Atualizar quando os textos forem revisados. */
export const REVISADO_EM = '2026-09-28'

const AVISO = 'Conteúdo educacional. Não é recomendação de investimento.'

/**
 * Quem assina o conteúdo (D26, Etapa 4). O Google avalia quem está por trás de conteúdo de finanças.
 * ATENÇÃO: o nome também aparece no JSON-LD ("founder") do index.html da raiz. Mudou aqui, mude lá.
 * Nunca acrescentar certificação ou registro que a pessoa não tenha (CNPI, CEA, CFP, CPA, ANBIMA,
 * CVM): há teste que barra essas siglas nas páginas públicas.
 */
export const AUTOR = {
  nome: 'Leonardo Daher',
  formacao: 'Administração de Empresas e Direito',
  email: 'acarteiraideal@gmail.com',
  instagram: 'https://www.instagram.com/acarteiraideal/',
  youtube: 'https://www.youtube.com/@acarteiraideal',
}
const ID_AUTOR = `${DOMINIO}/sobre/#autor`
const ID_ORG = `${DOMINIO}/#org`

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

export function esc(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Corta no limite sem quebrar palavra, para meta description. */
export function resumir(texto, limite = 155) {
  const t = texto.replace(/\s+/g, ' ').trim()
  if (t.length <= limite) return t
  const corte = t.slice(0, limite - 1)
  return corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:(\s-]+$/, '') + '…'
}

const RE_CODIGO_DE_PRODUTO = /\b[A-Z0-9]{4}\d{2}\b/
const RE_FRASE_DE_EXEMPLO = /alocação de referência|exemplos?\s+(acima|abaixo|usados?)|nomes?\s+acima|ilustrar|ilustrativ|\btoque\b/i
/** Percentual de alocação da carteira, ex.: "5% a 10% da carteira", "até 3% do total". */
const RE_ALOCACAO = /\d+(?:[,.]\d+)?%\s*(?:a\s*\d+(?:[,.]\d+)?%\s*)?(?:da carteira|do total|do patrimônio|cada|por (?:posição|ativo|título))/i

/** Separa em frases, sem quebrar em "ex.:", "R$ 250 mil" nem em decimais. */
function frases(texto) {
  return texto.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“])/)
}

const ruim = (t) => RE_CODIGO_DE_PRODUTO.test(t) || RE_FRASE_DE_EXEMPLO.test(t)

/**
 * Tira o que cita produto, exemplo ou percentual de alocação (ver regra 1 do cabeçalho).
 * Trabalha por frase e, dentro dela, por trecho separado por ";", para não perder o resto da
 * frase quando só o final fala dos "nomes acima".
 */
export function limparTexto(texto) {
  const semPercentuais = texto.replace(/\s*\([^)]*\)/g, (par) => (RE_ALOCACAO.test(par) ? '' : par))
  return frases(semPercentuais)
    .map((f) => {
      if (!ruim(f) && !RE_ALOCACAO.test(f)) return f
      const trechos = f
        .replace(/[.!?]+$/, '')
        .split(/;\s*/)
        .filter((t) => !ruim(t) && !RE_ALOCACAO.test(t))
      if (!trechos.length) return ''
      const junto = trechos.join('; ') + '.'
      return junto[0].toUpperCase() + junto.slice(1)
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function criteriosPublicos(criterios) {
  return criterios.map(limparTexto).filter((c) => c.length > 0)
}

const RE_METODOLOGIA = /\bpilar\s*\d|\bopç(?:ão|ões)\s+[A-C]\b|\bveto\b|\bmatriz\b|restrição dura|calibrador/i

/** Tira frases que falam de como o motor da carteira decide (regra 2 do cabeçalho). */
export function semMetodologia(texto) {
  return frases(texto)
    .filter((f) => !RE_METODOLOGIA.test(f))
    .join(' ')
    .trim()
}

function paragrafos(lista) {
  return lista.map((p) => `<p>${esc(p)}</p>`).join('\n')
}

function dataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// ---------------------------------------------------------------------------------------------
// Modelo da página
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Pagina
 * @property {string} caminho     ex.: '/simulador-fii/' (sempre com barra no começo e no fim)
 * @property {string} titulo      texto da tag <title> (sem o nome do site)
 * @property {string} descricao   meta description
 * @property {string} h1
 * @property {string} lead        frase de abertura
 * @property {string} corpo       HTML já escapado das seções
 * @property {{nome: string, caminho: string}[]} migalhas  sem o "Início"
 * @property {{p: string, r: string}[]} [faq]
 * @property {{texto: string, href: string, tipo?: 'app'|'site'}[]} [botoes]
 * @property {{texto: string, href: string}[]} [relacionados]
 * @property {'Article'|'WebPage'|'AboutPage'} [schema]
 * @property {string} lastmod     AAAA-MM-DD
 * @property {boolean} [semByline] não mostra "Por ..." (página Sobre)
 * @property {string} [rotuloData]  troca "Revisado em" (ex.: "Dados de")
 */

function jsonLd(pg) {
  const url = DOMINIO + pg.caminho
  const trilha = [{ nome: 'Início', caminho: '/' }, ...pg.migalhas, { nome: pg.h1, caminho: pg.caminho }]
  const grafo = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: trilha.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.nome, item: DOMINIO + m.caminho })),
    },
    {
      '@type': pg.schema ?? 'WebPage',
      '@id': url + '#pagina',
      url,
      name: pg.h1,
      ...(pg.schema === 'Article' ? { headline: pg.h1 } : {}),
      description: pg.descricao,
      inLanguage: 'pt-BR',
      dateModified: pg.lastmod,
      isPartOf: { '@id': DOMINIO + '/#site' },
      author: { '@id': ID_AUTOR },
      publisher: { '@id': ID_ORG },
    },
    {
      '@type': 'Person',
      '@id': ID_AUTOR,
      name: AUTOR.nome,
      url: DOMINIO + '/sobre/',
      description: `Criador do Carteira Ideal. Formado em ${AUTOR.formacao}.`,
      sameAs: [AUTOR.instagram, AUTOR.youtube],
    },
    {
      '@type': 'Organization',
      '@id': ID_ORG,
      name: 'Carteira Ideal',
      url: DOMINIO + '/',
      logo: DOMINIO + '/assets/apple-touch-icon.png',
      founder: { '@id': ID_AUTOR },
    },
  ]
  if (pg.faq?.length) {
    grafo.push({
      '@type': 'FAQPage',
      mainEntity: pg.faq.map((f) => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    })
  }
  // "<" dentro do JSON não pode fechar a tag <script>.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo }, null, 2).replaceAll('<', '\\u003c')
}

const LINKS_RODAPE = [
  ['Teste de perfil de investidor', '/teste-perfil-de-investidor/'],
  ['Simulador de Tesouro Direto', '/simulador-tesouro-direto/'],
  ['Simulador de FII', '/simulador-fii/'],
  ['Simulador de BDR', '/simulador-bdr/'],
  ['Simulador de ETF', '/simulador-etf/'],
  ['Meus Ativos', '/minha-carteira/'],
  ['Meu Mês', '/meu-mes/'],
  ['Aprender', '/aprender/'],
  ['Sobre', '/sobre/'],
  ['Privacidade', '/privacidade/'],
  ['Metodologia e fontes', '/metodologia-e-fontes/'],
]

/** Monta o HTML completo de uma página. */
export function montarPagina(pg) {
  const url = DOMINIO + pg.caminho
  const migalhas = [{ nome: 'Início', caminho: '/' }, ...pg.migalhas]
  const nav = migalhas.map((m) => `<a href="${esc(m.caminho)}">${esc(m.nome)}</a>`).join('<span aria-hidden="true"> › </span>')

  const botoes = (pg.botoes ?? [])
    .map((b) => `<a class="btn ${b.tipo === 'site' ? 'btn-sec' : 'btn-app'}" href="${esc(b.href)}">${esc(b.texto)}</a>`)
    .join('\n        ')

  const faq = pg.faq?.length
    ? `<section class="faq" aria-labelledby="faq-titulo">
        <h2 id="faq-titulo">Perguntas frequentes</h2>
        ${pg.faq.map((f) => `<details><summary>${esc(f.p)}</summary><p>${esc(f.r)}</p></details>`).join('\n        ')}
      </section>`
    : ''

  const relacionados = pg.relacionados?.length
    ? `<section class="relacionados" aria-labelledby="rel-titulo">
        <h2 id="rel-titulo">Continue por aqui</h2>
        <ul>${pg.relacionados.map((r) => `<li><a href="${esc(r.href)}">${esc(r.texto)}</a></li>`).join('')}</ul>
      </section>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(pg.titulo)} | Carteira Ideal</title>
    <meta name="description" content="${esc(pg.descricao)}" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#0a0d13" />
    <meta property="og:type" content="${pg.schema === 'Article' ? 'article' : 'website'}" />
    <meta property="og:site_name" content="Carteira Ideal" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="${esc(pg.titulo)}" />
    <meta property="og:description" content="${esc(pg.descricao)}" />
    <meta property="og:image" content="${DOMINIO}/assets/og-image.png?v=2" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <link rel="preload" href="/assets/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/assets/fonts/sora-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/paginas.css" />
    <script>
      (function () {
        try {
          if (localStorage.getItem("theme") === "light") document.documentElement.classList.add("light");
        } catch (e) {}
      })();
    </script>
    <script type="application/ld+json">
${jsonLd(pg)}
    </script>
  </head>
  <body>
    <header class="topo">
      <a class="marca" href="/"><img src="/assets/logo-mark.svg" alt="" width="32" height="32" /><span>Carteira Ideal</span></a>
      <a class="topo-link" href="/app/">Abrir o app</a>
    </header>
    <main class="conteudo">
      <nav class="migalhas" aria-label="Você está aqui">${nav}</nav>
      <article>
        <h1>${esc(pg.h1)}</h1>
        ${pg.semByline ? '' : `<p class="byline">Por <a href="/sobre/">${esc(AUTOR.nome)}</a> · ${esc(pg.rotuloData ?? 'Revisado em')} ${dataBr(pg.lastmod)}</p>`}
        <p class="lead">${esc(pg.lead)}</p>
        ${botoes ? `<div class="botoes">\n        ${botoes}\n      </div>` : ''}
        ${pg.corpo}
        ${faq}
        ${relacionados}
        <p class="aviso" role="note">${AVISO} Antes de investir, confira as condições de cada produto com a sua corretora ou com um profissional certificado.</p>
      </article>
    </main>
    <footer class="rodape">
      <ul>${LINKS_RODAPE.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul>
      <p>Carteira Ideal · <a href="https://www.instagram.com/acarteiraideal/" rel="noopener">Instagram</a> · <a href="https://www.youtube.com/@acarteiraideal" rel="noopener">YouTube</a> · <a href="mailto:acarteiraideal@gmail.com">E-mail</a></p>
    </footer>
  </body>
</html>
`
}

function secao(titulo, html) {
  return `<section>\n<h2>${esc(titulo)}</h2>\n${html}\n</section>`
}

// ---------------------------------------------------------------------------------------------
// Páginas das ferramentas (texto escrito à mão, a partir do docs/07: D9 a D24)
// ---------------------------------------------------------------------------------------------

function paginaPerfil() {
  return {
    caminho: '/teste-perfil-de-investidor/',
    titulo: 'Teste de perfil de investidor grátis, além do suitability',
    descricao: 'Teste de perfil de investidor grátis em 14 perguntas: soma ao suitability da corretora a sua vida real (reserva, dívidas) e mostra uma carteira de referência.',
    h1: 'Teste de perfil de investidor que olha além do suitability',
    lead: 'São 14 perguntas, em menos de 3 minutos, sem cadastro. Você descobre o seu perfil e recebe uma carteira de referência dividida em 11 classes de ativos.',
    botoes: [{ texto: 'Fazer o teste agora', href: '/app/' }],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'Por que o teste da corretora não basta',
        `<p>O questionário de perfil de investidor (o suitability) que as corretoras aplicam mede, principalmente, quanto risco você aceita ver na tela: quanto de queda tolera e por quanto tempo pretende investir. É uma informação importante, mas é uma <strong>intenção</strong>.</p>
<p>Uma pessoa pode se sentir arrojada e, ao mesmo tempo, ter pouca reserva de emergência, uma dívida no cartão ou uma viagem grande marcada para daqui a dois anos. Nesse caso, a carteira "arrojada" do teste tradicional pode ser difícil de sustentar na vida real. O Carteira Ideal soma as duas coisas: a intenção e a realidade.</p>`,
      ),
      secao(
        'As 14 perguntas, em dois blocos',
        `<p><strong>Bloco 1: perfil de investidor (7 perguntas).</strong> Objetivo, prazo, tolerância a quedas, reserva de emergência, patrimônio disponível, experiência e reação a notícias de crise. É o que se espera de um suitability.</p>
<p><strong>Bloco 2: Arquitetura Patrimonial (7 perguntas).</strong> Olha para a sua vida financeira além do mercado: quanto tempo a sua reserva sustenta as contas, como estão as suas dívidas, se há grandes gastos planejados para os próximos anos, como você reagiria a uma queda forte, se precisa de renda mensal da carteira, como é a estabilidade do seu trabalho e como está o Imposto de Renda e o planejamento sucessório.</p>`,
      ),
      secao(
        'O que você recebe no final',
        `<ul>
<li><strong>Um dos 9 perfis de carteira</strong>, que combina o que você diz que tolera com o que a sua situação permite.</li>
<li><strong>Uma carteira de referência em percentuais</strong>, distribuída em 11 classes de ativos, do Tesouro Selic às criptomoedas, com a explicação do papel de cada uma.</li>
<li><strong>Um simulador em reais</strong>, para ver quanto de cada fatia seria o seu dinheiro.</li>
<li><strong>Atalhos para as ferramentas</strong> do site: simuladores de Tesouro Direto, FII, BDR e ETF e o Meu Mês, para organizar as contas do mês.</li>
</ul>`,
      ),
      secao(
        'Suas respostas ficam onde?',
        `<p>As respostas ficam salvas só no seu aparelho. Para calcular a carteira, elas são enviadas ao servidor, que devolve o resultado sem guardar nada. Não há cadastro, e-mail ou telefone.</p>`,
      ),
      secao(
        'O que o teste não é',
        `<p>É uma ferramenta educacional. Ela não substitui o questionário de suitability que a sua corretora precisa aplicar, não é recomendação de compra de nenhum produto e não conhece tudo da sua vida. Use o resultado para entender melhor como a sua situação muda a forma de investir e converse com um profissional certificado antes de decidir.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O teste de perfil de investidor é gratuito?', r: 'Sim. O Carteira Ideal é gratuito e não pede cadastro, e-mail nem telefone.' },
      { p: 'Quanto tempo leva?', r: 'Menos de 3 minutos. São 14 perguntas de múltipla escolha, uma por tela.' },
      { p: 'Preciso ter feito o teste na corretora?', r: 'Não. O app já traz as perguntas de perfil de investidor e as de vida real no mesmo teste.' },
      { p: 'O resultado é uma recomendação de investimento?', r: 'Não. É um conteúdo educacional para você entender como a sua situação de vida muda a forma de investir.' },
    ],
    relacionados: [
      { texto: 'Guias sobre cada classe de ativo', href: '/aprender/' },
      { texto: 'Meu Mês: organize as contas antes de investir', href: '/meu-mes/' },
      { texto: 'Simulador de Tesouro Direto', href: '/simulador-tesouro-direto/' },
    ],
  }
}

function paginaTesouro(temTaxas) {
  return {
    caminho: '/simulador-tesouro-direto/',
    titulo: 'Simulador de Tesouro Direto com IR e custódia',
    descricao: 'Simule quanto um título do Tesouro Direto rende até o vencimento, já com Imposto de Renda regressivo e taxa de custódia da B3. Grátis, sem cadastro.',
    h1: 'Simulador de Tesouro Direto',
    lead: 'Escolha um título e um valor e veja quanto ele rende até o vencimento, já descontados a taxa de custódia da B3 e o Imposto de Renda.',
    botoes: [
      { texto: 'Abrir o simulador', href: '/app/?tela=simuleTesouro' },
      ...(temTaxas ? [{ texto: 'Ver as taxas de hoje', href: '/taxas-tesouro-direto-hoje/', tipo: 'site' }] : []),
    ],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'O que o simulador calcula',
        `<ul>
<li><strong>Valor bruto no vencimento</strong>, com a Selic ou o IPCA projetados pela mediana do Boletim Focus, do Banco Central.</li>
<li><strong>Taxa de custódia da B3</strong>, de 0,20% ao ano (o Tesouro Selic é isento até R$ 10 mil).</li>
<li><strong>Imposto de Renda regressivo</strong> sobre o ganho, de 22,5% até 180 dias a 15% acima de 720 dias.</li>
<li><strong>Valor líquido</strong>, o que sobra depois dos descontos.</li>
<li><strong>Valor em dinheiro de hoje</strong> e o ganho acima da inflação, para você comparar o que o dinheiro compra de fato.</li>
</ul>
<p>O simulador usa os títulos sem cupom que estão à venda, em ordem de vencimento, nunca ordenados por maior taxa. Títulos com juros semestrais, Renda+ e Educa+ ficam fora do simulador, com a explicação na tela.</p>`,
      ),
      secao(
        'Os três tipos de título',
        `<p><strong>Tesouro Selic:</strong> pós-fixado, acompanha a taxa Selic dia a dia e tem liquidez diária. Por isso é o mais usado na reserva de emergência. A taxa aparece como um pequeno ajuste sobre a Selic, como "Selic + 0,05%".</p>
<p><strong>Tesouro Prefixado:</strong> a taxa de retorno é conhecida na hora da compra. Faz sentido para uma meta com data certa, se o título for levado até o vencimento. Vender antes, com os juros em alta, pode gerar perda.</p>
<p><strong>Tesouro IPCA+:</strong> rende a inflação (IPCA) mais uma taxa fixa ao ano. Protege o poder de compra no longo prazo, e a marcação a mercado também vale se você vender antes do vencimento.</p>`,
      ),
      secao(
        'De onde vêm os números',
        `<p>As taxas e os preços vêm do Tesouro Transparente e os indicadores (Selic, IPCA e Boletim Focus) vêm do Banco Central. Os dados são atualizados uma vez por semana, então podem diferir do que aparece no site do Tesouro Direto na hora em que você compra. Confira o valor final na sua corretora antes de decidir.</p>
<p>O app também mostra um gráfico da Selic meta e do IPCA em 12 meses desde 1999, para você ver em que ponto do ciclo de juros estamos.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O simulador de Tesouro Direto é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'O resultado é garantido?', r: 'Não. É uma simulação com premissas de mercado (a mediana do Boletim Focus) e as taxas da última atualização semanal. A rentabilidade real depende do que acontecer com a Selic e a inflação e das condições na hora da compra.' },
      { p: 'Qual a taxa de custódia do Tesouro Direto?', r: 'A B3 cobra 0,20% ao ano sobre o valor dos títulos. O Tesouro Selic é isento até R$ 10 mil. A sua corretora pode ter regras próprias, então confira com ela.' },
      { p: 'Como funciona o Imposto de Renda do Tesouro Direto?', r: 'O imposto incide sobre o ganho e é regressivo: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 dias. Há também IOF no resgate nos primeiros 30 dias.' },
    ],
    relacionados: [
      { texto: 'Tesouro Selic: como funciona e quando usar', href: '/aprender/ativos/tesouro-selic/' },
      { texto: 'Tesouro IPCA+: como escolher o vencimento', href: '/aprender/ativos/tesouro-ipca/' },
      { texto: 'Tesouro Prefixado: como funciona', href: '/aprender/ativos/tesouro-prefixado/' },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
    ],
  }
}

function paginaFii() {
  return {
    caminho: '/simulador-fii/',
    titulo: 'Simulador de FII: quanto rendem as cotas',
    descricao: 'Veja o rendimento estimado dos fundos imobiliários mais negociados, por setor, e simule a renda mensal de uma quantidade de cotas. Grátis, sem cadastro.',
    h1: 'Simulador de FII (fundos imobiliários)',
    lead: 'Veja o rendimento estimado dos FIIs mais negociados da bolsa, separados por setor, e simule quanto uma quantidade de cotas poderia render por mês.',
    botoes: [{ texto: 'Abrir o simulador', href: '/app/?tela=simuleFii' }],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'O que você encontra na ferramenta',
        `<ul>
<li>Uma <strong>lista por setor</strong> dos fundos que negociam mais de R$ 1 milhão por dia, ou seja, com liquidez.</li>
<li>Uma <strong>busca</strong> para os demais fundos, com aviso de liquidez quando o volume é baixo.</li>
<li>O <strong>rendimento por cota</strong> e o rendimento estimado em percentual ao mês.</li>
<li>Uma <strong>simulação em quantidade de cotas</strong> (de 10 a 5.000, ou o valor que você digitar) e o quanto isso renderia por mês.</li>
</ul>
<p>A tela é descritiva: mostra dados, na ordem de liquidez e por setor, e não faz ranking nem indica qual fundo comprar.</p>`,
      ),
      secao(
        'De onde vem o rendimento estimado',
        `<p>O cálculo parte do Informe Mensal Estruturado que cada fundo entrega à CVM (o dividend yield do mês sobre o valor patrimonial da cota). Os dados são atualizados uma vez por mês, depois da divulgação dos informes. Quando o valor calculado destoa do histórico do fundo, a estimativa recebe uma trava e um aviso de <strong>confiança baixa</strong>, e você deve conferir o rendimento anunciado pelo próprio fundo.</p>
<p>A cotação e o volume negociado vêm de dados de mercado. Como os informes têm defasagem, o rendimento do mês mais recente pode ainda não ter entrado.</p>`,
      ),
      secao(
        'Para que serve um FII na carteira',
        `<p>Fundos imobiliários investem em imóveis (galpões, shoppings, lajes corporativas) ou em recebíveis imobiliários e distribuem renda mensal. Os rendimentos costumam ser isentos de Imposto de Renda para pessoa física, dentro das regras vigentes, mas as condições variam por fundo e por período, então confira antes. O risco é moderado: as cotas oscilam na bolsa e os rendimentos podem cair.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O simulador de FII é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'O rendimento mostrado é garantido?', r: 'Não. É uma estimativa baseada nos informes da CVM e no histórico, e os FIIs podem pagar mais ou menos no mês seguinte.' },
      { p: 'Por que alguns fundos aparecem só na busca?', r: 'A lista principal traz os fundos com mais de R$ 1 milhão de negociação por dia. Nos demais, comprar ou vender pode levar tempo ou exigir aceitar um preço pior, então a tela avisa.' },
      { p: 'A ferramenta indica qual FII comprar?', r: 'Não. Ela mostra dados por setor, na ordem de liquidez, e não faz ranking nem recomendação.' },
    ],
    relacionados: [
      { texto: 'Fundos imobiliários (FIIs): como funcionam e o que olhar', href: '/aprender/ativos/fundos-imobiliarios-fiis/' },
      { texto: 'Simulador de ETF', href: '/simulador-etf/' },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
    ],
  }
}

function paginaBdr() {
  return {
    caminho: '/simulador-bdr/',
    titulo: 'Simulador de BDR: os mais negociados da B3',
    descricao: 'Veja os BDRs mais negociados da B3, por setor, e simule quantos BDRs o seu dinheiro compra. Dados do Boletim de Preços da B3. Grátis, sem cadastro.',
    h1: 'Simulador de BDR',
    lead: 'Veja os BDRs mais negociados na bolsa brasileira, separados por setor, e simule quantos BDRs o valor que você tem hoje consegue comprar.',
    botoes: [{ texto: 'Abrir o simulador', href: '/app/?tela=simuleBdr' }],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'O que é um BDR',
        `<p>BDR (Brazilian Depositary Receipt) é um recibo, negociado na B3, que representa ações de empresas estrangeiras. Com ele você compra exposição a empresas de fora do Brasil em reais e pela sua corretora, sem abrir conta no exterior.</p>
<p>O preço do BDR reflete a ação original convertida para reais, então o resultado também depende do <strong>dólar</strong>: ele pode ajudar ou atrapalhar. Como cada BDR pode representar uma fração ou várias ações, o preço nunca é igual ao da ação convertida, e a ferramenta mostra essa proporção.</p>`,
      ),
      secao(
        'O que você encontra na ferramenta',
        `<ul>
<li>Os <strong>35 BDRs de ações e 5 BDRs de ETF</strong> com maior volume médio de negociação, por setor.</li>
<li>Uma <strong>busca</strong> com todos os demais BDRs, com aviso quando a negociação é baixa.</li>
<li>Preço de fechamento, variação em 3 meses, volume médio e a proporção entre o BDR e a ação.</li>
<li>Uma <strong>simulação de compra</strong>: quantos BDRs o valor escolhido compra.</li>
</ul>
<p>A tela é estritamente descritiva. Ela mostra dados e não faz ranking, cálculo de valor justo nem recomendação de compra.</p>`,
      ),
      secao(
        'De onde vêm os dados',
        `<p>Preço e volume vêm do Boletim de Preços oficial da B3, atualizado nos dias úteis. Nome, setor e proporção vêm de cadastros de mercado. Em feriados da B3 nada muda.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O simulador de BDR é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'Por que o preço do BDR é diferente do preço da ação?', r: 'Porque o BDR pode representar uma fração ou várias ações, e o preço é convertido para reais. A ferramenta mostra a proporção de cada um.' },
      { p: 'O BDR tem risco cambial?', r: 'Sim. Como o valor reflete a ação original em outra moeda, a variação do dólar afeta o resultado, para cima ou para baixo.' },
      { p: 'A ferramenta indica qual BDR comprar?', r: 'Não. Ela mostra dados por setor, na ordem de volume negociado, e não faz ranking nem recomendação.' },
    ],
    relacionados: [
      { texto: 'BDRs: como investir em empresas estrangeiras pela B3', href: '/aprender/ativos/bdrs/' },
      { texto: 'Simulador de ETF', href: '/simulador-etf/' },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
    ],
  }
}

function paginaEtf() {
  return {
    caminho: '/simulador-etf/',
    titulo: 'Simulador de ETF: os mais negociados da B3',
    descricao: 'Veja os ETFs mais negociados da B3 por categoria (bolsa, exterior, renda fixa, cripto, ouro) e simule quantas cotas o seu dinheiro compra. Grátis.',
    h1: 'Simulador de ETF',
    lead: 'Veja os ETFs mais negociados da bolsa brasileira, separados por categoria, e simule quantas cotas o valor que você tem hoje consegue comprar.',
    botoes: [{ texto: 'Abrir o simulador', href: '/app/?tela=simuleEtf' }],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'O que é um ETF',
        `<p>ETF (Exchange Traded Fund) é um fundo de índice negociado em bolsa como se fosse uma ação. Ele acompanha um índice, como o Ibovespa, o S&amp;P 500, o preço do ouro ou a taxa Selic, e permite diversificar comprando uma única cota.</p>`,
      ),
      secao(
        'O que você encontra na ferramenta',
        `<ul>
<li>Os <strong>40 ETFs</strong> com maior volume médio negociado, em 5 categorias: bolsa brasileira, bolsa exterior, renda fixa, cripto e ouro, dólar e commodities.</li>
<li>Uma <strong>busca</strong> com todos os demais ETFs.</li>
<li>Para cada um: o índice acompanhado, se o preço também varia com o dólar (nos de bolsa exterior), o fechamento, a variação em 3 meses, o volume médio e a faixa de preço de 52 semanas.</li>
<li>Uma <strong>simulação de compra</strong>: quantas cotas o valor escolhido compra.</li>
</ul>
<p>Como nas outras telas, ela só descreve os dados: não faz ranking nem indica qual ETF comprar.</p>`,
      ),
      secao(
        'Imposto de Renda, em linhas gerais',
        `<p>Nos ETFs de renda variável (bolsa, exterior, cripto, ouro), o imposto incide sobre o lucro na venda, e é o próprio investidor que recolhe por DARF. Não vale a isenção de R$ 20 mil por mês das ações. Nos ETFs de renda fixa, o imposto é retido na fonte, de 15% a 25% conforme o prazo médio da carteira do fundo. As regras mudam com o tempo, então confira as vigentes antes de decidir. A ferramenta mostra o aviso de cada categoria.</p>`,
      ),
      secao(
        'De onde vêm os dados',
        `<p>Preço e volume vêm do Boletim de Preços oficial da B3, atualizado nos dias úteis. Índice e informação de câmbio de cada ETF são conferidos à mão a partir dos materiais das gestoras e da B3.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O simulador de ETF é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'O que significa um ETF variar com o dólar?', r: 'Os ETFs que acompanham índices de fora do Brasil, sem proteção cambial, sobem ou caem também conforme o dólar. A ferramenta indica, em cada um, se o câmbio entra ou não no preço.' },
      { p: 'A ferramenta indica qual ETF comprar?', r: 'Não. Ela mostra dados por categoria, na ordem de volume negociado, e não faz ranking nem recomendação.' },
    ],
    relacionados: [
      { texto: 'ETFs e fundos internacionais: diversificar fora do Brasil', href: '/aprender/ativos/fundos-internacionais-etfs/' },
      { texto: 'Simulador de BDR', href: '/simulador-bdr/' },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
    ],
  }
}

function paginaMeuMes(hubDividas) {
  return {
    caminho: '/meu-mes/',
    titulo: 'Meu Mês: controle financeiro e plano para sair das dívidas',
    descricao: 'Organize o mês em 3 potes (guardar, crescer, gastar), controle o cartão de crédito e monte um plano para sair das dívidas. Grátis, dados só no seu aparelho.',
    h1: 'Meu Mês: controle das contas e planejamento financeiro',
    lead: 'Salário, contas, cartão e dívidas num só lugar, no molde dos três potes: uma parte para guardar, uma para fazer crescer e uma para gastar sem culpa.',
    botoes: [
      { texto: 'Abrir o Meu Mês', href: '/app/?tela=meuMes' },
      { texto: 'Guia: sair das dívidas', href: hubDividas, tipo: 'site' },
    ],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'Como funciona',
        `<p>Você lança o salário e as contas do mês. O Meu Mês reserva um cofrinho mensal para as contas do ano (IPVA, IPTU, seguro) e mostra a sobra: <strong>salário menos contas menos cofrinhos</strong>. Essa sobra é dividida entre três potes:</p>
<ul>
<li><strong>Guardar:</strong> reserva de emergência e metas de curto prazo.</li>
<li><strong>Fazer crescer:</strong> investimentos de longo prazo.</li>
<li><strong>Gastar:</strong> o que você pode gastar sem culpa.</li>
</ul>`,
      ),
      secao(
        'Cartão de crédito com teto',
        `<p>O app calcula um teto mensal para o cartão, mostra um semáforo (verde, amarelo, vermelho) conforme você se aproxima dele e registra compras à vista e parceladas, com ou sem juros. A fatura entra como conta no mês seguinte, para o parcelamento não virar surpresa.</p>`,
      ),
      secao(
        'Modo Recuperação, para quem tem dívida cara',
        `<p>Se você tem dívida no rotativo do cartão, cheque especial, empréstimo pessoal ou qualquer dívida com juros a partir de 3% ao mês, o Modo Recuperação liga sozinho. Ele troca o pote de investir por um pote para quitar as dívidas, monta um plano de quitação (avalanche ou bola de neve), propõe o pacto de não parcelar e traz um roteiro de negociação com fontes oficiais.</p>
<p>A lógica é simples: enquanto houver dívida cara, quitar costuma ser o melhor "investimento" disponível, porque nenhum investimento seguro rende o que o cartão ou o cheque especial cobram.</p>`,
      ),
      secao(
        'Onde ficam os seus dados',
        `<p>Tudo o que você lança no Meu Mês fica só no seu aparelho. Nada é enviado para servidor, e o app oferece uma cópia de segurança para você guardar.</p>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'O Meu Mês é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'Meus dados financeiros ficam guardados na internet?', r: 'Não. Ficam só no seu aparelho e não são enviados a nenhum servidor.' },
      { p: 'O que é o método avalanche e o método bola de neve?', r: 'No avalanche, você paga primeiro a dívida de maior juro, o que custa menos no total. Na bola de neve, você começa pela menor dívida para ganhar motivação. O app monta o plano nos dois formatos.' },
    ],
    relacionados: [
      { texto: 'Sair das dívidas: guia em 9 aulas curtas', href: hubDividas },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
      { texto: 'Tesouro Selic: para a reserva de emergência', href: '/aprender/ativos/tesouro-selic/' },
    ],
  }
}

/**
 * Minha Carteira (D36): uma das três funcionalidades principais, junto com o questionário e o Meu Mês.
 * Só descreve o que o app JÁ faz; não promete o que ainda não existe (notas em PDF, Imposto de Renda).
 */
function paginaMinhaCarteira() {
  return {
    caminho: '/minha-carteira/',
    titulo: 'Meus Ativos: preço médio dos seus ativos da B3',
    descricao: 'Importe os extratos da B3 e veja o preço médio de cada ativo, os proventos recebidos e se o histórico confere com a sua custódia. Grátis, dados só no seu aparelho.',
    h1: 'Meus Ativos: seus ativos da B3 com preço médio confiável',
    lead: 'Importe os extratos da Área do Investidor da B3 e acompanhe a carteira que você realmente tem: preço médio de cada ativo, proventos, evolução do capital aplicado e a conferência com a sua posição.',
    botoes: [
      { texto: 'Abrir Meus Ativos', href: '/app/?tela=minhaCarteira' },
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/', tipo: 'site' },
    ],
    migalhas: [],
    schema: 'WebPage',
    lastmod: '2026-10-01',
    corpo: [
      secao(
        'Como funciona',
        `<p>Na Área do Investidor da B3, em Extratos, você baixa os arquivos em Excel e os arrasta para Meus Ativos. Os mais úteis são:</p>
<ul>
<li><strong>Negociação:</strong> cada compra e venda, com a data real do negócio.</li>
<li><strong>Movimentação:</strong> o Tesouro Direto, os proventos e outros eventos.</li>
<li><strong>Posição:</strong> o que você tem hoje, com quantidade e valor atualizado.</li>
</ul>
<p>Você escolhe o período que quiser e pode enviar vários arquivos de uma vez. Quem controla a carteira numa planilha própria também pode importá-la, ou cadastrar os ativos à mão (nome, quantidade, preço médio e classe).</p>`,
      ),
      secao(
        'Um preço médio que dá para confiar',
        `<p>O preço médio só está certo se o histórico estiver completo. Por isso o app compara, ativo por ativo, a quantidade calculada pelos seus lançamentos com a que a B3 mostra na sua posição.</p>
<p>Quando não bate, ele diz o motivo: negócios muito recentes que a custódia ainda não mostra (a liquidação leva dois dias úteis) ou compras anteriores ao período que você importou. Nesse caso, você informa o preço médio do que já tinha ou importa um período mais longo. Se você errar um lançamento, é possível corrigi-lo ou excluí-lo, e a correção não volta atrás quando você importar o mesmo extrato de novo.</p>`,
      ),
      secao(
        'O que você vê',
        `<ul>
<li><strong>Patrimônio e composição</strong>, quando você importa a posição.</li>
<li><strong>Resultado</strong> dos ativos em que o preço médio é conhecido, dizendo que parte da carteira essa conta cobre.</li>
<li><strong>Proventos</strong> mês a mês, como na página de Proventos da B3: o recebido este ano e nos últimos 12 meses, o que ainda será pago e o detalhe de cada mês.</li>
<li><strong>Evolução do capital aplicado</strong>, a preço de custo. Não é o valor de mercado da carteira no passado.</li>
<li><strong>Comparação com a carteira de referência</strong>, se você tiver respondido o questionário.</li>
</ul>`,
      ),
      secao(
        'Com ou sem o questionário',
        `<p>Meus Ativos funciona sozinho: você não precisa responder o questionário para usá-lo.</p>
<p>Se você respondê-lo, o app compara a carteira que você tem com a carteira de referência do seu perfil e mostra, classe por classe, o que está acima ou abaixo do alvo e como distribuir um novo aporte entre as classes que ficaram abaixo. A carteira de referência é um exemplo educacional gerado pelas suas respostas, não uma recomendação.</p>`,
      ),
      secao(
        'Onde ficam os seus dados',
        `<p>Os arquivos são lidos no seu aparelho e os lançamentos ficam só nele. Nada é enviado para servidor, e o app oferece uma cópia de segurança para você guardar. Colunas como número da conta ou CPF, se vierem no arquivo, não são guardadas.</p>`,
      ),
      secao(
        'O que ele ainda não faz',
        `<ul>
<li>Não lê notas de corretagem em PDF.</li>
<li>Não importa automaticamente a renda fixa de bancos (CDB, LCI), a previdência nem investimentos fora da B3: dá para cadastrá-los à mão, informando quantidade, preço médio e a classe do ativo.</li>
<li>Não calcula Imposto de Renda.</li>
</ul>`,
      ),
    ].join('\n'),
    faq: [
      { p: 'Meus Ativos é gratuito?', r: 'Sim, é gratuito e não pede cadastro.' },
      { p: 'Preciso responder o questionário para usar?', r: 'Não. Meus Ativos funciona sozinho. Quem responde o questionário ganha, além disso, a comparação entre a carteira que tem e a carteira de referência do seu perfil.' },
      { p: 'Meus ativos ficam guardados na internet?', r: 'Não. Os arquivos são lidos no seu aparelho e os lançamentos ficam só nele, sem envio a nenhum servidor.' },
      { p: 'Quais arquivos da B3 posso importar?', r: 'Os extratos de Negociação, Movimentação e Posição, além dos de proventos, em Excel ou CSV. Você também pode importar uma planilha própria ou lançar à mão.' },
    ],
    relacionados: [
      { texto: 'Descubra o seu perfil de investidor', href: '/teste-perfil-de-investidor/' },
      { texto: 'Meu Mês: controle financeiro', href: '/meu-mes/' },
      { texto: 'Aprender: aulas curtas sobre investimentos', href: '/aprender/' },
    ],
  }
}

// ---------------------------------------------------------------------------------------------
// Etapa 4: quem faz o projeto e como ele funciona (transparência, sem expor o motor)
// ---------------------------------------------------------------------------------------------

function paginaSobre() {
  return {
    caminho: '/sobre/',
    titulo: `Sobre o Carteira Ideal e ${AUTOR.nome}`,
    descricao: `Projeto gratuito de educação financeira criado por ${AUTOR.nome}, formado em ${AUTOR.formacao}. Veja quem faz, como funciona e como falar com ele.`,
    h1: 'Sobre o Carteira Ideal',
    lead: `O Carteira Ideal é um projeto gratuito de educação financeira, criado e mantido por ${AUTOR.nome}.`,
    botoes: [{ texto: 'Fazer o teste de perfil', href: '/app/' }],
    migalhas: [],
    schema: 'AboutPage',
    semByline: true,
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'Quem faz',
        `<p>${esc(AUTOR.nome)} é formado em ${esc(AUTOR.formacao)}. Cria, mantém e atualiza os conteúdos e as ferramentas do app.</p>
<p>Atua e estuda o mercado financeiro desde 1998, quando ele ainda funcionava no mercado de balcão organizado e nem existia home broker. Sua monografia do curso de Administração de Empresas da UFES foi “O mercado de ações no Brasil: um estudo da análise gráfica para tomada de decisão”.</p>
<p>Não é analista ou consultor financeiro, e o aplicativo não faz recomendação de investimentos. O conteúdo é 100% educacional e gratuito.</p>`,
      ),
      secao(
        'Por que o projeto existe',
        `<p>Nascemos da necessidade de ajudar as pessoas menos familiarizadas com o mundo dos investimentos e que anseiam por aprender a investir. Temos espaços de aprendizagem e ferramentas de ajuda para quem deseja sair das dívidas. É um ambiente de ensino em constante evolução, com vídeos curtos e didáticos. Nossas ferramentas são simples, diretas e <strong>gratuitas</strong>, fáceis de entender e aplicar.</p>
<p>O teste de perfil de investidor que as corretoras aplicam mede a intenção: quanto risco você diz aceitar. A vida real também conta: a reserva que você tem, as dívidas, os gastos previstos, a estabilidade da renda. O Carteira Ideal cruza as duas coisas e mostra uma carteira de referência.</p>
<p>Junto com o teste, o projeto traz ferramentas para acompanhar a carteira que você tem (<a href="/minha-carteira/">Meus Ativos</a>) e organizar o mês (<a href="/meu-mes/">Meu Mês</a>), um caminho para <a href="/aprender/sair-das-dividas/">sair das dívidas</a> antes de investir, <a href="/aprender/">guias sobre cada classe de ativo</a>, simuladores com dados oficiais e o livro infantil <strong>Os Três Potes de Clara</strong>.</p>`,
      ),
      secao(
        'Como o projeto se mantém',
        `<p>Hoje o site é gratuito e não pede cadastro. Não há anúncios, links de afiliado nem venda de produtos. Se isso mudar, esta página será atualizada antes.</p>`,
      ),
      secao(
        'O que o Carteira Ideal não é',
        `<ul>
<li>Não é análise, consultoria nem recomendação de investimento, atividades reguladas pela CVM.</li>
<li>Não substitui o questionário de suitability que a sua corretora precisa aplicar.</li>
<li>Não conhece a sua vida por inteiro. Use o resultado para entender melhor as suas escolhas e converse com um profissional certificado antes de decidir.</li>
</ul>`,
      ),
      secao(
        'Como o conteúdo é feito e revisado',
        `<p>Os números dos simuladores vêm de fontes oficiais e de mercado, com a data de cada atualização. Os textos são revisados periodicamente e cada página mostra a data da última revisão. Veja os detalhes em <a href="/metodologia-e-fontes/">Metodologia e fontes</a>.</p>`,
      ),
      secao(
        'Fale comigo',
        `<p>Encontrou um erro, tem uma dúvida ou uma sugestão? Escreva para <a href="mailto:${esc(AUTOR.email)}">${esc(AUTOR.email)}</a>. Corrijo o que estiver errado assim que possível. Também estou no <a href="${esc(AUTOR.instagram)}" rel="noopener">Instagram</a> e no <a href="${esc(AUTOR.youtube)}" rel="noopener">YouTube</a>.</p>`,
      ),
    ].join('\n'),
    relacionados: [
      { texto: 'Metodologia e fontes de dados', href: '/metodologia-e-fontes/' },
      { texto: 'Teste de perfil de investidor', href: '/teste-perfil-de-investidor/' },
      { texto: 'Aprender', href: '/aprender/' },
    ],
  }
}

function paginaMetodologia() {
  const guias = Object.keys(GUIAS_DE_ATIVOS)
    .map((k) => `<li><a href="${caminhoGuia(k)}">${esc(GUIAS_DE_ATIVOS[k].h1)}</a></li>`)
    .join('')
  return {
    caminho: '/metodologia-e-fontes/',
    titulo: 'Metodologia e fontes de dados',
    descricao: 'Como o teste chega à carteira de referência, de onde vêm os números dos simuladores (Banco Central, Tesouro, CVM e B3) e como o conteúdo é revisado.',
    h1: 'Metodologia e fontes de dados',
    lead: 'Como o teste chega à carteira de referência, de onde vêm os números dos simuladores e como o conteúdo é revisado e corrigido.',
    botoes: [{ texto: 'Fazer o teste de perfil', href: '/app/' }],
    migalhas: [{ nome: 'Sobre', caminho: '/sobre/' }],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao(
        'Como o teste chega à carteira de referência',
        `<p>São 14 perguntas em dois blocos. O primeiro (7 perguntas) mede o perfil de investidor, como o suitability das corretoras: objetivo, prazo, tolerância a quedas, reserva, patrimônio, experiência e reação a notícias. O segundo (7 perguntas) olha a vida real: reserva de emergência, dívidas, gastos previstos, reação a quedas, necessidade de renda, estabilidade do trabalho e Imposto de Renda.</p>
<p>O cruzamento leva a um de 9 perfis de carteira. Quando a vida real e a intenção divergem, a vida real tem a palavra final: quem se declara arrojado mas tem pouca reserva ou dívida cara recebe uma carteira mais protegida. Cada perfil se traduz em percentuais para as 11 classes de ativos, ajustados ao seu prazo.</p>
<p>O cálculo roda em um servidor, que devolve só o resultado. Os detalhes do cálculo não são publicados. O resultado é uma carteira de <strong>referência</strong>, com finalidade educacional, e não uma ordem de compra.</p>`,
      ),
      secao('As 11 classes de ativos', `<p>Cada classe tem um guia com o que observar e os pontos de atenção, sem indicar produtos:</p>\n<ul>${guias}</ul>`),
      secao(
        'De onde vêm os dados dos simuladores',
        `<ul>
<li><strong>Tesouro Direto:</strong> taxas e preços do Tesouro Transparente; Selic, CDI, IPCA, dólar e Boletim Focus do Banco Central. Atualizados uma vez por semana.</li>
<li><strong>FIIs:</strong> Informe Mensal Estruturado da CVM, com cotação e volume de mercado. Atualizados uma vez por mês.</li>
<li><strong>BDRs e ETFs:</strong> Boletim de Preços oficial da B3, nos dias úteis à noite. Nome, setor e proporção dos BDRs vêm de cadastros de mercado.</li>
<li><strong>Imposto de Renda e custódia:</strong> regras vigentes na data da última revisão, que mudam com a legislação.</li>
</ul>
<p>Os simuladores <strong>descrevem</strong> dados: ordenam por vencimento ou por liquidez, agrupam por setor ou categoria e não fazem ranking, valor justo nem recomendação de compra.</p>`,
      ),
      secao(
        'Revisão e correções',
        `<p>Cada página mostra a data da última revisão. Os números da trilha "Sair das dívidas" (limites de juros, taxas de referência das dívidas, links oficiais) são conferidos a cada seis meses. Os dados dos simuladores mostram a data da última atualização, e a tela avisa quando ela está velha.</p>
<p>Encontrou um erro? Escreva para <a href="mailto:${esc(AUTOR.email)}">${esc(AUTOR.email)}</a> e o conteúdo é corrigido assim que possível.</p>`,
      ),
      secao(
        'Limitações',
        `<ul>
<li>As estimativas dependem de dados públicos, que podem ter defasagem ou erro na fonte.</li>
<li>Rentabilidade passada e simulações não garantem resultado futuro.</li>
<li>O teste não conhece todos os detalhes da sua vida e não substitui uma conversa com um profissional certificado.</li>
</ul>`,
      ),
    ].join('\n'),
    relacionados: [
      { texto: 'Sobre o Carteira Ideal', href: '/sobre/' },
      { texto: 'Teste de perfil de investidor', href: '/teste-perfil-de-investidor/' },
      { texto: 'Simulador de Tesouro Direto', href: '/simulador-tesouro-direto/' },
    ],
  }
}

// ---------------------------------------------------------------------------------------------
// Guias por classe de ativo (lidos de data/analises/*.ts, sem produtos nem percentuais)
// ---------------------------------------------------------------------------------------------

/** slug, título da página e ferramenta ligada, por classe de ativo (AtivoKey). */
export const GUIAS_DE_ATIVOS = {
  tesouroSelic: { slug: 'tesouro-selic', h1: 'Tesouro Selic: como funciona e quando usar', ferramenta: 'tesouro' },
  tesouroIPCA: { slug: 'tesouro-ipca', h1: 'Tesouro IPCA+: como funciona e como escolher o vencimento', ferramenta: 'tesouro' },
  tesouroPrefixado: { slug: 'tesouro-prefixado', h1: 'Tesouro Prefixado: como funciona e quando faz sentido', ferramenta: 'tesouro' },
  cdbLiquidez: { slug: 'cdb-liquidez-diaria', h1: 'CDB com liquidez diária: como funciona e os cuidados com o FGC', titulo: 'CDB com liquidez diária e o limite do FGC', ferramenta: null },
  lciLca: { slug: 'lci-lca', h1: 'LCI e LCA: como funcionam, isenção de IR e carência', ferramenta: null },
  fiis: { slug: 'fundos-imobiliarios-fiis', h1: 'Fundos imobiliários (FIIs): como funcionam e o que olhar', ferramenta: 'fii' },
  acoesETFs: { slug: 'acoes', h1: 'Ações: o que olhar antes de escolher', ferramenta: null },
  bdrs: { slug: 'bdrs', h1: 'BDRs: como investir em empresas estrangeiras pela B3', ferramenta: 'bdr' },
  ouro: { slug: 'ouro', h1: 'Ouro na carteira: para que serve e como acessar', ferramenta: 'etf' },
  fundosInternacionais: { slug: 'fundos-internacionais-etfs', h1: 'ETFs e fundos internacionais: diversificar fora do Brasil', ferramenta: 'etf' },
  cripto: { slug: 'criptomoedas', h1: 'Criptomoedas na carteira: risco e fatia pequena', ferramenta: 'etf' },
}

const FERRAMENTAS = {
  tesouro: { texto: 'Simular o Tesouro Direto', link: 'Simulador de Tesouro Direto', pagina: '/simulador-tesouro-direto/' },
  fii: { texto: 'Simular FIIs', link: 'Simulador de FII', pagina: '/simulador-fii/' },
  bdr: { texto: 'Simular BDRs', link: 'Simulador de BDR', pagina: '/simulador-bdr/' },
  etf: { texto: 'Ver os ETFs mais negociados', link: 'Simulador de ETF', pagina: '/simulador-etf/' },
}

const caminhoGuia = (chave) => `/aprender/ativos/${GUIAS_DE_ATIVOS[chave].slug}/`

export function paginaAtivo(chave, analise, ativoInfo) {
  const g = GUIAS_DE_ATIVOS[chave]
  const contexto = limparTexto(analise.contexto)
  const criterios = criteriosPublicos(analise.criterios ?? [])
  const atencao = limparTexto(analise.atencao ?? '')
  const ferramenta = g.ferramenta ? FERRAMENTAS[g.ferramenta] : null
  const rotulo = ativoInfo?.label ?? g.h1

  const corpo = [
    contexto ? `<p>${esc(contexto)}</p>` : '',
    criterios.length ? secao('O que observar', `<ul>${criterios.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`) : '',
    atencao ? secao('Pontos de atenção', `<p>${esc(atencao)}</p>`) : '',
    secao(
      'Como isso entra na sua carteira',
      `<p>${esc(rotulo)} é uma das 11 classes de ativos da carteira de referência do Carteira Ideal. O percentual de cada classe depende do seu perfil, da sua reserva, das suas dívidas e do seu prazo. Descubra o seu em 14 perguntas.</p>
<p>Este guia é educacional e não cita produtos específicos: os exemplos ilustrativos ficam no app, com o aviso de que não são recomendação de compra.</p>`,
    ),
  ]
    .filter(Boolean)
    .join('\n')

  // Os 4 guias seguintes na lista (em círculo), para os links internos variarem de página para página.
  const chaves = Object.keys(GUIAS_DE_ATIVOS)
  const pos = chaves.indexOf(chave)
  const outros = [1, 2, 3, 4].map((d) => {
    const k = chaves[(pos + d) % chaves.length]
    return { texto: GUIAS_DE_ATIVOS[k].h1, href: caminhoGuia(k) }
  })

  return {
    caminho: caminhoGuia(chave),
    titulo: g.titulo ?? g.h1,
    descricao: resumir(contexto || ativoInfo?.descricao || g.h1),
    h1: g.h1,
    lead: ativoInfo?.descricao ? limparTexto(ativoInfo.descricao) : '',
    botoes: [
      { texto: 'Descobrir meu perfil', href: '/app/' },
      ...(ferramenta ? [{ texto: ferramenta.texto, href: ferramenta.pagina, tipo: 'site' }] : []),
    ],
    migalhas: [
      { nome: 'Aprender', caminho: '/aprender/' },
    ],
    schema: 'Article',
    lastmod: REVISADO_EM,
    corpo,
    relacionados: [...(ferramenta ? [{ texto: ferramenta.link, href: ferramenta.pagina }] : []), ...outros],
  }
}

// ---------------------------------------------------------------------------------------------
// Trilha "Sair das dívidas" (lida de data/trilhas.ts)
// ---------------------------------------------------------------------------------------------

const CAMINHO_DIVIDAS = '/aprender/sair-das-dividas/'
const caminhoAula = (aulaId) => `${CAMINHO_DIVIDAS}${aulaId}/`

export function paginasTrilhaDividas(trilha) {
  const aulas = trilha.topicos.flatMap((t) => t.aulas.filter((a) => a.texto?.length).map((a) => ({ ...a, topico: t.titulo })))

  const hub = {
    caminho: CAMINHO_DIVIDAS,
    titulo: 'Como sair das dívidas: guia em 9 aulas curtas',
    descricao: resumir(trilha.descricao),
    h1: 'Como sair das dívidas: guia em 9 aulas curtas',
    lead: trilha.descricao,
    botoes: [{ texto: 'Abrir o Meu Mês', href: '/app/?tela=meuMes' }],
    migalhas: [{ nome: 'Aprender', caminho: '/aprender/' }],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: trilha.topicos
      .map((t) => {
        const itens = t.aulas.filter((a) => a.texto?.length)
        if (!itens.length) return ''
        return secao(
          t.titulo,
          `<ul class="lista-aulas">${itens.map((a) => `<li><a href="${caminhoAula(a.id)}">${esc(a.titulo)}</a><span> — ${esc(a.resumo)}</span></li>`).join('')}</ul>`,
        )
      })
      .join('\n'),
    relacionados: [
      { texto: 'Meu Mês: controle das contas e planejamento', href: '/meu-mes/' },
      { texto: 'Teste de perfil de investidor', href: '/teste-perfil-de-investidor/' },
    ],
  }

  const paginas = aulas.map((a, i) => {
    const anterior = aulas[i - 1]
    const proxima = aulas[i + 1]
    const links = a.links?.length
      ? secao('Fontes oficiais', `<ul>${a.links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.rotulo)}</a></li>`).join('')}</ul>`)
      : ''
    const botao =
      a.acao === 'meuMes'
        ? [{ texto: 'Abrir o Meu Mês', href: '/app/?tela=meuMes' }]
        : a.acao === 'questionario'
          ? [{ texto: 'Descobrir meu perfil', href: '/app/' }]
          : []
    return {
      caminho: caminhoAula(a.id),
      titulo: `${a.titulo} | Sair das dívidas`,
      descricao: resumir(`${a.resumo} ${semMetodologia(a.texto[0])}`),
      h1: a.titulo,
      lead: a.resumo,
      botoes: botao,
      migalhas: [
        { nome: 'Aprender', caminho: '/aprender/' },
        { nome: 'Sair das dívidas', caminho: CAMINHO_DIVIDAS },
      ],
      schema: 'Article',
      lastmod: REVISADO_EM,
      corpo: `<p class="eyebrow">${esc(a.topico)} · Aula ${i + 1} de ${aulas.length}</p>\n${paragrafos(a.texto.map(semMetodologia).filter(Boolean))}\n${links}`,
      relacionados: [
        ...(proxima ? [{ texto: `Próxima aula: ${proxima.titulo}`, href: caminhoAula(proxima.id) }] : []),
        ...(anterior ? [{ texto: `Aula anterior: ${anterior.titulo}`, href: caminhoAula(anterior.id) }] : []),
        { texto: 'Todas as aulas de Sair das dívidas', href: CAMINHO_DIVIDAS },
      ],
    }
  })

  return { hub, paginas }
}

// ---------------------------------------------------------------------------------------------
// Hub "Aprender"
// ---------------------------------------------------------------------------------------------

function paginaAprender(dividasDisponivel) {
  const itens = Object.keys(GUIAS_DE_ATIVOS)
    .map((k) => `<li><a href="${caminhoGuia(k)}">${esc(GUIAS_DE_ATIVOS[k].h1)}</a></li>`)
    .join('')
  return {
    caminho: '/aprender/',
    titulo: 'Aprender a investir: guias e aulas grátis',
    descricao: 'Guias sobre cada classe de ativo (Tesouro, CDB, FII, ações, BDR, ouro, ETF, cripto) e um guia para sair das dívidas. Conteúdo educacional e gratuito.',
    h1: 'Aprender a investir, do zero',
    lead: 'Guias curtos sobre cada classe de ativo da carteira de referência e um passo a passo para sair das dívidas antes de investir.',
    botoes: [{ texto: 'Ver as aulas em vídeo no app', href: '/app/?tela=aprender' }],
    migalhas: [],
    schema: 'WebPage',
    lastmod: REVISADO_EM,
    corpo: [
      secao('Antes de investir', `<p>Reserva de emergência e dívida cara vêm antes de qualquer investimento de risco. ${dividasDisponivel ? `Comece pelo <a href="${CAMINHO_DIVIDAS}">guia para sair das dívidas</a> e pelo <a href="/meu-mes/">Meu Mês</a>.` : `Comece pelo <a href="/meu-mes/">Meu Mês</a>.`}</p>`),
      secao('Guias sobre os investimentos', `<ul class="lista-aulas">${itens}</ul>`),
      secao(
        'Ferramentas',
        `<ul class="lista-aulas">
<li><a href="/teste-perfil-de-investidor/">Teste de perfil de investidor</a></li>
<li><a href="/simulador-tesouro-direto/">Simulador de Tesouro Direto</a></li>
<li><a href="/simulador-fii/">Simulador de FII</a></li>
<li><a href="/simulador-bdr/">Simulador de BDR</a></li>
<li><a href="/simulador-etf/">Simulador de ETF</a></li>
</ul>`,
      ),
      secao('Livro infantil grátis', `<p>O livro <strong>Os Três Potes de Clara</strong>, de educação financeira infantil, está disponível de graça na tela Aprender do app.</p>`),
    ].join('\n'),
    relacionados: [],
  }
}

// ---------------------------------------------------------------------------------------------
// Taxas do Tesouro Direto hoje (lidas de mercadoOficial.json, só se houver dados)
// ---------------------------------------------------------------------------------------------

export function paginaTaxas(snapshot, m) {
  if (!m.temTesouro(snapshot)) return null
  const dataBase = snapshot.tesouro.dataBase
  const aVenda = snapshot.tesouro.titulos.filter((t) => t.aVenda)
  const ordem = ['Tesouro Selic', 'Tesouro Prefixado', 'Tesouro IPCA+']
  const familias = [...new Set(aVenda.map((t) => t.familia))].sort((a, b) => {
    const ia = ordem.indexOf(a)
    const ib = ordem.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
  })

  const tabelas = familias
    .map((familia) => {
      const linhas = aVenda
        .filter((t) => t.familia === familia)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.cupom.localeCompare(b.cupom))
      const indexador = linhas[0]?.indexador
      const leitura = m.LEITURA_DA_TAXA[indexador] ? `<p>${esc(m.LEITURA_DA_TAXA[indexador])}</p>` : ''
      return secao(
        familia,
        `${leitura}<div class="tabela-scroll"><table>
<thead><tr><th scope="col">Título</th><th scope="col">Vencimento</th><th scope="col">Taxa de compra</th><th scope="col">Preço unitário</th></tr></thead>
<tbody>${linhas
          .map(
            (t) =>
              `<tr><th scope="row">${esc(t.nome)}</th><td>${dataBr(t.vencimento)}</td><td>${esc(m.formatarTaxa(t))}</td><td>${t.puCompra != null ? esc(m.reais(t.puCompra)) : '—'}</td></tr>`,
          )
          .join('')}</tbody>
</table></div>`,
      )
    })
    .join('\n')

  const ind = snapshot.indicadores ?? {}
  const linhasInd = [
    ind.selicMeta && `<li><strong>Selic meta:</strong> ${esc(m.porcentagem(ind.selicMeta.valor))} ao ano (${dataBr(ind.selicMeta.data)})</li>`,
    ind.ipca12m && `<li><strong>IPCA em 12 meses:</strong> ${esc(m.porcentagem(ind.ipca12m.valor))}</li>`,
    snapshot.derivados?.jurosReaisExPost?.valor != null &&
      `<li><strong>Juro real (Selic sobre o IPCA de 12 meses):</strong> ${esc(m.porcentagem(snapshot.derivados.jurosReaisExPost.valor))} ao ano</li>`,
  ].filter(Boolean)

  return {
    caminho: '/taxas-tesouro-direto-hoje/',
    titulo: `Taxas do Tesouro Direto hoje (${dataBr(dataBase)})`,
    descricao: `Taxas e preços de todos os títulos do Tesouro Direto à venda em ${dataBr(dataBase)}: Selic, Prefixado e IPCA+, com a Selic e o IPCA do dia. Atualizado toda semana.`,
    h1: 'Taxas do Tesouro Direto hoje',
    lead: `Títulos à venda com data-base de ${dataBr(dataBase)}, em ordem de vencimento. A tabela é atualizada uma vez por semana a partir dos dados oficiais do Tesouro Transparente e do Banco Central.`,
    botoes: [{ texto: 'Simular um título', href: '/app/?tela=simuleTesouro' }],
    migalhas: [{ nome: 'Simulador de Tesouro Direto', caminho: '/simulador-tesouro-direto/' }],
    schema: 'WebPage',
    lastmod: dataBase,
    rotuloData: 'Dados de',
    corpo: [
      linhasInd.length ? secao('Indicadores', `<ul>${linhasInd.join('')}</ul>`) : '',
      tabelas,
      secao(
        'Como usar estes números',
        `<p>As taxas mudam ao longo do dia e a tabela é da data-base indicada, então o valor exato na hora da compra pode ser diferente. Confira sempre no Tesouro Direto ou na sua corretora. Esta página mostra os títulos por vencimento e não indica qual comprar.</p>`,
      ),
    ].join('\n'),
    relacionados: [
      { texto: 'Simulador de Tesouro Direto', href: '/simulador-tesouro-direto/' },
      { texto: 'Tesouro Selic: como funciona e quando usar', href: '/aprender/ativos/tesouro-selic/' },
    ],
  }
}

// ---------------------------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------------------------

/**
 * Gera todas as páginas. `snapshot` é opcional (os testes passam um de mentira).
 * @returns {Promise<{caminho: string, html: string, lastmod: string}[]>}
 */
export async function gerarPaginas({ raiz, snapshot } = {}) {
  const src = path.join(raiz, 'webapp-src', 'src')
  const { modulos, limpar } = await carregarTs(src, [
    'data/trilhas.ts',
    'data/analises/index.ts',
    'data/assets.ts',
    'domain/mercadoOficial.ts',
  ])
  try {
    const { TRILHAS } = modulos['data/trilhas.ts']
    const { ANALISES } = modulos['data/analises/index.ts']
    const { ATIVOS } = modulos['data/assets.ts']
    const m = modulos['domain/mercadoOficial.ts']

    const dados =
      snapshot ?? JSON.parse(await readFile(path.join(src, 'data', 'mercadoOficial.json'), 'utf8'))

    const trilha = TRILHAS.find((t) => t.id === 'sair-das-dividas')
    const dividas = trilha ? paginasTrilhaDividas(trilha) : null
    const taxas = paginaTaxas(dados, m)

    const paginas = [
      paginaPerfil(),
      paginaTesouro(Boolean(taxas)),
      paginaFii(),
      paginaBdr(),
      paginaEtf(),
      paginaMinhaCarteira(),
      paginaMeuMes(dividas ? CAMINHO_DIVIDAS : '/aprender/'),
      paginaAprender(Boolean(dividas)),
      paginaSobre(),
      paginaMetodologia(),
      ...Object.keys(GUIAS_DE_ATIVOS).map((k) => paginaAtivo(k, ANALISES[k], ATIVOS[k])),
      ...(dividas ? [dividas.hub, ...dividas.paginas] : []),
      ...(taxas ? [taxas] : []),
    ]
    return paginas.map((p) => ({ caminho: p.caminho, html: montarPagina(p), lastmod: p.lastmod, pagina: p }))
  } finally {
    await limpar()
  }
}
