import { useId, useState } from 'react'
import { SNAPSHOT_BDRS } from '../data/snapshotBdrs'
import {
  VALORES_PADRAO,
  agruparPorSetor,
  buscarBdrs,
  formatarVariacao,
  simularCompra,
  textoProporcao,
} from '../domain/bdrs'
import type { BdrBusca, BdrLista, SnapshotBdrs } from '../domain/bdrs'
import { formatarData, formatarVolume } from '../domain/rendaFii'
import { VoltarInicio } from '../ui/VoltarInicio'
import { FaixaCotacoes, itensDeBdrs } from '../ui/FaixaCotacoes'
import { rolarParaResultado } from '../ui/rolarParaResultado'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import { Top15BdrsDesconto } from './Top15BdrsDesconto'
import { Top15BdrsMaisNegociados } from './Top15EtfsMaisNegociados'
import type { AppCtx } from '../state/useAppState'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inteiro(valor: number) {
  return valor.toLocaleString('pt-BR')
}

/** O que está aberto no cartão: um BDR da lista (dado completo) ou um da busca (resumido). */
type Selecao = { origem: 'lista'; bdr: BdrLista; tipo: 'acao' | 'etf' } | { origem: 'busca'; bdr: BdrBusca }

/**
 * Aba "Simule BDR" (decisão D19). Tela estritamente descritiva: os 35 BDRs de ações e os 5 de
 * ETF mais negociados, agrupados por setor e ordenados por volume, com a busca para os demais.
 * Sem ranking, sem múltiplos de avaliação, sem projeção de retorno.
 */
