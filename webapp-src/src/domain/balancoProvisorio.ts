// Balanço novo antes da CVM (D137): a CVM publica o arquivo aberto alguns dias depois da divulgação, mas a B3 mostra o resumo no mesmo
// dia (receita, lucro, ativo e patrimônio líquido do trimestre, já no arquivo de balanços como trimestre "provisório"). Esta função
// põe esse trimestre nos 12 meses da Análise fundamentalista de empresas NÃO financeiras e marca a análise com o selo de provisório.
// Instituições financeiras e casos sem como montar o trimestre com segurança só ganham o aviso "balanço novo, aguardando a CVM".
// Funções puras, sem rede.

import type { EmpresaBalanco, Trimestre } from './balancos'
import type { BalancoNovo, EmpresaFundamentos } from './analiseFundamentalista'

/** Último dia do trimestre seguinte: '2026-06-30' vira '2026-09-30'. */
export function trimestreSeguinte(periodo: string): string {
  const ano = Number(periodo.slice(0, 4))
  const mes = periodo.slice(5, 7)
  if (mes === '03') return `${ano}-06-30`
  if (mes === '06') return `${ano}-09-30`
  if (mes === '09') return `${ano}-12-31`
  return `${ano + 1}-03-31`
}

const mesmoTrimestreDoAnoAnterior = (periodo: string) => `${Number(periodo.slice(0, 4)) - 1}${periodo.slice(4)}`

const nenhumNulo = (...v: (number | null | undefined)[]) => v.every((x) => typeof x === 'number' && Number.isFinite(x))

/** 12 meses até o trimestre provisório: soma o trimestre novo e tira o mesmo trimestre do ano anterior. null se faltar dado ou a base for outra. */
function ttmAtualizado(e: EmpresaFundamentos, q: Trimestre, trimestres: Trimestre[]): EmpresaFundamentos['ttm'] {
  const t = e.ttm
  if (!t || t.periodoAte !== e.ultimaDemonstracao.dtRefer || t.consolidacao !== q.consolidacao) return null
  const anterior = trimestres.find((x) => x.periodo === mesmoTrimestreDoAnoAnterior(q.periodo) && !x.provisorio && x.consolidacao === q.consolidacao)
  if (!anterior) return null
  if (!nenhumNulo(q.receita, q.lucroLiquido, q.lucroControladores, q.ativoTotal, q.patrimonioLiquido, q.plControladores)) return null
  if (!nenhumNulo(anterior.receita, anterior.lucroLiquido, anterior.lucroControladores, t.receita, t.lucroLiquido, t.lucroControladores)) return null
  return {
    ...t,
    periodoAte: q.periodo,
    receita: t.receita! + q.receita! - anterior.receita!,
    lucroLiquido: t.lucroLiquido! + q.lucroLiquido! - anterior.lucroLiquido!,
    lucroControladores: t.lucroControladores! + q.lucroControladores! - anterior.lucroControladores!,
    ativoTotal: q.ativoTotal,
    patrimonioLiquido: q.patrimonioLiquido,
    plControladores: q.plControladores,
    minoritarios: q.patrimonioLiquido! - q.plControladores!,
  }
}

/**
 * Aplica o balanço mais novo da B3 (se houver e a CVM ainda não tiver) à empresa dos fundamentos. Devolve a mesma empresa quando não há
 * balanço novo. Marca `balancoNovo` para a tela mostrar o selo.
 */
export function aplicarBalancoNovo(e: EmpresaFundamentos, b: EmpresaBalanco | undefined): EmpresaFundamentos {
  if (!b) return e
  const ultima = e.ultimaDemonstracao.dtRefer
  const q = b.trimestres.at(-1)
  const aguardando = (periodo: string, rotulo: string, dtReceb: string | null, aproximada: boolean): EmpresaFundamentos => ({ ...e, balancoNovo: { situacao: 'aguardando-cvm', periodo, rotulo, dtReceb, aproximada } satisfies BalancoNovo })
  if (q?.provisorio && q.periodo > ultima && q.periodo === trimestreSeguinte(ultima)) {
    const aproximada = q.dataAproximada === true
    if (e.financeira) return aguardando(q.periodo, q.rotulo, q.dtReceb, aproximada)
    const ttm = ttmAtualizado(e, q, b.trimestres)
    if (!ttm) return aguardando(q.periodo, q.rotulo, q.dtReceb, aproximada)
    return { ...e, ttm, balancoNovo: { situacao: 'provisorio-b3', periodo: q.periodo, rotulo: q.rotulo, dtReceb: q.dtReceb, aproximada } }
  }
  const a = b.aguardandoCvm
  if (a && a.periodo > ultima && a.periodo === trimestreSeguinte(ultima)) return aguardando(a.periodo, a.rotulo, a.dtReceb, a.dataAproximada === true)
  return e
}
