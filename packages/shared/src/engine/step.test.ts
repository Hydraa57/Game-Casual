import { describe, expect, it } from 'vitest';
import {
  GRID_SIZE,
  TARGET_CHANGE_AFTER_CORRECT_CLICKS,
  TARGET_COLOR_SPAWN_WEIGHT,
  TARGET_MAX_DURATION_MS,
} from '../constants/index';
import type { Color } from '../types/index';
import { activeColors } from './difficulty';
import type { GameEvent } from './events';
import { createGameState, pauseGame, soloConfig, startGame } from './state';
import type { GameState } from './state';
import { step } from './step';

function newRunningGame(seed = 1234): GameState {
  return startGame(createGameState({ seed }));
}

/** Jalankan game maju `totalMs` dengan langkah kecil seperti frame browser. */
function runFor(
  state: GameState,
  totalMs: number,
  stepMs = 16,
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  let remaining = totalMs;
  while (remaining > 0) {
    const delta = Math.min(stepMs, remaining);
    const result = step(current, delta);
    current = result.state;
    events.push(...result.events);
    remaining -= delta;
  }
  return { state: current, events };
}

describe('createGameState', () => {
  it('mulai dalam status idle tanpa pixel — game tidak jalan sebelum pemain siap', () => {
    const state = createGameState({ seed: 1 });
    expect(state.status).toBe('idle');
    expect(state.board.pixels).toHaveLength(0);
    expect(state.elapsedMs).toBe(0);
    expect(state.score.score).toBe(0);
  });

  it('warna target awal diambil dari warna level 1', () => {
    const state = createGameState({ seed: 99 });
    expect(activeColors(1)).toContain(state.board.targetColors[0]);
  });

  it('nyawa awal mengikuti config (solo 3, multiplayer tanpa nyawa)', () => {
    expect(createGameState({ seed: 1 }).score.lives).toBe(3);
    expect(
      createGameState({ seed: 1, config: soloConfig({ startingLives: null }) }).score.lives,
    ).toBeNull();
  });
});

describe('step saat game tidak berjalan', () => {
  it('tidak melakukan apa pun saat idle', () => {
    const state = createGameState({ seed: 1 });
    const result = step(state, 1000);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
  });

  it('pause benar-benar membekukan waktu dan papan', () => {
    const running = runFor(newRunningGame(), 3000).state;
    const paused = pauseGame(running);

    const result = step(paused, 10_000);
    expect(result.state.elapsedMs).toBe(running.elapsedMs);
    expect(result.state.board.pixels).toEqual(running.board.pixels);
    expect(result.events).toHaveLength(0);
  });
});

describe('spawn pixel', () => {
  it('pixel pertama muncul di awal permainan', () => {
    const { events } = runFor(newRunningGame(), 100);
    expect(events.filter((event) => event.type === 'pixelSpawned')).not.toHaveLength(0);
  });

  it('jumlah spawn kira-kira sesuai jeda spawn level 1', () => {
    // 10 detik dengan jeda 1.2 dtk → sekitar 9 pixel (toleransi pembulatan frame).
    const { events } = runFor(newRunningGame(), 10_000);
    const spawns = events.filter((event) => event.type === 'pixelSpawned');
    expect(spawns.length).toBeGreaterThanOrEqual(8);
    expect(spawns.length).toBeLessThanOrEqual(10);
  });

  it('pixel selalu berada di dalam papan dan tidak pernah bertumpuk', () => {
    let state = newRunningGame();
    for (let i = 0; i < 400; i += 1) {
      state = step(state, 16).state;
      const keys = new Set<string>();
      for (const pixel of state.board.pixels) {
        expect(pixel.cell.row).toBeGreaterThanOrEqual(0);
        expect(pixel.cell.row).toBeLessThan(GRID_SIZE);
        expect(pixel.cell.col).toBeGreaterThanOrEqual(0);
        expect(pixel.cell.col).toBeLessThan(GRID_SIZE);
        keys.add(`${pixel.cell.row}:${pixel.cell.col}`);
      }
      expect(keys.size).toBe(state.board.pixels.length);
    }
  });

  it('spawn di-bias ke warna target supaya papan tidak terasa mati', () => {
    const { events } = runFor(newRunningGame(777), 600_000);

    let target = createGameState({ seed: 777 }).board.targetColors[0];
    let spawned = 0;
    let matchingTarget = 0;
    for (const event of events) {
      if (event.type === 'targetChanged') {
        target = event.colors[0]!;
      } else if (event.type === 'pixelSpawned') {
        spawned += 1;
        if (event.pixel.color === target) matchingTarget += 1;
      }
    }

    expect(spawned).toBeGreaterThan(300);
    expect(matchingTarget / spawned).toBeCloseTo(TARGET_COLOR_SPAWN_WEIGHT, 1);
  });

  it('deterministik: seed yang sama menghasilkan urutan pixel yang sama', () => {
    const a = runFor(newRunningGame(2024), 20_000);
    const b = runFor(newRunningGame(2024), 20_000);
    expect(a.state.board.pixels).toEqual(b.state.board.pixels);
    expect(a.events).toEqual(b.events);
  });

  it('seed berbeda menghasilkan urutan berbeda', () => {
    const a = runFor(newRunningGame(1), 20_000);
    const b = runFor(newRunningGame(2), 20_000);
    expect(a.events).not.toEqual(b.events);
  });
});

