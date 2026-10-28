// Aviso de preço teto com o app fechado (D127).
//
//   node scripts/avisar-preco-teto.mjs           calcula o preço teto com os dados publicados e manda o aviso a quem acabou de entrar abaixo do teto
//   node scripts/avisar-preco-teto.mjs --simular mostra o que enviaria, sem enviar nem gravar nada
//   node scripts/avisar-preco-teto.mjs --teste   manda uma notificação de teste a todos os aparelhos inscritos (confere o caminho inteiro)
//
// Lê do Redis os aparelhos inscritos (gravados por api/push-inscrever.ts), calcula o preço teto com o MESMO código da aba do app
// (webapp-src/src/domain/precoTetoLote.ts) e usa a mesma regra de "quem já foi avisado" da tela. Roda depois do job de Ações (preço novo).
//
// Variáveis de ambiente (secrets do GitHub): UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (ou KV_REST_API_URL/KV_REST_API_TOKEN),
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (mailto: ou https:). Sem elas, o script avisa e termina sem erro: o job do GitHub
// não falha só porque o aviso ainda não foi configurado.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHAVE_INDICE = 'push:todos'
const lote = 100
const sucesso = new Set([200, 201, 202])
const expirado = new Set([404, 410])

/**
 * Núcleo testável: sem rede e sem disco. `redis` executa uma lista de comandos e devolve os resultados; `calcular(taxa)` devolve o mapa de
 * preço teto por código; `enviar(inscricao, payload)` devolve o código HTTP (ou lança erro com `statusCode`).
 */
export async function executar({ redis, calcular, enviar, avisoDoAparelho, hostValido, modo = 'normal', log = () => {} }) {
  const resumo = { aparelhos: 0, enviados: 0, removidos: 0, falhas: 0, semAviso: 0 }
  const [ids] = await redis([['SMEMBERS', CHAVE_INDICE]])
  if (!Array.isArray(ids) || ids.length === 0) {
    log('Nenhum aparelho inscrito.')
    return resumo
  }
  const itensPorTaxa = new Map()
  const itensDe = (taxa) => {
    if (!itensPorTaxa.has(taxa)) itensPorTaxa.set(taxa, calcular(taxa))
    return itensPorTaxa.get(taxa)
  }

  for (let i = 0; i < ids.length; i += lote) {
    const grupo = ids.slice(i, i + lote)
    const chaves = grupo.map((id) => `push:a:${id}`)
    const [valores] = await redis([['MGET', ...chaves]])
    for (let k = 0; k < grupo.length; k++) {
      const id = grupo[k]
      const chave = chaves[k]
      const bruto = valores?.[k]
      if (typeof bruto !== 'string') {
        await redis([['SREM', CHAVE_INDICE, id]]) // o registro expirou
        resumo.removidos++
        continue
      }
      let reg
      try {
        reg = JSON.parse(bruto)
      } catch {
        await redis([['DEL', chave], ['SREM', CHAVE_INDICE, id]])
        resumo.removidos++
        continue
      }
      if (!hostValido(reg?.inscricao?.endpoint)) {
        await redis([['DEL', chave], ['SREM', CHAVE_INDICE, id]])
        resumo.removidos++
        continue
      }
      resumo.aparelhos++

      let aviso = null
      let r = { avisadosSeEnviado: reg.avisados ?? [], avisadosSeFalhar: reg.avisados ?? [] }
      if (modo === 'teste') {
        aviso = { titulo: 'Teste do aviso de preço teto', corpo: 'Se você está lendo isto, o aviso com o app fechado está funcionando.', tickers: [] }
      } else {
        r = avisoDoAparelho(itensDe(reg.taxa), { tickers: reg.tickers ?? [], taxa: reg.taxa, avisados: reg.avisados ?? [] })
        aviso = r.aviso
      }

      let novosAvisados = r.avisadosSeEnviado
      if (aviso) {
        if (modo === 'simular') {
          log(`[simular] ${id.slice(0, 8)}: ${aviso.titulo} — ${aviso.corpo}`)
          continue
        }
        try {
          const status = await enviar(reg.inscricao, { titulo: aviso.titulo, corpo: aviso.corpo, tag: aviso.tickers.length === 1 ? `preco-teto-${aviso.tickers[0]}` : 'preco-teto', url: './?tela=simuleAcoes' })
          if (sucesso.has(status)) resumo.enviados++
          else if (expirado.has(status)) {
            await redis([['DEL', chave], ['SREM', CHAVE_INDICE, id]])
            resumo.removidos++
            continue
          } else {
            resumo.falhas++
            novosAvisados = r.avisadosSeFalhar
            log(`Falha ao avisar ${id.slice(0, 8)}: HTTP ${status}. Tenta de novo na próxima execução.`)
          }
        } catch (err) {
          const status = err?.statusCode
          if (expirado.has(status)) {
            await redis([['DEL', chave], ['SREM', CHAVE_INDICE, id]])
            resumo.removidos++
            continue
          }
          resumo.falhas++
          novosAvisados = r.avisadosSeFalhar
          log(`Falha ao avisar ${id.slice(0, 8)}: ${status ?? err?.message ?? 'erro'}. Tenta de novo na próxima execução.`)
        }
      } else {
        resumo.semAviso++
      }

      if (modo === 'normal' && JSON.stringify(novosAvisados) !== JSON.stringify(reg.avisados ?? [])) {
        // Relê antes de gravar: se a pessoa mudou a lista enquanto o job rodava, só `avisados` é atualizado (e a validade é mantida).
        const [atual] = await redis([['GET', chave]])
        if (typeof atual === 'string') {
          try {
            const fresco = JSON.parse(atual)
            fresco.avisados = novosAvisados.filter((t) => (fresco.tickers ?? []).includes(t))
            await redis([['SET', chave, JSON.stringify(fresco), 'KEEPTTL']])
          } catch {
            // registro ilegível: o job seguinte o descarta
          }
        }
      }
    }
  }
  return resumo
}

function lerJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))
}

async function principal() {
  const args = new Set(process.argv.slice(2))
  const modo = args.has('--teste') ? 'teste' : args.has('--simular') ? 'simular' : 'normal'
  const env = process.env
  const temRedis = (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) || (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
  const temVapid = env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
  if (!temRedis || (!temVapid && modo !== 'simular')) {
    console.log('Aviso por push ainda não configurado (faltam secrets de Redis ou VAPID). Nada a fazer.')
    return
  }

  const api = await carregarTs(path.join(RAIZ, 'api'), ['_push.ts', '_redis.ts'])
  const dom = await carregarTs(path.join(RAIZ, 'webapp-src', 'src'), ['domain/precoTetoLote.ts'])
  try {
    const { hostDePushValido } = api.modulos['_push.ts']
    const { pipeline } = api.modulos['_redis.ts']
    const { calcularItensPrecoTeto, mapaDePrecos, premissasDoSnapshotMercado, avisoDoAparelho } = dom.modulos['domain/precoTetoLote.ts']

    const fundamentos = lerJson('webapp-src/public/dados/fundamentos.json')
    const precoDe = mapaDePrecos(lerJson('webapp-src/src/data/acoes.json'))
    const dy = lerJson('webapp-src/src/data/acoesDividendos.json').dyPorTicker ?? {}
    const premissas = premissasDoSnapshotMercado(lerJson('webapp-src/src/data/mercadoOficial.json'))
    const calcular = (taxa) => calcularItensPrecoTeto({ fundamentos, precoDe, premissas, dyDe: (t) => dy[t] ?? null, taxa })

    let enviar = async () => 0
    if (modo !== 'simular') {
      const webpush = (await import('web-push')).default
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
      enviar = async (inscricao, payload) => {
        const r = await webpush.sendNotification(inscricao, JSON.stringify(payload), { TTL: 12 * 60 * 60, urgency: 'normal' })
        return r.statusCode
      }
    }

    const resumo = await executar({ redis: pipeline, calcular, enviar, avisoDoAparelho, hostValido: hostDePushValido, modo, log: (m) => console.log(m) })
    console.log(`Aviso de preço teto (${modo}): ${JSON.stringify(resumo)}`)
  } finally {
    await api.limpar()
    await dom.limpar()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
