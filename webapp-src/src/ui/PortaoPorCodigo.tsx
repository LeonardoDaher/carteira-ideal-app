import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { storage } from '../data/storage'
import { CHAVE_CODIGO_TOP15, formatarCodigo, limparCodigoDigitado, mensagemDaFalha } from '../domain/acessoTop15'
import type { RespostaLista } from '../domain/acessoTop15'

/**
 * Portão do código do mês (D50), usado pelo Top 15 de ações e pelo Top 15 de FIIs (D65). Pede o código; ele
 * fica salvo neste aparelho, e quando vence o servidor o recusa e a tela volta a pedir. Nenhum dado da lista
 * existe no navegador antes de o código ser aceito. O mesmo código e a mesma chave de armazenamento valem
 * para as duas listas: quem já liberou uma abre a outra sem digitar de novo.
 */
export function PortaoPorCodigo<T>({
  titulo, oQueLibera, instagram, carregar, armazenamento, idDeTeste, renderizar,
}: {
  /** Ex.: "Top 15 mais baratas: acesso por código". */
  titulo: string
  /** Frase final do texto de apresentação: o que a pessoa passa a ver com o código. */
  oQueLibera: string
  instagram?: string | null
  carregar: (codigo: string) => Promise<RespostaLista<T>>
  armazenamento: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
  idDeTeste: string
  /** Desenha a lista liberada; `sair` apaga o código salvo e volta a pedir. */
  renderizar: (dados: T, sair: () => void) => ReactNode
}) {
  const [completo, setCompleto] = useState<T | null>(null)
  const [fase, setFase] = useState<'verificando-salvo' | 'livre' | 'carregando'>('verificando-salvo')
  const [aviso, setAviso] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const idCampo = useId()

  const tentar = async (valor: string, doSalvo: boolean) => {
    setFase(doSalvo ? 'verificando-salvo' : 'carregando')
    setAviso(null)
    const r = await carregar(valor)
    if (r.ok) {
      await armazenamento.setItem(CHAVE_CODIGO_TOP15, valor)
      setCompleto(r.snapshot)
      return
    }
    if (r.motivo === 'invalido') await armazenamento.removeItem(CHAVE_CODIGO_TOP15)
    setAviso(doSalvo && r.motivo === 'invalido' ? 'O código salvo neste aparelho venceu. Digite o código mais recente.' : mensagemDaFalha(r))
    setFase('livre')
  }

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const salvo = await armazenamento.getItem(CHAVE_CODIGO_TOP15)
      if (cancelado) return
      if (!salvo) return setFase('livre')
      const r = await carregar(salvo)
      if (cancelado) return
      if (r.ok) return setCompleto(r.snapshot)
      if (r.motivo === 'invalido') await armazenamento.removeItem(CHAVE_CODIGO_TOP15)
      setAviso(r.motivo === 'invalido' ? 'O código salvo neste aparelho venceu. Digite o código mais recente.' : mensagemDaFalha(r))
      setFase('livre')
    })()
    return () => {
      cancelado = true
    }
  }, [armazenamento, carregar])

  const sair = async () => {
    await armazenamento.removeItem(CHAVE_CODIGO_TOP15)
    setCompleto(null)
    setCodigo('')
    setFase('livre')
  }

  if (completo) return <>{renderizar(completo, () => void sair())}</>

  if (fase === 'verificando-salvo') {
    return <div className="card small muted" role="status">Verificando o código salvo neste aparelho…</div>
  }

  const pronto = limparCodigoDigitado(codigo).length >= 8 && fase !== 'carregando'
  return (
    <div className="card col" style={{ gap: 10 }} data-testid={idDeTeste}>
      <span style={{ fontWeight: 700 }}>{titulo}</span>
      <span className="muted small justify" style={{ lineHeight: 1.5 }}>
        A lista é liberada com o código do mês
        {instagram ? (
          <>
            , divulgado no Instagram{' '}
            <a href={`https://www.instagram.com/${instagram}/`} target="_blank" rel="noopener noreferrer">@{instagram}</a>
          </>
        ) : null}
        . {oQueLibera}
      </span>
      <form
        className="col"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault()
          if (pronto) void tentar(limparCodigoDigitado(codigo), false)
        }}
      >
        <label htmlFor={idCampo} className="small" style={{ fontWeight: 600 }}>Código do mês</label>
        <input
          id={idCampo}
          className="busca-fii"
          placeholder="CI-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={codigo}
          onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
        />
        <button type="submit" className="btn" disabled={!pronto}>
          {fase === 'carregando' ? 'Verificando…' : 'Ver a lista'}
        </button>
      </form>
      {aviso && <div className="card-outline small justify" role="alert">{aviso}</div>}
      <span className="tiny muted">O código fica salvo neste aparelho. Quando ele mudar, o app pede o novo.</span>
    </div>
  )
}
