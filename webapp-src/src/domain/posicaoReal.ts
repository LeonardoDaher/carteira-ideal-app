import { diasUteis, moneyness, vencimentosDe, tipoVencimento } from './opcoes'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'
import { escadaDeStrikes, indiceDoMaisPerto } from './modelosDeEstrategia'
import { rolar } from './rolagem'
import type { Alvo, ParametrosDeManejo, PernaDaEstrutura } from './rolagem'
import {
  DIAS_UTEIS_ANO, analisar, analisarEstimado, gregas, temVariosVencimentos, volatilidadeImplicita,
} from './simulaOpcoes'
import type { Analise, Lado, Perna, Posicao } from './simulaOpcoes'

/**
 * Posição de opções que a pessoa já tem: ela informa as séries, o lado, a quantidade e o preço da operação (e, se houver, as
 * ações), e o app avalia como a posição está HOJE, pelo último preço de cada série, que estrutura ela forma e que saídas existem
 * (encerrar, fechar uma perna, rolar, proteger), cada uma com o resultado e o novo risco. Descritivo, sem indicar operação.
 */

const sinal = (l: Lado) => (l === 'compra' ? 1 : -1)
const SIGMA_PADRAO = 0.35

export interface PernaCadastrada {
  id: string
  /** Código da série na B3, como no cadastro do app (ex.: PETRK600). */
  codigo: string
  lado: Lado
  quantidade: number
  /** Preço por opção pago (compra) ou recebido (venda) na operação. */
  premio: number
}

export interface AcoesCadastradas {
  quantidade: number
  precoMedio: number
}

export interface PosicaoCadastrada {
  ticker: string
  pernas: PernaCadastrada[]
  acoes: AcoesCadastradas | null
  /** Data em que a posição foi montada (AAAA-MM-DD), opcional. */
  montadaEm: string | null
  /** Preço do ativo na montagem, opcional. */
  precoNaMontagem: number | null
}

export interface PernaResolvida {
  cadastrada: PernaCadastrada
  serie: SerieOpcao
  /** Perna para o motor: preço da operação como prêmio, prazo de hoje e volatilidade implícita do preço de mercado de hoje. */
  perna: Perna
  /** Dias úteis até o vencimento, a partir do pregão de referência (no mínimo 1). */
  dias: number
}

export interface PosicaoResolvida {
  resolvidas: PernaResolvida[]
  /** Pernas cujo código não está mais na lista (vencida, sem negócio recente ou fora dos 6 meses). */
  semSerie: PernaCadastrada[]
}

export function parametrosDeManejo(ativo: AtivoComOpcoes, r: number): ParametrosDeManejo {
  return { precoHoje: ativo.cotacao, r, sigmaPadrao: SIGMA_PADRAO }
}

/** Liga cada perna cadastrada à série real e calibra a volatilidade no preço de mercado de hoje (último negócio). */
export function resolverPosicao(pos: PosicaoCadastrada, ativo: AtivoComOpcoes, hoje: string, r: number): PosicaoResolvida {
  const resolvidas: PernaResolvida[] = []
  const semSerie: PernaCadastrada[] = []
  for (const c of pos.pernas) {
    const serie = ativo.series.find((s) => s.codigo === c.codigo)
    if (!serie) {
      semSerie.push(c)
      continue
    }
    const dias = Math.max(diasUteis(serie.vencimento, hoje), 1)
    const sigma = volatilidadeImplicita({ tipo: serie.tipo, s: ativo.cotacao, strike: serie.strike, t: dias / DIAS_UTEIS_ANO, r }, serie.ultimo) ?? SIGMA_PADRAO
    resolvidas.push({
      cadastrada: c, serie, dias,
      perna: { tipo: serie.tipo, lado: c.lado, strike: serie.strike, premio: c.premio, quantidade: c.quantidade, dias, sigma },
    })
  }
  return { resolvidas, semSerie }
}

export function posicaoParaOMotor(res: PernaResolvida[], acoes: AcoesCadastradas | null, realizado = 0): Posicao {
  return { pernas: res.map((x) => x.perna), acoes: acoes?.quantidade ?? 0, precoAcao: acoes?.precoMedio ?? 0, realizado }
}

