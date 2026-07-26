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

## Fase 2 — Multiplayer Vertical Slice 🎯

- [ ] `apps/game-server`: Express (`/health`) + Socket.IO + validasi payload (zod)
- [ ] RoomManager: buat/join/leave room via kode 6 karakter, guest nickname, host reassignment, room bubar saat kosong
- [ ] Error handling lobby: `ROOM_NOT_FOUND` / `ROOM_FULL` / `GAME_IN_PROGRESS` / `NICKNAME_TAKEN`
- [ ] Lobby UI di `/play/room/[code]`: daftar pemain, ready check, pengaturan host (max players, target skor, waktu)
- [ ] Game loop otoritatif 20Hz per room memakai engine shared: spawn, expire, ganti target
- [ ] Resolusi klik rebutan first-arrival + `game:pixelClaimed` / `game:clickRejected`
- [ ] Rate limit ~8 klik/dtk/pemain + cooldown lokal 500 ms saat klik salah
- [ ] Leaderboard live (di atas papan saat mobile, di samping saat desktop)
- [ ] Kondisi menang (target skor / waktu habis) + sudden death saat seri
- [ ] Layar hasil (peringkat, akurasi, combo terbaik) + tombol rematch
- [ ] Handle disconnect: pemain keluar dari match, skor terakhir tetap di hasil
- [ ] Join room gampang dari HP: input kode besar-besaran + tombol share/copy link undangan

**✅ Milestone:** 2 HP di jaringan yang sama main bareng lancar; dua tap hampir bersamaan pada pixel yang sama → hanya satu yang dapat poin.

> **Ini fase paling bernilai di seluruh roadmap.** Riset pembanding menemukan bahwa solo mode punya banyak saingan yang sudah rilis (Tappy Tiles Colors Rush praktis game yang sama), sementara kombinasi "browser + kode room + 2-4 HP terpisah + satu papan rebutan" tidak ditemukan padanannya. Kalau harus memilih satu fase untuk diselesaikan, ini yang dipilih.

## Fase 3 — Akun & Persistensi

- [ ] PostgreSQL + Prisma, skema sesuai ARCHITECTURE.md §4
- [ ] NextAuth: Google provider dulu (Discord/email menyusul)
- [ ] Handshake Socket.IO membawa session token; guest tetap boleh join room
- [ ] `GET /api/v1/users/me` + `POST /api/v1/solo-scores` sesuai [API.md](./API.md) (envelope + status codes), termasuk validasi heuristik skor-vs-durasi
- [ ] `POST /api/v1/rooms/private` sebagai proxy auth ke game-server (menutup deviasi MVP dari API.md)
- [ ] Game server melaporkan hasil match → tabel `Match` + `MatchPlayer`
- [ ] Halaman profil: stats, win/loss, match history, solo high score (FR-09)
- [ ] Migrasi high score `localStorage` → akun saat login pertama

## Fase 4 — Deploy Publik & Polish

- [ ] Deploy: Vercel (web) + Render/Fly.io (game-server), env & CORS produksi, wss
- [ ] Ukur latency nyata; rampingkan payload event bila perlu (NFR: aksi < 150 ms)
- [ ] Juice: partikel, screen shake, popup combo & poin, nada SFX naik seiring combo, BGM + mute
- [ ] Haptic feedback (`navigator.vibrate`) saat klik salah di HP
- [ ] Landing page proper (cara main, tombol buat/gabung room)
- [ ] Cek load time < 3 dtk (NFR) — code splitting Phaser; **ukur juga di jaringan seluler**, bukan hanya WiFi
- [ ] Uji di HP nyata: Android Chrome + iOS Safari (bukan hanya emulasi DevTools)
- [ ] Opsional: manifest PWA supaya bisa "Add to Home Screen" — memangkas friksi saat nongkrong
- [ ] Playtest dengan teman-teman → iterasi angka balancing GDD (**validasi di HP dulu**, lihat GDD §7)

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
