/* QGPen — a drawing layer (pen / highlighter / eraser) over any element. Pointer events (mouse, touch, stylus).
   const pen = QGPen.attach(hostEl, { storageKey }); pen.setTool('pen'|'hl'|'eraser'); pen.toggle(on); pen.undo(); pen.clear(); pen.save()/load()
   Drawing coordinates are stored relative to the host size (0..1) so they survive resizing. */
(function () {
  'use strict';
  const COLORS = { pen: ['#D62828', '#1F5FBF', '#111111', '#1B9E63'], hl: ['rgba(255,235,59,.45)', 'rgba(76,175,80,.35)', 'rgba(255,152,0,.4)'] };
  function attach(host, opts) {
    opts = opts || {};
    const st = { on: false, tool: 'pen', color: COLORS.pen[0], width: 2.4, strokes: [], cur: null, key: opts.storageKey || null, save: opts.autosave !== false };
    host.style.position = host.style.position || 'relative';
    const cv = document.createElement('canvas'); cv.className = 'qgpen-canvas'; host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const bar = document.createElement('div'); bar.className = 'qgpen-bar'; bar.innerHTML = `
      <button data-t="pen" class="on" title="قلم / Pen">✎</button>
      <button data-t="hl" title="تظليل / Highlighter">▬</button>
      <button data-t="eraser" title="ممحاة / Eraser">◌</button>
      <span class="sep"></span>
      ${COLORS.pen.map((c, i) => `<button data-c="${c}" class="sw ${i === 0 ? 'on' : ''}" style="background:${c}" title="لون"></button>`).join('')}
      <span class="sep"></span>
      <button data-w="thin" title="رفيع">─</button><button data-w="thick" title="عريض">━</button>
      <span class="sep"></span>
      <button data-a="undo" title="تراجع / Undo">↶</button><button data-a="clear" title="مسح الكل / Clear">🗑</button>
      <button data-a="off" title="إغلاق القلم">✕</button>`;
    host.insertBefore(bar, host.firstChild);
    function size() { const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); redraw(); }
    const ro = new ResizeObserver(size); ro.observe(host);
    function drawStroke(s) {
      const W = cv.clientWidth, H = cv.clientHeight; if (!s.p.length) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.t === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = s.w * 6; }
      else { ctx.globalCompositeOperation = s.t === 'hl' ? 'multiply' : 'source-over'; ctx.strokeStyle = s.c; ctx.lineWidth = s.t === 'hl' ? s.w * 7 : s.w; }
      ctx.beginPath(); ctx.moveTo(s.p[0][0] * W, s.p[0][1] * H);
      for (let i = 1; i < s.p.length; i++) { const a = s.p[i - 1], b = s.p[i]; ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H); }
      const l = s.p[s.p.length - 1]; ctx.lineTo(l[0] * W, l[1] * H); ctx.stroke(); ctx.restore();
    }
    function redraw() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); st.strokes.forEach(drawStroke); if (st.cur) drawStroke(st.cur); }
    function pos(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    cv.addEventListener('pointerdown', e => { if (!st.on) return; if (e.pointerType === 'mouse' && e.button !== 0) return; cv.setPointerCapture(e.pointerId); st.cur = { t: st.tool, c: st.color, w: st.width, p: [pos(e)] }; e.preventDefault(); });
    cv.addEventListener('pointermove', e => { if (!st.cur) return; st.cur.p.push(pos(e)); redraw(); e.preventDefault(); });
    const up = e => { if (!st.cur) return; st.strokes.push(st.cur); st.cur = null; redraw(); persist(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { st.tool = b.dataset.t; bar.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); if (st.tool === 'hl' && !/rgba/.test(st.color)) st.color = COLORS.hl[0]; if (st.tool === 'pen' && /rgba/.test(st.color)) st.color = COLORS.pen[0]; }
      else if (b.dataset.c) { st.color = st.tool === 'hl' ? COLORS.hl[[...bar.querySelectorAll('.sw')].indexOf(b) % COLORS.hl.length] : b.dataset.c; bar.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); if (st.tool === 'eraser') { st.tool = 'pen'; bar.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === 'pen')); } }
      else if (b.dataset.w) { st.width = b.dataset.w === 'thick' ? 5 : 2.4; }
      else if (b.dataset.a === 'undo') { st.strokes.pop(); redraw(); persist(); }
      else if (b.dataset.a === 'clear') { if (!st.strokes.length || confirm('مسح كل الكتابة على هذه الصفحة؟')) { st.strokes = []; redraw(); persist(); } }
      else if (b.dataset.a === 'off') api.toggle(false);
    });
    function persist() { if (!st.save || !st.key) return; try { if (st.strokes.length) localStorage.setItem(st.key, JSON.stringify(st.strokes)); else localStorage.removeItem(st.key); } catch (e) {} }
    const api = {
      toggle(on) { st.on = on == null ? !st.on : !!on; host.classList.toggle('qgpen-on', st.on); if (opts.onToggle) opts.onToggle(st.on); return st.on; },
      isOn() { return st.on; },
      setKey(key, strokes) { persist(); st.key = key; st.strokes = strokes || (key ? (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } })() : []); redraw(); },
      getStrokes() { return st.strokes.slice(); },
      clear() { st.strokes = []; redraw(); persist(); },
      resize: size,
      destroy() { ro.disconnect(); cv.remove(); bar.remove(); }
    };
    size(); return api;
  }
  window.QGPen = { attach };
})();
