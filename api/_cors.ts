// Origens permitidas das funções da API (D85).
//
// O app e a API ficam no MESMO domínio (carteiraideal.app.br), então o próprio app nunca precisa
// de CORS. Antes, as funções respondiam `Access-Control-Allow-Origin: *`, o que deixava qualquer
// site chamar a API pelo navegador dos seus visitantes (e gastar o limite por IP deles). Agora:
//  - a lista padrão é o domínio definitivo (com e sem "www");
//  - a variável ALLOWED_ORIGIN da Vercel, se existir, substitui a lista (várias origens separadas
//    por vírgula; "*" continua valendo, de forma explícita);
//  - requisição de navegador com `Origin` fora da lista é recusada (403), sem cabeçalho CORS;
//  - requisição sem `Origin` (curl, servidor) segue em frente: o que a limita é o limite por IP.
//
// Atenção: CORS protege o navegador do visitante, não o servidor. Quem chama a API fora de um
// navegador não é barrado por isto (por isso existem o limite por IP, o código do Top 15 e o token
// do painel).

export const ORIGENS_PADRAO: readonly string[] = ['https://carteiraideal.app.br', 'https://www.carteiraideal.app.br']

type Cabecalhos = Record<string, string | string[] | undefined>

export function origensPermitidas(env: string | undefined = process.env.ALLOWED_ORIGIN): string[] {
  const lista = (env ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return lista.length > 0 ? lista : [...ORIGENS_PADRAO]
}

/**
 * Aplica os cabeçalhos CORS e diz se a requisição pode seguir (false = responder 403).
 * `env` existe para teste; em produção vale process.env.ALLOWED_ORIGIN.
 */
export function aplicarCors(
  req: { headers?: Cabecalhos },
  res: { setHeader(nome: string, valor: string): unknown },
  env?: string,
): boolean {
  const permitidas = origensPermitidas(env ?? process.env.ALLOWED_ORIGIN)
  const bruto = req.headers?.origin
  const origem = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim().replace(/\/+$/, '')

  res.setHeader('Vary', 'Origin')
  if (permitidas.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else if (origem && permitidas.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem)
  } else if (origem) {
    return false
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  return true
}
