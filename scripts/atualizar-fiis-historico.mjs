// Histórico de preço DIÁRIO dos FIIs (decisão D63).
//
//   node scripts/atualizar-fiis-historico.mjs                      baixa o boletim da B3 dos pregões que faltam
//   node scripts/atualizar-fiis-historico.mjs --carga-inicial=60   carga inicial: os 60 pregões mais recentes
//
// Fonte: Boletim de Preços oficial da B3 (BVBG.086), sem chave e sem cota (o mesmo módulo b3-boletim.mjs
// dos jobs de ações, BDRs e ETFs). O universo é a lista de fundos de webapp-src/src/data/rendimentosFii.json.
// Grava SÓ historico/fiis.json: cada fundo tem um valor por pregão, alinhado com "pregoes":
// [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Não altera nada do app.
//
// Se algo estiver errado (boletim com data inesperada, poucos fundos no boletim, B3 fora do ar), o job falha SEM
// alterar o arquivo. Feriado da B3 (zip vazio) ou pregão já processado: nada muda.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, datasCandidatas, lerBoletim } from './b3-boletim.mjs'
import { datasAProcessar, historicoVazio, incorporarPregao } from './atualizar-etfs.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'fiis-preco.json')
const ARQUIVO_FIIS = path.join(RAIZ, 'webapp-src', 'src', 'data', 'rendimentosFii.json')
const ARQUIVO_HISTORICO = path.join(RAIZ, 'historico', 'fiis.json')

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em atualizar-fiis-historico.test.mjs)
// ---------------------------------------------------------------------------------------

/** Universo: ticker → nome, dos fundos do job de FIIs mais os extras da config. */
export function universoDosFiis(snapshot, extras = []) {
  const universo = new Map()
  for (const f of snapshot?.fundos ?? []) if (f?.ticker) universo.set(String(f.ticker).toUpperCase(), f.nome ?? '')
  for (const t of extras) universo.set(String(t).toUpperCase(), universo.get(String(t).toUpperCase()) ?? '')
  return universo
}

/** Histórico em texto: um fundo por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico) {
  const linhas = Object.keys(historico.ativos)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.ativos[t])}`)
  const nomes = Object.keys(historico.nomes)
    .sort()
    .map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(historico.nomes[t])}`)
  return [
    '{',
    '  "_leia": "Histórico de preço diário dos FIIs (decisão D63), gerado por scripts/atualizar-fiis-historico.mjs a partir do Boletim de Preços da B3. Cada fundo tem um valor por pregão, alinhado com \\"pregoes\\": [fechamento, mínima, máxima, volume em reais] ou null (não negociou). Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "nomes": {\n${nomes.join(',\n')}\n  },`,
    `  "ativos": {\n${linhas.join(',\n')}\n  }`,
    '}',
    '',
  ].join('\n')
}

/**
 * Últimos `n` pregões do histórico para um fundo: { datas, serie }, com `serie[i]` = [fechamento, volume em reais]
 * ou null (não negociou) alinhada com `datas`. Fundo fora do histórico: serie null.
 */
export function ultimosPregoes(historico, ticker, n) {
  const pregoes = historico?.pregoes ?? []
  const total = pregoes.length
  const datas = pregoes.slice(Math.max(0, total - n))
  const serieCompleta = historico?.ativos?.[ticker]
  if (!serieCompleta) return { datas, serie: null }
  const serie = serieCompleta.slice(Math.max(0, serieCompleta.length - datas.length)).map((v) => (v && v[0] > 0 ? [v[0], v[3] ?? 0] : null))
  return { datas, serie }
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

function argumentoCarga(argv, maximo) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? maximo)
  return Number.isInteger(n) && n > 0 ? Math.min(n, maximo) : maximo
}

export async function main({ argv = process.argv, agora = new Date(), raiz = RAIZ } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'fiis-preco.json'), 'utf8'))
  const arquivoHistorico = path.join(raiz, 'historico', 'fiis.json')
  const snapshot = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'rendimentosFii.json'), 'utf8'))
  const universo = universoDosFiis(snapshot, config.tickersExtras)
  if (universo.size < config.minimoFiisNoBoletim) throw new Error(`O universo tem só ${universo.size} FIIs (mínimo ${config.minimoFiisNoBoletim}): rode antes o job de FIIs. Arquivo NÃO atualizado.`)

  const carga = argumentoCarga(argv, config.maxPregoesGuardados)
  let historico = lerJson(arquivoHistorico, historicoVazio())
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiis-b3-'))
  let novos = 0
  let semPregao = 0
  try {
    for (const data of faltam) {
      if (carga > 0 && historico.pregoes.length >= carga) break
      let xml
      try {
        xml = await baixarBoletim(data, pastaTemp)
      } catch (erro) {
        if (carga > 0) {
          console.warn(`[aviso] ${data}: ${erro.message} (carga inicial segue).`)
          continue
        }
        throw new Error(`${erro.message} Arquivo NÃO atualizado.`)
      }
      if (!xml) {
        semPregao++
        console.log(`[info] ${data}: sem pregão na B3 (zip vazio).`)
        continue
      }
      const lido = await lerBoletim(xml, (t) => universo.has(t))
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      if (lido.datas.length !== 1 || lido.datas[0] !== data) {
        const msg = `${data}: o boletim trouxe a(s) data(s) ${lido.datas.join(', ') || 'nenhuma'}.`
        if (carga > 0) {
          console.warn(`[aviso] ${msg} Ignorado.`)
          continue
        }
        throw new Error(`${msg} Arquivo NÃO atualizado.`)
      }
      if (lido.instrumentos.size < config.minimoFiisNoBoletim) {
        const msg = `${data}: só ${lido.instrumentos.size} FIIs do universo no boletim (mínimo ${config.minimoFiisNoBoletim}).`
        if (carga > 0) {
          console.warn(`[aviso] ${msg} Ignorado.`)
          continue
        }
        throw new Error(`${msg} Arquivo NÃO atualizado.`)
      }
      historico = incorporarPregao(historico, data, lido.instrumentos, universo, config.maxPregoesGuardados)
      novos++
      console.log(`[info] ${data}: ${lido.instrumentos.size} FIIs lidos (${lido.blocos} instrumentos no boletim).`)
      if (carga > 0) {
        if (novos % 20 === 0) {
          fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
          fs.writeFileSync(arquivoHistorico, formatarHistorico(historico))
          console.log(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  if (novos === 0) {
    console.log(`Sem pregão novo desde ${historico.pregoes.at(-1) ?? 'nenhum'}${semPregao ? ' (feriado ou fim de semana)' : ''}: arquivo mantido.`)
    return { novos, historico }
  }
  fs.mkdirSync(path.dirname(arquivoHistorico), { recursive: true })
  fs.writeFileSync(arquivoHistorico, formatarHistorico(historico))
  const ultimo = historico.pregoes.at(-1)
  const diasDesdePregao = (agora.getTime() - Date.parse(`${ultimo}T21:00:00Z`)) / 86_400_000
  console.log(`historico/fiis.json atualizado: ${historico.pregoes.length} pregões (${novos} novos), último de ${ultimo}, ${Object.keys(historico.ativos).length} fundos com preço.`)
  if (diasDesdePregao > 7) throw new Error(`O pregão mais recente do histórico é de ${ultimo}, mais de 7 dias atrás.`)
  if (historico.pregoes.length < config.minimoPregoesParaUsar) console.warn(`[aviso] Só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesParaUsar} para a triagem usar o preço diário). Rode a carga inicial de novo: ela continua de onde parou.`)
  return { novos, historico }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
