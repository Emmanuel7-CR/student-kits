/* FreeStudentKit service worker: lets tools and pages open without data once visited or saved. */
const VERSION = 'fsk-v2';
const OFFLINE = 'fsk-offline-v1'; // filled by the "Use it without data" page, kept across updates
const CORE = ['/', '/tools/', '/tools/cgpa/', '/scholarships/', '/library/', '/search/', '/offline/'];
const SLOW_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== OFFLINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Newest copy first, then the saved offline copy. */
async function lookup(req) {
  const fresh = await caches.open(VERSION).then((c) => c.match(req));
  if (fresh) return fresh;
  return caches.open(OFFLINE).then((c) => c.match(req));
}

function remember(req, res) {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first so content is fresh. On a slow or missing connection, use the saved copy if there is one.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const network = fetch(req).then((res) => remember(req, res));
        const slow = new Promise((resolve) => setTimeout(() => lookup(req).then(resolve, () => resolve(null)), SLOW_MS));
        try {
          const first = await Promise.race([network, slow]);
          if (first) return first;
          return await network;
        } catch {
          return (await lookup(req)) || (await lookup('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else (scripts, styles, fonts, JSON): serve from cache, refresh in the background.
  event.respondWith(
    lookup(req).then((hit) => {
      const network = fetch(req)
        .then((res) => remember(req, res))
        .catch(() => hit || Response.error());
      return hit || network;
    }),
  );
});
