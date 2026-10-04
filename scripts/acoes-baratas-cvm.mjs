// Entrada de dados da triagem "Top 15 ações mais baratas" (D49): download dos arquivos abertos da
// CVM (100% gratuitos, sem chave) e extração SÓ das linhas necessárias para os insumos.
//
// Regras de projeto (auditoria):
//  - Todo arquivo baixado tem sha256, tamanho, URL e instante registrados (vão no manifesto).
//  - Todo CSV tem o cabeçalho validado contra as colunas esperadas; se a CVM mudar o layout, o job
//    FALHA com mensagem clara em vez de produzir número errado em silêncio.
//  - Só a versão mais recente (maior VERSAO) de cada documento é usada; reapresentações substituem.
//  - Nada é interpretado aqui: este módulo copia linhas. Toda conta e toda fórmula ficam em
//    acoes-baratas-calculo.mjs, onde podem ser lidas e testadas.

import { spawn, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { CONTAS_HISTORICO, contasNecessarias, semAcento } from './acoes-baratas-calculo.mjs'

export const BASE_CVM = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC'
export const urlDemonstracoes = (tipo, ano) => `${BASE_CVM}/${tipo}/DADOS/${tipo.toLowerCase()}_cia_aberta_${ano}.zip`
export const urlFca = (ano) => `${BASE_CVM}/FCA/DADOS/fca_cia_aberta_${ano}.zip`

export const cnpjDigitos = (v) => String(v ?? '').replace(/\D/g, '')
export function cnpjFormatado(v) {
  const d = cnpjDigitos(v).padStart(14, '0')
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// ---------------------------------------------------------------------------------------
// Download com registro de proveniência
// ---------------------------------------------------------------------------------------

export async function baixar(url, destino, { fetchImpl = fetch, tentativas = 3, pausaMs = 3000 } = {}) {
  let ultimoErro
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(url, { headers: { 'user-agent': 'carteira-ideal-triagem/1.0 (dados abertos CVM)' } })
      if (resp.status === 404) return null // ano ainda não publicado
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const buf = Buffer.from(await resp.arrayBuffer())
      fs.mkdirSync(path.dirname(destino), { recursive: true })
      fs.writeFileSync(destino, buf)
      return { url, arquivo: path.basename(destino), bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), baixadoEm: new Date().toISOString(), caminho: destino }
    } catch (e) {
      ultimoErro = e
      if (t < tentativas) await new Promise((r) => setTimeout(r, pausaMs * t))
    }
  }
  throw new Error(`Falha ao baixar ${url}: ${ultimoErro?.message}`)
}

export function sha256Arquivo(caminho) {
  return crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex')
}

// ---------------------------------------------------------------------------------------
// Zip e CSV (streaming, ISO-8859-1, separador ';')
// ---------------------------------------------------------------------------------------

export const listarZip = (zip) => execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean)

/** Divide uma linha CSV com ';' respeitando aspas duplas. */
export function dividirLinha(linha) {
  if (!linha.includes('"')) return linha.split(';')
  const campos = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++ } else aspas = !aspas
    } else if (ch === ';' && !aspas) { campos.push(atual); atual = '' } else atual += ch
  }
  campos.push(atual)
  return campos
}

/** Itera as linhas de uma entrada do zip, sem carregar o arquivo inteiro na memória. */
export async function* linhasDoZip(zip, entrada) {
  const filho = spawn('unzip', ['-p', zip, entrada], { stdio: ['ignore', 'pipe', 'pipe'] })
  filho.stdout.setEncoding('latin1')
  let erro = ''
  filho.stderr.on('data', (d) => (erro += d))
  const fim = new Promise((resolve) => filho.on('close', resolve))
  const rl = readline.createInterface({ input: filho.stdout, crlfDelay: Infinity })
  for await (const l of rl) if (l.length) yield l
  const codigo = await fim
  if (codigo !== 0) throw new Error(`unzip falhou (${codigo}) em ${entrada}: ${erro.slice(0, 200)}`)
}

/** Cabeçalho → índice por nome; exige as colunas (por regex quando passada como RegExp). */
export function indiceDasColunas(cabecalho, exigidas, arquivo) {
  const nomes = dividirLinha(cabecalho).map((n) => n.replace(/^\uFEFF/, '').trim())
  const indice = {}
  const faltando = []
  for (const [chave, padrao] of Object.entries(exigidas)) {
    const i = nomes.findIndex((n) => (padrao instanceof RegExp ? padrao.test(n) : n.toUpperCase() === padrao.toUpperCase()))
    if (i < 0) faltando.push(chave)
    else indice[chave] = i
  }
  if (faltando.length) throw new Error(`Layout inesperado em ${arquivo}: faltam as colunas ${faltando.join(', ')}. Cabeçalho lido: ${nomes.join(' | ')}`)
  return indice
}

export function numeroCvm(texto) {
  const t = String(texto ?? '').trim()
  if (t === '') return null
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
  return Number.isFinite(n) ? n : null
}

export function fatorEscala(escala) {
  const e = semAcento(escala).trim()
  if (e === 'mil') return 1000
  if (e === 'unidade' || e === '') return 1
  throw new Error(`ESCALA_MOEDA desconhecida: "${escala}"`)
}

