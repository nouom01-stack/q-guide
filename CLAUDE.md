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

## 📖 «الأسئلة الجديدة» (set `v15`, video 15)
`p/data/v15.bin` = the 50 new verbal questions grouped like the «Q-Guide | Verbal – New Questions» form / Salman's video 15. It is built from `v1`–`v14` by the private builder (`v15.py`, run by `build_data.py`);
every item keeps `src`/`sidx` of its model question (notes, skills and the AI use the original). Group fields `m`/`mt` show «Model N · title»; items in the last group have `tag`.
`find`/AI banks only index v1–v14, so v15 adds no duplicate search results. Video label helper `vLabel()`; YouTube members video `YT.v.v[14]`.

## 👑 Owner-only pages (Arabic, `i18n:off`)
Subscription dates (`subLeft`, `subCell`, `subDatesDlg`, `subAddMonth`) and the report (`renderReport`, route `#admin-report/<email>`). Modals close on every route change.

## 💳 Paying on the site (Tap) — student side + owner box
- `auth.pay = {on, price, test}` comes with the free session (`login`/`me`); `payOn()` shows «💳 ادفع 140 ريال واشترك الحين» at the top of the subscribe dialog (`subDlg`), YouTube/WhatsApp stay below as «أو اشترك عن طريق يوتيوب».
- `payGo()` → `pay_start` → Tap's page. Tap returns to `/p/?tap_id=chg_…`: the startup code saves it in `sessionStorage.qg_tap` and opens `#paid` (`renderPaid`: checking → 🎉 success with the end date / ✕ declined + try again / ⏳ pending + check again). The heartbeat is paused while a payment id is pending; after login it goes back to `#paid`.
- Success swaps the free session for the student session (`authFrom(r.auth)`) and clears the free key/cache.
- New subscriber type `pay` («💳 دفع إلكتروني») watches the videos in the site like free/bank (`vidSub`). Owner: tile «💳 دفع من الموقع», row chip, badge in «👥 الطلاب», and the «💳 الدفع من الموقع» box in «💳 الاشتراكات» (`payBox`, rows open the student card).

## 🗑 Ended students: delete from the lists · 🎓 all-time count (owner)
Ended rows in «👥 الطلاب» show «🗑 حذف» instead of «حظر» (ban stays in the student card); also «🗑 حذف من القائمة» in the card and «🗑 حذف» next to «↩️ إرجاع الاشتراك» in «💳 الاشتراكات» (`subGoneOne` → `adm_sub_gone`). First owner tile «🎓 كل اللي اشتركوا» = `ADM.ever` from `adm_students`.
