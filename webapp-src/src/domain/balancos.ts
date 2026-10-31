// Balanços trimestrais (aba "Balanços" do Simule Ações): tipos do balancos.json e a análise do balanço divulgado.
// Tudo em R$ MIL, como o arquivo. Só compara números que a empresa reportou à CVM: não há "consenso de mercado" aqui, então o
// que é "abaixo do esperado" é medido contra o próprio histórico da empresa (trimestre anterior e mesmo trimestre do ano anterior).

import { perfilDoSetor } from './setoresBalanco'
import type { IndicadorSetorial, PerfilSetorial } from './setoresBalanco'
import { conversaoLucroEmCaixa, dividaLiquidaSobreEbitda, faixaDoRoe, fcoCoerente, fluxoDeCaixaLivre, lucroDosAcionistas, roe as calcularRoe, setorAlavancado, tetoDividaEbitda } from './indicadoresComuns'

export interface Trimestre {
  periodo: string
  rotulo: string
  tipo: 'ITR' | 'DFP'
  dtReceb: string | null
  link: string | null
  consolidacao: 'consolidada' | 'individual'
  receita: number | null
  ebit: number | null
  /** EBIT + depreciação e amortização do trimestre (mesma definição da Análise fundamentalista). */
  ebitda: number | null
  /** Caixa operacional, capex e dividendos pagos do trimestre (acumulado do exercício menos o trimestre anterior). */
  fco: number | null
  capex: number | null
  dividendosPagos: number | null
  lucroLiquido: number | null
  lucroControladores: number | null
  ativoTotal: number | null
  patrimonioLiquido: number | null
  plControladores: number | null
  caixa: number | null
  divida: number | null
  /** Vem do resumo da B3 (a CVM ainda não publicou o arquivo aberto): sem EBIT, caixa e dívida até lá. */
  provisorio?: boolean
  /** Sem o aviso da B3: `dtReceb` é o dia da coleta (o balanço saiu até esse dia). */
  dataAproximada?: boolean
  /** Holdings e corretoras de seguro: a CVM traz receita zero e o resultado vem de comissões e equivalência patrimonial; a receita aqui é a soma delas. */
  receitaTipo?: 'comissoes-equivalencia'
  /** Só em bancos, do IF.data do Banco Central (conglomerado prudencial), em fração (0,148 = 14,8%). Ausente até o BC publicar o trimestre. */
  /** Só fora de bancos e seguradoras: lucro bruto e custo (positivo) só existem quando a empresa reporta custo; estoque é saldo do balanço. */
  lucroBruto?: number | null
  cmv?: number | null
  estoques?: number | null
  /** Só em seguradoras, da base SES da SUSEP (seguradora operacional, soma dos 3 meses): prêmio ganho em R$ mil e razões sobre o prêmio ganho. */
  premioGanho?: number | null
  sinistralidade?: number | null
  comissionamento?: number | null
  basileia?: number | null
  capitalPrincipal?: number | null
  nivel1?: number | null
  razaoAlavancagem?: number | null
}

/** Mínimos regulatórios do índice de Basileia (8% + 2,5% de conservação) e do capital principal (4,5% + 2,5%). */
export const MINIMO_BASILEIA = 0.105
export const MINIMO_CAPITAL_PRINCIPAL = 0.07
/** Abaixo disso o banco tem pouca folga sobre o mínimo. */
export const FOLGA_BASILEIA = 0.12

export interface ProximaDivulgacao {
  periodo: string
  rotulo: string
  tipo: 'ITR' | 'DFP'
  estimativa: string
  prazoLegal: string
  base: 'historico' | 'prazo_legal'
  anosNaBase: number
}

export interface EmpresaBalanco {
  ticker: string
  nome: string | null
  setor: string | null
  financeira: boolean
  cnpj: string
  trimestres: Trimestre[]
  proxima: ProximaDivulgacao | null
}

export interface SnapshotBalancos {
  versao: string
  geradoEm: string
  dataCorte: string
  fonte: string
  excluidas: { ticker: string; motivo: string }[]
  empresas: Record<string, EmpresaBalanco>
}

// ---------------------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------------------

const MS_DIA = 86400000
export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / MS_DIA)

/** Data de hoje em Brasília (AAAA-MM-DD). */
export const hojeEmBrasilia = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10)

// ---------------------------------------------------------------------------------------
// Radar: quem divulgou e quem vai divulgar
// ---------------------------------------------------------------------------------------

export type SituacaoRadar =
  /** O trimestre seguinte ao último balanço ainda não foi divulgado e a data estimada é de hoje em diante. */
  | 'vai-divulgar'
  /** A data estimada já passou e a CVM ainda não recebeu o balanço (dentro do prazo legal ou não). */
  | 'aguardando'

export interface ItemRadar {
  ticker: string
  nome: string | null
  setor: string | null
  ultimo: Trimestre
  proxima: ProximaDivulgacao | null
  situacao: SituacaoRadar | null
  /** Dias até a estimativa (negativo se já passou). */
  diasParaEstimativa: number | null
  /** O prazo legal já venceu e o balanço não chegou. */
  foraDoPrazo: boolean
}

export function itensDoRadar(s: SnapshotBalancos, hoje: string): ItemRadar[] {
  const itens: ItemRadar[] = []
  for (const e of Object.values(s.empresas)) {
    const ultimo = e.trimestres.at(-1)
    if (!ultimo) continue
    const p = e.proxima
    // Se o trimestre da estimativa já consta nos dados, a estimativa é velha: a empresa divulgou.
    const pendente = p && p.periodo > ultimo.periodo ? p : null
    const dias = pendente ? diasEntre(hoje, pendente.estimativa) : null
    itens.push({
      ticker: e.ticker,
      nome: e.nome,
      setor: e.setor,
      ultimo,
      proxima: pendente,
      situacao: pendente ? (dias! >= 0 ? 'vai-divulgar' : 'aguardando') : null,
      diasParaEstimativa: dias,
      foraDoPrazo: pendente ? pendente.prazoLegal < hoje : false,
    })
  }
  return itens
}

