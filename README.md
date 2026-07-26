# Game Otak Santai Bareng — "Pixel Pulse"

Game casual berbasis browser: refleks arcade + sentuhan brain-training, gaya retro pixel art. Bisa dimainkan solo (endless, kejar high score) atau bareng 2–4 teman secara real-time di satu papan yang sama — cukup bagikan kode room, tanpa install apa pun.

**Status: 📋 tahap planning.** Belum ada kode — repo ini berisi blueprint produk dan planning teknis lengkap sebagai fondasi pengembangan.

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
- **Bilingual sejak awal**: UI Indonesia (default) + English via next-intl.

## Stack (rencana)

Next.js + Phaser (Vercel) · Node + Socket.IO (Render/Fly.io) · PostgreSQL + Prisma · NextAuth — rasional lengkap di [PRD.md](docs/PRD.md#technology-stack--rationale).

## Mulai dari Mana?

Fase 0 di [ROADMAP.md](docs/ROADMAP.md): scaffold monorepo. Prinsip urutannya — **buktikan gamenya seru dulu, baru bangun infrastruktur.**
