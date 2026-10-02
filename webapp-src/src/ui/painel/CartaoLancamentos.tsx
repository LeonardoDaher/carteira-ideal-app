import { useEffect, useId, useState } from 'react'
import { lerNumero } from '../../domain/importacao/celulas'
import type { Lancamento, LancamentoNovo, OrigemLancamento, ProblemaLancamento, SubtipoProvento, TipoLancamento } from '../../domain/lancamentos'
import { dataCurta } from './formatar'
import { useValores } from './valoresOcultos'

const ROTULO_TIPO: Record<TipoLancamento, string> = {
  compra: 'Compra',
  venda: 'Venda',
  saldoInicial: 'Saldo inicial',
  bonificacao: 'Bonificação',
  ajusteQuantidade: 'Desdobramento/grupamento',
  provento: 'Provento',
}
const ROTULO_ORIGEM: Record<OrigemLancamento, string> = {
  manual: 'Manual',
  'b3-nota': 'Nota',
  'b3-negociacao': 'B3 Negociação',
  'b3-movimentacao': 'B3 Movimentação',
  'b3-proventos': 'B3 Proventos',
  arquivo: 'Planilha',
}
const ROTULO_SUBTIPO: Record<SubtipoProvento, string> = { dividendo: 'Dividendo', jcp: 'JCP', amortizacao: 'Amortização', reembolso: 'Reembolso', juros: 'Juros', rendimento: 'Rendimento' }

export type FiltroTipo = 'todos' | 'negocios' | 'proventos' | 'manuais'
const ROTULO_FILTRO: Record<FiltroTipo, string> = { todos: 'Todos', negocios: 'Compras e vendas', proventos: 'Proventos', manuais: 'Digitados por mim' }

/** Que lançamentos cada filtro deixa passar. "Digitados por mim" são os que a pessoa lançou à mão (origem manual). */
function passaNoTipo(l: Lancamento, tipo: FiltroTipo): boolean {
  if (tipo === 'todos') return true
  if (tipo === 'manuais') return l.origem === 'manual'
  return (tipo === 'proventos') === (l.tipo === 'provento')
}

interface Campos {
  tipo: TipoLancamento
  data: string
  ativo: string
  quantidade: string
  preco: string
  taxas: string
  valor: string
  subtipo: SubtipoProvento
}

const num = (n: number) => String(n).replace('.', ',')

function camposDe(l: Lancamento): Campos {
  return {
    tipo: l.tipo,
    data: l.data,
    ativo: l.ativo,
    quantidade: l.quantidade ? num(l.quantidade) : '',
    preco: l.preco ? num(l.preco) : '',
    taxas: l.taxas ? num(l.taxas) : '',
    valor: l.tipo === 'provento' ? num(l.valor) : '',
    subtipo: l.subtipo ?? 'dividendo',
  }
}

/** Converte os campos digitados em um lançamento (ou explica o que está errado). */
export function lancamentoDosCampos(c: Campos): { novo?: Omit<LancamentoNovo, 'origem'>; erro?: string } {
  const ativo = c.ativo.trim().toUpperCase()
  if (!c.data) return { erro: 'Informe a data.' }
  if (!ativo) return { erro: 'Informe o ativo (ex.: MXRF11, PETR4, Tesouro Selic 2029).' }
  const taxas = c.taxas.trim() ? lerNumero(c.taxas) : 0
  if (taxas === null || taxas < 0) return { erro: 'As taxas devem ser um número maior ou igual a zero.' }

  if (c.tipo === 'provento') {
    const valor = lerNumero(c.valor)
    if (valor === null || valor <= 0) return { erro: 'Informe o valor recebido (maior que zero).' }
    return { novo: { data: c.data, tipo: 'provento', ativo, quantidade: lerNumero(c.quantidade) ?? 0, preco: 0, valor, taxas: 0, subtipo: c.subtipo } }
  }
  const quantidade = lerNumero(c.quantidade)
  if (quantidade === null || quantidade === 0) return { erro: 'Informe a quantidade.' }
  if (c.tipo === 'ajusteQuantidade') {
    return { novo: { data: c.data, tipo: 'ajusteQuantidade', ativo, quantidade, preco: 0, valor: 0, taxas: 0 } }
  }
  if (quantidade < 0) return { erro: 'A quantidade deve ser maior que zero (use "venda" para sair da posição).' }
  const preco = c.preco.trim() ? lerNumero(c.preco) : c.tipo === 'bonificacao' ? 0 : null
  if (preco === null || preco < 0 || (c.tipo !== 'bonificacao' && preco === 0)) return { erro: 'Informe o preço por unidade (maior que zero).' }
  return { novo: { data: c.data, tipo: c.tipo, ativo, quantidade, preco, valor: Math.round(quantidade * preco * 100) / 100, taxas } }
}

