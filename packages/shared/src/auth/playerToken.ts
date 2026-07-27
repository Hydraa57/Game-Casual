import type { AvatarId } from '../types/index';

/**
 * Identitas pemain yang sudah terbukti, sebagaimana dipercaya game-server.
 *
 * Isinya sengaja minimal: hanya yang dibutuhkan untuk menautkan hasil match ke
 * akun. Tidak ada email, tidak ada hash password — token ini melewati browser,
 * jadi apa pun di dalamnya harus dianggap terbaca oleh pemain.
 */
export interface PlayerIdentity {
  readonly userId: string;
  readonly username: string;
  readonly avatar: AvatarId;
}

interface TokenPayload extends PlayerIdentity {
  /** Epoch ms kedaluwarsa. */
  readonly exp: number;
}

/**
 * Umur token pendek dengan sengaja.
 *
 * Token ini dikirim ke game-server lewat payload biasa, jadi ia bisa terbaca
 * JavaScript — beda dengan cookie sesi yang `httpOnly`. Kalau ada celah XSS,
 * yang tercuri hanyalah izin bergabung ke room selama semenit, bukan sesi
 * 30 hari yang bisa dipakai masuk ke akun.
 */
export const PLAYER_TOKEN_TTL_MS = 60_000;

/**
 * Permukaan platform yang dipakai modul ini, diketik seadanya di sini.
 *
 * `packages/shared` sengaja tidak memuat lib `DOM` maupun tipe Node (lihat
 * ARCHITECTURE §2): tanpa itu, `document` dan `window` akan lolos type-check
 * di kode yang seharusnya juga jalan di server. Mengambilnya dari `globalThis`
 * dengan tipe sempit di sini jauh lebih murah daripada melonggarkan lib untuk
 * seluruh paket demi satu API kriptografi.
 *
 * Web Crypto, TextEncoder, dan TextDecoder ada di Node 18+ maupun browser
 * modern, jadi kontraknya tetap satu untuk kedua sisi.
 */
interface HmacKey {
  readonly type: string;
}

interface PlatformGlobals {
  readonly crypto: {
    readonly subtle: {
      importKey(
        format: 'raw',
        keyData: Uint8Array,
        algorithm: { name: 'HMAC'; hash: 'SHA-256' },
        extractable: boolean,
        keyUsages: readonly ('sign' | 'verify')[],
      ): Promise<HmacKey>;
      sign(algorithm: 'HMAC', key: HmacKey, data: Uint8Array): Promise<ArrayBuffer>;
      verify(
        algorithm: 'HMAC',
        key: HmacKey,
        signature: Uint8Array,
        data: Uint8Array,
      ): Promise<boolean>;
    };
  };
  readonly TextEncoder: new () => { encode(input: string): Uint8Array };
  readonly TextDecoder: new () => { decode(input: Uint8Array): string };
}

const platform = globalThis as unknown as PlatformGlobals;

const utf8 = (value: string): Uint8Array => new platform.TextEncoder().encode(value);

async function hmacKey(secret: string): Promise<HmacKey> {
  return platform.crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Hex, bukan base64.
 *
 * `btoa`/`atob` tidak ada di lib TypeScript yang dipakai paket ini, dan
 * menambahkannya berarti membuka seluruh API browser (lihat webcrypto.d.ts).
 * Hex lebih boros ~33% tapi token ini cuma ratusan byte dan dikirim sekali
 * per join room — tidak ada bedanya di praktik.
 */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/.test(value)) throw new Error('hex tidak valid');
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function signPlayerToken(
  identity: PlayerIdentity,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const payload: TokenPayload = { ...identity, exp: now + PLAYER_TOKEN_TTL_MS };
  const body = toHex(utf8(JSON.stringify(payload)));
  const signature = await platform.crypto.subtle.sign('HMAC', await hmacKey(secret), utf8(body));
  return `${body}.${toHex(new Uint8Array(signature))}`;
}

/**
 * Kembalikan identitas kalau tanda tangannya sah dan belum kedaluwarsa; `null`
 * untuk apa pun selain itu.
 *
 * Satu `null` untuk semua kegagalan adalah pilihan sadar: token cacat, tanda
 * tangan palsu, dan token kedaluwarsa sama-sama berarti "perlakukan sebagai
 * guest". Membedakannya di sini hanya akan memancing pemanggil menulis
 * penanganan khusus yang tidak ada gunanya.
 */
export async function verifyPlayerToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<PlayerIdentity | null> {
  const [body, signature] = token.split('.');
  if (body === undefined || signature === undefined) return null;

  try {
    // crypto.subtle.verify membandingkan dalam waktu tetap; membandingkan
    // string tanda tangan dengan === akan membocorkan byte demi byte.
    const valid = await platform.crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromHex(signature),
      utf8(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new platform.TextDecoder().decode(fromHex(body))) as TokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') return null;

    return { userId: payload.userId, username: payload.username, avatar: payload.avatar };
  } catch {
    // hex rusak, JSON tidak valid, apa pun — tetap guest.
    return null;
  }
}
