/* QGHand — «الشرح التلقائي» في استوديو تيك توك (للمشرفين): سكربت يقرأه المشرف، و«يد» تكتب وترسم على البطاقة بنفس توقيت كلامه.
   نفس فكرة «عرض شرح قواعد الكمي»: كل سطر = ضغطة · الكلمة اللي لازم تنقال الحين تنوّر · كل حركة مربوطة بكلمة في السطر وتبدأ وقت ما تنقال.
   سطر = { t: 'الكلام', a: [[cue, kind, target, arg?, opts?], …], p?: ثواني تفكير }
     cue = نص من السطر (أول ظهور من مكان الحركة اللي قبلها) أو رقم حرف · opts = { c: r|b|g|k|o|y }
   kind: tr (فقاعة الترجمة) · und (خط تحت) · x (شطب) · circ (دائرة؛ الصف العريض ياخذ مستطيل) · box · tick · cross · hl (تظليل)
         arr (سهم من target إلى arg) · pt (تأشير يختفي) · w (كتابة arg: target = sol سطر الحل الجاي | sol:k | above:<هدف> | below:<هدف>)
         ans (كشف الإجابة + دائرة خضراء حول الصح)
   target: q (السؤال) · q:0 / q:1 (طرفي التناظر) · q:1@5-8 (حروف من الكلمة) · o:2 (نص الخيار) · o:2:r (صف الخيار) · o:2:0 · o:2:1@4-7 · sol · w:k (سطر مكتوب)
   ما فيه أي سؤال من البنك هنا: السكربت المفصّل يجي مع ملف الأسئلة المشفّر (say)، والباقي يتولّد من بيانات السؤال نفسه (gen). */
