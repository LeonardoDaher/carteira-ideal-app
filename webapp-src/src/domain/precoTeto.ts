// Preço teto de compra (D125, revisto na D129). Módulo PURO. O preço teto é o máximo que a pessoa aceita pagar por uma ação para ter o retorno
// mínimo que quer. Aqui há dois métodos: Bazin (gatilho) e Graham (confirmação). O modelo de Gordon ficou de fora porque explode quando
// r − g é pequeno e g é chute. O verde depende SÓ de Bazin e Graham. A análise fundamentalista aparece ao lado como um SELO (concorda,
// neutro ou alerta), sem vetar: são perguntas diferentes (preço barato para o dividendo e para o balanço × empresa boa e valor justo
// confiável) e a pessoa vê as duas leituras. Não é recomendação (D19).

import { ROTULO_RECOMENDACAO } from './analiseFundamentalista'
import type { AnaliseFundamentalista, EmpresaFundamentos, Recomendacao } from './analiseFundamentalista'

/** Retorno mínimo em dividendos que Décio Bazin exigia (6% ao ano). */
export const TAXA_BAZIN_PADRAO = 0.06
/** Constante de Graham: P/L máximo 15 × P/VP máximo 1,5. */
export const CONSTANTE_GRAHAM = 22.5
/** Até esta distância acima do teto a ação aparece como "perto" do teto. */
export const FAIXA_PERTO = 0.05
/** Teto acima de tantas vezes o preço é sinal de dividendo médio atípico: vira ressalva. */
export const TETO_ATIPICO = 5

export interface TetoDoMetodo {
  aplicavel: boolean
  /** Preço teto em R$ por ação; null quando o método não se aplica. */
  teto: number | null
  /** Por que não se aplica, ou ressalva do dado usado. */
  observacao: string | null
  /** Conta feita, para a pessoa conferir. */
  conta: string | null
}

export interface TetoBazin extends TetoDoMetodo {
  /** Média por ação dos exercícios da DFC (informação); o dividendo usado na conta é `dividendoUsado`. */
  dividendoMedio: number | null
  /** Dividendo por ação efetivamente usado: o menor entre a média e os 12 meses da B3. */
  dividendoUsado: number | null
  /** A conta usou os 12 meses da B3 porque eram menores que a média. */
  usouRecente: boolean
  taxa: number
  /** Exercícios usados na média (0 quando veio dos proventos de 12 meses da B3). */
  exercicios: number
  curto: boolean
  /** Dividendo por ação de cada exercício usado na média (DFC ÷ ações atuais), do mais antigo para o mais recente. */
  porExercicio: { ano: string; valor: number }[]
  /** Dividend yield de 12 meses da B3 (0,09 = 9%); null quando a B3 não publicou. */
  dy12m: number | null
  /** Proventos dos últimos 12 meses (B3) abaixo de 70% da média: o teto pode estar inflado por anos melhores. */
  recenteMenor: boolean
  /** Teto de Bazin com o dividendo dos últimos 12 meses (B3) no lugar da média; só informação, nunca gatilho. */
  tetoRecente: number | null
}

export type StatusTeto = 'abaixo-do-teto' | 'vetado' | 'perto' | 'aguardando' | 'sem-teto'

export interface PrecoTeto {
  ticker: string
  nome: string
  preco: number
  bazin: TetoBazin
  graham: TetoDoMetodo
  /** Método que dispara o aviso: Bazin; sem dividendos, Graham. */
  gatilho: 'bazin' | 'graham' | null
  tetoGatilho: number | null
  /** Graham também mostra o preço abaixo do teto dele. */
  grahamConfirma: boolean
  valorJustoBase: number | null
  /** Motivos pelos quais o aviso não liga mesmo com o preço abaixo do teto de Bazin (hoje: Graham não confirma). Vazio quando não há. */
  objecoes: string[]
  /** Leitura final da análise fundamentalista (a mesma da aba ao lado). */
  recomendacaoFund: Recomendacao
  /** Selo da análise fundamentalista: aparece ao lado do teto, mas não bloqueia o verde. */
  selo: { tipo: 'concorda' | 'neutro' | 'alerta'; texto: string }
  /** Ponto fraco do dado do teto que NÃO bloqueia o verde, mas aparece no cartão e na notificação. */
  ressalva: string | null
  status: StatusTeto
  /** Preço ÷ teto do gatilho − 1: negativo é folga abaixo do teto. */
  distanciaPct: number | null
  /** Quanto o preço precisa cair para ficar abaixo dos tetos (o menor entre Bazin e Graham); `limitadoPor` diz qual deles está mais baixo. Null quando já está abaixo. */
  entrada: { alvo: number; faltaCairPct: number; limitadoPor: 'teto' | 'graham' } | null
  mensagem: string
}

