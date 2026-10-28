// Service worker do Carteira Ideal (D127). Faz UMA coisa: receber o aviso de preço teto com o app fechado e mostrá-lo.
// Não guarda nada em cache e não intercepta pedidos (não tem "fetch"): o app continua carregando exatamente como antes.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = {}
  }
  const titulo = typeof d.titulo === 'string' && d.titulo ? d.titulo : 'Carteira Ideal'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof d.corpo === 'string' ? d.corpo : '',
      tag: typeof d.tag === 'string' && d.tag ? d.tag : 'preco-teto',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: typeof d.url === 'string' ? d.url : './?tela=simuleAcoes' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const alvo = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.registration.scope) && 'focus' in j) return j.focus()
      }
      return self.clients.openWindow(alvo)
    }),
  )
})
