// Atualização diária do histórico dos índices IBOV e IFIX (análise técnica do Simule Ações e do Simule FII, D140).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-indices.yml) ou à mão:
//   node scripts/atualizar-indices.mjs                      (dia a dia)
//   node scripts/atualizar-indices.mjs --carga-inicial=260  (uma vez, histórico)
//
// Fonte: arquivo de índices do Boletim Diário da B3 (IRAAMMDD.zip, XML BVBG.087), o mesmo site e o mesmo mecanismo do Boletim de Preços
// (scripts/b3-boletim.mjs). Conferido em 04/11/2026 com o pregão de 03/11: cada índice vem num bloco <IndxInf> com o código em
// <TckrSymb> e abertura (OpngPric), mínima (MinPric), máxima (MaxPric) e fechamento (ClsgPric) em pontos. Não há volume. Atenção: há
// outros índices com nome parecido (IBOVEQWEIGHT), então o código é comparado por igualdade, não por prefixo.
//
// Grava webapp-src/public/dados/indices-historico/<CODIGO>.json no formato do histórico longo das ações (o mesmo que o importador de
// CSV, scripts/importar-indice-historico.mjs, escreve). Dado estranho = o script termina com erro SEM gravar nada. Sem pregão novo:
// nada muda, sem commit.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, datasCandidatas, lerTag } from './b3-boletim.mjs'
import { conferir, montarArquivo, mesclar } from './importar-indice-historico.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'indices.json')
const PASTA_SAIDA = path.join(RAIZ, 'webapp-src', 'public', 'dados', 'indices-historico')

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em atualizar-indices.test.mjs)
// ---------------------------------------------------------------------------------------

const numero = (texto) => {
  if (texto === null || texto === undefined || texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

/** Datas (AAAA-MM-DD) que aparecem em tags <Dt> do XML, sem repetição. O arquivo de um pregão deve ter exatamente a data pedida. */
export function datasDoBoletim(xml) {
  const datas = new Set()
  for (const m of xml.matchAll(/<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/g)) datas.add(m[1])
  return [...datas].sort()
}

/**
 * Lê os blocos <IndxInf> e devolve, para cada código pedido, [data, abertura, máxima, mínima, fechamento, volume 0].
 * Erra (em vez de adivinhar) se um índice faltar ou vier com número inválido ou incoerente.
 */
export function extrairIndices(xml, tickers, data) {
  const achados = new Map()
  for (const m of xml.matchAll(/<IndxInf>[\s\S]*?<\/IndxInf>/g)) {
    const bloco = m[0]
    const ticker = lerTag(bloco, 'TckrSymb')
    if (!ticker || !tickers.includes(ticker.toUpperCase())) continue
    const abe = numero(lerTag(bloco, 'OpngPric'))
    const min = numero(lerTag(bloco, 'MinPric'))
    const max = numero(lerTag(bloco, 'MaxPric'))
    const fech = numero(lerTag(bloco, 'ClsgPric'))
    if ([abe, min, max, fech].some((v) => v === null || v <= 0)) throw new Error(`${ticker} em ${data}: abertura, mínima, máxima e fechamento precisam ser números maiores que zero (lidos: ${abe}, ${min}, ${max}, ${fech}).`)
    if (max < Math.max(abe, fech) || min > Math.min(abe, fech)) throw new Error(`${ticker} em ${data}: máxima ${max} e mínima ${min} não cobrem a abertura ${abe} e o fechamento ${fech}.`)
    achados.set(ticker.toUpperCase(), [data, abe, max, min, fech, 0])
  }
  const faltam = tickers.filter((t) => !achados.has(t))
  if (faltam.length) throw new Error(`O arquivo de ${data} não trouxe ${faltam.join(', ')}.`)
  return achados
}

/** Datas candidatas (da mais nova para a mais antiga) que ainda não estão no histórico. Dia a dia, para na primeira já conhecida. */
export function datasQueFaltam(candidatas, jaTem, cargaInicial = false) {
  const faltam = []
  for (const data of candidatas) {
    if (jaTem.has(data)) {
      if (!cargaInicial) break
      continue
    }
    faltam.push(data)
  }
  return cargaInicial ? faltam : faltam.reverse()
}

// ---------------------------------------------------------------------------------------
// Entrada/saída
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const arquivoDe = (codigo) => path.join(PASTA_SAIDA, `${codigo}.json`)
const lerBarras = (codigo) => (fs.existsSync(arquivoDe(codigo)) ? JSON.parse(fs.readFileSync(arquivoDe(codigo), 'utf8')).barras : [])

function argumentoCarga(argv) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? 260)
  return Number.isInteger(n) && n > 0 ? n : 260
}

