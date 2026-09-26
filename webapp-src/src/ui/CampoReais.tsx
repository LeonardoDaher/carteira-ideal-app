import { useId, useState } from 'react'
import { lerReais } from '../domain/orcamento'

function formatarCampo(valor: number) {
  return valor ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
}

/**
 * Campo de valor em reais do Meu Mês (D21): aceita "1.234,56" e formata ao sair do campo.
 * Fonte de 16 px (classe .mm-campo) para o iPhone não dar zoom ao tocar.
 */
export function CampoReais({
  rotulo,
  valor,
  onMudar,
  dica,
}: {
  rotulo: string
  valor: number
  onMudar: (v: number) => void
  dica?: string
}) {
  const id = useId()
  const idDica = useId()
  const [texto, setTexto] = useState(formatarCampo(valor))
  const [editando, setEditando] = useState(false)
  const exibido = editando ? texto : formatarCampo(valor)
  return (
    <div className="col" style={{ gap: 4 }}>
      <label htmlFor={id} className="small" style={{ fontWeight: 600 }}>
        {rotulo}
      </label>
      <span className="mm-campo">
        <span className="muted" aria-hidden="true">R$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="input-cotas"
          value={exibido}
          placeholder="0,00"
          aria-describedby={dica ? idDica : undefined}
          onFocus={() => {
            setTexto(formatarCampo(valor))
            setEditando(true)
          }}
          onBlur={() => setEditando(false)}
          onChange={(e) => {
            setTexto(e.target.value)
            onMudar(lerReais(e.target.value))
          }}
        />
      </span>
      {dica && (
        <span id={idDica} className="tiny muted">
          {dica}
        </span>
      )}
    </div>
  )
}

