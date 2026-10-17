'use strict';

// GET /api/config -> daftar provider + status password akses.
// "serverKeys" / "serverBaseUrls" (provider mana yang sudah disiapkan owner di env) hanya dikirim
// hanya untuk provider yang benar-benar bisa dipakai pengunjung ini. Isinya cuma true/false,
// tidak pernah key atau URL-nya.

const fs = require('node:fs');
const path = require('node:path');

// Modul bersama dimuat di dalam try/catch. Kalau ada file di api/_lib yang tidak ikut ke-upload ke GitHub
// (atau isinya rusak), Vercel biasanya cuma menampilkan "500 FUNCTION_INVOCATION_FAILED" tanpa petunjuk.
// Dengan ini endpoint tetap menjawab dan menyebut file mana yang bermasalah; layar utama menampilkannya.
let lib = null;
let loadError = null;
try {
  lib = { http: require('./_lib/http'), providers: require('./_lib/providers') };
  require('./_lib/core'); // dipakai chat.js dan models.js; dicek di sini supaya masalahnya ketahuan lebih awal
} catch (e) {
  loadError = e;
}

const firstLine = (s) => String(s || '').split('\n')[0].trim().slice(0, 240);

function sendBroken(res, e) {
  let present = null;
  try {
    present = fs.readdirSync(path.join(__dirname, '_lib')).sort();
  } catch (_) {}
  let detail = `${(e && e.name) || 'Error'}: ${firstLine(e && e.message)}`;
  if (e && e.name === 'SyntaxError') detail += ` (${firstLine(e.stack)})`;
  detail += present ? ` | isi api/_lib: ${present.join(', ') || '(kosong)'}` : ' | folder api/_lib tidak ada';
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    error: 'Server API gagal dimuat.',
    code: 'backend_load_failed',
    detail: detail.slice(0, 500),
    expected: 'api/_lib harus berisi core.js, http.js, dan providers.js',
  }));
}

module.exports = function handler(req, res) {
  if (loadError) return sendBroken(res, loadError);
  const { applyCors, sendJson, passwordRequired, isOwner } = lib.http;
  const { PROVIDERS, publicProviders, serverKey, envBaseUrl } = lib.providers;

  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Gunakan metode GET.' });

  // owner = sudah masuk dengan password pemilik. Provider khusus pemilik ditandai "locked" untuk yang belum masuk.
  const owner = isOwner(req);
  const serverKeys = {};
  const serverBaseUrls = {};
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (serverKey(p, { owner })) serverKeys[id] = true;
    if (p.custom && serverKeys[id] && envBaseUrl(id)) serverBaseUrls[id] = true;
  }
  const providers = publicProviders().map((p) => ({ ...p, locked: p.access === 'owner' && !owner }));
  sendJson(res, 200, {
    app: 'AnyKey AI',
    passwordRequired: passwordRequired(),
    authorized: owner,
    providers,
    serverKeys,
    serverBaseUrls,
  });
};
