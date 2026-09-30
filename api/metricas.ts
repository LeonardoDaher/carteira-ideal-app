// GET /api/metricas?dias=30   (cabeçalho: Authorization: Bearer <METRICAS_TOKEN>)
//
// Painel de números para apresentar a parceiros e fundações. Só responde a quem tiver o
// token definido na variável de ambiente METRICAS_TOKEN (Vercel → Settings → Environment
// Variables). Sem o token configurado, o endpoint fica fechado.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { pipeline, metricasHabilitadas } from './_redis.js'
import { EVENTOS_FUNIL, EVENTOS_EXTRAS, dataBrasilia } from './_eventos.js'

const TODOS_EVENTOS = [...EVENTOS_FUNIL, ...EVENTOS_EXTRAS]

function ultimosDias(n: number): string[] {
  const dias: string[] = []
  const base = Date.now()
  for (let i = n - 1; i >= 0; i--) dias.push(dataBrasilia(new Date(base - i * 86_400_000)))
  return dias
}

function paraObjeto(lista: unknown): Record<string, number> {
  const obj: Record<string, number> = {}
  if (!Array.isArray(lista)) return obj
  for (let i = 0; i + 1 < lista.length; i += 2) obj[String(lista[i])] = Number(lista[i + 1])
  return obj
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.METRICAS_TOKEN
  const enviado = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token || enviado !== token) {
    res.status(401).json({ erro: 'Não autorizado.' })
    return
  }
  if (!metricasHabilitadas()) {
    res.status(503).json({ erro: 'Banco de métricas não configurado.' })
    return
  }

  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365)
  const lista = ultimosDias(dias)
  const meses = [...new Set(lista.map((d) => d.slice(0, 7)))]

  const comandos: (string | number)[][] = []
  for (const d of lista) {
    comandos.push(['HGETALL', `ev:${d}`])
    comandos.push(['PFCOUNT', `u:d:${d}`])
  }
  for (const m of meses) {
    comandos.push(['PFCOUNT', `u:m:${m}`])
    for (const campo of ['perfil', 'prazo', 'capacidade', 'veto', 'tela']) comandos.push(['HGETALL', `dim:${m}:${campo}`])
  }
  // Pessoas distintas no período inteiro, por evento do funil (união dos dias)
  for (const ev of EVENTOS_FUNIL) comandos.push(['PFCOUNT', ...lista.map((d) => `ue:${d}:${ev}`)])
  comandos.push(['PFCOUNT', ...lista.map((d) => `u:d:${d}`)])

  try {
    const r = await pipeline(comandos)
    let i = 0
    const porDia = lista.map((d) => {
      const eventos = paraObjeto(r[i++])
      const visitantes = Number(r[i++])
      return { dia: d, visitantes, eventos }
    })
    const mensal = meses.map((m) => {
      const ativos = Number(r[i++])
      const dim: Record<string, Record<string, number>> = {}
      for (const campo of ['perfil', 'prazo', 'capacidade', 'veto', 'tela']) dim[campo] = paraObjeto(r[i++])
      return { mes: m, usuariosAtivosMes: ativos, distribuicao: dim }
    })
    const funil = EVENTOS_FUNIL.map((ev) => ({ etapa: ev, pessoas: Number(r[i++]) }))
    const visitantesUnicosNoPeriodo = Number(r[i++])

    const total = (ev: string) => porDia.reduce((s, d) => s + (d.eventos[ev] ?? 0), 0)
    const eventosNoPeriodo = Object.fromEntries(TODOS_EVENTOS.map((ev) => [ev, total(ev)]))
    const taxaConclusao =
      funil[0].pessoas > 0 ? Math.round((funil[funil.length - 1].pessoas / funil[0].pessoas) * 1000) / 10 : 0

    res.status(200).json({
      periodoDias: dias,
      visitantesUnicosNoPeriodo,
      recomendacoesGeradas: eventosNoPeriodo.recomendacao_gerada,
      taxaConclusaoFunilPercentual: taxaConclusao,
      funil,
      eventosNoPeriodo,
      mensal,
      porDia,
    })
  } catch (err) {
    console.error('[api/metricas] falha ao ler métricas:', err)
    res.status(500).json({ erro: 'Erro ao ler métricas.' })
  }
}