/** Quem ainda vai divulgar (ou está atrasado em relação ao seu próprio padrão), pela data estimada. */
export function pendentes(itens: ItemRadar[]): ItemRadar[] {
  return itens.filter((i) => i.situacao).sort((a, b) => (a.proxima!.estimativa < b.proxima!.estimativa ? -1 : a.proxima!.estimativa > b.proxima!.estimativa ? 1 : a.ticker.localeCompare(b.ticker)))
}

/** Quem divulgou nos últimos `dias` dias (do mais recente ao mais antigo). */
export function divulgadosRecentes(itens: ItemRadar[], hoje: string, dias = 45): ItemRadar[] {
  return itens
    .filter((i) => i.ultimo.dtReceb && diasEntre(i.ultimo.dtReceb, hoje) <= dias && diasEntre(i.ultimo.dtReceb, hoje) >= 0)
    .sort((a, b) => (a.ultimo.dtReceb! < b.ultimo.dtReceb! ? 1 : a.ultimo.dtReceb! > b.ultimo.dtReceb! ? -1 : a.ticker.localeCompare(b.ticker)))
}

// ---------------------------------------------------------------------------------------
// Análise do balanço
// ---------------------------------------------------------------------------------------

export type Tom = 'bom' | 'ruim' | 'neutro'

export interface Variacao {
  /** Variação percentual (0,5 = +50%); null quando a base é zero, negativa ou ausente e a conta não faz sentido. */
  pct: number | null
  /** Texto curto: "+12%", "−50%", "de prejuízo para lucro", "lucro para prejuízo". */
  texto: string
  tom: Tom
}

