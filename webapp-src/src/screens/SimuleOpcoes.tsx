import { useEffect, useId, useMemo, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import {
  FILTRO_VAZIO, diasUteis, expandirSnapshot, faixaPerto, filtrarSeries, limitarAosProximosMeses, limitesDeStrike, montarLinha,
  ordenarLinhas, strikesDistintos, tipoVencimento, vencimentosDe,
} from '../domain/opcoes'
import type { AtivoComOpcoes, ChaveOrdem, EscolhaDeSeries, FiltroEstilo, FiltroSeries, FiltroTipo, LinhaOpcao, Ordem, SnapshotOpcoes } from '../domain/opcoes'
import {
  DIAS_UTEIS_ANO, ESTRATEGIAS, analisar, curva, custoDeMontagem, faixaDoGrafico, gregasDaPosicao, montarPosicao,
  resultadoAntesDoVencimento, resultadoNoVencimento, validarEntrada, volatilidadeImplicita,
} from '../domain/simulaOpcoes'
import type { EntradaEstrategia, EstrategiaId, Lado, Perna, Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { VoltarInicio } from '../ui/VoltarInicio'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import { CampoReais } from '../ui/CampoReais'
import { CampoNumero } from '../ui/CampoNumero'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { GraficosOpcoes } from './GraficosOpcoes'
import { PorVisaoOpcoes } from './PorVisaoOpcoes'
import { TopPremiosOpcoes } from './TopPremiosOpcoes'
import { FaixaDeStrike } from '../ui/FaixaDeStrike'
import { GraficoPayoff } from '../ui/GraficoPayoff'
import { MarcaDaLinha } from '../ui/GraficoPorStrike'
import type { AppCtx } from '../state/useAppState'

type Aba = 'series' | 'premios' | 'visao' | 'graficos' | 'estrategias'

/** Abas que, ao abrir, criam uma entrada no histórico: o "voltar" do navegador as fecha em vez de sair da tela. */
const ABAS_COM_HISTORICO: Aba[] = ['premios', 'visao', 'graficos', 'estrategias']

const LINHAS_POR_PAGINA = 100
const ATALHOS_PERTO = [5, 10, 20] as const

const num = (v: number | null, casas = 2) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))
const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const rotuloTipo = (t: 'call' | 'put') => (t === 'call' ? 'CALL' : 'PUT')


type EstadoDados = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; dados: SnapshotOpcoes }

/** Carrega o arquivo de séries (dados/opcoes.json, publicado pelo job diário). Nos testes, os dados vêm por prop. */
function useSnapshot(injetado?: SnapshotOpcoes): [EstadoDados, () => void] {
  const [estado, setEstado] = useState<EstadoDados>(injetado ? { tipo: 'pronto', dados: injetado } : { tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (injetado) return
    let vivo = true
    fetch(new URL('dados/opcoes.json', document.baseURI))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((json) => vivo && setEstado({ tipo: 'pronto', dados: expandirSnapshot(json) }))
      .catch(() => vivo && setEstado({ tipo: 'erro' }))
    return () => {
      vivo = false
    }
  }, [injetado, tentativa])

  return [
    estado,
    () => {
      setEstado({ tipo: 'carregando' })
      setTentativa((n) => n + 1)
    },
  ]
}

/**
 * Simule Opções. Duas abas: "Séries da B3" (todas as opções de ações e ETFs com negócio nos últimos pregões, em tabela
 * ordenável, com filtro por tipo, estilo, vencimentos e faixa de strike) e "Estratégias" (payoff no vencimento, curva
 * antes do vencimento e gregas). Tela descritiva, sem indicação de operação: educacional.
 */
