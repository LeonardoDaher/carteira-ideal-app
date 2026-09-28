import type { AtivoKey } from '../../domain/types'
import type { AnaliseAtivo } from './types'
import { tesouroSelic } from './tesouroSelic'
import { tesouroIPCA } from './tesouroIPCA'
import { tesouroPrefixado } from './tesouroPrefixado'
import { cdbLiquidez } from './cdbLiquidez'
import { lciLca } from './lciLca'
import { fiis } from './fiis'
import { acoesETFs } from './acoesETFs'
import { bdrs } from './bdrs'
import { ouro } from './ouro'
import { fundosInternacionais } from './fundosInternacionais'
import { cripto } from './cripto'

/**
 * Conteúdo educativo sobre como analisar cada classe de ativo (D26: sem citar certificação
 * profissional que o responsável não tem): explica os
 * CRITÉRIOS usados (o "como escolher") e traz nomes ilustrativos de mercado como
 * exemplo de aplicação desses critérios — não é uma recomendação de compra formal.
 * Dados de mercado mudam o tempo todo; sempre confira números atualizados antes de decidir.
 *
 * Cada classe de ativo vive no seu próprio arquivo nesta pasta (um por `AtivoKey`) para
 * que editar o texto de um ativo não exija abrir um arquivo único com centenas de outras
 * linhas de conteúdo. Este arquivo só agrega tudo num único `Record`.
 */
export const ANALISES: Record<AtivoKey, AnaliseAtivo> = {
  tesouroSelic,
  tesouroIPCA,
  tesouroPrefixado,
  cdbLiquidez,
  lciLca,
  fiis,
  acoesETFs,
  bdrs,
  ouro,
  fundosInternacionais,
  cripto,
}