// ---------------------------------------------------------------------------------------
// Extração dos documentos, demonstrações e capital
// ---------------------------------------------------------------------------------------

const ARQ_PRINCIPAL = /^(dfp|itr)_cia_aberta_\d{4}\.csv$/i
const ARQ_DEMONSTRACAO = /_(DRE|BPA|BPP|DVA)_(con|ind)_\d{4}\.csv$/i
const ARQ_DFC = /_DFC_(MD|MI)_(con|ind)_\d{4}\.csv$/i
const ARQ_CAPITAL = /composicao_capital/i

/**
 * Lê um zip DFP ou ITR e devolve { docs, linhas, capital, estatisticas } só das empresas em `cnpjs`
 * (Set de CNPJ só com dígitos) e só das contas necessárias.
 */
export async function extrairZip(zip, tipo, cnpjs, { log = () => {}, somenteHistorico = false } = {}) {
  const entradas = listarZip(zip)
  const nomeBase = (e) => path.basename(e)
  const principal = entradas.find((e) => ARQ_PRINCIPAL.test(nomeBase(e)))
  if (!principal) throw new Error(`${zip}: arquivo principal ${tipo.toLowerCase()}_cia_aberta_AAAA.csv não encontrado.`)
  // somenteHistorico: DFP antigas, lidas só para a consistência de N exercícios (lucro e FCO, coluna ÚLTIMO).
  const necessarias = new Set((somenteHistorico ? CONTAS_HISTORICO : contasNecessarias()).map((c) => `${c.dem}|${c.cd}`))
  const stat = { linhasLidas: 0, linhasGuardadas: 0, moedaDiferente: 0, arquivos: [] }

  // 1) Documentos (versão mais recente de cada DT_REFER)
  const docsBrutos = new Map()
  let idx
  for await (const l of linhasDoZip(zip, principal)) {
    if (!idx) {
      idx = indiceDasColunas(l, { cnpj: 'CNPJ_CIA', dtRefer: 'DT_REFER', versao: 'VERSAO', dtReceb: 'DT_RECEB', link: 'LINK_DOC' }, principal)
      continue
    }
    const c = dividirLinha(l)
    const cnpj = cnpjDigitos(c[idx.cnpj])
    if (!cnpjs.has(cnpj)) continue
    const versao = Number(c[idx.versao])
    const chave = `${cnpj}|${c[idx.dtRefer]}`
    const atual = docsBrutos.get(chave)
    if (!atual || versao > atual.versao) docsBrutos.set(chave, { cnpj, doc: tipo, dtRefer: c[idx.dtRefer], versao, dtReceb: c[idx.dtReceb] || null, linkDoc: c[idx.link] || null })
  }
  const docs = [...docsBrutos.values()]
  const versaoVigente = new Map(docs.map((d) => [`${d.cnpj}|${d.dtRefer}`, d.versao]))
  const linkPor = new Map(docs.map((d) => [`${d.cnpj}|${d.dtRefer}`, d.linkDoc]))

  // 2) Demonstrações
  const linhas = []
  for (const entrada of entradas) {
    const nome = nomeBase(entrada)
    let m = nome.match(ARQ_DEMONSTRACAO)
    let dem = m?.[1]?.toUpperCase()
    let cons = m?.[2]?.toLowerCase()
    if (!m) {
      m = nome.match(ARQ_DFC)
      if (m) { dem = 'DFC'; cons = m[2].toLowerCase() }
    }
    if (!m) continue
    stat.arquivos.push(nome)
    const flui = dem !== 'BPA' && dem !== 'BPP'
    let i
    for await (const l of linhasDoZip(zip, entrada)) {
      if (!i) {
        i = indiceDasColunas(l, { cnpj: 'CNPJ_CIA', dtRefer: 'DT_REFER', versao: 'VERSAO', moeda: 'MOEDA', escala: 'ESCALA_MOEDA', ordem: 'ORDEM_EXERC', dtFim: 'DT_FIM_EXERC', cd: 'CD_CONTA', ds: 'DS_CONTA', valor: 'VL_CONTA', ...(flui ? { dtIni: 'DT_INI_EXERC' } : {}) }, nome)
        continue
      }
      stat.linhasLidas++
      const c = dividirLinha(l)
      const cd = c[i.cd]
      if (!necessarias.has(`${dem}|${cd}`)) continue
      const cnpj = cnpjDigitos(c[i.cnpj])
      if (!cnpjs.has(cnpj)) continue
      const vigente = versaoVigente.get(`${cnpj}|${c[i.dtRefer]}`)
      if (vigente === undefined || Number(c[i.versao]) !== vigente) continue
      if (semAcento(c[i.moeda]).trim() !== 'real') { stat.moedaDiferente++; continue }
      const valor = numeroCvm(c[i.valor])
      if (valor === null) continue
      const ordem = semAcento(c[i.ordem]).includes('penultimo') ? 'PENULTIMO' : 'ULTIMO'
      if (somenteHistorico && ordem !== 'ULTIMO') continue
      linhas.push({
        cnpj, doc: tipo, dtRefer: c[i.dtRefer], versao: vigente, dem, cons, ordem,
        dtIni: flui ? c[i.dtIni] || null : null, dtFim: c[i.dtFim], cd, ds: c[i.ds].trim(),
        valor: valor * fatorEscala(c[i.escala]), linkDoc: linkPor.get(`${cnpj}|${c[i.dtRefer]}`) ?? null,
      })
      stat.linhasGuardadas++
    }
  }

  // 3) Composição do capital (quantidade de ações, em unidades)
  const capital = []
  const arqCapital = entradas.find((e) => ARQ_CAPITAL.test(nomeBase(e)))
  if (arqCapital) {
    let k
    for await (const l of linhasDoZip(zip, arqCapital)) {
      if (!k) {
        k = indiceDasColunas(l, { cnpj: 'CNPJ_CIA', dtRefer: 'DT_REFER', versao: 'VERSAO', ord: /^QT_ACAO_ORD.*(CAP|INTEG)/i, pref: /^QT_ACAO_PREF.*(CAP|INTEG)/i, tesOrd: /^QT_ACAO_ORD.*TESOURO/i, tesPref: /^QT_ACAO_PREF.*TESOURO/i }, nomeBase(arqCapital))
        continue
      }
      const c = dividirLinha(l)
      const cnpj = cnpjDigitos(c[k.cnpj])
      if (!cnpjs.has(cnpj)) continue
      const vigente = versaoVigente.get(`${cnpj}|${c[k.dtRefer]}`)
      if (vigente !== undefined && Number(c[k.versao]) !== vigente) continue
      capital.push({ cnpj, doc: tipo, dtRefer: c[k.dtRefer], versao: Number(c[k.versao]), ordinarias: numeroCvm(c[k.ord]) ?? 0, preferenciais: numeroCvm(c[k.pref]) ?? 0, tesouroOrd: numeroCvm(c[k.tesOrd]) ?? 0, tesouroPref: numeroCvm(c[k.tesPref]) ?? 0 })
    }
  } else log(`  aviso: ${zip} sem arquivo de composição do capital`)

  log(`  ${path.basename(zip)}: ${docs.length} documentos, ${stat.linhasGuardadas} linhas de ${stat.linhasLidas} lidas, ${capital.length} registros de capital`)
  return { docs, linhas, capital, estatisticas: stat }
}

