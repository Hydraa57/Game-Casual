import { describe, expect, it } from 'vitest';
import { MAX_CURVE_LEVEL, SOLO_STARTING_LIVES } from '../constants/index';
import { matchIntensity, soloIntensity } from './intensity';

const inRange = (value: number) => value >= 0 && value <= 1;

describe('ketegangan solo', () => {
  it('tenang di awal ronde', () => {
    expect(soloIntensity(1, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBe(0);
  });

  it('naik seiring level', () => {
    const early = soloIntensity(3, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES);
    const late = soloIntensity(15, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES);
    expect(late).toBeGreaterThan(early);
  });

  it('mentok di 1 pada level maksimal dan tidak melewatinya di atas itu', () => {
    expect(soloIntensity(MAX_CURVE_LEVEL, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBe(1);
    expect(soloIntensity(MAX_CURVE_LEVEL + 20, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBe(1);
  });

  /**
   * Ini yang membuat musiknya terasa benar, bukan sekadar naik-turun.
   *
   * Kalau ketegangan hanya mengikuti level, nyawa tinggal satu di level 3 akan
   * terdengar setenang jalan-jalan sore — padahal itu momen paling genting yang
   * bisa dialami pemain di level rendah.
   */
  it('nyawa tinggal satu terdengar genting walau levelnya masih rendah', () => {
    const tenang = soloIntensity(3, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES);
    const genting = soloIntensity(3, 1, SOLO_STARTING_LIVES);
    expect(genting).toBeGreaterThan(tenang);
    expect(genting).toBeGreaterThanOrEqual(0.75);
  });

  it('level tinggi tetap tegang walau nyawa penuh', () => {
    expect(soloIntensity(19, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBeGreaterThan(0.9);
  });

  it('mode tanpa nyawa jatuh ke kurva level saja', () => {
    expect(soloIntensity(11, null, 0)).toBeCloseTo(soloIntensity(11, 3, 3), 5);
  });

  it('tidak pernah keluar dari 0..1', () => {
    for (let level = -5; level <= 40; level += 1) {
      for (let lives = 0; lives <= 5; lives += 1) {
        expect(inRange(soloIntensity(level, lives, SOLO_STARTING_LIVES))).toBe(true);
      }
    }
  });
});

describe('ketegangan multiplayer', () => {
  const LIMIT = 180_000;

  it('tenang di awal match', () => {
    expect(matchIntensity(0, 1000, LIMIT, LIMIT)).toBe(0);
  });

  it('naik seiring skor mendekati target', () => {
    expect(matchIntensity(500, 1000, LIMIT, LIMIT)).toBeCloseTo(0.5, 5);
    expect(matchIntensity(900, 1000, LIMIT, LIMIT)).toBeCloseTo(0.9, 5);
  });

  it('mentok di 1 saat target tercapai atau terlampaui', () => {
    expect(matchIntensity(1000, 1000, LIMIT, LIMIT)).toBe(1);
    expect(matchIntensity(1500, 1000, LIMIT, LIMIT)).toBe(1);
  });

  /**
   * Yang dipakai skor TERTINGGI siapa pun, bukan skor pemain ini — dan test ini
   * merekam alasannya. Ketegangan terbesar justru saat lawan hampir menang.
   * Musik yang mengikuti skor sendiri akan terdengar paling tenang tepat di
   * momen paling genting.
   */
  it('lawan yang hampir menang terdengar sama tegangnya', () => {
    expect(matchIntensity(950, 1000, LIMIT, LIMIT)).toBeGreaterThan(0.9);
  });

  it('tekanan waktu diam sampai seperempat terakhir', () => {
    // Setengah waktu habis, skor masih nol: belum ada alasan untuk tegang.
    expect(matchIntensity(0, 1000, LIMIT * 0.5, LIMIT)).toBe(0);
    expect(matchIntensity(0, 1000, LIMIT * 0.3, LIMIT)).toBe(0);
  });

  it('tekanan waktu naik di detik-detik terakhir', () => {
    const seperempat = matchIntensity(0, 1000, LIMIT * 0.25, LIMIT);
    const sedikit = matchIntensity(0, 1000, LIMIT * 0.1, LIMIT);
    expect(seperempat).toBe(0);
    expect(sedikit).toBeGreaterThan(0.5);
    expect(matchIntensity(0, 1000, 0, LIMIT)).toBe(1);
  });

  it('yang tertinggi antara balapan skor dan tekanan waktu yang dipakai', () => {
    // Skor jauh dari target tapi waktu nyaris habis: tetap harus tegang.
    expect(matchIntensity(100, 1000, LIMIT * 0.02, LIMIT)).toBeGreaterThan(0.9);
  });

  it('tidak pernah keluar dari 0..1', () => {
    for (const score of [-100, 0, 250, 1000, 99_999]) {
      for (const left of [-1000, 0, LIMIT / 2, LIMIT, LIMIT * 2]) {
        expect(inRange(matchIntensity(score, 1000, left, LIMIT))).toBe(true);
      }
    }
  });

  it('pengaturan nol tidak menghasilkan NaN', () => {
    expect(inRange(matchIntensity(0, 0, 0, 0))).toBe(true);
  });
});
