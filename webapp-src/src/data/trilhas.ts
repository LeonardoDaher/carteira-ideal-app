import type { AtivoKey } from '../domain/types'
import { LINKS_OFICIAIS } from './linksOficiais'

/** Uma aula individual (~2 min). O vídeo mora no YouTube (canal dedicado do "Carteira
 * Ideal") — basta preencher `youtubeId` (o trecho depois de "v=" ou "youtu.be/"). Enquanto
 * `youtubeId` estiver vazio, o card aparece como "Em breve". */
export interface AulaTrilha {
  /** Identificador único da aula dentro do tópico (não precisa ser igual ao AtivoKey). */
  id: string
  titulo: string
  duracao: string
  /** Frase curta (1 linha) exibida na lista da trilha. */
  resumo: string
  /** ID do vídeo no YouTube, ex.: em "youtube.com/watch?v=ABC123" ou "youtube.com/shorts/ABC123",
   * o ID é "ABC123". */
  youtubeId?: string
  /** 'vertical' para YouTube Shorts (9:16). Sem este campo o player usa 16:9. */
  formato?: 'vertical'
  /** Classe de ativo relacionada (usada para pegar a cor do ponto e permitir o link
   * cruzado para a análise completa em `DetalheAtivo`). Nem toda aula futura precisa ter uma. */
  ativo?: AtivoKey
  /** Aula em texto (D21, Etapa 4): parágrafos para ler em ~2 min. Com texto, a aula já fica
   * disponível mesmo sem vídeo; quando o vídeo sair, basta preencher `youtubeId` e o texto
   * continua abaixo dele. */
  texto?: string[]
  /** Fontes oficiais citadas na aula, abertas em nova aba. */
  links?: { rotulo: string; href: string }[]
  /** Botão para uma ferramenta do app no fim da aula. */
  acao?: 'meuMes' | 'questionario'
}

export interface TopicoTrilha {
  id: string
  titulo: string
  aulas: AulaTrilha[]
}

export interface Trilha {
  id: string
  numero: number
  titulo: string
  descricao: string
  /** Tópicos vazios ([]) = trilha ainda não roteirizada, aparece como "Em construção". */
  topicos: TopicoTrilha[]
}

