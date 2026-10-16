// Tipos mínimos do pedido e da resposta das funções da Vercel (D92). Antes vinham de '@vercel/node', pacote usado só para
// estes dois tipos e que trazia dezenas de dependências com alertas de segurança (tar, undici, busboy, path-to-regexp).
// Arquivo com "_" no nome não vira função na Vercel. Só o que as funções usam: se uma função passar a usar outro campo,
// acrescente aqui (o `tsc -b` avisa).
import type { IncomingMessage, ServerResponse } from 'node:http'

export type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>
  body: unknown
}

export type VercelResponse = ServerResponse & {
  status: (codigo: number) => VercelResponse
  json: (corpo: unknown) => VercelResponse
}
