'use strict';

// POST /api/chat
// Body: { provider, model, messages:[{role,content}], apiKey?, baseUrl?, system?, temperature?, maxTokens?, stream? }
//   stream:true  -> Server-Sent Events: data:{"delta":"..."} | {"think":"..."} | {"finish":"length"} | {"error":"..."} | {"done":true}
//   stream:false -> JSON: { text, provider, model, usage }

const { applyCors, sendJson, readJson, scrub, httpError } = require('./_lib/http');
const { normalizeMessages, buildChat, parseStream, parseReply, extractError } = require('./_lib/providers');
const { resolveCall, guardServerKey, upstreamError, describeFetchError } = require('./_lib/core');

function startSse(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();
  res.write(': ok\n\n');
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Gunakan metode POST.' });

  let apiKey = '';
  try {
    const body = await readJson(req);
    const call = await resolveCall(req, body);
    apiKey = call.apiKey;

    const { system, messages } = normalizeMessages(body.messages, body.system);
    const stream = body.stream === true;
    let maxTokens = body.maxTokens !== undefined ? body.maxTokens : body.max_tokens;
    if (call.limited) maxTokens = guardServerKey(req, { system, messages, maxTokens });

    const spec = buildChat(call.p, {
      apiKey,
      baseUrl: call.baseUrl,
      model: call.model,
      system,
      messages,
      temperature: body.temperature,
      maxTokens,
      stream,
    });

    // Putuskan koneksi ke provider kalau client menutup koneksi (tombol Stop / tab ditutup).
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    let upstream;
    try {
      upstream = await fetch(spec.url, {
        method: spec.method || 'POST',
        headers: spec.headers,
        body: spec.method === 'GET' ? undefined : JSON.stringify(spec.body),
        signal: controller.signal,
        redirect: 'manual',
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      throw httpError(502, `Tidak bisa menghubungi ${call.p.name}: ${describeFetchError(e)}`, { code: 'network' });
    }

    if (!upstream.ok) {
      const detail = extractError(await upstream.text().catch(() => ''));
      const m = upstreamError(call.p, upstream.status, scrub(detail, [apiKey]));
      return sendJson(res, m.status, { error: m.error, code: m.code, upstreamStatus: upstream.status });
    }

    // Beberapa API "kompatibel OpenAI" mengabaikan stream:true dan membalas JSON biasa.
    const ctype = String(upstream.headers.get('content-type') || '');
    const upstreamIsJson = /json/i.test(ctype) && !/event-stream/i.test(ctype);
    if (!stream || upstreamIsJson || call.p.noStream) {
      const json = await upstream.json().catch(() => null);
      if (!json) throw httpError(502, `Respons ${call.p.name} bukan JSON yang valid.`);
      const out = parseReply(call.p, json);
      if (!stream) return sendJson(res, 200, { text: out.text, provider: call.id, model: call.model, usage: out.usage });
      startSse(res);
      if (out.text) res.write(`data: ${JSON.stringify({ delta: out.text })}\n\n`);
      else res.write(`data: ${JSON.stringify({ error: `${call.p.name} tidak mengembalikan teks.` })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    // ---- Streaming (SSE) ----
    startSse(res);

    const alive = () => !res.writableEnded && !res.destroyed;
    const send = (o) => {
      if (alive()) res.write(`data: ${JSON.stringify(o)}\n\n`);
    };
    // Heartbeat supaya koneksi tidak dianggap idle saat model "berpikir" lama.
    const ping = setInterval(() => {
      if (alive()) res.write(': ping\n\n');
    }, 15000);

    try {
      let failed = false;
      for await (const ev of parseStream(call.p, upstream)) {
        if (ev.error) {
          send({ error: scrub(ev.error, [apiKey]) });
          failed = true;
          break;
        }
        send(ev);
      }
      if (!failed) send({ done: true });
    } catch (e) {
      if (!controller.signal.aborted) send({ error: scrub(`Stream terputus: ${describeFetchError(e)}`, [apiKey]) });
    } finally {
      clearInterval(ping);
      if (!res.writableEnded) res.end();
    }
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    const msg = e && e.status ? e.message : 'Terjadi kesalahan di server.';
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    sendJson(res, status, { error: scrub(msg, [apiKey]), code: e && e.status ? e.code : undefined });
  }
};
