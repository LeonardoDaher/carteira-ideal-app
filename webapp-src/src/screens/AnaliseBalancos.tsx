import { useState } from 'react'
import { analisarBalanco, divulgadosRecentes, reaisCompactos } from '../domain/balancos'
import type { ItemRadar, LinhaComparativa, SnapshotBalancos, Tom as TomBalanco, Veredito } from '../domain/balancos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'
import { Selo } from '../ui/BlocosDeAnalise'
import type { Tom } from '../ui/BlocosDeAnalise'

const tomDoSelo = (t: TomBalanco): Tom => (t === 'bom' ? 'positivo' : t === 'ruim' ? 'negativo' : 'neutro')
const VEREDITO: Record<Veredito, { tom: Tom; texto: string }> = {
  forte: { tom: 'positivo', texto: 'Balanço forte' },
  misto: { tom: 'neutro', texto: 'Balanço misto' },
  fraco: { tom: 'negativo', texto: 'Balanço fraco' },
}

const formatarValor = (v: number | null, formato: LinhaComparativa['formato']) => {
  if (v == null) return '—'
  if (formato === 'reais') return reaisCompactos(v)
  if (formato === 'pct') return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`
}

const corDoTom = (t: TomBalanco) => (t === 'bom' ? 'var(--success)' : t === 'ruim' ? 'var(--danger)' : undefined)

function Tabela({ rotulos, linhas }: { rotulos: string[]; linhas: LinhaComparativa[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="small" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 120 + rotulos.length * 92 }} data-testid="balanco-tabela">
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left', padding: '4px 6px', position: 'sticky', left: 0, background: 'var(--surface)' }}>Conta</th>
            {rotulos.map((r) => <th key={r} scope="col" style={{ textAlign: 'right', padding: '4px 6px' }}>{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.chave} style={{ borderTop: '1px solid var(--border)' }}>
              <th scope="row" style={{ textAlign: 'left', padding: '6px', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--surface)' }}>{l.rotulo}</th>
              {l.valores.map((v, i) => <td key={rotulos[i]} style={{ textAlign: 'right', padding: '6px', whiteSpace: 'nowrap' }}>{formatarValor(v, l.formato)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Análise do balanço divulgado: compara o último trimestre com o anterior e com o mesmo trimestre do ano anterior e mostra os
 * últimos 8 trimestres. Não há "consenso de mercado" na base aberta: "acima" ou "abaixo" é sempre contra o histórico da própria empresa.
 */
export function AnaliseBalancos({ snapshot, itens, ticker, hoje, aoEscolher }: { snapshot: SnapshotBalancos; itens: ItemRadar[]; ticker: string | null; hoje: string; aoEscolher: (t: string | null) => void }) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const achadas = termo.length >= 2
    ? Object.values(snapshot.empresas).filter((e) => e.ticker.toLowerCase().includes(termo) || (e.nome ?? '').toLowerCase().includes(termo)).slice(0, 8)
    : []
  const recentes = divulgadosRecentes(itens, hoje).slice(0, 12)
  const empresa = ticker ? snapshot.empresas[ticker] : undefined
  const analise = empresa ? analisarBalanco(empresa) : null

  return (
    <div className="col" style={{ gap: 14 }} data-testid="analise-balancos">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Análise dos balanços</h2>
        <div className="muted small justify">
          Escolha uma empresa para ver o que ela reportou no último balanço, comparado ao trimestre anterior e ao mesmo trimestre do ano passado, mais os últimos 8 trimestres.
        </div>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <input
          type="search"
          className="busca-fii"
          placeholder="Código ou nome, ex.: VALE3 ou Itaú"
          aria-label="Buscar empresa para analisar o balanço"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={busca}
          onChange={(e) => setBusca(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && achadas[0]) {
              e.preventDefault()
              aoEscolher(achadas[0].ticker)
              setBusca('')
            }
          }}
        />
        {achadas.length > 0 && (
          <ul className="resultados-busca" aria-label="Empresas encontradas">
            {achadas.map((e) => (
              <li key={e.ticker}>
                <button className="resultado-busca" onClick={() => { aoEscolher(e.ticker); setBusca('') }}>
                  <span style={{ fontWeight: 700 }}>{e.ticker}</span>
                  <span className="tiny muted resultado-nome">{[e.nome, e.setor].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {termo.length >= 2 && achadas.length === 0 && <span className="muted small" role="status">Nenhuma empresa encontrada para “{busca.trim()}”.</span>}
      </div>

      {!analise && recentes.length > 0 && (
        <section className="card col" style={{ gap: 8 }} aria-label="Divulgaram há pouco">
          <span style={{ fontWeight: 700 }}>Divulgaram há pouco</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recentes.map((i) => (
              <button key={i.ticker} type="button" className="chip" onClick={() => aoEscolher(i.ticker)}>{i.ticker}</button>
            ))}
          </div>
        </section>
      )}

      {ticker && !analise && (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Balanço indisponível para {ticker}</span>
          <span className="muted small justify">A empresa não está na base de balanços trimestrais (sem CNPJ na CVM ou sem demonstrações suficientes).</span>
        </div>
      )}

      {analise && (
        <>
          <section className="card col" style={{ gap: 10 }} data-testid="balanco-resumo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoAtivo ticker={analise.ticker} />
              <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{analise.ticker} <span className="muted small" style={{ fontWeight: 400 }}>{analise.nome}</span></span>
                <span className="tiny muted">
                  {analise.ultimo.rotulo} · {analise.ultimo.tipo === 'DFP' ? 'balanço anual (4º trimestre = ano − 9 meses)' : 'ITR'}
                  {analise.ultimo.dtReceb ? ` · divulgado ${analise.ultimo.dataAproximada ? 'até' : 'em'} ${formatarData(analise.ultimo.dtReceb)}` : ''} · {analise.ultimo.consolidacao}
                </span>
              </div>
              <Selo tom={VEREDITO[analise.veredito].tom}>{VEREDITO[analise.veredito].texto}</Selo>
            </div>
            <span className="small justify" style={{ lineHeight: 1.5 }}>{analise.resumo}</span>
            {analise.ultimo.provisorio && (
              <span className="tiny muted justify" role="note" data-testid="balanco-provisorio">
                Balanço recém-divulgado, lido do resumo da B3. O EBIT, o caixa e a dívida entram quando a CVM publicar os dados completos (em geral em alguns dias).
              </span>
            )}
          </section>

          <section className="card col" style={{ gap: 10 }} aria-label="O que a empresa reportou" data-testid="balanco-destaques">
            <h3 style={{ fontSize: 15 }}>O que a empresa reportou</h3>
            {analise.destaques.map((d) => (
              <div key={d.titulo} className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                  <span aria-hidden="true" style={{ color: corDoTom(d.tom) }}>● </span>
                  {d.titulo} <Selo tom={tomDoSelo(d.tom)}>{d.tom === 'bom' ? 'ponto positivo' : d.tom === 'ruim' ? 'ponto de atenção' : 'neutro'}</Selo>
                </span>
                <span className="small muted justify" style={{ lineHeight: 1.5 }}>{d.texto}</span>
              </div>
            ))}
          </section>

          <section className="card col" style={{ gap: 10 }} aria-label="Sinais de alerta" data-testid="balanco-alertas">
            <h3 style={{ fontSize: 15 }}>Sinais de alerta</h3>
            {analise.alertas.length === 0 ? (
              <span className="small muted justify" role="status">Nenhum sinal de alerta nos dados do balanço (lucro, margem, patrimônio e endividamento). O fluxo de caixa ainda não entra nesta leitura.</span>
            ) : (
              analise.alertas.map((al) => (
                <div key={al.id} className="col" style={{ gap: 2 }} data-testid="balanco-alerta">
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {al.titulo} <Selo tom={al.gravidade === 'critico' ? 'negativo' : 'neutro'}>{al.gravidade === 'critico' ? 'crítico' : 'atenção'}</Selo>
                  </span>
                  <span className="small muted justify" style={{ lineHeight: 1.5 }}>{al.detalhe}</span>
                </div>
              ))
            )}
            <span className="tiny muted justify">Os alertas olham só o que o balanço mostra e não consideram o contexto: uma empresa investindo pesado ou com baixa contábil pontual pode disparar um alerta sem que o negócio tenha piorado.</span>
          </section>

          <section className="card col" style={{ gap: 10 }} aria-label="Comparação dos últimos trimestres">
            <h3 style={{ fontSize: 15 }}>Últimos {analise.trimestres.length} trimestres</h3>
            <Tabela rotulos={analise.trimestres.map((t) => t.rotulo)} linhas={analise.linhas} />
            <div className="col" style={{ gap: 4 }}>
              {analise.linhas.filter((l) => ['receita', 'lucro'].includes(l.chave)).map((l) => (
                <span key={l.chave} className="tiny muted">
                  {l.rotulo}: <strong style={{ color: corDoTom(l.contraAnterior.tom) }}>{l.contraAnterior.texto}</strong> contra o trimestre anterior,{' '}
                  <strong style={{ color: corDoTom(l.contraAnoAnterior.tom) }}>{l.contraAnoAnterior.texto}</strong> contra o mesmo trimestre do ano anterior.
                </span>
              ))}
            </div>
          </section>

          <div className="tiny muted justify" role="note">
            Fonte: ITR e DFP entregues à CVM{analise.ultimo.link ? <> (<a href={analise.ultimo.link} target="_blank" rel="noopener noreferrer">documento do último balanço</a>)</> : ''}. Valores em reais, do
            trimestre isolado. O 4º trimestre é o exercício menos os 9 meses informados antes e pode incluir ajustes contábeis pontuais. “Abaixo do esperado” aqui significa abaixo do
            próprio histórico da empresa: a base aberta não traz a projeção dos analistas. Não é recomendação de investimento.
          </div>
        </>
      )}
    </div>
  )
}
