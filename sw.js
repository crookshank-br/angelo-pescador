// Versão atualizada a cada deploy — bumpa quando os arquivos mudam.
const VERSION = 'v2.4-bau-zona-2026.05.10';
const CACHE = `angelo-pescador-${VERSION}`;
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './manifest.webmanifest',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            // Remove TODOS os caches antigos do app
            Promise.all(keys.filter((k) => k.startsWith('angelo-pescador-') && k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Network-first para HTML/JS/CSS principais (pega atualizações no ar);
    // cache-first para o resto (icon, manifest)
    const isCore = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
    if (isCore) {
        event.respondWith(
            fetch(req).then((res) => {
                if (res.ok && url.origin === location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy));
                }
                return res;
            }).catch(() => caches.match(req))
        );
        return;
    }
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                if (res.ok && url.origin === location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy));
                }
                return res;
            }).catch(() => cached);
        })
    );
});

// Permite que a página force update do SW
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
