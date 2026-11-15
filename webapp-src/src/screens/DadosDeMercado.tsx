import { useMemo, useState } from 'react'
import { useArquivoDados } from '../data/useArquivoDados'
import {
  ROTULO_PERIODO, dataBR, formatarMilhoes, formatarReaisCurto, maisAlugadas, mediaMovel, pesoNoTotal, recortar, correlacao, mesmoSentido, parear, escalasAlinhadas, rotuloMes, semPrimeiroMesIncompleto, TIPOS_INVESTIDOR, totaisPorMesTodos, sequenciaAtual, somar, totaisPorMes, variacaoMensal, resumoAluguelPreco, SALDO_MINIMO_COMPARACAO,
} from '../domain/dadosDeMercado'
import type { BarraIndice, RegistroAluguel, Periodo, RegistroFluxo, SnapshotAluguel, SnapshotFluxo, ParMes, TotalMes } from '../domain/dadosDeMercado'
import { EstadoDoArquivo } from '../ui/BlocosDeAnalise'

export const CAMINHO_FLUXO = 'dados/fluxoEstrangeiro.json'
export const CAMINHO_ALUGUEL = 'dados/emprestimoAtivos.json'
export const CAMINHO_IBOV = 'dados/indices-historico/IBOV.json'

/** Valor em R$ milhões escrito em bilhões, sem unidade ("−1,9", "26,3"): a unidade vai na legenda do gráfico. */
function emBilhoes(valorEmMilhoes: number): string {
  return `${valorEmMilhoes < 0 ? '−' : ''}${(Math.abs(valorEmMilhoes) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

const PERIODOS: Periodo[] = ['mes', 'ano', '30', '90']
const JANELA_MEDIA = 28

function SemDados({ nome }: { nome: string }) {
  return (
    <div className="small muted justify" role="status">
      Os dados de {nome} ainda não foram carregados. Eles são atualizados nos dias úteis; volte mais tarde.
    </div>
  )
}

function Fonte({ texto, atualizado }: { texto: string; atualizado?: string | null }) {
  return (
    <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
      Fonte: {texto}.{atualizado ? ` Atualizado em ${dataBR(atualizado.slice(0, 10))}.` : ''}
    </div>
  )
}

/** Barras do saldo diário (verde = entrada, vermelho = saída) com a média móvel de 28 pregões. */
function GraficoFluxo({ registros, serie }: { registros: RegistroFluxo[]; serie: number[] }) {
  const W = 340
  const H = 170
  const L = 4
  const R = 4
  const topo = 8
  const base = H - 18
  const n = registros.length
  const media = mediaMovel(serie, JANELA_MEDIA)
  const todos = [...serie, ...media.filter((v): v is number => v !== null), 0]
  const max = Math.max(...todos)
  const min = Math.min(...todos)
  const folga = (max - min || 1) * 0.06
  const y = (v: number) => topo + ((max + folga - v) / (max - min + 2 * folga || 1)) * (base - topo)
  const larg = (W - L - R) / n
  const x = (i: number) => L + larg * (i + 0.5)
  const linha = media.map((v, i) => (v === null ? '' : `${i === 0 || media[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).join('')
  const total = serie.reduce((s, v) => s + v, 0)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Saldo diário do investidor estrangeiro em ${n} pregões, de ${dataBR(registros[0].data)} a ${dataBR(registros[n - 1].data)}. Saldo no período: ${formatarMilhoes(total)}.`}
      style={{ width: '100%', height: 'auto', maxHeight: 220, display: 'block' }}
    >
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
      {serie.map((v, i) => (
        <rect key={registros[i].data} x={x(i) - larg * 0.36} y={Math.min(y(v), y(0))} width={Math.max(1, larg * 0.72)} height={Math.max(1, Math.abs(y(v) - y(0)))} fill={v >= 0 ? 'var(--success)' : 'var(--danger)'} opacity={0.85} />
      ))}
      {linha && <path d={linha} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
      <text x={L} y={H - 4} style={{ fill: 'var(--text-muted)', fontSize: 10 }}>{dataBR(registros[0].data).slice(0, 5)}</text>
      <text x={W - R} y={H - 4} textAnchor="end" style={{ fill: 'var(--text-muted)', fontSize: 10 }}>{dataBR(registros[n - 1].data).slice(0, 5)}</text>
    </svg>
  )
}

/** Uma barra por mês: verde = o estrangeiro pôs dinheiro, vermelho = tirou. O valor vai escrito em cada barra. */
function GraficoMensal({ meses }: { meses: TotalMes[] }) {
  const W = 340
  const H = 200
  const topo = 22
  const base = H - 22
  const n = meses.length
  const max = Math.max(0, ...meses.map((m) => m.estrangeiro))
  const min = Math.min(0, ...meses.map((m) => m.estrangeiro))
  const y = (v: number) => topo + ((max - v) / (max - min || 1)) * (base - topo)
  const larg = (W - 8) / Math.max(n, 4)
  const total = meses.reduce((s, m) => s + m.estrangeiro, 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Saldo do investidor estrangeiro por mês, de ${rotuloMes(meses[0].mes)} a ${rotuloMes(meses[n - 1].mes)}. Soma: ${formatarMilhoes(total)}.`} style={{ width: '100%', height: 'auto', maxHeight: 260, display: 'block' }}>
      <line x1={4} x2={W - 4} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeWidth={1} />
      {meses.map((m, i) => {
        const cx = 4 + larg * (i + 0.5)
        const v = m.estrangeiro
        const saiu = v < 0
        return (
          <g key={m.mes}>
            <rect x={cx - larg * 0.34} y={Math.min(y(v), y(0))} width={larg * 0.68} height={Math.max(2, Math.abs(y(v) - y(0)))} rx={2} fill={saiu ? 'var(--danger)' : 'var(--success)'} opacity={0.9} />
            <text x={cx} y={saiu ? y(v) + Math.max(2, Math.abs(y(v) - y(0))) + 11 : y(v) - 4} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 8, fontWeight: 600 }}>{emBilhoes(v)}</text>
            <text x={cx} y={H - 6} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 8 }}>{rotuloMes(m.mes).split('/')[0]}</text>
          </g>
        )
      })}
    </svg>
  )
}

