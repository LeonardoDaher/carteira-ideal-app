// Leitura do extrato de Negociação da B3 (Área do Investidor) só para opções, e apuração dos resultados que alimentam o
// imposto mensal. Contas puras; o arquivo é lido no navegador e nunca sai do aparelho.
//
// Como o resultado é apurado, por código de opção (série):
//  - Day trade: no mesmo dia, a quantidade comprada que casa com a vendida (preço médio de compra contra preço médio de venda).
//  - Swing trade: o que sobra de cada dia entra numa posição com preço médio; comprar/vender no sentido contrário realiza
//    resultado pelo preço médio. Vale para posição comprada e para vendida (lançada).
//  - Posição que ficou aberta e cujo vencimento já passou: sem informação de exercício, considera-se que venceu sem valor
//    (comprada perde o prêmio, vendida fica com ele). Se foi exercida, a pessoa marca e a série sai da conta.
// Corretagem e emolumentos não vêm no extrato e ficam de fora.
import { lerData, lerNumero, lerTexto, normalizarCabecalho } from './importacao/celulas'
import type { Matriz } from './importacao/celulas'
import { decodificarTexto, lerCsv } from './importacao/csv'
import type { OperacaoIr } from './impostoOpcoes'

export interface NegocioOpcao {
  data: string
  codigo: string
  lado: 'compra' | 'venda'
  quantidade: number
  preco: number
  valor: number
  /** Vencimento, se o extrato trouxer (AAAA-MM-DD). */
  vencimento: string | null
}

export interface LeituraExtrato {
  reconhecido: boolean
  negocios: NegocioOpcao[]
  /** Linhas de outros mercados (ações, fracionário, termo...), ignoradas de propósito. */
  ignoradas: number
  erros: string[]
}

export async function lerMatrizesDoArquivo(nome: string, bytes: ArrayBuffer): Promise<Matriz[]> {
  const ext = nome.toLowerCase().split('.').pop() ?? ''
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return [lerCsv(decodificarTexto(bytes))]
  if (ext === 'xlsx') {
    const { lerXlsx } = await import('./importacao/xlsx')
    return (await lerXlsx(bytes)).map((a) => a.dados)
  }
  if (ext === 'xls') throw new Error('Este é um Excel antigo (.xls). Abra no Excel, use "Salvar como" .xlsx (ou CSV) e envie de novo.')
  throw new Error('Formato não suportado. Envie o extrato de Negociação da B3 em .xlsx ou .csv.')
}

/** Lê as linhas de opções de uma aba do extrato de Negociação. Se a aba não tem o cabeçalho esperado, `reconhecido` é falso. */
export function lerNegociosOpcoes(matriz: Matriz): LeituraExtrato {
  const vazio: LeituraExtrato = { reconhecido: false, negocios: [], ignoradas: 0, erros: [] }
  let cab = -1
  let colunas: string[] = []
  for (let i = 0; i < Math.min(matriz.length, 40); i++) {
    const norm = matriz[i].map(normalizarCabecalho)
    if (norm.includes('MERCADO') && norm.some((c) => c.startsWith('CODIGO')) && norm.includes('QUANTIDADE')) {
      cab = i
      colunas = norm
      break
    }
  }
  if (cab < 0) return vazio
  const col = (teste: (c: string) => boolean) => colunas.findIndex(teste)
  const iData = col((c) => c.startsWith('DATA'))
  const iTipo = col((c) => c.startsWith('TIPO'))
  const iMercado = col((c) => c === 'MERCADO')
  const iVenc = col((c) => c.startsWith('PRAZO'))
  const iCodigo = col((c) => c.startsWith('CODIGO'))
  const iQtd = col((c) => c === 'QUANTIDADE')
  const iPreco = col((c) => c.startsWith('PRECO'))
  const iValor = col((c) => c === 'VALOR')
  if ([iData, iTipo, iMercado, iCodigo, iQtd, iPreco].some((i) => i < 0)) return vazio

  const r: LeituraExtrato = { reconhecido: true, negocios: [], ignoradas: 0, erros: [] }
  for (let i = cab + 1; i < matriz.length; i++) {
    const linha = matriz[i]
    if (linha.every((c) => lerTexto(c) === '')) continue
    const n = i + 1
    if (!/OPCAO/.test(normalizarCabecalho(linha[iMercado]))) {
      r.ignoradas++
      continue
    }
    const tipo = normalizarCabecalho(linha[iTipo])
    const lado = tipo.startsWith('COMPRA') ? 'compra' : tipo.startsWith('VENDA') ? 'venda' : null
    const data = lerData(linha[iData])
    const quantidade = lerNumero(linha[iQtd])
    const preco = lerNumero(linha[iPreco])
    const codigo = lerTexto(linha[iCodigo]).toUpperCase()
    if (!lado || !data || !codigo || quantidade === null || preco === null || quantidade === 0) {
      r.erros.push(`Linha ${n}: não consegui ler (${[!lado && 'tipo', !data && 'data', !codigo && 'código', (quantidade === null || quantidade === 0) && 'quantidade', preco === null && 'preço'].filter(Boolean).join(', ')}).`)
      continue
    }
    const q = Math.abs(quantidade)
    const valor = iValor >= 0 ? lerNumero(linha[iValor]) : null
    r.negocios.push({
      data, codigo, lado, quantidade: q, preco: Math.abs(preco), valor: Math.abs(valor ?? q * preco),
      vencimento: iVenc >= 0 ? lerData(linha[iVenc]) : null,
    })
  }
  return r
}