/** Ganho e perda máximos e equilíbrios: exatos com um vencimento só; estimados (data do primeiro vencimento) com vários. */
export function analisarPosicao(p: Posicao, preco: number, r: number): Analise & { estimado: boolean } {
  if (p.pernas.length > 0 && temVariosVencimentos(p)) {
    const dias = Math.min(...p.pernas.map((x) => x.dias ?? 0).filter((d) => d > 0), 9999)
    return { ...analisarEstimado(p, preco, { dias, r, sigma: SIGMA_PADRAO }), estimado: true }
  }
  return { ...analisar(p), estimado: false }
}

// ---------------------------------------------------------------------------------------
// Que estrutura é esta?
// ---------------------------------------------------------------------------------------

export interface EstruturaIdentificada {
  titulo: string
  /** Frase curta sobre o que a estrutura faz. */
  resumo: string
}

const mesmo = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** Reconhece a estrutura pelas pernas (tipo, lado, strike, vencimento e proporção) e pelas ações. */
export function identificarEstrutura(res: PernaResolvida[], acoes: AcoesCadastradas | null): EstruturaIdentificada {
  const pernas = [...res].sort((a, b) => a.serie.vencimento.localeCompare(b.serie.vencimento) || a.serie.tipo.localeCompare(b.serie.tipo) || a.serie.strike - b.serie.strike)
  const n = pernas.length
  const temAcoes = (acoes?.quantidade ?? 0) > 0
  const mesmoVenc = new Set(pernas.map((x) => x.serie.vencimento)).size === 1
  const de = (tipo: 'call' | 'put') => pernas.filter((x) => x.serie.tipo === tipo)
  const calls = de('call')
  const puts = de('put')
  const L = (x: PernaResolvida) => x.cadastrada.lado
  const K = (x: PernaResolvida) => x.serie.strike
  const Q = (x: PernaResolvida) => x.cadastrada.quantidade
  const fazer = (titulo: string, resumo: string): EstruturaIdentificada => ({ titulo, resumo })
  const personalizada = fazer('Estrutura personalizada', 'As pernas não formam uma das estruturas conhecidas; a análise abaixo vale do mesmo jeito, perna a perna.')

  if (n === 0) return temAcoes ? fazer('Só ações', 'Há ações cadastradas, sem opções.') : personalizada

  if (n === 1) {
    const x = pernas[0]
    if (x.serie.tipo === 'call') {
      if (L(x) === 'compra') return fazer('Compra de call', 'Aposta na alta; a perda é o prêmio pago.')
      return temAcoes ? fazer('Venda coberta', 'Você tem as ações e vendeu uma call: recebe o prêmio e limita a alta.') : fazer('Venda de call descoberta', 'Recebe o prêmio, mas a perda não tem limite se o ativo disparar.')
    }
    if (L(x) === 'compra') return fazer(temAcoes ? 'Ações com put de proteção' : 'Compra de put', temAcoes ? 'Put comprada protegendo as ações.' : 'Aposta na queda; a perda é o prêmio pago.')
    return fazer('Venda de put', 'Recebe o prêmio e pode ter de comprar o ativo pelo strike.')
  }

  if (n === 2) {
    const [a, b] = pernas
    if (mesmoVenc && a.serie.tipo === b.serie.tipo) {
      const baixo = K(a) <= K(b) ? a : b
      const alto = baixo === a ? b : a
      if (mesmo(K(a), K(b)) || L(a) === L(b)) return personalizada
      if (calls.length === 2) return L(baixo) === 'compra' ? fazer('Trava de alta com calls', 'Compra a call de strike menor e vende a de strike maior: ganho e perda limitados.') : fazer('Trava de baixa com calls', 'Vende a call de strike menor e compra a de strike maior: recebe crédito, com ganho e perda limitados.')
      return L(alto) === 'compra' ? fazer('Trava de baixa com puts', 'Compra a put de strike maior e vende a de strike menor: ganho e perda limitados.') : fazer('Trava de alta com puts', 'Vende a put de strike maior e compra a de strike menor: recebe crédito, com ganho e perda limitados.')
    }
    if (mesmoVenc && calls.length === 1 && puts.length === 1) {
      const c = calls[0]
      const p = puts[0]
      if (temAcoes && L(c) === 'venda' && L(p) === 'compra') return fazer('Collar', 'Você tem as ações, comprou a put de proteção e vendeu a call: limita a perda e o ganho.')
      if (L(c) === L(p)) {
        const compradas = L(c) === 'compra'
        if (mesmo(K(c), K(p))) return compradas ? fazer('Straddle comprado', 'Compra call e put no mesmo strike: ganha se o ativo se mexer bastante para qualquer lado.') : fazer('Straddle vendido', 'Vende call e put no mesmo strike: recebe os dois prêmios se o ativo ficar parado; o risco é grande.')
        if (K(p) < K(c)) return compradas ? fazer('Strangle comprado', 'Compra put abaixo e call acima: ganha com movimento grande para qualquer lado.') : fazer('Strangle vendido', 'Vende put abaixo e call acima: recebe os prêmios se o ativo ficar entre os strikes; o risco é grande.')
      }
    }
    if (!mesmoVenc && a.serie.tipo === b.serie.tipo && L(a) !== L(b)) {
      const curta = a.serie.vencimento < b.serie.vencimento ? a : b
      const longa = curta === a ? b : a
      if (L(longa) === 'compra' && L(curta) === 'venda') {
        const tipo = a.serie.tipo === 'call' ? 'calls' : 'puts'
        return mesmo(K(a), K(b)) ? fazer(`Trava horizontal de ${tipo} (THL)`, 'Comprou a opção de vencimento mais longo e vendeu a mais curta no mesmo strike: colhe o valor de tempo da curta.') : fazer(`Trava diagonal de ${tipo}`, 'Comprou a opção de vencimento mais longo e vendeu a mais curta, com strikes diferentes.')
      }
    }
    return personalizada
  }

  if (n === 3 && mesmoVenc) {
    const mesmoTipo = calls.length === 3 || puts.length === 3
    const [a, b, c] = mesmoTipo ? pernas : [pernas[0], pernas[1], pernas[2]]
    if (mesmoTipo) {
      if (L(a) === 'compra' && L(b) === 'venda' && L(c) === 'compra' && mesmo(K(b) - K(a), K(c) - K(b)) && Q(b) === 2 * Q(a) && Q(a) === Q(c))
        return fazer(calls.length === 3 ? 'Borboleta de calls' : 'Borboleta de puts', 'Compra uma opção abaixo, vende duas no meio e compra uma acima: ganha mais com o ativo no strike do meio.')
      if (puts.length === 3 && L(c) === 'compra' && L(a) === 'venda' && L(b) === 'venda') return fazer('Slide com put', 'Compra uma put de strike maior e vende duas de strikes menores.')
      if (puts.length === 3 && L(a) === 'venda' && L(b) === 'venda' && L(c) === 'compra') return fazer('Slide com put', 'Compra uma put de strike maior e vende duas de strikes menores.')
    }
    if (puts.length === 1 && calls.length === 2) {
      const p = puts[0]
      const [c1, c2] = calls
      if (L(p) === 'venda' && L(c1) === 'venda' && L(c2) === 'compra') return fazer('Put vendida otimizada', 'Vende uma put e uma trava de baixa com calls: os dois créditos somam, e o risco de baixo é o da put.')
      if (temAcoes && L(p) === 'venda' && L(c1) === 'compra' && L(c2) === 'venda') return fazer('Booster', 'Ações com trava de alta financiada por uma put vendida.')
    }
    return personalizada
  }

  if (n === 4 && mesmoVenc) {
    if (calls.length === 2 && puts.length === 2) {
      const [p1, p2] = puts
      const [c1, c2] = calls
      if (L(p1) === 'compra' && L(p2) === 'venda' && L(c1) === 'venda' && L(c2) === 'compra')
        return mesmo(K(p2), K(c1)) ? fazer('Borboleta de ferro', 'Vende call e put no mesmo strike e compra as asas: recebe crédito, ganho máximo com o ativo parado.') : fazer('Condor de ferro', 'Vende put e call afastadas e compra as asas: ganha o crédito se o ativo ficar numa faixa; ganho e perda limitados.')
      if (L(p1) === 'venda' && L(p2) === 'compra' && L(c1) === 'compra' && L(c2) === 'venda') return fazer('Strangle comprado financiado', 'Compra um strangle e vende opções mais afastadas para pagar parte dele.')
      return personalizada
    }
    if (calls.length === 4 && L(pernas[0]) === 'compra' && L(pernas[1]) === 'venda' && L(pernas[2]) === 'venda' && L(pernas[3]) === 'compra') return fazer('Condor de calls', 'Compra uma call baixa, vende duas intermediárias e compra uma alta.')
  }
  return personalizada
}

