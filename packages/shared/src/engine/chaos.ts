import {
  CHAOS_BOMB_MULTIPLIER,
  CHAOS_FIRST_LEVEL,
  CHAOS_MODIFIERS,
  CHAOS_RUSH_SPAWN_FACTOR,
} from '../constants/index';
import type { ChaosModifier } from '../types/index';
import { seedFromString } from './rng';

/**
 * Mode chaos: di atas ujung kurva kesulitan, tiap level mengaktifkan satu
 * modifier acak. Ini yang menggantikan "tidak ada apa pun yang berubah lagi" —
 * progres utamanya (Lv 1–20) tetap bisa diprediksi, dan kejutan hanya datang
 * setelah pemain menaklukkan kurva penuh.
 *
 * Pemilihannya deterministik dari seed match + level, jadi sebuah ronde bisa
 * di-replay dan (nanti) semua pemain multiplayer melihat modifier yang sama.
 */
export function chaosModifierFor(seed: number, level: number): ChaosModifier | null {
  if (level < CHAOS_FIRST_LEVEL) return null;

  const mixed = seedFromString(`${seed}:${level}`);
  const index = Math.abs(mixed) % CHAOS_MODIFIERS.length;
  return CHAOS_MODIFIERS[index]!;
}

export function isChaosLevel(level: number): boolean {
  return level >= CHAOS_FIRST_LEVEL;
}

/** Faktor jeda spawn dari modifier aktif (`rush` mempercepat). */
export function chaosSpawnFactor(modifier: ChaosModifier | null): number {
  return modifier === 'rush' ? CHAOS_RUSH_SPAWN_FACTOR : 1;
}

/** Pengali peluang bom dari modifier aktif (`bombRain` menggandakan). */
export function chaosBombFactor(modifier: ChaosModifier | null): number {
  return modifier === 'bombRain' ? CHAOS_BOMB_MULTIPLIER : 1;
}

/** `blackout` menyembunyikan glyph, jadi pemain harus murni membedakan warna. */
export function chaosHidesGlyphs(modifier: ChaosModifier | null): boolean {
  return modifier === 'blackout';
}

export function chaosShufflesBoard(modifier: ChaosModifier | null): boolean {
  return modifier === 'shuffle';
}
