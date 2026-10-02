// Minha Carteira (D36): converte uma matriz de células (vinda de CSV ou XLSX) em lançamentos.
//
// Perfis, reconhecidos pelos NOMES das colunas (nunca pela posição, porque a B3 não publica o
// layout dos extratos e ele pode mudar). Validados contra extratos reais da B3 em 01/10/2026:
//   - b3-movimentacao: Entrada/Saída, Data, Movimentação, Produto, Instituição, Quantidade,
//     Preço unitário, Valor da Operação. Atenção: é um consolidado, e a data é a da
//     LIQUIDAÇÃO, não a da compra. O extrato de Negociação é mais preciso nas datas.
//   - b3-negociacao: Data do Negócio, Tipo de Movimentação, Mercado, Prazo/Vencimento,
//     Instituição, Código de Negociação, Quantidade, Preço, Valor. Só renda variável de bolsa.
//   - b3-proventos-recebidos: Produto, Pagamento, Tipo de Evento, Instituição, Quantidade,
//     Preço unitário, Valor líquido (tem linhas de "Total" no fim, que são ignoradas).
//   - b3-proventos-a-receber (e "Eventos"): mesmas colunas, com "Previsão de pagamento". São
//     PREVISÕES: não viram lançamento, saem em `eventosFuturos`.
//   - b3-posicao: uma aba por categoria (Ações, BDR, ETF, Fundo de Investimento, Tesouro Direto).
//     É uma FOTO (quantidade e valor atualizado), sem datas de compra nem preço médio; sai em
//     `posicao`. Só o Tesouro traz o Valor Aplicado (custo).
//   - b3-calendario: calendário de proventos do MERCADO, não do investidor. Reconhecido e recusado.
//   - generico: planilha própria ou de outro app (Data, Tipo, Ativo, Quantidade, Preço...).
//
// Regra de transparência: linha que não dá para ler NÃO some em silêncio; vira um erro com o
// número da linha. Tipos de movimentação que ignoramos de propósito viram um aviso agregado.
import { normalizarBusca } from '../rendaFii'
import type { LancamentoNovo, OrigemLancamento, SubtipoProvento, TipoLancamento } from '../lancamentos'
import { PADRAO_TICKER, desfazerProventosEmPares, ehTickerDeBolsa, validarLancamento } from '../lancamentos'
import { lerData, lerNumero, lerTexto, linhaVazia, normalizarCabecalho, type Celula, type Matriz } from './celulas'

export type PerfilArquivo =
  | 'b3-movimentacao'
  | 'b3-negociacao'
  | 'b3-proventos-recebidos'
  | 'b3-proventos-a-receber'
  | 'b3-posicao'
  | 'b3-calendario'
  | 'generico'

export type CategoriaPosicao = 'acoes' | 'bdr' | 'etf' | 'fundos' | 'tesouro' | 'rendaFixa' | 'outra'

/** Uma linha da Posição da B3: foto do que a pessoa tem, sem custo (exceto Tesouro). */
export interface ItemPosicaoB3 {
  ativo: string
  categoria: CategoriaPosicao
  quantidade: number
  precoFechamento: number | null
  valorAtualizado: number
  /** Só o Tesouro Direto informa quanto foi aplicado. */
  valorAplicado: number | null
  instituicao?: string
  vencimento?: string
  indexador?: string
}

/** Provento anunciado e ainda não pago. */
export interface EventoFuturo {
  ativo: string
  tipoEvento: SubtipoProvento | 'outro'
  /** AAAA-MM-DD */
  previsao: string
  quantidade: number
  precoUnitario: number
  valorLiquido: number
  instituicao?: string
}

export interface ErroLinha {
  /** Número da linha na planilha (1 = primeira linha do arquivo). */
  linha: number
  motivo: string
}

