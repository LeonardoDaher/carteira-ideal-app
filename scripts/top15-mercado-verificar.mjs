// Verificação INDEPENDENTE dos rankings "ETFs mais negociados" e "BDRs com maior desconto de preço" (D70).
//
//   node scripts/top15-mercado-verificar.mjs auditoria/top15-etfs/AAAA-MM-DD
//   node scripts/top15-mercado-verificar.mjs auditoria/top15-bdrs/AAAA-MM-DD
//   node scripts/top15-mercado-verificar.mjs auditoria/top15-fiis/AAAA-MM-DD
//   node scripts/top15-mercado-verificar.mjs ultima etfs        (ou: ultima fiis, ultima acoes, ultima bdrs-negociados, ultima bdrs)
//
// Depende SÓ de top15-mercado-calculo.mjs e do Node: não importa o orquestrador. É de propósito, para um terceiro
// poder auditar uma pasta de execução com dois arquivos (esta pasta + o cálculo) e sem internet.
//
// O que confere: (1) sha256 de cada arquivo da pasta contra o manifesto; (2) hash canônico dos insumos e da config;
// (3) RECÁLCULO do resultado só com insumos + config, comparado ao manifesto; (4) aviso se o código de cálculo atual
// difere do usado na execução. O que NÃO prova: que o histórico reproduz fielmente o Boletim de Preços da B3.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { calcularAcoes, calcularBdrs, calcularBdrsNegociados, calcularEtfs, calcularFiis, calcularIndice, canonico, hashDoResultado, sha256 } from './top15-mercado-calculo.mjs'

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

  const calcular = { etfs: calcularEtfs, fiis: calcularFiis, acoes: calcularAcoes, 'bdrs-negociados': calcularBdrsNegociados, ifix: calcularIndice, ibov: calcularIndice, bdrs: calcularBdrs }[manifesto.classe] ?? null
  if (!calcular) {
    falha(`classe desconhecida no manifesto: ${manifesto.classe}`)
    return { ok: false, mensagens: msgs }
  }
  const { resultado } = calcular(insumos, cfg)
  const hash = hashDoResultado(resultado)
  const lista = resultado.geral ?? resultado.ranking
  hash === manifesto.hashes.resultado
    ? ok(`resultado recalculado: ${hash.slice(0, 16)}… confere (${lista.length} na lista, ${resultado.elegiveis} elegíveis, ${resultado.exclusoes.length} exclusões)`)
    : falha(`resultado recalculado DIVERGE: ${hash.slice(0, 16)}… × manifesto ${manifesto.hashes.resultado.slice(0, 16)}…`)

  const codigo = hashArquivo(path.join(raiz, 'scripts', 'top15-mercado-calculo.mjs'))
  if (codigo !== manifesto.codigo.calculoSha256) {
    msgs.push({ ok: true, aviso: true, m: `aviso: o código de cálculo atual (${codigo.slice(0, 12)}…) é diferente do usado na execução (${manifesto.codigo.calculoSha256.slice(0, 12)}…). ${hash === manifesto.hashes.resultado ? 'Mesmo assim o resultado confere.' : 'Compare as versões no histórico do git.'}` })
  }
  return { ok: msgs.every((x) => x.ok), mensagens: msgs }
}

const PASTA_POR_CLASSE = { etfs: 'top15-etfs', fiis: 'top15-fiis', acoes: 'top15-acoes', 'bdrs-negociados': 'top15-bdrs-negociados', ifix: 'top15-ifix', ibov: 'top15-ibov', bdrs: 'top15-bdrs' }

/** Interpreta os argumentos ("ultima" + classe, ou uma pasta) e imprime o relatório. */
export function executarCli(argumento, classe, raiz = RAIZ_PADRAO) {
  if (!argumento || (argumento === 'ultima' && !PASTA_POR_CLASSE[classe])) {
    console.error('Uso: node scripts/top15-mercado-verificar.mjs <pasta-da-execução | ultima <classe: etfs | fiis | acoes | bdrs-negociados | ifix | ibov | bdrs>>')
    return 2
  }
  const alvo = argumento === 'ultima' ? lerJson(path.join(raiz, 'auditoria', PASTA_POR_CLASSE[classe], 'ultima.json')).pasta : argumento
  const r = verificar(path.resolve(raiz, alvo), raiz)
  for (const x of r.mensagens) console.log(`${x.ok ? (x.aviso ? '!' : '✓') : '✗'} ${x.m}`)
  console.log(r.ok ? '\nVERIFICAÇÃO: OK' : '\nVERIFICAÇÃO: FALHOU')
  return r.ok ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(executarCli(process.argv[2], process.argv[3]))
