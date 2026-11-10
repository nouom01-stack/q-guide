/* 🌐 Q-Guide بلغتين: عربي (الأصل) و English.
 * النصوص في الكود تبقى عربية داخل _T`…` أو _T('…'). بالإنجليزي تنترجم من القاموس /p/en.js:
 * كل مقطع نص بين وسوم HTML (وقيم title/placeholder/aria-label/alt) = مفتاح، والقيم ${…} داخل المقطع تصير {0} {1}… وتقدر تتبدّل أماكنها في الترجمة.
 * أي نص ما له ترجمة يطلع عربي مثل ما هو. اللغة في localStorage «qg_lang»، و ?lang=en في الرابط يغيّرها.
 * الصفحة اللي فيها <html data-qgdir> تتقلب يمين/يسار حسب اللغة، والباقي يحدد اتجاهه بنفسه.
 * أدوات الترجمة: tools/i18n (لف النصوص، استخراج المفاتيح، بناء القاموس).
 */
(function () {
  'use strict';
  const LS = 'qg_lang', EN_V = 'd5ed2167';
  let lang = 'ar';
  try { const q = /[?&]lang=(ar|en)\b/.exec(location.search); if (q) localStorage.setItem(LS, q[1]); lang = localStorage.getItem(LS) === 'en' ? 'en' : 'ar'; } catch (e) {}
  const EN = lang === 'en', html = document.documentElement;
  html.classList.add('l-' + lang);
  if (html.hasAttribute('data-qgdir')) { html.lang = lang; html.dir = EN ? 'ltr' : 'rtl'; }
  if (EN && !window.QG_EN && document.readyState === 'loading') document.write('<script src="/p/en.js?v=' + EN_V + '"><\/script>');
  const AR = /[؀-ۿ]/, M0 = '', M1 = '', MK = /(\d+)/g;
  const ATTR = /(\s(?:title|placeholder|aria-label|alt|data-tip)=)(?:"([^"]*)"|'([^']*)')/g, TAG = /<[^<>]*>/g;
  const dict = () => window.QG_EN || {};
  const norm = s => s.replace(/[ \t]*\n\s*/g, '\n').replace(/[ \t]+/g, ' ');
  // مقطع واحد (بدون وسوم) → المفتاح + أماكن القيم
  function keyOf(core) { const loc = []; return { key: norm(core.replace(MK, (_, i) => '{' + (loc.push(i) - 1) + '}')), loc }; }
  function seg(text) {
    if (!AR.test(text)) return text;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text), k = keyOf(m[2]), t = dict()[k.key];
    if (t == null) return text;
    return m[1] + t.replace(/\{(\d+)\}/g, (_, i) => k.loc[+i] != null ? M0 + k.loc[+i] + M1 : '') + m[3];
  }
  const tag = t => !AR.test(t) ? t : t.replace(ATTR, (all, a, v1, v2) => { const dq = v1 != null, v = dq ? v1 : v2; if (!AR.test(v)) return all; const q = dq ? '"' : "'"; return a + q + seg(v) + q; });
  function trFull(full) {
    let out = '', last = 0, m; TAG.lastIndex = 0;
    while ((m = TAG.exec(full))) { out += seg(full.slice(last, m.index)) + tag(m[0]); last = TAG.lastIndex; }
    return out + seg(full.slice(last));
  }
  // كل المفاتيح في نص (أداة الاستخراج تستخدم نفس الدالة عشان المفاتيح تطابق)
  function keys(full) {
    const K = [], add = s => { if (AR.test(s)) K.push(keyOf(s.trim()).key); };
    let last = 0, m; const re = /<[^<>]*>/g;
    while ((m = re.exec(full))) { add(full.slice(last, m.index)); m[0].replace(ATTR, (all, a, v1, v2) => { add(v1 != null ? v1 : v2); return all; }); last = re.lastIndex; }
    add(full.slice(last)); return K;
  }
  const PLAN = new WeakMap(), SC = new Map();
  function plan(strs) {
    let p = PLAN.get(strs); if (p) return p;
    let full = strs[0]; for (let i = 1; i < strs.length; i++) full += M0 + (i - 1) + M1 + strs[i];
    const parts = trFull(full).split(MK), s = [], ord = [];
    for (let i = 0; i < parts.length; i++) (i % 2 ? ord : s).push(i % 2 ? +parts[i] : parts[i]);
    p = { s, ord }; PLAN.set(strs, p); return p;
  }
  // _T`نص ${قيمة}` أو _T('نص') — بالعربي يرجع النص نفسه
  function _T(strs) {
    if (strs == null || !strs.raw) {
      const x = strs == null ? '' : String(strs); if (!EN || !AR.test(x)) return x;
      let r = SC.get(x); if (r == null) { r = trFull(x); SC.set(x, r); } return r;
    }
    let o = strs[0];
    if (!EN) { for (let i = 1; i < strs.length; i++) o += String(arguments[i]) + strs[i]; return o; }
    const p = plan(strs); o = p.s[0];
    for (let i = 0; i < p.ord.length; i++) o += String(arguments[p.ord[i] + 1]) + p.s[i + 1];
    return o;
  }
  window._T = _T;
  window.QGL = {
    lang, en: EN, keys, norm,
    set(l) { try { localStorage.setItem(LS, l === 'en' ? 'en' : 'ar'); } catch (e) {} location.reload(); },
    // زر تبديل اللغة (يشتغل بأي مكان فيه data-qglang)
    btn: cls => `<button type="button" class="${cls || 'lng'}" data-qglang="${EN ? 'ar' : 'en'}" title="${EN ? 'العربية' : 'English'}" aria-label="${EN ? 'التبديل إلى العربية' : 'Switch to English'}"><span lang="${EN ? 'ar' : 'en'}">${EN ? 'ع' : 'EN'}</span></button>`,
  };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-qglang]'); if (b) { e.preventDefault(); QGL.set(b.dataset.qglang); } });
})();
