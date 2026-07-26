import { describe, expect, it } from 'vitest';
import {
  BOMB_FIRST_LEVEL,
  BOMB_MAX_CHANCE,
  BOMB_MIN_CHANCE,
  BOMB_SCORE_PENALTY,
  GOLD_FIRST_LEVEL,
  GOLD_POINT_MULTIPLIER,
  LIFE_FIRST_LEVEL,
  MAX_CURVE_LEVEL,
  MAX_LIVES,
} from '../constants/index';
import type { Pixel, PixelKind } from '../types/index';
import { applyClick } from './click';
import type { GameEvent } from './events';
import { createGameState, multiplayerConfig, soloConfig, startGame } from './state';
import type { GameState } from './state';
import { bombChance, step } from './step';

function pixel(kind: PixelKind, overrides: Partial<Pixel> = {}): Pixel {
  return {
    id: `${kind}-1`,
    cell: { row: 1, col: 1 },
    // Sengaja BUKAN warna target, untuk membuktikan pixel spesial tidak peduli warna.
    color: 'blue',
    kind,
    spawnedAtMs: 1000,
    lifetimeMs: 2000,
    ...overrides,
  };
}

function gameWith(pixels: readonly Pixel[], overrides: Partial<GameState> = {}): GameState {
  const base = startGame(createGameState({ seed: 11 }));
  return {
    ...base,
    elapsedMs: 1000,
    board: { ...base.board, targetColors: ['red'], nextSpawnAtMs: 999_999, pixels },
    ...overrides,
  };
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

describe('bombChance', () => {
  it('nol sebelum level bom pertama', () => {
    expect(bombChance(BOMB_FIRST_LEVEL - 1)).toBe(0);
    expect(bombChance(1)).toBe(0);
  });

  it('mulai dari peluang minimum lalu naik ke maksimum di ujung kurva', () => {
    expect(bombChance(BOMB_FIRST_LEVEL)).toBeCloseTo(BOMB_MIN_CHANCE, 5);
    expect(bombChance(MAX_CURVE_LEVEL)).toBeCloseTo(BOMB_MAX_CHANCE, 5);
    expect(bombChance(MAX_CURVE_LEVEL + 20)).toBeCloseTo(BOMB_MAX_CHANCE, 5);
  });

  it('menaik di antara keduanya', () => {
    for (let level = BOMB_FIRST_LEVEL + 1; level <= MAX_CURVE_LEVEL; level += 1) {
      expect(bombChance(level)).toBeGreaterThan(bombChance(level - 1));
    }
  });
});

describe('pixel bom ☠', () => {
  it('mengurangi nyawa dan memutus combo saat di-tap', () => {
    const state = gameWith([pixel('bomb')], {
      score: {
        ...gameWith([]).score,
        score: 200,
        combo: 9,
        bestCombo: 9,
      },
    });

    const result = applyClick(state, 'bomb-1');

    expect(result.claimed).toBe(false);
    expect(result.state.score.lives).toBe(2);
    expect(result.state.score.combo).toBe(0);
    expect(result.state.score.bestCombo).toBe(9);
    expect(result.events).toContainEqual({
      type: 'bombHit',
      pixelId: 'bomb-1',
      livesLeft: 2,
      scorePenalty: 0,
    });
  });

  it('skor tidak dipotong di mode bernyawa — nyawa sudah cukup jadi hukumannya', () => {
    const state = gameWith([pixel('bomb')], {
      score: { ...gameWith([]).score, score: 200 },
    });
    expect(applyClick(state, 'bomb-1').state.score.score).toBe(200);
  });

  it('bom yang meledak hilang dari papan (tidak bisa ditap dua kali)', () => {
    const result = applyClick(gameWith([pixel('bomb')]), 'bomb-1');
    expect(result.state.board.pixels).toHaveLength(0);
  });

  it('menghabisi nyawa terakhir → game over', () => {
    const state = gameWith([pixel('bomb')], {
      score: { ...gameWith([]).score, lives: 1 },
    });
    const result = applyClick(state, 'bomb-1');
    expect(result.state.status).toBe('gameOver');
    expect(result.events.some((event) => event.type === 'gameOver')).toBe(true);
  });

  it('di mode tanpa nyawa (multiplayer) yang dipotong adalah skor', () => {
    const base = startGame(createGameState({ seed: 11, config: multiplayerConfig(150, 120) }));
    const state: GameState = {
      ...base,
      elapsedMs: 1000,
      score: { ...base.score, score: 100 },
      board: {
        ...base.board,
        targetColors: ['red'],
        nextSpawnAtMs: 999_999,
        pixels: [pixel('bomb')],
      },
    };

    const result = applyClick(state, 'bomb-1');
    expect(result.state.score.lives).toBeNull();
    expect(result.state.score.score).toBe(100 - BOMB_SCORE_PENALTY);
    expect(result.state.status).toBe('running');
  });

  it('dibiarkan pudar tidak menghukum apa pun dan tidak memutus combo', () => {
    const state = gameWith([pixel('bomb', { spawnedAtMs: 900, lifetimeMs: 200 })], {
      score: { ...gameWith([]).score, combo: 6, lives: 3 },
    });

    const result = step(state, 500);
    expect(result.state.score.lives).toBe(3);
    expect(result.state.score.combo).toBe(6);
    expect(result.events).toContainEqual({
      type: 'pixelExpired',
      pixelId: 'bomb-1',
      wasTarget: false,
    });
    expect(result.events.some((event) => event.type === 'comboBroken')).toBe(false);
  });
});

describe('pixel emas ★', () => {
  it('memberi poin berkali-kali lipat walau warnanya bukan warna target', () => {
    const gold = applyClick(gameWith([pixel('gold')]), 'gold-1');
    const normalTarget = applyClick(
      gameWith([pixel('normal', { id: 'gold-1', color: 'red' })]),
      'gold-1',
    );

    expect(gold.claimed).toBe(true);
    expect(gold.state.score.score).toBe(normalTarget.state.score.score * GOLD_POINT_MULTIPLIER);
  });

  it('menaikkan combo seperti klik benar biasa', () => {
    const result = applyClick(gameWith([pixel('gold')]), 'gold-1');
    expect(result.state.score.combo).toBe(1);
    expect(result.state.score.correctClicks).toBe(1);
  });

  it('tidak mengubah nyawa', () => {
    const result = applyClick(gameWith([pixel('gold')]), 'gold-1');
    expect(result.state.score.lives).toBe(3);
  });

  it('dibiarkan pudar tidak memutus combo', () => {
    const state = gameWith([pixel('gold', { spawnedAtMs: 900, lifetimeMs: 200 })], {
      score: { ...gameWith([]).score, combo: 4 },
    });
    expect(step(state, 500).state.score.combo).toBe(4);
  });
});

describe('pixel nyawa ♥', () => {
  it('menambah satu nyawa', () => {
    const state = gameWith([pixel('life')], { score: { ...gameWith([]).score, lives: 2 } });
    const result = applyClick(state, 'life-1');

    expect(result.state.score.lives).toBe(3);
    expect(result.events).toContainEqual({ type: 'lifeGained', pixelId: 'life-1', lives: 3 });
  });

  it('tidak pernah melewati MAX_LIVES', () => {
    const state = gameWith([pixel('life')], {
      score: { ...gameWith([]).score, lives: MAX_LIVES },
    });
    const result = applyClick(state, 'life-1');

    expect(result.state.score.lives).toBe(MAX_LIVES);
    expect(result.events.some((event) => event.type === 'lifeGained')).toBe(false);
  });

  it('tetap memberi poin dan combo', () => {
    const result = applyClick(gameWith([pixel('life')]), 'life-1');
    expect(result.state.score.score).toBeGreaterThan(0);
    expect(result.state.score.combo).toBe(1);
  });
});

describe('peluang spawn per level', () => {
  interface Tally {
    normal: number;
    bomb: number;
    gold: number;
    life: number;
    total: number;
  }

  /** Kumpulkan jenis pixel yang muncul selama permainan panjang di level tetap. */
  function kindTally(level: number, config = soloConfig(), ms = 400_000): Tally {
    const base = startGame(createGameState({ seed: 4242, config }));
    const state: GameState = { ...base, board: { ...base.board, level } };
    const { events } = runFor(state, ms);

    const tally: Tally = { normal: 0, bomb: 0, gold: 0, life: 0, total: 0 };
    for (const event of events) {
      if (event.type === 'pixelSpawned') {
        tally[event.pixel.kind] += 1;
        tally.total += 1;
      }
    }
    return tally;
  }

  it('tidak ada pixel spesial di level 1', () => {
    const tally = kindTally(1);
    expect(tally.total).toBeGreaterThan(200);
    expect(tally.bomb).toBe(0);
    expect(tally.gold).toBe(0);
    expect(tally.life).toBe(0);
  });

  it('emas mulai muncul dari level GOLD_FIRST_LEVEL', () => {
    expect(kindTally(GOLD_FIRST_LEVEL - 1).gold).toBe(0);
    expect(kindTally(GOLD_FIRST_LEVEL).gold).toBeGreaterThan(0);
  });

  it('bom mulai muncul dari level BOMB_FIRST_LEVEL', () => {
    expect(kindTally(BOMB_FIRST_LEVEL - 1).bomb).toBe(0);
    expect(kindTally(BOMB_FIRST_LEVEL).bomb).toBeGreaterThan(0);
  });

  it('nyawa mulai muncul dari level LIFE_FIRST_LEVEL', () => {
    expect(kindTally(LIFE_FIRST_LEVEL - 1).life).toBe(0);
    expect(kindTally(LIFE_FIRST_LEVEL).life).toBeGreaterThan(0);
  });

  it('bom di level maksimum sekitar BOMB_MAX_CHANCE dari seluruh spawn', () => {
    const tally = kindTally(MAX_CURVE_LEVEL);
    const share = tally.bomb / tally.total;
    expect(share).toBeGreaterThan(BOMB_MAX_CHANCE * 0.6);
    expect(share).toBeLessThan(BOMB_MAX_CHANCE * 1.6);
  });

  it('pixel biasa tetap mayoritas besar di level maksimum', () => {
    const tally = kindTally(MAX_CURVE_LEVEL);
    expect(tally.normal / tally.total).toBeGreaterThan(0.7);
  });

  it('pixel nyawa tidak pernah muncul di multiplayer', () => {
    const tally = kindTally(MAX_CURVE_LEVEL, multiplayerConfig(150, 600));
    expect(tally.life).toBe(0);
    expect(tally.bomb).toBeGreaterThan(0);
  });

  it('pixel nyawa tidak muncul saat nyawa sudah penuh', () => {
    const base = startGame(createGameState({ seed: 4242 }));
    const state: GameState = {
      ...base,
      board: { ...base.board, level: MAX_CURVE_LEVEL },
      score: { ...base.score, lives: MAX_LIVES },
    };
    const { events } = runFor(state, 400_000);
    const lifeSpawns = events.filter(
      (event) => event.type === 'pixelSpawned' && event.pixel.kind === 'life',
    );
    expect(lifeSpawns).toHaveLength(0);
  });
});

describe('umur pixel spesial', () => {
  it('emas dan nyawa hidup lebih singkat daripada pixel biasa', () => {
    const base = startGame(createGameState({ seed: 4242 }));
    const state: GameState = { ...base, board: { ...base.board, level: MAX_CURVE_LEVEL } };
    const { events } = runFor(state, 400_000);

    const byKind: Record<PixelKind, number[]> = { normal: [], gold: [], life: [], bomb: [] };
    for (const event of events) {
      if (event.type === 'pixelSpawned') byKind[event.pixel.kind].push(event.pixel.lifetimeMs);
    }

    const normal = byKind.normal[0];
    expect(normal).toBeDefined();
    expect(byKind.gold[0]).toBeLessThan(normal!);
    expect(byKind.life[0]).toBeLessThan(normal!);
    // Bom memakai umur normal — pemain butuh waktu cukup untuk MENGHINDARINYA.
    expect(byKind.bomb[0]).toBe(normal);
  });
});
