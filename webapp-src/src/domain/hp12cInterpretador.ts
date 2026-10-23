/**
 * Sua HP12C: lê o enunciado falado ou digitado ("10 mil reais a 2% ao mês por 8 meses") e devolve qual problema do banco
 * resolve, já com os campos preenchidos. É uma leitura por palavras-chave e números, sem rede: a tela sempre mostra o que
 * foi entendido e deixa a pessoa corrigir os campos antes de calcular.
 */
import { PERIODOS, problemaPorId, valoresIniciais } from './matematicaFinanceira'

export type Interpretacao = { problemaId: string; valores: Record<string, string>; avisos: string[] }

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100,
}
const PALAVRA_NUM = Object.keys(UNIDADES).join('|')
const TEMPO = 'mes|meses|ano|anos|dia|dias|semestre|semestres|trimestre|trimestres|bimestre|bimestres|parcela|parcelas|prestacao|prestacoes|vezes'

export function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "vinte e cinco mil" → "25 mil"; "dois por cento" → "2 por cento"; "dois vírgula cinco" → "2,5". */
function numerosPorExtenso(t: string) {
  let s = t
  const dezenas = '(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)'
  s = s.replace(new RegExp(`\\b${dezenas} e (um|dois|tres|quatro|cinco|seis|sete|oito|nove)\\b`, 'g'), (_m, d: string, u: string) => String(UNIDADES[d] + UNIDADES[u]))
  s = s.replace(new RegExp(`\\b(${PALAVRA_NUM})\\b(?=\\s*(mil\\b|milhao|milhoes|%|por cento|virgula|${TEMPO}))`, 'g'), (m) => String(UNIDADES[m] ?? m))
  s = s.replace(/(\d+)\s*virgula\s*(\d+)/g, '$1,$2')
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(milhoes|milhao)\b/g, (_m, n: string) => String(Number(n.replace(/\./g, '').replace(',', '.')) * 1_000_000))
  s = s.replace(/(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*mil\b/g, (_m, n: string) => {
    const v = Number(/^\d{1,3}(\.\d{3})+$/.test(n) ? n.replace(/\./g, '') : n.replace(',', '.'))
    return String(v * 1000)
  })
  return s
}

type Token = { valor: number; inicio: number; fim: number; antes: string; depois: string; tipo: 'taxa' | 'tempo' | 'dinheiro'; unidade?: string; periodo?: string }

const PERIODO_PALAVRAS: [RegExp, string][] = [
  [/\b(ao dia|a\.?d\b|diari[ao]|diariamente)/, 'dia'],
  [/\b(ao mes|a\.?m\b|mensal|mensais|mensalmente|por mes)/, 'mes'],
  [/\b(ao bimestre|bimestral|bimestralmente)/, 'bimestre'],
  [/\b(ao trimestre|a\.?t\b|trimestral|trimestralmente)/, 'trimestre'],
  [/\b(ao quadrimestre|quadrimestral)/, 'quadrimestre'],
  [/\b(ao semestre|a\.?s\b|semestral|semestralmente)/, 'semestre'],
  [/\b(ao ano|a\.?a\b|anual|anualmente|por ano)/, 'ano'],
]

function periodoDe(trecho: string): string | undefined {
  let melhor: { id: string; pos: number } | undefined
  for (const [re, id] of PERIODO_PALAVRAS) {
    const m = re.exec(trecho)
    if (m && (!melhor || m.index < melhor.pos)) melhor = { id, pos: m.index }
  }
  return melhor?.id
}

function unidadeDe(palavra: string): string {
  if (palavra.startsWith('mes')) return 'mes'
  if (palavra.startsWith('ano')) return 'ano'
  if (palavra.startsWith('dia')) return 'dia'
  if (palavra.startsWith('semestre')) return 'semestre'
  if (palavra.startsWith('trimestre')) return 'trimestre'
  if (palavra.startsWith('bimestre')) return 'bimestre'
  return 'periodo'
}

