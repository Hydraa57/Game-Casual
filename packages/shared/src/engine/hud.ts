import { CLICKS_PER_LEVEL, MAX_CONTINUES, SOLO_STARTING_LIVES } from '../constants/index';
import type { ChaosModifier, Color, GameStatus } from '../types/index';

/**
 * Ringkasan keadaan permainan untuk digambar HUD. Sengaja hanya nilai primitif
 * supaya perbandingannya murah — HUD-nya sendiri dikabari 60× per detik.
 *
 * **Ada di paket bersama, bukan di salah satu klien.** Web menghitungnya dari
 * scene Phaser dan Android dari mesin solonya sendiri, tapi keduanya harus
 * menjawab pertanyaan yang sama persis: berapa skornya, warna apa targetnya,
 * sisa berapa nyawanya. Menyalin bentuk ini ke sisi Android akan membuat kedua
 * HUD bisa berpisah tanpa satu pun error — misalnya saat satu field baru
 * ditambahkan di web dan yang lain tidak ikut.
 *
 * Modul ini TIDAK boleh meng-import mesin gambar apa pun (Phaser, React
 * Native): ia di-import statis oleh komponen yang dirender di server.
 */
export interface HudSnapshot {
  readonly status: GameStatus;
  readonly score: number;
  readonly combo: number;
  readonly multiplier: number;
  readonly bestCombo: number;
  readonly lives: number | null;
  readonly level: number;
  /** True saat kurva kesulitan sudah mentok — HUD menandainya "MAX". */
  readonly atMaxLevel: boolean;
  /** Satu warna sampai Lv 11, dua warna dari Lv 12. */
  readonly targetColors: readonly Color[];
  /**
   * Warna tinta untuk tiap kata target saat mode Stroop aktif; `null` sebelum
   * itu. Panjangnya selalu sama dengan `targetColors`.
   */
  readonly stroopInk: readonly Color[] | null;
  /** 0..1 menuju level berikutnya. */
  readonly levelFraction: number;
  /** Sisa klik benar yang dibutuhkan untuk naik level. */
  readonly clicksToNextLevel: number;
  /** Modifier chaos aktif (Lv 21+), `null` di bawahnya. */
  readonly chaos: ChaosModifier | null;
  readonly targetImminent: boolean;
  readonly accuracy: number;
  /**
   * Lama ronde berjalan. Dipakai server untuk menolak skor yang mustahil saat
   * dikirim ke akun — bukan untuk ditampilkan.
   */
  readonly elapsedMs: number;
  /** Level checkpoint terakhir yang tersentuh; `null` kalau belum ada. */
  readonly checkpointLevel: number | null;
  readonly continuesLeft: number;
  /** True saat overlay game over boleh menawarkan tombol "lanjut". */
  readonly canContinue: boolean;
}

/** Nilai awal supaya HUD sudah terlihat wajar sebelum Phaser selesai dimuat. */
export const INITIAL_SNAPSHOT: HudSnapshot = {
  status: 'idle',
  score: 0,
  combo: 0,
  multiplier: 1,
  bestCombo: 0,
  lives: SOLO_STARTING_LIVES,
  level: 1,
  stroopInk: null,
  levelFraction: 0,
  clicksToNextLevel: CLICKS_PER_LEVEL,
  atMaxLevel: false,
  targetColors: ['red'],
  chaos: null,
  targetImminent: false,
  accuracy: 1,
  elapsedMs: 0,
  checkpointLevel: null,
  continuesLeft: MAX_CONTINUES,
  canContinue: false,
};

export function isSameSnapshot(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.status === b.status &&
    a.score === b.score &&
    a.combo === b.combo &&
    a.multiplier === b.multiplier &&
    a.bestCombo === b.bestCombo &&
    a.lives === b.lives &&
    a.level === b.level &&
    a.levelFraction === b.levelFraction &&
    sameColors(a.stroopInk, b.stroopInk) &&
    a.atMaxLevel === b.atMaxLevel &&
    a.chaos === b.chaos &&
    sameColors(a.targetColors, b.targetColors) &&
    a.targetImminent === b.targetImminent &&
    a.accuracy === b.accuracy &&
    a.checkpointLevel === b.checkpointLevel &&
    a.continuesLeft === b.continuesLeft &&
    a.canContinue === b.canContinue
  );
}

function sameColors(a: readonly Color[] | null, b: readonly Color[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((color, index) => color === b[index]);
}
