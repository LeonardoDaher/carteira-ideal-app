import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import {
  PERIODOS,
  anosDoEixo,
  inicioDoPeriodo,
  leiturasMensais,
  mesAno,
  porcentagem,
  recortar,
  topoDoEixo,
} from '../domain/mercadoOficial'
import type { Periodo, SerieHistorica } from '../domain/mercadoOficial'

// Geometria do SVG (unidades do viewBox; o desenho escala com a largura da tela).
const L = 30
const R = 8
const T = 10
const B = 22
const W = 340
const H = 190

const tempo = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/**
 * Evolução da Selic meta (degraus, como decide o Copom) e do IPCA acumulado em 12 meses.
 * A distância entre as duas linhas é o juro real de cada momento, que a leitura acima do
 * gráfico mostra mês a mês ao tocar, arrastar ou usar as setas do teclado.
 */
export function GraficoJuros({ selic, ipca }: { selic: SerieHistorica; ipca?: SerieHistorica }) {
  const [periodo, setPeriodo] = useState<Periodo>('10a')
  const [indice, setIndice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idLeitura = useId()

  const fim = selic.pontos.at(-1)![0]
  const inicio = inicioDoPeriodo(fim, periodo, selic.pontos[0][0])

  const dados = useMemo(() => {
    const pSelic = recortar(selic, inicio, fim)
    const pIpca = ipca ? recortar(ipca, inicio, fim) : []
    const leituras = leiturasMensais(selic, ipca, inicio, fim)
    const valores = [...pSelic, ...pIpca].map(([, v]) => v)
    const yMax = topoDoEixo(valores)
    const yMin = Math.min(0, Math.floor(Math.min(...valores) / 5) * 5)
    const t0 = tempo(inicio)
    const t1 = tempo(fim)
    const x = (iso: string) => L + ((tempo(iso) - t0) / (t1 - t0 || 1)) * (W - L - R)
    const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B)

    let caminhoSelic = ''
    pSelic.forEach(([d, v], i) => {
      caminhoSelic += i === 0 ? `M${x(d).toFixed(1)} ${y(v).toFixed(1)}` : `H${x(d).toFixed(1)}V${y(v).toFixed(1)}`
    })
    caminhoSelic += `H${x(fim).toFixed(1)}`
    const caminhoIpca = pIpca.map(([d, v], i) => `${i === 0 ? 'M' : 'L'}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join('')

    const passoGrade = yMax - yMin > 30 ? 10 : 5
    const grade: number[] = []
    for (let v = yMin; v <= yMax; v += passoGrade) grade.push(v)

    const minimo = pSelic.reduce((a, b) => (b[1] < a[1] ? b : a))
    const maximo = pSelic.reduce((a, b) => (b[1] > a[1] ? b : a))
    const resumo =
      `Selic meta de ${mesAno(inicio)} a ${mesAno(fim)}: mínima de ${porcentagem(minimo[1])} em ${mesAno(minimo[0])}, ` +
      `máxima de ${porcentagem(maximo[1])} em ${mesAno(maximo[0])}, atual ${porcentagem(pSelic.at(-1)![1])}.`

    return { leituras, x, y, caminhoSelic, caminhoIpca, grade, anos: anosDoEixo(inicio, fim), resumo }
  }, [selic, ipca, inicio, fim])

  const { leituras, x, y } = dados
  // Sem escolha da pessoa, abre no último mês completo (Selic e IPCA já divulgado), para a
  // primeira leitura já trazer o juro real. A linha da Selic continua indo até hoje.
  const ultimoCompleto = leituras.findLastIndex((l) => l.ipca12m != null)
  const padrao = ultimoCompleto >= 0 ? ultimoCompleto : leituras.length - 1
  const atual = leituras[indice ?? padrao] ?? leituras.at(-1)

  function escolherPorPonteiro(e: PointerEvent<SVGSVGElement>) {
    // Mouse: acompanha o movimento. Toque: só enquanto o dedo está na tela.
    if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove') return
    const caixa = svgRef.current?.getBoundingClientRect()
    if (!caixa || caixa.width === 0) return
    const px = ((e.clientX - caixa.left) / caixa.width) * W
    let melhor = 0
    let distancia = Infinity
    leituras.forEach((l, i) => {
      const dist = Math.abs(x(l.data) - px)
      if (dist < distancia) {
        distancia = dist
        melhor = i
      }
    })
    setIndice(melhor)
  }

  function teclado(e: KeyboardEvent<SVGSVGElement>) {
    const atualIdx = indice ?? padrao
    const passos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 }
    if (e.key in passos) {
      e.preventDefault()
      setIndice(Math.min(leituras.length - 1, Math.max(0, atualIdx + passos[e.key])))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setIndice(e.key === 'Home' ? 0 : leituras.length - 1)
    }
  }

  function trocarPeriodo(p: Periodo) {
    setPeriodo(p)
    setIndice(null)
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 6 }} role="group" aria-label="Período do gráfico">
        {PERIODOS.map((p) => (
          <button key={p.id} className={`chip ${p.id === periodo ? 'selected' : ''}`} aria-pressed={p.id === periodo} onClick={() => trocarPeriodo(p.id)}>
            {p.rotulo}
          </button>
        ))}
      </div>

      {atual && (
        <div id={idLeitura} className="grafico-juros-leitura" aria-live="polite">
          <span className="grafico-juros-mes">{mesAno(atual.mes)}</span>
          <span>
            <span className="grafico-juros-marca selic" aria-hidden="true" />
            Selic <strong>{porcentagem(atual.selic!)}</strong>
          </span>
          {ipca && (
            <span>
              <span className="grafico-juros-marca ipca" aria-hidden="true" />
              IPCA 12m <strong>{atual.ipca12m == null ? 'a divulgar' : porcentagem(atual.ipca12m)}</strong>
            </span>
          )}
          {atual.jurosReais != null && (
            <span>
              Juro real <strong>{porcentagem(atual.jurosReais)}</strong>
            </span>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="grafico-juros"
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
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grafico-juros-grade" />
            <text x={L - 5} y={y(v) + 3} textAnchor="end" className="grafico-juros-eixo">{v}%</text>
          </g>
        ))}
        {dados.anos.map((a) => (
          <text key={a} x={x(`${a}-01-01`)} y={H - 6} textAnchor="middle" className="grafico-juros-eixo">{a}</text>
        ))}

        {dados.caminhoIpca && <path d={dados.caminhoIpca} className="grafico-juros-linha ipca" />}
        <path d={dados.caminhoSelic} className="grafico-juros-linha selic" />

        {atual && (
          <g aria-hidden="true">
            <line x1={x(atual.data)} x2={x(atual.data)} y1={T} y2={H - B} className="grafico-juros-guia" />
            {atual.ipca12m != null && <circle cx={x(atual.data)} cy={y(atual.ipca12m)} r={3.5} className="grafico-juros-ponto ipca" />}
            <circle cx={x(atual.data)} cy={y(atual.selic!)} r={4} className="grafico-juros-ponto selic" />
          </g>
        )}
      </svg>

      <div className="tiny muted" style={{ textAlign: 'center' }}>
        <span className="so-toque">Toque ou arraste sobre</span><span className="so-mouse">Passe o mouse sobre</span> o gráfico para ver cada mês. A distância entre as linhas é o juro real.
      </div>
    </div>
  )
}
