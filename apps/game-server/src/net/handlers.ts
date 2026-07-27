import type { Server, Socket } from 'socket.io';
import { RECONNECT_GRACE_MS, verifyPlayerToken } from '@pixelmatrix/shared';
import type {
  ClientToServerEvents,
  PlayerIdentity,
  ResyncPayload,
  RoomState,
  ServerToClientEvents,
} from '@pixelmatrix/shared';
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';
import type { SessionRegistry } from '../rooms/sessions';
import { fail, socketError, succeed } from './errors';
import {
  clickSchema,
  createRoomSchema,
  joinRoomSchema,
  readySchema,
  reconnectSchema,
  updateSettingsSchema,
} from './schemas';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Hook yang diisi oleh lapisan match (Patch 10). Dipisah supaya aturan lobby
 * bisa berdiri dan diuji sendiri tanpa game loop.
 */
export interface MatchHooks {
  readonly onStart: (room: Room, io: GameServer) => void;
  readonly onClick: (room: Room, playerId: string, pixelId: string) => void;
  readonly onPlayerLeft: (room: Room, playerId: string) => void;
  readonly scoresOf: (room: Room) => ReadonlyMap<string, { score: number; combo: number }>;
  /** Potret papan untuk pemain yang kembali; `null` kalau tidak ada match jalan. */
  readonly snapshotOf: (room: Room) => ResyncPayload | null;
}

export interface HandlerDeps {
  readonly io: GameServer;
  readonly rooms: RoomManager;
  readonly match: MatchHooks;
  readonly sessions: SessionRegistry;
  /**
   * Penunda pengeluaran pemain yang koneksinya putus. Bisa disuntik supaya
   * masa tenggang bisa diuji tanpa benar-benar menunggu 45 detik.
   */
  readonly schedule?: (fn: () => void, ms: number) => NodeJS.Timeout;
}

/**
 * Kursi pemain terikat ke socket, bukan sebaliknya.
 *
 * `socket.data` adalah satu-satunya tempat yang umurnya persis sama dengan
 * koneksinya, jadi id kursi disimpan di sini alih-alih di peta global yang
 * harus dibersihkan sendiri.
 */
interface SocketData {
  playerId?: string;
}

const seatOf = (socket: GameSocket): string | undefined => (socket.data as SocketData).playerId;

/**
 * Ikat socket ke sebuah kursi.
 *
 * `socket.join(playerId)` itu yang membuat seluruh `io.to(playerId).emit(...)`
 * di Match tetap benar tanpa diubah sama sekali: dulu itu bekerja karena
 * `socket.id` otomatis menjadi room di Socket.IO, dan sekarang kursinya
 * dijadikan room secara eksplisit. Tanpa baris ini, setiap pesan pribadi
 * (klik ditolak, tereliminasi) akan terkirim ke ruang kosong.
 */
function bindSeat(socket: GameSocket, playerId: string): void {
  (socket.data as SocketData).playerId = playerId;
  void socket.join(playerId);
}

/**
 * Identitas terbukti dari token, atau `null` untuk guest.
 *
 * Tanpa `AUTH_SECRET` semua orang dianggap guest — dan itu keadaan yang sah,
 * bukan kegagalan: game harus tetap bisa dimainkan tanpa konfigurasi apa pun.
 */
async function identify(token: string | undefined): Promise<PlayerIdentity | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || token === undefined) return null;
  return verifyPlayerToken(token, secret);
}

/**
 * Timer pengeluaran per kursi, dipakai bersama seluruh koneksi.
 *
 * Modul-level dan bukan per-socket dengan sengaja: yang menunggu adalah KURSI,
 * dan justru socket yang memasangnya sudah mati. Socket baru yang datang harus
 * bisa menemukan lalu membatalkan timer itu.
 */
const evictions = new Map<string, NodeJS.Timeout>();

