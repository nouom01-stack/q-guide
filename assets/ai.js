/* 🤖 مساعد Q-Guide — نافذة شرح بالذكاء الاصطناعي (مشتركة بين منصة التدريب والاختبارات المحاكية)
   1) «اشرح لي» على سؤال معيّن: QGAI.init({ api, session, fmt, free, onSub, onAuth }) ثم QGAI.slot({ ref, pick, label }) داخل الصفحة و QGAI.fill(root) بعد الرسم
   2) 🙋 المساعد العام «تحتاج مساعدة؟»: زر عائم (QGAI.fab(true/false)) يفتح محادثة: الطالب يصوّر السؤال أو يكتبه ← الصفحة تدوّره في الدورة
      (init({ help: { find, name } }) — find({ text } | { file }) يرجّع { ok, text, card: { html, ref, label, auto, bind } }) ← الشرح على نفس السؤال، وأسئلة متابعة */
(function () {
  'use strict';
  const CFG = { api: '', session: () => '', fmt: null, free: () => false, onSub: null, onAuth: null, help: null };
  const CONV = new Map();          // محادثة كل سؤال تبقى في نفس الجلسة (فتحها مرة ثانية ما ينحسب)
  let ST = null, W = null;         // ST: رصيد اليوم · W: النافذة المفتوحة
  // 🙋 محادثة المساعد العام (تبقى طول الجلسة): ref = السؤال اللي نشرحه الحين · tk = خيط الشرح (كل شرح جديد له خيط)
  const H = { help: true, ref: '', label: '', tk: '', tn: 0, pick: null, msgs: [], cid: '', follow: 5, busy: false };
  // 🌐 لغة رد المساعد: عربي (الافتراضي) أو English — اختيار الطالب ينحفظ له ويصير الافتراضي دايم (كل أجهزته)
  const LG_LS = 'qg_ai_lang';
  let LANG = (() => { try { return localStorage.getItem(LG_LS) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; } })();
  const lgSave = l => { LANG = l === 'en' ? 'en' : 'ar'; try { localStorage.setItem(LG_LS, LANG); } catch (e) {} };
  const EN = () => !!(window.QGL && QGL.en);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = i => 'ABCD'[i] || '';
  const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2.6l1.95 5.45 5.45 1.95-5.45 1.95L11 17.4l-1.95-5.45L3.6 10l5.45-1.95z" fill="currentColor"/><path d="M18.6 14.2l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15-2.15-.85 2.15-.85z" fill="currentColor" opacity=".75"/></svg>';
  const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m0 0l6-6m-6 6l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.6A2.6 2.6 0 0 1 6.6 6h1.5l1.25-1.85c.3-.45.8-.7 1.3-.7h2.7c.5 0 1 .25 1.3.7L15.9 6h1.5A2.6 2.6 0 0 1 20 8.6v7.8a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="12.3" r="3.3" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>';
  const leftTxt = n => window.QGL && QGL.en ? (n <= 0 ? 'No explanations left today' : n === 1 ? '1 explanation left today' : n + ' explanations left today')   // i18n:skip
    : n <= 0 ? 'خلص رصيد الشرح لليوم' : n === 1 ? 'باقي لك شرح واحد اليوم' : n === 2 ? 'باقي لك شرحين اليوم' : `باقي لك ${n} ${n <= 10 ? 'شروحات' : 'شرح'} اليوم`;   // i18n:skip

  async function post(body) {
    const r = await fetch(CFG.api, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    return r.json();
  }
  // هل المساعد مفتوح لهذا الحساب؟ (نسأل الخادم مرة كل 5 دقايق)
  async function status(force) {
    if (ST && !force && Date.now() - ST.at < 300000) return ST;
    if (!CFG.session()) return { on: false };
    try { const r = await post({ op: 'ai_me', session: CFG.session() }); ST = Object.assign({ on: false }, r && r.ok ? r : {}, { at: Date.now() }); if (r && r.ok && (r.lang === 'en' || r.lang === 'ar')) lgSave(r.lang); }
    catch (e) { ST = { on: false, at: Date.now() - 240000 }; }
    return ST;
  }
  const slot = o => o && o.ref ? `<div class="qgai-slot" data-ai-ref="${esc(o.ref)}" data-ai-pick="${o.pick == null ? '' : o.pick}" data-ai-wrong="${o.wrong ? 1 : ''}" data-ai-label="${esc(o.label || '')}"></div>` : '';
  async function fill(root) {
    const slots = [...(root || document).querySelectorAll('.qgai-slot:not(.done)')]; if (!slots.length) return;
    const s = await status(); slots.forEach(el => { el.classList.add('done'); if (!s.on) return;
      el.innerHTML = _T`<button type="button" class="qgai-btn"><span class="qgai-bi">${SPARK}</span><span class="qgai-bt"><b>اشرح لي أكثر</b><small>المساعد الذكي يشرح لك السؤال خطوة بخطوة</small></span><span class="qgai-go" aria-hidden="true">${window.QGL && QGL.en ? '→' : '←'}</span></button>`;
      el.querySelector('button').onclick = e => open({ ref: el.dataset.aiRef, pick: el.dataset.aiPick === '' ? null : +el.dataset.aiPick, wrong: el.dataset.aiWrong === '1', label: el.dataset.aiLabel, from: e.currentTarget }); });
  }

  // ---------- تنسيق الرد: أسطر، نقاط، ترقيم، **غامق**، والمعادلات بنفس منسّق الموقع ----------
  function inline(s) {
    const f = CFG.fmt || esc;
    return s.split('**').map((p, i) => i % 2 ? `<b>${f(p)}</b>` : f(p)).join('');
  }
  function render(text) {
    let h = '';
    for (let ln of String(text || '').replace(/\r/g, '').split('\n')) {
      ln = ln.replace(/^#{1,6}\s*/, '').replace(/\s+$/, ''); let m;
      if (/^\s*[-–—_=*]{3,}\s*$/.test(ln)) continue;   // خطوط فاصلة (---) ما نحتاجها
      if (!ln.trim()) { if (!/qgai-sp"><\/div>$/.test(h) && h) h += '<div class="qgai-sp"></div>'; continue; }
      if ((m = ln.match(/^\s*[-•*]\s+(.*)$/))) h += `<div class="qgai-l li">${inline(m[1])}</div>`;
      else if ((m = ln.match(/^\s*(\d{1,2})[).\-]\s+(.*)$/))) h += `<div class="qgai-l ol"><span class="qgai-n">${m[1]}</span><span>${inline(m[2])}</span></div>`;
      else h += `<div class="qgai-l">${inline(ln)}</div>`;
    }
    return h;
  }

  // ---------- النافذة ----------
  function open(o) {
    close(true);
    let C = CONV.get(o.ref); if (!C) { C = { ref: o.ref, pick: o.pick, wrong: !!o.wrong, msgs: [], cid: '', follow: 5, busy: false }; CONV.set(o.ref, C); }
    mount(C, o.from, String(o.label || ''));
    if (!C.msgs.length) ask(null);
  }
  // نفس النافذة للوضعين: شرح سؤال معيّن، أو المساعد العام (help) اللي فيه زر الكاميرا وسطر «تسأل عن…»
  function mount(C, from, label) {
    const help = !!C.help, ov = document.createElement('div'); ov.className = 'qgai' + (help ? ' qgh-p' : ''); ov.setAttribute('dir', EN() ? 'ltr' : 'rtl');
    const camL = _T('صوّر السؤال أو ارفع صورته');
    ov.innerHTML = `<section class="qgai-p" role="dialog" aria-modal="true" aria-labelledby="qgai-t">
      <header class="qgai-h"><span class="qgai-av" aria-hidden="true">${SPARK}</span><div class="qgai-ht"><b id="qgai-t">${_T('مساعد Q-Guide')}</b><small>${help ? _T('صوّر سؤالك أو اكتبه، وأشرحه لك') : _T('يشرح لك السؤال على طريقة شرح الدورة')}</small></div>${lgHtml()}<button type="button" class="qgai-x" aria-label="${_T('إغلاق')}">✕</button></header>
      <div class="qgai-ctx">${label.split(' · ').filter(Boolean).map(t => `<span class="${/✗/.test(t) ? 'bad' : /الصحيحة|correct/i.test(t) ? 'ok' : ''}">${esc(t)}</span>`).join('')}</div>
      <div class="qgai-log" aria-live="polite"></div>
      ${help ? '<div class="qgh-ctx" hidden></div>' : ''}
      <form class="qgai-f" autocomplete="off">${help ? `<button type="button" class="qgh-cam" aria-label="${camL}" title="${camL}">${CAM}</button><input type="file" accept="image/*" hidden>` : ''}<textarea rows="1" maxlength="${help ? 1500 : 300}" aria-label="${help ? _T('اكتب سؤالك') : _T('اكتب سؤالك عن هذا السؤال')}"></textarea><button type="submit" class="qgai-s" aria-label="${_T('أرسل')}">${SEND}</button></form>
      <div class="qgai-ft"><span class="qgai-left"></span><span>${_T('المساعد ذكاء اصطناعي وممكن يغلط، والإجابة المعتمدة هي إجابة الدورة.')}</span></div>
    </section>`;
    document.body.appendChild(ov);
    W = { ov, C, from: from || document.activeElement, log: ov.querySelector('.qgai-log'), ta: ov.querySelector('textarea'), stick: true };
    // مفاتيح النافذة ما توصل لاختصارات الصفحة (Enter = التالي، A–D = اختيار…)، و Tab يدور داخل النافذة
    ov.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { const f = [...ov.querySelectorAll('button:not([disabled]),textarea:not([disabled]),a[href],summary')].filter(x => x.offsetParent !== null); if (!f.length) return;
        const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    const onK = e => { if (e.key === 'Escape' && W && !W.ov.contains(e.target)) close(); }; W.onK = onK; document.addEventListener('keydown', onK);
    if (help) { W.onH = () => close(true); window.addEventListener('hashchange', W.onH); }   // «افتح السؤال» ينقله لصفحة ثانية
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.qgai-x').onclick = () => close();
    ov.querySelectorAll('.qgai-lg [data-lg]').forEach(b => b.onclick = () => setLang(b.dataset.lg));
    const ta = W.ta, fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const f = ov.querySelector('form'); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); } });
    ov.querySelector('form').onsubmit = e => { e.preventDefault(); const t = ta.value.trim(); if (!t || C.busy) return; ta.value = ''; fit();
      if (!help) return ask(t);
      // سؤال متابعة على السؤال اللي نشرحه، إلا لو لصق سؤال كامل بخياراته (A) … B) …) أو خلصت أسئلة المتابعة → نبحث عنه كسؤال جديد
      if (C.ref && turns(C) < C.follow && !OPTS.test(t)) ask(t); else seek({ text: t }); };
    if (help) {
      const inp = ov.querySelector('input[type=file]'); W.cam = () => { if (!C.busy) inp.click(); };
      ov.querySelector('.qgh-cam').onclick = W.cam;
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f && /^image\//.test(f.type)) seek({ file: f }); };
      ta.addEventListener('paste', e => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => /^image\//.test(x.type)); if (f && !C.busy) { e.preventDefault(); seek({ file: f }); } });   // لصق صورة (لقطة شاشة)
    }
    document.documentElement.classList.add('qgai-lock');
    const fine = !window.matchMedia || matchMedia('(pointer:fine)').matches;   // في الجوال ما نفتح الكيبورد غصب
    requestAnimationFrame(() => { ov.classList.add('in'); (help && fine ? ta : ov.querySelector('.qgai-x')).focus({ preventScroll: true }); });
    paint();
  }
  function close(quiet) {
    if (!W) return; const w = W; W = null;   // الشرح اللي قاعد ينكتب يكمل بالخلفية، ولو فتح السؤال مرة ثانية يلقاه
    document.removeEventListener('keydown', w.onK); if (w.onH) window.removeEventListener('hashchange', w.onH); document.documentElement.classList.remove('qgai-lock');
    if (quiet) { w.ov.remove(); return; }
    w.ov.classList.remove('in'); w.ov.classList.add('out'); setTimeout(() => w.ov.remove(), 180);
    if (w.from && w.from.focus && document.body.contains(w.from)) w.from.focus({ preventScroll: true });
  }

  // 🌐 زر لغة الرد: اختيار الطالب ينحفظ (الجهاز + حسابه)، ولو فيه شرح مفتوح بلغة ثانية نطلب نفس الشرح باللغة الجديدة (سؤال متابعة، ما ينقص رصيده)
  function lgHtml() { const lab = window.QGL && QGL.en ? 'Answer language' : 'لغة الشرح';   // i18n:skip
    return `<div class="qgai-lg" role="group" aria-label="${lab}" title="${lab}"><button type="button" data-lg="ar" lang="ar" aria-pressed="${LANG === 'ar'}">عربي</button><button type="button" data-lg="en" lang="en" aria-pressed="${LANG === 'en'}">English</button></div>`; }   // i18n:skip
  function setLang(l) {
    l = l === 'en' ? 'en' : 'ar'; if (l === LANG) return; lgSave(l);
    if (W) W.ov.querySelectorAll('.qgai-lg [data-lg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lg === LANG)));
    post({ op: 'ai_lang', session: CFG.session(), lang: LANG }).catch(() => {});
    reLang();
  }
  function reLang() {
    if (!W) return; const C = W.C; if (C.help && !C.ref) return;
    const last = [...C.msgs].reverse().find(m => m.r === 'a' && m.t && (!C.help || m.x === C.tk));
    if (!last || (last.lg || 'ar') === LANG) return;   // ما فيه شرح، أو آخر شرح أصلاً بنفس اللغة
    if (C.busy) { C.wantLg = LANG; return; }           // يخلص الشرح اللي ينكتب وبعدها نطلبه باللغة الجديدة
    if (C.msgs.some(m => m.r === 'lim' && (!C.help || m.x === C.tk)) || turns(C) >= C.follow) return;
    ask(LANG === 'en' ? 'Explain it in English, please.' : 'اشرحه بالعربي لو سمحت.');   // i18n:skip
  }
  // كم سؤال متابعة سأل الطالب على السؤال الحالي (في المساعد العام: بس خيط الشرح الحالي، مو الأسئلة اللي بحث عنها)
  const turns = C => C.msgs.filter(m => m.r === 'u' && (!C.help || m.x === C.tk)).length;
  const OPTS = /(^|\s)A\s*[).:-]\s*\S[\s\S]*(^|\s)B\s*[).:-]\s*\S/i;

  // رسالة وحدة (مشتركة بين الوضعين)
  function rm(m, i, help) {
    if (m.r === 'u') return `<div class="qgai-m u"><div class="qgai-tx" dir="auto">${esc(m.t)}</div></div>`;
    if (m.r === 'lim') return `<div class="qgai-lim"><span class="qgai-li" aria-hidden="true">🔒</span><b>${m.free ? _T('خلصت شروحاتك المجانية اليوم') : _T('خلص رصيد اليوم')}</b><p>${esc(m.t)}</p>${m.free && CFG.onSub ? _T('<button type="button" class="qgai-sub">اشترك في الدورة</button>') : ''}</div>`;
    if (m.r === 'e') return `<div class="qgai-m e"><span>${esc(m.t)}</span>${m.retry ? _T`<button type="button" class="qgai-rt" data-i="${i}">حاول مرة ثانية</button>` : ''}</div>`;
    const typing = m.live && !m.t;
    return `<div class="qgai-m a${m.live ? ' live' : ''}">${help && m.first ? `<div class="qgh-lead">${SPARK}<span>${_T('الشرح')}</span></div>` : ''}${typing ? _T('<div class="qgai-ty"><span class="qgai-dots"><i></i><i></i><i></i></span>المساعد يكتب الشرح…</div>') : `<div class="qgai-tx" dir="${m.lg === 'en' ? 'ltr' : 'rtl'}" lang="${m.lg === 'en' ? 'en' : 'ar'}">${render(m.t)}</div>`}${!m.live && m.id ? `<div class="qgai-ma">${m.flag ? _T('<span class="qgai-fl ok">✓ وصل بلاغك، بنراجع الشرح</span>') : _T`<button type="button" class="qgai-fl" data-i="${i}">🚩 الشرح فيه غلط؟</button>`}</div>` : ''}</div>`;
  }
  function paint() {
    if (!W) return; if (W.C.help) return paintHelp();
    const { C, log } = W;
    const atEnd = W.stick || log.scrollHeight - log.scrollTop - log.clientHeight < 60;   // الطالب يقرأ فوق؟ لا ننزله غصب
    log.innerHTML = C.msgs.map((m, i) => rm(m, i)).join('');
    log.querySelectorAll('.qgai-fl[data-i]').forEach(b => b.onclick = () => flag(+b.dataset.i));
    log.querySelectorAll('.qgai-rt').forEach(b => b.onclick = () => { const i = +b.dataset.i, m = C.msgs[i]; C.msgs.splice(i, 1);
      if (m.q) { const u = C.msgs.map(x => x.r === 'u' && x.t === m.q).lastIndexOf(true); if (u >= 0) C.msgs.splice(u, 1); } ask(m.q); });
    const sb = log.querySelector('.qgai-sub'); if (sb) sb.onclick = () => { close(true); CFG.onSub && CFG.onSub('المساعد الذكي'); };   // i18n:skip (اسم الإحصائية بالعربي)
    if (atEnd) log.scrollTop = log.scrollHeight; W.stick = false;
    const t = turns(C);
    const blocked = C.msgs.some(m => m.r === 'lim'), full = t >= C.follow, any = C.msgs.some(m => m.r === 'a' && !m.live && m.t);
    W.ta.disabled = C.busy || blocked || full || !any;
    W.ta.placeholder = full ? _T('وصلت لحد الأسئلة على هذا السؤال') : blocked ? _T('خلص رصيد اليوم') : _T('اسأل عن هذا السؤال…');
    W.ov.querySelector('.qgai-s').disabled = W.ta.disabled;
    const lf = W.ov.querySelector('.qgai-left'); lf.textContent = ST && ST.limit && ST.left != null ? leftTxt(ST.left) : '';
  }
  let raf = 0; const paintSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };

  // ---------- 🙋 المساعد العام: رسم المحادثة بدون ما نعيد رسم البطاقات (عشان البلاغ والصور والتفاصيل المفتوحة تبقى) ----------
  function hm(m, i) {
    if (m.r === 'w') { const n = CFG.help && CFG.help.name ? CFG.help.name() : '';
      return `<div class="qgai-m a qgh-w"><div class="qgai-tx"><b>${n ? _T`هلا ${esc(n)} 👋` : _T('هلا 👋')}</b><div class="qgai-l">${_T('أنا مساعدك في القدرات. أرسل لي السؤال اللي واقف عنده، وأدوّره لك في الدورة وأشرحه لك خطوة بخطوة.')}</div></div>
        <div class="qgh-go"><button type="button" class="qgh-gb" data-go="cam"><span class="i" aria-hidden="true">📷</span><b>${_T('صوّر السؤال')}</b><small>${_T('من الكاميرا أو الصور')}</small></button><button type="button" class="qgh-gb" data-go="txt"><span class="i" aria-hidden="true">✍️</span><b>${_T('اكتب السؤال')}</b><small>${_T('بالإنجليزي مع الخيارات')}</small></button></div>
        <p class="qgh-tip">${_T('💡 صوّر السؤال كامل مع الخيارات، والرسم لو فيه رسم.')}</p></div>`; }
    if (m.r === 'ui') return `<div class="qgai-m u qgh-ui"><img src="${m.src}" alt="${_T('صورة السؤال')}">${m.ocr ? `<small dir="ltr">${esc(m.ocr.length > 240 ? m.ocr.slice(0, 240) + '…' : m.ocr)}</small>` : ''}</div>`;
    if (m.r === 'f') return m.wait ? `<div class="qgai-m a"><div class="qgai-ty"><span class="qgai-dots"><i></i><i></i><i></i></span>${m.img ? _T('أقرأ الصورة وأدوّر السؤال في الدورة…') : _T('أدوّر سؤالك في الدورة…')}</div></div>`
      : `<div class="qgai-m a qgh-f">${m.html}${m.ex && !m.exd ? `<div class="qgh-exw"><button type="button" class="qgh-exb">${SPARK}<span>${_T('اشرح لي طريقة الحل')}</span></button></div>` : ''}</div>`;
    return rm(m, i, true);
  }
  function hBind(m, n) {
    const C = H;
    if (m.r === 'w') { n.querySelector('[data-go="cam"]').onclick = () => W && W.cam(); n.querySelector('[data-go="txt"]').onclick = () => W && W.ta.focus(); }
    if (m.r === 'f' && !m.wait) { if (m.bind) try { m.bind(n); } catch (e) {} const b = n.querySelector('.qgh-exb'); if (b) b.onclick = () => { if (C.busy) return; m.exd = 1; begin(m.ex, m.label); }; }
    const fl = n.querySelector('.qgai-fl[data-i]'); if (fl) fl.onclick = () => flag(C.msgs.indexOf(m));
    const sb = n.querySelector('.qgai-sub'); if (sb) sb.onclick = () => { close(true); CFG.onSub && CFG.onSub('المساعد الذكي'); };   // i18n:skip (اسم الإحصائية بالعربي)
    const rt = n.querySelector('.qgai-rt'); if (rt) rt.onclick = () => { if (C.busy) return; const i = C.msgs.indexOf(m); if (i >= 0) C.msgs.splice(i, 1);
      if (m.seek) return seek(m.seek, true);
      C.ref = m.ref; C.tk = m.tk; C.label = m.label || '';
      if (m.q) { const u = C.msgs.map(x => x.r === 'u' && x.x === m.tk && x.t === m.q).lastIndexOf(true); if (u >= 0) C.msgs.splice(u, 1); }
      ask(m.q); };
  }
  const CHIPS = () => [[_T('🤔 ما فهمت'), _T('ما فهمت، وضّحه أكثر')], [_T('📌 وش القاعدة؟'), _T('وش القاعدة اللي أحفظها لهالنوع من الأسئلة؟')], [_T('✏️ سؤال مشابه'), _T('أعطني سؤال مشابه مع حله')]];
  function paintHelp() {
    const { C, log } = W, atEnd = W.stick || log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    const keep = new Set(); let prev = null;
    C.msgs.forEach((m, i) => {
      const html = hm(m, i).trim();
      if (!m.el || m.h !== html || !log.contains(m.el)) {
        const t = document.createElement('template'); t.innerHTML = html; const n = t.content.firstElementChild;
        if (m.el && log.contains(m.el)) m.el.replaceWith(n); else if (prev) prev.after(n); else log.prepend(n);
        m.el = n; m.h = html; hBind(m, n);
      } else if (prev ? prev.nextElementSibling !== m.el : log.firstElementChild !== m.el) (prev ? prev.after(m.el) : log.prepend(m.el));
      keep.add(m.el); prev = m.el;
    });
    // أزرار سريعة بعد الشرح: ما فهمت · القاعدة · سؤال مشابه (السؤال الجديد: زر «سؤال جديد» تحت وزر الكاميرا)
    const last = C.msgs[C.msgs.length - 1], more = turns(C) < C.follow;
    const chips = more && !C.busy && C.ref && last && last.r === 'a' && !last.live && last.t && last.x === C.tk;
    let ch = log.querySelector(':scope > .qgh-chips');
    if (chips) {
      const k = C.tk + ':' + turns(C);
      if (!ch || ch.dataset.k !== k) {
        const n = document.createElement('div'); n.className = 'qgh-chips'; n.dataset.k = k; n.setAttribute('role', 'group'); n.setAttribute('aria-label', _T('أسئلة سريعة'));
        n.innerHTML = CHIPS().map(([a, q]) => `<button type="button" data-q="${esc(q)}">${esc(a)}</button>`).join('');
        n.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { if (!C.busy && C.ref) ask(b.dataset.q); });
        if (ch) ch.replaceWith(n); else log.appendChild(n); ch = n;
      }
      keep.add(ch); if (prev && prev.nextElementSibling !== ch) prev.after(ch);
    }
    [...log.children].forEach(n => { if (!keep.has(n)) n.remove(); });
    if (atEnd) log.scrollTop = log.scrollHeight; W.stick = false;
    const busy = C.busy, active = C.ref && more;
    W.ta.disabled = busy; W.ov.querySelector('.qgai-s').disabled = busy; W.ov.querySelector('.qgh-cam').disabled = busy;
    W.ta.placeholder = active ? _T('اسأل عن هذا السؤال…') : C.ref ? _T('خلصت أسئلة المتابعة على هذا السؤال — أرسل سؤال جديد') : _T('اكتب السؤال هنا أو صوّره…');
    const cx = W.ov.querySelector('.qgh-ctx');
    if (C.ref && C.label) { if (cx.dataset.k !== C.tk) { cx.dataset.k = C.tk; cx.innerHTML = `<span>${_T('تسأل عن:')} <b>${C.label}</b></span><button type="button" class="qgh-nw">${_T('سؤال جديد')}</button>`;
        cx.querySelector('button').onclick = () => { if (C.busy) return; C.ref = ''; C.label = ''; paint(); W && W.ta.focus(); }; } cx.hidden = false; }
    else { cx.hidden = true; cx.dataset.k = ''; }
    const lf = W.ov.querySelector('.qgai-left'); lf.textContent = ST && ST.on && ST.limit && ST.left != null ? leftTxt(ST.left) : '';
  }
  // الطالب أرسل سؤال (نص أو صورة): ندوّره في الدورة، وإذا لقيناه نبدأ الشرح على طول
  async function seek(p, again) {
    if (!W || !W.C.help || !CFG.help) return; const C = W.C; if (C.busy) return;
    if (!again) C.msgs.push(p.file ? { r: 'ui', src: URL.createObjectURL(p.file) } : { r: 'u', t: p.text });
    const u = [...C.msgs].reverse().find(m => m.r === 'ui' || m.r === 'u');
    const f = { r: 'f', wait: 1, img: !!p.file }; C.msgs.push(f); C.busy = true; C.ref = ''; C.label = ''; W.stick = true; paint();
    let res = null; try { res = await CFG.help.find(p); } catch (e) {}
    C.busy = false; const i = C.msgs.indexOf(f);
    if (!res || !res.ok) { if (i >= 0) C.msgs.splice(i, 1, { r: 'e', t: (res && res.msg) || _T('تعذّر الاتصال، تأكد من النت وحاول مرة ثانية.'), retry: !res || !!res.retry, seek: p }); if (W && W.C === C) paint(); return; }
    if (p.file && res.text && u && u.r === 'ui') u.ocr = res.text;
    const c = res.card || {}; Object.assign(f, { wait: 0, html: c.html || '', bind: c.bind });
    const s = c.ref ? await status() : null;
    if (c.ref && s && s.on) { if (c.auto) { f.exd = 1; return begin(c.ref, c.label); } f.ex = c.ref; f.label = c.label; }
    if (W && W.C === C) paint();
  }
  function begin(ref, label) {   // شرح جديد على سؤال من الدورة (خيط جديد، يبدأ من أول)
    const C = H; C.ref = ref; C.label = label || ''; C.tk = ref + '#' + (++C.tn); C.cid = ''; C.follow = (ST && ST.follow) || 5;
    if (W && W.C === C) { W.stick = true; ask(null); }
  }

  async function ask(text) {
    if (!W) return; const C = W.C; if (C.busy) return;
    const show = () => { if (W && W.C === C) paint(); }, showSoon = () => { if (W && W.C === C) paintSoon(); };
    const tk = C.tk, ref = C.ref, label = C.label;
    if (text) C.msgs.push({ r: 'u', t: text, x: tk });
    const hist = C.msgs.filter(m => (!C.help || m.x === tk) && ((m.r === 'a' && !m.live && m.t) || m.r === 'u')).map(m => ({ r: m.r, t: m.t }));
    const am = { r: 'a', t: '', live: true, lg: LANG, x: tk, first: !hist.length }; C.msgs.push(am); C.busy = true; W.stick = true; paint();
    const fail = (msg, canRetry) => { const i = C.msgs.indexOf(am); if (i >= 0) C.msgs.splice(i, 1); C.msgs.push({ r: 'e', t: msg, retry: canRetry, q: text, x: tk, tk, ref, label }); };
    const drop = () => { if (C.help && C.tk === tk) { C.ref = ''; C.label = ''; } };   // المساعد العام: ما نقدر نكمل على هذا السؤال → اللي يكتبه بعدها يصير بحث
    try {
      const r = await fetch(CFG.api.replace(/\/?$/, '/') + 'ai', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ session: CFG.session(), ref, pick: C.pick, msgs: hist.length > 0 ? hist : [], cid: C.cid, lang: am.lg }) });
      if (!/event-stream/.test(r.headers.get('content-type') || '')) {
        const j = await r.json().catch(() => ({ msg: _T('صار خطأ، حاول مرة ثانية.') })); if (j && typeof j.msg === 'string') j.msg = _T(j.msg);   // 🌐
        const i = C.msgs.indexOf(am); if (i >= 0) C.msgs.splice(i, 1);
        if (j.error === 'limit') { if (ST) ST.left = 0; C.msgs.push({ r: 'lim', t: j.msg || '', free: !!j.free, x: tk }); drop(); }
        else if (j.error === 'session' || j.error === 'kicked') { C.msgs.push({ r: 'e', t: j.msg || _T('انتهت الجلسة، سجّل دخولك من جديد.') }); CFG.onAuth && CFG.onAuth(j); }
        else { C.msgs.push({ r: 'e', t: j.msg || _T('صار خطأ، حاول مرة ثانية.'), retry: !/^(locked|soon|off|noq|maxturns)$/.test(j.error || ''), q: text, x: tk, tk, ref, label }); if (/^(locked|soon|off|noq)$/.test(j.error || '')) drop(); }
        return;
      }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          const d = ev.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''); if (!d) continue;
          let j; try { j = JSON.parse(d); } catch (e) { continue; }
          if (j.start) { C.cid = j.cid || C.cid; C.follow = j.follow || C.follow; ST = Object.assign(ST || {}, { left: j.left, limit: j.limit, on: true }); }
          if (j.t) { am.t += j.t; showSoon(); }
          if (j.end) { am.id = j.id; }
          if (j.err) { fail(_T(j.msg || _T('ما قدر المساعد يكمل الشرح.')), true); }
        }
      }
      if (!am.t && C.msgs.indexOf(am) >= 0) fail(_T('ما وصلني شرح، حاول مرة ثانية.'), true);
    } catch (e) {
      if (am.t) am.t += '\n…'; else fail(_T('تعذّر الاتصال، تأكد من النت وحاول مرة ثانية.'), true);
    } finally { am.live = false; C.busy = false; show(); if (W && W.C === C && !W.ta.disabled && text) W.ta.focus({ preventScroll: true });
      if (W && W.C === C && C.wantLg) { const l = C.wantLg; C.wantLg = null; if (l === LANG) reLang(); } }
  }
  async function flag(i) {
    const C = W && W.C; const m = C && C.msgs[i]; if (!m || !m.id) return; m.flag = 1; paint();
    try { await post({ op: 'ai_flag', session: CFG.session(), id: m.id }); } catch (e) {}
  }
  function init(o) { Object.assign(CFG, o || {}); }

  // ---------- 🙋 الزر العائم «تحتاج مساعدة؟» + فقاعة ترحيب مرة باليوم ----------
  let FAB = null;
  const HI_LS = 'qg_hlp_hi', today = () => new Date(Date.now() + 108e5).toISOString().slice(0, 10);   // يوم الرياض
  const lsG = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  function fab(on) {
    if (FAB && (!on || FAB.en !== EN())) { clearTimeout(FAB.t); FAB.el.remove(); FAB = null; }
    document.documentElement.classList.toggle('qgh-on', !!(on && CFG.help));   // مسافة تحت الصفحة عشان الزر ما يغطي آخرها
    if (!on || !CFG.help || FAB) return;
    const el = document.createElement('div'); el.className = 'qgh'; el.setAttribute('dir', EN() ? 'ltr' : 'rtl');
    el.innerHTML = `<button type="button" class="qgh-fab" aria-label="${_T('مساعد Q-Guide: تحتاج مساعدة؟')}" title="${_T('تحتاج مساعدة؟')}">${SPARK}</button>`;
    document.body.appendChild(el); FAB = { el, en: EN(), t: 0 };
    el.querySelector('.qgh-fab').onclick = () => help();
    if (lsG(HI_LS) !== today()) FAB.t = setTimeout(hiShow, 1600);
  }
  function hiShow() {
    if (!FAB || W || FAB.el.querySelector('.qgh-bub')) return;
    lsS(HI_LS, today());
    const b = document.createElement('div'); b.className = 'qgh-bub';
    b.innerHTML = `<button type="button" class="qgh-bo"><b>${_T('تحتاج مساعدة؟ 👋')}</b><span>${_T('صوّر السؤال أو اكتبه، وأشرحه لك خطوة بخطوة.')}</span></button><button type="button" class="qgh-bx" aria-label="${_T('إخفاء')}">✕</button>`;
    FAB.el.prepend(b); requestAnimationFrame(() => b.classList.add('in'));
    const bye = () => { b.classList.remove('in'); setTimeout(() => b.remove(), 220); };
    b.querySelector('.qgh-bo').onclick = () => { bye(); help(); };
    b.querySelector('.qgh-bx').onclick = bye;
    FAB.t = setTimeout(bye, 12000);
  }
  function help() {
    if (!CFG.help) return;
    if (FAB) { clearTimeout(FAB.t); const b = FAB.el.querySelector('.qgh-bub'); if (b) b.remove(); lsS(HI_LS, today()); }
    close(true);
    if (!H.msgs.length) H.msgs.push({ r: 'w' });
    mount(H, FAB && FAB.el.querySelector('.qgh-fab'), '');
    status().then(() => { if (W && W.C === H) paint(); });   // رصيد الشرح اليوم
  }

  const css = document.createElement('style'); css.textContent = `
:root{--ai:#2350C4;--ai2:#0E2458;--aibg:#F0F4FF;--aibd:#D5E0FB;--aihv:#E4ECFF;--aigold:#F2B33D}
[data-theme="dark"]{--ai:#8FA8FF;--ai2:#C9D6FF;--aibg:#1B2645;--aibd:#2E4170;--aihv:#22305A}
.qgai-btn{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;background:var(--aibg);border:1px solid var(--aibd);border-radius:10px;padding:9px 12px;color:var(--ai);font:inherit;text-align:start;cursor:pointer;transition:background .15s,border-color .15s}
.qgai-btn:hover{background:var(--aihv);border-color:var(--ai)}
.qgai-btn:focus-visible,.qgai-p button:focus-visible,.qgai-p textarea:focus-visible{outline:2px solid var(--ai);outline-offset:2px}
.qgai-bi{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#15337A,#2F62E0);color:#fff}
.qgai-bi svg{width:18px;height:18px}.qgai-bi svg path+path{color:var(--aigold);fill:var(--aigold)}
.qgai-bt{display:flex;flex-direction:column;line-height:1.35;min-width:0}
.qgai-bt b{font-size:calc(15px * var(--fs,1));font-weight:800}
.qgai-bt small{font-size:calc(12.5px * var(--fs,1));color:var(--mut,#6B7590);font-weight:500}
.qgai-go{margin-inline-start:auto;font-weight:800}
html.qgai-lock,html.qgai-lock body{overflow:hidden}
.qgai{position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,16,40,.5);opacity:0;transition:opacity .18s;font-family:"Tajawal","Segoe UI",Tahoma,sans-serif}
.qgai.in{opacity:1}.qgai.out{opacity:0}
.qgai-p{width:min(600px,100%);height:min(700px,calc(100vh - 40px));background:var(--card,#fff);color:var(--ink,#17213A);border-radius:22px;box-shadow:0 24px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;transform:translateY(14px) scale(.985);transition:transform .2s ease}
.qgai.in .qgai-p{transform:none}
.qgai-h{display:flex;align-items:center;gap:12px;padding:14px 16px 12px;border-bottom:1px solid var(--line,#E1E6F0)}
.qgai-av{flex:none;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#15337A,#2F62E0);color:#fff;box-shadow:0 4px 12px rgba(35,80,196,.3)}
.qgai-av svg{width:24px;height:24px}.qgai-av svg path+path{fill:var(--aigold)}
.qgai-ht{display:flex;flex-direction:column;line-height:1.3;min-width:0}
.qgai-ht b{font-family:var(--disp,"Tajawal"),sans-serif;font-size:calc(18px * var(--fs,1));font-weight:800;color:var(--ai2)}
.qgai-ht small{color:var(--mut,#6B7590);font-size:calc(13px * var(--fs,1))}
.qgai-x{margin-inline-start:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#E1E6F0);background:transparent;color:var(--mut,#6B7590);font-size:16px;cursor:pointer}
.qgai-x:hover{background:var(--aibg);color:var(--ink,#17213A)}
.qgai-ctx{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 0}.qgai-ctx:empty{display:none}
.qgai-ctx span{font-size:calc(12.5px * var(--fs,1));font-weight:700;color:var(--ai);background:var(--aibg);border:1px solid var(--aibd);border-radius:999px;padding:3px 10px}
.qgai-ctx span.ok{color:#137A4C;background:#E6F6EE;border-color:#BFE6D1}.qgai-ctx span.bad{color:#B42B2B;background:#FCE9E9;border-color:#F2C4C4}
[data-theme="dark"] .qgai-ctx span.ok{color:#7FE0AE;background:#12301F;border-color:#1F5A3A}[data-theme="dark"] .qgai-ctx span.bad{color:#FFB3B3;background:#381A21;border-color:#6A2A33}
.qgai-log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:14px 18px 8px;display:flex;flex-direction:column;gap:14px;scrollbar-width:thin;scrollbar-color:var(--aibd) transparent}
.qgai-log::-webkit-scrollbar{width:8px}.qgai-log::-webkit-scrollbar-track{background:transparent}.qgai-log::-webkit-scrollbar-thumb{background:var(--aibd);border-radius:8px}
[data-theme="dark"] .qgai{color-scheme:dark}
.qgai-m.a .qgai-tx{font-size:calc(16px * var(--fs,1));line-height:1.85}
.qgai-m.a .qgai-tx{text-align:start}
.qgai-lg{margin-inline-start:auto;flex:none;display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--aibg);border:1px solid var(--aibd)}
.qgai-lg button{border:0;background:transparent;color:var(--mut,#6B7590);font:inherit;font-weight:700;font-size:calc(13px * var(--fs,1));line-height:1.2;padding:6px 12px;border-radius:999px;cursor:pointer;transition:background .15s,color .15s}
.qgai-lg button:hover{color:var(--ai2)}
.qgai-lg button[aria-pressed="true"]{background:var(--ai2);color:#fff;box-shadow:0 1px 3px rgba(14,36,88,.25)}
[data-theme="dark"] .qgai-lg button[aria-pressed="true"]{background:#2F4FA6}
.qgai-lg+.qgai-x{margin-inline-start:0}
.qgai-l{margin:0 0 2px}.qgai-sp{height:6px}
.qgai-l b{color:var(--ai2);font-weight:800}
.qgai-l.li{position:relative;padding-inline-start:16px}
.qgai-l.li:before{content:"";position:absolute;inset-inline-start:2px;top:.78em;width:6px;height:6px;border-radius:50%;background:var(--ai)}
.qgai-l.ol{display:flex;gap:8px;align-items:baseline}
.qgai-n{flex:none;min-width:22px;height:22px;border-radius:50%;background:var(--aibg);border:1px solid var(--aibd);color:var(--ai);font-weight:800;font-size:calc(12.5px * var(--fs,1));display:inline-grid;place-items:center;transform:translateY(-1px)}
.qgai-m.a.live .qgai-tx>:last-child:after{content:"";display:inline-block;width:7px;height:1.05em;margin-inline-start:3px;vertical-align:-.15em;background:var(--ai);border-radius:2px;animation:qgai-cr 1s steps(2) infinite}
@keyframes qgai-cr{50%{opacity:0}}
.qgai-ty{display:flex;align-items:center;gap:10px;color:var(--mut,#6B7590);font-size:calc(14px * var(--fs,1));padding:4px 0}
.qgai-dots{display:inline-flex;gap:4px}.qgai-dots i{width:7px;height:7px;border-radius:50%;background:var(--ai);opacity:.35;animation:qgai-d 1.2s infinite}
.qgai-dots i:nth-child(2){animation-delay:.15s}.qgai-dots i:nth-child(3){animation-delay:.3s}
@keyframes qgai-d{30%{opacity:1;transform:translateY(-3px)}60%{opacity:.35;transform:none}}
.qgai-ma{margin-top:6px}
.qgai-fl{background:none;border:0;padding:2px 0;color:var(--mut,#6B7590);font:inherit;font-size:calc(12.5px * var(--fs,1));cursor:pointer}
.qgai-fl:hover{color:#C0392B}.qgai-fl.ok{color:#1B9E63;cursor:default}
.qgai-m.u{align-self:flex-end;max-width:85%;background:var(--ai2);color:#fff;border-radius:16px 16px 16px 4px;padding:8px 14px;font-size:calc(15px * var(--fs,1));line-height:1.6;white-space:pre-wrap}
[data-theme="dark"] .qgai-m.u{background:#2F4FA6}
.qgai-m.e{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;background:#FCE9E9;color:#9B2C2C;border:1px solid #F2C4C4;border-radius:12px;padding:10px 12px;font-size:calc(14.5px * var(--fs,1))}
[data-theme="dark"] .qgai-m.e{background:#381A21;border-color:#6A2A33;color:#FFC9C9}
.qgai-rt{margin-inline-start:auto;background:#fff;border:1px solid #E7B4B4;color:#9B2C2C;border-radius:9px;padding:5px 12px;font:inherit;font-weight:700;font-size:calc(13.5px * var(--fs,1));cursor:pointer}
.qgai-lim{margin:auto 0;text-align:center;background:var(--aibg);border:1px solid var(--aibd);border-radius:16px;padding:20px 18px}
.qgai-li{font-size:28px;display:block;margin-bottom:6px}
.qgai-lim b{display:block;font-size:calc(17px * var(--fs,1));color:var(--ai2)}
.qgai-lim p{margin:6px 0 14px;color:var(--mut,#6B7590);font-size:calc(14.5px * var(--fs,1));line-height:1.7}
.qgai-sub{background:var(--gold,#E9A23B);color:#1a1a1a;border:0;border-radius:12px;padding:11px 22px;font:inherit;font-weight:800;font-size:calc(15px * var(--fs,1));cursor:pointer}
.qgai-sub:hover{background:var(--gold2,#C98620)}
.qgai-f{display:flex;align-items:flex-end;gap:8px;padding:10px 14px 8px;border-top:1px solid var(--line,#E1E6F0)}
.qgai-f textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1.5px solid var(--line,#D9E0EE);border-radius:14px;padding:10px 14px;font:inherit;font-size:calc(15.5px * var(--fs,1));line-height:1.5;background:var(--bg,#F5F7FC);color:inherit}
.qgai-f textarea:focus{border-color:var(--ai);outline:none;background:var(--card,#fff)}
.qgai-f textarea:disabled{opacity:.6}
.qgai-s{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--ai2);color:#fff;display:grid;place-items:center;cursor:pointer;transition:background .15s}
[data-theme="dark"] .qgai-s{background:#2F4FA6}
.qgai-s svg{width:22px;height:22px}.qgai-s:disabled{opacity:.4;cursor:default}
.qgai[dir="ltr"] .qgai-s svg{transform:scaleX(-1)}
.qgai-ft{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 12px;padding:0 16px 12px;color:var(--mut,#6B7590);font-size:calc(11.5px * var(--fs,1))}
.qgai-left{font-weight:700;color:var(--ai)}
bdi{unicode-bidi:isolate}
/* 🙋 المساعد العام: الترحيب، صورة السؤال، بطاقة النتيجة، الأزرار السريعة، وسطر «تسأل عن» */
.qgh-w .qgai-tx>b{display:block;font-family:var(--disp,"Tajawal"),sans-serif;font-size:calc(19px * var(--fs,1));color:var(--ai2);margin-bottom:4px}
.qgh-go{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.qgh-gb{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px;border-radius:16px;border:1px solid var(--aibd);background:var(--aibg);color:var(--ai2);font:inherit;text-align:start;cursor:pointer;transition:background .15s,border-color .15s}
.qgh-gb:hover{background:var(--aihv);border-color:var(--ai)}
.qgh-gb:focus-visible{outline:2px solid var(--ai);outline-offset:2px}
.qgh-gb .i{font-size:24px;line-height:1;margin-bottom:6px}
.qgh-gb b{font-size:calc(15.5px * var(--fs,1));font-weight:800}
.qgh-gb small{color:var(--mut,#6B7590);font-size:calc(12.5px * var(--fs,1));font-weight:500;line-height:1.45}
.qgh-tip{margin:12px 0 0;color:var(--mut,#6B7590);font-size:calc(13px * var(--fs,1));line-height:1.6}
.qgai-m.u.qgh-ui{padding:6px;max-width:min(80%,330px);white-space:normal}
.qgh-ui img{display:block;max-width:100%;max-height:240px;border-radius:12px;background:#fff;object-fit:contain}
.qgh-ui small{display:block;margin:7px 6px 3px;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:calc(12.5px * var(--fs,1));line-height:1.55;opacity:.9;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left}
.qgh-f .fd-res{box-shadow:none;border-radius:16px;padding:14px}
.qgh-f .fd-h{margin-bottom:10px}.qgh-f .fd-h .ic{width:36px;height:36px;font-size:17px}
.qgh-f .fd-h b{font-size:calc(16.5px * var(--fs,1))}
.qgh-f .fd-locs{margin-bottom:10px}
.qgh-f .fd-diff{margin-bottom:10px}
.qgh-ans{margin:0 0 8px;font-size:calc(14.5px * var(--fs,1));line-height:1.7;color:var(--ink,#17213A)}
.qgh-pv summary{cursor:pointer;color:var(--ai);font-weight:700;font-size:calc(14px * var(--fs,1));padding:4px 0;width:max-content}
.qgh-pv summary:focus-visible{outline:2px solid var(--ai);outline-offset:2px;border-radius:6px}
.qgh-pv .fd-pv{margin-top:6px}
.qgh-f .fd-acts{margin-top:10px}
.qgh-f .fd-res.tip{text-align:start}
.qgh-exw{margin-top:10px}
.qgh-exb{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:10px 18px;background:linear-gradient(135deg,#15337A,#2F62E0);color:#fff;font:inherit;font-weight:800;font-size:calc(15px * var(--fs,1));cursor:pointer;box-shadow:0 6px 16px rgba(35,80,196,.26);transition:filter .15s}
.qgh-exb svg{width:18px;height:18px}.qgh-exb svg path+path{fill:var(--aigold)}
.qgh-exb:hover{filter:brightness(1.1)}
.qgh-lead{display:flex;align-items:center;gap:6px;color:var(--ai);font-weight:800;font-size:calc(13px * var(--fs,1));margin-bottom:4px}
.qgh-lead svg{width:16px;height:16px}.qgh-lead svg path+path{fill:var(--aigold)}
.qgh-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:-4px}
.qgh-chips button{border:1px solid var(--aibd);background:var(--aibg);color:var(--ai2);border-radius:999px;padding:7px 14px;font:inherit;font-weight:700;font-size:calc(13.5px * var(--fs,1));cursor:pointer;transition:background .15s,border-color .15s}
.qgh-chips button:hover{background:var(--aihv);border-color:var(--ai)}
.qgh-ctx{display:flex;align-items:center;gap:10px;padding:9px 16px 0;font-size:calc(13px * var(--fs,1));color:var(--mut,#6B7590)}
.qgh-ctx[hidden]{display:none}
.qgh-ctx span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qgh-ctx b{color:var(--ai2);font-weight:800}
.qgh-nw{margin-inline-start:auto;flex:none;border:1px solid var(--aibd);background:transparent;color:var(--ai);border-radius:999px;padding:4px 12px;font:inherit;font-weight:700;font-size:calc(12.5px * var(--fs,1));cursor:pointer}
.qgh-nw:hover{background:var(--aibg)}
.qgh-cam{flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--aibd);background:var(--aibg);color:var(--ai2);display:grid;place-items:center;cursor:pointer;transition:border-color .15s,background .15s}
.qgh-cam svg{width:22px;height:22px}.qgh-cam:hover{border-color:var(--ai);background:var(--aihv)}.qgh-cam:disabled{opacity:.4;cursor:default}
/* 🙋 الزر العائم + فقاعة «تحتاج مساعدة؟» */
.qgh{position:fixed;z-index:65;bottom:calc(20px + env(safe-area-inset-bottom,0px));inset-inline-end:20px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none;font-family:"Tajawal","Segoe UI",Tahoma,sans-serif}
.qgh>*{pointer-events:auto}
.qgh-fab{width:60px;height:60px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#15337A,#2F62E0);box-shadow:0 10px 24px rgba(21,51,122,.34),0 2px 6px rgba(0,0,0,.16);transition:transform .18s,box-shadow .18s;animation:qgh-in .35s ease-out both}
.qgh-fab svg{width:30px;height:30px}.qgh-fab svg path+path{fill:var(--aigold)}
.qgh-fab:hover{transform:translateY(-2px);box-shadow:0 14px 30px rgba(21,51,122,.42),0 3px 8px rgba(0,0,0,.18)}
.qgh-fab:focus-visible{outline:3px solid var(--aigold);outline-offset:3px}
@keyframes qgh-in{from{opacity:0;transform:translateY(10px) scale(.92)}to{opacity:1;transform:none}}
.qgh-bub{position:relative;display:flex;align-items:flex-start;gap:4px;width:max-content;max-width:min(290px,calc(100vw - 40px));background:var(--card,#fff);color:var(--ink,#17213A);border:1px solid var(--aibd);border-radius:16px;box-shadow:0 14px 34px rgba(10,20,50,.18);padding:12px 14px;padding-inline-end:6px;opacity:0;transform:translateY(8px);transition:opacity .22s,transform .22s}
.qgh-bub.in{opacity:1;transform:none}
.qgh-bub:after{content:"";position:absolute;bottom:-7px;inset-inline-end:24px;width:12px;height:12px;background:var(--card,#fff);border-right:1px solid var(--aibd);border-bottom:1px solid var(--aibd);transform:rotate(45deg)}
.qgh-bo{flex:1;border:0;background:none;color:inherit;font:inherit;text-align:start;cursor:pointer;padding:0;display:flex;flex-direction:column;gap:3px}
.qgh-bo b{font-size:calc(15.5px * var(--fs,1));font-weight:800;color:var(--ai2)}
.qgh-bo span{font-size:calc(13.5px * var(--fs,1));color:var(--mut,#6B7590);line-height:1.55}
.qgh-bx{flex:none;width:28px;height:28px;margin-top:-4px;border-radius:50%;border:0;background:transparent;color:var(--mut,#6B7590);font-size:13px;cursor:pointer}
.qgh-bx:hover{background:var(--aibg);color:var(--ink,#17213A)}
.qgh-bo:focus-visible,.qgh-bx:focus-visible{outline:2px solid var(--ai);outline-offset:2px;border-radius:8px}
html.qgh-on body:after{content:"";display:block;height:92px}
@media print{.qgh{display:none}}
@media (max-width:640px){
  .qgai{align-items:flex-end;padding:0}
  .qgai-p{width:100%;height:min(88vh,100%);height:88dvh;border-radius:22px 22px 0 0;transform:translateY(40px)}
  .qgai-h{padding-top:18px;position:relative}
  .qgai-h:before{content:"";position:absolute;top:7px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:var(--line,#E1E6F0)}
  .qgai-log{padding:12px 14px 6px}
  .qgai-h{gap:10px}.qgai-ht small{display:none}.qgai-lg button{padding:6px 10px}
  .qgai-ft{padding-bottom:max(10px,env(safe-area-inset-bottom))}
  .qgai-f{padding:10px 10px 8px;gap:6px}
  .qgh-ctx{padding:8px 14px 0}
  .qgh{bottom:calc(14px + env(safe-area-inset-bottom,0px));inset-inline-end:14px}
  .qgh-fab{width:54px;height:54px}.qgh-fab svg{width:27px;height:27px}
  .qgh-bub:after{inset-inline-end:21px}
}
@media (prefers-reduced-motion:reduce){.qgai,.qgai-p,.qgh-bub{transition:none}.qgai-dots i,.qgai-m.a.live .qgai-tx>:last-child:after,.qgh-fab{animation:none}}`;
  document.head.appendChild(css);
  window.QGAI = { init, status, slot, fill, open, close, render, fab, help, _conv: CONV, _help: H };
})();
