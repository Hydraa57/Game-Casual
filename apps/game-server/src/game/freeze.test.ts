import { describe, expect, it } from 'vitest';
import { MP_FREEZE_MS } from '@pixelmatrix/shared';
import { hasThawed, isFrozen, shouldFreeze } from './freeze';

describe('shouldFreeze', () => {
  it('nyawa habis dan belum beku → beku', () => {
    expect(shouldFreeze(0, 0)).toBe(true);
  });

  it('masih punya nyawa → tidak beku', () => {
    expect(shouldFreeze(1, 0)).toBe(false);
    expect(shouldFreeze(3, 0)).toBe(false);
  });

  it('sudah beku → tidak dibekukan ulang', () => {
    // Selama beku nyawa memang masih 0. Tanpa penjagaan ini, tick berikutnya
    // menyetel ulang timernya dan pemain tidak pernah hidup lagi.
    expect(shouldFreeze(0, 12_345)).toBe(false);
  });

  it('mode tanpa nyawa tidak pernah membekukan siapa pun', () => {
    expect(shouldFreeze(null, 0)).toBe(false);
  });
});

describe('isFrozen', () => {
  it('beku selama waktunya belum lewat', () => {
    expect(isFrozen(1000, 999)).toBe(true);
    expect(isFrozen(1000, 1001)).toBe(false);
  });

  it('tepat di batas waktu sudah dianggap bebas', () => {
    // Batas yang sama dipakai `hasThawed`, jadi tidak ada milidetik di mana
    // pemain terhitung beku DAN sudah cair sekaligus.
    expect(isFrozen(1000, 1000)).toBe(false);
    expect(hasThawed(1000, 1000)).toBe(true);
  });

  it('nol berarti tidak beku', () => {
    expect(isFrozen(0, 0)).toBe(false);
    expect(isFrozen(0, 999_999)).toBe(false);
  });
});

describe('hasThawed', () => {
  it('pemain yang tidak pernah beku TIDAK dianggap perlu dihidupkan', () => {
    // Kalau ini true, setiap pemain sehat akan "dihidupkan" tiap tick — dan
    // combo mereka di-reset 20 kali per detik.
    expect(hasThawed(0, 999_999)).toBe(false);
  });

  it('belum lewat waktunya → belum cair', () => {
    expect(hasThawed(2000, 1500)).toBe(false);
  });

  it('siklus penuh: beku lalu cair setelah MP_FREEZE_MS', () => {
    const now = 10_000;
    const until = now + MP_FREEZE_MS;

    expect(isFrozen(until, now)).toBe(true);
    expect(hasThawed(until, now)).toBe(false);

    expect(isFrozen(until, now + MP_FREEZE_MS - 1)).toBe(true);
    expect(hasThawed(until, now + MP_FREEZE_MS)).toBe(true);
  });
});
