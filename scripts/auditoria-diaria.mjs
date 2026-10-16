// Auditoria "diária" dos Top 15 (D89): o ranking é recalculado todo dia útil com o preço do dia, mas a PASTA de
// auditoria completa (insumos, memória de cálculo, CSVs, manifesto) só é gravada uma vez por mês.
//
// Nos outros dias o job:
//   1. recalcula o ranking com os insumos do dia;
//   2. CONFERE o cálculo de forma independente antes de publicar (grava e relê os insumos, refaz o cálculo do zero e compara
//      os hashes), sem escrever pasta nova no repositório;
//   3. publica o ranking com a impressão digital do dia e aponta para a auditoria completa do mês.
//
// A auditoria completa volta a ser gravada quando: (a) é a primeira execução do mês; (b) os parâmetros (config) mudaram
// desde a última completa; (c) o código de cálculo mudou; (d) alguém pede (--completa). Assim a pasta mensal sempre
// corresponde às regras que estão valendo.
//
// Módulo puro (sem rede e sem relógio): quem chama passa as datas e os hashes.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const mesDe = (data) => String(data ?? '').slice(0, 7)

/** Lê auditoria/<pasta>/ultima.json e o manifesto da pasta que ele aponta. Sem eles, devolve nulos (força a completa). */
export function lerAuditoriaCompleta(raiz, pastaDaClasse) {
  try {
    const ultima = JSON.parse(fs.readFileSync(path.join(raiz, 'auditoria', pastaDaClasse, 'ultima.json'), 'utf8'))
    const manifesto = JSON.parse(fs.readFileSync(path.join(raiz, ultima.pasta, 'manifesto.json'), 'utf8'))
    return { ultima, manifesto }
  } catch {
    return { ultima: null, manifesto: null }
  }
}

/** Data (AAAA-MM-DD) da pasta de auditoria completa, pelo último trecho do caminho gravado em ultima.json. */
export const dataDaPasta = (ultima) => (ultima?.pasta ? path.posix.basename(String(ultima.pasta).replace(/\\/g, '/')) : null)

/**
 * Decide se a execução de hoje grava a auditoria completa ou só recalcula e confere.
 * @returns {{ modo: 'completa' | 'diaria', motivo: string }}
 */
export function decidirModo({ ultima, manifesto, hoje, hashConfig, calculoSha256 = null, forcarCompleta = false }) {
  if (forcarCompleta) return { modo: 'completa', motivo: 'pedida (--completa)' }
  if (!ultima || !manifesto) return { modo: 'completa', motivo: 'ainda não há auditoria completa gravada' }
  // A data de EXECUÇÃO vale mais que o nome da pasta: a das ações é nomeada pelo último pregão (que pode ser do mês anterior).
  const dataUltima = ultima.dataExecucao ?? dataDaPasta(ultima) ?? ultima.dataPrecos ?? ''
  if (mesDe(dataUltima) !== mesDe(hoje)) return { modo: 'completa', motivo: `primeira execução do mês (a última completa é de ${dataUltima || '?'})` }
  if (manifesto.hashes?.config !== hashConfig) return { modo: 'completa', motivo: 'os parâmetros mudaram desde a última auditoria completa' }
  if (calculoSha256 && manifesto.codigo?.calculoSha256 !== calculoSha256) return { modo: 'completa', motivo: 'o código de cálculo mudou desde a última auditoria completa' }
  return { modo: 'diaria', motivo: `auditoria completa do mês: ${dataUltima}` }
}

/**
 * Conferência independente SEM gravar pasta: grava e relê os insumos e a config (como a verificação faria a partir dos
 * arquivos), refaz o cálculo do zero e compara com os hashes do cálculo principal. Devolve a lista de problemas.
 */
export function conferirEmMemoria({ calcular, canonico, sha256, hashDoResultado, insumos, cfg, hashes }) {
  const comoGravado = (o) => JSON.parse(zlib.gunzipSync(zlib.gzipSync(Buffer.from(JSON.stringify(o)))).toString('utf8'))
  const insumosB = comoGravado(insumos)
  const cfgB = comoGravado(cfg)
  const problemas = []
  if (sha256(canonico(insumosB)) !== hashes.insumos) problemas.push('o hash dos insumos diverge depois de gravar e reler')
  if (sha256(canonico(cfgB)) !== hashes.config) problemas.push('o hash da config diverge depois de gravar e reler')
  const { resultado } = calcular(insumosB, cfgB)
  if (hashDoResultado(resultado) !== hashes.resultado) problemas.push('o resultado recalculado diverge do resultado publicado')
  return problemas
}
