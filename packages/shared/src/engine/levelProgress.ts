import { CLICKS_PER_LEVEL, MP_LEVEL_DURATION_MS } from '../constants/index';

/**
 * Seberapa dekat pemain ke level berikutnya.
 *
 * Solo dan multiplayer menaikkan level dari sumber yang BERBEDA — solo dari
 * jumlah klik benar, multiplayer dari waktu berjalan (lihat
 * MP_LEVEL_DURATION_MS) — jadi keduanya butuh perhitungan sendiri. Yang
 * disatukan di sini adalah bentuk hasilnya: pecahan 0..1 dan sisa yang bisa
 * dibaca. Dengan begitu satu komponen bar bisa melayani kedua mode, dan tidak
 * ada kemungkinan bar-nya penuh di satu mode tapi tidak di mode lain.
 */
export interface LevelProgress {
  /** 0 tepat setelah naik level, mendekati 1 sesaat sebelum naik lagi. */
  readonly fraction: number;
  /** Sisa menuju level berikutnya: jumlah klik (solo) atau milidetik (MP). */
  readonly remaining: number;
}

/** Progres level solo dari jumlah klik benar sepanjang ronde. */
export function soloLevelProgress(correctClicks: number): LevelProgress {
  // Klik negatif tidak mungkin datang dari engine, tapi kalau nanti ada
  // mekanik yang menguranginya, bar yang melar ke belakang lebih buruk
  // daripada bar yang berhenti di nol.
  const safe = Math.max(0, correctClicks);
  const into = safe % CLICKS_PER_LEVEL;
  return { fraction: into / CLICKS_PER_LEVEL, remaining: CLICKS_PER_LEVEL - into };
}

/** Progres level multiplayer dari waktu match yang sudah berjalan. */
export function mpLevelProgress(elapsedMs: number): LevelProgress {
  const safe = Math.max(0, elapsedMs);
  const into = safe % MP_LEVEL_DURATION_MS;
  return { fraction: into / MP_LEVEL_DURATION_MS, remaining: MP_LEVEL_DURATION_MS - into };
}