function CartaoFluxo({ snapshot }: { snapshot?: SnapshotFluxo }) {
  const [visao, setVisao] = useState<'meses' | Periodo>('meses')
  const periodo: Periodo = visao === 'meses' ? 'mes' : visao
  const setPeriodo = setVisao
  const [estado, recarregar] = useArquivoDados<SnapshotFluxo>(CAMINHO_FLUXO, true, snapshot)
  const dados = estado.tipo === 'pronto' ? estado.dados : null
  const recorte = useMemo(() => (dados ? recortar(dados.registros, periodo) : []), [dados, periodo])
  const ultimo = dados?.registros[dados.registros.length - 1]
  const sequencia = dados ? sequenciaAtual(dados.registros) : null

  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="titulo-fluxo">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="titulo-fluxo" style={{ fontSize: 17 }}>🌎 Investimento estrangeiro</h2>
        <span className="small muted justify">Quanto o investidor estrangeiro colocou (entrada) ou tirou (saída) da bolsa em cada pregão.</span>
      </div>
      {!dados ? (
        <EstadoDoArquivo estado={estado.tipo === 'pronto' ? 'ocioso' : estado.tipo} aoTentarDeNovo={recarregar} nome="o fluxo do investidor estrangeiro" />
      ) : !ultimo ? (
        <SemDados nome="fluxo do investidor estrangeiro" />
      ) : (
        <>
          <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <div className="col" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', gap: 2, flex: 1 }}>
              <span className="tiny muted">Último pregão ({dataBR(ultimo.data).slice(0, 5)})</span>
              <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: ultimo.estrangeiro >= 0 ? 'var(--success)' : 'var(--danger)' }} data-testid="fluxo-ultimo">
                {formatarMilhoes(ultimo.estrangeiro)}
              </span>
            </div>
            <div className="col" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', gap: 2, flex: 1 }}>
              <span className="tiny muted">{ROTULO_PERIODO[periodo]}</span>
              <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: somar(recorte) >= 0 ? 'var(--success)' : 'var(--danger)' }} data-testid="fluxo-periodo">
                {formatarMilhoes(somar(recorte))}
              </span>
            </div>
          </div>

          <div role="group" aria-label="Período do gráfico" className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={`chip ${visao === 'meses' ? 'selected' : ''}`} aria-pressed={visao === 'meses'} onClick={() => setVisao('meses')}>Mês a mês</button>
            {PERIODOS.map((p) => (
              <button key={p} className={`chip ${visao === p ? 'selected' : ''}`} aria-pressed={visao === p} onClick={() => setPeriodo(p)}>
                {ROTULO_PERIODO[p]}
              </button>
            ))}
          </div>

          {visao === 'meses' ? (
            <>
              <GraficoMensal meses={totaisPorMes(dados.registros)} />
              <div className="tiny muted justify">Valores em R$ bilhões (o sinal − indica saída). O último mês é parcial, até o último pregão disponível.</div>
            </>
          ) : recorte.length >= 2 ? (
            <GraficoFluxo registros={recorte} serie={recorte.map((r) => r.estrangeiro)} />
          ) : (
            <div className="small muted">Poucos pregões neste período para desenhar o gráfico.</div>
          )}
          <div className="tiny muted row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span><span aria-hidden="true" style={{ color: 'var(--success)' }}>■</span> entrada</span>
            <span><span aria-hidden="true" style={{ color: 'var(--danger)' }}>■</span> saída</span>
            <span><span aria-hidden="true" style={{ color: 'var(--accent)' }}>━</span> média de {JANELA_MEDIA} pregões</span>
          </div>

          {sequencia && sequencia.dias >= 2 && (
            <div className="small justify" role="note">
              {sequencia.dias} pregões seguidos de {sequencia.entrada ? 'entrada' : 'saída'} de capital estrangeiro.
            </div>
          )}

          <Fonte texto={dados.fonte} atualizado={dados.geradoEm} />
        </>
      )}
    </section>
  )
}

