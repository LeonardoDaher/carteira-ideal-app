import { useMemo, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'
import { escadaDeStrikes, indiceDoMaisPerto, proximoVencimento } from '../domain/modelosDeEstrategia'
import { passoDaCall, passoDaPut } from '../domain/roda'
import type { Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { ManejoDaEstrategia } from './ManejoDaEstrategia'
import { PainelDaPosicao } from './PainelDaPosicao'

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const pct = (v: number, casas = 1) => `${num(v * 100, casas)}%`

/** Vencimentos com put e com algum vencimento de call depois deles (a call da roda é vendida no ciclo seguinte). */
function vencimentosDaRoda(ativo: AtivoComOpcoes): string[] {
  return vencimentosDe(ativo.series).filter(
    (v) => escadaDeStrikes(ativo.series, 'put', v).length > 0 && proximoVencimento(ativo.series, 'call', v) !== null,
  )
}

/** Put padrão: o strike mais perto de 5% abaixo do preço. Call padrão: o primeiro strike a partir do strike da put (não abaixo do preço em que as ações foram compradas). */
function putPadrao(ativo: AtivoComOpcoes, venc: string): SerieOpcao | null {
  const escada = escadaDeStrikes(ativo.series, 'put', venc)
  return escada.length ? escada[indiceDoMaisPerto(escada, ativo.cotacao * 0.95)] : null
}
function callPadrao(ativo: AtivoComOpcoes, venc: string, minimo: number): SerieOpcao | null {
  const escada = escadaDeStrikes(ativo.series, 'call', venc)
  return escada.find((s) => s.strike >= minimo) ?? escada[escada.length - 1] ?? null
}

/**
 * Aba "Roda" (wheel): um giro da estratégia de renda em que se vende put coberta por caixa até ser exercida, depois se vende
 * call coberta sobre as ações até ser exercida, e volta ao começo. Mostra os dois passos com séries reais, o rendimento de
 * cada um, o preço efetivo das ações e o que fazer se a put for contra. Descritiva e educacional.
 */
export function RodaOpcoes({ snapshot, ativo, onEscolher, dataPregao }: {
  snapshot: SnapshotOpcoes
  ativo: AtivoComOpcoes | null
  onEscolher: (t: string) => void
  dataPregao: string | null
}) {
  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }
  return (
    <>
      <div className="col" style={{ gap: 4 }} data-testid="roda-intro">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Roda (wheel): renda com put e call coberta</span>
        <span className="muted small justify">
          <strong>Passo 1:</strong> vende uma put e reserva em caixa o dinheiro para comprar a ação pelo strike. Se a put vencer sem valor, você fica com o prêmio e repete.{' '}
          <strong>Passo 2:</strong> se a put for exercida, você compra a ação (a um preço efetivo menor que o strike, descontado o prêmio) e vende uma call coberta sobre ela.
          Se a ação for vendida pelo strike da call, o giro termina e volta ao passo 1. A renda vem dos prêmios; o risco é a ação cair muito depois de comprada.
        </span>
      </div>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <Giro key={ativo.ticker} ativo={ativo} hoje={dataPregao ?? new Date().toISOString().slice(0, 10)} />
    </>
  )
}

function Giro({ ativo, hoje }: { ativo: AtivoComOpcoes; hoje: string }) {
  const lote = ativo.lote >= 100 ? ativo.lote : 100
  const validos = useMemo(() => vencimentosDaRoda(ativo), [ativo])
  const [vencPut, setVencPut] = useState(() => validos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? validos[0] ?? '')
  const [codigoPut, setCodigoPut] = useState(() => putPadrao(ativo, vencPut)?.codigo ?? '')
  const [vencCall, setVencCall] = useState(() => proximoVencimento(ativo.series, 'call', vencPut) ?? '')
  const [codigoCall, setCodigoCall] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState(lote)

  const put = ativo.series.find((s) => s.codigo === codigoPut) ?? null
  const r = Math.log(1 + jurosPadrao() / 100)

  const escolherVencPut = (v: string) => {
    setVencPut(v)
    const novaPut = putPadrao(ativo, v)
    setCodigoPut(novaPut?.codigo ?? '')
    const vc = proximoVencimento(ativo.series, 'call', v) ?? ''
    setVencCall(vc)
    setCodigoCall(null)
  }
  const escolherPut = (c: string) => {
    setCodigoPut(c)
    setCodigoCall(null) // o padrão da call acompanha o custo da put nova
  }
  const escolherVencCall = (v: string) => {
    setVencCall(v)
    setCodigoCall(null)
  }

  if (validos.length === 0 || !put) {
    return (
      <div className="card-outline small justify" role="status">
        <strong>Sem séries para a roda.</strong>{' '}
        <span className="muted">Este ativo não tem puts com vencimento seguido de um vencimento de call nos próximos 6 meses.</span>
      </div>
    )
  }

  const diasPut = Math.max(diasUteis(put.vencimento, hoje), 1)
  const p1 = passoDaPut(put, ativo.cotacao, diasPut, r, quantidade)
  const callsDoVenc = escadaDeStrikes(ativo.series, 'call', vencCall)
  const call = (codigoCall ? callsDoVenc.find((s) => s.codigo === codigoCall) : null) ?? callPadrao(ativo, vencCall, put.strike)
  const diasCall = call ? Math.max(diasUteis(call.vencimento, hoje), 1) : 0
  const p2 = call ? passoDaCall(call, put, ativo.cotacao, diasPut, diasCall, r, quantidade) : null
  const vencimentosDeCall = vencimentosDe(ativo.series).filter((v) => v > put.vencimento && escadaDeStrikes(ativo.series, 'call', v).length > 0)
  const puts = escadaDeStrikes(ativo.series, 'put', vencPut)
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const
  const cartao = (rotulo: string, valor: string, testid?: string, dica?: string) => (
    <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 140px' }} title={dica}>
      <span className="tiny muted">{rotulo}</span>
      <span style={{ fontWeight: 700, fontSize: 15 }} data-testid={testid}>{valor}</span>
    </div>
  )

  const posicaoPut: Posicao = {
    pernas: [{ tipo: 'put', lado: 'venda', strike: put.strike, premio: put.ultimo, quantidade, dias: diasPut }],
    acoes: 0,
    precoAcao: 0,
  }
  const posicaoCall: Posicao | null =
    call && p2
      ? {
          pernas: [{ tipo: 'call', lado: 'venda', strike: call.strike, premio: p2.premioEstimado, quantidade, dias: p2.diasDaCall, sigma: p2.volatilidade }],
          acoes: quantidade,
          precoAcao: put.strike,
          realizado: p1.premioTotal,
        }
      : null

  return (
    <>
      <div className="col" style={{ gap: 6 }} role="group" aria-label="Vencimento da put">
        <span className="small" style={{ fontWeight: 600 }}>Vencimento da put (passo 1)</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {validos.map((v) => (
            <button key={v} className={`chip ${vencPut === v ? 'selected' : ''}`} aria-pressed={vencPut === v} onClick={() => escolherVencPut(v)}>
              {formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})
            </button>
          ))}
        </div>
      </div>

      <div className="card col" style={{ gap: 12 }} data-testid="roda-passo1">
        <span style={{ fontWeight: 700 }}>Passo 1: vender a put coberta por caixa</span>
        <label className="col" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 600 }}>Série da put</span>
          <select value={put.codigo} onChange={(ev) => escolherPut(ev.target.value)} aria-label="Série da put">
            {puts.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.codigo}, strike {num(s.strike)} ({pct((s.strike - ativo.cotacao) / ativo.cotacao, 1)} do preço), último {num(s.ultimo)}
              </option>
            ))}
          </select>
        </label>
        <CampoNumero rotulo="Quantidade (ações que compraria)" valor={quantidade} onMudar={setQuantidade} sufixo="ações" casas={0} dica={`O lote padrão de ${ativo.ticker} na B3 é de ${lote}.`} />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {cartao('Caixa reservado', reais(p1.caixa), 'roda-caixa', 'Strike vezes a quantidade: fica parado até o vencimento da put.')}
          {cartao('Prêmio recebido', reais(p1.premioTotal), 'roda-premio-put')}
          {cartao('Rendimento no prazo', pct(p1.rendimentoNoPrazo, 2), 'roda-rendimento-prazo', 'Prêmio sobre o caixa, até o vencimento.')}
          {cartao('Equivale a, por mês', pct(p1.rendimentoPorMes, 2), 'roda-rendimento-mes', 'Só para comparar prazos (regra de três para 21 dias úteis). Não é previsão nem se repete sozinho.')}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="col" style={{ ...caixa, gap: 4, flex: '1 1 220px' }}>
            <span style={{ fontWeight: 600 }}>Se a put vencer sem valor</span>
            <span className="small muted justify">Você fica com {reais(p1.premioTotal)} e pode repetir o passo 1. A ação não é comprada.</span>
          </div>
          <div className="col" style={{ ...caixa, gap: 4, flex: '1 1 220px' }}>
            <span style={{ fontWeight: 600 }}>Se for exercida</span>
            <span className="small muted justify" data-testid="roda-se-exercida">
              Você compra {quantidade.toLocaleString('pt-BR')} ações a {reais(put.strike)}; o preço efetivo, com o prêmio, é <strong>{reais(p1.custoEfetivo)}</strong>
              {' '}({p1.descontoSobreAtivo >= 0 ? `${pct(p1.descontoSobreAtivo)} abaixo` : `${pct(-p1.descontoSobreAtivo)} acima`} do preço de hoje, {reais(ativo.cotacao)}).
              {p1.chanceDeExercicio !== null && <> Chance de isso acontecer, pelo modelo: <strong data-testid="roda-chance-put">{pct(p1.chanceDeExercicio, 0)}</strong>.</>}
            </span>
          </div>
        </div>
        <PainelDaPosicao sufixo="-roda1" posicao={posicaoPut} precoAtivo={ativo.cotacao} dias={diasPut} titulo="Passo 1: venda da put" aviso="Venda de put: você pode ser obrigado a comprar o ativo pelo strike mesmo que ele valha muito menos, e a B3 exige o caixa reservado." />
      </div>

      <div className="card col" style={{ gap: 12 }} data-testid="roda-passo2">
        <span style={{ fontWeight: 700 }}>Passo 2: se a put for exercida, vender a call coberta</span>
        {vencimentosDeCall.length === 0 || !call || !p2 ? (
          <span className="small muted justify">Não há calls em vencimentos depois da put para estimar o passo 2.</span>
        ) : (
          <>
            <span className="small muted justify">
              Com as ações compradas a {reais(put.strike)}, a call é vendida depois do vencimento da put. O prêmio dela só será conhecido nesse dia, com o ativo perto de {reais(put.strike)},
              então ele é uma <strong>estimativa</strong> pelo modelo (volatilidade implícita do último preço da série), e não o preço de hoje.
            </span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label className="col" style={{ gap: 4, flex: '1 1 180px' }}>
                <span className="small" style={{ fontWeight: 600 }}>Vencimento da call</span>
                <select value={call.vencimento} onChange={(ev) => escolherVencCall(ev.target.value)} aria-label="Vencimento da call">
                  {vencimentosDeCall.map((v) => <option key={v} value={v}>{formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})</option>)}
                </select>
              </label>
              <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
                <span className="small" style={{ fontWeight: 600 }}>Série da call</span>
                <select value={call.codigo} onChange={(ev) => setCodigoCall(ev.target.value)} aria-label="Série da call">
                  {escadaDeStrikes(ativo.series, 'call', call.vencimento).map((s) => (
                    <option key={s.codigo} value={s.codigo}>{s.codigo}, strike {num(s.strike)}, último {num(s.ultimo)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {cartao('Prêmio estimado da call', reais(p2.premioTotal), 'roda-premio-call')}
              {cartao('Chance de a ação ser vendida', pct(p2.chanceDeExercicio, 0), 'roda-chance-call', 'Chance de a call terminar dentro do dinheiro, partindo do strike da put.')}
              {cartao('Equilíbrio das ações', reais(p2.equilibrioDasAcoes), 'roda-equilibrio-acoes', 'Strike da put menos os prêmios das duas pontas: abaixo desse preço, a posição perde dinheiro.')}
            </div>
            <div className="col" style={{ ...caixa, gap: 4 }}>
              <span style={{ fontWeight: 600 }}>Se a ação for vendida pelo strike da call (giro completo)</span>
              <span className="small muted justify" data-testid="roda-giro">
                Ganho total do giro: <strong>{reais(p2.ganhoDoGiroCompleto)}</strong>, ou {pct(p2.rendimentoDoGiroCompleto, 1)} sobre o caixa, somando a diferença entre os strikes e os dois prêmios.
                Depois disso, o caixa volta e o ciclo recomeça no passo 1.
              </span>
              {call.strike < p1.custoEfetivo && (
                <span className="small" style={{ color: 'var(--danger)' }} data-testid="roda-aviso-call-baixa">
                  Este strike de call está abaixo do preço efetivo da ação ({reais(p1.custoEfetivo)}): se a ação for vendida por ele, o giro dá prejuízo na ação.
                </span>
              )}
            </div>
            {posicaoCall && (
              <PainelDaPosicao
                sufixo="-roda2"
                posicao={posicaoCall}
                precoAtivo={put.strike}
                dias={p2.diasDaCall}
                titulo="Passo 2: venda coberta depois do exercício"
                nota={`As ações entram a ${reais(put.strike)} (o strike da put) e o prêmio da put já recebido (${reais(p1.premioTotal)}) está somado ao resultado.`}
              />
            )}
          </>
        )}
      </div>

      <details className="card col" style={{ gap: 12 }} data-testid="roda-manejo">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>E se o ativo cair antes do vencimento da put? Ajuste, rolagem e desmontagem</summary>
        <div style={{ marginTop: 12 }}>
          <ManejoDaEstrategia
            key={put.codigo}
            ativo={ativo}
            pernas={[{ perna: posicaoPut.pernas[0], serie: put }]}
            base={{ acoes: 0, precoAcao: 0 }}
            precoAtivo={ativo.cotacao}
            hoje={hoje}
          />
        </div>
      </details>

      <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>O que a roda não faz.</strong> Não elimina o risco: se a ação cair bem abaixo do strike, você fica com um papel que vale menos do que pagou, e a call coberta limita a recuperação (o ganho
        fica travado no strike da call). Os prêmios reduzem o preço efetivo, mas não impedem a perda. Vale só para ativos que você aceitaria ter em carteira ao preço do strike. Os números usam o
        último preço negociado e um modelo; o preço real de compra e venda pode ser pior, e as contas não incluem corretagem, emolumentos nem imposto de renda.
      </div>
    </>
  )
}
