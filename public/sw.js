const CACHE_NAME = 'daily-task-board-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/site.webmanifest',
        '/favicon.ico',
        '/favicon-32x32.png',
        '/favicon-16x16.png',
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png',
      ]),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
          return Promise.resolve()
        }),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const request = event.request
  const isDocument = request.mode === 'navigate'
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) {
          return cached
        }

        if (isDocument) {
          return caches.match('/')
        }

        throw new Error('Network unavailable')
      }),
  )
})
