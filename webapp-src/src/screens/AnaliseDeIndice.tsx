import { useMemo, useState } from 'react'
import { AnaliseTecnicaAcao } from './AnaliseTecnicaAcao'
import type { DadosTecnicos } from './AnaliseTecnicaAcao'
import { useHistoricoLongo } from '../data/useHistoricoLongo'
import { analisarTecnica, montarBarras } from '../domain/analiseTecnica'
import type { Barra, Horizonte, HistoricoLongo, PontoSerie } from '../domain/analiseTecnica'
import { ROTULO_HORIZONTE } from '../domain/confluencia'
import { dataLonga } from '../ui/formatoAnalise'

/** Os dois índices que têm análise técnica: o Ibovespa (no Simule Ações) e o IFIX (no Simule FII). */
export const INDICES_COM_ANALISE = {
  IBOV: { nome: 'Ibovespa', descricao: 'índice das ações mais negociadas da B3' },
  IFIX: { nome: 'IFIX', descricao: 'índice dos fundos imobiliários mais negociados da B3' },
} as const
export type CodigoDeIndice = keyof typeof INDICES_COM_ANALISE

/** A leitura de tendência olha os últimos 12 meses (como nas ações); o gráfico usa o histórico inteiro. */
const PREGOES_DA_LEITURA = 260

/**
 * Histórico do índice -> o mesmo pacote de dados que a análise técnica das ações recebe. As barras do arquivo têm abertura real; a
 * leitura (tendência, zonas, nota) é calculada sobre os últimos 12 meses, como na ação. Índice não tem volume: se o arquivo não
 * trouxer, o volume fica 0 e a tela esconde tudo o que depende dele.
 */
export function dadosTecnicosDoIndice(longo: HistoricoLongo, codigo: string, horizonte: Horizonte, historicoLongo: DadosTecnicos['historicoLongo']): DadosTecnicos {
  const barrasLongas: Barra[] = longo.barras.map(([data, abe, max, min, fech, vol]) => ({ data, abe, fech, min, max, vol }))
  const recentes = barrasLongas.slice(-PREGOES_DA_LEITURA)
  const pregoes = recentes.map((b) => b.data)
  const pontos: PontoSerie[] = recentes.map((b) => [b.fech, b.min, b.max, b.vol])
  const tecnica = analisarTecnica({ ticker: codigo, pregoes, pontos, horizonte, unidade: 'pontos', semVolume: true })
  return {
    series: { tipo: 'pronto', dados: { geradoEm: null, dataPregao: longo.ate, fonte: 'B3', pregoes, referencia: null, alertas: {}, ativos: { [codigo]: pontos } } },
    recarregarSeries: () => {},
    barras: montarBarras(pregoes, pontos).barras,
    barrasDoGrafico: barrasLongas,
    historicoLongo,
    tecnica,
    semSerie: tecnica ? null : `O histórico de ${codigo} tem ${recentes.length} pregões; a leitura precisa de pelo menos 60.`,
  }
}

/**
 * Análise técnica de um índice (IBOV no Simule Ações, IFIX no Simule FII): a mesma aba das ações, com valores em pontos e sem volume.
 * O histórico vem de dados/indices-historico/<CODIGO>.json; `injetado` só existe para os testes.
 */
export function AnaliseDeIndice({ codigo, injetado }: { codigo: CodigoDeIndice; injetado?: Record<string, HistoricoLongo> }) {
  const { nome, descricao } = INDICES_COM_ANALISE[codigo]
  const [horizonte, setHorizonte] = useState<Horizonte>('medio')
  const estado = useHistoricoLongo(codigo, true, injetado, 'indices-historico')
  const dados = useMemo(() => (estado.tipo === 'pronto' ? dadosTecnicosDoIndice(estado.dados, codigo, horizonte, estado) : null), [estado, codigo, horizonte])

  if (estado.tipo === 'ocioso' || estado.tipo === 'carregando') {
    return <div className="card muted small" role="status">Carregando o histórico do {nome}…</div>
  }
  if (estado.tipo !== 'pronto') {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>{estado.tipo === 'erro' ? `Não foi possível abrir o histórico do ${nome}.` : `O histórico do ${nome} ainda não foi carregado.`}</span>
        <span className="muted small justify">
          {estado.tipo === 'erro' ? 'Verifique a conexão e abra a tela de novo.' : 'Os pontos diários do índice, com abertura, máxima, mínima e fechamento, são atualizados nos dias úteis, depois do fechamento da B3. Volte mais tarde.'}
        </span>
      </div>
    )
  }

  if (!dados) return null

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card col" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>{nome} <span className="muted" style={{ fontWeight: 400 }}>({codigo})</span></span>
        <span className="small muted justify">
          Análise gráfica do {descricao}. Último pregão no histórico: {dataLonga(estado.dados.ate)}.
        </span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Horizonte da leitura">
          {(Object.keys(ROTULO_HORIZONTE) as Horizonte[]).map((h) => (
            <button key={h} className={`chip ${horizonte === h ? 'selected' : ''}`} aria-pressed={horizonte === h} onClick={() => setHorizonte(h)}>
              {ROTULO_HORIZONTE[h]}
            </button>
          ))}
        </div>
      </div>
      <AnaliseTecnicaAcao dados={dados} ticker={codigo} nome={nome} horizonte={horizonte} unidade="pontos" />
    </div>
  )
}