export function registerHandlers(socket: GameSocket, deps: HandlerDeps): void {
  const { io, rooms, match, sessions, schedule = setTimeout } = deps;

  const broadcastState = (room: Room): void => {
    io.to(room.code).emit('room:state', stateOf(room, match));
  };

  socket.on('room:create', (payload, ack) => {
    const parsed = createRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }
    // Satu socket hanya boleh berada di satu room; tinggalkan yang lama dulu.
    leaveCurrentRoom(socket, deps);

    void identify(parsed.data.playerToken).then((account) => {
      const seat = sessions.open();
      const room = rooms.create(
        seat.playerId,
        // Nama dari TOKEN menang atas nickname yang dikirim client. Kalau tidak,
        // pemain bisa login sebagai satu akun tapi tercatat di riwayat dengan
        // nama lain — dan papan skor jadi tidak cocok dengan riwayatnya.
        account?.username ?? parsed.data.nickname,
        account?.avatar ?? parsed.data.avatar,
        parsed.data.settings,
        account?.userId ?? null,
      );
      bindSeat(socket, seat.playerId);
      void socket.join(room.code);
      ack(
        succeed({
          roomCode: room.code,
          playerId: seat.playerId,
          roomState: stateOf(room, match),
          sessionKey: seat.sessionKey,
        }),
      );
      broadcastState(room);
    });
  });

  socket.on('room:join', (payload, ack) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }
    leaveCurrentRoom(socket, deps);

    void identify(parsed.data.playerToken).then((account) => {
      const seat = sessions.open();
      const result = rooms.join(
        parsed.data.roomCode,
        seat.playerId,
        account?.username ?? parsed.data.nickname,
        account?.avatar ?? parsed.data.avatar,
        account?.userId ?? null,
      );
      if (!result.ok) {
        // Kursi yang gagal dipakai harus ditutup, kalau tidak registry-nya
        // tumbuh setiap kali ada orang salah memasukkan kode room.
        sessions.close(seat.playerId);
        ack(fail(result.code));
        return;
      }

      bindSeat(socket, seat.playerId);
      void socket.join(result.room.code);
      ack(
        succeed({
          roomCode: result.room.code,
          playerId: seat.playerId,
          roomState: stateOf(result.room, match),
          sessionKey: seat.sessionKey,
        }),
      );
      broadcastState(result.room);
    });
  });

  /**
   * Klaim kembali kursi yang masih ditahan.
   *
   * Perhatikan apa yang TIDAK diperiksa di sini: room penuh, dan match sudah
   * berjalan. Keduanya menolak pendatang baru, tapi pemain ini bukan pendatang
   * — kursinya sudah dihitung di kapasitas room dan skornya masih ada di match.
   * Menerapkan pemeriksaan itu di jalur ini akan menolak tepat orang yang
   * seharusnya diterima.
   */
  socket.on('room:reconnect', (payload, ack) => {
    const parsed = reconnectSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }

    const playerId = sessions.resolve(parsed.data.sessionKey);
    const room = playerId === undefined ? undefined : rooms.roomOf(playerId);
    if (playerId === undefined || !room || !room.has(playerId)) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }

    // Kursi diselamatkan sebelum masa tenggangnya habis.
    const pending = evictions.get(playerId);
    if (pending !== undefined) {
      clearTimeout(pending);
      evictions.delete(playerId);
    }

    room.setConnected(playerId, true);
    bindSeat(socket, playerId);
    void socket.join(room.code);

    ack(
      succeed({
        roomCode: room.code,
        playerId,
        roomState: stateOf(room, match),
        sessionKey: parsed.data.sessionKey,
      }),
    );
    broadcastState(room);
  });

  socket.on('game:requestResync', (ack) => {
    const playerId = seatOf(socket);
    const room = playerId === undefined ? undefined : rooms.roomOf(playerId);
    if (!room) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }
    ack(succeed(match.snapshotOf(room)));
  });

  socket.on('room:leave', () => {
    leaveCurrentRoom(socket, deps);
  });

  socket.on('room:backToLobby', () => {
    const room = roomOfSocket(socket, rooms);
    if (!room || room.currentStatus !== 'finished') return;

    room.setStatus('waiting');
    room.resetReady();
    broadcastState(room);
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const parsed = updateSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }

    const playerId = seatOf(socket);
    const room = roomOfSocket(socket, rooms);
    if (!room || playerId === undefined) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }
    if (!room.isHost(playerId)) {
      ack(fail('NOT_HOST'));
      return;
    }
    if (room.currentStatus !== 'waiting') {
      ack(fail('GAME_IN_PROGRESS'));
      return;
    }

    room.updateSettings(parsed.data.settings);
    const state = stateOf(room, match);
    ack(succeed(state));
    broadcastState(room);
  });

  socket.on('player:ready', (payload) => {
    const parsed = readySchema.safeParse(payload);
    const playerId = seatOf(socket);
    const room = roomOfSocket(socket, rooms);
    if (!parsed.success || !room || playerId === undefined) return;

    room.setReady(playerId, parsed.data.ready);
    broadcastState(room);
  });

  socket.on('game:start', (ack) => {
    const playerId = seatOf(socket);
    const room = roomOfSocket(socket, rooms);
    if (!room || playerId === undefined) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }
    if (!room.isHost(playerId)) {
      ack(fail('NOT_HOST'));
      return;
    }
    if (room.currentStatus !== 'waiting') {
      ack(fail('GAME_IN_PROGRESS'));
      return;
    }
    if (!room.canStart()) {
      ack(fail('NOT_ENOUGH_PLAYERS'));
      return;
    }

    ack(succeed(null));
    match.onStart(room, io);
  });

  socket.on('game:click', (payload) => {
    const parsed = clickSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', socketError('INVALID_PAYLOAD'));
      return;
    }
    const playerId = seatOf(socket);
    const room = roomOfSocket(socket, rooms);
    if (!room || playerId === undefined) return;

    match.onClick(room, playerId, parsed.data.pixelId);
  });

  /**
   * Koneksi putus BUKAN berarti pemainnya keluar.
   *
   * Ini perubahan perilaku terpenting di patch ini. Dulu disconnect langsung
   * memanggil `leaveCurrentRoom`, jadi kehilangan sinyal sedetik pun sama
   * artinya dengan menyerah: kursi hilang, skor hilang, dan satu-satunya jalan
   * kembali adalah masuk room baru dari awal — yang bahkan tidak mungkin
   * selagi match masih berjalan.
   *
   * Sekarang kursinya ditahan dan pengeluarannya dijadwalkan. Kalau pemain
   * kembali sebelum tenggangnya habis, jadwal itu dibatalkan.
   */
  socket.on('disconnect', () => {
    const playerId = seatOf(socket);
    const room = playerId === undefined ? undefined : rooms.roomOf(playerId);
    if (playerId === undefined || !room) return;

    room.setConnected(playerId, false);
    io.to(room.code).emit('room:state', stateOf(room, match));

    evictions.set(
      playerId,
      schedule(() => {
        evictions.delete(playerId);
        // Diperiksa lagi karena keadaan bisa berubah selama menunggu: pemain
        // mungkin sudah kembali lewat socket lain, atau room-nya sudah bubar.
        const current = rooms.roomOf(playerId);
        if (!current || current.get(playerId)?.connected === true) return;
        evict(playerId, deps);
      }, RECONNECT_GRACE_MS),
    );
  });
}

