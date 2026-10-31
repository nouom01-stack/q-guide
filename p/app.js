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
  function ctlHtml() { return `<span class="ctl"><button id="fsm" title="تصغير الخط">A-</button><button id="fsp" title="تكبير الخط">A+</button><button id="dm" title="الوضع الداكن/الفاتح">🌙</button></span>`; }
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
      if (k === 'q') obj = { kind: 'quant', id: 'qall', title: 'الاختبار الشامل — الكمي', sub: 'All 14 sections', items: [].concat(...parts.map(p => p.items.map(it => Object.assign({}, it, { src: p.id })))) };
      else obj = { kind: 'verbal', id: 'vall', title: 'الاختبار الشامل — اللفظي', sub: 'All 14 models', groups: [].concat(...parts.map(p => p.groups.map(g => Object.assign({}, g, { title: (g.kind === 'part' ? p.title + ' · ' : '') + g.title, src: p.id })))) };
      cache[id] = obj; return obj;
    }
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
    } catch (e) {} finally { hbBusy = false; }
  }
  setInterval(heartbeat, 3 * 60 * 1000);

  // ---------- routing ----------
  function route() {
    auth = lsGet(LS.auth, null);
    if (auth && auth.exp && auth.exp < Date.now()) { auth = null; lsDel(LS.auth); }
    if (!auth) return renderLogin();
    heartbeat();
    const h = location.hash.replace('#', '');
    if (/^[qv]\d+$/.test(h)) return renderPlayer(h);
    if (/^wb-[qv]$/.test(h)) return renderWorkbook(h.slice(3));
    if (h === 'board' || h === 'board-exam') return renderBoard(h === 'board-exam' ? 'exam' : 'practice');
    if (h === 'qall' || h === 'vall') return renderPlayer(h);
    if (h === 'plan') return renderPlan();
    renderHome();
  }
  window.addEventListener('hashchange', route);

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
      <p class="note" style="margin-top:8px"><a href="/privacy/">سياسة الخصوصية</a> · <a href="/terms/">الشروط</a></p>
    </div></div>`;
    mountGoogle();
  }
  let gTries = 0;
  function mountGoogle() {
    const host = $('#gbtn'); if (!host) return;
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 60) return setTimeout(mountGoogle, 150); host.innerHTML = '<span style="color:var(--bad)">تعذّر تحميل تسجيل الدخول، حدّث الصفحة.</span>'; return; }
    try {
      google.accounts.id.initialize({ client_id: window.QG.CLIENT_ID, callback: onCredential, ux_mode: 'popup', auto_select: false, itp_support: true });
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
      auth = { name: r.name, email: r.email, phone: r.phone || '', key: r.key, exp: r.exp, session: r.session, gender: r.gender || '', role: r.role || 'student', files: r.files || null, display: r.display || r.name, avatar: r.avatar || '' };
      lsSet(LS.auth, auth); location.hash = ''; route();
    } catch (e) { renderLogin('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'); }
  }

  // ---------- home ----------
  function topbar(inner, left) {
    return `<header class="top"><div class="w">${left || `<a class="brand" href="#"><img src="/assets/logo.png" alt="">Q-Guide</a>`}${ctlHtml()}${inner || ''}</div></header>`;
  }
  async function renderHome() {
    document.title = 'منصة التدريب | Q-Guide';
    if (!manifest) { try { manifest = await (await fetch('/p/data/manifest.json')).json(); } catch (e) { app.innerHTML = '<div class="center">تعذّر تحميل البيانات. حدّث الصفحة.</div>'; return; } }
    const tab = lsGet(LS.tab, 'quant');
    const first = (auth.name || '').trim().split(/\s+/)[0] || '';
    const hi = auth.gender === 'طالبة' ? 'أهلاً' : 'أهلاً';
    const adminLinks = auth.role === 'admin' ? `<a class="chip" style="text-decoration:none;background:var(--gold);color:#1a1a1a;font-weight:700" href="https://docs.google.com/spreadsheets/d/1RaKf8jqdIJ2tsZx95jhxhqyNq0scSvnzPyfttYch8CI" target="_blank" rel="noopener" title="الطلاب · الدخول · النتائج">👑 الشيت</a>` : '';
    app.innerHTML = topbar(`<span class="sp"></span><a class="ib" href="#board" title="لوحة الصدارة">🏆</a>${adminLinks}<button class="chip me" id="me" title="ملفي: الاسم والصورة">${avatarHtml(auth.avatar, auth.display || auth.name, 26)}<span>${esc(auth.display || auth.name || auth.email)}</span></button><button class="ib" id="lo" title="تسجيل الخروج">⎋</button>`) +
    `<main class="wrap">
      <div class="hero"><div><h1>${hi} ${esc(first)} 👋</h1><p>تدرّب قسماً قسماً: كل سؤال مع شرحه بعد الإجابة مباشرة، وتقدّمك محفوظ.</p></div>
      <div class="tabs"><button data-t="quant" class="${tab === 'quant' ? 'on' : ''}">📐 الكمي <small>(14 قسم)</small></button><button data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}">📖 اللفظي <small>(14 نموذج)</small></button></div></div>
      <div class="grid" id="grid"></div>
      <h2 class="h2">🏁 الاختبار الشامل</h2>
      <div class="wb" id="mega"></div>
      <h2 class="h2">📘 مذكراتك الخاصة</h2>
      <div class="wb" id="wb"><div class="mut">جارٍ تحميل مذكراتك…</div></div>
      <h2 class="h2">🧪 الاختبارات المحاكية</h2>
      <a class="mock" href="/test/"><span><b>17 اختباراً محاكياً لقياس</b><br><span class="mut">4 أقسام × 24 سؤال · 25 دقيقة لكل قسم · نفس شكل الاختبار المحوسب</span></span><span class="btn">ادخل ←</span></a>
      <h2 class="h2">📅 خطة المذاكرة</h2>
      <a class="mock plan" href="#plan" id="plancard"><span><b>جدول مذاكرتك اليومي</b><br><span class="mut">اختر الخطة اللي تناسب وقتك (7 / 14 / 19 / 28 يوماً) وعلّم ✓ على كل يوم تنجزه</span></span><span class="btn">افتح ←</span></a>
    </main>`;
    $('#lo').onclick = () => { if (confirm('تسجيل الخروج؟')) logout('', true); };
    $('#me').onclick = () => renderProfile();
    bindCtl();
    const mega = (id, title, n, desc) => { const pr = progGet(id); const ans = Object.keys(pr.a).length; const pct = Math.round(ans * 100 / n);
      return `<button class="set wide ${pct === 100 ? 'done' : ''}" data-id="${id}"><span class="t">${title}</span><span class="s">${desc}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="meta"><span>${ans ? (pct === 100 ? 'مكتمل ✓' : 'أجبت ' + ans + ' من ' + n) : n + ' سؤال'}</span>${pr.best != null ? `<span class="badge">أفضل نتيجة ${pr.best}%</span>` : '<span style="color:#B7BFD0">لم تبدأ</span>'}</span></button>`; };
    const nq = manifest.quant.reduce((a, b) => a + b.n, 0), nv = manifest.verbal.reduce((a, b) => a + b.n, 0);
    $('#mega').innerHTML = mega('qall', '📐 كل أسئلة الكمي', nq, 'الأقسام الـ14 كاملة في اختبار واحد متواصل — ' + nq + ' سؤال') + mega('vall', '📖 كل أسئلة اللفظي', nv, 'النماذج الـ14 كاملة من الأول إلى الأخير — ' + nv + ' سؤال');
    $('#mega').querySelectorAll('.set').forEach(b => b.onclick = () => { location.hash = b.dataset.id; });
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { lsSet(LS.tab, b.dataset.t); renderHome(); });
    const grid = $('#grid');
    grid.innerHTML = manifest[tab].map((s, i) => {
      const p = progGet(s.id); const ans = Object.keys(p.a).length; const pct = s.n ? Math.round(ans * 100 / s.n) : 0;
      const corr = Object.values(p.a).filter(x => x.c).length;
      const best = p.best != null ? `<span class="badge">أفضل نتيجة ${p.best}%</span>` : (ans ? `<span class="badge g">${corr}/${ans} صحيحة</span>` : `<span style="color:#B7BFD0">لم تبدأ</span>`);
      return `<button class="set ${pct === 100 ? 'done' : ''}" data-id="${s.id}"><span class="num">${i + 1}</span><span class="t">${esc(s.title)}</span><span class="s ltr" style="text-align:right;direction:rtl">${esc(s.sub)}${s.range ? ' · ' + s.range : ''}</span>
        <span class="bar"><i style="width:${pct}%"></i></span><span class="meta"><span>${ans ? (pct === 100 ? 'مكتمل ✓ · ' + s.n + ' سؤال' : 'أجبت ' + ans + ' من ' + s.n) : s.n + ' سؤال'}</span>${best}</span></button>`;
    }).join('');
    grid.querySelectorAll('.set').forEach(b => b.onclick = () => { location.hash = b.dataset.id; });
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
  let P = null; // player state
  async function renderPlayer(id) {
    app.innerHTML = topbar(`<span class="ttl">جارٍ التحميل…</span>`, `<a class="ib" href="#" title="رجوع">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل الأسئلة…</span></div>';
    let set; try { set = await loadSet(id); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#">→</a>`) + '<div class="center">تعذّر فتح الأسئلة (' + esc(e.message) + '). <a href="#">رجوع</a></div>'; return; }
    const items = flatItems(set); const prog = progGet(id);
    if (!prog.started) prog.started = Date.now();
    let cur = items.findIndex((x, i) => !prog.a[i]); if (cur < 0) cur = Math.min(prog.last || 0, items.length - 1);   // أول سؤال بدون إجابة
    P = { id, set, items, prog, cur, t0: Date.now(), passOpen: {}, sel: null };
    document.title = set.title + ' | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">${esc(set.title)} <small style="opacity:.8;font-weight:400">· ${esc(set.sub.split(' · ').pop())}</small></span><span class="sp"></span>
      <button class="ib" id="navb" title="قائمة الأسئلة">☷</button><span class="chip cnt" id="cnt" dir="ltr"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<div class="pbar"><i id="pb"></i></div><main class="wrap" id="pm"></main>
      <div class="nav" id="nav"><div class="bg"></div><div class="sh"><div class="lg"><span><i style="background:var(--okbg);border:1px solid var(--ok)"></i>صحيحة</span><span><i style="background:var(--badbg);border:1px solid var(--bad)"></i>خاطئة</span><span><i style="background:#EEF1F8"></i>لم تُجب</span><span class="sp"></span><button class="btn sm ghost" id="reset">↻ إعادة القسم من البداية</button></div><div class="ng" id="ng"></div></div></div>`;
    $('#navb').onclick = () => { renderNav(); $('#nav').classList.add('open'); };
    bindCtl();
    $('#nav .bg').onclick = () => $('#nav').classList.remove('open');
    $('#reset').onclick = () => { if (confirm('تُحذف إجاباتك في هذا القسم وتبدأ من جديد؟')) { const best = prog.best; progSet(id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(id); } };
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
    $('#pb').style.width = Math.round(n * 100 / P.items.length) + '%';
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
        <div class="pass ${open ? '' : 'closed'}" id="pass"><div class="ph" id="ph"><span>📄 القطعة <span class="ar">اضغط للإخفاء/الإظهار</span></span><span id="pch">${open ? '▲' : '▼'}</span></div><div class="pb">${esc(g.passage)}</div></div>`;
      }
    }
    const tag = set.kind === 'quant' ? (it.part ? `Question ${it.n} (Part ${it.part})` : `Question ${it.n}`) : `Q ${it.n}`;
    html += `<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${items.length}</small></span><span class="tag ltr">${tag}</span></div>`;
    if (set.kind === 'quant') html += `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="Question ${it.n}">`;
    else html += `<p class="txt ltr">${esc(it.q)}</p>`;
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
    const ph = $('#ph'); if (ph) ph.onclick = () => { const p = $('#pass'); p.classList.toggle('closed'); P.passOpen[gi] = !p.classList.contains('closed'); $('#pch').textContent = P.passOpen[gi] ? '▲' : '▼'; };
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (P.prog.a[i]) return; P.sel = +b.dataset.k; document.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', +x.dataset.k === P.sel)); const c = $('#confirm'); if (c) c.disabled = false; });
    $('#prev').onclick = () => showQ(i - 1);
    const nx = $('#next'); if (nx) nx.onclick = () => { if (i + 1 < items.length) showQ(i + 1); else finish(); };
    const cf = $('#confirm'); if (cf) cf.onclick = () => { if (P.sel == null) return; answer(i, P.sel); };
  }
  function feedback(it, a) {
    const ok = a.s === it.ans; const corr = it.opts[it.ans];
    return `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="h">${ok ? '✅ إجابة صحيحة، أحسنت!' : '❌ إجابة خاطئة'}</div>
      ${ok ? '' : `<div class="ans">الإجابة الصحيحة: <b>${LETTERS[it.ans]}) ${esc(corr.replace(/^[A-D]\)\s*/, ''))}</b></div>`}
      ${it.exp ? `<div class="exl">الشرح</div><div class="ex">${fmtExp(it.exp)}</div>` : ''}</div>`;
  }
  function answer(i, k) {
    const { it } = P.items[i]; if (P.prog.a[i]) return;
    P.prog.a[i] = { s: k, c: k === it.ans ? 1 : 0, t: Date.now() }; progSet(P.id, P.prog);
    document.querySelectorAll('.opt').forEach(b => { b.disabled = true; const kk = +b.dataset.k; if (kk === it.ans) b.classList.add('ok'); else if (kk === k) b.classList.add('bad'); });
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
    const secs = Math.round((Date.now() - (prog.started || Date.now())) / 1000);
    const wrong = items.map((x, i) => i).filter(i => prog.a[i] && !prog.a[i].c);
    const firstTime = !prog.done;
    if (prog.best == null || pct > prog.best) prog.best = pct; prog.done = 1; progSet(P.id, prog);
    document.onkeydown = null;
    $('#pm').innerHTML = `<div class="sum"><div class="ring" style="--p:${pct}"><b>${pct}<small>%</small></b></div>
      <h2>${pct >= 85 ? 'ممتاز! 🌟' : pct >= 70 ? 'جيد جداً 👏' : pct >= 50 ? 'جيد، كمّل تدريب 💪' : 'راجع الشرح وأعد المحاولة 📘'}</h2>
      <p style="color:var(--mut);margin:0">${esc(set.title)} · ${esc(set.sub)}</p>
      <div class="stats"><div class="ok"><b>${correct}</b><span>صحيحة</span></div><div class="bad"><b>${answered - correct}</b><span>خاطئة</span></div><div><b>${n - answered}</b><span>بدون إجابة</span></div><div><b>${Math.max(1, Math.round(secs / 60))}</b><span>دقيقة</span></div></div>
      <div class="acts" style="justify-content:center"><button class="btn gold" id="again">↻ إعادة القسم</button>${wrong.length ? `<button class="btn" id="rev">مراجعة الأخطاء (${wrong.length})</button>` : ''}<a class="btn ghost" href="#">الرئيسية</a></div>
      ${wrong.length ? `<div class="wl"><h3>الأسئلة الخاطئة — اضغط على الرقم لمراجعة الشرح:</h3><div class="ng">${wrong.map(i => `<button class="bad" data-i="${i}">${i + 1}</button>`).join('')}</div></div>` : ''}
      <p id="saved" class="kbd" style="margin-top:14px"></p></div>`;
    $('#again').onclick = () => { const best = prog.best; progSet(P.id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(P.id); };
    const rv = $('#rev'); if (rv) rv.onclick = () => { document.onkeydown = onKey; showQ(wrong[0]); };
    document.querySelectorAll('.wl button').forEach(b => b.onclick = () => { document.onkeydown = onKey; showQ(+b.dataset.i); });
    window.scrollTo(0, 0);
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
    $('#chg').onclick = () => { if (confirm('تغيير الخطة؟ (علامات الإنجاز الحالية تُحفظ لو رجعت لنفس الخطة لاحقاً)')) { const all = lsGet('qg_plan_all', {}); all[plan.id] = done; lsSet('qg_plan_all', all); lsSet(PLAN_LS, { id: '', done: {} }); renderPlan(); } };
    $('#rst').onclick = () => { if (confirm('مسح كل علامات الإنجاز والبدء من اليوم 1؟')) { lsSet(PLAN_LS, { id: plan.id, done: {}, started: Date.now() }); renderPlan(); } };
    if (cur) { const el = $('#day' + cur.n); if (el && days.length > 8) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150); }
  }

  // ---------- 🏆 لوحة الصدارة ----------
  async function renderBoard(kind) {
    document.title = 'لوحة الصدارة | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">🏆 لوحة الصدارة</span><span class="sp"></span><button class="ib" id="lbref" title="تحديث">⟳</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap"><div class="tabs" style="margin-bottom:14px"><button data-k="practice" class="${kind === 'practice' ? 'on' : ''}">📚 اختبارات الأقسام</button><button data-k="exam" class="${kind === 'exam' ? 'on' : ''}">🧪 الاختبارات المحاكية</button></div>
      <p class="mut" style="margin:0 0 14px;font-size:14px">${kind === 'exam' ? 'الترتيب بمجموع درجات <b>أول محاولة</b> لكل اختبار محاكي (من 96)، وعند التساوي الأسرع وقتاً. المحاولات بعدها للتدريب ولا تدخل في الترتيب.' : 'الترتيب بمجموع نتيجة <b>أول محاولة</b> لك في كل قسم ونموذج، وعند التساوي الأسرع وقتاً. أعد أي قسم كما تشاء للتدريب — لا يتغير ترتيبك إلا بأقسام جديدة.'}</p>
      <div id="lb"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
    bindCtl(); document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { location.hash = b.dataset.k === 'exam' ? 'board-exam' : 'board'; }); $('#lbref').onclick = () => renderBoard(kind);
    let r; try { r = await api({ op: 'leaderboard', session: auth.session, kind }); } catch (e) { r = null; }
    const el = $('#lb'); if (!el) return;
    if (!r || !r.ok) { if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || '')); el.innerHTML = '<div class="center">تعذّر تحميل اللوحة</div>'; return; }
    const fmt = s => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h} س ${m % 60} د` : m ? `${m} د` : `${s} ث`; };
    const acc = x => x.q ? Math.round(x.score * 100 / x.q) : 0;
    const unit = kind === 'exam' ? 'اختبار' : 'قسم';
    const mine = r.me ? `<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${r.total} ${r.total === 1 ? 'طالب' : 'طالباً'}</b><span>${r.me.score} إجابة صحيحة · ${fmt(r.me.secs)} · ${r.me.done} ${unit}${r.me.done > 1 ? (kind === 'exam' ? 'ات' : '') : ''}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">اختبار جديد</a>' : '<a class="btn sm" href="#">تدرّب</a>'}</div>`
      : `<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>${kind === 'exam' ? 'أنهِ اختباراً محاكياً واحداً وتظهر هنا.' : 'حل قسماً أو نموذجاً واحداً وتظهر هنا.'}</span></div>${kind === 'exam' ? '<a class="btn sm" href="/test/">ابدأ اختباراً</a>' : '<a class="btn sm" href="#">ابدأ قسماً</a>'}</div>`;
    if (!r.top.length) { el.innerHTML = mine + `<div class="sum" style="margin-top:12px">🏆 اللوحة فاضية — كن أول من يظهر هنا!</div>`; return; }
    const medal = k => ['🥇', '🥈', '🥉'][k - 1] || '';
    const top3 = r.top.slice(0, 3), rest = r.top.slice(3);
    const podium = top3.length >= 3 ? `<div class="podium">${[1, 0, 2].map(i => { const x = top3[i]; return `<div class="pd p${x.rank} ${x.me ? 'me' : ''}">${avatarHtml(x.a, x.n, x.rank === 1 ? 72 : 60)}<div class="pr">${medal(x.rank)}</div><b title="${esc(x.n)}">${esc(x.n)}</b><span class="pscore">${x.score} <small>✓</small></span><span>${acc(x)}% دقة · ${fmt(x.secs)}</span></div>`; }).join('')}</div>` : '';
    const list = top3.length >= 3 ? rest : r.top;
    el.innerHTML = mine + podium + `<div class="lbl-list">
      <div class="lbr head"><span class="rk">#</span><span class="nm">الطالب</span><span class="sc">الصحيحة</span><span class="ac">الدقة</span><span class="tm">الوقت</span><span class="dn">${kind === 'exam' ? 'الاختبارات' : 'الأقسام'}</span></div>
      ${list.map(x => `<div class="lbr ${x.me ? 'me' : ''} ${x.rank <= 3 ? 'top' : ''}"><span class="rk">${x.rank <= 3 ? medal(x.rank) : x.rank}</span>${avatarHtml(x.a, x.n, 38)}<span class="nm">${esc(x.n)}</span>${x.me ? '<span class="you">أنت</span>' : ''}<span class="sc"><b>${x.score}</b> ✓</span><span class="ac">${acc(x)}%</span><span class="tm">${fmt(x.secs)}</span><span class="dn">${x.done}</span></div>`).join('')}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">الترتيب: الأعلى إجابات صحيحة، وعند التساوي الأقل وقتاً. يُعرض أفضل 100 طالب، واللوحة تتحدث كل دقيقة. تقدر تغيّر اسمك وصورتك من زر اسمك في الصفحة الرئيسية.</p>`;
  }

  applyFs(); applyTheme();
  route();
})();
