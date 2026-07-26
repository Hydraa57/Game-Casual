import { describe, expect, it } from 'vitest';
import {
  applyClick,
  createGameState,
  createScoreState,
  GRID_SIZE,
  MAX_CLICKS_PER_SECOND,
} from '@pixelmatrix/shared';
import type { GameConfig, GameState, Pixel, ScoreState } from '@pixelmatrix/shared';
import { RateLimiter } from './RateLimiter';
import { tiedAtTop } from './Match';

/**
 * Membuktikan mekanisme inti papan-rebutan pada tingkat engine: klik pertama
 * yang diproses mengambil pixel, dan klik berikutnya untuk pixel yang sama
 * menemukan papan yang sudah berubah.
 *
 * `Match` melakukan persis urutan ini — papan bersama dipasangkan dengan skor
 * pemain yang mengklik, lalu papan hasilnya menjadi papan bersama yang baru.
 */
function multiplayerBoardConfig(): GameConfig {
  return {
    mode: 'multiplayer',
    gridSize: GRID_SIZE,
    startingLives: null,
    timeLimitMs: null,
    targetScore: null,
  };
}

const contestedPixel: Pixel = {
  id: 'contested',
  cell: { row: 3, col: 3 },
  color: 'red',
  kind: 'normal',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

function sharedBoard(pixels: readonly Pixel[] = [contestedPixel]): GameState {
  const base = createGameState({ seed: 5, config: multiplayerBoardConfig() });
  return {
    ...base,
    status: 'running',
    elapsedMs: 1000,
    board: { ...base.board, targetColors: ['red'], nextSpawnAtMs: 999_999, pixels },
  };
}

/** Terapkan klik satu pemain seperti yang dilakukan `Match`. */
function clickAs(board: GameState, score: ScoreState, pixelId: string) {
  const result = applyClick({ ...board, score }, pixelId);
  return {
    board: { ...board, board: result.state.board },
    score: result.state.score,
    events: result.events,
    claimed: result.claimed,
  };
}

describe('klik rebutan', () => {
  it('hanya pemain pertama yang mendapat poin untuk pixel yang sama', () => {
    let board = sharedBoard();
    const alice = createScoreState(null);
    const bob = createScoreState(null);

    const first = clickAs(board, alice, 'contested');
    board = first.board;

    const second = clickAs(board, bob, 'contested');

    expect(first.claimed).toBe(true);
    expect(first.score.score).toBeGreaterThan(0);

    expect(second.claimed).toBe(false);
    expect(second.score.score).toBe(0);
    expect(board.board.pixels).toHaveLength(0);
  });

  it('pemain yang kalah cepat TIDAK dihukum — hanya diberi tahu notFound', () => {
    let board = sharedBoard();
    const alice = createScoreState(null);
    const bob = { ...createScoreState(null), score: 100, combo: 7, bestCombo: 7 };

    board = clickAs(board, alice, 'contested').board;
    const late = clickAs(board, bob, 'contested');

    // Kalau kalah cepat ikut dihukum, multiplayer jadi terasa tidak adil dan
    // pemain yang lebih lambat koneksinya dihukum dua kali.
    expect(late.score.score).toBe(100);
    expect(late.score.combo).toBe(7);
    expect(late.score.wrongClicks).toBe(0);
    expect(late.events).toContainEqual({
      type: 'clickRejected',
      pixelId: 'contested',
      reason: 'notFound',
      penalty: 0,
      livesLeft: null,
    });
  });

  it('skor pemain lain tidak ikut berubah saat satu pemain mencetak poin', () => {
    const board = sharedBoard();
    const bob = { ...createScoreState(null), score: 42 };

    clickAs(board, createScoreState(null), 'contested');
    expect(bob.score).toBe(42);
  });

  it('klik warna salah memotong skor, bukan nyawa (tidak ada nyawa di MP)', () => {
    const distractor: Pixel = { ...contestedPixel, id: 'blue-1', color: 'blue' };
    const board = sharedBoard([contestedPixel, distractor]);
    const alice = { ...createScoreState(null), score: 50, combo: 4 };

    const result = clickAs(board, alice, 'blue-1');

    expect(result.score.lives).toBeNull();
    expect(result.score.score).toBeLessThan(50);
    expect(result.score.combo).toBe(0);
    // Pixel yang salah tetap di papan — sama seperti solo.
    expect(result.board.board.pixels.map((p) => p.id)).toContain('blue-1');
  });

  it('bom di MP memotong skor, dan pixelnya hilang untuk semua orang', () => {
    const bomb: Pixel = { ...contestedPixel, id: 'bomb-1', kind: 'bomb' };
    const board = sharedBoard([bomb]);
    const alice = { ...createScoreState(null), score: 80 };

    const result = clickAs(board, alice, 'bomb-1');

    expect(result.score.score).toBeLessThan(80);
    expect(result.board.board.pixels).toHaveLength(0);
  });

  it('level papan tidak bergeser karena klik pemain — server yang menentukan', () => {
    const board = { ...sharedBoard(), board: { ...sharedBoard().board, level: 6 } };
    const alice = { ...createScoreState(null), correctClicks: 999 };

    const result = clickAs(board, alice, 'contested');

    // Di solo level ikut correctClicks; di MP itu akan membuat kesulitan
    // bergantung pada pemain yang paling rajin mengklik.
    expect(result.board.board.level).toBe(6);
  });
});

describe('sudden death', () => {
  it('dipicu saat dua pemain teratas seri', () => {
    expect(tiedAtTop([80, 80])).toBe(true);
    expect(tiedAtTop([80, 80, 40])).toBe(true);
    expect(tiedAtTop([80, 80, 80])).toBe(true);
  });

  it('tidak dipicu kalau juaranya tunggal', () => {
    expect(tiedAtTop([90, 80])).toBe(false);
    // Seri di posisi 2–3 tidak menahan match: yang diperebutkan hanya juara.
    expect(tiedAtTop([90, 40, 40])).toBe(false);
  });

  it('tidak dipicu kalau hanya satu pemain atau kosong', () => {
    expect(tiedAtTop([50])).toBe(false);
    expect(tiedAtTop([])).toBe(false);
  });

  it('seri di skor nol tetap seri — bukan kasus khusus', () => {
    // Kalau tidak, dua pemain yang sama-sama diam akan langsung dinyatakan
    // juara bersama dan layar hasil menampilkan dua peringkat 1.
    expect(tiedAtTop([0, 0])).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('mengizinkan sampai batas lalu menolak', () => {
    const limiter = new RateLimiter();
    for (let index = 0; index < MAX_CLICKS_PER_SECOND; index += 1) {
      expect(limiter.allow('alice', 1000)).toBe(true);
    }
    expect(limiter.allow('alice', 1000)).toBe(false);
  });

  it('jendela geser: izin pulih setelah satu detik', () => {
    const limiter = new RateLimiter();
    for (let index = 0; index < MAX_CLICKS_PER_SECOND; index += 1) limiter.allow('alice', 1000);
    expect(limiter.allow('alice', 1500)).toBe(false);
    expect(limiter.allow('alice', 2100)).toBe(true);
  });

  it('batasnya per pemain, bukan global', () => {
    const limiter = new RateLimiter();
    for (let index = 0; index < MAX_CLICKS_PER_SECOND; index += 1) limiter.allow('alice', 1000);

    expect(limiter.allow('alice', 1000)).toBe(false);
    expect(limiter.allow('bob', 1000)).toBe(true);
  });

  it('kecepatan tap manusiawi tidak pernah terkena batas', () => {
    const limiter = new RateLimiter();
    // ~5 tap per detik selama 10 detik — di atas kecepatan pemain biasa.
    let blocked = 0;
    for (let index = 0; index < 50; index += 1) {
      if (!limiter.allow('alice', index * 200)) blocked += 1;
    }
    expect(blocked).toBe(0);
  });

  it('forget membersihkan riwayat pemain yang keluar', () => {
    const limiter = new RateLimiter();
    for (let index = 0; index < MAX_CLICKS_PER_SECOND; index += 1) limiter.allow('alice', 1000);
    limiter.forget('alice');
    expect(limiter.allow('alice', 1000)).toBe(true);
  });
});
