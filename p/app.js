/* Q-Guide practice app — vanilla JS, RTL. Data sets are AES-GCM encrypted; the key comes from the API after Google sign-in. */
(function () {
  'use strict';
  if (location.protocol === 'http:' && /q-guide\.online$/.test(location.hostname)) { location.replace('https://' + location.host + location.pathname + location.search + location.hash); return; }
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} return; }
  const $ = (s, r) => (r || document).querySelector(s);
  const app = $('#app');
  const LS = { auth: 'qg_auth', prog: 'qg_prog_', fs: 'qg_fs', tab: 'qg_tab', theme: 'qg_theme' };
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const EN = !!(window.QGL && QGL.en);   // 🌐 الواجهة بالإنجليزي (p/i18n.js)
  const enN = (n, one, many) => n + ' ' + (n === 1 ? one : many);   // English: 1 day · 3 days
  const BADGE_U_EN = { q: ['question', 'questions'], d: ['day', 'days'], s: ['section', 'sections'], m: ['model', 'models'], t: ['mock test', 'mock tests'], p: ['sheet', 'sheets'] };   // وحدات الشارات بالإنجليزي
  const enPl = w => !w ? w : /(s|x|ch|sh)$/i.test(w) ? w + 'es' : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + 'ies' : w + 's';
  const PART_AR = { 1: _T('التناظر اللفظي'), 2: _T('إكمال الجمل'), 3: _T('الخطأ السياقي'), 4: _T('استيعاب المقروء') };
  let auth = null, manifest = null, cryptoKey = null;
  const cache = {};
  // 🆓 الحساب المجاني (زائر غير مشترك): القسم 1، النموذج 1، الاختبار المحاكي 1، تحديد المستوى، البحث (يعرف مكان السؤال بدون الحل)، والساحة 1v1 بحد يومي
  const isFree = () => !!(auth && auth.role === 'free');
  const FREE_SETS = ['q1', 'v1', 'placement'], JOIN_URL = 'https://www.youtube.com/@Q-guide1/join', PRICE = 140, FREE_GAMES = 3;
  // 💳 الدفع من الموقع (Tap): الزائر (أو اللي انتهى اشتراكه) يدفع وتنفتح له الدورة على طول — auth.pay = {on, price, test} من الخادم
  const PAY_SS = 'qg_tap';   // رقم العملية اللي رجع منها الطالب من صفحة الدفع (لين نتحقق منها)
  const payOn = () => !!(auth && auth.role === 'free' && auth.pay && auth.pay.on);
  const payPending = () => { try { return sessionStorage.getItem(PAY_SS) || ''; } catch (e) { return ''; } };
  const payDone = () => { try { sessionStorage.removeItem(PAY_SS); } catch (e) {} };
  // 🛍 الدفع عن طريق سلة: الزائر يشتري من متجر المالك في سلة ← يلصق رقم الطلب هنا (salla_claim) ← نبدّل جلسته بجلسة المشترك — auth.salla = {on, url, price}
  //    (ولو إيميله في سلة نفس إيميله هنا، الخادم يفتح له لحاله ونلقطه بـ salla_check)
  const SAL_SS = 'qg_salla';   // متى فتح صفحة الدفع في سلة (نتحقق من طلبه لين 45 دقيقة)
  const sallaOn = () => !!(auth && auth.role === 'free' && auth.salla && auth.salla.on && auth.salla.url);
  const sallaPending = () => { try { const t = +sessionStorage.getItem(SAL_SS) || 0; return t && Date.now() - t < 45 * 60e3 ? t : 0; } catch (e) { return 0; } };
  const sallaDone = () => { try { sessionStorage.removeItem(SAL_SS); } catch (e) {} };
  // 🎬 مقاطع الشرح على قناة Q-guide1 (نفس روابط باركود المذكرات) · مقطعا القواعد (الكمي واللفظي) انشالوا من الموقع بطلب المالك
  const YT = {
    q: { name: _T('القسم'), list: 'PLNdATbln9B4k',
      v: ['WBnwPsSTuaU:36:18', 'SLGGlm5YwJU:34:43', 'VoVaWRFbIjg:36:50', 'dwvgSfK6Tfw:34:10', 'eVZsYR0QPq8:35:39', 'd3hX21VfSWo:34:19', 'EMNaSCi0IMk:43:40', 'fQynzmnlZmI:34:15', 'i4ELxBTMUw0:40:51', 'mZdhgMMOWB0:40:01', 'bscPMN6lDPQ:36:29', '6AxdKpQZevk:34:16', 'iVR5LsbBBv4:29:38', 'vf-aOADLlCs:56:06'] },
    v: { name: _T('النموذج'), list: 'PLVFHCj9Zxd0E',
      v: ['qWlJ9gh2G3U:24:15', 'l4v74KKFrj8:23:59', '5EOXngu_9R0:19:54', 'BFewNC6ocP4:25:05', 'r34_ruXqoJg:17:50', '85cq5t4G9Rs:23:07', 'za5kEoY6bxI:17:37', 'ShJH_Dpijiw:16:33', 'SmU59p7M5OY:18:37', 'V1-07MAx6YI:12:32', 'oYJmNRMwAKg:15:49', 'vSrkVscXAXs:17:45', 'VcaywhqSsVM:21:40', 'mFYiB0Z9G5k:15:17',
        'RD2yd4xavzw:17:18'] } };   // الـ15 = «الأسئلة الجديدة» (Verbal/Extra Questions)
  // اسم المقطع/المجموعة: «النموذج 7»… والـ15 في اللفظي = «الأسئلة الجديدة»
  const vLabel = (k, n) => k === 'v' && +n === 15 ? _T('الأسئلة الجديدة') : YT[k].name + ' ' + n;
  // 👨‍🏫 عبدالله الشمراني (اللفظي): «التأسيس» 4 مقاطع داخل الموقع لكل المشتركين (af:1–4، المالك يرفعها من «⬆️ رفع المقاطع») + «التدريب» على النماذج الـ14 (قريباً)
  //    بنفس ترتيب «قواعد القسم اللفظي» (مذكرة التأسيس): 1 التناظر · 2 إكمال الجمل · 3 الخطأ السياقي · 4 استيعاب المقروء (أسماؤها من PART_AR)
  const ABD = { found: [1, 2, 3, 4], models: 14, en: { 1: 'Analogy', 2: 'Sentence Completion', 3: 'Contextual Error', 4: 'Reading Comprehension' } };
  //    تدريبه على النماذج = at:1–14 (داخل الموقع لكل المشتركين، يرفعها من «🎬 مقاطعي»)
  // 👨‍🏫 سلمان الفرج: «التأسيس» = دروس «قواعد الكمي» الـ24 (sf:1–24، بنفس ترتيب مذكرة تأسيس الكمي) · «التدريب» = شرح الأقسام والنماذج (q/v)
  //    كل درس: [عربي، إنجليزي، صفحته في مذكرة التأسيس #wb-tq، الوحدة] — بالإنجليزي يطلع الاسم الإنجليزي
  // i18n:off
  const QR_U = [['أساسيات الحساب', 'Arithmetic Foundations'], ['الأعداد والأنماط والجبر', 'Numbers, Patterns & Algebra'], ['النسب والنسبة المئوية وتطبيقاتها', 'Ratios, Percentages & Applications'], ['الهندسة', 'Geometry']];
  const QR_L = [['الجمع والطرح', 'Addition & Subtraction', 4, 1], ['الضرب والقسمة', 'Multiplication & Division', 11, 1], ['الأعداد العشرية والتقريب', 'Decimals & Approximation', 21, 1],
    ['الكسور', 'Fractions', 28, 1], ['الأسس', 'Exponents', 36, 1], ['الجذور', 'Roots', 44, 1],
    ['المضاعفات والقواسم والأعداد الأولية', 'Multiples, Divisors & Primes', 60, 2], ['الأعداد المتتالية والأرقام والعد', 'Consecutive Numbers, Digits & Counting', 68, 2], ['الأنماط والدوريات', 'Patterns & Cycles', 77, 2],
    ['المعادلات والمسائل اللفظية', 'Equations & Word Problems', 87, 2], ['المقادير الجبرية والمتطابقات', 'Algebraic Expressions & Identities', 94, 2], ['المتباينات والمقارنات بمتغيرات', 'Inequalities & Comparisons with Variables', 100, 2],
    ['النسبة والتناسب', 'Ratio & Proportion', 116, 3], ['النسبة المئوية', 'Percentages', 127, 3], ['الربح والخسارة والخصم', 'Profit, Loss & Discount', 136, 3],
    ['السرعة والمسافة والزمن', 'Speed, Distance & Time', 143, 3], ['الأعمار والمتوسط الحسابي', 'Ages & Averages', 149, 3], ['الإحصاء وقراءة الرسوم البيانية', 'Statistics & Reading Charts', 155, 3],
    ['الزوايا والمستقيمات المتوازية', 'Angles & Parallel Lines', 174, 4], ['المثلث', 'Triangles', 186, 4], ['الأشكال الرباعية والمضلعات', 'Quadrilaterals & Polygons', 200, 4],
    ['الدائرة والساعة', 'Circles & Clocks', 210, 4], ['المساحات المظللة والأشكال المركّبة', 'Shaded Areas & Composite Shapes', 225, 4], ['المجسمات والإحداثيات والاتجاهات', '3D Shapes, Coordinates & Directions', 240, 4]];
  // i18n:on
  const qrName = n => QR_L[n - 1][EN ? 1 : 0];
  const ytUrl = id => 'https://youtu.be/' + id;
  // 🎬 المشترك المجاني أو بالتحويل: المقاطع تشتغل هنا داخل الموقع (#watch-…) برابط مؤقت وعليها إيميله · مشترك يوتيوب يكمل على يوتيوب (مقاطع الأعضاء)
  // auth.vids = المقاطع المرفوعة للموقع · لو مقطع ما انرفع للحين يفتح نسخته الخاصة في يوتيوب (auth.yt) مثل قبل
  const vidSub = () => !!(auth && (auth.sub === 'free' || auth.sub === 'bank' || auth.sub === 'pay'));
  const vidHas = k => !!(auth && Array.isArray(auth.vids) && auth.vids.indexOf(k) >= 0);
  const ytAlt = () => auth && auth.yt && vidSub() ? auth.yt : null;
  const YT_ALT_TIP = _T('مقطع خاص لك: افتحه وأنت داخل يوتيوب بنفس إيميل Google اللي تدخل فيه الموقع');
  const TGT = ' target="_blank" rel="noopener"';
  const vidHash = (k, n) => '#watch-' + k + n;
  const inSite = (k, n) => vidSub() && vidHas(k + ':' + n) ? { url: vidHash(k, n), tgt: '', site: true } : null;
  function ytFor(setId) { const m = /^([qv])(\d{1,2})$/.exec(setId || ''); if (!m) return null; const k = YT[m[1]], raw = k.v[+m[2] - 1]; if (!raw) return null; const i = raw.indexOf(':'), lab = vLabel(m[1], m[2]), dur = raw.slice(i + 1);
    const s = inSite(m[1], +m[2]); if (s) return Object.assign({ id: raw.slice(0, i), dur, label: lab, alt: false }, s);
    const A = ytAlt(), alt = A && A[m[1]] && A[m[1]].v ? A[m[1]].v[+m[2] - 1] : ''; const id = alt || raw.slice(0, i); return { id, dur, url: ytUrl(id), tgt: TGT, label: lab, alt: !!alt }; }
  const ytList = k => { const A = ytAlt(); return (A && A[k] && A[k].list) || YT[k].list; };
  const ytTip = (y, t) => y && y.site ? _T(' title="يشتغل هنا داخل الموقع"') : y && y.alt ? ` title="${YT_ALT_TIP}"` : t ? ` title="${t}"` : '';
  const YTSVG = '<svg class="yti" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#FF0000"/><path d="M11 5.5v9l8-4.5z" fill="#fff"/></svg>';
  const PLAYSVG = '<svg class="yti" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#2350C4"/><path d="M11 5.5v9l8-4.5z" fill="#fff"/></svg>';
  const vIcon = y => y && y.site ? PLAYSVG : YTSVG;
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
    const h = fmtExp0(t); return EN ? '<div class="arc" dir="rtl" lang="ar">' + h + '</div>' : h;
  }
  function fmtExp0(t) {
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
  function waUrl() { const who = auth ? ((auth.display || auth.name || '') + ' · ' + (auth.email || '')) : ''; return 'https://wa.me/966508003683?text=' + encodeURIComponent(_T('السلام عليكم، أحتاج دعم فني في منصة Q-Guide') + (who ? '\n' + who : '') + _T('\nالمشكلة: ')); }
  function ctlHtml() { return _T`<span class="ctl"><button id="fsm" title="تصغير الخط">A-</button><button id="fsp" title="تكبير الخط">A+</button>${QGL.btn('lng')}<button id="dm" title="الوضع الداكن/الفاتح">🌙</button><a class="wa" href="${waUrl()}" target="_blank" rel="noopener" title="دعم فني عبر واتساب"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.3c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.3.1-1.4l-.5-.3-1.9-.9c-.3-.1-.5-.2-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.5-.6-.5h-.4z"/></svg><span>دعم</span></a></span>`; }
  function bindCtl() { const a = $('#fsm'), b = $('#fsp'), c = $('#dm'); if (a) a.onclick = () => bumpFs(-.1); if (b) b.onclick = () => bumpFs(.1); if (c) c.onclick = toggleTheme; applyTheme(); }
  function bumpFs(d) { let f = lsGet(LS.fs, 1); f = Math.min(1.4, Math.max(.85, +(f + d).toFixed(2))); lsSet(LS.fs, f); applyFs(); }
  async function api(body) {
    if (!window.QG.API || window.QG.API.indexOf('__') === 0) throw new Error('API not configured');
    const r = await fetch(window.QG.API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    const j = await r.json(); if (EN && j && typeof j.msg === 'string') j.msg = _T(j.msg);   // 🌐 رسائل الخادم بالإنجليزي
    return j;
  }
  function hex2buf(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  async function getKey() { if (cryptoKey) return cryptoKey; cryptoKey = await crypto.subtle.importKey('raw', hex2buf(auth.key), 'AES-GCM', false, ['decrypt']); return cryptoKey; }
  const DATA_V = 3;   // ⬆️ ارفعه كل ما تغيّرت ملفات الأسئلة (حتى ما يبقى الطالب على نسخة قديمة من الكاش)
  async function loadSet(id) {
    if (cache[id]) return cache[id];
    if (isFree() && FREE_SETS.indexOf(id) < 0) throw new Error('locked');   // 🔒 للمشتركين
    if (id === 'qall' || id === 'vall') {
      const k = id[0]; let got = 0; const el = () => document.getElementById('ldmsg');
      const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const m = el(); if (m) m.textContent = _T('تحميل الأسئلة… ') + got + ' / 14'; return p; })));
      let obj;
      if (k === 'q') obj = { kind: 'quant', id: 'qall', title: _T('الاختبار الشامل — الكمي'), sub: 'All 14 sections', items: [].concat(...parts.map(p => p.items.map((it, j) => Object.assign({}, it, { src: p.id, sidx: j })))) };
      else obj = { kind: 'verbal', id: 'vall', title: _T('الاختبار الشامل — اللفظي'), sub: 'All 14 models', groups: [].concat(...parts.map(p => originGroups(p))) };
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
    if (EN && /^[qv]\d{1,2}$/.test(id)) { cache[id].title = SET_NAME(id);   // 🌐 «القسم 2» من ملف البيانات → Section 2
      (cache[id].groups || []).forEach(g => { if (g.kind === 'part' && g.title) g.title = String(g.title).split(' – ')[0]; }); }   // «Analogies – التناظر اللفظي» → Analogies
    return cache[id];
  }
  // 👤 الاسم الأول للترحيب: الأسماء المركّبة (عبد الله، عبد العزيز، أبو فهد، Abdul Rahman) تبقى كاملة
  function firstName(s) { const w = String(s || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return ''; return w.length > 1 && /^(عبد|عبدال|أبو|ابو|أم|ام|abd|abdul|abdel|abdol|abu)$/i.test(w[0]) ? w[0] + ' ' + w[1] : w[0]; }
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
  const TOPICS = { ana: { t: _T('التناظر اللفظي'), k: 'verbal', i: '🔗' }, sen: { t: _T('إكمال الجمل'), k: 'verbal', i: '✍️' }, err: { t: _T('الخطأ السياقي'), k: 'verbal', i: '🔍' }, read: { t: _T('استيعاب المقروء'), k: 'verbal', i: '📄' },
    arith: { t: _T('الحساب والأعداد'), k: 'quant', i: '🔢' }, alg: { t: _T('الجبر والمعادلات'), k: 'quant', i: '𝑥' }, geo: { t: _T('الهندسة'), k: 'quant', i: '📐' }, stat: { t: _T('الإحصاء والاحتمالات'), k: 'quant', i: '📊' }, cmp: { t: _T('أسئلة المقارنة'), k: 'quant', i: '⚖️' } };
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
      let got = 0; for (const id of ids) { try { await loadSet(id); } catch (e) {} got++; if (onmsg) onmsg(_T('قراءة إجاباتك السابقة… ') + got + ' / ' + ids.length); }
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
    const parts = await Promise.all(Array.from({ length: 14 }, (_, i) => loadSet(k + (i + 1)).then(p => { got++; const e = el(); if (e) e.textContent = _T('تجهيز الأسئلة… ') + got + ' / 14'; return p; })));
    const h = histGet();
    const keep = (it, src, sidx) => mode === 'wrong' ? (h.items[src] && h.items[src][sidx] && !h.items[src][sidx][2]) : mode === 'star' ? !!markOf(src, sidx) : itemTopics(it).indexOf(topic) >= 0;
    const kn = kind === 'quant' ? _T('الكمي') : _T('اللفظي');
    const title = mode === 'wrong' ? _T('🔁 مراجعة أخطائي — ') + kn : mode === 'star' ? _T('⭐ أسئلة دفتري — ') + kn : (TOPICS[topic].i + _T(' تدريب: ') + TOPICS[topic].t);
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
    if (!auth || hbBusy || payPending()) return; hbBusy = true;   // 💳 أثناء التحقق من الدفع ما نلمس الجلسة
    try {
      const r = await api({ op: 'me', session: auth.session });
      if (r && !r.ok && r.error === 'upgraded') { if (!((await sallaPoll()) || {}).paid) logout(esc(r.msg || _T('تم تفعيل اشتراكك، سجّل دخولك من جديد.')), false, 1); }   // 🎉 الزائر اشترك (لو من سلة: نبدّل جلسته على طول)
      else if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) logout(esc(r.msg || _T('انتهت الجلسة، سجّل دخولك من جديد.')));
      else if (r && r.ok && auth.role === 'admin' && ((r.staff && r.staff !== auth.staff) || (r.adv || '') !== (auth.adv || '') || (r.teach || '') !== (auth.teach || ''))) { auth.staff = r.staff || auth.staff; auth.adv = r.adv || ''; auth.teach = r.teach || ''; lsSet(LS.auth, auth); }   // 🧑‍🏫 صار مرشد؟ · 👨‍🏫 صار يرفع مقاطعه؟
      if (r && r.ok && auth && auth.role === 'free' && (JSON.stringify(r.pay || null) !== JSON.stringify(auth.pay || null) || JSON.stringify(r.salla || null) !== JSON.stringify(auth.salla || null))) { auth.pay = r.pay || null; auth.salla = r.salla || null; lsSet(LS.auth, auth); }   // 💳🛍 الدفع انفتح/انقفل
      if (r && r.ok && auth && auth.role !== 'free' && Array.isArray(r.vids) && JSON.stringify(r.vids) !== JSON.stringify(auth.vids || [])) {   // 🎬 مقاطع جديدة انرفعت للموقع
        auth.vids = r.vids; lsSet(LS.auth, auth); if (/^#sharh(-(salman|abdullah)(\/[ft])?)?$/.test(location.hash)) route(); }   // صفحة المدرسين مفتوحة: نحدّث حالة الدروس
      if (r && r.ok && auth && auth.role !== 'admin' && auth.role !== 'free' && r.sub && (r.sub !== auth.sub || JSON.stringify(r.yt || null) !== JSON.stringify(auth.yt || null))) {   // 💳 المالك غيّر نوع اشتراكه
        auth.sub = r.sub; auth.yt = r.yt || null; lsSet(LS.auth, auth); if (!location.hash || location.hash === '#') renderHome(); }
    } catch (e) {} finally { hbBusy = false; }
  }
  setInterval(heartbeat, 3 * 60 * 1000);

  // ---------- 🆓 الزائر: المسارات المفتوحة + نافذة الاشتراك ----------
  const freeRoute = h => h === '' || h === 'paid' || h === 'me' || h === 'sharh' || /^sharh-(salman|abdullah)(\/[ft])?$/.test(h) || h === 'arena' || /^duel-[A-Za-z0-9]{6}$/.test(h) || h === 'board-arena' || h === 'level' || h === 'find' || /^[qv]1(@\d+)?$/.test(h);
  function lockName(h) {
    const m = /^([qv])(\d+)/.exec(h); if (m) return SET_NAME(m[1] + m[2]);
    if (/^sub-t\d{1,2}$/.test(h)) return _T('الاختبار المحاكي ') + h.slice(5);
    if (/^board/.test(h)) return _T('لوحة الصدارة'); if (/^t-/.test(h)) return _T('التدريب على نقاط ضعفك'); if (/^watch-af/.test(h)) return _T('تأسيس اللفظي'); if (/^watch-sf/.test(h)) return _T('تأسيس الكمي'); if (/^watch-at/.test(h)) return _T('تدريب اللفظي');
    h = h.replace(/^(rules(-v)?)\/.*$/, '$1');   // #rules/circles
    return { notes: _T('دفتري'), rules: _T('قوانين الكمي'), 'rules-v': _T('قواعد اللفظي'), plan: _T('خطة المذاكرة'), skills: _T('نقاط القوة والضعف'), badges: _T('الإنجازات'), vocab: _T('قاموس الكلمات'), 'wb-q': _T('مذكرة الكمي'), 'wb-v': _T('مذكرة اللفظي'), 'wb-tq': _T('تأسيس الكمي'), 'wb-tv': _T('تأسيس اللفظي') }[h.replace(/-v\d+$/, '').replace(/@\d+$/, '')] || '';
  }
  function subDlg(what, from, stay) {
    if (isFree() && window.QGT) QGT.ev('sub', what || from || 'زر الاشتراك');   // 👀 فتح نافذة الاشتراك (وش اللي فتحها)
    document.querySelectorAll('.subdlg').forEach(x => x.remove());
    const ov = document.createElement('div'); ov.className = 'qgdlg subdlg'; ov.setAttribute('dir', EN ? 'ltr' : 'rtl');
    const wa = 'https://wa.me/966508003683?text=' + encodeURIComponent(_T('السلام عليكم، أبي أشترك في دورة Q-Guide') + (auth && auth.email ? _T('\nإيميلي في الموقع: ') + auth.email : ''));
    const SL = sallaOn() ? auth.salla : null, PAY = !SL && payOn() ? auth.pay : null;   // 🛍 سلة أول (لو المالك شغّلها)، وإلا 💳 الدفع من الموقع (تاب)
    ov.innerHTML = _T`<div class="qgdlg-box sub-box" role="dialog" aria-modal="true" aria-labelledby="subh">
      <button class="sub-x" type="button" aria-label="إغلاق">✕</button>
      ${what ? _T`<p class="sub-lock">🔒 ${esc(what)} للمشتركين في الدورة</p>` : ''}
      <h3 id="subh">اشترك في دورة Q-Guide</h3>
      <ul class="sub-l"><li><b>14</b> قسم كمي و<b>14</b> نموذج لفظي بالشرح والفيديو</li><li><b>17</b> اختبار محاكي بنفس نظام قياس</li><li>الساحة 1v1 بدون حد، ولوحات الصدارة</li><li>المذكرات وخطة المذاكرة ونقاط ضعفك</li></ul>
      ${SL ? _T`<div class="sub-pay"><button type="button" class="btn gold sub-paygo" id="sallago">💳 ادفع ${SL.price || PRICE} ريال واشترك الحين</button>
        <p class="sub-payn">مدى · Apple Pay · فيزا وماستركارد، عن طريق متجرنا في سلة. بعد الدفع تلصق رقم الطلب هنا، وتنفتح لك الدورة كاملة لمدة شهر.</p>
        <button type="button" class="lnk sub-have" id="slhave">دفعت؟ فعّل اشتراكك برقم الطلب</button></div>
      <div class="sub-or" role="separator"><span>أو اشترك عن طريق يوتيوب</span></div>` : PAY ? _T`<div class="sub-pay"><button type="button" class="btn gold sub-paygo" id="paygo">💳 ادفع ${PAY.price || PRICE} ريال واشترك الحين</button>
        <p class="sub-payn">مدى · Apple Pay · فيزا وماستركارد. الدورة كاملة تنفتح لك على طول لمدة شهر.</p>${PAY.test ? _T('<p class="sub-test">🧪 وضع التجربة: ما ينخصم أي مبلغ حقيقي</p>') : ''}</div>
      <div class="sub-or" role="separator"><span>أو اشترك عن طريق يوتيوب</span></div>` : _T('<h4>طريقة الاشتراك</h4>')}
      <ol class="sub-s"><li>انتسب لقناة Q-guide1 في يوتيوب بـ <b>${PRICE} ريال</b></li><li>أرسل لنا على واتساب إيميلك اللي دخلت فيه هنا</li><li>نفعّل لك الدورة كاملة على نفس حسابك</li></ol>
      <div class="sub-a${PAY || SL ? ' alt' : ''}"><a class="btn ${PAY || SL ? 'ghost' : 'gold'}" href="${JOIN_URL}" target="_blank" rel="noopener">اشترك من يوتيوب</a><a class="btn wa" href="${wa}" target="_blank" rel="noopener">راسلنا على واتساب</a></div>
    </div>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
    const close = () => { ov.remove(); document.removeEventListener('keydown', onK); };
    const onK = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onK);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.sub-x').onclick = close; (ov.querySelector('#sallago') || ov.querySelector('#paygo') || ov.querySelector('.sub-a a')).focus({ preventScroll: true });
    const pg = ov.querySelector('#paygo'); if (pg) pg.onclick = () => payGo(pg);
    const sg = ov.querySelector('#sallago'); if (sg) sg.onclick = () => sallaSteps(ov, what, close);
    const sh = ov.querySelector('#slhave'); if (sh) sh.onclick = () => sallaSteps(ov, what, close, 1);   // دفع قبل (أو أبوه دفع عنه): على طول لخانة رقم الطلب
    ov.querySelectorAll('.sub-a a').forEach(a => a.addEventListener('click', () => { if (isFree() && window.QGT) { QGT.ev('subgo', a.classList.contains('wa') ? 'واتساب' : 'يوتيوب'); QGT.flush(true); } }));
    if (SL && sallaPending() && !stay) sallaSteps(ov, what, close);   // رجع للنافذة وهو فاتح صفحة الدفع: نكمل من خطوات سلة
  }
  // 🛍 خطوات الدفع عن طريق سلة (داخل نفس النافذة): ① افتح صفحة الدفع وادفع ② الصق رقم الطلب هنا ← يتفعّل اشتراكه على حسابه
  //    ref = جا من «دفعت؟ فعّل اشتراكك برقم الطلب» (أو أبوه دفع عنه): نركّز على خانة الرقم على طول
  const slWa = () => 'https://wa.me/966508003683?text=' + encodeURIComponent(_T('السلام عليكم، دفعت عن طريق سلة وما تفعّل اشتراكي') + '\n' + ((auth && auth.email) || ''));
  const enDigits = s => String(s || '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x6f0);
  function sallaSteps(ov, what, close, ref) {
    const SL = auth && auth.salla; if (!SL || !SL.url) return;
    const box = ov.querySelector('.sub-box'); if (!box) return;
    box.classList.add('slp');
    box.innerHTML = _T`<button class="sub-x" type="button" aria-label="إغلاق">✕</button>
      <button type="button" class="lnk slp-back">→ رجوع</button>
      <h3 id="subh">ادفع عن طريق متجرنا في سلة</h3>
      <ol class="slp-s">
        <li><span class="slp-n" aria-hidden="true">1</span><div class="slp-t"><b>افتح صفحة الدفع وادفع</b><small>بمدى أو Apple Pay أو البطاقة.</small><a class="btn gold slp-go" id="slopen" href="${esc(SL.url)}" target="_blank" rel="noopener">🛍 افتح صفحة الدفع</a></div></li>
        <li><span class="slp-n" aria-hidden="true">2</span><div class="slp-t"><b>الصق رقم الطلب هنا</b><small>يطلع لك بعد الدفع في صفحة الطلب، ويوصلك برسالة من سلة على جوالك.</small>
          <form class="slp-ref" novalidate><input id="slref" type="text" inputmode="numeric" autocomplete="off" dir="ltr" maxlength="60" placeholder="#218402731" aria-label="رقم الطلب"><button type="submit" class="btn" id="slclaim">✓ فعّل اشتراكي</button></form>
          <div class="slp-st" role="status" aria-live="polite"></div></div></li>
      </ol>
      <p class="slp-help">دفعت وما تفعّل اشتراكك؟ <a href="${slWa()}" target="_blank" rel="noopener">راسلنا على واتساب</a></p>`;
    box.querySelector('.sub-x').onclick = close;
    box.querySelector('.slp-back').onclick = () => { close(); subDlg(what, '', 1); };
    const go = box.querySelector('#slopen');
    go.addEventListener('click', () => {   // الرابط يفتح صفحة سلة بنفسه (تبويب جديد) — ولو إيميله في سلة نفس إيميله هنا يتفعّل لحاله (نتحقق بالخلفية)
      try { sessionStorage.setItem(SAL_SS, String(Date.now())); } catch (e) {}
      if (window.QGT) { QGT.ev('subgo', 'سلة'); QGT.flush(true); } });
    const f = box.querySelector('.slp-ref'), inp = f.querySelector('#slref'), btn = f.querySelector('#slclaim');
    let slT = 0;   // ⏳ الطلب ما وصلنا للحين (إيميل سلة يوصل بعد الدفع بدقيقة أو دقيقتين): نعيد نفس الرقم لحاله
    inp.addEventListener('input', () => { clearTimeout(slT); const st = box.querySelector('.slp-st'); if (st && /\b(bad|na|mw)\b/.test(st.className)) slStatus({}); });
    const claimNo = async (v, n) => {
      clearTimeout(slT); btn.disabled = true; inp.readOnly = true; if (!n) slStatus({ busy: 1 });
      let r = null; try { r = await api({ op: 'salla_claim', session: auth.session, ref: v.slice(0, 60), ua: navigator.userAgent.slice(0, 120) }); } catch (x) { r = null; }
      btn.disabled = false; inp.readOnly = false;
      if (r && r.ok && r.paid) { if (window.QGT) QGT.ev('subgo', 'رقم طلب سلة'); return sallaWin(r); }
      if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) { sallaDone(); return logout(esc(r.msg || '')); }
      if (r && r.ok && r.none && n < 9 && box.isConnected && inp.value.trim() === v) {   // كل 20 ثانية لمدة 3 دقايق، وبعدها «ما لقينا»
        slStatus({ mailwait: 1 });
        slT = setTimeout(() => { if (box.isConnected && inp.value.trim() === v && !btn.disabled) claimNo(v, n + 1); }, 20000);
        return;
      }
      slStatus(r || { ok: false, error: 'net' });
      if (!(r && r.ok && r.pending)) inp.focus();
    };
    f.onsubmit = e => {
      e.preventDefault(); if (btn.disabled) return;
      const v = inp.value.trim();
      if (!/\d{4,}/.test(enDigits(v))) { slStatus({ ok: false, error: 'ref' }); inp.focus(); return; }
      claimNo(v, 0);
    };
    (ref || sallaPending() ? inp : go).focus({ preventScroll: true });   // رجع من سلة: على خانة الرقم · أول مرة: على زر الدفع (بدون ما يطلع الكيبورد في الجوال)
  }
  // حالة رقم الطلب تحت الخانة
  function slStatus(r) {
    const el = document.querySelector('.slp-st'); if (!el) return;
    const set = (cls, html) => { el.className = 'slp-st' + (cls ? ' ' + cls : ''); el.innerHTML = html; };
    if (r.busy) return set('wait', _T('<span class="spin sm" aria-hidden="true"></span> نتحقق من رقم الطلب…'));
    if (r.pending) return set('wait', _T`⏳ طلبك${r.ref ? ' <bdi>#' + esc(r.ref) + '</bdi>' : ''} وصلنا وينتظر تأكيد الدفع (مثل التحويل البنكي). اشتراكك يتفعّل لحاله أول ما يتأكد.`);
    if (r.mailwait) return set('wait mw', _T('<span class="spin sm" aria-hidden="true"></span> ننتظر وصول طلبك من سلة… عادة ياخذ دقيقة أو دقيقتين بعد الدفع. خلّ الصفحة مفتوحة ويتفعّل اشتراكك لحاله.'));
    if (r.none) return set('na', _T('ما لقينا طلب بهذا الرقم. تأكد منه، ولو توك دفعت انتظر دقيقة وجرّب مرة ثانية.'));
    if (r.taken) return set('bad', _T`رقم الطلب هذا مستخدم في حساب ثاني. لو هو طلبك <a href="${slWa()}" target="_blank" rel="noopener">راسلنا على واتساب</a>.`);
    if (r.canceled) return set('bad', _T('الطلب هذا ملغي أو مسترجع.'));
    if (r.blocked) return set('bad', _T`الطلب هذا موقوف. <a href="${slWa()}" target="_blank" rel="noopener">راسلنا على واتساب</a>.`);
    if (r.used) return set('na', _T('الطلب هذا تفعّل قبل على حسابك وانتهت مدته.'));
    if (r.error === 'ref') return set('bad', _T('اكتب رقم الطلب (أرقام بس).'));
    if (r.error === 'busy') return set('bad', _T('محاولات كثيرة. انتظر شوي وجرّب.'));
    if (r.error === 'staff') return set('bad', _T('حساب المشرف ما يحتاج اشتراك.'));
    if (r.ok === false) return set('bad', esc(r.msg || _T('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.')));
    set('', '');
  }
  // نسأل الخادم: انفتح اشتراكه من سلة لحاله؟ (إيميله في سلة نفس إيميله هنا، أو المالك ربطه) — يرجّع الرد، أو null
  let salBusy = false;
  async function sallaPoll() {
    if (salBusy || !auth || !auth.session || auth.role === 'admin') return null; salBusy = true;
    try {
      const r = await api({ op: 'salla_check', session: auth.session, ua: navigator.userAgent.slice(0, 120) });
      if (r && r.ok && r.paid) { sallaWin(r); return r; }
      if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) { sallaDone(); logout(esc(r.msg || '')); return null; }
      const st = document.querySelector('.slp-st');
      if (r && r.ok && r.pending && st && !st.innerHTML) slStatus(r);   // طلب على إيميله ينتظر التحويل — وما نغطّي رسالة رقم الطلب
      return r;
    } catch (e) { return { ok: false, error: 'net' }; } finally { salBusy = false; }
  }
  // انفتح اشتراكه (برقم الطلب أو لحاله): جلسة المشترك بدل جلسة الزائر + صفحة «تم الاشتراك» مرة وحدة
  function sallaWin(r) {
    sallaDone();
    if (r.auth) { auth = authFrom(r.auth); lsSet(LS.auth, auth); P = null; cryptoKey = null; Object.keys(cache).forEach(k => delete cache[k]); }   // مفتاح الدورة الكامل بدل مفتاح الزائر
    document.querySelectorAll('.subdlg').forEach(x => x.remove());
    PAID_OK = { until: r.until || 0, months: r.months || 1 };
    if (location.hash === '#paid') renderPaid(); else location.hash = 'paid';
  }
  // ⏳ فاتح صفحة سلة: نتحقق كل 5 ثواني أول 5 دقايق، وبعدها كل 20 ثانية — ولما يرجع للتبويب نتحقق على طول
  { let tick = 0; setInterval(() => { const t = sallaPending(); if (!t || document.hidden || !auth || auth.role !== 'free') return; tick++; if (Date.now() - t < 300e3 || tick % 4 === 0) sallaPoll(); }, 5000);
    const back = () => { if (!document.hidden && sallaPending() && auth && auth.role === 'free') sallaPoll(); };
    document.addEventListener('visibilitychange', back); window.addEventListener('focus', back); }
  // 💳 «ادفع واشترك»: الخادم ينشئ العملية عند تاب ويرجّع رابط صفحة الدفع (مدى، أبل باي، البطاقات) — بيانات البطاقة ما تمر علينا
  async function payGo(btn) {
    if (!btn || btn.disabled) return; btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = _T('⏳ نجهّز صفحة الدفع…');
    if (window.QGT) { QGT.ev('subgo', 'دفع'); QGT.flush(true); }
    try {
      const r = await api({ op: 'pay_start', session: auth.session, lang: EN ? 'en' : 'ar' });
      if (r && r.ok && r.url) { location.href = r.url; return; }
      if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
      toast((r && r.msg) || _T('تعذّر فتح صفحة الدفع، حاول بعد شوي.'));
    } catch (e) { toast(_T('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.')); }
    btn.disabled = false; btn.innerHTML = label;
  }
  // 💳 الرجوع من صفحة الدفع (#paid): نتحقق من العملية عند تاب — لو انخصمت تنفتح الدورة على طول بجلسة المشترك الجديدة
  let PAID_OK = null;   // 🛍 دفع سلة تفعّل: صفحة «تم الاشتراك» تطلع مرة وحدة
  function paidOk(show, until, months) {
    const end = until ? new Date(until).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }) : '';
    show('🎉', 'ok', _T`<h2>تم الاشتراك بنجاح</h2><p>الدورة كاملة مفتوحة لك الحين: كل الأقسام والنماذج بالشرح، والاختبارات المحاكية، والمذكرات.</p>${end ? (months > 1 ? _T`<p class="pdend">اشتراكك مفعّل وينتهي <b>${end}</b></p>` : _T`<p class="pdend">اشتراكك لمدة شهر وينتهي <b>${end}</b></p>`) : ''}
      <div class="pdact"><a class="btn gold" href="#">ابدأ المذاكرة</a></div>`);
    confetti(); if (window.QGT) QGT.ev('paid', 'تم الدفع');
  }
  async function renderPaid() {
    document.title = _T('الاشتراك في الدورة | Q-Guide');
    const show = (ic, cls, body) => {
      app.innerHTML = topbar(_T`<span class="ttl">💳 الاشتراك في الدورة</span><span class="sp"></span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
        `<main class="wrap paid"><div class="pdcard ${cls}" role="status" aria-live="polite"><div class="pdic" aria-hidden="true">${ic}</div>${body}</div></main>`;
      bindCtl();
    };
    if (PAID_OK) { const K = PAID_OK; PAID_OK = null; return paidOk(show, K.until, K.months); }
    const id = payPending(); if (!id) { location.hash = ''; return; }
    const wa = 'https://wa.me/966508003683?text=' + encodeURIComponent(_T('السلام عليكم، دفعت في موقع Q-Guide وعندي استفسار') + '\n' + (auth.email || '') + '\n' + id);
    show('<div class="spin"></div>', 'wait', _T('<h2>نتحقق من عملية الدفع…</h2><p>لا تسكّر الصفحة، ثواني بس.</p>'));
    let r = null;
    for (let i = 0; i < 8; i++) {   // تاب أحياناً يتأخر ثواني قبل ما تتأكد العملية
      try { r = await api({ op: 'pay_check', session: auth.session, tap_id: id, ua: navigator.userAgent.slice(0, 120) }); } catch (e) { r = { ok: false, error: 'net' }; }
      if (location.hash !== '#paid') return;
      if (!(r && r.ok && r.pending)) break;
      await new Promise(res => setTimeout(res, 3000));
    }
    if (location.hash !== '#paid') return;
    if (r && !r.ok && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));   // بعد الدخول نرجع هنا ونكمل
    if (r && r.ok && r.paid) {
      payDone(); if (r.auth) { auth = authFrom(r.auth); lsSet(LS.auth, auth); P = null; cryptoKey = null; Object.keys(cache).forEach(k => delete cache[k]); }   // مفتاح الدورة الكامل بدل مفتاح الزائر
      return paidOk(show, r.until, 1);
    }
    if (r && r.ok && r.failed) {
      payDone();
      show('✕', 'bad', _T`<h2>ما تمّت عملية الدفع</h2><p>${r.msg ? esc(r.msg) : _T('ما انخصم أي مبلغ من حسابك. تقدر تحاول مرة ثانية أو تستخدم بطاقة ثانية.')}</p>
        <div class="pdact">${payOn() ? _T('<button type="button" class="btn gold" id="pdretry">حاول مرة ثانية</button>') : ''}<a class="btn ghost" href="${wa}" target="_blank" rel="noopener">راسلنا على واتساب</a></div>`);
      const rb = $('#pdretry'); if (rb) rb.onclick = () => payGo(rb);
      return;
    }
    const pend = r && r.ok && r.pending, retry = pend || !r || r.error === 'net' || r.error === 'tap';   // ما وصلنا جواب نهائي: نخليه يتحقق مرة ثانية
    if (!retry) payDone();
    show(pend ? '⏳' : '!', 'wait', (pend ? _T('<h2>الدفع للحين قيد المعالجة</h2><p>لو انخصم المبلغ، اشتراكك يتفعّل تلقائياً خلال دقائق.</p>') : `<h2>${_T('تعذّر التحقق من الدفع')}</h2><p>${esc((r && r.msg) || _T('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.'))}</p>`) +
      _T`<div class="pdact">${retry ? _T('<button type="button" class="btn gold" id="pdagain">تحقق مرة ثانية</button>') : _T('<a class="btn gold" href="#">الرئيسية</a>')}<a class="btn ghost" href="${wa}" target="_blank" rel="noopener">راسلنا على واتساب</a></div>`);
    const ag = $('#pdagain'); if (ag) ag.onclick = () => renderPaid();
  }
  // أي زر فيه data-lock أو data-sub يفتح نافذة الاشتراك
  function bindSub(root) { (root || document).querySelectorAll('[data-lock],[data-sub]').forEach(b => b.onclick = e => { e.preventDefault(); const w = b.dataset.lock || ''; if (w && isFree() && window.QGT) QGT.ev('lock', w); subDlg(w && _T(w)); }); }   // 🌐 اسم المقفول بالإنجليزي لو له ترجمة
  const lockTool = (i, b, s) => _T`<button type="button" class="tool lk" data-lock="${esc(b)}"><span class="ti">${i}</span><span class="tx"><b>${b}<span class="lkb">🔒 للمشتركين</span></b><small>${s}</small></span></button>`;
  function freeHero() {
    const lv = lsGet(LVL_LS, null);
    return _T`<section class="fhero" aria-label="الحساب المجاني">
      <div class="fh-t">${auth.ended ? _T`<h2>⛔ انتهى اشتراكك في الدورة</h2><p>حسابك الحين مجاني: تقدر تحل القسم 1 والنموذج 1 والاختبار المحاكي 1، وتلعب ${FREE_GAMES} مباريات كل يوم في الساحة 1v1. جدّد اشتراكك وترجع لك الدورة كاملة.</p>` : _T`<h2>أنت على الحساب المجاني</h2><p>جرّب القسم 1 والنموذج 1 والاختبار المحاكي 1 وتحديد المستوى، والعب ${FREE_GAMES} مباريات كل يوم في الساحة 1v1. اشترك وتنفتح لك الدورة كاملة.</p>`}</div>
      <div class="fh-a"><button type="button" class="btn gold" data-sub>${auth.ended ? _T('جدّد اشتراكك') : _T('اشترك في الدورة')} <small>${PRICE} ريال</small></button>${lv ? '' : _T('<a class="btn ghost" href="#level">🧭 اعرف مستواك أول</a>')}</div>
    </section>`;
  }

  // ---------- routing ----------
  function route() {
    auth = lsGet(LS.auth, null);
    if (auth && auth.exp && auth.exp < Date.now()) { auth = null; lsDel(LS.auth); }
    if (!auth) { if (window.QGAI) QGAI.fab(false); return renderLogin(); }
    document.body.classList.remove('rec-on'); document.querySelectorAll('.confetti').forEach(c => c.remove()); if (window.__stKey) { document.removeEventListener('keydown', window.__stKey); window.__stKey = null; }
    if (window.__stPen) { try { window.__stPen.destroy(); } catch (e) {} window.__stPen = null; }
    heartbeat(); vidStop(); document.onkeydown = null; if (LV && LV.tm) { clearInterval(LV.tm); LV.tm = 0; }
    document.querySelectorAll('body > .modal').forEach(m => m.remove());   // النوافذ (بطاقة الطالب…) تتسكّر مع الانتقال لصفحة ثانية
    if (skillsT) { clearTimeout(skillsT); skillsT = 0; skillsPush(); }   // ادفع سجل المهارات قبل الانتقال
    const h = location.hash.replace('#', '');
    if (h === 'qall' || h === 'vall' || (!RULES_ON && /^rules(-v)?(\/|$)/.test(h))) { history.replaceState(null, '', location.pathname); return route(); }   // 🗑 الاختبار الشامل وملخص القوانين/القواعد انشالوا: الروابط القديمة ترجع للرئيسية
    if (EN) { const adm = /^(admin|studio|cards)/.test(h), H = document.documentElement;   // 🌐 صفحات المشرفين تبقى عربي (يمين ← يسار) حتى لو الواجهة إنجليزي
      H.dir = adm ? 'rtl' : 'ltr'; H.lang = adm ? 'ar' : 'en'; H.classList.toggle('l-en', !adm); H.classList.toggle('l-ar', adm); }
    if (h !== 'arena' && !/^duel-/.test(h)) arLeave();
    if (window.QGAI) QGAI.fab(helpOn(isFree() && !freeRoute(h) ? '' : h));   // 🙋 زر «تحتاج مساعدة؟»
    if (isFree() && !freeRoute(h)) { const nm = lockName(h); if (h !== 'sub' && window.QGT) QGT.ev('lock', nm || h); history.replaceState(null, '', location.pathname); renderHome(); return subDlg(nm, h === 'sub' ? _T('الاختبارات المحاكية') : ''); }   // 🔒 للمشتركين
    if (isFree() && window.QGT) QGT.page(h === '' ? 'home' : /^duel-/.test(h) ? 'duel' : h.replace(/@\d+$/, ''));   // 👀 وش فتح الزائر
    if (h === 'paid') return renderPaid();
    if (h === 'arena') return renderArena();
    if (/^duel-[A-Za-z0-9]{6}$/.test(h)) return renderArena(h.slice(5).toUpperCase());
    if (h === 'board-arena') return renderBoard('arena');
    if (/^[qv]\d+$/.test(h)) return renderPlayer(h);
    if (/^[qv]\d+@\d+$/.test(h)) { const [sid, si] = h.split('@'); return renderPlayer(sid, +si); }
    if (h === 'notes') return renderNotes();
    if (h === 'badges') return renderBadges();
    if (h === 'level') return renderLevel();
    if (/^rules(-v)?(\/[a-z-]+)?$/.test(h)) return renderRules(/^rules-v/.test(h) ? 'v' : 'q', (h.split('/')[1] || ''));   // #rules/circles = افتح على موضوع
    if (h === 'find') return renderFind();
    if (h === 'cards') { if (auth.role === 'admin') return renderCards(); location.hash = ''; return; }
    if (/^wb-[qv]s?$/.test(h)) return renderWorkbook(h[3], h.length === 5);
    if (/^wb-t[qv](@\d{1,3})?$/.test(h)) return renderWorkbook(h.slice(3, 5), false, +(h.split('@')[1] || 0));   // 🧱 مذكرات التأسيس (قواعد الكمي/اللفظي)
    if (/^watch-([qv]|af|at|sf)(\d{1,2}|-rules)$/.test(h)) return renderWatch(h.slice(6));   // -rules = رابط مقطع القواعد القديم (انشال) → صفحة المدرسين · af/at = تأسيس وتدريب عبدالله الشمراني · sf = تأسيس سلمان الفرج
    if (h === 'me') return renderProfile();   // 👤 ملفي
    if (h === 'sharh') return renderSharh();
    const tm = /^sharh-(salman|abdullah)(?:\/([ft]))?$/.exec(h); if (tm) return renderTeach(tm[1], tm[2]);   // 👨‍🏫 صفحة المدرس: /f التأسيس · /t التدريب
    if (h === 'board' || h === 'board-week' || h === 'board-month' || h === 'board-exam') return renderBoard(h === 'board-exam' ? 'exam' : 'week');   // 🏆 الافتراضي: هذا الأسبوع
    if (/^board-set-[qv]\d{1,2}$/.test(h)) return renderBoard('set:' + h.slice(10));
    if (h === 'plan') return renderPlan();
    if (/^t-[a-z-]+$/.test(h)) return renderPlayer(h);
    if (h === 'skills') return renderSkills();
    if (/^vocab(-v\d{1,2})?$/.test(h)) return renderVocab(h.length > 5 ? h.slice(6) : '');
    if (h === 'studio' || /^studio-[qv]-\d{1,3}$/.test(h)) { if (auth.role === 'admin') return h === 'studio' ? renderStudio() : renderRec(h[7], +h.slice(9)); location.hash = ''; return; }
    if (/^admin-report\//.test(h)) { if (auth.role === 'admin') return renderReport(decodeURIComponent(h.slice(13))); location.hash = ''; return; }   // 📊 التقرير الشامل (المالك)
    if (h === 'admin-adv') { if (auth.role === 'admin') return renderAdv(); location.hash = ''; return; }   // 🧑‍🏫 المرشدين / طلابي
    if (h === 'my-vids') { if (auth.role === 'admin' && auth.teach) return renderMyVids(); location.hash = ''; return; }   // 🎬 المدرس يرفع مقاطعه
    if (h === 'admin' || h === 'admin-staff' || h === 'admin-members' || h === 'admin-subs' || h === 'admin-regs' || h === 'admin-free' || h === 'admin-ai' || h === 'admin-find') { if (auth.role === 'admin') return h === 'admin' ? renderAdmin() : h === 'admin-staff' ? renderStaff() : h === 'admin-free' ? renderFreeUsers() : h === 'admin-ai' ? renderAiAdmin() : h === 'admin-find' ? renderFindLog() : h === 'admin-subs' ? renderSubs() : h === 'admin-regs' ? renderRegs() : renderMembers(); location.hash = ''; return; }
    renderHome();
  }
  window.addEventListener('hashchange', route);

  // رمز الدخول القادم من وضع إعادة التوجيه (#gsi=...) — التطبيق المضاف للشاشة الرئيسية (standalone) يدخل بهذا الوضع.
  // رابط الرجوع واحد: <API>/gsi ولازم يكون مسجّل في Google Cloud (OAuth client → Authorized redirect URIs)، وإلا يطلع للطالب redirect_uri_mismatch.
  // Google يرجّعه دايماً لـ /p/؛ صفحة الاختبارات المحاكية تحفظ qg_gsi_to قبل الدخول فنرجّعه لها بعده (gsiBack)
  function gsiBack() { const v = lsGet('qg_gsi_to', null); lsDel('qg_gsi_to'); return v && v.to === '/test/' && Date.now() - (v.t || 0) < 20 * 60e3 ? '/test/' : ''; }
  function gsiFromHash() {
    const m = location.hash.match(/[#&]gsi=([^&]+)/); if (!m) { if (/gsierr=1/.test(location.hash)) { history.replaceState(null, '', location.pathname); renderLogin(_T('تعذّر إكمال تسجيل الدخول، حاول مرة أخرى.')); return true; } return false; }
    const cred = decodeURIComponent(m[1]), back = gsiBack(); history.replaceState(null, '', location.pathname);   // نقرأ الحفظ قبل renderLogin (اللي يمسحه)
    renderLogin(); onCredential({ credential: cred, back }); return true;
  }
  // ---------- login ----------
  function renderLogin(err, good) {
    document.title = _T('تسجيل الدخول | Q-Guide');
    const mem = /[?&]m=1(&|$)/.test(location.search);   // جا من «دخول المشتركين» في الصفحة الرئيسية: صفحة دخول للمشترك بدون «جرّب مجاناً»
    app.innerHTML = _T`<div class="login"><div class="card">${QGL.btn('lng lgl')}
      <img src="/assets/logo.png" alt="Q-Guide">
      <h1>${mem ? _T('دخول المشتركين') : _T('منصة تدريب Q-Guide')}</h1>
      <p class="sub">${mem ? _T('سجّل بنفس إيميل Google اللي اشتركت فيه، وتنفتح لك الدورة كاملة.') : _T('أسئلة القدرات الإنجليزي — الكمي واللفظي — مع الشرح')}</p>
      <div class="gbtn" id="gbtn"><div class="spin"></div></div>
      ${err ? `<div class="${good ? 'okm' : 'err'}">${err}</div>` : ''}
      ${mem ? '' : _T('<div class="lg-free"><b>جرّب مجاناً بحساب Google</b><ul><li>القسم 1 كمي</li><li>النموذج 1 لفظي</li><li>الاختبار المحاكي 1</li><li>تحديد المستوى</li><li>الساحة 1v1</li></ul></div>')}
      <p class="note">${mem ? '' : _T('مشترك في الدورة؟ سجّل بنفس إيميل Google اللي اشتركت فيه وتنفتح لك الدورة كاملة.<br>')}الحساب يعمل على <b>جهاز واحد</b> في الوقت نفسه.</p>
      ${mem ? _T('<p class="note" style="margin-top:6px"><a href="/p/">مو مشترك؟ جرّب مجاناً</a></p>') : ''}
      <p class="note" style="margin-top:10px"><a class="btn sm ghost" style="gap:6px" href="https://wa.me/966508003683?text=${encodeURIComponent(_T('السلام عليكم، أحتاج مساعدة في الدخول لمنصة Q-Guide'))}" target="_blank" rel="noopener">💬 دعم فني عبر واتساب</a></p>
      <p class="note" style="margin-top:8px"><a href="/privacy/">سياسة الخصوصية</a> · <a href="/terms/">الشروط</a></p>
    </div></div>`;
    mountGoogle();
  }
  let gTries = 0;
  function mountGoogle() {
    const host = $('#gbtn'); if (!host) return;
    if (!(window.google && google.accounts && google.accounts.id)) { if (gTries++ < 60) return setTimeout(mountGoogle, 150); host.innerHTML = _T('<span style="color:var(--bad)">تعذّر تحميل تسجيل الدخول، حدّث الصفحة.</span>'); return; }
    try {
      if (window.QG.GSI_REDIRECT) lsDel('qg_gsi_to');   // الدخول من هنا نفسها: بعد الرجوع من Google يبقى في /p/
      google.accounts.id.initialize(Object.assign({ client_id: window.QG.CLIENT_ID, callback: onCredential, auto_select: false, itp_support: true }, window.QG.GSI_REDIRECT ? { ux_mode: 'redirect', login_uri: window.QG.API.replace(/\/$/, '') + '/gsi' } : { ux_mode: 'popup' }));
      host.innerHTML = '';
      google.accounts.id.renderButton(host, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: EN ? 'en' : 'ar', width: 280 });
    } catch (e) { host.innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>'; }
  }
  const authFrom = r => ({ name: r.name, email: r.email, phone: r.phone || '', key: r.key, exp: r.exp, session: r.session, gender: r.gender || '', role: r.role || 'student', staff: r.staff || '', files: r.files || null, member: r.member || '', display: r.display || r.name, avatar: r.avatar || '', sub: r.sub || '', yt: r.yt || null, vids: r.vids || [], ended: r.ended ? 1 : 0, pay: r.pay || null, salla: r.salla || null, adv: r.adv || '', teach: r.teach || '' });
  async function onCredential(resp) {
    const host = $('#gbtn'); if (host) host.innerHTML = _T('<div class="spin"></div><span style="margin-inline-start:10px;color:var(--mut)">جارٍ تسجيل الدخول…</span>');
    try {
      const r = await api({ op: 'login', idToken: resp.credential, ua: navigator.userAgent.slice(0, 120) });
      if (!r.ok) {
        const msg = r.msg || (r.error === 'not_member' ? _T('هذا الحساب غير مسجّل في الدورة.') : _T('تعذّر تسجيل الدخول (') + esc(r.error || '') + ').');
        return renderLogin(esc(msg) + _T('<br><a href="https://wa.me/966508003683" target="_blank" rel="noopener">تواصل معنا على واتساب 0508003683</a>'));
      }
      auth = authFrom(r);
      lsSet(LS.auth, auth);
      if (resp.back && !payPending()) return location.replace(resp.back);   // دخل من صفحة الاختبارات المحاكية: نرجّعه لها
      location.hash = payPending() ? 'paid' : ''; route();   // 💳 رجع من صفحة الدفع وجلسته منتهية: نكمل التحقق بعد الدخول
    } catch (e) { renderLogin(_T('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.')); }
  }

  // ---------- home ----------
  function topbar(inner, left) {
    if (EN && left) left = left.replace(/>→<\/a>/g, '>←</a>');   // 🌐 زر الرجوع يأشر لليسار بالإنجليزي
    return `<header class="top"><div class="w">${left || `<a class="brand" href="#"><img src="/assets/logo.png" alt="">Q-Guide</a>`}${ctlHtml()}${inner || ''}</div></header>`;
  }
  // ---------- home: ورقة الإجابة ----------
  const SET_NAME = id => id === 'v15' ? _T('الأسئلة الجديدة') : (id[0] === 'q' ? _T('القسم ') : _T('النموذج ')) + id.slice(1);
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
  const dLabel = n => EN ? enN(n, 'day', 'days') : n === 1 ? 'يوم واحد' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم';   // i18n:skip
  function rzHtml() {
    const first = firstName(auth.display || auth.name);
    const R = pickResume(), rs = R.s, st = R.st;
    const D = daysGet(), streak = streakOf(D), today = D[dayKey()] || 0, goal = goalGet();
    const wk = []; for (let k = 6; k >= 0; k--) { const t = new Date(); t.setDate(t.getDate() - k); wk.push({ l: _T('حنثرخجس')[t.getDay()], n: D[dayKey(t)] || 0, today: k === 0 }); }
    const nm = SET_NAME(rs.id) + (rs.id[0] === 'v' ? ` <bdi class="rz-mn">${esc(rs.sub)}</bdi>` : '');
    let kick, title, sub, cta, href = '#' + rs.id, cur = st.gap;
    if (R.mode === 'cont') { kick = _T('كمّل من حيث وقفت'); title = nm; sub = _T`السؤال ${st.gap + 1} من ${st.n}`; cta = _T('كمّل الحل'); }
    else if (R.mode === 'next') { kick = _T`خلّصت ${SET_NAME(R.prev.s.id)}${R.prev.st.best != null ? _T(' بنسبة ') + R.prev.st.best + '%' : ''} 👏`; title = _T('التالي: ') + nm; sub = _T`${st.n} سؤال، وكل سؤال معه شرحه`; cta = _T('ابدأ ') + SET_NAME(rs.id); }
    else if (R.mode === 'new') { kick = _T('جاهز تبدأ؟'); title = nm; sub = lsGet(LVL_LS, null) ? _T`${st.n} سؤال، وكل سؤال معه شرحه` : _T`${st.n} سؤال، وكل سؤال معه شرحه · أو <a class="rz-alt" href="#level">ابدأ باختبار تحديد المستوى 🧭</a>`; cta = _T('ابدأ ') + SET_NAME(rs.id); cur = 0; }
    else { kick = _T('خلّصت كل الأقسام 🎉'); title = _T('راجع الأسئلة اللي غلطت فيها'); sub = _T('التدريب على أخطائك يثبّت المعلومة قبل الاختبار'); cta = _T('مراجعة أخطائي'); href = '#skills'; cur = -1; }
    const C = 2 * Math.PI * 20, dash = Math.min(1, today / goal) * C, met = today >= goal;
    return _T`<section class="rz" aria-label="متابعة المذاكرة">
      <div class="rz-top"><h1 class="rz-hi">أهلاً ${esc(first)} 👋</h1>
        <div class="rz-streak" title="الأيام اللي حليت فيها أسئلة"><span class="rz-r1"><span class="rz-fire ${streak ? '' : 'off'}">🔥 ${streak ? dLabel(streak) + _T(' ورا بعض') : _T('ابدأ سلسلتك اليوم')}</span><a class="rz-bdg" href="#badges" title="إنجازاتي: الشارات اللي حصلت عليها">🏅 ${BADGES.filter(b => lsGet(BADGE_LS, {})[b.id]).length}<small>/${BADGES.length}</small></a></span>
          <span class="rz-week">${wk.map(d => _T`<i class="${d.n ? 'on' : ''}${d.today ? ' t' : ''}" title="${EN ? enN(d.n, 'question', 'questions') : d.n + ' سؤال'}"><b>${d.l}</b></i>`).join('')}</span></div></div>
      <div class="rz-body">
        <div class="rz-what"><span class="rz-k">${kick}</span><b class="rz-set">${title}</b><span class="rz-sub">${sub}</span></div>
        <div class="rz-dots" aria-hidden="true" style="--c:${cols(st.n, 30)};--cm:${cols(st.n, 17)}">${R.mode === 'alldone' ? '' : dotsHtml(rs.id, st.n, cur)}</div>
        <div class="rz-act"><a class="rz-go" href="${href}"><span class="pl">▶</span>${cta}</a>
          <button class="rz-goal ${met ? 'met' : ''} ${today ? '' : 'zero'}" id="goal" title="اضغط لتغيير هدفك اليومي"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" class="bg"/><circle cx="24" cy="24" r="20" class="fg" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/></svg>
            <span class="gt"><b>${met ? '✓ ' : ''}${today}<small> من ${goal}</small></b><small>${met ? _T('حققت هدف اليوم') : _T('هدف اليوم')}</small></span></button></div>
      </div></section>`;
  }
  // 🎯 «ركّز اليوم»: أضعف مهارة من سجل إجاباتك مع تدريب مباشر عليها، وزر المساعد — أو اختبار تحديد المستوى لو ما فيه بيانات بعد
  function focusHtml() {
    const P = helpProfile(), w = P.weak && P.weak[0], FR = isFree(), nW = (() => { try { const h = histGet(); let n = 0; for (const s in h.items) for (const i in h.items[s]) if (!h.items[s][i][2]) n++; return n; } catch (e) { return 0; } })();
    const ask = _T`<button type="button" class="btn sm ghost fx-ask" id="fxask"><span class="fx-sp" aria-hidden="true">✦</span>اسأل المساعد</button>`;
    if (w) {
      const drill = FR ? _T`<button type="button" class="btn sm" data-lock="التدريب على نقاط ضعفك">${w.i} تدريب ${esc(w.t)}</button>` : `<a class="btn sm" href="#t-${w.k}">${w.i} ${_T('تدريب')} ${esc(w.t)}</a>`;
      const wrong = nW >= 3 && !FR ? _T`<a class="btn sm ghost" href="#t-wrong-${TOPICS[w.k].k === 'verbal' ? 'v' : 'q'}">🔁 أعد حل أخطائك <small>${nW}</small></a>` : '';
      return _T`<section class="focus" aria-label="ركّز اليوم"><span class="fx-i" aria-hidden="true">🎯</span><div class="fx-t"><b>ركّز اليوم على ${esc(w.t)}</b><span>دقتك فيها ${w.p}% — أضعف مهاراتك الحين${P.weak[1] ? _T`، وبعدها ${esc(P.weak[1].t)} ${P.weak[1].p}%` : ''}</span></div><div class="fx-a">${drill}${wrong}${ask}</div></section>`;
    }
    return _T`<section class="focus" aria-label="ركّز اليوم"><span class="fx-i" aria-hidden="true">🧭</span><div class="fx-t"><b>اعرف وين تركّز</b><span>حل كم سؤال أو اختبار تحديد المستوى، ونقولك أضعف مهاراتك ونتدرّب عليها</span></div><div class="fx-a"><a class="btn sm" href="#level">🧭 تحديد المستوى</a>${ask}</div></section>`;
  }
  let homePulled = false;
  async function renderHome() {
    document.title = _T('منصة التدريب | Q-Guide');
    if (!manifest) { try { manifest = await (await fetch('/p/data/manifest.json')).json(); } catch (e) { app.innerHTML = _T('<div class="center">تعذّر تحميل البيانات. حدّث الصفحة.</div>'); return; } }
    const tab = lsGet(LS.tab, 'quant') === 'verbal' ? 'verbal' : 'quant';
    const adminLinks = auth.role === 'admin' ? (auth.teach ? _T`<a class="tn" href="#my-vids" title="مقاطعي: ارفعها للموقع"><span class="i">🎬</span><span class="l">مقاطعي</span></a>` : '') + (auth.adv ? _T`<a class="tn" href="#admin-adv" title="طلابي: كلّمهم بالواتس"><span class="i">💬</span><span class="l">طلابي</span></a>` : '') + _T`<a class="tn gold" href="#admin" title="لوحة الإدارة: الطلاب والمشرفون"><span class="i">👑</span><span class="l">الإدارة</span></a>` : '';
    if (!isFree()) badgeCheck();
    const pst = planState(), pl = PLANS.find(p => p.id === pst.id), lv = lsGet(LVL_LS, null), nMarks = marksList().length, isStaff = auth.role === 'admin';
    const FR = isFree();   // 🆓 الزائر يشوف كل الأدوات، والمقفل عليه قفل ويفتح نافذة الاشتراك
    const toolA = (href, i, b, s, tag, free) => FR && !free ? lockTool(i, b, s) : `<a class="tool" href="${href}"><span class="ti">${i}</span><span class="tx"><b>${b}${tag || ''}</b><small>${s}</small></span></a>`;
    const toolB = (id, i, b, s) => FR ? lockTool(i, b, s) : `<button type="button" class="tool" id="${id}"><span class="ti">${i}</span><span class="tx"><b>${b}</b><small id="${id}l">${s}</small></span></button>`;
    app.innerHTML = topbar(_T`<span class="sp"></span><nav class="tnav"><a class="tn ar" href="#arena" title="الساحة 1v1: تحدَّ طالب مباشرة"><span class="i">⚔️</span><span class="l">الساحة</span></a>${isFree() ? _T('<button type="button" class="tn subn" data-sub title="اشترك في الدورة"><span class="i">⭐</span><span class="l">اشترك</span></button>') : _T('<a class="tn" href="#board" title="لوحة الصدارة"><span class="i">🏆</span><span class="l">الصدارة</span></a><a class="tn" href="#skills" title="نقاط القوة والضعف"><span class="i">🎯</span><span class="l">مهاراتي</span></a>')}${adminLinks}</nav><button class="chip me" id="me" title="ملفي: اشتراكك واسمك وصورتك">${avatarHtml(auth.avatar, auth.display || auth.name, 26)}<span>${esc(auth.display || auth.name || auth.email)}</span></button><button class="ib lo" id="lo" title="تسجيل الخروج" aria-label="تسجيل الخروج">${LOSVG}</button>`) +
    _T`<main class="wrap home">
      ${FR ? freeHero() : ''}<div id="rz">${rzHtml()}</div>
      ${FR ? '' : '<div id="trip"></div>'}<div id="focus">${focusHtml()}</div>
      <div class="hrow"><div class="tabs" role="tablist"><button role="tab" data-t="quant" class="${tab === 'quant' ? 'on' : ''}" aria-selected="${tab === 'quant'}">📐 الكمي <small>14 قسم</small></button><button role="tab" data-t="verbal" class="${tab === 'verbal' ? 'on' : ''}" aria-selected="${tab === 'verbal'}">📖 اللفظي <small>14 نموذج</small></button></div>
        <span class="sp"></span><a class="rvid rl" href="#sharh"><span class="i">👨‍🏫</span><span>الشرح والمدرسين</span></a>${!RULES_ON ? '' : tab === 'quant' ? _T('<a class="rvid rl" href="#rules"><span class="i">📐</span><span>ملخص القوانين</span></a>') : _T('<a class="rvid rl" href="#rules-v"><span class="i">📘</span><span>ملخص القواعد</span></a>')}</div>
      <div class="sheets" id="grid"></div>
      <h2 class="h2">أدوات المذاكرة</h2>
      <section class="tgroups">
        <div class="tg"><h3>اختبر نفسك</h3>
          ${toolA('#level', '🧭', _T('تحديد المستوى'), lv ? _T`مستواك: ${LEVELS[lv.lvl].t} (${lv.pct}%) · تقدر تعيده` : _T('20 سؤال تعرف منها مستواك ونقاط ضعفك'), FR ? _T('<span class="frb">مجاني</span>') : '', 1)}
          ${toolA('#arena', '⚔️', _T('الساحة 1v1'), FR ? _T`تحدَّ طالب مباشرة، ${FREE_GAMES} مباريات مجانية كل يوم` : _T('تحدَّ طالب مباشرة في 20 سؤال كمي ولفظي'), FR ? _T('<span class="frb">مجاني</span>') : _T('<span class="beta">جديد</span>'), 1)}
          ${toolA('/test/', '🧪', _T('الاختبارات المحاكية'), FR ? _T('الاختبار المحاكي 1 مجاني، والـ 16 الباقية للمشتركين') : _T('17 اختبار بنفس شكل قياس المحوسب'), FR ? _T('<span class="frb">1 مجاني</span>') : '', 1)}</div>
        <div class="tg"><h3>تعلّم وراجع</h3>
          ${toolA('#find', '🔎', _T('ابحث عن سؤال'), FR ? _T('اكتب السؤال أو صوّره ونقولك إذا هو في الدورة ووين') : _T('اكتب السؤال أو صوّره ونقولك وين تلقاه'), FR ? _T('<span class="frb">مجاني</span>') : _T('<span class="beta">جديد</span>'), 1)}
          ${RULES_ON ? toolA('#rules', '📐', _T('قوانين الكمي'), _T('القوانين اللي تحتاجها أسئلة الدورة، وتنطبع')) + toolA('#rules-v', '📘', _T('قواعد اللفظي'), _T('طرق الحل وأنواع الأسئلة في صفحة وحدة'), FR ? '' : _T('<span class="beta">جديد</span>')) : ''}
          ${toolA('#vocab', '📖', _T('قاموس الكلمات'), _T('ترجمة ونطق كل كلمات اللفظي'))}
          ${toolA('#notes', '📒', _T('دفتري'), nMarks ? (EN ? enN(nMarks, 'saved question', 'saved questions') + ' with your notes' : _T`${nMarks} سؤال محفوظ مع ملاحظاتك`) : _T('الأسئلة اللي تحفظها ⭐ وملاحظاتك عليها'))}
          ${isStaff ? toolA('#cards', '🃏', _T('بطاقات الحفظ'), _T('احفظ كلمات اللفظي بالبطاقات'), _T('<span class="beta">تجريبي</span>')) : ''}</div>
        <div class="tg"><h3>تابع تقدّمك</h3>
          ${toolA('#plan', '📅', _T('خطة المذاكرة'), pl ? _T('أنت على ') + pl.name : _T('اختر خطة 7 أو 14 أو 19 أو 28 يوم'))}
          ${toolB('rem', '🔔', _T('التذكير اليومي'), remLabel())}
          ${toolA('#skills', '🎯', _T('نقاط قوتك وضعفك'), _T('اعرف وش تغلط فيه وتدرّب عليه'))}
          ${toolA('#badges', '🏅', _T('إنجازاتي'), _T`${BADGES.filter(b => lsGet(BADGE_LS, {})[b.id]).length} من ${BADGES.length} شارة`)}
          ${toolA('#board', '🏆', _T('لوحة الصدارة'), _T('ترتيبك بين طلاب الدورة'))}</div>
      </section>
      ${FR ? '' : _T`<h2 class="h2" id="wbh">📘 مذكراتك</h2>
      <div class="wb" id="wb"><div class="mut">جارٍ تحميل مذكراتك…</div></div>`}
    </main>`;
    $('#lo').onclick = async () => { if (await QGDlg.confirm(_T('تسجيل الخروج؟'), { ok: _T('خروج') })) logout('', true); };
    $('#me').onclick = () => { location.hash = 'me'; };
    bindCtl();
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { lsSet(LS.tab, b.dataset.t); renderHome(); });
    const grid = $('#grid');
    grid.innerHTML = manifest[tab].map(s => {
      const st = setState(s.id, s.n); const sub = tab === 'quant' ? _T`الأسئلة <bdi dir="ltr">${esc(s.range)}</bdi>` : `<bdi dir="ltr">${esc(s.sub)}</bdi>`;
      const stamp = st.done ? _T`<span class="stamp" title="أفضل نتيجة">✓ ${st.best != null ? st.best + '%' : ''}</span>` : st.ans ? `<span class="pill">${st.ans}/${s.n}</span>` : '';
      const foot = st.done ? (st.best != null ? _T`أفضل نتيجة ${st.best}%` : _T('جاوبت كل الأسئلة')) : st.ans ? _T`أجبت ${st.ans} من ${s.n}، منها ${st.ok} صح` : (st.best != null ? _T`أفضل نتيجة ${st.best}%` : _T`${s.n} سؤال`);
      if (isFree() && FREE_SETS.indexOf(s.id) < 0) return _T`<button class="sheet lk" data-id="${s.id}"><span class="sh-h"><b>${SET_NAME(s.id)}</b><span class="lkb">🔒</span></span><span class="sh-s">${sub}</span><span class="sh-lk">${s.n} سؤال مع الشرح للمشتركين</span></button>`;
      return `<button class="sheet ${st.done ? 'done' : st.ans ? 'doing' : ''}${isFree() ? ' fr' : ''}" data-id="${s.id}"><span class="sh-h"><b>${SET_NAME(s.id)}</b>${stamp}</span><span class="sh-s">${sub}</span><span class="sh-dots" aria-hidden="true" style="--c:${cols(s.n, 16)};--cm:${cols(s.n, 12)}">${dotsHtml(s.id, s.n, -1)}</span><span class="sh-f">${foot}</span></button>`;
    }).join('');
    grid.querySelectorAll('.sheet').forEach(b => b.onclick = () => { if (b.classList.contains('lk')) { if (window.QGT) QGT.ev('lock', SET_NAME(b.dataset.id)); return subDlg(SET_NAME(b.dataset.id)); } location.hash = b.dataset.id; });
    bindSub(app);
    const bindGoal = () => { const g = $('#goal'); if (g) g.onclick = () => { const cur = goalGet(); const nx = GOALS[(GOALS.indexOf(cur) + 1) % GOALS.length]; lsSet(GOAL_LS, nx); $('#rz').innerHTML = rzHtml(); bindGoal(); toast(_T('هدفك اليومي صار ') + nx + _T(' سؤال')); }; };
    bindGoal();
    const rb = $('#rem'); if (rb) rb.onclick = () => remDlg().then(() => { const l = $('#reml'); if (l) l.textContent = remLabel(); });
    if (!isFree()) badgeCheckSoon(); remCtx();
    const paintTrip = () => { const t = $('#trip'); if (!t) return; t.innerHTML = tripHtml(); bindExam(t, paintTrip); const x = $('#trx'); if (x) x.onclick = () => { lsSet(TRIPX_LS, 1); t.innerHTML = ''; }; };
    if (!isFree()) paintTrip();
    const bindFocus = () => { const b = $('#fxask'); if (b) b.onclick = () => { if (window.QGAI) QGAI.help(); }; bindSub($('#focus')); }; bindFocus();
    if (!homePulled) { homePulled = true; skillsPull().then(() => { const z = $('#rz'); if (z && (location.hash === '' || location.hash === '#')) { z.innerHTML = rzHtml(); bindGoal(); paintTrip(); const f = $('#focus'); if (f) { f.innerHTML = focusHtml(); bindFocus(); } } }).catch(() => {}); }
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
    // المضاف من اللوحة (مجاني/تحويل غالباً): ما له صف في الشيت، فما له PDF في Drive — المذكرة التفاعلية والمحلولة داخل الموقع باسمه وإيميله
    const man = auth.member === 'manual', f = auth.files || {}; if (!$('#wb')) return;
    const drive = id => id ? _T`<a class="btn sm ghost" href="https://drive.google.com/file/d/${esc(id)}/view" target="_blank" rel="noopener">PDF في Drive</a>` : '';
    const card = (id, title, icon, desc, k) => id || man ? _T`<div class="wbc"><div class="ic">${icon}</div><div class="tx"><b>${title}</b><span class="mut">${desc}</span></div>
        <div class="ac"><a class="btn sm" href="#wb-${k}">📖 افتح المذكرة التفاعلية (مع القلم)</a><a class="btn sm ghost wbsol" href="#wb-${k}s">📗 النسخة المحلولة</a>${drive(id)}</div></div>`
      : `<div class="wbc"><div class="ic">${icon}</div><div class="tx"><b>${title}</b><span class="mut">${auth.role === 'admin' ? _T('المشرف ليس له مذكرة شخصية') : _T('تتجهّز نسختك خلال دقائق — حدّث الصفحة لاحقاً')}</span></div></div>`;
    // 🧱 مذكرات التأسيس (لكل المشتركين): تنقرا وينكتب عليها بالقلم داخل الموقع، وما تتحمّل
    const fcard = (k, icon, desc, more) => _T`<div class="wbc"><div class="ic">${icon}</div><div class="tx"><b>${WB_T[k][0]}</b><span class="mut">${desc}</span></div>
        <div class="ac"><a class="btn sm" href="#wb-${k}">📖 افتح المذكرة (مع القلم)</a>${more || ''}</div></div>`;
    el.innerHTML = _T('<h3 class="wbg">🧱 التأسيس</h3>') + fcard('tq', '📐', _T('قواعد الكمي · 257 صفحة · 24 درس، كل قانون مع أمثلة محلولة وترجمة عربية')) +
      fcard('tv', '📖', _T('قواعد اللفظي · طريقة حل كل نوع من أسئلة اللفظي')) +
      _T('<h3 class="wbg">🏋️ التدريب</h3>') +
      card(f.quant, _T('مذكرة الكمي'), '📐', man ? _T('نسختك الخاصة باسمك وإيميلك · 194 صفحة · 14 قسماً') : _T('نسختك الخاصة باسمك ورقمك · 194 صفحة · 14 قسماً'), 'q') +
      card(f.verbal, _T('مذكرة اللفظي'), '📖', man ? _T('نسختك الخاصة باسمك وإيميلك · 193 صفحة · 14 نموذجاً') : _T('نسختك الخاصة باسمك ورقمك · 193 صفحة · 14 نموذجاً'), 'v') +
      `<p class="mut" style="font-size:13px;margin:6px 0 0;grid-column:1/-1">${man ? _T('المذكرة مسجّلة باسمك وإيميلك، وتفتحها من حسابك في الموقع. يُمنع نشرها أو مشاركتها. كتابتك بالقلم تُحفظ على جهازك.') : _T('المذكرة مسجّلة باسمك ورقم جوالك، وتفتح بحساب Google هذا فقط. يُمنع نشرها أو مشاركتها. كتابتك بالقلم تُحفظ على جهازك.')}<br>${_T('📗 النسخة المحلولة نفس صفحات المذكرة وجنب كل سؤال إجابته. لا تعتمد عليها 100%، ممكن يكون فيها أخطاء، فإذا شكّيت في إجابة راجع شرح المقطع.')}</p>`;
  }

  // ---------- interactive workbook viewer (pages + pen) ----------
  let WB = null;
  // solved = 📗 النسخة المحلولة: نفس الصفحات وجنب كل سؤال إجابته (meta.sp = الصفحات اللي فيها أسئلة، والباقي نفس الأصلية)
  // 🧱 مذكرات التأسيس: نفس العارض (القلم، بدون تحميل) لكل المشتركين — tq = قواعد الكمي · tv = قواعد اللفظي (صفحة كل درس من دروس عبدالله الشمراني: TV_PAGE)
  const WB_T = { tq: [_T('تأسيس الكمي'), '📐'], tv: [_T('تأسيس اللفظي'), '📖'] }, TV_PAGE = { 1: 2, 2: 3, 3: 3, 4: 4 };
  const WB_V = 3;   // ⬆️ ارفعه لو تغيّرت meta.json لأي مذكرة (3 = قواعد الكمي الجديدة: 257 صفحة)
  async function renderWorkbook(kind, solved, startPage) {
    const found = !!WB_T[kind];
    const title = found ? WB_T[kind][0] : EN ? (kind === 'q' ? 'Quant workbook' : 'Verbal workbook') + (solved ? ' (solved)' : '') : (kind === 'q' ? 'مذكرة الكمي' : 'مذكرة اللفظي') + (solved ? ' المحلولة' : '');   // i18n:skip
    document.title = title + ' | Q-Guide';
    if (!auth.phone) { try { const r = await api({ op: 'files', session: auth.session }); if (r.ok) { auth.files = r.files; auth.phone = r.phone || ''; lsSet(LS.auth, auth); } } catch (e) {} }
    if (!found && auth.role !== 'admin' && auth.member !== 'manual' && !(auth.files && auth.files[kind === 'q' ? 'quant' : 'verbal'])) { toast(_T('مذكرتك لم تُجهَّز بعد، حاول بعد دقائق')); location.hash = ''; return; }
    let meta; try { meta = await (await fetch('/p/wb/' + kind + '/meta.json?v=' + WB_V)).json(); } catch (e) { toast(_T('تعذّر تحميل المذكرة')); location.hash = ''; return; }
    const lastKey = 'qg_wbpage_' + kind; let page = Math.min(meta.pages, Math.max(1, startPage || lsGet(lastKey, 1)));
    WB = { kind, meta, page, cache: {}, pen: null, solved: !!solved, sp: new Set(meta.sp || []) };
    app.innerHTML = topbar(_T`<span class="ttl wbttl">${found ? WB_T[kind][1] + ' ' : ''}${title}</span>${found ? '' : _T`<a class="chip wbsw${solved ? ' on' : ''}" href="#wb-${kind}${solved ? '' : 's'}" title="${solved ? _T('ارجع للمذكرة بدون حل') : _T('النسخة المحلولة: نفس الصفحات وجنب كل سؤال إجابته')}" aria-label="${solved ? _T('المذكرة بدون حل') : _T('النسخة المحلولة')}">${solved ? '📘' : '📗'}<span class="tx"> ${solved ? _T('بدون حل') : _T('المحلولة')}</span></a>`}<span class="sp"></span>
      <button class="ib" id="pgprev" title="الصفحة السابقة">‹</button><span class="chip cnt" dir="ltr"><input id="pgin" type="number" min="1" max="${meta.pages}" value="${page}" style="width:54px;border:0;background:transparent;color:#fff;font-weight:700;text-align:center;font-size:15px"> / ${meta.pages}</span><button class="ib" id="pgnext" title="الصفحة التالية">›</button>`,
      _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<main class="wbmain">${solved ? _T('<div class="wbwarn" role="note">⚠️ نسخة محلولة للمساعدة: لا تعتمد عليها 100%، ممكن يكون فيها أخطاء. إذا شكّيت في إجابة راجع شرح المقطع.</div>') : ''}<div class="wbwrap" id="wbwrap"><div class="wbpage" id="wbpage"><div class="center" style="padding:60px 0"><div class="spin" style="margin:0 auto"></div></div></div></div>
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
    const dir = WB.solved && WB.sp.has(n) ? kind + 's' : kind, key = dir + n; if (WB.cache[key]) return WB.cache[key];
    const ver = dir !== kind ? WB.meta.sv || 1 : WB.meta.v || 0;   // v = نسخة المذكرة (لما تنبدّل صفحاتها، ما نقرأ القديمة من كاش المتصفح)
    const r = await fetch(`/p/wb/${dir}/${String(n).padStart(3, '0')}.bin${ver ? '?v=' + ver : ''}`, { cache: 'force-cache' }); if (!r.ok) throw new Error('page ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer()); const k = await getKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12));
    const bmp = await createImageBitmap(new Blob([plain], { type: 'image/jpeg' }));
    const keys = Object.keys(WB.cache); if (keys.length > 12) delete WB.cache[keys[0]];
    WB.cache[key] = bmp; return bmp;
  }
  function stamp(ctx, meta, n) {
    const sc = meta.scale, S = meta.slots, local = (auth.phone || '').replace(/^966/, '0') || (auth.member === 'manual' ? auth.email || '' : '');   // المضاف من اللوحة: إيميله بدل الجوال
    const who = (auth.name || '') + (local ? ' · ' + local : ''); if (!who.trim()) return;
    const txt = (x, baseline, size, align, text) => { ctx.save(); ctx.font = `${Math.round(size * sc * 1.15)}px Tajawal, "Segoe UI", Tahoma, sans-serif`; ctx.fillStyle = '#5B6675'; ctx.textAlign = align; ctx.direction = 'rtl'; ctx.fillText(text, x * sc, baseline * sc); ctx.restore(); };
    txt(S.header.x, S.header.baseline, S.header.size, S.header.align || 'right', who);
    const owners = (S.owner && S.owner.pages || []).map(p => Array.isArray(p) ? p : [p, S.owner.baseline]);
    const o = owners.find(p => p[0] === n - 1); if (o) txt(S.owner.x, o[1], S.owner.size, 'right', who);
    if (S.cover && S.cover.page === n - 1) txt(S.cover.x, S.cover.baseline, S.cover.size, 'center', who);
  }
  async function showPage(n) {
    const { kind, meta } = WB; const el = $('#wbpage'); if (!el) return;
    $('#pglabel').textContent = _T('صفحة ') + n + _T(' من ') + meta.pages;
    try {
      const bmp = await pageBitmap(kind, n); if (!WB || WB.page !== n) return;
      let cv = el.querySelector('canvas'); if (!cv) { el.innerHTML = ''; cv = document.createElement('canvas'); el.appendChild(cv); }
      cv.width = meta.w; cv.height = meta.h; const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0); stamp(ctx, meta, n);
      WB.pen.setKey('qg_wb_' + kind + (WB.meta.v ? 'v' + WB.meta.v : '') + '_' + n); WB.pen.resize();   // نسخة جديدة من المذكرة = صفحات جديدة، فكتابة القلم القديمة ما تنحط عليها
      window.scrollTo({ top: 0 });
      pageBitmap(kind, Math.min(meta.pages, n + 1)).catch(() => {});
    } catch (e) { if (String(e.message).indexOf('page') < 0) logout(); el.innerHTML = _T('<div class="center">تعذّر تحميل الصفحة</div>'); }
  }

  // ---------- 🎬 مشغّل المقاطع داخل الموقع (المجاني والتحويل) ----------
  // الرابط مؤقت (4 ساعات) وموقّع، ويشتغل من الموقع بس. إيميل الطالب ورقمه يتحركون فوق المقطع (حتى في ملء الشاشة).
  const VW_LS = 'qg_vw';   // {مفتاح: {t: آخر ثانية, w: 1 = شافه كامل تقريباً}}
  let VID = null;
  // 👨‍🏫 مقاطع المدرسين اللي ما لها يوتيوب (داخل الموقع لكل المشتركين): مين المدرس، وصفحته وقسمها، ورابط قواعد الدرس في مذكرة التأسيس
  const TK = { af: { t: 1, page: 'abdullah', tab: 'f', head: _T('🧱 تأسيس اللفظي'), wb: n => '#wb-tv@' + TV_PAGE[n] },
    at: { t: 1, page: 'abdullah', tab: 't', head: _T('🏋️ تدريب اللفظي') },
    sf: { t: 0, page: 'salman', tab: 'f', head: _T('🧱 تأسيس الكمي'), wb: n => '#wb-tq@' + QR_L[n - 1][2] } };
  function vidList(k) {
    if (k === 'af') return ABD.found.map(n => ({ key: 'af:' + n, h: 'af' + n, n, label: PART_AR[n], dur: '' }));   // 🧱 تأسيس عبدالله الشمراني
    if (k === 'at') return Array.from({ length: ABD.models }, (_, i) => ({ key: 'at:' + (i + 1), h: 'at' + (i + 1), n: i + 1, label: vLabel('v', i + 1), dur: '' }));   // 🏋️ تدريبه على النماذج
    if (k === 'sf') return QR_L.map((x, i) => ({ key: 'sf:' + (i + 1), h: 'sf' + (i + 1), n: i + 1, label: qrName(i + 1), dur: '' }));   // 🧱 تأسيس سلمان الفرج (قواعد الكمي)
    const L = [];
    YT[k].v.forEach((raw, i) => L.push({ key: k + ':' + (i + 1), h: k + (i + 1), n: i + 1, label: vLabel(k, i + 1), dur: raw.slice(raw.indexOf(':') + 1) }));
    return L;
  }
  function vidStop() { if (!VID) return; clearInterval(VID.wm); clearInterval(VID.sv); document.removeEventListener('fullscreenchange', VID.fs); try { VID.v.pause(); VID.v.removeAttribute('src'); VID.v.load(); } catch (e) {} VID = null; }
  async function renderWatch(h) {
    vidStop();
    const hm = /^(af|at|sf|q|v)(\d{1,2})$/.exec(h) || [], k = hm[1], n = +hm[2], X = TK[k], fd = !!(X && X.tab === 'f'), L = k ? vidList(k) : [], cur = L.find(x => x.n === n);
    if (!cur) { location.replace('#sharh'); return; }
    // اسم المقطع: التأسيس = اسم الدرس · تدريب عبدالله = «تدريب النموذج 3» · سلمان = «شرح القسم 3»
    const what = fd ? esc(cur.label) : X ? _T`تدريب ${esc(cur.label)}` : _T`شرح ${esc(cur.label)}`;
    document.title = (fd ? _T('التأسيس: ') + cur.label : X ? _T('تدريب ') + cur.label : _T('شرح ') + cur.label) + ' | Q-Guide';
    const i = L.indexOf(cur), prev = L[i - 1], next = L[i + 1], W = lsGet(VW_LS, {});
    // 🧱 التأسيس: «📘 قواعد الدرس» في مذكرة التأسيس + رجعة لدروسه · التدريب والشرح: «حل النموذج/القسم»
    const tpH = X ? '#sharh-' + X.page + '/' + X.tab : '';
    const solve = fd ? _T`<a class="btn sm" href="${X.wb(n)}">📘 قواعد الدرس</a><a class="btn sm ghost" href="${tpH}">🧱 دروس التأسيس</a>`
      : X ? _T`<a class="btn sm" href="#v${n}">✍️ حل ${vLabel('v', n)}</a><a class="btn sm ghost" href="${tpH}">🏋️ التدريب</a>` : _T`<a class="btn sm" href="#${k}${n}">✍️ حل ${vLabel(k, n)}</a>`;
    const teach = TEACHERS[X ? X.t : 0].name, sub = fd ? _T`الدرس ${n} من ${L.length}` : X ? _T`${n} من ${L.length}` : `<bdi dir="ltr">${esc(cur.dur || '')}</bdi>`;
    const head = X ? _T`<h2 class="h2">${X.head}</h2><span class="wvhl"><a class="lnk2" href="${tpH}">👨‍🏫 صفحة المدرس</a><a class="lnk2" href="#sharh">👨‍🏫 المدرسين</a></span>`
      : _T`<h2 class="h2">${k === 'q' ? _T('📐 مقاطع الكمي') : _T('📖 مقاطع اللفظي')}</h2><span class="wvhl"><a class="lnk2" href="#watch-${k === 'q' ? 'v' : 'q'}1">${k === 'q' ? _T('📖 مقاطع اللفظي') : _T('📐 مقاطع الكمي')}</a><a class="lnk2" href="#sharh-salman/t">👨‍🏫 صفحة المدرس</a></span>`;
    app.innerHTML = topbar(_T`<span class="ttl">🎬 ${what}</span><span class="sp"></span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<main class="wrap watch">
        <div class="wvbox" id="wvbox"><video id="wvv" playsinline controls preload="metadata" controlslist="nodownload nofullscreen noremoteplayback" disablepictureinpicture disableremoteplayback></video>
          <div class="wvwm" id="wvwm" aria-hidden="true"></div><div class="wvmsg" id="wvmsg"><div class="spin"></div></div>
          <button type="button" class="wvfs" id="wvfs" title="ملء الشاشة" aria-label="ملء الشاشة"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>
        <div class="wvbar"><div class="wvt"><b>${what}</b><span class="mut"><span class="wvteach">👨‍🏫 ${teach}</span> · ${sub}</span></div>
          <div class="wvact">${solve}${prev ? _T`<a class="btn sm ghost" href="#watch-${prev.h}" title="${esc(prev.label)}">‹ السابق</a>` : ''}${next ? _T`<a class="btn sm ghost" href="#watch-${next.h}" title="${esc(next.label)}">التالي ›</a>` : ''}</div></div>
        <p class="wvnote">🔒 المقطع خاص بك: إيميلك ظاهر عليه، ويُمنع تصويره أو نشره.</p>
        <div class="wvhead">${head}</div>
        <div class="wvlist">${L.map(x => { const w = W[x.key] && W[x.key].w; return `<a class="wvi${x === cur ? ' on' : ''}${w ? ' ok' : ''}" href="#watch-${x.h}"${x === cur ? ' aria-current="page"' : ''}><b>${fd ? x.n + '. ' : ''}${esc(x.label)}</b><small>${w ? _T('✓ شاهدته') : X ? (vidHas(x.key) ? _T('لم تشاهده') : _T('⏳ قريباً')) : esc(x.dur || '')}</small></a>`; }).join('')}</div>
      </main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    const box = $('#wvbox'), v = $('#wvv'), wm = $('#wvwm'), msg = $('#wvmsg');
    const say = (t, link) => { msg.innerHTML = `<div class="wvm">${t}${link || ''}</div>`; msg.hidden = false; };
    // ما انرفع للموقع (أو حساب يفتح المقاطع في يوتيوب): نفس الزر القديم على يوتيوب · التأسيس ما له يوتيوب
    const toYT = t => { if (X) { say(t); $('#wvfs').hidden = true; return; } const A = ytAlt(), alt = A && A[k] && A[k].v && A[k].v[n - 1];
      const raw = YT[k].v[n - 1].split(':')[0];
      say(t, _T`<a class="btn sm" href="${ytUrl(alt || raw)}"${TGT}>${YTSVG} افتحه في يوتيوب</a>`); $('#wvfs').hidden = true; };
    if (X && isFree()) { say(fd ? _T('مقاطع التأسيس للمشتركين في الدورة.') : _T('مقاطع التدريب للمشتركين في الدورة.')); $('#wvfs').hidden = true; return; }
    if (!X && !(vidSub() || auth.role === 'admin')) { toYT(_T('مقاطع الشرح عندك تفتح في يوتيوب (عضوية القناة).')); return; }
    VID = { v, key: cur.key, wm: 0, sv: 0, fs: null, tries: 0 };
    box.oncontextmenu = e => { e.preventDefault(); return false; };
    // 💧 العلامة: إيميله ورقمه، تتنقّل كل شوي بين أماكن ما تغطي أزرار المشغّل
    const local = (auth.phone || '').replace(/^966/, '0');
    wm.textContent = auth.email + (local ? ' · ' + local : '');
    const spots = [[6, 8], [52, 10], [10, 46], [48, 52], [26, 30], [58, 32], [8, 66], [50, 68]];
    let sp = Math.floor(Math.random() * spots.length);
    const move = () => { sp = (sp + 1 + Math.floor(Math.random() * (spots.length - 1))) % spots.length; wm.style.insetInlineStart = spots[sp][0] + '%'; wm.style.top = spots[sp][1] + '%'; };
    move(); VID.wm = setInterval(move, 9000);
    // ملء الشاشة على الصندوق كامل (عشان العلامة تبقى) · آيفون: ملء الشاشة حق الفيديو نفسه
    const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const fsToggle = () => { if (fsOn()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const f = box.requestFullscreen || box.webkitRequestFullscreen; if (f) { const p = f.call(box); if (p && p.catch) p.catch(() => { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); }); } else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); };
    $('#wvfs').onclick = fsToggle; v.ondblclick = e => { e.preventDefault(); fsToggle(); };
    VID.fs = () => box.classList.toggle('fs', fsOn()); document.addEventListener('fullscreenchange', VID.fs);
    // التقدّم: نكمّل من آخر مكان، و«شاهدته» لما يوصل 90%
    const st = () => { const A = lsGet(VW_LS, {}); return A[cur.key] || {}; };
    const put = o => { const A = lsGet(VW_LS, {}); A[cur.key] = Object.assign(A[cur.key] || {}, o); lsSet(VW_LS, A); };
    const saveT = () => { if (!v.duration || !isFinite(v.duration)) return; const t = v.currentTime, done = t / v.duration > .9; put(Object.assign({ t: done ? 0 : Math.floor(t) }, done ? { w: 1 } : {}));
      if (done) { const a = document.querySelector('.wvi.on'); if (a && !a.classList.contains('ok')) { a.classList.add('ok'); a.querySelector('small').textContent = _T('✓ شاهدته'); } } };
    VID.sv = setInterval(saveT, 5000); v.onpause = saveT; v.onended = saveT;
    let want = st().t || 0;
    v.onloadedmetadata = () => { msg.hidden = true; if (want > 10 && want < v.duration - 5) v.currentTime = want; want = 0; };
    v.onerror = () => { if (!VID || VID.v !== v) return; if (VID.tries < 2) { VID.tries++; want = Math.floor(v.currentTime || want); load(); } else say(_T('تعذّر تشغيل المقطع. تأكد من النت وحدّث الصفحة.')); };
    const load = async () => {
      let r; try { r = await api({ op: 'vid_url', session: auth.session, v: cur.key }); } catch (e) { r = null; }
      if (!VID || VID.v !== v) return;
      if (r && r.error === 'missing') { toYT(fd ? _T('الدرس هذا ينزل قريباً.') : X ? _T('التدريب هذا ينزل قريباً.') : _T('المقطع هذا ما انرفع للموقع للحين.')); return; }
      if (!r || !r.ok) { say(esc((r && r.msg) || _T('تعذّر تشغيل المقطع. تأكد من النت وحدّث الصفحة.'))); return; }
      v.src = r.url; v.load();
    };
    load();
  }

  // ---------- 👨‍🏫 الشرح والمدرسين: كل مدرس له صفحة بقسمين — 🧱 التأسيس و🏋️ التدريب ----------
  const TEACHERS = [
    { id: 'salman', name: _T('سلمان الفرج'), s: ['q', 'v'], on: 1, href: '#sharh-salman', note: _T('تأسيس وتدريب') },
    { id: 'abdullah', name: _T('عبدالله الشمراني'), s: ['v'], on: 1, href: '#sharh-abdullah', note: _T('تأسيس وتدريب') },
    { id: 'talal', name: _T('طلال العنزي'), s: ['q', 'v'], on: 0 },
  ];
  const SUBJ = { q: _T('الكمي'), v: _T('اللفظي') };
  function renderSharh() {
    document.title = _T('الشرح والمدرسين | Q-Guide');
    // بطاقة المدرس اللي له صفحة: رابط لصفحته (التأسيس والتدريب)
    const tcard = t => { const tag = t.href ? 'a' : 'div';
      return `<${tag} class="tch${t.on ? ' on' : ' soon'}${t.href ? ' go' : ''}"${t.href ? ` href="${t.href}"` : ''}><span class="tav" aria-hidden="true">${t.name[0]}</span>
      <span class="ttx"><b>${t.name}</b><span>${t.s.length > 1 ? _T('الكمي واللفظي') : SUBJ[t.s[0]]}${t.note ? ' · ' + t.note : ''}</span></span><span class="tst">${t.href ? _T('افتح ‹') : t.on ? _T('✓ موجود') : _T('⏳ قريباً')}</span></${tag}>`; };
    app.innerHTML = topbar(_T`<span class="ttl">👨‍🏫 الشرح والمدرسين</span><span class="sp"></span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<main class="wrap sharh">
        <div class="hero"><div><h1>الشرح والمدرسين</h1><p>كل مدرس له صفحة فيها قسمين: 🧱 التأسيس يبدأ معك من القواعد، و🏋️ التدريب يشرح لك الأسئلة. سلمان الفرج للكمي واللفظي، وعبدالله الشمراني للفظي.</p></div></div>
        <div class="tchs">${TEACHERS.map(tcard).join('')}</div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
  }
  // 👨‍🏫 صفحة المدرس (سلمان الفرج · عبدالله الشمراني): قسمين — 🧱 التأسيس (دروس داخل الموقع لكل المشتركين) و🏋️ التدريب
  //    سلمان: التأسيس = دروس «قواعد الكمي» الـ24 (sf) · التدريب = شرح الأقسام والنماذج (يوتيوب أو داخل الموقع مثل قبل)
  //    عبدالله: التأسيس = 4 دروس اللفظي (af) · التدريب = النماذج الـ14 (at)
  const TP = {
    salman: { t: 0, ls: 'qg_tp_sal', fk: 'sf', fn: QR_L.length, wb: 'tq', ft: _T('تأسيس الكمي'), desc: _T('مدرس الكمي واللفظي. يأسّسك في قواعد الكمي درس درس، ويشرح لك أقسام الكمي ونماذج اللفظي.') },
    abdullah: { t: 1, ls: 'qg_tp_abd', fk: 'af', fn: ABD.found.length, wb: 'tv', ft: _T('تأسيس اللفظي'), desc: _T('مدرس اللفظي. يبدأ معك من الأساس بطريقة حل كل نوع من أسئلة اللفظي الأربعة، وبعدها يدرّبك على النماذج.') },
  };
  function renderTeach(id, tabHint) {
    const C = TP[id], t = TEACHERS[C.t]; document.title = t.name + ' | Q-Guide';
    const W = lsGet(VW_LS, {}), free = isFree(), adm = auth.role === 'admin', seen = k => W[k] && W[k].w;
    const fkeys = Array.from({ length: C.fn }, (_, i) => C.fk + ':' + (i + 1)), fUp = fkeys.filter(vidHas).length, fSeen = fkeys.filter(seen).length;
    // حالة كل درس: الزائر 🔒 (يفتح نافذة الاشتراك) · شاهده ✓ · انرفع ▶ · ما انرفع ⏳
    const lesson = n => { const key = C.fk + ':' + n, w = seen(key), has = vidHas(key) || adm;
      const ar = id === 'salman' ? QR_L[n - 1][0] : PART_AR[n], en = id === 'salman' ? QR_L[n - 1][1] : ABD.en[n];
      const body = `<span class="tln" aria-hidden="true">${n}</span><span class="tlx"><b>${EN ? en : ar}</b>${EN ? '' : `<small dir="ltr">${en}</small>`}</span>`;
      if (free) return _T`<button type="button" class="tle lock" data-lock="${C.ft}">${body}<span class="tls">🔒 للمشتركين</span></button>`;
      if (!has) return _T`<div class="tle soon" aria-disabled="true">${body}<span class="tls">⏳ قريباً</span></div>`;
      return _T`<a class="tle${w ? ' ok' : ''}" href="#watch-${C.fk}${n}">${body}<span class="tls">${w ? _T('✓ شاهدته') : _T('▶ شاهد الدرس')}</span></a>`; };
    const lessons = id === 'salman'
      ? QR_U.map((u, ui) => `<h3 class="tpu"><span class="tpun" aria-hidden="true">${ui + 1}</span>${EN ? u[1] : u[0]}<small>${EN ? 'Unit ' + (ui + 1) : _T`الوحدة ${ui + 1}`}</small></h3>
          <div class="tles">${QR_L.map((x, i) => x[3] === ui + 1 ? lesson(i + 1) : '').join('')}</div>`).join('')
      : `<div class="tles">${ABD.found.map(lesson).join('')}</div>`;
    const pct = Math.round(fSeen * 100 / C.fn), fN = EN ? enN(C.fn, 'lesson', 'lessons') : C.fn + (C.fn <= 10 ? ' دروس' : ' درس');   // i18n:skip
    const fSoon = !fUp && !adm ? _T`<div class="tpsoon"><b>⏳ التأسيس ينزل قريباً</b><span>${t.name} يشرح ${C.ft} درس درس (${fN}). لين ينزل، ابدأ من <a href="#wb-${C.wb}">مذكرة التأسيس</a>.</span></div>` : '';
    const fBar = _T`<div class="tpbar"><div class="tpbt"><b>${C.ft}</b><span>${free ? (id === 'salman' ? _T`${fN}: كل قواعد الكمي من الأساس` : _T('4 دروس: طريقة حل كل نوع من أسئلة اللفظي')) : fSeen ? _T`شاهدت ${fSeen} من ${C.fn}` : fUp ? _T('ابدأ بالدرس الأول، وكل درس يجهّزك لنوع من الأسئلة') : _T`${fN} بنفس ترتيب مذكرة التأسيس`}</span></div>
      ${free || !fUp ? '' : `<i class="pg" aria-hidden="true"><span style="width:${pct}%"></span></i>`}${free ? _T`<button type="button" class="btn sm ghost" data-lock="${C.ft}">📘 مذكرة التأسيس 🔒</button>` : _T`<a class="btn sm ghost" href="#wb-${C.wb}">📘 مذكرة التأسيس</a>`}</div>`;
    // 🏋️ التدريب — سلمان: الأقسام والنماذج · عبدالله: النماذج الـ14 داخل الموقع (at)
    let tN, tPane;
    if (id === 'salman') {
      const item = (k, n) => { const y = ytFor(k + n); if (!y) return '';
        const w = seen(k + ':' + n);
        return `<a class="wvi${w ? ' ok' : ''}" href="${y.url}"${y.tgt}${ytTip(y)}><b>${vIcon(y)}<span>${vLabel(k, n)}</span></b><small>${w ? _T('✓ شاهدته') : `<bdi dir="ltr">${esc(y.dur || '')}</bdi>`}</small></a>`; };
      const qn = YT.q.v.map((_, i) => i + 1), vn = YT.v.v.map((_, i) => i + 1);
      tN = EN ? enN(qn.length + vn.length, 'video', 'videos') : (qn.length + vn.length) + ' مقطع';   // i18n:skip
      tPane = _T`<h3 class="tsub">📐 الكمي <small>14 قسم</small></h3><div class="wvlist">${qn.map(n => item('q', n)).join('')}</div>
          <h3 class="tsub">📖 اللفظي <small>14 نموذج + الأسئلة الجديدة</small></h3><div class="wvlist">${vn.map(n => item('v', n)).join('')}</div>`;
    } else {
      const tUp = Array.from({ length: ABD.models }, (_, i) => 'at:' + (i + 1)).filter(vidHas).length;
      const mod = n => { const key = 'at:' + n, w = seen(key), lab = vLabel('v', n);
        if (free) return _T`<button type="button" class="wvi lock" data-lock="تدريب اللفظي"><b>${lab}</b><small>🔒 للمشتركين</small></button>`;
        if (!vidHas(key) && !adm) return _T`<div class="wvi dis" aria-disabled="true"><b>${lab}</b><small>⏳ قريباً</small></div>`;
        return _T`<a class="wvi${w ? ' ok' : ''}" href="#watch-at${n}"><b>${lab}</b><small>${w ? _T('✓ شاهدته') : _T('▶ شاهد التدريب')}</small></a>`; };
      tN = EN ? enN(ABD.models, 'model', 'models') : ABD.models + ' نموذج';   // i18n:skip
      tPane = (!tUp && !adm ? _T`<div class="tpsoon"><b>⏳ التدريب ينزل قريباً</b><span>تدريب الأستاذ عبدالله على النماذج الـ14. لين ينزل، شرح النماذج موجود عند <a href="#sharh-salman/t">سلمان الفرج</a>.</span></div>` : '')
        + `<div class="wvlist tpmods">${Array.from({ length: ABD.models }, (_, i) => mod(i + 1)).join('')}</div>`;
    }
    // القسم: من الرابط (/f أو /t) · وإلا آخر واحد فتحه · وإلا التأسيس (سلمان: التدريب لين ينزل تأسيسه)
    const last = lsGet(C.ls, ''); let tab = tabHint || (last === 'f' || last === 't' ? last : id === 'salman' && !fUp ? 't' : 'f');
    app.innerHTML = topbar(_T`<span class="ttl">👨‍🏫 ${t.name}</span><span class="sp"></span>`, _T`<a class="ib" href="#sharh" title="المدرسين">→</a>`) +
      _T`<main class="wrap sharh tpage">
        <div class="tphead"><span class="tav" aria-hidden="true">${t.name[0]}</span>
          <div class="tphx"><h1>${t.name}</h1><p>${C.desc}</p></div></div>
        <div class="tabs tptabs" role="tablist" aria-label="أقسام المدرس">
          <button type="button" role="tab" id="tpt-f" aria-controls="tp-f">🧱 التأسيس <small>${fN}</small></button>
          <button type="button" role="tab" id="tpt-t" aria-controls="tp-t">🏋️ التدريب <small>${tN}</small></button>
        </div>
        <section class="tppane" id="tp-f" role="tabpanel" aria-labelledby="tpt-f">${fSoon}${fBar}${lessons}</section>
        <section class="tppane" id="tp-t" role="tabpanel" aria-labelledby="tpt-t">${tPane}</section></main>`;
    bindCtl(); bindSub(app); window.scrollTo({ top: 0 });
    const show = x => { tab = x; lsSet(C.ls, x); ['f', 't'].forEach(k => { const on = k === x, b = $('#tpt-' + k); b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; $('#tp-' + k).hidden = !on; }); };
    $('#tpt-f').onclick = () => show('f'); $('#tpt-t').onclick = () => show('t');
    $('.tptabs').onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const x = tab === 'f' ? 't' : 'f'; show(x); $('#tpt-' + x).focus(); e.preventDefault(); } };
    show(tab);
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
    app.innerHTML = topbar(_T`<span class="ttl">جارٍ التحميل…</span>`, _T`<a class="ib" href="#" title="رجوع">→</a>`) + _T('<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل الأسئلة…</span></div>');
    if (RULES_ON && !isFree()) ruleMapLoad();   // خريطة «راجع القاعدة» تنزل مع الأسئلة
    let set; try { set = await loadSet(id); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#">→</a>`) + _T('<div class="center">تعذّر فتح الأسئلة (') + esc(e.message) + _T('). <a href="#">رجوع</a></div>'); return; }
    if (set.kind === 'verbal') await loadVocab(); else if (rmapP) await rmapP;
    const items = flatItems(set); const prog = progGet(id);
    if (!items.length) { const star = /^t-star-/.test(id); app.innerHTML = topbar(`<span class="ttl">${esc(set.title)}</span>`, _T`<a class="ib" href="${star ? '#notes' : '#skills'}" title="رجوع">→</a>`) + (star ? _T`<div class="center"><div style="font-size:40px">⭐</div><p>ما حفظت أسئلة في هذا القسم من دفترك.<br><span class="mut">اضغط ⭐ على أي سؤال وأنت تحل عشان ينحفظ هنا وتتدرّب عليه.</span></p><a class="btn" href="#notes">📒 دفتري</a></div>` : _T`<div class="center"><div style="font-size:40px">🎉</div><p>ما عندك أخطاء محفوظة في هذا القسم حالياً.<br><span class="mut">حل أسئلة من الأقسام أو التدريب الموجّه، وأي سؤال تخطئ فيه يُجمع لك هنا.</span></p><a class="btn" href="#skills">🎯 نقاط القوة والضعف</a></div>`); bindCtl(); return; }
    if (!prog.started) prog.started = Date.now();
    let cur = items.findIndex((x, i) => !prog.a[i]); if (cur < 0) cur = Math.min(prog.last || 0, items.length - 1);   // أول سؤال بدون إجابة
    if (start != null && start >= 0 && start < items.length) cur = start;   // فتح سؤال محدد (من الدفتر)
    P = { id, set, items, prog, cur, t0: Date.now(), lastAct: Date.now(), hidAt: 0, passOpen: {}, sel: null };
    document.title = set.title + ' | Q-Guide';
    app.innerHTML = topbar(_T`<span class="ttl">${esc(set.title)} <small style="opacity:.8;font-weight:400">· ${esc(set.sub.split(' · ').pop())}</small></span><span class="sp"></span>
      ${ytFor(id) ? _T`<a class="ytb" href="${ytFor(id).url}"${ytFor(id).tgt}${ytTip(ytFor(id), _T('شرح ') + ytFor(id).label + _T(' على يوتيوب'))}>${vIcon(ytFor(id))}<span>الشرح</span></a>` : ''}<span class="chip run" id="run" hidden></span><button class="chip cnt" id="navb" title="كل الأسئلة: اضغط وانتقل لأي سؤال" aria-label="كل الأسئلة" aria-haspopup="dialog">${GRIDSVG}<span id="cnt" dir="ltr"></span></button>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<div class="sbar" id="sb" style="--n:${items.length}" aria-hidden="true">${items.map((x, i) => `<i class="${prog.a[i] ? (prog.a[i].c ? 'ok' : 'bad') : ''}"></i>`).join('')}</div><main class="wrap" id="pm"></main>
      <aside class="sheetp" aria-label="ورقة الإجابة"><div class="sp-h"><b>ورقة الإجابة</b><span id="spn"></span></div><div class="qgrid" id="spg"></div></aside>
      <div class="nav" id="nav" role="dialog" aria-modal="true" aria-label="كل الأسئلة"><div class="bg"></div><div class="sh"><div class="nvh"><b>كل الأسئلة</b><span class="nlg"><span><i class="ok"></i>صحيحة</span><span><i class="bad"></i>خاطئة</span><span><i></i>ما جاوبتها</span></span><span class="sp"></span><button class="btn sm ghost" id="reset">↻ إعادة من البداية</button></div><div class="qgrid big" id="ng"></div></div></div>`;
    $('#navb').onclick = () => { renderNav(); $('#nav').classList.add('open'); const c = $('#ng .cur'); if (c) c.focus({ preventScroll: true }); };
    bindCtl();
    $('#nav .bg').onclick = () => $('#nav').classList.remove('open');
    const spg = $('#spg'); spg.innerHTML = sheetBtns(); spg.onclick = e => { const b = e.target.closest('button[data-i]'); if (b) showQ(+b.dataset.i); };
    $('#reset').onclick = async () => { if (await QGDlg.confirm(_T('تُحذف إجاباتك في هذا القسم وتبدأ من جديد؟'), { ok: _T('ابدأ من جديد'), danger: true })) { const best = prog.best; progSet(id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(id); } };
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
    const sn = $('#spn'); if (sn) sn.textContent = _T`أجبت ${ans} من ${n}`;
  }
  // أزرار ورقة الإجابة (اللوحة الجانبية + نافذة كل الأسئلة): كل سؤال متاح بضغطة
  function sheetBtns() { return P.items.map((x, i) => { const a = P.prog.a[i]; return _T`<button type="button" class="${a ? (a.c ? 'ok' : 'bad') : ''}${i === P.cur ? ' cur' : ''}" data-i="${i}" aria-label="سؤال ${i + 1}${a ? (a.c ? _T('، إجابتك صحيحة') : _T('، إجابتك خاطئة')) : ''}">${i + 1}</button>`; }).join(''); }
  // أقرب سؤال بدون إجابة بعد i (ويرجع من البداية)، أو -1
  function nextOpen(i) { const n = P.items.length; for (let k = 1; k < n; k++) { const j = (i + k) % n; if (!P.prog.a[j]) return j; } return -1; }
  function showQ(i) {
    const { set, items, prog } = P; P.cur = i; prog.last = i; progSet(P.id, prog); updateCounter();
    const { it, gi } = items[i]; const a = prog.a[i]; P.sel = null;
    const mkSrc = it.src || P.id, mkI = it.sidx != null ? it.sidx : i, mk = markOf(mkSrc, mkI);
    let html = '';
    if (set.kind === 'verbal') {
      const g = set.groups[gi]; const prevG = i > 0 ? items[i - 1].gi : -1;
      if (g.m) html += `<div class="gmd"><bdi dir="ltr">Model ${g.m} · ${esc(g.mt || '')}</bdi></div>`;   // «الأسئلة الجديدة»: كل قطعة من أي نموذج
      if (g.kind === 'part') html += `<div class="ghd">${esc(g.title)}${EN ? '' : ` <small>— ${esc(g.ar || '')}</small>`}</div>`;
      else {
        const open = P.passOpen[gi] != null ? P.passOpen[gi] : true;
        html += _T`<div class="ghd">Passage ${g.num}: ${esc(g.title)} <small>— استيعاب المقروء</small></div>
        <div class="pass ${open ? '' : 'closed'}" id="pass"><div class="ph" id="ph"><span>📄 القطعة <span class="ar">اضغط للإخفاء/الإظهار</span></span><span id="pch">${open ? '▲' : '▼'}</span></div><div class="pread"><button type="button" class="sayb" data-say-sel="#pass .pb" data-lang="en" aria-label="استمع للقطعة">${SAYSVG}<span>استمع للقطعة</span></button></div><div class="pb">${wordsHtml(g.passage)}</div>${vocabChips(g.passage, 120) ? _T`<details class="tr vocab pw"><summary>📖 كلمات القطعة <small>(اضغط على أي كلمة في القطعة لترجمتها)</small></summary><div class="vcs">${vocabChips(g.passage, 120)}</div></details>` : ''}</div>`;
      }
    }
    const tag = set.kind === 'quant' ? (it.part ? `Question ${it.n} (Part ${it.part})` : `Question ${it.n}`) : `Q ${it.n}`;
    html += _T`<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${items.length}</small></span><span class="hd-r">${set.kind === 'verbal' ? sayBtn(it.q, 'en') : ''}<button type="button" class="mk st ${mk && mk.s ? 'on' : ''}" id="mkS" aria-pressed="${!!(mk && mk.s)}" title="احفظ السؤال في دفتري" aria-label="احفظ السؤال في دفتري">${STARSVG}</button><button type="button" class="mk nt ${mk && mk.n ? 'on' : ''}" id="mkN" title="اكتب ملاحظتك على السؤال" aria-label="ملاحظتي">${NOTESVG}</button><span class="tag ltr">${tag}</span></span></div>`;
    if (set.kind === 'quant') html += `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="Question ${it.n}">` + qtrHtml(it);
    else html += (it.tag ? `<div class="qtag"><bdi dir="ltr">${esc(EN ? it.tag.split(' – ')[0] : it.tag)}</bdi></div>` : '') + `<p class="txt ltr">${wordsHtml(it.q)}</p>`;
    const two = set.kind === 'quant' || it.opts.every(o => o.length <= 28);
    html += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => {
      const lab = set.kind === 'quant' && /^[A-D]\)\s/.test(o) ? o.replace(/^[A-D]\)\s*/, '') : o;
      let cls = ''; if (a) { if (k === it.ans) cls = 'ok'; else if (k === a.s) cls = 'bad'; }
      return `<button class="opt ${cls}" data-k="${k}" ${a ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span>${esc(lab)}</span></button>`;
    }).join('') + '</div>';
    html += _T`<div id="fb">${a ? feedback(it, a) : ''}</div>
      <div class="note ${mk && mk.n ? 'open' : ''}" id="nt"><label for="ntx">${NOTESVG}<b>ملاحظتي</b><small>تنحفظ تلقائياً في دفتري</small></label><textarea id="ntx" dir="auto" maxlength="600" rows="2" placeholder="مثلاً: وش القاعدة؟ وليش غلطت؟">${esc(mk ? mk.n || '' : '')}</textarea></div>
      <div class="acts"><button class="btn ghost sm" id="prev" ${i === 0 ? 'disabled' : ''}>→ السابق</button><span class="sp"></span>
      ${a ? `<button class="btn" id="next">${i + 1 < items.length ? _T('التالي ←') : nextOpen(i) < 0 ? _T('النتيجة 🏁') : _T('التالي ←')}</button>` : _T`${nextOpen(i) >= 0 ? _T('<button class="btn ghost sm" id="skip" title="انتقل لسؤال ما جاوبته وارجع لهذا بعدين">تخطَّ ←</button>') : ''}<button class="btn gold" id="confirm" disabled>✓ تأكيد الإجابة</button>`}</div>
      <div class="kbd" style="margin-top:8px">${a ? _T('Enter للتالي') : _T('اختر إجابة ثم اضغط تأكيد · A–D أو 1–4 للاختيار و Enter للتأكيد')}</div></div>`;
    $('#pm').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.QGAI) QGAI.fill($('#pm'));
    bindWords();
    const qd = $('#qtr'); if (qd) qd.addEventListener('toggle', () => lsSet(QTR_LS, qd.open ? 1 : 0));
    $('#mkS').onclick = e => { const b = e.currentTarget, c = markOf(mkSrc, mkI), on = !(c && c.s); markSet(mkSrc, mkI, { s: on ? 1 : 0 }); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); toast(on ? _T('⭐ انحفظ السؤال في دفتري') : _T('انشال السؤال من دفتري')); badgeCheckSoon(); };
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
    const OKS = [_T('✅ إجابة صحيحة، أحسنت!'), _T('✅ صح! كفو عليك'), _T('✅ ممتاز، إجابة صحيحة'), _T('✅ صح عليك 👏'), _T('✅ برافو، إجابة صحيحة')];
    // الشرح المكتوب انشال: الشرح صار من المساعد الذكي بس (زر «اشرح لي أكثر»)
    return `<div class="fb ${ok ? 'ok' : 'bad'}"><div class="h">${ok ? OKS[(it.n || 0) % OKS.length] : _T('❌ إجابة خاطئة')}</div>
      ${ok ? '' : _T`<div class="ans">الإجابة الصحيحة: <b>${LETTERS[it.ans]}) ${esc(corr.replace(/^[A-D]\)\s*/, ''))}</b></div>`}
      ${fbMeta(it, a)}
      ${aiSlot(it, a)}
      ${ok ? '' : ytLink(it)}
      ${P && P.set.kind === 'verbal' ? trHtml(it, ok) : ''}</div>`;
  }
  // 🤖 «اشرح لي أكثر»: مرجع السؤال في بنك المساعد = القسم/النموذج الأصلي + ترتيبه فيه
  function aiSlot(it, a) {
    if (!window.QGAI || !P || !a) return ''; const src = it.src || P.id, idx = it.sidx != null ? it.sidx : P.cur;
    if (!/^[qv]\d{1,2}$/.test(src)) return '';
    const wrong = a.s !== it.ans;
    return QGAI.slot({ ref: src + ':' + idx, pick: a.s, wrong, label: _T`سؤال ${P.cur + 1} · الإجابة الصحيحة ${LETTERS[it.ans]}${wrong ? _T` · إجابتك ${LETTERS[a.s]} ✗` : ''}` });
  }
  function ytLink(it) {
    const yt = ytFor(P && P.id === 'v15' ? 'v15' : it.src || (P && P.id)); if (!yt) return '';
    return _T`<a class="ytx" href="${yt.url}"${yt.tgt}${ytTip(yt)}>${vIcon(yt)}<span>ما وضح لك؟ شاهد شرح ${yt.label} بالفيديو${yt.site ? '' : _T(' على يوتيوب')}</span><span class="go">${EN ? '→' : '←'}</span></a>`;
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
    return _T`<details class="qtr" id="qtr" ${lsGet(QTR_LS, 0) ? 'open' : ''}><summary><span class="qt-f" aria-hidden="true">🇸🇦</span>ترجمة السؤال <small>ومعاني الكلمات</small></summary><div class="qt-b"><p class="qt-ar">${arMath(ar.q)}</p><div class="says">${it.en ? sayBtn(it.en, 'en', _T('اسمع السؤال بالإنجليزي')) : ''}${hasAr() ? sayBtn(ar.q, 'ar', _T('اسمع الترجمة')) : ''}</div>${ot}${w.length ? `<div class="vcs">${w.map(x => vcChip(x[0], x[1])).join('')}</div>` : ''}</div></details>`;
  }
  // 🇸🇦 ترجمة السؤال والخيارات + كلمات السؤال
  function trHtml(it, shut) {   // shut: مقفولة (بعد الإجابة الصحيحة) — الطالب يفتحها لو احتاجها
    const ar = it.ar, op = shut ? '' : ' open'; let h = '';
    if (ar && ar.q) h += _T`<details class="tr"${op}><summary>🇸🇦 ترجمة السؤال</summary><div class="trq">${esc(ar.q)}</div><div class="says">${sayBtn(it.q, 'en', _T('اسمع السؤال'))}${hasAr() ? sayBtn(ar.q, 'ar', _T('اسمع الترجمة')) : ''}</div><ol class="tro">${it.opts.map((o, k) => `<li class="${k === it.ans ? 'ok' : ''}"><span class="L">${LETTERS[k]}</span><span class="en ltr">${esc(o)} ${sayBtn(o, 'en', '', 'sm')}</span><span class="arr">${esc((ar.o || [])[k] || '')}</span></li>`).join('')}</ol></details>`;
    const chips = vocabChips(it.q + ' ' + it.opts.join(' '), 40);
    if (chips) h += _T`<details class="tr vocab"${op}><summary>📖 كلمات السؤال <small>(اضغط على أي كلمة في السؤال لترجمتها)</small></summary><div class="vcs">${chips}</div></details>`;
    return h;
  }
  function answer(i, k) {
    const { it } = P.items[i]; if (P.prog.a[i]) return;
    const nowT = Date.now(); const ms = Math.min(Math.max(0, nowT - (P.lastAct || nowT)), Q_CAP); P.lastAct = nowT;
    P.prog.a[i] = { s: k, c: k === it.ans ? 1 : 0, t: nowT, ms }; progSet(P.id, P.prog);
    const good = k === it.ans; if (isFree() && window.QGT) QGT.ans(P.id, good); const sbi = $('#sb') && $('#sb').children[i]; if (sbi) sbi.className = (good ? 'ok' : 'bad') + ' cur';
    const gbi = $('#spg') && $('#spg').children[i]; if (gbi) { gbi.className = (good ? 'ok' : 'bad') + ' cur'; gbi.setAttribute('aria-label', _T`سؤال ${i + 1}، إجابتك ${good ? _T('صحيحة') : _T('خاطئة')}`); }
    P.run = good ? (P.run || 0) + 1 : 0; const rc = $('#run'); if (rc) { if (P.run >= 3) { rc.hidden = false; rc.textContent = '🔥 ' + P.run + _T(' صح ورا بعض'); rc.classList.remove('bump'); void rc.offsetWidth; rc.classList.add('bump'); } else rc.hidden = true; }
    const today = daysAdd(), goal = goalGet(); if (today === goal) setTimeout(() => toast(_T('🎉 حققت هدف اليوم: ') + goal + _T(' سؤال!')), 700); else badgeCheckSoon();
    try { const h = histGet(); histMark(h, it.src || P.id, it.sidx != null ? it.sidx : i, k === it.ans, itemTopics(it)); histSet(h); skillsPushSoon(); } catch (e) {}
    document.querySelectorAll('.opt').forEach(b => { b.disabled = true; b.classList.remove('sel'); const kk = +b.dataset.k; if (kk === it.ans) b.classList.add('ok'); else if (kk === k) b.classList.add('bad'); });
    if (!RM()) { const btn = document.querySelector(`.opt[data-k="${k}"]`); if (btn) { if (good) burst(btn.querySelector('.L') || btn); else btn.classList.add('shake'); } }
    $('#fb').innerHTML = feedback(it, P.prog.a[i]); if (window.QGAI) QGAI.fill($('#fb'));
    const sk = $('#skip'); if (sk) sk.remove();
    const nxo = nextOpen(i);   // بعد الإجابة: التالي = أقرب سؤال ما جاوبته، والنتيجة لما تخلص كل الأسئلة
    const cf = $('#confirm'); if (cf) { cf.outerHTML = `<button class="btn" id="next">${nxo < 0 ? _T('النتيجة 🏁') : _T('التالي ←')}</button>`; $('#next').onclick = () => { if (nxo >= 0) showQ(nxo); else finish(); }; }
    const kb = $('.kbd'); if (kb) kb.textContent = _T('Enter للتالي');
    updateCounter();
    const fbEl = $('#fb'); if (fbEl) setTimeout(() => fbEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
  function renderNav() {
    const ng = $('#ng'); ng.innerHTML = sheetBtns();
    ng.onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; $('#nav').classList.remove('open'); showQ(+b.dataset.i); };
  }
  async function finish() {
    const { items, prog, set } = P; const n = items.length; const answered = Object.keys(prog.a).length;
    if (answered < n) { toast(EN ? enN(n - answered, 'question', 'questions') + ' still unanswered' : 'باقي ' + (n - answered) + ' سؤال بدون إجابة'); const f = items.findIndex((x, i) => !prog.a[i]); return showQ(f); }   // i18n:skip
    const correct = Object.values(prog.a).filter(a => a.c).length; const pct = Math.round(correct * 100 / n);
    const secs = activeSecs(prog);
    const wrong = items.map((x, i) => i).filter(i => prog.a[i] && !prog.a[i].c);
    const firstTime = !prog.done;
    if (prog.best == null || pct > prog.best) prog.best = pct; prog.done = 1; progSet(P.id, prog); setTimeout(badgeCheck, 2200); remCtx();
    document.onkeydown = null;
    const nm = /^([qv])(\d{1,2})$/.exec(set.id), nx = nm && +nm[2] < 14 ? nm[1] + (+nm[2] + 1) : null;
    // ⏱ متوسط وقت السؤال (الأسئلة اللي وقتها معروف فقط) مقارنة بوقت قياس
    const timed = Object.values(prog.a).filter(a => a.ms > 0 && a.ms < Q_CAP), pc = timed.length >= 5 ? paceOf(timed.reduce((s, a) => s + a.ms, 0) / timed.length) : null;
    const paceHtml = pc ? _T`<p class="s-pace ${pc.k}"><span aria-hidden="true">⏱</span>متوسط وقتك للسؤال <b dir="ltr">${fmtDur(pc.s)}</b> — ${pc.k === 'fast' ? _T('أسرع من وقت الاختبار 👌') : pc.k === 'ok' ? _T('مناسب لوقت الاختبار (دقيقة تقريباً للسؤال)') : _T('أبطأ من وقت الاختبار (دقيقة تقريباً للسؤال) — تدرّب على السرعة')}</p>` : '';
    // 📐 القواعد اللي تجمّعت فيها أخطاؤه في هذا القسم (كل قاعدة مرة واحدة، الأكثر تكراراً أولاً)
    const rulesHtml = (() => {
      if (!wrong.length) return ''; const m = new Map();
      wrong.forEach(i => { const r = ruleFor(items[i].it, i); if (r) { const o = m.get(r.href) || Object.assign({ n: 0 }, r); o.n++; m.set(r.href, o); } });
      const L = [...m.values()].sort((a, b) => b.n - a.n).slice(0, 6); if (!L.length) return '';
      return `<div class="s-rules"><h3>${set.kind === 'quant' ? _T('📐 قوانين تراجعها قبل ما تكمّل') : _T('📘 قواعد تراجعها قبل ما تكمّل')}</h3><div class="s-rl">${L.map(r => `<a class="fb-r" href="${r.href}"><span aria-hidden="true">${r.icon}</span>${esc(r.t)}${r.n > 1 ? `<small>${r.n}</small>` : ''}</a>`).join('')}</div></div>`;
    })();
    $('#pm').innerHTML = _T`<div class="sum"><div class="ring" id="ring" style="--p:0"><b><span id="rp">0</span><small>%</small></b></div>
      <h2>${pct >= 85 ? _T('ممتاز! 🌟') : pct >= 70 ? _T('جيد جداً 👏') : pct >= 50 ? _T('جيد، كمّل تدريب 💪') : _T('راجع الشرح وأعد المحاولة 📘')}</h2>
      <p class="ssub">${esc(set.title)} <bdi dir="ltr">${esc(set.sub)}</bdi></p>
      <div class="stats"><div class="ok"><b>${correct}</b><span>صحيحة</span></div><div class="bad"><b>${answered - correct}</b><span>خاطئة</span></div><div><b>${n - answered}</b><span>بدون إجابة</span></div><div><b class="ltr">${fmtDur(secs)}</b><span>الوقت الفعلي</span></div></div>
      ${paceHtml}
      <div class="acts sacts">${nx ? (isFree() && FREE_SETS.indexOf(nx) < 0 ? _T`<button class="btn gold" data-lock="${SET_NAME(nx)}">التالي: ${SET_NAME(nx)} 🔒</button>` : _T`<a class="btn gold" href="#${nx}">التالي: ${SET_NAME(nx)}</a>`) : ''}${wrong.length ? _T`<button class="btn" id="rev">مراجعة الأخطاء (${wrong.length})</button>` : ''}${!nx && !wrong.length ? _T`<a class="btn gold" href="#">الرئيسية</a>` : ''}</div>
      <div class="slinks"><button class="lnk2" id="again">↻ إعادة ${nm ? (nm[1] === 'q' ? _T('القسم') : _T('النموذج')) : _T('الاختبار')}</button>${nm && !isFree() ? _T`<a class="lnk2" href="#board-set-${set.id}">🏆 ترتيبك في ${SET_NAME(set.id)}</a>` : ''}${ytFor(set.id) ? _T`<a class="lnk2" href="${ytFor(set.id).url}"${ytFor(set.id).tgt}${ytTip(ytFor(set.id))}>${vIcon(ytFor(set.id))} شرح ${ytFor(set.id).label} بالفيديو</a>` : ''}<a class="lnk2" href="#skills">🎯 نقاط قوتك وضعفك</a></div>
      ${rulesHtml}
      ${wrong.length ? _T`<div class="wl"><h3>الأسئلة الخاطئة — اضغط على الرقم لمراجعة الشرح:</h3><div class="ng">${wrong.map(i => `<button class="bad" data-i="${i}">${i + 1}</button>`).join('')}</div></div>` : ''}
      <p id="saved" class="kbd" style="margin-top:14px"></p></div>`;
    $('#again').onclick = () => { const best = prog.best; progSet(P.id, { a: {}, best, started: Date.now(), last: 0, done: 0 }); renderPlayer(P.id); };
    bindSub($('#pm'));
    const rv = $('#rev'); if (rv) rv.onclick = () => { document.onkeydown = onKey; showQ(wrong[0]); };
    document.querySelectorAll('.wl button').forEach(b => b.onclick = () => { document.onkeydown = onKey; showQ(+b.dataset.i); });
    window.scrollTo(0, 0);
    (function count() { const ring = $('#ring'), rp = $('#rp'); if (!ring) return; if (RM()) { ring.style.setProperty('--p', pct); rp.textContent = pct; return; } const t0 = performance.now(), D = 900; (function f(t) { const e = Math.min(1, (t - t0) / D), v = Math.round(pct * (1 - Math.pow(1 - e, 3))); ring.style.setProperty('--p', v); rp.textContent = v; if (e < 1) requestAnimationFrame(f); })(t0); })();
    if (pct >= 85) setTimeout(confetti, 350);
    skillsPushSoon(1500);
    if (set.topicSet) { $('#saved').textContent = _T('تدريب موجّه: يُحتسب في نقاط قوتك وضعفك فقط (لا يدخل لوحة الصدارة)'); return; }
    try {
      const r = await api({ op: 'result', session: auth.session, set: set.id, kind: set.kind, n, correct, secs, wrong: wrong.map(i => items[i].it.n).join(',') });
      $('#saved').textContent = r.ok ? (r.admin ? _T('وضع المشرف: النتيجة لا تُسجّل') : r.free ? _T('نتيجتك محفوظة على جهازك ✓') : _T('تم حفظ نتيجتك ✓')) : '';
      if (!r.ok && r.error === 'session') { toast(_T('انتهت الجلسة، سجّل دخولك من جديد')); }
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
  const vcChip = (w, ar) => _T`<button type="button" class="vc" data-say="${esc(w)}" data-lang="en" title="اضغط لسماع النطق"><b>${esc(w)}</b><span>${esc(ar)}</span>${SAYSVG}</button>`;
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
    if (!TTS.ok) { toast(_T('متصفحك ما يدعم النطق الصوتي')); return; }
    if (btn && TTS.btn === btn) { sayStop(); return; }   // ضغطة ثانية = إيقاف
    sayStop(); lang = lang === 'ar' ? 'ar' : 'en';
    const v = ttsVoice(lang); if (lang === 'ar' && !v) { toast(_T('ما فيه صوت عربي على جهازك. تقدر تضيفه من إعدادات اللغة والكلام في الجهاز')); return; }
    const txt = lang === 'en' ? sayPrep(text) : String(text || ''); if (!txt) return;
    TTS.q = sayChunks(txt); TTS.btn = btn || null; if (btn) btn.classList.add('on');
    const short = txt.length < 30;
    const next = () => { const s = TTS.q.shift(); if (s == null) { if (TTS.btn) TTS.btn.classList.remove('on'); TTS.btn = null; return; }
      const u = new SpeechSynthesisUtterance(s); u.lang = lang === 'en' ? 'en-US' : 'ar-SA'; if (v) u.voice = v; u.rate = lang === 'en' ? (short ? 0.82 : 0.92) : 0.95;
      u.onend = () => { if (TTS.btn === btn || !btn) next(); }; u.onerror = () => { TTS.q = []; next(); }; speechSynthesis.speak(u); };
    next();
  }
  // زر نطق: data-say = النص، data-lang = en/ar، أو data-say-sel = عنصر نقرأ نصه (مثل القطعة)
  const sayBtn = (text, lang, label, cls) => `<button type="button" class="${label ? 'sayb' : 'say'} ${cls || ''}" data-say="${esc(text)}" data-lang="${lang || 'en'}" title="${lang === 'ar' ? _T('استمع للترجمة') : _T('استمع للنطق')}" aria-label="${label || (lang === 'ar' ? _T('استمع للترجمة') : _T('استمع للنطق'))}">${SAYSVG}${label ? `<span>${label}</span>` : ''}</button>`;
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
  const FD_STOP_AR = new Set('من في على الى عن مع ثم او هو هي ما ماذا كم اي اذا التي الذي الذين هذا هذه ذلك تلك كان كانت قيمه اوجد احسب العدد عدد فان لكل كل بين عند'.split(' '));   // i18n:skip
  function fdNorm(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/[−–—]/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
      .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');   // i18n:skip
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
    if (e[1]) L.push(e[0] === 'p' ? _T`القطعة في ${SET_NAME(e[1])}${e[6] ? ' · ' + esc(e[6]) : ''}` : _T`${e[0] === 'q' ? _T('الكمي') : _T('اللفظي')} · ${SET_NAME(e[1])} · سؤال ${e[2] + 1}${e[6] ? _T(' · قطعة ') + `<bdi dir="ltr">${esc(e[6])}</bdi>` : ''}`);
    e[7].slice(0, 3).forEach(t => L.push(_T`الاختبار المحاكي ${t[0]} · القسم ${t[1]} · سؤال ${t[2]}`));
    if (e[7].length > 3) L.push(_T`+ ${e[7].length - 3} اختبارات محاكية ثانية`);
    return L.map((t, i) => `<span class="fd-loc${i ? '' : ' main'}">${t}</span>`).join('');
  };
  function fdPreview(e) {
    if (e[0] === 'p') return `<div class="fd-pv ltr"><p class="fd-pt">${esc(e[3].slice(0, 420))}${e[3].length > 420 ? '…' : ''}</p></div>`;
    const opts = e[4].length ? `<ol class="fd-o">${e[4].map((o, j) => `<li><span class="L">${LETTERS[j]}</span><span>${e[0] === 'q' ? mx(o) : esc(o)}</span></li>`).join('')}</ol>` : '';
    return `<div class="fd-pv ltr" data-img="${e[0] === 'q' && e[1] ? e[1] + ':' + e[2] : ''}"><p>${e[0] === 'q' ? mx(e[3]) : esc(e[3])}</p>${opts}</div>`;
  }
  const fdOpen = e => e[1] ? _T`<a class="btn" href="#${e[1]}@${e[2]}">افتح السؤال</a>` : '';
  const fdQn = n => EN ? enN(n, 'question', 'questions') : n === 1 ? 'سؤال واحد' : n === 2 ? 'سؤالين' : n <= 10 ? n + ' أسئلة' : n + ' سؤالاً';   // i18n:skip
  const fdTests = n => EN ? (n === 1 ? 'a mock test' : n + ' mock tests') : n === 1 ? 'اختبار محاكي' : n === 2 ? 'اختبارين محاكيين' : n <= 10 ? n + ' اختبارات محاكية' : n + ' اختباراً محاكياً';   // i18n:skip
  function fdItem(e, exact) {   // سطر مختصر في قائمة «أسئلة مشابهة»: الموقع + بداية السؤال + الخيارات، ويفتح السؤال بضغطة
    const main = e[0] === 'p' ? _T`القطعة في ${SET_NAME(e[1])}` : _T`${e[0] === 'q' ? _T('الكمي') : _T('اللفظي')} · ${SET_NAME(e[1])} · سؤال ${e[2] + 1}`;
    const head = `<span class="fd-it-h"><span class="fd-loc${e[1] ? ' main' : ''}">${e[1] ? main : _T('الاختبار المحاكي ') + (e[7][0] || [])[0]}</span>${e[7].length && e[1] ? _T`<small>وفي ${fdTests(e[7].length)}</small>` : ''}${e[6] ? `<small class="ltr">${esc(e[6])}</small>` : ''}${exact ? _T('<span class="fd-ex">✓ مطابق لكلامك</span>') : ''}</span>`;
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
  const fdMainP = p => p[1] ? (p[0] === 'p' ? _T`القطعة في ${SET_NAME(p[1])}` : _T`${p[0] === 'q' ? _T('الكمي') : _T('اللفظي')} · ${SET_NAME(p[1])} · سؤال ${p[2] + 1}`) : _T`الاختبار المحاكي ${(p[3][0] || [])[0]} · القسم ${(p[3][0] || [])[1]} · سؤال ${(p[3][0] || [])[2]}`;
  const fdLocP = p => {
    const L = []; if (p[1]) L.push(fdMainP(p));
    p[3].slice(0, 3).forEach(t => L.push(_T`الاختبار المحاكي ${t[0]} · القسم ${t[1]} · سؤال ${t[2]}`));
    if (p[3].length > 3) L.push(_T`+ ${p[3].length - 3} اختبارات محاكية ثانية`);
    return L.map((t, i) => `<span class="fd-loc${i ? '' : ' main'}">${t}</span>`).join('');
  };
  const fdActP = p => fdIsFreeP(p) ? _T`<a class="btn" href="#${p[1]}@${p[2]}">افتح السؤال (مجاني)</a>` : p[3].some(t => t[0] === 1) ? _T`<a class="btn" href="/test/">افتح الاختبار المحاكي 1 (مجاني)</a>` : _T`<button type="button" class="btn gold" data-sub>🔒 اشترك عشان تحله وتشوف الشرح</button>`;
  function fdItemP(p, exact) {
    const free = fdIsFreeP(p);
    const body = `<span class="fd-it-h"><span class="fd-loc main">${fdMainP(p)}</span>${p[3].length && p[1] ? _T`<small>وفي ${fdTests(p[3].length)}</small>` : ''}${exact ? _T('<span class="fd-ex">✓ مطابق لكلامك</span>') : ''}<span class="fd-lk${free ? ' fr' : ''}">${free ? _T('مجاني') : _T('🔒 للمشتركين')}</span></span>`;
    return free ? `<a class="fd-it" href="#${p[1]}@${p[2]}">${body}</a>` : `<button type="button" class="fd-it" data-sub>${body}</button>`;
  }
  async function fdRunPub(R, q, kind, full, img) {
    let ix; try { ix = await fdLoadPub(); } catch (e) { R.innerHTML = _T`<div class="fd-res tip"><p>تعذّر تحميل البحث. تأكد من الإنترنت وحاول مرة ثانية.</p></div>`; return; }
    if (!$('#fdr')) return;
    const res = fdPubSearch(ix, q, kind, 6), top = res[0], E = ix.P, p = top && E[top.i], sc = top ? top.s : 0;
    const lock = _T`<p class="fd-lkn">🔒 نص السؤال وحله وشرحه للمشتركين في الدورة.</p>`;
    if (window.QGT) QGT.ev('find', full && p && sc >= FDP_HI ? 'لقاه في الدورة' : full && p && sc >= FDP_MID ? 'لقى سؤال قريب' : full ? 'ما لقاه في الدورة' : 'بحث بكلمات', img ? 1 : 0);
    if (full && p && sc >= FDP_HI) {
      const same = res.slice(1).filter(r => r.s >= FDP_HI && sc - r.s < 0.03).map(r => E[r.i]);   // نفس السؤال في مكان ثاني
      R.innerHTML = _T`<div class="fd-res ok"><div class="fd-h"><span class="ic">✓</span><div><b>السؤال موجود في الدورة</b><small>تلقاه هنا:</small></div></div>
        <div class="fd-locs">${fdLocP(p)}${same.map(fdLocP).join('')}</div>${fdIsFreeP(p) ? '' : lock}<div class="fd-acts">${fdActP(p)}</div></div>`;
    } else if (full && p && sc >= FDP_MID) {
      R.innerHTML = _T`<div class="fd-res mid"><div class="fd-h"><span class="ic">🔎</span><div><b>لقينا سؤال قريب جداً</b><small>يمكن يكون نفسه بأرقام أو خيارات ثانية:</small></div></div>
        <div class="fd-locs">${fdLocP(p)}</div>${fdIsFreeP(p) ? '' : lock}<div class="fd-acts">${fdActP(p)}</div>${fsRepBox(_T('تبي نتأكد لك؟ بلّغنا عنه:'), 0, 1)}</div>`;
    } else if (full) {
      const near = res.filter(r => r.s >= 0.5).map(r => E[r.i]).slice(0, 5);
      R.innerHTML = _T`<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا هذا السؤال في الدورة</b><small>بلّغ عنه عشان نراجعه.</small></div></div>
        ${fsRepBox('')}${near.length ? _T`<div class="fd-near"><h4>أسئلة قريبة منه في الدورة</h4><div class="fd-list">${near.map(x => fdItemP(x)).join('')}</div></div>` : ''}</div>`;
    } else {
      const seen = new Set(), list = [], exact = new Set(res.filter(r => r.s >= FDP_HI).map(r => r.i));
      res.filter(r => r.s >= FDP_MID).concat(fdPubKeyword(ix, q, kind, 40)).forEach(r => { if (!seen.has(r.i)) { seen.add(r.i); list.push(r.i); } });
      let shown = 10; const show = () => { const box = $('#fdl'); if (!box) return; box.innerHTML = list.slice(0, shown).map(i => fdItemP(E[i], exact.has(i))).join(''); bindSub(box); const mb = $('#fdmore'); if (mb) mb.hidden = shown >= list.length; };
      R.innerHTML = list.length ? _T`<div class="fd-res sim"><div class="fd-h"><span class="ic">🔎</span><div><b>أسئلة في الدورة فيها كلامك</b><small>لقينا ${list.length >= 40 ? _T('أكثر من 40 سؤالاً') : fdQn(list.length)}${list.length > 10 ? _T('، هذي أقربها') : ''}. نص الأسئلة وحلها للمشتركين، وهنا تشوف وين تلقاها.</small></div></div>
          <div class="fd-list" id="fdl"></div><button type="button" class="btn ghost fd-more" id="fdmore">عرض أسئلة أكثر</button>
          ${fsRepBox(_T('ما لقيت سؤالك؟ اكتبه كامل أو صوّره، أو بلّغنا عنه:'), 1)}</div>`
        : _T`<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا أسئلة فيها هالكلام</b><small>جرّب كلمات ثانية، أو اكتب السؤال كامل، أو بلّغ عنه.</small></div></div>${fsRepBox('', 1)}</div>`;
      show(); const mb = $('#fdmore'); if (mb) mb.onclick = () => { shown += 10; show(); };
    }
    bindSub(R); fsRep(R, { text: q });
    R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
  }
  // ---------- 🔎 البحث الذكي على الخادم: يقارن سؤالك بكل أسئلة الدورة (والصورة تنقرى هناك) ----------
  // يقول وين السؤال بالضبط، أو إنه نفسه بصياغة/ترتيب/خيارات/أرقام مختلفة، أو سؤال جديد. لو الخادم ما رد نرجع للبحث المحلي.
  const FS = {
    exact: ['ok', '✓', _T('السؤال موجود في الدورة بالضبط'), _T('تلقاه هنا:')],
    reorder: ['ok', '✓', _T('السؤال موجود في الدورة'), _T('نفس السؤال، بس ترتيب الخيارات مختلف. تلقاه هنا:')],
    wording: ['ok', '✓', _T('السؤال موجود في الدورة'), _T('نفس الأرقام والخيارات بصياغة مختلفة شوي. تلقاه هنا:')],
    opts_same: ['mid', '≈', _T('نفس السؤال بخيارات مختلفة'), _T('والإجابة الصحيحة موجودة بين خياراتك. تلقاه هنا:')],
    opts_diff: ['mid', '≈', _T('نفس السؤال، بس الخيارات مختلفة'), _T('وإجابة سؤال الدورة مو من خياراتك، فتأكد من الخيارات. تلقاه هنا:')],
    numbers: ['mid', '≈', _T('نفس فكرة السؤال بأرقام مختلفة'), _T('نفس طريقة الحل، بس الإجابة غالباً غير. تلقاه هنا:')],
    new: ['no', '✕', _T('سؤال جديد، ما هو موجود في الدورة'), _T('بلّغ عنه عشان نراجعه.')] };
  const FS_EV = { exact: 'لقاه في الدورة', reorder: 'لقاه في الدورة', wording: 'لقاه في الدورة', opts_same: 'لقى سؤال قريب', opts_diff: 'لقى سؤال قريب', numbers: 'لقى سؤال قريب', new: 'ما لقاه في الدورة' };   // i18n:skip (إحصائيات المالك بالعربي)
  const fsLoc = r => { let m = String(r).match(/^([qv])(\d+):(\d+)$/); if (m) return { set: m[1] + m[2], i: +m[3], t: _T`${m[1] === 'q' ? _T('الكمي') : _T('اللفظي')} · ${SET_NAME(m[1] + m[2])} · سؤال ${+m[3] + 1}` };
    m = String(r).match(/^t(\d+):(\d+):(\d+)$/); return m ? { test: +m[1], t: _T`الاختبار المحاكي ${m[1]} · القسم ${m[2]} · سؤال ${+m[3] + 1}` } : { t: esc(r) }; };
  const fsLocs = refs => { const L = refs.map(fsLoc); return L.slice(0, 4).map((l, i) => `<span class="fd-loc${i ? '' : ' main'}">${l.t}</span>`).join('') + (L.length > 4 ? `<span class="fd-loc">+ ${L.length - 4} ${EN ? (L.length - 4 === 1 ? 'more place' : 'more places') : L.length - 4 === 1 ? 'مكان ثاني' : 'أماكن ثانية'}</span>` : ''); };   // i18n:skip
  const fsMore = n => EN ? (n === 1 ? 'and 1 other place' : `and ${n} other places`) : n === 1 ? 'وفي مكان ثاني' : n === 2 ? 'وفي مكانين ثانيين' : n <= 10 ? `وفي ${n} أماكن ثانية` : `وفي ${n} مكاناً ثانياً`;   // i18n:skip
  const fsFreeLoc = it => it.refs.map(fsLoc).find(x => x.set && FREE_SETS.indexOf(x.set) >= 0);
  const fsTxt = (it, s) => it.s === 'q' ? mx(s) : esc(s);
  function fsOpen(it, ghost) {
    const c = ghost ? 'btn ghost' : 'btn', L = it.refs.map(fsLoc);
    if (isFree()) {
      const f = fsFreeLoc(it); if (f) return _T`<a class="${c}" href="#${f.set}@${f.i}">افتح السؤال (مجاني)</a>`;
      if (it.refs.some(r => /^t1:/.test(r))) return _T`<a class="${c}" href="/test/">افتح الاختبار المحاكي 1 (مجاني)</a>`;
      return _T`<button type="button" class="btn gold" data-sub>🔒 اشترك عشان تحله وتشوف الشرح</button>`;
    }
    const l = L.find(x => x.set); if (l) return _T`<a class="${c}" href="#${l.set}@${l.i}">افتح السؤال</a>`;
    const t = L.find(x => x.test); return t ? _T`<a class="${c}" href="/test/">افتح الاختبار المحاكي ${t.test}</a>` : '';
  }
  function fsPreview(it) { const l = it.refs.map(fsLoc).find(x => x.set); return fdPreview([it.s, l ? l.set : '', l ? l.i : -1, it.e || it.a || '', it.o || []]); }
  function fsDiff(r, it) {   // وش الفرق بين سؤالك وسؤال الدورة
    const d = it.d || {}, q = r.q, rows = [], nums = a => a.map(x => `<bdi dir="ltr">${esc(x)}</bdi>`).join(_T('، '));
    if (r.status === 'numbers') {
      if (d.extra && d.miss) rows.push(['🔢', _T`في سؤالك <b>${nums(d.extra)}</b>، وفي سؤال الدورة <b>${nums(d.miss)}</b>`]);
      else if (d.extra) rows.push(['🔢', _T`في سؤالك أرقام مو موجودة في سؤال الدورة: <b>${nums(d.extra)}</b>`]);
      else if (d.miss) rows.push(['🔢', _T`سؤال الدورة فيه أرقام مو موجودة في سؤالك: <b>${nums(d.miss)}</b>`]);
      if (d.ops) rows.push(['➗', _T('فيه إشارة أو عملية مختلفة في المعادلة (مثل + بدل ×، أو سالب بدل موجب)')]);
    } else if (d.miss && !d.extra) rows.push(['🖼️', _T`سؤال الدورة فيه أرقام ما ذكرتها: <b>${nums(d.miss)}</b> (غالباً في الرسم)`]);
    if (d.swap) rows.push(['⇄', _T('القيمة A والقيمة B مبدّلة بين سؤالك وسؤال الدورة، فانتبه للإجابة')]);
    if (d.qx && d.qx.length && /^opts_/.test(r.status)) rows.push(['🔤', _T`${d.qx.length === 1 ? _T('خيار في سؤالك مو موجود') : _T('خيارات في سؤالك مو موجودة')} في سؤال الدورة: ${d.qx.map(i => `<b><bdi dir="ltr">${LETTERS[i]}) ${fsTxt(it, q.opts[i] || '')}</bdi></b>`).join(_T('، '))}`]);
    return rows.length ? `<ul class="fd-diff">${rows.map(x => `<li><span aria-hidden="true">${x[0]}</span><p>${x[1]}</p></li>`).join('')}</ul>` : '';
  }
  function fsAns(r, it) {   // الإجابة (مخفية لين يضغط)
    const a = fsAnsLine(r, it);
    return a ? _T`<div class="fd-ans"><button type="button" class="btn ghost sm" data-ans aria-expanded="false">👁️ اعرض الإجابة</button><p hidden>${a}</p></div>` : '';
  }
  function fsAnsLine(r, it) {   // سطر الإجابة الصحيحة — بحرف سؤاله هو لو نقدر
    if (it.k == null || !it.o || !it.o.length) return '';
    const d = it.d || {}, q = r.q, same = /^(exact|reorder|wording|opts_same)$/.test(r.status);
    let a;
    if (same && d.ansAt >= 0 && (q.opts[d.ansAt] || it.o[d.ansAt]) != null) {
      const o = q.opts[d.ansAt] && !/^\s*[a-d]\s*$/i.test(q.opts[d.ansAt]) ? q.opts[d.ansAt] : it.o[d.ansAt];   // خيارات المقارنة المختصرة (A / B) نعرضها بنص الدورة
      a = _T`الإجابة الصحيحة في سؤالك: <b><bdi dir="ltr">${LETTERS[d.ansAt]}) ${fsTxt(it, o)}</bdi></b>${d.ansAt !== it.k && !d.swap ? _T` <small>(في الدورة حرفها ${LETTERS[it.k]})</small>` : ''}`;
    } else a = `${r.status === 'numbers' ? _T('إجابة سؤال الدورة (بأرقامه هو)') : _T('إجابة سؤال الدورة')}: <b><bdi dir="ltr">${LETTERS[it.k]}) ${fsTxt(it, it.o[it.k])}</bdi></b>${r.status === 'opts_diff' ? _T(' — ومو موجودة بين خياراتك') : ''}`;
    return a;
  }
  function fsItem(it) {   // سطر في «أسئلة قريبة»
    const L = it.refs.map(fsLoc), l = L.find(x => x.set), more = it.refs.length > 1 ? `<small>${fsMore(it.refs.length - 1)}</small>` : '';
    if (isFree()) {
      const f = fsFreeLoc(it), body = `<span class="fd-it-h"><span class="fd-loc main">${L[0].t}</span>${more}<span class="fd-lk${f ? ' fr' : ''}">${f ? _T('مجاني') : _T('🔒 للمشتركين')}</span></span>`;
      return f ? `<a class="fd-it" href="#${f.set}@${f.i}">${body}</a>` : `<button type="button" class="fd-it" data-sub>${body}</button>`;
    }
    const body = `<span class="fd-it-h"><span class="fd-loc main">${L[0].t}</span>${more}</span><span class="fd-it-q ltr">${fsTxt(it, it.e || it.a || '')}</span>${(it.o || []).length ? `<span class="fd-it-o ltr">${it.o.map((o, j) => `<b>${LETTERS[j]}</b> ${fsTxt(it, o)}`).join('<i>·</i>')}</span>` : ''}`;
    return l ? `<a class="fd-it" href="#${l.set}@${l.i}">${body}</a>` : `<div class="fd-it">${body}</div>`;
  }
  function fdImgs(R) {   // صورة سؤال الكمي من ملف القسم (نفس الصورة اللي يشوفها في الدورة)
    R.querySelectorAll('.fd-pv[data-img]').forEach(async el => { const [sid, i] = (el.dataset.img || '').split(':'); if (!sid || el.classList.contains('has-img')) return;
      try { const set = await loadSet(sid), it = set.items[+i]; if (it && it.img && el.isConnected) { el.classList.add('has-img'); el.insertAdjacentHTML('afterbegin', _T`<img src="${it.img}" width="${it.w}" height="${it.h}" alt="السؤال">`); } } catch (x) {} });
  }
  // 🚩 بلاغ بدل الواتساب في كل نتائج البحث: زر ← ملاحظة للمعلم (اختياري) ← إرسال — يوصل للمالك في سجل البحث مع سؤال الطالب (وصورته)
  // base = { id: رقم البحث في الخادم }، أو { text: نص الطالب } لما البحث صار على جهازه (كلمات، أو الخادم ما رد)
  let fdRepCtx = () => ({});   // صفحة البحث تحدده: نوع السؤال، وإن النص من صورة، وصورته لو ما وصلت الخادم
  const fsRepBtn = (lead, gh) => _T`<div class="fd-acts">${lead ? `<span class="fd-or">${lead}</span>` : ''}<button type="button" class="btn${gh ? ' ghost' : ''}" data-rep>🚩 بلّغ عن السؤال</button></div>`;
  const fsRepBox = (lead, kw, gh) => `<div class="fd-rep${lead ? ' fd-wa' : ''}" data-lead="${esc(lead || '')}"${kw ? ' data-kw="1"' : ''}${gh ? ' data-gh="1"' : ''}>${fsRepBtn(lead, gh)}</div>`;   // gh = زر ثانوي (لما فيه «افتح السؤال»)
  function fsRep(R, base) {
    R.querySelectorAll('.fd-rep').forEach(box => {
      const lead = box.dataset.lead || '', ph = box.dataset.kw ? _T('مثلاً: اكتب السؤال كامل، أو وين شفته') : _T('مثلاً: جاني في الاختبار، أو لقيته في ملف تجميعات');
      const bind = () => { box.querySelector('[data-rep]').onclick = start; };
      const start = () => {
        box.innerHTML = _T`<label class="fd-l" for="fdrn">ملاحظة للمعلم (اختياري)</label><textarea id="fdrn" class="fd-rn" dir="auto" rows="2" maxlength="300" placeholder="${ph}"></textarea>
          <div class="fd-acts"><button type="button" class="btn" data-send>إرسال البلاغ</button><button type="button" class="btn ghost" data-x>إلغاء</button></div>`;
        const ta = box.querySelector('textarea'), send = box.querySelector('[data-send]'); ta.focus();
        box.querySelector('[data-x]').onclick = () => { box.innerHTML = fsRepBtn(lead, box.dataset.gh); bind(); box.querySelector('[data-rep]').focus(); };
        send.onclick = async () => {
          send.disabled = true; send.textContent = _T('نرسل البلاغ…');
          const r = await api(Object.assign({ op: 'find_report', session: auth.session, note: ta.value }, fdRepCtx(), base)).catch(() => null);
          if (r && r.ok) { box.innerHTML = _T('<p class="fd-repok" role="status">✓ وصلنا بلاغك، وبنراجع السؤال. شكراً لك!</p>'); if (window.QGT) QGT.ev('find', 'بلّغ عن سؤال'); return; }
          if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
          toast((r && r.msg) || _T('تعذّر إرسال البلاغ، جرّب مرة ثانية.')); send.disabled = false; send.textContent = _T('إرسال البلاغ');
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
      if (free) h += fsFreeLoc(it) ? '' : _T`<p class="fd-lkn">🔒 نص السؤال وحله وشرحه للمشتركين في الدورة.</p>`;
      else h += fsPreview(it) + fsAns(r, it);
      h += `<div class="fd-acts">${fsOpen(it)}</div>`;
      if (r.alts && r.alts.length) h += `<div class="fd-alt"><h4>${r.alts.length > 1 ? _T('أو يمكن يكون واحد من هذي:') : _T('أو يمكن يكون هذا:')}</h4>${r.alts.map(a => `<div class="fd-ai"><div class="fd-locs">${fsLocs(a.refs)}</div>${free ? '' : fsPreview(a)}<div class="fd-acts">${fsOpen(a, true)}</div></div>`).join('')}</div>`;
      if (S[0] !== 'ok') h += fsRepBox(_T('تبي نتأكد لك؟ بلّغنا عنه:'), 0, 1);
    } else h += fsRepBox('');   // 🚩 ما لقيناه: بلاغ يوصل للمالك في سجل البحث
    if (r.similar && r.similar.length) h += `<div class="fd-near"><h4>${it ? _T('أسئلة قريبة منه في الدورة') : _T('أقرب الأسئلة له في الدورة — يمكن تفيدك')}</h4><div class="fd-list">${r.similar.map(fsItem).join('')}</div></div>`;
    R.innerHTML = h + '</div>';
    bindSub(R); fdImgs(R); fsRep(R, r.lid ? { id: r.lid } : { text: q });
    R.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const p = b.nextElementSibling; p.hidden = !p.hidden; b.setAttribute('aria-expanded', !p.hidden); b.textContent = p.hidden ? _T('👁️ اعرض الإجابة') : _T('🙈 اخفِ الإجابة'); });
    R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
  }
  async function fsImgData(file) {   // نصغّر الصورة (أطول ضلع 1600) ونرسلها JPEG
    if (typeof createImageBitmap !== 'function') return file.size < 3.2e6 ? await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); }) : null;
    const bmp = await createImageBitmap(file), m = Math.max(bmp.width, bmp.height), sc = m > 1600 ? 1600 / m : 1;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  }
  // ---------- 🙋 مساعد Q-Guide العام (زر «تحتاج مساعدة؟» في assets/ai.js): يدوّر سؤال الطالب (نص أو صورة) في الدورة ويرجّع بطاقة النتيجة ----------
  // موجود (بالضبط، أو بترتيب/صياغة/خيارات مختلفة والإجابة بينها) → الشرح يبدأ على طول · قريب (أرقام أو خيارات مختلفة) → زر «اشرح لي طريقة الحل» · جديد → بلاغ + أقرب الأسئلة
  const HELP_AUTO = /^(exact|reorder|wording|opts_same)$/, HELP_REF = /^(?:[qv]\d{1,2}:\d{1,3}|t\d{1,2}:[1-4]:\d{1,2})$/, HELP_FREE = /^(q1|v1|t1):/;
  function helpCard(r) {
    const it = r.best, free = isFree();
    if (!it) {   // مو في الدورة: المساعد يحلّه بنفسه، ومعه بلاغ للمعلم وأقرب الأسئلة (مطوية)
      const near = r.similar && r.similar.length ? _T`<details class="fd-near"><summary>أقرب الأسئلة له في الدورة</summary><div class="fd-list">${r.similar.slice(0, 3).map(fsItem).join('')}</div></details>` : '';
      return { nf: 1, html: `<div class="fd-res no">${fsRepBox('')}${near}</div>`, bind: el => { el.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => QGAI.close(true))); bindSub(el); fsRep(el, r.lid ? { id: r.lid } : { text: r.text || '' }); } };
    }
    const S = FS[r.status] || FS.new;
    let h = `<div class="fd-res ${S[0]}"><div class="fd-h"><span class="ic" aria-hidden="true">${S[1]}</span><div><b>${S[2]}</b><small>${S[3]}</small></div></div>`, ref = '', label = '';
    if (it) {
      label = (it.refs.map(fsLoc)[0] || {}).t || '';
      h += `<div class="fd-locs">${fsLocs(it.refs)}</div>${fsDiff(r, it)}`;
      if (free) h += fsFreeLoc(it) ? '' : _T`<p class="fd-lkn">🔒 حله وشرحه للمشتركين في الدورة.</p>`;
      else { const a = fsAnsLine(r, it); h += (a ? `<p class="qgh-ans">${a}</p>` : '') + _T`<details class="qgh-pv"><summary>سؤال الدورة</summary>${fsPreview(it)}</details>`; }
      h += `<div class="fd-acts">${fsOpen(it, true)}</div>`;
      ref = (free ? it.refs.find(x => HELP_FREE.test(x)) : it.refs.find(x => /^[qv]\d/.test(x)) || it.refs[0]) || '';
      if (!HELP_REF.test(ref)) ref = '';
      if (S[0] !== 'ok') h += fsRepBox(_T('مو نفس سؤالك؟ بلّغنا عنه:'), 0, 1);
    } else {
      h += fsRepBox('');
      if (r.similar && r.similar.length) h += `<div class="fd-near"><h4>${_T('أقرب الأسئلة له في الدورة — يمكن تفيدك')}</h4><div class="fd-list">${r.similar.slice(0, 3).map(fsItem).join('')}</div></div>`;
    }
    return { html: h + '</div>', ref, label, auto: !!ref && HELP_AUTO.test(r.status),
      bind: el => { el.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => QGAI.close(true))); bindSub(el); fdImgs(el); fdRepCtx = () => ({}); fsRep(el, r.lid ? { id: r.lid } : { text: r.text || '' });
        el.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => QGAI.close())); } };
  }
  async function helpFind(p) {   // p = { text } أو { file }
    const body = { op: 'find', session: auth.session };
    if (p.file) { let d = null; try { d = await fsImgData(p.file); } catch (e) {} if (!d) return { ok: false, msg: _T('تعذّرت قراءة الصورة. جرّب صورة ثانية أو اكتب السؤال.') }; body.img = d; }
    else body.text = p.text;
    const r = await api(body).catch(() => null);
    if (!r) return { ok: false, retry: 1, msg: _T('تعذّر الاتصال، تأكد من النت وحاول مرة ثانية.') };
    if (r.error === 'kicked' || r.error === 'session') { setTimeout(() => { QGAI.close(); logout(esc(r.msg || '')); }, 1800); return { ok: false, msg: r.msg || '' }; }
    if (!r.ok) return { ok: false, retry: /^(busy|vision)$/.test(r.error || '') ? 1 : 0, msg: r.msg || _T('صار خطأ، حاول مرة ثانية.') };
    if (!p.file) r.text = p.text;
    if (window.QGT) QGT.ev('find', FS_EV[r.status] || 'ما لقاه في الدورة', p.file ? 1 : 0);
    return { ok: true, text: p.file ? r.text || '' : '', card: helpCard(r) };
  }
  // الزر العائم يطلع في الصفحات العامة بس (مو داخل حل الأسئلة، ولا الساحة، ولا صفحات المشرفين، ولا صفحة البحث نفسها)
  const helpOn = h => h != null && (h === '' || /^(sharh|sharh-abdullah|level|notes|badges|plan|skills)$/.test(h) || /^rules(-v)?(\/|$)/.test(h) || /^vocab/.test(h) || (/^board/.test(h) && h !== 'board-arena'));
  // 👤 ملف الطالب للمساعد (من جهازه): اختباره، سلسلته، أضعف مواضيعه، مهمة اليوم من خطته، وأنسب مكان يكمل فيه
  function helpProfile() {
    const P = { name: firstName(auth && (auth.display || auth.name)), free: isFree(), examIn: null, streak: 0, weak: [], task: '', next: '', nextId: '' };
    try {
      const ex = examGet(), exT = ex ? examAt(ex) : 0; if (exT) P.examIn = dayDiff(Date.now(), exT);
      P.streak = streakOf(daysGet());
      const agg = histAgg(histGet());
      P.weak = TOPIC_ORDER.map(t => ({ k: t, n: agg[t].w + agg[t].r, p: agg[t].w + agg[t].r ? Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r)) : 0 })).filter(r => r.n >= 8).sort((a, b) => a.p - b.p).slice(0, 2).map(r => ({ k: r.k, t: TOPICS[r.k].t, i: TOPICS[r.k].i, p: r.p }));
      const st = planState(), plan = PLANS.find(p => p.id === st.id);
      if (plan) { const I = planInfo(plan, st); if (I.cur) P.task = [...new Set(I.cur.tasks.map(t => t.set ? SET_NAME(t.set) : t.k === 'rest' ? _T('يوم راحة') : _T('مراجعة أخطائك')))].join(EN ? ' and ' : ' و'); }
      if (manifest) { const r = pickResume(); P.next = SET_NAME(r.s.id); P.nextId = r.s.id; }
    } catch (e) {}
    return P;
  }
  // 🔗 روابط المساعد: {{q3}} {{v5}} {{t2}} {{rules:circles}} {{t-geo}} {{plan}}… → زر ينقل الطالب للصفحة
  const HELP_PAGES = { rules: ['📐', _T('ملخص القوانين'), '#rules'], 'rules-v': ['📖', _T('قواعد اللفظي'), '#rules-v'], skills: ['🎯', _T('مهاراتي'), '#skills'], plan: ['📅', _T('خطة المذاكرة'), '#plan'], level: ['🧭', _T('تحديد المستوى'), '#level'],
    vocab: ['🃏', _T('بطاقات المفردات'), '#vocab'], 'wb-q': ['📘', _T('مذكرة الكمي'), '#wb-q'], 'wb-v': ['📗', _T('مذكرة اللفظي'), '#wb-v'], 'wb-tq': ['🧱', _T('تأسيس الكمي'), '#wb-tq'], 'wb-tv': ['🧱', _T('تأسيس اللفظي'), '#wb-tv'], sharh: ['🎬', _T('الشرح والمدرسين'), '#sharh'], arena: ['⚔️', _T('الساحة 1v1'), '#arena'], find: ['🔎', _T('ابحث عن سؤال'), '#find'], notes: ['📝', _T('ملاحظاتي'), '#notes'],
    't-wrong-q': ['🔁', _T('أعد حل أخطائك (كمي)'), '#t-wrong-q'], 't-wrong-v': ['🔁', _T('أعد حل أخطائك (لفظي)'), '#t-wrong-v'] };
  function helpLink(tok) {
    if (!RULES_ON && /^rules/.test(tok)) return '';   // ملخص القوانين/القواعد انشال: الرمز ينشال من الرد
    let m; const a = (ic, t, h) => `<a class="qgai-lk" href="${h}"><span aria-hidden="true">${ic}</span>${t}</a>`;
    if (HELP_PAGES[tok]) return a(...HELP_PAGES[tok]);
    if ((m = /^([qv])(\d{1,2})$/.exec(tok)) && +m[2] >= 1 && +m[2] <= (m[1] === 'v' ? 15 : 14)) return a(m[1] === 'q' ? '📘' : '📗', SET_NAME(tok), '#' + tok);
    if ((m = /^t(\d{1,2})$/.exec(tok)) && +m[1] >= 1 && +m[1] <= 17) return a('🧪', _T`الاختبار المحاكي ${m[1]}`, '/test/');
    if ((m = /^t-([a-z]+)$/.exec(tok)) && TOPICS[m[1]]) return a(TOPICS[m[1]].i, _T`تدريب: ${TOPICS[m[1]].t}`, '#' + tok);
    if ((m = /^rules:([a-z]+)$/.exec(tok))) { const s = (RU_DATA.q || []).find(x => x.id === m[1]) || RU_SEC[m[1]]; return s ? a(s.icon || '📐', _T`القوانين: ${s.t}`, '#rules/' + m[1]) : a('📐', _T('ملخص القوانين'), '#rules'); }
    return '';
  }
  const RU_SEC = { fractions: { icon: '➗', t: _T('الكسور') }, percent: { icon: '💯', t: _T('النسبة المئوية') }, ratio: { icon: '⚖️', t: _T('النسبة والتناسب') }, exponents: { icon: '√', t: _T('الأسس والجذور') }, algebra: { icon: '🔤', t: _T('الجبر') }, numbers: { icon: '🔢', t: _T('خصائص الأعداد') }, sequences: { icon: '🔁', t: _T('المتتابعات والأنماط') }, statistics: { icon: '📊', t: _T('الإحصاء') }, probability: { icon: '🎲', t: _T('الاحتمالات والعد') }, angles: { icon: '📐', t: _T('الزوايا والمستقيمات') }, triangles: { icon: '🔺', t: _T('المثلثات') }, quadrilaterals: { icon: '🟦', t: _T('الأشكال الرباعية والمضلعات') }, circles: { icon: '⭕', t: _T('الدائرة') }, solids: { icon: '🧊', t: _T('المجسمات') }, coordinates: { icon: '📈', t: _T('الهندسة الإحداثية') }, speed: { icon: '🚗', t: _T('السرعة والزمن والعمل') }, clock: { icon: '🕒', t: _T('الساعة والتقويم') }, ages: { icon: '🎂', t: _T('الأعمار') }, money: { icon: '💰', t: _T('المال والحسابات اليومية') }, comparison: { icon: '🆚', t: _T('المقارنات الكمية') }, units: { icon: '📏', t: _T('الوحدات والتحويلات') } };
  async function renderFind() {
    document.title = _T('ابحث عن سؤال | Q-Guide');
    let kind = lsGet('qg_find_k', 'q'), usedImg = false, ocrTxt = '', imgData = '', imgLid = 0;   // imgLid = رقم بحث الصورة في الخادم (صورته محفوظة هناك)
    fdRepCtx = () => ({ kind, ocr: usedImg ? 1 : undefined, fr: usedImg && imgLid ? imgLid : undefined, img: usedImg && !imgLid && imgData ? imgData : undefined });
    app.innerHTML = topbar(_T`<span class="ttl">🔎 ابحث عن سؤال</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap fd">
      <div class="fd-top"><h1>ابحث عن سؤال</h1><p>شفت سؤال وتبي تعرف إذا هو في الدورة؟ اكتبه أو ارفع صورته، ونقولك وين تلقاه بالضبط، أو إذا هو نفسه بأرقام أو خيارات مختلفة، أو سؤال جديد.${isFree() ? _T(' حله وشرحه للمشتركين.') : ''}</p></div>
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
      st.innerHTML = '<span class="spin sm"></span> ' + (lsGet('qg_ocr_ok', 0) ? _T('نقرأ الصورة على جهازك…') : _T('نجهّز قارئ الصور على جهازك (حوالي 5 ميجا) ثم نقرأ الصورة…'));
      try { const t = (await fdOcrRun(await fdPrep(f))).replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim(); if (t.replace(/[^A-Za-z0-9ء-ي]/g, '').length >= 12) { lsSet('qg_ocr_ok', 1); return t; } } catch (e) {}
      return '';
    }
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      usedImg = true; pv.hidden = false; pv.className = 'fd-img busy'; $('#fdth').src = URL.createObjectURL(f); go.disabled = true;
      st.innerHTML = _T('<span class="spin sm"></span> نقرأ السؤال من الصورة…');
      R.innerHTML = _T`<div class="fd-res wait"><span class="spin sm"></span> نقرأ الصورة ونقارنها بكل أسئلة الدورة…</div>`;
      try {
        let data = null; try { data = await fsImgData(f); } catch (e) {}
        imgData = data || ''; imgLid = 0;
        const r = data ? await call({ img: data }) : null;
        if (r && r.ok) { imgLid = r.lid || 0; ta.value = ocrTxt = r.text || ''; pv.className = 'fd-img ok'; st.textContent = _T('✓ قرينا السؤال من الصورة — لو فيه خطأ صحّحه فوق واضغط ابحث'); fsShow(R, r, ocrTxt, true, kind); return; }
        if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
        if (r && r.error === 'noq') { pv.className = 'fd-img bad'; st.textContent = r.msg; R.innerHTML = ''; return; }
        const why = r && r.error === 'limit' ? r.msg : '';
        const t = await localOcr(f);
        if (!t) { pv.className = 'fd-img bad'; st.textContent = why || _T('تعذّرت قراءة الصورة الحين. جرّب صورة أوضح أو اكتب السؤال.'); R.innerHTML = ''; return; }
        ta.value = ocrTxt = t; pv.className = 'fd-img ok'; st.textContent = (why ? why + ' ' : '') + _T('✓ قرينا النص على جهازك — صحّحه فوق إذا فيه خطأ'); run(true);
      } finally { go.disabled = false; inp.value = ''; }
    };
    async function run(fromImg) {
      const q = ta.value.trim(), T = fdToks(q), words = T.en.filter(w => w[0] !== '_').length + T.ar.length, full = words >= 6 || q.length >= 60;
      if (!words && T.nu.length < 2) { R.innerHTML = _T`<div class="fd-res tip"><p>اكتب كلمة أو أكثر من السؤال (مثل <bdi dir="ltr">probability</bdi> أو <bdi dir="ltr">circle area</bdi>)، أو السؤال كامل.</p></div>`; ta.focus(); return; }
      R.innerHTML = _T`<div class="fd-res wait"><span class="spin sm"></span> نقارن سؤالك بكل أسئلة الدورة…</div>`;
      if (full) {   // سؤال كامل: محرك المقارنة على الخادم (ocr = النص من صورته، عشان المالك يشوف الصورة معه في السجل)
        const r = await call({ text: q, ocr: usedImg ? 1 : undefined, fr: usedImg && imgLid ? imgLid : undefined });
        if (r && r.ok) return fsShow(R, r, q, usedImg || fromImg, kind);
        if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || ''));
      }
      if (isFree()) return fdRunPub(R, q, kind, full, usedImg);   // 🆓 الزائر: المكان فقط
      let ix; try { ix = await fdLoad(); } catch (e) { R.innerHTML = _T`<div class="fd-res tip"><p>تعذّر تحميل البحث. تأكد من الإنترنت وحاول مرة ثانية.</p></div>`; return; }
      if (!$('#fdr')) return;
      const res = fdSearch(ix, q, kind, 4), top = res[0], E = ix.entries;
      const e = top && E[top.i], sc = top ? top.s : 0;
      const same = e ? res.filter(r => r.s >= FD_HI && E[r.i] !== e && E[r.i][3] === e[3]).map(r => E[r.i]) : [];   // نفس السؤال مكرر في قسم ثاني
      const alts = e ? res.slice(1).filter(r => r.s >= Math.max(FD_MID, sc - 0.06) && E[r.i][3] !== e[3]).map(r => E[r.i]).slice(0, 2) : [];   // أسئلة متقاربة جداً بنفس الدرجة
      const altHtml = alts.length ? _T`<div class="fd-alt"><h4>أو يمكن يكون ${alts.length > 1 ? _T('واحد من هذي') : _T('هذا')}:</h4>${alts.map(x => `<div class="fd-ai"><div class="fd-locs">${fdLoc(x)}</div>${fdPreview(x)}<div class="fd-acts">${fdOpen(x).replace('class="btn"', 'class="btn ghost"')}</div></div>`).join('')}</div>` : '';
      if (full && e && sc >= FD_HI) {
        R.innerHTML = _T`<div class="fd-res ok"><div class="fd-h"><span class="ic">✓</span><div><b>السؤال موجود في الدورة</b><small>تلقاه هنا:</small></div></div>
          <div class="fd-locs">${fdLoc(e)}${same.map(fdLoc).join('')}</div>${fdPreview(e)}<div class="fd-acts">${fdOpen(e)}</div>${altHtml}</div>`;
      } else if (full && e && sc >= FD_MID) {
        R.innerHTML = _T`<div class="fd-res mid"><div class="fd-h"><span class="ic">🔎</span><div><b>لقينا سؤال قريب جداً</b><small>قارنه بسؤالك وتأكد إنه نفسه:</small></div></div>
          <div class="fd-locs">${fdLoc(e)}</div>${fdPreview(e)}<div class="fd-acts">${fdOpen(e)}</div>${altHtml}${fsRepBox(_T('مو نفسه؟ بلّغنا عنه:'), 0, 1)}</div>`;
      } else if (full) {   // سؤال كامل ما لقيناه: واتساب + أقرب الأسئلة عندنا
        const near = fdSearch(ix, q, kind, 6).filter(r => r.s >= 0.5).map(r => E[r.i]).slice(0, 5);
        R.innerHTML = _T`<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا هذا السؤال في الدورة</b><small>بلّغ عنه عشان نراجعه.</small></div></div>
          ${fsRepBox('')}${near.length ? _T`<div class="fd-near"><h4>أسئلة مشابهة عندنا — يمكن تفيدك</h4><div class="fd-list">${near.map(fdItem).join('')}</div></div>` : ''}</div>`;
      } else {   // كلام بسيط: أسئلة فيها نفس الكلمات (والمطابق تماماً أولها)
        const seen = new Set(), list = [], exact = new Set(res.filter(r => r.s >= FD_HI).map(r => r.i));
        res.filter(r => r.s >= FD_MID).concat(fdKeyword(ix, q, kind, 40)).forEach(r => { if (!seen.has(r.i)) { seen.add(r.i); list.push(r.i); } });
        let shown = 10; const show = () => { const box = $('#fdl'); if (!box) return; box.innerHTML = list.slice(0, shown).map(i => fdItem(E[i], exact.has(i))).join(''); const mb = $('#fdmore'); if (mb) mb.hidden = shown >= list.length; };
        R.innerHTML = list.length ? _T`<div class="fd-res sim"><div class="fd-h"><span class="ic">🔎</span><div><b>أسئلة مشابهة لكلامك</b><small>لقينا ${list.length >= 40 ? _T('أكثر من 40 سؤالاً') : fdQn(list.length)}${list.length > 10 ? _T('، هذي أقربها') : ''} — ${list.length === 1 ? _T('اضغط عليه تفتحه') : _T('اضغط أي سؤال تفتحه')}</small></div></div>
            <div class="fd-list" id="fdl"></div><button type="button" class="btn ghost fd-more" id="fdmore">عرض أسئلة أكثر</button>
            ${fsRepBox(_T('ما لقيت سؤالك؟ اكتبه كامل أو صوّره، أو بلّغنا عنه:'), 1)}</div>`
          : _T`<div class="fd-res no"><div class="fd-h"><span class="ic">✕</span><div><b>ما لقينا أسئلة فيها هالكلام</b><small>جرّب كلمات ثانية، أو اكتب السؤال كامل، أو بلّغ عنه.</small></div></div>${fsRepBox('', 1)}</div>`;
        show(); const mb = $('#fdmore'); if (mb) mb.onclick = () => { shown += 10; show(); };
      }
      fdImgs(R); fsRep(R, { text: q });
      R.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  // ---------- 📐 قوانين الكمي · 📘 قواعد اللفظي (من أسئلة الدورة) ----------
  // 🗑 انشالوا من الموقع بطلب المالك (نوفمبر 2026): RULES_ON = false يقفل الصفحتين وكل روابطهما (الرئيسية، المساعد، «راجع القاعدة»، الخطة).
  // الكود والبيانات باقية هنا مقفلة — لا ترجعها إلا بطلبه.
  const RULES_V = 4, RULES_ON = false, RU_DATA = {};
  // 📐 أي قاعدة تناسب السؤال؟ الكمي من خريطة p/data/rulemap.json (مرجع السؤال → قسم في ملخص القوانين؛ تُبنى في مستودع الـ API بـ tools/rulemap.mjs
  // وتترك السؤال بدون قاعدة لو ما كانت واضحة)، واللفظي من نوع السؤال نفسه (تناظر/إكمال/خطأ/استيعاب)
  const RMAP_V = 1; let RMAP = null, rmapP = null;
  function ruleMapLoad() { if (RMAP) return Promise.resolve(RMAP); if (rmapP) return rmapP; rmapP = fetch('/p/data/rulemap.json?v=' + RMAP_V, { cache: 'force-cache' }).then(r => r.json()).then(j => (RMAP = j)).catch(() => (RMAP = {})); return rmapP; }
  function ruleFor(it, i) {
    if (!RULES_ON || !P || isFree()) return null;
    const src = it.src || P.id, idx = it.sidx != null ? it.sidx : i;
    if (P.set.kind === 'verbal') { const t = it.topic; return t && TOPICS[t] && TOPICS[t].k === 'verbal' ? { href: '#rules-v/' + t, icon: TOPICS[t].i, t: TOPICS[t].t } : null; }
    const id = RMAP && /^q\d{1,2}$/.test(src) ? RMAP[src + ':' + idx] : '', s = id && RU_SEC[id];
    return s ? { href: '#rules/' + id, icon: s.icon, t: s.t } : null;
  }
  // ⏱ وقت السؤال مقارنة بوقت قياس (دقيقة تقريباً لكل سؤال): سريع · ضمن الوقت · أبطأ
  function paceOf(ms) { if (!(ms > 0) || ms >= Q_CAP) return null; const s = ms / 1000; return { s, k: s <= 40 ? 'fast' : s <= 75 ? 'ok' : 'slow', t: s <= 40 ? _T('سريع') : s <= 75 ? _T('ضمن وقت الاختبار') : _T('أبطأ من وقت الاختبار') }; }
  // شريط بعد الإجابة: وقتك في السؤال + القاعدة اللي تراجعها (بعد الإجابة الخاطئة)
  function fbMeta(it, a) {
    const p = paceOf(a.ms), r = a.s !== it.ans ? ruleFor(it, P.cur) : null; if (!p && !r) return '';
    return `<div class="fb-meta">${r ? _T`<a class="fb-r" href="${r.href}"><span aria-hidden="true">${r.icon}</span>راجع القاعدة: <b>${esc(r.t)}</b><span class="go" aria-hidden="true">${EN ? '→' : '←'}</span></a>` : ''}${p ? _T`<span class="fb-t ${p.k}" title="في قياس عندك تقريباً دقيقة لكل سؤال"><span aria-hidden="true">⏱</span><b dir="ltr">${fmtDur(p.s)}</b>${p.t}</span>` : ''}</div>`;
  }
  const RU_CFG = {
    q: { hash: '#rules', ttl: _T('📐 قوانين الكمي'), h1: _T('قوانين الكمي'), file: 'rules.json?v=' + RULES_V,
      ph: _T('ابحث عن قانون: مساحة، نسبة، زاوية، area…'), none: _T('ما لقينا قانون بهالكلمة. جرّب كلمة ثانية بالعربي أو الإنجليزي.'),
      intro: n => _T`${n} قانون وقاعدة تحتاجها أسئلة الدورة، مرتبة حسب الموضوع. تحت كل قانون مثال محلول وسؤال تدريبي تحل فيه بنفسك. تقدر تطبعها أو تحفظها PDF من زر 🖨️.` },
    v: { hash: '#rules-v', ttl: _T('📘 قواعد اللفظي'), h1: _T('قواعد اللفظي'), file: 'rules_v.json?v=1',
      ph: _T('ابحث: سبب ونتيجة، although، main idea…'), none: _T('ما لقينا قاعدة بهالكلمة. جرّب كلمة ثانية بالعربي أو الإنجليزي.'),
      intro: () => _T('طريقة الحل في كل نوع من أسئلة اللفظي، وأنواع العلاقات والقرائن والأسئلة اللي تكررت في أسئلة الدورة. تحت كل نوع مثال محلول وسؤال تدريبي تحل فيه بنفسك. تقدر تطبعها أو تحفظها PDF من زر 🖨️.') } };
  async function renderRules(kind, goTo) {
    kind = kind === 'v' ? 'v' : 'q'; const C = RU_CFG[kind], VB = kind === 'v';
    document.title = C.h1 + ' | Q-Guide';
    const back = _T`<a class="ib" href="#" title="الرئيسية">→</a>`;
    if (!RU_DATA[kind]) { app.innerHTML = topbar(`<span class="ttl">${C.ttl}</span>`, back) + '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; bindCtl();
      try { RU_DATA[kind] = await (await fetch('/p/data/' + C.file)).json(); } catch (e) { app.innerHTML = topbar('', back) + _T('<div class="center">تعذّر التحميل. <a href="#">رجوع</a></div>'); return; } }
    if (location.hash !== C.hash + (goTo ? '/' + goTo : '')) return;
    const D = RU_DATA[kind], nItems = D.reduce((a, s) => a + s.items.length, 0);
    const tx = VB ? esc : mx;   // اللفظي نص إنجليزي عادي، والكمي نرسم كسوره وأسسه
    app.innerHTML = topbar(_T`<span class="ttl">${C.ttl}</span><span class="sp"></span><button class="ib" id="prn" title="طباعة / حفظ PDF">🖨️</button>`, back) + _T`<main class="wrap rules${VB ? ' rules-v' : ''}">
      <div class="ru-top"><div><h1>${C.h1}</h1><p>${C.intro(nItems)}</p></div></div>
      <div class="ru-bar"><input id="ruq" type="search" placeholder="${C.ph}" autocomplete="off"><span class="mut" id="run"></span></div>
      <nav class="ru-nav" aria-label="المواضيع">${D.map(s => `<a href="${C.hash}" data-go="${s.id}">${s.icon} ${esc(s.t)}</a>`).join('')}</nav>
      <div class="ru-cols" id="ruc">${D.map((s, si) => `<section class="ru-s" id="ru-${s.id}"><h2><span class="ic" aria-hidden="true">${s.icon}</span>${esc(s.t)}<small dir="ltr">${esc(s.en || '')}</small></h2>${s.how ? _T`<div class="ru-how"><h3>طريقة الحل</h3><ol>${s.how.map(t => `<li>${arFx(t)}</li>`).join('')}</ol></div>` : ''}${s.sub ? `<h3 class="ru-sub">${esc(s.sub)}</h3>` : ''}<div class="ru-g">
        ${s.items.map((x, ii) => `<div class="ru-i" data-s="${si}" data-i="${ii}" data-k="${esc((x.a + ' ' + x.f + ' ' + (x.en || '') + ' ' + (x.n || '') + ' ' + (VB ? (x.x || '') + ' ' : '') + s.t + ' ' + (s.en || '')).toLowerCase())}"><div class="ru-a">${esc(x.a)}${x.en ? `<small dir="ltr">${esc(x.en)}</small>` : ''}</div><div class="ru-f${VB ? ' v' : ''}" dir="ltr">${tx(x.f)}</div>${x.x ? `<div class="ru-x" dir="ltr"><span class="eg">e.g.</span> ${tx(x.x)}</div>` : ''}${x.n ? `<div class="ru-n">${arFx(x.n)}</div>` : ''}${x.q ? _T`<div class="ru-qb"><button type="button" class="ru-b" data-m="ex" aria-expanded="false">مثال محلول</button><button type="button" class="ru-b" data-m="pr" aria-expanded="false">سؤال تدريبي</button></div><div class="ru-p" hidden></div>` : ''}</div>`).join('')}</div></section>`).join('')}</div>
      <p class="mut ru-empty" id="rue" hidden>${C.none}</p></main>`;
    bindCtl();
    $('#prn').onclick = () => window.print();
    document.querySelectorAll('.ru-nav a').forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById('ru-' + a.dataset.go); if (el) el.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); });
    if (goTo) { const el = document.getElementById('ru-' + goTo); if (el) { requestAnimationFrame(() => { el.scrollIntoView({ behavior: 'auto', block: 'start' }); el.classList.add('ru-hi'); setTimeout(() => el.classList.remove('ru-hi'), 2600); }); } }
    // مثال محلول / سؤال تدريبي تحت كل قانون (تنبني عند الفتح فقط)
    // سؤال المقارنة: «Quantity A / Quantity B» في عمودين مثل الاختبار
    const ruQ = t => { if (VB) return `<div class="ru-qq" dir="ltr">${esc(t)}</div>`;
      const L = String(t).split('\n'), A = L.find(x => /^Quantity A:/.test(x)), B = L.find(x => /^Quantity B:/.test(x));
      if (!A || !B) return `<div class="ru-qq" dir="ltr">${mx(t)}</div>`;
      const rest = L.filter(x => x !== A && x !== B).join('\n').trim(), v = x => mx(x.replace(/^Quantity [AB]:\s*/, ''));
      return `${rest ? `<div class="ru-qq" dir="ltr">${mx(rest)}</div>` : ''}<div class="ru-cmp" dir="ltr"><div><small>A</small><span>${v(A)}</span></div><div><small>B</small><span>${v(B)}</span></div></div>`; };
    const ruEx = e => _T`${ruQ(e.q)}<div class="ru-h">الحل</div><ol class="ru-st${e.s.length < 2 ? ' one' : ''}">${e.s.map(t => `<li>${arFx(t)}</li>`).join('')}</ol><div class="ru-ans"><span>الجواب</span><b dir="ltr">${tx(e.a)}</b></div>`;
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
        fb.innerHTML = `<b>${ok ? _T('✓ إجابة صحيحة') : _T`✗ الإجابة الصحيحة ${LETTERS[pr.k]}`}</b><p>${arFx(pr.e)}</p>`;
      }
    };
    const q = $('#ruq'), cnt = $('#run'), paint = () => { const v = q.value.trim().toLowerCase(); let n = 0;
      document.querySelectorAll('.ru-s').forEach(s => { let k = 0; s.querySelectorAll('.ru-i').forEach(i => { const on = !v || i.dataset.k.indexOf(v) >= 0; i.hidden = !on; if (on) k++; }); s.hidden = !k; n += k;
        s.querySelectorAll('.ru-how,.ru-sub').forEach(x => x.hidden = !!v); });   // وقت البحث نعرض النتائج بس
      cnt.textContent = v ? (EN ? enN(n, 'result', 'results') : n + ' نتيجة') : '';   // i18n:skip
       $('#rue').hidden = n > 0; };
    q.oninput = paint;
  }

  // ---------- 🔔 التذكير اليومي (إشعارات الجوال) ----------
  const REM_LS = 'qg_rem';
  const remSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const remGet = () => lsGet(REM_LS, null);
  const fmtMins = m => fmtTime(new Date(2000, 0, 1, Math.floor(m / 60), m % 60).getTime());
  function remLabel() { const r = remGet(); return r && r.on ? _T`مفعّل كل يوم الساعة ${fmtMins(r.mins)}` : _T('تنبيه يومي على جوالك بوقت مذاكرتك'); }
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
      let task = ''; if (plan) { const I = planInfo(plan, st); if (I.cur) task = [...new Set(I.cur.tasks.map(t => t.set ? SET_NAME(t.set) : t.k === 'rest' ? _T('يوم راحة') : _T('مراجعة أخطائك')))].join(EN ? ' and ' : ' و'); }
      let next = ''; try { if (manifest) next = SET_NAME(pickResume().s.id); } catch (e) {}
      const c = { name: firstName(auth && (auth.display || auth.name)), streak: streakOf(D), last: keys[keys.length - 1] || '', exam: ex ? examAt(ex) : 0, task, next, at: Date.now(), lang: EN ? 'en' : 'ar' };
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
        if (!remSupported() && isIOS() && !isStandalone()) body = _T`<p>على الآيفون، التنبيهات تشتغل لما تضيف المنصة للشاشة الرئيسية:</p>
          <ol class="rem-ios"><li>افتح المنصة من متصفح <b>Safari</b></li><li>اضغط زر المشاركة <span class="ios-share" aria-hidden="true">⬆︎</span> تحت</li><li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>افتح Q-Guide من الأيقونة الجديدة، وسجّل دخولك، ثم فعّل التذكير من هنا</li></ol><p class="mut">يحتاج iOS 16.4 أو أحدث.</p>`;
        else if (!remSupported()) body = _T`<p>متصفحك الحالي ما يدعم التنبيهات. جرّب من Google Chrome على الجوال أو الكمبيوتر.</p>`;
        else if (perm === 'denied') body = _T`<p>التنبيهات مقفلة لهذا الموقع في متصفحك. افتح إعدادات الموقع (🔒 جنب الرابط فوق) ← <b>الإشعارات</b> ${EN ? '→' : '←'} <b>السماح</b>، ثم ارجع هنا وفعّل التذكير.</p>`;
        else body = _T`<p>نرسل لك تنبيه كل يوم بالوقت اللي تختاره، فيه مهمتك من الخطة وكم باقي على اختبارك. <b>وإذا ذاكرت قبل الموعد ما نزعجك.</b></p>
          <div class="exf rem-f"><label><span>وقت التذكير</span><input type="time" id="remt" value="${p2(Math.floor(mins / 60))}:${p2(mins % 60)}" dir="ltr" step="300"></label><div class="rem-st ${on ? 'on' : ''}">${on ? _T('🔔 مفعّل') : _T('🔕 غير مفعّل')}</div></div>
          <div class="acts"><button class="btn" id="remon">${on ? _T('حفظ الوقت') : _T('فعّل التذكير')}</button>${on ? _T('<button class="btn ghost" id="remtest">أرسل تنبيه تجريبي</button><span class="sp"></span><button class="lnk" id="remoff">إيقاف التذكير</button>') : _T('<button class="btn ghost" id="remno">إلغاء</button>')}</div>`;
        box.innerHTML = _T`<div class="m exm rem" role="dialog" aria-modal="true" aria-labelledby="remh"><h3 id="remh">🔔 التذكير اليومي</h3>${body}${body.indexOf('id="remon"') < 0 ? _T('<div class="acts"><button class="btn" id="remno">تمام</button></div>') : ''}</div>`;
        const no = $('#remno'); if (no) no.onclick = close;
        const ob = $('#remon'); if (ob) ob.onclick = async () => {
          const v = ($('#remt').value || '20:00').split(':'), m = (+v[0] || 0) * 60 + (+v[1] || 0);
          ob.disabled = true; ob.textContent = _T('جارٍ التفعيل…');
          try { await remSubscribe(m); toast(_T`🔔 تم! بنذكّرك كل يوم الساعة ${fmtMins(m)}`); draw(); }
          catch (e) { ob.disabled = false; ob.textContent = _T('فعّل التذكير'); toast(e.message === 'denied' ? _T('رفضت التنبيهات من المتصفح') : e.message === 'dismissed' ? _T('لازم توافق على التنبيهات عشان يشتغل التذكير') : _T('تعذّر التفعيل، حاول مرة ثانية')); if (e.message === 'denied') draw(); }
        };
        const tb = $('#remtest'); if (tb) tb.onclick = async () => { tb.disabled = true; remCtx(true); try { const r2 = await api({ op: 'push_test', session: auth.session, endpoint: (remGet() || {}).ep }); toast(r2.ok ? _T('أرسلنا تنبيه تجريبي، بيوصلك خلال ثواني') : (r2.msg || _T('تعذّر الإرسال'))); if (r2.error === 'gone' || r2.error === 'not subscribed') { lsSet(REM_LS, { on: 0, mins: (remGet() || {}).mins || 1200 }); draw(); } } catch (e) { toast(_T('تعذّر الإرسال')); } tb.disabled = false; };
        const fb = $('#remoff'); if (fb) fb.onclick = async () => { await remOff(); toast(_T('أوقفنا التذكير اليومي')); draw(); };
      };
      draw();
    });
  }

  // i18n:off — صفحات المشرفين تبقى عربي (ما تنلف بـ _T)
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

  // i18n:on
  // ---------- 🧭 اختبار تحديد المستوى ----------
  const LVL_LS = 'qg_level', LVLRUN_LS = 'qg_level_run';
  const LEVELS = { 1: { t: _T('مبتدئ'), d: _T('تحتاج تبني الأساس: ابدأ بمقاطع القواعد وخطة طويلة، وخذ الأقسام بالترتيب بدون استعجال.') }, 2: { t: _T('متوسط'), d: _T('عندك أساس كويس، والتدريب المنتظم على نقاط ضعفك يرفع مستواك بسرعة.') }, 3: { t: _T('جيد'), d: _T('مستواك جيد! ركّز على أخطائك والأسئلة اللي تاخذ وقت عشان توصل للتسعين.') }, 4: { t: _T('متقدم'), d: _T('ممتاز! حافظ على مستواك بالاختبارات المحاكية ومراجعة أخطائك أول بأول.') } };
  const lvlOf = p => p >= 85 ? 4 : p >= 65 ? 3 : p >= 45 ? 2 : 1;
  const LVPLAN = { 1: 'relaxed', 2: 'balanced', 3: 'intense', 4: 'strong' };
  let LV = null;   // حالة الاختبار الجاري
  async function renderLevel(mode) {
    document.title = _T('تحديد المستوى | Q-Guide'); document.onkeydown = null;
    const back = _T`<a class="ib" href="#" title="الرئيسية">→</a>`;
    app.innerHTML = topbar(_T`<span class="ttl">🧭 تحديد المستوى</span>`, back) + _T('<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span>تجهيز الأسئلة…</span></div>');
    bindCtl();
    let set; try { set = await loadSet('placement'); } catch (e) { app.innerHTML = topbar('', back) + _T('<div class="center">تعذّر تحميل الاختبار. <a href="#">رجوع</a></div>'); return; }
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
    app.innerHTML = topbar(_T`<span class="ttl">🧭 تحديد المستوى</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap lvl">
      <div class="lv-in"><span class="lv-ic" aria-hidden="true">🧭</span><h1>اعرف مستواك قبل لا تبدأ</h1>
        <p>${set.items.length} سؤال من نفس أسئلة الدورة (${nv} لفظي + ${nq} كمي) تغطي كل المهارات. بعدها نعطيك مستواك، ونقاط قوتك وضعفك، والخطة اللي تناسبك.</p>
        <ul class="lv-f"><li><b>⏱ حوالي 20 دقيقة</b><span>خذ وقتك، ما فيه مؤقت يقفل عليك</span></li><li><b>🙈 بدون شرح أثناء الحل</b><span>الإجابات والشرح تطلع لك بعد ما تخلص</span></li><li><b>↺ تقدر تعيده</b><span>بعد ما تذاكر، عشان تشوف كم تحسّنت</span></li></ul>
        <button class="btn gold lv-go" id="lvgo">${res ? _T('أعد الاختبار') : _T('ابدأ الاختبار')}</button>
        ${res ? _T`<p class="lv-prev">نتيجتك السابقة: <b>${res.pct}%</b> (${LEVELS[res.lvl].t}) · ${fmtDay(res.at)} · <a href="#" id="lvres">شوف التفاصيل</a></p>` : ''}</div></main>`;
    bindCtl();
    $('#lvgo').onclick = () => { lsSet(LVLRUN_LS, { a: {}, t0: Date.now(), cur: 0 }); renderLevel('run'); };
    const r = $('#lvres'); if (r) r.onclick = e => { e.preventDefault(); levelResult(set, res); };
  }
  function levelQ(i) {
    const { set } = LV, items = set.items, it = items[i], n = items.length; LV.cur = i;
    lsSet(LVLRUN_LS, { a: LV.a, t0: LV.t0, cur: i });
    const sec = it.k === 'q' ? _T('الكمي') : _T('اللفظي · ') + (TOPICS[it.topic] || {}).t;
    const sel = LV.a[i];
    let body = '';
    if (it.type === 'read') body += _T`<details class="lv-pass" ${i === 0 || items[i - 1].type !== 'read' ? 'open' : ''}><summary>📄 القطعة: ${esc(it.ptitle || '')}</summary><div class="pb ltr">${esc(it.passage)}</div></details>`;
    body += it.k === 'q' ? _T`<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${i + 1}">` : `<p class="txt ltr">${esc(it.q)}</p>`;
    const two = it.k === 'q' || it.opts.every(o => o.length <= 28);
    body += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => `<button class="opt ${sel === k ? 'sel' : ''}" data-k="${k}"><span class="L">${LETTERS[k]}</span><span>${esc(it.k === 'q' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></button>`).join('') + '</div>';
    const done = Object.keys(LV.a).length;
    app.innerHTML = topbar(_T`<span class="ttl">🧭 تحديد المستوى</span><span class="sp"></span><span class="chip lv-t" id="lvt" dir="ltr">0:00</span><span class="chip cnt" dir="ltr">${i + 1} / ${n}</span>`, _T`<a class="ib" href="#" title="خروج (يتحفظ وين وقفت)">→</a>`) +
      _T`<div class="sbar" style="--n:${n}" aria-hidden="true">${items.map((x, k) => `<i class="${LV.a[k] != null ? 'ans' : ''}${k === i ? ' cur' : ''}"></i>`).join('')}</div>
      <main class="wrap lvl"><div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>من ${n}</small></span><span class="tag">${sec}</span></div>${body}
        <div class="acts"><button class="btn ghost sm" id="lvp" ${i === 0 ? 'disabled' : ''}>→ السابق</button><span class="sp"></span><span class="mut lv-c">جاوبت ${done} من ${n}</span>
          ${i + 1 < n ? `<button class="btn" id="lvn">${sel != null ? _T('التالي ←') : _T('تخطَّ ←')}</button>` : _T`<button class="btn gold" id="lvf">إنهاء الاختبار ✓</button>`}</div></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    const tick = () => { const el = $('#lvt'); if (!el) return; el.textContent = fmtDur(Math.round((Date.now() - LV.t0) / 1000)); };
    tick(); clearInterval(LV.tm); LV.tm = setInterval(tick, 1000);
    document.querySelectorAll('.lvl .opt').forEach(b => b.onclick = () => { LV.a[i] = +b.dataset.k; lsSet(LVLRUN_LS, { a: LV.a, t0: LV.t0, cur: i }); document.querySelectorAll('.lvl .opt').forEach(x => x.classList.toggle('sel', x === b)); const nb = $('#lvn'); if (nb) nb.textContent = _T('التالي ←'); const c = $('.lv-c'); if (c) c.textContent = _T`جاوبت ${Object.keys(LV.a).length} من ${n}`; const s = $('.sbar') && $('.sbar').children[i]; if (s) s.classList.add('ans'); });
    $('#lvp').onclick = () => levelQ(i - 1);
    const nb = $('#lvn'); if (nb) nb.onclick = () => levelQ(i + 1);
    const fb = $('#lvf'); if (fb) fb.onclick = async () => { const un = n - Object.keys(LV.a).length; if (un && !await QGDlg.confirm(_T`باقي ${un} سؤال بدون إجابة وتنحسب خطأ. تنهي الاختبار؟`, { ok: _T('إنهاء') })) return; levelFinish(); };
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
    app.innerHTML = topbar(_T`<span class="ttl">🧭 نتيجة تحديد المستوى</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap lvl">
      <div class="sum lv-res"><div class="ring" id="ring" style="--p:${fresh ? 0 : res.pct}"><b><span id="rp">${fresh ? 0 : res.pct}</span><small>%</small></b></div>
        <span class="lv-badge l${res.lvl}">مستواك: ${L.t}</span><p class="lv-d">${L.d}</p>
        <div class="lv-split"><div><span>📖 اللفظي</span><b>${res.v[0]}<small>/${res.v[1]}</small></b><div class="bar"><i style="width:${Math.round(res.v[0] * 100 / res.v[1])}%"></i></div></div><div><span>📐 الكمي</span><b>${res.q[0]}<small>/${res.q[1]}</small></b><div class="bar"><i style="width:${Math.round(res.q[0] * 100 / res.q[1])}%"></i></div></div><div><span>⏱ الوقت</span><b class="ltr">${fmtDur(res.secs)}</b></div></div></div>
      <div class="lv-grid">
        <section class="lv-card"><h3>المهارات</h3>${tp.map(x => `<div class="lv-tp ${x.ok === x.n ? 'ok' : x.ok === 0 ? 'bad' : 'mid'}"><span>${TOPICS[x.t].i} ${TOPICS[x.t].t}</span><b>${x.ok}/${x.n}</b></div>`).join('')}</section>
        ${isFree() ? _T`<section class="lv-card lv-sub"><h3>ابدأ من هنا</h3>
          ${weak.length ? _T`<p>أضعف مهاراتك: <b>${weak.map(x => TOPICS[x.t].t).join(_T('، '))}</b>.</p>` : _T('<p>جاوبت كل المهارات صح 👏</p>')}
          <p class="mut">في الدورة تتدرب على كل مهارة بأسئلة من الأقسام كلها، وتمشي على ${rec.name} (${rec.days} يوماً) اللي تناسب مستواك.</p>
          <button class="btn gold" data-sub>اشترك وابدأ خطتك</button></section>` : _T`<section class="lv-card"><h3>ابدأ من هنا</h3>
          ${weak.length ? _T`<p class="mut">أضعف مهاراتك في هذا الاختبار، تدرّب عليها بأسئلة من كل الأقسام:</p><div class="lv-tr">${weak.map(x => `<a class="btn sm ghost" href="#t-${x.t}">${TOPICS[x.t].i} ${TOPICS[x.t].t}</a>`).join('')}</div>` : _T('<p class="mut">جاوبت كل المهارات صح 👏 كمّل على الاختبارات المحاكية.</p>')}
          <div class="lv-plan"><span>الخطة المقترحة${exT > Date.now() ? _T(' لموعد اختبارك') : _T(' لمستواك')}:</span><b>${rec.name} <small>(${rec.days} يوماً · ${rec.daily})</small></b>
            ${cur ? (cur.id === rec.id ? _T('<span class="fit ok">✓ هي نفس خطتك الحالية</span>') : _T`<span class="mut">خطتك الحالية: ${cur.name}</span> <a href="#plan">غيّرها من صفحة الخطة</a>`) : _T`<button class="btn gold sm" id="lvplan">ابدأ ${rec.name}</button>`}</div></section>`}</div>
      <div class="acts lv-acts"><button class="btn" id="lvrev">مراجعة إجاباتك مع الشرح</button><a class="btn ghost" href="#">الرئيسية</a><button class="lnk2" id="lvagain">↻ أعد الاختبار</button></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    if (fresh) { const rp = $('#rp'), ring = $('#ring'); if (RM()) { rp.textContent = res.pct; ring.style.setProperty('--p', res.pct); } else { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 900), v = Math.round(res.pct * (1 - Math.pow(1 - k, 3))); rp.textContent = v; ring.style.setProperty('--p', v); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } if (res.pct >= 85 && !RM()) setTimeout(confetti, 600); }
    const pb = $('#lvplan'); if (pb) pb.onclick = () => { planStart(rec.id); location.hash = 'plan'; };
    $('#lvrev').onclick = () => levelReview(set, res); bindSub(app);
    $('#lvagain').onclick = () => { lsSet(LVLRUN_LS, { a: {}, t0: Date.now(), cur: 0 }); renderLevel('run'); };
  }
  function levelReview(set, res) {
    app.innerHTML = topbar(_T`<span class="ttl">🧭 مراجعة إجاباتك</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap lvl lv-rv">
      <p class="mut">الأخضر الإجابة الصحيحة، والأحمر إجابتك لو كانت خطأ. كل سؤال معه شرحه.</p>
      ${set.items.map((it, i) => { const a = res.a[i], ok = a === it.ans; return _T`<div class="q"><div class="hd"><span class="n">سؤال ${i + 1}<small>${it.k === 'q' ? _T('الكمي') : (TOPICS[it.topic] || {}).t}</small></span><span class="tag ${ok ? 'ok' : 'bad'}">${ok ? _T('✓ صح') : a == null ? _T('— ما جاوبت') : _T('✗ خطأ')}</span></div>
        ${it.type === 'read' ? _T`<details class="lv-pass"><summary>📄 القطعة: ${esc(it.ptitle || '')}</summary><div class="pb ltr">${esc(it.passage)}</div></details>` : ''}
        ${it.k === 'q' ? `<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="">` : `<p class="txt ltr">${esc(it.q)}</p>`}
        <div class="opts ${it.k === 'q' || it.opts.every(o => o.length <= 28) ? 'two' : ''}">${it.opts.map((o, k) => `<div class="opt ${k === it.ans ? 'ok' : k === a ? 'bad' : ''}"><span class="L">${LETTERS[k]}</span><span>${esc(it.k === 'q' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></div>`).join('')}</div>
        ${it.exp ? _T`<div class="fb ${ok ? 'ok' : 'bad'}"><div class="exl">الشرح</div><div class="ex">${fmtExp(it.exp)}</div></div>` : ''}</div>`; }).join('')}
      <div class="acts lv-acts"><a class="btn" href="#">الرئيسية</a><button class="btn ghost" id="lvback">↩ النتيجة</button></div></main>`;
    bindCtl(); window.scrollTo({ top: 0 });
    $('#lvback').onclick = () => levelResult(set, res);
  }

  // ---------- 🏅 الشارات (تنحسب من نشاط الطالب على جهازه وتتزامن مع حسابه) ----------
  const BADGE_LS = 'qg_badges';
  const BADGES = [
    { id: 'first', i: '✏️', t: _T('البداية'), d: _T('جاوبت أول سؤال'), v: S => S.total, n: 1, u: _T('سؤال'), uk: 'q' },
    { id: 'q100', i: '💯', t: _T('100 سؤال'), d: _T('حليت 100 سؤال'), v: S => S.total, n: 100, u: _T('سؤال'), uk: 'q' },
    { id: 'q500', i: '🚀', t: _T('500 سؤال'), d: _T('حليت 500 سؤال'), v: S => S.total, n: 500, u: _T('سؤال'), uk: 'q' },
    { id: 'q1000', i: '🏔️', t: _T('1000 سؤال'), d: _T('حليت 1000 سؤال'), v: S => S.total, n: 1000, u: _T('سؤال'), uk: 'q' },
    { id: 'sheet1', i: '📄', t: _T('أول ورقة'), d: _T('خلّصت أول قسم أو نموذج كامل'), v: S => S.sheets, n: 1, u: _T('ورقة'), uk: 'p' },
    { id: 'sheet5', i: '📚', t: _T('5 أوراق'), d: _T('خلّصت 5 أقسام أو نماذج'), v: S => S.sheets, n: 5, u: _T('ورقة'), uk: 'p' },
    { id: 'allq', i: '📐', t: _T('بطل الكمي'), d: _T('خلّصت أقسام الكمي الـ14 كلها'), v: S => S.qdone, n: 14, u: _T('قسم'), uk: 's' },
    { id: 'allv', i: '📖', t: _T('بطل اللفظي'), d: _T('خلّصت نماذج اللفظي الـ14 كلها'), v: S => S.vdone, n: 14, u: _T('نموذج'), uk: 'm' },
    { id: 'p90', i: '🎯', t: _T('فوق الـ90'), d: _T('خلّصت قسم بنسبة 90% أو أكثر'), v: S => S.best, n: 90, pct: 1 },
    { id: 'p100', i: '👑', t: _T('العلامة الكاملة'), d: _T('جبت 100% في قسم كامل'), v: S => S.best, n: 100, pct: 1 },
    { id: 'st3', i: '🔥', t: _T('3 أيام ورا بعض'), d: _T('ذاكرت 3 أيام متتالية'), v: S => S.streakMax, n: 3, u: _T('يوم'), uk: 'd' },
    { id: 'st7', i: '⚡', t: _T('أسبوع كامل'), d: _T('ذاكرت 7 أيام متتالية'), v: S => S.streakMax, n: 7, u: _T('يوم'), uk: 'd' },
    { id: 'st30', i: '🌙', t: _T('شهر كامل'), d: _T('ذاكرت 30 يوم متتالي'), v: S => S.streakMax, n: 30, u: _T('يوم'), uk: 'd' },
    { id: 'goal1', i: '⭕', t: _T('هدف اليوم'), d: _T('حققت هدفك اليومي أول مرة'), v: S => S.goalDays, n: 1, u: _T('يوم'), uk: 'd' },
    { id: 'goal7', i: '🎖️', t: _T('ملتزم'), d: _T('حققت هدفك اليومي في 7 أيام'), v: S => S.goalDays, n: 7, u: _T('يوم'), uk: 'd' },
    { id: 'fix20', i: '🩹', t: _T('صياد الأخطاء'), d: _T('صحّحت 20 سؤال كنت غلطان فيها'), v: S => S.fixed, n: 20, u: _T('سؤال'), uk: 'q' },
    { id: 'note10', i: '📒', t: _T('صاحب الدفتر'), d: _T('حفظت 10 أسئلة في دفترك'), v: S => S.marks, n: 10, u: _T('سؤال'), uk: 'q' },
    { id: 'level', i: '🧭', t: _T('عرفت مستواك'), d: _T('سويت اختبار تحديد المستوى'), v: S => S.level, n: 1 },
    { id: 'mock1', i: '🧪', t: _T('أول محاكي'), d: _T('خلّصت أول اختبار محاكي'), v: S => S.mocks, n: 1, u: _T('اختبار'), uk: 't' },
    { id: 'plan', i: '🏁', t: _T('الخطة كاملة'), d: _T('خلّصت خطة المذاكرة كاملة'), v: S => S.planDone, n: 1 },
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
      setTimeout(() => toast(got.length > 1 ? _T`🏅 حصلت على ${got.length} شارات${first ? '' : _T(' جديدة')}! شوفها في «إنجازاتي»` : _T`🏅 شارة جديدة: ${got[0].t}`), 900); }
    return got;
  }
  let badgeT = 0; function badgeCheckSoon() { clearTimeout(badgeT); badgeT = setTimeout(badgeCheck, 1200); }
  async function renderBadges() {
    document.title = _T('إنجازاتي | Q-Guide');
    if (!skillsPulled) { app.innerHTML = topbar(_T`<span class="ttl">🏅 إنجازاتي</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + '<div class="center"><div class="spin" style="margin:0 auto"></div></div>'; bindCtl(); await skillsPull(); if (location.hash !== '#badges') return; }
    badgeCheck();
    const S = badgeStats(), B = lsGet(BADGE_LS, {}), n = BADGES.filter(b => B[b.id]).length;
    const left = b => { const v = Math.max(0, b.v(S)); if (b.pct) return _T`أفضل نتيجة لك ${v}%`; if (b.n === 1) return _T('ما حصلت عليها بعد'); const r = b.n - Math.min(v, b.n); if (EN) { const u = BADGE_U_EN[b.uk] || ['', '']; return `${r} ${r === 1 ? u[0] : u[1]} left`.replace('  ', ' '); } return _T`باقي ${r} ${b.u || ''}`; };
    app.innerHTML = topbar(_T`<span class="ttl">🏅 إنجازاتي</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap badges">
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
    document.title = _T('دفتري | Q-Guide');
    const back = _T`<a class="ib" href="#" title="الرئيسية">→</a>`;
    app.innerHTML = topbar(_T`<span class="ttl">📒 دفتري</span>`, back) + _T('<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل دفترك…</span></div>');
    bindCtl();
    if (!skillsPulled) await skillsPull();   // دفترك من جهازك الثاني
    const L = marksList().sort((a, b) => setOrder(a.src) - setOrder(b.src) || a.sidx - b.sidx);
    await Promise.all([...new Set(L.map(x => x.src))].map(s => loadSet(s).catch(() => null)));
    if (location.hash !== '#notes') return;
    const h = histGet(), tab = lsGet('qg_ntab', 'all');
    const rows = L.map(x => { const set = cache[x.src]; if (!set) return null; const f = flatItems(set)[x.sidx]; return f ? Object.assign(x, { it: f.it, kind: set.kind, g: set.kind === 'verbal' ? set.groups[f.gi] : null }) : null; }).filter(Boolean);
    const nq = rows.filter(r => r.kind === 'quant').length, nv = rows.length - nq;
    const show = rows.filter(r => tab === 'all' || (tab === 'q') === (r.kind === 'quant'));
    const stat = r => { const e = h.items[r.src] && h.items[r.src][r.sidx]; return !e ? _T('<span class="nb-s">ما حليته بعد</span>') : e[2] ? _T('<span class="nb-s ok">✓ آخر مرة صح</span>') : _T('<span class="nb-s bad">✗ آخر مرة غلط</span>'); };
    app.innerHTML = topbar(_T`<span class="ttl">📒 دفتري</span>`, back) + _T`<main class="wrap notes">
      <div class="nb-top"><div><h1>دفتري</h1><p>الأسئلة اللي حفظتها ⭐ وملاحظاتك عليها. ارجع لها قبل الاختبار، أو تدرّب عليها كأنها قسم.</p></div>
        <div class="nb-go">${nq ? _T`<a class="btn sm" href="#t-star-q">🎯 تدرّب على أسئلة الكمي <small>${nq}</small></a>` : ''}${nv ? _T`<a class="btn sm" href="#t-star-v">🎯 تدرّب على أسئلة اللفظي <small>${nv}</small></a>` : ''}</div></div>
      ${rows.length ? _T`<div class="tabs nb-tabs" role="tablist"><button data-t="all" class="${tab === 'all' ? 'on' : ''}">الكل <small>${rows.length}</small></button><button data-t="q" class="${tab === 'q' ? 'on' : ''}">الكمي <small>${nq}</small></button><button data-t="v" class="${tab === 'v' ? 'on' : ''}">اللفظي <small>${nv}</small></button></div>` : ''}
      <div class="nbs">${show.length ? show.map(r => _T`<article class="nb ${r.kind}">
        <div class="nb-h"><b>${SET_NAME(r.src)}</b><span class="mut">سؤال ${r.sidx + 1}</span>${stat(r)}<span class="sp"></span><button type="button" class="mk st ${r.e.s ? 'on' : ''}" data-star="${r.src}:${r.sidx}" title="${r.e.s ? _T('شيله من الدفتر') : _T('احفظه في الدفتر')}" aria-label="نجمة">${STARSVG}</button></div>
        <div class="nb-q">${r.kind === 'quant' ? _T`<img src="${r.it.img}" alt="سؤال ${r.sidx + 1}" loading="lazy">` : `${r.g && r.g.kind === 'passage' ? `<div class="mut nb-pt">📄 ${esc(r.g.title)}</div>` : ''}<p class="ltr">${esc(r.it.q)}</p>`}</div>
        <textarea class="nb-n" dir="auto" data-src="${r.src}" data-i="${r.sidx}" maxlength="600" rows="2" placeholder="أضف ملاحظة على السؤال…">${esc(r.e.n || '')}</textarea>
        <a class="nb-open" href="#${r.src}@${r.sidx}">افتح السؤال مع الشرح ←</a></article>`).join('') : _T`<div class="sum nb-empty"><div style="font-size:42px">📒</div><h2>دفترك فاضي</h2><p class="mut">وأنت تحل، اضغط ⭐ على أي سؤال تبي ترجع له، أو اكتب ملاحظتك عليه من زر 📝. كل شي ينحفظ هنا تلقائياً.</p><a class="btn gold" href="#">ابدأ الحل</a></div>`}</div></main>`;
    bindCtl();
    document.querySelectorAll('.nb-tabs button').forEach(b => b.onclick = () => { lsSet('qg_ntab', b.dataset.t); renderNotes(); });
    document.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { const [src, i] = b.dataset.star.split(':'); const c = markOf(src, +i); const on = !(c && c.s); markSet(src, +i, { s: on ? 1 : 0 }); b.classList.toggle('on', on); toast(on ? _T('⭐ رجع للدفتر') : _T('انشالت النجمة') + (c && c.n ? _T(' (الملاحظة باقية)') : '')); });
    document.querySelectorAll('.nb-n').forEach(t => { let tm = 0; t.oninput = () => { clearTimeout(tm); tm = setTimeout(() => markSet(t.dataset.src, +t.dataset.i, { n: t.value.trim() }), 500); }; });
  }

  // ---------- 🎯 صفحة نقاط القوة والضعف ----------
  function lvl(p, n) { if (n < 3) return { c: 'na', t: _T('بحاجة لمزيد من الأسئلة') }; if (p >= 80) return { c: 'ok', t: _T('قوي 💪') }; if (p >= 60) return { c: 'mid', t: _T('متوسط') }; return { c: 'bad', t: _T('يحتاج تركيز 🎯') }; }
  function skillsBarsHtml(agg, compact) {
    if (!agg) return compact ? _T('<h4>🎯 المهارات</h4><div class="mut" style="margin-bottom:8px">لا يوجد سجل بعد</div>') : '';
    const rows = TOPIC_ORDER.filter(t => agg[t] && (agg[t].w + agg[t].r)).map(t => { const a = agg[t], n = a.w + a.r, p = Math.round(a.r * 100 / n), L = lvl(p, n); return _T`<div class="skrow ${L.c}"><span class="ic">${TOPICS[t].i}</span><span class="nm">${TOPICS[t].t}<small>${TOPICS[t].k === 'quant' ? _T('الكمي') : _T('اللفظي')} · ${n} إجابة · ${a.wrongNow} خطأ حالي</small></span><span class="bar"><i style="width:${p}%"></i></span><b class="pct">${p}%</b><span class="lv">${L.t}</span>${compact ? '' : _T`<a class="btn sm ${L.c === 'bad' ? 'gold' : 'ghost'}" href="#t-${t}">تدرّب</a>`}</div>`; }).join('');
    return (compact ? _T('<h4>🎯 المهارات (من سجل الطالب)</h4>') : '') + (rows ? `<div class="sk">${rows}</div>` : `<div class="mut">${compact ? _T('لا يوجد سجل بعد') : ''}</div>`);
  }
  async function renderSkills() {
    document.title = _T('نقاط القوة والضعف | Q-Guide');
    app.innerHTML = topbar(_T`<span class="ttl">🎯 نقاط القوة والضعف</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T('<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحليل إجاباتك…</span></div>');
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
    const card = (t) => _T`<a class="tcard ${TOPICS[t].k}" href="#t-${t}"><span class="ic">${TOPICS[t].i}</span><b>${TOPICS[t].t}</b><small>${tot[t] || '—'} سؤال · ${TOPICS[t].k === 'quant' ? _T('الكمي') : _T('اللفظي')}</small>${agg[t].w + agg[t].r ? `<span class="mini ${lvl(Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r)), agg[t].w + agg[t].r).c}">${Math.round(agg[t].r * 100 / (agg[t].w + agg[t].r))}%</span>` : ''}</a>`;
    app.innerHTML = topbar(_T`<span class="ttl">🎯 نقاط القوة والضعف</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap skills">
      <div class="hero sk"><div><h1>تحليل مهاراتك</h1><p>${total ? _T`حلّلنا <b>${total}</b> إجابة من كل اختباراتك (الأقسام، النماذج، التدريب الموجّه). كل ما حليت أكثر صار التحليل أدق.` : _T('ابدأ بحل أي قسم من الكمي أو اللفظي، وبعدها تظهر لك هنا المواضيع اللي تقوى فيها واللي تحتاج تركيز.')}</p></div></div>
      ${weak.length ? _T`<h2 class="h2">🎯 ركّز على هذي المواضيع</h2><div class="focus">${weak.map(x => _T`<a class="fc bad" href="#t-${x.t}"><span class="ic">${TOPICS[x.t].i}</span><span><b>${TOPICS[x.t].t}</b><small>${x.p}% صحيحة من ${x.n} إجابة · ${agg[x.t].wrongNow} سؤال خطأ حالياً</small></span><span class="btn sm gold">تدرّب الآن</span></a>`).join('')}</div>` : ''}
      ${strong.length ? _T`<h2 class="h2">💪 نقاط قوتك</h2><div class="focus">${strong.map(x => _T`<a class="fc ok" href="#t-${x.t}"><span class="ic">${TOPICS[x.t].i}</span><span><b>${TOPICS[x.t].t}</b><small>${x.p}% صحيحة من ${x.n} إجابة</small></span><span class="btn sm ghost">حافظ عليها</span></a>`).join('')}</div>` : ''}
      <h2 class="h2">🔁 مراجعة أخطائي</h2>
      <div class="wb two">
        <a class="mock ${wrongQ ? '' : 'dim'}" href="#t-wrong-q"><span><b>📐 أخطائي في الكمي</b><br><span class="mut">${wrongQ ? (EN ? enN(wrongQ, 'question', 'questions') : wrongQ + ' سؤال') + _T(' آخر إجابة لك فيه كانت خطأ — حلّها من جديد مع الشرح') : _T('ما فيه أخطاء محفوظة حالياً')}</span></span><span class="btn">${wrongQ || 0} ${EN ? '→' : '←'}</span></a>
        <a class="mock ${wrongV ? '' : 'dim'}" href="#t-wrong-v"><span><b>📖 أخطائي في اللفظي</b><br><span class="mut">${wrongV ? (EN ? enN(wrongV, 'question', 'questions') : wrongV + ' سؤال') + _T(' آخر إجابة لك فيه كانت خطأ — حلّها من جديد مع الترجمة والشرح') : _T('ما فيه أخطاء محفوظة حالياً')}</span></span><span class="btn">${wrongV || 0} ${EN ? '→' : '←'}</span></a>
      </div>
      ${done.length ? _T`<h2 class="h2">📊 كل المواضيع</h2>${skillsBarsHtml(agg, false)}` : ''}
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
    document.title = _T('قاموس الكلمات | Q-Guide');
    app.innerHTML = topbar(_T`<span class="ttl">📖 قاموس الكلمات</span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T('<div class="center"><div class="spin" style="margin:0 auto 12px"></div><span id="ldmsg">تحميل القاموس…</span></div>');
    bindCtl(); await loadVocab();
    let rows = [], title = '';
    if (model) {
      let set; try { set = await loadSet(model); } catch (e) { app.innerHTML = topbar('', `<a class="ib" href="#vocab">→</a>`) + _T('<div class="center">تعذّر فتح النموذج. <a href="#vocab">رجوع</a></div>'); return; }
      title = set.title + ' · ' + set.sub.split(' · ').pop();
      const seen = new Set(); const add = (txt, where) => { for (const m of (txt || '').matchAll(/[A-Za-z][A-Za-z'’]*/g)) { const w = m[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, ''); if (seen.has(w) || STOP.has(w) || w.length < 3) continue; const ar = vocLook(w); if (!ar) continue; seen.add(w); rows.push([w, ar, where]); } };
      set.groups.forEach(g => { const where = g.kind === 'passage' ? _T('قطعة: ') + g.title : (EN ? g.title : g.ar || g.title); if (g.kind === 'passage') add(g.passage, where); g.items.forEach(it => add(it.q + ' ' + it.opts.join(' '), where)); });
    } else { rows = Object.keys(VOC).filter(w => !STOP.has(w) && w.length > 2).sort().map(w => [w, VOC[w], '']); title = _T('كل الكلمات (') + rows.length + ')'; }
    const tabs = _T`<div class="vtabs"><a class="${model ? '' : 'on'}" href="#vocab">الكل</a>${Array.from({ length: 14 }, (_, i) => _T`<a class="${model === 'v' + (i + 1) ? 'on' : ''}" href="#vocab-v${i + 1}">نموذج ${i + 1}</a>`).join('')}</div>`;
    app.innerHTML = topbar(_T`<span class="ttl">📖 قاموس الكلمات</span><span class="sp"></span><button class="ib" id="prn" title="طباعة / حفظ PDF">🖨️</button>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + _T`<main class="wrap vocab">
      <div class="hero sk"><div><h1>قاموس الكلمات</h1><p>ترجمة كل كلمة جديدة تمرّ عليك في النماذج اللفظية (${Object.keys(VOC).length} كلمة). اختر نموذجاً لتظهر كلماته بترتيب ورودها، أو ابحث عن أي كلمة. تقدر تطبع القائمة أو تحفظها PDF من زر 🖨️.</p></div></div>
      ${tabs}
      <div class="vsearch"><input id="vq" class="ltr" placeholder="ابحث عن كلمة… search" autocomplete="off"><span class="mut" id="vn"></span></div>
      <h2 class="h2 vt">${esc(title)}</h2>
      <div class="vlist" id="vl"></div></main>`;
    bindCtl();
    const vl = $('#vl'), vn = $('#vn'), vq = $('#vq'); let lastWhere = '';
    const paint = () => { const q = vq.value.trim().toLowerCase(); const list = q ? rows.filter(r => r[0].indexOf(q) >= 0 || r[1].indexOf(q) >= 0) : rows; vn.textContent = EN ? enN(list.length, 'word', 'words') : list.length + ' كلمة';   // i18n:skip
     lastWhere = '';
      vl.innerHTML = list.slice(0, 1500).map(r => { let hd = ''; if (model && r[2] !== lastWhere) { lastWhere = r[2]; hd = `<div class="vh">${esc(r[2])}</div>`; } return hd + `<div class="vr"><b class="ltr">${esc(r[0])}</b><span>${esc(r[1])}</span>${sayBtn(r[0], 'en', '', 'sm')}</div>`; }).join('') + (list.length > 1500 ? _T`<div class="mut" style="padding:10px">… ابحث لعرض المزيد (${list.length - 1500} كلمة أخرى)</div>` : ''); };
    vq.oninput = paint; paint();
    $('#prn').onclick = () => window.print();
  }

  // i18n:off — صفحات المشرفين تبقى عربي (ما تنلف بـ _T)
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
  // 🎬 بطاقة التصوير: اللوحة جنبها، أو «🎥 وضع التصوير» = البطاقة بالنص والأدوات عمودين حولها:
  // يمين = الكتابة (قلم · تظليل · نص · ممحاة · السماكة · الألوان) · يسار = الأوامر (تراجع · مسح · الإجابة · التنقل · النشر · إخفاء · اللوحة)
  // الجوال بالطول: صف فوق وصف تحت عشان البطاقة تبقى كبيرة · «👁 إخفاء» = البطاقة لحالها للتصوير النظيف (⋯ يرجّع الأدوات)
  const ST_COLS = ['#D62828', '#1F5FBF', '#111111', '#1B9E63', '#E9A23B'];
  const ST_TOOLS = [['pen', '✎', 'قلم'], ['hl', '▬', 'تظليل'], ['text', 'T', 'نص'], ['eraser', '◌', 'ممحاة']];
  const ST_W = [['2.6', '─', 'رفيع', 'خط رفيع · نص عادي'], ['5', '━', 'عريض', 'خط عريض · نص كبير']];
  const SI = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ST_IC = {   // أيقونات العمودين (Lucide)
    pen: SI('<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>'),
    hl: SI('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    text: SI('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
    eraser: SI('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
    '2.6': SI('<path d="M4 12h16" stroke-width="1.6"/>'), '5': SI('<path d="M4 12h16" stroke-width="4.6"/>'),
    undo: SI('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    clear: SI('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
    ans: SI('<circle cx="12" cy="12" r="10"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>'),
    prev: SI('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'), next: SI('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),   // الاتجاه عربي: السابق ← يمين · التالي ← يسار (مثل أسهم الكيبورد)
    rnd: SI('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/>'),
    post: SI('<rect x="3" y="3" width="18" height="18" rx="3"/>'), posted: SI('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>'),
    hide: SI('<path d="M10.73 5.08A10.74 10.74 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/><path d="m2 2 20 20"/>'),
    panel: SI('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>')
  };
  // 🔤 ترجمة الكلمة بالضغط: كل طرف من التناظر وحدة، ترجمته من ترجمة السؤال نفسه (ar) · غيره من القاموس · وخيارات المقارنة في الكمي
  const ST_PHRASE = { 'a is greater': 'A أكبر', 'b is greater': 'B أكبر', equal: 'متساويتان', 'not enough information': 'المعطيات غير كافية', mango: 'مانجو', lemon: 'ليمون', banana: 'موز', peach: 'خوخ', oats: 'شوفان', 'south-west': 'جنوب غرب', 'south-east': 'جنوب شرق', 'north-east': 'شمال شرق', 'north-west': 'شمال غرب' };
  const stTw = (w, ar) => `<span class="tw" data-ar="${esc(ar)}">${esc(w)}</span>`;
  function stTr(en, ar) {   // "SELECT : CHOOSE" + "ينتقي : يختار" → SELECT و CHOOSE ينضغطون
    const a = String(en || '').split(':'), b = ar ? String(ar).split(':') : [];
    return a.map((part, i) => {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(part), w = m[2]; if (!/[A-Za-z]/.test(w)) return esc(part);
      const tr = (b.length === a.length && b[i].trim()) || ST_PHRASE[w.toLowerCase()] || (/^[A-Za-z][A-Za-z'’-]*$/.test(w) ? vocLook(w) : '');
      if (tr) return m[1] + stTw(w, tr) + m[3];
      return m[1] + w.split(/([A-Za-z][A-Za-z'’]*)/).map((x, j) => { if (!(j % 2)) return esc(x); const t = STOP.has(x.toLowerCase()) ? '' : vocLook(x); return t ? stTw(x, t) : esc(x); }).join('') + m[3];
    }).join(':');
  }
  async function renderRec(kind, n) {
    stFont(); document.title = 'تصوير Q ' + n + ' | Q-Guide';
    let data; try { [data] = await Promise.all([stData(), stPosted(), loadVocab()]); } catch (e) { app.innerHTML = '<div class="center">تعذّر التحميل. <a href="#studio">رجوع</a></div>'; return; }
    const list = data[kind === 'v' ? 'verbal' : 'quant']; const it = list.find(x => x.n === n); if (!it) { location.hash = 'studio'; return; }
    ST.reveal = false; document.body.classList.add('rec-on');
    const key = kind + n, P = ST.posted[key], itAr = it.ar || {};
    const opts = it.opts.map((o, i) => `<div class="tk-o" data-i="${i}"><span class="tk-l">${STL[i]}</span><span class="tk-t">${stTr(o, (itAr.o || [])[i])}</span></div>`).join('');
    const q = kind === 'v' ? `<div class="tk-kind">Analogy · التناظر اللفظي</div><div class="tk-qv">${stTr(it.q, itAr.q)}</div>` : `<div class="tk-kind">Quant · القسم الكمي</div><div class="tk-qi"><img src="${it.img}" alt=""></div>`;
    const hasTw = /class="tw"/.test(q + opts);
    const ar = it.ar && it.ar.q ? `<div class="rp-ar"><b>🇸🇦 الترجمة:</b> ${esc(it.ar.q)}<ol>${(it.ar.o || []).map((o, i) => `<li class="${i === it.ans ? 'k' : ''}">${STL[i]}) ${esc(o)}</li>`).join('')}</ol></div>` : '';
    const prev = list[(list.indexOf(it) - 1 + list.length) % list.length].n, next = list[(list.indexOf(it) + 1) % list.length].n;
    const rb = (attr, ic, lb, tt, cls) => `<button type="button" class="rb${cls ? ' ' + cls : ''}" ${attr} title="${tt || lb}" aria-label="${tt || lb}"><i aria-hidden="true">${ic}</i><small>${lb}</small></button>`;
    const rlink = (h, ic, lb, tt) => `<a class="rb" href="${h}" title="${tt}" aria-label="${tt}"><i aria-hidden="true">${ic}</i><small>${lb}</small></a>`;
    const railActs = `<nav class="rail racts" aria-label="أوامر التصوير">${rb('id="lundo"', ST_IC.undo, 'تراجع', 'تراجع · Z')}${rb('id="lclr"', ST_IC.clear, 'مسح', 'مسح الكتابة · C')}<span class="rsep"></span>${rb('id="lrev"', ST_IC.ans, 'الإجابة', 'كشف الإجابة · R')}<span class="rsep"></span>${rlink(`#studio-${kind}-${prev}`, ST_IC.prev, 'السابق', 'السؤال السابق · →')}${rlink(`#studio-${kind}-${next}`, ST_IC.next, 'التالي', 'السؤال التالي · ←')}${rb('id="lrnd"', ST_IC.rnd, 'عشوائي', 'سؤال عشوائي لم يُنشر')}<span class="rsep"></span>${rb('id="lpost"', P ? ST_IC.posted : ST_IC.post, 'نُشر', P ? 'تم النشر ✓ (اضغط للإلغاء)' : 'علّمه «تم النشر»', P ? 'ok' : '')}<span class="rsep"></span>${rb('id="lbare"', ST_IC.hide, 'إخفاء', 'إخفاء الأدوات للتصوير النظيف · H')}${rb('id="lpanel"', ST_IC.panel, 'اللوحة', 'رجوع للوحة والإجابة · Esc')}</nav>`;
    const railDraw = `<nav class="rail rdraw" aria-label="أدوات الكتابة">${ST_TOOLS.map(([t, , lb], i) => rb(`data-tool="${t}" aria-pressed="${!i}"`, ST_IC[t], lb, lb + ({ pen: ' · P', text: ' (اضغط على البطاقة واكتب) · T', eraser: ' · E' }[t] || ''), i ? '' : 'on')).join('')}<span class="rsep"></span>${ST_W.map(([w, , lb, tt], i) => rb(`data-w="${w}" aria-pressed="${!i}"`, ST_IC[w], lb, tt, i ? '' : 'on')).join('')}<span class="rsep"></span><div class="rcols">${ST_COLS.map((c, i) => `<button type="button" class="rsw${i ? '' : ' on'}" data-col="${c}" style="--c:${c}" title="لون" aria-label="لون" aria-pressed="${!i}"></button>`).join('')}</div></nav>`;
    app.innerHTML = `<div class="rec ${ST.ui ? '' : 'noui'} ${ST.bare ? 'bare' : ''}">
      <div class="stage">${railActs}<div class="tk" id="tk">
        <div class="tk-top"><span class="tk-brand"><img src="/assets/logo.png" alt=""><b>Q-Guide1</b>${YTSVG}</span></div>
        <div class="tk-panel"><span class="tk-badge">Q ${n}</span>${q}<div class="tk-opts ${it.opts.some(o => o.length > 13) ? 'one' : ''}">${opts}</div>
          <div class="tk-sol"><span>الحل</span></div></div>
        <div class="tk-foot">اكتب إجابتك في التعليقات 👇</div>
      </div>${railDraw}</div>
      <aside class="rp">
        <div class="rp-h"><a class="ib2" href="#studio" title="رجوع للقائمة">→</a><b>Q ${n} · ${kind === 'v' ? 'التناظر اللفظي' : 'الكمي'}</b><span class="sp"></span><a class="ib2" href="#studio-${kind}-${prev}" title="السابق">‹</a><a class="ib2" href="#studio-${kind}-${next}" title="التالي">›</a><button class="ib2" id="rrnd" title="سؤال عشوائي لم يُنشر">🎲</button></div>
        <div class="rp-sec"><div class="rp-lbl">✍️ القلم والنص</div>
          <div class="rp-tools">${ST_TOOLS.map(([t, ic, lb], i) => `<button type="button" data-tool="${t}" class="${i ? '' : 'on'}${t === 'text' ? ' tt' : ''}" title="${t === 'text' ? 'نص: اضغط على البطاقة واكتب' : lb}" aria-pressed="${!i}">${ic}</button>`).join('')}<span class="sep"></span>${ST_COLS.map((c, i) => `<button type="button" data-col="${c}" class="sw ${i ? '' : 'on'}" style="--c:${c}" title="لون" aria-pressed="${!i}"></button>`).join('')}<span class="sep"></span>${ST_W.map(([w, ic, lb, tt], i) => `<button type="button" data-w="${w}" title="${tt}" class="${i ? '' : 'on'}" aria-pressed="${!i}">${ic}</button>`).join('')}<span class="sep"></span><button type="button" id="rundo" title="تراجع">↶</button><button type="button" id="rclr" title="مسح الكتابة">🗑</button></div>
          <label class="rp-sw"><input type="checkbox" id="rpen" checked><span>الكتابة على البطاقة مفعّلة</span></label>
          ${hasTw ? '<div class="rp-hint">🔤 اضغط على أي كلمة في البطاقة تطلع ترجمتها تحتها، واضغطها مرة ثانية تختفي.</div>' : ''}</div>
        <div class="rp-sec rp-acts"><button class="btn" id="rrev">✅ كشف الإجابة</button><button class="btn ${P ? 'okb' : 'ghost'}" id="rpost">${P ? '✓ تم النشر' : '☐ علّمه «تم النشر»'}</button><button class="btn ghost" id="rhide" title="البطاقة بالنص والأدوات على اليمين واليسار">🎥 وضع التصوير</button></div>
        ${P ? `<div class="rp-note">نشره ${esc(String(P.by_email || '').split('@')[0])} · ${fmtD(P.at)}</div>` : ''}
        <details class="rp-sec rp-ans" open><summary>👁 الإجابة والشرح (لك فقط — ما تظهر في البطاقة)</summary>
          <div class="rp-key">الإجابة: <b class="ltr">${STL[it.ans]}) ${esc(it.opts[it.ans])}</b></div>${ar}
          ${it.exp ? `<div class="rp-exp">${fmtExp(it.exp)}</div>` : ''}<div class="rp-src">من ${kind === 'v' ? 'النموذج ' + it.src.slice(1) : 'القسم ' + it.src.slice(1)} · سؤال ${it.qn}</div></details>
        <div class="rp-tip">⌨️ اختصارات: ← → للتنقل · R كشف الإجابة · Z تراجع · C مسح (الكتابة والترجمات) · P قلم · T نص · E ممحاة · H وضع التصوير · Esc رجوع للوحة</div>
      </aside>
      <button class="rec-fab" id="rshow" title="إظهار الأدوات" aria-label="إظهار الأدوات">⋯</button>
      <div class="rec-mini"><button id="mpen" title="القلم">✎</button><button id="mtxt" class="tt" title="نص: اضغط على البطاقة واكتب">T</button><button id="mundo" title="تراجع">↶</button><button id="mclr" title="مسح">🗑</button><button id="mrev" title="كشف الإجابة">✅</button><button id="mhide" title="وضع التصوير">🎥</button><button id="mmore" title="الأدوات والإجابة">☰</button></div>
    </div>`;
    const tk = $('#tk');
    // 🔤 اضغط على كلمة → ترجمتها تحتها (فوقها لو تحتها سطر ثاني من نفس النص) · ضغطة ثانية عليها أو على الترجمة تخفيها · «مسح» يخفي الكل
    const trl = document.createElement('div'); trl.className = 'tk-trl'; tk.appendChild(trl);
    const TR = new Map();   // الكلمة → فقاعة ترجمتها
    const twAt = (x, y) => {
      let best = null, bd = 1e9;
      tk.querySelectorAll('.tw').forEach(w => { const r = w.getBoundingClientRect(), pad = Math.max(6, r.height * .18); if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) return; const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2); if (d < bd) { bd = d; best = w; } });
      if (!best) TR.forEach((b, w) => { const r = b.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) best = w; });
      return best;
    };
    const MC = document.createElement('canvas').getContext('2d');
    const glyphs = w => {   // حدود الحروف نفسها (صندوق الخط أطول بكثير): خط الأساس + أعلى الحروف + تحت الخط الذهبي
      const cs = getComputedStyle(w), fs = parseFloat(cs.fontSize), rs = w.getClientRects(); MC.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = MC.measureText(w.textContent), line = r => { const base = r.top + (m.fontBoundingBoxAscent || r.height * .78); return { r, cx: (r.left + r.right) / 2, top: base - (m.actualBoundingBoxAscent || fs * .72), bot: Math.max(base + (m.actualBoundingBoxDescent || 0), base + fs * .3) }; };
      return { first: line(rs[0]), last: line(rs[rs.length - 1]) };
    };
    const trPlace = () => {
      if (!TR.size || !tk.isConnected) return; const kr = tk.getBoundingClientRect(), cw = kr.width, pad = cw * .025, rows = new Map();
      TR.forEach((b, w) => {
        if (!w.getClientRects().length) return; const g = glyphs(w), bw = b.offsetWidth, bh = b.offsetHeight, ah = parseFloat(getComputedStyle(b).fontSize) * .3 + 2;
        const box = w.closest('.tk-qv,.tk-t'), bs = box && getComputedStyle(box), lh = bs ? parseFloat(bs.lineHeight) || parseFloat(bs.fontSize) * 1.2 : 0;
        const up = !!box && box.getBoundingClientRect().bottom - parseFloat(bs.paddingBottom) - g.last.r.bottom > lh * .45;   // تحت الكلمة سطر ثاني من نفس النص → الترجمة فوقها
        const L = up ? g.first : g.last, y = up ? L.top - kr.top - bh - ah : L.bot - kr.top + ah, cx = L.cx - kr.left, k = Math.round(y);
        b.classList.toggle('up', up); (rows.get(k) || rows.set(k, []).get(k)).push({ b, x: cx - bw / 2, y, bw, cx });
      });
      rows.forEach(l => {   // ترجمتين بنفس السطر ما يركبون على بعض
        l.sort((a, c) => a.x - c.x);
        for (let i = 1; i < l.length; i++) if (l[i].x < l[i - 1].x + l[i - 1].bw + 6) l[i].x = l[i - 1].x + l[i - 1].bw + 6;
        const z = l[l.length - 1], over = z.x + z.bw - (cw - pad); if (over > 0) l.forEach(o => o.x -= over);
        if (l[0].x < pad) { const d = pad - l[0].x; l.forEach(o => o.x += d); }
        l.forEach(o => { o.b.style.left = o.x + 'px'; o.b.style.top = o.y + 'px'; o.b.style.setProperty('--ax', Math.max(12, Math.min(o.bw - 12, o.cx - o.x)) + 'px'); });
      });
    };
    const trToggle = w => {
      const old = TR.get(w);
      if (old) { old.remove(); TR.delete(w); w.classList.remove('on'); }
      else { const b = document.createElement('div'); b.className = 'tk-trb' + (w.closest('.tk-qv') ? ' big' : ''); b.textContent = w.dataset.ar; trl.appendChild(b); TR.set(w, b); w.classList.add('on'); }
      trPlace();
    };
    const trClear = () => { TR.forEach((b, w) => { b.remove(); w.classList.remove('on'); }); TR.clear(); };
    const tro = new ResizeObserver(() => { if (!tk.isConnected) return tro.disconnect(); trPlace(); }); tro.observe(tk); if (document.fonts) document.fonts.ready.then(trPlace);
    tk.addEventListener('click', e => { if (ST.pen.isOn()) return; const w = twAt(e.clientX, e.clientY); if (w) trToggle(w); });   // الكتابة مقفلة: الضغط يوصل للكلمة مباشرة
    ST.pen = window.__stPen = QGPen.attach(tk, { bar: false, storageKey: null, text: true, onTap: (x, y) => { const w = twAt(x, y); if (!w) return false; trToggle(w); return true; } });
    ST.pen.toggle(true); ST.pen.setColor(ST_COLS[0]); ST.pen.setWidth(2.6);
    const rec = $('.rec');
    // نفس الأداة/اللون/السماكة تتعلّم في اللوحة والعمودين مع بعض
    const mark = (a, v) => rec.querySelectorAll(`[data-${a}]`).forEach(x => { const on = x.dataset[a] === v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    const penOn = on => { ST.pen.toggle(on); $('#rpen').checked = on; $('#mpen').classList.toggle('on', on); };
    const setTool = t => { if (!ST.pen.isOn()) penOn(true); ST.pen.setTool(t); mark('tool', t); $('#mtxt').classList.toggle('on', t === 'text'); };
    const setCol = c => { ST.pen.setColor(c); mark('col', c); if (ST.pen.tool() !== 'text') setTool('pen'); };
    const setW = w => { ST.pen.setWidth(+w); mark('w', w); };
    const setUI = on => { ST.ui = on; rec.classList.toggle('noui', !on); if (!on) rec.classList.remove('sheet'); };
    const setBare = on => { ST.bare = on; rec.classList.toggle('bare', on); };
    const recMode = () => { setUI(false); setBare(false); };
    const reveal = () => { ST.reveal = !ST.reveal; tk.classList.toggle('rev', ST.reveal); tk.querySelectorAll('.tk-o').forEach(o => o.classList.toggle('ok', ST.reveal && +o.dataset.i === it.ans)); $('#rrev').textContent = ST.reveal ? '↺ إخفاء الإجابة' : '✅ كشف الإجابة';
      const l = $('#lrev'); l.classList.toggle('on', ST.reveal); l.title = ST.reveal ? 'إخفاء الإجابة · R' : 'كشف الإجابة · R'; l.setAttribute('aria-label', l.title); };
    const clear = () => { ST.pen.clear(); trClear(); }, undo = () => ST.pen.undo();
    // الضغط على الأدوات ما ياخذ التركيز من النص اللي ينكتب (عشان اللون والحجم يتغيّرون عليه)
    rec.querySelectorAll('[data-tool],[data-col],[data-w],#rundo,#rclr,#lundo,#lclr,#mtxt,#mundo,#mclr').forEach(b => b.addEventListener('pointerdown', e => e.preventDefault()));
    rec.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    rec.querySelectorAll('[data-col]').forEach(b => b.onclick = () => setCol(b.dataset.col));
    rec.querySelectorAll('[data-w]').forEach(b => b.onclick = () => setW(b.dataset.w));
    $('#rundo').onclick = $('#mundo').onclick = $('#lundo').onclick = undo;
    $('#rclr').onclick = $('#mclr').onclick = $('#lclr').onclick = clear;
    $('#lclr').title = 'مسح الكتابة والترجمات · C'; $('#lclr').setAttribute('aria-label', $('#lclr').title); $('#rclr').title = 'مسح الكتابة والترجمات';
    $('#rpen').onchange = e => penOn(e.target.checked);
    $('#mpen').classList.add('on'); $('#mpen').onclick = () => penOn(!ST.pen.isOn());
    $('#mtxt').onclick = () => setTool(ST.pen.tool() === 'text' ? 'pen' : 'text');
    $('#rrev').onclick = $('#mrev').onclick = $('#lrev').onclick = reveal;
    $('#rhide').onclick = $('#mhide').onclick = recMode;
    $('#lbare').onclick = () => setBare(true);
    $('#lpanel').onclick = () => setUI(true);
    $('#rshow').onclick = () => setBare(false);
    $('#mmore').onclick = () => rec.classList.toggle('sheet');
    $('#rrnd').onclick = $('#lrnd').onclick = () => { location.hash = `studio-${kind}-${stRandom(kind, data, n)}`; };
    const paintPost = on => { const b = $('#rpost'), l = $('#lpost'); b.className = 'btn ' + (on ? 'okb' : 'ghost'); b.textContent = on ? '✓ تم النشر' : '☐ علّمه «تم النشر»';
      l.classList.toggle('ok', on); l.querySelector('i').innerHTML = on ? ST_IC.posted : ST_IC.post; l.title = on ? 'تم النشر ✓ (اضغط للإلغاء)' : 'علّمه «تم النشر»'; l.setAttribute('aria-label', l.title); };
    $('#rpost').onclick = $('#lpost').onclick = async () => { const on = !ST.posted[key], bs = [$('#rpost'), $('#lpost')]; bs.forEach(b => b.disabled = true); if (await stMark(key, on)) { paintPost(on); toast(on ? 'تم التعليم كمنشور ✓' : 'أُلغي التعليم'); } bs.forEach(b => b.disabled = false); };
    // اختصارات الكيبورد بمكان الزر (تشتغل حتى لو الكيبورد عربي)
    const KEYS = { KeyR: reveal, KeyZ: undo, KeyC: clear, KeyP: () => setTool('pen'), KeyT: () => setTool('text'), KeyE: () => setTool('eraser'), KeyH: () => ST.ui ? recMode() : setBare(!ST.bare) };
    window.__stKey = e => { if (e.target.closest && e.target.closest('input,textarea,[contenteditable]')) return; if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft') location.hash = `studio-${kind}-${next}`; else if (e.key === 'ArrowRight') location.hash = `studio-${kind}-${prev}`;
      else if (e.key === 'Escape') setUI(true); else if (KEYS[e.code]) { e.preventDefault(); KEYS[e.code](); } };
    document.addEventListener('keydown', window.__stKey);
  }
  // i18n:on
  // ---------- avatar / profile ----------
  // 🎭 أشكال جاهزة (DiceBear): بذرة عشوائية (مو الإيميل — الرابط يطلع للطلاب في لوحة الصدارة) و«🔀 أشكال ثانية» يغيّرها
  const PRESETS = ['adventurer', 'avataaars', 'big-smile', 'bottts', 'fun-emoji', 'lorelei', 'micah', 'miniavs', 'notionists', 'personas', 'pixel-art', 'thumbs'];
  function avatarHtml(url, name, size) {
    const nm = String(name || '').replace(/[?؟]/g, '').trim(); const init = esc(nm.charAt(0) || '👤'); const sz = size || 40;
    let hsh = 0; for (const ch of nm) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0; const hue = hsh % 360;
    const st = `width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .45)}px;background:hsl(${hue} 55% 42%);color:#fff`;
    return url ? `<img class="av" src="${esc(url)}" width="${sz}" height="${sz}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av ini',textContent:'${init}',style:'${st}'}))">`
      : `<span class="av ini" style="${st}">${init}</span>`;
  }
  function presetUrl(style, seed) { return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=solid&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`; }
  const newSeed = () => 'qg' + Math.random().toString(36).slice(2, 8);
  // 👤 «ملفي» (#me): موعد انتهاء الاشتراك · الاسم · المدرسة · الصورة
  const SUB_LBL = { yt: ['▶️', _T('عضوية يوتيوب')], free: ['🎁', _T('اشتراك مجاني')], bank: ['🏦', _T('تحويل بنكي')], pay: ['💳', _T('دفع إلكتروني')] };
  const meDay = (t, wd) => new Date(t).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', Object.assign({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }, wd ? { weekday: 'long' } : {}));
  const ME = { seeds: null };
  async function renderProfile() {
    document.title = _T('ملفي | Q-Guide');
    app.innerHTML = topbar(_T`<span class="ttl">👤 ملفي</span><span class="sp"></span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + '<main class="wrap mepage"><div class="center" style="padding:60px 0"><div class="spin" style="margin:0 auto"></div></div></main>';
    bindCtl();
    let P;
    try { P = await api({ op: 'profile', session: auth.session }); } catch (e) { P = null; }
    if (location.hash !== '#me') return;
    if (!P || !P.ok) { $('.mepage').innerHTML = `<div class="sum">${esc((P && P.msg) || _T('تعذّر تحميل ملفك، تأكد من النت وحدّث الصفحة.'))}</div>`; return; }
    if (!ME.seeds) ME.seeds = PRESETS.map(newSeed);
    meDraw(P);
  }
  function meDraw(P) {
    const W = $('.mepage'); if (!W) return;
    const S = P.sub || {}, now = P.now || Date.now(), name = P.name || auth.display || auth.name || '';
    // 📅 الاشتراك: الأيام الباقية بتقويم الرياض + شريط من البداية للنهاية
    let subHtml = '', chip = '';
    if (S.state === 'staff') { chip = S.role === 'owner' ? _T('👑 المالك') : _T('🛡 مشرف'); subHtml = _T`<p class="msubtx">${S.role === 'owner' ? _T('أنت مالك الموقع، ما تحتاج اشتراك.') : _T('حسابك مشرف، ما يحتاج اشتراك.')}</p>`; }
    else if (S.state === 'free') { chip = _T('🆓 حساب مجاني'); subHtml = _T`<p class="msubtx">حسابك مجاني: تقدر تجرّب القسم 1 والنموذج 1 والاختبار المحاكي 1. اشترك عشان تنفتح لك الدورة كاملة.</p><div class="msubact"><button type="button" class="btn gold" data-sub>⭐ اشترك في الدورة</button></div>`; }
    else if (S.state === 'ended') { chip = _T('⛔ اشتراك منتهي'); subHtml = _T`<p class="msubtx">انتهى اشتراكك في الدورة. جدّده وترجع لك كل الأقسام والنماذج مع تقدّمك.</p><div class="msubact"><button type="button" class="btn gold" data-sub>↻ جدّد اشتراكك</button></div>`; }
    else {
      const L = SUB_LBL[S.t] || SUB_LBL.yt; chip = L[0] + ' ' + L[1];
      if (S.until) {
        const left = rDay(S.until) - rDay(now), span = Math.max(1, S.until - (S.start || S.until - 30 * 864e5)), pct = Math.min(100, Math.max(0, Math.round((now - (S.start || S.until - span)) * 100 / span)));
        const tone = left < 0 ? 'bad' : left <= 3 ? 'warn' : left <= 7 ? 'mid' : 'ok';
        const big = left < 0 ? _T('انتهت المدة') : left === 0 ? _T('آخر يوم') : EN ? enN(left, 'day', 'days') + ' left' : left === 1 ? _T('باقي يوم') : left === 2 ? _T('باقي يومين') : _T`باقي ${left} ${left <= 10 ? _T('أيام') : _T('يوم')}`;
        const wa = 'https://wa.me/966508003683?text=' + encodeURIComponent(_T('السلام عليكم، أبي أجدد اشتراكي في دورة Q-Guide') + _T('\nإيميلي في الموقع: ') + (P.email || auth.email));
        subHtml = _T`<div class="msub ${tone}"><div class="msubn"><b>${big}</b><span>${left < 0 ? _T`كان آخر يوم ${meDay(S.until)}` : _T`ينتهي اشتراكك ${meDay(S.until, 1)}`}</span></div>
          <i class="pg" aria-hidden="true"><span style="width:${pct}%"></span></i>
          <div class="msubm"><span>${S.start ? _T`بدأ ${meDay(S.start)}` : ''}</span><span>${L[0]} ${L[1]}</span></div></div>
          ${left <= 3 ? _T`<div class="msubact"><p>${left < 0 ? _T('جدّد اشتراكك عشان ما ينقفل حسابك.') : _T('اشتراكك قرب يخلص. جدّده عشان تكمّل بدون انقطاع.')}</p><a class="btn gold" href="${wa}"${TGT}>↻ جدّد اشتراكك</a></div>` : ''}`;
      } else subHtml = _T`<p class="msubtx">✓ اشتراكك فعّال (${L[0]} ${L[1]}).</p>`;
    }
    // 🖼 الصورة: ارفع صورة · صورة قناتك في يوتيوب · أشكال جاهزة · بدون صورة — تتغيّر على طول
    const cur = P.avatar || '', opt = (u, inner, t, cls) => `<button type="button" class="meopt${cls ? ' ' + cls : ''}${u === cur ? ' on' : ''}" data-u="${esc(u)}" title="${t}" aria-label="${t}" aria-pressed="${u === cur}">${inner}</button>`;
    const avs = `<label class="meopt up" title="${_T('ارفع صورة من جهازك')}"><span aria-hidden="true">📷</span><small>${_T('ارفع صورة')}</small><input type="file" id="me-file" accept="image/*" hidden></label>`
      + (P.yt ? opt(P.yt, avatarHtml(P.yt, 'Y', 56), _T('صورة قناتك في يوتيوب')) : '')
      + PRESETS.map((st, i) => { const u = presetUrl(st, ME.seeds[i]); return opt(u, avatarHtml(u, '?', 56), _T('شكل جاهز')); }).join('')
      + (cur && cur.indexOf('dicebear') >= 0 && !PRESETS.some((st, i) => presetUrl(st, ME.seeds[i]) === cur) ? opt(cur, avatarHtml(cur, '?', 56), _T('صورتك الحالية')) : '')
      + (cur && cur.indexOf('/avatar/') >= 0 ? opt(cur, avatarHtml(cur, '?', 56), _T('صورتك المرفوعة')) : '')
      + opt('', `<span class="av ini" style="width:56px;height:56px;font-size:24px">${esc((name || '?').charAt(0))}</span>`, _T('بدون صورة'), 'none');
    W.innerHTML = _T`<section class="mehd">
        <div class="meav">${avatarHtml(cur, name, 96)}<a class="meavb" href="#me-av" title="غيّر صورتك" aria-label="غيّر صورتك">✎</a></div>
        <div class="mehx"><h1>${esc(name)}</h1><span class="memail" dir="ltr">${esc(P.email || auth.email || '')}</span>
          <div class="mechips"><span class="mechip s-${S.state || 'active'}">${chip}</span>${P.school ? `<span class="mechip">🏫 ${esc(P.school)}</span>` : ''}</div></div>
      </section>
      <section class="mecard" aria-labelledby="me-h1"><h2 id="me-h1">📅 اشتراكك</h2>${subHtml}</section>
      <section class="mecard" aria-labelledby="me-h2"><h2 id="me-h2">✏️ بياناتك</h2>
        <div class="mefields"><label class="mef"><span>اسمك في لوحة الصدارة</span><input id="me-name" maxlength="30" autocomplete="nickname" value="${esc(name)}"></label>
          <label class="mef"><span>مدرستك</span><input id="me-school" maxlength="60" placeholder="مثال: ثانوية الملك فهد" value="${esc(P.school || '')}"></label></div>
        <p class="mut menote">الاسم والصورة يشوفها الطلاب في لوحة الصدارة والساحة. المدرسة ما يشوفها إلا أنت ومرشدك.</p>
        <div class="meact"><button type="button" class="btn" id="me-save" disabled>حفظ</button><span class="mut" id="me-st" aria-live="polite"></span></div></section>
      <section class="mecard" id="me-av" aria-labelledby="me-h3"><div class="mecardh"><h2 id="me-h3">🖼 صورتك</h2><button type="button" class="lnk2" id="me-shuf">🔀 أشكال ثانية</button></div>
        <div class="meavs">${avs}</div>
        <p class="mut menote">اضغط على أي صورة وتتغيّر على طول.</p></section>`;
    bindSub(W);
    // ✏️ الاسم والمدرسة: زر الحفظ يشتغل لما يتغيّر شي
    const nm = $('#me-name'), sc = $('#me-school'), sv = $('#me-save'), stt = $('#me-st');
    const dirty = () => { sv.disabled = nm.value.trim() === name && sc.value.trim() === (P.school || ''); stt.textContent = ''; };
    nm.oninput = dirty; sc.oninput = dirty;
    const save = async (body, okMsg) => {
      try { const r = await api(Object.assign({ op: 'profile_set', session: auth.session }, body)); if (!r.ok) { toast(r.msg || _T('تعذّر الحفظ')); return false; }
        P.name = r.name; P.avatar = r.avatar; P.school = r.school; auth.display = r.name; auth.avatar = r.avatar; lsSet(LS.auth, auth);
        const y = scrollY; meDraw(P); scrollTo({ top: y }); toast(okMsg); return true; } catch (e) { toast(_T('تعذّر الاتصال')); return false; } };
    sv.onclick = async () => { const n2 = nm.value.trim(); if (n2.length < 2) { toast(_T('اكتب اسماً أطول')); nm.focus(); return; }
      sv.disabled = true; stt.textContent = _T('جاري الحفظ…'); if (!await save({ name: n2, school: sc.value.trim() }, _T('تم الحفظ ✓'))) dirty(); };
    [nm, sc].forEach(i => i.onkeydown = e => { if (e.key === 'Enter' && !sv.disabled) sv.click(); });
    // 🖼 الصورة تتغيّر على طول
    W.querySelectorAll('.meopt[data-u]').forEach(b => b.onclick = () => { if (b.dataset.u === cur) return; W.querySelectorAll('.meopt').forEach(x => x.classList.add('dis')); save({ avatar: b.dataset.u }, _T('✓ تغيّرت صورتك')); });
    $('#me-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { toast(_T('اختر صورة')); return; }
      const ph = await shrinkImage(f, 160); save({ photo: ph }, _T('✓ تغيّرت صورتك')); };
    $('#me-shuf').onclick = () => { ME.seeds = PRESETS.map(newSeed); const y = scrollY; meDraw(P); scrollTo({ top: y }); };
    const ab = $('.meavb'); if (ab) ab.onclick = e => { e.preventDefault(); $('#me-av').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); };
  }
  function shrinkImage(file, size) {
    return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); const s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); res(c.toDataURL('image/jpeg', .82)); }; img.src = URL.createObjectURL(file); });
  }

  // ---------- leaderboard ----------
  // i18n:off — صفحات المشرفين تبقى عربي (ما تنلف بـ _T)
  // ---------- 👑 لوحة المشرف ----------
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1RaKf8jqdIJ2tsZx95jhxhqyNq0scSvnzPyfttYch8CI';
  const fmtD = t => { if (!t) return '—'; const d = new Date(t); const diff = (Date.now() - t) / 60000; if (diff < 60) return 'قبل ' + Math.max(1, Math.round(diff)) + ' د'; if (diff < 1440) return 'قبل ' + Math.round(diff / 60) + ' س'; return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); };
  // 📅 موعد انتهاء الاشتراك (للمالك): البداية + شهر — الطالب الجديد ياخذ تاريخه تلقائياً، و«+ شهر» يمدّد
  const rDay = t => Math.floor((t + 3 * 3600000) / 864e5);
  const admDay = (t, y) => t ? new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', Object.assign({ day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }, y ? { year: 'numeric' } : {})) : '—';
  const arDays = n => n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? n + ' أيام' : n + ' يوم';
  function subLeft(until) {   // ok = باقي أكثر من 3 أيام · soon · over = مر عليه شهر (خلص موعده)
    if (!until) return { c: 'na', t: 'بدون تاريخ' };
    const t = Date.now();
    if (until <= t) { const d = rDay(t) - rDay(until); return { c: 'over', t: d ? 'انتهى قبل ' + arDays(d) : 'انتهى اليوم' }; }
    const d = rDay(until) - rDay(t); return { c: d <= 3 ? 'soon' : 'ok', t: d ? 'باقي ' + arDays(d) : 'ينتهي اليوم' };
  }
  const subOver = x => !x.banned && !x.ended && !x.end && x.until > 0 && x.until <= Date.now();
  const subCell = x => { if (x.banned || x.ended || x.end) return '<span class="sdt na">—</span>'; const L = subLeft(x.until); return `<span class="sdt ${L.c}"><b>${x.until ? admDay(x.until) : '—'}</b><small>${L.t}</small></span>`; };
  // اللي خلص موعده: قرار مباشر من الجدول — «＋ شهر» يمدّد على طول، و«⛔ إنهاء» يطلب تأكيد
  // (الكمبيوتر: تحت التاريخ · الجوال: سطر كامل تحت الصف فيه التاريخ والزرين)
  const subOverBtns = x => subOver(x) ? `<span class="sdx"><button type="button" class="sxm" data-sxm="${esc(x.email)}" title="تمديد اشتراكه شهر من اليوم">＋ شهر</button><button type="button" class="sxe" data-sxe="${esc(x.email)}" title="تأكيد إنهاء اشتراكه">⛔ إنهاء</button></span>` : '';
  // «+ شهر» من موعد النهاية (أو من اليوم لو خلص)
  async function subAddMonth(x, name) {
    try { const r = await admCall({ op: 'adm_sub_dates', email: x.email, add: 1 }); x.start = r.start; x.until = r.until; toast(`📅 ${name}: صار ينتهي ${admDay(r.until, 1)}`); return r; } catch (e) { toast('ما انحفظ: ' + e.message); return null; }
  }
  // تعديل البداية والنهاية (النهاية الافتراضية = نفس يوم البداية بعد شهر)
  function subDatesDlg(x, name) {
    return new Promise(res => {
      const ymd = t => t ? new Date(t + 3 * 3600000).toISOString().slice(0, 10) : '';
      const nextM = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if (!m) return ''; const last = new Date(Date.UTC(+m[1], +m[2] + 1, 0)).getUTCDate(); return new Date(Date.UTC(+m[1], +m[2], Math.min(+m[3], last))).toISOString().slice(0, 10); };
      const md = document.createElement('div'); md.className = 'modal'; md.innerHTML = `<div class="m sdlg" role="dialog" aria-modal="true" aria-labelledby="sdh"><h3 id="sdh">📅 موعد اشتراك ${esc(name)}</h3>
        <div class="sdgrid"><label><span>بداية الاشتراك</span><input type="date" id="sd_s" value="${ymd(x.start)}"></label><label><span>ينتهي في</span><input type="date" id="sd_u" value="${ymd(x.until)}"></label></div>
        <p class="mut sdhelp">لما تغيّر البداية، النهاية تصير نفس اليوم بعد شهر (وتقدر تغيّرها). الاشتراك يبقى شغّال لين آخر يوم النهاية.</p>
        <div class="acts"><button type="button" class="btn sm" id="sd_ok">حفظ</button><button type="button" class="btn sm ghost" id="sd_x">إلغاء</button></div></div>`;
      document.body.appendChild(md); const S = md.querySelector('#sd_s'), U = md.querySelector('#sd_u'), done = v => { md.remove(); res(v); };
      S.onchange = () => { const n = nextM(S.value); if (n) U.value = n; };
      md.onclick = e => { if (e.target === md) done(null); }; md.querySelector('#sd_x').onclick = () => done(null);
      md.onkeydown = e => { if (e.key === 'Escape') done(null); };
      md.querySelector('#sd_ok').onclick = async () => {
        if (!S.value || !U.value) return toast('اختر التاريخين'); if (U.value <= S.value) return toast('تاريخ النهاية لازم يكون بعد البداية');
        const b = md.querySelector('#sd_ok'); b.disabled = true;
        try { const r = await admCall({ op: 'adm_sub_dates', email: x.email, start: S.value, until: U.value }); x.start = r.start; x.until = r.until; toast(`📅 ${name}: ينتهي ${admDay(r.until, 1)}`); done(r); }
        catch (e) { toast('ما انحفظ: ' + e.message); b.disabled = false; }
      };
      setTimeout(() => S.focus(), 30);
    });
  }
  let ADM = { list: null, q: '', f: 'all', role: '', staff: null, members: null, mq: '', draft: '', subs: null, sf: 'all', sq: '', msub: 'free', regs: null, regsSync: null, regsAt: 0, rf: 'wait', rq: '', rt: {}, share: null };
  const isOwner = () => (ADM.role || auth.staff) === 'owner';
  const ROLE_T = { owner: '👑 مالك', admin: '🛡 مشرف كامل', viewer: '👁 متابعة فقط' };
  function admTop(tab) {
    return topbar(`<span class="ttl">👑 لوحة الإدارة</span><span class="sp"></span><a class="tn" href="${SHEET_URL}" target="_blank" rel="noopener" title="فتح الشيت"><span class="i">📊</span><span class="l">الشيت</span></a><button class="ib" id="admref" title="تحديث">⟳</button>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) +
      `<main class="wrap" id="admw"><div class="atabs"><a href="#admin" class="${tab === 'students' ? 'on' : ''}">👥 الطلاب${ADM.list ? ` <small>${ADM.list.length}</small>` : ''}</a>${isOwner() ? `<a href="#admin-regs" class="${tab === 'regs' ? 'on' : ''}">${regTabLabel()}</a>` : ''}${isOwner() ? `<a href="#admin-members" class="${tab === 'members' ? 'on' : ''}">➕ المشتركون${ADM.members ? ` <small>${ADM.members.length}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-subs" class="${tab === 'subs' ? 'on' : ''}">💳 الاشتراكات</a>` : ''}${isOwner() ? `<a href="#admin-free" class="${tab === 'free' ? 'on' : ''}">🆓 الزوار${ADM.free ? ` <small>${ADM.free.total}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-ai" class="${tab === 'ai' ? 'on' : ''}">🤖 المساعد${ADM.ai && ADM.ai.flagged ? ` <small class="red">${ADM.ai.flagged}</small>` : ''}</a>` : ''}${isOwner() ? `<a href="#admin-find" class="${tab === 'find' ? 'on' : ''}">🔎 البحث</a>` : ''}${isOwner() || auth.adv || (ADM.staff && ADM.staff.myAdv) ? `<a href="#admin-adv" class="${tab === 'adv' ? 'on' : ''}">${advTab()}</a>` : ''}<a href="#admin-staff" class="${tab === 'staff' ? 'on' : ''}">🛡 المشرفون${ADM.staff ? ` <small>${ADM.staff.owners.length + ADM.staff.staff.length}</small>` : ''}</a><a href="#studio" class="${tab === 'studio' ? 'on' : ''}">🎬 استوديو تيك توك</a>${ADM.role ? `<span class="myrole">صلاحيتك: <b>${ROLE_T[ADM.role] || ADM.role}</b></span>` : ''}</div><div id="adm"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
  }
  async function admLoadStaff(force) { if (ADM.staff && !force) { regsSoon(); return ADM.staff; } const r = await admCall({ op: 'adm_staff_list' }); ADM.staff = r; ADM.role = r.myRole || ''; if (auth.staff !== ADM.role) { auth.staff = ADM.role; lsSet(LS.auth, auth); } regsSoon(); return r; }
  async function admCall(body) { const r = await api(Object.assign({ session: auth.session }, body)); if (!r.ok) { if (r.error === 'kicked' || r.error === 'session') return logout(esc(r.msg || '')); throw new Error(r.msg || r.error); } return r; }
  async function renderAdmin() {
    document.title = 'لوحة الإدارة | Q-Guide';
    app.innerHTML = admTop('students');
    bindCtl(); $('#admref').onclick = () => { ADM.list = null; ADM.staff = null; renderAdmin(); };
    try { const [st] = await Promise.all([ADM.list ? null : admCall({ op: 'adm_students' }), admLoadStaff()]); if (st) { ADM.list = st.students; ADM.ever = st.ever; } } catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin') return;
    app.innerHTML = admTop('students'); bindCtl(); $('#admref').onclick = () => { ADM.list = null; ADM.staff = null; renderAdmin(); };
    paintAdmin();
  }
  function paintAdmin() {
    const W = $('#adm'); if (!W) return; const all = ADM.list; const day = Date.now() - 86400000;
    const OW = isOwner(), stats = { n: all.filter(s => !s.banned && !s.ended).length, banned: all.filter(s => s.banned).length, today: all.filter(s => s.lastLogin > day).length, never: all.filter(s => !s.logins && !s.banned).length, over: all.filter(subOver).length };
    if (ADM.f === 'over' && !OW) ADM.f = 'all';
    const q = ADM.q.trim().toLowerCase();
    let list = all.filter(s => !q || [s.name, s.display, s.email, s.typed, s.phone, s.user].some(x => String(x || '').toLowerCase().includes(q)));
    if (ADM.f === 'banned') list = list.filter(s => s.banned); else if (ADM.f === 'today') list = list.filter(s => s.lastLogin > day); else if (ADM.f === 'never') list = list.filter(s => !s.logins && !s.banned); else if (ADM.f === 'over') list = list.filter(subOver);
    if (ADM.f === 'over') list.sort((a, b) => a.until - b.until); else list.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));   // ⏰ اللي خلص شهره من زمان أول
    W.innerHTML = `<div class="astats${OW ? ' n6' : ''}">${OW && ADM.ever != null ? `<div class="ever" title="كل اللي اشتركوا في الدورة من بدايتها: الحاليين واللي انتهى اشتراكهم أو انحذفوا (ما يحسب المشرفين وحسابات التجربة)"><b>${ADM.ever}</b><span>🎓 كل اللي اشتركوا</span></div>` : ''}<div><b>${stats.n}</b><span>طالب مشترك الحين</span></div><div><b>${stats.today}</b><span>دخل آخر 24 ساعة</span></div><div><b>${stats.never}</b><span>لم يدخل الموقع</span></div>${OW ? `<button type="button" class="over${ADM.f === 'over' ? ' on' : ''}" data-f="${ADM.f === 'over' ? 'all' : 'over'}" title="اللي مر على اشتراكهم شهر كامل (خلص موعده)"><b>${stats.over}</b><span>⏰ مر عليهم شهر</span></button>` : ''}<div class="bad"><b>${stats.banned}</b><span>محظور</span></div></div>
      <div class="abar"><input id="aq" type="search" placeholder="ابحث بالاسم أو الإيميل أو الجوال أو اليوزر…" value="${esc(ADM.q)}"><div class="tabs sm">${[['all', 'الكل'], ['today', 'نشط اليوم'], ['never', 'لم يدخل']].concat(OW ? [['over', '⏰ مر عليه شهر']] : [], [['banned', 'محظور']]).map(([k, t]) => `<button data-f="${k}" class="${ADM.f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      ${ADM.f === 'over' ? `<div class="rgsync warn overnote">⏰ هذول مر على اشتراكهم شهر كامل (من وقت تسجيلهم). لو جدّد الطالب اضغط «＋ شهر» تحت تاريخه، ولو ما جدّد اضغط «⛔ إنهاء».</div>` : ''}
      <div class="atable${OW ? ' dt' : ''}"><div class="arow head"><span class="c-st">الطالب</span><span class="c-ph">الجوال</span><span class="c-n">الأقسام</span><span class="c-n">المحاكي</span><span class="c-dt">آخر دخول</span>${OW ? '<span class="c-sub">ينتهي الاشتراك</span>' : ''}<span class="c-act">إجراءات</span></div>
      ${list.map(s => `<div class="arow ${s.banned ? 'banned' : ''}${OW && subOver(s) ? ' hasx' : ''}" data-e="${esc(s.email)}"><span class="c-st">${avatarHtml(s.avatar, s.display || s.name, 36)}<span class="who"><b>${esc(s.display || s.name || '—')}${s.display && s.display !== s.name ? ` <small class="mut">(${esc(s.name)})</small>` : ''}</b><small>${esc(s.typed || s.email)}${s.user ? ' · @' + esc(s.user) : ''}${s.manual ? (s.added_by === 'salla' ? ' · <span class="bdg pay">🛍 دفع عن طريق سلة</span>' : s.added_by === 'tap' ? ' · <span class="bdg pay">💳 دفع من الموقع</span>' : ' · <span class="bdg man">➕ من اللوحة</span>') : ''}${s.banned ? ' · <span class="bdg">⛔ محظور</span>' : s.ended ? ' · <span class="bdg">⛔ اشتراكه منتهي</span>' : s.session ? ' · <span class="bdg on">متصل</span>' : ''}</small>${OW && !s.banned && !s.ended && s.until ? (() => { const L = subLeft(s.until); return `<small class="sdm ${L.c}">⏰ ينتهي ${admDay(s.until)} · ${L.t}</small>`; })() : ''}</span></span><span class="c-ph ltr">${esc(s.phone || '—')}</span><span class="c-n">${s.results}</span><span class="c-n">${s.exams}</span><span class="c-dt">${fmtD(s.lastLogin)}</span>${OW ? `<span class="c-sub">${subCell(s)}${subOverBtns(s)}</span>` : ''}<span class="c-act"><button class="btn sm ghost" data-view="${esc(s.email)}">عرض</button>${OW ? `<a class="btn sm ghost rpb" href="#admin-report/${encodeURIComponent(s.email)}" title="التقرير الشامل" aria-label="التقرير الشامل لـ${esc(s.display || s.name || s.email)}">📊</a>` : ''}${ADM.role === 'viewer' ? '' : s.banned ? `<button class="btn sm" data-unban="${esc(s.email)}">فك الحظر</button>` : OW && s.ended ? `<button class="btn sm gone" data-gone="${esc(s.email)}" title="اشتراكه منتهي: احذفه من القائمة">🗑 حذف</button>` : `<button class="btn sm danger" data-ban="${esc(s.email)}">حظر</button>`}</span>${OW && subOver(s) ? `<div class="sdxrow"><small class="sdt over"><b>⏰ ${admDay(s.until)}</b> · ${subLeft(s.until).t}</small>${subOverBtns(s)}</div>` : ''}</div>`).join('') || '<div class="center mut" style="padding:30px">لا نتائج</div>'}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">${list.length} من ${all.length} · الحظر دائم: يمنع دخول الموقع فوراً، ويطرد الجلسة، وخلال دقيقة يتحوّل في الشيت إلى "محظور" مع سحب الوصول لاختبارات الفورمز وملفات المذكرة. ${isOwner() ? 'لإضافة مشتركين استخدم تبويب «➕ المشتركون» أو الشيت، وبيانات طلاب الشيت تتعدّل من الشيت.' : 'لإضافة طالب أو تعديل بياناته استخدم الشيت.'}</p>`;
    $('#aq').oninput = e => { ADM.q = e.target.value; const pos = e.target.selectionStart; paintAdmin(); const i = $('#aq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { ADM.f = b.dataset.f; paintAdmin(); });
    W.querySelectorAll('[data-view]').forEach(b => b.onclick = () => admStudent(b.dataset.view));
    W.querySelectorAll('.arow[data-e]').forEach(r => r.onclick = e => { if (e.target.closest('button,a')) return; admStudent(r.dataset.e); });
    W.querySelectorAll('[data-ban]').forEach(b => b.onclick = () => admBan(b.dataset.ban));
    W.querySelectorAll('[data-unban]').forEach(b => b.onclick = () => admUnban(b.dataset.unban));
    W.querySelectorAll('[data-gone]').forEach(b => b.onclick = async () => { const x = all.find(y => y.email === b.dataset.gone); if (!x) return;
      b.disabled = true; if (await subGoneOne(x.email, x.display || x.name || x.email)) { ADM.list = all.filter(y => y.email !== x.email); paintAdmin(); } else b.disabled = false; });
    // ⏰ خلص موعده: «＋ شهر» مباشر · «⛔ إنهاء» بعد التأكيد — الصف يتحدّث مكانه بدون إعادة تحميل
    const stOf = e => all.find(x => x.email === e), nmOf = x => x.display || x.name || x.email;
    const lock = (e, on) => W.querySelectorAll(`.arow[data-e="${CSS.escape(e)}"] .sdx button`).forEach(b => b.disabled = on);
    W.querySelectorAll('[data-sxm]').forEach(b => b.onclick = async () => {
      const x = stOf(b.dataset.sxm); if (!x) return; lock(x.email, true);
      if (await subAddMonth(x, nmOf(x))) { ADM.subs = null; paintAdmin(); } else lock(x.email, false); });
    W.querySelectorAll('[data-sxe]').forEach(b => b.onclick = async () => {
      const x = stOf(b.dataset.sxe); if (!x) return; lock(x.email, true);
      const at = await subEndOne(x.email, nmOf(x)); ADM.list = all;   // subEndOne يصفّر القائمة — نرجّعها ونعلّم الصف بس
      if (at) { x.ended = 1; x.session = 0; ADM.subs = null; paintAdmin(); } else lock(x.email, false); });
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
      ${d.ended && !d.ban ? `<div class="sum bad" style="padding:10px 14px;margin-bottom:10px">⛔ اشتراكه منتهي منذ ${fmtD(d.ended.at)}: يدخل بالحساب المجاني بس.${isOwner() ? ' <button class="lnk" id="a_srest">↩️ إرجاع الاشتراك</button> <button class="lnk dng" id="a_gone">🗑 حذف من القائمة</button>' : ''}</div>` : ''}
      ${mb ? `<div class="sum mbox">${mb.added_by === 'salla' ? '🛍 اشترك بالدفع عن طريق سلة' : mb.added_by === 'tap' ? '💳 اشترك بالدفع من الموقع' : '➕ مشترك أُضيف من اللوحة بواسطة ' + esc((mb.added_by || '').split('@')[0])} · ${fmtD(mb.added_at)}${isOwner() ? ' <button class="lnk" id="a_mrm">حذف الاشتراك</button>' : ''}</div>` : ''}
      <div class="kv"><div><span>${mb ? 'الاسم' : 'الاسم في الشيت'}</span><b>${esc((mb ? mb.name : st.name) || '—')}</b></div><div><span>الجوال</span><b class="ltr">${esc(st.phone || '—')}</b></div><div><span>الجنس</span><b>${esc(st.gender || '—')}</b></div><div><span>يوزر يوتيوب</span><b>${esc(st.user || '—')}</b></div><div><span>الاسم المعروض</span><b>${esc(pf.name || '—')}</b></div><div><span>المدرسة</span><b>${esc(pf.school || '—')}</b></div><div><span>آخر دخول</span><b>${d.logins[0] ? fmtD(d.logins[0].ts) : 'لم يدخل'}</b></div></div>
      ${isOwner() && (d.student || d.member) && !d.ban ? (() => { const D = d.dates || {}, L = subLeft(D.until);
        return `<div class="sdbox ${d.ended ? 'na' : L.c}"><div class="sdl"><span>📅 بداية الاشتراك <b>${D.start ? admDay(D.start, 1) : '—'}</b></span><span>⏰ ينتهي <b>${D.until ? admDay(D.until, 1) : '—'}</b>${d.ended ? '' : ` <em>${L.t}</em>`}</span></div>
          <div class="sdb"><button class="btn sm" id="a_sm">＋ شهر</button><button class="btn sm ghost" id="a_sd">تعديل التاريخ</button></div></div>`; })() : ''}
      <div class="acts">${isOwner() ? `<a class="btn sm gold" href="#admin-report/${encodeURIComponent(email)}" id="a_rep">📊 التقرير الشامل</a>` : ''}<button class="btn sm ghost" id="a_name">✏️ تعديل الاسم المعروض</button><button class="btn sm ghost" id="a_av">🖼 مسح الصورة</button><button class="btn sm ghost" id="a_kick">⎋ طرد الجلسة</button>${isOwner() && !d.ban && !d.ended && (d.student || d.member) ? '<button class="btn sm ghost dang" id="a_send">⛔ إنهاء الاشتراك</button>' : ''}${d.ban ? `<button class="btn sm" id="a_unban">فك الحظر</button>` : `<button class="btn sm danger" id="a_ban">⛔ حظر نهائي</button>`}</div>
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
    const se = m.querySelector('#a_send'); if (se) se.onclick = async () => { m.remove(); if (await subEndOne(email, pf.name || st.name || (mb && mb.name) || email)) again(); };
    const sr = m.querySelector('#a_srest'); if (sr) sr.onclick = async () => { m.remove(); if (await subRestoreOne(email, pf.name || st.name || (mb && mb.name) || email)) again(); };
    const sg = m.querySelector('#a_gone'); if (sg) sg.onclick = async () => { m.remove(); if (await subGoneOne(email, pf.name || st.name || (mb && mb.name) || email)) again(); };
    const nmS = pf.name || st.name || (mb && mb.name) || email, dx = Object.assign({ email }, d.dates || {});
    const sm = m.querySelector('#a_sm'); if (sm) sm.onclick = async () => { sm.disabled = true; if (await subAddMonth(dx, nmS)) { m.remove(); ADM.list = null; admStudent(email); } else sm.disabled = false; };
    const sd = m.querySelector('#a_sd'); if (sd) sd.onclick = async () => { if (await subDatesDlg(dx, nmS)) { m.remove(); ADM.list = null; admStudent(email); } };
    const rp = m.querySelector('#a_rep'); if (rp) rp.onclick = () => m.remove();
    const rr = m.querySelector('#a_rr'); if (rr) rr.onclick = async () => { if (!await QGDlg.confirm('حذف كل نتائج الأقسام لهذا الطالب؟ (تؤثر على لوحة الصدارة)', { danger: true })) return; try { await admCall({ op: 'adm_reset_results', email }); toast('تم'); again(); } catch (e) { toast(e.message); } };
    m.querySelectorAll('[data-rx]').forEach(b => b.onclick = async () => { if (!await QGDlg.confirm('حذف كل محاولات ' + b.dataset.rx + ' لهذا الطالب ليبدأه من جديد؟', { danger: true })) return; try { await admCall({ op: 'adm_reset_exam', email, test: b.dataset.rx }); toast('تم'); again(); } catch (e) { toast(e.message); } });
    if (ADM.role === 'viewer') m.querySelectorAll('#a_name,#a_av,#a_kick,#a_ban,#a_unban,#a_rr,[data-rx]').forEach(x => x.remove());
  }
  // ---------- 📊 التقرير الشامل للطالب (المالك): كل اللي يبين هل ذاكر فعلاً ----------
  const RP_TYPE = { yt: '▶️ مشترك يوتيوب', free: '🎁 اشتراك مجاني', bank: '🏦 تحويل بنكي', pay: '💳 دفع من الموقع' };
  const rpSet = id => id === 'qall' ? 'الشامل كمي' : id === 'vall' ? 'الشامل لفظي' : id === 'v15' ? 'الأسئلة الجديدة' : /^q\d+$/.test(id) ? 'القسم ' + id.slice(1) : /^v\d+$/.test(id) ? 'النموذج ' + id.slice(1) : id;
  const rpVid = k => { const m = /^([a-z]+):(.+)$/.exec(k || ''); if (!m) return k; if (m[1] === 'sf') return 'تأسيس الكمي: ' + (QR_L[+m[2] - 1] || [k])[0]; if (m[1] === 'af') return 'تأسيس اللفظي: ' + (PART_AR[+m[2]] || k); if (m[1] === 'at') return 'تدريب عبدالله: النموذج ' + m[2];
    return m[2] === 'rules' ? (m[1] === 'q' ? 'قواعد الكمي' : 'قواعد اللفظي') : k === 'v:15' ? 'الأسئلة الجديدة' : (m[1] === 'q' ? 'القسم ' : 'النموذج ') + m[2]; };
  const rpDur = x => { x = Math.max(0, Math.round(x || 0)); const h = Math.floor(x / 3600), m = Math.round(x % 3600 / 60); return h ? h + ' س' + (m ? ' ' + m + ' د' : '') : m ? m + ' د' : x ? 'أقل من دقيقة' : '—'; };
  const rpN = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? n + ' ' + few : n + ' ' + many;
  const pctC = p => p == null ? 'none' : p >= 80 ? 'hi' : p >= 60 ? 'mid' : 'lo';
  async function renderReport(email) {
    const h0 = location.hash; document.title = 'التقرير الشامل | Q-Guide';
    const top = () => topbar(`<span class="ttl">📊 التقرير الشامل</span><span class="sp"></span><button class="ib" id="rpprint" title="طباعة أو حفظ PDF">🖨</button><button class="ib" id="rpref" title="تحديث">⟳</button>`, `<a class="ib" href="#admin" title="رجوع للطلاب">→</a>`);
    app.innerHTML = top() + '<main class="wrap rpt" id="rpt"><div class="center"><div class="spin" style="margin:0 auto"></div></div></main>';
    bindCtl(); $('#rpref').onclick = () => renderReport(email); $('#rpprint').onclick = () => window.print();
    try { await admLoadStaff(); } catch (e) {}
    const W = () => $('#rpt');
    if (!isOwner()) { if (W()) W().innerHTML = '<div class="sum">🔒 التقرير الشامل للمالك فقط.</div>'; return; }
    let d; try { d = await admCall({ op: 'adm_report', email }); } catch (e) { if (W()) W().innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== h0 || !W()) return;
    const w = d.who || {}, S = d.sub || {}, T = d.totals || {}, nm = w.display || w.name || email.split('@')[0];
    document.title = 'تقرير ' + nm + ' | Q-Guide';
    // 🧾 الاشتراك
    const L = subLeft(S.until), status = S.ban ? `<span class="rpst bad">⛔ محظور ${fmtD(S.ban.at)}</span>` : S.ended ? `<span class="rpst bad">⛔ اشتراكه منتهي ${fmtD(S.ended.at)}</span>` : L.c === 'over' ? `<span class="rpst warn">⏰ مر على اشتراكه شهر</span>` : `<span class="rpst ok">✅ مشترك</span>`;
    const chips = [w.phone ? `<span class="ltr">📞 ${esc(w.phone)}</span>` : '', w.user ? `<span class="ltr">▶️ @${esc(w.user)}</span>` : '', w.src === 'panel' ? `<span>➕ أضفته من اللوحة${w.added && w.added.at ? ' ' + admDay(w.added.at, 1) : ''}</span>` : w.src === 'sheet' ? '<span>📊 من الشيت</span>' : '', w.gender ? `<span>${esc(w.gender)}</span>` : ''].filter(Boolean).join('');
    // 📚 الأقسام والنماذج: أول محاولة في كل واحد
    const SETS = {}; (d.sets || []).forEach(x => SETS[x.id] = x);
    const cell = (id, lab) => { const x = SETS[id], f = x && x.first, b = x && x.best;
      const tip = x ? `${rpSet(id)}: أول محاولة ${f ? f.pct + '% (' + f.c + '/' + f.n + ')' : '—'} · أفضل ${b ? b.pct + '%' : '—'} · ${rpN(x.att, 'محاولة وحدة', 'محاولتين', 'محاولات', 'محاولة')} · آخر مرة ${admDay(x.last && x.last.ts, 1)}` : rpSet(id) + ': ما حلّه';
      return `<div class="rpc ${pctC(f ? f.pct : b ? b.pct : null)}" title="${esc(tip)}"><b>${lab}</b><span>${f ? f.pct + '%' : b ? b.pct + '%' : '—'}</span><small>${x ? (x.att > 1 ? x.att + ' مرات' : 'مرة') : 'ما حلّه'}</small></div>`; };
    const qIds = Array.from({ length: 14 }, (_, i) => 'q' + (i + 1)), vIds = Array.from({ length: 15 }, (_, i) => 'v' + (i + 1));
    const done = [...qIds, ...vIds].filter(id => SETS[id]).length;
    const allLine = ['qall', 'vall'].filter(id => SETS[id]).map(id => { const x = SETS[id]; return `<span>🧾 ${rpSet(id)}: أفضل ${x.best.pct}% · ${rpN(x.att, 'مرة', 'مرتين', 'مرات', 'مرة')}</span>`; }).join('');
    // 🧪 المحاكي
    const tests = (d.tests || []).slice().sort((a, b) => +a.test.slice(1) - +b.test.slice(1));
    const tDone = tests.filter(t => t.first), avg = tDone.length ? Math.round(tDone.reduce((a, t) => a + t.first.pct, 0) / tDone.length) : null;
    const tRows = tests.map(t => `<div class="rpr"><span><b>الاختبار المحاكي ${esc(t.test.slice(1))}</b></span><span data-l="أول محاولة" class="${pctC(t.first ? t.first.pct : null)}">${t.first ? t.first.pct + '%' : 'ما خلّصه'}</span><span data-l="أفضل">${t.best ? t.best.pct + '%' : '—'}</span><span data-l="اللفظي">${t.first && t.first.vpct != null ? t.first.vpct + '%' : '—'}</span><span data-l="الكمي">${t.first && t.first.qpct != null ? t.first.qpct + '%' : '—'}</span><span data-l="المحاولات">${t.att}</span><span data-l="آخر مرة" class="mut">${admDay(t.last, 1)}</span></div>`).join('');
    // 📅 آخر 5 أسابيع: كل يوم حسب نشاطه
    const cal = d.cal || [], dn = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'], dn1 = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
    const wd = t => new Date(t + 3 * 3600000).getUTCDay(), pad = cal.length ? wd(cal[0].d) : 0;
    const lvl = x => { const v = x.q + x.e * 40; return v >= 60 ? 4 : v >= 30 ? 3 : v >= 10 ? 2 : v > 0 ? 1 : 0; };
    const calHtml = dn.map((x, i) => `<i class="h" title="${x}"><span class="hl">${x}</span><span class="hs">${dn1[i]}</span></i>`).join('') + '<i class="p"></i>'.repeat(pad) + cal.map(x => { const parts = [x.q ? rpN(x.q, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال') : '', x.e ? (x.e > 1 ? x.e + ' اختبارات محاكية' : 'اختبار محاكي') : '', x.l ? 'دخل الموقع' : ''].filter(Boolean);
      return `<i class="l${lvl(x)}${!x.q && !x.e && x.l ? ' lg' : ''}${rDay(x.d) === rDay(Date.now()) ? ' td' : ''}" title="${esc(new Date(x.d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }) + ': ' + (parts.join(' · ') || 'ما فيه نشاط'))}"></i>`; }).join('');
    const act5 = cal.filter(x => x.q || x.e || x.l).length, q7 = cal.slice(-7).reduce((a, x) => a + x.q, 0), best = cal.reduce((a, x) => x.q > (a ? a.q : 0) ? x : a, null);
    const calSide = `<div class="rpacts">
        <div><span>✍️ أسئلة آخر 7 أيام</span><b>${q7 ? rpN(q7, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال') : 'ولا سؤال'}</b></div>
        <div><span>📅 أيام فيها نشاط</span><b>${act5} <small>من 35 يوم</small></b></div>
        <div><span>🔥 أكثر يوم</span><b>${best ? rpN(best.q, 'سؤال واحد', 'سؤالين', 'أسئلة', 'سؤال') + ` <small>${admDay(best.d)}</small>` : '—'}</b></div>
        <div><span>⏱ آخر نشاط</span><b>${T.last ? fmtD(T.last) : '—'}</b></div>
        <div><span>🗓 أول نشاط</span><b>${T.first ? admDay(T.first, 1) : '—'}</b></div></div>`;
    // 📱 الدخول والأجهزة · ⚔️ · 🤖 · 🔎 · 🎬 · 🔔
    const LG = d.logins || {}, A = d.arena, AI = d.ai || {}, F = d.find || {}, V = d.vids || [];
    const card = (ic, t, body) => `<section class="rpcard rpu"><h3><span aria-hidden="true">${ic}</span>${t}</h3>${body}</section>`;
    const kv = rows => `<div class="rpkv">${rows.filter(Boolean).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    const usage = [
      card('🔑', 'الدخول والأجهزة', LG.n ? kv([['مرات الدخول', LG.n], ['أول دخول', admDay(LG.first, 1)], ['آخر دخول', fmtD(LG.last)]]) + `<div class="rpdev">${(LG.devs || []).map(x => `<span>${esc(x.k)} <small>×${x.n}</small></span>`).join('')}</div>` : '<p class="mut">ما دخل الموقع للحين.</p>'),
      card('⚔️', 'الساحة 1v1', A && A.games ? kv([['التصنيف', A.rating + (A.rank ? ` <small class="mut">(#${A.rank})</small>` : '')], ['المباريات', A.games], ['فوز · خسارة · تعادل', `${A.wins} · ${A.losses} · ${A.draws || 0}`], ['آخر مباراة', fmtD(A.last_at)]]) : '<p class="mut">ما لعب في الساحة.</p>'),
      card('🤖', 'المساعد الذكي', AI.n || AI.f ? kv([['شروحات طلبها', AI.n], ['أسئلة متابعة', AI.f], ['أسئلة مختلفة', AI.q], ['بلاغات «الشرح فيه غلط»', AI.fl || 0], ['لغة الرد', AI.lang === 'en' ? 'English' : 'عربي'], ['آخر مرة', fmtD(AI.last)]]) : `<p class="mut">ما استخدم المساعد.${AI.lang === 'en' ? ' (لغة الرد: English)' : ''}</p>`),
      card('🔎', 'ابحث عن سؤال', F.n ? kv([['عمليات البحث', F.n], ['بلاغات', F.rep || 0], ['آخر بحث', fmtD(F.last)]]) : '<p class="mut">ما استخدم البحث.</p>'),
      card('🎬', 'مقاطع الشرح داخل الموقع', V.length ? `<div class="rpvid">${V.slice().sort((a, b) => b.last - a.last).map(x => `<span>${esc(rpVid(x.v))} <small>${x.n > 1 ? '×' + x.n : ''}</small></span>`).join('')}</div>` : `<p class="mut">${S.t === 'yt' ? 'مشترك يوتيوب: يشوف المقاطع في القناة (ما نقدر نتابعها من هنا).' : 'ما فتح أي مقطع داخل الموقع.'}</p>`),
      card('🔔', 'التذكير اليومي', d.push ? `<p><b>مفعّل</b>${d.push.mins != null ? ` <span class="mut">الساعة <bdi dir="ltr">${String(Math.floor(d.push.mins / 60)).padStart(2, '0')}:${String(d.push.mins % 60).padStart(2, '0')}</bdi></span>` : ''}</p>` : '<p class="mut">مو مفعّل.</p>')].join('');
    W().innerHTML = `<section class="rphead">
        <div class="rpwho">${avatarHtml(w.avatar, nm, 64)}<div class="rpwt"><h1>${esc(nm)}${w.display && w.name && w.display !== w.name ? ` <small>(${esc(w.name)})</small>` : ''}</h1><p class="ltr rpem">${esc(email)}</p><p class="rpch">${status}${chips}</p></div></div>
        <div class="rpsub ${S.ended || S.ban ? 'na' : L.c}"><div><span>نوع الاشتراك</span><b>${RP_TYPE[S.t] || '—'}</b></div><div><span>📅 بداية الاشتراك</span><b>${admDay(S.start, 1)}</b></div><div><span>⏰ ينتهي</span><b>${admDay(S.until, 1)}</b>${S.ended || S.ban || !S.until ? '' : `<em>${L.t}</em>`}</div>
          ${S.ban ? '' : '<div class="rpsb"><button class="btn sm" id="rp_sm">＋ شهر</button><button class="btn sm ghost" id="rp_sd">تعديل التاريخ</button></div>'}</div></section>
      <section class="rptiles">
        <div><span class="i" aria-hidden="true">✍️</span><b>${T.answered || 0}</b><span>سؤال حلّه</span></div>
        <div><span class="i" aria-hidden="true">🎯</span><b>${T.answered ? Math.round(T.correct * 100 / T.answered) + '%' : '—'}</b><span>الدقة${T.answered ? ` · ${T.correct} صح` : ''}</span></div>
        <div><span class="i" aria-hidden="true">⏱</span><b>${rpDur(T.secs)}</b><span>وقت الحل</span></div>
        <div><span class="i" aria-hidden="true">📚</span><b><bdi>${done}/29</bdi></b><span>قسم ونموذج حلّها</span></div>
        <div><span class="i" aria-hidden="true">🧪</span><b><bdi>${tDone.length}/17</bdi></b><span>اختبار محاكي${avg != null ? ` · متوسط ${avg}%` : ''}</span></div>
        <div><span class="i" aria-hidden="true">📅</span><b>${T.days || 0}</b><span>يوم نشاط${T.last ? ` · آخر نشاط ${fmtD(T.last)}` : ''}</span></div></section>
      <section class="rpcard"><div class="rph"><h2>📅 النشاط آخر 5 أسابيع</h2><span class="mut">كل مربع يوم، ولونه حسب عدد الأسئلة اللي حلها</span></div>
        <div class="rpactw"><div class="rpcal" role="img" aria-label="نشاط الطالب آخر 5 أسابيع">${calHtml}</div>${calSide}</div>
        <div class="rpleg"><span>أقل</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>أكثر</span><i class="l0 lg"></i><span>دخل بس</span></div></section>
      <div class="rp2">
        <section class="rpcard"><div class="rph"><h2>📐 الكمي</h2><span class="mut">نسبة أول محاولة في كل قسم</span></div><div class="rpgrid">${qIds.map((id, i) => cell(id, i + 1)).join('')}</div></section>
        <section class="rpcard"><div class="rph"><h2>📖 اللفظي</h2><span class="mut">نسبة أول محاولة في كل نموذج</span></div><div class="rpgrid">${vIds.map((id, i) => cell(id, i === 14 ? 'جديدة' : i + 1)).join('')}</div></section></div>
      <div class="rpkey"><span><i class="hi"></i>80% فأكثر</span><span><i class="mid"></i>60–79%</span><span><i class="lo"></i>أقل من 60%</span><span><i class="none"></i>ما حلّه</span>${allLine}</div>
      <section class="rpcard"><div class="rph"><h2>🧪 الاختبارات المحاكية</h2><span class="mut">${tDone.length ? `خلّص ${rpN(tDone.length, 'اختبار واحد', 'اختبارين', 'اختبارات', 'اختبار')} من 17` : 'ما خلّص أي اختبار'}</span></div>
        ${tests.length ? `<div class="rptbl"><div class="rpr head"><span>الاختبار</span><span>أول محاولة</span><span>أفضل</span><span>اللفظي</span><span>الكمي</span><span>المحاولات</span><span>آخر مرة</span></div>${tRows}</div>` : '<p class="mut">ما بدأ أي اختبار محاكي.</p>'}</section>
      <section class="rpcard rpsk">${skillsBarsHtml(d.skills && d.skills.data ? histAgg(JSON.parse(d.skills.data)) : null, true)}</section>
      <div class="rpus">${usage}</div>
      <p class="mut rpft">التقرير وقت ${new Date(d.t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })} · الأسئلة والوقت من الأقسام والنماذج اللي خلّصها (المحاكي لحاله).</p>`;
    const x = { email, start: S.start, until: S.until };
    const sm = $('#rp_sm'); if (sm) sm.onclick = async () => { sm.disabled = true; if (await subAddMonth(x, nm)) { ADM.list = null; renderReport(email); } else sm.disabled = false; };
    const sd = $('#rp_sd'); if (sd) sd.onclick = async () => { if (await subDatesDlg(x, nm)) { ADM.list = null; renderReport(email); } };
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
    if (ref === 'chat') return '🙋 محادثة عامة (تحتاج مساعدة؟)';
    return ref;
  }
  // 💬 السجل كمحادثات: رسائل الطالب على نفس السؤال ورا بعض (المحادثة الجديدة تبدأ لما يرجع الشرح الأول)
  const AI_IT = { memo: 'يسأل عن الحفظ (يكفي؟ أحفظ ولا أفهم؟)', study: 'يسأل وش يذاكر', weak: 'يسأل عن مستواه وضعفه', tips: 'يبي نصايح للاختبار', solve: 'يبي حل سؤال من برا الدورة', vague: 'ما فهم ويبي شرح أبسط', rule: 'يبي القاعدة اللي يحفظها', step: 'يسأل عن خطوة في الحل', diff: 'يقارن بين خيارين', example: 'يبي مثال مشابه', fast: 'يبي طريقة أسرع', meaning: 'يسأل عن معنى كلمة', key: 'يشك في الإجابة المعتمدة', mine: 'يسأل ليش إجابته غلط', opt: 'يسأل عن خيار معيّن', ack: 'رد بكلمة قصيرة (فهم أو شكر)' };
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
    const msg = m => (m.turn > 1 || c.ref === 'chat'
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
  const SUB_N = { yt: ['▶️', 'يوتيوب'], free: ['🎁', 'مجاني'], bank: ['🏦', 'تحويل بنكي'], pay: ['💳', 'دفع إلكتروني'] };   // 💳 = دفع من الموقع (Tap)
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
      <p class="sbhelp">هذي طلبات فورم «المقدمة». اختر نوع اشتراكه واضغط «تأكيد»: الشيت يأكده خلال دقيقة ويكمّل لحاله (إيميل التأكيد، فتح الاختبارات، ملف المرشد)، وبعدها يدخل الموقع. لو اخترت تحويل أو مجاني، يشوف مقاطع الشرح داخل الموقع.</p>
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
  // 💳 الدفع من الموقع (Tap): وضعه (تجربة/شغّال) + آخر العمليات — الضغط على عملية يفتح بطاقة الطالب
  const PB_ST = { PAID: ['ok', '✅ تم الدفع'], INITIATED: ['na', '⏳ ما كمّل الدفع'], NEW: ['na', '⏳ ما كمّل الدفع'], DECLINED: ['bad', '❌ البطاقة مرفوضة'], FAILED: ['bad', '❌ فشل الدفع'], CANCELLED: ['na', '↩️ ألغى الدفع'], ABANDONED: ['na', '↩️ ترك الدفع'], MISMATCH: ['warn', '⚠️ راجعها: المبلغ ما يطابق'], ERROR: ['warn', '⚠️ ما انفتحت صفحة الدفع'] };
  const PB_M = { MADA: 'مدى', VISA: 'فيزا', MASTERCARD: 'ماستركارد', MASTER: 'ماستركارد', APPLE_PAY: 'Apple Pay', APPLEPAY: 'Apple Pay', AMEX: 'أمريكان إكسبريس', AMERICAN_EXPRESS: 'أمريكان إكسبريس', STC_PAY: 'STC Pay', STCPAY: 'STC Pay', GOOGLE_PAY: 'Google Pay' };
  function payBox(PY) {
    if (!PY || (!PY.mode && !PY.rows.length)) return '';
    const mode = PY.mode === 'live' ? (PY.open ? '<span class="pbmode live">🟢 شغّال لكل الزوار</span>' : `<span class="pbmode wait">🔒 دفع حقيقي: يطلع بس لك وللمختبرين${PY.testers.length ? ` (${PY.testers.length})` : ''}</span>`)
      : PY.mode === 'test' ? `<span class="pbmode test">🧪 وضع التجربة: يطلع بس لك وللمختبرين${PY.testers.length ? ` (${PY.testers.length})` : ''}</span>` : '<span class="pbmode off">⏸ متوقف: مفتاح تاب مو موجود</span>';
    // 🚀 بالمفتاح الحقيقي: المالك يفتح الدفع لكل الزوار بعد ما يجرّبه بنفسه (أو يوقفه)
    const openBar = PY.mode !== 'live' ? '' : PY.open ? '<div class="pbopen on"><span>الزوار يشوفون زر «💳 ادفع واشترك» في نافذة الاشتراك.</span><button type="button" class="lnk dng" id="pbclose">⏸ إيقاف الدفع للزوار</button></div>'
      : '<div class="pbopen"><span>جرّب الدفع من حساب التجربة أول، وإذا تمام افتحه للكل.</span><button type="button" class="btn sm gold" id="pbopen">🚀 افتح الدفع لكل الزوار</button></div>';
    const L = ADM.payAll ? PY.rows : PY.rows.slice(0, 6);
    return `<section class="paybox" aria-labelledby="pbh"><div class="pbtop"><h3 id="pbh">💳 الدفع من الموقع</h3>${mode}</div>
      ${openBar}
      <p class="pbsum">${PY.paid ? `${PY.paid === 1 ? 'عملية ناجحة وحدة' : PY.paid === 2 ? 'عمليتين ناجحة' : PY.paid + ' عمليات ناجحة'} · المجموع <b>${PY.total} ريال</b>` : 'ما فيه دفع حقيقي للحين'} · سعر الشهر <b>${PY.price} ريال</b>${PY.test_price ? ` · حساب التجربة يدفع <b>${PY.test_price} ريال</b>` : ''}</p>
      ${PY.rows.length ? `<div class="pblist">${L.map(p => { const S = PB_ST[p.status] || ['na', esc(p.status)], m = PB_M[String(p.method || '').toUpperCase()] || p.method || '';
        return `<div class="pbrow" data-e="${esc(p.email)}" role="button" tabindex="0" title="${p.err ? esc('السبب: ' + p.err) : 'بطاقة الطالب'}"><span class="pbwho"><b>${esc(p.display || p.name || p.email.split('@')[0])}</b><small class="ltr">${esc(p.email)}</small></span><span class="pbamt">${p.amount} ريال${m ? `<small>${esc(m)}</small>` : ''}</span><span class="pbst ${S[0]}">${S[1]}${p.live ? '' : '<small>🧪 تجربة</small>'}</span><span class="pbdt">${fmtD(p.paid_at || p.created_at)}</span></div>`; }).join('')}</div>
        ${PY.rows.length > 6 ? `<button type="button" class="lnk" id="pball">${ADM.payAll ? 'عرض أقل' : `عرض كل العمليات (${PY.rows.length})`}</button>` : ''}` : '<p class="mut pbempty">أول ما يدفع أحد من الموقع يطلع هنا.</p>'}
    </section>`;
  }
  // 🛍 الدفع عن طريق سلة: حالة الربط (السر · المتجر · رابط المنتج) + فتحه للزوار + الطلبات (اللي بدون إيميل تربطه أنت بالطالب)
  const SL_PM = { credit_card: 'بطاقة', mada: 'مدى', apple_pay: 'Apple Pay', stc_pay: 'STC Pay', google_pay: 'Google Pay', bank: 'تحويل بنكي', cod: 'عند الاستلام', tabby_installment: 'تابي', tamara_installment: 'تمارا', paypal: 'PayPal', free: 'مجاني' };
  const SL_SRC = { field: '✍️ من خانة المنتج', customer: '📧 إيميل حسابه في سلة', owner: '👤 ربطته أنت', claim: '🔢 كتب رقم الطلب' };
  const SL_EV = { 'order.created': 'طلب جديد', 'order.updated': 'تحديث طلب', 'order.status.updated': 'تغيّرت حالة طلب', 'order.payment.updated': 'تحديث الدفع', 'order.cancelled': 'انلغى طلب', 'order.refunded': 'استرجاع مبلغ', 'order.deleted': 'انحذف طلب', 'app.store.authorize': 'ربط المتجر', 'app.installed': 'تثبيت التطبيق', 'app.uninstalled': 'إزالة التطبيق', 'app.updated': 'تحديث التطبيق', pull: 'جلب الطلبات', claim: 'تفعيل برقم الطلب', mail: 'إيميل من سلة' };
  const slState = o => o.applied_at ? (o.bad ? ['warn', '⚠️ انلغى بعد التفعيل', 'راجعه وأنهِ اشتراكه لو لازم'] : ['ok', '✅ تفعّل', o.until ? `لين ${admDay(o.until)}${o.months > 1 ? ` · ${o.months} شهور` : ''}` : ''])
    : o.paid === 1 ? (!o.email || o.note === SL_WAIT ? (slStuck(o) ? ['warn', '⚠️ ما فعّله صاحبه للحين', 'كلّمه على جواله، أو اضغط «🔗 ربط»'] : ['na', '⏳ ينتظر رقم الطلب', 'الطالب يفعّله بنفسه من الموقع']) : ['warn', '⚠️ ما تفعّل', o.note || ''])
    : o.paid === -1 ? ['na', '↩️ ملغي أو مسترجع', o.stn || ''] : ['na', '⏳ بانتظار الدفع', o.stn || ''];
  const SL_WAIT = 'ينتظر الطالب يكتب رقم الطلب', slStuck = o => o.paid === 1 && !o.applied_at && (!o.email || o.note === SL_WAIT) && Date.now() - (o.created_at || 0) > 3 * 3600e3;   // مدفوع من أكثر من 3 ساعات وما كتب أحد رقمه
  function sallaBox(SL) {
    if (!SL || !SL.ok) return '';
    const st = SL.store, linked = st && !st.gone, ML = SL.mail || {}, mailOk = ML.at > 0, on = SL.secret || mailOk;
    const mode = !on ? '<span class="pbmode off">⏸ متوقف: ما وصل أي إيميل من سلة</span>' : !SL.url ? '<span class="pbmode wait">🔗 باقي رابط المنتج</span>'
      : SL.open ? '<span class="pbmode live">🟢 شغّال لكل الزوار</span>' : `<span class="pbmode wait">🔒 يطلع بس لك وللمختبرين${SL.testers ? ` (${SL.testers})` : ''}</span>`;
    const chk = (ok, ic, b, t) => `<li class="${ok ? 'ok' : 'no'}"><span aria-hidden="true">${ok ? '✓' : ic}</span><span><b>${b}</b><small>${t}</small></span></li>`;
    const conn = `<ul class="slconn" aria-label="حالة الربط">
      ${linked ? chk(SL.secret, '🔐', 'سر الإشعارات', SL.secret ? 'محفوظ في Cloudflare' : 'حط SALLA_WEBHOOK_SECRET في Cloudflare (Variables and Secrets)') + chk(linked, '🏪', 'تطبيق Q-Guide على متجرك', `مربوط · متجر رقم <bdi>${esc(st.merchant)}</bdi>${st.err ? ` · <span class="slerr">${esc(st.err)}</span>` : ''}`)
        : chk(mailOk, '📧', 'إيميلات سلة', mailOk ? `توصل للموقع · آخر واحد ${fmtD(ML.at)}${ML.store ? ` · متجر رقم <bdi>${esc(ML.store)}</bdi>` : ''}` : 'ما وصل أي إيميل من سلة للحين: سكربت Gmail في حساب سلة لازم يشتغل')}
      ${chk(!!SL.url, '🔗', 'رابط المنتج', SL.url ? 'محفوظ: الزر يفتح صفحة الدفع' : 'حطه تحت عشان يطلع زر الدفع')}</ul>`;
    const ready = on && SL.url;
    const openBar = !ready ? '' : SL.open ? '<div class="pbopen on"><span>الزوار يشوفون زر «💳 ادفع واشترك» في نافذة الاشتراك، ويوديهم لصفحة المنتج في سلة.</span><button type="button" class="lnk dng" id="slclose">⏸ إيقاف سلة للزوار</button></div>'
      : '<div class="pbopen"><span>جرّبه قبل: ادخل الموقع بحساب Gmail ثاني (مو حساب المشرف)، اشترِ من الزر، والصق رقم الطلب. لو تفعّل اشتراكه، افتحه للكل.</span><button type="button" class="btn sm gold" id="slopen1">🚀 افتح سلة لكل الزوار</button></div>';
    const rows = SL.rows || [], miss = rows.filter(slStuck).length, L = ADM.sallaAll ? rows : rows.slice(0, 6);
    const last = (SL.events || []).find(e => e.ok && e.ev !== 'pull'), bad = (SL.events || []).find(e => !e.ok);
    return `<section class="paybox slbox" aria-labelledby="slh"><div class="pbtop"><h3 id="slh">🛍 الدفع عن طريق سلة</h3>${mode}</div>
      ${conn}
      <form class="slset" id="slform"><label class="slu"><span>رابط المنتج في سلة</span><input id="slurl" type="url" dir="ltr" inputmode="url" placeholder="https://….salla.sa/…" value="${esc(SL.url || '')}" autocomplete="off"></label>
        <label class="slpr"><span>السعر على الزر</span><span class="slpi"><input id="slprice" type="number" min="1" max="5000" step="1" value="${esc(String(SL.price || 140))}"><small>ريال</small></span></label>
        <button type="submit" class="btn sm" id="slsave" disabled>حفظ</button></form>
      ${openBar}
      <p class="pbsum">${SL.paid ? `${SL.paid === 1 ? 'طلب واحد تفعّل' : SL.paid === 2 ? 'طلبين تفعّلت' : SL.paid + ' طلبات تفعّلت'} · المجموع <b>${SL.total} ريال</b>` : 'ما تفعّل أي طلب للحين'} · ${last ? `آخر إشعار من سلة ${fmtD(last.at)} (${esc(SL_EV[last.ev] || last.ev)})` : 'ما وصل أي إشعار من سلة للحين'}</p>
      ${bad && (!last || bad.at > last.at) ? `<div class="rgsync warn">⚠️ ${esc(bad.note || bad.ev)} · ${fmtD(bad.at)}</div>` : ML.bad ? `<div class="rgsync warn">⚠️ ${esc(ML.bad.note || 'إيميل من سلة انرفض')} · ${fmtD(ML.bad.at)}</div>` : ''}
      ${miss ? `<div class="rgsync warn">⚠️ ${miss === 1 ? 'فيه طلب مدفوع من أكثر من 3 ساعات وما فعّله صاحبه' : `فيه ${miss} طلبات مدفوعة من أكثر من 3 ساعات وما فعّلها أصحابها`}: كلّمه على جواله (تحت رقم الطلب)، أو اضغط «🔗 ربط» واكتب إيميله.</div>` : ''}
      ${rows.length ? `<div class="pblist">${L.map(o => { const S = slState(o), who = o.display || o.cname || '—', em = o.applied_email || o.email;
        return `<div class="pbrow slrow" data-id="${esc(o.id)}"${em ? ` data-e="${esc(em)}" role="button" tabindex="0" title="بطاقة الطالب"` : ''}><span class="pbwho"><b${o.display && o.cname && o.cname !== o.display ? ` title="اسمه في حساب سلة: ${esc(o.cname)}"` : ''}>${esc(who)}</b><small class="ltr">${em ? esc(em) : o.ftxt ? `«${esc(o.ftxt)}»` : 'بدون إيميل'}</small><small>#<bdi>${esc(o.ref || o.id)}</bdi>${o.esrc && SL_SRC[o.esrc] ? ' · ' + SL_SRC[o.esrc] : ''}${o.cphone ? ` · <bdi dir="ltr">${esc(o.cphone)}</bdi>` : ''}</small></span>
          <span class="pbamt">${o.total ? o.total + ' ريال' : '—'}<small>${esc(SL_PM[o.pm] || o.pm || '')}</small></span>
          <span class="pbst ${S[0]}">${S[1]}${S[2] ? `<small>${esc(S[2])}</small>` : ''}${!o.applied_at ? `<span class="slact"><button type="button" class="lnk" data-link="${esc(o.id)}">🔗 ربط</button><button type="button" class="lnk" data-hide="${esc(o.id)}" title="إخفاء الطلب من القائمة">🙈 إخفاء</button></span>` : ''}</span>
          <span class="pbdt">${fmtD(o.created_at)}</span></div>`; }).join('')}</div>
        ${rows.length > 6 ? `<button type="button" class="lnk" id="slall">${ADM.sallaAll ? 'عرض أقل' : `عرض كل الطلبات (${rows.length})`}</button>` : ''}` : `<p class="mut pbempty">${linked || mailOk ? 'أول ما يشتري أحد من متجرك يطلع هنا.' : 'أول ما توصل إيميلات سلة للموقع، الطلبات تطلع هنا.'}</p>`}
      <div class="slfoot">${linked ? '<button type="button" class="lnk" id="slpull" title="لو فات إشعار: نجيب طلبات آخر 7 أيام من سلة نفسها">🔄 جلب طلبات آخر 7 أيام من سلة</button>' : ''}${(SL.events || []).length ? `<details class="slevs"><summary>📜 سجل الإشعارات</summary><ul>${SL.events.map(e => `<li class="${e.ok ? '' : 'bad'}"><span>${esc(SL_EV[e.ev] || e.ev)}${e.oid ? ` <bdi>#${esc(e.oid)}</bdi>` : ''}</span><small>${esc(e.note || '')}</small><time>${fmtD(e.at)}</time></li>`).join('')}</ul></details>` : ''}</div>
    </section>`;
  }
  function sallaBind(W) {
    const SL = ADM.salla; if (!SL || !SL.ok) return;
    const f = W.querySelector('#slform'), u = W.querySelector('#slurl'), pr = W.querySelector('#slprice'), sv = W.querySelector('#slsave');
    if (f) { const dirty = () => { sv.disabled = u.value.trim() === (SL.url || '') && Number(pr.value) === Number(SL.price || 140); }; u.oninput = dirty; pr.oninput = dirty;
      f.onsubmit = async e => { e.preventDefault(); const url = u.value.trim();
        if (url && !/^https:\/\/\S+$/.test(url)) { toast('الرابط لازم يبدأ بـ https://'); u.focus(); return; }
        sv.disabled = true; try { ADM.salla = await admCall({ op: 'adm_salla_set', url, price: Number(pr.value) || 140 }); toast('✓ انحفظ'); paintSubs(); } catch (x) { sv.disabled = false; toast('ما انحفظ: ' + x.message); } }; }
    const op1 = W.querySelector('#slopen1'), cl = W.querySelector('#slclose'), setOpen = async (open, btn) => {
      if (!await QGDlg.confirm(open ? 'تفتح الدفع عن طريق سلة لكل الزوار؟\nيطلع لهم زر «💳 ادفع واشترك» في نافذة الاشتراك، ويوديهم لصفحة المنتج في متجرك. اللي يدفع يلصق رقم الطلب في الموقع ويتفعّل اشتراكه على طول.' : 'توقف الدفع عن طريق سلة للزوار؟\nيرجع لهم الاشتراك عن طريق يوتيوب وواتساب. اللي دفعوا قبل يبقى اشتراكهم.', open ? { ok: '🚀 افتح سلة' } : { ok: '⏸ إيقاف', danger: true })) return;
      btn.disabled = true; try { ADM.salla = await admCall({ op: 'adm_salla_set', open: open ? 1 : 0 }); toast(open ? '🚀 سلة صارت مفتوحة لكل الزوار' : '⏸ وقّفت سلة للزوار'); paintSubs(); } catch (x) { btn.disabled = false; toast('ما انحفظ: ' + x.message); } };
    if (op1) op1.onclick = () => setOpen(true, op1); if (cl) cl.onclick = () => setOpen(false, cl);
    const al = W.querySelector('#slall'); if (al) al.onclick = () => { ADM.sallaAll = !ADM.sallaAll; paintSubs(); };
    const pl = W.querySelector('#slpull'); if (pl) pl.onclick = async () => { pl.disabled = true; const t = pl.textContent; pl.textContent = '⏳ نجيب الطلبات من سلة…';
      try { const r = await admCall({ op: 'adm_salla_pull' }); ADM.salla = r; const P = r.pulled || {}; toast(`جبنا ${P.n || 0} طلب من سلة${P.done ? ` · تفعّل منها ${P.done}` : ''}`); if (P.done) { ADM.subs = null; renderSubs(); } else paintSubs(); }
      catch (x) { pl.disabled = false; pl.textContent = t; toast(x.message); } };
    W.querySelectorAll('.slrow').forEach(r => {
      const o = (SL.rows || []).find(x => x.id === r.dataset.id); if (!o) return;
      if (r.dataset.e) { r.onclick = e => { if (!e.target.closest('button')) admStudent(r.dataset.e); }; r.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); admStudent(r.dataset.e); } }; }
      const lk = r.querySelector('[data-link]'); if (lk) lk.onclick = async () => {
        const v = await QGDlg.prompt(`طلب #${o.ref || o.id}${o.cname ? ' · ' + o.cname : ''}${o.cphone ? ' · ' + o.cphone : ''}\n${o.ftxt ? `كتب في الخانة: «${o.ftxt}»\n` : ''}\nاكتب إيميل Google اللي يدخل فيه الطالب الموقع${o.paid === 1 ? '، ويتفعّل اشتراكه على طول:' : '، ويتفعّل أول ما يندفع الطلب:'}\n(أو خلّ الطالب يلصق رقم الطلب في الموقع بنفسه)`, o.email || '', { ok: '🔗 اربط', placeholder: 'name@gmail.com' });
        if (v === null) return; const em = v.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('اكتب إيميل صحيح'); return; }
        try { const x = await admCall({ op: 'adm_salla_link', id: o.id, email: em }); ADM.salla = x; toast(/تفعّل/.test(x.note || '') ? `✅ تفعّل اشتراك ${em}` : `انربط الطلب بـ ${em}${x.note ? ' · ' + x.note : ''}`); ADM.subs = null; ADM.list = null; renderSubs(); }
        catch (x) { toast(x.message); } };
      const hd = r.querySelector('[data-hide]'); if (hd) hd.onclick = async () => { hd.disabled = true; try { ADM.salla = await admCall({ op: 'adm_salla_hide', id: o.id }); toast('🙈 انخفى الطلب'); paintSubs(); } catch (x) { hd.disabled = false; toast(x.message); } };
    });
  }
  async function renderSubs() {
    document.title = 'الاشتراكات | Q-Guide';
    const top = () => { app.innerHTML = admTop('subs'); bindCtl(); $('#admref').onclick = () => { ADM.subs = null; renderSubs(); }; };
    top();
    try { await admLoadStaff(); if (!isOwner()) { location.hash = '#admin'; return; }
      if (!ADM.subs) { const [r, v, py, sl] = await Promise.all([admCall({ op: 'adm_subs' }), admCall({ op: 'adm_vids' }).catch(() => null), admCall({ op: 'adm_pay' }).catch(() => null), admCall({ op: 'adm_salla' }).catch(() => null)]); ADM.subs = r.rows; ADM.subsBatch = r.batch || null; ADM.vids = v; ADM.pay = py; ADM.salla = sl; } }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-subs') return;
    top(); paintSubs();
  }
  function paintSubs() {
    const W = $('#adm'); if (!W || !ADM.subs) return;
    if (ADM.sf === 'need') ADM.sf = 'all';
    const all = ADM.subs, f = ADM.sf, q = ADM.sq.trim().toLowerCase(), alt = x => x.t !== 'yt', on = x => !x.end;
    const n = { yt: all.filter(x => on(x) && x.t === 'yt').length, free: all.filter(x => on(x) && x.t === 'free').length, bank: all.filter(x => on(x) && x.t === 'bank').length, pay: all.filter(x => on(x) && x.t === 'pay').length, end: all.filter(x => x.end).length, over: all.filter(subOver).length };
    const PY = ADM.pay, payT = !!(n.pay || (PY && PY.mode) || (ADM.salla && ADM.salla.secret));   // 💳 خانة «دفع من الموقع» تطلع لو الدفع (تاب أو سلة) مفعّل أو فيه أحد دفع
    if (f === 'end' && !n.end) ADM.sf = 'all';
    let list = all.filter(x => !q || [x.name, x.display, x.email, x.typed, x.user].some(v => String(v || '').toLowerCase().includes(q)));
    if (ADM.sf === 'end') list = list.filter(x => x.end); else if (ADM.sf === 'over') list = list.filter(subOver); else if (ADM.sf !== 'all') list = list.filter(x => on(x) && x.t === ADM.sf);
    if (ADM.sf === 'over') list.sort((a, b) => a.until - b.until); else list.sort((a, b) => (alt(a) ? 0 : 1) - (alt(b) ? 0 : 1) || (b.last || 0) - (a.last || 0));
    const nm = x => x.display || x.name || x.email.split('@')[0];
    // 🎬 المقاطع داخل الموقع: كم مقطع مرفوع + المشاهدات آخر 30 يوم
    const V = ADM.vids, up = V && V.files ? V.files.length : 0, tot = (V && V.total) || 29, views = V && V.views ? V.views.reduce((a, r) => a + r.n, 0) : 0;
    // شرح سلمان (q/v): اللي ما انرفع يفتح في يوتيوب · التأسيس وتدريب عبدالله (sf/af/at): يطلع للطلاب «قريباً» لين يرتفع
    const yv = V && V.files ? V.files.filter(k => /^[qv]:/.test(k)).length : 0, yt = V && V.map ? Object.keys(V.map).filter(k => /^[qv]:/.test(k)).length : 29;
    const vidLine = !V ? '<div class="rgsync warn">⚠️ تعذّر قراءة حالة المقاطع داخل الموقع. حدّث الصفحة.</div>'
      : up >= tot ? `<div class="rgsync">🎬 كل الـ${tot} مقطع مرفوعة للموقع · ${views} مشاهدة آخر 30 يوم</div>`
      : `<div class="rgsync${yv < yt ? ' warn' : ''}">${yv < yt ? `⏳ انرفع ${yv} من ${yt} من شرح سلمان (الأقسام والنماذج)، واللي ما انرفع يفتح لهم نسخته في يوتيوب.` : `🎬 شرح سلمان كله مرفوع (${yt}).`} دروس التأسيس وتدريب عبدالله: انرفع ${up - yv} من ${tot - yt}، والباقي يطلع للطلاب «⏳ قريباً». · ${views} مشاهدة آخر 30 يوم</div>`;
    const tile = (k, ic, b, t) => `<button type="button" class="sbt ${k}${f === k ? ' on' : ''}" data-sf="${k}" aria-pressed="${f === k}"><span class="i" aria-hidden="true">${ic}</span><b>${b}</b><span>${t}</span></button>`;
    const B = ADM.subsBatch;   // آخر «إنهاء الكل» (للتراجع)
    const row = x => `<div class="srow sbrow${x.end ? ' ended' : ''}" data-e="${esc(x.email)}">
      <span class="c-st">${avatarHtml(x.avatar, nm(x), 40)}<span class="who"><b>${esc(nm(x))}</b><small class="ltr">${esc(x.typed || x.email)}${x.user ? ' · @' + esc(x.user) : ''}</small><small>${x.via === 'salla' ? '🛍 اشترك بالدفع عن طريق سلة' : x.via === 'tap' ? '💳 اشترك بالدفع من الموقع' : x.src === 'panel' ? '➕ أضفته من اللوحة' : '📊 من الشيت'} · آخر دخول ${x.last ? fmtD(x.last) : '—'}</small></span></span>
      ${x.t === 'pay' ? `<span class="sbseg pay" aria-label="نوع اشتراك ${esc(nm(x))}: دفع إلكتروني"><span class="sbpay">💳 دفع إلكتروني</span></span>` : `<span class="sbseg" role="radiogroup" aria-label="نوع اشتراك ${esc(nm(x))}"${x.end ? ' aria-disabled="true"' : ''}>${['yt', 'free', 'bank'].map(t => `<button type="button" role="radio" data-t="${t}" class="${x.t === t ? 'on ' + t : ''}" aria-checked="${x.t === t}"${x.end ? ' disabled' : ''}>${SUB_N[t][0]} ${SUB_N[t][1]}</button>`).join('')}</span>`}
      <span class="sbsh">${x.end ? `<small class="sbendst">⛔ انتهى اشتراكه ${fmtD(x.end)}</small>` : alt(x) ? '<small class="sbin">🎬 يشوف المقاطع داخل الموقع</small>' : '<small class="mut">تفتح له مقاطع الأعضاء في القناة</small>'}${x.end ? '' : (() => { const L = subLeft(x.until);
        return `<span class="sbdt ${L.c}"><span>📅 ينتهي <b>${x.until ? admDay(x.until) : '—'}</b> · ${L.t}</span><span class="sbdtb"><button type="button" class="lnk" data-add title="يمدّد الاشتراك شهر من موعد نهايته (أو من اليوم لو خلص)">＋ شهر</button><button type="button" class="lnk" data-dates>تعديل</button></span></span>`; })()}</span>
      <span class="sbend">${x.end ? '<button type="button" class="btn sm ghost" data-restore>↩️ إرجاع الاشتراك</button><button type="button" class="btn sm gone" data-gone title="احذفه من القوائم">🗑 حذف</button>' : '<button type="button" class="btn sm ghost dang" data-end>⛔ إنهاء الاشتراك</button>'}</span></div>`;
    W.innerHTML = `<div class="stf subs">
      <div class="sbtiles n${5 + (n.end ? 1 : 0) + (payT ? 1 : 0)}">${tile('yt', '▶️', n.yt, 'مشتركين عن طريق يوتيوب')}${tile('free', '🎁', n.free, 'اشتراك مجاني')}${tile('bank', '🏦', n.bank, 'تحويل بنكي')}${payT ? tile('pay', '💳', n.pay, 'دفع من الموقع') : ''}${tile('over', '⏰', n.over, 'مر عليهم شهر')}${n.end ? tile('end', '⛔', n.end, 'اشتراك منتهي') : ''}<div class="sbt vid" aria-label="المقاطع داخل الموقع"><span class="i" aria-hidden="true">🎬</span><b><bdi>${up}/${tot}</bdi></b><span>مقطع داخل الموقع</span></div></div>
      ${sallaBox(ADM.salla)}
      ${payBox(PY)}
      ${B && B.n ? `<div class="rgsync warn sbundo"><span>⛔ أنهيت كل الاشتراكات ${fmtD(B.at)}، واللي باقي اشتراكهم منتهي منها ${nStu(B.n)}.</span><button type="button" class="lnk" id="sbundo">↩️ تراجع وأرجعهم</button></div>` : ''}
      ${vidLine}
      ${vupHtml(ADM.vids)}
      <p class="sbhelp">المجاني والتحويل البنكي يشوفون مقاطع الشرح هنا داخل الموقع: رابط مؤقت يشتغل من الموقع بس، وإيميل الطالب ظاهر على المقطع. مشترك يوتيوب تفتح له مقاطع الأعضاء في القناة مثل قبل.</p>
      <div class="abar"><input id="sbq" type="search" placeholder="ابحث بالاسم أو الإيميل أو اليوزر…" value="${esc(ADM.sq)}">${f !== 'all' ? `<button type="button" class="btn sm ghost" id="sball">عرض الكل (${all.length})</button>` : ''}</div>
      <div class="slist">${list.length ? list.map(row).join('') : `<div class="sempty">${q ? 'لا نتائج' : 'ما فيه طلاب هنا'}</div>`}</div>
      <p class="mut sbnote">الطالب الجديد من الشيت يطلع «يوتيوب»، واللي تضيفه من «➕ المشتركون» يطلع بالنوع اللي تختاره هناك. تقدر تغيّر أي طالب من هنا، ويتغيّر عنده خلال دقائق.</p>
      <section class="sbdz" aria-labelledby="sbdzh"><div class="sbdzt"><h3 id="sbdzh">⛔ إنهاء كل الاشتراكات</h3><p>ينهي اشتراك كل الطلاب دفعة وحدة: يطلعون من الموقع فوراً، ولو دخلوا مرة ثانية يدخلون بالحساب المجاني. أنت والمشرفين ما تتأثرون، وتقدر تتراجع بعدها.</p></div>
        <button type="button" class="btn sm danger" id="sbendall"${all.some(on) ? '' : ' disabled'}>⛔ إنهاء كل الاشتراكات</button></section></div>`;
    W.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { ADM.sf = ADM.sf === b.dataset.sf ? 'all' : b.dataset.sf; paintSubs(); });
    const ab = $('#sball'); if (ab) ab.onclick = () => { ADM.sf = 'all'; paintSubs(); };
    const pa = $('#pball'); if (pa) pa.onclick = () => { ADM.payAll = !ADM.payAll; paintSubs(); };
    const po = $('#pbopen'), pc = $('#pbclose'), payOpen = async (open, btn) => {
      if (!await QGDlg.confirm(open ? 'تفتح الدفع الحقيقي لكل الزوار؟\nيطلع لهم زر «💳 ادفع واشترك» في نافذة الاشتراك، واللي يدفع ينفتح له اشتراكه على طول.' : 'توقف الدفع من الموقع للزوار؟\nيرجع لهم الاشتراك عن طريق يوتيوب وواتساب بس. اللي دفعوا قبل يبقى اشتراكهم.', open ? { ok: '🚀 افتح الدفع' } : { ok: '⏸ إيقاف', danger: true })) return;
      btn.disabled = true; try { ADM.pay = await admCall({ op: 'adm_pay_open', open: open ? 1 : 0 }); toast(open ? '🚀 الدفع صار مفتوح لكل الزوار' : '⏸ وقّفت الدفع للزوار'); paintSubs(); } catch (e) { btn.disabled = false; toast('ما انحفظ: ' + e.message); } };
    if (po) po.onclick = () => payOpen(true, po); if (pc) pc.onclick = () => payOpen(false, pc);
    W.querySelectorAll('.pbrow[data-e]').forEach(r => { r.onclick = () => admStudent(r.dataset.e); r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); admStudent(r.dataset.e); } }; });
    $('#sbq').oninput = e => { ADM.sq = e.target.value; const pos = e.target.selectionStart; paintSubs(); const i = $('#sbq'); i.focus(); i.setSelectionRange(pos, pos); };
    const save = async (x, patch, undo, msg) => { Object.assign(x, patch); paintSubs();
      try { await admCall(Object.assign({ op: 'adm_sub_set', email: x.email }, patch)); toast(msg); } catch (e) { Object.assign(x, undo); paintSubs(); toast('ما انحفظ: ' + e.message); } };
    W.querySelectorAll('.sbrow').forEach(r => { const x = all.find(y => y.email === r.dataset.e); if (!x) return;
      r.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; if (t === x.t || x.end) return; save(x, { t }, { t: x.t }, `${nm(x)}: ${SUB_N[t][0]} ${SUB_N[t][1]} ✓`); });
      const e1 = r.querySelector('[data-end]'); if (e1) e1.onclick = async () => { const at = await subEndOne(x.email, nm(x)); if (at) { x.end = at; x.eb = ''; paintSubs(); } };
      const g1 = r.querySelector('[data-gone]'); if (g1) g1.onclick = async () => { g1.disabled = true; if (await subGoneOne(x.email, nm(x))) { ADM.subs = all.filter(y => y.email !== x.email); ADM.list = null; paintSubs(); } else g1.disabled = false; };
      const r1 = r.querySelector('[data-restore]'); if (r1) r1.onclick = async () => { if (await subRestoreOne(x.email, nm(x))) { x.end = 0; x.eb = ''; if (B) B.n = all.filter(y => y.end && y.eb === B.batch).length; ADM.subs = null; renderSubs(); } };
      const ad = r.querySelector('[data-add]'); if (ad) ad.onclick = async () => { ad.disabled = true; if (await subAddMonth(x, nm(x))) { ADM.list = null; paintSubs(); } else ad.disabled = false; };
      const dt = r.querySelector('[data-dates]'); if (dt) dt.onclick = async () => { if (await subDatesDlg(x, nm(x))) { ADM.list = null; paintSubs(); } }; });
    const ea = $('#sbendall'); if (ea) ea.onclick = async () => {
      const k = all.filter(on).length; if (!k) return;
      const v = await QGDlg.prompt(`إنهاء اشتراك كل الطلاب (${nStu(k)})؟\nيطلعون من الموقع فوراً، ولو دخلوا مرة ثانية يدخلون بالحساب المجاني. أنت والمشرفين ما تتأثرون، وتقدر تتراجع بعدها.\n\nللتأكيد اكتب: إنهاء الكل`, '', { ok: '⛔ إنهاء كل الاشتراكات', danger: true, placeholder: 'إنهاء الكل' });
      if (v === null) return;
      if (v.trim().replace(/\s+/g, ' ') !== 'إنهاء الكل') { toast('ما انتهى أي اشتراك: لازم تكتب «إنهاء الكل» بالضبط.'); return; }
      try { const r = await admCall({ op: 'adm_sub_end_all', confirm: 'all' }); toast(`⛔ انتهى اشتراك ${nStu(r.n)}`); ADM.subs = null; ADM.list = null; ADM.sf = 'all'; renderSubs(); }
      catch (e) { toast('ما انحفظ: ' + e.message); } };
    const ub = $('#sbundo'); if (ub) ub.onclick = async () => {
      if (!await QGDlg.confirm(`ترجع اشتراك ${B.n === 1 ? 'الطالب' : B.n === 2 ? 'الطالبين' : 'الـ' + nStu(B.n)} اللي انتهى اشتراكهم في «إنهاء الكل»؟\nيقدرون يدخلون مشتركين من جديد.`, { ok: '↩️ أرجعهم' })) return;
      try { const r = await admCall({ op: 'adm_sub_restore_all', batch: B.batch }); toast(`↩️ رجع اشتراك ${nStu(r.n)}`); ADM.subs = null; ADM.list = null; renderSubs(); }
      catch (e) { toast('ما انحفظ: ' + e.message); } };
    sallaBind(W); vupBind(W, '');
  }
  // ⛔ إنهاء اشتراك طالب / ↩️ إرجاعه (المالك) — من «💳 الاشتراكات» ومن بطاقة الطالب
  const nStu = n => n === 1 ? 'طالب واحد' : n === 2 ? 'طالبين' : n >= 3 && n <= 10 ? n + ' طلاب' : n + ' طالب';
  async function subEndOne(email, name) {
    if (!await QGDlg.confirm(`إنهاء اشتراك ${name}؟\nيطلع من الموقع فوراً، ولو دخل مرة ثانية يدخل بالحساب المجاني. تقدر ترجع اشتراكه بعدين.`, { ok: '⛔ إنهاء الاشتراك', danger: true })) return 0;
    try { const r = await admCall({ op: 'adm_sub_end', email }); toast(`⛔ انتهى اشتراك ${name}`); ADM.list = null; return r.at || Date.now(); } catch (e) { toast('ما انحفظ: ' + e.message); return 0; }
  }
  // 🗑 حذف طالب اشتراكه منتهي من القوائم (بياناته تبقى، ولو اشترك من جديد يرجع يطلع)
  async function subGoneOne(email, name) {
    if (!await QGDlg.confirm(`حذف ${name} من قائمة الطلاب؟\nاشتراكه منتهي، فما يقدر يدخل الدورة. نتائجه وتقريره تبقى محفوظة، ولو اشترك من جديد يرجع يطلع في القائمة.`, { ok: '🗑 حذف', danger: true })) return false;
    try { await admCall({ op: 'adm_sub_gone', email }); toast(`🗑 انحذف ${name} من القائمة`); ADM.subs = null; ADM.members = null; return true; } catch (e) { toast('ما انحذف: ' + e.message); return false; }
  }
  async function subRestoreOne(email, name) {
    try { await admCall({ op: 'adm_sub_restore', email }); toast(`↩️ رجع اشتراك ${name}`); ADM.list = null; return true; } catch (e) { toast('ما انحفظ: ' + e.message); return false; }
  }
  // ---------- ⬆️ رفع المقاطع للموقع: المالك (كل المقاطع، في «💳 الاشتراكات») والمدرس (مقاطعه هو، «🎬 مقاطعي») — ملف MP4 لكل مقطع، بالأجزاء مع نسبة التقدّم ----------
  const VUP = { busy: 0, st: {}, miss: [], open: 0 };   // st[ملف] = {p: 0..1, err} · miss = ملفات ما عرفنا مقطعها من اسمها · open = صندوق المالك مفتوح
  // المجموعات بالترتيب: سلمان الفرج — تأسيس الكمي sf · تدريب الكمي q · تدريب اللفظي v | عبدالله الشمراني — تأسيس اللفظي af · التدريب على النماذج at
  const VUP_G = { sf: '🧱 سلمان الفرج · التأسيس (قواعد الكمي)', q: '📐 سلمان الفرج · تدريب الكمي', v: '📖 سلمان الفرج · تدريب اللفظي', af: '🧱 عبدالله الشمراني · التأسيس', at: '🏋️ عبدالله الشمراني · التدريب (النماذج)' };
  const VUP_GT = { sf: '🧱 التأسيس · دروس قواعد الكمي', q: '📐 التدريب · أقسام الكمي', v: '📖 التدريب · نماذج اللفظي', af: '🧱 التأسيس · دروس اللفظي', at: '🏋️ التدريب · النماذج' };   // «🎬 مقاطعي» (بدون اسم المدرس)
  const VUP_O = { sf: 0, q: 100, v: 200, af: 300, at: 400 };
  const vupLabel = (g, n) => g === 'sf' ? n + '. ' + QR_L[n - 1][0] : g === 'af' ? n + '. ' + PART_AR[n] : g === 'v' && n === 15 ? 'الأسئلة الجديدة' : (g === 'q' ? 'القسم ' : 'النموذج ') + n;
  function vupSlots(V) { const M = (V && V.map) || {}, objs = (V && V.objects) || [];
    return Object.keys(M).map(k => { const f = M[k], o = objs.find(x => x.key === f), m = /^([a-z]+):(\d+)$/.exec(k);
      if (!m || VUP_O[m[1]] == null) return null;
      return { k, f, g: m[1], label: vupLabel(m[1], +m[2]), size: o ? o.size : 0, ord: VUP_O[m[1]] + +m[2] }; }).filter(Boolean).sort((a, b) => a.ord - b.ord); }
  // نعرف المقطع من اسم الملف: Lesson 7 (تأسيس الكمي) / Section 3 / Model 7 / Extra Questions… — teach = المدرس في «🎬 مقاطعي»؛ عند المالك «عبدالله/الشمراني» في الاسم = مقاطع عبدالله
  const VUP_AF = [[/analog|تناظر/, 1], [/sentence|completion|إكمال|اكمال|الجمل/, 2], [/contextual|context|سياق|الخطأ|الخطا/, 3], [/reading|comprehension|استيعاب|المقروء|مقروء/, 4]];
  function vupGuess(name, teach) { const n = name.toLowerCase().replace(/[_\-–|｜⧸/]+/g, ' ');
    const abd = teach ? teach === 'abdullah' : /shamrani|shmrani|shamrany|الشمراني|عبدالله|abdullah|abdallah/.test(n); let m;
    if (abd) {   // 👨‍🏫 عبدالله: Model 3 = تدريبه على النموذج · Analogy… = دروس التأسيس
      m = /(?:model|نموذج)\s*0?(\d{1,2})\b/.exec(n); if (m && +m[1] >= 1 && +m[1] <= 14) return 'shamrani/m' + m[1].padStart(2, '0') + '.mp4';
      for (const [re, i] of VUP_AF) if (re.test(n)) return 'shamrani/f' + i + '.mp4';
      return ''; }
    if (/(extra|new)\s*(questions?|15)\b|الأسئلة الجديدة|الاسئلة الجديدة|أسئلة جديدة|اسئلة جديدة|(?:model|نموذج)\s*15\b/.test(n)) return 'v/m15.mp4';
    m = /(?:lesson|درس)\s*0?(\d{1,2})\b/.exec(n); if (m && +m[1] >= 1 && +m[1] <= QR_L.length) return 'salman/f' + m[1].padStart(2, '0') + '.mp4';   // 🧱 تأسيس الكمي: Lesson 7
    m = /(?:section|sec|قسم)\s*0?(\d{1,2})\b/.exec(n); if (m && +m[1] >= 1 && +m[1] <= 14) return 'q/s' + m[1].padStart(2, '0') + '.mp4';
    m = /(?:model|نموذج)\s*0?(\d{1,2})\b/.exec(n); if (m && +m[1] >= 1 && +m[1] <= 14) return 'v/m' + m[1].padStart(2, '0') + '.mp4';
    if (!teach) for (const [re, i] of VUP_AF) if (re.test(n)) return 'shamrani/f' + i + '.mp4';   // المالك: دروس تأسيس اللفظي باسمها (مثل قبل)
    return ''; }
  const vupMB = b => '<bdi dir="ltr">' + (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e7 ? Math.round(b / 1e6) + ' MB' : (b / 1e6).toFixed(1) + ' MB') + '</bdi>';
  // 👑 مين يرفع مقاطع كل مدرس (حساب واحد لكل مدرس من المشرفين) — يطلع له «🎬 مقاطعي»
  function vupTeachSet(V) {
    const L = V.staff || [], sel = t => `<select data-teach="${t}" aria-label="حساب ${TEACHERS.find(x => x.id === t).name}"><option value="">— محد</option>${L.map(x => `<option value="${esc(x.email)}"${x.teach === t ? ' selected' : ''}>${esc(x.name || x.email.split('@')[0])} · ${esc(x.email)}</option>`).join('')}</select>`;
    return `<div class="vteach"><div><b>👨‍🏫 المدرسين يرفعون مقاطعهم بأنفسهم</b><span class="mut">اختر حساب كل مدرس من المشرفين: يطلع له «🎬 مقاطعي» ويرفع مقاطعه هو بس (التأسيس والتدريب).</span></div>
      <label><span>سلمان الفرج</span>${sel('salman')}</label><label><span>عبدالله الشمراني</span>${sel('abdullah')}</label></div>`;
  }
  function vupHtml(V, mine) {
    if (!V || !V.map) return '';
    const S = vupSlots(V), up = S.filter(x => x.size).length, G = mine ? VUP_GT : VUP_G;
    const cell = x => { const st = VUP.st[x.f] || {}, run = st.p != null && st.p < 1 && !st.err;
      return `<div class="vslot${x.size ? ' ok' : ''}${run ? ' run' : ''}${st.err ? ' bad' : ''}" data-f="${x.f}"><b title="${esc(x.label)}">${x.label}</b>
        <small>${st.err ? '⚠️ ' + esc(st.err) : run ? 'يرتفع… ' + Math.round(st.p * 100) + '%' : x.size ? '✓ ' + vupMB(x.size) : 'ناقص'}</small>
        <i class="pg" aria-hidden="true"><span style="width:${run ? Math.round(st.p * 100) : x.size ? 100 : 0}%"></span></i>
        <label class="vpick" title="${x.size ? 'استبدل الملف' : 'اختر ملف المقطع'}">${x.size ? 'تغيير' : 'اختر'}<input type="file" accept="video/mp4,.mp4" hidden data-one="${x.f}"${VUP.busy ? ' disabled' : ''}></label></div>`; };
    const bar = `<div class="vupbar"><label class="btn sm${VUP.busy ? ' dis' : ''}">📁 اختر عدة ملفات<input type="file" accept="video/mp4,.mp4" multiple hidden id="vupmany"${VUP.busy ? ' disabled' : ''}></label><span class="mut${VUP.miss.length && !VUP.busy ? ' vmiss' : ''}" id="vupst">${VUP.busy ? 'جاري الرفع…' : VUP.miss.length ? '⚠️ ما عرفت مقطع: ' + esc(VUP.miss.slice(0, 3).join('، ')) + (VUP.miss.length > 3 ? '…' : '') + '. ارفعه من زر «اختر» حق مقطعه.' : ''}</span></div>`;
    const grid = `<div class="vupgrid">${S.map((x, i) => (i === 0 || S[i - 1].g !== x.g ? `<h4 class="vgh">${G[x.g]} <small><bdi>${S.filter(y => y.g === x.g && y.size).length}/${S.filter(y => y.g === x.g).length}</bdi></small></h4>` : '') + cell(x)).join('')}</div>`;
    if (mine) return `<section class="vup mine"><p class="mut">اختر ملفات مقاطعك (MP4)، ونعرف كل ملف من اسمه (${mine === 'salman' ? 'Lesson 3، Section 7، Model 2…' : 'Analogy، Reading، Model 5…'})، أو اختر لكل مقطع ملفه. المقطع يطلع للطلاب أول ما يخلص رفعه، فخلّ الصفحة مفتوحة لين يخلص.</p>${bar}${grid}</section>`;
    return `<details class="vup"${VUP.open || VUP.busy ? ' open' : ''}><summary>⬆️ رفع المقاطع للموقع <small><bdi>${up}/${S.length}</bdi></small></summary>${vupTeachSet(V)}
      <p class="mut">اختر ملفات المقاطع (MP4) من جهازك، ونعرف كل ملف من اسمه (Lesson 3 = تأسيس الكمي، Section 3، Model 7، Analogy… ومقاطع عبدالله لو اسمه في الملف)، أو اختر لكل مقطع ملفه. خلّ الصفحة مفتوحة لين يخلص الرفع.</p>${bar}${grid}</details>`;
  }
  function vupBind(W, teach) {
    const V = teach ? MYV : ADM.vids;
    const det = W.querySelector('details.vup'); if (det) det.ontoggle = () => { VUP.open = det.open ? 1 : 0; };
    const many = W.querySelector('#vupmany'); if (many) many.onchange = () => { const L = [...many.files], plan = [], miss = [];
      const ok = new Set(vupSlots(V).map(x => x.f));
      L.forEach(f => { const g = vupGuess(f.name, teach); if (g && ok.has(g)) plan.push([f, g]); else miss.push(f.name); });
      VUP.miss = miss; if (!plan.length) { vupRepaint(); if (miss.length) toast('ما عرفت مقطع هالملفات من أسمائها. ارفع كل واحد من زر «اختر» حق مقطعه.'); return; }
      vupRun(plan, V); };
    W.querySelectorAll('[data-one]').forEach(i => i.onchange = () => { if (i.files[0]) { VUP.miss = []; vupRun([[i.files[0], i.dataset.one]], V); } });
    W.querySelectorAll('select[data-teach]').forEach(sel => sel.onchange = async () => {   // 👑 حساب المدرس
      sel.disabled = true;
      try { const r = await admCall({ op: 'adm_staff_teach', teach: sel.dataset.teach, email: sel.value }); if (ADM.vids) ADM.vids.staff = r.staff; toast(sel.value ? '✓ انحفظ: يطلع له «🎬 مقاطعي» أول ما يحدّث الصفحة' : '✓ انحفظ'); }
      catch (e) { toast('ما انحفظ: ' + e.message); }
      vupRepaint(); });
  }
  const vupRepaint = () => { if (location.hash === '#admin-subs') paintSubs(); else if (location.hash === '#my-vids') paintMyVids(); };
  async function vupRun(plan, V) {
    if (!plan.length || VUP.busy) return; VUP.busy = 1; VUP.open = 1;
    plan.forEach(([, f]) => VUP.st[f] = { p: 0 }); vupRepaint();
    let ok = 0;
    for (const [file, key] of plan) {
      try { const size = await vupFile(file, key, p => { VUP.st[key].p = p; const c = document.querySelector(`.vslot[data-f="${key}"]`); if (c) { c.classList.add('run'); c.querySelector('small').textContent = 'يرتفع… ' + Math.round(p * 100) + '%'; c.querySelector('.pg span').style.width = Math.round(p * 100) + '%'; } });
        VUP.st[key] = { p: 1 }; ok++;
        V.objects = (V.objects || []).filter(o => o.key !== key).concat([{ key, size }]); const sk = Object.keys(V.map).find(k => V.map[k] === key); if (sk && (V.files || (V.files = [])).indexOf(sk) < 0) V.files.push(sk);
      } catch (e) { VUP.st[key] = { err: String(e.message || e).slice(0, 60) }; }
      vupRepaint();
    }
    VUP.busy = 0; vupRepaint(); toast((ok === plan.length ? `✓ انرفع ${ok === 1 ? 'مقطع واحد' : ok === 2 ? 'مقطعين' : ok + ' مقاطع'}` : `انرفع ${ok} من ${plan.length}. اللي ما انرفع جرّبه مرة ثانية.`) + (VUP.miss.length ? ` · وفيه ${VUP.miss.length === 1 ? 'ملف' : VUP.miss.length + ' ملفات'} ما عرفت مقطعه` : ''));
  }
  // ---------- 🎬 «مقاطعي»: المدرس (سلمان الفرج · عبدالله الشمراني) يرفع مقاطعه بنفسه — التأسيس والتدريب ----------
  let MYV = null;
  async function renderMyVids() {
    document.title = 'مقاطعي | Q-Guide';
    app.innerHTML = topbar(`<span class="ttl">🎬 مقاطعي</span><span class="sp"></span>`, `<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap myv" id="myv"><div class="center"><div class="spin" style="margin:0 auto"></div></div></main>`;
    bindCtl();
    if (!MYV || !VUP.busy) { try { const r = await api({ op: 'teach_vids', session: auth.session }); if (!r.ok) throw new Error(r.msg || r.error || 'تعذّر'); MYV = r; }
      catch (e) { const w = $('#myv'); if (w) w.innerHTML = `<div class="center mut">${esc(e.message || 'تعذّر تحميل مقاطعك')}</div>`; return; } }
    paintMyVids();
  }
  function paintMyVids() {
    const W = $('#myv'); if (!W || !MYV) return;
    const t = TEACHERS.find(x => x.id === MYV.teach) || { name: '', href: '#sharh' }, S = vupSlots(MYV), up = S.filter(x => x.size).length;
    W.innerHTML = `<div class="tphead"><span class="tav" aria-hidden="true">${esc(t.name[0] || '🎬')}</span><div class="tphx"><h1>مقاطع ${t.name}</h1>
      <p>ارفع مقطع كل درس أو قسم أو نموذج، ويطلع للطلاب في صفحتك أول ما يخلص رفعه. انرفع <bdi>${up}</bdi> من <bdi>${S.length}</bdi> · <a class="lnk2" href="${t.href}">👨‍🏫 صفحتي عند الطلاب</a></p></div></div>${vupHtml(MYV, MYV.teach)}`;
    vupBind(W, MYV.teach);
  }
  async function vupFile(file, key, onp) {
    const base = window.QG.API.replace(/\/$/, '') + '/vup', H = { 'x-qg-ses': auth.session }, J = Object.assign({ 'content-type': 'application/json' }, H);
    const post = async b => { const r = await (await fetch(base, { method: 'POST', headers: J, body: JSON.stringify(b) })).json(); if (!r.ok) throw new Error(r.msg || r.error || 'تعذّر'); return r; };
    if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') throw new Error('الملف لازم يكون MP4');
    const c = await post({ op: 'create', key }), PART = 32 * 1024 * 1024, parts = [];
    try {
      for (let i = 0, n = 1; i < file.size; i += PART, n++) {
        const blob = file.slice(i, Math.min(file.size, i + PART)); let r = null;
        for (let t = 0; ; t++) { try { r = await (await fetch(`${base}?key=${encodeURIComponent(key)}&id=${encodeURIComponent(c.id)}&n=${n}`, { method: 'PUT', headers: H, body: blob })).json(); if (r.ok) break; throw new Error(r.msg || r.error || 'part'); }
          catch (e) { if (t >= 3) throw e; await new Promise(z => setTimeout(z, 1500 * (t + 1))); } }
        parts.push({ n: r.n, etag: r.etag }); onp(Math.min(.99, (i + blob.size) / file.size));
      }
      const d = await post({ op: 'done', key, id: c.id, parts }); onp(1); return d.size;
    } catch (e) { post({ op: 'abort', key, id: c.id }).catch(() => {}); throw e; }
  }
  function refreshSubTab() {   // تبويب «💳 نوع الاشتراك» ما عليه عدّاد (المقاطع صارت داخل الموقع)
    const a = document.querySelector('.atabs a[href="#admin-subs"]'); if (a) a.textContent = '💳 الاشتراكات';
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
    const st = x => x.banned ? '<span class="rbdg ban">⛔ محظور</span>' : x.ended ? '<span class="rbdg ban">⛔ اشتراكه منتهي</span>' : x.logins ? '<span class="rbdg viewer">✓ دخل الموقع</span>' : '<span class="rbdg wait">لم يدخل بعد</span>';
    const row = x => `<div class="srow"><span class="c-st">${avatarHtml(x.avatar, x.display || x.name || x.email, 40)}<span class="who"><b>${esc(x.display || x.name || x.email.split('@')[0])}</b><small class="ltr">${esc(x.typed || x.email)}</small></span></span>
      <span class="rl">${st(x)}</span>
      <span class="meta"><small>أضافه ${esc((x.added_by || '').split('@')[0])} · ${fmtD(x.added_at)}</small><small>آخر دخول: <b>${x.lastLogin ? fmtD(x.lastLogin) : '—'}</b></small>${x.inSheet ? '<small>📊 مسجّل في الشيت أيضاً</small>' : ''}</span>
      <span class="c-act"><button class="btn sm danger" data-mrm="${esc(x.email)}">حذف</button></span></div>`;
    const G = [['restored', '↩️ كان اشتراكهم منتهي ورجع', 'ok'], ['added', '✓ أُضيفوا ويقدرون يدخلون الحين', 'ok'], ['updated', '✎ كانوا مضافين وتحدّث اسمهم', 'ok'], ['exists', 'مضافين من قبل', ''], ['sheet', 'مسجّلين في الشيت أصلاً — ما يحتاجون إضافة', ''], ['staff', 'مشرفين — يدخلون بدون إضافة', ''], ['banned', '⛔ محظورين — فك الحظر من تبويب الطلاب أولاً', 'bad'], ['invalid', 'إيميلات غير صحيحة', 'bad']];
    const resHtml = res ? `<div class="mres">${G.filter(([k]) => res[k] && res[k].length).map(([k, t, c]) => `<div class="${c}"><b>${t} <small>${res[k].length}</small></b><span dir="ltr">${res[k].map(esc).join(' · ')}</span></div>`).join('')}</div>` : '';
    W.innerHTML = `<div class="stf">
      <form class="sadd" id="madd" autocomplete="off"><h3>➕ إضافة مشتركين</h3>
        <div class="sgrid"><label class="wide"><span>إيميلات Google — كل إيميل في سطر، وتقدر تكتب اسم الطالب بعد الإيميل</span><textarea id="m_em" rows="5" dir="ltr" spellcheck="false" placeholder="ahmed@gmail.com أحمد محمد&#10;sara@gmail.com"></textarea></label></div>
        <div class="sroles s3" role="radiogroup" aria-label="نوع اشتراكهم">${[['free', '🎁 مجاني', 'تفتح له النسخ الخاصة من المقاطع'], ['bank', '🏦 تحويل بنكي', 'تفتح له النسخ الخاصة من المقاطع'], ['yt', '▶️ يوتيوب', 'عضو في القناة: مقاطع الأعضاء']].map(([v, b, t]) => `<label class="ropt"><input type="radio" name="m_sub" value="${v}" ${ADM.msub === v ? 'checked' : ''}><span><b>${b}</b><small>${t}</small></span></label>`).join('')}</div>
        <div class="acts"><button class="btn gold" type="submit" id="m_go" disabled>إضافة</button><span class="mcnt" id="m_cnt"></span></div>
        ${resHtml}
        <p class="mnote">يدخلون الموقع فوراً بنفس إيميل Google، وما يحتاج تضيفهم في الشيت. المذكرة تطلع لهم داخل الموقع (التفاعلية والمحلولة) باسمهم وإيميلهم، ونسخة PDF في Drive تنعمل من الشيت بس.</p></form>
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
        toast(r.added.length ? 'تمت الإضافة ✓' : r.restored && r.restored.length ? '↩️ رجع اشتراكهم ✓' : 'ما فيه إيميلات جديدة'); app.innerHTML = admTop('members'); bindCtl(); $('#admref').onclick = () => { ADM.members = null; renderMembers(); }; paintMembers(r);
      } catch (err) { toast(err.message); upd(); }
    };
    const mq = $('#mq'); if (mq) mq.oninput = e => { ADM.mq = e.target.value; const pos = e.target.selectionStart; paintMembers(res); const i = $('#mq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-mrm]').forEach(b => b.onclick = async () => { if (await admMemberRemove(b.dataset.mrm)) { ADM.list = null; renderMembers(); } });
  }

  // ---------- 🧑‍🏫 المرشدين الأكاديميين: «💬 طلابي» — كل مرشد يشوف طلابه ويكلمهم بالواتس برسالة جاهزة باسمه ----------
  // الطالبات للعنود (مرشدة الطالبات)، والطلاب بالتساوي بين عبدالله الشمراني وسلمان الفرج (adv.js في الـ API). المالك يشوف الكل ويغيّر المرشد.
  const ADV_IDLE = 7 * 864e5;   // «ما دخل من أسبوع»
  const advMsg = (adv, s, nm) => { const f = nm || firstName(s.display || s.name) || '';   // رسالة الواتس الوحيدة: «أنا مرشدك الأكاديمي» باسم المرشد (nm = للمعاينة)
    return adv.adv === 'f' ? `السلام عليكم ${f} 👋\nأنا ${adv.name}، مرشدتك الأكاديمية في دورة Q-Guide.\nأي سؤال عن الدورة أو المذاكرة كلميني هنا، وبتابع معك تقدّمك إن شاء الله.`
      : `السلام عليكم ${f} 👋\nأنا ${adv.name}، مرشدك الأكاديمي في دورة Q-Guide.\nأي سؤال عن الدورة أو المذاكرة كلمني هنا، وبتابع معك تقدّمك إن شاء الله.`; };
  const advTab = () => isOwner() ? '🧑‍🏫 المرشدين' : '💬 طلابي';
  async function renderAdv(force) {
    document.title = (isOwner() ? 'المرشدين' : 'طلابي') + ' | Q-Guide';
    app.innerHTML = admTop('adv'); bindCtl(); $('#admref').onclick = () => renderAdv(true);
    try { if (!ADM.adv || force) ADM.adv = await admCall({ op: 'adv_mine' }); await admLoadStaff(); }
    catch (e) { const a = $('#adm'); if (a) a.innerHTML = `<div class="sum">${esc(e.message)}</div>`; return; }
    if (location.hash !== '#admin-adv') return;
    app.innerHTML = admTop('adv'); bindCtl(); $('#admref').onclick = () => renderAdv(true);
    paintAdv();
  }
  function paintAdv() {
    const W = $('#adm'), D = ADM.adv; if (!W || !D) return;
    const owner = !!D.owner, advs = D.advs || [], A = {}; advs.forEach(a => A[a.email] = a);
    if (ADM.ap == null) ADM.ap = owner ? (D.me ? D.me.email : (advs[0] || {}).email || '') : '';   // المالك: أي مرشد يعرض ('' = بدون مرشد)
    ADM.af = ADM.af || 'all'; ADM.aq = ADM.aq || '';
    const who = owner ? A[ADM.ap] || null : D.me, base = owner ? D.students.filter(s => s.adv === ADM.ap) : D.students;
    const now = Date.now(), idle = s => !s.last || now - s.last > ADV_IDLE, q = ADM.aq.trim().toLowerCase();
    const n = { all: base.length, todo: base.filter(s => !s.wa_at).length, done: base.filter(s => s.wa_at).length, idle: base.filter(idle).length };
    const list = base.filter(s => (ADM.af === 'todo' ? !s.wa_at : ADM.af === 'done' ? !!s.wa_at : ADM.af === 'idle' ? idle(s) : true)
      && (!q || [s.name, s.display, s.email, s.phone, s.school].some(v => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => (!a.wa_at - !b.wa_at) * -1 || (a.last || 0) - (b.last || 0));   // اللي ما تواصلت معه أول، ثم الأقل نشاطاً
    const nm = s => s.display || s.name || s.email.split('@')[0];
    const gl = (g, n2) => g === 'f' ? (n2 === 1 ? 'طالبة' : 'طالبات') : (n2 === 1 ? 'طالب' : 'طلاب');
    const tile = (k, ic, b, t) => `<button type="button" class="sbt${ADM.af === k ? ' on' : ''}" data-af="${k}" aria-pressed="${ADM.af === k}"><span class="i" aria-hidden="true">${ic}</span><b>${b}</b><span>${t}</span></button>`;
    const meta = s => [s.wa ? `<span dir="ltr">📱 ${esc(s.phone)}</span>` : '<span class="rgbad">بدون جوال</span>', s.until ? `📅 ينتهي ${admDay(s.until)}` : '', s.last ? `آخر نشاط ${fmtD(s.last)}` : '<span class="rgbad">ما دخل الموقع</span>', `حلّ ${s.sets} من ${D.sets}`, s.school ? esc(s.school) : ''].filter(Boolean).join(' · ');
    const move = s => owner ? `<select class="advmv" data-mv="${esc(s.email)}" aria-label="مرشد ${esc(nm(s))}">${advs.map(a => `<option value="${esc(a.email)}"${a.email === s.adv ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}<option value=""${!s.adv ? ' selected' : ''}>بدون مرشد</option></select>` : '';
    const row = s => { const adv = A[s.adv] || D.me;
      const wa = !owner && s.wa && adv ? `<a class="btn sm advwa" href="https://wa.me/${s.wa}?text=${encodeURIComponent(advMsg(adv, s))}" target="_blank" rel="noopener" data-wa="${esc(s.email)}">💬 واتساب</a>` : '';
      return `<div class="srow advrow${s.wa_at ? ' done' : ''}" data-e="${esc(s.email)}">
        <span class="c-st">${avatarHtml('', nm(s), 40)}<span class="who"><b>${esc(nm(s))}</b><small class="rgmeta">${meta(s)}</small></span></span>
        <span class="advact">${s.wa_at ? `<span class="advok">✓ تواصلت ${fmtD(s.wa_at)}</span>` : ''}${move(s)}${wa}</span></div>`; };
    const pick = owner ? `<div class="advpick" role="tablist" aria-label="المرشد">${advs.map(a => `<button type="button" role="tab" data-ap="${esc(a.email)}" class="${ADM.ap === a.email ? 'on' : ''}" aria-selected="${ADM.ap === a.email}">${a.adv === 'f' ? '👩‍🏫' : '👨‍🏫'} ${esc(a.name)} <small>${a.n}</small></button>`).join('')}<button type="button" role="tab" data-ap="" class="${ADM.ap === '' ? 'on' : ''}" aria-selected="${ADM.ap === ''}">بدون مرشد <small>${D.students.filter(s => !s.adv).length}</small></button></div>` : '';
    const setup = owner ? `<details class="advset"${advs.length ? '' : ' open'}><summary>⚙️ مين المرشدين؟</summary><p class="mut">الطالبات كلهن للمرشدة، والطلاب يتقسّمون بالتساوي بين مرشدي الطلاب. الاسم هنا هو اللي يطلع في رسالة الواتس.</p>
        ${(D.staff || []).map(s => `<div class="advsr" data-se="${esc(s.email)}"><span class="ltr">${esc(s.email)}</span><input type="text" maxlength="40" value="${esc(s.adv_name || s.name)}" aria-label="اسم المرشد في الرسالة" placeholder="الاسم في الرسالة"><select aria-label="دوره">${[['', 'مو مرشد'], ['m', '👨‍🏫 مرشد الطلاب'], ['f', '👩‍🏫 مرشدة الطالبات']].map(([v, t]) => `<option value="${v}"${(s.adv || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="btn sm ghost" data-ss>حفظ</button></div>`).join('') || '<p class="mut">أضف المرشدين من «🛡 المشرفون» أول.</p>'}</details>` : '';
    const head = who ? `<div class="advhd"><b>${who.adv === 'f' ? '👩‍🏫' : '👨‍🏫'} ${esc(who.name)}</b><span>${who.adv === 'f' ? 'مرشدة الطالبات' : 'مرشد الطلاب'} · ${n.all} ${gl(who.adv, n.all)}</span></div>`
      : owner && ADM.ap === '' ? '<div class="advhd"><b>بدون مرشد</b><span>ما نعرف جنسهم من الشيت، أو شلتهم بيدك. اختر لكل واحد مرشده.</span></div>' : '';
    const msgBox = who ? `<details class="advmsg"><summary>✉️ نص الرسالة</summary><pre>${esc(advMsg(who, null, who.adv === 'f' ? '(اسم الطالبة)' : '(اسم الطالب)'))}</pre></details>` : '';
    W.innerHTML = `<div class="stf advp">${setup}${pick}${head}
      ${ADM.ap === '' && owner ? '' : `<div class="sbtiles">${tile('all', '👥', n.all, 'الكل')}${tile('todo', '💬', n.todo, 'ما تواصلت معهم')}${tile('done', '✅', n.done, 'تواصلت معهم')}${tile('idle', '😴', n.idle, 'ما دخلوا من أسبوع')}</div>`}
      ${msgBox}
      <div class="abar"><input id="advq" type="search" placeholder="ابحث بالاسم أو الجوال أو الإيميل…" value="${esc(ADM.aq)}"></div>
      <div class="slist">${list.length ? list.map(row).join('') : `<div class="sempty">${q ? 'لا نتائج' : ADM.af === 'todo' && n.all ? 'تواصلت مع الكل 👍' : 'ما فيه أحد هنا'}</div>`}</div>
      <p class="mut sbnote">${owner ? 'كل مرشد يكلّم طلابه بالواتس من صفحته «💬 طلابي» برسالة جاهزة باسمه، وأنت تشوف هنا مين تواصل معه («✓ تواصلت») وتقدر تنقل أي طالب لمرشد ثاني.' : '«💬 واتساب» يفتح محادثة الطالب برسالة جاهزة باسمك، وتقدر تعدّلها قبل الإرسال. نعلّم الطالب «✓ تواصلت» أول ما تفتح محادثته.'}</p></div>`;
    W.querySelectorAll('[data-af]').forEach(b => b.onclick = () => { ADM.af = b.dataset.af; paintAdv(); });
    W.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => { ADM.ap = b.dataset.ap; ADM.af = 'all'; paintAdv(); });
    $('#advq').oninput = e => { ADM.aq = e.target.value; const pos = e.target.selectionStart; paintAdv(); const i = $('#advq'); i.focus(); i.setSelectionRange(pos, pos); };
    W.querySelectorAll('[data-wa]').forEach(a => a.addEventListener('click', () => { const s = D.students.find(x => x.email === a.dataset.wa); if (!s) return;
      s.wa_at = Date.now(); admCall({ op: 'adv_wa', email: s.email }).catch(() => {}); setTimeout(paintAdv, 300); }));
    W.querySelectorAll('[data-mv]').forEach(sel => sel.onchange = async () => { const s = D.students.find(x => x.email === sel.dataset.mv); if (!s) return;
      try { ADM.adv = await admCall({ op: 'adm_adv_set', email: s.email, adv: sel.value }); toast(`✓ ${nm(s)} صار عند ${sel.value ? (A[sel.value] || {}).name || '' : 'بدون مرشد'}`); paintAdv(); } catch (e) { toast('ما انحفظ: ' + e.message); paintAdv(); } });
    W.querySelectorAll('.advsr').forEach(r => { r.querySelector('[data-ss]').onclick = async () => {
      try { ADM.adv = await admCall({ op: 'adm_staff_adv', email: r.dataset.se, adv: r.querySelector('select').value, adv_name: r.querySelector('input').value }); toast('✓ انحفظ، وانوزّع الطلاب'); ADM.ap = null; paintAdv(); } catch (e) { toast('ما انحفظ: ' + e.message); } }; });
  }

  // i18n:on
  // ---------- ⏳ موعد الاختبار + العدّادات ----------
  const EXAM_LS = 'qg_exam', TRIPX_LS = 'qg_trip_x', DAYMS = 864e5;
  function examGet() { const e = lsGet(EXAM_LS, null); return e && /^\d{4}-\d{2}-\d{2}$/.test(e.d || '') ? e : null; }
  function examAt(e) { e = e || examGet(); if (!e) return 0; const [y, m, d] = e.d.split('-').map(Number); const [hh, mm] = String(e.t || '08:00').split(':').map(Number); return new Date(y, m - 1, d, hh || 0, mm || 0).getTime(); }
  const day0 = t => { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dayDiff = (a, b) => Math.round((day0(b) - day0(a)) / DAYMS);   // كم يوم تقويمي من a إلى b
  const addDays = (t, n) => { const d = new Date(day0(t)); d.setDate(d.getDate() + n); return d.getTime(); };
  const fmtDay = t => new Date(t).toLocaleDateString(EN ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = t => new Date(t).toLocaleTimeString(EN ? 'en-US' : 'ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  const byDays = n => EN ? 'by ' + enN(n, 'day', 'days') : n === 1 ? 'بيوم' : n === 2 ? 'بيومين' : `بـ${n} ${n <= 10 ? 'أيام' : 'يوم'}`;   // i18n:skip
  const p2 = n => String(n).padStart(2, '0');
  function cdParts(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; }
  // عدّاد كبير (مربعات) أو صغير (أيام + ساعات:دقائق:ثواني) — يتحدّث كل ثانية
  function cdHtml(at, small) {
    const p = cdParts(at - Date.now());
    if (small) return _T`<span class="cds" data-cd="${at}"><b data-u="d">${p.d}</b><small>يوم</small><span class="hms" dir="ltr" data-u="hms">${p2(p.h)}:${p2(p.m)}:${p2(p.s)}</span></span>`;
    return _T`<div class="cd" data-cd="${at}" role="timer" aria-label="باقي ${p.d} يوم على اختبارك"><span class="cdu"><b data-u="d">${p.d}</b><small>يوم</small></span><span class="cdu"><b data-u="h">${p2(p.h)}</b><small>ساعة</small></span><span class="cdu"><b data-u="m">${p2(p.m)}</b><small>دقيقة</small></span><span class="cdu sec"><b data-u="s">${p2(p.s)}</b><small>ثانية</small></span></div>`;
  }
  setInterval(() => {
    const els = document.querySelectorAll('[data-cd]'); if (!els.length) return; const now = Date.now();
    els.forEach(el => { const p = cdParts(+el.dataset.cd - now); el.querySelectorAll('[data-u]').forEach(b => { const u = b.dataset.u; const v = u === 'd' ? String(p.d) : u === 'hms' ? `${p2(p.h)}:${p2(p.m)}:${p2(p.s)}` : p2(p[u]); if (b.textContent !== v) b.textContent = v; }); });
  }, 1000);
  function examMsg(dl) {   // dl = أيام تقويمية حتى يوم الاختبار
    if (dl < 0) return _T('إن شاء الله أبدعت في اختبارك 🎉 حدّث الموعد إذا عندك اختبار جديد');
    if (dl === 0) return _T('اليوم اختبارك! ثق في تدريبك، وبالتوفيق 🤲');
    if (dl === 1) return _T('بكرة اختبارك: راجع أخطاءك بهدوء ونم بدري');
    if (dl <= 7) return _T('الأسبوع الأخير: ركّز على أخطائك والاختبارات المحاكية');
    if (dl <= 21) return _T('المرحلة المهمة: كل يوم تذاكر فيه يفرق في درجتك');
    return _T('وقتك يكفي إذا مشيت على خطة. الاستمرار أهم من الكمية');
  }
  function fitInfo(end, exT) {   // نهاية الخطة مقابل يوم الاختبار
    const gap = dayDiff(end, exT);
    if (gap >= 1) return { c: 'ok', gap, t: _T`تخلص قبل اختبارك ${byDays(gap)}`, s: _T`✓ قبل اختبارك ${byDays(gap)}` };
    if (gap === 0) return { c: 'warn', gap, t: _T('تخلص يوم اختبارك نفسه'), s: _T('⚠ تخلص يوم اختبارك') };
    return { c: 'bad', gap, t: _T`تخلص بعد اختبارك ${byDays(-gap)}`, s: _T`⚠ بعد اختبارك ${byDays(-gap)}` };
  }
  // نافذة تحديد موعد الاختبار
  function examDlg() {
    return new Promise(res => {
      const ex = examGet(); const box = document.createElement('div'); box.className = 'modal';
      box.innerHTML = _T`<div class="m exm" role="dialog" aria-modal="true" aria-labelledby="exh"><h3 id="exh">🎯 موعد اختبارك</h3>
        <p class="mut">حدّد موعد اختبار القدرات، ونعرض لك عدّاد تنازلي في الصفحة الرئيسية ونعلّم لك الخطة اللي تلحق قبله.</p>
        <div class="exf"><label><span>التاريخ</span><input type="date" id="exd" min="${dayKey()}" value="${ex ? ex.d : ''}" dir="ltr"></label><label><span>الوقت <small>(اختياري)</small></span><input type="time" id="ext" value="${ex ? ex.t || '08:00' : '08:00'}" dir="ltr"></label></div>
        <div class="acts"><button class="btn" id="exok">حفظ الموعد</button><button class="btn ghost" id="exno">إلغاء</button>${ex ? _T('<span class="sp"></span><button class="lnk" id="exdel">حذف الموعد</button>') : ''}</div></div>`;
      document.body.appendChild(box);
      const close = v => { box.remove(); document.removeEventListener('keydown', onK); res(v); };
      const onK = e => { if (e.key === 'Escape') close(false); };
      document.addEventListener('keydown', onK);
      box.addEventListener('click', e => { if (e.target === box) close(false); });
      $('#exno').onclick = () => close(false);
      const del = $('#exdel'); if (del) del.onclick = () => { lsSet(EXAM_LS, { d: '', up: Date.now() }); skillsPushSoon(1500); toast(_T('تم حذف موعد الاختبار')); close(true); };
      $('#exok').onclick = () => {
        const d = $('#exd').value, t = $('#ext').value || '08:00';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast(_T('اختر تاريخ الاختبار')); $('#exd').focus(); return; }
        const at = examAt({ d, t }); if (at < Date.now() - DAYMS) { toast(_T('التاريخ اللي اخترته مضى')); return; }
        lsSet(EXAM_LS, { d, t, up: Date.now() }); lsDel(TRIPX_LS); skillsPushSoon(1500); toast(_T('تم حفظ موعد اختبارك ✓')); close(true);
      };
      setTimeout(() => { const i = $('#exd'); if (i) i.focus(); }, 60);
    });
  }
  function bindExam(root, after) { (root || document).querySelectorAll('[data-exam]').forEach(b => b.onclick = async () => { if (await examDlg()) after(); }); }

  // ---------- 📅 خطة المذاكرة ----------
  // كل مهمة = شاهد مقطع الشرح ثم حل نفس القسم هنا في المنصة (حل القسم هو نفسه اختبار المقطع)
  const pq = i => ({ k: 'q', set: 'q' + i, t: _T`كمي Section ${i}: شاهد المقطع ثم حل القسم ${i}` });
  const pv = i => ({ k: 'v', set: 'v' + i, t: _T`لفظي Model ${i}: شاهد المقطع ثم حل النموذج ${i}` });
  const WQ = ['#t-wrong-q', _T('أخطائي في الكمي')], WV = ['#t-wrong-v', _T('أخطائي في اللفظي')];
  const pr = (t, links, m) => ({ k: 'r', t, links: links || [], m: m || 60 });
  // 🔁 آخر الأيام مراجعة على الـ14 قسم كمي والـ14 نموذج لفظي (الخطط ما فيها اختبارات محاكية)
  const rng = (a, b) => `<bdi dir="ltr">${a}–${b}</bdi>`;
  const RQ = (a, b, m) => pr(_T`مراجعة الكمي، الأقسام ${rng(a, b)}: أعد حل الأسئلة اللي أخطأت فيها`, [WQ], m);
  const RV = (a, b, m) => pr(_T`مراجعة اللفظي، النماذج ${rng(a, b)}: أعد حل الأسئلة اللي أخطأت فيها`, [WV], m);
  const FINAL = m => [[RQ(1, 7, m), RV(1, 7, m)], [RQ(8, 14, m), RV(8, 14, m)]];   // آخر يومين
  const taskMin = t => t.k === 'q' || t.k === 'v' ? 60 : t.k === 'r' ? t.m : 0;
  const durLabel = m => { const h = Math.round(m / 30) / 2, w = Math.floor(h), half = h % 1 ? ' ونص' : '';   // i18n:skip
    if (EN) return !h ? 'Rest' : !w ? '≈ 30 min' : '≈ ' + (h % 1 ? h + ' hours' : enN(w, 'hour', 'hours'));
    return !h ? 'راحة' : !w ? '≈ 30 دقيقة' : '≈ ' + (w === 1 ? 'ساعة' : w === 2 ? 'ساعتين' : w + (w <= 10 ? ' ساعات' : ' ساعة')) + half; };   // i18n:skip
  const timed = d => { d.forEach(x => { if (x.tasks[0].k !== 'rest') x.time = durLabel(x.tasks.reduce((s, t) => s + taskMin(t), 0)); }); return d; };
  // أيام مذاكرة متتالية: [كم قسم كمي، كم نموذج لفظي] لكل يوم، بالترتيب ومتداخلة (كمي، لفظي، كمي…)
  function studyDays(counts) { const d = []; let q = 1, v = 1;
    counts.forEach(([nq, nv], j) => { const t = []; for (let i = 0; i < Math.max(nq, nv); i++) { if (i < nq) t.push(pq(q++)); if (i < nv) t.push(pv(v++)); } d.push({ n: j + 1, tasks: t }); });
    return d; }
  const PCONT = _T('14 مقطع كمي · 14 مقطع لفظي · مراجعة للأقسام كلها آخر الخطة');
  const PLANS = [
    { id: 'strong', name: _T('الخطة القوية'), days: 7, daily: _T('حوالي 4 إلى 5 ساعات يومياً'), fit: _T('للي اختباره بعد أسبوع'), content: PCONT, rev: 1,
      build() { const d = studyDays([[3, 2], [2, 3], [3, 2], [2, 3], [2, 2], [2, 2]]);
        d.push({ n: 7, tasks: [RQ(1, 14, 90), RV(1, 14, 90)] }); return timed(d); } },
    { id: 'intense', name: _T('الخطة المكثفة'), days: 14, daily: _T('حوالي ساعتين إلى 3 ساعات يومياً'), fit: _T('للي اختباره قريب'), content: PCONT, rev: 2,
      build() { const d = studyDays([[2, 1], [1, 1], [1, 1], [1, 2], [1, 1], [1, 1], [2, 1], [1, 1], [1, 1], [1, 2], [1, 1], [1, 1]]);
        FINAL(90).forEach((t, j) => d.push({ n: 13 + j, tasks: t })); return timed(d); } },
    { id: 'balanced', name: _T('الخطة المتوازنة'), days: 19, daily: _T('حوالي ساعتين يومياً · يوم راحة كل أسبوع'), fit: _T('الأنسب لأغلب الطلاب'), content: PCONT, star: true, rev: 2,
      build() { const d = [], W = n => Math.ceil(n / 7); let k = 1;
        const study = n => { d.push({ n, tasks: [pq(k), pv(k)], w: W(n) }); k++; }, rest = n => d.push({ n, time: _T('راحة'), tasks: [{ k: 'rest', t: _T('يوم راحة: استرجع نشاطك') }], w: W(n) });
        for (let n = 1; n <= 5; n++) study(n);
        d.push({ n: 6, tasks: [pr(_T('مراجعة: أعد حل الأسئلة اللي أخطأت فيها هالأسبوع'), [WQ, WV])], w: 1 }); rest(7);
        for (let n = 8; n <= 13; n++) study(n); rest(14);
        for (let n = 15; n <= 17; n++) study(n);
        FINAL(60).forEach((t, j) => d.push({ n: 18 + j, tasks: t, w: 3 })); return timed(d); } },
    { id: 'relaxed', name: _T('الخطة المريحة'), days: 28, daily: _T('حوالي ساعتين يومياً: يوم مذاكرة ويوم مراجعة خفيفة'), fit: _T('للي عنده دوام أو مدرسة'), content: PCONT, rev: 2,
      build() { const d = [], W = n => Math.ceil(n / 7);
        for (let k = 1; k <= 12; k++) { const n = 2 * k - 1;
          d.push({ n, tasks: [pq(k), pv(k)], w: W(n) });
          d.push({ n: n + 1, tasks: [pr(_T('مراجعة خفيفة: أعد حل أخطاء أمس وراجع ملاحظاتك'), [WQ, WV], 30)], w: W(n + 1) }); }
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
      const lab = p.done ? `✓ ${nm}${p.best != null ? ` <small>${p.best}%</small>` : ''}` : ans ? _T`كمّل ${nm} <small>${ans}${tot ? '/' + tot : ''}</small>` : _T`حل ${nm}`;
      return `<a class="${cls} ${p.done ? 'ok' : ''}" href="#${t.set}">${lab}</a>`;
    }
    return (t.links || []).map(l => `<a class="${cls}" href="${l[0]}">${l[1]}</a>`).join('');
  }
  function taskLinks(t) {
    const y = t.set ? ytFor(t.set) : null;
    return (y ? _T`<a class="go yt" href="${y.url}"${y.tgt}${ytTip(y, _T('مقطع شرح ') + y.label + _T(' على يوتيوب'))}>${vIcon(y)}<span>المقطع</span><small>${y.dur}</small></a>` : '') + taskSolve(t, 'go');
  }
  // بطاقة «رحلتك للاختبار» في الرئيسية: عدّاد الاختبار + مهمة اليوم من الخطة
  function tripHtml() {
    const ex = examGet(), exT = ex ? examAt(ex) : 0, now = Date.now();
    const st = planState(), plan = PLANS.find(p => p.id === st.id) || null;
    if (!ex && !plan) return lsGet(TRIPX_LS, 0) ? '' : _T`<div class="trip invite"><span class="tr-i" aria-hidden="true">⏳</span><span class="tr-t"><b>متى اختبارك؟</b> حدّد الموعد ونعرض لك عدّاد تنازلي، ونقترح لك خطة مذاكرة تلحق قبله.</span><span class="tr-b"><button class="btn sm" data-exam>حدّد الموعد</button><a class="btn sm ghost" href="#plan">خطط المذاكرة</a></span><button class="tr-x" id="trx" title="إخفاء" aria-label="إخفاء">✕</button></div>`;
    let h = _T('<section class="trip" aria-label="موعد اختبارك وخطتك">');
    if (ex) {
      const dl = dayDiff(now, exT), live = exT > now;
      h += _T`<div class="tr-ex"><div class="tr-l"><span class="tr-k">${live ? (dl === 0 ? _T('⏳ اختبارك اليوم بعد') : _T('⏳ باقي على اختبارك')) : dl === 0 ? _T('🤲 اليوم اختبارك') : _T('🎓 كان اختبارك')}</span><span class="tr-d">${fmtDay(exT)}، الساعة ${fmtTime(exT)} <button class="lnk" data-exam>تعديل</button></span><span class="tr-m">${examMsg(dl)}</span></div>${live ? cdHtml(exT) : ''}</div>`;
    }
    if (plan) {
      const I = planInfo(plan, st);
      if (!I.cur) h += _T`<div class="tr-pl"><span class="tr-pi" aria-hidden="true">🎉</span><div class="tr-pt"><span>خلّصت <b>${plan.name}</b> كاملة${ex && exT > now ? _T('. الحين راجع أخطاءك لين يجي اختبارك') : ''}.</span></div><a class="tr-go" href="#plan">الخطة</a></div>`;
      else {
        const links = I.cur.tasks.map(t => t.k === 'rest' ? _T('<span class="tchip rest">😴 يوم راحة</span>') : taskSolve(t, 'tchip')).join('');
        const fit = ex && exT > now ? fitInfo(I.end, exT) : null;
        const tags = `<span>${I.left >= 0 ? _T('تخلص') : _T('كانت تخلص')} ${fmtDay(I.end)}</span>` + (fit ? `<span class="fit ${fit.c}">${fit.s}</span>` : I.left > 0 ? _T`<span>باقي ${dLabel(I.left)}</span>` : '') + (I.lag > 0 ? _T`<span class="fit warn">متأخر ${I.lag === 1 && !EN ? _T('يوم') : dLabel(I.lag)} عن الجدول</span>` : '') + (ex ? '' : _T('<button class="lnk" data-exam>حدّد موعد اختبارك</button>'));
        const ahead = I.cur.n > I.tn;   // خلّص مهام اليوم، وهذي مهام الأيام الجاية
        h += _T`<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span>${ahead ? _T`<b>خلّصت مهام اليوم ✓</b> <span class="mut">(الجاي: اليوم ${I.cur.n} من ${plan.days})</span>` : _T`<b>خطتك اليوم</b> <span class="mut">(اليوم ${I.cur.n} من ${plan.days})</span>`}</span><span class="tr-lk">${links}</span><small class="tr-end">${tags}</small></div><a class="tr-go" href="#plan">افتح الخطة</a></div>`;
      }
    } else h += _T`<div class="tr-pl"><span class="tr-pi" aria-hidden="true">📅</span><div class="tr-pt"><span>ما اخترت خطة مذاكرة. <a href="#plan">اختر خطة تلحق قبل اختبارك</a></span></div></div>`;
    return h + '</section>';
  }
  let planPctShown = null, planArrive = [], planTok = 0;
  const planCalm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function renderPlan(o) {
    o = o || {};
    document.title = _T('خطة المذاكرة | Q-Guide');
    if (!manifest) fetch('/p/data/manifest.json').then(r => r.json()).then(m => { if (!manifest) { manifest = m; if (location.hash === '#plan') renderPlan({ keep: 1 }); } }).catch(() => {});
    const st = planState(); const plan = PLANS.find(p => p.id === st.id) || null;
    app.innerHTML = topbar(_T`<span class="ttl">📅 خطة المذاكرة</span><span class="sp"></span>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) + `<main class="wrap" id="planwrap"></main>`;
    bindCtl();
    const W = $('#planwrap'), now = Date.now();
    const ex = examGet(), exT = ex ? examAt(ex) : 0, live = exT > now;
    if (!plan) {   // اختيار الخطة
      const today = day0(), endOf = p => addDays(today, p.days - 1);
      let rec = null;
      if (live) { const fits = PLANS.filter(p => dayDiff(endOf(p), exT) >= 1); rec = fits.length ? fits.reduce((a, b) => b.days > a.days ? b : a) : PLANS[0]; }
      const dl = live ? dayDiff(now, exT) : 0;
      W.innerHTML = _T`<div class="hero"><div><h1>اختر الخطة اللي تناسب وقتك</h1><p>كل خطة تمشي على مقاطع الشرح (14 كمي و14 لفظي): تشاهد المقطع ثم تحل قسمه هنا في المنصة، وآخر أيامها مراجعة على الأقسام والنماذج كلها. تقدر تغيّر الخطة في أي وقت.</p></div></div>
        <div class="exrow"><span class="exi" aria-hidden="true">🎯</span><div class="ext">${ex ? _T`<b>اختبارك ${fmtDay(exT)}</b><span>${live ? (dl ? _T`باقي ${dLabel(dl)}. علّمنا لك بالنجمة ⭐ الخطة اللي تلحق قبله` : _T('اختبارك اليوم! بالتوفيق')) : _T('الموعد المحفوظ مضى. حدّثه إذا عندك اختبار جديد')}</span>` : _T`<b>متى اختبارك؟</b><span>حدّد الموعد ونعلّم لك الخطة اللي تلحق قبله، ونعرض لك عدّاد تنازلي</span>`}</div><button class="btn sm ${ex ? 'ghost' : ''}" data-exam>${ex ? _T('تعديل الموعد') : _T('حدّد الموعد')}</button></div>
        <div class="plans">${PLANS.map(p => { const star = rec ? p === rec : !live && p.star; const end = endOf(p); const f = live ? fitInfo(end, exT) : null;
          return _T`<button class="pcard ${star ? 'star' : ''} ${f && f.c !== 'ok' ? 'late' : ''}" data-p="${p.id}">${star ? `<span class="pstar">⭐ ${rec ? _T('الأنسب لموعد اختبارك') : _T('الأنسب لأغلب الطلاب')}</span>` : ''}<span class="pn">${p.name}</span><span class="pdays">${p.days} يوماً</span><span class="pm">⏱ ${p.daily}</span><span class="pm">🔁 ${p.rev === 1 ? _T('آخر يوم') : _T('آخر يومين')} مراجعة للـ14 قسم والـ14 نموذج</span><span class="pm">🎯 ${p.fit}</span><span class="pm">🏁 تخلص ${fmtDay(end)}</span>${f ? `<span class="pfit ${f.c}">${f.c === 'ok' ? '✓' : '⚠'} ${f.t}</span>` : ''}<span class="btn">ابدأ هذه الخطة</span></button>`; }).join('')}</div>
        ${rec && dayDiff(endOf(rec), exT) < 1 ? _T`<div class="pverd bad">⚠ باقي على اختبارك ${dl ? dLabel(dl) : _T('أقل من يوم')} بس، وأقصر خطة 7 أيام. ابدأ بالخطة القوية وركّز على الأقسام اللي تحس إنك أضعف فيها.</div>` : ''}
        <div class="sum" style="margin-top:16px;text-align:start"><b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة مباشرة • اقرأ شرح كل سؤال أخطأت فيه، وأخطاؤك تنحفظ لك تلقائياً في «مراجعة أخطائي» • المهام تنعلّم ✓ لحالها لما تحل القسم • إذا فاتك يوم كمّل من مكانك ولا تحاول تعوّض يومين في يوم.</div>`;
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
    if (calm && newly.length) { SN.n = SN.n.concat(newly); if (o.tick) toast(newly.length === 1 ? _T`🎉 خلّصت اليوم ${newly[0]}، ونزل تحت في «إنجازك»` : _T`🎉 خلّصت ${dLabel(newly.length)}، ونزلت تحت في «إنجازك»`); }
    lsSet(PSEEN_LS, SN);
    const act = days.filter(d => !I.dayDone(d) || fresh.indexOf(d.n) >= 0), fin = days.filter(d => I.dayDone(d) && fresh.indexOf(d.n) < 0).reverse();   // «إنجازك»: الأحدث فوق (يطلع تحت الأيام الباقية مباشرة)
    const pct = I.pct, from = planPctShown != null && planPctShown !== pct && !calm ? planPctShown : pct; planPctShown = pct;
    const icon = { q: '🔵', v: '🟢', r: '🟠', rest: '😴' };
    const autoTip = { q: _T('انعلّمت لحالها لأنك حليت القسم'), v: _T('انعلّمت لحالها لأنك حليت النموذج'), rest: _T('يوم الراحة ينحسب لحاله لما يجي تاريخه') };
    const fit = live ? fitInfo(I.end, exT) : null;
    const lagT = !cur ? _T('خلّصت كل الأيام 🎉') : I.lag > 0 ? _T`<span class="fit warn">متأخر ${I.lag === 1 && !EN ? _T('يوم') : dLabel(I.lag)} عن الجدول</span>` : I.lag < 0 ? _T`<span class="fit ok">متقدم ${-I.lag === 1 && !EN ? _T('يوم') : dLabel(-I.lag)} عن الجدول 👏</span>` : cur.n === I.exp + 1 ? _T('<span class="fit ok">خلّصت مهام اليوم ✓</span>') : _T('<span class="fit ok">ماشي على الجدول ✓</span>');
    const leftT = I.left > 0 ? _T`باقي ${dLabel(I.left)}` : I.left === 0 ? _T('اليوم آخر يوم في الخطة') : _T`كان المفروض تخلص قبل ${dLabel(-I.left)}`;
    let verd = '';
    if (fit) verd = fit.c === 'ok' ? _T`✓ خطتك ${fit.t}${fit.gap >= 3 ? _T('. استغل الأيام الزيادة في مراجعة أخطائك') : _T('. التزم بالجدول عشان تلحق')}.`
      : fit.c === 'warn' ? _T('⚠ خطتك تخلص يوم اختبارك نفسه. حاول تسبق الجدول بيوم أو يومين.')
      : (() => { const sh = PLANS.filter(p => p.days < plan.days && dayDiff(addDays(day0(), p.days - 1), exT) >= 1).sort((a, b) => b.days - a.days)[0]; return _T`⚠ خطتك ${fit.t}. ${sh ? _T`بدّل لـ«${sh.name}» (${dLabel(sh.days)})، أو ضاعف` : _T('حاول تضاعف')} بعض الأيام عشان تلحق.`; })();
    let lastW = 0;
    const dayHtml = d => { const wk = plan.days > 14 && d.w !== lastW ? _T`<div class="wk">الأسبوع ${d.w}</div>` : ''; lastW = d.w || lastW;
      const fr = fresh.indexOf(d.n) >= 0, isCur = cur && cur.n === d.n, isTod = d.n === I.tn;
      // «اليوم» = تاريخ اليوم فعلاً · «كمّل من هنا» = أول يوم ما خلّصته (لو مو هو نفس اليوم) · «✓ خلّصته» = لحظة قبل لا ينزل
      const tag = fr ? _T('<span class="now ok">✓ خلّصته</span>') : isTod ? _T`<span class="now${isCur ? '' : ' td'}" title="تاريخ اليوم">اليوم</span>` : isCur ? _T('<span class="now" title="أول يوم في خطتك ما خلّصته">كمّل من هنا</span>') : '';
      return wk + _T`<section class="day ${fr ? 'fin' : ''} ${isCur ? 'cur' : ''} ${isTod ? 'tod' : ''}" id="day${d.n}"${isTod ? ' aria-current="date"' : ''}><header><label class="dchk"><input type="checkbox" data-day="${d.n}" ${fr ? 'checked' : ''}><span>اليوم ${d.n}</span></label><span class="mut">${d.time} · ${fmtDay(addDays(I.start, d.n - 1))}</span>${tag}</header>
          <ul>${d.tasks.map((t, i) => { const a = I.auto(d, t), ok = I.tDone(d, i); return `<li class="${ok ? 'ok' : ''} k${t.k}"><label${a ? ` title="${autoTip[t.k] || ''}"` : ''}><input type="checkbox" data-day="${d.n}" data-i="${i}" ${ok ? 'checked' : ''}${a ? ' disabled' : ''}><span class="ic" aria-hidden="true">${icon[t.k] || ''}</span><span class="tt">${t.t}</span></label><span class="tl">${taskLinks(t)}</span></li>`; }).join('')}</ul></section>`; };
    const dnChip = (d, t, i) => {   // في «إنجازك» كل مهمة ✓
      if (t.k === 'rest') return _T('<span class="tchip rest">😴 راحة</span>');
      if (!I.tDone(d, i)) return taskSolve(t, 'tchip');
      if (t.set) { const g = progGet(t.set); return `<a class="tchip ok" href="#${t.set}">✓ ${SET_NAME(t.set)}${g.done && g.best != null ? ` <small>${g.best}%</small>` : ''}</a>`; }
      return _T('<span class="tchip ok">✓ مراجعة</span>'); };
    const finHtml = d => _T`<div class="dn ${planArrive.indexOf(d.n) >= 0 ? 'arrive' : ''}" id="dn${d.n}"><label class="dchk" title="شيل العلامة لو علّمته بالغلط"><input type="checkbox" data-day="${d.n}" checked><span>اليوم ${d.n}</span></label><span class="mut">${fmtDay(addDays(I.start, d.n - 1))}${d.n === I.tn ? _T(' · <b class="dtod">اليوم</b>') : ''}</span><span class="dnl">${d.tasks.map((t, i) => dnChip(d, t, i)).join('')}</span></div>`;
    const doneTxt = I.nDone ? _T`خلّصت ${dLabel(I.nDone)} من ${days.length}` : _T`ما خلّصت أي يوم من ${days.length} للحين`;
    W.innerHTML = _T`<div class="hero"><div><h1>${plan.name}</h1><p>${plan.days} يوماً · ${plan.daily}</p></div>
        <div class="pctl"><button class="btn sm ghost" id="chg">تغيير الخطة</button><button class="btn sm ghost" id="rst" title="يمسح علاماتك ويبدأ الخطة من اليوم">إعادة البدء</button></div></div>
      <div class="pstats">
        <div class="pst pg"><span class="pk">✅ نسبة الإنجاز</span><b class="pgv"><span data-pct>${from}</span>%</b><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="نسبة إنجازك في الخطة"><i style="width:${from}%"></i></div><span class="ps">${doneTxt}</span><span class="ps2">${lagT}</span></div>
        <div class="pst"><span class="pk">🏁 نهاية الخطة</span><b>${fmtDay(I.end)}</b><span class="ps">${leftT}</span></div>
        <div class="pst ex">${ex ? _T`<span class="pk">🎯 ${live ? _T('باقي على اختبارك') : _T('موعد اختبارك')}</span>${live ? cdHtml(exT, true) : `<b>${fmtDay(exT)}</b>`}<span class="ps">${live ? fmtDay(exT) + _T('، ') + fmtTime(exT) + ' · ' : ''}<button class="lnk" data-exam>تعديل</button></span>` : _T`<span class="pk">🎯 موعد اختبارك</span><b class="none">ما حدّدته</b><span class="ps"><button class="btn sm" data-exam>حدّد الموعد</button></span>`}</div>
      </div>
      ${verd ? `<div class="pverd ${fit.c}">${verd}</div>` : ''}
      <div class="days">${act.length ? act.map(dayHtml).join('') : _T('<div class="pall">🎉 خلّصت كل أيام الخطة! الحين راجع أخطاءك، وأعد حل الأقسام اللي درجتك فيها أقل.</div>')}</div>
      <section class="pdone" aria-labelledby="pdh"><header><h2 id="pdh">✅ إنجازك في الخطة</h2><span class="pdp">${fin.length ? _T`خلّصت ${dLabel(fin.length)} · ` : ''}<b><bdi>${pct}%</bdi></b></span></header>
        ${fin.length ? `<div class="pdl">${fin.map(finHtml).join('')}</div>` : _T('<p class="pde">أول ما تخلّص كل مهام يوم، يتلاشى من فوق وينزل هنا ✓</p>')}</section>
      <div class="sum" style="margin-top:16px;text-align:start">🔵 كمي · 🟢 لفظي · 🟠 مراجعة. المهام تنعلّم ✓ لحالها لما تحل القسم، والمراجعة علّمها أنت. <b>طريقة المذاكرة:</b> شاهد المقطع كاملاً ثم حل القسم نفسه هنا في المنصة، واقرأ شرح كل سؤال أخطأت فيه. إذا فاتك يوم كمّل من مكانك ولا تعوّض يومين في يوم.</div>`;
    planArrive = [];
    const save = () => planSave(Object.assign(st, { done }));
    const re = () => renderPlan({ keep: 1, tick: 1 });
    W.querySelectorAll('input[data-i]').forEach(c => c.onchange = () => { done[c.dataset.day] = done[c.dataset.day] || {}; if (c.checked) done[c.dataset.day][c.dataset.i] = 1; else delete done[c.dataset.day][c.dataset.i]; save(); re(); });
    W.querySelectorAll('input[data-day]:not([data-i])').forEach(c => c.onchange = () => { const d = days.find(x => x.n == c.dataset.day); done[d.n] = {}; if (c.checked) d.tasks.forEach((t, i) => done[d.n][i] = 1); save();
      if (!c.checked) { const J = planInfo(plan, st); if (J.dayDone(J.days.find(x => x.n === d.n))) toast(_T('هذا اليوم محسوب لك لأنك حليت أقسامه ✓')); }
      re(); });
    $('#chg').onclick = async () => { if (await QGDlg.confirm(_T('تغيير الخطة؟ (علاماتك الحالية تُحفظ لو رجعت لنفس الخطة لاحقاً)'), { ok: _T('تغيير') })) { const all = lsGet('qg_plan_all', {}); all[plan.id] = { done, lg: [], mv: 1, sv: PLAN_SV }; lsSet('qg_plan_all', all); planSave({ id: '', done: {} }); renderPlan(); } };
    $('#rst').onclick = async () => { if (await QGDlg.confirm(_T('مسح علاماتك والبدء من اليوم 1؟ (الأقسام اللي حليتها تبقى محسوبة)'), { ok: _T('إعادة البدء'), danger: true })) { planSave({ id: plan.id, done: {}, started: Date.now(), mv: 1, lg: [], sv: PLAN_SV }); renderPlan(); } };
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
      toast(ns.length === 1 ? _T`🎉 خلّصت اليوم ${ns[0]}، ونزل تحت في «إنجازك»` : _T`🎉 خلّصت ${dLabel(ns.length)}، ونزلت تحت في «إنجازك»`);
    }, 600);
  }

  // ---------- 🏆 لوحة الصدارة ----------
  async function renderBoard(kind) {
    document.title = _T('لوحة الصدارة | Q-Guide');
    const isSet = kind.startsWith('set:'); const setId = isSet ? kind.slice(4) : (lsGet('qg_lb_set', 'q1'));
    if (isSet) lsSet('qg_lb_set', setId);
    const tabK = isSet ? 'set' : kind;
    const setTitle = id => SET_NAME(id) + (id[0] === 'q' ? _T(' (كمي)') : _T(' (لفظي)'));
    const opts = [...Array.from({ length: 14 }, (_, i) => 'q' + (i + 1)), ...Array.from({ length: 15 }, (_, i) => 'v' + (i + 1))];
    app.innerHTML = topbar(_T`<span class="ttl">🏆 لوحة الصدارة</span><span class="sp"></span><button class="ib" id="lbref" title="تحديث">⟳</button>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<main class="wrap"><div class="tabs lbtabs"><button data-k="week" class="${tabK === 'week' ? 'on' : ''}">📆 هذا الأسبوع</button><button data-k="set" class="${tabK === 'set' ? 'on' : ''}">🎯 حسب القسم</button><button data-k="exam" class="${tabK === 'exam' ? 'on' : ''}">🧪 المحاكي</button><button data-k="arena" class="${tabK === 'arena' ? 'on' : ''}">⚔️ الساحة</button></div>
      ${isSet ? _T`<div class="setpick"><label>اختر القسم:</label><select id="lbset">${opts.map(o => `<option value="${o}" ${o === setId ? 'selected' : ''}>${setTitle(o)}</option>`).join('')}</select></div>` : ''}
      <p class="mut lbnote">${kind === 'arena' ? _T('ترتيب <b>الساحة 1v1</b> بالتصنيف: الكل يبدأ من 1000، الفوز يرفعك والخسارة تنزّلك، والفوز على خصم أقوى منك يرفعك أكثر.') : kind === 'exam' ? _T('الترتيب بـ<b>متوسط النسبة المئوية</b> لأول محاولة في كل اختبار محاكي (نفس درجة قياس من 100)، ثم عدد الاختبارات، ثم الأسرع وقتاً.')
        : isSet ? (EN ? `Students in <b>${setTitle(setId)}</b> are ranked by their <b>first attempt</b> score; ties go to the faster time.` : _T`ترتيب الطلاب في <b>${setTitle(setId)}</b> بنسبة <b>أول محاولة</b> فيه، وعند التساوي الأسرع وقتاً.`)
        : _T('أفضل 100 طالب <b>هذا الأسبوع</b> (من الأحد): مجموع الإجابات الصحيحة في أول محاولة لكل قسم ونموذج خلال الأسبوع، وعند التساوي الأسرع وقتاً. اللوحة تبدأ من جديد كل أحد.')}</p>
      <div id="lb"><div class="center"><div class="spin" style="margin:0 auto"></div></div></div></main>`;
    bindCtl(); $('#lbref').onclick = () => renderBoard(kind);
    document.querySelectorAll('.lbtabs button').forEach(b => b.onclick = () => { const k = b.dataset.k; location.hash = k === 'week' ? 'board' : k === 'set' ? 'board-set-' + lsGet('qg_lb_set', 'q1') : 'board-' + k; });
    const sel = $('#lbset'); if (sel) sel.onchange = () => { location.hash = 'board-set-' + sel.value; };
    let r; try { r = await api({ op: 'leaderboard', session: auth.session, kind }); } catch (e) { r = null; }
    const el = $('#lb'); if (!el) return;
    if (!r || !r.ok) { if (r && (r.error === 'kicked' || r.error === 'session')) return logout(esc(r.msg || '')); el.innerHTML = _T('<div class="center">تعذّر تحميل اللوحة</div>'); return; }
    const fmt = s => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? _T`${h} س ${m % 60} د` : m ? _T`${m} د` : _T`${s} ث`; };
    const pct = x => x.q ? Math.round(x.correct * 100 / x.q) : 0;
    const isAr = kind === 'arena', unitN = n => EN ? enN(n, kind === 'exam' ? 'test' : 'section', kind === 'exam' ? 'tests' : 'sections') : n + ' ' + (kind === 'exam' ? 'اختبار' : 'قسم');   // i18n:skip
    // عرض الدرجة: المحاكي والقسم = نسبة مئوية؛ الأسبوع = إجابات صحيحة (+ النسبة)
    const scoreHtml = x => isAr ? `<b>${x.r}</b>` : kind === 'exam' ? `<b>${Math.round(x.score)}%</b>` : isSet ? `<b>${Math.round(x.score)}%</b> <small>${x.correct}/${x.q}</small>` : `<b>${x.score}</b> ✓`;
    const subHtml = x => isAr ? _T`${x.w} فوز من ${x.g} ${x.g === 1 ? _T('مباراة') : _T('مباريات')}` : kind === 'exam' ? `${x.done} ${x.done === 1 ? _T('اختبار') : _T('اختبارات')} · ${fmt(x.secs)}` : isSet ? fmt(x.secs) : _T`${pct(x)}% دقة · ${fmt(x.secs)}`;
    const mine = isAr ? (r.me ? _T`<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${arStu(r.total)}</b><span>تصنيفك ${r.me.r} · ${r.me.w} فوز و${r.me.l} خسارة${r.me.d ? (EN ? ' · ' + enN(r.me.d, 'draw', 'draws') : _T(' و') + r.me.d + _T(' تعادل')) : ''}</span></div><a class="btn sm" href="#arena">العب مباراة</a></div>` : _T`<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>العب مباراة وحدة في الساحة وتظهر هنا.</span></div><a class="btn sm" href="#arena">ادخل الساحة</a></div>`)
      : r.me ? _T`<div class="mycard"><div class="myrank">#${r.me.rank}</div><div class="myi"><b>ترتيبك من ${arStu(r.total)}</b><span>${kind === 'exam' ? Math.round(r.me.score) + _T('% متوسط · ') + unitN(r.me.done) : isSet ? Math.round(r.me.score) + '% (' + r.me.correct + '/' + r.me.q + ')' : r.me.score + _T(' إجابة صحيحة · ') + unitN(r.me.done)} · ${fmt(r.me.secs)}</span></div>${kind === 'exam' ? _T('<a class="btn sm" href="/test/">اختبار جديد</a>') : isSet ? _T`<a class="btn sm" href="#${setId}">افتح القسم</a>` : _T('<a class="btn sm" href="#">تدرّب</a>')}</div>`
      : _T`<div class="mycard none"><div class="myi"><b>ما لك ترتيب بعد</b><span>${kind === 'exam' ? _T('أنهِ اختباراً محاكياً واحداً وتظهر هنا.') : isSet ? _T('حل هذا القسم مرة واحدة وتظهر هنا.') : _T('حل قسماً أو نموذجاً هذا الأسبوع وتظهر هنا.')}</span></div>${kind === 'exam' ? _T('<a class="btn sm" href="/test/">ابدأ اختباراً</a>') : isSet ? _T`<a class="btn sm" href="#${setId}">ابدأ القسم</a>` : _T('<a class="btn sm" href="#">ابدأ قسماً</a>')}</div>`;
    if (!r.top.length) { el.innerHTML = mine + _T`<div class="sum" style="margin-top:12px">🏆 اللوحة فاضية — كن أول من يظهر هنا!</div>`; return; }
    const medal = k => ['🥇', '🥈', '🥉'][k - 1] || '';
    const top3 = r.top.slice(0, 3), rest = r.top.slice(3);
    const podium = top3.length >= 3 ? `<div class="podium">${[1, 0, 2].map(i => { const x = top3[i]; return `<div class="pd p${x.rank} ${x.me ? 'me' : ''}">${avatarHtml(x.a, x.n, x.rank === 1 ? 72 : 60)}<div class="pr">${medal(x.rank)}</div><b title="${esc(x.n)}">${esc(x.n)}</b><span class="pscore">${scoreHtml(x)}</span><span>${subHtml(x)}</span></div>`; }).join('')}</div>` : '';
    const list = top3.length >= 3 ? rest : r.top;
    const cols = isAr ? [_T('التصنيف'), _T('الفوز'), _T('المباريات')] : kind === 'exam' ? [_T('النسبة'), _T('الاختبارات'), _T('الوقت')] : isSet ? [_T('النسبة'), _T('الصحيحة'), _T('الوقت')] : [_T('الصحيحة'), _T('الدقة'), _T('الوقت')];
    const cells = x => isAr ? [`<b>${x.r}</b>`, x.w, x.g] : kind === 'exam' ? [`<b>${Math.round(x.score)}%</b>`, x.done, fmt(x.secs)] : isSet ? [`<b>${Math.round(x.score)}%</b>`, `${x.correct}/${x.q}`, fmt(x.secs)] : [`<b>${x.score}</b> ✓`, pct(x) + '%', fmt(x.secs)];
    el.innerHTML = mine + podium + _T`<div class="lbl-list">
      <div class="lbr head"><span class="rk">#</span><span class="nm">الطالب</span><span class="sc">${cols[0]}</span><span class="ac">${cols[1]}</span><span class="tm">${cols[2]}</span>${!isSet && kind !== 'exam' && !isAr ? _T`<span class="dn">الأقسام</span>` : ''}</div>
      ${list.map(x => { const c = cells(x); return `<div class="lbr ${x.me ? 'me' : ''} ${x.rank <= 3 ? 'top' : ''}"><span class="rk">${x.rank <= 3 ? medal(x.rank) : x.rank}</span>${avatarHtml(x.a, x.n, 38)}<span class="nm">${esc(x.n)}</span>${x.me ? _T('<span class="you">أنت</span>') : ''}<span class="sc">${c[0]}</span><span class="ac">${c[1]}</span><span class="tm">${c[2]}</span>${!isSet && kind !== 'exam' && !isAr ? `<span class="dn">${x.done}</span>` : ''}</div>`; }).join('')}</div>
      <p class="mut" style="font-size:12.5px;margin-top:10px">يُعرض أفضل 100 طالب، واللوحة تتحدث كل دقيقة. تقدر تغيّر اسمك وصورتك من زر اسمك في الصفحة الرئيسية.</p>`;
  }

  // ---------- ⚔️ الساحة 1v1: مباراة مباشرة بين طالبين (WebSocket مع الخادم) ----------
  const AR = { ws: null, st: 'lobby', info: null, m: null, T: null, B: null, items: [], left: null, qc: null, off: 0, tm: 0, stm: 0, since: 0, code: '', join: '', end: null, hist: [], sc: [0, 0], i: -1, dl: 0, lim: 0, mine: null, opA: false, opGone: false, goAt: 0, wantClose: false, retry: 0, err: '' };
  const AR_T = { ana: _T('تناظر لفظي'), sen: _T('إكمال جمل'), err: _T('خطأ سياقي'), quant: _T('كمي') };
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
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (EN && m && typeof m.msg === 'string') m.msg = _T(m.msg); if (m.t === 'hi' && !ok) { ok = true; clearTimeout(to); AR.retry = 0; res(m); } arMsg(m); };
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
      if (AR.retry >= 6) { AR.st = 'lobby'; AR.m = null; AR.err = _T('انقطع اتصالك بالساحة، فما قدرنا نكمل المباراة.'); window.onbeforeunload = null; return renderArena(); }
      AR.retry++; arNote(_T('انقطع الاتصال… نحاول نرجعك للمباراة'), 'warn');
      setTimeout(() => { if (AR.wantClose || !AR.m) return; arOpen().then(() => arNote('')).catch(() => {}); }, 1200 + AR.retry * 600);
      return;
    }
    if (['search', 'room', 'joining', 'connecting'].includes(AR.st)) { AR.st = 'lobby'; AR.err = _T('انقطع الاتصال بالساحة. حاول مرة ثانية.'); arPanel(); }
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
  const arAgo = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return EN ? 'just now' : 'الحين'; const m = Math.floor(s / 60); if (m < 60) return EN ? m + 'm ago' : 'قبل ' + m + ' د'; const h = Math.floor(m / 60); if (h < 24) return EN ? h + 'h ago' : 'قبل ' + h + ' س'; const d = Math.floor(h / 24); return d === 1 ? (EN ? 'yesterday' : 'أمس') : EN ? d + ' days ago' : 'قبل ' + d + ' أيام'; };   // i18n:skip
  const arRes = { win: [_T('فوز'), 'win'], loss: [_T('خسارة'), 'loss'], draw: [_T('تعادل'), 'draw'] };
  const arStu = n => EN ? enN(n, 'student', 'students') : n === 1 ? 'طالب واحد' : n === 2 ? 'طالبين' : n <= 10 ? n + ' طلاب' : n + ' طالباً';   // i18n:skip

  // ---------- صفحة الساحة ----------
  async function renderArena(join) {
    document.title = _T('الساحة 1v1 | Q-Guide');
    if (join) AR.join = join;
    if (AR.m && AR_LIVE.includes(AR.st)) return arView();
    if (AR.st === 'end') { AR.st = 'lobby'; arClose(); }
    const me = arMe(), I = AR.info;
    app.innerHTML = topbar(_T`<span class="ttl">⚔️ الساحة 1v1</span><span class="sp"></span><nav class="tnav"><a class="tn" href="#board-arena" title="لوحة ترتيب الساحة"><span class="i">🏆</span><span class="l">الترتيب</span></a></nav>`, _T`<a class="ib" href="#" title="الرئيسية">→</a>`) +
      _T`<main class="wrap arena">
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
    api({ op: 'leaderboard', kind: 'arena', session: auth.session }).then(b => { const el = $('#artop'); if (!el) return; el.innerHTML = b && b.ok ? arTopHtml(b) : _T('<p class="mut">تعذّر تحميل الترتيب.</p>'); }).catch(() => {});
  }
  function arMeCard(me, I) {
    const g = I ? I.g : 0;
    return `<div class="ar-mh">${avatarHtml(me.a, me.n, 46)}<b>${esc(me.n)}</b></div>
      <div class="ar-rt"><b>${I ? I.r : 1000}</b><span>${g ? _T('تصنيفك') : _T('تصنيف البداية')}</span></div>
      ${g ? _T`<div class="ar-wl"><span class="w">${I.w} فوز</span><span class="l">${I.l} خسارة</span>${I.d ? _T`<span>${I.d} تعادل</span>` : ''}</div>
      <p class="ar-rk">${I.rank ? _T`ترتيبك <b>#${I.rank}</b> من ${arStu(I.total)}` : _T('ما تظهر في الترتيب')}${I.best > 1 ? _T` · أطول سلسلة فوز ${I.best}` : ''}</p>`
      : _T`<p class="ar-rk">العب أول مباراة ويطلع لك تصنيف وترتيب بين الطلاب.</p>`}`;
  }
  function arHistHtml(I) {
    if (!I) return '<div class="center"><div class="spin" style="margin:0 auto"></div></div>';
    if (!I.hist || !I.hist.length) return _T('<p class="ar-empty">ما لعبت أي مباراة للحين. أول مباراة تبدأ من زر «ابحث عن خصم».</p>');
    return `<ol class="ar-list">${I.hist.map(h => _T`<li class="ar-hr"><span class="ar-chip ${arRes[h.res][1]}">${arRes[h.res][0]}</span>${avatarHtml(h.op.a, h.op.n, 32)}<span class="ar-hn"><b>${esc(h.op.n || _T('طالب'))}</b><small>${h.kind === 'friend' ? _T('تحدي صديق') : _T('خصم عشوائي')}${h.why === 'quit' ? _T(' · انسحاب') : h.why === 'left' ? _T(' · انقطاع') : ''} · ${arAgo(h.ts)}</small></span><span class="ar-hs" title="نقاطك – نقاط خصمك">${h.sc[0]} – ${h.sc[1]}</span>${h.rated ? `<em class="${h.d >= 0 ? 'up' : 'dn'}" dir="ltr">${h.d >= 0 ? '+' : ''}${h.d}</em>` : _T('<em class="nr">بدون تصنيف</em>')}</li>`).join('')}</ol>`;
  }
  function arTopHtml(b) {
    if (!b.top.length) return _T('<p class="ar-empty">الترتيب فاضي. أول من يفوز يتصدر!</p>');
    const rows = b.top.slice(0, 5); const meIn = rows.some(x => x.me);
    const row = x => _T`<li class="ar-tr ${x.me ? 'me' : ''}"><span class="rk">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</span>${avatarHtml(x.a, x.n, 32)}<span class="ar-hn"><b>${esc(x.n)}</b><small>${x.w} فوز من ${x.g}</small></span><b class="ar-tv">${x.r}</b></li>`;
    return `<ol class="ar-list">${rows.map(row).join('')}${!meIn && b.me ? `<li class="ar-gap" aria-hidden="true">⋯</li>${row(b.me)}` : ''}</ol>`;
  }
  // لوحة الأزرار حسب الحالة: جاهز · يدور · غرفة صديق · ما فيه أحد
  function arPanel() {
    const el = $('#arp'); if (!el) return; clearInterval(AR.stm);
    const live = AR.info && AR.info.live;
    const liveTxt = live && live.online ? `<p class="ar-live"><i></i>${live.waiting ? _T('فيه طالب يدور خصم الحين') : _T`${live.online} في الساحة الحين`}</p>` : '';
    const err = AR.err ? `<p class="ar-err" role="alert">${esc(AR.err)}</p>` : '';
    if (AR.st === 'search') {
      el.innerHTML = _T`<div class="ar-srch"><div class="ar-radar" aria-hidden="true"><i></i><i></i>${avatarHtml(arMe().a, arMe().n, 54)}</div><div><b>ندوّر لك على خصم…</b><span id="arel">0:00</span><small>أول طالب يضغط «ابحث عن خصم» يدخل معك مباشرة.</small></div></div>
        <div class="ar-acts"><button class="ar-gh" id="arcx">إلغاء</button><button class="ar-lk" id="arrm">أو تحدَّ صديقك برابط</button></div>`;
      const tick = () => { const e = $('#arel'); if (e) e.textContent = fmtDur((arNow() - AR.since) / 1000); }; tick(); AR.stm = setInterval(tick, 1000);
    } else if (AR.st === 'room') {
      const link = location.origin + '/p/#duel-' + AR.code;
      const msg = _T`تحداك ${arMe().n} في ساحة Q-Guide ⚔️ 20 سؤال قدرات مباشر. ادخل من الرابط: ${link}`;
      el.innerHTML = _T`<div class="ar-room"><b>أرسل الرابط لصاحبك</b><small>أول ما يفتحه تبدأ المباراة. الرابط صالح 10 دقائق وأنت في هالصفحة.</small>
        <div class="ar-link"><input id="arlk" readonly value="${esc(link)}" dir="ltr" aria-label="رابط التحدي"><button class="ar-cp" id="arcp">نسخ</button></div>
        <div class="ar-acts">${navigator.share ? _T('<button class="rz-go" id="arsh">مشاركة الرابط</button>') : ''}<a class="ar-gh" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">واتساب</a><button class="ar-gh" id="arcx">إلغاء</button></div>
        <p class="ar-wait"><span class="ar-dotsl" aria-hidden="true"><i></i><i></i><i></i></span>بانتظار صاحبك… الرمز <b dir="ltr">${esc(AR.code)}</b></p></div>`;
      $('#arcp').onclick = async () => { const i = $('#arlk'); try { await navigator.clipboard.writeText(i.value); toast(_T('انسخ الرابط ✓')); } catch (e) { i.select(); toast(_T('حدد الرابط وانسخه')); } };
      const sh = $('#arsh'); if (sh) sh.onclick = () => navigator.share({ title: _T('تحدي Q-Guide'), text: msg }).catch(() => {});
    } else if (AR.st === 'connecting' || AR.st === 'joining') {
      el.innerHTML = `<div class="ar-srch"><div class="spin"></div><div><b>${AR.st === 'joining' ? _T('ندخلك لتحدي صاحبك…') : _T('نتصل بالساحة…')}</b></div></div>`;
    } else if (isFree() && AR.left === 0) {   // 🆓 خلصت مبارياته المجانية اليوم
      el.innerHTML = _T`<div class="ar-cap"><b>خلصت مبارياتك المجانية اليوم</b><span>ترجع لك ${FREE_GAMES} مباريات بكرة. اشترك في الدورة والعب بدون حد، بكل أسئلة الاختبارات المحاكية.</span>
        <div class="ar-acts"><button class="rz-go" data-sub>⭐ اشترك والعب بدون حد</button></div></div>`;
      bindSub(el);
    } else {
      el.innerHTML = _T`${err}${AR.st === 'noone' ? _T('<p class="ar-err">ما لقينا أحد يدور خصم الحين. جرّب بعد شوي، أو أرسل رابط تحدي لصاحبك.</p>') : ''}
        <div class="ar-acts"><button class="rz-go" id="arfd">⚔️ ${AR.st === 'noone' ? _T('دوّر مرة ثانية') : _T('ابحث عن خصم')}</button><button class="ar-gh" id="arrm">🔗 تحدَّ صديقك</button></div>${liveTxt}${isFree() && AR.left != null ? _T`<p class="ar-free">باقي لك <b>${AR.left}</b> من ${FREE_GAMES} مباريات مجانية اليوم</p>` : ''}`;
    }
    const f = $('#arfd'); if (f) f.onclick = arFind;
    const rm = $('#arrm'); if (rm) rm.onclick = arRoom;
    const cx = $('#arcx'); if (cx) cx.onclick = arCancel;
  }
  async function arGo(first) {
    AR.err = ''; AR.st = 'connecting'; arPanel();
    try { await arOpen(); } catch (e) { AR.st = 'lobby'; AR.err = _T('تعذّر الاتصال بالساحة. تأكد من الإنترنت وحاول مرة ثانية.'); arPanel(); return false; }
    return first();
  }
  function arFind() { return arGo(() => arSend({ t: 'find' })); }
  function arRoom() { return arGo(() => arSend({ t: 'room' })); }
  function arJoin(code) { AR.err = ''; AR.st = 'joining'; arPanel(); arOpen().then(() => arSend({ t: 'join', code })).catch(() => { AR.st = 'lobby'; AR.err = _T('تعذّر الاتصال بالساحة. افتح الرابط مرة ثانية.'); arPanel(); }); }
  function arCancel() { arSend({ t: 'cancel' }); AR.st = 'lobby'; arPanel(); setTimeout(arClose, 150); }

  function arMsg(m) {
    if (m.now) AR.off = m.now - Date.now();
    switch (m.t) {
      case 'hi': if (m.left != null) AR.left = m.left; return;
      case 'wait': AR.st = 'search'; AR.since = m.since; return arPanel();
      case 'noone': AR.st = 'noone'; arPanel(); return setTimeout(arClose, 100);
      case 'room': AR.st = 'room'; AR.code = m.code; return arPanel();
      case 'roomexp': AR.st = 'lobby'; AR.err = _T('انتهت صلاحية رابط التحدي. سوّ رابط جديد.'); arPanel(); return arClose();
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
      case 'replaced': AR.wantClose = true; AR.st = 'lobby'; AR.m = null; AR.err = _T('فتحت الساحة في نافذة أو جهاز ثاني، فوقفناها هنا.'); window.onbeforeunload = null; return location.hash === '#arena' ? renderArena() : (location.hash = 'arena');
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
      case 'void': { if (m.left != null) AR.left = m.left; AR.st = 'lobby'; AR.m = null; AR.err = m.msg || _T('انلغت المباراة.'); window.onbeforeunload = null; arStop(); arClose(); return location.hash === '#arena' ? renderArena() : (location.hash = 'arena'); }
      case 'againwait': { const n = $('#aragn'); if (n) n.textContent = _T('طلبت إعادة المباراة… بانتظار موافقة خصمك.'); const b = $('#arag'); if (b) b.disabled = true; return; }
      case 'againask': { const n = $('#aragn'); if (n) { n.textContent = _T('خصمك يبي إعادة المباراة! اضغط «إعادة المباراة» لو تبي.'); n.classList.add('hot'); } const b = $('#arag'); if (b) b.classList.add('pulse'); return; }
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
    catch (e) { const v = $('#arvm'); if (v) v.innerHTML = _T('تعذّر تحميل الأسئلة. <button class="ar-lk" id="arrl">حاول مرة ثانية</button>'); const b = $('#arrl'); if (b) b.onclick = () => arMatch(m); return; }
    if (AR.m !== m) return;
    if (AR.pendQ) { const q = AR.pendQ; await arOpen1(q.i, q.k).catch(() => {}); return arQ(q); }
    if (!m.resume || m.phase === 'prep') { arSend({ t: 'ready', m: m.m }); const v = $('#arvm'); if (v) v.textContent = _T('بانتظار خصمك…'); }
    else if (m.phase === 'count') { AR.goAt = m.at; arCount(); }
    else if (m.phase === 'q') arQ({ i: m.i, dl: m.dl, lim: m.qt[m.refs[m.i][2]] * 1000, mine: m.mine, opAns: m.opAns });
    else if (m.phase === 'rev') { arBoard(); const q = $('#arq'); if (q) q.innerHTML = _T('<div class="ar-hold"><div class="spin"></div>السؤال الجاي…</div>'); }
  }
  function arDots(who) { return AR.m.refs.map((r, j) => { const h = AR.hist[j]; const c = h ? (who === 0 ? (h.mo ? 'ok' : h.my == null ? 'na' : 'bad') : (h.oo ? 'ok' : h.op == null ? 'na' : 'bad')) : ''; return `<i class="${c}${j === AR.i ? ' cur' : ''}" title="${r[2] === 'v' ? _T('لفظي') : _T('كمي')}"></i>`; }).join(''); }
  function arView() {
    const m = AR.m, me = m.me, op = m.op, myN = arMe();
    app.innerHTML = topbar(_T`<span class="ttl">⚔️ ${m.kind === 'friend' ? _T('تحدي صديق') : _T('مباراة الساحة')}</span><span class="sp"></span><button class="ar-quit" id="arqt">انسحاب</button>`, `<span class="brand"><img src="/assets/logo.png" alt="">Q-Guide</span>`) +
      _T`<main class="wrap arena arm">
        <div class="ar-sb" id="arsb">
          <div class="ar-pl me">${avatarHtml(me.a || myN.a, myN.n, 44)}<span class="ar-pn"><b>أنت</b><small id="arms">${me.r}</small></span><b class="ar-ps" id="ars0">${AR.sc[0]}</b></div>
          <div class="ar-mid"><span class="ar-qc" id="arqc">${AR.i >= 0 ? AR.i + 1 : '–'}<small>/${m.refs.length}</small></span><span class="ar-tm" id="artm">--</span></div>
          <div class="ar-pl op"><b class="ar-ps" id="ars1">${AR.sc[1]}</b><span class="ar-pn"><b>${esc(op.n || _T('خصمك'))}</b><span class="ar-os"><small id="aros">${op.r}</small><button type="button" class="ar-nd" id="arnd" hidden aria-label="نبّه خصمك يستعجل">⏰ نبّه</button></span></span>${avatarHtml(op.a, op.n, 44)}</div>
          <div class="ar-dots" aria-hidden="true"><div class="r"><span>أنت</span><div id="ard0">${arDots(0)}</div></div><div class="r"><span>خصمك</span><div id="ard1">${arDots(1)}</div></div></div>
          <div class="ar-bar"><i id="arbar"></i></div>
          <div class="ar-ndn" id="arndn" role="status" aria-live="assertive" hidden></div>
        </div>
        <div id="arnote" class="ar-note" hidden></div>
        <div id="arq"><div class="ar-vs"><div class="ar-vp me">${avatarHtml(me.a || myN.a, myN.n, 88)}<b>${esc(myN.n)}</b><span>تصنيف ${me.r}</span></div><div class="ar-vx" id="arvx">VS</div><div class="ar-vp op">${avatarHtml(op.a, op.n, 88)}<b>${esc(op.n || _T('خصمك'))}</b><span>تصنيف ${op.r}</span></div></div>
          <p class="ar-vsm" id="arvm">نحمّل الأسئلة…</p></div>
      </main>`;
    bindCtl();
    $('#arnd').onclick = arNudge;
    $('#arqt').onclick = async () => { if (!AR.m || !AR_LIVE.includes(AR.st)) return; if (await QGDlg.confirm(_T('تنسحب من المباراة؟ تنحسب لك خسارة.'), { ok: _T('انسحاب') })) { arSend({ t: 'quit', m: AR.m.m }); } };
    document.onkeydown = e => { if (AR.st !== 'q' || e.ctrlKey || e.metaKey || e.altKey) return; const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(String(e.key).toLowerCase()); if (k >= 0) { e.preventDefault(); arAns(k); } };
    if (AR.st === 'q') arQ({ i: AR.i, dl: AR.dl, lim: AR.lim, mine: AR.mine, opAns: AR.opA });
  }
  function arNote(t, cls) { const n = $('#arnote'); if (!n) return; n.hidden = !t; n.textContent = t || ''; n.className = 'ar-note ' + (cls || ''); }
  function arCount() {
    AR.st = 'vs'; arStop(); if (!$('#arvx')) arView();
    const v = $('#arvm'), x = $('#arvx');
    const run = () => { const s = Math.ceil((AR.goAt - arNow()) / 1000); if (s <= 0) { arStop(); return; } if (x) { x.textContent = s; x.classList.add('n'); } if (v) v.textContent = _T('المباراة تبدأ بعد'); };
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
    s.textContent = AR.opGone ? _T('انقطع اتصاله…') : AR.st === 'q' ? (AR.opA ? _T('جاوب ✓') : _T('يفكر…')) : AR.m.op.r;
    if (AR.st === 'q' && AR.mine != null) { const st = $('#arst'); if (st) st.innerHTML = AR.opA || AR.opGone ? _T('<span class="spin sm"></span> نكشف الإجابة…') : _T('<span class="spin sm"></span> بانتظار خصمك…'); }
    arNudgeBtn();
  }
  // ⏰ «نبّه خصمك»: يطلع وقت ما خصمك يفكر، وينضغط مرة كل 10 ثواني
  function arNudgeBtn() {
    const b = $('#arnd'); if (!b) return;
    const can = !!AR.m && AR.st === 'q' && !AR.opA && !AR.opGone; b.hidden = !can; if (!can) return;
    const left = Math.ceil(((AR.ndNext || 0) - arNow()) / 1000), wait = left > 0;
    const txt = !wait ? _T('⏰ نبّه') : left >= 9 ? _T('✓ وصل') : '⏰ ' + left;
    if (b.textContent !== txt) b.textContent = txt;
    b.disabled = wait; b.classList.toggle('sent', wait && left >= 9);
    b.title = wait ? _T`تقدر تنبّهه مرة ثانية بعد ${left} ثواني` : _T('نبّه خصمك يستعجل');
  }
  function arNudge() {
    if (!AR.m || AR.st !== 'q' || AR.opA || AR.opGone || (AR.ndNext || 0) > arNow()) return;
    AR.ndNext = arNow() + 10000; arNudgeBtn();
    arSend({ t: 'nudge', m: AR.m.m });
  }
  function arNudged(m) {   // خصمك نبّهك
    if (!AR.m || AR.st !== 'q' || m.i !== AR.i || AR.mine != null) return;
    const n = $('#arndn'); if (n) { n.textContent = _T`⏰ ${(m.n || AR.m.op.n || _T('خصمك')).slice(0, 18)} يستعجلك، جاوب بسرعة!`; n.hidden = false; n.classList.remove('in'); void n.offsetWidth; n.classList.add('in');
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
    if (!it) { $('#arq').innerHTML = _T('<div class="ar-hold">تعذّر عرض هذا السؤال. ننتقل للي بعده…</div>'); return; }
    const ty = it.type;
    let h = _T`<div class="q ar-q"><div class="hd"><span class="n">سؤال ${m.i + 1}<small>من ${n}</small></span><span class="tag">${AR_T[ty] || ''}</span></div>`;
    if (ty === 'quant') h += _T`<img class="qi" src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${m.i + 1}">`;
    else h += `<p class="ar-in ltr">${AR_IN[ty] || ''}</p><p class="txt ltr">${ty === 'ana' ? '<b>' + esc(it.q) + '</b>' : esc(it.q)}</p>`;
    const two = ty === 'quant' || it.opts.every(o => o.length <= 28);
    h += `<div class="opts ${two ? 'two' : ''}">` + it.opts.map((o, k) => `<button type="button" class="opt${AR.mine === k ? ' sel' : ''}" data-k="${k}" ${AR.mine != null ? 'disabled' : ''}><span class="L">${LETTERS[k]}</span><span class="ot">${esc(ty === 'quant' ? o.replace(/^[A-D]\)\s*/, '') : o)}</span></button>`).join('') + '</div>';
    h += `<div class="ar-st" id="arst">${AR.mine != null ? '' : _T('اختر إجابتك بسرعة<span class="kb">، أو اضغط 1 إلى 4 من الكيبورد</span>')}</div></div>`;
    $('#arq').innerHTML = h;
    document.querySelectorAll('#arq .opt').forEach(b => b.onclick = () => arAns(+b.dataset.k));
    arOpStatus();
    const bar = $('#arbar'), tm = $('#artm');
    const tick = () => {
      const left = Math.max(0, AR.dl - arNow()), s = Math.ceil(left / 1000);
      if (tm) { tm.textContent = fmtDur(s); tm.classList.toggle('low', s <= 5); }
      arNudgeBtn();
      if (bar) { bar.style.width = (left / AR.lim * 100).toFixed(1) + '%'; bar.classList.toggle('low', s <= 5); }
      if (left <= 0) { arStop(); const st = $('#arst'); if (st && AR.mine == null) st.textContent = _T('انتهى الوقت ⏱'); document.querySelectorAll('#arq .opt').forEach(b => b.disabled = true); }
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
      if (k === m.op.c) b.insertAdjacentHTML('beforeend', _T`<span class="ar-om" title="اختيار خصمك">${avatarHtml(op.a, op.n, 24)}</span>`);
    });
    const st = $('#arst');
    if (st) st.innerHTML = `<span class="ar-mine ${m.me.ok ? 'ok' : 'bad'}">${m.me.ok ? _T`صح! <bdi dir="ltr">+${m.me.p}</bdi>` : m.me.c == null ? _T('ما جاوبت') : _T('إجابتك خطأ')}</span><span class="ar-his">${esc(op.n || _T('خصمك'))}: ${m.op.ok ? _T`صح <bdi dir="ltr">+${m.op.p}</bdi>` : m.op.c == null ? _T('ما جاوب') : _T('خطأ')}</span>`;
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
    AR.i = -1; arBoard(); arOpStatus(); const qc = $('#arqc'); if (qc) qc.innerHTML = `${m.done}<small>/${AR.m.refs.length}</small>`; const tm = $('#artm'); if (tm) tm.textContent = _T('انتهت'); const bar = $('#arbar'); if (bar) bar.style.width = '0%';
    const qt = $('#arqt'); if (qt) qt.remove();
    const op = AR.m.op, win = m.res === 'win', why = m.why;
    const head = { win: _T('فزت!'), loss: _T('خسرت هالمرة'), draw: _T('تعادل') }[m.res];
    const sub = why === 'quit' ? (win ? _T('خصمك انسحب من المباراة.') : _T('انسحبت من المباراة.')) : why === 'left' ? (win ? _T('انقطع اتصال خصمك وما رجع.') : _T('انقطع اتصالك وما رجعت في الوقت.'))
      : win ? _T`جاوبت ${m.cor[0]} صح من 20 وجبت نقاط أكثر من ${esc(op.n || _T('خصمك'))}.` : m.res === 'draw' ? _T('نفس النقاط بالضبط!') : _T`${esc(op.n || _T('خصمك'))} جاب نقاط أكثر. راجع الأسئلة تحت وارجع أقوى.`;
    const rt = m.rated && m.r ? _T`<p class="ar-rtc">تصنيفك <b>${m.r.now}</b> <em class="${m.r.d >= 0 ? 'up' : 'dn'}" dir="ltr">${m.r.d >= 0 ? '+' : ''}${m.r.d}</em></p>` : _T('<p class="ar-rtc">مباراة بدون تصنيف</p>');
    $('#arq').innerHTML = _T`<section class="ar-end ${m.res}">
      <div class="ar-eh"><h2>${head}</h2><p>${sub}</p></div>
      <div class="ar-fin"><div class="me">${avatarHtml(AR.m.me.a || arMe().a, arMe().n, 56)}<b dir="ltr">${m.sc[0]}</b><span>${m.cor[0]} صح</span></div><span class="ar-fx">–</span><div class="op">${avatarHtml(op.a, op.n, 56)}<b dir="ltr">${m.sc[1]}</b><span>${m.cor[1]} صح</span></div></div>
      ${rt}
      ${isFree() && AR.left === 0 ? _T`<div class="ar-acts c"><button class="rz-go" data-sub>⭐ اشترك والعب بدون حد</button><button class="btn ghost" id="arbk">رجوع للساحة</button></div><p class="ar-free">هذي كانت آخر مباراة مجانية لك اليوم، وترجع لك ${FREE_GAMES} مباريات بكرة.</p>`
        : _T`<div class="ar-acts c"><button class="rz-go" id="arag">إعادة المباراة</button><button class="btn" id="arnw">خصم جديد</button><button class="btn ghost" id="arbk">رجوع للساحة</button></div>${isFree() && AR.left != null ? _T`<p class="ar-free">باقي لك <b>${AR.left}</b> من ${FREE_GAMES} مباريات مجانية اليوم</p>` : ''}`}
      <p class="ar-agn" id="aragn" aria-live="polite"></p>
      ${m.done ? _T`<details class="ar-rv" id="arrvd"><summary>${EN ? (m.done === 1 ? 'Review the question and its answer' : `Review the ${m.done} questions and their answers`) : `راجع ${m.done === 20 ? 'الأسئلة الـ20' : m.done === 1 ? 'السؤال' : 'الأسئلة الـ' + m.done} وإجاباتها`}</summary><div id="arrv"></div></details>` : ''}
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
    return (isFree() ? _T('<p class="ar-exl">🔒 شرح كل سؤال للمشتركين في الدورة. <button type="button" class="lnk" data-sub>اشترك</button></p>') : '') + AR.m.refs.slice(0, AR.done == null ? AR.m.refs.length : AR.done).map((r, j) => {
      const it = arItem(j), h = AR.hist[j] || {}; if (!it) return ''; const ty = it.type, fx = full(r), exp = fx && fx.exp;
      const lab = o => esc(ty === 'quant' ? o.replace(/^[A-D]\)\s*/, '') : o);
      return _T`<article class="ar-ri"><div class="ar-rih"><b>سؤال ${j + 1}</b><span class="tag">${AR_T[ty] || ''}</span><span class="ar-rir ${h.mo ? 'ok' : 'bad'}">${h.mo ? _T`أنت صح +${h.mp || 0}` : h.my == null ? _T('ما جاوبت') : _T('أنت خطأ')}</span><span class="ar-rio">${esc(op.n || _T('خصمك'))}: ${h.oo ? _T('صح') : h.op == null ? _T('ما جاوب') : _T('خطأ')}</span></div>
        ${ty === 'quant' ? _T`<img src="${it.img}" width="${it.w}" height="${it.h}" alt="سؤال ${j + 1}" loading="lazy">` : `<p class="ltr">${esc(it.q)}</p>`}
        <ul class="ar-ro ltr">${it.opts.map((o, k) => `<li class="${k === h.k ? 'k' : k === h.my ? 'w' : ''}"><b>${LETTERS[k]}</b> ${lab(o)}${k === h.my ? _T(' <small>اختيارك</small>') : ''}${k === h.op ? _T(' <small>خصمك</small>') : ''}</li>`).join('')}</ul>
        ${exp ? _T`<details class="ar-ex"><summary>الشرح</summary><div>${fmtExp(exp)}</div></details>` : ''}</article>`;
    }).join('');
  }

  // 🤖 المساعد الذكي «اشرح لي» (assets/ai.js): نفس منسّق المعادلات، ونافذة الاشتراك للزائر
  if (window.QGAI) QGAI.init({ api: QG.API, session: () => auth && auth.session, fmt: arFx, free: isFree, onSub: () => subDlg('', 'المساعد الذكي'), onAuth: r => setTimeout(() => { QGAI.close(); logout(esc(r.msg || '')); }, 1800),   // i18n:skip (اسم الإحصائية بالعربي)
    help: { find: helpFind, profile: helpProfile, link: helpLink, name: () => firstName(auth && (auth.display || auth.name)) } });   // 🙋 المساعد العام
  applyFs(); applyTheme();
  // 💳 الرجوع من صفحة الدفع: تاب يضيف ?tap_id=chg_… لرابط الرجوع — نحفظه ونروح لصفحة التحقق
  (function () { const m = /[?&]tap_id=(chg_[A-Za-z0-9]+)/.exec(location.search); if (!m) return; try { sessionStorage.setItem(PAY_SS, m[1]); } catch (e) {} history.replaceState(null, '', location.pathname + '#paid'); })();
  if (!gsiFromHash()) route();
})();
