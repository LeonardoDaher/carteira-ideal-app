import type { AtivoKey, Carteira } from '../domain/types'

/**
 * Classes de Tesouro Direto que passam a aparecer juntas, como uma única fatia
 * "Tesouro Direto", em qualquer lugar que mostre a carteira ao cliente (gráfico,
 * legenda, simulador). A tela de detalhe do agregado usa a arquitetura/conteúdo do
 * Tesouro IPCA+ (contexto, critérios, atenção) — por isso o percentual combinado
 * fica sob a chave 'tesouroIPCA' (ver ATIVOS.tesouroIPCA em assets.ts).
 */
const CLASSES_TESOURO_DIRETO: AtivoKey[] = ['tesouroSelic', 'tesouroIPCA', 'tesouroPrefixado']

/**
 * Devolve uma versão "de exibição" da carteira, com Tesouro Selic, Tesouro IPCA+ e
 * Tesouro Prefixado somados numa única fatia (Tesouro Direto, sob a chave
 * 'tesouroIPCA'). Usada em qualquer lugar que renderize a carteira para o cliente
 * (gráfico, legenda, simulador) — o motor de recomendação (engine.ts) continua
 * calculando os três tipos separadamente por baixo, para manter as travas de
 * liquidez, prazo e calibradores intactas. A tela de detalhe usa a carteira original
 * (não esta) para calcular o percentual de cada tipo dentro do agregado.
 */
export function carteiraParaExibicao(carteira: Carteira): Carteira {
  const somaTesouro = CLASSES_TESOURO_DIRETO.reduce((s, k) => s + (carteira[k] ?? 0), 0)
  if (somaTesouro <= 0) return carteira

  const exibicao: Carteira = { ...carteira }
  for (const chave of CLASSES_TESOURO_DIRETO) delete exibicao[chave]
  exibicao.tesouroIPCA = somaTesouro
  return exibicao
}
