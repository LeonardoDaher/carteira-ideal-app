import { useId, useMemo, useState } from 'react'
import { DARF_MINIMO, apuracaoParaCsv, LIMITE_ISENCAO_ACOES } from '../../domain/impostoRenda'
import type { ApuracaoIR, MesIR } from '../../domain/impostoRenda'
import { dataCurta, mesPorExtensoDe } from './formatar'
import { useValores } from './valoresOcultos'

const LINHAS_RESULTADO: { campo: keyof MesIR['resultados']; rotulo: string }[] = [
  { campo: 'acoes', rotulo: 'Ações' },
  { campo: 'fiis', rotulo: 'Fundos imobiliários' },
  { campo: 'etfs', rotulo: 'ETFs' },
  { campo: 'bdrs', rotulo: 'BDRs' },
  { campo: 'daytrade', rotulo: 'Day trade' },
]

function baixarCsv(nome: string, texto: string) {
  const a = document.createElement('a')
  const blob = typeof URL.createObjectURL === 'function' ? new Blob([texto], { type: 'text/csv;charset=utf-8' }) : null
  a.href = blob ? URL.createObjectURL(blob) : `data:text/csv;charset=utf-8,${encodeURIComponent(texto)}`
  a.download = nome
  a.click()
  if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function Mes({ m }: { m: MesIR }) {
  const { reais } = useValores()
  const uso = Math.min(1, m.vendasAcoes / LIMITE_ISENCAO_ACOES)
  const situacao = m.darf !== null ? `DARF ${reais(m.darf)}` : m.represado > 0 ? 'Imposto abaixo de R$ 10: soma ao próximo mês' : m.dentroDaIsencao ? 'Isento' : 'Sem imposto'
  return (
    <li className="mc-pendente">
      <div className="mc-pendente-topo">
        <strong>{mesPorExtensoDe(m.mes)}</strong>
        <span className="mc-selo">{situacao}</span>
      </div>
      {m.vendasAcoes > 0 && (
        <>
          <div className="mc-nota">
            Vendas de ações: {reais(m.vendasAcoes)} de {reais(LIMITE_ISENCAO_ACOES)}
            {m.vendasAcoes > LIMITE_ISENCAO_ACOES ? ' (limite ultrapassado: o lucro de ações é tributado)' : ` (faltam ${reais(LIMITE_ISENCAO_ACOES - m.vendasAcoes)} para perder a isenção)`}
          </div>
          <div className="mc-barra-progresso" role="img" aria-label={`Vendas de ações no mês: ${Math.round(uso * 100)}% do limite de isenção`}>
            <span style={{ width: `${uso * 100}%` }} />
          </div>
        </>
      )}
      <details className="mc-detalhes">
        <summary>Ver a conta</summary>
        <ul className="mc-nota" style={{ marginTop: 6, paddingLeft: 18 }}>
          {LINHAS_RESULTADO.filter((l) => Math.abs(m.resultados[l.campo]) > 0.004).map((l) => (
            <li key={l.campo}>
              {l.rotulo}: {m.resultados[l.campo] >= 0 ? 'lucro' : 'prejuízo'} de {reais(Math.abs(m.resultados[l.campo]))}
            </li>
          ))}
          {m.lucroIsento > 0 && <li>Lucro isento (vendas de ações até R$ 20 mil): {reais(m.lucroIsento)}</li>}
          {m.prejuizoCompensado > 0 && <li>Prejuízo de meses anteriores abatido: {reais(m.prejuizoCompensado)}</li>}
          <li>Imposto do mês: {reais(m.imposto)}</li>
          {m.darf !== null && m.vencimento && (
            <li>
              DARF código 6015: {reais(m.darf)}, até {dataCurta(m.vencimento)} (sem considerar feriados)
            </li>
          )}
        </ul>
      </details>
    </li>
  )
}

export function CartaoImpostoRenda({ apuracao }: { apuracao: ApuracaoIR }) {
  const idTitulo = useId()
  const { reais } = useValores()
  const anos = useMemo(() => [...new Set(apuracao.meses.map((m) => m.mes.slice(0, 4)))].sort().reverse(), [apuracao.meses])
  const [ano, setAno] = useState<string | null>(null)
  const anoVisivel = ano && anos.includes(ano) ? ano : anos[0]
  const meses = apuracao.meses.filter((m) => m.mes.startsWith(anoVisivel ?? '')).reverse()
  const { comum, fii, daytrade } = apuracao.prejuizoAcumulado
  const temPrejuizo = comum + fii + daytrade > 0.004

  return (
    <section className="mc-card" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="mc-titulo">Imposto de renda</h2>
      {meses.length === 0 ? (
        <p className="mc-texto">
          Quando você tiver vendas de ações, FIIs, ETFs ou BDRs nos lançamentos, o app mostra aqui mês a mês se você está dentro da isenção de R$ 20 mil e quanto de DARF pagar.
        </p>
      ) : (
        <>
          <p className="mc-texto">
            Calculado pelos seus lançamentos: lucro de cada venda contra o preço médio, isenção de ações até R$ 20 mil vendidos no mês, compensação de prejuízos e DARF (mínimo de {reais(DARF_MINIMO)}).
          </p>
          {anos.length > 1 && (
            <div className="mc-form-linha">
              <label htmlFor={`${idTitulo}-ano`} className="mc-rotulo-campo">Ano</label>
              <select id={`${idTitulo}-ano`} className="mc-campo" value={anoVisivel} onChange={(e) => setAno(e.target.value)}>
                {anos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}
          <ul className="mc-pendentes">
            {meses.map((m) => (
              <Mes key={m.mes} m={m} />
            ))}
          </ul>
          <div className="mc-acoes">
            <button type="button" className="btn btn-secondary mc-btn" onClick={() => baixarCsv(`imposto-de-renda-${anoVisivel}.csv`, apuracaoParaCsv(apuracao.meses, anoVisivel ?? ''))}>
              Baixar planilha de {anoVisivel}
            </button>
          </div>
          {temPrejuizo && (
            <div className="mc-nota">
              Prejuízo a compensar em meses futuros:{' '}
              {[comum > 0.004 && `ações, ETFs e BDRs ${reais(comum)}`, fii > 0.004 && `FIIs ${reais(fii)}`, daytrade > 0.004 && `day trade ${reais(daytrade)}`].filter(Boolean).join(' · ')}.
            </div>
          )}
        </>
      )}
      {apuracao.historicoIncompleto.length > 0 && (
        <div className="mc-erro" role="alert">
          Faltam compras no histórico de {[...new Set(apuracao.historicoIncompleto.map((h) => h.ativo))].join(', ')}: vendeu mais do que os lançamentos mostram. O lucro desses ativos pode estar errado. Veja em Conferência com a Posição.
        </div>
      )}
      {apuracao.semCategoria.length > 0 && (
        <div className="mc-nota">
          Ficaram de fora porque não sabemos se são ação, FII ou ETF: {apuracao.semCategoria.join(', ')}. Escolha a classe do ativo em Posições.
        </div>
      )}
      <div className="mc-nota">
        Estimativa para conferência, não substitui a declaração. Não considera o IRRF retido, feriados no vencimento, cripto nem ativos do exterior.
      </div>
    </section>
  )
}
