// Histórico de preços das ações a partir do COTAHIST da B3 (D120): até 5 anos de candles diários COM abertura.
//
// Fonte oficial e gratuita: https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_AAAA.ZIP (um zip por ano, ~80 MB, com um
// TXT de largura fixa de 245 colunas, codificação ISO-8859-1). Cada linha de tipo 01 é um papel num pregão, com abertura, máxima,
// mínima, último preço, quantidade e volume financeiro. Só há linha nos dias com negócio.
//
// O COTAHIST NÃO ajusta desdobramentos, grupamentos nem bonificações: sem tratamento, o gráfico mostraria uma queda de 66% (ou um
// salto) no dia do evento. Os eventos vêm da própria B3, do cadastro de empresas listadas (stockDividends: DESDOBRAMENTO,
// GRUPAMENTO e BONIFICACAO, com fator e "data com"), e o config/acoes.json ("desdobramentos") prevalece. Cada evento da B3 é
// conferido contra o preço: se o preço não andou como o fator manda, o evento não é aplicado e vira aviso.
//
// Por que não detectar pelo preço: tentamos (preço em fator inteiro + quantidade + volume em reais) e deu falso positivo. Em
// 26/10/2026 a ANIM3 caiu 44% de um dia para o outro com volume normal e a regra a tomou por desdobramento 1:2, apagando a
// máxima real de R$ 5,83 do gráfico. Queda forte por notícia e desdobramento 1:2 são indistinguíveis só pelo preço. A detecção
// ficou apenas como conferência (`detectarEventos`): o que ela acha e a B3 não confirma vai para o log, sem ajustar nada.
// Dividendos e juros sobre capital próprio não ajustam a série.
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
    isin: linha.slice(230, 242).trim(),
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
    lista.push({ isin: p.isin, data: p.data, abertura: p.abertura, maxima: p.maxima, minima: p.minima, ultimo: p.ultimo, quantidade: p.quantidade, volume: p.volume })
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
 * Desdobramentos e grupamentos PROVÁVEIS numa série de candles, só para conferência (ver o cabeçalho: não ajusta nada) (sem ajuste). Devolve [{ data, fator }] com fator = ações novas por
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
 * Junta os eventos de config (confirmados pelo responsável, prevalecem) com os da B3: um evento da B3 a até 3 dias de um de config é
 * o mesmo. Devolve [{ data, fator, origem: 'config' | 'b3' }] em ordem de data.
 */
export function combinarEventos(deConfig = [], oficiais = []) {
  const validos = deConfig.filter((e) => e && typeof e.data === 'string' && e.fator > 0)
  const dia = (d) => Date.parse(`${d}T12:00:00Z`) / 86_400_000
  const extras = oficiais.filter((d) => !validos.some((e) => Math.abs(dia(e.data) - dia(d.data)) <= 3))
  return [...validos.map((e) => ({ data: e.data, fator: e.fator, origem: 'config' })), ...extras.map((e) => ({ data: e.data, fator: e.fator, origem: 'b3' }))]
    .sort((a, b) => (a.data < b.data ? -1 : 1))
}

// ---------------------------------------------------------------------------------------
// Eventos oficiais da B3 (desdobramento, grupamento, bonificação)
// ---------------------------------------------------------------------------------------

export const URL_EVENTOS_B3 = (emitente) =>
  `https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/${Buffer.from(JSON.stringify({ issuingCompany: emitente, language: 'pt-br' })).toString('base64')}`

/** Código do emissor na B3: os 4 primeiros caracteres do ticker (ANIM3 -> ANIM, BPAC11 -> BPAC). */
export const emitenteDoTicker = (ticker) => ticker.replace(/\d+$/, '')