export const TRILHAS: Trilha[] = [
  {
    id: 'conhecendo-os-ativos',
    numero: 1,
    titulo: 'Conhecendo os ativos',
    descricao: 'Aprenda sobre os principais ativos que investidores de sucesso possuem em suas carteiras.',
    topicos: [
      {
        id: 'renda-fixa',
        titulo: 'Renda Fixa',
        aulas: [
          {
            id: 'tesouroSelic',
            titulo: 'Tesouro Selic',
            duracao: '2 min',
            resumo: 'O que é, como funciona a liquidez diária e quando faz sentido usar.',
            youtubeId: 'FnwbCE8qVf4',
            formato: 'vertical',
            ativo: 'tesouroSelic',
          },
          {
            id: 'tesouroIPCA',
            titulo: 'Tesouro IPCA+',
            duracao: '2 min',
            resumo: 'Como blindar o poder de compra do seu dinheiro no longo prazo.',
            youtubeId: 'yheS2l3Pb6o',
            formato: 'vertical',
            ativo: 'tesouroIPCA',
          },
          {
            id: 'tesouroPrefixado',
            titulo: 'Tesouro Prefixado',
            duracao: '2 min',
            resumo: 'Taxa fixa contratada na compra: quando ela protege e quando atrapalha.',
            youtubeId: '-Pp3ouSPc28',
            formato: 'vertical',
            ativo: 'tesouroPrefixado',
          },
          {
            id: 'cdbLiquidez',
            titulo: 'CDB com liquidez diária',
            duracao: '2 min',
            resumo: 'Como funciona o empréstimo ao banco e a proteção do FGC.',
            youtubeId: '5Bt13K0bK3A',
            formato: 'vertical',
            ativo: 'cdbLiquidez',
          },
          {
            id: 'lciLca',
            titulo: 'LCI / LCA',
            duracao: '2 min',
            resumo: 'Por que são isentas de IR e o que muda em relação ao CDB.',
            youtubeId: '8TCxwvBx2N4',
            formato: 'vertical',
            ativo: 'lciLca',
          },
        ],
      },
      {
        id: 'renda-variavel-nacional',
        titulo: 'Renda Variável Nacional',
        aulas: [
          {
            id: 'fiis',
            titulo: 'Fundos Imobiliários (FIIs)',
            duracao: '2 min',
            resumo: 'Como um fundo imobiliário gera renda mensal para quem investe.',
            youtubeId: 'nhgn8sgxvYw',
            formato: 'vertical',
            ativo: 'fiis',
          },
          {
            id: 'acoesETFs',
            titulo: 'Ações',
            duracao: '2 min',
            resumo: 'O que significa ser sócio de uma empresa listada na bolsa brasileira.',
            youtubeId: 'iQ40nUTcEkk',
            formato: 'vertical',
            ativo: 'acoesETFs',
          },
        ],
      },
      {
        id: 'renda-variavel-internacional',
        titulo: 'Renda Variável Internacional',
        aulas: [
          {
            id: 'bdrs',
            titulo: 'BDRs',
            duracao: '2 min',
            resumo: 'Como investir em empresas estrangeiras direto pela bolsa brasileira.',
            youtubeId: '4xBOH2LGa6k',
            formato: 'vertical',
            ativo: 'bdrs',
          },
          {
            id: 'fundosInternacionais',
            titulo: 'Fundos Internacionais / ETFs',
            duracao: '2 min',
            resumo: 'Diversificação geográfica e exposição ao dólar em um único fundo.',
            youtubeId: 'UouVxw4Ddpk',
            formato: 'vertical',
            ativo: 'fundosInternacionais',
          },
        ],
      },
      {
        id: 'ouro',
        titulo: 'Ouro',
        aulas: [
          {
            id: 'ouro',
            titulo: 'Ouro',
            duracao: '2 min',
            resumo: 'Por que o ouro funciona como proteção em momentos de crise.',
            youtubeId: 'nScJvzzICS8',
            formato: 'vertical',
            ativo: 'ouro',
          },
        ],
      },
      {
        id: 'criptomoedas',
        titulo: 'Criptomoedas',
        aulas: [
          {
            id: 'cripto',
            titulo: 'Criptomoedas',
            duracao: '2 min',
            resumo: 'Volatilidade, custódia e por que a fatia costuma ser pequena nas carteiras de referência.',
            youtubeId: 'M9EJmNcHkso',
            formato: 'vertical',
            ativo: 'cripto',
          },
        ],
      },
    ],
  },
  {
    id: 'poder-da-diversificacao',
    numero: 2,
    titulo: 'O poder da diversificação',
    descricao: 'Diversificar vai muito além de ter muitos ativos. É preciso estratégia!',
    topicos: [
      {
        id: 'diversificacao-de-ativos',
        titulo: 'Diversificação de Ativos',
        aulas: [
          {
            id: 'diversificacao-de-ativos',
            titulo: 'Diversificação de Ativos',
            duracao: '2 min',
            resumo: 'Por que combinar classes diferentes reduz o risco da carteira como um todo.',
            youtubeId: '15WPlaMsnqw',
            formato: 'vertical',
          },
        ],
      },
      {
        id: 'diversificacao-de-setores',
        titulo: 'Diversificação por Setores',
        aulas: [
          {
            id: 'diversificacao-de-setores',
            titulo: 'Diversificação por Setores',
            duracao: '2 min',
            resumo: 'Como evitar concentrar patrimônio em um único setor da economia.',
            youtubeId: '3HKVO3Ffj0o',
            formato: 'vertical',
          },
        ],
      },
      {
        id: 'diversificacao-por-tempo',
        titulo: 'Diversificação no Tempo',
        aulas: [
          {
            id: 'diversificacao-por-tempo',
            titulo: 'Diversificação no Tempo',
            duracao: '2 min',
            resumo: 'Como espalhar os investimentos em diferentes prazos de vencimento.',
            youtubeId: 'BEpzvRrX1ZI',
            formato: 'vertical',
          },
        ],
      },
      {
        id: 'diversificacao-por-rendimentos',
        titulo: 'Diversificação por Rendimentos',
        aulas: [
          {
            id: 'diversificacao-por-rendimentos',
            titulo: 'Diversificação por Rendimentos',
            duracao: '2 min',
            resumo: 'Equilibrar ativos de renda previsível e de renda variável na mesma carteira.',
            youtubeId: 'dQqrCSE-hpo',
            formato: 'vertical',
          },
        ],
      },
    ],
  },
  {
    id: 'sair-das-dividas',
    numero: 3,
    titulo: 'Sair das dívidas',
    descricao:
      'Para quem tem dívida cara: entender os juros, montar um plano que caiba no salário e negociar sem cair em armadilha. Anda junto com o Meu Mês.',
    topicos: [
      {
        id: 'entender-a-divida',
        titulo: 'Entender a dívida',
        aulas: [
          {
            id: 'juros-sobre-juros',
            titulo: 'Por que a dívida cara cresce tão rápido',
            duracao: '2 min',
            resumo: 'Juros sobre juros: o que 8% ao mês fazem com R$ 1.000 em um ano.',
            texto: [
              'Juros de dívida são cobrados sobre o saldo, e o saldo inclui os juros do mês anterior. É o mesmo juro composto que faz um investimento crescer, só que jogando contra você.',
              'Um exemplo: R$ 1.000 no cheque especial, a 8% ao mês, viram cerca de R$ 2.518 em 12 meses sem nenhum pagamento. Os mesmos R$ 1.000 num investimento seguro que rendesse perto de 14% ao ano, como a Selic de 2026, chegariam a uns R$ 1.137 antes do imposto.',
              'Por isso a conta não fecha: não existe investimento seguro que renda o que o cartão, o cheque especial ou o empréstimo pessoal cobram. Enquanto houver dívida cara, quitar é o melhor "investimento" disponível.',
              'Desde 2024, os juros e encargos do rotativo e do parcelamento da fatura do cartão não podem passar do valor da dívida original (Lei 14.690/2023). Mesmo com esse limite, uma dívida que pode dobrar é cara demais para ficar esperando.',
            ],
          },
          {
            id: 'cara-x-barata',
            titulo: 'Dívida cara x dívida barata',
            duracao: '2 min',
            resumo: 'Qual atacar primeiro e qual pode seguir com a parcela em dia.',
            texto: [
              'Nem toda dívida é inimiga do mesmo tamanho. Rotativo e fatura parcelada do cartão, cheque especial, empréstimo pessoal e dívida em dólar são caras. Qualquer outra dívida também é cara a partir de 3% ao mês, o que dá mais de 42% ao ano.',
              'Consignado e financiamento de carro ou imóvel costumam ficar na casa de 1% a 2% ao mês. São dívidas longas e mais baratas: o combinado é manter a parcela em dia, sem atrasar.',
              'A regra do plano é simples: todo dinheiro extra vai para as dívidas caras. As baratas seguem com a parcela normal. Antecipar um financiamento barato enquanto o cartão cobra 10% ao mês é trocar o fogo pela fumaça.',
              'No questionário da Carteira Ideal, é esta a diferença entre as opções A e B do Pilar 2. Quem está na opção A recebe uma carteira defensiva, porque o primeiro passo não é investir: é quitar.',
            ],
          },
          {
            id: 'registrato',
            titulo: 'Descubra tudo o que você deve',
            duracao: '2 min',
            resumo: 'O Registrato, do Banco Central, mostra de graça as dívidas no seu CPF.',
            texto: [
              'Ninguém quita o que não enxerga. O primeiro passo é pôr no papel todas as dívidas: quanto deve hoje, quanto é a parcela mínima e quanto de juros cobra por mês.',
              'O Registrato, do Banco Central, mostra de graça os empréstimos, financiamentos e cartões no seu CPF, em todas as instituições. Entre com a conta gov.br, nível prata ou ouro.',
              'Os juros de cada dívida aparecem no contrato, na fatura ou no aplicativo do banco, como taxa ao mês e como CET (Custo Efetivo Total). O CET é o número que importa, porque inclui tarifas, seguros e impostos.',
              'Com a lista pronta, anote cada dívida no Meu Mês. Se houver dívida cara, o Modo Recuperação liga sozinho e monta o plano.',
            ],
            links: [{ rotulo: 'Registrato (Banco Central)', href: LINKS_OFICIAIS.registrato }],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'montar-o-plano',
        titulo: 'Montar o plano',
        aulas: [
          {
            id: 'mini-reserva',
            titulo: 'Mini-reserva antes de atacar',
            duracao: '2 min',
            resumo: 'Por que guardar um pouco antes de quitar evita dívida nova.',
            texto: [
              'Parece contraditório guardar dinheiro com dívida cara em aberto. Mas sem nenhuma reserva, o primeiro remédio, conserto ou pneu furado volta para o cartão, e o plano recomeça do zero.',
              'Por isso o plano começa com uma mini-reserva: metade de um mês de custo de vida, e nunca menos de R$ 500. É pouco para adiar muito o ataque às dívidas, e o bastante para um imprevisto pequeno não virar dívida nova.',
              'Enquanto junta a mini-reserva, pague todas as parcelas mínimas em dia. Quando ela estiver pronta, tudo o que der vai para o pote Quitar.',
              'A reserva completa, de 3 meses de contas, fica para depois das dívidas caras. É a terceira fase do Modo Recuperação.',
            ],
          },
          {
            id: 'avalanche-bola-de-neve',
            titulo: 'Avalanche ou bola de neve',
            duracao: '2 min',
            resumo: 'Os dois jeitos de ordenar as dívidas, e como escolher o seu.',
            texto: [
              'Nos dois métodos, você paga a mínima de todas as dívidas e põe o dinheiro extra numa só. Quando ela acaba, a parcela dela reforça a próxima da fila. A diferença é a ordem da fila.',
              'Avalanche: primeiro a dívida com os juros mais altos. É o caminho que paga menos juros no total, pela matemática.',
              'Bola de neve: primeiro a dívida de menor saldo. Custa um pouco mais de juros, mas a primeira dívida acaba antes, e essa vitória rápida ajuda muita gente a não desistir no meio.',
              'O melhor método é o que você vai conseguir seguir até o fim. O Meu Mês mostra os dois lado a lado com os seus números: quantos meses, quanto de juros e quando vem a primeira dívida quitada.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'pacto-de-nao-parcelar',
            titulo: 'O pacto de não parcelar',
            duracao: '2 min',
            resumo: 'Cada parcela é um pedaço do salário dos próximos meses já gasto.',
            texto: [
              'Parcelar sem juros parece não custar nada, mas cada parcela é um pedaço do salário dos próximos meses que já tem dono. Somadas, as parcelas pequenas viram a fatura que não fecha.',
              'O pacto é um combinado com você mesmo: enquanto houver dívida cara, compras só à vista. No Meu Mês, com o pacto feito, parcelar exige um passo a mais e uma confirmação. É de propósito: a pausa ajuda a decidir com calma.',
              'Dois cuidados que ajudam: escolha um teto mensal para o cartão menor que o limite do banco, e lembre que você pode pedir ao banco, a qualquer momento, para diminuir ou cancelar o limite do cheque especial.',
            ],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'negociar-e-recomecar',
        titulo: 'Negociar e recomeçar',
        aulas: [
          {
            id: 'negociar',
            titulo: 'Como negociar com o credor',
            duracao: '2 min',
            resumo: 'Proposta por escrito, CET na mão e parcela que cabe no mês.',
            texto: [
              'Antes de ligar para o credor, saiba quanto cabe no seu mês: é o valor do seu pote Quitar. Acordo com parcela que não cabe quebra, e acordo quebrado costuma voltar pior.',
              'Peça a proposta por escrito, com o CET e o total a pagar, e compare com a dívida de hoje. Desconto grande à vista pode valer a pena; parcelamento longo pode sair mais caro que a dívida original.',
              'Você também pode levar uma dívida para outra instituição que cobre juros menores (portabilidade de crédito). O banco de origem pode fazer uma contraproposta. Compare sempre pelo CET.',
              'Sites de acordo, como o Serasa Limpa Nome, reúnem propostas de muitos credores para dívidas em atraso. Confira se a oferta também aparece no canal oficial do credor e nunca pague boleto recebido por mensagem ou link de desconhecidos.',
              'Se o credor não resolver, registre reclamação no consumidor.gov.br, serviço público em que a empresa tem prazo para responder.',
            ],
            links: [
              { rotulo: 'Serasa Limpa Nome', href: LINKS_OFICIAIS.serasa },
              { rotulo: 'consumidor.gov.br', href: LINKS_OFICIAIS.consumidor },
            ],
          },
          {
            id: 'superendividamento',
            titulo: 'Quando as dívidas não cabem no salário',
            duracao: '2 min',
            resumo: 'O que a Lei do Superendividamento permite e onde pedir ajuda de graça.',
            texto: [
              'Às vezes, mesmo cortando tudo, as parcelas passam do que entra. Isso tem nome: superendividamento. E tem saída prevista em lei.',
              'A Lei 14.181/2021 permite renegociar as dívidas de consumo todas juntas, com todos os credores, num plano de até 5 anos que preserve um mínimo para você viver.',
              'Procure o Procon da sua cidade ou a Defensoria Pública, que atende de graça quem não pode pagar advogado. Financiamento imobiliário, crédito rural e dívidas com garantia ficam de fora desse plano.',
              'Leve a lista de dívidas do Registrato e o seu orçamento do mês: com os números na mão, o atendimento anda mais rápido.',
            ],
            links: [{ rotulo: 'Lei 14.181/2021 (Planalto)', href: LINKS_OFICIAIS.lei14181 }],
          },
          {
            id: 'depois-da-ultima-parcela',
            titulo: 'Depois da última parcela',
            duracao: '2 min',
            resumo: 'Reserva completa e a volta aos investimentos, sem pular etapas.',
            texto: [
              'Quando a última dívida cara acaba, o dinheiro que ia para o pote Quitar não volta para o consumo: ele passa a construir o seu futuro.',
              'Primeiro, complete a reserva de emergência até 3 meses de contas. Ela fica num lugar seguro e de resgate rápido, e é o que impede a próxima emergência de virar dívida.',
              'Depois, o pote Fazer Crescer volta a ser o investimento de verdade. É a hora de refazer o questionário da Carteira Ideal: sem dívida cara e com reserva, as respostas dos Pilares 1 e 2 mudam, e a carteira de referência muda junto.',
              'Continue ticando as contas e mantendo o teto do cartão. O hábito que tirou você das dívidas é o mesmo que faz o patrimônio crescer.',
            ],
            acao: 'questionario',
          },
        ],
      },
    ],
  },
]

/** Total de aulas já roteirizadas em uma trilha, contando todos os tópicos. */
export function totalDeAulas(trilha: Trilha): number {
  return trilha.topicos.reduce((soma, topico) => soma + topico.aulas.length, 0)
}

/** A aula já pode ser vista: tem vídeo publicado ou texto para ler. */
export function aulaDisponivel(aula: AulaTrilha): boolean {
  return Boolean(aula.youtubeId) || Boolean(aula.texto?.length)
}

/** Quantas dessas aulas já estão disponíveis (vídeo publicado ou aula em texto). */
export function aulasDisponiveis(trilha: Trilha): number {
  return trilha.topicos.reduce(
    (soma, topico) => soma + topico.aulas.filter(aulaDisponivel).length,
    0,
  )
}

/** Todas as aulas de uma trilha, em ordem de exibição, cada uma junto do id do seu
 * tópico — usado para calcular "próxima aula" na tela de vídeo. */
export function aulasEmOrdem(trilha: Trilha): { topicoId: string; aula: AulaTrilha }[] {
  return trilha.topicos.flatMap((topico) => topico.aulas.map((aula) => ({ topicoId: topico.id, aula })))
}

export function encontrarTrilha(trilhaId: string): Trilha | undefined {
  return TRILHAS.find((t) => t.id === trilhaId)
}

export function encontrarAula(
  trilhaId: string,
  topicoId: string,
  aulaId: string,
): { trilha: Trilha; topico: TopicoTrilha; aula: AulaTrilha } | undefined {
  const trilha = encontrarTrilha(trilhaId)
  const topico = trilha?.topicos.find((t) => t.id === topicoId)
  const aula = topico?.aulas.find((a) => a.id === aulaId)
  if (!trilha || !topico || !aula) return undefined
  return { trilha, topico, aula }
}
