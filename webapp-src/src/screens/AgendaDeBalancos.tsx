import { useMemo, useState } from 'react'
import { useArquivoDados } from '../data/useArquivoDados'
import { hojeEmBrasilia, itensDoRadar } from '../domain/balancos'
import type { SnapshotBalancos } from '../domain/balancos'
import { EstadoDoArquivo } from '../ui/BlocosDeAnalise'
import { AnaliseBalancos } from './AnaliseBalancos'
import { RadarBalancos } from './RadarBalancos'

export const CAMINHO_BALANCOS = 'dados/balancos.json'

type Visao = 'radar' | 'analise'

const CARTOES: { id: Visao; emoji: string; titulo: string; descricao: string }[] = [
  { id: 'radar', emoji: '🗓️', titulo: 'Radar de balanços', descricao: 'Quando cada empresa divulga' },
  { id: 'analise', emoji: '🔎', titulo: 'Análise dos balanços', descricao: 'O que a empresa reportou' },
]

/** Aba "Balanços" do Simule Ações: o radar das datas de divulgação e a análise do balanço divulgado (comparação dos últimos trimestres). */
export function AgendaDeBalancos({ snapshot, hoje }: { snapshot?: SnapshotBalancos; hoje?: string }) {
  const [visao, setVisao] = useState<Visao>('radar')
  const [ticker, setTicker] = useState<string | null>(null)
  const [estado, recarregar] = useArquivoDados<SnapshotBalancos>(CAMINHO_BALANCOS, true, snapshot)
  const dia = hoje ?? hojeEmBrasilia()
  const dados = estado.tipo === 'pronto' ? estado.dados : null
  const itens = useMemo(() => (dados ? itensDoRadar(dados, dia) : []), [dados, dia])

  const analisar = (t: string | null) => {
    setTicker(t)
    setVisao('analise')
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div role="tablist" aria-label="Radar ou análise" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {CARTOES.map((c) => (
          <button
            key={c.id}
            role="tab"
            id={`aba-balancos-${c.id}`}
            aria-selected={visao === c.id}
            aria-controls="painel-balancos"
            className={`vehicle-card ${visao === c.id ? 'selected' : ''}`}
            onClick={() => setVisao(c.id)}
          >
            <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</span>
            <span style={{ fontSize: 14 }}>{c.titulo}</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{c.descricao}</span>
          </button>
        ))}
      </div>
      <div id="painel-balancos" role="tabpanel" aria-labelledby={`aba-balancos-${visao}`}>
        {!dados ? (
          <EstadoDoArquivo estado={estado.tipo === 'pronto' ? 'ocioso' : estado.tipo} aoTentarDeNovo={recarregar} nome="os balanços da CVM" />
        ) : visao === 'radar' ? (
          <RadarBalancos itens={itens} hoje={dia} dataCorte={dados.dataCorte} aoAnalisar={analisar} />
        ) : (
          <AnaliseBalancos snapshot={dados} itens={itens} ticker={ticker} hoje={dia} aoEscolher={setTicker} />
        )}
      </div>
    </div>
  )
}
