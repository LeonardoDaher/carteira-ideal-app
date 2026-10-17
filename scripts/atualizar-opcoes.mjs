// Atualização diária dos dados do Simule Opções.
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-opcoes.yml), ou à mão:
//   node scripts/atualizar-opcoes.mjs
//
// Fonte: COTAHIST diário da B3 (série histórica oficial, sem cota e sem secret):
//   https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_DDDMMAAAA.ZIP
// Arquivo de texto de largura fixa, uma linha de 245 caracteres por instrumento. Conferido em
// 16/10/2026 (5,7 MB, 15.527 linhas de opção). Campos usados (posição, base 1):
//   TIPREG 1-2 (só "01"), DATA 3-10, CODBDI 11-12 (02 lote padrão, 14 ETF, 78 call, 82 put),
//   CODNEG 13-24, TPMERC 25-27 (010 vista, 070 call, 080 put), PREULT 109-121 (fechamento),
//   TOTNEG 148-152, VOLTOT 171-188, PREEXE 189-201 (strike), DATVEN 203-210, CODISI 231-242.
// Preços vêm em centavos (13 dígitos). O ativo-objeto da opção é achado pelo ISIN (CODISI),
// que a opção repete do papel: PETRJ41E e PETR3 trazem BRPETRACNOR9.
//
// O simulador é descritivo (sem ranking de "melhor opção"): a lista de ativos é por volume
// financeiro de opções negociado no pregão, e só entram séries com negócio no dia.
//
// Regras de segurança: arquivo sem opções, ativos de controle sem dado ou lista abaixo do mínimo
// = o script termina com erro SEM gravar nada. Dia sem pregão (zip vazio) = tenta o anterior.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { datasCandidatas } from './b3-boletim.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'opcoes.json')

export const URL_COTAHIST = (data) => {
  const [a, m, d] = data.split('-')
  return `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D${d}${m}${a}.ZIP`
}

