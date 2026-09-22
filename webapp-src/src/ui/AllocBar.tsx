import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ATIVOS } from '../data/assets'
import type { AtivoKey, Carteira } from '../domain/types'

function entradasOrdenadas(carteira: Carteira) {
  return (Object.entries(carteira) as [AtivoKey, number][]).sort((a, b) => b[1] - a[1])
}

export function AllocBar({ carteira }: { carteira: Carteira }) {
  const entradas = entradasOrdenadas(carteira)
  return (
    <div className="alloc-bar">
      {entradas.map(([ativo, pct]) => (
        <div key={ativo} style={{ width: `${pct}%`, background: ATIVOS[ativo].cor }} />
      ))}
    </div>
  )
}

interface FatiaGeometria {
  chave: string
  topo: string
  base: string
  labelX: number
  labelY: number
  pct: number
  fracao: number
}

/** Geometria compartilhada do anel (donut) com efeito 3D isométrico: o anel é
 * "achatado" verticalmente (elipse) e ganha uma camada escura deslocada para baixo,
 * simulando a espessura/lateral do anel, como num gráfico de pizza 3D clássico.
 * Usada tanto pelo gráfico principal da carteira (`PieChart`) quanto por sub-gráficos
 * de composição interna de uma classe de ativo (`SectorPieChart`). */
function construirFatias(
  entradas: [string, number][],
  size: number,
): { fatias: FatiaGeometria[] } {
  const total = entradas.reduce((s, [, v]) => s + v, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const rOut = size * 0.42
  const rIn = size * 0.2
  const rLabel = (rOut + rIn) / 2
  const squash = 0.55 // achatamento vertical, dá o efeito de perspectiva isométrica
  const depth = size * 0.11 // "altura" da parede lateral do anel

  const ponto = (raio: number, fracao: number, deslocamentoY = 0) => {
    const angulo = 2 * Math.PI * fracao - Math.PI / 2
    return { x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo) * squash + deslocamentoY }
  }

  const caminhoSetor = (inicioFracao: number, fimFracao: number, deslocamentoY: number) => {
    const outerA = ponto(rOut, inicioFracao, deslocamentoY)
    const outerB = ponto(rOut, fimFracao, deslocamentoY)
    const innerB = ponto(rIn, fimFracao, deslocamentoY)
    const innerA = ponto(rIn, inicioFracao, deslocamentoY)
    const largeArc = fimFracao - inicioFracao > 0.5 ? 1 : 0
    return [
      `M ${outerA.x} ${outerA.y}`,
      `A ${rOut} ${rOut * squash} 0 ${largeArc} 1 ${outerB.x} ${outerB.y}`,
      `L ${innerB.x} ${innerB.y}`,
      `A ${rIn} ${rIn * squash} 0 ${largeArc} 0 ${innerA.x} ${innerA.y}`,
      'Z',
    ].join(' ')
  }

  let acumulado = 0
  const fatias = entradas.map(([chave, valor]) => {
    const inicioFracao = acumulado
    const fracao = valor / total
    acumulado += fracao
    const fimFracao = acumulado

    const topo = caminhoSetor(inicioFracao, fimFracao, 0)
    const base = caminhoSetor(inicioFracao, fimFracao, depth)
    const label = ponto(rLabel, inicioFracao + fracao / 2)
    const pct = Math.round(valor)

    return { chave, topo, base, labelX: label.x, labelY: label.y, pct, fracao }
  })

  return { fatias }
}

/** Gráfico de pizza em anel (donut) com efeito 3D isométrico. Fatias são clicáveis
 * quando `onSlicePress` é informado.
 *
 * Efeito de destaque (mesmo das caixinhas de resultado): ao passar o mouse ou o dedo sobre
 * uma fatia, uma cópia do topo dela é desenhada por cima das demais, sobe 3 px, ganha o
 * realce (`--highlight`) e o contorno (`--text`). A cópia fica por cima para o contorno
 * nunca ser coberto pelas fatias vizinhas. */
