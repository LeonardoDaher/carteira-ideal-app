import { useMemo, useState } from 'react'
import { useArquivoDados } from '../data/useArquivoDados'
import type { SnapshotFundamentos } from '../domain/analiseFundamentalista'
import type { Horizonte, SnapshotSeries } from '../domain/analiseTecnica'
import { rankingDeConfluencia } from '../domain/confluenciaRanking'
import type { ItemConfluencia } from '../domain/confluenciaRanking'
import { ROTULO_HORIZONTE } from '../domain/confluencia'
import { EstadoDoArquivo } from '../ui/BlocosDeAnalise'
import { formatarData } from '../domain/rendaFii'
import { CAMINHO_FUNDAMENTOS, CAMINHO_SERIES } from './useAnaliseDaAcao'

const TAMANHO = 15
const HORIZONTES: Horizonte[] = ['curto', 'medio', 'longo']
const AVISO =
  'Não é recomendação de investimento. Esta lista cruza duas leituras quantitativas do passado e do presente (balanços da CVM e gráfico de preços). Alinhamento entre elas não garante o futuro: o preço pode já refletir o que os números mostram. Converse com um profissional certificado antes de investir.'
const ROTULO_CONVICCAO = { alta: 'alta', media: 'média', baixa: 'baixa' } as const

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Caixa "Top 15 confluência": as ações do cadastro com maior alinhamento entre fundamentos e gráfico (positiva) ou com o pior
 * (negativa), para o horizonte escolhido. O cálculo é o da aba Confluência, feito no aparelho com os arquivos já publicados.
 */
