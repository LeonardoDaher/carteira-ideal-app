// Minha Carteira (D36): lê uma NOTA DE NEGOCIAÇÃO no layout SINACOR (o padrão das corretoras
// brasileiras) a partir das linhas já extraídas do PDF (ver pdf.ts).
//
// Três coisas que a nota tem e os extratos da B3 não:
//   1) CADA execução (a B3 agrega: 5 + 7 cotas de HGBS11 viram 12 no extrato de Negociação);
//   2) as TAXAS (liquidação, emolumentos, corretagem...), que entram no preço médio e no IR;
//   3) TOTAIS próprios, que permitem ao parser se AUTOVERIFICAR: se as contas não fecham, a
//      leitura é recusada em vez de aceitar um número errado em silêncio.
//
// O que a nota NÃO tem: o TICKER das ações. Ela imprime o "nome de pregão" + espécie, por
// exemplo "CSNMINERACAO ON N2" (= CMIN3). Só os fundos trazem o ticker no texto ("FII HEDGEBS
// HGBS11 CI"). Por isso há resolvedores de ticker: por tabela de nomes de pregão e por
// cruzamento com os negócios já importados do extrato de Negociação do mesmo dia.
//
// Layout conferido contra UMA nota real, em imagens do cabeçalho e do corpo (nunca contra o texto
// do PDF real): o número da nota e a data do pregão ficam em caixas no canto direito, com o rótulo
// numa linha e o valor logo abaixo. Ainda não vimos: nota de várias páginas, com venda, com
// day trade ou com opções.
//
// PRIVACIDADE: o cabeçalho traz nome, CPF, endereço, telefone e conta do cliente. Este módulo lê
// SOMENTE o número da nota e a data do pregão; nada mais do cabeçalho é lido, guardado ou devolvido
// (há teste que garante isso).
//
// Módulo puro: recebe LinhaPdf[], não abre PDF nem lê arquivo.
import { somarDiasUteis, type LancamentoNovo } from '../lancamentos'
import { lerData, normalizarCabecalho } from './celulas'
import type { CelulaPdf, LinhaPdf } from './pdf'

export class NotaNaoReconhecidaError extends Error {
  constructor(motivo = 'Não encontramos a tabela "Negócios realizados" de uma nota de negociação neste PDF.') {
    super(motivo)
    this.name = 'NotaNaoReconhecidaError'
  }
}

/** vista = ação, FII, ETF, BDR no mercado à vista ou fracionário (o único que o app importa). */
export type CategoriaMercado = 'vista' | 'opcao' | 'exercicio' | 'termo' | 'outro'

export function categoriaDoMercado(mercado: string): CategoriaMercado {
  if (/VISTA|FRACIONARIO/.test(mercado)) return 'vista'
  if (/EXERC/.test(mercado)) return 'exercicio'
  if (/OPCAO|OPC\b/.test(mercado)) return 'opcao'
  if (/TERMO/.test(mercado)) return 'termo'
  return 'outro'
}

export interface NegocioNota {
  compraVenda: 'C' | 'V'
  /** Texto do mercado como impresso na nota: VISTA, FRACIONARIO, OPCAO DE VENDA... */
  mercado: string
  categoria: CategoriaMercado
  /** Especificação do título como impressa: "CSNMINERACAO ON N2", "FII HEDGEBS HGBS11 CI". */
  especificacao: string
  /** Ticker, quando impresso na especificação (fundos). Ações vêm sem ticker. */
  ticker: string | null
  /** Nome de pregão, sem espécie/nível: "CSNMINERACAO". */
  nome: string
  /** Espécie e nível: "ON N2". */
  especie: string
  /** Marcas da coluna Obs. (ex.: "D" = day trade). Não interpretadas, exceto day trade. */
  observacoes: string
  quantidade: number
  preco: number
  valor: number
  /** D = débito (a pessoa paga), C = crédito. */
  debitoCredito: 'D' | 'C' | null
  /** Linha do PDF (para mensagens de erro). */
  pagina: number
}

export interface ValorComSinal {
  valor: number
  dc: 'D' | 'C' | null
}

/** Quanto sai (positivo) ou entra (negativo) do bolso da pessoa. Sem D/C, assume débito. */
export function comSinal(v: ValorComSinal | undefined): number {
  if (!v) return 0
  return v.dc === 'C' ? -v.valor : v.valor
}

