import { useId, useState } from 'react'
import { CATEGORIAS, agruparPorCategoria, resumoDaLista } from '../domain/supermercado'
import type { CategoriaId, ItemDeCompra } from '../domain/supermercado'
import { useSupermercado } from '../state/useSupermercado'

/**
 * Meu Mês, aba Supermercado (D74): a pessoa escreve (ou dita, pelo microfone do teclado) o que
 * precisa comprar, o app separa em itens, sugere a categoria de cada um e ela vai ticando no
 * mercado. Sem IA e sem rede: a lista fica só no aparelho.
 */
export function MeuMesSupermercado() {
  const est = useSupermercado()
  const idTexto = useId()
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  // Apagar é de dois passos: o primeiro toque pede confirmação.
  const [confirmando, setConfirmando] = useState<'comprados' | 'tudo' | null>(null)

  if (!est.hidratado) return <div className="card" aria-busy="true" />

  const { lista } = est
  const resumo = resumoDaLista(lista)
  const grupos = agruparPorCategoria(lista)

  function adicionar() {
    if (!texto.trim()) return
    const { adicionados, repetidos } = est.adicionarTexto(texto)
    setTexto('')
    setConfirmando(null)
    const partes: string[] = []
    if (adicionados > 0) partes.push(adicionados === 1 ? '1 item adicionado.' : `${adicionados} itens adicionados.`)
    if (repetidos.length > 0) partes.push(`Já estava na lista: ${repetidos.join(', ')}.`)
    setAviso(partes.join(' '))
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card col" style={{ gap: 10 }}>
        <label htmlFor={idTexto} style={{ fontWeight: 700, fontSize: 14 }}>
          O que você precisa comprar?
        </label>
        <textarea
          id={idTexto}
          className="input-cotas sm-texto"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) adicionar()
          }}
          placeholder="Ex.: arroz, feijão, 2 litros de leite, sabão em pó e frango"
        />
        <div className="muted tiny justify">
          Separe por vírgula, “e” ou uma linha para cada item. No celular, toque no microfone do teclado para falar em vez de digitar.
          O app escolhe a categoria de cada item; você pode trocar depois.
        </div>
        <button className="btn btn-primary" disabled={!texto.trim()} onClick={adicionar}>
          Adicionar à lista
        </button>
        <div className="small muted" role="status" aria-live="polite">
          {aviso}
        </div>
      </div>

      {resumo.total === 0 ? (
        <div className="card muted small justify">
          Sua lista está vazia. Escreva acima o que precisa comprar e os itens aparecem aqui, separados por categoria, cada um com uma
          bolinha para você ticar no mercado.
        </div>
      ) : (
        <div className="card col" style={{ gap: 12 }}>
          <div className="row-between" style={{ alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Lista de compras</span>
            <span className="small muted" aria-live="polite">
              {resumo.comprados} de {resumo.total} no carrinho
            </span>
          </div>
          <div className="mm-progresso" aria-hidden="true">
            <div style={{ width: `${(resumo.comprados / resumo.total) * 100}%` }} />
          </div>

          {grupos.map(({ categoria, itens }) => (
            <section key={categoria.id} className="col" style={{ gap: 2 }} aria-label={categoria.nome}>
              <h2 className="sm-categoria">
                <span aria-hidden="true">{categoria.emoji} </span>
                {categoria.nome}
              </h2>
              <ul className="mm-lista">
                {itens.map((item) => (
                  <LinhaDoItem
                    key={item.id}
                    item={item}
                    onAlternar={() => est.alternar(item.id)}
                    onCategoria={(c) => est.trocarCategoria(item.id, c)}
                    onRemover={() => est.remover(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div className="mm-rodape-lista col" style={{ gap: 8 }}>
            {resumo.comprados > 0 &&
              (confirmando === 'comprados' ? (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      est.limparJaComprados()
                      setConfirmando(null)
                      setAviso('')
                    }}
                  >
                    Confirmar: tirar {resumo.comprados} {resumo.comprados === 1 ? 'item comprado' : 'itens comprados'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmando(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={() => setConfirmando('comprados')}>
                  Tirar da lista o que já comprei
                </button>
              ))}
            {resumo.comprados > 0 && (
              <button className="btn btn-ghost" onClick={est.desmarcar}>
                Desmarcar tudo (usar a lista de novo)
              </button>
            )}
            {confirmando === 'tudo' ? (
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    est.apagarTudo()
                    setConfirmando(null)
                    setAviso('')
                  }}
                >
                  Confirmar: apagar a lista inteira
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmando(null)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirmando('tudo')}>
                Apagar a lista inteira
              </button>
            )}
          </div>
        </div>
      )}

      <div className="muted tiny justify">
        A lista fica só neste aparelho e não vai para nenhum servidor. Se trocar de celular ou limpar os dados do navegador, ela some.
      </div>
    </div>
  )
}

function LinhaDoItem({
  item,
  onAlternar,
  onCategoria,
  onRemover,
}: {
  item: ItemDeCompra
  onAlternar: () => void
  onCategoria: (c: CategoriaId) => void
  onRemover: () => void
}) {
  const rotulo = item.quantidade ? `${item.nome}, ${item.quantidade}` : item.nome
  return (
    <li className="sm-linha">
      <label className={`mm-item ${item.comprado ? 'ticado' : ''}`}>
        <input type="checkbox" className="mm-check" checked={item.comprado} onChange={onAlternar} aria-label={rotulo} />
        <span className="mm-item-nome" style={{ flex: 1 }}>
          {item.nome}
          {item.quantidade && <span className="muted small"> · {item.quantidade}</span>}
        </span>
      </label>
      <select
        className="input-cotas sm-categoria-select"
        aria-label={`Categoria de ${item.nome}`}
        value={item.categoria}
        onChange={(e) => onCategoria(e.target.value as CategoriaId)}
      >
        {CATEGORIAS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <button className="btn btn-ghost sm-remover" onClick={onRemover} aria-label={`Remover ${item.nome}`}>
        ✕
      </button>
    </li>
  )
}
