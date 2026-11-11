import { useMemo, useState } from 'react'
import { useArquivoDados } from '../data/useArquivoDados'
import {
  ROTULO_PERIODO, dataBR, formatarMilhoes, formatarReaisCurto, maisAlugadas, mediaMovel, pesoNoTotal, recortar, rotuloMes, sequenciaAtual, somar, totaisPorMes,
} from '../domain/dadosDeMercado'
import type { Periodo, RegistroFluxo, SnapshotAluguel, SnapshotFluxo, TotalMes } from '../domain/dadosDeMercado'
import { EstadoDoArquivo } from '../ui/BlocosDeAnalise'

export const CAMINHO_FLUXO = 'dados/fluxoEstrangeiro.json'
export const CAMINHO_ALUGUEL = 'dados/emprestimoAtivos.json'

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
            <text x={cx} y={saiu ? y(v) + Math.max(2, Math.abs(y(v) - y(0))) + 11 : y(v) - 4} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 9, fontWeight: 600 }}>{formatarMilhoes(v, false).replace('R$ ', '')}</text>
            <text x={cx} y={H - 6} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 10 }}>{rotuloMes(m.mes)}</text>
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
              <div className="tiny muted justify">Valores em R$ (mi = milhões, bi = bilhões). O último mês é parcial, até o último pregão disponível.</div>
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
                    <span>{((pesos.get(r.ticker) ?? 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total</span>
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
      <CartaoFluxo snapshot={fluxo} />
      <CartaoAluguel snapshot={aluguel} />
      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Informação, não recomendação.</strong> Fluxo de capital e posição no aluguel descrevem o que já aconteceu; não garantem o que vai acontecer com o preço de nenhuma ação.
      </div>
    </div>
  )
}
