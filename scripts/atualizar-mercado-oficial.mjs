// Atualização semanal dos dados oficiais de mercado (decisão D15).
//
// Roda uma vez por semana pelo GitHub Actions (.github/workflows/atualizar-mercado-oficial.yml)
// ou manualmente com:  node scripts/atualizar-mercado-oficial.mjs
// Não precisa de chave: as duas fontes são públicas e gratuitas.
//
// O que faz:
//   1. Busca no SGS do Banco Central os indicadores de config/mercado-oficial.json
//      (Selic meta, CDI, IPCA do mês, IPCA 12 meses, dólar PTAX): último valor e o anterior.
//   2. Baixa do Tesouro Transparente o arquivo de preços e taxas do Tesouro Direto e guarda
//      só a data-base mais recente: cada título com taxa e preço de compra e de venda,
//      indexador, tipo de cupom e se está à venda (PU de compra > 0).
//   3. Calcula o juro real ex-post (Selic meta descontada do IPCA 12 meses), como referência
//      de cenário para a revisão das carteiras-modelo.
//   4. Confere o conteúdo educacional (analises/tesouro*.ts) e avisa no log quando um título
//      citado no texto não está mais à venda. Só avisa: não altera o texto nem falha.
//   5. Busca o histórico da Selic meta (só os pontos de mudança) e do IPCA 12 meses desde
//      1999, em janelas de até 10 anos (limite do SGS), para o gráfico da tela.
//   6. Busca no Boletim Focus a mediana de IPCA e Selic por ano (premissa do simulador).
//   7. Grava webapp-src/src/data/mercadoOficial.json.
//
// Regras de segurança (mesmo espírito do script de FIIs): se qualquer indicador vier fora da
// faixa plausível ou velho demais, se o arquivo do Tesouro estiver defasado, se faltar algum
// dos três indexadores principais à venda ou se houver poucos títulos à venda, o script
// termina com erro SEM gravar o arquivo. O app continua com os dados da semana anterior.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { acharColuna, lerCsv, lerNumero } from './atualizar-rendimentos-fii.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CAMINHO_CONFIG = path.join('config', 'mercado-oficial.json')
const CAMINHO_SAIDA = path.join('webapp-src', 'src', 'data', 'mercadoOficial.json')
// Consulta por período (indicadores e histórico). Datas dd/mm/aaaa, até 10 anos (limite do SGS
// desde 26/03/2025). Os indicadores também usam período, terminando hoje, e não "últimos N":
// a Selic meta (432) vem preenchida até a véspera da próxima reunião do Copom, com datas no
// futuro, e "últimos N" devolveria essas datas.
const URL_SGS_PERIODO = (codigo, inicio, fim) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${inicio}&dataFinal=${fim}`
// Boletim Focus: projeções anuais, só a data de coleta mais recente interessa.
const URL_FOCUS = (indicador) =>
  'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais' +
  `?$filter=${encodeURIComponent(`Indicador eq '${indicador}' and baseCalculo eq 0`)}` +
  `&$orderby=${encodeURIComponent('Data desc')}&$top=60` +
  '&$select=Indicador,Data,DataReferencia,Mediana,baseCalculo&$format=json'
const TENTATIVAS = 4
const TIMEOUT_MS = 60_000
// Quantos dias para trás buscar cada indicador (o último valor até hoje fica dentro disso).
const JANELA_INDICADOR_DIAS = { diaria: 30, mensal: 150 }
const INDEXADORES_OBRIGATORIOS = ['selic', 'prefixado', 'ipca']

// ---------------------------------------------------------------------------------------
// Funções puras (exportadas para os testes em atualizar-mercado-oficial.test.mjs)
// ---------------------------------------------------------------------------------------

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** "25/09/2026" → "2026-09-25". Formato inválido → null. */
export function dataBrParaIso(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** Dias corridos entre uma data ISO (aaaa-mm-dd) e "hoje". */
export function diasDesde(dataIso, hoje = new Date()) {
  const [a, m, d] = dataIso.split('-').map(Number)
  const inicio = Date.UTC(a, m - 1, d)
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  return Math.round((fim - inicio) / 86_400_000)
}

/**
 * Decodifica o CSV do Tesouro Transparente. O arquivo costuma vir em UTF-8, mas órgãos
 * públicos às vezes publicam em ISO-8859-1: se o UTF-8 for inválido, lê como latin1.
 */
export function decodificarTexto(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('latin1').decode(bytes)
  }
}

/**
 * Lê a resposta do SGS ([{ data: "dd/mm/aaaa", valor: "15.00" }, ...]) e devolve o último
 * valor e o anterior. Resposta fora do formato → erro com a descrição do que veio.
 */
export function lerSerieSgs(corpo, descricao = 'série', hojeIso = null) {
  if (!Array.isArray(corpo) || corpo.length === 0) {
    throw new Error(`SGS não devolveu dados para ${descricao}.`)
  }
  let pontos = corpo.map((p) => ({ data: dataBrParaIso(p?.data), valor: lerNumero(p?.valor) }))
  if (pontos.some((p) => p.data == null || p.valor == null)) {
    throw new Error(`SGS devolveu formato inesperado para ${descricao}: ${JSON.stringify(corpo).slice(0, 200)}`)
  }
  // Descarta datas futuras (Selic meta preenchida até a próxima reunião do Copom).
  if (hojeIso) pontos = pontos.filter((p) => p.data <= hojeIso)
  if (pontos.length === 0) throw new Error(`SGS não devolveu dados até hoje para ${descricao}.`)
  pontos.sort((a, b) => a.data.localeCompare(b.data))
  const ultimo = pontos.at(-1)
  const anterior = pontos.length > 1 ? pontos.at(-2) : null
  return {
    data: ultimo.data,
    valor: ultimo.valor,
    ...(anterior ? { dataAnterior: anterior.data, valorAnterior: anterior.valor } : {}),
  }
}

/** Confere faixa plausível e idade do dado. Devolve a lista de problemas (vazia = ok). */
export function validarIndicador(indicador, serie, hoje = new Date()) {
  const problemas = []
  const [min, max] = indicador.faixa
  if (serie.valor < min || serie.valor > max) {
    problemas.push(`${indicador.nome}: valor ${serie.valor} fora da faixa plausível [${min}, ${max}] (código SGS ${indicador.codigoSgs} trocado ou unidade mudou?)`)
  }
  const idade = diasDesde(serie.data, hoje)
  if (idade > indicador.maxDiasAtraso) {
    problemas.push(`${indicador.nome}: último dado é de ${serie.data}, ${idade} dias atrás (máximo ${indicador.maxDiasAtraso}).`)
  }
  return problemas
}

/**
 * Classifica o "Tipo Titulo" do Tesouro Transparente. Devolve null para tipos desconhecidos
 * (o log avisa; um tipo novo não derruba o job, mas precisa ser incluído aqui).
 */
export function classificarTitulo(tipo) {
  const t = semAcento(tipo)
  const cupom = t.includes('juros semestrais') ? 'semestral' : 'sem cupom'
  if (t.includes('selic')) return { indexador: 'selic', tipoTaxa: 'agioSobreSelic', familia: 'Tesouro Selic', cupom }
  if (t.includes('renda+')) return { indexador: 'ipca', tipoTaxa: 'jurosReais', familia: 'Tesouro Renda+', cupom: 'renda mensal' }
  if (t.includes('educa+')) return { indexador: 'ipca', tipoTaxa: 'jurosReais', familia: 'Tesouro Educa+', cupom: 'renda mensal' }
  if (t.includes('ipca')) return { indexador: 'ipca', tipoTaxa: 'jurosReais', familia: 'Tesouro IPCA+', cupom }
  if (t.includes('igpm') || t.includes('igp-m')) return { indexador: 'igpm', tipoTaxa: 'jurosReais', familia: 'Tesouro IGPM+', cupom }
  if (t.includes('prefixado')) return { indexador: 'prefixado', tipoTaxa: 'nominal', familia: 'Tesouro Prefixado', cupom }
  return null
}

/**
 * Nome como o investidor vê no Tesouro Direto: "Tesouro IPCA+ 2035",
 * "Tesouro IPCA+ com Juros Semestrais 2035". No Renda+ e no Educa+ o ano do nome NÃO é o
 * vencimento (é o ano de início da renda), por isso o nome leva o vencimento explícito.
 */
export function nomeDoTitulo(tipo, vencimentoIso, classe) {
  const ano = vencimentoIso.slice(0, 4)
  if (classe?.cupom === 'renda mensal') return `${tipo} (vencimento ${ano})`
  return `${tipo} ${ano}`
}

/**
 * Processa as linhas do CSV do Tesouro Transparente e devolve só a data-base mais recente.
 * Títulos à venda com taxa fora da faixa plausível ficam em "descartados", com o motivo.
 */
export function montarTesouro(linhas, faixaTaxa) {
  if (linhas.length === 0) throw new Error('Arquivo do Tesouro Transparente veio vazio.')
  const cab = Object.keys(linhas[0])
  const col = {
    tipo: acharColuna(cab, [/^tipo\s*t[ií]tulo$/i], { descricao: 'Tipo Titulo' }),
    vencimento: acharColuna(cab, [/^data\s*vencimento$/i], { descricao: 'Data Vencimento' }),
    dataBase: acharColuna(cab, [/^data\s*base$/i], { descricao: 'Data Base' }),
    taxaCompra: acharColuna(cab, [/^taxa\s*compra/i], { descricao: 'Taxa Compra Manha' }),
    taxaVenda: acharColuna(cab, [/^taxa\s*venda/i], { descricao: 'Taxa Venda Manha' }),
    puCompra: acharColuna(cab, [/^pu\s*compra/i], { descricao: 'PU Compra Manha' }),
    puVenda: acharColuna(cab, [/^pu\s*venda/i], { descricao: 'PU Venda Manha' }),
  }

  // Data-base mais recente (comparação em ISO, que ordena como texto)
  let dataBase = null
  for (const l of linhas) {
    const iso = dataBrParaIso(l[col.dataBase])
    if (iso && (dataBase == null || iso > dataBase)) dataBase = iso
  }
  if (dataBase == null) throw new Error('Nenhuma "Data Base" válida no arquivo do Tesouro Transparente.')

  const titulos = []
  const descartados = []
  const tiposDesconhecidos = new Set()
  const vistos = new Set()
  for (const l of linhas) {
    if (dataBrParaIso(l[col.dataBase]) !== dataBase) continue
    const tipo = l[col.tipo]
    const vencimento = dataBrParaIso(l[col.vencimento])
    const classe = classificarTitulo(tipo)
    if (!classe) {
      tiposDesconhecidos.add(tipo)
      continue
    }
    if (!vencimento) continue
    const chave = `${tipo}|${vencimento}`
    if (vistos.has(chave)) continue // linha repetida no arquivo
    vistos.add(chave)

    const puCompra = lerNumero(l[col.puCompra]) ?? 0
    const taxaCompra = lerNumero(l[col.taxaCompra])
    const aVenda = puCompra > 0
    const nome = nomeDoTitulo(tipo, vencimento, classe)
    if (aVenda) {
      const [min, max] = faixaTaxa[classe.indexador] ?? [-Infinity, Infinity]
      if (taxaCompra == null || taxaCompra < min || taxaCompra > max) {
        descartados.push({ nome, motivo: `taxa de compra ${taxaCompra} fora da faixa [${min}, ${max}]` })
        continue
      }
    }
    titulos.push({
      nome,
      tipo,
      familia: classe.familia,
      indexador: classe.indexador,
      tipoTaxa: classe.tipoTaxa,
      cupom: classe.cupom,
      vencimento,
      aVenda,
      taxaCompra: aVenda ? taxaCompra : null,
      puCompra: aVenda ? puCompra : null,
      taxaVenda: lerNumero(l[col.taxaVenda]),
      puVenda: lerNumero(l[col.puVenda]),
    })
  }
  titulos.sort((a, b) => a.familia.localeCompare(b.familia) || a.cupom.localeCompare(b.cupom) || a.vencimento.localeCompare(b.vencimento))
  return { dataBase, titulos, descartados, tiposDesconhecidos: [...tiposDesconhecidos] }
}

/** "2026-09-25" → "25/09/2026" (formato das consultas por período do SGS). */
export function dataIsoParaBr(iso) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Janelas consecutivas de até `anos` anos, de `desdeIso` até hoje, no formato do SGS.
 * O SGS recusa consultas por período maiores que 10 anos (desde 26/03/2025).
 */
export function janelasDeConsulta(desdeIso, hoje = new Date(), anos = 9) {
  const fimIso = hoje.toISOString().slice(0, 10)
  const janelas = []
  let inicio = desdeIso
  while (inicio <= fimIso) {
    const [a, m, d] = inicio.split('-').map(Number)
    const limite = new Date(Date.UTC(a + anos, m - 1, d - 1)).toISOString().slice(0, 10)
    const fim = limite < fimIso ? limite : fimIso
    janelas.push({ inicio: dataIsoParaBr(inicio), fim: dataIsoParaBr(fim) })
    const [fa, fm, fd] = fim.split('-').map(Number)
    inicio = new Date(Date.UTC(fa, fm - 1, fd + 1)).toISOString().slice(0, 10)
  }
  return janelas
}

/** Resposta do SGS por período → pares [data ISO, valor], em ordem de data. */
export function lerHistoricoSgs(corpo, descricao = 'série', hojeIso = null) {
  if (!Array.isArray(corpo)) throw new Error(`SGS devolveu formato inesperado no histórico de ${descricao}.`)
  const pontos = []
  for (const p of corpo) {
    const data = dataBrParaIso(p?.data)
    const valor = lerNumero(p?.valor)
    if (data == null || valor == null) throw new Error(`SGS devolveu ponto inválido no histórico de ${descricao}: ${JSON.stringify(p)}`)
    if (hojeIso && data > hojeIso) continue
    pontos.push([data, valor])
  }
  return pontos.sort((a, b) => a[0].localeCompare(b[0]))
}

/**
 * Junta janelas (a borda de uma pode repetir na outra) e, para séries em degrau como a
 * Selic meta, guarda só o primeiro ponto, cada mudança de valor e o último dia (para a
 * linha do gráfico chegar até hoje).
 */
export function consolidarHistorico(pontos, comprimir) {
  const unicos = []
  for (const p of [...pontos].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (unicos.length > 0 && unicos.at(-1)[0] === p[0]) unicos[unicos.length - 1] = p
    else unicos.push(p)
  }
  if (!comprimir || unicos.length <= 2) return unicos
  const saida = [unicos[0]]
  for (let i = 1; i < unicos.length; i++) {
    if (unicos[i][1] !== saida.at(-1)[1]) saida.push(unicos[i])
  }
  const ultimo = unicos.at(-1)
  if (saida.at(-1)[0] !== ultimo[0]) saida.push(ultimo)
  return saida
}

/** Travas do histórico. O último ponto precisa bater com o indicador atual. */
export function validarHistorico(serie, pontos, atual) {
  const problemas = []
  if (pontos.length < serie.minimoPontos) {
    problemas.push(`Histórico de ${serie.nome}: só ${pontos.length} pontos (mínimo ${serie.minimoPontos}).`)
  }
  const [min, max] = serie.faixa
  const fora = pontos.filter(([, v]) => v < min || v > max)
  if (fora.length > 0) problemas.push(`Histórico de ${serie.nome}: ${fora.length} ponto(s) fora da faixa [${min}, ${max}], ex.: ${fora[0].join(' = ')}.`)
  const ultimo = pontos.at(-1)
  if (atual && ultimo && (ultimo[0] !== atual.data || ultimo[1] !== atual.valor)) {
    problemas.push(`Histórico de ${serie.nome}: último ponto ${ultimo.join(' = ')} não bate com o valor atual ${atual.data} = ${atual.valor}.`)
  }
  return problemas
}

/**
 * Resposta do Olinda ({ value: [{ Indicador, Data, DataReferencia, Mediana }] }) →
 * { data, porAno: { "2026": 4.8, ... } }, só com a coleta mais recente e anos a partir do
 * corrente.
 */
export function lerFocus(corpo, anoCorrente, descricao = 'Focus') {
  const linhas = corpo?.value
  if (!Array.isArray(linhas) || linhas.length === 0) throw new Error(`${descricao}: resposta sem dados.`)
  const datas = linhas.map((l) => String(l?.Data ?? '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (datas.length === 0) throw new Error(`${descricao}: nenhuma data válida na resposta.`)
  const data = datas.sort().at(-1)
  const porAno = {}
  for (const l of linhas) {
    if (String(l.Data).slice(0, 10) !== data) continue
    const ano = Number(l.DataReferencia)
    const mediana = typeof l.Mediana === 'number' ? l.Mediana : lerNumero(l.Mediana)
    if (!Number.isInteger(ano) || ano < anoCorrente || mediana == null) continue
    if (!(String(ano) in porAno)) porAno[String(ano)] = mediana
  }
  return { data, porAno }
}

/** Travas do Focus. */
export function validarFocus(ind, focus, { maxDiasAtraso, minimoAnos }, hoje = new Date()) {
  const problemas = []
  const idade = diasDesde(focus.data, hoje)
  if (idade > maxDiasAtraso) problemas.push(`Focus ${ind.nomeFocus}: coleta de ${focus.data}, ${idade} dias atrás (máximo ${maxDiasAtraso}).`)
  const anoCorrente = hoje.getUTCFullYear()
  for (let a = anoCorrente; a < anoCorrente + minimoAnos; a++) {
    if (!(String(a) in focus.porAno)) problemas.push(`Focus ${ind.nomeFocus}: sem projeção para ${a}.`)
  }
  const [min, max] = ind.faixa
  for (const [ano, v] of Object.entries(focus.porAno)) {
    if (v < min || v > max) problemas.push(`Focus ${ind.nomeFocus} ${ano}: ${v} fora da faixa [${min}, ${max}].`)
  }
  return problemas
}

/** Travas da publicação do Tesouro. Devolve a lista de problemas (vazia = ok). */
export function validarTesouro(tesouro, { maxDiasAtraso, minimoTitulosAVenda }, hoje = new Date()) {
  const problemas = []
  const idade = diasDesde(tesouro.dataBase, hoje)
  if (idade > maxDiasAtraso) {
    problemas.push(`Tesouro: data-base mais recente é ${tesouro.dataBase}, ${idade} dias atrás (máximo ${maxDiasAtraso}).`)
  }
  const aVenda = tesouro.titulos.filter((t) => t.aVenda)
  if (aVenda.length < minimoTitulosAVenda) {
    problemas.push(`Tesouro: só ${aVenda.length} títulos à venda com taxa plausível (mínimo ${minimoTitulosAVenda}).`)
  }
  for (const ix of INDEXADORES_OBRIGATORIOS) {
    if (!aVenda.some((t) => t.indexador === ix)) problemas.push(`Tesouro: nenhum título ${ix} à venda com taxa plausível.`)
  }
  return problemas
}

/**
 * Juro real ex-post aproximado: Selic meta descontada do IPCA acumulado em 12 meses,
 * pela fórmula de Fisher. Mistura uma taxa prospectiva com uma inflação passada: serve como
 * termômetro de cenário, não como previsão de retorno.
 */
export function jurosReaisExPost(selicMeta, ipca12m) {
  if (selicMeta == null || ipca12m == null) return null
  return Math.round(((1 + selicMeta / 100) / (1 + ipca12m / 100) - 1) * 10_000) / 100
}

/**
 * Títulos citados num texto, no padrão do Tesouro Direto: "Tesouro IPCA+ 2045",
 * "Tesouro Prefixado com Juros Semestrais 2035", "Tesouro Selic 2031".
 */
export function titulosCitados(texto) {
  const achados = new Set()
  const re = /Tesouro (IPCA\+|Prefixado|Selic)( com Juros Semestrais)? (20\d{2})\b/g
  for (const m of String(texto).matchAll(re)) achados.add(`Tesouro ${m[1]}${m[2] ?? ''} ${m[3]}`)
  return [...achados].sort()
}

/** Citados que não estão à venda na data-base. */
export function citadosForaDeVenda(citados, titulos) {
  const aVenda = new Set(titulos.filter((t) => t.aVenda).map((t) => t.nome))
  return citados.filter((nome) => !aVenda.has(nome))
}

/**
 * Serializa com um título e um ponto de histórico por linha: o diff semanal no GitHub fica
 * legível (mesma ideia do formatarSnapshot do script de FIIs).
 */
export function formatarMercado(snapshot) {
  const { tesouro, historico, ...resto } = snapshot
  const partes = Object.entries(resto).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')}`)
  if (historico) {
    const series = Object.entries(historico).map(([chave, { pontos, ...info }]) => {
      const campos = Object.entries(info).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      const linhas = pontos.length === 0 ? '[]' : `[\n${pontos.map((p) => `        ${JSON.stringify(p)}`).join(',\n')}\n      ]`
      campos.push(`      "pontos": ${linhas}`)
      return `    ${JSON.stringify(chave)}: {\n${campos.join(',\n')}\n    }`
    })
    partes.push(`  "historico": {\n${series.join(',\n')}\n  }`)
  }
  const linhasTitulos = tesouro.titulos.length === 0 ? '[]' : `[\n${tesouro.titulos.map((t) => `      ${JSON.stringify(t)}`).join(',\n')}\n    ]`
  partes.push(`  "tesouro": {\n    "dataBase": ${JSON.stringify(tesouro.dataBase)},\n    "titulos": ${linhasTitulos}\n  }`)
  return `{\n${partes.join(',\n')}\n}\n`
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Lê a resposta como JSON. Quando o Banco Central devolve uma página de erro (XML ou HTML)
 * com status 200, o erro mostra o começo do que veio, para o log dizer o motivo.
 */
