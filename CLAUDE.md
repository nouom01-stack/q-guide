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

## 🔑 Sign-in inside the installed app (home screen / standalone)
`QG.GSI_REDIRECT` (standalone, set in `p/index.html` / `test/index.html`) → GSI `ux_mode: 'redirect'` with one `login_uri` for both pages: `<API>/gsi`.
It must be in Google Cloud → APIs & Services → Credentials → the OAuth client in `QG.CLIENT_ID` → **Authorized redirect URIs** = `https://q-guide-api.nouom01.workers.dev/gsi`, otherwise the student gets «Error 400: redirect_uri_mismatch» (popups don't work in iOS home-screen apps, and their storage is separate from Safari, so they must sign in inside the app).
Registered by the owner on Nov 6 2026 (verified: Google shows the account chooser, not the error). The OAuth client (project number 248349599429) lives in the Google Cloud of the account that owns the students sheet and the Forms — not the Cloudflare/GitHub account and not the YouTube channel account. Never change `login_uri` without adding the new address there first.
`POST /gsi` (API) bounces to `/p/#gsi=<credential>`; `/test/` saves `qg_gsi_to` before the redirect and `/p/` (`gsiBack`, read before `renderLogin` clears it) sends him back after login. Test: `site/gsi_e2e.js`.

## 👨‍🏫 Teacher pages (`#sharh-salman`, `#sharh-abdullah` · `renderTeach(id, tab)`, config `TP`) — «الشرح والمدرسين» `#sharh` = teacher cards only
Each teacher page has two tabs (`/f` «🧱 التأسيس» · `/t` «🏋️ التدريب» in the hash; else the last tab `qg_tp_sal`/`qg_tp_abd`; Salman opens on practice while none of his foundation is uploaded):
- Salman Al Faraj: foundation = the 24 lessons of «قواعد الكمي» (`sf:1–24`, `QR_L` = [ar, en, workbook page, unit], `QR_U` = 4 units, same order as `#wb-tq`; «📘 قواعد الدرس» → `#wb-tq@<page>`) · practice = his quant sections + verbal models (`q`/`v`, YouTube or in-site as before).
- Abdullah Al Shamrani: foundation = 4 verbal lessons `af:1–4` (`PART_AR`, `TV_PAGE`) · practice = the 14 models `at:1–14` (in-site; «✍️ حل النموذج N» → `#vN`).
Foundation + Abdullah's practice play in-site for **every** subscriber incl. YouTube members (`TK` in `renderWatch`: `af`/`at`/`sf`); not uploaded → «⏳ قريباً» (banner when none); visitors see locks. The verbal workbook card has no teacher button any more (owner's request).

## 🎬 Teachers upload their own videos (`#my-vids` «🎬 مقاطعي», `renderMyVids` / `paintMyVids`)
A staff account linked to a teacher (`auth.teach` = `salman` | `abdullah` from `login`/`me`) gets «🎬 مقاطعي» in the top bar: only his slots (`teach_vids`), same upload cells/multi-picker as the owner (`vupHtml(V, teach)` / `vupBind(W, teach)`; names: Lesson N = Salman's foundation, Section N, Model N (Abdullah's practice on his page), Analogy…). The owner links accounts in «💳 الاشتراكات» → «⬆️ رفع المقاطع للموقع» (closed `<details>`, `VUP.open`) → «👨‍🏫 المدرسين يرفعون مقاطعهم بأنفسهم» (`adm_staff_teach`, one account per teacher). Test: `site/teach_e2e.js`.

## 🎬 TikTok studio (`#studio`, `renderStudio` / `renderRec`, staff only, Arabic)
- Card `#tk` (9:16) + panel `.rp`. «🎥 وضع التصوير» (`.rec.noui`) = the card centered with two rails: right `.rdraw` (pen · highlighter · text · eraser | thin · thick | 5 colors), left `.racts` (undo · clear | answer | prev · next · random | posted | hide · panel). Phone portrait (`max-aspect-ratio: 2/3`) = a bar above + a bar below. «👁 إخفاء» (`.bare`, key H) = the clean card + ⋯ to bring the rails back; Esc = the panel.
- Text tool (`QGPen.attach(…, { text: true })`, `assets/pen.js`): press the card and type (Enter/Esc saves, Shift+Enter = new line), drag a text to move it, press it to edit, empty it or rub it with the eraser to delete it. Color + thin/thick (= normal/large text) apply to the text being typed (tool buttons cancel `pointerdown` so the cursor stays). Texts live in the strokes list, so undo / clear cover them (undo also reverts moves, edits and a clear). Workbook and mock-test pens don't pass `text` → unchanged.
- 🔤 Tap a word → its translation in a gold bubble under it (above it when another line of the same text follows; bubbles on one line never overlap; tap the word or the bubble again to hide; 🗑 clears them too). Each side of an analogy is one unit (`stTr`: «Check in» = «يسجّل الوصول») translated from the item's own `ar` (q / o split on «:»); else `ST_PHRASE` (quant comparison options, a few fruits/directions) or the vocab dictionary (`vocLook`). Quant stems are images, so only their word options translate. With the pen on, QGPen's `onTap` hands a still press to the page (no dot); text tool: tap on a word = translation, elsewhere = new text; writing off → plain click.
- Keys by position (`e.code`, works on the Arabic layout): R answer · Z undo · C clear · P pen · T text · E eraser · H rails/hide · ← → next/prev. Tests: `site/studio_e2e.js`, `site/studio_tr_e2e.js`.

