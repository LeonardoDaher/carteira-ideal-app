import type { AtivoKey } from '../domain/types'

export interface AtivoInfo {
  label: string
  cor: string
  descricao: string
}

/** Cada classe usa um tom próprio da paleta --asset-* (index.css), com 40° de distância
 * entre si no círculo de cores — evita que duas fatias fiquem parecidas na mesma carteira. */
export const ATIVOS: Record<AtivoKey, AtivoInfo> = {
  tesouroSelic: {
    label: 'Tesouro Selic',
    cor: 'var(--asset-tesouro)',
    descricao: 'Título público pós-fixado com liquidez diária. Baixíssimo risco, ideal para reserva de emergência.',
  },
  tesouroIPCA: {
    label: 'Tesouro Direto',
    cor: 'var(--asset-tesouro-ipca)',
    descricao: 'Reúne Tesouro Selic, Tesouro IPCA+ e Tesouro Prefixado — três títulos públicos com indexadores diferentes (pós-fixado, inflação e taxa fixa). Toque para ver o percentual de cada tipo na sua carteira.',
  },
  tesouroPrefixado: {
    label: 'Tesouro Prefixado',
    cor: 'var(--asset-tesouro-pre)',
    descricao: 'Título público com taxa de retorno fixa e conhecida na hora da compra. Bom quando você já sabe a data em que vai usar o dinheiro.',
  },
  cdbLiquidez: {
    label: 'CDB com liquidez diária',
    cor: 'var(--asset-cdb)',
    descricao: 'Empréstimo a um banco, geralmente coberto pelo FGC até R$ 250 mil. Bom equilíbrio entre segurança e rendimento.',
  },
  lciLca: {
    label: 'LCI / LCA',
    cor: 'var(--asset-lcilca)',
    descricao: 'Letras de Crédito Imobiliário e do Agronegócio: título de renda fixa emitido por bancos para captar recursos aos setores imobiliário e agro. Isenta de Imposto de Renda para pessoa física e coberta pelo FGC até R$ 250 mil — o "CDB isento", só que com carência mínima antes do resgate.',
  },
  fiis: {
    label: 'Fundos Imobiliários (FIIs)',
    cor: 'var(--asset-fiis)',
    descricao: 'Fundos que investem em imóveis ou recebíveis imobiliários e distribuem renda mensal. Risco moderado.',
  },
  acoesETFs: {
    label: 'Ações',
    cor: 'var(--asset-acoes)',
    descricao: 'Participação direta no capital de empresas listadas na bolsa brasileira. Maior potencial de retorno e de oscilação.',
  },
  bdrs: {
    label: 'BDRs',
    cor: 'var(--asset-bdrs)',
    descricao: 'Recibos de ações de empresas estrangeiras negociados na bolsa brasileira. Exposição internacional com risco cambial.',
  },
  ouro: {
    label: 'Ouro',
    cor: 'var(--asset-ouro)',
    descricao: 'Proteção contra crises e desvalorização da moeda — historicamente descorrelacionado das ações e da renda fixa brasileira.',
  },
  fundosInternacionais: {
    label: 'Fundos Internacionais / ETFs',
    cor: 'var(--asset-fundosinternacionais)',
    descricao: 'ETFs que replicam índices de bolsas fora do Brasil (EUA, China, mercados globais), diversificando a carteira geograficamente e expondo parte dela ao dólar.',
  },
  cripto: {
    label: 'Criptomoedas',
    cor: 'var(--asset-cripto)',
    descricao: 'Exposição a criptoativos via fundos, ETFs, BDRs e compra direta. Classe de altíssima volatilidade — fatia pequena, reservada a perfis Arrojados.',
  },
}
