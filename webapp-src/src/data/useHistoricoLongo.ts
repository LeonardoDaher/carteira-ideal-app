import { useEffect, useState } from 'react'
import type { HistoricoLongo } from '../domain/analiseTecnica'

export type EstadoHistoricoLongo = { tipo: 'ocioso' | 'carregando' | 'ausente' | 'erro' } | { tipo: 'pronto'; dados: HistoricoLongo }

const cache = new Map<string, HistoricoLongo>()

/**
 * Carrega o histórico longo (COTAHIST, até 5 anos) de UMA ação, sob demanda: um arquivo pequeno por ticker em
 * dados/acoes-historico/. Os índices (IBOV, IFIX) usam o mesmo formato na pasta dados/indices-historico/, que o job semanal das
 * ações não apaga. Ação sem arquivo (fora do cadastro ou com histórico curto) é "ausente", não erro: o gráfico segue com a
 * série de 12 meses. Nos testes, o dado vem por `injetado` e nada é baixado.
 */
export function useHistoricoLongo(ticker: string | null, ativo: boolean, injetado?: Record<string, HistoricoLongo>, pasta = 'acoes-historico'): EstadoHistoricoLongo {
  const [estado, setEstado] = useState<{ ticker: string; resultado: EstadoHistoricoLongo } | null>(null)

  useEffect(() => {
    if (injetado || !ativo || !ticker) return
    const chave = `${pasta}/${ticker}`
    const guardado = cache.get(chave)
    if (guardado) {
      setEstado({ ticker, resultado: { tipo: 'pronto', dados: guardado } })
      return
    }
    let vivo = true
    setEstado({ ticker, resultado: { tipo: 'carregando' } })
    fetch(new URL(`dados/${pasta}/${encodeURIComponent(ticker)}.json`, document.baseURI))
      .then((r) => {
        if (r.status === 404) return null
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<HistoricoLongo>
      })
      .then((dados) => {
        if (!vivo) return
        if (dados) cache.set(chave, dados)
        setEstado({ ticker, resultado: dados ? { tipo: 'pronto', dados } : { tipo: 'ausente' } })
      })
      .catch(() => vivo && setEstado({ ticker, resultado: { tipo: 'erro' } }))
    return () => {
      vivo = false
    }
  }, [ticker, ativo, injetado, pasta])

  if (!ticker || !ativo) return { tipo: 'ocioso' }
  if (injetado) return injetado[ticker] ? { tipo: 'pronto', dados: injetado[ticker] } : { tipo: 'ausente' }
  return estado && estado.ticker === ticker ? estado.resultado : { tipo: 'carregando' }
}
