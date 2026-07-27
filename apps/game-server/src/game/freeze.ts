/**
 * Aturan beku setelah nyawa habis di multiplayer.
 *
 * Dipisah dari `Match` supaya bisa diuji tanpa Socket.IO dan tanpa timer. Yang
 * halus di sini adalah perbedaan antara tiga keadaan yang semuanya diwakili
 * satu angka: 0 = tidak pernah beku, > now = sedang beku, ≤ now = masa bekunya
 * habis dan pemain harus dihidupkan.
 */

/** Nyawa habis dan pemain belum dibekukan — saatnya membekukannya. */
export function shouldFreeze(lives: number | null, frozenUntil: number): boolean {
  // `frozenUntil !== 0` mencegah masa beku diperpanjang terus: selama beku,
  // nyawa memang masih 0, dan tanpa penjagaan ini tick berikutnya akan
  // menyetel ulang timernya dan pemain tidak pernah hidup lagi.
  return lives !== null && lives <= 0 && frozenUntil === 0;
}

/** Pemain sedang beku dan ketukannya harus diabaikan. */
export function isFrozen(frozenUntil: number, now: number): boolean {
  return frozenUntil > now;
}

/** Masa beku sudah lewat dan pemain harus dikembalikan dengan nyawa penuh. */
export function hasThawed(frozenUntil: number, now: number): boolean {
  // 0 berarti tidak pernah beku — bukan "sudah lama cair". Tanpa pemeriksaan
  // ini setiap pemain sehat akan "dihidupkan" di tiap tick, yang berarti
  // combo mereka di-reset 20 kali per detik.
  return frozenUntil !== 0 && frozenUntil <= now;
}
