import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, RoomState, ServerToClientEvents } from '@pixelmatrix/shared';
import type { RoomManager } from '../rooms/RoomManager';
import type { Room } from '../rooms/Room';
import { fail, socketError, succeed } from './errors';
import {
  clickSchema,
  createRoomSchema,
  joinRoomSchema,
  readySchema,
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
}

export interface HandlerDeps {
  readonly io: GameServer;
  readonly rooms: RoomManager;
  readonly match: MatchHooks;
}

export function registerHandlers(socket: GameSocket, deps: HandlerDeps): void {
  const { io, rooms, match } = deps;

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

    const room = rooms.create(socket.id, parsed.data.nickname, parsed.data.settings);
    void socket.join(room.code);
    ack(succeed({ roomCode: room.code, playerId: socket.id, roomState: stateOf(room, match) }));
    broadcastState(room);
  });

  socket.on('room:join', (payload, ack) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }
    leaveCurrentRoom(socket, deps);

    const result = rooms.join(parsed.data.roomCode, socket.id, parsed.data.nickname);
    if (!result.ok) {
      ack(fail(result.code));
      return;
    }

    void socket.join(result.room.code);
    ack(
      succeed({
        roomCode: result.room.code,
        playerId: socket.id,
        roomState: stateOf(result.room, match),
      }),
    );
    broadcastState(result.room);
  });

  socket.on('room:leave', () => {
    leaveCurrentRoom(socket, deps);
  });

  socket.on('room:updateSettings', (payload, ack) => {
    const parsed = updateSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD'));
      return;
    }

    const room = rooms.roomOf(socket.id);
    if (!room) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }
    if (!room.isHost(socket.id)) {
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
    const room = rooms.roomOf(socket.id);
    if (!parsed.success || !room) return;

    room.setReady(socket.id, parsed.data.ready);
    broadcastState(room);
  });

  socket.on('game:start', (ack) => {
    const room = rooms.roomOf(socket.id);
    if (!room) {
      ack(fail('NOT_IN_ROOM'));
      return;
    }
    if (!room.isHost(socket.id)) {
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
    const room = rooms.roomOf(socket.id);
    if (!room) return;

    match.onClick(room, socket.id, parsed.data.pixelId);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, deps);
  });
}

function leaveCurrentRoom(socket: GameSocket, { io, rooms, match }: HandlerDeps): void {
  const room = rooms.roomOf(socket.id);
  if (!room) return;

  const code = room.code;
  match.onPlayerLeft(room, socket.id);

  const remaining = rooms.leave(socket.id);
  void socket.leave(code);

  if (remaining) {
    io.to(remaining.code).emit('room:state', stateOf(remaining, match));
  }
}

function stateOf(room: Room, match: MatchHooks): RoomState {
  return room.toState(match.scoresOf(room));
}
