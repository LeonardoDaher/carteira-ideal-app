import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { pct, quantidadeBR, reais } from './formatar'

/** O que aparece no lugar de um valor escondido. */
export const MASCARA = '****'

/** true = valores escondidos. Sem provedor (outras telas, testes de componentes soltos), os valores aparecem. */
const Oculto = createContext(false)

export function ValoresProvider({ oculto, children }: { oculto: boolean; children: ReactNode }) {
  return <Oculto.Provider value={oculto}>{children}</Oculto.Provider>
}

/**
 * Formatadores dos valores PESSOAIS da carteira (dinheiro, quantidades e resultado em %). Com os valores
 * escondidos, devolvem "****" em vez do número, inclusive nos rótulos para leitores de tela. A fatia de cada
 * ativo na carteira ("12% da carteira") não é valor em reais e continua visível.
 */
export function useValores() {
  const oculto = useContext(Oculto)
  return {
    oculto,
    reais: (n: number): string => (oculto ? `R$ ${MASCARA}` : reais(n)),
    quantidade: (n: number): string => (oculto ? MASCARA : quantidadeBR(n)),
    /** Rentabilidade ("+12,35%"): diz quanto a pessoa ganhou, então esconde junto com os valores. */
    resultadoPct: (n: number, comSinal = true): string => (oculto ? MASCARA : pct(n, comSinal)),
  }
}
