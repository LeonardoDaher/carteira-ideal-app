import { VoltarInicio } from '../ui/VoltarInicio'
import { ChevronDownIcon } from '../ui/Icon'
import type { AppCtx } from '../state/useAppState'

/**
 * Bens que o comparativo atende: imóvel (D44), carro (D47) e moto (D48), todos no ar. Um bem que ainda não esteja pronto aparece como
 * "Em breve", sem link, para ninguém cair numa tela vazia: basta deixar `disponivel` como false e trocar para true quando ficar pronto.
 */
export const BENS: { tela: string; emoji: string; titulo: string; descricao: string; disponivel: boolean }[] = [
  { tela: 'simuleImovel', emoji: '🏠', titulo: 'Imóvel', descricao: 'Comprar à vista, financiar, consórcio ou alugar: qual rota deixa o maior patrimônio', disponivel: true },
  { tela: 'simuleCarro', emoji: '🚗', titulo: 'Carro', descricao: 'À vista, financiar, consórcio ou ficar sem carro: quanto cada caminho custa e qual deixa o maior patrimônio', disponivel: true },
  { tela: 'simuleMoto', emoji: '🏍️', titulo: 'Moto', descricao: 'À vista, financiar, consórcio ou ficar sem moto: o mesmo comparativo, com os custos de uma moto de uso pessoal', disponivel: true },
  { tela: 'suaHp12c', emoji: '🧮', titulo: 'Sua HP12C', descricao: 'Fale ou escreva qualquer problema de matemática financeira e veja a conta resolvida, com um banco de questões prontas', disponivel: true },
]

/**
 * Simule Bens (D45): página única que reúne os comparativos de rotas de acesso a um bem (imóvel, carro, moto).
 * Na landing existe só um cartão, que abre esta tela, como no Simule Ativos (D42). Tela avulsa: não depende do questionário.
 */
export function SimuleBens({ ctx }: { ctx: AppCtx }) {
  void ctx
  return (
    <div className="screen">
      <VoltarInicio />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule Bens</h1>
        <div className="muted small justify">
          Escolha o bem e compare os caminhos com o mesmo dinheiro, para ver qual termina com o maior patrimônio. É uma conta matemática: não
          indica banco, administradora de consórcio nem produto.
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {BENS.map((b) =>
          b.disponivel ? (
            <a key={b.tela} className="card-outline simule-ativos-card" href={`./?tela=${b.tela}`}>
              <span className="simule-ativos-emoji" aria-hidden="true">{b.emoji}</span>
              <span className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{b.titulo}</span>
                <span className="muted small">{b.descricao}</span>
              </span>
              <ChevronDownIcon size={16} className="simule-ativos-seta" style={{ transform: 'rotate(-90deg)' }} />
            </a>
          ) : (
            <div key={b.tela} className="card-outline simule-ativos-card simule-bens-breve" aria-disabled="true">
              <span className="simule-ativos-emoji" aria-hidden="true">{b.emoji}</span>
              <span className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{b.titulo}</span>
                <span className="muted small">{b.descricao}</span>
              </span>
              <span className="simule-bens-selo">Em breve</span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
