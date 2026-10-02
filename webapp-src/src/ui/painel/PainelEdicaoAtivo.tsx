import { useEffect, useId, useRef, useState } from 'react'
import type React from 'react'
import type { AtivoManual } from '../../domain/ativosManuais'
import { TAXA_MAX } from '../../domain/ativosManuais'
import { CLASSES_ESCOLHA, ehClasseValida, ROTULO_CLASSE } from '../../domain/classesDaCarteira'
import type { ClasseCarteira } from '../../domain/classificadorAtivo'
import { lerNumero } from '../../domain/importacao/celulas'
import type { LinhaPosicao } from '../../domain/painelCarteira'
import type { CategoriaPosicao } from '../../domain/importacao/planilha'
import { buscarTipos, GRUPOS_TIPO, tipoPorId, tiposDaCategoria, TIPOS_INVESTIMENTO } from '../../domain/tiposInvestimento'
import type { ModoLancamento, TipoInvestimento } from '../../domain/tiposInvestimento'
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
  /** Tira da lista um ativo da B3 (o histórico de lançamentos e proventos continua). */
  onExcluirAtivo: (ativo: string) => void
  /** Palpite de classe a partir do nome (ex.: "PETR4"). */
  sugerirClasse: (nome: string) => ClasseCarteira | null
}

/**
 * Painel de edição de um ativo, aberto pelo lápis (ou por "Adicionar posição"), numa janela por cima da tela.
 *  - ativo da B3: preço médio e classe;
 *  - ativo digitado à mão (ou novo): nome, quantidade, preço médio, valor atual (opcional) e classe.
 */
