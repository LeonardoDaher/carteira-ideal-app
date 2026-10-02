// Minha Carteira (D36): tudo que o painel mostra, calculado a partir dos lançamentos e, quando
// houver, da Posição da B3. Funções puras (sem React, sem rede): a tela só desenha o resultado.
//
// Regra de honestidade dos números:
//  - "Capital aplicado" é o CUSTO do que a pessoa tem, segundo o histórico importado. Não é
//    patrimônio de mercado: o app não tem a série de preços para marcar a carteira a mercado em
//    datas passadas. Por isso o gráfico de evolução se chama assim, e não "patrimônio".
//  - "Patrimônio" só existe quando há uma Posição da B3 (quantidade e valor atualizado).
//  - Com a Posição da B3, SÓ ENTRA O QUE ESTÁ NELA: ativo que a pessoa já zerou (vendido, convertido,
//    transferido) não aparece em lugar nenhum, nem nos totais nem no gráfico. A Posição é a verdade
//    sobre o que ela tem hoje; o histórico serve para dar o preço médio de quem está lá.
//  - Resultado (lucro/prejuízo) só é calculado para ativos cujo histórico CONFERE com a Posição;
//    a tela mostra qual parte da carteira essa conta cobre.
import { ativosComValorAplicado, conferirComPosicao, type StatusConferencia } from './conferencia'
import type { CategoriaPosicao, EventoFuturo, ItemPosicaoB3 } from './importacao/planilha'
import { derivarPosicoes, type Lancamento } from './lancamentos'

export const ROTULOS_CATEGORIA: Record<CategoriaPosicao, string> = {
  acoes: 'Ações',
  bdr: 'BDRs',
  etf: 'ETFs',
  fundos: 'FIIs e fundos',
  tesouro: 'Tesouro Direto',
  outra: 'Outros',
}

export type OrigemPrecoMedio = 'calculado' | 'b3' | 'informado'

export interface LinhaPosicao {
  ativo: string
  categoria: CategoriaPosicao | null
  quantidade: number
  /** null quando o histórico não permite saber (falta o saldo anterior ao período importado). */
  precoMedio: number | null
  /** De onde vem o preço médio: calculado pelos lançamentos, valor aplicado da B3 (Tesouro) ou informado pela pessoa. */
  origemPrecoMedio: OrigemPrecoMedio | null
  custoTotal: number | null
  valorAtual: number | null
  resultado: number | null
  resultadoPct: number | null
  status: StatusConferencia | 'semPosicao'
  /** Há negócios recentes que a custódia ainda não mostra (liquidação em D+2). */
  aguardandoLiquidacao: boolean
}

export interface ResultadoCarteira {
  valor: number
  pct: number
  /** Parte do patrimônio coberta por essa conta (ativos com custo conhecido), de 0 a 1. */
  cobertura: number
}

export interface ResumoPainel {
  /** Custo do que a pessoa tem, pelo histórico. */
  capitalAplicado: number
  /** Valor de mercado na data da Posição; null sem Posição. */
  patrimonio: number | null
  dataPosicao: string | null
  resultado: ResultadoCarteira | null
}

export interface Painel {
  linhas: LinhaPosicao[]
  resumo: ResumoPainel
  /** Ativos que a pessoa tem hoje (os da Posição, mais compras recentes ainda não liquidadas). */
  ativosAtuais: string[]
}

const EPS = 1e-9

/**
 * @param precosInformados preço médio que a PESSOA informou por ativo: vale mais que o calculado e que o da B3.
 */
