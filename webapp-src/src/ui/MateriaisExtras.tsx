import { useEffect, useRef, useState } from 'react'
import { storage } from '../data/storage'
import { LockIcon, XIcon } from './Icon'

/* O botão "Educação Financeira Infantil", que ficava na landing, mora no fim da tela Aprender.
   O link do curso de Candlesticks (Udemy) foi retirado do site na D22: o projeto é gratuito e
   não divulga produto pago. A liberação do livro é por confiança (honor system):

   - Ao tocar no livro, abre um diálogo pedindo para seguir o Instagram. Quem toca em
     "Seguir" ou em "Já sigo o perfil" libera o download. NÃO há verificação (o Instagram
     não oferece isso) e o PDF continua público em /assets: é um convite, não uma proteção.
   - A liberação fica salva neste navegador com a MESMA chave usada pela landing
     (carteiraideal.livroLiberado), então quem já tinha liberado antes não precisa de novo. */

export const URL_INSTAGRAM = 'https://www.instagram.com/acarteiraideal/'
/** O app é publicado em /app/; o PDF fica em /assets/ da landing. */
export const URL_LIVRO_PDF = '../assets/livro-os-tres-potes-de-duda.pdf'
export const CHAVE_LIVRO_LIBERADO = 'carteiraideal.livroLiberado'
const NOME_ARQUIVO_LIVRO = 'Os-Tres-Potes-de-Duda.pdf'

export function MateriaisExtras() {
  const [liberado, setLiberado] = useState(false)
  const [status, setStatus] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const baixarRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let cancelado = false
    storage.getItem(CHAVE_LIVRO_LIBERADO).then((valor) => {
      if (!cancelado && valor === '1') setLiberado(true)
    })
    return () => {
      cancelado = true
    }
  }, [])

  function liberar(mensagem: string) {
    setLiberado(true)
    setStatus(mensagem)
    storage.setItem(CHAVE_LIVRO_LIBERADO, '1')
  }

  function abrir() {
    setStatus(liberado ? 'Livro liberado. Toque em baixar.' : 'Siga o perfil para liberar o download.')
    const dlg = dialogRef.current
    if (!dlg) return
    if (typeof dlg.showModal === 'function') dlg.showModal()
    else dlg.setAttribute('open', '')
  }

  function fechar() {
    const dlg = dialogRef.current
    if (!dlg) return
    if (typeof dlg.close === 'function') dlg.close()
    else dlg.removeAttribute('open')
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      {liberado ? (
        <a className="link-extra link-extra-2" href={URL_LIVRO_PDF} download={NOME_ARQUIVO_LIVRO}>
          <span className="link-extra-titulo">Educação Financeira Infantil</span>
          <span className="link-extra-sub">Livro liberado: toque para baixar</span>
        </a>
      ) : (
        <button type="button" className="link-extra link-extra-2" aria-haspopup="dialog" onClick={abrir}>
          <span className="link-extra-titulo">
            <span aria-hidden="true" style={{ display: 'inline-flex' }}>
              <LockIcon size={16} />
            </span>
            Educação Financeira Infantil
          </span>
          <span className="link-extra-sub">Livro grátis em PDF para quem segue no Instagram</span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="livro-dialog"
        aria-labelledby="livro-titulo"
        aria-describedby="livro-desc"
        onClick={(ev) => {
          // Clique fora da caixa (no fundo escurecido) fecha o diálogo
          if (ev.target === ev.currentTarget) fechar()
        }}
      >
        <div className="livro-dialog-corpo">
          <button type="button" className="livro-dialog-fechar" aria-label="Fechar" onClick={fechar}>
            <span aria-hidden="true" style={{ display: 'inline-flex' }}>
              <XIcon size={20} />
            </span>
          </button>
          <h2 id="livro-titulo" className="livro-dialog-titulo">Livro grátis: Os Três Potes de Duda</h2>
          <p id="livro-desc" className="livro-dialog-desc">
            Educação financeira para crianças, em PDF com 54 páginas. É um presente para quem acompanha o Carteira
            Ideal: siga o perfil no Instagram para liberar o download.
          </p>
          <div className="col" style={{ gap: 12, marginTop: 20 }}>
            <a
              className={`btn ${liberado ? 'btn-secondary' : 'btn-primary'}`}
              href={URL_INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => liberar('Perfil aberto em outra aba. Depois de seguir, volte aqui e baixe o livro.')}
            >
              Seguir @acarteiraideal no Instagram
            </a>
            <a
              ref={baixarRef}
              className={`btn ${liberado ? 'btn-primary' : 'btn-secondary is-locked'}`}
              href={liberado ? URL_LIVRO_PDF : undefined}
              download={liberado ? NOME_ARQUIVO_LIVRO : undefined}
              aria-disabled={liberado ? undefined : 'true'}
              onClick={(ev) => {
                if (!liberado) ev.preventDefault()
              }}
            >
              Baixar o livro (PDF)
            </a>
            {!liberado && (
              <button
                type="button"
                className="livro-dialog-ja-sigo"
                onClick={() => {
                  liberar('Obrigado por acompanhar! Livro liberado.')
                  // o botão de baixar só ganha endereço depois do novo render
                  setTimeout(() => baixarRef.current?.focus(), 0)
                }}
              >
                Já sigo o perfil
              </button>
            )}
          </div>
          <p className="livro-dialog-status" role="status" aria-live="polite">
            {status}
          </p>
          <p className="livro-dialog-nota">
            A liberação é por confiança: não verificamos se você segue. Seguir ajuda o projeto a continuar publicando
            conteúdo gratuito.
          </p>
        </div>
      </dialog>
    </div>
  )
}
