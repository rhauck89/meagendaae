/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Auto-update
self.skipWaiting();
clientsClaim();

// Precache
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Runtime caching: Supabase API
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  })
);

// Runtime caching: images
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Navigate fallback denylist
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/~oauth')) return false;
    return true;
  },
  new NetworkFirst({ cacheName: 'pages' })
);

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  
  if (!event.data) {
    console.log('[Service Worker] Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[Service Worker] Push data:', data);
    
    const title = data.title || 'Me Agendaê';
    const options: NotificationOptions = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/dashboard' },
      vibrate: [200, 100, 200],
      tag: data.tag || `meagendae-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Ver agora' },
        { action: 'close', title: 'Fechar' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[Service Worker] Push event error:', err);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open with the same URL, focus it
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
