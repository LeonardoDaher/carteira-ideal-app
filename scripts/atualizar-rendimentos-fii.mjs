// Atualização mensal dos dados da aba "Simule FII".
//
// Roda uma vez por mês pelo GitHub Actions (.github/workflows/atualizar-rendimentos-fii.yml)
// ou manualmente com:  BRAPI_TOKEN=... node scripts/atualizar-rendimentos-fii.mjs
//
// O que faz:
//   1. Lê a lista de fundos em config/fiis-ifix.json (os 10 maiores do IFIX vigente).
//   2. Baixa o Informe Mensal Estruturado de FIIs do Portal de Dados Abertos da CVM
//      (ano atual e anterior) e calcula o rendimento por cota dos 3 meses mais recentes.
//   3. Busca a cotação de cada fundo na brapi (plano gratuito: 1 ativo por requisição).
//   4. Grava webapp-src/src/data/rendimentosFii.json, que o app lê como arquivo estático.
//
// Regra de segurança: se algo parecer errado (coluna não encontrada, poucos fundos com
// dados, rendimento fora de uma faixa plausível), o script termina com erro SEM gravar o
// arquivo. O app continua exibindo os dados do mês anterior, e o GitHub avisa da falha.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'fiis-ifix.json')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'rendimentosFii.json')
const URL_CVM = (ano) => `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${ano}.zip`
const URL_BRAPI = (ticker) => `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`
const MESES_HISTORICO = 3

// Faixa plausível de rendimento mensal sobre a cota (em %). Fora disso, o dado provavelmente
// está errado (escala trocada, cotação de outro ativo etc.) e o fundo não é publicado.
const RENDIMENTO_MENSAL_MIN_PCT = 0.1
const RENDIMENTO_MENSAL_MAX_PCT = 3

// ---------------------------------------------------------------------------------------
// Funções puras (exportadas para os testes em atualizar-rendimentos-fii.test.mjs)
// ---------------------------------------------------------------------------------------

/** Lê um CSV no padrão da CVM: separador ";", aspas opcionais, primeira linha = cabeçalho. */
export function lerCsv(texto) {
  const linhas = []
  let campo = ''
  let linha = []
  let entreAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreAspas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      entreAspas = true
    } else if (c === ';') {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      campo = ''
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha)
      linha = []
    } else {
      campo += c
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }
  const [cabecalho = [], ...dados] = linhas
  return dados.map((valores) => Object.fromEntries(cabecalho.map((nome, i) => [nome.trim(), (valores[i] ?? '').trim()])))
}

/**
 * Encontra o nome real de uma coluna a partir de padrões. Os nomes mudaram ao longo do
 * tempo (ex.: CNPJ_Fundo → CNPJ_Fundo_Classe com a Resolução CVM 175), então a busca é
 * por padrão, sem diferenciar maiúsculas.
 */
export function acharColuna(cabecalho, padroes, { obrigatoria = true, descricao = '' } = {}) {
  for (const padrao of padroes) {
    const achada = cabecalho.find((nome) => padrao.test(nome))
    if (achada) return achada
  }
  if (obrigatoria) {
    throw new Error(`Coluna não encontrada (${descricao || padroes.join(', ')}). Colunas disponíveis: ${cabecalho.join(', ')}`)
  }
  return null
}

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