export const percentual = (v: number, casas = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

/**
 * Variação de uma conta de resultado. Com lucro/prejuízo, percentual entre sinais diferentes não significa nada: descreve a virada.
 * `maiorEMelhor`: false para dívida.
 */
export function variar(atual: number | null, base: number | null, { maiorEMelhor = true, limiar = 0.03 }: { maiorEMelhor?: boolean; limiar?: number } = {}): Variacao {
  if (atual == null || base == null) return { pct: null, texto: 'sem base de comparação', tom: 'neutro' }
  if (base > 0 && atual < 0) return { pct: null, texto: 'de lucro para prejuízo', tom: maiorEMelhor ? 'ruim' : 'bom' }
  if (base < 0 && atual > 0) return { pct: null, texto: 'de prejuízo para lucro', tom: maiorEMelhor ? 'bom' : 'ruim' }
  if (base === 0) return { pct: null, texto: 'sem base de comparação', tom: 'neutro' }
  if (base < 0 && atual < 0) {
    const pct = (base - atual) / Math.abs(base) // prejuízo menor = positivo
    const abs = `${Math.abs(pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
    return { pct, texto: `prejuízo ${abs} ${pct >= 0 ? 'menor' : 'maior'}`, tom: Math.abs(pct) < limiar ? 'neutro' : (pct > 0) === maiorEMelhor ? 'bom' : 'ruim' }
  }
  const pct = (atual - base) / Math.abs(base)
  const sobe = pct > 0
  return { pct, texto: percentual(pct), tom: Math.abs(pct) < limiar ? 'neutro' : sobe === maiorEMelhor ? 'bom' : 'ruim' }
}

/** Valor em R$ mil escrito por extenso e compacto: 7.041.000 → "R$ 7,0 bi". */
export function reaisCompactos(milReais: number | null): string {
  if (milReais == null) return '—'
  const v = milReais * 1000
  const a = Math.abs(v)
  const sinal = v < 0 ? '−' : ''
  const f = (x: number, u: string) => `${sinal}R$ ${(x).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${u}`
  if (a >= 1e12) return f(a / 1e12, 'tri')
  if (a >= 1e9) return f(a / 1e9, 'bi')
  if (a >= 1e6) return f(a / 1e6, 'mi')
  return `${sinal}R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`
}

const razao = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b)
const lucroDoTri = (t: Trimestre) => lucroDosAcionistas(t)

export interface LinhaComparativa {
  chave: string
  rotulo: string
  /** Valor por trimestre, do mais antigo ao mais recente (mesma ordem de `trimestres`). */
  valores: (number | null)[]
  formato: 'reais' | 'pct' | 'x' | 'var' | 'dias'
  /** Comparação do último trimestre com o trimestre anterior e com o mesmo trimestre do ano anterior. */
  contraAnterior: Variacao
  contraAnoAnterior: Variacao
}

/** Linha de tabela sem comparação própria (análises horizontal e vertical). */
export type LinhaDeAnalise = Pick<LinhaComparativa, 'chave' | 'rotulo' | 'valores' | 'formato'>

export interface Destaque {
  tom: Tom
  titulo: string
  texto: string
}

export type Veredito = 'forte' | 'misto' | 'fraco'

export interface Alerta {
  id: string
  gravidade: 'critico' | 'atencao'
  titulo: string
  detalhe: string
}

export interface AnaliseBalanco {
  ticker: string
  nome: string | null
  financeira: boolean
  /** Grupo do setor e o que a análise acrescenta para ele. */
  perfil: PerfilSetorial
  trimestres: Trimestre[]
  ultimo: Trimestre
  anterior: Trimestre | null
  anoAnterior: Trimestre | null
  linhas: LinhaComparativa[]
  /** Análise horizontal: variação de cada conta contra o mesmo trimestre do ano anterior. */
  horizontal: LinhaDeAnalise[]
  /** Análise vertical: cada conta como fração de uma base (receita no resultado; ativo no balanço). */
  vertical: LinhaDeAnalise[]
  destaques: Destaque[]
  alertas: Alerta[]
  veredito: Veredito
  /** Resumo em uma frase para o topo do cartão. */
  resumo: string
}

/** Trimestre cujo fim é ~um ano antes (360 a 372 dias) do período de referência. */
export function trimestreDoAnoAnterior(trimestres: Trimestre[], periodo: string): Trimestre | null {
  return trimestres.find((t) => {
    const d = diasEntre(t.periodo, periodo)
    return d >= 360 && d <= 372
  }) ?? null
}

/** Soma dos 4 trimestres terminados em `i` (índice em `trimestres`), ou null se algum faltar. */
function soma12m(trimestres: Trimestre[], i: number, campo: (t: Trimestre) => number | null): number | null {
  if (i < 3) return null
  let total = 0
  for (let k = i - 3; k <= i; k++) {
    const v = campo(trimestres[k]!)
    if (v == null) return null
    total += v
  }
  return total
}

/** ROIC aproximado: EBIT dos 12 meses após 34% de imposto ÷ capital investido médio (patrimônio líquido + dívida − caixa, agora e 4 trimestres antes). */
function roicAproximado(tri: Trimestre[], i: number): number | null {
  const ebit12 = soma12m(tri, i, (t) => t.ebit)
  const capital = (t: Trimestre | undefined) => (t == null || t.patrimonioLiquido == null || t.divida == null || t.caixa == null ? null : t.patrimonioLiquido + t.divida - t.caixa)
  const c1 = capital(tri[i])
  const c0 = capital(tri[i - 4])
  if (ebit12 == null || c1 == null || c0 == null) return null
  const medio = (c1 + c0) / 2
  return medio <= 0 ? null : (ebit12 * 0.66) / medio
}

export function analisarBalanco(e: EmpresaBalanco): AnaliseBalanco | null {
  const tri = e.trimestres
  if (tri.length === 0) return null
  const idx = tri.length - 1
  const ultimo = tri[idx]!
  const anterior = tri[idx - 1] ?? null
  const anoAnterior = trimestreDoAnoAnterior(tri, ultimo.periodo)
  const indiceAnoAnterior = anoAnterior ? tri.indexOf(anoAnterior) : -1

  const linhas: LinhaComparativa[] = []
  const add = (chave: string, rotulo: string, formato: LinhaComparativa['formato'], valor: (t: Trimestre, i: number) => number | null, maiorEMelhor = true) => {
    const valores = tri.map(valor)
    const atual = valores[idx] ?? null
    linhas.push({
      chave,
      rotulo,
      valores,
      formato,
      contraAnterior: variar(atual, anterior ? valores[idx - 1] ?? null : null, { maiorEMelhor }),
      contraAnoAnterior: variar(atual, indiceAnoAnterior >= 0 ? valores[indiceAnoAnterior] ?? null : null, { maiorEMelhor }),
    })
  }

  const receitaDeHolding = tri.some((t) => t.receitaTipo != null)
  add('receita', receitaDeHolding ? 'Receita (comissões + equivalência patrimonial)' : e.financeira ? 'Receitas da intermediação financeira' : 'Receita líquida', 'reais', (t) => t.receita)
  if (!e.financeira) add('ebit', 'EBIT (resultado operacional)', 'reais', (t) => t.ebit)
  add('lucro', 'Lucro líquido (dos controladores)', 'reais', lucroDoTri)
  add('margemLiquida', 'Margem líquida', 'pct', (t) => razao(lucroDoTri(t), t.receita))
  if (!e.financeira) add('margemEbit', 'Margem EBIT', 'pct', (t) => razao(t.ebit, t.receita))
  add('pl', 'Patrimônio líquido', 'reais', (t) => t.patrimonioLiquido)
  // Mesma conta da Análise fundamentalista: lucro dos controladores dos últimos 12 meses ÷ patrimônio líquido médio dos controladores.
  add('roe', 'ROE (12 meses)', 'pct', (t, i) => calcularRoe(soma12m(tri, i, lucroDoTri), t.plControladores, tri[i - 4]?.plControladores ?? null))
  if (e.financeira) {
    // ROA: lucro dos controladores dos últimos 12 meses ÷ ativo total médio (agora e 4 trimestres antes).
    add('roa', 'ROA (12 meses)', 'pct', (t, i) => {
      const l12 = soma12m(tri, i, lucroDoTri)
      const a0 = tri[i - 4]?.ativoTotal ?? null
      return l12 == null || a0 == null || t.ativoTotal == null ? null : razao(l12, (t.ativoTotal + a0) / 2)
    })
    add('alavancagem', 'Ativo ÷ patrimônio líquido', 'x', (t) => razao(t.ativoTotal, t.patrimonioLiquido), false)
    // Capital regulatório (Banco Central): só aparece quando o BC já publicou algum trimestre do banco.
    if (tri.some((t) => t.basileia != null)) add('basileia', 'Índice de Basileia', 'pct', (t) => t.basileia ?? null)
    if (tri.some((t) => t.capitalPrincipal != null)) add('capitalPrincipal', 'Capital principal (CET1)', 'pct', (t) => t.capitalPrincipal ?? null)
    // Seguradoras (SUSEP): sinistralidade e comissões sobre o prêmio ganho. O índice combinado completo exigiria as despesas administrativas, que a base não traz.
    if (tri.some((t) => t.sinistralidade != null)) {
      add('sinistralidade', 'Sinistralidade (sinistros ÷ prêmio ganho)', 'pct', (t) => t.sinistralidade ?? null, false)
      add('comissionamento', 'Comissões ÷ prêmio ganho', 'pct', (t) => t.comissionamento ?? null, false)
    }
  } else {
    add('dividaLiquida', 'Dívida líquida', 'reais', (t) => (t.divida == null || t.caixa == null ? null : t.divida - t.caixa), false)
    if (tri.some((t) => t.fco != null)) {
      add('fco', 'Caixa operacional', 'reais', (t) => t.fco)
      add('fcl', 'Fluxo de caixa livre (caixa operacional − capex)', 'reais', (t) => fluxoDeCaixaLivre(t))
      add('conversao', 'Lucro convertido em caixa (12 meses)', 'x', (_t, i) => { const l12 = soma12m(tri, i, lucroDoTri); const f12 = soma12m(tri, i, (x) => x.fco); return conversaoLucroEmCaixa({ lucro: l12, fco: f12, receita: soma12m(tri, i, (x) => x.receita), coerente: fcoCoerente({ fco: f12, ebitda: soma12m(tri, i, (x) => x.ebitda), ebit: soma12m(tri, i, (x) => x.ebit) }) }) })
    }
    add('dividaEbitda', 'Dívida líquida ÷ EBITDA 12m', 'x', (t, i) => dividaLiquidaSobreEbitda(t.divida == null ? null : t.divida - (t.caixa ?? 0), soma12m(tri, i, (x) => x.ebitda)), false)
  }

  // Indicadores do setor (só os que dá para calcular com as demonstrações): o perfil do grupo decide quais entram.
  const perfil = perfilDoSetor(e.setor, e.financeira)
  const quer = (i: IndicadorSetorial) => perfil.indicadores.includes(i)
  if (!e.financeira) {
    if (quer('margemBruta') && tri.some((t) => t.lucroBruto != null)) add('margemBruta', 'Margem bruta', 'pct', (t) => razao(t.lucroBruto ?? null, t.receita))
    if (quer('margemEbitda') && tri.some((t) => t.ebitda != null)) add('margemEbitda', 'Margem EBITDA', 'pct', (t) => razao(t.ebitda, t.receita))
    if (quer('capexReceita') && tri.some((t) => t.capex != null)) add('capexReceita', 'Capex ÷ receita (12 meses)', 'pct', (_t, i) => razao(soma12m(tri, i, (x) => x.capex), soma12m(tri, i, (x) => x.receita)), false)
    if (quer('estoque') && tri.some((t) => t.estoques != null && t.cmv != null)) add('estoqueDias', 'Estoque (dias de custo)', 'dias', (t, i) => { const c = soma12m(tri, i, (x) => x.cmv ?? null); return t.estoques == null || c == null || c <= 0 ? null : (t.estoques / c) * 365 }, false)
    if (quer('roic')) add('roic', 'ROIC (12 meses, aproximado)', 'pct', (_t, i) => roicAproximado(tri, i))
  }

  const linha = (c: string) => linhas.find((l) => l.chave === c)!
  const tem = (c: string) => linhas.some((l) => l.chave === c)
  const lucro = linha('lucro')
  const receita = linha('receita')
  const destaques: Destaque[] = []
  const push = (tom: Tom, titulo: string, texto: string) => destaques.push({ tom, titulo, texto })
  const rot = ultimo.rotulo
  const vsAno = anoAnterior?.rotulo

  // Lucro
  const lucroAtual = lucroDoTri(ultimo)
  if (lucroAtual != null) {
    const a = lucro.contraAnoAnterior
    const q = lucro.contraAnterior
    const parteAno = vsAno ? `${a.texto} contra o ${vsAno}` : null
    const parteTri = anterior ? `${q.texto} contra o ${anterior.rotulo}` : null
    const partes = [parteAno, parteTri].filter(Boolean).join(' e ')
    push(a.tom !== 'neutro' ? a.tom : q.tom, lucroAtual >= 0 ? 'Lucro' : 'Prejuízo', `${rot}: ${lucroAtual >= 0 ? 'lucro' : 'prejuízo'} de ${reaisCompactos(Math.abs(lucroAtual))}${partes ? ` (${partes})` : ''}.`)
  }

  // Receita
  if (ultimo.receita != null) {
    const a = receita.contraAnoAnterior
    push(a.tom, 'Receita', `${reaisCompactos(ultimo.receita)} no trimestre${vsAno && a.pct != null ? `, ${a.texto} contra o ${vsAno}` : ''}${anterior && receita.contraAnterior.pct != null ? ` e ${receita.contraAnterior.texto} contra o ${anterior.rotulo}` : ''}.`)
  }

  // Margem e ROE
  const margem = linha('margemLiquida')
  const ml = margem.valores[idx]
  const mlAno = indiceAnoAnterior >= 0 ? margem.valores[indiceAnoAnterior] : null
  if (ml != null && mlAno != null) {
    const dp = (ml - mlAno) * 100
    push(Math.abs(dp) < 1 ? 'neutro' : dp > 0 ? 'bom' : 'ruim', 'Margem líquida', `${(ml * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% no trimestre, ${Math.abs(dp) < 1 ? 'estável' : dp > 0 ? `${dp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. acima` : `${Math.abs(dp).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. abaixo`} do ${vsAno}.`)
  }
  const roe = linha('roe').valores[idx]
  if (roe != null) {
    const faixa = faixaDoRoe(roe)
    push(faixa === 'alto' ? 'bom' : faixa === 'moderado' ? 'neutro' : 'ruim', 'Retorno sobre o patrimônio', `ROE de ${(roe * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% nos últimos 12 meses (lucro dos controladores ÷ patrimônio líquido médio dos controladores).`)
  }

  // Endividamento
  if (e.financeira) {
    const al = linha('alavancagem')
    const v = al.valores[idx]
    const temCapital = tri.some((t) => t.basileia != null)
    if (v != null) push(al.contraAnoAnterior.tom === 'ruim' ? 'ruim' : 'neutro', 'Alavancagem', `O ativo equivale a ${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o patrimônio líquido${al.contraAnoAnterior.pct != null ? ` (${al.contraAnoAnterior.texto} contra o ${vsAno})` : ''}. Em bancos, isso mede o quanto o balanço é financiado por terceiros${temCapital ? '.' : '; o índice de Basileia, que a regulação acompanha, ainda não está disponível para este banco.'}`)
    // Capital regulatório: o dado do BC chega depois do balanço, então usa o último trimestre que ele já publicou.
    const iCap = tri.findLastIndex((t) => t.basileia != null)
    if (iCap >= 0) {
      const tc = tri[iCap]!
      const b = tc.basileia!
      const anoAnt = tri[iCap - 4]?.basileia ?? null
      const dp = anoAnt != null ? (b - anoAnt) * 100 : null
      const folga = b >= FOLGA_BASILEIA ? 'folga confortável sobre o mínimo regulatório' : b >= MINIMO_BASILEIA ? 'pouca folga sobre o mínimo regulatório' : 'abaixo do mínimo regulatório'
      const principal = tc.capitalPrincipal != null ? `, capital principal de ${(tc.capitalPrincipal * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''
      const variacao = dp != null && Math.abs(dp) >= 0.1 ? `, ${dp > 0 ? 'alta' : 'queda'} de ${Math.abs(dp).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. em 12 meses` : ''
      push(b < MINIMO_BASILEIA ? 'ruim' : b < FOLGA_BASILEIA || (dp != null && dp <= -1) ? 'neutro' : 'bom', 'Capital regulatório', `Índice de Basileia de ${(b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em ${tc.rotulo}${principal}${variacao}: ${folga} (dado do Banco Central).`)
    }
  } else {
    const dl = linha('dividaLiquida')
    const dEbit = linha('dividaEbitda').valores[idx]
    const v = dl.valores[idx]
    if (v != null) {
      const caixaLiquido = v < 0
      const texto = caixaLiquido
        ? `Caixa maior que a dívida: sobra ${reaisCompactos(-v)} (posição de caixa líquido).`
        : `Dívida líquida de ${reaisCompactos(v)}${dEbit != null ? `, ${dEbit.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o EBITDA dos últimos 12 meses` : ''}${dl.contraAnoAnterior.pct != null ? `; ${dl.contraAnoAnterior.texto} contra o ${vsAno}` : ''}.`
      const tom: Tom = caixaLiquido ? 'bom' : dEbit == null ? dl.contraAnoAnterior.tom : dEbit > tetoDividaEbitda(e.setor) ? 'ruim' : dEbit <= (setorAlavancado(e.setor) ? 3.5 : 2) ? 'bom' : 'neutro'
      push(tom, 'Endividamento', texto)
    }
  }

  // Indicadores do setor (margem bruta, EBITDA, ROIC, estoque, capex).
  if (!e.financeira) {
    const lado = (c: string, rotulo: string, formatar: (v: number) => string, emPontos = true) => {
      const v = tem(c) ? linha(c).valores[idx] ?? null : null
      if (v == null) return null
      const a = tem(c) && indiceAnoAnterior >= 0 ? linha(c).valores[indiceAnoAnterior] ?? null : null
      const d = a == null ? null : emPontos ? (v - a) * 100 : v - a
      const sufixo = d == null || Math.abs(d) < (emPontos ? 0.1 : 1) ? '' : ` (${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: emPontos ? 1 : 0 })}${emPontos ? ' p.p.' : ' dias'} contra o ${vsAno})`
      return { texto: `${rotulo} ${formatar(v)}${sufixo}`, d, emPontos }
    }
    const pctTxt = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    const itens = [
      lado('margemBruta', 'margem bruta', pctTxt),
      lado('margemEbitda', 'margem EBITDA', pctTxt),
      lado('roic', 'ROIC', pctTxt),
      lado('estoqueDias', 'estoque de', (v) => `${Math.round(v)} dias de custo`, false),
      lado('capexReceita', 'capex de', (v) => `${pctTxt(v)} da receita`),
    ].filter((x): x is NonNullable<typeof x> => x != null)
    if (itens.length) {
      // O tom segue a primeira margem/retorno comparável (estoque e capex mais altos não são "bons").
      const principal = itens.find((x) => x.d != null && x.emPontos && !x.texto.startsWith('capex'))
      push(principal == null || Math.abs(principal.d!) < 1 ? 'neutro' : principal.d! > 0 ? 'bom' : 'ruim', `Setor: ${perfil.rotulo.toLowerCase()}`, `${itens.map((x) => x.texto).join('; ')}.`)
    }
  }

  if (e.financeira && tri.some((t) => t.sinistralidade != null)) {
    const iSin = tri.findLastIndex((t) => t.sinistralidade != null)
    const ts = tri[iSin]!
    const antes = tri[iSin - 4]?.sinistralidade ?? null
    const dp = antes == null ? null : (ts.sinistralidade! - antes) * 100
    const variacao = dp != null && Math.abs(dp) >= 0.1 ? `, ${dp > 0 ? 'alta' : 'queda'} de ${Math.abs(dp).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p. em 12 meses` : ''
    push(dp == null || Math.abs(dp) < 1 ? 'neutro' : dp > 0 ? 'ruim' : 'bom', 'Sinistralidade', `${(ts.sinistralidade! * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em ${ts.rotulo}${variacao} (dado da SUSEP, da seguradora operacional). É a parte do prêmio que virou sinistro; o índice combinado completo também inclui comissões e despesas administrativas.`)
  }

  // Patrimônio
  const pl = linha('pl')
  if (pl.contraAnoAnterior.pct != null && Math.abs(pl.contraAnoAnterior.pct) >= 0.1) {
    push(pl.contraAnoAnterior.tom, 'Patrimônio líquido', `${pl.contraAnoAnterior.texto} em 12 meses, para ${reaisCompactos(ultimo.patrimonioLiquido)}.`)
  }

  // Quarto trimestre costuma carregar baixas contábeis: avisa quando o resultado do 4T destoa.
  if (ultimo.tipo === 'DFP' && lucroAtual != null && lucroAtual < 0 && (anterior ? (lucroDoTri(anterior) ?? 0) > 0 : false)) {
    push('neutro', 'Atenção ao 4º trimestre', 'O resultado do 4º trimestre é calculado como exercício menos os 9 meses já informados e costuma concentrar baixas contábeis (impairment) e ajustes de fim de ano, que não se repetem todo trimestre.')
  }

  // Sinais de alerta: só com dado suficiente (sem dado não há alerta) e com contexto: investimento pesado ou baixa contábil pontual não é tratado como deterioração.
  const alertas: Alerta[] = []
  const alerta = (id: string, gravidade: Alerta['gravidade'], titulo: string, detalhe: string) => alertas.push({ id, gravidade, titulo, detalhe })
  const pct1 = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const lucro12 = soma12m(tri, idx, lucroDoTri)
  if (ultimo.patrimonioLiquido != null && ultimo.patrimonioLiquido < 0) alerta('pl-negativo', 'critico', 'Patrimônio líquido negativo', `O patrimônio líquido está em ${reaisCompactos(ultimo.patrimonioLiquido)}: as dívidas e obrigações superam o que a empresa possui.`)
  if (lucro12 != null && lucro12 < 0) alerta('prejuizo-12m', 'critico', 'Prejuízo nos últimos 12 meses', `A soma dos 4 últimos trimestres é um prejuízo de ${reaisCompactos(Math.abs(lucro12))}.`)
  else if (lucroAtual != null && lucroAtual < 0) alerta('prejuizo-trimestre', 'atencao', 'Prejuízo no trimestre', `${rot}: prejuízo de ${reaisCompactos(Math.abs(lucroAtual))}${lucro12 != null ? `, mas os 12 meses somam lucro de ${reaisCompactos(lucro12)}` : ''}. Confira se há baixa contábil pontual (impairment) ou efeito cambial.`)
  if (!e.financeira) {
    const dlEbitda = linha('dividaEbitda').valores[idx]
    const dlAtual = ultimo.divida == null ? null : ultimo.divida - (ultimo.caixa ?? 0)
    const ebitda12 = soma12m(tri, idx, (t) => t.ebitda)
    if (dlEbitda != null && dlEbitda > tetoDividaEbitda(e.setor)) alerta('endividamento', 'critico', 'Endividamento elevado', `Dívida líquida de ${dlEbitda.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o EBITDA de 12 meses, acima do limite de atenção de ${tetoDividaEbitda(e.setor).toLocaleString('pt-BR')}× para o setor.`)
    else if (dlAtual != null && dlAtual > 0 && ebitda12 != null && ebitda12 <= 0) alerta('ebitda-negativo', 'critico', 'EBITDA de 12 meses negativo com dívida', `A dívida líquida é de ${reaisCompactos(dlAtual)} e o EBITDA dos 12 meses não é positivo: não há geração operacional para sustentá-la.`)
    const fco12 = soma12m(tri, idx, (t) => t.fco)
    const capex12 = soma12m(tri, idx, (t) => t.capex)
    const divid12 = soma12m(tri, idx, (t) => t.dividendosPagos)
    if (fco12 != null && fco12 < 0) {
      alerta('fco-negativo', 'critico', 'Caixa operacional negativo', `A operação consumiu ${reaisCompactos(Math.abs(fco12))} de caixa nos últimos 12 meses${lucro12 != null && lucro12 > 0 ? `, mesmo com lucro de ${reaisCompactos(lucro12)}` : ''}.`)
    } else if (fco12 != null) {
      const conv = linha('conversao').valores[idx] ?? null
      if (conv != null && conv < 0.5) alerta('lucro-sem-caixa', 'atencao', 'Lucro que não vira caixa', `Só ${pct1(conv)} do lucro dos últimos 12 meses virou caixa operacional (${reaisCompactos(fco12)} de caixa para ${reaisCompactos(lucro12)} de lucro).`)
    }
    const fcl12 = fluxoDeCaixaLivre({ fco: fco12, capex: capex12, ebitda: soma12m(tri, idx, (t) => t.ebitda), ebit: soma12m(tri, idx, (t) => t.ebit) })
    if (fcl12 != null && divid12 != null && divid12 > 0 && divid12 > fcl12) alerta('dividendos-acima-fcl', 'atencao', 'Dividendos acima do caixa livre', `Foram pagos ${reaisCompactos(divid12)} de proventos nos 12 meses, mais do que o fluxo de caixa livre (${reaisCompactos(fcl12)}). A diferença saiu do caixa ou de dívida.`)
    const margem = linha('margemEbit')
    const mAtual = margem.valores[idx]
    const mAno = indiceAnoAnterior >= 0 ? margem.valores[indiceAnoAnterior] : null
    if (mAtual != null && mAno != null && receita.contraAnoAnterior.pct != null && receita.contraAnoAnterior.pct > 0.02 && mAno - mAtual >= 0.02) {
      alerta('margem-cai', 'atencao', 'Receita crescendo, margem caindo', `Receita ${receita.contraAnoAnterior.texto} contra o ${vsAno}, mas a margem EBIT caiu de ${pct1(mAno)} para ${pct1(mAtual)}.`)
    }
    if (indiceAnoAnterior >= 3) {
      const dlAno = tri[indiceAnoAnterior]!.divida == null ? null : tri[indiceAnoAnterior]!.divida! - (tri[indiceAnoAnterior]!.caixa ?? 0)
      const ebitda12Ano = soma12m(tri, indiceAnoAnterior, (t) => t.ebitda)
      if (dlAtual != null && dlAno != null && dlAno > 0 && dlAtual / dlAno - 1 >= 0.1 && ebitda12 != null && ebitda12Ano != null && ebitda12 < ebitda12Ano) {
        alerta('divida-sobe-ebitda-cai', 'atencao', 'Dívida subindo e EBITDA caindo', `Dívida líquida ${percentual(dlAtual / dlAno - 1)} e EBITDA de 12 meses ${percentual(ebitda12 / ebitda12Ano - 1)} em 12 meses.`)
      }
    }
    // Alertas do setor: só com os dois pontos de comparação (agora e um ano antes).
    const agora = (c: string) => (tem(c) ? linha(c).valores[idx] ?? null : null)
    const ano = (c: string) => (tem(c) && indiceAnoAnterior >= 0 ? linha(c).valores[indiceAnoAnterior] ?? null : null)
    const pp = (c: string) => { const a = agora(c); const b = ano(c); return a == null || b == null ? null : a - b }
    const doGrupo = (...grupos: string[]) => grupos.includes(perfil.grupo)
    const dMargemBruta = pp('margemBruta')
    if (dMargemBruta != null && dMargemBruta <= -0.03 && doGrupo('varejo', 'construcao', 'industria')) alerta('margem-bruta-cai', 'atencao', 'Margem bruta em queda', `A margem bruta caiu de ${pct1(ano('margemBruta')!)} para ${pct1(agora('margemBruta')!)} contra o ${vsAno}: a empresa está repassando menos do custo ou perdendo preço.`)
    const dMargemEbitda = pp('margemEbitda')
    if (dMargemEbitda != null && dMargemEbitda <= -0.05 && doGrupo('commodities')) alerta('margem-ebitda-cai', 'atencao', 'Margem EBITDA caiu forte', `A margem EBITDA foi de ${pct1(ano('margemEbitda')!)} para ${pct1(agora('margemEbitda')!)} contra o ${vsAno}. Em setores de commodities isso costuma refletir preço ou custo do ciclo.`)
    const estoqueAgora = agora('estoqueDias')
    const estoqueAno = ano('estoqueDias')
    if (estoqueAgora != null && estoqueAno != null && estoqueAno > 0 && estoqueAgora / estoqueAno - 1 >= 0.25 && doGrupo('varejo', 'construcao', 'industria')) alerta('estoque-sobe', 'atencao', 'Estoque acumulando', `O estoque passou de ${Math.round(estoqueAno)} para ${Math.round(estoqueAgora)} dias de custo contra o ${vsAno}: mais capital parado e risco de remarcação.`)
    const roicAgora = agora('roic')
    if (roicAgora != null && roicAgora < 0.08 && doGrupo('varejo', 'construcao', 'industria', 'servicos', 'commodities')) alerta('roic-baixo', 'atencao', 'Retorno sobre o capital baixo', `ROIC aproximado de ${pct1(roicAgora)} nos 12 meses, abaixo de 8%: o negócio rende pouco sobre o capital que usa.`)
    const capexReceita = agora('capexReceita')
    const dlEbitdaSetor = linha('dividaEbitda').valores[idx]
    if (doGrupo('infraestrutura') && capexReceita != null && capexReceita > 0.4 && dlEbitdaSetor != null && dlEbitdaSetor > 3) alerta('capex-pesado-divida', 'atencao', 'Investimento pesado com dívida alta', `O capex dos 12 meses equivale a ${pct1(capexReceita)} da receita, com dívida líquida de ${dlEbitdaSetor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o EBITDA.`)
  } else {
    const r = linha('roe').valores[idx]
    if (r != null && faixaDoRoe(r) === 'baixo' && lucro.contraAnoAnterior.tom === 'ruim') alerta('roe-baixo', 'atencao', 'Rentabilidade baixa e em queda', `ROE de ${pct1(r)} nos 12 meses, com lucro ${lucro.contraAnoAnterior.texto} contra o ${vsAno}.`)
    // Seguradoras: sinistralidade subindo 5 p.p. ou mais em 12 meses (pressão sobre a margem técnica).
    const iSin = tri.findLastIndex((t) => t.sinistralidade != null)
    if (iSin >= 0) {
      const sAgora = tri[iSin]!.sinistralidade!
      const sAntes = tri[iSin - 4]?.sinistralidade ?? null
      if (sAntes != null && sAgora - sAntes >= 0.05) alerta('sinistralidade-sobe', 'atencao', 'Sinistralidade subindo', `${tri[iSin]!.rotulo}: sinistros equivalem a ${pct1(sAgora)} do prêmio ganho, contra ${pct1(sAntes)} um ano antes.`)
    }
    // Capital regulatório (Banco Central), no último trimestre que o BC já publicou.
    const iCap = tri.findLastIndex((t) => t.basileia != null)
    if (iCap >= 0) {
      const tc = tri[iCap]!
      const b = tc.basileia!
      if (b < MINIMO_BASILEIA) alerta('basileia-minimo', 'critico', 'Índice de Basileia abaixo do mínimo', `${tc.rotulo}: Basileia de ${pct1(b)}, abaixo do mínimo regulatório de ${pct1(MINIMO_BASILEIA)} (8% mais 2,5% de colchão de conservação).`)
      else if (b < FOLGA_BASILEIA) alerta('basileia-folga', 'atencao', 'Pouca folga de capital', `${tc.rotulo}: Basileia de ${pct1(b)}, perto do mínimo regulatório de ${pct1(MINIMO_BASILEIA)}.`)
      if (tc.capitalPrincipal != null && tc.capitalPrincipal < MINIMO_CAPITAL_PRINCIPAL) alerta('capital-principal-minimo', 'critico', 'Capital principal abaixo do mínimo', `${tc.rotulo}: capital principal de ${pct1(tc.capitalPrincipal)}, abaixo do mínimo de ${pct1(MINIMO_CAPITAL_PRINCIPAL)} (4,5% mais 2,5% de colchão).`)
      // Queda persistente: três quedas seguidas somando pelo menos 1 p.p. (só com trimestres consecutivos).
      const serie = iCap >= 3 ? [3, 2, 1, 0].map((k) => tri[iCap - k]!.basileia ?? null) : null
      if (serie && serie.every((v): v is number => v != null) && serie[1]! < serie[0]! && serie[2]! < serie[1]! && serie[3]! < serie[2]! && serie[0]! - serie[3]! >= 0.01) {
        alerta('basileia-cai', 'atencao', 'Basileia em queda há três trimestres', `O índice caiu de ${pct1(serie[0]!)} para ${pct1(serie[3]!)} em três trimestres seguidos.`)
      }
    }
    // ROE alto sustentado por encolhimento do patrimônio, e não por mais lucro.
    const plVar = pl.contraAnoAnterior.pct
    if (r != null && faixaDoRoe(r) === 'alto' && plVar != null && plVar <= -0.1) alerta('roe-por-pl', 'atencao', 'ROE alto com patrimônio encolhendo', `ROE de ${pct1(r)}, mas o patrimônio líquido caiu ${pct1(-plVar)} em 12 meses: parte do retorno vem de um patrimônio menor.`)
    const al = linha('alavancagem')
    if (al.contraAnoAnterior.pct != null && al.contraAnoAnterior.pct >= 0.1 && lucro.contraAnoAnterior.tom === 'ruim') alerta('alavancagem-sobe', 'atencao', 'Alavancagem subindo com lucro em queda', `O ativo passou a ${(al.valores[idx] ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o patrimônio líquido (${al.contraAnoAnterior.texto}) enquanto o lucro caiu.`)
  }

  // Veredito: pesa lucro (ano e trimestre), receita e margem.
  const pontos = (v: Variacao) => (v.tom === 'bom' ? 1 : v.tom === 'ruim' ? -1 : 0)
  const total = pontos(lucro.contraAnoAnterior) * 2 + pontos(lucro.contraAnterior) + pontos(receita.contraAnoAnterior) + (ml != null && mlAno != null ? Math.sign(ml - mlAno) * (Math.abs(ml - mlAno) >= 0.01 ? 1 : 0) : 0)
  const base: Veredito = lucroAtual != null && lucroAtual < 0 ? 'fraco' : total >= 2 ? 'forte' : total <= -2 ? 'fraco' : 'misto'
  // Nota alta não esconde problema crítico: com alerta crítico o balanço nunca é "forte".
  const veredito: Veredito = base === 'forte' && alertas.some((a) => a.gravidade === 'critico') ? 'misto' : base

  const a = lucro.contraAnoAnterior
  const resumo = lucroAtual == null
    ? `${rot}: sem lucro informado.`
    : a.pct != null || a.texto.startsWith('de ')
      ? `${rot}: lucro de ${reaisCompactos(lucroAtual)}, ${a.texto} contra o ${vsAno}.`
      : `${rot}: lucro de ${reaisCompactos(lucroAtual)}.`

  // Horizontal: variação anual (contra 4 trimestres antes) das contas em reais.
  const horizontal: LinhaDeAnalise[] = linhas
    .filter((l) => l.formato === 'reais')
    .map((l) => ({ chave: `h-${l.chave}`, rotulo: `${l.rotulo} (variação anual)`, formato: 'var' as const, valores: l.valores.map((v, i) => (i < 4 ? null : variar(v, l.valores[i - 4] ?? null).pct)) }))

  // Vertical: resultado sobre a receita; balanço sobre o ativo total.
  const sobre = (nome: string, chave: string, valor: (t: Trimestre) => number | null, base: (t: Trimestre) => number | null): LinhaDeAnalise => ({ chave, rotulo: nome, formato: 'pct', valores: tri.map((t) => razao(valor(t), base(t))) })
  const dl = (t: Trimestre) => (t.divida == null ? null : t.divida - (t.caixa ?? 0))
  const vertical: LinhaDeAnalise[] = e.financeira
    ? [
        sobre('Lucro ÷ receita', 'v-lucro', lucroDoTri, (t) => t.receita),
        sobre('Patrimônio líquido ÷ ativo', 'v-pl-ativo', (t) => t.patrimonioLiquido, (t) => t.ativoTotal),
      ]
    : [
        sobre('EBITDA ÷ receita', 'v-ebitda', (t) => t.ebitda, (t) => t.receita),
        sobre('EBIT ÷ receita', 'v-ebit', (t) => t.ebit, (t) => t.receita),
        sobre('Lucro ÷ receita', 'v-lucro', lucroDoTri, (t) => t.receita),
        sobre('Caixa operacional ÷ receita', 'v-fco', (t) => t.fco, (t) => t.receita),
        sobre('Capex ÷ receita', 'v-capex', (t) => t.capex, (t) => t.receita),
        sobre('Caixa ÷ ativo', 'v-caixa', (t) => t.caixa, (t) => t.ativoTotal),
        sobre('Dívida ÷ ativo', 'v-divida', (t) => t.divida, (t) => t.ativoTotal),
        sobre('Patrimônio líquido ÷ ativo', 'v-pl-ativo', (t) => t.patrimonioLiquido, (t) => t.ativoTotal),
        sobre('Dívida líquida ÷ patrimônio líquido', 'v-dl-pl', dl, (t) => t.patrimonioLiquido),
      ]
  const vertCompleto = vertical.filter((l) => l.valores.some((v) => v != null))
  const horizCompleto = horizontal.filter((l) => l.valores.some((v) => v != null))

  return { ticker: e.ticker, nome: e.nome, financeira: e.financeira, perfil, trimestres: tri, ultimo, anterior, anoAnterior, linhas, horizontal: horizCompleto, vertical: vertCompleto, destaques, alertas, veredito, resumo }
}
