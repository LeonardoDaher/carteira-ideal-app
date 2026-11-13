// Atualiza o fluxo de investimento na B3 por tipo de investidor (webapp-src/public/dados/fluxoEstrangeiro.json), usado na aba
// "Dados de mercado" do Simule Ações.
//
// Fonte: tabela pública https://www.dadosdemercado.com.br/fluxo (robots.txt libera a página; só /v1/ é bloqueado). Os valores são
// os da participação de investidores da B3, em R$ milhões (positivo = entrada, negativo = saída), com atraso de D+2.
//
// Se a página mudar de layout ou vier incompleta, o script FALHA sem tocar no arquivo.
// Uso: node scripts/atualizar-fluxo.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVO = resolve(RAIZ, 'webapp-src/public/dados/fluxoEstrangeiro.json')
export const URL_FLUXO = 'https://www.dadosdemercado.com.br/fluxo'
export const FONTE = 'Dados de Mercado (dadosdemercado.com.br), a partir da participação de investidores da B3'
const MINIMO_DE_PREGOES = 100
const CABECALHO = ['Data', 'Estrangeiro', 'Institucional', 'Pessoa física', 'Inst. Financeira', 'Outros']

const semTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

/** "-1.434,19 mi" em -1434.19 (milhões). Falha em qualquer formato inesperado. */
export function lerValor(texto) {
  const m = texto.trim().match(/^(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?) mi$/)
  if (!m) throw new Error(`Valor fora do formato esperado: "${texto}"`)
  return Number(m[1].replace(/\./g, '').replace(',', '.'))
}

/** Lê a tabela #flow da página. Devolve os pregões do mais antigo para o mais novo. */
export function lerTabelaFluxo(html) {
  const tabela = html.match(/<table[^>]*id="flow"[\s\S]*?<\/table>/)
  if (!tabela) throw new Error('Tabela #flow não encontrada: o layout da página mudou?')
  const cabecalho = [...tabela[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => semTags(m[1]))
  if (cabecalho.join('|') !== CABECALHO.join('|')) throw new Error(`Colunas diferentes do esperado: ${cabecalho.join(', ')}`)
  const registros = []
  for (const linha of tabela[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const celulas = [...linha[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => semTags(m[1]))
    if (!celulas.length) continue
    const d = celulas[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!d || celulas.length !== 6) throw new Error(`Linha fora do formato: ${celulas.join(' | ')}`)
    const [estrangeiro, institucional, pessoaFisica, instFinanceira, outros] = celulas.slice(1).map(lerValor)
    registros.push({ data: `${d[3]}-${d[2]}-${d[1]}`, estrangeiro, institucional, pessoaFisica, instFinanceira, outros })
  }
  registros.sort((a, b) => a.data.localeCompare(b.data))
  for (let i = 1; i < registros.length; i++) if (registros[i].data === registros[i - 1].data) throw new Error(`Data repetida: ${registros[i].data}`)
  if (registros.length < MINIMO_DE_PREGOES) throw new Error(`Só ${registros.length} pregões na página (mínimo ${MINIMO_DE_PREGOES}): página incompleta?`)
  return registros
}

/** Pregões novos substituem os de mesma data (a B3 republica dados); os mais antigos que a página são mantidos. */
export function mesclar(atuais, novos) {
  const porData = new Map(atuais.map((r) => [r.data, r]))
  for (const r of novos) porData.set(r.data, r)
  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data))
}

async function principal() {
  const resposta = await fetch(URL_FLUXO, { headers: { 'user-agent': 'carteira-ideal-app (atualizacao diaria de fluxo)' }, signal: AbortSignal.timeout(30000) })
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ao buscar ${URL_FLUXO}`)
  const novos = lerTabelaFluxo(await resposta.text())
  let atual = { registros: [] }
  try { atual = JSON.parse(readFileSync(ARQUIVO, 'utf8')) } catch { /* primeira carga */ }
  const registros = mesclar(atual.registros ?? [], novos)
  const iguais = JSON.stringify(registros) === JSON.stringify(atual.registros) && atual.fonte === FONTE
  if (iguais) { console.log(`Sem mudanças (último pregão ${registros.at(-1).data}).`); return }
  writeFileSync(ARQUIVO, JSON.stringify({ geradoEm: new Date().toISOString(), fonte: FONTE, registros }, null, 1) + '\n')
  console.log(`Fluxo atualizado: ${registros.length} pregões, de ${registros[0].data} a ${registros.at(-1).data} (${registros.length - (atual.registros?.length ?? 0)} novos).`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
}