export function PainelEdicaoAtivo({
  linha,
  classeAtual,
  classeEscolhida,
  acoes,
  onFechar,
  grupo,
}: {
  /** Adicionando um ativo DENTRO de uma posição já existente (Ações, Renda fixa...): só os tipos dela. */
  grupo?: { categoria: CategoriaPosicao; rotulo: string }
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

  // Ativo novo: primeiro a pessoa escolhe o TIPO de investimento numa lista; depois preenche os dados.
  const opcoesDeTipo = grupo ? tiposDaCategoria(grupo.categoria) : TIPOS_INVESTIMENTO
  // Dentro de uma posição que só admite um tipo (Ações, BDRs...), o tipo já está definido: vai direto aos dados.
  const tipoInicial = tipoPorId(linha?.tipoManual) ?? (ehNovo && opcoesDeTipo.length === 1 ? opcoesDeTipo[0] : undefined)
  const [tipo, setTipo] = useState<TipoInvestimento | undefined>(tipoInicial)
  const [etapa, setEtapa] = useState<'tipo' | 'dados'>(ehNovo && !tipoInicial ? 'tipo' : 'dados')
  const [consulta, setConsulta] = useState('')
  // Por valor (aplicado e atual) ou por quantidade x preço. Ativo antigo sem tipo segue por quantidade x preço.
  const [modo, setModo] = useState<ModoLancamento>(
    tipoInicial?.modo === 'valor' && (!linha?.manual || linha.quantidade === 1) ? 'valor' : 'cotas',
  )
  const [nome, setNome] = useState(linha?.manual ? linha.ativo : '')
  const [quantidade, setQuantidade] = useState(linha?.manual ? numero(linha.quantidade) : '')
  const [preco, setPreco] = useState(numero(linha?.precoMedio ?? null))
  const [valorAtual, setValorAtual] = useState(linha?.manual ? numero(linha.valorAtual) : '')
  const [vencimento, setVencimento] = useState(linha?.vencimentoManual ?? '')
  const [taxa, setTaxa] = useState(linha?.taxaManual ?? '')
  const [classe, setClasse] = useState<ClasseCarteira | ''>(ehManual ? (linha?.classeManual ?? (ehNovo ? (tipoInicial?.classe ?? '') : '')) : (classeEscolhida ?? ''))
  const [escolheuClasse, setEscolheuClasse] = useState(!ehNovo || (tipoInicial?.classe ?? null) !== null)
  const buscaTipo = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState(false)

  useEffect(() => {
    ;(etapa === 'tipo' ? buscaTipo.current : primeiro.current)?.focus()
    const fecharComEsc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', fecharComEsc)
    return () => document.removeEventListener('keydown', fecharComEsc)
  }, [onFechar]) // eslint-disable-line react-hooks/exhaustive-deps

  function mudarNome(texto: string) {
    setNome(texto)
    // Num ativo novo, sugere a classe pelo nome enquanto a pessoa ainda não escolheu uma.
    if (ehNovo && !escolheuClasse) setClasse(acoes.sugerirClasse(texto) ?? '')
  }

  function escolherTipo(t: TipoInvestimento) {
    setTipo(t)
    setModo(t.modo)
    setClasse(t.classe ?? '')
    setEscolheuClasse(t.classe !== null)
    setErro(null)
    setEtapa('dados')
    setTimeout(() => primeiro.current?.focus(), 0)
  }

  function trocarModo(novo: ModoLancamento) {
    if (novo === modo) return
    const q = lerNumero(quantidade)
    const p = lerNumero(preco)
    if (novo === 'valor' && q !== null && p !== null) setPreco(numero(q * p))
    if (novo === 'cotas') setQuantidade('')
    setModo(novo)
    setErro(null)
  }

  function salvar() {
    if (etapa === 'tipo') return
    if (ehManual) {
      const q = modo === 'valor' ? 1 : lerNumero(quantidade)
      const p = lerNumero(preco)
      const v = valorAtual.trim() ? lerNumero(valorAtual) : null
      if (!classe) return setErro('Escolha a classe do ativo.')
      if (q === null || p === null || (valorAtual.trim() && v === null)) return setErro('Confira os números: use só dígitos e vírgula.')
      const msg = acoes.onSalvarManual({ nome: nome.trim(), quantidade: q, precoMedio: p, valorAtual: v, classe, ...(tipo ? { tipo: tipo.id } : {}), ...(tipo?.vencimento && vencimento ? { vencimento } : {}), ...(tipo?.taxaExemplo && taxa.trim() ? { taxa: taxa.trim() } : {}) }, linha?.manual ? linha.ativo : undefined)
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

  const titulo = ehNovo ? (grupo ? `Adicionar ativo em ${grupo.rotulo}` : 'Adicionar posição') : `Editar ${linha!.ativo}`

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
        {etapa === 'tipo' ? (
          <>
            <SeletorTipo tipos={opcoesDeTipo} consulta={consulta} onConsulta={setConsulta} onEscolher={escolherTipo} campo={buscaTipo} />
            <div className="mc-acoes">
              <button type="button" className="btn btn-ghost mc-btn" onClick={onFechar}>Cancelar</button>
            </div>
          </>
        ) : (
          <>
        {!ehNovo && !ehManual && (
          <p className="mc-texto">{linha!.categoria ? 'Ativo da sua Posição na B3.' : 'Compra recente, ainda não liquidada.'}</p>
        )}
        {ehManual && tipo && (
          <div className="mc-tipo-escolhido">
            <span>
              <strong>{tipo.rotulo}</strong>
              <small>{tipo.descricao}</small>
            </span>
            {ehNovo && opcoesDeTipo.length > 1 && (
              <button type="button" className="btn btn-ghost mc-btn" onClick={() => setEtapa('tipo')}>
                Trocar tipo
              </button>
            )}
          </div>
        )}
        {ehManual && <p className="mc-texto">Informe a sua posição, não uma compra. Serve para o que não vem nos extratos da B3.</p>}
        {ehManual && tipo && (
          <div className="mc-modos" role="group" aria-label="Como informar">
            <button type="button" className="mc-modo" aria-pressed={modo === 'valor'} onClick={() => trocarModo('valor')}>
              Pelo valor
            </button>
            <button type="button" className="mc-modo" aria-pressed={modo === 'cotas'} onClick={() => trocarModo('cotas')}>
              Por quantidade e preço
            </button>
          </div>
        )}

        <div className="mc-form-grade">
          {ehManual && (
            <label className="mc-campo-bloco mc-ocupa-linha" htmlFor={`${id}-nome`}>
              <span className="mc-rotulo-campo">Nome ou código do ativo</span>
              <input id={`${id}-nome`} ref={primeiro} className="mc-campo" placeholder={tipo?.exemplo ?? 'PETR4, CDB Banco X...'} value={nome} onChange={(e) => mudarNome(e.target.value)} />
            </label>
          )}
          {ehManual && modo === 'cotas' && (
            <label className="mc-campo-bloco" htmlFor={`${id}-qtd`}>
              <span className="mc-rotulo-campo">Quantidade</span>
              <input id={`${id}-qtd`} className="mc-campo" inputMode="decimal" placeholder="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </label>
          )}
          <label className="mc-campo-bloco" htmlFor={`${id}-pm`}>
            <span className="mc-rotulo-campo">{ehManual && modo === 'valor' ? 'Valor aplicado (R$)' : 'Preço médio (R$ por unidade)'}</span>
            <input id={`${id}-pm`} ref={ehManual ? undefined : primeiro} className="mc-campo" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </label>
          {ehManual && (
            <label className="mc-campo-bloco" htmlFor={`${id}-valor`}>
              <span className="mc-rotulo-campo">{modo === 'valor' ? 'Valor atual (R$, opcional)' : 'Valor atual total (R$, opcional)'}</span>
              <input id={`${id}-valor`} className="mc-campo" inputMode="decimal" placeholder="Sem informar, usa o custo" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
            </label>
          )}
          {ehManual && tipo?.vencimento && (
            <label className="mc-campo-bloco" htmlFor={`${id}-venc`}>
              <span className="mc-rotulo-campo">Vencimento (opcional)</span>
              <input id={`${id}-venc`} type="date" className="mc-campo mc-campo-data" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </label>
          )}
          {ehManual && tipo?.taxaExemplo && (
            <label className="mc-campo-bloco" htmlFor={`${id}-taxa`}>
              <span className="mc-rotulo-campo">Taxa (opcional)</span>
              <input id={`${id}-taxa`} className="mc-campo" maxLength={TAXA_MAX} placeholder={`Ex.: ${tipo.taxaExemplo}`} value={taxa} onChange={(e) => setTaxa(e.target.value)} />
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
                <option key={c} value={c}>{c === 'foraDaRegua' && tipo?.distribuicao ? 'Repartida entre FIIs, Ouro, BDRs e Fundos internacionais' : ROTULO_CLASSE[c]}</option>
              ))}
            </select>
          </label>
        </div>
        {ehManual && tipo?.classe && classe === tipo.classe && (
          <div className="mc-nota mc-equiv">
            {tipo.equivalencia
              ? `Na comparação com a carteira sugerida: ${tipo.equivalencia}`
              : tipo.classe === 'foraDaRegua'
                ? tipo.grupo === 'previdencia'
                  ? 'Previdência é um invólucro fiscal, não uma classe. Se você sabe o que há dentro do plano (renda fixa, ações...), escolha a classe correspondente; sem isso, ele fica fora da comparação.'
                  : 'Este tipo fica fora da comparação, porque a carteira sugerida não tem uma classe parecida. Se preferir, escolha a mais próxima.'
                : 'Classe sugerida pelo tipo escolhido. É ela que define como o ativo entra na comparação com a carteira sugerida.'}
          </div>
        )}
        {ehManual && tipo?.classe && classe !== tipo.classe && classe !== '' && (
          <div className="mc-nota">Você trocou a classe sugerida pelo tipo: vale a que você escolheu.</div>
        )}
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
          {!ehNovo &&
            (removendo ? (
              <>
                <span className="mc-nota">
                  {ehManual ? 'Excluir este ativo?' : 'Tirar da sua carteira? Seus lançamentos e proventos continuam no histórico.'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary mc-btn mc-perigo"
                  onClick={() => {
                    if (ehManual) acoes.onRemoverManual(linha!.ativo)
                    else acoes.onExcluirAtivo(linha!.ativo)
                    onFechar()
                  }}
                >
                  Sim, excluir
                </button>
                <button type="button" className="btn btn-ghost mc-btn" onClick={() => setRemovendo(false)}>Não</button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost mc-btn mc-perigo" onClick={() => setRemovendo(true)}>Excluir ativo</button>
            ))}
        </div>
          </>
        )}
      </form>
    </div>
  )
}

/** Passo 1 de "Adicionar posição": a lista de tipos de investimento do mercado, agrupada, com busca. */
function SeletorTipo({
  tipos,
  consulta,
  onConsulta,
  onEscolher,
  campo,
}: {
  tipos: TipoInvestimento[]
  consulta: string
  onConsulta: (c: string) => void
  onEscolher: (t: TipoInvestimento) => void
  campo: React.RefObject<HTMLInputElement | null>
}) {
  const lista = buscarTipos(consulta, tipos)
  return (
    <>
      <p className="mc-texto">Que tipo de investimento você quer incluir? Escolha na lista e, depois, informe quanto você tem.</p>
      <input
        ref={campo}
        type="search"
        className="mc-campo"
        aria-label="Buscar tipo de investimento"
        placeholder="Buscar: CDB, CRI, fundo, previdência..."
        value={consulta}
        onChange={(e) => onConsulta(e.target.value)}
      />
      {lista.length === 0 && (
        <p className="mc-nota">
          Nenhum tipo com esse nome.{' '}
          {tipos.some((t) => t.id === 'outro') && (
            <>
              Se o seu investimento não está na lista, use{' '}
              <button type="button" className="mc-link-linha" onClick={() => onEscolher(tipoPorId('outro')!)}>Outro investimento</button>.
            </>
          )}
        </p>
      )}
      {GRUPOS_TIPO.map((g) => {
        const itens = lista.filter((t) => t.grupo === g.id)
        if (!itens.length) return null
        return (
          <section key={g.id} className="mc-tipos-grupo" aria-label={g.rotulo}>
            <h3 className="mc-tipos-titulo">{g.rotulo}</h3>
            <ul className="mc-tipos">
              {itens.map((t) => (
                <li key={t.id}>
                  <button type="button" className="mc-tipo" onClick={() => onEscolher(t)}>
                    <strong>{t.rotulo}</strong>
                    <small>{t.descricao}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
