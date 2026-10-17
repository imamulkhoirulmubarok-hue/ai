'use strict';

// Registry provider + adapter untuk 4 "bahasa" API:
//   openai    -> /chat/completions (OpenAI, Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, dll.)
//   anthropic -> /messages
//   gemini    -> :streamGenerateContent
//   synox     -> GET /ai-chat/<path>?apikey=...&text=... (synoxcloud, respons JSON)
// Mau tambah provider baru yang kompatibel OpenAI? Cukup tambah satu objek di PROVIDERS.

const NON_CHAT = /(embed|whisper|tts|dall-e|moderation|transcribe|realtime|audio|rerank|guard|image|video|sora|speech|stable-diffusion|flux)/i;
const OPENAI_LEGACY = /^(davinci|babbage|curie|ada|text-|code-|gpt-3\.5-turbo-instruct|codex)/i;

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    env: ['OPENAI_API_KEY'],
    keyUrl: 'https://platform.openai.com/api-keys',
    example: 'gpt-4o-mini',
    maxTokensParam: 'max_completion_tokens',
    exclude: [NON_CHAT, OPENAI_LEGACY],
  },
  anthropic: {
    name: 'Claude',
    kind: 'anthropic',
    order: 2,
    featured: true,
    baseUrl: 'https://api.anthropic.com/v1',
    env: ['ANTHROPIC_API_KEY'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    example: 'claude-sonnet-5-5',
  },
  // Gemini 3 Pro lewat synoxcloud (khusus pemilik). Path dikunci di sini; key dari SYNOX_API_KEY.
  synoxgemini: {
    name: 'Gemini 3 Pro',
    kind: 'synox',
    access: 'owner',
    featured: true,
    order: 4,
    path: 'gemini-3-pro',
    baseUrl: 'https://api.synoxcloud.xyz/ai-chat',
    env: ['SYNOX_API_KEY'],
    keyUrl: '',
    example: 'gemini-3-pro',
    staticModels: ['gemini-3-pro'],
    noStream: true,
  },
  // ---- synoxcloud (https://api.synoxcloud.xyz) ------------------------------------
  // Path endpoint DIKUNCI di sini (bukan dari request). Key hanya dari env SYNOX_API_KEY.
  // Unlimited AI = publik. Claude Opus = milik pemilik (perlu ACCESS_PASSWORD).
  asynt: {
    name: 'Unlimited AI',
    kind: 'synox',
    access: 'public',
    featured: true,
    order: 1,
    path: 'asynt-ai',
    baseUrl: 'https://api.synoxcloud.xyz/ai-chat',
    env: ['SYNOX_API_KEY'],
    keyUrl: '',
    example: 'asynt-ai',
    staticModels: ['asynt-ai'],
    noStream: true,
  },
  synoxopus: {
    name: 'Claude Opus',
    kind: 'synox',
    access: 'owner',
    featured: true,
    order: 3,
    path: 'claude-opus-4.8',
    baseUrl: 'https://api.synoxcloud.xyz/ai-chat',
    env: ['SYNOX_API_KEY'],
    keyUrl: '',
    example: 'claude-opus-4.8',
    staticModels: ['claude-opus-4.8'],
    noStream: true,
  },
  gemini: {
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    keyUrl: 'https://aistudio.google.com/apikey',
    example: 'gemini-2.5-flash',
    exclude: [NON_CHAT, /(aqa|imagen|veo|native-audio|live)/i],
  },
  groq: {
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    env: ['GROQ_API_KEY'],
    keyUrl: 'https://console.groq.com/keys',
    example: 'llama-3.3-70b-versatile',
    exclude: [NON_CHAT, /playai/i],
  },
  openrouter: {
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    env: ['OPENROUTER_API_KEY'],
    keyUrl: 'https://openrouter.ai/keys',
    example: 'openai/gpt-4o-mini',
    headers: { 'X-Title': 'AnyKey AI' },
    exclude: [NON_CHAT],
  },
  mistral: {
    name: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    env: ['MISTRAL_API_KEY'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    example: 'mistral-small-latest',
    exclude: [NON_CHAT, /(ocr|moderation)/i],
  },
  deepseek: {
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    env: ['DEEPSEEK_API_KEY'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    example: 'deepseek-chat',
  },
  xai: {
    name: 'xAI (Grok)',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    env: ['XAI_API_KEY'],
    keyUrl: 'https://console.x.ai',
    example: 'grok-4',
    exclude: [NON_CHAT],
  },
  together: {
    name: 'Together AI',
    kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    env: ['TOGETHER_API_KEY'],
    keyUrl: 'https://api.together.ai/settings/api-keys',
    example: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    chatTypeOnly: true, // /models Together mengembalikan banyak tipe (image, embedding, dst.)
    exclude: [NON_CHAT],
  },
  perplexity: {
    name: 'Perplexity',
    kind: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    env: ['PERPLEXITY_API_KEY'],
    keyUrl: 'https://www.perplexity.ai/settings/api',
    example: 'sonar',
    // Perplexity tidak punya endpoint daftar model.
    staticModels: ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'],
  },
  cerebras: {
    name: 'Cerebras',
    kind: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    env: ['CEREBRAS_API_KEY'],
    keyUrl: 'https://cloud.cerebras.ai',
    example: 'llama-3.3-70b',
  },
  fireworks: {
    name: 'Fireworks AI',
    kind: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    env: ['FIREWORKS_API_KEY'],
    keyUrl: 'https://fireworks.ai/account/api-keys',
    example: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    exclude: [NON_CHAT],
  },
  nvidia: {
    name: 'NVIDIA NIM',
    kind: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    env: ['NVIDIA_API_KEY'],
    keyUrl: 'https://build.nvidia.com',
    example: 'meta/llama-3.3-70b-instruct',
    exclude: [NON_CHAT],
  },
  custom: {
    name: 'Custom (kompatibel OpenAI)',
    kind: 'openai',
    baseUrl: '',
    custom: true,
    keyOptional: true,
    env: ['CUSTOM_API_KEY'],
    keyUrl: '',
    example: '',
  },
};

// Urutan tombol: provider "featured" dulu (menurut `order`), sisanya mengikuti urutan di PROVIDERS.
function publicProviders() {
  const rank = (p) => (p.featured ? p.order || 50 : 1000);
  const list = Object.entries(PROVIDERS).sort(([, a], [, b]) => rank(a) - rank(b));
  return list.map(([id, p]) => ({
    id,
    name: p.name,
    kind: p.kind,
    access: p.access || 'byok',
    baseUrl: p.baseUrl || '',
    keyUrl: p.keyUrl || '',
    example: p.example || '',
    featured: !!p.featured,
    custom: !!p.custom,
    keyOptional: !!p.keyOptional,
  }));
}

// Override base URL lewat env, mis. OPENAI_BASE_URL (berguna untuk proxy / gateway sendiri).
function envBaseUrl(id) {
  return String(process.env[`${id.toUpperCase()}_BASE_URL`] || '').trim();
}

// Key milik server (env) dipakai menurut jenis aksesnya:
//   owner  -> hanya kalau pengunjung sudah masuk dengan ACCESS_PASSWORD. Tanpa password, tidak pernah.
//   public -> selalu boleh, karena memang dibuka untuk umum (dibatasi SERVER_KEY_* di core.js).
//   byok   -> provider lain: hanya kalau SHARE_SERVER_KEYS=1, atau pengunjung adalah pemilik.
function serverKey(p, { owner = false } = {}) {
  const access = p.access || 'byok';
  const shared = /^(1|true|yes|on)$/i.test(String(process.env.SHARE_SERVER_KEYS || ''));
  const allowed = access === 'owner' ? owner : access === 'public' ? true : owner || shared;
  if (!allowed) return '';
  for (const name of p.env || []) {
    if (process.env[name]) return String(process.env[name]).trim();
  }
  return '';
}

// ---- Util --------------------------------------------------------------------

const textOf = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x : (x && x.text) || '')).join('') : '';

