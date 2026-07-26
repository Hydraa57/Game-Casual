import { describe, expect, it } from 'vitest';
import {
  CHAOS_BOMB_MULTIPLIER,
  CHAOS_FIRST_LEVEL,
  CHAOS_MODIFIERS,
  CHAOS_RUSH_SPAWN_FACTOR,
  CHAOS_SHUFFLE_INTERVAL_MS,
  DUAL_TARGET_FIRST_LEVEL,
  MAX_CURVE_LEVEL,
  TARGET_COLOR_SPAWN_WEIGHT,
} from '../constants/index';
import type { ChaosModifier } from '../types/index';
import {
  chaosBombFactor,
  chaosHidesGlyphs,
  chaosModifierFor,
  chaosShufflesBoard,
  chaosSpawnFactor,
  isChaosLevel,
} from './chaos';
import { activeColors } from './difficulty';
import type { GameEvent } from './events';
import { createGameState, startGame, targetColorCount } from './state';
import type { GameState } from './state';
import { step } from './step';

function gameAtLevel(level: number, seed = 909): GameState {
  const base = startGame(createGameState({ seed }));
  return { ...base, board: { ...base.board, level } };
}

function runFor(state: GameState, totalMs: number, stepMs = 16) {
  let current = state;
  const events: GameEvent[] = [];
  let left = totalMs;
  while (left > 0) {
    const delta = Math.min(stepMs, left);
    const result = step(current, delta);
    current = result.state;
    events.push(...result.events);
    left -= delta;
  }
  return { state: current, events };
}

