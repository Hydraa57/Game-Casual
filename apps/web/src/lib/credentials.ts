/**
 * Aturan username & password.
 *
 * Sengaja longgar: yang disimpan hanya riwayat permainan, dan aturan yang
 * rewel (harus ada simbol, harus ada angka, minimal 12 karakter) hanya akan
 * membuat orang menyerah di form pendaftaran atau menuliskan password-nya di
 * catatan HP. Yang TIDAK longgar adalah cara password disimpan — lihat
 * `packages/db/src/password.ts`.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 6;

/** Huruf, angka, dan garis bawah. Tanpa spasi supaya enak dibaca di leaderboard. */
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export type CredentialError = 'usernameLength' | 'usernameChars' | 'passwordLength';

export function validateUsername(username: string): CredentialError | null {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) return 'usernameLength';
  if (!USERNAME_PATTERN.test(trimmed)) return 'usernameChars';
  return null;
}

export function validatePassword(password: string): CredentialError | null {
  // Tidak ada batas atas: memotong password panjang justru melemahkannya, dan
  // scrypt tidak peduli panjangnya.
  return password.length < PASSWORD_MIN ? 'passwordLength' : null;
}

/**
 * Bentuk username yang dipakai untuk mencari duplikat.
 *
 * Dicocokkan tanpa peduli besar-kecil huruf: "Budi" dan "budi" sebagai dua
 * akun berbeda akan membuat leaderboard membingungkan dan memudahkan orang
 * menyamar jadi temannya.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
