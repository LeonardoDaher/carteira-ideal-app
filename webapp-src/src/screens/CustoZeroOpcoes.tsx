import { useMemo, useState } from 'react'
import { buscarParesCustoZero, TOLERANCIAS_CUSTO_ZERO, vencimentosComCallEPut } from '../domain/custoZero'
import type { DirecaoCustoZero, ParCustoZero } from '../domain/custoZero'
import { diasUteis, tipoVencimento } from '../domain/opcoes'
import type { AtivoComOpcoes, SnapshotOpcoes } from '../domain/opcoes'
import type { Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { PainelDaPosicao } from './PainelDaPosicao'

const num = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [quantidade, setQuantidade] = useState(lote)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const pares = useMemo(
    () => (vencimento ? buscarParesCustoZero(ativo.series, direcao, vencimento, ativo.cotacao, tolerancia) : []),
    [ativo, direcao, vencimento, tolerancia],
  )

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

      <div className="col" style={{ gap: 6 }} role="group" aria-label="Diferença aceita">
        <span className="small" style={{ fontWeight: 600 }}>Diferença aceita entre os prêmios (por ação)</span>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {TOLERANCIAS_CUSTO_ZERO.map((t) => (
            <button key={t} className={`chip ${tolerancia === t ? 'selected' : ''}`} aria-pressed={tolerancia === t} onClick={() => mudar(() => setTolerancia(t))}>
              até R$ {num(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="card col" style={{ gap: 12 }} data-testid="custozero-lista">
        <span style={{ fontWeight: 700 }}>Pares encontrados ({pares.length})</span>
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
                  <span className="tiny muted">{saldoTexto(p.saldo)}</span>
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
