// Atualização mensal dos dados da aba "Simule FII".
//
// Roda uma vez por mês pelo GitHub Actions (.github/workflows/atualizar-rendimentos-fii.yml)
// ou manualmente com:  BRAPI_TOKEN=... node scripts/atualizar-rendimentos-fii.mjs
//
// O que faz:
//   1. Lê os fundos de controle em config/fiis-ifix.json (os 10 maiores do IFIX vigente):
//      se eles falham, o problema é geral e nada é publicado.
//   2. Baixa o Informe Mensal Estruturado de FIIs do Portal de Dados Abertos da CVM
//      (ano atual e anterior). O arquivo traz TODOS os FIIs registrados, com o setor
//      declarado por cada um.
//   3. Estima o rendimento por cota dos 6 meses mais recentes de cada fundo e escolhe UM
//      para publicar: o mais recente dentro da tolerância em torno da mediana (descarta
//      meses distorcidos por emissão de cotas ou fechamento de semestre).
//   4. Busca na brapi (plano gratuito: 1 ativo por requisição) a cotação e o histórico do
//      último mês, com pausa entre chamadas e um teto de requisições (config "outrosFundos").
//   5. Grava webapp-src/src/data/rendimentosFii.json com todos os fundos com dado, cada um
//      com setor e volume médio. O app lista por setor os que negociam acima de R$ 1 milhão
//      por dia (decisão D13); os demais aparecem só pela busca, com aviso de liquidez.
//
// Regras de segurança: se algo parecer errado (coluna obrigatória não encontrada, poucos
// fundos em destaque válidos, lista ampla muito menor que o esperado), o script termina com
// erro SEM gravar o arquivo. O app continua exibindo os dados do mês anterior, e o GitHub
// avisa da falha. Problemas em fundos fora do controle não derrubam a publicação: o fundo
// fica de fora ou vai para a lista "indisponiveis", com o motivo.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'fiis-ifix.json')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'rendimentosFii.json')
const URL_CVM = (ano) => `https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${ano}.zip`
// range=1mo traz o histórico diário do último mês na mesma requisição da cotação: é dele
// que sai o volume médio usado no critério de liquidez (decisão D13).
const URL_BRAPI = (ticker) => `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?range=1mo&interval=1d`
// Meses de informe analisados por fundo. Só UM é publicado (o mais recente considerado
// típico), mas a mediana desses meses é a referência para descartar meses distorcidos.
const MESES_ANALISE = 6
// Pregões usados na média de volume (cerca de um mês).
const SESSOES_LIQUIDEZ = 21
// Desvio máximo, em relação à mediana, para um mês ser considerado típico. Pode ser
// sobrescrito em config/fiis-ifix.json ("toleranciaPadrao" ou "tolerancia" por fundo).
const TOLERANCIA_PADRAO = 0.2
// A partir de quantos meses com valor idêntico o log avisa de possível informe replicado.
const MESES_IDENTICOS_SUSPEITOS = 3

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
 * Lê os dois arquivos do informe (complemento e geral) uma vez só e monta os índices usados
 * por montarRendimentos e montarTodosOsFundos:
 *   cadastro:  CNPJ → { prefixo do ticker (via ISIN), nome }
 *   porFundo:  CNPJ → competência → linha da versão mais recente
 *   divisores: competência → divisor da escala do DY
 */
