import { MP_SCORE_WARNING_RATIO, MP_TIME_WARNING_MS } from '../constants/index';

/**
 * Seberapa tegang musik harus terdengar, 0 (tenang) sampai 1 (paling menegangkan).
 *
 * Dipisahkan dari mesin audionya dengan sengaja: ini murni aritmetika keadaan
 * permainan, jadi ia bisa diuji tanpa menyentuh Web Audio sama sekali. Yang
 * tersisa di sisi audio hanyalah "terjemahkan angka ini jadi tempo dan filter".
 */

/**
 * Ketegangan adalah PENGECUALIAN, bukan keadaan biasa.
 *
 * Versi pertama menaikkannya terus-menerus: di multiplayer ia mengikuti skor
 * sejak poin pertama, dan di solo ia mengikuti level. Akibatnya musik sudah
 * setengah tegang di menit pertama dan tidak pernah kembali ceria — persis
 * keluhan pemain. Yang benar adalah sebaliknya: gamenya ceria hampir
 * sepanjang waktu, dan ketegangan disimpan untuk saat ia benar-benar berarti.
 *
 * Angka 0 di sini berarti "mainkan lagu cerianya", bukan "mainkan versi paling
 * lembut dari lagu tegang".
 */

/** Nyawa tinggal satu: satu kesalahan lagi dan rondenya habis. */
const LAST_LIFE_INTENSITY = 0.8;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Ketegangan mode solo.
 *
 * Hanya dari NYAWA, tidak lagi dari level. Kurva level dulu ikut dihitung, dan
 * karena level terus naik sepanjang ronde, musiknya jadi permanen tegang mulai
 * pertengahan permainan tanpa ada satu pun kejadian yang membenarkannya.
 * Level yang naik memang membuat papan lebih sulit — tapi "lebih sulit" bukan
 * "hampir kalah", dan cuma yang kedua yang layak mengubah musiknya.
 */
export function soloIntensity(_level: number, lives: number | null, startingLives: number): number {
  if (lives === null || startingLives <= 0) return 0;
  if (lives <= 1) return LAST_LIFE_INTENSITY;
  // Dua nyawa tersisa sudah terasa, tapi belum genting.
  if (lives === 2) return 0.35;
  return 0;
}

/**
 * Ketegangan match multiplayer — hanya di babak akhir.
 *
 * Dua pemicu, dan yang tertinggi menang:
 *
 * 1. **Waktu hampir habis** (MP_TIME_WARNING_MS terakhir).
 * 2. **Ada yang hampir menyentuh target** (di atas MP_SCORE_WARNING_RATIO).
 *
 * Yang dipakai skor TERTINGGI siapa pun, bukan skor pemain ini: momen paling
 * genting justru saat LAWAN hampir menang, dan musik yang mengikuti skor
 * sendiri akan terdengar paling tenang tepat di situ.
 *
 * Ambangnya dibagi dengan tampilan (angka waktu yang berdenyut merah, spanduk
 * babak akhir). Kalau masing-masing punya ambangnya sendiri, layar dan musik
 * berubah di detik yang berbeda dan keduanya berhenti terasa sebagai satu
 * kejadian.
 */
export function matchIntensity(
  topScore: number,
  targetScore: number,
  remainingMs: number,
  _timeLimitMs: number,
): number {
  const rasio = targetScore > 0 ? clamp01(topScore / targetScore) : 0;
  const race =
    rasio <= MP_SCORE_WARNING_RATIO
      ? 0
      : clamp01((rasio - MP_SCORE_WARNING_RATIO) / (1 - MP_SCORE_WARNING_RATIO));

  const pressure =
    remainingMs >= MP_TIME_WARNING_MS ? 0 : clamp01(1 - remainingMs / MP_TIME_WARNING_MS);

  return Math.max(race, pressure);
}
