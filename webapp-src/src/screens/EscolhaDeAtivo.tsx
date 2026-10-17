import { useId, useState } from 'react'
import { buscarAtivos } from '../domain/opcoes'
import type { AtivoComOpcoes, SnapshotOpcoes } from '../domain/opcoes'
import { reais } from '../domain/mercadoOficial'
import { formatarData, formatarVolume } from '../domain/rendaFii'

const MAIS_NEGOCIADOS = 12
const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const corVar = (v: number | null) => (v === null || v === 0 ? undefined : v > 0 ? 'var(--mc-pos)' : 'var(--danger)')

/**
 * Busca de ativo (código ou nome), atalhos dos mais negociados em opções e o cartão com o preço à vista. Compartilhada pelas
 * abas Séries da B3 e Por visão de mercado.
 */
export function EscolhaDeAtivo({ snapshot, ativo, onEscolher }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes; onEscolher: (t: string) => void }) {
  const [termo, setTermo] = useState('')
  const idResultados = useId()
  const resultados = buscarAtivos(snapshot.ativos, termo)
  const buscando = termo.trim().length >= 1
  const maisNegociados = snapshot.ativos.slice(0, MAIS_NEGOCIADOS)

  const escolher = (a: AtivoComOpcoes) => {
    onEscolher(a.ticker)
    setTermo('')
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <span className="small" style={{ fontWeight: 600 }}>Ativo</span>
      <input
        type="search"
        className="busca-fii"
        placeholder={`Buscar entre ${snapshot.ativos.length} ativos, ex.: PETR4`}
        aria-label="Buscar ativo por código ou nome"
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
          <ul className="resultados-busca" aria-label="Ativos encontrados">
            {resultados.map((a) => (
              <li key={a.ticker}>
                <button className="resultado-busca" onClick={() => escolher(a)}>
                  <span style={{ fontWeight: 700 }}>{a.ticker}</span>
                  <span className="tiny muted resultado-nome">{a.nome}, {a.series.length} séries</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando && resultados.length === 0 && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="status">
            <strong>Nenhum ativo com opções encontrado para “{termo.trim()}”.</strong>{' '}
            <span className="muted">Confira o código (ex.: PETR4, VALE3, BOVA11). Só aparecem ativos com opções negociadas nos últimos pregões.</span>
          </div>
        )}
      </div>

      <div className="grade-tickers" role="group" aria-label="Ativos mais negociados em opções">
        {[...maisNegociados, ...(maisNegociados.some((a) => a.ticker === ativo.ticker) ? [] : [ativo])].map((a) => (
          <button
            key={a.ticker}
            className={`chip ${a.ticker === ativo.ticker ? 'selected' : ''}`}
            aria-pressed={a.ticker === ativo.ticker}
            onClick={() => onEscolher(a.ticker)}
          >
            {a.ticker}
          </button>
        ))}
      </div>
      <div className="card col" style={{ gap: 4 }} role="group" aria-label={`Preço de ${ativo.ticker} no mercado à vista`}>
        <div className="row" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }}>{ativo.ticker}</span>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 24 }} data-testid="preco-ativo">{reais(ativo.cotacao)}</span>
          {ativo.variacao != null && (
            <span style={{ fontWeight: 700, fontSize: 15, color: corVar(ativo.variacao) }} data-testid="variacao-ativo">
              {ativo.variacao > 0 ? '+' : ''}{num(ativo.variacao)}%
            </span>
          )}
        </div>
        <span className="tiny muted">
          {ativo.nome ? `${ativo.nome}, ` : ''}preço à vista, fechamento de {formatarData(ativo.dataCotacao ?? snapshot.dataPregao ?? '')}
        </span>
        <span className="tiny muted">
          Opções negociam {formatarVolume(ativo.volumeOpcoes)} por dia ({ativo.series.length} séries nos próximos 6 meses).
        </span>
      </div>
    </div>
  )
}
