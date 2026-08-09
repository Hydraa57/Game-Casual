import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, SERVER_TICK_MS } from '@pixelmatrix/shared';
import type { BotDifficulty, Color, Pixel } from '@pixelmatrix/shared';
import { BotDriver } from './BotDriver';

/**
 * Pixel yang sudah lama ada di papan, jadi bot pasti sudah "melihat"-nya
 * berapa pun waktu reaksinya.
 */
function pixel(id: string, color: Color): Pixel {
  return {
    id,
    cell: { row: 0, col: 0 },
    color,
    kind: 'normal',
    spawnedAtMs: 0,
    lifetimeMs: 10_000_000,
  };
}

/**
 * Jalankan bot di papan yang TIDAK BERUBAH selama sekian detik, ditick dengan
 * frekuensi yang sama persis dengan server, lalu hitung berapa kali ia mengetuk.
 */
function ketukanDalam(
  difficulty: BotDifficulty,
  papan: readonly Pixel[],
  targetColors: readonly Color[],
  durasiMs: number,
): number {
  const driver = new BotDriver('bot', difficulty);
  let ketukan = 0;
  for (let t = 2000; t < 2000 + durasiMs; t += SERVER_TICK_MS) {
    if (driver.step(papan, targetColors, t) !== null) ketukan += 1;
  }
  return ketukan;
}

describe('irama keputusan bot', () => {
  /**
   * Ini mengunci bug yang pernah mengakhiri hampir SEMUA match multiplayer
   * berbot dalam ~60 detik.
   *
   * Peluang salah diundi di dalam `pickBotTarget`. Versi lama `BotDriver` hanya
   * memajukan jam iramanya kalau bot benar-benar mengetuk, jadi selama papan
   * cuma berisi warna salah, undian itu diulang 20 kali per detik. Akurasi
   * 98,5% berubah jadi "1,5% tiap 50 ms", dan bot yang menunggu warna target
   * praktis pasti akhirnya mengetuk yang salah — tiga KO, tereliminasi, match
   * bubar sebelum kurva kesulitannya sempat jalan.
   *
   * Diuji dari LAJU, bukan dari implementasinya: berapa pun cara di dalamnya,
   * bot berakurasi 98,5% tidak boleh menghasilkan lebih dari beberapa ketukan
   * salah dalam satu menit menghadapi papan yang seluruhnya warna salah.
   */
  it('tidak mengetuk warna salah bertubi-tubi saat tidak ada warna target', () => {
    const salahSemua = [pixel('a', 'blue'), pixel('b', 'red'), pixel('c', 'green')];
    const semenit = 60_000;

    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ketukan = ketukanDalam(difficulty, salahSemua, ['yellow'], semenit);

      // Batas atas yang diturunkan dari profilnya sendiri, bukan angka hafalan:
      // satu keputusan per `tapIntervalMs`, masing-masing dengan peluang salah
      // (1 - accuracy). Kelonggaran 4x menampung ragam undian acak.
      const profile = BOT_PROFILES[difficulty];
      const keputusan = semenit / profile.tapIntervalMs;
      const wajar = keputusan * (1 - profile.accuracy) * 4;

      expect(ketukan).toBeLessThanOrEqual(Math.ceil(wajar));

      // Dan bandingkan dengan laju lama yang rusak: satu undian per TICK.
      const lamaYangRusak = (semenit / SERVER_TICK_MS) * (1 - profile.accuracy);
      expect(ketukan).toBeLessThan(lamaYangRusak / 2);
    }
  });

  it('tetap mengetuk secepat iramanya saat warna target tersedia', () => {
    // Sisi lain dari perbaikan yang sama: memperlambat undian salah tidak boleh
    // ikut memperlambat bot saat ada yang benar untuk diketuk.
    const adaTarget = [pixel('a', 'blue'), pixel('b', 'yellow')];
    const durasi = 10_000;
    const ketukan = ketukanDalam('medium', adaTarget, ['yellow'], durasi);
    const maksimum = durasi / BOT_PROFILES.medium.tapIntervalMs;

    expect(ketukan).toBeGreaterThanOrEqual(Math.floor(maksimum * 0.9));
    expect(ketukan).toBeLessThanOrEqual(Math.ceil(maksimum));
  });

  it('papan kosong tidak memakai jatah iramanya', () => {
    // Bot yang menunggu spawn tidak sedang menahan diri — ia memang tidak punya
    // pilihan. Kalau papan kosong ikut memakan irama, bot akan telat satu beat
    // setiap kali pixel pertama muncul.
    const driver = new BotDriver('bot', 'hard');
    expect(driver.step([], ['yellow'], 1000)).toBeNull();
    // Pixel muncul di tick berikutnya dan sudah lama terlihat: harus langsung
    // bisa diketuk, tanpa menunggu tapIntervalMs.
    expect(driver.step([pixel('a', 'yellow')], ['yellow'], 1000 + SERVER_TICK_MS)).toBe('a');
  });
});