/** "0,0085" ou "0.0085" → 0.0085. Vazio ou inválido → null. */
export function lerNumero(valor) {
  if (valor == null) return null
  const texto = String(valor).trim()
  if (texto === '') return null
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Prefixo de 4 letras do ticker a partir do ISIN da cota.
 * Cotas de FII seguem o padrão BR + código de 4 letras + CTF + 3 caracteres (ex.: BRHGLGCTF004).
 */
export function prefixoTickerDoIsin(isin) {
  const m = /^BR([A-Z0-9]{4})CTF[A-Z0-9]{3}$/.exec(String(isin ?? '').trim().toUpperCase())
  return m ? m[1] : null
}

/**
 * O campo de dividend yield do informe pode vir como fração (0,0085) ou em % (0,85),
 * dependendo da versão do arquivo. Decide a escala pela mediana de todos os fundos no mês:
 * um DY mensal típico fica perto de 0,8%, então mediana acima de 0,05 só faz sentido em %.
 * Devolve o divisor que converte o valor bruto em fração.
 */
export function divisorEscalaDy(valores) {
  const positivos = valores.filter((v) => v != null && v > 0).sort((a, b) => a - b)
  if (positivos.length === 0) return 1
  const mediana = positivos[Math.floor(positivos.length / 2)]
  return mediana > 0.05 ? 100 : 1
}

/** "2026-07-31" ou "31/07/2026" → "2026-07". */
export function competenciaDe(dataReferencia) {
  const iso = /^(\d{4})-(\d{2})/.exec(dataReferencia)
  if (iso) return `${iso[1]}-${iso[2]}`
  const br = /^\d{2}\/(\d{2})\/(\d{4})/.exec(dataReferencia)
  if (br) return `${br[2]}-${br[1]}`
  return null
}

/**
 * Junta as linhas do arquivo "complemento" (valor patrimonial e DY) com as do arquivo
 * "geral" (ISIN e nome) e devolve, por fundo da configuração, os rendimentos por cota dos
 * meses mais recentes.
 *
 * rendimento por cota ≈ DY do mês (fração) × valor patrimonial da cota
 * É uma ESTIMATIVA: o DY do informe é calculado sobre o valor patrimonial, e o valor
 * efetivamente anunciado pelo fundo pode diferir por arredondamento ou ajustes.
 */
export function montarRendimentos(linhasComplemento, linhasGeral, fundosConfig, mesesHistorico = MESES_HISTORICO) {
  if (linhasComplemento.length === 0) throw new Error('Arquivo "complemento" da CVM veio vazio.')
  if (linhasGeral.length === 0) throw new Error('Arquivo "geral" da CVM veio vazio.')

  const cabComp = Object.keys(linhasComplemento[0])
  const cabGeral = Object.keys(linhasGeral[0])

  const colCnpjComp = acharColuna(cabComp, [/^cnpj_fundo_classe$/i, /^cnpj_fundo$/i, /^cnpj/i], { descricao: 'CNPJ no complemento' })
  const colDataComp = acharColuna(cabComp, [/^data_referencia$/i, /data.*refer/i], { descricao: 'data de referência no complemento' })
  const colVersaoComp = acharColuna(cabComp, [/^versao$/i], { obrigatoria: false })
  const colVpCota = acharColuna(cabComp, [/valor_patrimonial_cotas?$/i, /patrimonial.*cota/i], { descricao: 'valor patrimonial da cota' })
  const colDy = acharColuna(cabComp, [/dividend_yield_mes/i, /dividend_yield/i], { descricao: 'dividend yield do mês' })

  const colCnpjGeral = acharColuna(cabGeral, [/^cnpj_fundo_classe$/i, /^cnpj_fundo$/i, /^cnpj/i], { descricao: 'CNPJ no geral' })
  const colIsin = acharColuna(cabGeral, [/isin/i], { obrigatoria: false })
  const colNome = acharColuna(cabGeral, [/^nome_fundo_classe$/i, /^nome_fundo$/i, /^nome/i], { obrigatoria: false })

  // CNPJ → { prefixo do ticker (via ISIN), nome }
  const cadastro = new Map()
  for (const linha of linhasGeral) {
    const cnpj = somenteDigitos(linha[colCnpjGeral])
    if (!cnpj) continue
    const prefixo = colIsin ? prefixoTickerDoIsin(linha[colIsin]) : null
    const anterior = cadastro.get(cnpj) ?? {}
    cadastro.set(cnpj, {
      prefixo: prefixo ?? anterior.prefixo ?? null,
      nome: (colNome && linha[colNome]) || anterior.nome || null,
    })
  }

  // Escala do DY decidida por competência (o formato pode mudar entre arquivos de anos diferentes)
  const dyPorCompetencia = new Map()
  for (const linha of linhasComplemento) {
    const comp = competenciaDe(linha[colDataComp])
    if (!comp) continue
    if (!dyPorCompetencia.has(comp)) dyPorCompetencia.set(comp, [])
    dyPorCompetencia.get(comp).push(lerNumero(linha[colDy]))
  }
  const divisores = new Map([...dyPorCompetencia].map(([comp, vals]) => [comp, divisorEscalaDy(vals)]))

  // CNPJ → competência → linha da versão mais recente (a CVM publica reapresentações)
  const porFundo = new Map()
  for (const linha of linhasComplemento) {
    const cnpj = somenteDigitos(linha[colCnpjComp])
    const comp = competenciaDe(linha[colDataComp])
    if (!cnpj || !comp) continue
    if (!porFundo.has(cnpj)) porFundo.set(cnpj, new Map())
    const meses = porFundo.get(cnpj)
    const versao = colVersaoComp ? lerNumero(linha[colVersaoComp]) ?? 0 : 0
    const atual = meses.get(comp)
    if (!atual || versao >= atual.versao) meses.set(comp, { versao, linha })
  }

  return fundosConfig.map((fundo) => {
    const prefixo = fundo.ticker.slice(0, 4).toUpperCase()
    let cnpj = fundo.cnpj ? somenteDigitos(fundo.cnpj) : null
    if (!cnpj) {
      const candidatos = [...cadastro].filter(([, info]) => info.prefixo === prefixo).map(([c]) => c)
      if (candidatos.length > 1) {
        return { ticker: fundo.ticker, erro: `ISIN aponta para mais de um CNPJ (${candidatos.join(', ')}). Informe "cnpj" em config/fiis-ifix.json.` }
      }
      cnpj = candidatos[0] ?? null
    }
    if (!cnpj) {
      return { ticker: fundo.ticker, erro: 'CNPJ não encontrado pelo ISIN. Informe "cnpj" em config/fiis-ifix.json.' }
    }

    const meses = porFundo.get(cnpj)
    if (!meses || meses.size === 0) {
      return { ticker: fundo.ticker, cnpj, erro: 'Nenhum informe mensal encontrado para este CNPJ.' }
    }

    const rendimentos = [...meses]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([competencia, { linha }]) => {
        const dyBruto = lerNumero(linha[colDy])
        const vpCota = lerNumero(linha[colVpCota])
        if (dyBruto == null || vpCota == null || vpCota <= 0) return null
        const valorPorCota = (dyBruto / divisores.get(competencia)) * vpCota
        return { competencia, valorPorCota: Math.round(valorPorCota * 10000) / 10000 }
      })
      .filter((r) => r != null)
      .slice(0, mesesHistorico)

    if (rendimentos.length === 0) {
      return { ticker: fundo.ticker, cnpj, erro: 'Informes sem DY ou valor patrimonial preenchidos.' }
    }

    return {
      ticker: fundo.ticker,
      cnpj,
      nome: fundo.nome ?? cadastro.get(cnpj)?.nome ?? fundo.ticker,
      rendimentos,
    }
  })
}

