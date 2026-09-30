// POST /api/evento
//
// Recebe um evento anônimo de uso do app (ex.: "recomendacao_gerada") e o soma nos
// contadores diários. Nunca devolve erro ao navegador por falha de métrica: contar não
// pode atrapalhar quem está usando o app.
//
// Corpo esperado: { evento, id, ref?, props? { perfil?, prazo?, capacidade?, veto?, tela? } }
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pipeline, metricasHabilitadas } from './_redis.js'
import { EVENTOS_ACEITOS, dataBrasilia, idAnonimoValido, refValido, rotuloValido } from './_eventos.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido. Use POST.' })
    return
  }

  // Sem Redis configurado, as métricas estão desligadas: responde OK e segue.
  if (!metricasHabilitadas()) {
    res.status(204).end()
    return
  }

  const corpo = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as Record<string, unknown> | undefined
  const evento = corpo?.evento
  const id = corpo?.id
  if (typeof evento !== 'string' || !EVENTOS_ACEITOS.includes(evento) || !idAnonimoValido(id)) {
    res.status(400).json({ erro: 'Evento inválido.' })
    return
  }

  const dia = dataBrasilia()
  const mes = dia.slice(0, 7)
  const comandos: (string | number)[][] = [
    // Contagem bruta do evento no dia
    ['HINCRBY', `ev:${dia}`, evento, 1],
    // Pessoas distintas: no dia, no mês e por evento/dia (para o funil)
    ['PFADD', `u:d:${dia}`, id],
    ['PFADD', `u:m:${mes}`, id],
    ['PFADD', `ue:${dia}:${evento}`, id],
  ]

  const ref = corpo?.ref
  if (refValido(ref)) {
    comandos.push(['HINCRBY', `ref:${dia}`, `${ref}:${evento}`, 1])
    comandos.push(['PFADD', `ur:m:${mes}:${ref}`, id])
  }

  // Dimensões do resultado (só quando a recomendação é gerada)
  const props = (corpo?.props ?? {}) as Record<string, unknown>
  if (evento === 'recomendacao_gerada') {
    for (const campo of ['perfil', 'prazo', 'capacidade'] as const) {
      const valor = props[campo]
      if (rotuloValido(valor)) comandos.push(['HINCRBY', `dim:${mes}:${campo}`, valor, 1])
    }
    if (typeof props.veto === 'boolean') {
      comandos.push(['HINCRBY', `dim:${mes}:veto`, props.veto ? 'sim' : 'nao', 1])
    }
  }
  if (evento === 'tela_vista' && rotuloValido(props.tela)) {
    comandos.push(['HINCRBY', `dim:${mes}:tela`, props.tela, 1])
  }

  try {
    await pipeline(comandos)
  } catch (err) {
    console.error('[api/evento] falha ao gravar métrica:', err)
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