// ---------------------------------------------------------------------------------------
// Situação de hoje
// ---------------------------------------------------------------------------------------

export interface LinhaDaSituacao {
  codigo: string
  tipo: 'call' | 'put'
  lado: Lado
  strike: number
  vencimento: string
  dias: number
  quantidade: number
  /** Preço da operação e último preço de mercado de hoje, por opção. */
  premio: number
  ultimo: number
  resultado: number
  situacao: 'ITM' | 'ATM' | 'OTM'
  /** Distância do strike ao preço do ativo, em % do preço. */
  distancia: number
  delta: number
}

export interface SituacaoDeHoje {
  linhas: LinhaDaSituacao[]
  resultadoOpcoes: number
  resultadoAcoes: number
  total: number
  analise: Analise & { estimado: boolean }
  /** Parte do ganho máximo já capturada (0 a 1), quando há ganho máximo finito e o resultado é positivo. */
  capturado: number | null
  /** Parte da perda máxima já realizada em papel (0 a 1), quando há perda máxima finita e o resultado é negativo. */
  daPerdaMaxima: number | null
  pontosDeAtencao: string[]
}

export function situacaoDeHoje(pos: PosicaoCadastrada, resolvida: PosicaoResolvida, ativo: AtivoComOpcoes, r: number): SituacaoDeHoje {
  const preco = ativo.cotacao
  const linhas: LinhaDaSituacao[] = resolvida.resolvidas.map(({ cadastrada: c, serie, perna, dias }) => {
    const sigma = perna.sigma ?? SIGMA_PADRAO
    return {
      codigo: serie.codigo, tipo: serie.tipo, lado: c.lado, strike: serie.strike, vencimento: serie.vencimento, dias, quantidade: c.quantidade,
      premio: c.premio, ultimo: serie.ultimo,
      resultado: sinal(c.lado) * (serie.ultimo - c.premio) * c.quantidade,
      situacao: moneyness(serie.tipo, serie.strike, preco),
      distancia: preco > 0 ? ((serie.strike - preco) / preco) * 100 : 0,
      delta: gregas({ tipo: serie.tipo, s: preco, strike: serie.strike, t: dias / DIAS_UTEIS_ANO, r, sigma }).delta,
    }
  })
  const resultadoOpcoes = linhas.reduce((t, l) => t + l.resultado, 0)
  const resultadoAcoes = pos.acoes ? pos.acoes.quantidade * (preco - pos.acoes.precoMedio) : 0
  const total = resultadoOpcoes + resultadoAcoes
  const analise = analisarPosicao(posicaoParaOMotor(resolvida.resolvidas, pos.acoes), preco, r)
  const capturado = analise.ganhoMaximo !== null && analise.ganhoMaximo > 0 && total > 0 ? Math.min(total / analise.ganhoMaximo, 1) : null
  const daPerdaMaxima = analise.perdaMaxima !== null && analise.perdaMaxima < 0 && total < 0 ? Math.min(total / analise.perdaMaxima, 1) : null

  const atencao: string[] = []
  const primeiro = linhas.length ? Math.min(...linhas.map((l) => l.dias)) : null
  for (const l of linhas.filter((x) => x.lado === 'venda')) {
    const dentro = l.situacao === 'ITM'
    if (dentro) atencao.push(`A ${l.tipo === 'call' ? 'call' : 'put'} vendida ${l.codigo} está dentro do dinheiro (strike ${l.strike.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} contra o ativo a ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}): pode ser exercida.`)
    else if (Math.abs(l.distancia) <= 3) atencao.push(`A ${l.tipo === 'call' ? 'call' : 'put'} vendida ${l.codigo} está a ${Math.abs(l.distancia).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do preço do ativo: perto de ficar dentro do dinheiro.`)
    if (Math.abs(l.delta) > 0.5 && !dentro) atencao.push(`O delta da vendida ${l.codigo} é ${l.delta.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}: a opção já anda mais de meio ponto a cada R$ 1 do ativo.`)
  }
  for (const l of linhas) {
    const intrinseco = l.tipo === 'call' ? Math.max(preco - l.strike, 0) : Math.max(l.strike - preco, 0)
    if (l.ultimo < intrinseco - 0.005)
      atencao.push(`O último preço de ${l.codigo} (R$ ${l.ultimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) está abaixo do valor intrínseco (R$ ${intrinseco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}): provavelmente vem de um negócio antigo. O preço de hoje deve ser maior, e o resultado real, diferente do mostrado.`)
  }
  if (primeiro !== null && primeiro <= 5) atencao.push(`Faltam ${primeiro} ${primeiro === 1 ? 'dia útil' : 'dias úteis'} para o primeiro vencimento: perto dele o preço das opções oscila mais rápido (gama alto).`)
  if (capturado !== null && capturado >= 0.5) atencao.push(`A posição já capturou ${Math.round(capturado * 100)}% do ganho máximo. Muita gente encerra antes do vencimento nesse ponto, para liberar capital e evitar o risco do final; é uma escolha, e não uma regra.`)
  if (daPerdaMaxima !== null && daPerdaMaxima >= 0.5) atencao.push(`O resultado de hoje já é ${Math.round(daPerdaMaxima * 100)}% da perda máxima da estrutura.`)
  if (analise.perdaMaxima === null) atencao.push('A perda máxima desta posição não tem limite: um movimento forte contra pode custar muito mais do que o prêmio recebido.')
  return { linhas, resultadoOpcoes, resultadoAcoes, total, analise, capturado, daPerdaMaxima, pontosDeAtencao: atencao }
}

