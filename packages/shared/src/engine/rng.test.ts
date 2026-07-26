import { describe, expect, it } from 'vitest';
import { nextInRange, nextInt, nextRandom, pickOne, seedFromString } from './rng';

describe('nextRandom', () => {
  it('selalu menghasilkan nilai di [0, 1)', () => {
    let state = 12345;
    for (let i = 0; i < 1000; i += 1) {
      const result = nextRandom(state);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      state = result.state;
    }
  });

  it('deterministik: state yang sama memberi nilai yang sama', () => {
    expect(nextRandom(42).value).toBe(nextRandom(42).value);
  });

  it('state berubah sehingga pemanggilan berurutan tidak mengulang nilai', () => {
    const first = nextRandom(7);
    const second = nextRandom(first.state);
    expect(second.value).not.toBe(first.value);
  });

  it('sebaran cukup merata (rata-rata mendekati 0.5)', () => {
    let state = 999;
    let total = 0;
    const samples = 5000;
    for (let i = 0; i < samples; i += 1) {
      const result = nextRandom(state);
      total += result.value;
      state = result.state;
    }
    expect(total / samples).toBeCloseTo(0.5, 1);
  });
});

describe('nextInt', () => {
  it('menghasilkan bilangan bulat di [0, max)', () => {
    let state = 1;
    for (let i = 0; i < 500; i += 1) {
      const result = nextInt(state, 8);
      expect(Number.isInteger(result.value)).toBe(true);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(8);
      state = result.state;
    }
  });

  it('semua nilai dalam rentang benar-benar pernah muncul', () => {
    const seen = new Set<number>();
    let state = 3;
    for (let i = 0; i < 500; i += 1) {
      const result = nextInt(state, 6);
      seen.add(result.value);
      state = result.state;
    }
    expect(seen.size).toBe(6);
  });
});

describe('nextInRange', () => {
  it('menghasilkan nilai di [min, max)', () => {
    let state = 55;
    for (let i = 0; i < 500; i += 1) {
      const result = nextInRange(state, 8000, 12000);
      expect(result.value).toBeGreaterThanOrEqual(8000);
      expect(result.value).toBeLessThan(12000);
      state = result.state;
    }
  });
});

describe('pickOne', () => {
  it('selalu mengembalikan elemen dari array', () => {
    const items = ['a', 'b', 'c'] as const;
    let state = 17;
    for (let i = 0; i < 100; i += 1) {
      const result = pickOne(state, items);
      expect(items).toContain(result.value);
      state = result.state;
    }
  });

  it('melempar error untuk array kosong (selalu bug pemanggil)', () => {
    expect(() => pickOne(1, [])).toThrow(/kosong/);
  });
});

describe('seedFromString', () => {
  it('deterministik untuk string yang sama', () => {
    expect(seedFromString('ABCD12')).toBe(seedFromString('ABCD12'));
  });

  it('kode room berbeda memberi seed berbeda', () => {
    expect(seedFromString('ABCD12')).not.toBe(seedFromString('ABCD13'));
  });
});
