import { useEffect, useId, useRef, useState } from 'react'
import type { AtivoManual } from '../../domain/ativosManuais'
import { CLASSES_ESCOLHA, ehClasseValida, ROTULO_CLASSE } from '../../domain/classesDaCarteira'
import type { ClasseCarteira } from '../../domain/classificadorAtivo'
import { lerNumero } from '../../domain/importacao/celulas'
import type { LinhaPosicao } from '../../domain/painelCarteira'
import { XIcon } from '../Icon'

const numero = (n: number | null) => (n === null ? '' : String(Math.round(n * 100) / 100).replace('.', ','))

export interface AcoesPainel {
  /** Preço médio informado para um ativo da B3 (null volta ao calculado). */
  onPrecoMedio: (ativo: string, preco: number | null) => void
  /** Classe escolhida para um ativo da B3 (null volta à detecção automática). */
  onClasse: (ativo: string, classe: ClasseCarteira | null) => void
  /** Salva um ativo digitado à mão. Devolve a mensagem de erro, ou null se salvou. */
  onSalvarManual: (dados: Omit<AtivoManual, 'ativo'>, ativoAntigo?: string) => string | null
  onRemoverManual: (ativo: string) => void
  /** Palpite de classe a partir do nome (ex.: "PETR4"). */
  sugerirClasse: (nome: string) => ClasseCarteira | null
}

/**
 * Painel de edição de um ativo, aberto pelo lápis (ou por "Adicionar ativo"), numa janela por cima da tela.
 *  - ativo da B3: preço médio e classe;
 *  - ativo digitado à mão (ou novo): nome, quantidade, preço médio, valor atual (opcional) e classe.
 */