## 🧱 Foundation workbooks (`#wb-tq` = تأسيس الكمي / Quant Rules EN-AR 257 p, 24 lessons · `#wb-tv` = تأسيس اللفظي / verbal rules 4 p)
Same viewer as the training workbooks (`renderWorkbook`, pen, encrypted pages, no download, no solved copy), for every subscriber. `#wb-tv@3` opens a page. Built by the private builder `site/build_found.py` from the owner's PDFs → `p/wb/tq|tv/NNN.bin` + `meta.json` (`slots.header` = the name stamp, bottom-right, `align`; `v` = build time: pages are fetched with `?v=` and the pen key is `qg_wb_<kind>v<v>_<page>`, so a new edition never shows cached old pages or old pen marks). Bump `WB_V` when a meta.json changes. Home «📘 مذكراتك» has two groups: 🧱 التأسيس / 🏋️ التدريب.
The assistant button is hidden on `#wb-*` pages (it covered the pen button).

## 🧑‍🏫 Academic advisors (`#admin-adv`, `renderAdv` / `paintAdv`, API `src/adv.js`)
Staff marked as advisors (`staff.adv` = `m` boys / `f` girls, `adv_name` = the name in the message) — set by the owner in «⚙️ مين المرشدين؟». Girls → the `f` advisor; boys split evenly between the `m` advisors (auto, stable; the owner can move a student). Advisor sees only his students («💬 طلابي», also a top-bar link: `auth.adv`) with one WhatsApp message «أنا <name>، مرشدك الأكاديمي…» (feminine for `f`) and «✓ تواصلت» tracking. The owner sees every advisor's list (no WhatsApp buttons — the message carries the advisor's name). Test: `site/adv_e2e.js`.

## 👤 Profile page (`#me`, `renderProfile` / `meDraw`) — opened from the top-bar chip
Subscription card (type + start + end date + days left by Riyadh day + progress; ≤ 3 days or past → «↻ جدّد اشتراكك» on WhatsApp; visitors/ended → subscribe dialog), name + school (school is private: the student, his advisor and the owner), avatar picker (upload / YouTube photo / 12 DiceBear styles with **random** seeds + «🔀 أشكال ثانية» / none) that saves instantly.
Avatar links never contain emails: uploads are `<API>/avatar/i/<random id>`, DiceBear seeds are random (old email-based links were converted by the API). Test: `site/me_e2e.js` (run with `LEGACY_AV=1`).

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

## 🛍 Paying through Salla — student side + owner box (API: `src/salla.js`)
- `auth.salla = {on, url, price}` (free session, `login`/`me`, refreshed by the heartbeat). When `sallaOn()`, the subscribe dialog shows «💳 ادفع 140 ريال واشترك الحين» for Salla (the Tap button is hidden then); YouTube/WhatsApp stay below.
- `sallaSteps(ov, what, close, ref)` turns the dialog into 2 steps: open the product page and pay (`#slopen`, new tab; sets `sessionStorage.qg_salla`) · paste the order number (`.slp-ref` form: `#slref` + `#slclaim` → `salla_claim`; messages in `.slp-st` via `slStatus`: not found / pending / used by another account / canceled / on hold / digits only / too many tries). «→ رجوع» = the main view (`subDlg(what, '', 1)`). The main view also has «دفعت؟ فعّل اشتراكك برقم الطلب» (`#slhave` → steps with the focus on the number box — e.g. a parent paid). No email copy step any more (owner's choice, Nov 2026).
- While `qg_salla` is set (45 min): `salla_check` every 5 s for 5 min, then every 20 s, and on focus/visibility (`sallaPoll`). This only opens by itself when his Salla email is his site email (or the owner linked it). Paid (poll or claim) → `sallaWin(r)`: `authFrom(r.auth)` + clear the key cache → `PAID_OK` → `#paid` success (`paidOk`). A poll never overwrites a claim message (pending shows only when `.slp-st` is empty). The heartbeat's «upgraded» tries `salla_check` and logs out unless it returns `paid`.
- Owner «💳 الاشتراكات» → `sallaBox` / `sallaBind`: 3 checks (secret · app on the store · product link), link + button price form, «🚀 افتح سلة لكل الزوار» / «⏸ إيقاف», orders (source «🔢 كتب رقم الطلب» for claims; paid and unclaimed = «⏳ ينتظر رقم الطلب», after 3 hours «⚠️ ما فعّله صاحبه للحين» + a warning bar (`slStuck`); «🔗 ربط» + email, «🙈 إخفاء»; the row name = the student's site name, the Salla customer name in the tooltip), «🔄 جلب طلبات آخر 7 أيام من سلة», events log. Badges «🛍 دفع عن طريق سلة» (`added_by = 'salla'`). The Tap box is `.paybox:not(.slbox)`.
- 📧 On the Plus plan the orders reach the API as Salla emails (no student email in them), so the number is the normal path: when `salla_claim` says `none`, `claimNo` retries the same number every 20 s for 3 minutes with «⏳ ننتظر وصول طلبك من سلة…» (`slStatus({mailwait})`, class `mw`; typing cancels it), then shows «ما لقينا». The owner box shows «📧 إيميلات سلة» (last mail, store id, last rejected mail) instead of the app check when no app is linked.
- Tests: `site/salla_ui_e2e.js` (+ `salla_api_e2e.js`, `salla_mail_e2e.js`).
