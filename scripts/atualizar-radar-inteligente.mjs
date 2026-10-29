// Radar de dividendos inteligente (D132): padrão de meses de pagamento de cada empresa do cadastro.
//
//   node scripts/atualizar-radar-inteligente.mjs
//
// COM REDE: baixa da B3 o histórico de proventos de cada empresa de config/acoes.json (as duas listas, unidas, como no Top 15
// de dividendos) e grava webapp-src/src/data/radarInteligente.json. Leva uns 5 minutos por causa da pausa entre as chamadas.
// Se muitas empresas falharem, termina com erro SEM gravar.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { baixarProventosDaEmpresa } from './b3-proventos.mjs'
import { montarRadarInteligente, verificarSanidadeInteligente } from './radar-inteligente-calculo.mjs'
import { empresasDoCadastro, hojeEmBrasilia } from './atualizar-radar-dividendos.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ARQUIVO_APP = path.join('webapp-src', 'src', 'data', 'radarInteligente.json')

export async function gerarRadarInteligente({ raiz = RAIZ_PADRAO, baixar = baixarProventosDaEmpresa, hoje = hojeEmBrasilia(), pausaMs = 800, log = console.log } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'acoes.json'), 'utf8'))
  const empresas = []
  const falhas = []
  const vistas = new Set()
  for (const emp of empresasDoCadastro(config)) {
    const codigo = emp.ticker.slice(0, 4)
    if (vistas.has(codigo)) continue
    vistas.add(codigo)
    try {
      const r = await baixar(codigo, { pausaEntreChamadasMs: pausaMs })
      if (r.eventos.length) empresas.push({ ...emp, eventos: r.eventos })
      else if (!r.historicoDisponivel && r.motivo) falhas.push(emp.ticker)
    } catch (e) {
      log(`[falha] ${emp.ticker}: ${e.message}`)
      falhas.push(emp.ticker)
    }
    if (pausaMs) await new Promise((res) => setTimeout(res, pausaMs))
  }
  return montarRadarInteligente({ empresas, falhas, hoje })
}

async function principal() {
  const radar = await gerarRadarInteligente()
  const erros = verificarSanidadeInteligente(radar)
  if (erros.length) {
    console.error('Radar inteligente NÃO publicado:\n- ' + erros.join('\n- '))
    process.exit(1)
  }
  fs.writeFileSync(path.join(RAIZ_PADRAO, ARQUIVO_APP), JSON.stringify({ geradoEm: new Date().toISOString(), ...radar }, null, 2) + '\n')
  console.log(`Radar inteligente gravado: ${radar.empresas.length} empresas com padrão (${radar.falhas.length} falhas).`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal().catch((e) => { console.error(e); process.exit(1) })