export interface ResultadoImportacao {
  perfil: PerfilArquivo | null
  lancamentos: LancamentoNovo[]
  avisos: string[]
  erros: ErroLinha[]
  /** Linhas de dados lidas (sem cabeçalho e sem linhas vazias). */
  linhasLidas: number
  /** Falha que impede a importação inteira (ex.: cabeçalho não encontrado). */
  erroGeral?: string
  /** Só no perfil b3-posicao. */
  posicao?: ItemPosicaoB3[]
  /** Só nos perfis b3-proventos-a-receber. */
  eventosFuturos?: EventoFuturo[]
}

type Campo =
  | 'data'
  | 'tipo'
  | 'movimentacao'
  | 'entradaSaida'
  | 'produto'
  | 'codigo'
  | 'ativo'
  | 'quantidade'
  | 'preco'
  | 'valor'
  | 'taxas'
  | 'instituicao'
  | 'mercado'
  | 'pagamento'
  | 'previsao'
  | 'tipoEvento'
  | 'valorLiquido'
  | 'dataCom'
  | 'minhaCarteira'
  | 'fechamento'
  | 'valorAtualizado'
  | 'valorAplicado'
  | 'indexador'
  | 'vencimento'

const SINONIMOS: Record<Campo, string[]> = {
  data: ['DATA', 'DATA DO NEGOCIO', 'DATA NEGOCIO', 'DATA DA OPERACAO', 'DATA OPERACAO', 'DATA DE COMPRA', 'DATA DO MOVIMENTO', 'DT'],
  tipo: ['TIPO', 'TIPO DE MOVIMENTACAO', 'TIPO DE OPERACAO', 'OPERACAO', 'C/V', 'COMPRA/VENDA', 'NATUREZA'],
  movimentacao: ['MOVIMENTACAO'],
  entradaSaida: ['ENTRADA/SAIDA', 'ENTRADA SAIDA'],
  produto: ['PRODUTO'],
  codigo: ['CODIGO DE NEGOCIACAO', 'CODIGO NEGOCIACAO'],
  ativo: ['ATIVO', 'TICKER', 'CODIGO', 'PAPEL', 'ATIVO/PRODUTO', 'NOME DO ATIVO', 'NOME', 'SIMBOLO'],
  quantidade: ['QUANTIDADE', 'QTD', 'QTDE', 'QUANT', 'QTD.'],
  preco: ['PRECO', 'PRECO UNITARIO', 'PRECO MEDIO', 'PU', 'COTACAO', 'VALOR UNITARIO', 'PRECO R$', 'PRECO (R$)'],
  valor: ['VALOR', 'VALOR DA OPERACAO', 'VALOR TOTAL', 'TOTAL', 'VALOR R$'],
  taxas: ['TAXAS', 'CORRETAGEM', 'CUSTOS', 'TAXAS E CORRETAGEM', 'EMOLUMENTOS'],
  instituicao: ['INSTITUICAO', 'CORRETORA', 'BANCO'],
  mercado: ['MERCADO'],
  pagamento: ['PAGAMENTO', 'DATA DE PAGAMENTO', 'DATA DO PAGAMENTO', 'DATA PAGAMENTO'],
  previsao: ['PREVISAO DE PAGAMENTO', 'PREVISAO PAGAMENTO'],
  tipoEvento: ['TIPO DE EVENTO'],
  valorLiquido: ['VALOR LIQUIDO'],
  dataCom: ['DATA COM'],
  minhaCarteira: ['MINHA CARTEIRA'],
  fechamento: ['PRECO DE FECHAMENTO', 'PRECO FECHAMENTO'],
  valorAtualizado: ['VALOR ATUALIZADO'],
  valorAplicado: ['VALOR APLICADO'],
  indexador: ['INDEXADOR'],
  vencimento: ['VENCIMENTO'],
}

type Mapa = Partial<Record<Campo, number>>