const num = (v, min, max) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
};

// Rapikan riwayat chat: buang pesan kosong, gabung role beruntun, pastikan mulai dari "user".
// Pesan role "system" dikumpulkan ke satu string system prompt.
function normalizeMessages(messages, system) {
  if (!Array.isArray(messages)) {
    const e = new Error('Field "messages" harus berupa array.');
    e.status = 400;
    throw e;
  }
  const sys = [];
  if (typeof system === 'string' && system.trim()) sys.push(system.trim());
  const out = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const content = textOf(m.content);
    if (!content.trim()) continue;
    if (m.role === 'system') {
      sys.push(content.trim());
      continue;
    }
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length) {
    const e = new Error('Tidak ada pesan user yang bisa dikirim.');
    e.status = 400;
    throw e;
  }
  return { system: sys.join('\n\n'), messages: out };
}

function extractError(text) {
  if (!text) return '';
  const t = String(text).trim();
  if (!t || t[0] === '<') return '';
  try {
    let j = JSON.parse(t);
    if (Array.isArray(j)) j = j[0];
    if (!j) return '';
    const e = j.error !== undefined ? j.error : j;
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object') {
      return e.message || e.detail || j.message || j.detail || JSON.stringify(e).slice(0, 300);
    }
    return '';
  } catch (_) {
    return t.slice(0, 300);
  }
}

