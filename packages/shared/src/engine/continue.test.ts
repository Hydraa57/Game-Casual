import { describe, expect, it } from 'vitest';
import { CHECKPOINT_EVERY_LEVELS, CLICKS_PER_LEVEL, MAX_CONTINUES } from '../constants/index';
import type { Pixel } from '../types/index';
import { applyClick } from './click';
import {
  canContinue,
  continueFromCheckpoint,
  createGameState,
  isCheckpointLevel,
  multiplayerConfig,
  soloConfig,
  startGame,
  supportsContinues,
} from './state';
import type { GameState } from './state';

const targetPixel: Pixel = {
  id: 'target-1',
  cell: { row: 2, col: 3 },
  color: 'red',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

const distractorPixel: Pixel = {
  id: 'distractor-1',
  cell: { row: 4, col: 5 },
  color: 'blue',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

function soloGame(overrides: Partial<GameState> = {}): GameState {
  const base = startGame(createGameState({ seed: 7 }));
  return {
    ...base,
    elapsedMs: 1000,
    board: {
      ...base.board,
      targetColor: 'red',
      nextSpawnAtMs: 999_999,
      pixels: [targetPixel, distractorPixel],
    },
    ...overrides,
  };
}

/** State satu klik benar sebelum naik ke `level`. */
function aboutToReachLevel(level: number): GameState {
  const base = soloGame();
  const clicksNeeded = (level - 1) * CLICKS_PER_LEVEL;
  return {
    ...base,
    board: { ...base.board, level: level - 1 },
    score: { ...base.score, correctClicks: clicksNeeded - 1, score: 500 },
  };
}

describe('isCheckpointLevel', () => {
  it('hanya kelipatan CHECKPOINT_EVERY_LEVELS, dan bukan level 0', () => {
    expect(isCheckpointLevel(1)).toBe(false);
    expect(isCheckpointLevel(4)).toBe(false);
    expect(isCheckpointLevel(CHECKPOINT_EVERY_LEVELS)).toBe(true);
    expect(isCheckpointLevel(CHECKPOINT_EVERY_LEVELS * 2)).toBe(true);
    expect(isCheckpointLevel(CHECKPOINT_EVERY_LEVELS * 3 - 1)).toBe(false);
    expect(isCheckpointLevel(0)).toBe(false);
  });
});

describe('merekam checkpoint', () => {
  it('belum ada checkpoint saat ronde dimulai', () => {
    const state = soloGame();
    expect(state.checkpoint).toBeNull();
    expect(state.continuesLeft).toBe(MAX_CONTINUES);
  });

  it('tercatat tepat saat menyentuh level 5, dengan skor saat itu', () => {
    const result = applyClick(aboutToReachLevel(CHECKPOINT_EVERY_LEVELS), 'target-1');

    expect(result.state.checkpoint).not.toBeNull();
    expect(result.state.checkpoint?.level).toBe(CHECKPOINT_EVERY_LEVELS);
    expect(result.state.checkpoint?.score).toBe(result.state.score.score);
    expect(result.state.checkpoint?.correctClicks).toBe(result.state.score.correctClicks);
    expect(result.events).toContainEqual({
      type: 'checkpointReached',
      level: CHECKPOINT_EVERY_LEVELS,
      score: result.state.score.score,
    });
  });

  it('tidak tercatat di level yang bukan kelipatan 5', () => {
    const result = applyClick(aboutToReachLevel(4), 'target-1');
    expect(result.state.checkpoint).toBeNull();
    expect(result.events.some((event) => event.type === 'checkpointReached')).toBe(false);
  });

  it('checkpoint yang lebih tinggi menggantikan yang lama', () => {
    const first = applyClick(aboutToReachLevel(CHECKPOINT_EVERY_LEVELS), 'target-1').state;
    const second = applyClick(
      {
        ...aboutToReachLevel(CHECKPOINT_EVERY_LEVELS * 2),
        checkpoint: first.checkpoint,
      },
      'target-1',
    ).state;

    expect(second.checkpoint?.level).toBe(CHECKPOINT_EVERY_LEVELS * 2);
  });

  it('tidak pernah dicatat di multiplayer', () => {
    const base = startGame(createGameState({ seed: 7, config: multiplayerConfig(150, 120) }));
    const state: GameState = {
      ...base,
      elapsedMs: 1000,
      board: {
        ...base.board,
        level: CHECKPOINT_EVERY_LEVELS - 1,
        targetColor: 'red',
        nextSpawnAtMs: 999_999,
        pixels: [targetPixel],
      },
      score: { ...base.score, correctClicks: CHECKPOINT_EVERY_LEVELS * CLICKS_PER_LEVEL - 1 },
    };

    const result = applyClick(state, 'target-1');
    expect(result.state.checkpoint).toBeNull();
    expect(supportsContinues(state.config)).toBe(false);
    expect(state.continuesLeft).toBe(0);
  });
});

describe('continueFromCheckpoint', () => {
  /** Mati di level 7 setelah menyentuh checkpoint level 5. */
  function diedAfterCheckpoint(): GameState {
    const base = soloGame();
    return {
      ...base,
      status: 'gameOver',
      board: { ...base.board, level: 7 },
      checkpoint: { level: 5, score: 400, correctClicks: 60 },
      score: {
        ...base.score,
        score: 950,
        correctClicks: 95,
        wrongClicks: 4,
        bestCombo: 11,
        combo: 0,
        lives: 0,
      },
    };
  }

  it('menawarkan continue hanya saat game over, ada checkpoint, dan sisa continue', () => {
    const died = diedAfterCheckpoint();
    expect(canContinue(died)).toBe(true);

    expect(canContinue({ ...died, status: 'running' })).toBe(false);
    expect(canContinue({ ...died, checkpoint: null })).toBe(false);
    expect(canContinue({ ...died, continuesLeft: 0 })).toBe(false);
  });

  it('memulihkan skor dan progres level checkpoint — bukan skor saat mati, bukan nol', () => {
    const resumed = continueFromCheckpoint(diedAfterCheckpoint());

    expect(resumed.status).toBe('running');
    expect(resumed.score.score).toBe(400);
    expect(resumed.score.correctClicks).toBe(60);
    expect(resumed.board.level).toBe(5);
  });

  it('mengembalikan nyawa penuh dan mengosongkan papan', () => {
    const resumed = continueFromCheckpoint(diedAfterCheckpoint());
    expect(resumed.score.lives).toBe(soloConfig().startingLives);
    expect(resumed.board.pixels).toHaveLength(0);
    expect(resumed.score.combo).toBe(0);
  });

  it('mempertahankan statistik seluruh ronde (bestCombo & klik salah)', () => {
    const resumed = continueFromCheckpoint(diedAfterCheckpoint());
    expect(resumed.score.bestCombo).toBe(11);
    expect(resumed.score.wrongClicks).toBe(4);
  });

  it('mengurangi sisa continue, dan menolak setelah habis', () => {
    let state = continueFromCheckpoint(diedAfterCheckpoint());
    expect(state.continuesLeft).toBe(MAX_CONTINUES - 1);

    state = continueFromCheckpoint({ ...state, status: 'gameOver' });
    expect(state.continuesLeft).toBe(0);

    // Continue ketiga tidak boleh terjadi.
    const exhausted = { ...state, status: 'gameOver' as const };
    expect(canContinue(exhausted)).toBe(false);
    expect(continueFromCheckpoint(exhausted)).toBe(exhausted);
  });

  it('checkpoint tetap tersimpan supaya continue kedua kembali ke titik yang sama', () => {
    const resumed = continueFromCheckpoint(diedAfterCheckpoint());
    expect(resumed.checkpoint).toEqual({ level: 5, score: 400, correctClicks: 60 });
  });

  it('ronde baru lewat startGame mengembalikan continue ke jumlah penuh', () => {
    const afterContinue = continueFromCheckpoint(diedAfterCheckpoint());
    const brandNew = startGame({ ...afterContinue, status: 'gameOver' });
    expect(brandNew.continuesLeft).toBe(MAX_CONTINUES);
    expect(brandNew.checkpoint).toBeNull();
    expect(brandNew.score.score).toBe(0);
  });
});
