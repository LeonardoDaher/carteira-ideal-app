// Regras compartilhadas das métricas de uso (api/evento.ts grava, api/metricas.ts lê).
//
// PRIVACIDADE (LGPD): só entram aqui contagens agregadas. Não se grava IP, nome, e-mail,
// CPF nem as respostas individuais do questionário. O identificador do visitante é um
// código aleatório gerado no navegador e só alimenta um HyperLogLog (estrutura que conta
// pessoas distintas sem guardar quem são).

/** Funil de uso, na ordem em que acontece. */
export const EVENTOS_FUNIL = [
  'visita',
  'questionario_iniciado',
  'suitability_concluido',
  'arquitetura_concluida',
  'recomendacao_gerada',
] as const

/** Demais eventos aceitos. */
export const EVENTOS_EXTRAS = ['recomendacao_erro', 'tela_vista', 'app_instalado', 'alerta_ativado'] as const

export const EVENTOS_ACEITOS: readonly string[] = [...EVENTOS_FUNIL, ...EVENTOS_EXTRAS]

/** Fuso usado para fechar o "dia" das métricas. */
const FUSO = 'America/Sao_Paulo'

/** Data no formato AAAA-MM-DD no horário de Brasília. */
export function dataBrasilia(agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora)
}

/** Valida o identificador anônimo: 8 a 64 caracteres [a-zA-Z0-9-]. */
export function idAnonimoValido(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(id)
}

/** Parceiro/origem (?ref=): minúsculas, números, hífen e sublinhado; até 30 caracteres. */
export function refValido(ref: unknown): ref is string {
  return typeof ref === 'string' && /^[a-z0-9_-]{1,30}$/.test(ref)
}

/** Texto curto e seguro para usar como rótulo de contador (perfil, prazo, tela). */
export function rotuloValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[\p{L}0-9 ()/_.\-–]{1,60}$/u.test(valor)
}

/** Data AAAA-MM-DD válida (usada como coorte: dia da primeira visita do navegador). */
export function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const d = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor
}

/** Soma (ou subtrai) dias a uma data AAAA-MM-DD, sem depender de fuso. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Telas cujas pessoas distintas são contadas por mês (as demais entram só na contagem de aberturas). */
export const TELAS_CONTADAS = [
  'aprender', 'trilha', 'aprenderVideo', 'simuleFii', 'simuleTesouro', 'simuleBdr', 'simuleEtf',
  'simuleFuturos', 'simuleOpcoes', 'simuleAcoes', 'simuleAtivos', 'simuleImovel', 'simuleCarro',
  'simuleMoto', 'simuleBens', 'suaHp12c', 'meuMes', 'minhaCarteira', 'carteira', 'simulador',
] as const