async function main() {
  const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG, 'utf8'))
  const tickers = config.indices.map((i) => i.ticker)
  const agora = new Date()
  const hoje = new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
  const carga = argumentoCarga(process.argv)
  const historico = Object.fromEntries(config.indices.map((i) => [i.codigo, lerBarras(i.codigo)]))

  // Um pregão só conta como processado quando TODOS os índices o têm.
  const jaTem = new Set(Object.values(historico).map((b) => new Set(b.map((x) => x[0]))).reduce((a, s) => new Set([...a].filter((d) => s.has(d)))))
  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim ?? 5
  const faltam = datasQueFaltam(datasCandidatas(agora, quantidade, config.horarioCorteBoletim), jaTem, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'indices-b3-'))
  let novos = 0
  try {
    for (const data of faltam) {
      if (carga > 0 && novos >= carga) break
      let xml
      try {
        xml = await baixarBoletim(data, pastaTemp, { prefixo: 'IR', tipo: '087' })
      } catch (erro) {
        if (carga > 0) {
          console.warn(`[aviso] ${data}: ${erro.message} (carga inicial segue).`)
          continue
        }
        throw new Error(`${erro.message} Arquivo NÃO atualizado.`)
      }
      if (!xml) {
        console.log(`[info] ${data}: sem pregão na B3 (zip vazio).`)
        continue
      }
      const texto = fs.readFileSync(xml, 'utf8')
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      try {
        const datas = datasDoBoletim(texto)
        if (datas.length !== 1 || datas[0] !== data) throw new Error(`o arquivo trouxe a(s) data(s) ${datas.join(', ') || 'nenhuma'}, e não ${data}.`)
        const dia = extrairIndices(texto, tickers, data)
        for (const i of config.indices) historico[i.codigo] = mesclar(historico[i.codigo], [dia.get(i.ticker)])
        novos++
        console.log(`[info] ${data}: ${config.indices.map((i) => `${i.codigo} ${dia.get(i.ticker)[4]}`).join(' · ')}`)
      } catch (erro) {
        if (carga > 0) {
          console.warn(`[aviso] ${data}: ${erro.message} Ignorado.`)
          continue
        }
        throw new Error(`${data}: ${erro.message} Arquivo NÃO atualizado.`)
      }
      if (carga > 0) await esperar(config.pausaEntreDownloadsMs ?? 1000)
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  if (novos === 0) {
    console.log(`Sem pregão novo: arquivos mantidos.`)
    return
  }
  // Confere tudo antes de gravar qualquer arquivo: se um índice falhar, nenhum é alterado.
  const maximo = config.maximoPregoesGuardados ?? 1300
  for (const i of config.indices) {
    historico[i.codigo] = historico[i.codigo].slice(-maximo)
    for (const aviso of conferir(historico[i.codigo], hoje)) console.log(`[info] ${i.codigo}: ${aviso}`)
  }
  fs.mkdirSync(PASTA_SAIDA, { recursive: true })
  for (const i of config.indices) {
    const barras = historico[i.codigo]
    const arquivo = montarArquivo(i.codigo, barras, agora)
    arquivo.fonte = `B3 - Boletim Diário, arquivo de índices (BVBG.087) do ${i.nome}`
    fs.writeFileSync(arquivoDe(i.codigo), `${JSON.stringify(arquivo)}\n`)
    console.log(`${i.codigo}.json atualizado: ${barras.length} pregões, até ${barras[barras.length - 1][0]} (${novos} novos nesta execução).`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
