import { useMemo, useState } from 'react'
import { buscarParesCustoZero, TOLERANCIAS_CUSTO_ZERO, vencimentosComCallEPut } from '../domain/custoZero'
import type { DirecaoCustoZero, ModoCustoZero, ParCustoZero } from '../domain/custoZero'
import { diasUteis, faixaPerto, limitesDeStrike, strikesDistintos, tipoVencimento } from '../domain/opcoes'
import type { AtivoComOpcoes, SnapshotOpcoes } from '../domain/opcoes'
import type { Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { FaixaDeStrike } from '../ui/FaixaDeStrike'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { PainelDaPosicao } from './PainelDaPosicao'

const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctDe = (strike: number, cotacao: number) => {
  const p = (strike / cotacao - 1) * 100
  return `${p >= 0 ? '+' : '−'}${Math.abs(p).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
const saldoTexto = (v: number) => (Math.abs(v) < 0.005 ? 'R$ 0,00' : v > 0 ? `crédito de ${reais(v)}` : `débito de ${reais(-v)}`)

/**
 * Aba "Custo zero": procura, nas séries reais, pares de compra e venda de opções no mesmo vencimento cujos prêmios se
 * anulam (ou quase): compra de call paga pela venda de put (alta) ou compra de put paga pela venda de call (baixa).
 * Descritiva e educacional: custo zero não é risco zero.
 */
export function CustoZeroOpcoes({ snapshot, ativo, onEscolher, dataPregao }: {
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
      <div className="col" style={{ gap: 4 }} data-testid="custozero-intro">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Custo zero: uma ponta paga a outra</span>
        <span className="muted small justify">
          Compra uma opção e vende outra no mesmo vencimento, de modo que o prêmio recebido cubra (ou quase) o pago. Na <strong>alta</strong>, compra call e vende put;
          na <strong>baixa</strong>, compra put e vende call. Você entra sem desembolsar prêmio, mas assume uma obrigação: a ponta vendida pode dar prejuízo grande.
        </span>
      </div>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <Busca key={ativo.ticker} ativo={ativo} hoje={dataPregao ?? new Date().toISOString().slice(0, 10)} />
    </>
  )
}

function Busca({ ativo, hoje }: { ativo: AtivoComOpcoes; hoje: string }) {
  const lote = ativo.lote >= 100 ? ativo.lote : 100
  const vencimentos = useMemo(() => vencimentosComCallEPut(ativo.series).filter((v) => v >= hoje), [ativo, hoje])
  const [direcao, setDirecao] = useState<DirecaoCustoZero>('alta')
  const [vencimento, setVencimento] = useState(() => vencimentos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? vencimentos[0] ?? '')
  const [tolerancia, setTolerancia] = useState<number>(0.05)
  const [modo, setModo] = useState<ModoCustoZero>('credito')
  const [quantidade, setQuantidade] = useState(lote)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const [faixa, setFaixa] = useState<{ strikeMin: number | null; strikeMax: number | null }>({ strikeMin: null, strikeMax: null })

  const doVencimento = useMemo(() => ativo.series.filter((s) => s.vencimento === vencimento), [ativo, vencimento])
  const strikes = useMemo(() => strikesDistintos(doVencimento), [doVencimento])
  const limites = useMemo(() => limitesDeStrike(doVencimento), [doVencimento])
  const pares = useMemo(
    () => (vencimento ? buscarParesCustoZero(ativo.series, direcao, vencimento, ativo.cotacao, tolerancia, 10, faixa, modo) : []),
    [ativo, direcao, vencimento, tolerancia, faixa, modo],
  )
  const faixaAtiva = (pct: number) => {
    const f = faixaPerto(ativo.cotacao, pct)
    return faixa.strikeMin === f.strikeMin && faixa.strikeMax === f.strikeMax
  }

  if (vencimentos.length === 0) {
    return (
      <div className="card-outline small justify" role="status">
        <strong>Sem séries para esta busca.</strong> <span className="muted">Este ativo não tem calls e puts no mesmo vencimento.</span>
      </div>
    )
  }

  const chave = (p: ParCustoZero) => `${p.compra.codigo}/${p.venda.codigo}`
  const atual = pares.find((p) => chave(p) === escolhido) ?? pares[0] ?? null
  const dias = vencimento ? Math.max(diasUteis(vencimento, hoje), 1) : 1
  const posicao: Posicao | null = atual
    ? {
        pernas: [
          { tipo: atual.compra.tipo, lado: 'compra', strike: atual.compra.strike, premio: atual.compra.ultimo, quantidade, dias },
          { tipo: atual.venda.tipo, lado: 'venda', strike: atual.venda.strike, premio: atual.venda.ultimo, quantidade, dias },
        ],
        acoes: 0,
        precoAcao: 0,
      }
    : null
  const mudar = (fn: () => void) => { fn(); setEscolhido(null) }

  return (
    <>
      <div className="col" style={{ gap: 6 }} role="group" aria-label="Direção">
        <span className="small" style={{ fontWeight: 600 }}>Direção</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={`chip ${direcao === 'alta' ? 'selected' : ''}`} aria-pressed={direcao === 'alta'} onClick={() => mudar(() => setDirecao('alta'))}>Alta: compra call + vende put</button>
          <button className={`chip ${direcao === 'baixa' ? 'selected' : ''}`} aria-pressed={direcao === 'baixa'} onClick={() => mudar(() => setDirecao('baixa'))}>Baixa: compra put + vende call</button>
        </div>
      </div>

      <div className="col" style={{ gap: 6 }} role="group" aria-label="Vencimento">
        <span className="small" style={{ fontWeight: 600 }}>Vencimento</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {vencimentos.map((v) => (
            <button key={v} className={`chip ${vencimento === v ? 'selected' : ''}`} aria-pressed={vencimento === v} onClick={() => mudar(() => setVencimento(v))}>
              {formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})
            </button>
          ))}
        </div>
      </div>

      <div className="col" style={{ gap: 6 }} role="group" aria-label="O que procurar">
        <span className="small" style={{ fontWeight: 600 }}>O que procurar</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={`chip ${modo === 'credito' ? 'selected' : ''}`} aria-pressed={modo === 'credito'} onClick={() => mudar(() => setModo('credito'))}>Recebo para montar (crédito)</button>
          <button className={`chip ${modo === 'zero' ? 'selected' : ''}`} aria-pressed={modo === 'zero'} onClick={() => mudar(() => setModo('zero'))}>Custo zero (prêmios iguais)</button>
        </div>
        {modo === 'credito' && (
          <span className="tiny muted justify">
            Mostra os pares em que o prêmio recebido é maior que o pago, do maior crédito para o menor. Atenção: crédito alto costuma vir de vender uma opção mais perto do preço
            do ativo, que tem mais chance de ser exercida. Compare a distância dos strikes antes de escolher.
          </span>
        )}
      </div>

      <div className="col" style={{ gap: 6 }} role="group" aria-label="Diferença aceita">
        <span className="small" style={{ fontWeight: 600 }}>{modo === 'credito' ? 'Débito máximo aceito, se houver (por ação)' : 'Diferença aceita entre os prêmios (por ação)'}</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {TOLERANCIAS_CUSTO_ZERO.map((t) => (
            <button key={t} className={`chip ${tolerancia === t ? 'selected' : ''}`} aria-pressed={tolerancia === t} onClick={() => mudar(() => setTolerancia(t))}>
              até R$ {num(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="col" style={{ gap: 8 }} data-testid="custozero-faixa">
        <span className="small" style={{ fontWeight: 600 }}>Faixa de strike</span>
        <FaixaDeStrike strikes={strikes} min={faixa.strikeMin} max={faixa.strikeMax} onMudar={(f) => mudar(() => setFaixa(f))} />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}>
            <CampoReais rotulo="Strike mínimo" valor={faixa.strikeMin ?? 0} onMudar={(v) => mudar(() => setFaixa((f) => ({ ...f, strikeMin: v > 0 ? v : null })))} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <CampoReais rotulo="Strike máximo" valor={faixa.strikeMax ?? 0} onMudar={(v) => mudar(() => setFaixa((f) => ({ ...f, strikeMax: v > 0 ? v : null })))} />
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Atalhos de strike">
          {[5, 10, 20].map((pct) => (
            <button key={pct} className={`chip ${faixaAtiva(pct) ? 'selected' : ''}`} aria-pressed={faixaAtiva(pct)} onClick={() => mudar(() => setFaixa(faixaPerto(ativo.cotacao, pct)))}>
              Perto do preço (±{pct}%)
            </button>
          ))}
          {(faixa.strikeMin !== null || faixa.strikeMax !== null) && (
            <button className="chip" onClick={() => mudar(() => setFaixa({ strikeMin: null, strikeMax: null }))}>Sem limite de strike</button>
          )}
        </div>
        {limites && <span className="tiny muted">Strikes disponíveis neste vencimento: de {reais(limites.min)} a {reais(limites.max)}. Os dois strikes do par ficam dentro da faixa.</span>}
      </div>

      <div className="card col" style={{ gap: 12 }} data-testid="custozero-lista">
        <span style={{ fontWeight: 700 }}>{modo === 'credito' ? 'Pares em que você recebe para montar' : 'Pares de custo zero'} ({pares.length}{pares.length === 10 ? ', os 10 melhores' : ''})</span>
        {pares.length === 0 ? (
          <span className="small muted justify" role="status">Nenhum par fecha dentro dessa diferença neste vencimento. Aumente a diferença aceita ou troque o vencimento.</span>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {pares.map((p) => {
              const sel = atual !== null && chave(p) === chave(atual)
              return (
                <button key={chave(p)} className={`chip ${sel ? 'selected' : ''}`} aria-pressed={sel} onClick={() => setEscolhido(chave(p))} style={{ justifyContent: 'space-between', textAlign: 'left' }}>
                  <span>
                    Compra {p.compra.codigo} (strike {num(p.compra.strike)}, {num(p.compra.ultimo)}) · Vende {p.venda.codigo} (strike {num(p.venda.strike)}, {num(p.venda.ultimo)})
                  </span>
                  <span className="tiny" style={{ color: p.saldo > 0.005 ? 'var(--grafico-con)' : undefined }}>
                    {saldoTexto(p.saldo)} · strikes {pctDe(p.compra.strike, ativo.cotacao)} / {pctDe(p.venda.strike, ativo.cotacao)} do preço
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {atual && posicao && (
        <div className="card col" style={{ gap: 12 }} data-testid="custozero-detalhe">
          <CampoNumero rotulo="Quantidade (ações)" valor={quantidade} onMudar={setQuantidade} sufixo="ações" casas={0} dica={`O lote padrão de ${ativo.ticker} na B3 é de ${lote}.`} />
          <span className="small muted justify" data-testid="custozero-saldo">
            Saldo dos prêmios: <strong>{saldoTexto(atual.saldo * quantidade)}</strong> no total ({saldoTexto(atual.saldo)} por ação). Preço de {ativo.ticker} hoje: {reais(ativo.cotacao)}.
          </span>
          <PainelDaPosicao
            sufixo="-custozero"
            posicao={posicao}
            precoAtivo={ativo.cotacao}
            dias={dias}
            titulo="Resultado no vencimento"
            aviso={direcao === 'alta'
              ? 'Venda de put: se o ativo cair abaixo do strike, você é obrigado a comprá-lo pelo strike e a perda cresce até o ativo chegar a zero. A B3 exige garantia (margem).'
              : 'Venda de call sem ter o ativo: se o ativo subir, a perda não tem limite. A B3 exige garantia (margem).'}
          />
        </div>
      )}

      <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Custo zero não é risco zero.</strong> Você não paga prêmio, mas a ponta vendida exige margem e pode gerar prejuízo grande. Os preços são os do último negócio de cada série, que pode
        estar longe do preço real de compra e venda (séries pouco negociadas podem não fechar o par na prática). Corretagem, emolumentos e imposto de renda ficam de fora.
      </div>
    </>
  )
}
