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

## Mulai dari Mana?

Lihat [ROADMAP.md](docs/ROADMAP.md). Fase 0, 1, dan 1.5 selesai; Fase 2 (multiplayer) sedang dikerjakan. Prinsip urutannya: **buktikan gamenya seru dulu, baru bangun infrastruktur.**
