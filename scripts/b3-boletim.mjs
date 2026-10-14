// Leitura do Boletim de Preços da B3 (BVBG.086.01, decisão D23).
//
// Fonte oficial e gratuita, sem cota, usada pelos jobs de ETFs (D23) e de BDRs (D24).
// Um arquivo por pregão, com TODOS os instrumentos da B3, inclusive os ETFs de renda fixa
// (que não estão no COTAHIST). Conferido em 27/09/2026 com o pregão de 25/09:
//   - download: https://www.b3.com.br/pesquisapregao/download?filelist=PRAAMMDD.zip,
//     devolve um zip que contém outro zip (PRAAMMDD.zip) com 4 XMLs de ~136 MB cada,
//     versões do mesmo dia (18h39, 19h06, 19h24 e 20h33 de Brasília). A última é a mais
//     completa: 69 de 1.643 códigos de fundos e BDRs ajustam o volume entre a 1ª e a 4ª.
//     Os nomes dos XMLs são crescentes, então a última versão é a de maior nome.
//   - dia sem pregão: a B3 responde 200 com um zip vazio de 22 bytes (lição do repositório
//     público cvscarlos/b3-api-dados-historicos).
//   - cada instrumento vem num bloco <PricRpt> com TradDt/Dt, TckrSymb, LastPric, MinPric,
//     MaxPric, NtlFinVol (volume em reais, lote padrão + fracionário) e FinInstrmQty.
//
// O XML nunca é carregado inteiro na memória: a leitura é em fluxo, bloco a bloco.

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { execFileSync } from 'node:child_process'

export const URL_BOLETIM = (codigo) => `https://www.b3.com.br/pesquisapregao/download?filelist=${codigo}.zip,`
// Zip com menos que isso não tem arquivo dentro (o vazio da B3 tem 22 bytes).
const TAMANHO_MINIMO_ZIP = 1024
const OFFSET_BRASILIA_MS = -3 * 3_600_000

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em b3-boletim.test.mjs)
// ---------------------------------------------------------------------------------------

/** Código do arquivo do boletim para uma data AAAA-MM-DD: 2026-09-25 -> PR260925. */
export function codigoBoletim(data) {
  const [ano, mes, dia] = String(data).split('-')
  return `PR${ano.slice(-2)}${mes}${dia}`
}

/** Data (AAAA-MM-DD) em Brasília de um instante. */
export function dataEmBrasilia(instante) {
  return new Date(instante.getTime() + OFFSET_BRASILIA_MS).toISOString().slice(0, 10)
}

/**
 * Datas candidatas a pregão, da mais recente para a mais antiga, pulando sábados e domingos.
 * Antes do `horarioCorte` (Brasília), o dia de hoje fica de fora: o boletim do dia ainda
 * pode estar incompleto (a última versão sai por volta das 20h30).
 */
