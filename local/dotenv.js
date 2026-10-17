'use strict';

// Pembaca file .env sederhana (tanpa dependency) — dipakai local/server.js untuk jalan lokal.
// Mendukung: KEY=nilai, KEY="nilai", KEY='nilai', awalan "export ", baris komentar (#),
// dan komentar di akhir baris (spasi lalu #) untuk nilai tanpa kutip.
function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2];
    const q = v[0];
    const close = q === '"' || q === "'" ? v.indexOf(q, 1) : -1;
    if (close > 0) v = v.slice(1, close); // nilai berkutip: ambil sampai kutip penutup, sisanya (komentar) dibuang
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
}

module.exports = { parseEnv };
