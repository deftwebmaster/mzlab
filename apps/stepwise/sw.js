const scope = self.registration.scope
const prefix = `stepwise-vanilla:${scope}:`
const cacheName = `${prefix}v4`
const shell = new URL('./', scope).href
const index = new URL('./index.html', scope).href
const workbook = new URL('./assets/stepwise-step4-inventory-workbook.pdf', scope).href
const assets = new Set([
  './index.html', './style.css', './manifest.webmanifest', './app.js', './db.js', './ui.js',
  './crypto.js', './prompts.js', './inventory.js', './sponsor.js', './migration.js',
  './assets/step-kits.json', './assets/icon-192.png', './assets/icon-512.png',
].map(path => new URL(path, scope).href))
assets.add(workbook)

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    [...assets].map(url => new Request(url, { cache: 'reload' })),
  )))
})

// The page asks a waiting worker to take over only after the person chooses to reload.
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName)
      .map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

async function pdfRange(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  const bytes = await response.arrayBuffer()
  const size = bytes.byteLength
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]))
  const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'application/pdf', 'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}`,
    },
  })
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  url.hash = ''
  const key = url.href === shell ? index : url.href
  if (!assets.has(key)) return
  event.respondWith((async () => {
    const cache = await caches.open(cacheName)
    const response = await cache.match(key)
    if (!response) return fetch(request)
    const range = request.headers.get('Range')
    return key === workbook && range ? pdfRange(response, range) : response
  })())
})