export function datasCandidatas(agora, quantidade, horarioCorte = '21:00') {
  const [hora, minuto] = horarioCorte.split(':').map(Number)
  const local = new Date(agora.getTime() + OFFSET_BRASILIA_MS)
  const antesDoCorte = local.getUTCHours() * 60 + local.getUTCMinutes() < hora * 60 + minuto
  const datas = []
  const cursor = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
  if (antesDoCorte) cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (datas.length < quantidade) {
    const diaSemana = cursor.getUTCDay()
    if (diaSemana !== 0 && diaSemana !== 6) datas.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return datas
}

const numeroOuNull = (texto) => {
  if (texto === null || texto === undefined || texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

const lerTag = (bloco, tag) => {
  const achado = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(bloco)
  return achado ? achado[1].trim() : null
}

/**
 * Extrai um instrumento de um bloco <PricRpt>…</PricRpt>. Devolve null se faltar o código
 * ou a data. Instrumento sem negócio no dia vem sem fechamento e sem volume (null).
 */
export function extrairPricRpt(bloco) {
  const ticker = lerTag(bloco, 'TckrSymb')
  const data = lerTag(bloco, 'Dt')
  if (!ticker || !data) return null
  return {
    ticker: ticker.toUpperCase(),
    data,
    fechamento: numeroOuNull(lerTag(bloco, 'LastPric')),
    minima: numeroOuNull(lerTag(bloco, 'MinPric')),
    maxima: numeroOuNull(lerTag(bloco, 'MaxPric')),
    volume: numeroOuNull(lerTag(bloco, 'NtlFinVol')),
    quantidade: numeroOuNull(lerTag(bloco, 'FinInstrmQty')),
  }
}

/** Última versão do dia entre os XMLs do boletim (nomes crescentes ao longo do dia). */
export function escolherUltimaVersao(nomes) {
  const xmls = nomes.filter((n) => /^BVBG\.086\.01_.*\.xml$/i.test(path.basename(n))).sort()
  return xmls.length ? xmls[xmls.length - 1] : null
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

/**
 * Lê o XML em fluxo e devolve um Map ticker -> instrumento, só com os códigos aceitos por
 * `aceitar` (função). Também devolve a data do pregão e quantos blocos foram lidos.
 */
export async function lerBoletim(caminhoXml, aceitar = () => true) {
  const instrumentos = new Map()
  const datas = new Set()
  let blocos = 0
  let buffer = null
  const leitor = readline.createInterface({ input: fs.createReadStream(caminhoXml, { encoding: 'utf8' }), crlfDelay: Infinity })
  for await (const linha of leitor) {
    if (buffer === null) {
      if (linha.includes('<PricRpt>')) buffer = [linha]
      continue
    }
    buffer.push(linha)
    if (!linha.includes('</PricRpt>')) continue
    blocos++
    const bloco = buffer.join('\n')
    buffer = null
    // Filtro barato antes do parse completo: o código vem logo no começo do bloco.
    const ticker = lerTag(bloco, 'TckrSymb')
    if (!ticker || !aceitar(ticker.toUpperCase())) continue
    const item = extrairPricRpt(bloco)
    if (!item) continue
    instrumentos.set(item.ticker, item)
    datas.add(item.data)
  }
  return { instrumentos, datas: [...datas].sort(), blocos }
}

/** Descompacta um zip na pasta indicada e devolve a lista de arquivos extraídos. */
function descompactar(zip, pasta, apenas = null) {
  fs.mkdirSync(pasta, { recursive: true })
  const args = ['-o', '-q', zip]
  if (apenas) args.push(apenas)
  args.push('-d', pasta)
  execFileSync('unzip', args)
  return apenas ? [apenas] : execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean)
}

/**
 * Baixa o boletim de uma data e devolve o caminho do XML da última versão, ou null se a B3
 * devolver o zip vazio (dia sem pregão). Extrai só o XML necessário, para não ocupar ~540 MB
 * em disco por dia.
 */
export async function baixarBoletim(data, pastaTemp, { fetchImpl = fetch, limiteMs = 180_000, tentativas = 4, pausaMs = 15_000 } = {}) {
  const codigo = codigoBoletim(data)
  let conteudo
  for (let tentativa = 1; ; tentativa++) {
    try {
      // Limite de tempo por arquivo: sem ele, uma resposta presa da B3 segura o job até o
      // tempo máximo do workflow.
      const resposta = await fetchImpl(URL_BOLETIM(codigo), {
        headers: { 'User-Agent': 'carteira-ideal (github actions)' },
        signal: AbortSignal.timeout(limiteMs),
      })
      if (!resposta.ok) throw new Error(`B3 respondeu ${resposta.status} para o boletim ${codigo}.`)
      conteudo = Buffer.from(await resposta.arrayBuffer())
      break
    } catch (erro) {
      const motivo = erro?.name === 'TimeoutError' ? `sem resposta da B3 em ${limiteMs / 1000} s para o boletim ${codigo}.` : erro.message
      if (tentativa >= tentativas) throw new Error(motivo)
      console.warn(`[aviso] ${motivo} Nova tentativa.`)
      await new Promise((r) => setTimeout(r, pausaMs * tentativa))
    }
  }
  if (conteudo.length < TAMANHO_MINIMO_ZIP) return null
  const pasta = path.join(pastaTemp, codigo)
  const externo = path.join(pastaTemp, `${codigo}-download.zip`)
  fs.writeFileSync(externo, conteudo)
  try {
    // O download é um zip com outro zip dentro; aceita também o XML direto, por segurança.
    let nomes = execFileSync('unzip', ['-Z1', externo], { encoding: 'utf8' }).split('\n').filter(Boolean)
    let zipDosXmls = externo
    const interno = nomes.find((n) => /\.zip$/i.test(n))
    if (interno) {
      descompactar(externo, pasta, interno)
      zipDosXmls = path.join(pasta, interno)
      nomes = execFileSync('unzip', ['-Z1', zipDosXmls], { encoding: 'utf8' }).split('\n').filter(Boolean)
    }
    const ultima = escolherUltimaVersao(nomes)
    if (!ultima) throw new Error(`O boletim ${codigo} não trouxe nenhum XML BVBG.086.01.`)
    descompactar(zipDosXmls, pasta, ultima)
    if (zipDosXmls !== externo) fs.rmSync(zipDosXmls, { force: true })
    return path.join(pasta, ultima)
  } finally {
    fs.rmSync(externo, { force: true })
  }
}
