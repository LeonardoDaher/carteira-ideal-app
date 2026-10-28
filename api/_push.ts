// Avisos de preço teto com o app fechado (D127): validação do que o aparelho manda e chave do registro no Redis.
//
// O servidor guarda, por aparelho, só o necessário para mandar o aviso: o endereço de entrega do navegador (endpoint) com as duas chaves de
// criptografia, os códigos das ações acompanhadas, a taxa de Bazin e quem já foi avisado. Nada de nome, e-mail, IP ou carteira.
// Arquivo com "_" no nome não vira função na Vercel.
import { createHash } from 'node:crypto'

export const MAX_TICKERS = 60
export const TAXAS_ACEITAS: readonly number[] = [0.06, 0.08, 0.1, 0.12]
/** O registro expira se o aparelho ficar tanto tempo sem abrir o app (cada abertura renova). */
export const VALIDADE_SEGUNDOS = 90 * 24 * 60 * 60
export const CHAVE_INDICE = 'push:todos'

/**
 * Só aceitamos endereços dos serviços de push dos navegadores. Sem isto, o job (que faz um POST em cada endpoint guardado) poderia ser
 * usado para chamar qualquer endereço da internet (SSRF).
 */
const HOSTS_DE_PUSH: RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge e Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)push\.apple\.com$/, // Safari (iPhone e Mac)
  /\.notify\.windows\.com$/, // Edge/Windows
]

export function hostDePushValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 700) return false
  let u: URL
  try {
    u = new URL(endpoint)
  } catch {
    return false
  }
  return u.protocol === 'https:' && !u.port && !u.username && !u.password && HOSTS_DE_PUSH.some((r) => r.test(u.hostname))
}

export function idDoEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32)
}

export const chaveDoAparelho = (id: string) => `push:a:${id}`

export interface Inscricao {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PedidoDeInscricao {
  inscricao: Inscricao
  tickers: string[]
  taxa: number
  avisados: string[]
}

const BASE64URL = /^[A-Za-z0-9_-]{8,200}$/
const CODIGO = /^[A-Z]{4}\d{1,2}$/

const codigos = (v: unknown): string[] | null => {
  if (!Array.isArray(v) || v.length > MAX_TICKERS) return null
  if (!v.every((t) => typeof t === 'string' && CODIGO.test(t))) return null
  return [...new Set(v as string[])]
}

export function validarPedido(corpo: unknown): { ok: true; pedido: PedidoDeInscricao } | { ok: false; erro: string } {
  const c = (corpo ?? {}) as Record<string, unknown>
  const ins = (c.inscricao ?? {}) as Record<string, unknown>
  const keys = (ins.keys ?? {}) as Record<string, unknown>
  if (!hostDePushValido(ins.endpoint)) return { ok: false, erro: 'Endereço de aviso inválido.' }
  if (typeof keys.p256dh !== 'string' || !BASE64URL.test(keys.p256dh) || typeof keys.auth !== 'string' || !BASE64URL.test(keys.auth)) {
    return { ok: false, erro: 'Chaves de aviso inválidas.' }
  }
  const tickers = codigos(c.tickers)
  if (!tickers) return { ok: false, erro: 'Lista de ações inválida.' }
  const avisados = c.avisados === undefined ? [] : codigos(c.avisados)
  if (!avisados) return { ok: false, erro: 'Lista de avisados inválida.' }
  if (typeof c.taxa !== 'number' || !TAXAS_ACEITAS.includes(c.taxa)) return { ok: false, erro: 'Taxa inválida.' }
  return { ok: true, pedido: { inscricao: { endpoint: ins.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, tickers, taxa: c.taxa, avisados } }
}

/** Registro guardado no Redis (JSON). */
export interface RegistroDoAparelho {
  inscricao: Inscricao
  tickers: string[]
  taxa: number
  avisados: string[]
  atualizadoEm: string
}

/** Atualiza o registro mantendo quem já foi avisado (só dos códigos que continuam na lista); o primeiro registro usa o que o aparelho já viu. */
export function montarRegistro(pedido: PedidoDeInscricao, anterior: RegistroDoAparelho | null, agora: Date): RegistroDoAparelho {
  const acompanhados = new Set(pedido.tickers)
  const base = anterior ? anterior.avisados : pedido.avisados
  return {
    inscricao: pedido.inscricao,
    tickers: pedido.tickers,
    taxa: pedido.taxa,
    avisados: base.filter((t) => acompanhados.has(t)),
    atualizadoEm: agora.toISOString(),
  }
}
