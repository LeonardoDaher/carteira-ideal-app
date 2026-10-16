// Rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" (D70), com trilha de auditoria.
//
//   node scripts/atualizar-top15-mercado.mjs etfs
//   node scripts/atualizar-top15-mercado.mjs bdrs
//   (opcional: --data=AAAA-MM-DD para a data de execução)
//
// Sem rede: lê os históricos diários que os jobs de ETFs e BDRs já mantêm (historico/etfs.json e historico/bdrs.json,
// vindos do Boletim de Preços da B3). Pipeline:
//   1. monta os INSUMOS (séries recortadas, nomes, categorias, exclusões e desdobramentos confirmados);
//   2. calcula (scripts/top15-mercado-calculo.mjs, função pura);
//   3. grava a auditoria em auditoria/top15-<classe>/<data>/ (manifesto com sha256, insumos congelados, memória de
//      cálculo, CSVs); a verificação independente (top15-mercado-verificar.mjs) refaz o cálculo só com a pasta;
//   4. trava de sanidade; só então escreve os arquivos do app;
//   5. PUBLICAÇÃO só se config/top15-<classe>.json → publicacao.aprovadoPeloResponsavel === true.
//      ETFs: acesso aberto. BDRs: com código próprio (cabeçalho público sem nenhum ticker; lista em dados-privados/).

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLASSES_INDICE, calcularAcoes, calcularBdrs, calcularBdrsNegociados, calcularEtfs, calcularFiis, calcularIndice, canonico, hashDoResultado, numerosDeLiquidez, sha256, verificarSanidade } from './top15-mercado-calculo.mjs'
import { INDICES, baixarComposicao } from './b3-indices.mjs'
import { limparNome } from './atualizar-etfs.mjs'
import { criarFiltroBdr, nomeDe, setorDe } from './atualizar-bdrs.mjs'
import { executarCli } from './top15-mercado-verificar.mjs'
import { conferirEmMemoria, decidirModo, lerAuditoriaCompleta } from './auditoria-diaria.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ESQUEMA = 'top15-mercado/1'
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const gravarJson = (arquivo, obj) => fs.writeFileSync(arquivo, JSON.stringify(obj, null, 2) + '\n')
const gravarGz = (arquivo, obj) => fs.writeFileSync(arquivo, zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }))
const hashArquivo = (caminho) => crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex')

export const CLASSES = {
  etfs: {
    rotulo: 'ETFs mais negociados',
    pasta: 'top15-etfs',
    config: 'top15-etfs.json',
    historico: 'etfs.json',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'etfsMaisNegociados.json'),
    privado: null,
    calcular: calcularEtfs,
  },
  fiis: {
    rotulo: 'FIIs mais negociados',
    pasta: 'top15-fiis',
    config: 'top15-fiis.json',
    historico: 'fiis.json',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'fiisMaisNegociados.json'),
    privado: null,
    calcular: calcularFiis,
  },
  acoes: {
    rotulo: 'ações mais negociadas',
    pasta: 'top15-acoes',
    config: 'top15-acoes.json',
    historico: 'acoes.json',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'acoesMaisNegociadas.json'),
    privado: null,
    calcular: calcularAcoes,
  },
  'bdrs-negociados': {
    rotulo: 'BDRs mais negociados',
    pasta: 'top15-bdrs-negociados',
    config: 'top15-bdrs-negociados.json',
    historico: 'bdrs.json',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'bdrsMaisNegociados.json'),
    privado: null,
    calcular: calcularBdrsNegociados,
  },
  ifix: {
    rotulo: 'maiores pesos do IFIX',
    pasta: 'top15-ifix',
    config: 'top15-ifix.json',
    historico: 'fiis.json',
    indice: 'IFIX',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'ifixMaioresPesos.json'),
    privado: null,
    calcular: calcularIndice,
  },
  ibov: {
    rotulo: 'maiores pesos do Ibovespa',
    pasta: 'top15-ibov',
    config: 'top15-ibov.json',
    historico: 'acoes.json',
    indice: 'IBOV',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'ibovMaioresPesos.json'),
    privado: null,
    calcular: calcularIndice,
  },
  bdrs: {
    rotulo: 'BDRs com maior desconto de preço',
    pasta: 'top15-bdrs',
    config: 'top15-bdrs.json',
    historico: 'bdrs.json',
    snapshotApp: path.join('webapp-src', 'src', 'data', 'bdrsDesconto.json'),
    privado: path.join('dados-privados', 'bdr-desconto.json'),
    calcular: calcularBdrs,
  },
}

