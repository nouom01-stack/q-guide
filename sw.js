/* Q-Guide service worker: يخزّن ملفات الأسئلة والمذكرات والصور محلياً بعد أول تحميل (أسرع وأقل ضغطاً على الشبكة) */
const V = 'qg-v9';
const STATIC = /\/(p\/data|test\/data|p\/wb|assets)\/.+\.(bin|json|png|jpg|css|js)(\?.*)?$/;
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'qg-meta').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
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

// 🔔 التذكير اليومي: الخادم يرسل تنبيه بدون محتوى، ونكتب النص هنا من آخر بيانات حفظها الموقع على الجهاز
const DAYMS = 864e5;
const dk = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dl = n => n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم';
async function remNote() {
  let c = null; try { const r = await (await caches.open('qg-meta')).match('/__rem'); if (r) c = await r.json(); } catch (e) {}
  const now = Date.now(), today = dk(now), yest = dk(now - DAYMS);
  let title = 'وقت المذاكرة 📚', body = 'كم سؤال اليوم يقرّبك من درجتك. يلّا نكمل!';
  if (c) {
    if (c.streak > 0 && (c.last === today || c.last === yest)) title = `🔥 لا تكسر سلسلتك: ${dl(c.streak)} ورا بعض`;
    else if (c.last && c.last < yest) title = (c.name ? c.name + '، ' : '') + 'وحشتنا! 👋 ارجع لمذاكرتك';
    const parts = [];
    if (c.exam && c.exam > now) { const d = Math.round((new Date(dk(c.exam)) - new Date(today)) / DAYMS); if (d >= 1) parts.push(d === 1 ? 'اختبارك بكرة!' : `باقي ${dl(d)} على اختبارك`); }
    if (c.task) parts.push('مهمتك اليوم: ' + c.task); else if (c.next) parts.push('كمّل ' + c.next);
    if (parts.length) body = parts.join(' · ');
  }
  return self.registration.showNotification(title, { body, icon: '/assets/icon-192.png', badge: '/assets/badge-96.png', tag: 'qg-daily', renotify: true, dir: 'rtl', lang: 'ar', data: { url: '/p/' } });
}
self.addEventListener('push', e => { e.waitUntil(remNote()); });
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/p/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) { if (new URL(w.url).pathname.startsWith('/p/') && 'focus' in w) return w.focus(); } return self.clients.openWindow(url); }));
});
