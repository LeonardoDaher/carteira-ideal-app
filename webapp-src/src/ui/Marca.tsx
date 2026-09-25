/**
 * Logo do Carteira Ideal (mesmo desenho de assets/logo-mark.svg da landing) ao lado do nome.
 * Aparece só no computador (D20): no topo das telas sem menu lateral (App.tsx) e no topo do
 * menu lateral das telas com abas (TabBar.tsx). No celular fica escondida pelo CSS, para
 * não mudar nada no layout que já existia. Leva à landing, como o link "← Início".
 */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <a className={`marca ${className}`} href="../" aria-label="Carteira Ideal, voltar ao início">
      <svg className="marca-logo" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="44.6" fill="#0a0a0a" stroke="#efb70a" strokeWidth="6.8" />
        <path d="M17 67 36 48 48 60 75 33" fill="none" stroke="#efb70a" strokeWidth="6.6" strokeLinecap="butt" strokeLinejoin="miter" />
        <path d="M61 27H80V46Z" fill="#efb70a" />
      </svg>
      <span className="marca-nome">Carteira Ideal</span>
    </a>
  )
}
