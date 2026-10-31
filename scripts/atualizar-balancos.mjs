// Balanços trimestrais das empresas para a aba "Balanços" do Simule Ações (radar de datas e análise dos balanços divulgados).
//
//   node scripts/atualizar-balancos.mjs                       baixa as demonstrações da CVM e grava o arquivo do app
//   node scripts/atualizar-balancos.mjs --dados-locais=PASTA  usa zips já baixados (offline; também guarda os baixados)
//
// Baixa ITR e DFP (6 anos) da CVM, liga código de negociação a CNPJ pelo FCA (mesmas regras do Top 15) e grava
// webapp-src/public/dados/balancos.json: para cada empresa, os últimos 20 trimestres isolados (R$ mil), a data em que cada um foi
// recebido pela CVM e a estimativa da próxima divulgação. Se algo estiver errado, o job termina com erro SEM alterar o arquivo.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { agruparPorCnpj, empresasDoCadastro } from './atualizar-acoes-baratas.mjs'
import { baixar, cnpjDigitos, mapaTickerCnpj, resolverCnpjs, urlDemonstracoes, urlFca } from './acoes-baratas-cvm.mjs'
import { extrairParaFundamentos } from './atualizar-fundamentos.mjs'
import { acharEntrega, baixarFinanceiro, codigoCvmDaRaiz } from './b3-balancos.mjs'
import { incorporarB3, montarBalancoDaEmpresa, verificarSanidadeBalancos } from './balancos-calculo.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const VERSAO = '1.0.0'
export const FONTE = 'CVM - Dados abertos (ITR e DFP de companhias abertas)'

const lerJson = (arquivo, padrao = null) => {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

/** Hoje em Brasília (AAAA-MM-DD). */
export const hojeEmBrasilia = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10)

