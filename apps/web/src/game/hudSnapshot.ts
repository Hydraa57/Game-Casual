import { MAX_CONTINUES, SOLO_STARTING_LIVES } from '@pixelmatrix/shared';
import type { ChaosModifier, Color, GameStatus } from '@pixelmatrix/shared';

/**
 * Data HUD yang dikirim scene Phaser ke React. Sengaja hanya nilai primitif
 * supaya perbandingannya murah.
 *
 * Modul ini dipisah dari `BoardScene` dan TIDAK boleh meng-import Phaser:
 * komponen React meng-import tipe ini secara statis, jadi kalau Phaser ikut
 * tertarik ke sini, render di server akan gagal (`window is not defined`).
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

function sameColors(a: readonly Color[], b: readonly Color[]): boolean {
  return a.length === b.length && a.every((color, index) => color === b[index]);
}
