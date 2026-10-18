/**
 * Glossário do Simule Opções, em linguagem simples, para quem está começando. Os exemplos usam números inventados (ativo "XPTO3"),
 * só para mostrar a conta. Descritivo e educacional: não é recomendação.
 */

export interface TermoDoGlossario {
  termo: string
  /** Outras formas de procurar o termo (sigla, plural, sinônimo). */
  tambem?: string[]
  explicacao: string
  exemplo?: string
}

export const GLOSSARIO: TermoDoGlossario[] = [
  {
    termo: 'Opção',
    explicacao: 'Um contrato que dá o direito de comprar ou de vender um ativo por um preço combinado, até uma data combinada. Quem compra a opção paga um valor por esse direito. Quem vende recebe esse valor e assume a obrigação, se o outro lado quiser usar o direito.',
  },
  {
    termo: 'Call',
    tambem: ['opção de compra'],
    explicacao: 'Opção que dá o direito de COMPRAR o ativo pelo preço combinado (o strike). Ganha valor quando o ativo sobe.',
    exemplo: 'Call de XPTO3 com strike R$ 10: dá o direito de comprar a ação a R$ 10, mesmo que ela esteja valendo R$ 13.',
  },
  {
    termo: 'Put',
    tambem: ['opção de venda'],
    explicacao: 'Opção que dá o direito de VENDER o ativo pelo preço combinado (o strike). Ganha valor quando o ativo cai.',
    exemplo: 'Put de XPTO3 com strike R$ 10: dá o direito de vender a ação a R$ 10, mesmo que ela esteja valendo R$ 7.',
  },
  {
    termo: 'Strike',
    tambem: ['preço de exercício'],
    explicacao: 'O preço combinado na opção. É o preço pelo qual o ativo seria comprado (call) ou vendido (put) se o direito for usado.',
  },
  {
    termo: 'Prêmio',
    explicacao: 'O preço da opção: o que quem compra paga e quem vende recebe, por unidade. Na B3, é o valor por ação; para saber o total, multiplique pela quantidade de opções.',
    exemplo: 'Prêmio de R$ 0,80 em 100 opções: R$ 80,00 no total.',
  },
  {
    termo: 'Vencimento',
    explicacao: 'A data em que a opção acaba. Depois dela, a opção deixa de existir. As opções de ações costumam vencer na terceira sexta-feira do mês (as mensais) ou em outras sextas (as semanais).',
  },
  {
    termo: 'Exercício',
    tambem: ['exercer', 'exercida'],
    explicacao: 'Usar o direito da opção: o dono da call compra o ativo pelo strike; o dono da put vende. Para quem vendeu a opção, ser exercido significa cumprir a obrigação. Opção americana pode ser exercida a qualquer momento até o vencimento; a europeia, só no vencimento.',
  },
  {
    termo: 'Opção americana e europeia',
    tambem: ['americana', 'europeia', 'modelo A/E'],
    explicacao: 'A americana pode ser exercida a qualquer momento até o vencimento. A europeia só pode ser exercida no vencimento. Na tabela, aparecem como A e E.',
  },
  {
    termo: 'Comprar e vender (titular e lançador)',
    tambem: ['titular', 'lançador', 'lançar'],
    explicacao: 'Quem COMPRA a opção (titular) paga o prêmio e tem o direito; o máximo que perde é o prêmio. Quem VENDE a opção (lançador) recebe o prêmio e tem a obrigação; o risco pode ser muito maior que o prêmio recebido.',
  },
  {
    termo: 'Dentro, no e fora do dinheiro',
    tambem: ['ITM', 'ATM', 'OTM', 'in the money', 'out of the money'],
    explicacao: 'Dentro do dinheiro (ITM): usar o direito já compensa hoje (call com strike abaixo do preço do ativo; put com strike acima). No dinheiro (ATM): o strike está perto do preço do ativo. Fora do dinheiro (OTM): usar o direito não compensa hoje.',
    exemplo: 'Com XPTO3 a R$ 10: call de strike 8 está dentro do dinheiro; call de strike 12, fora.',
  },
  {
    termo: 'Valor intrínseco e valor de tempo',
    tambem: ['valor extrínseco', 'valor temporal'],
    explicacao: 'O prêmio tem duas partes. O valor intrínseco é o que a opção já vale se for usada agora (a diferença entre o preço do ativo e o strike, quando positiva). O valor de tempo é o resto: o que o mercado cobra pela chance de a opção valer mais até o vencimento. O valor de tempo vai a zero no vencimento.',
    exemplo: 'Call de strike 8, ativo a R$ 10, prêmio R$ 2,40: R$ 2,00 intrínseco e R$ 0,40 de tempo.',
  },
  {
    termo: 'Crédito e débito',
    explicacao: 'Crédito: ao montar a operação, entra dinheiro (você vendeu mais do que comprou). Débito: sai dinheiro (você comprou mais do que vendeu). Em uma rolagem, "crédito" quer dizer que a troca rendeu dinheiro; "débito", que você pagou para trocar.',
  },
  {
    termo: 'Perna',
    explicacao: 'Cada opção que compõe uma estrutura. Uma trava tem duas pernas; um condor de ferro, quatro.',
  },
  {
    termo: 'Trava',
    tambem: ['spread'],
    explicacao: 'Estrutura com duas opções do mesmo tipo e vencimento, uma comprada e outra vendida, em strikes diferentes. Limita o ganho e a perda: o ganho máximo e a perda máxima são conhecidos desde o início.',
  },
  {
    termo: 'Estrutura',
    tambem: ['estratégia', 'operação estruturada'],
    explicacao: 'Uma combinação de opções (e, às vezes, de ações) montada para um objetivo: renda, proteção, apostar na alta ou na queda, ou ganhar com o ativo parado.',
  },
  {
    termo: 'Ponto de equilíbrio',
    explicacao: 'O preço do ativo no vencimento em que a operação não dá lucro nem prejuízo. Acima ou abaixo dele, o resultado muda de sinal.',
    exemplo: 'Call de strike R$ 10 comprada a R$ 0,80: equilíbrio em R$ 10,80.',
  },
  {
    termo: 'Ganho máximo e perda máxima',
    explicacao: 'O quanto a operação pode render ou custar, no melhor e no pior caso. "Sem limite" quer dizer que não há teto: por exemplo, a perda de quem vende uma call sem ter as ações.',
  },
  {
    termo: 'Payoff',
    tambem: ['gráfico de resultado'],
    explicacao: 'O desenho do lucro e do prejuízo da operação para cada preço do ativo no vencimento.',
  },
  {
    termo: 'Venda coberta',
    explicacao: 'Você tem as ações e vende uma call sobre elas: recebe o prêmio e, em troca, abre mão da alta acima do strike. As ações "cobrem" a obrigação.',
  },
  {
    termo: 'Venda descoberta',
    explicacao: 'Vender uma opção sem ter o ativo (call) ou sem reservar o dinheiro (put). O risco é grande, e a B3 exige margem de garantia.',
  },
  {
    termo: 'Margem de garantia',
    explicacao: 'Dinheiro ou ativos que a B3 exige que quem vende opções deixe como garantia de que cumprirá a obrigação. O app não calcula a margem.',
  },
  {
    termo: 'Rolagem',
    tambem: ['rolar'],
    explicacao: 'Encerrar uma opção e abrir outra parecida, em outro vencimento ou strike, para ganhar tempo ou reduzir o risco. A perda ou o ganho da opção encerrada é realizado na hora. Rolar com débito significa pagar para adiar.',
  },
  {
    termo: 'Roda',
    tambem: ['wheel'],
    explicacao: 'Estratégia de renda em ciclo: vende-se uma put coberta por caixa até ser exercida; com as ações em carteira, vende-se call coberta até ser exercida; vendidas as ações, volta-se à put.',
  },
  {
    termo: 'Colchão',
    explicacao: 'Quanto o ativo pode cair, em %, antes de a venda de uma put dar prejuízo no vencimento (a queda até o strike, mais o prêmio recebido).',
  },
  {
    termo: 'Volatilidade implícita',
    tambem: ['vol. impl.', 'volatilidade'],
    explicacao: 'O tamanho do movimento do ativo que o preço da opção está "supondo", em % ao ano. Opção cara costuma ter volatilidade implícita alta. No app, é uma estimativa nossa, a partir do último preço da série.',
  },
  {
    termo: 'Delta',
    explicacao: 'Quanto o preço da opção muda para cada R$ 1 de variação no ativo. Call tem delta entre 0 e 1; put, entre −1 e 0. Também serve de pista da chance de a opção terminar dentro do dinheiro.',
    exemplo: 'Delta 0,50: se o ativo subir R$ 1, a call sobe cerca de R$ 0,50.',
  },
  {
    termo: 'Gama',
    explicacao: 'Quanto o delta muda quando o ativo se mexe. É alto perto do strike e perto do vencimento, quando o preço da opção passa a oscilar mais rápido.',
  },
  {
    termo: 'Teta',
    tambem: ['theta', 'passagem do tempo'],
    explicacao: 'Quanto o prêmio perde por dia útil que passa, com o ativo parado. É contra quem comprou a opção e a favor de quem vendeu.',
  },
  {
    termo: 'Vega',
    explicacao: 'Quanto o prêmio muda para cada ponto de variação da volatilidade. Quem compra opção ganha se a volatilidade sobe; quem vende ganha se ela cai.',
  },
  {
    termo: 'Lote',
    explicacao: 'A quantidade padrão negociada. Na B3, o lote padrão das ações é de 100; as opções costumam ser negociadas em múltiplos disso.',
  },
  {
    termo: 'Último preço',
    tambem: ['último negócio'],
    explicacao: 'O preço do último negócio que aconteceu naquela série. Pode ser de horas ou de dias atrás, e estar longe do preço em que você conseguiria comprar ou vender agora. Por isso os números do app são estimativas.',
  },
]

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Termos que combinam com a busca (no nome, nos sinônimos e na explicação), sem diferenciar acento ou maiúscula. */
export function buscarNoGlossario(termo: string, lista: TermoDoGlossario[] = GLOSSARIO): TermoDoGlossario[] {
  const q = semAcento(termo.trim())
  if (!q) return lista
  const pontuacao = (t: TermoDoGlossario) => {
    const nome = semAcento(t.termo)
    const tambem = (t.tambem ?? []).map(semAcento)
    if (nome === q || tambem.includes(q)) return 3
    if (nome.includes(q) || tambem.some((x) => x.includes(q))) return 2
    if (semAcento(t.explicacao).includes(q)) return 1
    return 0
  }
  return lista
    .map((t) => ({ t, p: pontuacao(t) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .map((x) => x.t)
}
