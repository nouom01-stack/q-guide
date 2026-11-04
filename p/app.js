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
  // 🆓 الحساب المجاني (زائر غير مشترك): القسم 1، النموذج 1، الاختبار المحاكي 1، تحديد المستوى، البحث (يعرف مكان السؤال بدون الحل)، والساحة 1v1 بحد يومي
  const isFree = () => !!(auth && auth.role === 'free');
  const FREE_SETS = ['q1', 'v1', 'placement'], JOIN_URL = 'https://www.youtube.com/@Q-guide1/join', PRICE = 140, FREE_GAMES = 3;
  // 🎬 مقاطع الشرح على قناة Q-guide1 (نفس روابط باركود المذكرات)
  const YT = {
    q: { name: 'القسم', rules: { id: 'WjcD6JHnwIc', dur: '45:44', t: 'مقطع قواعد الكمي', d: 'كل قوانين الكمي (الكسور، الجذور، النسب، الهندسة، الساعة…) في مقطع واحد — شاهده قبل الأقسام' }, list: 'PLNdATbln9B4k',
      v: ['WBnwPsSTuaU:36:18', 'SLGGlm5YwJU:34:43', 'VoVaWRFbIjg:36:50', 'dwvgSfK6Tfw:34:10', 'eVZsYR0QPq8:35:39', 'd3hX21VfSWo:34:19', 'EMNaSCi0IMk:43:40', 'fQynzmnlZmI:34:15', 'i4ELxBTMUw0:40:51', 'mZdhgMMOWB0:40:01', 'bscPMN6lDPQ:36:29', '6AxdKpQZevk:34:16', 'iVR5LsbBBv4:29:38', 'vf-aOADLlCs:56:06'] },
    v: { name: 'النموذج', rules: { id: 'vo91Yxx_6vw', dur: '14:18', t: 'مقطع قواعد التناظر اللفظي', d: 'شرح علاقات التناظر وطريقة الحل — شاهده قبل أول نموذج' }, list: 'PLVFHCj9Zxd0E',
      v: ['qWlJ9gh2G3U:24:15', 'l4v74KKFrj8:23:59', '5EOXngu_9R0:19:54', 'BFewNC6ocP4:25:05', 'r34_ruXqoJg:17:50', '85cq5t4G9Rs:23:07', 'za5kEoY6bxI:17:37', 'ShJH_Dpijiw:16:33', 'SmU59p7M5OY:18:37', 'V1-07MAx6YI:12:32', 'oYJmNRMwAKg:15:49', 'vSrkVscXAXs:17:45', 'VcaywhqSsVM:21:40', 'mFYiB0Z9G5k:15:17'] } };
  const ytUrl = id => 'https://youtu.be/' + id;
  // 🎁 المشترك المجاني أو بالتحويل ما يشوف مقاطع الأعضاء: الخادم يرسل له روابط النسخ الخاصة (auth.yt) ونستخدمها بدل الأصلية
  const ytAlt = () => auth && auth.yt && (auth.sub === 'free' || auth.sub === 'bank') ? auth.yt : null;
  const YT_ALT_TIP = 'مقطع خاص لك: افتحه وأنت داخل يوتيوب بنفس إيميل Google اللي تدخل فيه الموقع';
  function ytFor(setId) { const m = /^([qv])(\d{1,2})$/.exec(setId || ''); if (!m) return null; const k = YT[m[1]], raw = k.v[+m[2] - 1]; if (!raw) return null; const i = raw.indexOf(':'), A = ytAlt(), alt = A && A[m[1]] && A[m[1]].v ? A[m[1]].v[+m[2] - 1] : ''; const id = alt || raw.slice(0, i); return { id, dur: raw.slice(i + 1), url: ytUrl(id), label: k.name + ' ' + m[2], alt: !!alt }; }
  const ytRules = k => { const A = ytAlt(), alt = A && A[k] && A[k].rules; return alt ? Object.assign({}, YT[k].rules, { id: alt, alt: true }) : YT[k].rules; };
  const ytList = k => { const A = ytAlt(); return (A && A[k] && A[k].list) || YT[k].list; };
  const ytTip = (y, t) => y && y.alt ? ` title="${YT_ALT_TIP}"` : t ? ` title="${t}"` : '';
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
  const DATA_V = 3;   // ⬆️ ارفعه كل ما تغيّرت ملفات الأسئلة (حتى ما يبقى الطالب على نسخة قديمة من الكاش)
  async function loadSet(id) {
    if (cache[id]) return cache[id];
    if (isFree() && FREE_SETS.indexOf(id) < 0) throw new Error('locked');   // 🔒 للمشتركين
    if (id === 'qall' || id === 'vall') {
      const k = id[0]; let got = 0; const el = () => document.getElementById('ldmsg');
      const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const m = el(); if (m) m.textContent = 'تحميل الأسئلة… ' + got + ' / 14'; return p; })));
      let obj;
      if (k === 'q') obj = { kind: 'quant', id: 'qall', title: 'الاختبار الشامل — الكمي', sub: 'All 14 sections', items: [].concat(...parts.map(p => p.items.map((it, j) => Object.assign({}, it, { src: p.id, sidx: j })))) };
      else obj = { kind: 'verbal', id: 'vall', title: 'الاختبار الشامل — اللفظي', sub: 'All 14 models', groups: [].concat(...parts.map(p => originGroups(p))) };
      cache[id] = obj; return obj;
    }
    if (/^t-/.test(id)) return loadTopicSet(id);
    const r = await fetch('/p/data/' + (isFree() ? 'free/' : '') + id + '.bin?v=' + DATA_V, { cache: 'force-cache' });
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
  function logout(msg, tellServer, good) {
    if (tellServer && auth && auth.session) { try { api({ op: 'logout', session: auth.session }); } catch (e) {} }
    lsDel(LS.auth); auth = null; cryptoKey = null; P = null; document.onkeydown = null;
    try { window.google && google.accounts.id.disableAutoSelect(); } catch (e) {}
    if (msg) { location.hash = ''; renderLogin(msg, good); } else route();
  }
  // 🔒 جلسة واحدة لكل طالب: نتأكد من الخادم عند الفتح وكل 3 دقائق
  let hbBusy = false;
  async function heartbeat() {
    if (!auth || hbBusy) return; hbBusy = true;
    try {
      const r = await api({ op: 'me', session: auth.session });
      if (r && !r.ok && r.error === 'upgraded') logout(esc(r.msg || 'تم تفعيل اشتراكك، سجّل دخولك من جديد.'), false, 1);   // 🎉 الزائر اشترك
      else if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) logout(esc(r.msg || 'انتهت الجلسة، سجّل دخولك من جديد.'));
      else if (r && r.ok && auth.role === 'admin' && r.staff && r.staff !== auth.staff) { auth.staff = r.staff; lsSet(LS.auth, auth); }
      if (r && r.ok && auth && auth.role !== 'admin' && auth.role !== 'free' && r.sub && (r.sub !== auth.sub || JSON.stringify(r.yt || null) !== JSON.stringify(auth.yt || null))) {   // 💳 المالك غيّر نوع اشتراكه
        auth.sub = r.sub; auth.yt = r.yt || null; lsSet(LS.auth, auth); if (!location.hash || location.hash === '#') renderHome(); }
    } catch (e) {} finally { hbBusy = false; }
  }
  setInterval(heartbeat, 3 * 60 * 1000);

  // ---------- 🆓 الزائر: المسارات المفتوحة + نافذة الاشتراك ----------
  const freeRoute = h => h === '' || h === 'arena' || /^duel-[A-Za-z0-9]{6}$/.test(h) || h === 'board-arena' || h === 'level' || h === 'find' || /^[qv]1(@\d+)?$/.test(h);
  function lockName(h) {
    const m = /^([qv])(\d+)/.exec(h); if (m) return SET_NAME(m[1] + m[2]);
    if (/^sub-t\d{1,2}$/.test(h)) return 'الاختبار المحاكي ' + h.slice(5);
    if (/^board/.test(h)) return 'لوحة الصدارة'; if (h === 'qall' || h === 'vall') return 'الاختبار الشامل'; if (/^t-/.test(h)) return 'التدريب على نقاط ضعفك';
    return { notes: 'دفتري', rules: 'قوانين الكمي', 'rules-v': 'قواعد اللفظي', plan: 'خطة المذاكرة', skills: 'نقاط القوة والضعف', badges: 'الإنجازات', vocab: 'قاموس الكلمات', 'wb-q': 'مذكرة الكمي', 'wb-v': 'مذكرة اللفظي' }[h.replace(/-v\d+$/, '')] || '';
  }
  function subDlg(what, from) {
    if (isFree() && window.QGT) QGT.ev('sub', what || from || 'زر الاشتراك');   // 👀 فتح نافذة الاشتراك (وش اللي فتحها)
    document.querySelectorAll('.subdlg').forEach(x => x.remove());
    const ov = document.createElement('div'); ov.className = 'qgdlg subdlg'; ov.setAttribute('dir', 'rtl');
    const wa = 'https://wa.me/966508003683?text=' + encodeURIComponent('السلام عليكم، أبي أشترك في دورة Q-Guide' + (auth && auth.email ? '\nإيميلي في الموقع: ' + auth.email : ''));
    ov.innerHTML = `<div class="qgdlg-box sub-box" role="dialog" aria-modal="true" aria-labelledby="subh">
      <button class="sub-x" type="button" aria-label="إغلاق">✕</button>
      ${what ? `<p class="sub-lock">🔒 ${esc(what)} للمشتركين في الدورة</p>` : ''}
      <h3 id="subh">اشترك في دورة Q-Guide</h3>
      <ul class="sub-l"><li><b>14</b> قسم كمي و<b>14</b> نموذج لفظي بالشرح والفيديو</li><li><b>17</b> اختبار محاكي بنفس نظام قياس</li><li>الساحة 1v1 بدون حد، ولوحات الصدارة</li><li>المذكرات وخطة المذاكرة ونقاط ضعفك</li></ul>
      <h4>طريقة الاشتراك</h4>
      <ol class="sub-s"><li>انتسب لقناة Q-guide1 في يوتيوب بـ <b>${PRICE} ريال</b></li><li>أرسل لنا على واتساب إيميلك اللي دخلت فيه هنا</li><li>نفعّل لك الدورة كاملة على نفس حسابك</li></ol>
      <div class="sub-a"><a class="btn gold" href="${JOIN_URL}" target="_blank" rel="noopener">اشترك من يوتيوب</a><a class="btn wa" href="${wa}" target="_blank" rel="noopener">راسلنا على واتساب</a></div>
    </div>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
    const close = () => { ov.remove(); document.removeEventListener('keydown', onK); };
    const onK = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onK);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.sub-x').onclick = close; ov.querySelector('.sub-a a').focus({ preventScroll: true });
    ov.querySelectorAll('.sub-a a').forEach(a => a.addEventListener('click', () => { if (isFree() && window.QGT) { QGT.ev('subgo', a.classList.contains('wa') ? 'واتساب' : 'يوتيوب'); QGT.flush(true); } }));
  }
  // أي زر فيه data-lock أو data-sub يفتح نافذة الاشتراك
  function bindSub(root) { (root || document).querySelectorAll('[data-lock],[data-sub]').forEach(b => b.onclick = e => { e.preventDefault(); const w = b.dataset.lock || ''; if (w && isFree() && window.QGT) QGT.ev('lock', w); subDlg(w); }); }
  const lockTool = (i, b, s) => `<button type="button" class="tool lk" data-lock="${esc(b)}"><span class="ti">${i}</span><span class="tx"><b>${b}<span class="lkb">🔒 للمشتركين</span></b><small>${s}</small></span></button>`;
  function freeHero() {
    const lv = lsGet(LVL_LS, null);
    return `<section class="fhero" aria-label="الحساب المجاني">
      <div class="fh-t"><h2>أنت على الحساب المجاني</h2><p>جرّب القسم 1 والنموذج 1 والاختبار المحاكي 1 وتحديد المستوى، والعب ${FREE_GAMES} مباريات كل يوم في الساحة 1v1. اشترك وتنفتح لك الدورة كاملة.</p></div>
      <div class="fh-a"><button type="button" class="btn gold" data-sub>اشترك في الدورة <small>${PRICE} ريال</small></button>${lv ? '' : '<a class="btn ghost" href="#level">🧭 اعرف مستواك أول</a>'}</div>
    </section>`;
  }

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
    if (h !== 'arena' && !/^duel-/.test(h)) arLeave();
    if (isFree() && !freeRoute(h)) { const nm = lockName(h); if (h !== 'sub' && window.QGT) QGT.ev('lock', nm || h); history.replaceState(null, '', location.pathname); renderHome(); return subDlg(nm, h === 'sub' ? 'الاختبارات المحاكية' : ''); }   // 🔒 للمشتركين
    if (isFree() && window.QGT) QGT.page(h === '' ? 'home' : /^duel-/.test(h) ? 'duel' : h.replace(/@\d+$/, ''));   // 👀 وش فتح الزائر
    if (h === 'arena') return renderArena();
    if (/^duel-[A-Za-z0-9]{6}$/.test(h)) return renderArena(h.slice(5).toUpperCase());
    if (h === 'board-arena') return renderBoard('arena');
    if (/^[qv]\d+$/.test(h)) return renderPlayer(h);
    if (/^[qv]\d+@\d+$/.test(h)) { const [sid, si] = h.split('@'); return renderPlayer(sid, +si); }
    if (h === 'notes') return renderNotes();
    if (h === 'badges') return renderBadges();
    if (h === 'level') return renderLevel();
    if (h === 'rules' || h === 'rules-v') return renderRules(h === 'rules-v' ? 'v' : 'q');
    if (h === 'find') return renderFind();
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
    if (h === 'admin' || h === 'admin-staff' || h === 'admin-members' || h === 'admin-subs' || h === 'admin-regs' || h === 'admin-free' || h === 'admin-ai' || h === 'admin-find') { if (auth.role === 'admin') return h === 'admin' ? renderAdmin() : h === 'admin-staff' ? renderStaff() : h === 'admin-free' ? renderFreeUsers() : h === 'admin-ai' ? renderAiAdmin() : h === 'admin-find' ? renderFindLog() : h === 'admin-subs' ? renderSubs() : h === 'admin-regs' ? renderRegs() : renderMembers(); location.hash = ''; return; }
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
  function renderLogin(err, good) {
    document.title = 'تسجيل الدخول | Q-Guide';
    const mem = /[?&]m=1(&|$)/.test(location.search);   // جا من «دخول المشتركين» في الصفحة الرئيسية: صفحة دخول للمشترك بدون «جرّب مجاناً»
    app.innerHTML = `<div class="login"><div class="card">
      <img src="/assets/logo.png" alt="Q-Guide">
      <h1>${mem ? 'دخول المشتركين' : 'منصة تدريب Q-Guide'}</h1>
      <p class="sub">${mem ? 'سجّل بنفس إيميل Google اللي اشتركت فيه، وتنفتح لك الدورة كاملة.' : 'أسئلة القدرات الإنجليزي — الكمي واللفظي — مع الشرح'}</p>
      <div class="gbtn" id="gbtn"><div class="spin"></div></div>
      ${err ? `<div class="${good ? 'okm' : 'err'}">${err}</div>` : ''}
      ${mem ? '' : '<div class="lg-free"><b>جرّب مجاناً بحساب Google</b><ul><li>القسم 1 كمي</li><li>النموذج 1 لفظي</li><li>الاختبار المحاكي 1</li><li>تحديد المستوى</li><li>الساحة 1v1</li></ul></div>'}
      <p class="note">${mem ? '' : 'مشترك في الدورة؟ سجّل بنفس إيميل Google اللي اشتركت فيه وتنفتح لك الدورة كاملة.<br>'}الحساب يعمل على <b>جهاز واحد</b> في الوقت نفسه.</p>
      ${mem ? '<p class="note" style="margin-top:6px"><a href="/p/">مو مشترك؟ جرّب مجاناً</a></p>' : ''}
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
    const host = $('#gbtn'); if (host) host.innerHTML = '<div class="spin"></div><span style="margin-inline-start:10px;color:var(--mut)">جارٍ تسجيل الدخول…</span>';
    try {
      const r = await api({ op: 'login', idToken: resp.credential, ua: navigator.userAgent.slice(0, 120) });
      if (!r.ok) {
        const msg = r.msg || (r.error === 'not_member' ? 'هذا الحساب غير مسجّل في الدورة.' : 'تعذّر تسجيل الدخول (' + esc(r.error || '') + ').');
        return renderLogin(esc(msg) + '<br><a href="https://wa.me/966508003683" target="_blank" rel="noopener">تواصل معنا على واتساب 0508003683</a>');
      }
      auth = { name: r.name, email: r.email, phone: r.phone || '', key: r.key, exp: r.exp, session: r.session, gender: r.gender || '', role: r.role || 'student', staff: r.staff || '', files: r.files || null, member: r.member || '', display: r.display || r.name, avatar: r.avatar || '', sub: r.sub || '', yt: r.yt || null };
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
    const RR = ytRules(tab === 'quant' ? 'q' : 'v');
    const nq = manifest.quant.reduce((a, b) => a + b.n, 0), nv = manifest.verbal.reduce((a, b) => a + b.n, 0);
    const megaPct = (id, n) => Math.round(Object.keys(progGet(id).a || {}).length * 100 / n);
    if (!isFree()) badgeCheck();
    const pst = planState(), pl = PLANS.find(p => p.id === pst.id), lv = lsGet(LVL_LS, null), nMarks = marksList().length, isStaff = auth.role === 'admin';
    const FR = isFree();   // 🆓 الزائر يشوف كل الأدوات، والمقفل عليه قفل ويفتح نافذة الاشتراك
    const toolA = (href, i, b, s, tag, free) => FR && !free ? lockTool(i, b, s) : `<a class="tool" href="${href}"><span class="ti">${i}</span><span class="tx"><b>${b}${tag || ''}</b><small>${s}</small></span></a>`;
    const toolB = (id, i, b, s) => FR ? lockTool(i, b, s) : `<button type="button" class="tool" id="${id}"><span class="ti">${i}</span><span class="tx"><b>${b}</b><small id="${id}l">${s}</small></span></button>`;
    app.innerHTML = topbar(`<span class="sp"></span><nav class="tnav"><a class="tn ar" href="#arena" title="الساحة 1v1: تحدَّ طالب مباشرة"><span class="i">⚔️</span><span class="l">الساحة</span></a>${isFree() ? '<button type="button" class="tn subn" data-sub title="اشترك في الدورة"><span class="i">⭐</span><span class="l">اشترك</span></button>' : '<a class="tn" href="#board" title="لوحة الصدارة"><span class="i">🏆</span><span class="l">الصدارة</span></a><a class="tn" href="#skills" title="نقاط القوة والضعف"><span class="i">🎯</span><span class="l">مهاراتي</span></a>'}${adminLinks}</nav><button class="chip me" id="me" title="ملفي: الاسم والصورة">${avatarHtml(auth.avatar, auth.display || auth.name, 26)}<span>${esc(auth.display || auth.name || auth.email)}</span></button><button class="ib lo" id="lo" title="تسجيل الخروج" aria-label="تسجيل الخروج">${LOSVG}</button>`) +
    `<main class="wrap home">
      ${FR ? freeHero() : ''}<div id="rz">${rzHtml()}</div>
      ${FR ? '' : '<div id="trip"></div>'}
      <div class="hrow"><div class="tabs" role="tablist"><button role="tab" data-t="quant" class="${tab === 'quant' ? 'on' : ''}" aria-selected="${tab === 'quant'}">📐 الكمي <small>14 قسم</small></button><button role="tab" data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}" aria-selected="${tab === 'verbal'}">📖 اللفظي <small>14 نموذج</small></button></div>
        <span class="sp"></span><a class="rvid" href="${ytUrl(RR.id)}" target="_blank" rel="noopener" title="${RR.alt ? YT_ALT_TIP : esc(RR.d)}">${YTSVG}<span>${RR.t}</span>${RR.dur ? `<small>${RR.dur}</small>` : ''}</a><a class="rall" href="https://www.youtube.com/playlist?list=${ytList(tab === 'quant' ? 'q' : 'v')}" target="_blank" rel="noopener">كل المقاطع</a>${!RULES_ON ? '' : tab === 'quant' ? '<a class="rvid rl" href="#rules"><span class="i">📐</span><span>ملخص القوانين</span></a>' : '<a class="rvid rl" href="#rules-v"><span class="i">📘</span><span>ملخص القواعد</span></a>'}</div>
      <div class="sheets" id="grid"></div>
      <h2 class="h2">أدوات المذاكرة</h2>
      <section class="tgroups">
        <div class="tg"><h3>اختبر نفسك</h3>
          ${toolA('#level', '🧭', 'تحديد المستوى', lv ? `مستواك: ${LEVELS[lv.lvl].t} (${lv.pct}%) · تقدر تعيده` : '20 سؤال تعرف منها مستواك ونقاط ضعفك', FR ? '<span class="frb">مجاني</span>' : '', 1)}
          ${toolA('#arena', '⚔️', 'الساحة 1v1', FR ? `تحدَّ طالب مباشرة، ${FREE_GAMES} مباريات مجانية كل يوم` : 'تحدَّ طالب مباشرة في 20 سؤال كمي ولفظي', FR ? '<span class="frb">مجاني</span>' : '<span class="beta">جديد</span>', 1)}
          ${toolA('/test/', '🧪', 'الاختبارات المحاكية', FR ? 'الاختبار المحاكي 1 مجاني، والـ 16 الباقية للمشتركين' : '17 اختبار بنفس شكل قياس المحوسب', FR ? '<span class="frb">1 مجاني</span>' : '', 1)}
          ${FR ? lockTool('🏁', 'الاختبار الشامل', 'كل الأسئلة في اختبار واحد متواصل') : `<div class="tool"><span class="ti">🏁</span><span class="tx"><b>الاختبار الشامل</b><small>كل الأسئلة في اختبار واحد متواصل</small></span><span class="tbtns"><a href="#qall">الكمي <small>${nq}</small>${megaPct('qall', nq) ? `<em>${megaPct('qall', nq)}%</em>` : ''}</a><a href="#vall">اللفظي <small>${nv}</small>${megaPct('vall', nv) ? `<em>${megaPct('vall', nv)}%</em>` : ''}</a></span></div>`}</div>
        <div class="tg"><h3>تعلّم وراجع</h3>
          ${toolA('#find', '🔎', 'ابحث عن سؤال', FR ? 'اكتب السؤال أو صوّره ونقولك إذا هو في الدورة ووين' : 'اكتب السؤال أو صوّره ونقولك وين تلقاه', FR ? '<span class="frb">مجاني</span>' : '<span class="beta">جديد</span>', 1)}
          ${RULES_ON ? toolA('#rules', '📐', 'قوانين الكمي', 'القوانين اللي تحتاجها أسئلة الدورة، وتنطبع') + toolA('#rules-v', '📘', 'قواعد اللفظي', 'طرق الحل وأنواع الأسئلة في صفحة وحدة', FR ? '' : '<span class="beta">جديد</span>') : ''}
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
      ${auth.member === 'manual' || FR ? '' : `<h2 class="h2" id="wbh">📘 مذكراتك</h2>
      <div class="wb" id="wb"><div class="mut">جارٍ تحميل مذكراتك…</div></div>`}
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
      if (isFree() && FREE_SETS.indexOf(s.id) < 0) return `<button class="sheet lk" data-id="${s.id}"><span class="sh-h"><b>${SET_NAME(s.id)}</b><span class="lkb">🔒</span></span><span class="sh-s">${sub}</span><span class="sh-lk">${s.n} سؤال مع الشرح للمشتركين</span></button>`;
      return `<button class="sheet ${st.done ? 'done' : st.ans ? 'doing' : ''}${isFree() ? ' fr' : ''}" data-id="${s.id}"><span class="sh-h"><b>${SET_NAME(s.id)}</b>${stamp}</span><span class="sh-s">${sub}</span><span class="sh-dots" aria-hidden="true" style="--c:${cols(s.n, 16)};--cm:${cols(s.n, 12)}">${dotsHtml(s.id, s.n, -1)}</span><span class="sh-f">${foot}</span></button>`;
    }).join('');
    grid.querySelectorAll('.sheet').forEach(b => b.onclick = () => { if (b.classList.contains('lk')) { if (window.QGT) QGT.ev('lock', SET_NAME(b.dataset.id)); return subDlg(SET_NAME(b.dataset.id)); } location.hash = b.dataset.id; });
    bindSub(app);
    const bindGoal = () => { const g = $('#goal'); if (g) g.onclick = () => { const cur = goalGet(); const nx = GOALS[(GOALS.indexOf(cur) + 1) % GOALS.length]; lsSet(GOAL_LS, nx); $('#rz').innerHTML = rzHtml(); bindGoal(); toast('هدفك اليومي صار ' + nx + ' سؤال'); }; };
    bindGoal();
    const rb = $('#rem'); if (rb) rb.onclick = () => remDlg().then(() => { const l = $('#reml'); if (l) l.textContent = remLabel(); });
    if (!isFree()) badgeCheckSoon(); remCtx();
    const paintTrip = () => { const t = $('#trip'); if (!t) return; t.innerHTML = tripHtml(); bindExam(t, paintTrip); const x = $('#trx'); if (x) x.onclick = () => { lsSet(TRIPX_LS, 1); t.innerHTML = ''; }; };
    if (!isFree()) paintTrip();
    if (!homePulled) { homePulled = true; skillsPull().then(() => { const z = $('#rz'); if (z && (location.hash === '' || location.hash === '#')) { z.innerHTML = rzHtml(); bindGoal(); paintTrip(); } }).catch(() => {}); }
    if (!isFree()) renderWorkbooks();
    prefetchSets();
  }
  // ⚡ تحميل مسبق هادئ لملفات الأقسام في الخلفية (مرة واحدة لكل جلسة) حتى تفتح فوراً
  let prefetching = false;
  function prefetchSets() {
    if (prefetching || !manifest) return; const c = navigator.connection || {}; if (c.saveData) return; prefetching = true;
    const ids = isFree() ? ['q1', 'v1'] : [...manifest.quant, ...manifest.verbal].map(s => s.id);
    const run = () => { const id = ids.shift(); if (!id) return; fetch('/p/data/' + (isFree() ? 'free/' : '') + id + '.bin?v=' + DATA_V, { priority: 'low' }).catch(() => {}).finally(() => setTimeout(run, 400)); };
    setTimeout(run, 2500);
  }
  async function renderWorkbooks() {
    const el = $('#wb'); if (!el) return;
    if (!auth.files || !auth.phone) { try { const r = await api({ op: 'files', session: auth.session }); if (r.ok) { auth.files = r.files; auth.phone = r.phone || auth.phone || ''; auth.member = r.member || ''; lsSet(LS.auth, auth); } } catch (e) {} }
    if (auth.member === 'manual') { ['#wbh', '#wb'].forEach(k => { const x = $(k); if (x) x.remove(); }); return; }   // المذكرة الشخصية تنعمل من الشيت برقم الجوال
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
    if (auth.member === 'manual') { toast('المذكرة الشخصية غير متاحة لحسابك'); location.hash = ''; return; }
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
      ${ytFor(id) ? `<a class="ytb" href="${ytFor(id).url}" target="_blank" rel="noopener"${ytTip(ytFor(id), 'شرح ' + ytFor(id).label + ' على يوتيوب')}>${YTSVG}<span>الشرح</span></a>` : ''}<span class="chip run" id="run" hidden></span><button class="chip cnt" id="navb" title="كل الأسئلة: اضغط وانتقل لأي سؤال" aria-label="كل الأسئلة" aria-haspopup="dialog">${GRIDSVG}<span id="cnt" dir="ltr"></span></button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
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
    $('#pm').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.QGAI) QGAI.fill($('#pm'));
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
    // الشرح المكتوب انشال: الشرح صار من المساعد الذكي بس (زر «اشرح لي أكثر»)
    return `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="h">${ok ? OKS[(it.n || 0) % OKS.length] : '❌ إجابة خاطئة'}</div>
      ${ok ? '' : `<div class="ans">الإجابة الصحيحة: <b>${LETTERS[it.ans]}) ${esc(corr.replace(/^[A-D]\)\s*/, ''))}</b></div>`}
      ${aiSlot(it, a)}
      ${ok ? '' : ytLink(it)}
      ${P && P.set.kind === 'verbal' ? trHtml(it, ok) : ''}</div>`;
  }
  // 🤖 «اشرح لي أكثر»: مرجع السؤال في بنك المساعد = القسم/النموذج الأصلي + ترتيبه فيه
  function aiSlot(it, a) {
    if (!window.QGAI || !P || !a) return ''; const src = it.src || P.id, idx = it.sidx != null ? it.sidx : P.cur;
    if (!/^[qv]\d{1,2}$/.test(src)) return '';
    const wrong = a.s !== it.ans;
    return QGAI.slot({ ref: src + ':' + idx, pick: a.s, wrong, label: `سؤال ${P.cur + 1} · الإجابة الصحيحة ${LETTERS[it.ans]}${wrong ? ` · إجابتك ${LETTERS[a.s]} ✗` : ''}` });
  }
  function ytLink(it) {
    const yt = ytFor(it.src || (P && P.id)); if (!yt) return '';
    return `<a class="ytx" href="${yt.url}" target="_blank" rel="noopener"${ytTip(yt)}>${YTSVG}<span>ما وضح لك؟ شاهد شرح ${yt.label} بالفيديو على يوتيوب</span><span class="go">←</span></a>`;
  }
  // 🇸🇦 ترجمة أسئلة الكمي: تظهر قبل الإجابة (الترجمة ما تكشف الحل) ونتذكّر إذا الطالب يفضّلها مفتوحة
  const QTR_LS = 'qg_qtr', QNAMES = new Set(['ahmed', 'khalid', 'khaled', 'mohamed', 'mohammed', 'muhammad', 'sara', 'sarah', 'nora', 'ali', 'saad']);   // أسماء الأشخاص ما تحتاج ترجمة
  // نعزل التعابير الرياضية (x + 3 = 7، m∠ABC…) داخل النص العربي حتى ما يتلخبط ترتيبها
  const MRUN = /[A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*[A-Za-z0-9√π∠△∥][A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*/g;
  function arMath(s, fx, re, sp) {
    fx = fx || esc; s = String(s || ''); let out = '', last = 0;
    const seg = (t, a) => {
      let lead = t.match(/^[\s.,:]*/)[0].length, trail = t.match(/[\s.,:]*$/)[0].length;
      let core = t.slice(lead, t.length - trail);
      // قوس مفتوح في آخر المعادلة أو مقفول في أولها (مثل «2, 3, 12, 13 (المجموع 4)») يطلع برّا المقطع الإنجليزي، وإلا ينقلب ترتيب السطر
      const bal = c => (c.match(/\(/g) || []).length - (c.match(/\)/g) || []).length;
      while (bal(core) > 0 && /[\s(]$/.test(core)) { core = core.slice(0, -1); trail++; }
      while (bal(core) < 0 && /^[\s)]/.test(core)) { core = core.slice(1); lead++; }
      { const tw = core.length - core.trimEnd().length, lw = core.length - core.trimStart().length; core = core.trim(); trail += tw; lead += lw; }
      while (core.endsWith(')') && (core.match(/\(/g) || []).length < (core.match(/\)/g) || []).length) { core = core.slice(0, -1); trail++; }
      while (core.startsWith('(') && (core.match(/\(/g) || []).length > (core.match(/\)/g) || []).length) { core = core.slice(1); lead++; }
      if (!/[A-Za-z0-9√π∠△∥\u0391-\u03C9½⅓⅔¼¾]/.test(core)) return;
      out += esc(s.slice(last, a + lead)) + `<bdi dir="ltr">${fx(core)}</bdi>`; last = a + t.length - trail;
    };
    for (const m of s.matchAll(re || MRUN)) {
      let t = m[0], a = m.index, k;
      // «المقام المشترك 15: 1/3 + …» → نفصل «15» عن المعادلة حتى تنقرأ بالترتيب (النسبة 3 : 4 والوقت 3:40 تبقى كما هي)
      if (sp) while ((k = t.search(/[^\s]:\s/)) >= 0) { seg(t.slice(0, k + 2), a); a += k + 2; t = t.slice(k + 2); }
      seg(t, a);
    }
    return out + esc(s.slice(last));
  }
  // ➗ كسور حقيقية بدل السلاش: 3/4 ، (x + 1)/2 ، 2 3/4 ، ½ ، 8^(2/3) → بسط فوق خط ومقام تحته (km/h و m/s تبقى وحدات)
  const FR_VUL = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  const FR_AT = /[A-Za-z0-9²³¹⁰-₟Α-ω°%!′″∞']/, FR_SUP = /[²³¹⁰-ⁿ^!]/, FR_RAD = '√∛∜';
  const frac = (n, d) => `<span class="fr"><span class="fn">${n}</span><span class="fd">${d}</span></span>`;
  function mx(src) {
    const s = String(src == null ? '' : src), n = s.length; let i = 0;
    const atomCh = () => { const c = s[i]; if (c === undefined) return false;
      if (c === '.') return /\d/.test(s[i + 1] || '') && (i === 0 || /[\d\s(−+×÷=]/.test(s[i - 1]));
      if (c === ',') return /\d/.test(s[i - 1] || '') && /^\d{3}(?!\d)/.test(s.slice(i + 1, i + 5));
      if (c === "'") return /[A-Za-z]/.test(s[i - 1] || '') && /[A-Za-z]/.test(s[i + 1] || '');
      return FR_AT.test(c); };
    const startsOpd = () => s[i] === '(' || FR_RAD.includes(s[i]) || atomCh();
    const group = () => { i++; const r = seq(')'); if (s[i] === ')') { i++; return r; } return { h: r.h, single: false, open: true }; };
    const sup = () => { i++; if (s[i] === '(') return `<sup class="ex">${group().h}</sup>`;
      const st = i; if (s[i] === '−' || s[i] === '-') i++; while (i < n && atomCh()) i++; return `<sup class="ex">${esc(s.slice(st, i))}</sup>`; };
    function opd() {   // معامل متلاصق بدون مسافات: 2ab ، n(n + 1) ، √3 ، (√3/4)s²
      const st = i; let h = '', parts = 0, solo = null;
      while (i < n) {
        const c = s[i];
        if (FR_RAD.includes(c)) { h += esc(c); i++; parts++; solo = false; continue; }
        if (c === '(') {
          const prev = s[i - 1] || '', g = group(), next = s[i] || '';
          const keep = g.open || !g.single || (parts && (FR_RAD.includes(prev) || FR_AT.test(prev))) || FR_SUP.test(next);
          h += !keep ? g.h : g.open ? '(' + g.h : /class="fr"/.test(g.h) ? `<span class="mpb">(</span>${g.h}<span class="mpb">)</span>` : `(${g.h})`;
          solo = parts === 0 && !g.open ? g : false; parts++; continue;
        }
        if (c === '^' && parts && /[(A-Za-z0-9−-]/.test(s[i + 1] || '')) { h += sup(); solo = false; continue; }
        if (atomCh()) { const a = i; while (i < n && atomCh()) i++; h += esc(s.slice(a, i)); parts++; solo = false; continue; }
        break;
      }
      return { h, raw: s.slice(st, i), solo };
    }
    const isUnit = (a, b) => (/^(km|m|cm|mm|mi)$/.test(a) && /^(h|hr|hrs|s|sec|min)$/.test(b)) || /^(and|he|his)$/i.test(a);
    const digits = x => /^\d+$/.test(x);
    function seq(end) {
      const out = [];
      while (i < n && s[i] !== end) {
        const c = s[i];
        if (/\s/.test(c)) { const a = i; while (i < n && /\s/.test(s[i])) i++; out.push({ k: 'sp', h: esc(s.slice(a, i)), raw: s.slice(a, i) }); continue; }
        if (FR_VUL[c]) { const [a, b] = FR_VUL[c].split('/'), f = frac(a, b), p = out[out.length - 1]; i++;
          if (p && p.k === 'o' && digits(p.raw)) { out.pop(); out.push({ k: 'mix', h: `<span class="mxn">${p.h}${f}</span>` }); } else out.push({ k: 'fr', h: f }); continue; }
        if (startsOpd()) {
          const L = opd(); let j = i; while (j < n && s[j] === ' ') j++;
          if (s[j] === '/' && L.raw) {
            let k = j + 1; while (k < n && s[k] === ' ') k++;
            const save = i; i = k;
            if (startsOpd()) {
              const R = opd();
              if (isUnit(L.raw, R.raw)) { out.push({ k: 'o', h: L.h + esc(s.slice(save, k)) + R.h, raw: L.raw + '/' + R.raw }); continue; }
              const f = frac(L.solo ? L.solo.h : L.h, R.solo ? R.solo.h : R.h), p = out[out.length - 1], q = out[out.length - 2];
              if (digits(L.raw) && digits(R.raw) && p && p.raw === ' ' && q && q.k === 'o' && digits(q.raw)) { out.pop(); out.pop(); out.push({ k: 'mix', h: `<span class="mxn">${q.h}${f}</span>` }); }
              else out.push({ k: 'fr', h: f });
              continue;
            }
            i = save;
          }
          if (L.raw) out.push({ k: 'o', h: L.h, raw: L.raw }); else { out.push({ k: 'ch', h: esc(s[i]) }); i++; }
          continue;
        }
        out.push({ k: 'ch', h: esc(c), raw: c }); i++;
      }
      const core = out.filter(x => x.k !== 'sp');
      return { h: out.map(x => x.h).join(''), single: core.length === 1 && core[0].k === 'fr' };
    }
    let h = '';
    while (i < n) { h += seq(null).h; if (i < n) { h += esc(s[i]); i++; } }
    return h;
  }
  // نص عربي فيه تعابير رياضية: نعزلها LTR ونرسم كسورها
  const MRUN_FX = /[A-Za-z0-9²³¹⁰-₟Α-ω½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞√∛∜π∞∠△°%+\-−–×÷±∓=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄…→⇒!\[\]{} ]*[A-Za-z0-9Α-ω½⅓⅔¼¾√π∠△∥][A-Za-z0-9²³¹⁰-₟Α-ω½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞√∛∜π∞∠△°%+\-−–×÷±∓=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄…→⇒!\[\]{} ]*/g;
  const arFx = s => arMath(s, mx, MRUN_FX, 1);
  function qtrHtml(it) {
    const ar = it.ar; if (!ar || !ar.q) return ''; const w = (it.wd || []).filter(x => !QNAMES.has(x[0]));
    const ot = (ar.o || []).some(Boolean) ? `<ol class="qt-o">${it.opts.map((o, k) => ar.o[k] ? `<li><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o.replace(/^[A-D]\)\s*/, ''))}</span><span class="arr">${arMath(ar.o[k])}</span></li>` : '').join('')}</ol>` : '';
    return `<details class="qtr" id="qtr" ${lsGet(QTR_LS, 0) ? 'open' : ''}><summary><span class="qt-f" aria-hidden="true">🇸🇦</span>ترجمة السؤال <small>ومعاني الكلمات</small></summary><div class="qt-b"><p class="qt-ar">${arMath(ar.q)}</p><div class="says">${it.en ? sayBtn(it.en, 'en', 'اسمع السؤال بالإنجليزي') : ''}${hasAr() ? sayBtn(ar.q, 'ar', 'اسمع الترجمة') : ''}</div>${ot}${w.length ? `<div class="vcs">${w.map(x => vcChip(x[0], x[1])).join('')}</div>` : ''}</div></details>`;
  }
  // 🇸🇦 ترجمة السؤال والخيارات + كلمات السؤال
  function trHtml(it, shut) {   // shut: مقفولة (بعد الإجابة الصحيحة) — الطالب يفتحها لو احتاجها
    const ar = it.ar, op = shut ? '' : ' open'; let h = '';
    if (ar && ar.q) h += `<details class="tr"${op}><summary>🇸🇦 ترجمة السؤال</summary><div class="trq">${esc(ar.q)}</div><div class="says">${sayBtn(it.q, 'en', 'اسمع السؤال')}${hasAr() ? sayBtn(ar.q, 'ar', 'اسمع الترجمة') : ''}</div><ol class="tro">${it.opts.map((o, k) => `<li class="${k === it.ans ? 'ok' : ''}"><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o)} ${sayBtn(o, 'en', '', 'sm')}</span><span class="arr">${esc((ar.o || [])[k] || '')}</span></li>`).join('')}</ol></details>`;
    const chips = vocabChips(it.q + ' ' + it.opts.join(' '), 40);
    if (chips) h += `<details class="tr vocab"${op}><summary>📖 كلمات السؤال <small>(اضغط على أي كلمة في السؤال لترجمتها)</small></summary><div class="vcs">${chips}</div></details>`;
    return h;
  }
  function answer(i, k) {
    const { it } = P.items[i]; if (P.prog.a[i]) return;
    const nowT = Date.now(); const ms = Math.min(Math.max(0, nowT - (P.lastAct || nowT)), Q_CAP); P.lastAct = nowT;
    P.prog.a[i] = { s: k, c: k === it.ans ? 1 : 0, t: nowT, ms }; progSet(P.id, P.prog);
    const good = k === it.ans; if (isFree() && window.QGT) QGT.ans(P.id, good); const sbi = $('#sb') && $('#sb').children[i]; if (sbi) sbi.className = (good ? 'ok' : 'bad') + ' cur';
    const gbi = $('#spg') && $('#spg').children[i]; if (gbi) { gbi.className = (good ? 'ok' : 'bad') + ' cur'; gbi.setAttribute('aria-label', `سؤال ${i + 1}، إجابتك ${good ? 'صحيحة' : 'خاطئة'}`); }
    P.run = good ? (P.run || 0) + 1 : 0; const rc = $('#run'); if (rc) { if (P.run >= 3) { rc.hidden = false; rc.textContent = '🔥 ' + P.run + ' صح ورا بعض'; rc.classList.remove('bump'); void rc.offsetWidth; rc.classList.add('bump'); } else rc.hidden = true; }
    const today = daysAdd(), goal = goalGet(); if (today === goal) setTimeout(() => toast('🎉 حققت هدف اليوم: ' + goal + ' سؤال!'), 700); else badgeCheckSoon();
    try { const h = histGet(); histMark(h, it.src || P.id, it.sidx != null ? it.sidx : i, k === it.ans, itemTopics(it)); histSet(h); skillsPushSoon(); } catch (e) {}
    document.querySelectorAll('.opt').forEach(b => { b.disabled = true; b.classList.remove('sel'); const kk = +b.dataset.k; if (kk === it.ans) b.classList.add('ok'); else if (kk === k) b.classList.add('bad'); });
    if (!RM()) { const btn = document.querySelector(`.opt[data-k="${k}"]`); if (btn) { if (good) burst(btn.querySelector('.L') || btn); else btn.classList.add('shake'); } }
    $('#fb').innerHTML = feedback(it, P.prog.a[i]); if (window.QGAI) QGAI.fill($('#fb'));
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
      <div class="acts sacts">${nx ? (isFree() && FREE_SETS.indexOf(nx) < 0 ? `<button class="btn gold" data-lock="${SET_NAME(nx)}">التالي: ${SET_NAME(nx)} 🔒</button>` : `<a class="btn gold" href="#${nx}">التالي: ${SET_NAME(nx)}</a>`) : ''}${wrong.length ? `<button class="btn" id="rev">مراجعة الأخطاء (${wrong.length})</button>` : ''}${!nx && !wrong.length ? `<a class="btn gold" href="#">الرئيسية</a>` : ''}</div>
      <div class="slinks"><button class="lnk2" id="again">↻ إعادة ${nm ? (nm[1] === 'q' ? 'القسم' : 'النموذج') : 'الاختبار'}</button>${nm && !isFree() ? `<a class="lnk2" href="#board-set-${set.id}">🏆 ترتيبك في ${SET_NAME(set.id)}</a>` : ''}${ytFor(set.id) ? `<a class="lnk2" href="${ytFor(set.id).url}" target="_blank" rel="noopener"${ytTip(ytFor(set.id))}>${YTSVG} شرح ${ytFor(set.id).label} بالفيديو</a>` : ''}<a class="lnk2" href="#skills">🎯 نقاط قوتك وضعفك</a></div>
      ${wrong.length ? `<div class="wl"><h3>الأسئلة الخاطئة — اضغط على الرقم لمراجعة الشرح:</h3><div class="ng">${wrong.map(i => `<button class="bad" data-i="${i}">${i + 1}</button>`).join('')}</div></div>` : ''}
      <p id="saved" class="kbd" style="margin-top:14px"></p></div>`;
    $('#again').onclick = () => { const best = prog.best; progSet(P.id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(P.id); };
    bindSub($('#pm'));
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
      $('#saved').textContent = r.ok ? (r.admin ? 'وضع المشرف: النتيجة لا تُسجّل' : r.free ? 'نتيجتك محفوظة على جهازك ✓' : 'تم حفظ نتيجتك ✓') : '';
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
  // ---------- 🔎 ابحث عن سؤال: الطالب يكتب السؤال أو يصوّره ونقول له وين يلقاه في الدورة ----------
  // 🔎 محرك البحث عن سؤال (نفس الكود ينحط في app.js): TF-IDF + تطابق الأرقام، بالإنجليزي أو العربي
  const FD_STOP = new Set('the of a an is are to in on and or if find what which following value then that its it be by for with from as at this these those than how many much will was were has have had does do not shape figure above below given evaluate calculate determine choose word option options answer question best correct each one'.split(' '));
  const FD_STOP_AR = new Set('من في على الى عن مع ثم او هو هي ما ماذا كم اي اذا التي الذي الذين هذا هذه ذلك تلك كان كانت قيمه اوجد احسب العدد عدد فان لكل كل بين عند'.split(' '));
  function fdNorm(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/[−–—]/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
      .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  }
  const FD_SYN = { chance: 'probability', likelihood: 'probability', withdrawn: 'draw', drawn: 'draw', picked: 'draw', chosen: 'draw', selected: 'draw', select: 'draw', pick: 'draw', choose: 'draw', percentage: 'percent', mean: 'average', avg: 'average', total: 'sum', kilometer: 'km', kilometre: 'km', hr: 'hour', hrs: 'hour', min: 'minute', sec: 'second', marble: 'ball', equivalent: 'equal', equation: 'equation' };
  function fdToks(s) {
    const t = fdNorm(s), en = [], ar = [], nu = [];
    for (const m of t.matchAll(/[a-z]{2,}|\d+(?:\.\d+)?|[ء-ي]{2,}/g)) {
      const w = m[0];
      if (/^\d/.test(w)) nu.push(w.replace(/\.0+$/, ''));
      else if (/^[a-z]/.test(w)) { if (!FD_STOP.has(w)) { const st = w.length < 5 || /ss$/.test(w) ? w : /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(sh|ch|x|z)es$/.test(w) ? w.slice(0, -2) : w.replace(/s$/, ''); en.push(FD_SYN[st] || FD_SYN[w] || st); } }
      else { let a = w.replace(/^(و|ف|ب|ل|ك)?ال/, ''); if (a.length >= 2 && !FD_STOP_AR.has(w) && !FD_STOP_AR.has(a)) ar.push(a); }
    }
    for (const m of t.matchAll(/(?:^|[^a-z])([a-z])(?=[^a-z]|$)/g)) en.push('_' + m[1]);   // متغيّرات حرف واحد (x، m) بوزن قليل عبر IDF
    return { en, ar, nu };
  }
  const fdSh = s => { const w = fdNorm(s).match(/[a-z0-9\u0621-\u064A]+/g) || [], g = new Set(); for (let i = 0; i + 3 <= w.length; i++) g.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]); return g; };   // كل 3 كلمات متتالية
  const fdTri = s => { const t = ' ' + fdNorm(s).replace(/\s+/g, ' ').replace(/[^a-z0-9\u0621-\u064A+\-*/=<>√∠∥%.: ]/g, '') + ' ', g = new Set(); for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3)); return g; };
  function fdBuild(entries) {   // entries: [kind, set, idx, text, opts, arabic, group, tests]
    const docs = entries.map(e => { const a = fdToks(e[3] + ' ' + e[4].join(' ')), b = fdToks(e[5]); return { en: a.en, ar: b.ar, nu: a.nu.concat(b.nu.length && !a.nu.length ? b.nu : []) }; });
    const df = new Map(), N = docs.length; docs.forEach(d => new Set(d.en.concat(d.ar)).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    const idf = w => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
    const vec = tl => { const c = new Map(); tl.forEach(w => c.set(w, (c.get(w) || 0) + 1)); const v = new Map(); let z = 0; c.forEach((n, w) => { const x = (1 + Math.log(n)) * idf(w); v.set(w, x); z += x * x; }); z = Math.sqrt(z) || 1; v.forEach((x, w) => v.set(w, x / z)); return v; };
    const cnt = a => { const c = new Map(); a.forEach(x => c.set(x, (c.get(x) || 0) + 1)); return c; };
    // بحث بالكلمات (BM25) للكلام البسيط: كل كلمة لها وزن حسب ندرتها، والسؤال اللي فيه كل الكلمات يتقدّم
    const kdf = new Map(); let tot = 0;
    const K = entries.map(e => {   // نص السؤال وعنوان القطعة أهم من الخيارات
      const tf = new Map(), add = (str, wt) => { const t = fdToks(str); t.en.filter(w => w[0] !== '_').concat(t.ar, t.nu).forEach(w => tf.set(w, (tf.get(w) || 0) + wt)); };
      add(e[3], 2); add(e[4].join(' '), 1); add(e[5], 1); if (e[6]) add(e[6], 3);
      let len = 0; tf.forEach((n, w) => { kdf.set(w, (kdf.get(w) || 0) + 1); len += n; }); tot += len; return { tf, len };
    });
    const kidf = w => Math.log(1 + (N - (kdf.get(w) || 0) + 0.5) / ((kdf.get(w) || 0) + 0.5));
    return { entries, idf, vec, cnt, kidf, K, avg: tot / (N || 1), D: docs.map((d, i) => ({ en: vec(d.en), ar: vec(d.ar), nu: cnt(d.nu), nn: d.nu.length, tg: fdTri(entries[i][3] + ' ' + entries[i][4].join(' ')), sh: fdSh(entries[i][3] + ' ' + entries[i][4].join(' ')) })) };
  }
  function fdSearch(ix, text, kind, k) {
    const q = fdToks(text), qe = ix.vec(q.en), qa = ix.vec(q.ar), qn = ix.cnt(q.nu), qt = fdTri(text), qs = fdSh(text);
    const qu = [...new Set(q.en.filter(w => w[0] !== '_'))], qw = qu.reduce((a, w) => a + ix.idf(w), 0);   // وزن كلمات الطالب النادرة
    const cos = (a, b) => { let s = 0; if (a.size > b.size) [a, b] = [b, a]; a.forEach((x, w) => { const y = b.get(w); if (y) s += x * y; }); return s; };
    const jac = (a, b) => { let i = 0, u = 0; const ks = new Set([...a.keys(), ...b.keys()]); ks.forEach(w => { const x = a.get(w) || 0, y = b.get(w) || 0; i += Math.min(x, y); u += Math.max(x, y); }); return u ? i / u : 0; };
    const out = [];
    ix.entries.forEach((e, i) => {
      if (kind && (kind === 'q' ? e[0] !== 'q' : e[0] === 'q')) return;
      const d = ix.D[i]; let c = Math.max(q.en.length ? cos(qe, d.en) : 0, q.ar.length ? cos(qa, d.ar) : 0);
      if (kind === 'v' && qw >= 9 && qu.length <= 6 && qu.some(w => ix.idf(w) >= 6)) { let hw = 0; qu.forEach(w => { if (d.en.has(w)) hw += ix.idf(w); }); c = Math.max(c, 0.92 * hw / qw); }   // سؤال قصير (مثل CAR : POLLUTION) كل كلماته موجودة
      const nj = q.nu.length && d.nn ? jac(qn, d.nu) : 0;
      let inter = 0; if (qt.size && d.tg.size) qt.forEach(g => { if (d.tg.has(g)) inter++; });
      let hit = 0; if (qs.size >= 6) qs.forEach(g => { if (d.sh.has(g)) hit++; });
      const cov = qs.size >= 6 ? hit / qs.size : 0;   // كم من جمل الطالب موجودة حرفياً (لو نسخ السؤال بدون خيارات أو جزء من قطعة)
      const tri = Math.max(qt.size && d.tg.size ? 2 * inter / (qt.size + d.tg.size) : 0, 0.9 * cov);   // تشابه حرفي — يفرّق بين الأسئلة المتشابهة جداً
      let sc = c + 0.5 * nj + 0.5 * tri; if (e[0] === 'p') sc = Math.max(sc, 1.7 * cov);   // القطعة طويلة: يكفي إن الجزء المنسوخ موجود فيها
      out.push({ i, s: sc, c, nj, tri });
    });
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, k || 5);
  }
  function fdKeyword(ix, text, kind, k) {   // أسئلة فيها كلام الطالب (لو كتب كلمات بسيطة)
    const q = fdToks(text), terms = [...new Set(q.en.filter(w => w[0] !== '_').concat(q.ar, q.nu))];
    if (!terms.length) return [];
    const need = terms.length <= 3 ? 1 : Math.ceil(terms.length * 0.5), out = [];
    ix.entries.forEach((e, i) => {
      if (kind && (kind === 'q' ? e[0] !== 'q' : e[0] === 'q')) return;
      const D = ix.K[i]; let sc = 0, m = 0;
      terms.forEach(w => { const f = D.tf.get(w); if (!f) return; m++; sc += ix.kidf(w) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * D.len / ix.avg)); });
      if (m < need) return;
      out.push({ i, s: sc * Math.pow(m / terms.length, 2), m });
    });
    out.sort((a, b) => b.s - a.s || ix.K[a.i].len - ix.K[b.i].len);
    return out.slice(0, k || 30);
  }
  // ---------- 🆓 بحث الزوار: الفهرس فيه بصمات الكلمات (hash) بدل نص الأسئلة ----------
  // كل مدخل: [النوع، القسم، رقم السؤال، الاختبارات، كلمات السؤال، كلمات الخيارات، كلمات الترجمة، أرقام السؤال، أرقام الخيارات، أرقام الترجمة، عنوان القطعة، أزواج الكلمات]
  // أزواج الكلمات المتتالية مبصومة بملح خاص بكل سؤال (رقمه) → تحافظ على دقة البحث بدون ما تكشف النص
  const fdFnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const fdH = w => (w[0] === '_' ? '_' : '') + fdFnv(w).toString(36);
  const fdH2 = (salt, g) => (fdFnv(salt + g) >>> 8).toString(36);
  const fdWords = s => fdNorm(s).match(/[a-z0-9ء-ي]+/g) || [];
  const fdPairs = s => { const w = fdWords(s), o = []; for (let i = 0; i + 2 <= w.length; i++) o.push(w[i] + ' ' + w[i + 1]); return [...new Set(o)]; };
  function fdPubEntry(e, i) {   // من مدخل الفهرس الكامل (للبناء فقط)
    const q = fdToks(e[3]), o = fdToks(e[4].join(' ')), a = fdToks(e[5]), g = e[6] ? fdToks(e[6]) : { en: [], ar: [], nu: [] }, salt = i.toString(36) + '|';
    return [e[0], e[1], e[2], e[7], q.en.map(fdH), o.en.map(fdH), a.ar.map(fdH), q.nu.map(fdH), o.nu.map(fdH), a.nu.map(fdH),
      g.en.filter(w => w[0] !== '_').concat(g.ar, g.nu).map(fdH), [...new Set(fdPairs(e[3] + ' ' + e[4].join(' ')).map(x => fdH2(salt, x)))]];
  }
  function fdPubBuild(P) {
    const N = P.length, df = new Map();
    const docs = P.map(p => { const nu = p[7].concat(p[8]); return { en: p[4].concat(p[5]), ar: p[6], nu: nu.length ? nu : p[9] }; });
    docs.forEach(d => new Set(d.en.concat(d.ar)).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
    const idf = w => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
    const vec = tl => { const c = new Map(); tl.forEach(w => c.set(w, (c.get(w) || 0) + 1)); const v = new Map(); let z = 0; c.forEach((n, w) => { const x = (1 + Math.log(n)) * idf(w); v.set(w, x); z += x * x; }); z = Math.sqrt(z) || 1; v.forEach((x, w) => v.set(w, x / z)); return v; };
    const cnt = a => { const c = new Map(); a.forEach(x => c.set(x, (c.get(x) || 0) + 1)); return c; };
    const kdf = new Map(); let tot = 0;
    const K = P.map(p => {   // نفس أوزان البحث بالكلمات: نص السؤال 2، الخيارات 1، الترجمة 1، عنوان القطعة 3
      const tf = new Map(), add = (l, wt) => l.forEach(w => { if (w[0] !== '_') tf.set(w, (tf.get(w) || 0) + wt); });
      add(p[4], 2); add(p[7], 2); add(p[5], 1); add(p[8], 1); add(p[6], 1); add(p[9], 1); add(p[10], 3);
      let len = 0; tf.forEach((n, w) => { kdf.set(w, (kdf.get(w) || 0) + 1); len += n; }); tot += len; return { tf, len };
    });
    const kidf = w => Math.log(1 + (N - (kdf.get(w) || 0) + 0.5) / ((kdf.get(w) || 0) + 0.5));
    return { P, idf, vec, cnt, kidf, K, avg: tot / (N || 1), D: docs.map((d, i) => ({ en: vec(d.en), ar: vec(d.ar), nu: cnt(d.nu), nn: d.nu.length, bg: new Set(P[i][11]) })) };
  }
  function fdPubSearch(ix, text, kind, k) {
    const t = fdToks(text), q = { en: t.en.map(fdH), ar: t.ar.map(fdH), nu: t.nu.map(fdH) };
    const qe = ix.vec(q.en), qa = ix.vec(q.ar), qn = ix.cnt(q.nu), qp = fdPairs(text);
    const qu = [...new Set(q.en.filter(w => w[0] !== '_'))], qw = qu.reduce((a, w) => a + ix.idf(w), 0);
    const cos = (a, b) => { let s = 0; if (a.size > b.size) [a, b] = [b, a]; a.forEach((x, w) => { const y = b.get(w); if (y) s += x * y; }); return s; };
    const jac = (a, b) => { let i = 0, u = 0; const ks = new Set([...a.keys(), ...b.keys()]); ks.forEach(w => { const x = a.get(w) || 0, y = b.get(w) || 0; i += Math.min(x, y); u += Math.max(x, y); }); return u ? i / u : 0; };
    const out = [];
    ix.P.forEach((p, i) => {
      if (kind && (kind === 'q' ? p[0] !== 'q' : p[0] === 'q')) return;
      const d = ix.D[i]; let c = Math.max(q.en.length ? cos(qe, d.en) : 0, q.ar.length ? cos(qa, d.ar) : 0);
      if (kind === 'v' && qw >= 9 && qu.length <= 6 && qu.some(w => ix.idf(w) >= 6)) { let hw = 0; qu.forEach(w => { if (d.en.has(w)) hw += ix.idf(w); }); c = Math.max(c, 0.92 * hw / qw); }
      out.push({ i, c, nj: q.nu.length && d.nn ? jac(qn, d.nu) : 0 });
    });
    out.forEach(r => r.s = r.c + 0.5 * r.nj);
    out.sort((a, b) => b.s - a.s);
    const top = out.slice(0, 300);   // أزواج الكلمات تنحسب لأقرب 300 فقط (أسرع)
    top.forEach(r => {
      const B = ix.D[r.i].bg, salt = r.i.toString(36) + '|'; let inter = 0; qp.forEach(g => { if (B.has(fdH2(salt, g))) inter++; });
      const dice = qp.length && B.size ? 2 * inter / (qp.length + B.size) : 0, cov = qp.length >= 6 ? inter / qp.length : 0;
      r.s = r.c + 0.5 * r.nj + 0.5 * Math.max(dice, 0.9 * cov); if (ix.P[r.i][0] === 'p') r.s = Math.max(r.s, 1.7 * cov);
    });
    top.sort((a, b) => b.s - a.s);
    return top.slice(0, k || 5);
  }
  function fdPubKeyword(ix, text, kind, k) {
    const q = fdToks(text), terms = [...new Set(q.en.filter(w => w[0] !== '_').concat(q.ar, q.nu).map(fdH))];
    if (!terms.length) return [];
    const need = terms.length <= 3 ? 1 : Math.ceil(terms.length * 0.5), out = [];
    ix.P.forEach((p, i) => {
      if (kind && (kind === 'q' ? p[0] !== 'q' : p[0] === 'q')) return;
      const D = ix.K[i]; let sc = 0, m = 0;
      terms.forEach(w => { const f = D.tf.get(w); if (!f) return; m++; sc += ix.kidf(w) * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * D.len / ix.avg)); });
      if (m < need) return;
      out.push({ i, s: sc * Math.pow(m / terms.length, 2), m });
    });
    out.sort((a, b) => b.s - a.s || ix.K[a.i].len - ix.K[b.i].len);
    return out.slice(0, k || 30);
  }
  const FIND_V = 1, FD_HI = 1.12, FD_MID = 0.85, FDP_HI = 1.0, FDP_MID = 0.75, WA_NUM = '966508003683';   // FDP: حدود بحث الزوار (معايرة على نفس الأسئلة)
  let FD = null, fdOcr = null;
  async function fdLoad() {
    if (FD) return FD;
    const gz = typeof DecompressionStream === 'function';   // المتصفحات القديمة تاخذ نسخة بدون ضغط
    const r = await fetch('/p/data/' + (gz ? 'find' : 'find0') + '.bin?v=' + FIND_V); if (!r.ok) throw new Error('data ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer()), key = await getKey();
    let plain; try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)); } catch (e) { logout(); throw new Error('bad key'); }
    const txt = gz ? await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(plain);
    FD = fdBuild(JSON.parse(txt).e); return FD;
  }
  // 📷 قراءة الصورة داخل المتصفح (Tesseract) — الصورة ما تطلع من جهاز الطالب
  const fdCanOcr = () => typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && typeof DecompressionStream === 'function';
  function fdOcrRun(buf) {
    if (!fdOcr) { const w = new Worker('/p/ocr/ocr-worker.js?v=1'); fdOcr = { w, n: 0, wait: {} }; w.onmessage = e => { const c = fdOcr.wait[e.data.id]; if (!c) return; delete fdOcr.wait[e.data.id]; e.data.error ? c[1](new Error(e.data.error)) : c[0](e.data.text); }; w.onerror = () => { Object.values(fdOcr.wait).forEach(c => c[1](new Error('ocr'))); fdOcr = null; }; }
    return new Promise((res, rej) => { const id = ++fdOcr.n; fdOcr.wait[id] = [res, rej]; fdOcr.w.postMessage({ id, buf, model: 'eng-fast' }, [buf]); });
  }
  async function fdPrep(file) {   // نوحّد المقاس (عرض 1000–2000) ونخليها PNG بخلفية بيضاء
    const bmp = await createImageBitmap(file); const w = bmp.width, h = bmp.height, sc = w < 1000 ? 1000 / w : w > 2000 ? 2000 / w : 1;
    const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); return blob.arrayBuffer();
  }
  const fdLoc = e => {   // مواقع السؤال: القسم/النموذج + الاختبارات المحاكية
    const L = [];
    if (e[1]) L.push(e[0] === 'p' ? `القطعة في ${SET_NAME(e[1])}${e[6] ? ' · ' + esc(e[6]) : ''}` : `${e[0] === 'q' ? 'الكمي' : 'اللفظي'} · ${SET_NAME(e[1])} · سؤال ${e[2] + 1}${e[6] ? ' · قطعة ' + `<bdi dir="ltr">${esc(e[6])}</bdi>` : ''}`);
    e[7].slice(0, 3).forEach(t => L.push(`الاختبار المحاكي ${t[0]} · القسم ${t[1]} · سؤال ${t[2]}`));
    if (e[7].length > 3) L.push(`+ ${e[7].length - 3} اختبارات محاكية ثانية`);
    return L.map((t, i) => `<span class="fd-loc${i ? '' : ' main'}">${t}</span>`).join('');
  };
  function fdPreview(e) {
    if (e[0] === 'p') return `<div class="fd-pv ltr"><p class="fd-pt">${esc(e[3].slice(0, 420))}${e[3].length > 420 ? '…' : ''}</p></div>`;
    const opts = e[4].length ? `<ol class="fd-o">${e[4].map((o, j) => `<li><span class="L">${LETTERS[j]}</span><span>${e[0] === 'q' ? mx(o) : esc(o)}</span></li>`).join('')}</ol>` : '';
    return `<div class="fd-pv ltr" data-img="${e[0] === 'q' && e[1] ? e[1] + ':' + e[2] : ''}"><p>${e[0] === 'q' ? mx(e[3]) : esc(e[3])}</p>${opts}</div>`;
  }
  const fdOpen = e => e[1] ? `<a class="btn" href="#${e[1]}@${e[2]}">افتح السؤال</a>` : '';
  const fdQn = n => n === 1 ? 'سؤال واحد' : n === 2 ? 'سؤالين' : n <= 10 ? n + ' أسئلة' : n + ' سؤالاً';
  const fdTests = n => n === 1 ? 'اختبار محاكي' : n === 2 ? 'اختبارين محاكيين' : n <= 10 ? n + ' اختبارات محاكية' : n + ' اختباراً محاكياً';
  function fdItem(e, exact) {   // سطر مختصر في قائمة «أسئلة مشابهة»: الموقع + بداية السؤال + الخيارات، ويفتح السؤال بضغطة
    const main = e[0] === 'p' ? `القطعة في ${SET_NAME(e[1])}` : `${e[0] === 'q' ? 'الكمي' : 'اللفظي'} · ${SET_NAME(e[1])} · سؤال ${e[2] + 1}`;
    const head = `<span class="fd-it-h"><span class="fd-loc${e[1] ? ' main' : ''}">${e[1] ? main : 'الاختبار المحاكي ' + (e[7][0] || [])[0]}</span>${e[7].length && e[1] ? `<small>وفي ${fdTests(e[7].length)}</small>` : ''}${e[6] ? `<small class="ltr">${esc(e[6])}</small>` : ''}${exact ? '<span class="fd-ex">✓ مطابق لكلامك</span>' : ''}</span>`;
    const txt = e[0] === 'p' ? esc(e[3].slice(0, 220)) : e[0] === 'q' ? mx(e[3]) : esc(e[3]);
    const body = `${head}<span class="fd-it-q ltr">${txt}</span>${e[4].length ? `<span class="fd-it-o ltr">${e[4].map((o, j) => `<b>${LETTERS[j]}</b> ${e[0] === 'q' ? mx(o) : esc(o)}`).join('<i>·</i>')}</span>` : ''}`;
    return e[1] ? `<a class="fd-it" href="#${e[1]}@${e[2]}">${body}</a>` : `<div class="fd-it">${body}</div>`;
  }
  // 🆓 بحث الزائر: نقوله إذا السؤال في الدورة ووين، بدون نص السؤال ولا حله (الفهرس فيه بصمات الكلمات فقط)
  let FDP = null;
  async function fdLoadPub() {
    if (FDP) return FDP;
    const gz = typeof DecompressionStream === 'function';
    const r = await fetch('/p/data/free/' + (gz ? 'findp' : 'findp0') + '.bin?v=' + FIND_V); if (!r.ok) throw new Error('data ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer()), key = await getKey();
    let plain; try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12)); } catch (e) { logout(); throw new Error('bad key'); }
    const txt = gz ? await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(plain);
    FDP = fdPubBuild(JSON.parse(txt).e); return FDP;
  }
  const fdIsFreeP = p => p[1] === 'q1' || p[1] === 'v1';
  const fdMainP = p => p[1] ? (p[0] === 'p' ? `القطعة في ${SET_NAME(p[1])}` : `${p[0] === 'q' ? 'الكمي' : 'اللفظي'} · ${SET_NAME(p[1])} · سؤال ${p[2] + 1}`) : `الاختبار المحاكي ${(p[3][0] || [])[0]} · القسم ${(p[3][0] || [])[1]} · سؤال ${(p[3][0] || [])[2]}`;
  const fdLocP = p => {
    const L = []; if (p[1]) L.push(fdMainP(p));
    p[3].slice(0, 3).forEach(t => L.push(`الاختبار المحاكي ${t[0]} · القسم ${t[1]} · سؤال ${t[2]}`));
    if (p[3].length > 3) L.push(`+ ${p[3].length - 3} اختبارات محاكية ثانية`);
    return L.map((t, i) => `<span class="fd-loc${i ? '' : ' main'}">${t}</span>`).join('');
  };
  const fdActP = p => fdIsFreeP(p) ? `<a class="btn" href="#${p[1]}@${p[2]}">افتح السؤال (مجاني)</a>` : p[3].some(t => t[0] === 1) ? `<a class="btn" href="/test/">افتح الاختبار المحاكي 1 (مجاني)</a>` : `<button type="button" class="btn gold" data-sub>🔒 اشترك عشان تحله وتشوف الشرح</button>`;
  function fdItemP(p, exact) {
    const free = fdIsFreeP(p);
    const body = `<span class="fd-it-h"><span class="fd-loc main">${fdMainP(p)}</span>${p[3].length && p[1] ? `<small>وفي ${fdTests(p[3].length)}</small>` : ''}${exact ? '<span class="fd-ex">✓ مطابق لكلامك</span>' : ''}<span class="fd-lk${free ? ' fr' : ''}">${free ? 'مجاني' : '🔒 للمشتركين'}</span></span>`;
    return free ? `<a class="fd-it" href="#${p[1]}@${p[2]}">${body}</a>` : `<button type="button" class="fd-it" data-sub>${body}</button>`;
  }
  async function fdRunPub(R, q, kind, full, img) {
    let ix; try { ix = await fdLoadPub(); } catch (e) { R.innerHTML = `<div class="fd-res tip"><p>تعذّر تحميل البحث. تأكد من الإنترنت وحاول مرة ثانية.</p></div>`; return; }
    if (!$('#fdr')) return;
    const res = fdPubSearch(ix, q, kind, 6), top = res[0], E = ix.P, p = top && E[top.i], sc = top ? top.s : 0;
    const lock = `<p class="fd-lkn">🔒 نص السؤال وحله وشرحه للمشتركين في الدورة.</p>`;
    if (window.QGT) QGT.ev('find', full && p && sc >= FDP_HI ? 'لقاه في الدورة' : full && p && sc >= FDP_MID ? 'لقى سؤال قريب' : full ? 'ما لقاه في الدورة' : 'بحث بكلمات', img ? 1 : 0);
    if (full && p && sc >= FDP_HI) {
      const same = res.slice(1).filter(r => r.s >= FDP_HI && sc - r.s < 0.03).map(r => E[r.i]);   // نفس السؤال في مكان ثاني
      R.innerHTML = `<div class="fd-res ok"><div class="fd-h"><span class="ic">✓</span><div><b>السؤال موجود في الدورة</b><small>تلقاه هنا:</small></div></div>
        <div class="fd-locs">${fdLocP(p)}${same.map(fdLocP).join('')}</div>${fdIsFreeP(p) ? '' : lock}<div class="fd-acts">${fdActP(p)}</div></div>`;
    } else if (full && p && sc >= FDP_MID) {
      R.innerHTML = `<div class="fd-res mid"><div class="fd-h"><span class="ic">🔎</span><div><b>لقينا سؤال قريب جداً</b><small>يمكن يكون نفسه بأرقام أو خيارات ثانية:</small></div></div>
        <div class="fd-locs">${fdLocP(p)}</div>${fdIsFreeP(p) ? '' : lock}<div class="fd-acts">${fdActP(p)}</div>${fsRepBox('تبي نتأكد لك؟ بلّغنا عنه:', 0, 1)}</div>`;
    } else if (full) {
      const near = res.filter(r => r.s >= 0.5).map(r => E[r.i]).slice(0, 5);
      R.innerHTML = `<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا هذا السؤال في الدورة</b><small>بلّغ عنه عشان نراجعه.</small></div></div>
        ${fsRepBox('')}${near.length ? `<div class="fd-near"><h4>أسئلة قريبة منه في الدورة</h4><div class="fd-list">${near.map(x => fdItemP(x)).join('')}</div></div>` : ''}</div>`;
    } else {
      const seen = new Set(), list = [], exact = new Set(res.filter(r => r.s >= FDP_HI).map(r => r.i));
      res.filter(r => r.s >= FDP_MID).concat(fdPubKeyword(ix, q, kind, 40)).forEach(r => { if (!seen.has(r.i)) { seen.add(r.i); list.push(r.i); } });
      let shown = 10; const show = () => { const box = $('#fdl'); if (!box) return; box.innerHTML = list.slice(0, shown).map(i => fdItemP(E[i], exact.has(i))).join(''); bindSub(box); const mb = $('#fdmore'); if (mb) mb.hidden = shown >= list.length; };
      R.innerHTML = list.length ? `<div class="fd-res sim"><div class="fd-h"><span class="ic">🔎</span><div><b>أسئلة في الدورة فيها كلامك</b><small>لقينا ${list.length >= 40 ? 'أكثر من 40 سؤالاً' : fdQn(list.length)}${list.length > 10 ? '، هذي أقربها' : ''}. نص الأسئلة وحلها للمشتركين، وهنا تشوف وين تلقاها.</small></div></div>
          <div class="fd-list" id="fdl"></div><button type="button" class="btn ghost fd-more" id="fdmore">عرض أسئلة أكثر</button>
          ${fsRepBox('ما لقيت سؤالك؟ اكتبه كامل أو صوّره، أو بلّغنا عنه:', 1)}</div>`
        : `<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا أسئلة فيها هالكلام</b><small>جرّب كلمات ثانية، أو اكتب السؤال كامل، أو بلّغ عنه.</small></div></div>${fsRepBox('', 1)}</div>`;
      show(); const mb = $('#fdmore'); if (mb) mb.onclick = () => { shown += 10; show(); };
    }
    bindSub(R); fsRep(R, { text: q });
    R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
  }
  // ---------- 🔎 البحث الذكي على الخادم: يقارن سؤالك بكل أسئلة الدورة (والصورة تنقرى هناك) ----------
  // يقول وين السؤال بالضبط، أو إنه نفسه بصياغة/ترتيب/خيارات/أرقام مختلفة، أو سؤال جديد. لو الخادم ما رد نرجع للبحث المحلي.
  const FS = {
    exact: ['ok', '✓', 'السؤال موجود في الدورة بالضبط', 'تلقاه هنا:'],
    reorder: ['ok', '✓', 'السؤال موجود في الدورة', 'نفس السؤال، بس ترتيب الخيارات مختلف. تلقاه هنا:'],
    wording: ['ok', '✓', 'السؤال موجود في الدورة', 'نفس الأرقام والخيارات بصياغة مختلفة شوي. تلقاه هنا:'],
    opts_same: ['mid', '≈', 'نفس السؤال بخيارات مختلفة', 'والإجابة الصحيحة موجودة بين خياراتك. تلقاه هنا:'],
    opts_diff: ['mid', '≈', 'نفس السؤال، بس الخيارات مختلفة', 'وإجابة سؤال الدورة مو من خياراتك، فتأكد من الخيارات. تلقاه هنا:'],
    numbers: ['mid', '≈', 'نفس فكرة السؤال بأرقام مختلفة', 'نفس طريقة الحل، بس الإجابة غالباً غير. تلقاه هنا:'],
    new: ['no', '✕', 'سؤال جديد، ما هو موجود في الدورة', 'بلّغ عنه عشان نراجعه.'] };
  const FS_EV = { exact: 'لقاه في الدورة', reorder: 'لقاه في الدورة', wording: 'لقاه في الدورة', opts_same: 'لقى سؤال قريب', opts_diff: 'لقى سؤال قريب', numbers: 'لقى سؤال قريب', new: 'ما لقاه في الدورة' };
  const fsLoc = r => { let m = String(r).match(/^([qv])(\d+):(\d+)$/); if (m) return { set: m[1] + m[2], i: +m[3], t: `${m[1] === 'q' ? 'الكمي' : 'اللفظي'} · ${SET_NAME(m[1] + m[2])} · سؤال ${+m[3] + 1}` };
    m = String(r).match(/^t(\d+):(\d+):(\d+)$/); return m ? { test: +m[1], t: `الاختبار المحاكي ${m[1]} · القسم ${m[2]} · سؤال ${+m[3] + 1}` } : { t: esc(r) }; };
  const fsLocs = refs => { const L = refs.map(fsLoc); return L.slice(0, 4).map((l, i) => `<span class="fd-loc${i ? '' : ' main'}">${l.t}</span>`).join('') + (L.length > 4 ? `<span class="fd-loc">+ ${L.length - 4} ${L.length - 4 === 1 ? 'مكان ثاني' : 'أماكن ثانية'}</span>` : ''); };
  const fsMore = n => n === 1 ? 'وفي مكان ثاني' : n === 2 ? 'وفي مكانين ثانيين' : n <= 10 ? `وفي ${n} أماكن ثانية` : `وفي ${n} مكاناً ثانياً`;
  const fsFreeLoc = it => it.refs.map(fsLoc).find(x => x.set && FREE_SETS.indexOf(x.set) >= 0);
  const fsTxt = (it, s) => it.s === 'q' ? mx(s) : esc(s);
  function fsOpen(it, ghost) {
    const c = ghost ? 'btn ghost' : 'btn', L = it.refs.map(fsLoc);
    if (isFree()) {
      const f = fsFreeLoc(it); if (f) return `<a class="${c}" href="#${f.set}@${f.i}">افتح السؤال (مجاني)</a>`;
      if (it.refs.some(r => /^t1:/.test(r))) return `<a class="${c}" href="/test/">افتح الاختبار المحاكي 1 (مجاني)</a>`;
      return `<button type="button" class="btn gold" data-sub>🔒 اشترك عشان تحله وتشوف الشرح</button>`;
    }
    const l = L.find(x => x.set); if (l) return `<a class="${c}" href="#${l.set}@${l.i}">افتح السؤال</a>`;
    const t = L.find(x => x.test); return t ? `<a class="${c}" href="/test/">افتح الاختبار المحاكي ${t.test}</a>` : '';
  }
  function fsPreview(it) { const l = it.refs.map(fsLoc).find(x => x.set); return fdPreview([it.s, l ? l.set : '', l ? l.i : -1, it.e || it.a || '', it.o || []]); }
  function fsDiff(r, it) {   // وش الفرق بين سؤالك وسؤال الدورة
    const d = it.d || {}, q = r.q, rows = [], nums = a => a.map(x => `<bdi dir="ltr">${esc(x)}</bdi>`).join('، ');
    if (r.status === 'numbers') {
      if (d.extra && d.miss) rows.push(['🔢', `في سؤالك <b>${nums(d.extra)}</b>، وفي سؤال الدورة <b>${nums(d.miss)}</b>`]);
      else if (d.extra) rows.push(['🔢', `في سؤالك أرقام مو موجودة في سؤال الدورة: <b>${nums(d.extra)}</b>`]);
      else if (d.miss) rows.push(['🔢', `سؤال الدورة فيه أرقام مو موجودة في سؤالك: <b>${nums(d.miss)}</b>`]);
      if (d.ops) rows.push(['➗', 'فيه إشارة أو عملية مختلفة في المعادلة (مثل + بدل ×، أو سالب بدل موجب)']);
    } else if (d.miss && !d.extra) rows.push(['🖼️', `سؤال الدورة فيه أرقام ما ذكرتها: <b>${nums(d.miss)}</b> (غالباً في الرسم)`]);
    if (d.swap) rows.push(['⇄', 'القيمة A والقيمة B مبدّلة بين سؤالك وسؤال الدورة، فانتبه للإجابة']);
    if (d.qx && d.qx.length && /^opts_/.test(r.status)) rows.push(['🔤', `${d.qx.length === 1 ? 'خيار في سؤالك مو موجود' : 'خيارات في سؤالك مو موجودة'} في سؤال الدورة: ${d.qx.map(i => `<b><bdi dir="ltr">${LETTERS[i]}) ${fsTxt(it, q.opts[i] || '')}</bdi></b>`).join('، ')}`]);
    return rows.length ? `<ul class="fd-diff">${rows.map(x => `<li><span aria-hidden="true">${x[0]}</span><p>${x[1]}</p></li>`).join('')}</ul>` : '';
  }
  function fsAns(r, it) {   // الإجابة (مخفية لين يضغط) — بحرف سؤاله هو لو نقدر
    if (it.k == null || !it.o || !it.o.length) return '';
    const d = it.d || {}, q = r.q, same = /^(exact|reorder|wording|opts_same)$/.test(r.status);
    let a;
    if (same && d.ansAt >= 0 && (q.opts[d.ansAt] || it.o[d.ansAt]) != null) {
      const o = q.opts[d.ansAt] && !/^\s*[a-d]\s*$/i.test(q.opts[d.ansAt]) ? q.opts[d.ansAt] : it.o[d.ansAt];   // خيارات المقارنة المختصرة (A / B) نعرضها بنص الدورة
      a = `الإجابة الصحيحة في سؤالك: <b><bdi dir="ltr">${LETTERS[d.ansAt]}) ${fsTxt(it, o)}</bdi></b>${d.ansAt !== it.k && !d.swap ? ` <small>(في الدورة حرفها ${LETTERS[it.k]})</small>` : ''}`;
    } else a = `${r.status === 'numbers' ? 'إجابة سؤال الدورة (بأرقامه هو)' : 'إجابة سؤال الدورة'}: <b><bdi dir="ltr">${LETTERS[it.k]}) ${fsTxt(it, it.o[it.k])}</bdi></b>${r.status === 'opts_diff' ? ' — ومو موجودة بين خياراتك' : ''}`;
    return `<div class="fd-ans"><button type="button" class="btn ghost sm" data-ans aria-expanded="false">👁️ اعرض الإجابة</button><p hidden>${a}</p></div>`;
  }
  function fsItem(it) {   // سطر في «أسئلة قريبة»
    const L = it.refs.map(fsLoc), l = L.find(x => x.set), more = it.refs.length > 1 ? `<small>${fsMore(it.refs.length - 1)}</small>` : '';
    if (isFree()) {
      const f = fsFreeLoc(it), body = `<span class="fd-it-h"><span class="fd-loc main">${L[0].t}</span>${more}<span class="fd-lk${f ? ' fr' : ''}">${f ? 'مجاني' : '🔒 للمشتركين'}</span></span>`;
      return f ? `<a class="fd-it" href="#${f.set}@${f.i}">${body}</a>` : `<button type="button" class="fd-it" data-sub>${body}</button>`;
    }
    const body = `<span class="fd-it-h"><span class="fd-loc main">${L[0].t}</span>${more}</span><span class="fd-it-q ltr">${fsTxt(it, it.e || it.a || '')}</span>${(it.o || []).length ? `<span class="fd-it-o ltr">${it.o.map((o, j) => `<b>${LETTERS[j]}</b> ${fsTxt(it, o)}`).join('<i>·</i>')}</span>` : ''}`;
    return l ? `<a class="fd-it" href="#${l.set}@${l.i}">${body}</a>` : `<div class="fd-it">${body}</div>`;
  }
  function fdImgs(R) {   // صورة سؤال الكمي من ملف القسم (نفس الصورة اللي يشوفها في الدورة)
    R.querySelectorAll('.fd-pv[data-img]').forEach(async el => { const [sid, i] = (el.dataset.img || '').split(':'); if (!sid || el.classList.contains('has-img')) return;
      try { const set = await loadSet(sid), it = set.items[+i]; if (it && it.img && el.isConnected) { el.classList.add('has-img'); el.insertAdjacentHTML('afterbegin', `<img src="${it.img}" width="${it.w}" height="${it.h}" alt="السؤال">`); } } catch (x) {} });
  }
  // 🚩 بلاغ بدل الواتساب في كل نتائج البحث: زر ← ملاحظة للمعلم (اختياري) ← إرسال — يوصل للمالك في سجل البحث مع سؤال الطالب (وصورته)
  // base = { id: رقم البحث في الخادم }، أو { text: نص الطالب } لما البحث صار على جهازه (كلمات، أو الخادم ما رد)
  let fdRepCtx = () => ({});   // صفحة البحث تحدده: نوع السؤال، وإن النص من صورة، وصورته لو ما وصلت الخادم
  const fsRepBtn = (lead, gh) => `<div class="fd-acts">${lead ? `<span class="fd-or">${lead}</span>` : ''}<button type="button" class="btn${gh ? ' ghost' : ''}" data-rep>🚩 بلّغ عن السؤال</button></div>`;
  const fsRepBox = (lead, kw, gh) => `<div class="fd-rep${lead ? ' fd-wa' : ''}" data-lead="${esc(lead || '')}"${kw ? ' data-kw="1"' : ''}${gh ? ' data-gh="1"' : ''}>${fsRepBtn(lead, gh)}</div>`;   // gh = زر ثانوي (لما فيه «افتح السؤال»)
  function fsRep(R, base) {
    R.querySelectorAll('.fd-rep').forEach(box => {
      const lead = box.dataset.lead || '', ph = box.dataset.kw ? 'مثلاً: اكتب السؤال كامل، أو وين شفته' : 'مثلاً: جاني في الاختبار، أو لقيته في ملف تجميعات';
      const bind = () => { box.querySelector('[data-rep]').onclick = start; };
      const start = () => {
        box.innerHTML = `<label class="fd-l" for="fdrn">ملاحظة للمعلم (اختياري)</label><textarea id="fdrn" class="fd-rn" dir="auto" rows="2" maxlength="300" placeholder="${ph}"></textarea>
          <div class="fd-acts"><button type="button" class="btn" data-send>إرسال البلاغ</button><button type="button" class="btn ghost" data-x>إلغاء</button></div>`;
        const ta = box.querySelector('textarea'), send = box.querySelector('[data-send]'); ta.focus();
        box.querySelector('[data-x]').onclick = () => { box.innerHTML = fsRepBtn(lead, box.dataset.gh); bind(); box.querySelector('[data-rep]').focus(); };
        send.onclick = async () => {
          send.disabled = true; send.textContent = 'نرسل البلاغ…';
          const r = await api(Object.assign({ op: 'find_report', session: auth.session, note: ta.value }, fdRepCtx(), base)).catch(() => null);
          if (r && r.ok) { box.innerHTML = '<p class="fd-repok" role="status">✓ وصلنا بلاغك، وبنراجع السؤال. شكراً لك!</p>'; if (window.QGT) QGT.ev('find', 'بلّغ عن سؤال'); return; }
          if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
          toast((r && r.msg) || 'تعذّر إرسال البلاغ، جرّب مرة ثانية.'); send.disabled = false; send.textContent = 'إرسال البلاغ';
        };
      };
      bind();
    });
  }
  function fsShow(R, r, q, img, kind) {
    if (!$('#fdr')) return;
    const S = FS[r.status] || FS.new, free = isFree(), it = r.best;
    if (window.QGT) QGT.ev('find', FS_EV[r.status] || 'ما لقاه في الدورة', img ? 1 : 0);
    let h = `<div class="fd-res ${S[0]}"><div class="fd-h"><span class="ic" aria-hidden="true">${S[1]}</span><div><b>${S[2]}</b><small>${S[3]}</small></div></div>`;
    if (it) {
      h += `<div class="fd-locs">${fsLocs(it.refs)}</div>${fsDiff(r, it)}`;
      if (free) h += fsFreeLoc(it) ? '' : `<p class="fd-lkn">🔒 نص السؤال وحله وشرحه للمشتركين في الدورة.</p>`;
      else h += fsPreview(it) + fsAns(r, it);
      h += `<div class="fd-acts">${fsOpen(it)}</div>`;
      if (r.alts && r.alts.length) h += `<div class="fd-alt"><h4>${r.alts.length > 1 ? 'أو يمكن يكون واحد من هذي:' : 'أو يمكن يكون هذا:'}</h4>${r.alts.map(a => `<div class="fd-ai"><div class="fd-locs">${fsLocs(a.refs)}</div>${free ? '' : fsPreview(a)}<div class="fd-acts">${fsOpen(a, true)}</div></div>`).join('')}</div>`;
      if (S[0] !== 'ok') h += fsRepBox('تبي نتأكد لك؟ بلّغنا عنه:', 0, 1);
    } else h += fsRepBox('');   // 🚩 ما لقيناه: بلاغ يوصل للمالك في سجل البحث
    if (r.similar && r.similar.length) h += `<div class="fd-near"><h4>${it ? 'أسئلة قريبة منه في الدورة' : 'أقرب الأسئلة له في الدورة — يمكن تفيدك'}</h4><div class="fd-list">${r.similar.map(fsItem).join('')}</div></div>`;
    R.innerHTML = h + '</div>';
    bindSub(R); fdImgs(R); fsRep(R, r.lid ? { id: r.lid } : { text: q });
    R.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const p = b.nextElementSibling; p.hidden = !p.hidden; b.setAttribute('aria-expanded', !p.hidden); b.textContent = p.hidden ? '👁️ اعرض الإجابة' : '🙈 اخفِ الإجابة'; });
    R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
  }
  async function fsImgData(file) {   // نصغّر الصورة (أطول ضلع 1600) ونرسلها JPEG
    if (typeof createImageBitmap !== 'function') return file.size < 3.2e6 ? await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); }) : null;
    const bmp = await createImageBitmap(file), m = Math.max(bmp.width, bmp.height), sc = m > 1600 ? 1600 / m : 1;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  }
  async function renderFind() {
    document.title = 'ابحث عن سؤال | Q-Guide';
    let kind = lsGet('qg_find_k', 'q'), usedImg = false, ocrTxt = '', imgData = '', imgLid = 0;   // imgLid = رقم بحث الصورة في الخادم (صورته محفوظة هناك)
    fdRepCtx = () => ({ kind, ocr: usedImg ? 1 : undefined, fr: usedImg && imgLid ? imgLid : undefined, img: usedImg && !imgLid && imgData ? imgData : undefined });
    app.innerHTML = topbar(`<span class="ttl">🔎 ابحث عن سؤال</span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap fd">
      <div class="fd-top"><h1>ابحث عن سؤال</h1><p>شفت سؤال وتبي تعرف إذا هو في الدورة؟ اكتبه أو ارفع صورته، ونقولك وين تلقاه بالضبط، أو إذا هو نفسه بأرقام أو خيارات مختلفة، أو سؤال جديد.${isFree() ? ' حله وشرحه للمشتركين.' : ''}</p></div>
      <div class="fd-box">
        <div class="seg" id="fdk" role="tablist" aria-label="نوع السؤال"><button type="button" role="tab" data-k="q" class="${kind === 'q' ? 'on' : ''}" aria-selected="${kind === 'q'}">📐 الكمي</button><button type="button" role="tab" data-k="v" class="${kind === 'v' ? 'on' : ''}" aria-selected="${kind === 'v'}">📖 اللفظي</button></div>
        <label class="fd-l" for="fdq">نص السؤال</label>
        <textarea id="fdq" dir="ltr" rows="5" spellcheck="false" placeholder="Paste the question here… (with the choices if you can)"></textarea>
        <div class="fd-img" id="fdpv" hidden><img id="fdth" alt=""><span id="fdst"></span><button type="button" class="ib" id="fdx" title="إزالة الصورة">✕</button></div>
        <div class="fd-acts"><label class="btn ghost" id="fdil" for="fdimg">📷 صورة السؤال</label><input type="file" id="fdimg" accept="image/*" hidden><button type="button" class="btn" id="fdgo">🔎 ابحث</button></div>
        <p class="fd-hint">اكتب السؤال كامل مع الخيارات، أو صوّره (مع الرسم والخيارات) ونقراه لك. وتقدر تكتب كلمات منه بس (مثل <bdi dir="ltr">circle area</bdi>) ونطلع لك الأسئلة اللي فيها.</p>
      </div>
      <div id="fdr" aria-live="polite"></div></main>`;
    bindCtl();
    const ta = $('#fdq'), R = $('#fdr'), go = $('#fdgo'), pv = $('#fdpv'), st = $('#fdst'), inp = $('#fdimg');
    (isFree() ? fdLoadPub() : fdLoad()).catch(() => {});   // نجهّز الفهرس المحلي (للكلمات، ولو الخادم ما رد)
    const call = p => api(Object.assign({ op: 'find', session: auth.session, kind }, p)).catch(() => null);
    $('#fdk').onclick = e => { const b = e.target.closest('button[data-k]'); if (!b || b.dataset.k === kind) return; kind = b.dataset.k; lsSet('qg_find_k', kind); $('#fdk').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); if (ta.value.trim()) run(); };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); run(); } };   // Enter يبحث · Shift+Enter سطر جديد
    ta.oninput = () => { if (usedImg && ocrTxt && !ta.value.includes(ocrTxt.slice(0, 24))) { pv.hidden = true; usedImg = false; ocrTxt = ''; imgData = ''; imgLid = 0; } };   // كتب سؤال ثاني بدل نص الصورة
    go.onclick = () => run();
    $('#fdx').onclick = () => { pv.hidden = true; usedImg = false; ocrTxt = ''; imgData = ''; imgLid = 0; inp.value = ''; };
    async function localOcr(f) {   // احتياط: قراءة الصورة على جهاز الطالب لو الخادم ما قدر
      if (!fdCanOcr()) return '';
      st.innerHTML = '<span class="spin sm"></span> ' + (lsGet('qg_ocr_ok', 0) ? 'نقرأ الصورة على جهازك…' : 'نجهّز قارئ الصور على جهازك (حوالي 5 ميجا) ثم نقرأ الصورة…');
      try { const t = (await fdOcrRun(await fdPrep(f))).replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim(); if (t.replace(/[^A-Za-z0-9ء-ي]/g, '').length >= 12) { lsSet('qg_ocr_ok', 1); return t; } } catch (e) {}
      return '';
    }
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      usedImg = true; pv.hidden = false; pv.className = 'fd-img busy'; $('#fdth').src = URL.createObjectURL(f); go.disabled = true;
      st.innerHTML = '<span class="spin sm"></span> نقرأ السؤال من الصورة…';
      R.innerHTML = `<div class="fd-res wait"><span class="spin sm"></span> نقرأ الصورة ونقارنها بكل أسئلة الدورة…</div>`;
      try {
        let data = null; try { data = await fsImgData(f); } catch (e) {}
        imgData = data || ''; imgLid = 0;
        const r = data ? await call({ img: data }) : null;
        if (r && r.ok) { imgLid = r.lid || 0; ta.value = ocrTxt = r.text || ''; pv.className = 'fd-img ok'; st.textContent = '✓ قرينا السؤال من الصورة — لو فيه خطأ صحّحه فوق واضغط ابحث'; fsShow(R, r, ocrTxt, true, kind); return; }
        if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
        if (r && r.error === 'noq') { pv.className = 'fd-img bad'; st.textContent = r.msg; R.innerHTML = ''; return; }
        const why = r && r.error === 'limit' ? r.msg : '';
        const t = await localOcr(f);
        if (!t) { pv.className = 'fd-img bad'; st.textContent = why || 'تعذّرت قراءة الصورة الحين. جرّب صورة أوضح أو اكتب السؤال.'; R.innerHTML = ''; return; }
        ta.value = ocrTxt = t; pv.className = 'fd-img ok'; st.textContent = (why ? why + ' ' : '') + '✓ قرينا النص على جهازك — صحّحه فوق إذا فيه خطأ'; run(true);
      } finally { go.disabled = false; inp.value = ''; }
    };
    async function run(fromImg) {
      const q = ta.value.trim(), T = fdToks(q), words = T.en.filter(w => w[0] !== '_').length + T.ar.length, full = words >= 6 || q.length >= 60;
      if (!words && T.nu.length < 2) { R.innerHTML = `<div class="fd-res tip"><p>اكتب كلمة أو أكثر من السؤال (مثل <bdi dir="ltr">probability</bdi> أو <bdi dir="ltr">circle area</bdi>)، أو السؤال كامل.</p></div>`; ta.focus(); return; }
      R.innerHTML = `<div class="fd-res wait"><span class="spin sm"></span> نقارن سؤالك بكل أسئلة الدورة…</div>`;
      if (full) {   // سؤال كامل: محرك المقارنة على الخادم (ocr = النص من صورته، عشان المالك يشوف الصورة معه في السجل)
        const r = await call({ text: q, ocr: usedImg ? 1 : undefined, fr: usedImg && imgLid ? imgLid : undefined });
        if (r && r.ok) return fsShow(R, r, q, usedImg || fromImg, kind);
        if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
      }
      if (isFree()) return fdRunPub(R, q, kind, full, usedImg);   // 🆓 الزائر: المكان فقط
      let ix; try { ix = await fdLoad(); } catch (e) { R.innerHTML = `<div class="fd-res tip"><p>تعذّر تحميل البحث. تأكد من الإنترنت وحاول مرة ثانية.</p></div>`; return; }
      if (!$('#fdr')) return;
      const res = fdSearch(ix, q, kind, 4), top = res[0], E = ix.entries;
      const e = top && E[top.i], sc = top ? top.s : 0;
      const same = e ? res.filter(r => r.s >= FD_HI && E[r.i] !== e && E[r.i][3] === e[3]).map(r => E[r.i]) : [];   // نفس السؤال مكرر في قسم ثاني
      const alts = e ? res.slice(1).filter(r => r.s >= Math.max(FD_MID, sc - 0.06) && E[r.i][3] !== e[3]).map(r => E[r.i]).slice(0, 2) : [];   // أسئلة متقاربة جداً بنفس الدرجة
      const altHtml = alts.length ? `<div class="fd-alt"><h4>أو يمكن يكون ${alts.length > 1 ? 'واحد من هذي' : 'هذا'}:</h4>${alts.map(x => `<div class="fd-ai"><div class="fd-locs">${fdLoc(x)}</div>${fdPreview(x)}<div class="fd-acts">${fdOpen(x).replace('class="btn"', 'class="btn ghost"')}</div></div>`).join('')}</div>` : '';
      if (full && e && sc >= FD_HI) {
        R.innerHTML = `<div class="fd-res ok"><div class="fd-h"><span class="ic">✓</span><div><b>السؤال موجود في الدورة</b><small>تلقاه هنا:</small></div></div>
          <div class="fd-locs">${fdLoc(e)}${same.map(fdLoc).join('')}</div>${fdPreview(e)}<div class="fd-acts">${fdOpen(e)}</div>${altHtml}</div>`;
      } else if (full && e && sc >= FD_MID) {
        R.innerHTML = `<div class="fd-res mid"><div class="fd-h"><span class="ic">🔎</span><div><b>لقينا سؤال قريب جداً</b><small>قارنه بسؤالك وتأكد إنه نفسه:</small></div></div>
          <div class="fd-locs">${fdLoc(e)}</div>${fdPreview(e)}<div class="fd-acts">${fdOpen(e)}</div>${altHtml}${fsRepBox('مو نفسه؟ بلّغنا عنه:', 0, 1)}</div>`;
      } else if (full) {   // سؤال كامل ما لقيناه: واتساب + أقرب الأسئلة عندنا
        const near = fdSearch(ix, q, kind, 6).filter(r => r.s >= 0.5).map(r => E[r.i]).slice(0, 5);
        R.innerHTML = `<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا هذا السؤال في الدورة</b><small>بلّغ عنه عشان نراجعه.</small></div></div>
          ${fsRepBox('')}${near.length ? `<div class="fd-near"><h4>أسئلة مشابهة عندنا — يمكن تفيدك</h4><div class="fd-list">${near.map(fdItem).join('')}</div></div>` : ''}</div>`;
      } else {   // كلام بسيط: أسئلة فيها نفس الكلمات (والمطابق تماماً أولها)
        const seen = new Set(), list = [], exact = new Set(res.filter(r => r.s >= FD_HI).map(r => r.i));
        res.filter(r => r.s >= FD_MID).concat(fdKeyword(ix, q, kind, 40)).forEach(r => { if (!seen.has(r.i)) { seen.add(r.i); list.push(r.i); } });
        let shown = 10; const show = () => { const box = $('#fdl'); if (!box) return; box.innerHTML = list.slice(0, shown).map(i => fdItem(E[i], exact.has(i))).join(''); const mb = $('#fdmore'); if (mb) mb.hidden = shown >= list.length; };
        R.innerHTML = list.length ? `<div class="fd-res sim"><div class="fd-h"><span class="ic">🔎</span><div><b>أسئلة مشابهة لكلامك</b><small>لقينا ${list.length >= 40 ? 'أكثر من 40 سؤالاً' : fdQn(list.length)}${list.length > 10 ? '، هذي أقربها' : ''} — ${list.length === 1 ? 'اضغط عليه تفتحه' : 'اضغط أي سؤال تفتحه'}</small></div></div>
            <div class="fd-list" id="fdl"></div><button type="button" class="btn ghost fd-more" id="fdmore">عرض أسئلة أكثر</button>
            ${fsRepBox('ما لقيت سؤالك؟ اكتبه كامل أو صوّره، أو بلّغنا عنه:', 1)}</div>`
          : `<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا أسئلة فيها هالكلام</b><small>جرّب كلمات ثانية، أو اكتب السؤال كامل، أو بلّغ عنه.</small></div></div>${fsRepBox('', 1)}</div>`;
        show(); const mb = $('#fdmore'); if (mb) mb.onclick = () => { shown += 10; show(); };
      }
      fdImgs(R); fsRep(R, { text: q });
      R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  // ---------- 📐 قوانين الكمي · 📘 قواعد اللفظي (من أسئلة الدورة) ----------
  const RULES_V = 4, RULES_ON = true, RU_DATA = {};
  const RU_CFG = {
    q: { hash: '#rules', ttl: '📐 قوانين الكمي', h1: 'قوانين الكمي', file: 'rules.json?v=' + RULES_V, yt: () => ytRules('q'),
      ph: 'ابحث عن قانون: مساحة، نسبة، زاوية، area…', none: 'ما لقينا قانون بهالكلمة. جرّب كلمة ثانية بالعربي أو الإنجليزي.',
      intro: n => `${n} قانون وقاعدة تحتاجها أسئلة الدورة، مرتبة حسب الموضوع. تحت كل قانون مثال محلول وسؤال تدريبي تحل فيه بنفسك. تقدر تطبعها أو تحفظها PDF من زر 🖨️.` },
    v: { hash: '#rules-v', ttl: '📘 قواعد اللفظي', h1: 'قواعد اللفظي', file: 'rules_v.json?v=1', yt: () => ytRules('v'),
      ph: 'ابحث: سبب ونتيجة، although، main idea…', none: 'ما لقينا قاعدة بهالكلمة. جرّب كلمة ثانية بالعربي أو الإنجليزي.',
      intro: () => 'طريقة الحل في كل نوع من أسئلة اللفظي، وأنواع العلاقات والقرائن والأسئلة اللي تكررت في أسئلة الدورة. تحت كل نوع مثال محلول وسؤال تدريبي تحل فيه بنفسك. تقدر تطبعها أو تحفظها PDF من زر 🖨️.' } };
  async function renderRules(kind) {
    kind = kind === 'v' ? 'v' : 'q'; const C = RU_CFG[kind], VB = kind === 'v';
    document.title = C.h1 + ' | Q-Guide';
    const back = `<a class="ib" href="#" title="الرئيسية">→</a>`;
    if (!RU_DATA[kind]) { app.innerHTML = topbar(`<span class="ttl">${C.ttl}</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; bindCtl();
      try { RU_DATA[kind] = await (await fetch('/p/data/' + C.file)).json(); } catch (e) { app.innerHTML = topbar('', back) + '<div class="center">تعذّر التحميل. <a href="#">رجوع</a></div>'; return; } }
    if (location.hash !== C.hash) return;
    const D = RU_DATA[kind], R = C.yt(), nItems = D.reduce((a, s) => a + s.items.length, 0);
    const tx = VB ? esc : mx;   // اللفظي نص إنجليزي عادي، والكمي نرسم كسوره وأسسه
    app.innerHTML = topbar(`<span class="ttl">${C.ttl}</span><span class="sp"></span><button class="ib" id="prn" title="طباعة / حفظ PDF">🖨️</button>`, back) + `<main class="wrap rules${VB ? ' rules-v' : ''}">
      <div class="ru-top"><div><h1>${C.h1}</h1><p>${C.intro(nItems)}</p></div>
        <a class="rvid" href="${ytUrl(R.id)}" target="_blank" rel="noopener">${YTSVG}<span>${R.t}</span>${R.dur ? `<small>${R.dur}</small>` : ''}</a></div>
      <div class="ru-bar"><input id="ruq" type="search" placeholder="${C.ph}" autocomplete="off"><span class="mut" id="run"></span></div>
      <nav class="ru-nav" aria-label="المواضيع">${D.map(s => `<a href="${C.hash}" data-go="${s.id}">${s.icon} ${esc(s.t)}</a>`).join('')}</nav>
      <div class="ru-cols" id="ruc">${D.map((s, si) => `<section class="ru-s" id="ru-${s.id}"><h2><span class="ic" aria-hidden="true">${s.icon}</span>${esc(s.t)}<small dir="ltr">${esc(s.en || '')}</small></h2>${s.how ? `<div class="ru-how"><h3>طريقة الحل</h3><ol>${s.how.map(t => `<li>${arFx(t)}</li>`).join('')}</ol></div>` : ''}${s.sub ? `<h3 class="ru-sub">${esc(s.sub)}</h3>` : ''}<div class="ru-g">
        ${s.items.map((x, ii) => `<div class="ru-i" data-s="${si}" data-i="${ii}" data-k="${esc((x.a + ' ' + x.f + ' ' + (x.en || '') + ' ' + (x.n || '') + ' ' + (VB ? (x.x || '') + ' ' : '') + s.t + ' ' + (s.en || '')).toLowerCase())}"><div class="ru-a">${esc(x.a)}${x.en ? `<small dir="ltr">${esc(x.en)}</small>` : ''}</div><div class="ru-f${VB ? ' v' : ''}" dir="ltr">${tx(x.f)}</div>${x.x ? `<div class="ru-x" dir="ltr"><span class="eg">e.g.</span> ${tx(x.x)}</div>` : ''}${x.n ? `<div class="ru-n">${arFx(x.n)}</div>` : ''}${x.q ? `<div class="ru-qb"><button type="button" class="ru-b" data-m="ex" aria-expanded="false">مثال محلول</button><button type="button" class="ru-b" data-m="pr" aria-expanded="false">سؤال تدريبي</button></div><div class="ru-p" hidden></div>` : ''}</div>`).join('')}</div></section>`).join('')}</div>
      <p class="mut ru-empty" id="rue" hidden>${C.none}</p></main>`;
    bindCtl();
    $('#prn').onclick = () => window.print();
    document.querySelectorAll('.ru-nav a').forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById('ru-' + a.dataset.go); if (el) el.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); });
    // مثال محلول / سؤال تدريبي تحت كل قانون (تنبني عند الفتح فقط)
    // سؤال المقارنة: «Quantity A / Quantity B» في عمودين مثل الاختبار
    const ruQ = t => { if (VB) return `<div class="ru-qq" dir="ltr">${esc(t)}</div>`;
      const L = String(t).split('\n'), A = L.find(x => /^Quantity A:/.test(x)), B = L.find(x => /^Quantity B:/.test(x));
      if (!A || !B) return `<div class="ru-qq" dir="ltr">${mx(t)}</div>`;
      const rest = L.filter(x => x !== A && x !== B).join('\n').trim(), v = x => mx(x.replace(/^Quantity [AB]:\s*/, ''));
      return `${rest ? `<div class="ru-qq" dir="ltr">${mx(rest)}</div>` : ''}<div class="ru-cmp" dir="ltr"><div><small>A</small><span>${v(A)}</span></div><div><small>B</small><span>${v(B)}</span></div></div>`; };
    const ruEx = e => `${ruQ(e.q)}<div class="ru-h">الحل</div><ol class="ru-st${e.s.length < 2 ? ' one' : ''}">${e.s.map(t => `<li>${arFx(t)}</li>`).join('')}</ol><div class="ru-ans"><span>الجواب</span><b dir="ltr">${tx(e.a)}</b></div>`;
    const ruPr = p => `${ruQ(p.q)}<div class="opts ${p.o.every(o => o.length <= 14) ? 'two' : ''}">${p.o.map((o, k) => `<button type="button" class="opt" data-k="${k}"><span class="L">${LETTERS[k]}</span><span${VB ? ' dir="ltr"' : ''}>${tx(o)}</span></button>`).join('')}</div><div class="ru-fb" aria-live="polite"></div>`;
    $('#ruc').onclick = e => {
      const b = e.target.closest('.ru-b'), o = e.target.closest('.ru-p .opt');
      if (b) {
        const card = b.closest('.ru-i'), p = card.querySelector('.ru-p'), on = b.getAttribute('aria-expanded') === 'true', it = D[+card.dataset.s].items[+card.dataset.i];
        card.querySelectorAll('.ru-b').forEach(x => x.setAttribute('aria-expanded', 'false'));
        if (on) { p.hidden = true; p.innerHTML = ''; return; }
        b.setAttribute('aria-expanded', 'true'); p.className = 'ru-p ' + b.dataset.m;
        p.innerHTML = b.dataset.m === 'ex' ? ruEx(it.q.ex) : ruPr(it.q.pr); p.hidden = false;
        const r = p.getBoundingClientRect(); if (r.bottom > innerHeight) p.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
        return;
      }
      if (o && !o.disabled) {
        const card = o.closest('.ru-i'), pr = D[+card.dataset.s].items[+card.dataset.i].q.pr, k = +o.dataset.k, ok = k === pr.k;
        card.querySelectorAll('.ru-p .opt').forEach(x => { x.disabled = true; const j = +x.dataset.k; if (j === pr.k) x.classList.add('ok'); else if (j === k) x.classList.add('bad'); });
        const fb = card.querySelector('.ru-fb'); fb.className = 'ru-fb ' + (ok ? 'ok' : 'bad');
        fb.innerHTML = `<b>${ok ? '✓ إجابة صحيحة' : `✗ الإجابة الصحيحة ${LETTERS[pr.k]}`}</b><p>${arFx(pr.e)}</p>`;
      }
    };
    const q = $('#ruq'), cnt = $('#run'), paint = () => { const v = q.value.trim().toLowerCase(); let n = 0;
      document.querySelectorAll('.ru-s').forEach(s => { let k = 0; s.querySelectorAll('.ru-i').forEach(i => { const on = !v || i.dataset.k.indexOf(v) >= 0; i.hidden = !on; if (on) k++; }); s.hidden = !k; n += k;
        s.querySelectorAll('.ru-how,.ru-sub').forEach(x => x.hidden = !!v); });   // وقت البحث نعرض النتائج بس
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
      let task = ''; if (plan) { const I = planInfo(plan, st); if (I.cur) task = [...new Set(I.cur.tasks.map(t => t.set ? SET_NAME(t.set) : t.k === 'rest' ? 'يوم راحة' : 'مراجعة أخطائك'))].join(' و'); }
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
    if (isFree() && window.QGT) QGT.ev('level', (LEVELS[res.lvl] || {}).t || '', res.pct, res.ok);
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
        ${isFree() ? `<section class="lv-card lv-sub"><h3>ابدأ من هنا</h3>
          ${weak.length ? `<p>أضعف مهاراتك: <b>${weak.map(x => TOPICS[x.t].t).join('، ')}</b>.</p>` : '<p>جاوبت كل المهارات صح 👏</p>'}
          <p class="mut">في الدورة تتدرب على كل مهارة بأسئلة من الأقسام كلها، وتمشي على ${rec.name} (${rec.days} يوماً) اللي تناسب مستواك.</p>
          <button class="btn gold" data-sub>اشترك وابدأ خطتك</button></section>` : `<section class="lv-card"><h3>ابدأ من هنا</h3>
          ${weak.length ? `<p class="mut">أضعف مهاراتك في هذا الاختبار، تدرّب عليها بأسئلة من كل الأقسام:</p><div class="lv-tr">${weak.map(x => `<a class="btn sm ghost" href="#t-${x.t}">${TOPICS[x.t].i} ${TOPICS[x.t].t}</a>`).join('')}</div>` : '<p class="mut">جاوبت كل المهارات صح 👏 كمّل على الاختبارات المحاكية.</p>'}
          <div class="lv-plan"><span>الخطة المقترحة${exT > Date.now() ? ' لموعد اختبارك' : ' لمستواك'}:</span><b>${rec.name} <small>(${rec.days} يوماً · ${rec.daily})</small></b>
            ${cur ? (cur.id === rec.id ? '<span class="fit ok">✓ هي نفس خطتك الحالية</span>' : `<span class="mut">خطتك الحالية: ${cur.name}</span> <a href="#plan">غيّرها من صفحة الخطة</a>`) : `<button class="btn gold sm" id="lvplan">ابدأ ${rec.name}</button>`}</div></section>`}</div>
      <div class="acts lv-acts"><button class="btn" id="lvrev">مراجعة إجاباتك مع الشرح</button><a class="btn ghost" href="#">الرئيسية</a><button class="lnk2" id="lvagain">↻ أعد الاختبار</button></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    if (fresh) { const rp = $('#rp'), ring = $('#ring'); if (RM()) { rp.textContent = res.pct; ring.style.setProperty('--p', res.pct); } else { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 900), v = Math.round(res.pct * (1 - Math.pow(1 - k, 3))); rp.textContent = v; ring.style.setProperty('--p', v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } if (res.pct >= 85 && !RM()) setTimeout(confetti, 600); }
    const pb = $('#lvplan'); if (pb) pb.onclick = () => { planStart(rec.id); location.hash = 'plan'; };
    $('#lvrev').onclick = () => levelReview(set, res); bindSub(app);
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
    if (isFree()) return;   // 🆓 الإنجازات للمشتركين
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
  const fmtD = t => { if (!t) return '—'; const d = new Date(t); const diff = (Date.now() - t) / 60000; if (diff < 60) return 'قبل ' + Math.max(1, Math.round(diff)) + ' د'; if (diff < 1440) return 'قبل ' + Math.round(diff / 60) + ' س'; return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); };
  let ADM = { list: null, q: '', f: 'all', role: '', staff: null, members: null, mq: '', draft: '', subs: null, sf: 'all', sq: '', msub: 'free', regs: null, regsSync: null, regsAt: 0, rf: 'wait', rq: '', rt: {}, share: null };
  const isOwner = () => (ADM.role || auth.staff) === 'owner';
  const ROLE_T = { owner: '👑 مالك', admin: '🛡 مشرف كامل', viewer: '👁 متابعة فقط' };
  function admTop(tab) {
    return topbar(`<span class="ttl">👑 لوحة الإدارة</span><span class="sp"></span><a class="tn" href="${SHEET_URL}" target="_blank" rel="noopener" title="فتح الشيت"><span class="i">📊</span><span class="l">الشيت</span></a><button class="ib" id="admref" title="تحديث">⟳</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap" id="admw"><div class="atabs"><a href="#admin" class="${tab === 'students' ? 'on' : ''}">👥 الطلاب${ADM.list ? ` <small>${ADM.list.length}</small>` : ''}</a>${isOwner() ? `<a href="#admin-regs" class="${tab === 'regs' ? 'on' : ''}">${regTabLabel()}</a>` : ''}${isOwner() ? `<a href="#admin-members" class="${tab === 'members' ? 'on' : ''}">➕ المشتركون${ADM.members ? ` <small>${ADM.members.length}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-subs" class="${tab === 'subs' ? 'on' : ''}">💳 نوع الاشتراك${ADM.subs ? (n => n ? ` <small title="بطابور المشاركة التلقائية">${n}</small>` : '')(ADM.subs.filter(x => x.t !== 'yt' && !x.sh).length) : ''}</a>` : ''}${isOwner() ? `<a href="#admin-free" class="${tab === 'free' ? 'on' : ''}">🆓 الزوار${ADM.free ? ` <small>${ADM.free.total}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-ai" class="${tab === 'ai' ? 'on' : ''}">🤖 المساعد${ADM.ai && ADM.ai.flagged ? ` <small class="red">${ADM.ai.flagged}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-find" class="${tab === 'find' ? 'on' : ''}">🔎 البحث</a>` : ''}<a href="#admin-staff" class="${tab === 'staff' ? 'on' : ''}">🛡 المشرفون${ADM.staff ? ` <small>${ADM.staff.owners.length + ADM.staff.staff.length}</small>` : ''}</a><a href="#studio" class="${tab === 'studio' ? 'on' : ''}">🎬 استوديو تيك توك</a>${ADM.role ? `<span class="myrole">صلاحيتك: <b>${ROLE_T[ADM.role] || ADM.role}</b></span>` : ''}</div><div id="adm"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
  }
  async function admLoadStaff(force) { if (ADM.staff && !force) { regsSoon(); return ADM.staff; } const r = await admCall({ op: 'adm_staff_list' }); ADM.staff = r; ADM.role = r.myRole || ''; if (auth.staff !== ADM.role) { auth.staff = ADM.role; lsSet(LS.auth, auth); } regsSoon(); return r; }
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
    let list = all.filter(s => !q || [s.name, s.display, s.email, s.typed, s.phone, s.user].some(x => String(x || '').toLowerCase().includes(q)));
    if (ADM.f === 'banned') list = list.filter(s => s.banned); else if (ADM.f === 'today') list = list.filter(s => s.lastLogin > day); else if (ADM.f === 'never') list = list.filter(s => !s.logins && !s.banned);
    list.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
    W.innerHTML = `<div class="astats"><div><b>${stats.n}</b><span>طالب مشترك</span></div><div><b>${stats.today}</b><span>دخل آخر 24 ساعة</span></div><div><b>${stats.never}</b><span>لم يدخل الموقع</span></div><div class="bad"><b>${stats.banned}</b><span>محظور</span></div></div>
      <div class="abar"><input id="aq" type="search" placeholder="ابحث بالاسم أو الإيميل أو الجوال أو اليوزر…" value="${esc(ADM.q)}"><div class="tabs sm">${[['all', 'الكل'], ['today', 'نشط اليوم'], ['never', 'لم يدخل'], ['banned', 'محظور']].map(([k, t]) => `<button data-f="${k}" class="${ADM.f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <div class="atable"><div class="arow head"><span class="c-st">الطالب</span><span class="c-ph">الجوال</span><span class="c-n">الأقسام</span><span class="c-n">المحاكي</span><span class="c-dt">آخر دخول</span><span class="c-act">إجراءات</span></div>
      ${list.map(s => `<div class="arow ${s.banned ? 'banned' : ''}" data-e="${esc(s.email)}"><span class="c-st">${avatarHtml(s.avatar, s.display || s.name, 36)}<span class="who"><b>${esc(s.display || s.name || '—')}${s.display && s.display !== s.name ? ` <small class="mut">(${esc(s.name)})</small>` : ''}</b><small>${esc(s.typed || s.email)}${s.user ? ' · @' + esc(s.user) : ''}${s.manual ? ' · <span class="bdg man">➕ من اللوحة</span>' : ''}${s.banned ? ' · <span class="bdg">⛔ محظور</span>' : s.session ? ' · <span class="bdg on">متصل</span>' : ''}</small></span></span><span class="c-ph ltr">${esc(s.phone || '—')}</span><span class="c-n">${s.results}</span><span class="c-n">${s.exams}</span><span class="c-dt">${fmtD(s.lastLogin)}</span><span class="c-act"><button class="btn sm ghost" data-view="${esc(s.email)}">عرض</button>${ADM.role === 'viewer' ? '' : s.banned ? `<button class="btn sm" data-unban="${esc(s.email)}">فك الحظر</button>` : `<button class="btn sm danger" data-ban="${esc(s.email)}">حظر</button>`}</span></div>`).join('') || '<div class="center mut" style="padding:30px">لا نتائج</div>'}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">${list.length} من ${all.length} · الحظر دائم: يمنع دخول الموقع فوراً، ويطرد الجلسة، وخلال دقيقة يتحوّل في الشيت إلى "محظور" مع سحب الوصول لاختبارات الفورمز وملفات المذكرة. ${isOwner() ? 'لإضافة مشتركين استخدم تبويب «➕ المشتركون» أو الشيت، وبيانات طلاب الشيت تتعدّل من الشيت.' : 'لإضافة طالب أو تعديل بياناته استخدم الشيت.'}</p>`;
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
    const st = d.student || {}, pf = d.profile || {}, mb = !d.student && d.member ? d.member : null; const fmtS = x => { const mm = Math.round(x / 60); return mm ? mm + ' د' : x + ' ث'; };
    const byTest = {}; d.exams.forEach(x => { (byTest[x.test] = byTest[x.test] || []).push(x); });
    m.querySelector('.m').innerHTML = `<h3 style="display:flex;align-items:center;gap:10px">${avatarHtml(pf.avatar || st.yt, pf.name || st.name, 44)}<span>${esc(pf.name || st.name || (mb && mb.name) || email)}<small class="mut" style="display:block;font-weight:400;font-size:13px">${esc((mb && mb.typed) || email)}</small></span></h3>
      ${d.ban ? `<div class="sum bad" style="padding:10px 14px;margin-bottom:10px">⛔ محظور منذ ${fmtD(d.ban.at)} بواسطة ${esc(d.ban.by_email)}${d.ban.reason ? ' — ' + esc(d.ban.reason) : ''}</div>` : ''}
      ${mb ? `<div class="sum mbox">➕ مشترك أُضيف من اللوحة بواسطة ${esc((mb.added_by || '').split('@')[0])} · ${fmtD(mb.added_at)}${isOwner() ? ' <button class="lnk" id="a_mrm">حذف الاشتراك</button>' : ''}</div>` : ''}
      <div class="kv"><div><span>${mb ? 'الاسم' : 'الاسم في الشيت'}</span><b>${esc((mb ? mb.name : st.name) || '—')}</b></div><div><span>الجوال</span><b class="ltr">${esc(st.phone || '—')}</b></div><div><span>الجنس</span><b>${esc(st.gender || '—')}</b></div><div><span>يوزر يوتيوب</span><b>${esc(st.user || '—')}</b></div><div><span>الاسم المعروض</span><b>${esc(pf.name || '—')}</b></div><div><span>آخر دخول</span><b>${d.logins[0] ? fmtD(d.logins[0].ts) : 'لم يدخل'}</b></div></div>
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
    const mr = m.querySelector('#a_mrm'); if (mr) mr.onclick = async () => { m.remove(); if (await admMemberRemove(email)) { ADM.list = null; renderAdmin(); } };
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

  // ---------- ➕ المشتركون: المالك يضيف إيميلات تدخل الدورة مباشرة (بدون الشيت) ----------
  const EM_RE = /[^\s,;:<>"'()]+@[^\s,;:<>"'()]+\.[a-z]{2,}/gi;
  function parseMembers(txt) {   // كل سطر: إيميل وبعده الاسم (اختياري) · سطر فيه أكثر من إيميل = كل واحد لحاله
    const items = [], bad = [], seen = new Set();
    String(txt || '').split(/\n/).forEach(line => {
      const l = line.trim(); if (!l) return; const ems = l.match(EM_RE) || [];
      if (!ems.length) { bad.push(l); return; }
      const name = ems.length > 1 ? '' : l.replace(ems[0], '').replace(/^[\s,;:|\-–—]+|[\s,;:|\-–—]+$/g, '').trim().slice(0, 60);
      ems.forEach(e => { const em = e.toLowerCase(); if (seen.has(em)) return; seen.add(em); items.push({ email: em, name }); });
    });
    return { items, bad };
  }
  // ---------- 🆓 الزوار (حسابات مجانية): للمالك — العدد والإيميلات للتسويق ----------
  // 🔎 عمليات «ابحث عن سؤال»: وش يبحث عنه الطلاب، والأسئلة الجديدة اللي ما هي في الدورة
  // كل بحث: سؤال الطالب (صورته أو كلامه) جنب سؤال الدورة اللي طلع له، عشان المالك يقارن بينهم
  const FL_ST = { exact: ['ok', 'موجود بالضبط'], reorder: ['ok', 'موجود · ترتيب الخيارات غير'], wording: ['ok', 'موجود بصياغة ثانية'], opts_same: ['mid', 'خيارات مختلفة · الإجابة نفسها'],
    opts_diff: ['mid', 'خيارات مختلفة · الإجابة غير'], numbers: ['mid', 'أرقام مختلفة'], new: ['no', 'سؤال جديد'], keywords: ['sim', 'كلمات'] };
  const FL_SRC = { img: '📷 رفع صورة', ocr: '📷 بحث بنص الصورة', text: '⌨️ كتب السؤال' };
  const FL_IMG = new Map(), FL_WAIT = []; let flBusy = 0;
  const flPump = () => { while (flBusy < 3 && FL_WAIT.length) { flBusy++; FL_WAIT.shift()(); } };
  const flImg = id => {   // صورة سؤال الطالب من الخادم: مرة وحدة لكل صورة، وثلاث طلبات بالكثير مع بعض
    if (!FL_IMG.has(id)) FL_IMG.set(id, new Promise(res => { FL_WAIT.push(() => admCall({ op: 'adm_find_img', id }).then(r => r.img || '', () => '').then(v => { flBusy--; flPump(); res(v); })); flPump(); }));
    return FL_IMG.get(id);
  };
  const FL_ZI = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.3 15.3 20 20M10.5 7.8v5.4M7.8 10.5h5.4"/></svg>';
  function flZoom(src, from) {   // الصورة بحجمها الكامل فوق الصفحة (Esc أو ✕ أو ضغطة برا الصورة تقفلها)
    const d = document.createElement('div'); d.className = 'fl-lb'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'الصورة بحجمها الكامل');
    d.innerHTML = '<button type="button" class="fl-lbx" aria-label="إغلاق">✕</button>'; const im = new Image(); im.alt = ''; im.src = src; d.appendChild(im);
    const key = e => { if (e.key === 'Escape') close(); };
    const close = () => { d.remove(); document.removeEventListener('keydown', key); document.documentElement.classList.remove('fl-lbo'); if (from && from.isConnected) from.focus(); };
    d.onclick = e => { if (e.target === d || e.target.closest('.fl-lbx')) close(); };
    document.addEventListener('keydown', key); document.documentElement.classList.add('fl-lbo'); document.body.appendChild(d); d.querySelector('.fl-lbx').focus();
  }
  function flShot(src, label, alt, w, h) {   // صورة تنضغط وتكبر
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fl-shot'; b.setAttribute('aria-label', label);
    const im = new Image(); im.alt = alt; if (w && h) { im.width = w; im.height = h; } im.src = src; b.appendChild(im);
    b.insertAdjacentHTML('beforeend', `<span class="zi">${FL_ZI}</span>`); b.onclick = () => flZoom(src, b); return b;
  }
  function flRow(x, byId, Q) {
    const S = FL_ST[x.status] || ['sim', x.status], L = x.ref ? fsLoc(x.ref) : null, pic = x.src === 'img' || x.src === 'ocr';
    const base = x.src === 'ocr' && x.im ? byId.get(x.im) : null, edited = !!base && String(base.q || '').trim() !== String(x.q || '').trim();
    let me;
    if (pic && x.im) {
      const sum = x.src === 'img' ? 'النص اللي قريناه من الصورة' : edited ? 'النص بعد ما عدّله الطالب' : base ? 'نفس النص اللي قريناه من الصورة' : 'النص اللي بحث فيه';
      me = `<div class="fl-shotw" data-im="${+x.im}"><div class="fl-ph"><span class="spin sm"></span>نحمّل صورة الطالب…</div></div>
        <details class="fl-ocr"${edited ? ' open' : ''}><summary>${sum}</summary><p class="fl-q ltr">${esc(x.q)}</p></details>`;
    } else if (pic) me = `<p class="fl-note">${x.src === 'img' ? 'صورة هذا البحث ما انحفظت لأنه قبل تفعيل حفظ الصور. هذا النص اللي قريناه منها:' : 'بحث بالنص اللي قريناه من صورته:'}</p><p class="fl-q fl-txt ltr">${esc(x.q)}</p>`;
    else me = `<p class="fl-q fl-txt ltr">${esc(x.q)}</p>`;
    let crs;
    if (Q && L) {
      const m = String(x.ref).match(/^([qv]\d+):(\d+)$/), isQ = Q.s === 'q', T = s => isQ ? mx(String(s)) : esc(String(s)), o = Q.o || [];
      crs = `<div class="fd-pv ltr" data-img="${isQ && m ? m[1] + ':' + m[2] : ''}">${Q.pt ? `<p class="fd-pt">📄 ${esc(Q.pt)}</p>` : ''}<p>${T(Q.e || Q.a || '')}</p>
          ${o.length ? `<ol class="fd-o">${o.map((v, j) => `<li class="${j === Q.k ? 'k' : ''}"><span class="L">${LETTERS[j]}</span><span>${T(v)}</span></li>`).join('')}</ol>` : ''}</div>
        ${Q.k != null && o[Q.k] != null ? `<p class="fl-ans">الإجابة الصحيحة: <b><bdi dir="ltr">${LETTERS[Q.k]}) ${T(o[Q.k])}</bdi></b></p>` : ''}
        ${m ? `<a class="fl-open" href="#${m[1]}@${m[2]}">افتح السؤال في الدورة ←</a>` : ''}`;
    } else crs = `<div class="fl-none">${x.status === 'keywords' ? 'كتب كلمات بس، فما قارناه بسؤال معيّن.' : 'ما لقينا هذا السؤال في الدورة.'}</div>`;
    if (x.rep && x.rnote) me += `<p class="fl-rnote"><b>ملاحظة الطالب مع البلاغ</b><span dir="auto">${esc(x.rnote)}</span></p>`;
    return `<article class="fl-row${x.rep ? ' rep' : ''}"><div class="fl-h"><span class="fl-st ${S[0]}">${S[1]}</span>${x.rep ? '<span class="fl-rep">🚩 بلاغ</span>' : ''}<span class="fl-src">${FL_SRC[x.src] || FL_SRC.text}</span><small>${arAgo(x.ts)} · ${esc(x.name || x.email)}${x.free ? ' · زائر' : ''}</small></div>
      <div class="fl-cmp"><section class="fl-col"><h4 class="fl-ttl">سؤال الطالب</h4>${me}</section>
        <section class="fl-col fl-crs"><h4 class="fl-ttl">سؤال الدورة${L && Q ? `<span class="fl-loc">${L.t}</span>` : ''}</h4>${crs}</section></div></article>`;
  }
  function flLazy(W) {   // الصور تنحمّل لما توصل لها (صورة الطالب من الخادم، وصورة سؤال الدورة من ملف القسم)
    const load = row => {
      const w = row.querySelector('[data-im]');
      if (w) flImg(+w.dataset.im).then(src => { if (!w.isConnected) return;
        if (src) w.replaceChildren(flShot(src, 'كبّر صورة سؤال الطالب', 'صورة السؤال اللي رفعها الطالب'));
        else w.innerHTML = '<div class="fl-ph off">الصورة ما عادت محفوظة</div>'; });
      const pv = row.querySelector('.fl-crs .fd-pv'), ref = pv && pv.dataset.img;
      if (ref) { const [sid, i] = ref.split(':');
        loadSet(sid).then(set => { const it = set.items && set.items[+i]; if (!it || !it.img || !pv.isConnected) return;
          pv.classList.add('has-img'); pv.prepend(flShot(it.img, 'كبّر صورة سؤال الدورة', 'سؤال الدورة', it.w, it.h)); }).catch(() => {}); }
    };
    const rows = W.querySelectorAll('.fl-row');
    if (!('IntersectionObserver' in window)) { rows.forEach(load); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '600px 0px' });
    rows.forEach(r => io.observe(r));
  }
  async function renderFindLog() {
    document.title = 'البحث عن الأسئلة | Q-Guide';
    let only = lsGet('qg_fl_only', '');
    const draw = async () => {
      app.innerHTML = admTop('find'); bindCtl(); $('#admref').onclick = draw;
      let r; try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } r = await admCall({ op: 'adm_find_log', only, limit: 150 }); }
      catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
      if (location.hash !== '#admin-find') return;
      const c = {}; (r.last30 || []).forEach(x => { c[x.status] = x.n; }); const tot = Object.values(c).reduce((a, x) => a + x, 0);
      const found = (c.exact || 0) + (c.reorder || 0) + (c.wording || 0), near = (c.opts_same || 0) + (c.opts_diff || 0) + (c.numbers || 0);
      const byId = new Map(r.rows.map(x => [x.id, x])), qs = r.qs || {};
      $('#adm').innerHTML = `<div class="fl"><div class="fl-sum"><div><b>${tot}</b><span>بحث في آخر 30 يوم</span></div><div class="ok"><b>${found}</b><span>لقيناها في الدورة</span></div><div class="mid"><b>${near}</b><span>نفسها بأرقام أو خيارات ثانية</span></div><div class="no"><b>${c.new || 0}</b><span>أسئلة جديدة</span></div></div>
        <div class="seg fl-f" role="tablist">${[['', 'كل عمليات البحث'], ['new', 'اللي ما لقيناها بالضبط'], ['rep', `🚩 البلاغات <small>${r.reps || 0}</small>`]].map(([k, t]) => `<button type="button" data-o="${k}" class="${only === k ? 'on' : ''}" aria-selected="${only === k}">${t}</button>`).join('')}</div>
        ${r.rows.length ? `<p class="fl-help mut">${only === 'rep' ? 'أسئلة بحث عنها الطلاب وما لقيناها، وبلّغوا عنها. ' : ''}كل بحث فيه سؤال الطالب مثل ما حطه (صورته أو كلامه)، وجنبه سؤال الدورة اللي طلع له عشان تقارن. اضغط أي صورة تكبر.</p><div class="fl-list">${r.rows.map(x => flRow(x, byId, x.ref && qs[x.ref])).join('')}</div>` : `<div class="sum">${only === 'rep' ? 'ما فيه بلاغات للحين 👌' : only ? 'ما فيه أسئلة جديدة للحين 👌' : 'ما أحد بحث للحين.'}</div>`}</div>`;
      $('#adm').querySelectorAll('.fl-f button').forEach(b => b.onclick = () => { only = b.dataset.o; lsSet('qg_fl_only', only); draw(); });
      flLazy($('#adm'));
    };
    draw();
  }
  async function renderFreeUsers() {
    document.title = 'الزوار | Q-Guide';
    const top = () => { app.innerHTML = admTop('free'); bindCtl(); $('#admref').onclick = () => { ADM.free = null; renderFreeUsers(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } if (!ADM.free) ADM.free = await admCall({ op: 'adm_free_list' }); }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-free') return;
    top(); paintFree();
  }
  // 👀 وش سووا الزوار: مصادرهم وأجهزتهم ومدنهم، وش فتحوا وكم حلوا، ووش حاولوا يفتحون وهو مقفل
  const V_SRC = { TikTok: 'تيك توك', Instagram: 'انستقرام', YouTube: 'يوتيوب', Snapchat: 'سناب شات', X: 'إكس', WhatsApp: 'واتساب', Telegram: 'تيليقرام', Facebook: 'فيسبوك', Google: 'قوقل', Bing: 'بينق' };
  const V_CITY = { Riyadh: 'الرياض', Jeddah: 'جدة', Mecca: 'مكة', Makkah: 'مكة', Medina: 'المدينة', 'Al Madinah': 'المدينة', Dammam: 'الدمام', 'Al Khobar': 'الخبر', Khobar: 'الخبر', Dhahran: 'الظهران',
    Taif: 'الطائف', "Ta'if": 'الطائف', Tabuk: 'تبوك', Buraydah: 'بريدة', Unaizah: 'عنيزة', "Ha'il": 'حائل', Hail: 'حائل', Abha: 'أبها', 'Khamis Mushait': 'خميس مشيط', Jazan: 'جازان', Jizan: 'جازان',
    Najran: 'نجران', Jubail: 'الجبيل', 'Al Jubayl': 'الجبيل', Hofuf: 'الهفوف', 'Al Hufuf': 'الهفوف', 'Al Mubarraz': 'المبرز', 'Al Kharj': 'الخرج', Yanbu: 'ينبع', Qatif: 'القطيف', 'Al Qatif': 'القطيف',
    Sakaka: 'سكاكا', Arar: 'عرعر', 'Al Bahah': 'الباحة', 'Hafar Al-Batin': 'حفر الباطن', "Al Majma'ah": 'المجمعة', 'Az Zulfi': 'الزلفي', 'Ad Dawadimi': 'الدوادمي', 'Ar Rass': 'الرس',
    'Kuwait City': 'الكويت', Dubai: 'دبي', 'Abu Dhabi': 'أبوظبي', Manama: 'المنامة', Doha: 'الدوحة', Muscat: 'مسقط', Cairo: 'القاهرة', Amman: 'عمّان' };
  const V_CC = { SA: 'السعودية', KW: 'الكويت', AE: 'الإمارات', BH: 'البحرين', QA: 'قطر', OM: 'عُمان', EG: 'مصر', JO: 'الأردن', IQ: 'العراق', YE: 'اليمن', US: 'أمريكا', GB: 'بريطانيا' };
  const vSrc = s => !s ? 'مباشر (بدون رابط)' : V_SRC[s] || s;
  const vCity = x => x.city ? (V_CITY[x.city] || x.city) : x.cc ? (V_CC[x.cc] || x.cc) : '';
  const vDev = x => x.os || ({ mobile: 'جوال', desktop: 'كمبيوتر', tablet: 'تابلت' }[x.dev] || '');
  const vDevIc = x => x.dev === 'desktop' ? '💻' : x.dev === 'tablet' ? '📲' : '📱';
  const vMin = s => s < 60 ? 'أقل من دقيقة' : s < 3600 ? Math.round(s / 60) + ' د' : (s / 3600).toFixed(1).replace(/\.0$/, '') + ' س';
  const vCnt = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + few : n + ' ' + many;
  const vTest = id => 'الاختبار المحاكي ' + String(id || '').replace(/^t/, '');
  const vPage = k => ({ home: 'الرئيسية', arena: 'الساحة 1v1', duel: 'تحدي 1v1 برابط', 'board-arena': 'صدارة الساحة', level: 'تحديد المستوى', find: 'صفحة «ابحث عن سؤال»', test: 'صفحة الاختبارات المحاكية' }[k]
    || (/^test:t\d+$/.test(k) ? vTest(k.slice(5)) : /^[qv]\d+$/.test(k) ? SET_NAME(k) : k));
  const vTracked = x => !!(x && x.v !== undefined);
  function visChips(x) {
    if (!x) return '';
    const c = [], add = (t, cls) => c.push(`<span class="vc${cls ? ' ' + cls : ''}">${t}</span>`);
    if (x.dev || x.os) add(`${vDevIc(x)} ${esc(vDev(x))}${vCity(x) ? ' · ' + esc(vCity(x)) : ''}`);
    if (x.src0 || x.src) add('↗ من ' + esc(vSrc(x.src0 || x.src)));
    if (x.v) add('🚪 ' + vCnt(x.v, 'زيارة وحدة', 'زيارتين', 'زيارات', 'زيارة'));
    if (x.s) add('⏱ ' + vMin(x.s));
    if (x.an) add(`✍️ ${vCnt(x.an, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال')} · ${Math.round(x.ac * 100 / x.an)}% صح`);
    if (x.lv) add('🧭 مستواه ' + esc(x.lv.k));
    if (x.ar) add('⚔️ ' + vCnt(x.ar, 'مباراة وحدة', 'مباراتين', 'مباريات', 'مباراة'));
    if (x.ex && x.ex.att) add('🧪 ' + (x.ex.done ? 'خلّص المحاكي' + (x.ex.best != null ? ' · ' + x.ex.best + '%' : '') : 'بدأ المحاكي وما خلّصه'));
    if (Object.keys(x.fd || {}).length) add('🔎 بحث عن سؤال');
    if (x.ai) add('🤖 ' + vCnt(x.ai, 'شرح واحد', 'شرحين', 'شروحات', 'شرح'));
    const lk = Object.keys(x.lk || {}).length; if (lk) add('🔒 حاول يفتح ' + vCnt(lk, 'شي مقفل', 'شيئين مقفلين', 'أشياء مقفلة', 'شي مقفل'), 'lk');
    const sg = Object.keys(x.sg || {}); if (sg.length) add('💬 ضغط ' + sg.map(esc).join(' و'), 'hot');
    else if (Object.keys(x.sb || {}).length) add('⭐ فتح نافذة الاشتراك', 'sb');
    return c.length ? `<div class="vact">${c.join('')}</div>` : '';
  }
  function visInsights(F) {
    const A = F.act || {}, base = F.rows.filter(r => vTracked(A[r.email])), n = base.length;
    const since = F.since ? fmtDay(F.since) : '';
    if (!n) return `<h3 class="sh">وش سووا الزوار</h3><div class="vempty">👀 بدأنا نسجّل نشاط الزوار${since ? ' من ' + esc(since) : ' من اليوم'}. أول ما يدخل زائر يطلع لك هنا من وين جاء، وجهازه ومدينته، ووش فتح، وكم سؤال حل، ووش حاول يفتح وهو مقفل.</div>`;
    const has = f => base.filter(r => f(A[r.email], r)).length;
    const F1 = [['✍️', 'حلّوا أسئلة', has(x => x.an > 0)], ['🧭', 'سووا تحديد المستوى', has(x => x.lv)], ['⚔️', 'لعبوا في الساحة 1v1', has(x => x.ar > 0)],
      ['🧪', 'دخلوا الاختبار المحاكي', has(x => x.ex && x.ex.att > 0)], ['🔎', 'بحثوا عن سؤال', has(x => Object.keys(x.fd).length)], ['🤖', 'استخدموا المساعد الذكي', has(x => x.ai > 0), 1],
      ['🔒', 'حاولوا يفتحون شي مقفل', has(x => Object.keys(x.lk).length)], ['⭐', 'فتحوا نافذة الاشتراك', has(x => Object.keys(x.sb).length)],
      ['💬', 'ضغطوا «اشترك» أو «واتساب»', has(x => Object.keys(x.sg).length), 0, 'hot'], ['🎉', 'اشتركوا', has((x, r) => r.conv), 0, 'ok']].filter(r => !r[3] || r[2]);
    const tally = f => { const m = {}; base.forEach(r => { [].concat(f(A[r.email]) || []).forEach(k => { if (k) m[k] = (m[k] || 0) + 1; }); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const card = (h, L, empty) => { const mx = Math.max(1, ...L.map(x => x[1])); return `<div class="vbc"><h4>${h}</h4>${L.length ? L.slice(0, 6).map(([k, v]) => `<div class="vbr"><span class="vbl">${esc(k)}</span><span class="vbb"><i style="width:${Math.round(v * 100 / mx)}%"></i></span><b>${v}</b></div>`).join('') : `<p class="mut">${empty}</p>`}</div>`; };
    return `<div class="vhd"><h3 class="sh">وش سووا الزوار <small>${n}</small></h3><span class="mut">من ${esc(since || 'اليوم')} · أول ما يدخل الزائر يُسجَّل وش سوّى</span></div>
      <div class="vfun">${F1.map(([ic, t, v, , cls]) => `<div class="vf${cls ? ' ' + cls : ''}"><span class="vfl"><span aria-hidden="true">${ic}</span>${t}</span><span class="vfb"><i style="width:${Math.round(v * 100 / n)}%"></i></span><b>${v} <small>من ${n}</small></b></div>`).join('')}</div>
      <div class="vbreak">${card('↗ من وين جوا', tally(x => vSrc(x.src0 || x.src)), '—')}${card('📱 أجهزتهم', tally(x => vDev(x)), '—')}${card('📍 مدنهم', tally(x => vCity(x)), 'ما وصلتنا مدن للحين')}${card('🔒 وش حاولوا يفتحون', tally(x => Object.keys(x.lk)), 'ما حاول أحد يفتح شي مقفل')}</div>`;
  }
  function paintFree() {
    const W = $('#adm'); if (!W || !ADM.free) return; const F = ADM.free, A = F.act || {}, q = (ADM.fq || '').trim().toLowerCase();
    const list = F.rows.filter(x => !q || [x.email, x.name].some(v => String(v || '').toLowerCase().includes(q)));
    const leads = F.rows.filter(x => !x.conv);
    W.innerHTML = `<div class="stf">
      <div class="fstats"><div><b>${F.total}</b><span>زائر سجّل دخول</span></div><div><b>${F.today}</b><span>اليوم</span></div><div><b>${F.week}</b><span>آخر 7 أيام</span></div><div class="ok"><b>${F.conv}</b><span>اشتركوا بعدها</span></div></div>
      <div class="facts"><button class="btn" id="fcopy" ${leads.length ? '' : 'disabled'}>📋 نسخ إيميلات الزوار (${leads.length})</button><span class="mut">الإيميلات اللي ما اشتركت للحين، كل إيميل في سطر — جاهزة تلصقها في Mailchimp.</span></div>
      ${visInsights(F)}
      <h3 class="sh">آخر الزوار <small>${F.rows.length}</small></h3>
      ${F.rows.length > 8 ? `<div class="abar"><input id="fq" type="search" placeholder="ابحث بالاسم أو الإيميل…" value="${esc(ADM.fq || '')}"></div>` : ''}
      <div class="slist">${list.slice(0, 300).map(x => `<div class="srow vrow"><span class="c-st">${avatarHtml('', x.name || x.email, 40)}<span class="who"><b>${esc(x.name || x.email.split('@')[0])}</b><small class="ltr">${esc(x.email)}</small></span></span>
        <span class="rl">${x.conv ? '<span class="rbdg viewer">✓ اشترك</span>' : '<span class="rbdg wait">زائر</span>'}</span>
        <span class="meta"><small>أول دخول: ${fmtD(x.created_at)}</small><small>آخر دخول: <b>${fmtD(x.last_at)}</b> (${x.logins} مرة)</small></span>
        <span class="c-act"><button type="button" class="btn sm ghost" data-vd="${esc(x.email)}">وش سوّى؟</button></span>${visChips(A[x.email])}</div>`).join('') || `<div class="sempty">${F.rows.length ? 'لا نتائج' : 'ما دخل أي زائر للحين.'}</div>`}</div></div>`;
    $('#fcopy').onclick = async () => { const em = leads.map(x => x.email).join('\n'); try { await navigator.clipboard.writeText(em); toast('انسخت ' + leads.length + ' إيميل ✓'); } catch (e) { QGDlg.alert(em); } };
    const fq = $('#fq'); if (fq) fq.oninput = e => { ADM.fq = e.target.value; const pos = e.target.selectionStart; paintFree(); const i = $('#fq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-vd]').forEach(b => b.onclick = () => visDetail(b.dataset.vd, b));
  }
  // 👀 كل اللي سواه زائر واحد: خط زمني مرتّب بالأيام (الأحدث فوق)
  function visEvItem(e) {
    const k = e.k || '', n = e.n || 0;
    switch (e.t) {
      case 'visit': return { ic: '🚪', tx: 'دخل الموقع' + (k ? ' من ' + vSrc(k) : ''), cls: 'vis' };
      case 'page': return k === 'home' ? null : { ic: '👀', tx: 'فتح ' + vPage(k) };
      case 'lock': return { ic: '🔒', tx: `حاول يفتح «${k}» وهو للمشتركين`, cls: 'lk' };
      case 'sub': return { ic: '⭐', tx: 'فتح نافذة الاشتراك' + (k && k !== 'زر الاشتراك' ? ` (من ${k})` : ''), cls: 'sb' };
      case 'subgo': return { ic: k === 'واتساب' ? '💬' : '▶️', tx: k === 'واتساب' ? 'ضغط «راسلنا على واتساب» عشان يشترك' : 'ضغط «اشترك من يوتيوب»', cls: 'hot' };
      case 'ans': return { ic: '✍️', tx: `حل ${vCnt(n, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال')} في ${/^[qv]\d+$/.test(k) ? SET_NAME(k) : k} (${e.c || 0} صح)`, k, n, c: e.c || 0 };
      case 'level': return { ic: '🧭', tx: `خلّص تحديد المستوى: ${k} (${n}%)`, cls: 'ok' };
      case 'find': return { ic: '🔎', tx: ({ 'لقاه في الدورة': 'بحث عن سؤال ولقاه في الدورة', 'لقى سؤال قريب': 'بحث عن سؤال ولقى سؤال قريب منه', 'ما لقاه في الدورة': 'بحث عن سؤال وما لقاه في الدورة', 'بحث بكلمات': 'بحث بكلمات عن أسئلة' }[k] || 'بحث عن سؤال') + (n ? ' (بصورة)' : '') };
    }
    return null;
  }
  async function visDetail(email, from) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="m vdet"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div>'; document.body.appendChild(m);
    const close = () => { m.remove(); document.removeEventListener('keydown', onK); if (from && from.focus) from.focus({ preventScroll: true }); }, onK = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onK); m.onclick = e => { if (e.target === m) close(); };
    let d; try { d = await admCall({ op: 'adm_free_one', email }); } catch (e) { close(); toast(e.message); return; }
    if (!document.body.contains(m)) return;
    const u = d.user || {}, mt = d.meta || {}, x = (ADM.free && ADM.free.act || {})[email] || {};
    // الأحداث (مع دمج الإجابات المتتالية في نفس القسم ونفس الزيارة)
    const T = [], evs = d.ev.slice().sort((a, b) => b.ts - a.ts);
    evs.forEach(e => { const it = visEvItem(e); if (!it) return; it.ts = e.ts; it.vid = e.vid; it.t = e.t;
      const p = T[T.length - 1];
      if (p && it.t === 'ans' && p.t === 'ans' && p.k === it.k && p.vid === it.vid) { p.n += it.n; p.c += it.c; p.tx = visEvItem({ t: 'ans', k: p.k, n: p.n, c: p.c }).tx; return; }
      if (p && it.t === 'page' && p.t === 'page' && p.tx === it.tx && p.vid === it.vid) return;
      T.push(it); });
    d.logins.forEach(l => T.push({ ts: l.ts, ic: '🔑', tx: 'سجّل دخول' + (l.os || l.dev ? ' من ' + (l.os || { mobile: 'جوال', desktop: 'كمبيوتر', tablet: 'تابلت' }[l.dev] || '') + (l.br && l.br !== l.os ? ' · ' + l.br : '') : '') }));
    d.exams.forEach(t => { if (t.started_at) T.push({ ts: t.started_at, ic: '🧪', tx: `بدأ ${vTest(t.test)}${t.attempt > 1 ? ' (المحاولة ' + t.attempt + ')' : ''}` });
      if (t.done && t.finished_at) T.push({ ts: t.finished_at, ic: '🏁', tx: `خلّص ${vTest(t.test)}: ${t.pct}%${t.vpct != null && t.qpct != null ? ` (اللفظي ${t.vpct}% · الكمي ${t.qpct}%)` : ''}`, cls: 'ok' }); });
    d.arena.forEach(a => T.push({ ts: a.ts, ic: '⚔️', tx: `لعب مباراة 1v1 ضد ${a.op}: ${a.res === 'win' ? 'فاز' : a.res === 'loss' ? 'خسر' : 'تعادل'} (${a.my} مقابل ${a.their})` }));
    d.ai.forEach(a => T.push({ ts: a.ts, ic: '🤖', tx: (a.turn ? 'سأل المساعد عن ' : 'طلب شرح من المساعد لـ ') + aiRefLabel(a.ref) }));
    T.sort((a, b) => b.ts - a.ts);
    const days = []; T.slice(0, 250).forEach(it => { const dk = fmtDay(it.ts); let g = days[days.length - 1]; if (!g || g.k !== dk) days.push(g = { k: dk, L: [] }); g.L.push(it); });
    const lastAt = Math.max(mt.last_at || 0, u.last_at || 0), pre = !evs.length;
    m.querySelector('.m').innerHTML = `<h3 class="vdh">${avatarHtml('', u.name || email, 44)}<span>${esc(u.name || email.split('@')[0])}<small class="mut ltr">${esc(email)}</small></span>${u.conv ? '<span class="rbdg viewer">✓ اشترك</span>' : ''}</h3>
      <div class="kv"><div><span>أول دخول</span><b>${fmtD(u.created_at)}</b></div><div><span>آخر نشاط</span><b>${fmtD(lastAt)}</b></div>
        <div><span>الزيارات</span><b>${mt.visits || u.logins || 0}</b></div><div><span>الوقت على الموقع</span><b>${mt.secs ? vMin(mt.secs) : '—'}</b></div>
        <div><span>الجهاز</span><b>${x.dev || x.os ? vDevIc(x) + ' ' + esc(vDev(x)) + (x.br && x.br !== x.os ? ' · ' + esc(x.br) : '') : '—'}</b></div><div><span>المدينة</span><b>${esc(vCity(x)) || '—'}</b></div>
        <div><span>جاء من</span><b>${x.src0 || x.src || vTracked(x) ? esc(vSrc(x.src0 || x.src)) : '—'}</b></div><div><span>الأسئلة</span><b>${x.an ? `${vCnt(x.an, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال')} · ${Math.round(x.ac * 100 / x.an)}% صح` : '—'}</b></div></div>
      ${pre ? `<p class="vnote">دخل قبل ما نبدأ نسجّل النشاط، فيطلع لك بس دخوله ومبارياته واختباراته. وأي شي يسويه من الحين يُسجَّل هنا.</p>` : ''}
      <h4>🕒 وش سوّى</h4>
      <div class="vtl">${days.length ? days.map(g => `<div class="vday"><div class="vdk">${esc(g.k)}</div>${g.L.map(it => `<div class="vti${it.cls ? ' ' + it.cls : ''}"><span class="vtt">${fmtTime(it.ts)}</span><span class="vtc" aria-hidden="true">${it.ic}</span><span class="vtx">${esc(it.tx)}</span></div>`).join('')}</div>`).join('') : '<p class="mut">ما فيه نشاط مسجّل.</p>'}</div>
      <div class="acts" style="justify-content:flex-end"><button class="btn sm ghost" id="v_close">إغلاق</button></div>`;
    m.querySelector('#v_close').onclick = close; m.querySelector('#v_close').focus({ preventScroll: true });
  }
  // ---------- 🤖 المساعد الذكي: للمالك — التشغيل والحدود وآخر الشروحات وبلاغات الطلاب ----------
  const AI_MODE = { off: ['⏸ متوقف', 'ما يظهر زر «اشرح لي» لأحد'], owner: ['🧪 تجربة', 'يظهر لك وللمشرفين بس'], on: ['✅ مفتوح للجميع', 'المشتركين والزوار حسب الحد اليومي'] };
  async function renderAiAdmin() {
    document.title = 'المساعد الذكي | Q-Guide';
    const top = () => { app.innerHTML = admTop('ai'); bindCtl(); $('#admref').onclick = () => { ADM.ai = null; renderAiAdmin(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } if (!ADM.ai) ADM.ai = await admCall({ op: 'adm_ai', flagged: !!ADM.aiF }); }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-ai') return;
    top(); paintAi();
  }
  function aiRefLabel(ref) {
    let m = ref.match(/^q(\d+):(\d+)$/); if (m) return `الكمي · القسم ${m[1]} · سؤال ${+m[2] + 1}`;
    m = ref.match(/^v(\d+):(\d+)$/); if (m) return `اللفظي · النموذج ${m[1]} · سؤال ${+m[2] + 1}`;
    m = ref.match(/^t(\d+):(\d):(\d+)$/); if (m) return `المحاكي ${m[1]} · القسم ${m[2]} · سؤال ${+m[3] + 1}`;
    return ref;
  }
  // 💬 السجل كمحادثات: رسائل الطالب على نفس السؤال ورا بعض (المحادثة الجديدة تبدأ لما يرجع الشرح الأول)
  const AI_IT = { vague: 'ما فهم ويبي شرح أبسط', rule: 'يبي القاعدة اللي يحفظها', step: 'يسأل عن خطوة في الحل', diff: 'يقارن بين خيارين', example: 'يبي مثال مشابه', fast: 'يبي طريقة أسرع', meaning: 'يسأل عن معنى كلمة', key: 'يشك في الإجابة المعتمدة', mine: 'يسأل ليش إجابته غلط', opt: 'يسأل عن خيار معيّن', ack: 'رد بكلمة قصيرة (فهم أو شكر)' };
  function aiConvs(logs) {
    const open = new Map(), out = [];
    for (const l of logs.slice().sort((a, b) => a.id - b.id)) {
      const k = l.email + '|' + l.ref; let c = open.get(k);
      if (!c || l.turn <= c.turn || l.ts - c.last > 12 * 3600e3) { c = { ref: l.ref, who: l.who, msgs: [], turn: 0, last: 0 }; open.set(k, c); out.push(c); }
      c.msgs.push(l); c.turn = l.turn; c.last = l.ts;
    }
    return out.sort((a, b) => b.last - a.last);
  }
  const nReply = n => n === 1 ? 'رد واحد' : n === 2 ? 'ردّين' : n <= 10 ? n + ' ردود' : n + ' رد';
  function aiConvHtml(c, Q, open) {
    const fl = c.msgs.some(m => m.flag), asks = c.msgs.filter(m => m.turn > 1), last = asks.length ? asks[asks.length - 1].q : '';
    const pk = (c.msgs.find(m => m.pk != null) || {}).pk, mref = c.ref.match(/^([qv]\d+):(\d+)$/);
    const qbox = Q ? `<div class="cvq">${Q.p ? `<div class="cvp">📄 القطعة: ${esc(Q.p)}</div>` : ''}<div class="cvs" dir="ltr">${esc(Q.e || Q.a)}</div>${Q.f ? '<small class="mut">السؤال فيه رسم أو جدول</small>' : ''}
      <ol class="cvo" dir="ltr">${Q.o.map((o, i) => `<li class="${i === Q.k ? 'k' : i === pk ? 'w' : ''}"><b>${LETTERS[i]}</b> ${esc(o)}${i === Q.k ? ' <span dir="rtl">✓ الصحيحة</span>' : i === pk ? ' <span dir="rtl">✗ اختيار الطالب</span>' : ''}</li>`).join('')}</ol></div>` : '';
    const msg = m => (m.turn > 1
      ? `<div class="cvm u"><span class="cvl">🧑‍🎓 الطالب كتب</span><p>${esc(m.q)}</p>${AI_IT[m.it] ? `<small class="cvit">🧭 فهم المساعد إنه ${AI_IT[m.it]}</small>` : ''}</div>`
      : `<div class="cvm u sys"><span class="cvl">🧑‍🎓 الطالب</span><p>ضغط «اشرح لي أكثر»${m.pk != null && Q ? (m.pk === Q.k ? ' بعد ما جاوب صح' : ` بعد ما اختار ${LETTERS[m.pk]} وهي خطأ`) : ''}</p></div>`)
      + `<div class="cvm a${m.flag ? ' fl' : ''}"><span class="cvl">🤖 المساعد ردّ</span><div class="aian">${window.QGAI ? QGAI.render(m.a) : esc(m.a)}</div>
        <div class="cvmeta"><span dir="ltr">${esc(String(m.model || '').split('/').pop())}</span><span>${(m.ms / 1000).toFixed(1)} ث</span><span>${fmtD(m.ts)}</span>${m.flag ? '<b class="cvfl">🚩 الطالب بلّغ إن هذا الرد فيه غلط</b>' : ''}</div></div>`;
    return `<details class="ailg aicv${fl ? ' fl' : ''}"${open ? ' open' : ''}><summary><span class="who"><b>${esc(c.who)}</b><small>${fmtD(c.last)}</small></span><span class="ref">${esc(aiRefLabel(c.ref))}</span><span class="fq${last ? '' : ' first'}">${last ? `«${esc(last)}»` : 'طلب شرح بس'}</span><span class="cvn">${nReply(c.msgs.length)}</span>${fl ? '<span class="rbdg flg">🚩 بلاغ</span>' : ''}</summary>
      <div class="cvb">${qbox}<div class="cvth">${c.msgs[0].turn > 1 ? '<div class="cvcut">… أول المحادثة أقدم من آخر السجل</div>' : ''}${c.msgs.map(msg).join('')}</div>${mref ? `<div class="cvact"><a href="#${mref[1]}@${mref[2]}">افتح السؤال في الدورة ←</a></div>` : ''}</div></details>`;
  }
  function paintAi() {
    const W = $('#adm'); if (!W || !ADM.ai) return; const A = ADM.ai, S = A.set, convs = aiConvs(A.logs || []);
    const nr = A.today.nr || 0, usd = Math.max(0, nr - 10000) * 0.011 / 1000;   // Cloudflare: أول 10,000 وحدة يومياً مجانية، وبعدها 0.011$ لكل 1000 وحدة
    W.innerHTML = `<div class="stf aiadm">
      ${A.on ? '' : '<div class="sum warn">⚠️ ربط الذكاء الاصطناعي (Workers AI) ما هو مفعّل في الخادم.</div>'}
      <div class="fstats"><div><b>${A.today.n}</b><span>شرح اليوم</span></div><div><b>${A.today.u}</b><span>طالب استخدمه اليوم</span></div><div><b>${A.week.n}</b><span>شرح آخر 7 أيام</span></div><div class="${A.flagged ? 'bad' : ''}"><b>${A.flagged}</b><span>بلاغ «الشرح فيه غلط»</span></div></div>
      <p class="aicost">استهلاك اليوم: <b dir="ltr">${nr.toLocaleString('en')}</b> وحدة من <span dir="ltr">10,000</span> مجانية يومياً${usd > 0 ? ` · التكلفة الزائدة <b dir="ltr">$${usd.toFixed(2)}</b> <small>(حوالي ${(usd * 3.75).toFixed(2)} ريال)</small>` : ' <small>(ما فيه تكلفة زائدة)</small>'}</p>
      <section class="aiset"><h3 class="sh">الإعدادات</h3>
        <div class="aimode" role="radiogroup" aria-label="حالة المساعد">${Object.entries(AI_MODE).map(([k, [t, d]]) => `<label class="${S.mode === k ? 'on' : ''}"><input type="radio" name="aimode" value="${k}" ${S.mode === k ? 'checked' : ''}><b>${t}</b><small>${d}</small></label>`).join('')}</div>
        <div class="airow"><label><span>شروحات المشترك في اليوم</span><input type="number" id="aipaid" min="0" max="200" inputmode="numeric" value="${S.paid}"></label><label><span>شروحات الزائر في اليوم</span><input type="number" id="aifree" min="0" max="50" inputmode="numeric" value="${S.free}"></label><label><span>النموذج</span><select id="aimodel">${Object.entries(A.models).map(([k, v]) => `<option value="${k}" ${k === S.model ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
        <div class="aiact"><button class="btn" id="aisave">حفظ الإعدادات</button><span class="mut">الشرح الأول للسؤال ينحسب من رصيد الطالب، وأسئلة المتابعة على نفس السؤال (لين ${esc(String(S.follow))}) ما تنحسب.</span></div></section>
      <div class="aihd"><h3 class="sh">محادثات الطلاب مع المساعد <small>${convs.length}</small></h3><label class="aiflt"><input type="checkbox" id="aiflg" ${ADM.aiF ? 'checked' : ''}> اللي فيها بلاغ بس</label></div>
      <p class="aihelp mut">كل محادثة فيها السؤال نفسه، ووش كتب الطالب، ووش رد عليه المساعد بالترتيب.</p>
      <div class="ailog">${convs.map(c => aiConvHtml(c, A.qs && A.qs[c.ref], !!ADM.aiF)).join('') || `<div class="sempty">${ADM.aiF ? 'ما فيه بلاغات 👍' : 'ما استخدم أحد المساعد للحين.'}</div>`}</div></div>`;
    W.querySelectorAll('input[name=aimode]').forEach(r => r.onchange = () => W.querySelectorAll('.aimode label').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)));
    $('#aisave').onclick = async e => { const b = e.currentTarget; b.disabled = true;
      try { const mode = (W.querySelector('input[name=aimode]:checked') || {}).value; ADM.ai = await admCall({ op: 'adm_ai_set', flagged: !!ADM.aiF, set: { mode, paid: +$('#aipaid').value, free: +$('#aifree').value, model: $('#aimodel').value } });
        if (window.QGAI) QGAI.status(true); paintAi(); toast('انحفظت إعدادات المساعد ✓'); } catch (er) { toast(er.message); b.disabled = false; } };
    $('#aiflg').onchange = e => { ADM.aiF = e.target.checked; ADM.ai = null; renderAiAdmin(); };
  }
  // ---------- 💳 نوع الاشتراك: ▶️ يوتيوب · 🎁 مجاني · 🏦 تحويل بنكي ----------
  // المجاني والتحويل ما يشوفون مقاطع الأعضاء: أزرار يوتيوب في الموقع تفتح لهم النسخ الخاصة، وتشتغل إذا المالك شاركها مع إيميلهم
  const SUB_N = { yt: ['▶️', 'يوتيوب'], free: ['🎁', 'مجاني'], bank: ['🏦', 'تحويل بنكي'] };
  // ---------- 📝 التسجيلات (فورم الشيت): تأكيد أو رفض بضغطة — القرار يوصل الشيت خلال دقيقة والشيت يكمّل الباقي ----------
  const regNeed = x => x.status === 'wait' && !x.act;                    // ينتظر قرارك
  const regPending = x => x.status !== 'ok' && x.act && !x.applied;      // قرارك ينتظر الشيت
  const regFinishing = x => x.act === 'confirm' && x.applied && x.status !== 'ok';   // الشيت يكمّل التأكيد
  function regTabLabel() { const n = ADM.regs ? ADM.regs.filter(regNeed).length : 0; return '📝 التسجيلات' + (n ? ` <small class="red" title="بانتظار تأكيدك">${n}</small>` : ''); }
  function refreshRegTab() { const a = document.querySelector('.atabs a[href="#admin-regs"]'); if (a) a.innerHTML = regTabLabel(); }
  async function admLoadRegs() { const r = await admCall({ op: 'adm_regs' }); ADM.regs = r.rows || []; ADM.regsSync = r.sync || null; ADM.regsAt = Date.now(); refreshRegTab(); return r; }
  function regsSoon() { if (!isOwner() || (ADM.regs && Date.now() - ADM.regsAt < 60000)) return; ADM.regsAt = Date.now(); admLoadRegs().catch(() => {}); }   // عدّاد التبويب في كل صفحات اللوحة
  let regsT = 0;
  function regsPoll() {   // تحديث تلقائي وأنت على التبويب: كل 15 ثانية لو فيه قرار ينتظر الشيت، وإلا كل دقيقة
    clearTimeout(regsT); if (location.hash !== '#admin-regs') return;
    const busy = (ADM.regs || []).some(x => regPending(x) || regFinishing(x));
    regsT = setTimeout(async () => { if (location.hash !== '#admin-regs') return; try { await admLoadRegs(); if (!document.querySelector('#adm .rgact:focus-within')) paintRegs(); } catch (e) {} regsPoll(); }, busy ? 15000 : 60000);
  }
  async function renderRegs() {
    document.title = 'التسجيلات | Q-Guide';
    const top = () => { app.innerHTML = admTop('regs'); bindCtl(); $('#admref').onclick = () => { ADM.regs = null; renderRegs(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } if (!ADM.regs) await admLoadRegs(); }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-regs') return;
    top(); paintRegs(); regsPoll();
  }
  function paintRegs() {
    const W = $('#adm'); if (!W || !ADM.regs) return;
    const all = ADM.regs, f = ADM.rf, q = ADM.rq.trim().toLowerCase();
    const n = { wait: all.filter(x => x.status === 'wait').length, dup: all.filter(x => x.status === 'dup').length, ok: all.filter(x => x.status === 'ok').length, exp: all.filter(x => x.status === 'exp').length };
    const need = all.filter(regNeed).length;
    let list = all.filter(x => x.status === f && (!q || [x.name, x.email, x.phone, x.raw, x.user, x.school].some(v => String(v || '').toLowerCase().includes(q))));
    const rank = x => regNeed(x) ? 0 : regPending(x) || regFinishing(x) ? 1 : 2;
    list.sort((a, b) => rank(a) - rank(b) || (f === 'ok' ? (b.ca || 0) - (a.ca || 0) : (b.ts || 0) - (a.ts || 0)));
    const nm = x => x.name || (x.email ? x.email.split('@')[0] : '') || 'بدون اسم';
    const S = ADM.regsSync, age = S ? (Date.now() - S.at) / 60000 : 1e9;
    const sync = !S ? '<div class="rgsync warn">⚠️ الشيت ما أرسل الطلبات للحين. افتح الشيت مرة، وتأكد إن «☁️ مزامنة الموقع» مفعّلة.</div>'
      : age > 5 ? `<div class="rgsync warn">⚠️ آخر مزامنة مع الشيت ${fmtD(S.at)}. قراراتك توصل الشيت أول ما ترجع المزامنة.</div>`
      : `<div class="rgsync">🔄 متزامن مع الشيت · آخر تحديث ${fmtD(S.at)}</div>`;
    const tile = (k, ic, b, t, cls) => `<button type="button" class="sbt ${k}${f === k ? ' on' : ''}${cls ? ' ' + cls : ''}" data-rf="${k}" aria-pressed="${f === k}"><span class="i" aria-hidden="true">${ic}</span><b>${b}</b><span>${t}</span></button>`;
    const tsel = x => ADM.rt[x.key] || x.act_t || (/تليقرام|تحويل|بنك/.test(x.src || '') ? 'bank' : 'yt');
    const chips = x => String(x.note || '').split('|').map(v => v.trim()).filter(v => v && !/^(تأكيد يدوي|✅ من الموقع|✕ رفض من الموقع)$/.test(v)).map(v => `<span class="rgchip">${esc(v)}</span>`).join('');
    const side = x => {
      if (x.status === 'ok') return `<span class="rgdone">✅ تأكد ${x.ca ? fmtD(x.ca) : ''}${x.act === 'confirm' ? ' · من الموقع' : ''}</span>`;
      if (regPending(x)) return `<span class="rgwait">${x.act === 'confirm' ? `⏳ يتأكد خلال دقيقة · ${SUB_N[x.act_t || 'yt'][0]} ${SUB_N[x.act_t || 'yt'][1]}` : '⏳ ينرفض خلال دقيقة'}</span><button type="button" class="lnk" data-undo>تراجع</button>`;
      if (regFinishing(x)) return '<span class="rgwait">⏳ الشيت يكمّل التأكيد…</span>';
      const t = tsel(x);
      return `<span class="sbseg" role="radiogroup" aria-label="نوع اشتراك ${esc(nm(x))}">${['yt', 'bank', 'free'].map(k => `<button type="button" role="radio" data-t="${k}" class="${t === k ? 'on ' + k : ''}" aria-checked="${t === k}">${SUB_N[k][0]} ${k === 'bank' ? 'تحويل' : SUB_N[k][1]}</button>`).join('')}</span>
        <span class="rgbtns"><button type="button" class="btn sm" data-ok>✅ تأكيد</button>${x.status === 'exp' ? '' : '<button type="button" class="btn sm ghost" data-no>✕ رفض</button>'}</span>`;
    };
    const why = x => x.status === 'dup' ? '<small class="rgwhy">🔁 اليوزر هذا مستخدم في طلب مؤكد قبل. لو هو نفس الطالب بإيميل جديد أكّده.</small>'
      : x.status === 'exp' ? `<small class="rgwhy">${x.act === 'reject' ? '✕ رفضته' : '⌛ مر عليه 14 يوم بدون تأكيد'}. تقدر تأكده الحين لو تبي.</small>` : '';
    const row = x => `<div class="srow rgrow${regNeed(x) ? ' need' : ''}" data-k="${esc(x.key)}">
      <span class="c-st">${avatarHtml('', nm(x), 40)}<span class="who"><b>${esc(nm(x))}</b><small class="ltr">${esc(x.email || 'بدون إيميل')}</small>
        <small class="rgmeta">${[x.phone ? `<a href="https://wa.me/${esc(String(x.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener" dir="ltr">📱 ${esc(x.phone)}</a>` : '', x.user ? `<a href="https://www.youtube.com/@${encodeURIComponent(x.user)}" target="_blank" rel="noopener" dir="ltr" title="افتح قناته في يوتيوب">▶️ @${esc(x.raw ? String(x.raw).replace(/^@/, '') : x.user)}</a>` : '<span class="rgbad">بدون يوزر يوتيوب</span>', x.gender ? esc(x.gender) : '', x.school ? esc(x.school) : '', 'سجّل ' + fmtD(x.ts)].filter(Boolean).join(' · ')}</small>
        ${chips(x) ? `<span class="rgchips">${chips(x)}</span>` : ''}${why(x)}</span></span>
      <span class="rgact">${side(x)}</span></div>`;
    W.innerHTML = `<div class="stf regs">
      ${sync}
      <div class="sbtiles">${tile('wait', '⏳', n.wait, 'بانتظار التأكيد', need ? 'warn' : '')}${tile('dup', '🔁', n.dup, 'مكرر')}${tile('ok', '✅', n.ok, 'تأكدوا آخر 7 أيام')}${tile('exp', '⌛', n.exp, 'منتهي أو مرفوض')}</div>
      <p class="sbhelp">هذي طلبات فورم «المقدمة». اختر نوع اشتراكه واضغط «تأكيد»: الشيت يأكده خلال دقيقة ويكمّل لحاله (إيميل التأكيد، فتح الاختبارات، ملف المرشد)، وبعدها يدخل الموقع. لو اخترت تحويل أو مجاني، المقاطع الخاصة تنشارك معه تلقائياً.</p>
      <div class="abar"><input id="rgq" type="search" placeholder="ابحث بالاسم أو الإيميل أو الجوال أو اليوزر…" value="${esc(ADM.rq)}"><a class="btn sm ghost" href="${SHEET_URL}" target="_blank" rel="noopener">📊 افتح الشيت</a></div>
      <div class="slist">${list.length ? list.map(row).join('') : `<div class="sempty">${q ? 'لا نتائج' : f === 'wait' ? 'ما فيه طلبات تنتظرك 👍' : 'ما فيه طلبات هنا'}</div>`}</div>
      <p class="mut sbnote">«بانتظار التأكيد» = يوزره ما طلع في قائمة أعضاء القناة. افتح قناته وتأكد إنه عضو، أو اختر تحويل أو مجاني. الطلب اللي ما يتأكد خلال 14 يوم يروح «منتهي».</p></div>`;
    W.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { ADM.rf = b.dataset.rf; paintRegs(); });
    $('#rgq').oninput = e => { ADM.rq = e.target.value; const pos = e.target.selectionStart; paintRegs(); const i = $('#rgq'); i.focus(); i.setSelectionRange(pos, pos); };
    const send = async (x, body, patch, msg) => {
      const undo = { act: x.act, act_t: x.act_t, applied: x.applied }; Object.assign(x, patch); paintRegs(); refreshRegTab();
      try { await admCall(Object.assign({ op: 'adm_reg_act', key: x.key }, body)); toast(msg); if (body.act === 'confirm' && body.t !== 'yt') ADM.subs = null; regsPoll(); }
      catch (e) { Object.assign(x, undo); paintRegs(); refreshRegTab(); toast('ما انحفظ: ' + e.message); }
    };
    W.querySelectorAll('.rgrow').forEach(r => { const x = all.find(y => y.key === r.dataset.k); if (!x) return;
      r.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { ADM.rt[x.key] = b.dataset.t; paintRegs(); const nb = W.querySelector(`.rgrow[data-k="${CSS.escape(x.key)}"] [data-t="${b.dataset.t}"]`); if (nb) nb.focus(); });
      const ok = r.querySelector('[data-ok]'); if (ok) ok.onclick = () => { const t = tsel(x); send(x, { act: 'confirm', t }, { act: 'confirm', act_t: t, applied: 0 }, `✓ ${nm(x)}: يتأكد خلال دقيقة ويوصله إيميل التأكيد`); };
      const no = r.querySelector('[data-no]'); if (no) no.onclick = async () => { if (await QGDlg.confirm(`رفض طلب ${nm(x)}؟ ما يوصله شي، وتقدر تأكده بعدين من «⌛ منتهي أو مرفوض».`, { ok: 'رفض', danger: true })) send(x, { act: 'reject' }, { act: 'reject', act_t: null, applied: 0 }, `${nm(x)}: انرفض الطلب`); };
      const un = r.querySelector('[data-undo]'); if (un) un.onclick = () => send(x, { act: 'undo' }, { act: null, act_t: null, applied: 0 }, 'تم التراجع ↩︎'); });
  }
  async function renderSubs() {
    document.title = 'نوع الاشتراك | Q-Guide';
    const top = () => { app.innerHTML = admTop('subs'); bindCtl(); $('#admref').onclick = () => { ADM.subs = null; renderSubs(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } if (!ADM.subs) { const r = await admCall({ op: 'adm_subs' }); ADM.subs = r.rows; ADM.share = r.share || null; } }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-subs') return;
    top(); paintSubs();
  }
  function paintSubs() {
    const W = $('#adm'); if (!W || !ADM.subs) return;
    const all = ADM.subs, f = ADM.sf, q = ADM.sq.trim().toLowerCase(), alt = x => x.t !== 'yt', need = x => alt(x) && !x.sh;
    const n = { yt: all.filter(x => x.t === 'yt').length, free: all.filter(x => x.t === 'free').length, bank: all.filter(x => x.t === 'bank').length, need: all.filter(need).length };
    let list = all.filter(x => !q || [x.name, x.display, x.email, x.typed, x.user].some(v => String(v || '').toLowerCase().includes(q)));
    if (f === 'need') list = list.filter(need); else if (f !== 'all') list = list.filter(x => x.t === f);
    const rank = x => need(x) ? 0 : alt(x) ? 1 : 2;
    list.sort((a, b) => rank(a) - rank(b) || (b.last || 0) - (a.last || 0));
    const nm = x => x.display || x.name || x.email.split('@')[0];
    // 🔁 آخر تشغيل للمشاركة التلقائية (كل مقطع ينسجّل لحاله؛ التشغيل الواحد = آخر 30 دقيقة)
    const SH = ADM.share || {}, runs = SH.runs || [], tot = SH.total || 27, last = runs[0], nMaq = k => k === 1 ? 'مقطع واحد' : k === 2 ? 'مقطعين' : k <= 10 ? k + ' مقاطع' : k + ' مقطع';
    let shareLine = '<div class="rgsync">🔁 المشاركة التلقائية جاهزة، وتبدأ مع أول تشغيل للمهمة في جهازك.</div>';
    if (last) { const cur = runs.filter(r => r.at >= last.at - 30 * 60e3), okN = cur.filter(r => r.ok).length, bad = cur.find(r => !r.ok);
      shareLine = bad ? `<div class="rgsync warn">⚠️ آخر مشاركة ${fmtD(last.at)}: يوتيوب رفض «${esc(bad.label || bad.video)}»${bad.note ? ` (${esc(bad.note)})` : ''}. يعيد المحاولة في التشغيل الجاي.</div>`
        : `<div class="rgsync">🔁 آخر مشاركة تلقائية ${fmtD(last.at)} · ${nMaq(okN)}</div>`; }
    const tile = (k, ic, b, t, cls) => `<button type="button" class="sbt ${k}${f === k ? ' on' : ''}${cls ? ' ' + cls : ''}" data-sf="${k}" aria-pressed="${f === k}"><span class="i" aria-hidden="true">${ic}</span><b>${b}</b><span>${t}</span></button>`;
    const row = x => `<div class="srow sbrow" data-e="${esc(x.email)}">
      <span class="c-st">${avatarHtml(x.avatar, nm(x), 40)}<span class="who"><b>${esc(nm(x))}</b><small class="ltr">${esc(x.typed || x.email)}${x.user ? ' · @' + esc(x.user) : ''}</small><small>${x.src === 'panel' ? '➕ أضفته من اللوحة' : '📊 من الشيت'} · آخر دخول ${x.last ? fmtD(x.last) : '—'}</small></span></span>
      <span class="sbseg" role="radiogroup" aria-label="نوع اشتراك ${esc(nm(x))}">${['yt', 'free', 'bank'].map(t => `<button type="button" role="radio" data-t="${t}" class="${x.t === t ? 'on ' + t : ''}" aria-checked="${x.t === t}">${SUB_N[t][0]} ${SUB_N[t][1]}</button>`).join('')}</span>
      <span class="sbsh">${alt(x) ? `<label class="sbsw${x.sh ? ' on' : ''}"><input type="checkbox" data-sh${x.sh ? ' checked' : ''}><span>${x.sh ? '✓ المقاطع مشاركة معه' : `⏳ بتنشارك تلقائياً${x.shn ? ` · ${x.shn}/${tot}` : ''}`}</span></label>` : '<small class="mut">تفتح له مقاطع الأعضاء في القناة</small>'}</span></div>`;
    W.innerHTML = `<div class="stf subs">
      <div class="sbtiles">${tile('yt', '▶️', n.yt, 'مشتركين عن طريق يوتيوب')}${tile('free', '🎁', n.free, 'اشتراك مجاني')}${tile('bank', '🏦', n.bank, 'تحويل بنكي')}${tile('need', '⏳', n.need, 'بطابور المشاركة التلقائية')}</div>
      ${shareLine}
      <p class="sbhelp">المجاني والتحويل البنكي: أزرار يوتيوب في الموقع تفتح لهم النسخ الخاصة من المقاطع. المشاركة صارت تلقائية: مهمة في جهازك تشارك النسخ مع أي طالب جديد هنا كل 4 ساعات (لازم يكون جهازك شغّال وتطبيق Claude مفتوح). مشترك يوتيوب تفتح له مقاطع الأعضاء.</p>
      <div class="abar"><input id="sbq" type="search" placeholder="ابحث بالاسم أو الإيميل أو اليوزر…" value="${esc(ADM.sq)}">${f !== 'all' ? `<button type="button" class="btn sm ghost" id="sball">عرض الكل (${all.length})</button>` : ''}</div>
      ${f === 'need' && n.need ? `<div class="sbcopy"><button type="button" class="btn sm" id="sbcp">📋 انسخ إيميلاتهم (${n.need})</button><span>تنشارك تلقائياً. لو تبي تشاركها بنفسك الحين، الصقها في «المشاركة الخاصة» لكل مقطع وعلّم عليهم هنا.</span></div>` : ''}
      <div class="slist">${list.length ? list.map(row).join('') : `<div class="sempty">${q ? 'لا نتائج' : f === 'need' ? 'كل المجانيين والتحويل المقاطع مشاركة معهم 👍' : 'ما فيه طلاب هنا'}</div>`}</div>
      <p class="mut sbnote">الطالب الجديد من الشيت يطلع «يوتيوب»، واللي تضيفه من «➕ المشتركون» يطلع بالنوع اللي تختاره هناك. تقدر تغيّر أي طالب من هنا، ويتغيّر عنده خلال دقائق.</p></div>`;
    W.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { ADM.sf = ADM.sf === b.dataset.sf ? 'all' : b.dataset.sf; paintSubs(); });
    const ab = $('#sball'); if (ab) ab.onclick = () => { ADM.sf = 'all'; paintSubs(); };
    $('#sbq').oninput = e => { ADM.sq = e.target.value; const pos = e.target.selectionStart; paintSubs(); const i = $('#sbq'); i.focus(); i.setSelectionRange(pos, pos); };
    const cp = $('#sbcp'); if (cp) cp.onclick = async () => { const em = all.filter(need).map(x => x.typed || x.email).join(', ');
      try { await navigator.clipboard.writeText(em); toast(`انسخت ${n.need === 1 ? 'إيميل واحد' : n.need === 2 ? 'إيميلين' : n.need + ' إيميلات'} ✓`); } catch (e) { await QGDlg.prompt('انسخ الإيميلات:', em, { ok: 'تم' }); } };
    const save = async (x, patch, undo, msg) => { Object.assign(x, patch); paintSubs(); refreshSubTab();
      try { await admCall(Object.assign({ op: 'adm_sub_set', email: x.email }, patch)); toast(msg); } catch (e) { Object.assign(x, undo); paintSubs(); refreshSubTab(); toast('ما انحفظ: ' + e.message); } };
    W.querySelectorAll('.sbrow').forEach(r => { const x = all.find(y => y.email === r.dataset.e); if (!x) return;
      r.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; if (t === x.t) return; save(x, { t }, { t: x.t }, `${nm(x)}: ${SUB_N[t][0]} ${SUB_N[t][1]} ✓`); });
      const sh = r.querySelector('[data-sh]'); if (sh) sh.onchange = () => save(x, { sh: sh.checked ? 1 : 0 }, { sh: x.sh }, sh.checked ? 'علّمته إن المقاطع مشاركة معه ✓' : 'رجع لطابور المشاركة التلقائية'); });
  }
  function refreshSubTab() {   // عدّاد «ما شاركت المقاطع معهم» في شريط التبويبات
    const a = document.querySelector('.atabs a[href="#admin-subs"]'); if (!a || !ADM.subs) return; const n = ADM.subs.filter(x => x.t !== 'yt' && !x.sh).length;
    a.innerHTML = '💳 نوع الاشتراك' + (n ? ` <small title="بطابور المشاركة التلقائية">${n}</small>` : '');
  }
  async function renderMembers() {
    document.title = 'المشتركون | Q-Guide';
    const top = () => { app.innerHTML = admTop('members'); bindCtl(); $('#admref').onclick = () => { ADM.members = null; renderMembers(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; } if (!ADM.members) ADM.members = (await admCall({ op: 'adm_members_list' })).members; }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-members') return;
    top(); paintMembers();
  }
  async function admMemberRemove(email) {
    if (!await QGDlg.confirm('حذف اشتراك ' + email + '؟\nيطلع من الموقع فوراً وما يقدر يدخل مرة ثانية إلا إذا أضفته من جديد.', { ok: 'حذف الاشتراك', danger: true })) return false;
    try { const r = await admCall({ op: 'adm_members_remove', email }); toast(r.inSheet ? 'تم الحذف — بس الإيميل مسجّل في الشيت فيقدر يدخل منه' : 'تم حذف الاشتراك'); ADM.members = null; return true; } catch (e) { toast(e.message); return false; }
  }
  function paintMembers(res) {
    const W = $('#adm'); if (!W) return; const M = ADM.members || []; const q = ADM.mq.trim().toLowerCase();
    const list = M.filter(x => !q || [x.email, x.typed, x.name, x.display].some(v => String(v || '').toLowerCase().includes(q)));
    const st = x => x.banned ? '<span class="rbdg ban">⛔ محظور</span>' : x.logins ? '<span class="rbdg viewer">✓ دخل الموقع</span>' : '<span class="rbdg wait">لم يدخل بعد</span>';
    const row = x => `<div class="srow"><span class="c-st">${avatarHtml(x.avatar, x.display || x.name || x.email, 40)}<span class="who"><b>${esc(x.display || x.name || x.email.split('@')[0])}</b><small class="ltr">${esc(x.typed || x.email)}</small></span></span>
      <span class="rl">${st(x)}</span>
      <span class="meta"><small>أضافه ${esc((x.added_by || '').split('@')[0])} · ${fmtD(x.added_at)}</small><small>آخر دخول: <b>${x.lastLogin ? fmtD(x.lastLogin) : '—'}</b></small>${x.inSheet ? '<small>📊 مسجّل في الشيت أيضاً</small>' : ''}</span>
      <span class="c-act"><button class="btn sm danger" data-mrm="${esc(x.email)}">حذف</button></span></div>`;
    const G = [['added', '✓ أُضيفوا ويقدرون يدخلون الحين', 'ok'], ['updated', '✎ كانوا مضافين وتحدّث اسمهم', 'ok'], ['exists', 'مضافين من قبل', ''], ['sheet', 'مسجّلين في الشيت أصلاً — ما يحتاجون إضافة', ''], ['staff', 'مشرفين — يدخلون بدون إضافة', ''], ['banned', '⛔ محظورين — فك الحظر من تبويب الطلاب أولاً', 'bad'], ['invalid', 'إيميلات غير صحيحة', 'bad']];
    const resHtml = res ? `<div class="mres">${G.filter(([k]) => res[k] && res[k].length).map(([k, t, c]) => `<div class="${c}"><b>${t} <small>${res[k].length}</small></b><span dir="ltr">${res[k].map(esc).join(' · ')}</span></div>`).join('')}</div>` : '';
    W.innerHTML = `<div class="stf">
      <form class="sadd" id="madd" autocomplete="off"><h3>➕ إضافة مشتركين</h3>
        <div class="sgrid"><label class="wide"><span>إيميلات Google — كل إيميل في سطر، وتقدر تكتب اسم الطالب بعد الإيميل</span><textarea id="m_em" rows="5" dir="ltr" spellcheck="false" placeholder="ahmed@gmail.com أحمد محمد&#10;sara@gmail.com"></textarea></label></div>
        <div class="sroles s3" role="radiogroup" aria-label="نوع اشتراكهم">${[['free', '🎁 مجاني', 'تفتح له النسخ الخاصة من المقاطع'], ['bank', '🏦 تحويل بنكي', 'تفتح له النسخ الخاصة من المقاطع'], ['yt', '▶️ يوتيوب', 'عضو في القناة: مقاطع الأعضاء']].map(([v, b, t]) => `<label class="ropt"><input type="radio" name="m_sub" value="${v}" ${ADM.msub === v ? 'checked' : ''}><span><b>${b}</b><small>${t}</small></span></label>`).join('')}</div>
        <div class="acts"><button class="btn gold" type="submit" id="m_go" disabled>إضافة</button><span class="mcnt" id="m_cnt"></span></div>
        ${resHtml}
        <p class="mnote">يدخلون الموقع فوراً بنفس إيميل Google، وما يحتاج تضيفهم في الشيت. المذكرة الشخصية (باسم الطالب وجواله) تنعمل من الشيت، فما تطلع للمضافين من هنا.</p></form>
      <h3 class="sh">المضافون من اللوحة <small>${M.length}</small></h3>
      ${M.length > 8 ? `<div class="abar"><input id="mq" type="search" placeholder="ابحث بالاسم أو الإيميل…" value="${esc(ADM.mq)}"></div>` : ''}
      <div class="slist">${list.length ? list.map(row).join('') : `<div class="sempty">${M.length ? 'لا نتائج' : 'ما أضفت أحد بعد — اكتب الإيميلات فوق واضغط «إضافة».'}</div>`}</div></div>`;
    const ta = $('#m_em'), go = $('#m_go'), cnt = $('#m_cnt');
    const upd = () => { ADM.draft = ta.value; const p = parseMembers(ta.value); go.disabled = !p.items.length;
      go.textContent = p.items.length > 1 ? `إضافة ${p.items.length} إيميلات` : 'إضافة';
      cnt.innerHTML = !ta.value.trim() ? '<span class="mut">اكتب إيميل أو أكثر</span>' : (p.items.length ? `<span class="ok">${p.items.length === 1 ? 'إيميل واحد جاهز' : p.items.length === 2 ? 'إيميلين جاهزين' : p.items.length + ' إيميلات جاهزة'}</span>` : '') + (p.bad.length ? `<span class="bad">${p.bad.length === 1 ? 'سطر واحد' : p.bad.length + ' أسطر'} بدون إيميل صحيح</span>` : ''); };
    ta.value = ADM.draft; ta.oninput = upd; upd();
    $('#madd').onsubmit = async e => {
      e.preventDefault(); const p = parseMembers(ta.value); if (!p.items.length) return;
      go.disabled = true; go.textContent = 'جارٍ الإضافة…';
      const sub = ((W.querySelector('input[name=m_sub]:checked') || {}).value) || 'free'; ADM.msub = sub;
      try { const r = await admCall({ op: 'adm_members_add', items: p.items, sub });
        ADM.draft = p.bad.join('\n'); ADM.members = (await admCall({ op: 'adm_members_list' })).members; ADM.list = null; ADM.subs = null;
        toast(r.added.length ? 'تمت الإضافة ✓' : 'ما فيه إيميلات جديدة'); app.innerHTML = admTop('members'); bindCtl(); $('#admref').onclick = () => { ADM.members = null; renderMembers(); }; paintMembers(r);
      } catch (err) { toast(err.message); upd(); }
    };
    const mq = $('#mq'); if (mq) mq.oninput = e => { ADM.mq = e.target.value; const pos = e.target.selectionStart; paintMembers(res); const i = $('#mq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-mrm]').forEach(b => b.onclick = async () => { if (await admMemberRemove(b.dataset.mrm)) { ADM.list = null; renderMembers(); } });
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
  // كل مهمة = شاهد مقطع الشرح ثم حل نفس القسم هنا في المنصة (حل القسم هو نفسه اختبار المقطع)
  const pq = i => ({ k: 'q', set: 'q' + i, t: `كمي Section ${i}: شاهد المقطع ثم حل القسم ${i}` });
  const pv = i => ({ k: 'v', set: 'v' + i, t: `لفظي Model ${i}: شاهد المقطع ثم حل النموذج ${i}` });
  const WQ = ['#t-wrong-q', 'أخطائي في الكمي'], WV = ['#t-wrong-v', 'أخطائي في اللفظي'], RULESL = ['#rules', 'قوانين الكمي'];
  const pr = (t, links, m) => ({ k: 'r', t, links: links || [], m: m || 60 });
  // 🔁 آخر الأيام مراجعة على الـ14 قسم كمي والـ14 نموذج لفظي (الخطط ما فيها اختبارات محاكية)
  const rng = (a, b) => `<bdi dir="ltr">${a}–${b}</bdi>`;
  const RQ = (a, b, m) => pr(`مراجعة الكمي، الأقسام ${rng(a, b)}: أعد حل الأسئلة اللي أخطأت فيها وراجع القوانين`, [WQ, RULESL], m);
  const RV = (a, b, m) => pr(`مراجعة اللفظي، النماذج ${rng(a, b)}: أعد حل الأسئلة اللي أخطأت فيها`, [WV], m);
  const FINAL = m => [[RQ(1, 7, m), RV(1, 7, m)], [RQ(8, 14, m), RV(8, 14, m)]];   // آخر يومين
  const taskMin = t => t.k === 'q' || t.k === 'v' ? 60 : t.k === 'r' ? t.m : 0;
  const durLabel = m => { const h = Math.round(m / 30) / 2, w = Math.floor(h), half = h % 1 ? ' ونص' : ''; return !h ? 'راحة' : !w ? '≈ 30 دقيقة' : '≈ ' + (w === 1 ? 'ساعة' : w === 2 ? 'ساعتين' : w + (w <= 10 ? ' ساعات' : ' ساعة')) + half; };
  const timed = d => { d.forEach(x => { if (x.tasks[0].k !== 'rest') x.time = durLabel(x.tasks.reduce((s, t) => s + taskMin(t), 0)); }); return d; };
  // أيام مذاكرة متتالية: [كم قسم كمي، كم نموذج لفظي] لكل يوم، بالترتيب ومتداخلة (كمي، لفظي، كمي…)
  function studyDays(counts) { const d = []; let q = 1, v = 1;
    counts.forEach(([nq, nv], j) => { const t = []; for (let i = 0; i < Math.max(nq, nv); i++) { if (i < nq) t.push(pq(q++)); if (i < nv) t.push(pv(v++)); } d.push({ n: j + 1, tasks: t }); });
    return d; }
  const PCONT = '14 مقطع كمي · 14 مقطع لفظي · مراجعة للأقسام كلها آخر الخطة';
  const PLANS = [
    { id: 'strong', name: 'الخطة القوية', days: 7, daily: 'حوالي 4 إلى 5 ساعات يومياً', fit: 'للي اختباره بعد أسبوع', content: PCONT, rev: 1,
      build() { const d = studyDays([[3, 2], [2, 3], [3, 2], [2, 3], [2, 2], [2, 2]]);
        d.push({ n: 7, tasks: [RQ(1, 14, 90), RV(1, 14, 90)] }); return timed(d); } },
    { id: 'intense', name: 'الخطة المكثفة', days: 14, daily: 'حوالي ساعتين إلى 3 ساعات يومياً', fit: 'للي اختباره قريب', content: PCONT, rev: 2,
      build() { const d = studyDays([[2, 1], [1, 1], [1, 1], [1, 2], [1, 1], [1, 1], [2, 1], [1, 1], [1, 1], [1, 2], [1, 1], [1, 1]]);
        FINAL(90).forEach((t, j) => d.push({ n: 13 + j, tasks: t })); return timed(d); } },
    { id: 'balanced', name: 'الخطة المتوازنة', days: 19, daily: 'حوالي ساعتين يومياً · يوم راحة كل أسبوع', fit: 'الأنسب لأغلب الطلاب', content: PCONT, star: true, rev: 2,
      build() { const d = [], W = n => Math.ceil(n / 7); let k = 1;
        const study = n => { d.push({ n, tasks: [pq(k), pv(k)], w: W(n) }); k++; }, rest = n => d.push({ n, time: 'راحة', tasks: [{ k: 'rest', t: 'يوم راحة: استرجع نشاطك' }], w: W(n) });
        for (let n = 1; n <= 5; n++) study(n);
        d.push({ n: 6, tasks: [pr('مراجعة: أعد حل الأسئلة اللي أخطأت فيها هالأسبوع', [WQ, WV])], w: 1 }); rest(7);
        for (let n = 8; n <= 13; n++) study(n); rest(14);
        for (let n = 15; n <= 17; n++) study(n);
        FINAL(60).forEach((t, j) => d.push({ n: 18 + j, tasks: t, w: 3 })); return timed(d); } },
    { id: 'relaxed', name: 'الخطة المريحة', days: 28, daily: 'حوالي ساعتين يومياً: يوم مذاكرة ويوم مراجعة خفيفة', fit: 'للي عنده دوام أو مدرسة', content: PCONT, rev: 2,
      build() { const d = [], W = n => Math.ceil(n / 7);
        for (let k = 1; k <= 12; k++) { const n = 2 * k - 1;
          d.push({ n, tasks: [pq(k), pv(k)], w: W(n) });
          d.push({ n: n + 1, tasks: [pr('مراجعة خفيفة: أعد حل أخطاء أمس وراجع ملاحظاتك', [WQ, WV], 30)], w: W(n + 1) }); }
        d.push({ n: 25, tasks: [pq(13), pv(13)], w: 4 }, { n: 26, tasks: [pq(14), pv(14)], w: 4 });
        FINAL(60).forEach((t, j) => d.push({ n: 27 + j, tasks: t, w: 4 })); return timed(d); } },
  ];
  const PLAN_LS = 'qg_plan', PSEEN_LS = 'qg_plan_seen';
  function planState() { return lsGet(PLAN_LS, { id: '', done: {} }); }
  const planUp = p => (p && (p.up || p.started)) || 0;
  function planSave(st) { st.up = Date.now(); lsSet(PLAN_LS, st); skillsPushSoon(2500); remCtx(); }
  // بنية الخطط: 2 = بدون اختبارات محاكية + القسم 14 من الكمي + مراجعة آخر الأيام (sv يمشي مع علامات الخطة وين ما انحفظت)
  const PLAN_SV = 2;
  // تبدأ خطة (أو ترجع لخطة قديمة بعلاماتها)
  function planStart(id) { const a = lsGet('qg_plan_all', {})[id]; planSave(Object.assign({ id, started: Date.now(), mv: 1, lg: [] }, !a ? { done: {}, sv: PLAN_SV } : a.mv ? { done: a.done || {}, sv: a.sv } : { done: a })); }
  function planInfo(plan, st) {   // تواريخ الخطة + موقعك منها + نسبة الإنجاز
    planMig(plan, st);
    const days = plan.build(), done = st.done || {};
    const start = day0(st.started || Date.now()), end = addDays(start, plan.days - 1), today = day0();
    // المهمة تنعلّم ✓ لحالها: حل القسم كامل · يوم الراحة لما يجي تاريخه · المراجعة يعلّمها الطالب
    const auto = (d, t) => t.set ? !!progGet(t.set).done : t.k === 'rest' ? addDays(start, d.n - 1) <= today : false;
    const tDone = (d, i) => !!(done[d.n] && done[d.n][i]) || auto(d, d.tasks[i]);
    const dayDone = d => d.tasks.every((t, i) => tDone(d, i));
    const nDone = days.filter(dayDone).length, cur = days.find(d => !dayDone(d)) || null;
    const work = []; days.forEach(d => d.tasks.forEach((t, i) => { if (t.k !== 'rest') work.push(tDone(d, i)); }));
    const pct = work.length ? Math.round(work.filter(Boolean).length * 100 / work.length) : 0;
    const tn = dayDiff(start, today) + 1, expect = Math.min(plan.days, tn);   // tn = رقم يوم «اليوم» في الخطة حسب التاريخ (يطلع برا 1..days قبل/بعد الخطة)
    // متأخر = أيام قبل اليوم ما خلصت · خلّص مهام اليوم = ماشي على الجدول · متقدم = خلّص أيام بعد اليوم
    return { days, done, auto, tDone, dayDone, nDone, cur, start, end, tn, exp: expect, pct, lag: !cur ? 0 : cur.n > expect ? Math.min(0, expect + 1 - cur.n) : expect - cur.n, left: dayDiff(today, end) };
  }
  // قبل البنية 2: وين كانت مهام الكمي واللفظي في كل يوم (عشان العلامات اليدوية تنتقل لنفس القسم، وعلامات المراجعات والاختبارات القديمة تنشال)
  function planOldSets(id) {
    const M = {}, qv = n => ['q' + n, 'v' + n];
    if (id === 'strong') { for (let i = 1; i <= 6; i++) M[i] = ['q' + (2 * i - 1), 'v' + (2 * i - 1), 'q' + 2 * i, 'v' + 2 * i]; M[7] = ['q13', 'v13', 'v14']; }
    else if (id === 'intense') { for (let i = 1; i <= 13; i++) M[i] = qv(i); M[14] = ['', 'v14']; }
    else if (id === 'balanced') { [1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17].forEach((n, j) => M[n] = qv(j + 1)); M[18] = ['', 'v14']; }
    else if (id === 'relaxed') { for (let k = 1; k <= 14; k++) M[2 * k - 1] = k <= 13 ? qv(k) : ['', 'v14']; }
    return M;
  }
  function planRemap(id, done) {
    const old = planOldSets(id), keep = {}, plan = PLANS.find(p => p.id === id), nd = {};
    Object.keys(done || {}).forEach(n => Object.keys(done[n] || {}).forEach(i => { const s = (old[n] || [])[+i]; if (s && done[n][i]) keep[s] = 1; }));
    if (plan) plan.build().forEach(d => d.tasks.forEach((t, i) => { if (t.set && keep[t.set]) (nd[d.n] = nd[d.n] || {})[i] = 1; }));
    return nd;
  }
  function planMig(plan, st) {   // مرة وحدة لكل خطة محفوظة بالبنية القديمة (فيها اختبارات محاكية)
    if (!st.id || st.sv === PLAN_SV) return;
    st.done = planRemap(st.id, st.done); st.sv = PLAN_SV; st.mv = 1; st.lg = []; lsSet(PLAN_LS, st); skillsPushSoon(2500);
  }
  // روابط المهمة: المقطع + حل القسم (مع تقدّمك فيه) · المراجعة: أخطاؤك والقوانين
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
    return (y ? `<a class="go yt" href="${y.url}" target="_blank" rel="noopener"${ytTip(y, 'مقطع شرح ' + y.label + ' على يوتيوب')}>${YTSVG}<span>المقطع</span><small>${y.dur}</small></a>` : '') + taskSolve(t, 'go');
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
      if (!I.cur) h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">🎉</span><div class="tr-pt"><span>خلّصت <b>${plan.name}</b> كاملة${ex && exT > now ? '. الحين راجع أخطاءك لين يجي اختبارك' : ''}.</span></div><a class="tr-go" href="#plan">الخطة</a></div>`;
      else {
        const links = I.cur.tasks.map(t => t.k === 'rest' ? '<span class="tchip rest">😴 يوم راحة</span>' : taskSolve(t, 'tchip')).join('');
        const fit = ex && exT > now ? fitInfo(I.end, exT) : null;
        const tags = `<span>${I.left >= 0 ? 'تخلص' : 'كانت تخلص'} ${fmtDay(I.end)}</span>` + (fit ? `<span class="fit ${fit.c}">${fit.s}</span>` : I.left > 0 ? `<span>باقي ${dLabel(I.left)}</span>` : '') + (I.lag > 0 ? `<span class="fit warn">متأخر ${I.lag === 1 ? 'يوم' : dLabel(I.lag)} عن الجدول</span>` : '') + (ex ? '' : '<button class="lnk" data-exam>حدّد موعد اختبارك</button>');
        const ahead = I.cur.n > I.tn;   // خلّص مهام اليوم، وهذي مهام الأيام الجاية
        h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span>${ahead ? `<b>خلّصت مهام اليوم ✓</b> <span class="mut">(الجاي: اليوم ${I.cur.n} من ${plan.days})</span>` : `<b>خطتك اليوم</b> <span class="mut">(اليوم ${I.cur.n} من ${plan.days})</span>`}</span><span class="tr-lk">${links}</span><small class="tr-end">${tags}</small></div><a class="tr-go" href="#plan">افتح الخطة</a></div>`;
      }
    } else h += `<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span>ما اخترت خطة مذاكرة. <a href="#plan">اختر خطة تلحق قبل اختبارك</a></span></div></div>`;
    return h + '</section>';
  }
  let planPctShown = null, planArrive = [], planTok = 0;
  const planCalm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function renderPlan(o) {
    o = o || {};
    document.title = 'خطة المذاكرة | Q-Guide';
    if (!manifest) fetch('/p/data/manifest.json').then(r => r.json()).then(m => { if (!manifest) { manifest = m; if (location.hash === '#plan') renderPlan({ keep: 1 }); } }).catch(() => {});
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
      W.innerHTML = `<div class="hero"><div><h1>اختر الخطة اللي تناسب وقتك</h1><p>كل خطة تمشي على مقاطع الشرح (14 كمي و14 لفظي): تشاهد المقطع ثم تحل قسمه هنا في المنصة، وآخر أيامها مراجعة على الأقسام والنماذج كلها. تقدر تغيّر الخطة في أي وقت.</p></div></div>
        <div class="exrow"><span class="exi" aria-hidden="true">🎯</span><div class="ext">${ex ? `<b>اختبارك ${fmtDay(exT)}</b><span>${live ? (dl ? `باقي ${dLabel(dl)}. علّمنا لك بالنجمة ⭐ الخطة اللي تلحق قبله` : 'اختبارك اليوم! بالتوفيق') : 'الموعد المحفوظ مضى. حدّثه إذا عندك اختبار جديد'}</span>` : `<b>متى اختبارك؟</b><span>حدّد الموعد ونعلّم لك الخطة اللي تلحق قبله، ونعرض لك عدّاد تنازلي</span>`}</div><button class="btn sm ${ex ? 'ghost' : ''}" data-exam>${ex ? 'تعديل الموعد' : 'حدّد الموعد'}</button></div>
        <div class="plans">${PLANS.map(p => { const star = rec ? p === rec : !live && p.star; const end = endOf(p); const f = live ? fitInfo(end, exT) : null;
          return `<button class="pcard ${star ? 'star' : ''} ${f && f.c !== 'ok' ? 'late' : ''}" data-p="${p.id}">${star ? `<span class="pstar">⭐ ${rec ? 'الأنسب لموعد اختبارك' : 'الأنسب لأغلب الطلاب'}</span>` : ''}<span class="pn">${p.name}</span><span class="pdays">${p.days} يوماً</span><span class="pm">⏱ ${p.daily}</span><span class="pm">🔁 ${p.rev === 1 ? 'آخر يوم' : 'آخر يومين'} مراجعة للـ14 قسم والـ14 نموذج</span><span class="pm">🎯 ${p.fit}</span><span class="pm">🏁 تخلص ${fmtDay(end)}</span>${f ? `<span class="pfit ${f.c}">${f.c === 'ok' ? '✓' : '⚠'} ${f.t}</span>` : ''}<span class="btn">ابدأ هذه الخطة</span></button>`; }).join('')}</div>
        ${rec && dayDiff(endOf(rec), exT) < 1 ? `<div class="pverd bad">⚠ باقي على اختبارك ${dl ? dLabel(dl) : 'أقل من يوم'} بس، وأقصر خطة 7 أيام. ابدأ بالخطة القوية وركّز على الأقسام اللي تحس إنك أضعف فيها.</div>` : ''}
        <div class="sum" style="margin-top:16px;text-align:right"><b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة مباشرة • اقرأ شرح كل سؤال أخطأت فيه، وأخطاؤك تنحفظ لك تلقائياً في «مراجعة أخطائي» • المهام تنعلّم ✓ لحالها لما تحل القسم • إذا فاتك يوم كمّل من مكانك ولا تحاول تعوّض يومين في يوم.</div>`;
      W.querySelectorAll('.pcard').forEach(b => b.onclick = () => { planStart(b.dataset.p); renderPlan(); });
      bindExam(W, () => renderPlan({ keep: 1 }));
      return;
    }
    const I = planInfo(plan, st), { days, done, cur } = I, tok = ++planTok, calm = planCalm();
    // ✅ الأيام اللي خلصت تنزل تحت في «إنجازك». اللي خلص للحين (من هنا أو من حل القسم) يبان مكانه لحظة، يتلاشى وينزل
    const seenK = plan.id + ':' + (st.started || 0); let SN = lsGet(PSEEN_LS, null);
    if (!SN || SN.k !== seenK || !Array.isArray(SN.n)) SN = { k: seenK, n: days.filter(I.dayDone).map(d => d.n) };
    SN.n = SN.n.filter(n => days.some(d => d.n === n && I.dayDone(d)));
    const newly = days.filter(d => I.dayDone(d) && SN.n.indexOf(d.n) < 0).map(d => d.n);
    const fresh = calm ? [] : newly;
    if (calm && newly.length) { SN.n = SN.n.concat(newly); if (o.tick) toast(newly.length === 1 ? `🎉 خلّصت اليوم ${newly[0]}، ونزل تحت في «إنجازك»` : `🎉 خلّصت ${dLabel(newly.length)}، ونزلت تحت في «إنجازك»`); }
    lsSet(PSEEN_LS, SN);
    const act = days.filter(d => !I.dayDone(d) || fresh.indexOf(d.n) >= 0), fin = days.filter(d => I.dayDone(d) && fresh.indexOf(d.n) < 0).reverse();   // «إنجازك»: الأحدث فوق (يطلع تحت الأيام الباقية مباشرة)
    const pct = I.pct, from = planPctShown != null && planPctShown !== pct && !calm ? planPctShown : pct; planPctShown = pct;
    const icon = { q: '🔵', v: '🟢', r: '🟠', rest: '😴' };
    const autoTip = { q: 'انعلّمت لحالها لأنك حليت القسم', v: 'انعلّمت لحالها لأنك حليت النموذج', rest: 'يوم الراحة ينحسب لحاله لما يجي تاريخه' };
    const fit = live ? fitInfo(I.end, exT) : null;
    const lagT = !cur ? 'خلّصت كل الأيام 🎉' : I.lag > 0 ? `<span class="fit warn">متأخر ${I.lag === 1 ? 'يوم' : dLabel(I.lag)} عن الجدول</span>` : I.lag < 0 ? `<span class="fit ok">متقدم ${-I.lag === 1 ? 'يوم' : dLabel(-I.lag)} عن الجدول 👏</span>` : cur.n === I.exp + 1 ? '<span class="fit ok">خلّصت مهام اليوم ✓</span>' : '<span class="fit ok">ماشي على الجدول ✓</span>';
    const leftT = I.left > 0 ? `باقي ${dLabel(I.left)}` : I.left === 0 ? 'اليوم آخر يوم في الخطة' : `كان المفروض تخلص قبل ${dLabel(-I.left)}`;
    let verd = '';
    if (fit) verd = fit.c === 'ok' ? `✓ خطتك ${fit.t}${fit.gap >= 3 ? '. استغل الأيام الزيادة في مراجعة أخطائك' : '. التزم بالجدول عشان تلحق'}.`
      : fit.c === 'warn' ? '⚠ خطتك تخلص يوم اختبارك نفسه. حاول تسبق الجدول بيوم أو يومين.'
      : (() => { const sh = PLANS.filter(p => p.days < plan.days && dayDiff(addDays(day0(), p.days - 1), exT) >= 1).sort((a, b) => b.days - a.days)[0]; return `⚠ خطتك ${fit.t}. ${sh ? `بدّل لـ«${sh.name}» (${dLabel(sh.days)})، أو ضاعف` : 'حاول تضاعف'} بعض الأيام عشان تلحق.`; })();
    let lastW = 0;
    const dayHtml = d => { const wk = plan.days > 14 && d.w !== lastW ? `<div class="wk">الأسبوع ${d.w}</div>` : ''; lastW = d.w || lastW;
      const fr = fresh.indexOf(d.n) >= 0, isCur = cur && cur.n === d.n, isTod = d.n === I.tn;
      // «اليوم» = تاريخ اليوم فعلاً · «كمّل من هنا» = أول يوم ما خلّصته (لو مو هو نفس اليوم) · «✓ خلّصته» = لحظة قبل لا ينزل
      const tag = fr ? '<span class="now ok">✓ خلّصته</span>' : isTod ? `<span class="now${isCur ? '' : ' td'}" title="تاريخ اليوم">اليوم</span>` : isCur ? '<span class="now" title="أول يوم في خطتك ما خلّصته">كمّل من هنا</span>' : '';
      return wk + `<section class="day ${fr ? 'fin' : ''} ${isCur ? 'cur' : ''} ${isTod ? 'tod' : ''}" id="day${d.n}"${isTod ? ' aria-current="date"' : ''}><header><label class="dchk"><input type="checkbox" data-day="${d.n}" ${fr ? 'checked' : ''}><span>اليوم ${d.n}</span></label><span class="mut">${d.time} · ${fmtDay(addDays(I.start, d.n - 1))}</span>${tag}</header>
          <ul>${d.tasks.map((t, i) => { const a = I.auto(d, t), ok = I.tDone(d, i); return `<li class="${ok ? 'ok' : ''} k${t.k}"><label${a ? ` title="${autoTip[t.k] || ''}"` : ''}><input type="checkbox" data-day="${d.n}" data-i="${i}" ${ok ? 'checked' : ''}${a ? ' disabled' : ''}><span class="ic" aria-hidden="true">${icon[t.k] || ''}</span><span class="tt">${t.t}</span></label><span class="tl">${taskLinks(t)}</span></li>`; }).join('')}</ul></section>`; };
    const dnChip = (d, t, i) => {   // في «إنجازك» كل مهمة ✓
      if (t.k === 'rest') return '<span class="tchip rest">😴 راحة</span>';
      if (!I.tDone(d, i)) return taskSolve(t, 'tchip');
      if (t.set) { const g = progGet(t.set); return `<a class="tchip ok" href="#${t.set}">✓ ${SET_NAME(t.set)}${g.done && g.best != null ? ` <small>${g.best}%</small>` : ''}</a>`; }
      return '<span class="tchip ok">✓ مراجعة</span>'; };
    const finHtml = d => `<div class="dn ${planArrive.indexOf(d.n) >= 0 ? 'arrive' : ''}" id="dn${d.n}"><label class="dchk" title="شيل العلامة لو علّمته بالغلط"><input type="checkbox" data-day="${d.n}" checked><span>اليوم ${d.n}</span></label><span class="mut">${fmtDay(addDays(I.start, d.n - 1))}${d.n === I.tn ? ' · <b class="dtod">اليوم</b>' : ''}</span><span class="dnl">${d.tasks.map((t, i) => dnChip(d, t, i)).join('')}</span></div>`;
    const doneTxt = I.nDone ? `خلّصت ${dLabel(I.nDone)} من ${days.length}` : `ما خلّصت أي يوم من ${days.length} للحين`;
    W.innerHTML = `<div class="hero"><div><h1>${plan.name}</h1><p>${plan.days} يوماً · ${plan.daily}</p></div>
        <div class="pctl"><button class="btn sm ghost" id="chg">تغيير الخطة</button><button class="btn sm ghost" id="rst" title="يمسح علاماتك ويبدأ الخطة من اليوم">إعادة البدء</button></div></div>
      <div class="pstats">
        <div class="pst pg"><span class="pk">✅ نسبة الإنجاز</span><b class="pgv"><span data-pct>${from}</span>%</b><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="نسبة إنجازك في الخطة"><i style="width:${from}%"></i></div><span class="ps">${doneTxt}</span><span class="ps2">${lagT}</span></div>
        <div class="pst"><span class="pk">🏁 نهاية الخطة</span><b>${fmtDay(I.end)}</b><span class="ps">${leftT}</span></div>
        <div class="pst ex">${ex ? `<span class="pk">🎯 ${live ? 'باقي على اختبارك' : 'موعد اختبارك'}</span>${live ? cdHtml(exT, true) : `<b>${fmtDay(exT)}</b>`}<span class="ps">${live ? fmtDay(exT) + '، ' + fmtTime(exT) + ' · ' : ''}<button class="lnk" data-exam>تعديل</button></span>` : `<span class="pk">🎯 موعد اختبارك</span><b class="none">ما حدّدته</b><span class="ps"><button class="btn sm" data-exam>حدّد الموعد</button></span>`}</div>
      </div>
      ${verd ? `<div class="pverd ${fit.c}">${verd}</div>` : ''}
      <div class="days">${act.length ? act.map(dayHtml).join('') : '<div class="pall">🎉 خلّصت كل أيام الخطة! الحين راجع أخطاءك، وأعد حل الأقسام اللي درجتك فيها أقل.</div>'}</div>
      <section class="pdone" aria-labelledby="pdh"><header><h2 id="pdh">✅ إنجازك في الخطة</h2><span class="pdp">${fin.length ? `خلّصت ${dLabel(fin.length)} · ` : ''}<b><bdi>${pct}%</bdi></b></span></header>
        ${fin.length ? `<div class="pdl">${fin.map(finHtml).join('')}</div>` : '<p class="pde">أول ما تخلّص كل مهام يوم، يتلاشى من فوق وينزل هنا ✓</p>'}</section>
      <div class="sum" style="margin-top:16px;text-align:right">🔵 كمي · 🟢 لفظي · 🟠 مراجعة. المهام تنعلّم ✓ لحالها لما تحل القسم، والمراجعة علّمها أنت. <b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة، واقرأ شرح كل سؤال أخطأت فيه. إذا فاتك يوم كمّل من مكانك ولا تعوّض يومين في يوم.</div>`;
    planArrive = [];
    const save = () => planSave(Object.assign(st, { done }));
    const re = () => renderPlan({ keep: 1, tick: 1 });
    W.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { done[c.dataset.day] = done[c.dataset.day] || {}; if (c.checked) done[c.dataset.day][c.dataset.i] = 1; else delete done[c.dataset.day][c.dataset.i]; save(); re(); });
    W.querySelectorAll('input[data-day]:not([data-i])').forEach(c => c.onchange = () => { const d = days.find(x => x.n == c.dataset.day); done[d.n] = {}; if (c.checked) d.tasks.forEach((t, i) => done[d.n][i] = 1); save();
      if (!c.checked) { const J = planInfo(plan, st); if (J.dayDone(J.days.find(x => x.n === d.n))) toast('هذا اليوم محسوب لك لأنك حليت أقسامه ✓'); }
      re(); });
    $('#chg').onclick = async () => { if (await QGDlg.confirm('تغيير الخطة؟ (علاماتك الحالية تُحفظ لو رجعت لنفس الخطة لاحقاً)', { ok: 'تغيير' })) { const all = lsGet('qg_plan_all', {}); all[plan.id] = { done, lg: [], mv: 1, sv: PLAN_SV }; lsSet('qg_plan_all', all); planSave({ id: '', done: {} }); renderPlan(); } };
    $('#rst').onclick = async () => { if (await QGDlg.confirm('مسح علاماتك والبدء من اليوم 1؟ (الأقسام اللي حليتها تبقى محسوبة)', { ok: 'إعادة البدء', danger: true })) { planSave({ id: plan.id, done: {}, started: Date.now(), mv: 1, lg: [], sv: PLAN_SV }); renderPlan(); } };
    bindExam(W, () => renderPlan({ keep: 1 }));
    // نسبة الإنجاز تعدّ لين توصل الرقم الجديد
    if (from !== pct) { const pe = W.querySelector('[data-pct]'), bar = W.querySelector('.pst.pg .bar i'), t0 = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { if (bar) bar.style.width = pct + '%'; }));
      const step = ts => { const k = Math.min(1, Math.max(0, (ts - t0) / 750)), e = 1 - Math.pow(1 - k, 3); if (pe) pe.textContent = Math.round(from + (pct - from) * e); if (k < 1 && pe && pe.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step); }
    if (fresh.length) setTimeout(() => planOut(fresh, tok), o.tick ? 450 : 900);
    if (!o.keep && cur) { const el = $('#day' + cur.n); if (el && el.getBoundingClientRect().top > innerHeight * .75) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150); }
  }
  // 🎬 اليوم اللي خلص: يخضرّ، يتلاشى وينزل، وبعدها يطلع تحت في «إنجازك»
  function planOut(ns, tok) {
    if (tok !== planTok || location.hash !== '#plan') return;
    ns.map(n => $('#day' + n)).filter(Boolean).forEach(el => { el.style.height = el.offsetHeight + 'px'; el.getBoundingClientRect(); el.classList.add('out'); el.style.height = '0px'; });
    setTimeout(() => {
      if (tok !== planTok || location.hash !== '#plan') return;
      const S = lsGet(PSEEN_LS, null); if (!S || !Array.isArray(S.n)) return;
      ns.forEach(n => { if (S.n.indexOf(n) < 0) S.n.push(n); }); lsSet(PSEEN_LS, S);
      planArrive = ns.slice(); renderPlan({ keep: 1 });
      toast(ns.length === 1 ? `🎉 خلّصت اليوم ${ns[0]}، ونزل تحت في «إنجازك»` : `🎉 خلّصت ${dLabel(ns.length)}، ونزلت تحت في «إنجازك»`);
    }, 600);
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
      `<main class="wrap"><div class="tabs lbtabs"><button data-k="month" class="${tabK === 'month' ? 'on' : ''}">📆 هذا الشهر</button><button data-k="practice" class="${tabK === 'practice' ? 'on' : ''}">📚 الكل</button><button data-k="set" class="${tabK === 'set' ? 'on' : ''}">🎯 حسب القسم</button><button data-k="exam" class="${tabK === 'exam' ? 'on' : ''}">🧪 المحاكي</button><button data-k="arena" class="${tabK === 'arena' ? 'on' : ''}">⚔️ الساحة</button></div>
      ${isSet ? `<div class="setpick"><label>اختر القسم:</label><select id="lbset">${opts.map(o => `<option value="${o}" ${o === setId ? 'selected' : ''}>${setTitle(o)}</option>`).join('')}</select></div>` : ''}
      <p class="mut lbnote">${kind === 'arena' ? 'ترتيب <b>الساحة 1v1</b> بالتصنيف: الكل يبدأ من 1000، الفوز يرفعك والخسارة تنزّلك، والفوز على خصم أقوى منك يرفعك أكثر.' : kind === 'exam' ? 'الترتيب بـ<b>متوسط النسبة المئوية</b> لأول محاولة في كل اختبار محاكي (نفس درجة قياس من 100)، ثم عدد الاختبارات، ثم الأسرع وقتاً.'
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
    const unit = kind === 'exam' ? 'اختبار' : 'قسم', isAr = kind === 'arena';
    // عرض الدرجة: المحاكي والقسم = نسبة مئوية؛ العام والشهر = إجابات صحيحة (+ النسبة)
    const scoreHtml = x => isAr ? `<b>${x.r}</b>` : kind === 'exam' ? `<b>${Math.round(x.score)}%</b>` : isSet ? `<b>${Math.round(x.score)}%</b> <small>${x.correct}/${x.q}</small>` : `<b>${x.score}</b> ✓`;
    const subHtml = x => isAr ? `${x.w} فوز من ${x.g} ${x.g === 1 ? 'مباراة' : 'مباريات'}` : kind === 'exam' ? `${x.done} ${x.done === 1 ? 'اختبار' : 'اختبارات'} · ${fmt(x.secs)}` : isSet ? fmt(x.secs) : `${pct(x)}% دقة · ${fmt(x.secs)}`;
    const mine = isAr ? (r.me ? `<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${arStu(r.total)}</b><span>تصنيفك ${r.me.r} · ${r.me.w} فوز و${r.me.l} خسارة${r.me.d ? ' و' + r.me.d + ' تعادل' : ''}</span></div><a class="btn sm" href="#arena">العب مباراة</a></div>` : `<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>العب مباراة وحدة في الساحة وتظهر هنا.</span></div><a class="btn sm" href="#arena">ادخل الساحة</a></div>`)
      : r.me ? `<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${arStu(r.total)}</b><span>${kind === 'exam' ? Math.round(r.me.score) + '% متوسط · ' + r.me.done + ' ' + unit : isSet ? Math.round(r.me.score) + '% (' + r.me.correct + '/' + r.me.q + ')' : r.me.score + ' إجابة صحيحة · ' + r.me.done + ' ' + unit} · ${fmt(r.me.secs)}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">اختبار جديد</a>' : isSet ? `<a class="btn sm" href="#${setId}">افتح القسم</a>` : '<a class="btn sm" href="#">تدرّب</a>'}</div>`
      : `<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>${kind === 'exam' ? 'أنهِ اختباراً محاكياً واحداً وتظهر هنا.' : isSet ? 'حل هذا القسم مرة واحدة وتظهر هنا.' : kind === 'month' ? 'حل قسماً هذا الشهر وتظهر هنا.' : 'حل قسماً أو نموذجاً واحداً وتظهر هنا.'}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">ابدأ اختباراً</a>' : isSet ? `<a class="btn sm" href="#${setId}">ابدأ القسم</a>` : '<a class="btn sm" href="#">ابدأ قسماً</a>'}</div>`;
    if (!r.top.length) { el.innerHTML = mine + `<div class="sum" style="margin-top:12px">🏆 اللوحة فاضية — كن أول من يظهر هنا!</div>`; return; }
    const medal = k => ['🥇', '🥈', '🥉'][k - 1] || '';
    const top3 = r.top.slice(0, 3), rest = r.top.slice(3);
    const podium = top3.length >= 3 ? `<div class="podium">${[1, 0, 2].map(i => { const x = top3[i]; return `<div class="pd p${x.rank} ${x.me ? 'me' : ''}">${avatarHtml(x.a, x.n, x.rank === 1 ? 72 : 60)}<div class="pr">${medal(x.rank)}</div><b title="${esc(x.n)}">${esc(x.n)}</b><span class="pscore">${scoreHtml(x)}</span><span>${subHtml(x)}</span></div>`; }).join('')}</div>` : '';
    const list = top3.length >= 3 ? rest : r.top;
    const cols = isAr ? ['التصنيف', 'الفوز', 'المباريات'] : kind === 'exam' ? ['النسبة', 'الاختبارات', 'الوقت'] : isSet ? ['النسبة', 'الصحيحة', 'الوقت'] : ['الصحيحة', 'الدقة', 'الوقت'];
    const cells = x => isAr ? [`<b>${x.r}</b>`, x.w, x.g] : kind === 'exam' ? [`<b>${Math.round(x.score)}%</b>`, x.done, fmt(x.secs)] : isSet ? [`<b>${Math.round(x.score)}%</b>`, `${x.correct}/${x.q}`, fmt(x.secs)] : [`<b>${x.score}</b> ✓`, pct(x) + '%', fmt(x.secs)];
    el.innerHTML = mine + podium + `<div class="lbl-list">
      <div class="lbr head"><span class="rk">#</span><span class="nm">الطالب</span><span class="sc">${cols[0]}</span><span class="ac">${cols[1]}</span><span class="tm">${cols[2]}</span>${!isSet && kind !== 'exam' && !isAr ? `<span class="dn">الأقسام</span>` : ''}</div>
      ${list.map(x => { const c = cells(x); return `<div class="lbr ${x.me ? 'me' : ''} ${x.rank <= 3 ? 'top' : ''}"><span class="rk">${x.rank <= 3 ? medal(x.rank) : x.rank}</span>${avatarHtml(x.a, x.n, 38)}<span class="nm">${esc(x.n)}</span>${x.me ? '<span class="you">أنت</span>' : ''}<span class="sc">${c[0]}</span><span class="ac">${c[1]}</span><span class="tm">${c[2]}</span>${!isSet && kind !== 'exam' && !isAr ? `<span class="dn">${x.done}</span>` : ''}</div>`; }).join('')}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">يُعرض أفضل 100 طالب، واللوحة تتحدث كل دقيقة. تقدر تغيّر اسمك وصورتك من زر اسمك في الصفحة الرئيسية.</p>`;
  }

  // ---------- ⚔️ الساحة 1v1: مباراة مباشرة بين طالبين (WebSocket مع الخادم) ----------
  const AR = { ws: null, st: 'lobby', info: null, m: null, T: null, B: null, items: [], left: null, qc: null, off: 0, tm: 0, stm: 0, since: 0, code: '', join: '', end: null, hist: [], sc: [0, 0], i: -1, dl: 0, lim: 0, mine: null, opA: false, opGone: false, goAt: 0, wantClose: false, retry: 0, err: '' };
  const AR_T = { ana: 'تناظر لفظي', sen: 'إكمال جمل', err: 'خطأ سياقي', quant: 'كمي' };
  const AR_IN = { ana: 'Choose the pair of words that best expresses a relationship similar to that in the original pair.', sen: 'Choose the word(s) that best complete(s) the sentence.', err: 'Choose the word that is used incorrectly in the context of the sentence.' };
  const AR_LIVE = ['vs', 'q', 'rev'];
  const arNow = () => Date.now() + AR.off;
  const arWsUrl = () => window.QG.API.replace(/^http/, 'ws').replace(/\/$/, '') + '/arena?s=' + encodeURIComponent(auth.session);
  const arMe = () => ({ n: auth.display || auth.name || '', a: auth.avatar || '' });
  function arSend(o) { try { if (AR.ws && AR.ws.readyState === 1) { AR.ws.send(JSON.stringify(o)); return true; } } catch (e) {} return false; }
  function arOpen() {
    return new Promise((res, rej) => {
      if (AR.ws && AR.ws.readyState === 1) return res();
      if (AR.ws) { const o = AR.ws; AR.ws = null; try { o.close(); } catch (e) {} }
      let ws; try { ws = new WebSocket(arWsUrl()); } catch (e) { return rej(e); }
      AR.ws = ws; AR.wantClose = false; let ok = false;
      const to = setTimeout(() => { if (!ok) { try { ws.close(); } catch (e) {} } }, 12000);
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'hi' && !ok) { ok = true; clearTimeout(to); AR.retry = 0; res(m); } arMsg(m); };
      ws.onclose = () => { clearTimeout(to); if (AR.ws !== ws) return; AR.ws = null; if (!ok) return rej(new Error('closed')); arDropped(); };
    });
  }
  function arClose() { AR.wantClose = true; clearInterval(AR.stm); if (AR.ws) { const o = AR.ws; AR.ws = null; try { o.close(1000); } catch (e) {} } }
  function arStop() { clearInterval(AR.tm); AR.tm = 0; }
  // يُستدعى من route() لما يطلع الطالب من الساحة
  function arLeave() {
    window.onbeforeunload = null; document.onkeydown = null; arStop();
    if (!AR.ws) return;
    if (AR.m && AR_LIVE.includes(AR.st)) arSend({ t: 'quit', m: AR.m.m }); else if (['search', 'room', 'joining'].includes(AR.st)) arSend({ t: 'cancel' });
    AR.st = 'lobby'; AR.m = null; setTimeout(arClose, 150);
  }
  function arDropped() {
    if (AR.wantClose) return;
    if (AR.m && AR_LIVE.includes(AR.st)) {
      if (AR.retry >= 6) { AR.st = 'lobby'; AR.m = null; AR.err = 'انقطع اتصالك بالساحة، فما قدرنا نكمل المباراة.'; window.onbeforeunload = null; return renderArena(); }
      AR.retry++; arNote('انقطع الاتصال… نحاول نرجعك للمباراة', 'warn');
      setTimeout(() => { if (AR.wantClose || !AR.m) return; arOpen().then(() => arNote('')).catch(() => {}); }, 1200 + AR.retry * 600);
      return;
    }
    if (['search', 'room', 'joining', 'connecting'].includes(AR.st)) { AR.st = 'lobby'; AR.err = 'انقطع الاتصال بالساحة. حاول مرة ثانية.'; arPanel(); }
  }
  async function arTest(id) {
    if (cache['ar:' + id]) return cache['ar:' + id];
    const r = await fetch('/test/data/' + id + '.bin?v=3', { cache: 'force-cache' }); if (!r.ok) throw new Error('data ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer()); const key = await getKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return (cache['ar:' + id] = JSON.parse(new TextDecoder().decode(plain)));
  }
  // ⚔️ أسئلة الساحة: كل سؤال مشفّر بمفتاح خاص فيه، والخادم يرسل المفتاح مع بداية السؤال (الزائر ما يشوف إلا اللي لعبه)
  const AR_V = 1;
  async function arBlob(id) {
    if (cache['arb:' + id]) return cache['arb:' + id];
    const r = await fetch('/test/data/ar/' + id + '.json?v=' + AR_V, { cache: 'force-cache' }); if (!r.ok) throw new Error('data ' + r.status);
    return (cache['arb:' + id] = (await r.json()).i);
  }
  async function arOpen1(i, k) {
    if (!k || !AR.m || !AR.B || AR.items[i]) return;
    const r = AR.m.refs[i], b64 = AR.B[r[0] + '.' + r[1]]; if (!b64) return;
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', hex2buf(k), 'AES-GCM', false, ['decrypt']);
    AR.items[i] = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))));
  }
  const arOpenAll = ks => Promise.all((ks || []).map((k, i) => k ? arOpen1(i, k).catch(() => {}) : null));
  const arSeq = f => { AR.qc = (AR.qc || Promise.resolve()).then(f).catch(() => {}); };   // رسائل المباراة بالترتيب (فك السؤال قبل عرضه)
  const arItem = i => AR.items[i];
  const arAgo = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return 'الحين'; const m = Math.floor(s / 60); if (m < 60) return 'قبل ' + m + ' د'; const h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + ' س'; const d = Math.floor(h / 24); return d === 1 ? 'أمس' : 'قبل ' + d + ' أيام'; };
  const arRes = { win: ['فوز', 'win'], loss: ['خسارة', 'loss'], draw: ['تعادل', 'draw'] };
  const arStu = n => n === 1 ? 'طالب واحد' : n === 2 ? 'طالبين' : n <= 10 ? n + ' طلاب' : n + ' طالباً';

  // ---------- صفحة الساحة ----------
  async function renderArena(join) {
    document.title = 'الساحة 1v1 | Q-Guide';
    if (join) AR.join = join;
    if (AR.m && AR_LIVE.includes(AR.st)) return arView();
    if (AR.st === 'end') { AR.st = 'lobby'; arClose(); }
    const me = arMe(), I = AR.info;
    app.innerHTML = topbar(`<span class="ttl">⚔️ الساحة 1v1</span><span class="sp"></span><nav class="tnav"><a class="tn" href="#board-arena" title="لوحة ترتيب الساحة"><span class="i">🏆</span><span class="l">الترتيب</span></a></nav>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap arena">
        <section class="ar-hero">
          <div class="ar-hl"><h1>الساحة <span dir="ltr">1v1</span></h1>
            <p>تحدَّ طالب من الدورة مباشرة في 20 سؤال: 10 لفظي و10 كمي. الإجابة الصحيحة تجيب 10 نقاط، وكل ما كنت أسرع تزيد لين 20.</p>
            <div id="arp"></div></div>
          <aside class="ar-me" id="arme">${arMeCard(me, I)}</aside>
        </section>
        <ul class="ar-rules">
          <li><b>20</b><span>سؤال بالتناوب: لفظي ثم كمي</span></li>
          <li><b>35 <small>ث</small> · 50 <small>ث</small></b><span>وقت السؤال اللفظي ثم الكمي</span></li>
          <li><b><bdi dir="ltr">+16</bdi></b><span>تقريباً لكل فوز على خصم بنفس مستواك</span></li>
        </ul>
        <div class="ar-cols">
          <section class="ar-box"><div class="ar-bh"><h2>الأعلى تصنيفاً</h2><a href="#board-arena">اللوحة كاملة</a></div><div id="artop"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></section>
          <section class="ar-box"><div class="ar-bh"><h2>مبارياتك الأخيرة</h2></div><div id="arhist">${arHistHtml(I)}</div></section>
        </div>
      </main>`;
    bindCtl(); arPanel();
    if (AR.join) { const c = AR.join; AR.join = ''; arJoin(c); }
    let r; try { r = await api({ op: 'arena_me', session: auth.session }); } catch (e) { r = null; }
    if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
    if (r && r.ok) { AR.info = r; if (r.free) AR.left = r.free.left; const a = $('#arme'), h = $('#arhist'); if (a) a.innerHTML = arMeCard(me, r); if (h) h.innerHTML = arHistHtml(r); if (AR.st === 'lobby') arPanel(); }
    api({ op: 'leaderboard', kind: 'arena', session: auth.session }).then(b => { const el = $('#artop'); if (!el) return; el.innerHTML = b && b.ok ? arTopHtml(b) : '<p class="mut">تعذّر تحميل الترتيب.</p>'; }).catch(() => {});
  }
  function arMeCard(me, I) {
    const g = I ? I.g : 0;
    return `<div class="ar-mh">${avatarHtml(me.a, me.n, 46)}<b>${esc(me.n)}</b></div>
      <div class="ar-rt"><b>${I ? I.r : 1000}</b><span>${g ? 'تصنيفك' : 'تصنيف البداية'}</span></div>
      ${g ? `<div class="ar-wl"><span class="w">${I.w} فوز</span><span class="l">${I.l} خسارة</span>${I.d ? `<span>${I.d} تعادل</span>` : ''}</div>
      <p class="ar-rk">${I.rank ? `ترتيبك <b>#${I.rank}</b> من ${arStu(I.total)}` : 'ما تظهر في الترتيب'}${I.best > 1 ? ` · أطول سلسلة فوز ${I.best}` : ''}</p>`
      : `<p class="ar-rk">العب أول مباراة ويطلع لك تصنيف وترتيب بين الطلاب.</p>`}`;
  }
  function arHistHtml(I) {
    if (!I) return '<div class="center"><div class="spin" style="margin:0 auto"></div></div>';
    if (!I.hist || !I.hist.length) return '<p class="ar-empty">ما لعبت أي مباراة للحين. أول مباراة تبدأ من زر «ابحث عن خصم».</p>';
    return `<ol class="ar-list">${I.hist.map(h => `<li class="ar-hr"><span class="ar-chip ${arRes[h.res][1]}">${arRes[h.res][0]}</span>${avatarHtml(h.op.a, h.op.n, 32)}<span class="ar-hn"><b>${esc(h.op.n || 'طالب')}</b><small>${h.kind === 'friend' ? 'تحدي صديق' : 'خصم عشوائي'}${h.why === 'quit' ? ' · انسحاب' : h.why === 'left' ? ' · انقطاع' : ''} · ${arAgo(h.ts)}</small></span><span class="ar-hs" title="نقاطك – نقاط خصمك">${h.sc[0]} – ${h.sc[1]}</span>${h.rated ? `<em class="${h.d >= 0 ? 'up' : 'dn'}" dir="ltr">${h.d >= 0 ? '+' : ''}${h.d}</em>` : '<em class="nr">بدون تصنيف</em>'}</li>`).join('')}</ol>`;
  }
  function arTopHtml(b) {
    if (!b.top.length) return '<p class="ar-empty">الترتيب فاضي. أول من يفوز يتصدر!</p>';
    const rows = b.top.slice(0, 5); const meIn = rows.some(x => x.me);
    const row = x => `<li class="ar-tr ${x.me ? 'me' : ''}"><span class="rk">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</span>${avatarHtml(x.a, x.n, 32)}<span class="ar-hn"><b>${esc(x.n)}</b><small>${x.w} فوز من ${x.g}</small></span><b class="ar-tv">${x.r}</b></li>`;
    return `<ol class="ar-list">${rows.map(row).join('')}${!meIn && b.me ? `<li class="ar-gap" aria-hidden="true">⋯</li>${row(b.me)}` : ''}</ol>`;
  }
  // لوحة الأزرار حسب الحالة: جاهز · يدور · غرفة صديق · ما فيه أحد
  function arPanel() {
    const el = $('#arp'); if (!el) return; clearInterval(AR.stm);
    const live = AR.info && AR.info.live;
    const liveTxt = live && live.online ? `<p class="ar-live"><i></i>${live.waiting ? 'فيه طالب يدور خصم الحين' : `${live.online} في الساحة الحين`}</p>` : '';
    const err = AR.err ? `<p class="ar-err" role="alert">${esc(AR.err)}</p>` : '';
    if (AR.st === 'search') {
      el.innerHTML = `<div class="ar-srch"><div class="ar-radar" aria-hidden="true"><i></i><i></i>${avatarHtml(arMe().a, arMe().n, 54)}</div><div><b>ندوّر لك على خصم…</b><span id="arel">0:00</span><small>أول طالب يضغط «ابحث عن خصم» يدخل معك مباشرة.</small></div></div>
        <div class="ar-acts"><button class="ar-gh" id="arcx">إلغاء</button><button class="ar-lk" id="arrm">أو تحدَّ صديقك برابط</button></div>`;
      const tick = () => { const e = $('#arel'); if (e) e.textContent = fmtDur((arNow() - AR.since) / 1000); }; tick(); AR.stm = setInterval(tick, 1000);
    } else if (AR.st === 'room') {
      const link = location.origin + '/p/#duel-' + AR.code;
      const msg = `تحداك ${arMe().n} في ساحة Q-Guide ⚔️ 20 سؤال قدرات مباشر. ادخل من الرابط: ${link}`;
      el.innerHTML = `<div class="ar-room"><b>أرسل الرابط لصاحبك</b><small>أول ما يفتحه تبدأ المباراة. الرابط صالح 10 دقائق وأنت في هالصفحة.</small>
        <div class="ar-link"><input id="arlk" readonly value="${esc(link)}" dir="ltr" aria-label="رابط التحدي"><button class="ar-cp" id="arcp">نسخ</button></div>
        <div class="ar-acts">${navigator.share ? '<button class="rz-go" id="arsh">مشاركة الرابط</button>' : ''}<a class="ar-gh" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">واتساب</a><button class="ar-gh" id="arcx">إلغاء</button></div>
        <p class="ar-wait"><span class="ar-dotsl" aria-hidden="true"><i></i><i></i><i></i></span>بانتظار صاحبك… الرمز <b dir="ltr">${esc(AR.code)}</b></p></div>`;
      $('#arcp').onclick = async () => { const i = $('#arlk'); try { await navigator.clipboard.writeText(i.value); toast('انسخ الرابط ✓'); } catch (e) { i.select(); toast('حدد الرابط وانسخه'); } };
      const sh = $('#arsh'); if (sh) sh.onclick = () => navigator.share({ title: 'تحدي Q-Guide', text: msg }).catch(() => {});
    } else if (AR.st === 'connecting' || AR.st === 'joining') {
      el.innerHTML = `<div class="ar-srch"><div class="spin"></div><div><b>${AR.st === 'joining' ? 'ندخلك لتحدي صاحبك…' : 'نتصل بالساحة…'}</b></div></div>`;
    } else if (isFree() && AR.left === 0) {   // 🆓 خلصت مبارياته المجانية اليوم
      el.innerHTML = `<div class="ar-cap"><b>خلصت مبارياتك المجانية اليوم</b><span>ترجع لك ${FREE_GAMES} مباريات بكرة. اشترك في الدورة والعب بدون حد، بكل أسئلة الاختبارات المحاكية.</span>
        <div class="ar-acts"><button class="rz-go" data-sub>⭐ اشترك والعب بدون حد</button></div></div>`;
      bindSub(el);
    } else {
      el.innerHTML = `${err}${AR.st === 'noone' ? '<p class="ar-err">ما لقينا أحد يدور خصم الحين. جرّب بعد شوي، أو أرسل رابط تحدي لصاحبك.</p>' : ''}
        <div class="ar-acts"><button class="rz-go" id="arfd">⚔️ ${AR.st === 'noone' ? 'دوّر مرة ثانية' : 'ابحث عن خصم'}</button><button class="ar-gh" id="arrm">🔗 تحدَّ صديقك</button></div>${liveTxt}${isFree() && AR.left != null ? `<p class="ar-free">باقي لك <b>${AR.left}</b> من ${FREE_GAMES} مباريات مجانية اليوم</p>` : ''}`;
    }
    const f = $('#arfd'); if (f) f.onclick = arFind;
    const rm = $('#arrm'); if (rm) rm.onclick = arRoom;
    const cx = $('#arcx'); if (cx) cx.onclick = arCancel;
  }
  async function arGo(first) {
    AR.err = ''; AR.st = 'connecting'; arPanel();
    try { await arOpen(); } catch (e) { AR.st = 'lobby'; AR.err = 'تعذّر الاتصال بالساحة. تأكد من الإنترنت وحاول مرة ثانية.'; arPanel(); return false; }
    return first();
  }
  function arFind() { return arGo(() => arSend({ t: 'find' })); }
  function arRoom() { return arGo(() => arSend({ t: 'room' })); }
  function arJoin(code) { AR.err = ''; AR.st = 'joining'; arPanel(); arOpen().then(() => arSend({ t: 'join', code })).catch(() => { AR.st = 'lobby'; AR.err = 'تعذّر الاتصال بالساحة. افتح الرابط مرة ثانية.'; arPanel(); }); }
  function arCancel() { arSend({ t: 'cancel' }); AR.st = 'lobby'; arPanel(); setTimeout(arClose, 150); }

  function arMsg(m) {
    if (m.now) AR.off = m.now - Date.now();
    switch (m.t) {
      case 'hi': if (m.left != null) AR.left = m.left; return;
      case 'wait': AR.st = 'search'; AR.since = m.since; return arPanel();
      case 'noone': AR.st = 'noone'; arPanel(); return setTimeout(arClose, 100);
      case 'room': AR.st = 'room'; AR.code = m.code; return arPanel();
      case 'roomexp': AR.st = 'lobby'; AR.err = 'انتهت صلاحية رابط التحدي. سوّ رابط جديد.'; arPanel(); return arClose();
      case 'idle': return;
      case 'err':
        if (m.code === 'limit') {   // 🆓 خلصت مبارياته المجانية (بحث، رابط تحدي، أو إعادة)
          AR.left = 0;
          if (AR.st === 'end') { const n = $('#aragn'); if (n) n.textContent = m.msg; return; }
          AR.st = 'lobby'; AR.err = ''; if ($('#arp')) arPanel(); return arClose();
        }
        if (AR.st === 'end') { const n = $('#aragn'); if (n) n.textContent = m.msg; return; }
        if (AR.m && AR_LIVE.includes(AR.st)) return toast(m.msg);
        AR.st = 'lobby'; AR.err = m.msg; arPanel(); return arClose();
      case 'replaced': AR.wantClose = true; AR.st = 'lobby'; AR.m = null; AR.err = 'فتحت الساحة في نافذة أو جهاز ثاني، فوقفناها هنا.'; window.onbeforeunload = null; return location.hash === '#arena' ? renderArena() : (location.hash = 'arena');
      case 'match': return arMatch(m);
      case 'go': AR.goAt = m.at; return arCount();
      case 'q': return arSeq(() => arOpen1(m.i, m.k).catch(() => {}).then(() => arQ(m)));
      case 'opans': if (m.i === AR.i) { AR.opA = true; arOpStatus(); } return;
      case 'nudge': return arNudged(m);
      case 'nudged': AR.ndNext = m.next; return arNudgeBtn();   // وقت الخادم (نفس مقياس arNow)
      case 'nudgeno': if (m.why === 'wait') AR.ndNext = m.next; else if (m.why === 'answered' && m.i === AR.i) AR.opA = true; else if (m.why === 'gone') AR.opGone = true; return arOpStatus();
      case 'rev': return arSeq(() => arRev(m));
      case 'opleft': AR.opGone = true; arOpStatus(); return;
      case 'opback': AR.opGone = false; arOpStatus(); return;
      case 'end': if (m.left != null) AR.left = m.left; return arSeq(() => arOpenAll(m.ks).then(() => arEnd(m)));
      case 'void': { if (m.left != null) AR.left = m.left; AR.st = 'lobby'; AR.m = null; AR.err = m.msg || 'انلغت المباراة.'; window.onbeforeunload = null; arStop(); arClose(); return location.hash === '#arena' ? renderArena() : (location.hash = 'arena'); }
      case 'againwait': { const n = $('#aragn'); if (n) n.textContent = 'طلبت إعادة المباراة… بانتظار موافقة خصمك.'; const b = $('#arag'); if (b) b.disabled = true; return; }
      case 'againask': { const n = $('#aragn'); if (n) { n.textContent = 'خصمك يبي إعادة المباراة! اضغط «إعادة المباراة» لو تبي.'; n.classList.add('hot'); } const b = $('#arag'); if (b) b.classList.add('pulse'); return; }
    }
  }

  // ---------- المباراة ----------
  async function arMatch(m) {
    if (!AR.m || AR.m.m !== m.m) { AR.B = null; AR.items = []; AR.T = null; AR.qc = null; AR.pendQ = null; AR.ndNext = 0; }   // مباراة جديدة
    AR.m = m; AR.st = 'vs'; AR.end = null; AR.retry = 0; AR.opGone = false;
    AR.sc = m.sc || [0, 0]; AR.hist = m.hist || m.refs.map(() => null); AR.i = m.resume ? m.i : -1;
    if (location.hash !== '#arena') history.replaceState(null, '', '#arena');
    window.onbeforeunload = e => { if (AR.m && AR_LIVE.includes(AR.st)) { e.preventDefault(); e.returnValue = ''; } };
    arView();
    try { AR.B = await arBlob(m.test); await arOpenAll(m.ks); }
    catch (e) { const v = $('#arvm'); if (v) v.innerHTML = 'تعذّر تحميل الأسئلة. <button class="ar-lk" id="arrl">حاول مرة ثانية</button>'; const b = $('#arrl'); if (b) b.onclick = () => arMatch(m); return; }
    if (AR.m !== m) return;
    if (AR.pendQ) { const q = AR.pendQ; await arOpen1(q.i, q.k).catch(() => {}); return arQ(q); }
    if (!m.resume || m.phase === 'prep') { arSend({ t: 'ready', m: m.m }); const v = $('#arvm'); if (v) v.textContent = 'بانتظار خصمك…'; }
    else if (m.phase === 'count') { AR.goAt = m.at; arCount(); }
    else if (m.phase === 'q') arQ({ i: m.i, dl: m.dl, lim: m.qt[m.refs[m.i][2]] * 1000, mine: m.mine, opAns: m.opAns });
    else if (m.phase === 'rev') { arBoard(); const q = $('#arq'); if (q) q.innerHTML = '<div class="ar-hold"><div class="spin"></div>السؤال الجاي…</div>'; }
  }
  function arDots(who) { return AR.m.refs.map((r, j) => { const h = AR.hist[j]; const c = h ? (who === 0 ? (h.mo ? 'ok' : h.my == null ? 'na' : 'bad') : (h.oo ? 'ok' : h.op == null ? 'na' : 'bad')) : ''; return `<i class="${c}${j === AR.i ? ' cur' : ''}" title="${r[2] === 'v' ? 'لفظي' : 'كمي'}"></i>`; }).join(''); }
  function arView() {
    const m = AR.m, me = m.me, op = m.op, myN = arMe();
    app.innerHTML = topbar(`<span class="ttl">⚔️ ${m.kind === 'friend' ? 'تحدي صديق' : 'مباراة الساحة'}</span><span class="sp"></span><button class="ar-quit" id="arqt">انسحاب</button>`, `<span class="brand"><img src="/assets/logo.png" alt="">Q-Guide</span>`) +
      `<main class="wrap arena arm">
        <div class="ar-sb" id="arsb">
          <div class="ar-pl me">${avatarHtml(me.a || myN.a, myN.n, 44)}<span class="ar-pn"><b>أنت</b><small id="arms">${me.r}</small></span><b class="ar-ps" id="ars0">${AR.sc[0]}</b></div>
          <div class="ar-mid"><span class="ar-qc" id="arqc">${AR.i >= 0 ? AR.i + 1 : '–'}<small>/${m.refs.length}</small></span><span class="ar-tm" id="artm">--</span></div>
          <div class="ar-pl op"><b class="ar-ps" id="ars1">${AR.sc[1]}</b><span class="ar-pn"><b>${esc(op.n || 'خصمك')}</b><span class="ar-os"><small id="aros">${op.r}</small><button type="button" class="ar-nd" id="arnd" hidden aria-label="نبّه خصمك يستعجل">⏰ نبّه</button></span></span>${avatarHtml(op.a, op.n, 44)}</div>
          <div class="ar-dots" aria-hidden="true"><div class="r"><span>أنت</span><div id="ard0">${arDots(0)}</div></div><div class="r"><span>خصمك</span><div id="ard1">${arDots(1)}</div></div></div>
          <div class="ar-bar"><i id="arbar"></i></div>
          <div class="ar-ndn" id="arndn" role="status" aria-live="assertive" hidden></div>
        </div>
        <div id="arnote" class="ar-note" hidden></div>
        <div id="arq"><div class="ar-vs"><div class="ar-vp me">${avatarHtml(me.a || myN.a, myN.n, 88)}<b>${esc(myN.n)}</b><span>تصنيف ${me.r}</span></div><div class="ar-vx" id="arvx">VS</div><div class="ar-vp op">${avatarHtml(op.a, op.n, 88)}<b>${esc(op.n || 'خصمك')}</b><span>تصنيف ${op.r}</span></div></div>
          <p class="ar-vsm" id="arvm">نحمّل الأسئلة…</p></div>
      </main>`;
    bindCtl();
    $('#arnd').onclick = arNudge;
    $('#arqt').onclick = async () => { if (!AR.m || !AR_LIVE.includes(AR.st)) return; if (await QGDlg.confirm('تنسحب من المباراة؟ تنحسب لك خسارة.', { ok: 'انسحاب' })) { arSend({ t: 'quit', m: AR.m.m }); } };
    document.onkeydown = e => { if (AR.st !== 'q' || e.ctrlKey || e.metaKey || e.altKey) return; const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(String(e.key).toLowerCase()); if (k >= 0) { e.preventDefault(); arAns(k); } };
    if (AR.st === 'q') arQ({ i: AR.i, dl: AR.dl, lim: AR.lim, mine: AR.mine, opAns: AR.opA });
  }
  function arNote(t, cls) { const n = $('#arnote'); if (!n) return; n.hidden = !t; n.textContent = t || ''; n.className = 'ar-note ' + (cls || ''); }
  function arCount() {
    AR.st = 'vs'; arStop(); if (!$('#arvx')) arView();
    const v = $('#arvm'), x = $('#arvx');
    const run = () => { const s = Math.ceil((AR.goAt - arNow()) / 1000); if (s <= 0) { arStop(); return; } if (x) { x.textContent = s; x.classList.add('n'); } if (v) v.textContent = 'المباراة تبدأ بعد'; };
    run(); AR.tm = setInterval(run, 200);
  }
  function arBoard() {
    const d0 = $('#ard0'), d1 = $('#ard1'); if (d0) d0.innerHTML = arDots(0); if (d1) d1.innerHTML = arDots(1);
    const qc = $('#arqc'); if (qc) qc.innerHTML = `${Math.max(1, AR.i + 1)}<small>/${AR.m.refs.length}</small>`;
    const s0 = $('#ars0'), s1 = $('#ars1'); if (s0) s0.textContent = AR.sc[0]; if (s1) s1.textContent = AR.sc[1];
  }
  function arOpStatus() {
    const s = $('#aros'); if (!s || !AR.m) return;
    s.className = AR.opGone ? 'gone' : AR.opA && AR.st === 'q' ? 'done' : '';
    s.textContent = AR.opGone ? 'انقطع اتصاله…' : AR.st === 'q' ? (AR.opA ? 'جاوب ✓' : 'يفكر…') : AR.m.op.r;
    if (AR.st === 'q' && AR.mine != null) { const st = $('#arst'); if (st) st.innerHTML = AR.opA || AR.opGone ? '<span class="spin sm"></span> نكشف الإجابة…' : '<span class="spin sm"></span> بانتظار خصمك…'; }
    arNudgeBtn();
  }
  // ⏰ «نبّه خصمك»: يطلع وقت ما خصمك يفكر، وينضغط مرة كل 10 ثواني
  function arNudgeBtn() {
    const b = $('#arnd'); if (!b) return;
    const can = !!AR.m && AR.st === 'q' && !AR.opA && !AR.opGone; b.hidden = !can; if (!can) return;
    const left = Math.ceil(((AR.ndNext || 0) - arNow()) / 1000), wait = left > 0;
    const txt = !wait ? '⏰ نبّه' : left >= 9 ? '✓ وصل' : '⏰ ' + left;
    if (b.textContent !== txt) b.textContent = txt;
    b.disabled = wait; b.classList.toggle('sent', wait && left >= 9);
    b.title = wait ? `تقدر تنبّهه مرة ثانية بعد ${left} ثواني` : 'نبّه خصمك يستعجل';
  }
  function arNudge() {
    if (!AR.m || AR.st !== 'q' || AR.opA || AR.opGone || (AR.ndNext || 0) > arNow()) return;
    AR.ndNext = arNow() + 10000; arNudgeBtn();
    arSend({ t: 'nudge', m: AR.m.m });
  }
  function arNudged(m) {   // خصمك نبّهك
    if (!AR.m || AR.st !== 'q' || m.i !== AR.i || AR.mine != null) return;
    const n = $('#arndn'); if (n) { n.textContent = `⏰ ${(m.n || AR.m.op.n || 'خصمك').slice(0, 18)} يستعجلك، جاوب بسرعة!`; n.hidden = false; n.classList.remove('in'); void n.offsetWidth; n.classList.add('in');
      clearTimeout(AR.ndT); AR.ndT = setTimeout(() => { n.hidden = true; }, 3200); }
    const av = $('.ar-pl.op .av'); if (av && !RM()) { av.classList.remove('ar-shk'); void av.offsetWidth; av.classList.add('ar-shk'); }
    try { navigator.vibrate && navigator.vibrate([90, 60, 90]); } catch (e) {}
  }
  function arQ(m) {
    if (!AR.m) return;
    if (!AR.B) { AR.pendQ = m; return; }
    AR.pendQ = null;
    AR.st = 'q'; AR.i = m.i; AR.dl = m.dl; AR.lim = m.lim; AR.mine = m.mine != null ? m.mine : null; AR.opA = !!m.opAns;
    if (!$('#arsb')) arView();
    arBoard(); arNote(''); const nn = $('#arndn'); if (nn) nn.hidden = true;
    const it = arItem(m.i), n = AR.m.refs.length;
    if (!it) { $('#arq').innerHTML = '<div class="ar-hold">تعذّر عرض هذا السؤال. ننتقل للي بعده…</div>'; return; }
    const ty = it.type;
    let h = `<div class="q ar-q"><div class="hd"><span class="n">سؤال ${m.i + 1}<small>من ${n}</small></span><span class="tag">${AR_T[ty] || ''}</span></div>`;
    if (ty === 'quant') h += `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${m.i + 1}">`;
    else h += `<p class="ar-in ltr">${AR_IN[ty] || ''}</p><p class="txt ltr">${ty === 'ana' ? '<b>' + esc(it.q) + '</b>' : esc(it.q)}</p>`;
    const two = ty === 'quant' || it.opts.every(o => o.length <= 28);
    h += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => `<button type="button" class="opt${AR.mine === k ? ' sel' : ''}" data-k="${k}" ${AR.mine != null ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span class="ot">${esc(ty === 'quant' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></button>`).join('') + '</div>';
    h += `<div class="ar-st" id="arst">${AR.mine != null ? '' : 'اختر إجابتك بسرعة<span class="kb">، أو اضغط 1 إلى 4 من الكيبورد</span>'}</div></div>`;
    $('#arq').innerHTML = h;
    document.querySelectorAll('#arq .opt').forEach(b => b.onclick = () => arAns(+b.dataset.k));
    arOpStatus();
    const bar = $('#arbar'), tm = $('#artm');
    const tick = () => {
      const left = Math.max(0, AR.dl - arNow()), s = Math.ceil(left / 1000);
      if (tm) { tm.textContent = fmtDur(s); tm.classList.toggle('low', s <= 5); }
      arNudgeBtn();
      if (bar) { bar.style.width = (left / AR.lim * 100).toFixed(1) + '%'; bar.classList.toggle('low', s <= 5); }
      if (left <= 0) { arStop(); const st = $('#arst'); if (st && AR.mine == null) st.textContent = 'انتهى الوقت ⏱'; document.querySelectorAll('#arq .opt').forEach(b => b.disabled = true); }
    };
    arStop(); tick(); AR.tm = setInterval(tick, 200);
    window.scrollTo({ top: 0, behavior: RM() ? 'auto' : 'smooth' });
  }
  function arAns(k) {
    if (AR.st !== 'q' || AR.mine != null || !AR.m || arNow() > AR.dl + 500) return;
    AR.mine = k;
    document.querySelectorAll('#arq .opt').forEach(b => { b.disabled = true; b.classList.toggle('sel', +b.dataset.k === k); });
    arSend({ t: 'ans', m: AR.m.m, i: AR.i, c: k });
    arOpStatus();
  }
  function arRev(m) {
    if (!AR.m) return;
    AR.st = 'rev'; arStop(); AR.sc = m.sc;
    AR.hist[m.i] = { k: m.k, my: m.me.c, mo: m.me.ok, op: m.op.c, oo: m.op.ok, mp: m.me.p, opp: m.op.p };
    const op = AR.m.op;
    document.querySelectorAll('#arq .opt').forEach(b => {
      const k = +b.dataset.k; b.disabled = true; b.classList.remove('sel');
      if (k === m.k) b.classList.add('ok'); else if (k === m.me.c) b.classList.add('bad');
      if (k === m.op.c) b.insertAdjacentHTML('beforeend', `<span class="ar-om" title="اختيار خصمك">${avatarHtml(op.a, op.n, 24)}</span>`);
    });
    const st = $('#arst');
    if (st) st.innerHTML = `<span class="ar-mine ${m.me.ok ? 'ok' : 'bad'}">${m.me.ok ? `صح! <bdi dir="ltr">+${m.me.p}</bdi>` : m.me.c == null ? 'ما جاوبت' : 'إجابتك خطأ'}</span><span class="ar-his">${esc(op.n || 'خصمك')}: ${m.op.ok ? `صح <bdi dir="ltr">+${m.op.p}</bdi>` : m.op.c == null ? 'ما جاوب' : 'خطأ'}</span>`;
    if (m.me.ok) arPop('#ars0', m.me.p); if (m.op.ok) arPop('#ars1', m.op.p);
    arBoard(); AR.opA = false; arOpStatus(); const nn = $('#arndn'); if (nn) nn.hidden = true;
    const tm = $('#artm'); if (tm) tm.classList.remove('low');
  }
  function arPop(sel, p) {
    const el = $(sel); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    if (RM()) return; const s = document.createElement('span'); s.className = 'ar-pop'; s.textContent = '+' + p; el.parentElement.appendChild(s); setTimeout(() => s.remove(), 1200);
  }
  function arEnd(m) {
    if (!AR.m) return;
    AR.st = 'end'; AR.end = m; arStop(); window.onbeforeunload = null; AR.sc = m.sc;
    AR.done = m.done; m.keys.forEach((k, j) => { if (j < m.done && !AR.hist[j]) AR.hist[j] = { k, my: m.my[j], mo: m.my[j] === k, op: m.op[j], oo: m.op[j] === k, mp: m.pts[0][j], opp: m.pts[1][j] }; });
    AR.i = -1; arBoard(); arOpStatus(); const qc = $('#arqc'); if (qc) qc.innerHTML = `${m.done}<small>/${AR.m.refs.length}</small>`; const tm = $('#artm'); if (tm) tm.textContent = 'انتهت'; const bar = $('#arbar'); if (bar) bar.style.width = '0%';
    const qt = $('#arqt'); if (qt) qt.remove();
    const op = AR.m.op, win = m.res === 'win', why = m.why;
    const head = { win: 'فزت!', loss: 'خسرت هالمرة', draw: 'تعادل' }[m.res];
    const sub = why === 'quit' ? (win ? 'خصمك انسحب من المباراة.' : 'انسحبت من المباراة.') : why === 'left' ? (win ? 'انقطع اتصال خصمك وما رجع.' : 'انقطع اتصالك وما رجعت في الوقت.')
      : win ? `جاوبت ${m.cor[0]} صح من 20 وجبت نقاط أكثر من ${esc(op.n || 'خصمك')}.` : m.res === 'draw' ? 'نفس النقاط بالضبط!' : `${esc(op.n || 'خصمك')} جاب نقاط أكثر. راجع الأسئلة تحت وارجع أقوى.`;
    const rt = m.rated && m.r ? `<p class="ar-rtc">تصنيفك <b>${m.r.now}</b> <em class="${m.r.d >= 0 ? 'up' : 'dn'}" dir="ltr">${m.r.d >= 0 ? '+' : ''}${m.r.d}</em></p>` : '<p class="ar-rtc">مباراة بدون تصنيف</p>';
    $('#arq').innerHTML = `<section class="ar-end ${m.res}">
      <div class="ar-eh"><h2>${head}</h2><p>${sub}</p></div>
      <div class="ar-fin"><div class="me">${avatarHtml(AR.m.me.a || arMe().a, arMe().n, 56)}<b dir="ltr">${m.sc[0]}</b><span>${m.cor[0]} صح</span></div><span class="ar-fx">–</span><div class="op">${avatarHtml(op.a, op.n, 56)}<b dir="ltr">${m.sc[1]}</b><span>${m.cor[1]} صح</span></div></div>
      ${rt}
      ${isFree() && AR.left === 0 ? `<div class="ar-acts c"><button class="rz-go" data-sub>⭐ اشترك والعب بدون حد</button><button class="btn ghost" id="arbk">رجوع للساحة</button></div><p class="ar-free">هذي كانت آخر مباراة مجانية لك اليوم، وترجع لك ${FREE_GAMES} مباريات بكرة.</p>`
        : `<div class="ar-acts c"><button class="rz-go" id="arag">إعادة المباراة</button><button class="btn" id="arnw">خصم جديد</button><button class="btn ghost" id="arbk">رجوع للساحة</button></div>${isFree() && AR.left != null ? `<p class="ar-free">باقي لك <b>${AR.left}</b> من ${FREE_GAMES} مباريات مجانية اليوم</p>` : ''}`}
      <p class="ar-agn" id="aragn" aria-live="polite"></p>
      ${m.done ? `<details class="ar-rv" id="arrvd"><summary>راجع ${m.done === 20 ? 'الأسئلة الـ20' : m.done === 1 ? 'السؤال' : 'الأسئلة الـ' + m.done} وإجاباتها</summary><div id="arrv"></div></details>` : ''}
    </section>`;
    if (win && !RM()) confetti();
    if (AR.info) { if (m.rated && m.r) AR.info.r = m.r.now; AR.info.hist = null; }
    const ag = $('#arag'); if (ag) ag.onclick = () => { arSend({ t: 'again', m: m.m }); };
    const nw = $('#arnw'); if (nw) nw.onclick = () => { AR.st = 'lobby'; AR.m = null; renderArena().then(() => arFind()); };
    bindSub($('#arq'));
    $('#arbk').onclick = () => { AR.st = 'lobby'; AR.m = null; arClose(); renderArena(); };
    const rvd = $('#arrvd'); if (rvd) rvd.addEventListener('toggle', async () => { const r = $('#arrv'); if (!r || r.dataset.on) return; r.dataset.on = 1;
      if (!isFree()) { r.innerHTML = '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; try { AR.T = await arTest(AR.m.test); } catch (e) {} }   // الشرح من ملف الاختبار (للمشتركين)
      r.innerHTML = arReview(); bindSub(r); }, { once: true });
  }
  function arReview() {
    const op = AR.m.op;
    const full = (r) => AR.T ? AR.T.sections[r[0] - 1].items[r[1]] : null;
    return (isFree() ? '<p class="ar-exl">🔒 شرح كل سؤال للمشتركين في الدورة. <button type="button" class="lnk" data-sub>اشترك</button></p>' : '') + AR.m.refs.slice(0, AR.done == null ? AR.m.refs.length : AR.done).map((r, j) => {
      const it = arItem(j), h = AR.hist[j] || {}; if (!it) return ''; const ty = it.type, fx = full(r), exp = fx && fx.exp;
      const lab = o => esc(ty === 'quant' ? o.replace(/^[A-D]\)\s*/, '') : o);
      return `<article class="ar-ri"><div class="ar-rih"><b>سؤال ${j + 1}</b><span class="tag">${AR_T[ty] || ''}</span><span class="ar-rir ${h.mo ? 'ok' : 'bad'}">${h.mo ? `أنت صح +${h.mp || 0}` : h.my == null ? 'ما جاوبت' : 'أنت خطأ'}</span><span class="ar-rio">${esc(op.n || 'خصمك')}: ${h.oo ? 'صح' : h.op == null ? 'ما جاوب' : 'خطأ'}</span></div>
        ${ty === 'quant' ? `<img src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${j + 1}" loading="lazy">` : `<p class="ltr">${esc(it.q)}</p>`}
        <ul class="ar-ro ltr">${it.opts.map((o, k) => `<li class="${k === h.k ? 'k' : k === h.my ? 'w' : ''}"><b>${LETTERS[k]}</b> ${lab(o)}${k === h.my ? ' <small>اختيارك</small>' : ''}${k === h.op ? ' <small>خصمك</small>' : ''}</li>`).join('')}</ul>
        ${exp ? `<details class="ar-ex"><summary>الشرح</summary><div>${fmtExp(exp)}</div></details>` : ''}</article>`;
    }).join('');
  }

  // 🤖 المساعد الذكي «اشرح لي» (assets/ai.js): نفس منسّق المعادلات، ونافذة الاشتراك للزائر
  if (window.QGAI) QGAI.init({ api: QG.API, session: () => auth && auth.session, fmt: arFx, free: isFree, onSub: () => subDlg('', 'المساعد الذكي'), onAuth: r => setTimeout(() => { QGAI.close(); logout(esc(r.msg || '')); }, 1800) });
  applyFs(); applyTheme();
  if (!gsiFromHash()) route();
})();
