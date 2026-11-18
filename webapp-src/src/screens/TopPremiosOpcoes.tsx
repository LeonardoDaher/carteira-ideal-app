import { useEffect, useMemo, useRef, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import { SNAPSHOT_ACOES_ENDIVIDADAS } from '../data/snapshotAcoesEndividadas'
import { storage } from '../data/storage'
import { CHAVE_CODIGO_TOP15_OPCOES, buscarTop15, buscarTop15Opcoes } from '../domain/acessoTop15'
import type { RespostaTop15, RespostaTop15Opcoes } from '../domain/acessoTop15'
import type { SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'
import { LIMITES_DE_DIVIDA, fundamentoDoAtivo, montarIndiceFundamentos, raizDoTicker } from '../domain/fundamentosPremios'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { EscolhaDeSeries, SnapshotOpcoes } from '../domain/opcoes'
import {
  DIAS_DO_MES, DIAS_UTEIS_MINIMOS, FILTRO_PREMIOS_PADRAO, LIMITES_DE_CHANCE, NEGOCIOS_MINIMOS, NEGOCIOS_MINIMOS_FLEXIVEL,
  SEMANAS_DO_MES, TAMANHO_DO_TOP, TAMANHO_MAXIMO_DO_RANKING, calcularTopPremios,
} from '../domain/premios'
import type { FiltroPremios, FiltroVencimentos, LinhaPremio, Operacao, OrdemPremio } from '../domain/premios'
import { PortaoPorCodigo } from '../ui/PortaoPorCodigo'
import { BotaoDeLado, OperacaoDaSerie } from './OperacaoDaSerie'

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

const OPERACOES: { id: Operacao; titulo: string; descricao: string }[] = [
  { id: 'putVendida', titulo: 'Vender put', descricao: 'Você reserva o dinheiro do strike e pode ter de comprar o ativo.' },
  { id: 'callCoberta', titulo: 'Vender call coberta', descricao: 'Você já tem a ação e pode ter de vendê-la pelo strike.' },
]

type EstadoBaratas = { tipo: 'carregando' } | { tipo: 'falhou' } | { tipo: 'ok'; raizes: Set<string> }
type CarregarBaratas = (codigo: string) => Promise<RespostaTop15>
type Armazenamento = Pick<typeof storage, 'getItem'>

// A lista das mais baratas vem do servidor, com o código do mês: guarda o resultado na sessão para não pedir de novo a cada troca de aba.
const CACHE_BARATAS = new Map<string, Set<string>>()

/**
 * Raízes das empresas do Top 15 mais baratas, SÓ se a pessoa já liberou essa lista com o código (guardado neste aparelho pela
 * tela do Simule Ações). Sem código, nada é pedido nem mostrado: a lista é restrita (D50).
 */
function useBaratas(carregar: CarregarBaratas, armazenamento: Armazenamento): EstadoBaratas {
  const [estado, setEstado] = useState<EstadoBaratas>({ tipo: 'carregando' })
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const codigo = ''
      const guardado = carregar === buscarTop15 ? CACHE_BARATAS.get(codigo) : undefined
      if (guardado) return setEstado({ tipo: 'ok', raizes: guardado })
      const resposta = await carregar(codigo)
      if (!vivo) return
      if (!resposta.ok) return setEstado({ tipo: 'falhou' })
      const raizes = new Set(resposta.snapshot.ranking.map((item) => raizDoTicker(item.ticker)))
      if (carregar === buscarTop15) CACHE_BARATAS.set(codigo, raizes)
      setEstado({ tipo: 'ok', raizes })
    })()
    return () => {
      vivo = false
    }
  }, [carregar, armazenamento])
  return estado
}

type PropsDaLista = {
  snapshot: SnapshotOpcoes
  onSimular: (e: EscolhaDeSeries) => void
  /** Injetáveis nos testes. */
  endividadas?: SnapshotAcoesEndividadas
  carregarBaratas?: CarregarBaratas
  armazenamento?: Armazenamento
}

/**
 * Porta do Top 15 de prêmios: como as demais listas (D50, D65, D70), só abre com o código do mês, próprio desta lista (D66,
 * variável TOP15_OPCOES_CODIGOS da Vercel). A porta confere o código no servidor; o ranking em si é calculado aqui, com o
 * arquivo de opções, que é aberto (ver D117).
 */
