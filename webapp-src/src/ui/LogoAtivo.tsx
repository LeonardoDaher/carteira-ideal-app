/**
 * Logo da empresa na frente do código. As imagens ficam em src/assets/logos/<RAIZ>.(png|svg|webp|jpg), com a raiz de quatro
 * letras do código (PETR4 → PETR.png); o Vite só inclui as que existem e elas saem do próprio site (a política de segurança só
 * aceita imagens do site). Sem a imagem, aparece um selo com as iniciais (desenhadas por CSS, para não entrarem no texto da linha), para a linha não ficar torta.
 */
const LOGOS = import.meta.glob('../assets/logos/*.{png,svg,webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const POR_RAIZ: Record<string, string> = {}
for (const [caminho, url] of Object.entries(LOGOS)) {
  const raiz = /([A-Z0-9]+)\.[a-z]+$/.exec(caminho)?.[1]
  if (raiz) POR_RAIZ[raiz] = url
}

/** Cor do selo estável por empresa (mesma raiz, mesma cor). */
function matiz(raiz: string) {
  let h = 0
  for (const c of raiz) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

/** `inline`: vai no meio do texto, antes do código. `semSelo`: sem imagem, não desenha nada (listas que misturam classes de ativo). */
export function LogoAtivo({ ticker, tamanho = 36, inline = false, semSelo = false }: { ticker: string; tamanho?: number; inline?: boolean; semSelo?: boolean }) {
  const raiz = ticker.slice(0, 4).toUpperCase()
  const url = POR_RAIZ[raiz]
  const caixa = { width: tamanho, height: tamanho, borderRadius: 8, flex: '0 0 auto', ...(inline ? { verticalAlign: 'middle', marginRight: 6 } : {}) } as const
  if (url) return <img src={url} alt="" width={tamanho} height={tamanho} loading="lazy" style={{ ...caixa, objectFit: 'contain', background: '#fff' }} data-testid="logo-ativo" />
  if (semSelo) return null
  return (
    <span
      aria-hidden="true"
      data-testid="logo-ativo-selo"
      className="logo-selo"
      data-iniciais={raiz.slice(0, 2)}
      style={{ ...caixa, fontSize: tamanho * 0.36, background: `hsl(${matiz(raiz)} 45% 38%)` }}
    />
  )
}
