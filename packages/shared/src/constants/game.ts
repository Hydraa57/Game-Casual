import type { Color, RoomSettings } from '../types/index';

// ---------------------------------------------------------------------------
// Papan (GDD §2)
// ---------------------------------------------------------------------------

/**
 * Papan selalu GRID_SIZE × GRID_SIZE, termasuk di layar HP. Ukurannya TIDAK
 * boleh berubah per device: papan multiplayer harus identik untuk semua pemain,
 * dan high score solo harus sebanding. Di mobile yang menyesuaikan adalah
 * ukuran pixel-nya (canvas di-scale), bukan jumlah selnya.
 */
export const GRID_SIZE = 8;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export const ALL_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
] as const satisfies readonly Color[];

/** Palet retro untuk renderer. */
export const COLOR_HEX: Record<Color, number> = {
  red: 0xe43b44,
  blue: 0x4d9be6,
  green: 0x63c74d,
  yellow: 0xfee761,
  purple: 0xb55088,
  orange: 0xf77622,
};

/** Glyph pembeda warna, dukungan buta warna (GDD §2). */
export const COLOR_GLYPH: Record<Color, string> = {
  red: '▲',
  blue: '●',
  green: '■',
  yellow: '★',
  purple: '◆',
  orange: '✚',
};

// ---------------------------------------------------------------------------
// Skor (GDD §3)
// ---------------------------------------------------------------------------

export const BASE_POINTS = 10;
export const MAX_SPEED_BONUS = 10;
export const WRONG_CLICK_PENALTY = 5;

/** Multiplier naik satu tingkat setiap COMBO_STEP klik benar beruntun. */
export const COMBO_STEP = 5;
export const COMBO_MULTIPLIERS = [1, 1.5, 2] as const;

// ---------------------------------------------------------------------------
// Solo & kurva kesulitan (GDD §4)
// ---------------------------------------------------------------------------

export const SOLO_STARTING_LIVES = 3;
export const CLICKS_PER_LEVEL = 15;

export const INITIAL_SPAWN_INTERVAL_MS = 1200;
export const SPAWN_INTERVAL_FACTOR_PER_LEVEL = 0.92;
export const MIN_SPAWN_INTERVAL_MS = 400;

export const INITIAL_LIFETIME_MS = 3000;
export const LIFETIME_FACTOR_PER_LEVEL = 0.95;
export const MIN_LIFETIME_MS = 1200;

export const INITIAL_ACTIVE_COLORS = 3;
/** Level di mana satu warna baru diaktifkan (3 → 4 → 5 → 6 warna). */
export const COLOR_UNLOCK_LEVELS = [3, 5, 7] as const;

// ---------------------------------------------------------------------------
// Warna target (GDD §2)
// ---------------------------------------------------------------------------

export const TARGET_MIN_DURATION_MS = 8000;
export const TARGET_MAX_DURATION_MS = 12000;
export const TARGET_CHANGE_AFTER_CORRECT_CLICKS = 8;
/** Durasi HUD berkedip sebelum warna target benar-benar berganti. */
export const TARGET_WARNING_MS = 1000;

// ---------------------------------------------------------------------------
// Multiplayer (GDD §5)
// ---------------------------------------------------------------------------

export const MP_WRONG_CLICK_COOLDOWN_MS = 500;
export const MAX_CLICKS_PER_SECOND = 8;

export const SERVER_TICK_HZ = 20;
export const SERVER_TICK_MS = 1000 / SERVER_TICK_HZ;

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS_LIMIT = 4;
export const COUNTDOWN_SECONDS = 3;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

export const ALLOWED_TARGET_SCORES = [100, 150, 200] as const;
export const ALLOWED_TIME_LIMITS_SEC = [60, 90, 120, 180] as const;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  targetScore: 150,
  timeLimitSec: 120,
};
