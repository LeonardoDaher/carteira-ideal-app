import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from '../data/storage'
import { CHAVE_CARTEIRA, aplicarImportacao, carteiraVazia, lerCarteiraSalva, serializarCarteira } from '../domain/carteiraSalva'
import type { ArquivoImportado, CarteiraSalva, ResumoArquivo } from '../domain/carteiraSalva'
import { adicionarLancamento, corrigirLancamento, excluirLancamento } from '../domain/lancamentos'
import { chaveDoAtivoManual, validarAtivoManual } from '../domain/ativosManuais'
import type { AtivoManual } from '../domain/ativosManuais'
import type { ClasseCarteira } from '../domain/classificadorAtivo'
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
      if (!r.problema) {
        // Lançar uma compra de um ativo antes excluído é a pessoa dizendo que o tem de novo: volta à lista.
        const volta = ref.current.ativosExcluidos.filter((a) => a !== novo.ativo.trim().toUpperCase())
        aplicar({ ...ref.current, ...r.livro, ativosExcluidos: volta })
      }
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

  /** Guarda (ou, com null, apaga) a classe que a pessoa escolheu para um ativo. */
  const definirClasse = useCallback(
    (ativo: string, classe: ClasseCarteira | null) => {
      const classes = { ...ref.current.classes }
      if (classe) classes[ativo] = classe
      else delete classes[ativo]
      aplicar({ ...ref.current, classes })
    },
    [aplicar],
  )

  /** Guarda o preço médio que a pessoa informou para um ativo; com null (ou valor inválido), volta ao calculado. */
  const definirPrecoMedio = useCallback(
    (ativo: string, preco: number | null) => {
      const precosMedios = { ...ref.current.precosMedios }
      if (preco !== null && preco > 0 && Number.isFinite(preco)) precosMedios[ativo] = preco
      else delete precosMedios[ativo]
      aplicar({ ...ref.current, precosMedios })
    },
    [aplicar],
  )

  /**
   * Guarda (ou atualiza) um ativo digitado à mão. Devolve a mensagem do que está errado, ou null se salvou.
   * `ativoAntigo` é a chave de antes, quando a pessoa está editando; um nome que já existe em OUTRO ativo é recusado.
   */
  const salvarAtivoManual = useCallback(
    (dados: Omit<AtivoManual, 'ativo'>, ativoAntigo?: string): string | null => {
      const problema = validarAtivoManual(dados)
      if (problema) return problema
      const ativo = chaveDoAtivoManual(dados.nome)
      const outros = ref.current.ativosManuais.filter((m) => m.ativo !== ativoAntigo)
      if (outros.some((m) => m.ativo === ativo)) return 'Você já tem um ativo com este nome.'
      const novo: AtivoManual = { ativo, ...dados, nome: dados.nome.trim() }
      aplicar({ ...ref.current, ativosManuais: [...outros, novo] })
      return null
    },
    [aplicar],
  )

  const removerAtivoManual = useCallback(
    (ativo: string) => aplicar({ ...ref.current, ativosManuais: ref.current.ativosManuais.filter((m) => m.ativo !== ativo) }),
    [aplicar],
  )

  /** Tira da lista de Posições um ativo da B3. Lançamentos e proventos ficam no histórico. */
  const excluirAtivo = useCallback(
    (ativo: string) => aplicar({ ...ref.current, ativosExcluidos: [...new Set([...ref.current.ativosExcluidos, ativo])] }),
    [aplicar],
  )

  const restaurarAtivo = useCallback(
    (ativo: string) => aplicar({ ...ref.current, ativosExcluidos: ref.current.ativosExcluidos.filter((a) => a !== ativo) }),
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

  return { carteira, hidratado, importarArquivos, adicionar, corrigir, excluir, definirClasse, definirPrecoMedio, salvarAtivoManual, removerAtivoManual, excluirAtivo, restaurarAtivo, definirDataPosicao, limpar, exportarBackup, restaurarBackup }
}

export type CarteiraReal = ReturnType<typeof useCarteiraReal>
