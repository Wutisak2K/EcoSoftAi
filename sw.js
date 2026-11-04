/* EcoSort GuideBot — offline service worker (optional companion to index.html)
   วางไฟล์นี้ไว้โฟลเดอร์เดียวกับ index.html แล้วแอปจะเปิดได้แม้ไม่มีอินเทอร์เน็ต
   (หลังจากเคยเปิดแบบออนไลน์สำเร็จอย่างน้อย 1 ครั้ง) */
const VERSION = 'ecosort-v1.0.0';
const SHELL = ['./', './index.html'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/knn-classifier@1.2.6/dist/knn-classifier.min.js'
];
// Static third-party files that never change for a given URL: serve from cache first.
const CACHE_FIRST_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'storage.googleapis.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL).catch(() => {});
    for (const url of LIBS) {
      try { const res = await fetch(url, { mode: 'cors' }); if (res.ok) await cache.put(url, res); } catch (e) { /* will be cached on first use */ }
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'generativelanguage.googleapis.com') return;   // Gemini: always live
  if (url.origin === self.location.origin) { event.respondWith(networkFirst(req)); return; }
  if (CACHE_FIRST_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(req));
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([fetch(req), timeout(5000)]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? (await cache.match('./index.html')) || (await cache.match('./')) : null);
    if (hit) return hit;
    return new Response('ออฟไลน์และยังไม่มีไฟล์ในเครื่อง กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วเปิดใหม่อีกครั้ง', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}
