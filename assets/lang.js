/* 🌐 الصفحات الثابتة (الرئيسية، الشروط، الخصوصية) بلغتين: كل نص له نسختين data-l="ar" و data-l="en"، وهذا يختار اللغة (نفس اختيار منصة التدريب «qg_lang») */
(function () {
  var l = 'ar';
  try { var q = /[?&]lang=(ar|en)\b/.exec(location.search); if (q) localStorage.setItem('qg_lang', q[1]); l = localStorage.getItem('qg_lang') === 'en' ? 'en' : 'ar'; } catch (e) {}
  var h = document.documentElement; h.lang = l; h.dir = l === 'en' ? 'ltr' : 'rtl'; h.classList.add('l-' + l);
  var t = h.getAttribute('data-title-' + l); if (t) document.title = t;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-qglang]'); if (!b) return;
    e.preventDefault(); try { localStorage.setItem('qg_lang', b.getAttribute('data-qglang')); } catch (x) {}
    location.href = location.pathname + location.hash;
  });
})();
