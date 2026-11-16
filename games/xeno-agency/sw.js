const CACHE_NAME = "xeno-agency-static-v15-mz2";

// Everything the game needs to run offline. Small on purpose: install succeeds or fails
// as a whole, and a 15 MB list on a phone connection mostly failed.
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/apple-touch-icon.png"
];

// Artwork: fetched after the core, one file at a time, so one slow image can't sink
// the install. Anything missed here is still cached the first time the game shows it.
const ART = [
  "./xeno-agency-logo.webp",
  "./xeno-interior-key-art.webp",
  "./xeno-world-map-concept.webp",
  "./assets/icons/icon-512.png",
  ...Array.from({ length: 12 }, (_, i) => `./assets/portraits/alien-${String(i + 1).padStart(2, "0")}.webp`)
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE);
      await Promise.all(ART.map((url) => cache.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("xeno-agency-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response && response.ok && sameOrigin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
