import { useId, useMemo, useState } from 'react'
import { ATIVOS } from '../data/assets'
import { CATALOGO_ATIVOS } from '../data/catalogoAtivos'
import { lerNumero } from '../domain/importacao/celulas'
import { reais } from '../domain/mercadoOficial'
import { baseDaCarteira, simularAporteDado, simularAporteParaAtingir } from '../domain/simulacaoComAtivos'
import type { ModoSimulacao } from '../domain/simulacaoComAtivos'
import type { AtivoKey, Carteira } from '../domain/types'
import type { AppCtx } from '../state/useAppState'
import { useCarteiraReal } from '../state/useCarteiraReal'
import { AvisoEducacional } from './AvisoEducacional'

const dois = (n: number) => String(n).padStart(2, '0')
const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}
const pp = (n: number) => `${n.toFixed(1).replace('.', ',')}%`

const MODOS: { id: ModoSimulacao; rotulo: string }[] = [
  { id: 'exato', rotulo: 'Percentual exato' },
  { id: 'faixa', rotulo: 'Dentro do alvo' },
]

/**
 * Simular valores, aba "Com os meus ativos": usa a carteira que a pessoa já tem em Meus Ativos e mostra quanto ela
 * precisa investir, sem vender nada, para chegar aos percentuais da carteira sugerida. Tudo roda no aparelho.
 */
