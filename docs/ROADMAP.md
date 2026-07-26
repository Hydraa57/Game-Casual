# Roadmap & Breakdown Task

> Disusun untuk **solo developer, proyek hobi** — per fase adalah milestone kecil yang selesai-utuh dan menyenangkan untuk dicapai, tanpa deadline keras. Urutannya sengaja: **buktikan gamenya seru dulu (Fase 1–2), baru investasi infrastruktur (Fase 3–4)**. Angka desain diambil dari [GAME-DESIGN.md](./GAME-DESIGN.md); struktur teknis dari [ARCHITECTURE.md](./ARCHITECTURE.md).

## Fase 0 — Fondasi Repo

- [ ] Scaffold monorepo pnpm workspaces: `apps/web`, `apps/game-server`, `packages/shared`
- [ ] TypeScript strict + ESLint + Prettier konsisten di semua workspace
- [ ] `packages/shared`: tipe domain awal (Pixel, Player, RoomState) + konstanta balancing dari GDD
- [ ] Script `pnpm dev` dari root menjalankan web (:3000) + game-server (:3001) paralel
- [ ] GitHub Actions ringan: typecheck + lint tiap push
- [ ] Perbarui README (cara menjalankan dev)

## Fase 1 — Solo Playable ("first fun") 🎯

- [ ] Engine aturan main di `packages/shared` (pure functions): spawn pixel, lifetime, skor + speed bonus, combo, kurva level, seeded RNG
- [ ] Unit test engine (skor, combo reset, batas kurva kesulitan)
- [ ] Halaman `/play/solo`: mount Phaser (dynamic import, ssr:false)
- [ ] Renderer grid 8×8 + siklus hidup pixel (spawn → redup → expire)
- [ ] Input klik + resolusi lewat engine shared
- [ ] HUD: warna target (+ animasi peringatan ganti), skor, combo meter, 3 nyawa
- [ ] Pause / resume (bekukan seluruh state) + game over + restart
- [ ] High score di `localStorage`
- [ ] Scaffold i18n `next-intl` (id default + en) — semua string UI lewat kamus
- [ ] SFX dasar: klik benar / salah / game over
- [ ] Landing page sederhana → tombol "Main Solo"

**✅ Milestone:** kamu sendiri betah main ≥3 ronde berturut-turut. Kalau belum, ulik angka balancing di `shared/constants` sebelum lanjut — **jangan masuk Fase 2 dengan core loop yang hambar.**

## Fase 2 — Multiplayer Vertical Slice 🎯

- [ ] `apps/game-server`: Express (`/health`) + Socket.IO + validasi payload (zod)
- [ ] RoomManager: buat/join/leave room via kode 6 karakter, guest nickname, host reassignment, room bubar saat kosong
- [ ] Error handling lobby: `ROOM_NOT_FOUND` / `ROOM_FULL` / `GAME_IN_PROGRESS` / `NICKNAME_TAKEN`
- [ ] Lobby UI di `/play/room/[code]`: daftar pemain, ready check, pengaturan host (max players, target skor, waktu)
- [ ] Game loop otoritatif 20Hz per room memakai engine shared: spawn, expire, ganti target
- [ ] Resolusi klik rebutan first-arrival + `game:pixelClaimed` / `game:clickRejected`
- [ ] Rate limit ~8 klik/dtk/pemain + cooldown lokal 500 ms saat klik salah
- [ ] Leaderboard live di samping papan
- [ ] Kondisi menang (target skor / waktu habis) + sudden death saat seri
- [ ] Layar hasil (peringkat, akurasi, combo terbaik) + tombol rematch
- [ ] Handle disconnect: pemain keluar dari match, skor terakhir tetap di hasil

**✅ Milestone:** 2 device di jaringan lokal main bareng lancar; dua klik hampir bersamaan pada pixel yang sama → hanya satu yang dapat poin.

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
- [ ] Glyph buta warna di tiap pixel
- [ ] Landing page proper (cara main, tombol buat/gabung room)
- [ ] Cek load time < 3 dtk (NFR) — code splitting Phaser
- [ ] Playtest dengan teman-teman → iterasi angka balancing GDD

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
| 0 | `pnpm dev` menyalakan kedua app; CI hijau |
| 1 | Mainkan sendiri di localhost: skor/combo/nyawa/pause sesuai GDD; refresh → high score bertahan |
| 2 | Dua tab browser + satu incognito (3 "pemain"): skor sinkron; klik rebutan hanya dimenangkan satu pemain; spam klik terkena rate limit; tutup satu tab → match jalan terus |
| 3 | Login Google; main solo → skor muncul di profil & DB; main MP → match history terisi (guest tercatat sebagai nickname) |
| 4 | Main dari 2 jaringan berbeda via URL publik; input terasa < 150 ms; load pertama < 3 dtk |