/** Quadro mês a mês: cada coluna é um tipo de investidor; verde = pôs dinheiro na bolsa, vermelho = tirou. */
function CartaoQuem({ fluxo }: { fluxo?: SnapshotFluxo }) {
  const [estado, recarregar] = useArquivoDados<SnapshotFluxo>(CAMINHO_FLUXO, true, fluxo)
  const dados = estado.tipo === 'pronto' ? estado.dados : null
  const meses = useMemo(() => (dados ? totaisPorMesTodos(semPrimeiroMesIncompleto(dados.registros), 12).reverse() : []), [dados])
  const maximo = useMemo(() => TIPOS_INVESTIDOR.map(({ campo }) => Math.max(1, ...meses.map((m) => Math.abs(m[campo])))), [meses])
  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="titulo-quem">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="titulo-quem" style={{ fontSize: 17 }}>⚖️ Quem comprou e quem vendeu a bolsa brasileira</h2>
        <span className="small muted justify">Para cada real que um tipo de investidor tira da bolsa, outro coloca. Veja o saldo de cada um, mês a mês: verde = colocou, vermelho = tirou.</span>
      </div>
      {!dados ? (
        <EstadoDoArquivo estado={estado.tipo === 'pronto' ? 'ocioso' : estado.tipo} aoTentarDeNovo={recarregar} nome="o fluxo por tipo de investidor" />
      ) : !meses.length ? (
        <SemDados nome="fluxo por tipo de investidor" />
      ) : (
        <>
          <div className="tabela-bdr small" role="group" aria-label="Saldo por tipo de investidor em cada mês" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 460, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 3 }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                {TIPOS_INVESTIDOR.map(({ campo }) => (
                  <col key={campo} style={{ width: '16.8%' }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="tiny muted" style={{ textAlign: 'left', fontWeight: 400 }}>Mês</th>
                  {TIPOS_INVESTIDOR.map(({ campo, rotulo }) => (
                    <th key={campo} scope="col" className="tiny muted" style={{ textAlign: 'center', fontWeight: 400, padding: '0 2px 4px', lineHeight: 1.2 }}>{rotulo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <th scope="row" style={{ textAlign: 'left', fontWeight: 400, whiteSpace: 'nowrap' }}>{rotuloMes(m.mes)}</th>
                    {TIPOS_INVESTIDOR.map(({ campo }, i) => {
                      const v = m[campo]
                      const forca = Math.min(1, Math.abs(v) / maximo[i])
                      return (
                        <td key={campo} style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '6px 4px', borderRadius: 6, fontSize: 12, fontVariantNumeric: 'tabular-nums', background: `color-mix(in srgb, ${v < 0 ? 'var(--danger)' : 'var(--success)'} ${Math.round(forca * 45)}%, transparent)` }}>
                          {formatarMilhoes(v, false).replace('R$ ', '')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
            Valores em R$ (mi = milhões, bi = bilhões); o sinal de menos (−) indica saída. A cor é relativa ao maior valor de cada coluna. O último mês é parcial.
          </div>
          <Fonte texto={dados.fonte} atualizado={dados.geradoEm} />
        </>
      )}
    </section>
  )
}

/** Um gráfico só: barras = saldo do estrangeiro no mês (R$), linha amarela = variação do Ibovespa no mesmo mês (%). Cada série tem a sua escala, com o zero alinhado. */
export function GraficoBolsaEstrangeiro({ pares }: { pares: ParMes[] }) {
  const W = 340
  const H = 212
  const L = 6
  const R = 36
  const topo = 24
  const base = 178
  const n = pares.length
  const { p, spanA, spanB } = escalasAlinhadas(pares.map((q) => q.fluxo), pares.map((q) => q.variacao))
  const yA = (v: number) => topo + (p - v / spanA) * (base - topo)
  const yB = (v: number) => topo + (p - v / spanB) * (base - topo)
  const larg = (W - L - R) / Math.max(n, 4)
  const x = (i: number) => L + larg * (i + 0.5)
  const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
  const pctCurto = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
  const maxAbs = Math.max(...pares.map((q) => Math.abs(q.variacao)), 0.01)
  const passo = [0.01, 0.02, 0.05, 0.1, 0.2].find((s) => maxAbs / s <= 3) ?? 0.2
  const marcas: number[] = []
  for (let k = -4; k <= 4; k++) {
    const v = k * passo
    if (v <= p * spanB + 1e-9 && v >= -(1 - p) * spanB - 1e-9) marcas.push(v)
  }
  const linha = pares.map((q, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${yB(q.variacao).toFixed(1)}`).join('')
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Saldo do investidor estrangeiro (barras) e variação do Ibovespa (linha) em cada mês, de ${rotuloMes(pares[0].mes)} a ${rotuloMes(pares[n - 1].mes)}.`}
      style={{ width: '100%', height: 'auto', maxHeight: 290, display: 'block' }}
    >
      {marcas.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={yB(v)} y2={yB(v)} stroke="var(--border)" strokeWidth={v === 0 ? 1 : 0.5} strokeDasharray={v === 0 ? undefined : '2 3'} />
          <text x={W - R + 4} y={yB(v) + 3} style={{ fill: 'var(--text-muted)', fontSize: 9 }}>{v === 0 ? '0%' : pctCurto(v)}</text>
        </g>
      ))}
      {pares.map((q, i) => {
        const alt = Math.max(2, Math.abs(yA(q.fluxo) - yA(0)))
        return (
          <g key={q.mes}>
            <rect x={x(i) - larg * 0.34} y={Math.min(yA(q.fluxo), yA(0))} width={larg * 0.68} height={alt} rx={2} fill={q.fluxo < 0 ? 'var(--danger)' : 'var(--success)'} opacity={0.75} />
            <text x={x(i)} y={base + 14} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 8 }}>{rotuloMes(q.mes).split('/')[0]}</text>
            <text x={x(i)} y={base + 25} textAnchor="middle" style={{ fill: q.fluxo < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 7.5, fontWeight: 600 }}>{emBilhoes(q.fluxo)}</text>
          </g>
        )
      })}
      <path d={linha} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
      {pares.map((q, i) => (
        <g key={q.mes}>
          <circle cx={x(i)} cy={yB(q.variacao)} r={3.6} fill="var(--accent)" stroke="var(--bg, #000)" strokeWidth={1.2} />
          <text x={x(i)} y={i % 2 === 0 ? yB(q.variacao) - 7 : yB(q.variacao) + 14} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 9, fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--bg, #000)', strokeWidth: 2.5 }}>{pct(q.variacao)}</text>
        </g>
      ))}
    </svg>
  )
}

function CartaoRelacao({ fluxo }: { fluxo?: SnapshotFluxo }) {
  const [estadoF, recarregarF] = useArquivoDados<SnapshotFluxo>(CAMINHO_FLUXO, true, fluxo)
  const [estadoI, recarregarI] = useArquivoDados<{ barras: BarraIndice[] }>(CAMINHO_IBOV, true)
  const f = estadoF.tipo === 'pronto' ? estadoF.dados : null
  const i = estadoI.tipo === 'pronto' ? estadoI.dados : null
  const pares = useMemo(() => {
    if (!f || !i || !f.registros.length) return []
    const regs = semPrimeiroMesIncompleto(f.registros)
    const totais = totaisPorMes(regs, 12)
    const ate = f.registros[f.registros.length - 1].data
    return parear(totais, variacaoMensal(i.barras, totais.map((t) => t.mes), ate))
  }, [f, i])
  const r = correlacao(pares)
  const sentido = mesmoSentido(pares)

  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="titulo-relacao">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="titulo-relacao" style={{ fontSize: 17 }}>📈 Bolsa × estrangeiro</h2>
        <span className="small muted justify">As barras mostram quanto o estrangeiro pôs (verde) ou tirou (vermelho) da bolsa em cada mês. A linha amarela mostra quanto o Ibovespa subiu ou caiu no mesmo mês.</span>
      </div>
      {!f || !i ? (
        <EstadoDoArquivo estado={(() => { const t = !f ? estadoF.tipo : estadoI.tipo; return t === 'pronto' ? 'ocioso' : t })()} aoTentarDeNovo={() => { recarregarF(); recarregarI() }} nome="a relação entre a bolsa e o estrangeiro" />
      ) : pares.length < 2 ? (
        <SemDados nome="fluxo e Ibovespa" />
      ) : (
        <>
          <GraficoBolsaEstrangeiro pares={pares} />
          <div className="tiny muted row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span><span aria-hidden="true" style={{ color: 'var(--success)' }}>■</span> <span aria-hidden="true" style={{ color: 'var(--danger)' }}>■</span> barras: estrangeiro no mês (R$ bilhões)</span>
            <span><span aria-hidden="true" style={{ color: 'var(--accent)' }}>●━●</span> linha amarela: Ibovespa no mês (%, escala à direita)</span>
          </div>
          <div className="small justify" role="note" data-testid="relacao-resumo">
            Em <strong>{sentido.iguais} de {sentido.total} meses</strong> o Ibovespa andou no mesmo sentido do estrangeiro (entrou e subiu, ou saiu e caiu)
            {r !== null ? <>. Correlação de <strong>{r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> (de −1 a +1; perto de 0 é pouca relação)</> : null}.
          </div>
          <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
            Ter relação não quer dizer que um causa o outro: o estrangeiro pode comprar porque a bolsa sobe, e a bolsa pode subir porque o estrangeiro compra. O último mês é parcial. Poucos meses de histórico: leia como tendência, não como regra.
          </div>
          <Fonte texto="B3 e Dados de Mercado (fluxo), B3 (Ibovespa)" atualizado={f.geradoEm} />
        </>
      )}
    </section>
  )
}

const pctSinal = (v: number, casas = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`

/** Uma bolinha por ação: eixo horizontal = dias de volume alugado, vertical = variação do preço na janela. Vermelho = caiu mais que o Ibovespa. */
export function GraficoAluguelPreco({ pontos, ibov20 }: { pontos: RegistroAluguel[]; ibov20: number | null }) {
  const W = 340
  const H = 250
  const L = 38
  const R = 8
  const topo = 10
  const base = H - 30
  const xs = pontos.map((p) => p.diasDeVolume as number).sort((a, b) => a - b)
  const xMax = Math.max(1, Math.ceil((xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] ?? 1) * 1.05))
  const ys = pontos.map((p) => p.var20 as number)
  const yMax = Math.max(0.02, ...ys, ibov20 ?? 0)
  const yMin = Math.min(-0.02, ...ys, ibov20 ?? 0)
  const x = (v: number) => L + (Math.min(v, xMax) / xMax) * (W - L - R)
  const y = (v: number) => topo + ((yMax - v) / (yMax - yMin)) * (base - topo)
  const passo = [0.05, 0.1, 0.2, 0.25, 0.5].find((s) => (yMax - yMin) / s <= 6) ?? 0.5
  const marcas: number[] = []
  for (let v = Math.ceil(yMin / passo) * passo; v <= yMax + 1e-9; v += passo) marcas.push(+v.toFixed(4))
  const rotulados = new Set([...pontos].sort((a, b) => b.saldoFinanceiro - a.saldoFinanceiro).slice(0, 7).map((p) => p.ticker))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cada ponto é uma ação. Horizontal: dias de volume alugado. Vertical: variação do preço nos últimos 20 pregões. Ibovespa na janela: ${ibov20 === null ? 'indisponível' : pctSinal(ibov20)}.`} style={{ width: '100%', height: 'auto', maxHeight: 320, display: 'block' }}>
      {marcas.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={Math.abs(v) < 1e-9 ? 1 : 0.5} strokeDasharray={Math.abs(v) < 1e-9 ? undefined : '2 3'} />
          <text x={L - 4} y={y(v) + 3} textAnchor="end" style={{ fill: 'var(--text-muted)', fontSize: 9 }}>{Math.abs(v) < 1e-9 ? '0%' : pctSinal(v, 0)}</text>
        </g>
      ))}
      {ibov20 !== null && (
        <g>
          <line x1={L} x2={W - R} y1={y(ibov20)} y2={y(ibov20)} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={W - R} y={y(ibov20) - 4} textAnchor="end" style={{ fill: 'var(--accent)', fontSize: 9, fontWeight: 700 }}>Ibovespa {pctSinal(ibov20)}</text>
        </g>
      )}
      {pontos.map((p) => (
        <circle key={p.ticker} cx={x(p.diasDeVolume as number)} cy={y(p.var20 as number)} r={3.2} fill={ibov20 !== null && (p.var20 as number) < ibov20 ? 'var(--danger)' : 'var(--success)'} opacity={0.8} />
      ))}
      {pontos.filter((p) => rotulados.has(p.ticker)).map((p) => (
        <text key={`t-${p.ticker}`} x={x(p.diasDeVolume as number) + 5} y={y(p.var20 as number) - 4} style={{ fill: 'var(--text)', fontSize: 8, fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--bg, #000)', strokeWidth: 2.5 }}>{p.ticker}</text>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={L + f * (W - L - R)} y={base + 13} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} style={{ fill: 'var(--text-muted)', fontSize: 9 }}>{Math.round(xMax * f)}</text>
      ))}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 9 }}>dias de volume alugado →</text>
    </svg>
  )
}

function CartaoAluguelPreco({ snapshot }: { snapshot?: SnapshotAluguel }) {
  const [estado, recarregar] = useArquivoDados<SnapshotAluguel>(CAMINHO_ALUGUEL, true, snapshot)
  const dados = estado.tipo === 'pronto' ? estado.dados : null
  const ibov20 = dados?.janela?.ibov20 ?? null
  const pontos = useMemo(
    () => (dados ? dados.registros.filter((r) => typeof r.var20 === 'number' && typeof r.diasDeVolume === 'number' && r.saldoFinanceiro >= SALDO_MINIMO_COMPARACAO) : []),
    [dados],
  )
  const resumo = useMemo(() => (dados ? resumoAluguelPreco(dados.registros, ibov20) : null), [dados, ibov20])
  const lista = useMemo(() => (dados ? maisAlugadas(dados.registros.filter((r) => typeof r.var20 === 'number'), 15) : []), [dados])

  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="titulo-aluguel-preco">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="titulo-aluguel-preco" style={{ fontSize: 17 }}>🔎 Aluguel × preço</h2>
        <span className="small muted justify">As ações mais alugadas caíram mais que o mercado? O preço é dos 20 pregões que terminam no mesmo dia do aluguel.</span>
      </div>
      {!dados ? (
        <EstadoDoArquivo estado={estado.tipo === 'pronto' ? 'ocioso' : estado.tipo} aoTentarDeNovo={recarregar} nome="o aluguel e o preço das ações" />
      ) : !resumo || !resumo.universo || !dados.janela ? (
        <SemDados nome="aluguel e preço das ações" />
      ) : (
        <>
          <div className="small justify" role="note" data-testid="aluguel-preco-resumo">
            Entre as <strong>{resumo.grupo} mais alugadas</strong>, a variação mediana do preço foi de <strong>{pctSinal(resumo.medianaGrupo ?? 0)}</strong>
            {resumo.medianaDemais !== null ? <>, contra <strong>{pctSinal(resumo.medianaDemais)}</strong> das outras {resumo.universo - resumo.grupo}</> : null}. O Ibovespa variou <strong>{pctSinal(dados.janela.ibov20)}</strong> no mesmo período ({dataBR(dados.janela.de).slice(0, 5)} a {dataBR(dados.janela.ate).slice(0, 5)}). {resumo.piorQueMercado} das {resumo.grupo} caíram mais que o Ibovespa.
          </div>

          {pontos.length >= 5 && <GraficoAluguelPreco pontos={pontos} ibov20={ibov20} />}
          <div className="tiny muted row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span><span aria-hidden="true" style={{ color: 'var(--danger)' }}>●</span> caiu mais que o Ibovespa</span>
            <span><span aria-hidden="true" style={{ color: 'var(--success)' }}>●</span> caiu menos (ou subiu)</span>
            <span>dias de volume = saldo alugado ÷ volume médio diário</span>
          </div>

          <div className="tabela-bdr small" role="group" aria-label="As 15 ações mais alugadas, com o preço na janela" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 420, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 3 }}>
              <colgroup>
                <col style={{ width: '22%' }} /><col style={{ width: '19%' }} /><col style={{ width: '19%' }} /><col style={{ width: '20%' }} /><col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Ação', '% do capital', 'Dias de volume', 'Preço 20 pregões', 'vs. Ibovespa'].map((t, i) => (
                    <th key={t} scope="col" className="tiny muted" style={{ textAlign: i === 0 ? 'left' : 'center', fontWeight: 400, padding: '0 2px 4px', lineHeight: 1.2 }}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const v = r.var20 as number
                  const rel = ibov20 === null ? null : v - ibov20
                  return (
                    <tr key={r.ticker}>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 700 }}>{r.ticker}</th>
                      <td style={{ textAlign: 'center' }}>{typeof r.capital === 'number' ? `${(r.capital * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%` : '–'}</td>
                      <td style={{ textAlign: 'center' }}>{typeof r.diasDeVolume === 'number' ? r.diasDeVolume.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '–'}</td>
                      <td style={{ textAlign: 'center', color: v < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{pctSinal(v)}</td>
                      <td style={{ textAlign: 'center', color: rel === null ? undefined : rel < 0 ? 'var(--danger)' : 'var(--success)' }}>{rel === null ? '–' : `${rel > 0 ? '+' : rel < 0 ? '−' : ''}${Math.abs(rel * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pp`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
            "% do capital" é o que está alugado sobre todas as ações da empresa. "pp" = pontos percentuais acima (+) ou abaixo (−) do Ibovespa. A lista mostra as ações com saldo alugado de pelo menos R$ 50 milhões na comparação. Isto não mostra causa: o aluguel pode subir porque o preço já caiu, e boa parte do aluguel é arbitragem e proteção. Um único período, de queda geral do mercado; leia como retrato, não como regra.
          </div>
          <Fonte texto="B3 (aluguel, preço e volume)" atualizado={dados.dataReferencia ?? dados.geradoEm} />
        </>
      )}
    </section>
  )
}

