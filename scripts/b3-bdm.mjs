// Lê um Boletim Diário do Mercado (BDM) da B3 já baixado (PDF completo, BDI_00_AAAAMMDD.pdf) e atualiza o arquivo do aluguel
// da aba "Dados de mercado" do Simule Ações (o fluxo dos investidores é atualizado por atualizar-fluxo.mjs):
//   webapp-src/public/dados/emprestimoAtivos.json   (Empréstimos de ativos, posições em aberto -> ações mais alugadas)
// Não baixa nada da B3: só processa o arquivo que você passar. Requer `pdftotext` (poppler/xpdf) no PATH.
// Uso: node scripts/b3-bdm.mjs "C:\caminho\BDI_00_20261106.pdf"
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARQ_ALUGUEL = resolve(RAIZ, 'webapp-src/public/dados/emprestimoAtivos.json')
const FONTE_ALUGUEL = 'B3, Boletim Diário do Mercado (Empréstimos de ativos, posições em aberto)'

const num = (s) => Number(s.replace(/\./g, '').replace(',', '.'))
const iso = (d, m, a) => `${a}-${m}-${d}`

/** Tabela "Participação dos investidores": acumulado do mês (R$ mil, compras − vendas) por tipo, e a data do acumulado. */
export function lerParticipacao(texto) {
  const linhas = texto.split(/\r?\n/)
  const iCab = linhas.findIndex((l) => /^Dados acumulados do in.cio do m.s at. o dia \d{2}\/\d{2}\/\d{4}/.test(l.trim()))
  if (iCab < 0) return null
  const [, d, m, a] = linhas[iCab].match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const campos = [
    [/^Institucionais\s/, 'institucional'],
    [/^Institui.{1,3}es Financeiras\s/, 'instFinanceira'],
    [/^Investidor Estrangeiro\s/, 'estrangeiro'],
    [/^Investidores Individuais\s/, 'pessoaFisica'],
    [/^Outros\s/, 'outros'],
  ]
  const acumulado = {}
  for (const l of linhas.slice(iCab + 1, iCab + 14)) {
    for (const [re, campo] of campos) {
      if (!re.test(l.trim())) continue
      const n = l.trim().match(/-?\d[\d.]*(?:,\d+)?/g) // compras, part%, vendas, part%
      if (!n || n.length < 3) continue
      acumulado[campo] = (num(n[0]) - num(n[2])) / 1000 // R$ milhões
    }
  }
  if (Object.keys(acumulado).length < 5) return null
  return { data: iso(d, m, a), acumulado }
}

/** Fluxo do dia = acumulado do mês de hoje − acumulado do último dia anterior do mesmo mês (ou o próprio acumulado no 1º dia). */
export function fluxoDoDia(data, acumulado, acumulados) {
  const anterior = Object.keys(acumulados).filter((k) => k < data && k.slice(0, 7) === data.slice(0, 7)).sort().pop()
  const base = anterior ? acumulados[anterior] : {}
  const r = { data }
  for (const campo of ['estrangeiro', 'institucional', 'pessoaFisica', 'instFinanceira', 'outros']) r[campo] = +((acumulado[campo] ?? 0) - (base[campo] ?? 0)).toFixed(3)
  return r
}

/** Linhas "Total" das posições em aberto de ações (ISIN ACN/CDA): código, nome, saldo em quantidade e saldo em R$. */
export function lerPosicoesEmAberto(texto) {
  const re = /^(\d{2})\/(\d{2})\/(\d{4}) (\S+) (BR[A-Z0-9]{4}(?:ACN|CDA)[A-Z0-9]{3}) (.+?) Total ([\d.]+) - ([\d.]+,\d{2})$/
  const registros = []
  let dataReferencia = null
  for (const l of texto.split(/\r?\n/)) {
    const m = l.trim().match(re)
    if (!m) continue
    dataReferencia = iso(m[1], m[2], m[3])
    registros.push({ ticker: m[4], nome: m[6].trim(), saldoFinanceiro: num(m[8]), saldoQuantidade: num(m[7]) })
  }
  return { dataReferencia, registros }
}

function ler(caminho, padrao) {
  try { return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : padrao } catch { return padrao }
}

function principal(pdf) {
  const texto = execFileSync('pdftotext', ['-raw', '-enc', 'UTF-8', pdf, '-'], { maxBuffer: 2 ** 30 }).toString('utf8')
  const agora = new Date().toISOString()

  // O fluxo por tipo de investidor agora vem de scripts/atualizar-fluxo.mjs (job diário); aqui só o aluguel.

  const { dataReferencia, registros } = lerPosicoesEmAberto(texto)
  if (dataReferencia && registros.length) {
    const atual = ler(ARQ_ALUGUEL, { registros: [] })
    const antes = atual.dataReferencia && atual.dataReferencia < dataReferencia ? new Map(atual.registros.map((r) => [r.ticker, r.saldoFinanceiro])) : new Map()
    for (const r of registros) {
      const ant = antes.get(r.ticker)
      r.variacaoDia = ant > 0 ? +(r.saldoFinanceiro / ant - 1).toFixed(4) : null
    }
    registros.sort((x, y) => y.saldoFinanceiro - x.saldoFinanceiro)
    writeFileSync(ARQ_ALUGUEL, JSON.stringify({ geradoEm: agora, dataReferencia, fonte: FONTE_ALUGUEL, registros }, null, 1) + '\n')
    console.log(`aluguel: ${registros.length} ações em ${dataReferencia}; maior saldo ${registros[0].ticker} R$ ${(registros[0].saldoFinanceiro / 1e9).toFixed(2)} bi`)
  } else console.warn('aluguel: posições em aberto não encontradas')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) { console.error('Uso: node scripts/b3-bdm.mjs <BDI_00_AAAAMMDD.pdf>'); process.exit(1) }
  principal(process.argv[2])
}
