import { useState } from 'react'
import { diasUteis } from '../domain/opcoes'
import type { AtivoComOpcoes, SerieOpcao } from '../domain/opcoes'
import type { Lado, Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { PainelDaPosicao } from './PainelDaPosicao'

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const rotuloTipo = (t: 'call' | 'put') => (t === 'call' ? 'CALL' : 'PUT')

/**
 * Botão C (comprar, verde) ou V (vender, vermelho) de uma série. Escolhido fica cheio, com letra branca; os outros só com
 * contorno e letra coloridos. Compartilhado pela tabela das Séries da B3 e pelo Top 15 prêmios.
 */
export function BotaoDeLado({ lado, codigo, escolhido, onClick }: { lado: Lado; codigo: string; escolhido: boolean; onClick: () => void }) {
  const cor = lado === 'compra' ? 'var(--mc-pos)' : 'var(--danger)'
  return (
    <button
      className="chip"
      data-lado={lado}
      style={{
        padding: '2px 9px', minHeight: 0, marginRight: lado === 'compra' ? 4 : 0, fontWeight: 700,
        ...(escolhido ? { background: cor, borderColor: cor, color: '#fff' } : { borderColor: cor, color: cor }),
      }}
      aria-pressed={escolhido}
      aria-label={`${lado === 'compra' ? 'Comprar' : 'Vender'} ${codigo}`}
      title={lado === 'compra' ? 'Comprar' : 'Vender'}
      onClick={onClick}
    >
      {lado === 'compra' ? 'C' : 'V'}
    </button>
  )
}

/**
 * Compra ou venda de uma call ou put já montada na própria tabela: preço da série, quantidade e preço do ativo editáveis, e o
 * resultado (gráfico, ganho e perda máximos, passagem do tempo e gregas) logo abaixo.
 */
export function OperacaoDaSerie({ ativo, serie, lado, hoje, aoFechar, coberta = false }: {
  ativo: AtivoComOpcoes
  serie: SerieOpcao
  lado: Lado
  hoje: string
  aoFechar: () => void
  /** Venda de call com as ações em carteira (venda coberta): entram as ações, compradas ao preço do ativo, e some o aviso de perda sem limite. */
  coberta?: boolean
}) {
  const lote = ativo.lote >= 100 ? ativo.lote : 100
  const [premio, setPremio] = useState(serie.ultimo)
  const [quantidade, setQuantidade] = useState(lote)
  const [precoAtivo, setPrecoAtivo] = useState(ativo.cotacao)
  const dias = Math.max(diasUteis(serie.vencimento, hoje), 1)
  const nome = coberta ? 'Venda coberta' : `${lado === 'compra' ? 'Compra' : 'Venda'} de ${serie.tipo === 'call' ? 'call' : 'put'}`
  const erro = !(precoAtivo > 0) ? 'Informe o preço do ativo.' : !(quantidade > 0) ? 'Informe a quantidade de opções.' : !(premio >= 0) ? 'O preço da série não pode ser negativo.' : null
  const posicao: Posicao | null = erro ? null : { pernas: [{ tipo: serie.tipo, lado, strike: serie.strike, premio, quantidade }], acoes: coberta ? quantidade : 0, precoAcao: coberta ? precoAtivo : 0 }
  const aviso =
    lado === 'venda' && !coberta
      ? serie.tipo === 'call'
        ? 'Venda descoberta de call: se o ativo disparar, a perda não tem limite, e a B3 exige margem de garantia.'
        : 'Venda de put: você pode ser obrigado a comprar o ativo pelo strike mesmo que ele valha muito menos, e a B3 exige margem de garantia.'
      : null

  return (
    <>
      <div className="card col" style={{ gap: 12 }}>
        <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{nome}: {serie.codigo}</span>
          <button className="chip" onClick={aoFechar}>Fechar</button>
        </div>
        <span className="small muted">
          {rotuloTipo(serie.tipo)} de {ativo.ticker}, strike {num(serie.strike)}, vence em {formatarData(serie.vencimento)} ({diasUteis(serie.vencimento, hoje)} dias úteis).
          O preço já vem do último negócio da série e pode ser alterado.
        </span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Preço da série (prêmio)" valor={premio} onMudar={setPremio} /></div>
          <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo="Quantidade de opções" valor={quantidade} onMudar={setQuantidade} sufixo="opções" casas={0} dica={`O lote padrão de ${ativo.ticker} na B3 é de ${lote}.`} /></div>
          <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Preço do ativo hoje" valor={precoAtivo} onMudar={setPrecoAtivo} /></div>
        </div>
      </div>
      {erro || !posicao ? (
        <div className="card-outline small justify" role="status">
          <strong>Falta preencher:</strong> <span className="muted">{erro}</span>
        </div>
      ) : (
        <PainelDaPosicao posicao={posicao} precoAtivo={precoAtivo} dias={dias} titulo={nome} aviso={aviso} nota={coberta ? `Precisa ter ${quantidade.toLocaleString('pt-BR')} ações do ativo, compradas a ${reais(precoAtivo)}.` : undefined} />
      )}
    </>
  )
}
