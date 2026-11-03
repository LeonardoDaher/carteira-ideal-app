import type { ReactNode } from 'react'
import { useDadosDeMercado } from '../data/arquivosMercado'
import type { ChaveDeDados } from '../data/arquivosMercado'

/**
 * Segura a tela até os arquivos de mercado que ela precisa terem chegado (D137). Se já estão em memória, não mostra nada
 * no meio do caminho: renderiza a tela na mesma hora. Se a rede falhar, oferece "Tentar de novo".
 */
export function ComDados({ chaves, children }: { chaves: readonly ChaveDeDados[]; children: ReactNode }) {
  const [estado, tentarDeNovo] = useDadosDeMercado(chaves)
  if (estado === 'pronto') return <>{children}</>
  if (estado === 'erro') {
    return (
      <div className="card" role="alert" style={{ margin: '24px 0', textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Não consegui carregar os dados desta tela.</p>
        <p className="tiny muted">Confira a conexão e tente de novo. O que você já preencheu no app continua salvo.</p>
        <button type="button" className="btn btn-secondary" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
      </div>
    )
  }
  return (
    <p className="tiny muted" role="status" style={{ margin: '32px 0', textAlign: 'center' }}>
      Carregando os dados de mercado…
    </p>
  )
}
