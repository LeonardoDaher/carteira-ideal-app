import { useEffect, useState } from 'react'
import { storage } from '../data/storage'
import { sugestoesDoMeuMes } from '../domain/ponteQuestionario'
import type { SugestoesDoMeuMes } from '../domain/ponteQuestionario'
import { CHAVE_ORCAMENTO, orcamentoSalvo } from './useOrcamento'

/**
 * Ponte com o questionário (D21, Etapa 4): lê uma vez o Meu Mês gravado neste aparelho e
 * devolve as sugestões dos Pilares 1 e 2. Só leitura: não grava nada e não envia o orçamento
 * para lugar nenhum. Sem Meu Mês (ou enquanto lê), devolve {} e o questionário fica como sempre.
 */
export function useSugestoesMeuMes(): SugestoesDoMeuMes {
  const [sugestoes, setSugestoes] = useState<SugestoesDoMeuMes>({})

  useEffect(() => {
    let cancelado = false
    storage.getItem(CHAVE_ORCAMENTO).then((bruto) => {
      if (cancelado) return
      const orcamento = orcamentoSalvo(bruto)
      if (orcamento) setSugestoes(sugestoesDoMeuMes(orcamento))
    })
    return () => {
      cancelado = true
    }
  }, [])

  return sugestoes
}