/** Remove, em qualquer nível, as chaves que começam com "_" (notas internas do config). */
export function semNotas(valor) {
  if (Array.isArray(valor)) return valor.map(semNotas)
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, semNotas(v)]))
  return valor
}

/** Recorta a série do ativo para as últimas `n` posições (alinhada à direita com `pregoes`). */
function recortar(serie, total, n) {
  const alinhada = serie.length >= total ? serie : [...new Array(total - serie.length).fill(null), ...serie]
  return alinhada.slice(total - n)
}

// ---------------------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------------------

export function montarInsumosEtfs({ historico, configEtfs, cfg, dataExecucao }) {
  const n = Math.min(cfg.pregoesNosInsumos, historico.pregoes.length)
  const pregoes = historico.pregoes.slice(-n)
  const ativos = Object.keys(historico.ativos).sort().map((ticker) => ({
    ticker,
    nome: limparNome(historico.nomes?.[ticker] ?? ticker, ticker, configEtfs.nomes ?? {}),
    categoria: configEtfs.categorias?.[ticker] ?? 'Outros',
    serie: recortar(historico.ativos[ticker], historico.pregoes.length, n),
  }))
  return { classe: 'etfs', dataExecucao, pregoes, ordemCategorias: configEtfs.ordemCategorias ?? [], excluidos: [...(configEtfs.excluir?.tickers ?? [])].sort(), ativos }
}

/** FIIs (D71): séries do histórico diário da B3 (historico/fiis.json); nome e segmento vêm do job de FIIs (rendimentosFii.json). */
export function montarInsumosFiis({ historico, fundos, cfg, dataExecucao }) {
  const n = Math.min(cfg.pregoesNosInsumos, historico.pregoes.length)
  const pregoes = historico.pregoes.slice(-n)
  const porTicker = new Map((fundos ?? []).map((f) => [f.ticker, f]))
  const ativos = Object.keys(historico.ativos).sort().map((ticker) => {
    const f = porTicker.get(ticker)
    return { ticker, nome: f?.nome ?? historico.nomes?.[ticker] ?? ticker, categoria: f?.setor ?? 'Outros', serie: recortar(historico.ativos[ticker], historico.pregoes.length, n) }
  })
  return { classe: 'fiis', dataExecucao, pregoes, ordemCategorias: cfg.ordemCategorias ?? [], excluidos: [], ativos }
}

/** Ações (D71): séries do histórico diário da B3 (historico/acoes.json); nome e setor vêm do job de ações (acoes.json, campo `busca`). */
export function montarInsumosAcoes({ historico, busca, setores, cfg, dataExecucao }) {
  const n = Math.min(cfg.pregoesNosInsumos, historico.pregoes.length)
  const pregoes = historico.pregoes.slice(-n)
  const porTicker = new Map((busca ?? []).map((a) => [a.ticker, a]))
  const ativos = Object.keys(historico.ativos).sort().map((ticker) => {
    const a = porTicker.get(ticker)
    return { ticker, nome: a?.nome ?? ticker, categoria: a?.setor ?? 'Outros', serie: recortar(historico.ativos[ticker], historico.pregoes.length, n) }
  })
  return { classe: 'acoes', dataExecucao, pregoes, ordemCategorias: (setores ?? []).map((s) => s.setor), excluidos: [], ativos }
}

