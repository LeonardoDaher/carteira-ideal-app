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
  /** Aula que fala de dívida: leva o aviso de "não é assessoria jurídica" no rodapé, mesmo fora da
   * trilha "Sair das dívidas" (D28, Tutorial Meu Mês). */
  aviso?: 'dividas'
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
  {
    id: 'tutorial-meu-mes',
    numero: 4,
    titulo: 'Tutorial Meu Mês',
    descricao:
      'Passo a passo para preencher o Meu Mês sem dificuldade: contas, cofrinhos, cartão de crédito, dívidas e os potes de guardar, fazer crescer e quitar. São 17 aulas curtas, na ordem em que você preenche.',
    topicos: [
      {
        id: 'comecar',
        titulo: 'Começar pelo salário',
        aulas: [
          {
            id: 'abrindo-e-salario',
            titulo: 'Abrindo o Meu Mês e começando pelo salário',
            duracao: '1 min',
            resumo: 'Onde fica o Meu Mês, a ideia geral e o primeiro passo: o salário líquido.',
            texto: [
              'O Meu Mês é o controle do seu mês, grátis e sem cadastro. A ideia é simples: do salário saem as contas do mês, os cofrinhos das contas do ano, a fatura do cartão e as parcelas das dívidas. O que sobra vai para três potes: Guardar, Fazer Crescer e Gastar.',
              'Para abrir, toque em Meu Mês na página inicial da Carteira Ideal, logo abaixo do botão principal. Na primeira vez, o app mostra só o cartão "Comece pelo salário".',
              'Passo 1: digite o salário líquido, que é o que cai na sua conta, já descontados INSS e Imposto de Renda.',
              'Passo 2: toque em Continuar. A tela passa a mostrar o mês atual, com as setas ‹ e › para navegar entre os meses.',
              'Se a sua renda varia, use a de um mês fraco: é melhor sobrar do que faltar. O salário pode ser mudado depois, a qualquer momento, no cartão "Para onde vai o salário".',
              'Seus dados ficam só neste aparelho. Nada é enviado para a internet.',
            ],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'cadastrar-contas',
        titulo: 'Cadastrar as contas',
        aulas: [
          {
            id: 'contas-de-todo-mes',
            titulo: 'Cadastrando as contas de todo mês',
            duracao: '2 min',
            resumo: 'Aluguel, luz, água, internet, mercado: anote uma vez e corrija quando precisar.',
            texto: [
              'Você só precisa anotar as suas contas uma vez. Depois, todo mês é só ir ticando. O cadastro fica no cartão Minhas contas, logo abaixo da lista Contas do mês.',
              'Passo 1: em "Nome da conta", digite o nome (Academia, Diarista, Pensão) ou toque num atalho: Aluguel, Condomínio, Luz, Água, Internet e celular, Plano de saúde, Escola ou creche, Mercado, Transporte e combustível. Os atalhos só preenchem o nome: qualquer conta pode ser cadastrada.',
              'Passo 2: deixe marcado "Todo mês".',
              'Passo 3: digite o valor por mês. Conta que varia, como luz ou mercado, use a média dos últimos meses.',
              'Passo 4: em "Como você paga", deixe Boleto, Pix ou débito.',
              'Passo 5: toque em Adicionar conta.',
              'A conta aparece em Minhas contas e na lista do mês. Repita para todas. Errou o valor? Toque em Editar ao lado da conta: dá para salvar as alterações, cancelar ou remover.',
              'Cuidado: financiamento, empréstimo e consignado não vão em Minhas contas. Cadastre em Minhas dívidas, com saldo e juros. Compra parcelada, como geladeira ou TV, também não vai aqui: é lançada no cartão, com o número de vezes. Se o nome parecer dívida, o app avisa para a parcela não sair duas vezes do salário.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'contas-do-ano-cofrinhos',
            titulo: 'Contas do ano viram cofrinhos (IPVA, IPTU, seguro)',
            duracao: '2 min',
            resumo: 'Como o app divide as contas do ano pelos meses que faltam.',
            texto: [
              'Janeiro chega e o IPVA pega você de surpresa? No Meu Mês, cada conta do ano vira um cofrinho mensal.',
              'Passo 1: em Minhas contas, toque num atalho (IPVA, IPTU, Licenciamento, Seguro do carro, Seguro da moto, Material escolar e matrícula) ou digite o nome.',
              'Passo 2: marque "Uma vez por ano".',
              'Passo 3: em "Valor total no ano", digite a conta inteira, e não a parcela.',
              'Passo 4: escolha o mês do vencimento. Boleto em várias vezes? Use o mês da primeira parcela.',
              'Passo 5: em "Como você paga", deixe Boleto ou Pix e toque em Adicionar conta.',
              'O app divide o que falta guardar pelos meses que faltam, contando o mês atual e o do vencimento. Cadastrou em outubro o IPVA de janeiro, de R$ 1.600? São 4 meses, e não 12: R$ 400 por mês. Um IPTU de R$ 900 em fevereiro dá R$ 180 por mês.',
              'A conta aparece em Contas do mês, no grupo "Cofrinhos das contas do ano". Todo mês, tique o cofrinho quando separar o dinheiro. No mês do vencimento, o item vira o pagamento da conta e mostra quanto já está guardado.',
              'Os cofrinhos saem do salário junto com as contas, antes de qualquer pote. Assim a conta do ano não vira dívida.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'conta-mensal-no-cartao',
            titulo: 'Conta de todo mês paga no cartão de crédito',
            duracao: '1 min',
            resumo: 'Streaming, celular, academia: a conta sai da lista e entra no gasto do cartão.',
            texto: [
              'Paga streaming, celular ou academia no cartão de crédito? Cadastre normalmente, e em "Como você paga" toque em Cartão de crédito.',
              'Passo 1: em Minhas contas, digite o nome e o valor por mês, com "Todo mês" marcado.',
              'Passo 2: toque em Cartão de crédito e leia a explicação que aparece.',
              'Passo 3: toque em Adicionar conta.',
              'A conta sai da lista Contas do mês, porque não sai do salário agora. Ela entra no gasto do cartão deste mês, conta para o seu teto e é paga na fatura do mês seguinte, junto com as compras.',
              'Cuidado: a parcela de uma compra, como a geladeira, não é conta de todo mês. Lance a compra no cartão, com o número de vezes, para o app saber quando ela acaba. Se você cadastrar as duas coisas, o app avisa em amarelo, porque a parcela contaria duas vezes.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'conta-do-ano-no-cartao',
            titulo: 'Conta do ano no cartão: à vista ou parcelada',
            duracao: '2 min',
            resumo: 'O que muda quando o IPVA ou o seguro vai no cartão, à vista ou em parcelas.',
            texto: [
              'Cadastre a conta como "Uma vez por ano", com valor total e mês do vencimento. Em "Como você paga", escolha o cartão à vista ou o cartão parcelado.',
              'Cartão à vista: o cofrinho continua todo mês. No vencimento a conta vai para o cartão e, no mês seguinte, o dinheiro do cofrinho paga essa parte da fatura. Ele não sai do salário duas vezes.',
              'Cartão parcelado: escolha em quantas vezes (de 2 a 12) e digite o valor de cada parcela, já com juros e taxas, e não o total. O app mostra o total, quanto você paga a mais e a taxa ao mês. Se for sem juros, ele confirma e lembra de perguntar pelo desconto à vista.',
              'Se o vencimento já passou, o app pergunta "Você já está pagando o parcelamento?". Responda Sim, e as parcelas que faltam entram já; ou Não, é o próximo. Uma nota em cinza diz em que mês a primeira parcela entra no cartão e quando cai a última.',
              'Conta do ano parcelada não tem cofrinho: as parcelas entram nas faturas e contam para o teto. Se o total ficar menor que a conta, o app bloqueia, porque quase sempre a parcela foi digitada no campo do valor total. Antes de parcelar imposto no cartão, veja se a prefeitura ou a Secretaria da Fazenda oferece desconto à vista ou parcelamento sem juros no boleto.',
            ],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'dividas-e-cartao',
        titulo: 'Dívidas e cartão de crédito',
        aulas: [
          {
            id: 'minhas-dividas',
            titulo: 'Minhas dívidas: cadastrando cada dívida',
            duracao: '2 min',
            resumo: 'Saldo, juros e parcela mínima de cada dívida, e como atualizar todo mês.',
            texto: [
              'Antes de cadastrar, levante tudo o que você deve. O Registrato, do Banco Central, mostra de graça as dívidas no seu CPF. Entre com a conta gov.br, nível prata ou ouro.',
              'Passo 1: no cartão Minhas dívidas, toque em "Cadastrar uma dívida".',
              'Passo 2: dê um nome ("Cartão roxo") e escolha o tipo: rotativo do cartão, fatura parcelada, cheque especial, empréstimo pessoal, dívida em dólar, consignado, financiamento ou outra.',
              'Passo 3: em "Quanto deve hoje", digite o saldo que aparece no extrato ou no app do credor.',
              'Passo 4: informe os juros e escolha se a taxa é ao mês ou ao ano. Financiamento e consignado costumam informar ao ano; cartão e cheque especial, ao mês. O app mostra a conversão. Sem a taxa, use a referência que ele sugere e troque depois pela sua.',
              'Passo 5: digite a parcela ou pagamento mínimo por mês e toque em Adicionar dívida.',
              'Se a mínima não cobre nem os juros do mês, o app avisa em vermelho: pagando só ela, a dívida cresce. As dívidas caras ganham o selo "Cara": rotativo, fatura parcelada, cheque especial, empréstimo pessoal, dívida em dólar ou qualquer uma a partir de 3% ao mês.',
              'Todo mês, toque em Editar e atualize o saldo pelo extrato: a barra mostra quanto você já abateu. A parcela cadastrada aqui já sai do salário junto com as contas, então não cadastre a mesma parcela em Minhas contas.',
            ],
            links: [{ rotulo: 'Registrato (Banco Central)', href: LINKS_OFICIAIS.registrato }],
            aviso: 'dividas',
            acao: 'meuMes',
          },
          {
            id: 'teto-e-semaforo',
            titulo: 'Cartão de crédito: o seu teto e o semáforo',
            duracao: '1 min',
            resumo: 'Um teto que é seu, e não do banco, e o que cada cor do semáforo quer dizer.',
            texto: [
              'O limite do banco não é o seu limite. No cartão Cartão de crédito, você define um teto que é seu: quanto decide gastar por mês. O cartão é pago com o salário do mês seguinte, então passar do teto aperta o próximo mês.',
              'Passo 1: em "Seu teto por mês", digite o valor.',
              'Passo 2: sem ideia de quanto? Toque em "Usar R$ …": é o que cabe no orçamento depois das contas e dos potes. Se o teto passar do que cabe, o app avisa e mostra o valor que cabe; um teto menor que o sugerido é uma boa escolha.',
              'A barra é um semáforo. Verde: até 70% do teto, e o app diz quanto ainda cabe. Amarelo: entre 70% e 100%, atenção. Vermelho: passou do teto, e a regra é parar de usar o cartão neste mês, porque a diferença vai apertar o salário do mês seguinte.',
              'Entram no teto as compras, as parcelas, as contas de todo mês no cartão e as parcelas das contas do ano. Conta do ano à vista, paga pelo cofrinho, fica fora. Mais abaixo, "Parcelas que você já assumiu" mostra o que já está comprometido nos próximos meses.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'primeiro-mes-fatura',
            titulo: 'Primeiro mês no app: trazendo a fatura do mês passado',
            duracao: '2 min',
            resumo: 'Como lançar o que já vem na fatura: compras à vista e parcelamentos em andamento.',
            texto: [
              'Quem começa a usar o Meu Mês já chega com uma fatura para pagar, que traz o que passou no cartão no mês passado. Tenha essa fatura em mãos, no app do banco.',
              'Passo 1: no cartão Cartão de crédito, toque em "Começando agora no app?". A caixa só aparece no mês atual.',
              'Passo 2, compras à vista: some tudo o que foi à vista na fatura e digite o total, sem anotar uma por uma. Toque em "Lançar total à vista".',
              'Passo 3, parcelamentos em andamento: cada compra parcelada aparece na fatura como "04/10", por exemplo. Digite o nome (Geladeira), o valor de cada parcela, a parcela desta fatura (4) e de quantas (10). O app calcula sozinho o mês da compra e em que fatura vem a última parcela. Toque em "Lançar parcelamento" e repita para cada compra.',
              'Depois, suba até Contas do mês: a "Fatura do cartão" já aparece com o valor a pagar.',
              'Parcelas de contas do ano (IPVA, seguro) não entram aqui: cadastre em Minhas contas e marque "Sim, já estou pagando". Contas de todo mês no cartão entram a partir do mês do cadastro: some a do mês passado no total à vista. Lance cada parcelamento uma vez só, porque as parcelas que faltam entram sozinhas nos próximos meses.',
            ],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'mes-na-pratica',
        titulo: 'O mês na prática',
        aulas: [
          {
            id: 'tres-potes',
            titulo: 'Os três potes: Guardar, Fazer Crescer e Gastar',
            duracao: '2 min',
            resumo: 'Separar primeiro, gastar depois, e o que cada mensagem do app quer dizer.',
            texto: [
              'O caminho do salário mostra para onde vai cada real. Do salário saem as contas, os cofrinhos, a fatura e as parcelas das dívidas. O que sobra vai para os potes, com uma regra de ouro: separe primeiro, gaste depois.',
              'Passo 1: no cartão "Os potes do mês", digite quanto vai para Guardar, a reserva de emergência.',
              'Passo 2: digite quanto vai para Fazer Crescer, para investir.',
              'Passo 3: em "Quanto você já tem de reserva hoje", digite o que já está guardado: o app diz quantos meses de contas ele paga. O que sobrar é o pote Gastar, para o dia a dia, sem culpa.',
              'Reserva abaixo de 3 meses de contas: priorize o Guardar. Com 3 meses ou mais, o Fazer Crescer pode ganhar espaço.',
              'No fim do cartão "Para onde vai o salário", uma mensagem mostra a situação. Folga: as contas e os potes cabem. Apertado: as contas cabem, mas os potes não; diminua o Guardar ou o Fazer Crescer, ou corte alguma conta. Negativo: as contas passam do salário; corte despesas ou aumente a renda, e nunca cubra a diferença com cartão ou cheque especial.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'dia-do-salario',
            titulo: 'Dia do salário: ticando as contas',
            duracao: '1 min',
            resumo: 'A rotina do mês: ticar o que foi pago e acompanhar o que ainda falta.',
            texto: [
              'No dia do salário, abra o Meu Mês. A lista Contas do mês mostra tudo o que sai do salário: as contas de todo mês, os cofrinhos das contas do ano, a fatura do cartão e as dívidas.',
              'Pagou uma conta ou separou o cofrinho? Toque na bolinha para ticar. O item fica riscado e a barra de progresso avança. No rodapé, "Ainda falta pagar" mostra o que ainda vai sair; quando tudo estiver ticado, o app confirma: "Tudo pago neste mês."',
              'A conta mudou de valor este mês? Toque em Editar ao lado dela. O tique guarda o valor do dia em que foi marcado, então o mês já pago não muda depois.',
              'Use as setas ‹ e › para ver os próximos meses, com a fatura que já está se formando. "Voltar para o mês atual" traz você de volta. No dia 1º do mês, a nova lista aparece toda desmarcada.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'compras-no-cartao',
            titulo: 'Lançando compras no cartão: à vista, sem juros e com juros',
            duracao: '2 min',
            resumo: 'Como lançar cada compra, e ver o peso das parcelas nos próximos meses.',
            texto: [
              'Passou o cartão? Lance na hora, no cartão Cartão de crédito, em "Lançar compra". O semáforo e o "quanto ainda cabe" se atualizam a cada compra: é a melhor hora de frear.',
              'Passo 1: em "O que foi", escreva a compra.',
              'Passo 2: em "Valor da compra", digite o preço à vista.',
              'Passo 3: escolha a forma de pagamento: à vista, parcelado sem juros (o app divide o valor) ou parcelado com juros.',
              'Parcelado: escolha o número de parcelas, de 2x a 24x. O app mostra quanto vai sair por mês e até quando, somado a tudo o que você comprar depois.',
              'Com juros: digite também o valor de cada parcela, o que aparece na maquininha ou no site. O app calcula o total, quanto você paga a mais e a taxa ao mês; a partir de 3% ao mês, ele avisa que é juro de dívida cara. Se o total ficar menor que o preço, ele bloqueia, e se for igual, avisa que é parcelado sem juros.',
              'Passo 4: toque em Lançar compra. Ela aparece em "No cartão em [mês]". Errou? Toque em Editar: dá para salvar as alterações, cancelar ou remover a compra.',
            ],
            acao: 'meuMes',
          },
          {
            id: 'compras-a-vista-de-uma-vez',
            titulo: 'Compras à vista do mês de uma vez (sem anotar uma por uma)',
            duracao: '1 min',
            resumo: 'O atalho para quem não quer anotar cada compra: só o total do mês.',
            texto: [
              'Não quer anotar cada cafezinho? Lance só o total das compras à vista do mês, de uma vez.',
              'Passo 1: no cartão Cartão de crédito, toque em "Compras à vista de [mês], de uma vez".',
              'Passo 2: some tudo o que você comprou à vista no cartão no mês, que o app do banco mostra, e digite o total.',
              'Passo 3: toque em "Lançar total à vista".',
              'As compras à vista que você já anotou uma a uma fazem parte do total e são descontadas: o app mostra quanto entra a mais. O total nunca pode ser menor que o que você já anotou, e o app avisa em vermelho. Para mudar depois, use "Atualizar total à vista" ou "Voltar a anotar uma por uma".',
              'Parcelado fica de fora do total. Compra parcelada vai em "Lançar compra", com o número de vezes; conta no cartão, em Minhas contas. Assim os próximos meses já contam as parcelas.',
            ],
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'modo-recuperacao',
        titulo: 'Modo Recuperação',
        aulas: [
          {
            id: 'modo-recuperacao',
            titulo: 'Modo Recuperação: as regras para sair da dívida cara',
            duracao: '2 min',
            resumo: 'Quando liga, as três fases e o pote Quitar no lugar do Fazer Crescer.',
            texto: [
              'O Modo Recuperação liga sozinho quando há dívida cara em Minhas dívidas. Também dá para ligar à mão, em "Ligar o Modo Recuperação sem cadastrar dívida". No topo aparece "Modo Recuperação ligado", com as três fases e a fase atual marcada.',
              'Fase 1, mini-reserva: junte no pote Guardar a mini-reserva, que é metade de um mês de custo de vida, arredondada para cima em R$ 100 e nunca menos de R$ 500, pagando as parcelas mínimas em dia. Sem ela, o primeiro remédio ou conserto volta para o cartão e o plano recomeça do zero.',
              'Fase 2, quitar as dívidas caras: o pote Quitar ocupa o lugar do Fazer Crescer, que fica pausado. Nenhum investimento seguro rende o que a dívida cara cobra. Em Contas do mês, o grupo "Dívidas (plano de quitação)" mostra quanto pagar em cada dívida: a mínima mais o extra do pote Quitar.',
              'Fase 3, completar a reserva e voltar a investir: quando a última dívida cara acaba, o modo desliga sozinho e o Fazer Crescer volta. Antes de investir, complete a reserva de 3 meses de contas.',
            ],
            aviso: 'dividas',
            acao: 'meuMes',
          },
          {
            id: 'plano-de-quitacao',
            titulo: 'Plano de quitação: avalanche ou bola de neve',
            duracao: '2 min',
            resumo: 'Como o app compara os dois métodos com os seus números.',
            texto: [
              'No cartão "Plano de quitação", o primeiro passo é dizer quanto a mais por mês você consegue pôr no pote Quitar, além das parcelas mínimas. O app mostra o total por mês para as dívidas caras.',
              'Nos dois métodos, você paga a mínima de todas e põe o extra numa só. Avalanche: primeiro os juros mais altos, que paga menos juros no total. Bola de neve: primeiro a menor dívida, que dá uma vitória mais cedo e ajuda a não desistir.',
              'O app compara os dois lado a lado, com meses até quitar, juros até lá e a primeira dívida quitada. Toque no método que você vai seguir até o fim: a "Ordem de ataque" mostra em que mês cada dívida acaba. Ele também compara com pagar só as mínimas e mostra quais dívidas ficam fora do plano, as de juros baixos, que seguem só com a parcela em dia.',
              'Se aparecer "Não termina com esse valor", os juros crescem mais rápido que os pagamentos: aumente o pote Quitar ou renegocie. A simulação usa juros constantes, sem multas, IOF ou compras novas, por isso atualize o saldo de cada dívida todo mês.',
            ],
            aviso: 'dividas',
            acao: 'meuMes',
          },
          {
            id: 'pacto-e-negociar',
            titulo: 'Pacto de não parcelar e como negociar as dívidas',
            duracao: '2 min',
            resumo: 'O pacto no cartão, o roteiro de negociação e onde ficam as aulas de Sair das dívidas.',
            texto: [
              'Com o Modo Recuperação ligado, o cartão mostra o "Pacto de não parcelar". A regra é simples: se não cabe à vista, não cabe no mês. Toque em "Fazer o pacto". Depois disso, o formulário de compra só oferece "À vista"; para parcelar, você precisa tocar em "Quebrar o pacto nesta compra" e confirmar. O pacto mostra desde quando vale e quantas compras parceladas houve depois dele, e dá para desfazê-lo.',
              'Na hora de negociar, abra "Como negociar suas dívidas", no resumo do mês. São seis passos com fontes oficiais: descubra tudo o que você deve no Registrato, pare de alimentar a dívida, negocie sabendo quanto cabe, confira ofertas de acordo com cuidado, registre reclamação no consumidor.gov.br e conheça a Lei do Superendividamento.',
              'Peça a proposta por escrito, com o CET e o total a pagar. Não aceite parcela que não cabe, porque acordo quebrado volta pior. E nunca pague boleto recebido por mensagem ou link de desconhecidos: confira a oferta no canal oficial do credor.',
              'Para entender cada regra a fundo, o botão "Trilha Sair das dívidas" leva às aulas curtas sobre juros, plano, pacto e negociação. Ela é a trilha 3, aqui mesmo na aba Aprender.',
            ],
            links: [
              { rotulo: 'Registrato (Banco Central)', href: LINKS_OFICIAIS.registrato },
              { rotulo: 'consumidor.gov.br', href: LINKS_OFICIAIS.consumidor },
              { rotulo: 'Lei 14.181/2021 (Planalto)', href: LINKS_OFICIAIS.lei14181 },
            ],
            aviso: 'dividas',
            acao: 'meuMes',
          },
          {
            id: 'reserva-parada-e-vitoria',
            titulo: 'Reserva parada com dívida cara, e a vitória',
            duracao: '1 min',
            resumo: 'Usar o que passa da mini-reserva para quitar, e o que muda quando as dívidas caras acabam.',
            texto: [
              'Tem dinheiro guardado além da mini-reserva e dívida cara ao mesmo tempo? O painel do Modo Recuperação mostra quanto passa da mini-reserva, quanto de juros você economiza por mês usando esse valor e a sugestão de pagamento, das dívidas de juros mais altos para as de juros mais baixos. Dinheiro parado rende perto de 1% ao mês; a dívida cara cobra bem mais.',
              'Pague pelo canal oficial do credor e peça desconto para quitar à vista. Depois, toque em "Já paguei: atualizar reserva e dívidas" e confirme: a reserva e os saldos são atualizados. Se você pagou outro valor, ajuste em Minhas dívidas e na reserva. A mini-reserva continua guardada para imprevistos.',
              'Quando a última dívida cara é quitada, aparece a comemoração, o Modo Recuperação desliga sozinho e o pote Fazer Crescer volta. O próximo passo é completar a reserva de 3 meses de contas antes de investir.',
            ],
            aviso: 'dividas',
            acao: 'meuMes',
          },
        ],
      },
      {
        id: 'seguranca-dos-dados',
        titulo: 'Cópia de segurança',
        aulas: [
          {
            id: 'copia-de-seguranca',
            titulo: 'Cópia de segurança: salvar, restaurar e começar de novo',
            duracao: '1 min',
            resumo: 'Seus dados ficam só no aparelho: como não perdê-los ao trocar de celular.',
            texto: [
              'No Meu Mês, nada vai para a internet. Isso protege você, mas significa que, se trocar de celular ou limpar o navegador, os dados ficam para trás. Por isso, de vez em quando, salve uma cópia.',
              'Passo 1: role até o fim da tela, no cartão "Seus dados ficam só neste aparelho".',
              'Passo 2: toque em "Salvar cópia". O app baixa um arquivo com o nome meu-mes e o mês. Guarde no seu e-mail ou no Google Drive. Dica: salve uma cópia pelo menos uma vez por mês, depois de ticar as contas.',
              'No celular novo, toque em "Restaurar cópia", escolha o arquivo e confirme. A cópia substitui tudo o que está no aparelho. Se o arquivo não for uma cópia do Meu Mês, o app avisa e não altera nada.',
              'Para recomeçar do zero, use "Apagar tudo e começar de novo" e confirme. Atenção: não dá para desfazer.',
            ],
            acao: 'meuMes',
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
