/* 👀 Q-Guide: نشاط الزائر (الحساب المجاني) — وش فتح، كم سؤال حل، وش حاول يفتح وهو مقفل، وكم جلس.
   يُرسل للخادم على دفعات صغيرة، والمالك يشوفه في تبويب «الزوار». المشتركون ما يُتتبعون. */
(function () {
  'use strict';
  const SRC = 'qg_src', VID = 'qg_vid', IDLE = 60000, TICK = 15000, NEWVISIT = 30 * 60000;
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const host = u => { try { return new URL(u).hostname.replace(/^(www|m|l|lm|mobile)\./, ''); } catch (e) { return ''; } };
  // من وين جاء: utm_source أو الموقع اللي فتح منه الرابط
  const M = [[/tiktok/, 'TikTok'], [/instagram|^ig$|^insta$/, 'Instagram'], [/youtube|youtu\.be|^yt$/, 'YouTube'], [/snapchat|^snap$/, 'Snapchat'], [/(^|\.)t\.co$|twitter|(^|\.)x\.com$|^x$/, 'X'],
    [/whatsapp|wa\.me|^wa$/, 'WhatsApp'], [/telegram|(^|\.)t\.me$/, 'Telegram'], [/facebook|(^|\.)fb\.|^fb$/, 'Facebook'], [/google\./, 'Google'], [/bing\./, 'Bing']];
  const known = h => { for (const [re, n] of M) if (re.test(h)) return n; return ''; };
  function srcOf(ref, utm) {
    if (utm) return known(String(utm).trim().toLowerCase()) || String(utm).replace(/[^\w؀-ۿ .-]/g, '').slice(0, 30);   // ?utm_source=tiktok → TikTok
    const h = host(ref); if (!h || /q-guide\.online$|localhost|127\.0\.0\.1|workers\.dev$|accounts\.google\.com$/.test(h)) return '';
    return known(h) || h.slice(0, 30);
  }
  // أول مصدر جاء منه قبل ما يسجّل (يبقى محفوظ على جهازه)
  try { const u = new URLSearchParams(location.search), s = srcOf(document.referrer, u.get('utm_source')); if (s && !lsGet(SRC, null)) localStorage.setItem(SRC, JSON.stringify({ s, t: Date.now() })); } catch (e) {}

  const S = { q: [], ans: {}, act: 0, last: Date.now(), vid: '', started: false, page: '', pageAt: 0, timer: 0, tick: 0 };
  const auth = () => lsGet('qg_auth', null);
  const on = () => { const a = auth(); return !!(a && a.role === 'free' && a.session && (!a.exp || a.exp > Date.now()) && window.QG && QG.API && QG.API.indexOf('__') !== 0); };
  const touch = () => { try { sessionStorage.setItem(VID, JSON.stringify({ id: S.vid, at: Date.now() })); } catch (e) {} };
  function start() {
    if (S.started || !on()) return; S.started = true;
    let v = null; try { v = JSON.parse(sessionStorage.getItem(VID) || 'null'); } catch (e) {}
    if (!v || !v.id || Date.now() - (v.at || 0) > NEWVISIT) {   // زيارة جديدة
      v = { id: Math.random().toString(36).slice(2, 12) };
      const u = new URLSearchParams(location.search), f = lsGet(SRC, null);
      S.m = { src: srcOf(document.referrer, u.get('utm_source')), src0: f ? f.s : '', w: screen.width || 0, h: screen.height || 0, tp: navigator.maxTouchPoints || 0,
        pwa: ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone) ? 1 : 0 };
      S.q.push({ t: 'visit', k: S.m.src || S.m.src0 || '', ts: Date.now() });
    }
    S.vid = v.id; touch();
    const act = () => { S.last = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(e => addEventListener(e, act, { passive: true, capture: true }));
    addEventListener('scroll', act, { passive: true, capture: true });
    S.tick = setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - S.last < IDLE) { S.act += TICK / 1000; touch(); } }, TICK);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    addEventListener('pagehide', () => flush(true));
    soon(4000);
  }
  function soon(ms) { if (!S.timer) S.timer = setTimeout(() => { S.timer = 0; flush(); }, ms || 20000); }
  // الإجابات تنجمع، وتنكتب قبل أي حدث ثاني عشان يبقى الترتيب صحيح في الخط الزمني
  function drainAns() { Object.keys(S.ans).forEach(k => { const [n, c, ts] = S.ans[k]; if (n) S.q.push({ t: 'ans', k, n, c, ts }); }); S.ans = {}; }
  function ev(t, k, n, c) { if (!S.started) start(); if (!S.started) return; drainAns(); S.q.push({ t, k: String(k == null ? '' : k).slice(0, 40), n: Math.round(n || 0), c: Math.round(c || 0), ts: Date.now() }); S.last = Date.now(); if (S.q.length >= 30) flush(); else soon(); }
  function page(k) { if (!S.started) start(); if (!S.started) return; k = String(k || 'home'); if (k === S.page && Date.now() - S.pageAt < 10000) return; S.page = k; S.pageAt = Date.now(); ev('page', k); }
  function ans(set, ok) { if (!S.started) start(); if (!S.started) return; const a = S.ans[set] || (S.ans[set] = [0, 0, 0]); a[0]++; if (ok) a[1]++; a[2] = S.last = Date.now(); soon(); }
  function flush(beacon) {
    if (!S.started || !on()) return;
    drainAns(); const list = S.q.splice(0);
    if (S.act >= 5) { list.push({ t: 'time', n: Math.round(S.act), ts: Date.now() }); S.act = 0; }
    if (!list.length) return;
    const body = { op: 'ev', session: auth().session, vid: S.vid, ev: list }; if (S.m) { body.m = S.m; S.m = null; }
    const txt = JSON.stringify(body);
    try { if (beacon && navigator.sendBeacon && navigator.sendBeacon(QG.API, new Blob([txt], { type: 'text/plain' }))) return; } catch (e) {}
    fetch(QG.API, { method: 'POST', body: txt, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: txt.length < 60000 }).catch(() => {});
  }
  // 👣 عدّاد مجهول قبل تسجيل الدخول (بدون أي بيانات شخصية): مرة في اليوم لكل متصفح — فتح الصفحة الرئيسية (land)، ضغط زر فيها (cta)، وصل صفحة الدخول (login)
  const API = (window.QG && QG.API && QG.API.indexOf('__') !== 0 && QG.API) || (/(^|\.)q-guide\.online$/.test(location.hostname) ? 'https://q-guide-api.nouom01.workers.dev/' : '');
  function hit(p, k) {
    try {
      if (!API || auth()) return; const day = new Date().toISOString().slice(0, 10), key = 'qg_hit_' + p + (p === 'cta' ? '_' + k : '');
      if (localStorage.getItem(key) === day) return; localStorage.setItem(key, day);
      const txt = JSON.stringify({ op: 'hit', p, k: String(k || '').slice(0, 30) });
      if (navigator.sendBeacon && navigator.sendBeacon(API, new Blob([txt], { type: 'text/plain' }))) return;
      fetch(API, { method: 'POST', body: txt, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: true }).catch(() => {});
    } catch (e) {}
  }
  const src0 = () => { const f = lsGet(SRC, null); return (f && f.s) || ''; };
  if (/^\/(index\.html)?$/.test(location.pathname)) {   // الصفحة الرئيسية: زيارة + أي زر ضغطه (اشترك · دخول المشتركين · جرّب مجاناً · الساحة)
    hit('land', src0());
    document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="/p/"]'); if (!a) return; const h = a.getAttribute('href');
      hit('cta', /#join/.test(h) ? 'join' : /[?&]m=1/.test(h) ? 'member' : /#arena/.test(h) ? 'arena' : 'free'); }, true);
  }
  window.QGT = { start, ev, page, ans, flush, srcOf, hit, src0 };
})();
