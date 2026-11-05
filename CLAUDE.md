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

## 🗑 Removed at the owner's request (Nov 2026) — don't bring back
- The quant rules video («مقطع قواعد الكمي», was `YT.q.rules` / `ytRules` / `#watch-q-rules`) and the verbal rules video: gone from the home row, «الشرح والمدرسين» and the in-site player (API slot `q:rules` removed too).
- The rules summary pages «📐 قوانين الكمي» (`#rules`) and «📘 قواعد اللفظي» (`#rules-v`): `RULES_ON = false` hides the home links/tools, the routes (old links go home), the «راجع القاعدة» chips + the summary's rules box, the assistant's `{{rules…}}` chips and the plan's «قوانين الكمي» link. Code, CSS and `p/data/rules*.json` / `rulemap.json` stay dormant — flip the flag only if the owner asks.
- «🏁 الاختبار الشامل» (`#qall` / `#vall`): no home tool, no route — old links go home (`route()`). Old qall/vall progress is still folded into the skills history and shown in the owner report.

## 👑 Owner-only pages (Arabic, `i18n:off`)
Subscription dates (`subLeft`, `subCell`, `subDatesDlg`, `subAddMonth`) and the report (`renderReport`, route `#admin-report/<email>`). Modals close on every route change.

## 💳 Paying on the site (Tap) — student side + owner box
- `auth.pay = {on, price, test}` comes with the free session (`login`/`me`); `payOn()` shows «💳 ادفع 140 ريال واشترك الحين» at the top of the subscribe dialog (`subDlg`), YouTube/WhatsApp stay below as «أو اشترك عن طريق يوتيوب».
- `payGo()` → `pay_start` → Tap's page. Tap returns to `/p/?tap_id=chg_…`: the startup code saves it in `sessionStorage.qg_tap` and opens `#paid` (`renderPaid`: checking → 🎉 success with the end date / ✕ declined + try again / ⏳ pending + check again). The heartbeat is paused while a payment id is pending; after login it goes back to `#paid`.
- Success swaps the free session for the student session (`authFrom(r.auth)`) and clears the free key/cache.
- With the live key the owner opens payments for every visitor from the payments box («🚀 افتح الدفع لكل الزوار» / «⏸ إيقاف الدفع للزوار»); until then only testers see the button (testers may have their own price).
- New subscriber type `pay` («💳 دفع إلكتروني») watches the videos in the site like free/bank (`vidSub`). Owner: tile «💳 دفع من الموقع», row chip, badge in «👥 الطلاب», and the «💳 الدفع من الموقع» box in «💳 الاشتراكات» (`payBox`, rows open the student card).

## 🙋 «تحتاج مساعدة؟» — the general assistant (`assets/ai.js` help mode + `helpFind` / `helpCard` in `p/app.js`)
- Floating button `QGAI.fab(on)`: `route()` shows it via `helpOn(h)` (home and general pages); hidden while solving questions, in the arena, admin pages, `#find`, `#paid`. A greeting bubble shows once a day (`qg_hlp_hi`).
- `QGAI.help()` opens the same panel as «اشرح لي» in help mode: the student snaps (📷, or pastes an image) or types the question → `helpFind` (op `find`, no kind) → `helpCard` (same card as the search page).
  Found (exact / reorder / wording / opts_same) → the explanation starts at once (`/ai` with that ref) · similar (numbers / opts_diff) → «اشرح لي طريقة الحل» button · new → report + nearest questions. Free visitors: only q1 / v1 / t1 refs are explained.
- Typed text after an explanation is a follow-up on that question (thread `H.tk`); «سؤال جديد», the camera, or pasting a full question with A) B) options starts a new search.
- Anything else (Arabic text, concept questions, "what should I study", tips) → chat mode (`/ai {chat: 1}`): the coach solves/explains/advises using the student's profile; a searched question that is not in the course falls through to chat too (slim «مو من أسئلة الدورة» bar + report). `helpProfile()` (exam countdown, streak, weakest topics from `histAgg`, today's plan task, resume set) feeds the welcome card's status chips and suggestion chips, and `ctx` of every chat request.
- Link tokens in answers (`{{q3}}`, `{{t-geo}}`, `{{plan}}`…) → `helpLink()` page chips (`.qgai-lk`). `{{rules…}}` tokens are dropped while `RULES_ON` is false (the API prompt no longer offers them).
- Home «ركّز اليوم» strip (`focusHtml`): weakest skill + drill `#t-<topic>` + «أعد حل أخطائك» + «اسأل المساعد»; placement-test nudge when there is no data yet.
- Test: `site/help_e2e.js` (the dev server multiplies per-minute rate limits ×10: `RATE_X`).

## ⏱📐 After every answer: pace + «راجع القاعدة» (`fbMeta` in `p/app.js`) — the rule part is OFF (`RULES_ON = false`, rules pages removed)
- `paceOf(ms)` compares the question's own time (`a.ms`, capped at `Q_CAP`) with the GAT pace (~1 min/question): `fast` ≤ 40 s · `ok` ≤ 75 s · `slow`; chip `.fb-t` after every answer, hidden when the time is unknown/capped.
- `ruleFor(it, i)` → `{href, icon, t}` of the rules section to review: quant from `p/data/rulemap.json` (`"q4:29": "fractions"`, built in the API repo by `tools/rulemap.mjs` from the bank — only confident matches, ~70 % of the questions; bump `RMAP_V` when it changes),
  verbal from `it.topic` → `#rules-v/<ana|sen|err|read>`. Chip `.fb-r` after a wrong answer only; never for free visitors (rules are for subscribers). The map is fetched with the set (`ruleMapLoad`).
- Set summary (`finish`): `.s-pace` = average time per question (≥ 5 timed answers) + verdict; `.s-rules` = the distinct rules of the wrong questions, most frequent first (count badge), max 6.
- Keyboard hints `.q .kbd` are hidden on touch devices (CSS `hover:none and pointer:coarse`). Test: `site/player_e2e.js`.

## 🗑 Ended students: delete from the lists · 🎓 all-time count (owner)
Ended rows in «👥 الطلاب» show «🗑 حذف» instead of «حظر» (ban stays in the student card); also «🗑 حذف من القائمة» in the card and «🗑 حذف» next to «↩️ إرجاع الاشتراك» in «💳 الاشتراكات» (`subGoneOne` → `adm_sub_gone`). First owner tile «🎓 كل اللي اشتركوا» = `ADM.ever` from `adm_students`.