export function SimularComMeusAtivos({ ctx, referencia }: { ctx: AppCtx; referencia: Carteira }) {
  const idAporte = useId()
  const h = useCarteiraReal(hojeISO())
  const base = useMemo(() => baseDaCarteira(h.carteira, CATALOGO_ATIVOS), [h.carteira])
  const [modo, setModo] = useState<ModoSimulacao>('exato')
  const [texto, setTexto] = useState('')
  const resultado = useMemo(() => simularAporteParaAtingir(base.valores, referencia, modo), [base, referencia, modo])
  const valorDado = lerNumero(texto)
  const dado = useMemo(() => (valorDado && valorDado > 0 ? simularAporteDado(base.valores, referencia, valorDado) : null), [base, referencia, valorDado])

  if (!h.hidratado) return <div className="muted small" role="status">Carregando os seus ativos…</div>

  const irParaMeusAtivos = (
    <button className="btn btn-outline" onClick={() => ctx.setScreen('minhaCarteira')}>
      Abrir Meus Ativos
    </button>
  )

  if (!resultado.temBase) {
    return (
      <>
        <div className="card-outline col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Traga os seus ativos para simular</div>
          <div className="muted small justify" style={{ lineHeight: 1.5 }}>
            Para calcular quanto investir até chegar à carteira sugerida, preciso saber o que você já tem. Importe os extratos da B3, envie a sua planilha ou lance as posições em Meus Ativos.
            {resultado.foraDaBase > 0 && ` Os ${reais(resultado.foraDaBase)} que você já lançou estão fora das classes da carteira sugerida e não entram na conta.`}
          </div>
          {irParaMeusAtivos}
        </div>
        <AvisoEducacional />
      </>
    )
  }

  const ancora = resultado.ancora ? ATIVOS[resultado.ancora].label : null
  // "1500%" não diz nada para ninguém: acima de 2x, fala em "vezes".
  const razao = resultado.aporteTotal / resultado.patrimonioBase
  const quantoRepresenta = razao >= 2 ? `${razao.toFixed(1).replace('.', ',').replace(',0', '')} vezes o que você tem hoje` : `${pp(razao * 100)} do que você tem hoje`

  return (
    <>
      <div className="card col" style={{ gap: 10 }} role="region" aria-label="Quanto investir para chegar na carteira sugerida">
        <div style={{ fontWeight: 700, fontSize: 14 }}>Quanto investir para chegar na carteira sugerida</div>
        <div className="mc-modos" role="group" aria-label="Meta da simulação">
          {MODOS.map((m) => (
            <button key={m.id} type="button" className="mc-modo" aria-pressed={modo === m.id} onClick={() => setModo(m.id)}>
              {m.rotulo}
            </button>
          ))}
        </div>
        <div className="muted small justify">
          {modo === 'exato'
            ? 'Cada classe termina exatamente no percentual da carteira sugerida, sem vender nada.'
            : 'Cada classe termina dentro do alvo (a mesma tolerância da comparação): bem menos dinheiro do que o percentual exato.'}
        </div>

        {resultado.aporteTotal > 0 ? (
          <>
            <div className="font-display" style={{ fontWeight: 700, fontSize: 30, lineHeight: 1.15, color: 'var(--accent)' }} aria-live="polite">
              {reais(resultado.aporteTotal)}
            </div>
            <div className="small justify" style={{ lineHeight: 1.5 }}>
              É o que falta investir para o seu patrimônio nas classes da carteira sugerida ir de <strong>{reais(resultado.patrimonioBase)}</strong> para <strong>{reais(resultado.patrimonioFinal)}</strong> ({quantoRepresenta}).
            </div>
            {ancora && (
              <div className="muted small justify" style={{ lineHeight: 1.5 }}>
                <strong>{ancora}</strong> já está acima do alvo e é ela que define esse valor: como não vender, ela só chega ao percentual quando o patrimônio total cresce.
                {modo === 'exato' && ' Se o valor ficou alto demais, veja “Dentro do alvo” ou simule um valor menor abaixo.'}
              </div>
            )}
          </>
        ) : (
          <div className="small" style={{ fontWeight: 600 }} aria-live="polite">
            {modo === 'exato' ? 'Seus ativos já estão nos percentuais da carteira sugerida.' : 'Seus ativos já estão dentro do alvo da carteira sugerida.'} Não precisa investir nada para chegar lá.
          </div>
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        {resultado.linhas.map((l) => {
          const a = ATIVOS[l.classe as AtivoKey]
          return (
            <div key={l.classe} className="card col" style={{ gap: 4 }}>
              <div className="row-between" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 10, minWidth: 0, flex: 1 }}>
                  <div className="alloc-dot" style={{ background: a.cor, width: 12, height: 12, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</span>
                </div>
                <span className="font-display" style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {l.aporte > 0 ? `Investir ${reais(l.aporte)}` : 'Nada a investir'}
                </span>
              </div>
              <div className="muted small">
                Hoje {pp(l.pctAtual)} ({reais(l.atual)}) · alvo {pp(l.alvoPct)} · depois {pp(l.pctFinal)} ({reais(l.final)})
              </div>
            </div>
          )
        })}
      </div>

      {(resultado.foraDaBase > 0 || base.pendentes.length > 0) && (
        <div className="card-outline col" style={{ gap: 6 }}>
          {resultado.foraDaBase > 0 && (
            <div className="muted small justify" style={{ lineHeight: 1.5 }}>
              <strong>{reais(resultado.foraDaBase)}</strong> dos seus ativos estão fora das classes da carteira sugerida (por exemplo, previdência, COE ou CDB com prazo) e não entram na conta, porque, sem vender, não dá para levá-los a 0%.
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

      <div className="card col" style={{ gap: 10 }} role="region" aria-label="E se eu investir um valor menor?">
        <div style={{ fontWeight: 700, fontSize: 14 }}>E se eu investir um valor menor?</div>
        <label htmlFor={idAporte} className="muted small">Quanto você pode investir agora? (R$)</label>
        <input
          id={idAporte}
          className="mc-campo"
          inputMode="decimal"
          placeholder="Ex.: 5000"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        {dado && dado.alocacoes.length > 0 && (
          <>
            <ul className="col" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }} aria-label="Como distribuir o valor">
              {dado.alocacoes.map((a) => (
                <li key={a.classe} className="row-between" style={{ gap: 10, fontSize: 14 }}>
                  <span>{ATIVOS[a.classe].label}</span>
                  <strong className="font-display">{reais(a.valor)}</strong>
                </li>
              ))}
            </ul>
            {dado.aderenciaAntes !== null && dado.aderenciaDepois !== null && (
              <div className="small" aria-live="polite">
                Aderência à carteira sugerida: de <strong>{Math.round(dado.aderenciaAntes)}%</strong> para <strong>{Math.round(dado.aderenciaDepois)}%</strong>.
              </div>
            )}
          </>
        )}
        {dado && dado.alocacoes.length === 0 && <div className="muted small">Nenhuma classe está abaixo do alvo: não há onde colocar esse valor sem desequilibrar a carteira.</div>}
      </div>

      <AvisoEducacional />
    </>
  )
}
