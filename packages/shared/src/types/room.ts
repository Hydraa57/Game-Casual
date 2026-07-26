export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface RoomSettings {
  readonly maxPlayers: number;
  readonly targetScore: number;
  readonly timeLimitSec: number;
}

export interface Player {
  readonly id: string;
  readonly nickname: string;
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
  readonly score: number;
  readonly rank: number;
  /** 0..1 — klik benar dibagi total klik. */
  readonly accuracy: number;
  readonly bestCombo: number;
}
