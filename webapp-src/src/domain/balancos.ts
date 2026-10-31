// Balanços trimestrais (aba "Balanços" do Simule Ações): tipos do balancos.json e a análise do balanço divulgado.
// Tudo em R$ MIL, como o arquivo. Só compara números que a empresa reportou à CVM: não há "consenso de mercado" aqui, então o
// que é "abaixo do esperado" é medido contra o próprio histórico da empresa (trimestre anterior e mesmo trimestre do ano anterior).

import { dividaLiquidaSobreEbitda, faixaDoRoe, lucroDosAcionistas, roe as calcularRoe, setorAlavancado, tetoDividaEbitda } from './indicadoresComuns'

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
}

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
  formato: 'reais' | 'pct' | 'x'
  /** Comparação do último trimestre com o trimestre anterior e com o mesmo trimestre do ano anterior. */
  contraAnterior: Variacao
  contraAnoAnterior: Variacao
}

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
  trimestres: Trimestre[]
  ultimo: Trimestre
  anterior: Trimestre | null
  anoAnterior: Trimestre | null
  linhas: LinhaComparativa[]
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

  add('receita', e.financeira ? 'Receitas da intermediação financeira' : 'Receita líquida', 'reais', (t) => t.receita)
  if (!e.financeira) add('ebit', 'EBIT (resultado operacional)', 'reais', (t) => t.ebit)
  add('lucro', 'Lucro líquido (dos controladores)', 'reais', lucroDoTri)
  add('margemLiquida', 'Margem líquida', 'pct', (t) => razao(lucroDoTri(t), t.receita))
  if (!e.financeira) add('margemEbit', 'Margem EBIT', 'pct', (t) => razao(t.ebit, t.receita))
  add('pl', 'Patrimônio líquido', 'reais', (t) => t.patrimonioLiquido)
  // Mesma conta da Análise fundamentalista: lucro dos controladores dos últimos 12 meses ÷ patrimônio líquido médio dos controladores.
  add('roe', 'ROE (12 meses)', 'pct', (t, i) => calcularRoe(soma12m(tri, i, lucroDoTri), t.plControladores, tri[i - 4]?.plControladores ?? null))
  if (e.financeira) add('alavancagem', 'Ativo ÷ patrimônio líquido', 'x', (t) => razao(t.ativoTotal, t.patrimonioLiquido), false)
  else {
    add('dividaLiquida', 'Dívida líquida', 'reais', (t) => (t.divida == null || t.caixa == null ? null : t.divida - t.caixa), false)
    add('dividaEbitda', 'Dívida líquida ÷ EBITDA 12m', 'x', (t, i) => dividaLiquidaSobreEbitda(t.divida == null ? null : t.divida - (t.caixa ?? 0), soma12m(tri, i, (x) => x.ebitda)), false)
  }

  const linha = (c: string) => linhas.find((l) => l.chave === c)!
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
    if (v != null) push(al.contraAnoAnterior.tom === 'ruim' ? 'ruim' : 'neutro', 'Alavancagem', `O ativo equivale a ${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o patrimônio líquido${al.contraAnoAnterior.pct != null ? ` (${al.contraAnoAnterior.texto} contra o ${vsAno})` : ''}. Em bancos, isso mede o quanto o balanço é financiado por terceiros; o índice de Basileia, que não está na base aberta, é o que a regulação acompanha.`)
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
  } else {
    const r = linha('roe').valores[idx]
    if (r != null && faixaDoRoe(r) === 'baixo' && lucro.contraAnoAnterior.tom === 'ruim') alerta('roe-baixo', 'atencao', 'Rentabilidade baixa e em queda', `ROE de ${pct1(r)} nos 12 meses, com lucro ${lucro.contraAnoAnterior.texto} contra o ${vsAno}.`)
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

  return { ticker: e.ticker, nome: e.nome, financeira: e.financeira, trimestres: tri, ultimo, anterior, anoAnterior, linhas, destaques, alertas, veredito, resumo }
}
