import { MAX_CURVE_LEVEL } from '../constants/index';

/**
 * Seberapa tegang musik harus terdengar, 0 (tenang) sampai 1 (paling menegangkan).
 *
 * Dipisahkan dari mesin audionya dengan sengaja: ini murni aritmetika keadaan
 * permainan, jadi ia bisa diuji tanpa menyentuh Web Audio sama sekali. Yang
 * tersisa di sisi audio hanyalah "terjemahkan angka ini jadi tempo dan filter".
 */

/** Sisa waktu di bawah rasio ini mulai dianggap mendesak. */
const TIME_PRESSURE_FROM = 0.25;

/** Nyawa tinggal satu terasa jauh lebih genting daripada dua. */
const LAST_LIFE_INTENSITY = 0.75;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Ketegangan mode solo.
 *
 * Solo tidak punya "kemenangan" untuk didekati, jadi yang dipakai dua hal yang
 * benar-benar ada: seberapa jauh kurva kesulitan sudah berjalan, dan seberapa
 * dekat pemain dengan kehabisan nyawa. Yang tertinggi menang — nyawa tinggal
 * satu di level 3 harus terdengar genting, dan level 19 dengan nyawa penuh juga.
 */
export function soloIntensity(level: number, lives: number | null, startingLives: number): number {
  const curve = clamp01((level - 1) / Math.max(1, MAX_CURVE_LEVEL - 1));

  if (lives === null || startingLives <= 0) return curve;

  // Nyawa penuh = 0, nyawa habis = 1.
  const lost = clamp01(1 - lives / startingLives);
  const danger = lives <= 1 ? Math.max(lost, LAST_LIFE_INTENSITY) : lost;

  return Math.max(curve, danger);
}

/**
 * Ketegangan match multiplayer.
 *
 * Di sinilah "makin dekat kemenangan makin menegangkan" punya arti harfiah:
 * skor tertinggi di papan dibandingkan target. Yang dipakai skor TERTINGGI
 * siapa pun, bukan skor pemain ini — ketegangan terbesar justru saat LAWAN
 * hampir menang, dan musik yang cuma mengikuti skor sendiri akan terdengar
 * paling tenang tepat di momen paling genting.
 *
 * Waktu yang menipis dihitung terpisah lalu diambil yang tertinggi: match bisa
 * berakhir karena salah satu dari keduanya, jadi keduanya layak terdengar.
 */
export function matchIntensity(
  topScore: number,
  targetScore: number,
  remainingMs: number,
  timeLimitMs: number,
): number {
  const race = targetScore > 0 ? clamp01(topScore / targetScore) : 0;

  // Tekanan waktu baru terasa di seperempat terakhir. Kalau ia naik sejak
  // detik pertama, seluruh match terdengar mendesak dan tidak ada lagi yang
  // tersisa untuk membedakan akhir yang benar-benar genting.
  const left = timeLimitMs > 0 ? clamp01(remainingMs / timeLimitMs) : 1;
  const pressure = left >= TIME_PRESSURE_FROM ? 0 : clamp01(1 - left / TIME_PRESSURE_FROM);

  return Math.max(race, pressure);
}
