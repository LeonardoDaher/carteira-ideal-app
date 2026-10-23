/**
 * Sua HP12C: banco de problemas de matemática financeira (juros simples e compostos, taxas, desconto, rendas certas,
 * análise de investimentos e sistemas de amortização). Cada problema declara seus campos, um enunciado de exemplo e
 * uma função `resolver` que devolve o resultado com a fórmula usada. Tudo é conta pura: sem rede e sem estado.
 * Convenções das aulas: mês comercial de 30 dias, ano de 12 meses (360 dias), taxas digitadas em % (5 = 5%).
 */

export type GrupoId = 'juros' | 'taxas' | 'desconto' | 'rendas' | 'investimentos' | 'amortizacao'

export const GRUPOS: { id: GrupoId; titulo: string }[] = [
  { id: 'juros', titulo: 'Juros simples e compostos' },
  { id: 'taxas', titulo: 'Taxas' },
  { id: 'desconto', titulo: 'Desconto' },
  { id: 'rendas', titulo: 'Rendas e HP12C' },
  { id: 'investimentos', titulo: 'Análise de investimentos' },
  { id: 'amortizacao', titulo: 'Amortização' },
]

export type Campo = {
  id: string
  rotulo: string
  tipo: 'numero' | 'lista' | 'escolha'
  padrao?: string
  ajuda?: string
  opcoes?: { valor: string; rotulo: string }[]
  /** Pode ficar vazio (é o que o problema descobre, ou um dado opcional). */
  vazio?: boolean
}

export type Resultado = {
  linhas: { rotulo: string; valor: string; destaque?: boolean }[]
  passos: string[]
  tabela?: { cabecalho: string[]; linhas: string[][] }
}
export type Erro = { erro: string }

export type Exemplo = { enunciado: string; valores: Record<string, string> }

export type Problema = {
  id: string
  grupo: GrupoId
  titulo: string
  resumo: string
  campos: Campo[]
  exemplos: Exemplo[]
  resolver: (v: Record<string, string>) => Resultado | Erro
}

export function ehErro(r: Resultado | Erro): r is Erro {
  return 'erro' in r
}

// ---------- formatação e leitura de números (pt-BR) ----------

export function fmtN(n: number, min = 2, max = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max })
}
export const brl = (n: number) => `R$ ${fmtN(n)}`
/** Taxa em fração (0,05) escrita em % (5,00%). */
export const fmtTaxa = (frac: number) => `${fmtN(frac * 100, 2, 4)}%`

/** Lê "1.000,50", "1000.5", "R$ 2.500", "5%" ou "12,5 %". Devolve NaN se não for número. */
export function lerNumero(texto: string | undefined): number {
  if (texto === undefined) return NaN
  let t = texto.replace(/R\$|%|\s/g, '')
  if (t === '' || t === '-') return NaN
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export function lerLista(texto: string | undefined): number[] {
  if (!texto) return []
  return texto
    .split(/[;\n]+/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map(lerNumero)
}

function vazio(v: Record<string, string>, id: string) {
  return (v[id] ?? '').trim() === ''
}
function num(v: Record<string, string>, id: string) {
  return lerNumero(v[id])
}

// ---------- períodos (em meses comerciais) ----------

export const PERIODOS: { valor: string; rotulo: string; meses: number }[] = [
  { valor: 'dia', rotulo: 'ao dia', meses: 1 / 30 },
  { valor: 'mes', rotulo: 'ao mês', meses: 1 },
  { valor: 'bimestre', rotulo: 'ao bimestre', meses: 2 },
  { valor: 'trimestre', rotulo: 'ao trimestre', meses: 3 },
  { valor: 'quadrimestre', rotulo: 'ao quadrimestre', meses: 4 },
  { valor: 'semestre', rotulo: 'ao semestre', meses: 6 },
  { valor: 'ano', rotulo: 'ao ano', meses: 12 },
]
const OPCOES_PERIODO = PERIODOS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))
const mesesDe = (id: string) => PERIODOS.find((p) => p.valor === id)?.meses ?? 1
const rotuloPeriodo = (id: string) => PERIODOS.find((p) => p.valor === id)?.rotulo ?? id

// ---------- valor do dinheiro no tempo (convenção HP12C) ----------

/** Soma que a HP12C zera: PV + PMT·(1+i·b)·a(n,i) + FV·(1+i)^-n = 0, com b = 1 no modo início (BEGIN). */
export function fvZero(n: number, i: number, pv: number, pmt: number, fv: number, inicio: boolean) {
  const b = inicio ? 1 : 0
  const v = Math.pow(1 + i, -n)
  const a = i === 0 ? n : (1 - v) / i
  return pv + pmt * (1 + i * b) * a + fv * v
}

export function resolverTaxa(n: number, pv: number, pmt: number, fv: number, inicio: boolean): number | null {
  const f = (i: number) => fvZero(n, i, pv, pmt, fv, inicio)
  const grade = [-0.9, -0.5, -0.2, -0.05, -0.001, 0.0000001, 0.0005, 0.002, 0.005, 0.01, 0.02, 0.035, 0.05, 0.08, 0.12, 0.2, 0.35, 0.6, 1, 2, 5, 20]
  for (let k = 0; k < grade.length - 1; k++) {
    let lo = grade[k]
    let hi = grade[k + 1]
    let flo = f(lo)
    const fhi = f(hi)
    if (!Number.isFinite(flo) || !Number.isFinite(fhi)) continue
    if (flo === 0) return lo
    if (flo * fhi > 0) continue
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2
      const fm = f(mid)
      if (fm === 0) return mid
      if (flo * fm < 0) hi = mid
      else {
        lo = mid
        flo = fm
      }
    }
    return (lo + hi) / 2
  }
  return null
}

export function resolverPrazo(i: number, pv: number, pmt: number, fv: number, inicio: boolean): number | null {
  if (i === 0) {
    if (pmt === 0) return null
    return -(pv + fv) / pmt
  }
  const c = (pmt * (1 + (inicio ? i : 0))) / i
  const x = (pv + c) / (c - fv)
  if (!(x > 0) || !Number.isFinite(x)) return null
  return -Math.log(x) / Math.log(1 + i)
}

