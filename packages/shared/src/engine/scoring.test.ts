import { describe, expect, it } from 'vitest';
import {
  BASE_POINTS,
  MAX_CURVE_LEVEL,
  MAX_LEVEL_BONUS_MULTIPLIER,
  MAX_SPEED_BONUS,
  WRONG_CLICK_PENALTY,
} from '../constants/index';
import type { Pixel } from '../types/index';
import {
  applyPenalty,
  comboMultiplier,
  isComboMilestone,
  levelBonusMultiplier,
  pointsForClick,
  remainingRatio,
  speedBonus,
} from './scoring';

const pixel: Pixel = {
  id: 'p1',
  cell: { row: 0, col: 0 },
  color: 'red',
  kind: 'normal',
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

describe('isComboMilestone', () => {
  it('menandai kelipatan COMBO_STEP, bukan setiap klik benar', () => {
    expect(isComboMilestone(5)).toBe(true);
    expect(isComboMilestone(10)).toBe(true);
    expect(isComboMilestone(4)).toBe(false);
    expect(isComboMilestone(6)).toBe(false);
  });

  it('combo nol bukan milestone', () => {
    // Combo di-reset ke 0 setiap klik salah; kalau 0 dihitung milestone, popup
    // justru muncul saat pemain baru saja gagal.
    expect(isComboMilestone(0)).toBe(false);
  });

  it('milestone selaras dengan tangga multiplier', () => {
    // Popup pertama harus jatuh tepat saat multiplier benar-benar naik —
    // merayakan sesuatu yang tidak mengubah apa pun akan terasa kosong.
    expect(comboMultiplier(5)).toBeGreaterThan(comboMultiplier(4));
    expect(isComboMilestone(5)).toBe(true);
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

describe('levelBonusMultiplier', () => {
  it('×1 di level 1 dan ×2 tepat di level maksimum', () => {
    expect(levelBonusMultiplier(1)).toBe(1);
    expect(levelBonusMultiplier(MAX_CURVE_LEVEL)).toBe(MAX_LEVEL_BONUS_MULTIPLIER);
  });

  it('naik terus di antara keduanya', () => {
    for (let level = 2; level <= MAX_CURVE_LEVEL; level += 1) {
      expect(levelBonusMultiplier(level)).toBeGreaterThan(levelBonusMultiplier(level - 1));
    }
  });

  it('berhenti di ×2 setelah level maksimum', () => {
    expect(levelBonusMultiplier(MAX_CURVE_LEVEL + 40)).toBe(MAX_LEVEL_BONUS_MULTIPLIER);
  });
});

describe('pointsForClick', () => {
  it('klik paling cepat tanpa combo di level 1 = poin dasar + bonus maksimum', () => {
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

  it('level default 1 supaya pemanggil lama tidak berubah perilakunya', () => {
    expect(pointsForClick(1, 1)).toBe(pointsForClick(1, 1, 1));
  });

  it('klik yang sama dibayar lebih mahal di level tinggi', () => {
    expect(pointsForClick(1, 1, MAX_CURVE_LEVEL)).toBeGreaterThan(pointsForClick(1, 1, 1));
  });

  it('poin maksimum per klik = (10+10) × combo ×2 × level ×2 = 80', () => {
    expect(pointsForClick(1, 10, MAX_CURVE_LEVEL)).toBe(80);
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
