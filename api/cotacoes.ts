// GET /api/cotacoes
//
// Cotações do Ibovespa, do dólar e de ações líquidas para a faixa rolante do Simule Ações. A fonte é a
// brapi.dev; se existir a variável BRAPI_TOKEN na Vercel, ela é usada (planos gratuitos exigem token).
// O resultado é guardado na borda da Vercel por 60 segundos, então muitas pessoas não geram muitas
// chamadas à fonte. Se a fonte falhar, devolve lista vazia e a tela usa o último fechamento.
import type { VercelRequest, VercelResponse } from './_tipos'
import { montarCotacoes } from './_cotacoes.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  try {
    const corpo = await montarCotacoes((url) => fetch(url, { signal: AbortSignal.timeout(6000) }), process.env.BRAPI_TOKEN)
    res.setHeader('Cache-Control', corpo.itens.length > 0 ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store')
    return res.status(200).json(corpo)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ atualizadoEm: new Date().toISOString(), itens: [] })
  }
}
