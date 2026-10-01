// Minha Carteira (D36): o que fica gravado no aparelho e como uma importação o altera. Tudo puro
// (sem React nem localStorage): o hook só chama estas funções. Nada daqui vai para a API.
import type { EventoFuturo, ItemPosicaoB3, ResultadoImportacao } from './importacao/planilha'
import { mesclarLancamentos, somarDiasUteis, validarLancamento, type Lancamento, type OrigemLancamento, type TipoLancamento } from './lancamentos'

export const CHAVE_CARTEIRA = 'carteiraideal.carteira'
export const VERSAO_CARTEIRA = 1

export interface CarteiraSalva {
  lancamentos: Lancamento[]
  /** Ids que a pessoa excluiu ou corrigiu: a reimportação não os traz de volta. */
  excluidas: string[]
  posicao: ItemPosicaoB3[] | null
  /** Data a que a Posição se refere (AAAA-MM-DD). */
  dataPosicao: string | null
  eventosFuturos: EventoFuturo[]
}

export const CARTEIRA_VAZIA: CarteiraSalva = { lancamentos: [], excluidas: [], posicao: null, dataPosicao: null, eventosFuturos: [] }

export function carteiraVazia(): CarteiraSalva {
  return { lancamentos: [], excluidas: [], posicao: null, dataPosicao: null, eventosFuturos: [] }
}

const TIPOS = new Set<TipoLancamento>(['saldoInicial', 'compra', 'venda', 'bonificacao', 'ajusteQuantidade', 'provento'])
const ORIGENS = new Set<OrigemLancamento>(['manual', 'b3-nota', 'b3-movimentacao', 'b3-negociacao', 'b3-proventos', 'arquivo'])
const CATEGORIAS = new Set(['acoes', 'bdr', 'etf', 'fundos', 'tesouro', 'outra'])
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const txt = (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''
const ISO = /^\d{4}-\d{2}-\d{2}$/

function lancamentoValido(x: unknown): Lancamento | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (!txt(o.id) || !txt(o.data) || !ISO.test(o.data) || !txt(o.ativo)) return null
  if (!TIPOS.has(o.tipo as TipoLancamento) || !ORIGENS.has(o.origem as OrigemLancamento)) return null
  if (!num(o.quantidade) || !num(o.preco) || !num(o.valor) || !num(o.taxas)) return null
  const l: Lancamento = {
    id: o.id,
    data: o.data,
    tipo: o.tipo as TipoLancamento,
    ativo: o.ativo,
    quantidade: o.quantidade,
    preco: o.preco,
    valor: o.valor,
    taxas: o.taxas,
    origem: o.origem as OrigemLancamento,
  }
  if (o.subtipo === 'dividendo' || o.subtipo === 'jcp' || o.subtipo === 'rendimento') l.subtipo = o.subtipo
  if (txt(o.instituicao)) l.instituicao = o.instituicao
  const { id: _id, ...sem } = l
  void _id
  return validarLancamento(sem) === null ? l : null
}

function itemPosicaoValido(x: unknown): ItemPosicaoB3 | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (!txt(o.ativo) || !CATEGORIAS.has(o.categoria as string) || !num(o.quantidade) || !num(o.valorAtualizado)) return null
  return {
    ativo: o.ativo,
    categoria: o.categoria as ItemPosicaoB3['categoria'],
    quantidade: o.quantidade,
    precoFechamento: num(o.precoFechamento) ? o.precoFechamento : null,
    valorAtualizado: o.valorAtualizado,
    valorAplicado: num(o.valorAplicado) ? o.valorAplicado : null,
    ...(txt(o.instituicao) ? { instituicao: o.instituicao } : {}),
    ...(txt(o.vencimento) ? { vencimento: o.vencimento } : {}),
    ...(txt(o.indexador) ? { indexador: o.indexador } : {}),
  }
}

function eventoValido(x: unknown): EventoFuturo | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (!txt(o.ativo) || !txt(o.previsao) || !ISO.test(o.previsao) || !num(o.valorLiquido) || !num(o.quantidade) || !num(o.precoUnitario)) return null
  const t = o.tipoEvento
  return {
    ativo: o.ativo,
    tipoEvento: t === 'dividendo' || t === 'jcp' || t === 'rendimento' ? t : 'outro',
    previsao: o.previsao,
    quantidade: o.quantidade,
    precoUnitario: o.precoUnitario,
    valorLiquido: o.valorLiquido,
    ...(txt(o.instituicao) ? { instituicao: o.instituicao } : {}),
  }
}

