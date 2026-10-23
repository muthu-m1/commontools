/* Common Tools service worker: makes every tool available offline once the site has been opened (or installed).
   Strategy:
   - On install, every page, script, stylesheet and icon in PRECACHE is saved, plus the two QR libraries from their CDNs
     and the Chivo typeface.
   - Pages and files from this site: network first, so you always get the latest version when online; if the network
     fails or takes longer than NETWORK_TIMEOUT_MS, the saved copy is used.
   - Fonts and CDN libraries (fixed versions that never change): saved copy first, network only when missing.
   tests/pwa.test.js checks that PRECACHE lists every page and every local file the pages load. */
const VERSION = 'v1';
const CACHE = `common-tools-${VERSION}`;
const RUNTIME = `common-tools-runtime-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/app.css',
  'assets/common.js',
  'assets/charts.js',
  'assets/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'bmi/index.html', 'bmi/logic.js',
  'contrast/index.html', 'contrast/logic.js',
  'cpr/index.html', 'cpr/logic.js',
  'dates/index.html', 'dates/logic.js',
  'debt/index.html', 'debt/logic.js',
  'duedate/index.html', 'duedate/logic.js',
  'energy/index.html', 'energy/logic.js',
  'gpa/index.html', 'gpa/logic.js',
  'ice/index.html', 'ice/logic.js',
  'loan/index.html', 'loan/logic.js',
  'password/index.html', 'password/logic.js', 'password/words.js',
  'photoclean/index.html', 'photoclean/logic.js', 'photoclean/sample.js',
  'qr/index.html', 'qr/logic.js',
  'readability/index.html', 'readability/logic.js',
  'savings/index.html', 'savings/logic.js',
  'split/index.html', 'split/logic.js',
  'timezones/index.html', 'timezones/logic.js',
  'units/index.html', 'units/logic.js',
];

/* Fixed-version libraries the QR Code Maker loads from CDNs; saved on install so QR codes work offline too. */
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
];
/* The typeface: its stylesheet (the same address every page links to) and the font files it names. */
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Chivo:wght@300..900&display=swap';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })));
    // CDN files and fonts are best effort: a failure here must not stop the rest of the site working offline
    const runtime = await caches.open(RUNTIME);
    const keep = async (u) => {
      const res = await fetch(u, { mode: 'cors' });
      if (res.ok) await runtime.put(u, res.clone());
      return res;
    };
    await Promise.allSettled([
      ...CDN.map(keep),
      (async () => {
        const css = await (await keep(FONT_CSS)).text();
        await Promise.allSettled((css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s'"]+/g) || []).map(keep));
      })(),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([CACHE, RUNTIME]);
    for (const key of await caches.keys()) if (key.startsWith('common-tools-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)$/.test(url.hostname)) event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
  } catch (e) { /* offline: fall through to the saved copy */ }
  const saved = await savedCopy(cache, req);
  if (saved) return saved;
  return fromNetwork; // nothing saved: wait for the network (or let the request fail as usual)
}

async function savedCopy(cache, req) {
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const url = new URL(req.url);
  // a folder address such as /loan/ is the same page as /loan/index.html
  if (url.pathname.endsWith('/')) {
    const page = await cache.match(new URL('index.html', url).href);
    if (page) return page;
  }
  // an unknown page while offline opens the tool list instead of the browser's error page
  if (req.mode === 'navigate') return cache.match(new URL('index.html', self.registration.scope).href);
  return null;
}

async function cacheFirst(req) {
  const runtime = await caches.open(RUNTIME);
  // ignoreVary: the font stylesheet varies on how it was requested, and a stylesheet saved at install must still match
  const hit = await runtime.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') runtime.put(req, res.clone()).catch(() => {});
  return res;
}
