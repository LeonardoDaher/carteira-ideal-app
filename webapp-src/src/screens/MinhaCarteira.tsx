import { useId, useMemo, useRef, useState } from 'react'
import { capitalAplicadoPorMes, composicaoPorCategoria, montarPainel, proventosPorMes, proximosProventos } from '../domain/painelCarteira'
import type { AppCtx } from '../state/useAppState'
import { useCarteiraReal } from '../state/useCarteiraReal'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { CartaoComposicao, CartaoCarteira, CartaoProventos } from '../ui/painel/CartoesPainel'
import { CartaoConferencia } from '../ui/painel/CartaoConferencia'
import { CartaoLancamentos } from '../ui/painel/CartaoLancamentos'
import { CartaoPosicoes } from '../ui/painel/CartaoPosicoes'
import { ImportarArquivos } from '../ui/painel/ImportarArquivos'
import { VoltarInicio } from '../ui/VoltarInicio'

const dois = (n: number) => String(n).padStart(2, '0')
const isoDe = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

function baixarTexto(nome: string, texto: string, tipo: string) {
  const blob = typeof URL.createObjectURL === 'function' ? new Blob([texto], { type: tipo }) : null
  const a = document.createElement('a')
  a.href = blob ? URL.createObjectURL(blob) : `data:${tipo};charset=utf-8,${encodeURIComponent(texto)}`
  a.download = nome
  a.click()
  if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function lerTextoDoArquivo(arquivo: File): Promise<string> {
  if (typeof arquivo.text === 'function') return arquivo.text()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(arquivo)
  })
}

/**
 * Minha Carteira (D36): o painel de gestão da carteira REAL da pessoa. Ela importa os extratos da B3
 * (ou uma planilha própria), o app calcula o preço médio pelos lançamentos e mostra evolução,
 * proventos, composição e a conferência com a Posição. Tela avulsa, como o Meu Mês: abre por
 * `?tela=minhaCarteira`, não depende do questionário e guarda tudo só no aparelho.
 */
export function MinhaCarteira({ ctx, hoje }: { ctx: AppCtx; hoje?: Date }) {
  void ctx
  const agora = useRef(hoje ?? new Date()).current
  const hojeISO = isoDe(agora)
  const mesAtual = hojeISO.slice(0, 7)
  const idSeus = useId()
  const h = useCarteiraReal(hojeISO)
  const c = h.carteira
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [apagando, setApagando] = useState(false)

  const painel = useMemo(() => montarPainel(c.lancamentos, c.posicao, c.dataPosicao), [c.lancamentos, c.posicao, c.dataPosicao])
  const serieCapital = useMemo(() => capitalAplicadoPorMes(c.lancamentos, mesAtual, 12), [c.lancamentos, mesAtual])
  const serieProventos = useMemo(() => proventosPorMes(c.lancamentos, mesAtual, 12), [c.lancamentos, mesAtual])
  const fatias = useMemo(() => composicaoPorCategoria(c.posicao), [c.posicao])
  const proximos = useMemo(() => proximosProventos(c.eventosFuturos, hojeISO), [c.eventosFuturos, hojeISO])
  const temDados = c.lancamentos.length > 0 || !!c.posicao

  return (
    <div className="screen mc-tela">
      <VoltarInicio />
      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 22 }}>Minha carteira</h1>
        <div className="muted small justify">
          Acompanhe a carteira que você realmente tem. Importe os extratos da B3 e o app calcula o preço médio, mostra a evolução e confere se o histórico
          bate com a sua custódia. Seus dados ficam só neste aparelho.
        </div>
      </div>

      <ImportarArquivos onImportar={h.importarArquivos} />

      {h.hidratado && !temDados && (
        <section className="mc-card mc-vazio">
          <h2 className="mc-titulo">Comece pelo extrato de Posição</h2>
          <p className="mc-texto">
            Com a <strong>Posição</strong> o app já mostra o seu patrimônio e a composição. Com a <strong>Negociação</strong> e a <strong>Movimentação</strong>{' '}
            ele calcula o preço médio e os proventos. Se preferir, adicione um lançamento à mão logo abaixo.
          </p>
        </section>
      )}

      {h.hidratado && temDados && (
        <div className="mc-grade">
          <CartaoCarteira painel={painel} serie={serieCapital} />
          <CartaoProventos serie={serieProventos} proximos={proximos} />
          <CartaoComposicao fatias={fatias} />
          <CartaoConferencia carteira={c} onSaldoInicial={h.adicionar} onDataPosicao={h.definirDataPosicao} />
          <div className="mc-largo">
            <CartaoPosicoes linhas={painel.linhas} />
          </div>
        </div>
      )}

      {h.hidratado && (
        <CartaoLancamentos lancamentos={c.lancamentos} hoje={hojeISO} onAdicionar={h.adicionar} onCorrigir={h.corrigir} onExcluir={h.excluir} />
      )}

      {h.hidratado && (
        <section className="mc-card" aria-labelledby={`${idSeus}-t`}>
          <h2 id={`${idSeus}-t`} className="mc-titulo">Seus dados</h2>
          <p className="mc-texto">
            Tudo fica guardado neste aparelho. Se trocar de aparelho ou limpar o navegador, baixe um backup antes e restaure depois.
          </p>
          <div className="mc-acoes">
            <button type="button" className="btn btn-secondary mc-btn" onClick={() => baixarTexto('minha-carteira-backup.json', h.exportarBackup(), 'application/json')}>
              Baixar backup
            </button>
            <label className="btn btn-secondary mc-btn mc-rotulo-botao">
              Restaurar backup
              <input
                type="file"
                accept=".json,application/json"
                className="mc-arquivo"
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0]
                  if (!arquivo) return
                  const r = h.restaurarBackup(await lerTextoDoArquivo(arquivo))
                  setAviso(r.ok ? { tipo: 'ok', texto: 'Backup restaurado.' } : { tipo: 'erro', texto: r.erro ?? 'Não foi possível restaurar.' })
                  e.target.value = ''
                }}
              />
            </label>
            {apagando ? (
              <>
                <span className="mc-nota">Apagar todos os lançamentos e a Posição deste aparelho?</span>
                <button
                  type="button"
                  className="btn btn-secondary mc-btn mc-perigo"
                  onClick={() => {
                    h.limpar()
                    setApagando(false)
                    setAviso({ tipo: 'ok', texto: 'Dados apagados deste aparelho.' })
                  }}
                >
                  Sim, apagar tudo
                </button>
                <button type="button" className="btn btn-ghost mc-btn" onClick={() => setApagando(false)}>Cancelar</button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost mc-btn" onClick={() => setApagando(true)}>Apagar todos os dados</button>
            )}
          </div>
          {aviso && (
            <div className={aviso.tipo === 'ok' ? 'mc-ok' : 'mc-erro'} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
              {aviso.texto}
            </div>
          )}
        </section>
      )}

      <AvisoEducacional />
    </div>
  )
}
