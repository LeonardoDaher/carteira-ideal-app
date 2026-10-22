// Histórico de preços das ações a partir do COTAHIST da B3 (D120): até 5 anos de candles diários COM abertura.
//
// Fonte oficial e gratuita: https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_AAAA.ZIP (um zip por ano, ~80 MB, com um
// TXT de largura fixa de 245 colunas, codificação ISO-8859-1). Cada linha de tipo 01 é um papel num pregão, com abertura, máxima,
// mínima, último preço, quantidade e volume financeiro. Só há linha nos dias com negócio.
//
// O COTAHIST NÃO ajusta desdobramentos nem grupamentos: sem tratamento, o gráfico mostraria uma queda de 66% (ou um salto)
// no dia do evento. Este módulo faz duas coisas: aplica os eventos confirmados em config/acoes.json ("desdobramentos") e
// DETECTA os demais. Um evento só é detectado quando três coisas coincidem no mesmo pregão (ver `detectarEventos`): o preço
// muda por um fator inteiro (2, 3, 4, 5, 10...), a quantidade negociada em ações muda na mesma proporção e o volume em reais
// NÃO muda. Queda por notícia ruim tem o volume em reais disparando, então não passa. Bonificação com fator quebrado (por exemplo
// 10%) não é detectável por preço e fica sem ajuste. Dividendos e juros sobre capital próprio também não ajustam a série.
//
// Este módulo só tem funções puras e a leitura em fluxo; o job que grava os arquivos é scripts/atualizar-historico-acoes.mjs.

import { spawn } from 'node:child_process'
import readline from 'node:readline'

export const URL_COTAHIST = (ano) => `https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A${ano}.ZIP`

/** Fatores de desdobramento (ou grupamento, na forma 1/f) que o detector aceita. */
export const FATORES_ACEITOS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 100]
const TOLERANCIA_PRECO = 0.12
const JANELA_MEDIANA = 20

/**
 * Uma linha de 245 colunas do COTAHIST -> papel no pregão, ou null (cabeçalho, rodapé, outro mercado ou outro lote).
 * Mercado à vista (010) em lote padrão (BDI 02) é o preço do papel; o fracionário (BDI 96, código com F no fim) só soma volume.
 */
export function lerLinhaCotahist(linha) {
  if (linha.length < 188 || linha.slice(0, 2) !== '01' || linha.slice(24, 27) !== '010') return null
  const bdi = linha.slice(10, 12)
  if (bdi !== '02' && bdi !== '96') return null
  const numero = (ini, fim) => Number(linha.slice(ini, fim))
  const d = linha.slice(2, 10)
  const abertura = numero(56, 69) / 100
  const maxima = numero(69, 82) / 100
  const minima = numero(82, 95) / 100
  const ultimo = numero(108, 121) / 100
  if (![abertura, maxima, minima, ultimo].every(Number.isFinite) || !(ultimo > 0)) return null
  return {
    data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    bdi,
    codigo: linha.slice(12, 24).trim(),
    abertura, maxima, minima, ultimo,
    quantidade: numero(152, 170),
    volume: numero(170, 188) / 100,
  }
}

/** Percorre o TXT dentro de um zip (via `unzip -p`, em fluxo, sem gravar o TXT) e chama `aoLer` para cada papel de interesse. */
export async function lerZipCotahist(arquivoZip, aoLer) {
  const filho = spawn('unzip', ['-p', arquivoZip], { stdio: ['ignore', 'pipe', 'inherit'] })
  filho.stdout.setEncoding('latin1')
  const terminou = new Promise((resolve, reject) => {
    filho.on('error', reject)
    filho.on('close', (codigo) => (codigo === 0 ? resolve() : reject(new Error(`unzip falhou (código ${codigo}) em ${arquivoZip}`))))
  })
  const rl = readline.createInterface({ input: filho.stdout, crlfDelay: Infinity })
  for await (const linha of rl) {
    const papel = lerLinhaCotahist(linha)
    if (papel) aoLer(papel)
  }
  await terminou
}

/**
 * Junta as linhas lidas em candles por ticker: preço do lote padrão e volume do lote padrão + fracionário (como o Boletim).
 * `alvos` é um Set de códigos; devolve Map(ticker -> candles ordenados por data, sem repetir dia).
 */
