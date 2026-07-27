# Roadmap & Breakdown Task

> Disusun untuk **solo developer, proyek hobi** — per fase adalah milestone kecil yang selesai-utuh dan menyenangkan untuk dicapai, tanpa deadline keras. Urutannya sengaja: **buktikan gamenya seru dulu (Fase 1–2), baru investasi infrastruktur (Fase 3–4)**. Angka desain diambil dari [GAME-DESIGN.md](./GAME-DESIGN.md); struktur teknis dari [ARCHITECTURE.md](./ARCHITECTURE.md).

## Fase 0 — Fondasi Repo ✅

- [x] Scaffold monorepo pnpm workspaces (`apps/*`, `packages/*`)
- [x] TypeScript strict + ESLint 9 flat config + Prettier konsisten di semua workspace
- [x] `packages/shared`: tipe domain awal (Pixel, Player, RoomState) + konstanta balancing dari GDD
- [x] Script root: `dev` / `build` / `typecheck` / `lint` / `test` / `format` via `pnpm -r`
- [x] GitHub Actions: typecheck + lint + format check + test tiap push
- [x] Requirement mobile ditetapkan di GDD §7 + ARCHITECTURE §8
- [x] Perbarui README (cara menjalankan dev)

## Fase 1 — Solo Playable ("first fun") 🎯

- [x] Engine aturan main di `packages/shared` (pure functions): spawn pixel, lifetime, skor + speed bonus, combo, kurva level, seeded RNG
- [x] Unit test engine (80 test: skor, combo reset, batas kurva kesulitan, determinisme, kemurnian fungsi)
- [x] Halaman `/play/solo`: mount Phaser lewat dynamic import di dalam effect (tanpa SSR)
- [x] Renderer grid 8×8 + siklus hidup pixel (spawn → redup → expire) + glyph buta warna
- [x] Input pointer (mouse + touch satu jalur, hit-area selebar sel) + resolusi lewat engine shared
- [x] HUD **sebagai DOM/React**: warna target (+ kedip peringatan), skor, combo meter, 3 nyawa, level
- [x] **Layout mobile-first**: canvas `Scale.FIT` responsif dan dibatasi tinggi viewport, kolom tunggal, `touch-action: none`, viewport tanpa double-tap zoom, tombol ≥48px
- [x] Pause / resume (membekukan seluruh state) + game over + restart
- [x] High score di `localStorage`
- [x] Scaffold i18n `next-intl` (id default + en) — semua string UI lewat kamus
- [x] SFX dasar via WebAudio (tanpa file aset): klik benar / salah / game over + toggle mute + getar
- [x] Landing page sederhana → tombol "Main Solo"

**✅ Milestone:** kamu sendiri betah main ≥3 ronde berturut-turut, **dan dicoba langsung di HP** (bukan cuma DevTools). Kalau belum seru, ulik angka balancing di `shared/constants` sebelum lanjut — **jangan masuk Fase 2 dengan core loop yang hambar.**

> Status: fungsinya sudah lengkap dan lolos uji otomatis di viewport HP (390×844). **Yang belum: penilaian "seru atau tidak" oleh kamu sendiri di HP nyata.** Itu gerbang menuju Fase 2 — angka di `packages/shared/src/constants/game.ts` (terutama `TARGET_COLOR_SPAWN_WEIGHT`, `INITIAL_SPAWN_INTERVAL_MS`, `INITIAL_LIFETIME_MS`) adalah yang paling layak diulik.

## Fase 1.5 — Kedalaman Solo ✅

Ditambahkan setelah playtest pertama. Keluhannya: gamenya terasa terlalu sederhana, dan mati di level 6 berarti mengulang 2-3 menit bagian mudah. Pengukuran membenarkan keduanya — dan menemukan kurva kesulitan yang sebagian saling meniadakan.

- [x] **Rename ke Pixel Matrix** — "Pixel Pulse" sudah dipakai game lain (lihat [COMPETITIVE-RESEARCH.md](./COMPETITIVE-RESEARCH.md)). Key `localStorage` dimigrasi supaya rekor yang sudah ada tidak hilang
- [x] **Kurva kesulitan diperbaiki**: interpolasi eksplisit Lv 1 → Lv 20; jumlah pixel hidup sekarang MENURUN (2,50 → 2,00), dulu justru naik
- [x] **Bonus poin per level** ×1 → ×2, jadi bertahan di level sulit akhirnya dibayar (poin maks/klik 40 → 80)
- [x] **`BoardState.level` eksplisit** — prasyarat supaya multiplayer papan-rebutan tidak menurunkan kesulitan dari klik satu pemain
- [x] **Checkpoint tiap 5 level + continue 2×** — menjawab keluhan utama
- [x] **Pixel spesial**: bom ☠ (Lv 8+), emas ★ (Lv 3+), nyawa ♥ (Lv 5+)
- [x] **Dua warna target** dari Lv 12, bobot spawn total tetap
- [x] **Mode chaos** Lv 21+: 4 modifier acak deterministik dari seed
- [x] **`?level=N` khusus development** — alat balancing dan uji E2E level tinggi
- [x] Riset pembanding ditulis ke [COMPETITIVE-RESEARCH.md](./COMPETITIVE-RESEARCH.md)

