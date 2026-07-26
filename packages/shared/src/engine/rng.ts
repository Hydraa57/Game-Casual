/**
 * PRNG deterministik (mulberry32) dalam bentuk pure function.
 *
 * State-nya sengaja diteruskan masuk-keluar, bukan disimpan di closure, supaya
 * seluruh state game bisa disalin & di-replay: seed yang sama selalu
 * menghasilkan urutan pixel yang sama. Ini yang bikin engine-nya bisa diuji
 * dengan tepat, dan nanti bikin match multiplayer bisa direproduksi kalau ada
 * laporan bug.
 */

export interface RandomResult<T> {
  readonly value: T;
  readonly state: number;
}

/** Angka acak di rentang [0, 1). */
export function nextRandom(state: number): RandomResult<number> {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: a };
}

/** Bilangan bulat di rentang [0, maxExclusive). */
export function nextInt(state: number, maxExclusive: number): RandomResult<number> {
  const next = nextRandom(state);
  return { value: Math.floor(next.value * maxExclusive), state: next.state };
}

/** Angka pecahan di rentang [min, max). */
export function nextInRange(state: number, min: number, max: number): RandomResult<number> {
  const next = nextRandom(state);
  return { value: min + next.value * (max - min), state: next.state };
}

/**
 * Ambil satu elemen acak dari array yang tidak boleh kosong.
 * Melempar error kalau kosong — itu selalu bug pemanggil, bukan kondisi normal.
 */
export function pickOne<T>(state: number, items: readonly T[]): RandomResult<T> {
  if (items.length === 0) {
    throw new Error('pickOne: array kosong');
  }
  const next = nextInt(state, items.length);
  return { value: items[next.value]!, state: next.state };
}

/** Ubah string apa pun (mis. kode room) menjadi seed numerik. */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
