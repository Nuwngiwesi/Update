// LYNKO CHAT service worker — app shell + last-seen chats work offline.
// Cached API data is the same ENCRYPTED data the server sends; it is wiped on logout.
const SHELL = 'lynko-shell-v3', API = 'lynko-api-v2', EXT = 'lynko-ext-v2';
const PRE = ['/', '/chat', '/manifest.json', '/ios.css', '/settings.js', '/install.js', '/icons/icon-192.png', '/icons/icon-512.png'];
const READ = /^\/api\/(me|config|chats|messages|statuses|dp\/|blob\/|status\/)/;
const IMMUTABLE = /^\/api\/(blob\/|dp\/|status\/[^/]+\/blob)/;   // media never changes -> cache first

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, API, EXT].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const withTimeout = (req, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  return fetch(req, { signal: c.signal }).finally(() => clearTimeout(t)); };

async function trim(cache, max) {
  const ks = await cache.keys(); for (let i = 0; i < ks.length - max; i++) await cache.delete(ks[i]);
}

// new messages fetched with &after= get merged into the saved full chat list
async function mergeMessages(url, res) {
  try {
    if (!url.searchParams.has('after')) return;
    const w = url.searchParams.get('with'), cache = await caches.open(API);
    const key = new Request(url.origin + '/api/messages?with=' + w);
    const old = await cache.match(key); const add = await res.clone().json();
    if (!old || !add.length) return;
    const list = await old.json(), ids = new Set(list.map(m => m.id));
    add.forEach(m => { if (!ids.has(m.id)) list.push(m); });
    await cache.put(key, new Response(JSON.stringify(list.slice(-300)), { headers: { 'Content-Type': 'application/json' } }));
  } catch {}
}

async function apiRead(req, url) {
  const cache = await caches.open(API);
  if (IMMUTABLE.test(url.pathname)) {
    const hit = await cache.match(req); if (hit) return hit;
    const res = await fetch(req);
    if (res.status === 200) { cache.put(req, res.clone()); trim(cache, 400); }
    return res;
  }
  try {
    const res = await withTimeout(req, 8000);
    if (res.status === 200) {
      if (url.pathname === '/api/messages') await mergeMessages(url, res);
      if (!url.searchParams.has('after')) cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req); if (hit) return hit;
    if (url.pathname === '/api/messages' && url.searchParams.has('after'))   // offline poll -> nothing new
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;

  if (url.origin !== location.origin) {                      // fonts, pusher script: stale-while-revalidate
    if (!/fonts\.(googleapis|gstatic)\.com|js\.pusher\.com/.test(url.hostname)) return;
    e.respondWith(caches.open(EXT).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.pathname === '/health') return;
  if (url.pathname.startsWith('/api/')) {
    if (READ.test(url.pathname)) e.respondWith(apiRead(req, url));
    return;
  }
  // pages & static files: network first, saved copy when offline
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match('/chat') : Response.error())));
});