describe('pixel kedaluwarsa', () => {
  it('pixel hilang dari papan setelah umurnya habis', () => {
    const { events } = runFor(newRunningGame(), 8000);
    const expired = events.filter((event) => event.type === 'pixelExpired');
    expect(expired.length).toBeGreaterThan(0);
  });

  it('pixel warna target yang terlewat memutus combo', () => {
    const base = newRunningGame();
    const state: GameState = {
      ...base,
      elapsedMs: 5000,
      score: { ...base.score, combo: 7 },
      board: {
        ...base.board,
        targetColors: ['red'],
        nextSpawnAtMs: 999_999, // matikan spawn supaya test fokus
        pixels: [
          {
            id: 'target',
            cell: { row: 0, col: 0 },
            color: 'red',
            kind: 'normal',
            spawnedAtMs: 4000,
            lifetimeMs: 1000,
          },
        ],
      },
    };

    const result = step(state, 20);
    expect(result.state.score.combo).toBe(0);
    expect(result.events).toEqual(
      expect.arrayContaining([
        { type: 'pixelExpired', pixelId: 'target', wasTarget: true },
        { type: 'comboBroken', previousCombo: 7 },
      ]),
    );
  });

  it('pixel warna lain yang terlewat TIDAK memutus combo — memang harus diabaikan', () => {
    const base = newRunningGame();
    const state: GameState = {
      ...base,
      elapsedMs: 5000,
      score: { ...base.score, combo: 7 },
      board: {
        ...base.board,
        targetColors: ['red'],
        nextSpawnAtMs: 999_999,
        pixels: [
          {
            id: 'distractor',
            cell: { row: 1, col: 1 },
            color: 'blue',
            kind: 'normal',
            spawnedAtMs: 4000,
            lifetimeMs: 1000,
          },
        ],
      },
    };

    const result = step(state, 20);
    expect(result.state.score.combo).toBe(7);
    expect(result.events).toContainEqual({
      type: 'pixelExpired',
      pixelId: 'distractor',
      wasTarget: false,
    });
    expect(result.events.some((event) => event.type === 'comboBroken')).toBe(false);
  });
});

describe('pergantian warna target', () => {
  it('berganti setelah durasinya lewat', () => {
    const { events } = runFor(newRunningGame(), TARGET_MAX_DURATION_MS + 500);
    expect(events.filter((event) => event.type === 'targetChanged').length).toBeGreaterThan(0);
  });

  it('warna baru selalu berbeda dari warna sebelumnya', () => {
    const { events } = runFor(newRunningGame(4242), 300_000);
    const changes = events.filter(
      (event): event is Extract<GameEvent, { type: 'targetChanged' }> =>
        event.type === 'targetChanged',
    );
    expect(changes.length).toBeGreaterThan(10);
    for (const change of changes) {
      // Setidaknya satu warna harus benar-benar berganti.
      expect(change.colors).not.toEqual(change.previousColors);
    }
  });

  it('berganti lebih awal kalau sudah cukup klik benar', () => {
    const base = newRunningGame();
    const state: GameState = {
      ...base,
      elapsedMs: 100,
      board: {
        ...base.board,
        correctClicksSinceTargetChange: TARGET_CHANGE_AFTER_CORRECT_CLICKS,
        targetChangesAtMs: 999_999, // waktunya belum tiba
      },
    };

    const result = step(state, 16);
    expect(result.events.some((event) => event.type === 'targetChanged')).toBe(true);
    expect(result.state.board.correctClicksSinceTargetChange).toBe(0);
  });

  it('hanya memakai warna yang aktif di level saat itu', () => {
    const { events } = runFor(newRunningGame(31337), 120_000);
    const allowed: readonly Color[] = activeColors(1);
    for (const event of events) {
      if (event.type === 'targetChanged') {
        for (const color of event.colors) {
          expect(allowed).toContain(color);
        }
      }
    }
  });
});

describe('batas waktu multiplayer', () => {
  it('status menjadi finished saat waktu habis', () => {
    const state = startGame(
      createGameState({
        seed: 5,
        config: soloConfig({ timeLimitMs: 2000 }),
      }),
    );
    const result = runFor(state, 2500);
    expect(result.state.status).toBe('finished');
  });
});

describe('kemurnian fungsi', () => {
  it('step tidak mengubah state yang dikirim', () => {
    const state = newRunningGame();
    const snapshot: GameState = JSON.parse(JSON.stringify(state));
    step(state, 5000);
    expect(state).toEqual(snapshot);
  });
});