// ---------- fluxo de caixa: VPL, TIR e companhia ----------

export function vpl(taxa: number, fluxo: number[]) {
  return fluxo.reduce((s, c, t) => s + c / Math.pow(1 + taxa, t), 0)
}

export function tir(fluxo: number[]): number | null {
  const temPos = fluxo.some((c) => c > 0)
  const temNeg = fluxo.some((c) => c < 0)
  if (!temPos || !temNeg) return null
  const grade = [-0.99, -0.9, -0.5, -0.2, -0.05, 0, 0.01, 0.03, 0.06, 0.1, 0.2, 0.35, 0.6, 1, 2, 5, 20, 100]
  for (let k = 0; k < grade.length - 1; k++) {
    let lo = grade[k]
    let hi = grade[k + 1]
    let flo = vpl(lo, fluxo)
    const fhi = vpl(hi, fluxo)
    if (flo === 0) return lo
    if (flo * fhi > 0) continue
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2
      const fm = vpl(mid, fluxo)
      if (flo * fm <= 0) hi = mid
      else {
        lo = mid
        flo = fm
      }
    }
    return (lo + hi) / 2
  }
  return null
}

// ---------- os problemas ----------

function umVazio(v: Record<string, string>, ids: string[]): string | Erro {
  const faltando = ids.filter((id) => vazio(v, id))
  if (faltando.length === 0) return { erro: 'Deixe em branco o campo que você quer descobrir.' }
  if (faltando.length > 1) return { erro: 'Preencha todos os campos, menos o que você quer descobrir (só um pode ficar vazio).' }
  for (const id of ids) if (id !== faltando[0] && Number.isNaN(num(v, id))) return { erro: 'Confira os números digitados.' }
  return faltando[0]
}

const jurosSimples: Problema = {
  id: 'jurosSimples',
  grupo: 'juros',
  titulo: 'Juros simples',
  resumo: 'Capital, taxa, prazo e montante: deixe vazio o que quer descobrir.',
  campos: [
    { id: 'capital', rotulo: 'Capital (R$)', tipo: 'numero', vazio: true },
    { id: 'taxa', rotulo: 'Taxa (%)', tipo: 'numero', vazio: true },
    { id: 'prazo', rotulo: 'Prazo (na mesma unidade da taxa)', tipo: 'numero', vazio: true },
    { id: 'montante', rotulo: 'Montante (R$)', tipo: 'numero', vazio: true },
  ],
  exemplos: [
    { enunciado: 'Um capital de R$ 10.000 é aplicado a juros simples de 3% ao mês por 8 meses. Qual o montante?', valores: { capital: '10000', taxa: '3', prazo: '8', montante: '' } },
    { enunciado: 'A que taxa mensal de juros simples R$ 5.000 viram R$ 6.200 em 12 meses?', valores: { capital: '5000', taxa: '', prazo: '12', montante: '6200' } },
    { enunciado: 'Em quanto tempo, a juros simples de 2% ao mês, R$ 2.000 rendem R$ 800 de juros?', valores: { capital: '2000', taxa: '2', prazo: '', montante: '2800' } },
  ],
  resolver(v) {
    const f = umVazio(v, ['capital', 'taxa', 'prazo', 'montante'])
    if (typeof f !== 'string') return f
    const C = num(v, 'capital')
    const i = num(v, 'taxa') / 100
    const n = num(v, 'prazo')
    const M = num(v, 'montante')
    const passos = ['M = C · (1 + i · n)   e   J = C · i · n']
    let capital = C
    let taxa = i
    let prazo = n
    let montante = M
    if (f === 'montante') {
      montante = C * (1 + i * n)
      passos.push(`M = ${fmtN(C)} · (1 + ${fmtTaxa(i)} · ${fmtN(n, 0, 4)}) = ${fmtN(montante)}`)
    } else if (f === 'capital') {
      capital = M / (1 + i * n)
      passos.push(`C = M / (1 + i · n) = ${fmtN(M)} / (1 + ${fmtTaxa(i)} · ${fmtN(n, 0, 4)}) = ${fmtN(capital)}`)
    } else if (f === 'taxa') {
      taxa = (M / C - 1) / n
      passos.push(`i = (M / C − 1) / n = (${fmtN(M)} / ${fmtN(C)} − 1) / ${fmtN(n, 0, 4)} = ${fmtTaxa(taxa)}`)
    } else {
      prazo = (M / C - 1) / i
      passos.push(`n = (M / C − 1) / i = (${fmtN(M)} / ${fmtN(C)} − 1) / ${fmtTaxa(i)} = ${fmtN(prazo, 0, 4)}`)
    }
    if (![capital, taxa, prazo, montante].every(Number.isFinite)) return { erro: 'Esses números não têm solução. Confira os valores.' }
    const linhas: Resultado['linhas'] = [
      { rotulo: f === 'capital' ? 'Capital' : 'Capital (dado)', valor: brl(capital), destaque: f === 'capital' },
      { rotulo: f === 'taxa' ? 'Taxa' : 'Taxa (dada)', valor: fmtTaxa(taxa), destaque: f === 'taxa' },
      { rotulo: f === 'prazo' ? 'Prazo' : 'Prazo (dado)', valor: fmtN(prazo, 0, 4), destaque: f === 'prazo' },
      { rotulo: f === 'montante' ? 'Montante' : 'Montante (dado)', valor: brl(montante), destaque: f === 'montante' },
      { rotulo: 'Juros', valor: brl(montante - capital) },
    ]
    return { linhas, passos }
  },
}

