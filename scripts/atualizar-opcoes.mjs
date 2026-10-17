// Atualização diária dos dados do Simule Opções.
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-opcoes.yml), ou à mão:
//   node scripts/atualizar-opcoes.mjs
//
// Duas fontes oficiais da B3, sem cota e sem secret:
//   1. Cadastro de instrumentos (InstrumentsConsolidatedFile, CSV de ~22 MB), por
//      https://arquivos.b3.com.br/api/download/requestname?fileName=InstrumentsConsolidatedFile&date=AAAA-MM-DD
//      (devolve um token) e depois https://arquivos.b3.com.br/api/download/?token=... Conferido em 16/10/2026:
//      79.545 opções de ações e ETFs em 239 ativos. Dá, de cada série: ativo-objeto (Asst), tipo (OptnTp), estilo
//      (OptnStyle, AMER ou EURO), strike (ExrcPric, com vírgula), vencimento (XprtnDt) e lote (AllcnRndLot).
//   2. COTAHIST diário (série histórica, zip de ~650 KB por pregão):
//      https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_DDDMMAAAA.ZIP
//      Largura fixa, 245 caracteres por linha. Posições (base 1): TIPREG 1-2 (só "01"), DATA 3-10, CODBDI 11-12
//      (02 lote padrão, 14 ETF, 78 call, 82 put), CODNEG 13-24, TPMERC 25-27 (010 vista), NOMRES 28-39,
//      PREULT 109-121, TOTNEG 148-152, VOLTOT 171-188. Preços em centavos.
//
// O cadastro diz quais séries existem; o COTAHIST diz quanto custaram. Para cobrir séries pouco líquidas, o job lê os
// últimos 5 pregões e, de cada série, guarda o último preço, a data desse negócio e a variação contra o fechamento
// anterior dentro da janela. Só entram séries que negociaram em algum desses pregões.
//
// A tela é descritiva (sem ranking de "melhor opção"): os ativos aparecem por volume de opções do último pregão.
//
// Regras de segurança: poucos ativos, ativos de controle sem dado ou série inválida = termina com erro SEM gravar
// nada. Pregão já processado = nada muda, sem commit.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { datasCandidatas } from './b3-boletim.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'public', 'dados', 'opcoes.json')

export const URL_COTAHIST = (data) => {
  const [a, m, d] = data.split('-')
  return `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${d}${m}${a}.ZIP`
}
export const URL_PEDIDO_CADASTRO = (data) =>
  `https://arquivos.b3.com.br/api/download/requestname?fileName=InstrumentsConsolidatedFile&date=${data}&recaptchaToken=`
export const URL_CADASTRO = (token) => `https://arquivos.b3.com.br/api/download/?token=${token}`

export const CONFIG = {
  pregoesNaJanela: 5,
  minimoAtivosParaPublicar: 60,
  minimoSeriesParaPublicar: 5000,
  controle: ['PETR4', 'VALE3', 'BOVA11'],
  minimoControle: 2,
  tamanhoMinimoZip: 1024,
  diasProcura: 12,
}

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em atualizar-opcoes.test.mjs)
// ---------------------------------------------------------------------------------------

const centavos = (texto) => {
  const n = Number(texto)
  return Number.isFinite(n) ? n / 100 : null
}

const dataIso = (aaaammdd) => {
  const t = String(aaaammdd).trim()
  if (!/^\d{8}$/.test(t) || t.startsWith('9999')) return null
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
}

