# AnyKey AI

Web chat AI yang bisa dipakai dengan **API key apa pun**. **Unlimited AI** bisa dipakai semua pengunjung. **Claude Opus** dan **Gemini 3 Pro** khusus pemilik (lewat password). Sisanya (Claude, OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI, Together, Perplexity, Cerebras, Fireworks, NVIDIA NIM, plus **Custom** yang kompatibel OpenAI) pakai API key sendiri di Pengaturan.

- Tanpa database, tanpa dependency, tanpa build. Cukup `public/` (tampilan) + `api/` (fungsi serverless).
- Jawaban tampil mengalir (streaming), mendukung markdown, tabel, blok kode, dan "proses berpikir" model reasoning.
- Riwayat chat dan API key disimpan **di browser masing-masing pengunjung**, bukan di server.
- Tampilan mobile-first, ada mode terang/gelap.

---

## Deploy ke Vercel (lewat website, tanpa CLI)

### 1. Taruh kode di GitHub

**Lewat website GitHub (paling gampang, dari laptop/PC):**

1. Ekstrak `anykey-ai.zip` dulu. GitHub **tidak** mengekstrak zip sendiri.
2. Di GitHub: **New repository** → beri nama (mis. `anykey-ai`) → **Create repository**.
3. Klik **uploading an existing file**, lalu seret **isi** folder `anykey-ai` (folder `api`, `public`, `local`, dan file `package.json`, `vercel.json`, `.gitignore`, `.env.example`, `README.md`) — bukan zip-nya.
4. **Commit changes**.
5. Cek hasilnya di GitHub (lihat *Isi repo yang benar* di bawah). Upload yang kurang satu folder saja, misalnya `api/_lib`, bikin situs error.

> Browser HP biasanya tidak bisa memilih folder untuk di-upload. Dari HP pakai cara Termux di bawah.

**Lewat Termux (HP Android):**

