// Minha Carteira (D36): o histórico de lançamentos é a FONTE DA VERDADE do painel. Posição,
// preço médio, resultado realizado e (nas próximas etapas) a rentabilidade contra CDI e
// outros benchmarks são todos DERIVADOS daqui. Quantidade + preço médio digitados não
// bastam para medir rentabilidade, porque ela depende de QUANDO cada real entrou.
//
// Módulo puro: sem rede, sem React, sem localStorage.

export type TipoLancamento =
  | 'saldoInicial' // "eu já tinha X a preço médio Y nesta data" (histórico incompleto)
  | 'compra'
  | 'venda'
  | 'bonificacao' // ações recebidas com custo atribuído (valor)
  | 'ajusteQuantidade' // desdobramento/grupamento: muda a quantidade (com sinal), custo total fica igual
  | 'provento'

export type SubtipoProvento = 'dividendo' | 'jcp' | 'rendimento' | 'amortizacao' | 'reembolso' | 'juros'

export type OrigemLancamento = 'manual' | 'b3-nota' | 'b3-movimentacao' | 'b3-negociacao' | 'b3-proventos' | 'arquivo'

export interface Lancamento {
  /** Estável: re-importar o mesmo arquivo gera os mesmos ids (ver mesclarLancamentos). */
  id: string
  /** AAAA-MM-DD */
  data: string
  tipo: TipoLancamento
  /** Ticker ou nome normalizado (maiúsculas, sem acento). */
  ativo: string
  /** Compra/venda/bonificação/saldoInicial: > 0. ajusteQuantidade: com sinal. provento: cotas (pode ser 0). */
  quantidade: number
  preco: number
  /** Total em R$ da operação, sem taxas. Provento: valor recebido. */
  valor: number
  /** Corretagem e emolumentos. Somam ao custo na compra e abatem o resultado na venda. */
  taxas: number
  subtipo?: SubtipoProvento
  instituicao?: string
  origem: OrigemLancamento
}

export type LancamentoNovo = Omit<Lancamento, 'id'>

const EPS = 1e-9

/**
 * Formato do ticker de renda variável da B3 (ação, FII, ETF, BDR): 4 caracteres, o 1º letra e os 3
 * seguintes letras OU DÍGITOS, mais 1 ou 2 dígitos. Os dígitos no meio existem: B3SA3 (a própria B3),
 * BDRs como A1MD34 e ETFs como B5P211. Exigir "4 letras" separava B3SA3 em dois ativos diferentes
 * (o ticker e o nome inteiro do produto) e quebrava a conciliação entre os extratos.
 * Fonte única da regra: todos os reconhecedores de ticker usam este padrão.
 */
export const PADRAO_TICKER = '[A-Z][A-Z0-9]{3}\\d{1,2}'
const RE_TICKER = new RegExp(`^${PADRAO_TICKER}$`)

export function ehTickerDeBolsa(ativo: string): boolean {
  return RE_TICKER.test(ativo)
}

/** Soma dias úteis (só fins de semana; feriados não entram). n pode ser negativo. */
export function somarDiasUteis(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const passo = n < 0 ? -1 : 1
  let falta = Math.abs(n)
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + passo)
    const dia = d.getUTCDay()
    if (dia !== 0 && dia !== 6) falta--
  }
  return d.toISOString().slice(0, 10)
}

/** Dentro do mesmo dia: o que aumenta posição vem antes do que a reduz. */
const ORDEM_NO_DIA: Record<TipoLancamento, number> = {
  saldoInicial: 0,
  compra: 1,
  bonificacao: 2,
  ajusteQuantidade: 3,
  provento: 4,
  venda: 5,
}

export function ordenarLancamentos<T extends { data: string; tipo: TipoLancamento }>(lancs: T[]): T[] {
  return [...lancs].sort((a, b) => a.data.localeCompare(b.data) || ORDEM_NO_DIA[a.tipo] - ORDEM_NO_DIA[b.tipo])
}

const num = (n: number) => String(Number(n.toFixed(8)))

/**
 * Tudo que identifica o lançamento, exceto o número da ocorrência.
 * Em PROVENTO o preço unitário fica de fora: é só uma exibição, arredondada de modo diferente
 * em cada extrato da B3 (a Movimentação mostra 0,064 e os Proventos Recebidos, 0,06 para o
 * mesmo pagamento). O fato econômico é o valor pago; assim o mesmo provento vindo de dois
 * extratos é reconhecido como um só.
 */