const errMsg = (e) => (typeof e === 'string' ? e : (e && (e.message || e.detail)) || JSON.stringify(e).slice(0, 300));

// ---- Parser SSE ----------------------------------------------------------------

function parseSseBlock(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const i = line.indexOf(':');
    const field = i < 0 ? line : line.slice(0, i);
    let val = i < 0 ? '' : line.slice(i + 1);
    if (val.startsWith(' ')) val = val.slice(1);
    if (field === 'event') event = val;
    else if (field === 'data') data.push(val);
  }
  return data.length ? { event, data: data.join('\n') } : null;
}

async function* sseEvents(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let m;
      while ((m = /\r?\n\r?\n/.exec(buf))) {
        const block = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        const ev = parseSseBlock(block);
        if (ev) yield ev;
      }
    }
    buf += dec.decode();
    if (buf.trim()) {
      const ev = parseSseBlock(buf);
      if (ev) yield ev;
    }
  } finally {
    try {
      reader.cancel().catch(() => {});
    } catch (_) {}
  }
}

// ---- API synoxcloud (GET, respons JSON) ----------------------------------------------
// Path endpoint dikunci di PROVIDERS. Nama parameter teks bisa diganti lewat env SYNOX_PROMPT_PARAM (bawaan "text").
const synoxParam = () => String(process.env.SYNOX_PROMPT_PARAM || '').trim() || 'text';

function synoxFail(message) {
  const e = new Error(message);
  e.status = 502;
  e.code = 'upstream_format';
  return e;
}

// API ini menerima satu teks, jadi riwayat digabung. Dipotong supaya URL tidak kepanjangan (pesan terakhir selalu ikut).
function synoxPrompt(a) {
  const msgs = a.messages;
  if (msgs.length === 1 && !a.system) return msgs[0].content;
  const budget = 1500;
  const lines = [];
  let used = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const line = `${m.role === 'user' ? 'User' : 'Asisten'}: ${m.content}`;
    if (lines.length && used + line.length > budget) break;
    lines.unshift(line);
    used += line.length;
  }
  const head = a.system ? `Instruksi: ${a.system.slice(0, 500)}\n\n` : '';
  return head + lines.join('\n\n');
}

// Ambil teks jawaban. Bentuk yang dikenali: {status, result:"..."}, {result:{text}}, atau gaya OpenAI (choices).
function synoxText(j, name = 'synoxcloud') {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw synoxFail(`Respons ${name} bukan objek JSON.`);
  if (j.status === false) throw synoxFail(String(j.message || j.error || `${name} menolak request.`));
  const pick = (v, depth) => {
    if (typeof v === 'string') return v.trim() ? v : '';
    if (!v || typeof v !== 'object' || depth > 3) return '';
    if (Array.isArray(v)) return pick(v[0], depth + 1);
    if (Array.isArray(v.choices) && v.choices[0]) {
      const s = pick(v.choices[0].message || v.choices[0], depth + 1);
      if (s) return s;
    }
    for (const k of ['result', 'text', 'answer', 'response', 'content', 'output', 'data', 'message']) {
      const s = pick(v[k], depth + 1);
      if (s) return s;
    }
    return '';
  };
  const text = pick(j, 0);
  if (!text) {
    const keys = Object.keys(j).slice(0, 8).join(', ') || '(kosong)';
    throw synoxFail(`Format respons ${name} belum dikenali (field: ${keys}). Kabari pengembang.`);
  }
  return text;
}

// ---- Adapter -------------------------------------------------------------------
// Event hasil parse (dinormalisasi): {delta} | {think} | {finish:'length'} | {error}

