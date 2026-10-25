import { useMemo } from 'react'
import { useArquivoDados } from '../data/useArquivoDados'
import type { EstadoArquivo } from '../data/useArquivoDados'
import type { AnaliseFundamentalista, Premissas, SnapshotFundamentos } from '../domain/analiseFundamentalista'
import { analisarFundamentos, premissasDaSelic } from '../domain/analiseFundamentalista'
import type { AnaliseTecnica, Horizonte, SnapshotSeries } from '../domain/analiseTecnica'
import { analisarTecnica, mesclarHistorico, montarBarras } from '../domain/analiseTecnica'
import type { Barra, HistoricoLongo } from '../domain/analiseTecnica'
import { useHistoricoLongo } from '../data/useHistoricoLongo'
import type { EstadoHistoricoLongo } from '../data/useHistoricoLongo'
import { analisarConfluencia } from '../domain/confluencia'
import type { Confluencia } from '../domain/confluencia'
import type { SnapshotAcoes } from '../domain/acoes'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'

export const CAMINHO_SERIES = 'dados/acoes-series.json'
export const CAMINHO_FUNDAMENTOS = 'dados/fundamentos.json'

export interface DadosDaAnalise {
  series: EstadoArquivo<SnapshotSeries>
  fundamentos: EstadoArquivo<SnapshotFundamentos>
  recarregarSeries: () => void
  recarregarFundamentos: () => void
  barras: Barra[] | null
  /** Barras do gráfico: histórico longo do COTAHIST (até 5 anos, com abertura) seguido das barras recentes; igual a `barras` sem o arquivo. */
  barrasDoGrafico: Barra[] | null
  historicoLongo: EstadoHistoricoLongo
  tecnica: AnaliseTecnica | null
  fundamentalista: AnaliseFundamentalista | null
  confluencia: Confluencia | null
  premissas: Partial<Premissas>
  /** Motivo de não haver série (ação fora do cadastro, histórico curto). */
  semSerie: string | null
  semFundamentos: string | null
}

/** Selic meta e IPCA de longo prazo (Focus) dos dados oficiais do app, para ancorar a taxa de desconto. */
function premissasDoMercado(): Partial<Premissas> {
  const selic = SNAPSHOT_MERCADO.indicadores.selicMeta?.valor ?? null
  const ipca = SNAPSHOT_MERCADO.focus?.ipca ?? {}
  const anos = Object.keys(ipca).sort()
  const longo = anos.length ? (ipca[anos[anos.length - 1]] ?? null) : null
  return premissasDaSelic(selic, longo)
}

/**
 * Carrega (sob demanda) as séries de preço e os fundamentos e calcula as três análises da ação escolhida. Só baixa os arquivos
 * quando uma das abas de análise está aberta. `precoDe` vem do arquivo de ações do app (cotação de fechamento por código).
 */
export function useAnaliseDaAcao({
  ticker, horizonte, ativo, precoDe, snapshot, seriesInjetadas, fundamentosInjetados, historicoInjetado, premissas,
}: {
  ticker: string | null
  horizonte: Horizonte
  ativo: boolean
  precoDe: (t: string) => number | null
  snapshot: SnapshotAcoes
  seriesInjetadas?: SnapshotSeries
  fundamentosInjetados?: SnapshotFundamentos
  historicoInjetado?: Record<string, HistoricoLongo>
  premissas?: Partial<Premissas>
}): DadosDaAnalise {
  const [series, recarregarSeries] = useArquivoDados<SnapshotSeries>(CAMINHO_SERIES, ativo, seriesInjetadas)
  const [fundamentos, recarregarFundamentos] = useArquivoDados<SnapshotFundamentos>(CAMINHO_FUNDAMENTOS, ativo, fundamentosInjetados)
  const premissasEfetivas = useMemo(() => premissas ?? premissasDoMercado(), [premissas])

  const sequencia = series.tipo === 'pronto' && ticker ? series.dados.ativos[ticker] : undefined
  const barras = useMemo(() => (series.tipo === 'pronto' && sequencia ? montarBarras(series.dados.pregoes, sequencia).barras : null), [series, sequencia])

  const historicoLongo = useHistoricoLongo(ticker, ativo, historicoInjetado)
  const barrasDoGrafico = useMemo(() => {
    if (!barras) return null
    return historicoLongo.tipo === 'pronto' ? mesclarHistorico(historicoLongo.dados, barras).barras : barras
  }, [barras, historicoLongo])

  const tecnica = useMemo(() => {
    if (series.tipo !== 'pronto' || !ticker || !sequencia) return null
    return analisarTecnica({ ticker, pregoes: series.dados.pregoes, pontos: sequencia, referencia: series.dados.referencia, alertas: series.dados.alertas[ticker], horizonte })
  }, [series, ticker, sequencia, horizonte])

  const empresa = fundamentos.tipo === 'pronto' && ticker ? fundamentos.dados.empresas[ticker] : undefined
  const fundamentalista = useMemo(() => {
    if (fundamentos.tipo !== 'pronto' || !empresa) return null
    return analisarFundamentos({
      empresa,
      precoDe,
      todas: Object.values(fundamentos.dados.empresas),
      geradoEm: fundamentos.dados.geradoEm,
      dataCorte: fundamentos.dados.dataCorte,
      dataPreco: snapshot.dataPregao,
      premissas: premissasEfetivas,
      dyB3: (ticker ? SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[ticker] : undefined) ?? SNAPSHOT_ACOES_DIVIDENDOS.ranking?.find((r) => r.ticker === ticker)?.dy ?? null,
    })
  }, [fundamentos, empresa, ticker, precoDe, snapshot.dataPregao, premissasEfetivas])

  const confluencia = useMemo(
    () => (ticker && (tecnica || fundamentalista) ? analisarConfluencia({ ticker, tecnica, fundamentalista, horizonte }) : null),
    [ticker, tecnica, fundamentalista, horizonte],
  )

  const semSerie = !ticker
    ? 'Escolha uma ação.'
    : series.tipo === 'pronto' && !sequencia
      ? 'Esta ação não está no cadastro do app: só as ações da lista por setor têm até 12 meses de histórico guardado.'
      : series.tipo === 'pronto' && !tecnica
        ? 'Histórico de preços curto demais para a análise técnica (menos de 60 pregões com negócio).'
        : null
  const semFundamentos = !ticker
    ? 'Escolha uma ação.'
    : fundamentos.tipo === 'pronto' && !empresa
      ? (() => {
          const fora = fundamentos.dados.excluidas.find((x) => x.ticker === ticker)
          return fora ? `Sem fundamentos publicados para ${ticker}: ${fora.motivo}` : 'Esta ação não está no cadastro de fundamentos do app (só as ações da lista por setor).'
        })()
      : fundamentos.tipo === 'pronto' && !fundamentalista
        ? 'Dados insuficientes para conclusão: a CVM não traz exercícios completos desta empresa.'
        : null

  return { series, fundamentos, recarregarSeries, recarregarFundamentos, barras, barrasDoGrafico, historicoLongo, tecnica, fundamentalista, confluencia, premissas: premissasEfetivas, semSerie, semFundamentos }
}
