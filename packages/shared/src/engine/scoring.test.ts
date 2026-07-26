import { describe, expect, it } from 'vitest';
import { BASE_POINTS, MAX_SPEED_BONUS, WRONG_CLICK_PENALTY } from '../constants/index';
import type { Pixel } from '../types/index';
import {
  applyPenalty,
  comboMultiplier,
  pointsForClick,
  remainingRatio,
  speedBonus,
} from './scoring';

const pixel: Pixel = {
  id: 'p1',
  cell: { row: 0, col: 0 },
  color: 'red',
  spawnedAtMs: 1000,
  lifetimeMs: 2000,
};

describe('remainingRatio', () => {
  it('1 tepat saat spawn, 0 tepat saat pudar', () => {
    expect(remainingRatio(pixel, 1000)).toBe(1);
    expect(remainingRatio(pixel, 3000)).toBe(0);
  });

  it('setengah umur → 0.5', () => {
    expect(remainingRatio(pixel, 2000)).toBe(0.5);
  });

  it('dijepit ke 0..1 walau waktunya di luar rentang', () => {
    expect(remainingRatio(pixel, 500)).toBe(1);
    expect(remainingRatio(pixel, 99_999)).toBe(0);
  });
});

describe('speedBonus', () => {
  it('penuh saat baru muncul, nol saat mau pudar', () => {
    expect(speedBonus(1)).toBe(MAX_SPEED_BONUS);
    expect(speedBonus(0)).toBe(0);
  });

  it('nilai di luar 0..1 tetap dijepit', () => {
    expect(speedBonus(-5)).toBe(0);
    expect(speedBonus(5)).toBe(MAX_SPEED_BONUS);
  });
});

describe('comboMultiplier', () => {
  it('naik setiap 5 klik benar dan berhenti di ×2', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(9)).toBe(1.5);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(500)).toBe(2);
  });
});

describe('pointsForClick', () => {
  it('klik paling cepat tanpa combo = poin dasar + bonus maksimum', () => {
    expect(pointsForClick(1, 1)).toBe(BASE_POINTS + MAX_SPEED_BONUS);
  });

  it('klik paling mepet tanpa combo = poin dasar saja', () => {
    expect(pointsForClick(0, 1)).toBe(BASE_POINTS);
  });

  it('combo 5 langsung menikmati multiplier barunya', () => {
    // (10 + 10) × 1.5 = 30 — hadiahnya terasa di klik yang menyentuh kelipatan 5.
    expect(pointsForClick(1, 5)).toBe(30);
  });

  it('combo 10 memberi multiplier ×2', () => {
    expect(pointsForClick(1, 10)).toBe(40);
  });
});

describe('applyPenalty', () => {
  it('mengurangi skor sesuai penalti', () => {
    expect(applyPenalty(100)).toBe(100 - WRONG_CLICK_PENALTY);
  });

  it('skor tidak pernah negatif', () => {
    expect(applyPenalty(0)).toBe(0);
    expect(applyPenalty(2)).toBe(0);
  });
});