/** Confere se o rendimento estimado faz sentido diante da cotação. */
export function rendimentoPlausivel(valorPorCota, cotacao) {
  if (!(cotacao > 0) || !(valorPorCota > 0)) return false
  const pct = (valorPorCota / cotacao) * 100
  return pct >= RENDIMENTO_MENSAL_MIN_PCT && pct <= RENDIMENTO_MENSAL_MAX_PCT
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

async function baixarInformesCvm(ano, pastaTemp) {
  const destinoZip = path.join(pastaTemp, `inf_mensal_fii_${ano}.zip`)
  const resposta = await fetch(URL_CVM(ano))
  if (resposta.status === 404) return null // ano ainda sem arquivo (ex.: primeiros dias de janeiro)
  if (!resposta.ok) throw new Error(`CVM respondeu ${resposta.status} para o arquivo de ${ano}.`)
  fs.writeFileSync(destinoZip, Buffer.from(await resposta.arrayBuffer()))

  const pastaAno = path.join(pastaTemp, String(ano))
  fs.mkdirSync(pastaAno, { recursive: true })
  execFileSync('unzip', ['-o', '-q', destinoZip, '-d', pastaAno])

  const arquivos = fs.readdirSync(pastaAno)
  const ler = (trecho) => {
    const nome = arquivos.find((a) => a.toLowerCase().includes(trecho) && a.toLowerCase().endsWith('.csv'))
    if (!nome) throw new Error(`Arquivo "${trecho}" não encontrado no zip de ${ano}. Arquivos: ${arquivos.join(', ')}`)
    // Os CSVs da CVM são publicados em ISO-8859-1 (latin1)
    return lerCsv(fs.readFileSync(path.join(pastaAno, nome), 'latin1'))
  }
  return { complemento: ler('complemento'), geral: ler('geral') }
}

async function buscarCotacao(ticker, token) {
  const resposta = await fetch(URL_BRAPI(ticker), { headers: { Authorization: `Bearer ${token}` } })
  if (!resposta.ok) throw new Error(`brapi respondeu ${resposta.status} para ${ticker}.`)
  const corpo = await resposta.json()
  const resultado = corpo?.results?.[0]
  const preco = resultado?.regularMarketPrice
  if (typeof preco !== 'number' || !(preco > 0)) throw new Error(`brapi não trouxe cotação válida para ${ticker}.`)
  const data = resultado.regularMarketTime ? String(resultado.regularMarketTime).slice(0, 10) : new Date().toISOString().slice(0, 10)
  return { cotacao: Math.round(preco * 100) / 100, dataCotacao: data }
}

async function main() {
  const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG, 'utf8'))
  if (config.conferidoNaB3 !== true) {
    throw new Error(
      'config/fiis-ifix.json ainda não foi conferido com a carteira teórica do IFIX publicada pela B3. ' +
        'Confira os tickers, ajuste "vigencia" e marque "conferidoNaB3": true antes de publicar.',
    )
  }
  const token = process.env.BRAPI_TOKEN
  if (!token) throw new Error('Variável BRAPI_TOKEN não definida (GitHub: Settings > Secrets and variables > Actions).')

  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvm-fii-'))
  const anoAtual = new Date().getFullYear()
  const complemento = []
  const geral = []
  // Ano anterior sempre entra: em jan/fev/mar os 3 meses mais recentes cruzam a virada do ano.
  for (const ano of [anoAtual - 1, anoAtual]) {
    const dados = await baixarInformesCvm(ano, pastaTemp)
    if (!dados) continue
    complemento.push(...dados.complemento)
    geral.push(...dados.geral)
  }

  const resultados = montarRendimentos(complemento, geral, config.fundos)

  const fundos = []
  const problemas = []
  for (const r of resultados) {
    if (r.erro) {
      problemas.push(`${r.ticker}: ${r.erro}`)
      continue
    }
    try {
      // Sequencial de propósito: o plano gratuito da brapi aceita 1 requisição simultânea.
      const { cotacao, dataCotacao } = await buscarCotacao(r.ticker, token)
      if (!rendimentoPlausivel(r.rendimentos[0].valorPorCota, cotacao)) {
        const pct = ((r.rendimentos[0].valorPorCota / cotacao) * 100).toFixed(2)
        problemas.push(`${r.ticker}: rendimento estimado de ${pct}% ao mês sobre a cota está fora da faixa plausível.`)
        continue
      }
      fundos.push({ ticker: r.ticker, nome: r.nome, cotacao, dataCotacao, rendimentos: r.rendimentos })
    } catch (erro) {
      problemas.push(`${r.ticker}: ${erro.message}`)
    }
  }

  for (const p of problemas) console.warn(`[aviso] ${p}`)

  const minimo = config.minimoFundosParaPublicar ?? Math.ceil(config.fundos.length * 0.8)
  if (fundos.length < minimo) {
    throw new Error(`Só ${fundos.length} de ${config.fundos.length} fundos ficaram válidos (mínimo ${minimo}). Arquivo NÃO atualizado.`)
  }

  const snapshot = {
    geradoEm: new Date().toISOString(),
    vigenciaIfix: config.vigencia,
    fundos,
  }
  fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`rendimentosFii.json atualizado com ${fundos.length} fundos.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
