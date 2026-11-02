/* Q-Guide mock GAT (English) exam — Qiyas-style UI. 4 sections x 24 Q, 25 min each, server-timed, one attempt. */
(function () {
  'use strict';
  if (location.protocol === 'http:' && /q-guide\.online$/.test(location.hostname)) { location.replace('https://' + location.host + location.pathname + location.search + location.hash); return; }
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} return; }
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const LS = { auth: 'qg_auth', fs: 'qg_exfs', ex: 'qg_ex_', exState: 'qg_ex_state' };
  const LETTERS = ['A', 'B', 'C', 'D'];
  // نعزل التعابير الرياضية داخل الترجمة العربية حتى ما يتلخبط ترتيبها
  const MRUN = /[A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*[A-Za-z0-9√π∠△∥][A-Za-z0-9\u00B2\u00B3\u00B9\u2070-\u209F√∛∜π∞∠△°%+\-−–×÷=≠≈<>≤≥^\/().,:'′″|∥⊥·⁄\[\]{} ]*/g;
  function arMath(s) {
    s = String(s || ''); let out = '', last = 0;
    for (const m of s.matchAll(MRUN)) {
      const t = m[0], a = m.index; let lead = t.match(/^[\s.,:]*/)[0].length, trail = t.match(/[\s.,:]*$/)[0].length; let core = t.slice(lead, t.length - trail);
      while (core.endsWith(')') && (core.match(/\(/g) || []).length < (core.match(/\)/g) || []).length) { core = core.slice(0, -1); trail++; }
      while (core.startsWith('(') && (core.match(/\(/g) || []).length > (core.match(/\)/g) || []).length) { core = core.slice(1); lead++; }
      if (!/[A-Za-z0-9√π∠△∥]/.test(core)) continue;
      out += esc(s.slice(last, a + lead)) + `<bdi dir="ltr">${esc(core)}</bdi>`; last = a + t.length - trail;
    }
    return out + esc(s.slice(last));
  }
  const INSTR = { ana: 'Choose the pair of words that best expresses a relationship similar to that in the original pair.', sen: 'Choose the word(s) that best complete(s) the sentence.',
    err: 'Choose the word that is used incorrectly in the context of the sentence.', read: 'Read the passage and answer the question.', quant: 'Solve the problem and choose the best answer.' };
  let auth = null, manifest = null, cryptoKey = null, state = null; const cache = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const today = () => new Date().toISOString().slice(0, 10);
  async function api(body) {
    const r = await fetch(window.QG.API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    return r.json();
  }
  function hex2buf(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  async function loadTest(id) {
    if (cache[id]) return cache[id];
    const r = await fetch('/test/data/' + id + '.bin?v=3', { cache: 'force-cache' }); if (!r.ok) throw new Error('data ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    if (!cryptoKey) cryptoKey = await crypto.subtle.importKey('raw', hex2buf(auth.key), 'AES-GCM', false, ['decrypt']);
    let plain; try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, cryptoKey, buf.slice(12)); } catch (e) { logout(); throw new Error('key'); }
    cache[id] = JSON.parse(new TextDecoder().decode(plain)); return cache[id];
  }
  function applyFs() { document.documentElement.style.setProperty('--fs', lsGet(LS.fs, 1)); }
  function setFs(v) { lsSet(LS.fs, Math.min(1.5, Math.max(.85, +v.toFixed(2)))); applyFs(); }
  function logout(msg) { lsDel(LS.auth); lsDel(LS.exState); auth = null; cryptoKey = null; try { window.google && google.accounts.id.disableAutoSelect(); } catch (e) {} location.hash = ''; renderLogin(msg); }

  // ---------- auth (shared localStorage with /p) ----------
  function route() {
    auth = lsGet(LS.auth, null);
    if (auth && auth.exp && auth.exp < Date.now()) { auth = null; lsDel(LS.auth); }
    if (!auth) return renderLogin();
    renderLobby();
  }
  function renderLogin(err) {
    document.title = 'تسجيل الدخول | Q-Guide';
    app.innerHTML = `<div class="login ar"><div class="card"><img src="/assets/logo.png" alt=""><h1>الاختبارات المحاكية</h1><p class="mut">نفس شكل اختبار قياس المحوسب: 4 أقسام × 24 سؤال، 25 دقيقة لكل قسم</p>
      <div class="gbtn" id="gbtn"><div class="spin"></div></div>${err ? `<div class="err">${err}</div>` : ''}
      <p class="mut" style="font-size:13px">سجّل دخولك بحساب Google <b>نفس الإيميل اللي اشتركت فيه بالدورة</b>.</p><p style="font-size:13px"><a href="/p/">منصة التدريب</a> · <a href="/privacy/">الخصوصية</a></p></div></div>`;
    mountGoogle();
  }
  let gTries = 0;
  // رمز الدخول القادم من وضع إعادة التوجيه (#gsi=...)
  function gsiFromHash() {
    const m = location.hash.match(/[#&]gsi=([^&]+)/); if (!m) { if (/gsierr=1/.test(location.hash)) { history.replaceState(null, '', location.pathname); renderLogin('تعذّر إكمال تسجيل الدخول، حاول مرة أخرى.'); return true; } return false; }
    const cred = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname);
    renderLogin(); onCredential({ credential: cred }); return true;
  }
  function mountGoogle() {
    const host = $('#gbtn'); if (!host) return;
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 60) return setTimeout(mountGoogle, 150); host.textContent = 'تعذّر تحميل تسجيل الدخول، حدّث الصفحة.'; return; }
    google.accounts.id.initialize(Object.assign({ client_id: window.QG.CLIENT_ID, callback: onCredential, auto_select: false, itp_support: true }, window.QG.GSI_REDIRECT ? { ux_mode: 'redirect', login_uri: window.QG.API.replace(/\/$/, '') + '/gsi?to=/test/' } : { ux_mode: 'popup' }));
    host.innerHTML = ''; google.accounts.id.renderButton(host, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ar', width: 280 });
  }
  async function onCredential(resp) {
    const host = $('#gbtn'); if (host) host.innerHTML = '<div class="spin"></div>';
    try {
      const r = await api({ op: 'login', idToken: resp.credential, ua: navigator.userAgent.slice(0, 120) });
      if (!r.ok) return renderLogin(esc(r.msg || 'تعذّر تسجيل الدخول.') + '<br><a href="https://wa.me/966508003683" target="_blank" rel="noopener">تواصل معنا على واتساب 0508003683</a>');
      auth = { name: r.name, email: r.email, phone: r.phone || '', key: r.key, exp: r.exp, session: r.session, gender: r.gender || '', role: r.role || 'student', staff: r.staff || '', files: r.files || {}, display: r.display || r.name, avatar: r.avatar || '' };
      lsSet(LS.auth, auth); route();
    } catch (e) { renderLogin('تعذّر الاتصال بالخادم، حاول مرة أخرى.'); }
  }

  // ---------- header ----------
  function header(dateText) {
    const wa = 'https://wa.me/966508003683?text=' + encodeURIComponent('السلام عليكم، أحتاج دعم فني في الاختبارات المحاكية Q-Guide\n' + (auth.display || auth.name || '') + ' · ' + (auth.email || '') + '\nالمشكلة: ');
    return `<header class="hdr"><div class="lg"><img src="/assets/logo.png" alt="">Q-Guide</div><div class="date">${esc(dateText || today())}</div><a class="wa" href="${wa}" target="_blank" rel="noopener" title="دعم فني عبر واتساب">💬 <span>دعم</span></a>
      <div class="user"><span>${esc(auth.display || auth.name || '')}</span><img src="${auth.avatar ? esc(auth.avatar) : '/assets/logo.png'}" alt="" referrerpolicy="no-referrer" onerror="this.src='/assets/logo.png'"></div></header>`;
  }

  // ---------- lobby ----------
  async function renderLobby() {
    document.title = 'الاختبارات المحاكية | Q-Guide';
    // ⚡ نعرض آخر حالة محفوظة فوراً، ونحدّثها من الخادم في الخلفية
    const cached = lsGet(LS.exState, null); const mine = ++lobbySeq;
    if (cached && cached.e === auth.email && cached.tests) { state = cached.tests; try { if (!manifest) manifest = await (await fetch('/test/data/manifest.json', { cache: 'force-cache' })).json(); paintLobby(true); } catch (e) {} }
    else app.innerHTML = header() + '<div class="page ar"><div class="card center"><div class="spin" style="margin:0 auto 10px"></div>جارٍ تحميل اختباراتك…</div></div>';
    try {
      const [mf, r] = await Promise.all([manifest ? Promise.resolve(manifest) : fetch('/test/data/manifest.json', { cache: 'force-cache' }).then(x => x.json()), api({ op: 'exam_state', session: auth.session })]);
      manifest = mf;
      if (!r.ok) { if (r.error === 'kicked' || r.error === 'session') return logout(esc(r.msg || '')); throw new Error(r.error); }
      state = r.tests; lsSet(LS.exState, { e: auth.email, tests: state, t: Date.now() });
    } catch (e) { if (cached && cached.e === auth.email) return; app.innerHTML = header() + `<div class="page ar"><div class="card">تعذّر الاتصال بالخادم (${esc(e.message)}). <a href="#" onclick="location.reload()">أعد المحاولة</a></div></div>`; return; }
    if (mine !== lobbySeq) return;   // المستخدم انتقل لصفحة أخرى أثناء التحميل
    paintLobby(false);
  }
  let lobbySeq = 0;
  function paintLobby(stale) {
    const cards = manifest.map(t => {
      const s = state[t.id] || { status: 'none' };
      let body, act;
      if (s.status === 'done') { const fn = s.first && s.attempts > 1 ? `<div class="meta">⭐ المحسوب في لوحة الصدارة: المحاولة الأولى ${s.first.pct}% (${s.first.total}/96)</div>` : ''; body = `<div class="score">${s.pct}%<small> · ${s.total}/96</small></div><div class="meta">لفظي ${s.vpct}% · كمي ${s.qpct}% · المحاولة ${s.attempt || 1}</div>${fn}`; act = `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-rev="${t.id}">مراجعة الإجابات</button><button class="btn" data-retake="${t.id}">🔁 إعادة الاختبار</button></div>`; }
      else if (s.status === 'in_progress') { body = `<div class="meta">متوقف عند القسم ${s.nextSection} من 4</div>`; act = `<button class="btn" data-go="${t.id}">متابعة الاختبار</button>`; }
      else { body = `<div class="meta">4 أقسام × 24 سؤال · 25 دقيقة لكل قسم · أول محاولة تُحسب في لوحة الصدارة</div>`; act = `<button class="btn" data-go="${t.id}">ابدأ الاختبار</button>`; }
      const pill = s.status === 'done' ? '<span class="pill done">مكتمل</span>' : s.status === 'in_progress' ? '<span class="pill prog">جارٍ</span>' : '<span class="pill none">لم يبدأ</span>';
      const adm = auth.role === 'admin' && s.status !== 'none' ? `<button class="btn sm ghost" data-reset="${t.id}" style="margin-top:6px">إعادة تعيين (مشرف)</button>` : '';
      return `<div class="tcard"><div style="display:flex;justify-content:space-between;align-items:center"><span class="t">${esc(t.title)}</span>${pill}</div><div class="mut" style="font-size:13px">${esc(t.en)}</div>${body}<div style="margin-top:auto">${act}${adm}</div></div>`;
    }).join('');
    app.innerHTML = header() + `<div class="page ar">
      <div class="card"><h1>الاختبارات المحاكية</h1><p class="mut" style="margin:0">محاكاة كاملة لاختبار قياس (قدرات إنجليزي) المحوسب: كل اختبار 4 أقسام، في كل قسم 24 سؤالاً مختلطاً (لفظي ثم كمي) ومدته 25 دقيقة. المؤقت يعمل من الخادم، ولا يمكن الرجوع لقسم انتهى. <b>المحاولات غير محدودة</b>، لكن <b>أول محاولة فقط</b> هي التي تُحسب في لوحة الصدارة — فادخلها وأنت مستعد.</p>
      <p style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><a class="btn ghost sm" href="/p/">← منصة التدريب</a><a class="btn ghost sm" href="/p/#board-exam">🏆 لوحة الصدارة</a>${stale ? '<span class="mut" style="font-size:12.5px">⟳ جارٍ التحديث…</span>' : ''}</p></div>
      <div class="tests">${cards}</div></div>`;
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => startFlow(b.dataset.go));
    document.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => renderReview(b.dataset.rev));
    document.querySelectorAll('[data-retake]').forEach(b => b.onclick = async () => { if (!await QGDlg.confirm('بدء محاولة جديدة؟ نتيجتك الأولى تبقى هي المحسوبة في لوحة الصدارة، وهذه المحاولة للتدريب.', { ok: 'ابدأ' })) return; [1, 2, 3, 4].forEach(k => lsDel(LS.ex + b.dataset.retake + '_' + k)); startFlow(b.dataset.retake, true); });
    document.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => { if (!await QGDlg.confirm('إعادة تعيين هذا الاختبار لك (مشرف)؟', { danger: true })) return; await api({ op: 'exam_reset', session: auth.session, test: b.dataset.reset }); [1, 2, 3, 4].forEach(k => lsDel(LS.ex + b.dataset.reset + '_' + k)); renderLobby(); });
  }

  // ---------- flow ----------
  let T = null; // current test data
  async function startFlow(id, retake) {
    const s = state[id] || { status: 'none' };
    if (s.status === 'done' && !retake) return renderReview(id);
    app.innerHTML = header() + '<div class="page center"><div class="spin" style="margin:30px auto"></div>Loading test…</div>';
    try { T = await loadTest(id); } catch (e) { return renderLobby(); }
    if (s.status === 'in_progress' && s.deadline && s.deadline > Date.now()) return runSection(id, s.nextSection, s.deadline);
    if (s.status === 'in_progress') return sectionIntro(id, s.nextSection);
    testIntro(id);
  }
  function testIntro(id) {
    app.innerHTML = header() + `<div class="page"><div class="card instr">
      <h1>${esc(T.en)} — Test Instructions</h1>
      <ul>
        <li>The test consists of <b>4 sections</b>, each with <b>24 multiple-choice questions</b> (verbal questions first, then quantitative).</li>
        <li>Each section is timed: <b>25 minutes</b>. The timer runs on the server; closing the page does not stop it.</li>
        <li>When a section's time ends it is submitted automatically and you move to the next section. You cannot return to a previous section.</li>
        <li>Within a section you may move freely between questions, change answers, and mark questions for review.</li>
        <li>Use <b>Save &amp; Next</b> to save your answer. Unanswered questions are counted as wrong. There is no penalty for guessing.</li>
        <li>Use the <b>End Section</b> button only when you have finished the section.</li>
        <li>You may retake the test as many times as you like, but <b>only your first attempt counts</b> on the leaderboard. Your detailed result and explanations appear after the last section.</li>
      </ul>
      <p class="ar mut" style="font-size:14px">الاختبار يحاكي قياس المحوسب بالكامل: المؤقت لكل قسم على حدة، والأسئلة مختلطة (لفظي ثم كمي)، ولا يمكن العودة لقسم انتهى.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end"><a class="btn ghost" href="#" id="back">Back</a><button class="btn" id="start">Start Test</button></div></div></div>`;
    $('#back').onclick = e => { e.preventDefault(); renderLobby(); };
    $('#start').onclick = () => sectionIntro(id, 1);
  }
  function sectionIntro(id, sec) {
    app.innerHTML = header() + `<div class="page"><div class="card instr">
      <h1>Section ${sec} of 4</h1>
      <p><b>24 questions</b> · <b>25 minutes</b>. The timer starts when you press <b>Start Section</b>.</p>
      <ul><li>Verbal: analogy, sentence completion, contextual error, reading comprehension.</li><li>Quantitative: arithmetic, algebra, geometry, statistics and comparison questions.</li></ul>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" id="start">Start Section ${sec}</button></div></div></div>`;
    $('#start').onclick = async () => {
      $('#start').disabled = true;
      try {
        const r = await api({ op: 'exam_start', session: auth.session, test: id, section: sec });
        if (!r.ok) { if (r.error === 'kicked' || r.error === 'session') return logout(esc(r.msg || '')); await QGDlg.alert(r.msg || r.error); return renderLobby(); }
        const skew = Date.now() - r.serverNow;   // local clock offset
        runSection(id, sec, r.deadline + skew);
      } catch (e) { QGDlg.alert('تعذّر الاتصال بالخادم'); $('#start').disabled = false; }
    };
  }

  // ---------- section runner ----------
  let E = null;
  function runSection(id, sec, deadline) {
    const S = T.sections[sec - 1];
    const saved = lsGet(LS.ex + id + '_' + sec, { a: Array(24).fill(null), m: Array(24).fill(0), v: Array(24).fill(0) });
    E = { id, sec, S, deadline, a: saved.a, m: saved.m, v: saved.v, cur: 0, timer: null, submitting: false };
    document.title = `${T.en} — Section ${sec} | Q-Guide`;
    app.innerHTML = header() + `<div class="exam">
      <aside class="side">
        <div class="box time" id="time"><div class="l">Remaining time</div><div class="v" id="tv">25:00</div></div>
        <div class="box ucard"><img src="/assets/logo.png" alt=""><div class="i">Username: ${esc(auth.name || '')}<br>User: ${esc((auth.email || '').split('@')[0])}</div></div>
        <div class="box sec">Current section: ${sec}/4<br>Total questions: 24</div>
        <div class="box cnt"><div class="rem"><b id="c_rem">24</b>Remaining<br>in section</div><div class="ans"><b id="c_ans">0</b>Answered</div><div class="vis"><b id="c_vis">0</b>Visited</div><div class="nv"><b id="c_nv">24</b>Not<br>visited</div></div>
        <div class="box"><div class="grid" id="grid"></div></div>
        <div class="sbtns"><button class="btn" id="b_sinstr">Section Instructions</button><button class="btn" id="b_tinstr">Test Instructions</button><button class="btn red" id="b_end">${sec < 4 ? 'End Section' : 'End Test'}</button><button class="btn" id="b_eq">Equations</button><button class="btn pen" id="b_pen" style="grid-column:1/-1">✎ Pen / Scratch</button></div>
      </aside>
      <section class="main">
        <div class="mtop"><div class="fsz"><button id="fsm">-A</button><button id="fs0">A</button><button id="fsp">+A</button></div><div class="qno">Question No. <b id="qn">1</b></div></div>
        <div class="qhost" id="qhost"><div class="qbody" id="qb"></div></div>
        <div class="mbot"><label><input type="checkbox" id="mark"> Mark question for review</label><button class="btn" id="prev">Previous →</button><button class="btn" id="next">Save &amp; Next</button></div>
      </section></div><div id="modal"></div>`;
    $('#fsm').onclick = () => setFs(lsGet(LS.fs, 1) - .1); $('#fsp').onclick = () => setFs(lsGet(LS.fs, 1) + .1); $('#fs0').onclick = () => setFs(1);
    $('#prev').onclick = () => { saveCur(); show(Math.max(0, E.cur - 1)); };
    $('#next').onclick = () => { saveCur(); if (E.cur < 23) show(E.cur + 1); else { renderGrid(); } };
    $('#mark').onchange = () => { E.m[E.cur] = $('#mark').checked ? 1 : 0; persist(); renderGrid(); };
    $('#b_end').onclick = () => { saveCur(); const un = E.a.filter(x => x == null).length; modal(`<h3>${sec < 4 ? 'End Section' : 'End Test'}?</h3><p>${un ? `You have <b>${un}</b> unanswered question(s). ` : ''}You will not be able to return to this section.</p><p class="ar mut" style="font-size:13.5px">لن تستطيع الرجوع لهذا القسم بعد إنهائه.</p>`, [['Cancel', 'ghost', closeModal], ['Yes, end section', 'red', () => submit(false)]]); };
    $('#b_sinstr').onclick = () => modal(`<h3>Section Instructions</h3><p>This section has 24 questions and 25 minutes. Verbal questions come first, then quantitative. Choose the best answer, press <b>Save &amp; Next</b>, and use the question grid to move between questions.</p>`, [['Close', '', closeModal]]);
    $('#b_tinstr').onclick = () => modal(`<h3>Test Instructions</h3><ul style="padding-left:18px"><li>4 sections × 24 questions, 25 minutes each.</li><li>No return to a finished section.</li><li>Unanswered = wrong; no penalty for guessing.</li></ul>`, [['Close', '', closeModal]]);
    $('#b_eq').onclick = () => modal(`<h3>Equations</h3><div class="eq">
      <div><b>Geometry</b>Area of square = s²<br>Area of rectangle = l × w<br>Area of triangle = ½ × b × h<br>Area of circle = πr² · Circumference = 2πr<br>Area of trapezoid = ½(a + b)h<br>Pythagoras: a² + b² = c²<br>Sum of angles in a polygon = (n − 2) × 180°<br>Volume of cube = s³ · Cuboid = l × w × h<br>Cylinder = πr²h · Sphere = 4/3 πr³</div>
      <div><b>Arithmetic</b>Percent change = (new − old)/old × 100<br>Average = sum ÷ count<br>Speed = distance ÷ time<br>Simple interest = P × r × t<br>a² − b² = (a − b)(a + b)<br>(a ± b)² = a² ± 2ab + b²<br>Sum 1…n = n(n + 1)/2<br>n! = n × (n − 1) × … × 1<br>Probability = favorable ÷ total</div></div>`, [['Close', '', closeModal]]);
    document.onkeydown = e => { if (!E || e.ctrlKey || e.metaKey) return; const k = e.key.toLowerCase(); const i = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k); if (i >= 0) pick(i); else if (k === 'enter') $('#next').click(); };
    E.pen = QGPen.attach($('#qhost'), { autosave: false, onToggle: on => { const b = $('#b_pen'); if (b) { b.classList.toggle('red', on); b.textContent = on ? '✕ Close Pen' : '✎ Pen / Scratch'; } } });
    E.penStore = {};
    $('#b_pen').onclick = () => E.pen.toggle();
    show(E.a.findIndex(x => x == null) >= 0 ? 0 : 0);
    tick(); E.timer = setInterval(tick, 500);
  }
  function persist() { if (E) lsSet(LS.ex + E.id + '_' + E.sec, { a: E.a, m: E.m, v: E.v }); }
  function saveCur() { if (!E) return; const sel = $('.opt.sel'); E.a[E.cur] = sel ? +sel.dataset.k : null; persist(); }
  function pick(k) { document.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', +o.dataset.k === k)); E.a[E.cur] = k; persist(); renderGrid(); }
  function show(i) {
    if (E.pen && E.cur != null && E.penStore) E.penStore[E.cur] = E.pen.getStrokes();
    E.cur = i; E.v[i] = 1; persist();
    const it = E.S.items[i]; $('#qn').textContent = i + 1; $('#mark').checked = !!E.m[i];
    let h = `<div class="qinstr">${INSTR[it.type] || ''}</div>`;
    if (it.type === 'read') h += `<div class="passage"><h4>${esc(it.ptitle || 'Passage')}</h4>${esc(it.passage)}</div>`;
    if (it.type === 'quant') h += `<div class="qimg"><img src="${it.img}" width="${it.w}" height="${it.h}" alt="Question"></div>`;
    else h += `<p class="qtext">${it.type === 'ana' ? '<b>' + esc(it.q) + '</b>' : esc(it.q)}</p>`;
    h += `<div class="opts">` + it.opts.map((o, k) => `<button class="opt ${E.a[i] === k ? 'sel' : ''}" data-k="${k}"><span class="L">${LETTERS[k]}</span><span>${esc(it.type === 'quant' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></button>`).join('') + '</div>';
    $('#qb').innerHTML = h; $('#qb').scrollTop = 0;
    if (E.pen) { E.pen.setKey(null, E.penStore[i] || []); setTimeout(() => E.pen.resize(), 50); }
    document.querySelectorAll('.opt').forEach(o => o.onclick = () => pick(+o.dataset.k));
    $('#prev').disabled = i === 0; $('#next').textContent = i < 23 ? 'Save & Next' : 'Save';
    renderGrid();
  }
  function renderGrid() {
    const ans = E.a.filter(x => x != null).length, vis = E.v.filter(Boolean).length;
    $('#c_rem').textContent = 24 - ans; $('#c_ans').textContent = ans; $('#c_vis').textContent = vis; $('#c_nv').textContent = 24 - vis;
    $('#grid').innerHTML = E.S.items.map((x, i) => `<button class="${E.a[i] != null ? 'ans' : (E.v[i] ? 'vis' : 'nv')} ${E.m[i] ? 'mk' : ''} ${i === E.cur ? 'cur' : ''}" data-i="${i}">${i + 1}</button>`).join('');
    document.querySelectorAll('#grid button').forEach(b => b.onclick = () => { saveCur(); show(+b.dataset.i); });
  }
  function tick() {
    if (!E) return; const left = Math.max(0, E.deadline - Date.now()); const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
    $('#tv').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    $('#time').classList.toggle('warn', left < 5 * 60000);
    if (left <= 0) submit(true);
  }
  function modal(html, btns) { $('#modal').innerHTML = `<div class="modal"><div class="m">${html}<div class="acts">${btns.map((b, i) => `<button class="btn ${b[1]}" data-b="${i}">${b[0]}</button>`).join('')}</div></div></div>`; btns.forEach((b, i) => { $(`[data-b="${i}"]`).onclick = b[2]; }); }
  function closeModal() { const m = $('#modal'); if (m) m.innerHTML = ''; }
  async function submit(auto) {
    if (!E || E.submitting) return; E.submitting = true; clearInterval(E.timer); document.onkeydown = null; saveCur(); closeModal();
    const { id, sec } = E; const answers = E.a.slice();
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.innerHTML = '<div class="spin"></div>' + (auto ? 'Time is up — submitting section…' : 'Submitting section…'); document.body.appendChild(ov);
    let r = null;
    for (let tries = 0; tries < 4 && !(r && r.ok); tries++) {
      try { r = await api({ op: 'exam_submit', session: auth.session, test: id, section: sec, answers }); } catch (e) { r = null; }
      if (!(r && r.ok)) await new Promise(res => setTimeout(res, 1500));
    }
    ov.remove(); E = null;
    if (!r || !r.ok) { if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || '')); QGDlg.alert('تعذّر تسليم القسم، تأكد من الإنترنت ثم أعد فتح الصفحة — إجاباتك محفوظة.'); return renderLobby(); }
    lsDel(LS.ex + id + '_' + sec);
    state[id] = r.state;
    if (r.state.status === 'done') return renderResult(id);
    sectionIntro(id, r.state.nextSection);
  }

  // ---------- result & review ----------
  async function renderResult(id) {
    app.innerHTML = header() + '<div class="page center"><div class="spin" style="margin:30px auto"></div></div>';
    const r = await api({ op: 'exam_result', session: auth.session, test: id }); if (!r.ok) return renderLobby();
    const s = r.state; const t = manifest.find(x => x.id === id) || { title: id };
    app.innerHTML = header() + `<div class="page ar"><div class="card"><h1>نتيجة ${esc(t.title)}</h1>
      <div class="res"><div class="center"><div class="big">${s.pct}<small>%</small></div><div class="mut">${s.total} إجابة صحيحة من 96</div>
      <p style="margin:14px 0 0;font-weight:700;color:#0F3D37">${s.pct >= 85 ? 'ممتاز! مستوى متقدم 🌟' : s.pct >= 70 ? 'جيد جداً 👏 — راجع الأخطاء وستتقدم أكثر' : s.pct >= 55 ? 'جيد 💪 — ركّز على الأقسام الأضعف' : 'ابدأ بمراجعة الشرح وأعد التدريب على الأقسام في منصة التدريب 📘'}</p></div>
      <div><div class="stat"><span>اللفظي</span><b>${s.vpct}%</b></div><div class="stat"><span>الكمي</span><b>${s.qpct}%</b></div>${(s.secScores || []).map((c, i) => `<div class="stat"><span>القسم ${i + 1}</span><b>${c}/24</b></div>`).join('')}</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button class="btn" id="rev">مراجعة الإجابات مع الشرح</button><a class="btn ghost" href="/test/" onclick="location.reload()">كل الاختبارات</a><a class="btn ghost" href="/p/">منصة التدريب</a></div></div></div>`;
    $('#rev').onclick = () => renderReview(id, r);
  }
  async function renderReview(id, res) {
    app.innerHTML = header() + '<div class="page center"><div class="spin" style="margin:30px auto"></div></div>';
    try { if (!T || T.id !== id) T = await loadTest(id); if (!res) res = await api({ op: 'exam_result', session: auth.session, test: id }); } catch (e) { return renderLobby(); }
    if (!res.ok) return renderLobby();
    const t = manifest.find(x => x.id === id) || { title: id };
    let h = `<div class="page"><div class="card ar"><h1>مراجعة ${esc(t.title)}</h1><p class="mut">النتيجة ${res.state.pct}% · ${res.state.total}/96 — الأخضر إجابتك الصحيحة، الأحمر إجابتك الخاطئة والصحيح معلّم.</p><a class="btn ghost sm" href="/test/" onclick="location.reload()">← رجوع</a></div>`;
    res.sections.forEach(sec => {
      const S = T.sections[sec.n - 1];
      h += `<h2 class="ar" style="margin:18px 0 10px">القسم ${sec.n} — ${sec.c}/24</h2>`;
      S.items.forEach((it, i) => {
        const a = sec.a[i], k = it.ans, ok = a === k;
        h += `<div class="rv"><div class="h"><span>Q${i + 1} · ${INSTR[it.type] ? it.type.toUpperCase() : ''}</span><span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ Correct' : (a == null ? '— Not answered' : '✗ Wrong')}</span></div>
          ${it.type === 'read' ? `<details><summary class="mut" style="cursor:pointer;font-size:13px">Passage: ${esc(it.ptitle || '')}</summary><div class="passage" style="max-height:none">${esc(it.passage)}</div></details>` : ''}
          ${it.type === 'quant' ? `<img src="${it.img}" alt="">` : `<p class="qtext" style="text-align:left">${esc(it.q)}</p>`}
          ${it.opts.map((o, j) => `<div class="o ${j === k ? 'k' : (j === a ? 'w' : '')}">${LETTERS[j]}) ${esc(o.replace(/^[A-D]\)\s*/, ''))}${j === k ? ' ✓' : (j === a ? ' ✗' : '')}</div>`).join('')}
          ${it.exp ? `<div class="ex ar">${esc(it.exp)}</div>` : ''}
          ${it.ar && it.ar.q ? `<div class="ex ar tr"><b>🇸🇦 الترجمة:</b> ${arMath(it.ar.q)}${(it.ar.o || []).some(Boolean) ? `<div class="tro">${it.opts.map((o, j) => `<span class="${j === k ? 'k' : ''}">${LETTERS[j]}) ${arMath((it.ar.o || [])[j] || '')}</span>`).join('')}</div>` : ''}${it.wd && it.wd.length ? `<div class="wds">${it.wd.filter(x => !/^(ahmed|khalid|khaled|mohamed|mohammed|muhammad|sara|sarah|nora|ali|saad)$/.test(x[0])).map(x => `<span><b dir="ltr">${esc(x[0])}</b> ${esc(x[1])}</span>`).join('')}</div>` : ''}</div>` : ''}</div>`;
      });
    });
    app.innerHTML = header() + h + '</div>'; window.scrollTo(0, 0);
  }

  applyFs(); if (!gsiFromHash()) route();
})();
