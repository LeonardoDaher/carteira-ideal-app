import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { DIAS_UTEIS_ANO, rotuloVencimento } from '../domain/futuros'
import type { PontoCurvaDI } from '../domain/futuros'

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const W = 340
const H = 200
const L = 38
const R = 10
const T = 10
const B = 24

const COR_CURVA = 'var(--accent)'
const COR_TERMO = 'oklch(72% 0.13 235)'

function passoRedondo(amplitude: number, linhas = 4) {
  const bruto = amplitude / linhas || 1
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

const pct = (v: number, casas = 2) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

/**
 * Curva de juros do DI1: taxa ao ano de cada vencimento (linha cheia) e taxa a termo entre vértices vizinhos (pontos azuis,
 * tracejado). O eixo horizontal é o prazo em anos (dias úteis ÷ 252). Toque, arraste ou use as setas para ver cada vencimento.
 */
export function GraficoCurvaDI({ curva }: { curva: PontoCurvaDI[] }) {
  const [indice, setIndice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idLeitura = useId()
  const ultimo = curva.length - 1

  const dados = useMemo(() => {
    const anos = curva.map((p) => p.diasUteis / DIAS_UTEIS_ANO)
    const xMax = Math.max(...anos, 1)
    const taxas = curva.flatMap((p) => (p.taxaATermo === null ? [p.taxa] : [p.taxa, p.taxaATermo]))
    const minimo = Math.min(...taxas)
    const maximo = Math.max(...taxas)
    const passo = passoRedondo(maximo - minimo || 1)
    const yMin = Math.floor(minimo / passo) * passo
    const yMax = Math.ceil(maximo / passo) * passo
    const x = (a: number) => L + (a / xMax) * (W - L - R)
    const y = (v: number) => T + ((yMax - v) / (yMax - yMin || 1)) * (H - T - B)
    const caminho = curva.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(anos[k]).toFixed(1)} ${y(p.taxa).toFixed(1)}`).join('')
    const termo = curva.map((p, k) => (p.taxaATermo === null ? '' : `${k === 0 || curva[k - 1].taxaATermo === null ? 'M' : 'L'}${x(anos[k]).toFixed(1)} ${y(p.taxaATermo).toFixed(1)}`)).join('')
    const grade: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) grade.push(v)
    const passoAnos = xMax <= 6 ? 1 : xMax <= 12 ? 2 : 5
    const marcas: number[] = []
    for (let a = 0; a <= xMax; a += passoAnos) marcas.push(a)
    return { anos, x, y, caminho, termo, grade, marcas }
  }, [curva])

  const i = indice !== null && indice <= ultimo ? indice : ultimo
  const atual = curva[i]
  const resumo = `Curva de juros do DI1, ${curva.length} vencimentos, de ${rotuloVencimento(curva[0].vencimento)} (${pct(curva[0].taxa)}) a ${rotuloVencimento(curva[ultimo].vencimento)} (${pct(curva[ultimo].taxa)}).`

  function escolherPorPonteiro(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return
    const caixa = svgRef.current?.getBoundingClientRect()
    if (!caixa || caixa.width === 0) return
    const px = ((e.clientX - caixa.left) / caixa.width) * W
    let melhor = 0
    for (let k = 1; k <= ultimo; k++) if (Math.abs(dados.x(dados.anos[k]) - px) < Math.abs(dados.x(dados.anos[melhor]) - px)) melhor = k
    setIndice(melhor)
  }

  function teclado(e: KeyboardEvent<SVGSVGElement>) {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -5, PageDown: 5 }
    if (e.key in passos) {
      e.preventDefault()
      setIndice(Math.min(ultimo, Math.max(0, i + passos[e.key])))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setIndice(e.key === 'Home' ? 0 : ultimo)
    }
  }

  const estiloEixo = { fill: 'var(--text-muted)', fontSize: 9, fontVariantNumeric: 'tabular-nums' } as const

  return (
    <div className="col" style={{ gap: 8 }}>
      <div id={idLeitura} className="small" aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontVariantNumeric: 'tabular-nums' }}>
        <strong>{atual.ticker} · {rotuloVencimento(atual.vencimento)}</strong>
        <span>Taxa <strong style={{ color: COR_CURVA }}>{pct(atual.taxa, 3)}</strong> a.a.</span>
        {atual.taxaATermo !== null && <span>A termo <strong style={{ color: COR_TERMO }}>{pct(atual.taxaATermo, 3)}</strong></span>}
        <span className="muted">{atual.diasUteis.toLocaleString('pt-BR')} dias úteis</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={resumo}
        aria-describedby={idLeitura}
        tabIndex={0}
        onPointerDown={escolherPorPonteiro}
        onPointerMove={escolherPorPonteiro}
        onKeyDown={teclado}
        style={{ width: '100%', height: 'auto', touchAction: 'pan-y', display: 'block' }}
      >
        {dados.grade.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={dados.y(v)} y2={dados.y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={L - 5} y={dados.y(v) + 3} textAnchor="end" style={estiloEixo}>{v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</text>
          </g>
        ))}
        {dados.marcas.map((a) => (
          <text key={a} x={dados.x(a)} y={H - 7} textAnchor="middle" style={estiloEixo}>{a === 0 ? 'Hoje' : `${a}a`}</text>
        ))}

        <path d={dados.termo} fill="none" stroke={COR_TERMO} strokeWidth={1.4} strokeDasharray="4 3" strokeLinejoin="round" />
        <path d={dados.caminho} fill="none" stroke={COR_CURVA} strokeWidth={2} strokeLinejoin="round" />
        {curva.map((p, k) => (
          <circle key={p.ticker} cx={dados.x(dados.anos[k])} cy={dados.y(p.taxa)} r={k === i ? 3.8 : 1.8} fill={COR_CURVA} />
        ))}
        <line x1={dados.x(dados.anos[i])} x2={dados.x(dados.anos[i])} y1={T} y2={H - B} stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} aria-hidden="true" />
      </svg>

      <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', lineHeight: 1.4 }}>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_CURVA} strokeWidth="2" /></svg> Taxa do vencimento</span>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_TERMO} strokeWidth="2" strokeDasharray="4 2" /></svg> Taxa a termo entre vencimentos</span>
      </div>
    </div>
  )
}
