// Network first for everything on this site, saved copy when offline.
// (Cache-first would keep serving old code after an update.)
const CACHE = 'fashion-swipe-v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'js/app.js', 'js/store.js', 'js/pack.js', 'js/learn.js', 'js/deck.js', 'js/colors.js', 'js/similar.js',
  'js/closet-match.js', 'js/drops.js', 'js/format.js', 'js/image-guard.js', 'js/backup.js', 'js/records.js',
  'js/ui/card.js', 'js/ui/swipe.js', 'js/ui/banner.js', 'js/ui/library.js', 'js/ui/detail.js',
  'js/ui/drops.js', 'js/ui/shops.js', 'js/ui/closet.js', 'js/ui/settings.js', 'js/ui/genre-fix.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