/** Junta a leitura de todas as abas de um ou mais arquivos. */
export function juntarLeituras(leituras: LeituraExtrato[]): LeituraExtrato {
  return {
    reconhecido: leituras.some((l) => l.reconhecido),
    negocios: leituras.flatMap((l) => l.negocios),
    ignoradas: leituras.reduce((t, l) => t + l.ignoradas, 0),
    erros: leituras.flatMap((l) => l.erros),
  }
}

// ---------------------------------------------------------------------------------------
// Vencimento
// ---------------------------------------------------------------------------------------

function terceiraSexta(ano: number, mes: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const dia = 1 + ((5 - primeiro + 7) % 7) + 14
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Vencimento mensal deduzido do código (PETRK600: a letra K é a call de novembro; M a X são as puts de janeiro a dezembro) na terceira
 * sexta-feira do mês, a primeira que não seja anterior a `aPartirDe`. Séries semanais e códigos fora do padrão devolvem null.
 */
export function vencimentoInferido(codigo: string, aPartirDe: string): string | null {
  const m = /^[A-Z0-9]{4}([A-X])\d+$/.exec(codigo)
  if (!m) return null
  const mes = ((m[1].charCodeAt(0) - 65) % 12) + 1
  let ano = Number(aPartirDe.slice(0, 4))
  let venc = terceiraSexta(ano, mes)
  if (venc < aPartirDe) venc = terceiraSexta(++ano, mes)
  return venc
}

// ---------------------------------------------------------------------------------------
// Apuração
// ---------------------------------------------------------------------------------------

export interface PosicaoAbertaOpcao {
  codigo: string
  lado: 'comprada' | 'vendida'
  quantidade: number
  precoMedio: number
  vencimento: string | null
  /** Vencimento já passou (considerando `hoje`). */
  vencida: boolean
  /** A pessoa marcou que a série foi exercida: não entra no imposto como opção. */
  exercida: boolean
}

export interface ApuracaoExtrato {
  /** Resultados realizados, no formato da aba Imposto (origem 'b3'). */
  operacoes: OperacaoIr[]
  abertas: PosicaoAbertaOpcao[]
  /** Primeiro e último dia com negócio de opção. */
  periodo: { de: string; ate: string } | null
}

const arred = (v: number) => Math.round(v * 100) / 100

interface Posicao { qtd: number; pm: number }

/** Aplica uma quantidade líquida (compra positiva, venda negativa) a uma posição e devolve o resultado realizado. */
function aplicar(pos: Posicao, q: number, preco: number): number {
  if (pos.qtd === 0 || Math.sign(pos.qtd) === Math.sign(q)) {
    const total = Math.abs(pos.qtd) + Math.abs(q)
    pos.pm = (Math.abs(pos.qtd) * pos.pm + Math.abs(q) * preco) / total
    pos.qtd += q
    return 0
  }
  const fecha = Math.min(Math.abs(q), Math.abs(pos.qtd))
  const resultado = fecha * (pos.qtd > 0 ? preco - pos.pm : pos.pm - preco)
  const sobra = Math.abs(q) - fecha
  pos.qtd += Math.sign(q) * fecha
  if (pos.qtd === 0 && sobra > 0) {
    pos.qtd = Math.sign(q) * sobra
    pos.pm = preco
  } else if (pos.qtd === 0) {
    pos.pm = 0
  }
  return resultado
}

/** `exercidas`: códigos de séries abertas e vencidas que foram exercidas (saem da conta). */
export function apurarNegocios(negocios: NegocioOpcao[], hoje: string, exercidas: ReadonlySet<string> = new Set()): ApuracaoExtrato {
  if (negocios.length === 0) return { operacoes: [], abertas: [], periodo: null }
  const ordenados = [...negocios].sort((a, b) => a.data.localeCompare(b.data))
  const resultados = new Map<string, { data: string; categoria: 'swing' | 'daytrade'; codigo: string; v: number }>()
  const vendidoSwing = new Map<string, number>()
  const soma = (data: string, categoria: 'swing' | 'daytrade', codigo: string, v: number) => {
    const k = `${data}|${categoria}|${codigo}`
    const atual = resultados.get(k)
    if (atual) atual.v += v
    else resultados.set(k, { data, categoria, codigo, v })
  }

  const porCodigo = new Map<string, NegocioOpcao[]>()
  for (const n of ordenados) porCodigo.set(n.codigo, [...(porCodigo.get(n.codigo) ?? []), n])

  const abertas: PosicaoAbertaOpcao[] = []
  for (const [codigo, lista] of porCodigo) {
    const pos: Posicao = { qtd: 0, pm: 0 }
    const dias = [...new Set(lista.map((n) => n.data))]
    for (const dia of dias) {
      const doDia = lista.filter((n) => n.data === dia)
      const compras = doDia.filter((n) => n.lado === 'compra')
      const vendas = doDia.filter((n) => n.lado === 'venda')
      const qC = compras.reduce((t, n) => t + n.quantidade, 0)
      const qV = vendas.reduce((t, n) => t + n.quantidade, 0)
      const vC = compras.reduce((t, n) => t + n.valor, 0)
      const vV = vendas.reduce((t, n) => t + n.valor, 0)
      const pmC = qC ? vC / qC : 0
      const pmV = qV ? vV / qV : 0
      const dt = Math.min(qC, qV)
      if (dt > 0) soma(dia, 'daytrade', codigo, dt * (pmV - pmC))
      const vendidoDoSwing = vV - dt * pmV
      if (vendidoDoSwing > 0.005) vendidoSwing.set(dia, (vendidoSwing.get(dia) ?? 0) + vendidoDoSwing)
      if (qC > dt) soma(dia, 'swing', codigo, aplicar(pos, qC - dt, pmC))
      else if (qV > dt) soma(dia, 'swing', codigo, aplicar(pos, -(qV - dt), pmV))
    }
    if (pos.qtd !== 0) {
      const ultima = lista[lista.length - 1].data
      const vencimento = lista.find((n) => n.vencimento)?.vencimento ?? vencimentoInferido(codigo, ultima)
      const vencida = vencimento !== null && vencimento < hoje
      const exercida = vencida && exercidas.has(codigo)
      const quantidade = Math.abs(pos.qtd)
      abertas.push({ codigo, lado: pos.qtd > 0 ? 'comprada' : 'vendida', quantidade, precoMedio: arred(pos.pm), vencimento, vencida, exercida })
      if (vencida && !exercida && vencimento) soma(vencimento, 'swing', codigo, pos.qtd > 0 ? -quantidade * pos.pm : quantidade * pos.pm)
    }
  }

  const operacoes: OperacaoIr[] = [...resultados.values()]
    .map((r) => ({ ...r, v: arred(r.v) }))
    .filter((r) => r.v !== 0)
    .map((r) => ({
      id: `b3-${r.data}-${r.categoria}-${r.codigo}`, data: r.data, categoria: r.categoria, descricao: `${r.codigo} (extrato B3)`,
      resultado: r.v, vendido: 0, origem: 'b3' as const,
    }))
  for (const [data, v] of vendidoSwing) {
    operacoes.push({ id: `b3-vendas-${data}`, data, categoria: 'swing', descricao: 'Vendas do dia (base do IRRF)', resultado: 0, vendido: arred(v), origem: 'b3' })
  }
  operacoes.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
  return { operacoes, abertas, periodo: { de: ordenados[0].data, ate: ordenados[ordenados.length - 1].data } }
}