export function chaveLancamento(l: LancamentoNovo): string {
  const preco = l.tipo === 'provento' ? '' : num(l.preco)
  return [l.data, l.tipo, l.ativo, num(l.quantidade), preco, num(l.valor), num(l.taxas), l.subtipo ?? '', l.instituicao ?? ''].join('|')
}

/**
 * Conciliação entre os extratos da B3. O extrato de MOVIMENTAÇÃO e o de NEGOCIAÇÃO trazem as
 * MESMAS compras e vendas de renda variável, com datas diferentes: a Movimentação usa a data de
 * LIQUIDAÇÃO (D+2 úteis) e a Negociação, a do NEGÓCIO. Somar os dois contaria tudo em dobro.
 *
 * Regra: onde há Negociação, ela manda. Uma compra/venda de ticker da Movimentação é descartada
 * se a data do negócio correspondente (liquidação − 2 dias úteis) cai dentro do período coberto
 * pela Negociação. Fora desse período a Movimentação é a única fonte e fica. Tesouro e renda
 * fixa nunca aparecem na Negociação, então nunca são descartados. Feriados não entram na conta;
 * nas bordas do período isso pode errar por um dia.
 */
type Conciliavel = { data: string; tipo: TipoLancamento; ativo: string; origem: OrigemLancamento }

/**
 * Prioridade das fontes de compra/venda: NOTA DE NEGOCIAÇÃO > Negociação > Movimentação.
 * A nota é o documento da corretora: tem a data do negócio, cada execução e as taxas.
 * A nota cobre um negócio por (data, ativo): ela substitui, naquele dia e ativo, o que vier
 * da Negociação (mesma data) ou da Movimentação (data de liquidação − 2 dias úteis).
 * Limite conhecido: se a pessoa operar o MESMO ativo no MESMO dia em duas corretoras e só
 * tiver a nota de uma, os negócios da outra, vindos da Negociação, seriam descartados.
 */
function chaveNota(data: string, ativo: string): string {
  return `${data}|${ativo}`
}

function datasDeNota(ls: Conciliavel[]): Set<string> {
  return new Set(ls.filter((l) => l.origem === 'b3-nota' && (l.tipo === 'compra' || l.tipo === 'venda')).map((l) => chaveNota(l.data, l.ativo)))
}

function coberto(l: Conciliavel, janela: { ini: string; fim: string } | null, notas: Set<string>): boolean {
  if (l.tipo !== 'compra' && l.tipo !== 'venda') return false
  if (l.origem === 'b3-negociacao') return notas.has(chaveNota(l.data, l.ativo))
  if (l.origem !== 'b3-movimentacao' || !ehTickerDeBolsa(l.ativo)) return false
  const negocio = somarDiasUteis(l.data, -2)
  if (notas.has(chaveNota(negocio, l.ativo))) return true
  return !!janela && negocio >= janela.ini && negocio <= janela.fim
}

/**
 * O MESMO provento vindo de dois extratos: a Movimentação traz a data do CRÉDITO e os Proventos Recebidos, a do
 * PAGAMENTO, e as duas podem divergir em um dia (fim de semana, feriado); a instituição e a quantidade também
 * podem ser escritas de outro jeito. Se vierem pagamentos do mesmo ativo, com o mesmo valor, em até 4 dias,
 * de fontes diferentes, é um pagamento só. Fica o dos Proventos Recebidos, que é o que a B3 usa na página de
 * Proventos; o da Movimentação é descartado. Dois pagamentos iguais da MESMA fonte nunca são fundidos.
 */
const JANELA_PROVENTO_DIAS = 4
const diasEntre = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

function indiceDeProventosRecebidos(ls: Conciliavel[] & { valor?: number }[]): Map<string, string[]> {
  const idx = new Map<string, string[]>()
  for (const l of ls as (Conciliavel & { valor: number })[]) {
    if (l.tipo !== 'provento' || l.origem !== 'b3-proventos') continue
    const k = `${l.ativo}|${l.valor.toFixed(2)}`
    idx.set(k, [...(idx.get(k) ?? []), l.data])
  }
  return idx
}

