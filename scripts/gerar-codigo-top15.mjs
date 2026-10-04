// Gera o código mensal de acesso ao Top 15 (D50):  npm run codigo-top15   (ou:  node scripts/gerar-codigo-top15.mjs 2)
//
// Formato CI-XXXX-XXXX com 8 caracteres sorteados de 24 símbolos, sem os que se confundem (0/O, 1/I/L,
// 2/Z, 5/S, 8/B): 24^8 ≈ 1,1 × 10^11 combinações (~36,7 bits). Com o limite de 10 tentativas erradas
// por IP a cada 15 minutos, adivinhar levaria séculos mesmo com milhares de IPs. Sorteio criptográfico.
//
// O código NÃO é guardado em lugar nenhum por este script. Copie-o para a variável TOP15_CODIGOS na
// Vercel (Settings → Environment Variables) e divulgue no Instagram. Nunca o coloque no repositório.
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

export const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY3469'

export function gerarCodigo(sorteio = crypto.randomInt) {
  const sorteados = Array.from({ length: 8 }, () => ALFABETO[sorteio(ALFABETO.length)])
  return `CI-${sorteados.slice(0, 4).join('')}-${sorteados.slice(4).join('')}`
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const quantidade = Math.min(Math.max(Number(process.argv[2]) || 1, 1), 5)
  for (let i = 0; i < quantidade; i++) console.log(gerarCodigo())
}
