// Fundamentos das empresas para a aba "Análise fundamentalista" do Simule Ações (D119).
//
//   node scripts/atualizar-fundamentos.mjs                       baixa as demonstrações da CVM e grava o arquivo do app
//   node scripts/atualizar-fundamentos.mjs --dados-locais=PASTA  usa zips já baixados (offline; também guarda os baixados)
//
// Baixa DFP (6 anos) e ITR (2 anos) da CVM, liga código de negociação a CNPJ pelo FCA (mesmas regras e correções manuais do Top 15)
// e grava webapp-src/public/dados/fundamentos.json: para cada empresa do cadastro, os últimos 5 exercícios e os últimos 12 meses em
// R$ mil, mais a quantidade de ações por classe. O preço do dia, os múltiplos e a nota são calculados no app.
//
// NÃO mexe no pipeline auditado do Top 15 (acoes-baratas-*.mjs): só importa funções dele. Se algo estiver errado (layout da CVM, poucas
// empresas com dado), o job termina com erro SEM alterar o arquivo: o app continua com a última versão boa.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { agruparPorCnpj, empresasDoCadastro, extrairPreco, mesclarDesdobramentos } from './atualizar-acoes-baratas.mjs'
import {
  baixar, cnpjDigitos, dividirLinha, fatorEscala, indiceDasColunas, linhasDoZip, listarZip, mapaTickerCnpj, numeroCvm, resolverCnpjs,
  urlDemonstracoes, urlFca,
} from './acoes-baratas-cvm.mjs'
import { semAcento } from './acoes-baratas-calculo.mjs'
import { guardaLinha, montarEmpresa } from './fundamentos-calculo.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const VERSAO = '1.0.0'
export const FONTE = 'CVM - Dados abertos (DFP e ITR de companhias abertas)'

const ARQ_PRINCIPAL = /^(dfp|itr)_cia_aberta_\d{4}\.csv$/i
const ARQ_DEMONSTRACAO = /_(DRE|BPA|BPP|DVA)_(con|ind)_\d{4}\.csv$/i
const ARQ_DFC = /_DFC_(MD|MI)_(con|ind)_\d{4}\.csv$/i
const ARQ_CAPITAL = /composicao_capital/i

const lerJson = (arquivo, padrao = null) => {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

// ---------------------------------------------------------------------------------------
// Extração (mesmo formato do extrairZip do Top 15, com as contas e prefixos desta análise)
// ---------------------------------------------------------------------------------------

/** Lê um zip DFP ou ITR e devolve { docs, linhas, capital } só das empresas em `cnpjs` (Set de CNPJ só com dígitos). */
export async function extrairParaFundamentos(zip, tipo, cnpjs, { log = () => {} } = {}) {
  const entradas = listarZip(zip)
  const nomeBase = (e) => path.basename(e)
  const principal = entradas.find((e) => ARQ_PRINCIPAL.test(nomeBase(e)))
  if (!principal) throw new Error(`${zip}: arquivo principal ${tipo.toLowerCase()}_cia_aberta_AAAA.csv não encontrado.`)

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

  const linhas = []
  let lidas = 0
  for (const entrada of entradas) {
    const nome = nomeBase(entrada)
    let m = nome.match(ARQ_DEMONSTRACAO)
    let dem = m?.[1]?.toUpperCase()
    let cons = m?.[2]?.toLowerCase()
    if (!m) {
      m = nome.match(ARQ_DFC)
      if (m) {
        dem = 'DFC'
        cons = m[2].toLowerCase()
      }
    }
    if (!m) continue
    const flui = dem !== 'BPA' && dem !== 'BPP'
    let i
    for await (const l of linhasDoZip(zip, entrada)) {
      if (!i) {
        i = indiceDasColunas(l, { cnpj: 'CNPJ_CIA', dtRefer: 'DT_REFER', versao: 'VERSAO', moeda: 'MOEDA', escala: 'ESCALA_MOEDA', ordem: 'ORDEM_EXERC', dtFim: 'DT_FIM_EXERC', cd: 'CD_CONTA', ds: 'DS_CONTA', valor: 'VL_CONTA', ...(flui ? { dtIni: 'DT_INI_EXERC' } : {}) }, nome)
        continue
      }
      lidas++
      const c = dividirLinha(l)
      const cd = c[i.cd]
      if (!guardaLinha(dem, cd)) continue
      const cnpj = cnpjDigitos(c[i.cnpj])
      if (!cnpjs.has(cnpj)) continue
      const vigente = versaoVigente.get(`${cnpj}|${c[i.dtRefer]}`)
      if (vigente === undefined || Number(c[i.versao]) !== vigente) continue
      if (semAcento(c[i.moeda]).trim() !== 'real') continue
      const valor = numeroCvm(c[i.valor])
      if (valor === null) continue
      const ordem = semAcento(c[i.ordem]).includes('penultimo') ? 'PENULTIMO' : 'ULTIMO'
      linhas.push({
        cnpj, doc: tipo, dtRefer: c[i.dtRefer], versao: vigente, dem, cons, ordem,
        dtIni: flui ? c[i.dtIni] || null : null, dtFim: c[i.dtFim], cd, ds: c[i.ds].trim(),
        valor: valor * fatorEscala(c[i.escala]), linkDoc: linkPor.get(`${cnpj}|${c[i.dtRefer]}`) ?? null,
      })
    }
  }

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
  }
  log(`  ${path.basename(zip)}: ${docs.length} documentos, ${linhas.length} linhas guardadas de ${lidas} lidas, ${capital.length} registros de capital`)
  return { docs, linhas, capital }
}

