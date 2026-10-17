'use strict';

// POST /api/models
// Body: { provider, apiKey?, baseUrl? }  ->  { models: [{ id, name? }] }

const { applyCors, sendJson, readJson, scrub, httpError } = require('./_lib/http');
const { buildModelsReq, parseModels, extractError } = require('./_lib/providers');
const { resolveCall, upstreamError, describeFetchError } = require('./_lib/core');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Gunakan metode POST.' });

  let apiKey = '';
  try {
    const body = await readJson(req);
    const call = await resolveCall(req, body, { needModel: false });
    apiKey = call.apiKey;

    if (call.p.staticModels) {
      return sendJson(res, 200, { models: call.p.staticModels.map((id) => ({ id })), static: true });
    }

    const spec = buildModelsReq(call.p, { apiKey, baseUrl: call.baseUrl });
    let upstream;
    try {
      upstream = await fetch(spec.url, {
        headers: spec.headers,
        signal: AbortSignal.timeout(20000),
        redirect: 'manual',
      });
    } catch (e) {
      throw httpError(502, `Tidak bisa menghubungi ${call.p.name}: ${describeFetchError(e)}`, { code: 'network' });
    }

    if (!upstream.ok) {
      const detail = extractError(await upstream.text().catch(() => ''));
      const m = upstreamError(call.p, upstream.status, scrub(detail, [apiKey]));
      return sendJson(res, m.status, { error: m.error, code: m.code, upstreamStatus: upstream.status });
    }

    const json = await upstream.json().catch(() => null);
    if (!json) {
      throw httpError(502, 'Daftar model bukan JSON yang valid. Untuk provider Custom, pastikan Base URL benar (biasanya berakhiran /v1).');
    }
    return sendJson(res, 200, { models: parseModels(call.p, json) });
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    const msg = e && e.status ? e.message : 'Terjadi kesalahan di server.';
    sendJson(res, status, { error: scrub(msg, [apiKey]), code: e && e.status ? e.code : undefined });
  }
};
