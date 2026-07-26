import {
  ALL_COLORS,
  CLICKS_PER_LEVEL,
  COLOR_UNLOCK_LEVELS,
  INITIAL_ACTIVE_COLORS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  MAX_CURVE_LEVEL,
  MIN_LIFETIME_MS,
  MIN_SPAWN_INTERVAL_MS,
} from '../constants/index';
import type { Color } from '../types/index';

/** Level dimulai dari 1 dan naik setiap CLICKS_PER_LEVEL klik benar (GDD §4). */
export function levelFor(correctClicks: number): number {
  return Math.floor(correctClicks / CLICKS_PER_LEVEL) + 1;
}

/**
 * Posisi level pada kurva: 0 di Lv 1, 1 di Lv MAX_CURVE_LEVEL dan seterusnya.
 * Semua parameter kesulitan diturunkan dari nilai ini supaya ujung kurvanya
 * eksak dan mudah dibaca.
 */
export function curveProgress(level: number): number {
  const raw = (level - 1) / (MAX_CURVE_LEVEL - 1);
  return Math.min(1, Math.max(0, raw));
}

/** True saat kesulitan sudah tidak bisa naik lagi (HUD menampilkan "MAX"). */
export function isMaxCurveLevel(level: number): boolean {
  return level >= MAX_CURVE_LEVEL;
}

function interpolate(from: number, to: number, level: number): number {
  return Math.round(from + (to - from) * curveProgress(level));
}

/** Jeda antar spawn: 1200 ms di Lv 1 → 500 ms di Lv 20. */
export function spawnIntervalMs(level: number): number {
  return interpolate(INITIAL_SPAWN_INTERVAL_MS, MIN_SPAWN_INTERVAL_MS, level);
}

/**
 * Umur pixel: 3000 ms di Lv 1 → 1000 ms di Lv 20.
 *
 * PENTING: umur menyusut dengan rasio yang lebih besar (jadi 1/3) daripada jeda
 * spawn (jadi 5/12), sehingga jumlah pixel yang hidup bersamaan MENURUN seiring
 * level. Kalau urutannya dibalik, papan justru makin padat dan target makin
 * gampang ditemukan — itu bug yang ada di versi pertama game ini, dan ada unit
 * test khusus yang menjaganya supaya tidak kembali.
 */
export function lifetimeMs(level: number): number {
  return interpolate(INITIAL_LIFETIME_MS, MIN_LIFETIME_MS, level);
}

/**
 * Perkiraan jumlah pixel yang hidup bersamaan di level tertentu. Dipakai untuk
 * menguji arah kurva, dan berguna saat mengulik balancing.
 */
export function expectedPixelsAlive(level: number): number {
  return lifetimeMs(level) / spawnIntervalMs(level);
}

/** Berapa warna yang aktif di level tertentu — makin banyak = makin banyak distraktor. */
export function activeColorCount(level: number): number {
  const unlocked = COLOR_UNLOCK_LEVELS.filter((unlockLevel) => level >= unlockLevel).length;
  return Math.min(ALL_COLORS.length, INITIAL_ACTIVE_COLORS + unlocked);
}

export function activeColors(level: number): readonly Color[] {
  return ALL_COLORS.slice(0, activeColorCount(level));
}
