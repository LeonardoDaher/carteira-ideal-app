import { useId, useMemo, useState } from 'react'
import { SNAPSHOT_ACOES } from '../data/snapshotAcoes'
import { agruparPorGrupo, buscarAcoes, simularCompraAcoes, totaisDe } from '../domain/acoes'
import type { Acao, AcaoBusca, SnapshotAcoes } from '../domain/acoes'
import { VALORES_PADRAO, formatarVariacao } from '../domain/bdrs'
import { formatarData, formatarVolume } from '../domain/rendaFii'
import { VoltarInicio } from '../ui/VoltarInicio'
import { LogoAtivo } from '../ui/LogoAtivo'
import { rolarParaResultado } from '../ui/rolarParaResultado'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { FaixaCotacoes, itensDeAcoes } from '../ui/FaixaCotacoes'
import { Top15Baratas } from './Top15Baratas'
import { Top15AcoesMaisNegociadas, Top15IbovMaioresPesos } from './Top15EtfsMaisNegociados'
import { Top15Endividadas } from './Top15Endividadas'
import { Top15Dividendos } from './Top15Dividendos'
import { Top15Confluencia } from './Top15Confluencia'
import { AnaliseTecnicaAcao } from './AnaliseTecnicaAcao'
import { AnaliseFundamentalistaAcao } from './AnaliseFundamentalistaAcao'
import { ConfluenciaAcao } from './ConfluenciaAcao'
import { PrecoTetoAcoes } from './PrecoTetoAcoes'
import { AgendaDeDividendos } from './AgendaDeDividendos'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { SNAPSHOT_ACOES_ENDIVIDADAS } from '../data/snapshotAcoesEndividadas'
import { SNAPSHOT_ACOES_MAIS_NEGOCIADAS, SNAPSHOT_IBOV_MAIORES_PESOS } from '../data/snapshotTop15Mercado'
import { NosRadares, ResumoDoGrupo } from '../ui/DestaquesDoAtivo'
import { SNAPSHOT_RADAR_DIVIDENDOS } from '../data/snapshotRadarDividendos'
import { indexarDestaques } from '../domain/destaquesRadares'
import type { DestaquesDoAtivo, IndiceDeDestaques } from '../domain/destaquesRadares'
import { useAnaliseDaAcao } from './useAnaliseDaAcao'
import { ROTULO_HORIZONTE } from '../domain/confluencia'
import type { Horizonte, HistoricoLongo, SnapshotSeries } from '../domain/analiseTecnica'
import type { SnapshotFundamentos } from '../domain/analiseFundamentalista'
import type { AppCtx } from '../state/useAppState'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inteiro(valor: number) {
  return valor.toLocaleString('pt-BR')
}

/** O que está aberto no cartão: uma empresa do cadastro (dado completo) ou um código da busca (resumido). */
type Selecao = { origem: 'lista'; acao: Acao; setor: string } | { origem: 'busca'; acao: AcaoBusca }

/** Radares que valem para ações. */
const SELOS_ACOES = ['dividendos', 'radar', 'maisNegociado', 'indice', 'endividada'] as const satisfies readonly (keyof DestaquesDoAtivo)[]

type AbaAcoes = 'simulador' | 'top15' | 'negociadas' | 'ibov' | 'endividadas' | 'dividendos' | 'tecnica' | 'fundamentalista' | 'confluencia' | 'top15confluencia' | 'precoteto' | 'radar'
const ABAS_DE_ANALISE: AbaAcoes[] = ['tecnica', 'fundamentalista', 'confluencia']
const HORIZONTES: Horizonte[] = ['curto', 'medio', 'longo']

/**
 * Aba "Simule Ações" (D43), com duas caixinhas (D49).
 *  - Simulador: tela estritamente descritiva. As principais empresas de cada setor da B3 (com a
 *    contagem de setores e de empresas), em ordem de volume dentro do setor, e a busca para qualquer
 *    outro código. Sem ranking, sem múltiplos de avaliação, sem projeção de retorno (D19).
 *  - Top 15 mais baratas: EXCEÇÃO declarada à D19. Triagem quantitativa com metodologia pública e
 *    trilha de auditoria; só aparece com ranking depois da aprovação do responsável (D49).
 *  - Análise de uma ação (D119): análise técnica, análise fundamentalista e confluência, outra EXCEÇÃO declarada à D19, pedida
 *    pelo responsável. Cálculo por regra, no app, a partir de dados verificáveis (docs/15-metodologia-analise-acoes.md); os
 *    arquivos de dados só são baixados ao abrir uma dessas abas.
 */
