const PREFIX = 'little-step-shell-';
const CACHE = PREFIX + 'v6';
const root = self.registration.scope;
const shell = [
  './', './style.css', './app.mjs', './model.mjs', './core.mjs', './prism.mjs', './manifest.webmanifest',
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
  const navigation = request.mode === 'navigate' && request.url === root;
  if (!navigation && !files.has(request.url)) return;

  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      const cache = await caches.open(CACHE);
      return (await cache.match(request.url)) || Response.error();
    }
  })());
});
