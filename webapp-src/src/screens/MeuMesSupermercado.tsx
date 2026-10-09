import { useId, useState } from 'react'
import { CATEGORIAS, agruparPorCategoria, linkDoWhatsApp, resumoDaLista } from '../domain/supermercado'
import type { CategoriaId, EdicaoDeItem, ItemDeCompra } from '../domain/supermercado'
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
  const linkWhatsApp = linkDoWhatsApp(lista)

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
                    onEditar={(dados) => est.editar(item.id, dados)}
                    onRemover={() => est.remover(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div className="mm-rodape-lista col" style={{ gap: 8 }}>
            {linkWhatsApp && (
              <a className="btn sm-whatsapp" href={linkWhatsApp} target="_blank" rel="noopener noreferrer">
                <IconeWhatsApp />
                Enviar o que falta pelo WhatsApp
              </a>
            )}
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
                  className="btn btn-primary"
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
              <button className="btn btn-primary" onClick={() => setConfirmando('tudo')}>
                Apagar a lista inteira
              </button>
            )}
          </div>
        </div>
      )}

      <div className="muted tiny justify">
        A lista fica só neste aparelho e não vai para nenhum servidor. Se trocar de celular ou limpar os dados do navegador, ela some. Ao enviar pelo WhatsApp, só o texto do que falta comprar sai do aparelho, para quem você escolher.
      </div>
    </div>
  )
}

function LinhaDoItem({
  item,
  onAlternar,
  onCategoria,
  onEditar,
  onRemover,
}: {
  item: ItemDeCompra
  onAlternar: () => void
  onCategoria: (c: CategoriaId) => void
  onEditar: (dados: EdicaoDeItem) => void
  onRemover: () => void
}) {
  const [editando, setEditando] = useState(false)
  const idBase = useId()
  const [nome, setNome] = useState(item.nome)
  const [quantidade, setQuantidade] = useState(item.quantidade)
  const [categoria, setCategoria] = useState<CategoriaId>(item.categoria)

  function abrirEdicao() {
    setNome(item.nome)
    setQuantidade(item.quantidade)
    setCategoria(item.categoria)
    setEditando(true)
  }

  function salvar() {
    if (!nome.trim()) return
    onEditar({ nome, quantidade, categoria })
    setEditando(false)
  }

  if (editando) {
    return (
      <li className="sm-edicao col" style={{ gap: 8 }}>
        <label htmlFor={`${idBase}-nome`} className="small" style={{ fontWeight: 700 }}>
          Nome do item
        </label>
        <input
          id={`${idBase}-nome`}
          className="input-cotas"
          style={{ fontWeight: 400 }}
          value={nome}
          autoFocus
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') setEditando(false)
          }}
        />
        <div className="muted tiny justify">
          Para separar em vários itens, escreva com vírgula (ex.: arroz, feijão, leite). Cada um vira um item, com a categoria sugerida.
        </div>
        <label htmlFor={`${idBase}-qtd`} className="small" style={{ fontWeight: 700 }}>
          Quantidade (opcional)
        </label>
        <input
          id={`${idBase}-qtd`}
          className="input-cotas"
          style={{ fontWeight: 400 }}
          value={quantidade}
          placeholder="Ex.: 2 litros"
          onChange={(e) => setQuantidade(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') setEditando(false)
          }}
        />
        <label htmlFor={`${idBase}-cat`} className="small" style={{ fontWeight: 700 }}>
          Categoria
        </label>
        <select id={`${idBase}-cat`} className="input-cotas" style={{ fontWeight: 400 }} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaId)}>
          {CATEGORIAS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" disabled={!nome.trim()} onClick={salvar}>
            Salvar
          </button>
          <button className="btn btn-ghost" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </div>
      </li>
    )
  }

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
      <div className="sm-acoes">
        <button className="btn btn-ghost sm-botao" onClick={abrirEdicao} aria-label={`Editar ${item.nome}`}>
          ✎
        </button>
        <button className="btn btn-ghost sm-botao" onClick={onRemover} aria-label={`Remover ${item.nome}`}>
          ✕
        </button>
      </div>
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
    </li>
  )
}

/** Logo do WhatsApp (glifo do Simple Icons, domínio público), na cor do texto do botão. */
function IconeWhatsApp() {
  return (
    <svg className="sm-whatsapp-icone" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}
