import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@pixelmatrix/shared';
import { registerHandlers } from './net/handlers';
import type { MatchHooks } from './net/handlers';
import { RoomManager } from './rooms/RoomManager';

const PORT = Number(process.env.PORT ?? 3001);
/**
 * Di development sengaja permisif supaya bisa dibuka dari HP di jaringan yang
 * sama. Di produksi WAJIB diisi origin web-nya lewat env — lihat
 * ARCHITECTURE.md §6.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.roomCount, players: rooms.playerCount });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

const rooms = new RoomManager();

/**
 * Lobby berdiri lebih dulu tanpa game loop (Patch 9). Hook match diisi di
 * Patch 10; sampai saat itu `game:start` hanya menandai room sebagai `playing`
 * supaya alur lobby bisa diuji utuh.
 */
const match: MatchHooks = {
  onStart: (room) => {
    room.setStatus('playing');
    io.to(room.code).emit('room:state', room.toState());
  },
  onClick: () => {},
  onPlayerLeft: () => {},
  scoresOf: () => new Map(),
};

io.on('connection', (socket) => {
  registerHandlers(socket, { io, rooms, match });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[game-server] listening on http://0.0.0.0:${PORT}`);
});
