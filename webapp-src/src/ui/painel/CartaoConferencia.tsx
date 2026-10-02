import { useId, useMemo, useState } from 'react'
import type { CarteiraSalva } from '../../domain/carteiraSalva'
import { conferirComPosicao, criarSaldoInicial } from '../../domain/conferencia'
import type { ItemConferencia } from '../../domain/conferencia'
import { lerNumero } from '../../domain/importacao/celulas'
import type { LancamentoNovo, ProblemaLancamento } from '../../domain/lancamentos'
import { dataCurta, quantidadeBR } from './formatar'

type Adicionar = (l: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null

const ROTULO_STATUS: Record<ItemConferencia['status'], string> = {
  confere: 'Confere',
  faltaSaldoAnterior: 'Falta o preço de compra',
}

function ItemPendente({ item, onAdicionar, onVerLancamentos }: { item: ItemConferencia; onAdicionar: Adicionar; onVerLancamentos: (ativo: string) => void }) {
  const id = useId()
  const [pm, setPm] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function lancar() {
    const valor = lerNumero(pm)
    const l = valor !== null ? criarSaldoInicial(item, valor) : null
    if (!l) return setErro('Informe o preço médio (um valor maior que zero).')
    const { origem: _origem, ...semOrigem } = l
    void _origem
    const problema = onAdicionar(semOrigem)
    setErro(problema ? problema.motivo : null)
  }

  return (
    <li className={`mc-pendente ${item.status}`}>
      <div className="mc-pendente-topo">
        <strong>{item.ativo}</strong>
        <span className={`mc-selo ${item.status}`}>{ROTULO_STATUS[item.status]}</span>
      </div>
      <div className="mc-nota">
        Na Posição: {quantidadeBR(item.quantidadePosicao)} · nos lançamentos: {quantidadeBR(item.quantidadeLancamentos)}
      </div>
      <details className="mc-detalhes">
        <summary>Por quê?</summary>
        <div className="mc-nota" style={{ marginTop: 6 }}>{item.explicacao}</div>
      </details>

      {item.faltante > 0 && (
        <div className="mc-form-linha">
          <label htmlFor={`${id}-pm`} className="mc-rotulo-campo">
            Preço médio dos {quantidadeBR(item.faltante)} anteriores
          </label>
          <input
            id={`${id}-pm`}
            className="mc-campo"
            inputMode="decimal"
            placeholder="0,00"
            value={pm}
            onChange={(e) => setPm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lancar()}
          />
          <button type="button" className="btn btn-secondary mc-btn" onClick={lancar}>
            Lançar saldo inicial
          </button>
          {erro && <div className="mc-erro" role="alert">{erro}</div>}
        </div>
      )}

      <div className="mc-acoes">
        <button type="button" className="btn btn-ghost mc-btn" aria-label={`Ver e corrigir os lançamentos de ${item.ativo}`} onClick={() => onVerLancamentos(item.ativo)}>
          Ver e corrigir lançamentos
        </button>
      </div>
    </li>
  )
}

export function CartaoConferencia({
  carteira,
  onAdicionar,
  onDataPosicao,
  onVerLancamentos,
}: {
  carteira: CarteiraSalva
  onAdicionar: Adicionar
  onDataPosicao: (d: string) => void
  onVerLancamentos: (ativo: string) => void
}) {
  const idTitulo = useId()
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const conf = useMemo(
    () =>
      carteira.posicao && carteira.dataPosicao
        ? conferirComPosicao(carteira.lancamentos, carteira.posicao, carteira.dataPosicao, new Set(Object.keys(carteira.precosMedios)))
        : null,
    [carteira.lancamentos, carteira.posicao, carteira.dataPosicao, carteira.precosMedios],
  )

  if (!conf || !carteira.dataPosicao) {
    return (
      <section className="mc-card" aria-labelledby={idTitulo}>
        <h2 id={idTitulo} className="mc-titulo">Conferência com a Posição</h2>
        <p className="mc-texto">
          Importe o extrato de <strong>Posição</strong> da B3 para conferir se o seu histórico bate com o que você tem hoje.
        </p>
      </section>
    )
  }

  const pendentes = conf.itens.filter((i) => i.status !== 'confere')
  const visiveis = mostrarTodos ? pendentes : pendentes.slice(0, 5)
  const total = conf.itens.length

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Conferência com a Posição</h2>
      <div className="mc-rotulo">
        <strong>{conf.resumo.confere}</strong> de {total} ativos conferem com a Posição de {dataCurta(conf.dataPosicao)}
      </div>
      <div className="mc-barra-progresso" role="img" aria-label={`${conf.resumo.confere} de ${total} ativos conferem`}>
        <span style={{ width: `${total ? (conf.resumo.confere / total) * 100 : 0}%` }} />
      </div>
      {conf.foraDaPosicao.length > 0 && (
        <div className="mc-nota">{conf.foraDaPosicao.length} ativo(s) que você já zerou ficam de fora. O que vale é o que você tem hoje.</div>
      )}

      <div className="mc-form-linha">
        <label htmlFor={`${idTitulo}-data`} className="mc-rotulo-campo">Data da Posição</label>
        <input
          id={`${idTitulo}-data`}
          type="date"
          className="mc-campo mc-campo-data"
          value={carteira.dataPosicao}
          onChange={(e) => e.target.value && onDataPosicao(e.target.value)}
        />
        <span className="mc-dica">Normalmente, o dia útil anterior ao download.</span>
      </div>

      {pendentes.length === 0 ? (
        <p className="mc-ok">Tudo confere. O preço médio reflete a sua custódia.</p>
      ) : (
        <>
          <p className="mc-texto">{pendentes.length} ativo(s) pedem atenção.</p>
          <ul className="mc-pendentes">
            {visiveis.map((i) => (
              <ItemPendente key={i.ativo} item={i} onAdicionar={onAdicionar} onVerLancamentos={onVerLancamentos} />
            ))}
          </ul>
          {pendentes.length > 5 && (
            <button type="button" className="btn btn-ghost mc-btn" onClick={() => setMostrarTodos((v) => !v)}>
              {mostrarTodos ? 'Mostrar menos' : `Mostrar todos (${pendentes.length})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
