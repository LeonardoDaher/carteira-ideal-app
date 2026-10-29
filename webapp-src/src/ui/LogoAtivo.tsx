/**
 * Logo da empresa na frente do código. As imagens ficam em public/logos/<RAIZ>.png, com a raiz de quatro letras do código
 * (PETR4 → PETR.png), e saem do próprio site, em arquivos separados e carregados só quando a linha aparece (D133). Elas NÃO são
 * importadas no código: o app é um arquivo único e importar embutiria todas em base64 dentro da página. A lista de nomes vem do
 * vite.config.ts (__LOGOS__). Sem a imagem, aparece um selo com as iniciais (desenhadas por CSS, para não entrarem no texto da
 * linha), para a linha não ficar torta.
 */
declare const __LOGOS__: string[]

const POR_RAIZ: Record<string, string> = {}
for (const arquivo of __LOGOS__) {
  const raiz = /^([A-Z0-9]+)\.[a-z]+$/.exec(arquivo)?.[1]
  if (raiz) POR_RAIZ[raiz] = `./logos/${arquivo}`
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
