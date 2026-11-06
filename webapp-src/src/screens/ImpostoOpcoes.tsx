import { useEffect, useMemo, useState } from 'react'
import { apurarMeses, ALIQUOTA, DARF_MINIMO, IRRF_DAYTRADE, IRRF_SWING } from '../domain/impostoOpcoes'
import type { CategoriaIr, OperacaoIr } from '../domain/impostoOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoReais } from '../ui/CampoReais'

const CHAVE = 'carteira-ideal:imposto-opcoes:v1'
const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))
const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (mes: string) => `${NOMES_MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

function ler(): OperacaoIr[] {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(bruto) ? bruto.filter((o) => o && typeof o.data === 'string' && Number.isFinite(o.resultado)) : []
  } catch {
    return []
  }
}

/**
 * Aba "Imposto": o usuário lança o resultado de cada operação encerrada com opções (ganho ou prejuízo) e o app apura mês a
 * mês o imposto de renda: 15% no swing trade, 20% no day trade, compensação de prejuízos, IRRF e DARF com vencimento.
 * Os lançamentos ficam só neste aparelho (localStorage). Educacional: não substitui contador nem a apuração da corretora.
 */
export function ImpostoOpcoes() {
  const [operacoes, setOperacoes] = useState<OperacaoIr[]>(ler)
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [categoria, setCategoria] = useState<CategoriaIr>('swing')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState(0)
  const [perdeu, setPerdeu] = useState(false)
  const [vendido, setVendido] = useState(0)

  useEffect(() => {
    try { window.localStorage.setItem(CHAVE, JSON.stringify(operacoes)) } catch { /* sem armazenamento: segue só na memória */ }
  }, [operacoes])

  const meses = useMemo(() => apurarMeses(operacoes), [operacoes])
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const

  const adicionar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || valor <= 0) return
    const nova: OperacaoIr = { id: `${Date.now()}-${operacoes.length}`, data, categoria, descricao: descricao.trim(), resultado: perdeu ? -valor : valor, vendido }
    setOperacoes((atual) => [...atual, nova].sort((a, b) => a.data.localeCompare(b.data)))
    setDescricao('')
    setValor(0)
    setVendido(0)
  }

  const ultimo = meses[meses.length - 1]
  const totalDarf = meses.reduce((t, m) => t + m.darf, 0)

  return (
    <>
      <div className="col" style={{ gap: 4 }} data-testid="imposto-intro">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Imposto mensal sobre opções</span>
        <span className="muted small justify">
          Lance o resultado de cada operação encerrada (opção vendida, comprada, desmontada ou que venceu sem valor) e veja, mês a mês, quanto de imposto
          pagar. Swing trade paga <strong>{ALIQUOTA.swing * 100}%</strong> e day trade <strong>{ALIQUOTA.daytrade * 100}%</strong> sobre o ganho líquido do mês, sem a isenção dos R$ 20 mil
          (que vale só para ações à vista). Prejuízos abatem ganhos futuros da mesma categoria.
        </span>
      </div>

      <div className="card col" style={{ gap: 12 }} data-testid="imposto-form">
        <span style={{ fontWeight: 700 }}>Lançar operação encerrada</span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="col" style={{ gap: 4, flex: '1 1 150px' }}>
            <span className="small" style={{ fontWeight: 600 }}>Data do resultado</span>
            <input type="date" className="input-cotas" value={data} onChange={(ev) => setData(ev.target.value)} aria-label="Data do resultado" style={{ fontSize: 16 }} />
          </label>
          <label className="col" style={{ gap: 4, flex: '1 1 150px' }}>
            <span className="small" style={{ fontWeight: 600 }}>Tipo</span>
            <select value={categoria} onChange={(ev) => setCategoria(ev.target.value as CategoriaIr)} aria-label="Tipo da operação" style={{ fontSize: 16 }}>
              <option value="swing">Operação comum (swing trade)</option>
              <option value="daytrade">Day trade</option>
            </select>
          </label>
        </div>
        <label className="col" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 600 }}>Descrição (opcional)</span>
          <input type="text" className="input-cotas" value={descricao} maxLength={60} placeholder="Ex.: PETRK600 vendida" onChange={(ev) => setDescricao(ev.target.value)} style={{ fontSize: 16 }} />
        </label>
        <div className="row" style={{ gap: 6 }} role="group" aria-label="Ganho ou prejuízo">
          <button className={`chip ${!perdeu ? 'selected' : ''}`} aria-pressed={!perdeu} onClick={() => setPerdeu(false)}>Ganho</button>
          <button className={`chip ${perdeu ? 'selected' : ''}`} aria-pressed={perdeu} onClick={() => setPerdeu(true)}>Prejuízo</button>
        </div>
        <CampoReais rotulo={perdeu ? 'Valor do prejuízo' : 'Valor do ganho'} valor={valor} onMudar={setValor} dica="Líquido de corretagem e emolumentos, se você quiser considerá-los." />
        {categoria === 'swing' && (
          <CampoReais rotulo="Valor vendido, prêmio recebido (opcional)" valor={vendido} onMudar={setVendido} dica={`Base do IRRF de ${IRRF_SWING * 100}% (dedo-duro) retido na venda. Deixe em branco para ignorar.`} />
        )}
        <button className="chip selected" style={{ alignSelf: 'flex-start' }} onClick={adicionar} disabled={valor <= 0}>Adicionar</button>
      </div>

      {operacoes.length === 0 ? (
        <div className="card-outline small muted justify" role="status">Nenhuma operação lançada ainda. Os lançamentos ficam só neste aparelho.</div>
      ) : (
        <>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 140px' }}>
              <span className="tiny muted">DARF total a pagar</span>
              <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="imposto-total">{reais(totalDarf)}</span>
            </div>
            {ultimo && (
              <>
                <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 140px' }}>
                  <span className="tiny muted">Prejuízo a compensar (swing)</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="imposto-prej-swing">{reais(ultimo.prejuizoSwingSeguinte)}</span>
                </div>
                <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 140px' }}>
                  <span className="tiny muted">Prejuízo a compensar (day trade)</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{reais(ultimo.prejuizoDayTradeSeguinte)}</span>
                </div>
              </>
            )}
          </div>

          <div className="col" style={{ gap: 12 }} data-testid="imposto-meses">
            {[...meses].reverse().map((m) => (
              <div key={m.mes} className="card col" style={{ gap: 8 }} data-testid={`imposto-mes-${m.mes}`}>
                <span style={{ fontWeight: 700 }}>{nomeMes(m.mes)}</span>
                <div className="tabela-bdr small"><span className="muted">Resultado swing trade</span><span style={{ fontWeight: 700 }}>{dinheiro(m.resultadoSwing)}</span></div>
                {m.compensadoSwing > 0 && <div className="tabela-bdr small"><span className="muted">Prejuízo anterior compensado</span><span>−{reais(m.compensadoSwing)}</span></div>}
                <div className="tabela-bdr small"><span className="muted">Imposto swing ({ALIQUOTA.swing * 100}% sobre {reais(m.baseSwing)})</span><span>{reais(m.impostoSwing)}</span></div>
                {(m.resultadoDayTrade !== 0 || m.impostoDayTrade > 0) && (
                  <>
                    <div className="tabela-bdr small"><span className="muted">Resultado day trade</span><span style={{ fontWeight: 700 }}>{dinheiro(m.resultadoDayTrade)}</span></div>
                    {m.compensadoDayTrade > 0 && <div className="tabela-bdr small"><span className="muted">Prejuízo anterior compensado</span><span>−{reais(m.compensadoDayTrade)}</span></div>}
                    <div className="tabela-bdr small"><span className="muted">Imposto day trade ({ALIQUOTA.daytrade * 100}% sobre {reais(m.baseDayTrade)})</span><span>{reais(m.impostoDayTrade)}</span></div>
                  </>
                )}
                {m.irrfSwing + m.irrfDayTrade > 0 && (
                  <div className="tabela-bdr small"><span className="muted">IRRF já retido (dedo-duro, {IRRF_SWING * 100}% / {IRRF_DAYTRADE * 100}%)</span><span>−{reais(m.irrfSwing + m.irrfDayTrade)}</span></div>
                )}
                {m.creditoUsado > 0 && <div className="tabela-bdr small"><span className="muted">Crédito de IRRF de meses anteriores</span><span>−{reais(m.creditoUsado)}</span></div>}
                {m.acumuladoAnterior > 0 && <div className="tabela-bdr small"><span className="muted">DARF acumulado de meses anteriores</span><span>+{reais(m.acumuladoAnterior)}</span></div>}
                <div className="tabela-bdr" style={{ fontWeight: 700 }}>
                  <span>DARF a pagar (código 6015)</span><span data-testid={`imposto-darf-${m.mes}`}>{reais(m.darf)}</span>
                </div>
                {m.darf > 0 ? (
                  <span className="tiny muted">Vence em {formatarData(m.vencimento)} (último dia útil do mês seguinte, sem considerar feriados).</span>
                ) : m.acumuladoSeguinte > 0 ? (
                  <span className="tiny muted">Abaixo do mínimo de {reais(DARF_MINIMO)}: {reais(m.acumuladoSeguinte)} acumulam para o mês seguinte.</span>
                ) : m.creditoSeguinte > 0 ? (
                  <span className="tiny muted">Sem DARF: sobra {reais(m.creditoSeguinte)} de IRRF para abater nos próximos meses.</span>
                ) : (
                  <span className="tiny muted">Sem imposto neste mês.</span>
                )}
              </div>
            ))}
          </div>

          <div className="card col" style={{ gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Lançamentos</span>
            {[...operacoes].reverse().map((o) => (
              <div key={o.id} className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="small">
                  {formatarData(o.data)} · {o.categoria === 'daytrade' ? 'Day trade' : 'Swing'}{o.descricao ? ` · ${o.descricao}` : ''}
                </span>
                <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <strong className="small" style={{ color: o.resultado < 0 ? 'var(--danger)' : undefined }}>{dinheiro(o.resultado)}</strong>
                  <button className="chip" aria-label={`Remover lançamento de ${formatarData(o.data)}`} onClick={() => setOperacoes((a) => a.filter((x) => x.id !== o.id))}>Remover</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Como ler.</strong> O DARF (código 6015) é pago até o último dia útil do mês seguinte. O imposto é apurado por mês; ganhos e perdas de meses diferentes não se misturam, exceto pela
        compensação de prejuízos. Day trade e operações comuns têm apurações separadas. Exercício de opção (que muda o custo da ação, sem gerar resultado da opção) não é calculado aqui. A conta é uma
        estimativa educacional: confira com a nota de corretagem e com um contador, e informe as operações na declaração anual de ajuste.
      </div>
    </>
  )
}
