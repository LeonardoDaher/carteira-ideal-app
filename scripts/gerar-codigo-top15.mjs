// Gera o código mensal de acesso ao Top 15 (D50):  npm run codigo-top15   (ou:  node scripts/gerar-codigo-top15.mjs 2)
//
// Um código por classe de ativos (D66): o das ações vai em TOP15_CODIGOS, o dos FIIs em TOP15_FIIS_CODIGOS.
// Rode uma vez para cada classe (cada execução sorteia códigos novos e independentes):
//   npm run codigo-top15 -- --classe acoes     (lembra onde colocar: TOP15_CODIGOS)
//   npm run codigo-top15 -- --classe fiis      (lembra onde colocar: TOP15_FIIS_CODIGOS)
//
// Formato CI-XXXX-XXXX com 8 caracteres sorteados de 24 símbolos, sem os que se confundem (0/O, 1/I/L,
// 2/Z, 5/S, 8/B): 24^8 ≈ 1,1 × 10^11 combinações (~36,7 bits). Com o limite de 10 tentativas erradas
// por IP a cada 15 minutos, adivinhar levaria séculos mesmo com milhares de IPs. Sorteio criptográfico.
//
// O código NÃO é guardado em lugar nenhum por este script. Copie-o para a variável da classe na
// Vercel (Settings → Environment Variables) e divulgue no Instagram. Nunca o coloque no repositório.
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY3469'

export function gerarCodigo(sorteio = crypto.randomInt) {
  const sorteados = Array.from({ length: 8 }, () => ALFABETO[sorteio(ALFABETO.length)])
  return `CI-${sorteados.slice(0, 4).join('')}-${sorteados.slice(4).join('')}`
}

export const VARIAVEL_POR_CLASSE = { acoes: 'TOP15_CODIGOS', fiis: 'TOP15_FIIS_CODIGOS' }

/** Lê "--classe acoes|fiis" e a quantidade (1 a 5). Sem --classe, não indica variável (comportamento antigo). */
export function lerArgumentos(argv) {
  const i = argv.indexOf('--classe')
  const classe = i >= 0 ? argv[i + 1] : undefined
  if (i >= 0 && !Object.hasOwn(VARIAVEL_POR_CLASSE, classe)) throw new Error('Classe inválida. Use --classe acoes ou --classe fiis.')
  const numeros = argv.filter((a, k) => !a.startsWith('--') && argv[k - 1] !== '--classe')
  return { classe, quantidade: Math.min(Math.max(Number(numeros[0]) || 1, 1), 5) }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { classe, quantidade } = lerArgumentos(process.argv.slice(2))
    for (let i = 0; i < quantidade; i++) console.log(gerarCodigo())
    if (classe) console.error(`Coloque na variável ${VARIAVEL_POR_CLASSE[classe]} da Vercel. NÃO use este código em outra classe.`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