const lista = <T,>(x: unknown, valida: (v: unknown) => T | null): T[] => (Array.isArray(x) ? x.map(valida).filter((v): v is T => v !== null) : [])

/** Lê o que está gravado. Devolve null sem dado, com versão diferente ou JSON quebrado; descarta só os itens inválidos. */
export function lerCarteiraSalva(bruto: string | null): CarteiraSalva | null {
  if (!bruto) return null
  try {
    const o = JSON.parse(bruto) as { versao?: number; carteira?: Record<string, unknown> } | null
    if (o?.versao !== VERSAO_CARTEIRA || !o.carteira || typeof o.carteira !== 'object') return null
    const c = o.carteira
    const posicao = Array.isArray(c.posicao) ? lista(c.posicao, itemPosicaoValido) : null
    return {
      lancamentos: lista(c.lancamentos, lancamentoValido),
      excluidas: Array.isArray(c.excluidas) ? c.excluidas.filter(txt) : [],
      posicao: posicao && posicao.length ? posicao : null,
      dataPosicao: txt(c.dataPosicao) && ISO.test(c.dataPosicao) ? c.dataPosicao : null,
      eventosFuturos: lista(c.eventosFuturos, eventoValido),
    }
  } catch {
    return null
  }
}

export function serializarCarteira(carteira: CarteiraSalva): string {
  return JSON.stringify({ versao: VERSAO_CARTEIRA, carteira })
}

/** Data da Posição: o pregão ANTERIOR ao dia do download (o nome do arquivo traz o dia), ou ao de hoje. */
export function dataDaPosicaoPeloNome(nomeArquivo: string, hoje: string): string {
  const m = nomeArquivo.match(/(\d{4})-(\d{2})-(\d{2})/)
  const base = m && !Number.isNaN(Date.parse(`${m[1]}-${m[2]}-${m[3]}`)) ? `${m[1]}-${m[2]}-${m[3]}` : hoje
  return somarDiasUteis(base, -1)
}

export interface ResumoArquivo {
  nome: string
  perfil: ResultadoImportacao['perfil']
  adicionados: number
  repetidos: number
  /** Já estavam no livro e foram trocados por uma fonte melhor (a nota > Negociação > Movimentação). */
  substituidos: number
  /** Chegaram agora mas já estavam cobertos por uma fonte melhor. */
  cobertos: number
  posicaoItens: number
  eventosFuturos: number
  erros: number
  avisos: string[]
  erroGeral?: string
}

export interface ArquivoImportado {
  nome: string
  resultado: ResultadoImportacao
}

/** Aplica os arquivos lidos à carteira. Posição e agenda: o arquivo mais novo substitui o anterior. */
export function aplicarImportacao(carteira: CarteiraSalva, arquivos: ArquivoImportado[], hoje: string): { carteira: CarteiraSalva; resumos: ResumoArquivo[] } {
  let atual = carteira
  const resumos: ResumoArquivo[] = []
  for (const { nome, resultado: r } of arquivos) {
    const m = mesclarLancamentos(atual.lancamentos, r.lancamentos, atual.excluidas)
    atual = { ...atual, lancamentos: m.lancamentos }
    if (r.posicao?.length) atual = { ...atual, posicao: r.posicao, dataPosicao: dataDaPosicaoPeloNome(nome, hoje) }
    if (r.eventosFuturos?.length) atual = { ...atual, eventosFuturos: r.eventosFuturos }
    resumos.push({
      nome,
      perfil: r.perfil,
      adicionados: m.adicionados,
      repetidos: m.repetidos,
      substituidos: m.substituidos,
      cobertos: m.cobertos,
      posicaoItens: r.posicao?.length ?? 0,
      eventosFuturos: r.eventosFuturos?.length ?? 0,
      erros: r.erros.length,
      avisos: r.avisos,
      ...(r.erroGeral ? { erroGeral: r.erroGeral } : {}),
    })
  }
  return { carteira: atual, resumos }
}