export function Top15Confluencia({
  precoDe, nomeDe, dataPregao, horizonteInicial = 'medio', series, fundamentos,
}: {
  precoDe: (ticker: string) => number | null
  nomeDe?: (ticker: string) => string | null
  dataPregao: string
  horizonteInicial?: Horizonte
  /** Só nos testes. */
  series?: SnapshotSeries
  fundamentos?: SnapshotFundamentos
}) {
  const [horizonte, setHorizonte] = useState<Horizonte>(horizonteInicial)
  const [lado, setLado] = useState<'positivas' | 'negativas'>('positivas')
  const [verMais, setVerMais] = useState(false)
  const [s, recarregarS] = useArquivoDados<SnapshotSeries>(CAMINHO_SERIES, true, series)
  const [f, recarregarF] = useArquivoDados<SnapshotFundamentos>(CAMINHO_FUNDAMENTOS, true, fundamentos)

  const resultado = useMemo(
    () => (s.tipo === 'pronto' && f.tipo === 'pronto' ? rankingDeConfluencia({ series: s.dados, fundamentos: f.dados, precoDe, nomeDe, dataPreco: dataPregao, horizonte }) : null),
    [s, f, precoDe, nomeDe, dataPregao, horizonte],
  )

  if (s.tipo === 'erro' || f.tipo === 'erro') {
    return (
      <EstadoDoArquivo
        estado="erro"
        nome={s.tipo === 'erro' ? 'as séries de preço' : 'os fundamentos da CVM'}
        aoTentarDeNovo={() => {
          if (s.tipo === 'erro') recarregarS()
          if (f.tipo === 'erro') recarregarF()
        }}
      />
    )
  }
  if (!resultado) return <EstadoDoArquivo estado="carregando" aoTentarDeNovo={() => {}} nome="as análises" />

  const lista = resultado[lado]
  const principais = lista.slice(0, TAMANHO)
  const resto = lista.slice(TAMANHO)
  const positivas = lado === 'positivas'

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-confluencia">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>{positivas ? `As ${TAMANHO} ações com maior confluência positiva` : `As ${TAMANHO} ações com maior confluência negativa`}</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          {positivas
            ? 'Fundamentos favoráveis e gráfico a favor, da maior nota combinada para a menor.'
            : 'Fundamentos desfavoráveis e gráfico em baixa, da menor nota combinada para a maior.'}{' '}
          A nota é a média ponderada da nota fundamentalista e da técnica para o horizonte escolhido, a mesma da aba Confluência.
        </div>
        <div className="tiny muted">
          Preços até {formatarData(dataPregao)} · {resultado.avaliadas} ações avaliadas · {resultado.semAnalise} sem as duas análises · {resultado.semLiquidez} fora por liquidez baixa
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Horizonte">
        {HORIZONTES.map((h) => (
          <button key={h} className={`chip ${horizonte === h ? 'selected' : ''}`} aria-pressed={horizonte === h} onClick={() => { setHorizonte(h); setVerMais(false) }}>
            {ROTULO_HORIZONTE[h]}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Tipo de confluência">
        <button className={`chip ${positivas ? 'selected' : ''}`} aria-pressed={positivas} onClick={() => { setLado('positivas'); setVerMais(false) }}>
          Positivas ({resultado.positivas.length})
        </button>
        <button className={`chip ${!positivas ? 'selected' : ''}`} aria-pressed={!positivas} onClick={() => { setLado('negativas'); setVerMais(false) }}>
          Negativas ({resultado.negativas.length})
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="card muted small justify" role="status" data-testid="top15-confluencia-vazio">
          Nenhuma ação em confluência {positivas ? 'positiva' : 'negativa'} neste horizonte, com liquidez suficiente.
        </div>
      ) : (
        <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Ações em confluência ${positivas ? 'positiva' : 'negativa'}`}>
          {principais.map((r) => (
            <Cartao key={r.ticker} item={r} />
          ))}
        </ol>
      )}

      {resto.length > 0 && (
        <div className="card col" style={{ gap: 10 }} data-testid="top15-confluencia-ver-mais">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="small" style={{ fontWeight: 600 }}>
              {verMais ? `Continuação: posições ${TAMANHO + 1} a ${lista.length}` : `Mais ${resto.length} ${resto.length === 1 ? 'ação' : 'ações'}, até a ${lista.length}ª posição`}
            </span>
            <button className="chip" aria-expanded={verMais} onClick={() => setVerMais((v) => !v)}>
              {verMais ? 'Mostrar menos' : 'Ver mais'}
            </button>
          </div>
          {verMais && (
            <ol className="col" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Continuação do ranking de confluência">
              {resto.map((r) => (
                <Linha key={r.ticker} item={r} />
              ))}
            </ol>
          )}
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
        <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
          <li><strong>Quem entra.</strong> Ações do cadastro do app com histórico de preços suficiente (60 pregões) e fundamentos da CVM. Ações de liquidez baixa ficam de fora, porque o sinal técnico delas é menos confiável.</li>
          <li><strong>Positiva ou negativa.</strong> Positiva: os fundamentos são favoráveis e o gráfico está a favor. Negativa: os fundamentos são desfavoráveis e o gráfico está em baixa. Os demais casos (uma leitura favorável e outra neutra ou contrária) não entram.</li>
          <li><strong>A nota.</strong> Média ponderada das duas notas: curto prazo 30% fundamentos e 70% gráfico; médio 50% e 50%; longo 70% e 30%. Em empate, vence a maior convicção e depois a ordem alfabética.</li>
          <li><strong>O que esta lista não é.</strong> Não é recomendação. Confluência negativa não é sinal de venda nem de que o preço vai cair. Toque no código na aba Confluência para ver a leitura completa.</li>
        </ol>
      </details>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-confluencia-aviso">{AVISO}</div>
    </div>
  )
}

function Cartao({ item: r }: { item: ItemConfluencia }) {
  const c = r.confluencia
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`top15-confluencia-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{r.posicao}. {r.ticker}</span>
          <span className="tiny muted">{r.nome ?? '—'}</span>
        </div>
        <span style={{ fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{reais(r.preco)}</span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Nota combinada</span>
          <span style={{ fontWeight: 700 }} data-testid={`nota-${r.ticker}`}>{c.pontuacao.valor}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Fundamentos</span>
          <span style={{ fontWeight: 700 }}>{c.fundamentalista.nota ?? '—'}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Gráfico</span>
          <span style={{ fontWeight: 700 }}>{c.tecnica.nota ?? '—'}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Convicção</span>
          <span style={{ fontWeight: 700 }}>{ROTULO_CONVICCAO[c.conviccao]}</span>
        </div>
      </div>
      <div className="tiny muted">
        Fundamentos: {c.fundamentalista.rotulo} · Gráfico: {c.tecnica.rotulo}
      </div>
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>Leitura</summary>
        <div className="small muted justify" style={{ marginTop: 6, lineHeight: 1.5 }}>
          {c.leitura}
          <div style={{ marginTop: 6 }}>{c.fundamentalista.detalhe} {c.tecnica.detalhe}</div>
        </div>
      </details>
    </li>
  )
}

function Linha({ item: r }: { item: ItemConfluencia }) {
  const c = r.confluencia
  return (
    <li className="card-outline" data-testid={`top15-confluencia-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'center', gap: 10 }}>
        <div className="col" style={{ gap: 0, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.posicao}. {r.ticker}</span>
          <span className="tiny muted">{r.nome ?? '—'}</span>
        </div>
        <div className="col" style={{ gap: 0, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700 }} data-testid={`nota-${r.ticker}`}>{c.pontuacao.valor}</span>
          <span className="tiny muted">F {c.fundamentalista.nota ?? '—'} · G {c.tecnica.nota ?? '—'} · {reais(r.preco)}</span>
        </div>
      </div>
    </li>
  )
}
