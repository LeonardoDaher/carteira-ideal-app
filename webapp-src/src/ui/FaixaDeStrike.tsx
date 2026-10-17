import { posicoesDaFaixa, strikeDaPosicao } from '../domain/opcoes'

const formatar = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Controle deslizante de duas alças para a faixa de strike. As posições são os strikes que existem para o ativo (cada
 * passo anda de um strike para o próximo), e nas pontas o filtro fica sem limite. Os campos de digitar continuam ao
 * lado e acompanham o controle.
 */
export function FaixaDeStrike({
  strikes, min, max, onMudar,
}: {
  /** Strikes distintos do ativo, em ordem crescente. */
  strikes: number[]
  min: number | null
  max: number | null
  onMudar: (faixa: { strikeMin: number | null; strikeMax: number | null }) => void
}) {
  if (strikes.length < 2) return null
  const ultimo = strikes.length - 1
  const { menor, maior } = posicoesDaFaixa(strikes, min, max)
  const pct = (i: number) => (i / ultimo) * 100

  const moverMenor = (valor: number) => {
    const i = Math.min(valor, maior)
    onMudar({ strikeMin: strikeDaPosicao(strikes, i, 'menor'), strikeMax: max })
  }
  const moverMaior = (valor: number) => {
    const i = Math.max(valor, menor)
    onMudar({ strikeMin: min, strikeMax: strikeDaPosicao(strikes, i, 'maior') })
  }

  return (
    <div className="faixa-strike" role="group" aria-label="Faixa de strike (controle deslizante)">
      <div className="faixa-strike-balao tiny" style={{ left: `${pct(menor)}%` }} aria-hidden="true">{formatar(strikes[menor])}</div>
      <div className="faixa-strike-balao tiny" style={{ left: `${pct(maior)}%` }} aria-hidden="true">{formatar(strikes[maior])}</div>
      <div className="faixa-strike-trilho" aria-hidden="true" />
      <div className="faixa-strike-selecao" style={{ left: `${pct(menor)}%`, width: `${pct(maior) - pct(menor)}%` }} aria-hidden="true" />
      <input
        type="range"
        min={0}
        max={ultimo}
        step={1}
        value={menor}
        aria-label="Strike mínimo (controle deslizante)"
        aria-valuetext={`R$ ${formatar(strikes[menor])}`}
        // Com as alças juntas na ponta direita, a de baixo precisa ficar por cima para poder voltar.
        style={{ zIndex: menor > ultimo / 2 ? 3 : 2 }}
        onChange={(ev) => moverMenor(Number(ev.target.value))}
      />
      <input
        type="range"
        min={0}
        max={ultimo}
        step={1}
        value={maior}
        aria-label="Strike máximo (controle deslizante)"
        aria-valuetext={`R$ ${formatar(strikes[maior])}`}
        style={{ zIndex: menor > ultimo / 2 ? 2 : 3 }}
        onChange={(ev) => moverMaior(Number(ev.target.value))}
      />
    </div>
  )
}
