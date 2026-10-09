import { useCallback, useEffect, useState } from 'react'
import { storage } from '../data/storage'
import {
  LISTA_VAZIA,
  adicionarItens,
  alternarComprado,
  desmarcarTodos,
  interpretarTexto,
  limparComprados,
  mudarCategoria,
  removerItem,
  validarLista,
} from '../domain/supermercado'
import type { CategoriaId, ListaDeCompras } from '../domain/supermercado'

/**
 * Estado do Meu Mês Supermercado (D74). Chave própria no aparelho, separada do orçamento
 * (`carteiraideal.orcamento`): a lista de compras não mexe nas contas do mês e vice-versa.
 * Nada vai para a API.
 */
export const CHAVE_SUPERMERCADO = 'carteiraideal.supermercado'
export const VERSAO_SUPERMERCADO = 1

export function listaSalva(bruto: string | null): ListaDeCompras | null {
  if (!bruto) return null
  try {
    const salvo = JSON.parse(bruto) as { versao?: number; lista?: unknown } | null
    return salvo?.versao === VERSAO_SUPERMERCADO ? validarLista(salvo.lista) : null
  } catch {
    return null
  }
}

export interface ResultadoAdicionar {
  adicionados: number
  repetidos: string[]
}

export function useSupermercado() {
  const [lista, setLista] = useState<ListaDeCompras>(LISTA_VAZIA)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    let cancelado = false
    storage.getItem(CHAVE_SUPERMERCADO).then((bruto) => {
      if (cancelado) return
      const valida = listaSalva(bruto)
      if (valida) setLista(valida)
      setHidratado(true)
    })
    return () => {
      cancelado = true
    }
  }, [])

  // Grava só depois de ler: antes disso o estado é o vazio, e gravá-lo apagaria a lista salva.
  useEffect(() => {
    if (!hidratado) return
    storage.setItem(CHAVE_SUPERMERCADO, JSON.stringify({ versao: VERSAO_SUPERMERCADO, lista }))
  }, [hidratado, lista])

  /** Lê o texto, separa em itens e junta à lista. Devolve o que entrou e o que já estava. */
  const adicionarTexto = useCallback(
    (texto: string): ResultadoAdicionar => {
      const novos = interpretarTexto(texto)
      const { lista: nova, adicionados, repetidos } = adicionarItens(lista, novos)
      setLista(nova)
      return { adicionados, repetidos }
    },
    [lista],
  )

  const alternar = useCallback((id: string) => setLista((l) => alternarComprado(l, id)), [])
  const trocarCategoria = useCallback((id: string, categoria: CategoriaId) => setLista((l) => mudarCategoria(l, id, categoria)), [])
  const remover = useCallback((id: string) => setLista((l) => removerItem(l, id)), [])
  const limparJaComprados = useCallback(() => setLista((l) => limparComprados(l)), [])
  const desmarcar = useCallback(() => setLista((l) => desmarcarTodos(l)), [])
  const apagarTudo = useCallback(() => setLista(LISTA_VAZIA), [])

  return { lista, hidratado, adicionarTexto, alternar, trocarCategoria, remover, limparJaComprados, desmarcar, apagarTudo }
}
