import { forwardRef, useId, useMemo, useState } from 'react'
import { GLOSSARIO, buscarNoGlossario } from '../domain/glossarioOpcoes'

/**
 * Glossário do Simule Opções: termos em linguagem simples, com busca e exemplos numéricos. Fica recolhido no fim da tela e se
 * abre pelo botão "Primeira vez com opções?" do topo. O estado de aberto vem de fora para o botão poder abri-lo.
 */
export const GlossarioOpcoes = forwardRef<HTMLDetailsElement, { aberto: boolean; aoMudar: (aberto: boolean) => void }>(function GlossarioOpcoes({ aberto, aoMudar }, ref) {
  const [busca, setBusca] = useState('')
  const idLista = useId()
  const termos = useMemo(() => buscarNoGlossario(busca), [busca])

  return (
    <details
      ref={ref}
      className="card col"
      style={{ gap: 10 }}
      open={aberto}
      onToggle={(ev) => aoMudar((ev.currentTarget as HTMLDetailsElement).open)}
      data-testid="glossario"
    >
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Glossário: o que cada palavra quer dizer</summary>
      <div className="col" style={{ gap: 10, marginTop: 10 }}>
        <span className="small muted justify">
          Termos de opções em linguagem simples. Os exemplos usam números inventados, só para mostrar a conta.
        </span>
        <input
          type="search"
          className="busca-fii"
          placeholder={`Buscar entre ${GLOSSARIO.length} termos, ex.: strike`}
          aria-label="Buscar no glossário"
          aria-controls={idLista}
          autoCorrect="off"
          spellCheck={false}
          value={busca}
          onChange={(ev) => setBusca(ev.target.value.slice(0, 40))}
        />
        <div id={idLista} className="col" style={{ gap: 8 }} aria-live="polite">
          {termos.length === 0 ? (
            <div className="card-outline small justify" role="status">
              <strong>Nenhum termo encontrado para “{busca.trim()}”.</strong>{' '}
              <span className="muted">Tente outra palavra (por exemplo, strike, prêmio ou delta).</span>
            </div>
          ) : (
            termos.map((t) => (
              <div key={t.termo} className="card-outline col" style={{ gap: 4 }} data-testid="termo-do-glossario">
                <span style={{ fontWeight: 700 }}>{t.termo}</span>
                <span className="small muted justify" style={{ lineHeight: 1.5 }}>{t.explicacao}</span>
                {t.exemplo && <span className="small justify" style={{ lineHeight: 1.5 }}><strong>Exemplo:</strong> {t.exemplo}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  )
})
