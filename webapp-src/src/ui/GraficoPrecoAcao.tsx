import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Barra, ZonaPreco } from '../domain/analiseTecnica'
import { mediaMovel } from '../domain/futuros'
import { dataCurta, dataLonga, numero, reais } from './formatoAnalise'

const W = 340
const L = 8
const R = 46
const T = 8
const ALTURA_PRECO = 180
const ALTURA_VOLUME = 34
const FOLGA = 14
const B = 18
const BASE_VOLUME = T + ALTURA_PRECO + FOLGA + ALTURA_VOLUME
const H = BASE_VOLUME + B

const COR_ALTA = 'var(--success)'
const COR_BAIXA = 'var(--danger)'
const COR_MM21 = 'var(--accent)'
const COR_MM50 = 'oklch(86% 0.22 135)'
const COR_MM200 = 'oklch(70% 0.14 320)'
const COR_SUPORTE = 'oklch(66% 0.19 250)'
const COR_RESISTENCIA = 'oklch(60% 0.24 25)'

export interface OpcoesDoGrafico {
  mm21: boolean
  mm50: boolean
  mm200: boolean
  zonas: boolean
  volume: boolean
}

function passoRedondo(amplitude: number, linhas = 4) {
  const bruto = amplitude / linhas || 1
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

/**
 * Preço da ação em candles, médias de 21, 50 e 200 pregões, zonas de suporte (azul) e resistência (vermelho) e volume financeiro.
 * O Boletim de Preços da B3 não traz a abertura: o corpo do candle vai do fechamento do pregão anterior ao fechamento do dia
 * (o gap de abertura não aparece) e o pavio vai da mínima à máxima. Toque, arraste ou use as setas para ler cada dia.
 */
export function GraficoPrecoAcao({ barras, zonas, nome, janela = 120, opcoes, periodicidade = 'diario' }: { barras: Barra[]; zonas: ZonaPreco[]; nome: string; janela?: number; opcoes: OpcoesDoGrafico; periodicidade?: 'diario' | 'semanal' | 'mensal' }) {
  const [indice, setIndice] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const idLeitura = useId()

  const dados = useMemo(() => {
    const fech = barras.map((b) => b.fech)
    const m21 = mediaMovel(fech, 21)
    const m50 = mediaMovel(fech, 50)
    const m200 = mediaMovel(fech, 200)
    const inicio = Math.max(0, barras.length - janela)
    const vis = barras.slice(inicio)
    const n = vis.length
    const v21 = m21.slice(inicio)
    const v50 = m50.slice(inicio)
    const v200 = m200.slice(inicio)
    const relevantes = [
      ...vis.flatMap((b, k) => [b.max, b.min, ...(k > 0 ? [vis[k - 1].fech] : [])]),
      ...(opcoes.mm21 ? v21 : []),
      ...(opcoes.mm50 ? v50 : []),
      ...(opcoes.mm200 ? v200 : []),
    ].filter((v): v is number => v !== null)
    let minimo = Math.min(...relevantes)
    let maximo = Math.max(...relevantes)
    // Zonas só entram na escala se estiverem perto do preço (até 10% fora da faixa): zona distante não deve achatar o gráfico.
    const folgaZona = (maximo - minimo) * 0.1
    // No máximo as 3 zonas mais próximas de cada lado (as zonas já vêm da mais próxima para a mais distante).
    const porTipo = (tipo: ZonaPreco['tipo']) => zonas.filter((z) => z.tipo === tipo && z.superior >= minimo - folgaZona && z.inferior <= maximo + folgaZona).slice(0, 3)
    const zonasVisiveis = opcoes.zonas ? [...porTipo('suporte'), ...porTipo('resistencia')] : []
    for (const z of zonasVisiveis) {
      minimo = Math.min(minimo, z.inferior)
      maximo = Math.max(maximo, z.superior)
    }
    const passo = passoRedondo(maximo - minimo || 1)
    const yMin = Math.floor(minimo / passo) * passo
    const yMax = Math.ceil(maximo / passo) * passo
    const largura = (W - L - R) / Math.max(n, 1)
    const x = (i: number) => L + largura * (i + 0.5)
    const y = (v: number) => T + ((yMax - v) / (yMax - yMin || 1)) * ALTURA_PRECO
    const volMax = Math.max(...vis.map((b) => b.vol), 1)
    const yVol = (v: number) => BASE_VOLUME - (v / volMax) * ALTURA_VOLUME
    const linha = (serie: (number | null)[]) => serie.map((v, i) => (v === null ? '' : `${i === 0 || serie[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('')
    const grade: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) grade.push(v)
    const marcas = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
    return {
      vis, n, largura, x, y, yVol, grade, marcas, zonasVisiveis, minimo, maximo,
      c21: linha(v21), c50: linha(v50), c200: linha(v200),
    }
  }, [barras, zonas, janela, opcoes.mm21, opcoes.mm50, opcoes.mm200, opcoes.zonas])

  const { vis, n, x, y, yVol, largura } = dados
  if (n < 2) return <div className="small muted" role="status">Histórico insuficiente para o gráfico.</div>
  const i = indice !== null && indice < n ? indice : n - 1
  const atual = vis[i]
  const anterior = i > 0 ? vis[i - 1].fech : null
  const variacao = anterior ? (atual.fech / anterior - 1) * 100 : null
  const unidade = periodicidade === 'mensal' ? 'meses' : periodicidade === 'semanal' ? 'semanas' : 'pregões'
  const resumo = `Gráfico de candles ${periodicidade === 'mensal' ? 'mensais' : periodicidade === 'semanal' ? 'semanais' : 'diários'} de ${nome}, ${n} ${unidade}, de ${dataLonga(vis[0].data)} a ${dataLonga(vis[n - 1].data)}. Último fechamento ${reais(vis[n - 1].fech)}, mínima do período ${reais(dados.minimo)} e máxima ${reais(dados.maximo)}.`
  const estiloEixo = { fill: 'var(--text-muted)', fontSize: 9, fontVariantNumeric: 'tabular-nums' } as const

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

  return (
    <div className="col" style={{ gap: 8 }}>
      <div id={idLeitura} className="small" aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontVariantNumeric: 'tabular-nums' }}>
        <strong>{dataLonga(atual.data)}</strong>
        <span>Fech <strong>{numero(atual.fech, 2)}</strong></span>
        <span>Máx <strong>{numero(atual.max, 2)}</strong></span>
        <span>Mín <strong>{numero(atual.min, 2)}</strong></span>
        {variacao !== null && <span style={{ color: variacao >= 0 ? COR_ALTA : COR_BAIXA }}>{variacao > 0 ? '+' : ''}{numero(variacao, 2)}%</span>}
        <span className="muted">R$ {numero(atual.vol / 1000, 1)} mi negociados</span>
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
            <text x={W - R + 4} y={y(v) + 3} style={estiloEixo}>{numero(v, v < 10 ? 2 : 1)}</text>
          </g>
        ))}

        {dados.zonasVisiveis.map((z, k) => {
          const cor = z.tipo === 'suporte' ? COR_SUPORTE : COR_RESISTENCIA
          const topo = y(z.superior)
          const yLinha = y(z.tipo === 'suporte' ? z.superior : z.inferior)
          return (
            <g key={`${z.tipo}-${k}`}>
              <rect x={L} y={topo} width={W - R - L} height={Math.max(2, y(z.inferior) - topo)} fill={cor} opacity={0.14} />
              <line x1={L} x2={W - R} y1={yLinha} y2={yLinha} stroke={cor} strokeWidth={1.6} />
            </g>
          )
        })}

        {vis.map((b, k) => {
          const abertura = k > 0 ? vis[k - 1].fech : b.fech
          const cor = b.fech < abertura ? COR_BAIXA : COR_ALTA
          const yCorpoTopo = y(Math.max(abertura, b.fech))
          const yCorpoBase = y(Math.min(abertura, b.fech))
          return (
            <g key={b.data}>
              {opcoes.volume && (
                <rect x={x(k) - largura * 0.31} y={yVol(b.vol)} width={Math.max(1, largura * 0.62)} height={Math.max(0, BASE_VOLUME - yVol(b.vol))} fill={cor} opacity={0.45} />
              )}
              <line x1={x(k)} x2={x(k)} y1={y(Math.max(b.max, abertura))} y2={y(Math.min(b.min, abertura))} stroke={cor} strokeWidth={1} />
              <rect x={x(k) - largura * 0.36} y={yCorpoTopo} width={Math.max(1, largura * 0.72)} height={Math.max(1, yCorpoBase - yCorpoTopo)} fill={cor} />
            </g>
          )
        })}

        {opcoes.mm200 && <path d={dados.c200} fill="none" stroke={COR_MM200} strokeWidth={1.4} strokeDasharray="2 3" strokeLinejoin="round" />}
        {opcoes.mm50 && <path d={dados.c50} fill="none" stroke={COR_MM50} strokeWidth={1.5} strokeDasharray="5 3" strokeLinejoin="round" />}
        {opcoes.mm21 && <path d={dados.c21} fill="none" stroke={COR_MM21} strokeWidth={1.5} strokeLinejoin="round" />}

        {dados.marcas.map((k) => (
          <text key={k} x={x(k)} y={H - 5} textAnchor={k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle'} style={estiloEixo}>{dataCurta(vis[k].data)}</text>
        ))}

        <g aria-hidden="true">
          <line x1={x(i)} x2={x(i)} y1={T} y2={T + ALTURA_PRECO} stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} />
        </g>
      </svg>

      <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', lineHeight: 1.4 }}>
        <span><svg width="10" height="12" aria-hidden="true"><rect x="2" y="2" width="6" height="8" fill={COR_ALTA} /></svg> Alta <svg width="10" height="12" aria-hidden="true"><rect x="2" y="2" width="6" height="8" fill={COR_BAIXA} /></svg> Baixa</span>
        {opcoes.mm21 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM21} strokeWidth="2" /></svg> Média 21</span>}
        {opcoes.mm50 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM50} strokeWidth="2" strokeDasharray="4 2" /></svg> Média 50</span>}
        {opcoes.mm200 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM200} strokeWidth="2" strokeDasharray="2 2" /></svg> Média 200</span>}
        {opcoes.zonas && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_SUPORTE} strokeWidth="2" /></svg> Suporte <svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_RESISTENCIA} strokeWidth="2" /></svg> Resistência</span>}
      </div>
    </div>
  )
}