(function () {
  'use strict';
  const LEAD = 450, TAIL = 750, GAP = 110;
  const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
  const INK = { r: '#D62828', b: '#1F5FBF', g: '#1B9E63', k: '#111111', o: '#E9A23B', y: 'rgba(255,214,0,.45)' };
  const MS = { und: 340, x: 360, hl: 460, circ: 600, box: 660, tick: 380, cross: 460, arr: 600, pt: 520, tr: 460, ans: 900 };
  const AR = /[\u0600-\u06FF]/, NS = 'http://www.w3.org/2000/svg';
  const firstStrong = s => { const m = /[A-Za-z\u0600-\u06FF]/.exec(s || ''); return m ? m[0] : ''; };

  /* ---------- وقت القراءة: نفس نموذج العرض — هو اللي يحدد الكلمة المنوّرة، ومتى ترسم اليد، ومتى ينتقل التشغيل التلقائي ---------- */
  const SC = new WeakMap();
  function sched(line) {
    if (!line) return { text: '', w: [], W: 0 };
    let s = SC.get(line); if (s) return s;
    const text = String(line.t || ''), w = [], re = /\S+/g; let m, t = 0;
    while ((m = re.exec(text))) {
      const k = m[0], dg = (k.match(/\d/g) || []).length, n = (k.match(/[A-Za-z\u0621-\u064a\u0671-\u06d3]/g) || []).length;
      const ms = dg ? 430 + 170 * dg : n ? 190 + 60 * n : 0;
      w.push({ a: m.index, b: m.index + k.length, t, d: ms }); t += ms + (k.match(/[،.؟!:…]/g) || []).length * 260;
    }
    s = { text, w, W: t }; SC.set(line, s); return s;
  }
  const dur = line => line ? LEAD + TAIL + sched(line).W + (line.p || 0) * 1000 : 1500;
  const timeAt = (sc, pos) => { for (const x of sc.w) if (x.b > pos) return x.t; return sc.W; };
  /* الكلمة المنوّرة بعد el ملي ثانية من بداية السطر: -1 قبل أول كلمة · w.length بعد آخر كلمة */
  function litAt(line, el, sp) {
    const sc = sched(line), e = el * (sp || 1) - LEAD, w = sc.w; if (e >= sc.W) return w.length;
    let cur = -1; if (e >= 0) for (let k = 0; k < w.length; k++) { if (w[k].t <= e) { if (w[k].d) cur = k; } else break; }
    return cur;
  }
  /* حركات السطر بمكان كلماتها (cue نص → رقم الحرف) */
  function acts(line) {
    if (!line) return [];
    if (line._a) return line._a;
    const t = String(line.t || ''); let from = 0;
    line._a = (line.a || []).map(a => {
      let c = a[0]; const rest = a.slice(3), last = rest[rest.length - 1], o = last && typeof last === 'object' && !Array.isArray(last) ? last : {}, arg = rest.find(x => typeof x === 'string');
      if (typeof c === 'string') { const k = t.indexOf(c, from); c = k; if (k >= 0) from = k; }
      return { c: typeof c === 'number' ? c : -1, k: a[1], tg: a[2] || '', arg, o };
    });
    return line._a;
  }
  const cueWords = line => { const sc = sched(line), s = new Set(); acts(line).forEach(a => { if (a.c < 0) return; const k = sc.w.findIndex(q => q.b > a.c); if (k >= 0) s.add(k); }); return s; };
  function sayHtml(line, esc) {
    const sc = sched(line), cues = cueWords(line); let h = '', p = 0;
    sc.w.forEach((q, k) => { h += esc(sc.text.slice(p, q.a)) + `<span class="kw${cues.has(k) ? ' cue' : ''}" data-k="${k}">${esc(sc.text.slice(q.a, q.b))}</span>`; p = q.b; });
    return h + esc(sc.text.slice(p));
  }

  /* ---------- السكربت التلقائي (لكل سؤال ما له سكربت مفصّل) ---------- */
  const sides = s => String(s || '').split(':').map(x => x.trim()).filter(Boolean);
  const relOf = exp => { const m = /العلاقة\s*:?\s*\(([^)]+)\)/.exec(exp || '') || /العلاقة\s*:\s*([^.\n(]+)/.exec(exp || ''); return m ? m[1].trim().replace(/\s+/g, ' ') : ''; };
  const NO = ['ما تمشي على نفس العلاقة. شطب!', 'علاقة ثانية، مو نفسها. شطب!', 'ما تركب على علاقتنا أبد. شطب!'];
  const HOOK = 'يا هلا! معي سؤال تناظر سريع، وأتحداك تحلّه قبلي! جاوب في التعليقات قبل ما أحل، وكمّل معي. يلا!';
  const BYE = 'إذا جبتها قبلي اكتب «جبتها» في التعليقات!';
  const GRT = 'وتذكّر: إذا حليت كل أسئلة الأقسام والنماذج في دورتنا وجبت أقل من 90، نرجّع لك اشتراكك، والشروط في الموقع. تابعني عشان ما يفوتك السؤال الجاي!';   // 🛡 ضمان الدرجة = الرسالة الأساسية (طلب المالك)
  function genV(it) {
    const ar = it.ar || {}, q = sides(ar.q), O = (ar.o || []).map(sides), rel = relOf(it.exp), L = [{ t: HOOK, p: 1 }];
    if (q.length === 2) L.push({ t: `أول شي نترجم: ${q[0]}، و${q[1]}.`, a: [[q[0], 'tr', 'q:0'], ['و' + q[1], 'tr', 'q:1']] });
    else L.push({ t: 'أول شي نترجم الكلمتين ونفهم معناهم.', a: [['نترجم', 'tr', 'q:0'], ['الكلمتين', 'tr', 'q:1']] });
    if (rel) L.push({ t: `طيب وش العلاقة بينهم؟ ${rel.replace(/\s*:\s*/g, '، و')}.`, a: [['العلاقة', 'w', 'sol', rel, { c: 'b' }]] });
    else L.push({ t: 'طيب وش العلاقة بينهم؟ فكّر فيها معي، وبنجرّبها على كل خيار.' });
    let n = 0; const nm = (s, i) => s.length === 2 ? `${s[0]} و${s[1]}` : `الخيار ${ORD[i]}`, trs = (s, i) => s.length === 2 ? [[s[0], 'tr', `o:${i}:0`], ['و' + s[1], 'tr', `o:${i}:1`]] : [];
    it.opts.forEach((o, i) => { if (i === it.ans) return; const s = O[i] || []; L.push({ t: `${nm(s, i)}… ${NO[n++ % NO.length]}`, a: trs(s, i).concat([['شطب', 'x', `o:${i}`]]) }); });
    const s = O[it.ans] || [];
    L.push({ t: `وبقي لنا: ${nm(s, it.ans)}… نفس العلاقة بالضبط!`, a: trs(s, it.ans).concat([['بالضبط', 'circ', `o:${it.ans}:r`, { c: 'g' }]]) });
    L.push({ t: `والجواب… الخيار ${ORD[it.ans]}! جبتها؟ كفو عليك!`, a: [['الخيار', 'ans']] });
    L.push({ t: BYE }, { t: GRT });
    return L;
  }
  /* سطر الحل المكتوب (رموز) → كلام يتقرأ: ضرب، يساوي، ناقص… */
  const SAY = [[/≥/g, ' أكبر من أو يساوي '], [/≤/g, ' أصغر من أو يساوي '], [/≠/g, ' لا يساوي '], [/≈/g, ' تقريباً '], [/×/g, ' ضرب '], [/÷/g, ' قسمة '], [/=/g, ' يساوي '],
    [/[−–]/g, ' ناقص '], [/(\d|\s)-(?=\s|\d)/g, '$1 ناقص '], [/\+/g, ' زائد '], [/%/g, ' بالمية'], [/²/g, ' تربيع'], [/³/g, ' تكعيب'], [/√/g, ' جذر '], [/π/g, ' باي '],
    [/>/g, ' أكبر من '], [/</g, ' أصغر من '], [/(\d)\s*\/\s*(\d)/g, '$1 على $2'], [/\^/g, ' أس '], [/\bm²/g, ' متر مربع'], [/\bSR\b/g, ' ريال'], [/\bcm\b/g, ' سم'], [/\bkm\b/g, ' كم'],
    [/[→⇒]/g, ' يعني '], [/•/g, ' '], [/\bA\b/g, 'إيه'], [/\bB\b/g, 'بي'], [/\bx\b/g, 'إكس'], [/\by\b/g, 'واي'], [/[📝✅❌👉]/gu, '']];
  const spoken = s => { let x = ' ' + String(s || '').replace(/[⁦-⁩]/g, '') + ' '; SAY.forEach(([r, v]) => { x = x.replace(r, v); }); return x.replace(/\s+/g, ' ').trim().replace(/[.،:!؟]+$/, ''); };
  /* سطر حل طويل → أسطر على «=» (كل سطر ينقرأ ويتكتب لحاله) · الرياضيات وسط كلام عربي تبقى من اليسار لليمين */
  /* سطر حل طويل → أسطر قصيرة: على الفاصلة، ثم «→»، ثم «=»، وإلا على الكلمات (برا الأقواس) · الرياضيات الصافية تتحمّل أطول (تصغر شوي بدل ما تنقسم) */
  const lim = x => AR.test(x) ? 24 : 32;
  function wrapWords(x) {
    const w = x.split(/\s+/), out = [], n = Math.ceil(x.length / lim(x)), goal = x.length / n; let cur = '', dep = 0;
    w.forEach(t => { if (cur && !dep && (cur + ' ' + t).length > Math.max(goal + 4, 10)) { out.push(cur); cur = t; } else cur = cur ? cur + ' ' + t : t; dep += (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length; });
    if (cur) out.push(cur); return out;
  }
  function chunks(x) {
    const L = lim(x); if (x.length <= L) return [x];
    const cl = x.split(/\s*[،,]\s+/).filter(Boolean);                 // جُمل (الفاصلة بعدها مسافة؛ 240,000 تبقى)
    if (cl.length > 1) return [].concat(...cl.map(chunks));
    const ar = x.split(/\s+(?=→)/).filter(Boolean);                     // «… → …»: السهم يبدأ السطر الجاي
    if (ar.length > 1) return [].concat(...ar.map(chunks));
    if (x.indexOf(' = ') > 0) {
      const p = x.split(' = '), out = []; let cur = p[0];
      for (let k = 1; k < p.length; k++) { const add = ' = ' + p[k]; if ((cur + add).length > L) { out.push(cur); cur = '= ' + p[k]; } else cur += add; }
      out.push(cur); return [].concat(...out.map(c => c.length > lim(c) + 6 ? wrapWords(c) : [c]));
    }
    return AR.test(x) ? wrapWords(x) : [x];
  }
  const MATH = /[A-Za-z0-9²³√π(][A-Za-z0-9²³√π.,+\-−×÷=<>≤≥/^%()\s]*[A-Za-z0-9²³π%)]|[A-Za-z0-9²³π]/g;
  const iso = s => AR.test(s) ? s.replace(MATH, m => /[\d=+\-−×÷<>]/.test(m) ? '⁦' + m + '⁩' : m) : s;
  function genQ(it) {
    let ex = String(it.exp || '').split('\n').map(x => x.replace(/📝/g, '').replace(/^\s*الشرح\s*:?\s*/, '').replace(/^\s*(?:[•\-–]|\d+\s*[).\-])\s*/, '').trim())
      .filter(x => x && /[\w؀-ۿ]/.test(x) && !(/:\s*$/.test(x) && !/\d/.test(x)) && !/^(?:ال)?(?:جواب|إجابة)/.test(x));   // بدون العناوين («المعطيات:») وسطر «الجواب …» (له سطره)
    if (ex.length > 6) ex = ex.slice(0, 4).concat(ex.slice(-2));                                          // الشرح الطويل: أوله وآخره (النتيجة)
    const L = [{ t: 'سؤال كمي سريع! ركّز في السؤال، وجاوب في التعليقات قبل ما أحل. يلا!', p: 1, a: [['ركّز', 'pt', 'q', { c: 'o' }]] }];
    const parts = ex.map(x => /^\(.*\)$/.test(x) ? null : chunks(x)), all = [].concat(...parts.filter(Boolean)).length;
    let r = 0;                                                                                               // أكثر من 5 أسطر: أول 4 + آخر سطر، والباقي ينقال بس
    ex.forEach((x, k) => {
      const t0 = k ? '' : 'نحلّها خطوة خطوة: ';
      if (!parts[k]) { L.push({ t: t0 + spoken(x.slice(1, -1)) + '.' }); return; }      // ملاحظة بين قوسين: تنقال بس
      const t = t0 + spoken(x), a = []; let pos = t0.length, end = pos;                  // السطر ينقرأ كامل مثل ما هو، وكل جزء يبدأ ينكتب لما توصل كلمته الأولى
      parts[k].forEach((c, j) => {
        const sc = spoken(c); if (j) { const q = t.indexOf(sc.split(' ')[0], Math.max(pos + 1, end - 3)); if (q > pos) pos = q; } end = pos + sc.length;
        const last = r === all - 1; if (all <= 5 || r < 4 || last) a.push([pos, 'w', 'sol', iso(c), { c: last ? 'g' : 'b' }]); r++;
      });
      L.push(a.length ? { t: t + '.', a } : { t: t + '.' });
    });
    if (!ex.length) L.push({ t: 'فكّر فيها معي خطوة خطوة، وشوف أي خيار يطلع لك.' });
    L.push({ t: `والجواب الخيار ${ORD[it.ans]}! جبتها؟ كفو عليك!`, a: [['الخيار', 'ans']] });
    L.push({ t: BYE }, { t: GRT });
    return L;
  }
  const gen = (kind, it) => kind === 'v' ? genV(it) : genQ(it);

  /* ---------- اليد: طبقة SVG فوق البطاقة (تحت حبر المشرف) + قلم يمشي مع الرسم ---------- */
  const PEN = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 28l2.2-7.4L21.6 5.2a2.6 2.6 0 0 1 3.7 0l1.5 1.5a2.6 2.6 0 0 1 0 3.7L11.4 25.8z" fill="#fff" stroke="#0E2458" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 28l2.2-7.4 5.2 5.2z" fill="var(--pc,#D62828)"/><path d="M18.8 8l5.2 5.2" stroke="#0E2458" stroke-width="1.6"/></svg>';
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; }
  function prng(key) { let s = hash(String(key)); return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  const fpt = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  function smooth(p) {
    if (p.length < 3) return 'M' + fpt(p[0]) + 'L' + fpt(p[p.length - 1]);
    let d = 'M' + fpt(p[0]);
    for (let k = 1; k < p.length - 1; k++) d += 'Q' + fpt(p[k]) + ' ' + fpt([(p[k][0] + p[k + 1][0]) / 2, (p[k][1] + p[k + 1][1]) / 2]);
    return d + 'L' + fpt(p[p.length - 1]);
  }
  function hand(tk, api) {
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'tk-hand'); svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    const pen = document.createElement('div'); pen.className = 'tk-hpen'; pen.innerHTML = PEN;
    tk.appendChild(svg); tk.appendChild(pen);
    /* own = كلمات طلّع القلم ترجمتها · rev = القلم كشف الإجابة · keep / keepRev = اللي طلبته إعادة الرسم (الباقي يتشال بعدها، بدون ما يختفي ويرجع) */
    const H = { acts: [], t0: performance.now(), raf: 0, live: false, total: 0, lines: null, key: '', i: -2, plan: null, own: new Set(), rev: false, keep: null, keepRev: false, inst: false, circ: new Set(), sp: 1, on: true, err: [] };
    let VB = null, lastWH = [0, 0], roT = 0;
    const el = (n, at) => { const e = document.createElementNS(NS, n); for (const k in at) e.setAttribute(k, at[k]); return e; };
    function box() {
      const c = tk.getBoundingClientRect(); if (!c.width) return null;
      if (!VB) { VB = [c.width, c.height]; svg.setAttribute('viewBox', `0 0 ${VB[0].toFixed(2)} ${VB[1].toFixed(2)}`); }
      return { c, k: VB[0] / c.width };
    }
    const U = () => VB ? VB[0] / 600 : 1, CQ = () => VB ? VB[0] / 100 : 6;          // U = بكسل بطاقة عرضها 600 · CQ = 1cqw
    const SW = () => Math.max(2.2, U() * 4);
    function rectOf(rs) {
      const B = box(); if (!B) return null; let R = null;
      for (const r of rs) { if (!r.width || !r.height) continue; const q = { x: (r.left - B.c.left) * B.k, y: (r.top - B.c.top) * B.k, x1: (r.right - B.c.left) * B.k, y1: (r.bottom - B.c.top) * B.k };
        R = R ? { x: Math.min(R.x, q.x), y: Math.min(R.y, q.y), x1: Math.max(R.x1, q.x1), y1: Math.max(R.y1, q.y1) } : q; }
      if (R) { R.w = R.x1 - R.x; R.h = R.y1 - R.y; }
      return R;
    }
    function textRange(e, a, b) {
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), rg = document.createRange(); let n, p = 0, st = false;
      while ((n = w.nextNode())) { const L = n.textContent.length; if (!st && a < p + L) { rg.setStart(n, a - p); st = true; } if (st && b <= p + L) { rg.setEnd(n, b - p); return rg; } p += L; }
      return null;
    }
    const allText = e => { const rg = document.createRange(); rg.selectNodeContents(e); return rg.getClientRects(); };
    /* الهدف → مستطيله بإحداثيات الطبقة · النص (السؤال، نص الخيار، كلمة، حروف) = حدود الحروف نفسها، مو صندوق السطر */
    function find(tg) {
      if (!tg) return null; const [m, rng] = String(tg).split('@'), p = m.split(':'); let e = null, txt = false;
      if (p[0] === 'q') { if (p[1] == null) { e = api.stem(); txt = !!e && e.tagName !== 'IMG'; } else { e = api.tw('q', +p[1]); txt = true; } }
      else if (p[0] === 'o') { const i = +p[1]; if (p[2] == null) { e = api.optText(i); txt = true; } else if (p[2] === 'r') e = api.opt(i); else { e = api.tw('o', i, +p[2]); txt = true; } }
      else if (p[0] === 'sol') e = api.sol();
      else if (p[0] === 'w') { const r = H.plan && H.plan.rows[+p[1]], t = r && r.el; if (!t) return null; const b = t.getBBox(); return { el: t, inl: false, r: { x: b.x, y: b.y + b.height * .18, x1: b.x + b.width, y1: b.y + b.height * .82, w: b.width, h: b.height * .64 } }; }
      if (!e) return null;
      let rs; if (rng) { const [a, b] = rng.split('-').map(Number), rg = textRange(e, a, b); if (!rg) return null; rs = rg.getClientRects(); } else rs = txt ? allText(e) : e.getClientRects();
      const r = rectOf(rs); if (!r) return null;
      if (txt) { const B = box(), h = Math.max(...[...rs].map(x => x.height)) * (B ? B.k : 1); r.y += h * .2; r.y1 -= h * .17; r.h = r.y1 - r.y; }     // سطر الخط أطول من الحروف: نقصّ فوق وتحت بنسبة سطر واحد
      return { el: e, inl: txt, r };
    }
    function mkStroke(pts, col, w, cls) {
      const p = el('path', { d: smooth(pts), stroke: col, 'stroke-width': w.toFixed(2), fill: 'none' }); if (cls) p.setAttribute('class', cls); svg.appendChild(p);
      const len = p.getTotalLength() || 1; p.style.strokeDasharray = len + ' ' + (len + 6); p.style.strokeDashoffset = len;
      return { len, el: p, set(q) { p.style.strokeDashoffset = len * (1 - q); }, pt(q) { const z = p.getPointAtLength(len * q); return [z.x, z.y]; } };
    }
    function strokeSet(ss) { const L = ss.reduce((a, s) => a + s.len, 0) || 1;
      return q => { let rest = q * L, pt = null; for (const s of ss) { const u = Math.min(1, Math.max(0, rest / s.len)); s.set(u); if (u > 0 && (u < 1 || !pt)) pt = s.pt(u); rest -= s.len; } return pt; }; }
    /* أشكال يدوية فيها رجفة خفيفة (نفس البذرة = نفس الشكل في الشاشتين) */
    const SHP = {
      und(r, R) { const u = U(), y = r.y1 + Math.max(3 * u, r.h * .14), j = () => (R() - .5) * 1.8 * u; return [[[r.x - 2 * u, y + j()], [r.x + r.w * .35, y + u + j()], [r.x + r.w * .7, y + j()], [r.x1 + 3 * u, y - .5 * u + j()]]]; },
      x(r, R) { const u = U(), y = (r.y + r.y1) / 2, j = (R() - .5) * 3 * u; return [[[r.x - 5 * u, y + 2.5 * u + j], [r.x1 + 5 * u, y - 2.5 * u - j]]]; },
      hl(r) { const u = U(), y = (r.y + r.y1) / 2; return [[[r.x - 2 * u, y], [r.x1 + 2 * u, y]]]; },
      circ(r, R) {
        if (r.w > VB[0] * .45) return SHP.box(r, R);          // شي عريض (صف خيار، صورة السؤال): مستطيل بدل الدائرة عشان ما يطلع برا ولا يركب على اللي جنبه
        const u = U(), cx = (r.x + r.x1) / 2, cy = (r.y + r.y1) / 2, rx = r.w / 2 + Math.max(7 * u, r.h * .22), ry = r.h / 2 + Math.max(6 * u, r.h * .22), a0 = -2.3 + R() * .5, n = 30, p = [];
        for (let k = 0; k <= n + 4; k++) { const a = a0 + k / n * 6.2832, m = 1 + (R() - .5) * .05 + (k > n ? (k - n) * .026 : 0); p.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]); }
        return [p];
      },
      box(r, R) { const u = U(), j = () => (R() - .5) * 2.4 * u, x0 = r.x - 5 * u, x1 = r.x1 + 5 * u, y0 = r.y - 4 * u, y1 = r.y1 + 4 * u;
        return [[[x0 + j(), y0 + j()], [x1 + j(), y0 + j()]], [[x1 + j(), y0 - u], [x1 + j(), y1 + j()]], [[x1 + u, y1 + j()], [x0 + j(), y1 + j()]], [[x0 + j(), y1 + u], [x0 + j(), y0 - 1.5 * u]]]; },
      tick(r) { const u = U(), s = Math.max(15 * u, r.h * .8), x = r.x1 + 7 * u, y = (r.y + r.y1) / 2; return [[[x, y + u], [x + s * .17, y + s * .2], [x + s * .34, y + s * .38], [x + s * .62, y - s * .12], [x + s * .98, y - s * .56]]]; },
      cross(r) { const u = U(), s = Math.max(13 * u, r.h * .7), x = r.x1 + 7 * u, y = (r.y + r.y1) / 2; return [[[x, y - s * .45], [x + s * .8, y + s * .45]], [[x + s * .8, y - s * .45], [x, y + s * .45]]]; },
      arr(r, R, q) {
        const u = U(), c1 = [(r.x + r.x1) / 2, (r.y + r.y1) / 2], c2 = [(q.x + q.x1) / 2, (q.y + q.y1) / 2], dx = c2[0] - c1[0], dy = c2[1] - c1[1], D = Math.hypot(dx, dy) || 1, ux = dx / D, uy = dy / D;
        const ext = (b, m) => Math.min(Math.abs(ux) > .01 ? (b.w / 2 + m) / Math.abs(ux) : 1e9, Math.abs(uy) > .01 ? (b.h / 2 + m) / Math.abs(uy) : 1e9);
        const a = [c1[0] + ux * ext(r, 6 * u), c1[1] + uy * ext(r, 6 * u)], b = [c2[0] - ux * ext(q, 9 * u), c2[1] - uy * ext(q, 9 * u)], bow = Math.min(36 * u, D * .18) * (ux >= 0 ? -1 : 1);
        const mm = [(a[0] + b[0]) / 2 - uy * bow, (a[1] + b[1]) / 2 + ux * bow], p = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10, v = 1 - t; p.push([v * v * a[0] + 2 * v * t * mm[0] + t * t * b[0], v * v * a[1] + 2 * v * t * mm[1] + t * t * b[1]]); }
        const tx = b[0] - mm[0], ty = b[1] - mm[1], tl = Math.hypot(tx, ty) || 1, ax = tx / tl, ay = ty / tl, wing = s => [b[0] - 11 * u * (ax * Math.cos(s) - ay * Math.sin(s)), b[1] - 11 * u * (ay * Math.cos(s) + ax * Math.sin(s))];
        return [p, [wing(.5), b], [wing(-.5), b]];
      }
    };
    /* لوحة الحل: كل نص ينكتب في «الحل» ياخذ سطر من أسطرها، والحجم يتحدد مرة وحدة قبل أول سطر عشان كل الأسطر تنساع */
    function plan() {
      if (H.plan) return H.plan;
      const rows = []; (H.lines || []).forEach(ln => acts(ln).forEach(a => { if (a.k === 'w' && /^sol(:\d+)?$/.test(a.tg)) { const k = /:(\d+)$/.exec(a.tg); a.row = k ? +k[1] : rows.length; rows[a.row] = { t: String(a.arg || '') }; } }));
      H.plan = { rows: [], lined: true }; tk.classList.remove('hand-nl');
      const S = find('sol'); if (!S || !rows.length) return H.plan;
      const cq = CQ(), probe = el('text', { x: -9999, y: -9999, class: 'hw' }); svg.appendChild(probe);
      const width = (t, fs) => { probe.setAttribute('font-size', fs); probe.textContent = t; return t ? probe.getComputedTextLength() : 0; };
      const W = S.r.w - 7 * cq, n = rows.length, bot = S.r.y1 - 2 * cq, line0 = S.r.y + 15.9 * cq;    // أول سطر مرسوم في «الحل»: الحد .5 + 15.4
      let fs = 5.6 * cq, pitch = 8.7 * cq, base0 = line0 - 1.1 * cq;                                   // الكتابة فوق الخط بشوي
      if (base0 + (n - 1) * pitch + fs * .35 > bot) {                                                   // ما تنساع على الأسطر المرسومة → الأسطر تختفي والكتابة تتوزّع
        H.plan.lined = false; const top = S.r.y + 7 * cq;
        fs = Math.max(2.4 * cq, Math.min(5.6 * cq, (bot - top) / (.95 + (n - 1) * 1.15 + .3))); pitch = fs * 1.15; base0 = top + fs * .95;
      }
      if (!H.plan.lined) tk.classList.add('hand-nl');
      const cx = (S.r.x + S.r.x1) / 2;
      rows.forEach((r, k) => { if (!r) return; let f = fs; const w = width(r.t, f); if (w > W) f = Math.max(2.4 * cq, f * W / w);
        H.plan.rows[k] = { t: r.t, fs: f, x: cx, y: base0 + k * pitch, el: null }; });
      probe.remove(); return H.plan;
    }
    /* كتابة نص: قصّة تنفتح على طول السطر والقلم على طرفها */
    function sweep(t, bb, rtl, yb) {
      const id = 'hw' + Math.random().toString(36).slice(2, 9), cp = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }), rc = el('rect', { x: (bb[0] - 3).toFixed(1), y: (bb[1] - 6).toFixed(1), width: 0, height: (bb[3] - bb[1] + 12).toFixed(1) }), w = bb[2] - bb[0] + 6;
      cp.appendChild(rc); defs.appendChild(cp); t.setAttribute('clip-path', `url(#${id})`);
      return { set(q) { const ww = w * q, x = rtl ? bb[2] + 3 - ww : bb[0] - 3 + ww; rc.setAttribute('width', ww.toFixed(2)); if (rtl) rc.setAttribute('x', x.toFixed(2)); return [x, yb - Math.abs(Math.sin(ww / 5)) * 2 * U()]; },
        done() { t.removeAttribute('clip-path'); cp.remove(); } };
    }
    function writeAct(a) {
      const col = INK[a.o.c || 'b'], txt = String(a.arg || ''), rtl = AR.test(firstStrong(txt)); let sw = null;
      return { c: a.c, d: Math.max(380, Math.min(1700, txt.length * 75)), col,
        start() {
          let x, y, fs;
          if (/^sol/.test(a.tg)) { const r = H.plan && H.plan.rows[a.row]; if (!r) { H.err.push('w ' + a.tg); return; } x = r.x; y = r.y; fs = r.fs; }
          else { const m = /^(above|below):(.+)$/.exec(a.tg), T = m && find(m[2]); if (!T) { H.err.push('w ' + a.tg); return; } const r = T.r, cq = CQ();
            fs = Math.max(3.6 * cq, Math.min(5.4 * cq, r.h * .62)); x = (r.x + r.x1) / 2; y = m[1] === 'above' ? r.y - fs * .42 : r.y1 + fs * 1.05; }
          const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'font-size': fs.toFixed(1), fill: col, 'text-anchor': 'middle', class: 'hw' }); if (rtl) t.setAttribute('direction', 'rtl');
          t.textContent = txt; svg.appendChild(t); if (/^sol/.test(a.tg) && H.plan.rows[a.row]) H.plan.rows[a.row].el = t;
          const b = t.getBBox(); sw = sweep(t, [b.x, b.y, b.x + b.width, b.y + b.height], rtl, y);
        }, at(q) { return sw ? sw.set(q) : null; }, end() { if (sw) sw.done(); } };
    }
    function markAct(a, R) {
      const kind = a.k, col = INK[a.o.c || (kind === 'hl' ? 'y' : kind === 'tick' ? 'g' : kind === 'pt' ? 'o' : 'r')]; let run = null, ss = [];
      return { c: a.c, d: MS[kind], col: kind === 'hl' ? '#C9A400' : col, tmp: kind === 'pt',
        start() { const T = find(a.tg), T2 = kind === 'arr' ? find(a.arg) : null; if (!T || (kind === 'arr' && !T2)) { H.err.push(kind + ' ' + a.tg); return; }
          const r = T.r; ss = SHP[kind === 'pt' ? 'circ' : kind](r, R, T2 && T2.r).map(p => mkStroke(p, col, kind === 'hl' ? r.h * 1.05 : SW(), kind === 'hl' ? 'hlm' : ''));
          run = strokeSet(ss); if (kind === 'circ' && /^o:\d+:r$/.test(a.tg)) H.circ.add(+a.tg.split(':')[1]); },
        at(q) { return run ? run(q * q * (3 - 2 * q)) : null; },
        dim(o) { ss.forEach(s => { s.el.style.opacity = o; }); }, kill() { ss.forEach(s => s.el.remove()); ss = []; } };
    }
    /* الترجمة: نفس فقاعة الضغط على الكلمة (اللي طلّعها القلم يشيلها القلم) */
    function trAct(a) {
      let w = null, p = null, shown = false;
      return { c: a.c, d: MS.tr, col: INK.o,
        start() { const T = find(a.tg); if (!T) { H.err.push('tr ' + a.tg); return; } w = T.el; p = [(T.r.x + T.r.x1) / 2, T.r.y1 + 2 * U()]; },
        at(q) { if (!w) return null; if (q >= .55 && !shown) { shown = true; const s = api.tr(w, H.inst); if (s === 'new') H.own.add(w); if (H.keep && H.own.has(w)) H.keep.add(w); } return p; } };
    }
    function ansAct(a, R) {
      const i = api.ans(); let run = null;
      return { c: a.c, d: MS.ans, col: INK.g,
        start() { if (api.reveal(true)) H.rev = true; if (H.keep) H.keepRev = true; const T = find(`o:${i}:r`); if (!T || H.circ.has(i)) return; H.circ.add(i);
          run = strokeSet(SHP.circ(T.r, R).map(p => mkStroke(p, INK.g, SW() * 1.1))); },
        at(q) { return run ? run(q) : null; } };
    }
    function build(j) {
      const ln = H.lines && H.lines[j]; if (!ln) return [];
      const R = prng(H.key + ':' + j);
      return acts(ln).map(a => a.k === 'w' ? writeAct(a) : a.k === 'tr' ? trAct(a) : a.k === 'ans' ? ansAct(a, R) : SHP[a.k] || a.k === 'pt' ? markAct(a, R) : null).filter(Boolean);
    }
    function showPen(pt, col) {
      if (!pt || !VB) { pen.classList.remove('on'); return; }
      const k = tk.getBoundingClientRect().width / VB[0];
      pen.style.transform = `translate(${(pt[0] * k).toFixed(1)}px,${(pt[1] * k).toFixed(1)}px)`; if (col) pen.style.setProperty('--pc', col); pen.classList.add('on');
    }
    function tick() {
      H.raf = 0; const e = performance.now() - H.t0; let p = null, col = null, busy = false;
      for (const a of H.acts) {
        if (a.done) { if (a.tmp && !a.gone) { const u = (e - a.s - a.d - 750) / 320; if (u >= 1) { a.kill(); a.gone = 1; } else { if (u > 0) a.dim(1 - u); busy = true; } } continue; }
        const q = (e - a.s) / a.d;
        if (q <= 0) { busy = true; continue; }
        if (!a.on) { a.on = 1; a.start(); }
        if (q >= 1) { a.at(1); if (a.end) a.end(); a.done = 1; if (a.tmp) busy = true; } else { const pt = a.at(q); if (pt) { p = pt; col = a.col; } busy = true; }
      }
      showPen(p, col);
      if (busy) H.raf = requestAnimationFrame(tick); else { H.live = false; H.acts = []; }
    }
    function finish() {
      cancelAnimationFrame(H.raf); H.raf = 0;
      for (const a of H.acts) { if (a.tmp) { if (a.on && !a.gone) a.kill(); } else if (!a.done) { if (!a.on) { a.on = 1; a.start(); } a.at(1); if (a.end) a.end(); a.done = 1; } }
      H.acts = []; H.live = false; showPen(null);
    }
    function wipeMarks() {
      [...svg.childNodes].forEach(n => { if (n !== defs) n.remove(); }); defs.textContent = '';
      H.circ.clear(); if (H.plan) H.plan.rows.forEach(r => { if (r) r.el = null; });
    }
    /* بعد إعادة الرسم: الفقاعات والإجابة اللي ما طلبتها الأسطر المرسومة تتشال (اللي طُلبت ما تختفي وترجع) */
    function settle() {
      if (!H.keep) return;
      H.own.forEach(w => { if (!H.keep.has(w)) { api.trOff(w); H.own.delete(w); } });
      if (H.rev && !H.keepRev) { api.reveal(false); H.rev = false; }
      H.keep = null; H.keepRev = false;
    }
    const inst = a => { if (a.tmp) return; a.start(); a.at(1); if (a.end) a.end(); a.done = 1; };
    function redrawTo(i) { H.keep = new Set(); H.keepRev = false; wipeMarks(); if (i >= 0 && H.on && box()) { plan(); H.inst = true; for (let j = 0; j <= i; j++) build(j).forEach(inst); H.inst = false; } settle(); }
    /* السطر i: mode = step (ضغطة للأمام: يرسم مع الكلام) · غيرها = كل شي يطلع على طول · el = وقت فات من السطر (شاشة التسجيل تلحق متأخرة)
       سطر واحد للأمام = اللي على البطاقة يبقى مثل ما هو والسطر الجديد ينرسم فوقه · غيره (رجوع، قفز، إعادة السطر) = البطاقة تنرسم من جديد لين السطر اللي قبله */
    function enter(lines, key, i, mode, el, sp) {
      finish();
      const same = lines === H.lines && key === H.key, fwd = same && i === H.i + 1 && H.i >= -1 && H.on;
      if (!same) { H.lines = lines; H.key = key; H.plan = null; VB = null; tk.classList.remove('hand-nl'); }
      if (i == null || i < -1) i = -1;
      H.sp = sp || 1; H.t0 = performance.now() - (el || 0); H.total = 0; H.err = []; H.i = i;
      if (!lines || i < 0 || !H.on || !box()) { redrawTo(-1); return; }
      plan();
      if (mode !== 'step') { redrawTo(i); return; }
      if (!fwd) redrawTo(i - 1);
      const list = build(i), sc = sched(lines[i]), s = H.sp, cueT = c => (LEAD + timeAt(sc, c)) / s; let t = 0;
      for (const a of list) { a.d /= s; const q = a.c >= 0 ? cueT(a.c) : LEAD / s; a.s = Math.max(t, q); t = a.s + a.d + GAP / s; }
      H.total = Math.max(0, t - GAP / s); H.acts = list; H.live = list.length > 0;
      tick();
    }
    /* البطاقة تغيّر شكلها (مو بس حجمها): ينرسم كل شي من جديد بالمقاسات الجديدة */
    const ro = new ResizeObserver(() => {
      if (!tk.isConnected) return; const c = tk.getBoundingClientRect(); if (!c.width) return;
      if (Math.abs(c.width - lastWH[0]) < 1 && Math.abs(c.height - lastWH[1]) < 1) return; lastWH = [c.width, c.height];
      if (!VB || Math.abs(c.height / c.width - VB[1] / VB[0]) < .004) return;
      clearTimeout(roT); roT = setTimeout(() => { if (!tk.isConnected || H.i < 0) { VB = null; return; } finish(); H.plan = null; VB = null; tk.classList.remove('hand-nl'); redrawTo(H.i); }, 120);
    });
    ro.observe(tk);
    return {
      enter, finish,
      clear() { finish(); H.i = -1; redrawTo(-1); },
      setOn(v) { H.on = !!v; },
      on: () => H.on, i: () => H.i, t0: () => H.t0, live: () => H.live, total: () => H.total, err: () => H.err.slice(), rev: () => H.rev,
      owns: w => H.own.has(w),
      destroy() { finish(); clearTimeout(roT); ro.disconnect(); svg.remove(); pen.remove(); },
      at(ms) { H.t0 = performance.now() - ms; if (!H.raf) tick(); }          // للاختبار: نقفز لوقت معيّن من السطر
    };
  }

  window.QGHand = { gen, sched, dur, litAt, acts, sayHtml, hand, spoken, relOf, ORD, LEAD };
})();
