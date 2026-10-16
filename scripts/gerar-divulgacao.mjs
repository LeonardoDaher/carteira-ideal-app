// Divulgação mensal dos Top 15 (D91): gera o TEXTO pronto das publicações do Instagram a partir dos arquivos PÚBLICOS do app
// (webapp-src/src/data). Não posta nada: o responsável lê e publica. Sem rede.
//
// Regras que o código garante (e os testes travam):
//   - só entram rankings com `publicado: true`;
//   - rankings COM CÓDIGO (ações baratas, FIIs baratos, BDRs com desconto) nunca têm ativo no texto: se o arquivo público
//     trouxer lista (não deveria), o script para com erro;
//   - toda publicação carrega o aviso de que não é recomendação de investimento;
//   - cada lista tem exatamente 15 ativos, sem repetição.
//
// Uso: node scripts/gerar-divulgacao.mjs [AAAA-MM]   (o mês padrão é o da data do ranking mais recente)
// Saída: divulgacao/AAAA-MM/post-1-mais-negociados.md, post-2-indices.md, post-3-listas-com-codigo.md

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const DADOS = path.join(RAIZ, 'webapp-src', 'src', 'data')

export const TAMANHO = 15

export const AVISO_CURTO =
  'Não é recomendação de investimento. Rentabilidade passada não garante rentabilidade futura e investimentos podem causar perda de parte ou de todo o dinheiro aplicado.'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const ARQUIVOS = {
  acoes: 'acoesMaisNegociadas.json',
  fiis: 'fiisMaisNegociados.json',
  etfs: 'etfsMaisNegociados.json',
  bdrs: 'bdrsMaisNegociados.json',
  ibov: 'ibovMaioresPesos.json',
  ifix: 'ifixMaioresPesos.json',
  acoesBaratas: 'acoesBaratas.json',
  fiisBaratos: 'fiiBaratos.json',
  bdrsDesconto: 'bdrsDesconto.json',
}

const RESTRITOS = ['acoesBaratas', 'fiisBaratos', 'bdrsDesconto']

export function lerDados(pasta = DADOS) {
  const dados = {}
  for (const [chave, arquivo] of Object.entries(ARQUIVOS)) {
    dados[chave] = JSON.parse(fs.readFileSync(path.join(pasta, arquivo), 'utf8'))
  }
  return dados
}

/** "2026-10-15" -> "15/10". */
export function diaMes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) throw new Error(`Data inválida: ${iso}`)
  return `${m[3]}/${m[2]}`
}

export function nomeDoMes(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`Mês inválido: ${mes}`)
  return `${MESES[Number(m[2]) - 1]}/${m[1]}`
}

export function pct(n) {
  return `${n.toFixed(1).replace('.', ',')}%`
}

function exigirPublicado(arq, rotulo) {
  if (!arq || arq.publicado !== true) throw new Error(`${rotulo}: ranking não publicado; não há o que divulgar.`)
}

function listaNegociados(arq, rotulo) {
  exigirPublicado(arq, rotulo)
  const l = arq.geral
  if (!Array.isArray(l) || l.length !== TAMANHO) throw new Error(`${rotulo}: a lista deve ter ${TAMANHO} ativos (tem ${l?.length ?? 0}).`)
  semRepeticao(l.map((x) => x.ticker), rotulo)
  return { itens: l.map((x) => x.ticker), pregao: arq.ultimoPregao }
}

function listaIndice(arq, rotulo) {
  exigirPublicado(arq, rotulo)
  const l = arq.ranking
  if (!Array.isArray(l) || l.length !== TAMANHO) throw new Error(`${rotulo}: a lista deve ter ${TAMANHO} ativos (tem ${l?.length ?? 0}).`)
  semRepeticao(l.map((x) => x.ticker), rotulo)
  return { itens: l.map((x) => ({ ticker: x.ticker, peso: x.peso })), data: arq.dataComposicao, soma: arq.somaPesosDaLista }
}

function semRepeticao(tickers, rotulo) {
  if (new Set(tickers).size !== tickers.length) throw new Error(`${rotulo}: ativo repetido na lista.`)
}

const numerada = (tickers) => tickers.map((t, i) => `${i + 1} ${t}`).join(', ')

/** Rankings com código: o arquivo público é só cabeçalho. Se trouxer lista, é erro (vazaria o que o código protege). */
function exigirRestritoSemLista(arq, rotulo) {
  exigirPublicado(arq, rotulo)
  if (arq.acessoRestrito !== true) throw new Error(`${rotulo}: esperado ranking com código (acessoRestrito: true).`)
  for (const campo of ['ranking', 'tijolo', 'papel', 'geral']) {
    if (Array.isArray(arq[campo]) && arq[campo].length > 0) {
      throw new Error(`${rotulo}: o arquivo público traz lista em "${campo}"; a divulgação não pode usar ranking com código.`)
    }
  }
}