const ADAPTERS = {
  synox: {
    chat(p, a) {
      const u = new URL(`${a.baseUrl}/${p.path}`);
      u.searchParams.set('apikey', a.apiKey);
      u.searchParams.set(synoxParam(), synoxPrompt(a));
      return { url: u.toString(), method: 'GET', headers: { Accept: 'application/json' } };
    },
    async *parseStream() {
      yield { error: 'Provider ini tidak mendukung streaming.' };
    },
    parseJson(j, p) {
      return { text: synoxText(j, p && p.name) };
    },
    modelsReq() {
      throw new Error('Daftar model tidak tersedia untuk provider ini.');
    },
    parseModels() {
      return [];
    },
  },
  openai: {
    chat(p, a) {
      const msgs = a.system ? [{ role: 'system', content: a.system }, ...a.messages] : a.messages;
      const body = { model: a.model, messages: msgs, stream: !!a.stream };
      const t = num(a.temperature, 0, 2);
      if (t !== undefined) body.temperature = t;
      const mt = num(a.maxTokens, 1, 1000000);
      if (mt !== undefined) body[p.maxTokensParam || 'max_tokens'] = Math.floor(mt);
      const headers = { 'Content-Type': 'application/json', Accept: a.stream ? 'text/event-stream' : 'application/json', ...(p.headers || {}) };
      if (a.apiKey) headers.Authorization = `Bearer ${a.apiKey}`;
      return { url: `${a.baseUrl}/chat/completions`, headers, body };
    },
    async *parseStream(resp) {
      for await (const { data } of sseEvents(resp.body)) {
        if (data.trim() === '[DONE]') return;
        let j;
        try {
          j = JSON.parse(data);
        } catch (_) {
          continue;
        }
        if (j.error) {
          yield { error: errMsg(j.error) };
          return;
        }
        const c = j.choices && j.choices[0];
        if (!c) continue;
        const d = c.delta || {};
        const think = d.reasoning_content || d.reasoning;
        if (typeof think === 'string' && think) yield { think };
        const text = textOf(d.content);
        if (text) yield { delta: text };
        if (c.finish_reason === 'length') yield { finish: 'length' };
      }
    },
    parseJson(j) {
      const m = j.choices && j.choices[0] && j.choices[0].message;
      return { text: textOf(m && m.content), usage: j.usage };
    },
    modelsReq(p, a) {
      const headers = { Accept: 'application/json', ...(p.headers || {}) };
      if (a.apiKey) headers.Authorization = `Bearer ${a.apiKey}`;
      return { url: `${a.baseUrl}/models`, headers };
    },
    parseModels(j, p) {
      const list = Array.isArray(j) ? j : j.data || j.models || [];
      return list
        .filter((m) => m && (m.id || m.name) && (!p.chatTypeOnly || !m.type || m.type === 'chat'))
        .map((m) => ({ id: String(m.id || m.name), name: m.name && m.name !== m.id ? String(m.name) : undefined, created: Number(m.created) || 0 }));
    },
  },

  anthropic: {
    chat(p, a) {
      const body = { model: a.model, max_tokens: Math.floor(num(a.maxTokens, 1, 1000000) || 4096), messages: a.messages, stream: !!a.stream };
      if (a.system) body.system = a.system;
      const t = num(a.temperature, 0, 1);
      if (t !== undefined) body.temperature = t;
      const headers = {
        'Content-Type': 'application/json',
        Accept: a.stream ? 'text/event-stream' : 'application/json',
        'x-api-key': a.apiKey,
        'anthropic-version': '2023-06-01',
      };
      return { url: `${a.baseUrl}/messages`, headers, body };
    },
    async *parseStream(resp) {
      for await (const { event, data } of sseEvents(resp.body)) {
        let j;
        try {
          j = JSON.parse(data);
        } catch (_) {
          continue;
        }
        const type = j.type || event;
        if (type === 'content_block_delta') {
          const d = j.delta || {};
          if (d.type === 'text_delta' && d.text) yield { delta: d.text };
          else if (d.type === 'thinking_delta' && d.thinking) yield { think: d.thinking };
        } else if (type === 'message_delta') {
          if (j.delta && j.delta.stop_reason === 'max_tokens') yield { finish: 'length' };
        } else if (type === 'error') {
          yield { error: errMsg(j.error || j) };
          return;
        } else if (type === 'message_stop') {
          return;
        }
      }
    },
    parseJson(j) {
      const text = (j.content || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('');
      return { text, usage: j.usage };
    },
    modelsReq(p, a) {
      return {
        url: `${a.baseUrl}/models?limit=1000`,
        headers: { Accept: 'application/json', 'x-api-key': a.apiKey, 'anthropic-version': '2023-06-01' },
      };
    },
    parseModels(j) {
      return (j.data || []).filter((m) => m && m.id).map((m) => ({ id: String(m.id), name: m.display_name || undefined, created: 0 }));
    },
  },

  gemini: {
    chat(p, a) {
      const body = {
        contents: a.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      };
      if (a.system) body.systemInstruction = { parts: [{ text: a.system }] };
      const gc = {};
      const t = num(a.temperature, 0, 2);
      if (t !== undefined) gc.temperature = t;
      const mt = num(a.maxTokens, 1, 1000000);
      if (mt !== undefined) gc.maxOutputTokens = Math.floor(mt);
      if (Object.keys(gc).length) body.generationConfig = gc;
      const model = encodeURI(a.model.replace(/^models\//, ''));
      const url = `${a.baseUrl}/models/${model}:${a.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
      return {
        url,
        headers: { 'Content-Type': 'application/json', Accept: a.stream ? 'text/event-stream' : 'application/json', 'x-goog-api-key': a.apiKey },
        body,
      };
    },
    async *parseStream(resp) {
      for await (const { data } of sseEvents(resp.body)) {
        let j;
        try {
          j = JSON.parse(data);
        } catch (_) {
          continue;
        }
        if (j.error) {
          yield { error: errMsg(j.error) };
          return;
        }
        if (j.promptFeedback && j.promptFeedback.blockReason) {
          yield { error: `Prompt diblokir oleh Gemini (${j.promptFeedback.blockReason}).` };
          return;
        }
        const c = j.candidates && j.candidates[0];
        if (!c) continue;
        for (const part of (c.content && c.content.parts) || []) {
          if (!part || !part.text) continue;
          if (part.thought) yield { think: part.text };
          else yield { delta: part.text };
        }
        if (c.finishReason === 'MAX_TOKENS') yield { finish: 'length' };
        else if (c.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(c.finishReason)) {
          yield { error: `Respons dihentikan oleh Gemini (${c.finishReason}).` };
          return;
        }
      }
    },
    parseJson(j) {
      if (j.promptFeedback && j.promptFeedback.blockReason) {
        const e = new Error(`Prompt diblokir oleh Gemini (${j.promptFeedback.blockReason}).`);
        e.status = 422;
        throw e;
      }
      const c = j.candidates && j.candidates[0];
      const parts = (c && c.content && c.content.parts) || [];
      return { text: parts.filter((x) => x && x.text && !x.thought).map((x) => x.text).join(''), usage: j.usageMetadata };
    },
    modelsReq(p, a) {
      return { url: `${a.baseUrl}/models?pageSize=1000`, headers: { Accept: 'application/json', 'x-goog-api-key': a.apiKey } };
    },
    parseModels(j) {
      return (j.models || [])
        .filter((m) => m && m.name && (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')))
        .map((m) => ({ id: String(m.name).replace(/^models\//, ''), name: m.displayName || undefined, created: 0 }));
    },
  },
};

// ---- API publik ------------------------------------------------------------------

const buildChat = (p, a) => ADAPTERS[p.kind].chat(p, a);
const parseStream = (p, resp) => ADAPTERS[p.kind].parseStream(resp);
const parseReply = (p, json) => ADAPTERS[p.kind].parseJson(json, p);
const buildModelsReq = (p, a) => ADAPTERS[p.kind].modelsReq(p, a);

function parseModels(p, json) {
  let list = ADAPTERS[p.kind].parseModels(json, p);
  for (const re of p.exclude || []) list = list.filter((m) => !re.test(m.id));
  const seen = new Set();
  list = list.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));
  // Kalau semua model punya tanggal rilis -> terbaru dulu. Kalau tidak, pertahankan urutan dari provider.
  const hasDates = list.length > 0 && list.every((m) => m.created > 0);
  if (hasDates) list.sort((a, b) => b.created - a.created);
  return list.map(({ id, name }) => (name ? { id, name } : { id }));
}

module.exports = {
  PROVIDERS,
  publicProviders,
  envBaseUrl,
  serverKey,
  normalizeMessages,
  extractError,
  buildChat,
  parseStream,
  parseReply,
  buildModelsReq,
  parseModels,
  sseEvents,
};