const jurosCompostos: Problema = {
  id: 'jurosCompostos',
  grupo: 'juros',
  titulo: 'Juros compostos',
  resumo: 'Capital, taxa, prazo e montante: deixe vazio o que quer descobrir.',
  campos: [
    { id: 'capital', rotulo: 'Capital (R$)', tipo: 'numero', vazio: true },
    { id: 'taxa', rotulo: 'Taxa (%)', tipo: 'numero', vazio: true },
    { id: 'prazo', rotulo: 'Prazo (na mesma unidade da taxa)', tipo: 'numero', vazio: true },
    { id: 'montante', rotulo: 'Montante (R$)', tipo: 'numero', vazio: true },
  ],
  exemplos: [
    { enunciado: 'Qual o montante de R$ 10.000 aplicados a 2% ao mês, juros compostos, por 12 meses?', valores: { capital: '10000', taxa: '2', prazo: '12', montante: '' } },
    { enunciado: 'Quanto devo aplicar hoje, a 1% ao mês em juros compostos, para ter R$ 50.000 em 36 meses?', valores: { capital: '', taxa: '1', prazo: '36', montante: '50000' } },
    { enunciado: 'A que taxa mensal composta R$ 8.000 viram R$ 10.000 em 10 meses?', valores: { capital: '8000', taxa: '', prazo: '10', montante: '10000' } },
    { enunciado: 'Em quantos meses R$ 1.000 dobram a 3% ao mês, em juros compostos?', valores: { capital: '1000', taxa: '3', prazo: '', montante: '2000' } },
  ],
  resolver(v) {
    const f = umVazio(v, ['capital', 'taxa', 'prazo', 'montante'])
    if (typeof f !== 'string') return f
    const C = num(v, 'capital')
    const i = num(v, 'taxa') / 100
    const n = num(v, 'prazo')
    const M = num(v, 'montante')
    const passos = ['M = C · (1 + i)ⁿ   e   J = M − C']
    let capital = C
    let taxa = i
    let prazo = n
    let montante = M
    if (f === 'montante') {
      montante = C * Math.pow(1 + i, n)
      passos.push(`M = ${fmtN(C)} · (1 + ${fmtTaxa(i)})^${fmtN(n, 0, 4)} = ${fmtN(montante)}`)
    } else if (f === 'capital') {
      capital = M / Math.pow(1 + i, n)
      passos.push(`C = M / (1 + i)ⁿ = ${fmtN(M)} / (1 + ${fmtTaxa(i)})^${fmtN(n, 0, 4)} = ${fmtN(capital)}`)
    } else if (f === 'taxa') {
      taxa = Math.pow(M / C, 1 / n) - 1
      passos.push(`i = (M / C)^(1/n) − 1 = (${fmtN(M)} / ${fmtN(C)})^(1/${fmtN(n, 0, 4)}) − 1 = ${fmtTaxa(taxa)}`)
    } else {
      prazo = Math.log(M / C) / Math.log(1 + i)
      passos.push(`n = ln(M / C) / ln(1 + i) = ln(${fmtN(M)} / ${fmtN(C)}) / ln(1 + ${fmtTaxa(i)}) = ${fmtN(prazo, 0, 4)}`)
    }
    if (![capital, taxa, prazo, montante].every(Number.isFinite)) return { erro: 'Esses números não têm solução. Confira os valores.' }
    return {
      linhas: [
        { rotulo: f === 'capital' ? 'Capital' : 'Capital (dado)', valor: brl(capital), destaque: f === 'capital' },
        { rotulo: f === 'taxa' ? 'Taxa' : 'Taxa (dada)', valor: fmtTaxa(taxa), destaque: f === 'taxa' },
        { rotulo: f === 'prazo' ? 'Prazo' : 'Prazo (dado)', valor: fmtN(prazo, 0, 4), destaque: f === 'prazo' },
        { rotulo: f === 'montante' ? 'Montante' : 'Montante (dado)', valor: brl(montante), destaque: f === 'montante' },
        { rotulo: 'Juros', valor: brl(montante - capital) },
      ],
      passos,
    }
  },
}

const jurosExatos: Problema = {
  id: 'jurosExatos',
  grupo: 'juros',
  titulo: 'Juros comerciais e exatos',
  resumo: 'Juros simples por dias: ano comercial (360) contra ano civil (365).',
  campos: [
    { id: 'capital', rotulo: 'Capital (R$)', tipo: 'numero' },
    { id: 'taxa', rotulo: 'Taxa ao ano (%)', tipo: 'numero' },
    { id: 'dias', rotulo: 'Dias', tipo: 'numero' },
  ],
  exemplos: [{ enunciado: 'Qual o juro simples de R$ 20.000 a 18% ao ano por 50 dias, pelo ano comercial e pelo exato?', valores: { capital: '20000', taxa: '18', dias: '50' } }],
  resolver(v) {
    const C = num(v, 'capital')
    const i = num(v, 'taxa') / 100
    const d = num(v, 'dias')
    if ([C, i, d].some(Number.isNaN)) return { erro: 'Preencha capital, taxa e dias.' }
    const com = C * i * (d / 360)
    const exa = C * i * (d / 365)
    return {
      linhas: [
        { rotulo: 'Juros comerciais (360 dias)', valor: brl(com), destaque: true },
        { rotulo: 'Juros exatos (365 dias)', valor: brl(exa), destaque: true },
        { rotulo: 'Diferença', valor: brl(com - exa) },
      ],
      passos: ['J = C · i · (dias / base)', `Comercial: ${fmtN(C)} · ${fmtTaxa(i)} · ${fmtN(d, 0, 4)}/360 = ${fmtN(com)}`, `Exato: ${fmtN(C)} · ${fmtTaxa(i)} · ${fmtN(d, 0, 4)}/365 = ${fmtN(exa)}`],
    }
  },
}

