import { useId, useMemo, useState } from 'react'
import { SNAPSHOT_ETFS_MAIS_NEGOCIADOS } from '../data/snapshotTop15Mercado'
import { NosRadares } from '../ui/DestaquesDoAtivo'
import { indexarDestaques } from '../domain/destaquesRadares'
import type { IndiceDeDestaques } from '../domain/destaquesRadares'
import { SNAPSHOT_ETFS } from '../data/snapshotEtfs'
import { VALORES_PADRAO, formatarVariacao, simularCompra } from '../domain/bdrs'
import { agruparPorCategoria, buscarEtfs, textoCambio, textoIrCurto } from '../domain/etfs'
import type { EtfBusca, EtfLista, SnapshotEtfs } from '../domain/etfs'
import { formatarData, formatarVolume } from '../domain/rendaFii'
import { VoltarInicio } from '../ui/VoltarInicio'
import { FaixaCotacoes, itensDeEtfs } from '../ui/FaixaCotacoes'
import { rolarParaResultado } from '../ui/rolarParaResultado'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import { Top15EtfsMaisNegociados } from './Top15EtfsMaisNegociados'
import type { AppCtx } from '../state/useAppState'

/** Radares que valem aqui: liquidez, no geral e na categoria. */
const SELOS_ETF = ['maisNegociado', 'naCategoria'] as const

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inteiro(valor: number) {
  return valor.toLocaleString('pt-BR')
}

/** O que está aberto no cartão: um ETF da lista (dado completo) ou um da busca (resumido). */
type Selecao = { origem: 'lista'; etf: EtfLista } | { origem: 'busca'; etf: EtfBusca }

/**
 * Aba "Simule ETF" (decisão D23). O simulador é estritamente descritivo: os 40 ETFs da B3 mais
 * negociados, agrupados por categoria e ordenados por volume, com a busca para os demais.
 * Sem múltiplos de avaliação, sem projeção de retorno. Dados oficiais da B3. Desde a D70 há uma segunda aba,
 * "Top 15 mais negociados": o ranking por volume (liquidez), que não diz nada sobre qualidade ou preço.
 */
