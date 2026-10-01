import { montarCatalogo } from '../domain/classificadorAtivo'
import dadosBdrs from './bdrs.json'
import dadosEtfs from './etfs.json'
import dadosFiis from './rendimentosFii.json'

/**
 * Listas de FIIs, ETFs e BDRs que o app já usa nos simuladores, reunidas para o classificador da
 * Minha Carteira reconhecer o ativo pelo ticker. Os JSONs são os mesmos das telas Simule FII/ETF/BDR
 * (o bundler os reaproveita, sem duplicar). A conversão passa por `unknown`, como em snapshotEtfs.ts.
 */
type Lista<T> = { [k: string]: unknown } & T
const f = dadosFiis as unknown as Lista<{ fundos?: { ticker: string }[]; indisponiveis?: { ticker: string }[] }>
const e = dadosEtfs as unknown as Lista<{ etfs?: { ticker: string; nome: string; categoria: string }[]; busca?: { ticker: string; nome: string; categoria: string }[] }>
const b = dadosBdrs as unknown as Lista<{ acoes?: { ticker: string }[]; etfs?: { ticker: string }[]; busca?: { ticker: string; tipo?: string }[] }>

export const CATALOGO_ATIVOS = montarCatalogo({
  fiis: [...(f.fundos ?? []), ...(f.indisponiveis ?? [])],
  etfs: [...(e.etfs ?? []), ...(e.busca ?? [])],
  bdrs: [...(b.acoes ?? []), ...(b.busca ?? [])],
  bdrsEtfs: b.etfs ?? [],
})
