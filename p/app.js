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
    const r = await fetch('/p/data/' + id + '.bin', { cache: 'force-cache' });
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
  async function skillsPull() { if (!auth) return histGet(); try { const r = await api({ op: 'skills_get', session: auth.session }); if (r.ok && r.data) { const rem = JSON.parse(r.data); const h = histMergeInto(histGet(), rem); histSet(h); daysMerge(rem.days); return h; } } catch (e) {} return histGet(); }
  function skillsPushSoon(ms) { clearTimeout(skillsT); skillsT = setTimeout(skillsPush, ms || 6000); }
  async function skillsPush() { if (!auth || skillsSyncing) return; skillsSyncing = true; try { const h = histGet(); await api({ op: 'skills_set', session: auth.session, data: JSON.stringify({ v: 1, items: h.items, days: daysGet() }) }); } catch (e) {} finally { skillsSyncing = false; } }

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
  window.addEventListener('pagehide', () => { if (skillsT) { clearTimeout(skillsT); skillsT = 0; try { navigator.sendBeacon && auth && navigator.sendBeacon(window.QG.API, new Blob([JSON.stringify({ op: 'skills_set', session: auth.session, data: JSON.stringify({ v: 1, items: histGet().items, days: daysGet() }) })], { type: 'text/plain' })); } catch (e) {} } });
  // مجموعات التدريب الموجّه: t-<موضوع> أو t-wrong-q / t-wrong-v
  async function loadTopicSet(id) {
    const m = id.match(/^t-(wrong-([qv])|([a-z]+))$/); if (!m) throw new Error('bad set');
    const topic = m[3], kind = m[2] ? (m[2] === 'q' ? 'quant' : 'verbal') : (TOPICS[topic] || {}).k; if (!kind) throw new Error('bad set');
    const k = kind === 'quant' ? 'q' : 'v'; let got = 0; const el = () => document.getElementById('ldmsg');
    const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const e = el(); if (e) e.textContent = 'تجهيز الأسئلة… ' + got + ' / 14'; return p; })));
    const h = histGet();
    const keep = (it, src, sidx) => m[2] ? (h.items[src] && h.items[src][sidx] && !h.items[src][sidx][2]) : itemTopics(it).indexOf(topic) >= 0;
    const title = m[2] ? ('🔁 مراجعة أخطائي — ' + (kind === 'quant' ? 'الكمي' : 'اللفظي')) : (TOPICS[topic].i + ' تدريب: ' + TOPICS[topic].t);
    let obj;
    if (kind === 'quant') obj = { kind, id, title, sub: m[2] ? 'My mistakes' : 'Topic practice', items: [].concat(...parts.map(p => p.items.map((it, j) => Object.assign({}, it, { src: p.id, sidx: j })).filter(it => keep(it, p.id, it.sidx)))) };
    else obj = { kind, id, title, sub: m[2] ? 'My mistakes' : 'Topic practice', groups: [].concat(...parts.map(p => originGroups(p).map(g => Object.assign({}, g, { items: g.items.filter(it => keep(it, p.id, it.sidx)) })).filter(g => g.items.length))) };
    obj.topicSet = true; if (!m[2]) cache[id] = obj;   // مراجعة الأخطاء تتغيّر مع كل إجابة فلا تُخزَّن
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
    heartbeat();
    if (skillsT) { clearTimeout(skillsT); skillsT = 0; skillsPush(); }   // ادفع سجل المهارات قبل الانتقال
    const h = location.hash.replace('#', '');
    if (/^[qv]\d+$/.test(h)) return renderPlayer(h);
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
    else if (R.mode === 'new') { kick = 'جاهز تبدأ؟'; title = nm; sub = `${st.n} سؤال، وكل سؤال معه شرحه`; cta = 'ابدأ ' + SET_NAME(rs.id); cur = 0; }
    else { kick = 'خلّصت كل الأقسام 🎉'; title = 'راجع الأسئلة اللي غلطت فيها'; sub = 'التدريب على أخطائك يثبّت المعلومة قبل الاختبار'; cta = 'مراجعة أخطائي'; href = '#skills'; cur = -1; }
    const C = 2 * Math.PI * 20, dash = Math.min(1, today / goal) * C, met = today >= goal;
    return `<section class="rz" aria-label="متابعة المذاكرة">
      <div class="rz-top"><h1 class="rz-hi">أهلاً ${esc(first)} 👋</h1>
        <div class="rz-streak" title="الأيام اللي حليت فيها أسئلة"><span class="rz-fire ${streak ? '' : 'off'}">🔥 ${streak ? dLabel(streak) + ' ورا بعض' : 'ابدأ سلسلتك اليوم'}</span>
          <span class="rz-week">${wk.map(d => `<i class="${d.n ? 'on' : ''}${d.today ? ' t' : ''}" title="${d.n} سؤال"><b>${d.l}</b></i>`).join('')}</span></div></div>
      <div class="rz-body">
        <div class="rz-what"><span class="rz-k">${kick}</span><b class="rz-set">${title}</b><span class="rz-sub">${sub}</span></div>
        <div class="rz-dots" aria-hidden="true" style="--c:${cols(st.n, 30)};--cm:${cols(st.n, 17)}">${R.mode === 'alldone' ? '' : dotsHtml(rs.id, st.n, cur)}</div>
        <div class="rz-act"><a class="rz-go" href="${href}"><span class="pl">▶</span>${cta}</a>
          <button class="rz-goal ${met ? 'met' : ''} ${today ? '' : 'zero'}" id="goal" title="اضغط لتغيير هدفك اليومي"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="bg"/><circle cx="24" cy="24" r="20" class="fg" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/></svg>
            <span class="gt"><b>${met ? '✓ ' : ''}${today}<small> من ${goal}</small></b><small>${met ? 'حققت هدف اليوم' : 'هدف اليوم'}</small></span></button></div>
      </div></section>`;
  }
  function planRowHtml() {
    const st = planState(); const plan = PLANS.find(p => p.id === st.id); if (!plan) return '';
    const days = plan.build(), done = st.done || {}; const cur = days.find(d => !d.tasks.every((t, i) => done[d.n] && done[d.n][i]));
    if (!cur) return `<a class="prow" href="#plan">🎉 <span>خلّصت ${plan.name} كاملة. بالتوفيق في اختبارك!</span></a>`;
    const links = cur.tasks.filter(t => t.link).map(t => `<a href="${t.link}">${t.lt}</a>`);
    const what = links.length ? links.join(' و') : esc(cur.tasks[0].t.replace(/<[^>]+>/g, ''));
    return `<div class="prow"><span class="pi">📅</span><span class="pt"><b>خطتك اليوم</b> <span class="mut">(اليوم ${cur.n} من ${plan.days})</span>: ${what}</span><a class="pgo" href="#plan">افتح الخطة</a></div>`;
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
    const pst = planState(), pl = PLANS.find(p => p.id === pst.id);
    app.innerHTML = topbar(`<span class="sp"></span><nav class="tnav"><a class="tn" href="#board" title="لوحة الصدارة"><span class="i">🏆</span><span class="l">الصدارة</span></a><a class="tn" href="#skills" title="نقاط القوة والضعف"><span class="i">🎯</span><span class="l">مهاراتي</span></a>${adminLinks}</nav><button class="chip me" id="me" title="ملفي: الاسم والصورة">${avatarHtml(auth.avatar, auth.display || auth.name, 26)}<span>${esc(auth.display || auth.name || auth.email)}</span></button><button class="ib lo" id="lo" title="تسجيل الخروج" aria-label="تسجيل الخروج">${LOSVG}</button>`) +
    `<main class="wrap home">
      <div id="rz">${rzHtml()}</div>
      ${planRowHtml()}
      <div class="hrow"><div class="tabs" role="tablist"><button role="tab" data-t="quant" class="${tab === 'quant' ? 'on' : ''}" aria-selected="${tab === 'quant'}">📐 الكمي <small>14 قسم</small></button><button role="tab" data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}" aria-selected="${tab === 'verbal'}">📖 اللفظي <small>14 نموذج</small></button></div>
        <span class="sp"></span><a class="rvid" href="${ytUrl(R.rules.id)}" target="_blank" rel="noopener" title="${esc(R.rules.d)}">${YTSVG}<span>${R.rules.t}</span>${R.rules.dur ? `<small>${R.rules.dur}</small>` : ''}</a><a class="rall" href="https://www.youtube.com/playlist?list=${R.list}" target="_blank" rel="noopener">كل المقاطع</a></div>
      <div class="sheets" id="grid"></div>
      <h2 class="h2">أدوات المذاكرة</h2>
      <section class="tools">
        <a class="tool" href="/test/"><span class="ti">🧪</span><span class="tx"><b>الاختبارات المحاكية</b><small>17 اختبار بنفس شكل اختبار قياس المحوسب، 25 دقيقة لكل قسم</small></span></a>
        <div class="tool"><span class="ti">🏁</span><span class="tx"><b>الاختبار الشامل</b><small>كل الأسئلة في اختبار واحد متواصل</small></span><span class="tbtns"><a href="#qall">الكمي <small>${nq}</small>${megaPct('qall', nq) ? `<em>${megaPct('qall', nq)}%</em>` : ''}</a><a href="#vall">اللفظي <small>${nv}</small>${megaPct('vall', nv) ? `<em>${megaPct('vall', nv)}%</em>` : ''}</a></span></div>
        <a class="tool" href="#skills"><span class="ti">🎯</span><span class="tx"><b>نقاط قوتك وضعفك</b><small>اعرف وش تغلط فيه وتدرّب عليه بس</small></span></a>
        <a class="tool" href="#vocab"><span class="ti">📖</span><span class="tx"><b>قاموس الكلمات</b><small>ترجمة كل كلمة جديدة في النماذج اللفظية</small></span></a>
        <a class="tool" href="#plan"><span class="ti">📅</span><span class="tx"><b>خطة المذاكرة</b><small>${pl ? 'أنت على ' + pl.name : 'اختر خطة 7 أو 14 أو 19 أو 28 يوم'}</small></span></a>
        <a class="tool" href="#board"><span class="ti">🏆</span><span class="tx"><b>لوحة الصدارة</b><small>شوف ترتيبك بين طلاب الدورة</small></span></a>
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
    if (!homePulled) { homePulled = true; skillsPull().then(() => { const z = $('#rz'); if (z && (location.hash === '' || location.hash === '#')) { z.innerHTML = rzHtml(); bindGoal(); } }).catch(() => {}); }
    renderWorkbooks();
    prefetchSets();
  }
  // ⚡ تحميل مسبق هادئ لملفات الأقسام في الخلفية (مرة واحدة لكل جلسة) حتى تفتح فوراً
  let prefetching = false;
  function prefetchSets() {
    if (prefetching || !manifest) return; const c = navigator.connection || {}; if (c.saveData) return; prefetching = true;
    const ids = [...manifest.quant, ...manifest.verbal].map(s => s.id);
    const run = () => { const id = ids.shift(); if (!id) return; fetch('/p/data/' + id + '.bin', { priority: 'low' }).catch(() => {}).finally(() => setTimeout(run, 400)); };
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
  async function renderPlayer(id) {
    app.innerHTML = topbar(`<span class="ttl">جارٍ التحميل…</span>`, `<a class="ib" href="#" title="رجوع">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل الأسئلة…</span></div>';
    let set; try { set = await loadSet(id); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#">→</a>`) + '<div class="center">تعذّر فتح الأسئلة (' + esc(e.message) + '). <a href="#">رجوع</a></div>'; return; }
    if (set.kind === 'verbal') await loadVocab();
    const items = flatItems(set); const prog = progGet(id);
    if (!items.length) { app.innerHTML = topbar(`<span class="ttl">${esc(set.title)}</span>`, `<a class="ib" href="#skills" title="رجوع">→</a>`) + `<div class="center"><div style="font-size:40px">🎉</div><p>ما عندك أخطاء محفوظة في هذا القسم حالياً.<br><span class="mut">حل أسئلة من الأقسام أو التدريب الموجّه، وأي سؤال تخطئ فيه يُجمع لك هنا.</span></p><a class="btn" href="#skills">🎯 نقاط القوة والضعف</a></div>`; bindCtl(); return; }
    if (!prog.started) prog.started = Date.now();
    let cur = items.findIndex((x, i) => !prog.a[i]); if (cur < 0) cur = Math.min(prog.last || 0, items.length - 1);   // أول سؤال بدون إجابة
    P = { id, set, items, prog, cur, t0: Date.now(), lastAct: Date.now(), hidAt: 0, passOpen: {}, sel: null };
    document.title = set.title + ' | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">${esc(set.title)} <small style="opacity:.8;font-weight:400">· ${esc(set.sub.split(' · ').pop())}</small></span><span class="sp"></span>
      ${ytFor(id) ? `<a class="ytb" href="${ytFor(id).url}" target="_blank" rel="noopener" title="شرح ${ytFor(id).label} على يوتيوب">${YTSVG}<span>الشرح</span></a>` : ''}<span class="chip run" id="run" hidden></span><button class="ib" id="navb" title="قائمة الأسئلة">☷</button><span class="chip cnt" id="cnt" dir="ltr"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<div class="sbar" id="sb" style="--n:${items.length}" aria-hidden="true">${items.map((x, i) => `<i class="${prog.a[i] ? (prog.a[i].c ? 'ok' : 'bad') : ''}"></i>`).join('')}</div><main class="wrap" id="pm"></main>
      <div class="nav" id="nav"><div class="bg"></div><div class="sh"><div class="lg"><span><i style="background:var(--okbg);border:1px solid var(--ok)"></i>صحيحة</span><span><i style="background:var(--badbg);border:1px solid var(--bad)"></i>خاطئة</span><span><i style="background:#EEF1F8"></i>لم تُجب</span><span class="sp"></span><button class="btn sm ghost" id="reset">↻ إعادة القسم من البداية</button></div><div class="ng" id="ng"></div></div></div>`;
    $('#navb').onclick = () => { renderNav(); $('#nav').classList.add('open'); };
    bindCtl();
    $('#nav .bg').onclick = () => $('#nav').classList.remove('open');
    $('#reset').onclick = async () => { if (await QGDlg.confirm('تُحذف إجاباتك في هذا القسم وتبدأ من جديد؟', { ok: 'ابدأ من جديد', danger: true })) { const best = prog.best; progSet(id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(id); } };
    showQ(cur);
    document.onkeydown = onKey;
  }
  function onKey(e) {
    if (!P || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const idx = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : ('1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : -1);
    if (idx >= 0) { const b = document.querySelectorAll('.opt')[idx]; if (b && !b.disabled) b.click(); }
    else if (k === 'enter' || k === 'arrowleft') { const c = $('#confirm'); if (c && !c.disabled) return c.click(); const n = $('#next'); if (n && !n.disabled) n.click(); }
    else if (k === 'arrowright') { const p = $('#prev'); if (p) p.click(); }
  }
  function updateCounter() {
    const n = Object.keys(P.prog.a).length; $('#cnt').textContent = (P.cur + 1) + ' / ' + P.items.length;
    const sb = $('#sb'); if (sb) { const o = sb.querySelector('i.cur'); if (o) o.classList.remove('cur'); const c = sb.children[P.cur]; if (c) c.classList.add('cur'); }
  }
  function showQ(i) {
    const { set, items, prog } = P; P.cur = i; prog.last = i; progSet(P.id, prog); updateCounter();
    const { it, gi } = items[i]; const a = prog.a[i]; P.sel = null;
    let html = '';
    if (set.kind === 'verbal') {
      const g = set.groups[gi]; const prevG = i > 0 ? items[i - 1].gi : -1;
      if (g.kind === 'part') html += `<div class="ghd">${esc(g.title)} <small>— ${esc(g.ar || '')}</small></div>`;
      else {
        const open = P.passOpen[gi] != null ? P.passOpen[gi] : true;
        html += `<div class="ghd">Passage ${g.num}: ${esc(g.title)} <small>— استيعاب المقروء</small></div>
        <div class="pass ${open ? '' : 'closed'}" id="pass"><div class="ph" id="ph"><span>📄 القطعة <span class="ar">اضغط للإخفاء/الإظهار</span></span><span id="pch">${open ? '▲' : '▼'}</span></div><div class="pb">${wordsHtml(g.passage)}</div>${vocabChips(g.passage, 120) ? `<details class="tr vocab pw"><summary>📖 كلمات القطعة <small>(اضغط على أي كلمة في القطعة لترجمتها)</small></summary><div class="vcs">${vocabChips(g.passage, 120)}</div></details>` : ''}</div>`;
      }
    }
    const tag = set.kind === 'quant' ? (it.part ? `Question ${it.n} (Part ${it.part})` : `Question ${it.n}`) : `Q ${it.n}`;
    html += `<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${items.length}</small></span><span class="tag ltr">${tag}</span></div>`;
    if (set.kind === 'quant') html += `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="Question ${it.n}">`;
    else html += `<p class="txt ltr">${wordsHtml(it.q)}</p>`;
    const two = set.kind === 'quant' || it.opts.every(o => o.length <= 28);
    html += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => {
      const lab = set.kind === 'quant' && /^[A-D]\)\s/.test(o) ? o.replace(/^[A-D]\)\s*/, '') : o;
      let cls = ''; if (a) { if (k === it.ans) cls = 'ok'; else if (k === a.s) cls = 'bad'; }
      return `<button class="opt ${cls}" data-k="${k}" ${a ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span>${esc(lab)}</span></button>`;
    }).join('') + '</div>';
    html += `<div id="fb">${a ? feedback(it, a) : ''}</div>
      <div class="acts"><button class="btn ghost sm" id="prev" ${i === 0 ? 'disabled' : ''}>→ السابق</button><span class="sp"></span>
      ${a ? `<button class="btn" id="next">${i + 1 < items.length ? 'التالي ←' : 'النتيجة 🏁'}</button>` : `<button class="btn gold" id="confirm" disabled>✓ تأكيد الإجابة</button>`}</div>
      <div class="kbd" style="margin-top:8px">${a ? 'Enter للتالي' : 'اختر إجابة ثم اضغط تأكيد · A–D أو 1–4 للاختيار و Enter للتأكيد'}</div></div>`;
    $('#pm').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' });
    bindWords();
    const ph = $('#ph'); if (ph) ph.onclick = () => { const p = $('#pass'); p.classList.toggle('closed'); P.passOpen[gi] = !p.classList.contains('closed'); $('#pch').textContent = P.passOpen[gi] ? '▲' : '▼'; };
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (P.prog.a[i]) return; P.sel = +b.dataset.k; document.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', +x.dataset.k === P.sel)); const c = $('#confirm'); if (c) c.disabled = false; });
    $('#prev').onclick = () => showQ(i - 1);
    const nx = $('#next'); if (nx) nx.onclick = () => { if (i + 1 < items.length) showQ(i + 1); else finish(); };
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
  // 🇸🇦 ترجمة السؤال والخيارات + كلمات السؤال
  function trHtml(it) {
    const ar = it.ar; let h = '';
    if (ar && ar.q) h += `<details class="tr" open><summary>🇸🇦 ترجمة السؤال</summary><div class="trq">${esc(ar.q)}</div><ol class="tro">${it.opts.map((o, k) => `<li class="${k === it.ans ? 'ok' : ''}"><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o)}</span><span class="arr">${esc((ar.o || [])[k] || '')}</span></li>`).join('')}</ol></details>`;
    const chips = vocabChips(it.q + ' ' + it.opts.join(' '), 40);
    if (chips) h += `<details class="tr vocab" open><summary>📖 كلمات السؤال <small>(اضغط على أي كلمة في السؤال لترجمتها)</small></summary><div class="vcs">${chips}</div></details>`;
    return h;
  }
  function answer(i, k) {
    const { it } = P.items[i]; if (P.prog.a[i]) return;
    const nowT = Date.now(); const ms = Math.min(Math.max(0, nowT - (P.lastAct || nowT)), Q_CAP); P.lastAct = nowT;
    P.prog.a[i] = { s: k, c: k === it.ans ? 1 : 0, t: nowT, ms }; progSet(P.id, P.prog);
    const good = k === it.ans; const sbi = $('#sb') && $('#sb').children[i]; if (sbi) sbi.className = (good ? 'ok' : 'bad') + ' cur';
    P.run = good ? (P.run || 0) + 1 : 0; const rc = $('#run'); if (rc) { if (P.run >= 3) { rc.hidden = false; rc.textContent = '🔥 ' + P.run + ' صح ورا بعض'; rc.classList.remove('bump'); void rc.offsetWidth; rc.classList.add('bump'); } else rc.hidden = true; }
    const today = daysAdd(), goal = goalGet(); if (today === goal) setTimeout(() => toast('🎉 حققت هدف اليوم: ' + goal + ' سؤال!'), 700);
    try { const h = histGet(); histMark(h, it.src || P.id, it.sidx != null ? it.sidx : i, k === it.ans, itemTopics(it)); histSet(h); skillsPushSoon(); } catch (e) {}
    document.querySelectorAll('.opt').forEach(b => { b.disabled = true; b.classList.remove('sel'); const kk = +b.dataset.k; if (kk === it.ans) b.classList.add('ok'); else if (kk === k) b.classList.add('bad'); });
    if (!RM()) { const btn = document.querySelector(`.opt[data-k="${k}"]`); if (btn) { if (good) burst(btn.querySelector('.L') || btn); else btn.classList.add('shake'); } }
    $('#fb').innerHTML = feedback(it, P.prog.a[i]);
    const cf = $('#confirm'); if (cf) { cf.outerHTML = `<button class="btn" id="next">${(i + 1 < P.items.length) ? 'التالي ←' : 'النتيجة 🏁'}</button>`; $('#next').onclick = () => { if (i + 1 < P.items.length) showQ(i + 1); else finish(); }; }
    const kb = $('.kbd'); if (kb) kb.textContent = 'Enter للتالي';
    updateCounter();
    const fbEl = $('#fb'); if (fbEl) setTimeout(() => fbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
  function renderNav() {
    let frontier = P.items.findIndex((x, i) => !P.prog.a[i]); if (frontier < 0) frontier = P.items.length;
    const ng = $('#ng'); ng.innerHTML = P.items.map((x, i) => { const a = P.prog.a[i]; const locked = !a && i !== frontier; return `<button class="${a ? (a.c ? 'ok' : 'bad') : ''} ${i === P.cur ? 'cur' : ''}" data-i="${i}" ${locked ? 'disabled title="أجب على الأسئلة بالترتيب"' : ''}>${locked ? '🔒' : i + 1}</button>`; }).join('');
    ng.querySelectorAll('button').forEach(b => b.onclick = () => { $('#nav').classList.remove('open'); showQ(+b.dataset.i); });
  }
  async function finish() {
    const { items, prog, set } = P; const n = items.length; const answered = Object.keys(prog.a).length;
    if (answered < n) { toast('باقي ' + (n - answered) + ' سؤال بدون إجابة'); const f = items.findIndex((x, i) => !prog.a[i]); return showQ(f); }
    const correct = Object.values(prog.a).filter(a => a.c).length; const pct = Math.round(correct * 100 / n);
    const secs = activeSecs(prog);
    const wrong = items.map((x, i) => i).filter(i => prog.a[i] && !prog.a[i].c);
    const firstTime = !prog.done;
    if (prog.best == null || pct > prog.best) prog.best = pct; prog.done = 1; progSet(P.id, prog);
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
  function vocabChips(text, max) {
    if (!VOC) return ''; const seen = new Set(); const out = [];
    for (const m of (text || '').matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); out.push(`<span class="vc"><b>${esc(w)}</b><span>${esc(ar)}</span></span>`); if (out.length >= (max || 40)) break; }
    return out.join('');
  }
  let vtip = null;
  function bindWords() {
    if (bindWords.done) return; bindWords.done = true;
    document.addEventListener('click', e => {
      const w = e.target.closest('.vw'); if (!vtip) { vtip = document.createElement('div'); vtip.className = 'vtip'; document.body.appendChild(vtip); }
      document.querySelectorAll('.vw.hl').forEach(x => x.classList.remove('hl'));
      if (!w) { vtip.classList.remove('on'); return; }
      vtip.innerHTML = `<b class="ltr">${esc(w.textContent)}</b><span>${esc(w.dataset.ar)}</span>`; vtip.classList.add('on'); w.classList.add('hl');
      const r = w.getBoundingClientRect(); const tw = Math.min(260, window.innerWidth - 16); vtip.style.width = tw + 'px';
      vtip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
      const th = vtip.offsetHeight || 60; vtip.style.top = (r.top + window.scrollY - th - 8 > window.scrollY ? r.top + window.scrollY - th - 8 : r.bottom + window.scrollY + 8) + 'px';
    });
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
      vl.innerHTML = list.slice(0, 1500).map(r => { let hd = ''; if (model && r[2] !== lastWhere) { lastWhere = r[2]; hd = `<div class="vh">${esc(r[2])}</div>`; } return hd + `<div class="vr"><b class="ltr">${esc(r[0])}</b><span>${esc(r[1])}</span></div>`; }).join('') + (list.length > 1500 ? `<div class="mut" style="padding:10px">… ابحث لعرض المزيد (${list.length - 1500} كلمة أخرى)</div>` : ''); };
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

  // ---------- 📅 خطة المذاكرة ----------
  const PLAN_Q = ['1-50', '51-100', '101-150', '151-200', '201-250', '251-300', '301-350', '351-400', '401-450', '451-500', '501-550', '551-600', '601-642'];
  const PLAN_QD = ['36:19', '34:43', '35:56', '34:46', '36:17', '35:14', '40:08', '36:51', '', '', '', '', ''];
  const PLAN_VD = ['24:15', '23:59', '19:54', '25:05', '17:50', '23:07', '17:37', '16:33', '', '', '', '', '', ''];
  const pq = i => ({ k: 'q', t: `كمي <bdi dir="ltr">${PLAN_Q[i - 1]}</bdi> — مشاهدة المقطع${PLAN_QD[i - 1] ? ' (' + PLAN_QD[i - 1] + ')' : ''}`, link: '#q' + i, lt: 'حل القسم ' + i });
  const pv = i => ({ k: 'v', t: `لفظي Model ${i} — مشاهدة المقطع${PLAN_VD[i - 1] ? ' (' + PLAN_VD[i - 1] + ')' : ''}`, link: '#v' + i, lt: 'حل النموذج ' + i });
  const pt = (t) => ({ k: 't', t });
  const pr = (t) => ({ k: 'r', t });
  const TEST1 = 'حل الاختبارات: اختبار الكمي + اختبار اللفظي من الوصف — ساعة';
  const PLANS = [
    { id: 'strong', name: 'الخطة القوية', days: 7, daily: 'حوالي 4 ساعات يومياً', fit: 'للي اختباره بعد أسبوع', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let i = 1; i <= 6; i++) d.push({ n: i, time: '≈ 4 ساعات', tasks: [pq(2 * i - 1), pv(2 * i - 1), pq(2 * i), pv(2 * i), pt('حل الاختبارات: اختبارات الوصف للمقاطع الأربعة — ساعتين')] });
        d.push({ n: 7, time: '≈ 4 ساعات', tasks: [pq(13), pv(13), pv(14), pr('مراجعة أخطاء اختبارات الكمي كلها'), pt('حل الاختبارات: اختبارات الوصف للمقاطع الثلاثة — ساعة ونص')] }); return d; } },
    { id: 'intense', name: 'الخطة المكثفة', days: 14, daily: 'حوالي ساعتين يومياً', fit: 'للي اختباره قريب', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let i = 1; i <= 13; i++) d.push({ n: i, time: PLAN_QD[i - 1] && i % 2 ? '≈ ساعة و55 د' : '≈ ساعتين', tasks: [pq(i), pv(i), pt(TEST1)] });
        d.push({ n: 14, time: '≈ ساعتين', tasks: [pr('مراجعة أخطاء اختبارات الكمي كلها (بدل المقطع)'), pv(14), pt(TEST1)] }); return d; } },
    { id: 'balanced', name: 'الخطة المتوازنة', days: 19, daily: 'حوالي ساعتين · 5 أيام بالأسبوع', fit: 'الأنسب لأغلب الطلاب', content: '13 مقطع كمي · 14 مقطع لفظي', star: true,
      build() { const d = []; let k = 1;
        const study = n => d.push({ n, time: '≈ ساعتين', tasks: [pq(k), pv(k), pt(TEST1)], w: Math.ceil(n / 7) }), rev = n => d.push({ n, time: '≈ ساعة', tasks: [pr('مراجعة: أعد حل الأسئلة اللي أخطأت فيها في اختبارات هالأسبوع')], w: Math.ceil(n / 7) }), rest = n => d.push({ n, time: 'راحة', tasks: [{ k: 'rest', t: 'يوم راحة — استرجع نشاطك' }], w: Math.ceil(n / 7) });
        for (let w = 0; w < 2; w++) { for (let i = 1; i <= 5; i++) { study(w * 7 + i); k++; } rev(w * 7 + 6); rest(w * 7 + 7); }
        for (let i = 15; i <= 17; i++) { study(i); k++; }
        d.push({ n: 18, time: '≈ ساعتين', tasks: [pr('مراجعة أخطاء اختبارات الكمي كلها (بدل المقطع)'), pv(14), pt(TEST1)], w: 3 }); rev(19); return d; } },
    { id: 'relaxed', name: 'الخطة المريحة', days: 28, daily: 'يوم مذاكرة ساعتين + يوم مراجعة خفيف', fit: 'للي عنده دوام أو مدرسة', content: '13 مقطع كمي · 14 مقطع لفظي',
      build() { const d = []; for (let k = 1; k <= 14; k++) { const n = 2 * k - 1; const w = Math.ceil(n / 7);
          if (k <= 13) d.push({ n, time: '≈ ساعتين', tasks: [pq(k), pv(k), pt(TEST1)], w }); else d.push({ n, time: '≈ ساعتين', tasks: [pr('مراجعة أخطاء اختبارات الكمي كلها (بدل المقطع)'), pv(14), pt(TEST1)], w });
          d.push({ n: n + 1, time: '≈ 30 دقيقة', tasks: [pr('مراجعة: أعد حل الأسئلة اللي أخطأت فيها أمس + راجع ملاحظاتك')], w: Math.ceil((n + 1) / 7) }); } return d; } },
  ];
  const PLAN_LS = 'qg_plan';
  function planState() { return lsGet(PLAN_LS, { id: '', done: {} }); }
  function renderPlan() {
    document.title = 'خطة المذاكرة | Q-Guide';
    const st = planState(); const plan = PLANS.find(p => p.id === st.id) || null;
    app.innerHTML = topbar(`<span class="ttl">📅 خطة المذاكرة</span><span class="sp"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap" id="planwrap"></main>`;
    bindCtl();
    const W = $('#planwrap');
    if (!plan) {   // اختيار الخطة
      W.innerHTML = `<div class="hero"><div><h1>اختر الخطة اللي تناسب وقتك</h1><p>كل الخطط تغطي المقاطع الـ13 كمي والـ14 لفظي مع اختباراتها. تقدر تغيّر الخطة في أي وقت.</p></div></div>
        <div class="plans">${PLANS.map(p => `<button class="pcard ${p.star ? 'star' : ''}" data-p="${p.id}">${p.star ? '<span class="pstar">⭐ الأنسب لأغلب الطلاب</span>' : ''}<span class="pn">${p.name}</span><span class="pd">${p.days} يوماً</span><span class="pm">⏱ ${p.daily}</span><span class="pm">🎯 ${p.fit}</span><span class="pm mut">${p.content}</span><span class="btn">ابدأ هذه الخطة</span></button>`).join('')}</div>
        <div class="sum" style="margin-top:16px"><b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل اختباره مباشرة • بعد الاختبار اقرأ شرح كل سؤال أخطأت فيه وسجّل أخطاءك عشان ترجع لها • علّم ✓ عند إنهاء كل يوم • إذا فاتك يوم كمّل من مكانك ولا تحاول تعوّض يومين في يوم.</div>`;
      W.querySelectorAll('.pcard').forEach(b => b.onclick = () => { const all = lsGet('qg_plan_all', {}); lsSet(PLAN_LS, { id: b.dataset.p, done: all[b.dataset.p] || {}, started: Date.now() }); renderPlan(); });
      return;
    }
    const days = plan.build(); const done = st.done || {};
    const isDone = (d, i) => !!(done[d.n] && done[d.n][i]); const dayDone = d => d.tasks.every((t, i) => isDone(d, i));
    const nDone = days.filter(dayDone).length; const cur = days.find(d => !dayDone(d)); const pct = Math.round(nDone * 100 / days.length);
    const icon = { q: '🔵', v: '🟢', t: '🟠', r: '🟠', rest: '😴' };
    let lastW = 0;
    W.innerHTML = `<div class="hero"><div><h1>${plan.name} <small class="mut" style="font-size:15px;font-weight:500">${plan.days} يوماً · ${plan.daily}</small></h1>
        <p>${cur ? `أنت في <b>اليوم ${cur.n}</b> — أنجزت ${nDone} من ${days.length} يوماً` : '🎉 أنهيت الخطة كاملة! جاهز للاختبار بإذن الله.'}</p></div>
        <div class="pctl"><button class="chip" id="chg">تغيير الخطة</button><button class="chip" id="rst" title="يمسح علامات الإنجاز">إعادة البدء</button></div></div>
      <div class="bar big"><i style="width:${pct}%"></i></div>
      <div class="days">${days.map(d => { const wk = plan.days > 14 && d.w !== lastW ? `<div class="wk">الأسبوع ${d.w}</div>` : ''; lastW = d.w || lastW; const dd = dayDone(d); const isCur = cur && cur.n === d.n;
        return wk + `<section class="day ${dd ? 'done' : ''} ${isCur ? 'cur' : ''}" id="day${d.n}"><header><label class="dchk"><input type="checkbox" data-day="${d.n}" ${dd ? 'checked' : ''}><span>اليوم ${d.n}</span></label><span class="mut">${d.time}</span>${isCur ? '<span class="now">اليوم الحالي</span>' : ''}</header>
          <ul>${d.tasks.map((t, i) => `<li class="${isDone(d, i) ? 'ok' : ''} k${t.k}"><label><input type="checkbox" data-day="${d.n}" data-i="${i}" ${isDone(d, i) ? 'checked' : ''}><span class="ic">${icon[t.k] || ''}</span><span class="tt">${t.t}</span></label>${t.link ? `<a class="go" href="${t.link}">${t.lt} ↗</a>` : ''}</li>`).join('')}</ul></section>`; }).join('')}</div>
      <div class="sum" style="margin-top:16px">🔵 كمي · 🟢 لفظي · 🟠 اختبارات ومراجعة — <b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل اختباره مباشرة، واقرأ شرح كل سؤال أخطأت فيه. إذا فاتك يوم كمّل من مكانك ولا تعوّض يومين في يوم.<br><span class="mut">ملاحظة: القسم 14 من الكمي (<bdi dir="ltr">643-733</bdi>) إضافي خارج الجدول — حِلّه بعد ما تخلص الخطة أو في أيام المراجعة.</span></div>`;
    const save = () => lsSet(PLAN_LS, Object.assign(st, { done }));
    W.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { done[c.dataset.day] = done[c.dataset.day] || {}; if (c.checked) done[c.dataset.day][c.dataset.i] = 1; else delete done[c.dataset.day][c.dataset.i]; save(); renderPlan(); });
    W.querySelectorAll('input[data-day]:not([data-i])').forEach(c => c.onchange = () => { const d = days.find(x => x.n == c.dataset.day); done[d.n] = {}; if (c.checked) d.tasks.forEach((t, i) => done[d.n][i] = 1); save(); renderPlan(); });
    $('#chg').onclick = async () => { if (await QGDlg.confirm('تغيير الخطة؟ (علامات الإنجاز الحالية تُحفظ لو رجعت لنفس الخطة لاحقاً)', { ok: 'تغيير' })) { const all = lsGet('qg_plan_all', {}); all[plan.id] = done; lsSet('qg_plan_all', all); lsSet(PLAN_LS, { id: '', done: {} }); renderPlan(); } };
    $('#rst').onclick = async () => { if (await QGDlg.confirm('مسح كل علامات الإنجاز والبدء من اليوم 1؟', { ok: 'إعادة البدء', danger: true })) { lsSet(PLAN_LS, { id: plan.id, done: {}, started: Date.now() }); renderPlan(); } };
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