const taxaEquivalente: Problema = {
  id: 'taxaEquivalente',
  grupo: 'taxas',
  titulo: 'Taxas equivalentes e proporcionais',
  resumo: 'Troca a taxa de período: composta (equivalente) e simples (proporcional).',
  campos: [
    { id: 'taxa', rotulo: 'Taxa (%)', tipo: 'numero' },
    { id: 'de', rotulo: 'A taxa dada é', tipo: 'escolha', padrao: 'mes', opcoes: OPCOES_PERIODO },
    { id: 'para', rotulo: 'Quero a taxa', tipo: 'escolha', padrao: 'ano', opcoes: OPCOES_PERIODO },
  ],
  exemplos: [
    { enunciado: 'Qual a taxa anual equivalente a 2% ao mês?', valores: { taxa: '2', de: 'mes', para: 'ano' } },
    { enunciado: 'Qual a taxa mensal equivalente a 21% ao ano?', valores: { taxa: '21', de: 'ano', para: 'mes' } },
    { enunciado: 'Qual a taxa trimestral equivalente a 10% ao semestre?', valores: { taxa: '10', de: 'semestre', para: 'trimestre' } },
  ],
  resolver(v) {
    const i = num(v, 'taxa') / 100
    if (Number.isNaN(i)) return { erro: 'Digite a taxa.' }
    const k = mesesDe(v.para ?? 'ano') / mesesDe(v.de ?? 'mes')
    const eq = Math.pow(1 + i, k) - 1
    const prop = i * k
    return {
      linhas: [
        { rotulo: `Taxa equivalente (composta) ${rotuloPeriodo(v.para ?? 'ano')}`, valor: fmtTaxa(eq), destaque: true },
        { rotulo: `Taxa proporcional (simples) ${rotuloPeriodo(v.para ?? 'ano')}`, valor: fmtTaxa(prop) },
      ],
      passos: ['1 + i_desejada = (1 + i_dada)^(prazo desejado / prazo dado)', `1 + i = (1 + ${fmtTaxa(i)})^${fmtN(k, 0, 6)}`, `i = ${fmtTaxa(eq)}   (proporcional: ${fmtTaxa(i)} · ${fmtN(k, 0, 6)} = ${fmtTaxa(prop)})`],
    }
  },
}

const nominalEfetiva: Problema = {
  id: 'nominalEfetiva',
  grupo: 'taxas',
  titulo: 'Taxa nominal e efetiva',
  resumo: 'Nominal capitalizada em outro período: acha a taxa efetiva.',
  campos: [
    { id: 'taxa', rotulo: 'Taxa nominal (%)', tipo: 'numero' },
    { id: 'periodoNominal', rotulo: 'A taxa nominal é', tipo: 'escolha', padrao: 'ano', opcoes: OPCOES_PERIODO },
    { id: 'capitalizacao', rotulo: 'Capitalizada', tipo: 'escolha', padrao: 'mes', opcoes: OPCOES_PERIODO.map((o) => ({ valor: o.valor, rotulo: o.rotulo.replace('ao ', 'a cada ').replace('a cada dia', 'a cada dia') })) },
  ],
  exemplos: [
    { enunciado: 'Uma taxa de 24% ao ano com capitalização mensal. Qual a taxa efetiva anual?', valores: { taxa: '24', periodoNominal: 'ano', capitalizacao: 'mes' } },
    { enunciado: 'Uma taxa nominal de 12% ao ano capitalizada trimestralmente. Qual a efetiva anual?', valores: { taxa: '12', periodoNominal: 'ano', capitalizacao: 'trimestre' } },
  ],
  resolver(v) {
    const nom = num(v, 'taxa') / 100
    if (Number.isNaN(nom)) return { erro: 'Digite a taxa nominal.' }
    const m = mesesDe(v.periodoNominal ?? 'ano') / mesesDe(v.capitalizacao ?? 'mes')
    const iper = nom / m
    const ef = Math.pow(1 + iper, m) - 1
    return {
      linhas: [
        { rotulo: `Taxa por período de capitalização`, valor: fmtTaxa(iper) },
        { rotulo: `Taxa efetiva ${rotuloPeriodo(v.periodoNominal ?? 'ano')}`, valor: fmtTaxa(ef), destaque: true },
      ],
      passos: ['Taxa por período = taxa nominal / nº de capitalizações', 'Efetiva = (1 + taxa por período)^(nº de capitalizações) − 1', `${fmtTaxa(nom)} / ${fmtN(m, 0, 4)} = ${fmtTaxa(iper)};  (1 + ${fmtTaxa(iper)})^${fmtN(m, 0, 4)} − 1 = ${fmtTaxa(ef)}`],
    }
  },
}

const capContinua: Problema = {
  id: 'capContinua',
  grupo: 'juros',
  titulo: 'Capitalização contínua e convenção linear',
  resumo: 'M = C·e^(i·n) e o prazo fracionário pelas convenções linear e exponencial.',
  campos: [
    { id: 'capital', rotulo: 'Capital (R$)', tipo: 'numero' },
    { id: 'taxa', rotulo: 'Taxa (%)', tipo: 'numero' },
    { id: 'prazo', rotulo: 'Prazo (pode ser fracionário)', tipo: 'numero' },
  ],
  exemplos: [{ enunciado: 'R$ 1.000 a 10% ao ano por 2,5 anos: qual o montante contínuo e pelas convenções linear e exponencial?', valores: { capital: '1000', taxa: '10', prazo: '2.5' } }],
  resolver(v) {
    const C = num(v, 'capital')
    const i = num(v, 'taxa') / 100
    const n = num(v, 'prazo')
    if ([C, i, n].some(Number.isNaN)) return { erro: 'Preencha capital, taxa e prazo.' }
    const cont = C * Math.exp(i * n)
    const expo = C * Math.pow(1 + i, n)
    const inteiro = Math.floor(n)
    const frac = n - inteiro
    const lin = C * Math.pow(1 + i, inteiro) * (1 + i * frac)
    return {
      linhas: [
        { rotulo: 'Montante contínuo C·e^(i·n)', valor: brl(cont), destaque: true },
        { rotulo: 'Convenção exponencial', valor: brl(expo) },
        { rotulo: 'Convenção linear', valor: brl(lin) },
      ],
      passos: ['Contínuo: M = C · e^(i·n)', 'Exponencial: M = C · (1 + i)ⁿ', 'Linear: M = C · (1 + i)^(parte inteira) · (1 + i · parte fracionária)'],
    }
  },
}