export function prepararBase(linhasComplemento, linhasGeral) {
  if (linhasComplemento.length === 0) throw new Error('Arquivo "complemento" da CVM veio vazio.')
  if (linhasGeral.length === 0) throw new Error('Arquivo "geral" da CVM veio vazio.')

  const cabComp = Object.keys(linhasComplemento[0])
  const cabGeral = Object.keys(linhasGeral[0])

  const col = {
    cnpjComp: acharColuna(cabComp, [/^cnpj_fundo_classe$/i, /^cnpj_fundo$/i, /^cnpj/i], { descricao: 'CNPJ no complemento' }),
    dataComp: acharColuna(cabComp, [/^data_referencia$/i, /data.*refer/i], { descricao: 'data de referência no complemento' }),
    versaoComp: acharColuna(cabComp, [/^versao$/i], { obrigatoria: false }),
    vpCota: acharColuna(cabComp, [/valor_patrimonial_cotas?$/i, /patrimonial.*cota/i], { descricao: 'valor patrimonial da cota' }),
    dy: acharColuna(cabComp, [/dividend_yield_mes/i, /dividend_yield/i], { descricao: 'dividend yield do mês' }),
    // Opcionais: só servem para ordenar e filtrar a lista ampla. Se a CVM renomear, o
    // script segue sem ordenar por tamanho e sem o filtro de cotistas.
    pl: acharColuna(cabComp, [/^patrimonio_liquido$/i, /patrimonio_liquido/i], { obrigatoria: false }),
    cotistas: acharColuna(cabComp, [/^total_numero_cotistas$/i, /total.*cotistas/i], { obrigatoria: false }),
    cnpjGeral: acharColuna(cabGeral, [/^cnpj_fundo_classe$/i, /^cnpj_fundo$/i, /^cnpj/i], { descricao: 'CNPJ no geral' }),
    isin: acharColuna(cabGeral, [/isin/i], { obrigatoria: false }),
    nome: acharColuna(cabGeral, [/^nome_fundo_classe$/i, /^nome_fundo$/i, /^nome/i], { obrigatoria: false }),
    // Setor declarado pelo fundo à CVM (D13). Opcionais: sem elas, tudo vira "Outros".
    segmento: acharColuna(cabGeral, [/^segmento_atuacao$/i, /segmento/i], { obrigatoria: false }),
    mandato: acharColuna(cabGeral, [/^mandato$/i, /mandato/i], { obrigatoria: false }),
  }

  const cadastro = new Map()
  for (const linha of linhasGeral) {
    const cnpj = somenteDigitos(linha[col.cnpjGeral])
    if (!cnpj) continue
    const prefixo = col.isin ? prefixoTickerDoIsin(linha[col.isin]) : null
    const anterior = cadastro.get(cnpj) ?? {}
    cadastro.set(cnpj, {
      prefixo: prefixo ?? anterior.prefixo ?? null,
      nome: (col.nome && linha[col.nome]) || anterior.nome || null,
      segmento: (col.segmento && linha[col.segmento]) || anterior.segmento || null,
      mandato: (col.mandato && linha[col.mandato]) || anterior.mandato || null,
    })
  }

  // Escala do DY decidida por competência (o formato pode mudar entre arquivos de anos diferentes)
  const dyPorCompetencia = new Map()
  for (const linha of linhasComplemento) {
    const comp = competenciaDe(linha[col.dataComp])
    if (!comp) continue
    if (!dyPorCompetencia.has(comp)) dyPorCompetencia.set(comp, [])
    dyPorCompetencia.get(comp).push(lerNumero(linha[col.dy]))
  }
  const divisores = new Map([...dyPorCompetencia].map(([comp, vals]) => [comp, divisorEscalaDy(vals)]))

  // CNPJ → competência → linha da versão mais recente (a CVM publica reapresentações)
  const porFundo = new Map()
  for (const linha of linhasComplemento) {
    const cnpj = somenteDigitos(linha[col.cnpjComp])
    const comp = competenciaDe(linha[col.dataComp])
    if (!cnpj || !comp) continue
    if (!porFundo.has(cnpj)) porFundo.set(cnpj, new Map())
    const meses = porFundo.get(cnpj)
    const versao = col.versaoComp ? lerNumero(linha[col.versaoComp]) ?? 0 : 0
    const atual = meses.get(comp)
    if (!atual || versao >= atual.versao) meses.set(comp, { versao, linha })
  }

  const competenciaMaisRecente = [...divisores.keys()].sort().at(-1) ?? null
  return { col, cadastro, porFundo, divisores, competenciaMaisRecente }
}

function ultimaCompetenciaDoCnpj(base, cnpj) {
  return [...(base.porFundo.get(cnpj)?.keys() ?? [])].sort().at(-1) ?? ''
}

/**
 * Descobre o CNPJ de um prefixo de ticker pelo ISIN do informe "geral".
 * Com a Resolução CVM 175, fundos migram para um CNPJ novo mantendo ticker e ISIN; o CNPJ
 * antigo para de enviar informes, então vale o que tem a competência mais recente.
 */
export function resolverCnpj(base, prefixo) {
  const candidatos = [...base.cadastro].filter(([, info]) => info.prefixo === prefixo).map(([c]) => c)
  if (candidatos.length === 0) return { erro: 'CNPJ não encontrado pelo ISIN. Informe "cnpj" em config/fiis-ifix.json.' }
  if (candidatos.length === 1) return { cnpj: candidatos[0] }
  const ordenados = candidatos
    .map((c) => ({ cnpj: c, ultima: ultimaCompetenciaDoCnpj(base, c) }))
    .sort((a, b) => (a.ultima < b.ultima ? 1 : -1))
  if (!ordenados[0].ultima || ordenados[0].ultima === ordenados[1].ultima) {
    return { erro: `ISIN aponta para mais de um CNPJ (${candidatos.join(', ')}) com informes do mesmo mês. Informe "cnpj" em config/fiis-ifix.json.` }
  }
  return {
    cnpj: ordenados[0].cnpj,
    aviso: `ISIN ligado a ${candidatos.length} CNPJs (${candidatos.join(', ')}); usado ${ordenados[0].cnpj}, com informe mais recente (${ordenados[0].ultima}).`,
  }
}

/**
 * Rendimentos por cota de um fundo, do mês mais recente para o mais antigo.
 *
 * rendimento por cota ≈ DY do mês (fração) × valor patrimonial da cota
 * É uma ESTIMATIVA: o DY do informe é calculado sobre o valor patrimonial, e o valor
 * efetivamente anunciado pelo fundo pode diferir por arredondamento ou ajustes.
 */