export function SimuleOpcoes({ snapshot, endividadas, carregarBaratas, armazenamento }: {
  /** Recebido como as demais telas avulsas; esta tela só volta ao hub. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, vem do arquivo gerado pelo job diário. */
  snapshot?: SnapshotOpcoes
  /** Injetáveis nos testes: lista das mais endividadas, leitura do Top 15 mais baratas e armazenamento do código. */
  endividadas?: ComponentProps<typeof TopPremiosOpcoes>['endividadas']
  carregarBaratas?: ComponentProps<typeof TopPremiosOpcoes>['carregarBaratas']
  armazenamento?: ComponentProps<typeof TopPremiosOpcoes>['armazenamento']
}) {
  const [estado, recarregar] = useSnapshot(snapshot)
  const [aba, setAba] = useState<Aba>('series')
  const [escolha, setEscolha] = useState<(EscolhaDeSeries & { n: number }) | null>(null)
  const [ticker, setTicker] = useState('')

  // Voltar (botão do navegador ou do celular) a partir das estratégias leva às séries, e não para fora da tela: abrir as
  // estratégias cria uma entrada no histórico, e o popstate devolve a aba.
  useEffect(() => {
    if (window.history.state?.opcoesAba) window.history.replaceState(null, '')
    const aoVoltar = () => {
      const guardada = window.history.state?.opcoesAba
      setAba(ABAS_COM_HISTORICO.includes(guardada) ? guardada : 'series')
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  // `empilhar`: abrir as estratégias a partir de uma linha cria uma entrada no histórico (o "voltar" volta de onde veio);
  // trocar de aba pelas caixinhas só troca a entrada atual.
  const irPara = (nova: Aba, empilhar = false) => {
    if (nova === aba) return
    if (nova === 'series') {
      if (window.history.state?.opcoesAba) window.history.back() // o popstate troca a aba
      else setAba('series')
      return
    }
    if (aba === 'series' || empilhar) window.history.pushState({ opcoesAba: nova }, '')
    else window.history.replaceState({ opcoesAba: nova }, '')
    setAba(nova)
  }

  const dados = estado.tipo === 'pronto' ? estado.dados : null
  // Só vencimentos dos próximos 6 meses: o resto (opções muito longas) fica fora da tela.
  const limitado = useMemo(() => (dados ? limitarAosProximosMeses(dados) : null), [dados])

  const ativoAtual = limitado ? (limitado.ativos.find((a) => a.ticker === ticker) ?? limitado.ativos[0] ?? null) : null

  /** Mostra o conteúdo quando os dados chegaram, ou o aviso de carregando ou de erro. */
  const comDados = (conteudo: (d: SnapshotOpcoes) => ReactNode) =>
    limitado ? (
      conteudo(limitado)
    ) : estado.tipo === 'erro' ? (
      <div className="card col" style={{ gap: 8 }} role="alert">
        <span style={{ fontWeight: 700 }}>Não consegui carregar as séries agora.</span>
        <span className="muted small justify">Confira a conexão e tente de novo.</span>
        <button className="chip" onClick={recarregar} style={{ alignSelf: 'flex-start' }}>Tentar de novo</button>
      </div>
    ) : (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Carregando as séries da B3…</span>
      </div>
    )

  const criarEstrategia = (e: EscolhaDeSeries) => {
    setEscolha({ ...e, n: (escolha?.n ?? 0) + 1 })
    irPara('estrategias', true)
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
        aoMudar={irPara}
        abas={[
          { id: 'series', emoji: '📋', titulo: 'Séries da B3', descricao: 'Strike, vencimento e prêmio' },
          { id: 'premios', emoji: '🏆', titulo: 'Top 15 prêmios', descricao: 'Quem paga mais' },
          { id: 'visao', emoji: '🧭', titulo: 'Por visão', descricao: 'Alta, baixa, lateral' },
          { id: 'graficos', emoji: '📊', titulo: 'Gráficos', descricao: 'Negócios por strike' },
          { id: 'estrategias', emoji: '📈', titulo: 'Estratégias', descricao: 'Payoff, tempo e gregas' },
        ] as const}
      >
        {aba === 'series' ? (
          comDados((d) => <SeriesDaB3 snapshot={d} ativo={ativoAtual} onEscolher={setTicker} onCriar={criarEstrategia} />)
        ) : aba === 'graficos' ? (
          comDados((d) => <GraficosOpcoes snapshot={d} ativo={ativoAtual} onEscolher={setTicker} />)
        ) : aba === 'visao' ? (
          comDados((d) => <PorVisaoOpcoes snapshot={d} ativo={ativoAtual} onEscolher={setTicker} onSimular={criarEstrategia} />)
        ) : aba === 'premios' ? (
          comDados((d) => (
            <TopPremiosOpcoes snapshot={d} onSimular={criarEstrategia} endividadas={endividadas} carregarBaratas={carregarBaratas} armazenamento={armazenamento} />
          ))
        ) : (
          <Estrategias key={escolha?.n ?? 0} escolha={escolha} ativoAtual={ativoAtual} dataPregao={dados?.dataPregao ?? null} aoVoltar={() => irPara('series')} />
        )}
      </AbasDaTela>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Opções têm risco alto.</strong> Quem compra pode perder todo o prêmio pago; quem vende sem ter o ativo ou uma
        trava pode perder muito mais do que recebeu, e a B3 exige margem de garantia. As contas ignoram corretagem,
        emolumentos e imposto de renda. O preço mostrado é o do último negócio de cada série, que pode estar longe do preço
        atual de compra e venda. Ter uma série na lista não é uma indicação de operação.
        {dados?.dataPregao ? ` Dados oficiais da B3 (cadastro de instrumentos e COTAHIST) até o pregão de ${formatarData(dados.dataPregao)}.` : ''}
      </div>

      <AvisoEducacional />
    </div>
  )
}

// ---------------------------------------------------------------------------------------
// Aba 1: séries reais
// ---------------------------------------------------------------------------------------

function SeriesDaB3({ snapshot, ativo, onEscolher, onCriar }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes | null; onEscolher: (t: string) => void; onCriar: (e: EscolhaDeSeries) => void }) {
  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }
  // `key` zera filtros, ordem e seleção ao trocar de ativo.
  return (
    <>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <TabelaDoAtivo key={ativo.ticker} snapshot={snapshot} ativo={ativo} onCriar={onCriar} />
    </>
  )
}

const COLUNAS: { chave: ChaveOrdem; titulo: string; ajuda?: string }[] = [
  { chave: 'codigo', titulo: 'Ticker' },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'estilo', titulo: 'Mod.', ajuda: 'A = americana (exercício a qualquer momento), E = europeia (só no vencimento)' },
  { chave: 'strike', titulo: 'Strike' },
  { chave: 'situacao', titulo: 'A/I/OTM', ajuda: 'ATM no dinheiro, ITM dentro do dinheiro, OTM fora do dinheiro' },
  { chave: 'distanciaStrike', titulo: 'Dist. (%) do strike', ajuda: 'Strike em relação ao preço do ativo' },
  { chave: 'ultimo', titulo: 'Último' },
  { chave: 'variacao', titulo: 'Var. (%)', ajuda: 'Contra o fechamento anterior da série, quando ela negociou antes' },
  { chave: 'dataUltimo', titulo: 'Data' },
  { chave: 'negocios', titulo: 'Núm. de neg.' },
  { chave: 'volume', titulo: 'Vol. financeiro' },
  { chave: 'volImplicita', titulo: 'Vol. impl. (%)', ajuda: 'Volatilidade implícita no último preço, por Black-Scholes (estimativa nossa)' },
  { chave: 'delta', titulo: 'Delta' },
  { chave: 'gama', titulo: 'Gama' },
  { chave: 'tetaReais', titulo: 'Teta ($)', ajuda: 'Valor que a opção perde por dia útil, com o resto igual' },
  { chave: 'tetaPct', titulo: 'Teta (%)' },
]

