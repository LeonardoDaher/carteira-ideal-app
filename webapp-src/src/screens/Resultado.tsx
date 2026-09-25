import { carteiraParaExibicao } from '../data/carteiraVisual'
import { AllocLegend, PieChart } from '../ui/AllocBar'
import { TabBar } from '../ui/TabBar'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import type { AppCtx } from '../state/useAppState'

const DESCRICAO_PERFIL: Record<string, string> = {
  Conservador:
    'Você prioriza segurança e previsibilidade. Uma carteira para esse perfil foca em preservar capital, com pouca ou nenhuma exposição a oscilações fortes.',
  Moderado:
    'Você aceita alguma oscilação em troca de um retorno melhor que a renda fixa pura, mas sem abrir mão de uma base de segurança.',
  Arrojado:
    'Você tolera bem as oscilações de curto prazo em busca de um retorno maior no longo prazo, com maior peso em renda variável.',
}

const DESCRICAO_PATRIMONIAL: Record<string, string> = {
  Defensivo:
    'Sua vida financeira real (reserva, dívidas e liquidez de curto prazo) pede prioridade para caixa e proteção — mesmo que o teste de suitability sozinho apontasse mais risco.',
  Equilibrado:
    'Sua capacidade real permite uma parcela de risco, equilibrada com renda e proteção — sem abrir mão da segurança para os compromissos dos próximos anos.',
  'Crescimento Pleno':
    'Sua capacidade real e o suitability caminham juntos: reserva sólida, sem dívida cara e sem saques previstos. Uma carteira de referência para esse perfil pode priorizar acúmulo de longo prazo.',
}

/** Remove espaços do nome do perfil para usar como classe CSS (ex: "Crescimento Pleno" → "CrescimentoPleno"). */
function classePerfil(perfil: string) {
  return perfil.replace(/\s+/g, '')
}

/** Remove o número de ordem na frente do nome do Perfil Final da Carteira para exibição
 * (ex: "9. Arrojado Pleno / Global" → "Arrojado Pleno / Global"). O número continua
 * existindo no dado interno (PerfilFinalCarteira), só não aparece na tela. */
function semNumero(nomePerfil: string) {
  return nomePerfil.replace(/^\d+\.\s*/, '')
}

export function Resultado({ ctx }: { ctx: AppCtx }) {
  const resultado = ctx.resultado

  if (!resultado) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="muted small">Responda o questionário para ver seu resultado.</div>
        <button className="btn btn-primary" onClick={ctx.iniciarQuestionario}>Começar</button>
      </div>
    )
  }

  const foiAjustado = resultado.perfilBase !== resultado.perfilFinal
  const perfilPatrimonial = resultado.perfilPatrimonial
  // O nome exibido ao cliente é sempre o Perfil Final da Carteira (1 a 9, cruzamento de
  // suitability x Vetor da Arquitetura Patrimonial) — nunca o Perfil Patrimonial sozinho
  // (Defensivo/Equilibrado/Crescimento Pleno), que é apenas um dos dois eixos usados para
  // chegar até aqui.
  const nomePerfilExibido = resultado.perfilFinalCarteira ?? perfilPatrimonial ?? resultado.perfilFinal

  return (
    <div className="screen">
      {/* desk-grid: no celular é invisível (display: contents) e tudo segue em coluna; no
          computador vira grade com o perfil à esquerda e o gráfico fixo à direita (D20). */}
      <div className="desk-grid grade-resultado">
      <div className="col area-cabecalho" style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <div className="small muted" style={{ fontSize: 14, fontWeight: 700 }}>
          {resultado.perfilFinalCarteira ? 'Seu perfil de carteira de referência é' : perfilPatrimonial ? 'Seu perfil da Arquitetura Patrimonial é' : 'Seu perfil de investidor é'}
        </div>
        <div
          className={`perfil-badge ${classePerfil(perfilPatrimonial ?? resultado.perfilFinal)}`}
          style={{ fontSize: 16, padding: '8px 20px', textAlign: 'center' }}
        >
          {semNumero(nomePerfilExibido)}
        </div>
        {perfilPatrimonial ? (
          <div className="small muted" style={{ textAlign: 'center' }}>
            Suitability: {resultado.perfilFinal} · Capacidade real: {resultado.capacidadeReal} (score {resultado.scoreArquitetura}/21)
            {resultado.vetoAplicado ? ' · Regra de veto aplicada' : ''}
          </div>
        ) : (
          foiAjustado && (
            <div className="small muted" style={{ textAlign: 'center' }}>
              (calculamos {resultado.perfilBase}, mas ajustamos por segurança — veja os detalhes abaixo)
            </div>
          )
        )}
      </div>

      <div className="card small justify area-descricao" style={{ lineHeight: 1.5 }}>
        {perfilPatrimonial ? DESCRICAO_PATRIMONIAL[perfilPatrimonial] : DESCRICAO_PERFIL[resultado.perfilFinal]}
      </div>

      <div className="col area-grafico" style={{ gap: 10, marginTop: 4 }}>
        <div className="row-between">
          <span style={{ fontWeight: 700, fontSize: 14 }}>Carteira de referência</span>
          <span className="muted small">Prazo {resultado.prazo === 'curto' ? 'curto' : resultado.prazo === 'medio' ? 'médio' : 'longo'}</span>
        </div>
        <div style={{ padding: '4px 0 8px' }}>
          <PieChart carteira={carteiraParaExibicao(resultado.carteira)} onSlicePress={ctx.abrirDetalheAtivo} />
        </div>
        <div className="muted tiny" style={{ textAlign: 'center' }}>
          <span className="so-toque">Toque</span><span className="so-mouse">Clique</span> numa fatia ou num item da lista para ver a análise detalhada
        </div>
        <AllocLegend carteira={carteiraParaExibicao(resultado.carteira)} onItemPress={ctx.abrirDetalheAtivo} />
      </div>

      <div className="area-aviso"><AvisoEducacional /></div>

      {resultado.alertas.length > 0 && (
        <div className="card-outline col area-alertas" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Por que esse exemplo?</div>
          {resultado.alertas.map((alerta, i) => (
            <div key={i} className="muted tiny justify" style={{ lineHeight: 1.4 }}>• {alerta}</div>
          ))}
        </div>
      )}

      <button className="btn btn-primary area-acao" onClick={ctx.limparDados}>
        Refazer o questionário
      </button>
      </div>

      <div className="grow" />
      <TabBar ctx={ctx} />
    </div>
  )
}