/** BDRs mais negociados (D71): BDRs de ação (31 a 35) e de ETF (39), fora os de empresas brasileiras do config/bdrs.json (D19). */
export function montarInsumosBdrsNegociados({ historico, configBdrs, cfg, dataExecucao }) {
  const n = Math.min(cfg.pregoesNosInsumos, historico.pregoes.length)
  const pregoes = historico.pregoes.slice(-n)
  const filtro = criarFiltroBdr(historico.cadastro, configBdrs)
  const ativos = []
  for (const ticker of Object.keys(historico.ativos).sort()) {
    const tipo = filtro(ticker)
    if (!tipo) continue
    const cadastro = historico.cadastro?.[ticker]
    ativos.push({
      ticker,
      nome: nomeDe(ticker, cadastro, configBdrs) ?? ticker,
      categoria: tipo === 'etf' ? 'BDRs de ETF' : setorDe(ticker, 'acao', cadastro?.setorBrapi ?? null, configBdrs).setor,
      serie: recortar(historico.ativos[ticker], historico.pregoes.length, n),
    })
  }
  return { classe: 'bdrs-negociados', dataExecucao, pregoes, excluidos: [...(configBdrs.excluir?.tickers ?? [])].sort(), ativos }
}

/**
 * Índices (D72): a carteira teórica vem da B3 (já lida e validada por lerComposicao). Nome, setor/segmento, cotação e
 * volume vêm dos jobs e históricos do projeto e são INFORMATIVOS (o peso é o que ordena). `apoio` = { porTicker }:
 * ticker → { nome?, setor? }; o histórico diário (B3) dá cotação, data e volume mediano dos últimos pregões.
 */
export function montarInsumosIndice({ classe, composicao, historico, apoio, cfg, dataExecucao }) {
  const pregoes = historico.pregoes
  const mercado = {}
  const componentes = composicao.componentes.map((c) => {
    const serie = historico.ativos?.[c.ticker]
    if (serie?.length) {
      const alinhada = serie.length >= pregoes.length ? serie.slice(serie.length - pregoes.length) : [...new Array(pregoes.length - serie.length).fill(null), ...serie]
      const n = numerosDeLiquidez(alinhada, pregoes, cfg.janelaLiquidez)
      if (n.ultimo !== -1) mercado[c.ticker] = { cotacao: n.cotacao, dataCotacao: n.dataCotacao, volumeMediano: n.volumeMediano }
    }
    const a = apoio?.porTicker?.get(c.ticker)
    return { ticker: c.ticker, nome: classe === 'ibov' ? (a?.nome ?? c.nome) : c.nome, tipo: c.tipo, setor: a?.setor ?? null, peso: c.peso, quantidadeTeorica: c.quantidadeTeorica }
  })
  return { classe, indice: CLASSES[classe].indice, dataExecucao, dataComposicao: composicao.data, componentes, mercado }
}

export function montarInsumosBdrs({ historico, configBdrs, cfg, dataExecucao }) {
  const n = Math.min(cfg.janelaMaxima + 1, historico.pregoes.length)
  const pregoes = historico.pregoes.slice(-n)
  const filtro = criarFiltroBdr(historico.cadastro, configBdrs)
  const ativos = Object.keys(historico.ativos).sort().filter((t) => filtro(t) === 'acao').map((ticker) => {
    const cadastro = historico.cadastro?.[ticker]
    return {
      ticker,
      nome: nomeDe(ticker, cadastro, configBdrs) ?? ticker,
      setor: setorDe(ticker, 'acao', cadastro?.setorBrapi ?? null, configBdrs).setor,
      acoesPorBdr: cadastro?.acoesPorBdr ?? null,
      desdobramentos: (configBdrs.desdobramentos?.[ticker] ?? []).map((e) => ({ data: e.data, fator: e.fator })),
      serie: recortar(historico.ativos[ticker], historico.pregoes.length, n),
    }
  })
  return { classe: 'bdrs', dataExecucao, pregoes, excluidos: [...(configBdrs.excluir?.tickers ?? [])].sort(), ativos }
}

// ---------------------------------------------------------------------------------------
// CSVs
// ---------------------------------------------------------------------------------------

const celula = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const csv = (colunas, linhas) => '﻿' + [colunas.join(';'), ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(';'))].join('\n') + '\n'

const COLUNAS_ETF = ['posicaoGeral', 'ticker', 'nome', 'categoria', 'volumeMediano', 'volumeMedio', 'diasNegociados', 'cotacao', 'dataCotacao', 'variacao3m']
const COLUNAS_BDR = ['posicao', 'ticker', 'nome', 'setor', 'desconto', 'cotacao', 'maximaFechamento12m', 'dataMaxima', 'variacao3m', 'volumeMediano', 'diasNegociados', 'pregoesComDado', 'alertas']
const COLUNAS_EXC = ['ticker', 'nome', 'codigo', 'motivo']

