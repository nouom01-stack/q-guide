# Q-Guide site — notes for Claude

Static site on GitHub Pages (q-guide.online). The API is the private repo `nouom01-stack/q-guide-api` (Cloudflare Worker) — see its CLAUDE.md.
Never put secrets, the question bank, or the private YouTube copy IDs in this public repo.

## 🌐 Two languages (Arabic = original, English)
- Runtime: `p/i18n.js` (loaded before every script on `/p/` and `/test/`). The language is `localStorage.qg_lang` (`?lang=en` sets it); the EN / ع button is `QGL.btn()`.
  Pages with `<html data-qgdir>` flip `dir` (practice app); `/test/` stays LTR and its Arabic `.ar` blocks turn LTR in English (`exam.css`).
- In code, every Arabic UI string is wrapped: `_T('…')` or the tag `_T\`… ${x} …\``. In Arabic `_T` returns the text as is; in English it looks up each text segment
  (text between HTML tags, plus title/placeholder/aria-label/alt values; `${…}` become `{0}`, `{1}`… and may move) in `p/en.js`. Anything missing stays Arabic.
- Admin pages stay Arabic: code between `// i18n:off` and `// i18n:on` is never wrapped; a line with `i18n:skip` is skipped too (e.g. owner analytics labels, counted-noun helpers).
- Counted nouns and word-order-sensitive strings use an English branch (`EN ? enN(n, 'day', 'days') : …`) instead of `_T`.
- Arabic content stays RTL in English: teacher explanations (`fmtExp` wraps them in `.arc`), question translations, the rules pages, AI answers (CSS `html.l-en …`).
- Server messages (`r.msg`) are translated where they arrive (`api()`); add new student-facing API messages to `tools/i18n/server.json`.
- Static pages (`/`, `/terms/`, `/privacy/`) use `assets/lang.js` with `data-l="ar"` / `data-l="en"` pairs.

After changing Arabic text in `p/app.js`, `assets/ai.js` or `test/exam.js`:
```bash
node tools/i18n/wrap.cjs p/app.js            # wraps any new Arabic literal with _T (idempotent)
node tools/i18n/extract.cjs p/app.js assets/ai.js test/exam.js   # → tools/i18n/missing.json
# add the English for each missing key to tools/i18n/en.json, then:
node tools/i18n/extract.cjs --build p/app.js assets/ai.js test/exam.js   # validates + writes p/en.js + bumps its version in p/i18n.js
```
Also bump `p/i18n.js?v=` in `p/index.html` and `test/index.html` when `p/i18n.js` changes. Arrows in English point the other way (← / →).
