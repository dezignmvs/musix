/**
 * Service Worker for Musics Web App
 */

const CACHE_NAME = 'musics-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/images/default-cover.svg',
  './css/style.css',
  './css/layout.css',
  './css/components.css',
  './css/player.css',
  './css/responsive.css',
  './js/app.js',
  './js/router.js',
  './js/player.js',
  './js/api.js',
  './js/firebase.js',
  './js/auth.js',
  './js/library.js',
  './js/localMusic.js',
  './js/uploads.js',
  './js/pwa.js',
  './js/providers/bhariyamusic.js',
  './js/providers/fallback.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for streaming media chunks or external APIs
  if (
    event.request.destination === 'audio' ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('ddns.net') ||
    url.hostname.includes('apple.com') ||
    url.hostname.includes('freesound.org') ||
    url.hostname.includes('cloudinary.com')
  ) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./offline.html');
      })
    );
    return;
  }

  // Cache-first with network fallback for local static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        // Cache newly fetched internal assets
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
