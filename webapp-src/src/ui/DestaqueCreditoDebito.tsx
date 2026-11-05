import { reais } from '../domain/mercadoOficial'

/**
 * Destaque do dinheiro que entra (crédito) ou sai (débito) ao montar as opções. É a informação mais importante da
 * montagem, por isso aparece grande e igual em todas as estratégias: no card das pernas e no card do resultado.
 * `custo` vem de custoDeMontagem: positivo = crédito (recebe), negativo = débito (paga).
 */
export function DestaqueCreditoDebito({ custo, rotulo = 'ao montar as opções', nota, testid }: {
  custo: number
  /** Complemento do título: "Crédito {rotulo}:" / "Débito {rotulo}:". */
  rotulo?: string
  /** Texto extra (ex.: ações necessárias na venda coberta). */
  nota?: string
  testid?: string
}) {
  const nulo = Math.abs(custo) < 0.005
  const credito = custo >= 0
  const cor = nulo ? 'var(--text)' : credito ? 'var(--success)' : 'var(--danger)'
  return (
    <div
      className="col"
      data-testid={testid}
      style={{
        gap: 4,
        padding: '14px 16px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${cor} 14%, var(--surface2))`,
        border: `1.5px solid color-mix(in oklch, ${cor} 55%, transparent)`,
      }}
    >
      <div className="small" style={{ fontWeight: 700 }}>{nulo ? 'Sem crédito nem débito' : credito ? 'Crédito' : 'Débito'} {rotulo}:</div>
      <strong style={{ fontSize: 30, lineHeight: 1.1, color: cor }} data-testid={testid ? `${testid}-valor` : undefined}>
        {reais(Math.abs(custo))}
      </strong>
      <span className="small muted">
        {nulo ? 'Montar essas opções não move dinheiro.' : credito ? 'Você recebe o prêmio.' : 'Você paga o prêmio.'}
        {nota ? ` ${nota}` : ''}
      </span>
    </div>
  )
}