export function PainelEdicaoAtivo({
  linha,
  classeAtual,
  classeEscolhida,
  acoes,
  onFechar,
}: {
  /** undefined = adicionar um ativo novo. */
  linha?: LinhaPosicao
  /** Classe em vigor hoje (a escolhida ou a detectada). */
  classeAtual: ClasseCarteira | null
  /** Classe que a PESSOA escolheu para este ativo, se escolheu. */
  classeEscolhida: ClasseCarteira | undefined
  acoes: AcoesPainel
  onFechar: () => void
}) {
  const id = useId()
  const ehNovo = !linha
  const ehManual = ehNovo || !!linha?.manual
  const primeiro = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState(linha?.manual ? linha.ativo : '')
  const [quantidade, setQuantidade] = useState(linha?.manual ? numero(linha.quantidade) : '')
  const [preco, setPreco] = useState(numero(linha?.precoMedio ?? null))
  const [valorAtual, setValorAtual] = useState(linha?.manual ? numero(linha.valorAtual) : '')
  const [classe, setClasse] = useState<ClasseCarteira | ''>(ehManual ? (linha?.classeManual ?? '') : (classeEscolhida ?? ''))
  const [escolheuClasse, setEscolheuClasse] = useState(!ehNovo)
  const [erro, setErro] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    primeiro.current?.focus()
    const fecharComEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', fecharComEsc)
    return () => document.removeEventListener('keydown', fecharComEsc)
  }, [onFechar])

  function mudarNome(texto: string) {
    setNome(texto)
    // Num ativo novo, sugere a classe pelo nome enquanto a pessoa ainda não escolheu uma.
    if (ehNovo && !escolheuClasse) setClasse(acoes.sugerirClasse(texto) ?? '')
  }

  function salvar() {
    if (ehManual) {
      const q = lerNumero(quantidade)
      const p = lerNumero(preco)
      const v = valorAtual.trim() ? lerNumero(valorAtual) : null
      if (!classe) return setErro('Escolha a classe do ativo.')
      if (q === null || p === null || (valorAtual.trim() && v === null)) return setErro('Confira os números: use só dígitos e vírgula.')
      const msg = acoes.onSalvarManual({ nome: nome.trim(), quantidade: q, precoMedio: p, valorAtual: v, classe }, linha?.manual ? linha.ativo : undefined)
      if (msg) return setErro(msg)
      return onFechar()
    }
    // ativo da B3
    if (preco.trim()) {
      const p = lerNumero(preco)
      if (p === null || p <= 0) return setErro('Informe um preço médio maior que zero.')
      if (p !== linha!.precoMedio || linha!.origemPrecoMedio !== 'informado') acoes.onPrecoMedio(linha!.ativo, p)
    }
    acoes.onClasse(linha!.ativo, classe === '' ? null : classe)
    onFechar()
  }

  const titulo = ehNovo ? 'Adicionar ativo' : `Editar ${linha!.ativo}`

  return (
    <div
      className="mc-modal-fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <form
        className="mc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        onSubmit={(e) => {
          e.preventDefault()
          salvar()
        }}
      >
        <div className="mc-topo-linha">
          <h2 id={`${id}-titulo`} className="mc-titulo">{titulo}</h2>
          <button type="button" className="mc-fechar" aria-label="Fechar" onClick={onFechar}>
            <XIcon size={18} />
          </button>
        </div>
        {!ehNovo && !ehManual && (
          <p className="mc-texto">{linha!.categoria ? 'Ativo da sua Posição na B3.' : 'Compra recente, ainda não liquidada.'}</p>
        )}
        {ehManual && <p className="mc-texto">Informe a sua posição, não uma compra. Serve para CDB, previdência, fundos, exterior ou qualquer ativo que não vem nos extratos.</p>}

        <div className="mc-form-grade">
          {ehManual && (
            <label className="mc-campo-bloco mc-ocupa-linha" htmlFor={`${id}-nome`}>
              <span className="mc-rotulo-campo">Nome ou código do ativo</span>
              <input id={`${id}-nome`} ref={primeiro} className="mc-campo" placeholder="PETR4, CDB Banco X..." value={nome} onChange={(e) => mudarNome(e.target.value)} />
            </label>
          )}
          {ehManual && (
            <label className="mc-campo-bloco" htmlFor={`${id}-qtd`}>
              <span className="mc-rotulo-campo">Quantidade</span>
              <input id={`${id}-qtd`} className="mc-campo" inputMode="decimal" placeholder="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </label>
          )}
          <label className="mc-campo-bloco" htmlFor={`${id}-pm`}>
            <span className="mc-rotulo-campo">Preço médio (R$ por unidade)</span>
            <input id={`${id}-pm`} ref={ehManual ? undefined : primeiro} className="mc-campo" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </label>
          {ehManual && (
            <label className="mc-campo-bloco" htmlFor={`${id}-valor`}>
              <span className="mc-rotulo-campo">Valor atual total (R$, opcional)</span>
              <input id={`${id}-valor`} className="mc-campo" inputMode="decimal" placeholder="Sem informar, usa o custo" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
            </label>
          )}
          <label className="mc-campo-bloco mc-ocupa-linha" htmlFor={`${id}-classe`}>
            <span className="mc-rotulo-campo">Classe do ativo</span>
            <select
              id={`${id}-classe`}
              className="mc-campo"
              value={classe}
              onChange={(e) => {
                setEscolheuClasse(true)
                setClasse(ehClasseValida(e.target.value) ? e.target.value : '')
              }}
            >
              {ehManual ? (
                <option value="">Escolher a classe…</option>
              ) : (
                <option value="">Automática{classeAtual && !classeEscolhida ? ` (${ROTULO_CLASSE[classeAtual]})` : ''}</option>
              )}
              {CLASSES_ESCOLHA.map((c) => (
                <option key={c} value={c}>{ROTULO_CLASSE[c]}</option>
              ))}
            </select>
          </label>
        </div>
        {!ehManual && <div className="mc-nota">Deixe o preço médio em branco para manter o que o app já calcula.</div>}
        {erro && <div className="mc-erro" role="alert">{erro}</div>}

        <div className="mc-acoes">
          <button type="submit" className="btn btn-primary mc-btn">Salvar</button>
          <button type="button" className="btn btn-ghost mc-btn" onClick={onFechar}>Cancelar</button>
          {!ehNovo && !ehManual && linha!.origemPrecoMedio === 'informado' && (
            <button
              type="button"
              className="btn btn-ghost mc-btn"
              onClick={() => {
                acoes.onPrecoMedio(linha!.ativo, null)
                onFechar()
              }}
            >
              Voltar ao calculado
            </button>
          )}
          {!ehNovo && ehManual &&
            (removendo ? (
              <>
                <span className="mc-nota">Remover este ativo?</span>
                <button
                  type="button"
                  className="btn btn-secondary mc-btn mc-perigo"
                  onClick={() => {
                    acoes.onRemoverManual(linha!.ativo)
                    onFechar()
                  }}
                >
                  Sim, remover
                </button>
                <button type="button" className="btn btn-ghost mc-btn" onClick={() => setRemovendo(false)}>Não</button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost mc-btn mc-perigo" onClick={() => setRemovendo(true)}>Remover ativo</button>
            ))}
        </div>
      </form>
    </div>
  )
}
