/* Q-Guide practice app — vanilla JS, RTL. Data sets are AES-GCM encrypted; the key comes from the API after Google sign-in. */
(function () {
  'use strict';
  if (location.protocol === 'http:' && /q-guide\.online$/.test(location.hostname)) { location.replace('https://' + location.host + location.pathname + location.search + location.hash); return; }
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} return; }
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const LS = { auth: 'qg_auth', prog: 'qg_prog_', fs: 'qg_fs', tab: 'qg_tab', theme: 'qg_theme' };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const PART_AR = { 1: 'التناظر اللفظي', 2: 'إكمال الجمل', 3: 'الخطأ السياقي', 4: 'استيعاب المقروء' };
  let auth = null, manifest = null, cryptoKey = null;
  const cache = {};
  // 🎬 مقاطع الشرح على قناة Q-guide1 (نفس روابط باركود المذكرات)
  const YT = {
    q: { name: 'القسم', rules: { id: 'WjcD6JHnwIc', dur: '45:44', t: 'مقطع قواعد الكمي', d: 'كل قوانين الكمي (الكسور، الجذور، النسب، الهندسة، الساعة…) في مقطع واحد — شاهده قبل الأقسام' }, list: 'PLNdATbln9B4k',
      v: ['WBnwPsSTuaU:36:18', 'SLGGlm5YwJU:34:43', 'VoVaWRFbIjg:36:50', 'dwvgSfK6Tfw:34:10', 'eVZsYR0QPq8:35:39', 'd3hX21VfSWo:34:19', 'EMNaSCi0IMk:43:40', 'fQynzmnlZmI:34:15', 'i4ELxBTMUw0:40:51', 'mZdhgMMOWB0:40:01', 'bscPMN6lDPQ:36:29', '6AxdKpQZevk:34:16', 'iVR5LsbBBv4:29:38', '5SXV-pbaQ7U:47:45'] },
    v: { name: 'النموذج', rules: { id: 'vo91Yxx_6vw', dur: '', t: 'مقطع قواعد التناظر اللفظي', d: 'شرح علاقات التناظر وطريقة الحل — شاهده قبل أول نموذج' }, list: 'PLVFHCj9Zxd0E',
      v: ['qWlJ9gh2G3U:24:15', 'l4v74KKFrj8:23:59', '5EOXngu_9R0:19:54', 'BFewNC6ocP4:25:05', 'r34_ruXqoJg:17:50', '85cq5t4G9Rs:23:07', 'za5kEoY6bxI:17:37', 'ShJH_Dpijiw:16:33', 'SmU59p7M5OY:18:37', 'V1-07MAx6YI:12:32', 'oYJmNRMwAKg:15:49', 'vSrkVscXAXs:17:45', 'CACQHxNpOTE:21:40', 'mFYiB0Z9G5k:15:17'] } };
  const ytUrl = id => 'https://youtu.be/' + id;
  function ytFor(setId) { const m = /^([qv])(\d{1,2})$/.exec(setId || ''); if (!m) return null; const k = YT[m[1]], raw = k.v[+m[2] - 1]; if (!raw) return null; const i = raw.indexOf(':'); return { id: raw.slice(0, i), dur: raw.slice(i + 1), url: ytUrl(raw.slice(0, i)), label: k.name + ' ' + m[2] }; }
  const YTSVG = '<svg class="yti" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#FF0000"/><path d="M11 5.5v9l8-4.5z" fill="#fff"/></svg>';
  const GRIDSVG = '<svg class="gi" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.9"/><circle cx="8" cy="3" r="1.9"/><circle cx="13" cy="3" r="1.9"/><circle cx="3" cy="8" r="1.9"/><circle cx="8" cy="8" r="1.9"/><circle cx="13" cy="8" r="1.9"/><circle cx="3" cy="13" r="1.9"/><circle cx="8" cy="13" r="1.9"/><circle cx="13" cy="13" r="1.9" fill-opacity=".45"/></g></svg>';
  const LOSVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg>';

  // ---------- utils ----------
  // يلفّ المقاطع الرياضية/الإنجليزية داخل النص العربي بعنصر LTR حتى لا تنعكس (مثل 10 + 10 − 1 = 19)
  const MATHRUN = /[0-9A-Za-z√π°²³⁴¹⁰⁻⁺\(\)\[\]\+\-−×÷=≈≤≥<>\/\.,%:'’ ]+/g;
  function wrapMath(raw) {
    return esc(raw).replace(MATHRUN, m => {
      let lead = '', trail = '', core = m;
      // أقواس غير متوازنة في الأطراف تبقى خارج المقطع
      const bal = t => (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
      while (core.length && bal(core) < 0 && core.endsWith(')')) { trail = ')' + trail; core = core.slice(0, -1); }
      while (core.length && bal(core) > 0 && core.startsWith('(')) { lead += '('; core = core.slice(1); }
      const t = core.trim();
      const mathy = /[+−\-×÷=≈≤≥<>\/√π]/.test(t) || /[A-Za-z]/.test(t) || /\d\s*[,.]\s*\d/.test(t);
      if (t.length < 2 || !mathy || !/[0-9A-Za-z√π]/.test(t)) return m;
      return lead + '<bdi dir="ltr">' + core + '</bdi>' + trail;
    });
  }
  function fmtExp(t) {
    return String(t || '').split('\n').filter(l => !/^\s*(📝\s*)?الشرح:?\s*$/.test(l)).map(l => {
      const en = l.match(/^(\s*)(\d+)\)\s*(.*)$/);          // ترقيم الخطوات: 1) ...
      if (en) return en[1] + '<bdi dir="ltr">' + en[2] + ')</bdi> ' + wrapMath(en[3]);
      return wrapMath(l);
    }).join('\n');
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  let toastT; function toast(m) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  function applyFs() { const f = lsGet(LS.fs, 1); document.documentElement.style.setProperty('--fs', f); }
  function applyTheme() { const t = lsGet(LS.theme, 'light'); document.documentElement.dataset.theme = t; document.querySelectorAll('#dm').forEach(b => b.textContent = t === 'dark' ? '☀️' : '🌙'); }
  function toggleTheme() { lsSet(LS.theme, lsGet(LS.theme, 'light') === 'dark' ? 'light' : 'dark'); applyTheme(); }
  function waUrl() { const who = auth ? ((auth.display || auth.name || '') + ' · ' + (auth.email || '')) : ''; return 'https://wa.me/966508003683?text=' + encodeURIComponent('السلام عليكم، أحتاج دعم فني في منصة Q-Guide' + (who ? '\n' + who : '') + '\nالمشكلة: '); }
  function ctlHtml() { return `<span class="ctl"><button id="fsm" title="تصغير الخط">A-</button><button id="fsp" title="تكبير الخط">A+</button><button id="dm" title="الوضع الداكن/الفاتح">🌙</button><a class="wa" href="${waUrl()}" target="_blank" rel="noopener" title="دعم فني عبر واتساب"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.3c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.3.1-1.4l-.5-.3-1.9-.9c-.3-.1-.5-.2-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5h-.4z"/></svg><span>دعم</span></a></span>`; }
  function bindCtl() { const a = $('#fsm'), b = $('#fsp'), c = $('#dm'); if (a) a.onclick = () => bumpFs(-.1); if (b) b.onclick = () => bumpFs(.1); if (c) c.onclick = toggleTheme; applyTheme(); }
  function bumpFs(d) { let f = lsGet(LS.fs, 1); f = Math.min(1.4, Math.max(.85, +(f + d).toFixed(2))); lsSet(LS.fs, f); applyFs(); }
  async function api(body) {
    if (!window.QG.API || window.QG.API.indexOf('__') === 0) throw new Error('API not configured');
    const r = await fetch(window.QG.API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    return r.json();
  }
  function hex2buf(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  async function getKey() { if (cryptoKey) return cryptoKey; cryptoKey = await crypto.subtle.importKey('raw', hex2buf(auth.key), 'AES-GCM', false, ['decrypt']); return cryptoKey; }
  const DATA_V = 2;   // ⬆️ ارفعه كل ما تغيّرت ملفات الأسئلة (حتى ما يبقى الطالب على نسخة قديمة من الكاش)
  async function loadSet(id) {
    if (cache[id]) return cache[id];
    if (id === 'qall' || id === 'vall') {
      const k = id[0]; let got = 0; const el = () => document.getElementById('ldmsg');
      const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const m = el(); if (m) m.textContent = 'تحميل الأسئلة… ' + got + ' / 14'; return p; })));
      let obj;
      if (k === 'q') obj = { kind: 'quant', id: 'qall', title: 'الاختبار الشامل — الكمي', sub: 'All 14 sections', items: [].concat(...parts.map(p => p.items.map((it, j) => Object.assign({}, it, { src: p.id, sidx: j })))) };
      else obj = { kind: 'verbal', id: 'vall', title: 'الاختبار الشامل — اللفظي', sub: 'All 14 models', groups: [].concat(...parts.map(p => originGroups(p))) };
      cache[id] = obj; return obj;
    }
    if (/^t-/.test(id)) return loadTopicSet(id);
    const r = await fetch('/p/data/' + id + '.bin?v=' + DATA_V, { cache: 'force-cache' });
    if (!r.ok) throw new Error('data ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    const key = await getKey();
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)); }
    catch (e) { logout(); throw new Error('bad key'); }
    cache[id] = JSON.parse(new TextDecoder().decode(plain));
    return cache[id];
  }
  function progGet(id) { return lsGet(LS.prog + id, { a: {}, best: null, started: 0, last: 0, done: 0 }); }
  function progSet(id, p) { lsSet(LS.prog + id, p); }
  function flatItems(set) {
    if (set.kind === 'quant') return set.items.map((it, i) => ({ it, gi: 0, idx: i }));
    const out = []; set.groups.forEach((g, gi) => g.items.forEach(it => out.push({ it: g.src ? Object.assign({}, it, { src: g.src }) : it, gi, idx: out.length })));
    return out;
  }
  // أصل كل سؤال (النموذج + ترتيبه فيه) حتى يُسجَّل في سجل المهارات مهما كان الاختبار الذي ظهر فيه
  function originGroups(p) { let j = 0; return p.groups.map(g => Object.assign({}, g, { title: (g.kind === 'part' ? p.title + ' · ' : '') + g.title, src: p.id, items: g.items.map(it => Object.assign({}, it, { src: p.id, sidx: j++ })) })); }
  // ---------- 🎯 المهارات: المواضيع + سجل الإجابات ----------
  const TOPICS = { ana: { t: 'التناظر اللفظي', k: 'verbal', i: '🔗' }, sen: { t: 'إكمال الجمل', k: 'verbal', i: '✍️' }, err: { t: 'الخطأ السياقي', k: 'verbal', i: '🔍' }, read: { t: 'استيعاب المقروء', k: 'verbal', i: '📄' },
    arith: { t: 'الحساب والأعداد', k: 'quant', i: '🔢' }, alg: { t: 'الجبر والمعادلات', k: 'quant', i: '𝑥' }, geo: { t: 'الهندسة', k: 'quant', i: '📐' }, stat: { t: 'الإحصاء والاحتمالات', k: 'quant', i: '📊' }, cmp: { t: 'أسئلة المقارنة', k: 'quant', i: '⚖️' } };
  const TOPIC_ORDER = ['ana', 'sen', 'err', 'read', 'arith', 'alg', 'geo', 'stat', 'cmp'];
  function itemTopics(it) { const t = []; if (it.topic) t.push(it.topic); if (it.cmp) t.push('cmp'); return t; }
  const HIST_LS = 'qg_hist';
  function histGet() { return lsGet(HIST_LS, { v: 1, items: {}, mig: 0, up: 0 }); }
  function histSet(h) { h.up = Date.now(); lsSet(HIST_LS, h); }
  function histMark(h, src, sidx, correct, topics) {
    const m = h.items[src] || (h.items[src] = {}); const e = m[sidx] || [0, 0, 1, ''];
    if (correct) e[1]++; else e[0]++; e[2] = correct ? 1 : 0; e[3] = topics.join(','); m[sidx] = e;
  }
  // تجميع السجل حسب الموضوع: {topic:{w,r,n}}
  function histAgg(h) {
    const agg = {}; TOPIC_ORDER.forEach(t => agg[t] = { w: 0, r: 0, items: 0, wrongNow: 0 });
    for (const src in h.items) for (const i in h.items[src]) { const e = h.items[src][i]; (e[3] || '').split(',').filter(Boolean).forEach(t => { const a = agg[t]; if (!a) return; a.w += e[0]; a.r += e[1]; a.items++; if (!e[2]) a.wrongNow++; }); }
    return agg;
  }
  // ترحيل الإجابات القديمة (قبل وجود السجل) من تقدّم الأقسام المحفوظ على الجهاز
  async function histMigrate(onmsg) {
    const h = histGet(); if (h.mig) return h;
    const ids = []; for (let i = 1; i <= 14; i++) ids.push('q' + i, 'v' + i);
    const any = ids.concat(['qall', 'vall']).some(id => Object.keys(progGet(id).a).length);
    if (any) {
      let got = 0; for (const id of ids) { try { await loadSet(id); } catch (e) {} got++; if (onmsg) onmsg('قراءة إجاباتك السابقة… ' + got + ' / ' + ids.length); }
      const fold = (id) => { const set = cache[id]; if (!set) return; const items = flatItems(set); const pr = progGet(id); items.forEach((x, i) => { const a = pr.a[i]; if (!a) return; const src = x.it.src || id, sidx = x.it.sidx != null ? x.it.sidx : i; histMark(h, src, sidx, !!a.c, itemTopics(x.it)); }); };
      ids.forEach(fold); try { await loadSet('qall'); await loadSet('vall'); fold('qall'); fold('vall'); } catch (e) {}
    }
    h.mig = 1; histSet(h); return h;
  }
  // مزامنة السجل مع الخادم (حتى تبقى نقاط القوة والضعف عند تغيير الجهاز)
  let skillsT = 0, skillsSyncing = false;
  function histMergeInto(h, remote) { if (!remote || !remote.items) return h; for (const src in remote.items) { const m = h.items[src] || (h.items[src] = {}); for (const i in remote.items[src]) { const r = remote.items[src][i], l = m[i]; if (!l || (r[0] + r[1]) > (l[0] + l[1])) m[i] = r; } } return h; }
  let skillsPulled = false;
  // كل اللي يتزامن بين أجهزة الطالب في رسالة وحدة
  function syncPayload() {
    const pl = planState(), o = { v: 1, items: histGet().items, days: daysGet(), exam: lsGet(EXAM_LS, null), plan: planUp(pl) ? pl : null, marks: marksGet(), badges: lsGet(BADGE_LS, {}), lvl: lsGet(LVL_LS, null), fc: lsGet(FC_LS, null) };
    let s = JSON.stringify(o); if (s.length < 140000) return s;   // حد الخادم 150 ألف حرف: نخفّف الأقل أهمية أول
    o.fc = null; if (o.lvl) o.lvl = Object.assign({}, o.lvl, { a: {} }); s = JSON.stringify(o); if (s.length < 140000) return s;
    const M = JSON.parse(JSON.stringify(o.marks)); for (const k in M.items) for (const i in M.items[k]) if (M.items[k][i].n) M.items[k][i].n = M.items[k][i].n.slice(0, 160); o.marks = M; return JSON.stringify(o);
  }
  async function skillsPull() {
    if (!auth) return histGet();
    try {
      const r = await api({ op: 'skills_get', session: auth.session });
      if (r.ok) skillsPulled = true;
      if (r.ok && r.data) {
        const rem = JSON.parse(r.data); const h = histMergeInto(histGet(), rem); histSet(h); daysMerge(rem.days);
        // موعد الاختبار والخطة: الأحدث يكسب (حتى تلحقك على أي جهاز)
        if (rem.exam && (rem.exam.up || 0) > ((lsGet(EXAM_LS, null) || {}).up || 0)) lsSet(EXAM_LS, rem.exam);
        if (rem.plan && planUp(rem.plan) > planUp(planState())) lsSet(PLAN_LS, rem.plan);
        marksMerge(rem.marks); badgesMerge(rem.badges); if (rem.lvl && (rem.lvl.at || 0) > ((lsGet(LVL_LS, null) || {}).at || 0)) lsSet(LVL_LS, rem.lvl); fcMerge(rem.fc);
        return h;
      }
    } catch (e) {}
    return histGet();
  }
  function skillsPushSoon(ms) { clearTimeout(skillsT); skillsT = setTimeout(skillsPush, ms || 6000); }
  async function skillsPush() {
    if (!auth || skillsSyncing) return; skillsSyncing = true;
    try {
      if (!skillsPulled) { await skillsPull(); if (!skillsPulled) return; }   // لا نكتب فوق نسخة الخادم قبل ما ندمجها
      await api({ op: 'skills_set', session: auth.session, data: syncPayload() });
    } catch (e) {} finally { skillsSyncing = false; }
  }

  // ---------- 🔥 النشاط اليومي: سلسلة الأيام + هدف اليوم ----------
  const DAYS_LS = 'qg_days', GOAL_LS = 'qg_goal', GOALS = [20, 40, 60, 100];
  const dayKey = t => { const d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function daysGet() {
    let d = lsGet(DAYS_LS, null); if (d) return d;
    d = {};   // أول مرة: نبني السجل من إجاباتك المحفوظة
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || k.indexOf(LS.prog) !== 0) continue; const p = JSON.parse(localStorage.getItem(k) || '{}'); Object.values(p.a || {}).forEach(a => { if (a && a.t) { const dk = dayKey(a.t); d[dk] = (d[dk] || 0) + 1; } }); } } catch (e) {}
    lsSet(DAYS_LS, d); return d;
  }
  function daysAdd() { const d = daysGet(), k = dayKey(); d[k] = (d[k] || 0) + 1; lsSet(DAYS_LS, d); return d[k]; }
  function daysMerge(rem) { if (!rem || typeof rem !== 'object') return; const d = daysGet(); let ch = false; for (const k in rem) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (+rem[k] || 0) > (d[k] || 0)) { d[k] = +rem[k]; ch = true; } } if (ch) lsSet(DAYS_LS, d); }
  function streakOf(d) { let n = 0; const t = new Date(); if (!d[dayKey(t)]) t.setDate(t.getDate() - 1); while (d[dayKey(t)]) { n++; t.setDate(t.getDate() - 1); } return n; }
  function goalGet() { const g = lsGet(GOAL_LS, 40); return GOALS.indexOf(g) >= 0 ? g : 40; }
  window.addEventListener('pagehide', () => { if (skillsT && skillsPulled) { clearTimeout(skillsT); skillsT = 0; try { navigator.sendBeacon && auth && navigator.sendBeacon(window.QG.API, new Blob([JSON.stringify({ op: 'skills_set', session: auth.session, data: syncPayload() })], { type: 'text/plain' })); } catch (e) {} } });
  // مجموعات التدريب الموجّه: t-<موضوع> أو t-wrong-q / t-wrong-v
  async function loadTopicSet(id) {
    const m = id.match(/^t-(?:(wrong|star)-([qv])|([a-z]+))$/); if (!m) throw new Error('bad set');
    const mode = m[1] || '', topic = m[3], kind = m[2] ? (m[2] === 'q' ? 'quant' : 'verbal') : (TOPICS[topic] || {}).k; if (!kind) throw new Error('bad set');
    const k = kind === 'quant' ? 'q' : 'v'; let got = 0; const el = () => document.getElementById('ldmsg');
    const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const e = el(); if (e) e.textContent = 'تجهيز الأسئلة… ' + got + ' / 14'; return p; })));
    const h = histGet();
    const keep = (it, src, sidx) => mode === 'wrong' ? (h.items[src] && h.items[src][sidx] && !h.items[src][sidx][2]) : mode === 'star' ? !!markOf(src, sidx) : itemTopics(it).indexOf(topic) >= 0;
    const kn = kind === 'quant' ? 'الكمي' : 'اللفظي';
    const title = mode === 'wrong' ? '🔁 مراجعة أخطائي — ' + kn : mode === 'star' ? '⭐ أسئلة دفتري — ' + kn : (TOPICS[topic].i + ' تدريب: ' + TOPICS[topic].t);
    const sub = mode === 'wrong' ? 'My mistakes' : mode === 'star' ? 'My notebook' : 'Topic practice';
    let obj;
    if (kind === 'quant') obj = { kind, id, title, sub, items: [].concat(...parts.map(p => p.items.map((it, j) => Object.assign({}, it, { src: p.id, sidx: j })).filter(it => keep(it, p.id, it.sidx)))) };
    else obj = { kind, id, title, sub, groups: [].concat(...parts.map(p => originGroups(p).map(g => Object.assign({}, g, { items: g.items.filter(it => keep(it, p.id, it.sidx)) })).filter(g => g.items.length))) };
    obj.topicSet = true; if (!mode) cache[id] = obj;   // الأخطاء والدفتر يتغيّرون باستمرار فلا يُخزَّنون
    return obj;
  }
  function logout(msg, tellServer) {
    if (tellServer && auth && auth.session) { try { api({ op: 'logout', session: auth.session }); } catch (e) {} }
    lsDel(LS.auth); auth = null; cryptoKey = null; P = null; document.onkeydown = null;
    try { window.google && google.accounts.id.disableAutoSelect(); } catch (e) {}
    if (msg) { location.hash = ''; renderLogin(msg); } else route();
  }
  // 🔒 جلسة واحدة لكل طالب: نتأكد من الخادم عند الفتح وكل 3 دقائق
  let hbBusy = false;
  async function heartbeat() {
    if (!auth || hbBusy) return; hbBusy = true;
    try {
      const r = await api({ op: 'me', session: auth.session });
      if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) logout(esc(r.msg || 'انتهت الجلسة، سجّل دخولك من جديد.'));
      else if (r && r.ok && auth.role === 'admin' && r.staff && r.staff !== auth.staff) { auth.staff = r.staff; lsSet(LS.auth, auth); }
    } catch (e) {} finally { hbBusy = false; }
  }
  setInterval(heartbeat, 3 * 60 * 1000);

  // ---------- routing ----------
  function route() {
    auth = lsGet(LS.auth, null);
    if (auth && auth.exp && auth.exp < Date.now()) { auth = null; lsDel(LS.auth); }
    if (!auth) return renderLogin();
    document.body.classList.remove('rec-on'); document.querySelectorAll('.confetti').forEach(c => c.remove()); if (window.__stKey) { document.removeEventListener('keydown', window.__stKey); window.__stKey = null; }
    if (window.__stPen) { try { window.__stPen.destroy(); } catch (e) {} window.__stPen = null; }
    heartbeat(); document.onkeydown = null; if (LV && LV.tm) { clearInterval(LV.tm); LV.tm = 0; }
    if (skillsT) { clearTimeout(skillsT); skillsT = 0; skillsPush(); }   // ادفع سجل المهارات قبل الانتقال
    const h = location.hash.replace('#', '');
    if (/^[qv]\d+$/.test(h)) return renderPlayer(h);
    if (/^[qv]\d+@\d+$/.test(h)) { const [sid, si] = h.split('@'); return renderPlayer(sid, +si); }
    if (h === 'notes') return renderNotes();
    if (h === 'badges') return renderBadges();
    if (h === 'level') return renderLevel();
    if (h === 'rules') return renderRules();
    if (h === 'cards') { if (auth.role === 'admin') return renderCards(); location.hash = ''; return; }
    if (/^wb-[qv]$/.test(h)) return renderWorkbook(h.slice(3));
    if (h === 'board' || h === 'board-month' || h === 'board-exam') return renderBoard(h === 'board-exam' ? 'exam' : h === 'board-month' ? 'month' : 'practice');
    if (/^board-set-[qv]\d{1,2}$/.test(h)) return renderBoard('set:' + h.slice(10));
    if (h === 'qall' || h === 'vall') return renderPlayer(h);
    if (h === 'plan') return renderPlan();
    if (/^t-[a-z-]+$/.test(h)) return renderPlayer(h);
    if (h === 'skills') return renderSkills();
    if (/^vocab(-v\d{1,2})?$/.test(h)) return renderVocab(h.length > 5 ? h.slice(6) : '');
    if (h === 'studio' || /^studio-[qv]-\d{1,3}$/.test(h)) { if (auth.role === 'admin') return h === 'studio' ? renderStudio() : renderRec(h[7], +h.slice(9)); location.hash = ''; return; }
    if (h === 'admin' || h === 'admin-staff') { if (auth.role === 'admin') return h === 'admin' ? renderAdmin() : renderStaff(); location.hash = ''; return; }
    renderHome();
  }
  window.addEventListener('hashchange', route);

  // رمز الدخول القادم من وضع إعادة التوجيه (#gsi=...)
  function gsiFromHash() {
    const m = location.hash.match(/[#&]gsi=([^&]+)/); if (!m) { if (/gsierr=1/.test(location.hash)) { history.replaceState(null, '', location.pathname); renderLogin('تعذّر إكمال تسجيل الدخول، حاول مرة أخرى.'); return true; } return false; }
    const cred = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname);
    renderLogin(); onCredential({ credential: cred }); return true;
  }
  // ---------- login ----------
  function renderLogin(err) {
    document.title = 'تسجيل الدخول | Q-Guide';
    app.innerHTML = `<div class="login"><div class="card">
      <img src="/assets/logo.png" alt="Q-Guide">
      <h1>منصة تدريب Q-Guide</h1>
      <p class="sub">أسئلة القدرات الإنجليزي — الكمي واللفظي — مع الشرح</p>
      <div class="gbtn" id="gbtn"><div class="spin"></div></div>
      ${err ? `<div class="err">${err}</div>` : ''}
      <p class="note">سجّل دخولك بحساب Google <b>نفس الإيميل اللي اشتركت فيه بالدورة</b>.<br>المنصة للطلاب المشتركين فقط، والحساب يعمل على <b>جهاز واحد</b> في الوقت نفسه.</p>
      <p class="note" style="margin-top:10px"><a class="btn sm ghost" style="gap:6px" href="https://wa.me/966508003683?text=${encodeURIComponent('السلام عليكم، أحتاج مساعدة في الدخول لمنصة Q-Guide')}" target="_blank" rel="noopener">💬 دعم فني عبر واتساب</a></p>
      <p class="note" style="margin-top:8px"><a href="/privacy/">سياسة الخصوصية</a> · <a href="/terms/">الشروط</a></p>
    </div></div>`;
    mountGoogle();
  }
  let gTries = 0;
  function mountGoogle() {
    const host = $('#gbtn'); if (!host) return;
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 60) return setTimeout(mountGoogle, 150); host.innerHTML = '<span style="color:var(--bad)">تعذّر تحميل تسجيل الدخول، حدّث الصفحة.</span>'; return; }
    try {
      google.accounts.id.initialize(Object.assign({ client_id: window.QG.CLIENT_ID, callback: onCredential, auto_select: false, itp_support: true }, window.QG.GSI_REDIRECT ? { ux_mode: 'redirect', login_uri: window.QG.API.replace(/\/$/, '') + '/gsi?to=/p/' } : { ux_mode: 'popup' }));
      host.innerHTML = '';
      google.accounts.id.renderButton(host, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ar', width: 280 });
    } catch (e) { host.innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>'; }
  }
  async function onCredential(resp) {
    const host = $('#gbtn'); if (host) host.innerHTML = '<div class="spin"></div><span style="margin-inline-start:10px;color:var(--mut)">جارٍ التحقق من اشتراكك…</span>';
    try {
      const r = await api({ op: 'login', idToken: resp.credential, ua: navigator.userAgent.slice(0, 120) });
      if (!r.ok) {
        const msg = r.msg || (r.error === 'not_member' ? 'هذا الحساب غير مسجّل في الدورة.' : 'تعذّر تسجيل الدخول (' + esc(r.error || '') + ').');
        return renderLogin(esc(msg) + '<br><a href="https://wa.me/966508003683" target="_blank" rel="noopener">تواصل معنا على واتساب 0508003683</a>');
      }
      auth = { name: r.name, email: r.email, phone: r.phone || '', key: r.key, exp: r.exp, session: r.session, gender: r.gender || '', role: r.role || 'student', staff: r.staff || '', files: r.files || null, display: r.display || r.name, avatar: r.avatar || '' };
      lsSet(LS.auth, auth); location.hash = ''; route();
    } catch (e) { renderLogin('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'); }
  }

  // ---------- home ----------
  function topbar(inner, left) {
    return `<header class="top"><div class="w">${left || `<a class="brand" href="#"><img src="/assets/logo.png" alt="">Q-Guide</a>`}${ctlHtml()}${inner || ''}</div></header>`;
  }
  // ---------- home: ورقة الإجابة ----------
  const SET_NAME = id => (id[0] === 'q' ? 'القسم ' : 'النموذج ') + id.slice(1);
  function setState(id, n) { const p = progGet(id); const a = p.a || {}; let ans = 0, ok = 0, last = 0, gap = -1; for (let i = 0; i < n; i++) { const x = a[i]; if (x) { ans++; if (x.c) ok++; if (x.t > last) last = x.t; } else if (gap < 0) gap = i; } return { ans, ok, last, n, gap: gap < 0 ? 0 : gap, done: n > 0 && ans >= n, best: p.best }; }
  function dotsHtml(id, n, cur) { const a = progGet(id).a || {}; let h = ''; for (let i = 0; i < n; i++) { const x = a[i]; h += `<i class="${x ? (x.c ? 'ok' : 'bad') : ''}${i === cur ? ' cur' : ''}"></i>`; } return h; }
  function pickResume() {
    let best = null;
    for (const s of [...manifest.quant, ...manifest.verbal]) { const st = setState(s.id, s.n); if (st.last && (!best || st.last > best.st.last)) best = { s, st }; }
    if (!best) { const s = manifest[lsGet(LS.tab, 'quant') === 'verbal' ? 'verbal' : 'quant'][0]; return { s, st: setState(s.id, s.n), mode: 'new' }; }
    if (!best.st.done) return { s: best.s, st: best.st, mode: 'cont' };
    const list = best.s.id[0] === 'q' ? manifest.quant : manifest.verbal; const i = list.indexOf(best.s);
    const nx = list.slice(i + 1).concat(list.slice(0, i)).find(x => !setState(x.id, x.n).done);
    if (nx) return { s: nx, st: setState(nx.id, nx.n), mode: 'next', prev: best };
    return { s: best.s, st: best.st, mode: 'alldone' };
  }
  const cols = (n, max) => Math.max(1, Math.ceil(n / Math.ceil(n / max)));   // صفوف متساوية بدون فقاعات يتيمة
  const dLabel = n => n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم';
  function rzHtml() {
    const first = (auth.display || auth.name || '').trim().split(/\s+/)[0] || '';
    const R = pickResume(), rs = R.s, st = R.st;
    const D = daysGet(), streak = streakOf(D), today = D[dayKey()] || 0, goal = goalGet();
    const wk = []; for (let k = 6; k >= 0; k--) { const t = new Date(); t.setDate(t.getDate() - k); wk.push({ l: 'حنثرخجس'[t.getDay()], n: D[dayKey(t)] || 0, today: k === 0 }); }
    const nm = SET_NAME(rs.id) + (rs.id[0] === 'v' ? ` <bdi class="rz-mn">${esc(rs.sub)}</bdi>` : '');
    let kick, title, sub, cta, href = '#' + rs.id, cur = st.gap;
    if (R.mode === 'cont') { kick = 'كمّل من حيث وقفت'; title = nm; sub = `السؤال ${st.gap + 1} من ${st.n}`; cta = 'كمّل الحل'; }
    else if (R.mode === 'next') { kick = `خلّصت ${SET_NAME(R.prev.s.id)}${R.prev.st.best != null ? ' بنسبة ' + R.prev.st.best + '%' : ''} 👏`; title = 'التالي: ' + nm; sub = `${st.n} سؤال، وكل سؤال معه شرحه`; cta = 'ابدأ ' + SET_NAME(rs.id); }
    else if (R.mode === 'new') { kick = 'جاهز تبدأ؟'; title = nm; sub = lsGet(LVL_LS, null) ? `${st.n} سؤال، وكل سؤال معه شرحه` : `${st.n} سؤال، وكل سؤال معه شرحه · أو <a class="rz-alt" href="#level">ابدأ باختبار تحديد المستوى 🧭</a>`; cta = 'ابدأ ' + SET_NAME(rs.id); cur = 0; }
    else { kick = 'خلّصت كل الأقسام 🎉'; title = 'راجع الأسئلة اللي غلطت فيها'; sub = 'التدريب على أخطائك يثبّت المعلومة قبل الاختبار'; cta = 'مراجعة أخطائي'; href = '#skills'; cur = -1; }
    const C = 2 * Math.PI * 20, dash = Math.min(1, today / goal) * C, met = today >= goal;
    return `<section class="rz" aria-label="متابعة المذاكرة">
      <div class="rz-top"><h1 class="rz-hi">أهلاً ${esc(first)} 👋</h1>
        <div class="rz-streak" title="الأيام اللي حليت فيها أسئلة"><span class="rz-r1"><span class="rz-fire ${streak ? '' : 'off'}">🔥 ${streak ? dLabel(streak) + ' ورا بعض' : 'ابدأ سلسلتك اليوم'}</span><a class="rz-bdg" href="#badges" title="إنجازاتي: الشارات اللي حصلت عليها">🏅 ${BADGES.filter(b => lsGet(BADGE_LS, {})[b.id]).length}<small>/${BADGES.length}</small></a></span>
          <span class="rz-week">${wk.map(d => `<i class="${d.n ? 'on' : ''}${d.today ? ' t' : ''}" title="${d.n} سؤال"><b>${d.l}</b></i>`).join('')}</span></div></div>
      <div class="rz-body">
        <div class="rz-what"><span class="rz-k">${kick}</span><b class="rz-set">${title}</b><span class="rz-sub">${sub}</span></div>
        <div class="rz-dots" aria-hidden="true" style="--c:${cols(st.n, 30)};--cm:${cols(st.n, 17)}">${R.mode === 'alldone' ? '' : dotsHtml(rs.id, st.n, cur)}</div>
        <div class="rz-act"><a class="rz-go" href="${href}"><span class="pl">▶</span>${cta}</a>
          <button class="rz-goal ${met ? 'met' : ''} ${today ? '' : 'zero'}" id="goal" title="اضغط لتغيير هدفك اليومي"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="bg"/><circle cx="24" cy="24" r="20" class="fg" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/></svg>
            <span class="gt"><b>${met ? '✓ ' : ''}${today}<small> من ${goal}</small></b><small>${met ? 'حققت هدف اليوم' : 'هدف اليوم'}</small></span></button></div>
      </div></section>`;
  }
  let homePulled = false;
  async function renderHome() {
    document.title = 'منصة التدريب | Q-Guide';
    if (!manifest) { try { manifest = await (await fetch('/p/data/manifest.json')).json(); } catch (e) { app.innerHTML = '<div class="center">تعذّر تحميل البيانات. حدّث الصفحة.</div>'; return; } }
    const tab = lsGet(LS.tab, 'quant') === 'verbal' ? 'verbal' : 'quant';
    const adminLinks = auth.role === 'admin' ? `<a class="tn gold" href="#admin" title="لوحة الإدارة: الطلاب والمشرفون"><span class="i">👑</span><span class="l">الإدارة</span></a>` : '';
    const R = YT[tab === 'quant' ? 'q' : 'v'];
    const nq = manifest.quant.reduce((a, b) => a + b.n, 0), nv = manifest.verbal.reduce((a, b) => a + b.n, 0);
    const megaPct = (id, n) => Math.round(Object.keys(progGet(id).a || {}).length * 100 / n);
    badgeCheck();
    const pst = planState(), pl = PLANS.find(p => p.id === pst.id), lv = lsGet(LVL_LS, null), nMarks = marksList().length, isStaff = auth.role === 'admin';
    const toolA = (href, i, b, s, tag) => `<a class="tool" href="${href}"><span class="ti">${i}</span><span class="tx"><b>${b}${tag || ''}</b><small>${s}</small></span></a>`;
    const toolB = (id, i, b, s) => `<button type="button" class="tool" id="${id}"><span class="ti">${i}</span><span class="tx"><b>${b}</b><small id="${id}l">${s}</small></span></button>`;
    app.innerHTML = topbar(`<span class="sp"></span><nav class="tnav"><a class="tn" href="#board" title="لوحة الصدارة"><span class="i">🏆</span><span class="l">الصدارة</span></a><a class="tn" href="#skills" title="نقاط القوة والضعف"><span class="i">🎯</span><span class="l">مهاراتي</span></a>${adminLinks}</nav><button class="chip me" id="me" title="ملفي: الاسم والصورة">${avatarHtml(auth.avatar, auth.display || auth.name, 26)}<span>${esc(auth.display || auth.name || auth.email)}</span></button><button class="ib lo" id="lo" title="تسجيل الخروج" aria-label="تسجيل الخروج">${LOSVG}</button>`) +
    `<main class="wrap home">
      <div id="rz">${rzHtml()}</div>
      <div id="trip"></div>
      <div class="hrow"><div class="tabs" role="tablist"><button role="tab" data-t="quant" class="${tab === 'quant' ? 'on' : ''}" aria-selected="${tab === 'quant'}">📐 الكمي <small>14 قسم</small></button><button role="tab" data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}" aria-selected="${tab === 'verbal'}">📖 اللفظي <small>14 نموذج</small></button></div>
        <span class="sp"></span><a class="rvid" href="${ytUrl(R.rules.id)}" target="_blank" rel="noopener" title="${esc(R.rules.d)}">${YTSVG}<span>${R.rules.t}</span>${R.rules.dur ? `<small>${R.rules.dur}</small>` : ''}</a><a class="rall" href="https://www.youtube.com/playlist?list=${R.list}" target="_blank" rel="noopener">كل المقاطع</a>${tab === 'quant' && RULES_ON ? '<a class="rvid rl" href="#rules"><span class="i">📐</span><span>ملخص القوانين</span></a>' : ''}</div>
      <div class="sheets" id="grid"></div>
      <h2 class="h2">أدوات المذاكرة</h2>
      <section class="tgroups">
        <div class="tg"><h3>اختبر نفسك</h3>
          ${toolA('#level', '🧭', 'تحديد المستوى', lv ? `مستواك: ${LEVELS[lv.lvl].t} (${lv.pct}%) · تقدر تعيده` : '20 سؤال تعرف منها مستواك ونقاط ضعفك')}
          ${toolA('/test/', '🧪', 'الاختبارات المحاكية', '17 اختبار بنفس شكل قياس المحوسب')}
          <div class="tool"><span class="ti">🏁</span><span class="tx"><b>الاختبار الشامل</b><small>كل الأسئلة في اختبار واحد متواصل</small></span><span class="tbtns"><a href="#qall">الكمي <small>${nq}</small>${megaPct('qall', nq) ? `<em>${megaPct('qall', nq)}%</em>` : ''}</a><a href="#vall">اللفظي <small>${nv}</small>${megaPct('vall', nv) ? `<em>${megaPct('vall', nv)}%</em>` : ''}</a></span></div></div>
        <div class="tg"><h3>تعلّم وراجع</h3>
          ${RULES_ON ? toolA('#rules', '📐', 'قوانين الكمي', 'كل القوانين في صفحة وحدة، وتنطبع') : ''}
          ${toolA('#vocab', '📖', 'قاموس الكلمات', 'ترجمة ونطق كل كلمات اللفظي')}
          ${toolA('#notes', '📒', 'دفتري', nMarks ? `${nMarks} سؤال محفوظ مع ملاحظاتك` : 'الأسئلة اللي تحفظها ⭐ وملاحظاتك عليها')}
          ${isStaff ? toolA('#cards', '🃏', 'بطاقات الحفظ', 'احفظ كلمات اللفظي بالبطاقات', '<span class="beta">تجريبي</span>') : ''}</div>
        <div class="tg"><h3>تابع تقدّمك</h3>
          ${toolA('#plan', '📅', 'خطة المذاكرة', pl ? 'أنت على ' + pl.name : 'اختر خطة 7 أو 14 أو 19 أو 28 يوم')}
          ${toolB('rem', '🔔', 'التذكير اليومي', remLabel())}
          ${toolA('#skills', '🎯', 'نقاط قوتك وضعفك', 'اعرف وش تغلط فيه وتدرّب عليه')}
          ${toolA('#badges', '🏅', 'إنجازاتي', `${BADGES.filter(b => lsGet(BADGE_LS, {})[b.id]).length} من ${BADGES.length} شارة`)}
          ${toolA('#board', '🏆', 'لوحة الصدارة', 'ترتيبك بين طلاب الدورة')}</div>
      </section>
      <h2 class="h2">📘 مذكراتك</h2>
      <div class="wb" id="wb"><div class="mut">جارٍ تحميل مذكراتك…</div></div>
    </main>`;
    $('#lo').onclick = async () => { if (await QGDlg.confirm('تسجيل الخروج؟', { ok: 'خروج' })) logout('', true); };
    $('#me').onclick = () => renderProfile();
    bindCtl();
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { lsSet(LS.tab, b.dataset.t); renderHome(); });
    const grid = $('#grid');
    grid.innerHTML = manifest[tab].map(s => {
      const st = setState(s.id, s.n); const sub = tab === 'quant' ? `الأسئلة <bdi dir="ltr">${esc(s.range)}</bdi>` : `<bdi dir="ltr">${esc(s.sub)}</bdi>`;
      const stamp = st.done ? `<span class="stamp" title="أفضل نتيجة">✓ ${st.best != null ? st.best + '%' : ''}</span>` : st.ans ? `<span class="pill">${st.ans}/${s.n}</span>` : '';
      const foot = st.done ? (st.best != null ? `أفضل نتيجة ${st.best}%` : 'جاوبت كل الأسئلة') : st.ans ? `أجبت ${st.ans} من ${s.n}، منها ${st.ok} صح` : (st.best != null ? `أفضل نتيجة ${st.best}%` : `${s.n} سؤال`);
      return `<button class="sheet ${st.done ? 'done' : st.ans ? 'doing' : ''}" data-id="${s.id}"><span class="sh-h"><b>${SET_NAME(s.id)}</b>${stamp}</span><span class="sh-s">${sub}</span><span class="sh-dots" aria-hidden="true" style="--c:${cols(s.n, 16)};--cm:${cols(s.n, 12)}">${dotsHtml(s.id, s.n, -1)}</span><span class="sh-f">${foot}</span></button>`;
    }).join('');
    grid.querySelectorAll('.sheet').forEach(b => b.onclick = () => { location.hash = b.dataset.id; });
    const bindGoal = () => { const g = $('#goal'); if (g) g.onclick = () => { const cur = goalGet(); const nx = GOALS[(GOALS.indexOf(cur) + 1) % GOALS.length]; lsSet(GOAL_LS, nx); $('#rz').innerHTML = rzHtml(); bindGoal(); toast('هدفك اليومي صار ' + nx + ' سؤال'); }; };
    bindGoal();
    const rb = $('#rem'); if (rb) rb.onclick = () => remDlg().then(() => { const l = $('#reml'); if (l) l.textContent = remLabel(); });
    badgeCheckSoon(); remCtx();
    const paintTrip = () => { const t = $('#trip'); if (!t) return; t.innerHTML = tripHtml(); bindExam(t, paintTrip); const x = $('#trx'); if (x) x.onclick = () => { lsSet(TRIPX_LS, 1); t.innerHTML = ''; }; };
    paintTrip();
    if (!homePulled) { homePulled = true; skillsPull().then(() => { const z = $('#rz'); if (z && (location.hash === '' || location.hash === '#')) { z.innerHTML = rzHtml(); bindGoal(); paintTrip(); } }).catch(() => {}); }
    renderWorkbooks();
    prefetchSets();
  }
  // ⚡ تحميل مسبق هادئ لملفات الأقسام في الخلفية (مرة واحدة لكل جلسة) حتى تفتح فوراً
  let prefetching = false;
  function prefetchSets() {
    if (prefetching || !manifest) return; const c = navigator.connection || {}; if (c.saveData) return; prefetching = true;
    const ids = [...manifest.quant, ...manifest.verbal].map(s => s.id);
    const run = () => { const id = ids.shift(); if (!id) return; fetch('/p/data/' + id + '.bin?v=' + DATA_V, { priority: 'low' }).catch(() => {}).finally(() => setTimeout(run, 400)); };
    setTimeout(run, 2500);
  }
  async function renderWorkbooks() {
    const el = $('#wb'); if (!el) return;
    if (!auth.files || !auth.phone) { try { const r = await api({ op: 'files', session: auth.session }); if (r.ok) { auth.files = r.files; auth.phone = r.phone || auth.phone || ''; lsSet(LS.auth, auth); } } catch (e) {} }
    const f = auth.files || {}; if (!$('#wb')) return;
    const card = (id, title, icon, desc, k) => id ? `<div class="wbc"><div class="ic">${icon}</div><div class="tx"><b>${title}</b><span class="mut">${desc}</span></div>
        <div class="ac"><a class="btn sm" href="#wb-${k}">📖 افتح المذكرة التفاعلية (مع القلم)</a><a class="btn sm ghost" href="https://drive.google.com/file/d/${esc(id)}/view" target="_blank" rel="noopener">PDF في Drive</a></div></div>`
      : `<div class="wbc"><div class="ic">${icon}</div><div class="tx"><b>${title}</b><span class="mut">${auth.role === 'admin' ? 'المشرف ليس له مذكرة شخصية' : 'تتجهّز نسختك خلال دقائق — حدّث الصفحة لاحقاً'}</span></div></div>`;
    el.innerHTML = card(f.quant, 'مذكرة الكمي', '📐', 'نسختك الخاصة باسمك ورقمك · 194 صفحة · 14 قسماً', 'q') + card(f.verbal, 'مذكرة اللفظي', '📖', 'نسختك الخاصة باسمك ورقمك · 193 صفحة · 14 نموذجاً', 'v') +
      `<p class="mut" style="font-size:13px;margin:6px 0 0;grid-column:1/-1">المذكرة مسجّلة باسمك ورقم جوالك، وتفتح بحساب Google هذا فقط. يُمنع نشرها أو مشاركتها. كتابتك بالقلم تُحفظ على جهازك.</p>`;
  }

  // ---------- interactive workbook viewer (pages + pen) ----------
  let WB = null;
  async function renderWorkbook(kind) {
    const title = kind === 'q' ? 'مذكرة الكمي' : 'مذكرة اللفظي';
    document.title = title + ' | Q-Guide';
    if (!auth.phone) { try { const r = await api({ op: 'files', session: auth.session }); if (r.ok) { auth.files = r.files; auth.phone = r.phone || ''; lsSet(LS.auth, auth); } } catch (e) {} }
    if (auth.role !== 'admin' && !(auth.files && auth.files[kind === 'q' ? 'quant' : 'verbal'])) { toast('مذكرتك لم تُجهَّز بعد، حاول بعد دقائق'); location.hash = ''; return; }
    let meta; try { meta = await (await fetch('/p/wb/' + kind + '/meta.json')).json(); } catch (e) { toast('تعذّر تحميل المذكرة'); location.hash = ''; return; }
    const lastKey = 'qg_wbpage_' + kind; let page = Math.min(meta.pages, Math.max(1, lsGet(lastKey, 1)));
    WB = { kind, meta, page, cache: {}, pen: null };
    app.innerHTML = topbar(`<span class="ttl">${title}</span><span class="sp"></span>
      <button class="ib" id="pgprev" title="الصفحة السابقة">‹</button><span class="chip cnt" dir="ltr"><input id="pgin" type="number" min="1" max="${meta.pages}" value="${page}" style="width:54px;border:0;background:transparent;color:#fff;font-weight:700;text-align:center;font-size:15px"> / ${meta.pages}</span><button class="ib" id="pgnext" title="الصفحة التالية">›</button>`,
      `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wbmain"><div class="wbwrap" id="wbwrap"><div class="wbpage" id="wbpage"><div class="center" style="padding:60px 0"><div class="spin" style="margin:0 auto"></div></div></div></div>
      <div class="wbnav"><button class="btn ghost sm" id="pgprev2">‹ السابقة</button><span class="mut" id="pglabel"></span><button class="btn ghost sm" id="pgnext2">التالية ›</button></div></main>
      <button class="qgpen-fab" id="penfab" title="القلم">✎</button>`;
    bindCtl();
    const go = n => { n = Math.min(meta.pages, Math.max(1, n)); if (!WB) return; WB.page = n; lsSet(lastKey, n); $('#pgin').value = n; showPage(n); };
    $('#pgprev').onclick = $('#pgprev2').onclick = () => go(WB.page - 1);
    $('#pgnext').onclick = $('#pgnext2').onclick = () => go(WB.page + 1);
    $('#pgin').onchange = () => go(+$('#pgin').value);
    document.onkeydown = e => { if (!WB || e.target.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') go(WB.page + 1); else if (e.key === 'ArrowRight') go(WB.page - 1); };
    $('#penfab').onclick = () => { const on = WB.pen.toggle(); $('#penfab').classList.toggle('on', on); $('#penfab').textContent = on ? '✕' : '✎'; };
    WB.pen = QGPen.attach($('#wbwrap'), { storageKey: null, onToggle: on => { $('#penfab').classList.toggle('on', on); $('#penfab').textContent = on ? '✕' : '✎'; } });
    showPage(page);
  }
  async function pageBitmap(kind, n) {
    const key = kind + n; if (WB.cache[key]) return WB.cache[key];
    const r = await fetch(`/p/wb/${kind}/${String(n).padStart(3, '0')}.bin`, { cache: 'force-cache' }); if (!r.ok) throw new Error('page ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer()); const k = await getKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12));
    const bmp = await createImageBitmap(new Blob([plain], { type: 'image/jpeg' }));
    const keys = Object.keys(WB.cache); if (keys.length > 12) delete WB.cache[keys[0]];
    WB.cache[key] = bmp; return bmp;
  }
  function stamp(ctx, meta, n) {
    const sc = meta.scale, S = meta.slots, local = (auth.phone || '').replace(/^966/, '0');
    const who = (auth.name || '') + (local ? ' · ' + local : ''); if (!who.trim()) return;
    const txt = (x, baseline, size, align, text) => { ctx.save(); ctx.font = `${Math.round(size * sc * 1.15)}px Tajawal, "Segoe UI", Tahoma, sans-serif`; ctx.fillStyle = '#5B6675'; ctx.textAlign = align; ctx.direction = 'rtl'; ctx.fillText(text, x * sc, baseline * sc); ctx.restore(); };
    txt(S.header.x, S.header.baseline, S.header.size, 'right', who);
    const owners = (S.owner.pages || []).map(p => Array.isArray(p) ? p : [p, S.owner.baseline]);
    const o = owners.find(p => p[0] === n - 1); if (o) txt(S.owner.x, o[1], S.owner.size, 'right', who);
    if (S.cover && S.cover.page === n - 1) txt(S.cover.x, S.cover.baseline, S.cover.size, 'center', who);
  }
  async function showPage(n) {
    const { kind, meta } = WB; const el = $('#wbpage'); if (!el) return;
    $('#pglabel').textContent = 'صفحة ' + n + ' من ' + meta.pages;
    try {
      const bmp = await pageBitmap(kind, n); if (!WB || WB.page !== n) return;
      let cv = el.querySelector('canvas'); if (!cv) { el.innerHTML = ''; cv = document.createElement('canvas'); el.appendChild(cv); }
      cv.width = meta.w; cv.height = meta.h; const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0); stamp(ctx, meta, n);
      WB.pen.setKey('qg_wb_' + kind + '_' + n); WB.pen.resize();
      window.scrollTo({ top: 0 });
      pageBitmap(kind, Math.min(meta.pages, n + 1)).catch(() => {});
    } catch (e) { if (String(e.message).indexOf('page') < 0) logout(); el.innerHTML = '<div class="center">تعذّر تحميل الصفحة</div>'; }
  }

  // ---------- player ----------
  // 🎉 لمسات تفاعلية (تحترم إعداد تقليل الحركة)
  const RM = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burst(el) { const b = document.createElement('span'); b.className = 'burst'; const C = ['#12A16B', '#F2B33D', '#2350C4']; b.innerHTML = Array.from({ length: 10 }, (_, j) => `<i style="--a:${j * 36}deg;--c:${C[j % 3]}"></i>`).join(''); el.appendChild(b); setTimeout(() => b.remove(), 800); }
  function confetti() {
    if (RM()) return; const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const C = ['#F2B33D', '#12A16B', '#2350C4', '#E5484D', '#7FB3FF'], ps = Array.from({ length: 150 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .32, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: C[(Math.random() * C.length) | 0] }));
    const t0 = performance.now(); (function f(t) { const e = t - t0; ctx.clearRect(0, 0, W, H); ps.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - e / 2200); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }); if (e < 2200) requestAnimationFrame(f); else cv.remove(); })(t0);
  }
  // ⏱️ الوقت الفعلي فقط: وقت كل سؤال من آخر إجابة (بحد أقصى 4 دقائق للسؤال)، ولا يُحسب وقت إغلاق الصفحة أو تصغيرها
  const Q_CAP = 4 * 60 * 1000;
  function fmtDur(t) { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0'); }
  function activeSecs(prog) {
    const arr = Object.values(prog.a || {}).filter(a => a && a.t).sort((x, y) => x.t - y.t);
    let prev = prog.started || (arr[0] && arr[0].t) || Date.now(), tot = 0;
    for (const a of arr) { tot += a.ms != null ? a.ms : Math.min(Math.max(0, a.t - prev), Q_CAP); prev = a.t; }
    return Math.round(tot / 1000);
  }
  document.addEventListener('visibilitychange', () => { if (!P) return; if (document.hidden) P.hidAt = Date.now(); else if (P.hidAt) { P.lastAct += Date.now() - P.hidAt; P.hidAt = 0; } });
  let P = null; // player state
  async function renderPlayer(id, start) {
    app.innerHTML = topbar(`<span class="ttl">جارٍ التحميل…</span>`, `<a class="ib" href="#" title="رجوع">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل الأسئلة…</span></div>';
    let set; try { set = await loadSet(id); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#">→</a>`) + '<div class="center">تعذّر فتح الأسئلة (' + esc(e.message) + '). <a href="#">رجوع</a></div>'; return; }
    if (set.kind === 'verbal') await loadVocab();
    const items = flatItems(set); const prog = progGet(id);
    if (!items.length) { const star = /^t-star-/.test(id); app.innerHTML = topbar(`<span class="ttl">${esc(set.title)}</span>`, `<a class="ib" href="${star ? '#notes' : '#skills'}" title="رجوع">→</a>`) + (star ? `<div class="center"><div style="font-size:40px">⭐</div><p>ما حفظت أسئلة في هذا القسم من دفترك.<br><span class="mut">اضغط ⭐ على أي سؤال وأنت تحل عشان ينحفظ هنا وتتدرّب عليه.</span></p><a class="btn" href="#notes">📒 دفتري</a></div>` : `<div class="center"><div style="font-size:40px">🎉</div><p>ما عندك أخطاء محفوظة في هذا القسم حالياً.<br><span class="mut">حل أسئلة من الأقسام أو التدريب الموجّه، وأي سؤال تخطئ فيه يُجمع لك هنا.</span></p><a class="btn" href="#skills">🎯 نقاط القوة والضعف</a></div>`); bindCtl(); return; }
    if (!prog.started) prog.started = Date.now();
    let cur = items.findIndex((x, i) => !prog.a[i]); if (cur < 0) cur = Math.min(prog.last || 0, items.length - 1);   // أول سؤال بدون إجابة
    if (start != null && start >= 0 && start < items.length) cur = start;   // فتح سؤال محدد (من الدفتر)
    P = { id, set, items, prog, cur, t0: Date.now(), lastAct: Date.now(), hidAt: 0, passOpen: {}, sel: null };
    document.title = set.title + ' | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">${esc(set.title)} <small style="opacity:.8;font-weight:400">· ${esc(set.sub.split(' · ').pop())}</small></span><span class="sp"></span>
      ${ytFor(id) ? `<a class="ytb" href="${ytFor(id).url}" target="_blank" rel="noopener" title="شرح ${ytFor(id).label} على يوتيوب">${YTSVG}<span>الشرح</span></a>` : ''}<span class="chip run" id="run" hidden></span><button class="chip cnt" id="navb" title="كل الأسئلة: اضغط وانتقل لأي سؤال" aria-label="كل الأسئلة" aria-haspopup="dialog">${GRIDSVG}<span id="cnt" dir="ltr"></span></button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<div class="sbar" id="sb" style="--n:${items.length}" aria-hidden="true">${items.map((x, i) => `<i class="${prog.a[i] ? (prog.a[i].c ? 'ok' : 'bad') : ''}"></i>`).join('')}</div><main class="wrap" id="pm"></main>
      <aside class="sheetp" aria-label="ورقة الإجابة"><div class="sp-h"><b>ورقة الإجابة</b><span id="spn"></span></div><div class="qgrid" id="spg"></div></aside>
      <div class="nav" id="nav" role="dialog" aria-modal="true" aria-label="كل الأسئلة"><div class="bg"></div><div class="sh"><div class="nvh"><b>كل الأسئلة</b><span class="nlg"><span><i class="ok"></i>صحيحة</span><span><i class="bad"></i>خاطئة</span><span><i></i>ما جاوبتها</span></span><span class="sp"></span><button class="btn sm ghost" id="reset">↻ إعادة من البداية</button></div><div class="qgrid big" id="ng"></div></div></div>`;
    $('#navb').onclick = () => { renderNav(); $('#nav').classList.add('open'); const c = $('#ng .cur'); if (c) c.focus({ preventScroll: true }); };
    bindCtl();
    $('#nav .bg').onclick = () => $('#nav').classList.remove('open');
    const spg = $('#spg'); spg.innerHTML = sheetBtns(); spg.onclick = e => { const b = e.target.closest('button[data-i]'); if (b) showQ(+b.dataset.i); };
    $('#reset').onclick = async () => { if (await QGDlg.confirm('تُحذف إجاباتك في هذا القسم وتبدأ من جديد؟', { ok: 'ابدأ من جديد', danger: true })) { const best = prog.best; progSet(id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(id); } };
    showQ(cur);
    document.onkeydown = onKey;
  }
  function onKey(e) {
    if (!P || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const nav = $('#nav'); if (nav && nav.classList.contains('open')) { if (k === 'escape') nav.classList.remove('open'); return; }
    const idx = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : ('1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : -1);
    if (idx >= 0) { const b = document.querySelectorAll('.opt')[idx]; if (b && !b.disabled) b.click(); }
    else if (k === 'enter' || k === 'arrowleft') { const c = $('#confirm'); if (c && !c.disabled) return c.click(); const n = $('#next'); if (n && !n.disabled) return n.click(); const s = $('#skip'); if (s && k === 'arrowleft') s.click(); }
    else if (k === 'arrowright') { const p = $('#prev'); if (p) p.click(); }
  }
  function updateCounter() {
    const n = P.items.length, ans = Object.keys(P.prog.a).length; $('#cnt').textContent = (P.cur + 1) + ' / ' + n;
    const sb = $('#sb'); if (sb) { const o = sb.querySelector('i.cur'); if (o) o.classList.remove('cur'); const c = sb.children[P.cur]; if (c) c.classList.add('cur'); }
    const g = $('#spg'); if (g) { const o = g.querySelector('.cur'); if (o) o.classList.remove('cur'); const c = g.children[P.cur]; if (c) { c.classList.add('cur'); if (c.offsetTop < g.scrollTop || c.offsetTop + c.offsetHeight > g.scrollTop + g.clientHeight) g.scrollTop = c.offsetTop - g.clientHeight / 2; } }
    const sn = $('#spn'); if (sn) sn.textContent = `أجبت ${ans} من ${n}`;
  }
  // أزرار ورقة الإجابة (اللوحة الجانبية + نافذة كل الأسئلة): كل سؤال متاح بضغطة
  function sheetBtns() { return P.items.map((x, i) => { const a = P.prog.a[i]; return `<button type="button" class="${a ? (a.c ? 'ok' : 'bad') : ''}${i === P.cur ? ' cur' : ''}" data-i="${i}" aria-label="سؤال ${i + 1}${a ? (a.c ? '، إجابتك صحيحة' : '، إجابتك خاطئة') : ''}">${i + 1}</button>`; }).join(''); }
  // أقرب سؤال بدون إجابة بعد i (ويرجع من البداية)، أو -1
  function nextOpen(i) { const n = P.items.length; for (let k = 1; k < n; k++) { const j = (i + k) % n; if (!P.prog.a[j]) return j; } return -1; }
  function showQ(i) {
    const { set, items, prog } = P; P.cur = i; prog.last = i; progSet(P.id, prog); updateCounter();
    const { it, gi } = items[i]; const a = prog.a[i]; P.sel = null;
    const mkSrc = it.src || P.id, mkI = it.sidx != null ? it.sidx : i, mk = markOf(mkSrc, mkI);
    let html = '';
    if (set.kind === 'verbal') {
      const g = set.groups[gi]; const prevG = i > 0 ? items[i - 1].gi : -1;
      if (g.kind === 'part') html += `<div class="ghd">${esc(g.title)} <small>— ${esc(g.ar || '')}</small></div>`;
      else {
        const open = P.passOpen[gi] != null ? P.passOpen[gi] : true;
        html += `<div class="ghd">Passage ${g.num}: ${esc(g.title)} <small>— استيعاب المقروء</small></div>
        <div class="pass ${open ? '' : 'closed'}" id="pass"><div class="ph" id="ph"><span>📄 القطعة <span class="ar">اضغط للإخفاء/الإظهار</span></span><span id="pch">${open ? '▲' : '▼'}</span></div><div class="pread"><button type="button" class="sayb" data-say-sel="#pass .pb" data-lang="en" aria-label="استمع للقطعة">${SAYSVG}<span>استمع للقطعة</span></button></div><div class="pb">${wordsHtml(g.passage)}</div>${vocabChips(g.passage, 120) ? `<details class="tr vocab pw"><summary>📖 كلمات القطعة <small>(اضغط على أي كلمة في القطعة لترجمتها)</small></summary><div class="vcs">${vocabChips(g.passage, 120)}</div></details>` : ''}</div>`;
      }
    }
    const tag = set.kind === 'quant' ? (it.part ? `Question ${it.n} (Part ${it.part})` : `Question ${it.n}`) : `Q ${it.n}`;
    html += `<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${items.length}</small></span><span class="hd-r">${set.kind === 'verbal' ? sayBtn(it.q, 'en') : ''}<button type="button" class="mk st ${mk && mk.s ? 'on' : ''}" id="mkS" aria-pressed="${!!(mk && mk.s)}" title="احفظ السؤال في دفتري" aria-label="احفظ السؤال في دفتري">${STARSVG}</button><button type="button" class="mk nt ${mk && mk.n ? 'on' : ''}" id="mkN" title="اكتب ملاحظتك على السؤال" aria-label="ملاحظتي">${NOTESVG}</button><span class="tag ltr">${tag}</span></span></div>`;
    if (set.kind === 'quant') html += `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="Question ${it.n}">` + qtrHtml(it);
    else html += `<p class="txt ltr">${wordsHtml(it.q)}</p>`;
    const two = set.kind === 'quant' || it.opts.every(o => o.length <= 28);
    html += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => {
      const lab = set.kind === 'quant' && /^[A-D]\)\s/.test(o) ? o.replace(/^[A-D]\)\s*/, '') : o;
      let cls = ''; if (a) { if (k === it.ans) cls = 'ok'; else if (k === a.s) cls = 'bad'; }
      return `<button class="opt ${cls}" data-k="${k}" ${a ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span>${esc(lab)}</span></button>`;
    }).join('') + '</div>';
    html += `<div id="fb">${a ? feedback(it, a) : ''}</div>
      <div class="note ${mk && mk.n ? 'open' : ''}" id="nt"><label for="ntx">${NOTESVG}<b>ملاحظتي</b><small>تنحفظ تلقائياً في دفتري</small></label><textarea id="ntx" dir="auto" maxlength="600" rows="2" placeholder="مثلاً: وش القاعدة؟ وليش غلطت؟">${esc(mk ? mk.n || '' : '')}</textarea></div>
      <div class="acts"><button class="btn ghost sm" id="prev" ${i === 0 ? 'disabled' : ''}>→ السابق</button><span class="sp"></span>
      ${a ? `<button class="btn" id="next">${i + 1 < items.length ? 'التالي ←' : nextOpen(i) < 0 ? 'النتيجة 🏁' : 'التالي ←'}</button>` : `${nextOpen(i) >= 0 ? '<button class="btn ghost sm" id="skip" title="انتقل لسؤال ما جاوبته وارجع لهذا بعدين">تخطَّ ←</button>' : ''}<button class="btn gold" id="confirm" disabled>✓ تأكيد الإجابة</button>`}</div>
      <div class="kbd" style="margin-top:8px">${a ? 'Enter للتالي' : 'اختر إجابة ثم اضغط تأكيد · A–D أو 1–4 للاختيار و Enter للتأكيد'}</div></div>`;
    $('#pm').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' });
    bindWords();
    const qd = $('#qtr'); if (qd) qd.addEventListener('toggle', () => lsSet(QTR_LS, qd.open ? 1 : 0));
    $('#mkS').onclick = e => { const b = e.currentTarget, c = markOf(mkSrc, mkI), on = !(c && c.s); markSet(mkSrc, mkI, { s: on ? 1 : 0 }); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); toast(on ? '⭐ انحفظ السؤال في دفتري' : 'انشال السؤال من دفتري'); badgeCheckSoon(); };
    $('#mkN').onclick = () => { const n = $('#nt'); n.classList.toggle('open'); if (n.classList.contains('open')) { const t = $('#ntx'); t.focus(); n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } };
    let ntT = 0; $('#ntx').oninput = () => { clearTimeout(ntT); ntT = setTimeout(() => { const v = $('#ntx').value.trim(); markSet(mkSrc, mkI, { n: v }); const b = $('#mkN'); if (b) b.classList.toggle('on', !!v); badgeCheckSoon(); }, 500); };
    const ph = $('#ph'); if (ph) ph.onclick = () => { const p = $('#pass'); p.classList.toggle('closed'); P.passOpen[gi] = !p.classList.contains('closed'); $('#pch').textContent = P.passOpen[gi] ? '▲' : '▼'; };
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (P.prog.a[i]) return; P.sel = +b.dataset.k; document.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', +x.dataset.k === P.sel)); const c = $('#confirm'); if (c) c.disabled = false; });
    $('#prev').onclick = () => showQ(i - 1);
    const nx = $('#next'); if (nx) nx.onclick = () => { if (i + 1 < items.length) showQ(i + 1); else { const o = nextOpen(i); if (o >= 0) showQ(o); else finish(); } };
    const sk = $('#skip'); if (sk) sk.onclick = () => { const o = nextOpen(i); if (o >= 0) showQ(o); };
    const cf = $('#confirm'); if (cf) cf.onclick = () => { if (P.sel == null) return; answer(i, P.sel); };
  }
  function feedback(it, a) {
    const ok = a.s === it.ans; const corr = it.opts[it.ans];
    const OKS = ['✅ إجابة صحيحة، أحسنت!', '✅ صح! كفو عليك', '✅ ممتاز، إجابة صحيحة', '✅ صح عليك 👏', '✅ برافو، إجابة صحيحة'];
    return `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="h">${ok ? OKS[(it.n || 0) % OKS.length] : '❌ إجابة خاطئة، شوف الشرح'}</div>
      ${ok ? '' : `<div class="ans">الإجابة الصحيحة: <b>${LETTERS[it.ans]}) ${esc(corr.replace(/^[A-D]\)\s*/, ''))}</b></div>`}
      ${ok ? `<button class="lnk exshow" type="button" onclick="this.nextElementSibling.classList.toggle('on');this.textContent=this.nextElementSibling.classList.contains('on')?'إخفاء الشرح ▴':'عرض الشرح والترجمة ▾'">عرض الشرح والترجمة ▾</button><div class="exwrap">` : ''}
      ${it.exp ? `<div class="exl">الشرح</div><div class="ex">${fmtExp(it.exp)}</div>` : ''}
      ${ytLink(it)}
      ${P && P.set.kind === 'verbal' ? trHtml(it) : ''}${ok ? '</div>' : ''}</div>`;
  }
  function ytLink(it) {
    const yt = ytFor(it.src || (P && P.id)); if (!yt) return '';
    return `<a class="ytx" href="${yt.url}" target="_blank" rel="noopener">${YTSVG}<span>ما وضح لك؟ شاهد شرح ${yt.label} بالفيديو على يوتيوب</span><span class="go">←</span></a>`;
  }
  // 🇸🇦 ترجمة أسئلة الكمي: تظهر قبل الإجابة (الترجمة ما تكشف الحل) ونتذكّر إذا الطالب يفضّلها مفتوحة
  const QTR_LS = 'qg_qtr', QNAMES = new Set(['ahmed', 'khalid', 'khaled', 'mohamed', 'mohammed', 'muhammad', 'sara', 'sarah', 'nora', 'ali', 'saad']);   // أسماء الأشخاص ما تحتاج ترجمة
  // نعزل التعابير الرياضية (x + 3 = 7، m∠ABC…) داخل النص العربي حتى ما يتلخبط ترتيبها
  const MRUN = /[A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*[A-Za-z0-9√π∠△∥][A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*/g;
  function arMath(s) {
    s = String(s || ''); let out = '', last = 0;
    for (const m of s.matchAll(MRUN)) {
      let t = m[0], a = m.index;
      let lead = t.match(/^[\s.,:]*/)[0].length, trail = t.match(/[\s.,:]*$/)[0].length;
      let core = t.slice(lead, t.length - trail);
      while (core.endsWith(')') && (core.match(/\(/g) || []).length < (core.match(/\)/g) || []).length) { core = core.slice(0, -1); trail++; }
      while (core.startsWith('(') && (core.match(/\(/g) || []).length > (core.match(/\)/g) || []).length) { core = core.slice(1); lead++; }
      if (!/[A-Za-z0-9√π∠△∥]/.test(core)) continue;
      out += esc(s.slice(last, a + lead)) + `<bdi dir="ltr">${esc(core)}</bdi>`; last = a + t.length - trail;
    }
    return out + esc(s.slice(last));
  }
  function qtrHtml(it) {
    const ar = it.ar; if (!ar || !ar.q) return ''; const w = (it.wd || []).filter(x => !QNAMES.has(x[0]));
    const ot = (ar.o || []).some(Boolean) ? `<ol class="qt-o">${it.opts.map((o, k) => ar.o[k] ? `<li><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o.replace(/^[A-D]\)\s*/, ''))}</span><span class="arr">${arMath(ar.o[k])}</span></li>` : '').join('')}</ol>` : '';
    return `<details class="qtr" id="qtr" ${lsGet(QTR_LS, 0) ? 'open' : ''}><summary><span class="qt-f" aria-hidden="true">🇸🇦</span>ترجمة السؤال <small>ومعاني الكلمات</small></summary><div class="qt-b"><p class="qt-ar">${arMath(ar.q)}</p><div class="says">${it.en ? sayBtn(it.en, 'en', 'اسمع السؤال بالإنجليزي') : ''}${hasAr() ? sayBtn(ar.q, 'ar', 'اسمع الترجمة') : ''}</div>${ot}${w.length ? `<div class="vcs">${w.map(x => vcChip(x[0], x[1])).join('')}</div>` : ''}</div></details>`;
  }
  // 🇸🇦 ترجمة السؤال والخيارات + كلمات السؤال
  function trHtml(it) {
    const ar = it.ar; let h = '';
    if (ar && ar.q) h += `<details class="tr" open><summary>🇸🇦 ترجمة السؤال</summary><div class="trq">${esc(ar.q)}</div><div class="says">${sayBtn(it.q, 'en', 'اسمع السؤال')}${hasAr() ? sayBtn(ar.q, 'ar', 'اسمع الترجمة') : ''}</div><ol class="tro">${it.opts.map((o, k) => `<li class="${k === it.ans ? 'ok' : ''}"><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o)} ${sayBtn(o, 'en', '', 'sm')}</span><span class="arr">${esc((ar.o || [])[k] || '')}</span></li>`).join('')}</ol></details>`;
    const chips = vocabChips(it.q + ' ' + it.opts.join(' '), 40);
    if (chips) h += `<details class="tr vocab" open><summary>📖 كلمات السؤال <small>(اضغط على أي كلمة في السؤال لترجمتها)</small></summary><div class="vcs">${chips}</div></details>`;
    return h;
  }
  function answer(i, k) {
    const { it } = P.items[i]; if (P.prog.a[i]) return;
    const nowT = Date.now(); const ms = Math.min(Math.max(0, nowT - (P.lastAct || nowT)), Q_CAP); P.lastAct = nowT;
    P.prog.a[i] = { s: k, c: k === it.ans ? 1 : 0, t: nowT, ms }; progSet(P.id, P.prog);
    const good = k === it.ans; const sbi = $('#sb') && $('#sb').children[i]; if (sbi) sbi.className = (good ? 'ok' : 'bad') + ' cur';
    const gbi = $('#spg') && $('#spg').children[i]; if (gbi) { gbi.className = (good ? 'ok' : 'bad') + ' cur'; gbi.setAttribute('aria-label', `سؤال ${i + 1}، إجابتك ${good ? 'صحيحة' : 'خاطئة'}`); }
    P.run = good ? (P.run || 0) + 1 : 0; const rc = $('#run'); if (rc) { if (P.run >= 3) { rc.hidden = false; rc.textContent = '🔥 ' + P.run + ' صح ورا بعض'; rc.classList.remove('bump'); void rc.offsetWidth; rc.classList.add('bump'); } else rc.hidden = true; }
    const today = daysAdd(), goal = goalGet(); if (today === goal) setTimeout(() => toast('🎉 حققت هدف اليوم: ' + goal + ' سؤال!'), 700); else badgeCheckSoon();
    try { const h = histGet(); histMark(h, it.src || P.id, it.sidx != null ? it.sidx : i, k === it.ans, itemTopics(it)); histSet(h); skillsPushSoon(); } catch (e) {}
    document.querySelectorAll('.opt').forEach(b => { b.disabled = true; b.classList.remove('sel'); const kk = +b.dataset.k; if (kk === it.ans) b.classList.add('ok'); else if (kk === k) b.classList.add('bad'); });
    if (!RM()) { const btn = document.querySelector(`.opt[data-k="${k}"]`); if (btn) { if (good) burst(btn.querySelector('.L') || btn); else btn.classList.add('shake'); } }
    $('#fb').innerHTML = feedback(it, P.prog.a[i]);
    const sk = $('#skip'); if (sk) sk.remove();
    const nxo = nextOpen(i);   // بعد الإجابة: التالي = أقرب سؤال ما جاوبته، والنتيجة لما تخلص كل الأسئلة
    const cf = $('#confirm'); if (cf) { cf.outerHTML = `<button class="btn" id="next">${nxo < 0 ? 'النتيجة 🏁' : 'التالي ←'}</button>`; $('#next').onclick = () => { if (nxo >= 0) showQ(nxo); else finish(); }; }
    const kb = $('.kbd'); if (kb) kb.textContent = 'Enter للتالي';
    updateCounter();
    const fbEl = $('#fb'); if (fbEl) setTimeout(() => fbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
  function renderNav() {
    const ng = $('#ng'); ng.innerHTML = sheetBtns();
    ng.onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; $('#nav').classList.remove('open'); showQ(+b.dataset.i); };
  }
  async function finish() {
    const { items, prog, set } = P; const n = items.length; const answered = Object.keys(prog.a).length;
    if (answered < n) { toast('باقي ' + (n - answered) + ' سؤال بدون إجابة'); const f = items.findIndex((x, i) => !prog.a[i]); return showQ(f); }
    const correct = Object.values(prog.a).filter(a => a.c).length; const pct = Math.round(correct * 100 / n);
    const secs = activeSecs(prog);
    const wrong = items.map((x, i) => i).filter(i => prog.a[i] && !prog.a[i].c);
    const firstTime = !prog.done;
    if (prog.best == null || pct > prog.best) prog.best = pct; prog.done = 1; progSet(P.id, prog); setTimeout(badgeCheck, 2200); remCtx();
    document.onkeydown = null;
    const nm = /^([qv])(\d{1,2})$/.exec(set.id), nx = nm && +nm[2] < 14 ? nm[1] + (+nm[2] + 1) : null;
    $('#pm').innerHTML = `<div class="sum"><div class="ring" id="ring" style="--p:0"><b><span id="rp">0</span><small>%</small></b></div>
      <h2>${pct >= 85 ? 'ممتاز! 🌟' : pct >= 70 ? 'جيد جداً 👏' : pct >= 50 ? 'جيد، كمّل تدريب 💪' : 'راجع الشرح وأعد المحاولة 📘'}</h2>
      <p class="ssub">${esc(set.title)} <bdi dir="ltr">${esc(set.sub)}</bdi></p>
      <div class="stats"><div class="ok"><b>${correct}</b><span>صحيحة</span></div><div class="bad"><b>${answered - correct}</b><span>خاطئة</span></div><div><b>${n - answered}</b><span>بدون إجابة</span></div><div><b class="ltr">${fmtDur(secs)}</b><span>الوقت الفعلي</span></div></div>
      <div class="acts sacts">${nx ? `<a class="btn gold" href="#${nx}">التالي: ${SET_NAME(nx)}</a>` : ''}${wrong.length ? `<button class="btn" id="rev">مراجعة الأخطاء (${wrong.length})</button>` : ''}${!nx && !wrong.length ? `<a class="btn gold" href="#">الرئيسية</a>` : ''}</div>
      <div class="slinks"><button class="lnk2" id="again">↻ إعادة ${nm ? (nm[1] === 'q' ? 'القسم' : 'النموذج') : 'الاختبار'}</button>${nm ? `<a class="lnk2" href="#board-set-${set.id}">🏆 ترتيبك في ${SET_NAME(set.id)}</a>` : ''}${ytFor(set.id) ? `<a class="lnk2" href="${ytFor(set.id).url}" target="_blank" rel="noopener">${YTSVG} شرح ${ytFor(set.id).label} بالفيديو</a>` : ''}<a class="lnk2" href="#skills">🎯 نقاط قوتك وضعفك</a></div>
      ${wrong.length ? `<div class="wl"><h3>الأسئلة الخاطئة — اضغط على الرقم لمراجعة الشرح:</h3><div class="ng">${wrong.map(i => `<button class="bad" data-i="${i}">${i + 1}</button>`).join('')}</div></div>` : ''}
      <p id="saved" class="kbd" style="margin-top:14px"></p></div>`;
    $('#again').onclick = () => { const best = prog.best; progSet(P.id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(P.id); };
    const rv = $('#rev'); if (rv) rv.onclick = () => { document.onkeydown = onKey; showQ(wrong[0]); };
    document.querySelectorAll('.wl button').forEach(b => b.onclick = () => { document.onkeydown = onKey; showQ(+b.dataset.i); });
    window.scrollTo(0, 0);
    (function count() { const ring = $('#ring'), rp = $('#rp'); if (!ring) return; if (RM()) { ring.style.setProperty('--p', pct); rp.textContent = pct; return; } const t0 = performance.now(), D = 900; (function f(t) { const e = Math.min(1, (t - t0) / D), v = Math.round(pct * (1 - Math.pow(1 - e, 3))); ring.style.setProperty('--p', v); rp.textContent = v; if (e < 1) requestAnimationFrame(f); })(t0); })();
    if (pct >= 85) setTimeout(confetti, 350);
    skillsPushSoon(1500);
    if (set.topicSet) { $('#saved').textContent = 'تدريب موجّه: يُحتسب في نقاط قوتك وضعفك فقط (لا يدخل لوحة الصدارة)'; return; }
    try {
      if (set.id === 'qall' || set.id === 'vall') {   // نتائج كل قسم/نموذج على حدة (للوحة الصدارة) + ملخص
        const per = {}; items.forEach((x, i) => { const k = x.it.src || set.id; const o = per[k] || (per[k] = { n: 0, c: 0 }); o.n++; if (prog.a[i] && prog.a[i].c) o.c++; });
        const share = n ? secs / n : 0;
        for (const k of Object.keys(per)) { try { await api({ op: 'result', session: auth.session, set: k, kind: set.kind + '-all', n: per[k].n, correct: per[k].c, secs: Math.round(share * per[k].n), wrong: '' }); } catch (e) {} }
      }
      const r = await api({ op: 'result', session: auth.session, set: set.id, kind: set.kind, n, correct, secs, wrong: wrong.map(i => items[i].it.n).join(',') });
      $('#saved').textContent = r.ok ? (r.admin ? 'وضع المشرف: النتيجة لا تُسجّل' : 'تم حفظ نتيجتك ✓') : '';
      if (!r.ok && r.error === 'session') { toast('انتهت الجلسة، سجّل دخولك من جديد'); }
    } catch (e) { $('#saved').textContent = ''; }
  }

  // ---------- 📖 القاموس: تحميل + بحث عن الكلمة ----------
  let VOC = null, vocP = null;
  const STOP = new Set('the a an of to in is are and or but for with on at by it that this as be was were has have had not from they their he she his her we you i our your which who what when where than then there these those its into also can will would could should may might do does did so if no yes all any more most some such very one two three four five six seven eight nine ten each other another both either neither about after before between during through over under up down out off again further once here why how am been being because until while my me him them us whom whose'.split(' '));
  function loadVocab() { if (VOC) return Promise.resolve(VOC); if (vocP) return vocP; vocP = fetch('/p/data/vocab.json', { cache: 'force-cache' }).then(r => r.json()).then(j => (VOC = j)).catch(() => (VOC = {})); return vocP; }
  function vocLook(w) {
    if (!VOC) return ''; w = (w || '').toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/'s$/, ''); if (!w || w.length < 2) return '';
    if (VOC[w]) return VOC[w];
    const tries = [];
    if (/ies$/.test(w)) tries.push(w.slice(0, -3) + 'y'); if (/ied$/.test(w)) tries.push(w.slice(0, -3) + 'y'); if (/es$/.test(w)) tries.push(w.slice(0, -2)); if (/s$/.test(w)) tries.push(w.slice(0, -1));
    if (/ed$/.test(w)) tries.push(w.slice(0, -2), w.slice(0, -1)); if (/ing$/.test(w)) tries.push(w.slice(0, -3), w.slice(0, -3) + 'e'); if (/ly$/.test(w)) tries.push(w.slice(0, -2)); if (/er$/.test(w)) tries.push(w.slice(0, -2), w.slice(0, -1)); if (/est$/.test(w)) tries.push(w.slice(0, -3), w.slice(0, -2));
    if (/(.)\1(ed|ing)$/.test(w)) tries.push(w.replace(/(.)\1(ed|ing)$/, '$1'));
    for (const t of tries) if (t.length > 1 && VOC[t]) return VOC[t];
    return '';
  }
  // يلفّ الكلمات التي لها ترجمة بعنصر قابل للضغط
  function wordsHtml(text) {
    if (!VOC) return esc(text);
    return (text || '').split(/([A-Za-z][A-Za-z'’]*)/).map((w, i) => { if (!(i % 2)) return esc(w); if (STOP.has(w.toLowerCase())) return esc(w); const ar = vocLook(w.replace(/’/g, "'")); return ar ? `<span class="vw" data-ar="${esc(ar)}">${esc(w)}</span>` : esc(w); }).join('');
  }
  const vcChip = (w, ar) => `<button type="button" class="vc" data-say="${esc(w)}" data-lang="en" title="اضغط لسماع النطق"><b>${esc(w)}</b><span>${esc(ar)}</span>${SAYSVG}</button>`;
  function vocabChips(text, max) {
    if (!VOC) return ''; const seen = new Set(); const out = [];
    for (const m of (text || '').matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); out.push(vcChip(w, ar)); if (out.length >= (max || 40)) break; }
    return out.join('');
  }
  // ---------- 🔊 النطق الصوتي (Web Speech API: مجاني ويشتغل على جهاز الطالب) ----------
  const TTS = { ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window, voices: [], btn: null, q: [] };
  const SAYSVG = '<svg class="si" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9.2h3.2L12 5.3v13.4l-4.8-3.9H4z" fill="currentColor"/><path class="w1" d="M15.4 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="w2" d="M18.2 6.6a8 8 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function ttsVoices() { if (!TTS.ok) return []; try { const v = speechSynthesis.getVoices(); if (v && v.length) TTS.voices = v; } catch (e) {} return TTS.voices; }
  if (TTS.ok) { ttsVoices(); try { speechSynthesis.addEventListener('voiceschanged', ttsVoices); } catch (e) {} }
  document.documentElement.classList.toggle('nosay', !TTS.ok);
  function ttsVoice(lang) {
    const vs = ttsVoices(), L = lang.slice(0, 2), pick = list => list.find(v => /google|natural|neural|premium|enhanced|siri/i.test(v.name)) || list.find(v => v.localService) || list[0];
    const exact = vs.filter(v => (v.lang || '').replace('_', '-').toLowerCase() === (lang === 'en' ? 'en-us' : 'ar-sa'));
    return pick(exact) || pick(vs.filter(v => (v.lang || '').toLowerCase().startsWith(L))) || null;
  }
  const hasAr = () => !!ttsVoice('ar');
  // نجهّز النص الإنجليزي للنطق: الكلمات الكبيرة تنقرأ ككلمات، والفراغ «blank»، والرموز الرياضية بالكلام
  function sayPrep(t) {
    t = String(t || '');
    if (!/[a-z]/.test(t) && /[A-Z]{2}/.test(t)) t = t.toLowerCase();
    return t.replace(/_{2,}|\.{4,}|…{2,}/g, ' blank ').replace(/\s:\s/g, ', ').replace(/[“”]/g, '"').replace(/⁻¹/g, ' inverse').replace(/√/g, ' root ').replace(/²/g, ' squared').replace(/³/g, ' cubed').replace(/π/g, ' pi ')
      .replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/≠/g, ' is not equal to ').replace(/≤/g, ' is less than or equal to ').replace(/≥/g, ' is greater than or equal to ').replace(/=/g, ' equals ').replace(/</g, ' is less than ').replace(/>/g, ' is greater than ')
      .replace(/∠/g, ' angle ').replace(/∥/g, ' is parallel to ').replace(/°/g, ' degrees').replace(/%/g, ' percent').replace(/\^/g, ' to the power ').replace(/\s+/g, ' ').trim();
  }
  function sayChunks(t) { const out = []; let cur = ''; (t.match(/[^.!?؟\n]+[.!?؟]*\s*/g) || [t]).forEach(s => { if ((cur + s).length > 190 && cur) { out.push(cur); cur = ''; } cur += s; }); if (cur.trim()) out.push(cur); return out; }
  function sayStop() { if (!TTS.ok) return; TTS.q = []; try { speechSynthesis.cancel(); } catch (e) {} if (TTS.btn) TTS.btn.classList.remove('on'); TTS.btn = null; }
  function say(text, lang, btn) {
    if (!TTS.ok) { toast('متصفحك ما يدعم النطق الصوتي'); return; }
    if (btn && TTS.btn === btn) { sayStop(); return; }   // ضغطة ثانية = إيقاف
    sayStop(); lang = lang === 'ar' ? 'ar' : 'en';
    const v = ttsVoice(lang); if (lang === 'ar' && !v) { toast('ما فيه صوت عربي على جهازك. تقدر تضيفه من إعدادات اللغة والكلام في الجهاز'); return; }
    const txt = lang === 'en' ? sayPrep(text) : String(text || ''); if (!txt) return;
    TTS.q = sayChunks(txt); TTS.btn = btn || null; if (btn) btn.classList.add('on');
    const short = txt.length < 30;
    const next = () => { const s = TTS.q.shift(); if (s == null) { if (TTS.btn) TTS.btn.classList.remove('on'); TTS.btn = null; return; }
      const u = new SpeechSynthesisUtterance(s); u.lang = lang === 'en' ? 'en-US' : 'ar-SA'; if (v) u.voice = v; u.rate = lang === 'en' ? (short ? 0.82 : 0.92) : 0.95;
      u.onend = () => { if (TTS.btn === btn || !btn) next(); }; u.onerror = () => { TTS.q = []; next(); }; speechSynthesis.speak(u); };
    next();
  }
  // زر نطق: data-say = النص، data-lang = en/ar، أو data-say-sel = عنصر نقرأ نصه (مثل القطعة)
  const sayBtn = (text, lang, label, cls) => `<button type="button" class="${label ? 'sayb' : 'say'} ${cls || ''}" data-say="${esc(text)}" data-lang="${lang || 'en'}" title="${lang === 'ar' ? 'استمع للترجمة' : 'استمع للنطق'}" aria-label="${label || (lang === 'ar' ? 'استمع للترجمة' : 'استمع للنطق')}">${SAYSVG}${label ? `<span>${label}</span>` : ''}</button>`;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-say],[data-say-sel]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const el = b.dataset.saySel ? document.querySelector(b.dataset.saySel) : null;
    say(el ? el.textContent : b.dataset.say, b.dataset.lang, b);
  }, true);
  window.addEventListener('hashchange', sayStop);
  let vtip = null;
  function bindWords() {
    if (bindWords.done) return; bindWords.done = true;
    document.addEventListener('click', e => {
      if (e.target.closest('.vtip')) return;
      const w = e.target.closest('.vw'); if (!vtip) { vtip = document.createElement('div'); vtip.className = 'vtip'; document.body.appendChild(vtip); }
      document.querySelectorAll('.vw.hl').forEach(x => x.classList.remove('hl'));
      if (!w) { vtip.classList.remove('on'); return; }
      vtip.innerHTML = `<b class="ltr">${esc(w.textContent)}${sayBtn(w.textContent, 'en', '', 'sm inv')}</b><span>${esc(w.dataset.ar)}</span>`; vtip.classList.add('on'); w.classList.add('hl');
      const r = w.getBoundingClientRect(); const tw = Math.min(260, window.innerWidth - 16); vtip.style.width = tw + 'px';
      vtip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
      const th = vtip.offsetHeight || 60; vtip.style.top = (r.top + window.scrollY - th - 8 > window.scrollY ? r.top + window.scrollY - th - 8 : r.bottom + window.scrollY + 8) + 'px';
    });
  }
  // ---------- 📐 قوانين الكمي ----------
  let RULES = null; const RULES_V = 1, RULES_ON = false;
  async function renderRules() {
    document.title = 'قوانين الكمي | Q-Guide';
    const back = `<a class="ib" href="#" title="الرئيسية">→</a>`;
    if (!RULES) { app.innerHTML = topbar(`<span class="ttl">📐 قوانين الكمي</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; bindCtl();
      try { RULES = await (await fetch('/p/data/rules.json?v=' + RULES_V)).json(); } catch (e) { app.innerHTML = topbar('', back) + '<div class="center">تعذّر التحميل. <a href="#">رجوع</a></div>'; return; } }
    if (location.hash !== '#rules') return;
    const R = YT.q.rules, nItems = RULES.reduce((a, s) => a + s.items.length, 0);
    app.innerHTML = topbar(`<span class="ttl">📐 قوانين الكمي</span><span class="sp"></span><button class="ib" id="prn" title="طباعة / حفظ PDF">🖨️</button>`, back) + `<main class="wrap rules">
      <div class="ru-top"><div><h1>قوانين الكمي</h1><p>${nItems} قانون وقاعدة تحتاجها في القدرات، مرتبة حسب الموضوع ومع مثال لكل قانون. تقدر تطبعها أو تحفظها PDF من زر 🖨️.</p></div>
        <a class="rvid" href="${ytUrl(R.id)}" target="_blank" rel="noopener">${YTSVG}<span>${R.t}</span>${R.dur ? `<small>${R.dur}</small>` : ''}</a></div>
      <div class="ru-bar"><input id="ruq" type="search" placeholder="ابحث عن قانون: مساحة، نسبة، زاوية، area…" autocomplete="off"><span class="mut" id="run"></span></div>
      <nav class="ru-nav" aria-label="المواضيع">${RULES.map(s => `<a href="#rules" data-go="${s.id}">${s.icon} ${esc(s.t)}</a>`).join('')}</nav>
      <div class="ru-cols" id="ruc">${RULES.map(s => `<section class="ru-s" id="ru-${s.id}"><h2><span class="ic" aria-hidden="true">${s.icon}</span>${esc(s.t)}<small dir="ltr">${esc(s.en || '')}</small></h2>
        ${s.items.map(x => `<div class="ru-i" data-k="${esc((x.a + ' ' + x.f + ' ' + (x.en || '') + ' ' + (x.n || '') + ' ' + s.t + ' ' + (s.en || '')).toLowerCase())}"><div class="ru-a">${esc(x.a)}${x.en ? `<small dir="ltr">${esc(x.en)}</small>` : ''}</div><div class="ru-f" dir="ltr">${esc(x.f)}</div>${x.x ? `<div class="ru-x" dir="ltr"><span>e.g.</span> ${esc(x.x)}</div>` : ''}${x.n ? `<div class="ru-n">${esc(x.n)}</div>` : ''}</div>`).join('')}</section>`).join('')}</div>
      <p class="mut ru-empty" id="rue" hidden>ما لقينا قانون بهالكلمة. جرّب كلمة ثانية بالعربي أو الإنجليزي.</p></main>`;
    bindCtl();
    $('#prn').onclick = () => window.print();
    document.querySelectorAll('.ru-nav a').forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById('ru-' + a.dataset.go); if (el) el.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); });
    const q = $('#ruq'), cnt = $('#run'), paint = () => { const v = q.value.trim().toLowerCase(); let n = 0;
      document.querySelectorAll('.ru-s').forEach(s => { let k = 0; s.querySelectorAll('.ru-i').forEach(i => { const on = !v || i.dataset.k.indexOf(v) >= 0; i.hidden = !on; if (on) k++; }); s.hidden = !k; n += k; });
      cnt.textContent = v ? n + ' نتيجة' : ''; $('#rue').hidden = n > 0; };
    q.oninput = paint;
  }

  // ---------- 🔔 التذكير اليومي (إشعارات الجوال) ----------
  const REM_LS = 'qg_rem';
  const remSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const remGet = () => lsGet(REM_LS, null);
  const fmtMins = m => fmtTime(new Date(2000, 0, 1, Math.floor(m / 60), m % 60).getTime());
  function remLabel() { const r = remGet(); return r && r.on ? `مفعّل كل يوم الساعة ${fmtMins(r.mins)}` : 'تنبيه يومي على جوالك بوقت مذاكرتك'; }
  const b64uToU8 = s => { const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  async function remSubscribe(mins) {
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed');
    const k = await api({ op: 'push_key', session: auth.session }); if (!k.ok) throw new Error(k.msg || k.error || 'key');
    const key = b64uToU8(k.key); let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey) { const a = new Uint8Array(sub.options.applicationServerKey); if (a.length !== key.length || a.some((x, i) => x !== key[i])) { await sub.unsubscribe(); sub = null; } }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const r = await api({ op: 'push_sub', session: auth.session, sub: sub.toJSON(), mins, tz: -new Date().getTimezoneOffset() }); if (!r.ok) throw new Error(r.msg || r.error || 'sub');
    lsSet(REM_LS, { on: 1, mins, ep: sub.endpoint }); remCtx(true); return r;
  }
  async function remOff() { const r = remGet(); try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await api({ op: 'push_unsub', session: auth.session, endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) {} lsSet(REM_LS, { on: 0, mins: r ? r.mins : 1200 }); }
  // نص التنبيه يتجهّز على الجهاز (سلسلة الأيام، كم باقي على الاختبار، مهمة اليوم من الخطة) ويقرأه الـ Service Worker وقت التنبيه
  function remCtx(force) {
    const r = remGet(); if (!force && !(r && r.on)) return; if (!('caches' in window)) return;
    try {
      const D = daysGet(), keys = Object.keys(D).filter(k => D[k] > 0).sort(), ex = examGet(), st = planState(), plan = PLANS.find(p => p.id === st.id);
      let task = ''; if (plan) { const I = planInfo(plan, st); if (I.cur) task = I.cur.tasks.map(t => t.set ? SET_NAME(t.set) : t.k === 'rest' ? 'يوم راحة' : (t.links && t.links[0] ? t.links[0][1] : '')).filter(Boolean).join(' و'); }
      let next = ''; try { if (manifest) next = SET_NAME(pickResume().s.id); } catch (e) {}
      const c = { name: ((auth && (auth.display || auth.name)) || '').trim().split(/\s+/)[0], streak: streakOf(D), last: keys[keys.length - 1] || '', exam: ex ? examAt(ex) : 0, task, next, at: Date.now() };
      caches.open('qg-meta').then(cc => cc.put('/__rem', new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } }))).catch(() => {});
    } catch (e) {}
  }
  function remDlg() {
    return new Promise(res => {
      const box = document.createElement('div'); box.className = 'modal'; document.body.appendChild(box);
      const close = () => { box.remove(); document.removeEventListener('keydown', onK); res(); };
      const onK = e => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onK);
      box.addEventListener('click', e => { if (e.target === box) close(); });
      const draw = () => {
        const r = remGet(), on = !!(r && r.on), mins = r && r.mins != null ? r.mins : 20 * 60, perm = 'Notification' in window ? Notification.permission : 'default';
        let body;
        if (!remSupported() && isIOS() && !isStandalone()) body = `<p>على الآيفون، التنبيهات تشتغل لما تضيف المنصة للشاشة الرئيسية:</p>
          <ol class="rem-ios"><li>افتح المنصة من متصفح <b>Safari</b></li><li>اضغط زر المشاركة <span class="ios-share" aria-hidden="true">⬆︎</span> تحت</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>افتح Q-Guide من الأيقونة الجديدة، وسجّل دخولك، ثم فعّل التذكير من هنا</li></ol><p class="mut">يحتاج iOS 16.4 أو أحدث.</p>`;
        else if (!remSupported()) body = `<p>متصفحك الحالي ما يدعم التنبيهات. جرّب من Google Chrome على الجوال أو الكمبيوتر.</p>`;
        else if (perm === 'denied') body = `<p>التنبيهات مقفلة لهذا الموقع في متصفحك. افتح إعدادات الموقع (🔒 جنب الرابط فوق) ← <b>الإشعارات</b> ← <b>السماح</b>، ثم ارجع هنا وفعّل التذكير.</p>`;
        else body = `<p>نرسل لك تنبيه كل يوم بالوقت اللي تختاره، فيه مهمتك من الخطة وكم باقي على اختبارك. <b>وإذا ذاكرت قبل الموعد ما نزعجك.</b></p>
          <div class="exf rem-f"><label><span>وقت التذكير</span><input type="time" id="remt" value="${p2(Math.floor(mins / 60))}:${p2(mins % 60)}" dir="ltr" step="300"></label><div class="rem-st ${on ? 'on' : ''}">${on ? '🔔 مفعّل' : '🔕 غير مفعّل'}</div></div>
          <div class="acts"><button class="btn" id="remon">${on ? 'حفظ الوقت' : 'فعّل التذكير'}</button>${on ? '<button class="btn ghost" id="remtest">أرسل تنبيه تجريبي</button><span class="sp"></span><button class="lnk" id="remoff">إيقاف التذكير</button>' : '<button class="btn ghost" id="remno">إلغاء</button>'}</div>`;
        box.innerHTML = `<div class="m exm rem" role="dialog" aria-modal="true" aria-labelledby="remh"><h3 id="remh">🔔 التذكير اليومي</h3>${body}${body.indexOf('id="remon"') < 0 ? '<div class="acts"><button class="btn" id="remno">تمام</button></div>' : ''}</div>`;
        const no = $('#remno'); if (no) no.onclick = close;
        const ob = $('#remon'); if (ob) ob.onclick = async () => {
          const v = ($('#remt').value || '20:00').split(':'), m = (+v[0] || 0) * 60 + (+v[1] || 0);
          ob.disabled = true; ob.textContent = 'جارٍ التفعيل…';
          try { await remSubscribe(m); toast(`🔔 تم! بنذكّرك كل يوم الساعة ${fmtMins(m)}`); draw(); }
          catch (e) { ob.disabled = false; ob.textContent = 'فعّل التذكير'; toast(e.message === 'denied' ? 'رفضت التنبيهات من المتصفح' : e.message === 'dismissed' ? 'لازم توافق على التنبيهات عشان يشتغل التذكير' : 'تعذّر التفعيل، حاول مرة ثانية'); if (e.message === 'denied') draw(); }
        };
        const tb = $('#remtest'); if (tb) tb.onclick = async () => { tb.disabled = true; remCtx(true); try { const r2 = await api({ op: 'push_test', session: auth.session, endpoint: (remGet() || {}).ep }); toast(r2.ok ? 'أرسلنا تنبيه تجريبي، بيوصلك خلال ثواني' : (r2.msg || 'تعذّر الإرسال')); if (r2.error === 'gone' || r2.error === 'not subscribed') { lsSet(REM_LS, { on: 0, mins: (remGet() || {}).mins || 1200 }); draw(); } } catch (e) { toast('تعذّر الإرسال'); } tb.disabled = false; };
        const fb = $('#remoff'); if (fb) fb.onclick = async () => { await remOff(); toast('أوقفنا التذكير اليومي'); draw(); };
      };
      draw();
    });
  }

  // ---------- 🃏 بطاقات الحفظ (نموذج أولي للمشرفين) ----------
  const FC_LS = 'qg_fc', FC_DAYS = [0, 1, 2, 4, 7, 14];
  function fcGet() { return lsGet(FC_LS, { v: 1, w: {}, mode: 'en' }); }
  function fcMerge(rem) { if (!rem || !rem.w) return; const F = fcGet(); let ch = false; for (const k in rem.w) { const r = rem.w[k], l = F.w[k]; if (Array.isArray(r) && (!l || (r[2] || 0) > (l[2] || 0))) { F.w[k] = r; ch = true; } } if (ch) lsSet(FC_LS, F); }
  function fcSentence(txt, at) { let a = at, b = at; while (a > 0 && !/[.!?\n]/.test(txt[a - 1])) a--; while (b < txt.length && !/[.!?\n]/.test(txt[b])) b++; const s = txt.slice(a, b + 1).trim(); return s.length > 170 ? s.slice(Math.max(0, at - a - 70), at - a + 90).trim() + '…' : s; }
  async function fcWords(model) {
    const set = await loadSet(model); await loadVocab(); const seen = new Set(), out = [];
    const add = (txt, src) => { for (const m of (txt || '').matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); out.push({ w, ar, ex: fcSentence(txt, m.index), src }); } };
    // كلمات الأسئلة والخيارات (بدون القطع الطويلة). المثال = جملة السؤال، أو الخيار نفسه لو كان زوج كلمات (تناظر)
    set.groups.forEach(g => { if (g.kind !== 'passage') g.items.forEach(it => { add(it.q, model); it.opts.forEach(o => { const n0 = out.length; add(o, model); if (!/:/.test(o)) for (let k = n0; k < out.length; k++) out[k].ex = ''; }); }); });
    return out;
  }
  async function fcMistakeWords() {
    const h = histGet(), out = [], seen = new Set(); await loadVocab();
    for (let m = 1; m <= 14; m++) { const id = 'v' + m, hi = h.items[id]; if (!hi) continue; const wrong = Object.keys(hi).filter(i => !hi[i][2]).map(Number); if (!wrong.length) continue;
      const set = await loadSet(id), flat = flatItems(set);
      wrong.forEach(i => { const f = flat[i]; if (!f) return; const txt = f.it.q + ' ' + f.it.opts.join(' '); for (const mm of txt.matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = mm[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); out.push({ w, ar, ex: fcSentence(f.it.q, f.it.q.toLowerCase().indexOf(w)) || f.it.q, src: id }); } }); }
    return out;
  }
  const fcDue = (F, w, now) => { const e = F.w[w]; return !e || e[1] <= now; };
  async function renderCards() {
    document.title = 'بطاقات الحفظ | Q-Guide'; document.onkeydown = null;
    const back = `<a class="ib" href="#" title="الرئيسية">→</a>`;
    app.innerHTML = topbar(`<span class="ttl">🃏 بطاقات الحفظ</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تجهيز البطاقات…</span></div>'; bindCtl();
    let decks = await Promise.all(Array.from({ length: 14 }, (_, i) => fcWords('v' + (i + 1)).catch(() => [])));
    if (location.hash !== '#cards') return;
    const inModels = {}; decks.forEach(d => d.forEach(x => { inModels[x.w] = (inModels[x.w] || 0) + 1; }));
    decks = decks.map(d => d.filter(x => inModels[x.w] < 5));   // نشيل الكلمات العامة اللي تتكرر في أغلب النماذج
    const F = fcGet(), now = Date.now();
    const stats = list => { let learned = 0, due = 0, fresh = 0; list.forEach(x => { const e = F.w[x.w]; if (!e) fresh++; else { if (e[0] >= 3) learned++; if (e[1] <= now) due++; } }); return { learned, due, fresh, n: list.length }; };
    const all = []; const seenAll = new Set(); decks.forEach(d => d.forEach(x => { if (!seenAll.has(x.w)) { seenAll.add(x.w); all.push(x); } }));
    const dueAll = all.filter(x => F.w[x.w] && F.w[x.w][1] <= now);
    app.innerHTML = topbar(`<span class="ttl">🃏 بطاقات الحفظ</span>`, back) + `<main class="wrap fcards">
      <div class="fc-top"><div><h1>بطاقات الحفظ <span class="beta">تجريبي</span></h1><p>كلمات النماذج اللفظية على شكل بطاقات: تشوف الكلمة، تتذكّر معناها، وتقلب البطاقة. الكلمة اللي ما عرفتها ترجع لك أسرع، واللي عرفتها تتباعد مراجعتها.</p></div>
        <div class="fc-mode" role="group" aria-label="اتجاه البطاقة"><button data-m="en" class="${F.mode !== 'ar' ? 'on' : ''}">إنجليزي ← عربي</button><button data-m="ar" class="${F.mode === 'ar' ? 'on' : ''}">عربي ← إنجليزي</button></div></div>
      <div class="fc-today"><div><b>مراجعة اليوم</b><span>${dueAll.length ? `${dueAll.length} كلمة جا وقت مراجعتها` : 'ما عندك مراجعات اليوم، ابدأ مجموعة جديدة'}</span></div><button class="btn gold" id="fcdue" ${dueAll.length ? '' : 'disabled'}>راجع الحين</button><button class="btn ghost" id="fcmis">كلمات أسئلتي الغلط</button></div>
      <div class="fc-decks">${decks.map((d, i) => { const s = stats(d); return `<button class="fc-deck" data-d="${i}"><b>النموذج ${i + 1}</b><span class="mut">${d.length} كلمة</span><span class="fc-bar"><i style="width:${s.n ? Math.round(s.learned * 100 / s.n) : 0}%"></i></span><small>${s.learned} محفوظة${s.due ? ` · <em>${s.due} للمراجعة</em>` : ''}</small></button>`; }).join('')}</div></main>`;
    bindCtl();
    document.querySelectorAll('.fc-mode button').forEach(b => b.onclick = () => { const G = fcGet(); G.mode = b.dataset.m; lsSet(FC_LS, G); document.querySelectorAll('.fc-mode button').forEach(x => x.classList.toggle('on', x === b)); });
    const pick = list => { const G = fcGet(), t = Date.now(); const due = list.filter(x => G.w[x.w] && G.w[x.w][1] <= t), fresh = list.filter(x => !G.w[x.w]); return due.concat(fresh).slice(0, 20); };
    document.querySelectorAll('.fc-deck').forEach(b => b.onclick = () => { const s = pick(decks[+b.dataset.d]); if (!s.length) return toast('حفظت كل كلمات هذا النموذج 👏 ارجع لها وقت المراجعة'); fcRun(s, 'النموذج ' + (+b.dataset.d + 1)); });
    $('#fcdue').onclick = () => fcRun(dueAll.slice(0, 30), 'مراجعة اليوم');
    $('#fcmis').onclick = async () => { const l = await fcMistakeWords(); if (!l.length) return toast('ما عندك أسئلة لفظي غلط محفوظة'); fcRun(pick(l).length ? pick(l) : l.slice(0, 20), 'كلمات أسئلتي الغلط'); };
  }
  function fcRun(list, title) {
    const S = { list: list.slice(), i: 0, ok: [], no: [], title };
    const paint = () => {
      const G = fcGet(), arMode = G.mode === 'ar', x = S.list[S.i], n = S.list.length;
      if (!x) return fcDone(S);
      const front = arMode ? `<span class="fc-ar">${esc(x.ar)}</span>` : `<span class="fc-w ltr">${esc(x.w)}</span>${sayBtn(x.w, 'en', '', 'fc-say')}`;
      const back = `<span class="fc-w ltr">${esc(x.w)}</span>${sayBtn(x.w, 'en', '', 'fc-say')}<span class="fc-ar">${esc(x.ar)}</span>${x.ex ? `<p class="fc-ex ltr">${esc(x.ex).replace(new RegExp('\\b(' + x.w.replace(/[^a-z']/g, '') + ')', 'i'), '<mark>$1</mark>')}</p>${sayBtn(x.ex, 'en', 'اسمع الجملة', 'fc-sayx')}` : ''}<small class="mut">${esc(SET_NAME(x.src))}</small>`;
      app.innerHTML = topbar(`<span class="ttl">🃏 ${esc(S.title)}</span><span class="sp"></span><span class="chip cnt" dir="ltr">${S.i + 1} / ${n}</span>`, `<a class="ib" href="#cards" title="رجوع للمجموعات">→</a>`) + `<main class="wrap fcards fc-run">
        <div class="fc-prog"><i style="width:${Math.round(S.i * 100 / n)}%"></i></div>
        <div class="fc-card" id="fcc" tabindex="0" role="button" aria-label="اقلب البطاقة"><div class="fc-in"><div class="fc-f">${front}<span class="fc-hint">اضغط على البطاقة عشان تقلبها</span></div><div class="fc-b" aria-hidden="true">${back}</div></div></div>
        <div class="fc-acts" id="fca"></div><p class="kbd fc-k" id="fck"></p></main>`;
      bindCtl();
      const card = $('#fcc'), acts = $('#fca'), kb = $('#fck');
      const ans = known => { const G2 = fcGet(), e = G2.w[x.w] || [0, 0, 0]; const box = known ? Math.min(5, e[0] + 1) : 0; G2.w[x.w] = [box, Date.now() + FC_DAYS[box] * 864e5 - (known ? 36e5 : 0), Date.now()]; lsSet(FC_LS, G2); skillsPushSoon(8000);
        (known ? S.ok : S.no).push(x); if (!known && S.list.filter(y => y.w === x.w).length < 2) S.list.push(x); S.i++; sayStop(); paint(); };
      const setFlip = on => { card.classList.toggle('flip', on); card.querySelector('.fc-b').setAttribute('aria-hidden', !on); card.querySelector('.fc-f').setAttribute('aria-hidden', on);
        acts.innerHTML = on ? '<button class="btn fc-no" id="fcno">✗ ما عرفتها</button><button class="btn fc-ok" id="fcok">✓ عرفتها</button>' : '<button class="btn" id="fcfl">اقلب البطاقة</button>';
        kb.textContent = on ? 'مفتاح 1 = ما عرفتها · 2 = عرفتها · أو اسحب البطاقة يمين أو يسار' : 'المسافة أو Enter لقلب البطاقة';
        const fl = $('#fcfl'); if (fl) fl.onclick = () => setFlip(true); const ok = $('#fcok'), no = $('#fcno'); if (ok) ok.onclick = () => ans(true); if (no) no.onclick = () => ans(false); };
      setFlip(false);
      card.onclick = e => { if (e.target.closest('.say,.sayb')) return; setFlip(!card.classList.contains('flip')); };
      let sx = null; card.onpointerdown = e => { sx = e.clientX; }; card.onpointerup = e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (card.classList.contains('flip') && Math.abs(dx) > 70) ans(dx > 0); };
      document.onkeydown = e => { const k = e.key, on = card.classList.contains('flip'); if (k === ' ' || k === 'Enter') { e.preventDefault(); setFlip(!on); } else if (on && (k === '1' || k === '2')) ans(k === '2'); };
    };
    paint();
  }
  function fcDone(S) {
    document.onkeydown = null; const uniqNo = [...new Map(S.no.map(x => [x.w, x])).values()];
    app.innerHTML = topbar(`<span class="ttl">🃏 ${esc(S.title)}</span>`, `<a class="ib" href="#cards" title="رجوع للمجموعات">→</a>`) + `<main class="wrap fcards"><div class="sum fc-sum"><div style="font-size:44px">🃏</div><h2>خلّصت الجولة!</h2>
      <div class="stats"><div class="ok"><b>${new Set(S.ok.map(x => x.w)).size}</b><span>عرفتها</span></div><div class="bad"><b>${uniqNo.length}</b><span>ما عرفتها</span></div></div>
      ${uniqNo.length ? `<p class="mut">الكلمات اللي ما عرفتها ترجع لك أول البطاقات المرة الجاية:</p><div class="vcs fc-miss">${uniqNo.map(x => vcChip(x.w, x.ar)).join('')}</div>` : '<p class="mut">ممتاز! كل الكلمات عرفتها 👏</p>'}
      <div class="acts sacts">${uniqNo.length ? '<button class="btn gold" id="fcagain">راجع اللي ما عرفتها</button>' : ''}<a class="btn" href="#cards">مجموعات ثانية</a></div></div></main>`;
    bindCtl();
    const a = $('#fcagain'); if (a) a.onclick = () => fcRun(uniqNo, S.title);
  }

  // ---------- 🧭 اختبار تحديد المستوى ----------
  const LVL_LS = 'qg_level', LVLRUN_LS = 'qg_level_run';
  const LEVELS = { 1: { t: 'مبتدئ', d: 'تحتاج تبني الأساس: ابدأ بمقاطع القواعد وخطة طويلة، وخذ الأقسام بالترتيب بدون استعجال.' }, 2: { t: 'متوسط', d: 'عندك أساس كويس، والتدريب المنتظم على نقاط ضعفك يرفع مستواك بسرعة.' }, 3: { t: 'جيد', d: 'مستواك جيد! ركّز على أخطائك والأسئلة اللي تاخذ وقت عشان توصل للتسعين.' }, 4: { t: 'متقدم', d: 'ممتاز! حافظ على مستواك بالاختبارات المحاكية ومراجعة أخطائك أول بأول.' } };
  const lvlOf = p => p >= 85 ? 4 : p >= 65 ? 3 : p >= 45 ? 2 : 1;
  const LVPLAN = { 1: 'relaxed', 2: 'balanced', 3: 'intense', 4: 'strong' };
  let LV = null;   // حالة الاختبار الجاري
  async function renderLevel(mode) {
    document.title = 'تحديد المستوى | Q-Guide'; document.onkeydown = null;
    const back = `<a class="ib" href="#" title="الرئيسية">→</a>`;
    app.innerHTML = topbar(`<span class="ttl">🧭 تحديد المستوى</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span>تجهيز الأسئلة…</span></div>';
    bindCtl();
    let set; try { set = await loadSet('placement'); } catch (e) { app.innerHTML = topbar('', back) + '<div class="center">تعذّر تحميل الاختبار. <a href="#">رجوع</a></div>'; return; }
    if (location.hash !== '#level') return;
    if (!skillsPulled) await skillsPull();
    const res = lsGet(LVL_LS, null), run = lsGet(LVLRUN_LS, null);
    if (mode === 'review' && res) return levelReview(set, res);
    if (mode !== 'run' && !run) return levelIntro(set, res);
    LV = { set, a: (run && run.a) || {}, t0: (run && run.t0) || Date.now(), cur: (run && run.cur) || 0 };
    if (!run) lsSet(LVLRUN_LS, { a: {}, t0: LV.t0, cur: 0 });
    levelQ(LV.cur);
  }
  function levelIntro(set, res) {
    const nv = set.items.filter(x => x.k === 'v').length, nq = set.items.length - nv;
    app.innerHTML = topbar(`<span class="ttl">🧭 تحديد المستوى</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap lvl">
      <div class="lv-in"><span class="lv-ic" aria-hidden="true">🧭</span><h1>اعرف مستواك قبل لا تبدأ</h1>
        <p>${set.items.length} سؤال من نفس أسئلة الدورة (${nv} لفظي + ${nq} كمي) تغطي كل المهارات. بعدها نعطيك مستواك، ونقاط قوتك وضعفك، والخطة اللي تناسبك.</p>
        <ul class="lv-f"><li><b>⏱ حوالي 20 دقيقة</b><span>خذ وقتك، ما فيه مؤقت يقفل عليك</span></li><li><b>🙈 بدون شرح أثناء الحل</b><span>الإجابات والشرح تطلع لك بعد ما تخلص</span></li><li><b>↺ تقدر تعيده</b><span>بعد ما تذاكر، عشان تشوف كم تحسّنت</span></li></ul>
        <button class="btn gold lv-go" id="lvgo">${res ? 'أعد الاختبار' : 'ابدأ الاختبار'}</button>
        ${res ? `<p class="lv-prev">نتيجتك السابقة: <b>${res.pct}%</b> (${LEVELS[res.lvl].t}) · ${fmtDay(res.at)} · <a href="#" id="lvres">شوف التفاصيل</a></p>` : ''}</div></main>`;
    bindCtl();
    $('#lvgo').onclick = () => { lsSet(LVLRUN_LS, { a: {}, t0: Date.now(), cur: 0 }); renderLevel('run'); };
    const r = $('#lvres'); if (r) r.onclick = e => { e.preventDefault(); levelResult(set, res); };
  }
  function levelQ(i) {
    const { set } = LV, items = set.items, it = items[i], n = items.length; LV.cur = i;
    lsSet(LVLRUN_LS, { a: LV.a, t0: LV.t0, cur: i });
    const sec = it.k === 'q' ? 'الكمي' : 'اللفظي · ' + (TOPICS[it.topic] || {}).t;
    const sel = LV.a[i];
    let body = '';
    if (it.type === 'read') body += `<details class="lv-pass" ${i === 0 || items[i - 1].type !== 'read' ? 'open' : ''}><summary>📄 القطعة: ${esc(it.ptitle || '')}</summary><div class="pb ltr">${esc(it.passage)}</div></details>`;
    body += it.k === 'q' ? `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${i + 1}">` : `<p class="txt ltr">${esc(it.q)}</p>`;
    const two = it.k === 'q' || it.opts.every(o => o.length <= 28);
    body += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => `<button class="opt ${sel === k ? 'sel' : ''}" data-k="${k}"><span class="L">${LETTERS[k]}</span><span>${esc(it.k === 'q' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></button>`).join('') + '</div>';
    const done = Object.keys(LV.a).length;
    app.innerHTML = topbar(`<span class="ttl">🧭 تحديد المستوى</span><span class="sp"></span><span class="chip lv-t" id="lvt" dir="ltr">0:00</span><span class="chip cnt" dir="ltr">${i + 1} / ${n}</span>`, `<a class="ib" href="#" title="خروج (يتحفظ وين وقفت)">→</a>`) +
      `<div class="sbar" style="--n:${n}" aria-hidden="true">${items.map((x, k) => `<i class="${LV.a[k] != null ? 'ans' : ''}${k === i ? ' cur' : ''}"></i>`).join('')}</div>
      <main class="wrap lvl"><div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${n}</small></span><span class="tag">${sec}</span></div>${body}
        <div class="acts"><button class="btn ghost sm" id="lvp" ${i === 0 ? 'disabled' : ''}>→ السابق</button><span class="sp"></span><span class="mut lv-c">جاوبت ${done} من ${n}</span>
          ${i + 1 < n ? `<button class="btn" id="lvn">${sel != null ? 'التالي ←' : 'تخطَّ ←'}</button>` : `<button class="btn gold" id="lvf">إنهاء الاختبار ✓</button>`}</div></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    const tick = () => { const el = $('#lvt'); if (!el) return; el.textContent = fmtDur(Math.round((Date.now() - LV.t0) / 1000)); };
    tick(); clearInterval(LV.tm); LV.tm = setInterval(tick, 1000);
    document.querySelectorAll('.lvl .opt').forEach(b => b.onclick = () => { LV.a[i] = +b.dataset.k; lsSet(LVLRUN_LS, { a: LV.a, t0: LV.t0, cur: i }); document.querySelectorAll('.lvl .opt').forEach(x => x.classList.toggle('sel', x === b)); const nb = $('#lvn'); if (nb) nb.textContent = 'التالي ←'; const c = $('.lv-c'); if (c) c.textContent = `جاوبت ${Object.keys(LV.a).length} من ${n}`; const s = $('.sbar') && $('.sbar').children[i]; if (s) s.classList.add('ans'); });
    $('#lvp').onclick = () => levelQ(i - 1);
    const nb = $('#lvn'); if (nb) nb.onclick = () => levelQ(i + 1);
    const fb = $('#lvf'); if (fb) fb.onclick = async () => { const un = n - Object.keys(LV.a).length; if (un && !await QGDlg.confirm(`باقي ${un} سؤال بدون إجابة وتنحسب خطأ. تنهي الاختبار؟`, { ok: 'إنهاء' })) return; levelFinish(); };
    document.onkeydown = e => { if (e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.toLowerCase(), idx = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k); if (idx >= 0) { const b = document.querySelectorAll('.lvl .opt')[idx]; if (b) b.click(); } else if (k === 'enter' || k === 'arrowleft') { const b = $('#lvn') || $('#lvf'); if (b) b.click(); } else if (k === 'arrowright') { const b = $('#lvp'); if (b && !b.disabled) b.click(); } };
  }
  function levelFinish() {
    const { set, a, t0 } = LV; clearInterval(LV.tm); document.onkeydown = null;
    const items = set.items, topics = {}; let ok = 0, v = 0, vn = 0, q = 0, qn = 0;
    const h = histGet();
    items.forEach((it, i) => { const c = a[i] === it.ans; if (c) ok++; if (it.k === 'v') { vn++; if (c) v++; } else { qn++; if (c) q++; }
      itemTopics(it).forEach(t => { const x = topics[t] || (topics[t] = [0, 0]); x[1]++; if (c) x[0]++; });
      if (a[i] != null) histMark(h, it.src, it.sidx, c, itemTopics(it)); });
    histSet(h);
    const pct = Math.round(ok * 100 / items.length), res = { at: Date.now(), pct, ok, n: items.length, v: [v, vn], q: [q, qn], lvl: lvlOf(pct), topics, secs: Math.round((Date.now() - t0) / 1000), a };
    lsSet(LVL_LS, res); lsDel(LVLRUN_LS); daysGet(); skillsPushSoon(1500); setTimeout(badgeCheck, 1800);
    levelResult(set, res, true);
  }
  function levelResult(set, res, fresh) {
    const L = LEVELS[res.lvl], st = planState(), cur = PLANS.find(p => p.id === st.id);
    const ex = examGet(), exT = ex ? examAt(ex) : 0; let rec = PLANS.find(p => p.id === LVPLAN[res.lvl]);
    if (exT > Date.now()) { const fits = PLANS.filter(p => dayDiff(addDays(day0(), p.days - 1), exT) >= 1); rec = fits.length ? fits.reduce((x, y) => y.days > x.days ? y : x) : PLANS[0]; }
    const tp = TOPIC_ORDER.filter(t => res.topics[t]).map(t => ({ t, ok: res.topics[t][0], n: res.topics[t][1] }));
    const weak = tp.filter(x => x.ok < x.n).sort((x, y) => x.ok / x.n - y.ok / y.n).slice(0, 3);
    app.innerHTML = topbar(`<span class="ttl">🧭 نتيجة تحديد المستوى</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap lvl">
      <div class="sum lv-res"><div class="ring" id="ring" style="--p:${fresh ? 0 : res.pct}"><b><span id="rp">${fresh ? 0 : res.pct}</span><small>%</small></b></div>
        <span class="lv-badge l${res.lvl}">مستواك: ${L.t}</span><p class="lv-d">${L.d}</p>
        <div class="lv-split"><div><span>📖 اللفظي</span><b>${res.v[0]}<small>/${res.v[1]}</small></b><div class="bar"><i style="width:${Math.round(res.v[0] * 100 / res.v[1])}%"></i></div></div><div><span>📐 الكمي</span><b>${res.q[0]}<small>/${res.q[1]}</small></b><div class="bar"><i style="width:${Math.round(res.q[0] * 100 / res.q[1])}%"></i></div></div><div><span>⏱ الوقت</span><b class="ltr">${fmtDur(res.secs)}</b></div></div></div>
      <div class="lv-grid">
        <section class="lv-card"><h3>المهارات</h3>${tp.map(x => `<div class="lv-tp ${x.ok === x.n ? 'ok' : x.ok === 0 ? 'bad' : 'mid'}"><span>${TOPICS[x.t].i} ${TOPICS[x.t].t}</span><b>${x.ok}/${x.n}</b></div>`).join('')}</section>
        <section class="lv-card"><h3>ابدأ من هنا</h3>
          ${weak.length ? `<p class="mut">أضعف مهاراتك في هذا الاختبار، تدرّب عليها بأسئلة من كل الأقسام:</p><div class="lv-tr">${weak.map(x => `<a class="btn sm ghost" href="#t-${x.t}">${TOPICS[x.t].i} ${TOPICS[x.t].t}</a>`).join('')}</div>` : '<p class="mut">جاوبت كل المهارات صح 👏 كمّل على الاختبارات المحاكية.</p>'}
          <div class="lv-plan"><span>الخطة المقترحة${exT > Date.now() ? ' لموعد اختبارك' : ' لمستواك'}:</span><b>${rec.name} <small>(${rec.days} يوماً · ${rec.daily})</small></b>
            ${cur ? (cur.id === rec.id ? '<span class="fit ok">✓ هي نفس خطتك الحالية</span>' : `<span class="mut">خطتك الحالية: ${cur.name}</span> <a href="#plan">غيّرها من صفحة الخطة</a>`) : `<button class="btn gold sm" id="lvplan">ابدأ ${rec.name}</button>`}</div></section></div>
      <div class="acts lv-acts"><button class="btn" id="lvrev">مراجعة إجاباتك مع الشرح</button><a class="btn ghost" href="#">الرئيسية</a><button class="lnk2" id="lvagain">↻ أعد الاختبار</button></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    if (fresh) { const rp = $('#rp'), ring = $('#ring'); if (RM()) { rp.textContent = res.pct; ring.style.setProperty('--p', res.pct); } else { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 900), v = Math.round(res.pct * (1 - Math.pow(1 - k, 3))); rp.textContent = v; ring.style.setProperty('--p', v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } if (res.pct >= 85 && !RM()) setTimeout(confetti, 600); }
    const pb = $('#lvplan'); if (pb) pb.onclick = () => { const all = lsGet('qg_plan_all', {}); planSave({ id: rec.id, done: all[rec.id] || {}, started: Date.now() }); location.hash = 'plan'; };
    $('#lvrev').onclick = () => levelReview(set, res);
    $('#lvagain').onclick = () => { lsSet(LVLRUN_LS, { a: {}, t0: Date.now(), cur: 0 }); renderLevel('run'); };
  }
  function levelReview(set, res) {
    app.innerHTML = topbar(`<span class="ttl">🧭 مراجعة إجاباتك</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap lvl lv-rv">
      <p class="mut">الأخضر الإجابة الصحيحة، والأحمر إجابتك لو كانت خطأ. كل سؤال معه شرحه.</p>
      ${set.items.map((it, i) => { const a = res.a[i], ok = a === it.ans; return `<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>${it.k === 'q' ? 'الكمي' : (TOPICS[it.topic] || {}).t}</small></span><span class="tag ${ok ? 'ok' : 'bad'}">${ok ? '✓ صح' : a == null ? '— ما جاوبت' : '✗ خطأ'}</span></div>
        ${it.type === 'read' ? `<details class="lv-pass"><summary>📄 القطعة: ${esc(it.ptitle || '')}</summary><div class="pb ltr">${esc(it.passage)}</div></details>` : ''}
        ${it.k === 'q' ? `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="">` : `<p class="txt ltr">${esc(it.q)}</p>`}
        <div class="opts ${it.k === 'q' || it.opts.every(o => o.length <= 28) ? 'two' : ''}">${it.opts.map((o, k) => `<div class="opt ${k === it.ans ? 'ok' : k === a ? 'bad' : ''}"><span class="L">${LETTERS[k]}</span><span>${esc(it.k === 'q' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></div>`).join('')}</div>
        ${it.exp ? `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="exl">الشرح</div><div class="ex">${fmtExp(it.exp)}</div></div>` : ''}</div>`; }).join('')}
      <div class="acts lv-acts"><a class="btn" href="#">الرئيسية</a><button class="btn ghost" id="lvback">↩ النتيجة</button></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    $('#lvback').onclick = () => levelResult(set, res);
  }

  // ---------- 🏅 الشارات (تنحسب من نشاط الطالب على جهازه وتتزامن مع حسابه) ----------
  const BADGE_LS = 'qg_badges';
  const BADGES = [
    { id: 'first', i: '✏️', t: 'البداية', d: 'جاوبت أول سؤال', v: S => S.total, n: 1, u: 'سؤال' },
    { id: 'q100', i: '💯', t: '100 سؤال', d: 'حليت 100 سؤال', v: S => S.total, n: 100, u: 'سؤال' },
    { id: 'q500', i: '🚀', t: '500 سؤال', d: 'حليت 500 سؤال', v: S => S.total, n: 500, u: 'سؤال' },
    { id: 'q1000', i: '🏔️', t: '1000 سؤال', d: 'حليت 1000 سؤال', v: S => S.total, n: 1000, u: 'سؤال' },
    { id: 'sheet1', i: '📄', t: 'أول ورقة', d: 'خلّصت أول قسم أو نموذج كامل', v: S => S.sheets, n: 1, u: 'ورقة' },
    { id: 'sheet5', i: '📚', t: '5 أوراق', d: 'خلّصت 5 أقسام أو نماذج', v: S => S.sheets, n: 5, u: 'ورقة' },
    { id: 'allq', i: '📐', t: 'بطل الكمي', d: 'خلّصت أقسام الكمي الـ14 كلها', v: S => S.qdone, n: 14, u: 'قسم' },
    { id: 'allv', i: '📖', t: 'بطل اللفظي', d: 'خلّصت نماذج اللفظي الـ14 كلها', v: S => S.vdone, n: 14, u: 'نموذج' },
    { id: 'p90', i: '🎯', t: 'فوق الـ90', d: 'خلّصت قسم بنسبة 90% أو أكثر', v: S => S.best, n: 90, pct: 1 },
    { id: 'p100', i: '👑', t: 'العلامة الكاملة', d: 'جبت 100% في قسم كامل', v: S => S.best, n: 100, pct: 1 },
    { id: 'st3', i: '🔥', t: '3 أيام ورا بعض', d: 'ذاكرت 3 أيام متتالية', v: S => S.streakMax, n: 3, u: 'يوم' },
    { id: 'st7', i: '⚡', t: 'أسبوع كامل', d: 'ذاكرت 7 أيام متتالية', v: S => S.streakMax, n: 7, u: 'يوم' },
    { id: 'st30', i: '🌙', t: 'شهر كامل', d: 'ذاكرت 30 يوم متتالي', v: S => S.streakMax, n: 30, u: 'يوم' },
    { id: 'goal1', i: '⭕', t: 'هدف اليوم', d: 'حققت هدفك اليومي أول مرة', v: S => S.goalDays, n: 1, u: 'يوم' },
    { id: 'goal7', i: '🎖️', t: 'ملتزم', d: 'حققت هدفك اليومي في 7 أيام', v: S => S.goalDays, n: 7, u: 'يوم' },
    { id: 'fix20', i: '🩹', t: 'صياد الأخطاء', d: 'صحّحت 20 سؤال كنت غلطان فيها', v: S => S.fixed, n: 20, u: 'سؤال' },
    { id: 'note10', i: '📒', t: 'صاحب الدفتر', d: 'حفظت 10 أسئلة في دفترك', v: S => S.marks, n: 10, u: 'سؤال' },
    { id: 'level', i: '🧭', t: 'عرفت مستواك', d: 'سويت اختبار تحديد المستوى', v: S => S.level, n: 1 },
    { id: 'mock1', i: '🧪', t: 'أول محاكي', d: 'خلّصت أول اختبار محاكي', v: S => S.mocks, n: 1, u: 'اختبار' },
    { id: 'plan', i: '🏁', t: 'الخطة كاملة', d: 'خلّصت خطة المذاكرة كاملة', v: S => S.planDone, n: 1 },
  ];
  function badgeStats() {
    const D = daysGet(), goal = goalGet(); let total = 0, goalDays = 0, best = 0, run = 0, prev = null;
    Object.keys(D).filter(k => D[k] > 0).sort().forEach(k => { total += D[k]; if (D[k] >= goal) goalDays++; const t = new Date(k + 'T12:00:00').getTime(); run = prev != null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; prev = t; if (run > best) best = run; });
    let qdone = 0, vdone = 0, bestPct = 0;
    for (let i = 1; i <= 14; i++) for (const k of ['q', 'v']) { const p = progGet(k + i); if (p.done || p.best != null) { if (k === 'q') qdone++; else vdone++; } if (p.best != null && p.best > bestPct) bestPct = p.best; }
    const h = histGet(); let fixed = 0; for (const s in h.items) for (const i in h.items[s]) { const e = h.items[s][i]; if (e[0] > 0 && e[2]) fixed++; }
    const st = planState(), plan = PLANS.find(p => p.id === st.id), ex = lsGet('qg_ex_state', null);
    return { total, goalDays, streakMax: best, qdone, vdone, sheets: qdone + vdone, best: bestPct, fixed, marks: marksList().filter(x => x.e.s).length, level: lsGet(LVL_LS, null) ? 1 : 0,
      mocks: ex && ex.tests ? Object.values(ex.tests).filter(t => t && t.status === 'done').length : 0, planDone: plan && !planInfo(plan, st).cur ? 1 : 0 };
  }
  function badgesMerge(rem) { if (!rem || typeof rem !== 'object') return; const B = lsGet(BADGE_LS, {}); let ch = false; for (const k in rem) if (BADGES.some(b => b.id === k) && (!B[k] || rem[k] < B[k])) { B[k] = rem[k]; ch = true; } if (ch) lsSet(BADGE_LS, B); }
  function badgeCheck() {
    let S; try { S = badgeStats(); } catch (e) { return []; }
    const B = lsGet(BADGE_LS, {}), first = !Object.keys(B).length, got = [];
    BADGES.forEach(b => { if (!B[b.id] && b.v(S) >= b.n) { B[b.id] = Date.now(); got.push(b); } });
    if (got.length) { lsSet(BADGE_LS, B); skillsPushSoon(5000);
      setTimeout(() => toast(got.length > 1 ? `🏅 حصلت على ${got.length} شارات${first ? '' : ' جديدة'}! شوفها في «إنجازاتي»` : `🏅 شارة جديدة: ${got[0].t}`), 900); }
    return got;
  }
  let badgeT = 0; function badgeCheckSoon() { clearTimeout(badgeT); badgeT = setTimeout(badgeCheck, 1200); }
  async function renderBadges() {
    document.title = 'إنجازاتي | Q-Guide';
    if (!skillsPulled) { app.innerHTML = topbar(`<span class="ttl">🏅 إنجازاتي</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; bindCtl(); await skillsPull(); if (location.hash !== '#badges') return; }
    badgeCheck();
    const S = badgeStats(), B = lsGet(BADGE_LS, {}), n = BADGES.filter(b => B[b.id]).length;
    const left = b => { const v = Math.max(0, b.v(S)); if (b.pct) return `أفضل نتيجة لك ${v}%`; if (b.n === 1) return 'ما حصلت عليها بعد'; return `باقي ${b.n - Math.min(v, b.n)} ${b.u || ''}`; };
    app.innerHTML = topbar(`<span class="ttl">🏅 إنجازاتي</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap badges">
      <div class="bd-top"><h1>إنجازاتي</h1><p>كل شارة تنختم لك تلقائياً لما توصل لها. <b>حصلت على ${n} من ${BADGES.length}</b></p><div class="bd-bar"><i style="width:${Math.round(n * 100 / BADGES.length)}%"></i></div></div>
      <div class="bds">${BADGES.map(b => { const on = !!B[b.id], v = Math.max(0, Math.min(b.v(S), b.n)), p = Math.round(v * 100 / b.n);
        return `<div class="bd ${on ? 'on' : ''}"><span class="bd-st" aria-hidden="true"><span>${b.i}</span></span><b>${b.t}</b><small>${b.d}</small>${on ? `<em>✓ ${fmtDay(B[b.id])}</em>` : `<span class="bd-p"><i style="width:${p}%"></i></span><em class="lk">${left(b)}</em>`}</div>`; }).join('')}</div></main>`;
    bindCtl();
  }

  // ---------- ⭐ دفتري: حفظ الأسئلة + ملاحظات ----------
  const MARK_LS = 'qg_marks';
  const STARSVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" style="fill-opacity:var(--sf,0)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const NOTESVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/><path d="M8.5 12.5h7M8.5 16h5"/></svg>';
  function marksGet() { return lsGet(MARK_LS, { v: 1, items: {} }); }
  function markOf(src, sidx) { const m = marksGet().items[src]; const e = m && m[sidx]; return e && (e.s || e.n) ? e : null; }
  function markSet(src, sidx, patch) { const M = marksGet(); const m = M.items[src] || (M.items[src] = {}); m[sidx] = Object.assign({ s: 0, n: '' }, m[sidx] || {}, patch, { t: Date.now() }); lsSet(MARK_LS, M); skillsPushSoon(4000); return m[sidx]; }
  function marksList() { const M = marksGet(), out = []; for (const src in M.items) for (const i in M.items[src]) { const e = M.items[src][i]; if (e && (e.s || e.n)) out.push({ src, sidx: +i, e }); } return out; }
  function marksMerge(rem) { if (!rem || !rem.items) return; const M = marksGet(); let ch = false; for (const src in rem.items) { const m = M.items[src] || (M.items[src] = {}); for (const i in rem.items[src]) { const r = rem.items[src][i], l = m[i]; if (r && (!l || (r.t || 0) > (l.t || 0))) { m[i] = r; ch = true; } } } if (ch) lsSet(MARK_LS, M); }
  const setOrder = id => (id[0] === 'q' ? 0 : 100) + (+id.slice(1) || 0);
  async function renderNotes() {
    document.title = 'دفتري | Q-Guide';
    const back = `<a class="ib" href="#" title="الرئيسية">→</a>`;
    app.innerHTML = topbar(`<span class="ttl">📒 دفتري</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل دفترك…</span></div>';
    bindCtl();
    if (!skillsPulled) await skillsPull();   // دفترك من جهازك الثاني
    const L = marksList().sort((a, b) => setOrder(a.src) - setOrder(b.src) || a.sidx - b.sidx);
    await Promise.all([...new Set(L.map(x => x.src))].map(s => loadSet(s).catch(() => null)));
    if (location.hash !== '#notes') return;
    const h = histGet(), tab = lsGet('qg_ntab', 'all');
    const rows = L.map(x => { const set = cache[x.src]; if (!set) return null; const f = flatItems(set)[x.sidx]; return f ? Object.assign(x, { it: f.it, kind: set.kind, g: set.kind === 'verbal' ? set.groups[f.gi] : null }) : null; }).filter(Boolean);
    const nq = rows.filter(r => r.kind === 'quant').length, nv = rows.length - nq;
    const show = rows.filter(r => tab === 'all' || (tab === 'q') === (r.kind === 'quant'));
    const stat = r => { const e = h.items[r.src] && h.items[r.src][r.sidx]; return !e ? '<span class="nb-s">ما حليته بعد</span>' : e[2] ? '<span class="nb-s ok">✓ آخر مرة صح</span>' : '<span class="nb-s bad">✗ آخر مرة غلط</span>'; };
    app.innerHTML = topbar(`<span class="ttl">📒 دفتري</span>`, back) + `<main class="wrap notes">
      <div class="nb-top"><div><h1>دفتري</h1><p>الأسئلة اللي حفظتها ⭐ وملاحظاتك عليها. ارجع لها قبل الاختبار، أو تدرّب عليها كأنها قسم.</p></div>
        <div class="nb-go">${nq ? `<a class="btn sm" href="#t-star-q">🎯 تدرّب على أسئلة الكمي <small>${nq}</small></a>` : ''}${nv ? `<a class="btn sm" href="#t-star-v">🎯 تدرّب على أسئلة اللفظي <small>${nv}</small></a>` : ''}</div></div>
      ${rows.length ? `<div class="tabs nb-tabs" role="tablist"><button data-t="all" class="${tab === 'all' ? 'on' : ''}">الكل <small>${rows.length}</small></button><button data-t="q" class="${tab === 'q' ? 'on' : ''}">الكمي <small>${nq}</small></button><button data-t="v" class="${tab === 'v' ? 'on' : ''}">اللفظي <small>${nv}</small></button></div>` : ''}
      <div class="nbs">${show.length ? show.map(r => `<article class="nb ${r.kind}">
        <div class="nb-h"><b>${SET_NAME(r.src)}</b><span class="mut">سؤال ${r.sidx + 1}</span>${stat(r)}<span class="sp"></span><button type="button" class="mk st ${r.e.s ? 'on' : ''}" data-star="${r.src}:${r.sidx}" title="${r.e.s ? 'شيله من الدفتر' : 'احفظه في الدفتر'}" aria-label="نجمة">${STARSVG}</button></div>
        <div class="nb-q">${r.kind === 'quant' ? `<img src="${r.it.img}" alt="سؤال ${r.sidx + 1}" loading="lazy">` : `${r.g && r.g.kind === 'passage' ? `<div class="mut nb-pt">📄 ${esc(r.g.title)}</div>` : ''}<p class="ltr">${esc(r.it.q)}</p>`}</div>
        <textarea class="nb-n" dir="auto" data-src="${r.src}" data-i="${r.sidx}" maxlength="600" rows="2" placeholder="أضف ملاحظة على السؤال…">${esc(r.e.n || '')}</textarea>
        <a class="nb-open" href="#${r.src}@${r.sidx}">افتح السؤال مع الشرح ←</a></article>`).join('') : `<div class="sum nb-empty"><div style="font-size:42px">📒</div><h2>دفترك فاضي</h2><p class="mut">وأنت تحل، اضغط ⭐ على أي سؤال تبي ترجع له، أو اكتب ملاحظتك عليه من زر 📝. كل شي ينحفظ هنا تلقائياً.</p><a class="btn gold" href="#">ابدأ الحل</a></div>`}</div></main>`;
    bindCtl();
    document.querySelectorAll('.nb-tabs button').forEach(b => b.onclick = () => { lsSet('qg_ntab', b.dataset.t); renderNotes(); });
    document.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { const [src, i] = b.dataset.star.split(':'); const c = markOf(src, +i); const on = !(c && c.s); markSet(src, +i, { s: on ? 1 : 0 }); b.classList.toggle('on', on); toast(on ? '⭐ رجع للدفتر' : 'انشالت النجمة' + (c && c.n ? ' (الملاحظة باقية)' : '')); });
    document.querySelectorAll('.nb-n').forEach(t => { let tm = 0; t.oninput = () => { clearTimeout(tm); tm = setTimeout(() => markSet(t.dataset.src, +t.dataset.i, { n: t.value.trim() }), 500); }; });
  }

  // ---------- 🎯 صفحة نقاط القوة والضعف ----------
  function lvl(p, n) { if (n < 3) return { c: 'na', t: 'بحاجة لمزيد من الأسئلة' }; if (p >= 80) return { c: 'ok', t: 'قوي 💪' }; if (p >= 60) return { c: 'mid', t: 'متوسط' }; return { c: 'bad', t: 'يحتاج تركيز 🎯' }; }
  function skillsBarsHtml(agg, compact) {
    if (!agg) return compact ? '<h4>🎯 المهارات</h4><div class="mut" style="margin-bottom:8px">لا يوجد سجل بعد</div>' : '';
    const rows = TOPIC_ORDER.filter(t => agg[t] && (agg[t].w + agg[t].r)).map(t => { const a = agg[t], n = a.w + a.r, p = Math.round(a.r * 100 / n), L = lvl(p, n); return `<div class="skrow ${L.c}"><span class="ic">${TOPICS[t].i}</span><span class="nm">${TOPICS[t].t}<small>${TOPICS[t].k === 'quant' ? 'الكمي' : 'اللفظي'} · ${n} إجابة · ${a.wrongNow} خطأ حالي</small></span><span class="bar"><i style="width:${p}%"></i></span><b class="pct">${p}%</b><span class="lv">${L.t}</span>${compact ? '' : `<a class="btn sm ${L.c === 'bad' ? 'gold' : 'ghost'}" href="#t-${t}">تدرّب</a>`}</div>`; }).join('');
    return (compact ? '<h4>🎯 المهارات (من سجل الطالب)</h4>' : '') + (rows ? `<div class="sk">${rows}</div>` : `<div class="mut">${compact ? 'لا يوجد سجل بعد' : ''}</div>`);
  }
  async function renderSkills() {
    document.title = 'نقاط القوة والضعف | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">🎯 نقاط القوة والضعف</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحليل إجاباتك…</span></div>';
    bindCtl();
    if (!manifest) { try { manifest = await (await fetch('/p/data/manifest.json')).json(); } catch (e) {} }
    let h = await histMigrate(m => { const e = $('#ldmsg'); if (e) e.textContent = m; });
    h = await skillsPull();
    const agg = histAgg(h); const tot = (manifest && manifest.topics) || {};
    const done = TOPIC_ORDER.filter(t => agg[t].w + agg[t].r);
    const weak = done.map(t => ({ t, n: agg[t].w + agg[t].r, p: Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r)) })).filter(x => x.n >= 3 && x.p < 80).sort((a, b) => a.p - b.p).slice(0, 3);
    const strong = done.map(t => ({ t, n: agg[t].w + agg[t].r, p: Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r)) })).filter(x => x.n >= 3 && x.p >= 80).sort((a, b) => b.p - a.p).slice(0, 3);
    const wrongQ = Object.keys(h.items).filter(k => k[0] === 'q').reduce((a, k) => a + Object.values(h.items[k]).filter(e => !e[2]).length, 0);
    const wrongV = Object.keys(h.items).filter(k => k[0] === 'v').reduce((a, k) => a + Object.values(h.items[k]).filter(e => !e[2]).length, 0);
    const total = done.reduce((a, t) => a + agg[t].w + agg[t].r, 0);
    const card = (t) => `<a class="tcard ${TOPICS[t].k}" href="#t-${t}"><span class="ic">${TOPICS[t].i}</span><b>${TOPICS[t].t}</b><small>${tot[t] || '—'} سؤال · ${TOPICS[t].k === 'quant' ? 'الكمي' : 'اللفظي'}</small>${agg[t].w + agg[t].r ? `<span class="mini ${lvl(Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r)), agg[t].w + agg[t].r).c}">${Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r))}%</span>` : ''}</a>`;
    app.innerHTML = topbar(`<span class="ttl">🎯 نقاط القوة والضعف</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap skills">
      <div class="hero sk"><div><h1>تحليل مهاراتك</h1><p>${total ? `حلّلنا <b>${total}</b> إجابة من كل اختباراتك (الأقسام، الشامل، التدريب الموجّه). كل ما حليت أكثر صار التحليل أدق.` : 'ابدأ بحل أي قسم من الكمي أو اللفظي، وبعدها تظهر لك هنا المواضيع اللي تقوى فيها واللي تحتاج تركيز.'}</p></div></div>
      ${weak.length ? `<h2 class="h2">🎯 ركّز على هذي المواضيع</h2><div class="focus">${weak.map(x => `<a class="fc bad" href="#t-${x.t}"><span class="ic">${TOPICS[x.t].i}</span><span><b>${TOPICS[x.t].t}</b><small>${x.p}% صحيحة من ${x.n} إجابة · ${agg[x.t].wrongNow} سؤال خطأ حالياً</small></span><span class="btn sm gold">تدرّب الآن</span></a>`).join('')}</div>` : ''}
      ${strong.length ? `<h2 class="h2">💪 نقاط قوتك</h2><div class="focus">${strong.map(x => `<a class="fc ok" href="#t-${x.t}"><span class="ic">${TOPICS[x.t].i}</span><span><b>${TOPICS[x.t].t}</b><small>${x.p}% صحيحة من ${x.n} إجابة</small></span><span class="btn sm ghost">حافظ عليها</span></a>`).join('')}</div>` : ''}
      <h2 class="h2">🔁 مراجعة أخطائي</h2>
      <div class="wb two">
        <a class="mock ${wrongQ ? '' : 'dim'}" href="#t-wrong-q"><span><b>📐 أخطائي في الكمي</b><br><span class="mut">${wrongQ ? wrongQ + ' سؤال آخر إجابة لك فيه كانت خطأ — حلّها من جديد مع الشرح' : 'ما فيه أخطاء محفوظة حالياً'}</span></span><span class="btn">${wrongQ || 0} ←</span></a>
        <a class="mock ${wrongV ? '' : 'dim'}" href="#t-wrong-v"><span><b>📖 أخطائي في اللفظي</b><br><span class="mut">${wrongV ? wrongV + ' سؤال آخر إجابة لك فيه كانت خطأ — حلّها من جديد مع الترجمة والشرح' : 'ما فيه أخطاء محفوظة حالياً'}</span></span><span class="btn">${wrongV || 0} ←</span></a>
      </div>
      ${done.length ? `<h2 class="h2">📊 كل المواضيع</h2>${skillsBarsHtml(agg, false)}` : ''}
      <h2 class="h2">📚 تدريب حسب الموضوع</h2>
      <p class="mut" style="margin:-4px 0 10px">اختبارات تحتوي على نوع واحد فقط من الأسئلة، مجمّعة من كل النماذج الـ14:</p>
      <div class="tgrid">${TOPIC_ORDER.filter(t => TOPICS[t].k === 'verbal').map(card).join('')}</div>
      <div class="tgrid">${TOPIC_ORDER.filter(t => TOPICS[t].k === 'quant').map(card).join('')}</div>
      <p class="mut" style="font-size:13px;margin-top:14px">ℹ️ تدريب المواضيع ومراجعة الأخطاء يدخل في تحليل مهاراتك فقط ولا يُحتسب في لوحة الصدارة. سجلّك محفوظ على جهازك ومتزامن مع حسابك.</p>
    </main>`;
    bindCtl();
  }
  // ---------- 📖 قاموس الكلمات ----------
  async function renderVocab(model) {
    document.title = 'قاموس الكلمات | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">📖 قاموس الكلمات</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل القاموس…</span></div>';
    bindCtl(); await loadVocab();
    let rows = [], title = '';
    if (model) {
      let set; try { set = await loadSet(model); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#vocab">→</a>`) + '<div class="center">تعذّر فتح النموذج. <a href="#vocab">رجوع</a></div>'; return; }
      title = set.title + ' · ' + set.sub.split(' · ').pop();
      const seen = new Set(); const add = (txt, where) => { for (const m of (txt || '').matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); rows.push([w, ar, where]); } };
      set.groups.forEach(g => { const where = g.kind === 'passage' ? 'قطعة: ' + g.title : (g.ar || g.title); if (g.kind === 'passage') add(g.passage, where); g.items.forEach(it => add(it.q + ' ' + it.opts.join(' '), where)); });
    } else { rows = Object.keys(VOC).filter(w => !STOP.has(w) && w.length > 2).sort().map(w => [w, VOC[w], '']); title = 'كل الكلمات (' + rows.length + ')'; }
    const tabs = `<div class="vtabs"><a class="${model ? '' : 'on'}" href="#vocab">الكل</a>${Array.from({ length: 14 }, (_, i) => `<a class="${model === 'v' + (i + 1) ? 'on' : ''}" href="#vocab-v${i + 1}">نموذج ${i + 1}</a>`).join('')}</div>`;
    app.innerHTML = topbar(`<span class="ttl">📖 قاموس الكلمات</span><span class="sp"></span><button class="ib" id="prn" title="طباعة / حفظ PDF">🖨️</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap vocab">
      <div class="hero sk"><div><h1>قاموس الكلمات</h1><p>ترجمة كل كلمة جديدة تمرّ عليك في النماذج اللفظية (${Object.keys(VOC).length} كلمة). اختر نموذجاً لتظهر كلماته بترتيب ورودها، أو ابحث عن أي كلمة. تقدر تطبع القائمة أو تحفظها PDF من زر 🖨️.</p></div></div>
      ${tabs}
      <div class="vsearch"><input id="vq" class="ltr" placeholder="ابحث عن كلمة… search" autocomplete="off"><span class="mut" id="vn"></span></div>
      <h2 class="h2 vt">${esc(title)}</h2>
      <div class="vlist" id="vl"></div></main>`;
    bindCtl();
    const vl = $('#vl'), vn = $('#vn'), vq = $('#vq'); let lastWhere = '';
    const paint = () => { const q = vq.value.trim().toLowerCase(); const list = q ? rows.filter(r => r[0].indexOf(q) >= 0 || r[1].indexOf(q) >= 0) : rows; vn.textContent = list.length + ' كلمة'; lastWhere = '';
      vl.innerHTML = list.slice(0, 1500).map(r => { let hd = ''; if (model && r[2] !== lastWhere) { lastWhere = r[2]; hd = `<div class="vh">${esc(r[2])}</div>`; } return hd + `<div class="vr"><b class="ltr">${esc(r[0])}</b><span>${esc(r[1])}</span>${sayBtn(r[0], 'en', '', 'sm')}</div>`; }).join('') + (list.length > 1500 ? `<div class="mut" style="padding:10px">… ابحث لعرض المزيد (${list.length - 1500} كلمة أخرى)</div>` : ''); };
    vq.oninput = paint; paint();
    $('#prn').onclick = () => window.print();
  }

  // ---------- 🎬 استوديو تيك توك (للمشرفين) ----------
  const ST = { tab: lsGet('qg_stab', 'v'), f: 'all', posted: null, pen: null, reveal: false, panel: true, ui: true };
  const STL = ['a', 'b', 'c', 'd'];
  function stFont() { if (document.getElementById('stfont')) return; const l = document.createElement('link'); l.id = 'stfont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap'; document.head.appendChild(l); }
  async function stData() { return loadSet('studio'); }
  async function stPosted(force) { if (ST.posted && !force) return ST.posted; try { const r = await admCall({ op: 'adm_studio_list' }); ST.posted = {}; (r.posted || []).forEach(x => ST.posted[x.k] = x); } catch (e) { ST.posted = ST.posted || {}; } return ST.posted; }
  async function stMark(k, on) { try { await admCall({ op: 'adm_studio_mark', k, on: on ? 1 : 0 }); if (on) ST.posted[k] = { k, by_email: auth.email, at: Date.now() }; else delete ST.posted[k]; return true; } catch (e) { toast(e.message); return false; } }
  function stRandom(kind, data, except) { const list = data[kind === 'v' ? 'verbal' : 'quant'].filter(x => !ST.posted[kind + x.n] && x.n !== except); const pool = list.length ? list : data[kind === 'v' ? 'verbal' : 'quant']; return pool[Math.floor(Math.random() * pool.length)].n; }
  async function renderStudio() {
    document.title = 'استوديو تيك توك | Q-Guide'; stFont();
    app.innerHTML = admTop('studio'); bindCtl(); $('#admref').onclick = () => { ST.posted = null; renderStudio(); };
    let data; try { [data] = await Promise.all([stData(), stPosted(), ADM.role ? null : admLoadStaff().catch(() => null)]); } catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#studio') return;
    app.innerHTML = admTop('studio'); bindCtl(); $('#admref').onclick = () => { ST.posted = null; renderStudio(); };
    paintStudio(data);
  }
  function paintStudio(data) {
    const W = $('#adm'); if (!W) return; const k = ST.tab, list = data[k === 'v' ? 'verbal' : 'quant'];
    const done = list.filter(x => ST.posted[k + x.n]).length, pct = Math.round(done * 100 / list.length);
    const items = list.filter(x => ST.f === 'all' || (ST.f === 'done') === !!ST.posted[k + x.n]);
    const nm = e => esc(String(e || '').split('@')[0]);
    W.innerHTML = `<div class="sth">
        <div class="seg"><button data-k="v" class="${k === 'v' ? 'on' : ''}">🔗 التناظر اللفظي <small>${data.verbal.length}</small></button><button data-k="q" class="${k === 'q' ? 'on' : ''}">📐 الكمي <small>${data.quant.length}</small></button></div>
        <div class="stp"><div class="stp-t"><b>نُشر ${done}</b> من ${list.length} · باقي ${list.length - done}</div><div class="stp-b"><i style="width:${pct}%"></i></div></div>
        <button class="btn gold" id="strnd">🎲 سؤال عشوائي لم يُنشر</button>
      </div>
      <div class="stf2"><div class="chips">${[['all', 'الكل'], ['todo', 'لم يُنشر'], ['done', 'منشور']].map(([f, t]) => `<button data-f="${f}" class="${ST.f === f ? 'on' : ''}">${t}</button>`).join('')}</div><span class="mut">اضغط أي سؤال لفتحه بوضع التصوير · علامة «تم النشر» مشتركة بين كل المشرفين عشان ما يتكرر السؤال.</span></div>
      <div class="stg">${items.map(x => { const P = ST.posted[k + x.n]; return `<a class="stc ${P ? 'done' : ''}" href="#studio-${k}-${x.n}"><span class="qn">Q ${x.n}</span>${k === 'v' ? `<span class="pv ltr">${esc(x.q)}</span>` : `<span class="pi"><img src="${x.img}" alt="" loading="lazy"></span>`}<span class="ft">${P ? `<span class="ok">✓ نُشر</span><small>${nm(P.by_email)} · ${fmtD(P.at)}</small>` : '<span class="rd">جاهز للتصوير</span>'}</span></a>`; }).join('') || '<div class="sempty" style="grid-column:1/-1">لا توجد أسئلة هنا</div>'}</div>`;
    W.querySelectorAll('.seg button').forEach(b => b.onclick = () => { ST.tab = b.dataset.k; lsSet('qg_stab', ST.tab); paintStudio(data); });
    W.querySelectorAll('.chips button').forEach(b => b.onclick = () => { ST.f = b.dataset.f; paintStudio(data); });
    $('#strnd').onclick = () => { location.hash = `studio-${k}-${stRandom(k, data)}`; };
  }
  async function renderRec(kind, n) {
    stFont(); document.title = 'تصوير Q ' + n + ' | Q-Guide';
    let data; try { [data] = await Promise.all([stData(), stPosted()]); } catch (e) { app.innerHTML = '<div class="center">تعذّر التحميل. <a href="#studio">رجوع</a></div>'; return; }
    const list = data[kind === 'v' ? 'verbal' : 'quant']; const it = list.find(x => x.n === n); if (!it) { location.hash = 'studio'; return; }
    ST.reveal = false; document.body.classList.add('rec-on');
    const key = kind + n, P = ST.posted[key];
    const opts = it.opts.map((o, i) => `<div class="tk-o" data-i="${i}"><span class="tk-l">${STL[i]}</span><span class="tk-t">${esc(o)}</span></div>`).join('');
    const q = kind === 'v' ? `<div class="tk-kind">Analogy · التناظر اللفظي</div><div class="tk-qv">${esc(it.q)}</div>` : `<div class="tk-kind">Quant · القسم الكمي</div><div class="tk-qi"><img src="${it.img}" alt=""></div>`;
    const ar = it.ar && it.ar.q ? `<div class="rp-ar"><b>🇸🇦 الترجمة:</b> ${esc(it.ar.q)}<ol>${(it.ar.o || []).map((o, i) => `<li class="${i === it.ans ? 'k' : ''}">${STL[i]}) ${esc(o)}</li>`).join('')}</ol></div>` : '';
    const prev = list[(list.indexOf(it) - 1 + list.length) % list.length].n, next = list[(list.indexOf(it) + 1) % list.length].n;
    app.innerHTML = `<div class="rec ${ST.ui ? '' : 'noui'}">
      <div class="stage"><div class="tk" id="tk">
        <div class="tk-top"><span class="tk-brand"><img src="/assets/logo.png" alt=""><b>Q-Guide1</b>${YTSVG}</span></div>
        <div class="tk-panel"><span class="tk-badge">Q ${n}</span>${q}<div class="tk-opts ${it.opts.some(o => o.length > 13) ? 'one' : ''}">${opts}</div>
          <div class="tk-sol"><span>الحل</span></div></div>
        <div class="tk-foot">اكتب إجابتك في التعليقات 👇</div>
      </div></div>
      <aside class="rp">
        <div class="rp-h"><a class="ib2" href="#studio" title="رجوع للقائمة">→</a><b>Q ${n} · ${kind === 'v' ? 'التناظر اللفظي' : 'الكمي'}</b><span class="sp"></span><a class="ib2" href="#studio-${kind}-${prev}" title="السابق">‹</a><a class="ib2" href="#studio-${kind}-${next}" title="التالي">›</a><button class="ib2" id="rrnd" title="سؤال عشوائي لم يُنشر">🎲</button></div>
        <div class="rp-sec"><div class="rp-lbl">✍️ القلم</div>
          <div class="rp-tools"><button data-tool="pen" class="on" title="قلم">✎</button><button data-tool="hl" title="تظليل">▬</button><button data-tool="eraser" title="ممحاة">◌</button><span class="sep"></span>${['#D62828', '#1F5FBF', '#111111', '#1B9E63', '#E9A23B'].map((c, i) => `<button data-col="${c}" class="sw ${i === 0 ? 'on' : ''}" style="--c:${c}" title="لون"></button>`).join('')}<span class="sep"></span><button data-w="2.6" title="رفيع" class="on">─</button><button data-w="5" title="عريض">━</button><span class="sep"></span><button id="rundo" title="تراجع">↶</button><button id="rclr" title="مسح الكتابة">🗑</button></div>
          <label class="rp-sw"><input type="checkbox" id="rpen" checked><span>الكتابة على البطاقة مفعّلة</span></label></div>
        <div class="rp-sec rp-acts"><button class="btn" id="rrev">✅ كشف الإجابة</button><button class="btn ${P ? 'okb' : 'ghost'}" id="rpost">${P ? '✓ تم النشر' : '☐ علّمه «تم النشر»'}</button><button class="btn ghost" id="rhide" title="يخفي اللوحة ويخلي البطاقة بس للتصوير">🎥 وضع التصوير</button></div>
        ${P ? `<div class="rp-note">نشره ${esc(String(P.by_email || '').split('@')[0])} · ${fmtD(P.at)}</div>` : ''}
        <details class="rp-sec rp-ans" open><summary>👁 الإجابة والشرح (لك فقط — ما تظهر في البطاقة)</summary>
          <div class="rp-key">الإجابة: <b class="ltr">${STL[it.ans]}) ${esc(it.opts[it.ans])}</b></div>${ar}
          ${it.exp ? `<div class="rp-exp">${fmtExp(it.exp)}</div>` : ''}<div class="rp-src">من ${kind === 'v' ? 'النموذج ' + it.src.slice(1) : 'القسم ' + it.src.slice(1)} · سؤال ${it.qn}</div></details>
        <div class="rp-tip">⌨️ اختصارات: ← → للتنقل · R كشف الإجابة · Z تراجع · C مسح · H وضع التصوير</div>
      </aside>
      <button class="rec-fab" id="rshow" title="إظهار الأدوات">⋯</button>
      <div class="rec-mini"><button id="mpen" title="القلم">✎</button><button id="mundo" title="تراجع">↶</button><button id="mclr" title="مسح">🗑</button><button id="mrev" title="كشف الإجابة">✅</button><button id="mhide" title="وضع التصوير">🎥</button><button id="mmore" title="الأدوات والإجابة">☰</button></div>
    </div>`;
    const tk = $('#tk'); ST.pen = window.__stPen = QGPen.attach(tk, { bar: false, storageKey: null }); ST.pen.toggle(true); ST.pen.setColor('#D62828'); ST.pen.setWidth(2.6);
    const rec = $('.rec');
    const setUI = on => { ST.ui = on; rec.classList.toggle('noui', !on); };
    const togglePanel = () => rec.classList.toggle('sheet');
    const reveal = () => { ST.reveal = !ST.reveal; tk.classList.toggle('rev', ST.reveal); tk.querySelectorAll('.tk-o').forEach(o => o.classList.toggle('ok', ST.reveal && +o.dataset.i === it.ans)); $('#rrev').textContent = ST.reveal ? '↺ إخفاء الإجابة' : '✅ كشف الإجابة'; };
    const clear = () => ST.pen.clear();
    rec.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { ST.pen.setTool(b.dataset.tool); rec.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b)); });
    rec.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { ST.pen.setColor(b.dataset.col); rec.querySelectorAll('[data-col]').forEach(x => x.classList.toggle('on', x === b)); rec.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x.dataset.tool === 'pen')); ST.pen.setTool('pen'); });
    rec.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { ST.pen.setWidth(+b.dataset.w); rec.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); });
    $('#rundo').onclick = $('#mundo').onclick = () => ST.pen.undo();
    $('#rclr').onclick = $('#mclr').onclick = clear;
    $('#rpen').onchange = e => { ST.pen.toggle(e.target.checked); $('#mpen').classList.toggle('on', e.target.checked); };
    $('#mpen').classList.add('on'); $('#mpen').onclick = () => { const on = ST.pen.toggle(); $('#rpen').checked = on; $('#mpen').classList.toggle('on', on); };
    $('#rrev').onclick = $('#mrev').onclick = reveal;
    $('#rhide').onclick = $('#mhide').onclick = () => setUI(false);
    $('#rshow').onclick = () => setUI(true);
    $('#mmore').onclick = togglePanel;
    $('#rrnd').onclick = () => { location.hash = `studio-${kind}-${stRandom(kind, data, n)}`; };
    $('#rpost').onclick = async () => { const on = !ST.posted[key]; const b = $('#rpost'); b.disabled = true; if (await stMark(key, on)) { b.className = 'btn ' + (on ? 'okb' : 'ghost'); b.textContent = on ? '✓ تم النشر' : '☐ علّمه «تم النشر»'; toast(on ? 'تم التعليم كمنشور ✓' : 'أُلغي التعليم'); } b.disabled = false; };
    window.__stKey = e => { if (e.target.closest('input,textarea')) return; const kk = e.key.toLowerCase();
      if (kk === 'arrowleft') location.hash = `studio-${kind}-${next}`; else if (kk === 'arrowright') location.hash = `studio-${kind}-${prev}`;
      else if (kk === 'r') reveal(); else if (kk === 'z') ST.pen.undo(); else if (kk === 'c') clear(); else if (kk === 'h') setUI(!ST.ui); else if (kk === 'escape') setUI(true); };
    document.addEventListener('keydown', window.__stKey);
  }
  // ---------- avatar / profile ----------
  const PRESETS = ['adventurer', 'adventurer-neutral', 'avataaars', 'bottts-neutral', 'fun-emoji', 'thumbs', 'lorelei', 'notionists'];
  function avatarHtml(url, name, size) {
    const nm = String(name || '').replace(/[?؟]/g, '').trim(); const init = esc(nm.charAt(0) || '👤'); const sz = size || 40;
    let hsh = 0; for (const ch of nm) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; const hue = hsh % 360;
    const st = `width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .45)}px;background:hsl(${hue} 55% 42%);color:#fff`;
    return url ? `<img class="av" src="${esc(url)}" width="${sz}" height="${sz}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av ini',textContent:'${init}',style:'${st}'}))">`
      : `<span class="av ini" style="${st}">${init}</span>`;
  }
  function presetUrl(style, seed) { return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50`; }
  async function renderProfile() {
    let prof = { name: auth.display || auth.name, avatar: auth.avatar || '', yt: '' };
    const box = document.createElement('div'); box.className = 'modal'; box.innerHTML = `<div class="m ar"><div class="center"><div class="spin" style="margin:20px auto"></div></div></div>`; document.body.appendChild(box);
    try { const r = await api({ op: 'profile', session: auth.session }); if (r.ok) prof = { name: r.name, avatar: r.avatar, yt: r.yt, handle: r.handle }; } catch (e) {}
    const seed = auth.email; let chosen = prof.avatar || '';
    const draw = () => {
      box.innerHTML = `<div class="m"><h3>ملفي الشخصي</h3>
        <div class="pf-top">${avatarHtml(chosen, prof.name, 72)}<div><label class="lbl">الاسم المعروض في لوحة الصدارة</label><input id="pf-name" maxlength="30" value="${esc(prof.name || '')}"></div></div>
        <label class="lbl">الصورة</label>
        <div class="pf-av">
          ${prof.yt ? `<button class="pf-opt ${chosen === prof.yt ? 'on' : ''}" data-u="${esc(prof.yt)}" title="صورة قناتك في يوتيوب">${avatarHtml(prof.yt, 'Y', 48)}<small>يوتيوب</small></button>` : ''}
          ${PRESETS.map(st => { const u = presetUrl(st, seed); return `<button class="pf-opt ${chosen === u ? 'on' : ''}" data-u="${esc(u)}">${avatarHtml(u, '?', 48)}</button>`; }).join('')}
          <label class="pf-opt up" title="رفع صورة من جهازك">📷<small>رفع صورة</small><input type="file" id="pf-file" accept="image/*" hidden></label>
          <button class="pf-opt ${chosen === '' ? 'on' : ''}" data-u="" title="بدون صورة"><span class="av ini" style="width:48px;height:48px">${esc((prof.name || '?').charAt(0))}</span><small>بدون</small></button>
        </div>
        <p class="mut" style="font-size:12.5px">${prof.yt ? '' : (prof.handle ? 'ما قدرنا نجيب صورة قناتك (' + esc(prof.handle) + ') — اختر صورة من هنا.' : '')} الاسم والصورة يظهران للطلاب الآخرين في لوحة الصدارة فقط.</p>
        <div class="acts"><button class="btn ghost" id="pf-x">إلغاء</button><span class="sp"></span><button class="btn" id="pf-save">حفظ</button></div></div>`;
      box.querySelectorAll('.pf-opt[data-u]').forEach(b => b.onclick = () => { chosen = b.dataset.u; photo = null; draw(); });
      $('#pf-x').onclick = () => box.remove();
      $('#pf-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; photo = await shrinkImage(f, 160); chosen = photo; draw(); };
      $('#pf-save').onclick = async () => {
        const name = $('#pf-name').value.trim(); if (name.length < 2) return toast('اكتب اسماً أطول');
        $('#pf-save').disabled = true;
        const body = { op: 'profile_set', session: auth.session, name }; if (photo) body.photo = photo; else body.avatar = chosen;
        try { const r = await api(body); if (!r.ok) { toast(r.msg || 'تعذّر الحفظ'); $('#pf-save').disabled = false; return; }
          auth.display = r.name; auth.avatar = r.avatar; lsSet(LS.auth, auth); box.remove(); toast('تم الحفظ ✓'); renderHome(); } catch (e) { toast('تعذّر الاتصال'); $('#pf-save').disabled = false; }
      };
    };
    let photo = null; draw();
  }
  function shrinkImage(file, size) {
    return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); const s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); res(c.toDataURL('image/jpeg', .82)); }; img.src = URL.createObjectURL(file); });
  }

  // ---------- leaderboard ----------
  // ---------- 👑 لوحة المشرف ----------
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1RaKf8jqdIJ2tsZx95jhxhqyNq0scSvnzPyfttYch8CI';
  const fmtD = t => { if (!t) return '—'; const d = new Date(t); const diff = (Date.now() - t) / 60000; if (diff < 60) return 'قبل ' + Math.max(1, Math.round(diff)) + ' د'; if (diff < 1440) return 'قبل ' + Math.round(diff / 60) + ' س'; return d.toLocaleDateString('ar-SA-u-nu-latn', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); };
  let ADM = { list: null, q: '', f: 'all', role: '', staff: null };
  const ROLE_T = { owner: '👑 مالك', admin: '🛡 مشرف كامل', viewer: '👁 متابعة فقط' };
  function admTop(tab) {
    return topbar(`<span class="ttl">👑 لوحة الإدارة</span><span class="sp"></span><a class="tn" href="${SHEET_URL}" target="_blank" rel="noopener" title="فتح الشيت"><span class="i">📊</span><span class="l">الشيت</span></a><button class="ib" id="admref" title="تحديث">⟳</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap" id="admw"><div class="atabs"><a href="#admin" class="${tab === 'students' ? 'on' : ''}">👥 الطلاب${ADM.list ? ` <small>${ADM.list.length}</small>` : ''}</a><a href="#admin-staff" class="${tab === 'staff' ? 'on' : ''}">🛡 المشرفون${ADM.staff ? ` <small>${ADM.staff.owners.length + ADM.staff.staff.length}</small>` : ''}</a><a href="#studio" class="${tab === 'studio' ? 'on' : ''}">🎬 استوديو تيك توك</a>${ADM.role ? `<span class="myrole">صلاحيتك: <b>${ROLE_T[ADM.role] || ADM.role}</b></span>` : ''}</div><div id="adm"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
  }
  async function admLoadStaff(force) { if (ADM.staff && !force) return ADM.staff; const r = await admCall({ op: 'adm_staff_list' }); ADM.staff = r; ADM.role = r.myRole || ''; if (auth.staff !== ADM.role) { auth.staff = ADM.role; lsSet(LS.auth, auth); } return r; }
  async function admCall(body) { const r = await api(Object.assign({ session: auth.session }, body)); if (!r.ok) { if (r.error === 'kicked' || r.error === 'session') return logout(esc(r.msg || '')); throw new Error(r.msg || r.error); } return r; }
  async function renderAdmin() {
    document.title = 'لوحة الإدارة | Q-Guide';
    app.innerHTML = admTop('students');
    bindCtl(); $('#admref').onclick = () => { ADM.list = null; ADM.staff = null; renderAdmin(); };
    try { const [st] = await Promise.all([ADM.list ? null : admCall({ op: 'adm_students' }), admLoadStaff()]); if (st) ADM.list = st.students; } catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin') return;
    app.innerHTML = admTop('students'); bindCtl(); $('#admref').onclick = () => { ADM.list = null; ADM.staff = null; renderAdmin(); };
    paintAdmin();
  }
  function paintAdmin() {
    const W = $('#adm'); if (!W) return; const all = ADM.list; const day = Date.now() - 86400000;
    const stats = { n: all.filter(s => !s.banned).length, banned: all.filter(s => s.banned).length, today: all.filter(s => s.lastLogin > day).length, never: all.filter(s => !s.logins && !s.banned).length };
    const q = ADM.q.trim().toLowerCase();
    let list = all.filter(s => !q || [s.name, s.display, s.email, s.phone, s.user].some(x => String(x || '').toLowerCase().includes(q)));
    if (ADM.f === 'banned') list = list.filter(s => s.banned); else if (ADM.f === 'today') list = list.filter(s => s.lastLogin > day); else if (ADM.f === 'never') list = list.filter(s => !s.logins && !s.banned);
    list.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
    W.innerHTML = `<div class="astats"><div><b>${stats.n}</b><span>طالب مشترك</span></div><div><b>${stats.today}</b><span>دخل آخر 24 ساعة</span></div><div><b>${stats.never}</b><span>لم يدخل الموقع</span></div><div class="bad"><b>${stats.banned}</b><span>محظور</span></div></div>
      <div class="abar"><input id="aq" type="search" placeholder="ابحث بالاسم أو الإيميل أو الجوال أو اليوزر…" value="${esc(ADM.q)}"><div class="tabs sm">${[['all', 'الكل'], ['today', 'نشط اليوم'], ['never', 'لم يدخل'], ['banned', 'محظور']].map(([k, t]) => `<button data-f="${k}" class="${ADM.f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="atable"><div class="arow head"><span class="c-st">الطالب</span><span class="c-ph">الجوال</span><span class="c-n">الأقسام</span><span class="c-n">المحاكي</span><span class="c-dt">آخر دخول</span><span class="c-act">إجراءات</span></div>
      ${list.map(s => `<div class="arow ${s.banned ? 'banned' : ''}" data-e="${esc(s.email)}"><span class="c-st">${avatarHtml(s.avatar, s.display || s.name, 36)}<span class="who"><b>${esc(s.display || s.name || '—')}${s.display && s.display !== s.name ? ` <small class="mut">(${esc(s.name)})</small>` : ''}</b><small>${esc(s.email)}${s.user ? ' · @' + esc(s.user) : ''}${s.banned ? ' · <span class="bdg">⛔ محظور</span>' : s.session ? ' · <span class="bdg on">متصل</span>' : ''}</small></span></span><span class="c-ph ltr">${esc(s.phone || '—')}</span><span class="c-n">${s.results}</span><span class="c-n">${s.exams}</span><span class="c-dt">${fmtD(s.lastLogin)}</span><span class="c-act"><button class="btn sm ghost" data-view="${esc(s.email)}">عرض</button>${ADM.role === 'viewer' ? '' : s.banned ? `<button class="btn sm" data-unban="${esc(s.email)}">فك الحظر</button>` : `<button class="btn sm danger" data-ban="${esc(s.email)}">حظر</button>`}</span></div>`).join('') || '<div class="center mut" style="padding:30px">لا نتائج</div>'}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">${list.length} من ${all.length} · الحظر دائم: يمنع دخول الموقع فوراً، ويطرد الجلسة، وخلال دقيقة يتحوّل في الشيت إلى "محظور" مع سحب الوصول لاختبارات الفورمز وملفات المذكرة. لإضافة طالب أو تعديل بياناته استخدم الشيت.</p>`;
    $('#aq').oninput = e => { ADM.q = e.target.value; const pos = e.target.selectionStart; paintAdmin(); const i = $('#aq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { ADM.f = b.dataset.f; paintAdmin(); });
    W.querySelectorAll('[data-view]').forEach(b => b.onclick = () => admStudent(b.dataset.view));
    W.querySelectorAll('.arow[data-e]').forEach(r => r.onclick = e => { if (e.target.closest('button')) return; admStudent(r.dataset.e); });
    W.querySelectorAll('[data-ban]').forEach(b => b.onclick = () => admBan(b.dataset.ban));
    W.querySelectorAll('[data-unban]').forEach(b => b.onclick = () => admUnban(b.dataset.unban));
  }
  async function admBan(email) {
    const reason = await QGDlg.prompt('حظر ' + email + ' نهائياً من الدورة والموقع.\nاكتب السبب (اختياري):', '', { ok: 'حظر', danger: true }); if (reason === null) return;
    try { await admCall({ op: 'adm_ban', email, reason }); toast('⛔ تم الحظر'); ADM.list = null; renderAdmin(); } catch (e) { toast('خطأ: ' + e.message); }
  }
  async function admUnban(email) {
    if (!await QGDlg.confirm('فك الحظر عن ' + email + '؟\nملاحظة: في الشيت غيّر حالته إلى "مؤكد" مرة أخرى حتى يرجع يدخل.', { ok: 'فك الحظر' })) return;
    try { await admCall({ op: 'adm_unban', email }); toast('تم فك الحظر'); ADM.list = null; renderAdmin(); } catch (e) { toast('خطأ: ' + e.message); }
  }
  async function admStudent(email) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="m"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div>'; document.body.appendChild(m);
    m.onclick = e => { if (e.target === m) m.remove(); };
    let d; try { d = await admCall({ op: 'adm_student', email }); } catch (e) { m.remove(); toast(e.message); return; }
    const st = d.student || {}, pf = d.profile || {}; const fmtS = x => { const mm = Math.round(x / 60); return mm ? mm + ' د' : x + ' ث'; };
    const byTest = {}; d.exams.forEach(x => { (byTest[x.test] = byTest[x.test] || []).push(x); });
    m.querySelector('.m').innerHTML = `<h3 style="display:flex;align-items:center;gap:10px">${avatarHtml(pf.avatar || st.yt, pf.name || st.name, 44)}<span>${esc(pf.name || st.name || email)}<small class="mut" style="display:block;font-weight:400;font-size:13px">${esc(email)}</small></span></h3>
      ${d.ban ? `<div class="sum bad" style="padding:10px 14px;margin-bottom:10px">⛔ محظور منذ ${fmtD(d.ban.at)} بواسطة ${esc(d.ban.by_email)}${d.ban.reason ? ' — ' + esc(d.ban.reason) : ''}</div>` : ''}
      <div class="kv"><div><span>الاسم في الشيت</span><b>${esc(st.name || '—')}</b></div><div><span>الجوال</span><b class="ltr">${esc(st.phone || '—')}</b></div><div><span>الجنس</span><b>${esc(st.gender || '—')}</b></div><div><span>يوزر يوتيوب</span><b>${esc(st.user || '—')}</b></div><div><span>الاسم المعروض</span><b>${esc(pf.name || '—')}</b></div><div><span>آخر دخول</span><b>${d.logins[0] ? fmtD(d.logins[0].ts) : 'لم يدخل'}</b></div></div>
      <div class="acts"><button class="btn sm ghost" id="a_name">✏️ تعديل الاسم المعروض</button><button class="btn sm ghost" id="a_av">🖼 مسح الصورة</button><button class="btn sm ghost" id="a_kick">⎋ طرد الجلسة</button>${d.ban ? `<button class="btn sm" id="a_unban">فك الحظر</button>` : `<button class="btn sm danger" id="a_ban">⛔ حظر نهائي</button>`}</div>
      ${skillsBarsHtml(d.skills && d.skills.data ? histAgg(JSON.parse(d.skills.data)) : null, true)}
      <h4>📚 نتائج الأقسام (${d.results.length})${d.results.length ? ' <button class="lnk" id="a_rr">حذف الكل</button>' : ''}</h4>
      <div class="alist">${d.results.slice(0, 40).map(r => `<div><span>${esc(r.set_id)}</span><span>${r.correct}/${r.n} (${r.pct}%)</span><span>${fmtS(r.secs)}</span><span class="mut">${fmtD(r.ts)}</span></div>`).join('') || '<div class="mut">لا توجد</div>'}</div>
      <h4>🧪 الاختبارات المحاكية (${d.exams.length})</h4>
      <div class="alist">${Object.keys(byTest).map(t => byTest[t].map(x => `<div><span>${esc(t)} · م${x.attempt}</span><span>${x.done ? x.total + '/96 (' + x.pct + '%)' : 'لم يكتمل'}</span><span>${x.secs ? fmtS(x.secs) : '—'}</span><span class="mut">${fmtD(x.finished_at || x.started_at)}</span><button class="lnk" data-rx="${esc(t)}">إعادة تعيين</button></div>`).join('')).join('') || '<div class="mut">لا توجد</div>'}</div>
      <h4>🔑 آخر دخول (${d.logins.length})</h4>
      <div class="alist">${d.logins.slice(0, 10).map(l => `<div><span>${fmtD(l.ts)}</span><span>${esc(l.status)}</span><span class="mut ltr" style="font-size:11px">${esc((l.ua || '').replace(/^Mozilla\/5\.0 \(/, '').slice(0, 40))}</span></div>`).join('') || '<div class="mut">لا يوجد</div>'}</div>
      <div class="acts" style="justify-content:flex-end"><button class="btn sm ghost" id="a_close">إغلاق</button></div>`;
    const again = () => { m.remove(); ADM.list = null; renderAdmin(); };
    m.querySelector('#a_close').onclick = () => m.remove();
    m.querySelector('#a_name').onclick = async () => { const nm = await QGDlg.prompt('الاسم المعروض الجديد (اتركه فارغاً ليرجع لاسم الشيت):', pf.name || ''); if (nm === null) return; try { await admCall({ op: 'adm_profile', email, name: nm }); toast('تم'); again(); } catch (e) { toast(e.message); } };
    m.querySelector('#a_av').onclick = async () => { if (!await QGDlg.confirm('مسح صورة الطالب؟', { danger: true })) return; try { await admCall({ op: 'adm_profile', email, clearAvatar: 1 }); toast('تم'); again(); } catch (e) { toast(e.message); } };
    m.querySelector('#a_kick').onclick = async () => { try { await admCall({ op: 'adm_kick', email }); toast('تم طرد الجلسة — يحتاج تسجيل دخول جديد'); } catch (e) { toast(e.message); } };
    const bb = m.querySelector('#a_ban'); if (bb) bb.onclick = () => { m.remove(); admBan(email); };
    const ub = m.querySelector('#a_unban'); if (ub) ub.onclick = () => { m.remove(); admUnban(email); };
    const rr = m.querySelector('#a_rr'); if (rr) rr.onclick = async () => { if (!await QGDlg.confirm('حذف كل نتائج الأقسام لهذا الطالب؟ (تؤثر على لوحة الصدارة)', { danger: true })) return; try { await admCall({ op: 'adm_reset_results', email }); toast('تم'); again(); } catch (e) { toast(e.message); } };
    m.querySelectorAll('[data-rx]').forEach(b => b.onclick = async () => { if (!await QGDlg.confirm('حذف كل محاولات ' + b.dataset.rx + ' لهذا الطالب ليبدأه من جديد؟', { danger: true })) return; try { await admCall({ op: 'adm_reset_exam', email, test: b.dataset.rx }); toast('تم'); again(); } catch (e) { toast(e.message); } });
    if (ADM.role === 'viewer') m.querySelectorAll('#a_name,#a_av,#a_kick,#a_ban,#a_unban,#a_rr,[data-rx]').forEach(x => x.remove());
  }
  // ---------- 🛡 المشرفون ----------
  async function renderStaff() {
    document.title = 'المشرفون | Q-Guide';
    app.innerHTML = admTop('staff'); bindCtl(); $('#admref').onclick = () => { ADM.staff = null; renderStaff(); };
    try { await admLoadStaff(); } catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-staff') return;
    app.innerHTML = admTop('staff'); bindCtl(); $('#admref').onclick = () => { ADM.staff = null; renderStaff(); };
    paintStaff();
  }
  function paintStaff() {
    const W = $('#adm'); if (!W) return; const S = ADM.staff; const owner = ADM.role === 'owner';
    const row = (x) => `<div class="srow ${x.role}"><span class="c-st">${avatarHtml(x.avatar, x.display || x.name || x.email, 40)}<span class="who"><b>${esc(x.name || x.display || x.email.split('@')[0])}${x.email === S.me ? ' <span class="bdg on">أنت</span>' : ''}</b><small class="ltr">${esc(x.email)}</small>${x.note ? `<small class="note">📝 ${esc(x.note)}</small>` : ''}</span></span>
      <span class="rl"><span class="rbdg ${x.role}">${ROLE_T[x.role]}</span></span>
      <span class="meta"><small>آخر دخول: <b>${x.lastLogin ? fmtD(x.lastLogin) : 'لم يدخل بعد'}</b></small>${x.added_by ? `<small>أضافه ${esc(x.added_by.split('@')[0])} · ${fmtD(x.added_at)}</small>` : ''}</span>
      <span class="c-act">${owner && x.role !== 'owner' ? `<select data-role="${esc(x.email)}" title="تغيير الصلاحية"><option value="admin" ${x.role === 'admin' ? 'selected' : ''}>🛡 مشرف كامل</option><option value="viewer" ${x.role === 'viewer' ? 'selected' : ''}>👁 متابعة فقط</option></select><button class="btn sm danger" data-rm="${esc(x.email)}">حذف</button>` : x.role === 'owner' ? '<small class="mut">لا يُحذف</small>' : ''}</span></div>`;
    W.innerHTML = `<div class="stf">
      <div class="sintro"><div><b>👑 مالك</b><span>كل الصلاحيات + إضافة المشرفين وحذفهم. (إيميلات الشيت الأساسية)</span></div><div><b>🛡 مشرف كامل</b><span>يشوف كل الطلاب ونتائجهم ومهاراتهم، ويحظر ويطرد ويصفّر النتائج ويعدّل الأسماء والصور.</span></div><div><b>👁 متابعة فقط</b><span>يشوف الطلاب ونتائجهم ومهاراتهم بدون أي تعديل — مناسب للمرشد الأكاديمي.</span></div></div>
      ${owner ? `<form class="sadd" id="sadd" autocomplete="off"><h3>➕ إضافة مشرف جديد</h3>
        <div class="sgrid"><label><span>إيميل Google للمشرف *</span><input id="s_em" type="email" class="ltr" placeholder="name@gmail.com" required></label><label><span>الاسم</span><input id="s_nm" placeholder="مثال: سلمان الفرج"></label><label class="wide"><span>ملاحظة (اختياري)</span><input id="s_nt" placeholder="مثال: مرشد الطلاب · مرشدة الطالبات · مدرّس الكمي"></label></div>
        <div class="sroles"><label class="ropt"><input type="radio" name="s_rl" value="admin" checked><span><b>🛡 مشرف كامل</b><small>يقدر يحظر ويطرد ويصفّر</small></span></label><label class="ropt"><input type="radio" name="s_rl" value="viewer"><span><b>👁 متابعة فقط</b><small>عرض بدون تعديل</small></span></label></div>
        <div class="acts"><button class="btn gold" type="submit" id="s_go">إضافة المشرف</button><span class="mut" style="font-size:13px">يدخل الموقع بنفس إيميل Google ويظهر له زر 👑 الإدارة خلال دقيقة. المشرفون ما يظهرون في لوحة الصدارة.</span></div></form>`
        : `<div class="sum" style="padding:12px 16px">🔒 إضافة المشرفين وحذفهم متاحة للمالك فقط.</div>`}
      <h3 class="sh">👑 المالكون <small>${S.owners.length}</small></h3><div class="slist">${S.owners.map(row).join('')}</div>
      <h3 class="sh">🛡 المشرفون <small>${S.staff.length}</small></h3><div class="slist">${S.staff.length ? S.staff.map(row).join('') : `<div class="sempty">ما فيه مشرفين مضافين بعد${owner ? ' — أضف أول مشرف من النموذج فوق.' : '.'}</div>`}</div></div>`;
    const f = $('#sadd'); if (f) f.onsubmit = async e => {
      e.preventDefault(); const em = $('#s_em').value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('اكتب إيميل صحيح'); return; }
      const role = (f.querySelector('input[name=s_rl]:checked') || {}).value || 'admin';
      if (!await QGDlg.confirm(`إضافة ${em} بصلاحية «${ROLE_T[role]}»؟`, { ok: 'إضافة' })) return;
      const b = $('#s_go'); b.disabled = true; b.textContent = 'جارٍ الإضافة…';
      try { await admCall({ op: 'adm_staff_add', email: em, name: $('#s_nm').value.trim(), note: $('#s_nt').value.trim(), role }); toast('تمت إضافة المشرف ✓'); await admLoadStaff(true); renderStaff(); }
      catch (err) { toast(err.message); b.disabled = false; b.textContent = 'إضافة المشرف'; }
    };
    W.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { const em = b.dataset.rm; if (!await QGDlg.confirm('حذف صلاحية الإشراف من ' + em + '؟ تنتهي جلسته في لوحة الإدارة فوراً.', { ok: 'حذف', danger: true })) return; try { await admCall({ op: 'adm_staff_remove', email: em }); toast('تم الحذف'); await admLoadStaff(true); renderStaff(); } catch (e) { toast(e.message); } });
    W.querySelectorAll('[data-role]').forEach(sel => sel.onchange = async () => { const em = sel.dataset.role; const x = S.staff.find(y => y.email === em) || {}; try { await admCall({ op: 'adm_staff_add', email: em, name: x.name || '', note: x.note || '', role: sel.value }); toast('تم تغيير الصلاحية ✓'); await admLoadStaff(true); paintStaff(); } catch (e) { toast(e.message); } });
  }

  // ---------- ⏳ موعد الاختبار + العدّادات ----------
  const EXAM_LS = 'qg_exam', TRIPX_LS = 'qg_trip_x', DAYMS = 864e5;
  function examGet() { const e = lsGet(EXAM_LS, null); return e && /^\d{4}-\d{2}-\d{2}$/.test(e.d || '') ? e : null; }
  function examAt(e) { e = e || examGet(); if (!e) return 0; const [y, m, d] = e.d.split('-').map(Number); const [hh, mm] = String(e.t || '08:00').split(':').map(Number); return new Date(y, m - 1, d, hh || 0, mm || 0).getTime(); }
  const day0 = t => { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayDiff = (a, b) => Math.round((day0(b) - day0(a)) / DAYMS);   // كم يوم تقويمي من a إلى b
  const addDays = (t, n) => { const d = new Date(day0(t)); d.setDate(d.getDate() + n); return d.getTime(); };
  const fmtDay = t => new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = t => new Date(t).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const byDays = n => n === 1 ? 'بيوم' : n === 2 ? 'بيومين' : `بـ${n} ${n <= 10 ? 'أيام' : 'يوم'}`;
  const p2 = n => String(n).padStart(2, '0');
  function cdParts(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; }
  // عدّاد كبير (مربعات) أو صغير (أيام + ساعات:دقائق:ثواني) — يتحدّث كل ثانية
  function cdHtml(at, small) {
    const p = cdParts(at - Date.now());
    if (small) return `<span class="cds" data-cd="${at}"><b data-u="d">${p.d}</b><small>يوم</small><span class="hms" dir="ltr" data-u="hms">${p2(p.h)}:${p2(p.m)}:${p2(p.s)}</span></span>`;
    return `<div class="cd" data-cd="${at}" role="timer" aria-label="باقي ${p.d} يوم على اختبارك"><span class="cdu"><b data-u="d">${p.d}</b><small>يوم</small></span><span class="cdu"><b data-u="h">${p2(p.h)}</b><small>ساعة</small></span><span class="cdu"><b data-u="m">${p2(p.m)}</b><small>دقيقة</small></span><span class="cdu sec"><b data-u="s">${p2(p.s)}</b><small>ثانية</small></span></div>`;
  }
  setInterval(() => {
    const els = document.querySelectorAll('[data-cd]'); if (!els.length) return; const now = Date.now();
    els.forEach(el => { const p = cdParts(+el.dataset.cd - now); el.querySelectorAll('[data-u]').forEach(b => { const u = b.dataset.u; const v = u === 'd' ? String(p.d) : u === 'hms' ? `${p2(p.h)}:${p2(p.m)}:${p2(p.s)}` : p2(p[u]); if (b.textContent !== v) b.textContent = v; }); });
  }, 1000);
  function examMsg(dl) {   // dl = أيام تقويمية حتى يوم الاختبار
    if (dl < 0) return 'إن شاء الله أبدعت في اختبارك 🎉 حدّث الموعد إذا عندك اختبار جديد';
    if (dl === 0) return 'اليوم اختبارك! ثق في تدريبك، وبالتوفيق 🤲';
    if (dl === 1) return 'بكرة اختبارك: راجع أخطاءك بهدوء ونم بدري';
    if (dl <= 7) return 'الأسبوع الأخير: ركّز على أخطائك والاختبارات المحاكية';
    if (dl <= 21) return 'المرحلة المهمة: كل يوم تذاكر فيه يفرق في درجتك';
    return 'وقتك يكفي إذا مشيت على خطة. الاستمرار أهم من الكمية';
  }
  function fitInfo(end, exT) {   // نهاية الخطة مقابل يوم الاختبار
    const gap = dayDiff(end, exT);
    if (gap >= 1) return { c: 'ok', gap, t: `تخلص قبل اختبارك ${byDays(gap)}`, s: `✓ قبل اختبارك ${byDays(gap)}` };
    if (gap === 0) return { c: 'warn', gap, t: 'تخلص يوم اختبارك نفسه', s: '⚠ تخلص يوم اختبارك' };
    return { c: 'bad', gap, t: `تخلص بعد اختبارك ${byDays(-gap)}`, s: `⚠ بعد اختبارك ${byDays(-gap)}` };
  }
  // نافذة تحديد موعد الاختبار
  function examDlg() {
    return new Promise(res => {
      const ex = examGet(); const box = document.createElement('div'); box.className = 'modal';
      box.innerHTML = `<div class="m exm" role="dialog" aria-modal="true" aria-labelledby="exh"><h3 id="exh">🎯 موعد اختبارك</h3>
        <p class="mut">حدّد موعد اختبار القدرات، ونعرض لك عدّاد تنازلي في الصفحة الرئيسية ونعلّم لك الخطة اللي تلحق قبله.</p>
        <div class="exf"><label><span>التاريخ</span><input type="date" id="exd" min="${dayKey()}" value="${ex ? ex.d : ''}" dir="ltr"></label><label><span>الوقت <small>(اختياري)</small></span><input type="time" id="ext" value="${ex ? ex.t || '08:00' : '08:00'}" dir="ltr"></label></div>
        <div class="acts"><button class="btn" id="exok">حفظ الموعد</button><button class="btn ghost" id="exno">إلغاء</button>${ex ? '<span class="sp"></span><button class="lnk" id="exdel">حذف الموعد</button>' : ''}</div></div>`;
      document.body.appendChild(box);
      const close = v => { box.remove(); document.removeEventListener('keydown', onK); res(v); };
      const onK = e => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onK);
      box.addEventListener('click', e => { if (e.target === box) close(false); });
      $('#exno').onclick = () => close(false);
      const del = $('#exdel'); if (del) del.onclick = () => { lsSet(EXAM_LS, { d: '', up: Date.now() }); skillsPushSoon(1500); toast('تم حذف موعد الاختبار'); close(true); };
      $('#exok').onclick = () => {
        const d = $('#exd').value, t = $('#ext').value || '08:00';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('اختر تاريخ الاختبار'); $('#exd').focus(); return; }
        const at = examAt({ d, t }); if (at < Date.now() - DAYMS) { toast('التاريخ اللي اخترته مضى'); return; }
        lsSet(EXAM_LS, { d, t, up: Date.now() }); lsDel(TRIPX_LS); skillsPushSoon(1500); toast('تم حفظ موعد اختبارك ✓'); close(true);
      };
      setTimeout(() => { const i = $('#exd'); if (i) i.focus(); }, 60);
    });
  }
  function bindExam(root, after) { (root || document).querySelectorAll('[data-exam]').forEach(b => b.onclick = async () => { if (await examDlg()) after(); }); }

  // ---------- 📅 خطة المذاكرة ----------
  const PLAN_Q = ['1-50', '51-100', '101-150', '151-200', '201-250', '251-300', '301-350', '351-400', '401-450', '451-500', '501-550', '551-600', '601-642'];
  // كل مهمة = شاهد مقطع الشرح ثم حل نفس القسم هنا في المنصة (حل القسم هو نفسه اختبار المقطع)
  const pq = i => ({ k: 'q', set: 'q' + i, t: `كمي <bdi dir="ltr">${PLAN_Q[i - 1]}</bdi>: شاهد المقطع ثم حل القسم ${i}` });
  const pv = i => ({ k: 'v', set: 'v' + i, t: `لفظي Model ${i}: شاهد المقطع ثم حل النموذج ${i}` });
  const WQ = ['#t-wrong-q', 'أخطائي في الكمي'], WV = ['#t-wrong-v', 'أخطائي في اللفظي'];
  const pr = (t, links) => ({ k: 'r', t, links: links || [] });
  const QREV = () => pr('راجع كل أخطائك في الكمي (بدل المقطع)', [WQ]);
  const PLANS = [
    { id: 'strong', name: 'الخطة القوية', days: 7, daily: 'حوالي 4 ساعات يومياً', fit: 'للي اختباره بعد أسبوع', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let i = 1; i <= 6; i++) d.push({ n: i, time: '≈ 4 ساعات', tasks: [pq(2 * i - 1), pv(2 * i - 1), pq(2 * i), pv(2 * i)] });
        d.push({ n: 7, time: '≈ 4 ساعات', tasks: [pq(13), pv(13), pv(14), pr('راجع كل أخطائك في الكمي', [WQ])] }); return d; } },
    { id: 'intense', name: 'الخطة المكثفة', days: 14, daily: 'حوالي ساعتين يومياً', fit: 'للي اختباره قريب', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let i = 1; i <= 13; i++) d.push({ n: i, time: '≈ ساعتين', tasks: [pq(i), pv(i)] });
        d.push({ n: 14, time: '≈ ساعتين', tasks: [QREV(), pv(14)] }); return d; } },
    { id: 'balanced', name: 'الخطة المتوازنة', days: 19, daily: 'حوالي ساعتين · 5 أيام بالأسبوع', fit: 'الأنسب لأغلب الطلاب', content: '13 مقطع كمي · 14 مقطع لفظي', star: true,
      build() { const d = []; let k = 1;
        const study = n => d.push({ n, time: '≈ ساعتين', tasks: [pq(k), pv(k)], w: Math.ceil(n / 7) }), rev = n => d.push({ n, time: '≈ ساعة', tasks: [pr('مراجعة: أعد حل الأسئلة اللي أخطأت فيها هالأسبوع', [WQ, WV])], w: Math.ceil(n / 7) }), rest = n => d.push({ n, time: 'راحة', tasks: [{ k: 'rest', t: 'يوم راحة: استرجع نشاطك' }], w: Math.ceil(n / 7) });
        for (let w = 0; w < 2; w++) { for (let i = 1; i <= 5; i++) { study(w * 7 + i); k++; } rev(w * 7 + 6); rest(w * 7 + 7); }
        for (let i = 15; i <= 17; i++) { study(i); k++; }
        d.push({ n: 18, time: '≈ ساعتين', tasks: [QREV(), pv(14)], w: 3 }); rev(19); return d; } },
    { id: 'relaxed', name: 'الخطة المريحة', days: 28, daily: 'يوم مذاكرة ساعتين + يوم مراجعة خفيف', fit: 'للي عنده دوام أو مدرسة', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let k = 1; k <= 14; k++) { const n = 2 * k - 1; const w = Math.ceil(n / 7);
          d.push({ n, time: '≈ ساعتين', tasks: k <= 13 ? [pq(k), pv(k)] : [QREV(), pv(14)], w });
          d.push({ n: n + 1, time: '≈ 30 دقيقة', tasks: [pr('مراجعة خفيفة: أعد حل أخطاء أمس وراجع ملاحظاتك', [WQ, WV])], w: Math.ceil((n + 1) / 7) }); } return d; } },
  ];
  const PLAN_LS = 'qg_plan';
  function planState() { return lsGet(PLAN_LS, { id: '', done: {} }); }
  const planUp = p => (p && (p.up || p.started)) || 0;
  function planSave(st) { st.up = Date.now(); lsSet(PLAN_LS, st); skillsPushSoon(2500); remCtx(); }
  function planInfo(plan, st) {   // تواريخ الخطة + موقعك منها
    const days = plan.build(), done = st.done || {};
    const dayDone = d => d.tasks.every((t, i) => done[d.n] && done[d.n][i]);
    const nDone = days.filter(dayDone).length, cur = days.find(d => !dayDone(d)) || null;
    const start = day0(st.started || Date.now()), end = addDays(start, plan.days - 1), today = day0();
    const expect = Math.min(plan.days, dayDiff(start, today) + 1);   // اليوم المفروض حسب التاريخ
    return { days, done, dayDone, nDone, cur, start, end, lag: cur ? expect - cur.n : 0, left: dayDiff(today, end) };
  }
  // روابط المهمة: المقطع على يوتيوب + حل القسم (مع تقدّمك فيه)
  function taskSolve(t, cls) {
    if (t.set) {
      const p = progGet(t.set), ans = Object.keys(p.a || {}).length, nm = SET_NAME(t.set);
      const tot = manifest ? ((manifest[t.k === 'q' ? 'quant' : 'verbal'] || []).find(s => s.id === t.set) || {}).n : 0;
      const lab = p.done ? `✓ ${nm}${p.best != null ? ` <small>${p.best}%</small>` : ''}` : ans ? `كمّل ${nm} <small>${ans}${tot ? '/' + tot : ''}</small>` : `حل ${nm}`;
      return `<a class="${cls} ${p.done ? 'ok' : ''}" href="#${t.set}">${lab}</a>`;
    }
    return (t.links || []).map(l => `<a class="${cls}" href="${l[0]}">${l[1]}</a>`).join('');
  }
  function taskLinks(t) {
    const y = t.set ? ytFor(t.set) : null;
    return (y ? `<a class="go yt" href="${y.url}" target="_blank" rel="noopener" title="مقطع شرح ${y.label} على يوتيوب">${YTSVG}<span>المقطع</span><small>${y.dur}</small></a>` : '') + taskSolve(t, 'go');
  }
  // بطاقة «رحلتك للاختبار» في الرئيسية: عدّاد الاختبار + مهمة اليوم من الخطة
  function tripHtml() {
    const ex = examGet(), exT = ex ? examAt(ex) : 0, now = Date.now();
    const st = planState(), plan = PLANS.find(p => p.id === st.id) || null;
    if (!ex && !plan) return lsGet(TRIPX_LS, 0) ? '' : `<div class="trip invite"><span class="tr-i" aria-hidden="true">⏳</span><span class="tr-t"><b>متى اختبارك؟</b> حدّد الموعد ونعرض لك عدّاد تنازلي، ونقترح لك خطة مذاكرة تلحق قبله.</span><span class="tr-b"><button class="btn sm" data-exam>حدّد الموعد</button><a class="btn sm ghost" href="#plan">خطط المذاكرة</a></span><button class="tr-x" id="trx" title="إخفاء" aria-label="إخفاء">✕</button></div>`;
    let h = '<section class="trip" aria-label="موعد اختبارك وخطتك">';
    if (ex) {
      const dl = dayDiff(now, exT), live = exT > now;
      h += `<div class="tr-ex"><div class="tr-l"><span class="tr-k">${live ? (dl === 0 ? '⏳ اختبارك اليوم بعد' : '⏳ باقي على اختبارك') : dl === 0 ? '🤲 اليوم اختبارك' : '🎓 كان اختبارك'}</span><span class="tr-d">${fmtDay(exT)}، الساعة ${fmtTime(exT)} <button class="lnk" data-exam>تعديل</button></span><span class="tr-m">${examMsg(dl)}</span></div>${live ? cdHtml(exT) : ''}</div>`;
    }
    if (plan) {
      const I = planInfo(plan, st);
      if (!I.cur) h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">🎉</span><div class="tr-pt"><span>خلّصت <b>${plan.name}</b> كاملة${ex && exT > now ? '. الحين راجع أخطاءك وحل الاختبارات المحاكية' : ''}.</span></div><a class="tr-go" href="#plan">الخطة</a></div>`;
      else {
        const links = I.cur.tasks.map(t => t.k === 'rest' ? '<span class="tchip rest">😴 يوم راحة</span>' : taskSolve(t, 'tchip')).join('');
        const fit = ex && exT > now ? fitInfo(I.end, exT) : null;
        const tags = `<span>${I.left >= 0 ? 'تخلص' : 'كانت تخلص'} ${fmtDay(I.end)}</span>` + (fit ? `<span class="fit ${fit.c}">${fit.s}</span>` : I.left > 0 ? `<span>باقي ${dLabel(I.left)}</span>` : '') + (I.lag > 0 ? `<span class="fit warn">متأخر ${I.lag === 1 ? 'يوم' : dLabel(I.lag)} عن الجدول</span>` : '') + (ex ? '' : '<button class="lnk" data-exam>حدّد موعد اختبارك</button>');
        h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span><b>خطتك اليوم</b> <span class="mut">(اليوم ${I.cur.n} من ${plan.days})</span></span><span class="tr-lk">${links}</span><small class="tr-end">${tags}</small></div><a class="tr-go" href="#plan">افتح الخطة</a></div>`;
      }
    } else h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span>ما اخترت خطة مذاكرة. <a href="#plan">اختر خطة تلحق قبل اختبارك</a></span></div></div>`;
    return h + '</section>';
  }
  function renderPlan() {
    document.title = 'خطة المذاكرة | Q-Guide';
    if (!manifest) fetch('/p/data/manifest.json').then(r => r.json()).then(m => { if (!manifest) { manifest = m; if (location.hash === '#plan') renderPlan(); } }).catch(() => {});
    const st = planState(); const plan = PLANS.find(p => p.id === st.id) || null;
    app.innerHTML = topbar(`<span class="ttl">📅 خطة المذاكرة</span><span class="sp"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap" id="planwrap"></main>`;
    bindCtl();
    const W = $('#planwrap'), now = Date.now();
    const ex = examGet(), exT = ex ? examAt(ex) : 0, live = exT > now;
    if (!plan) {   // اختيار الخطة
      const today = day0(), endOf = p => addDays(today, p.days - 1);
      let rec = null;
      if (live) { const fits = PLANS.filter(p => dayDiff(endOf(p), exT) >= 1); rec = fits.length ? fits.reduce((a, b) => b.days > a.days ? b : a) : PLANS[0]; }
      const dl = live ? dayDiff(now, exT) : 0;
      W.innerHTML = `<div class="hero"><div><h1>اختر الخطة اللي تناسب وقتك</h1><p>كل خطة تمشي على مقاطع الشرح (13 كمي و14 لفظي): تشاهد المقطع ثم تحل قسمه هنا في المنصة. تقدر تغيّر الخطة في أي وقت.</p></div></div>
        <div class="exrow"><span class="exi" aria-hidden="true">🎯</span><div class="ext">${ex ? `<b>اختبارك ${fmtDay(exT)}</b><span>${live ? (dl ? `باقي ${dLabel(dl)}. علّمنا لك بالنجمة ⭐ الخطة اللي تلحق قبله` : 'اختبارك اليوم! بالتوفيق') : 'الموعد المحفوظ مضى. حدّثه إذا عندك اختبار جديد'}</span>` : `<b>متى اختبارك؟</b><span>حدّد الموعد ونعلّم لك الخطة اللي تلحق قبله، ونعرض لك عدّاد تنازلي</span>`}</div><button class="btn sm ${ex ? 'ghost' : ''}" data-exam>${ex ? 'تعديل الموعد' : 'حدّد الموعد'}</button></div>
        <div class="plans">${PLANS.map(p => { const star = rec ? p === rec : !live && p.star; const end = endOf(p); const f = live ? fitInfo(end, exT) : null;
          return `<button class="pcard ${star ? 'star' : ''} ${f && f.c !== 'ok' ? 'late' : ''}" data-p="${p.id}">${star ? `<span class="pstar">⭐ ${rec ? 'الأنسب لموعد اختبارك' : 'الأنسب لأغلب الطلاب'}</span>` : ''}<span class="pn">${p.name}</span><span class="pdays">${p.days} يوماً</span><span class="pm">⏱ ${p.daily}</span><span class="pm">🎯 ${p.fit}</span><span class="pm">🏁 تخلص ${fmtDay(end)}</span>${f ? `<span class="pfit ${f.c}">${f.c === 'ok' ? '✓' : '⚠'} ${f.t}</span>` : ''}<span class="btn">ابدأ هذه الخطة</span></button>`; }).join('')}</div>
        ${rec && dayDiff(endOf(rec), exT) < 1 ? `<div class="pverd bad">⚠ باقي على اختبارك ${dl ? dLabel(dl) : 'أقل من يوم'} بس، وأقصر خطة 7 أيام. ابدأ بالخطة القوية وركّز على الأقسام اللي تحس إنك أضعف فيها.</div>` : ''}
        <div class="sum" style="margin-top:16px;text-align:right"><b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة مباشرة • اقرأ شرح كل سؤال أخطأت فيه، وأخطاؤك تنحفظ لك تلقائياً في «مراجعة أخطائي» • علّم ✓ عند إنهاء كل يوم • إذا فاتك يوم كمّل من مكانك ولا تحاول تعوّض يومين في يوم.</div>`;
      W.querySelectorAll('.pcard').forEach(b => b.onclick = () => { const all = lsGet('qg_plan_all', {}); planSave({ id: b.dataset.p, done: all[b.dataset.p] || {}, started: Date.now() }); renderPlan(); });
      bindExam(W, renderPlan);
      return;
    }
    const I = planInfo(plan, st), { days, done, cur } = I;
    const isDone = (d, i) => !!(done[d.n] && done[d.n][i]);
    const pct = Math.round(I.nDone * 100 / days.length);
    const icon = { q: '🔵', v: '🟢', r: '🟠', rest: '😴' };
    const fit = live ? fitInfo(I.end, exT) : null;
    const lagT = !cur ? 'خلّصت كل الأيام 🎉' : I.lag > 0 ? `<span class="fit warn">متأخر ${I.lag === 1 ? 'يوم' : dLabel(I.lag)} عن الجدول</span>` : I.lag < 0 ? `<span class="fit ok">متقدم ${-I.lag === 1 ? 'يوم' : dLabel(-I.lag)} عن الجدول 👏</span>` : '<span class="fit ok">ماشي على الجدول ✓</span>';
    const leftT = I.left > 0 ? `باقي ${dLabel(I.left)}` : I.left === 0 ? 'اليوم آخر يوم في الخطة' : `كان المفروض تخلص قبل ${dLabel(-I.left)}`;
    let verd = '';
    if (fit) verd = fit.c === 'ok' ? `✓ خطتك ${fit.t}${fit.gap >= 3 ? '. استغلها في مراجعة أخطائك والاختبارات المحاكية' : '. التزم بالجدول عشان تلحق'}.`
      : fit.c === 'warn' ? '⚠ خطتك تخلص يوم اختبارك نفسه. حاول تسبق الجدول بيوم أو يومين.'
      : (() => { const sh = PLANS.filter(p => p.days < plan.days && dayDiff(addDays(day0(), p.days - 1), exT) >= 1).sort((a, b) => b.days - a.days)[0]; return `⚠ خطتك ${fit.t}. ${sh ? `بدّل لـ«${sh.name}» (${dLabel(sh.days)})، أو ضاعف` : 'حاول تضاعف'} بعض الأيام عشان تلحق.`; })();
    let lastW = 0;
    W.innerHTML = `<div class="hero"><div><h1>${plan.name}</h1><p>${plan.days} يوماً · ${plan.daily}</p></div>
        <div class="pctl"><button class="btn sm ghost" id="chg">تغيير الخطة</button><button class="btn sm ghost" id="rst" title="يمسح علامات الإنجاز ويبدأ الخطة من اليوم">إعادة البدء</button></div></div>
      <div class="pstats">
        <div class="pst"><span class="pk">📅 تقدّمك</span><b>${cur ? `اليوم ${cur.n}` : '🎉 خلصت'}<small> من ${days.length}</small></b><div class="bar"><i style="width:${pct}%"></i></div><span class="ps">${lagT}</span></div>
        <div class="pst"><span class="pk">🏁 نهاية الخطة</span><b>${fmtDay(I.end)}</b><span class="ps">${leftT}</span></div>
        <div class="pst ex">${ex ? `<span class="pk">🎯 ${live ? 'باقي على اختبارك' : 'موعد اختبارك'}</span>${live ? cdHtml(exT, true) : `<b>${fmtDay(exT)}</b>`}<span class="ps">${live ? fmtDay(exT) + '، ' + fmtTime(exT) + ' · ' : ''}<button class="lnk" data-exam>تعديل</button></span>` : `<span class="pk">🎯 موعد اختبارك</span><b class="none">ما حدّدته</b><span class="ps"><button class="btn sm" data-exam>حدّد الموعد</button></span>`}</div>
      </div>
      ${verd ? `<div class="pverd ${fit.c}">${verd}</div>` : ''}
      <div class="days">${days.map(d => { const wk = plan.days > 14 && d.w !== lastW ? `<div class="wk">الأسبوع ${d.w}</div>` : ''; lastW = d.w || lastW; const dd = I.dayDone(d); const isCur = cur && cur.n === d.n;
        return wk + `<section class="day ${dd ? 'done' : ''} ${isCur ? 'cur' : ''}" id="day${d.n}"><header><label class="dchk"><input type="checkbox" data-day="${d.n}" ${dd ? 'checked' : ''}><span>اليوم ${d.n}</span></label><span class="mut">${d.time} · ${fmtDay(addDays(I.start, d.n - 1))}</span>${isCur ? '<span class="now">اليوم الحالي</span>' : ''}</header>
          <ul>${d.tasks.map((t, i) => `<li class="${isDone(d, i) ? 'ok' : ''} k${t.k}"><label><input type="checkbox" data-day="${d.n}" data-i="${i}" ${isDone(d, i) ? 'checked' : ''}><span class="ic" aria-hidden="true">${icon[t.k] || ''}</span><span class="tt">${t.t}</span></label><span class="tl">${taskLinks(t)}</span></li>`).join('')}</ul></section>`; }).join('')}</div>
      <div class="sum" style="margin-top:16px;text-align:right">🔵 كمي · 🟢 لفظي · 🟠 مراجعة. <b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة، واقرأ شرح كل سؤال أخطأت فيه. إذا فاتك يوم كمّل من مكانك ولا تعوّض يومين في يوم.<br><span class="mut">ملاحظة: القسم 14 من الكمي (<bdi dir="ltr">643-733</bdi>) إضافي خارج الجدول. حِلّه بعد ما تخلص الخطة أو في أيام المراجعة.</span></div>`;
    const save = () => planSave(Object.assign(st, { done }));
    W.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { done[c.dataset.day] = done[c.dataset.day] || {}; if (c.checked) done[c.dataset.day][c.dataset.i] = 1; else delete done[c.dataset.day][c.dataset.i]; save(); renderPlan(); });
    W.querySelectorAll('input[data-day]:not([data-i])').forEach(c => c.onchange = () => { const d = days.find(x => x.n == c.dataset.day); done[d.n] = {}; if (c.checked) d.tasks.forEach((t, i) => done[d.n][i] = 1); save(); renderPlan(); });
    $('#chg').onclick = async () => { if (await QGDlg.confirm('تغيير الخطة؟ (علامات الإنجاز الحالية تُحفظ لو رجعت لنفس الخطة لاحقاً)', { ok: 'تغيير' })) { const all = lsGet('qg_plan_all', {}); all[plan.id] = done; lsSet('qg_plan_all', all); planSave({ id: '', done: {} }); renderPlan(); } };
    $('#rst').onclick = async () => { if (await QGDlg.confirm('مسح كل علامات الإنجاز والبدء من اليوم 1؟', { ok: 'إعادة البدء', danger: true })) { planSave({ id: plan.id, done: {}, started: Date.now() }); renderPlan(); } };
    bindExam(W, renderPlan);
    if (cur) { const el = $('#day' + cur.n); if (el && days.length > 8) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150); }
  }

  // ---------- 🏆 لوحة الصدارة ----------
  async function renderBoard(kind) {
    document.title = 'لوحة الصدارة | Q-Guide';
    const isSet = kind.startsWith('set:'); const setId = isSet ? kind.slice(4) : (lsGet('qg_lb_set', 'q1'));
    if (isSet) lsSet('qg_lb_set', setId);
    const tabK = isSet ? 'set' : kind;
    const setTitle = id => (id[0] === 'q' ? 'القسم ' : 'النموذج ') + id.slice(1) + (id[0] === 'q' ? ' (كمي)' : ' (لفظي)');
    const opts = [...Array.from({ length: 14 }, (_, i) => 'q' + (i + 1)), ...Array.from({ length: 14 }, (_, i) => 'v' + (i + 1))];
    app.innerHTML = topbar(`<span class="ttl">🏆 لوحة الصدارة</span><span class="sp"></span><button class="ib" id="lbref" title="تحديث">⟳</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap"><div class="tabs lbtabs"><button data-k="month" class="${tabK === 'month' ? 'on' : ''}">📆 هذا الشهر</button><button data-k="practice" class="${tabK === 'practice' ? 'on' : ''}">📚 الكل</button><button data-k="set" class="${tabK === 'set' ? 'on' : ''}">🎯 حسب القسم</button><button data-k="exam" class="${tabK === 'exam' ? 'on' : ''}">🧪 المحاكي</button></div>
      ${isSet ? `<div class="setpick"><label>اختر القسم:</label><select id="lbset">${opts.map(o => `<option value="${o}" ${o === setId ? 'selected' : ''}>${setTitle(o)}</option>`).join('')}</select></div>` : ''}
      <p class="mut lbnote">${kind === 'exam' ? 'الترتيب بـ<b>متوسط النسبة المئوية</b> لأول محاولة في كل اختبار محاكي (نفس درجة قياس من 100)، ثم عدد الاختبارات، ثم الأسرع وقتاً.'
        : isSet ? `ترتيب الطلاب في <b>${setTitle(setId)}</b> بنسبة <b>أول محاولة</b> فيه، وعند التساوي الأسرع وقتاً.`
        : kind === 'month' ? 'أفضل 100 طالب <b>هذا الشهر</b>: مجموع الإجابات الصحيحة في أول محاولة لكل قسم ونموذج خلال الشهر، وعند التساوي الأسرع وقتاً.'
        : 'الترتيب العام: مجموع الإجابات الصحيحة في <b>أول محاولة</b> لكل قسم ونموذج، وعند التساوي الأسرع وقتاً. إعادة القسم للتدريب لا تغيّر ترتيبك.'}</p>
      <div id="lb"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
    bindCtl(); $('#lbref').onclick = () => renderBoard(kind);
    document.querySelectorAll('.lbtabs button').forEach(b => b.onclick = () => { const k = b.dataset.k; location.hash = k === 'practice' ? 'board' : k === 'set' ? 'board-set-' + lsGet('qg_lb_set', 'q1') : 'board-' + k; });
    const sel = $('#lbset'); if (sel) sel.onchange = () => { location.hash = 'board-set-' + sel.value; };
    let r; try { r = await api({ op: 'leaderboard', session: auth.session, kind }); } catch (e) { r = null; }
    const el = $('#lb'); if (!el) return;
    if (!r || !r.ok) { if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || '')); el.innerHTML = '<div class="center">تعذّر تحميل اللوحة</div>'; return; }
    const fmt = s => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h} س ${m % 60} د` : m ? `${m} د` : `${s} ث`; };
    const pct = x => x.q ? Math.round(x.correct * 100 / x.q) : 0;
    const unit = kind === 'exam' ? 'اختبار' : 'قسم';
    // عرض الدرجة: المحاكي والقسم = نسبة مئوية؛ العام والشهر = إجابات صحيحة (+ النسبة)
    const scoreHtml = x => kind === 'exam' ? `<b>${Math.round(x.score)}%</b>` : isSet ? `<b>${Math.round(x.score)}%</b> <small>${x.correct}/${x.q}</small>` : `<b>${x.score}</b> ✓`;
    const subHtml = x => kind === 'exam' ? `${x.done} ${x.done === 1 ? 'اختبار' : 'اختبارات'} · ${fmt(x.secs)}` : isSet ? fmt(x.secs) : `${pct(x)}% دقة · ${fmt(x.secs)}`;
    const mine = r.me ? `<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${r.total} ${r.total === 1 ? 'طالب' : 'طالباً'}</b><span>${kind === 'exam' ? Math.round(r.me.score) + '% متوسط · ' + r.me.done + ' ' + unit : isSet ? Math.round(r.me.score) + '% (' + r.me.correct + '/' + r.me.q + ')' : r.me.score + ' إجابة صحيحة · ' + r.me.done + ' ' + unit} · ${fmt(r.me.secs)}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">اختبار جديد</a>' : isSet ? `<a class="btn sm" href="#${setId}">افتح القسم</a>` : '<a class="btn sm" href="#">تدرّب</a>'}</div>`
      : `<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>${kind === 'exam' ? 'أنهِ اختباراً محاكياً واحداً وتظهر هنا.' : isSet ? 'حل هذا القسم مرة واحدة وتظهر هنا.' : kind === 'month' ? 'حل قسماً هذا الشهر وتظهر هنا.' : 'حل قسماً أو نموذجاً واحداً وتظهر هنا.'}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">ابدأ اختباراً</a>' : isSet ? `<a class="btn sm" href="#${setId}">ابدأ القسم</a>` : '<a class="btn sm" href="#">ابدأ قسماً</a>'}</div>`;
    if (!r.top.length) { el.innerHTML = mine + `<div class="sum" style="margin-top:12px">🏆 اللوحة فاضية — كن أول من يظهر هنا!</div>`; return; }
    const medal = k => ['🥇', '🥈', '🥉'][k - 1] || '';
    const top3 = r.top.slice(0, 3), rest = r.top.slice(3);
    const podium = top3.length >= 3 ? `<div class="podium">${[1, 0, 2].map(i => { const x = top3[i]; return `<div class="pd p${x.rank} ${x.me ? 'me' : ''}">${avatarHtml(x.a, x.n, x.rank === 1 ? 72 : 60)}<div class="pr">${medal(x.rank)}</div><b title="${esc(x.n)}">${esc(x.n)}</b><span class="pscore">${scoreHtml(x)}</span><span>${subHtml(x)}</span></div>`; }).join('')}</div>` : '';
    const list = top3.length >= 3 ? rest : r.top;
    const cols = kind === 'exam' ? ['النسبة', 'الاختبارات', 'الوقت'] : isSet ? ['النسبة', 'الصحيحة', 'الوقت'] : ['الصحيحة', 'الدقة', 'الوقت'];
    const cells = x => kind === 'exam' ? [`<b>${Math.round(x.score)}%</b>`, x.done, fmt(x.secs)] : isSet ? [`<b>${Math.round(x.score)}%</b>`, `${x.correct}/${x.q}`, fmt(x.secs)] : [`<b>${x.score}</b> ✓`, pct(x) + '%', fmt(x.secs)];
    el.innerHTML = mine + podium + `<div class="lbl-list">
      <div class="lbr head"><span class="rk">#</span><span class="nm">الطالب</span><span class="sc">${cols[0]}</span><span class="ac">${cols[1]}</span><span class="tm">${cols[2]}</span>${!isSet && kind !== 'exam' ? `<span class="dn">الأقسام</span>` : ''}</div>
      ${list.map(x => { const c = cells(x); return `<div class="lbr ${x.me ? 'me' : ''} ${x.rank <= 3 ? 'top' : ''}"><span class="rk">${x.rank <= 3 ? medal(x.rank) : x.rank}</span>${avatarHtml(x.a, x.n, 38)}<span class="nm">${esc(x.n)}</span>${x.me ? '<span class="you">أنت</span>' : ''}<span class="sc">${c[0]}</span><span class="ac">${c[1]}</span><span class="tm">${c[2]}</span>${!isSet && kind !== 'exam' ? `<span class="dn">${x.done}</span>` : ''}</div>`; }).join('')}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">يُعرض أفضل 100 طالب، واللوحة تتحدث كل دقيقة. تقدر تغيّر اسمك وصورتك من زر اسمك في الصفحة الرئيسية.</p>`;
  }

  applyFs(); applyTheme();
  if (!gsiFromHash()) route();
})();
