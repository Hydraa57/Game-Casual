import {
  GRID_SIZE,
  SOLO_STARTING_LIVES,
  TARGET_MAX_DURATION_MS,
  TARGET_MIN_DURATION_MS,
  TARGET_WARNING_MS,
} from '../constants/index';
import type { Color, GameMode, GameStatus, Pixel } from '../types/index';
import { activeColors, isMaxCurveLevel } from './difficulty';
import { nextInRange, pickOne } from './rng';

export interface GameConfig {
  readonly mode: GameMode;
  readonly gridSize: number;
  /** Solo: nyawa awal. Multiplayer: `null` (tanpa sistem nyawa). */
  readonly startingLives: number | null;
  /** Multiplayer: batas waktu match. Solo: `null` (endless). */
  readonly timeLimitMs: number | null;
  /** Multiplayer: skor untuk menang. Solo: `null`. */
  readonly targetScore: number | null;
}

/** Progres satu pemain. Di multiplayer, server menyimpan satu ScoreState per pemain. */
export interface ScoreState {
  readonly score: number;
  /** Panjang rentetan klik benar saat ini. */
  readonly combo: number;
  readonly bestCombo: number;
  readonly correctClicks: number;
  readonly wrongClicks: number;
  readonly lives: number | null;
}

/**
 * Kondisi papan: sama untuk semua pemain di satu match multiplayer
 * (papan rebutan, GDD §5).
 */
export interface BoardState {
  readonly pixels: readonly Pixel[];
  /**
   * Level kesulitan papan. Disimpan eksplisit, BUKAN diturunkan di dalam
   * `step()` dari klik satu pemain: di multiplayer papan-rebutan, papannya
   * bersama sementara `correctClicks` milik masing-masing pemain, jadi
   * menurunkannya dari sana akan membuat kesulitan bergantung pada siapa yang
   * paling rajin mengklik. Solo mengisinya dari `levelFor(correctClicks)`;
   * server multiplayer nanti mengisinya dari waktu berjalan.
   */
  readonly level: number;
  readonly targetColor: Color;
  /** Waktu (dalam `elapsedMs`) saat warna target berikutnya berganti. */
  readonly targetChangesAtMs: number;
  readonly correctClicksSinceTargetChange: number;
  /** Waktu (dalam `elapsedMs`) spawn berikutnya dijadwalkan. */
  readonly nextSpawnAtMs: number;
  readonly rngState: number;
  readonly nextPixelSeq: number;
}

export interface GameState {
  readonly config: GameConfig;
  readonly status: GameStatus;
  /** Waktu berjalan sejak game dimulai, dalam ms. Tidak bertambah saat pause. */
  readonly elapsedMs: number;
  readonly board: BoardState;
  readonly score: ScoreState;
}

export function soloConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'solo',
    gridSize: GRID_SIZE,
    startingLives: SOLO_STARTING_LIVES,
    timeLimitMs: null,
    targetScore: null,
    ...overrides,
  };
}

export function multiplayerConfig(
  targetScore: number,
  timeLimitSec: number,
  overrides: Partial<GameConfig> = {},
): GameConfig {
  return {
    mode: 'multiplayer',
    gridSize: GRID_SIZE,
    startingLives: null,
    timeLimitMs: timeLimitSec * 1000,
    targetScore,
    ...overrides,
  };
}

export function createScoreState(startingLives: number | null): ScoreState {
  return {
    score: 0,
    combo: 0,
    bestCombo: 0,
    correctClicks: 0,
    wrongClicks: 0,
    lives: startingLives,
  };
}

export interface CreateGameStateOptions {
  readonly seed: number;
  readonly config?: GameConfig;
}

/**
 * Bikin state awal. Status-nya `idle` — pemanggil harus memanggil `startGame()`.
 * Di HP ini penting: game tidak boleh langsung jalan saat halaman baru dibuka,
 * pemain harus sempat menempatkan jempolnya dulu.
 */
export function createGameState({
  seed,
  config = soloConfig(),
}: CreateGameStateOptions): GameState {
  const colors = activeColors(1);
  const target = pickOne(seed, colors);
  const firstChange = nextInRange(target.state, TARGET_MIN_DURATION_MS, TARGET_MAX_DURATION_MS);

  return {
    config,
    status: 'idle',
    elapsedMs: 0,
    board: {
      pixels: [],
      level: 1,
      targetColor: target.value,
      targetChangesAtMs: Math.round(firstChange.value),
      correctClicksSinceTargetChange: 0,
      nextSpawnAtMs: 0,
      rngState: firstChange.state,
      nextPixelSeq: 1,
    },
    score: createScoreState(config.startingLives),
  };
}

export function startGame(state: GameState): GameState {
  if (state.status === 'running') return state;
  if (state.status === 'idle') return { ...state, status: 'running' };
  // gameOver / finished / paused → mulai ronde baru dari state awal, seed diputar
  // dari rngState terakhir supaya ronde berikutnya tidak mengulang pola yang sama.
  return {
    ...createGameState({ seed: state.board.rngState, config: state.config }),
    status: 'running',
  };
}

export function pauseGame(state: GameState): GameState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

export function resumeGame(state: GameState): GameState {
  return state.status === 'paused' ? { ...state, status: 'running' } : state;
}

export function isPlayable(status: GameStatus): boolean {
  return status === 'running';
}

/** Level kesulitan papan saat ini. */
export function currentLevel(state: GameState): number {
  return state.board.level;
}

/** True saat kesulitan sudah mentok — HUD menampilkan "MAX". */
export function isAtMaxLevel(state: GameState): boolean {
  return isMaxCurveLevel(state.board.level);
}

/** True saat HUD harus berkedip karena warna target akan segera berganti. */
export function isTargetChangeImminent(state: GameState): boolean {
  return state.board.targetChangesAtMs - state.elapsedMs <= TARGET_WARNING_MS;
}

/** Sisa waktu match multiplayer dalam ms; `null` untuk solo yang endless. */
export function remainingTimeMs(state: GameState): number | null {
  if (state.config.timeLimitMs === null) return null;
  return Math.max(0, state.config.timeLimitMs - state.elapsedMs);
}
