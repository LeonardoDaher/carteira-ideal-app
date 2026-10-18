// Cotações para a faixa rolante do Simule Ações (GET /api/cotacoes).
//
// O navegador não chama fontes externas (a política de segurança do site só permite o próprio
// domínio), então a função busca na brapi.dev e devolve um JSON enxuto. A lista de códigos é FIXA
// aqui: ninguém consegue usar a função como proxy para códigos arbitrários. Cada código é pedido em
// separado, porque os planos gratuitos da brapi limitam quantos códigos cabem em uma chamada.

export const CODIGOS_FAIXA: readonly string[] = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'BBAS3', 'B3SA3', 'ABEV3', 'WEGE3', 'MGLU3', 'ELET3']

export interface CotacaoFaixa {
  rotulo: string
  valor: number
  /** Variação do dia em %. */
  variacao: number | null
  /** 'indice' (pontos), 'moeda' (R$) ou 'acao' (R$). */
  tipo: 'indice' | 'moeda' | 'acao'
}

export interface RespostaCotacoes {
  atualizadoEm: string
  itens: CotacaoFaixa[]
}

type Busca = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>

const BASE = 'https://brapi.dev/api'

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function comToken(url: string, token: string | undefined): string {
  return token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url
}

async function json(busca: Busca, url: string): Promise<unknown> {
  const r = await busca(url)
  if (!r.ok) throw new Error('fonte indisponível')
  return r.json()
}

async function cotacaoDeAcao(busca: Busca, token: string | undefined, codigo: string, rotulo: string, tipo: CotacaoFaixa['tipo']): Promise<CotacaoFaixa> {
  const corpo = (await json(busca, comToken(`${BASE}/quote/${encodeURIComponent(codigo)}`, token))) as { results?: Array<Record<string, unknown>> }
  const r = corpo.results?.[0]
  const valor = num(r?.regularMarketPrice)
  if (valor === null) throw new Error('sem preço')
  return { rotulo, valor, variacao: num(r?.regularMarketChangePercent), tipo }
}

async function dolar(busca: Busca, token: string | undefined): Promise<CotacaoFaixa> {
  const corpo = (await json(busca, comToken(`${BASE}/v2/currency?currency=USD-BRL`, token))) as { currency?: Array<Record<string, unknown>> }
  const r = corpo.currency?.[0]
  const valor = num(Number(r?.bidPrice))
  if (valor === null) throw new Error('sem preço')
  return { rotulo: 'Dólar', valor, variacao: num(Number(r?.percentageChange)), tipo: 'moeda' }
}

/** Junta o que a fonte devolveu; o que falhar fica de fora (a tela completa com o fechamento). */
export async function montarCotacoes(busca: Busca, token: string | undefined, agora: Date = new Date()): Promise<RespostaCotacoes> {
  const pedidos = [
    cotacaoDeAcao(busca, token, '^BVSP', 'Ibovespa', 'indice'),
    dolar(busca, token),
    ...CODIGOS_FAIXA.map((c) => cotacaoDeAcao(busca, token, c, c, 'acao')),
  ]
  const feitos = await Promise.allSettled(pedidos)
  const itens = feitos.flatMap((f) => (f.status === 'fulfilled' ? [f.value] : []))
  return { atualizadoEm: agora.toISOString(), itens }
}