const COLUNAS_INDICE = ['posicao', 'ticker', 'nome', 'tipo', 'setor', 'peso', 'pesoAcumulado', 'quantidadeTeorica', 'cotacao', 'dataCotacao', 'volumeMediano']

export function arquivosCsv(classe, resultado) {
  if (CLASSES_INDICE.includes(classe)) return { 'ranking.csv': csv(COLUNAS_INDICE, resultado.ranking) }
  if (classe !== 'bdrs') {
    const porCat = Object.entries(resultado.porCategoria).flatMap(([, l]) => l)
    return {
      'ranking-geral.csv': csv(COLUNAS_ETF, resultado.geral),
      'ranking-por-categoria.csv': csv(['posicaoNaCategoria', ...COLUNAS_ETF], porCat),
      'exclusoes.csv': csv(COLUNAS_EXC, resultado.exclusoes),
    }
  }
  const comAlertas = (l) => l.map((x) => ({ ...x, alertas: (x.alertas ?? []).join(',') }))
  return {
    'ranking.csv': csv(COLUNAS_BDR, comAlertas(resultado.ranking)),
    'a-conferir.csv': csv(COLUNAS_BDR, comAlertas(resultado.aConferir)),
    'exclusoes.csv': csv(COLUNAS_EXC, resultado.exclusoes),
  }
}

function leiaMe(classe, rel, versao, ultimoPregao) {
  const c = CLASSES[classe]
  return `# Auditoria: ${c.rotulo} (${rel})

Execução com preços até o pregão de **${ultimoPregao}** · metodologia **v${versao}**. Fonte: Boletim de Preços da B3 (BVBG.086), guardado em \`historico/${c.historico}\`.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| \`manifesto.json\` | Origem dos dados, hashes da config, dos insumos, do resultado e do código de cálculo |
| \`config.json\` | Cópia exata dos parâmetros usados |
| \`insumos.json.gz\` | Séries de fechamento, mínima, máxima e volume por ativo, exatamente como entraram no cálculo |
| \`resultado.json\` | O ranking, os alertas e as exclusões (o que o hash do resultado cobre) |
| \`memoria-de-calculo.json.gz\` | Para cada ativo da lista: a fórmula, a janela de pregões e o volume de cada dia |
| \`*.csv\` | As mesmas informações, abertas em planilha |

## Como refazer o cálculo e conferir

\`\`\`
node scripts/top15-mercado-verificar.mjs ${rel}
\`\`\`

O comando recalcula o resultado só com \`insumos.json.gz\` + \`config.json\` e compara com o hash do manifesto. Sem internet. Roteiro completo: \`docs/11-metodologia-top15-etfs-bdrs.md\`.
`
}

// ---------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------