function mapearCabecalho(linha: Celula[]): Mapa {
  const mapa: Mapa = {}
  linha.forEach((c, i) => {
    const h = normalizarCabecalho(c)
    if (!h) return
    for (const campo of Object.keys(SINONIMOS) as Campo[]) {
      if (mapa[campo] === undefined && SINONIMOS[campo].includes(h)) {
        mapa[campo] = i
        break
      }
    }
  })
  return mapa
}

function detectarPerfil(m: Mapa): PerfilArquivo | null {
  const temProduto = m.produto !== undefined
  // O calendário também tem "Data de Pagamento" e "Tipo de Evento": reconhecer antes dos demais.
  if (temProduto && m.dataCom !== undefined && m.minhaCarteira !== undefined) return 'b3-calendario'
  if (temProduto && m.quantidade !== undefined && m.valorAtualizado !== undefined) return 'b3-posicao'
  if (temProduto && m.pagamento !== undefined && m.tipoEvento !== undefined) return 'b3-proventos-recebidos'
  if (temProduto && m.previsao !== undefined && m.tipoEvento !== undefined) return 'b3-proventos-a-receber'
  if (m.entradaSaida !== undefined && m.movimentacao !== undefined && m.produto !== undefined) return 'b3-movimentacao'
  if (m.data !== undefined && m.tipo !== undefined && m.codigo !== undefined) return 'b3-negociacao'
  const temAtivo = m.ativo !== undefined || m.produto !== undefined || m.codigo !== undefined
  if (m.data !== undefined && m.tipo !== undefined && temAtivo) return 'generico'
  return null
}

function acharCabecalho(matriz: Matriz): { indice: number; mapa: Mapa; perfil: PerfilArquivo } | null {
  for (let i = 0; i < Math.min(matriz.length, 30); i++) {
    const mapa = mapearCabecalho(matriz[i])
    const perfil = detectarPerfil(mapa)
    if (perfil) return { indice: i, mapa, perfil }
  }
  return null
}

/** "MXRF11 - MAXI RENDA FII" -> "MXRF11"; "Tesouro Selic 2029" -> "TESOURO SELIC 2029"; PETR4F -> PETR4. */
export function ativoDoTexto(texto: string): string {
  const t = lerTexto(texto)
  const antes = normalizarBusca(t.split(' - ')[0]).replace(/\s/g, '')
  const semF = new RegExp(`^${PADRAO_TICKER}F$`).test(antes) ? antes.slice(0, -1) : antes
  if (ehTickerDeBolsa(semF)) return semF
  return normalizarBusca(t)
}

function tipoGenerico(texto: string): { tipo: TipoLancamento; subtipo?: SubtipoProvento } | null {
  const t = normalizarCabecalho(texto)
  if (!t) return null
  if (['C', 'COMPRA', 'BUY', 'APORTE', 'COMPRAS'].includes(t)) return { tipo: 'compra' }
  if (['V', 'VENDA', 'SELL', 'VENDAS', 'RESGATE'].includes(t)) return { tipo: 'venda' }
  if (t === 'SALDO INICIAL' || t === 'POSICAO INICIAL' || t === 'SALDO') return { tipo: 'saldoInicial' }
  if (t === 'BONIFICACAO' || t === 'BONIFICACAO EM ATIVOS') return { tipo: 'bonificacao' }
  if (['DESDOBRAMENTO', 'GRUPAMENTO', 'SPLIT', 'AJUSTE', 'AJUSTE DE QUANTIDADE'].includes(t)) return { tipo: 'ajusteQuantidade' }
  if (t === 'DIVIDENDO' || t === 'DIVIDENDOS') return { tipo: 'provento', subtipo: 'dividendo' }
  if (t === 'JCP' || t.startsWith('JUROS SOBRE CAPITAL')) return { tipo: 'provento', subtipo: 'jcp' }
  if (t === 'RENDIMENTO' || t === 'RENDIMENTOS' || t === 'PROVENTO' || t === 'PROVENTOS') {
    return { tipo: 'provento', subtipo: t.startsWith('PROVENTO') ? undefined : 'rendimento' }
  }
  return null
}

