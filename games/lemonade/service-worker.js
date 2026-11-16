// Bump this on every deploy that changes cached assets so clients pick up the
// new cache and are offered the update prompt instead of silently swapping.
const CACHE_VERSION = 'lemonade-empire-v2-mz2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Every stylesheet and module, not just the entry point: app.js imports ~80 files,
// and on a first visit they are all fetched before this worker controls the page, so
// without listing them here the game could not start offline until a second online visit.
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './css/animations.css',
  './css/components.css',
  './css/layout.css',
  './css/reset.css',
  './css/screens.css',
  './css/variables.css',
  './js/app.js',
  './js/components/bottom-nav.js',
  './js/components/bottom-sheet.js',
  './js/components/brand-scenes.js',
  './js/components/confirm-dialog.js',
  './js/components/currency-display.js',
  './js/components/modal.js',
  './js/components/progress-bar.js',
  './js/components/stat-card.js',
  './js/components/toast.js',
  './js/components/tutorial-banner.js',
  './js/data/achievements.js',
  './js/data/bottles.js',
  './js/data/competitors.js',
  './js/data/contracts.js',
  './js/data/employees.js',
  './js/data/events.js',
  './js/data/ingredients.js',
  './js/data/locations.js',
  './js/data/marketing.js',
  './js/data/milestones.js',
  './js/data/recipes.js',
  './js/data/suppliers.js',
  './js/data/upgrades.js',
  './js/router.js',
  './js/screens/achievements-screen.js',
  './js/screens/business-screen.js',
  './js/screens/financing-screen.js',
  './js/screens/live-day-screen.js',
  './js/screens/locations-screen.js',
  './js/screens/marketing-screen.js',
  './js/screens/more-screen.js',
  './js/screens/new-game-screen.js',
  './js/screens/recipe-screen.js',
  './js/screens/reports-screen.js',
  './js/screens/results-screen.js',
  './js/screens/settings-screen.js',
  './js/screens/splash-screen.js',
  './js/screens/staff-screen.js',
  './js/screens/stand-screen.js',
  './js/screens/supplies-screen.js',
  './js/screens/upgrades-screen.js',
  './js/screens/wholesale-screen.js',
  './js/simulation/competitor-model.js',
  './js/simulation/customer-model.js',
  './js/simulation/day-simulator.js',
  './js/simulation/demand-model.js',
  './js/simulation/economy-model.js',
  './js/simulation/event-model.js',
  './js/simulation/weather-model.js',
  './js/state/default-state.js',
  './js/state/game-store.js',
  './js/state/migrations.js',
  './js/state/save-manager.js',
  './js/systems/achievement-system.js',
  './js/systems/audio-system.js',
  './js/systems/briefing-system.js',
  './js/systems/day-cycle-system.js',
  './js/systems/employee-system.js',
  './js/systems/finance-system.js',
  './js/systems/inventory-system.js',
  './js/systems/location-system.js',
  './js/systems/marketing-system.js',
  './js/systems/notification-system.js',
  './js/systems/progression-system.js',
  './js/systems/recipe-system.js',
  './js/systems/tutorial-system.js',
  './js/systems/upgrade-system.js',
  './js/systems/wholesale-system.js',
  './js/utils/constants.js',
  './js/utils/format.js',
  './js/utils/math.js',
  './js/utils/random.js',
  './js/utils/validation.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('lemonade-empire-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (err) {
        return cached || Response.error();
      }
    })()
  );
});