export function SimuleBdr({
  snapshot = SNAPSHOT_BDRS,
}: {
  /** Recebido como as demais telas avulsas; esta tela só volta à landing. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job diário. */
  snapshot?: SnapshotBdrs
}) {
  const grupos = agruparPorSetor(snapshot.acoes)
  const etfs = [...snapshot.etfs].sort((a, b) => b.volumeMedio - a.volumeMedio)
  const primeiro = grupos[0]?.bdrs[0]
  const [selecao, setSelecao] = useState<Selecao | undefined>(primeiro ? { origem: 'lista', bdr: primeiro, tipo: 'acao' } : undefined)
  const [valorLivre, setValorLivre] = useState('')
  const [valorEscolhido, setValorEscolhido] = useState<number>(VALORES_PADRAO[1])
  const [aba, setAba] = useState<'simulador' | 'top15' | 'negociados'>('simulador')

  const levarAoCartao = () => rolarParaResultado('cartao-bdr')

  const abrir = (nova: Selecao) => {
    setSelecao(nova)
    levarAoCartao()
  }

  const abrirDaBusca = (b: BdrBusca) => {
    const naLista = snapshot.acoes.find((x) => x.ticker === b.ticker) ?? snapshot.etfs.find((x) => x.ticker === b.ticker)
    abrir(naLista ? { origem: 'lista', bdr: naLista, tipo: b.tipo } : { origem: 'busca', bdr: b })
  }

  const selecionado = selecao?.bdr.ticker

  const chip = (b: BdrLista, tipo: 'acao' | 'etf') => (
    <button
      key={b.ticker}
      className={`chip ${b.ticker === selecionado ? 'selected' : ''}`}
      aria-pressed={b.ticker === selecionado}
      onClick={() => abrir({ origem: 'lista', bdr: b, tipo })}
    >
      {b.ticker}
    </button>
  )

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule BDR</h1>
        <div className="muted small justify">
          BDRs são recibos negociados na B3 que representam ações ou ETFs de fora do Brasil. Escolha um na lista ou busque
          pelo código, e veja o preço de fechamento e quantos BDRs um valor compra.
        </div>
      </div>

      <FaixaCotacoes itens={itensDeBdrs(snapshot)} dataPregao={snapshot.dataPregao} />

      <AbasDaTela
        prefixo="bdr"
        rotulo="O que você quer ver"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'simulador', emoji: '🧮', titulo: 'Simulador', descricao: 'Preço e quantos BDRs compra' },
          { id: 'top15', emoji: '🏷️', titulo: 'Top 15 maior desconto', descricao: 'Desconto de preço, com auditoria' },
          { id: 'negociados', emoji: '📊', titulo: 'Top 15 mais negociados', descricao: 'Ranking por volume' },
        ] as const}
      >
      {aba === 'top15' ? (
        <Top15BdrsDesconto />
      ) : aba === 'negociados' ? (
        <Top15BdrsMaisNegociados />
      ) : (
      <>
      {!selecao ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Os dados dos BDRs ainda não foram carregados.</span>
          <span className="muted small justify">
            As cotações são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.
          </span>
        </div>
      ) : (
        // No computador: busca e lista por setor à esquerda, cartão do BDR fixo à direita (D20).
        <div className="desk-split">
          <div className="desk-main">
          <BuscaBdr busca={snapshot.busca ?? []} onSelecionar={abrirDaBusca} />

          {snapshot.criterio && (
            <div className="small muted justify" style={{ lineHeight: 1.5 }}>
              A lista mostra os <strong>{snapshot.criterio.maxAcoes} BDRs de ações</strong> e os{' '}
              <strong>{snapshot.criterio.maxEtfs} BDRs de ETF</strong> com maior volume negociado em média nos últimos{' '}
              {snapshot.sessoesLiquidez ?? 21} pregões, em ordem de volume dentro de cada setor. Empresas de origem ou operação
              brasileira listadas no exterior ficam de fora. Os demais BDRs estão na busca acima.
            </div>
          )}

          <div className="col" style={{ gap: 18 }}>
            {grupos.map((g) => (
              <div key={g.setor} className="col" style={{ gap: 8 }}>
                <h2 className="titulo-setor font-display">{g.setor}</h2>
                <div className="grade-tickers" role="group" aria-label={`BDRs do setor ${g.setor}`}>
                  {g.bdrs.map((b) => chip(b, 'acao'))}
                </div>
              </div>
            ))}

            {etfs.length > 0 && (
              <div className="col" style={{ gap: 8 }}>
                <h2 className="titulo-setor font-display">BDRs de ETF</h2>
                <div className="grade-tickers" role="group" aria-label="BDRs de ETF">
                  {etfs.map((b) => chip(b, 'etf'))}
                </div>
              </div>
            )}
          </div>

          </div>

          <div className="desk-side">
          <CartaoBdr
            selecao={selecao}
            dataPregao={snapshot.dataPregao}
            valorEscolhido={valorEscolhido}
            setValorEscolhido={setValorEscolhido}
            valorLivre={valorLivre}
            setValorLivre={setValorLivre}
          />
          </div>
        </div>
      )}

      <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Como o IR funciona nos BDRs.</strong>{' '}
        <span className="muted">
          Na venda, o ganho paga 15% de Imposto de Renda (20% em day trade), calculado e pago pelo próprio investidor por
          DARF. Não existe a isenção para vendas de até R$ 20 mil por mês que vale para ações brasileiras. Os dividendos
          costumam chegar já com o imposto retido no país de origem (30% nos Estados Unidos) e, no Brasil, entram na tabela
          progressiva do IR pelo carnê-leão. Regras tributárias mudam: confirme com um contador antes de declarar.
        </span>
      </div>

      </>
      )}
      </AbasDaTela>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Rentabilidade obtida no passado não representa garantia de rentabilidade futura.</strong> O preço de um BDR
        muda com a ação lá fora e com o dólar: mesmo que a empresa não se mova, a alta ou a queda do dólar muda o valor em
        reais. Estar na lista, na busca ou no Top 15 não é uma indicação de compra: o critério da lista é só o volume negociado, e o do Top 15 é só o desconto de preço.
        {snapshot.geradoEm
          ? snapshot.fonte
            ? ` Preços e volumes oficiais da B3 (Boletim de Preços); nome, setor e proporção da brapi. Atualizados em ${formatarData(snapshot.geradoEm)}.`
            : ` Dados da brapi, atualizados em ${formatarData(snapshot.geradoEm)}.`
          : ''}
      </div>

      <AvisoEducacional />
    </div>
  )
}