const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Bazin: dividendo por ação ÷ taxa mínima. O dividendo é o MENOR entre a média dos últimos 5 exercícios da DFC e os proventos dos últimos 12
 * meses da B3 (D128): o teto nunca pode supor mais do que a empresa pagou de fato no último ano. Só a média inflava o teto de empresas cujo
 * dividendo caiu (um ano extraordinário puxava a conta: PETR4, VALE3, GOAU4). Com menos de 3 exercícios, usa só os 12 meses da B3.
 */
export function tetoBazin(empresa: EmpresaFundamentos, acoes: number | null, preco: number, dyB3: number | null, taxa: number): TetoBazin {
  const dy12m = ok(dyB3) && dyB3 >= 0 ? dyB3 : null
  const base = { taxa, dividendoMedio: null, dividendoUsado: null, usouRecente: false, exercicios: 0, curto: false, porExercicio: [], dy12m, recenteMenor: false, tetoRecente: null }
  if (!(taxa > 0)) return { ...base, aplicavel: false, teto: null, observacao: 'Taxa mínima inválida.', conta: null }
  const usados = empresa.anual.slice(-5).filter((p) => ok(p.dividendosPagos))
  const pagos = usados.map((p) => p.dividendosPagos as number)
  const porAcao = (v: number) => (ok(acoes) && acoes > 0 ? (Math.abs(v) * 1000) / acoes : 0)
  let dividendo: number | null = null
  let exercicios = 0
  let curto = false
  let origem = ''
  if (ok(acoes) && acoes > 0 && pagos.length >= 3) {
    // dividendosPagos está em R$ mil, na mesma base das classes de ações (quantidade em unidades).
    dividendo = (pagos.reduce((s, v) => s + Math.abs(v), 0) / pagos.length * 1000) / acoes
    exercicios = pagos.length
    origem = `média de ${pagos.length} exercícios (DFC) ÷ ações atuais`
  } else if (ok(dyB3) && dyB3 > 0) {
    dividendo = dyB3 * preco
    curto = true
    origem = 'proventos dos últimos 12 meses (B3)'
  } else if (ok(acoes) && acoes > 0 && pagos.length >= 1) {
    dividendo = (pagos.reduce((s, v) => s + Math.abs(v), 0) / pagos.length * 1000) / acoes
    exercicios = pagos.length
    curto = true
    origem = `média de ${pagos.length} exercício${pagos.length > 1 ? 's' : ''} (DFC) ÷ ações atuais`
  }
  if (!ok(dividendo) || dividendo <= 0) return { ...base, aplicavel: false, teto: null, observacao: 'Sem pagamento de dividendos identificado: Bazin não se aplica.', conta: null }
  const media = dividendo
  const recente = ok(dy12m) ? dy12m * preco : null
  const usouRecente = !curto && recente !== null && recente < media
  if (usouRecente) {
    dividendo = recente as number
    origem = `proventos dos últimos 12 meses (B3), menores que a média de ${exercicios} exercícios (${reais(media)})`
  }
  if (dividendo <= 0) return { ...base, dividendoMedio: media, aplicavel: false, teto: null, observacao: 'A B3 não registra proventos nos últimos 12 meses: Bazin não se aplica.', conta: null }
  const teto = dividendo / taxa
  return {
    aplicavel: true,
    teto,
    dividendoMedio: media,
    dividendoUsado: dividendo,
    usouRecente,
    taxa,
    exercicios,
    curto,
    porExercicio: ok(acoes) && acoes > 0 ? usados.map((p) => ({ ano: String(p.exercicio ?? '').slice(0, 4), valor: porAcao(p.dividendosPagos as number) })) : [],
    dy12m,
    // Só compara com a média da DFC; no histórico curto o dividendo já é o de 12 meses.
    recenteMenor: !curto && ok(dy12m) && dy12m * preco < media * 0.7,
    tetoRecente: ok(dy12m) && dy12m > 0 ? (dy12m * preco) / taxa : null,
    observacao: curto ? 'Histórico curto: menos de 3 exercícios de dividendos, a média é menos confiável.' : 'A DFC mistura dividendos ordinários e extraordinários; um ano atípico puxa a média.',
    conta: `${reais(dividendo)} (${origem}) ÷ ${(taxa * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% = ${reais(teto)}`,
  }
}

