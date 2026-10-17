'use strict';

// Server lokal / hosting Node biasa (Termux, VPS, Pterodactyl, Railway, Render, dll.):
//   npm start        atau        node local/server.js
//
// File ini sengaja ada di folder local/, BUKAN di root repo. Di Vercel file ini tidak dipakai
// (Vercel melayani public/ sebagai situs statis dan api/ sebagai fungsi serverless).
// Jangan pindahkan ke root sebagai server.js / index.js / app.js: Vercel bisa menganggapnya
// sebagai server utama dan mengambil alih semua request /api/*.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Loader .env sederhana (tanpa dependency). Variabel yang sudah ada di environment tidak ditimpa.
const { parseEnv } = require('./dotenv');
function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return;
  }
  for (const [k, v] of Object.entries(parseEnv(text))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnv(path.join(ROOT, '.env'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// Pakai header keamanan yang sama dengan vercel.json supaya perilaku lokal = produksi.
const SECURITY_HEADERS = {};
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rule = (cfg.headers || []).find((h) => h.source === '/(.*)');
  for (const h of (rule && rule.headers) || []) SECURITY_HEADERS[h.key] = h.value;
} catch (_) {}

function getApiHandler(name) {
  if (!/^[a-z0-9-]+$/i.test(name)) return null;
  const file = path.join(ROOT, 'api', `${name}.js`);
  return fs.existsSync(file) ? require(file) : null;
}

function serveStatic(pathname, res) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (_) {
    res.statusCode = 400;
    return res.end('Bad request');
  }
  let file = path.resolve(PUBLIC_DIR, '.' + path.normalize('/' + rel));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const data = fs.readFileSync(file);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  } catch (_) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const handler = getApiHandler(url.pathname.slice(5).replace(/\/+$/, ''));
      if (!handler) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Endpoint tidak ditemukan.' }));
      }
      return await handler(req, res);
    }
    serveStatic(url.pathname, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`AnyKey AI jalan di http://localhost:${PORT}`);
  if (process.env.ACCESS_PASSWORD) console.log('ACCESS_PASSWORD aktif: API butuh password.');
});
