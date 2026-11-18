import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { mensagemDaFalha } from '../domain/acessoTop15'
import type { RespostaLista } from '../domain/acessoTop15'

/**
 * Antes pedia o código do mês (D50). As listas Top 15 agora são abertas: o componente só busca a lista e a desenha,
 * sem pedir código. Mantém o nome e as props de antes para não mexer nas telas.
 */
export function PortaoPorCodigo<T>({
  carregar, idDeTeste, renderizar,
}: {
  carregar: (codigo: string) => Promise<RespostaLista<T>>
  idDeTeste: string
  renderizar: (dados: T) => ReactNode
  // Props antigas, ignoradas (lista aberta).
  titulo?: string
  oQueLibera?: string
  instagram?: string | null
  armazenamento?: unknown
  chaveArmazenamento?: string
}) {
  const [completo, setCompleto] = useState<T | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const r = await carregar('')
      if (cancelado) return
      if (r.ok) setCompleto(r.snapshot)
      else setAviso(mensagemDaFalha(r))
    })()
    return () => {
      cancelado = true
    }
  }, [carregar])

  if (completo) return <>{renderizar(completo)}</>
  if (aviso) return <div className="card-outline small justify" role="alert" data-testid={idDeTeste}>{aviso}</div>
  return <div className="card small muted" role="status">Carregando a lista…</div>
}
