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
