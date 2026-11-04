import type { ChaveDeDados } from './arquivosMercado'
import type { Screen } from '../state/useAppState'

/**
 * Quais arquivos de mercado cada tela precisa ANTES de aparecer (D137). O `App.tsx` só mostra a tela quando todos chegaram.
 * Tela que não está aqui não baixa nenhum (questionário, resultado, carteira, aulas, Meu Mês, Simule Bens, HP 12C...).
 *
 * O teste `dadosPorTela.test.ts` percorre os imports de cada tela e falha se ela alcançar um arquivo que não está listado:
 * ao criar uma tela (ou um componente) que lê um `SNAPSHOT_*`, o teste diz o que acrescentar aqui.
 */
const MERCADO: ChaveDeDados[] = ['mercadoOficial']
/** Catálogo que reconhece FIIs, ETFs e BDRs pelo código (`catalogoAtivos.ts`). */
const CATALOGO: ChaveDeDados[] = ['rendimentosFii', 'etfs', 'bdrs']
/** Os rankings que `destaquesGerais()` junta (um módulo por arquivo, D139). O de BDRs com desconto não entra. */
const RANKINGS_DOS_DESTAQUES: ChaveDeDados[] = [
  'acoesMaisNegociadas',
  'bdrsMaisNegociados',
  'etfsMaisNegociados',
  'fiisMaisNegociados',
  'ibovMaioresPesos',
  'ifixMaioresPesos',
]
/** O que `destaquesGerais()` junta: rankings e radares de ações, FIIs, BDRs e ETFs. */
const DESTAQUES: ChaveDeDados[] = [...RANKINGS_DOS_DESTAQUES, 'radarDividendos', 'acoesEndividadas', 'acoesDividendos']

export const DADOS_DA_TELA: Partial<Record<Screen, readonly ChaveDeDados[]>> = {
  simulador: CATALOGO,
  minhaCarteira: CATALOGO,
  detalheAtivo: [...DESTAQUES, ...MERCADO],
  simuleTesouro: MERCADO,
  simuleImovel: MERCADO,
  simuleCarro: MERCADO,
  simuleMoto: MERCADO,
  simuleFuturos: ['futuros'],
  simuleOpcoes: [...MERCADO, 'acoesEndividadas', ...CATALOGO],
  simuleFii: [...CATALOGO, 'fiisMaisNegociados', 'ifixMaioresPesos', 'fiiBaratos', 'fiisPreco', ...MERCADO],
  simuleBdr: [...CATALOGO, 'bdrsMaisNegociados', 'bdrsDesconto', ...MERCADO],
  simuleEtf: [...CATALOGO, 'etfsMaisNegociados', ...MERCADO],
  simuleAcoes: [
    'acoesMaisNegociadas',
    'ibovMaioresPesos',
    'radarDividendos',
    'acoesEndividadas',
    'acoesDividendos',
    ...MERCADO,
    ...CATALOGO,
    'acoesBaratas',
    'acoes',
    'radarInteligente',
  ],
}
