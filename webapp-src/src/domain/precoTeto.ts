// Preço teto de compra (D125). Módulo PURO. O preço teto é o máximo que a pessoa aceita pagar por uma ação para ter o retorno mínimo
// que quer. Aqui há dois métodos: Bazin (gatilho) e Graham (confirmação). O modelo de Gordon ficou de fora porque explode quando
// r − g é pequeno e g é chute. O teto NÃO é um segundo juiz: parte da mesma análise fundamentalista da aba ao lado (valor justo,
// categoria e alertas), e o aviso de compra só liga quando as duas leituras não se contradizem. Não é recomendação (D19).

import type { AnaliseFundamentalista, EmpresaFundamentos } from './analiseFundamentalista'

/** Retorno mínimo em dividendos que Décio Bazin exigia (6% ao ano). */
export const TAXA_BAZIN_PADRAO = 0.06
/** Constante de Graham: P/L máximo 15 × P/VP máximo 1,5. */
export const CONSTANTE_GRAHAM = 22.5
/** Até esta distância acima do teto a ação aparece como "perto" do teto. */
export const FAIXA_PERTO = 0.05

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
  dividendoMedio: number | null
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
  /** Motivos pelos quais a análise fundamentalista não deixa o aviso ligar. Vazio quando não há objeção. */
  objecoes: string[]
  status: StatusTeto
  /** Preço ÷ teto do gatilho − 1: negativo é folga abaixo do teto. */
  distanciaPct: number | null
  mensagem: string
}

const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Bazin: dividendo médio por ação ÷ taxa mínima. Média dos últimos 5 exercícios da DFC; com menos de 3, cai para os proventos de 12 meses da B3. */
export function tetoBazin(empresa: EmpresaFundamentos, acoes: number | null, preco: number, dyB3: number | null, taxa: number): TetoBazin {
  const dy12m = ok(dyB3) && dyB3 >= 0 ? dyB3 : null
  const base = { taxa, dividendoMedio: null, exercicios: 0, curto: false, porExercicio: [], dy12m, recenteMenor: false }
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
  const teto = dividendo / taxa
  return {
    aplicavel: true,
    teto,
    dividendoMedio: dividendo,
    taxa,
    exercicios,
    curto,
    porExercicio: ok(acoes) && acoes > 0 ? usados.map((p) => ({ ano: String(p.exercicio ?? '').slice(0, 4), valor: porAcao(p.dividendosPagos as number) })) : [],
    dy12m,
    // Só compara com a média da DFC; no histórico curto o dividendo já é o de 12 meses.
    recenteMenor: !curto && ok(dy12m) && dy12m * preco < dividendo * 0.7,
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
  const acoes = analise.mercado.acoes
  const bazin = tetoBazin(empresa, acoes, preco, dyB3, taxaBazin)
  const graham = tetoGraham(empresa, acoes)
  const gatilho: PrecoTeto['gatilho'] = bazin.aplicavel ? 'bazin' : graham.aplicavel ? 'graham' : null
  const tetoGatilho = gatilho === 'bazin' ? bazin.teto : gatilho === 'graham' ? graham.teto : null
  const grahamConfirma = gatilho === 'bazin' && graham.aplicavel && ok(graham.teto) && preco <= graham.teto

  // Objeções vindas da MESMA análise fundamentalista da aba ao lado.
  const vj = analise.valorJusto
  const base = vj.cenarios.find((c) => c.cenario === 'base')?.valorJusto ?? null
  const objecoes: string[] = []
  if (!vj.aplicavel || !ok(base)) objecoes.push('A análise fundamentalista não calculou valor justo para esta ação, então não confirma o preço.')
  else if (preco > base) objecoes.push(`Na análise fundamentalista o preço (${reais(preco)}) está acima do valor justo base (${reais(base)}).`)
  if (analise.categoria === 'evitar') objecoes.push('A análise fundamentalista classifica a ação como "evitar ou reavaliar".')
  for (const a of analise.alertas) if (a.gravidade === 'critico') objecoes.push(`Alerta crítico na análise fundamentalista: ${a.titulo}.`)

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
      mensagem = `${nomeGatilho}: preço abaixo do teto de ${reais(tetoGatilho)}. Sem aviso de compra, porque a análise fundamentalista discorda.`
    } else {
      status = 'abaixo-do-teto'
      mensagem = `Preço abaixo do teto de ${nomeGatilho} (${reais(tetoGatilho)}) e sem objeção da análise fundamentalista${grahamConfirma ? '; Graham também confirma' : ''}.`
    }
  } else if (preco <= tetoGatilho * (1 + FAIXA_PERTO)) {
    status = 'perto'
    mensagem = `Preço a ${(distanciaPct as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% acima do teto de ${nomeGatilho} (${reais(tetoGatilho)}).`
  } else {
    status = 'aguardando'
    mensagem = `Preço ${(distanciaPct as number).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% acima do teto de ${nomeGatilho} (${reais(tetoGatilho)}).`
  }

  return { ticker: analise.ticker, nome: analise.nome, preco, bazin, graham, gatilho, tetoGatilho, grahamConfirma, valorJustoBase: ok(base) ? base : null, objecoes, status, distanciaPct, mensagem }
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
