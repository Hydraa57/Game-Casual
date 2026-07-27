# Game Otak Santai Bareng — "Pixel Matrix"

Game casual berbasis browser: refleks arcade + sentuhan brain-training, gaya retro pixel art. Bisa dimainkan solo (endless, kejar high score) atau bareng 2–4 teman secara real-time di satu papan yang sama — cukup bagikan kode room, tanpa install apa pun. **Dirancang mobile-first** karena skenario utamanya dimainkan bareng-bareng saat nongkrong, dari HP masing-masing.

**Status: 🎮 Solo mode lengkap** (Fase 1 + 1.5 selesai) — kurva kesulitan sampai Lv 20, checkpoint & continue, pixel bom/emas/nyawa, dua warna target, dan mode chaos. Multiplayer menyusul di Fase 2, dan menurut [riset pembanding](docs/COMPETITIVE-RESEARCH.md) itulah pembeda sesungguhnya produk ini.

## Dokumen

| Dokumen | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document — visi, functional & non-functional requirements, KPI, risiko |
| [docs/API.md](docs/API.md) | Kontrak REST API — format response, endpoint user/room/skor/shop |
| [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) | Spesifikasi gameplay Pixel Matrix — papan, skor, combo, kurva kesulitan, aturan multiplayer rebutan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arsitektur teknis — struktur monorepo, kontrak event Socket.IO, skema database, deployment |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Roadmap per fase + checklist task + cara verifikasi |
| [docs/COMPETITIVE-RESEARCH.md](docs/COMPETITIVE-RESEARCH.md) | Riset pembanding — game apa saja yang sudah mirip, dan di mana pembeda produk ini |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Hasil ukur load time & latency di build produksi dengan throttle seluler |

## Keputusan Kunci

- **MVP = vertical slice**: solo mode + private room multiplayer. IAP, admin panel, dan public matchmaking menyusul (Fase 5).
- **Guest dulu, auth belakangan**: di MVP siapa pun bisa buat/gabung room dengan nickname — teman bisa langsung main. NextAuth + PostgreSQL masuk di Fase 3.
- **Multiplayer papan rebutan**: 2–4 pemain berebut pixel di papan yang sama; server otoritatif memutus siapa cepat dia dapat.
- **Monorepo, satu sumber aturan main**: logika game hidup di `packages/shared` dan dipakai client (solo) maupun server (multiplayer) — keduanya dijamin identik.
- **Kedalaman lewat beban mental, bukan cuma kecepatan**: warna target berganti, distraktor bertambah, dua warna target di Lv 12+, dan pixel bom yang menghukum karena *disentuh* — bukan karena diabaikan.
- **Mobile-first**: papan tetap 8×8 di semua device (hanya ukurannya yang di-scale), HUD dibuat DOM/React agar responsif, target sentuh ≥44px. Detail di [GAME-DESIGN.md §7](docs/GAME-DESIGN.md).
- **Bilingual sejak awal**: UI Indonesia (default) + English via next-intl.

## Stack (rencana)

