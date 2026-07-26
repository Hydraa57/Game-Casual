import { describe, expect, it } from 'vitest';
import {
  ALL_COLORS,
  CLICKS_PER_LEVEL,
  INITIAL_ACTIVE_COLORS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  MAX_CURVE_LEVEL,
  MIN_LIFETIME_MS,
  MIN_SPAWN_INTERVAL_MS,
} from '../constants/index';
import {
  activeColorCount,
  activeColors,
  curveProgress,
  expectedPixelsAlive,
  isMaxCurveLevel,
  levelFor,
  lifetimeMs,
  spawnIntervalMs,
} from './difficulty';

describe('levelFor', () => {
  it('mulai dari level 1', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(CLICKS_PER_LEVEL - 1)).toBe(1);
  });

  it('naik satu level setiap CLICKS_PER_LEVEL klik benar', () => {
    expect(levelFor(CLICKS_PER_LEVEL)).toBe(2);
    expect(levelFor(CLICKS_PER_LEVEL * 3)).toBe(4);
  });
});

describe('curveProgress', () => {
  it('0 di level 1 dan 1 tepat di MAX_CURVE_LEVEL', () => {
    expect(curveProgress(1)).toBe(0);
    expect(curveProgress(MAX_CURVE_LEVEL)).toBe(1);
  });

  it('dijepit di atas level maksimum', () => {
    expect(curveProgress(MAX_CURVE_LEVEL + 50)).toBe(1);
    expect(curveProgress(0)).toBe(0);
  });

  it('isMaxCurveLevel menandai ujung kurva', () => {
    expect(isMaxCurveLevel(MAX_CURVE_LEVEL - 1)).toBe(false);
    expect(isMaxCurveLevel(MAX_CURVE_LEVEL)).toBe(true);
  });
});

describe('spawnIntervalMs', () => {
  it('endpoint kurva eksak di Lv 1 dan Lv MAX', () => {
    expect(spawnIntervalMs(1)).toBe(INITIAL_SPAWN_INTERVAL_MS);
    expect(spawnIntervalMs(MAX_CURVE_LEVEL)).toBe(MIN_SPAWN_INTERVAL_MS);
  });

  it('menurun terus sampai ujung kurva', () => {
    for (let level = 2; level <= MAX_CURVE_LEVEL; level += 1) {
      expect(spawnIntervalMs(level)).toBeLessThan(spawnIntervalMs(level - 1));
    }
  });

  it('tetap di batas bawah setelah level maksimum', () => {
    expect(spawnIntervalMs(MAX_CURVE_LEVEL + 30)).toBe(MIN_SPAWN_INTERVAL_MS);
  });
});

describe('lifetimeMs', () => {
  it('endpoint kurva eksak di Lv 1 dan Lv MAX', () => {
    expect(lifetimeMs(1)).toBe(INITIAL_LIFETIME_MS);
    expect(lifetimeMs(MAX_CURVE_LEVEL)).toBe(MIN_LIFETIME_MS);
  });

  it('menurun terus sampai ujung kurva', () => {
    for (let level = 2; level <= MAX_CURVE_LEVEL; level += 1) {
      expect(lifetimeMs(level)).toBeLessThan(lifetimeMs(level - 1));
    }
  });

  it('tetap di batas bawah setelah level maksimum', () => {
    expect(lifetimeMs(MAX_CURVE_LEVEL + 30)).toBe(MIN_LIFETIME_MS);
  });
});

describe('arah kesulitan (mengunci bug kurva terbalik)', () => {
  /**
   * Versi pertama game ini menyusutkan jeda spawn 8%/level tapi umur pixel hanya
   * 5%/level. Akibatnya papan makin PADAT seiring level dan pixel warna target
   * yang tersedia justru makin banyak (1,25 di Lv 1 → 1,83 di Lv 15), sehingga
   * sebagian kenaikan kesulitan saling meniadakan. Test ini memastikan arahnya
   * benar dan tidak diam-diam terbalik lagi saat angkanya diulik.
   */
  it('jumlah pixel yang hidup bersamaan MENURUN seiring level', () => {
    for (let level = 2; level <= MAX_CURVE_LEVEL; level += 1) {
      expect(expectedPixelsAlive(level)).toBeLessThan(expectedPixelsAlive(level - 1));
    }
  });

  it('papan tetap berisi di level tersulit — bukan malah kosong menunggu', () => {
    // Kalau turun ke bawah ~1,5 papan sering kosong dan pemain hanya menunggu,
    // yang terasa membosankan, bukan sulit.
    expect(expectedPixelsAlive(MAX_CURVE_LEVEL)).toBeGreaterThan(1.5);
    expect(expectedPixelsAlive(1)).toBeLessThan(3);
  });

  it('jendela reaksi di level tersulit masih manusiawi untuk tap di HP', () => {
    expect(lifetimeMs(MAX_CURVE_LEVEL)).toBeGreaterThanOrEqual(1000);
  });
});

describe('activeColors', () => {
  it('level awal hanya memakai INITIAL_ACTIVE_COLORS warna', () => {
    expect(activeColorCount(1)).toBe(INITIAL_ACTIVE_COLORS);
    expect(activeColors(1)).toHaveLength(INITIAL_ACTIVE_COLORS);
  });

  it('bertambah satu warna di level 3, 5, dan 8', () => {
    expect(activeColorCount(2)).toBe(3);
    expect(activeColorCount(3)).toBe(4);
    expect(activeColorCount(4)).toBe(4);
    expect(activeColorCount(5)).toBe(5);
    expect(activeColorCount(7)).toBe(5);
    expect(activeColorCount(8)).toBe(6);
  });

  it('tidak pernah melebihi jumlah warna yang ada', () => {
    expect(activeColorCount(999)).toBe(ALL_COLORS.length);
  });

  it('warna aktif selalu prefiks dari ALL_COLORS (stabil antar level)', () => {
    expect(activeColors(5)).toEqual(ALL_COLORS.slice(0, 5));
  });
});
