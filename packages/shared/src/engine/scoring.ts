import {
  BASE_POINTS,
  COMBO_MULTIPLIERS,
  COMBO_STEP,
  MAX_SPEED_BONUS,
  WRONG_CLICK_PENALTY,
} from '../constants/index';
import type { Pixel } from '../types/index';

/**
 * Sisa umur pixel sebagai rasio 0..1 (1 = baru muncul, 0 = tepat mau pudar).
 * Dipakai untuk speed bonus dan untuk mengatur transparansi di renderer.
 */
export function remainingRatio(pixel: Pixel, elapsedMs: number): number {
  const age = elapsedMs - pixel.spawnedAtMs;
  const ratio = 1 - age / pixel.lifetimeMs;
  return Math.min(1, Math.max(0, ratio));
}

/** Bonus kecepatan 0..MAX_SPEED_BONUS, makin cepat diklik makin besar. */
export function speedBonus(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(MAX_SPEED_BONUS * clamped);
}

/**
 * Multiplier untuk panjang combo tertentu: 0–4 → ×1, 5–9 → ×1.5, 10+ → ×2.
 */
export function comboMultiplier(combo: number): number {
  const tier = Math.floor(Math.max(0, combo) / COMBO_STEP);
  const index = Math.min(tier, COMBO_MULTIPLIERS.length - 1);
  return COMBO_MULTIPLIERS[index]!;
}

/**
 * Poin untuk satu klik benar.
 *
 * `combo` yang dipakai adalah combo SETELAH klik ini dihitung, jadi klik yang
 * tepat menyentuh kelipatan 5 langsung menikmati multiplier barunya — terasa
 * seperti hadiah, bukan seperti telat satu langkah.
 */
export function pointsForClick(ratio: number, combo: number): number {
  return Math.round((BASE_POINTS + speedBonus(ratio)) * comboMultiplier(combo));
}

/** Skor tidak pernah turun di bawah nol (GDD §3). */
export function applyPenalty(score: number): number {
  return Math.max(0, score - WRONG_CLICK_PENALTY);
}