// ---------------------------------------------------------------------------------------
// Mapeamento ticker → CNPJ (FCA, valores mobiliários) + correções manuais
// ---------------------------------------------------------------------------------------

/** Lê o FCA e devolve Map ticker → { cnpjs:Set, vigentes:Set } com todos os códigos de negociação. */
export async function mapaTickerCnpj(zipFca) {
  const entrada = listarZip(zipFca).find((e) => /valor_mobiliario/i.test(path.basename(e)))
  if (!entrada) throw new Error(`${zipFca}: arquivo de valores mobiliários do FCA não encontrado.`)
  const mapa = new Map()
  let i
  for await (const l of linhasDoZip(zipFca, entrada)) {
    if (!i) {
      i = indiceDasColunas(l, { cnpj: /^CNPJ_Companhia$/i, codigo: /^Codigo_Negociacao$/i }, path.basename(entrada))
      const fim = dividirLinha(l).findIndex((n) => /^Data_Fim_Negociacao$/i.test(n.trim()))
      i.fim = fim
      continue
    }
    const c = dividirLinha(l)
    const cnpj = cnpjDigitos(c[i.cnpj])
    const vigente = i.fim < 0 || !c[i.fim]?.trim()
    for (const t of String(c[i.codigo] ?? '').toUpperCase().match(/[A-Z0-9]{4}\d{1,2}/g) ?? []) {
      const e = mapa.get(t) ?? { cnpjs: new Set(), vigentes: new Set() }
      e.cnpjs.add(cnpj)
      if (vigente) e.vigentes.add(cnpj)
      mapa.set(t, e)
    }
  }
  return mapa
}

/**
 * Resolve o CNPJ de cada ticker do cadastro. Prioridade: correção manual (config) → FCA com um
 * único CNPJ vigente → FCA com um único CNPJ → ambíguo/ausente (sem CNPJ; a empresa sai com motivo).
 */
export function resolverCnpjs(tickers, mapaFca, manual = {}) {
  return tickers.map((t) => {
    const m = manual[t]
    if (m) return { ticker: t, cnpj: cnpjFormatado(m), origem: 'manual (config/acoes-baratas-cnpj.json)' }
    const e = mapaFca?.get(t)
    if (!e) return { ticker: t, cnpj: null, origem: 'não encontrado no FCA' }
    if (e.vigentes.size === 1) return { ticker: t, cnpj: cnpjFormatado([...e.vigentes][0]), origem: 'FCA (vigente)' }
    if (e.cnpjs.size === 1) return { ticker: t, cnpj: cnpjFormatado([...e.cnpjs][0]), origem: 'FCA' }
    return { ticker: t, cnpj: null, origem: `ambíguo no FCA (${[...e.cnpjs].map(cnpjFormatado).join(', ')})` }
  })
}
