import { describe, expect, it } from 'vitest';
import {
  MP_PING_EQUALIZE_CAP_MS,
  MP_PING_EQUALIZE_MIN_MS,
  SERVER_TICK_MS,
} from '../constants/index';
import { equalizeDelayMs, referenceLatencyMs } from './fairness';

describe('ping acuan', () => {
  it('memakai yang terburuk di antara yang terukur', () => {
    expect(referenceLatencyMs([30, 240, 90])).toBe(240);
  });

  it('mengabaikan yang belum terukur dan yang tidak punya jaringan', () => {
    // `null` = bot atau pemain yang baru masuk. Kalau ikut dihitung sebagai 0,
    // satu bot di room sudah cukup untuk membuat acuannya nol dan mematikan
    // penyetaraan buat semua orang.
    expect(referenceLatencyMs([null, 240, null])).toBe(240);
    expect(referenceLatencyMs([null, null])).toBe(0);
    expect(referenceLatencyMs([])).toBe(0);
  });
});

describe('penahanan penyetaraan', () => {
  it('menahan yang cepat sebesar separuh selisihnya', () => {
    // Ping pulang-pergi 240 vs 40 → selisih satu arah 100 ms.
    expect(equalizeDelayMs(40, 240, 1000)).toBe(100);
  });

  it('tidak pernah menahan yang paling lambat', () => {
    expect(equalizeDelayMs(240, 240)).toBe(0);
    // Dan tidak pernah negatif, walau pingnya sempat terukur di atas acuan
    // (acuan dihitung dari potret yang bisa saja sedikit lebih tua).
    expect(equalizeDelayMs(300, 240)).toBe(0);
  });

  it('dibatasi supaya yang pingnya bagus tidak ikut dibuat lambat', () => {
    // Koneksi satu orang yang benar-benar buruk tidak boleh menyeret seisi
    // room ke kecepatannya. Ini pembeda antara "memperkecil jurang" dan
    // "meratakan semua orang ke yang terburuk".
    expect(equalizeDelayMs(20, 2000)).toBe(MP_PING_EQUALIZE_CAP_MS);
  });

  it('memperlakukan bot sebagai pihak tercepat, bukan sebagai yang tidak terukur', () => {
    // Bot berjalan di dalam proses server: nol jaringan. Tanpa penyetaraan ia
    // justru pihak yang paling diuntungkan di papan rebutan.
    expect(equalizeDelayMs(null, 200)).toBe(MP_PING_EQUALIZE_CAP_MS);
    expect(equalizeDelayMs(null, 0)).toBe(0);
  });

  it('batasnya lebih besar dari satu tick server', () => {
    // Antrean dikuras di awal tick. Batas di bawah satu tick akan tertelan
    // pembulatan, dan fiturnya cuma ada di atas kertas.
    expect(MP_PING_EQUALIZE_CAP_MS).toBeGreaterThan(SERVER_TICK_MS);
    expect(MP_PING_EQUALIZE_MIN_MS).toBe(SERVER_TICK_MS);
  });

  it('sama sekali tidak menahan saat semua orang sama cepatnya', () => {
    /*
      Room yang semua pemainnya satu WiFi: tidak ada jurang untuk diperkecil,
      dan penahanan apa pun di situ murni kerugian.

      Nol, bukan "kecil". Versi pertama membulatkan selisih 5 ms jadi penahanan
      3 ms — dan karena antrean dikuras per tick, penahanan 3 ms pada praktiknya
      menahan sampai 50 ms. Yang pingnya 45 ms justru kalah rebutan dari yang
      50 ms: kebalikan dari tujuan fiturnya.
    */
    const sama = [45, 48, 44, 46, 50];
    const acuan = referenceLatencyMs(sama);
    for (const ping of sama) expect(equalizeDelayMs(ping, acuan)).toBe(0);
  });

  it('menahan hanya kalau selisihnya sepadan dengan resolusi tick', () => {
    // Tepat di ambang: selisih satu arah 50 ms = satu tick penuh.
    expect(equalizeDelayMs(100, 200)).toBe(50);
    // Sedikit di bawahnya: tidak dijalankan sama sekali.
    expect(equalizeDelayMs(102, 200)).toBe(0);
  });
});
