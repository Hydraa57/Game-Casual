import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS,
  CLICKS_PER_LEVEL,
  MAX_SPEED_BONUS,
  WRONG_CLICK_PENALTY,
} from '../constants/index';
import type { Pixel } from '../types/index';
import { applyClick } from './click';
import { createGameState, pauseGame, soloConfig, startGame } from './state';
import type { GameState } from './state';

const targetPixel: Pixel = {
  id: 'target-1',
  cell: { row: 2, col: 3 },
  color: 'red',
  kind: 'normal',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

const distractorPixel: Pixel = {
  id: 'distractor-1',
  cell: { row: 4, col: 5 },
  color: 'blue',
  kind: 'normal',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

/** State terkendali: papan berisi satu pixel target + satu distraktor, target = merah. */
function gameWithBoard(overrides: Partial<GameState> = {}): GameState {
  const base = startGame(createGameState({ seed: 7 }));
  return {
    ...base,
    elapsedMs: 1000,
    board: {
      ...base.board,
      targetColors: ['red'],
      nextSpawnAtMs: 999_999,
      pixels: [targetPixel, distractorPixel],
    },
    ...overrides,
  };
}

describe('klik benar', () => {
  it('memberi poin, menaikkan combo, dan menghapus pixel dari papan', () => {
    const result = applyClick(gameWithBoard(), 'target-1');

    expect(result.claimed).toBe(true);
    expect(result.state.score.score).toBe(BASE_POINTS + MAX_SPEED_BONUS);
    expect(result.state.score.combo).toBe(1);
    expect(result.state.score.correctClicks).toBe(1);
    expect(result.state.board.pixels.map((pixel) => pixel.id)).toEqual(['distractor-1']);
  });

  it('poin lebih kecil kalau diklik mepet mau pudar', () => {
    const early = applyClick(gameWithBoard({ elapsedMs: 1000 }), 'target-1');
    const late = applyClick(gameWithBoard({ elapsedMs: 2900 }), 'target-1');
    expect(late.state.score.score).toBeLessThan(early.state.score.score);
  });

  it('mencatat pixelClaimed dengan poin, combo, dan multiplier', () => {
    const result = applyClick(gameWithBoard(), 'target-1');
    expect(result.events).toContainEqual({
      type: 'pixelClaimed',
      pixelId: 'target-1',
      cell: targetPixel.cell,
      points: BASE_POINTS + MAX_SPEED_BONUS,
      combo: 1,
      multiplier: 1,
      score: BASE_POINTS + MAX_SPEED_BONUS,
      // Jenis pixelnya ikut supaya multiplayer bisa memilih bunyinya: tanpa
      // ini, mengambil ♥ atau ★ di MP tidak terdengar berbeda dari pixel biasa.
      kind: 'normal',
    });
  });

  it('bestCombo tersimpan walau combo kemudian putus', () => {
    let state = gameWithBoard({
      score: { ...gameWithBoard().score, combo: 6, bestCombo: 6 },
    });
    state = applyClick(state, 'target-1').state;
    expect(state.score.combo).toBe(7);
    expect(state.score.bestCombo).toBe(7);

    state = applyClick(state, 'distractor-1').state;
    expect(state.score.combo).toBe(0);
    expect(state.score.bestCombo).toBe(7);
  });

  it('menaikkan penghitung klik untuk pergantian warna target', () => {
    const result = applyClick(gameWithBoard(), 'target-1');
    expect(result.state.board.correctClicksSinceTargetChange).toBe(1);
  });

  it('memancarkan levelUp tepat saat ambang level tercapai', () => {
    const base = gameWithBoard();
    const state: GameState = {
      ...base,
      score: { ...base.score, correctClicks: CLICKS_PER_LEVEL - 1 },
    };
    const result = applyClick(state, 'target-1');
    expect(result.events).toContainEqual({ type: 'levelUp', level: 2 });
  });
});

describe('klik salah warna', () => {
  it('mengurangi skor, memutus combo, dan mengurangi nyawa', () => {
    const base = gameWithBoard();
    const state: GameState = {
      ...base,
      score: { ...base.score, score: 100, combo: 8 },
    };

    const result = applyClick(state, 'distractor-1');

    expect(result.claimed).toBe(false);
    expect(result.state.score.score).toBe(100 - WRONG_CLICK_PENALTY);
    expect(result.state.score.combo).toBe(0);
    expect(result.state.score.wrongClicks).toBe(1);
    expect(result.state.score.lives).toBe(2);
  });

  it('pixel yang salah TETAP di papan — klik ngawur tidak boleh jadi cara membersihkan distraktor', () => {
    const result = applyClick(gameWithBoard(), 'distractor-1');
    expect(result.state.board.pixels.map((pixel) => pixel.id)).toContain('distractor-1');
  });

  it('skor tidak pernah negatif', () => {
    const base = gameWithBoard();
    const result = applyClick({ ...base, score: { ...base.score, score: 2 } }, 'distractor-1');
    expect(result.state.score.score).toBe(0);
  });

  it('nyawa habis → game over', () => {
    const base = gameWithBoard();
    let state: GameState = { ...base, score: { ...base.score, lives: 1 } };
    const result = applyClick(state, 'distractor-1');

    expect(result.state.status).toBe('gameOver');
    expect(result.state.score.lives).toBe(0);
    expect(result.events.some((event) => event.type === 'gameOver')).toBe(true);

    // Setelah game over, klik berikutnya tidak berpengaruh.
    state = result.state;
    const after = applyClick(state, 'target-1');
    expect(after.state).toBe(state);
  });

  it('tanpa sistem nyawa (multiplayer) hanya skor yang berkurang', () => {
    const base = startGame(
      createGameState({ seed: 7, config: soloConfig({ startingLives: null }) }),
    );
    const state: GameState = {
      ...base,
      elapsedMs: 1000,
      score: { ...base.score, score: 50 },
      board: {
        ...base.board,
        targetColors: ['red'],
        nextSpawnAtMs: 999_999,
        pixels: [distractorPixel],
      },
    };

    const result = applyClick(state, 'distractor-1');
    expect(result.state.score.lives).toBeNull();
    expect(result.state.status).toBe('running');
    expect(result.state.score.score).toBe(50 - WRONG_CLICK_PENALTY);
  });
});

describe('klik yang ditolak tanpa penalti', () => {
  it('pixel tidak ada (tap ganda / sudah diklaim orang lain) tidak dihukum', () => {
    const state = gameWithBoard();
    const result = applyClick(state, 'tidak-ada');

    expect(result.claimed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.events).toContainEqual({
      type: 'clickRejected',
      pixelId: 'tidak-ada',
      reason: 'notFound',
      penalty: 0,
      livesLeft: 3,
    });
  });

  it('pixel yang sudah lewat umurnya ditolak sebagai tooLate tanpa penalti', () => {
    const result = applyClick(gameWithBoard({ elapsedMs: 5000 }), 'target-1');
    expect(result.state.score.score).toBe(0);
    expect(result.state.score.lives).toBe(3);
    expect(result.events).toContainEqual({
      type: 'clickRejected',
      pixelId: 'target-1',
      reason: 'tooLate',
      penalty: 0,
      livesLeft: 3,
    });
  });

  it('klik saat pause diabaikan', () => {
    const paused = pauseGame(gameWithBoard());
    const result = applyClick(paused, 'target-1');
    expect(result.state).toBe(paused);
    expect(result.events[0]).toMatchObject({ reason: 'notRunning' });
  });
});

describe('target skor multiplayer', () => {
  it('status menjadi finished saat target skor tercapai', () => {
    const base = startGame(
      createGameState({ seed: 7, config: soloConfig({ startingLives: null, targetScore: 15 }) }),
    );
    const state: GameState = {
      ...base,
      elapsedMs: 1000,
      board: {
        ...base.board,
        targetColors: ['red'],
        nextSpawnAtMs: 999_999,
        pixels: [targetPixel],
      },
    };

    const result = applyClick(state, 'target-1');
    expect(result.state.score.score).toBeGreaterThanOrEqual(15);
    expect(result.state.status).toBe('finished');
    expect(result.events.some((event) => event.type === 'targetScoreReached')).toBe(true);
  });
});

describe('kemurnian fungsi', () => {
  it('applyClick tidak mengubah state yang dikirim', () => {
    const state = gameWithBoard();
    const snapshot: GameState = JSON.parse(JSON.stringify(state));
    applyClick(state, 'target-1');
    applyClick(state, 'distractor-1');
    expect(state).toEqual(snapshot);
  });
});
