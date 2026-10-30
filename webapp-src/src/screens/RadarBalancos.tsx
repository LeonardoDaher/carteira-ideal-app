import { useState } from 'react'
import { divulgadosRecentes, pendentes, reaisCompactos } from '../domain/balancos'
import type { ItemRadar } from '../domain/balancos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'

type Visao = 'vao' | 'ja'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const rotuloDoMes = (data: string) => `${MESES[Number(data.slice(5, 7)) - 1]} de ${data.slice(0, 4)}`

const casaBusca = (i: ItemRadar, busca: string) => {
  const b = busca.trim().toLowerCase()
  return !b || i.ticker.toLowerCase().includes(b) || (i.nome ?? '').toLowerCase().includes(b)
}

function Cabecalho({ i }: { i: ItemRadar }) {
  return (
    <>
      <LogoAtivo ticker={i.ticker} />
      <div className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 700 }}>
          {i.ticker} <span className="muted small" style={{ fontWeight: 400 }}>{i.nome}</span>
        </span>
        {i.setor && <span className="tiny muted">{i.setor}</span>}
      </div>
    </>
  )
}

function LinhaPendente({ i, aoAnalisar }: { i: ItemRadar; aoAnalisar: (t: string) => void }) {
  const p = i.proxima!
  const atrasada = i.situacao === 'aguardando'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="balanco-pendente">
      <Cabecalho i={i} />
      <div className="col" style={{ gap: 1, alignItems: 'flex-end', textAlign: 'right' }}>
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.rotulo} · {formatarData(p.estimativa)}</span>
        <span className="tiny muted">
          {atrasada
            ? i.foraDoPrazo ? 'prazo legal vencido, não consta na CVM' : 'passou da data usual, ainda não consta'
            : p.base === 'historico' ? `estimativa pelos últimos ${p.anosNaBase} ${p.anosNaBase === 1 ? 'ano' : 'anos'}` : 'estimativa pelo prazo legal'}
          {' · '}
          <button type="button" className="chip" style={{ padding: '1px 8px' }} onClick={() => aoAnalisar(i.ticker)}>último balanço</button>
        </span>
      </div>
    </div>
  )
}

function LinhaDivulgada({ i, aoAnalisar }: { i: ItemRadar; aoAnalisar: (t: string) => void }) {
  const lucro = i.ultimo.lucroControladores ?? i.ultimo.lucroLiquido
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="balanco-divulgado">
      <Cabecalho i={i} />
      <div className="col" style={{ gap: 1, alignItems: 'flex-end', textAlign: 'right' }}>
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{i.ultimo.rotulo} · {i.ultimo.dtReceb ? `${i.ultimo.dataAproximada ? 'até ' : ''}${formatarData(i.ultimo.dtReceb)}` : 'sem data'}</span>
        <span className="tiny muted">
          {lucro != null ? `${lucro < 0 ? 'prejuízo' : 'lucro'} ${reaisCompactos(Math.abs(lucro))}` : 'sem lucro informado'}
          {' · '}
          <button type="button" className="chip" style={{ padding: '1px 8px' }} onClick={() => aoAnalisar(i.ticker)}>analisar</button>
        </span>
      </div>
    </div>
  )
}

/**
 * Radar de balanços: quando cada empresa do cadastro deve divulgar o próximo balanço (data ESTIMADA pelo histórico da própria
 * empresa, com o prazo legal da CVM como teto) e quem acabou de divulgar. A B3 não publica o calendário em dado aberto.
 */
