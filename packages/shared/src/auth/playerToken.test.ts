import { describe, expect, it } from 'vitest';
import { PLAYER_TOKEN_TTL_MS, signPlayerToken, verifyPlayerToken } from './playerToken';
import type { PlayerIdentity } from './playerToken';

const SECRET = 'rahasia-server-yang-panjang-sekali';
const identity: PlayerIdentity = { userId: 'u1', username: 'Hafidz', avatar: 'panda' };

// Paket ini tidak memuat tipe Node maupun DOM (lihat playerToken.ts), jadi
// helper tes pun mengambil TextEncoder/TextDecoder lewat globalThis.
const platform = globalThis as unknown as {
  TextEncoder: new () => { encode(input: string): Uint8Array };
  TextDecoder: new () => { decode(input: Uint8Array): string };
};

const hex = (value: string): string =>
  [...new platform.TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const unhex = (value: string): string =>
  new platform.TextDecoder().decode(
    Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16)),
  );

describe('token identitas pemain', () => {
  it('bolak-balik: yang ditandatangani bisa diverifikasi', async () => {
    const token = await signPlayerToken(identity, SECRET);
    await expect(verifyPlayerToken(token, SECRET)).resolves.toEqual(identity);
  });

  it('secret berbeda ditolak', async () => {
    // Inti keamanannya: tanpa secret yang sama, siapa pun bisa mengaku jadi
    // pemain mana pun dan mengklaim riwayat match orang lain.
    const token = await signPlayerToken(identity, SECRET);
    await expect(verifyPlayerToken(token, 'secret-lain')).resolves.toBeNull();
  });

  it('mengaku jadi pemain lain menggugurkan tanda tangan', async () => {
    // Serangan yang sebenarnya dijaga: ambil token sendiri, ganti userId-nya
    // jadi milik orang lain, lalu klaim riwayat match mereka.
    const token = await signPlayerToken(identity, SECRET);
    const [, signature] = token.split('.');
    const dicuri = { ...identity, userId: 'korban', username: 'Laila', exp: Date.now() + 60_000 };
    const palsu = hex(JSON.stringify(dicuri));

    await expect(verifyPlayerToken(`${palsu}.${signature}`, SECRET)).resolves.toBeNull();
  });

  it('memperpanjang masa berlaku sendiri juga gagal', async () => {
    const token = await signPlayerToken(identity, SECRET, 1_000_000);
    const [, signature] = token.split('.');
    const diperpanjang = hex(JSON.stringify({ ...identity, exp: 9_999_999_999_999 }));

    await expect(verifyPlayerToken(`${diperpanjang}.${signature}`, SECRET)).resolves.toBeNull();
  });

  it('token kedaluwarsa ditolak', async () => {
    const token = await signPlayerToken(identity, SECRET, 0);
    await expect(verifyPlayerToken(token, SECRET, PLAYER_TOKEN_TTL_MS + 1)).resolves.toBeNull();
  });

  it('masih sah tepat sebelum kedaluwarsa', async () => {
    const token = await signPlayerToken(identity, SECRET, 0);
    await expect(verifyPlayerToken(token, SECRET, PLAYER_TOKEN_TTL_MS - 1)).resolves.toEqual(
      identity,
    );
  });

  it('token cacat tidak melempar, hanya null', async () => {
    for (const buruk of ['', 'tanpa-titik', 'zz.zz', '...', 'x'.repeat(500)]) {
      await expect(verifyPlayerToken(buruk, SECRET)).resolves.toBeNull();
    }
  });

  it('tidak membawa data sensitif', async () => {
    const token = await signPlayerToken(identity, SECRET);
    const [body] = token.split('.');
    const isi = unhex(body!);
    // Token ini melewati browser dan bisa dibaca pemain, jadi isinya harus
    // benar-benar hanya identitas publik.
    expect(Object.keys(JSON.parse(isi)).sort()).toEqual(['avatar', 'exp', 'userId', 'username']);
  });
});
