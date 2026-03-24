'use strict';

const CACHE_NAME = 'octile-v23';

const STATIC_ASSETS = [
    './',
    'index.html',
    'style.css',
    'themes.css',
    'app.js',
    'translations.json',
    'favicon.svg',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter(name => name.startsWith('octile-') && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Don't intercept API calls — let them go directly to the network
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request)
            .then((cached) => cached || fetch(event.request))
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
