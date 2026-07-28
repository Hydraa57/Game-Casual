import { describe, expect, it } from 'vitest';
import { CLICKS_PER_LEVEL, MP_LEVEL_DURATION_MS } from '../constants/index';
import { levelFor } from './difficulty';
import { mpLevelProgress, soloLevelProgress } from './levelProgress';

describe('progres level solo', () => {
  it('kosong tepat setelah naik level, bukan penuh', () => {
    // Bar yang mulai penuh setelah naik level akan terbaca sebagai "hampir
    // naik lagi" dan langsung salah sejak detik pertama level baru.
    expect(soloLevelProgress(0).fraction).toBe(0);
    expect(soloLevelProgress(CLICKS_PER_LEVEL).fraction).toBe(0);
    expect(soloLevelProgress(CLICKS_PER_LEVEL * 7).fraction).toBe(0);
  });

  it('sisa klik tepat sebanyak yang dibutuhkan', () => {
    expect(soloLevelProgress(0).remaining).toBe(CLICKS_PER_LEVEL);
    expect(soloLevelProgress(1).remaining).toBe(CLICKS_PER_LEVEL - 1);
    expect(soloLevelProgress(CLICKS_PER_LEVEL - 1).remaining).toBe(1);
  });

  /**
   * Ini yang mengikat bar ke kenaikan level yang sesungguhnya.
   *
   * Kalau `levelFor` diubah nanti tanpa mengubah bar, pemain akan melihat bar
   * penuh tanpa naik level, atau naik level saat bar masih setengah — dan
   * keduanya membuat bar itu lebih buruk daripada tidak ada.
   */
  it('bar penuh persis saat levelFor naik', () => {
    for (let clicks = 0; clicks < CLICKS_PER_LEVEL * 5; clicks += 1) {
      const naikDiKlikBerikutnya = levelFor(clicks + 1) > levelFor(clicks);
      const barHampirPenuh = soloLevelProgress(clicks).remaining === 1;
      expect(barHampirPenuh).toBe(naikDiKlikBerikutnya);
    }
  });

  it('tidak pernah keluar dari 0..1', () => {
    for (let clicks = 0; clicks < 500; clicks += 1) {
      const { fraction } = soloLevelProgress(clicks);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1);
    }
  });

  it('klik negatif tidak membuat bar melar ke belakang', () => {
    expect(soloLevelProgress(-5).fraction).toBe(0);
  });
});

describe('progres level multiplayer', () => {
  it('kosong di awal match dan di tiap kelipatan durasi level', () => {
    expect(mpLevelProgress(0).fraction).toBe(0);
    expect(mpLevelProgress(MP_LEVEL_DURATION_MS).fraction).toBe(0);
    expect(mpLevelProgress(MP_LEVEL_DURATION_MS * 4).fraction).toBe(0);
  });

  it('setengah jalan tepat di tengah durasi level', () => {
    expect(mpLevelProgress(MP_LEVEL_DURATION_MS / 2).fraction).toBeCloseTo(0.5);
  });

  it('sisa waktu menghitung mundur menuju nol', () => {
    expect(mpLevelProgress(0).remaining).toBe(MP_LEVEL_DURATION_MS);
    expect(mpLevelProgress(MP_LEVEL_DURATION_MS - 1000).remaining).toBe(1000);
  });

  it('tidak pernah keluar dari 0..1 sepanjang match terpanjang', () => {
    for (let ms = 0; ms < 300_000; ms += 250) {
      const { fraction } = mpLevelProgress(ms);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1);
    }
  });
});
