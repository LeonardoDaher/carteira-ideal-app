import type { AppCtx } from '../state/useAppState'

/**
 * Ponte do resultado para o Meu Mês (D21, Etapa 4). Aparece só para quem respondeu [A] no
 * Pilar 2 (dívida cara) ou, sem isso, [A] no Pilar 1 (reserva de menos de 3 meses): são as
 * duas respostas que o Meu Mês ajuda a mudar. Quem respondeu diferente não vê nada, e o
 * investidor que chega pela bio segue sem conteúdo de dívida pelo caminho.
 */
export function PonteMeuMes({ ctx }: { ctx: AppCtx }) {
  const { passivoDividas, capacidadeFinanceira } = ctx.respostasArquitetura
  const dividaCara = passivoDividas === 'a'
  if (!dividaCara && capacidadeFinanceira !== 'a') return null

  return (
    <div className="card-outline col ponte-meu-mes area-ponte">
      <div style={{ fontWeight: 700, fontSize: 13.5 }}>
        {dividaCara ? 'Antes de investir: a dívida cara' : 'Antes de investir: a reserva'}
      </div>
      <div className="muted small justify" style={{ lineHeight: 1.5 }}>
        {dividaCara
          ? 'Nenhum investimento seguro rende o que o cartão, o cheque especial ou o empréstimo pessoal cobram. O Meu Mês monta um plano para quitar as dívidas caras, com uma mini-reserva antes, e mostra quando você volta a investir.'
          : 'Com menos de 3 meses de reserva, qualquer imprevisto pode virar dívida. O Meu Mês mostra quanto sobra a cada salário e quanto guardar até completar a reserva.'}
      </div>
      <button className="btn btn-outline" onClick={() => ctx.setScreen('meuMes')}>
        Abrir o Meu Mês
      </button>
      <div className="tiny muted">Grátis, sem cadastro. Seus números ficam só neste aparelho.</div>
    </div>
  )
}
