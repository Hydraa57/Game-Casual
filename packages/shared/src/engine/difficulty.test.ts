import { describe, expect, it } from 'vitest';
import {
  ALL_COLORS,
  CLICKS_PER_LEVEL,
  INITIAL_ACTIVE_COLORS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  MIN_LIFETIME_MS,
  MIN_SPAWN_INTERVAL_MS,
} from '../constants/index';
import {
  activeColorCount,
  activeColors,
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

describe('spawnIntervalMs', () => {
  it('level 1 memakai nilai awal', () => {
    expect(spawnIntervalMs(1)).toBe(INITIAL_SPAWN_INTERVAL_MS);
  });

  it('makin tinggi level makin cepat', () => {
    expect(spawnIntervalMs(2)).toBeLessThan(spawnIntervalMs(1));
    expect(spawnIntervalMs(5)).toBeLessThan(spawnIntervalMs(4));
  });

  it('tidak pernah lebih cepat dari batas bawah', () => {
    expect(spawnIntervalMs(100)).toBe(MIN_SPAWN_INTERVAL_MS);
    expect(spawnIntervalMs(1000)).toBeGreaterThanOrEqual(MIN_SPAWN_INTERVAL_MS);
  });
});

describe('lifetimeMs', () => {
  it('level 1 memakai nilai awal', () => {
    expect(lifetimeMs(1)).toBe(INITIAL_LIFETIME_MS);
  });

  it('makin tinggi level makin pendek', () => {
    expect(lifetimeMs(3)).toBeLessThan(lifetimeMs(2));
  });

  it('tidak pernah lebih pendek dari batas bawah', () => {
    expect(lifetimeMs(100)).toBe(MIN_LIFETIME_MS);
  });
});

describe('activeColors', () => {
  it('level awal hanya memakai INITIAL_ACTIVE_COLORS warna', () => {
    expect(activeColorCount(1)).toBe(INITIAL_ACTIVE_COLORS);
    expect(activeColors(1)).toHaveLength(INITIAL_ACTIVE_COLORS);
  });

  it('bertambah satu warna di level 3, 5, dan 7 (GDD §4)', () => {
    expect(activeColorCount(2)).toBe(3);
    expect(activeColorCount(3)).toBe(4);
    expect(activeColorCount(4)).toBe(4);
    expect(activeColorCount(5)).toBe(5);
    expect(activeColorCount(6)).toBe(5);
    expect(activeColorCount(7)).toBe(6);
  });

  it('tidak pernah melebihi jumlah warna yang ada', () => {
    expect(activeColorCount(999)).toBe(ALL_COLORS.length);
  });

  it('warna aktif selalu prefiks dari ALL_COLORS (stabil antar level)', () => {
    expect(activeColors(5)).toEqual(ALL_COLORS.slice(0, 5));
  });
});