export interface ResumoNota {
  comprasAVista?: number
  vendasAVista?: number
  opcoesCompras?: number
  opcoesVendas?: number
  valorLiquidoOperacoes?: ValorComSinal
  taxaLiquidacao?: ValorComSinal
  taxaRegistro?: ValorComSinal
  totalCblc?: ValorComSinal
  taxaTermoOpcoes?: ValorComSinal
  taxaAna?: ValorComSinal
  emolumentos?: ValorComSinal
  taxaTransfAtivos?: ValorComSinal
  totalBovespa?: ValorComSinal
  taxaOperacional?: ValorComSinal // corretagem
  execucao?: ValorComSinal
  taxaCustodia?: ValorComSinal
  impostos?: ValorComSinal
  irrf?: ValorComSinal
  outros?: ValorComSinal
  totalCustos?: ValorComSinal
  liquido?: ValorComSinal
  /** Data de liquidação ("Líquido para 02/10/2026"), AAAA-MM-DD. */
  dataLiquidacao?: string
}

export interface Verificacao {
  nome: string
  esperado: number
  obtido: number
  ok: boolean
}

export interface NotaNegociacao {
  numero: string | null
  /** Data do pregão (AAAA-MM-DD). null só se não foi possível determinar. */
  dataPregao: string | null
  /** Como a data do pregão foi obtida. 'deduzida' = liquidação − 2 dias úteis (não vale com feriado). */
  origemDataPregao: 'cabecalho' | 'deduzida' | 'nenhuma'
  negocios: NegocioNota[]
  resumo: ResumoNota
  verificacoes: Verificacao[]
  /** true = as contas da nota fecham com o que foi lido. Sem isso, não importe. */
  conferida: boolean
  avisos: string[]
}

const TOLERANCIA = 0.011