export function SimuleEtf({
  snapshot = SNAPSHOT_ETFS,
  destaques,
}: {
  /** Recebido como as demais telas avulsas; esta tela só volta à landing. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job diário. */
  snapshot?: SnapshotEtfs
  /** Só nos testes: destaques dos radares por código; no app, vêm do Top 15 mais negociados. */
  destaques?: IndiceDeDestaques
}) {
  const indiceDestaques = useMemo(() => destaques ?? indexarDestaques({ maisNegociados: SNAPSHOT_ETFS_MAIS_NEGOCIADOS, hoje: '' }), [destaques])
  const grupos = agruparPorCategoria(snapshot.etfs, snapshot.ordemCategorias)
  const primeiro = grupos[0]?.etfs[0]
  const [selecao, setSelecao] = useState<Selecao | undefined>(primeiro ? { origem: 'lista', etf: primeiro } : undefined)
  const [valorLivre, setValorLivre] = useState('')
  const [valorEscolhido, setValorEscolhido] = useState<number>(VALORES_PADRAO[1])
  const [aba, setAba] = useState<'simulador' | 'top15'>('simulador')

  const levarAoCartao = () => rolarParaResultado('cartao-etf')

  const abrir = (nova: Selecao) => {
    setSelecao(nova)
    levarAoCartao()
  }

  const abrirDaBusca = (e: EtfBusca) => {
    const naLista = snapshot.etfs.find((x) => x.ticker === e.ticker)
    abrir(naLista ? { origem: 'lista', etf: naLista } : { origem: 'busca', etf: e })
  }

  const selecionado = selecao?.etf.ticker

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule ETF</h1>
        <div className="muted small justify">
          ETFs são fundos negociados na B3 como ações, que acompanham um índice: da bolsa brasileira, de bolsas de fora, de
          títulos de renda fixa, do ouro ou de criptomoedas. Escolha um na lista ou busque pelo código, e veja o preço de
          fechamento e quantas cotas um valor compra.
        </div>
      </div>

      <FaixaCotacoes itens={itensDeEtfs(snapshot)} dataPregao={snapshot.dataPregao} />

      <AbasDaTela
        prefixo="etf"
        rotulo="O que você quer ver"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'simulador', emoji: '🧮', titulo: 'Simulador', descricao: 'Preço e quantas cotas compra' },
          { id: 'top15', emoji: '📊', titulo: 'Top 15 mais negociados', descricao: 'Ranking por volume, com auditoria' },
        ] as const}
      >
      {aba === 'top15' ? (
        <Top15EtfsMaisNegociados />
      ) : (
      <>
      {!selecao ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Os dados dos ETFs ainda não foram carregados.</span>
          <span className="muted small justify">
            As cotações são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.
          </span>
        </div>
      ) : (
        // No computador: busca e lista por categoria à esquerda, cartão do ETF fixo à direita (D20).
        <div className="desk-split">
          <div className="desk-main">
            <BuscaEtf busca={snapshot.busca ?? []} onSelecionar={abrirDaBusca} />

            {snapshot.criterio && (
              <div className="small muted justify" style={{ lineHeight: 1.5 }}>
                A lista mostra os <strong>{snapshot.criterio.maxEtfs} ETFs</strong> com maior volume negociado em média nos
                últimos {snapshot.sessoesLiquidez ?? 21} pregões, em ordem de volume dentro de cada categoria. Os demais estão
                na busca acima.
              </div>
            )}

            <div className="col" style={{ gap: 18 }}>
              {grupos.map((g) => (
                <div key={g.categoria} className="col" style={{ gap: 8 }}>
                  <h2 className="titulo-setor font-display">{g.categoria}</h2>
                  <div className="grade-tickers" role="group" aria-label={`ETFs da categoria ${g.categoria}`}>
                    {g.etfs.map((e) => (
                      <button
                        key={e.ticker}
                        className={`chip ${e.ticker === selecionado ? 'selected' : ''}`}
                        aria-pressed={e.ticker === selecionado}
                        onClick={() => abrir({ origem: 'lista', etf: e })}
                      >
                        {e.ticker}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="desk-side">
            <CartaoEtf
              selecao={selecao}
              dataPregao={snapshot.dataPregao}
              valorEscolhido={valorEscolhido}
              setValorEscolhido={setValorEscolhido}
              valorLivre={valorLivre}
              setValorLivre={setValorLivre}
            />
            <NosRadares ticker={selecao.etf.ticker} d={indiceDestaques.get(selecao.etf.ticker)} usa={SELOS_ETF} nenhum={`${selecao.etf.ticker} não está no Top 15 mais negociados nem entre os mais negociados da sua categoria. A maioria dos ETFs não aparece nesses recortes.`} />
          </div>
        </div>
      )}

      <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Como o IR funciona nos ETFs.</strong>{' '}
        <span className="muted">
          Depende do tipo de ETF. Nos de <strong>renda fixa</strong>, o imposto é retido na fonte quando você vende: 25% se o
          prazo médio da carteira do fundo for de até 180 dias, 20% de 181 a 720 dias e 15% acima de 720 dias; não há DARF a
          pagar, e o prejuízo não pode ser descontado de outros ganhos. Nos <strong>demais</strong> (bolsa, cripto, ouro, dólar e
          commodities), o ganho na venda paga 15% (20% em day trade), calculado e pago pelo próprio investidor por DARF, sem a
          isenção para vendas de até R$ 20 mil por mês que vale para ações. Alguns ETFs distribuem rendimentos: nos de renda
          variável, 15% são retidos na data da distribuição. Regras tributárias mudam: confirme com um contador antes de
          declarar.
        </span>
      </div>

      </>
      )}
      </AbasDaTela>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Rentabilidade obtida no passado não representa garantia de rentabilidade futura.</strong> ETFs de bolsa
        exterior podem variar também com o dólar, conforme a estrutura de cada fundo; ETFs de renda fixa também oscilam de
        preço até o vencimento dos títulos da carteira. Estar na lista, na busca ou no Top 15 não é uma indicação de compra: o critério
        é só o volume negociado.
        {snapshot.geradoEm ? ` Dados oficiais da B3 (Boletim de Preços), atualizados em ${formatarData(snapshot.geradoEm)}.` : ''}
      </div>

      <AvisoEducacional />
    </div>
  )
}

/** Busca por código ou nome, no mesmo desenho das buscas de FIIs e BDRs. */
function BuscaEtf({ busca, onSelecionar }: { busca: EtfBusca[]; onSelecionar: (e: EtfBusca) => void }) {
  const [termo, setTermo] = useState('')
  const idResultados = useId()
  const resultados = buscarEtfs(busca, termo)
  const buscando = termo.trim().length >= 2

  const escolher = (e: EtfBusca) => {
    onSelecionar(e)
    setTermo('')
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input
        type="search"
        className="busca-fii"
        placeholder="Código ou nome, ex.: IVVB11"
        aria-label="Buscar ETF por código ou nome"
        aria-controls={idResultados}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={termo}
        onChange={(ev) => setTermo(ev.target.value.slice(0, 40))}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' && resultados[0]) {
            ev.preventDefault()
            escolher(resultados[0])
          }
          if (ev.key === 'Escape') setTermo('')
        }}
      />

      <div id={idResultados} aria-live="polite">
        {buscando && resultados.length > 0 && (
          <ul className="resultados-busca" aria-label="ETFs encontrados">
            {resultados.map((e) => (
              <li key={e.ticker}>
                <button className="resultado-busca" onClick={() => escolher(e)}>
                  <span style={{ fontWeight: 700 }}>{e.ticker}</span>
                  <span className="tiny muted resultado-nome">{[e.nome !== e.ticker ? e.nome : null, e.categoria].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando && resultados.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhum ETF encontrado para “{termo.trim()}”.</strong>{' '}
            <span className="muted">
              Confira o código (4 letras ou números e o final 11, como BOVA11). BDRs de ETF, com final 39, ficam no Simule BDR.
              Fundos de debêntures incentivadas de infraestrutura não aparecem aqui: não são fundos de índice.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CartaoEtf({
  selecao,
  dataPregao,
  valorEscolhido,
  setValorEscolhido,
  valorLivre,
  setValorLivre,
}: {
  selecao: Selecao
  dataPregao: string | null
  valorEscolhido: number
  setValorEscolhido: (v: number) => void
  valorLivre: string
  setValorLivre: (v: string) => void
}) {
  const completo = selecao.origem === 'lista' ? selecao.etf : null
  const resumo = selecao.origem === 'busca' ? selecao.etf : null
  const etf = selecao.etf
  const cambio = completo && completo.categoria === 'Bolsa exterior' ? textoCambio(completo.cambio) : null
  const semNegocioNoUltimoPregao = dataPregao != null && etf.dataCotacao < dataPregao

  const valorDigitado = Number(valorLivre.replace(/\D/g, ''))
  const valor = valorDigitado > 0 ? valorDigitado : valorEscolhido
  const simulacao = simularCompra(valor, etf.cotacao)

  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <>
      <div id="cartao-etf" className="card col" style={{ gap: 14, scrollMarginTop: 12 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }}>{etf.ticker}</span>
            {etf.nome && etf.nome !== etf.ticker && (
              <span className="tiny muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {etf.nome}
              </span>
            )}
            <span className="tiny muted">
              {[etf.categoria, `negocia ${formatarVolume(etf.volumeMedio)} por dia`].join(', ')}
            </span>
          </div>
          <div className="col" style={{ gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            <span className="tiny muted">Preço da cota</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{reais(etf.cotacao)}</span>
            <span className="tiny muted">fechamento de {formatarData(etf.dataCotacao)}</span>
          </div>
        </div>

        {completo?.indice && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <span className="muted">Acompanha: </span>
            <strong>{completo.indice}</strong>
          </div>
        )}

        {cambio && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>{cambio.titulo}.</strong> <span className="muted">{cambio.detalhe}</span>
          </div>
        )}

        {completo && (
          <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: 1 }}>
              <span className="tiny muted">Variação em 3 meses</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{completo.variacao3m != null ? formatarVariacao(completo.variacao3m) : '—'}</span>
              <span className="tiny muted">no preço da cota</span>
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

        <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>{textoIrCurto(etf.categoria)}</div>

        {resumo && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
            <strong>Fora da lista por volume.</strong>{' '}
            <span className="muted">
              {semNegocioNoUltimoPregao
                ? `Este ETF não teve negócios no último pregão: o preço exibido é de ${formatarData(etf.dataCotacao)}. `
                : ''}
              Para ETFs fora da lista, a tela mostra só o preço, a categoria e o volume médio. Com pouca negociação, comprar ou
              vender pode levar tempo ou exigir aceitar um preço pior.
            </span>
          </div>
        )}
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Quantas cotas esse valor compra</span>
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
            onChange={(ev) => setValorLivre(ev.target.value.replace(/\D/g, '').slice(0, 9))}
            className="input-cotas"
            style={{ flex: '1 1 110px', width: 'auto' }}
          />
        </div>

        {simulacao && simulacao.quantidade > 0 ? (
          <div className="col" style={{ gap: 0 }}>
            <div className="tabela-bdr small">
              <span className="muted">Cotas compradas</span>
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
          </div>
        ) : (
          <span className="small muted">
            {reais(valor)} não compra nenhuma cota de {etf.ticker}: o preço de 1 cota é {reais(etf.cotacao)}.
          </span>
        )}

        <span className="tiny muted justify">
          A conta usa o preço de fechamento exibido, sem corretagem, emolumentos e impostos. É só a divisão do valor pelo
          preço: não é uma projeção de quanto o investimento vai render.
        </span>
      </div>
    </>
  )
}
