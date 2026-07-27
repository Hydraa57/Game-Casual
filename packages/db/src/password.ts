import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Hash password memakai scrypt dari pustaka bawaan Node.
 *
 * Kenapa tetap serius padahal yang disimpan "cuma riwayat game": orang memakai
 * ulang password di tempat lain. Kalau database ini bocor dan isinya password
 * polos (atau MD5/SHA biasa), yang dirugikan bukan akun game ini — melainkan
 * email dan rekening mereka. Ini satu-satunya bagian dari sistem akun yang
 * TIDAK boleh dibuat longgar.
 *
 * scrypt dipilih karena memory-hard (mahal untuk di-brute-force dengan GPU)
 * DAN sudah ada di Node — tidak perlu dependensi native seperti bcrypt yang
 * merepotkan saat build Docker.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verifikasi password terhadap hash tersimpan.
 *
 * Perbandingannya memakai `timingSafeEqual`, bukan `===`: perbandingan string
 * biasa berhenti di byte pertama yang berbeda, dan selisih waktunya bisa
 * dipakai menebak hash byte demi byte.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (salt === undefined || hash === undefined) return false;

  const expected = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;

  // timingSafeEqual melempar kalau panjangnya beda, jadi diperiksa dulu.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

/** Token sesi acak — 32 byte dari CSPRNG, bukan dari Math.random. */
export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}
