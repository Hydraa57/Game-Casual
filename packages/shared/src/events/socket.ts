import type {
  Cell,
  ChaosModifier,
  Color,
  MatchResultEntry,
  Pixel,
  RoomSettings,
  RoomState,
} from '../types/index';

/**
 * Kontrak Socket.IO antara web dan game-server.
 *
 * Nama event-nya sengaja sama dengan nama event engine di `engine/events.ts`,
 * jadi server bisa meneruskan hasil `step()`/`applyClick()` hampir langsung
 * tanpa lapisan penerjemah.
 */

export type RoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NICKNAME_TAKEN'
  | 'NICKNAME_INVALID'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_IN_ROOM'
  | 'RATE_LIMITED'
  | 'INVALID_PAYLOAD';

export interface SocketError {
  readonly code: RoomErrorCode;
  readonly message: string;
}

/** Balasan ack: sukses membawa data, gagal membawa kode error yang bisa diterjemahkan. */
export type Ack<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: SocketError };

// ---------------------------------------------------------------------------
// Payload client → server
// ---------------------------------------------------------------------------

export interface CreateRoomPayload {
  readonly nickname: string;
  readonly settings?: Partial<RoomSettings>;
}

export interface JoinRoomPayload {
  readonly roomCode: string;
  readonly nickname: string;
}

export interface UpdateSettingsPayload {
  readonly settings: Partial<RoomSettings>;
}

export interface ReadyPayload {
  readonly ready: boolean;
}

export interface ClickPayload {
  readonly pixelId: string;
  /** Waktu client saat tap; hanya untuk telemetri, TIDAK dipercaya untuk skor. */
  readonly clientTs: number;
}

export interface JoinedRoom {
  readonly roomCode: string;
  /** Id socket pemain ini — dipakai client untuk menyorot dirinya di leaderboard. */
  readonly playerId: string;
  readonly roomState: RoomState;
}

// ---------------------------------------------------------------------------
// Payload server → client
// ---------------------------------------------------------------------------

export interface GameStartedPayload {
  readonly targetColors: readonly Color[];
  readonly targetScore: number;
  readonly timeLimitSec: number;
  readonly level: number;
}

export interface PixelSpawnedPayload {
  readonly pixel: Pixel;
}

export interface PixelClaimedPayload {
  readonly pixelId: string;
  readonly cell: Cell;
  readonly byPlayerId: string;
  readonly points: number;
  readonly combo: number;
  readonly score: number;
}

export interface ClickRejectedPayload {
  readonly pixelId: string;
  readonly reason: 'wrongColor' | 'tooLate' | 'notFound' | 'rateLimited' | 'notRunning';
  readonly penalty: number;
}

export interface BombHitPayload {
  readonly pixelId: string;
  readonly byPlayerId: string;
  readonly scorePenalty: number;
}

export interface TargetChangedPayload {
  readonly colors: readonly Color[];
  readonly previousColors: readonly Color[];
}

export interface ScoreboardEntry {
  readonly playerId: string;
  readonly nickname: string;
  readonly score: number;
  readonly combo: number;
  readonly connected: boolean;
}

export interface TickPayload {
  readonly remainingMs: number;
  readonly level: number;
  readonly chaos: ChaosModifier | null;
  readonly scoreboard: readonly ScoreboardEntry[];
}

export interface MatchEndedPayload {
  readonly ranking: readonly MatchResultEntry[];
  readonly reason: 'targetScore' | 'timeUp' | 'suddenDeath';
}

// ---------------------------------------------------------------------------
// Map event — dipakai untuk mengetik Server & Socket di kedua sisi
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (result: Ack<JoinedRoom>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (result: Ack<JoinedRoom>) => void) => void;
  'room:leave': () => void;
  /**
   * Pemain selesai melihat layar hasil dan mau kembali ke lobby.
   *
   * Dibuat eksplisit karena server TIDAK boleh mengembalikan room ke `waiting`
   * begitu match selesai: client akan berpindah ke lobby sebelum sempat
   * menampilkan hasilnya.
   */
  'room:backToLobby': () => void;
  'room:updateSettings': (
    payload: UpdateSettingsPayload,
    ack: (result: Ack<RoomState>) => void,
  ) => void;
  'player:ready': (payload: ReadyPayload) => void;
  'game:start': (ack: (result: Ack<null>) => void) => void;
  'game:click': (payload: ClickPayload) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:countdown': (payload: { readonly seconds: number }) => void;
  'game:started': (payload: GameStartedPayload) => void;
  'game:pixelSpawned': (payload: PixelSpawnedPayload) => void;
  'game:pixelExpired': (payload: { readonly pixelId: string }) => void;
  'game:pixelClaimed': (payload: PixelClaimedPayload) => void;
  'game:clickRejected': (payload: ClickRejectedPayload) => void;
  'game:bombHit': (payload: BombHitPayload) => void;
  'game:targetChanged': (payload: TargetChangedPayload) => void;
  'game:boardShuffled': (payload: { readonly pixels: readonly Pixel[] }) => void;
  'game:tick': (payload: TickPayload) => void;
  'game:suddenDeath': () => void;
  'game:ended': (payload: MatchEndedPayload) => void;
  error: (payload: SocketError) => void;
}