const numeroB3 = (texto) => {
  const t = String(texto ?? '').trim()
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}
const dataB3 = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * Resposta do cadastro da B3 (`GetListedSupplementCompany`) -> eventos de quantidade de ações do papel de ISIN `isin`.
 * Cada item: { ultimaDataCom, fator, rotulo }, com fator = ações novas por ação antiga, como em config/acoes.json:
 *  - DESDOBRAMENTO: a B3 informa o aumento em % (200 = 3 ações por 1) -> 1 + n/100;
 *  - BONIFICACAO: também em % (5 = 5 ações novas para cada 100) -> 1 + n/100;
 *  - GRUPAMENTO: já vem como razão (0,1 = 10 ações viram 1) -> n.
 * Se nenhum evento tem o ISIN do papel (units, por exemplo), devolve os de todo o emissor: a conferência com o preço decide.
 * Devolve null se a resposta não é o que se espera (fora do ar, formato mudou).
 */
export function eventosDaB3(resposta, isin) {
  if (!Array.isArray(resposta) || !resposta.length || typeof resposta[0] !== 'object' || resposta[0] === null) return null
  const lista = Array.isArray(resposta[0].stockDividends) ? resposta[0].stockDividends : []
  const doPapel = lista.filter((e) => e.isinCode === isin || e.assetIssued === isin)
  const base = doPapel.length ? doPapel : lista
  const eventos = []
  for (const e of base) {
    const n = numeroB3(e.factor)
    const rotulo = String(e.label ?? '').toUpperCase()
    const ultimaDataCom = dataB3(e.lastDatePrior)
    if (!ultimaDataCom || !(n > 0)) continue
    if (rotulo.startsWith('DESDOBRAMENTO') || rotulo.startsWith('BONIFICACAO')) eventos.push({ ultimaDataCom, fator: 1 + n / 100, rotulo })
    else if (rotulo.startsWith('GRUPAMENTO') && n < 1) eventos.push({ ultimaDataCom, fator: n, rotulo })
  }
  return eventos
}

/** Busca o cadastro do emissor na B3. Devolve o JSON ou null (rede, HTTP, corpo vazio ou inválido). */
export async function buscarEventosB3(emitente, buscar = fetch) {
  try {
    const r = await buscar(URL_EVENTOS_B3(emitente))
    if (!r.ok) return null
    const texto = await r.text()
    return texto.trim() ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

/**
 * Eventos da B3 -> eventos aplicáveis à série de candles, conferidos contra o preço.
 * A data do evento é o primeiro pregão depois da "data com". Fica de fora, sem erro: o que ocorreu antes do primeiro candle ou ainda
 * não ocorreu (sem pregão depois da data com). Para fator que muda muito o preço (abaixo de 0,77 ou acima de 1,3), o fechamento
 * ou a abertura do dia do evento precisam ter andado perto de 1/fator contra o fechamento anterior (tolerância de 35%); se não, o
 * evento vai para `divergentes` e NÃO é aplicado. Bonificação pequena não tem como ser conferida pelo preço e é aplicada.
 */
export function confirmarEventosB3(candles, eventosB3) {
  const eventos = []
  const divergentes = []
  // Na mesma "data com" a B3 às vezes lista um desdobramento e um grupamento que se compensam em parte (VIVT3: 7.900% e 1:40 = 2:1
  // no fim; TIMS3: 100 e 0,01 = nada). O efeito no preço é o produto dos fatores.
  const porData = new Map()
  for (const e of eventosB3) porData.set(e.ultimaDataCom, (porData.get(e.ultimaDataCom) ?? 1) * e.fator)
  for (const [ultimaDataCom, fator] of [...porData].map(([d, f]) => [d, Number(f.toFixed(8))]).sort()) {
    if (Math.abs(fator - 1) < 1e-6) continue
    const e = { ultimaDataCom, fator }
    const i = candles.findIndex((c) => c.data > e.ultimaDataCom)
    if (i < 1) continue
    const c = candles[i]
    const anterior = candles[i - 1]
    if (e.fator < 0.77 || e.fator > 1.3) {
      const perto = (razao) => Math.abs(razao * e.fator - 1) <= 0.35
      if (!perto(c.ultimo / anterior.ultimo) && !perto(c.abertura / anterior.ultimo)) {
        divergentes.push({ data: c.data, fator: e.fator, motivo: `o preço foi de ${anterior.ultimo} para ${c.ultimo}, não compatível com o fator ${e.fator}` })
        continue
      }
    }
    eventos.push({ data: c.data, fator: Number(e.fator.toFixed(6)) })
  }
  return { eventos, divergentes }
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
