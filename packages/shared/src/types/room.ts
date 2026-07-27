export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

/**
 * Karakter yang dipilih pemain sebelum masuk room.
 *
 * Gunanya bukan hiasan: glyph-nya dicap di sel yang baru direbut, jadi kamu
 * langsung tahu SIAPA yang menyerobot pixel itu. Karena itu setiap pemain di
 * satu room harus punya avatar yang berbeda.
 */
export type AvatarId = 'fox' | 'cat' | 'frog' | 'owl' | 'panda' | 'bee' | 'shark' | 'robot';

export interface RoomSettings {
  readonly maxPlayers: number;
  readonly targetScore: number;
  readonly timeLimitSec: number;
}

export interface Player {
  readonly id: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly isHost: boolean;
  readonly isReady: boolean;
  readonly score: number;
  readonly combo: number;
  readonly connected: boolean;
}

export interface RoomState {
  readonly roomCode: string;
  readonly hostId: string;
  readonly players: readonly Player[];
  readonly settings: RoomSettings;
  readonly status: RoomStatus;
}

/** Satu baris di layar hasil match (GDD §5). */
export interface MatchResultEntry {
  readonly playerId: string;
  readonly nickname: string;
  readonly avatar: AvatarId;
  readonly score: number;
  readonly rank: number;
  /** 0..1 — klik benar dibagi total klik. */
  readonly accuracy: number;
  readonly bestCombo: number;
}
