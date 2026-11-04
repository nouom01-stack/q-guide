#!/usr/bin/env node
/* 🌐 يلف النصوص العربية في ملف JS بـ _T عشان تنترجم للإنجليزي (p/i18n.js).
 *   node tools/i18n/wrap.cjs p/app.js [--dry]
 * - '…' → _T('…') · `…` → _T`…`  (اللي ملفوف أصلاً ما يتكرر)
 * - ما يلف: مفاتيح الكائنات، المقارنات (=== / case)، وسائط indexOf/includes/test/split…، new RegExp، QGT.* (إحصائيات المالك)،
 *   console.*، وأي شي بين «// i18n:off» و «// i18n:on» (صفحات المشرفين)، وأي سطر فيه «i18n:skip».
 * يحتاج acorn + acorn-walk (ACORN_DIR، الافتراضي /opt/node-tools/node_modules).
 */
const fs = require('fs'), path = require('path');
const DIR = process.env.ACORN_DIR || '/opt/node-tools/node_modules';
const acorn = require(path.join(DIR, 'acorn')), walk = require(path.join(DIR, 'acorn-walk'));
const AR = /[؀-ۿ]/;
const SKIP_METHODS = new Set(['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'split', 'match', 'matchAll', 'search', 'test', 'exec',
  'querySelector', 'querySelectorAll', 'closest', 'getItem', 'setItem', 'removeItem', 'getAttribute', 'hasAttribute', 'localeCompare', 'has', 'get', 'delete', 'add']);
const SKIP_OBJ = new Set(['QGT', 'console', 'JSON', 'localStorage', 'sessionStorage']);
const ARG0_ONLY = new Set(['setAttribute', 'set', 'replace', 'replaceAll']);   // الوسيط الأول اسم/مفتاح، والثاني نص يطلع للطالب

let SRC = '';
function analyze(src) {
  SRC = src;
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
  const lines = src.split('\n'), off = new Array(lines.length + 2).fill(false);
  let on = true; lines.forEach((l, i) => { if (/\/\/\s*i18n:off/.test(l)) on = false; if (/\/\/\s*i18n:on/.test(l)) on = true; off[i + 1] = !on || /i18n:skip/.test(l); });
  const hits = [], skipped = [];
  const arText = n => n.type === 'Literal' ? typeof n.value === 'string' && AR.test(n.value) : n.quasis.some(q => AR.test(q.value.cooked || q.value.raw));
  walk.fullAncestor(ast, (node, _st, anc) => {
    if (node.type !== 'Literal' && node.type !== 'TemplateLiteral') return;
    if (!arText(node)) return;
    const why = reason(node, anc[anc.length - 2], anc) || (off[node.loc.start.line] ? 'off' : '');
    if (why) { skipped.push({ node, why }); return; }
    hits.push(node);
  });
  return { hits, skipped };
}
function calleeInfo(c) {
  if (!c) return {};
  if (c.type === 'Identifier') return { fn: c.name };
  if (c.type === 'MemberExpression') return { obj: c.object.type === 'Identifier' ? c.object.name : '', prop: !c.computed && c.property.type === 'Identifier' ? c.property.name : '' };
  return {};
}
function reason(n, p, anc) {
  if (!p) return '';
  if (p.type === 'TaggedTemplateExpression' && p.quasi === n) return 'tagged';
  if (p.type === 'CallExpression' && p.callee.type === 'Identifier' && p.callee.name === '_T') return 'wrapped';
  if (p.type === 'Property' && p.key === n) return 'key';
  if (p.type === 'MemberExpression' && p.property === n) return 'member';
  if (p.type === 'MemberExpression' && p.object === n && !p.computed && p.property.type === 'Identifier' && (SKIP_METHODS.has(p.property.name) || p.property.name === 'split')) return 'list:' + p.property.name;   // 'أ ب ت'.split(' ') = قائمة
  if (p.type === 'BinaryExpression' && ['===', '!==', '==', '!=', 'in', 'instanceof'].includes(p.operator)) return 'compare';
  if (p.type === 'SwitchCase' && p.test === n) return 'case';
  if (p.type === 'ArrayExpression') {   // ['…', '…'].includes(x) أو new Set(['…']) = قائمة للمقارنة
    const g = anc[anc.length - 3], h = anc[anc.length - 4];
    if (g && g.type === 'MemberExpression' && g.object === p && h && h.type === 'CallExpression') { const c = calleeInfo(h.callee); if (c.prop && SKIP_METHODS.has(c.prop)) return 'list:' + c.prop; }
    if (g && g.type === 'NewExpression' && g.callee.type === 'Identifier' && (g.callee.name === 'Set' || g.callee.name === 'Map')) return 'set';
  }
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && p.arguments.includes(n)) {
    const c = calleeInfo(p.callee);
    if (c.fn === 'RegExp') return 'regexp';
    if (c.prop && ARG0_ONLY.has(c.prop)) { if (p.arguments[0] === n) return 'arg0:' + c.prop; }
    else if (c.prop && SKIP_METHODS.has(c.prop)) return 'method:' + c.prop;
  }
  for (let i = anc.length - 2; i >= 0; i--) {   // داخل QGT.ev(…) أو console.log(…) حتى لو بشرط
    const a = anc[i];
    // EN ? 'English' : 'عربي' → الفرع العربي ما يحتاج ترجمة
    if (a.type === 'ConditionalExpression' && a.alternate === anc[i + 1] && /^(EN_?|window\.QGL && QGL\.en|QGL\.en)$/.test(SRC.slice(a.test.start, a.test.end))) return 'ar-branch';
    if (a.type === 'CallExpression') { const c = calleeInfo(a.callee); if (SKIP_OBJ.has(c.obj)) return 'call:' + c.obj; }
    if (a.type === 'Property' && a.key === anc[i + 1]) return 'key';
  }
  return '';
}
function wrap(src) {
  const { hits, skipped } = analyze(src), ins = [];
  for (const n of hits) { if (n.type === 'Literal') { ins.push([n.start, '_T(']); ins.push([n.end, ')']); } else ins.push([n.start, '_T']); }
  ins.sort((a, b) => b[0] - a[0] || (a[1] === ')' ? -1 : 1));
  let out = src; for (const [pos, t] of ins) out = out.slice(0, pos) + t + out.slice(pos);
  return { out, hits, skipped };
}
if (require.main === module) {
  const file = process.argv[2], dry = process.argv.includes('--dry');
  if (!file) { console.error('usage: wrap.cjs <file.js> [--dry]'); process.exit(1); }
  const src = fs.readFileSync(file, 'utf8'), { out, hits, skipped } = wrap(src);
  const by = {}; skipped.forEach(s => by[s.why] = (by[s.why] || 0) + 1);
  console.log(`${file}: wrap ${hits.length} · skipped ${JSON.stringify(by)}`);
  if (process.argv.includes('--list-skipped')) skipped.filter(s => s.why !== 'off' && s.why !== 'wrapped' && s.why !== 'tagged').forEach(s => console.log('  skip ' + s.why + ' L' + s.node.loc.start.line + ': ' + src.slice(s.node.start, Math.min(s.node.end, s.node.start + 90)).replace(/\n/g, '⏎')));
  if (!dry) { acorn.parse(out, { ecmaVersion: 'latest', sourceType: 'script' }); fs.writeFileSync(file, out); }
}
module.exports = { analyze, wrap };
