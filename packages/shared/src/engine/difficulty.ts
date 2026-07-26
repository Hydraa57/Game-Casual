import {
  ALL_COLORS,
  CLICKS_PER_LEVEL,
  COLOR_UNLOCK_LEVELS,
  INITIAL_ACTIVE_COLORS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  LIFETIME_FACTOR_PER_LEVEL,
  MIN_LIFETIME_MS,
  MIN_SPAWN_INTERVAL_MS,
  SPAWN_INTERVAL_FACTOR_PER_LEVEL,
} from '../constants/index';
import type { Color } from '../types/index';

/** Level dimulai dari 1 dan naik setiap CLICKS_PER_LEVEL klik benar (GDD §4). */
export function levelFor(correctClicks: number): number {
  return Math.floor(correctClicks / CLICKS_PER_LEVEL) + 1;
}

/** Jeda antar spawn di level tertentu, makin pendek tapi tidak melewati batas bawah. */
export function spawnIntervalMs(level: number): number {
  const raw = INITIAL_SPAWN_INTERVAL_MS * SPAWN_INTERVAL_FACTOR_PER_LEVEL ** (level - 1);
  return Math.max(MIN_SPAWN_INTERVAL_MS, Math.round(raw));
}

/** Umur pixel di level tertentu, makin pendek tapi tidak melewati batas bawah. */
export function lifetimeMs(level: number): number {
  const raw = INITIAL_LIFETIME_MS * LIFETIME_FACTOR_PER_LEVEL ** (level - 1);
  return Math.max(MIN_LIFETIME_MS, Math.round(raw));
}

/** Berapa warna yang aktif di level tertentu — makin banyak = makin banyak distraktor. */
export function activeColorCount(level: number): number {
  const unlocked = COLOR_UNLOCK_LEVELS.filter((unlockLevel) => level >= unlockLevel).length;
  return Math.min(ALL_COLORS.length, INITIAL_ACTIVE_COLORS + unlocked);
}

export function activeColors(level: number): readonly Color[] {
  return ALL_COLORS.slice(0, activeColorCount(level));
}