function extrair(t: string): Token[] {
  const tokens: Token[] = []
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) {
    const bruto = m[0]
    const valor = Number(bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(bruto) ? bruto.replace(/\./g, '') : bruto)
    const inicio = m.index
    const fim = inicio + bruto.length
    const depois = t.slice(fim, fim + 34)
    const antes = t.slice(Math.max(0, inicio - 30), inicio)
    const negativo = t[inicio - 1] === '-'
    const base: Token = { valor: negativo ? -valor : valor, inicio, fim, antes, depois, tipo: 'dinheiro' }
    const ehTaxa = /^\s*(%|por\s*cento)/.test(depois) || /^\s*(a\.?\s?[madst]\b|ao (mes|ano|dia|semestre|trimestre|bimestre|quadrimestre))/.test(depois)
    const tempo = new RegExp(`^\\s*(${TEMPO})\\b`).exec(depois)
    if (ehTaxa) tokens.push({ ...base, tipo: 'taxa', periodo: periodoDe(depois.replace(/^\s*(%|por\s*cento)\s*/, '')) })
    else if (tempo) tokens.push({ ...base, tipo: 'tempo', unidade: unidadeDe(tempo[1]) })
    else tokens.push(base)
  }
  return tokens
}

function s(n: number) {
  return String(Math.round(n * 1e8) / 1e8).replace('.', ',')
}

const PALAVRAS_PROBLEMA: Record<string, [RegExp, number][]> = {
  jurosSimples: [[/juros simples|capitalizacao simples|regime simples/, 12], [/\bsimples\b/, 4]],
  jurosCompostos: [[/juros compostos|capitalizacao composta|regime composto/, 12], [/\bcompost[oa]/, 5], [/dobr|tripl/, 2]],
  jurosExatos: [[/juros exatos|ano comercial|ano civil|juros comerciais/, 12], [/\bexato/, 5]],
  capContinua: [[/continu/, 12], [/convencao (linear|exponencial)/, 12]],
  taxaEquivalente: [[/equivalente/, 10], [/proporcional/, 8]],
  nominalEfetiva: [[/nominal/, 7], [/efetiva/, 5], [/capitaliz/, 3]],
  taxaAcumulada: [[/acumulad/, 8], [/inflacao.*(mes|meses)|meses seguidos/, 3]],
  taxaReal: [[/taxa real|ganho real|rentabilidade real|juro real/, 12], [/inflacao/, 6], [/aparente/, 7]],
  desconto: [[/desconto|descontad|duplicata|antecipar (o )?titulo/, 12], [/titulo|valor nominal|vencimento|face/, 3]],
  hp12c: [[/parcela|prestac|mensalidade|financi|quitar|anuidade|renda certa|renda uniforme/, 6], [/deposit|poupar|juntar|aposenta/, 5], [/\bhp\b|12c/, 8], [/a vista/, 3]],
  rendaPerpetua: [[/perpetu/, 14], [/carencia|diferida/, 14]],
  analiseInvest: [[/\bvpl\b|valor presente liquido|\btir\b|taxa interna|payback|atratividade|\btma\b|lucratividade|\btirm\b/, 14], [/projeto|fluxo de caixa/, 4]],
  amortizacao: [[/\bsac\b|\bsam\b|\bprice\b|tabela price|sistema frances|sistema de amortizacao|amortizacao|\bamericano\b|saldo devedor/, 14]],
}

function escolherProblema(t: string, tokens: Token[]): { id: string; aviso?: string } | null {
  const pontos: Record<string, number> = {}
  for (const [id, regras] of Object.entries(PALAVRAS_PROBLEMA)) {
    pontos[id] = regras.reduce((soma, [re, peso]) => soma + (re.test(t) ? peso : 0), 0)
  }
  const taxas = tokens.filter((k) => k.tipo === 'taxa').length
  if (taxas >= 2 && /acumulad|inflacao/.test(t) && !/aparente|real\b/.test(t)) pontos.taxaAcumulada += 6
  // Quando o enunciado fala em prestação/financiamento, a HP12C vale mais do que juros compostos genérico.
  if (pontos.hp12c > 0 && pontos.jurosCompostos < 12 && pontos.jurosSimples < 12) pontos.hp12c += 2
  const ordenado = Object.entries(pontos).sort((a, b) => b[1] - a[1])
  if (ordenado[0][1] > 0) return { id: ordenado[0][0] }
  const temTaxa = taxas > 0
  const temTempo = tokens.some((k) => k.tipo === 'tempo')
  if (temTaxa && temTempo && /juros|rend|aplic|invest|montante|emprest/.test(t)) {
    return { id: 'jurosCompostos', aviso: 'Você não disse se os juros são simples ou compostos. Usei juros compostos; se for simples, troque o tema.' }
  }
  return null
}