/**
 * A B3 escreve a mesma corretora de formas diferentes ("XP INVESTIMENTOS CCTVM S/A" e
 * "XP INVESTIMENTOS CCTVM S/A." na mesma planilha). Como a instituição entra na chave
 * anti-duplicidade, sem normalizar o mesmo negócio apareceria duas vezes.
 */
export function instituicaoDe(c: Celula): string | undefined {
  const t = normalizarBusca(lerTexto(c)).replace(/[.,;\s]+$/g, '').trim()
  return t || undefined
}

function celula(linha: Celula[], mapa: Mapa, campo: Campo): Celula {
  const i = mapa[campo]
  return i === undefined ? undefined : linha[i]
}

interface Contexto {
  origem: OrigemLancamento
  lancamentos: LancamentoNovo[]
  erros: ErroLinha[]
  ignorados: Map<string, number>
  posicao: ItemPosicaoB3[]
  futuros: EventoFuturo[]
}

function ignorar(ctx: Contexto, motivo: string) {
  ctx.ignorados.set(motivo, (ctx.ignorados.get(motivo) ?? 0) + 1)
}

/** Completa quantidade/preço/valor quando falta um dos três; devolve null se não der. */
function completar(q: number | null, p: number | null, v: number | null): { q: number; p: number; v: number } | null {
  if (q != null && p != null) return { q, p, v: q * p }
  if (q != null && v != null && q !== 0) return { q, p: v / q, v }
  if (p != null && v != null && p !== 0) return { q: v / p, p, v }
  return null
}

function adicionar(ctx: Contexto, numeroLinha: number, l: LancamentoNovo) {
  const problema = validarLancamento(l)
  if (problema) ctx.erros.push({ linha: numeroLinha, motivo: problema.motivo })
  else ctx.lancamentos.push(l)
}

function linhaB3Negociacao(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number) {
  const data = lerData(celula(linha, mapa, 'data'))
  if (!data) return void ctx.erros.push({ linha: n, motivo: 'Data não reconhecida.' })
  const tipoTxt = normalizarCabecalho(celula(linha, mapa, 'tipo'))
  const tipo: TipoLancamento | null = tipoTxt.startsWith('COMPRA') ? 'compra' : tipoTxt.startsWith('VENDA') ? 'venda' : null
  if (!tipo) return void ctx.erros.push({ linha: n, motivo: `Tipo de movimentação não reconhecido: "${lerTexto(celula(linha, mapa, 'tipo'))}".` })
  // Só renda variável à vista. A coluna Mercado manda: contratos futuros (WINM26, WDOQ26...)
  // têm o MESMO formato de um ticker de ação, então o formato do código sozinho não basta.
  const mercado = normalizarCabecalho(celula(linha, mapa, 'mercado'))
  if (mercado && !/VISTA|FRACIONARIO/.test(mercado)) {
    ignorar(ctx, `Mercado "${lerTexto(celula(linha, mapa, 'mercado'))}" (derivativos, opções ou termo: fora do escopo)`)
    return
  }
  const ativo = ativoDoTexto(lerTexto(celula(linha, mapa, 'codigo')))
  if (!ehTickerDeBolsa(ativo)) {
    ignorar(ctx, 'Código que não é de ação, FII, ETF ou BDR (fora do escopo)')
    return
  }
  const c = completar(
    lerNumero(celula(linha, mapa, 'quantidade')),
    lerNumero(celula(linha, mapa, 'preco')),
    lerNumero(celula(linha, mapa, 'valor')),
  )
  if (!c) return void ctx.erros.push({ linha: n, motivo: 'Faltam quantidade e preço (ou valor).' })
  adicionar(ctx, n, {
    data,
    tipo,
    ativo,
    quantidade: Math.abs(c.q),
    preco: c.p,
    valor: Math.abs(c.v),
    taxas: lerNumero(celula(linha, mapa, 'taxas')) ?? 0,
    instituicao: instituicaoDe(celula(linha, mapa, 'instituicao')),
    origem: ctx.origem,
  })
}

