import { useEffect, useState } from 'react'

export type EstadoArquivo<T> = { tipo: 'ocioso' } | { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; dados: T }

// Cache da sessão, compartilhado entre as telas: o mesmo arquivo (fundamentos, séries, balanços) é baixado e lido uma vez só,
// mesmo que vários cards o usem. Buscas em andamento também são compartilhadas; falha não fica guardada.
const prontos = new Map<string, unknown>()
const buscando = new Map<string, Promise<unknown>>()

function buscar<T>(caminho: string): Promise<T> {
  const emAndamento = buscando.get(caminho)
  if (emAndamento) return emAndamento as Promise<T>
  const busca = fetch(new URL(caminho, document.baseURI))
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<T>
    })
    .then((dados) => {
      prontos.set(caminho, dados)
      return dados
    })
    .finally(() => buscando.delete(caminho))
  buscando.set(caminho, busca)
  return busca
}

/**
 * Carrega um arquivo JSON publicado junto do app (pasta dados/, gerado pelos jobs diários), só quando `ativo`. Nos testes, o dado
 * vem por `injetado` e nada é baixado. O arquivo fica guardado em memória entre as telas (uma busca e uma leitura por sessão);
 * "tentar de novo" ignora o que estava guardado.
 */
export function useArquivoDados<T>(caminho: string, ativo: boolean, injetado?: T): [EstadoArquivo<T>, () => void] {
  const [estado, setEstado] = useState<EstadoArquivo<T>>(() => {
    if (injetado) return { tipo: 'pronto', dados: injetado }
    return prontos.has(caminho) ? { tipo: 'pronto', dados: prontos.get(caminho) as T } : { tipo: 'ocioso' }
  })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (injetado || !ativo) return
    let vivo = true
    if (prontos.has(caminho)) {
      setEstado({ tipo: 'pronto', dados: prontos.get(caminho) as T })
      return
    }
    setEstado((atual) => (atual.tipo === 'pronto' ? atual : { tipo: 'carregando' }))
    buscar<T>(caminho)
      .then((dados) => vivo && setEstado({ tipo: 'pronto', dados }))
      .catch(() => vivo && setEstado({ tipo: 'erro' }))
    return () => {
      vivo = false
    }
  }, [caminho, ativo, injetado, tentativa])

  return [
    estado,
    () => {
      prontos.delete(caminho)
      setEstado({ tipo: 'carregando' })
      setTentativa((n) => n + 1)
    },
  ]
}
