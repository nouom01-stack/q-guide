/* Q-Guide service worker: يخزّن ملفات الأسئلة والمذكرات والصور محلياً بعد أول تحميل (أسرع وأقل ضغطاً على الشبكة) */
const V = 'qg-v2';
const STATIC = /\/(p\/data|test\/data|p\/wb|assets)\/.+\.(bin|json|png|jpg|css|js)(\?.*)?$/;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (STATIC.test(url.pathname + url.search) && !/manifest\.json|meta\.json/.test(url.pathname)) {
    // محتوى ثابت (مشفّر ومُرقّم): من الكاش أولاً
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
    return;
  }
  // الصفحات والسكربتات: الشبكة أولاً، وإذا انقطعت نرجع للكاش
  e.respondWith(fetch(req).then(res => { if (res.ok && /\.(html|js|css|json)$|\/$/.test(url.pathname)) caches.open(V).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req)));
});
