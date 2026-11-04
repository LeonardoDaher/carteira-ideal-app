import type { ReactNode } from 'react'
import { rolarParaPainel } from './rolarParaResultado'

export interface AbaDaTela<T extends string> {
  id: T
  emoji: string
  titulo: string
  descricao: string
}

/**
 * Duas caixinhas no topo de uma tela de simulação (mesmo desenho do Simule FII, D65): o simulador de sempre e o
 * ranking Top 15 daquela classe (D70). `prefixo` torna os ids únicos por tela.
 */
export function AbasDaTela<T extends string>({
  prefixo, rotulo, abas, ativa, aoMudar, rolarAoTrocar = false, children,
}: {
  prefixo: string
  rotulo: string
  abas: readonly AbaDaTela<T>[]
  ativa: T
  aoMudar: (id: T) => void
  /** Depois do clique, rola até o conteúdo da aba (telas Simule, com muitas caixinhas antes do conteúdo). */
  rolarAoTrocar?: boolean
  children: ReactNode
}) {
  return (
    <>
      <div role="tablist" aria-label={rotulo} style={{ display: 'grid', gridTemplateColumns: abas.length > 4 ? 'repeat(auto-fit, minmax(104px, 1fr))' : `repeat(${abas.length}, 1fr)`, gap: 10 }}>
        {abas.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`aba-${prefixo}-${c.id}`}
            aria-selected={ativa === c.id}
            aria-controls={`painel-${prefixo}-aba`}
            className={`vehicle-card ${ativa === c.id ? 'selected' : ''}`}
            onClick={() => {
              aoMudar(c.id)
              if (rolarAoTrocar) rolarParaPainel(`painel-${prefixo}-aba`)
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>{c.emoji}</span>
            <span style={{ fontSize: 14 }}>{c.titulo}</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{c.descricao}</span>
          </button>
        ))}
      </div>
      <div id={`painel-${prefixo}-aba`} role="tabpanel" aria-labelledby={`aba-${prefixo}-${ativa}`} className="col" style={{ gap: 'inherit' }}>
        {children}
      </div>
    </>
  )
}