Next.js + Phaser (Vercel) · Node + Socket.IO (Render/Fly.io) · PostgreSQL + Prisma · NextAuth — rasional lengkap di [PRD.md](docs/PRD.md#technology-stack--rationale).

## Struktur Repo

```
apps/web/          Next.js + Phaser — landing page & solo mode
apps/game-server/  Socket.IO game server — room, lobby, match otoritatif
packages/shared/   Tipe, konstanta balancing, engine aturan main
packages/db/       Prisma + PostgreSQL — riwayat match & akun (OPSIONAL)
docs/              Blueprint & planning
```

`packages/shared` (`@pixelmatrix/shared`) adalah satu-satunya sumber aturan main. Scene Phaser hanya menggambar papan dan meneruskan tap; HUD dibuat sebagai DOM/React agar responsif di layar kecil.

## Development

Butuh Node ≥20 dan pnpm 10.

```bash
pnpm install
pnpm dev          # web :3000 + game-server :3001, keduanya listen di 0.0.0.0
pnpm typecheck    # tsc di semua workspace
pnpm lint         # eslint
pnpm test         # vitest (engine aturan main)
pnpm build        # production build
pnpm format       # prettier --write
```

### Main dari HP

`pnpm dev` sudah listen di semua interface, jadi buka `http://<IP-komputermu>:3000` dari HP yang satu WiFi (cek IP dengan `ip addr` / `ifconfig`). Kalau Next memblokir permintaannya, tambahkan IP-nya ke `allowedDevOrigins` di `apps/web/next.config.ts`.

Client mencari game-server di host yang sama pada port 3001, jadi multiplayer dari HP jalan tanpa konfigurasi tambahan. Untuk menimpanya, set `NEXT_PUBLIC_GAME_SERVER_URL`.

## Deployment

**Web dan game-server harus di-deploy terpisah.** Ini bukan pilihan gaya: game-server memegang state room di memori dan menjaga koneksi WebSocket yang hidup selama match. Platform serverless — termasuk Vercel Functions — mematikan proses di antara request, jadi tidak bisa menjalankannya.

Kalau hanya web-nya yang di-deploy, **solo mode tetap jalan** (seluruh permainannya di browser), tapi halaman multiplayer akan menampilkan "Game server tidak terjangkau" karena memang tidak ada yang bisa dihubungi.

### 1. Deploy game-server

**Jalur tercepat — Render Blueprint.** Sudah ada [`render.yaml`](render.yaml) di root: buka Render → **New → Blueprint** → pilih repo ini. Render membaca file itu dan membuat service-nya sendiri (Docker, region Singapura, health check `/health`, `CORS_ORIGIN` sudah terisi). Free tier Render tidak minta kartu kredit.

**Host lain** — [`apps/game-server/Dockerfile`](apps/game-server/Dockerfile) host-agnostic, jalan di Fly.io, Railway, Koyeb, atau VPS biasa. Build context-nya **root repo**, bukan folder `apps/game-server`:

```bash
docker build -f apps/game-server/Dockerfile -t pixelmatrix-server .
docker run -p 3001:3001 -e CORS_ORIGIN=https://<domain-web-mu> pixelmatrix-server
```

Yang wajib dicek:

| Env | Isi | Kenapa |
|---|---|---|
| `CORS_ORIGIN` | origin web-nya, misal `https://pixel-matrix.vercel.app` | Default-nya `*` — aman untuk dev, tidak untuk produksi |
| `PORT` | biasanya diisi otomatis oleh host | Server membacanya dari env |
| `AUTH_SECRET` | string acak panjang, **sama persis dengan di Vercel** | Web menandatangani token identitas, game-server memverifikasinya. Beda atau kosong = semua pemain dianggap guest |
| `DATABASE_URL` | opsional | Tanpa ini game jalan penuh, hanya riwayat match yang tidak tersimpan |

Pastikan host-nya memberi **HTTPS**. Halaman web yang https tidak boleh membuka koneksi ke `ws://` biasa — browser memblokirnya sebagai mixed content, dan gejalanya sama persis dengan server mati.

### 2. Arahkan web ke game-server

Di Vercel: **Settings → Environment Variables**, tambahkan untuk environment Production:

```
NEXT_PUBLIC_GAME_SERVER_URL=https://<nama-service>.onrender.com
DATABASE_URL=<connection string Supabase/Neon>
AUTH_SECRET=<string acak panjang, sama persis dengan di game-server>
```

Buat `AUTH_SECRET` dengan `openssl rand -hex 32`. Ini yang menautkan hasil match ke akun: web menandatangani identitas pemain, game-server memverifikasinya. Kalau nilainya beda di kedua tempat, tidak ada yang rusak — semua pemain sekadar dianggap guest.

**Deploy ulang setelah menyetelnya** (Deployments → ⋯ → Redeploy). Variabel `NEXT_PUBLIC_*` dibaca saat build, bukan saat halaman dibuka — mengubahnya di dashboard saja tidak berpengaruh sampai ada build baru. Ini penyebab paling umum "sudah diset kok masih error".

Selama env ini belum ada, client menebak `https://<domain-web>:3001` — port yang tidak pernah ada di Vercel. Itulah persisnya pesan error yang muncul di halaman multiplayer.

### 3. Pastikan

Buka `https://<alamat-game-server>/health` di browser. Kalau membalas `{"ok":true,...}`, server-nya hidup. Setelah itu halaman multiplayer harus menunjukkan status "tersambung".

Kalau masih gagal, pesan errornya sekarang menyebutkan alamat yang dicoba — itu petunjuk pertama yang perlu dilihat.

> **Catatan free tier:** Render menidurkan instance yang idle. Efeknya yang perlu diketahui: saat pertama membuka halaman multiplayer setelah lama tidak dipakai, statusnya **akan** menunjukkan "terputus" dulu selama 30–60 detik sementara server bangun, lalu berubah sendiri ke "tersambung" — client-nya mencoba ulang otomatis, jadi tidak perlu refresh. Untuk main di tongkrongan ini terasa; kalau mengganggu, pakai paket yang tidak tidur atau Fly.io.

> **Latensi itu penting di game ini.** Pemenang klik rebutan ditentukan dari urutan kedatangan di server, jadi jarak fisik ke server langsung memengaruhi keadilannya. `render.yaml` sudah menyetel region **Singapura** (~30 ms dari Indonesia) alih-alih default Oregon (~200 ms). Kalau deploy manual tanpa Blueprint, pastikan pilih region terdekat.

## Database (opsional)

**Game jalan penuh tanpa database.** Kalau `DATABASE_URL` tidak diset, room hidup di memori dan high score solo di `localStorage` — persis seperti sekarang. Yang hilang hanya riwayat match. Ini bukan keadaan sementara: syarat "teman bisa langsung main tanpa daftar" berarti database tidak boleh pernah jadi prasyarat bermain.

Untuk menyalakannya, set `DATABASE_URL` di game-server lalu jalankan migrasinya:

```bash
cd packages/db
cp .env.example .env    # isi DATABASE_URL
pnpm migrate            # dev: buat/terapkan migrasi
pnpm migrate:deploy     # produksi: terapkan migrasi yang sudah ada
```

Klien Prisma **tidak di-commit** — ia dibangkitkan oleh `postinstall` di `packages/db` setiap kali `pnpm install` berjalan, termasuk di Vercel dan di dalam image Docker. Tidak perlu `DATABASE_URL` untuk membangkitkannya, hanya schema-nya.

Cek `GET /health` di game-server: `persistence: true` berarti database terpasang, `false` berarti game berjalan tanpa penyimpanan.

Provider gratis yang cocok: Neon atau Supabase (keduanya Postgres, ada free tier). Pastikan region-nya dekat game-server.

> **Khusus Supabase — jalankan [`packages/db/supabase/rls.sql`](packages/db/supabase/rls.sql) setelah migrasi.** Supabase mengekspos semua tabel `public` lewat anon key, dan anon key memang dirancang untuk publik. Tanpa file itu, siapa pun yang punya anon key bisa mengunduh hash password dan token sesi. Skrip itu menutup semuanya kecuali tiga kolom yang dipakai leaderboard, dan tidak menyentuh akses aplikasi (Prisma konek sebagai pemilik tabel, yang melewati RLS).

### Kalau memakai Supabase

Ambil dari **Settings → Database → Connection string**. Ada tiga pilihan dan **yang benar berbeda untuk tiap layanan** — ini bukan detail kosmetik, salah pilih berarti koneksinya gagal total atau Prisma error di query pertama.

| Dipakai di | Mode | Port | Kenapa |
|---|---|---|---|
| **Render** (game-server) | **Session pooler** | 5432 | Proses hidup terus di jaringan IPv4. Mendukung prepared statement, jadi Prisma jalan tanpa flag tambahan |
| **Vercel** (web) | **Transaction pooler** | 6543 | Tiap request adalah proses baru. Wajib ditambah `?pgbouncer=true` — mode transaksi tidak mendukung prepared statement dan Prisma akan error tanpa itu |
| migrasi (`prisma migrate deploy`) | Session pooler atau Direct | 5432 | Direct connection di free tier hanya IPv6, jadi Session pooler biasanya yang jalan |

Bentuknya kira-kira begini (host lengkapnya salin dari dashboard, jangan dikarang):

```bash
# Render
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres"

# Vercel — perhatikan port 6543 DAN ?pgbouncer=true
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

> **Kalau mau satu string saja untuk keduanya**, pakai Session pooler (5432) di mana-mana. Itu tetap benar; yang dikorbankan hanya efisiensi koneksi di Vercel, dan itu baru terasa kalau trafiknya ramai. Yang **tidak** boleh: memakai Transaction pooler tanpa `?pgbouncer=true`.

> ⚠️ **Kalau migrasi pertama diterapkan lewat dashboard/API Supabase (bukan lewat Prisma)**, Prisma tidak tahu apa-apa soal itu — ia mencatat di tabelnya sendiri (`_prisma_migrations`), sementara Supabase mencatat di `supabase_migrations.schema_migrations`. Akibatnya `prisma migrate deploy` yang pertama akan mencoba membuat ulang tabel yang sudah ada, lalu gagal. Tandai dulu satu per satu:
>
> ```bash
> cd packages/db
> for m in 20260727023219_init 20260727031407_match_player_elimination \
>          20260727034059_credential_accounts 20260727035500_username_lower; do
>   DATABASE_URL="<url-session-pooler>" pnpm exec prisma migrate resolve --applied "$m"
> done
> ```
>
> Setelah itu `prisma migrate deploy` bekerja normal untuk migrasi berikutnya.

> **Jangan lupa jalankan [`packages/db/supabase/rls.sql`](packages/db/supabase/rls.sql).** Supabase mengekspos semua tabel `public` lewat anon key, dan anon key memang dirancang untuk publik — tanpa file itu, hash password dan token sesi bisa diunduh siapa saja.

## Pasang di HP (PWA)

Ada manifest + ikon, jadi game bisa dipasang ke home screen dan terbuka layar penuh tanpa address bar — berguna saat nongkrong: teman tinggal tap ikonnya.

- **Android Chrome:** menu ⋮ → *Add to Home screen*
- **iOS Safari:** tombol Share → *Add to Home Screen*

**Belum ada service worker**, dan itu disengaja. Tanpa SW, pemasangan tetap bisa lewat menu browser di kedua platform; yang hilang cuma prompt install otomatis di Android. Menambahkannya berarti menambah lapisan cache yang bisa menyajikan build lama setelah deploy — risiko yang tidak sebanding untuk keuntungan sekecil itu. Konsekuensi lain: **game tidak bisa dimainkan offline.** Multiplayer memang butuh jaringan, tapi solo mode sebenarnya bisa jalan offline kalau nanti SW-nya ditambahkan.

## Mulai dari Mana?

Lihat [ROADMAP.md](docs/ROADMAP.md). Fase 0, 1, dan 1.5 selesai; Fase 2 (multiplayer) sedang dikerjakan. Prinsip urutannya: **buktikan gamenya seru dulu, baru bangun infrastruktur.**
