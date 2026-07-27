import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@pixelmatrix/shared';
import { Match } from './game/Match';
import { registerHandlers } from './net/handlers';
import type { MatchHooks } from './net/handlers';
import { hasDatabase } from '@pixelmatrix/db';
import { RoomManager } from './rooms/RoomManager';
import { SessionRegistry } from './rooms/sessions';
import type { Room } from './rooms/Room';

const PORT = Number(process.env.PORT ?? 3001);
/**
 * Di development sengaja permisif supaya bisa dibuka dari HP di jaringan yang
 * sama. Di produksi WAJIB diisi origin web-nya lewat env — lihat
 * ARCHITECTURE.md §6.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const rooms = new RoomManager();
/**
 * Kursi pemain, terpisah dari koneksinya. Hidup selama proses server berjalan;
 * satu entri dihapus begitu pemainnya benar-benar keluar dari room.
 */
const sessions = new SessionRegistry();
/** Match yang sedang berjalan, satu per kode room. */
const matches = new Map<string, Match>();

const app = express();
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.roomCount,
    players: rooms.playerCount,
    seats: sessions.size,
    matches: matches.size,
    // Terlihat di /health supaya tidak perlu menebak apakah env-nya sudah
    // terpasang benar di hosting. `false` bukan error — game tetap jalan.
    persistence: hasDatabase(),
  });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

function endMatch(room: Room): void {
  matches.get(room.code)?.stop();
  matches.delete(room.code);
}

const match: MatchHooks = {
  onStart: (room) => {
    endMatch(room);
    const created = new Match(room, io, endMatch);
    matches.set(room.code, created);
    created.start();
  },

  onClick: (room, playerId, pixelId) => {
    matches.get(room.code)?.handleClick(playerId, pixelId);
  },

  onPlayerLeft: (room, playerId) => {
    const running = matches.get(room.code);
    if (!running) return;

    running.removePlayer(playerId);
    // Room yang ditinggalkan semua orang tidak boleh meninggalkan interval hidup.
    if (room.playerCount <= 1) endMatch(room);
  },

  scoresOf: (room) => matches.get(room.code)?.scores() ?? new Map(),

  snapshotOf: (room) => matches.get(room.code)?.snapshot() ?? null,
};

io.on('connection', (socket) => {
  registerHandlers(socket, { io, rooms, match, sessions });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[game-server] listening on http://0.0.0.0:${PORT}`);
});
