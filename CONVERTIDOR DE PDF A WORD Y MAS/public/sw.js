const CACHE_NAME = 'convertidorpro-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/converters.js',
  '/manifest.json',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first for API and convert endpoints, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // API and conversion endpoints always go to network
  if (request.url.includes('/api/') || request.url.includes('/convert/') || request.url.includes('/health')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'Sin conexión' }), { headers: { 'Content-Type': 'application/json' } })));
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
