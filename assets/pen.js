/* QGPen — a drawing layer (pen / highlighter / eraser, + text) over any element. Pointer events (mouse, touch, stylus).
   const pen = QGPen.attach(hostEl, { storageKey, text: true }); pen.setTool('pen'|'hl'|'eraser'|'text'); pen.toggle(on); pen.undo(); pen.clear(); pen.save()/load()
   Drawing coordinates are stored relative to the host size (0..1) so they survive resizing.
   Text (opts.text): press anywhere to type · drag a text to move it · press it to edit · empty it or rub it with the eraser to delete it.
   Texts live in the same list as the strokes ({t:'txt', x, y, s, c, z, d}), so undo / clear / save cover both. */
(function () {
  'use strict';
  const COLORS = { pen: ['#D62828', '#1F5FBF', '#111111', '#1B9E63'], hl: ['rgba(255,235,59,.45)', 'rgba(76,175,80,.35)', 'rgba(255,152,0,.4)'] };
  const STRONG = /[A-Za-zÀ-ɏ֐-ࣿיִ-﷿ﹰ-ﻼ]/, RTLC = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;
  const dirOf = s => { const m = STRONG.exec(s || ''); return m && RTLC.test(m[0]) ? 'rtl' : 'ltr'; };   // أول حرف يحدد الاتجاه: عربي ← يمين
  const clamp = v => Math.max(0, Math.min(1, v));
  function attach(host, opts) {
    opts = opts || {};
    const st = { on: false, tool: 'pen', color: COLORS.pen[0], solid: COLORS.pen[0], width: 2.4, strokes: [], hist: [], cur: null, dels: null, key: opts.storageKey || null, save: opts.autosave !== false };
    host.style.position = host.style.position || 'relative';
    const cv = document.createElement('canvas'); cv.className = 'qgpen-canvas'; host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const L = (ar, en) => window.QGL && QGL.en ? en : ar;   // 🌐 عربي / English
    const bar = document.createElement('div'); bar.className = 'qgpen-bar'; bar.innerHTML = `
      <button data-t="pen" class="on" title="${L('قلم', 'Pen')}">✎</button>
      <button data-t="hl" title="${L('تظليل', 'Highlighter')}">▬</button>
      <button data-t="eraser" title="${L('ممحاة', 'Eraser')}">◌</button>
      <span class="sep"></span>
      ${COLORS.pen.map((c, i) => `<button data-c="${c}" class="sw ${i === 0 ? 'on' : ''}" style="background:${c}" title="${L('لون', 'Color')}"></button>`).join('')}
      <span class="sep"></span>
      <button data-w="thin" title="${L('رفيع', 'Thin')}">─</button><button data-w="thick" title="${L('عريض', 'Thick')}">━</button>
      <span class="sep"></span>
      <button data-a="undo" title="${L('تراجع', 'Undo')}">↶</button><button data-a="clear" title="${L('مسح الكل', 'Clear all')}">🗑</button>
      <button data-a="off" title="${L('إغلاق القلم', 'Close the pen')}">✕</button>`;
    if (opts.bar !== false) host.insertBefore(bar, host.firstChild);
    function size() { const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint(); }
    const ro = new ResizeObserver(size); ro.observe(host);
    function drawStroke(s) {
      const W = cv.clientWidth, H = cv.clientHeight; if (s.t === 'txt' || !s.p || !s.p.length) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.t === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = s.w * 6; }
      else { ctx.globalCompositeOperation = s.t === 'hl' ? 'multiply' : 'source-over'; ctx.strokeStyle = s.c; ctx.lineWidth = s.t === 'hl' ? s.w * 7 : s.w; }
      ctx.beginPath(); ctx.moveTo(s.p[0][0] * W, s.p[0][1] * H);
      for (let i = 1; i < s.p.length; i++) { const a = s.p[i - 1], b = s.p[i]; ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H); }
      const l = s.p[s.p.length - 1]; ctx.lineTo(l[0] * W, l[1] * H); ctx.stroke(); ctx.restore();
    }
    function redraw() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); st.strokes.forEach(drawStroke); if (st.cur) drawStroke(st.cur); }
    function paint() { redraw(); syncText(); }
    function pos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    cv.addEventListener('pointerdown', e => { if (!st.on || st.tool === 'text') return; if (e.pointerType === 'mouse' && e.button !== 0) return; cv.setPointerCapture(e.pointerId); st.cur = { t: st.tool, c: st.color, w: st.width, p: [pos(e)] }; st.dels = null; if (st.tool === 'eraser') eraseText(e); e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!st.cur) return; st.cur.p.push(pos(e)); if (st.cur.t === 'eraser') eraseText(e); redraw(); e.preventDefault(); });
    const up = e => { if (!st.cur) return; st.strokes.push(st.cur); st.hist.push({ a: 'add', it: st.cur, dels: st.dels }); st.cur = null; st.dels = null; redraw(); persist(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    // ✍️ النص: كل نص عنصر فوق البطاقة وتحت الحبر (يقدر يكتب بالقلم فوقه)
    const TL = opts.text ? document.createElement('div') : null, els = new Map(); let ed = null, tdrag = null;
    if (TL) { TL.className = 'qgpen-tl'; host.appendChild(TL); }
    const txtColor = () => /rgba/.test(st.color) ? st.solid : st.color;
    const txtSize = () => st.width >= 4 ? 0.085 : 0.06;   // رفيع = نص عادي · عريض = نص كبير (نسبة من عرض البطاقة)
    function place(it, el) {
      const W = cv.clientWidth || host.clientWidth, H = cv.clientHeight || host.clientHeight, fs = Math.max(11, it.z * W), rtl = it.d === 'rtl';
      el.dir = it.d; el.style.fontSize = fs + 'px'; el.style.color = it.c; el.style.caretColor = it.c;
      el.style.left = it.x * W + 'px'; el.style.top = (it.y * H - fs * 0.7) + 'px';
      el.style.transform = rtl ? 'translateX(-100%)' : '';   // النقطة اللي ضغطها = بداية النص (يمين للعربي، يسار للإنجليزي)
      el.style.maxWidth = Math.max(fs * 2.5, (rtl ? it.x : 1 - it.x) * W - 6) + 'px';
    }
    function mkEl(it) { const el = document.createElement('div'); el.className = 'qgpen-t'; el.textContent = it.s; el.__it = it; els.set(it, el); TL.appendChild(el); return el; }
    function syncText() {
      if (!TL) return;
      const live = new Set(st.strokes.filter(s => s.t === 'txt')); if (ed) live.add(ed.it);
      els.forEach((el, it) => { if (!live.has(it)) { el.remove(); els.delete(it); } });
      live.forEach(it => { const el = els.get(it) || mkEl(it); if (!ed || ed.it !== it) el.textContent = it.s; place(it, el); });
    }
    function startEdit(it, isNew) {
      if (ed) commit();
      const el = els.get(it) || mkEl(it); place(it, el);
      ed = { it, el, isNew, prev: isNew ? null : { s: it.s, c: it.c, z: it.z, d: it.d } };
      el.classList.add('ed');
      try { el.contentEditable = 'plaintext-only'; } catch (e) { }
      if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.oninput = () => { it.s = el.innerText; it.d = dirOf(it.s); place(it, el); };
      el.onkeydown = e => { e.stopPropagation(); if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); commit(); } };
      el.onblur = () => { if (ed && ed.el === el) commit(); };
      el.focus({ preventScroll: true });
      const sel = window.getSelection(); if (sel) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
      if (opts.onText) opts.onText(true);
    }
    function commit() {
      if (!ed) return; const { it, el, isNew, prev } = ed; ed = null;
      el.onblur = el.oninput = el.onkeydown = null; el.removeAttribute('contenteditable'); el.classList.remove('ed');
      const s = (el.innerText || '').replace(/^\s+|\s+$/g, ''); it.s = s; it.d = dirOf(s);
      if (!s) {   // نص فاضي = ينحذف
        el.remove(); els.delete(it);
        if (!isNew) { Object.assign(it, prev); const i = st.strokes.indexOf(it); if (i >= 0) { st.strokes.splice(i, 1); st.hist.push({ a: 'del', it, i }); } }
      } else {
        if (isNew) { st.strokes.push(it); st.hist.push({ a: 'add', it }); }
        else if (prev.s !== s || prev.c !== it.c || prev.z !== it.z) st.hist.push({ a: 'mod', it, prev });
        el.textContent = s; place(it, el);
      }
      persist();
      const sel = window.getSelection(); if (sel && sel.anchorNode && host.contains(sel.anchorNode)) sel.removeAllRanges();
      if (document.activeElement === el) el.blur();
      if (opts.onText) opts.onText(false);
    }
    function eraseText(e) {   // الممحاة تشيل أي نص تمر عليه (والتراجع يرجعه)
      if (!TL || !els.size) return; const pad = st.width * 3;
      els.forEach((el, it) => {
        if (ed && ed.it === it) return; const r = el.getBoundingClientRect();
        if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) return;
        const i = st.strokes.indexOf(it); if (i >= 0) { st.strokes.splice(i, 1); (st.dels || (st.dels = [])).push({ it, i }); }
        el.remove(); els.delete(it);
      });
    }
    if (TL) {
      TL.addEventListener('pointerdown', e => {
        if (!st.on || st.tool !== 'text') return; if (e.pointerType === 'mouse' && e.button !== 0) return;
        const el = e.target.closest ? e.target.closest('.qgpen-t') : null;
        if (ed && el === ed.el) return;                          // يكتب داخل النص: المؤشر يتحرك عادي
        e.preventDefault();
        if (ed) { commit(); tdrag = null; return; }              // ضغطة برّا النص اللي ينكتب = حفظه بس
        const it = el ? el.__it : null;
        tdrag = { it, el, x0: e.clientX, y0: e.clientY, p: pos(e), px: it ? it.x : 0, py: it ? it.y : 0, moved: false };
        try { TL.setPointerCapture(e.pointerId); } catch (_) { }
      });
      TL.addEventListener('pointermove', e => {
        if (!tdrag || !tdrag.it) return; const dx = e.clientX - tdrag.x0, dy = e.clientY - tdrag.y0;
        if (!tdrag.moved && Math.hypot(dx, dy) < 5) return; tdrag.moved = true; e.preventDefault();
        tdrag.it.x = clamp(tdrag.px + dx / cv.clientWidth); tdrag.it.y = clamp(tdrag.py + dy / cv.clientHeight); place(tdrag.it, tdrag.el);
      });
      const tup = e => {
        const d = tdrag; tdrag = null; if (!d) return;
        if (d.it) { if (d.moved) { st.hist.push({ a: 'mod', it: d.it, prev: { x: d.px, y: d.py } }); persist(); } else if (e.type === 'pointerup') startEdit(d.it, false); }
        else if (e.type === 'pointerup' && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) startEdit({ t: 'txt', x: d.p[0], y: d.p[1], s: '', c: txtColor(), z: txtSize(), d: 'ltr' }, true);
      };
      TL.addEventListener('pointerup', tup); TL.addEventListener('pointercancel', tup);
    }

    function undo() {
      if (ed) commit();
      const h = st.hist.pop();
      if (!h) st.strokes.pop();   // كتابة محفوظة من قبل (بدون سجل): نشيل آخر شي مثل أول
      else if (h.a === 'add') { const i = st.strokes.lastIndexOf(h.it); if (i >= 0) st.strokes.splice(i, 1); if (h.dels) for (let k = h.dels.length - 1; k >= 0; k--) st.strokes.splice(Math.min(h.dels[k].i, st.strokes.length), 0, h.dels[k].it); }
      else if (h.a === 'del') st.strokes.splice(Math.min(h.i, st.strokes.length), 0, h.it);
      else if (h.a === 'mod') Object.assign(h.it, h.prev);
      else if (h.a === 'clr') st.strokes = h.items.concat(st.strokes);
      paint(); persist();
    }
    function clearAll() { if (ed) commit(); if (st.strokes.length) st.hist.push({ a: 'clr', items: st.strokes }); st.strokes = []; paint(); persist(); }
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { st.tool = b.dataset.t; bar.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); if (st.tool === 'hl' && !/rgba/.test(st.color)) st.color = COLORS.hl[0]; if (st.tool === 'pen' && /rgba/.test(st.color)) st.color = COLORS.pen[0]; }
      else if (b.dataset.c) { st.color = st.tool === 'hl' ? COLORS.hl[[...bar.querySelectorAll('.sw')].indexOf(b) % COLORS.hl.length] : b.dataset.c; bar.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (st.tool === 'eraser') { st.tool = 'pen'; bar.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } }
      else if (b.dataset.w) { st.width = b.dataset.w === 'thick' ? 5 : 2.4; }
      else if (b.dataset.a === 'undo') undo();
      else if (b.dataset.a === 'clear') { if (!st.strokes.length) clearAll(); else if (window.QGDlg) QGDlg.confirm(window.QGL && QGL.en ? 'Clear all your writing on this page?' : 'مسح كل الكتابة على هذه الصفحة؟', { ok: window.QGL && QGL.en ? 'Clear' : 'مسح', danger: true }).then(ok => { if (ok) clearAll(); }); else clearAll(); }
      else if (b.dataset.a === 'off') api.toggle(false);
    });
    function persist() { if (!st.save || !st.key) return; try { if (st.strokes.length) localStorage.setItem(st.key, JSON.stringify(st.strokes)); else localStorage.removeItem(st.key); } catch (e) {} }
    const api = {
      toggle(on) { st.on = on == null ? !st.on : !!on; if (!st.on) commit(); host.classList.toggle('qgpen-on', st.on); if (opts.onToggle) opts.onToggle(st.on); return st.on; },
      isOn() { return st.on; },
      tool() { return st.tool; },
      setTool(t) { if (t !== 'text') commit(); st.tool = t; host.classList.toggle('qgpen-tt', t === 'text'); if (t === 'hl' && !/rgba/.test(st.color)) st.color = COLORS.hl[0]; if ((t === 'pen' || t === 'text') && /rgba/.test(st.color)) st.color = st.solid; },
      setColor(c) { st.color = c; if (!/rgba/.test(c)) st.solid = c; if (st.tool === 'eraser') st.tool = /rgba/.test(c) ? 'hl' : 'pen'; if (ed && !/rgba/.test(c)) { ed.it.c = c; place(ed.it, ed.el); } },
      setWidth(w) { st.width = w; if (ed) { ed.it.z = txtSize(); place(ed.it, ed.el); } },
      undo,
      editing() { return !!ed; },
      commit,
      setKey(key, strokes) { commit(); persist(); st.key = key; st.strokes = strokes || (key ? (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } })() : []); st.hist = []; paint(); },
      getStrokes() { return st.strokes.slice(); },
      clear: clearAll,
      resize: size,
      destroy() { ro.disconnect(); cv.remove(); bar.remove(); if (TL) TL.remove(); }
    };
    size(); return api;
  }
  window.QGPen = { attach };
})();
