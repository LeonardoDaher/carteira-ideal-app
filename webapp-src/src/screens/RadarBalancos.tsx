import { useState } from 'react'
import { divulgadosRecentes, pendentes, reaisCompactos } from '../domain/balancos'
import type { ItemRadar } from '../domain/balancos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'

type Visao = 'vao' | 'ja'

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

function textoPrazo(i: ItemRadar): string {
  const d = i.diasParaEstimativa ?? 0
  if (i.situacao === 'aguardando') return i.foraDoPrazo ? 'fora do prazo' : 'atrasado'
  if (d === 0) return 'hoje'
  return `em ${d} ${d === 1 ? 'dia' : 'dias'}`
}

function LinhaPendente({ i, aoAnalisar }: { i: ItemRadar; aoAnalisar: (t: string) => void }) {
  const p = i.proxima!
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} data-testid="balanco-pendente">
      <Cabecalho i={i} />
      <div className="col" style={{ gap: 1, alignItems: 'flex-end', textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.rotulo} · {formatarData(p.estimativa)}</span>
        <span className="tiny muted">
          {textoPrazo(i)}
          {' · '}
          <button type="button" className="chip" style={{ padding: '1px 8px' }} onClick={() => aoAnalisar(i.ticker)}>analisar</button>
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
  const atrasadas = vao.filter((i) => i.situacao === 'aguardando').length
  const lista = [...vao.filter((i) => i.situacao === 'vai-divulgar'), ...vao.filter((i) => i.situacao === 'aguardando')]

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
        <section className="card col" style={{ gap: 10 }} aria-label="Vão divulgar">
          <span className="tiny muted">
            {vao.length} {vao.length === 1 ? 'empresa deve divulgar' : 'empresas devem divulgar'} · pela data estimada, das próximas às mais distantes
            {atrasadas > 0 ? ` · ${atrasadas} no fim da lista passaram da data usual e ainda não constam na CVM` : ''}
          </span>
          {vao.length === 0 ? (
            <span className="muted small" role="status">Nenhuma empresa {busca ? 'para essa busca ' : ''}aguardando divulgação.</span>
          ) : (
            lista.map((i) => <LinhaPendente key={i.ticker} i={i} aoAnalisar={aoAnalisar} />)
          )}
        </section>
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
