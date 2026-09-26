import { useCallback, useEffect, useState } from 'react'
import { storage } from '../data/storage'
import { ORCAMENTO_VAZIO, PREFIXO_DIVIDA, acertarPeloTotal, alternarPagamento, recuperacaoDe, validarOrcamento } from '../domain/orcamento'
import type { Compra, Conta, Orcamento } from '../domain/orcamento'
import type { Divida, MetodoQuitacao, Recuperacao } from '../domain/recuperacao'

/**
 * Estado do Meu Mês (D21). Chave própria no aparelho, separada de `carteiraideal.estado`:
 * o orçamento não muda o formato do questionário, ninguém perde respostas salvas, e a versão
 * React Native continua compatível porque tudo passa pela interface `storage`.
 *
 * Nada disto vai para a API: salário e contas ficam só no aparelho da pessoa.
 */
export const CHAVE_ORCAMENTO = 'carteiraideal.orcamento'
export const VERSAO_ORCAMENTO = 1

/**
 * Lê o orçamento gravado no aparelho. Devolve null sem dado, com versão diferente ou com dado
 * corrompido (quem usa começa vazio em vez de travar). Também usado pela ponte com o
 * questionário (useSugestoesMeuMes), para as duas leituras nunca divergirem.
 */
export function orcamentoSalvo(bruto: string | null): Orcamento | null {
  if (!bruto) return null
  try {
    const salvo = JSON.parse(bruto) as { versao?: number; orcamento?: unknown } | null
    return salvo?.versao === VERSAO_ORCAMENTO ? validarOrcamento(salvo.orcamento) : null
  } catch {
    return null
  }
}