// ---------------------------------------------------------------------------------------
// Possibilidades de saída
// ---------------------------------------------------------------------------------------

export interface Possibilidade {
  id: string
  titulo: string
  descricao: string
  /** Dinheiro que entra (+) ou sai (−) hoje, pelo último preço de cada série. */
  fluxoHoje: number
  /** Lucro ou prejuízo que se realiza hoje com a operação (já descontado o que foi pago ou recebido na montagem). */
  realizado: number
  /** Posição que sobra (as opções que continuam abertas, com o realizado somado); null quando nada sobra e não há ações. */
  depois: Posicao | null
  ganhoMaximo: number | null
  perdaMaxima: number | null
  estimado: boolean
  /** Etiquetas e avisos curtos ("Débito: você paga para adiar", "Realiza prejuízo"...). */
  notas: string[]
}

export function possibilidadesDeSaida(
  pos: PosicaoCadastrada, resolvida: PosicaoResolvida, ativo: AtivoComOpcoes, hoje: string, r: number,
): Possibilidade[] {
  const res = resolvida.resolvidas
  if (res.length === 0) return []
  const m = parametrosDeManejo(ativo, r)
  const preco = ativo.cotacao
  const acoes = pos.acoes
  const base = { acoes: acoes?.quantidade ?? 0, precoAcao: acoes?.precoMedio ?? 0 }
  const estrutura: PernaDaEstrutura[] = res.map((x) => ({ perna: x.perna, serie: x.serie }))
  const diasAte = (v: string) => Math.max(diasUteis(v, hoje), 1)
  const saida: Possibilidade[] = []

  const valorDe = (x: PernaResolvida) => sinal(x.cadastrada.lado) * x.serie.ultimo * x.cadastrada.quantidade
  const resultadoDe = (x: PernaResolvida) => sinal(x.cadastrada.lado) * (x.serie.ultimo - x.cadastrada.premio) * x.cadastrada.quantidade
  const medir = (depois: Posicao) => {
    const a = analisarPosicao(depois, preco, r)
    return { ganhoMaximo: a.ganhoMaximo, perdaMaxima: a.perdaMaxima, estimado: a.estimado }
  }
  const notasDe = (realizado: number, extra: string[] = []) => {
    const n = [...extra]
    if (realizado < -0.005) n.push('Realiza prejuízo')
    else if (realizado > 0.005) n.push('Realiza lucro')
    return n
  }
  const adicionar = (p: Omit<Possibilidade, 'ganhoMaximo' | 'perdaMaxima' | 'estimado' | 'notas'> & { notas?: string[] }) => {
    const alvo = p.depois ?? { pernas: [], acoes: base.acoes, precoAcao: base.precoAcao, realizado: p.realizado }
    saida.push({ ...p, ...medir(alvo), notas: notasDe(p.realizado, p.notas) })
  }

  // 1. Manter como está
  adicionar({
    id: 'manter', titulo: 'Manter até o vencimento',
    descricao: 'Não fazer nada. O resultado final depende de onde o ativo estiver no vencimento (veja a tabela de cenários).',
    fluxoHoje: 0, realizado: 0, depois: posicaoParaOMotor(res, acoes),
  })

  // 2. Encerrar tudo
  const realizadoTudo = res.reduce((t, x) => t + resultadoDe(x), 0)
  adicionar({
    id: 'encerrar-tudo', titulo: 'Encerrar todas as opções hoje',
    descricao: 'Desfazer as pernas pelo último preço de cada série. As ações, se houver, continuam.',
    fluxoHoje: res.reduce((t, x) => t + valorDe(x), 0), realizado: realizadoTudo, depois: acoes ? { pernas: [], acoes: base.acoes, precoAcao: base.precoAcao, realizado: realizadoTudo } : null,
  })

  // 3. Encerrar só uma perna (só vale com duas ou mais)
  if (res.length > 1) {
    res.forEach((x, i) => {
      const resto = res.filter((_, j) => j !== i)
      const realizado = resultadoDe(x)
      adicionar({
        id: `encerrar-${x.serie.codigo}`, titulo: `Encerrar só ${x.serie.codigo} (${x.cadastrada.lado === 'compra' ? 'comprada' : 'vendida'})`,
        descricao: 'Fechar apenas esta perna e deixar as outras abertas. Muda o formato da posição, e o risco novo está ao lado.',
        fluxoHoje: valorDe(x), realizado, depois: posicaoParaOMotor(resto, acoes, realizado),
      })
    })
  }

  // 4. Rolar uma perna para o vencimento seguinte (mesmo strike e, para as vendidas, um strike mais afastado)
  const proximoMensal = (tipo: 'call' | 'put', depoisDe: string) => {
    const todos = vencimentosDe(ativo.series).filter((v) => v > depoisDe && escadaDeStrikes(ativo.series, tipo, v).length > 0)
    return todos.find((v) => tipoVencimento(v) === 'mensal') ?? todos[0] ?? null
  }
  const rolarPara = (indices: number[], novas: SerieOpcao[], id: string, titulo: string, descricao: string, extra: string[] = []) => {
    // Hoje, as duas pontas da troca valem o último preço de cada série (e não uma estimativa de modelo).
    const alvos: Alvo[] = indices.map((indice, k) => ({ indice, nova: novas[k], precoDaAntiga: res[indice].serie.ultimo, precoDaNova: novas[k].ultimo }))
    const x = rolar(estrutura, base, alvos, { preco, diasPassados: 0 }, m, diasAte)
    adicionar({
      id, titulo, descricao, fluxoHoje: x.liquido, realizado: x.realizado, depois: x.posicao,
      notas: [...extra, x.liquido < -0.005 ? 'Débito: você paga para adiar' : x.liquido > 0.005 ? 'Crédito na troca' : ''].filter(Boolean),
    })
  }
  res.forEach((x, i) => {
    const venc = proximoMensal(x.serie.tipo, x.serie.vencimento)
    if (!venc) return
    const escada = escadaDeStrikes(ativo.series, x.serie.tipo, venc)
    const k = indiceDoMaisPerto(escada, x.serie.strike)
    const igual = escada[k]
    const rotuloVenc = `${venc.slice(8, 10)}/${venc.slice(5, 7)}`
    rolarPara([i], [igual], `rolar-${x.serie.codigo}-igual`, `Rolar ${x.serie.codigo} para ${rotuloVenc}, strike ${igual.strike.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${igual.codigo})`,
      'Encerra a perna e abre a mesma, no vencimento seguinte. Ganha tempo; a perda do momento é realizada.')
    if (x.cadastrada.lado === 'venda') {
      const passo = x.serie.tipo === 'put' ? k - 1 : k + 1
      const defensiva = escada[passo]
      if (defensiva && defensiva.codigo !== igual.codigo)
        rolarPara([i], [defensiva], `rolar-${x.serie.codigo}-defesa`, `Rolar ${x.serie.codigo} para ${rotuloVenc}, strike ${defensiva.strike.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${defensiva.codigo})`,
          x.serie.tipo === 'put' ? 'Rola para frente e para um strike menor: mais longe do preço, normalmente com menos prêmio.' : 'Rola para frente e para um strike maior: mais longe do preço, normalmente com menos prêmio.', ['Strike mais afastado'])
    }
  })

  // 5. Rolar a estrutura inteira (todas as pernas com o mesmo vencimento)
  if (res.length > 1 && new Set(res.map((x) => x.serie.vencimento)).size === 1) {
    const novas: SerieOpcao[] = []
    let ok = true
    for (const x of res) {
      const venc = proximoMensal(x.serie.tipo, x.serie.vencimento)
      if (!venc) { ok = false; break }
      const escada = escadaDeStrikes(ativo.series, x.serie.tipo, venc)
      novas.push(escada[indiceDoMaisPerto(escada, x.serie.strike)])
    }
    if (ok && new Set(novas.map((s) => s.vencimento)).size === 1 && new Set(novas.map((s) => s.codigo)).size === novas.length) {
      const venc = novas[0].vencimento
      rolarPara(res.map((_, i) => i), novas, 'rolar-tudo', `Rolar a estrutura inteira para ${venc.slice(8, 10)}/${venc.slice(5, 7)}, nos strikes mais próximos`,
        'Encerra todas as pernas e abre as mesmas no vencimento seguinte (a "troca de trava" para frente).')
    }
  }

  // 6. Proteger uma vendida descoberta, comprando uma opção mais afastada no mesmo vencimento
  res.forEach((x) => {
    if (x.cadastrada.lado !== 'venda') return
    const protegida = res.some((y) => y.cadastrada.lado === 'compra' && y.serie.tipo === x.serie.tipo && y.serie.vencimento === x.serie.vencimento) || (x.serie.tipo === 'call' && base.acoes > 0)
    if (protegida) return
    const escada = escadaDeStrikes(ativo.series, x.serie.tipo, x.serie.vencimento)
    const k = escada.findIndex((s) => s.codigo === x.serie.codigo)
    const candidatos = [1, 2].map((passo) => escada[x.serie.tipo === 'put' ? k - passo : k + passo]).filter((s): s is SerieOpcao => !!s)
    for (const prot of candidatos) {
      const dias = x.dias
      const sigma = volatilidadeImplicita({ tipo: prot.tipo, s: preco, strike: prot.strike, t: dias / DIAS_UTEIS_ANO, r }, prot.ultimo) ?? SIGMA_PADRAO
      const nova: Perna = { tipo: prot.tipo, lado: 'compra', strike: prot.strike, premio: prot.ultimo, quantidade: x.cadastrada.quantidade, dias, sigma }
      adicionar({
        id: `proteger-${x.serie.codigo}-${prot.codigo}`, titulo: `Proteger ${x.serie.codigo} comprando ${prot.codigo} (strike ${prot.strike.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
        descricao: 'Transforma a venda descoberta em trava: limita a perda máxima, ao custo do prêmio da opção comprada.',
        fluxoHoje: -prot.ultimo * x.cadastrada.quantidade, realizado: 0,
        depois: { ...posicaoParaOMotor(res, acoes), pernas: [...res.map((y) => y.perna), nova] },
        notas: ['Débito: você paga pela proteção'],
      })
    }
  })
  return saida
}
