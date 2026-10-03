import { useId, useState } from 'react'
import dadosRendimentos from '../data/rendimentosFii.json'
import {
  QUANTIDADES_PADRAO,
  TEXTO_MOTIVO_CONFIANCA,
  TEXTO_MOTIVO_INDISPONIVEL,
  acharIndisponivel,
  agruparPorSetor,
  buscarFundos,
  estaNaLista,
  formatarCompetencia,
  formatarVolume,
  nomeCurto,
  formatarData,
  rendimentoMensalPct,
  simularCotas,
  tabelaSimulacao,
  ultimoRendimento,
} from '../domain/rendaFii'
import type { FundoFii, SnapshotRendimentosFii } from '../domain/rendaFii'
import { VoltarInicio } from '../ui/VoltarInicio'
import { rolarParaResultado } from '../ui/rolarParaResultado'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'

const SNAPSHOT_PADRAO = dadosRendimentos as SnapshotRendimentosFii

function reais(valor: number, casas: { min?: number; max?: number } = {}) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas.min ?? 2,
    maximumFractionDigits: casas.max ?? 2,
  })
}

/** Rendimento por cota: centavos costumam não bastar para cotas baratas (ex.: R$ 0,098). */
function reaisPorCota(valor: number) {
  return reais(valor, { min: 2, max: 3 })
}

function inteiro(valor: number) {
  return valor.toLocaleString('pt-BR')
}

