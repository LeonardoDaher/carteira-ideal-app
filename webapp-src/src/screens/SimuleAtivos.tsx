import { VoltarInicio } from '../ui/VoltarInicio'
import { ChevronDownIcon } from '../ui/Icon'
import type { AppCtx } from '../state/useAppState'

/** Simuladores reunidos no hub. Cada um é aberto por ?tela=, o mesmo endereço que a landing usava. */
export const SIMULADORES: { tela: string; emoji: string; titulo: string; descricao: string }[] = [
  { tela: 'simuleAcoes', emoji: '📊', titulo: 'Simule Ações', descricao: 'Empresas de todos os setores da B3: quantas há em cada um e quantas ações um valor compra' },
  { tela: 'simuleOpcoes', emoji: '🎯', titulo: 'Simule Opções', descricao: 'Calls e puts reais da B3: compra e venda, travas, THL, roda e rolagem, com o resultado de cada estratégia' },
  { tela: 'simuleFii', emoji: '🏢', titulo: 'Simule FII', descricao: 'Quanto rendem as cotas dos maiores FIIs do IFIX' },
  { tela: 'simuleTesouro', emoji: '🏛️', titulo: 'Simule Tesouro Direto', descricao: 'Quanto cada título rende até o vencimento, já com IR' },
  { tela: 'simuleBdr', emoji: '🌎', titulo: 'Simule BDR', descricao: 'Os BDRs mais negociados na B3, por setor' },
  { tela: 'simuleEtf', emoji: '🧺', titulo: 'Simule ETF', descricao: 'Os ETFs mais negociados na B3, por categoria' },
]

/**
 * Simule Ativos (D42): página única que reúne os simuladores. Na landing existe só um cartão,
 * "Simule Ativos", que abre esta tela. Tela avulsa: não depende do questionário.
 */
export function SimuleAtivos({ ctx }: { ctx: AppCtx }) {
  void ctx
  return (
    <div className="screen">
      <VoltarInicio />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule Ativos</h1>
        <div className="muted small justify">
          Escolha o tipo de ativo e veja, com dados oficiais, quanto um valor compra e quanto ele pode render.
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {SIMULADORES.map((s) => (
          <a key={s.tela} className="card-outline simule-ativos-card" href={`./?tela=${s.tela}`}>
            <span className="simule-ativos-emoji" aria-hidden="true">{s.emoji}</span>
            <span className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{s.titulo}</span>
              <span className="muted small">{s.descricao}</span>
            </span>
            <ChevronDownIcon size={16} className="simule-ativos-seta" style={{ transform: 'rotate(-90deg)' }} />
          </a>
        ))}
      </div>
    </div>
  )
}
