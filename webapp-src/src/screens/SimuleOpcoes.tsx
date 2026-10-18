import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import {
  FILTRO_VAZIO, diasUteis, expandirSnapshot, faixaPerto, filtrarSeries, limitarAosProximosMeses, limitesDeStrike, montarLinha,
  ordenarLinhas, strikesDistintos, tipoVencimento, vencimentosDe,
} from '../domain/opcoes'
import type { AtivoComOpcoes, ChaveOrdem, EscolhaDeSeries, FiltroEstilo, FiltroSeries, FiltroTipo, LinhaOpcao, Ordem, SnapshotOpcoes } from '../domain/opcoes'
import { DIAS_UTEIS_ANO } from '../domain/simulaOpcoes'
import type { Lado } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { VoltarInicio } from '../ui/VoltarInicio'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import { CampoReais } from '../ui/CampoReais'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { GraficosOpcoes } from './GraficosOpcoes'
import { BotaoDeLado, OperacaoDaSerie } from './OperacaoDaSerie'
import { MonteSuaEstrategia } from './MonteSuaEstrategia'
import { PorVisaoOpcoes } from './PorVisaoOpcoes'
import { RodaOpcoes } from './RodaOpcoes'
import { TopPremiosOpcoes } from './TopPremiosOpcoes'
import { FaixaDeStrike } from '../ui/FaixaDeStrike'
import type { AppCtx } from '../state/useAppState'

type Aba = 'series' | 'premios' | 'visao' | 'graficos' | 'roda' | 'estrategias'

/** Abas que, ao abrir, criam uma entrada no histórico: o "voltar" do navegador as fecha em vez de sair da tela. */
const ABAS_COM_HISTORICO: Aba[] = ['premios', 'visao', 'graficos', 'roda', 'estrategias']

const LINHAS_POR_PAGINA = 100
const ATALHOS_PERTO = [5, 10, 20] as const

const num = (v: number | null, casas = 2) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))
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
    setTicker(e.ativo.ticker)
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
          { id: 'visao', emoji: '🧭', titulo: 'Tendência', descricao: 'Alta, baixa, lateral' },
          { id: 'graficos', emoji: '📊', titulo: 'Gráficos', descricao: 'Negócios por strike' },
          { id: 'roda', emoji: '🔄', titulo: 'Roda', descricao: 'Put, ação e call coberta' },
          { id: 'estrategias', emoji: '📈', titulo: 'Estratégias', descricao: 'Monte sua estratégia' },
        ] as const}
      >
        {aba === 'series' ? (
          comDados((d) => <SeriesDaB3 snapshot={d} ativo={ativoAtual} onEscolher={setTicker} />)
        ) : aba === 'graficos' ? (
          comDados((d) => <GraficosOpcoes snapshot={d} ativo={ativoAtual} onEscolher={setTicker} />)
        ) : aba === 'roda' ? (
          comDados((d) => <RodaOpcoes snapshot={d} ativo={ativoAtual} onEscolher={setTicker} dataPregao={d.dataPregao} />)
        ) : aba === 'visao' ? (
          comDados((d) => <PorVisaoOpcoes snapshot={d} ativo={ativoAtual} onEscolher={setTicker} onSimular={criarEstrategia} />)
        ) : aba === 'premios' ? (
          comDados((d) => (
            <TopPremiosOpcoes snapshot={d} onSimular={criarEstrategia} endividadas={endividadas} carregarBaratas={carregarBaratas} armazenamento={armazenamento} />
          ))
        ) : (
          comDados((d) => <MonteSuaEstrategia snapshot={d} ativo={ativoAtual} onEscolher={setTicker} escolha={escolha} dataPregao={d.dataPregao} />)
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

function SeriesDaB3({ snapshot, ativo, onEscolher }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes | null; onEscolher: (t: string) => void }) {
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
      <TabelaDoAtivo key={ativo.ticker} snapshot={snapshot} ativo={ativo} />
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

function TabelaDoAtivo({ snapshot, ativo }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes }) {
  const hoje = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])
  const limites = useMemo(() => limitesDeStrike(ativo.series), [ativo])
  const strikes = useMemo(() => strikesDistintos(ativo.series), [ativo])
  const mensais = useMemo(() => vencimentos.filter((v) => tipoVencimento(v) === 'mensal'), [vencimentos])
  const semanais = useMemo(() => vencimentos.filter((v) => tipoVencimento(v) === 'semanal'), [vencimentos])
  const [filtro, setFiltro] = useState<FiltroSeries>({ ...FILTRO_VAZIO, vencimentos: vencimentos.slice(0, 1) })
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'strike', direcao: 'asc' })
  const [operacao, setOperacao] = useState<{ codigo: string; lado: Lado } | null>(null)
  const painelRef = useRef<HTMLDivElement>(null)
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
  // Clicar em Comprar ou Vender monta a operação ali mesmo; clicar de novo no mesmo botão desfaz.
  const operar = (codigo: string, lado: Lado) => {
    const repetido = operacao?.codigo === codigo && operacao.lado === lado
    setOperacao(repetido ? null : { codigo, lado })
    if (!repetido) setTimeout(() => painelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }
  const serieOperada = operacao ? (ativo.series.find((s) => s.codigo === operacao.codigo) ?? null) : null
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

      {operacao && serieOperada && (
        <div ref={painelRef} className="col" style={{ gap: 10, scrollMarginTop: 12 }} data-testid="operacao-da-serie">
          <OperacaoDaSerie key={`${serieOperada.codigo}:${operacao.lado}`} ativo={ativo} serie={serieOperada} lado={operacao.lado} hoje={hoje} aoFechar={() => setOperacao(null)} />
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        <div className="row-between" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="small" style={{ fontWeight: 600 }} aria-live="polite">
            {invertida
              ? 'O strike mínimo é maior que o máximo.'
              : `${linhas.length} ${linhas.length === 1 ? 'série' : 'séries'} de ${ativo.ticker}, de um total de ${ativo.series.length}`}
          </span>
          <span className="tiny muted">Clique em C (comprar) ou V (vender) numa série para ver a operação montada. Travas, borboletas e condors ficam na aba Estratégias.</span>
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
                  <th scope="col" title="Comprar (C) ou vender (V)">Operar</th>
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
                  <LinhaDaTabela key={l.codigo} l={l} dataPregao={snapshot.dataPregao} lado={operacao?.codigo === l.codigo ? operacao.lado : null} onOperar={(lado) => operar(l.codigo, lado)} />
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

function LinhaDaTabela({ l, dataPregao, lado, onOperar }: { l: LinhaOpcao; dataPregao: string | null; lado: Lado | null; onOperar: (lado: Lado) => void }) {
  const antiga = dataPregao !== null && l.dataUltimo !== dataPregao
  return (
    <tr data-testid="serie-opcao" className={lado ? 'linha-marcada' : undefined}>
      <td style={{ whiteSpace: 'nowrap' }}>
        {(['compra', 'venda'] as Lado[]).map((x) => (
          <BotaoDeLado key={x} lado={x} codigo={l.codigo} escolhido={lado === x} onClick={() => onOperar(x)} />
        ))}
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
