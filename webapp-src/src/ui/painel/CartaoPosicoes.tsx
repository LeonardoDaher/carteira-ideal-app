import { useId, useState } from 'react'
import type { LinhaPosicao } from '../../domain/painelCarteira'
import { pct, quantidadeBR, reais } from './formatar'

export function CartaoPosicoes({ linhas }: { linhas: LinhaPosicao[] }) {
  const idTitulo = useId()
  const [todas, setTodas] = useState(false)
  if (!linhas.length) return null
  const visiveis = todas ? linhas : linhas.slice(0, 12)

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Posições</h2>
      <div className="mc-rotulo">{linhas.length} ativo(s)</div>
      <ul className="mc-posicoes">
        {visiveis.map((l) => (
          <li key={l.ativo} className="mc-posicao">
            <div className="mc-pos-ativo">
              <strong>{l.ativo}</strong>
              <span className="mc-nota">{quantidadeBR(l.quantidade)} un.</span>
              {l.status === 'faltaSaldoAnterior' && <span className="mc-selo faltaSaldoAnterior">Falta histórico</span>}
              {l.status === 'inconsistente' && <span className="mc-selo inconsistente">Inconsistente</span>}
              {l.aguardandoLiquidacao && <span className="mc-selo info">Aguardando liquidação</span>}
            </div>
            <div className="mc-pos-num">
              <span className="mc-nota">Preço médio</span>
              <span>{l.precoMedio !== null ? reais(l.precoMedio) : '—'}</span>
            </div>
            <div className="mc-pos-num">
              <span className="mc-nota">{l.valorAtual !== null ? 'Valor atual' : 'Custo'}</span>
              <span>{l.valorAtual !== null ? reais(l.valorAtual) : l.custoTotal !== null ? reais(l.custoTotal) : '—'}</span>
            </div>
            <div className="mc-pos-num">
              <span className="mc-nota">Resultado</span>
              {l.resultado !== null ? (
                <span className={l.resultado >= 0 ? 'mc-pos' : 'mc-neg'}>
                  {reais(l.resultado)}
                  {l.resultadoPct !== null && <small> ({pct(l.resultadoPct)})</small>}
                </span>
              ) : (
                <span>—</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {linhas.length > 12 && (
        <button type="button" className="btn btn-ghost mc-btn" onClick={() => setTodas((v) => !v)}>
          {todas ? 'Mostrar menos' : `Mostrar todas (${linhas.length})`}
        </button>
      )}
    </section>
  )
}
