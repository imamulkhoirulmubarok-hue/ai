'use strict';

// Logika bersama untuk /api/chat dan /api/models: validasi provider, API key, base URL,
// dan pengaman untuk key milik server.

const { PROVIDERS, envBaseUrl, serverKey } = require('./providers');
const { httpError, assertPublicUrl, bearer, isOwner, passwordRequired } = require('./http');

function cleanKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function parseEnvUrl(id, raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
    return raw.replace(/\/+$/, '');
  } catch (_) {
    throw httpError(500, `${id.toUpperCase()}_BASE_URL di environment server tidak valid.`, { code: 'bad_server_config' });
  }
}

async function resolveCall(req, body, { needModel = true } = {}) {
  const id = String((body && body.provider) || '').toLowerCase();
  const p = PROVIDERS[id];
  if (!p) throw httpError(400, `Provider "${id || '?'}" tidak dikenal.`);

  // Provider khusus pemilik: hanya bisa dipakai setelah password pemilik cocok. Tanpa ACCESS_PASSWORD = ditutup.
  const owner = isOwner(req);
  if (p.access === 'owner') {
    if (!passwordRequired()) throw httpError(403, `${p.name} belum aktif. Isi ACCESS_PASSWORD di environment server dulu.`, { code: 'owner_disabled' });
    if (!owner) throw httpError(401, `${p.name} khusus pemilik. Masukkan password situs untuk memakainya.`, { code: 'password_required' });
  }

  // Urutan prioritas key: dari request (body / header Authorization) -> key milik server (env).
  const clientKey = cleanKey(body.apiKey) || cleanKey(bearer(req));
  const srvKey = clientKey ? '' : serverKey(p, { owner });
  const usedServerKey = !!srvKey;
  const limited = usedServerKey && !owner; // pemilik yang sudah login tidak kena batas pemakaian
  const apiKey = clientKey || srvKey;

  if (/[^\x21-\x7E]/.test(apiKey)) {
    throw httpError(400, 'API key mengandung spasi atau karakter yang tidak valid. Coba tempel ulang key-nya.', { code: 'bad_key' });
  }
  if (!apiKey && !p.keyOptional) {
    throw httpError(400, `API key ${p.name} belum diisi.`, { code: 'no_key' });
  }

  const envUrl = envBaseUrl(id);
  let baseUrl;
  if (p.custom) {
    if (usedServerKey) {
      // PENTING: key milik server hanya boleh dikirim ke base URL milik server.
      // Kalau client boleh menentukan base URL, siapa pun bisa mencuri key server lewat host buatannya.
      if (!envUrl) {
        throw httpError(400, `Base URL ${p.name} belum diatur di server (env ${id.toUpperCase()}_BASE_URL).`, { code: 'no_base_url' });
      }
      baseUrl = parseEnvUrl(id, envUrl);
    } else {
      const fromClient = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
      const raw = fromClient || envUrl;
      if (!raw) throw httpError(400, `Base URL ${p.name} wajib diisi (contoh: https://api.contoh.com/v1).`, { code: 'no_base_url' });
      if (fromClient) {
        // Base URL dari client divalidasi (anti-SSRF); yang dari env dianggap tepercaya.
        const u = await assertPublicUrl(raw);
        baseUrl = raw.replace(/\/+$/, '');
        if (u.pathname === '/' || u.pathname === '') baseUrl += '/v1';
      } else {
        baseUrl = parseEnvUrl(id, raw);
      }
    }
  } else {
    // Provider bawaan: base URL dikunci (client tidak boleh menggantinya).
    baseUrl = (envUrl || p.baseUrl).replace(/\/+$/, '');
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (needModel && !model) throw httpError(400, 'Model belum dipilih.');

  return { id, p, apiKey, baseUrl, model, usedServerKey, limited };
}

// ---- Pembatas untuk key milik server ---------------------------------------------
// Best-effort: di serverless, hitungan disimpan di memori per instance (bukan pengganti limit di dashboard provider).

const hits = new Map();

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || String(req.headers['x-real-ip'] || '') || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Baca angka dari env. Toleran: "40", " 40 ", dan "40 # komentar" (kalau komentar ikut terbawa) -> 40.
// Nilai yang bukan angka -> pakai bawaan.
const envNum = (name, def) => {
  const raw = process.env[name];
  if (raw === undefined) return def;
  const m = /^\s*(-?\d+(?:\.\d+)?)(?:\s|$)/.exec(String(raw));
  if (!m) return def;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : def;
};

// Dipanggil sebelum request ke provider. Melempar error 429/413 kalau melewati batas,
// dan mengembalikan maxTokens yang sudah dibatasi.
function guardServerKey(req, { system, messages, maxTokens }) {
  const limit = envNum('SERVER_KEY_LIMIT', 40); // request per jam per IP; 0 = nonaktif
  if (limit > 0) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const ip = clientIp(req);
    const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= limit) {
      throw httpError(429, `Batas pemakaian key server tercapai (${limit} pesan/jam). Coba lagi nanti, atau isi API key sendiri di Pengaturan.`, {
        code: 'server_key_limit',
      });
    }
    list.push(now);
    hits.set(ip, list);
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= windowMs) hits.delete(k);
    }
  }

  const maxChars = envNum('SERVER_KEY_MAX_INPUT_CHARS', 60000);
  if (maxChars > 0) {
    const total = messages.reduce((n, m) => n + m.content.length, (system || '').length);
    if (total > maxChars) {
      throw httpError(413, `Percakapan terlalu panjang untuk key server (maks ${maxChars} karakter). Mulai chat baru, atau pakai API key sendiri.`, {
        code: 'server_key_too_long',
      });
    }
  }

  const cap = envNum('SERVER_KEY_MAX_TOKENS', 4096);
  if (cap > 0) {
    const asked = Number(maxTokens);
    return Math.min(asked > 0 ? asked : cap, cap);
  }
  return maxTokens;
}

// Terjemahkan status error dari provider ke pesan yang ramah.
function upstreamError(p, status, detail) {
  const tail = detail ? ` — ${detail}` : '';
  if (status === 401 || status === 403) {
    return { status: 401, code: 'upstream_auth', error: `API key ditolak oleh ${p.name} (${status}). Cek lagi key-nya${tail}` };
  }
  if (status === 404) return { status: 404, code: 'upstream_not_found', error: `Model atau endpoint tidak ditemukan di ${p.name}${tail}` };
  if (status === 429) {
    const hint = p.access === 'public' ? ' Coba lagi nanti, atau isi API key sendiri di Pengaturan.' : '';
    return { status: 429, code: 'upstream_rate', error: `Rate limit atau kuota ${p.name} habis${tail}${hint}` };
  }
  if (status >= 300 && status < 400) return { status: 502, code: 'upstream_redirect', error: `${p.name} mengalihkan request (redirect). Cek Base URL-nya.` };
  if (status >= 500) return { status: 502, code: 'upstream_down', error: `${p.name} sedang bermasalah (${status})${tail}` };
  return { status: 400, code: 'upstream_rejected', error: `Request ditolak ${p.name} (${status})${tail}` };
}

function describeFetchError(e) {
  const c = e && e.cause;
  return (c && (c.code || c.message)) || (e && e.message) || 'unknown';
}

module.exports = { resolveCall, guardServerKey, upstreamError, describeFetchError };
