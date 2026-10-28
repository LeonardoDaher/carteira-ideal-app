// Preço teto de TODAS as ações do cadastro de uma vez, e a regra do aviso (D127). É o mesmo cálculo da aba "Preço teto de compra" e do
// job que manda o aviso com o app fechado: os dois chamam estas funções, então o aviso no celular nunca diz algo que a tela não diz.
// Puro: nada de leitura de arquivo aqui (a tela lê pelo app, o job lê do disco).
import { analisarFundamentos, premissasDaSelic } from './analiseFundamentalista'
import type { Premissas, SnapshotFundamentos } from './analiseFundamentalista'
import { calcularPrecoTeto, tickersParaAvisar } from './precoTeto'
import type { PrecoTeto } from './precoTeto'

/** Preço de fechamento por código: a busca primeiro, depois os setores (que prevalecem), como em SimuleAcoes. */
export function mapaDePrecos(snapshot: { busca: { ticker: string; cotacao: number }[]; setores: { empresas: { ticker: string; cotacao: number }[] }[] }): (ticker: string) => number | null {
  const m = new Map<string, number>()
  for (const b of snapshot.busca) m.set(b.ticker, b.cotacao)
  for (const st of snapshot.setores) for (const e of st.empresas) m.set(e.ticker, e.cotacao)
  return (t) => m.get(t) ?? null
}

/** Selic meta e IPCA de longo prazo (Focus) dos dados oficiais, para ancorar a taxa de desconto. Uma só conta para a tela e para o job. */
export function premissasDoSnapshotMercado(m: { indicadores: { selicMeta?: { valor: number | null } | null }; focus?: { ipca?: Record<string, number | null> } | null }): Partial<Premissas> {
  const selic = m.indicadores.selicMeta?.valor ?? null
  const ipca = m.focus?.ipca ?? {}
  const anos = Object.keys(ipca).sort()
  const longo = anos.length ? (ipca[anos[anos.length - 1]] ?? null) : null
  return premissasDaSelic(selic, longo)
}

export function calcularItensPrecoTeto({
  fundamentos, precoDe, premissas, dyDe, taxa,
}: {
  fundamentos: SnapshotFundamentos
  precoDe: (ticker: string) => number | null
  premissas: Partial<Premissas>
  dyDe: (ticker: string) => number | null
  taxa: number
}): Map<string, PrecoTeto> {
  const todas = Object.values(fundamentos.empresas)
  const mapa = new Map<string, PrecoTeto>()
  for (const empresa of todas) {
    const preco = precoDe(empresa.ticker)
    if (preco === null) continue
    const dyB3 = dyDe(empresa.ticker)
    const analise = analisarFundamentos({ empresa, precoDe, todas, premissas, dyB3 })
    if (!analise) continue
    mapa.set(empresa.ticker, calcularPrecoTeto({ empresa, analise, preco, dyB3, taxaBazin: taxa }))
  }
  return mapa
}

/** Texto do aviso de uma ação (notificação do navegador e push). */
export function textoDoAviso(item: PrecoTeto): { titulo: string; corpo: string } {
  return {
    titulo: `${item.ticker} abaixo do preço teto`,
    corpo: `${item.mensagem}${item.selo.tipo === 'alerta' ? ` ${item.selo.texto}` : ''}${item.ressalva ? ` Atenção: ${item.ressalva}.` : ''}`,
  }
}

/** O que um aparelho inscrito guarda no servidor: só os códigos acompanhados, a taxa e quem já foi avisado. */
export interface InscricaoPreco {
  tickers: string[]
  taxa: number
  avisados: string[]
}

export interface AvisoDoAparelho {
  titulo: string
  corpo: string
  tickers: string[]
}

/**
 * Decide o aviso de um aparelho: só quem acabou de entrar abaixo do teto (verde) e ainda não foi avisado. Vários de uma vez viram uma
 * única notificação. `avisadosSeEnviado` é a lista nova se o envio der certo; `avisadosSeFalhar` mantém quem deve ser avisado de novo.
 */
export function avisoDoAparelho(itens: Map<string, PrecoTeto>, ins: InscricaoPreco): { aviso: AvisoDoAparelho | null; avisadosSeEnviado: string[]; avisadosSeFalhar: string[] } {
  const atuais = ins.tickers.map((t) => itens.get(t)).filter((i): i is PrecoTeto => i !== undefined)
  const r = tickersParaAvisar(atuais, ins.avisados)
  const novos = atuais.filter((i) => r.avisar.includes(i.ticker))
  if (novos.length === 0) return { aviso: null, avisadosSeEnviado: r.avisados, avisadosSeFalhar: r.avisados }
  const aviso: AvisoDoAparelho =
    novos.length === 1
      ? { ...textoDoAviso(novos[0]), tickers: [novos[0].ticker] }
      : { titulo: `${novos.length} ações abaixo do preço teto`, corpo: `${novos.map((i) => i.ticker).join(', ')} entraram abaixo do teto. Abra o app para ver os detalhes.`, tickers: novos.map((i) => i.ticker) }
  return { aviso, avisadosSeEnviado: r.avisados, avisadosSeFalhar: r.avisados.filter((t) => !r.avisar.includes(t)) }
}
