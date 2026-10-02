import { useId, useMemo, useState } from 'react'
import { ATIVOS } from '../data/assets'
import { CATALOGO_ATIVOS } from '../data/catalogoAtivos'
import { lerNumero } from '../domain/importacao/celulas'
import { reais } from '../domain/mercadoOficial'
import { baseDaCarteira, priorizarClasses, simularAporteDado } from '../domain/simulacaoComAtivos'
import type { LinhaPrioridade } from '../domain/simulacaoComAtivos'
import type { AtivoKey, Carteira } from '../domain/types'
import type { AppCtx } from '../state/useAppState'
import { useCarteiraReal } from '../state/useCarteiraReal'
import { AvisoEducacional } from './AvisoEducacional'

const dois = (n: number) => String(n).padStart(2, '0')
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}
const virgula = (n: number) => n.toFixed(1).replace('.', ',')
const pct = (n: number) => `${virgula(n)}%`
const pontos = (n: number) => `${virgula(Math.abs(n))} pp`
const nome = (k: AtivoKey) => ATIVOS[k].label

/** "A", "A e B", "A, B e C" (e "mais N" quando passa de 3). */
function listar(classes: LinhaPrioridade[]) {
  const nomes = classes.slice(0, 3).map((l) => <strong key={l.classe}>{nome(l.classe)}</strong>)
  const resto = classes.length - nomes.length
  const partes: React.ReactNode[] = []
  nomes.forEach((n, i) => {
    if (i > 0) partes.push(i === nomes.length - 1 && resto === 0 ? ' e ' : ', ')
    partes.push(n)
  })
  if (resto > 0) partes.push(` e mais ${resto}`)
  return <>{partes}</>
}

