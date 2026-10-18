// GET /api/cotacoes
//
// Cotações do Ibovespa, do dólar e de ações líquidas para a faixa rolante do Simule Ações. A fonte é a
// brapi.dev; se existir a variável BRAPI_TOKEN na Vercel, ela é usada (planos gratuitos exigem token).
// O resultado é guardado na borda da Vercel por 15 minutos, então muitas pessoas não geram muitas
// chamadas à fonte (no máximo 6 a cada 15 minutos por região da borda). Se a fonte falhar, devolve lista vazia e a tela usa o último fechamento.
import type { VercelRequest, VercelResponse } from './_tipos'
import { montarCotacoes } from './_cotacoes.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ erro: 'método não permitido' })
  }
  try {
    const corpo = await montarCotacoes((url) => fetch(url, { signal: AbortSignal.timeout(6000) }), process.env.BRAPI_TOKEN)
    res.setHeader('Cache-Control', corpo.itens.length > 0 ? 'public, s-maxage=900, stale-while-revalidate=900' : 'no-store')
    return res.status(200).json(corpo)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ atualizadoEm: new Date().toISOString(), itens: [] })
  }
}
