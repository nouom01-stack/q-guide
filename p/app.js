/* Q-Guide practice app — vanilla JS, RTL. Data sets are AES-GCM encrypted; the key comes from the API after Google sign-in. */
(function () {
  'use strict';
  if (location.protocol === 'http:' && /q-guide\.online$/.test(location.hostname)) { location.replace('https://' + location.host + location.pathname + location.search + location.hash); return; }
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} return; }
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const LS = { auth: 'qg_auth', prog: 'qg_prog_', fs: 'qg_fs', tab: 'qg_tab' };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const PART_AR = { 1: 'التناظر اللفظي', 2: 'إكمال الجمل', 3: 'الخطأ السياقي', 4: 'استيعاب المقروء' };
  let auth = null, manifest = null, cryptoKey = null;
  const cache = {};

  // ---------- utils ----------
  const MATHRUN = /([0-9A-Za-z√π°²³⁴¹⁰⁻⁺\(\)\[\]\+\-−×÷=≈≤≥<>\/\.,%:'’ ]*[0-9A-Za-z√π][0-9A-Za-z√π°²³⁴¹⁰⁻⁺\(\)\[\]\+\-−×÷=≈≤≥<>\/\.,%:'’ ]*)/g;
  function fmtExp(t) {
    return String(t || '').split('\n').filter(l => !/^\s*(📝\s*)?الشرح:?\s*$/.test(l)).map(l => {
      const line = esc(l).replace(MATHRUN, m => /[0-9A-Za-z√π]/.test(m) && m.trim().length > 1 ? '<bdi dir="ltr">' + m + '</bdi>' : m);
      return line;
    }).join('\n');
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  let toastT; function toast(m) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  function applyFs() { const f = lsGet(LS.fs, 1); document.documentElement.style.setProperty('--fs', f); }
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
    const out = []; set.groups.forEach((g, gi) => g.items.forEach(it => out.push({ it, gi, idx: out.length })));
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
      auth = { name: r.name, email: r.email, key: r.key, exp: r.exp, session: r.session, gender: r.gender || '' };
      lsSet(LS.auth, auth); location.hash = ''; route();
    } catch (e) { renderLogin('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'); }
  }

  // ---------- home ----------
  function topbar(inner, left) {
    return `<header class="top"><div class="w">${left || `<a class="brand" href="#"><img src="/assets/logo.png" alt="">Q-Guide</a>`}${inner || ''}</div></header>`;
  }
  async function renderHome() {
    document.title = 'منصة التدريب | Q-Guide';
    if (!manifest) { try { manifest = await (await fetch('/p/data/manifest.json')).json(); } catch (e) { app.innerHTML = '<div class="center">تعذّر تحميل البيانات. حدّث الصفحة.</div>'; return; } }
    const tab = lsGet(LS.tab, 'quant');
    const first = (auth.name || '').trim().split(/\s+/)[0] || '';
    const hi = auth.gender === 'طالبة' ? 'أهلاً' : 'أهلاً';
    app.innerHTML = topbar(`<span class="sp"></span><span class="chip" title="${esc(auth.email)}">${esc(auth.name || auth.email)}</span><button class="ib" id="lo" title="تسجيل الخروج">⎋</button>`) +
    `<main class="wrap">
      <div class="hero"><div><h1>${hi} ${esc(first)} 👋</h1><p>تدرّب قسماً قسماً: كل سؤال مع شرحه بعد الإجابة مباشرة، وتقدّمك محفوظ.</p></div>
      <div class="tabs"><button data-t="quant" class="${tab === 'quant' ? 'on' : ''}">📐 الكمي <small>(14 قسم)</small></button><button data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}">📖 اللفظي <small>(14 نموذج)</small></button></div></div>
      <div class="grid" id="grid"></div>
    </main>`;
    $('#lo').onclick = () => { if (confirm('تسجيل الخروج؟')) logout('', true); };
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
  }

  // ---------- player ----------
  let P = null; // player state
  async function renderPlayer(id) {
    app.innerHTML = topbar(`<span class="ttl">جارٍ التحميل…</span>`, `<a class="ib" href="#" title="رجوع">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto 12px"></div>تحميل الأسئلة…</div>';
    let set; try { set = await loadSet(id); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#">→</a>`) + '<div class="center">تعذّر فتح الأسئلة (' + esc(e.message) + '). <a href="#">رجوع</a></div>'; return; }
    const items = flatItems(set); const prog = progGet(id);
    if (!prog.started) prog.started = Date.now();
    let cur = prog.last || 0; if (cur >= items.length) cur = 0;
    // resume: first unanswered after last
    if (prog.a[cur] && Object.keys(prog.a).length < items.length) { const nx = items.findIndex((x, i) => i >= cur && !prog.a[i]); cur = nx >= 0 ? nx : items.findIndex((x, i) => !prog.a[i]); if (cur < 0) cur = 0; }
    P = { id, set, items, prog, cur, t0: Date.now(), passOpen: {} };
    document.title = set.title + ' | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">${esc(set.title)} <small style="opacity:.8;font-weight:400">· ${esc(set.sub.split(' · ').pop())}</small></span><span class="sp"></span>
      <button class="ib" id="navb" title="قائمة الأسئلة">☷</button><span class="chip cnt" id="cnt" dir="ltr"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<div class="pbar"><i id="pb"></i></div><main class="wrap" id="pm"></main>
      <div class="nav" id="nav"><div class="bg"></div><div class="sh"><div class="lg"><span><i style="background:var(--okbg);border:1px solid var(--ok)"></i>صحيحة</span><span><i style="background:var(--badbg);border:1px solid var(--bad)"></i>خاطئة</span><span><i style="background:#EEF1F8"></i>لم تُجب</span><span class="sp"></span><button class="btn sm ghost" id="reset">↻ إعادة القسم من البداية</button></div><div class="ng" id="ng"></div></div></div>`;
    $('#navb').onclick = () => { renderNav(); $('#nav').classList.add('open'); };
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
    else if (k === 'enter' || k === 'arrowleft') { const n = $('#next'); if (n) n.click(); }
    else if (k === 'arrowright') { const p = $('#prev'); if (p) p.click(); }
  }
  function updateCounter() {
    const n = Object.keys(P.prog.a).length; $('#cnt').textContent = (P.cur + 1) + ' / ' + P.items.length;
    $('#pb').style.width = Math.round(n * 100 / P.items.length) + '%';
  }
  function showQ(i) {
    const { set, items, prog } = P; P.cur = i; prog.last = i; progSet(P.id, prog); updateCounter();
    const { it, gi } = items[i]; const a = prog.a[i];
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
      <span class="fsz" title="حجم الخط"><button id="fsm">A-</button><button id="fsp">A+</button></span>
      ${a ? `<button class="btn" id="next">${i + 1 < items.length ? 'التالي ←' : 'النتيجة 🏁'}</button>` : `<button class="btn ghost sm" id="next" title="تخطي">تخطي ←</button>`}</div>
      <div class="kbd" style="margin-top:8px">اختصارات: A–D أو 1–4 للإجابة · Enter للتالي</div></div>`;
    $('#pm').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' });
    const ph = $('#ph'); if (ph) ph.onclick = () => { const p = $('#pass'); p.classList.toggle('closed'); P.passOpen[gi] = !p.classList.contains('closed'); $('#pch').textContent = P.passOpen[gi] ? '▲' : '▼'; };
    document.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(i, +b.dataset.k));
    $('#prev').onclick = () => showQ(i - 1);
    $('#next').onclick = () => { if (i + 1 < items.length) showQ(i + 1); else finish(); };
    $('#fsm').onclick = () => bumpFs(-.1); $('#fsp').onclick = () => bumpFs(.1);
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
    const n = $('#next'); n.className = 'btn'; n.textContent = (i + 1 < P.items.length) ? 'التالي ←' : 'النتيجة 🏁'; n.title = '';
    updateCounter();
    const done = Object.keys(P.prog.a).length === P.items.length;
    if (done) setTimeout(() => { if ($('#next')) $('#next').textContent = 'النتيجة 🏁'; }, 0);
  }
  function renderNav() {
    const ng = $('#ng'); ng.innerHTML = P.items.map((x, i) => { const a = P.prog.a[i]; return `<button class="${a ? (a.c ? 'ok' : 'bad') : ''} ${i === P.cur ? 'cur' : ''}" data-i="${i}">${i + 1}</button>`; }).join('');
    ng.querySelectorAll('button').forEach(b => b.onclick = () => { $('#nav').classList.remove('open'); showQ(+b.dataset.i); });
  }
  async function finish() {
    const { items, prog, set } = P; const n = items.length; const answered = Object.keys(prog.a).length;
    if (answered < n && !confirm('باقي ' + (n - answered) + ' سؤال بدون إجابة. تعرض النتيجة الآن؟')) return;
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
      const r = await api({ op: 'result', session: auth.session, set: set.id, kind: set.kind, n, correct, secs, wrong: wrong.map(i => items[i].it.n).join(',') });
      $('#saved').textContent = r.ok ? 'تم حفظ نتيجتك ✓' : '';
      if (!r.ok && r.error === 'session') { toast('انتهت الجلسة، سجّل دخولك من جديد'); }
    } catch (e) { $('#saved').textContent = ''; }
  }

  applyFs();
  route();
})();