const taxaAcumulada: Problema = {
  id: 'taxaAcumulada',
  grupo: 'taxas',
  titulo: 'Taxa acumulada de vários períodos',
  resumo: 'Acumula taxas de períodos seguidos (ex.: inflação mês a mês) e dá a média geométrica.',
  campos: [{ id: 'taxas', rotulo: 'Taxas (%) separadas por ponto e vírgula', tipo: 'lista', ajuda: 'Ex.: 1,2; 0,8; 1,5' }],
  exemplos: [{ enunciado: 'A inflação foi de 1,2%, 0,8% e 1,5% em três meses seguidos. Qual a inflação acumulada?', valores: { taxas: '1,2; 0,8; 1,5' } }],
  resolver(v) {
    const t = lerLista(v.taxas)
    if (t.length === 0 || t.some(Number.isNaN)) return { erro: 'Digite as taxas separadas por ponto e vírgula.' }
    const acc = t.reduce((s, x) => s * (1 + x / 100), 1) - 1
    const media = Math.pow(1 + acc, 1 / t.length) - 1
    return {
      linhas: [
        { rotulo: 'Taxa acumulada', valor: fmtTaxa(acc), destaque: true },
        { rotulo: 'Taxa média por período (geométrica)', valor: fmtTaxa(media) },
      ],
      passos: ['1 + i_acumulada = (1 + i₁) · (1 + i₂) · … · (1 + iₙ)', `= ${t.map((x) => `(1 + ${fmtTaxa(x / 100)})`).join(' · ')} = ${fmtN(1 + acc, 4, 6)}`],
    }
  },
}

const taxaReal: Problema = {
  id: 'taxaReal',
  grupo: 'taxas',
  titulo: 'Taxa aparente, inflação e taxa real',
  resumo: '(1 + aparente) = (1 + real) · (1 + inflação). Deixe vazia a que quer descobrir.',
  campos: [
    { id: 'aparente', rotulo: 'Taxa aparente (%)', tipo: 'numero', vazio: true },
    { id: 'inflacao', rotulo: 'Inflação (%)', tipo: 'numero', vazio: true },
    { id: 'real', rotulo: 'Taxa real (%)', tipo: 'numero', vazio: true },
  ],
  exemplos: [
    { enunciado: 'Um investimento rendeu 12% no ano e a inflação foi de 5%. Qual o ganho real?', valores: { aparente: '12', inflacao: '5', real: '' } },
    { enunciado: 'Quero ganho real de 6% ao ano com inflação de 4%. Qual a taxa aparente?', valores: { aparente: '', inflacao: '4', real: '6' } },
  ],
  resolver(v) {
    const f = umVazio(v, ['aparente', 'inflacao', 'real'])
    if (typeof f !== 'string') return f
    const a = num(v, 'aparente') / 100
    const p = num(v, 'inflacao') / 100
    const r = num(v, 'real') / 100
    let res: number
    let passo: string
    if (f === 'real') {
      res = (1 + a) / (1 + p) - 1
      passo = `r = (1 + ${fmtTaxa(a)}) / (1 + ${fmtTaxa(p)}) − 1 = ${fmtTaxa(res)}`
    } else if (f === 'aparente') {
      res = (1 + r) * (1 + p) - 1
      passo = `a = (1 + ${fmtTaxa(r)}) · (1 + ${fmtTaxa(p)}) − 1 = ${fmtTaxa(res)}`
    } else {
      res = (1 + a) / (1 + r) - 1
      passo = `π = (1 + ${fmtTaxa(a)}) / (1 + ${fmtTaxa(r)}) − 1 = ${fmtTaxa(res)}`
    }
    const nome = f === 'real' ? 'Taxa real' : f === 'aparente' ? 'Taxa aparente' : 'Inflação'
    return { linhas: [{ rotulo: nome, valor: fmtTaxa(res), destaque: true }], passos: ['(1 + aparente) = (1 + real) · (1 + inflação)', passo] }
  },
}

const desconto: Problema = {
  id: 'desconto',
  grupo: 'desconto',
  titulo: 'Desconto de títulos',
  resumo: 'Racional e comercial, simples e composto, lado a lado.',
  campos: [
    { id: 'nominal', rotulo: 'Valor nominal N (R$)', tipo: 'numero' },
    { id: 'taxa', rotulo: 'Taxa de desconto (%)', tipo: 'numero' },
    { id: 'prazo', rotulo: 'Prazo antes do vencimento (mesma unidade da taxa)', tipo: 'numero' },
  ],
  exemplos: [
    { enunciado: 'Um título de R$ 10.000 vence em 3 meses e é descontado a 2% ao mês. Qual o valor atual em cada tipo de desconto?', valores: { nominal: '10000', taxa: '2', prazo: '3' } },
    { enunciado: 'Um título de R$ 5.000 é descontado 90 dias antes do vencimento a 4% ao mês (3 meses).', valores: { nominal: '5000', taxa: '4', prazo: '3' } },
  ],
  resolver(v) {
    const N = num(v, 'nominal')
    const i = num(v, 'taxa') / 100
    const n = num(v, 'prazo')
    if ([N, i, n].some(Number.isNaN)) return { erro: 'Preencha valor nominal, taxa e prazo.' }
    const Ars = N / (1 + i * n)
    const Acs = N * (1 - i * n)
    const Arc = N / Math.pow(1 + i, n)
    const Acc = N * Math.pow(1 - i, n)
    const efetiva = i / (1 - i * n)
    const linhas = [
      ['Racional simples (por dentro)', Ars],
      ['Comercial simples (por fora)', Acs],
      ['Racional composto', Arc],
      ['Comercial composto', Acc],
    ] as const
    return {
      linhas: [{ rotulo: 'Taxa efetiva do desconto comercial simples', valor: fmtTaxa(efetiva), destaque: true }],
      passos: [
        'Racional simples: A = N / (1 + i·n)      Comercial simples: A = N·(1 − i·n)',
        'Racional composto: A = N / (1 + i)ⁿ      Comercial composto: A = N·(1 − i)ⁿ',
        'Desconto D = N − A.  Relação: D comercial simples = D racional simples · (1 + i·n)',
        'Taxa efetiva do comercial simples: i_ef = i / (1 − i·n)',
      ],
      tabela: { cabecalho: ['Modalidade', 'Valor atual A', 'Desconto D'], linhas: linhas.map(([nome, a]) => [nome, brl(a), brl(N - a)]) },
    }
  },
}

