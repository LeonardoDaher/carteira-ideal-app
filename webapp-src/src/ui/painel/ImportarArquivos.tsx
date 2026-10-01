import { useId, useRef, useState } from 'react'
import type { ArquivoImportado, ResumoArquivo } from '../../domain/carteiraSalva'
import { importarArquivo } from '../../domain/importacao/arquivo'
import { MODELO_CSV } from '../../domain/importacao/planilha'
import type { ResultadoImportacao } from '../../domain/importacao/planilha'

const NOMES_PERFIL: Record<string, string> = {
  'b3-movimentacao': 'Extrato de Movimentação',
  'b3-negociacao': 'Extrato de Negociação',
  'b3-proventos-recebidos': 'Proventos recebidos',
  'b3-proventos-a-receber': 'Proventos a receber',
  'b3-posicao': 'Posição',
  'b3-calendario': 'Calendário de proventos',
  generico: 'Planilha própria',
}

function lerBytes(arquivo: File): Promise<ArrayBuffer> {
  if (typeof arquivo.arrayBuffer === 'function') return arquivo.arrayBuffer()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(arquivo)
  })
}

function falhaGeral(msg: string): ResultadoImportacao {
  return { perfil: null, lancamentos: [], avisos: [], erros: [], linhasLidas: 0, erroGeral: msg }
}

async function lerArquivo(arquivo: File): Promise<ResultadoImportacao> {
  if (/\.pdf$/i.test(arquivo.name)) {
    return falhaGeral('Notas de corretagem em PDF ainda não são lidas aqui. Use os extratos da B3 (Negociação, Movimentação, Posição) em Excel ou CSV.')
  }
  try {
    return await importarArquivo(arquivo.name, await lerBytes(arquivo))
  } catch {
    return falhaGeral('Não foi possível ler este arquivo.')
  }
}

function descreverResumo(r: ResumoArquivo): string {
  const partes: string[] = []
  if (r.adicionados) partes.push(`${r.adicionados} lançamento(s) novo(s)`)
  if (r.repetidos) partes.push(`${r.repetidos} já existia(m)`)
  if (r.substituidos + r.cobertos) partes.push(`${r.substituidos + r.cobertos} substituído(s) por fonte mais precisa`)
  if (r.posicaoItens) partes.push(`posição com ${r.posicaoItens} ativo(s)`)
  if (r.eventosFuturos) partes.push(`${r.eventosFuturos} provento(s) a receber`)
  return partes.length ? partes.join(' · ') : 'nada novo para importar'
}

export const MODELO_CSV_URL = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${MODELO_CSV}`)}`

export function ImportarArquivos({ onImportar }: { onImportar: (arquivos: ArquivoImportado[]) => ResumoArquivo[] }) {
  const idEntrada = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [resumos, setResumos] = useState<ResumoArquivo[]>([])

  async function processar(lista: FileList | File[] | null) {
    const arquivos = lista ? Array.from(lista) : []
    if (!arquivos.length) return
    setLendo(true)
    const lidos: ArquivoImportado[] = []
    for (const a of arquivos) lidos.push({ nome: a.name, resultado: await lerArquivo(a) })
    setResumos(onImportar(lidos))
    setLendo(false)
    if (entrada.current) entrada.current.value = ''
  }

  return (
    <section className="mc-card mc-importar" aria-labelledby={`${idEntrada}-t`}>
      <h2 id={`${idEntrada}-t`} className="mc-titulo-grande">Traga os seus dados da B3</h2>

      <ol className="mc-passos">
        <li className="mc-passo">
          <span className="mc-num" aria-hidden="true">1</span>
          <div className="mc-passo-corpo">
            <div className="mc-passo-titulo">Baixe na B3</div>
            <p className="mc-passo-texto">
              Na Área do Investidor, em <strong>Extratos</strong>, baixe <strong>Posição</strong> (o que você tem hoje) e <strong>Negociação</strong> (suas compras e vendas), em Excel.
            </p>
            <a className="mc-link" href="https://www.investidor.b3.com.br" target="_blank" rel="noopener noreferrer">
              Abrir a Área do Investidor da B3 ↗
            </a>
          </div>
        </li>

        <li className="mc-passo">
          <span className="mc-num" aria-hidden="true">2</span>
          <div className="mc-passo-corpo">
            <div className="mc-passo-titulo">Envie aqui</div>
            <div
              className={`mc-soltar ${arrastando ? 'ativo' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault()
                setArrastando(false)
                void processar(e.dataTransfer.files)
              }}
            >
              <label htmlFor={idEntrada} className="btn btn-primary mc-btn">
                {lendo ? 'Lendo…' : 'Escolher arquivos'}
              </label>
              <input
                id={idEntrada}
                ref={entrada}
                type="file"
                multiple
                accept=".xlsx,.csv,.txt,.tsv"
                className="mc-arquivo"
                disabled={lendo}
                onChange={(e) => void processar(e.target.files)}
              />
              <span className="mc-dica">ou arraste para cá</span>
            </div>
          </div>
        </li>

        <li className="mc-passo">
          <span className="mc-num" aria-hidden="true">3</span>
          <div className="mc-passo-corpo">
            <div className="mc-passo-titulo">Pronto!</div>
            <p className="mc-passo-texto">Seu preço médio e seus gráficos aparecem logo abaixo.</p>
          </div>
        </li>
      </ol>

      <div className="mc-privacidade"><span aria-hidden="true">🔒</span> Seus dados ficam só neste aparelho.</div>

      <details className="mc-detalhes">
        <summary>Prefere usar a sua própria planilha?</summary>
        <p className="mc-passo-texto" style={{ marginTop: 8 }}>
          Baixe a planilha-modelo, preencha e envie no passo 2. Você também pode enviar vários arquivos de uma vez e escolher o período que quiser.
        </p>
        <a className="mc-link" href={MODELO_CSV_URL} download="modelo-minha-carteira.csv">
          Baixar planilha-modelo
        </a>
      </details>

      {resumos.length > 0 && (
        <ul className="mc-resumos" aria-label="Resultado da importação">
          {resumos.map((r) => (
            <li key={r.nome} className={r.erroGeral ? 'mc-resumo erro' : r.erros ? 'mc-resumo atencao' : 'mc-resumo ok'}>
              <div className="mc-resumo-nome">{r.nome}</div>
              {r.erroGeral ? (
                <div>{r.erroGeral}</div>
              ) : (
                <>
                  <div>
                    <strong>{r.perfil ? NOMES_PERFIL[r.perfil] : 'Arquivo'}</strong>: {descreverResumo(r)}
                    {r.erros > 0 && ` · ${r.erros} linha(s) não lida(s)`}
                  </div>
                  {r.avisos.length > 0 && (
                    <details>
                      <summary>{r.avisos.length} aviso(s)</summary>
                      <ul>
                        {r.avisos.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