**✅ Milestone:** 153 unit test hijau, semua mekanik terverifikasi end-to-end di viewport HP. **Gerbang berikutnya tetap sama: kamu sendiri harus merasa gamenya seru di HP nyata** sebelum Fase 2 dimulai.

> Konstanta yang paling layak diulik saat balancing ada di `packages/shared/src/constants/game.ts`: `TARGET_COLOR_SPAWN_WEIGHT` (0.5 — paling berpengaruh ke "rasa"), `MIN_LIFETIME_MS` (1000 — jendela reaksi tersulit), `BOMB_MIN_CHANCE`/`BOMB_MAX_CHANCE`, dan `MAX_LEVEL_BONUS_MULTIPLIER` (setel 1 untuk mematikan bonus level).

## Fase 2 — Multiplayer Vertical Slice ✅

- [x] `apps/game-server`: Express (`/health`) + Socket.IO + validasi payload (zod)
- [x] RoomManager: buat/join/leave room via kode 6 karakter, guest nickname, host reassignment, room bubar saat kosong
- [x] Error handling lobby: `ROOM_NOT_FOUND` / `ROOM_FULL` / `GAME_IN_PROGRESS` / `NICKNAME_TAKEN`
- [x] Lobby UI: daftar pemain, ready check, pengaturan host (max players, target skor, waktu)
- [x] Game loop otoritatif 20Hz per room memakai engine shared: spawn, expire, ganti target
- [x] Resolusi klik rebutan first-arrival + `game:pixelClaimed` / `game:clickRejected`
- [x] Rate limit ~8 klik/dtk/pemain + cooldown lokal 500 ms saat klik salah
- [x] Leaderboard live (di atas papan saat mobile, di samping saat desktop)
- [x] Kondisi menang (target skor / waktu habis) + sudden death saat seri
- [x] Layar hasil (peringkat, akurasi, combo terbaik) + tombol rematch
- [x] Handle disconnect: pemain keluar dari match, skor terakhir tetap di hasil
- [x] Join room gampang dari HP: input kode besar-besaran + tombol share/copy link undangan

**✅ Milestone:** terverifikasi otomatis di dua konteks browser mobile (390×844): lima kali dua pemain menap pixel yang sama hampir bersamaan, **tidak sekali pun keduanya dapat poin**. Layar hasil, peringkat, dan rematch berjalan; nol console error.

> **Ini fase paling bernilai di seluruh roadmap.** Riset pembanding menemukan bahwa solo mode punya banyak saingan yang sudah rilis (Tappy Tiles Colors Rush praktis game yang sama), sementara kombinasi "browser + kode room + 2-4 HP terpisah + satu papan rebutan" tidak ditemukan padanannya. Kalau harus memilih satu fase untuk diselesaikan, ini yang dipilih.

**Ditambahkan setelah playtest pertama di HP (di luar rencana awal):**

- [x] **Indikator warna target di multiplayer** — versi pertama tidak menampilkannya sama sekali, jadi pemain harus menebak warna mana yang benar. Bug, bukan fitur yang tertunda
- [x] **Avatar pemain** (8 karakter) yang dicap di sel yang berhasil direbut, supaya terasa memperebutkan papan yang sama dan bukan main sendiri-sendiri. Lihat [GAME-DESIGN §5](./GAME-DESIGN.md)
- [x] **Nyawa di multiplayer** (3, sama seperti solo) + **bom memotong 2 nyawa** di kedua mode. Nyawa habis = beku 5 detik lalu hidup lagi dengan nyawa penuh, bukan tereliminasi

**Dua deviasi dari rencana awal, keduanya disengaja:**

1. **Route-nya `/play/room` dengan `?code=`, bukan `/play/room/[code]`.** Pindah route berarti memutus socket dan join ulang — pemain yang baru masuk lobby akan langsung terlempar keluar lagi. Kode room tetap muncul di URL untuk link undangan, tapi hanya sebagai query.
2. **Room ditahan di status `finished` sampai pemain menutup layar hasil** lewat `room:backToLobby`. Versi pertama mengembalikan room ke `waiting` begitu match selesai — akibatnya client berpindah ke lobby sebelum sempat menggambar hasilnya, jadi layar hasil praktis tidak pernah terlihat.

**Yang belum dikerjakan dan sengaja ditunda ke Fase 3:** hasil match belum disimpan ke mana pun (belum ada database), dan pemain yang koneksinya putus di tengah match tidak bisa masuk kembali ke match yang sama.

## Fase 3 — Akun & Persistensi 🚧

