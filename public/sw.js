/// <reference lib="webworker" />

const CACHE_VERSION = 'forexai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// Cache TTL settings (in milliseconds)
const API_CACHE_TTL = 30000;      // 30 seconds for API responses
const DYNAMIC_CACHE_TTL = 86400000; // 24 hours for dynamic content

// Install event: pre-cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('forexai-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: check if a response has expired
function isExpired(response, ttl) {
  const dateHeader = response.headers.get('sw-cache-timestamp');
  if (!dateHeader) return false;
  const cachedAt = parseInt(dateHeader, 10);
  return Date.now() - cachedAt > ttl;
}

// Helper: add timestamp header to a cloned response for TTL tracking
function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-timestamp', Date.now().toString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Fetch event: route requests to appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except for fonts and known CDNs
  if (url.origin !== self.location.origin) {
    // Allow Google Fonts and known CDN requests through network
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(
        caches.open(DYNAMIC_CACHE).then((cache) => {
          return cache.match(request).then((cached) => {
            if (cached && !isExpired(cached, DYNAMIC_CACHE_TTL)) {
              return cached;
            }
            return fetch(request).then((response) => {
              if (response.ok) {
                const stamped = stampResponse(response.clone());
                cache.put(request, stamped);
              }
              return response;
            }).catch(() => cached || new Response('Offline', { status: 503 }));
          });
        })
      );
    }
    return;
  }

  // API requests: network-first strategy with short cache TTL
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, API_CACHE_TTL));
    return;
  }

  // Static assets (JS, CSS, images): cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (HTML pages): network-first with cache fallback
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, DYNAMIC_CACHE_TTL));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE, DYNAMIC_CACHE_TTL));
});

// Cache-first strategy: serve from cache, fallback to network
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached, but update cache in background (stale-while-revalidate)
    const fetchPromise = fetch(request).then((response) => {
      if (response.ok) {
        const stamped = stampResponse(response.clone());
        cache.put(request, stamped);
      }
      return response;
    }).catch(() => cached);

    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const stamped = stampResponse(response.clone());
      cache.put(request, stamped);
    }
    return response;
  } catch {
    return new Response('Offline - Recurso não disponível', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

// Network-first strategy: try network, fallback to cache
async function networkFirstWithCache(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const stamped = stampResponse(response.clone());
      cache.put(request, stamped);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      // Return cached even if expired (better stale than offline)
      return cached;
    }
    // For navigation requests, return a simple offline page
    if (request.mode === 'navigate') {
      return new Response(
        `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ForexAI Pro - Offline</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
    .container{padding:2rem;max-width:400px}
    h1{color:#06b6d4;margin-bottom:0.5rem}
    p{color:#94a3b8;line-height:1.6}
    button{margin-top:1.5rem;padding:0.75rem 2rem;background:#06b6d4;color:#0f172a;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
    button:hover{background:#0891b2}
  </style>
</head>
<body>
  <div class="container">
    <h1>📡 Sem Conexão</h1>
    <p>O ForexAI Pro precisa de internet para funcionar. Verifique sua conexão e tente novamente.</p>
    <button onclick="window.location.reload()">Tentar Novamente</button>
  </div>
</body>
</html>`,
        {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Helper: determine if a URL path points to a static asset
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.ttf')
  );
}