function rendimentosDoFundo(base, fundo, mesesHistorico) {
  const { col } = base
  let cnpj = fundo.cnpj ? somenteDigitos(fundo.cnpj) : null
  let aviso
  if (!cnpj) {
    const r = resolverCnpj(base, fundo.ticker.slice(0, 4).toUpperCase())
    if (r.erro) return { ticker: fundo.ticker, erro: r.erro }
    cnpj = r.cnpj
    aviso = r.aviso
  }

  const meses = base.porFundo.get(cnpj)
  if (!meses || meses.size === 0) {
    return { ticker: fundo.ticker, cnpj, erro: 'Nenhum informe mensal encontrado para este CNPJ.' }
  }

  const ordenados = [...meses].sort(([a], [b]) => (a < b ? 1 : -1))
  const rendimentos = ordenados
    .map(([competencia, { linha }]) => {
      const dyBruto = lerNumero(linha[col.dy])
      const vpCota = lerNumero(linha[col.vpCota])
      if (dyBruto == null || vpCota == null || vpCota <= 0) return null
      const valorPorCota = (dyBruto / base.divisores.get(competencia)) * vpCota
      return { competencia, valorPorCota: Math.round(valorPorCota * 10000) / 10000 }
    })
    .filter((r) => r != null)
    .slice(0, mesesHistorico)

  if (rendimentos.length === 0) {
    return { ticker: fundo.ticker, cnpj, erro: 'Informes sem DY ou valor patrimonial preenchidos.' }
  }

  const linhaRecente = ordenados[0][1].linha
  const patrimonio = col.pl ? lerNumero(linhaRecente[col.pl]) : null
  const cotistas = col.cotistas ? lerNumero(linhaRecente[col.cotistas]) : null

  return {
    ticker: fundo.ticker,
    cnpj,
    nome: fundo.nome ?? base.cadastro.get(cnpj)?.nome ?? fundo.ticker,
    segmento: base.cadastro.get(cnpj)?.segmento ?? null,
    mandato: base.cadastro.get(cnpj)?.mandato ?? null,
    rendimentos,
    ultimaCompetencia: ordenados[0][0],
    ...(patrimonio != null ? { patrimonio } : {}),
    ...(cotistas != null ? { cotistas } : {}),
    ...(aviso ? { aviso } : {}),
  }
}

/**
 * Junta as linhas do arquivo "complemento" (valor patrimonial e DY) com as do arquivo
 * "geral" (ISIN e nome) e devolve, por fundo da configuração, os rendimentos por cota dos
 * meses mais recentes.
 */
export function montarRendimentos(linhasComplemento, linhasGeral, fundosConfig, mesesHistorico = MESES_ANALISE) {
  const base = prepararBase(linhasComplemento, linhasGeral)
  return fundosConfig.map((fundo) => rendimentosDoFundo(base, fundo, mesesHistorico))
}

/** "2026-07" menos n meses → "2026-04". */
export function subtrairMeses(competencia, n) {
  const [ano, mes] = competencia.split('-').map(Number)
  const total = ano * 12 + (mes - 1) - n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/**
 * Lista ampla (decisão D12): os fundos em destaque (config.fundos, os 10 do IFIX) e todos
 * os demais FIIs do informe que tenham ISIN de cota.
 *
 * - O ticker dos demais é o prefixo do ISIN + "11", o padrão das cotas de FII na B3. Se
 *   o código não existir na bolsa, a brapi responde 404 e o fundo fica de fora.
 * - Fundos sem informe nos últimos `mesesMaximoAtraso` meses (em relação ao mês mais
 *   recente do arquivo) são tratados como encerrados ou inadimplentes com a CVM.
 * - `minimoCotistas` descarta fundos fechados/restritos, que em geral não são negociados
 *   em bolsa, e poupa requisições da brapi. Só vale se a coluna existir no informe.
 * - Ordem: destaques na ordem da configuração; depois os demais, do maior patrimônio para
 *   o menor. Se o limite de requisições da brapi acabar, faltam só os menores.
 *
 * Um erro num fundo em destaque é devolvido como erro (o script decide se aborta). Nos
 * demais, vira item de `ignorados`, sem derrubar nada.
 */
export function montarTodosOsFundos(
  linhasComplemento,
  linhasGeral,
  { destaques = [], mesesMaximoAtraso = 3, minimoCotistas = 0, mesesHistorico = MESES_ANALISE, renomeados = {} } = {},
) {
  const base = prepararBase(linhasComplemento, linhasGeral)
  const limite = base.competenciaMaisRecente ? subtrairMeses(base.competenciaMaisRecente, mesesMaximoAtraso - 1) : ''

  const resultadosDestaque = destaques.map((fundo) => ({ ...rendimentosDoFundo(base, fundo, mesesHistorico), destaque: true }))
  const prefixosDestaque = new Set(destaques.map((f) => f.ticker.slice(0, 4).toUpperCase()))
  for (const r of resultadosDestaque) if (r.cnpj) prefixosDestaque.add(base.cadastro.get(r.cnpj)?.prefixo)

  // Ticker da B3 sempre começa com letra. Prefixo de ISIN começando com número (ex.:
  // "0D70") é código interno de fundo não listado: fica de fora sem gastar requisição.
  const prefixos = new Set(
    [...base.cadastro.values()].map((i) => i.prefixo).filter((p) => p && /^[A-Z]/.test(p) && !prefixosDestaque.has(p)),
  )

  const outros = []
  const ignorados = []
  let poucosCotistas = 0
  for (const prefixo of prefixos) {
    // O ISIN não muda quando o fundo troca de código na B3 (ex.: RVBI11 → PSEC11 em
    // 24/10/2025). "renomeados" na configuração leva do código antigo ao atual.
    const tickerIsin = `${prefixo}11`
    const ticker = renomeados[tickerIsin] ?? tickerIsin
    const r = { ...rendimentosDoFundo(base, { ticker: tickerIsin }, mesesHistorico), ticker }
    if (ticker !== tickerIsin) r.tickerAnterior = tickerIsin
    if (r.erro) {
      // CNPJ ambíguo é um fundo real com código certo: vai para "indisponiveis", para a
      // tela não mandar a pessoa conferir um código que está correto.
      const motivo = /mais de um CNPJ/.test(r.erro) ? 'cadastro-ambiguo' : 'sem-dados'
      ignorados.push({ ticker, motivo, detalhe: r.erro })
      continue
    }
    if (r.ultimaCompetencia < limite) {
      ignorados.push({ ticker, nome: r.nome, motivo: 'sem-informe-recente', detalhe: `último informe em ${r.ultimaCompetencia}` })
      continue
    }
    if (minimoCotistas > 0 && r.cotistas != null && r.cotistas < minimoCotistas) {
      poucosCotistas++
      continue
    }
    outros.push(r)
  }
  outros.sort((a, b) => (b.patrimonio ?? -1) - (a.patrimonio ?? -1) || a.ticker.localeCompare(b.ticker))

  return { resultados: [...resultadosDestaque, ...outros], ignorados, poucosCotistas, competenciaMaisRecente: base.competenciaMaisRecente }
}

function mediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
}