function proventoDuplicadoEntreFontes(l: Conciliavel & { valor: number }, idx: Map<string, string[]>): boolean {
  if (l.tipo !== 'provento' || l.origem !== 'b3-movimentacao') return false
  return (idx.get(`${l.ativo}|${l.valor.toFixed(2)}`) ?? []).some((d) => diasEntre(d, l.data) <= JANELA_PROVENTO_DIAS)
}

/**
 * Proventos da MOVIMENTAÇÃO que vêm REPETIDOS EM PAR (mesma data, ativo, tipo e valor) não são dinheiro recebido:
 * são o rastro de uma transferência de custódia entre corretoras (um lado crédito, o outro débito) e a B3 não os
 * conta na página de Proventos. Caso real que originou a regra: em agosto, 10 grupos assim somavam R$ 1.084,62
 * (2 x 542,31) e, ao tirá-los, o mês passou de R$ 1.897,61 para R$ 812,99, exatamente o valor da B3.
 *
 * Os lançamentos se cancelam de dois em dois: com 2 ou 4 cópias não sobra nenhuma; com 3, sobra 1 (o pagamento
 * verdadeiro mais um par). Só vale para a Movimentação: nos Proventos recebidos não existe esse rastro.
 * Ignora instituição e quantidade de propósito: a transferência tem a corretora de origem num lado e a de
 * destino no outro.
 */
export function desfazerProventosEmPares<T extends { tipo: TipoLancamento; origem: OrigemLancamento; data: string; ativo: string; subtipo?: SubtipoProvento; valor: number }>(
  ls: readonly T[],
): { mantidos: T[]; descartados: T[] } {
  const grupos = new Map<string, number[]>()
  ls.forEach((l, i) => {
    if (l.tipo !== 'provento' || l.origem !== 'b3-movimentacao') return
    const k = `${l.data}|${l.ativo}|${l.subtipo ?? ''}|${l.valor.toFixed(2)}`
    grupos.set(k, [...(grupos.get(k) ?? []), i])
  })
  const fora = new Set<number>()
  for (const indices of grupos.values()) for (let j = 0; j < Math.floor(indices.length / 2) * 2; j++) fora.add(indices[j])
  return { mantidos: ls.filter((_, i) => !fora.has(i)), descartados: ls.filter((_, i) => fora.has(i)) }
}

function janelaNegociacao(ls: { data: string; tipo: TipoLancamento; origem: OrigemLancamento }[]): { ini: string; fim: string } | null {
  const datas = ls.filter((l) => l.origem === 'b3-negociacao' && (l.tipo === 'compra' || l.tipo === 'venda')).map((l) => l.data).sort()
  return datas.length ? { ini: datas[0], fim: datas[datas.length - 1] } : null
}

/**
 * Junta lançamentos novos aos existentes SEM duplicar e SEM apagar operações legítimas
 * idênticas. Duas compras iguais no mesmo dia (mesma quantidade e preço) são comuns e
 * valem as duas; por isso contamos ocorrências: se o arquivo traz 2 e já existem 2, entram 0.
 * Reimportar o mesmo arquivo, ou um período que se sobrepõe ao anterior, não duplica nada.
 * Também concilia Movimentação x Negociação (ver acima), em qualquer ordem de importação.
 * `excluidas` são os ids que a pessoa removeu ou corrigiu (ver excluirLancamento/corrigirLancamento).
 */