const PROVENTOS_B3: [RegExp, SubtipoProvento][] = [
  [/JUROS SOBRE CAPITAL|^JCP/, 'jcp'],
  [/DIVIDENDO/, 'dividendo'],
  [/RENDIMENTO/, 'rendimento'],
  // A página Proventos da B3 também conta amortizações, reembolsos de empréstimo de ativos e juros (Tesouro e renda fixa).
  [/AMORTIZACAO/, 'amortizacao'],
  [/REEMBOLSO/, 'reembolso'],
  [/^JUROS( |$)/, 'juros'],
]

function linhaB3Movimentacao(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number) {
  const data = lerData(celula(linha, mapa, 'data'))
  if (!data) return void ctx.erros.push({ linha: n, motivo: 'Data não reconhecida.' })
  const mov = normalizarCabecalho(celula(linha, mapa, 'movimentacao'))
  const es = normalizarCabecalho(celula(linha, mapa, 'entradaSaida'))
  const entrada = /CREDITO|ENTRADA/.test(es)
  const saida = /DEBITO|SAIDA/.test(es)
  const ativo = ativoDoTexto(lerTexto(celula(linha, mapa, 'produto')))
  const base = {
    data,
    ativo,
    taxas: 0,
    instituicao: instituicaoDe(celula(linha, mapa, 'instituicao')),
    origem: ctx.origem,
  }
  const q = lerNumero(celula(linha, mapa, 'quantidade'))
  const p = lerNumero(celula(linha, mapa, 'preco'))
  const v = lerNumero(celula(linha, mapa, 'valor'))

  const proventoB3 = PROVENTOS_B3.find(([re]) => re.test(mov))
  if (proventoB3) {
    if (v == null) return void ctx.erros.push({ linha: n, motivo: 'Provento sem valor.' })
    return adicionar(ctx, n, { ...base, tipo: 'provento', subtipo: proventoB3[1], quantidade: q ?? 0, preco: p ?? 0, valor: Math.abs(v) })
  }

  const ehLiquidacao = mov.includes('LIQUIDACAO') || /^(COMPRA|VENDA)$/.test(mov)
  if (ehLiquidacao || mov.includes('LEILAO DE FRACAO')) {
    const tipo: TipoLancamento | null = mov === 'VENDA' || mov.includes('LEILAO DE FRACAO') ? 'venda' : mov === 'COMPRA' ? 'compra' : entrada ? 'compra' : saida ? 'venda' : null
    if (!tipo) return void ctx.erros.push({ linha: n, motivo: 'Não deu para saber se é compra ou venda (coluna Entrada/Saída vazia).' })
    const c = completar(q, p, v)
    if (!c) return void ctx.erros.push({ linha: n, motivo: 'Faltam quantidade e preço (ou valor).' })
    return adicionar(ctx, n, { ...base, tipo, quantidade: Math.abs(c.q), preco: c.p, valor: Math.abs(c.v) })
  }

  if (mov.includes('BONIFICACAO')) {
    if (q == null || v == null) return void ctx.erros.push({ linha: n, motivo: 'Bonificação sem quantidade ou valor.' })
    return adicionar(ctx, n, { ...base, tipo: 'bonificacao', quantidade: Math.abs(q), preco: p ?? v / Math.abs(q), valor: Math.abs(v) })
  }

  if (mov.includes('DESDOBRAMENTO') || mov.includes('GRUPAMENTO') || mov.includes('FRACAO EM ATIVOS')) {
    if (q == null) return void ctx.erros.push({ linha: n, motivo: 'Ajuste sem quantidade.' })
    const sinal = saida ? -1 : 1
    return adicionar(ctx, n, { ...base, tipo: 'ajusteQuantidade', quantidade: sinal * Math.abs(q), preco: 0, valor: 0 })
  }

  ignorar(ctx, mov ? `Movimentação "${lerTexto(celula(linha, mapa, 'movimentacao'))}"` : 'Linha sem tipo de movimentação')
}