/** Graham: raiz de (22,5 × LPA × VPA), com lucro dos controladores de 12 meses e patrimônio dos controladores. */
export function tetoGraham(empresa: EmpresaFundamentos, acoes: number | null): TetoDoMetodo {
  const p = empresa.ttm ?? empresa.anual[empresa.anual.length - 1]
  if (!p || !ok(acoes) || acoes <= 0) return { aplicavel: false, teto: null, observacao: 'Sem quantidade de ações confiável: Graham não se aplica.', conta: null }
  const lucro = p.lucroControladores ?? p.lucroLiquido
  const pl = p.plControladores ?? p.patrimonioLiquido
  if (!ok(lucro) || !ok(pl)) return { aplicavel: false, teto: null, observacao: 'Sem lucro ou patrimônio líquido publicados: Graham não se aplica.', conta: null }
  if (lucro <= 0 || pl <= 0) return { aplicavel: false, teto: null, observacao: 'Lucro ou patrimônio líquido negativo: Graham não se aplica.', conta: null }
  const lpa = (lucro * 1000) / acoes
  const vpa = (pl * 1000) / acoes
  const teto = Math.sqrt(CONSTANTE_GRAHAM * lpa * vpa)
  return {
    aplicavel: true,
    teto,
    observacao: 'Ignora ativos intangíveis; não serve bem para empresas de forte crescimento.',
    conta: `√(22,5 × LPA ${reais(lpa)} × VPA ${reais(vpa)}) = ${reais(teto)}`,
  }
}

