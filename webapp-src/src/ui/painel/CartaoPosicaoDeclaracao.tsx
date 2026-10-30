import { useId, useMemo, useState } from 'react'
import type { CategoriaIR } from '../../domain/impostoRenda'
import type { Lancamento } from '../../domain/lancamentos'
import { anosDosLancamentos, posicaoEm31Dez, posicaoParaCsv } from '../../domain/posicaoFimDeAno'
import { useValores } from './valoresOcultos'

function baixarCsv(nome: string, texto: string) {
  const a = document.createElement('a')
  const blob = typeof URL.createObjectURL === 'function' ? new Blob([texto], { type: 'text/csv;charset=utf-8' }) : null
  a.href = blob ? URL.createObjectURL(blob) : `data:text/csv;charset=utf-8,${encodeURIComponent(texto)}`
  a.download = nome
  a.click()
  if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

type Aba = CategoriaIR | 'outros'
const ABAS: { id: Aba; rotulo: string; arquivo: string }[] = [
  { id: 'acao', rotulo: 'Ações', arquivo: 'acoes' },
  { id: 'fii', rotulo: 'Fundos imobiliários', arquivo: 'fiis' },
  { id: 'etf', rotulo: 'ETFs', arquivo: 'etfs' },
  { id: 'bdr', rotulo: 'BDRs', arquivo: 'bdrs' },
  { id: 'outros', rotulo: 'Outros', arquivo: 'outros' },
]

/** Posição em 31/12 de cada ano (quantidade, preço médio e custo), para a ficha de Bens e Direitos da declaração. */
export function CartaoPosicaoDeclaracao({ lancamentos, hoje, categoriaDe }: { lancamentos: Lancamento[]; hoje: string; categoriaDe: (ativo: string) => CategoriaIR | null }) {
  const idTitulo = useId()
  const { reais, quantidade } = useValores()
  const anos = useMemo(() => anosDosLancamentos(lancamentos), [lancamentos])
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const ano = escolhido && anos.includes(escolhido) ? escolhido : (anos.find((a) => a < hoje.slice(0, 4)) ?? anos[0])
  const [aba, setAba] = useState<Aba | null>(null)
  const { linhas: todas, incompleto } = useMemo(() => (ano ? posicaoEm31Dez(lancamentos, ano, categoriaDe) : { linhas: [], incompleto: [] }), [lancamentos, ano, categoriaDe])
  if (!ano) return null
  const abas = ABAS.map((a) => ({ ...a, linhas: todas.filter((l) => (l.categoria ?? 'outros') === a.id) })).filter((a) => a.id !== 'outros' || a.linhas.length > 0)
  const atual = abas.find((a) => a.id === aba) ?? abas.find((a) => a.linhas.length > 0) ?? abas[0]
  const linhas = atual.linhas
  const total = linhas.reduce((s, l) => s + l.custoTotal, 0)

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Posição em 31/12 (declaração)</h2>
      <p className="mc-texto">O que você tinha no último dia do ano, com o preço médio de compra de cada ativo. É o valor de aquisição que vai em Bens e Direitos.</p>
      <div className="mc-form-linha">
        <label htmlFor={`${idTitulo}-ano`} className="mc-rotulo-campo">Ano</label>
        <select id={`${idTitulo}-ano`} className="mc-campo" value={ano} onChange={(e) => setEscolhido(e.target.value)}>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="mc-acoes" role="tablist" aria-label="Tipo de ativo">
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === atual.id} className={`btn mc-btn ${a.id === atual.id ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setAba(a.id)}>
            {a.rotulo} ({a.linhas.length})
          </button>
        ))}
      </div>
      {ano >= hoje.slice(0, 4) && <div className="mc-nota">O ano ainda não fechou: esta é a posição até hoje.</div>}
      {linhas.length === 0 ? (
        <p className="mc-texto">Nenhum ativo desse tipo em carteira em 31/12/{ano}.</p>
      ) : (
        <ul className="mc-pendentes">
          {linhas.map((l) => (
            <li key={l.ativo} className="mc-pendente">
              <div className="mc-pendente-topo">
                <strong>{l.ativo}</strong>
                <span className="mc-selo">{reais(l.custoTotal)}</span>
              </div>
              <div className="mc-nota">
                {quantidade(l.quantidade)} × preço médio {reais(l.precoMedio)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {linhas.length > 0 && <div className="mc-nota">Custo total de {atual.rotulo.toLowerCase()} em 31/12/{ano}: <strong>{reais(total)}</strong></div>}
      {incompleto.length > 0 && (
        <div className="mc-erro" role="alert">
          Faltam compras no histórico de {incompleto.join(', ')}: o preço médio desses ativos pode estar errado.
        </div>
      )}
      {linhas.length > 0 && (
        <div className="mc-acoes">
          <button type="button" className="btn btn-secondary mc-btn" onClick={() => baixarCsv(`posicao-31-12-${ano}-${atual.arquivo}.csv`, posicaoParaCsv(linhas, ano))}>
            Baixar planilha de {atual.rotulo.toLowerCase()} de {ano}
          </button>
        </div>
      )}
    </section>
  )
}
