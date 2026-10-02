import { useId } from 'react'
import { geometriaArea, geometriaBarras } from '../../domain/graficosSvg'
import type { PontoMensal, PontoProventos } from '../../domain/painelCarteira'
import { useValores } from './valoresOcultos'

// Gráficos do painel em SVG próprio (o app não usa biblioteca de gráficos). O desenho segue a
// referência de design: linha dourada com preenchimento em degradê, e barras cinzas com as mais
// recentes em dourado. Os rótulos de mês ficam em HTML, fora do SVG, para não distorcerem quando
// o gráfico estica na largura.

const LARGURA = 320

function RotulosDeMes({ pontos }: { pontos: PontoMensal[] }) {
  return (
    <div className="mc-eixo" aria-hidden="true">
      {pontos.map((p) => (
        <span key={p.mes}>{p.rotulo}</span>
      ))}
    </div>
  )
}

export function GraficoArea({ pontos, ariaLabel, altura = 120, decorativo = false }: { pontos: PontoMensal[]; ariaLabel: string; altura?: number; decorativo?: boolean }) {
  const id = useId().replace(/:/g, '')
  const g = geometriaArea(pontos.map((p) => p.valor), LARGURA, altura)
  const ultimo = g.pontos[g.pontos.length - 1]
  return (
    <div className="mc-grafico">
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ariaLabel })} preserveAspectRatio="none" className="mc-svg" style={{ height: altura }}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mc-ouro)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--mc-ouro)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="0" x2={LARGURA} y1={8 + (g.yBase - 8) * t} y2={8 + (g.yBase - 8) * t} className="mc-grade-linha" />
        ))}
        <path d={g.area} fill={`url(#${id}-fill)`} />
        <path d={g.linha} className="mc-linha-ouro" fill="none" vectorEffect="non-scaling-stroke" />
        {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r="3.2" className="mc-ponto-ouro" vectorEffect="non-scaling-stroke" />}
      </svg>
      <RotulosDeMes pontos={pontos} />
    </div>
  )
}

export function GraficoBarras({ pontos, ariaLabel, altura = 110, destaques = 2, decorativo = false }: { pontos: PontoMensal[]; ariaLabel: string; altura?: number; destaques?: number; decorativo?: boolean }) {
  const { reais } = useValores()
  const id = useId().replace(/:/g, '')
  const barras = geometriaBarras(pontos.map((p) => p.valor), LARGURA, altura, destaques)
  return (
    <div className="mc-grafico">
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ariaLabel })} preserveAspectRatio="none" className="mc-svg" style={{ height: altura }}>
        <defs>
          <linearGradient id={`${id}-ouro`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mc-ouro)" />
            <stop offset="100%" stopColor="var(--mc-ouro-fundo)" />
          </linearGradient>
        </defs>
        {barras.map((b, i) => (
          <rect
            key={pontos[i].mes}
            x={b.x}
            y={b.y}
            width={b.largura}
            height={b.altura}
            rx="2.5"
            fill={b.destaque ? `url(#${id}-ouro)` : 'var(--mc-barra)'}
          >
            {!decorativo && <title>{`${pontos[i].rotulo}: ${reais(pontos[i].valor)}`}</title>}
          </rect>
        ))}
      </svg>
      <RotulosDeMes pontos={pontos} />
    </div>
  )
}

/** Valor curto para escrever sobre a barra: "R$ 522,70", "R$ 1,1 mil". */
const compacto = (n: number, reais: (n: number) => string) => (n >= 1000 ? `R$ ${(n / 1000).toFixed(1).replace('.', ',')} mil` : reais(n))

/**
 * Proventos mês a mês como na página Proventos da B3: o valor escrito sobre cada barra, o mês atual em destaque
 * e o que ainda será pago (a receber) numa barra tracejada. Os valores vão na vertical, para caberem 15 meses
 * lado a lado até no celular; a lista "Valores de cada mês", abaixo do gráfico, traz os mesmos números por extenso.
 */
export function GraficoProventos({ pontos, mesAtual, ariaLabel, altura = 100 }: { pontos: PontoProventos[]; mesAtual: string; ariaLabel: string; altura?: number }) {
  const { reais, oculto } = useValores()
  const maximo = Math.max(0, ...pontos.map((p) => p.recebido + p.aReceber))
  const h = (v: number) => (maximo > 0 ? (v / maximo) * altura : 0)
  return (
    <div className="mc-pb" role="img" aria-label={ariaLabel}>
      {pontos.map((p) => {
        const total = p.recebido + p.aReceber
        return (
          <div key={p.mes} className={`mc-pb-col${p.mes === mesAtual ? ' destaque' : ''}`} title={`${p.rotulo}/${p.mes.slice(2, 4)}: ${reais(p.recebido)} recebidos${p.aReceber > 0 ? ` e ${reais(p.aReceber)} a receber` : ''}`}>
            <div className="mc-pb-barra" style={{ height: altura + 62 }}>
              {total > 0 && !oculto && <span className="mc-pb-valor">{compacto(total, reais)}</span>}
              {p.aReceber > 0 && <span className="mc-pb-areceber" style={{ height: Math.max(3, h(p.aReceber)) }} />}
              {p.recebido > 0 && <span className="mc-pb-recebido" style={{ height: Math.max(3, h(p.recebido)) }} />}
            </div>
            <span className="mc-pb-mes">{p.rotulo}</span>
          </div>
        )
      })}
    </div>
  )
}

const COR_CATEGORIA: Record<string, string> = {
  acoes: 'var(--asset-acoes)',
  fundos: 'var(--asset-fiis)',
  bdr: 'var(--asset-bdrs)',
  etf: 'var(--asset-fundosinternacionais)',
  tesouro: 'var(--asset-tesouro)',
  rendaFixa: 'var(--asset-cdb)',
  outra: 'var(--text-muted)',
}

export function corDaCategoria(categoria: string): string {
  return COR_CATEGORIA[categoria] ?? 'var(--text-muted)'
}

/** Barra horizontal empilhada: cada fatia com a cor da sua categoria. A legenda fica em HTML ao lado. */
export function BarraComposicao({ fatias, ariaLabel, decorativo = false }: { fatias: { categoria: string; rotulo: string; pct: number }[]; ariaLabel: string; decorativo?: boolean }) {
  return (
    <div className="mc-composicao" {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ariaLabel })}>
      {fatias.map((f) => (
        <span key={f.categoria} className="mc-fatia" style={{ width: `${f.pct}%`, background: corDaCategoria(f.categoria) }} title={decorativo ? undefined : `${f.rotulo}: ${f.pct.toFixed(1)}%`} />
      ))}
    </div>
  )
}
