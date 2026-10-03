import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { NOMES_CENARIOS, reaisCompacto } from '../domain/simulaImovel'
import type { ChaveCenario, PontoMensal } from '../domain/simulaImovel'
import { reais } from '../domain/mercadoOficial'

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const L = 50
const R = 8
const T = 10
const B = 22
const W = 340
const H = 200

const ROTAS_PADRAO: ChaveCenario[] = ['aluguel', 'financiamento', 'consorcio']

/** Passo "redondo" (1, 2 ou 5 × 10^k) para o eixo vertical ter poucas linhas legíveis. */
function passoRedondo(amplitude: number, linhas = 4) {
  const bruto = amplitude / linhas || 1
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

/**
 * Evolução do patrimônio líquido dos três cenários, mês a mês. Cada linha tem um traço diferente (cheio,
 * tracejado, pontilhado) além da cor: quem não distingue cores continua lendo o gráfico. Toque, arraste
 * ou use as setas do teclado para ver o valor de cada cenário em cada mês.
 */
export function GraficoPatrimonio({ serie, rotas = ROTAS_PADRAO }: { serie: PontoMensal[]; rotas?: ChaveCenario[] }) {
  const CHAVES = rotas
  const [indice, setIndice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idLeitura = useId()
  const ultimo = serie.length - 1

  const dados = useMemo(() => {
    const todos = serie.flatMap((p) => CHAVES.map((c) => p[c]))
    const minimo = Math.min(0, ...todos)
    const maximo = Math.max(...todos, 1)
    const passo = passoRedondo(maximo - minimo)
    const yMin = Math.floor(minimo / passo) * passo
    const yMax = Math.ceil(maximo / passo) * passo
    const x = (mes: number) => L + (mes / (ultimo || 1)) * (W - L - R)
    const y = (v: number) => T + ((yMax - v) / (yMax - yMin || 1)) * (H - T - B)
    const caminho = (chave: ChaveCenario) => serie.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.mes).toFixed(1)} ${y(p[chave]).toFixed(1)}`).join('')
    const grade: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) grade.push(v)
    const anosTotal = ultimo / 12
    const passoAnos = anosTotal <= 10 ? 1 : anosTotal <= 20 ? 5 : 10
    const anos: number[] = []
    for (let a = 0; a <= anosTotal; a += passoAnos) anos.push(a)
    const fim = serie[ultimo]
    const resumo =
      `Patrimônio líquido ao longo de ${anosTotal} anos. No fim: ` + CHAVES.map((c) => `${NOMES_CENARIOS[c]} ${reais(fim[c])}`).join(', ') + '.'
    return { x, y, caminhos: Object.fromEntries(CHAVES.map((c) => [c, caminho(c)])) as Record<ChaveCenario, string>, grade, anos, resumo }
  }, [serie, ultimo, CHAVES])

  const { x, y } = dados
  const atual = serie[indice ?? ultimo]

  function escolherPorPonteiro(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return
    const caixa = svgRef.current?.getBoundingClientRect()
    if (!caixa || caixa.width === 0) return
    const px = ((e.clientX - caixa.left) / caixa.width) * W
    const mes = Math.round(((px - L) / (W - L - R)) * ultimo)
    setIndice(Math.min(ultimo, Math.max(0, mes)))
  }

  function teclado(e: KeyboardEvent<SVGSVGElement>) {
    const i = indice ?? ultimo
    const passos: Record<string, number> = { ArrowLeft: -12, ArrowRight: 12, PageUp: -60, PageDown: 60 }
    if (e.key in passos) {
      e.preventDefault()
      setIndice(Math.min(ultimo, Math.max(0, i + passos[e.key])))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setIndice(e.key === 'Home' ? 0 : ultimo)
    }
  }

  const rotuloTempo = (mes: number) => (mes === 0 ? 'Hoje' : mes % 12 === 0 ? `Ano ${mes / 12}` : `Ano ${Math.floor(mes / 12)} e ${mes % 12} m`)

  return (
    <div className="col" style={{ gap: 8 }}>
      <div id={idLeitura} className="grafico-pat-leitura" aria-live="polite">
        <span className="grafico-pat-tempo">{rotuloTempo(atual.mes)}</span>
        {CHAVES.map((c) => (
          <span key={c}>
            <svg width="18" height="8" aria-hidden="true" className="grafico-pat-amostra">
              <line x1="1" x2="17" y1="4" y2="4" className={`grafico-pat-linha ${c}`} />
            </svg>
            {NOMES_CENARIOS[c]} <strong>{reaisCompacto(atual[c])}</strong>
          </span>
        ))}
      </div>

      <svg
        ref={svgRef}
        className="grafico-pat"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={dados.resumo}
        aria-describedby={idLeitura}
        tabIndex={0}
        onPointerDown={escolherPorPonteiro}
        onPointerMove={escolherPorPonteiro}
        onKeyDown={teclado}
      >
        {dados.grade.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grafico-pat-grade" />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" className="grafico-pat-eixo">{reaisCompacto(v)}</text>
          </g>
        ))}
        {dados.anos.map((a) => (
          <text key={a} x={x(a * 12)} y={H - 6} textAnchor="middle" className="grafico-pat-eixo">{a === 0 ? 'Hoje' : `${a}a`}</text>
        ))}

        {CHAVES.map((c) => (
          <path key={c} d={dados.caminhos[c]} className={`grafico-pat-linha ${c}`} />
        ))}

        <g aria-hidden="true">
          <line x1={x(atual.mes)} x2={x(atual.mes)} y1={T} y2={H - B} className="grafico-pat-guia" />
          {CHAVES.map((c) => (
            <circle key={c} cx={x(atual.mes)} cy={y(atual[c])} r={3.6} className={`grafico-pat-ponto ${c}`} />
          ))}
        </g>
      </svg>

      <div className="tiny muted" style={{ textAlign: 'center' }}>
        <span className="so-toque">Toque ou arraste sobre</span>
        <span className="so-mouse">Passe o mouse sobre</span> o gráfico para ver cada mês.
      </div>
    </div>
  )
}
