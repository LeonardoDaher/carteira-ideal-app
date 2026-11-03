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
/** Os sete rankings de `snapshotTop15Mercado.ts` (um módulo só). */
const TOP15_MERCADO: ChaveDeDados[] = [
  'acoesMaisNegociadas',
  'bdrsMaisNegociados',
  'etfsMaisNegociados',
  'fiisMaisNegociados',
  'bdrsDesconto',
  'ibovMaioresPesos',
  'ifixMaioresPesos',
]
/** O que `destaquesGerais()` junta: radares de ações, FIIs, BDRs e ETFs. */
const DESTAQUES: ChaveDeDados[] = [...TOP15_MERCADO, 'radarDividendos', 'acoesEndividadas', 'acoesDividendos']

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
  simuleFii: [...CATALOGO, ...TOP15_MERCADO, 'fiiBaratos', 'fiisPreco', ...MERCADO],
  simuleBdr: [...CATALOGO, ...TOP15_MERCADO, ...MERCADO],
  simuleEtf: [...CATALOGO, ...TOP15_MERCADO, ...MERCADO],
  simuleAcoes: [
    ...DESTAQUES,
    ...MERCADO,
    ...CATALOGO,
    'acoesBaratas',
    'acoes',
    'radarInteligente',
  ],
}
