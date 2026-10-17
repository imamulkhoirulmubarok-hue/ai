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
    needsSession: true,
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
    promptParam: 'pesan',
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
