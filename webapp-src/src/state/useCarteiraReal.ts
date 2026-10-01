import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from '../data/storage'
import { CHAVE_CARTEIRA, aplicarImportacao, carteiraVazia, lerCarteiraSalva, serializarCarteira } from '../domain/carteiraSalva'
import type { ArquivoImportado, CarteiraSalva, ResumoArquivo } from '../domain/carteiraSalva'
import { adicionarLancamento, corrigirLancamento, excluirLancamento } from '../domain/lancamentos'
import type { LancamentoNovo, ProblemaLancamento } from '../domain/lancamentos'

/**
 * Estado da Minha Carteira (D36). Chave própria no aparelho (`carteiraideal.carteira`), separada do
 * questionário e do Meu Mês, no mesmo padrão deles: lê antes de gravar e nunca grava o estado vazio
 * por cima do que existia. Nada disto vai para a API: lançamentos e posições ficam só no aparelho.
 */
export function useCarteiraReal(hoje: string) {
  const [carteira, setCarteira] = useState<CarteiraSalva>(carteiraVazia)
  const [hidratado, setHidratado] = useState(false)
  // Espelho síncrono: duas ações seguidas (ex.: vários arquivos) partem sempre do estado mais novo.
  const ref = useRef<CarteiraSalva>(carteira)

  const aplicar = useCallback((novo: CarteiraSalva) => {
    ref.current = novo
    setCarteira(novo)
  }, [])

  useEffect(() => {
    let cancelado = false
    storage.getItem(CHAVE_CARTEIRA).then((bruto) => {
      if (cancelado) return
      const salva = lerCarteiraSalva(bruto)
      if (salva) aplicar(salva)
      setHidratado(true)
    })
    return () => {
      cancelado = true
    }
  }, [aplicar])

  useEffect(() => {
    if (!hidratado) return
    storage.setItem(CHAVE_CARTEIRA, serializarCarteira(carteira))
  }, [hidratado, carteira])

  const importarArquivos = useCallback(
    (arquivos: ArquivoImportado[]): ResumoArquivo[] => {
      const r = aplicarImportacao(ref.current, arquivos, hoje)
      aplicar(r.carteira)
      return r.resumos
    },
    [aplicar, hoje],
  )

  const adicionar = useCallback(
    (novo: Omit<LancamentoNovo, 'origem'>): ProblemaLancamento | null => {
      const r = adicionarLancamento({ lancamentos: ref.current.lancamentos, excluidas: ref.current.excluidas }, novo)
      if (!r.problema) aplicar({ ...ref.current, ...r.livro })
      return r.problema
    },
    [aplicar],
  )

  const corrigir = useCallback(
    (id: string, correcao: Partial<Omit<LancamentoNovo, 'origem'>>): ProblemaLancamento | null => {
      const r = corrigirLancamento({ lancamentos: ref.current.lancamentos, excluidas: ref.current.excluidas }, id, correcao)
      if (!r.problema) aplicar({ ...ref.current, ...r.livro })
      return r.problema
    },
    [aplicar],
  )

  const excluir = useCallback(
    (id: string) => {
      const livro = excluirLancamento({ lancamentos: ref.current.lancamentos, excluidas: ref.current.excluidas }, id)
      aplicar({ ...ref.current, ...livro })
    },
    [aplicar],
  )

  const definirDataPosicao = useCallback((dataPosicao: string) => aplicar({ ...ref.current, dataPosicao }), [aplicar])
  const limpar = useCallback(() => aplicar(carteiraVazia()), [aplicar])
  const exportarBackup = useCallback(() => serializarCarteira(ref.current), [])

  /** Restaura um backup gravado por `exportarBackup`. Backup inválido não altera nada. */
  const restaurarBackup = useCallback(
    (texto: string): { ok: boolean; erro?: string } => {
      const lida = lerCarteiraSalva(texto)
      if (!lida) return { ok: false, erro: 'Este arquivo não é um backup válido da Minha Carteira.' }
      aplicar(lida)
      return { ok: true }
    },
    [aplicar],
  )

  return { carteira, hidratado, importarArquivos, adicionar, corrigir, excluir, definirDataPosicao, limpar, exportarBackup, restaurarBackup }
}

export type CarteiraReal = ReturnType<typeof useCarteiraReal>
