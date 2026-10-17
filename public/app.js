/* AnyKey AI — logika antarmuka (tanpa framework, tanpa build). */
(() => {
  'use strict';

  /* ================================================================ util */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const coarse = () => window.matchMedia('(pointer: coarse)').matches;
  const hostOf = (u) => { try { return new URL(u).hostname; } catch (_) { return u; } };

  // Pembuat elemen kecil. "html" hanya dipakai untuk markup yang dibuat sendiri / sudah disanitasi.
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const ICONS = {
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    key: '<circle cx="8" cy="12" r="4.5"/><path d="M12.5 12H21M17.5 12v4M21 12v3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sliders: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
    send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    down: '<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const hydrateIcons = (root = document) => $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22); });

  /* ================================================================ penyimpanan */
  // Semua akses storage dibungkus try/catch: bisa gagal di mode privat / saat dibuka dari file.
  const NS = 'anykey:v1:';
  const mem = Object.create(null);
  const area = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (_) { return null; } };
  const kv = {
    get(key, kind = 'local') {
      try { const a = area(kind); if (a) { const v = a.getItem(NS + key); if (v !== null) return v; } } catch (_) {}
      return mem[kind + ':' + key] !== undefined ? mem[kind + ':' + key] : null;
    },
    set(key, val, kind = 'local') {
      mem[kind + ':' + key] = val;
      try { const a = area(kind); if (!a) return false; a.setItem(NS + key, val); return true; } catch (_) { return false; }
    },
    del(key, kind = 'local') {
      delete mem[kind + ':' + key];
      try { const a = area(kind); if (a) a.removeItem(NS + key); } catch (_) {}
    },
  };
  const readJson = (key, def, kind) => { try { const v = kv.get(key, kind); return v ? JSON.parse(v) : def; } catch (_) { return def; } };
  // Field berawalan "_" adalah state sementara dan tidak disimpan.
  const writeJson = (key, val, kind) => kv.set(key, JSON.stringify(val, (k, v) => (k && k[0] === '_' ? undefined : v)), kind);

  /* ================================================================ state */
  const DEFAULTS = { provider: 'asynt', models: {}, baseUrls: {}, system: '', temperature: '', maxTokens: '', theme: 'auto', remember: true };
  const settings = Object.assign({}, DEFAULTS, readJson('settings', {}));
  if (!settings.models || typeof settings.models !== 'object') settings.models = {};
  if (!settings.baseUrls || typeof settings.baseUrls !== 'object') settings.baseUrls = {};
  const keyArea = () => (settings.remember ? 'local' : 'session');
  const keys = readJson('keys', {}, keyArea());

  function sanitizeChats(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
      .map((c) => {
        c.messages = c.messages.filter(
          (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && (m.role === 'user' || m.content || m.error || m.stopped || m.think)
        );
        c.title = String(c.title || 'Chat baru');
        c.updatedAt = Number(c.updatedAt) || Date.now();
        return c;
      })
      .slice(0, 60);
  }
  let chats = sanitizeChats(readJson('chats', []));
  let activeId = readJson('active', null);
  if (!chats.some((c) => c.id === activeId)) activeId = null;
  let accessPw = kv.get('pw', 'session') || '';

  const S = {
    config: null, busy: false, abort: null, live: null, stick: true, menuOpen: false,
    lists: readJson('models', {}), loading: {}, autoTried: {}, readyKey: '',
  };

  const saveSettings = () => writeJson('settings', settings);
  const saveKeys = () => writeJson('keys', keys, keyArea());
  let saveWarned = false;
  function saveChats() {
    chats.sort((a, b) => b.updatedAt - a.updatedAt);
    if (chats.length > 60) chats.length = 60;
    const ok = writeJson('chats', chats);
    kv.set('active', JSON.stringify(activeId));
    if (!ok && !saveWarned) {
      saveWarned = true;
      toast('Riwayat chat tidak bisa disimpan di browser ini (penyimpanan penuh atau diblokir).', 4500);
    }
  }

  /* ================================================================ provider */
  const providers = () => S.config.providers;
  const findProv = (id) => providers().find((p) => p.id === id);
  const prov = () => findProv(settings.provider) || providers()[0];
  const keyOf = (id) => String(keys[id] || '').trim();
  const baseOf = (id) => String(settings.baseUrls[id] || '').trim();
  const modelOf = (p) => String(settings.models[p.id] || p.example || '').trim();
  const hasSrvKey = (id) => !!(S.config.serverKeys || {})[id];
  const hasSrvBase = (id) => !!(S.config.serverBaseUrls || {})[id];
  // Key server hanya bisa dipakai kalau (untuk provider custom) server juga punya Base URL-nya.
  const srvKeyUsable = (p) => hasSrvKey(p.id) && (!p.custom || hasSrvBase(p.id));

  function readiness(p) {
    const keyOk = !!(keyOf(p.id) || srvKeyUsable(p) || p.keyOptional);
    const baseOk = !p.custom || !!(baseOf(p.id) || hasSrvBase(p.id));
    const modelOk = !!modelOf(p);
    return { keyOk, baseOk, modelOk, all: keyOk && baseOk && modelOk };
  }

  const shortName = (p) => p.name.replace(/\s*\(.*?\)\s*/g, '').replace(/^Google\s+/, '').replace(/\s+(AI|NIM)$/, '').trim() || p.name;
  const ENAMEL = ['pine', 'plum', 'sky', 'brick', 'steel'];
  function capClass(p) {
    if (p.id === 'anthropic' || p.id === 'synoxopus') return 'k-cobalt';
    if (p.id === 'synoxgemini') return 'k-amber';
    if (p.custom) return 'k-steel';
    let n = 0;
    for (const ch of p.id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    return 'k-' + ENAMEL[n % ENAMEL.length];
  }

  function applyTint() {
    const root = document.documentElement;
    Array.from(root.classList).filter((c) => c.startsWith('k-')).forEach((c) => root.classList.remove(c));
    root.classList.add(capClass(prov()));
  }
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    kv.set('theme', settings.theme);
    $$('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === settings.theme)));
  }

  /* ================================================================ UI kecil */
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  const announce = (msg) => { $('#announce').textContent = msg; };

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (_) {}
    try {
      const ta = h('textarea', { readonly: '', 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }
  function flashBtn(btn, label) {
    const old = btn.innerHTML;
    btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) btn.innerHTML = old; }, 1300);
  }
  const accessHeaders = () => (accessPw ? { 'X-Access-Password': encodeURIComponent(accessPw) } : {});

  /* ================================================================ keyring (pilih AI) */
  function keyButton(p) {
    const props = {
      class: 'key ' + capClass(p), type: 'button', 'aria-pressed': String(p.id === settings.provider), dataset: { id: p.id },
      onclick: () => setProvider(p.id),
    };
    if (p.locked) {
      props.class += ' locked';
      props['aria-label'] = shortName(p) + ' (khusus pemilik, perlu password)';
    }
    return h('button', props, shortName(p), p.locked ? h('span', { class: 'lock', html: icon('lock', 13) }) : null);
  }

  function renderKeyring() {
    const wrap = $('#keyring');
    wrap.textContent = '';
    const cur = prov();
    for (const p of providers().filter((x) => x.featured)) wrap.append(keyButton(p));
    if (providers().some((x) => !x.featured)) {
      const on = !cur.featured;
      wrap.append(h('button', {
        class: 'key ' + (on ? capClass(cur) : 'k-steel'), type: 'button', id: 'moreBtn', 'aria-haspopup': 'menu',
        'aria-expanded': String(S.menuOpen), 'aria-pressed': String(on), onclick: toggleMenu,
      }, on ? shortName(cur) : 'Lainnya', h('span', { class: 'chev', html: icon('chevron', 16) })));
    }
    renderMenu();
  }

  function renderMenu() {
    const m = $('#moreMenu');
    m.textContent = '';
    m.hidden = !S.menuOpen;
    if (!S.menuOpen) return;
    for (const p of providers().filter((x) => !x.featured)) {
      m.append(h('button', {
        type: 'button', role: 'menuitem', class: capClass(p),
        onclick: () => { closeMenu(); setProvider(p.id); },
      }, h('span', { class: 'dot' }), p.name, p.id === settings.provider ? h('span', { class: 'tick', html: icon('check', 18) }) : null));
    }
    const btn = $('#moreBtn');
    const wrap = $('.keyring-wrap');
    if (btn && wrap) {
      const left = Math.max(0, Math.min(btn.offsetLeft - $('#keyring').scrollLeft, wrap.clientWidth - 236));
      m.style.left = left + 'px';
      m.style.right = 'auto';
    }
  }
  function toggleMenu(e) {
    e.stopPropagation();
    S.menuOpen = !S.menuOpen;
    renderKeyring();
    if (S.menuOpen) { const first = $('#moreMenu button'); if (first) first.focus(); }
  }
  function closeMenu() {
    if (!S.menuOpen) return;
    S.menuOpen = false;
    renderKeyring();
  }

  function setProvider(id) {
    const target = findProv(id);
    if (target && target.locked) { S.pendingProvider = id; showGate(); return; }
    if (!findProv(id) || id === settings.provider) return;
    settings.provider = id;
    saveSettings();
    applyTint();
    renderKeyring();
    renderModelSelect();
    syncSettings();
    if (!hasMessages()) renderThread({ swing: true });
    updateSend();
    autoLoadModels(false);
  }

  /* ================================================================ model */
  function renderModelSelect() {
    const sel = $('#modelSelect');
    const p = prov();
    const curModel = modelOf(p);
    sel.textContent = '';
    const seen = new Set();
    const add = (id, label) => { if (!id || seen.has(id)) return; seen.add(id); sel.append(h('option', { value: id, text: label || id })); };
    if (!curModel) sel.append(h('option', { value: '', text: 'Pilih model', disabled: true }));
    add(curModel);
    for (const m of S.lists[p.id] || []) add(m.id, m.name && m.name !== m.id ? `${m.name}` : m.id);
    sel.append(h('option', { value: '__more', text: 'Atur model…' }));
    sel.value = curModel || '';
  }

  function fillDatalist() {
    const dl = $('#modelList');
    dl.textContent = '';
    for (const m of S.lists[prov().id] || []) dl.append(h('option', { value: m.id, label: m.name || m.id }));
  }

  function setModelHint(text, kind) {
    const el = $('#modelHint');
    el.textContent = text || '';
    el.className = 'hint' + (kind === 'err' ? ' err-t' : kind === 'ok' ? ' ok-t' : '');
  }

  async function loadModels(silent) {
    const p = prov();
    const id = p.id;
    if (S.loading[id]) return;
    const r = readiness(p);
    if (!r.keyOk || !r.baseOk) { if (!silent) setModelHint('Isi API key (dan Base URL) dulu.', 'err'); return; }
    S.loading[id] = true;
    setModelHint('Memuat daftar model…');
    $('#loadModels').disabled = true;
    try {
      const body = { provider: id };
      if (keyOf(id)) body.apiKey = keyOf(id);
      if (p.custom && baseOf(id)) body.baseUrl = baseOf(id);
      const res = await fetch('api/models', { method: 'POST', headers: { 'Content-Type': 'application/json', ...accessHeaders() }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.code === 'password_required') { accessPw = ''; kv.del('pw', 'session'); showGate(); }
        throw new Error(j.error || `Server membalas ${res.status}.`);
      }
      S.lists[id] = Array.isArray(j.models) ? j.models : [];
      writeJson('models', S.lists);
      if (!settings.models[id] && !p.example && S.lists[id][0]) { settings.models[id] = S.lists[id][0].id; saveSettings(); }
      if (prov().id === id) {
        renderModelSelect();
        fillDatalist();
        // Jangan menimpa kolom model kalau pengguna sedang mengetik di situ.
        if (document.activeElement !== $('#setModel')) $('#setModel').value = settings.models[id] || '';
        refreshReady();
      }
      const n = S.lists[id].length;
      setModelHint(n ? `${n} model ditemukan. Ketik atau pilih salah satu.` : 'Tidak ada model yang ditemukan. Ketik nama modelnya manual.', n ? 'ok' : 'err');
    } catch (e) {
      setModelHint(`${e.message} Kamu tetap bisa mengetik nama model manual.`, 'err');
    } finally {
      S.loading[id] = false;
      $('#loadModels').disabled = false;
    }
  }
  function autoLoadModels(force) {
    const p = prov();
    const r = readiness(p);
    if (!r.keyOk || !r.baseOk) return;
    if (!force && ((S.lists[p.id] || []).length || S.autoTried[p.id])) return;
    S.autoTried[p.id] = true;
    loadModels(true);
  }

  /* ================================================================ percakapan */
  const cur = () => chats.find((c) => c.id === activeId) || null;
  const hasMessages = () => { const c = cur(); return !!(c && c.messages.length); };
  const lastIdx = (arr, role) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].role === role) return i; return -1; };
  const makeTitle = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Chat baru';

  function createChat(title) {
    const c = { id: uid(), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    chats.unshift(c);
    activeId = c.id;
    return c;
  }

  function splitThink(m) {
    let think = m.think || '';
    let text = m.content || '';
    const t = /^\s*<think>([\s\S]*?)(<\/think>|$)/i.exec(text);
    if (t) {
      think = (think ? think + '\n' : '') + t[1].trim();
      text = text.slice(t[0].length).replace(/^\s+/, '');
    }
    return { think: think.trim(), text };
  }

  // Gambar kunci untuk layar kosong. Gerigi bilahnya diturunkan dari id provider, jadi tiap AI punya potongan sendiri.
  function keySvg(p) {
    const name = shortName(p);
    const size = 24;
    const bowW = Math.round(80 + name.length * size * 0.64);
    const bladeX = bowW - 10;
    const bladeW = 128;
    const teeth = 7;
    const tw = (bladeW - 16) / teeth;
    let seed = 7;
    for (const ch of p.id) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const depth = Array.from({ length: teeth }, () => 2 + Math.round(rnd() * 9));
    const x0 = bladeX;
    const xEnd = bladeX + bladeW;
    let d = `M${x0} 31H${xEnd}V${60 - depth[teeth - 1]}`;
    for (let i = teeth - 1; i >= 0; i--) {
      d += `H${(x0 + 8 + i * tw).toFixed(1)}`;
      if (i > 0) d += `V${60 - depth[i - 1]}`;
    }
    d += 'Z';
    const W = xEnd + 6;
    return `<svg viewBox="0 0 ${W} 90" width="${W}" height="90" role="img" aria-label="Kunci ${esc(name)}">
      <path d="${d}" fill="var(--steel)" stroke="var(--steel)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M${x0 + 18} 41H${xEnd - 14}" stroke="var(--paper)" stroke-width="2.5" stroke-linecap="round" opacity=".75"/>
      <path d="M28 6H${bowW - 12}a14 14 0 0 1 14 14V70a14 14 0 0 1-14 14H28A24 24 0 0 1 4 60V30A24 24 0 0 1 28 6Z" fill="var(--cap)"/>
      <circle cx="36" cy="45" r="12" fill="var(--paper)"/>
      <text x="62" y="${45 + Math.round(size * 0.34)}" font-size="${size}" fill="var(--cap-ink)">${esc(name)}</text>
    </svg>`;
  }

  function emptyState(swing) {
    const p = prov();
    const r = readiness(p);
    const usingServer = !keyOf(p.id) && srvKeyUsable(p);
    let title, body, action;
    if (!r.keyOk) {
      title = `Masukkan API key ${p.name}`;
      body = p.keyUrl ? `Ambil key di ${hostOf(p.keyUrl)}, lalu tempel di Pengaturan. Key disimpan di browser ini.` : 'Tempel API key-nya di Pengaturan. Key disimpan di browser ini.';
      action = ['Isi API key', 'key'];
    } else if (!r.baseOk) {
      title = `Isi Base URL ${p.name}`;
      body = 'Alamat API-nya, contoh https://api.contoh.com/v1. Isi di Pengaturan.';
      action = ['Isi Base URL', 'base'];
    } else if (!r.modelOk) {
      title = 'Pilih model';
      body = 'Muat daftar model atau ketik nama modelnya di Pengaturan.';
      action = ['Pilih model', 'model'];
    } else {
      title = `Siap chat dengan ${p.name}`;
      body = `Model ${modelOf(p)}.${usingServer ? ' Memakai key dari server.' : ''} Ketik pesan di bawah.`;
    }
    return h('div', { class: 'empty' },
      h('div', { class: 'hero' + (swing ? ' swing' : ''), html: keySvg(p) }),
      h('h2', { text: title }),
      h('p', { text: body }),
      action ? h('button', { class: 'btn primary', type: 'button', dataset: { act: 'start-setup', focus: action[1] }, text: action[0] }) : null);
  }

  function errorAction(m, isLast) {
    const mk = (act, label) => h('button', { class: 'btn small', type: 'button', dataset: { act }, text: label });
    switch (m.errorCode) {
      case 'no_key': case 'bad_key': case 'upstream_auth': return mk('open-key', 'Buka Pengaturan');
      case 'no_base_url': return mk('open-base', 'Isi Base URL');
      case 'upstream_not_found': return mk('open-model', 'Ganti model');
      case 'password_required': return mk('gate', 'Masukkan password');
      default: return isLast && !S.busy ? mk('regen', 'Coba lagi') : null;
    }
  }

  function toolBtn(act, label, ico) {
    return h('button', { class: 'text-btn', type: 'button', dataset: { act }, html: icon(ico, 16) + esc(label) });
  }

  function paintAI(root, m, i, c) {
    const live = S.live === m;
    const isLast = i === c.messages.length - 1;
    const { think, text } = splitThink(m);

    const det = $('.think', root);
    det.hidden = !think;
    if (think) {
      $('.think-body', det).textContent = think;
      $('summary', det).textContent = live && !text ? 'Sedang berpikir…' : 'Proses berpikir';
    }

    const md = $('.md', root);
    md.innerHTML = text ? window.MD.render(text) : '';
    if (live) {
      const cursor = h('span', { class: 'cursor', 'aria-hidden': 'true' });
      const last = md.lastElementChild;
      (last && !last.matches('.code, .table-wrap, hr') ? last : md).append(cursor);
    }

    const note = $('.note', root);
    note.textContent = '';
    note.hidden = true;
    if (!live) {
      if (m.truncated) {
        note.hidden = false;
        note.append('Jawaban terpotong karena batas panjang.');
        if (isLast && !S.busy) note.append(h('button', { class: 'btn small', type: 'button', dataset: { act: 'continue' }, text: 'Lanjutkan' }));
      } else if (m.stopped) {
        note.hidden = false;
        note.append('Dihentikan.');
      }
    }

    const err = $('.err', root);
    err.textContent = '';
    err.hidden = !m.error;
    if (m.error) {
      err.append(h('span', { text: m.error }));
      const act = errorAction(m, isLast);
      if (act) err.append(act);
    }

    const tools = $('.tools', root);
    tools.textContent = '';
    tools.hidden = live;
    if (!live) {
      if (m.content) tools.append(toolBtn('copy', 'Salin', 'copy'));
      if (isLast && !S.busy) tools.append(toolBtn('regen', 'Ulangi jawaban', 'refresh'));
    }
  }

  function messageEl(m, i, c) {
    if (m.role === 'user') {
      const canEdit = !S.busy && i === lastIdx(c.messages, 'user');
      return h('article', { class: 'msg user', dataset: { i } },
        h('div', { class: 'bubble', text: m.content }),
        h('div', { class: 'tools' }, toolBtn('copy', 'Salin', 'copy'), canEdit ? toolBtn('edit', 'Edit', 'edit') : null));
    }
    const p = findProv(m.provider);
    const root = h('article', { class: 'msg ai ' + (p ? capClass(p) : 'k-steel'), dataset: { i } },
      h('div', { class: 'who' }, h('span', { class: 'tag', text: p ? shortName(p) : (m.provider || 'AI') }), h('span', { class: 'model', text: m.model || '' })),
      h('details', { class: 'think', hidden: true }, h('summary'), h('div', { class: 'think-body' })),
      h('div', { class: 'md' }),
      h('div', { class: 'note', hidden: true }),
      h('div', { class: 'err', role: 'alert', hidden: true }),
      h('div', { class: 'tools', hidden: true }));
    if (S.live === m) root.dataset.live = '1';
    paintAI(root, m, i, c);
    return root;
  }

  function renderThread(opts = {}) {
    const c = cur();
    const box = $('#thread');
    box.textContent = '';
    if (!c || !c.messages.length) {
      box.append(emptyState(opts.swing));
      $('#jump').hidden = true;
      return;
    }
    c.messages.forEach((m, i) => box.append(messageEl(m, i, c)));
    const last = c.messages[c.messages.length - 1];
    if (last.role === 'user' && !S.busy) {
      box.append(h('div', { class: 'note' }, 'Pesan ini belum dijawab.', h('button', { class: 'btn small', type: 'button', dataset: { act: 'regen' }, text: 'Minta jawaban' })));
    }
    if (S.stick) scrollBottom();
  }

  function renderRail() {
    const list = $('#chatList');
    list.textContent = '';
    if (!chats.length) { list.append(h('p', { class: 'rail-empty', text: 'Belum ada riwayat chat.' })); return; }
    for (const c of chats) {
      const lastAI = [...c.messages].reverse().find((m) => m.role === 'assistant' && m.provider);
      const p = lastAI ? findProv(lastAI.provider) : null;
      const del = h('button', { class: 'chat-del', type: 'button', 'aria-label': `Hapus chat ${c.title}`, html: icon('trash', 18) });
      let timer = 0;
      del.addEventListener('click', () => {
        if (del.hasAttribute('data-armed')) { clearTimeout(timer); deleteChat(c.id); return; }
        del.setAttribute('data-armed', '');
        del.textContent = 'Hapus?';
        timer = setTimeout(() => { del.removeAttribute('data-armed'); del.innerHTML = icon('trash', 18); }, 3000);
      });
      list.append(h('div', { class: 'chat-item' + (c.id === activeId ? ' active' : '') },
        h('button', { class: 'chat-open', type: 'button', onclick: () => openChat(c.id) },
          h('span', { class: 'dot ' + (p ? capClass(p) : 'none') }), h('span', { class: 'chat-title', text: c.title })),
        del));
    }
  }

  function openChat(id) {
    if (S.busy) { toast('Tunggu jawaban selesai atau tekan Stop dulu.'); return; }
    activeId = id;
    S.stick = true;
    saveChats();
    renderRail();
    renderThread();
    closeRail();
    scrollBottom();
  }
  function newChat() {
    if (S.busy) { toast('Tunggu jawaban selesai atau tekan Stop dulu.'); return; }
    activeId = null;
    S.stick = true;
    saveChats();
    renderRail();
    renderThread();
    closeRail();
    if (!coarse()) $('#input').focus();
  }
  function deleteChat(id) {
    if (S.busy && id === activeId) { toast('Tunggu jawaban selesai atau tekan Stop dulu.'); return; }
    chats = chats.filter((c) => c.id !== id);
    if (activeId === id) activeId = null;
    saveChats();
    renderRail();
    renderThread();
  }

  function exportChat() {
    const c = cur();
    if (!c || !c.messages.length) { toast('Belum ada chat untuk diekspor.'); return; }
    const lines = [`# ${c.title}`, ''];
    for (const m of c.messages) {
      const p = findProv(m.provider);
      lines.push(m.role === 'user' ? '**Kamu**' : `**${p ? p.name : 'AI'}**${m.model ? ` (${m.model})` : ''}`, '', m.content || (m.error ? `_Error: ${m.error}_` : ''), '');
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const a = h('a', { href: url, download: `anykey-${new Date().toISOString().slice(0, 10)}.md` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ================================================================ scroll */
  const box = () => $('#transcript');
  const nearBottom = () => { const t = box(); return t.scrollHeight - t.scrollTop - t.clientHeight < 140; };
  const scrollBottom = () => { const t = box(); t.scrollTop = t.scrollHeight; };

  /* ================================================================ kirim & streaming */
  function updateSend() {
    const btn = $('#sendBtn');
    const has = $('#input').value.trim().length > 0;
    if (S.busy) {
      btn.disabled = false;
      btn.innerHTML = icon('stop', 22);
      btn.setAttribute('aria-label', 'Hentikan jawaban');
    } else {
      btn.disabled = !has;
      btn.innerHTML = icon('send', 22);
      btn.setAttribute('aria-label', 'Kirim pesan');
    }
  }
  function autosize() {
    const t = $('#input');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 200) + 'px';
  }
  function refreshReady() {
    const key = JSON.stringify(readiness(prov()));
    if (key !== S.readyKey) {
      S.readyKey = key;
      if (!hasMessages()) renderThread();
    }
    updateSend();
  }

  function needSetup(kind) {
    toast(kind === 'key' ? 'Isi API key dulu di Pengaturan.' : kind === 'base' ? 'Isi Base URL dulu di Pengaturan.' : 'Pilih model dulu.');
    openSettings(kind);
  }

  function checkReady() {
    const r = readiness(prov());
    if (!r.keyOk) { needSetup('key'); return false; }
    if (!r.baseOk) { needSetup('base'); return false; }
    if (!r.modelOk) { needSetup('model'); return false; }
    return true;
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || S.busy) return;
    if (!S.config) { toast('Server API belum terhubung. Muat ulang halaman.'); return; }
    if (!checkReady()) return;
    const c = cur() || createChat(makeTitle(text));
    c.messages.push({ id: uid(), role: 'user', content: text, ts: Date.now() });
    c.updatedAt = Date.now();
    saveChats();
    $('#input').value = '';
    autosize();
    await reply(c);
  }
  const quickSend = (text) => send(text);

  let paintTimer = 0;
  let lastPaint = 0;
  function schedulePaint() {
    if (paintTimer) return;
    const wait = Math.max(0, 70 - (performance.now() - lastPaint));
    paintTimer = setTimeout(() => { paintTimer = 0; lastPaint = performance.now(); paintLive(); }, wait);
  }
  function paintLive() {
    const m = S.live;
    const root = m && $('#thread [data-live]');
    const c = cur();
    if (!root || !c) return;
    paintAI(root, m, Number(root.dataset.i), c);
    if (S.stick) scrollBottom();
  }

  async function readHttpError(res, m) {
    let j = null;
    try { j = await res.json(); } catch (_) {}
    m.error = (j && j.error) || (res.status === 504 ? 'Server kehabisan waktu menunggu AI. Coba model yang lebih cepat atau pesan yang lebih pendek.' : `Server membalas ${res.status}. Coba lagi sebentar lagi.`);
    m.errorCode = j && j.code;
    if (m.errorCode === 'password_required') { accessPw = ''; kv.del('pw', 'session'); setTimeout(showGate, 50); }
  }

  async function readStream(res, m) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let finished = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
          if (ev.delta) m.content += ev.delta;
          else if (ev.think) m.think += ev.think;
          else if (ev.finish === 'length') m.truncated = true;
          else if (ev.error) { m.error = ev.error; m.errorCode = 'stream'; }
          else if (ev.done) finished = true;
        }
        schedulePaint();
      }
    }
    if (!finished && !m.error) m.error = 'Jawaban terputus sebelum selesai.';
  }

  async function reply(c) {
    const p = prov();
    const model = modelOf(p);
    const m = { id: uid(), role: 'assistant', content: '', think: '', provider: p.id, model, ts: Date.now() };
    const history = c.messages.filter((x) => x.content && x.content.trim()).map(({ role, content }) => ({ role, content }));
    c.messages.push(m);
    S.busy = true;
    S.live = m;
    S.stick = true;
    const ctrl = new AbortController();
    S.abort = ctrl;
    renderThread();
    scrollBottom();
    updateSend();
    announce(`${p.name} sedang menjawab`);

    const body = { provider: p.id, model, messages: history, stream: true };
    if (keyOf(p.id)) body.apiKey = keyOf(p.id);
    if (p.custom && baseOf(p.id)) body.baseUrl = baseOf(p.id);
    if (settings.system.trim()) body.system = settings.system.trim();
    if (settings.temperature !== '' && Number.isFinite(Number(settings.temperature))) body.temperature = Number(settings.temperature);
    if (settings.maxTokens !== '' && Number(settings.maxTokens) > 0) body.maxTokens = Number(settings.maxTokens);

    try {
      const res = await fetch('api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...accessHeaders() }, body: JSON.stringify(body), signal: ctrl.signal,
      });
      if (!res.ok) await readHttpError(res, m);
      else await readStream(res, m);
    } catch (e) {
      if (e && e.name === 'AbortError') m.stopped = true;
      else if (!m.error) { m.error = 'Koneksi ke server terputus. Cek internetmu, lalu coba lagi.'; m.errorCode = 'network'; }
    }

    clearTimeout(paintTimer);
    paintTimer = 0;
    S.busy = false;
    S.live = null;
    S.abort = null;
    if (m.stopped && !m.content && !m.think) c.messages.splice(c.messages.indexOf(m), 1);
    else if (!m.content && !m.think && !m.error) { m.error = 'Model tidak mengirim jawaban.'; m.errorCode = 'empty'; }
    c.updatedAt = Date.now();
    saveChats();
    renderRail();
    renderThread();
    updateSend();
    announce('Jawaban selesai');
  }

  function stopStream() { if (S.abort) S.abort.abort(); }

  async function regenerate() {
    const c = cur();
    if (!c || S.busy) return;
    while (c.messages.length && c.messages[c.messages.length - 1].role === 'assistant') c.messages.pop();
    if (!c.messages.length) return;
    if (!checkReady()) { renderThread(); return; }
    saveChats();
    await reply(c);
  }

  function editLast() {
    const c = cur();
    if (!c || S.busy) return;
    const i = lastIdx(c.messages, 'user');
    if (i < 0) return;
    const text = c.messages[i].content;
    c.messages.splice(i);
    saveChats();
    renderThread();
    const input = $('#input');
    input.value = text;
    autosize();
    updateSend();
    input.focus();
  }

  /* ================================================================ pengaturan */
  function syncSettings() {
    const p = prov();
    const sel = $('#setProvider');
    if (!sel.options.length) for (const pr of providers()) sel.append(h('option', { value: pr.id, text: pr.name }));
    sel.value = p.id;

    $('#keyLabel').textContent = p.keyOptional ? 'API key (opsional)' : `API key ${p.name}`;
    $('#setKey').value = keys[p.id] || '';
    $('#setKey').placeholder = p.id === 'anthropic' ? 'sk-ant-…' : 'Tempel API key di sini';
    $('#keyHint').textContent = srvKeyUsable(p)
      ? 'Server sudah menyediakan key. Kolom ini boleh kosong; kalau diisi, key kamu yang dipakai.'
      : p.keyOptional ? 'Kosongkan kalau API-nya tidak butuh key.' : 'Disimpan di browser ini.';
    const link = $('#keyLink');
    link.hidden = !p.keyUrl;
    if (p.keyUrl) { link.href = p.keyUrl; link.textContent = `Ambil API key di ${hostOf(p.keyUrl)}`; }

    $('#baseField').hidden = !p.custom;
    $('#setBase').value = settings.baseUrls[p.id] || '';
    $('#baseHint').textContent = hasSrvBase(p.id)
      ? 'Server sudah punya alamat API. Kosongkan untuk memakainya.'
      : 'Alamat API yang kompatibel OpenAI. Biasanya berakhiran /v1.';

    $('#setModel').value = settings.models[p.id] || '';
    $('#setModel').placeholder = p.example || 'Nama model';
    fillDatalist();
    setModelHint('');

    $('#setSystem').value = settings.system;
    $('#setTemp').value = settings.temperature;
    $('#setMax').value = settings.maxTokens;
    $('#setRemember').checked = !!settings.remember;
    $('#accessSec').hidden = !(S.config && S.config.passwordRequired && accessPw);
    applyTheme();
  }

  function openSettings(focus) {
    if (!S.config) { toast('Server API belum terhubung. Muat ulang halaman.'); return; }
    syncSettings();
    closeRail();
    const d = $('#settings');
    if (!d.open) d.showModal();
    const target = { key: '#setKey', base: '#setBase', model: '#setModel' }[focus];
    if (target) {
      setTimeout(() => {
        const el = $(target);
        if (!el || el.closest('[hidden]')) return;
        // Jangan merebut fokus kalau pengguna sudah keburu memilih kolom lain di lembar ini
        // (kalau tidak, teks yang sedang diketik bisa nyasar ke kolom yang salah).
        const a = document.activeElement;
        const picked = a && a !== el && d.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
        if (!picked) el.focus();
      }, 80);
    }
  }
  const closeSettings = () => { const d = $('#settings'); if (d.open) d.close(); };

  function wireSettings() {
    $('#setProvider').addEventListener('change', (e) => setProvider(e.target.value));
    $('#setKey').addEventListener('input', (e) => { keys[prov().id] = e.target.value; saveKeys(); refreshReady(); });
    $('#setKey').addEventListener('change', () => autoLoadModels(true));
    $('#showKey').addEventListener('click', (e) => {
      const i = $('#setKey');
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      e.currentTarget.textContent = show ? 'Sembunyikan' : 'Lihat';
      e.currentTarget.setAttribute('aria-pressed', String(show));
    });
    $('#setBase').addEventListener('input', (e) => { settings.baseUrls[prov().id] = e.target.value; saveSettings(); refreshReady(); });
    $('#setBase').addEventListener('change', () => autoLoadModels(true));
    $('#setModel').addEventListener('input', (e) => { settings.models[prov().id] = e.target.value.trim(); saveSettings(); renderModelSelect(); refreshReady(); });
    $('#loadModels').addEventListener('click', () => loadModels(false));
    $('#setSystem').addEventListener('input', (e) => { settings.system = e.target.value; saveSettings(); });
    $('#setTemp').addEventListener('input', (e) => { settings.temperature = e.target.value; saveSettings(); });
    $('#setMax').addEventListener('input', (e) => { settings.maxTokens = e.target.value; saveSettings(); });
    $('#setRemember').addEventListener('change', (e) => {
      const old = keyArea();
      settings.remember = e.target.checked;
      const next = keyArea();
      if (old !== next) { kv.del('keys', old); writeJson('keys', keys, next); }
      saveSettings();
    });
    $$('#themeSeg button').forEach((b) => b.addEventListener('click', () => { settings.theme = b.dataset.theme; saveSettings(); applyTheme(); }));
    $('#lockBtn').addEventListener('click', () => { accessPw = ''; kv.del('pw', 'session'); location.reload(); });
    $('#wipeBtn').addEventListener('click', () => {
      if (!window.confirm('Hapus semua data (API key, riwayat chat, dan pengaturan) di browser ini?')) return;
      for (const kind of ['local', 'session']) {
        try { const a = area(kind); if (a) Object.keys(a).filter((k) => k.startsWith(NS)).forEach((k) => a.removeItem(k)); } catch (_) {}
      }
      location.reload();
    });
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#settingsDone').addEventListener('click', closeSettings);
    $('#settings').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSettings(); });
    $('#settings').addEventListener('close', () => { renderModelSelect(); refreshReady(); if (!coarse()) $('#input').focus(); });
  }

  /* ================================================================ password situs */
  function showGate() {
    const d = $('#gate');
    $('#gateErr').hidden = true;
    $('#gatePw').value = '';
    if (!d.open) d.showModal();
    setTimeout(() => $('#gatePw').focus(), 60);
  }
  function wireGate() {
    $('#gate').addEventListener('cancel', (e) => e.preventDefault());
    $('#gateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('#gatePw').value;
      let j = null;
      try {
        const res = await fetch('api/config', { headers: { 'X-Access-Password': encodeURIComponent(pw) }, cache: 'no-store' });
        if (res.ok) j = await res.json();
      } catch (_) {}
      if (j && j.authorized) {
        accessPw = pw;
        kv.set('pw', pw, 'session');
        S.config = j;
        $('#gate').close();
        const pend = S.pendingProvider;
        S.pendingProvider = null;
        afterConfig();
        if (pend) setProvider(pend);
      } else {
        // Server belum punya ACCESS_PASSWORD: beri tahu langsung, jangan terus bilang "password salah".
        $('#gateErr').textContent = j && j.passwordRequired === false
          ? 'Server belum punya password pemilik. Isi ACCESS_PASSWORD di Vercel, lalu Redeploy.'
          : 'Password salah. Coba lagi.';
        $('#gateErr').hidden = false;
        $('#gatePw').select();
      }
    });
  }

  /* ================================================================ rail */
  const openRail = () => { $('#app').classList.add('rail-open'); $('#scrim').hidden = false; };
  function closeRail() { $('#app').classList.remove('rail-open'); $('#scrim').hidden = true; }

  /* ================================================================ boot */
  // Gagal memuat /api/config -> lempar error yang membawa kind ('network' | 'http'), status HTTP,
  // dan detail dari server (kalau ada) supaya fatal() bisa menjelaskan penyebabnya.
  async function loadConfig() {
    let res;
    try {
      res = await fetch('api/config', { headers: accessHeaders(), cache: 'no-store' });
    } catch (_) {
      const err = new Error('network');
      err.kind = 'network';
      throw err;
    }
    let text = '';
    try { text = await res.text(); } catch (_) {}
    let j = null;
    try { j = JSON.parse(text); } catch (_) {}
    if (!res.ok || !j || !Array.isArray(j.providers)) {
      const err = new Error('config ' + res.status);
      err.kind = 'http';
      err.status = res.status;
      err.notJson = !j;
      const fromJson = j && (j.detail || j.error);
      err.detail = String(fromJson || (/^\s*</.test(text) ? '' : text)).replace(/\s+/g, ' ').trim().slice(0, 400);
      throw err;
    }
    S.config = j;
  }

  function afterConfig() {
    const cur = findProv(settings.provider);
    if (!cur || cur.locked) settings.provider = (providers().find((p) => !p.locked) || providers()[0]).id;
    applyTint();
    renderKeyring();
    renderModelSelect();
    renderRail();
    S.readyKey = JSON.stringify(readiness(prov()));
    renderThread();
    updateSend();
    syncSettings();
    autoLoadModels(false);
  }

  // Layar darurat kalau /api/config gagal. Pesannya dibedakan: tanpa koneksi, folder api/ tidak ada
  // (404 atau balasan bukan JSON), atau fungsi server crash (5xx). Intinya bukan soal API key.
  function fatal(err) {
    err = err || {};
    const st = err.status || 0;
    let title = 'Server API tidak menjawab';
    const lines = [];
    if (err.kind === 'network') {
      lines.push('Browser tidak bisa menghubungi server API. Cek koneksi internetmu, lalu coba lagi.');
      lines.push('Kalau kamu membuka index.html langsung dari folder, jalankan lewat "npm start" atau deploy ke Vercel supaya folder api/ ikut aktif.');
    } else if (st >= 500) {
      title = `Fungsi server error (${st})`;
      lines.push('Halaman ini kebuka, tapi fungsi di folder api/ crash. Ini bukan soal API key: key belum sempat dibaca.');
      lines.push('Penyebab paling sering: ada file di folder api/ (terutama api/_lib/) yang tidak ikut ke-upload ke GitHub, atau Framework Preset di Vercel bukan "Other". Cek Vercel → project → Logs.');
    } else if (st === 404 || err.notJson) {
      title = 'Folder api/ tidak ketemu';
      lines.push(`Situs ini jalan, tapi alamat /api/config tidak ada${st ? ` (kode ${st})` : ''}.`);
      lines.push('Pastikan folder api/ (isinya chat.js, config.js, models.js, dan folder _lib) ada langsung di root repo GitHub, lalu Redeploy di Vercel.');
    } else {
      lines.push(`Server API membalas dengan kode ${st || '?'}.`);
    }
    const box = h('div', { class: 'empty' }, h('h2', { text: title }), ...lines.map((t) => h('p', { text: t })));
    if (err.detail) box.append(h('p', { class: 'fatal-detail', text: err.detail }));
    box.append(h('button', { class: 'btn primary', type: 'button', text: 'Coba lagi', onclick: () => location.reload() }));
    $('#thread').textContent = '';
    $('#thread').append(box);
    // Tanpa server tidak ada yang bisa dikirim: kunci kolom pesan supaya tidak mengetik sia-sia.
    $('#input').disabled = true;
    $('#input').placeholder = 'Server API belum terhubung';
    $('#sendBtn').disabled = true;
  }

  function fitViewport() {
    const vv = window.visualViewport;
    const set = () => document.documentElement.style.setProperty('--app-h', Math.round(vv ? vv.height : window.innerHeight) + 'px');
    set();
    (vv || window).addEventListener('resize', set);
  }

  function wireStatic() {
    // composer
    const input = $('#input');
    input.addEventListener('input', () => { autosize(); updateSend(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !coarse()) { e.preventDefault(); if (!S.busy) send(input.value); }
    });
    $('#composer').addEventListener('submit', (e) => { e.preventDefault(); if (S.busy) stopStream(); else send(input.value); });
    $('#modelSelect').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === '__more') { renderModelSelect(); openSettings('model'); return; }
      settings.models[prov().id] = v;
      saveSettings();
      refreshReady();
    });
    if (window.ResizeObserver) {
      new ResizeObserver(() => document.documentElement.style.setProperty('--composer-h', $('#composerWrap').offsetHeight + 'px')).observe($('#composerWrap'));
    }

    // percakapan
    box().addEventListener('scroll', () => { S.stick = nearBottom(); $('#jump').hidden = S.stick || !hasMessages(); }, { passive: true });
    $('#jump').addEventListener('click', () => { S.stick = true; scrollBottom(); $('#jump').hidden = true; });
    $('#thread').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-copy')) {
        const code = btn.closest('.code');
        const txt = code ? code.querySelector('code').innerText.replace(/\n$/, '') : '';
        copyText(txt).then((ok) => flashBtn(btn, ok ? 'Tersalin' : 'Gagal menyalin'));
        return;
      }
      const act = btn.dataset.act;
      if (!act) return;
      const art = btn.closest('[data-i]');
      const c = cur();
      const m = c && art ? c.messages[Number(art.dataset.i)] : null;
      switch (act) {
        case 'copy': if (m) copyText(m.content).then((ok) => flashBtn(btn, ok ? 'Tersalin' : 'Gagal menyalin')); break;
        case 'regen': regenerate(); break;
        case 'edit': editLast(); break;
        case 'continue': quickSend('Lanjutkan jawabanmu dari bagian terakhir.'); break;
        case 'start-setup': openSettings(btn.dataset.focus); break;
        case 'open-key': openSettings('key'); break;
        case 'open-base': openSettings('base'); break;
        case 'open-model': openSettings('model'); break;
        case 'gate': showGate(); break;
        default: break;
      }
    });

    // rail & header
    $('#railToggle').addEventListener('click', openRail);
    $('#railClose').addEventListener('click', closeRail);
    $('#scrim').addEventListener('click', closeRail);
    $('#newChat').addEventListener('click', newChat);
    $('#exportBtn').addEventListener('click', exportChat);
    $('#railSettings').addEventListener('click', () => openSettings());
    $('#settingsBtn').addEventListener('click', () => openSettings());

    document.addEventListener('click', (e) => { if (S.menuOpen && !e.target.closest('#moreMenu')) closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (S.menuOpen) { closeMenu(); const b = $('#moreBtn'); if (b) b.focus(); } else closeRail();
    });

    wireSettings();
    wireGate();
  }

  async function boot() {
    hydrateIcons();
    fitViewport();
    applyTheme();
    wireStatic();
    try {
      await loadConfig();
    } catch (err) {
      fatal(err);
      return;
    }
    afterConfig();
    if (!coarse() && !$('#gate').open) $('#input').focus();
  }

  boot();
})();
