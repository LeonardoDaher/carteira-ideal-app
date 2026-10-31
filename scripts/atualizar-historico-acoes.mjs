// Job do histórico longo das ações (D120): baixa o COTAHIST da B3 dos últimos anos e grava, para cada ação do cadastro, um arquivo
// webapp-src/public/dados/acoes-historico/<TICKER>.json com candles diários (abertura real) ajustados a desdobramentos e grupamentos.
// O app carrega só o arquivo da ação que o usuário está vendo. Detalhes e limites do ajuste em scripts/historico-cotahist.mjs.
//
// Uso: node scripts/atualizar-historico-acoes.mjs [--anos=5] [--dados-locais=<pasta>]
//   --dados-locais guarda os zips baixados (~80 MB por ano) e reaproveita nas próximas execuções, exceto o do ano corrente.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dataEmBrasilia } from './b3-boletim.mjs'
import { montarCadastro } from './atualizar-acoes.mjs'
import {
  URL_COTAHIST, agruparPorTicker, ajustarCandles, buscarEventosB3, combinarEventos, confirmarEventosB3, detectarEventos, emitenteDoTicker,
  eventosDaB3, formatarHistoricoTicker, lerZipCotahist, saltosRestantes,
} from './historico-cotahist.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const FONTE_HISTORICO = 'B3 - Séries Históricas de Cotações (COTAHIST)'
const MINIMO_PREGOES = 60
const MINIMO_ACOES_PARA_PUBLICAR = 150
// Falhar se a B3 não responder o cadastro de eventos de mais de 10% das ações: sem ele o histórico sairia sem ajuste.
const MAXIMO_SEM_EVENTOS_B3 = 0.1

