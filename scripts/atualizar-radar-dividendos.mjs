// Radar de dividendos (D130): proventos já anunciados pela B3 que ainda vão ser pagos, por empresa do cadastro.
//
//   node scripts/atualizar-radar-dividendos.mjs
//
// COM REDE: baixa o cadastro de cada empresa de config/acoes.json (uma chamada por empresa) e grava
// webapp-src/src/data/radarDividendos.json. Sem projeção: só o que a B3 publicou (valor por ação, data com e data de pagamento).
// Se muitas empresas falharem, o job termina com erro SEM gravar.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { urlCadastro } from './b3-proventos.mjs'
import { lerPagamentos, montarRadar, verificarSanidadeRadar } from './radar-dividendos-calculo.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVO_APP = path.join('webapp-src', 'src', 'data', 'radarDividendos.json')
const CABECALHO = { 'user-agent': 'Mozilla/5.0 (carteira-ideal; auditoria)' }
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

/** Empresas do cadastro, um código por empresa: [{ ticker, nome, setor }]. */
export function empresasDoCadastro(config) {
  return config.setores.flatMap((s) => s.empresas.map((e) => ({ ticker: e.ticker, nome: e.nome ?? null, setor: s.setor ?? null })))
}

/** Data de hoje em Brasília (AAAA-MM-DD), que é o que importa para "ainda vai pagar". */
export function hojeEmBrasilia(agora = new Date()) {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

async function baixarCadastro(raiz, { fetchImpl, tentativas = 3, pausaMs = 1500 }) {
  let ultimo
  for (let t = 1; t <= tentativas; t++) {
    try {
      const resp = await fetchImpl(urlCadastro(raiz), { headers: CABECALHO })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const bruto = (await resp.text()).trim()
      const lido = bruto === '' ? null : JSON.parse(bruto)
      return lerPagamentos(typeof lido === 'string' ? JSON.parse(lido) : lido)
    } catch (e) {
      ultimo = e
      if (t < tentativas) await pausa(pausaMs)
    }
  }
  throw ultimo
}

export async function gerarRadar({ raiz = RAIZ_PADRAO, fetchImpl = fetch, hoje = hojeEmBrasilia(), pausaEntreChamadasMs = 400, log = console.log } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'acoes.json'), 'utf8'))
  const lidas = []
  const falhas = []
  const vistas = new Set()
  for (const emp of empresasDoCadastro(config)) {
    const codigo = emp.ticker.slice(0, 4)
    if (vistas.has(codigo)) continue
    vistas.add(codigo)
    try {
      const cad = await baixarCadastro(codigo, { fetchImpl })
      if (cad) lidas.push({ ...emp, eventos: cad.eventos })
      else falhas.push(emp.ticker)
    } catch (e) {
      log(`[falha] ${emp.ticker}: ${e.message}`)
      falhas.push(emp.ticker)
    }
    if (pausaEntreChamadasMs) await pausa(pausaEntreChamadasMs)
  }
  return montarRadar({ empresas: lidas, falhas, hoje })
}

async function principal() {
  const radar = await gerarRadar()
  const erros = verificarSanidadeRadar(radar)
  if (erros.length) {
    console.error('Radar NÃO publicado:\n- ' + erros.join('\n- '))
    process.exit(1)
  }
  const destino = path.join(RAIZ_PADRAO, ARQUIVO_APP)
  fs.writeFileSync(destino, JSON.stringify({ geradoEm: new Date().toISOString(), ...radar }, null, 2) + '\n')
  console.log(`Radar gravado: ${radar.pagamentos.length} pagamentos de ${radar.comPagamento} empresas (${radar.falhas.length} falhas).`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal().catch((e) => { console.error(e); process.exit(1) })
