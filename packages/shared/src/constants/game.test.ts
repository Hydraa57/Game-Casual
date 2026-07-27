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
  COMBO_STEP,
  KIND_GLYPH,
  DEFAULT_AVATAR,
  DEFAULT_ROOM_SETTINGS,
  GOLD_POINT_MULTIPLIER,
  GRID_SIZE,
  INITIAL_ACTIVE_COLORS,
  MAX_CLAIMABLE_SOLO_SCORE,
  MAX_CLICKS_PER_SECOND,
  MAX_CURVE_LEVEL,
  MAX_PLAUSIBLE_SOLO_SECONDS,
  MAX_POINTS_PER_SECOND,
  MAX_PLAYERS_LIMIT,
  MP_LEADER_POINTS_PER_SECOND,
  MP_LEVEL_DURATION_MS,
  MIN_LIFETIME_MS,
  MIN_PLAYERS_TO_START,
  MIN_SPAWN_INTERVAL_MS,
  INITIAL_LIFETIME_MS,
  INITIAL_SPAWN_INTERVAL_MS,
  TARGET_MAX_DURATION_MS,
  TARGET_MIN_DURATION_MS,
  TOTAL_CELLS,
} from './game';
import { pointsForClick } from '../engine/scoring';

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

  /**
   * Ini mengunci arah pertidaksamaannya: batas kewajaran harus selalu di ATAS
   * apa yang benar-benar bisa dicetak engine. Kalau terbalik, endpoint skor
   * solo akan menolak ronde jujur dan menyebutnya curang — kegagalan yang jauh
   * lebih buruk daripada meloloskan skor palsu, dan yang persis pernah terjadi
   * saat rumusnya melewatkan satu multiplier.
   */
  it('MAX_POINTS_PER_SECOND tidak pernah di bawah maksimum nyata engine', () => {
    // Klik paling mahal yang mungkin: baru muncul (speed bonus penuh), combo
    // sudah di tingkat teratas, di level tempat kurva mentok, dan pixel emas.
    const bestClick =
      pointsForClick(1, COMBO_STEP * COMBO_MULTIPLIERS.length, MAX_CURVE_LEVEL) *
      GOLD_POINT_MULTIPLIER;

    expect(MAX_POINTS_PER_SECOND).toBeGreaterThanOrEqual(bestClick * MAX_CLICKS_PER_SECOND);
  });

  it('MAX_CLAIMABLE_SOLO_SCORE jauh di atas skor yang realistis', () => {
    expect(MAX_CLAIMABLE_SOLO_SCORE).toBe(MAX_POINTS_PER_SECOND * MAX_PLAUSIBLE_SOLO_SECONDS);
    // Rekor sungguhan di game ini berada di orde ribuan. Plafonnya harus
    // longgar sekali supaya tidak pernah menyentuh pemain jujur, tapi tetap
    // berhingga supaya angka absurd tidak bisa nyangkut di leaderboard.
    expect(MAX_CLAIMABLE_SOLO_SCORE).toBeGreaterThan(1_000_000);
    expect(Number.isFinite(MAX_CLAIMABLE_SOLO_SCORE)).toBe(true);
  });

  it('DEFAULT_ROOM_SETTINGS berada dalam pilihan yang diizinkan', () => {
    expect(ALLOWED_TARGET_SCORES).toContain(DEFAULT_ROOM_SETTINGS.targetScore);
    expect(ALLOWED_TIME_LIMITS_SEC).toContain(DEFAULT_ROOM_SETTINGS.timeLimitSec);
    expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBeLessThanOrEqual(MAX_PLAYERS_LIMIT);
    expect(DEFAULT_ROOM_SETTINGS.maxPlayers).toBeGreaterThanOrEqual(MIN_PLAYERS_TO_START);
  });

  it('pilihan target skor & batas waktu terurut menaik', () => {
    // Keduanya ditampilkan apa adanya sebagai tombol pilihan host, jadi urutan
    // di array ini adalah urutan yang dilihat pemain.
    for (let i = 1; i < ALLOWED_TARGET_SCORES.length; i += 1) {
      expect(ALLOWED_TARGET_SCORES[i]!).toBeGreaterThan(ALLOWED_TARGET_SCORES[i - 1]!);
    }
    for (let i = 1; i < ALLOWED_TIME_LIMITS_SEC.length; i += 1) {
      expect(ALLOWED_TIME_LIMITS_SEC[i]!).toBeGreaterThan(ALLOWED_TIME_LIMITS_SEC[i - 1]!);
    }
  });

  /**
   * Ini menjaga hal yang sudah pernah rusak sekali, dan menjaga penyebabnya
   * yang sebenarnya.
   *
   * Level multiplayer naik menurut WAKTU, jadi target skor menentukan seberapa
   * jauh kurva kesulitan sempat berjalan. Dengan target lama (150) match
   * berakhir di 23 detik pada level 2: warna keempat, bom, dan dua warna target
   * tidak pernah sekali pun muncul di multiplayer — seluruh isi Fase 1.5 tidak
   * ada di mode yang justru paling penting.
   *
   * Percobaan pertama test ini menguji BATAS WAKTU, dan itu tidak menangkap
   * apa pun: batas lama 120 dtk sanggup mencapai 8 level, jadi angka yang rusak
   * tetap lolos. Yang rusak target skornya. Karena itu di sini target skor
   * diterjemahkan dulu ke durasi lewat MP_LEADER_POINTS_PER_SECOND.
   */
  it('target skor cukup tinggi untuk membuat kurva kesulitan berjalan', () => {
    const levelReached = (target: number) =>
      1 + Math.floor(((target / MP_LEADER_POINTS_PER_SECOND) * 1000) / MP_LEVEL_DURATION_MS);

    // Pilihan tercepat pun harus melewati bukaan warna pertama, kalau tidak
    // match selesai sebelum papan berubah sedikit pun.
    expect(levelReached(ALLOWED_TARGET_SCORES[0])).toBeGreaterThanOrEqual(COLOR_UNLOCK_LEVELS[0]);
    // Default harus melewati bukaan warna kedua.
    expect(levelReached(DEFAULT_ROOM_SETTINGS.targetScore)).toBeGreaterThanOrEqual(
      COLOR_UNLOCK_LEVELS[1],
    );
  });

  /**
   * Batas waktu adalah jaring pengaman, bukan cara normal match berakhir.
   * Kalau ia lebih pendek dari waktu yang dibutuhkan untuk mencapai target,
   * match habis waktu sebelum garis finis dan "siapa yang lebih cepat" tidak
   * pernah terjawab.
   */
  it('batas waktu terpanjang memberi ruang untuk target tertinggi', () => {
    const slowestTarget = ALLOWED_TARGET_SCORES[ALLOWED_TARGET_SCORES.length - 1]!;
    const longestLimit = ALLOWED_TIME_LIMITS_SEC[ALLOWED_TIME_LIMITS_SEC.length - 1]!;
    expect(longestLimit).toBeGreaterThan(slowestTarget / MP_LEADER_POINTS_PER_SECOND);
  });

  it('batas waktu default memberi ruang untuk target default', () => {
    expect(DEFAULT_ROOM_SETTINGS.timeLimitSec).toBeGreaterThan(
      DEFAULT_ROOM_SETTINGS.targetScore / MP_LEADER_POINTS_PER_SECOND,
    );
  });
});