export function RadarBalancos({ itens, hoje, dataCorte, aoAnalisar }: { itens: ItemRadar[]; hoje: string; dataCorte: string; aoAnalisar: (ticker: string) => void }) {
  const [visao, setVisao] = useState<Visao>('vao')
  const [busca, setBusca] = useState('')
  const vao = pendentes(itens).filter((i) => casaBusca(i, busca))
  const ja = divulgadosRecentes(itens, hoje).filter((i) => casaBusca(i, busca))
  const atrasadas = vao.filter((i) => i.situacao === 'aguardando')
  const proximas = vao.filter((i) => i.situacao === 'vai-divulgar')
  const porMes = new Map<string, ItemRadar[]>()
  for (const i of proximas) {
    const m = i.proxima!.estimativa.slice(0, 7)
    porMes.set(m, [...(porMes.get(m) ?? []), i])
  }

  return (
    <div className="col" style={{ gap: 14 }} data-testid="radar-balancos">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Radar de balanços</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Quando cada empresa deve divulgar o balanço do próximo trimestre. A data é uma <strong>estimativa</strong>: usa os dias que a própria empresa levou
          para divulgar o mesmo trimestre nos últimos anos. O prazo legal da CVM é de 45 dias após o fim do trimestre (3 meses no caso do balanço anual).
          A empresa pode confirmar outra data.
        </div>
        <div className="tiny muted" data-testid="radar-balancos-resumo">
          {itens.length} empresas · balanços da CVM até {formatarData(dataCorte)}
        </div>
      </div>

      <div role="group" aria-label="Escolher a lista" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className={`chip ${visao === 'vao' ? 'selected' : ''}`} aria-pressed={visao === 'vao'} onClick={() => setVisao('vao')}>
          Vão divulgar
        </button>
        <button type="button" className={`chip ${visao === 'ja' ? 'selected' : ''}`} aria-pressed={visao === 'ja'} onClick={() => setVisao('ja')}>
          Divulgaram há pouco
        </button>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar ativos (ex.: VALE3)"
        aria-label="Filtrar o radar por código ou nome"
        className="input-cotas"
      />

      {visao === 'vao' ? (
        <>
          {atrasadas.length > 0 && (
            <section className="card col" style={{ gap: 10 }} aria-label="Ainda não divulgaram" data-testid="balancos-atrasados">
              <h3 style={{ fontSize: 15 }}>Ainda não divulgaram</h3>
              <span className="tiny muted">Já passou da data que a empresa costuma usar e o balanço ainda não chegou à CVM.</span>
              {atrasadas.map((i) => <LinhaPendente key={i.ticker} i={i} aoAnalisar={aoAnalisar} />)}
            </section>
          )}
          {[...porMes.entries()].map(([mes, lista]) => (
            <section key={mes} className="card col" style={{ gap: 10 }} aria-label={rotuloDoMes(`${mes}-01`)}>
              <h3 style={{ fontSize: 15, textTransform: 'capitalize' }}>{rotuloDoMes(`${mes}-01`)}</h3>
              <span className="tiny muted">{lista.length} {lista.length === 1 ? 'empresa' : 'empresas'} · em ordem de data estimada</span>
              {lista.map((i) => <LinhaPendente key={i.ticker} i={i} aoAnalisar={aoAnalisar} />)}
            </section>
          ))}
          {vao.length === 0 && (
            <div className="card muted small" role="status">Nenhuma empresa {busca ? 'para essa busca ' : ''}aguardando divulgação.</div>
          )}
        </>
      ) : (
        <section className="card col" style={{ gap: 10 }} aria-label="Divulgaram há pouco">
          <span className="tiny muted">{ja.length} {ja.length === 1 ? 'empresa divulgou' : 'empresas divulgaram'} nos últimos 45 dias · do mais recente ao mais antigo</span>
          {ja.length === 0 ? <span className="muted small" role="status">Nenhuma divulgação recente {busca ? 'para essa busca' : ''}.</span> : ja.map((i) => <LinhaDivulgada key={i.ticker} i={i} aoAnalisar={aoAnalisar} />)}
        </section>
      )}

      <div className="tiny muted justify" role="note">
        Fonte: ITR e DFP entregues à CVM (data de recebimento). Datas futuras são estimativas, não um calendário oficial. Não é recomendação de investimento.
      </div>
    </div>
  )
}
