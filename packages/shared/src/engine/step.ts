import {
  TARGET_CHANGE_AFTER_CORRECT_CLICKS,
  TARGET_COLOR_SPAWN_WEIGHT,
  TARGET_MAX_DURATION_MS,
  TARGET_MIN_DURATION_MS,
} from '../constants/index';
import type { Color, GameStatus, Pixel } from '../types/index';
import { activeColors, levelFor, lifetimeMs, spawnIntervalMs } from './difficulty';
import type { GameEvent } from './events';
import { nextInRange, nextRandom, pickOne } from './rng';
import type { BoardState, GameState, ScoreState } from './state';

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * Batas spawn per pemanggilan `step`. Kalau tab di-background lalu dibuka lagi,
 * deltaMs bisa besar sekali; tanpa batas ini papan akan langsung dijejali pixel.
 */
const MAX_SPAWNS_PER_STEP = 8;

/**
 * Majukan state game sebanyak `deltaMs`.
 *
 * Fungsi ini pure: dipakai client untuk solo mode (dipanggil tiap frame) dan
 * nanti dipakai game server untuk multiplayer (dipanggil 20× per detik).
 */
export function step(state: GameState, deltaMs: number): StepResult {
  if (state.status !== 'running' || deltaMs <= 0) {
    return { state, events: [] };
  }

  const events: GameEvent[] = [];
  const elapsedMs = state.elapsedMs + deltaMs;
  const level = levelFor(state.score.correctClicks);

  let board = state.board;
  let score = state.score;

  // 1. Pixel yang lewat umurnya hilang dari papan.
  const survivors: Pixel[] = [];
  let missedTargetPixel = false;
  for (const pixel of board.pixels) {
    if (pixel.spawnedAtMs + pixel.lifetimeMs <= elapsedMs) {
      const wasTarget = pixel.color === board.targetColor;
      if (wasTarget) missedTargetPixel = true;
      events.push({ type: 'pixelExpired', pixelId: pixel.id, wasTarget });
    } else {
      survivors.push(pixel);
    }
  }
  if (survivors.length !== board.pixels.length) {
    board = { ...board, pixels: survivors };
  }

  // Combo hanya putus kalau yang terlewat adalah pixel warna target. Pixel warna
  // lain memang seharusnya diabaikan — menghukumnya bikin combo mustahil dijaga.
  if (missedTargetPixel && score.combo > 0) {
    events.push({ type: 'comboBroken', previousCombo: score.combo });
    score = { ...score, combo: 0 };
  }

  // 2. Warna target berganti karena waktunya habis atau sudah cukup klik benar.
  const timeToChange = elapsedMs >= board.targetChangesAtMs;
  const clicksToChange = board.correctClicksSinceTargetChange >= TARGET_CHANGE_AFTER_CORRECT_CLICKS;
  if (timeToChange || clicksToChange) {
    const changed = changeTargetColor(board, level, elapsedMs);
    events.push({
      type: 'targetChanged',
      color: changed.targetColor,
      previousColor: board.targetColor,
    });
    board = changed;
  }

  // 3. Spawn pixel baru sesuai jadwal.
  let spawnCount = 0;
  while (board.nextSpawnAtMs <= elapsedMs && spawnCount < MAX_SPAWNS_PER_STEP) {
    const spawnAtMs = board.nextSpawnAtMs;
    const spawned = spawnPixel(board, level, state.config.gridSize, spawnAtMs);
    board = {
      ...spawned.board,
      nextSpawnAtMs: spawnAtMs + spawnIntervalMs(level),
    };
    if (spawned.pixel) {
      events.push({ type: 'pixelSpawned', pixel: spawned.pixel });
    }
    spawnCount += 1;
  }

  // 4. Multiplayer: waktu habis → match selesai.
  let status: GameStatus = state.status;
  if (state.config.timeLimitMs !== null && elapsedMs >= state.config.timeLimitMs) {
    status = 'finished';
  }

  return {
    state: { ...state, status, elapsedMs, board, score },
    events,
  };
}

function changeTargetColor(board: BoardState, level: number, elapsedMs: number): BoardState {
  const colors = activeColors(level);
  const candidates = colors.filter((color) => color !== board.targetColor);
  const pool = candidates.length > 0 ? candidates : colors;

  const picked = pickOne(board.rngState, pool);
  const duration = nextInRange(picked.state, TARGET_MIN_DURATION_MS, TARGET_MAX_DURATION_MS);

  return {
    ...board,
    targetColor: picked.value,
    targetChangesAtMs: elapsedMs + Math.round(duration.value),
    correctClicksSinceTargetChange: 0,
    rngState: duration.state,
  };
}

interface SpawnResult {
  readonly board: BoardState;
  /** `null` kalau papan penuh — jadwal tetap maju, tapi tidak ada pixel baru. */
  readonly pixel: Pixel | null;
}

function spawnPixel(
  board: BoardState,
  level: number,
  gridSize: number,
  spawnAtMs: number,
): SpawnResult {
  const occupied = new Set(board.pixels.map((pixel) => pixel.cell.row * gridSize + pixel.cell.col));
  const freeCells: number[] = [];
  for (let index = 0; index < gridSize * gridSize; index += 1) {
    if (!occupied.has(index)) freeCells.push(index);
  }
  if (freeCells.length === 0) {
    return { board, pixel: null };
  }

  const cellPick = pickOne(board.rngState, freeCells);
  const colorPick = pickColor(cellPick.state, board.targetColor, activeColors(level));

  const pixel: Pixel = {
    id: `p${board.nextPixelSeq}`,
    cell: {
      row: Math.floor(cellPick.value / gridSize),
      col: cellPick.value % gridSize,
    },
    color: colorPick.color,
    spawnedAtMs: spawnAtMs,
    lifetimeMs: lifetimeMs(level),
  };

  return {
    board: {
      ...board,
      pixels: [...board.pixels, pixel],
      rngState: colorPick.rngState,
      nextPixelSeq: board.nextPixelSeq + 1,
    },
    pixel,
  };
}

/** Spawn di-bias ke warna target — lihat TARGET_COLOR_SPAWN_WEIGHT. */
function pickColor(
  rngState: number,
  targetColor: Color,
  colors: readonly Color[],
): { readonly color: Color; readonly rngState: number } {
  const roll = nextRandom(rngState);
  if (roll.value < TARGET_COLOR_SPAWN_WEIGHT) {
    return { color: targetColor, rngState: roll.state };
  }

  const others = colors.filter((color) => color !== targetColor);
  if (others.length === 0) {
    return { color: targetColor, rngState: roll.state };
  }

  const picked = pickOne(roll.state, others);
  return { color: picked.value, rngState: picked.state };
}

/** Dipakai test & renderer: ScoreState setelah combo diputus. */
export function breakCombo(score: ScoreState): ScoreState {
  return score.combo === 0 ? score : { ...score, combo: 0 };
}
