import { useId, useMemo, useState } from 'react'
import type { CarteiraSalva } from '../../domain/carteiraSalva'
import { conferirComPosicao, criarSaldoInicial } from '../../domain/conferencia'
import type { ItemConferencia } from '../../domain/conferencia'
import { lerNumero } from '../../domain/importacao/celulas'
import type { LancamentoNovo, ProblemaLancamento } from '../../domain/lancamentos'
import { dataCurta, quantidadeBR } from './formatar'

const ROTULO_STATUS: Record<ItemConferencia['status'], string> = {
  confere: 'Confere',
  faltaSaldoAnterior: 'Falta histórico anterior',
  inconsistente: 'Inconsistente',
}

function ItemPendente({ item, onSaldoInicial }: { item: ItemConferencia; onSaldoInicial: (l: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null }) {
  const id = useId()
  const [pm, setPm] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function lancar() {
    const valor = lerNumero(pm)
    const l = valor !== null ? criarSaldoInicial(item, valor) : null
    if (!l) return setErro('Informe o preço médio (um valor maior que zero).')
    const { origem: _origem, ...semOrigem } = l
    void _origem
    const problema = onSaldoInicial(semOrigem)
    setErro(problema ? problema.motivo : null)
  }

  return (
    <li className={`mc-pendente ${item.status}`}>
      <div className="mc-pendente-topo">
        <strong>{item.ativo}</strong>
        <span className={`mc-selo ${item.status}`}>{ROTULO_STATUS[item.status]}</span>
      </div>
      <div className="mc-nota">{item.explicacao}</div>
      <div className="mc-nota">
        Na Posição: {quantidadeBR(item.quantidadePosicao)} · nos lançamentos: {quantidadeBR(item.quantidadeLancamentos)}
      </div>
      {item.status === 'faltaSaldoAnterior' && (
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
    </li>
  )
}

export function CartaoConferencia({
  carteira,
  onSaldoInicial,
  onDataPosicao,
}: {
  carteira: CarteiraSalva
  onSaldoInicial: (l: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null
  onDataPosicao: (d: string) => void
}) {
  const idTitulo = useId()
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const conf = useMemo(
    () => (carteira.posicao && carteira.dataPosicao ? conferirComPosicao(carteira.lancamentos, carteira.posicao, carteira.dataPosicao) : null),
    [carteira.lancamentos, carteira.posicao, carteira.dataPosicao],
  )

  if (!conf || !carteira.dataPosicao) {
    return (
      <section className="mc-card" aria-labelledby={idTitulo}>
        <h2 id={idTitulo} className="mc-titulo">Conferência com a Posição</h2>
        <p className="mc-texto">
          Importe o extrato de <strong>Posição</strong> da B3 para o app conferir, ativo por ativo, se o histórico importado explica o que você tem hoje.
          É assim que o preço médio fica confiável.
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

      <div className="mc-form-linha">
        <label htmlFor={`${idTitulo}-data`} className="mc-rotulo-campo">Data da Posição</label>
        <input
          id={`${idTitulo}-data`}
          type="date"
          className="mc-campo mc-campo-data"
          value={carteira.dataPosicao}
          onChange={(e) => e.target.value && onDataPosicao(e.target.value)}
        />
        <span className="mc-dica">Em geral, o pregão anterior ao dia em que você baixou o arquivo.</span>
      </div>

      {pendentes.length === 0 ? (
        <p className="mc-ok">Tudo confere: o preço médio calculado reflete o que está na sua custódia.</p>
      ) : (
        <>
          <p className="mc-texto">
            {pendentes.length} ativo(s) pedem atenção. Para os que faltam histórico, informe o preço médio do que você já tinha antes do período importado, ou
            importe um período mais longo.
          </p>
          <ul className="mc-pendentes">
            {visiveis.map((i) => (
              <ItemPendente key={i.ativo} item={i} onSaldoInicial={onSaldoInicial} />
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