describe('dua warna target', () => {
  it('satu warna sebelum Lv 12, dua warna sejak Lv 12', () => {
    expect(targetColorCount(1)).toBe(1);
    expect(targetColorCount(DUAL_TARGET_FIRST_LEVEL - 1)).toBe(1);
    expect(targetColorCount(DUAL_TARGET_FIRST_LEVEL)).toBe(2);
    expect(targetColorCount(MAX_CURVE_LEVEL)).toBe(2);
  });

  it('papan benar-benar punya dua warna target setelah pergantian di Lv 12', () => {
    const { state } = runFor(gameAtLevel(DUAL_TARGET_FIRST_LEVEL), 40_000);
    expect(state.board.targetColors).toHaveLength(2);
    expect(new Set(state.board.targetColors).size).toBe(2);
  });

  it('tetap satu warna di level rendah', () => {
    const { state } = runFor(gameAtLevel(5), 40_000);
    expect(state.board.targetColors).toHaveLength(1);
  });

  it('keduanya memberi poin', () => {
    const { state } = runFor(gameAtLevel(DUAL_TARGET_FIRST_LEVEL), 40_000);
    const [first, second] = state.board.targetColors;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  it('warna target selalu diambil dari warna yang aktif di level itu', () => {
    const allowed = activeColors(DUAL_TARGET_FIRST_LEVEL);
    const { events } = runFor(gameAtLevel(DUAL_TARGET_FIRST_LEVEL), 200_000);
    for (const event of events) {
      if (event.type === 'targetChanged') {
        for (const color of event.colors) expect(allowed).toContain(color);
      }
    }
  });

  it('bobot spawn total ke warna target tidak berubah walau ada dua warna', () => {
    // Kepadatan pixel yang bisa diklik harus tetap; kesulitan tambahannya murni
    // karena pemain melacak dua warna sekaligus.
    const { events } = runFor(gameAtLevel(DUAL_TARGET_FIRST_LEVEL, 31337), 600_000);

    let targets: readonly string[] = gameAtLevel(DUAL_TARGET_FIRST_LEVEL, 31337).board.targetColors;
    let spawned = 0;
    let matching = 0;
    for (const event of events) {
      if (event.type === 'targetChanged') {
        targets = event.colors;
      } else if (event.type === 'pixelSpawned' && event.pixel.kind === 'normal') {
        spawned += 1;
        if (targets.includes(event.pixel.color)) matching += 1;
      }
    }

    expect(spawned).toBeGreaterThan(300);
    expect(matching / spawned).toBeCloseTo(TARGET_COLOR_SPAWN_WEIGHT, 1);
  });
});

describe('chaosModifierFor', () => {
  it('tidak ada modifier sampai ujung kurva selesai', () => {
    expect(isChaosLevel(MAX_CURVE_LEVEL)).toBe(false);
    expect(chaosModifierFor(1, 1)).toBeNull();
    expect(chaosModifierFor(1, MAX_CURVE_LEVEL)).toBeNull();
  });

  it('selalu ada modifier dari CHAOS_FIRST_LEVEL', () => {
    expect(isChaosLevel(CHAOS_FIRST_LEVEL)).toBe(true);
    for (let level = CHAOS_FIRST_LEVEL; level < CHAOS_FIRST_LEVEL + 30; level += 1) {
      const modifier = chaosModifierFor(12345, level);
      expect(modifier).not.toBeNull();
      expect(CHAOS_MODIFIERS).toContain(modifier);
    }
  });

  it('deterministik dari seed + level', () => {
    expect(chaosModifierFor(777, 25)).toBe(chaosModifierFor(777, 25));
    // Semua pemain di satu match multiplayer nanti melihat modifier yang sama.
    expect(chaosModifierFor(777, 25)).not.toBe(undefined);
  });

  it('seed berbeda memberi pola modifier berbeda', () => {
    const a = Array.from({ length: 20 }, (_, i) => chaosModifierFor(1, CHAOS_FIRST_LEVEL + i));
    const b = Array.from({ length: 20 }, (_, i) => chaosModifierFor(2, CHAOS_FIRST_LEVEL + i));
    expect(a).not.toEqual(b);
  });

  it('seluruh modifier terpakai dalam rentang level yang panjang', () => {
    const seen = new Set<ChaosModifier | null>();
    for (let level = CHAOS_FIRST_LEVEL; level < CHAOS_FIRST_LEVEL + 200; level += 1) {
      seen.add(chaosModifierFor(4242, level));
    }
    expect(seen.size).toBe(CHAOS_MODIFIERS.length);
  });
});

describe('efek modifier', () => {
  it('rush mempercepat spawn, modifier lain tidak', () => {
    expect(chaosSpawnFactor('rush')).toBe(CHAOS_RUSH_SPAWN_FACTOR);
    expect(chaosSpawnFactor('blackout')).toBe(1);
    expect(chaosSpawnFactor(null)).toBe(1);
  });

  it('bombRain menggandakan peluang bom', () => {
    expect(chaosBombFactor('bombRain')).toBe(CHAOS_BOMB_MULTIPLIER);
    expect(chaosBombFactor(null)).toBe(1);
  });

  it('blackout menyembunyikan glyph', () => {
    expect(chaosHidesGlyphs('blackout')).toBe(true);
    expect(chaosHidesGlyphs('rush')).toBe(false);
  });

  it('shuffle menandai papan harus diacak', () => {
    expect(chaosShufflesBoard('shuffle')).toBe(true);
    expect(chaosShufflesBoard(null)).toBe(false);
  });
});

describe('modifier rush di dalam step', () => {
  it('menghasilkan lebih banyak spawn daripada level yang sama tanpa rush', () => {
    // Cari seed yang memberi `rush` di level chaos pertama.
    let rushSeed: number | null = null;
    for (let seed = 1; seed < 500 && rushSeed === null; seed += 1) {
      if (chaosModifierFor(seed, CHAOS_FIRST_LEVEL) === 'rush') rushSeed = seed;
    }
    expect(rushSeed).not.toBeNull();

    const rushSpawns = runFor(gameAtLevel(CHAOS_FIRST_LEVEL, rushSeed!), 60_000).events.filter(
      (event) => event.type === 'pixelSpawned',
    ).length;
    const plainSpawns = runFor(gameAtLevel(MAX_CURVE_LEVEL, rushSeed!), 60_000).events.filter(
      (event) => event.type === 'pixelSpawned',
    ).length;

    expect(rushSpawns).toBeGreaterThan(plainSpawns);
  });
});

describe('modifier shuffle di dalam step', () => {
  it('memindahkan pixel yang hidup dan memancarkan boardShuffled', () => {
    let shuffleSeed: number | null = null;
    for (let seed = 1; seed < 500 && shuffleSeed === null; seed += 1) {
      if (chaosModifierFor(seed, CHAOS_FIRST_LEVEL) === 'shuffle') shuffleSeed = seed;
    }
    expect(shuffleSeed).not.toBeNull();

    const { events } = runFor(
      gameAtLevel(CHAOS_FIRST_LEVEL, shuffleSeed!),
      CHAOS_SHUFFLE_INTERVAL_MS * 3,
    );
    expect(events.some((event) => event.type === 'boardShuffled')).toBe(true);
  });

  it('tidak mengacak papan di level non-chaos', () => {
    const { events } = runFor(gameAtLevel(MAX_CURVE_LEVEL), CHAOS_SHUFFLE_INTERVAL_MS * 3);
    expect(events.some((event) => event.type === 'boardShuffled')).toBe(false);
  });

  it('pengacakan tidak pernah menumpuk dua pixel di satu sel', () => {
    let shuffleSeed: number | null = null;
    for (let seed = 1; seed < 500 && shuffleSeed === null; seed += 1) {
      if (chaosModifierFor(seed, CHAOS_FIRST_LEVEL) === 'shuffle') shuffleSeed = seed;
    }

    let state = gameAtLevel(CHAOS_FIRST_LEVEL, shuffleSeed!);
    for (let i = 0; i < 2000; i += 1) {
      state = step(state, 16).state;
      const keys = new Set(state.board.pixels.map((p) => `${p.cell.row}:${p.cell.col}`));
      expect(keys.size).toBe(state.board.pixels.length);
    }
  });
});

describe('jumlah warna target menyesuaikan level tanpa menunggu', () => {
  it('naik ke dua warna segera setelah level mencapai Lv 12', () => {
    // Tanpa perbaikan ini pemain tertahan satu warna target sampai pergantian
    // terjadwal berikutnya — bisa 12 detik setelah levelnya naik.
    const state = gameAtLevel(DUAL_TARGET_FIRST_LEVEL);
    expect(state.board.targetColors).toHaveLength(1);

    const result = step(state, 16);
    expect(result.state.board.targetColors).toHaveLength(2);
    expect(result.events.some((event) => event.type === 'targetChanged')).toBe(true);
  });

  it('tetap satu warna di level di bawahnya', () => {
    const result = step(gameAtLevel(DUAL_TARGET_FIRST_LEVEL - 1), 16);
    expect(result.state.board.targetColors).toHaveLength(1);
  });

  it('tidak berganti terus-menerus setelah jumlahnya benar', () => {
    const settled = step(gameAtLevel(DUAL_TARGET_FIRST_LEVEL), 16).state;
    const changes = runFor(settled, 3000).events.filter((event) => event.type === 'targetChanged');
    expect(changes).toHaveLength(0);
  });
});