export function executar({ classe, raiz = RAIZ_PADRAO, hoje = null, log = console.log, diaria = false, forcarCompleta = false } = {}) {
  const c = CLASSES[classe]
  if (!c) throw new Error(`Classe inválida. Use: ${Object.keys(CLASSES).join(', ')}.`)
  const cfg = lerJson(path.join(raiz, 'config', c.config))
  const arquivoHist = path.join(raiz, 'historico', c.historico)
  if (!fs.existsSync(arquivoHist)) throw new Error(`historico/${c.historico} não existe: rode antes a carga inicial.`)
  const historico = lerJson(arquivoHist)
  if (!historico.pregoes?.length) throw new Error(`historico/${c.historico} sem pregões.`)
  const dataExecucao = hoje ?? new Date().toISOString().slice(0, 10)
  log(`${c.rotulo}: histórico com ${historico.pregoes.length} pregões, último de ${historico.pregoes.at(-1)} · execução em ${dataExecucao}`)
  const fontes = [{ papel: `Histórico diário (B3, Boletim de Preços BVBG.086)`, url: `historico/${c.historico} (neste repositório)`, arquivo: c.historico, bytes: fs.statSync(arquivoHist).size, sha256: hashArquivo(arquivoHist), pregoes: historico.pregoes.length, ultimoPregao: historico.pregoes.at(-1) }]
  const fonteExtra = (papel, relativo) => {
    const arquivo = path.join(raiz, ...relativo.split('/'))
    fontes.push({ papel, url: `${relativo} (neste repositório)`, arquivo: path.basename(arquivo), bytes: fs.statSync(arquivo).size, sha256: hashArquivo(arquivo) })
    return lerJson(arquivo)
  }
  let insumos
  if (classe === 'etfs') insumos = montarInsumosEtfs({ historico, configEtfs: lerJson(path.join(raiz, 'config', 'etfs.json')), cfg, dataExecucao })
  else if (classe === 'fiis') insumos = montarInsumosFiis({ historico, fundos: fonteExtra('Nome e segmento dos FIIs (job de FIIs)', 'webapp-src/src/data/rendimentosFii.json').fundos, cfg, dataExecucao })
  else if (classe === 'acoes') {
    const acoes = fonteExtra('Nome e setor das ações (job de ações)', 'webapp-src/src/data/acoes.json')
    insumos = montarInsumosAcoes({ historico, busca: acoes.busca, setores: acoes.setores, cfg, dataExecucao })
  } else if (classe === 'bdrs-negociados') insumos = montarInsumosBdrsNegociados({ historico, configBdrs: lerJson(path.join(raiz, 'config', 'bdrs.json')), cfg, dataExecucao })
  else insumos = montarInsumosBdrs({ historico, configBdrs: lerJson(path.join(raiz, 'config', 'bdrs.json')), cfg, dataExecucao })
  return concluir({ raiz, classe, cfg, insumos, fontes, log, diaria, forcarCompleta })
}

/**
 * Índices (IFIX e Ibovespa): baixa a carteira do dia na B3 (a ÚNICA etapa com rede) e monta o ranking. O sha256 e o endereço
 * da resposta bruta entram no manifesto; a verificação independente usa só a tabela gravada nos insumos.
 * `composicaoLocal` (testes) substitui o download.
 */
export async function executarIndice({ classe, raiz = RAIZ_PADRAO, hoje = null, log = console.log, fetchImpl = fetch, composicaoLocal = null, diaria = false, forcarCompleta = false } = {}) {
  const c = CLASSES[classe]
  if (!c || !CLASSES_INDICE.includes(classe)) throw new Error(`Classe de índice inválida. Use: ${CLASSES_INDICE.join(', ')}.`)
  const cfg = lerJson(path.join(raiz, 'config', c.config))
  const arquivoHist = path.join(raiz, 'historico', c.historico)
  if (!fs.existsSync(arquivoHist)) throw new Error(`historico/${c.historico} não existe: rode antes a carga inicial.`)
  const historico = lerJson(arquivoHist)
  const dataExecucao = hoje ?? new Date().toISOString().slice(0, 10)
  const composicao = composicaoLocal ?? (await baixarComposicao(c.indice, { fetchImpl }))
  log(`${c.rotulo}: carteira da B3 de ${composicao.data} com ${composicao.componentes.length} ativos · execução em ${dataExecucao}`)
  const fontes = [
    { papel: `Carteira teórica do ${INDICES[c.indice].nome} (B3, indexProxy/GetPortfolioDay)`, url: composicao.url ?? 'composicao fornecida localmente', sha256: composicao.sha256 ?? null, bytes: composicao.bytes ?? null, baixadoEm: composicao.baixadoEm ?? null, dataDaCarteira: composicao.data },
    { papel: 'Histórico diário (B3, Boletim de Preços BVBG.086): cotação e volume (informativos)', url: `historico/${c.historico} (neste repositório)`, arquivo: c.historico, bytes: fs.statSync(arquivoHist).size, sha256: hashArquivo(arquivoHist), ultimoPregao: historico.pregoes.at(-1) },
  ]
  const porTicker = new Map()
  if (classe === 'ibov') {
    const arq = path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json')
    for (const a of lerJson(arq).busca ?? []) porTicker.set(a.ticker, { nome: a.nome, setor: a.setor })
    fontes.push({ papel: 'Nome e setor das ações (job de ações)', url: 'webapp-src/src/data/acoes.json (neste repositório)', arquivo: 'acoes.json', bytes: fs.statSync(arq).size, sha256: hashArquivo(arq) })
  } else {
    const arq = path.join(raiz, 'webapp-src', 'src', 'data', 'rendimentosFii.json')
    for (const f of lerJson(arq).fundos ?? []) porTicker.set(f.ticker, { setor: f.setor })
    fontes.push({ papel: 'Segmento dos FIIs (job de FIIs)', url: 'webapp-src/src/data/rendimentosFii.json (neste repositório)', arquivo: 'rendimentosFii.json', bytes: fs.statSync(arq).size, sha256: hashArquivo(arq) })
  }
  const insumos = montarInsumosIndice({ classe, composicao, historico, apoio: { porTicker }, cfg, dataExecucao })
  return concluir({ raiz, classe, cfg, insumos, fontes, log, diaria, forcarCompleta })
}

