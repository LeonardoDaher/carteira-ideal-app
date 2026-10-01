import type { AppCtx } from '../state/useAppState'
import { LoaderIcon } from './Icon'
import { TabBar } from './TabBar'

/**
 * O que mostrar numa tela que depende da carteira sugerida (Resultado, Carteira, Simulador) quando o
 * `resultado` ainda não existe. São TRÊS situações diferentes, e confundi-las era o bug do "piscar":
 *
 *  1. A pessoa JÁ respondeu tudo e a carteira está sendo calculada no servidor (ao reabrir o app, ou
 *     depois de tocar em "Tentar novamente"): mostra "Montando sua carteira sugerida", nunca o convite
 *     para responder o questionário, que seria falso.
 *  2. O cálculo FALHOU: diz isso e oferece "Tentar novamente", em vez de mandar a pessoa refazer o teste.
 *  3. A pessoa NUNCA respondeu: aí sim, o convite.
 *
 * Nos casos 1 e 2 a barra de abas continua visível, para a tela não "pular" quando o resultado chega.
 */
export function SemResultado({ ctx, convite, comBotaoComecar = false }: { ctx: AppCtx; convite: string; comBotaoComecar?: boolean }) {
  if (ctx.erroResultado) {
    return (
      <div className="screen">
        <div className="grow col" role="alert" style={{ justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Não conseguimos calcular sua carteira agora</div>
          <div className="muted small">{ctx.erroResultado}</div>
          <button className="btn btn-primary" onClick={ctx.tentarCalcularNovamente}>
            Tentar novamente
          </button>
        </div>
        <TabBar ctx={ctx} />
      </div>
    )
  }

  if (ctx.resultadoPendente) {
    return (
      <div className="screen">
        <div className="grow col" role="status" aria-live="polite" style={{ justifyContent: 'center', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)', animation: 'spin 1.1s linear infinite' }}>
            <LoaderIcon size={28} />
          </span>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontWeight: 700 }}>Montando sua carteira sugerida…</div>
          <div className="muted small">Só um instante.</div>
        </div>
        <TabBar ctx={ctx} />
      </div>
    )
  }

  return (
    <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="muted small">{convite}</div>
      {comBotaoComecar && (
        <button className="btn btn-primary" onClick={ctx.iniciarQuestionario}>
          Começar
        </button>
      )}
    </div>
  )
}
