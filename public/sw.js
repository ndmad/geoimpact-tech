// sw.js - Service Worker pour PWA
const CACHE_NAME = 'geoimpact-v1';
const STATIC_CACHE = 'geoimpact-static-v1';
const DYNAMIC_CACHE = 'geoimpact-dynamic-v1';

// Fichiers à mettre en cache
const STATIC_FILES = [
  '/',
  '/css/style.css',
  '/js/main.js',
  '/js/push-notifications.js',
  '/manifest.json',
  '/offline.html'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installation...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Activation - nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // ✅ IGNORER LES REQUÊTES STRIPE
  if (url.hostname === 'js.stripe.com' || url.hostname === 'api.stripe.com') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // ✅ IGNORER LES REQUÊTES POST
  if (event.request.method === 'POST') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // ✅ IGNORER LES REQUÊTES VERS L'API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Stratégie: Cache d'abord, puis réseau
  if (url.origin === location.origin) {
    // Pour les fichiers statiques
    if (STATIC_FILES.includes(url.pathname)) {
      event.respondWith(
        caches.match(event.request).then((response) => {
          return response || fetch(event.request);
        })
      );
    } else {
      // Pour les autres ressources
      event.respondWith(
        caches.match(event.request).then((response) => {
          return response || fetch(event.request).then((fetchResponse) => {
            return caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, fetchResponse.clone());
              return fetchResponse;
            });
          });
        }).catch(() => {
          return caches.match('/offline.html');
        })
      );
    }
  } else {
    // Pour les ressources externes (hors Stripe)
    event.respondWith(fetch(event.request));
  }
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  let data = {
    title: 'GeoImpact Tech',
    body: 'Nouvelle mise à jour disponible',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    url: '/'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200],
    data: {
      url: data.url,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          for (let client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});