export function PieChart({
  carteira,
  onSlicePress,
  size = 320,
}: {
  carteira: Carteira
  onSlicePress?: (ativo: AtivoKey) => void
  size?: number
}) {
  const entradas = entradasOrdenadas(carteira)
  const { fatias } = construirFatias(entradas, size)
  const [ativa, setAtiva] = useState<string | null>(null)

  // Descobre qual fatia está sob o ponteiro (mouse ou dedo). Com o dedo, o navegador manda
  // os eventos ao elemento onde o toque começou; elementFromPoint acompanha o dedo ao deslizar.
  const escolherFatia = (e: ReactPointerEvent<SVGSVGElement>) => {
    const alvo = document.elementFromPoint(e.clientX, e.clientY)
    const chave = alvo?.closest('[data-slice]')?.getAttribute('data-slice') ?? null
    setAtiva(chave)
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: size,
        width: '100%',
        height: 'auto',
        touchAction: 'pan-y', // rolagem vertical continua funcionando; deslizar na horizontal destaca fatias
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={escolherFatia}
      onPointerMove={escolherFatia}
      onPointerLeave={() => setAtiva(null)}
      onPointerCancel={() => setAtiva(null)}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setAtiva(null)
      }}
    >
      {/* Camada escura (parede/lateral do anel), deslocada para baixo */}
      <g style={{ filter: 'brightness(0.6)' }}>
        {fatias.map((f) => (
          <path key={`base-${f.chave}`} data-slice={f.chave} d={f.base} fill={ATIVOS[f.chave as AtivoKey].cor} stroke="none" />
        ))}
      </g>

      {/* Camada de cima (topo do anel), com as cores normais */}
      {fatias.map((f) => (
        <path
          key={f.chave}
          className={`pie-topo${ativa === f.chave ? ' ativo' : ''}`}
          data-slice={f.chave}
          d={f.topo}
          fill={ATIVOS[f.chave as AtivoKey].cor}
          stroke="var(--bg)"
          strokeWidth={2}
          onClick={onSlicePress ? () => onSlicePress(f.chave as AtivoKey) : undefined}
          style={onSlicePress ? { cursor: 'pointer' } : undefined}
        >
          <title>{`${ATIVOS[f.chave as AtivoKey].label}: ${f.pct}%`}</title>
        </path>
      ))}

      {fatias
        .filter((f) => f.fracao >= 0.02)
        .map((f) => (
          <text
            key={f.chave}
            x={f.labelX}
            y={f.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Sora', sans-serif"
            fontWeight={700}
            fontSize={size * 0.052}
            fill="white"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={size * 0.007}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {f.pct}%
          </text>
        ))}

      {/* Destaque: cópia do topo por cima de tudo (sobe, realça e ganha contorno) */}
      {fatias.map((f) => (
        <g key={`destaque-${f.chave}`} className={`pie-destaque${ativa === f.chave ? ' ativo' : ''}`}>
          <path
            d={f.topo}
            fill={ATIVOS[f.chave as AtivoKey].cor}
            stroke="var(--text)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path d={f.topo} style={{ fill: 'var(--highlight)' }} stroke="none" />
          {f.fracao >= 0.02 && (
            <text
              x={f.labelX}
              y={f.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Sora', sans-serif"
              fontWeight={700}
              fontSize={size * 0.052}
              fill="white"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={size * 0.007}
              paintOrder="stroke"
            >
              {f.pct}%
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export interface SetorFatia {
  label: string
  pct: number
  cor: string
}

/** Sub-gráfico de composição interna de uma classe de ativo (ex.: segmentos de FIIs),
 * com o mesmo anel 3D isométrico do gráfico principal da carteira, mas recebendo cor
 * e label diretamente (não depende do catálogo `ATIVOS`, que é por classe de ativo). */
export function SectorPieChart({
  setores,
  size = 260,
  onSlicePress,
}: {
  setores: SetorFatia[]
  size?: number
  onSlicePress?: (label: string) => void
}) {
  const entradas = [...setores].sort((a, b) => b.pct - a.pct).map((s) => [s.label, s.pct] as [string, number])
  const { fatias } = construirFatias(entradas, size)
  const corPorLabel = Object.fromEntries(setores.map((s) => [s.label, s.cor]))

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', margin: '0 auto', maxWidth: size, width: '100%', height: 'auto' }}
    >
      <g style={{ filter: 'brightness(0.6)' }}>
        {fatias.map((f) => (
          <path key={`base-${f.chave}`} d={f.base} fill={corPorLabel[f.chave]} stroke="none" />
        ))}
      </g>

      {fatias.map((f) => (
        <path
          key={f.chave}
          d={f.topo}
          fill={corPorLabel[f.chave]}
          stroke="var(--bg)"
          strokeWidth={2}
          onClick={onSlicePress ? () => onSlicePress(f.chave) : undefined}
          style={onSlicePress ? { cursor: 'pointer' } : undefined}
        >
          <title>{`${f.chave}: ${f.pct}%`}</title>
        </path>
      ))}

      {fatias
        .filter((f) => f.fracao >= 0.05)
        .map((f) => (
          <text
            key={f.chave}
            x={f.labelX}
            y={f.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Sora', sans-serif"
            fontWeight={700}
            fontSize={size * 0.052}
            fill="white"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={size * 0.007}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {f.pct}%
          </text>
        ))}
    </svg>
  )
}

export function SectorLegend({ setores }: { setores: SetorFatia[] }) {
  const ordenados = [...setores].sort((a, b) => b.pct - a.pct)
  return (
    <div className="col">
      {ordenados.map((s) => (
        <div key={s.label} className="alloc-row">
          <div className="alloc-dot" style={{ background: s.cor }} />
          <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
            <div className="row-between">
              <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{s.label}</span>
              <span className="font-display" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{s.pct}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AllocLegend({
  carteira,
  comDescricao = false,
  onItemPress,
}: {
  carteira: Carteira
  comDescricao?: boolean
  onItemPress?: (ativo: AtivoKey) => void
}) {
  const entradas = entradasOrdenadas(carteira)
  return (
    <div className="col alloc-list">
      {entradas.map(([ativo, pct]) => {
        const conteudo = (
          <>
            <div className="alloc-dot" style={{ background: ATIVOS[ativo].cor }} />
            <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
              <div className="row-between">
                <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{ATIVOS[ativo].label}</span>
                <span className="font-display" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{pct}%</span>
              </div>
              {comDescricao && <div className="muted tiny justify">{ATIVOS[ativo].descricao}</div>}
            </div>
            {onItemPress && <span className="muted small">›</span>}
          </>
        )
        if (onItemPress) {
          return (
            <button key={ativo} className="alloc-box" onClick={() => onItemPress(ativo)}>
              {conteudo}
            </button>
          )
        }
        return (
          <div key={ativo} className="alloc-box">
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}
