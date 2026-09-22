// POST /api/recomendacao
//
// Esta função roda no servidor (Vercel Serverless Function), nunca no navegador do
// cliente. É aqui — e só aqui — que o motor de decisão (engine.ts: matrizes, regra de
// veto, calibradores suaves) é executado. O front-end (src/) não importa mais
// `domain/engine`; ele só envia as respostas e recebe de volta o resultado já calculado.
//
// Isso significa que quem inspecionar o bundle JS publicado no navegador não encontra
// mais as matrizes de alocação, os pesos das perguntas ou a regra de veto — só encontra
// uma chamada de rede para este endpoint.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { gerarRecomendacao } from '../webapp-src/src/domain/engine'
import { validarPayload } from './_validacao'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS básico: ajuste ALLOWED_ORIGIN nas variáveis de ambiente da Vercel se o front
  // for servido de um domínio diferente do da própria função (ex.: apps mobile via WebView).
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido. Use POST.' })
    return
  }

  const validacao = validarPayload(req.body)
  if (!validacao.ok) {
    res.status(400).json({ erro: validacao.erro })
    return
  }

  try {
    const resultado = gerarRecomendacao(
      validacao.respostas,
      validacao.dados,
      validacao.respostasArquitetura,
    )
    res.status(200).json(resultado)
  } catch (err) {
    console.error('[api/recomendacao] erro ao gerar recomendação:', err)
    res.status(500).json({ erro: 'Erro interno ao calcular a recomendação.' })
  }
}