function Linha({ l }: { l: LinhaPrioridade }) {
  const a = ATIVOS[l.classe]
  const destaque = l.situacao === 'atacar' ? `Faltam ${pontos(l.difPp)}` : l.situacao === 'segurar' ? 'Acima do alvo' : 'Perto do alvo'
  return (
    <li className="card col" style={{ gap: 6, listStyle: 'none' }} data-situacao={l.situacao}>
      <div className="row-between" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
          {l.prioridade !== null ? (
            <span
              className="font-display"
              aria-label={`Prioridade ${l.prioridade}`}
              style={{ width: 24, height: 24, borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {l.prioridade}
            </span>
          ) : (
            <div className="alloc-dot" style={{ background: a.cor, width: 12, height: 12, flexShrink: 0 }} />
          )}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</span>
        </div>
        <span className="font-display" style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>{destaque}</span>
      </div>
      <div
        role="img"
        aria-label={`${a.label}: ${Math.round(l.preenchidoPct)}% do alvo preenchido`}
        style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}
      >
        <div style={{ width: `${l.preenchidoPct}%`, height: '100%', background: a.cor }} />
      </div>
      <div className="muted small">
        Hoje {pct(l.pctAtual)} ({reais(l.atual)}) · alvo {pct(l.alvoPct)}
        {l.situacao === 'atacar' && ` · ≈ ${reais(l.faltaReais)} para chegar lá`}
        {l.situacao === 'segurar' && ` · passou ${pontos(l.difPp)}`}
      </div>
      {l.situacao === 'segurar' && <div className="small" style={{ fontWeight: 600 }}>Não invista mais aqui por enquanto.</div>}
    </li>
  )
}

function Grupo({ titulo, nota, linhas }: { titulo: string; nota: string; linhas: LinhaPrioridade[] }) {
  if (!linhas.length) return null
  return (
    <section className="col" style={{ gap: 8 }} aria-label={titulo}>
      <div className="col" style={{ gap: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</div>
        <div className="muted small">{nota}</div>
      </div>
      <ul className="col" style={{ gap: 8, margin: 0, padding: 0 }}>
        {linhas.map((l) => <Linha key={l.classe} l={l} />)}
      </ul>
    </section>
  )
}

/**
 * Simular valores, aba "Com os meus ativos": compara o que a pessoa já tem em Meus Ativos com a carteira sugerida e
 * diz o que atacar primeiro (classes mais abaixo do alvo) e onde segurar a mão (classes que já passaram). Tudo roda no aparelho.
 */
export function SimularComMeusAtivos({ ctx, referencia }: { ctx: AppCtx; referencia: Carteira }) {
  const idAporte = useId()
  const h = useCarteiraReal(hojeISO())
  const base = useMemo(() => baseDaCarteira(h.carteira, CATALOGO_ATIVOS), [h.carteira])
  const prioridade = useMemo(() => priorizarClasses(base.valores, referencia), [base, referencia])
  const [texto, setTexto] = useState('')
  const valorDado = lerNumero(texto)
  const dado = useMemo(() => (valorDado && valorDado > 0 ? simularAporteDado(base.valores, referencia, valorDado) : null), [base, referencia, valorDado])

  if (!h.hidratado) return <div className="muted small" role="status">Carregando os seus ativos…</div>

  const irParaMeusAtivos = (
    <button className="btn btn-outline" onClick={() => ctx.setScreen('minhaCarteira')}>
      Abrir Meus Ativos
    </button>
  )

  if (!prioridade.temBase) {
    return (
      <>
        <div className="card-outline col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Traga os seus ativos para simular</div>
          <div className="muted small justify" style={{ lineHeight: 1.5 }}>
            Para dizer o que atacar primeiro, preciso saber o que você já tem. Importe os extratos da B3, envie a sua planilha ou lance as posições em Meus Ativos.
            {prioridade.foraDaBase > 0 && ` Os ${reais(prioridade.foraDaBase)} que você já lançou estão fora das classes da carteira sugerida e não entram na conta.`}
          </div>
          {irParaMeusAtivos}
        </div>
        <AvisoEducacional />
      </>
    )
  }

  const { atacar, perto, segurar } = prioridade
  // A ordem em que o aporte aparece segue a prioridade; as classes que não recebem nada nem entram na lista.
  const ordem = new Map(prioridade.linhas.map((l, i) => [l.classe, i]))
  const alocacoes = dado ? [...dado.alocacoes].sort((a, b) => (ordem.get(a.classe) ?? 99) - (ordem.get(b.classe) ?? 99)) : []

  return (
    <>
      <div className="card col" style={{ gap: 10 }} role="region" aria-label="O que atacar primeiro">
        <div style={{ fontWeight: 700, fontSize: 14 }}>O que atacar primeiro</div>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Compara o que você tem em Meus Ativos com a carteira sugerida. Antes de colocar mais dinheiro onde você já está forte, leve as outras classes ao percentual delas.
        </div>
        {atacar.length > 0 && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>Comece por</strong> {listar(atacar)}: {atacar.length === 1 ? 'é a classe' : 'são as classes'} mais distante{atacar.length === 1 ? '' : 's'} do alvo.
          </div>
        )}
        {segurar.length > 0 && (
          <div className="small justify" style={{ lineHeight: 1.5 }}>
            <strong>Segure o dinheiro em</strong> {listar(segurar)}: já {segurar.length === 1 ? 'passou' : 'passaram'} do alvo.
          </div>
        )}
        {atacar.length === 0 && segurar.length === 0 && (
          <div className="small" style={{ fontWeight: 600 }} aria-live="polite">
            Seus ativos já estão perto da carteira sugerida. Não há nada urgente a atacar.
          </div>
        )}
      </div>

      <Grupo titulo="Atacar primeiro" nota="Abaixo do alvo. O número é a ordem: 1 é a mais distante." linhas={atacar} />
      <Grupo titulo="Perto do alvo" nota="Dentro da faixa de tolerância. Pode receber aporte depois das de cima." linhas={perto} />
      <Grupo titulo="Segurar por enquanto" nota="Já passou do alvo. Sem vender, ela só diminui de peso quando as outras crescem." linhas={segurar} />

      {(prioridade.foraDaBase > 0 || base.pendentes.length > 0) && (
        <div className="card-outline col" style={{ gap: 6 }}>
          {prioridade.foraDaBase > 0 && (
            <div className="muted small justify" style={{ lineHeight: 1.5 }}>
              <strong>{reais(prioridade.foraDaBase)}</strong> dos seus ativos estão fora das classes da carteira sugerida (por exemplo, previdência, COE ou CDB com prazo) e não entram na conta.
            </div>
          )}
          {base.pendentes.length > 0 && (
            <div className="muted small justify" style={{ lineHeight: 1.5 }}>
              <strong>{base.pendentes.length} ativo(s), somando {reais(base.valorPendente)}</strong>, ficaram de fora porque ainda não têm classe. Escolha a classe deles em Meus Ativos para incluí-los.
            </div>
          )}
          {irParaMeusAtivos}
        </div>
      )}

      <div className="card col" style={{ gap: 10 }} role="region" aria-label="Para onde vai o próximo aporte">
        <div style={{ fontWeight: 700, fontSize: 14 }}>Para onde vai o próximo aporte</div>
        <label htmlFor={idAporte} className="muted small">Quanto você pode investir agora? (R$)</label>
        <input id={idAporte} className="mc-campo" inputMode="decimal" placeholder="Ex.: 5000" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {alocacoes.length > 0 && (
          <>
            <ul className="col" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }} aria-label="Como distribuir o valor">
              {alocacoes.map((a) => (
                <li key={a.classe} className="row-between" style={{ gap: 10, fontSize: 14 }}>
                  <span>{nome(a.classe)}</span>
                  <strong className="font-display">{reais(a.valor)}</strong>
                </li>
              ))}
            </ul>
            <div className="muted small justify" style={{ lineHeight: 1.5 }}>
              O dinheiro vai só para quem está abaixo do alvo, e mais para quem está mais longe dele.
              {segurar.length > 0 && <> {listar(segurar)} ficam sem aporte.</>}
            </div>
            {dado && dado.aderenciaAntes !== null && dado.aderenciaDepois !== null && (
              <div className="small" aria-live="polite">
                Aderência à carteira sugerida: de <strong>{Math.round(dado.aderenciaAntes)}%</strong> para <strong>{Math.round(dado.aderenciaDepois)}%</strong>.
              </div>
            )}
          </>
        )}
        {dado && alocacoes.length === 0 && <div className="muted small">Nenhuma classe está abaixo do alvo: não há onde colocar esse valor sem desequilibrar a carteira.</div>}
      </div>

      <AvisoEducacional />
    </>
  )
}
