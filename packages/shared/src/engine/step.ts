import {
  BOMB_FIRST_LEVEL,
  CHAOS_SHUFFLE_INTERVAL_MS,
  BOMB_MAX_CHANCE,
  BOMB_MIN_CHANCE,
  GOLD_CHANCE,
  GOLD_FIRST_LEVEL,
  GOLD_LIFETIME_FACTOR,
  LIFE_CHANCE,
  LIFE_FIRST_LEVEL,
  LIFE_LIFETIME_FACTOR,
  MAX_CURVE_LEVEL,
  MAX_LIVES,
  TARGET_CHANGE_AFTER_CORRECT_CLICKS,
  TARGET_COLOR_SPAWN_WEIGHT,
  TARGET_MAX_DURATION_MS,
  TARGET_MIN_DURATION_MS,
} from '../constants/index';
import type { ChaosModifier, Color, GameStatus, Pixel, PixelKind } from '../types/index';
import { chaosBombFactor, chaosModifierFor, chaosShufflesBoard, chaosSpawnFactor } from './chaos';
import { activeColors, lifetimeMs, spawnIntervalMs } from './difficulty';
import type { GameEvent } from './events';
import { nextInRange, nextRandom, pickOne } from './rng';
import { targetColorCount } from './state';
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
  const level = state.board.level;
  const chaos = chaosModifierFor(state.board.chaosSeed, level);

  let board = state.board;
  let score = state.score;

  // 1. Pixel yang lewat umurnya hilang dari papan.
  const survivors: Pixel[] = [];
  let missedTargetPixel = false;
  for (const pixel of board.pixels) {
    if (pixel.spawnedAtMs + pixel.lifetimeMs <= elapsedMs) {
      // Hanya pixel biasa berwarna target yang dianggap "terlewat". Bom memang
      // harus dibiarkan pudar, dan melewatkan emas/nyawa cuma sayang — bukan
      // kesalahan yang layak memutus combo.
      const wasTarget = pixel.kind === 'normal' && board.targetColors.includes(pixel.color);
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

  // 2. Warna target berganti karena waktunya habis, sudah cukup klik benar, atau
  //    karena jumlah warna target yang seharusnya aktif berubah.
  //
  //    Syarat ketiga itu penting: tanpanya, pemain yang baru naik ke Lv 12 masih
  //    melihat satu warna target sampai pergantian terjadwal berikutnya — bisa
  //    12 detik kemudian. Level naik tapi gamenya belum berubah.
  const timeToChange = elapsedMs >= board.targetChangesAtMs;
  const clicksToChange = board.correctClicksSinceTargetChange >= TARGET_CHANGE_AFTER_CORRECT_CLICKS;
  const countChanged = board.targetColors.length !== targetColorCount(level);
  if (timeToChange || clicksToChange || countChanged) {
    const changed = changeTargetColors(board, level, elapsedMs);
    events.push({
      type: 'targetChanged',
      colors: changed.targetColors,
      previousColors: board.targetColors,
    });
    board = changed;
  }

  // 3. Spawn pixel baru sesuai jadwal.
  let spawnCount = 0;
  while (board.nextSpawnAtMs <= elapsedMs && spawnCount < MAX_SPAWNS_PER_STEP) {
    const spawnAtMs = board.nextSpawnAtMs;
    // Di solo, pixel ♥ hanya berguna kalau nyawanya belum penuh.
    //
    // Di multiplayer papannya BERSAMA, jadi keputusan spawn tidak boleh
    // bergantung pada nyawa satu pemain — pemain yang sekarat justru paling
    // butuh ♥ muncul, dan itu tidak akan terjadi kalau pemain lain kebetulan
    // penuh. Di sana ♥ selalu boleh muncul dan menjadi rebutan seperti pixel
    // lainnya.
    const canDropLife =
      state.config.mode === 'multiplayer' || (score.lives !== null && score.lives < MAX_LIVES);
    const spawned = spawnPixel(board, level, state.config.gridSize, spawnAtMs, canDropLife, chaos);
    board = {
      ...spawned.board,
      nextSpawnAtMs: spawnAtMs + Math.round(spawnIntervalMs(level) * chaosSpawnFactor(chaos)),
    };
    if (spawned.pixel) {
      events.push({ type: 'pixelSpawned', pixel: spawned.pixel });
    }
    spawnCount += 1;
  }

  // 3b. Modifier `shuffle`: pindahkan pixel yang hidup ke sel lain.
  if (chaosShufflesBoard(chaos) && elapsedMs >= board.nextShuffleAtMs) {
    board = shuffleBoard(board, state.config.gridSize, elapsedMs);
    events.push({ type: 'boardShuffled' });
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

function changeTargetColors(board: BoardState, level: number, elapsedMs: number): BoardState {
  const colors = activeColors(level);
  const wanted = Math.min(targetColorCount(level), colors.length);

  // Warna baru diusahakan berbeda dari yang sedang aktif, supaya pergantiannya
  // benar-benar terasa sebagai pergantian.
  let pool = colors.filter((color) => !board.targetColors.includes(color));
  if (pool.length < wanted) pool = [...colors];

  const picked: Color[] = [];
  let rngState = board.rngState;
  while (picked.length < wanted && pool.length > 0) {
    const choice = pickOne(rngState, pool);
    picked.push(choice.value);
    rngState = choice.state;
    pool = pool.filter((color) => color !== choice.value);
  }

  const duration = nextInRange(rngState, TARGET_MIN_DURATION_MS, TARGET_MAX_DURATION_MS);

  return {
    ...board,
    targetColors: picked,
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

/**
 * Peluang bom di level tertentu: 0 sebelum BOMB_FIRST_LEVEL, lalu naik mulus
 * dari BOMB_MIN_CHANCE sampai BOMB_MAX_CHANCE di ujung kurva.
 */
export function bombChance(level: number): number {
  if (level < BOMB_FIRST_LEVEL) return 0;
  const span = Math.max(1, MAX_CURVE_LEVEL - BOMB_FIRST_LEVEL);
  const progress = Math.min(1, (level - BOMB_FIRST_LEVEL) / span);
  return BOMB_MIN_CHANCE + (BOMB_MAX_CHANCE - BOMB_MIN_CHANCE) * progress;
}

interface KindPick {
  readonly kind: PixelKind;
  readonly rngState: number;
}

/**
 * Undi jenis pixel. Urutannya sengaja: nyawa dulu (paling langka dan paling
 * berharga), lalu emas, lalu bom — supaya peluang masing-masing tidak saling
 * memakan secara tak terduga.
 */
function pickKind(
  rngState: number,
  level: number,
  canDropLife: boolean,
  chaos: ChaosModifier | null,
): KindPick {
  const roll = nextRandom(rngState);
  let threshold = 0;

  if (canDropLife && level >= LIFE_FIRST_LEVEL) {
    threshold += LIFE_CHANCE;
    if (roll.value < threshold) return { kind: 'life', rngState: roll.state };
  }

  if (level >= GOLD_FIRST_LEVEL) {
    threshold += GOLD_CHANCE;
    if (roll.value < threshold) return { kind: 'gold', rngState: roll.state };
  }

  threshold += Math.min(0.6, bombChance(level) * chaosBombFactor(chaos));
  if (roll.value < threshold) return { kind: 'bomb', rngState: roll.state };

  return { kind: 'normal', rngState: roll.state };
}

function lifetimeForKind(kind: PixelKind, level: number): number {
  const base = lifetimeMs(level);
  if (kind === 'gold') return Math.round(base * GOLD_LIFETIME_FACTOR);
  if (kind === 'life') return Math.round(base * LIFE_LIFETIME_FACTOR);
  return base;
}

function spawnPixel(
  board: BoardState,
  level: number,
  gridSize: number,
  spawnAtMs: number,
  canDropLife: boolean,
  chaos: ChaosModifier | null,
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
  const kindPick = pickKind(cellPick.state, level, canDropLife, chaos);
  // Pixel spesial tidak ikut aturan warna target, tapi tetap punya warna supaya
  // renderer bisa mewarnainya secara konsisten.
  const colorPick = pickColor(kindPick.rngState, board.targetColors, activeColors(level));

  const pixel: Pixel = {
    id: `p${board.nextPixelSeq}`,
    cell: {
      row: Math.floor(cellPick.value / gridSize),
      col: cellPick.value % gridSize,
    },
    color: colorPick.color,
    kind: kindPick.kind,
    spawnedAtMs: spawnAtMs,
    lifetimeMs: lifetimeForKind(kindPick.kind, level),
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

/**
 * Spawn di-bias ke warna target — lihat TARGET_COLOR_SPAWN_WEIGHT.
 *
 * Bobot totalnya tetap sama walau ada dua warna target: bobotnya dibagi di
 * antara keduanya. Jadi kepadatan pixel yang bisa diklik tidak berubah, dan
 * kesulitan tambahan murni datang dari harus melacak dua warna sekaligus.
 */
function pickColor(
  rngState: number,
  targetColors: readonly Color[],
  colors: readonly Color[],
): { readonly color: Color; readonly rngState: number } {
  const roll = nextRandom(rngState);
  if (roll.value < TARGET_COLOR_SPAWN_WEIGHT && targetColors.length > 0) {
    const picked = pickOne(roll.state, targetColors);
    return { color: picked.value, rngState: picked.state };
  }

  const others = colors.filter((color) => !targetColors.includes(color));
  if (others.length === 0) {
    const picked = pickOne(roll.state, targetColors);
    return { color: picked.value, rngState: picked.state };
  }

  const picked = pickOne(roll.state, others);
  return { color: picked.value, rngState: picked.state };
}

/** Dipakai test & renderer: ScoreState setelah combo diputus. */
export function breakCombo(score: ScoreState): ScoreState {
  return score.combo === 0 ? score : { ...score, combo: 0 };
}

/** Pindahkan setiap pixel hidup ke sel acak lain (modifier chaos `shuffle`). */
function shuffleBoard(board: BoardState, gridSize: number, elapsedMs: number): BoardState {
  const total = gridSize * gridSize;
  const available: number[] = [];
  for (let index = 0; index < total; index += 1) available.push(index);

  let rngState = board.rngState;
  const pixels: Pixel[] = [];
  let pool = available;

  for (const pixel of board.pixels) {
    if (pool.length === 0) {
      pixels.push(pixel);
      continue;
    }
    const choice = pickOne(rngState, pool);
    rngState = choice.state;
    pool = pool.filter((index) => index !== choice.value);
    pixels.push({
      ...pixel,
      cell: { row: Math.floor(choice.value / gridSize), col: choice.value % gridSize },
    });
  }

  return {
    ...board,
    pixels,
    rngState,
    nextShuffleAtMs: elapsedMs + CHAOS_SHUFFLE_INTERVAL_MS,
  };
}
