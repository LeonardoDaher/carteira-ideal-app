import { useEffect, useState } from 'react'

export type EstadoArquivo<T> = { tipo: 'ocioso' } | { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; dados: T }

/**
 * Carrega um arquivo JSON publicado junto do app (pasta dados/, gerado pelos jobs diários), só quando `ativo`. Nos testes, o dado
 * vem por `injetado` e nada é baixado. O arquivo fica no cache do navegador entre as telas (uma busca por sessão).
 */
export function useArquivoDados<T>(caminho: string, ativo: boolean, injetado?: T): [EstadoArquivo<T>, () => void] {
  const [estado, setEstado] = useState<EstadoArquivo<T>>(injetado ? { tipo: 'pronto', dados: injetado } : { tipo: 'ocioso' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (injetado || !ativo) return
    let vivo = true
    setEstado((atual) => (atual.tipo === 'pronto' ? atual : { tipo: 'carregando' }))
    fetch(new URL(caminho, document.baseURI))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<T>
      })
      .then((dados) => vivo && setEstado({ tipo: 'pronto', dados }))
      .catch(() => vivo && setEstado({ tipo: 'erro' }))
    return () => {
      vivo = false
    }
  }, [caminho, ativo, injetado, tentativa])

  return [
    estado,
    () => {
      setEstado({ tipo: 'carregando' })
      setTentativa((n) => n + 1)
    },
  ]
}