export function TopPremiosOpcoes({
  semPortao = false, carregarAcesso = buscarTop15Opcoes, armazenamentoDoAcesso = storage, ...resto
}: PropsDaLista & {
  /** Só para testes e telas internas: pula a porta do código. */
  semPortao?: boolean
  carregarAcesso?: (codigo: string) => Promise<RespostaTop15Opcoes>
  armazenamentoDoAcesso?: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
}) {
  if (semPortao) return <ListaDePremios {...resto} />
  return (
    <PortaoPorCodigo
      titulo="Top 15 prêmios de opções: acesso por código"
      oQueLibera="Com ele você vê o ranking dos maiores prêmios para quem vende put ou call coberta, com o risco de cada série ao lado."
      instagram="acarteiraideal"
      carregar={carregarAcesso}
      armazenamento={armazenamentoDoAcesso}
      chaveArmazenamento={CHAVE_CODIGO_TOP15_OPCOES}
      idDeTeste="top15-opcoes-codigo"
      renderizar={() => <ListaDePremios {...resto} />}
    />
  )
}

/**
 * Top 15 dos maiores prêmios para quem vende opção: rendimento do prêmio sobre o dinheiro travado, com o risco ao lado
 * (colchão, chance de exercício e volatilidade). O risco é um limite escolhido pela pessoa; o ranking compara os prêmios
 * dentro dele. Cruzado com a dívida da empresa (lista das mais endividadas, aberta) e, para quem liberou, com o Top 15
 * mais baratas. Descritivo: não é recomendação de operação.
 */
