import { describe, expect, it } from 'vitest';
import { MP_FREEZE_MS, MP_MAX_KNOCKOUTS } from '@pixelmatrix/shared';
import {
  hasThawed,
  isEliminatedAfter,
  isFrozen,
  shouldEndByElimination,
  shouldFreeze,
} from './freeze';

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

describe('isEliminatedAfter', () => {
  it('KO sebelum yang terakhir hanya membekukan', () => {
    expect(isEliminatedAfter(1, MP_MAX_KNOCKOUTS)).toBe(false);
    expect(isEliminatedAfter(2, MP_MAX_KNOCKOUTS)).toBe(false);
  });

  it('KO ke-MP_MAX_KNOCKOUTS mengeliminasi', () => {
    expect(isEliminatedAfter(MP_MAX_KNOCKOUTS, MP_MAX_KNOCKOUTS)).toBe(true);
  });

  it('lebih dari batas tetap tereliminasi', () => {
    // Tidak seharusnya terjadi (pemain berhenti bisa mengetuk setelah
    // tereliminasi), tapi jangan sampai malah membebaskannya kembali.
    expect(isEliminatedAfter(MP_MAX_KNOCKOUTS + 1, MP_MAX_KNOCKOUTS)).toBe(true);
  });
});

describe('shouldEndByElimination', () => {
  it('dua pemain, satu tereliminasi → match selesai', () => {
    // Inilah aturan "main berdua, tereliminasi = langsung kalah". Tidak perlu
    // kasus khusus untuk dua pemain: yang diperiksa hanya sisa pemain aktif.
    expect(shouldEndByElimination(1)).toBe(true);
  });

  it('empat pemain, satu tereliminasi → match jalan terus', () => {
    expect(shouldEndByElimination(3)).toBe(false);
    expect(shouldEndByElimination(2)).toBe(false);
  });

  it('semua tereliminasi → match tetap harus berhenti', () => {
    // Kalau tidak, papan berjalan tanpa siapa pun yang bisa mengetuk sampai
    // waktu habis.
    expect(shouldEndByElimination(0)).toBe(true);
  });
});