export function calcularPrecoTeto({
  empresa, analise, preco, dyB3 = null, taxaBazin = TAXA_BAZIN_PADRAO,
}: {
  empresa: EmpresaFundamentos
  analise: AnaliseFundamentalista
  preco: number
  dyB3?: number | null
  taxaBazin?: number
}): PrecoTeto {
  // Papéis equivalentes: numa unit, dividendo, lucro e patrimônio por papel são os de várias ações (D142).
  const acoes = analise.mercado.acoes === null ? null : analise.mercado.acoes / (analise.mercado.porPapel ?? 1)
  const bazin = tetoBazin(empresa, acoes, preco, dyB3, taxaBazin)
  const graham = tetoGraham(empresa, acoes)
  const gatilho: PrecoTeto['gatilho'] = bazin.aplicavel ? 'bazin' : graham.aplicavel ? 'graham' : null
  const tetoGatilho = gatilho === 'bazin' ? bazin.teto : gatilho === 'graham' ? graham.teto : null
  const grahamConfirma = gatilho === 'bazin' && graham.aplicavel && ok(graham.teto) && preco <= graham.teto

  const vj = analise.valorJusto
  const base = vj.cenarios.find((c) => c.cenario === 'base')?.valorJusto ?? null

  // Selo da análise fundamentalista (a mesma leitura da aba ao lado). Informa, não veta.
  const rec = analise.recomendacao.categoria
  const criticos = analise.alertas.filter((a) => a.gravidade === 'critico')
  const justificativa = analise.recomendacao.justificativa[0]
  const selo: PrecoTeto['selo'] =
    rec === 'evitar-novos' || rec === 'reduzir-exposicao' || criticos.length > 0
      ? { tipo: 'alerta', texto: `A análise fundamentalista diz "${ROTULO_RECOMENDACAO[rec]}"${criticos.length ? ` e há alerta crítico (${criticos.map((a) => a.titulo).join(', ')})` : ''}${justificativa ? `: ${justificativa}` : '.'}` }
      : rec === 'considerar-entrada'
        ? { tipo: 'concorda', texto: 'A análise fundamentalista concorda: considerar entrada.' }
        : { tipo: 'neutro', texto: `A análise fundamentalista diz "${ROTULO_RECOMENDACAO[rec]}"${justificativa ? `: ${justificativa}` : '.'}` }

  // Graham confirma: com Bazin como gatilho, se Graham se aplica e o preço está acima do teto dele, o aviso não liga (as duas contas precisam concordar).
  const objecoes: string[] = []
  if (gatilho === 'bazin' && graham.aplicavel && ok(graham.teto) && preco > graham.teto) {
    objecoes.push(`O teto de Graham (${reais(graham.teto)}) está abaixo do preço (${reais(preco)}): Graham não confirma o teto de Bazin.`)
  }

  // Ressalvas informam o dado usado; não vetam.
  const avisos: string[] = []
  if (gatilho === 'bazin' && bazin.recenteMenor) avisos.push('dividendos dos últimos 12 meses abaixo de 70% da média (o teto já usa o valor mais baixo)')
  if (ok(tetoGatilho) && tetoGatilho > preco * TETO_ATIPICO) avisos.push(`teto mais de ${TETO_ATIPICO}× o preço: dividendo médio provavelmente atípico (pagamento extraordinário ou dado fora do padrão)`)
  const ressalva = avisos.length ? avisos.join('; ') : null
  const distanciaPct = ok(tetoGatilho) && tetoGatilho > 0 ? (preco / tetoGatilho - 1) * 100 : null
  const nomeGatilho = gatilho === 'graham' ? 'Graham' : 'Bazin'
  let status: StatusTeto
  let mensagem: string
  if (gatilho === null || !ok(tetoGatilho)) {
    status = 'sem-teto'
    mensagem = 'Nenhum dos dois métodos se aplica a esta ação (sem dividendos e sem lucro e patrimônio positivos).'
  } else if (preco <= tetoGatilho) {
    if (objecoes.length) {
      status = 'vetado'
      mensagem = `${nomeGatilho}: preço abaixo do teto de ${reais(tetoGatilho)}, mas Graham não confirma. Sem aviso de compra.`
    } else {
      status = 'abaixo-do-teto'
      mensagem = `Preço abaixo do teto de ${nomeGatilho} (${reais(tetoGatilho)})${grahamConfirma ? '; Graham também confirma' : ''}.`
    }
  } else if (preco <= tetoGatilho * (1 + FAIXA_PERTO)) {
    status = 'perto'
    mensagem = `Preço a ${(distanciaPct as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% acima do teto de ${nomeGatilho} (${reais(tetoGatilho)}).`
  } else {
    status = 'aguardando'
    mensagem = `Preço ${(distanciaPct as number).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% acima do teto de ${nomeGatilho} (${reais(tetoGatilho)}).`
  }

  // Distância até ficar abaixo dos tetos: o menor entre Bazin (gatilho) e Graham (confirmação).
  let entrada: PrecoTeto['entrada'] = null
  if (ok(tetoGatilho) && tetoGatilho > 0 && status !== 'abaixo-do-teto') {
    const travas: { alvo: number; por: 'teto' | 'graham' }[] = [{ alvo: tetoGatilho, por: 'teto' }]
    if (gatilho === 'bazin' && graham.aplicavel && ok(graham.teto) && graham.teto > 0) travas.push({ alvo: graham.teto, por: 'graham' })
    const menor = travas.reduce((a, b) => (b.alvo < a.alvo ? b : a))
    if (preco > menor.alvo) entrada = { alvo: menor.alvo, faltaCairPct: (1 - menor.alvo / preco) * 100, limitadoPor: menor.por }
  }

  return { ticker: analise.ticker, nome: analise.nome, preco, bazin, graham, gatilho, tetoGatilho, grahamConfirma, valorJustoBase: ok(base) ? base : null, objecoes, ressalva, recomendacaoFund: rec, selo, status, distanciaPct, entrada, mensagem }
}

/**
 * Quais ações avisar agora: as que estão abaixo do teto e ainda não foram avisadas. `avisados` é o que já foi avisado enquanto
 * continuava abaixo do teto; quem sai da zona some dessa lista, então volta a avisar se entrar de novo.
 */
export function tickersParaAvisar(itens: PrecoTeto[], avisados: string[]): { avisar: string[]; avisados: string[] } {
  const naZona = itens.filter((i) => i.status === 'abaixo-do-teto').map((i) => i.ticker)
  const ja = new Set(avisados)
  return { avisar: naZona.filter((t) => !ja.has(t)), avisados: naZona }
}
