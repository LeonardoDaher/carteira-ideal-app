import type { PerguntaArquitetura } from '../domain/types'

/**
 * As 7 perguntas da Arquitetura Patrimonial, aplicadas em complemento às 7 perguntas de
 * suitability já existentes (ver data/questions.ts). O cliente responde as 14 no total.
 *
 * Cada opção tem peso 1 (a) a 3 (c), somado pelo motor (ver domain/engine.ts) para chegar
 * ao score de capacidade real (7 a 21). Os pilares 1, 2 e 3 são "restrições duras": uma
 * resposta 'a' neles aciona a regra de veto e força o perfil final para Defensivo,
 * independentemente do score consolidado ou do resultado do suitability.
 *
 * Texto literal conforme o documento "Estrutura de uma carteira verdadeiramente
 * personalizada".
 */
export const PERGUNTAS_ARQUITETURA: PerguntaArquitetura[] = [
  {
    id: 'capacidadeFinanceira',
    titulo:
      'Se você perdesse sua fonte principal de renda hoje, por quanto tempo sua reserva atual pagaria suas contas sem precisar vender investimentos de longo prazo?',
    ajuda: 'Pilar 1 de 7 — Capacidade Financeira de Risco (restrição dura).',
    restricaoDura: true,
    opcoes: [
      { letra: 'a', texto: 'Menos de 3 meses (Capacidade Baixa — Exige foco total em liquidez e Selic)' },
      { letra: 'b', texto: 'De 3 a 12 meses (Capacidade Média — Permite alocação moderada)' },
      { letra: 'c', texto: 'Mais de 12 meses (Capacidade Alta — Liberdade para buscar rentabilidade)' },
    ],
  },
  {
    id: 'passivoDividas',
    titulo: 'Qual é a situação das suas obrigações financeiras e custos fixos atuais?',
    ajuda: 'Pilar 2 de 7 — Arquitetura do Passivo & Dívidas (restrição dura).',
    restricaoDura: true,
    opcoes: [
      { letra: 'a', texto: 'Possuo dívidas caras (cartão, cheque especial, empréstimo pessoal) ou passivos em dólar.' },
      {
        letra: 'b',
        texto: 'Possuo dívidas estruturadas/longas (financiamento imobiliário/auto com taxa baixa) e custos fixos controlados.',
      },
      { letra: 'c', texto: 'Zero dívidas e custo fixo baixo em relação ao que ganho.' },
    ],
  },
  {
    id: 'janelaLiquidez',
    titulo:
      'Você tem algum grande evento de gasto planejado para os próximos 2 a 5 anos (imóvel, casamento, reforma, viagem, transição de carreira)?',
    ajuda: 'Pilar 3 de 7 — Janela de Liquidez & Desembolsos (restrição dura).',
    restricaoDura: true,
    opcoes: [
      { letra: 'a', texto: 'Sim, vou precisar sacar uma fatia relevante do capital em até 24 meses.' },
      { letra: 'b', texto: 'Sim, mas o desembolso será médio e ocorrerá entre 3 e 5 anos.' },
      { letra: 'c', texto: 'Não, todo o dinheiro aportado é para longo prazo (5 a 10+ anos).' },
    ],
  },
  {
    id: 'comportamentoEstresse',
    titulo: 'Como você reagiu (ou reagiria) se visse sua carteira caindo 20% a 30% em um momento de crise de mercado?',
    ajuda: 'Pilar 4 de 7 — Comportamento sob Estresse (calibrador suave).',
    restricaoDura: false,
    opcoes: [
      { letra: 'a', texto: 'Resgataria tudo para parar de perder dinheiro (Trauma de perda/Conservador na prática).' },
      { letra: 'b', texto: 'Ficaria desconfortável e pararia de olhar a conta, mas não venderia nada.' },
      { letra: 'c', texto: 'Veria como oportunidade e usaria o caixa para comprar mais ativos baratos.' },
    ],
  },
  {
    id: 'dependenciaRenda',
    titulo: 'Qual é o objetivo principal dos rendimentos gerados por essa carteira hoje?',
    ajuda: 'Pilar 5 de 7 — Dependência de Renda Passiva (calibrador suave).',
    restricaoDura: false,
    opcoes: [
      { letra: 'a', texto: 'Preciso do dinheiro caindo na conta mensal/semestralmente para pagar custo de vida.' },
      { letra: 'b', texto: 'Não preciso agora, mas quero construir uma transição para viver de renda em 3 a 5 anos.' },
      { letra: 'c', texto: 'Acúmulo 100% focado no longo prazo (reinvisto todas as regras, dividendos e juros).' },
    ],
  },
  {
    id: 'capitalHumano',
    titulo: 'Qual é o perfil da sua atividade profissional e patrimônio fora do mercado financeiro?',
    ajuda: 'Pilar 6 de 7 — Capital Humano & Concentração de Risco (calibrador suave).',
    restricaoDura: false,
    opcoes: [
      { letra: 'a', texto: 'Renda variável/oscilante (empresário, autônomo, comissionado).' },
      { letra: 'b', texto: 'Renda estável (CLT consolidado em grande empresa, profissional liberal tradicional).' },
      { letra: 'c', texto: 'Renda ultra estável (concursado público, aposentado, rentista).' },
    ],
  },
  {
    id: 'eficienciaFiscal',
    titulo: 'Como é estruturada a sua declaração de Imposto de Renda e visão de futuro do patrimônio?',
    ajuda: 'Pilar 7 de 7 — Eficiência Fiscal & Planejamento Sucessório (calibrador suave).',
    restricaoDura: false,
    opcoes: [
      { letra: 'a', texto: 'Declaração Completa do IR (PF) e busco formas de deduzir imposto (ex: PGBL).' },
      { letra: 'b', texto: 'Declaração Simplificada (PF) ou operações via PJ/Empresa.' },
      { letra: 'c', texto: 'Foco principal em facilitar a transferência para herdeiros no futuro (sucessão/doação).' },
    ],
  },
]
