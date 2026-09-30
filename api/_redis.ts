// Cliente mínimo para Redis via REST (Upstash / Vercel KV do Marketplace).
// Sem dependência extra: só fetch. Se as variáveis de ambiente não existirem, as métricas
// ficam desligadas (o app segue funcionando normalmente, só sem contar).
//
// Variáveis aceitas (qualquer um dos dois pares):
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   KV_REST_API_URL        + KV_REST_API_TOKEN   (nomes criados pela integração da Vercel)

type Comando = (string | number)[]

function credenciais() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

export function metricasHabilitadas(): boolean {
  return credenciais() !== null
}

/** Executa vários comandos numa única ida ao servidor. Devolve o resultado de cada um. */
export async function pipeline(comandos: Comando[]): Promise<unknown[]> {
  const cred = credenciais()
  if (!cred) throw new Error('Redis não configurado')
  const resp = await fetch(`${cred.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos),
  })
  if (!resp.ok) throw new Error(`Redis respondeu ${resp.status}`)
  const corpo = (await resp.json()) as { result?: unknown; error?: string }[]
  return corpo.map((item) => {
    if (item.error) throw new Error(item.error)
    return item.result
  })
}
