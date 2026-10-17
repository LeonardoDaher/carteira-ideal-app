import { useId, useMemo, useState } from 'react'
import { SNAPSHOT_OPCOES } from '../data/snapshotOpcoes'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import {
  FILTRO_VAZIO, diasAte, faixaPerto, filtrarSeries, limitesDeStrike, moneyness, vencimentosDe,
} from '../domain/opcoes'
import type { AtivoComOpcoes, FiltroSeries, FiltroTipo, SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'
import {
  ESTRATEGIAS, analisar, curva, custoDeMontagem, faixaDoGrafico, gregasDaPosicao, montarPosicao, resultadoAntesDoVencimento,
  resultadoNoVencimento, validarEntrada, volatilidadeImplicita,
} from '../domain/simulaOpcoes'
import type { EntradaEstrategia, EstrategiaId } from '../domain/simulaOpcoes'
import { formatarData, formatarVolume } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { VoltarInicio } from '../ui/VoltarInicio'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import { CampoReais } from '../ui/CampoReais'
import { CampoNumero } from '../ui/CampoNumero'
import { GraficoPayoff } from '../ui/GraficoPayoff'
import type { AppCtx } from '../state/useAppState'

const LIMITE_LINHAS = 40
const ATALHOS_PERTO = [5, 10, 20] as const
const rotuloTipo = (t: 'call' | 'put') => (t === 'call' ? 'Call' : 'Put')
const rotuloSituacao = { dentro: 'dentro do dinheiro', no: 'no dinheiro', fora: 'fora do dinheiro' } as const

/** Dados para abrir o simulador de estratégias já preenchido com uma série real. */
interface Preenchimento {
  ativo: AtivoComOpcoes
  serie: SerieOpcao
  dias: number
  /** Próxima série do mesmo tipo e vencimento, de strike maior: dá o outro lado das travas. */
  proxima: SerieOpcao | null
}

const jurosPadrao = () => SNAPSHOT_MERCADO.indicadores?.selicMeta?.valor ?? 14

/**
 * Simule Opções. Duas abas: "Séries da B3" (calls e puts reais do último pregão, com filtro por tipo, vencimento e faixa
 * de strike) e "Estratégias" (payoff no vencimento, curva antes do vencimento e gregas). Tela descritiva, sem indicação
 * de operação: educacional.
 */
export function SimuleOpcoes({ snapshot = SNAPSHOT_OPCOES }: {
  /** Recebido como as demais telas avulsas; esta tela só volta ao hub. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job diário. */
  snapshot?: SnapshotOpcoes
}) {
  const [aba, setAba] = useState<'series' | 'estrategias'>('series')
  const [pre, setPre] = useState<(Preenchimento & { n: number }) | null>(null)

  const simular = (p: Preenchimento) => {
    setPre({ ...p, n: (pre?.n ?? 0) + 1 })
    setAba('estrategias')
  }

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule Opções</h1>
        <div className="muted small justify">
          Opções são contratos que dão o direito de comprar (call) ou vender (put) um ativo por um preço fixo (o strike) até
          uma data (o vencimento). Veja as séries reais da B3, filtre por strike e monte uma estratégia para ver quanto ela
          ganha ou perde.
        </div>
      </div>

      <AbasDaTela
        prefixo="opcoes"
        rotulo="O que você quer ver"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'series', emoji: '📋', titulo: 'Séries da B3', descricao: 'Strike, vencimento e prêmio' },
          { id: 'estrategias', emoji: '📈', titulo: 'Estratégias', descricao: 'Payoff, tempo e gregas' },
        ] as const}
      >
        {aba === 'series' ? (
          <SeriesDaB3 snapshot={snapshot} onSimular={simular} />
        ) : (
          <Estrategias key={pre?.n ?? 0} pre={pre} dataPregao={snapshot.dataPregao} />
        )}
      </AbasDaTela>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Opções têm risco alto.</strong> Quem compra pode perder todo o prêmio pago; quem vende sem ter o ativo ou uma
        trava pode perder muito mais do que recebeu. As contas ignoram corretagem, emolumentos, imposto de renda e margem de
        garantia. O prêmio mostrado é o do último negócio do dia, que pode estar longe do preço atual de compra e venda.
        Ter uma série na lista não é uma indicação de operação.
        {snapshot.geradoEm && snapshot.dataPregao
          ? ` Dados oficiais da B3 (COTAHIST) do pregão de ${formatarData(snapshot.dataPregao)}.`
          : ''}
      </div>

      <AvisoEducacional />
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// Aba 1: séries reais
// ---------------------------------------------------------------------------------------

