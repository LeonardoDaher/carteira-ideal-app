// GET /api/metricas?dias=30   (cabeçalho: Authorization: Bearer <METRICAS_TOKEN>)
//
// Painel de números para apresentar a parceiros e fundações. Só responde a quem tiver o
// token definido na variável de ambiente METRICAS_TOKEN (Vercel → Settings → Environment
// Variables). Sem o token configurado, o endpoint fica fechado.
import type { VercelRequest, VercelResponse } from './_tipos'
import { pipeline, metricasHabilitadas } from './_redis.js'
import { EVENTOS_FUNIL, EVENTOS_EXTRAS, TELAS_CONTADAS, dataBrasilia, somarDias } from './_eventos.js'
import { timingSafeEqual, createHash } from 'node:crypto'
import { chaveDeChamadas, contadorComReserva, contadorEmMemoria, contadorRedis, JANELA_CHAMADAS_SEGUNDOS, passouDoLimite } from './_limite.js'
import type { Contador } from './_limite.js'
import { ipDe } from './_top15.js'

// Proteção do token (D85): comparação em tempo constante e limite de tentativas por IP, para que
// ninguém descubra o METRICAS_TOKEN por força bruta ou por tempo de resposta.
const MAX_TENTATIVAS = 30
const reserva = contadorEmMemoria()
const contador: Contador = metricasHabilitadas() ? contadorComReserva(contadorRedis(pipeline), reserva) : reserva
const sal = process.env.TOP15_SAL ?? ''

function mesmoToken(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// Retenção olha no máximo as coortes dos últimos 90 dias (cada coorte custa 2 consultas ao Redis).
const MAX_COORTES = 90

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
  const chave = chaveDeChamadas(ipDe(req.headers, req.socket?.remoteAddress), sal, 'metricas:tentativas')
  if (await passouDoLimite(contador, chave, MAX_TENTATIVAS, JANELA_CHAMADAS_SEGUNDOS)) {
    res.setHeader('Retry-After', String(JANELA_CHAMADAS_SEGUNDOS))
    res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos.' })
    return
  }
  if (!token || !mesmoToken(enviado, token)) {
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

  // Retenção: por coorte (dia da primeira visita), quantos voltaram em até 7 e em até 30 dias.
  const hoje = lista[lista.length - 1]
  const coortes = lista.slice(-MAX_COORTES)
  for (const c of coortes) {
    comandos.push(['PFCOUNT', `rc:${c}:${c}`])
    const apos = (n: number) => Array.from({ length: n }, (_, k) => somarDias(c, k + 1)).filter((d) => d <= hoje).map((d) => `rc:${c}:${d}`)
    const ate7 = apos(7)
    const ate30 = apos(30)
    comandos.push(ate7.length ? ['PFCOUNT', ...ate7] : ['PFCOUNT', 'rc:vazio'])
    comandos.push(ate30.length ? ['PFCOUNT', ...ate30] : ['PFCOUNT', 'rc:vazio'])
  }
  // Pessoas distintas por tela, em cada mês do período
  for (const mes of meses) for (const t of TELAS_CONTADAS) comandos.push(['PFCOUNT', `ut:${mes}:${t}`])

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

    const coorteDados = coortes.map((c) => ({ coorte: c, novos: Number(r[i++]), voltaram7: Number(r[i++]), voltaram30: Number(r[i++]) }))
    const pessoasPorTela: Record<string, number> = {}
    for (const _mes of meses) {
      for (const t of TELAS_CONTADAS) {
        const n = Number(r[i++])
        // Soma dos meses: uma pessoa ativa em dois meses conta duas vezes (é um uso, não um total único).
        if (n > 0) pessoasPorTela[t] = (pessoasPorTela[t] ?? 0) + n
      }
    }
    // Só entram no percentual as coortes velhas o bastante para a janela ter fechado.
    const idade = (c: string) => (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${c}T00:00:00Z`)) / 86_400_000
    const resumo = (janela: 7 | 30) => {
      const fechadas = coorteDados.filter((c) => idade(c.coorte) >= janela)
      const base = fechadas.reduce((s, c) => s + c.novos, 0)
      const voltaram = fechadas.reduce((s, c) => s + (janela === 7 ? c.voltaram7 : c.voltaram30), 0)
      return { base, voltaram, percentual: base > 0 ? Math.round((voltaram / base) * 1000) / 10 : null }
    }
    const retencao = { voltaramEmAte7Dias: resumo(7), voltaramEmAte30Dias: resumo(30), coortes: coorteDados }

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
      retencao,
      pessoasPorTela,
      eventosNoPeriodo,
      mensal,
      porDia,
    })
  } catch (err) {
    console.error('[api/metricas] falha ao ler métricas:', err)
    res.status(500).json({ erro: 'Erro ao ler métricas.' })
  }
}