function ListaDePremios({
  snapshot, onSimular, endividadas = SNAPSHOT_ACOES_ENDIVIDADAS, carregarBaratas = buscarTop15, armazenamento = storage,
}: PropsDaLista) {
  const [filtro, setFiltro] = useState<FiltroPremios>(FILTRO_PREMIOS_PADRAO)
  const juros = jurosPadrao()
  const fundamentos = useMemo(() => montarIndiceFundamentos(endividadas), [endividadas])
  const baratas = useBaratas(carregarBaratas, armazenamento)
  const raizesBaratas = baratas.tipo === 'ok' ? baratas.raizes : null
  const hojeDaBase = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const mensaisDaBase = useMemo(
    () => vencimentosDe(snapshot.ativos.flatMap((a) => a.series)).filter((v) => tipoVencimento(v) === 'mensal' && v > hojeDaBase).slice(0, 6),
    [snapshot, hojeDaBase],
  )
  const mudar = (parcial: Partial<FiltroPremios>) => setFiltro((f) => ({ ...f, ...parcial }))
  // O ranking vai até 100 posições: as 15 primeiras ficam na tabela principal e o resto no card "Ver mais".
  const ranking = useMemo(
    () => calcularTopPremios(snapshot, filtro, juros, TAMANHO_MAXIMO_DO_RANKING, { fundamentos, baratas: raizesBaratas }),
    [snapshot, filtro, juros, fundamentos, raizesBaratas],
  )
  const linhas = ranking.slice(0, TAMANHO_DO_TOP)
  const resto = ranking.slice(TAMANHO_DO_TOP)
  const [verMais, setVerMais] = useState(false)
  const coberta = filtro.operacao === 'callCoberta'

  // V (vender) monta a operação ali mesmo, abaixo da tabela: clicar de novo no mesmo botão desfaz. "Simular" leva a série à aba
  // Estratégias, para montar estruturas com esse strike.
  const [vendida, setVendida] = useState<string | null>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const vender = (codigo: string) => {
    const repetido = vendida === codigo
    setVendida(repetido ? null : codigo)
    if (!repetido) setTimeout(() => painelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }
  const linhaVendida = vendida ? (ranking.find((l) => l.serie.codigo === vendida) ?? null) : null

  const simular = (l: LinhaPremio) => onSimular({ ativo: l.ativo, series: [l.serie], lado: 'venda', coberta })

  // A mesma tabela serve ao Top 15 e à continuação do ranking (posições 16 em diante).
  const tabela = (lista: LinhaPremio[], inicio: number, testid: string) => (
    <div style={{ overflowX: 'auto' }} className="card-outline">
      <table className="tabela-opcoes small">
        <thead>
          <tr>
            <th scope="col" title="Vender esta série: monta a operação aqui mesmo">Vender</th>
            <th scope="col">#</th>
            <th scope="col">Ativo</th>
            <th scope="col">Série</th>
            <th scope="col">Strike</th>
            <th scope="col">Vence (d.u.)</th>
            <th scope="col">Prêmio</th>
            <th scope="col" title="Prêmio sobre o dinheiro travado, até o vencimento">Rend. no prazo (%)</th>
            <th scope="col" title={`Rendimento levado a ${DIAS_DO_MES} dias úteis`}>Rend. {DIAS_DO_MES} d.u. (%)</th>
            <th scope="col" title="Quanto o ativo pode cair antes de dar prejuízo no vencimento">Colchão (%)</th>
            {coberta && <th scope="col" title="Ganho se o ativo subir até o strike e a ação for vendida, contando o prêmio">Se exercida (%)</th>}
            <th scope="col" title="Chance de a opção ser exercida, pelo modelo">Chance exerc. (%)</th>
            <th scope="col" title="Volatilidade implícita no último preço">Vol. impl. (%)</th>
            {fundamentos && <th scope="col" title="Dívida líquida dividida pelo EBITDA dos últimos 12 meses, e a posição na lista das mais endividadas">Dív. líq./EBITDA</th>}
            <th scope="col">Neg.</th>
            <th scope="col" title="Levar esta série para a aba Estratégias, para montar estruturas com esse strike">Estruturas</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((l, k) => {
            const f = fundamentoDoAtivo(fundamentos, l.ativo.ticker)
            const barata = raizesBaratas?.has(raizDoTicker(l.ativo.ticker)) ?? false
            return (
              <tr key={l.serie.codigo} data-testid={testid} className={vendida === l.serie.codigo ? 'linha-marcada' : undefined}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <BotaoDeLado lado="venda" codigo={l.serie.codigo} escolhido={vendida === l.serie.codigo} onClick={() => vender(l.serie.codigo)} />
                </td>
                <td>{inicio + k + 1}</td>
                <td>
                  <strong>{l.ativo.ticker}</strong> <span className="muted">{reais(l.ativo.cotacao)}</span>
                  {barata && (
                    <div className="tiny" style={{ color: 'var(--mc-pos)', fontWeight: 700 }} data-testid="selo-barata">Top 15 mais baratas</div>
                  )}
                </td>
                <td style={{ fontWeight: 700 }}>{l.serie.codigo}</td>
                <td className="num">{num(l.serie.strike)}</td>
                <td>{formatarData(l.serie.vencimento)} ({l.diasUteis})</td>
                <td className="num">{num(l.serie.ultimo)}</td>
                <td className="num">{num(l.rendimentoPrazo)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{num(l.rendimentoMes)}</td>
                <td className="num">{num(l.colchao)}</td>
                {coberta && <td className="num">{l.ganhoSeExercida === null ? '—' : num(l.ganhoSeExercida)}</td>}
                <td className="num">{num(l.chanceExercicio, 1)}</td>
                <td className="num">{num(l.volImplicita, 1)}</td>
                {fundamentos && (
                  <td data-testid="celula-divida">
                    {!f ? (
                      <span className="muted" title="Fora da lista: banco, seguradora, ETF, pouca liquidez ou setor excluído">—</span>
                    ) : f.semEbitdaPositivo ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>sem EBITDA positivo</span>
                    ) : (
                      <>
                        {num(f.dlEbitda ?? 0, 1)}x{' '}
                        {f.noTop ? (
                          <span className="tiny" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                            {f.posicao}ª mais endividada
                          </span>
                        ) : (
                          <span className="tiny muted">({f.posicao}ª de {fundamentos.total})</span>
                        )}
                      </>
                    )}
                  </td>
                )}
                <td className="num">{l.serie.negocios.toLocaleString('pt-BR')}</td>
                <td>
                  <button className="chip" onClick={() => simular(l)} aria-label={`Simular a venda de ${l.serie.codigo}`}>Simular</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // O painel da venda (botão V) aparece logo abaixo da tabela em que está a linha escolhida.
  const vendidaNoTop = !linhaVendida || linhas.some((l) => l.serie.codigo === linhaVendida.serie.codigo)
  const painel = linhaVendida && (
    <div ref={painelRef} className="col" style={{ gap: 10, scrollMarginTop: 12 }} data-testid="operacao-da-serie">
      <OperacaoDaSerie
        key={linhaVendida.serie.codigo + (coberta ? ':coberta' : '')}
        ativo={linhaVendida.ativo}
        serie={linhaVendida.serie}
        lado="venda"
        coberta={coberta}
        hoje={snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)}
        aoFechar={() => setVendida(null)}
      />
    </div>
  )

  return (
    <>
      <div className="card-outline small justify" style={{ lineHeight: 1.5 }}>
        <strong>Quem paga o maior prêmio, para um mesmo risco?</strong>{' '}
        <span className="muted">
          O ranking mede o prêmio recebido sobre o dinheiro que fica travado ({coberta ? 'o preço da ação' : 'o strike'}),
          levado a {DIAS_DO_MES} dias úteis para comparar prazos diferentes. Prêmio alto costuma ser o mercado cobrando por
          risco alto, por isso você escolhe o limite de risco, e a tabela mostra o colchão, a chance de exercício, a
          volatilidade e a dívida de cada empresa.
        </span>
      </div>

      <div className="card col" style={{ gap: 12 }} role="group" aria-label="Filtros do ranking de prêmios">
        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Operação</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Operação">
            {OPERACOES.map((o) => (
              <button key={o.id} className={`chip ${filtro.operacao === o.id ? 'selected' : ''}`} aria-pressed={filtro.operacao === o.id} onClick={() => mudar({ operacao: o.id })}>
                {o.titulo}
              </button>
            ))}
          </div>
          <span className="tiny muted">{OPERACOES.find((o) => o.id === filtro.operacao)!.descricao}</span>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Risco máximo (chance de a opção ser exercida)</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Risco máximo">
            {LIMITES_DE_CHANCE.map((limite) => (
              <button
                key={String(limite)}
                className={`chip ${filtro.chanceMaxima === limite ? 'selected' : ''}`}
                aria-pressed={filtro.chanceMaxima === limite}
                onClick={() => mudar({ chanceMaxima: limite })}
              >
                {limite === null ? 'Sem limite' : `Até ${limite}%`}
              </button>
            ))}
          </div>
          <span className="tiny muted">
            Quanto menor o limite, mais afastado o strike e menor o prêmio. Compare os ativos dentro do mesmo limite.
          </span>
        </div>

        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Vencimentos</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Vencimentos do ranking">
              {([['mensais', 'Mensais'], ['semanais', 'Semanais'], ['todos', 'Todos']] as [FiltroVencimentos, string][]).map(([v, nome]) => (
                <button key={v} className={`chip ${filtro.vencimentos === v ? 'selected' : ''}`} aria-pressed={filtro.vencimentos === v} onClick={() => mudar({ vencimentos: v })}>
                  {nome}
                </button>
              ))}
            </div>
            {filtro.vencimentos === 'mensais' && (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Vencimento mensal">
                <button className={`chip ${filtro.mensal === null ? 'selected' : ''}`} aria-pressed={filtro.mensal === null} onClick={() => mudar({ mensal: null })}>Todos</button>
                {mensaisDaBase.map((v, i) => (
                  <button
                    key={v}
                    className={`chip ${filtro.mensal === v ? 'selected' : ''}`}
                    aria-pressed={filtro.mensal === v}
                    onClick={() => mudar({ mensal: v })}
                    title={i === 0 ? 'Próximo vencimento mensal' : undefined}
                  >
                    {formatarData(v)} · {diasUteis(v, hojeDaBase)} d.u.
                  </button>
                ))}
              </div>
            )}
            {filtro.vencimentos === 'semanais' && (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Semana do vencimento">
                <button className={`chip ${filtro.semana === null ? 'selected' : ''}`} aria-pressed={filtro.semana === null} onClick={() => mudar({ semana: null })}>Todos</button>
                {SEMANAS_DO_MES.map((w) => (
                  <button
                    key={w}
                    className={`chip ${filtro.semana === w ? 'selected' : ''}`}
                    aria-pressed={filtro.semana === w}
                    onClick={() => mudar({ semana: w })}
                    title={`Vencimentos semanais da ${w}ª sexta-feira do mês`}
                  >
                    W{w}
                  </button>
                ))}
              </div>
            )}
            <span className="tiny muted">Mensais comparam melhor: o rendimento das semanais, levado a {DIAS_DO_MES} dias úteis, fica exagerado. W1, W2, W4 e W5 são a 1ª, 2ª, 4ª e 5ª sexta do mês; a 3ª é a mensal, por isso não há W3.</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Ordenar por</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Ordem do ranking">
              {([['mes', `Rendimento em ${DIAS_DO_MES} d.u.`], ['prazo', 'Rendimento até o vencimento']] as [OrdemPremio, string][]).map(([v, nome]) => (
                <button key={v} className={`chip ${filtro.ordem === v ? 'selected' : ''}`} aria-pressed={filtro.ordem === v} onClick={() => mudar({ ordem: v })}>
                  {nome}
                </button>
              ))}
            </div>
          </div>
        </div>

        {fundamentos && (
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Dívida da empresa (dívida líquida ÷ EBITDA)</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Limite de dívida">
              {LIMITES_DE_DIVIDA.map((limite) => (
                <button
                  key={String(limite)}
                  className={`chip ${filtro.dividaMaxima === limite ? 'selected' : ''}`}
                  aria-pressed={filtro.dividaMaxima === limite}
                  onClick={() => mudar({ dividaMaxima: limite })}
                >
                  {limite === null ? 'Sem limite' : `Até ${limite}x`}
                </button>
              ))}
            </div>
            <span className="tiny muted">
              Com limite, saem as empresas acima dele e as sem EBITDA positivo. Quem não tem o dado (bancos, ETFs, pouca
              liquidez) continua na lista, com “—” na coluna. Balanços da CVM até {fundamentos.dataCorte ? formatarData(fundamentos.dataCorte) : 'a data de corte'}.
            </span>
          </div>
        )}

        {baratas.tipo === 'ok' && (
          <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={filtro.soBaratas} onChange={(ev) => mudar({ soBaratas: ev.target.checked })} />
            Só as empresas do Top 15 mais baratas
          </label>
        )}
        {baratas.tipo === 'falhou' && (
          <span className="tiny muted" role="status">Não consegui conferir o Top 15 mais baratas agora; o ranking segue sem essa marca.</span>
        )}

        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={filtro.umPorAtivo} onChange={(ev) => mudar({ umPorAtivo: ev.target.checked })} />
          Só a melhor série de cada ativo
        </label>
        <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={filtro.poucoLiquidas} onChange={(ev) => mudar({ poucoLiquidas: ev.target.checked })} />
          Incluir séries pouco negociadas (a partir de {NEGOCIOS_MINIMOS_FLEXIVEL} negócios; o padrão é {NEGOCIOS_MINIMOS})
        </label>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }} aria-live="polite">
          {linhas.length === 0 ? 'Nenhuma série atende aos filtros.' : `Top ${linhas.length} de ${TAMANHO_DO_TOP}: ${coberta ? 'calls cobertas' : 'puts vendidas'}`}
        </span>

        {linhas.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <span className="muted">
              Só entram séries que negociaram no último pregão, com pelo menos {DIAS_UTEIS_MINIMOS} dias úteis até o vencimento
              e {coberta ? 'strike a partir do preço do ativo' : 'strike até o preço do ativo'}. Aumente o limite de risco ou de dívida, ou inclua as séries pouco negociadas.
            </span>
          </div>
        )}

        {linhas.length > 0 && tabela(linhas, 0, 'linha-premio')}

        {vendidaNoTop && painel}

        {resto.length > 0 && (
          <div className="card col" style={{ gap: 10 }} data-testid="ver-mais">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="small" style={{ fontWeight: 600 }}>
                {verMais
                  ? `Continuação do ranking: posições ${TAMANHO_DO_TOP + 1} a ${TAMANHO_DO_TOP + resto.length}`
                  : `Mais ${resto.length} ${resto.length === 1 ? 'série' : 'séries'} no ranking, até a ${TAMANHO_DO_TOP + resto.length}ª posição`}
              </span>
              <button className="chip" aria-expanded={verMais} onClick={() => setVerMais((v) => !v)}>
                {verMais ? 'Mostrar menos' : 'Ver mais'}
              </button>
            </div>
            {verMais && (
              <>
                <span className="tiny muted justify">
                  Mesmos filtros e mesma ordem, até {TAMANHO_MAXIMO_DO_RANKING} resultados. Quanto mais abaixo, menor o rendimento: confira o número de negócios (Neg.) e a chance de exercício antes de olhar só o prêmio.
                </span>
                {tabela(resto, TAMANHO_DO_TOP, 'linha-premio-extra')}
              </>
            )}
          </div>
        )}

        {!vendidaNoTop && painel}

        <span className="tiny muted justify">
          <strong>V</strong> monta a venda da série aqui mesmo, com o gráfico. <strong>Simular</strong> leva a série para a aba Estratégias, para montar travas e outras estruturas com esse strike.
        </span>

        <details className="card-outline small justify" style={{ lineHeight: 1.5 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Como o ranking é calculado</summary>
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            <span className="muted">
              <strong>Rendimento.</strong> {coberta ? 'Prêmio ÷ preço do ativo' : 'Prêmio ÷ strike'}, até o vencimento. Para comparar prazos
              diferentes, a segunda coluna leva o rendimento a {DIAS_DO_MES} dias úteis por regra de três simples, sem juros
              compostos (composição inflaria as opções semanais).
            </span>
            <span className="muted">
              <strong>Só prêmio de verdade.</strong> {coberta ? 'Calls com strike abaixo do preço' : 'Puts com strike acima do preço'} ficam
              de fora: parte do preço delas é valor intrínseco, e não prêmio.
            </span>
            <span className="muted">
              <strong>Colchão.</strong> {coberta ? 'O prêmio recebido, em % do preço do ativo' : 'Quanto o ativo pode cair, em %, antes de a operação dar prejuízo no vencimento (a queda até o strike mais o prêmio)'}.
            </span>
            <span className="muted">
              <strong>Chance de exercício.</strong> Estimativa do modelo de Black-Scholes com a volatilidade implícita no último
              preço, neutra ao risco: serve para comparar linhas entre si, não para prever o que vai acontecer.
            </span>
            <span className="muted">
              <strong>Por que um limite de risco.</strong> Dividir o prêmio pelo risco sempre favoreceria as opções perto do
              preço, porque o prêmio cai mais rápido do que o risco quando o strike se afasta. Fixando o risco, a pergunta
              fica justa: para a mesma chance de exercício, quem paga mais? Em geral, os ativos mais voláteis, e a
              volatilidade na tabela mostra o risco que está por trás desse prêmio.
            </span>
            <span className="muted">
              <strong>Dívida da empresa.</strong> Vem da lista das mais endividadas do app (dívida líquida ÷ EBITDA, balanços da
              CVM), e não é recalculada aqui. Prêmio alto com dívida alta é o mercado avisando de um risco que o preço da opção já
              inclui; prêmio alto em empresa pouco endividada merece mais atenção. A marca “Top 15 mais baratas” só aparece para
              quem liberou essa lista com o código. A dívida considera só empréstimos e financiamentos (com debêntures): arrendamentos, comuns em varejo e locadoras, não entram, e a razão não mede prazo, custo nem moeda. O cruzamento é um filtro para começar a análise, e não uma indicação.
            </span>
            <span className="muted">
              <strong>Limites.</strong> O preço é o do último negócio, e não o de compra e venda, então o prêmio realmente
              recebido pode ser menor. Entram só séries que negociaram no último pregão, com no mínimo {DIAS_UTEIS_MINIMOS} dias
              úteis até o vencimento. Dividendos, corretagem, emolumentos, IR e margem de garantia ficam de fora.
            </span>
          </div>
        </details>
      </div>
    </>
  )
}
