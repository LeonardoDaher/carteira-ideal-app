/**
 * Logo da empresa na frente do código. As imagens ficam em public/logos/<RAIZ>.png, com a raiz de quatro letras do código
 * (PETR4 → PETR.png), e saem do próprio site, em arquivos separados e carregados só quando a linha aparece (D133). Elas NÃO são
 * importadas no código: o app é um arquivo único e importar embutiria todas em base64 dentro da página. A lista de nomes vem do
 * vite.config.ts (__LOGOS__). Sem a imagem, aparece um quadrado do mesmo
 * tamanho com dois candles cinzas (dois prédios, se for um FII), para a linha não ficar torta.
 */
import { CATALOGO_ATIVOS } from '../data/catalogoAtivos'

declare const __LOGOS__: string[]

const POR_RAIZ: Record<string, string> = {}
for (const arquivo of __LOGOS__) {
  const raiz = /^([A-Z0-9]+)\.[a-z]+$/.exec(arquivo)?.[1]
  if (raiz) POR_RAIZ[raiz] = `./logos/${arquivo}`
}

/** `inline`: vai no meio do texto, antes do código. */
export function LogoAtivo({ ticker, tamanho = 36, inline = false }: { ticker: string; tamanho?: number; inline?: boolean }) {
  const raiz = ticker.slice(0, 4).toUpperCase()
  // BDRs têm o logo pelo código inteiro (AAPL34.png); ações, pela raiz de quatro letras (PETR.png).
  const url = POR_RAIZ[ticker.toUpperCase()] ?? POR_RAIZ[raiz]
  const caixa = { width: tamanho, height: tamanho, borderRadius: 8, flex: '0 0 auto', ...(inline ? { verticalAlign: 'middle', marginRight: 6 } : {}) } as const
  if (url) return <img src={url} alt="" width={tamanho} height={tamanho} loading="lazy" style={{ ...caixa, objectFit: 'contain', background: '#fff' }} data-testid="logo-ativo" />
  // Sem logo: um quadrado do mesmo tamanho com dois candles cinzas, ou dois prédios se for um FII.
  const props = { 'aria-hidden': true, width: tamanho, height: tamanho, viewBox: '0 0 36 36', style: { ...caixa, display: inline ? 'inline-block' : 'block' } } as const
  if (CATALOGO_ATIVOS.fiis.has(ticker.toUpperCase())) {
    return (
      <svg {...props} data-testid="logo-ativo-padrao-fii">
        <rect width="36" height="36" rx="8" fill="#8b919c" fillOpacity="0.22" />
        <rect x="7" y="12" width="11" height="17" rx="1.5" fill="#8b919c" />
        <rect x="20" y="7" width="9" height="22" rx="1.5" fill="#8b919c" />
        <g fill="#2b2f38">
          <rect x="9.5" y="15" width="2.5" height="2.5" />
          <rect x="13" y="15" width="2.5" height="2.5" />
          <rect x="9.5" y="20" width="2.5" height="2.5" />
          <rect x="13" y="20" width="2.5" height="2.5" />
          <rect x="22.3" y="10.5" width="2" height="2.5" />
          <rect x="25.3" y="10.5" width="2" height="2.5" />
          <rect x="22.3" y="16" width="2" height="2.5" />
          <rect x="25.3" y="16" width="2" height="2.5" />
          <rect x="22.3" y="21.5" width="2" height="2.5" />
          <rect x="25.3" y="21.5" width="2" height="2.5" />
        </g>
      </svg>
    )
  }
  return (
    <svg {...props} data-testid="logo-ativo-padrao">
      <rect width="36" height="36" rx="8" fill="#8b919c" fillOpacity="0.22" />
      <g stroke="#8b919c" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="8" x2="12" y2="28" />
        <line x1="24" y1="10" x2="24" y2="26" />
      </g>
      <rect x="9" y="13" width="6" height="10" rx="1.5" fill="#8b919c" />
      <rect x="21" y="14" width="6" height="8" rx="1.5" fill="#8b919c" />
    </svg>
  )
}