```bash
pkg install -y git unzip
unzip anykey-ai.zip && cd anykey-ai
git config --global user.name "NamaKamu"
git config --global user.email "emailkamu@contoh.com"
git init -b main
git add .
git commit -m "AnyKey AI"
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Saat diminta password, tempel **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens → centang `repo`), bukan password akunmu.

**Repo sudah ada tapi isinya kurang / versi lama?** Timpa dengan isi zip terbaru (zip-nya ditaruh di folder Download HP):

```bash
pkg install -y git unzip
termux-setup-storage                       # sekali saja, izinkan akses penyimpanan
cd ~ && rm -rf ai-web anykey-tmp
git clone https://github.com/USERNAME/NAMA-REPO.git ai-web
unzip -o ~/storage/downloads/anykey-ai.zip -d anykey-tmp
rm -f ai-web/server.js                     # server.js lama di root sudah pindah ke local/
cp -r anykey-tmp/anykey-ai/. ai-web/
cd ai-web && git add -A && git commit -m "lengkapi file" && git push
```

Vercel otomatis deploy ulang setelah `git push`.

**Isi repo yang benar** (buka repo di GitHub dan cocokkan):

```
api/chat.js  api/config.js  api/models.js
api/_lib/core.js  api/_lib/http.js  api/_lib/providers.js
public/index.html  public/app.js  public/app.css  public/theme-init.js  ...
public/vendor/md.js  public/vendor/NOTICE.txt  public/vendor/fonts/*.woff (7 file)
local/server.js  local/dotenv.js
package.json  vercel.json  .gitignore  .env.example  README.md
```

Di root repo **tidak boleh** ada `server.js`, `index.js`, atau `app.js`: Vercel bisa menganggapnya sebagai server utama dan mengambil alih semua `/api/*`.

### 2. Import ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → **Import** repo tadi.
2. **Framework Preset** biarkan *Other*. Build/Output sudah diatur di `vercel.json` — jangan diubah. Kalau project-mu sudah terlanjur terdeteksi *Node.js*: **Settings → Build and Deployment → Framework Preset → Other → Save**, lalu **Redeploy**.
3. (Opsional) buka **Environment Variables** dan isi sesuai bagian di bawah. Bisa juga nanti.
4. Klik **Deploy**. Selesai — buka URL-nya dan chat.

Tanpa env apa pun situs sudah jalan: pengunjung tinggal buka **Pengaturan**, pilih AI, tempel API key-nya sendiri.

---

## AI pemilik dan AI publik

| AI | Siapa yang bisa pakai | Yang diisi di Vercel |
|---|---|---|
| **Unlimited AI** | Semua pengunjung, tanpa password | `SYNOX_API_KEY` |
| **Claude Opus** | Hanya pemilik (lewat password) | `ACCESS_PASSWORD`, `SYNOX_API_KEY` |
| **Gemini 3 Pro** | Hanya pemilik (lewat password) | `ACCESS_PASSWORD`, `SYNOX_API_KEY` |
| Claude, OpenAI, dll. | Semua pengunjung, pakai key sendiri di Pengaturan | tidak perlu env |

- Pengunjung yang belum masuk melihat Claude Opus dan Gemini 3 Pro terkunci 🔒. Kalau diklik, muncul layar password. Setelah password benar, AI itu langsung dipilih.
- Tanpa `ACCESS_PASSWORD`, kedua AI pemilik ditutup total.
- Alamat endpoint Unlimited AI, Claude Opus, dan Gemini 3 Pro dikunci di server. Pengunjung tidak bisa menggantinya, dan `SYNOX_API_KEY` tidak pernah dikirim ke browser.
- Pemilik yang sudah login tidak kena batas pemakaian. Pengunjung biasa kena batas `SERVER_KEY_LIMIT` (bawaan 40 pesan/jam per IP).

> **Kuota Unlimited AI dihitung dari key synoxcloud-mu.** Semua pengunjung memakai satu `SYNOX_API_KEY`, jadi kuotanya cepat habis. Cek paket dan kuota di dashboard synoxcloud. Kalau kuota habis, pengunjung akan melihat pesan error dan bisa mengisi key sendiri di Pengaturan.

**Format API synoxcloud:** nama parameter teks bawaannya `text`. Kalau muncul "Format respons ... belum dikenali" atau parameternya salah, isi `SYNOX_PROMPT_PARAM` dengan nama yang benar (lihat dokumentasi synoxcloud).

**Claude Opus** dan **Gemini 3 Pro** memakai endpoint synoxcloud (`/ai-chat/claude-opus-4.8` dan `/ai-chat/gemini-3-pro`) dengan `SYNOX_API_KEY` yang sama. Path-nya dikunci di `api/_lib/providers.js`. Setelah mengubah env: **Deployments →** titik tiga di deployment terbaru **→ Redeploy**. Untuk menambah AI dari synoxcloud, tambahkan objek di `PROVIDERS` dengan `kind: 'synox'` dan `path` baru.

## Daftar environment variable

Semua **opsional**. Contoh lengkap ada di `.env.example` (isinya kosong).

| Variabel | Fungsi |
|---|---|
| `SYNOX_API_KEY` | Key synoxcloud untuk Unlimited AI (publik), Claude Opus dan Gemini 3 Pro (pemilik) |
| `SYNOX_PROMPT_PARAM` | Nama parameter teks di API synoxcloud (bawaan `text`) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `TOGETHER_API_KEY`, `PERPLEXITY_API_KEY`, `CEREBRAS_API_KEY`, `FIREWORKS_API_KEY`, `NVIDIA_API_KEY` | Key milik server untuk provider tersebut (baru dipakai kalau salah satu dari dua variabel di bawah aktif) |
| `CUSTOM_BASE_URL`, `CUSTOM_API_KEY` | Provider *Custom* milik server |
| `ACCESS_PASSWORD` | Password pemilik. Wajib untuk memakai Claude Opus dan Gemini 3 Pro. Kosong = kedua AI itu ditutup |
| `SHARE_SERVER_KEYS` | `1` = provider lain (OpenAI, Gemini, dll.) yang punya key di env boleh dipakai semua pengunjung. Tidak berlaku untuk Unlimited AI (sudah publik) |
| `SERVER_KEY_LIMIT` | Maks pesan per jam per IP saat key server dipakai (bawaan `40`, `0` = tanpa batas). Hitungan per instance server, jadi sifatnya perkiraan |
| `SERVER_KEY_MAX_TOKENS` | Batas panjang jawaban saat key server dipakai (bawaan `4096`) |
| `SERVER_KEY_MAX_INPUT_CHARS` | Batas panjang percakapan yang dikirim (bawaan `60000`) |
| `<PROVIDER>_BASE_URL` | Ganti alamat API provider bawaan (mis. `OPENAI_BASE_URL` untuk gateway sendiri) |
| `CORS_ORIGIN` | Izinkan situs lain memanggil API ini (`*` atau daftar origin dipisah koma). Kosong = same-origin saja |
| `ALLOW_PRIVATE_URLS` | `1` = Base URL Custom boleh menunjuk ke alamat lokal/privat (mis. Ollama di LAN). Hanya untuk self-host |

---

## Jalan di komputer / Termux / VPS

Butuh Node.js 20 atau lebih baru. Tidak perlu `npm install` karena tanpa dependency.

```bash
cp .env.example .env     # opsional; isi nilai yang kamu mau
node local/server.js     # atau: npm start
```

Buka `http://localhost:3000`. Port bisa diganti lewat env `PORT`. `local/server.js` juga bisa dipakai di hosting Node biasa (Pterodactyl, Railway, Render, VPS). Di Vercel file ini tidak dipakai, makanya sengaja ditaruh di folder `local/`, bukan di root.

---

## Kalau ada masalah

| Gejala | Penyebab / solusi |
|---|---|
| Layar "Fungsi server error (500)" | Halaman kebuka tapi fungsi di `api/` crash. **Bukan soal API key.** Buka `https://domainmu.vercel.app/api/config` di browser: kalau ada tulisan `Cannot find module ...` atau `isi api/_lib: ...`, berarti file itu tidak ikut ke-upload. Lengkapi repo (lihat *Isi repo yang benar*), Redeploy. Kalau cuma tertulis `FUNCTION_INVOCATION_FAILED`, lihat **Vercel → project → Logs**, dan pastikan Framework Preset = *Other* |
| Layar "Folder api/ tidak ketemu" (404) | Folder `api/` tidak ada di root repo (upload folder gagal, atau terbungkus folder `anykey-ai/` ekstra). Perbaiki lalu **Redeploy** |
| Layar "Server API tidak menjawab" | Koneksi putus, atau `index.html` dibuka langsung dari file. Jalankan lewat `npm start` / deploy ke Vercel |
| Tampilan memakai font biasa (bukan font AnyKey) | Folder `public/vendor/fonts/` tidak ikut ke-upload. Situs tetap jalan, tapi lengkapi repo supaya font ikut |
| Claude Opus atau Gemini 3 Pro terkunci 🔒 | Itu disengaja. Masukkan password lewat tombolnya. Kalau tetap tidak bisa, pastikan `ACCESS_PASSWORD` sudah diisi di Vercel lalu **Redeploy** |
| "Batas pemakaian key server tercapai" atau kuota habis | Batas per IP (`SERVER_KEY_LIMIT`) atau kuota key synoxcloud habis. Cek paket di synoxcloud, atau pengunjung isi key sendiri |
| "Base URL mengarah ke alamat lokal/privat dan diblokir…" | Alamat lokal/privat (`localhost`, `192.168.x.x`, dll.) diblokir demi keamanan. Pakai alamat publik, atau untuk self-host set `ALLOW_PRIVATE_URLS=1` |
| "API key ditolak (401)" | Key salah atau tidak cocok dengan provider yang dipilih |
| Jawaban terputus di tengah / error 504 | Fungsi Vercel kena batas waktu. Project baru sudah 300 detik (Fluid Compute). Di project lama: **Settings → Functions** → aktifkan Fluid Compute / naikkan Function Max Duration |
| Halaman malah minta login Vercel | Itu *Deployment Protection*. Pakai domain utama (`nama-project.vercel.app`) atau atur di **Settings → Deployment Protection** |
| Model tidak muncul di daftar | Klik **Muat daftar** di Pengaturan, atau ketik nama model manual |

---

## Keamanan

- **Jangan pernah menaruh API key di file repo.** Repo publik bisa dibaca siapa saja, dan upload lewat website GitHub tidak menghormati `.gitignore`. Taruh key di *Environment Variables* Vercel. Kalau key sempat tertulis di tempat publik, anggap bocor dan buat ulang.
- Server hanya meneruskan request ke provider: tidak menyimpan dan tidak mencatat (log) key maupun isi chat.
- Key milik server **tidak pernah dikirim ke Base URL pilihan pengunjung** dan tidak pernah dikirim ke browser.
- Base URL Custom diperiksa (anti-SSRF): alamat lokal/privat, kredensial di URL, dan redirect ditolak.
- Jawaban AI dirender aman (HTML mentah di-escape, gambar jarak jauh jadi tautan) dan situs memakai Content-Security-Policy ketat.
- Key yang disimpan di browser bisa dilihat siapa pun yang memakai browser itu. Di perangkat bersama, matikan **Ingat API key di browser ini** atau pakai **Hapus semua data** di Pengaturan.

---

## Struktur

```
api/
  chat.js        POST  /api/chat     kirim pesan, balas streaming (SSE)
  models.js      POST  /api/models   ambil daftar model dari provider
  config.js      GET   /api/config   daftar provider + status key server
  _lib/          adapter provider, keamanan, helper (bukan endpoint)
public/          tampilan (HTML/CSS/JS statis, font & library sudah ikut)
local/           server lokal opsional (npm start); tidak dipakai Vercel
vercel.json      header keamanan + pengaturan output
```

Menambah provider yang kompatibel OpenAI cukup dengan menambah satu objek di `PROVIDERS` pada `api/_lib/providers.js`.

Lisensi library dan font pihak ketiga: `public/vendor/NOTICE.txt`.
