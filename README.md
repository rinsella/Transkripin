# Transkripin

> **Ubah suara jadi teks — gratis, open-source, self-hostable.**
> Frontend Next.js + Backend FastAPI + [faster-whisper](https://github.com/SYSTRAN/faster-whisper).
> Tidak menggunakan OpenAI API, Google Cloud, AssemblyAI, Deepgram, atau API berbayar lain.

Sebelumnya Transkripin menjalankan Whisper di browser via Transformers.js
(berat, lambat untuk audio panjang, dan membebani device pengguna).
Sejak **v2.0** semua proses transkripsi dipindah ke **server-side**.

| | Sebelum (v1) | Sekarang (v2) |
|---|---|---|
| Engine | Transformers.js + ONNX | **faster-whisper (CTranslate2)** |
| Lokasi proses | Browser (Web Worker) | **Server FastAPI** |
| Model | Diunduh ke browser ±75–145 MB | Diunduh sekali di server |
| Cocok untuk | File pendek | File panjang & banyak user |

---

## Arsitektur

```
┌────────────────────┐     audio FormData     ┌──────────────────────────┐
│  Next.js Frontend  │ ─────────────────────▶ │  FastAPI Backend         │
│  - Upload/Rekam UI │                        │  - validasi + ffmpeg     │
│  - Tampilkan hasil │ ◀───── JSON text ───── │  - faster-whisper        │
└────────────────────┘                        └──────────────────────────┘
```

---

## 1. Jalankan Frontend (Next.js)

```bash
# di root project
cp .env.example .env.local        # set NEXT_PUBLIC_TRANSCRIBE_API_URL
npm install
npm run dev                       # http://localhost:3000
```

`.env.local`:

```env
NEXT_PUBLIC_TRANSCRIBE_API_URL=http://localhost:8000
```

---

## 2. Jalankan Backend (FastAPI + faster-whisper)

### Prasyarat: install **ffmpeg**

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows (winget)
winget install Gyan.FFmpeg
```

### Jalankan secara lokal

```bash
cd server
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # sesuaikan MODEL_SIZE dll.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Cek kesehatan:

```bash
curl http://localhost:8000/health
# {"status":"ok","engine":"faster-whisper",...}
```

### Test transkripsi

```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@/path/to/audio.mp3" \
  -F "language=auto" \
  -F "model_size=base" \
  -F "output_mode=plain"
```

---

## 3. Jalankan Backend via Docker

```bash
cd server
docker build -t transkripin-server .
docker run --rm -p 8000:8000 \
  -e MODEL_SIZE=base -e DEVICE=cpu -e COMPUTE_TYPE=int8 \
  -e CORS_ORIGINS=http://localhost:3000 \
  -v transkripin-models:/data \
  transkripin-server
```

Volume `transkripin-models` menyimpan cache model agar tidak diunduh ulang.

---

## 4. API Backend

### `GET /health`
```json
{ "status": "ok", "engine": "faster-whisper", "model_loaded": "base",
  "device": "cpu", "compute_type": "int8" }
```

### `POST /transcribe` (multipart/form-data)

| field | tipe | keterangan |
|---|---|---|
| `file` | file | audio (`mp3`, `wav`, `m4a`, `webm`, `ogg`, `flac`, `mp4`) |
| `language` | string opsional | `id`, `en`, `ja`, `ko`, `ar`, `zh`, atau kosong = auto |
| `model_size` | string | `tiny` \| `base` \| `small` \| `medium` \| `large-v3` |
| `output_mode` | string | `plain` \| `paragraph` \| `timestamped` |

Response:
```json
{
  "success": true,
  "text": "…",
  "segments": [{ "start": 0.0, "end": 5.2, "text": "…" }],
  "language": "id",
  "duration": 649.0,
  "model": "base"
}
```

### `POST /cleanup`
Bersihkan sisa file sementara di server.

---

## 5. Konfigurasi Backend (ENV)

| ENV | default | keterangan |
|---|---|---|
| `MODEL_SIZE` | `base` | model default yang di-preload |
| `DEVICE` | `cpu` | `cpu` atau `cuda` |
| `COMPUTE_TYPE` | `int8` | `int8` (CPU) atau `float16` (GPU) |
| `MAX_UPLOAD_MB` | `100` | batas ukuran upload |
| `MAX_AUDIO_DURATION_MINUTES` | `60` | batas durasi audio |
| `TRANSCRIBE_TIMEOUT_SECONDS` | `1800` | timeout transkripsi |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated |
| `MODEL_CACHE_DIR` | _kosong_ | folder cache model |
| `TMP_DIR` | OS tmp | folder upload sementara |

---

## 6. Deploy ke **Railway** (backend)

> Backend ada di subfolder `server/`. Pastikan Railway membuild dari
> folder tersebut (bukan root), supaya `Dockerfile` ditemukan dan
> dependency frontend tidak ikut ter-build.

1. **New Project → Deploy from GitHub repo** → pilih repo `Transkripin`.
2. Di **Settings → Service → Source**:
   - **Root Directory**: `server`
   - Builder: **Dockerfile** (auto-detect via `railway.toml`).
3. **Variables** (Settings → Variables):
   ```env
   MODEL_SIZE=base
   DEVICE=cpu
   COMPUTE_TYPE=int8
   MAX_UPLOAD_MB=100
   MAX_AUDIO_DURATION_MINUTES=60
   TRANSCRIBE_TIMEOUT_SECONDS=1800
   CORS_ORIGINS=https://<frontend-domain>
   # Atau regex untuk cover banyak preview domain Vercel/Codespaces:
   CORS_ORIGIN_REGEX=https://.*\.vercel\.app|https://.*\.app\.github\.dev
   ```
4. Tambah **Volume** ke path `/data` (≥1 GB) supaya cache model & HF
   tidak terhapus saat redeploy.
5. **Networking → Generate Domain** untuk dapat URL publik
   `https://<service>.up.railway.app`. Verifikasi:
   ```bash
   curl https://<service>.up.railway.app/health
   ```
6. Deploy **frontend** terpisah (Vercel direkomendasikan), dengan env:
   ```env
   NEXT_PUBLIC_TRANSCRIBE_API_URL=https://<service>.up.railway.app
   NEXT_PUBLIC_SITE_URL=https://<frontend-domain>
   ```

> ⚠️ **Memory**: faster-whisper `base` butuh ±400 MB RAM saat aktif.
> Pilih plan Railway minimal 1 GB. Untuk file panjang naikkan ke 2 GB.

---

## 7. Deploy ke **Render**

1. **New → Web Service → Docker** → arahkan ke folder `server/`.
2. Render otomatis menggunakan `$PORT` (sudah dihandle `CMD`).
3. Set env yang sama seperti Railway.
4. Deploy frontend sebagai Web Service / Static Site terpisah, set
   `NEXT_PUBLIC_TRANSCRIBE_API_URL` ke URL Render backend.

> Catatan: **free tier** Render/Railway bisa lambat & sleep. Untuk audio
> panjang (>10 menit) gunakan plan berbayar atau VPS.

---

## 8. Deploy ke **VPS pribadi**

```bash
# di VPS
sudo apt update && sudo apt install -y docker.io
git clone https://github.com/<you>/Transkripin.git && cd Transkripin/server
docker build -t transkripin-server .
docker run -d --name transkripin --restart=unless-stopped \
  -p 127.0.0.1:8000:8000 \
  -e MODEL_SIZE=base -e DEVICE=cpu -e COMPUTE_TYPE=int8 \
  -e CORS_ORIGINS=https://transkripin.example.com \
  -v transkripin-models:/data \
  transkripin-server
```

Nginx reverse proxy (`/etc/nginx/sites-available/api.transkripin.conf`):

```nginx
server {
  listen 80;
  server_name api.transkripin.example.com;
  client_max_body_size 150M;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
  }
}
```

Aktifkan HTTPS dengan certbot, lalu set di frontend:
```
NEXT_PUBLIC_TRANSCRIBE_API_URL=https://api.transkripin.example.com
```

---

## 9. Catatan Performa

- `tiny` — paling ringan, cocok untuk server kecil / VPS 1 vCPU.
- `base` — seimbang, **rekomendasi** untuk kebanyakan kasus.
- `small` — lebih akurat tapi 3–4× lebih lambat di CPU.
- `medium` / `large-v3` — perlu RAM besar (≥8 GB) atau GPU.
- Untuk **banyak user concurrent**, pertimbangkan queue system
  (Redis + RQ/Celery). Endpoint sekarang sinkron (cukup untuk MVP).

---

## 10. Security

- Validasi ekstensi & MIME audio.
- Batas ukuran upload (`MAX_UPLOAD_MB`) & durasi (`MAX_AUDIO_DURATION_MINUTES`).
- File temporary disimpan dengan UUID, dihapus otomatis di `finally`.
- CORS dikunci ke domain frontend via `CORS_ORIGINS`.
- Folder upload **tidak** di-expose publik.
- Timeout proses transkripsi (`TRANSCRIBE_TIMEOUT_SECONDS`).

---

## 11. Struktur Folder

```
Transkripin/
├── src/                            # Frontend Next.js
│   ├── app/page.tsx                # UI utama (server-side transcriber)
│   ├── components/
│   │   ├── ServerTranscriber.tsx   # ← komponen baru, panggil backend
│   │   ├── AudioUploader.tsx
│   │   ├── AudioRecorder.tsx
│   │   ├── RealtimeSpeech.tsx      # ← Web Speech API tetap dipertahankan
│   │   └── …
│   └── lib/api.ts                  # transcribeAudio()
├── server/                         # Backend FastAPI
│   ├── app/
│   │   ├── main.py                 # endpoints /health, /transcribe, /cleanup
│   │   ├── transcriber.py          # wrapper faster-whisper
│   │   ├── audio_utils.py          # ffmpeg/ffprobe helpers
│   │   └── schemas.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── next.config.js                  # disederhanakan (tanpa stub onnx)
└── README.md
```

---

## Lisensi

MIT.