/** Calcula e grava a auditoria e o app. Separado para os testes poderem alimentar insumos prontos. */
export function concluir({ raiz, classe, cfg, insumos, fontes = [], log = console.log, agora = new Date(), diaria = false, forcarCompleta = false }) {
  const c = CLASSES[classe]
  const { resultado, memoria } = c.calcular(insumos, cfg)
  const hashes = { config: sha256(canonico(cfg)), insumos: sha256(canonico(insumos)), resultado: hashDoResultado(resultado), memoria: sha256(canonico(memoria)) }

  // D89: com `diaria`, só a primeira execução do mês (ou uma mudança de parâmetros/código) grava a pasta de auditoria.
  let modo = 'completa'
  let anteriorCompleta = null
  if (diaria) {
    const { ultima, manifesto: manifestoCompleta } = lerAuditoriaCompleta(raiz, c.pasta)
    const decisao = decidirModo({ ultima, manifesto: manifestoCompleta, hoje: insumos.dataExecucao, hashConfig: hashes.config, calculoSha256: hashArquivo(path.join(raiz, 'scripts', 'top15-mercado-calculo.mjs')), forcarCompleta })
    log(`Auditoria: ${decisao.modo === 'completa' ? 'COMPLETA' : 'diária (recalcula e confere, sem pasta nova)'} · ${decisao.motivo}`)
    if (decisao.modo === 'diaria') { modo = 'diaria'; anteriorCompleta = ultima }
  }

  const rel = path.join('auditoria', c.pasta, insumos.dataExecucao)
  const pasta = path.join(raiz, rel)
  const relPosix = modo === 'diaria' ? anteriorCompleta.pasta : rel.replace(/\\/g, '/')
  const anterior = modo === 'completa' && fs.existsSync(path.join(pasta, 'manifesto.json')) ? lerJson(path.join(pasta, 'manifesto.json')) : null
  const inalterado = anterior && anterior.hashes.insumos === hashes.insumos && anterior.hashes.resultado === hashes.resultado && anterior.hashes.config === hashes.config
  if (modo === 'diaria') {
    const problemas = conferirEmMemoria({ calcular: c.calcular, canonico, sha256, hashDoResultado, insumos, cfg, hashes })
    if (problemas.length) throw new Error(`Conferência independente falhou: ${problemas.join('; ')}. Nada foi publicado.`)
    log('Conferência independente: OK (insumos e config relidos, cálculo refeito do zero, hash do resultado confere).')
  } else if (inalterado) {
    log('Sem mudança em relação à auditoria já gravada para esta data (mesmos insumos, config e resultado).')
  } else {
    fs.mkdirSync(pasta, { recursive: true })
    gravarGz(path.join(pasta, 'insumos.json.gz'), insumos)
    gravarJson(path.join(pasta, 'config.json'), cfg)
    gravarJson(path.join(pasta, 'resultado.json'), resultado)
    gravarGz(path.join(pasta, 'memoria-de-calculo.json.gz'), memoria)
    const csvs = arquivosCsv(classe, resultado)
    for (const [nome, conteudo] of Object.entries(csvs)) fs.writeFileSync(path.join(pasta, nome), conteudo)
    fs.writeFileSync(path.join(pasta, 'LEIA-ME.md'), leiaMe(classe, relPosix, cfg.versaoMetodologia, resultado.ultimoPregao))
    const arquivosHash = {}
    for (const a of ['insumos.json.gz', 'config.json', 'resultado.json', 'memoria-de-calculo.json.gz', ...Object.keys(csvs)]) arquivosHash[a] = hashArquivo(path.join(pasta, a))
    gravarJson(path.join(pasta, 'manifesto.json'), {
      esquema: ESQUEMA,
      classe,
      versaoMetodologia: cfg.versaoMetodologia,
      geradoEm: agora.toISOString(),
      dataExecucao: insumos.dataExecucao,
      ultimoPregao: resultado.ultimoPregao,
      ambiente: { node: process.version, plataforma: process.platform, commit: process.env.GITHUB_SHA ?? null, execucao: process.env.GITHUB_RUN_ID ?? null },
      codigo: { calculoSha256: hashArquivo(path.join(raiz, 'scripts', 'top15-mercado-calculo.mjs')), extracaoSha256: hashArquivo(path.join(raiz, 'scripts', 'atualizar-top15-mercado.mjs')) },
      hashes: { ...hashes, arquivos: arquivosHash },
      fontes,
      contagens: { universo: resultado.universo, elegiveis: resultado.elegiveis, exclusoes: resultado.exclusoes.length, ...(classe === 'bdrs' ? { aConferir: resultado.aConferir.length } : {}) },
      publicadoNoApp: cfg.publicacao?.aprovadoPeloResponsavel === true,
    })
    gravarJson(path.join(raiz, 'auditoria', c.pasta, 'ultima.json'), { pasta: relPosix, dataExecucao: insumos.dataExecucao, hashResultado: hashes.resultado, versaoMetodologia: cfg.versaoMetodologia })
  }

  const lista = resultado.geral ?? resultado.ranking
  log(`Universo ${resultado.universo} · elegíveis ${resultado.elegiveis} · fora ${resultado.exclusoes.length}${classe === 'bdrs' ? ` · a conferir ${resultado.aConferir.length}` : ''}`)
  log(`Top ${cfg.tamanhoDaLista}: ${lista.map((r) => r.ticker).join(' ')}`)
  if (classe === 'bdrs') log(`A conferir (fora do ranking): ${resultado.aConferir.map((f) => `${f.ticker}[${f.alertas.join(',')}]`).join(' ') || 'nenhum'}`)

  // Trava de sanidade ANTES de tocar no app.
  const problemas = verificarSanidade(resultado, cfg.publicacao)
  if (problemas.length) throw new Error(`Resultado barrado pela trava de sanidade: ${problemas.join('; ')}. ${modo === 'diaria' ? 'Nenhuma pasta foi gravada' : `A auditoria foi gravada em ${relPosix} para diagnóstico`}; o app não foi alterado.`)

  const publicado = cfg.publicacao?.aprovadoPeloResponsavel === true
  // Na execução diária não há manifesto novo: o do dia leva a impressão digital de hoje e aponta para a pasta completa do mês.
  let manifesto
  if (modo === 'diaria') manifesto = { geradoEm: agora.toISOString(), hashes }
  else {
    manifesto = lerJson(path.join(pasta, 'manifesto.json'))
    if (manifesto.publicadoNoApp !== publicado) gravarJson(path.join(pasta, 'manifesto.json'), { ...manifesto, publicadoNoApp: publicado })
  }
  const snapshot = { ...montarSnapshotApp({ classe, resultado, cfg, manifesto, pasta: relPosix, publicado }), modoAuditoria: modo, auditoriaCompletaEm: path.posix.basename(relPosix) }
  const { publico, privado } = separarSnapshot(classe, snapshot)
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  gravarJson(path.join(raiz, c.snapshotApp), publico)
  if (c.privado) {
    fs.mkdirSync(path.join(raiz, 'dados-privados'), { recursive: true })
    gravarJson(path.join(raiz, c.privado), privado)
  }
  log(publicado ? (snapshot.acessoRestrito ? 'App: ranking PUBLICADO com acesso por código (lista em dados-privados/).' : 'App: ranking PUBLICADO (acesso aberto).') : `App: ranking NÃO publicado (aprovadoPeloResponsavel = false).${modo === 'diaria' ? '' : ' A auditoria completa foi gravada.'}`)
  return { resultado, hashes, pasta: modo === 'diaria' ? path.join(raiz, relPosix) : pasta, publicado, modo }
}

