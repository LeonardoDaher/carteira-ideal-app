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

export function ImportarArquivos({ onImportar, onLancarDireto }: { onImportar: (arquivos: ArquivoImportado[]) => ResumoArquivo[]; onLancarDireto: () => void }) {
  const idEntrada = useId()
  const idPlanilha = `${idEntrada}-planilha`
  const entrada = useRef<HTMLInputElement>(null)
  const entradaPlanilha = useRef<HTMLInputElement>(null)
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
    if (entradaPlanilha.current) entradaPlanilha.current.value = ''
  }

  const soltar = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    void processar(e.dataTransfer.files)
  }
  const arrastar = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(true)
  }

  return (
    <section className="mc-importar" aria-labelledby={`${idEntrada}-t`}>
      <h2 id={`${idEntrada}-t`} className="mc-titulo-grande">3 formas de trazer a sua carteira para o Carteira Ideal</h2>
      <p className="mc-sub">Escolha a que for mais fácil para você. As três levam ao mesmo resultado.</p>

      <ul className="mc-formas">
        <li className="mc-card mc-forma">
          <h3 className="mc-forma-titulo">Dados da B3</h3>
          <p className="mc-passo-texto">
            Na Área do Investidor, em <strong>Extratos</strong>, baixe <strong>Posição</strong> (o que você tem hoje) e <strong>Negociação</strong> (suas compras e vendas), em Excel. Depois envie aqui.
          </p>
          <a className="mc-link" href="https://www.investidor.b3.com.br" target="_blank" rel="noopener noreferrer">
            Abrir a Área do Investidor da B3 ↗
          </a>
          <div className={`mc-soltar ${arrastando ? 'ativo' : ''}`} onDragOver={arrastar} onDragLeave={() => setArrastando(false)} onDrop={soltar}>
            <label htmlFor={idEntrada} className="btn btn-primary mc-btn">
              {lendo ? 'Lendo…' : 'Enviar extratos da B3'}
            </label>
            <input id={idEntrada} ref={entrada} type="file" multiple accept=".xlsx,.csv,.txt,.tsv" className="mc-arquivo" disabled={lendo} onChange={(e) => void processar(e.target.files)} />
            <span className="mc-dica">ou arraste para cá</span>
          </div>
        </li>

        <li className="mc-card mc-forma">
          <h3 className="mc-forma-titulo">Sua própria planilha</h3>
          <p className="mc-passo-texto">
            Use o seu controle em <strong>Excel ou CSV</strong>. Se preferir, baixe a planilha-modelo, preencha e envie. Dá para enviar vários arquivos de uma vez.
          </p>
          <a className="mc-link" href={MODELO_CSV_URL} download="modelo-minha-carteira.csv">
            Baixar planilha-modelo
          </a>
          <div className={`mc-soltar ${arrastando ? 'ativo' : ''}`} onDragOver={arrastar} onDragLeave={() => setArrastando(false)} onDrop={soltar}>
            <label htmlFor={idPlanilha} className="btn btn-primary mc-btn">
              {lendo ? 'Lendo…' : 'Enviar minha planilha'}
            </label>
            <input id={idPlanilha} ref={entradaPlanilha} type="file" multiple accept=".xlsx,.csv,.txt,.tsv" className="mc-arquivo" disabled={lendo} onChange={(e) => void processar(e.target.files)} />
            <span className="mc-dica">ou arraste para cá</span>
          </div>
        </li>

        <li className="mc-card mc-forma">
          <h3 className="mc-forma-titulo">Lançamento direto</h3>
          <p className="mc-passo-texto">
            Registre você mesmo, <strong>um a um</strong>: compras, vendas e proventos. Indicado para poucos ativos ou para completar o que faltou.
          </p>
          <span className="mc-link-vazio" aria-hidden="true" />
          <div className="mc-soltar mc-soltar-simples">
            <button type="button" className="btn btn-primary mc-btn" onClick={onLancarDireto}>
              Lançar um a um
            </button>
          </div>
        </li>
      </ul>

      <div className="mc-privacidade"><span aria-hidden="true">🔒</span> Seus dados ficam só neste aparelho.</div>

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
