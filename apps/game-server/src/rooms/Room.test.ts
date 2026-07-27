import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '@pixelmatrix/shared';
import { normalizeSettings } from './Room';

describe('normalizeSettings', () => {
  /**
   * Test yang paling penting di file ini.
   *
   * Kalau lapisan validasi meloloskan sebuah pilihan tapi normalisasi
   * mengubahnya, hasilnya adalah kegagalan yang paling buruk jenisnya: host
   * memilih sesuatu, mendapat yang lain, dan tidak ada error di mana pun. Itu
   * persis yang terjadi ketika daftar target skor dinaikkan sampai 1500
   * sementara batas atas clamp masih 1000 — dan tidak ada satu pun test yang
   * menangkapnya.
   */
  it('setiap pilihan yang diizinkan lolos tanpa berubah nilainya', () => {
    for (const targetScore of ALLOWED_TARGET_SCORES) {
      expect(normalizeSettings({ targetScore }).targetScore).toBe(targetScore);
    }
    for (const timeLimitSec of ALLOWED_TIME_LIMITS_SEC) {
      expect(normalizeSettings({ timeLimitSec }).timeLimitSec).toBe(timeLimitSec);
    }
    for (let maxPlayers = MIN_PLAYERS_TO_START; maxPlayers <= MAX_PLAYERS_LIMIT; maxPlayers += 1) {
      expect(normalizeSettings({ maxPlayers }).maxPlayers).toBe(maxPlayers);
    }
  });

  it('tanpa patch menghasilkan pengaturan default', () => {
    expect(normalizeSettings()).toEqual(DEFAULT_ROOM_SETTINGS);
  });

  it('nilai di luar rentang dijepit, bukan diterima', () => {
    // Zod sudah menolak nilai-nilai ini di lapisan net; clamp adalah jaring
    // kedua untuk pemanggil internal yang tidak lewat sana.
    expect(normalizeSettings({ maxPlayers: 99 }).maxPlayers).toBe(MAX_PLAYERS_LIMIT);
    expect(normalizeSettings({ maxPlayers: 0 }).maxPlayers).toBe(MIN_PLAYERS_TO_START);
    expect(normalizeSettings({ targetScore: 10_000 }).targetScore).toBe(
      Math.max(...ALLOWED_TARGET_SCORES),
    );
    expect(normalizeSettings({ timeLimitSec: 1 }).timeLimitSec).toBe(
      Math.min(...ALLOWED_TIME_LIMITS_SEC),
    );
  });

  it('nilai bukan-angka jatuh ke batas bawah, tidak menghasilkan NaN', () => {
    // NaN yang lolos ke pengaturan match akan membuat perbandingan skor selalu
    // false, dan match tidak akan pernah berakhir.
    const settings = normalizeSettings({
      maxPlayers: Number.NaN,
      targetScore: Number.POSITIVE_INFINITY,
      timeLimitSec: Number.NaN,
    });
    expect(settings.maxPlayers).toBe(MIN_PLAYERS_TO_START);
    expect(settings.targetScore).toBe(Math.min(...ALLOWED_TARGET_SCORES));
    expect(settings.timeLimitSec).toBe(Math.min(...ALLOWED_TIME_LIMITS_SEC));
  });
});