export function SimuleAcoes({
  snapshot = SNAPSHOT_ACOES,
  series,
  fundamentos,
  historico,
  destaques,
}: {
  /** Recebido como as demais telas avulsas; esta tela só volta ao Simule Ativos. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job diário. */
  snapshot?: SnapshotAcoes
  /** Só nos testes: séries de preço e fundamentos injetados (no app, baixados ao abrir uma aba de análise). */
  series?: SnapshotSeries
  fundamentos?: SnapshotFundamentos
  /** Só nos testes: histórico longo (COTAHIST) por ticker; no app, um arquivo por ação baixado ao abrir a análise técnica. */
  historico?: Record<string, HistoricoLongo>
  /** Só nos testes: destaques dos radares por código; no app, vêm do Top 15 de dividendos, do de endividadas e do radar de dividendos. */
  destaques?: IndiceDeDestaques
}) {
  const grupos = agruparPorGrupo(snapshot.setores, snapshot.gruposOrdem)
  const totais = totaisDe(snapshot.setores)
  const primeiraSetor = snapshot.setores[0]
  const primeira = primeiraSetor?.empresas[0]
  const [selecao, setSelecao] = useState<Selecao | undefined>(primeira && primeiraSetor ? { origem: 'lista', acao: primeira, setor: primeiraSetor.setor } : undefined)
  const [valorLivre, setValorLivre] = useState('')
  const [valorEscolhido, setValorEscolhido] = useState<number>(VALORES_PADRAO[1])
  // Duas caixinhas (D49): o simulador de sempre e a triagem "Top 15 mais baratas".
  const [aba, setAba] = useState<AbaAcoes>('simulador')
  const [horizonte, setHorizonte] = useState<Horizonte>('medio')
  const emAnalise = ABAS_DE_ANALISE.includes(aba)

  // Preço de fechamento por código (lista por setor e busca), para o valor de mercado e os múltiplos da análise fundamentalista.
  const precoDe = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of snapshot.busca) m.set(b.ticker, b.cotacao)
    for (const st of snapshot.setores) for (const e of st.empresas) m.set(e.ticker, e.cotacao)
    return (t: string) => m.get(t) ?? null
  }, [snapshot])
  const nomeDe = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of snapshot.busca) m.set(b.ticker, b.nome ?? b.ticker)
    for (const st of snapshot.setores) for (const e of st.empresas) m.set(e.ticker, e.nome)
    return (t: string) => m.get(t) ?? null
  }, [snapshot])
  // Busca com as empresas da lista por setor também, para o radar de preço teto achar qualquer código do cadastro.
  const buscaCompleta = useMemo(() => {
    const vistos = new Set(snapshot.busca.map((b) => b.ticker))
    const extra = snapshot.setores.flatMap((st) => st.empresas.filter((e) => !vistos.has(e.ticker)).map((e) => ({ ticker: e.ticker, nome: e.nome, setor: st.setor, cotacao: e.cotacao, dataCotacao: e.dataCotacao, volumeDia: e.volumeMedio }) as AcaoBusca))
    return [...snapshot.busca, ...extra]
  }, [snapshot])
  const maisNegociadas = useMemo(() => snapshot.setores.flatMap((st) => st.empresas).sort((a, b) => b.volumeMedio - a.volumeMedio).slice(0, 10), [snapshot])

  const indiceDestaques = useMemo(
    () => destaques ?? indexarDestaques({ dividendos: SNAPSHOT_ACOES_DIVIDENDOS, endividadas: SNAPSHOT_ACOES_ENDIVIDADAS, radar: SNAPSHOT_RADAR_DIVIDENDOS, maisNegociados: SNAPSHOT_ACOES_MAIS_NEGOCIADAS, indice: SNAPSHOT_IBOV_MAIORES_PESOS, hoje: snapshot.dataPregao ?? SNAPSHOT_RADAR_DIVIDENDOS.dataReferencia }),
    [destaques, snapshot.dataPregao],
  )

  const levarAoCartao = () => rolarParaResultado('cartao-acao')

  const abrir = (nova: Selecao) => {
    setSelecao(nova)
    levarAoCartao()
  }

  const abrirDaBusca = (b: AcaoBusca) => {
    for (const s of snapshot.setores) {
      const naLista = s.empresas.find((e) => e.ticker === b.ticker)
      if (naLista) return abrir({ origem: 'lista', acao: naLista, setor: s.setor })
    }
    abrir({ origem: 'busca', acao: b })
  }

  const selecionado = selecao?.acao.ticker
  const dadosDaAnalise = useAnaliseDaAcao({ ticker: selecionado ?? null, horizonte, ativo: emAnalise, precoDe, snapshot, seriesInjetadas: series, fundamentosInjetados: fundamentos, historicoInjetado: historico })

  // Na análise, escolher uma ação não rola a tela até o cartão de simulação.
  const escolherParaAnalise = (b: AcaoBusca) => {
    for (const st of snapshot.setores) {
      const naLista = st.empresas.find((e) => e.ticker === b.ticker)
      if (naLista) return setSelecao({ origem: 'lista', acao: naLista, setor: st.setor })
    }
    setSelecao({ origem: 'busca', acao: b })
  }

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule Ações</h1>
        <div className="muted small justify">
          Ações são pedaços de empresas listadas na B3. Veja as principais empresas de cada setor da bolsa, escolha uma ou busque
          pelo código, e descubra o preço de fechamento e quantas ações um valor compra.
        </div>
      </div>

      <FaixaCotacoes itens={itensDeAcoes(snapshot)} dataPregao={snapshot.dataPregao} />

      <div role="tablist" aria-label="O que você quer ver" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {(
          [
            { id: 'simulador', emoji: '🧮', titulo: 'Simulador', descricao: 'Quantas ações o valor compra' },
            { id: 'top15', emoji: '🏷️', titulo: 'Top 15 mais baratas', descricao: 'Triagem de valor, com auditoria' },
            { id: 'negociadas', emoji: '📊', titulo: 'Top 15 mais negociadas', descricao: 'Ranking por volume' },
            { id: 'ibov', emoji: '🏛️', titulo: 'Top 15 do Ibovespa', descricao: 'Maiores pesos do índice' },
            { id: 'endividadas', emoji: '💳', titulo: 'Top 15 mais endividadas', descricao: 'Dívida líquida ÷ EBITDA' },
            { id: 'dividendos', emoji: '💰', titulo: 'Top 15 pagadoras de dividendos', descricao: 'Dividend yield de 12 meses' },
            { id: 'precoteto', emoji: '🎯', titulo: 'Preço teto de compra', descricao: 'Bazin, Graham e radar' },
            { id: 'radar', emoji: '📅', titulo: 'Agenda de dividendos', descricao: 'O que já foi anunciado, mês a mês' },
          ] as const
        ).map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`aba-acoes-${c.id}`}
            aria-selected={aba === c.id}
            aria-controls="painel-acoes"
            className={`vehicle-card ${aba === c.id ? 'selected' : ''}`}
            onClick={() => setAba(c.id)}
          >
            <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>{c.emoji}</span>
            <span style={{ fontSize: 14 }}>{c.titulo}</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{c.descricao}</span>
          </button>
        ))}
      </div>

      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 700 }}>Análise de uma ação</span>
        <div role="tablist" aria-label="Análise de uma ação" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {(
            [
              { id: 'tecnica', emoji: '📈', titulo: 'Análise técnica', descricao: 'Tendência, níveis e risco' },
              { id: 'fundamentalista', emoji: '🧾', titulo: 'Análise fundamentalista', descricao: 'Balanços, valor justo e notas' },
              { id: 'confluencia', emoji: '🎯', titulo: 'Confluência', descricao: 'Fundamentos × gráfico' },
              { id: 'top15confluencia', emoji: '🏆', titulo: 'Top 15 confluência', descricao: 'Positivas e negativas' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              role="tab"
              id={`aba-acoes-${c.id}`}
              aria-selected={aba === c.id}
              aria-controls="painel-acoes"
              className={`vehicle-card ${aba === c.id ? 'selected' : ''}`}
              onClick={() => setAba(c.id)}
            >
              <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>{c.emoji}</span>
              <span style={{ fontSize: 14 }}>{c.titulo}</span>
              <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{c.descricao}</span>
            </button>
          ))}
        </div>
      </div>

      <div id="painel-acoes" role="tabpanel" aria-labelledby={`aba-acoes-${aba}`} className="col" style={{ gap: 'inherit' }}>
      {emAnalise ? (
        !selecao ? (
          <div className="card col" style={{ gap: 6 }} role="status">
            <span style={{ fontWeight: 700 }}>Os dados das ações ainda não foram carregados.</span>
            <span className="muted small justify">As cotações são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
          </div>
        ) : (
          <>
            <EscolhaDaAnalise
              busca={snapshot.busca}
              onSelecionar={escolherParaAnalise}
              atual={selecao.acao}
              rapidas={maisNegociadas}
              horizonte={horizonte}
              onHorizonte={setHorizonte}
              usaHorizonte={aba !== 'fundamentalista'}
              dataPregao={snapshot.dataPregao}
            />
            {aba === 'tecnica' ? (
              <AnaliseTecnicaAcao dados={dadosDaAnalise} ticker={selecao.acao.ticker} nome={selecao.acao.nome} horizonte={horizonte} />
            ) : aba === 'fundamentalista' ? (
              <AnaliseFundamentalistaAcao dados={dadosDaAnalise} ticker={selecao.acao.ticker} nome={selecao.acao.nome} />
            ) : (
              <ConfluenciaAcao dados={dadosDaAnalise} ticker={selecao.acao.ticker} horizonte={horizonte} />
            )}
          </>
        )
      ) : aba === 'top15' ? (
        <Top15Baratas />
      ) : aba === 'ibov' ? (
        <Top15IbovMaioresPesos />
      ) : aba === 'negociadas' ? (
        <Top15AcoesMaisNegociadas />
      ) : aba === 'endividadas' ? (
        <Top15Endividadas />
      ) : aba === 'dividendos' ? (
        <Top15Dividendos />
      ) : aba === 'radar' ? (
        <AgendaDeDividendos />
      ) : aba === 'precoteto' ? (
        <PrecoTetoAcoes busca={buscaCompleta} precoDe={precoDe} nomeDe={(t) => nomeDe(t)} fundamentos={fundamentos} />
      ) : aba === 'top15confluencia' ? (
        <Top15Confluencia precoDe={precoDe} nomeDe={nomeDe} dataPregao={snapshot.dataPregao ?? ''} horizonteInicial={horizonte} series={series} fundamentos={fundamentos} />
      ) : !selecao ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Os dados das ações ainda não foram carregados.</span>
          <span className="muted small justify">
            As cotações são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.
          </span>
        </div>
      ) : (
        // No computador: busca e lista por setor à esquerda, cartão da ação fixo à direita (D20).
        <div className="desk-split">
          <div className="desk-main">
            <div className="row" style={{ gap: 10, alignItems: 'stretch' }} role="group" aria-label="Tamanho da lista">
              <div className="col" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', gap: 2, flex: 1 }}>
                <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }} data-testid="total-setores">{totais.setores}</span>
                <span className="tiny muted">setores da bolsa</span>
              </div>
              <div className="col" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', gap: 2, flex: 1 }}>
                <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }} data-testid="total-empresas">{totais.empresas}</span>
                <span className="tiny muted">empresas na lista</span>
              </div>
            </div>

            <BuscaAcoes busca={snapshot.busca} onSelecionar={abrirDaBusca} />

            <div className="small muted justify" style={{ lineHeight: 1.5 }}>
              A lista reúne as principais empresas de cada setor, em ordem de volume negociado dentro do setor (média dos últimos{' '}
              {snapshot.sessoesLiquidez ?? 21} pregões). Ela é uma seleção, não a bolsa inteira: as demais ações estão na busca
              acima. Estar na lista não é uma indicação de compra.
            </div>
            <div className="col" style={{ gap: 22 }}>
              {grupos.map((g) => (
                <div key={g.grupo} className="col" style={{ gap: 14 }}>
                  <div className="col" style={{ gap: 2 }}>
                    <h2 className="titulo-setor font-display">{g.grupo}</h2>
                    <span className="tiny muted">
                      {g.setores.length} {g.setores.length === 1 ? 'setor' : 'setores'}, {g.empresas} {g.empresas === 1 ? 'empresa' : 'empresas'}
                    </span>
                  </div>
                  {g.setores.map((s) => (
                    <div key={s.setor} className="col" style={{ gap: 8 }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>
                        {s.setor} <span className="muted" style={{ fontWeight: 400 }}>({s.empresas.length})</span>
                      </h3>
                      <div className="grade-tickers" role="group" aria-label={`Ações do setor ${s.setor}`}>
                        {s.empresas.map((e) => (
                          <button
                            key={e.ticker}
                            className={`chip ${e.ticker === selecionado ? 'selected' : ''}`}
                            aria-pressed={e.ticker === selecionado}
                            onClick={() => abrir({ origem: 'lista', acao: e, setor: s.setor })}
                          >
                            {e.ticker}
                          </button>
                        ))}
                      </div>
                      <ResumoDoGrupo tickers={s.empresas.map((e) => e.ticker)} indice={indiceDestaques} usa={SELOS_ACOES} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="desk-side">
            <CartaoAcao
              selecao={selecao}
              dataPregao={snapshot.dataPregao}
              valorEscolhido={valorEscolhido}
              setValorEscolhido={setValorEscolhido}
              valorLivre={valorLivre}
              setValorLivre={setValorLivre}
              destaques={indiceDestaques.get(selecao.acao.ticker)}
            />
          </div>
        </div>
      )}

      {aba === 'simulador' && (
        <>
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          <strong>Como o IR funciona nas ações.</strong>{' '}
          <span className="muted">
            Na venda em operações comuns, quem vende até R$ 20 mil no mês em ações não paga Imposto de Renda sobre o lucro. Acima
            disso, o lucro paga 15%; no day trade, 20%, sem isenção. O imposto é calculado e pago pelo próprio investidor por DARF.
            Os dividendos são isentos para a maioria das pessoas, mas passou a haver retenção de 10% quando uma mesma empresa paga
            mais de R$ 50 mil por mês à pessoa física. Essas regras estão em discussão no Congresso e podem mudar: confirme a regra
            vigente com um contador antes de declarar.
          </span>
        </div>

        <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
          <strong>Rentabilidade obtida no passado não representa garantia de rentabilidade futura.</strong> O preço de uma ação
          sobe e desce todos os dias, e é possível perder parte ou todo o dinheiro aplicado. A variação de 3 meses e a faixa de 52
          semanas mostram só o preço, sem os dividendos recebidos; desdobramentos e bonificações podem distorcê-las. A lista e a
          busca não são recomendação: o critério de ordem é só o volume negociado.
          {snapshot.geradoEm
            ? ` Preços e volumes oficiais da B3 (Boletim de Preços); setores e nomes do cadastro do Carteira Ideal. Atualizados em ${formatarData(snapshot.geradoEm)}.`
            : ''}
        </div>
        </>
      )}
      </div>

      <AvisoEducacional />
    </div>
  )
}

/** Escolha da ação e do horizonte das abas de análise: busca, atalhos para as mais negociadas e o horizonte (curto, médio, longo). */
function EscolhaDaAnalise({
  busca, onSelecionar, atual, rapidas, horizonte, onHorizonte, usaHorizonte, dataPregao,
}: {
  busca: AcaoBusca[]
  onSelecionar: (b: AcaoBusca) => void
  atual: Acao | AcaoBusca
  rapidas: Acao[]
  horizonte: Horizonte
  onHorizonte: (h: Horizonte) => void
  usaHorizonte: boolean
  dataPregao: string | null
}) {
  return (
    <div className="card col" style={{ gap: 10 }} data-testid="escolha-da-analise">
      <div className="row-between" style={{ alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 700 }}>Ação analisada: <span style={{ color: 'var(--accent)' }}>{atual.ticker}</span></span>
        <span className="tiny muted">{reais(atual.cotacao)}{dataPregao ? ` · fechamento de ${formatarData(dataPregao)}` : ''}</span>
      </div>
      <BuscaAcoes busca={busca} onSelecionar={onSelecionar} />
      <div className="grade-tickers" role="group" aria-label="Ações mais negociadas">
        {rapidas.map((e) => (
          <button
            key={e.ticker}
            className={`chip ${e.ticker === atual.ticker ? 'selected' : ''}`}
            aria-pressed={e.ticker === atual.ticker}
            onClick={() => onSelecionar({ ticker: e.ticker, nome: e.nome, setor: '', cotacao: e.cotacao, dataCotacao: e.dataCotacao, volumeDia: 0 })}
          >
            {e.ticker}
          </button>
        ))}
      </div>
      {usaHorizonte && (
        <div className="col" style={{ gap: 4 }}>
          <span className="tiny muted">Horizonte da leitura: define quanto peso cada período do gráfico (e, na confluência, os fundamentos) recebe.</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Horizonte da análise">
            {HORIZONTES.map((h) => (
              <button key={h} className={`chip ${horizonte === h ? 'selected' : ''}`} aria-pressed={horizonte === h} onClick={() => onHorizonte(h)}>
                {ROTULO_HORIZONTE[h]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Busca por código ou nome, no mesmo desenho da busca de FIIs (D12) e BDRs. */
function BuscaAcoes({ busca, onSelecionar }: { busca: AcaoBusca[]; onSelecionar: (b: AcaoBusca) => void }) {
  const [termo, setTermo] = useState('')
  const idResultados = useId()
  const resultados = buscarAcoes(busca, termo)
  const buscando = termo.trim().length >= 2

  const escolher = (b: AcaoBusca) => {
    onSelecionar(b)
    setTermo('')
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input
        type="search"
        className="busca-fii"
        placeholder="Código ou nome, ex.: PETR4 ou Itaú"
        aria-label="Buscar ação por código ou nome"
        aria-controls={idResultados}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value.slice(0, 40))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && resultados[0]) {
            e.preventDefault()
            escolher(resultados[0])
          }
          if (e.key === 'Escape') setTermo('')
        }}
      />

      <div id={idResultados} aria-live="polite">
        {buscando && resultados.length > 0 && (
          <ul className="resultados-busca" aria-label="Ações encontradas">
            {resultados.map((b) => (
              <li key={b.ticker}>
                <button className="resultado-busca" onClick={() => escolher(b)}>
                  <span style={{ fontWeight: 700 }}>{b.ticker}</span>
                  <span className="tiny muted resultado-nome">{[b.nome, b.setor !== 'Outros' ? b.setor : null].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando && resultados.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhuma ação encontrada para “{termo.trim()}”.</strong>{' '}
            <span className="muted">
              Confira o código (4 caracteres e um número, como PETR4, VALE3 ou B3SA3). A busca por nome só alcança as empresas da
              lista; para as demais, use o código. Units (código terminado em 11) e ações sem negócio nos últimos meses podem não
              aparecer.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CartaoAcao({
  selecao,
  dataPregao,
  valorEscolhido,
  setValorEscolhido,
  valorLivre,
  setValorLivre,
  destaques,
}: {
  selecao: Selecao
  dataPregao: string | null
  valorEscolhido: number
  setValorEscolhido: (v: number) => void
  valorLivre: string
  setValorLivre: (v: string) => void
  destaques?: DestaquesDoAtivo
}) {
  const completo = selecao.origem === 'lista' ? selecao.acao : null
  const resumo = selecao.origem === 'busca' ? selecao.acao : null
  const acao = selecao.acao
  const setor = selecao.origem === 'lista' ? selecao.setor : selecao.acao.setor
  // Na busca, o preço é o do último negócio, que pode ser anterior ao último pregão.
  const dataFechamento = completo?.dataCotacao ?? resumo?.dataCotacao ?? dataPregao

  const valorDigitado = Number(valorLivre.replace(/\D/g, ''))
  const valor = valorDigitado > 0 ? valorDigitado : valorEscolhido
  const simulacao = simularCompraAcoes(valor, acao.cotacao)

  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <>
      <div id="cartao-acao" className="card col" style={{ gap: 14, scrollMarginTop: 12 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }}><LogoAtivo ticker={acao.ticker} tamanho={36} inline />{acao.ticker}</span>
            {acao.nome && acao.nome !== acao.ticker && (
              <span className="tiny muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {acao.nome}
              </span>
            )}
            <span className="tiny muted">
              {[setor !== 'Outros' ? setor : 'Fora da lista de setores', completo ? `negocia ${formatarVolume(completo.volumeMedio)} por dia` : null]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
          <div className="col" style={{ gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            <span className="tiny muted">Preço da ação</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{reais(acao.cotacao)}</span>
            {dataFechamento && <span className="tiny muted">fechamento de {formatarData(dataFechamento)}</span>}
          </div>
        </div>

        {completo && (
          <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: 1 }}>
              <span className="tiny muted">Variação em 3 meses</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{completo.variacao3m != null ? formatarVariacao(completo.variacao3m) : '—'}</span>
              <span className="tiny muted">só o preço, sem dividendos</span>
            </div>
            <div className="col" style={{ ...caixa, gap: 2, flex: 1 }}>
              <span className="tiny muted">Faixa em 52 semanas</span>
              {completo.minima52 != null && completo.maxima52 != null ? (
                <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                  {reais(completo.minima52)}
                  <br />
                  <span className="muted" style={{ fontWeight: 400 }}>a </span>
                  {reais(completo.maxima52)}
                </span>
              ) : (
                <span style={{ fontWeight: 700, fontSize: 16 }}>—</span>
              )}
              <span className="tiny muted">menor e maior preço</span>
            </div>
          </div>
        )}

        {resumo && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
            <strong>Fora da lista de setores.</strong>{' '}
            <span className="muted">
              {resumo.volumeDia > 0
                ? `No último pregão, esta ação negociou ${formatarVolume(resumo.volumeDia)}. `
                : resumo.dataCotacao
                  ? `Esta ação não teve negócios no último pregão: o preço exibido é o do último negócio, em ${formatarData(resumo.dataCotacao)}. `
                  : 'Esta ação não teve negócios no último pregão, e o preço exibido pode ser de um dia anterior. '}
              Para ações fora da lista, a tela mostra só o preço. Com pouca negociação, comprar ou vender pode levar tempo ou
              exigir aceitar um preço pior.
            </span>
          </div>
        )}
      </div>

      <NosRadares ticker={acao.ticker} d={destaques} usa={SELOS_ACOES} nenhum={`${acao.ticker} não está nos Top 15 (dividendos, endividadas, mais negociadas, Ibovespa) nem tem provento anunciado no radar. A maioria das ações não aparece nesses recortes.`} />

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Quantas ações esse valor compra</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Valor para simular">
          {VALORES_PADRAO.map((v) => (
            <button
              key={v}
              className={`chip ${valorDigitado === 0 && v === valorEscolhido ? 'selected' : ''}`}
              aria-pressed={valorDigitado === 0 && v === valorEscolhido}
              onClick={() => {
                setValorEscolhido(v)
                setValorLivre('')
              }}
            >
              {reais(v).replace(',00', '')}
            </button>
          ))}
          <input
            inputMode="numeric"
            placeholder="Outro valor"
            aria-label="Outro valor em reais"
            value={valorLivre}
            onChange={(e) => setValorLivre(e.target.value.replace(/\D/g, '').slice(0, 9))}
            className="input-cotas"
            style={{ flex: '1 1 110px', width: 'auto' }}
          />
        </div>

        {simulacao && simulacao.quantidade > 0 ? (
          <div className="col" style={{ gap: 0 }}>
            <div className="tabela-bdr small">
              <span className="muted">Ações compradas</span>
              <span style={{ fontWeight: 700 }}>{inteiro(simulacao.quantidade)}</span>
            </div>
            <div className="tabela-bdr small">
              <span className="muted">Valor investido</span>
              <span style={{ fontWeight: 700 }}>{reais(simulacao.investido)}</span>
            </div>
            <div className="tabela-bdr small">
              <span className="muted">Sobra</span>
              <span>{reais(simulacao.sobra)}</span>
            </div>
            <div className="tabela-bdr small">
              <span className="muted">Lotes de 100</span>
              <span>
                {simulacao.lotes > 0 ? `${inteiro(simulacao.lotes)} ${simulacao.lotes === 1 ? 'lote' : 'lotes'}` : 'nenhum'}
                {simulacao.fracionario > 0 ? ` + ${simulacao.fracionario} no fracionário` : ''}
              </span>
            </div>
          </div>
        ) : (
          <span className="small muted">
            {reais(valor)} não compra nenhuma ação de {acao.ticker}: o preço de 1 ação é {reais(acao.cotacao)}.
          </span>
        )}

        <span className="tiny muted justify">
          A conta usa o preço de fechamento exibido, sem corretagem, emolumentos e impostos. É só a divisão do valor pelo preço:
          não é uma projeção de quanto o investimento vai render. O lote padrão da bolsa é de 100 ações; de 1 a 99 ações, a compra
          é feita no mercado fracionário, com o código terminado em F.
        </span>
      </div>
    </>
  )
}
