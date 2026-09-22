import type { AtivoKey } from '../domain/types'

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
]

/** Total de aulas já roteirizadas em uma trilha, contando todos os tópicos. */
export function totalDeAulas(trilha: Trilha): number {
  return trilha.topicos.reduce((soma, topico) => soma + topico.aulas.length, 0)
}

/** Quantas dessas aulas já têm vídeo publicado (com `youtubeId` preenchido). */
export function aulasDisponiveis(trilha: Trilha): number {
  return trilha.topicos.reduce(
    (soma, topico) => soma + topico.aulas.filter((a) => a.youtubeId).length,
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
