import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Barra, ZonaPreco } from '../domain/analiseTecnica'
import { estocasticoSerie, macdSerie, rsiSerie } from '../domain/analiseTecnica'
import { mediaMovel } from '../domain/futuros'
import { dataCurta, dataLonga, numero, reais } from './formatoAnalise'

const W = 340
const L = 8
const R = 46
const T = 8
const ALTURA_PRECO = 180
const ALTURA_VOLUME = 34
const FOLGA = 14
const ALTURA_IFR = 46
const ALTURA_MACD = 52
const ALTURA_ESTOCASTICO = 46
const B = 18

const COR_ALTA = 'var(--success)'
const COR_BAIXA = 'var(--danger)'
const COR_MM21 = 'var(--accent)'
const COR_MM80 = 'oklch(72% 0.13 235)'
const COR_MM200 = 'oklch(62% 0.27 328)'
const COR_SUPORTE = 'oklch(66% 0.19 250)'
const COR_RESISTENCIA = 'oklch(60% 0.24 25)'
const COR_MACD = 'oklch(72% 0.13 235)'
const COR_SINAL = 'oklch(75% 0.16 60)'

export interface OpcoesDoGrafico {
  mm21: boolean
  mm80: boolean
  mm200: boolean
  zonas: boolean
  volume: boolean
  ifr: boolean
  macd: boolean
  estocastico: boolean
}

/** Trecho visível: `qtd` candles, terminando `desloc` candles antes do último. */
export interface VistaDoGrafico {
  qtd: number
  desloc: number
}

const QTD_MINIMA = 15
const FATOR_ZOOM = 1.18

export function vistaValida(v: VistaDoGrafico, total: number): VistaDoGrafico {
  const qtd = Math.min(total, Math.max(Math.min(QTD_MINIMA, total), Math.round(v.qtd)))
  return { qtd, desloc: Math.min(total - qtd, Math.max(0, Math.round(v.desloc))) }
}

/** Muda a quantidade de candles por `fator` (>1 afasta, <1 aproxima) mantendo parado o ponto `ancora` (0 a 1, da esquerda para a direita). */
export function zoomarVista(v: VistaDoGrafico, total: number, fator: number, ancora: number): VistaDoGrafico {
  const atual = vistaValida(v, total)
  const inicio = total - atual.desloc - atual.qtd
  let qtd = Math.round(atual.qtd * fator)
  if (qtd === atual.qtd && fator !== 1) qtd += fator > 1 ? 1 : -1
  qtd = vistaValida({ qtd, desloc: 0 }, total).qtd
  const novoInicio = Math.min(total - qtd, Math.max(0, Math.round(inicio + ancora * atual.qtd - ancora * qtd)))
  return { qtd, desloc: total - novoInicio - qtd }
}

function passoRedondo(amplitude: number, linhas = 4) {
  const bruto = amplitude / linhas || 1
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const f = bruto / pot
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot
}

/**
 * Preço da ação em candles, médias simples de 21 (amarela), 80 (azul) e 200 (fúcsia tracejada) candles, zonas de suporte (azul) e
 * resistência (vermelho) com o preço na ponta da linha, volume financeiro, IFR, MACD e estocástico pleno.
 * Com o histórico longo do COTAHIST (`abe`) o corpo vai da abertura real ao fechamento; sem ele (Boletim de Preços, que não traz a
 * abertura) vai do fechamento do pregão anterior ao do dia, e o gap de abertura não aparece. O pavio vai da mínima à máxima. Toque, arraste ou use as setas para ler cada dia.
 */
