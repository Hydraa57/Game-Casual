/**
 * High score solo untuk MVP. Nanti (Fase 3) pindah ke akun lewat
 * `POST /api/v1/solo-scores`; key-nya diberi versi supaya migrasi mudah.
 */
const STORAGE_KEY = 'pm.solo.highscore.v1';

/**
 * Key dari sebelum game ini berganti nama dari "Pixel Pulse".
 * Mengganti key begitu saja akan menghapus rekor yang sudah dikumpulkan pemain
 * di browser-nya, jadi nilainya dipindahkan sekali lalu key lama dibuang.
 */
const LEGACY_STORAGE_KEY = 'pp.solo.highscore.v1';

function parseScore(raw: string | null): number {
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function readHighScore(): number {
  try {
    const current = parseScore(window.localStorage.getItem(STORAGE_KEY));
    if (current > 0) return current;

    const legacy = parseScore(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy > 0) {
      window.localStorage.setItem(STORAGE_KEY, String(legacy));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return legacy;
    }

    return 0;
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
