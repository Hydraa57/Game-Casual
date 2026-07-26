# Arsitektur Teknis — Game Otak Santai Bareng

> Turunan konkret dari Technology Stack di [PRD.md](./PRD.md), untuk scope MVP vertical slice (solo + private room). Kontrak REST lengkap ada di [API.md](./API.md); dokumen ini menambahkan struktur repo, kontrak real-time (Socket.IO), skema database, dan rencana deployment.

## 1. Gambaran Besar

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  apps/web (Vercel)      │  WSS    │ apps/game-server (Render)│
│  Next.js + Phaser       │◄───────►│ Node + Socket.IO         │
│  landing, lobby, solo,  │         │ room manager, game loop  │
│  NextAuth*, REST API*   │         │ otoritatif 20Hz          │
└───────────┬─────────────┘         └────────────┬─────────────┘
            │ Prisma*                            │ (Fase 3: lapor hasil match)*
            ▼                                    ▼
        ┌────────────────────────────────────────────┐
        │              PostgreSQL*                   │
        └────────────────────────────────────────────┘
                      * = mulai Fase 3
```

Dua keputusan arsitektur terpenting:

1. **Game server terpisah dari Next.js** — Vercel serverless tidak bisa memelihara koneksi WebSocket persisten, dan game loop 20Hz butuh proses yang hidup terus.
2. **Aturan main hidup di `packages/shared`** — engine yang sama dijalankan client (solo mode, sepenuhnya offline di browser) dan server (multiplayer, otoritatif). Satu sumber kebenaran, tidak ada duplikasi logika, dan solo/MP dijamin terasa identik.

## 2. Struktur Monorepo (pnpm workspaces)

```
game-casual/
├── package.json            # root: pnpm workspaces, script `dev` paralel
├── docs/                   # PRD, API, GDD, arsitektur, roadmap (dokumen ini)
├── apps/
│   ├── web/                # Next.js 15+ (App Router, TypeScript)
│   │   └── src/
│   │       ├── app/[locale]/            # landing page
│   │       │   ├── play/solo/           # halaman solo mode
│   │       │   └── play/room/[code]/    # lobby + match multiplayer
│   │       ├── game/                    # Phaser: scenes, renderer grid, HUD
│   │       │   └── (di-mount lewat client component, dynamic import ssr:false)
│   │       ├── i18n/                    # next-intl: messages/id.json, en.json
│   │       └── lib/socket.ts            # koneksi Socket.IO client
│   └── game-server/        # Node 20+, TypeScript, Socket.IO + Express
│       └── src/
│           ├── rooms/                   # RoomManager, Room, generator kode (6 char)
│           ├── game/                    # loop otoritatif: spawner, klaim klik, tick 20Hz
│           ├── net/                     # handler event, validasi payload, rate limit
│           └── http/                    # Express: /health, /stats (untuk monitoring)
└── packages/
    └── shared/             # TANPA dependency runtime — dipakai web & game-server:
        ├── src/types/                   # tipe domain: Pixel, Player, RoomState, dst.
        ├── src/events/                  # kontrak event Socket.IO + tipe payload
        ├── src/constants/               # angka balancing dari GAME-DESIGN.md
        └── src/engine/                  # aturan main murni (pure function):
                                         # spawn, scoring, combo, kurva level, seeded RNG
