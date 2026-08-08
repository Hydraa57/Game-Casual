import { describe, expect, it } from 'vitest';
import {
  BIG_GRID_SIZE,
  GRID_SIZE,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '../constants/index';
import { createGameState, multiplayerConfig } from './state';
import { step } from './step';
import { gridSizeFor, spawnCrowdFactor } from './crowd';

describe('gridSizeFor', () => {
  it('memakai papan baku untuk match kecil', () => {
    for (const players of [1, 2, 3, 4]) {
      expect(gridSizeFor(players)).toBe(GRID_SIZE);
    }
  });

  it('memakai papan besar mulai 5 pemain', () => {
    for (const players of [5, 6, 7, 8]) {
      expect(gridSizeFor(players)).toBe(BIG_GRID_SIZE);
    }
  });

  it('tidak pernah mengecil saat pemain bertambah', () => {
    for (let players = MIN_PLAYERS_TO_START; players < MAX_PLAYERS_LIMIT; players += 1) {
      expect(gridSizeFor(players + 1)).toBeGreaterThanOrEqual(gridSizeFor(players));
    }
  });
});

describe('spawnCrowdFactor', () => {
  /**
   * Penjaga paling penting di berkas ini.
   *
   * Fitur tim menaikkan batas pemain, dan godaan paling wajar adalah menulis
   * `playerCount / 4` begitu saja. Itu akan MEMPERLAMBAT match 2 pemain menjadi
   * setengah pasokan sekarang — memperburuk mode yang tidak ada keluhannya sama
   * sekali demi mode yang baru. Tes ini yang menahannya.
   */
  it('tidak pernah mengubah match yang sudah ada (≤ 4 pemain)', () => {
    for (const players of [1, 2, 3, 4]) {
      expect(spawnCrowdFactor(players)).toBe(1);
    }
  });

  it('menjaga pasokan per pemain tetap sama untuk match ramai', () => {
    // Patokannya 4 pemain. 8 pemain harus mendapat dua kali lipat pixel, jadi
    // jatah per orangnya identik.
    const patokan = 4 / spawnCrowdFactor(4);
    for (const players of [6, 8]) {
      expect(players / spawnCrowdFactor(players)).toBeCloseTo(patokan, 10);
    }
  });

  it('naik seiring jumlah pemain', () => {
    expect(spawnCrowdFactor(6)).toBeGreaterThan(spawnCrowdFactor(4));
    expect(spawnCrowdFactor(8)).toBeGreaterThan(spawnCrowdFactor(6));
  });
});

/**
 * Kenapa papan besar TIDAK cukup sendirian.
 *
 * Ini temuan yang mendorong seluruh `crowd.ts` ada, dan ia sangat mudah hilang:
 * "papan lebih besar untuk pemain lebih banyak" terdengar seperti sudah
 * menyelesaikan masalah kepadatan, padahal tidak menyentuhnya sama sekali.
 * Kalau suatu saat ada yang menghapus `spawnCrowdFactor` karena mengira papan
 * besarnya sudah cukup, tes pertama di bawah ini yang gagal.
 */
describe('kepadatan pixel', () => {
  const TICK = 50;
  const DURASI = 60_000;

  function rataPixelHidup(gridSize: number, crowdFactor: number): number {
    let state = createGameState({
      seed: 12345,
      config: multiplayerConfig(1000, DURASI / 1000, {
        gridSize,
        spawnCrowdFactor: crowdFactor,
      }),
    });
    state = { ...state, status: 'running' };

    let total = 0;
    let sampel = 0;
    for (let t = 0; t < DURASI; t += TICK) {
      state = step(state, TICK).state;
      total += state.board.pixels.length;
      sampel += 1;
    }
    return total / sampel;
  }

  it('TIDAK berubah karena papan diperbesar', () => {
    const kecil = rataPixelHidup(GRID_SIZE, 1);
    const besar = rataPixelHidup(BIG_GRID_SIZE, 1);
    // Papan tiga kali lebih luas pun tidak menambah satu pixel: jumlahnya
    // ditentukan umur dibagi jeda spawn, dan sel kosong tidak pernah jadi
    // penghambat.
    expect(besar).toBeCloseTo(kecil, 1);
  });

  it('berubah karena faktor keramaian — dan kira-kira sebanding dengannya', () => {
    const satu = rataPixelHidup(BIG_GRID_SIZE, 1);
    const dua = rataPixelHidup(BIG_GRID_SIZE, 2);
    expect(dua).toBeGreaterThan(satu * 1.7);
    expect(dua).toBeLessThan(satu * 2.3);
  });
});