function SeriesDaB3({ snapshot, onSimular }: { snapshot: SnapshotOpcoes; onSimular: (p: Preenchimento) => void }) {
  const [ticker, setTicker] = useState(snapshot.ativos[0]?.ticker ?? '')
  const [filtro, setFiltro] = useState<FiltroSeries>(FILTRO_VAZIO)
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const idVenc = useId()

  const ativo = snapshot.ativos.find((a) => a.ticker === ticker) ?? snapshot.ativos[0]

  const vencimentos = useMemo(() => (ativo ? vencimentosDe(ativo.series) : []), [ativo])
  const limites = useMemo(() => (ativo ? limitesDeStrike(ativo.series) : null), [ativo])
  const invertida = filtro.strikeMin !== null && filtro.strikeMax !== null && filtro.strikeMin > filtro.strikeMax
  const filtradas = useMemo(
    () => (ativo && !invertida ? filtrarSeries(ativo.series, filtro) : []),
    [ativo, filtro, invertida],
  )

  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }

  const trocarAtivo = (t: string) => {
    setTicker(t)
    setFiltro(FILTRO_VAZIO)
    setMostrarTodas(false)
  }
  const mudar = (parcial: Partial<FiltroSeries>) => {
    setFiltro((f) => ({ ...f, ...parcial }))
    setMostrarTodas(false)
  }
  const perto = (pct: number) => mudar(faixaPerto(ativo.cotacao, pct))
  const faixaAtiva = (pct: number) => {
    const f = faixaPerto(ativo.cotacao, pct)
    return filtro.strikeMin === f.strikeMin && filtro.strikeMax === f.strikeMax
  }
  const temFiltroDeStrike = filtro.strikeMin !== null || filtro.strikeMax !== null

  const visiveis = mostrarTodas ? filtradas : filtradas.slice(0, LIMITE_LINHAS)

  const simular = (serie: SerieOpcao) => {
    const proxima = ativo.series
      .filter((s) => s.tipo === serie.tipo && s.vencimento === serie.vencimento && s.strike > serie.strike)
      .sort((a, b) => a.strike - b.strike)[0] ?? null
    onSimular({ ativo, serie, dias: Math.max(diasAte(serie.vencimento, snapshot.dataPregao ?? serie.vencimento), 1), proxima })
  }

  return (
    <>
      <div className="col" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>Ativo</span>
        <div className="grade-tickers" role="group" aria-label="Ativos com opções">
          {snapshot.ativos.map((a) => (
            <button
              key={a.ticker}
              className={`chip ${a.ticker === ativo.ticker ? 'selected' : ''}`}
              aria-pressed={a.ticker === ativo.ticker}
              onClick={() => trocarAtivo(a.ticker)}
            >
              {a.ticker}
            </button>
          ))}
        </div>
        <div className="tiny muted">
          {ativo.ticker}: {reais(ativo.cotacao)} no fechamento. Opções negociam {formatarVolume(ativo.volumeOpcoes)} por dia.
        </div>
      </div>

      <div className="card col" style={{ gap: 12 }} aria-label="Filtros das séries">
        <span style={{ fontWeight: 700 }}>Filtros</span>

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tipo de opção">
          {([['todas', 'Calls e puts'], ['call', 'Só calls'], ['put', 'Só puts']] as [FiltroTipo, string][]).map(([v, nome]) => (
            <button key={v} className={`chip ${filtro.tipo === v ? 'selected' : ''}`} aria-pressed={filtro.tipo === v} onClick={() => mudar({ tipo: v })}>
              {nome}
            </button>
          ))}
        </div>

        <div className="col" style={{ gap: 4 }}>
          <label htmlFor={idVenc} className="small" style={{ fontWeight: 600 }}>Vencimento</label>
          <select id={idVenc} className="input-cotas" value={filtro.vencimento} onChange={(e) => mudar({ vencimento: e.target.value })}>
            <option value="">Todos os vencimentos</option>
            {vencimentos.map((v) => (
              <option key={v} value={v}>{formatarData(v)}</option>
            ))}
          </select>
        </div>

        <div className="col" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Faixa de strike</span>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px' }}>
              <CampoReais
                key={`min-${filtro.strikeMin ?? 'x'}`}
                rotulo="Strike mínimo"
                valor={filtro.strikeMin ?? 0}
                onMudar={(v) => mudar({ strikeMin: v > 0 ? v : null })}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <CampoReais
                key={`max-${filtro.strikeMax ?? 'x'}`}
                rotulo="Strike máximo"
                valor={filtro.strikeMax ?? 0}
                onMudar={(v) => mudar({ strikeMax: v > 0 ? v : null })}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Atalhos de strike">
            {ATALHOS_PERTO.map((pct) => (
              <button key={pct} className={`chip ${faixaAtiva(pct) ? 'selected' : ''}`} aria-pressed={faixaAtiva(pct)} onClick={() => perto(pct)}>
                Perto do preço (±{pct}%)
              </button>
            ))}
            {(temFiltroDeStrike || filtro.tipo !== 'todas' || filtro.vencimento) && (
              <button className="chip" onClick={() => { setFiltro(FILTRO_VAZIO); setMostrarTodas(false) }}>Limpar filtros</button>
            )}
          </div>
          {limites && (
            <span className="tiny muted">Strikes disponíveis para {ativo.ticker}: de {reais(limites.min)} a {reais(limites.max)}.</span>
          )}
        </div>
      </div>

      <div className="col" style={{ gap: 6 }} aria-live="polite">
        <span className="small" style={{ fontWeight: 600 }}>
          {invertida
            ? 'O strike mínimo é maior que o máximo.'
            : `${filtradas.length} ${filtradas.length === 1 ? 'série' : 'séries'} de ${ativo.ticker}`}
        </span>

        {!invertida && filtradas.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhuma série nessa faixa.</strong>{' '}
            <span className="muted">Só entram séries com negócios no último pregão. Amplie a faixa de strike ou escolha outro vencimento.</span>
          </div>
        )}

        {visiveis.length > 0 && (
          <div className="col" style={{ gap: 0 }}>
            {visiveis.map((s) => (
              <LinhaSerie key={s.codigo} serie={s} cotacao={ativo.cotacao} onSimular={() => simular(s)} />
            ))}
          </div>
        )}

        {!mostrarTodas && filtradas.length > LIMITE_LINHAS && (
          <button className="chip" onClick={() => setMostrarTodas(true)}>
            Mostrar as {filtradas.length - LIMITE_LINHAS} restantes
          </button>
        )}
      </div>
    </>
  )
}

