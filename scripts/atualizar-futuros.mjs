// Atualização diária dos dados do Simule Futuros (índice, dólar, juros e agro da B3).
//
// Roda nos dias úteis pelo GitHub Actions (.github/workflows/atualizar-futuros.yml) ou à mão:
//   node scripts/atualizar-futuros.mjs                      (dia a dia)
//   node scripts/atualizar-futuros.mjs --carga-inicial=260  (uma vez, histórico)
//
// Fonte: Boletim de Preços oficial da B3 (BVBG.086, scripts/b3-boletim.mjs), o mesmo dos ETFs.
// Conferido em 21/10/2026: o boletim traz IND, WIN, DOL, WDO, DI1, BGI, CCM e ICF com preço de
// ajuste (AdjstdQt) e ajuste anterior (PrvsAdjstdQt); abertura, máxima, mínima e último preço
// só vêm nos contratos que negociaram no dia (em geral o vencimento mais líquido).
//
// Histórico próprio (historico/futuros.json): por pregão, o vencimento de maior posição em
// aberto de cada produto (o "contínuo", como INDFUT e DOLFUT nas plataformas) e, do último
// pregão, todos os vencimentos. Dele saem os candles do gráfico e a leitura de tendência.
//
// Regras de segurança, as mesmas dos demais jobs: dado estranho = o script termina com erro
// SEM gravar nada. Sem pregão novo: nada muda, sem commit.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarBoletim, datasCandidatas, lerBoletim, lerTag } from './b3-boletim.mjs'
import { datasAProcessar } from './atualizar-etfs.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARQUIVO_CONFIG = path.join(RAIZ, 'config', 'futuros.json')
const ARQUIVO_HISTORICO = path.join(RAIZ, 'historico', 'futuros.json')
const ARQUIVO_SAIDA = path.join(RAIZ, 'webapp-src', 'src', 'data', 'futuros.json')

export const MAXIMO_PREGOES_GUARDADOS = 260
const MESES = { F: '01', G: '02', H: '03', J: '04', K: '05', M: '06', N: '07', Q: '08', U: '09', V: '10', X: '11', Z: '12' }
const PADRAO_TICKER = /^([A-Z][A-Z0-9]{2})([FGHJKMNQUVXZ])(\d{2})$/

// ---------------------------------------------------------------------------------------
// Funções puras (testadas em atualizar-futuros.test.mjs)
// ---------------------------------------------------------------------------------------