const corVar = (v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? 'var(--mc-pos)' : 'var(--danger)')

function TabelaDoAtivo({ snapshot, ativo, onCriar }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes; onCriar: (e: EscolhaDeSeries) => void }) {
  const hoje = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])
  const limites = useMemo(() => limitesDeStrike(ativo.series), [ativo])
  const strikes = useMemo(() => strikesDistintos(ativo.series), [ativo])
  const mensais = useMemo(() => vencimentos.filter((v) => tipoVencimento(v) === 'mensal'), [vencimentos])
  const semanais = useMemo(() => vencimentos.filter((v) => tipoVencimento(v) === 'semanal'), [vencimentos])
  const [filtro, setFiltro] = useState<FiltroSeries>({ ...FILTRO_VAZIO, vencimentos: vencimentos.slice(0, 1) })
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'strike', direcao: 'asc' })
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [mostradas, setMostradas] = useState(LINHAS_POR_PAGINA)
  const idEstilo = useId()

  const invertida = filtro.strikeMin !== null && filtro.strikeMax !== null && filtro.strikeMin > filtro.strikeMax
  const filtradas = useMemo(
    () => (invertida ? [] : filtrarSeries(ativo.series, filtro, snapshot.dataPregao)),
    [ativo, filtro, invertida, snapshot.dataPregao],
  )
  const juros = jurosPadrao()
  const linhas = useMemo(() => {
    const calculadas = filtradas.map((s) => montarLinha(s, ativo.cotacao, hoje, juros))
    return ordenarLinhas(calculadas, ordem)
  }, [filtradas, ativo.cotacao, hoje, juros, ordem])

  const mudar = (parcial: Partial<FiltroSeries>) => {
    setFiltro((f) => ({ ...f, ...parcial }))
    setMostradas(LINHAS_POR_PAGINA)
  }
  const alternarVencimento = (v: string) =>
    mudar({ vencimentos: filtro.vencimentos.includes(v) ? filtro.vencimentos.filter((x) => x !== v) : [...filtro.vencimentos, v].sort() })
  const perto = (pct: number) => mudar(faixaPerto(ativo.cotacao, pct))
  const faixaAtiva = (pct: number) => {
    const f = faixaPerto(ativo.cotacao, pct)
    return filtro.strikeMin === f.strikeMin && filtro.strikeMax === f.strikeMax
  }
  const ordenarPor = (chave: ChaveOrdem) =>
    setOrdem((o) => (o.chave === chave ? { chave, direcao: o.direcao === 'asc' ? 'desc' : 'asc' } : { chave, direcao: 'asc' }))
  const alternarSelecao = (codigo: string) =>
    setSelecionadas((s) => (s.includes(codigo) ? s.filter((c) => c !== codigo) : [...s, codigo]))
  const escolhidas = ativo.series.filter((s) => selecionadas.includes(s.codigo))
  const temFiltro =
    filtro.tipo !== 'todas' || filtro.estilo !== 'todos' || filtro.strikeMin !== null || filtro.strikeMax !== null ||
    filtro.soUltimoPregao || filtro.vencimentos.length !== 1 || filtro.vencimentos[0] !== vencimentos[0]

  const visiveis = linhas.slice(0, mostradas)

  return (
    <>
      <div className="card col" style={{ gap: 12 }} role="group" aria-label="Filtros das séries">
        <span style={{ fontWeight: 700 }}>Filtros</span>

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tipo de opção">
          {([['todas', 'Calls e puts'], ['call', 'Só calls'], ['put', 'Só puts']] as [FiltroTipo, string][]).map(([v, nome]) => (
            <button key={v} className={`chip ${filtro.tipo === v ? 'selected' : ''}`} aria-pressed={filtro.tipo === v} onClick={() => mudar({ tipo: v })}>
              {nome}
            </button>
          ))}
        </div>

        <div className="col" style={{ gap: 6 }}>
          <span id={idEstilo} className="small" style={{ fontWeight: 600 }}>Modelo (exercício)</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-labelledby={idEstilo}>
            {([['todos', 'Todas'], ['americana', 'Americanas'], ['europeia', 'Europeias']] as [FiltroEstilo, string][]).map(([v, nome]) => (
              <button key={v} className={`chip ${filtro.estilo === v ? 'selected' : ''}`} aria-pressed={filtro.estilo === v} onClick={() => mudar({ estilo: v })}>
                {nome}
              </button>
            ))}
          </div>
          <span className="tiny muted">Americana pode ser exercida a qualquer momento até o vencimento; europeia, só no vencimento.</span>
        </div>

        <fieldset className="col" style={{ gap: 8, border: 'none', padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>Vencimentos (próximos 6 meses)</legend>
          {([['mensal', 'Mensais (terceira sexta-feira)', mensais], ['semanal', 'Semanais', semanais]] as const).map(([grupo, titulo, lista]) =>
            lista.length > 0 && (
              <div key={grupo} className="col" style={{ gap: 6 }} role="group" aria-label={`Vencimentos ${grupo === 'mensal' ? 'mensais' : 'semanais'}`}>
                <span className="tiny muted">{titulo}</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {lista.map((v) => {
                    const marcado = filtro.vencimentos.includes(v)
                    return (
                      <label key={v} className={`chip ${marcado ? 'selected' : ''}`} style={{ cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" checked={marcado} onChange={() => alternarVencimento(v)} style={{ accentColor: 'currentColor' }} />
                        {formatarData(v)} ({diasUteis(v, hoje)} d.u.)
                      </label>
                    )
                  })}
                </div>
              </div>
            ),
          )}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="chip" onClick={() => mudar({ vencimentos: [...mensais] })}>Só mensais</button>
            <button className="chip" onClick={() => mudar({ vencimentos: [...semanais] })} disabled={semanais.length === 0}>Só semanais</button>
            <button className="chip" onClick={() => mudar({ vencimentos: [...vencimentos] })}>Todos os vencimentos</button>
            <button className="chip" onClick={() => mudar({ vencimentos: [] })}>Nenhum (mostra todos)</button>
          </div>
        </fieldset>

        <div className="col" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Faixa de strike</span>
          <FaixaDeStrike strikes={strikes} min={filtro.strikeMin} max={filtro.strikeMax} onMudar={mudar} />
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px' }}>
              <CampoReais
                rotulo="Strike mínimo"
                valor={filtro.strikeMin ?? 0}
                onMudar={(v) => mudar({ strikeMin: v > 0 ? v : null })}
              />
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <CampoReais
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
            {(filtro.strikeMin !== null || filtro.strikeMax !== null) && (
              <button className="chip" onClick={() => mudar({ strikeMin: null, strikeMax: null })}>Sem limite de strike</button>
            )}
          </div>
          {limites && (
            <span className="tiny muted">Strikes disponíveis para {ativo.ticker}: de {reais(limites.min)} a {reais(limites.max)}.</span>
          )}
        </div>

        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={filtro.soUltimoPregao} onChange={(ev) => mudar({ soUltimoPregao: ev.target.checked })} />
          Só séries que negociaram no último pregão
        </label>

        {temFiltro && (
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => { setFiltro({ ...FILTRO_VAZIO, vencimentos: vencimentos.slice(0, 1) }); setMostradas(LINHAS_POR_PAGINA) }}>
            Limpar filtros
          </button>
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <div className="row-between" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="small" style={{ fontWeight: 600 }} aria-live="polite">
            {invertida
              ? 'O strike mínimo é maior que o máximo.'
              : `${linhas.length} ${linhas.length === 1 ? 'série' : 'séries'} de ${ativo.ticker}, de um total de ${ativo.series.length}`}
          </span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {selecionadas.length > 0 && <button className="chip" onClick={() => setSelecionadas([])}>Limpar seleção</button>}
            <button
              className="chip selected"
              disabled={escolhidas.length === 0}
              onClick={() => onCriar({ ativo, series: escolhidas })}
            >
              Criar estratégia com as selecionadas ({escolhidas.length})
            </button>
          </div>
        </div>

        {!invertida && linhas.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhuma série nessa combinação de filtros.</strong>{' '}
            <span className="muted">Amplie a faixa de strike, escolha outros vencimentos ou desmarque “só o último pregão”.</span>
          </div>
        )}

        {visiveis.length > 0 && (
          <div style={{ overflowX: 'auto' }} className="card-outline">
            <table className="tabela-opcoes small">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Selecionar</span></th>
                  {COLUNAS.map((c) => (
                    <th
                      key={c.chave}
                      scope="col"
                      aria-sort={ordem.chave === c.chave ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
                      title={c.ajuda}
                    >
                      <button onClick={() => ordenarPor(c.chave)} className="th-ordenar">
                        {c.titulo}
                        <span aria-hidden="true">{ordem.chave === c.chave ? (ordem.direcao === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <LinhaDaTabela key={l.codigo} l={l} dataPregao={snapshot.dataPregao} marcada={selecionadas.includes(l.codigo)} onAlternar={() => alternarSelecao(l.codigo)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {linhas.length > mostradas && (
          <button className="chip" onClick={() => setMostradas((m) => m + LINHAS_POR_PAGINA)}>
            Mostrar mais ({linhas.length - mostradas} restantes)
          </button>
        )}

        <span className="tiny muted justify">
          Vol. implícita, delta, gama e teta são estimativas nossas por Black-Scholes (juro de {num(jurosPadrao(), 2)}% ao ano, dias úteis/{DIAS_UTEIS_ANO}), a
          partir do último preço da série. Outras plataformas usam outros modelos e o preço do ativo na hora do negócio, então os números podem
          diferir. Séries sem negócio no último pregão mostram o preço do último dia em que negociaram.
        </span>
      </div>
    </>
  )
}

function LinhaDaTabela({ l, dataPregao, marcada, onAlternar }: { l: LinhaOpcao; dataPregao: string | null; marcada: boolean; onAlternar: () => void }) {
  const antiga = dataPregao !== null && l.dataUltimo !== dataPregao
  return (
    <tr data-testid="serie-opcao" className={marcada ? 'linha-marcada' : undefined}>
      <td>
        <input type="checkbox" checked={marcada} onChange={onAlternar} aria-label={`Selecionar ${l.codigo}`} />
      </td>
      <td style={{ fontWeight: 700 }}>{l.codigo}</td>
      <td>{rotuloTipo(l.tipo)}</td>
      <td>{l.estilo === 'americana' ? 'A' : 'E'}</td>
      <td className="num">{num(l.strike)}</td>
      <td>{l.situacao}</td>
      <td className="num">{num(l.distanciaStrike)}</td>
      <td className="num">{num(l.ultimo)}</td>
      <td className="num" style={{ color: corVar(l.variacao) }}>{l.variacao === null ? '—' : `${l.variacao > 0 ? '+' : ''}${num(l.variacao)}`}</td>
      <td className={antiga ? 'muted' : undefined} title={antiga ? 'Não negociou no último pregão' : undefined}>{dataCurta(l.dataUltimo)}</td>
      <td className="num">{l.negocios.toLocaleString('pt-BR')}</td>
      <td className="num">{num(l.volume)}</td>
      <td className="num">{num(l.volImplicita, 1)}</td>
      <td className="num">{num(l.delta, 4)}</td>
      <td className="num">{num(l.gama, 4)}</td>
      <td className="num">{num(l.tetaReais, 4)}</td>
      <td className="num">{num(l.tetaPct, 2)}</td>
    </tr>
  )
}

// ---------------------------------------------------------------------------------------
// Aba 2: estratégias
// ---------------------------------------------------------------------------------------

/** Entrada inicial: com um ativo escolhido, parte do preço dele (strikes perto do preço e prêmios de exemplo). */
function entradaPadrao(ativo: AtivoComOpcoes | null): EntradaEstrategia {
  if (!ativo) return DEFAULT
  const r = (v: number) => Math.round(v * 100) / 100
  return {
    ...DEFAULT,
    precoAtivo: ativo.cotacao,
    strikeBaixo: r(ativo.cotacao),
    strikeAlto: r(ativo.cotacao * 1.1),
    premioBaixo: r(ativo.cotacao * 0.03),
    premioAlto: r(ativo.cotacao * 0.015),
  }
}

/** Entrada inicial; vindo do ranking de calls cobertas, já abre a venda coberta com o strike e o prêmio da série. */
function entradaInicial(escolha: EscolhaDeSeries | null, ativo: AtivoComOpcoes | null): EntradaEstrategia {
  const base = entradaPadrao(ativo)
  const serie = escolha?.series[0]
  if (!escolha?.coberta || !serie) return base
  return { ...base, estrategia: 'vendaCoberta', precoAtivo: escolha.ativo.cotacao, strikeBaixo: serie.strike, premioBaixo: serie.ultimo }
}

const DEFAULT: EntradaEstrategia = { estrategia: 'compraCall', precoAtivo: 30, strikeBaixo: 30, premioBaixo: 1.5, strikeAlto: 33, premioAlto: 0.6, quantidade: 100 }

/** Uma série escolhida na tabela, com os campos que o usuário pode mexer no simulador. */
interface PernaEditavel {
  codigo: string
  tipo: 'call' | 'put'
  strike: number
  vencimento: string
  premio: number
  lado: Lado
  quantidade: number
}

function Estrategias({ escolha, ativoAtual, dataPregao, aoVoltar }: { escolha: EscolhaDeSeries | null; ativoAtual: AtivoComOpcoes | null; dataPregao: string | null; aoVoltar: () => void }) {
  const ativo = escolha?.ativo ?? ativoAtual
  const hoje = dataPregao ?? new Date().toISOString().slice(0, 10)
  const [modo, setModo] = useState<'padrao' | 'escolhidas'>(escolha && !escolha.coberta ? 'escolhidas' : 'padrao')
  const [e, setE] = useState<EntradaEstrategia>(() => entradaInicial(escolha, ativo))
  const [pernas, setPernas] = useState<PernaEditavel[]>(() =>
    (escolha && !escolha.coberta ? escolha.series : []).map((s) => ({ codigo: s.codigo, tipo: s.tipo, strike: s.strike, vencimento: s.vencimento, premio: s.ultimo, lado: escolha?.detalhes?.[s.codigo]?.lado ?? escolha?.lado ?? 'compra', quantidade: 100 * (escolha?.detalhes?.[s.codigo]?.fator ?? 1) })),
  )
  const [dias, setDias] = useState(() => {
    const v = escolha?.series[0]?.vencimento
    return v ? Math.max(diasUteis(v, hoje), 1) : 21
  })
  const [juros, setJuros] = useState(jurosPadrao)
  const [vol, setVol] = useState(35)
  const [diasPassados, setDiasPassados] = useState(0)

  const info = ESTRATEGIAS.find((x) => x.id === e.estrategia)!
  const mudar = (parcial: Partial<EntradaEstrategia>) => setE((x) => ({ ...x, ...parcial }))
  const mudarPerna = (i: number, parcial: Partial<PernaEditavel>) => setPernas((p) => p.map((x, j) => (j === i ? { ...x, ...parcial } : x)))
  const escolhidas = modo === 'escolhidas' && pernas.length > 0

  const vencimentosDasPernas = [...new Set(pernas.map((p) => p.vencimento))]
  const erro = escolhidas
    ? vencimentosDasPernas.length > 1
      ? 'As séries escolhidas têm vencimentos diferentes. Volte à tabela e escolha séries do mesmo vencimento.'
      : pernas.some((p) => !(p.quantidade > 0))
        ? 'Informe a quantidade de todas as séries.'
        : !(e.precoAtivo > 0)
          ? 'Informe o preço do ativo.'
          : null
    : validarEntrada(e)

  const r = Math.log(1 + juros / 100)
  const mercado = { dias: Math.max(dias, 0), r, sigma: vol / 100 }
  const passados = Math.min(diasPassados, mercado.dias)

  const posicao: Posicao | null = useMemo(() => {
    if (erro) return null
    if (escolhidas) {
      const lista: Perna[] = pernas.map((p) => ({ tipo: p.tipo, lado: p.lado, strike: p.strike, premio: p.premio, quantidade: p.quantidade }))
      return { pernas: lista, acoes: 0, precoAcao: 0 }
    }
    return montarPosicao(e)
  }, [erro, escolhidas, pernas, e])

  const volImplicita = useMemo(() => {
    if (!posicao || dias <= 0) return null
    const perna = posicao.pernas[0]
    const v = volatilidadeImplicita({ tipo: perna.tipo, s: e.precoAtivo, strike: perna.strike, t: dias / DIAS_UTEIS_ANO, r }, perna.premio)
    return v ? Math.round(v * 1000) / 10 : null
  }, [posicao, dias, e.precoAtivo, r])

  const dados = useMemo(() => {
    if (!posicao) return null
    const faixa = faixaDoGrafico(posicao, e.precoAtivo)
    const analise = analisar(posicao)
    const m = { dias: Math.max(dias, 0), r, sigma: vol / 100 }
    const p = Math.min(diasPassados, m.dias)
    const noVenc = curva((s) => resultadoNoVencimento(posicao, s), faixa.min, faixa.max)
    const antes = p < m.dias && vol > 0 ? curva((s) => resultadoAntesDoVencimento(posicao, s, m, p), faixa.min, faixa.max) : null
    const g = vol > 0 && m.dias - p > 0 ? gregasDaPosicao(posicao, e.precoAtivo, m, p) : null
    return {
      analise, noVenc, antes, g,
      custo: custoDeMontagem(posicao),
      hoje: antes ? resultadoAntesDoVencimento(posicao, e.precoAtivo, m, p) : resultadoNoVencimento(posicao, e.precoAtivo),
    }
  }, [posicao, e.precoAtivo, dias, r, vol, diasPassados])

  const titulo = escolhidas ? 'Estratégia com as séries escolhidas' : info.titulo
  const aviso = escolhidas
    ? pernas.some((p) => p.lado === 'venda')
      ? 'Há séries vendidas: a venda de opções sem cobertura pode ter perda muito maior que o prêmio recebido (na venda descoberta de call, sem limite), e a B3 exige margem de garantia.'
      : null
    : info.aviso ?? null
  const rotuloCurva = passados === 0 ? 'Hoje' : `Daqui a ${passados} ${passados === 1 ? 'dia' : 'dias'}`
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <>
      <button className="chip" onClick={aoVoltar} style={{ alignSelf: 'flex-start' }}>← Voltar às séries</button>

      {ativo ? (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note" data-testid="ativo-estrategia">
          Ativo: <strong>{ativo.ticker}</strong>, preço à vista <strong>{reais(ativo.cotacao)}</strong>
          {ativo.dataCotacao ? ` (fechamento de ${formatarData(ativo.dataCotacao)})` : ''}. O campo "Preço do ativo hoje" já vem com esse valor e pode ser alterado.
        </div>
      ) : (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Sem ativo escolhido: os valores abaixo são de exemplo. Escolha um ativo na aba Séries da B3 para partir do preço dele.
        </div>
      )}

      {escolha?.coberta && (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Venda coberta com a série <strong>{escolha.series[0].codigo}</strong> de <strong>{escolha.ativo.ticker}</strong>, pelo último preço dela.
          Você precisa ter as ações; strike e prêmio podem ser alterados.
        </div>
      )}

      {escolha && !escolha.coberta && (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Séries escolhidas de <strong>{escolha.ativo.ticker}</strong> ({pernas.map((p) => p.codigo).join(', ')}), com o último preço de cada uma.
          Você pode trocar compra por venda, a quantidade e o preço de cada série.
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>Estratégia</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Estratégia">
          {pernas.length > 0 && (
            <button className={`chip ${escolhidas ? 'selected' : ''}`} aria-pressed={escolhidas} onClick={() => { setModo('escolhidas'); setDiasPassados(0) }}>
              Séries escolhidas ({pernas.length})
            </button>
          )}
          {ESTRATEGIAS.map((x) => (
            <button
              key={x.id}
              className={`chip ${!escolhidas && e.estrategia === x.id ? 'selected' : ''}`}
              aria-pressed={!escolhidas && e.estrategia === x.id}
              onClick={() => { setModo('padrao'); mudar({ estrategia: x.id as EstrategiaId }); setDiasPassados(0) }}
            >
              {x.titulo}
            </button>
          ))}
        </div>
        <span className="small muted justify">
          {escolhidas ? 'Monte a posição série a série: cada uma pode ser comprada ou vendida.' : info.descricao}
        </span>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Dados da operação</span>
        <CampoReais rotulo="Preço do ativo hoje" valor={e.precoAtivo} onMudar={(v) => mudar({ precoAtivo: v })} />

        {escolhidas ? (
          <div className="col" style={{ gap: 12 }}>
            {pernas.map((p, i) => (
              <div key={p.codigo} className="card-outline col" style={{ gap: 8 }} role="group" aria-label={`Série ${p.codigo}`}>
                <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
                  <span>
                    <strong>{p.codigo}</strong> <span className="muted small">{rotuloTipo(p.tipo)}, strike {num(p.strike)}, vence {formatarData(p.vencimento)}</span>
                  </span>
                  <button className="chip" onClick={() => setPernas((l) => l.filter((_, j) => j !== i))} aria-label={`Remover ${p.codigo}`}>Remover</button>
                </div>
                <div className="row" style={{ gap: 6 }} role="group" aria-label={`Lado de ${p.codigo}`}>
                  {(['compra', 'venda'] as Lado[]).map((lado) => (
                    <button key={lado} className={`chip ${p.lado === lado ? 'selected' : ''}`} aria-pressed={p.lado === lado} onClick={() => mudarPerna(i, { lado })}>
                      {lado === 'compra' ? 'Comprar' : 'Vender'}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 130px' }}><CampoReais rotulo={`Preço de ${p.codigo}`} valor={p.premio} onMudar={(v) => mudarPerna(i, { premio: v })} /></div>
                  <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo={`Quantidade de ${p.codigo}`} valor={p.quantidade} onMudar={(v) => mudarPerna(i, { quantidade: v })} sufixo="opções" casas={0} /></div>
                </div>
              </div>
            ))}
          </div>
        ) : info.doisStrikes ? (
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

        {!escolhidas && (
          <CampoNumero rotulo="Quantidade de opções" valor={e.quantidade} onMudar={(v) => mudar({ quantidade: v })} sufixo="opções" casas={0} dica="O lote padrão das ações na B3 é de 100." />
        )}
        <CampoNumero rotulo="Dias úteis até o vencimento" valor={dias} onMudar={(v) => { setDias(v); setDiasPassados(0) }} sufixo="dias úteis" casas={0} />

        <details>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Volatilidade e juros (curva do tempo e gregas)</summary>
          <div className="col" style={{ gap: 10, marginTop: 10 }}>
            <CampoNumero rotulo="Volatilidade do ativo" valor={vol} onMudar={setVol} sufixo="% a.a." casas={1} />
            {volImplicita !== null && (
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tiny muted">Volatilidade implícita no preço da primeira série: <strong>{volImplicita.toLocaleString('pt-BR')}% a.a.</strong></span>
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
          <span style={{ fontWeight: 700 }}>{titulo} no vencimento</span>

          {aviso && (
            <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note" data-testid="aviso-risco">
              <strong>Atenção.</strong> <span className="muted">{aviso}</span>
            </div>
          )}

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
            {!escolhidas && e.estrategia === 'vendaCoberta' ? ` Precisa ter ${e.quantidade.toLocaleString('pt-BR')} ações do ativo, compradas a ${reais(e.precoAtivo)}.` : ''}
          </div>

          <div style={{ width: '100%', maxWidth: 560, marginInline: 'auto' }}>
            <GraficoPayoff
              curvas={[
                { rotulo: 'No vencimento', pontos: dados.noVenc, principal: true },
                ...(dados.antes ? [{ rotulo: rotuloCurva, pontos: dados.antes }] : []),
              ]}
              precoAtivo={e.precoAtivo}
              equilibrios={dados.analise.equilibrios}
              descricao={`Lucro e prejuízo da ${titulo.toLowerCase()} por preço do ativo no vencimento. Ganho máximo ${dados.analise.ganhoMaximo === null ? 'sem limite' : dinheiro(dados.analise.ganhoMaximo)}, perda máxima ${dados.analise.perdaMaxima === null ? 'sem limite' : dinheiro(dados.analise.perdaMaxima)}.`}
            />
          </div>
          <div className="row tiny muted" style={{ gap: 14, flexWrap: 'wrap' }}>
            <span><MarcaDaLinha cor="var(--grafico-selic)" />No vencimento</span>
            {dados.antes && <span><MarcaDaLinha cor="var(--grafico-ipca)" tracejada />{rotuloCurva}</span>}
            <span>┆ Preço de hoje</span>
            <span>○ Equilíbrio</span>
          </div>

          {mercado.dias > 0 && vol > 0 && (
            <div className="col" style={{ gap: 6 }}>
              <label htmlFor="dias-passados" className="small" style={{ fontWeight: 600 }}>
                Passagem do tempo: daqui a {passados} {passados === 1 ? 'dia útil' : 'dias úteis'} (faltariam {mercado.dias - passados})
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
              <span className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Gregas da posição{passados > 0 ? ` (daqui a ${passados} dias úteis)` : ' (hoje)'}</span>
              <div className="tabela-bdr small"><span className="muted">Delta (variação por R$ 1 no ativo)</span><span style={{ fontWeight: 700 }} data-testid="delta">{dados.g.delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span></div>
              <div className="tabela-bdr small"><span className="muted">Gama (variação do delta por R$ 1)</span><span style={{ fontWeight: 700 }}>{dados.g.gama.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span></div>
              <div className="tabela-bdr small"><span className="muted">Teta (por dia útil que passa)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.teta)}</span></div>
              <div className="tabela-bdr small"><span className="muted">Vega (por +1 ponto de volatilidade)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.vega)}</span></div>
            </div>
          )}

          <span className="tiny muted justify">
            A curva antes do vencimento e as gregas usam o modelo de Black-Scholes (opção europeia, sem dividendos), uma
            aproximação: opções americanas podem ser exercidas antes do vencimento. No vencimento, o resultado é exato.
          </span>
        </div>
      )}
    </>
  )
}
