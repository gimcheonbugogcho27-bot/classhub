// 오프라인에서도 열리게: 인터넷이 되면 새 버전, 안 되면 저장해 둔 버전
const CACHE = 'classhub-v5';
const FILES = ['./', './index.html', './style.css', './wheel.js', './app.js', './qr.js', './ai.js', './qrcode-lib.js', './marble.js', './vendor/planck.min.js', './vendor/jszip.min.js', './manifest.webmanifest', './web-icons/icon-180.png', './web-icons/icon-192.png', './web-icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
