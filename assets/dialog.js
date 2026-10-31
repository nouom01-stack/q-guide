/* QGDlg — نوافذ تأكيد/إدخال خاصة بالموقع بدل confirm/prompt/alert (اللي تتعطل داخل متصفحات التطبيقات مثل تيليقرام) */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function open(opts) {
    return new Promise(resolve => {
      const ov = document.createElement('div'); ov.className = 'qgdlg'; ov.setAttribute('dir', 'rtl');
      ov.innerHTML = `<div class="qgdlg-box" role="dialog" aria-modal="true">${opts.title ? `<h3>${esc(opts.title)}</h3>` : ''}<p>${esc(opts.msg).replace(/\n/g, '<br>')}</p>${opts.input ? `<input type="text" class="qgdlg-in" value="${esc(opts.def || '')}" placeholder="${esc(opts.placeholder || '')}">` : ''}<div class="qgdlg-acts"><button class="qgdlg-ok ${opts.danger ? 'danger' : ''}">${esc(opts.ok || 'موافق')}</button>${opts.cancel !== false ? `<button class="qgdlg-cancel">${esc(opts.cancel || 'إلغاء')}</button>` : ''}</div></div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('.qgdlg-in'); const okb = ov.querySelector('.qgdlg-ok'); const cb = ov.querySelector('.qgdlg-cancel');
      const done = v => { ov.classList.add('out'); setTimeout(() => ov.remove(), 120); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(opts.input ? null : false); if (e.key === 'Enter' && (inp || !opts.input)) done(opts.input ? inp.value : true); };
      document.addEventListener('keydown', onKey);
      okb.onclick = () => done(opts.input ? inp.value : true);
      if (cb) cb.onclick = () => done(opts.input ? null : false);
      ov.addEventListener('click', e => { if (e.target === ov && opts.cancel !== false) done(opts.input ? null : false); });
      requestAnimationFrame(() => { ov.classList.add('in'); (inp || okb).focus(); if (inp) inp.select(); });
    });
  }
  window.QGDlg = {
    confirm: (msg, o) => open(Object.assign({ msg }, o || {})),
    prompt: (msg, def, o) => open(Object.assign({ msg, input: true, def }, o || {})),
    alert: (msg, o) => open(Object.assign({ msg, cancel: false, ok: 'حسناً' }, o || {})),
  };
  const css = document.createElement('style'); css.textContent = `
.qgdlg{position:fixed;inset:0;background:rgba(10,20,50,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;opacity:0;transition:opacity .12s;font-family:"Tajawal","Segoe UI",Tahoma,sans-serif}
.qgdlg.in{opacity:1}.qgdlg.out{opacity:0}
.qgdlg-box{background:var(--card,#fff);color:var(--ink,#1a2235);border-radius:18px;max-width:420px;width:100%;padding:20px 20px 16px;box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:right;transform:translateY(8px);transition:transform .12s}
.qgdlg.in .qgdlg-box{transform:none}
.qgdlg-box h3{margin:0 0 8px;font-size:18px}.qgdlg-box p{margin:0 0 14px;font-size:16px;line-height:1.6}
.qgdlg-in{width:100%;padding:11px 12px;border-radius:10px;border:1.5px solid var(--line,#D9E0EE);background:transparent;color:inherit;font:inherit;font-size:16px;margin-bottom:14px}
.qgdlg-acts{display:flex;gap:8px;justify-content:flex-start;flex-direction:row-reverse}
.qgdlg-acts button{font:inherit;font-weight:700;font-size:15px;border:0;border-radius:11px;padding:10px 18px;cursor:pointer}
.qgdlg-ok{background:var(--navy,#15337A);color:#fff}.qgdlg-ok.danger{background:#D64545}
.qgdlg-cancel{background:transparent;color:var(--mut,#667085);border:1.5px solid var(--line,#D9E0EE)!important}`;
  document.head.appendChild(css);
})();