function linhaGenerica(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number) {
  const data = lerData(celula(linha, mapa, 'data'))
  if (!data) return void ctx.erros.push({ linha: n, motivo: 'Data não reconhecida.' })
  const t = tipoGenerico(lerTexto(celula(linha, mapa, 'tipo')))
  if (!t) return void ctx.erros.push({ linha: n, motivo: `Tipo não reconhecido: "${lerTexto(celula(linha, mapa, 'tipo'))}". Use Compra, Venda, Dividendo, JCP, Rendimento...` })
  const textoAtivo = lerTexto(celula(linha, mapa, 'ativo') ?? celula(linha, mapa, 'produto') ?? celula(linha, mapa, 'codigo'))
  const ativo = ativoDoTexto(textoAtivo)
  if (!ativo) return void ctx.erros.push({ linha: n, motivo: 'Ativo em branco.' })
  const q = lerNumero(celula(linha, mapa, 'quantidade'))
  const p = lerNumero(celula(linha, mapa, 'preco'))
  const v = lerNumero(celula(linha, mapa, 'valor'))
  const taxas = lerNumero(celula(linha, mapa, 'taxas')) ?? 0
  const instituicao = instituicaoDe(celula(linha, mapa, 'instituicao'))
  const base = { data, ativo, taxas, instituicao, origem: ctx.origem }

  if (t.tipo === 'provento') {
    const valor = v ?? (q != null && p != null ? q * p : null)
    if (valor == null) return void ctx.erros.push({ linha: n, motivo: 'Provento sem valor.' })
    return adicionar(ctx, n, { ...base, tipo: 'provento', subtipo: t.subtipo, quantidade: q ?? 0, preco: p ?? 0, valor: Math.abs(valor), taxas: 0 })
  }
  if (t.tipo === 'ajusteQuantidade') {
    if (q == null) return void ctx.erros.push({ linha: n, motivo: 'Ajuste sem quantidade.' })
    return adicionar(ctx, n, { ...base, tipo: 'ajusteQuantidade', quantidade: q, preco: 0, valor: 0, taxas: 0 })
  }
  const c = completar(q, p, v)
  if (!c) return void ctx.erros.push({ linha: n, motivo: 'Faltam quantidade e preço (ou valor).' })
  adicionar(ctx, n, { ...base, tipo: t.tipo, quantidade: Math.abs(c.q), preco: c.p, valor: Math.abs(c.v) })
}


function subtipoDoEvento(texto: string): SubtipoProvento | null {
  const t = normalizarCabecalho(texto)
  return PROVENTOS_B3.find(([re]) => re.test(t))?.[1] ?? null
}

/** Linha de resumo ("Total") ou em branco no meio da tabela: o produto está vazio. */
function ehLinhaDeResumo(linha: Celula[], mapa: Mapa): boolean {
  return lerTexto(celula(linha, mapa, 'produto')) === ''
}

function linhaProventoRecebido(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number) {
  if (ehLinhaDeResumo(linha, mapa)) return
  const data = lerData(celula(linha, mapa, 'pagamento'))
  if (!data) return void ctx.erros.push({ linha: n, motivo: 'Data de pagamento não reconhecida.' })
  const textoEvento = lerTexto(celula(linha, mapa, 'tipoEvento'))
  const subtipo = subtipoDoEvento(textoEvento)
  if (!subtipo) {
    ignorar(ctx, `Evento "${textoEvento}" (não é um provento)`)
    return
  }
  const valor = lerNumero(celula(linha, mapa, 'valorLiquido'))
  if (valor == null) return void ctx.erros.push({ linha: n, motivo: 'Provento sem valor líquido.' })
  adicionar(ctx, n, {
    data,
    tipo: 'provento',
    subtipo,
    ativo: ativoDoTexto(lerTexto(celula(linha, mapa, 'produto'))),
    quantidade: lerNumero(celula(linha, mapa, 'quantidade')) ?? 0,
    preco: lerNumero(celula(linha, mapa, 'preco')) ?? 0,
    valor: Math.abs(valor),
    taxas: 0,
    instituicao: instituicaoDe(celula(linha, mapa, 'instituicao')),
    origem: ctx.origem,
  })
}

