'use strict';

// Helper HTTP umum: response JSON, CORS, body parser, kontrol akses, dan guard SSRF.
// Hanya memakai API inti Node (tanpa dependency) supaya jalan di Vercel maupun server Node biasa.

const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');

const truthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));

function httpError(status, message, extra) {
  const e = new Error(message);
  e.status = status;
  if (extra) Object.assign(e, extra);
  return e;
}

function sendJson(res, status, obj) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

// CORS opsional lewat env CORS_ORIGIN ("*" atau daftar origin dipisah koma).
// Return true kalau request sudah selesai ditangani (preflight OPTIONS).
function applyCors(req, res) {
  const allowed = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length) {
    const origin = req.headers.origin;
    if (allowed.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-Password');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = allowed.length ? 204 : 405;
    res.end();
    return true;
  }
  return false;
}

// Baca body JSON. Di Vercel, req.body sudah diparse; di server lokal dibaca dari stream.
async function readJson(req, limit = 5 * 1024 * 1024) {
  let pre;
  try {
    pre = req.body; // di Vercel getter ini bisa melempar error kalau JSON rusak
  } catch (_) {
    throw httpError(400, 'Body bukan JSON yang valid.');
  }
  if (pre !== undefined && pre !== null) {
    if (typeof pre === 'object' && !Buffer.isBuffer(pre)) return pre;
    const s = Buffer.isBuffer(pre) ? pre.toString('utf8') : String(pre);
    return parseJson(s);
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw httpError(413, 'Body terlalu besar.');
    chunks.push(c);
  }
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}

function parseJson(s) {
  if (!s || !s.trim()) return {};
  try {
    return JSON.parse(s);
  } catch (_) {
    throw httpError(400, 'Body bukan JSON yang valid.');
  }
}

// ---- Kontrol akses (opsional) ----------------------------------------------
// Kalau env ACCESS_PASSWORD diisi, semua endpoint API butuh header X-Access-Password.

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function passwordRequired() {
  return !!process.env.ACCESS_PASSWORD;
}

function isAuthorized(req) {
  const pw = process.env.ACCESS_PASSWORD;
  if (!pw) return true;
  const raw = String(req.headers['x-access-password'] || '');
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw); // browser mengirim versi URL-encoded (aman untuk karakter non-ASCII)
  } catch (_) {}
  return safeEqual(raw, pw) || safeEqual(decoded, pw);
}

// Pemilik = sudah memasukkan password yang cocok. Tanpa ACCESS_PASSWORD tidak ada pemilik (fail closed).
function isOwner(req) {
  return passwordRequired() && isAuthorized(req);
}

function requireAccess(req, res) {
  if (isAuthorized(req)) return true;
  sendJson(res, 401, { error: 'Password akses diperlukan atau salah.', code: 'password_required' });
  return false;
}

function bearer(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  return m ? m[1].trim() : '';
}

// ---- Guard SSRF untuk Base URL custom -----------------------------------------

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && p[2] === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip) {
  const x = ip.toLowerCase();
  if (x === '::' || x === '::1') return true;
  let m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (m) return isPrivateIPv4(m[1]);
  m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
  if (m) {
    const hi = parseInt(m[1], 16);
    const lo = parseInt(m[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^(fc|fd)/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x);
}

function isPrivateIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true;
}

// Pastikan URL publik (bukan localhost / jaringan privat). Dilewati kalau ALLOW_PRIVATE_URLS=1.
async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    throw httpError(400, 'Base URL tidak valid.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError(400, 'Base URL harus diawali http:// atau https://');
  if (u.username || u.password) throw httpError(400, 'Base URL tidak boleh berisi username/password.');
  if (truthy(process.env.ALLOW_PRIVATE_URLS)) return u;

  const host = u.hostname.replace(/^\[|\]$/g, '');
  const blockedName = /(^|\.)(localhost|local|internal|localdomain)$/i.test(host);
  const blockedMsg = 'Base URL mengarah ke alamat lokal/privat dan diblokir demi keamanan.';
  if (blockedName) throw httpError(400, blockedMsg);

  let ips;
  if (net.isIP(host)) {
    ips = [host];
  } else {
    try {
      ips = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch (_) {
      throw httpError(400, `Host "${host}" tidak ditemukan.`);
    }
  }
  if (!ips.length || ips.some(isPrivateIp)) throw httpError(400, blockedMsg);
  return u;
}

// Hapus rahasia (API key) dari teks error sebelum dikirim ke client.
function scrub(text, secrets) {
  let s = String(text == null ? '' : text);
  for (const k of secrets || []) {
    if (k && String(k).length >= 4) s = s.split(String(k)).join('***');
  }
  return s;
}

module.exports = {
  truthy,
  httpError,
  sendJson,
  applyCors,
  readJson,
  passwordRequired,
  isAuthorized,
  isOwner,
  requireAccess,
  bearer,
  assertPublicUrl,
  isPrivateIp,
  scrub,
};
