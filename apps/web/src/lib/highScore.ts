/**
 * High score solo untuk MVP. Nanti (Fase 3) pindah ke akun lewat
 * `POST /api/v1/solo-scores`; key-nya diberi versi supaya migrasi mudah.
 */
const STORAGE_KEY = 'pp.solo.highscore.v1';

export function readHighScore(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    // Safari mode privat bisa melempar saat mengakses localStorage.
    return 0;
  }
}

export function writeHighScore(score: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // Tidak apa-apa: high score hilang, permainan tetap jalan.
  }
}