/** O que o app lê. Sem aprovação do responsável, vai só o cabeçalho (o app mostra "em validação"). */
export function montarSnapshotApp({ classe, resultado, cfg, manifesto, pasta, publicado }) {
  const acesso = cfg.publicacao?.acesso ?? {}
  const base = {
    publicado,
    acessoRestrito: acesso.restritoPorCodigo === true,
    instagram: acesso.instagram ?? null,
    versaoMetodologia: cfg.versaoMetodologia,
    geradoEm: manifesto.geradoEm,
    dataExecucao: resultado.dataExecucao,
    ultimoPregao: resultado.ultimoPregao,
    pastaAuditoria: pasta,
    hashResultado: manifesto.hashes.resultado,
    hashInsumos: manifesto.hashes.insumos,
    hashConfig: manifesto.hashes.config,
    tamanhoDaLista: cfg.tamanhoDaLista,
    universo: resultado.universo,
    elegiveis: resultado.elegiveis,
    aviso: cfg.publicacao?.aviso ?? cfg.publicacao?.avisoProposto ?? null,
  }
  // Sem os campos "_leia" (notas internas): o cabeçalho público não pode trazer código de ativo.
  const { publicacao, historicoDeVersoes, versaoMetodologia, ...parametros } = cfg
  void publicacao; void historicoDeVersoes; void versaoMetodologia
  if (CLASSES_INDICE.includes(classe)) {
    return {
      ...base,
      parametros: { ...semNotas(parametros), idadeMaximaDias: cfg.publicacao?.sanidade?.idadeMaximaDias ?? null },
      indice: resultado.indice,
      dataComposicao: resultado.dataComposicao,
      somaPesos: resultado.somaPesos,
      somaPesosDaLista: resultado.somaPesosDaLista,
      ranking: publicado ? resultado.ranking : [],
    }
  }
  if (classe !== 'bdrs') {
    return { ...base, parametros: semNotas(parametros), geral: publicado ? resultado.geral : [], porCategoria: publicado ? resultado.porCategoria : {}, exclusoes: publicado ? resultado.exclusoes : [] }
  }
  return {
    ...base,
    parametros: semNotas(parametros),
    contagens: { ranking: resultado.ranking.length, aConferir: resultado.aConferir.length, exclusoes: resultado.exclusoes.length },
    ranking: publicado ? resultado.ranking : [],
    aConferir: publicado ? resultado.aConferir : [],
    exclusoes: publicado ? resultado.exclusoes : [],
  }
}

