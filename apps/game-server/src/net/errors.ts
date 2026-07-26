import type { Ack, RoomErrorCode, SocketError } from '@pixelmatrix/shared/events';

/**
 * Pesan error dalam bahasa Inggris di sisi server; client menerjemahkannya lewat
 * `code`, bukan menampilkan `message` ini langsung ke pemain. `message` hanya
 * untuk log dan debugging.
 */
const MESSAGES: Record<RoomErrorCode, string> = {
  ROOM_NOT_FOUND: 'Room does not exist',
  ROOM_FULL: 'Room is full',
  GAME_IN_PROGRESS: 'Match already started',
  NICKNAME_TAKEN: 'Nickname already used in this room',
  NICKNAME_INVALID: 'Nickname is not allowed',
  NOT_HOST: 'Only the host can do that',
  NOT_ENOUGH_PLAYERS: 'Not enough ready players to start',
  NOT_IN_ROOM: 'You are not in a room',
  RATE_LIMITED: 'Too many actions',
  INVALID_PAYLOAD: 'Malformed request',
};

export function socketError(code: RoomErrorCode): SocketError {
  return { code, message: MESSAGES[code] };
}

export function fail<T>(code: RoomErrorCode): Ack<T> {
  return { ok: false, error: socketError(code) };
}

export function succeed<T>(data: T): Ack<T> {
  return { ok: true, data };
}
