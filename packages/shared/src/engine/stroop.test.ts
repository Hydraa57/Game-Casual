import { describe, expect, it } from 'vitest';
import { ALL_COLORS, DUAL_TARGET_FIRST_LEVEL, STROOP_FIRST_LEVEL } from '../constants/index';
import { isStroopActive, stroopInkFor } from './stroop';

describe('mode Stroop', () => {
  it('mati sebelum STROOP_FIRST_LEVEL, hidup dari level itu', () => {
    expect(isStroopActive(STROOP_FIRST_LEVEL - 1)).toBe(false);
    expect(isStroopActive(STROOP_FIRST_LEVEL)).toBe(true);
    expect(isStroopActive(STROOP_FIRST_LEVEL + 30)).toBe(true);
  });

  it('datang setelah dua warna target, bukan bersamaan', () => {
    // Dua beban baru sekaligus tidak terasa sebagai tantangan, terasa sebagai
    // game yang rusak.
    expect(STROOP_FIRST_LEVEL).toBeGreaterThan(DUAL_TARGET_FIRST_LEVEL);
  });

  /**
   * Properti terpenting di file ini.
   *
   * Kalau tinta boleh sama dengan warna yang disebut katanya, konfliknya hilang
   * dan indikatornya kembali jadi petunjuk biasa — mode ini diam-diam tidak
   * melakukan apa pun pada sebagian periode target.
   */
  it('tinta tidak pernah sama dengan warna yang disebut', () => {
    for (const target of ALL_COLORS) {
      for (let seed = 0; seed < 400; seed += 1) {
        const [ink] = stroopInkFor([target], seed);
        expect(ink).not.toBe(target);
      }
    }
  });

  it('tinta juga menghindari warna target yang LAIN', () => {
    // "RED" bertinta hijau saat hijau juga sedang jadi target membuat pemain
    // benar dua kali dengan alasan yang salah.
    for (let seed = 0; seed < 400; seed += 1) {
      const targets = ['red', 'green'] as const;
      for (const ink of stroopInkFor(targets, seed)) {
        expect(targets).not.toContain(ink);
      }
    }
  });

  it('satu tinta untuk setiap kata', () => {
    expect(stroopInkFor(['red'], 1)).toHaveLength(1);
    expect(stroopInkFor(['red', 'blue'], 1)).toHaveLength(2);
  });

  it('deterministik: seed yang sama selalu memberi tinta yang sama', () => {
    // Kalau tidak, dua pemain di satu room mengerjakan soal yang berbeda sambil
    // memperebutkan papan yang sama.
    expect(stroopInkFor(['red', 'blue'], 12345)).toEqual(stroopInkFor(['red', 'blue'], 12345));
  });

  it('seed berbeda menghasilkan tinta yang berbeda-beda', () => {
    // Tinta yang selalu sama sepanjang ronde akan cepat dihafal, dan konfliknya
    // berhenti bekerja setelah beberapa periode target.
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) seen.add(stroopInkFor(['red'], seed)[0]!);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('dua kata pada satu periode tidak selalu bertinta sama', () => {
    let differed = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const [first, second] = stroopInkFor(['red', 'blue'], seed);
      if (first !== second) differed += 1;
    }
    expect(differed).toBeGreaterThan(0);
  });

  it('tinta selalu salah satu warna papan yang sah', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const ink of stroopInkFor(['red', 'blue'], seed)) {
        expect(ALL_COLORS).toContain(ink);
      }
    }
  });
});
