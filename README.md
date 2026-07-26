# Game Otak Santai Bareng — "Pixel Pulse"

Game casual berbasis browser: refleks arcade + sentuhan brain-training, gaya retro pixel art. Bisa dimainkan solo (endless, kejar high score) atau bareng 2–4 teman secara real-time di satu papan yang sama — cukup bagikan kode room, tanpa install apa pun. **Dirancang mobile-first** karena skenario utamanya dimainkan bareng-bareng saat nongkrong, dari HP masing-masing.

**Status: 🏗️ Fase 0 (fondasi).** Monorepo dan `packages/shared` sudah berdiri; gameplay belum ada.

## Dokumen

| Dokumen | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document — visi, functional & non-functional requirements, KPI, risiko |
| [docs/API.md](docs/API.md) | Kontrak REST API — format response, endpoint user/room/skor/shop |
| [docs/GAME-DESIGN.md](docs/GAME-DESIGN.md) | Spesifikasi gameplay Pixel Pulse — papan, skor, combo, kurva kesulitan, aturan multiplayer rebutan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arsitektur teknis — struktur monorepo, kontrak event Socket.IO, skema database, deployment |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Roadmap 6 fase + checklist task + cara verifikasi per fase |

## Keputusan Kunci

- **MVP = vertical slice**: solo mode + private room multiplayer. IAP, admin panel, dan public matchmaking menyusul (Fase 5).
- **Guest dulu, auth belakangan**: di MVP siapa pun bisa buat/gabung room dengan nickname — teman bisa langsung main. NextAuth + PostgreSQL masuk di Fase 3.
- **Multiplayer papan rebutan**: 2–4 pemain berebut pixel di papan yang sama; server otoritatif memutus siapa cepat dia dapat.
- **Monorepo, satu sumber aturan main**: logika game hidup di `packages/shared` dan dipakai client (solo) maupun server (multiplayer) — keduanya dijamin identik.
- **Mobile-first**: papan tetap 8×8 di semua device (hanya ukurannya yang di-scale), HUD dibuat DOM/React agar responsif, target sentuh ≥44px. Detail di [GAME-DESIGN.md §7](docs/GAME-DESIGN.md).
- **Bilingual sejak awal**: UI Indonesia (default) + English via next-intl.

## Stack (rencana)

Next.js + Phaser (Vercel) · Node + Socket.IO (Render/Fly.io) · PostgreSQL + Prisma · NextAuth — rasional lengkap di [PRD.md](docs/PRD.md#technology-stack--rationale).

## Struktur Repo

```
apps/web/          Next.js + Phaser (belum ada — Fase 1)
apps/game-server/  Socket.IO game server (belum ada — Fase 2)
packages/shared/   Tipe, konstanta balancing, engine aturan main
docs/              Blueprint & planning
```

## Development

```bash
pnpm install
pnpm typecheck    # tsc di semua workspace
pnpm lint         # eslint
pnpm test         # vitest
pnpm format       # prettier --write
```

Butuh Node ≥20 dan pnpm 10. `pnpm dev` akan menyalakan app begitu `apps/web` ada (Fase 1).

## Mulai dari Mana?

Lihat [ROADMAP.md](docs/ROADMAP.md) — Fase 0 selesai, lanjut Fase 1 (solo playable). Prinsip urutannya: **buktikan gamenya seru dulu, baru bangun infrastruktur.**
