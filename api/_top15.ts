// Porta de acesso ao "Top 15 ações mais baratas" (D50): lógica pura e testável.
//
// O ranking NÃO vai no arquivo do app. Ele fica em dados-privados/acoes-baratas.json, que só esta
// função lê, e só devolve depois de conferir o código do mês. O código fica na variável de ambiente
// TOP15_CODIGOS da Vercel (nunca no repositório): um ou mais códigos separados por vírgula. Dois
// códigos ao mesmo tempo permitem a virada do mês sem derrubar ninguém.
//
// Defesas: comparação em tempo constante; limite de tentativas ERRADAS por IP (guardamos só um hash
// do IP, por 15 minutos); resposta com "no-store"; sem código configurado, a porta fica FECHADA.
import { createHash, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const MAX_FALHAS = 10
export const JANELA_SEGUNDOS = 15 * 60
export const TAMANHO_MINIMO_CODIGO = 8

/** "ci-k7qm 4x9p" → "CIK7QM4X9P": maiúsculas, sem espaço, hífen, ponto ou sublinhado. */
export function normalizarCodigo(bruto: unknown): string {
  if (typeof bruto !== 'string' || bruto.length > 64) return ''
  return bruto.normalize('NFKC').toUpperCase().replace(/[\s\-_.]/g, '')
}

/** Lê TOP15_CODIGOS. Códigos curtos demais são ignorados (erro de digitação não pode abrir a porta). */
export function listaDeCodigos(env: string | undefined): string[] {
  return (env ?? '')
    .split(/[,;\n]/)
    .map(normalizarCodigo)
    .filter((c) => c.length >= TAMANHO_MINIMO_CODIGO)
}

const resumo = (texto: string) => createHash('sha256').update(texto).digest()

/** Compara em tempo constante e sem parar no primeiro acerto (não revela qual código bateu). */
export function codigoConfere(informado: string, validos: string[]): boolean {
  const alvo = resumo(normalizarCodigo(informado))
  let confere = false
  for (const v of validos) if (timingSafeEqual(alvo, resumo(v))) confere = true
  return confere
}

type Cabecalhos = Record<string, string | string[] | undefined>

/** Na Vercel, o x-forwarded-for é definido pela plataforma (o valor enviado pelo cliente é descartado). */
export function ipDe(cabecalhos: Cabecalhos, ipDoSocket?: string): string {
  const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim()
  return primeiro(cabecalhos['x-forwarded-for']) || primeiro(cabecalhos['x-real-ip']) || ipDoSocket || 'desconhecido'
}

/** Só o hash do IP vai para o Redis, e some em 15 minutos. */
export function chaveDeFalhas(ip: string, sal = ''): string {
  return `top15:falhas:${createHash('sha256').update(`${sal}|${ip}`).digest('hex').slice(0, 24)}`
}

export interface Limitador {
  falhas(chave: string): Promise<number>
  registrarFalha(chave: string): Promise<void>
}

/** Reserva para quando não há Redis: vale por instância da função (limite mais fraco, mas existe). */
export function limitadorEmMemoria(agora: () => number = Date.now): Limitador {
  const mapa = new Map<string, { n: number; ate: number }>()
  return {
    async falhas(chave) {
      const e = mapa.get(chave)
      if (!e || e.ate <= agora()) return 0
      return e.n
    },
    async registrarFalha(chave) {
      const e = mapa.get(chave)
      const n = e && e.ate > agora() ? e.n + 1 : 1
      mapa.set(chave, { n, ate: agora() + JANELA_SEGUNDOS * 1000 })
      if (mapa.size > 5000) for (const [k, v] of mapa) if (v.ate <= agora()) mapa.delete(k)
    },
  }
}

type Pipeline = (comandos: (string | number)[][]) => Promise<unknown[]>

export function limitadorRedis(pipeline: Pipeline): Limitador {
  return {
    async falhas(chave) {
      const [valor] = await pipeline([['GET', chave]])
      return Number(valor ?? 0) || 0
    },
    async registrarFalha(chave) {
      await pipeline([['INCR', chave], ['EXPIRE', chave, JANELA_SEGUNDOS]])
    },
  }
}

/** Se o Redis falhar no meio do caminho, cai na reserva em memória em vez de abrir ou travar a porta. */
export function limitadorComReserva(principal: Limitador, reserva: Limitador): Limitador {
  return {
    async falhas(chave) {
      const r = await reserva.falhas(chave)
      try {
        return Math.max(r, await principal.falhas(chave))
      } catch {
        return r
      }
    },
    async registrarFalha(chave) {
      await reserva.registrarFalha(chave)
      try {
        await principal.registrarFalha(chave)
      } catch {
        // segue só com a reserva
      }
    },
  }
}

export type EventoDeAcesso = 'ok' | 'falha' | 'bloqueado'

export interface Dependencias {
  /** Conteúdo bruto da variável de códigos da lista (TOP15_CODIGOS nas ações, TOP15_FIIS_CODIGOS nos FIIs). */
  codigos: () => string | undefined
  /** Conteúdo de dados-privados/acoes-baratas.json, ou null se não existir. */
  lerDados: () => Promise<unknown>
  limitador: Limitador
  /** Contagem agregada de acessos (sem identificar ninguém). Falhar aqui nunca afeta quem acessa. */
  contar?: (evento: EventoDeAcesso) => Promise<void>
  sal?: string
}

export function criarHandler(dep: Dependencias) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Cache-Control', 'private, no-store')

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ erro: 'Método não permitido. Use POST.' })
      return
    }

    const contar = async (e: EventoDeAcesso) => {
      try {
        await dep.contar?.(e)
      } catch {
        // métrica nunca atrapalha
      }
    }

    try {
      const validos = listaDeCodigos(dep.codigos())
      if (validos.length === 0) {
        res.status(503).json({ erro: 'O acesso ao Top 15 ainda não foi configurado.', motivo: 'nao_configurado' })
        return
      }

      const chave = chaveDeFalhas(ipDe(req.headers, req.socket?.remoteAddress), dep.sal)
      if ((await dep.limitador.falhas(chave)) >= MAX_FALHAS) {
        await contar('bloqueado')
        res.setHeader('Retry-After', String(JANELA_SEGUNDOS))
        res.status(429).json({ erro: 'Muitas tentativas com código errado. Tente novamente em alguns minutos.', motivo: 'limite', espera: JANELA_SEGUNDOS })
        return
      }

      const corpo = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as { codigo?: unknown } | undefined
      const codigo = normalizarCodigo(corpo?.codigo)
      if (codigo === '') {
        res.status(400).json({ erro: 'Informe o código.', motivo: 'codigo_vazio' })
        return
      }

      if (!codigoConfere(codigo, validos)) {
        await dep.limitador.registrarFalha(chave)
        await contar('falha')
        res.status(401).json({ erro: 'Código inválido ou vencido.', motivo: 'invalido' })
        return
      }

      const dados = (await dep.lerDados()) as { publicado?: boolean } | null
      if (!dados || dados.publicado !== true) {
        res.status(503).json({ erro: 'A lista ainda não está disponível. Tente novamente mais tarde.', motivo: 'indisponivel' })
        return
      }

      await contar('ok')
      res.status(200).json(dados)
    } catch (err) {
      console.error('[api/top15] erro:', err instanceof Error ? err.message : err)
      res.status(500).json({ erro: 'Erro interno. Tente novamente em instantes.' })
    }
  }
}

function safeParse(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return undefined
  }
}