export function GraficoPrecoAcao({ barras, zonas, nome, janela = 120, opcoes, periodicidade = 'diario' }: { barras: Barra[]; zonas: ZonaPreco[]; nome: string; janela?: number; opcoes: OpcoesDoGrafico; periodicidade?: 'diario' | 'semanal' | 'mensal' }) {
  const [indice, setIndice] = useState<number | null>(null)
  const [vista, setVista] = useState<VistaDoGrafico>({ qtd: janela, desloc: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{ x: number; desloc: number } | null>(null)
  const idLeitura = useId()
  const total = barras.length
  const { qtd, desloc } = vistaValida(vista, total)

  // Os indicadores são calculados uma vez sobre todo o histórico: ampliar e arrastar só recortam as séries prontas.
  const ind = useMemo(() => {
    const fech = barras.map((b) => b.fech)
    return { m21: mediaMovel(fech, 21), m80: mediaMovel(fech, 80), m200: mediaMovel(fech, 200), ifr: rsiSerie(fech), macd: macdSerie(fech), est: estocasticoSerie(barras) }
  }, [barras])

  // A roda do mouse amplia e reduz em torno do candle sob o ponteiro. Precisa de ouvinte não passivo para segurar a rolagem da página.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const aoRolar = (e: WheelEvent) => {
      e.preventDefault()
      const caixa = el.getBoundingClientRect()
      if (caixa.width === 0) return
      const ancora = Math.min(1, Math.max(0, ((((e.clientX - caixa.left) / caixa.width) * W) - L) / (W - L - R)))
      setVista((v) => zoomarVista(v, total, e.deltaY > 0 ? FATOR_ZOOM : 1 / FATOR_ZOOM, ancora))
    }
    el.addEventListener('wheel', aoRolar, { passive: false })
    return () => el.removeEventListener('wheel', aoRolar)
  }, [total])

  const dados = useMemo(() => {
    const fim = total - desloc
    const inicio = fim - qtd
    const vis = barras.slice(inicio, fim)
    const n = vis.length
    const v21 = ind.m21.slice(inicio, fim)
    const v80 = ind.m80.slice(inicio, fim)
    const v200 = ind.m200.slice(inicio, fim)
    const relevantes = [
      ...vis.flatMap((b, k) => [b.max, b.min, b.abe ?? (k > 0 ? vis[k - 1].fech : b.fech)]),
      ...(opcoes.mm21 ? v21 : []),
      ...(opcoes.mm80 ? v80 : []),
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
    // Painéis empilhados sob o preço, na mesma escala horizontal: volume, IFR e MACD (só os ligados ocupam espaço).
    let cursor = T + ALTURA_PRECO
    const painel = (ligado: boolean, altura: number) => {
      if (!ligado) return null
      const topo = cursor + FOLGA
      cursor = topo + altura
      return { topo, base: cursor }
    }
    const pVolume = painel(opcoes.volume, ALTURA_VOLUME)
    const pIfr = painel(opcoes.ifr, ALTURA_IFR)
    const pMacd = painel(opcoes.macd, ALTURA_MACD)
    const pEst = painel(opcoes.estocastico, ALTURA_ESTOCASTICO)
    const fundoPaineis = cursor
    const H = cursor + B
    const yVol = (v: number) => (pVolume ? pVolume.base - (v / volMax) * ALTURA_VOLUME : 0)
    const ifr = ind.ifr.slice(inicio, fim)
    const yIfr = (v: number) => (pIfr ? pIfr.base - (v / 100) * ALTURA_IFR : 0)
    const mLinha = ind.macd.linha.slice(inicio, fim)
    const mSinal = ind.macd.sinal.slice(inicio, fim)
    const mHist = ind.macd.hist.slice(inicio, fim)
    const mValores = [...mLinha, ...mSinal, ...mHist, 0].filter((v): v is number => v !== null)
    const mMax = Math.max(...mValores)
    const mMin = Math.min(...mValores)
    const yMacd = (v: number) => (pMacd ? pMacd.topo + ((mMax - v) / (mMax - mMin || 1)) * ALTURA_MACD : 0)
    const eK = ind.est.k.slice(inicio, fim)
    const eD = ind.est.d.slice(inicio, fim)
    const yEst = (v: number) => (pEst ? pEst.base - (v / 100) * ALTURA_ESTOCASTICO : 0)
    const linha = (serie: (number | null)[], escala: (v: number) => number = y) => serie.map((v, i) => (v === null ? '' : `${i === 0 || serie[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)} ${escala(v).toFixed(1)}`)).join('')
    const grade: number[] = []
    for (let v = yMin; v <= yMax + passo / 2; v += passo) grade.push(v)
    // Datas do eixo: mais de um ano na tela mostra a virada de cada ano (marcada com o ano); até um ano, cinco datas igualmente espaçadas.
    const anos = vis.map((b) => b.data.slice(0, 4))
    const viradas = vis.flatMap((_, k) => (k > 0 && anos[k] !== anos[k - 1] ? [{ k, texto: anos[k], ano: true }] : []))
    const passoAno = Math.ceil(viradas.length / 6) || 1
    const marcas: { k: number; texto: string; ano: boolean }[] =
      viradas.length >= 1 && new Date(vis[n - 1].data).getTime() - new Date(vis[0].data).getTime() > 400 * 86_400_000
        ? viradas.filter((_, j) => j % passoAno === 0)
        : [0, 1, 2, 3, 4].map((j) => Math.round(((n - 1) * j) / 4)).filter((v, i, a) => a.indexOf(v) === i).map((k) => ({ k, texto: dataCurta(vis[k].data), ano: false }))
    // Preço escrito na ponta de cada zona (azul/vermelho); afasta os rótulos que ficariam um sobre o outro e some com os da grade que colidem.
    const rotulosZona = zonasVisiveis
      .map((z) => ({ tipo: z.tipo, valor: z.tipo === 'suporte' ? z.superior : z.inferior, y: y(z.tipo === 'suporte' ? z.superior : z.inferior) }))
      .sort((a, b) => a.y - b.y)
    for (let k = 1; k < rotulosZona.length; k++) rotulosZona[k].y = Math.max(rotulosZona[k].y, rotulosZona[k - 1].y + 9)
    const gradeSemColisao = grade.filter((v) => rotulosZona.every((r) => Math.abs(r.y - y(v)) > 9))
    return {
      vis, n, largura, x, y, yVol, grade: gradeSemColisao, marcas, zonasVisiveis, minimo, maximo, H, fundoPaineis, rotulosZona,
      pVolume, pIfr, pMacd, pEst, yIfr, yMacd, yEst, ifr, mLinha, mSinal, mHist, eK, eD,
      cK: linha(eK, yEst), cD: linha(eD, yEst),
      c21: linha(v21), c80: linha(v80), c200: linha(v200),
      cIfr: linha(ifr, yIfr), cMacd: linha(mLinha, yMacd), cSinal: linha(mSinal, yMacd),
    }
  }, [barras, ind, total, qtd, desloc, zonas, opcoes.mm21, opcoes.mm80, opcoes.mm200, opcoes.zonas, opcoes.volume, opcoes.ifr, opcoes.macd, opcoes.estocastico])

  const { vis, n, x, y, yVol, largura, H, pVolume, pIfr, pMacd, pEst } = dados
  if (n < 2) return <div className="small muted" role="status">Histórico insuficiente para o gráfico.</div>
  const i = indice !== null && indice < n ? indice : n - 1
  const atual = vis[i]
  const anterior = i > 0 ? vis[i - 1].fech : null
  const variacao = anterior ? (atual.fech / anterior - 1) * 100 : null
  const unidade = periodicidade === 'mensal' ? 'meses' : periodicidade === 'semanal' ? 'semanas' : 'pregões'
  const resumo = `Gráfico de candles ${periodicidade === 'mensal' ? 'mensais' : periodicidade === 'semanal' ? 'semanais' : 'diários'} de ${nome}, ${n} ${unidade}, de ${dataLonga(vis[0].data)} a ${dataLonga(vis[n - 1].data)}. Último fechamento ${reais(vis[n - 1].fech)}, mínima do período ${reais(dados.minimo)} e máxima ${reais(dados.maximo)}.`
  const estiloEixo = { fill: 'var(--text-muted)', fontSize: 9, fontVariantNumeric: 'tabular-nums' } as const

  const caixaX = (clientX: number) => {
    const caixa = svgRef.current?.getBoundingClientRect()
    return caixa && caixa.width > 0 ? ((clientX - caixa.left) / caixa.width) * W : null
  }
  const aproximar = (fator: number) => setVista((v) => zoomarVista(v, total, fator, 1))
  const mover = (candles: number) => setVista((v) => vistaValida({ qtd: v.qtd, desloc: v.desloc + candles }, total))

  function aoPressionar(e: PointerEvent<SVGSVGElement>) {
    arrasto.current = { x: e.clientX, desloc }
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ponteiro já encerrado: o arrasto segue sem captura
    }
    const px = caixaX(e.clientX)
    if (px !== null) setIndice(Math.min(n - 1, Math.max(0, Math.floor((px - L) / largura))))
  }

  /** Mouse parado sobre o gráfico lê o dia; com o botão (ou o dedo) pressionado, arrastar para a direita mostra o passado. */
  function aoMover(e: PointerEvent<SVGSVGElement>) {
    const px = caixaX(e.clientX)
    if (px === null) return
    if (arrasto.current && e.buttons !== 0) {
      const candles = Math.round(((e.clientX - arrasto.current.x) / (svgRef.current as SVGSVGElement).getBoundingClientRect().width * W) / largura)
      setVista((v) => vistaValida({ qtd: v.qtd, desloc: arrasto.current ? arrasto.current.desloc + candles : v.desloc }, total))
    } else if (e.pointerType === 'mouse') {
      setIndice(Math.min(n - 1, Math.max(0, Math.floor((px - L) / largura))))
    }
  }

  function teclado(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault()
      aproximar(e.key === '-' ? FATOR_ZOOM : 1 / FATOR_ZOOM)
      return
    }
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
        {pEst && dados.eK[i] !== null && dados.eD[i] !== null && <span>Estoc. %K <strong>{numero(dados.eK[i] as number, 0)}</strong> %D <strong>{numero(dados.eD[i] as number, 0)}</strong></span>}
        {pIfr && dados.ifr[i] !== null && <span>IFR <strong>{numero(dados.ifr[i] as number, 0)}</strong></span>}
        {pMacd && dados.mHist[i] !== null && <span>MACD <strong>{numero(dados.mLinha[i] as number, 2)}</strong> sinal <strong>{numero(dados.mSinal[i] as number, 2)}</strong></span>}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={resumo}
        aria-describedby={idLeitura}
        tabIndex={0}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={() => { arrasto.current = null }}
        onPointerCancel={() => { arrasto.current = null }}
        onKeyDown={teclado}
        style={{ width: '100%', height: 'auto', touchAction: 'pan-y', display: 'block', cursor: 'crosshair', userSelect: 'none' }}
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
              <line x1={L} x2={W - R} y1={yLinha} y2={yLinha} stroke={cor} strokeWidth={0.5} />
            </g>
          )
        })}
        {dados.rotulosZona.map((r, k) => (
          <text key={`${r.tipo}-${k}`} x={W - R + 4} y={r.y + 3} style={{ ...estiloEixo, fill: r.tipo === 'suporte' ? COR_SUPORTE : COR_RESISTENCIA, fontWeight: 700 }}>{numero(r.valor, 2)}</text>
        ))}

        {vis.map((b, k) => {
          const abertura = b.abe ?? (k > 0 ? vis[k - 1].fech : b.fech)
          const cor = b.fech < abertura ? COR_BAIXA : COR_ALTA
          const yCorpoTopo = y(Math.max(abertura, b.fech))
          const yCorpoBase = y(Math.min(abertura, b.fech))
          return (
            <g key={b.data}>
              {pVolume && (
                <rect x={x(k) - largura * 0.31} y={yVol(b.vol)} width={Math.max(1, largura * 0.62)} height={Math.max(0, pVolume.base - yVol(b.vol))} fill={cor} opacity={0.45} />
              )}
              <line x1={x(k)} x2={x(k)} y1={y(Math.max(b.max, abertura))} y2={y(Math.min(b.min, abertura))} stroke={cor} strokeWidth={1} />
              <rect x={x(k) - largura * 0.36} y={yCorpoTopo} width={Math.max(1, largura * 0.72)} height={Math.max(1, yCorpoBase - yCorpoTopo)} fill={cor} />
            </g>
          )
        })}

        {opcoes.mm200 && <path d={dados.c200} fill="none" stroke={COR_MM200} strokeWidth={2.2} strokeDasharray="6 3" strokeLinejoin="round" />}
        {opcoes.mm80 && <path d={dados.c80} fill="none" stroke={COR_MM80} strokeWidth={0.9} strokeLinejoin="round" />}
        {opcoes.mm21 && <path d={dados.c21} fill="none" stroke={COR_MM21} strokeWidth={0.9} strokeLinejoin="round" />}

        {pVolume && <text x={L + 2} y={pVolume.topo + 8} style={estiloEixo}>Volume</text>}

        {pIfr && (
          <g>
            <text x={L + 2} y={pIfr.topo + 8} style={estiloEixo}>IFR 14</text>
            {[30, 70].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={dados.yIfr(v)} y2={dados.yIfr(v)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
                <text x={W - R + 4} y={dados.yIfr(v) + 3} style={estiloEixo}>{v}</text>
              </g>
            ))}
            <path d={dados.cIfr} fill="none" stroke={COR_MM21} strokeWidth={1.3} strokeLinejoin="round" />
          </g>
        )}

        {pMacd && (
          <g>
            <text x={L + 2} y={pMacd.topo + 8} style={estiloEixo}>MACD 12, 26, 9</text>
            <line x1={L} x2={W - R} y1={dados.yMacd(0)} y2={dados.yMacd(0)} stroke="var(--border)" strokeWidth={1} />
            {dados.mHist.map((v, k) =>
              v === null ? null : (
                <rect key={vis[k].data} x={x(k) - largura * 0.35} y={Math.min(dados.yMacd(v), dados.yMacd(0))} width={Math.max(1, largura * 0.7)} height={Math.max(0.5, Math.abs(dados.yMacd(v) - dados.yMacd(0)))} fill={v >= 0 ? COR_ALTA : COR_BAIXA} opacity={0.6} />
              ),
            )}
            <path d={dados.cMacd} fill="none" stroke={COR_MACD} strokeWidth={1.2} strokeLinejoin="round" />
            <path d={dados.cSinal} fill="none" stroke={COR_SINAL} strokeWidth={1.2} strokeLinejoin="round" />
          </g>
        )}

        {pEst && (
          <g>
            <text x={L + 2} y={pEst.topo + 8} style={estiloEixo}>Estocástico 14, 3, 3</text>
            {[20, 80].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={dados.yEst(v)} y2={dados.yEst(v)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
                <text x={W - R + 4} y={dados.yEst(v) + 3} style={estiloEixo}>{v}</text>
              </g>
            ))}
            <path d={dados.cK} fill="none" stroke={COR_MACD} strokeWidth={1.2} strokeLinejoin="round" />
            <path d={dados.cD} fill="none" stroke={COR_SINAL} strokeWidth={1.2} strokeLinejoin="round" />
          </g>
        )}

        {dados.marcas.map((m) => (
          <g key={m.k}>
            {m.ano && <line x1={x(m.k) - largura / 2} x2={x(m.k) - largura / 2} y1={T} y2={dados.fundoPaineis} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3" />}
            <text x={m.ano ? x(m.k) - largura / 2 + 3 : x(m.k)} y={H - 5} textAnchor={m.ano ? 'start' : m.k === 0 ? 'start' : m.k === n - 1 ? 'end' : 'middle'} style={estiloEixo}>{m.texto}</text>
          </g>
        ))}

        <g aria-hidden="true">
          <line x1={x(i)} x2={x(i)} y1={T} y2={dados.fundoPaineis} stroke="var(--text-muted)" strokeWidth={1} opacity={0.6} />
        </g>
      </svg>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Ampliar e mover o gráfico">
        <button className="chip" onClick={() => aproximar(1 / FATOR_ZOOM)} aria-label="Aproximar">＋</button>
        <button className="chip" onClick={() => aproximar(FATOR_ZOOM)} aria-label="Afastar">－</button>
        <button className="chip" onClick={() => mover(Math.max(5, Math.round(qtd / 4)))} aria-label="Voltar no tempo">◀</button>
        <button className="chip" onClick={() => mover(-Math.max(5, Math.round(qtd / 4)))} aria-label="Avançar no tempo">▶</button>
        <span className="tiny muted">Role a roda do mouse para ampliar e arraste para mover</span>
      </div>

      <div className="small muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', lineHeight: 1.4 }}>
        <span><svg width="10" height="12" aria-hidden="true"><rect x="2" y="2" width="6" height="8" fill={COR_ALTA} /></svg> Alta <svg width="10" height="12" aria-hidden="true"><rect x="2" y="2" width="6" height="8" fill={COR_BAIXA} /></svg> Baixa</span>
        {opcoes.mm21 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM21} strokeWidth="1" /></svg> Média 21</span>}
        {opcoes.mm80 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM80} strokeWidth="1" /></svg> Média 80</span>}
        {opcoes.mm200 && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MM200} strokeWidth="2.5" strokeDasharray="5 2" /></svg> Média 200</span>}
        {opcoes.zonas && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_SUPORTE} strokeWidth="1" /></svg> Suporte <svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_RESISTENCIA} strokeWidth="1" /></svg> Resistência</span>}
        {(opcoes.macd || opcoes.estocastico) && <span><svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_MACD} strokeWidth="2" /></svg> {opcoes.macd && opcoes.estocastico ? 'MACD / %K' : opcoes.macd ? 'MACD' : '%K'} <svg width="18" height="8" aria-hidden="true"><line x1="1" x2="17" y1="4" y2="4" stroke={COR_SINAL} strokeWidth="2" /></svg> {opcoes.macd && opcoes.estocastico ? 'Sinal / %D' : opcoes.macd ? 'Sinal' : '%D'}</span>}
      </div>
    </div>
  )
}