export async function lerJson(resposta) {
  const texto = await resposta.text()
  try {
    return JSON.parse(texto)
  } catch {
    const trecho = texto.replace(/\s+/g, ' ').trim().slice(0, 200)
    throw new Error(`resposta não é JSON: "${trecho}"`)
  }
}

/** fetch com timeout e novas tentativas (o SGS oscila e às vezes devolve HTML de erro). */
async function buscarComTentativas(buscar, url, ler, descricao, pausaBaseMs) {
  let ultimoErro
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resposta = await buscar(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json, text/csv, */*' } })
      if (!resposta.ok) throw new Error(`${descricao}: HTTP ${resposta.status}`)
      return await ler(resposta)
    } catch (erro) {
      ultimoErro = erro
      if (tentativa < TENTATIVAS) {
        console.warn(`[aviso] ${descricao}: tentativa ${tentativa} falhou (${erro.message}). Tentando de novo.`)
        await esperar(pausaBaseMs * 2 ** (tentativa - 1))
      }
    }
  }
  throw new Error(`${descricao}: falhou após ${TENTATIVAS} tentativas (${ultimoErro?.message}).`)
}

/**
 * Executa o job. Os parâmetros existem para o teste de ponta a ponta (fetch falso, data fixa,
 * pasta temporária); no uso normal, nada precisa ser passado.
 */
export async function executar({ buscar = fetch, hoje = new Date(), raiz = RAIZ, pausaBaseMs = 3000, pausaEntreConsultasMs = 1000 } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, CAMINHO_CONFIG), 'utf8'))
  const problemas = []
  const hojeIso = hoje.toISOString().slice(0, 10)
  // Uma consulta por vez, com pausa: o SGS oscila (502, páginas de erro) quando recebe muitas seguidas.
  const buscarSgs = async (url, ler, descricao) => {
    await esperar(pausaEntreConsultasMs)
    return buscarComTentativas(buscar, url, ler, descricao, pausaBaseMs)
  }

  // 1. Indicadores do Banco Central
  const indicadores = {}
  for (const ind of config.indicadores) {
    const descricao = `${ind.nome} (SGS ${ind.codigoSgs})`
    const inicio = new Date(hoje.getTime() - JANELA_INDICADOR_DIAS[ind.periodicidade] * 86_400_000).toISOString().slice(0, 10)
    const url = URL_SGS_PERIODO(ind.codigoSgs, dataIsoParaBr(inicio), dataIsoParaBr(hojeIso))
    const serie = await buscarSgs(url, async (r) => lerSerieSgs(await lerJson(r), descricao, hojeIso), descricao)
    problemas.push(...validarIndicador(ind, serie, hoje))
    indicadores[ind.chave] = { nome: ind.nome, unidade: ind.unidade, codigoSgs: ind.codigoSgs, ...serie }
    console.log(`[indicador] ${ind.nome}: ${serie.valor} ${ind.unidade} em ${serie.data}.`)
  }

  // 2. Histórico para o gráfico (janelas de até 10 anos)
  const historico = {}
  if (config.historico) {
    const janelas = janelasDeConsulta(config.historico.desde, hoje, config.historico.janelaAnos)
    for (const serie of config.historico.series) {
      const brutos = []
      for (const j of janelas) {
        const descricao = `Histórico ${serie.nome} (SGS ${serie.codigoSgs}, ${j.inicio} a ${j.fim})`
        brutos.push(...(await buscarSgs(URL_SGS_PERIODO(serie.codigoSgs, j.inicio, j.fim), async (r) => lerHistoricoSgs(await lerJson(r), serie.nome, hojeIso), descricao)))
      }
      const pontos = consolidarHistorico(brutos, serie.comprimir)
      problemas.push(...validarHistorico(serie, pontos, indicadores[serie.chave]))
      historico[serie.chave] = { nome: serie.nome, unidade: serie.unidade, degrau: serie.comprimir, pontos }
      console.log(`[historico] ${serie.nome}: ${pontos.length} pontos de ${pontos[0]?.[0]} a ${pontos.at(-1)?.[0]} (${brutos.length} valores brutos).`)
    }
  }

  // 3. Tesouro Direto
  const linhas = await buscarComTentativas(
    buscar,
    config.tesouro.urlCsv,
    async (r) => lerCsv(decodificarTexto(new Uint8Array(await r.arrayBuffer()))),
    'Tesouro Transparente',
    pausaBaseMs,
  )
  const tesouro = montarTesouro(linhas, config.tesouro.faixaTaxa)
  problemas.push(...validarTesouro(tesouro, config.tesouro, hoje))
  for (const d of tesouro.descartados) console.warn(`[descartado] ${d.nome}: ${d.motivo}.`)
  for (const t of tesouro.tiposDesconhecidos) console.warn(`[aviso] Tipo de título desconhecido, ignorado: "${t}". Incluir em classificarTitulo.`)
  const aVenda = tesouro.titulos.filter((t) => t.aVenda)
  console.log(`[tesouro] Data-base ${tesouro.dataBase}: ${aVenda.length} títulos à venda, ${tesouro.titulos.length - aVenda.length} só para resgate, ${tesouro.descartados.length} descartados.`)
  for (const t of aVenda) console.log(`[tesouro] ${t.nome}: ${t.taxaCompra}% (${t.tipoTaxa}), PU R$ ${t.puCompra}`)

  // 4. Boletim Focus (premissas do simulador)
  let focus = null
  if (config.focus) {
    focus = {}
    for (const ind of config.focus.indicadores) {
      const descricao = `Focus ${ind.nomeFocus}`
      const lido = await buscarSgs(URL_FOCUS(ind.nomeFocus), async (r) => lerFocus(await lerJson(r), hoje.getUTCFullYear(), descricao), descricao)
      problemas.push(...validarFocus(ind, lido, config.focus, hoje))
      focus.data = focus.data && focus.data > lido.data ? focus.data : lido.data
      focus[ind.chave] = lido.porAno
      console.log(`[focus] ${ind.nomeFocus} (coleta ${lido.data}): ${Object.entries(lido.porAno).map(([a, v]) => `${a} ${v}`).join(', ')}.`)
    }
  }

  // 5. Conferência do conteúdo educacional (só avisa)
  const conteudo = config.conferirConteudo
  if (conteudo) {
    for (const arquivo of conteudo.arquivos) {
      const caminho = path.join(raiz, conteudo.pasta, arquivo)
      if (!fs.existsSync(caminho)) continue
      const fora = citadosForaDeVenda(titulosCitados(fs.readFileSync(caminho, 'utf8')), tesouro.titulos)
      for (const nome of fora) console.warn(`[conteudo] ${arquivo} cita "${nome}", que não está à venda em ${tesouro.dataBase}.`)
    }
  }

  // Travas: qualquer problema impede a gravação
  if (problemas.length > 0) {
    for (const p of problemas) console.error(`[trava] ${p}`)
    throw new Error(`${problemas.length} problema(s) nos dados. Arquivo NÃO atualizado.`)
  }

  const snapshot = {
    geradoEm: hoje.toISOString(),
    fontes: {
      indicadores: 'Banco Central do Brasil, SGS (api.bcb.gov.br)',
      tesouro: 'Tesouro Transparente, Preço e taxa dos títulos do Tesouro Direto (taxas e preços da manhã)',
    },
    indicadores,
    derivados: {
      jurosReaisExPost: {
        nome: 'Juro real ex-post (Selic meta descontada do IPCA 12 meses)',
        unidade: '% a.a.',
        valor: jurosReaisExPost(indicadores.selicMeta?.valor, indicadores.ipca12m?.valor),
      },
    },
    ...(focus ? { focus } : {}),
    historico,
    tesouro: { dataBase: tesouro.dataBase, titulos: tesouro.titulos },
  }
  fs.writeFileSync(path.join(raiz, CAMINHO_SAIDA), formatarMercado(snapshot))
  console.log(`mercadoOficial.json atualizado: ${Object.keys(indicadores).length} indicadores, ${Object.keys(historico).length} séries históricas e ${tesouro.titulos.length} títulos (data-base ${tesouro.dataBase}).`)
  return snapshot
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  executar().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
