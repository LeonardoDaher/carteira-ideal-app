import { useId } from 'react'
import type { PontoCurva } from '../domain/simulaOpcoes'

export interface CurvaPayoff {
  rotulo: string
  pontos: PontoCurva[]
  /** Curva principal (no vencimento) é preenchida; as demais são só linha tracejada. */
  principal?: boolean
}

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const W = 340
const H = 210
const L = 46
const R = 10
const T = 12
const B = 26

const compacto = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 10_000) return `${Math.round(v / 1000).toLocaleString('pt-BR')} mil`
  return Math.round(v).toLocaleString('pt-BR')
}

/**
 * Gráfico de lucro e prejuízo: preço do ativo no eixo horizontal, resultado em reais no vertical. A curva principal
 * (no vencimento) pinta de verde o que é lucro e de vermelho o que é prejuízo; as outras mostram a posição antes do
 * vencimento. A linha vertical é o preço do ativo hoje, e os pontos na linha do zero são os equilíbrios.
 */
export function GraficoPayoff({
  curvas, precoAtivo, equilibrios, descricao,
}: {
  curvas: CurvaPayoff[]
  precoAtivo: number
  equilibrios: number[]
  descricao: string
}) {
  const id = useId().replace(/:/g, '')
  const todos = curvas.flatMap((c) => c.pontos)
  if (todos.length === 0) return null
  const xMin = Math.min(...todos.map((p) => p.s))
  const xMax = Math.max(...todos.map((p) => p.s))
  const yMinBruto = Math.min(0, ...todos.map((p) => p.v))
  const yMaxBruto = Math.max(0, ...todos.map((p) => p.v))
  const folga = (yMaxBruto - yMinBruto || 1) * 0.08
  const yMin = yMinBruto - folga
  const yMax = yMaxBruto + folga
  const x = (s: number) => L + ((s - xMin) / (xMax - xMin || 1)) * (W - L - R)
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin || 1)) * (H - T - B)
  const zero = y(0)
  const caminho = (pts: PontoCurva[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.s).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')

  const principal = curvas.find((c) => c.principal) ?? curvas[0]
  const area = `${caminho(principal.pontos)} L${x(principal.pontos[principal.pontos.length - 1].s).toFixed(1)},${zero.toFixed(1)} L${x(principal.pontos[0].s).toFixed(1)},${zero.toFixed(1)} Z`

  const ticksX = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + (xMax - xMin) * f)
  const ticksY = [yMinBruto, 0, yMaxBruto].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <clipPath id={`${id}-acima`}><rect x={L} y={0} width={W - L - R} height={zero} /></clipPath>
        <clipPath id={`${id}-abaixo`}><rect x={L} y={zero} width={W - L - R} height={H - zero} /></clipPath>
      </defs>

      {ticksY.map((v) => (
        <g key={`y${v}`}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grafico-juros-grade" strokeWidth={v === 0 ? 1.6 : 1} />
          <text x={L - 5} y={y(v) + 3} textAnchor="end" className="grafico-juros-eixo">{compacto(v)}</text>
        </g>
      ))}
      {ticksX.map((s) => (
        <text key={`x${s}`} x={x(s)} y={H - 8} textAnchor="middle" className="grafico-juros-eixo">
          {s.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
        </text>
      ))}

      <path d={area} fill="var(--grafico-con)" opacity="0.22" clipPath={`url(#${id}-acima)`} />
      <path d={area} fill="var(--danger)" opacity="0.22" clipPath={`url(#${id}-abaixo)`} />

      <line x1={x(precoAtivo)} x2={x(precoAtivo)} y1={T} y2={H - B} className="grafico-juros-guia" />
      <text x={x(precoAtivo)} y={T - 2} textAnchor="middle" className="grafico-juros-eixo">hoje</text>

      {curvas.filter((c) => c !== principal).map((c) => (
        <path key={c.rotulo} d={caminho(c.pontos)} className="grafico-juros-linha" stroke="var(--grafico-ipca)" strokeWidth="2" strokeDasharray="7 3.5" />
      ))}
      <path d={caminho(principal.pontos)} className="grafico-juros-linha" stroke="var(--grafico-selic)" strokeWidth="2.4" />

      {equilibrios.filter((s) => s >= xMin && s <= xMax).map((s) => (
        <circle key={`e${s}`} cx={x(s)} cy={zero} r="3.6" className="grafico-juros-ponto" fill="var(--grafico-selic)" />
      ))}
    </svg>
  )
}
