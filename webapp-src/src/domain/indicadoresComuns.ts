// Contas e réguas usadas pelas DUAS análises de ações (Análise fundamentalista e Análise dos balanços), para a mesma empresa nunca receber
// leituras contraditórias por diferença de fórmula. Módulo PURO. Valores em R$ mil, como os arquivos da CVM; ausente é null, nunca zero.

export const ok = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v)
export const dividir = (a: number | null, b: number | null) => (ok(a) && ok(b) && b !== 0 ? a / b : null)

/** O que cabe aos acionistas controladores; se a CVM não traz (ou traz zero por falta de preenchimento), vale o lucro líquido. */
export function lucroDosAcionistas(p: { lucroControladores: number | null; lucroLiquido: number | null }): number | null {
  return ok(p.lucroControladores) && p.lucroControladores !== 0 ? p.lucroControladores : p.lucroLiquido
}

/** Dívida bruta (curto + longo prazo) menos caixa e aplicações. Sem dívida informada, null. */
export function dividaLiquida(p: { divida: number | null; caixa: number | null }): number | null {
  return ok(p.divida) ? p.divida - (p.caixa ?? 0) : null
}

/** Dívida líquida ÷ EBITDA; só com EBITDA positivo (com EBITDA zero ou negativo o múltiplo não mede nada). */
export function dividaLiquidaSobreEbitda(dl: number | null, ebitda: number | null): number | null {
  return ok(dl) && ok(ebitda) && ebitda > 0 ? dl / ebitda : null
}

/** ROE = lucro dos controladores ÷ patrimônio líquido médio dos controladores (início e fim); sem o início, vale o patrimônio do fim. */
export function roe(lucro: number | null, plFim: number | null, plInicio: number | null): number | null {
  const plMedio = ok(plFim) && ok(plInicio) ? (plFim + plInicio) / 2 : plFim
  return ok(lucro) && ok(plMedio) && plMedio > 0 ? lucro / plMedio : null
}

/** Setores com dívida estruturalmente mais alta (receita regulada ou contratada de longo prazo): a régua de endividamento sobe. */
export const SETORES_ALAVANCAGEM_ALTA = /energia|el[eé]trica|saneamento|telecom|rodovia|concess|transporte|log[ií]stica|ferrovia|aeroporto|g[aá]s|utilidade|infraestrutura|geradora|transmiss/i
export const setorAlavancado = (setor: string | null | undefined) => SETORES_ALAVANCAGEM_ALTA.test(setor ?? '')

/** Limite de atenção da dívida líquida ÷ EBITDA: 3,5× em geral, 5× nos setores alavancados. */
export const tetoDividaEbitda = (setor: string | null | undefined) => (setorAlavancado(setor) ? 5 : 3.5)

/** Leitura do ROE (mesmas faixas da Análise fundamentalista). */
export const faixaDoRoe = (r: number): 'alto' | 'moderado' | 'baixo' => (r >= 0.15 ? 'alto' : r >= 0.08 ? 'moderado' : 'baixo')