/**
 * Escolhe o rendimento a publicar: o mês mais recente cujo valor fica dentro da tolerância
 * em torno da mediana dos meses analisados.
 *
 * Por quê: a estimativa a partir do informe da CVM se aproxima do resultado contábil do mês
 * por cota, não do rendimento anunciado. Em meses de emissão de cotas ou de fechamento de
 * semestre ela se distorce (validação de 24/09/2026: GGRC11 +50% em jul, MXRF11 -25% em jul,
 * TRXF11 +57% em jun). A mediana de vários meses é resistente a esses pontos fora da curva.
 *
 * `rendimentos` vem do mais recente para o mais antigo. Com menos de 3 meses não há
 * referência confiável: publica o mais recente e avisa.
 *
 * Com `aceitarVariavel`, quando nenhum mês fica dentro da tolerância, publica o mês mais
 * próximo da mediana (empate: o mais recente) e devolve `variavel: true`.
 */
export function escolherRendimento(rendimentos, tolerancia = TOLERANCIA_PADRAO, { aceitarVariavel = false } = {}) {
  if (rendimentos.length === 0) return { escolhido: null, descartados: [], referencia: null }
  if (rendimentos.length < 3) {
    return { escolhido: rendimentos[0], descartados: [], referencia: null, semReferencia: true }
  }
  const referencia = mediana(rendimentos.map((r) => r.valorPorCota))
  const descartados = []
  for (const r of rendimentos) {
    const desvio = referencia > 0 ? Math.abs(r.valorPorCota - referencia) / referencia : Infinity
    if (desvio <= tolerancia) return { escolhido: r, descartados, referencia }
    descartados.push({ ...r, desvio })
  }
  if (aceitarVariavel && referencia > 0) {
    // Fundo cujo rendimento varia de verdade (ex.: CRI atrelado ao IPCA, como o VGIP11):
    // nenhum mês fica perto da mediana, mas o mais próximo dela é o retrato mais típico.
    // Usado só fora dos destaques e sempre publicado como baixa confiança (decisão D12).
    const maisProximo = descartados.reduce((a, b) => (b.desvio < a.desvio ? b : a))
    const { desvio: _desvio, ...escolhido } = maisProximo
    return { escolhido, descartados: descartados.filter((d) => d !== maisProximo), referencia, variavel: true }
  }
  return { escolhido: null, descartados, referencia }
}

/** Quantos dos meses mais recentes repetem exatamente o mesmo valor (sinal de informe replicado). */
export function mesesIdenticos(rendimentos) {
  if (rendimentos.length === 0) return 0
  let n = 1
  while (n < rendimentos.length && rendimentos[n].valorPorCota === rendimentos[0].valorPorCota) n++
  return n
}