// ---------------------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------------------

/** fundamentos.json legível no GitHub: uma empresa por linha. */
export function formatarFundamentos(saida) {
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

export async function executar({
  raiz = RAIZ_PADRAO,
  dadosLocais = null,
  agora = new Date(),
  log = console.log,
  fetchImpl = fetch,
  minimoEmpresas = 100,
} = {}) {
  const cfg = lerJson(path.join(raiz, 'config', 'acoes-baratas.json'))
  const configAcoes = lerJson(path.join(raiz, 'config', 'acoes.json'))
  const historico = lerJson(path.join(raiz, 'historico', 'acoes.json'))
  const manualCnpj = lerJson(path.join(raiz, 'config', 'acoes-baratas-cnpj.json'), {})
  delete manualCnpj._leia
  delete manualCnpj._fontes
  if (!historico?.pregoes?.length) throw new Error('historico/acoes.json vazio: rode antes a carga inicial de Ações.')

  const dataPrecos = historico.pregoes.at(-1)
  const dataCorte = dataPrecos
  const ano = Number(dataCorte.slice(0, 4))
  const empresas = empresasDoCadastro(configAcoes, { incluirExtras: true })
  const financeiros = new Set(cfg.universo?.setoresExcluidos ?? [])
  log(`Fundamentos: ${empresas.length} empresas no cadastro · preços de ${dataPrecos}`)

  const pastaTemp = dadosLocais ?? fs.mkdtempSync(path.join(os.tmpdir(), 'fundamentos-'))
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
    const mapaFca = await mapaTickerCnpj(zipsFca)
    const mapeamento = resolverCnpjs(empresas.map((e) => e.ticker), mapaFca, manualCnpj)
    const cnpjPorTicker = new Map(mapeamento.map((m) => [m.ticker, m.cnpj]))
    const cnpjs = new Set(mapeamento.filter((m) => m.cnpj).map((m) => cnpjDigitos(m.cnpj)))
    log(`  CNPJ resolvido para ${cnpjs.size} de ${empresas.length} empresas`)

    const extracoes = []
    for (const [tipo, anos] of [['DFP', Array.from({ length: 6 }, (_, k) => ano - 5 + k)], ['ITR', [ano - 1, ano]]]) {
      for (const a of anos) {
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

    const configPrecos = { ...configAcoes, desdobramentos: mesclarDesdobramentos(configAcoes.desdobramentos, cfg.desdobramentos) }
    const saida = {}
    const excluidas = []
    for (const e of empresas) {
      const cnpj = cnpjPorTicker.get(e.ticker)
      if (!cnpj) {
        excluidas.push({ ticker: e.ticker, etapa: 'sem_cnpj', motivo: 'Código sem CNPJ no FCA da CVM.' })
        continue
      }
      const preco = extrairPreco(historico, e.ticker, configPrecos, cfg)
      if (!preco.ref) {
        excluidas.push({ ticker: e.ticker, etapa: 'sem_preco', motivo: preco.motivoSemPreco })
        continue
      }
      const r = montarEmpresa({
        ticker: e.ticker, nome: e.nome, setor: e.setor, financeira: financeiros.has(e.setor), cnpj, c: contabeis.get(cnpjDigitos(cnpj)),
        preco, cfg, dataCorte, desdobramentos: configPrecos.desdobramentos?.[e.ticker] ?? [],
      })
      if (r.erro) excluidas.push({ ticker: e.ticker, etapa: r.etapa, motivo: r.erro })
      else saida[e.ticker] = e.extra ? { ...r.empresa, extra: true } : r.empresa
    }

    const publicadas = Object.keys(saida).length
    log(`  ${publicadas} empresas com fundamentos; ${excluidas.length} sem dado suficiente`)
    for (const x of excluidas) log(`  [fora] ${x.ticker}: ${x.etapa} — ${x.motivo}`)
    if (publicadas < minimoEmpresas) throw new Error(`Só ${publicadas} empresas com fundamentos (mínimo ${minimoEmpresas}). Arquivo NÃO atualizado.`)

    const arquivo = path.join(raiz, 'webapp-src', 'public', 'dados', 'fundamentos.json')
    fs.mkdirSync(path.dirname(arquivo), { recursive: true })
    const conteudo = formatarFundamentos({
      versao: VERSAO,
      geradoEm: agora.toISOString(),
      dataCorte,
      fonte: FONTE,
      _leia: 'Fundamentos por empresa (D119), gerados por scripts/atualizar-fundamentos.mjs a partir da CVM. Valores em R$ mil; ações em unidades. Valor ausente é null. Não editar à mão.',
      excluidas,
      empresas: saida,
    })
    // Sem mudança nos dados (só o instante de geração): mantém o arquivo e evita commit à toa.
    const atual = lerJson(arquivo, null)
    const semInstante = (o) => JSON.stringify({ ...o, geradoEm: null })
    if (atual && semInstante(atual) === semInstante(JSON.parse(conteudo))) {
      log('Sem mudança nos fundamentos: arquivo mantido.')
      return { publicado: false, empresas: publicadas }
    }
    fs.writeFileSync(arquivo, conteudo)
    log(`fundamentos.json gravado: ${publicadas} empresas.`)
    return { publicado: true, empresas: publicadas, excluidas }
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
