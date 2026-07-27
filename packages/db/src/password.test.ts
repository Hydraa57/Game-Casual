import { describe, expect, it } from 'vitest';
import { hashPassword, newSessionToken, verifyPassword } from './password';

describe('hashPassword', () => {
  it('tidak pernah menyimpan password polos', async () => {
    const hash = await hashPassword('rahasia123');
    expect(hash).not.toContain('rahasia123');
  });

  it('password yang sama menghasilkan hash berbeda (salt acak)', async () => {
    // Kalau hash-nya sama, satu tabel pelangi bisa membuka semua akun yang
    // kebetulan memakai password populer yang sama.
    const a = await hashPassword('rahasia123');
    const b = await hashPassword('rahasia123');
    expect(a).not.toBe(b);
  });

  it('berbentuk salt:hash heksadesimal', async () => {
    expect(await hashPassword('rahasia123')).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });
});

describe('verifyPassword', () => {
  it('menerima password yang benar', async () => {
    const hash = await hashPassword('rahasia123');
    await expect(verifyPassword('rahasia123', hash)).resolves.toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hash = await hashPassword('rahasia123');
    await expect(verifyPassword('rahasia124', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('menolak hash cacat tanpa melempar', async () => {
    // Baris database yang rusak tidak boleh membuat seluruh endpoint login
    // melempar 500 — itu membocorkan bahwa akunnya ada, dan bikin ribut.
    await expect(verifyPassword('apa pun', 'bukan-format-yang-benar')).resolves.toBe(false);
    await expect(verifyPassword('apa pun', '')).resolves.toBe(false);
  });

  it('password panjang dan berkarakter unicode tetap bekerja', async () => {
    const password = 'sāndī-panjang-🎮-dengan-emoji';
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });
});

describe('newSessionToken', () => {
  it('cukup panjang dan tidak pernah berulang', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newSessionToken()));
    expect(tokens.size).toBe(200);
    expect([...tokens][0]).toHaveLength(64);
  });
});