function LinhaSerie({ serie, cotacao, onSimular }: { serie: SerieOpcao; cotacao: number; onSimular: () => void }) {
  const situacao = moneyness(serie.tipo, serie.strike, cotacao)
  return (
    <div className="tabela-bdr small" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8 }} data-testid="serie-opcao">
      <span className="col" style={{ gap: 1, minWidth: 0 }}>
        <span>
          <strong>{serie.codigo}</strong> <span className="muted">{rotuloTipo(serie.tipo)}, strike</span> <strong>{reais(serie.strike)}</strong>
        </span>
        <span className="tiny muted">
          vence {formatarData(serie.vencimento)}, {rotuloSituacao[situacao]}, {serie.negocios} negócios
        </span>
        <span className="tiny">
          Prêmio <strong>{reais(serie.premio)}</strong>
        </span>
      </span>
      <button className="chip" onClick={onSimular} aria-label={`Simular estratégia com ${serie.codigo}`}>Simular</button>
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// Aba 2: estratégias
// ---------------------------------------------------------------------------------------

const DEFAULT: EntradaEstrategia = { estrategia: 'compraCall', precoAtivo: 30, strikeBaixo: 30, premioBaixo: 1.5, strikeAlto: 33, premioAlto: 0.6, quantidade: 100 }