async function baixarZip(ano, destino) {
  let ultimoErro = null
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resposta = await fetch(URL_COTAHIST(ano))
      if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`)
      await pipeline(Readable.fromWeb(resposta.body), fs.createWriteStream(destino))
      if (fs.statSync(destino).size < 100_000) throw new Error('arquivo pequeno demais para um COTAHIST anual')
      return
    } catch (erro) {
      ultimoErro = erro
      await new Promise((r) => setTimeout(r, 2000 * tentativa))
    }
  }
  throw new Error(`COTAHIST_A${ano}.ZIP: ${ultimoErro?.message}`)
}

export function argumento(argv, nome, padrao) {
  const achado = argv.find((a) => a.startsWith(`--${nome}=`))
  return achado ? achado.slice(nome.length + 3) : padrao
}

export async function executar({
  raiz = RAIZ_PADRAO,
  agora = new Date(),
  argv = process.argv,
  baixar = baixarZip,
  lerZip = lerZipCotahist,
  buscarB3 = buscarEventosB3,
  esperar = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = { info: console.log, warn: console.warn },
} = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'acoes.json'), 'utf8'))
  if (config.conferidoPeloResponsavel !== true) throw new Error('config/acoes.json ainda não foi conferido.')
  const cadastro = montarCadastro(config)
  const alvos = new Set(cadastro.keys())
  const anos = Number(argumento(argv, 'anos', '5'))
  if (!(anos >= 1 && anos <= 10)) throw new Error('--anos deve estar entre 1 e 10.')
  const hoje = dataEmBrasilia(agora)
  const anoAtual = Number(hoje.slice(0, 4))
  const inicio = `${anoAtual - anos}${hoje.slice(4)}`
  const pasta = argumento(argv, 'dados-locais', null) ?? fs.mkdtempSync(path.join(os.tmpdir(), 'cotahist-'))
  fs.mkdirSync(pasta, { recursive: true })

  // 1. Zips (o do ano corrente é sempre baixado de novo: a B3 o atualiza a cada pregão)
  const papeis = []
  for (let ano = Number(inicio.slice(0, 4)); ano <= anoAtual; ano++) {
    const zip = path.join(pasta, `COTAHIST_A${ano}.ZIP`)
    if (ano === anoAtual || !fs.existsSync(zip)) {
      log.info(`[info] baixando COTAHIST ${ano}...`)
      await baixar(ano, zip)
    }
    let lidos = 0
    await lerZip(zip, (p) => {
      const base = p.bdi === '96' && p.codigo.endsWith('F') ? p.codigo.slice(0, -1) : p.codigo
      if (alvos.has(base)) {
        papeis.push(p)
        lidos++
      }
    })
    log.info(`[info] ${ano}: ${lidos} linhas das ações do cadastro.`)
  }

  // 2. Candles por ação, eventos, ajuste e arquivos
  const porTicker = agruparPorTicker(papeis, alvos)
  const saida = path.join(raiz, 'webapp-src', 'public', 'dados', 'acoes-historico')
  const geradoEm = agora.toISOString()
  const escritos = []
  const resumoEventos = []
  const comSalto = []
  const divergentesB3 = []
  const naoConfirmados = []
  const novos = new Map()

  // Eventos oficiais (desdobramento, grupamento, bonificação) do cadastro de empresas listadas da B3, um pedido por emissor.
  const respostasB3 = new Map()
  for (const ticker of porTicker.keys()) {
    const emitente = emitenteDoTicker(ticker)
    if (respostasB3.has(emitente)) continue
    respostasB3.set(emitente, await buscarB3(emitente))
    await esperar(150)
  }
  const semEventosB3 = [...porTicker.keys()].filter((t) => !respostasB3.get(emitenteDoTicker(t)))
  if (semEventosB3.length > porTicker.size * MAXIMO_SEM_EVENTOS_B3) {
    throw new Error(`A B3 não devolveu os eventos de ${semEventosB3.length} de ${porTicker.size} ações (${semEventosB3.slice(0, 8).join(', ')}...). Sem eles o histórico sairia sem ajuste a desdobramentos. Nada foi gravado.`)
  }
  const dia = (d) => Date.parse(`${d}T12:00:00Z`) / 86_400_000

  for (const [ticker, candles] of porTicker) {
    const resposta = respostasB3.get(emitenteDoTicker(ticker))
    const doB3 = resposta ? eventosDaB3(resposta, candles[candles.length - 1].isin) : null
    if (doB3 === null) {
      log.warn(`[aviso] ${ticker}: sem eventos da B3; só valem os de config/acoes.json ("desdobramentos").`)
    }
    const { eventos: confirmados, divergentes } = confirmarEventosB3(candles, doB3 ?? [])
    for (const d of divergentes) divergentesB3.push(`${ticker} ${d.data}: ${d.motivo}`)
    const eventos = combinarEventos(config.desdobramentos?.[ticker], confirmados)
    // Conferência: salto de preço que parece desdobramento e a B3 não confirma (queda forte por notícia, em geral). Não ajusta nada.
    for (const d of detectarEventos(candles)) {
      if (d.data >= inicio && !eventos.some((e) => Math.abs(dia(e.data) - dia(d.data)) <= 3)) naoConfirmados.push(`${ticker} ${d.data} (fator ${d.fator})`)
    }
    const ajustados = ajustarCandles(candles, eventos).filter((c) => c.data >= inicio)
    if (ajustados.length < MINIMO_PREGOES) continue
    const uteis = eventos.filter((e) => e.data > ajustados[0].data)
    const saltos = saltosRestantes(ajustados)
    for (const e of uteis) resumoEventos.push(`${ticker} ${e.data} fator ${e.fator} (${e.origem})`)
    if (saltos.length) comSalto.push(`${ticker}: ${saltos.map((s) => `${s.data} ${s.de}->${s.para}`).join(', ')}`)
    novos.set(ticker, formatarHistoricoTicker({ ticker, fonte: FONTE_HISTORICO, geradoEm, eventos: uteis, saltos, candles: ajustados }))
    escritos.push(ticker)
  }
  if (escritos.length < MINIMO_ACOES_PARA_PUBLICAR) {
    throw new Error(`Só ${escritos.length} ações com histórico suficiente (mínimo ${MINIMO_ACOES_PARA_PUBLICAR}). Nada foi gravado.`)
  }
  fs.mkdirSync(saida, { recursive: true })
  for (const f of fs.readdirSync(saida)) if (f.endsWith('.json') && !novos.has(f.slice(0, -5)) && f !== '_indice.json') fs.rmSync(path.join(saida, f))
  for (const [ticker, texto] of novos) {
    const arquivo = path.join(saida, `${ticker}.json`)
    // Só regrava se o conteúdo mudou (ignora o carimbo de geração), para o diff do commit ficar limpo.
    const antigo = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : null
    const semCarimbo = (t) => t.replace(/"geradoEm": "[^"]*",/, '')
    if (antigo === null || semCarimbo(antigo) !== semCarimbo(texto)) fs.writeFileSync(arquivo, texto)
  }
  const ate = escritos.map((t) => JSON.parse(novos.get(t)).ate).sort().at(-1)
  const arquivoIndice = path.join(saida, '_indice.json')
  const textoIndice = `${JSON.stringify({ fonte: FONTE_HISTORICO, de: inicio, ate, tickers: escritos.sort() }, null, 1)}\n`
  if (!fs.existsSync(arquivoIndice) || fs.readFileSync(arquivoIndice, 'utf8') !== textoIndice) fs.writeFileSync(arquivoIndice, textoIndice)

  log.info(`[info] ${escritos.length} ações gravadas em ${path.relative(raiz, saida)} (até ${ate}).`)
  log.info(`[info] ${resumoEventos.length} desdobramento(s)/grupamento(s) aplicados:${resumoEventos.length ? `\n  ${resumoEventos.join('\n  ')}` : ' nenhum'}`)
  if (divergentesB3.length) log.warn(`[aviso] evento da B3 que o preço não confirma (NÃO aplicado):\n  ${divergentesB3.join('\n  ')}`)
  if (naoConfirmados.length) log.info(`[info] salto que parece desdobramento mas a B3 não lista (tratado como queda ou alta de preço, sem ajuste):\n  ${naoConfirmados.join('\n  ')}`)
  if (comSalto.length) log.warn(`[aviso] salto de preço que continua na série ajustada (possível bonificação ou evento não detectado):\n  ${comSalto.join('\n  ')}`)
  const semHistorico = [...alvos].filter((t) => !novos.has(t))
  if (semHistorico.length) log.info(`[info] sem histórico suficiente (${semHistorico.length}): ${semHistorico.join(', ')}`)
  return { escritos, resumoEventos, comSalto, divergentesB3, naoConfirmados }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
