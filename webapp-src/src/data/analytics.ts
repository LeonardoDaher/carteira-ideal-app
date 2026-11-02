// Métricas de uso anônimas (envia para /api/evento).
//
// O que é enviado: o nome do evento, um código aleatório do navegador (para contar pessoas
// distintas sem saber quem são), a origem opcional (?ref=) e, no resultado, só rótulos
// agregados (perfil, prazo, capacidade, se houve veto). Nunca são enviadas as respostas
// individuais, nem idade, nem valores em reais.
//
// Falhas são silenciosas de propósito: métrica jamais pode atrapalhar o uso do app. Quem
// ativa o "Não rastrear" do navegador não é contado.
import { storage } from './storage'

export type EventoUso =
  | 'visita'
  | 'questionario_iniciado'
  | 'suitability_concluido'
  | 'arquitetura_concluida'
  | 'recomendacao_gerada'
  | 'recomendacao_erro'
  | 'tela_vista'
  | 'app_instalado'
  | 'alerta_ativado'

export type PropsEvento = {
  perfil?: string
  prazo?: string
  capacidade?: string
  veto?: boolean
  tela?: string
}

const CHAVE_ID = 'carteiraideal.idAnonimo'
const CHAVE_REF = 'carteiraideal.ref'
const CHAVE_COORTE = 'carteiraideal.primeiraVisita'

let idEmMemoria: string | null = null
let refEmMemoria: string | null = null
let coorteEmMemoria: string | null = null

function gerarId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // cai no fallback abaixo
  }
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-')
}

function naoRastrear(): boolean {
  try {
    return navigator.doNotTrack === '1' || (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  } catch {
    return false
  }
}

async function obterId(): Promise<string> {
  if (idEmMemoria) return idEmMemoria
  let id = await storage.getItem(CHAVE_ID)
  if (!id) {
    id = gerarId()
    await storage.setItem(CHAVE_ID, id)
  }
  idEmMemoria = id
  return id
}

/** Lê ?ref=parceiro da URL (uma vez) e o guarda: eventos seguintes levam a mesma origem. */
async function obterRef(): Promise<string | undefined> {
  if (refEmMemoria !== null) return refEmMemoria || undefined
  let ref = ''
  try {
    const daUrl = new URLSearchParams(window.location.search).get('ref')?.toLowerCase() ?? ''
    if (/^[a-z0-9_-]{1,30}$/.test(daUrl)) {
      ref = daUrl
      await storage.setItem(CHAVE_REF, ref)
    } else {
      ref = (await storage.getItem(CHAVE_REF)) ?? ''
    }
  } catch {
    ref = ''
  }
  refEmMemoria = ref
  return ref || undefined
}

/** Dia (AAAA-MM-DD, horário de Brasília) da primeira visita deste navegador. Só serve para medir retenção. */
async function obterCoorte(): Promise<string | undefined> {
  if (coorteEmMemoria !== null) return coorteEmMemoria || undefined
  let coorte = ''
  try {
    coorte = (await storage.getItem(CHAVE_COORTE)) ?? ''
    if (!/^d{4}-d{2}-d{2}$/.test(coorte)) {
      coorte = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      await storage.setItem(CHAVE_COORTE, coorte)
    }
  } catch {
    coorte = ''
  }
  coorteEmMemoria = coorte
  return coorte || undefined
}

/** Guarda na sessão do navegador (some ao fechar a aba) o que já foi enviado. */
function jaEnviouNaSessao(chave: string): boolean {
  const k = `carteiraideal.ev.${chave}`
  try {
    if (sessionStorage.getItem(k)) return true
    sessionStorage.setItem(k, '1')
    return false
  } catch {
    return false
  }
}

/** Registra um evento. `unicoPorSessao` evita contar de novo (ex.: "visita" em recarregamentos). */
export async function registrarEvento(evento: EventoUso, props?: PropsEvento, opcoes?: { unicoPorSessao?: boolean }) {
  try {
    if (naoRastrear()) return
    const chaveSessao = `${evento}:${props?.tela ?? ''}`
    if (opcoes?.unicoPorSessao && jaEnviouNaSessao(chaveSessao)) return
    const [id, ref, coorte] = await Promise.all([obterId(), obterRef(), evento === 'visita' ? obterCoorte() : Promise.resolve(undefined)])
    const corpo = JSON.stringify({ evento, id, ref, coorte, props })
    // sendBeacon sobrevive ao fechamento da aba; fetch keepalive é o plano B.
    const enviado =
      typeof navigator !== 'undefined' && 'sendBeacon' in navigator
        ? navigator.sendBeacon('/api/evento', new Blob([corpo], { type: 'application/json' }))
        : false
    if (!enviado) {
      await fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: true })
    }
  } catch {
    // métrica nunca pode quebrar o app
  }
}