- [x] PostgreSQL + Prisma di `packages/db`, skema sesuai ARCHITECTURE.md §4, migrasi awal terverifikasi terhadap Postgres 16 sungguhan
- [x] **Persistensi opsional**: tanpa `DATABASE_URL` game jalan penuh dan tidak menulis apa pun. `GET /health` melaporkan statusnya
- [x] Hasil match tersimpan ke `Match` + `MatchPlayer` (guest ikut tercatat, `userId` null)
- [ ] NextAuth: Google provider dulu (Discord/email menyusul) — **butuh kredensial OAuth darimu**
- [ ] Handshake Socket.IO membawa session token; guest tetap boleh join room
- [ ] `GET /api/v1/users/me` + `POST /api/v1/solo-scores` sesuai [API.md](./API.md) (envelope + status codes), termasuk validasi heuristik skor-vs-durasi
- [ ] `POST /api/v1/rooms/private` sebagai proxy auth ke game-server (menutup deviasi MVP dari API.md)
- [ ] Halaman profil: stats, win/loss, match history, solo high score (FR-09)
- [ ] Migrasi high score `localStorage` → akun saat login pertama

## Fase 4 — Deploy Publik & Polish

- [x] Deploy: Vercel (web) + Render (game-server) via Dockerfile + `render.yaml`, env & CORS produksi, wss
- [x] Ukur load & latency di build produksi dengan throttle 4G + CPU 4× → [PERFORMANCE.md](./PERFORMANCE.md). Payload event belum perlu dirampingkan
- [x] Juice: partikel, screen shake, popup combo & poin, nada SFX naik seiring combo, toggle mute (BGM belum ada)
- [x] Haptic feedback (`navigator.vibrate`) saat klik salah di HP
- [x] Landing page (cara main, tombol solo & multiplayer) — sudah ada sejak Fase 1
- [x] Cek load time < 3 dtk (NFR) — code splitting Phaser sudah bekerja, plus prefetch saat idle di landing & lobby. **Satu jalur masih meleset:** membuka `/play/solo` langsung butuh ~3,5 dtk; jalur normal (landing → tap, lobby → mulai) 1,3 dtk dan 0,8 dtk. Angka lengkap di [PERFORMANCE.md](./PERFORMANCE.md)
- [ ] Uji di HP nyata: Android Chrome + iOS Safari (bukan hanya emulasi DevTools) — **hanya kamu yang bisa melakukan ini**
- [x] Manifest PWA supaya bisa "Add to Home Screen" — memangkas friksi saat nongkrong
- [ ] Playtest dengan teman-teman → iterasi angka balancing GDD (**validasi di HP dulu**, lihat GDD §7)

> **Sisa Fase 4 hanya bisa kamu kerjakan:** uji di HP nyata (Android Chrome + iOS Safari) dan playtest bareng teman untuk mengulik angka balancing. Keduanya butuh perangkat dan orang sungguhan.

> **PWA tanpa service worker, disengaja.** Pemasangan ke home screen tetap jalan lewat menu browser di Android dan iOS; yang hilang hanya prompt install otomatis di Android. Menambah SW berarti menambah lapisan cache yang bisa menyajikan build lama setelah deploy. Konsekuensinya: tidak ada mode offline, termasuk untuk solo yang sebenarnya sanggup jalan tanpa jaringan.

## Fase 5 — Menuju PRD Penuh (opsional, urutan bebas)

- [ ] Public matchmaking (FR-02 "Join Public Match")
- [ ] Kosmetik + IAP (FR-10) — kaji gateway: **Midtrans/Xendit untuk pasar Indonesia**, bukan hanya USD seperti contoh API.md
- [ ] Admin dashboard: DAU, CCU, total games (FR-11) + user management & ban (FR-12)
- [ ] Leaderboard global solo
- [ ] Reconnect mid-match (stretch goal dari Fase 2)
- [ ] Load test k6/Artillery, lalu jalur scale-out (Redis adapter + sticky session) bila perlu

## Cara Verifikasi per Fase

| Fase | Uji |
|---|---|
| 0 | `pnpm install` lalu `pnpm typecheck && pnpm lint && pnpm test` hijau; CI hijau |
| 1.5 | `?level=8` bom mengurangi nyawa & emas membayar ×5; `?level=12` dua swatch warna target; `?level=21` badge chaos tampil; mati 3× → tombol "Lanjut dari Lv N", continue ketiga tidak ditawarkan |
| 1 | Mainkan sendiri di localhost: skor/combo/nyawa/pause sesuai GDD; refresh → high score bertahan. **Lalu buka dari HP** (via IP LAN): papan pas di layar, tap responsif, tidak ada scroll/zoom liar |
| 2 | Dua tab browser + satu incognito (3 "pemain"): skor sinkron; klik rebutan hanya dimenangkan satu pemain; spam klik terkena rate limit; tutup satu tab → match jalan terus. Ulangi dengan 2 HP nyata |
| 3 | Login Google; main solo → skor muncul di profil & DB; main MP → match history terisi (guest tercatat sebagai nickname) |
| 4 | Main dari 2 jaringan berbeda via URL publik; input terasa < 150 ms; load pertama < 3 dtk; uji di Android Chrome & iOS Safari |