function linhaProventoAReceber(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number) {
  if (ehLinhaDeResumo(linha, mapa)) return
  const previsao = lerData(celula(linha, mapa, 'previsao'))
  if (!previsao) return void ctx.erros.push({ linha: n, motivo: 'Previsão de pagamento não reconhecida.' })
  const valorLiquido = lerNumero(celula(linha, mapa, 'valorLiquido'))
  if (valorLiquido == null) return void ctx.erros.push({ linha: n, motivo: 'Evento sem valor líquido.' })
  ctx.futuros.push({
    ativo: ativoDoTexto(lerTexto(celula(linha, mapa, 'produto'))),
    tipoEvento: subtipoDoEvento(lerTexto(celula(linha, mapa, 'tipoEvento'))) ?? 'outro',
    previsao,
    quantidade: lerNumero(celula(linha, mapa, 'quantidade')) ?? 0,
    precoUnitario: lerNumero(celula(linha, mapa, 'preco')) ?? 0,
    valorLiquido,
    instituicao: instituicaoDe(celula(linha, mapa, 'instituicao')),
  })
}

function categoriaDaAba(nomeAba: string): CategoriaPosicao {
  const a = normalizarCabecalho(nomeAba)
  if (a.startsWith('ACOES')) return 'acoes'
  if (a === 'BDR') return 'bdr'
  if (a === 'ETF') return 'etf'
  if (a.startsWith('FUNDO')) return 'fundos'
  if (a.startsWith('TESOURO')) return 'tesouro'
  return 'outra'
}

function linhaPosicao(ctx: Contexto, linha: Celula[], mapa: Mapa, n: number, nomeAba: string) {
  if (ehLinhaDeResumo(linha, mapa)) return
  const quantidade = lerNumero(celula(linha, mapa, 'quantidade'))
  const valorAtualizado = lerNumero(celula(linha, mapa, 'valorAtualizado'))
  if (quantidade == null || valorAtualizado == null) {
    return void ctx.erros.push({ linha: n, motivo: 'Posição sem quantidade ou valor atualizado.' })
  }
  if (quantidade <= 0) return
  const codigo = lerTexto(celula(linha, mapa, 'codigo') ?? celula(linha, mapa, 'ativo'))
  ctx.posicao.push({
    ativo: ativoDoTexto(codigo || lerTexto(celula(linha, mapa, 'produto'))),
    categoria: categoriaDaAba(nomeAba),
    quantidade,
    precoFechamento: lerNumero(celula(linha, mapa, 'fechamento')),
    valorAtualizado,
    valorAplicado: lerNumero(celula(linha, mapa, 'valorAplicado')),
    instituicao: instituicaoDe(celula(linha, mapa, 'instituicao')),
    vencimento: lerData(celula(linha, mapa, 'vencimento')) ?? undefined,
    indexador: lerTexto(celula(linha, mapa, 'indexador')) || undefined,
  })
}

/** Pequena planilha-modelo para quem vai montar o próprio arquivo. */
export const MODELO_CSV = [
  'Data;Tipo;Ativo;Quantidade;Preço;Taxas',
  '05/03/2026;Compra;MXRF11;100;10,05;0',
  '12/03/2026;Compra;BBSE3;31;35,15;0',
  '20/04/2026;Dividendo;BBSE3;31;0,80;0',
  '15/05/2026;Venda;MXRF11;20;10,40;0',
  '02/06/2026;Compra;Tesouro Selic 2029;0,5;15.200,00;0',
].join('\n')

