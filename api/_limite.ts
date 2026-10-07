// Limite de chamadas por IP da API do motor de perfil (api/recomendacao.ts).
//
// Por quê: a API devolve a carteira completa para qualquer combinação de respostas. Quem a chamasse
// milhares de vezes poderia tentar reconstruir as matrizes do motor (docs/06, seção 2). O limite
// torna isso lento, sem atrapalhar o uso normal (uma pessoa chama a API uma ou poucas vezes por sessão).
//
// Desenho:
//  - 60 chamadas por IP a cada 15 minutos. Folgado de propósito: redes de celular compartilham IP
//    entre muitas pessoas, e um bloqueio indevido custa mais do que deixar passar.
//  - Guardamos só um hash do IP (com sal), por 15 minutos, no mesmo Redis das métricas. Sem Redis,
//    vale uma contagem em memória por instância da função (limite mais fraco, mas existe).
//  - FALHA ABERTA: se a contagem der erro, a chamada passa. O limite é proteção, nunca uma
//    nova forma de derrubar o app.
import { createHash } from 'node:crypto'

export const MAX_CHAMADAS = 60
export const JANELA_CHAMADAS_SEGUNDOS = 15 * 60

/** Só o hash do IP vai para o Redis, e some em 15 minutos. */
export function chaveDeChamadas(ip: string, sal = ''): string {
  return `recomendacao:chamadas:${createHash('sha256').update(`${sal}|${ip}`).digest('hex').slice(0, 24)}`
}

export interface Contador {
  /** Soma 1 à contagem da chave (que expira em `janelaSegundos` desde a primeira chamada) e devolve o total. */
  incrementar(chave: string, janelaSegundos: number): Promise<number>
}

export function contadorEmMemoria(agora: () => number = Date.now): Contador {
  const mapa = new Map<string, { n: number; ate: number }>()
  return {
    async incrementar(chave, janelaSegundos) {
      const e = mapa.get(chave)
      const n = e && e.ate > agora() ? e.n + 1 : 1
      mapa.set(chave, { n, ate: e && e.ate > agora() ? e.ate : agora() + janelaSegundos * 1000 })
      if (mapa.size > 5000) for (const [k, v] of mapa) if (v.ate <= agora()) mapa.delete(k)
      return n
    },
  }
}

type Pipeline = (comandos: (string | number)[][]) => Promise<unknown[]>

export function contadorRedis(pipeline: Pipeline): Contador {
  return {
    async incrementar(chave, janelaSegundos) {
      // EXPIRE ... NX: a janela conta da primeira chamada e não é renovada a cada nova chamada.
      const [total] = await pipeline([['INCR', chave], ['EXPIRE', chave, janelaSegundos, 'NX']])
      return Number(total) || 0
    },
  }
}

/** Se o Redis falhar, cai na contagem em memória em vez de travar ou abrir sem contar. */
export function contadorComReserva(principal: Contador, reserva: Contador): Contador {
  return {
    async incrementar(chave, janelaSegundos) {
      const r = await reserva.incrementar(chave, janelaSegundos)
      try {
        return Math.max(r, await principal.incrementar(chave, janelaSegundos))
      } catch {
        return r
      }
    },
  }
}

/** true se esta chamada passou do limite. Qualquer erro na contagem conta como "não passou" (falha aberta). */
export async function passouDoLimite(contador: Contador, chave: string, max = MAX_CHAMADAS, janelaSegundos = JANELA_CHAMADAS_SEGUNDOS): Promise<boolean> {
  try {
    return (await contador.incrementar(chave, janelaSegundos)) > max
  } catch {
    return false
  }
}