// ---------- utilidades de célula ----------
const norm = (t: string) => normalizarCabecalho(t)
/** Valor monetário, com D/C opcional colado (o PDF às vezes funde "322,50" e "C" numa célula só). */
const RE_VALOR_DC = /^(-?\d[\d.]*,\d{2})(?:\s+([DC]))?$/
/** Fim de uma linha de negócio: quantidade, preço, valor da operação e D/C, qualquer que seja o agrupamento em células. */
const RE_CAUDA = /^(\d[\d.]*)\s+(\d[\d.]*,\d{1,6})\s+(\d[\d.]*,\d{2})(?:\s+([DC]))?$/
const RE_OBS = /^[@#*]{1,3}[A-Z0-9]?$|^[A-Z0-9]$/
const RE_BOVESPA = /^\d-?BOVESPA$/
const MERCADO_PALAVRAS = new Set(['VISTA', 'FRACIONARIO', 'OPCAO', 'OPC', 'DE', 'COMPRA', 'VENDA', 'TERMO', 'EXERC', 'EXERCICIO', 'LEILAO', 'FUTURO'])
/** Prazo de opções vem como mês/ano ("08/26"), que não é uma data completa. */
const RE_PRAZO_MES = /^\d{2}\/\d{2}$/

function num(t: string): number {
  return Number(t.replace(/\./g, '').replace(',', '.'))
}

const arred = (n: number) => Math.round(n * 100) / 100

// ---------- negócios ----------
const ESPECIES = new Set([
  'ON', 'PN', 'PNA', 'PNB', 'PNC', 'PND', 'PNE', 'PNF', 'PNG', 'PNH', 'UNT', 'CI', 'DR1', 'DR2', 'DR3', 'DRN', 'ED', 'EJ', 'CDA', 'RET',
  'NM', 'N1', 'N2', 'MB', 'MA', 'M2', 'MN', 'DR', 'EDJ',
  // direitos de subscrição: "BRADESCO DO 15,43" = direito ON com preço de exercício de 15,43
  'DO', 'DP', 'DPA', 'DPB',
])
const DIREITOS = new Set(['DO', 'DP', 'DPA', 'DPB'])

/** Separa nome de pregão de espécie/nível: "CSNMINERACAO ON N2" -> ["CSNMINERACAO", "ON N2"]. */
export function separarEspecificacao(spec: string): { nome: string; especie: string; ticker: string | null } {
  const tokens = spec.trim().split(/\s+/).filter(Boolean)
  const ticker = tokens.map((t) => t.toUpperCase()).find((t) => /^[A-Z]{4}\d{1,2}$/.test(t) && !ESPECIES.has(t)) ?? null
  let fim = tokens.length
  for (;;) {
    const t = tokens[fim - 1]?.toUpperCase()
    if (t && ESPECIES.has(t)) fim--
    // "DO 15,43": o preço de exercício vem depois do código do direito e faz parte da espécie
    else if (t && /^\d+(,\d+)?$/.test(t) && fim > 1 && DIREITOS.has(tokens[fim - 2].toUpperCase())) fim -= 2
    else break
  }
  const especie = tokens.slice(fim).join(' ').toUpperCase()
  const nomeTokens = tokens.slice(0, fim).filter((t) => t.toUpperCase() !== ticker)
  return { nome: nomeTokens.join(' ').toUpperCase(), especie, ticker }
}

/** Chave para casar "nome de pregão + espécie" com um ticker numa tabela. */
export function chaveNomePregao(nome: string, especie: string): string {
  return `${norm(nome).replace(/\s+/g, '')}|${norm(especie).replace(/\s+/g, ' ')}`
}

function linhaDeNegocio(cells: CelulaPdf[], obsHeader: CelulaPdf | null, pagina: number): NegocioNota | string | null {
  const iBov = cells.findIndex((c) => RE_BOVESPA.test(norm(c.texto).replace(/\s/g, '')))
  if (iBov < 0) return null
  const rest = cells.slice(iBov + 1)
  const cv = rest[0] ? norm(rest[0].texto) : ''
  if (cv !== 'C' && cv !== 'V') return 'não achei C/V logo depois de 1-BOVESPA'
  // O mercado ("VISTA", "FRACIONARIO", "OPCAO DE VENDA"...) pode vir numa célula, em várias, ou
  // COLADO ao texto seguinte: o pdf.js funde textos próximos ("OPCAO DE VENDA 08/26" vira um só).
  // Por isso consumimos palavra a palavra e, se a célula tem mais coisa depois do mercado, ela é
  // cortada ali e o resto segue como célula própria.
  const resto = rest.slice(1).map((c) => ({ ...c }))
  const palavrasMercado: string[] = []
  while (resto.length) {
    const palavras = resto[0].texto.trim().split(/\s+/)
    let k = 0
    while (k < palavras.length && MERCADO_PALAVRAS.has(norm(palavras[k]))) k++
    if (k === 0) break
    palavrasMercado.push(...palavras.slice(0, k).map(norm))
    if (k === palavras.length) {
      resto.shift()
      continue
    }
    const consumido = palavras.slice(0, k).join(' ').length
    const total = resto[0].texto.trim().length
    const { x, xFim } = resto[0]
    resto[0] = { x: x + ((xFim - x) * consumido) / total, xFim, texto: palavras.slice(k).join(' ') }
    break
  }
  const mercado = palavrasMercado.join(' ')
  if (!mercado) return 'não achei o tipo de mercado'

  // O fim da linha é quantidade, preço, valor e D/C. Procuramos, da direita para a esquerda, quantas
  // células formam esse trecho: funciona se o PDF separar cada número ou fundir "1.000,00 D" numa só.
  const cauda = resto
  let m: RegExpMatchArray | null = null
  let usadas = 0
  for (let n = 1; n <= Math.min(cauda.length, 6); n++) {
    const r = cauda
      .slice(cauda.length - n)
      .map((c) => c.texto.trim())
      .join(' ')
      .match(RE_CAUDA)
    if (r) {
      m = r
      usadas = n
      break
    }
  }
  if (!m) return 'não reconheci quantidade, preço e valor no fim da linha'
  const [, tq, tp, tv, dcTexto] = m
  const dc: 'D' | 'C' | null = dcTexto === 'D' || dcTexto === 'C' ? dcTexto : null
  cauda.splice(cauda.length - usadas, usadas)

  // o que sobrou: prazo (data), especificação do título e a coluna Obs.
  const centro = (c: CelulaPdf) => (c.x + c.xFim) / 2
  const ehObs = (c: CelulaPdf) =>
    obsHeader ? centro(c) >= obsHeader.x - 10 && centro(c) <= obsHeader.xFim + 10 : RE_OBS.test(c.texto.trim().toUpperCase()) && c === cauda[cauda.length - 1]
  const obs = cauda.filter(ehObs).map((c) => c.texto.trim())
  const specCells = cauda.filter((c) => !ehObs(c) && !lerData(c.texto) && !RE_PRAZO_MES.test(c.texto.trim()))
  const especificacao = specCells
    .map((c) => c.texto.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^\d{2}\/\d{2}(\/\d{2,4})?\s+/, '') // prazo de opção colado ao título
  const sep = separarEspecificacao(especificacao)

  return {
    compraVenda: cv,
    mercado,
    categoria: categoriaDoMercado(mercado),
    especificacao,
    ticker: sep.ticker,
    nome: sep.nome,
    especie: sep.especie,
    observacoes: obs.join(' '),
    quantidade: num(tq),
    preco: num(tp),
    valor: num(tv),
    debitoCredito: dc,
    pagina,
  }
}

// ---------- resumo financeiro ----------
type Lado = { rotulo: string; valor: number; dc: 'D' | 'C' | null }

function lerLado(cells: CelulaPdf[]): Lado | null {
  let k = -1
  let m: RegExpMatchArray | null = null
  for (let i = cells.length - 1; i >= 0; i--) {
    m = cells[i].texto.trim().match(RE_VALOR_DC)
    if (m) {
      k = i
      break
    }
  }
  if (k < 0 || !m) return null
  // D/C junto do valor ("322,50 C") ou na célula seguinte
  const prox = cells[k + 1]?.texto.trim().toUpperCase()
  const dcTexto = m[2] ?? (prox === 'D' || prox === 'C' ? prox : null)
  const dc = dcTexto === 'D' || dcTexto === 'C' ? dcTexto : null
  const rotulo = norm(cells.slice(0, k).map((c) => c.texto).join(' '))
  return { rotulo, valor: num(m[1]), dc }
}

function aplicarRotulo(resumo: ResumoNota, lado: Lado, ladoEsquerdo: boolean, textoOriginal: string) {
  const v: ValorComSinal = { valor: lado.valor, dc: lado.dc }
  const r = lado.rotulo
  if (ladoEsquerdo) {
    if (r === 'COMPRAS A VISTA') resumo.comprasAVista = lado.valor
    else if (r === 'VENDAS A VISTA') resumo.vendasAVista = lado.valor
    else if (/^OPCOES\b.*\bCOMPRAS$/.test(r)) resumo.opcoesCompras = lado.valor
    else if (/^OPCOES\b.*\bVENDAS$/.test(r)) resumo.opcoesVendas = lado.valor
    return
  }
  if (r.startsWith('VALOR LIQUIDO DAS OPERACOES')) resumo.valorLiquidoOperacoes = v
  else if (r.startsWith('TAXA DE LIQUIDACAO')) resumo.taxaLiquidacao = v
  else if (r.startsWith('TAXA DE REGISTRO')) resumo.taxaRegistro = v
  else if (r.startsWith('TOTAL CBLC')) resumo.totalCblc = v
  else if (r.startsWith('TAXA DE TERMO')) resumo.taxaTermoOpcoes = v
  else if (r.startsWith('TAXA ANA')) resumo.taxaAna = v
  else if (r.startsWith('EMOLUMENTOS')) resumo.emolumentos = v
  else if (r.startsWith('TAXA DE TRANSF')) resumo.taxaTransfAtivos = v
  else if (r.startsWith('TOTAL BOVESPA')) resumo.totalBovespa = v
  else if (r.startsWith('TAXA OPERACIONAL')) resumo.taxaOperacional = v
  else if (r.startsWith('EXECUCAO')) resumo.execucao = v
  else if (r.startsWith('TAXA DE CUSTODIA')) resumo.taxaCustodia = v
  else if (r.startsWith('IMPOSTOS')) resumo.impostos = v
  else if (r.startsWith('IRRF')) resumo.irrf = v
  else if (r.startsWith('OUTROS')) resumo.outros = v
  else if (r.startsWith('TOTAL CUSTOS')) resumo.totalCustos = v
  else if (r.startsWith('LIQUIDO PARA')) {
    resumo.liquido = v
    const m = textoOriginal.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (m) resumo.dataLiquidacao = lerData(m[1]) ?? undefined
  }
}

// ---------- cabeçalho (nº da nota e data do pregão) ----------
/** Valor impresso logo ABAIXO de um rótulo (o SINACOR põe o rótulo numa linha e o valor na seguinte). */
function valorAbaixoDe(linhas: LinhaPdf[], achaRotulo: (t: string) => boolean): string | null {
  for (let i = 0; i < linhas.length; i++) {
    const cel = linhas[i].celulas.find((c) => achaRotulo(norm(c.texto)))
    if (!cel) continue
    for (const prox of linhas.slice(i + 1, i + 3)) {
      if (prox.pagina !== linhas[i].pagina) break
      const abaixo = prox.celulas.find((c) => c.xFim >= cel.x - 20 && c.x <= cel.xFim + 40)
      if (abaixo) return abaixo.texto.trim()
    }
  }
  return null
}

// ---------- API ----------
export function lerNotaSinacor(linhas: LinhaPdf[]): NotaNegociacao {
  const avisos: string[] = []
  const iCab = linhas.findIndex((l) => {
    const t = norm(l.texto)
    return t.includes('C/V') && t.includes('QUANTIDADE') && t.includes('ESPECIFICACAO')
  })
  if (iCab < 0) throw new NotaNaoReconhecidaError()
  const obsHeader = linhas[iCab].celulas.find((c) => norm(c.texto).startsWith('OBS')) ?? null

  // Negócios: todas as linhas com "1-BOVESPA" depois do primeiro cabeçalho (a nota pode ter várias páginas).
  const negocios: NegocioNota[] = []
  let erros = 0
  for (const l of linhas.slice(iCab + 1)) {
    const r = linhaDeNegocio(l.celulas, obsHeader, l.pagina)
    if (r === null) continue
    if (typeof r === 'string') {
      erros++
      avisos.push(`Uma linha de negócio na página ${l.pagina} não foi lida: ${r}.`)
    } else negocios.push(r)
  }

  // Resumo: linhas depois de "Resumo Financeiro", separadas em coluna esquerda/direita.
  const iRes = linhas.findIndex((l) => l.celulas.some((c) => norm(c.texto).startsWith('RESUMO FINANCEIRO')))
  const resumo: ResumoNota = {}
  if (iRes >= 0) {
    const xDir = linhas[iRes].celulas.find((c) => norm(c.texto).startsWith('RESUMO FINANCEIRO'))!.x
    for (const l of linhas.slice(iRes)) {
      const esquerda = l.celulas.filter((c) => c.xFim < xDir - 1)
      const direita = l.celulas.filter((c) => c.x >= xDir - 1)
      const le = lerLado(esquerda)
      const ld = lerLado(direita)
      if (le) aplicarRotulo(resumo, le, true, esquerda.map((c) => c.texto).join(' '))
      if (ld) aplicarRotulo(resumo, ld, false, direita.map((c) => c.texto).join(' '))
    }
  } else {
    avisos.push('Não encontramos o "Resumo Financeiro": não é possível conferir os totais.')
  }

  // Data do pregão e número da nota.
  const numero = valorAbaixoDe(linhas, (t) => t.startsWith('NR NOTA') || t === 'NR. NOTA' || t.startsWith('NUMERO DA NOTA'))
  const dataCab = valorAbaixoDe(linhas, (t) => t.startsWith('DATA PREGAO'))
  let dataPregao = dataCab ? lerData(dataCab) : null
  let origemDataPregao: NotaNegociacao['origemDataPregao'] = dataPregao ? 'cabecalho' : 'nenhuma'
  if (!dataPregao && resumo.dataLiquidacao) {
    dataPregao = somarDiasUteis(resumo.dataLiquidacao, -2)
    origemDataPregao = 'deduzida'
    avisos.push(
      `Data do pregão deduzida da liquidação (${resumo.dataLiquidacao} − 2 dias úteis = ${dataPregao}). Confirme: com feriado no intervalo a data pode estar um dia errada.`,
    )
  }
  if (!dataPregao) avisos.push('Não foi possível determinar a data do pregão.')

  // Autoverificação: as contas da própria nota têm que fechar.
  const verificacoes: Verificacao[] = []
  // Totais "à vista" da nota NÃO incluem opções: comparamos cada mercado com a sua linha do resumo.
  const soma = (cv: 'C' | 'V', cat?: CategoriaMercado) =>
    arred(negocios.filter((n) => n.compraVenda === cv && (!cat || n.categoria === cat)).reduce((s, n) => s + n.valor, 0))
  const confere = (nome: string, esperado: number, obtido: number) => verificacoes.push({ nome, esperado, obtido, ok: Math.abs(esperado - obtido) <= TOLERANCIA })
  if (resumo.comprasAVista !== undefined) confere('Compras à vista', resumo.comprasAVista, soma('C', 'vista'))
  if (resumo.vendasAVista !== undefined) confere('Vendas à vista', resumo.vendasAVista, soma('V', 'vista'))
  if (resumo.opcoesCompras !== undefined) confere('Opções - compras', resumo.opcoesCompras, soma('C', 'opcao'))
  if (resumo.opcoesVendas !== undefined) confere('Opções - vendas', resumo.opcoesVendas, soma('V', 'opcao'))
  // O caixa (valor líquido e líquido final) inclui TODOS os mercados, prêmios de opção inclusive.
  const compras = soma('C')
  const vendas = soma('V')
  if (resumo.valorLiquidoOperacoes) confere('Valor líquido das operações', comSinal(resumo.valorLiquidoOperacoes), arred(compras - vendas))
  if (resumo.liquido) {
    const custos = custosSinalizados(resumo).total
    confere('Líquido da nota', comSinal(resumo.liquido), arred(compras - vendas + custos))
  }
  for (const n of negocios) {
    const calc = arred(n.quantidade * n.preco)
    if (Math.abs(calc - n.valor) > TOLERANCIA) {
      verificacoes.push({ nome: `Quantidade × preço (${n.especificacao})`, esperado: n.valor, obtido: calc, ok: false })
    }
  }
  if (negocios.some((n) => /(^|\s)D(\s|$)/.test(n.observacoes))) {
    avisos.push('A nota marca negócios como day trade (D). O imposto de day trade é diferente; o preço médio aqui não os separa.')
  }
  const incoerentes = negocios.filter((n) => n.debitoCredito && ((n.compraVenda === 'C' && n.debitoCredito === 'C') || (n.compraVenda === 'V' && n.debitoCredito === 'D')))
  if (incoerentes.length) avisos.push(`${incoerentes.length} negócio(s) com C/V e D/C que não combinam (compra costuma ser D e venda, C). Conferimos pelos totais da nota; revise.`)
  const exerc = negocios.filter((n) => n.categoria === 'exercicio')
  if (exerc.length) avisos.push(`${exerc.length} negócio(s) de EXERCÍCIO de opção: eles alteram a posição em ações mas não são importados automaticamente. Lance-os à mão.`)
  const fora = negocios.filter((n) => n.categoria !== 'vista' && n.categoria !== 'exercicio')
  if (fora.length) avisos.push(`${fora.length} negócio(s) em mercado fora de ação/FII/ETF/BDR à vista (ex.: ${fora[0].mercado}) não são importados.`)

  const conferida = erros === 0 && negocios.length > 0 && verificacoes.length >= 2 && verificacoes.every((v) => v.ok)
  if (negocios.length === 0) avisos.push('Nenhum negócio foi lido.')
  if (verificacoes.length < 2) avisos.push('Poucos totais na nota para conferir a leitura; revise os negócios antes de importar.')

  return { numero, dataPregao, origemDataPregao, negocios, resumo, verificacoes, conferida, avisos }
}

/** Custos da nota com sinal (D positivo). `ratear` exclui o IRRF, que é imposto retido e não custo de aquisição. */
function custosSinalizados(r: ResumoNota): { total: number; ratear: number } {
  const comp = [r.taxaLiquidacao, r.taxaRegistro, r.taxaTermoOpcoes, r.taxaAna, r.emolumentos, r.taxaTransfAtivos, r.taxaOperacional, r.execucao, r.taxaCustodia, r.impostos, r.outros]
  const ratear = arred(comp.reduce((s, v) => s + comSinal(v), 0))
  return { total: arred(ratear + comSinal(r.irrf)), ratear }
}

/** Rateia o total em centavos, proporcionalmente aos pesos, sem perder nem criar centavo. */
export function ratearCentavos(totalReais: number, pesos: number[]): number[] {
  const totalC = Math.round(totalReais * 100)
  const somaPesos = pesos.reduce((s, p) => s + p, 0)
  if (!(somaPesos > 0) || totalC === 0) return pesos.map(() => 0)
  const brutos = pesos.map((p) => (totalC * p) / somaPesos)
  const pisos = brutos.map((b) => Math.floor(b))
  let sobra = totalC - pisos.reduce((s, p) => s + p, 0)
  const ordem = brutos.map((b, i) => ({ i, resto: b - Math.floor(b) })).sort((a, b) => b.resto - a.resto)
  for (const o of ordem) {
    if (sobra <= 0) break
    pisos[o.i] += 1
    sobra -= 1
  }
  return pisos.map((c) => c / 100)
}

// ---------- ticker ----------
export type ResolvedorTicker = (n: NegocioNota, dataPregao: string) => string | null

/** Casa "nome de pregão + espécie" com um ticker numa tabela (chaves de `chaveNomePregao`). */
export function resolverPorTabela(tabela: ReadonlyMap<string, string>): ResolvedorTicker {
  return (n) => tabela.get(chaveNomePregao(n.nome, n.especie)) ?? null
}

/**
 * Descobre o ticker cruzando com negócios JÁ importados do extrato de Negociação do mesmo dia:
 * mesmo dia, mesmo lado, mesmo preço e quantidade igual ou maior (o extrato agrega as execuções).
 * Só resolve se der exatamente um ativo; ambíguo vira pendência para a pessoa escolher.
 */
export function resolverPorCruzamento(
  existentes: readonly { data: string; tipo: string; ativo: string; quantidade: number; preco: number }[],
): ResolvedorTicker {
  return (n, data) => {
    const tipo = n.compraVenda === 'C' ? 'compra' : 'venda'
    const ativos = new Set(
      existentes.filter((e) => e.data === data && e.tipo === tipo && Math.abs(e.preco - n.preco) < 0.005 && e.quantidade + 1e-9 >= n.quantidade).map((e) => e.ativo),
    )
    return ativos.size === 1 ? [...ativos][0] : null
  }
}

export function combinarResolvedores(...rs: ResolvedorTicker[]): ResolvedorTicker {
  return (n, d) => {
    for (const r of rs) {
      const t = r(n, d)
      if (t) return t
    }
    return null
  }
}

export interface NotaConvertida {
  lancamentos: LancamentoNovo[]
  /** Negócios cujo ticker não foi possível descobrir: a pessoa escolhe. */
  pendentes: NegocioNota[]
  avisos: string[]
}

/**
 * Converte uma nota CONFERIDA em lançamentos, com as taxas rateadas por valor entre todos os
 * negócios da nota (compras e vendas). Recusa nota não conferida: melhor não importar do que
 * importar um número errado.
 */
export function notaParaLancamentos(nota: NotaNegociacao, resolver: ResolvedorTicker = () => null): NotaConvertida {
  const avisos: string[] = []
  if (!nota.conferida) {
    return { lancamentos: [], pendentes: [], avisos: ['A leitura desta nota não passou na conferência dos totais; ela não foi importada.', ...nota.avisos] }
  }
  if (!nota.dataPregao) return { lancamentos: [], pendentes: [], avisos: ['Sem a data do pregão não dá para lançar. Informe a data da nota.'] }

  // As taxas são da nota inteira. O rateio usa TODOS os negócios no denominador (opções
  // inclusive), senão as ações absorveriam também a taxa dos contratos de opção, que não é
  // custo delas. Só os negócios à vista viram lançamento.
  const rateio = ratearCentavos(
    custosSinalizados(nota.resumo).ratear,
    nota.negocios.map((n) => n.valor),
  )

  const lancamentos: LancamentoNovo[] = []
  const pendentes: NegocioNota[] = []
  let suportados = 0
  nota.negocios.forEach((n, i) => {
    if (n.categoria !== 'vista') return
    suportados++
    const ticker = n.ticker ?? resolver(n, nota.dataPregao!)
    if (!ticker) {
      pendentes.push(n)
      return
    }
    lancamentos.push({
      data: nota.dataPregao!,
      tipo: n.compraVenda === 'C' ? 'compra' : 'venda',
      ativo: ticker,
      quantidade: n.quantidade,
      preco: n.preco,
      valor: n.valor,
      taxas: rateio[i],
      origem: 'b3-nota',
    })
  })
  if (suportados === 0) avisos.push('Esta nota não tem negócios de ação, FII, ETF ou BDR à vista (só opções ou outros mercados): nada foi importado.')
  if (pendentes.length) avisos.push(`${pendentes.length} negócio(s) sem ticker identificado: escolha o ativo para importá-los.`)
  return { lancamentos, pendentes, avisos }
}
