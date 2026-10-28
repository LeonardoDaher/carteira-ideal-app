// GET /api/push-chave
//
// Devolve a chave PÚBLICA (VAPID) que o navegador precisa para criar a inscrição de avisos (D127). A chave privada nunca passa por aqui:
// ela fica só nos secrets do GitHub, onde o job que envia os avisos roda. Sem a variável VAPID_PUBLIC_KEY, os avisos com o app fechado
// ficam desligados (503) e o app segue com o aviso de quando está aberto.
import type { VercelRequest, VercelResponse } from './_tipos'
import { aplicarCors } from './_cors.js'
import { metricasHabilitadas } from './_redis.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!aplicarCors(req, res)) {
    res.status(403).json({ erro: 'Origem não permitida.' })
    return
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ erro: 'Método não permitido. Use GET.' })
    return
  }
  const chave = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!chave || !metricasHabilitadas()) {
    res.status(503).json({ erro: 'Avisos com o app fechado indisponíveis no momento.' })
    return
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({ chave })
}
