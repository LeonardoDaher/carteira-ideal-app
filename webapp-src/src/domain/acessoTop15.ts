import type { SnapshotAcoesBaratas } from './acoesBaratas'

/**
 * Acesso ao Top 15 por código mensal (D50). O ranking não vem no arquivo do app: o navegador pede à
 * função api/top15 enviando o código, e ela só devolve a lista se o código estiver certo.
 */

export const CHAVE_CODIGO_TOP15 = 'carteiraideal.top15.codigo'

export type MotivoFalhaTop15 = 'invalido' | 'limite' | 'indisponivel' | 'nao_configurado' | 'rede' | 'resposta'

export type RespostaTop15 = { ok: true; snapshot: SnapshotAcoesBaratas } | { ok: false; motivo: MotivoFalhaTop15; espera?: number }

/** Só para conforto de quem digita: aceita minúsculas, espaços e com ou sem hífen. O servidor normaliza de novo. */
export function limparCodigoDigitado(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
}

/** "CIABCDEFGH" → "CI-ABCD-EFGH" enquanto a pessoa digita. */
export function formatarCodigo(texto: string): string {
  const limpo = limparCodigoDigitado(texto)
  if (limpo.startsWith('CI')) {
    const resto = limpo.slice(2)
    return ['CI', resto.slice(0, 4), resto.slice(4, 8)].filter(Boolean).join('-')
  }
  return limpo
}

export async function buscarTop15(codigo: string, fetchImpl: typeof fetch = fetch): Promise<RespostaTop15> {
  let resp: Response
  try {
    resp = await fetchImpl('/api/top15', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    })
  } catch {
    return { ok: false, motivo: 'rede' }
  }

  let corpo: Record<string, unknown> | null = null
  try {
    corpo = (await resp.json()) as Record<string, unknown>
  } catch {
    // corpo não era JSON
  }

  if (resp.ok) {
    const s = corpo as unknown as SnapshotAcoesBaratas | null
    return s && s.publicado === true && Array.isArray(s.ranking) ? { ok: true, snapshot: s } : { ok: false, motivo: 'resposta' }
  }
  if (resp.status === 401) return { ok: false, motivo: 'invalido' }
  if (resp.status === 429) return { ok: false, motivo: 'limite', espera: typeof corpo?.espera === 'number' ? corpo.espera : undefined }
  if (resp.status === 503) return { ok: false, motivo: corpo?.motivo === 'nao_configurado' ? 'nao_configurado' : 'indisponivel' }
  return { ok: false, motivo: 'resposta' }
}

export function mensagemDaFalha(r: { motivo: MotivoFalhaTop15; espera?: number }): string {
  switch (r.motivo) {
    case 'invalido':
      return 'Código inválido ou vencido. Confira o código mais recente no Instagram.'
    case 'limite': {
      const min = r.espera ? Math.max(1, Math.round(r.espera / 60)) : 15
      return `Muitas tentativas com código errado. Aguarde cerca de ${min} minutos e tente de novo.`
    }
    case 'nao_configurado':
    case 'indisponivel':
      return 'A lista ainda não está disponível. Tente novamente mais tarde.'
    case 'rede':
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
    default:
      return 'Não foi possível carregar a lista agora. Tente novamente em instantes.'
  }
}
