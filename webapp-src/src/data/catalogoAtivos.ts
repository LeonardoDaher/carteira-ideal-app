import { montarCatalogo } from '../domain/classificadorAtivo'
import { registrarDados } from './arquivosMercado'

/**
 * Listas de FIIs, ETFs e BDRs que o app já usa nos simuladores, reunidas para o classificador da
 * Minha Carteira reconhecer o ativo pelo ticker. Os JSONs são os mesmos das telas Simule FII/ETF/BDR
 * (D137: baixados sob demanda por `arquivosMercado.ts`; o catálogo é remontado quando cada um chega). A conversão passa por `unknown`, como em snapshotEtfs.ts.
 */
type Lista<T> = { [k: string]: unknown } & T
type Fiis = Lista<{ fundos?: { ticker: string }[]; indisponiveis?: { ticker: string }[] }>
type Etfs = Lista<{ etfs?: { ticker: string; nome: string; categoria: string }[]; busca?: { ticker: string; nome: string; categoria: string }[] }>
type Bdrs = Lista<{ acoes?: { ticker: string }[]; etfs?: { ticker: string }[]; busca?: { ticker: string; tipo?: string }[] }>

let f: Fiis = {}
let e: Etfs = {}
let b: Bdrs = {}

function montar() {
  return montarCatalogo({
    fiis: [...(f.fundos ?? []), ...(f.indisponiveis ?? [])],
    etfs: [...(e.etfs ?? []), ...(e.busca ?? [])],
    bdrs: [...(b.acoes ?? []), ...(b.busca ?? [])],
    bdrsEtfs: b.etfs ?? [],
  })
}

/** Começa vazio e é remontado a cada arquivo que chega. As telas que o usam só aparecem depois que os três chegaram (`DADOS_DA_TELA`). */
export let CATALOGO_ATIVOS = montar()
registrarDados<Fiis>('rendimentosFii', (d) => {
  f = d
  CATALOGO_ATIVOS = montar()
})
registrarDados<Etfs>('etfs', (d) => {
  e = d
  CATALOGO_ATIVOS = montar()
})
registrarDados<Bdrs>('bdrs', (d) => {
  b = d
  CATALOGO_ATIVOS = montar()
})