```

Konvensi: `packages/shared` **tidak boleh** bergantung pada Phaser, Socket.IO, ataupun Node API — murni TypeScript agar bisa jalan di browser dan server.

## 3. Kontrak Event Socket.IO (MVP)

Semua payload didefinisikan sebagai tipe TypeScript di `packages/shared/src/events/`. Update in-game dikirim sebagai **event delta** (bukan full state per tick); full state hanya saat join/resync. Tick server **20Hz** sesuai NFR.

### Client → Server

| Event | Payload | Balasan (ack) / catatan |
|---|---|---|
| `room:create` | `{ nickname, settings: { maxPlayers, targetScore, timeLimitSec } }` | ack `{ roomCode, roomState }` — pengirim jadi host |
| `room:join` | `{ roomCode, nickname }` | ack `{ roomState }` atau error code (lihat bawah) |
| `room:leave` | `{}` | host pindah ke pemain berikutnya; room bubar jika kosong |
| `room:updateSettings` | `{ settings }` | host only; broadcast `room:state` |
| `player:ready` | `{ ready: boolean }` | broadcast `room:state` |
| `game:start` | `{}` | host only; valid jika ≥2 pemain dan semua ready |
| `game:click` | `{ pixelId, clientTs }` | hasil datang via `game:pixelClaimed` / `game:clickRejected` |

### Server → Client

| Event | Payload | Kapan |
|---|---|---|
| `room:state` | `{ roomCode, hostId, players[], settings, status }` | sync penuh: saat join & tiap perubahan lobby |
| `room:playerJoined` / `room:playerLeft` | `{ player }` | perubahan keanggotaan |
| `game:countdown` | `{ seconds }` | 3, 2, 1 |
| `game:started` | `{ startedAt, targetColor, timeLimitSec, targetScore }` | awal match |
| `game:pixelSpawned` | `{ pixelId, cell, color, lifetimeMs }` | server men-spawn pixel |
| `game:pixelClaimed` | `{ pixelId, byPlayerId, points, combo, newScore }` | klik benar dimenangkan seseorang |
| `game:pixelExpired` | `{ pixelId }` | pixel pudar tanpa diklik |
| `game:targetChanged` | `{ color, warningMs }` | ganti warna target (dengan peringatan 1 dtk) |
| `game:clickRejected` | `{ pixelId, reason: 'TOO_LATE' \| 'WRONG_COLOR' \| 'RATE_LIMITED', penalty }` | feedback klik gagal ke pengirim saja |
| `game:suddenDeath` | `{ pixelId, cell, color }` | skor seri saat waktu habis |
| `game:ended` | `{ ranking: [{ playerId, nickname, score, accuracy, bestCombo }] }` | akhir match |
| `error` | `{ code, message }` | error umum |

### Error codes room

`ROOM_NOT_FOUND` · `ROOM_FULL` · `GAME_IN_PROGRESS` · `NICKNAME_TAKEN` · `NOT_HOST` · `NOT_ENOUGH_PLAYERS`

### Keamanan & anti-cheat (sesuai analisis risiko PRD)

- Server **tidak pernah mempercayai skor dari client** — skor dihitung server dari klik yang tervalidasi (pixel ada, belum expired, warna = target saat klik diterima).
- Rate limit ~8 klik/dtk/socket; kelebihan dibalas `clickRejected: RATE_LIMITED`.
- Validasi bentuk payload di boundary (mis. zod) sebelum masuk handler.
- Semua koneksi lewat TLS (wss) di produksi; CORS dikunci ke origin web.

## 4. Database (mulai Fase 3 — Prisma + PostgreSQL)

MVP (Fase 0–2) **tidak memakai database sama sekali**: room hidup di memori game-server, high score solo di `localStorage`. Skema saat auth masuk:

```prisma
model User {          // + model Account, Session, VerificationToken standar NextAuth
  id            String   @id @default(cuid())
  username      String   @unique
  email         String   @unique
  avatarUrl     String?
  soloHighScore Int      @default(0)   // denormalized untuk baca cepat profil
  createdAt     DateTime @default(now())
  soloScores    SoloScore[]
  matchPlayers  MatchPlayer[]
}

model SoloScore {     // riwayat submit; validasi heuristik server (skor vs durasi)
  id                  String   @id @default(cuid())
  userId              String
  score               Int
  gameDurationSeconds Int
  createdAt           DateTime @default(now())
}

model Match {
  id        String   @id @default(cuid())
  roomCode  String
  settings  Json
  startedAt DateTime
  endedAt   DateTime
  players   MatchPlayer[]
}

model MatchPlayer {
  id       String  @id @default(cuid())
  matchId  String
  userId   String? // nullable: guest tetap tercatat sebagai bagian sejarah match
  nickname String
  score    Int
  rank     Int
}
```

Fase 5 menambah `Item`, `Purchase`, `Ban` (IAP & admin, lihat PRD FR-10–FR-12).

## 5. REST API

Mengikuti [API.md](./API.md): prefix `/api/v1`, envelope `{ success, data | error }`, diimplementasikan sebagai route handler Next.js mulai Fase 3 (`GET /users/me`, `POST /solo-scores`).

**Deviasi yang disengaja dari API.md** — di MVP, pembuatan private room dilakukan **lewat Socket.IO (`room:create`), bukan `POST /api/v1/rooms/private`**, karena room hidup di memori game-server dan belum ada auth. Saat Fase 3, endpoint REST-nya ditambahkan sebagai proxy tervalidasi-auth ke game-server sehingga kontrak API.md terpenuhi.

**Auth socket (Fase 3)**: handshake Socket.IO membawa session token NextAuth; server memverifikasi dan mengaitkan `userId` ke socket. Guest (tanpa token) tetap boleh join room — sesuai keputusan "guest nickname dulu".

## 6. Deployment & Skalabilitas

| Tahap | Web (`apps/web`) | Game server (`apps/game-server`) |
|---|---|---|
| Dev | `pnpm dev` → :3000 | `pnpm dev` → :3001 (satu perintah, paralel dari root) |
| Fase 4 | Vercel | Render / Fly.io |

Catatan operasional:

- **Render free tier tidur saat idle** → cold start 30–60 dtk di match pertama. Terima saja untuk fase hobi, atau pindah ke paket murah / Fly.io jika mengganggu.
- Environment: `NEXT_PUBLIC_GAME_SERVER_URL` di web; `CORS_ORIGIN`, `PORT` di game-server; `DATABASE_URL`, `NEXTAUTH_*` mulai Fase 3.
- Satu instance game server memadai untuk target awal 1.000 CCU (koneksi Socket.IO per node bisa ribuan). Jalur scale-out sudah diantisipasi PRD (stateless + horizontal): **Redis adapter Socket.IO + sticky session** — dicatat, tidak dibangun sebelum dibutuhkan. Load test k6/Artillery di Fase 5.

## 7. i18n

- `next-intl` dengan routing `[locale]` (`id` default, `en`), messages di `apps/web/src/i18n/messages/`.
- Teks in-game (HUD Phaser) mengambil dari kamus yang sama lewat props saat mount — tidak ada string UI yang di-hardcode di scene.