export function agruparPorTicker(papeis, alvos) {
  const porTicker = new Map()
  const fracionario = new Map()
  for (const p of papeis) {
    if (p.bdi === '96') {
      const base = p.codigo.endsWith('F') ? p.codigo.slice(0, -1) : null
      if (base && alvos.has(base)) {
        const chave = `${base}|${p.data}`
        fracionario.set(chave, (fracionario.get(chave) ?? 0) + p.volume)
      }
      continue
    }
    if (!alvos.has(p.codigo)) continue
    const lista = porTicker.get(p.codigo) ?? []
    lista.push({ data: p.data, abertura: p.abertura, maxima: p.maxima, minima: p.minima, ultimo: p.ultimo, quantidade: p.quantidade, volume: p.volume })
    porTicker.set(p.codigo, lista)
  }
  for (const [ticker, lista] of porTicker) {
    lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    const unicos = lista.filter((c, i) => i === 0 || c.data !== lista[i - 1].data)
    for (const c of unicos) c.volume += fracionario.get(`${ticker}|${c.data}`) ?? 0
    porTicker.set(ticker, unicos)
  }
  return porTicker
}

function mediana(valores) {
  if (!valores.length) return 0
  const o = [...valores].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/**
 * Desdobramentos e grupamentos prováveis numa série de candles (sem ajuste). Devolve [{ data, fator }] com fator = ações novas por
 * ação antiga (desdobramento 1:3 = 3; grupamento 10:1 = 0.1), no mesmo formato de config/acoes.json.
 *
 * Regra (as três juntas): (1) a abertura do dia fica a um fator inteiro do último fechamento, com o fechamento também na mesma
 * escala; (2) a quantidade de ações negociadas muda na mesma proporção, contra a mediana dos 20 pregões anteriores; (3) o volume em
 * reais fica entre 0,2 e 4 vezes a mediana. Queda por notícia ruim passa em (1), mas o volume em reais dispara e reprova (3).
 */
export function detectarEventos(candles) {
  const eventos = []
  for (let i = 1; i < candles.length; i++) {
    const anterior = candles[i - 1]
    const c = candles[i]
    if (!(anterior.ultimo > 0) || !(c.abertura > 0) || !(c.ultimo > 0)) continue
    const razaoAbertura = c.abertura / anterior.ultimo
    const razaoFechamento = c.ultimo / anterior.ultimo
    const reduz = razaoAbertura < 1
    // Estimativa do fator: média geométrica entre a abertura e o fechamento, que sozinhos oscilam nas ações baratas.
    const fAbertura = reduz ? 1 / razaoAbertura : razaoAbertura
    const fFechamento = reduz ? 1 / razaoFechamento : razaoFechamento
    const f = Math.sqrt(fAbertura * fFechamento)
    if (f < 1.8 || fFechamento < 1.4 || fAbertura < 1.4) continue
    const candidato = FATORES_ACEITOS.reduce((a, b) => (Math.abs(f / b - 1) < Math.abs(f / a - 1) ? b : a))
    if (Math.abs(f / candidato - 1) > TOLERANCIA_PRECO) continue
    const antes = candles.slice(Math.max(0, i - JANELA_MEDIANA), i)
    if (antes.length < 5) continue
    const quantidadeRelativa = c.quantidade / (mediana(antes.map((x) => x.quantidade)) || Infinity)
    const volumeRelativo = c.volume / (mediana(antes.map((x) => x.volume)) || Infinity)
    // Desdobramento (preço cai): as ações negociadas multiplicam e o volume em reais fica normal. Grupamento (preço sobe por um
    // fator inteiro, algo que não acontece por notícia): as ações negociadas diminuem, e o volume em reais costuma subir um pouco
    // (varejo ajustando posição), por isso o teto é mais folgado.
    const ok = reduz
      ? quantidadeRelativa >= candidato * 0.4 && volumeRelativo >= 0.2 && volumeRelativo <= 4
      : quantidadeRelativa <= Math.min(1, 10 / candidato) && volumeRelativo >= 0.1 && volumeRelativo <= 12
    if (!ok) continue
    eventos.push({ data: c.data, fator: reduz ? candidato : Number((1 / candidato).toFixed(6)) })
  }
  return eventos
}

/**
 * Junta os eventos de config (confirmados pelo responsável, prevalecem) com os detectados: um detectado a até 3 dias de um evento
 * de config é o mesmo evento, e as datas em `ignorados` (config "historicoLongo.ignorarEventos") são descartadas: queda por notícia
 * ruim que o detector confundiu com desdobramento (ex.: Americanas em 12/01/2023). Devolve [{ data, fator, origem: 'config' | 'detectado' }] em ordem de data.
 */
export function combinarEventos(deConfig = [], detectados = [], ignorados = []) {
  const validos = deConfig.filter((e) => e && typeof e.data === 'string' && e.fator > 0)
  const dia = (d) => Date.parse(`${d}T12:00:00Z`) / 86_400_000
  const extras = detectados.filter((d) => !ignorados.includes(d.data) && !validos.some((e) => Math.abs(dia(e.data) - dia(d.data)) <= 3))
  return [...validos.map((e) => ({ data: e.data, fator: e.fator, origem: 'config' })), ...extras.map((e) => ({ data: e.data, fator: e.fator, origem: 'detectado' }))]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
}

/** Divide os preços anteriores à data de cada evento pelo fator acumulado. Quantidade e volume em reais não mudam. */
export function ajustarCandles(candles, eventos) {
  if (!eventos.length) return candles
  return candles.map((c) => {
    const fator = eventos.filter((e) => c.data < e.data).reduce((f, e) => f * e.fator, 1)
    return fator === 1 ? c : { ...c, abertura: c.abertura / fator, maxima: c.maxima / fator, minima: c.minima / fator, ultimo: c.ultimo / fator }
  })
}

const casas = (v) => (v < 1 ? 3 : 2)
export const arredondarPreco = (v) => Number(v.toFixed(casas(v)))

/** Candle -> linha do arquivo: [data, abertura, máxima, mínima, fechamento, volume em R$ mil]. */
export function linhaDoCandle(c) {
  return [c.data, arredondarPreco(c.abertura), arredondarPreco(c.maxima), arredondarPreco(c.minima), arredondarPreco(c.ultimo), Math.round(c.volume / 1000)]
}

/** Salto de fechamento a fechamento que continua na série ajustada (possível evento não detectado, como bonificação quebrada). */
export function saltosRestantes(candles, limite = 0.4) {
  const saltos = []
  for (let i = 1; i < candles.length; i++) {
    const r = candles[i].ultimo / candles[i - 1].ultimo
    if (r <= 1 - limite || r >= 1 + limite * 1.5) saltos.push({ data: candles[i].data, de: arredondarPreco(candles[i - 1].ultimo), para: arredondarPreco(candles[i].ultimo) })
  }
  return saltos
}

/** Arquivo de um ticker, com uma linha de candle por linha de texto (diff legível). */
export function formatarHistoricoTicker({ ticker, fonte, geradoEm, eventos, saltos, candles }) {
  const linhas = candles.map((c) => `    ${JSON.stringify(linhaDoCandle(c))}`).join(',\n')
  return [
    '{',
    `  "ticker": ${JSON.stringify(ticker)},`,
    `  "geradoEm": ${JSON.stringify(geradoEm)},`,
    `  "fonte": ${JSON.stringify(fonte)},`,
    `  "de": ${JSON.stringify(candles[0].data)},`,
    `  "ate": ${JSON.stringify(candles[candles.length - 1].data)},`,
    `  "ajustes": ${JSON.stringify(eventos)},`,
    `  "saltosRestantes": ${JSON.stringify(saltos)},`,
    '  "_leia": "Candles diários [data, abertura, máxima, mínima, fechamento, volume em R$ mil] do COTAHIST da B3, ajustados a desdobramentos e grupamentos (ver \\"ajustes\\"). Não ajusta dividendos. Gerado por scripts/atualizar-historico-acoes.mjs; não editar à mão.",',
    '  "barras": [',
    linhas,
    '  ]',
    '}',
    '',
  ].join('\n')
}