/** Room tempat socket ini duduk, lewat kursinya. */
function roomOfSocket(socket: GameSocket, rooms: RoomManager): Room | undefined {
  const playerId = seatOf(socket);
  return playerId === undefined ? undefined : rooms.roomOf(playerId);
}

/** Keluarkan pemain sungguhan: dari match, dari room, dan dari registry kursi. */
function evict(playerId: string, { io, rooms, match, sessions }: HandlerDeps): void {
  const room = rooms.roomOf(playerId);
  if (!room) {
    sessions.close(playerId);
    return;
  }

  match.onPlayerLeft(room, playerId);
  const remaining = rooms.leave(playerId);
  sessions.close(playerId);

  if (remaining) {
    io.to(remaining.code).emit('room:state', stateOf(remaining, match));
  }
}

/**
 * Keluar atas kemauan sendiri — langsung, tanpa masa tenggang.
 *
 * Menekan "keluar" adalah pernyataan yang jelas; menahan kursinya 45 detik
 * setelah itu hanya akan membuat pemain lain menunggu orang yang sudah pamit.
 */
function leaveCurrentRoom(socket: GameSocket, deps: HandlerDeps): void {
  const playerId = seatOf(socket);
  if (playerId === undefined) return;

  const room = deps.rooms.roomOf(playerId);
  if (room) void socket.leave(room.code);

  const pending = evictions.get(playerId);
  if (pending !== undefined) {
    clearTimeout(pending);
    evictions.delete(playerId);
  }

  void socket.leave(playerId);
  (socket.data as SocketData).playerId = undefined;
  evict(playerId, deps);
}

function stateOf(room: Room, match: MatchHooks): RoomState {
  return room.toState(match.scoresOf(room));
}