export function SimuleFii({
  snapshot = SNAPSHOT_PADRAO,
}: {
  /** Recebido como as demais telas. Desde que saiu da barra de abas, esta tela não navega
   * pelo app (só volta à landing), então não usa o contexto. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job mensal. */
  snapshot?: SnapshotRendimentosFii
}) {
  const grupos = agruparPorSetor(snapshot)
  const exibidos = grupos.flatMap((g) => g.fundos)
  const [tickerSelecionado, setTickerSelecionado] = useState<string | undefined>(exibidos[0]?.ticker)
  const [quantidadeLivre, setQuantidadeLivre] = useState('')

  // A busca pode escolher um fundo fora da lista por setor: procura em todos.
  const fundo = snapshot.fundos.find((f) => f.ticker === tickerSelecionado) ?? exibidos[0]

  const selecionar = (ticker: string) => {
    setTickerSelecionado(ticker)
    setQuantidadeLivre('')
    // Com dezenas de botões, o cartão pode ficar fora da janela: leva a pessoa até ele (D44).
    rolarParaResultado('cartao-fundo-fii')
  }

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule sua renda com FIIs</h1>
        <div className="muted small justify">
          Escolha um fundo imobiliário na lista ou busque pelo código ou nome, e veja quanto cada quantidade de cotas
          rendeu por mês.
        </div>
      </div>

      {!fundo ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Os dados deste mês ainda não foram carregados.</span>
          <span className="muted small justify">
            Os rendimentos são atualizados uma vez por mês a partir dos informes enviados pelos fundos à CVM. Volte em
            alguns dias.
          </span>
        </div>
      ) : (
        // No computador: busca e lista por setor à esquerda, cartão do fundo fixo à direita (D20).
        <div className="desk-split">
          <div className="desk-main">
          <BuscaFundo snapshot={snapshot} onSelecionar={selecionar} />

          {snapshot.volumeMinimoDiario != null && (
            <div className="small muted justify" style={{ lineHeight: 1.5 }}>
              Somente são disponibilizadas as informações dos fundos imobiliários que negociam, em média, acima de{' '}
              <strong>{formatarVolume(snapshot.volumeMinimoDiario)} por dia</strong>. Para os demais fundos, com valores
              de negociação inferiores a {formatarVolume(snapshot.volumeMinimoDiario)}, favor consultar na busca acima.
            </div>
          )}

          <div className="col" style={{ gap: 18 }}>
            {grupos.map((g) => (
              <div key={g.setor} className="col" style={{ gap: 8 }}>
                <h2 className="titulo-setor font-display">{g.setor}</h2>
                <div className="grade-tickers" role="group" aria-label={`Fundos do setor ${g.setor}`}>
                  {g.fundos.map((f) => (
                    <button
                      key={f.ticker}
                      className={`chip ${f.ticker === fundo.ticker ? 'selected' : ''}`}
                      aria-pressed={f.ticker === fundo.ticker}
                      onClick={() => selecionar(f.ticker)}
                    >
                      {f.ticker}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          </div>

          <div className="desk-side">
          <CartaoFundo
            fundo={fundo}
            foraDaLista={!estaNaLista(snapshot, fundo)}
            volumeMinimo={snapshot.volumeMinimoDiario}
            quantidadeLivre={quantidadeLivre} setQuantidadeLivre={setQuantidadeLivre} />
          </div>
        </div>
      )}

      <AvisoAtrasoCvm snapshot={snapshot} competencia={fundo ? ultimoRendimento(fundo)?.competencia : undefined} />

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Rentabilidade obtida no passado não representa garantia de rentabilidade futura.</strong> O rendimento de
        um FII muda todo mês e pode diminuir ou ser suspenso. A cotação também oscila: o valor investido pode cair. Os
        rendimentos costumam ser isentos de IR para pessoa física quando o fundo e o investidor cumprem as condições
        previstas em lei. Estar na lista ou na busca não é uma indicação de compra: o critério da lista é só a liquidez.
      </div>

      <AvisoEducacional />
    </div>
  )
}

/**
 * Busca livre (decisão D12): qualquer FII com dado publicável no mês, por código ou por
 * parte do nome. Os resultados são botões comuns numa lista: Tab percorre, Enter escolhe;
 * Enter no campo escolhe o primeiro resultado.
 */
function BuscaFundo({ snapshot, onSelecionar }: { snapshot: SnapshotRendimentosFii; onSelecionar: (ticker: string) => void }) {
  const [termo, setTermo] = useState('')
  const idResultados = useId()
  const resultados = buscarFundos(snapshot.fundos, termo)
  const buscando = termo.trim().length >= 2
  const indisponivel = buscando && resultados.length === 0 ? acharIndisponivel(snapshot, termo) : null

  const escolher = (f: FundoFii) => {
    onSelecionar(f.ticker)
    setTermo('')
  }

  return (
    <div className="col" style={{ gap: 6 }}>
      <input
        type="search"
        className="busca-fii"
        placeholder="Código ou nome, ex.: HGLG11"
        aria-label="Buscar fundo imobiliário por código ou nome"
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
          <ul className="resultados-busca" aria-label="Fundos encontrados">
            {resultados.map((f) => (
              <li key={f.ticker}>
                <button className="resultado-busca" onClick={() => escolher(f)}>
                  <span style={{ fontWeight: 700 }}>{f.ticker}</span>
                  <span className="tiny muted resultado-nome">
                    {nomeCurto(f.nome)}
                    {!estaNaLista(snapshot, f) ? ', baixa liquidez' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {buscando && resultados.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            {indisponivel ? (
              <>
                <strong>{indisponivel.ticker} está sem dados neste mês:</strong>{' '}
                <span className="muted">{TEXTO_MOTIVO_INDISPONIVEL[indisponivel.motivo]}
                  {indisponivel.motivo === 'sem-dy-informado' ? '.' : '. Tente novamente na próxima atualização.'}</span>
              </>
            ) : (
              <>
                <strong>Nenhum fundo encontrado para “{termo.trim()}”.</strong>{' '}
                <span className="muted">
                  Confira o código (4 letras e 11, como HGLG11) ou busque por parte do nome. A busca alcança os fundos
                  negociados na B3 que enviaram o Informe Mensal à CVM recentemente.
                </span>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

function CartaoFundo({
  fundo,
  foraDaLista = false,
  volumeMinimo,
  quantidadeLivre,
  setQuantidadeLivre,
}: {
  fundo: FundoFii
  /** Fundo abaixo do corte de liquidez, aberto pela busca. */
  foraDaLista?: boolean
  volumeMinimo?: number
  quantidadeLivre: string
  setQuantidadeLivre: (v: string) => void
}) {
  // Só o último rendimento: a média de meses foi retirada (decisão D10) porque a estimativa
  // da CVM se distorce em meses de emissão de cotas e de fechamento de semestre.
  const ultimo = ultimoRendimento(fundo)
  const valorBase = ultimo?.valorPorCota ?? null
  const pct = valorBase != null && fundo.cotacao != null ? rendimentoMensalPct(valorBase, fundo.cotacao) : null

  const qtdLivre = Number(quantidadeLivre.replace(/\D/g, ''))
  const linhas = valorBase != null ? tabelaSimulacao(fundo.cotacao, valorBase) : []
  const linhaLivre = valorBase != null && qtdLivre > 0 ? simularCotas(qtdLivre, fundo.cotacao, valorBase) : null

  return (
    <>
      <div id="cartao-fundo-fii" className="card col" style={{ gap: 14, scrollMarginTop: 12 }}>
        <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="col" style={{ gap: 2, minWidth: 0 }}>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }}>{fundo.ticker}</span>
            <span
              className="tiny muted"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {nomeCurto(fundo.nome)}
            </span>
            {(fundo.setor || fundo.volumeMedio != null) && (
              <span className="tiny muted">
                {[fundo.setor, fundo.volumeMedio != null ? `negocia ${formatarVolume(fundo.volumeMedio)} por dia` : null]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            )}
          </div>
          <div className="col" style={{ gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            <span className="tiny muted">Valor da cota</span>
            <span className="font-display" style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>
              {fundo.cotacao != null ? reais(fundo.cotacao) : 'indisponível'}
            </span>
            {fundo.dataCotacao && <span className="tiny muted">fechamento de {formatarData(fundo.dataCotacao)}</span>}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="col" style={{ gap: 2, flex: 1, padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' }}>
            <span className="tiny muted">Último rendimento</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{ultimo ? reaisPorCota(ultimo.valorPorCota) : '—'}</span>
            <span className="tiny muted">{ultimo ? `por cota, ${formatarCompetencia(ultimo.competencia)}` : ''}</span>
          </div>
          <div className="col" style={{ gap: 2, flex: 1, padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' }}>
            <span className="tiny muted">Sobre o valor da cota</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {pct != null ? `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}
            </span>
            <span className="tiny muted">ao mês, estimado</span>
          </div>
        </div>

        {foraDaLista && volumeMinimo != null && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
            <strong>Fora da lista por liquidez.</strong>{' '}
            <span className="muted">
              {fundo.volumeMedio != null
                ? `Este fundo negocia em média ${formatarVolume(fundo.volumeMedio)} por dia, abaixo do corte de ${formatarVolume(volumeMinimo)}. `
                : 'Não foi possível medir o volume negociado deste fundo. '}
              Com pouca liquidez, comprar ou vender pode levar tempo ou exigir aceitar um preço pior.
            </span>
          </div>
        )}

        {fundo.confianca === 'baixa' && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
            <strong>Estimativa menos confiável.</strong>{' '}
            <span className="muted">
              {(fundo.motivosConfianca ?? [])
                .map((m) => TEXTO_MOTIVO_CONFIANCA[m])
                .join('; ')
                .replace(/^./, (c) => c.toUpperCase())}
              {fundo.motivosConfianca?.length ? '. ' : ''}
              Confira o valor anunciado pelo fundo antes de usar este número.
            </span>
          </div>
        )}

        {valorBase != null && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>1 cota rendeu cerca de {reaisPorCota(valorBase)}</strong>
            <span className="muted"> em {ultimo ? formatarCompetencia(ultimo.competencia) : 'mês de referência'}. A tabela abaixo usa esse valor.</span>
          </div>
        )}
      </div>

      {valorBase != null && (
        <div className="card col" style={{ gap: 0 }}>
          <div className="tabela-fii tabela-fii-cabecalho tiny muted">
            <span>Cotas</span>
            <span>Investimento</span>
            <span>Renda por mês</span>
          </div>
          {linhas.map((l) => (
            <div key={l.cotas} className="tabela-fii small">
              <span style={{ fontWeight: 600 }}>{inteiro(l.cotas)}</span>
              <span className="muted">{l.investimento != null ? reais(l.investimento) : '—'}</span>
              <span style={{ fontWeight: 700 }}>{reais(l.rendaMensal)}</span>
            </div>
          ))}

          <label className="tabela-fii small" style={{ alignItems: 'center' }}>
            <input
              inputMode="numeric"
              placeholder="Outra"
              aria-label="Outra quantidade de cotas"
              value={quantidadeLivre}
              onChange={(e) => setQuantidadeLivre(e.target.value.replace(/\D/g, '').slice(0, 7))}
              className="input-cotas"
            />
            <span className="muted">{linhaLivre?.investimento != null ? reais(linhaLivre.investimento) : '—'}</span>
            <span style={{ fontWeight: 700 }}>{linhaLivre ? reais(linhaLivre.rendaMensal) : '—'}</span>
          </label>
        </div>
      )}

      <span className="tiny muted">
        Quantidades de referência: {QUANTIDADES_PADRAO.map(inteiro).join(', ')} cotas. O investimento considera a cotação
        exibida, sem custos de corretagem e emolumentos.
      </span>
    </>
  )
}

function AvisoAtrasoCvm({ snapshot, competencia }: { snapshot: SnapshotRendimentosFii; competencia?: string }) {
  return (
    <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note">
      <strong>Atenção: dados com atraso.</strong>{' '}
      <span className="muted">
        {competencia ? `O último rendimento exibido é de ${formatarCompetencia(competencia)}. ` : ''}
        O valor é uma estimativa calculada a partir do Informe Mensal que os fundos enviam à CVM, publicado com 1 a 2
        meses de atraso. Ele pode diferir do rendimento anunciado pelo fundo, principalmente em meses de emissão de cotas
        ou de fechamento de semestre, e não inclui rendimentos anunciados depois. Confira o valor oficial no site do fundo
        ou da B3.
        {snapshot.geradoEm ? ` Cotação e rendimentos atualizados em ${formatarData(snapshot.geradoEm)}.` : ''}
      </span>
    </div>
  )
}
