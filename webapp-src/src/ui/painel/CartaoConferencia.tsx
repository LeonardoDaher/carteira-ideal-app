import { useId, useMemo, useState } from 'react'
import type { CarteiraSalva } from '../../domain/carteiraSalva'
import { conferirComPosicao, criarSaldoInicial } from '../../domain/conferencia'
import type { ItemConferencia } from '../../domain/conferencia'
import { lerNumero } from '../../domain/importacao/celulas'
import { derivarPosicoes, somarDiasUteis } from '../../domain/lancamentos'
import type { Lancamento, LancamentoNovo, ProblemaLancamento } from '../../domain/lancamentos'
import { dataCurta, quantidadeBR } from './formatar'

type Adicionar = (l: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null

const ROTULO_STATUS: Record<ItemConferencia['status'], string> = {
  confere: 'Confere',
  faltaSaldoAnterior: 'Falta histórico anterior',
  inconsistente: 'Inconsistente',
}
const EPS = 1e-9
const numero = (n: number) => String(Number(n.toFixed(6))).replace('.', ',')

type MotivoBaixa = 'venda' | 'ajuste'

/**
 * Dar baixa: os lançamentos mostram MAIS do que a custódia. A causa o app não sabe (venda feita fora do
 * histórico, desdobramento, grupamento, incorporação), então a pessoa escolhe. A venda tem preço (por
 * padrão o preço médio, que dá resultado zero); o evento da empresa só ajusta a quantidade.
 */
function FormBaixa({ item, dataPosicao, precoMedio, onAdicionar, onFechar }: { item: ItemConferencia; dataPosicao: string; precoMedio: number; onAdicionar: Adicionar; onFechar: () => void }) {
  const id = useId()
  // Uma venda só vale na conferência depois de liquidada (D+2 úteis); o evento da empresa, não.
  const dataPadrao = (m: MotivoBaixa) => (m === 'venda' ? somarDiasUteis(dataPosicao, -2) : dataPosicao)
  const [motivo, setMotivo] = useState<MotivoBaixa>('venda')
  const [quantidade, setQuantidade] = useState(numero(item.excesso))
  const [preco, setPreco] = useState(precoMedio > 0 ? numero(Math.round(precoMedio * 100) / 100) : '')
  const [data, setData] = useState(dataPadrao('venda'))
  const [erro, setErro] = useState<string | null>(null)

  function trocarMotivo(novo: MotivoBaixa) {
    setData((d) => (d === dataPadrao(motivo) ? dataPadrao(novo) : d))
    setMotivo(novo)
  }

  function lancar() {
    const q = lerNumero(quantidade)
    if (q === null || q <= 0) return setErro('Informe a quantidade (maior que zero).')
    if (!data) return setErro('Informe a data.')
    let novo: Omit<LancamentoNovo, 'origem'>
    if (motivo === 'venda') {
      const p = lerNumero(preco)
      if (p === null || p <= 0) return setErro('Informe o preço de venda (maior que zero).')
      novo = { data, tipo: 'venda', ativo: item.ativo, quantidade: q, preco: p, valor: Math.round(q * p * 100) / 100, taxas: 0 }
    } else {
      novo = { data, tipo: 'ajusteQuantidade', ativo: item.ativo, quantidade: -q, preco: 0, valor: 0, taxas: 0 }
    }
    const problema = onAdicionar(novo)
    if (problema) setErro(problema.motivo)
    else onFechar()
  }

  return (
    <div className="mc-form" role="group" aria-label={`Dar baixa em ${item.ativo}`}>
      <h3 className="mc-subtitulo">Dar baixa em {item.ativo}</h3>
      <div className="mc-form-grade">
        <label className="mc-campo-bloco" htmlFor={`${id}-motivo`}>
          <span className="mc-rotulo-campo">Motivo</span>
          <select id={`${id}-motivo`} className="mc-campo" value={motivo} onChange={(e) => trocarMotivo(e.target.value as MotivoBaixa)}>
            <option value="venda">Foi vendido</option>
            <option value="ajuste">Desdobramento, grupamento ou incorporação</option>
          </select>
        </label>
        <label className="mc-campo-bloco" htmlFor={`${id}-qtd`}>
          <span className="mc-rotulo-campo">Quantidade</span>
          <input id={`${id}-qtd`} className="mc-campo" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </label>
        {motivo === 'venda' && (
          <label className="mc-campo-bloco" htmlFor={`${id}-preco`}>
            <span className="mc-rotulo-campo">Preço de venda (R$)</span>
            <input id={`${id}-preco`} className="mc-campo" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </label>
        )}
        <label className="mc-campo-bloco" htmlFor={`${id}-data`}>
          <span className="mc-rotulo-campo">Data</span>
          <input id={`${id}-data`} type="date" className="mc-campo" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      </div>
      <div className="mc-nota">
        {motivo === 'venda'
          ? 'O preço já vem com o seu preço médio (resultado zero). Troque pelo real, se souber.'
          : 'Muda só a quantidade. O custo total continua o mesmo.'}
      </div>
      {erro && <div className="mc-erro" role="alert">{erro}</div>}
      <div className="mc-acoes">
        <button type="button" className="btn btn-primary mc-btn" onClick={lancar}>Lançar baixa</button>
        <button type="button" className="btn btn-ghost mc-btn" onClick={onFechar}>Cancelar</button>
      </div>
    </div>
  )
}

function ItemPendente({
  item,
  lancamentos,
  dataPosicao,
  onAdicionar,
  onVerLancamentos,
}: {
  item: ItemConferencia
  lancamentos: Lancamento[]
  dataPosicao: string
  onAdicionar: Adicionar
  onVerLancamentos: (ativo: string) => void
}) {
  const id = useId()
  const [pm, setPm] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [baixaAberta, setBaixaAberta] = useState(false)

  // Falta histórico: o que falta. Inconsistente porque as vendas superam o histórico: o saldo que ele exige.
  const quantidadeSaldo = item.status === 'faltaSaldoAnterior' ? item.faltante : item.saldoNecessario
  const precoMedio = useMemo(
    () => derivarPosicoes(lancamentos.filter((l) => l.ativo === item.ativo)).posicoes[0]?.precoMedio ?? 0,
    [lancamentos, item.ativo],
  )

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

      {quantidadeSaldo > EPS && (
        <div className="mc-form-linha">
          <label htmlFor={`${id}-pm`} className="mc-rotulo-campo">
            Preço médio dos {quantidadeBR(quantidadeSaldo)} anteriores
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

      {baixaAberta && <FormBaixa item={item} dataPosicao={dataPosicao} precoMedio={precoMedio} onAdicionar={onAdicionar} onFechar={() => setBaixaAberta(false)} />}

      <div className="mc-acoes">
        {item.excesso > EPS && !baixaAberta && (
          <button type="button" className="btn btn-secondary mc-btn" onClick={() => setBaixaAberta(true)}>
            Dar baixa em {quantidadeBR(item.excesso)}
          </button>
        )}
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
    () => (carteira.posicao && carteira.dataPosicao ? conferirComPosicao(carteira.lancamentos, carteira.posicao, carteira.dataPosicao) : null),
    [carteira.lancamentos, carteira.posicao, carteira.dataPosicao],
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
              <ItemPendente key={i.ativo} item={i} lancamentos={carteira.lancamentos} dataPosicao={carteira.dataPosicao!} onAdicionar={onAdicionar} onVerLancamentos={onVerLancamentos} />
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