function Formulario({
  inicial,
  hoje,
  titulo,
  onEnviar,
  onCancelar,
}: {
  inicial?: Lancamento
  hoje: string
  titulo: string
  onEnviar: (novo: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null
  onCancelar: () => void
}) {
  const id = useId()
  const [c, setC] = useState<Campos>(() => (inicial ? camposDe(inicial) : { tipo: 'compra', data: hoje, ativo: '', quantidade: '', preco: '', taxas: '', valor: '', subtipo: 'dividendo' }))
  const [erro, setErro] = useState<string | null>(null)
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((x) => ({ ...x, [k]: v }))
  const ehProvento = c.tipo === 'provento'
  const ehAjuste = c.tipo === 'ajusteQuantidade'

  function enviar() {
    const r = lancamentoDosCampos(c)
    if (!r.novo) return setErro(r.erro ?? 'Confira os campos.')
    const problema = onEnviar(r.novo)
    if (problema) setErro(problema.motivo)
  }

  return (
    <form
      className="mc-form"
      aria-label={titulo}
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
    >
      <h3 className="mc-subtitulo">{titulo}</h3>
      <div className="mc-form-grade">
        <label className="mc-campo-bloco" htmlFor={`${id}-tipo`}>
          <span className="mc-rotulo-campo">Tipo</span>
          <select id={`${id}-tipo`} className="mc-campo" value={c.tipo} onChange={(e) => set('tipo', e.target.value as TipoLancamento)}>
            {(Object.keys(ROTULO_TIPO) as TipoLancamento[]).map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
            ))}
          </select>
        </label>
        <label className="mc-campo-bloco" htmlFor={`${id}-data`}>
          <span className="mc-rotulo-campo">Data</span>
          <input id={`${id}-data`} type="date" className="mc-campo" value={c.data} onChange={(e) => set('data', e.target.value)} />
        </label>
        <label className="mc-campo-bloco" htmlFor={`${id}-ativo`}>
          <span className="mc-rotulo-campo">Ativo</span>
          <input id={`${id}-ativo`} className="mc-campo" placeholder="MXRF11" value={c.ativo} onChange={(e) => set('ativo', e.target.value)} />
        </label>
        <label className="mc-campo-bloco" htmlFor={`${id}-qtd`}>
          <span className="mc-rotulo-campo">{ehAjuste ? 'Quantidade a somar (negativa para grupamento)' : ehProvento ? 'Cotas/ações (opcional)' : 'Quantidade'}</span>
          <input id={`${id}-qtd`} className="mc-campo" inputMode="decimal" placeholder="0" value={c.quantidade} onChange={(e) => set('quantidade', e.target.value)} />
        </label>
        {ehProvento ? (
          <>
            <label className="mc-campo-bloco" htmlFor={`${id}-valor`}>
              <span className="mc-rotulo-campo">Valor recebido (R$)</span>
              <input id={`${id}-valor`} className="mc-campo" inputMode="decimal" placeholder="0,00" value={c.valor} onChange={(e) => set('valor', e.target.value)} />
            </label>
            <label className="mc-campo-bloco" htmlFor={`${id}-sub`}>
              <span className="mc-rotulo-campo">Tipo de provento</span>
              <select id={`${id}-sub`} className="mc-campo" value={c.subtipo} onChange={(e) => set('subtipo', e.target.value as SubtipoProvento)}>
                {(Object.keys(ROTULO_SUBTIPO) as SubtipoProvento[]).map((s) => (
                  <option key={s} value={s}>{ROTULO_SUBTIPO[s]}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          !ehAjuste && (
            <>
              <label className="mc-campo-bloco" htmlFor={`${id}-preco`}>
                <span className="mc-rotulo-campo">{c.tipo === 'saldoInicial' ? 'Preço médio (R$)' : 'Preço por unidade (R$)'}</span>
                <input id={`${id}-preco`} className="mc-campo" inputMode="decimal" placeholder="0,00" value={c.preco} onChange={(e) => set('preco', e.target.value)} />
              </label>
              <label className="mc-campo-bloco" htmlFor={`${id}-taxas`}>
                <span className="mc-rotulo-campo">Taxas (R$, opcional)</span>
                <input id={`${id}-taxas`} className="mc-campo" inputMode="decimal" placeholder="0,00" value={c.taxas} onChange={(e) => set('taxas', e.target.value)} />
              </label>
            </>
          )
        )}
      </div>
      {erro && <div className="mc-erro" role="alert">{erro}</div>}
      <div className="mc-acoes">
        <button type="submit" className="btn btn-primary mc-btn">Salvar</button>
        <button type="button" className="btn btn-ghost mc-btn" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

export function CartaoLancamentos({
  lancamentos,
  hoje,
  onAdicionar,
  onCorrigir,
  onExcluir,
  abrirNovo = 0,
  filtro,
  onFiltro,
  filtroTipo,
  onFiltroTipo,
}: {
  lancamentos: Lancamento[]
  hoje: string
  /** Contador: cada vez que sobe, abre o formulário de novo lançamento (usado pelo cartão "Lançamento direto"). */
  abrirNovo?: number
  /** Texto digitado no filtro por ativo (vazio = todos). */
  filtro: string
  onFiltro: (texto: string) => void
  /** Que tipo de lançamento mostrar: todos, só compras/vendas (o que forma o preço médio) ou só proventos. */
  filtroTipo: FiltroTipo
  onFiltroTipo: (tipo: FiltroTipo) => void
  onAdicionar: (novo: Omit<LancamentoNovo, 'origem'>) => ProblemaLancamento | null
  onCorrigir: (id: string, correcao: Partial<Omit<LancamentoNovo, 'origem'>>) => ProblemaLancamento | null
  onExcluir: (id: string) => void
}) {
  const idTitulo = useId()
  const { reais, quantidade: quantidadeBR } = useValores()
  const [modo, setModo] = useState<{ tipo: 'fechado' } | { tipo: 'novo' } | { tipo: 'editar'; id: string }>({ tipo: 'fechado' })
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [todos, setTodos] = useState(false)
  useEffect(() => {
    if (abrirNovo > 0) setModo({ tipo: 'novo' })
  }, [abrirNovo])
  const termo = filtro.trim().toUpperCase()
  const filtrando = !!termo || filtroTipo !== 'todos'
  const filtrados = lancamentos.filter(
    (l) => (!termo || l.ativo.includes(termo)) && passaNoTipo(l, filtroTipo),
  )
  const recentes = [...filtrados].sort((a, b) => b.data.localeCompare(a.data))
  const visiveis = todos ? recentes : recentes.slice(0, 15)
  const editando = modo.tipo === 'editar' ? lancamentos.find((l) => l.id === modo.id) : undefined

  return (
    <section className="mc-card" aria-labelledby={idTitulo} id="mc-lancamentos">
      <div className="mc-topo-linha">
        <h2 id={idTitulo} className="mc-titulo">Lançamentos</h2>
        {modo.tipo === 'fechado' && (
          <button type="button" className="btn btn-secondary mc-btn" onClick={() => setModo({ tipo: 'novo' })}>
            Adicionar lançamento
          </button>
        )}
      </div>
      <div className="mc-rotulo">{filtrando ? `${filtrados.length} de ${lancamentos.length} lançamento(s)` : `${lancamentos.length} lançamento(s)`}</div>
      <div className="mc-filtro">
        <input
          className="mc-campo mc-campo-curto"
          aria-label="Filtrar lançamentos por ativo"
          placeholder="Filtrar por ativo (ex.: PETR4)"
          value={filtro}
          onChange={(e) => onFiltro(e.target.value)}
        />
        {filtrando && (
          <button
            type="button"
            className="btn btn-ghost mc-btn"
            onClick={() => {
              onFiltro('')
              onFiltroTipo('todos')
            }}
          >
            Limpar filtro
          </button>
        )}
      </div>
      <div className="mc-chips" role="group" aria-label="Tipo de lançamento">
        {(['todos', 'negocios', 'proventos', 'manuais'] as FiltroTipo[]).map((t) => (
          <button key={t} type="button" className="mc-chip" aria-pressed={filtroTipo === t} onClick={() => onFiltroTipo(t)}>
            {ROTULO_FILTRO[t]}
          </button>
        ))}
      </div>

      {modo.tipo === 'novo' && (
        <Formulario
          titulo="Novo lançamento"
          hoje={hoje}
          onEnviar={(n) => {
            const p = onAdicionar(n)
            if (!p) setModo({ tipo: 'fechado' })
            return p
          }}
          onCancelar={() => setModo({ tipo: 'fechado' })}
        />
      )}
      {editando && (
        <Formulario
          key={editando.id}
          titulo="Corrigir lançamento"
          hoje={hoje}
          inicial={editando}
          onEnviar={(n) => {
            const p = onCorrigir(editando.id, n)
            if (!p) setModo({ tipo: 'fechado' })
            return p
          }}
          onCancelar={() => setModo({ tipo: 'fechado' })}
        />
      )}

      {recentes.length === 0 ? (
        <p className="mc-texto">{termo ? `Nenhum lançamento de ${termo}.` : filtrando ? 'Nenhum lançamento deste tipo.' : 'Nenhum lançamento ainda. Importe um extrato ou adicione o primeiro à mão.'}</p>
      ) : (
        <ul className="mc-lancamentos">
          {visiveis.map((l) => (
            <li key={l.id} className="mc-lancamento">
              <div className="mc-lanc-topo">
                <strong>{l.ativo}</strong>
                <span className="mc-nota">{dataCurta(l.data)}</span>
                <span className="mc-selo info">{ROTULO_TIPO[l.tipo]}</span>
                <span className="mc-selo neutro">{ROTULO_ORIGEM[l.origem]}</span>
              </div>
              <div className="mc-lanc-meio">
                {l.tipo === 'provento' ? (
                  <span>{reais(l.valor)} recebidos</span>
                ) : l.tipo === 'ajusteQuantidade' ? (
                  <span>{l.quantidade > 0 ? '+' : ''}{quantidadeBR(l.quantidade)} un. (custo total não muda)</span>
                ) : (
                  <span>
                    {quantidadeBR(l.quantidade)} × {reais(l.preco)} = {reais(l.valor)}
                    {l.taxas > 0 && <span className="mc-nota"> · taxas {reais(l.taxas)}</span>}
                  </span>
                )}
              </div>
              <div className="mc-acoes">
                {excluindo === l.id ? (
                  <>
                    <span className="mc-nota">
                      {l.origem === 'manual' ? 'Excluir este lançamento?' : 'Excluir? Reimportar o extrato não o traz de volta.'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary mc-btn mc-perigo"
                      onClick={() => {
                        onExcluir(l.id)
                        setExcluindo(null)
                      }}
                    >
                      Sim, excluir
                    </button>
                    <button type="button" className="btn btn-ghost mc-btn" onClick={() => setExcluindo(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost mc-btn" aria-label={`Corrigir lançamento de ${l.ativo} em ${dataCurta(l.data)}`} onClick={() => setModo({ tipo: 'editar', id: l.id })}>
                      Corrigir
                    </button>
                    <button type="button" className="btn btn-ghost mc-btn" aria-label={`Excluir lançamento de ${l.ativo} em ${dataCurta(l.data)}`} onClick={() => setExcluindo(l.id)}>
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {recentes.length > 15 && (
        <button type="button" className="btn btn-ghost mc-btn" onClick={() => setTodos((v) => !v)}>
          {todos ? 'Mostrar menos' : `Mostrar todos (${recentes.length})`}
        </button>
      )}
    </section>
  )
}
