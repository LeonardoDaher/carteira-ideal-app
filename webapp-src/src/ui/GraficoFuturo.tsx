import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { mediaMovel } from '../domain/futuros'
import type { Candle } from '../domain/futuros'

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const W = 340
const L = 8
const R = 46
const T = 8
const ALTURA_PRECO = 170
const ALTURA_VOLUME = 34
const FOLGA = 14
const B = 18
const BASE_VOLUME = T + ALTURA_PRECO + FOLGA + ALTURA_VOLUME
const H = BASE_VOLUME + B

const COR_ALTA = 'var(--success)'
const COR_BAIXA = 'var(--danger)'
// Mesmas cores das zonas da análise técnica das ações (GraficoPrecoAcao): suporte azul e resistência vermelha, em linha fina.
const COR_SUPORTE = 'oklch(66% 0.19 250)'
const COR_RESISTENCIA = 'oklch(60% 0.24 25)'
const COR_MM80 = 'oklch(72% 0.13 235)'
// Contorno na cor do fundo: o texto sobre a linha continua legível quando cruza candles e médias.
const HALO = { paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3, strokeLinejoin: 'round' } as const

function passoRedondo(amplitude: number, linhas = 4) {
  const bruto = amplitude / linhas || 1
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const dataLonga = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/**
 * Candles do contínuo com médias de 21 (amarela) e 80 (azul, contínua) candles, suporte e resistência (mínima e máxima de 20 candles) e volume.
 * Toque, arraste ou use as setas para ver abertura, máxima, mínima e fechamento de cada dia. Verde = fechou acima da
 * abertura; vermelho = abaixo (a forma do corpo também muda, cheio ou vazado, para não depender só da cor).
 */
export function GraficoFuturo({ candles, nome, casas = 2, janela = 120 }: { candles: Candle[]; nome: string; casas?: number; janela?: number }) {
  const [indice, setIndice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idLeitura = useId()
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

  const dados = useMemo(() => {
    const fech = candles.map((c) => c[4])
    const sma21 = mediaMovel(fech, 21)
    const sma80 = mediaMovel(fech, 80)
    const inicio = Math.max(0, candles.length - janela)
    const vis = candles.slice(inicio)
    const n = vis.length
    const visSma21 = sma21.slice(inicio)
    const visSma80 = sma80.slice(inicio)
    const ult20 = vis.slice(-20)
    const suporte = Math.min(...ult20.map((c) => c[3]))
    const resistencia = Math.max(...ult20.map((c) => c[2]))
    const todos = [...vis.flatMap((c) => [c[2], c[3]]), ...visSma21.filter((v): v is number => v !== null), ...visSma80.filter((v): v is number => v !== null)]
    const minimo = Math.min(...todos)
    const maximo = Math.max(...todos)
    const passo = passoRedondo(maximo - minimo || 1)
    const yMin = Math.floor(minimo / passo) * passo
    const yMax = Math.ceil(maximo / passo) * passo
    const largura = (W - L - R) / Math.max(n, 1)
    const x = (i: number) => L + largura * (i + 0.5)
    const y = (v: number) => T + ((yMax - v) / (yMax - yMin || 1)) * ALTURA_PRECO
    const volMax = Math.max(...vis.map((c) => c[5]), 1)
    const yVol = (v: number) => BASE_VOLUME - (v / volMax) * ALTURA_VOLUME
    const linha = (serie: (number | null)[]) =>
      serie.map((v, i) => (v === null ? '' : `${i === 0 || serie[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('')
    const grade: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) grade.push(v)
    const marcas = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
    return { vis, n, largura, x, y, yVol, caminho21: linha(visSma21), caminho80: linha(visSma80), suporte, resistencia, grade, marcas, minimo, maximo }
  }, [candles, janela])

  const { vis, n, x, y, yVol, largura } = dados
  const resumo = `Gráfico de candles de ${nome}, ${n} dias, de ${dataLonga(vis[0][0])} a ${dataLonga(vis[n - 1][0])}. Último fechamento ${fmt(vis[n - 1][4])}, mínima do período ${fmt(dados.minimo)} e máxima ${fmt(dados.maximo)}.`
  const i = indice !== null && indice < n ? indice : n - 1
  const atual = vis[i]
  const anterior = i > 0 ? vis[i - 1][4] : null
  const variacao = anterior ? (atual[4] / anterior - 1) * 100 : null

  function escolherPorPonteiro(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return
    const caixa = svgRef.current?.getBoundingClientRect()
    if (!caixa || caixa.width === 0) return
    const px = ((e.clientX - caixa.left) / caixa.width) * W
    setIndice(Math.min(n - 1, Math.max(0, Math.floor((px - L) / largura))))
  }

  function teclado(e: KeyboardEvent<SVGSVGElement>) {
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -20, PageDown: 20 }
    if (e.key in passos) {
      e.preventDefault()
      setIndice(Math.min(n - 1, Math.max(0, i + passos[e.key])))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setIndice(e.key === 'Home' ? 0 : n - 1)
    }
  }

  const corDe = (c: Candle) => (c[4] >= c[1] ? COR_ALTA : COR_BAIXA)
  const estiloEixo = { fill: 'var(--text-muted)', fontSize: 9, fontVariantNumeric: 'tabular-nums' } as const

  return (
    <div className="col" style={{ gap: 8 }}>
      <div id={idLeitura} className="small" aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontVariantNumeric: 'tabular-nums' }}>
        <strong>{dataLonga(atual[0])}</strong>
        <span>A <strong>{fmt(atual[1])}</strong></span>
        <span>Máx <strong>{fmt(atual[2])}</strong></span>
        <span>Mín <strong>{fmt(atual[3])}</strong></span>
        <span>Fech <strong style={{ color: corDe(atual) }}>{fmt(atual[4])}</strong></span>
        {variacao !== null && <span style={{ color: variacao >= 0 ? COR_ALTA : COR_BAIXA }}>{variacao > 0 ? '+' : ''}{variacao.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>}
        <span className="muted">{atual[5].toLocaleString('pt-BR')} contratos</span>
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
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={W - R + 4} y={y(v) + 3} style={estiloEixo}>{fmt(v)}</text>
          </g>
        ))}

        <line x1={L} x2={W - R} y1={y(dados.resistencia)} y2={y(dados.resistencia)} stroke={COR_RESISTENCIA} strokeWidth={0.5} />
        <line x1={L} x2={W - R} y1={y(dados.suporte)} y2={y(dados.suporte)} stroke={COR_SUPORTE} strokeWidth={0.5} />
        <text x={W - R + 4} y={y(dados.resistencia) + 3} style={{ ...estiloEixo, fill: COR_RESISTENCIA, fontWeight: 700 }}>{fmt(dados.resistencia)}</text>
        <text x={W - R + 4} y={y(dados.suporte) + 3} style={{ ...estiloEixo, fill: COR_SUPORTE, fontWeight: 700 }}>{fmt(dados.suporte)}</text>

        {vis.map((c, k) => {
          const cor = corDe(c)
          const topo = y(Math.max(c[1], c[4]))
          const base = y(Math.min(c[1], c[4]))
          const corpo = Math.max(1, largura * 0.62)
          const alta = c[4] >= c[1]
          return (
            <g key={c[0]}>
              <line x1={x(k)} x2={x(k)} y1={y(c[2])} y2={y(c[3])} stroke={cor} strokeWidth={1} />
              <rect x={x(k) - corpo / 2} y={topo} width={corpo} height={Math.max(1, base - topo)} fill={alta ? 'none' : cor} stroke={cor} strokeWidth={1} />
              <rect x={x(k) - corpo / 2} y={yVol(c[5])} width={corpo} height={Math.max(0, BASE_VOLUME - yVol(c[5]))} fill={cor} opacity={0.45} />
            </g>
          )
        })}

        <path d={dados.caminho21} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
        <path d={dados.caminho80} fill="none" stroke={COR_MM80} strokeWidth={1.6} strokeLinejoin="round" />
        <text x={L + 3} y={y(dados.resistencia) - 3} style={{ ...estiloEixo, ...HALO, fill: COR_RESISTENCIA, fontWeight: 700 }}>Resistência {fmt(dados.resistencia)}</text>
        <text x={L + 3} y={y(dados.suporte) + 10} style={{ ...estiloEixo, ...HALO, fill: COR_SUPORTE, fontWeight: 700 }}>Suporte {fmt(dados.suporte)}</text>

        {dados.marcas.map((k) => (
          <text key={k} x={x(k)} y={H - 5} textAnchor={k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle'} style={estiloEixo}>{dataCurta(vis[k][0])}</text>
        ))}

        <g aria-hidden="true">
          <line x1={x(i)} x2={x(i)} y1={T} y2={T + ALTURA_PRECO} stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} />
        </g>
      </svg>

      <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', lineHeight: 1.4 }}>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke="var(--accent)" strokeWidth="2" /></svg> Média de 21</span>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM80} strokeWidth="2" /></svg> Média de 80</span>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_SUPORTE} strokeWidth="1" /></svg> Suporte (mín. 20)</span>
        <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_RESISTENCIA} strokeWidth="1" /></svg> Resistência (máx. 20)</span>
      </div>
    </div>
  )
}
