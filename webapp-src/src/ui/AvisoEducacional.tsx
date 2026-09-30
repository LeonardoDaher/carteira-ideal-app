/**
 * Aviso padrão de conteúdo educacional. Usado nas telas que mostram perfil, carteira de
 * referência ou valores simulados, para que o caráter educacional apareça em todo ponto em
 * que o usuário vê percentuais — e não só na tela inicial.
 *
 * - `completo`: tela inicial (onboarding), com a declaração completa.
 * - `curto`: telas de resultado, carteira e simulador.
 */
export function AvisoEducacional({ variante = 'curto' }: { variante?: 'completo' | 'curto' }) {
  if (variante === 'completo') {
    return (
      <div className="card small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Conteúdo educacional.</strong> Este app não é recomendação de investimento nem
        consultoria. As carteiras mostradas são exemplos de referência, geradas por regras
        automáticas a partir das suas respostas. Rentabilidade passada não garante rentabilidade
        futura.
      </div>
    )
  }

  return (
    <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
      <strong>Exemplo educacional, não é recomendação de investimento.</strong> Rentabilidade
      passada não garante rentabilidade futura, e produtos de renda variável (ações, FIIs, BDRs)
      podem oscilar bastante no curto prazo. Converse com um profissional certificado antes de
      investir.
    </div>
  )
}