/**
 * ETFs: acesso aberto, o arquivo do app leva tudo. BDRs com acesso por código: o arquivo do app traz SÓ o cabeçalho e a
 * lista completa vai para dados-privados/ (lida só por api/top15-bdrs.ts depois de conferir o código).
 */
export function separarSnapshot(classe, completo) {
  if (classe !== 'bdrs' || !completo.acessoRestrito) return { publico: completo, privado: { publicado: false } }
  const publico = { ...completo, ranking: [], aConferir: [], exclusoes: [] }
  return { publico, privado: completo.publicado ? completo : { publicado: false } }
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const classe = process.argv[2]
    const data = process.argv.find((x) => x.startsWith('--data='))?.slice(7) ?? null
    if (process.argv.includes('--verificar')) process.exit(executarCli(classe))
    // D89: por padrão a execução é "diária" (grava a pasta de auditoria só na primeira do mês); --completa força a pasta.
    const opcoes = { classe, hoje: data, diaria: true, forcarCompleta: process.argv.includes('--completa') }
    if (CLASSES_INDICE.includes(classe)) await executarIndice(opcoes)
    else executar(opcoes)
    process.exit(executarCli('ultima', classe))
  } catch (e) {
    console.error(`ERRO: ${e.message}`)
    process.exit(1)
  }
}