export function converterPrazo(valor: number, de: string | undefined, para: string | undefined) {
  if (!de || !para || de === 'periodo') return valor
  const mDe = PERIODOS.find((p) => p.valor === de)?.meses ?? 1
  const mPara = PERIODOS.find((p) => p.valor === para)?.meses ?? 1
  return Math.round(((valor * mDe) / mPara) * 1e6) / 1e6
}

const ROTULO_UNIDADE: Record<string, string> = { mes: 'mês(es)', ano: 'ano(s)', dia: 'dia(s)', semestre: 'semestre(s)', trimestre: 'trimestre(s)', bimestre: 'bimestre(s)' }

export function interpretar(texto: string): Interpretacao | null {
  const t = numerosPorExtenso(normalizar(texto))
  const tokens = extrair(t)
  if (tokens.length === 0) return null
  const escolha = escolherProblema(t, tokens)
  if (!escolha) return null
  const problema = problemaPorId(escolha.id)
  if (!problema) return null
  const avisos: string[] = escolha.aviso ? [escolha.aviso] : []
  const valores = valoresIniciais(problema)
  const taxas = tokens.filter((k) => k.tipo === 'taxa')
  const tempos = tokens.filter((k) => k.tipo === 'tempo')
  const dinheiros = tokens.filter((k) => k.tipo === 'dinheiro')
  const taxa = taxas[0]

  const prazoConvertido = (k: Token | undefined, paraPeriodo: string | undefined) => {
    if (!k) return undefined
    const conv = converterPrazo(k.valor, k.unidade, paraPeriodo)
    if (conv !== k.valor && paraPeriodo) avisos.push(`Converti ${s(k.valor)} ${ROTULO_UNIDADE[k.unidade ?? ''] ?? ''} para ${s(conv)} na unidade da taxa (${PERIODOS.find((p) => p.valor === paraPeriodo)?.rotulo}).`)
    return conv
  }
  const ehMontante = (k: Token) => /(resgat|vira|viram|transform|chegar|obter|ter\b|valor futuro|juntar)/.test(k.antes) || (dinheiros.length > 1 && /(montante|total)/.test(k.antes))
  const ehCapital = (k: Token) => /(capital|principal|invest|aplic|empresta|deposit|tomei|valor de|\bde r\$)/.test(k.antes)

  switch (escolha.id) {
    case 'jurosSimples':
    case 'jurosCompostos':
    case 'capContinua': {
      let capital = dinheiros.find(ehCapital) ?? dinheiros.find((k) => !ehMontante(k))
      let montante = dinheiros.find((k) => k !== capital && ehMontante(k)) ?? dinheiros.find((k) => k !== capital)
      if (!capital && montante) {
        capital = undefined
      }
      if (capital) valores.capital = s(capital.valor)
      if (escolha.id !== 'capContinua' && montante) valores.montante = s(montante.valor)
      if (capital && /dobr/.test(t) && !montante) valores.montante = s(capital.valor * 2)
      if (capital && /tripl/.test(t) && !montante) valores.montante = s(capital.valor * 3)
      if (taxa) valores.taxa = s(taxa.valor)
      const p = prazoConvertido(tempos[0], taxa?.periodo)
      if (p !== undefined) valores.prazo = s(p)
      break
    }
    case 'jurosExatos': {
      if (dinheiros[0]) valores.capital = s(dinheiros[0].valor)
      if (taxa) valores.taxa = s(taxa.periodo === 'mes' ? taxa.valor * 12 : taxa.valor)
      const d = tempos[0]
      if (d) valores.dias = s(converterPrazo(d.valor, d.unidade, 'dia'))
      break
    }
    case 'taxaEquivalente': {
      if (taxa) valores.taxa = s(taxa.valor)
      const mencionados: string[] = []
      const re = /\b(dia|diari\w*|mes|mensa\w*|bimestr\w*|trimestr\w*|quadrimestr\w*|semestr\w*|ano|anua\w*)\b/g
      let m: RegExpExecArray | null
      while ((m = re.exec(t)) !== null) mencionados.push(periodoDe(`ao ${m[1]}`) ?? periodoDe(m[1]) ?? '')
      const de = taxa?.periodo ?? mencionados.find((p) => p) ?? 'mes'
      const para = [...mencionados].reverse().find((p) => p && p !== de) ?? (de === 'mes' ? 'ano' : 'mes')
      valores.de = de
      valores.para = para
      break
    }
    case 'nominalEfetiva': {
      if (taxa) valores.taxa = s(taxa.valor)
      valores.periodoNominal = taxa?.periodo ?? 'ano'
      const cap = /capitaliz\w*\s+(?:ao\s+|a cada\s+)?(\w+)/.exec(t)
      const per = cap ? (periodoDe(`ao ${cap[1]}`) ?? periodoDe(cap[1])) : undefined
      valores.capitalizacao = per ?? 'mes'
      break
    }
    case 'taxaAcumulada':
      valores.taxas = taxas.map((k) => s(k.valor)).join('; ')
      break
    case 'taxaReal': {
      const livres: Token[] = []
      for (const k of taxas) {
        const ctx = `${k.antes} ${k.depois.slice(0, 14)}`
        if (/inflac/.test(ctx)) valores.inflacao = s(k.valor)
        else if (/\breal\b|ganho real/.test(ctx)) valores.real = s(k.valor)
        else if (/aparente|nominal|rend|rentab|cdb|poupanca|aplic|juro/.test(ctx)) valores.aparente = s(k.valor)
        else livres.push(k)
      }
      for (const k of livres) {
        if (!valores.aparente) valores.aparente = s(k.valor)
        else if (!valores.inflacao) valores.inflacao = s(k.valor)
        else if (!valores.real) valores.real = s(k.valor)
      }
      break
    }
    case 'desconto': {
      const nominal = dinheiros.find((k) => /(titulo|nominal|face|duplicata|valor)/.test(k.antes)) ?? dinheiros[0]
      if (nominal) valores.nominal = s(nominal.valor)
      if (taxa) valores.taxa = s(taxa.valor)
      const p = prazoConvertido(tempos[0], taxa?.periodo)
      if (p !== undefined) valores.prazo = s(p)
      break
    }
    case 'hp12c': {
      let pv: number | undefined
      let pmt: number | undefined
      let fv: number | undefined
      for (const k of dinheiros) {
        const ctx = k.antes
        if (/(parcela|prestac|deposit|pagament|mensalidade|aporte)/.test(ctx) && pmt === undefined) pmt = Math.abs(k.valor)
        else if (/(montante|futuro|resgat|\bter\b|juntar|poupar|acumul|meta|objetivo|saldo final)/.test(ctx) && fv === undefined) fv = Math.abs(k.valor)
        else if (pv === undefined) pv = Math.abs(k.valor)
        else if (pmt === undefined) pmt = Math.abs(k.valor)
        else if (fv === undefined) fv = Math.abs(k.valor)
      }
      const n = tempos[0] ? prazoConvertido(tempos[0], taxa?.periodo) : undefined
      const dado: Record<'n' | 'i' | 'pv' | 'pmt' | 'fv', number | undefined> = { n, i: taxa?.valor, pv, pmt, fv }
      const chaves = ['n', 'i', 'pv', 'pmt', 'fv'] as const
      const faltam: (typeof chaves)[number][] = chaves.filter((c) => dado[c] === undefined)
      let desconhecido: (typeof chaves)[number] | undefined
      if (faltam.length === 1) desconhecido = faltam[0]
      else if (!faltam.includes('n') && !faltam.includes('i')) {
        // Sobrou só dinheiro: o que não foi dito vale zero e a incógnita é a parcela, salvo se só a parcela foi dada.
        if (pmt !== undefined && pv === undefined && fv === undefined) {
          const querPv = /financ|vista|empresta|divida|quanto posso|valor presente|hoje/.test(t)
          desconhecido = querPv ? 'pv' : 'fv'
        } else desconhecido = 'pmt'
      } else {
        const zerar = faltam.includes('pmt') && pv !== undefined && fv !== undefined ? 'pmt' : (['fv', 'pv', 'pmt'] as const).find((c) => faltam.includes(c))
        if (zerar) {
          dado[zerar] = 0
          faltam.splice(faltam.indexOf(zerar), 1)
        }
        desconhecido = faltam.length === 1 ? faltam[0] : undefined
      }
      const campos: ('pv' | 'pmt' | 'fv')[] = ['pv', 'pmt', 'fv']
      for (const c of campos) if (c !== desconhecido && dado[c] === undefined) dado[c] = 0
      // Convenção da HP12C: o que entra no caixa é positivo, a parcela tem sinal contrário ao do valor presente (ou ao do futuro).
      const sinalPmt = -1
      if (dado.pv && dado.fv && dado.pmt === 0) dado.fv = -dado.fv
      valores.n = dado.n !== undefined ? s(dado.n) : ''
      valores.i = dado.i !== undefined ? s(dado.i) : ''
      valores.pv = dado.pv !== undefined ? s(dado.pv) : ''
      valores.pmt = dado.pmt !== undefined ? s(dado.pmt === 0 ? 0 : sinalPmt * dado.pmt) : ''
      valores.fv = dado.fv !== undefined ? s(dado.fv) : ''
      if (desconhecido) valores[desconhecido] = ''
      valores.modo = /antecipad|com entrada|no inicio|ato da compra|primeira parcela (no ato|hoje|a vista)/.test(t) ? 'inicio' : 'fim'
      break
    }
    case 'rendaPerpetua': {
      if (dinheiros[0]) valores.pmt = s(dinheiros[0].valor)
      if (taxa) valores.taxa = s(taxa.valor)
      const car = /(\d+(?:[.,]\d+)?)\s*(?:mes\w*|ano\w*|period\w*)?\s*de\s*carencia|carencia\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/.exec(t)
      let tempoCarencia: Token | undefined
      if (car) {
        const v = Number((car[1] ?? car[2]).replace(',', '.'))
        tempoCarencia = tempos.find((k) => k.valor === v)
        valores.carencia = s(prazoConvertido(tempoCarencia, taxa?.periodo) ?? v)
      }
      const resto = tempos.filter((k) => k !== tempoCarencia)
      if (!/perpetu/.test(t) && resto[0]) valores.n = s(prazoConvertido(resto[0], taxa?.periodo) ?? resto[0].valor)
      break
    }
    case 'analiseInvest': {
      const fluxo: number[] = []
      dinheiros.forEach((k, idx) => {
        const investimento = idx === 0 && k.valor > 0 && /invest|custa|custo|aporte inicial|desembols|inicial/.test(`${k.antes} ${t.slice(0, k.inicio)}`)
        fluxo.push(investimento ? -k.valor : k.valor)
      })
      valores.fluxo = fluxo.map(s).join('; ')
      if (taxa) valores.tma = s(taxa.valor)
      break
    }
    case 'amortizacao': {
      if (dinheiros[0]) valores.saldo = s(dinheiros[0].valor)
      if (taxa) valores.taxa = s(taxa.valor)
      const p = prazoConvertido(tempos[0], taxa?.periodo)
      if (p !== undefined) valores.prazo = s(p)
      valores.sistema = /\bsac\b|constante/.test(t) ? 'sac' : /\bsam\b|misto/.test(t) ? 'sam' : /americano|bullet/.test(t) ? 'americano' : /price|frances/.test(t) ? 'price' : 'sac'
      break
    }
  }
  return { problemaId: escolha.id, valores, avisos }
}
