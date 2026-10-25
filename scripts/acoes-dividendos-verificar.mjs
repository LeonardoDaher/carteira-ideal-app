// Verificação INDEPENDENTE do "Top 15 ações pagadoras de dividendos" (D122).
//
//   node scripts/acoes-dividendos-verificar.mjs auditoria/acoes-dividendos/AAAA-MM-DD
//   node scripts/acoes-dividendos-verificar.mjs ultima
//
// Depende SÓ de acoes-dividendos-calculo.mjs e do Node: não importa o orquestrador nem baixa nada. Um terceiro audita a pasta
// de uma execução sem internet.
//
// O que confere: (1) sha256 de cada arquivo da pasta contra o manifesto; (2) hash canônico dos insumos e da config;
// (3) RECÁLCULO do resultado só com insumos + config, comparado ao manifesto; (4) aviso se o código de cálculo atual difere do
// usado na execução. O que NÃO prova: que os insumos reproduzem a B3 (compare um código com a página de proventos dele em b3.com.br).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { calcularDividendos, canonico, hashDoResultado, sha256 } from './acoes-dividendos-calculo.mjs'

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lerJson = (arquivo) => JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const lerGz = (arquivo) => JSON.parse(zlib.gunzipSync(fs.readFileSync(arquivo)).toString('utf8'))
const hashArquivo = (caminho) => crypto.createHash('sha256').update(fs.readFileSync(caminho)).digest('hex')

export function verificar(pasta, raiz = RAIZ_PADRAO) {
  const msgs = []
  const falha = (m) => msgs.push({ ok: false, m })
  const ok = (m) => msgs.push({ ok: true, m })
  const manifesto = lerJson(path.join(pasta, 'manifesto.json'))
  for (const [arq, esperado] of Object.entries(manifesto.hashes.arquivos)) {
    const real = hashArquivo(path.join(pasta, arq))
    real === esperado ? ok(`${arq}: sha256 confere`) : falha(`${arq}: sha256 DIVERGE (manifesto ${esperado.slice(0, 12)}…, arquivo ${real.slice(0, 12)}…)`)
  }
  const insumos = lerGz(path.join(pasta, 'insumos.json.gz'))
  const cfg = lerJson(path.join(pasta, 'config.json'))
  sha256(canonico(insumos)) === manifesto.hashes.insumos ? ok('insumos: hash canônico confere') : falha('insumos: hash canônico DIVERGE')
  sha256(canonico(cfg)) === manifesto.hashes.config ? ok('config: hash canônico confere') : falha('config: hash canônico DIVERGE')

  const { resultado } = calcularDividendos(insumos, cfg)
  const hash = hashDoResultado(resultado)
  hash === manifesto.hashes.resultado
    ? ok(`resultado recalculado: ${hash.slice(0, 16)}… confere (${resultado.ranking.length} no ranking, ${resultado.exclusoes.length} exclusões)`)
    : falha(`resultado recalculado DIVERGE: ${hash.slice(0, 16)}… × manifesto ${manifesto.hashes.resultado.slice(0, 16)}…`)

  const codigo = sha256(hashArquivo(path.join(raiz, 'scripts', 'acoes-dividendos-calculo.mjs')) + hashArquivo(path.join(raiz, 'scripts', 'b3-proventos.mjs')))
  if (codigo !== manifesto.codigo.calculoSha256) {
    msgs.push({ ok: true, aviso: true, m: `aviso: o código de cálculo atual (${codigo.slice(0, 12)}…) é diferente do usado na execução (${manifesto.codigo.calculoSha256.slice(0, 12)}…). ${hash === manifesto.hashes.resultado ? 'Mesmo assim o resultado confere.' : 'Compare as versões no histórico do git.'}` })
  }
  return { ok: msgs.every((x) => x.ok), mensagens: msgs }
}

/** Interpreta o argumento da linha de comando ("ultima" ou uma pasta) e imprime o relatório. */
export function executarCli(argumento, raiz = RAIZ_PADRAO) {
  if (!argumento) {
    console.error('Uso: node scripts/acoes-dividendos-verificar.mjs <pasta-da-execução | ultima>')
    return 2
  }
  const alvo = argumento === 'ultima' ? lerJson(path.join(raiz, 'auditoria', 'acoes-dividendos', 'ultima.json')).pasta : argumento
  const r = verificar(path.resolve(raiz, alvo), raiz)
  for (const x of r.mensagens) console.log(`${x.ok ? (x.aviso ? '!' : '✓') : '✗'} ${x.m}`)
  console.log(r.ok ? '\nVERIFICAÇÃO: OK' : '\nVERIFICAÇÃO: FALHOU')
  return r.ok ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(executarCli(process.argv[2]))
