#!/usr/bin/env node
/* 🌐 يطلع كل مفاتيح الترجمة من مواضع _T في الملفات، ويقارنها بالقاموس tools/i18n/en.json
 *   node tools/i18n/extract.cjs p/app.js assets/ai.js test/exam.js   → tools/i18n/keys.json (كل المفاتيح + مكانها) و missing.json (الناقص)
 *   node tools/i18n/extract.cjs --build …                             → يبني p/en.js من en.json (بعد التحقق) ويحدّث نسخة القاموس في p/i18n.js
 * المفاتيح تنحسب بنفس دالة الموقع (QGL.keys في p/i18n.js) عشان تطابق وقت التشغيل.
 */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
const DIR = process.env.ACORN_DIR || '/opt/node-tools/node_modules';
const acorn = require(path.join(DIR, 'acorn')), walk = require(path.join(DIR, 'acorn-walk'));
const M0 = '', M1 = '';

function loadQGL() {   // نشغّل p/i18n.js ببيئة متصفح وهمية
  const ctx = { window: {}, location: { search: '' }, localStorage: { getItem: () => 'ar', setItem() {} },
    document: { documentElement: { classList: { add() {} }, hasAttribute: () => false }, readyState: 'complete', write() {}, addEventListener() {} } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'p/i18n.js'), 'utf8'), ctx);
  return ctx.QGL;
}
function sites(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8'), lines = src.split('\n');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
  const out = [];
  walk.simple(ast, {
    TaggedTemplateExpression(n) { if (n.tag.type === 'Identifier' && n.tag.name === '_T') { const q = n.quasi.quasis.map(x => x.value.cooked); let full = q[0]; for (let i = 1; i < q.length; i++) full += M0 + (i - 1) + M1 + q[i]; out.push({ full, line: n.loc.start.line, attr: /<[^<>]*$/.test(full) }); } },
    CallExpression(n) { if (n.callee.type === 'Identifier' && n.callee.name === '_T' && n.arguments[0] && n.arguments[0].type === 'Literal' && typeof n.arguments[0].value === 'string') out.push({ full: n.arguments[0].value, line: n.loc.start.line }); },
  });
  return out.map(s => Object.assign(s, { file, ctx: Array.from(lines[s.line - 1].trim()).slice(0, 160).join('') }));
}
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
function main() {
  const args = process.argv.slice(2), build = args.includes('--build'), files = args.filter(a => !a.startsWith('--'));
  const QGL = loadQGL(), dictFile = path.join(ROOT, 'tools/i18n/en.json');
  const EN = fs.existsSync(dictFile) ? JSON.parse(fs.readFileSync(dictFile, 'utf8')) : {};
  const K = new Map();
  for (const f of files) for (const s of sites(f)) for (const k of QGL.keys(s.full)) { if (!K.has(k)) K.set(k, { k, at: [] }); const e = K.get(k); if (e.at.length < 3) e.at.push(`${s.file}:${s.line}`); if (!e.ctx) e.ctx = s.ctx; }
  // نصوص الخادم اللي تطلع للطالب (tools/i18n/server.json: قائمة نصوص) — نفس القاموس
  const srvFile = path.join(ROOT, 'tools/i18n/server.json');
  if (fs.existsSync(srvFile)) for (const t of JSON.parse(fs.readFileSync(srvFile, 'utf8'))) for (const k of QGL.keys(t)) if (!K.has(k)) K.set(k, { k, at: ['server'], ctx: Array.from(t).slice(0, 160).join('') });
  const all = [...K.values()], missing = all.filter(e => EN[e.k] == null);
  fs.writeFileSync(path.join(ROOT, 'tools/i18n/keys.json'), JSON.stringify(all, null, 1));
  fs.writeFileSync(path.join(ROOT, 'tools/i18n/missing.json'), JSON.stringify(missing, null, 1));
  console.log(`keys ${all.length} · translated ${all.length - missing.length} · missing ${missing.length}`);
  if (!build) return;
  // ✅ تحقق: نفس القيم {0}{1}… · بدون وسوم HTML · بدون نص عربي
  const bad = [];
  for (const [k, v] of Object.entries(EN)) {
    if (typeof v !== 'string') { bad.push([k, 'not a string']); continue; }
    if (ph(k) !== ph(v)) bad.push([k, 'placeholders ' + ph(k) + ' ≠ ' + ph(v)]);
    if (/[<>]/.test(v) && !/[<>]/.test(k)) bad.push([k, 'has < or >']);
    if (/[؀-ۿ]/.test(v)) bad.push([k, 'still Arabic']);
  }
  if (bad.length) { bad.slice(0, 40).forEach(b => console.log('✗', JSON.stringify(b[0]).slice(0, 90), '→', b[1])); process.exit(1); }
  const used = {}; all.forEach(e => { if (EN[e.k] != null) used[e.k] = EN[e.k]; });
  const js = '/* 🌐 قاموس English للموقع — ينبني من tools/i18n/en.json (لا تعدّله هنا) */\nwindow.QG_EN=' + JSON.stringify(used) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'p/en.js'), js);
  const v = crypto.createHash('sha256').update(js).digest('hex').slice(0, 8);
  const i18 = path.join(ROOT, 'p/i18n.js'); fs.writeFileSync(i18, fs.readFileSync(i18, 'utf8').replace(/EN_V = '[^']*'/, `EN_V = '${v}'`));
  // نسخة i18n.js في الصفحات (عشان المتصفح ما يستخدم نسخة قديمة فيها رقم قاموس قديم)
  const iv = crypto.createHash('sha256').update(fs.readFileSync(i18)).digest('hex').slice(0, 8);
  for (const page of ['p/index.html', 'test/index.html']) { const f = path.join(ROOT, page); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\/p\/i18n\.js\?v=[\w]+/, '/p/i18n.js?v=' + iv)); }
  console.log(`p/en.js: ${Object.keys(used).length} keys · v=${v} · i18n.js v=${iv}`);
}
main();