export function montarPainel(
  lancamentos: Lancamento[],
  posicao: ItemPosicaoB3[] | null,
  dataPosicao: string | null,
  precosInformados: Readonly<Record<string, number>> = {},
): Painel {
  const derivadas = derivarPosicoes(lancamentos).posicoes.filter((p) => p.quantidade > EPS)
  const derivadaPorAtivo = new Map(derivadas.map((p) => [p.ativo, p]))

  if (!posicao || !posicao.length || !dataPosicao) {
    const linhas: LinhaPosicao[] = derivadas
      .map((p) => {
        const informado = precosInformados[p.ativo]
        const pm = informado > 0 ? informado : p.precoMedio
        return {
          ativo: p.ativo,
          categoria: null,
          quantidade: p.quantidade,
          precoMedio: pm,
          origemPrecoMedio: (informado > 0 ? 'informado' : 'calculado') as OrigemPrecoMedio,
          custoTotal: pm * p.quantidade,
          valorAtual: null,
          resultado: null,
          resultadoPct: null,
          status: 'semPosicao' as const,
          aguardandoLiquidacao: false,
        }
      })
      .sort((a, b) => (b.custoTotal ?? 0) - (a.custoTotal ?? 0))
    const capital = linhas.reduce((t, l) => t + (l.custoTotal ?? 0), 0)
    return { linhas, ativosAtuais: linhas.map((l) => l.ativo), resumo: { capitalAplicado: capital, patrimonio: null, dataPosicao: null, resultado: null } }
  }

  const conferencia = conferirComPosicao(lancamentos, posicao, dataPosicao, new Set(Object.keys(precosInformados)))
  const confPorAtivo = new Map(conferencia.itens.map((i) => [i.ativo, i]))

  // Posição agregada por ativo (a mesma ação pode estar em mais de uma instituição).
  const custoDaB3 = ativosComValorAplicado(posicao)
  const agregada = new Map<string, { quantidade: number; valor: number; aplicado: number; categoria: CategoriaPosicao }>()
  for (const p of posicao) {
    const a = agregada.get(p.ativo) ?? { quantidade: 0, valor: 0, aplicado: 0, categoria: p.categoria }
    a.quantidade += p.quantidade
    a.valor += p.valorAtualizado
    a.aplicado += p.valorAplicado ?? 0
    agregada.set(p.ativo, a)
  }

  const linhas: LinhaPosicao[] = []
  for (const [ativo, a] of agregada) {
    const c = confPorAtivo.get(ativo)
    const d = derivadaPorAtivo.get(ativo)
    const status: StatusConferencia = c?.status ?? 'faltaSaldoAnterior'
    const aguardando = !!c && Math.abs(c.naoLiquidado) > EPS

    // Preço médio, por ordem de confiança: o que a pessoa informou, o valor aplicado da B3 (Tesouro) e,
    // por último, o calculado pelos lançamentos (só quando o histórico confere com a Posição).
    const informado = precosInformados[ativo]
    let precoMedio: number | null = null
    let origem: OrigemPrecoMedio | null = null
    if (informado > 0) {
      precoMedio = informado
      origem = 'informado'
    } else if (custoDaB3.has(ativo) && a.quantidade > EPS) {
      precoMedio = a.aplicado / a.quantidade
      origem = 'b3'
    } else if (status === 'confere' && d) {
      precoMedio = d.precoMedio
      origem = 'calculado'
    }
    const custoTotal = precoMedio !== null ? precoMedio * a.quantidade : null
    // O calculado só dá resultado quando a custódia e o histórico coincidem (sem negócio a caminho);
    // o informado e o da B3 são o custo de hoje, então dão resultado sempre.
    const comResultado = precoMedio !== null && (origem !== 'calculado' || !aguardando)
    const resultado = comResultado ? a.valor - custoTotal! : null
    linhas.push({
      ativo,
      categoria: a.categoria,
      quantidade: a.quantidade,
      precoMedio,
      origemPrecoMedio: origem,
      custoTotal,
      valorAtual: a.valor,
      resultado,
      resultadoPct: resultado !== null && custoTotal! > EPS ? (resultado / custoTotal!) * 100 : null,
      status,
      aguardandoLiquidacao: aguardando,
    })
  }
  // Comprado há pouco e ainda fora da custódia (liquida em D+2): aparece, sem valor de mercado. Só entra
  // quem tem negócio recente a caminho; ativo zerado, ou com lançamentos antigos que a Posição não
  // confirma, NÃO aparece (a Posição manda no que a pessoa tem).
  for (const f of conferencia.foraDaPosicao) {
    if (f.naoLiquidado <= EPS) continue
    const d = derivadaPorAtivo.get(f.ativo)
    linhas.push({
      ativo: f.ativo,
      categoria: null,
      quantidade: f.naoLiquidado,
      precoMedio: d ? d.precoMedio : null,
      origemPrecoMedio: d ? 'calculado' : null,
      custoTotal: d ? d.precoMedio * f.naoLiquidado : null,
      valorAtual: null,
      resultado: null,
      resultadoPct: null,
      status: 'semPosicao',
      aguardandoLiquidacao: true,
    })
  }
  linhas.sort((a, b) => (b.valorAtual ?? b.custoTotal ?? 0) - (a.valorAtual ?? a.custoTotal ?? 0))

  const patrimonio = linhas.reduce((s, l) => s + (l.valorAtual ?? 0), 0)
  const comRes = linhas.filter((l) => l.resultado !== null)
  const custoBase = comRes.reduce((s, l) => s + (l.custoTotal ?? 0), 0)
  const resultadoTotal = comRes.reduce((s, l) => s + (l.resultado ?? 0), 0)
  const valorCoberto = comRes.reduce((s, l) => s + (l.valorAtual ?? 0), 0)
  const resultado: ResultadoCarteira | null =
    comRes.length && custoBase > EPS ? { valor: resultadoTotal, pct: (resultadoTotal / custoBase) * 100, cobertura: patrimonio > EPS ? valorCoberto / patrimonio : 0 } : null

  // Com Posição, o capital aplicado é o custo dos ativos que a pessoa TEM e cujo preço médio é conhecido.
  const capitalDosAtuais = linhas.reduce((s, l) => s + (l.custoTotal ?? 0), 0)
  return { linhas, ativosAtuais: linhas.map((l) => l.ativo), resumo: { capitalAplicado: capitalDosAtuais, patrimonio, dataPosicao, resultado } }
}

