// POST /api/evento
//
// Recebe um evento anônimo de uso do app (ex.: "recomendacao_gerada") e o soma nos
// contadores diários. Nunca devolve erro ao navegador por falha de métrica: contar não
// pode atrapalhar quem está usando o app.
//
// Corpo esperado: { evento, id, ref?, coorte?, props? { perfil?, prazo?, capacidade?, veto?, tela? } }
// `coorte` é o dia (AAAA-MM-DD) da primeira visita do navegador; serve só para medir retenção.
import type { VercelRequest, VercelResponse } from './_tipos.js'
import { pipeline, metricasHabilitadas } from './_redis.js'
import { EVENTOS_ACEITOS, dataBrasilia, dataValida, idAnonimoValido, refValido, rotuloValido, somarDias, TELAS_CONTADAS } from './_eventos.js'
import { aplicarCors } from './_cors.js'
import { chaveDeChamadas, contadorComReserva, contadorEmMemoria, contadorRedis, JANELA_CHAMADAS_SEGUNDOS, passouDoLimite } from './_limite.js'
import type { Contador } from './_limite.js'
import { ipDe } from './_top15.js'

// Limite por IP (D85): sem ele, qualquer script poderia inflar as métricas. 300 a cada 15 minutos é
// folgado (o app manda poucos eventos por sessão e redes de celular compartilham IP). Ao passar do
// limite o evento é descartado em silêncio: contar nunca devolve erro ao navegador.
const MAX_EVENTOS = 300
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
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido. Use POST.' })
    return
  }

  // Sem Redis configurado, as métricas estão desligadas: responde OK e segue.
  if (!metricasHabilitadas()) {
    res.status(204).end()
    return
  }

  const chave = chaveDeChamadas(ipDe(req.headers, req.socket?.remoteAddress), sal, 'evento:chamadas')
  if (await passouDoLimite(contador, chave, MAX_EVENTOS, JANELA_CHAMADAS_SEGUNDOS)) {
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

  // Retenção: em cada visita, marca a pessoa no dia da sua coorte. Descarta coorte futura ou com mais de 400 dias.
  const coorte = corpo?.coorte
  if (evento === 'visita' && dataValida(coorte) && coorte <= dia && coorte >= somarDias(dia, -400)) {
    comandos.push(['PFADD', `rc:${coorte}:${dia}`, id])
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
    if ((TELAS_CONTADAS as readonly string[]).includes(props.tela)) comandos.push(['PFADD', `ut:${mes}:${props.tela}`, id])
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
