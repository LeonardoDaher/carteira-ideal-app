import type { AnaliseAtivo } from './types'

export const fundosInternacionais: AnaliseAtivo = {
    contexto:
      'ETFs (fundos negociados em bolsa que replicam um índice) que dão acesso a bolsas e economias fora do Brasil — a forma mais simples de diversificar geograficamente e se expor ao dólar sem escolher ações uma a uma.',
    criterios: [
      'Comece pelo mais líquido e conhecido: um ETF que replique o S&P 500 (ex.: IVVB11) já dá exposição às maiores empresas dos EUA.',
      'Para diversificar além dos EUA, existem ETFs de índices globais (somando países desenvolvidos e emergentes) ou de mercados específicos, como China.',
      'Avalie se o custo (taxa de administração) de um ETF mais nichado (um único país ou setor) compensa a diversificação extra frente a um ETF global amplo.',
      'O resultado em reais depende de dois fatores: o desempenho do índice no exterior E a variação do dólar frente ao real — os dois podem se somar ou se cancelar.',
    ],
    blocos: [
      {
        titulo: 'Formas de acesso',
        itens: [
          { nome: 'IVVB11', detalhe: 'Replica o S&P 500 em reais, o principal índice de ações dos EUA (grandes empresas de todos os setores), com exposição cambial ao dólar.' },
          { nome: 'NASD11', detalhe: 'Replica o Nasdaq-100, índice das 100 maiores empresas não financeiras da bolsa Nasdaq (forte concentração em tecnologia, como Apple, Microsoft e Nvidia). Mais concentrado em um setor do que o IVVB11.' },
          { nome: 'WRLD11', detalhe: 'Replica um índice global (FTSE Global All Cap) com milhares de empresas de países desenvolvidos e emergentes — a opção mais diversificada geograficamente, em vez de apostar só nos EUA.' },
          { nome: 'XINA11', detalhe: 'Replica o MSCI China, dando exposição a centenas de empresas chinesas. Mercado específico, mais concentrado e sujeito a riscos regulatórios e políticos próprios da China.' },
        ],
      },
    ],
    atencao: 'Quanto mais nichado o ETF (um único país ou setor, como XINA11 ou NASD11), maior a concentração de risco — combine com um ETF mais amplo (IVVB11 ou WRLD11) em vez de apostar tudo numa única fatia do mercado internacional.',
}