export interface GrupoPosicoes {
  /** Categoria da B3, ou 'recentes' para compras ainda não liquidadas. */
  chave: CategoriaPosicao | 'recentes'
  rotulo: string
  ativos: number
  valor: number
  /** Fatia do patrimônio, de 0 a 100. */
  pct: number
  linhas: LinhaPosicao[]
}

/**
 * Agrupa as posições como a Área do Investidor da B3 ("Produtos da sua carteira"): Ações, Tesouro Direto,
 * FIIs, BDRs, ETFs. Cada grupo traz quantos ativos tem, quanto vale e que fatia da carteira é; os
 * grupos e os ativos de dentro saem do maior para o menor valor.
 */
export function agruparPosicoes(linhas: LinhaPosicao[]): GrupoPosicoes[] {
  const total = linhas.reduce((s, l) => s + (l.valorAtual ?? 0), 0)
  const porChave = new Map<GrupoPosicoes['chave'], LinhaPosicao[]>()
  for (const l of linhas) {
    const chave: GrupoPosicoes['chave'] = l.categoria ?? 'recentes'
    porChave.set(chave, [...(porChave.get(chave) ?? []), l])
  }
  const valorDe = (l: LinhaPosicao) => l.valorAtual ?? l.custoTotal ?? 0
  return [...porChave.entries()]
    .map(([chave, ls]) => {
      const valor = ls.reduce((s, l) => s + (l.valorAtual ?? 0), 0)
      return {
        chave,
        rotulo: chave === 'recentes' ? 'Compras recentes (aguardando liquidação)' : ROTULOS_CATEGORIA[chave],
        ativos: ls.length,
        valor,
        pct: total > EPS ? (valor / total) * 100 : 0,
        linhas: [...ls].sort((a, b) => valorDe(b) - valorDe(a)),
      }
    })
    .sort((a, b) => (a.chave === 'recentes' ? 1 : b.chave === 'recentes' ? -1 : b.valor - a.valor))
}

export interface FatiaComposicao {
  categoria: CategoriaPosicao
  rotulo: string
  valor: number
  /** 0 a 100 */
  pct: number
}

