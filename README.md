# Transkripin — Ubah Suara Jadi Teks Gratis

Website fullstack (Next.js) untuk mentranskripsi audio menjadi teks **100% gratis, tanpa API berbayar**. Semua proses berjalan langsung di browser:

- **Mode Realtime** → [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) browser-native.
- **Mode Upload / Rekam → Whisper Lokal** → [Transformers.js](https://huggingface.co/docs/transformers.js) menjalankan model `Xenova/whisper-tiny` / `Xenova/whisper-base` di browser.

Tidak ada `OPENAI_API_KEY`, tidak ada Google Cloud, tidak ada AssemblyAI / Deepgram.

---

## Fitur

- Tab **Realtime** — Start / Pause / Resume / Stop, hasil tampil langsung, Copy, Download TXT, status `listening | paused | stopped | error`, peringatan jika browser tidak mendukung Web Speech API.
- Tab **Upload Audio** — drag-and-drop MP3 / WAV / M4A / WEBM / OGG (maks 25 MB), preview audio, transkripsi dengan Whisper lokal.
- Tab **Rekam + Whisper** — rekam dari microphone lalu transkripsi di browser.
- Pilihan bahasa: Auto, Indonesian, English, Japanese, Korean, Arabic.
- Pilihan output: Plain Text, Clean Paragraph, Timestamped Transcript.
- Hasil bisa: Copy, Download `.txt`, Download `.docx`, beri judul, simpan ke riwayat.
- Riwayat di **localStorage** (tanpa database). Hapus per item atau Clear All.
- Dark mode, responsive (HP & desktop), toast notification, loading state.

---

## Tech Stack

- Next.js 14 (App Router) · React 18 · TypeScript
- Tailwind CSS + shadcn/ui + lucide-react + Framer Motion
- `@xenova/transformers` — ASR lokal (Whisper) di browser
- Web Speech API — realtime
- MediaRecorder API — perekaman audio
- `docx` + `file-saver` — export `.docx` / `.txt`

---

## Cara Menjalankan

```bash
# 1. Install dependencies
npm install

# 2. (Opsional) — file .env tidak diperlukan; salin saja contohnya
cp .env.example .env

# 3. Development
npm run dev
# Buka http://localhost:3000

# 4. Build production
npm run build
npm start
```

> **Tidak perlu API key apapun.** File `.env` boleh kosong.

---

## Perubahan dari Versi Lama (OpenAI)

### Dihapus

- Endpoint API: `src/app/api/transcribe`, `improve`, `summarize`, `meeting-notes`, `transcripts`, `auth/**`.
- Halaman auth: `src/app/login`, `src/app/register`, `src/app/dashboard`.
- File: `src/lib/auth.ts`, `src/lib/openai.ts`, `src/lib/prisma.ts`, `src/lib/rate-limit.ts`, `src/types/next-auth.d.ts`.
- Folder `prisma/` (skema database NextAuth).
- Env var: `OPENAI_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

### Dependency yang Dihapus

`openai`, `next-auth`, `@auth/prisma-adapter`, `@prisma/client`, `prisma`, `bcryptjs`, `@types/bcryptjs`, `zod`, `@radix-ui/react-dropdown-menu`.

### Dependency Baru

`@xenova/transformers` (^2.17.2) — ASR lokal Whisper.

### Komponen Baru

- `RealtimeSpeech.tsx` — Web Speech API.
- `LocalWhisperTranscriber.tsx` — Whisper via Transformers.js.
- `BrowserSupportWarning.tsx` — banner peringatan kompatibilitas.
- `LoadingModelStatus.tsx` — progress unduh / load / transkripsi model.

### Komponen Diubah

- `Navbar.tsx` — hapus tombol login/logout, ganti branding ke **Transkripin**.
- `Providers.tsx` — hapus `SessionProvider`.
- `TranscriptResult.tsx` — hapus tombol Improve / Summary / Meeting Notes (yang memakai OpenAI), ganti dengan editor judul + Save to History (localStorage).
- `TranscriptHistory.tsx` — pindah dari API + database ke `localStorage`.
- `LanguageSelector.tsx` — tambahkan BCP-47 locale untuk Web Speech API dan kode bahasa Whisper.
- `page.tsx`, `layout.tsx` — rebrand & restructure ke 3 tab (Realtime / Upload / Rekam).

---

## Batasan Versi Gratis

- **Web Speech API**: hanya tersedia di Chromium-based browser (Chrome, Edge, Opera, Brave). Firefox & sebagian Safari tidak mendukung. Chrome mengirim audio ke layanan Google untuk dikenali — tetap gratis untuk Anda dan tanpa API key, tetapi tidak sepenuhnya offline.
- **Whisper lokal (Transformers.js)**:
  - Unduhan awal model: ±75 MB (tiny) atau ±145 MB (base). Setelahnya dicache browser.
  - Butuh device cukup kuat (RAM 4 GB+ disarankan). Mobile low-end bisa lambat / gagal.
  - Disarankan audio pendek **1–10 menit**.
  - Maksimum file: **25 MB** (untuk menjaga memori browser).
  - Bahasa Auto Detect hanya bekerja sempurna pada model multilingual.
- Riwayat disimpan di `localStorage` browser yang sama. Bersihkan cookies/data = riwayat hilang.

---

## Opsional: Server Self-Hosted (whisper.cpp)

Jika Anda butuh transkripsi file panjang / batch, Anda bisa menjalankan [whisper.cpp](https://github.com/ggerganov/whisper.cpp) di VPS sendiri. Tetap **gratis dari sisi API**, tapi butuh server.

Garis besar struktur opsional:

```
server/
  whisper.cpp/        # build whisper.cpp di sini
  upload-endpoint/    # contoh: Node/Express menerima file
  transcribe-endpoint # memanggil ./main -m models/ggml-base.bin -f input.wav
```

Catatan: integrasi ini **tidak disertakan** di repo ini karena prioritas utama adalah versi browser. Tambahkan sendiri jika perlu.

---

## Privasi

- Mode Whisper Lokal: audio Anda **tidak pernah meninggalkan browser**.
- Mode Realtime (Web Speech API): vendor browser (mis. Google untuk Chrome) memproses audio.
- Tidak ada audio yang disimpan permanen. `localStorage` hanya menyimpan **teks** hasil + metadata (judul, bahasa, ukuran file).
- Tombol **Clear All History** menghapus semua data riwayat.
