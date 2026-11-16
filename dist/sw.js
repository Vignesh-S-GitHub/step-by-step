const PREFIX = 'little-step-shell-';
const CACHE = PREFIX + 'v19';
const root = self.registration.scope;
const threeUrl = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.module.min.js';
const shell = [
  './', './style.css', './app.mjs', './model.mjs', './cosmicLadder.js', './manifest.webmanifest',
  './assets/rising-steps.svg', './assets/rising-steps-180.png', './assets/rising-steps-192.png',
  './assets/rising-steps-512.png', './assets/rising-steps-maskable.png', './assets/inter.woff2',
].map((path) => new URL(path, root).href);
const files = new Set(shell.slice(1));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const responses = await Promise.all(shell.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok || response.redirected) throw new Error('App shell unavailable');
      if (url === root && !(await response.clone().text()).includes('data-app="little-step"')) {
        throw new Error('App shell requires sign-in');
      }
      return [url, response];
    }));
    const cache = await caches.open(CACHE);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
    try {
      const three = await fetch(threeUrl, { mode: 'cors', signal: AbortSignal.timeout(2500) });
      if (three.ok) await cache.put(threeUrl, three);
    } catch {
      // The local app remains installable if the optional renderer is unavailable.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE && (name.startsWith(PREFIX) || name.startsWith('little-leap-shell-'))).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const navigation = request.mode === 'navigate' && request.url.split(/[?#]/, 1)[0] === root;
  const renderer = request.url === threeUrl;
  if (!navigation && !renderer && !files.has(request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (renderer) {
      const stored = await cache.match(threeUrl);
      if (stored) return stored;
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(threeUrl, response.clone()); } catch { /* Storage is optional. */ }
      }
      return response;
    }
    try {
      return await fetch(request);
    } catch {
      return (await cache.match(navigation ? root : request.url)) || Response.error();
    }
  })());
});