export function mesclarLancamentos(
  existentes: Lancamento[],
  novos: LancamentoNovo[],
  excluidas: readonly string[] = [],
): { lancamentos: Lancamento[]; adicionados: number; repetidos: number; substituidos: number; cobertos: number } {
  const jaTem = new Map<string, number>()
  for (const e of existentes) {
    const k = chaveLancamento(e)
    jaTem.set(k, (jaTem.get(k) ?? 0) + 1)
  }
  // Lançamentos que a pessoa excluiu ou corrigiu ocupam a vaga: reimportar o extrato não os traz de volta.
  for (const id of excluidas) {
    const k = id.slice(0, id.lastIndexOf('#'))
    jaTem.set(k, (jaTem.get(k) ?? 0) + 1)
  }
  const noArquivo = new Map<string, number>()
  const candidatos: Lancamento[] = []
  const idsNovos = new Set<string>()
  let repetidos = 0
  for (const n of novos) {
    const k = chaveLancamento(n)
    const ocorrencia = (noArquivo.get(k) ?? 0) + 1
    noArquivo.set(k, ocorrencia)
    if (ocorrencia <= (jaTem.get(k) ?? 0)) {
      repetidos++
      continue
    }
    const l: Lancamento = { ...n, id: `${k}#${ocorrencia}` }
    candidatos.push(l)
    idsNovos.add(l.id)
  }

  const todos = [...existentes, ...candidatos]
  const janela = janelaNegociacao(todos)
  const notas = datasDeNota(todos)
  const proventosRecebidos = indiceDeProventosRecebidos(todos)
  let substituidos = 0
  let cobertos = 0
  const finais = todos.filter((l) => {
    if (!coberto(l, janela, notas) && !proventoDuplicadoEntreFontes(l, proventosRecebidos)) return true
    if (idsNovos.has(l.id)) cobertos++
    else substituidos++
    return false
  })
  return {
    lancamentos: ordenarLancamentos(finais),
    adicionados: candidatos.length - cobertos,
    repetidos,
    substituidos,
    cobertos,
  }
}

export interface PosicaoDerivada {
  ativo: string
  quantidade: number
  /** Custo total da quantidade atual (inclui taxas das compras). */
  custoTotal: number
  precoMedio: number
  resultadoRealizado: number
  proventos: number
  primeiraCompra: string | null
}

export interface AvisoPosicao {
  ativo: string
  data: string
  tipo: 'vendaSemSaldo' | 'ajusteSemSaldo'
  /** Quanto faltou para cobrir a operação. Indica histórico incompleto. */
  faltou: number
}

export function derivarPosicoes(lancamentos: Lancamento[]): { posicoes: PosicaoDerivada[]; avisos: AvisoPosicao[] } {
  const estado = new Map<string, PosicaoDerivada>()
  const avisos: AvisoPosicao[] = []
  const get = (ativo: string) => {
    let s = estado.get(ativo)
    if (!s) {
      s = { ativo, quantidade: 0, custoTotal: 0, precoMedio: 0, resultadoRealizado: 0, proventos: 0, primeiraCompra: null }
      estado.set(ativo, s)
    }
    return s
  }

  for (const l of ordenarLancamentos(lancamentos)) {
    const s = get(l.ativo)
    switch (l.tipo) {
      case 'saldoInicial':
      case 'compra':
      case 'bonificacao':
        s.quantidade += l.quantidade
        s.custoTotal += l.valor + l.taxas
        if (!s.primeiraCompra) s.primeiraCompra = l.data
        break
      case 'venda': {
        const vendida = Math.min(l.quantidade, s.quantidade)
        if (l.quantidade - s.quantidade > EPS) {
          avisos.push({ ativo: l.ativo, data: l.data, tipo: 'vendaSemSaldo', faltou: l.quantidade - s.quantidade })
        }
        if (vendida > EPS) {
          const fracao = vendida / l.quantidade
          const pm = s.quantidade > 0 ? s.custoTotal / s.quantidade : 0
          const custoBaixado = pm * vendida
          s.resultadoRealizado += (l.valor - l.taxas) * fracao - custoBaixado
          s.quantidade -= vendida
          s.custoTotal -= custoBaixado
        }
        break
      }
      case 'ajusteQuantidade': {
        const nova = s.quantidade + l.quantidade
        if (nova < -EPS) {
          avisos.push({ ativo: l.ativo, data: l.data, tipo: 'ajusteSemSaldo', faltou: -nova })
          s.quantidade = 0
        } else {
          s.quantidade = Math.max(0, nova)
        }
        break
      }
      case 'provento':
        s.proventos += l.valor
        break
    }
    if (s.quantidade < EPS) {
      s.quantidade = 0
      s.custoTotal = 0
    }
    s.precoMedio = s.quantidade > 0 ? s.custoTotal / s.quantidade : 0
  }
  return { posicoes: [...estado.values()].sort((a, b) => a.ativo.localeCompare(b.ativo)), avisos }
}

export function posicoesAbertas(posicoes: PosicaoDerivada[]): PosicaoDerivada[] {
  return posicoes.filter((p) => p.quantidade > 0)
}