/** Confere se o rendimento estimado faz sentido diante da cotação. */
export function rendimentoPlausivel(valorPorCota, cotacao) {
  if (!(cotacao > 0) || !(valorPorCota > 0)) return false
  const pct = (valorPorCota / cotacao) * 100
  return pct >= RENDIMENTO_MENSAL_MIN_PCT && pct <= RENDIMENTO_MENSAL_MAX_PCT
}

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Setor exibido na tela (D13), a partir do segmento e do mandato que o próprio fundo
 * declara no Informe Mensal da CVM. A classificação da CVM tem nomes técnicos ("Títulos e
 * Val. Mob."); aqui viram nomes que o investidor reconhece. `correcao` (config "setores")
 * vence tudo, para os casos em que o fundo se declara de um jeito e o mercado o vê de outro.
 */
export function setorDoFundo({ nome = '', segmento = '', mandato = '', correcao = null } = {}) {
  if (correcao) return correcao
  const n = semAcento(nome)
  const seg = semAcento(segmento)
  const man = semAcento(mandato)
  if (/\bfof\b|\bfofii\b|fundo de fundos|fdo de fundos|\bfundos de investimento imobiliario\b/.test(n)) return 'Fundo de fundos'
  // O mandato vem antes do segmento: muitos fundos de CRI se declaram "Híbrido" no segmento,
  // mas o mandato "Títulos e Valores Mobiliários" diz o que eles são (1ª execução da D13).
  if (/titulos|valores mob/.test(man)) return 'Papel (CRI)'
  if (/logist|galpo|industrial/.test(seg)) return 'Logística'
  if (/shopping/.test(seg)) return 'Shoppings'
  if (/laje|corporativ|escritori/.test(seg)) return 'Escritórios'
  if (/titulos|val\.? ?mob|valores mob|receb|cri\b/.test(seg)) return 'Papel (CRI)'
  if (/hospital|saude/.test(seg)) return 'Saúde'
  if (/hotel/.test(seg)) return 'Hotéis'
  if (/residenc/.test(seg)) return 'Residencial'
  if (/agencia|varejo|renda urbana/.test(seg)) return 'Varejo e renda urbana'
  if (/educac/.test(seg)) return 'Educacional'
  if (/hibrido|multi/.test(seg)) return 'Híbrido'
  if (/titulos|valores mob/.test(man) || /\bcri\b|recebiveis|credito imob/.test(n)) return 'Papel (CRI)'
  return 'Outros'
}

/**
 * Volume financeiro médio diário (R$) das últimas `sessoes` sessões do histórico da brapi.
 * O campo `volume` do histórico é quantidade de cotas; volume × fechamento dá reais. Dias
 * sem negócio entram como zero, porque liquidez é justamente a frequência de negócios.
 */
export function volumeMedioDiario(historico, sessoes = 21) {
  if (!Array.isArray(historico) || historico.length === 0) return null
  const dias = historico
    .filter((d) => d && typeof d.close === 'number')
    .sort((a, b) => (a.date ?? 0) - (b.date ?? 0))
    .slice(-sessoes)
  if (dias.length === 0) return null
  const total = dias.reduce((soma, d) => soma + (Number(d.volume) > 0 ? Number(d.volume) * d.close : 0), 0)
  return total / dias.length
}

/**
 * Sinais de que a estimativa merece menos confiança (o fundo é publicado, mas a tela avisa):
 *   poucos-meses      menos de 3 meses de informe: não houve conferência pela mediana
 *   rendimento-variavel  nenhum mês perto da mediana; publicado o mais próximo dela
 *   mes-antigo        mês publicado 3 ou mais meses atrás do mais recente do informe
 *   valor-repetido    3 ou mais meses seguidos com o mesmo valor: possível informe replicado
 *   pouca-negociacao  cotação mais antiga que `diasMaxCotacao`: o fundo quase não negocia,
 *                     e a cotação exibida pode estar longe do preço atual
 */
export function avaliarConfianca({
  semReferencia = false,
  variavel = false,
  identicos = 1,
  dataCotacao = null,
  competencia = null,
  competenciaMaisRecente = null,
  hoje = new Date(),
  diasMaxCotacao = 7,
}) {
  const motivos = []
  if (semReferencia) motivos.push('poucos-meses')
  if (variavel) motivos.push('rendimento-variavel')
  if (identicos >= MESES_IDENTICOS_SUSPEITOS) motivos.push('valor-repetido')
  // O informe já tem 1 a 2 meses de atraso; 3 meses ou mais atrás do mês mais recente do
  // arquivo quer dizer que os meses recentes do fundo foram descartados ou faltam.
  if (competencia && competenciaMaisRecente && competencia < subtrairMeses(competenciaMaisRecente, 2)) motivos.push('mes-antigo')
  if (dataCotacao) {
    const dias = (hoje.getTime() - new Date(`${dataCotacao.slice(0, 10)}T12:00:00Z`).getTime()) / 86_400_000
    if (dias > diasMaxCotacao) motivos.push('pouca-negociacao')
  }
  return motivos
}

/**
 * Serializa o arquivo com um fundo por linha: centenas de fundos no formato indentado
 * deixariam o diff mensal ilegível no GitHub; tudo numa linha só também.
 */
export function formatarSnapshot(snapshot) {
  const linhasDe = (lista) => (lista.length === 0 ? '[]' : `[\n${lista.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`)
  const campos = Object.entries(snapshot).map(([chave, valor]) => {
    const texto = Array.isArray(valor) && valor.length > 0 && typeof valor[0] === 'object' ? linhasDe(valor) : JSON.stringify(valor)
    return `  ${JSON.stringify(chave)}: ${texto}`
  })
  return `{\n${campos.join(',\n')}\n}\n`
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

class ErroBrapi extends Error {
  constructor(mensagem, status) {
    super(mensagem)
    this.status = status
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function buscarCotacao(ticker, token) {
  const resposta = await fetch(URL_BRAPI(ticker), { headers: { Authorization: `Bearer ${token}` } })
  if (!resposta.ok) throw new ErroBrapi(`brapi respondeu ${resposta.status} para ${ticker}.`, resposta.status)
  const corpo = await resposta.json()
  const resultado = corpo?.results?.[0]
  const preco = resultado?.regularMarketPrice
  if (typeof preco !== 'number' || !(preco > 0)) throw new ErroBrapi(`brapi não trouxe cotação válida para ${ticker}.`, 200)
  const data = resultado.regularMarketTime ? String(resultado.regularMarketTime).slice(0, 10) : new Date().toISOString().slice(0, 10)
  return {
    cotacao: Math.round(preco * 100) / 100,
    dataCotacao: data,
    volumeMedio: volumeMedioDiario(resultado.historicalDataPrice, SESSOES_LIQUIDEZ),
  }
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

  const amplo = { ativo: true, mesesMaximoAtraso: 3, minimoCotistas: 100, maxRequisicoesBrapi: 800, pausaEntreRequisicoesMs: 300, pausaAposLimiteMs: 60_000, minimoFundosTotal: 20, publicarVariaveis: true, volumeMinimoDiario: 1_000_000, ...(config.outrosFundos ?? {}) }

  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvm-fii-'))
  const anoAtual = new Date().getFullYear()
  const complemento = []
  const geral = []
  // Ano anterior sempre entra: em jan a jun os 6 meses mais recentes cruzam a virada do ano.
  for (const ano of [anoAtual - 1, anoAtual]) {
    const dados = await baixarInformesCvm(ano, pastaTemp)
    if (!dados) continue
    complemento.push(...dados.complemento)
    geral.push(...dados.geral)
  }

  const { resultados, ignorados, poucosCotistas, competenciaMaisRecente } = amplo.ativo
    ? montarTodosOsFundos(complemento, geral, {
        destaques: config.fundos,
        mesesMaximoAtraso: amplo.mesesMaximoAtraso,
        minimoCotistas: amplo.minimoCotistas,
        renomeados: Object.fromEntries(Object.entries(config.renomeados ?? {}).filter(([k]) => !k.startsWith('_'))),
      })
    : { resultados: montarRendimentos(complemento, geral, config.fundos).map((r) => ({ ...r, destaque: true })), ignorados: [], poucosCotistas: 0, competenciaMaisRecente: null }

  // Diagnóstico: fundos listados em outrosFundos.depurar têm os meses analisados impressos
  // no log, para entender por que um fundo específico ficou de fora.
  const depurar = new Set((amplo.depurar ?? []).map((t) => String(t).toUpperCase()))
  for (const t of depurar) {
    const ign = ignorados.find((i) => i.ticker === t)
    if (ign) console.log(`[depurar] ${t}: ignorado antes da análise (${ign.motivo}${ign.detalhe ? `: ${ign.detalhe}` : ''}).`)
    else if (!resultados.some((r) => r.ticker === t)) console.log(`[depurar] ${t}: não está entre os candidatos (código inexistente no informe, prefixo de ISIN diferente ou menos de ${amplo.minimoCotistas} cotistas).`)
  }

  console.log(
    `[info] Informe da CVM até ${competenciaMaisRecente ?? '?'}: ${resultados.length} fundos candidatos ` +
      `(${config.fundos.length} em destaque), ${ignorados.length} ignorados, ${poucosCotistas} com menos de ${amplo.minimoCotistas} cotistas.`,
  )

  const fundos = []
  const indisponiveis = ignorados
    .filter((i) => i.motivo === 'sem-informe-recente' || i.motivo === 'cadastro-ambiguo')
    .map(({ ticker, nome, motivo }) => ({ ticker, nome: nome ?? ticker, motivo }))
  for (const i of ignorados.filter((x) => x.motivo === 'cadastro-ambiguo')) console.log(`[info] ${i.ticker}: ${i.detalhe}`)
  const problemasDestaque = []
  let requisicoes = 0
  let naoListados = 0
  let semCotacao = 0
  let limiteEsgotado = false
  let semHistorico = 0
  const poucaLiquidez = []
  const destaquesComDado = new Set() // destaques que passaram nas checagens, antes do corte de liquidez
  const setoresCorrigidos = Object.fromEntries(Object.entries(config.setores ?? {}).filter(([k]) => !k.startsWith('_')))
  const fmt = (v) => v.toFixed(4).replace('.', ',')

  for (const r of resultados) {
    // Problemas nos fundos em destaque aparecem sempre no log e contam para a trava de
    // publicação; nos demais, o fundo só fica de fora (ou vai para "indisponiveis").
    const registrar = (motivo, mensagem) => {
      if (r.destaque) problemasDestaque.push(`${r.ticker}: ${mensagem}`)
      if (motivo) indisponiveis.push({ ticker: r.ticker, nome: r.nome ?? r.ticker, motivo })
    }

    if (r.erro) {
      registrar(null, r.erro)
      continue
    }
    if (r.aviso && r.destaque) console.log(`[info] ${r.ticker}: ${r.aviso}`)

    const fundoConfig = r.destaque ? config.fundos.find((f) => f.ticker === r.ticker) ?? {} : {}
    const tolerancia = fundoConfig.tolerancia ?? config.toleranciaPadrao ?? TOLERANCIA_PADRAO
    const { escolhido, descartados, referencia, semReferencia, variavel } = escolherRendimento(r.rendimentos, tolerancia, {
      aceitarVariavel: !r.destaque && amplo.publicarVariaveis,
    })
    if (r.destaque) {
      for (const d of descartados) {
        console.log(
          `[info] ${r.ticker}: ${d.competencia} descartado (${fmt(d.valorPorCota)} está ${Math.round(d.desvio * 100)}% ` +
            `da mediana de ${fmt(referencia)}; tolerância ${Math.round(tolerancia * 100)}%).`,
        )
      }
      if (semReferencia) console.warn(`[aviso] ${r.ticker}: só ${r.rendimentos.length} mês(es) de informe; publicado sem conferência pela mediana.`)
    }
    if (depurar.has(r.ticker)) {
      const meses = r.rendimentos.map((x) => `${x.competencia}=${x.valorPorCota.toFixed(4)}`).join(' ')
      console.log(
        `[depurar] ${r.ticker} (CNPJ ${r.cnpj}): ${meses} | mediana ${referencia != null ? referencia.toFixed(4) : '—'} | ` +
          `escolhido ${escolhido ? `${escolhido.competencia}=${escolhido.valorPorCota.toFixed(4)}` : 'nenhum'}${variavel ? ' (variável)' : ''}`,
      )
    }
    if (r.rendimentos.every((x) => !(x.valorPorCota > 0))) {
      // Caso VGIP11/VGIR11: o fundo não preenche o DY no informe. Não há o que estimar.
      registrar('sem-dy-informado', `nenhum dos ${r.rendimentos.length} meses tem rendimento informado à CVM.`)
      continue
    }
    if (!escolhido) {
      registrar('rendimento-atipico', `nenhum dos ${r.rendimentos.length} meses ficou dentro da tolerância de ${Math.round(tolerancia * 100)}% em torno da mediana.`)
      continue
    }
    if (!(escolhido.valorPorCota > 0)) {
      // Fundo que não distribuiu no mês escolhido (DY zero): nada a simular.
      registrar('sem-rendimento', 'sem rendimento distribuído no mês de referência.')
      continue
    }
    const identicos = mesesIdenticos(r.rendimentos)
    if (identicos >= MESES_IDENTICOS_SUSPEITOS && r.destaque) {
      console.warn(`[aviso] ${r.ticker}: os ${identicos} meses mais recentes têm valor idêntico (${fmt(r.rendimentos[0].valorPorCota)}). Possível informe replicado: conferir com o valor anunciado pelo fundo.`)
    }

    if (limiteEsgotado || requisicoes >= amplo.maxRequisicoesBrapi) {
      limiteEsgotado = true
      if (r.destaque) problemasDestaque.push(`${r.ticker}: limite de requisições da brapi atingido antes deste fundo.`)
      semCotacao++
      continue
    }

    let cotacaoObtida
    try {
      // Sequencial de propósito: o plano gratuito da brapi aceita 1 ativo por requisição.
      // A pausa entre chamadas evita estourar o limite por minuto com centenas de fundos.
      if (requisicoes > 0) await esperar(amplo.pausaEntreRequisicoesMs)
      requisicoes++
      try {
        try {
          cotacaoObtida = await buscarCotacao(r.ticker, token)
        } catch (erro) {
          // Código renomeado que a brapi ainda não conhece: tenta o antigo antes de desistir.
          if (!r.tickerAnterior || (erro.status !== 404 && erro.status !== 400)) throw erro
          requisicoes++
          cotacaoObtida = await buscarCotacao(r.tickerAnterior, token)
        }
      } catch (erro) {
        if (erro.status !== 429) throw erro
        console.warn(`[aviso] brapi pediu para desacelerar (429) em ${r.ticker}; nova tentativa em ${Math.round(amplo.pausaAposLimiteMs / 1000)} s.`)
        await esperar(amplo.pausaAposLimiteMs)
        requisicoes++
        cotacaoObtida = await buscarCotacao(r.ticker, token)
      }
    } catch (erro) {
      if (erro.status === 429) {
        // Segundo 429 seguido: cota do plano acabou. Publica o que já tem.
        limiteEsgotado = true
        console.warn('[aviso] brapi continuou recusando (429). Os fundos restantes ficam sem cotação neste mês.')
        if (r.destaque) problemasDestaque.push(`${r.ticker}: ${erro.message}`)
        semCotacao++
        continue
      }
      if (!r.destaque && (erro.status === 404 || erro.status === 400)) {
        naoListados++ // código "XXXX11" não existe na B3: fundo não listado, fica de fora em silêncio
        continue
      }
      registrar('sem-cotacao', erro.message)
      semCotacao++
      continue
    }

    const { cotacao, dataCotacao, volumeMedio } = cotacaoObtida
    if (!rendimentoPlausivel(escolhido.valorPorCota, cotacao)) {
      const pct = ((escolhido.valorPorCota / cotacao) * 100).toFixed(2)
      registrar('fora-da-faixa', `rendimento estimado de ${pct}% ao mês sobre a cota está fora da faixa plausível.`)
      continue
    }
    if (r.destaque) destaquesComDado.add(r.ticker)
    // Todos os fundos com dado são publicados: os de volume acima do corte formam a lista
    // por setor; os demais aparecem só pela busca, com aviso de liquidez (D13).
    if (volumeMedio == null) {
      semHistorico++
      if (r.destaque) problemasDestaque.push(`${r.ticker}: brapi não devolveu histórico de volume.`)
    } else {
      if (depurar.has(r.ticker)) console.log(`[depurar] ${r.ticker}: volume médio R$ ${Math.round(volumeMedio).toLocaleString('pt-BR')}/dia.`)
      if (volumeMedio < amplo.volumeMinimoDiario) poucaLiquidez.push(r.ticker)
    }

    const motivos = avaliarConfianca({ semReferencia, variavel, identicos, dataCotacao, competencia: escolhido.competencia, competenciaMaisRecente })
    // Publica só o mês escolhido: a tela mostra o último rendimento típico, sem média (D10).
    fundos.push({
      ticker: r.ticker,
      ...(r.tickerAnterior ? { tickerAnterior: r.tickerAnterior } : {}),
      nome: r.nome,
      setor: setorDoFundo({ nome: r.nome, segmento: r.segmento, mandato: r.mandato, correcao: setoresCorrigidos[r.ticker] }),
      volumeMedio: volumeMedio == null ? null : Math.round(volumeMedio / 1000) * 1000,
      cotacao,
      dataCotacao,
      rendimentos: [escolhido],
      ...(motivos.length > 0 ? { confianca: 'baixa', motivosConfianca: motivos } : {}),
    })
  }

  for (const p of problemasDestaque) console.warn(`[aviso] ${p}`)
  const baixaConfianca = fundos.filter((f) => f.confianca === 'baixa').length
  console.log(
    `[info] brapi: ${requisicoes} requisições, ${naoListados} códigos não listados na B3, ${semCotacao} sem cotação, ` +
      `${semHistorico} sem histórico de volume${limiteEsgotado ? ' (limite atingido)' : ''}.`,
  )
  const mi = (v) => `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  const liquidos = fundos.filter((f) => f.volumeMedio != null && f.volumeMedio >= amplo.volumeMinimoDiario)
  console.log(
    `[info] Liquidez: ${liquidos.length} fundos acima de ${mi(amplo.volumeMinimoDiario)}/dia na lista por setor; ` +
      `${poucaLiquidez.length} abaixo do corte e ${semHistorico} sem histórico, só na busca. ` +
      `Total com dado: ${fundos.length} (${baixaConfianca} com baixa confiança); indisponíveis: ${indisponiveis.length}.`,
  )
  const porVolume = [...liquidos].sort((a, b) => b.volumeMedio - a.volumeMedio)
  if (porVolume.length > 0) {
    // Para conferir por amostragem num site de cotações: os mais e os menos negociados da lista.
    console.log(`[info] Mais negociados: ${porVolume.slice(0, 5).map((f) => `${f.ticker} ${mi(f.volumeMedio)}`).join(', ')}.`)
    console.log(`[info] Menos negociados da lista: ${porVolume.slice(-3).map((f) => `${f.ticker} ${mi(f.volumeMedio)}`).join(', ')}.`)
  }
  const porSetor = {}
  for (const f of liquidos) (porSetor[f.setor] ??= []).push(f.ticker)
  const setoresOrdenados = Object.entries(porSetor).sort((a, b) => b[1].length - a[1].length)
  console.log(`[info] Setores: ${setoresOrdenados.map(([s, t]) => `${s} ${t.length}`).join(', ')}.`)
  // Um por linha, para revisar a classificação e corrigir no bloco "setores" da configuração.
  for (const [setor, tickers] of setoresOrdenados) console.log(`[setor] ${setor}: ${tickers.sort().join(', ')}`)

  // Trava 1: os 10 maiores do IFIX precisam ter passado nas checagens de dado e cotação.
  // Servem de amostra de controle: se eles falham, o problema é geral (CVM ou brapi).
  const minimo = config.minimoFundosParaPublicar ?? Math.ceil(config.fundos.length * 0.8)
  if (destaquesComDado.size < minimo) {
    throw new Error(`Só ${destaquesComDado.size} de ${config.fundos.length} fundos de controle (IFIX) ficaram válidos (mínimo ${minimo}). Arquivo NÃO atualizado.`)
  }
  // Trava 2: sem histórico de volume para ninguém, o plano da brapi mudou ou o parâmetro range deixou de valer.
  if (semHistorico > 0 && liquidos.length === 0) {
    throw new Error('A brapi não devolveu histórico de volume (range=1mo) para nenhum fundo. Confira o plano e a documentação. Arquivo NÃO atualizado.')
  }
  // Trava 3: a lista não pode encolher de repente.
  if (liquidos.length < amplo.minimoFundosTotal) {
    throw new Error(`Só ${liquidos.length} fundos passaram no critério de liquidez (mínimo ${amplo.minimoFundosTotal}). Arquivo NÃO atualizado.`)
  }

  const snapshot = {
    geradoEm: new Date().toISOString(),
    volumeMinimoDiario: amplo.volumeMinimoDiario,
    sessoesLiquidez: SESSOES_LIQUIDEZ,
    fundos: fundos.sort((a, b) => a.ticker.localeCompare(b.ticker)),
    indisponiveis: indisponiveis.sort((a, b) => a.ticker.localeCompare(b.ticker)),
  }
  fs.writeFileSync(ARQUIVO_SAIDA, formatarSnapshot(snapshot))
  console.log(`rendimentosFii.json atualizado: ${liquidos.length} fundos na lista por setor, ${fundos.length} na busca.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