/** Composição do patrimônio pelas categorias da própria B3 (Ações, FIIs e fundos, BDRs, ETFs, Tesouro). */
export function composicaoPorCategoria(posicao: ItemPosicaoB3[] | null): FatiaComposicao[] {
  if (!posicao?.length) return []
  const porCat = new Map<CategoriaPosicao, number>()
  for (const p of posicao) porCat.set(p.categoria, (porCat.get(p.categoria) ?? 0) + p.valorAtualizado)
  const total = [...porCat.values()].reduce((s, v) => s + v, 0)
  if (total <= EPS) return []
  return [...porCat.entries()]
    .map(([categoria, valor]) => ({ categoria, rotulo: ROTULOS_CATEGORIA[categoria], valor, pct: (valor / total) * 100 }))
    .sort((a, b) => b.valor - a.valor)
}

// ---------- séries mensais ----------
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface PontoMensal {
  /** AAAA-MM */
  mes: string
  /** "Jan", "Fev"... */
  rotulo: string
  valor: number
}

/** Os `n` meses que terminam em `ateMes` (AAAA-MM), do mais antigo ao mais novo. */
export function mesesAte(ateMes: string, n: number): string[] {
  const [a, m] = ateMes.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const idx = a * 12 + (m - 1) - i
    out.push(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`)
  }
  return out
}

const rotuloDoMes = (mes: string) => MESES_CURTOS[Number(mes.slice(5, 7)) - 1]

/**
 * Capital aplicado ao fim de cada mês: o custo do que a pessoa tinha naquele dia, refazendo o
 * histórico até lá. Não é valor de mercado (ver o topo do arquivo).
 */
export function capitalAplicadoPorMes(lancamentos: Lancamento[], ateMes: string, meses = 12, ativos: ReadonlySet<string> | null = null): PontoMensal[] {
  const base = ativos ? lancamentos.filter((l) => ativos.has(l.ativo)) : lancamentos
  return mesesAte(ateMes, meses).map((mes) => {
    const ate = base.filter((l) => l.data <= `${mes}-31`)
    const valor = ate.length ? derivarPosicoes(ate).posicoes.reduce((s, p) => s + p.custoTotal, 0) : 0
    return { mes, rotulo: rotuloDoMes(mes), valor }
  })
}

/** Proventos recebidos em cada mês (pela data do pagamento). */
export function proventosPorMes(lancamentos: Lancamento[], ateMes: string, meses = 12): PontoMensal[] {
  const lista = mesesAte(ateMes, meses)
  const soma = new Map(lista.map((m) => [m, 0]))
  for (const l of lancamentos) {
    if (l.tipo !== 'provento') continue
    const m = l.data.slice(0, 7)
    if (soma.has(m)) soma.set(m, (soma.get(m) ?? 0) + l.valor)
  }
  return lista.map((mes) => ({ mes, rotulo: rotuloDoMes(mes), valor: Math.round((soma.get(mes) ?? 0) * 100) / 100 }))
}

/** Variação percentual; null quando não há base de comparação. */
export function variacaoPct(atual: number, anterior: number): number | null {
  return anterior > EPS ? ((atual - anterior) / anterior) * 100 : null
}

export interface ProximosProventos {
  /** Data do próximo pagamento (AAAA-MM-DD). */
  proximaData: string
  totalNaData: number
  ativosNaData: number
  /** Soma de tudo que está anunciado e ainda não foi pago. */
  totalAReceber: number
  ativosAReceber: number
}

export function proximosProventos(eventos: EventoFuturo[] | null, hoje: string): ProximosProventos | null {
  const futuros = (eventos ?? []).filter((e) => e.previsao >= hoje)
  if (!futuros.length) return null
  const proxima = futuros.map((e) => e.previsao).sort()[0]
  const naData = futuros.filter((e) => e.previsao === proxima)
  return {
    proximaData: proxima,
    totalNaData: Math.round(naData.reduce((s, e) => s + e.valorLiquido, 0) * 100) / 100,
    ativosNaData: new Set(naData.map((e) => e.ativo)).size,
    totalAReceber: Math.round(futuros.reduce((s, e) => s + e.valorLiquido, 0) * 100) / 100,
    ativosAReceber: new Set(futuros.map((e) => e.ativo)).size,
  }
}