const numeroOuNull = (texto) => {
  if (texto === null || texto === undefined || texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

/** Separa o código do produto e o vencimento (AAAA-MM) de um código como WINZ26. null se não for contrato futuro. */
export function lerTicker(ticker) {
  const m = PADRAO_TICKER.exec(String(ticker ?? '').toUpperCase())
  return m ? { produto: m[1], vencimento: `20${m[3]}-${MESES[m[2]]}` } : null
}

/** Extrai um contrato futuro de um bloco <PricRpt>. Devolve null sem código, data ou preço de ajuste. */
export function extrairFuturo(bloco) {
  const ticker = lerTag(bloco, 'TckrSymb')
  const data = lerTag(bloco, 'Dt')
  const ajuste = numeroOuNull(lerTag(bloco, 'AdjstdQt'))
  if (!ticker || !data || ajuste === null || !lerTicker(ticker)) return null
  return {
    ticker: ticker.toUpperCase(),
    data,
    ajuste,
    ajusteAnterior: numeroOuNull(lerTag(bloco, 'PrvsAdjstdQt')),
    abertura: numeroOuNull(lerTag(bloco, 'FrstPric')),
    maxima: numeroOuNull(lerTag(bloco, 'MaxPric')),
    minima: numeroOuNull(lerTag(bloco, 'MinPric')),
    ultimo: numeroOuNull(lerTag(bloco, 'LastPric')),
    volume: numeroOuNull(lerTag(bloco, 'FinInstrmQty')),
    posicaoAberta: numeroOuNull(lerTag(bloco, 'OpnIntrst')),
    negocios: numeroOuNull(lerTag(bloco, 'RglrTxsQty')),
  }
}

/**
 * Como extrairFuturo, mas só aceita o bloco da data do boletim. O boletim de um pregão também traz, para boi, milho e café,
 * um segundo bloco do mesmo contrato com a data do dia seguinte (a sessão da noite, conferido em 21/10/2026); sem este filtro
 * ele sobrescreveria o bloco do dia.
 */
export function extrairFuturoDoDia(bloco, data) {
  const futuro = extrairFuturo(bloco)
  return futuro && futuro.data === data ? futuro : null
}

const vencimentoDe = (ticker) => lerTicker(ticker).vencimento

/** Vencimento de maior posição em aberto; no empate, o mais próximo. */
export function escolherVertice(itens) {
  const ordenados = itens.filter((i) => i.ajuste !== null).sort((a, b) => vencimentoDe(a.ticker).localeCompare(vencimentoDe(b.ticker)))
  if (!ordenados.length) return null
  return ordenados.reduce((melhor, i) => ((i.posicaoAberta ?? 0) > (melhor.posicaoAberta ?? 0) ? i : melhor))
}

export function historicoVazio() {
  return { pregoes: [], dias: {}, ultimoDia: null }
}

/**
 * Inclui (ou substitui) o pregão `data`. `contratos` é a lista de contratos do dia (todos os produtos).
 * Cada produto guarda, por pregão, o vencimento escolhido: {t, a, p, o, h, l, c, v, i} (ticker, ajuste,
 * ajuste anterior, abertura, máxima, mínima, último, contratos negociados, posição em aberto) ou null.
 * `ultimoDia` guarda todos os vencimentos do pregão mais recente.
 */
export function incorporarPregao(historico, data, contratos, codigos, maximo = MAXIMO_PREGOES_GUARDADOS) {
  const pregoes = [...historico.pregoes]
  const dias = Object.fromEntries(Object.entries(historico.dias).map(([c, serie]) => [c, [...serie]]))
  let indice = pregoes.indexOf(data)
  if (indice === -1) {
    indice = pregoes.findIndex((p) => p > data)
    if (indice === -1) indice = pregoes.length
    pregoes.splice(indice, 0, data)
    for (const codigo of Object.keys(dias)) dias[codigo].splice(indice, 0, null)
  }
  for (const codigo of codigos) {
    if (!dias[codigo]) dias[codigo] = pregoes.map(() => null)
    const v = escolherVertice(contratos.filter((c) => lerTicker(c.ticker)?.produto === codigo))
    dias[codigo][indice] = v
      ? { t: v.ticker, a: v.ajuste, p: v.ajusteAnterior, o: v.abertura, h: v.maxima, l: v.minima, c: v.ultimo, v: v.volume, i: v.posicaoAberta }
      : null
  }
  const excesso = Math.max(0, pregoes.length - maximo)
  if (excesso > 0) {
    pregoes.splice(0, excesso)
    for (const codigo of Object.keys(dias)) dias[codigo].splice(0, excesso)
  }
  const atual = historico.ultimoDia
  const ultimoDia = !atual || data >= atual.data ? { data, contratos } : atual
  return { pregoes, dias, ultimoDia }
}

const arredondar = (v, casas = 4) => Math.round(v * 10 ** casas) / 10 ** casas

/**
 * Candles do contínuo: [data, abertura, máxima, mínima, fechamento, volume]. Nos produtos de preço e
 * pontos, os vencimentos anteriores são multiplicados pela razão entre o ajuste anterior do novo
 * vencimento e o ajuste do antigo no dia da troca (back-adjust), para não haver salto falso no gráfico.
 * No DI (taxa) não há ajuste: a série é a taxa do vencimento mais líquido, e dia sem negócio fica de fora.
 */
export function serieContinua(pregoes, dias, tipo) {
  const pts = []
  for (let i = 0; i < pregoes.length; i++) if (dias[i]) pts.push({ data: pregoes[i], ...dias[i] })
  const fator = pts.map(() => 1)
  if (tipo !== 'taxa') {
    let acum = 1
    for (let i = pts.length - 2; i >= 0; i--) {
      const prox = pts[i + 1]
      const atual = pts[i]
      if (prox.t !== atual.t && prox.p && atual.a) acum *= prox.p / atual.a
      fator[i] = acum
    }
  }
  const candles = []
  pts.forEach((d, i) => {
    const c = tipo === 'taxa' ? d.c : d.c ?? d.a
    if (c === null || c === undefined) return
    const o = d.o ?? (tipo === 'taxa' ? c : d.p ?? c)
    const h = Math.max(d.h ?? c, o, c)
    const l = Math.min(d.l ?? c, o, c)
    const f = fator[i]
    candles.push([d.data, arredondar(o * f), arredondar(h * f), arredondar(l * f), arredondar(c * f), d.v ?? 0])
  })
  return candles
}

/** Monta o bloco de um produto para o app. */
export function montarProduto(cfg, historico) {
  const doProduto = (historico.ultimoDia?.contratos ?? []).filter((c) => lerTicker(c.ticker)?.produto === cfg.codigo)
  const contratos = [...doProduto]
    .sort((a, b) => vencimentoDe(a.ticker).localeCompare(vencimentoDe(b.ticker)))
    .map((c) => ({
      ticker: c.ticker,
      vencimento: vencimentoDe(c.ticker),
      ajuste: c.ajuste,
      ajusteAnterior: c.ajusteAnterior,
      abertura: c.abertura,
      maxima: c.maxima,
      minima: c.minima,
      ultimo: c.ultimo,
      volume: c.volume,
      posicaoAberta: c.posicaoAberta,
    }))
  return {
    codigo: cfg.codigo,
    apelido: cfg.apelido,
    nome: cfg.nome,
    grupo: cfg.grupo,
    tipo: cfg.tipo,
    multiplicador: cfg.multiplicador,
    moeda: cfg.moeda,
    tick: cfg.tick,
    especificacao: cfg.especificacao,
    vertice: escolherVertice(doProduto)?.ticker ?? null,
    contratos,
    serie: serieContinua(historico.pregoes, historico.dias[cfg.codigo] ?? [], cfg.tipo),
  }
}

/** Histórico em texto, um produto por linha, para o arquivo ficar legível no GitHub. */
export function formatarHistorico(historico) {
  const linhas = Object.keys(historico.dias).sort().map((c) => `    ${JSON.stringify(c)}: ${JSON.stringify(historico.dias[c])}`)
  return [
    '{',
    '  "_leia": "Histórico próprio dos contratos futuros, gerado por scripts/atualizar-futuros.mjs a partir do Boletim de Preços da B3. Cada produto tem um item por pregão, alinhado com \\"pregoes\\": o vencimento de maior posição em aberto {t ticker, a ajuste, p ajuste anterior, o abertura, h máxima, l mínima, c último, v contratos negociados, i posição em aberto} ou null. Não editar à mão.",',
    `  "pregoes": ${JSON.stringify(historico.pregoes)},`,
    `  "dias": {\n${linhas.join(',\n')}\n  },`,
    `  "ultimoDia": ${JSON.stringify(historico.ultimoDia)}`,
    '}',
    '',
  ].join('\n')
}

/** Primeiro produto com menos contratos do que o mínimo, ou undefined. */
export function produtoComPoucosContratos(contratos, codigos, minimo) {
  return codigos.find((c) => contratos.filter((i) => lerTicker(i.ticker)?.produto === c).length < minimo)
}

// ---------------------------------------------------------------------------------------
// Entrada/saída (rede e disco)
// ---------------------------------------------------------------------------------------

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

function argumentoCarga(argv) {
  const achado = argv.find((a) => a.startsWith('--carga-inicial'))
  if (!achado) return 0
  const n = Number(achado.split('=')[1] ?? MAXIMO_PREGOES_GUARDADOS)
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAXIMO_PREGOES_GUARDADOS) : MAXIMO_PREGOES_GUARDADOS
}

function gravarHistorico(historico) {
  fs.mkdirSync(path.dirname(ARQUIVO_HISTORICO), { recursive: true })
  fs.writeFileSync(ARQUIVO_HISTORICO, formatarHistorico(historico))
}

async function main() {
  const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG, 'utf8'))
  if (config.conferidoPeloResponsavel !== true) {
    throw new Error('config/futuros.json ainda não foi conferido. Confira multiplicador, moeda e tick de cada produto na especificação da B3 e marque "conferidoPeloResponsavel": true.')
  }
  const codigos = config.produtos.map((p) => p.codigo)
  const agora = new Date()
  const carga = argumentoCarga(process.argv)
  let historico = lerJson(ARQUIVO_HISTORICO, historicoVazio())

  const quantidade = carga > 0 ? Math.ceil(carga * 1.1) + 10 : config.diasProcuraBoletim ?? 5
  const candidatas = datasCandidatas(agora, quantidade, config.horarioCorteBoletim)
  const faltam = datasAProcessar(candidatas, historico.pregoes, carga > 0)
  const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'futuros-b3-'))
  let novos = 0
  try {
    for (const data of faltam) {
      if (carga > 0 && historico.pregoes.length >= carga) break
      let xml
      try {
        xml = await baixarBoletim(data, pastaTemp)
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
      const lido = await lerBoletim(xml, (t) => PADRAO_TICKER.test(t) && codigos.includes(t.slice(0, 3)), (bloco) => extrairFuturoDoDia(bloco, data))
      fs.rmSync(path.dirname(xml), { recursive: true, force: true })
      const contratos = [...lido.instrumentos.values()]
      const pouco = produtoComPoucosContratos(contratos, codigos, config.minimoContratosPorProduto)
      const problema =
        lido.datas.length !== 1 || lido.datas[0] !== data
          ? `o boletim trouxe a(s) data(s) ${lido.datas.join(', ') || 'nenhuma'}.`
          : pouco
            ? `menos de ${config.minimoContratosPorProduto} contratos de ${pouco}.`
            : null
      if (problema) {
        if (carga > 0) {
          console.warn(`[aviso] ${data}: ${problema} Ignorado.`)
          continue
        }
        throw new Error(`${data}: ${problema} Arquivo NÃO atualizado.`)
      }
      historico = incorporarPregao(historico, data, contratos, codigos)
      novos++
      console.log(`[info] ${data}: ${contratos.length} contratos lidos.`)
      if (carga > 0) {
        if (novos % 20 === 0) {
          gravarHistorico(historico)
          console.log(`[info] Histórico parcial gravado: ${historico.pregoes.length} pregões.`)
        }
        await esperar(config.pausaEntreDownloadsMs ?? 1000)
      }
    }
  } finally {
    fs.rmSync(pastaTemp, { recursive: true, force: true })
  }

  if (carga > 0 && novos > 0) {
    gravarHistorico(historico)
    console.log(`[info] Histórico gravado: ${historico.pregoes.length} pregões (${novos} novos nesta carga).`)
    if (historico.pregoes.length < config.minimoPregoesHistorico) {
      console.warn(`[aviso] Ainda são só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico}). Rode a carga inicial de novo. futuros.json NÃO atualizado.`)
      return
    }
  }

  const saidaAtual = lerJson(ARQUIVO_SAIDA, null)
  if (novos === 0 && saidaAtual?.dataPregao) {
    console.log(`Sem pregão novo desde ${historico.pregoes[historico.pregoes.length - 1] ?? 'nenhum'}: arquivos mantidos.`)
    return
  }
  if (historico.pregoes.length < config.minimoPregoesHistorico || !historico.ultimoDia) {
    throw new Error(`O histórico tem só ${historico.pregoes.length} pregões (mínimo ${config.minimoPregoesHistorico}). Rode a carga inicial (workflow "Carga inicial de futuros"). Arquivo NÃO atualizado.`)
  }
  const dataPregao = historico.pregoes[historico.pregoes.length - 1]
  const diasDesdePregao = (agora.getTime() - Date.parse(`${dataPregao}T21:00:00Z`)) / 86_400_000
  if (diasDesdePregao > 7) {
    throw new Error(`O pregão mais recente do histórico é de ${dataPregao}, mais de 7 dias atrás. Arquivo NÃO atualizado.`)
  }

  const produtos = config.produtos.map((cfg) => montarProduto(cfg, historico))
  const vazio = produtos.find((p) => p.contratos.length < config.minimoContratosPorProduto || p.serie.length < config.minimoPregoesHistorico)
  if (vazio) {
    throw new Error(`${vazio.codigo}: ${vazio.contratos.length} contratos e ${vazio.serie.length} candles (mínimos ${config.minimoContratosPorProduto} e ${config.minimoPregoesHistorico}). Arquivo NÃO atualizado.`)
  }

  const snapshot = {
    geradoEm: agora.toISOString(),
    dataPregao,
    fonte: 'B3 - Boletim de Preços (BVBG.086)',
    pregoesNoHistorico: historico.pregoes.length,
    produtos,
  }
  gravarHistorico(historico)
  fs.mkdirSync(path.dirname(ARQUIVO_SAIDA), { recursive: true })
  fs.writeFileSync(ARQUIVO_SAIDA, `${JSON.stringify(snapshot)}\n`)
  console.log(`futuros.json atualizado: ${produtos.length} produtos, pregão de ${dataPregao}, ${historico.pregoes.length} pregões no histórico (${novos} novos).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(`[erro] ${erro.message}`)
    process.exit(1)
  })
}
