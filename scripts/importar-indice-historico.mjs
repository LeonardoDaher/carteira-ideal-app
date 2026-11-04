// Importa o histórico diário de um índice (IBOV ou IFIX) de uma planilha CSV e grava o arquivo que a "Análise do Ibovespa" (Simule
// Ações) e a "Análise do IFIX" (Simule FII) leem: webapp-src/public/dados/indices-historico/<CODIGO>.json, no mesmo formato do
// histórico longo das ações (candles [data, abertura, máxima, mínima, fechamento, volume]).
//
//   node scripts/importar-indice-historico.mjs IBOV caminho/ibov.csv
//   node scripts/importar-indice-historico.mjs IFIX caminho/ifix.csv --mesclar     (soma ao que já existe; a data nova vence)
//   opções: --decimal=virgula|ponto   (só quando os números forem ambíguos, como "1,234")
//
// O CSV precisa ter, na primeira linha, os nomes das colunas: data, abertura, máxima, mínima e fechamento (volume é opcional;
// índice não tem volume negociado). Aceita ; , ou tab como separador, datas DD/MM/AAAA ou AAAA-MM-DD e números no formato brasileiro
// (1.234,56) ou americano (1,234.56). Os nomes em inglês (Date, Open, High, Low, Close) e "Último" também servem.
//
// Regra de segurança, a mesma dos jobs: dado estranho (data repetida, máxima abaixo do fechamento, salto de mais de 20% em um
// dia, menos de 60 pregões) = o script termina com erro SEM gravar nada. Não inventa abertura, máxima nem mínima.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const INDICES = { IBOV: 'Ibovespa', IFIX: 'IFIX' }
export const MINIMO_PREGOES = 60
export const SALTO_MAXIMO = 0.2

const SEM_ACENTO = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
const APELIDOS = {
  data: ['data', 'date', 'dia'],
  abertura: ['abertura', 'abert', 'abre', 'open', 'opening'],
  maxima: ['maxima', 'max', 'maximo', 'high'],
  minima: ['minima', 'min', 'minimo', 'low'],
  fechamento: ['fechamento', 'fech', 'fecha', 'close', 'ultimo', 'last', 'encerramento'],
  volume: ['volume', 'vol'],
}

/** Separador mais frequente na primeira linha. */
export function detectarSeparador(linha) {
  const cont = { ';': 0, '\t': 0, ',': 0 }
  for (const c of linha) if (c in cont) cont[c]++
  const melhor = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]
  return melhor[1] > 0 ? melhor[0] : ','
}

/** Divide uma linha respeitando aspas. */
export function dividirLinha(linha, sep) {
  const campos = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++ } else aspas = !aspas
    } else if (c === sep && !aspas) {
      campos.push(atual)
      atual = ''
    } else atual += c
  }
  campos.push(atual)
  return campos.map((x) => x.trim())
}

/** "04/11/2026", "4/11/2026" ou "2026-11-04" -> "2026-11-04"; outro formato = null. Confere se o dia existe. */
export function lerData(texto) {
  const t = String(texto ?? '').trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(t)
  let [a, me, d] = m ? [m[1], m[2], m[3]] : [null, null, null]
  if (!m) {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
    if (!m) return null
    ;[d, me, a] = [m[1].padStart(2, '0'), m[2].padStart(2, '0'), m[3]]
  }
  const dt = new Date(`${a}-${me}-${d}T12:00:00Z`)
  return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== `${a}-${me}-${d}` ? null : `${a}-${me}-${d}`
}

/**
 * Número em formato brasileiro ou americano. Com os dois separadores, o último é o decimal. Com um só, "1,5" e "1.5" são decimais,
 * mas "1,234" e "1.234" (três dígitos depois do separador) são ambíguos: erro, a menos que `decimal` diga qual é o decimal.
 */