function novoId(prefixo: string) {
  return `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function useOrcamento() {
  const [orcamento, setOrcamento] = useState<Orcamento>(ORCAMENTO_VAZIO)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    let cancelado = false
    storage.getItem(CHAVE_ORCAMENTO).then((bruto) => {
      if (cancelado) return
      const valido = orcamentoSalvo(bruto)
      if (valido) setOrcamento(valido)
      setHidratado(true)
    })
    return () => {
      cancelado = true
    }
  }, [])

  // Grava só depois de ler: antes disso o estado é o vazio, e gravá-lo apagaria o que existia.
  useEffect(() => {
    if (!hidratado) return
    storage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: VERSAO_ORCAMENTO, orcamento }))
  }, [hidratado, orcamento])

  const setSalario = useCallback((salario: number) => setOrcamento((o) => ({ ...o, salario })), [])
  const setReserva = useCallback((reserva: number) => setOrcamento((o) => ({ ...o, reserva })), [])
  const setPotes = useCallback(
    (potes: Partial<Orcamento['potes']>) => setOrcamento((o) => ({ ...o, potes: { ...o.potes, ...potes } })),
    [],
  )

  const adicionarConta = useCallback((conta: Omit<Conta, 'id'>) => {
    const id = novoId('c')
    setOrcamento((o) => ({ ...o, contas: [...o.contas, { ...conta, id }] }))
  }, [])

  const editarConta = useCallback((id: string, dados: Omit<Conta, 'id'>) => {
    setOrcamento((o) => ({ ...o, contas: o.contas.map((c) => (c.id === id ? { ...dados, id } : c)) }))
  }, [])

  /** Remove a conta e os tiques dela em todos os meses. */
  const removerConta = useCallback((id: string) => {
    setOrcamento((o) => {
      const pagamentos: Orcamento['pagamentos'] = {}
      for (const [mes, doMes] of Object.entries(o.pagamentos)) {
        const resto = Object.fromEntries(Object.entries(doMes).filter(([k]) => k !== id))
        if (Object.keys(resto).length) pagamentos[mes] = resto
      }
      return { ...o, contas: o.contas.filter((c) => c.id !== id), pagamentos }
    })
  }, [])

  const ticar = useCallback((mes: string, contaId: string, valor: number) => {
    setOrcamento((o) => alternarPagamento(o, mes, contaId, valor))
  }, [])

  const setTeto = useCallback((teto: number) => setOrcamento((o) => ({ ...o, cartao: { ...o.cartao, teto } })), [])

  const adicionarCompra = useCallback((compra: Omit<Compra, 'id'>) => {
    const id = novoId('k')
    setOrcamento((o) => ({ ...o, cartao: { ...o.cartao, compras: [...o.cartao.compras, { ...compra, id }] } }))
  }, [])

  /** Corrige uma compra lançada (ajuste de 26/09/2026: antes só dava para remover). */
  const editarCompra = useCallback((id: string, dados: Omit<Compra, 'id'>) => {
    setOrcamento((o) => ({
      ...o,
      cartao: { ...o.cartao, compras: o.cartao.compras.map((c) => (c.id === id ? { ...dados, id } : c)) },
    }))
  }, [])

  /** Lança as compras à vista do mês de uma vez, pelo total (ajuste de 26/09/2026). */
  const acertarTotal = useCallback((mes: string, total: number) => {
    setOrcamento((o) => acertarPeloTotal(o, mes, total))
  }, [])

  const removerCompra = useCallback((id: string) => {
    setOrcamento((o) => ({ ...o, cartao: { ...o.cartao, compras: o.cartao.compras.filter((c) => c.id !== id) } }))
  }, [])

  // ---------------------------------------------------------------- Modo Recuperação (Etapa 3)

  const mudarRecuperacao = useCallback((f: (r: Recuperacao) => Recuperacao) => {
    setOrcamento((o) => ({ ...o, recuperacao: f(recuperacaoDe(o)) }))
  }, [])

  const adicionarDivida = useCallback(
    (divida: Omit<Divida, 'id' | 'saldoInicial'>) => {
      const id = novoId('d')
      mudarRecuperacao((r) => ({ ...r, dividas: [...r.dividas, { ...divida, id, saldoInicial: divida.saldo }] }))
    },
    [mudarRecuperacao],
  )

  /** Editar também é como a pessoa atualiza o saldo pelo extrato. A régua da barra só cresce. */
  const editarDivida = useCallback(
    (id: string, dados: Omit<Divida, 'id' | 'saldoInicial'>) => {
      mudarRecuperacao((r) => ({
        ...r,
        dividas: r.dividas.map((d) => (d.id === id ? { ...dados, id, saldoInicial: Math.max(d.saldoInicial, dados.saldo) } : d)),
      }))
    },
    [mudarRecuperacao],
  )

  /** Remove a dívida e os pagamentos ticados dela em todos os meses. */
  const removerDivida = useCallback((id: string) => {
    const chave = PREFIXO_DIVIDA + id
    setOrcamento((o) => {
      const pagamentos: Orcamento['pagamentos'] = {}
      for (const [mes, doMes] of Object.entries(o.pagamentos)) {
        const resto = Object.fromEntries(Object.entries(doMes).filter(([k]) => k !== chave))
        if (Object.keys(resto).length) pagamentos[mes] = resto
      }
      const r = recuperacaoDe(o)
      return { ...o, pagamentos, recuperacao: { ...r, dividas: r.dividas.filter((d) => d.id !== id) } }
    })
  }, [])

  const setMetodo = useCallback((metodo: MetodoQuitacao) => mudarRecuperacao((r) => ({ ...r, metodo })), [mudarRecuperacao])
  const setLigadoManual = useCallback(
    (ligadoManual: boolean) => mudarRecuperacao((r) => ({ ...r, ligadoManual })),
    [mudarRecuperacao],
  )
  const setPacto = useCallback(
    (pactoDesde: string | null) => mudarRecuperacao((r) => ({ ...r, pactoDesde })),
    [mudarRecuperacao],
  )

  const substituir = useCallback((novo: Orcamento) => setOrcamento(novo), [])

  const apagarTudo = useCallback(() => setOrcamento(ORCAMENTO_VAZIO), [])

  return {
    orcamento,
    hidratado,
    setSalario,
    setReserva,
    setPotes,
    adicionarConta,
    editarConta,
    removerConta,
    ticar,
    setTeto,
    adicionarCompra,
    editarCompra,
    acertarTotal,
    removerCompra,
    adicionarDivida,
    editarDivida,
    removerDivida,
    setMetodo,
    setLigadoManual,
    setPacto,
    substituir,
    apagarTudo,
  }
}