const hp12c: Problema = {
  id: 'hp12c',
  grupo: 'rendas',
  titulo: 'HP12C: n, i, PV, PMT e FV',
  resumo: 'Anuidades, financiamentos e rendas certas. O campo vazio é o que a HP12C calcularia.',
  campos: [
    { id: 'n', rotulo: 'n (número de períodos)', tipo: 'numero', vazio: true },
    { id: 'i', rotulo: 'i (taxa % por período)', tipo: 'numero', vazio: true },
    { id: 'pv', rotulo: 'PV (valor presente, R$)', tipo: 'numero', padrao: '0', vazio: true, ajuda: 'Dinheiro que entra no caixa é positivo, o que sai é negativo (como na HP12C).' },
    { id: 'pmt', rotulo: 'PMT (parcela, R$)', tipo: 'numero', padrao: '0', vazio: true },
    { id: 'fv', rotulo: 'FV (valor futuro, R$)', tipo: 'numero', padrao: '0', vazio: true },
    {
      id: 'modo',
      rotulo: 'Pagamentos',
      tipo: 'escolha',
      padrao: 'fim',
      opcoes: [
        { valor: 'fim', rotulo: 'No fim do período (postecipada, END)' },
        { valor: 'inicio', rotulo: 'No início do período (antecipada, BEGIN)' },
      ],
    },
  ],
  exemplos: [
    { enunciado: 'Um carro de R$ 40.000 é financiado em 36 parcelas mensais iguais a 1,5% ao mês, a primeira um mês depois. Qual a parcela?', valores: { n: '36', i: '1.5', pv: '40000', pmt: '', fv: '0', modo: 'fim' } },
    { enunciado: 'Depositando R$ 500 por mês a 0,8% ao mês durante 24 meses (depósito no fim do mês), quanto terei?', valores: { n: '24', i: '0.8', pv: '0', pmt: '-500', fv: '', modo: 'fim' } },
    { enunciado: 'Um aparelho custa R$ 3.000 à vista ou 12 parcelas de R$ 280. Qual a taxa de juros mensal do parcelamento (sem entrada)?', valores: { n: '12', i: '', pv: '3000', pmt: '-280', fv: '0', modo: 'fim' } },
    { enunciado: 'Quantas parcelas de R$ 1.200 são necessárias para quitar uma dívida de R$ 15.000 a 2% ao mês?', valores: { n: '', i: '2', pv: '15000', pmt: '-1200', fv: '0', modo: 'fim' } },
  ],
  resolver(v) {
    const f = umVazio(v, ['n', 'i', 'pv', 'pmt', 'fv'])
    if (typeof f !== 'string') return f
    const inicio = v.modo === 'inicio'
    const n = num(v, 'n')
    const i = num(v, 'i') / 100
    const pv = num(v, 'pv')
    const pmt = num(v, 'pmt')
    const fv = num(v, 'fv')
    const b = inicio ? 1 : 0
    const fator = i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i
    const passos = ['PV + PMT·(1 + i·b)·[1 − (1 + i)^−n]/i + FV·(1 + i)^−n = 0   (b = 1 se os pagamentos são no início)']
    let res: number | null
    let nome: string
    let fmt: (x: number) => string = brl
    if (f === 'fv') {
      res = -(pv + pmt * (1 + i * b) * fator) * Math.pow(1 + i, n)
      nome = 'FV (valor futuro)'
    } else if (f === 'pv') {
      res = -(pmt * (1 + i * b) * fator + fv * Math.pow(1 + i, -n))
      nome = 'PV (valor presente)'
    } else if (f === 'pmt') {
      res = -(pv + fv * Math.pow(1 + i, -n)) / ((1 + i * b) * fator)
      nome = 'PMT (parcela)'
    } else if (f === 'n') {
      res = resolverPrazo(i, pv, pmt, fv, inicio)
      nome = 'n (períodos)'
      fmt = (x) => fmtN(x, 2, 2)
    } else {
      res = resolverTaxa(n, pv, pmt, fv, inicio)
      nome = 'i (taxa por período)'
      fmt = (x) => fmtTaxa(x)
    }
    if (res === null || !Number.isFinite(res)) return { erro: 'Esses valores não têm solução. Confira os sinais: o que entra no caixa é positivo e o que sai é negativo.' }
    const valor = fmt(res)
    const linhas: Resultado['linhas'] = [{ rotulo: nome, valor, destaque: true }]
    if (f === 'n') linhas.push({ rotulo: 'Arredondando para cima', valor: `${Math.ceil(res - 1e-9)}` })
    if (f === 'pmt') linhas.push({ rotulo: 'Parcela em módulo', valor: brl(Math.abs(res)) })
    passos.push(`${nome} = ${valor}`)
    const teclas = (['n', 'i', 'pv', 'pmt', 'fv'] as const)
      .filter((c) => c !== f)
      .map((c) => `${v[c].trim()} ${c === 'pv' ? 'PV' : c === 'pmt' ? 'PMT' : c === 'fv' ? 'FV' : c}`)
    passos.push(`Na HP-12C (RPN): f CLEAR FIN, ${inicio ? 'g BEG, ' : 'g END, '}${teclas.join(', ')}, ${f === 'pv' ? 'PV' : f === 'pmt' ? 'PMT' : f === 'fv' ? 'FV' : f}`)
    return { linhas, passos }
  },
}

