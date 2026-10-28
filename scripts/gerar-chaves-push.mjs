// Gera o par de chaves VAPID dos avisos com o app fechado (D127). Rode UMA vez, no seu computador:
//   npm run gerar-chaves-push
// e copie os valores impressos para os lugares indicados. A chave PRIVADA não pode ir para o repositório, nem para o chat, nem para a
// Vercel: ela fica só nos secrets do GitHub. Gerar de novo invalida os avisos já ligados (cada aparelho teria que ligar de novo).
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`
Chaves geradas. Guarde a privada só nos secrets do GitHub.

1) Vercel (Settings > Environment Variables, ambientes Production e Preview):
   VAPID_PUBLIC_KEY = ${publicKey}

2) GitHub (Settings > Secrets and variables > Actions > New repository secret):
   VAPID_PUBLIC_KEY  = ${publicKey}
   VAPID_PRIVATE_KEY = ${privateKey}
   VAPID_SUBJECT     = mailto:SEU-EMAIL@exemplo.com   (um e-mail seu de contato; o serviço de push usa para falar com você se houver problema)
   UPSTASH_REDIS_REST_URL   = (o mesmo valor que já existe na Vercel)
   UPSTASH_REDIS_REST_TOKEN = (o mesmo valor que já existe na Vercel)

3) Depois de salvar, faça um novo deploy na Vercel (para ela enxergar a variável).
`)
