import { ROOM_CODE_LENGTH } from '@pixelmatrix/shared';

/**
 * Alfabet kode room.
 *
 * Sengaja tanpa `I`, `O`, `0`, dan `1`: kode ini dibacakan atau diketik ulang
 * oleh orang lain di tongkrongan, dan pasangan itulah yang paling sering
 * tertukar. Mengeluarkannya dari alfabet lebih murah daripada menangani
 * salah baca.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Bersihkan kode yang diketik pemain: huruf besar, dan buang apa pun yang bukan
 * bagian dari alfabet (spasi, tanda hubung, dan karakter membingungkan seperti
 * `O` atau `0`). Hasilnya lalu diuji panjangnya oleh `isValidRoomCode`, jadi
 * kode yang salah ketik gagal dengan pesan yang jelas, bukan diam-diam diterima.
 */
export function normalizeRoomCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((character) => ROOM_CODE_ALPHABET.includes(character))
    .join('');
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c));
}
