// ═══════════════════════════════════════════
// WearAura — Service Worker
// Stratégie : Cache-first pour assets statiques,
//             Network-first pour API Supabase/Jamendo
// ═══════════════════════════════════════════

const CACHE = 'wa-v108';

// Assets à précacher à l'installation
const STATIC = [
  '/',
  '/index.html',
  '/app.css',
  '/js/config.js',
  '/js/i18n.js',
  '/js/utils.js',
  '/js/nav.js',
  '/js/search.js',
  '/js/auth.js',
  '/js/camera.js',
  '/js/feed.js',
  '/js/boutique.js',
  '/js/create.js',
  '/js/messages.js',
  '/js/profile.js',
  '/js/stories.js',
  '/js/scan.js',
  '/js/coach.js',
  '/js/app.js',
  '/manifest.json',
  '/wolf.png',
  '/couronne.png',
  '/icon-192.png',
  '/catalog-demo.json',
];

// ── Install : précache assets statiques ─────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        STATIC.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            console.warn('[SW] Failed to cache:', url);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ── Activate : purge les vieux caches ───────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch : routing par type de requête ─────────
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase API → network-first (données en temps réel)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Jamendo API → network-first
  if (url.hostname.includes('jamendo.com')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Fonts Google + CDN jsdelivr → cache-first (immutables)
  if (url.hostname.includes('fonts.g') || url.hostname.includes('jsdelivr.net') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // HTML → network-first (toujours la version fraîche si dispo)
  if (request.headers.get('Accept')?.includes('text/html')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // JS + CSS locaux → network-first : le code applicatif doit toujours être frais quand
  // le réseau est dispo (le cache-first figeait les mises à jour). Cache = fallback offline.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Le reste (images locales, JSON) → cache-first
  e.respondWith(cacheFirst(request));
});

// ── Stratégie Cache-First ───────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline + pas en cache : réponse vide
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

// ── Push Notifications ──────────────────────────
// Reçoit les push serveur (si VAPID configuré côté Supabase Edge Functions)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(_) {}
  const title = data.title || 'WearAura';
  const options = {
    body: data.body || 'Tu as une nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'wa-notif',
    renotify: true,
    data: { url: data.url || '/?tab=notif' },
  };
  // Badge sur l'icône de l'app : chiffre si le push porte un compteur, sinon
  // simple pastille (Badging API, dispo aussi en contexte SW — iOS 16.4+).
  if ('setAppBadge' in self.navigator) {
    const n = Number(data.badge);
    if (Number.isFinite(n) && n > 0) self.navigator.setAppBadge(n).catch(() => {});
    else self.navigator.setAppBadge().catch(() => {});
  }
  e.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur une notification → ouvrir/focus l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      // Réutilise un onglet existant si possible
      for (const c of cls) {
        if ('focus' in c) { c.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Stratégie Network-First ─────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline : retourne le cache si disponible
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback JSON pour les appels API
    const accept = request.headers.get('Accept') || '';
    if (accept.includes('application/json') || request.url.includes('/rest/')) {
      return new Response(JSON.stringify({ data: null, error: { message: 'offline' } }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      });
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}