/** "4,37" -> 4.37; vazio ou inválido -> null. */
export const numeroBr = (texto) => {
  const t = String(texto ?? '').trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Lê o cadastro (CSV com ";"). Devolve um Map código -> série, só com opções de ações e ETFs que ainda não venceram na
 * data de referência. Procura as colunas pelo nome do cabeçalho, para não quebrar se a B3 reordenar.
 */
export function lerCadastro(texto, dataReferencia) {
  const linhas = texto.split(/\r?\n/)
  const iCab = linhas.findIndex((l) => l.startsWith('RptDt;'))
  if (iCab === -1) throw new Error('Cadastro sem cabeçalho (RptDt).')
  const cab = linhas[iCab].split(';')
  const col = Object.fromEntries(cab.map((nome, i) => [nome, i]))
  for (const nome of ['TckrSymb', 'Asst', 'SctyCtgyNm', 'XprtnDt', 'OptnTp', 'ExrcPric', 'OptnStyle', 'AllcnRndLot']) {
    if (!(nome in col)) throw new Error(`Cadastro sem a coluna ${nome}.`)
  }
  const series = new Map()
  for (let i = iCab + 1; i < linhas.length; i++) {
    const c = linhas[i].split(';')
    if (c[col.SctyCtgyNm] !== 'OPTION ON EQUITIES') continue
    const tipo = c[col.OptnTp] === 'Call' ? 'call' : c[col.OptnTp] === 'Put' ? 'put' : null
    const estilo = c[col.OptnStyle] === 'AMER' ? 'americana' : c[col.OptnStyle] === 'EURO' ? 'europeia' : null
    const strike = numeroBr(c[col.ExrcPric])
    const vencimento = c[col.XprtnDt]
    if (!tipo || !estilo || !strike || strike <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) continue
    if (vencimento <= dataReferencia) continue
    series.set(c[col.TckrSymb].toUpperCase(), {
      codigo: c[col.TckrSymb].toUpperCase(),
      ativo: c[col.Asst].toUpperCase(),
      tipo,
      estilo,
      strike,
      vencimento,
      lote: Number(c[col.AllcnRndLot]) || 100,
    })
  }
  return series
}

/**
 * Lê uma linha do COTAHIST. Devolve { tipo: 'vista' | 'opcao', ... } ou null para o que não interessa (cabeçalho,
 * rodapé, fracionário, termo, futuro etc.).
 */
export function lerLinha(linha) {
  if (linha.length < 188 || linha.slice(0, 2) !== '01') return null
  const mercado = linha.slice(24, 27)
  const bdi = linha.slice(10, 12)
  const base = {
    data: dataIso(linha.slice(2, 10)),
    codigo: linha.slice(12, 24).trim().toUpperCase(),
    nome: linha.slice(27, 39).trim(),
    ultimo: centavos(linha.slice(108, 121)),
    negocios: Number(linha.slice(147, 152)) || 0,
    volume: centavos(linha.slice(170, 188)) ?? 0,
  }
  if (mercado === '010' && (bdi === '02' || bdi === '14')) return { tipo: 'vista', ...base }
  if ((mercado === '070' && bdi === '78') || (mercado === '080' && bdi === '82')) return { tipo: 'opcao', ...base }
  return null
}

/** Um pregão do COTAHIST: papéis à vista por código e opções por código. */
export function lerPregao(texto) {
  const vista = new Map()
  const opcoes = new Map()
  let data = null
  for (const linha of texto.split(/\r?\n/)) {
    const item = lerLinha(linha)
    if (!item) continue
    data ??= item.data
    if (!item.ultimo || item.ultimo <= 0) continue
    if (item.tipo === 'vista') vista.set(item.codigo, item)
    else opcoes.set(item.codigo, item)
  }
  return { data, vista, opcoes }
}

const arredondar = (v, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas

/**
 * Monta o snapshot. `pregoes` vem do mais recente para o mais antigo. Cada série traz o último preço dentro da janela,
 * a data desse negócio e a variação contra o fechamento anterior (null se a série não negociou antes, na janela).
 *
 * Formato compacto (tuplas), para o arquivo ficar pequeno:
 *   [código, 'C'|'P', 'A'|'E', strike, vencimento, último, data do último, variação %|null, negócios, volume R$]
 */
export function montarSnapshot(cadastro, pregoes, agora = new Date()) {
  const novo = pregoes[0]
  const porAtivo = new Map()
  for (const serie of cadastro.values()) {
    const dias = pregoes.filter((p) => p.opcoes.has(serie.codigo))
    if (dias.length === 0) continue
    const [ultimoDia, anteriorDia] = dias
    const negocio = ultimoDia.opcoes.get(serie.codigo)
    const anterior = anteriorDia?.opcoes.get(serie.codigo)
    if (!porAtivo.has(serie.ativo)) porAtivo.set(serie.ativo, [])
    porAtivo.get(serie.ativo).push({
      serie,
      negocio,
      data: ultimoDia.data,
      variacao: anterior ? arredondar((negocio.ultimo / anterior.ultimo - 1) * 100) : null,
      noNovo: ultimoDia === novo,
    })
  }
  const ativos = []
  for (const [ticker, lista] of porAtivo) {
    const papel = pregoes.map((p) => p.vista.get(ticker)).find(Boolean)
    if (!papel) continue
    lista.sort(
      (a, b) =>
        a.serie.vencimento.localeCompare(b.serie.vencimento) ||
        a.serie.strike - b.serie.strike ||
        a.serie.tipo.localeCompare(b.serie.tipo) ||
        a.serie.codigo.localeCompare(b.serie.codigo),
    )
    ativos.push({
      ticker,
      nome: papel.nome,
      cotacao: arredondar(papel.ultimo),
      volumeOpcoes: Math.round(lista.filter((x) => x.noNovo).reduce((s, x) => s + x.negocio.volume, 0)),
      lote: lista[0].serie.lote,
      series: lista.map((x) => [
        x.serie.codigo,
        x.serie.tipo === 'call' ? 'C' : 'P',
        x.serie.estilo === 'americana' ? 'A' : 'E',
        arredondar(x.serie.strike),
        x.serie.vencimento,
        arredondar(x.negocio.ultimo),
        x.data,
        x.variacao,
        x.negocio.negocios,
        Math.round(x.negocio.volume),
      ]),
    })
  }
  ativos.sort((a, b) => b.volumeOpcoes - a.volumeOpcoes || a.ticker.localeCompare(b.ticker))
  return {
    geradoEm: agora.toISOString(),
    dataPregao: novo.data,
    fonte: 'Cadastro de instrumentos e COTAHIST da B3',
    pregoesNaJanela: pregoes.length,
    ativos,
  }
}

/** Motivo para NÃO publicar, ou null se o snapshot está bom. */
export function motivoInvalido(snapshot, config = CONFIG) {
  if (!snapshot.dataPregao) return 'O arquivo não trouxe data de pregão.'
  if (snapshot.ativos.length < config.minimoAtivosParaPublicar) {
    return `Só ${snapshot.ativos.length} ativos com opções (mínimo ${config.minimoAtivosParaPublicar}).`
  }
  const total = snapshot.ativos.reduce((s, a) => s + a.series.length, 0)
  if (total < config.minimoSeriesParaPublicar) return `Só ${total} séries (mínimo ${config.minimoSeriesParaPublicar}).`
  const presentes = config.controle.filter((t) => snapshot.ativos.some((a) => a.ticker === t))
  if (presentes.length < config.minimoControle) {
    return `Só ${presentes.length} dos ativos de controle (${config.controle.join(', ')}) apareceram (mínimo ${config.minimoControle}).`
  }
  for (const a of snapshot.ativos) {
    for (const [codigo, , , strike, , ultimo] of a.series) {
      if (!(ultimo > 0) || !(strike > 0)) return `Série inválida: ${codigo}.`
    }
  }
  return null
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

async function baixarCotahist(data, pasta, fetchImpl = fetch) {
  const resposta = await fetchImpl(URL_COTAHIST(data), {
    headers: { 'User-Agent': 'carteira-ideal (github actions)' },
    signal: AbortSignal.timeout(120_000),
  })
  if (!resposta.ok) return null // dia sem arquivo
  const conteudo = Buffer.from(await resposta.arrayBuffer())
  if (conteudo.length < CONFIG.tamanhoMinimoZip) return null
  const pastaDia = path.join(pasta, data)
  fs.mkdirSync(pastaDia, { recursive: true })
  const zip = path.join(pastaDia, 'c.zip')
  fs.writeFileSync(zip, conteudo)
  execFileSync('unzip', ['-o', '-q', zip, '-d', pastaDia])
  const txt = fs.readdirSync(pastaDia).find((n) => /^COTAHIST_D.*\.TXT$/i.test(n))
  return txt ? fs.readFileSync(path.join(pastaDia, txt), 'latin1') : null
}

async function baixarCadastro(data, fetchImpl = fetch) {
  const opcoes = { headers: { 'User-Agent': 'carteira-ideal (github actions)' }, signal: AbortSignal.timeout(180_000) }
  const pedido = await fetchImpl(URL_PEDIDO_CADASTRO(data), opcoes)
  if (!pedido.ok) throw new Error(`B3 respondeu ${pedido.status} ao pedir o cadastro de ${data}.`)
  const { token } = await pedido.json()
  if (!token) throw new Error('A B3 não devolveu o token do cadastro.')
  const arquivo = await fetchImpl(URL_CADASTRO(token), opcoes)
  if (!arquivo.ok) throw new Error(`B3 respondeu ${arquivo.status} ao baixar o cadastro de ${data}.`)
  return Buffer.from(await arquivo.arrayBuffer()).toString('latin1')
}

export async function principal() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'opcoes-'))
  try {
    const pregoes = []
    for (const data of datasCandidatas(new Date(), CONFIG.diasProcura, '20:00')) {
      if (pregoes.length >= CONFIG.pregoesNaJanela) break
      const texto = await baixarCotahist(data, pasta)
      if (!texto) {
        console.warn(`[aviso] sem COTAHIST para ${data} (feriado ou ainda não publicado).`)
        continue
      }
      pregoes.push(lerPregao(texto))
    }
    if (pregoes.length === 0) throw new Error('Nenhum COTAHIST encontrado nos últimos dias. Arquivo NÃO atualizado.')

    let atual = null
    try { atual = JSON.parse(fs.readFileSync(ARQUIVO_SAIDA, 'utf8')) } catch { /* primeira execução */ }
    // FORCAR=1 (opção do workflow manual) refaz o dia mesmo já processado: serve para conferir o download do cadastro.
    if (atual?.dataPregao === pregoes[0].data && process.env.FORCAR !== '1') {
      console.log(`Pregão ${pregoes[0].data} já processado. Nada a fazer.`)
      return
    }

    const cadastro = lerCadastro(await baixarCadastro(pregoes[0].data), pregoes[0].data)
    const snapshot = montarSnapshot(cadastro, pregoes)
    const motivo = motivoInvalido(snapshot)
    if (motivo) throw new Error(`${motivo} Arquivo NÃO atualizado.`)

    fs.mkdirSync(path.dirname(ARQUIVO_SAIDA), { recursive: true })
    fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(snapshot) + '\n')
    const series = snapshot.ativos.reduce((s, a) => s + a.series.length, 0)
    console.log(`Pregão ${snapshot.dataPregao}: ${snapshot.ativos.length} ativos, ${series} séries de opções (${pregoes.length} pregões na janela).`)
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro) => {
    console.error(`ERRO: ${erro.message}`)
    process.exit(1)
  })
}