/** Busca por código ou nome, no mesmo desenho da busca de FIIs (D12). */
function BuscaBdr({ busca, onSelecionar }: { busca: BdrBusca[]; onSelecionar: (b: BdrBusca) => void }) {
  const [termo, setTermo] = useState('')
  const idResultados = useId()
  const resultados = buscarBdrs(busca, termo)
  const buscando = termo.trim().length >= 2

  const escolher = (b: BdrBusca) => {
    onSelecionar(b)
    setTermo('')
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input
        type="search"
        className="busca-fii"
        placeholder="Código ou nome, ex.: AAPL34"
        aria-label="Buscar BDR por código ou nome"
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
          <ul className="resultados-busca" aria-label="BDRs encontrados">
            {resultados.map((b) => (
              <li key={b.ticker}>
                <button className="resultado-busca" onClick={() => escolher(b)}>
                  <span style={{ fontWeight: 700 }}>{b.ticker}</span>
                  <span className="tiny muted resultado-nome">
                    {[b.nome, b.tipo === 'etf' ? 'BDR de ETF' : b.setor].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando && resultados.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhum BDR encontrado para “{termo.trim()}”.</strong>{' '}
            <span className="muted">
              Confira o código (4 letras e 2 números, como AAPL34 ou BSLV39). A busca por nome só alcança os BDRs cujo nome a
              fonte informa; para os demais, use o código. Empresas de origem ou operação brasileira listadas no exterior não
              aparecem.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function CartaoBdr({
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
  const completo = selecao.origem === 'lista' ? selecao.bdr : null
  const resumo = selecao.origem === 'busca' ? selecao.bdr : null
  const tipo = selecao.origem === 'lista' ? selecao.tipo : selecao.bdr.tipo
  const bdr = selecao.bdr
  // Na busca, o preço é o do último negócio, que pode ser anterior ao último pregão (D24).
  const dataFechamento = completo?.dataCotacao ?? resumo?.dataCotacao ?? dataPregao
  const acoesPorBdr = completo?.acoesPorBdr ?? null
  const proporcao = textoProporcao(acoesPorBdr, tipo)

  const valorDigitado = Number(valorLivre.replace(/\D/g, ''))
  const valor = valorDigitado > 0 ? valorDigitado : valorEscolhido
  const simulacao = simularCompra(valor, bdr.cotacao, acoesPorBdr)
  const unidadeEquivalente = tipo === 'etf' ? 'cotas do ETF' : 'ações'

  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  return (
    <>
      <div id="cartao-bdr" className="card col" style={{ gap: 14, scrollMarginTop: 12 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }}>{bdr.ticker}</span>
            {bdr.nome && bdr.nome !== bdr.ticker && (
              <span className="tiny muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {bdr.nome}
              </span>
            )}
            <span className="tiny muted">
              {[
                tipo === 'etf' ? `BDR de ETF, ${bdr.setor}` : bdr.setor,
                completo ? `negocia ${formatarVolume(completo.volumeMedio)} por dia` : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
          <div className="col" style={{ gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            <span className="tiny muted">Preço do BDR</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{reais(bdr.cotacao)}</span>
            {dataFechamento && <span className="tiny muted">fechamento de {formatarData(dataFechamento)}</span>}
          </div>
        </div>

        {completo && (
          <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: 1 }}>
              <span className="tiny muted">Variação em 3 meses</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{completo.variacao3m != null ? formatarVariacao(completo.variacao3m) : '—'}</span>
              <span className="tiny muted">em reais, já com o dólar</span>
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

        {proporcao && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>{proporcao}</strong>
            <span className="muted">
              {' '}
              {tipo === 'etf' ? 'negociada lá fora' : 'da empresa negociada lá fora'}.
              {acoesPorBdr !== 1 ? ` Por isso o preço do BDR é diferente do preço da ${tipo === 'etf' ? 'cota' : 'ação'} convertido em reais.` : ''}
            </span>
          </div>
        )}

        {resumo && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
            <strong>Fora da lista por volume.</strong>{' '}
            <span className="muted">
              {resumo.volumeDia > 0
                ? `No último pregão, este BDR negociou ${formatarVolume(resumo.volumeDia)}. `
                : resumo.dataCotacao
                  ? `Este BDR não teve negócios no último pregão: o preço exibido é o do último negócio, em ${formatarData(resumo.dataCotacao)}. `
                  : 'Este BDR não teve negócios no último pregão, e o preço exibido pode ser de um dia anterior. '}
              Para BDRs fora da lista, a tela mostra só o preço e o setor. Com pouca negociação, comprar ou vender pode levar
              tempo ou exigir aceitar um preço pior.
            </span>
          </div>
        )}
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Quantos BDRs esse valor compra</span>
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
              <span className="muted">BDRs comprados</span>
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
            {simulacao.equivalente != null && (
              <div className="tabela-bdr small">
                <span className="muted">Equivale a</span>
                <span>
                  {simulacao.equivalente.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {unidadeEquivalente}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="small muted">
            {reais(valor)} não compra nenhum BDR de {bdr.ticker}: o preço de 1 BDR é {reais(bdr.cotacao)}.
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
