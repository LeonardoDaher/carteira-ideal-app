// Meus Ativos: CATÁLOGO DE TIPOS DE INVESTIMENTO para "Adicionar posição". A pessoa escolhe o tipo numa lista
// (CDB, CRI, CRA, fundo de renda fixa, previdência...) e o app já sabe: em que bloco de Posições ele aparece,
// que classe da carteira sugerida ele ocupa e se ele costuma ser informado por valor ou por quantidade x preço.
//
// Regra de ouro (a mesma do classificador): a classe vem SUGERIDA pelo tipo, mas a pessoa a vê e pode trocar.
// As classes seguem a convenção do app: CRI, CRA, debênture, COE, previdência, multimercado e crédito privado
// ficam "fora da régua" (a carteira sugerida não tem classe para eles).
import { normalizarBusca } from './rendaFii'
import type { ClasseCarteira } from './classificadorAtivo'
import type { CategoriaPosicao } from './importacao/planilha'
import type { AtivoKey } from './types'

/** 'valor' = a pessoa informa o valor aplicado e o atual (fundos, CDB, previdência). 'cotas' = quantidade x preço (bolsa, Tesouro). */
export type ModoLancamento = 'valor' | 'cotas'

export type GrupoTipo = 'rendaFixa' | 'fundos' | 'bolsa' | 'previdencia' | 'exterior' | 'outros'

export interface TipoInvestimento {
  id: string
  rotulo: string
  grupo: GrupoTipo
  /** Uma frase para a pessoa reconhecer o investimento. */
  descricao: string
  /** Classe sugerida na comparação com a carteira sugerida. null = a pessoa escolhe. */
  classe: ClasseCarteira | null
  /** Bloco de "Posições" em que o ativo aparece. */
  categoria: CategoriaPosicao
  modo: ModoLancamento
  /** Exemplo de nome, para o campo de texto. */
  exemplo: string
  /**
   * Quando `classe` é uma EQUIVALÊNCIA (o tipo não existe na carteira sugerida e foi alocado na classe mais próxima),
   * a observação que aparece embaixo daquela classe na comparação. Sem ela, a classe é a própria do tipo.
   */
  equivalencia?: string
  /** Fundo multimercado: o valor é repartido entre estas classes (pesos que somam 1), como a carteira sugerida trata multimercados. */
  distribuicao?: Partial<Record<AtivoKey, number>>
  /** Tem data de vencimento (renda fixa, COE). */
  vencimento?: boolean
  /** Tem taxa (rentabilidade contratada ou de administração). O texto é o exemplo mostrado no campo. */
  taxaExemplo?: string
}

export const GRUPOS_TIPO: { id: GrupoTipo; rotulo: string }[] = [
  { id: 'rendaFixa', rotulo: 'Renda fixa' },
  { id: 'fundos', rotulo: 'Fundos de investimento' },
  { id: 'bolsa', rotulo: 'Bolsa (ações, FIIs, ETFs e BDRs)' },
  { id: 'previdencia', rotulo: 'Previdência' },
  { id: 'exterior', rotulo: 'Exterior, ouro e criptomoedas' },
  { id: 'outros', rotulo: 'Outros' },
]

