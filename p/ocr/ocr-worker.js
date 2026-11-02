// 📷 قراءة نص صورة السؤال داخل المتصفح (Tesseract 5 · WebAssembly) — بدون رفع الصورة لأي خادم
let mod = null, api = null, ready = null;
const simd = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } })();
async function init(model) {
  const name = simd ? 'tesseract-core-simd-lstm' : 'tesseract-core-lstm';
  importScripts(name + '.js?v=7');
  mod = await TesseractCore({ locateFile: f => f + '?v=7' });
  const r = await fetch((model || 'eng-fast') + '.traineddata.gz?v=1'); if (!r.ok) throw new Error('model ' + r.status);
  let buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());   // لو الخادم فكّ الضغط بنفسه نستخدمه كما هو
  mod.FS.writeFile('eng.traineddata', buf);
  api = new mod.TessBaseAPI();
  if (api.Init(null, 'eng')) throw new Error('init');
  api.SetPageSegMode(6);   // كتلة نص واحدة (أنسب لصورة سؤال)
}
onmessage = async e => {
  const { id, buf, model } = e.data || {};
  try {
    if (!ready) ready = init(model);
    await ready;
    mod.FS.writeFile('/input', new Uint8Array(buf));
    api.SetImageFile();
    const text = api.GetUTF8Text();
    api.Clear();
    postMessage({ id, text });
  } catch (err) { ready = null; postMessage({ id, error: String((err && err.message) || err) }); }
};
