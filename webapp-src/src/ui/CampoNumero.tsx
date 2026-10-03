import { useId, useState } from 'react'

/** Lê "10,5" ou "0,012" (vírgula ou ponto) com até `casas` decimais; sem número, 0. */
function lerNumero(texto: string, casas: number): number {
  const limpo = texto.replace(/[^\d.,]/g, '')
  if (!/\d/.test(limpo)) return 0
  const m = casas > 0 ? new RegExp(`^(.*)[.,](\\d{1,${casas}})$`).exec(limpo) : null
  const inteiro = (m ? m[1] : limpo).replace(/[.,]/g, '')
  const valor = Number(`${inteiro || '0'}.${m ? m[2] : '0'}`)
  return Number.isFinite(valor) ? Math.min(valor, 99_999_999) : 0
}

function formatar(valor: number, casas: number) {
  return valor ? valor.toLocaleString('pt-BR', { maximumFractionDigits: casas }) : ''
}

/**
 * Campo numérico com sufixo (%, anos, meses), no molde do CampoReais: aceita "10,5", formata ao sair do
 * campo e usa fonte de 16 px (classe .mm-campo) para o iPhone não dar zoom ao tocar.
 */
export function CampoNumero({
  rotulo,
  valor,
  onMudar,
  sufixo,
  dica,
  casas = 2,
}: {
  rotulo: string
  valor: number
  onMudar: (v: number) => void
  sufixo?: string
  dica?: string
  /** Casas decimais aceitas (0 = só número inteiro). */
  casas?: number
}) {
  const id = useId()
  const idDica = useId()
  const [texto, setTexto] = useState(formatar(valor, casas))
  const [editando, setEditando] = useState(false)
  const exibido = editando ? texto : formatar(valor, casas)
  return (
    <div className="col" style={{ gap: 4 }}>
      <label htmlFor={id} className="small" style={{ fontWeight: 600 }}>
        {rotulo}
      </label>
      <span className="mm-campo">
        <input
          id={id}
          inputMode={casas === 0 ? 'numeric' : 'decimal'}
          autoComplete="off"
          className="input-cotas"
          value={exibido}
          placeholder="0"
          aria-describedby={dica ? idDica : undefined}
          onFocus={() => {
            setTexto(formatar(valor, casas))
            setEditando(true)
          }}
          onBlur={() => setEditando(false)}
          onChange={(e) => {
            setTexto(e.target.value)
            onMudar(lerNumero(e.target.value, casas))
          }}
        />
        {sufixo && (
          <span className="muted small" style={{ whiteSpace: 'nowrap' }} aria-hidden="true">
            {sufixo}
          </span>
        )}
      </span>
      {dica && (
        <span id={idDica} className="tiny muted">
          {dica}
        </span>
      )}
    </div>
  )
}
