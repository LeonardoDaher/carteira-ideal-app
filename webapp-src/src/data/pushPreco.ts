// Aviso de preço teto com o app fechado (D127), lado do aparelho: registra o service worker, cria a inscrição de push e conta ao servidor
// quais ações acompanhar. O envio em si é feito pelo job do GitHub (scripts/avisar-preco-teto.mjs). Tudo recebe o ambiente por parâmetro
// para ser testado sem navegador de verdade.

export interface DadosDoAviso {
  tickers: string[]
  taxa: number
  avisados: string[]
}

export type ResultadoAtivar = 'ligado' | 'negado' | 'indisponivel' | 'precisa-instalar' | 'erro'

interface AmbientePush {
  suporta: boolean
  iosSemInstalar: boolean
  permissao: () => string
  pedirPermissao: () => Promise<string>
  registro: () => Promise<{ pushManager: { getSubscription(): Promise<PushSubscriptionLike | null>; subscribe(o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSubscriptionLike> } }>
  buscar: typeof fetch
}

export interface PushSubscriptionLike {
  endpoint: string
  toJSON(): { endpoint?: string; keys?: Record<string, string> }
  unsubscribe(): Promise<boolean>
}

export function ambienteDoNavegador(): AmbientePush {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const suporta = !!nav && 'serviceWorker' in nav && typeof window !== 'undefined' && 'PushManager' in window && typeof Notification !== 'undefined'
  const ua = nav?.userAgent ?? ''
  const ios = /iPhone|iPad|iPod/.test(ua)
  const instalado = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches === true || (nav as { standalone?: boolean } | undefined)?.standalone === true)
  return {
    suporta,
    // No iPhone o push só existe com o app instalado na tela inicial (iOS 16.4 ou mais novo).
    iosSemInstalar: ios && !instalado,
    permissao: () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
    pedirPermissao: () => Notification.requestPermission(),
    registro: async () => {
      await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
      return (await navigator.serviceWorker.ready) as unknown as Awaited<ReturnType<AmbientePush['registro']>>
    },
    buscar: (...args) => fetch(...args),
  }
}

export function chaveParaBytes(base64url: string): Uint8Array {
  const preenchido = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const bin = atob(preenchido)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const enviar = (amb: AmbientePush, metodo: 'POST' | 'DELETE', corpo: unknown) =>
  amb.buscar('/api/push-inscrever', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })

function corpoDaInscricao(sub: PushSubscriptionLike, dados: DadosDoAviso) {
  const j = sub.toJSON()
  return { inscricao: { endpoint: j.endpoint ?? sub.endpoint, keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth } }, tickers: dados.tickers, taxa: dados.taxa, avisados: dados.avisados }
}

export function suportaPush(amb: AmbientePush = ambienteDoNavegador()): boolean {
  return amb.suporta
}

/** Já existe inscrição neste aparelho? (sem pedir nada ao usuário) */
export async function pushLigado(amb: AmbientePush = ambienteDoNavegador()): Promise<boolean> {
  if (!amb.suporta || amb.permissao() !== 'granted') return false
  try {
    return (await (await amb.registro()).pushManager.getSubscription()) !== null
  } catch {
    return false
  }
}

export async function ativarPush(dados: DadosDoAviso, amb: AmbientePush = ambienteDoNavegador()): Promise<ResultadoAtivar> {
  if (!amb.suporta) return amb.iosSemInstalar ? 'precisa-instalar' : 'indisponivel'
  if (amb.iosSemInstalar) return 'precisa-instalar'
  try {
    const rChave = await amb.buscar('/api/push-chave')
    if (!rChave.ok) return 'indisponivel'
    const { chave } = ((await rChave.json().catch(() => null)) ?? {}) as { chave?: string }
    if (!chave) return 'indisponivel'
    let permissao = amb.permissao()
    if (permissao === 'default') permissao = await amb.pedirPermissao()
    if (permissao !== 'granted') return 'negado'
    const reg = await amb.registro()
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }))
    const r = await enviar(amb, 'POST', corpoDaInscricao(sub, dados))
    if (!r.ok) {
      await sub.unsubscribe().catch(() => false)
      return 'erro'
    }
    return 'ligado'
  } catch {
    return 'erro'
  }
}

/** Reenvia a lista (acompanhadas e taxa) ao servidor. Silencioso: se falhar, o próximo ajuste tenta de novo. */
export async function sincronizarPush(dados: DadosDoAviso, amb: AmbientePush = ambienteDoNavegador()): Promise<boolean> {
  try {
    const sub = await (await amb.registro()).pushManager.getSubscription()
    if (!sub) return false
    return (await enviar(amb, 'POST', corpoDaInscricao(sub, dados))).ok
  } catch {
    return false
  }
}

export async function desativarPush(amb: AmbientePush = ambienteDoNavegador()): Promise<void> {
  try {
    const sub = await (await amb.registro()).pushManager.getSubscription()
    if (!sub) return
    await enviar(amb, 'DELETE', { inscricao: { endpoint: sub.endpoint } })
    await sub.unsubscribe()
  } catch {
    // sem rede: a inscrição local continua e o servidor a descarta quando o navegador a recusar
  }
}
