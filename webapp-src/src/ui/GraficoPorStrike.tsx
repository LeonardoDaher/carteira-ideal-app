import { useId, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

export interface LinhaVisual {
  id: string
  rotulo: string
  cor: string
  tracejada?: boolean
  /** Um valor por strike de `strikes`: o que o gráfico desenha. */
  valores: number[]
  /** Valores reais para a leitura, quando o gráfico desenha outra escala (por exemplo, % do pico). */
  leitura?: number[]
}

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const W = 360
const H = 240
const L = 46
const R = 12
const T = 14
const B = 30

/** Teto "redondo" para o eixo (1, 1,2, 1,5, 2, 2,5, 3, 4, 5, 6, 8 ou 10 vezes uma potência de 10), sem sobrar muito espaço. */
export function tetoDoEixo(maximo: number): number {
  if (!(maximo > 0)) return 1
  const potencia = 10 ** Math.floor(Math.log10(maximo))
  const fator = maximo / potencia
  const degrau = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((d) => fator <= d + 1e-9) ?? 10
  return degrau * potencia
}

const strikeTexto = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Gráfico de linhas com o strike no eixo horizontal (em escala de preço, e não de posição) e o valor no vertical. A linha
 * vertical tracejada é o preço do ativo no dia, e fica sempre no centro do eixo. Passar o mouse, tocar ou usar as setas (esquerda e direita, início e fim) sobre o
 * gráfico mostra os valores de cada linha no strike mais próximo.
 */
export function GraficoPorStrike({
  strikes, linhas, precoAtivo, formatarValor, formatarLeitura, descricao,
}: {
  strikes: number[]
  linhas: LinhaVisual[]
  precoAtivo: number
  formatarValor: (valor: number) => string
  /** Formato dos valores da leitura (quando há `leitura` nas linhas); sem isso, o mesmo do eixo. */
  formatarLeitura?: (valor: number) => string
  descricao: string
}) {
  const [indice, setIndice] = useState<number | null>(null)
  const idRecorte = useId().replace(/:/g, '')
  if (strikes.length === 0 || linhas.length === 0) return null

  // O preço do ativo no dia fica no CENTRO do eixo: o eixo é simétrico em torno dele e vai até o strike mais distante (o teto de
  // 95% do preço evita um eixo negativo quando há strikes muito acima do preço; o que passa disso é recortado).
  const meia = Math.min(Math.max(precoAtivo - strikes[0], strikes[strikes.length - 1] - precoAtivo, precoAtivo * 0.01), precoAtivo * 0.95)
  const xMin = precoAtivo - meia
  const xMax = precoAtivo + meia
  const yMax = tetoDoEixo(Math.max(0, ...linhas.flatMap((l) => l.valores)))
  const x = (strike: number) => L + ((strike - xMin) / (xMax - xMin)) * (W - L - R)
  const y = (valor: number) => T + (1 - valor / yMax) * (H - T - B)
  const caminho = (valores: number[]) => valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(strikes[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const pontos = strikes.length <= 40

  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + (xMax - xMin) * f)
  const ticksY = [0, yMax / 2, yMax]
  const indiceMaisPerto = (strike: number) => strikes.reduce((melhor, k, i) => (Math.abs(k - strike) < Math.abs(strikes[melhor] - strike) ? i : melhor), 0)

  const aoMover = (ev: PointerEvent<SVGSVGElement>) => {
    const caixa = ev.currentTarget.getBoundingClientRect()
    if (caixa.width === 0) return
    const xDoDesenho = ((ev.clientX - caixa.left) / caixa.width) * W
    const strike = xMin + ((xDoDesenho - L) / (W - L - R)) * (xMax - xMin)
    setIndice(indiceMaisPerto(strike))
  }
  const aoTeclar = (ev: KeyboardEvent<SVGSVGElement>) => {
    const ultimo = strikes.length - 1
    const atual = indice ?? indiceMaisPerto(precoAtivo)
    const novo = ev.key === 'ArrowLeft' ? atual - 1 : ev.key === 'ArrowRight' ? atual + 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? ultimo : null
    if (novo === null) return
    ev.preventDefault()
    setIndice(Math.max(0, Math.min(ultimo, novo)))
  }

  const distancia = indice === null ? null : (strikes[indice] / precoAtivo - 1) * 100
  return (
    <div className="col" style={{ gap: 6 }}>
      <div aria-live="polite" className="small" style={{ minHeight: 40 }} data-testid="leitura-grafico">
        {indice === null ? (
          <span className="muted">Passe o mouse, toque ou use as setas sobre o gráfico para ler os valores de cada strike.</span>
        ) : (
          <>
            <strong>Strike R$ {strikeTexto(strikes[indice])}</strong>
            <span className="muted"> ({distancia! > 0 ? '+' : ''}{distancia!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do preço)</span>
            {': '}
            {linhas.map((l, i) => (
              <span key={l.id}>
                {i > 0 ? ' · ' : ''}
                <span style={{ color: l.cor, fontWeight: 700 }}>{l.rotulo}</span> {(formatarLeitura ?? formatarValor)((l.leitura ?? l.valores)[indice])}
              </span>
            ))}
          </>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={descricao}
        tabIndex={0}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
        onPointerMove={aoMover}
        onPointerDown={aoMover}
        onPointerLeave={() => setIndice(null)}
        onKeyDown={aoTeclar}
        onBlur={() => setIndice(null)}
      >
        {ticksY.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1.2 : 0.6} />
            <text x={L - 5} y={y(v) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-muted)">{formatarValor(v)}</text>
          </g>
        ))}
        {ticksX.map((k) => (
          <text key={`x${k}`} x={x(k)} y={H - 10} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)">
            {k.toLocaleString('pt-BR', { maximumFractionDigits: k >= 100 ? 0 : 2 })}
          </text>
        ))}

        {(
          <g>
            <line x1={x(precoAtivo)} x2={x(precoAtivo)} y1={T} y2={H - B} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x(precoAtivo)} y={T - 3} textAnchor="middle" fontSize="9" fill="var(--text-muted)">preço</text>
          </g>
        )}

        <defs>
          <clipPath id={idRecorte}><rect x={L} y={T - 2} width={W - L - R} height={H - T - B + 4} /></clipPath>
        </defs>
        {linhas.map((l) => (
          <g key={l.id} data-testid={`linha-${l.id}`} clipPath={`url(#${idRecorte})`}>
            <path d={caminho(l.valores)} fill="none" stroke={l.cor} strokeWidth="2" strokeLinejoin="round" strokeDasharray={l.tracejada ? '5 3' : undefined} />
            {pontos && l.valores.map((v, i) => <circle key={strikes[i]} cx={x(strikes[i])} cy={y(v)} r="2" fill={l.cor} />)}
          </g>
        ))}

        {indice !== null && (
          <g>
            <line x1={x(strikes[indice])} x2={x(strikes[indice])} y1={T} y2={H - B} stroke="var(--text)" strokeWidth="1" />
            {linhas.map((l) => <circle key={l.id} cx={x(strikes[indice])} cy={y(l.valores[indice])} r="4" fill={l.cor} stroke="var(--bg)" strokeWidth="1.5" />)}
          </g>
        )}
      </svg>
    </div>
  )
}