/** balancos.json legível no GitHub: uma empresa por linha. */
export function formatarBalancos(saida) {
  const { empresas, excluidas, ...topo } = saida
  const linhas = Object.keys(empresas).sort().map((t) => `    ${JSON.stringify(t)}: ${JSON.stringify(empresas[t])}`)
  return [
    '{',
    ...Object.entries(topo).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`),
    `  "excluidas": ${JSON.stringify(excluidas)},`,
    `  "empresas": {\n${linhas.join(',\n')}\n  }`,
    '}',
    '',
  ].join('\n')
}

/**
 * Balanço divulgado nos últimos dias que a CVM ainda não publicou em arquivo aberto: a B3 mostra no mesmo dia. Falha em uma empresa não
 * derruba o job (fica só com o dado da CVM). Uma consulta de cadastro e uma de resumo por empresa; o dia da entrega só é procurado quando há balanço novo.
 */
export async function completarComB3({ saida, docsPorTicker, dataCorte, fetchImpl = fetch, log = console.log, pausaMs = 300 }) {
  const vistas = new Set()
  let novos = 0
  let falhas = 0
  for (const ticker of Object.keys(saida)) {
    const raiz = ticker.slice(0, 4)
    if (vistas.has(raiz)) continue
    vistas.add(raiz)
    try {
      const codigo = await codigoCvmDaRaiz(raiz, { fetchImpl })
      if (!codigo) continue
      const b3 = await baixarFinanceiro(codigo, { fetchImpl })
      const ultimo = saida[ticker].trimestres.at(-1)
      if (!b3 || b3.periodo <= ultimo.periodo) continue
      const tipo = b3.periodo.slice(5) === '12-31' ? 'DFP' : 'ITR'
      const entrega = await acharEntrega({ raiz, periodo: b3.periodo, tipo, hoje: dataCorte, fetchImpl })
      const atualizada = incorporarB3({ empresa: saida[ticker], docs: docsPorTicker.get(ticker) ?? [], b3, entrega, dataCorte })
      if (atualizada !== saida[ticker]) {
        novos++
        saida[ticker] = atualizada
      }
    } catch (e) {
      falhas++
      log(`  [B3] ${ticker}: ${e.message}`)
    }
    if (pausaMs) await new Promise((r) => setTimeout(r, pausaMs))
  }
  log(`  B3: ${novos} empresas com balanço mais novo que a CVM (${falhas} falhas)`)
}

export async function executar({ raiz = RAIZ_PADRAO, dadosLocais = null, agora = new Date(), log = console.log, fetchImpl = fetch } = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'acoes-baratas.json'))
  const configAcoes = lerJson(path.join(raiz, 'config', 'acoes.json'))
  const manualCnpj = lerJson(path.join(raiz, 'config', 'acoes-baratas-cnpj.json'), {})
  delete manualCnpj._leia
  delete manualCnpj._fontes

  const dataCorte = hojeEmBrasilia(agora)
  const ano = Number(dataCorte.slice(0, 4))
  const empresas = empresasDoCadastro(configAcoes)
  const financeiros = new Set(cfg.universo?.setoresExcluidos ?? [])
  log(`Balanços: ${empresas.length} empresas no cadastro · data de corte ${dataCorte}`)

  const pastaTemp = dadosLocais ?? fs.mkdtempSync(path.join(os.tmpdir(), 'balancos-'))
  fs.mkdirSync(pastaTemp, { recursive: true })
  const obter = async (url, nome) => {
    const destino = path.join(pastaTemp, nome)
    if (fs.existsSync(destino) && fs.statSync(destino).size > 0 && dadosLocais) return destino
    log(`  baixando ${nome}…`)
    const r = await baixar(url, destino, { fetchImpl })
    return r ? destino : null
  }

  try {
    const zipsFca = []
    for (const a of [ano, ano - 1]) {
      const z = await obter(urlFca(a), `fca_cia_aberta_${a}.zip`)
      if (z) zipsFca.push(z)
    }
    if (!zipsFca.length) throw new Error('FCA da CVM indisponível: sem ele não há como ligar código de negociação a CNPJ.')
    const mapeamento = resolverCnpjs(empresas.map((e) => e.ticker), await mapaTickerCnpj(zipsFca), manualCnpj)
    const cnpjPorTicker = new Map(mapeamento.map((m) => [m.ticker, m.cnpj]))
    const cnpjs = new Set(mapeamento.filter((m) => m.cnpj).map((m) => cnpjDigitos(m.cnpj)))
    log(`  CNPJ resolvido para ${cnpjs.size} de ${empresas.length} empresas`)

    const extracoes = []
    for (const tipo of ['DFP', 'ITR']) {
      for (const a of [ano - 5, ano - 4, ano - 3, ano - 2, ano - 1, ano]) {
        const zip = await obter(urlDemonstracoes(tipo, a), `${tipo.toLowerCase()}_cia_aberta_${a}.zip`)
        if (!zip) {
          log(`  ${tipo} ${a}: não publicado, seguindo sem ele`)
          continue
        }
        extracoes.push(await extrairParaFundamentos(zip, tipo, cnpjs, { log }))
      }
    }
    if (!extracoes.some((e) => e.linhas.length)) throw new Error('Nenhuma linha de demonstração extraída: layout da CVM mudou ou o mapeamento de CNPJ falhou.')
    const contabeis = agruparPorCnpj(extracoes)

    const saida = {}
    const excluidas = []
    const docsPorTicker = new Map()
    for (const e of empresas) {
      const cnpj = cnpjPorTicker.get(e.ticker)
      if (!cnpj) {
        excluidas.push({ ticker: e.ticker, motivo: 'Código sem CNPJ no FCA da CVM.' })
        continue
      }
      docsPorTicker.set(e.ticker, contabeis.get(cnpjDigitos(cnpj))?.docs ?? [])
      const r = montarBalancoDaEmpresa({ ticker: e.ticker, nome: e.nome, setor: e.setor, financeira: financeiros.has(e.setor), cnpj, c: contabeis.get(cnpjDigitos(cnpj)), dataCorte })
      if (r.erro) excluidas.push({ ticker: e.ticker, motivo: r.erro })
      else saida[e.ticker] = r.empresa
    }

    await completarComB3({ saida, docsPorTicker, dataCorte, fetchImpl, log })
    log(`  ${Object.keys(saida).length} empresas com balanço; ${excluidas.length} sem dado suficiente`)

    const resultado = {
      versao: VERSAO,
      geradoEm: agora.toISOString(),
      dataCorte,
      fonte: FONTE,
      _leia: 'Balanços trimestrais isolados por empresa, gerados por scripts/atualizar-balancos.mjs a partir da CVM. Valores em R$ mil; ausente é null. A data da próxima divulgação é ESTIMADA pelo histórico da empresa. Não editar à mão.',
      excluidas,
      empresas: saida,
    }
    const erros = verificarSanidadeBalancos(resultado)
    if (erros.length) throw new Error(`Balanços NÃO publicados:\n- ${erros.join('\n- ')}`)

    const arquivo = path.join(raiz, 'webapp-src', 'public', 'dados', 'balancos.json')
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    const conteudo = formatarBalancos(resultado)
    const atual = lerJson(arquivo, null)
    const semInstante = (o) => JSON.stringify({ ...o, geradoEm: null })
    if (atual && semInstante(atual) === semInstante(JSON.parse(conteudo))) {
      log('Sem mudança nos balanços: arquivo mantido.')
      return { publicado: false, empresas: Object.keys(saida).length }
    }
    fs.writeFileSync(arquivo, conteudo)
    log(`balancos.json gravado: ${Object.keys(saida).length} empresas.`)
    return { publicado: true, empresas: Object.keys(saida).length, excluidas }
  } finally {
    if (!dadosLocais) fs.rmSync(pastaTemp, { recursive: true, force: true })
  }
}

function argumento(nome) {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar({ dadosLocais: argumento('dados-locais') ? path.resolve(argumento('dados-locais')) : null }).catch((e) => {
    console.error(`[erro] ${e.message}`)
    process.exit(1)
  })
}