const rendaPerpetua: Problema = {
  id: 'rendaPerpetua',
  grupo: 'rendas',
  titulo: 'Renda perpétua e diferida',
  resumo: 'Valor presente de rendas sem fim e de rendas com carência.',
  campos: [
    { id: 'pmt', rotulo: 'Parcela PMT (R$)', tipo: 'numero' },
    { id: 'taxa', rotulo: 'Taxa por período (%)', tipo: 'numero' },
    { id: 'n', rotulo: 'Nº de parcelas (vazio = perpétua)', tipo: 'numero', vazio: true },
    { id: 'carencia', rotulo: 'Carência (períodos sem pagar; vazio = 0)', tipo: 'numero', vazio: true },
  ],
  exemplos: [
    { enunciado: 'Uma renda perpétua de R$ 2.000 por mês, a 1% ao mês, com a primeira daqui a um mês. Qual o valor presente?', valores: { pmt: '2000', taxa: '1', n: '', carencia: '' } },
    { enunciado: 'Qual o valor presente de 10 parcelas de R$ 1.000, a 2% ao mês, com carência de 3 meses (diferida)?', valores: { pmt: '1000', taxa: '2', n: '10', carencia: '3' } },
  ],
  resolver(v) {
    const pmt = num(v, 'pmt')
    const i = num(v, 'taxa') / 100
    if ([pmt, i].some(Number.isNaN) || i <= 0) return { erro: 'Preencha parcela e uma taxa maior que zero.' }
    const carencia = vazio(v, 'carencia') ? 0 : num(v, 'carencia')
    if (Number.isNaN(carencia)) return { erro: 'Confira a carência.' }
    const desc = Math.pow(1 + i, -carencia)
    if (vazio(v, 'n')) {
      const pv = (pmt / i) * desc
      return {
        linhas: [
          { rotulo: 'Valor presente (postecipada)', valor: brl(pv), destaque: true },
          { rotulo: 'Valor presente (antecipada)', valor: brl(pv * (1 + i)) },
        ],
        passos: ['Perpétua postecipada: PV = PMT / i', 'Perpétua antecipada: PV = PMT · (1 + i) / i', carencia ? `Com carência: multiplica por (1 + i)^−${fmtN(carencia, 0, 4)}` : 'Sem carência.'],
      }
    }
    const n = num(v, 'n')
    if (Number.isNaN(n)) return { erro: 'Confira o número de parcelas.' }
    const pv = pmt * ((1 - Math.pow(1 + i, -n)) / i) * desc
    return {
      linhas: [{ rotulo: 'Valor presente (postecipada diferida)', valor: brl(pv), destaque: true }],
      passos: ['PV = PMT · [1 − (1 + i)^−n] / i · (1 + i)^−m', `= ${fmtN(pmt)} · ${fmtN((1 - Math.pow(1 + i, -n)) / i, 4, 6)} · ${fmtN(desc, 4, 6)} = ${fmtN(pv)}`],
    }
  },
}

const analiseInvest: Problema = {
  id: 'analiseInvest',
  grupo: 'investimentos',
  titulo: 'VPL, TIR, TIRM, payback e lucratividade',
  resumo: 'Digite o fluxo de caixa (o investimento inicial é negativo) e a taxa mínima de atratividade.',
  campos: [
    { id: 'fluxo', rotulo: 'Fluxo de caixa (R$), do período 0 em diante, separado por ponto e vírgula', tipo: 'lista', ajuda: 'Ex.: -10000; 4000; 4000; 4000' },
    { id: 'tma', rotulo: 'Taxa mínima de atratividade, TMA (% por período)', tipo: 'numero' },
  ],
  exemplos: [
    { enunciado: 'Um projeto custa R$ 10.000 e paga R$ 4.000 ao fim de cada um de 4 anos. Com TMA de 10% ao ano, vale a pena?', valores: { fluxo: '-10000; 4000; 4000; 4000; 4000', tma: '10' } },
    { enunciado: 'Investimento de R$ 50.000, com retornos de 20.000, 25.000 e 30.000. TMA de 12%.', valores: { fluxo: '-50000; 20000; 25000; 30000', tma: '12' } },
  ],
  resolver(v) {
    const fluxo = lerLista(v.fluxo)
    const tma = num(v, 'tma') / 100
    if (fluxo.length < 2 || fluxo.some(Number.isNaN) || Number.isNaN(tma)) return { erro: 'Digite o fluxo de caixa (ao menos dois valores) e a TMA.' }
    if (fluxo[0] >= 0) return { erro: 'O primeiro valor do fluxo deve ser o investimento inicial, negativo.' }
    const v0 = vpl(tma, fluxo)
    const t = tir(fluxo)
    const invest = -fluxo[0]
    const vpEntradas = fluxo.slice(1).reduce((s, c, k) => s + Math.max(c, 0) / Math.pow(1 + tma, k + 1), 0)
    // TIRM: saídas descontadas e entradas capitalizadas, ambas à TMA.
    const n = fluxo.length - 1
    const vpSaidas = fluxo.reduce((s, c, k) => s + (c < 0 ? -c / Math.pow(1 + tma, k) : 0), 0)
    const vfEntradas = fluxo.reduce((s, c, k) => s + (c > 0 ? c * Math.pow(1 + tma, n - k) : 0), 0)
    const tirm = Math.pow(vfEntradas / vpSaidas, 1 / n) - 1
    let acc = fluxo[0]
    let paybackSimples: string = 'não recupera'
    for (let k = 1; k < fluxo.length; k++) {
      const antes = acc
      acc += fluxo[k]
      if (acc >= 0) {
        paybackSimples = `${fmtN(k - 1 + (-antes / fluxo[k]), 2, 2)} períodos`
        break
      }
    }
    let accD = fluxo[0]
    let paybackDesc: string = 'não recupera'
    for (let k = 1; k < fluxo.length; k++) {
      const antes = accD
      const vp = fluxo[k] / Math.pow(1 + tma, k)
      accD += vp
      if (accD >= 0) {
        paybackDesc = `${fmtN(k - 1 + (-antes / vp), 2, 2)} períodos`
        break
      }
    }
    return {
      linhas: [
        { rotulo: 'VPL', valor: brl(v0), destaque: true },
        { rotulo: 'TIR', valor: t === null ? 'sem solução' : fmtTaxa(t), destaque: true },
        { rotulo: 'TIRM', valor: Number.isFinite(tirm) ? fmtTaxa(tirm) : 'sem solução' },
        { rotulo: 'Payback simples', valor: paybackSimples },
        { rotulo: 'Payback descontado', valor: paybackDesc },
        { rotulo: 'Índice de lucratividade (VP das entradas / investimento)', valor: fmtN(vpEntradas / invest, 2, 4) },
        { rotulo: 'Taxa de rentabilidade (VPL / investimento)', valor: fmtTaxa(v0 / invest) },
        { rotulo: 'Leitura', valor: v0 > 0 ? 'VPL positivo: o projeto cobre a TMA, aceitar' : v0 < 0 ? 'VPL negativo: o projeto não cobre a TMA, rejeitar' : 'VPL zero: indiferente' },
      ],
      passos: ['VPL = Σ Fₜ / (1 + TMA)ᵗ', 'TIR é a taxa que zera o VPL (aceitar se TIR > TMA)', 'TIRM: capitaliza as entradas e desconta as saídas à TMA; TIRM = (VF entradas / VP saídas)^(1/n) − 1', 'IL = VP das entradas / investimento;  taxa de rentabilidade = VPL / investimento = IL − 1'],
    }
  },
}

