import { describe, expect, it } from 'vitest';
import {
  ALL_COLORS,
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  AVATAR_GLYPH,
  AVATAR_IDS,
  COLOR_GLYPH,
  COLOR_HEX,
  COLOR_UNLOCK_LEVELS,
  COMBO_MULTIPLIERS,
  KIND_GLYPH,
  DEFAULT_AVATAR,
  DEFAULT_ROOM_SETTINGS,
  GRID_SIZE,
  INITIAL_ACTIVE_COLORS,
  MAX_PLAYERS_LIMIT,
  MIN_LIFETIME_MS,
  MIN_PLAYERS_TO_START,
  MIN_SPAWN_INTERVAL_MS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  TARGET_MAX_DURATION_MS,
  TARGET_MIN_DURATION_MS,
  TOTAL_CELLS,
} from './game';

describe('konstanta papan & warna', () => {
  it('TOTAL_CELLS konsisten dengan GRID_SIZE', () => {
    expect(TOTAL_CELLS).toBe(GRID_SIZE * GRID_SIZE);
  });

  it('setiap warna punya hex dan glyph', () => {
    for (const color of ALL_COLORS) {
      expect(COLOR_HEX[color]).toBeTypeOf('number');
      expect(COLOR_GLYPH[color]).toBeTypeOf('string');
    }
    expect(Object.keys(COLOR_HEX)).toHaveLength(ALL_COLORS.length);
    expect(Object.keys(COLOR_GLYPH)).toHaveLength(ALL_COLORS.length);
  });

  it('glyph unik antar warna (agar tetap terbaca tanpa membedakan warna)', () => {
    const glyphs = Object.values(COLOR_GLYPH);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('glyph pixel spesial tidak bertabrakan dengan glyph warna', () => {
    // ★ pernah dipakai warna kuning sebelum pixel emas ada. Dua bentuk mirip di
    // papan yang sama merusak justru fungsi glyph itu sendiri, jadi kuning
    // dipindah ke ▼ dan test ini menjaga agar tabrakan serupa tidak terulang.
    const all = [...Object.values(COLOR_GLYPH), ...Object.values(KIND_GLYPH)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('setiap avatar punya glyph, dan glyph-nya unik antar avatar', () => {
    // Avatar dipakai untuk tahu SIAPA yang merebut sebuah sel. Dua avatar
    // dengan glyph sama membuat informasi itu menyesatkan, bukan cuma
    // membingungkan.
    for (const id of AVATAR_IDS) {
      expect(AVATAR_GLYPH[id]).toBeTypeOf('string');
    }
    const glyphs = AVATAR_IDS.map((id) => AVATAR_GLYPH[id]);
    expect(new Set(glyphs).size).toBe(AVATAR_IDS.length);
  });

  it('glyph avatar tidak bertabrakan dengan glyph papan', () => {
    // Avatar dicap DI ATAS papan yang penuh bentuk geometris. Kalau salah satu
    // avatar memakai bentuk yang sama, pemain akan membacanya sebagai warna
    // target atau pixel spesial.
    const boardGlyphs = new Set([...Object.values(COLOR_GLYPH), ...Object.values(KIND_GLYPH)]);
    for (const id of AVATAR_IDS) {
      expect(boardGlyphs.has(AVATAR_GLYPH[id])).toBe(false);
    }
  });

  it('jumlah avatar cukup untuk room yang paling penuh', () => {
    expect(AVATAR_IDS.length).toBeGreaterThanOrEqual(MAX_PLAYERS_LIMIT);
  });

  it('avatar default ada di dalam daftar', () => {
    expect(AVATAR_IDS).toContain(DEFAULT_AVATAR);
  });

  it('warna awal + jumlah unlock tepat mencapai seluruh warna', () => {
    expect(INITIAL_ACTIVE_COLORS + COLOR_UNLOCK_LEVELS.length).toBe(ALL_COLORS.length);
  });
});

describe('konstanta kurva kesulitan', () => {
  it('batas bawah lebih kecil dari nilai awal', () => {
    expect(MIN_SPAWN_INTERVAL_MS).toBeLessThan(INITIAL_SPAWN_INTERVAL_MS);
    expect(MIN_LIFETIME_MS).toBeLessThan(INITIAL_LIFETIME_MS);
  });

  it('pixel selalu hidup lebih lama dari jeda spawn di titik tersulit', () => {
    // Kalau tidak, papan bisa kosong terus-menerus dan game jadi hambar.
    expect(MIN_LIFETIME_MS).toBeGreaterThan(MIN_SPAWN_INTERVAL_MS);
  });

  it('durasi warna target masuk akal', () => {
    expect(TARGET_MIN_DURATION_MS).toBeLessThanOrEqual(TARGET_MAX_DURATION_MS);
  });
});

describe('konstanta skor & multiplayer', () => {
  it('combo multiplier menaik dan mulai dari 1', () => {
    expect(COMBO_MULTIPLIERS[0]).toBe(1);
    for (let i = 1; i < COMBO_MULTIPLIERS.length; i += 1) {
      expect(COMBO_MULTIPLIERS[i]!).toBeGreaterThan(COMBO_MULTIPLIERS[i - 1]!);
    }
  });

  it('DEFAULT_ROOM_SETTINGS berada dalam pilihan yang diizinkan', () => {
    expect(ALLOWED_TARGET_SCORES).toContain(DEFAULT_ROOM_SETTINGS.targetScore);
    expect(ALLOWED_TIME_LIMITS_SEC).toContain(DEFAULT_ROOM_SETTINGS.timeLimitSec);
    expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBeLessThanOrEqual(MAX_PLAYERS_LIMIT);
    expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBeGreaterThanOrEqual(MIN_PLAYERS_TO_START);
  });
});