export const CONFIG = {
  maxAtivos: 25,
  minimoAtivosParaPublicar: 8,
  vencimentosPorAtivo: 5,
  faixaStrikePct: 30, // só strikes entre 70% e 130% do preço do ativo
  minimoNegocios: 3,
  controle: ['PETR4', 'VALE3', 'BOVA11'],
  minimoControle: 2,
  tamanhoMinimoZip: 1024,
  diasProcura: 5,
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

/**
 * Lê uma linha do COTAHIST. Devolve { tipo: 'vista' | 'call' | 'put', ... } ou null se a linha
 * não for um papel à vista, uma call ou uma put (cabeçalho, rodapé, termo, futuro etc.).
 */
export function lerLinha(linha) {
  if (linha.length < 242 || linha.slice(0, 2) !== '01') return null
  const mercado = linha.slice(24, 27)
  const bdi = linha.slice(10, 12)
  const codigo = linha.slice(12, 24).trim().toUpperCase()
  const base = {
    data: dataIso(linha.slice(2, 10)),
    codigo,
    nome: linha.slice(27, 39).trim(),
    ultimo: centavos(linha.slice(108, 121)),
    negocios: Number(linha.slice(147, 152)) || 0,
    volume: (centavos(linha.slice(170, 188)) ?? 0),
    isin: linha.slice(230, 242).trim(),
  }
  if (mercado === '010' && (bdi === '02' || bdi === '14')) return { tipo: 'vista', ...base }
  if ((mercado === '070' && bdi === '78') || (mercado === '080' && bdi === '82')) {
    return {
      tipo: mercado === '070' ? 'call' : 'put',
      ...base,
      strike: centavos(linha.slice(188, 201)),
      vencimento: dataIso(linha.slice(202, 210)),
    }
  }
  return null
}

/** Separa as linhas do arquivo em papéis à vista (Map ISIN -> melhor papel) e opções. */
export function lerCotahist(texto) {
  const vista = new Map()
  const opcoes = []
  let dataPregao = null
  for (const linha of texto.split(/\r?\n/)) {
    const item = lerLinha(linha)
    if (!item) continue
    dataPregao ??= item.data
    if (item.tipo === 'vista') {
      if (!item.isin || !item.ultimo || item.ultimo <= 0) continue
      const atual = vista.get(item.isin)
      if (!atual || item.volume > atual.volume) vista.set(item.isin, item)
    } else {
      opcoes.push(item)
    }
  }
  return { vista, opcoes, dataPregao }
}

const arredondar = (v, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas

/**
 * Monta o snapshot publicado. Por ativo (os `maxAtivos` com mais volume de opções), guarda as
 * séries com negócio, strike dentro da faixa e nos `vencimentosPorAtivo` vencimentos mais próximos.
 */
export function montarSnapshot({ vista, opcoes, dataPregao }, config = CONFIG, agora = new Date()) {
  const porIsin = new Map()
  for (const o of opcoes) {
    if (!vista.has(o.isin)) continue
    if (!o.strike || o.strike <= 0 || !o.vencimento || !o.ultimo || o.ultimo <= 0) continue
    if (dataPregao && o.vencimento <= dataPregao) continue
    if (!porIsin.has(o.isin)) porIsin.set(o.isin, [])
    porIsin.get(o.isin).push(o)
  }
  const ativos = []
  for (const [isin, lista] of porIsin) {
    const papel = vista.get(isin)
    const volumeOpcoes = lista.reduce((s, o) => s + o.volume, 0)
    const vencimentos = [...new Set(lista.filter((o) => o.negocios >= config.minimoNegocios).map((o) => o.vencimento))]
      .sort()
      .slice(0, config.vencimentosPorAtivo)
    const minStrike = papel.ultimo * (1 - config.faixaStrikePct / 100)
    const maxStrike = papel.ultimo * (1 + config.faixaStrikePct / 100)
    const series = lista
      .filter((o) => o.negocios >= config.minimoNegocios && vencimentos.includes(o.vencimento) && o.strike >= minStrike && o.strike <= maxStrike)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.tipo.localeCompare(b.tipo) || a.strike - b.strike || a.codigo.localeCompare(b.codigo))
      .map((o) => ({
        codigo: o.codigo,
        tipo: o.tipo,
        strike: arredondar(o.strike),
        vencimento: o.vencimento,
        premio: arredondar(o.ultimo),
        negocios: o.negocios,
        volume: Math.round(o.volume),
      }))
    if (series.length === 0) continue
    ativos.push({ ticker: papel.codigo, nome: papel.nome, cotacao: arredondar(papel.ultimo), volumeOpcoes: Math.round(volumeOpcoes), series })
  }
  ativos.sort((a, b) => b.volumeOpcoes - a.volumeOpcoes)
  return {
    geradoEm: agora.toISOString(),
    dataPregao,
    fonte: 'COTAHIST diário da B3',
    criterio: { maxAtivos: config.maxAtivos, vencimentosPorAtivo: config.vencimentosPorAtivo, faixaStrikePct: config.faixaStrikePct, minimoNegocios: config.minimoNegocios },
    ativos: ativos.slice(0, config.maxAtivos),
  }
}

/** Motivo para NÃO publicar, ou null se o snapshot está bom. */
export function motivoInvalido(snapshot, config = CONFIG) {
  if (!snapshot.dataPregao) return 'O arquivo não trouxe data de pregão.'
  if (snapshot.ativos.length < config.minimoAtivosParaPublicar) {
    return `Só ${snapshot.ativos.length} ativos com opções (mínimo ${config.minimoAtivosParaPublicar}).`
  }
  const presentes = config.controle.filter((t) => snapshot.ativos.some((a) => a.ticker === t))
  if (presentes.length < config.minimoControle) {
    return `Só ${presentes.length} dos ativos de controle (${config.controle.join(', ')}) apareceram (mínimo ${config.minimoControle}).`
  }
  for (const a of snapshot.ativos) {
    for (const s of a.series) {
      if (!(s.premio > 0) || !(s.strike > 0)) return `Série inválida: ${s.codigo}.`
    }
  }
  return null
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

async function baixar(data, pasta, fetchImpl = fetch) {
  const resposta = await fetchImpl(URL_COTAHIST(data), {
    headers: { 'User-Agent': 'carteira-ideal (github actions)' },
    signal: AbortSignal.timeout(120_000),
  })
  if (!resposta.ok) return null // dia sem arquivo
  const conteudo = Buffer.from(await resposta.arrayBuffer())
  if (conteudo.length < CONFIG.tamanhoMinimoZip) return null
  const zip = path.join(pasta, `COTAHIST_${data}.zip`)
  fs.writeFileSync(zip, conteudo)
  execFileSync('unzip', ['-o', '-q', zip, '-d', pasta])
  const txt = fs.readdirSync(pasta).find((n) => /^COTAHIST_D.*\.TXT$/i.test(n))
  return txt ? path.join(pasta, txt) : null
}

export async function principal() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cotahist-'))
  try {
    let lido = null
    for (const data of datasCandidatas(new Date(), CONFIG.diasProcura, '20:00')) {
      const caminho = await baixar(data, pasta)
      if (!caminho) {
        console.warn(`[aviso] sem COTAHIST para ${data}; tentando o pregão anterior.`)
        continue
      }
      lido = lerCotahist(fs.readFileSync(caminho, 'latin1'))
      break
    }
    if (!lido) throw new Error('Nenhum COTAHIST encontrado nos últimos dias. Arquivo NÃO atualizado.')
    const snapshot = montarSnapshot(lido)
    const motivo = motivoInvalido(snapshot)
    if (motivo) throw new Error(`${motivo} Arquivo NÃO atualizado.`)
    let atual = null
    try { atual = JSON.parse(fs.readFileSync(ARQUIVO_SAIDA, 'utf8')) } catch { /* primeira execução */ }
    if (atual?.dataPregao === snapshot.dataPregao) {
      console.log(`Pregão ${snapshot.dataPregao} já processado. Nada a fazer.`)
      return
    }
    fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(snapshot) + '\n')
    const series = snapshot.ativos.reduce((s, a) => s + a.series.length, 0)
    console.log(`Pregão ${snapshot.dataPregao}: ${snapshot.ativos.length} ativos, ${series} séries de opções.`)
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