export function importarMatriz(matriz: Matriz, nomeAba = ''): ResultadoImportacao {
  const achado = acharCabecalho(matriz)
  if (!achado) {
    return {
      perfil: null,
      lancamentos: [],
      avisos: [],
      erros: [],
      linhasLidas: 0,
      erroGeral:
        'Não encontramos as colunas mínimas (Data, Tipo e Ativo/Produto) nas primeiras 30 linhas. Confira o arquivo ou use a planilha-modelo.',
    }
  }
  const { indice, mapa, perfil } = achado
  const origem: OrigemLancamento =
    perfil === 'b3-movimentacao' || perfil === 'b3-negociacao'
      ? perfil
      : perfil === 'b3-proventos-recebidos'
        ? 'b3-proventos'
        : 'arquivo'
  const ctx: Contexto = { origem, lancamentos: [], erros: [], ignorados: new Map(), posicao: [], futuros: [] }
  let linhasLidas = 0

  for (let i = indice + 1; i < matriz.length; i++) {
    const linha = matriz[i]
    if (linhaVazia(linha)) continue
    linhasLidas++
    const n = i + 1
    if (perfil === 'b3-calendario') continue
    if (perfil === 'b3-movimentacao') linhaB3Movimentacao(ctx, linha, mapa, n)
    else if (perfil === 'b3-negociacao') linhaB3Negociacao(ctx, linha, mapa, n)
    else if (perfil === 'b3-proventos-recebidos') linhaProventoRecebido(ctx, linha, mapa, n)
    else if (perfil === 'b3-proventos-a-receber') linhaProventoAReceber(ctx, linha, mapa, n)
    else if (perfil === 'b3-posicao') linhaPosicao(ctx, linha, mapa, n, nomeAba)
    else linhaGenerica(ctx, linha, mapa, n)
  }

  const avisos: string[] = []
  if (perfil === 'b3-movimentacao') {
    const limpo = desfazerProventosEmPares(ctx.lancamentos)
    ctx.lancamentos = limpo.mantidos
    if (limpo.descartados.length) {
      avisos.push(`${limpo.descartados.length} provento(s) repetidos em par (mesmo ativo, data e valor) foram descartados: são transferências de custódia, e a B3 não os conta como dinheiro recebido.`)
    }
    avisos.push(
      'Extrato de Movimentação da B3: a data é a da liquidação, não a da compra, e o preço é o médio consolidado. Para datas mais exatas, importe também o extrato de Negociação (sem sobrepor o mesmo período, para não contar a compra duas vezes).',
    )
  }
  if (perfil === 'b3-calendario') {
    avisos.push(
      'Este é o calendário de proventos do mercado, não o seu histórico. Para importar o que você recebeu, use o extrato de Movimentação ou o de Proventos Recebidos.',
    )
  }
  if (perfil === 'b3-proventos-a-receber') {
    avisos.push('Proventos a receber são previsões: não entram no histórico. Eles alimentam a agenda de proventos.')
  }
  if (perfil === 'b3-posicao') {
    avisos.push(
      'A Posição é uma foto do que você tem hoje: traz quantidade e valor atualizado, mas não a data de compra nem o preço médio (só o Tesouro informa o valor aplicado).',
    )
  }
  for (const [motivo, qtd] of ctx.ignorados) avisos.push(`${qtd} linha(s) ignorada(s): ${motivo}.`)

  const resultado: ResultadoImportacao = { perfil, lancamentos: ctx.lancamentos, avisos, erros: ctx.erros, linhasLidas }
  if (perfil === 'b3-posicao') resultado.posicao = ctx.posicao
  if (perfil === 'b3-proventos-a-receber') resultado.eventosFuturos = ctx.futuros
  return resultado
}