export interface ProblemaLancamento {
  campo: 'data' | 'ativo' | 'quantidade' | 'preco' | 'valor'
  motivo: string
}

/** Validação usada pelo cadastro manual e pelos importadores. */
export function validarLancamento(l: LancamentoNovo): ProblemaLancamento | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data)) return { campo: 'data', motivo: 'Data inválida.' }
  if (!l.ativo.trim()) return { campo: 'ativo', motivo: 'Informe o ativo.' }
  if (l.tipo === 'ajusteQuantidade') {
    return l.quantidade !== 0 ? null : { campo: 'quantidade', motivo: 'A quantidade do ajuste não pode ser zero.' }
  }
  if (l.tipo === 'provento') {
    return l.valor > 0 ? null : { campo: 'valor', motivo: 'O valor do provento deve ser maior que zero.' }
  }
  if (!(l.quantidade > 0)) return { campo: 'quantidade', motivo: 'A quantidade deve ser maior que zero.' }
  if (l.tipo !== 'bonificacao' && !(l.preco > 0)) return { campo: 'preco', motivo: 'O preço deve ser maior que zero.' }
  if (!(l.valor >= 0)) return { campo: 'valor', motivo: 'Valor inválido.' }
  return null
}

/**
 * Entrada MANUAL: sempre entra, nunca é descartada como "repetida". A deduplicação existe para
 * extratos (reimportar o mesmo arquivo); quem digita duas compras iguais no mesmo dia quis as duas.
 */
function anexarManual(lancamentos: Lancamento[], excluidas: readonly string[], novo: LancamentoNovo): Lancamento[] {
  const k = chaveLancamento(novo)
  const usados = new Set([...lancamentos.map((l) => l.id), ...excluidas])
  let n = 1
  while (usados.has(`${k}#${n}`)) n++
  return ordenarLancamentos([...lancamentos, { ...novo, id: `${k}#${n}` }])
}

/**
 * Livro de lançamentos + o que a pessoa descartou. Guardar `excluidas` é o que impede que o
 * lançamento errado de um extrato volte a cada nova importação.
 */
export interface Livro {
  lancamentos: Lancamento[]
  excluidas: string[]
}

/** Exclui um lançamento. Se veio de um extrato, lembra do id para a reimportação não o trazer de volta. */
export function excluirLancamento(livro: Livro, id: string): Livro {
  const alvo = livro.lancamentos.find((l) => l.id === id)
  if (!alvo) return livro
  return {
    lancamentos: livro.lancamentos.filter((l) => l.id !== id),
    excluidas: alvo.origem === 'manual' ? livro.excluidas : [...livro.excluidas, id],
  }
}

/**
 * Corrige um lançamento (ex.: preço errado, quantidade de um desdobramento). O original sai
 * e é lembrado como excluído; a versão corrigida entra como lançamento da própria pessoa
 * (origem "manual"), que nenhuma importação ou conciliação mexe depois.
 */
export function corrigirLancamento(
  livro: Livro,
  id: string,
  correcao: Partial<Omit<LancamentoNovo, 'origem'>>,
): { livro: Livro; problema: ProblemaLancamento | null } {
  const original = livro.lancamentos.find((l) => l.id === id)
  if (!original) return { livro, problema: null }
  const { id: _id, ...base } = original
  void _id
  const novo: LancamentoNovo = { ...base, ...correcao, origem: 'manual' }
  const problema = validarLancamento(novo)
  if (problema) return { livro, problema }
  const semOriginal = excluirLancamento(livro, id)
  return {
    livro: { lancamentos: anexarManual(semOriginal.lancamentos, semOriginal.excluidas, novo), excluidas: semOriginal.excluidas },
    problema: null,
  }
}

/** Lançamento da própria pessoa (compra, venda, saldo inicial, provento...). Valida antes de entrar. */
export function adicionarLancamento(livro: Livro, novo: Omit<LancamentoNovo, 'origem'>): { livro: Livro; problema: ProblemaLancamento | null } {
  const completo: LancamentoNovo = { ...novo, ativo: novo.ativo.trim().toUpperCase(), origem: 'manual' }
  const problema = validarLancamento(completo)
  if (problema) return { livro, problema }
  return { livro: { lancamentos: anexarManual(livro.lancamentos, livro.excluidas, completo), excluidas: livro.excluidas }, problema: null }
}
