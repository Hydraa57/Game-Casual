import { describe, expect, it } from 'vitest';
import { hasDatabase } from '@pixelmatrix/db';
import { saveMatch } from './matchStore';
import type { FinishedMatch } from './matchStore';

const finished: FinishedMatch = {
  roomCode: 'ABC234',
  settings: { maxPlayers: 4, targetScore: 150, timeLimitSec: 120 },
  endReason: 'timeUp',
  startedAt: new Date('2026-07-27T02:00:00Z'),
  endedAt: new Date('2026-07-27T02:02:00Z'),
  ranking: [
    {
      playerId: 'p1',
      nickname: 'Budi',
      avatar: 'fox',
      score: 120,
      rank: 1,
      accuracy: 0.9,
      bestCombo: 7,
      knockouts: 0,
      eliminated: false,
    },
  ],
};

/**
 * Tes ini berjalan TANPA `DATABASE_URL`, dan itu memang skenario yang paling
 * penting dijaga: itulah konfigurasi produksi saat ini, dan cara main "buka
 * link, langsung main" bergantung padanya.
 */
describe('saveMatch tanpa database', () => {
  it('persistensi mati kalau DATABASE_URL tidak diset', () => {
    // Kalau ini gagal, ada sesuatu yang menyuntikkan DATABASE_URL diam-diam —
    // persis bug yang membuat klien Prisma memuat file .env saat di-import.
    expect(hasDatabase()).toBe(false);
  });

  it('mengembalikan false, bukan melempar', async () => {
    // Pemanggilnya ada di `Match.finish()`. Exception di sana akan mematikan
    // proses server dan mengusir SEMUA room lain yang sedang bermain — demi
    // satu baris riwayat yang gagal ditulis.
    await expect(saveMatch(finished)).resolves.toBe(false);
  });

  it('bisa dipanggil berkali-kali tanpa efek samping', async () => {
    await expect(saveMatch(finished)).resolves.toBe(false);
    await expect(saveMatch(finished)).resolves.toBe(false);
  });
});
