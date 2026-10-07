import type { SnapshotAcoesBaratas } from './acoesBaratas'
import type { SnapshotFiiBaratos } from './fiiBaratos'

/**
 * Acesso ao Top 15 por código mensal (D50). O ranking não vem no arquivo do app: o navegador pede à
 * função api/top15 (ações) ou api/top15-fiis (FIIs, D65) enviando o código, e ela só devolve a lista
 * se o código estiver certo. Cada classe de ativos tem o SEU código (D66): ações em TOP15_CODIGOS, FIIs em
 * TOP15_FIIS_CODIGOS, e o app guarda cada um em chave própria.
 */

/** Código das ações (chave mantida desde a D50: quem já liberou as ações continua liberado). */
export const CHAVE_CODIGO_TOP15 = 'carteiraideal.top15.codigo'
/** Código dos FIIs. */
export const CHAVE_CODIGO_TOP15_FIIS = 'carteiraideal.top15fiis.codigo'

export type MotivoFalhaTop15 = 'invalido' | 'limite' | 'indisponivel' | 'nao_configurado' | 'rede' | 'resposta'

/** Resposta de uma das listas protegidas por código. O campo se chama `snapshot` nas duas. */
export type RespostaLista<T> = { ok: true; snapshot: T } | { ok: false; motivo: MotivoFalhaTop15; espera?: number }

export type RespostaTop15 = RespostaLista<SnapshotAcoesBaratas>
export type RespostaTop15Fiis = RespostaLista<SnapshotFiiBaratos>

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

async function pedirLista<T>(url: string, codigo: string, valida: (corpo: unknown) => corpo is T, fetchImpl: typeof fetch): Promise<RespostaLista<T>> {
  let resp: Response
  try {
    resp = await fetchImpl(url, {
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

  if (resp.ok) return valida(corpo) ? { ok: true, snapshot: corpo } : { ok: false, motivo: 'resposta' }
  if (resp.status === 401) return { ok: false, motivo: 'invalido' }
  if (resp.status === 429) return { ok: false, motivo: 'limite', espera: typeof corpo?.espera === 'number' ? corpo.espera : undefined }
  if (resp.status === 503) return { ok: false, motivo: corpo?.motivo === 'nao_configurado' ? 'nao_configurado' : 'indisponivel' }
  return { ok: false, motivo: 'resposta' }
}

export async function buscarTop15(codigo: string, fetchImpl: typeof fetch = fetch): Promise<RespostaTop15> {
  return pedirLista('/api/top15', codigo, (s): s is SnapshotAcoesBaratas => !!s && (s as SnapshotAcoesBaratas).publicado === true && Array.isArray((s as SnapshotAcoesBaratas).ranking), fetchImpl)
}

export async function buscarTop15Fiis(codigo: string, fetchImpl: typeof fetch = fetch): Promise<RespostaTop15Fiis> {
  return pedirLista('/api/top15-fiis', codigo, (s): s is SnapshotFiiBaratos => !!s && (s as SnapshotFiiBaratos).publicado === true && Array.isArray((s as SnapshotFiiBaratos).tijolo) && Array.isArray((s as SnapshotFiiBaratos).papel), fetchImpl)
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