function CartaoAluguel({ snapshot }: { snapshot?: SnapshotAluguel }) {
  const [estado, recarregar] = useArquivoDados<SnapshotAluguel>(CAMINHO_ALUGUEL, true, snapshot)
  const dados = estado.tipo === 'pronto' ? estado.dados : null
  const lista = useMemo(() => (dados ? maisAlugadas(dados.registros) : []), [dados])
  const pesos = useMemo(() => (dados ? pesoNoTotal(dados.registros) : new Map<string, number>()), [dados])
  const maior = lista[0]?.saldoFinanceiro ?? 1

  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="titulo-aluguel">
      <div className="col" style={{ gap: 2 }}>
        <h2 id="titulo-aluguel" style={{ fontSize: 17 }}>🔁 Ações mais alugadas</h2>
        <span className="small muted justify">
          No aluguel (empréstimo de ações), quem tem a ação empresta a quem quer vendê-la a descoberto, apostando na queda. Saldo alto indica onde há mais apostas contra a ação, mas também pode ser uso para arbitragem e proteção: não é previsão de queda.
        </span>
      </div>
      {!dados ? (
        <EstadoDoArquivo estado={estado.tipo === 'pronto' ? 'ocioso' : estado.tipo} aoTentarDeNovo={recarregar} nome="o aluguel de ações" />
      ) : !lista.length ? (
        <SemDados nome="aluguel de ações" />
      ) : (
        <>
          <ol className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Ações com maior saldo alugado">
            {lista.map((r, i) => {
              const v = r.variacaoDia
              return (
                <li key={r.ticker} className="col" style={{ gap: 3 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700 }}>{i + 1}. {r.ticker}{r.nome ? <span className="muted small" style={{ fontWeight: 400 }}> {r.nome}</span> : null}</span>
                    <span className="small">{formatarReaisCurto(r.saldoFinanceiro)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)' }} aria-hidden="true">
                    <div style={{ width: `${Math.max(2, (r.saldoFinanceiro / maior) * 100)}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }} />
                  </div>
                  <div className="tiny muted row" style={{ gap: 12, flexWrap: 'wrap' }}>
                    <span>{((pesos.get(r.ticker) ?? 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de todo o aluguel de ações</span>
                    {typeof v === 'number' && (
                      <span style={{ color: v > 0 ? 'var(--danger)' : v < 0 ? 'var(--success)' : undefined }}>
                        {v > 0 ? '▲' : v < 0 ? '▼' : '='} {Math.abs(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% no dia
                      </span>
                    )}
                    {typeof r.taxaMedia === 'number' && <span>taxa média {(r.taxaMedia * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% a.a.</span>}
                  </div>
                </li>
              )
            })}
          </ol>
          <Fonte texto={dados.fonte} atualizado={dados.dataReferencia ?? dados.geradoEm} />
        </>
      )}
    </section>
  )
}

/**
 * Aba "Dados de mercado" do Simule Ações. Cartões: investimento estrangeiro (fluxo na B3) e ações mais alugadas
 * (empréstimo de ativos), ambos do Boletim Diário do Mercado da B3. Informativo: mostra o que o mercado fez ou espera, sem recomendar compra ou venda.
 */
export function DadosDeMercado({ fluxo, aluguel }: { fluxo?: SnapshotFluxo; aluguel?: SnapshotAluguel }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      <CartaoQuem fluxo={fluxo} />
      <CartaoFluxo snapshot={fluxo} />
      <CartaoRelacao fluxo={fluxo} />
      <CartaoAluguel snapshot={aluguel} />
      <CartaoAluguelPreco snapshot={aluguel} />
      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Informação, não recomendação.</strong> Fluxo de capital e posição no aluguel descrevem o que já aconteceu; não garantem o que vai acontecer com o preço de nenhuma ação.
      </div>
    </div>
  )
}
