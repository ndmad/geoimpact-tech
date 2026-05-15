// sw.js - Service Worker pour notifications push
const CACHE_NAME = 'geoimpact-push-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker installé');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activé');
    event.waitUntil(clients.claim());
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
    console.log('📨 Push reçue:', event);
    
    let data = {
        title: 'GeoImpact Tech',
        body: 'Nouvelle mise à jour disponible',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        url: '/',
        timestamp: Date.now()
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
        icon: data.icon || '/favicon.ico',
        badge: data.badge || '/favicon.ico',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/',
            timestamp: data.timestamp
        },
        actions: [
            {
                action: 'open',
                title: 'Voir'
            },
            {
                action: 'close',
                title: 'Fermer'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Gestion du clic sur notification
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(windowClients => {
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