export function gerarPosts(dados, mes) {
  const mesExtenso = nomeDoMes(mes)
  const acoes = listaNegociados(dados.acoes, 'Ações mais negociadas')
  const fiis = listaNegociados(dados.fiis, 'FIIs mais negociados')
  const etfs = listaNegociados(dados.etfs, 'ETFs mais negociados')
  const bdrs = listaNegociados(dados.bdrs, 'BDRs mais negociados')
  const ibov = listaIndice(dados.ibov, 'Ibovespa')
  const ifix = listaIndice(dados.ifix, 'IFIX')
  for (const [chave, rotulo] of [['acoesBaratas', 'Ações baratas'], ['fiisBaratos', 'FIIs baratos'], ['bdrsDesconto', 'BDRs com desconto']]) {
    exigirRestritoSemLista(dados[chave], rotulo)
  }

  const post1 = `# Post 1 (carrossel): os mais negociados, ${mesExtenso}

Slide 1: "Top 15 mais negociados, ${mesExtenso}. O que a bolsa mais negocia, sem opinião nossa."

Slide 2, ações (mediana do volume diário dos últimos 21 pregões, até ${diaMes(acoes.pregao)}):
${numerada(acoes.itens)}.

Slide 3, FIIs (até ${diaMes(fiis.pregao)}):
${numerada(fiis.itens)}.

Slide 4, ETFs (até ${diaMes(etfs.pregao)}):
${numerada(etfs.itens)}.

Slide 5, BDRs (até ${diaMes(bdrs.pregao)}):
${numerada(bdrs.itens)}.

Slide 6 (aviso): "Mais negociado é liquidez, não qualidade, preço baixo nem momento de compra. ${AVISO_CURTO}"

Legenda:
"Os 15 ativos mais negociados da bolsa em ${mesExtenso}: ações, FIIs, ETFs e BDRs. O critério é só um: a mediana do volume negociado por dia nos últimos 21 pregões. Não é indicação de compra: ativo muito negociado é fácil de comprar e vender, e só isso. Lista completa, filtros e a metodologia no app (link na bio). Calculado por fórmula, igual para todos, com trilha de auditoria. ${AVISO_CURTO}"
`

  const linhaIndice = (r) => r.itens.map((x, i) => `${i + 1} ${x.ticker} (${pct(x.peso)})`).join(', ')
  const post2 = `# Post 2 (carrossel): o que pesa nos índices, ${mesExtenso}

Slide 1: "Quem mais pesa no Ibovespa e no IFIX. Composição oficial da B3, sem nota nossa."

Slide 2, Ibovespa (composição de ${diaMes(ibov.data)}), 15 maiores pesos, ${pct(ibov.soma)} do índice:
${linhaIndice(ibov)}.

Slide 3, IFIX (composição de ${diaMes(ifix.data)}), 15 maiores pesos, ${pct(ifix.soma)} do índice:
${linhaIndice(ifix)}.

Slide 4 (aviso): "Peso grande significa empresa ou fundo grande dentro do índice, e não qualidade nem preço baixo. Uma empresa pode aparecer com mais de um código (PETR3 e PETR4). ${AVISO_CURTO}"

Legenda:
"Os 15 maiores pesos do Ibovespa e do IFIX, direto da carteira teórica da B3. É a composição oficial, sem nota nem opinião nossa. ${AVISO_CURTO}"
`

  const post3 = `# Post 3 (um slide + legenda): as listas com código, ${mesExtenso}

Texto da arte: "Top 15 ações baratas, FIIs baratos (Tijolo e Papel) e BDRs com maior desconto de preço: atualizados todo dia útil."

Legenda:
"As listas de ações, FIIs e BDRs mais baratos pela nossa fórmula são liberadas com código. Calculadas por regra, iguais para todos, auditadas e sem opinião. Triagem objetiva, não recomendação: barato pela fórmula não quer dizer bom negócio, e desconto de BDR é de preço (inclui o dólar), não de valor. Para pedir o código: [instrução definida pelo responsável]. ${AVISO_CURTO}"

(Nenhum ativo, código de acesso nem posição aparece neste post.)
`

  const posts = [
    { arquivo: 'post-1-mais-negociados.md', texto: post1 },
    { arquivo: 'post-2-indices.md', texto: post2 },
    { arquivo: 'post-3-listas-com-codigo.md', texto: post3 },
  ]
  for (const p of posts) {
    if (!p.texto.includes('Não é recomendação de investimento')) throw new Error(`${p.arquivo}: sem o aviso de recomendação.`)
  }
  return posts
}

/** Mês (AAAA-MM) do ranking mais recente entre os usados. */
export function mesPadrao(dados) {
  const datas = [dados.acoes, dados.fiis, dados.etfs, dados.bdrs, dados.ibov, dados.ifix]
    .map((a) => a?.ultimoPregao)
    .filter(Boolean)
    .sort()
  if (!datas.length) throw new Error('Nenhum ranking com data.')
  return datas[datas.length - 1].slice(0, 7)
}

export function executar({ dados = lerDados(), mes, saida = path.join(RAIZ, 'divulgacao') } = {}) {
  const m = mes ?? mesPadrao(dados)
  const posts = gerarPosts(dados, m)
  const pasta = path.join(saida, m)
  fs.mkdirSync(pasta, { recursive: true })
  for (const p of posts) fs.writeFileSync(path.join(pasta, p.arquivo), p.texto, 'utf8')
  return { pasta, arquivos: posts.map((p) => p.arquivo) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = executar({ mes: process.argv[2] })
  console.log(`Divulgação gerada em ${path.relative(RAIZ, r.pasta)}: ${r.arquivos.join(', ')}`)
}