export const TIPOS_INVESTIMENTO: TipoInvestimento[] = [
  // Renda fixa
  { id: 'tesouro-selic', rotulo: 'Tesouro Selic', grupo: 'rendaFixa', descricao: 'Título público pós-fixado, com liquidez diária.', classe: 'tesouroSelic', categoria: 'tesouro', modo: 'cotas', exemplo: 'Tesouro Selic 2029', vencimento: true, taxaExemplo: 'Selic + 0,10% a.a.' },
  { id: 'tesouro-ipca', rotulo: 'Tesouro IPCA+', grupo: 'rendaFixa', descricao: 'Título público que paga IPCA mais uma taxa fixa.', classe: 'tesouroIPCA', categoria: 'tesouro', modo: 'cotas', exemplo: 'Tesouro IPCA+ 2035', vencimento: true, taxaExemplo: 'IPCA + 6,20% a.a.' },
  { id: 'tesouro-prefixado', rotulo: 'Tesouro Prefixado', grupo: 'rendaFixa', descricao: 'Título público com taxa fixa conhecida na compra.', classe: 'tesouroPrefixado', categoria: 'tesouro', modo: 'cotas', exemplo: 'Tesouro Prefixado 2029', vencimento: true, taxaExemplo: '13,50% a.a.' },
  { id: 'tesouro-renda', rotulo: 'Tesouro Renda+ / Educa+', grupo: 'rendaFixa', descricao: 'Indexado ao IPCA, para aposentadoria ou educação.', classe: 'tesouroIPCA', categoria: 'tesouro', modo: 'cotas', exemplo: 'Tesouro Renda+ 2049', equivalencia: 'Tesouro Renda+ / Educa+ contado como Tesouro IPCA+: também é indexado ao IPCA.', vencimento: true, taxaExemplo: 'IPCA + 6,00% a.a.' },
  { id: 'cdb-liquidez', rotulo: 'CDB com liquidez diária', grupo: 'rendaFixa', descricao: 'Empréstimo a um banco, com resgate a qualquer dia.', classe: 'cdbLiquidez', categoria: 'rendaFixa', modo: 'valor', exemplo: 'CDB Banco X liquidez diária', vencimento: true, taxaExemplo: '100% do CDI' },
  { id: 'cdb', rotulo: 'CDB (com prazo)', grupo: 'rendaFixa', descricao: 'CDB com vencimento: pós, pré ou híbrido.', classe: 'foraDaRegua', categoria: 'rendaFixa', modo: 'valor', exemplo: 'CDB Banco X 2028', vencimento: true, taxaExemplo: '110% do CDI' },
  { id: 'lci-lca', rotulo: 'LCI / LCA', grupo: 'rendaFixa', descricao: 'Letras de crédito imobiliário ou do agronegócio, isentas de IR.', classe: 'lciLca', categoria: 'rendaFixa', modo: 'valor', exemplo: 'LCI Banco Y 2027', vencimento: true, taxaExemplo: '92% do CDI' },
  { id: 'lc', rotulo: 'LC (Letra de Câmbio)', grupo: 'rendaFixa', descricao: 'Título de renda fixa emitido por financeiras e bancos.', classe: 'foraDaRegua', categoria: 'rendaFixa', modo: 'valor', exemplo: 'LC Banco Z 2027', vencimento: true, taxaExemplo: '105% do CDI' },
  { id: 'cri', rotulo: 'CRI', grupo: 'rendaFixa', descricao: 'Certificado de Recebíveis Imobiliários, isento de IR para pessoa física.', classe: 'lciLca', categoria: 'rendaFixa', modo: 'valor', exemplo: 'CRI Nome da emissão', equivalencia: 'CRI contado como LCI / LCA: crédito privado isento de IR, o mesmo papel na carteira sugerida (como nas carteiras-modelo).', vencimento: true, taxaExemplo: 'IPCA + 7,50% a.a.' },
  { id: 'cra', rotulo: 'CRA', grupo: 'rendaFixa', descricao: 'Certificado de Recebíveis do Agronegócio, isento de IR para pessoa física.', classe: 'lciLca', categoria: 'rendaFixa', modo: 'valor', exemplo: 'CRA Nome da emissão', equivalencia: 'CRA contado como LCI / LCA: crédito privado isento de IR, o mesmo papel na carteira sugerida (como nas carteiras-modelo).', vencimento: true, taxaExemplo: 'IPCA + 7,50% a.a.' },
  { id: 'debenture', rotulo: 'Debênture', grupo: 'rendaFixa', descricao: 'Dívida de empresa, comum ou incentivada (isenta de IR).', classe: 'foraDaRegua', categoria: 'rendaFixa', modo: 'valor', exemplo: 'Debênture Empresa 2030', vencimento: true, taxaExemplo: 'CDI + 1,50% a.a.' },
  { id: 'poupanca', rotulo: 'Poupança', grupo: 'rendaFixa', descricao: 'Caderneta de poupança, usada como reserva e liquidez.', classe: 'cdbLiquidez', categoria: 'rendaFixa', modo: 'valor', exemplo: 'Poupança Banco X', equivalencia: 'Poupança contada como CDB com liquidez diária: reserva e liquidez.' },

  // Fundos de investimento
  { id: 'fundo-di', rotulo: 'Fundo DI / Referenciado DI', grupo: 'fundos', descricao: 'Fundo que acompanha o CDI. Na prática, faz o papel de caixa.', classe: 'tesouroSelic', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo DI Banco X', equivalencia: 'Fundo DI contado como Tesouro Selic: acompanha a taxa básica e faz o papel de caixa.', taxaExemplo: 'Taxa de administração 0,50% a.a.' },
  { id: 'fundo-rf', rotulo: 'Fundo de renda fixa', grupo: 'fundos', descricao: 'Fundo de títulos públicos e privados, pré, pós ou inflação.', classe: 'foraDaRegua', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo Renda Fixa Gestora X', taxaExemplo: 'Taxa de administração 0,60% a.a.' },
  { id: 'fundo-credito', rotulo: 'Fundo de crédito privado', grupo: 'fundos', descricao: 'Fundo que compra dívida de empresas (debêntures, CRI, CRA).', classe: 'foraDaRegua', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo Crédito Privado Gestora X', taxaExemplo: 'Taxa de administração 0,80% a.a.' },
  { id: 'fundo-multi', rotulo: 'Fundo multimercado', grupo: 'fundos', descricao: 'Fundo que mistura juros, bolsa, câmbio e outros mercados.', classe: 'foraDaRegua', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo Multimercado Gestora X', equivalencia: 'Fundo multimercado repartido como a carteira sugerida trata multimercados: 40% FIIs, 20% Ouro, 20% BDRs e 20% Fundos internacionais.', distribuicao: { fiis: 0.4, ouro: 0.2, bdrs: 0.2, fundosInternacionais: 0.2 }, taxaExemplo: 'Taxa de administração 1,50% a.a.' },
  { id: 'fundo-acoes', rotulo: 'Fundo de ações', grupo: 'fundos', descricao: 'Fundo que investe em ações da bolsa brasileira.', classe: 'acoesETFs', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo de Ações Gestora X', equivalencia: 'Fundo de ações contado como Ações.', taxaExemplo: 'Taxa de administração 1,50% a.a.' },
  { id: 'fundo-imob', rotulo: 'Fundo imobiliário não listado', grupo: 'fundos', descricao: 'Fundo de imóveis ou recebíveis que não é negociado na bolsa.', classe: 'fiis', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo Imobiliário Gestora X', equivalencia: 'Fundo imobiliário não listado contado como FIIs.', taxaExemplo: 'Taxa de administração 1,00% a.a.' },
  { id: 'fundo-intl', rotulo: 'Fundo internacional / cambial', grupo: 'fundos', descricao: 'Fundo que investe no exterior ou acompanha o dólar.', classe: 'fundosInternacionais', categoria: 'fundosInvest', modo: 'valor', exemplo: 'Fundo Global Gestora X', equivalencia: 'Fundo internacional contado como Fundos internacionais / ETFs.', taxaExemplo: 'Taxa de administração 1,00% a.a.' },

  // Bolsa
  { id: 'acao', rotulo: 'Ações e units', grupo: 'bolsa', descricao: 'Participação em empresas listadas na B3.', classe: 'acoesETFs', categoria: 'acoes', modo: 'cotas', exemplo: 'PETR4' },
  { id: 'fii', rotulo: 'FIIs e Fiagro', grupo: 'bolsa', descricao: 'Fundos imobiliários e do agro negociados na B3.', classe: 'fiis', categoria: 'fundos', modo: 'cotas', exemplo: 'MXRF11' },
  { id: 'etf', rotulo: 'ETF de bolsa (B3)', grupo: 'bolsa', descricao: 'Fundo de índice negociado na B3, como BOVA11.', classe: 'acoesETFs', categoria: 'etf', modo: 'cotas', exemplo: 'BOVA11' },
  { id: 'bdr', rotulo: 'BDR', grupo: 'bolsa', descricao: 'Recibo de ação estrangeira negociado na B3.', classe: 'bdrs', categoria: 'bdr', modo: 'cotas', exemplo: 'AAPL34' },

  // Previdência
  { id: 'pgbl', rotulo: 'PGBL', grupo: 'previdencia', descricao: 'Previdência com dedução de até 12% da renda no IR (declaração completa).', classe: 'foraDaRegua', categoria: 'previdencia', modo: 'valor', exemplo: 'PGBL Banco X', taxaExemplo: 'Taxa de administração 1,00% a.a.' },
  { id: 'vgbl', rotulo: 'VGBL', grupo: 'previdencia', descricao: 'Previdência sem dedução; o IR incide só sobre o rendimento.', classe: 'foraDaRegua', categoria: 'previdencia', modo: 'valor', exemplo: 'VGBL Banco X', taxaExemplo: 'Taxa de administração 1,00% a.a.' },

  // Exterior, ouro e cripto
  { id: 'exterior', rotulo: 'Investimento no exterior', grupo: 'exterior', descricao: 'Ações, ETFs ou fundos comprados por conta global ou corretora estrangeira.', classe: 'fundosInternacionais', categoria: 'etf', modo: 'valor', exemplo: 'Conta global Corretora X', equivalencia: 'Investimento no exterior contado como Fundos internacionais / ETFs.' },
  { id: 'ouro', rotulo: 'Ouro', grupo: 'exterior', descricao: 'Ouro em ETF, fundo ou físico.', classe: 'ouro', categoria: 'ouro', modo: 'valor', exemplo: 'Ouro (ETF GOLD11)' },
  { id: 'cripto', rotulo: 'Criptomoedas', grupo: 'exterior', descricao: 'Bitcoin, Ethereum e outras, em corretora ou carteira própria.', classe: 'cripto', categoria: 'cripto', modo: 'cotas', exemplo: 'Bitcoin' },

  // Outros
  { id: 'coe', rotulo: 'COE', grupo: 'outros', descricao: 'Certificado de Operações Estruturadas, emitido por bancos.', classe: 'foraDaRegua', categoria: 'outra', modo: 'valor', exemplo: 'COE Banco X', vencimento: true, taxaExemplo: 'Capital protegido + 50% da alta' },
  { id: 'outro', rotulo: 'Outro investimento', grupo: 'outros', descricao: 'Qualquer ativo que não esteja na lista.', classe: null, categoria: 'outra', modo: 'cotas', exemplo: 'PETR4, CDB Banco X...' },
]

export const tipoPorId = (id: string | undefined | null): TipoInvestimento | undefined => (id ? TIPOS_INVESTIMENTO.find((t) => t.id === id) : undefined)

/** Filtra a lista pelo que a pessoa digitou (sem acento, em qualquer parte do nome ou da descrição). */
/** Tipos que aparecem num bloco de Posições (ex.: no bloco "Renda fixa": CDB, LCI/LCA, CRI, CRA...). */
export const tiposDaCategoria = (categoria: CategoriaPosicao): TipoInvestimento[] => TIPOS_INVESTIMENTO.filter((t) => t.categoria === categoria)

export function buscarTipos(consulta: string, base: TipoInvestimento[] = TIPOS_INVESTIMENTO): TipoInvestimento[] {
  const q = normalizarBusca(consulta).trim()
  if (!q) return base
  return base.filter((t) => normalizarBusca(`${t.rotulo} ${t.descricao}`).includes(q))
}