export function lerNumero(texto, decimal = null) {
  const t = String(texto ?? '').trim().replace(/\s/g, '')
  if (!t || !/^-?[\d.,]+$/.test(t)) return null
  const ponto = t.lastIndexOf('.')
  const virgula = t.lastIndexOf(',')
  let normal
  if (ponto >= 0 && virgula >= 0) {
    const dec = ponto > virgula ? '.' : ','
    normal = dec === '.' ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.')
  } else if (ponto < 0 && virgula < 0) normal = t
  else {
    const sep = ponto >= 0 ? '.' : ','
    const partes = t.split(sep)
    const ambiguo = partes.length === 2 && /^\d{3}$/.test(partes[1]) && partes[0].replace('-', '').length <= 3
    const varios = partes.length > 2
    if (decimal === 'virgula') normal = sep === ',' ? t.replace(',', '.') : t.replace(/\./g, '')
    else if (decimal === 'ponto') normal = sep === '.' ? t : t.replace(/,/g, '')
    else if (varios) normal = t.split(sep).join('')
    else if (ambiguo) throw new Error(`Número ambíguo "${t}": use --decimal=virgula ou --decimal=ponto.`)
    else normal = sep === ',' ? t.replace(',', '.') : t
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Mapeia os nomes das colunas do cabeçalho para os campos; erra se faltar algum obrigatório. */
export function mapearColunas(cabecalho) {
  const nomes = cabecalho.map(SEM_ACENTO)
  const col = {}
  for (const [campo, apelidos] of Object.entries(APELIDOS)) {
    const i = nomes.findIndex((n) => apelidos.includes(n))
    if (i >= 0) col[campo] = i
  }
  const faltam = ['data', 'abertura', 'maxima', 'minima', 'fechamento'].filter((c) => col[c] === undefined)
  if (faltam.length) {
    throw new Error(`Faltam as colunas: ${faltam.join(', ')}. O CSV precisa de data, abertura, máxima, mínima e fechamento (cabeçalho lido: ${cabecalho.join(' | ')}). Sem abertura, máxima e mínima o script não inventa candle.`)
  }
  return col
}

/** CSV -> candles [data, abertura, máxima, mínima, fechamento, volume], em ordem de data. Erra em qualquer dado estranho. */
export function lerCsv(texto, { decimal = null } = {}) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (linhas.length < 2) throw new Error('CSV vazio ou só com cabeçalho.')
  const sep = detectarSeparador(linhas[0])
  const col = mapearColunas(dividirLinha(linhas[0], sep))
  const barras = []
  const vistas = new Map()
  linhas.slice(1).forEach((linha, k) => {
    const n = k + 2
    const c = dividirLinha(linha, sep)
    const data = lerData(c[col.data])
    if (!data) throw new Error(`Linha ${n}: data inválida "${c[col.data]}" (use DD/MM/AAAA ou AAAA-MM-DD).`)
    const abe = lerNumero(c[col.abertura], decimal)
    const max = lerNumero(c[col.maxima], decimal)
    const min = lerNumero(c[col.minima], decimal)
    const fech = lerNumero(c[col.fechamento], decimal)
    if ([abe, max, min, fech].some((v) => v === null || v <= 0)) throw new Error(`Linha ${n} (${data}): abertura, máxima, mínima e fechamento precisam ser números maiores que zero.`)
    const vol = col.volume === undefined || c[col.volume] === '' ? 0 : lerNumero(c[col.volume], decimal)
    if (vol === null || vol < 0) throw new Error(`Linha ${n} (${data}): volume inválido "${c[col.volume]}".`)
    if (vistas.has(data)) throw new Error(`Linha ${n}: a data ${data} aparece duas vezes (também na linha ${vistas.get(data)}).`)
    vistas.set(data, n)
    const tol = 1e-9
    if (max + tol < Math.max(abe, fech) || min - tol > Math.min(abe, fech) || max + tol < min) {
      throw new Error(`Linha ${n} (${data}): máxima ${max} e mínima ${min} não cobrem a abertura ${abe} e o fechamento ${fech}.`)
    }
    barras.push([data, abe, max, min, fech, vol])
  })
  barras.sort((a, b) => a[0].localeCompare(b[0]))
  return barras
}

/** Confere o conjunto: pregões suficientes, nada no futuro e nenhum salto de fechamento acima do limite. Devolve avisos. */
export function conferir(barras, hoje) {
  if (barras.length < MINIMO_PREGOES) throw new Error(`Só ${barras.length} pregões (mínimo ${MINIMO_PREGOES}). Arquivo NÃO gravado.`)
  const futura = barras.find((b) => b[0] > hoje)
  if (futura) throw new Error(`A data ${futura[0]} é posterior a hoje (${hoje}). Arquivo NÃO gravado.`)
  for (let i = 1; i < barras.length; i++) {
    const v = barras[i][4] / barras[i - 1][4] - 1
    if (Math.abs(v) > SALTO_MAXIMO) {
      throw new Error(`Salto de ${(v * 100).toFixed(1)}% no fechamento entre ${barras[i - 1][0]} e ${barras[i][0]}: mais que ${SALTO_MAXIMO * 100}% em um dia não é normal para um índice. Confira o CSV. Arquivo NÃO gravado.`)
    }
  }
  const avisos = []
  const semVolume = barras.every((b) => b[5] === 0)
  if (semVolume) avisos.push('Sem coluna de volume: normal para índice, a análise não usa volume.')
  return avisos
}

/** Soma `novas` às `antigas`; na mesma data, a nova vence. */
export function mesclar(antigas, novas) {
  const porData = new Map(antigas.map((b) => [b[0], b]))
  for (const b of novas) porData.set(b[0], b)
  return [...porData.values()].sort((a, b) => a[0].localeCompare(b[0]))
}

export function montarArquivo(codigo, barras, agora = new Date()) {
  const r = (v) => Math.round(v * 100) / 100
  return {
    ticker: codigo,
    geradoEm: agora.toISOString(),
    fonte: `B3 - série histórica do ${INDICES[codigo]} (importada de planilha)`,
    de: barras[0][0],
    ate: barras[barras.length - 1][0],
    ajustes: [],
    saltosRestantes: [],
    _leia: 'Candles diários [data, abertura, máxima, mínima, fechamento, volume] do índice, em pontos. Índice não tem desdobramento nem volume negociado (volume 0).',
    barras: barras.map(([d, a, h, l, f, v]) => [d, r(a), r(h), r(l), r(f), v]),
  }
}

function main(argv) {
  const [codigo, arquivo, ...opcoes] = argv
  if (!INDICES[codigo] || !arquivo) throw new Error('Uso: node scripts/importar-indice-historico.mjs IBOV|IFIX caminho.csv [--mesclar] [--decimal=virgula|ponto]')
  const decimalOpt = opcoes.find((o) => o.startsWith('--decimal='))?.split('=')[1] ?? null
  if (decimalOpt && !['virgula', 'ponto'].includes(decimalOpt)) throw new Error('--decimal aceita "virgula" ou "ponto".')
  const saida = path.join(RAIZ, 'webapp-src', 'public', 'dados', 'indices-historico', `${codigo}.json`)
  let barras = lerCsv(fs.readFileSync(arquivo, 'utf8'), { decimal: decimalOpt })
  if (opcoes.includes('--mesclar') && fs.existsSync(saida)) barras = mesclar(JSON.parse(fs.readFileSync(saida, 'utf8')).barras, barras)
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  for (const a of conferir(barras, hoje)) console.log(`[aviso] ${a}`)
  fs.mkdirSync(path.dirname(saida), { recursive: true })
  fs.writeFileSync(saida, `${JSON.stringify(montarArquivo(codigo, barras), null, 1)}\n`)
  console.log(`${path.relative(RAIZ, saida)}: ${barras.length} pregões, de ${barras[0][0]} a ${barras[barras.length - 1][0]}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (erro) {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  }
}