const amortizacao: Problema = {
  id: 'amortizacao',
  grupo: 'amortizacao',
  titulo: 'Sistemas de amortização (SAC, Price, SAM, Americano)',
  resumo: 'Planilha com juros, amortização, prestação e saldo devedor.',
  campos: [
    { id: 'saldo', rotulo: 'Valor financiado (R$)', tipo: 'numero' },
    { id: 'taxa', rotulo: 'Taxa por período (%)', tipo: 'numero' },
    { id: 'prazo', rotulo: 'Número de prestações', tipo: 'numero' },
    {
      id: 'sistema',
      rotulo: 'Sistema',
      tipo: 'escolha',
      padrao: 'sac',
      opcoes: [
        { valor: 'sac', rotulo: 'SAC (amortização constante)' },
        { valor: 'price', rotulo: 'Francês / Tabela Price (prestação constante)' },
        { valor: 'sam', rotulo: 'SAM (média entre SAC e Price)' },
        { valor: 'americano', rotulo: 'Americano (só juros e, no fim, o principal)' },
      ],
    },
  ],
  exemplos: [
    { enunciado: 'Um empréstimo de R$ 12.000 a 2% ao mês em 4 prestações pelo SAC. Monte a planilha.', valores: { saldo: '12000', taxa: '2', prazo: '4', sistema: 'sac' } },
    { enunciado: 'Um financiamento de R$ 100.000 em 5 prestações anuais de 10% ao ano pela Tabela Price.', valores: { saldo: '100000', taxa: '10', prazo: '5', sistema: 'price' } },
  ],
  resolver(v) {
    const S = num(v, 'saldo')
    const i = num(v, 'taxa') / 100
    const n = Math.round(num(v, 'prazo'))
    if ([S, i, n].some(Number.isNaN) || n < 1 || n > 600) return { erro: 'Preencha valor, taxa e um número de prestações entre 1 e 600.' }
    const sis = v.sistema ?? 'sac'
    const priceP = i === 0 ? S / n : (S * i) / (1 - Math.pow(1 + i, -n))
    if (sis === 'sam') return samTabela(S, i, n, priceP)
    const linhas: string[][] = []
    let saldo = S
    let totJ = 0
    let totP = 0
    for (let k = 1; k <= n; k++) {
      const j = saldo * i
      const am = sis === 'sac' ? S / n : sis === 'price' ? priceP - j : k === n ? S : 0
      saldo -= am
      totJ += j
      totP += j + am
      linhas.push([String(k), fmtN(j), fmtN(am), fmtN(j + am), fmtN(Math.max(saldo, 0))])
    }
    const desc: Record<string, string> = {
      sac: 'Amortização constante A = S/n; juros decrescentes; prestação decrescente.',
      price: 'Prestação constante P = S·i / [1 − (1 + i)^−n]; juros decrescentes; amortização crescente.',
      americano: 'Paga só juros em cada período e devolve o principal inteiro na última prestação.',
    }
    return {
      linhas: [
        { rotulo: 'Total de juros', valor: brl(totJ), destaque: true },
        { rotulo: 'Total pago', valor: brl(totP) },
        { rotulo: 'Primeira prestação', valor: brl(Number(linhas[0][3].replace(/\./g, '').replace(',', '.'))) },
      ],
      passos: [desc[sis] ?? '', 'Juros do período = taxa · saldo devedor anterior;  prestação = juros + amortização;  novo saldo = saldo − amortização'],
      tabela: { cabecalho: ['Nº', 'Juros', 'Amortização', 'Prestação', 'Saldo devedor'], linhas },
    }
  },
}

function saldoSac(S: number, n: number, k: number) {
  return S - (S / n) * k
}
function samTabela(S: number, i: number, n: number, priceP: number): Resultado {
  const linhas: string[][] = []
  let saldo = S
  let totJ = 0
  let totP = 0
  for (let k = 1; k <= n; k++) {
    const jSac = saldoSac(S, n, k - 1) * i
    const pSac = S / n + jSac
    const pPrice = priceP
    const prest = (pSac + pPrice) / 2
    const j = saldo * i
    const am = prest - j
    saldo -= am
    totJ += j
    totP += prest
    linhas.push([String(k), fmtN(j), fmtN(am), fmtN(prest), fmtN(Math.max(saldo, 0))])
  }
  return {
    linhas: [
      { rotulo: 'Total de juros', valor: brl(totJ), destaque: true },
      { rotulo: 'Total pago', valor: brl(totP) },
    ],
    passos: ['SAM: cada prestação (e cada amortização) é a média aritmética entre a do SAC e a da Tabela Price.', 'Juros do período = taxa · saldo devedor anterior;  amortização = prestação − juros.'],
    tabela: { cabecalho: ['Nº', 'Juros', 'Amortização', 'Prestação', 'Saldo devedor'], linhas },
  }
}

export const PROBLEMAS: Problema[] = [
  jurosSimples,
  jurosCompostos,
  jurosExatos,
  capContinua,
  taxaEquivalente,
  nominalEfetiva,
  taxaAcumulada,
  taxaReal,
  desconto,
  hp12c,
  rendaPerpetua,
  analiseInvest,
  amortizacao,
]

export function problemaPorId(id: string) {
  return PROBLEMAS.find((p) => p.id === id)
}

export function valoresIniciais(p: Problema): Record<string, string> {
  const v: Record<string, string> = {}
  for (const c of p.campos) v[c.id] = c.padrao ?? ''
  return v
}

/** Todas as questões do banco, já com o problema a que pertencem. */
export function bancoDeQuestoes() {
  return PROBLEMAS.flatMap((p) => p.exemplos.map((e, k) => ({ id: `${p.id}-${k}`, problema: p, ...e })))
}
