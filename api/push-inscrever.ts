// POST /api/push-inscrever   cria ou atualiza o aviso de um aparelho (D127)
// DELETE /api/push-inscrever apaga o aviso do aparelho
//
// Corpo do POST: { inscricao: { endpoint, keys: { p256dh, auth } }, tickers: string[], taxa: number, avisados?: string[] }
// Corpo do DELETE: { inscricao: { endpoint } }
//
// O que fica no Redis por aparelho: endereço de entrega do navegador e suas chaves, códigos acompanhados, taxa, quem já foi avisado e a
// data da última atualização. Expira em 90 dias sem o app ser aberto (cada abertura renova). Nada identifica a pessoa.
import type { VercelRequest, VercelResponse } from './_tipos.js'
import { aplicarCors } from './_cors.js'
import { chaveDeChamadas, contadorComReserva, contadorEmMemoria, contadorRedis, JANELA_CHAMADAS_SEGUNDOS, passouDoLimite } from './_limite.js'
import type { Contador } from './_limite.js'
import { CHAVE_INDICE, chaveDoAparelho, hostDePushValido, idDoEndpoint, montarRegistro, validarPedido, VALIDADE_SEGUNDOS } from './_push.js'
import type { RegistroDoAparelho } from './_push.js'
import { metricasHabilitadas, pipeline } from './_redis.js'
import { ipDe } from './_top15.js'

// Poucas chamadas por IP: a pessoa liga o aviso uma vez e o app só atualiza quando a lista muda.
const MAX_CHAMADAS_PUSH = 40
const reserva = contadorEmMemoria()
const contador: Contador = metricasHabilitadas() ? contadorComReserva(contadorRedis(pipeline), reserva) : reserva
const sal = process.env.TOP15_SAL ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!aplicarCors(req, res)) {
    res.status(403).json({ erro: 'Origem não permitida.' })
    return
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.status(405).json({ erro: 'Método não permitido. Use POST ou DELETE.' })
    return
  }
  if (!metricasHabilitadas() || !process.env.VAPID_PUBLIC_KEY) {
    res.status(503).json({ erro: 'Avisos com o app fechado indisponíveis no momento.' })
    return
  }

  const chaveLimite = chaveDeChamadas(ipDe(req.headers, req.socket?.remoteAddress), sal, 'push:chamadas')
  if (await passouDoLimite(contador, chaveLimite, MAX_CHAMADAS_PUSH, JANELA_CHAMADAS_SEGUNDOS)) {
    res.status(429).json({ erro: 'Muitas tentativas. Tente de novo em alguns minutos.' })
    return
  }

  const corpo = typeof req.body === 'string' ? safeParse(req.body) : req.body

  if (req.method === 'DELETE') {
    const endpoint = ((corpo as Record<string, unknown> | undefined)?.inscricao as Record<string, unknown> | undefined)?.endpoint
    if (!hostDePushValido(endpoint)) {
      res.status(400).json({ erro: 'Endereço de aviso inválido.' })
      return
    }
    const id = idDoEndpoint(endpoint)
    try {
      await pipeline([['DEL', chaveDoAparelho(id)], ['SREM', CHAVE_INDICE, id]])
    } catch (err) {
      console.error('[api/push-inscrever] falha ao apagar:', err)
      res.status(500).json({ erro: 'Não foi possível desligar agora. Tente de novo.' })
      return
    }
    res.status(204).end()
    return
  }

  const v = validarPedido(corpo)
  if (!v.ok) {
    res.status(400).json({ erro: v.erro })
    return
  }
  const id = idDoEndpoint(v.pedido.inscricao.endpoint)
  try {
    const [atual] = await pipeline([['GET', chaveDoAparelho(id)]])
    const anterior = typeof atual === 'string' ? (safeParse(atual) as RegistroDoAparelho | null) : null
    const registro = montarRegistro(v.pedido, anterior ?? null, new Date())
    await pipeline([['SET', chaveDoAparelho(id), JSON.stringify(registro), 'EX', VALIDADE_SEGUNDOS], ['SADD', CHAVE_INDICE, id]])
  } catch (err) {
    console.error('[api/push-inscrever] falha ao gravar:', err)
    res.status(500).json({ erro: 'Não foi possível ligar o aviso agora. Tente de novo.' })
    return
  }
  res.status(204).end()
}

function safeParse(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}
