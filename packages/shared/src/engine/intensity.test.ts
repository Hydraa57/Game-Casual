import { describe, expect, it } from 'vitest';
import {
  MP_SCORE_WARNING_RATIO,
  MP_TIME_WARNING_MS,
  SOLO_STARTING_LIVES,
} from '../constants/index';
import { matchIntensity, soloIntensity } from './intensity';

const inRange = (value: number) => value >= 0 && value <= 1;

/**
 * Aturan yang dijaga seluruh berkas ini: KETEGANGAN ADALAH PENGECUALIAN.
 *
 * Versi pertama menaikkannya terus-menerus — mengikuti skor di multiplayer dan
 * mengikuti level di solo — sehingga musik sudah setengah tegang di menit
 * pertama dan tidak pernah kembali ceria. Pemain melaporkannya sebagai
 * "backsound-nya menegangkan terus". Test di bawah menahan supaya perilaku itu
 * tidak diam-diam kembali lewat penyesuaian angka.
 */

describe('ketegangan solo', () => {
  it('tenang selama nyawanya masih aman', () => {
    expect(soloIntensity(1, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBe(0);
  });

  /**
   * Yang paling penting di blok ini.
   *
   * Level yang naik memang membuat papan lebih sulit — tapi "lebih sulit" bukan
   * "hampir kalah", dan cuma yang kedua yang layak mengubah musiknya. Kalau ini
   * gagal, musik solo akan kembali tegang permanen mulai pertengahan ronde.
   */
  it('level tinggi TIDAK membuatnya tegang selama nyawanya penuh', () => {
    for (const level of [1, 5, 12, 19, 25, 40]) {
      expect(soloIntensity(level, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES)).toBe(0);
    }
  });

  it('nyawa tinggal satu terdengar genting walau levelnya masih rendah', () => {
    const tenang = soloIntensity(3, SOLO_STARTING_LIVES, SOLO_STARTING_LIVES);
    const genting = soloIntensity(3, 1, SOLO_STARTING_LIVES);
    expect(genting).toBeGreaterThan(tenang);
    expect(genting).toBeGreaterThanOrEqual(0.75);
  });

  it('dua nyawa terasa, tapi belum segenting satu nyawa', () => {
    const dua = soloIntensity(5, 2, SOLO_STARTING_LIVES);
    const satu = soloIntensity(5, 1, SOLO_STARTING_LIVES);
    expect(dua).toBeGreaterThan(0);
    expect(dua).toBeLessThan(satu);
  });

  it('mode tanpa nyawa selalu tenang', () => {
    // Multiplayer memakai jalur `matchIntensity`; solo tanpa nyawa tidak punya
    // apa pun yang bisa membuatnya genting.
    expect(soloIntensity(11, null, 0)).toBe(0);
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

  /**
   * Inti permintaan pemain: "backsound menegangkan cuma kalau waktunya sudah
   * mau habis". Setengah match berlalu dengan skor separuh target harus tetap
   * terdengar ceria.
   */
  it('tetap ceria di tengah match walau skornya sudah separuh target', () => {
    expect(matchIntensity(500, 1000, LIMIT * 0.5, LIMIT)).toBe(0);
    expect(matchIntensity(800, 1000, LIMIT * 0.4, LIMIT)).toBe(0);
  });

  it('tegang saat ada yang hampir menyentuh target', () => {
    const ambang = MP_SCORE_WARNING_RATIO * 1000;
    expect(matchIntensity(ambang, 1000, LIMIT, LIMIT)).toBe(0);
    expect(matchIntensity(ambang + 50, 1000, LIMIT, LIMIT)).toBeGreaterThan(0);
    expect(matchIntensity(1000, 1000, LIMIT, LIMIT)).toBe(1);
  });

  /**
   * Yang dipakai skor TERTINGGI siapa pun, bukan skor pemain ini. Ketegangan
   * terbesar justru saat LAWAN hampir menang, dan musik yang mengikuti skor
   * sendiri akan terdengar paling tenang tepat di momen paling genting.
   */
  it('lawan yang hampir menang terdengar sama tegangnya', () => {
    expect(matchIntensity(990, 1000, LIMIT, LIMIT)).toBeGreaterThan(0.8);
  });

  it('tekanan waktu diam sampai babak akhir, lalu naik', () => {
    expect(matchIntensity(0, 1000, MP_TIME_WARNING_MS + 1000, LIMIT)).toBe(0);
    expect(matchIntensity(0, 1000, MP_TIME_WARNING_MS / 2, LIMIT)).toBeCloseTo(0.5, 5);
    expect(matchIntensity(0, 1000, 0, LIMIT)).toBe(1);
  });

  /**
   * Ambangnya dibagi dengan tampilan (angka waktu berdenyut, spanduk babak
   * akhir). Kalau musik memakai angkanya sendiri, layar dan suara akan berubah
   * di detik yang berbeda dan keduanya berhenti terasa sebagai satu kejadian.
   */
  it('mulai tegang tepat di ambang yang dipakai tampilan', () => {
    expect(matchIntensity(0, 1000, MP_TIME_WARNING_MS, LIMIT)).toBe(0);
    expect(matchIntensity(0, 1000, MP_TIME_WARNING_MS - 1, LIMIT)).toBeGreaterThan(0);
  });

  it('yang tertinggi antara balapan skor dan tekanan waktu yang dipakai', () => {
    // Skor jauh dari target tapi waktu nyaris habis: tetap harus tegang.
    expect(matchIntensity(100, 1000, 500, LIMIT)).toBeGreaterThan(0.9);
  });

  it('batas waktu match tidak lagi mempengaruhi hasilnya', () => {
    // Ambangnya absolut (15 detik terakhir), bukan proporsi dari lama match.
    // Match 90 detik dan match 300 detik sama-sama menegang di 15 detik
    // terakhir — bukan di 22 detik versus 75 detik terakhir.
    const a = matchIntensity(0, 1000, 5000, 90_000);
    const b = matchIntensity(0, 1000, 5000, 300_000);
    expect(a).toBe(b);
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
