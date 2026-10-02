import { useId, useState } from 'react'
import { lerNumero } from '../../domain/importacao/celulas'
import { agruparPosicoes } from '../../domain/painelCarteira'
import type { LinhaPosicao, OrigemPrecoMedio } from '../../domain/painelCarteira'
import { pct, quantidadeBR, reais } from './formatar'

const ORIGEM: Record<OrigemPrecoMedio, string> = {
  calculado: 'Calculado pelos seus lançamentos',
  b3: 'Valor aplicado informado pela B3',
  informado: 'Informado por você',
}

const numero = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Editar o preço médio de um ativo. O que a pessoa informa vale mais que o calculado e que o da B3. */
function EditorPreco({ linha, onSalvar, onFechar }: { linha: LinhaPosicao; onSalvar: (preco: number | null) => void; onFechar: () => void }) {
  const id = useId()
  const [texto, setTexto] = useState(linha.precoMedio !== null ? numero(linha.precoMedio) : '')
  const [erro, setErro] = useState<string | null>(null)

  function salvar() {
    const v = lerNumero(texto)
    if (v === null || v <= 0) return setErro('Informe um preço médio maior que zero.')
    onSalvar(v)
    onFechar()
  }

  return (
    <div className="mc-form mc-pos-editor" role="group" aria-label={`Editar preço médio de ${linha.ativo}`}>
      <label htmlFor={id} className="mc-rotulo-campo">Preço médio de {linha.ativo} (R$ por unidade)</label>
      <input
        id={id}
        className="mc-campo mc-campo-curto"
        inputMode="decimal"
        placeholder="0,00"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && salvar()}
      />
      <div className="mc-nota">O app passa a usar este valor, em vez de calcular.</div>
      {erro && <div className="mc-erro" role="alert">{erro}</div>}
      <div className="mc-acoes">
        <button type="button" className="btn btn-primary mc-btn" onClick={salvar}>Salvar</button>
        <button type="button" className="btn btn-ghost mc-btn" onClick={onFechar}>Cancelar</button>
        {linha.origemPrecoMedio === 'informado' && (
          <button
            type="button"
            className="btn btn-ghost mc-btn"
            onClick={() => {
              onSalvar(null)
              onFechar()
            }}
          >
            Voltar ao calculado
          </button>
        )}
      </div>
    </div>
  )
}

function LinhaDoAtivo({
  l,
  onDefinirPrecoMedio,
  onVerLancamentos,
}: {
  l: LinhaPosicao
  onDefinirPrecoMedio: (ativo: string, preco: number | null) => void
  onVerLancamentos: (ativo: string) => void
}) {
  const [editando, setEditando] = useState(false)
  return (
    <li className="mc-posicao">
      <div className="mc-pos-ativo">
        <strong>{l.ativo}</strong>
        <span className="mc-nota">{quantidadeBR(l.quantidade)} un.</span>
        {l.status === 'faltaSaldoAnterior' && <span className="mc-selo faltaSaldoAnterior">Falta o preço de compra</span>}
        {l.aguardandoLiquidacao && <span className="mc-selo info">Aguardando liquidação</span>}
      </div>
      <div className="mc-pos-num">
        <span className="mc-nota">Preço médio</span>
        <span>{l.precoMedio !== null ? reais(l.precoMedio) : '—'}</span>
        {l.origemPrecoMedio && l.origemPrecoMedio !== 'calculado' && <span className="mc-nota">{ORIGEM[l.origemPrecoMedio]}</span>}
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
      {editando ? (
        <EditorPreco linha={l} onSalvar={(p) => onDefinirPrecoMedio(l.ativo, p)} onFechar={() => setEditando(false)} />
      ) : (
        <div className="mc-pos-acoes">
          <button type="button" className="btn btn-ghost mc-btn" aria-label={`Editar preço médio de ${l.ativo}`} onClick={() => setEditando(true)}>
            Editar preço médio
          </button>
          <button type="button" className="btn btn-ghost mc-btn" aria-label={`Ver lançamentos de ${l.ativo}`} onClick={() => onVerLancamentos(l.ativo)}>
            Ver lançamentos
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Posições agrupadas como na Área do Investidor da B3 ("Produtos da sua carteira"): um bloco por tipo de
 * ativo (Ações, Tesouro Direto, FIIs, BDRs, ETFs), com quantos ativos tem, a fatia da carteira e o valor.
 * Cada bloco abre para mostrar os ativos, onde dá para editar o preço médio.
 */
export function CartaoPosicoes({
  linhas,
  onDefinirPrecoMedio,
  onVerLancamentos,
}: {
  linhas: LinhaPosicao[]
  onDefinirPrecoMedio: (ativo: string, preco: number | null) => void
  onVerLancamentos: (ativo: string) => void
}) {
  const idTitulo = useId()
  if (!linhas.length) return null
  const grupos = agruparPosicoes(linhas)

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Posições</h2>
      <div className="mc-rotulo">
        {linhas.length} ativo(s) em {grupos.length} {grupos.length === 1 ? 'tipo' : 'tipos'}
      </div>
      <div className="mc-grupos">
        {grupos.map((g) => (
          <details key={g.chave} className="mc-grupo" open={grupos.length === 1}>
            <summary aria-label={`${g.rotulo}: ${g.ativos} ativo(s)`}>
              <span className="mc-grupo-nome">{g.rotulo}</span>
              <span className="mc-grupo-valor">{g.valor > 0 ? reais(g.valor) : '—'}</span>
              <span className="mc-grupo-info">
                {g.ativos} {g.ativos === 1 ? 'ativo' : 'ativos'}
                {g.valor > 0 && ` · ${pct(g.pct, false)} da carteira`}
              </span>
              <span className="mc-grupo-barra" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, g.pct))}%` }} />
              </span>
            </summary>
            <ul className="mc-posicoes">
              {g.linhas.map((l) => (
                <LinhaDoAtivo key={l.ativo} l={l} onDefinirPrecoMedio={onDefinirPrecoMedio} onVerLancamentos={onVerLancamentos} />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}