const infoEstrategia = (id: EstrategiaId) => ESTRATEGIAS.find((e) => e.id === id)!

function entradaInicial(pre: Preenchimento | null): EntradaEstrategia {
  if (!pre) return DEFAULT
  const { ativo, serie, proxima } = pre
  const alto = proxima ?? { strike: Math.round(serie.strike * 1.1 * 100) / 100, premio: Math.max(Math.round(serie.premio * 0.5 * 100) / 100, 0.01) }
  return {
    estrategia: serie.tipo === 'call' ? 'compraCall' : 'compraPut',
    precoAtivo: ativo.cotacao,
    strikeBaixo: serie.strike,
    premioBaixo: serie.premio,
    strikeAlto: alto.strike,
    premioAlto: alto.premio,
    quantidade: 100,
  }
}

function Estrategias({ pre, dataPregao }: { pre: Preenchimento | null; dataPregao: string | null }) {
  const [e, setE] = useState<EntradaEstrategia>(() => entradaInicial(pre))
  const [dias, setDias] = useState(pre?.dias ?? 30)
  const [juros, setJuros] = useState(jurosPadrao)
  const [vol, setVol] = useState(() => {
    if (!pre) return 35
    const v = volatilidadeImplicita(
      { tipo: pre.serie.tipo, s: pre.ativo.cotacao, strike: pre.serie.strike, t: Math.max(pre.dias, 1) / 365, r: Math.log(1 + jurosPadrao() / 100) },
      pre.serie.premio,
    )
    return v ? Math.round(v * 1000) / 10 : 35
  })
  const [diasPassados, setDiasPassados] = useState(0)

  const info = infoEstrategia(e.estrategia)
  const mudar = (parcial: Partial<EntradaEstrategia>) => setE((x) => ({ ...x, ...parcial }))
  const erro = validarEntrada(e)

  const r = Math.log(1 + juros / 100)
  const mercado = { dias: Math.max(dias, 0), r, sigma: vol / 100 }
  const passados = Math.min(diasPassados, mercado.dias)

  const volImplicita = useMemo(() => {
    if (erro || dias <= 0) return null
    const p = montarPosicao(e)
    const perna = p.pernas[0]
    const v = volatilidadeImplicita({ tipo: perna.tipo, s: e.precoAtivo, strike: perna.strike, t: dias / 365, r }, perna.premio)
    return v ? Math.round(v * 1000) / 10 : null
  }, [e, erro, dias, r])

  const dados = useMemo(() => {
    if (erro) return null
    const posicao = montarPosicao(e)
    const faixa = faixaDoGrafico(posicao, e.precoAtivo)
    const analise = analisar(posicao)
    const noVenc = curva((s) => resultadoNoVencimento(posicao, s), faixa.min, faixa.max)
    const antes = passados < mercado.dias && vol > 0
      ? curva((s) => resultadoAntesDoVencimento(posicao, s, mercado, passados), faixa.min, faixa.max)
      : null
    const g = vol > 0 && mercado.dias - passados > 0 ? gregasDaPosicao(posicao, e.precoAtivo, mercado, passados) : null
    return {
      posicao, analise, noVenc, antes, g,
      custo: custoDeMontagem(posicao),
      hoje: antes ? resultadoAntesDoVencimento(posicao, e.precoAtivo, mercado, passados) : resultadoNoVencimento(posicao, e.precoAtivo),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e, erro, passados, dias, juros, vol])

  const rotuloCurva = passados === 0 ? 'Hoje' : `Daqui a ${passados} ${passados === 1 ? 'dia' : 'dias'}`
  const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <>
      {pre && (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Preenchido com a série <strong>{pre.serie.codigo}</strong> ({rotuloTipo(pre.serie.tipo)}, strike {reais(pre.serie.strike)},
          vencimento {formatarData(pre.serie.vencimento)}) do pregão de {dataPregao ? formatarData(dataPregao) : 'último dia'}. Você pode alterar qualquer campo.
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>Estratégia</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Estratégia">
          {ESTRATEGIAS.map((x) => (
            <button key={x.id} className={`chip ${e.estrategia === x.id ? 'selected' : ''}`} aria-pressed={e.estrategia === x.id} onClick={() => { mudar({ estrategia: x.id }); setDiasPassados(0) }}>
              {x.titulo}
            </button>
          ))}
        </div>
        <span className="small muted justify">{info.descricao}</span>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Dados da operação</span>
        <CampoReais rotulo="Preço do ativo hoje" valor={e.precoAtivo} onMudar={(v) => mudar({ precoAtivo: v })} />
        {info.doisStrikes ? (
          <>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Strike menor" valor={e.strikeBaixo} onMudar={(v) => mudar({ strikeBaixo: v })} /></div>
              <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Prêmio do strike menor" valor={e.premioBaixo} onMudar={(v) => mudar({ premioBaixo: v })} /></div>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Strike maior" valor={e.strikeAlto} onMudar={(v) => mudar({ strikeAlto: v })} /></div>
              <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Prêmio do strike maior" valor={e.premioAlto} onMudar={(v) => mudar({ premioAlto: v })} /></div>
            </div>
          </>
        ) : (
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Strike" valor={e.strikeBaixo} onMudar={(v) => mudar({ strikeBaixo: v })} /></div>
            <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Prêmio por opção" valor={e.premioBaixo} onMudar={(v) => mudar({ premioBaixo: v })} /></div>
          </div>
        )}
        <CampoNumero rotulo="Quantidade de opções" valor={e.quantidade} onMudar={(v) => mudar({ quantidade: v })} sufixo="opções" casas={0} dica="O lote padrão da B3 é de 100." />
        <CampoNumero rotulo="Dias até o vencimento" valor={dias} onMudar={(v) => { setDias(v); setDiasPassados(0) }} sufixo="dias" casas={0} />

        <details>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Volatilidade e juros (curva do tempo e gregas)</summary>
          <div className="col" style={{ gap: 10, marginTop: 10 }}>
            <CampoNumero rotulo="Volatilidade do ativo" valor={vol} onMudar={setVol} sufixo="% a.a." casas={1} />
            {volImplicita !== null && (
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tiny muted">Volatilidade implícita no prêmio digitado: <strong>{volImplicita.toLocaleString('pt-BR')}% a.a.</strong></span>
                <button className="chip" onClick={() => setVol(volImplicita)}>Usar essa</button>
              </div>
            )}
            <CampoNumero rotulo="Juro livre de risco" valor={juros} onMudar={setJuros} sufixo="% a.a." casas={2} dica="Parte da Selic meta atual; serve só para precificar antes do vencimento." />
          </div>
        </details>
      </div>

      {erro || !dados ? (
        <div className="card-outline small justify" role="status">
          <strong>Falta preencher:</strong> <span className="muted">{erro}</span>
        </div>
      ) : (
        <div id="resultado-opcoes" className="card col" style={{ gap: 14, scrollMarginTop: 12 }} aria-live="polite">
          <span style={{ fontWeight: 700 }}>{info.titulo} no vencimento</span>

          <div className="row" style={{ gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
              <span className="tiny muted">Ganho máximo</span>
              <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="ganho-maximo">{dados.analise.ganhoMaximo === null ? 'Sem limite' : dinheiro(dados.analise.ganhoMaximo)}</span>
            </div>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
              <span className="tiny muted">Perda máxima</span>
              <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="perda-maxima">{dados.analise.perdaMaxima === null ? 'Sem limite' : dinheiro(dados.analise.perdaMaxima)}</span>
            </div>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
              <span className="tiny muted">Ponto de equilíbrio</span>
              <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="equilibrio">
                {dados.analise.equilibrios.length ? dados.analise.equilibrios.map((v) => reais(v)).join(' e ') : '—'}
              </span>
            </div>
          </div>

          <div className="tiny muted justify">
            {dados.custo >= 0 ? 'Crédito' : 'Débito'} ao montar as opções: <strong>{reais(Math.abs(dados.custo))}</strong>
            {dados.custo >= 0 ? ' (você recebe o prêmio).' : ' (você paga o prêmio).'}
            {e.estrategia === 'vendaCoberta' ? ` Precisa ter ${e.quantidade.toLocaleString('pt-BR')} ações do ativo, compradas a ${reais(e.precoAtivo)}.` : ''}
          </div>

          <div style={{ width: '100%', maxWidth: 560, marginInline: 'auto' }}>
            <GraficoPayoff
              curvas={[
                { rotulo: 'No vencimento', pontos: dados.noVenc, principal: true },
                ...(dados.antes ? [{ rotulo: rotuloCurva, pontos: dados.antes }] : []),
              ]}
              precoAtivo={e.precoAtivo}
              equilibrios={dados.analise.equilibrios}
              descricao={`Lucro e prejuízo da ${info.titulo.toLowerCase()} por preço do ativo no vencimento. Ganho máximo ${dados.analise.ganhoMaximo === null ? 'sem limite' : dinheiro(dados.analise.ganhoMaximo)}, perda máxima ${dados.analise.perdaMaxima === null ? 'sem limite' : dinheiro(dados.analise.perdaMaxima)}.`}
            />
          </div>
          <div className="row tiny muted" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span>━ No vencimento</span>
            {dados.antes && <span style={{ color: 'var(--grafico-ipca)' }}>┅ {rotuloCurva}</span>}
            <span>┆ Preço de hoje</span>
            <span>○ Equilíbrio</span>
          </div>

          {mercado.dias > 0 && vol > 0 && (
            <div className="col" style={{ gap: 6 }}>
              <label htmlFor="dias-passados" className="small" style={{ fontWeight: 600 }}>
                Passagem do tempo: daqui a {passados} {passados === 1 ? 'dia' : 'dias'} (faltariam {mercado.dias - passados})
              </label>
              <input
                id="dias-passados"
                type="range"
                min={0}
                max={mercado.dias}
                value={passados}
                onChange={(ev) => setDiasPassados(Number(ev.target.value))}
                style={{ width: '100%' }}
              />
              <span className="tiny muted justify">
                A linha tracejada mostra o resultado se o ativo estiver em cada preço nesse dia, ainda antes do vencimento.
                Com o ativo parado, quem comprou opção perde valor com o tempo; quem vendeu ganha.
              </span>
              {dados.antes && (
                <span className="small">Com o ativo em {reais(e.precoAtivo)}, o resultado nesse dia seria <strong>{dinheiro(dados.hoje)}</strong>.</span>
              )}
            </div>
          )}

          {dados.g && (
            <div className="col" style={{ gap: 0 }}>
              <span className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Gregas da posição{passados > 0 ? ` (daqui a ${passados} dias)` : ' (hoje)'}</span>
              <div className="tabela-bdr small"><span className="muted">Delta (variação por R$ 1 no ativo)</span><span style={{ fontWeight: 700 }} data-testid="delta">{dados.g.delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span></div>
              <div className="tabela-bdr small"><span className="muted">Gama (variação do delta por R$ 1)</span><span style={{ fontWeight: 700 }}>{dados.g.gama.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span></div>
              <div className="tabela-bdr small"><span className="muted">Teta (por dia que passa)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.teta)}</span></div>
              <div className="tabela-bdr small"><span className="muted">Vega (por +1 ponto de volatilidade)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.vega)}</span></div>
            </div>
          )}

          <span className="tiny muted justify">
            A curva antes do vencimento e as gregas usam o modelo de Black-Scholes (opção europeia, sem dividendos), uma
            aproximação: opções de ações na B3 podem ser exercidas antes do vencimento. No vencimento, o resultado é exato.
          </span>
        </div>
      )}
    </>
  )
}
