import { describe, expect, it } from 'vitest';
import { LATENCY_FAIR_MAX_MS, LATENCY_GOOD_MAX_MS, latencyQuality, smoothLatency } from './latency';

describe('mutu latensi', () => {
  it('memetakan tiap rentang ke kategorinya', () => {
    expect(latencyQuality(20)).toBe('good');
    expect(latencyQuality(LATENCY_GOOD_MAX_MS)).toBe('good');
    expect(latencyQuality(LATENCY_GOOD_MAX_MS + 1)).toBe('fair');
    expect(latencyQuality(LATENCY_FAIR_MAX_MS)).toBe('fair');
    expect(latencyQuality(LATENCY_FAIR_MAX_MS + 1)).toBe('poor');
    expect(latencyQuality(2000)).toBe('poor');
  });

  it('ambangnya menaik dan tidak tumpang tindih', () => {
    expect(LATENCY_GOOD_MAX_MS).toBeLessThan(LATENCY_FAIR_MAX_MS);
  });

  it('belum terukur bukan berarti buruk', () => {
    // Pemain yang baru masuk belum punya sampel. Menampilkannya sebagai "poor"
    // akan menuduh koneksi yang belum pernah diukur.
    expect(latencyQuality(null)).toBe('unknown');
    expect(latencyQuality(Number.NaN)).toBe('unknown');
    expect(latencyQuality(-5)).toBe('unknown');
  });
});

describe('perataan latensi', () => {
  it('sampel pertama dipakai apa adanya', () => {
    expect(smoothLatency(null, 120)).toBe(120);
  });

  /**
   * Ini alasan perataannya ada.
   *
   * Satu paket yang kebetulan tersendat tidak boleh membuat lencana ping
   * melompat dari hijau ke merah lalu kembali — itu terbaca sebagai UI rusak,
   * bukan sebagai informasi.
   */
  it('satu gangguan biasa tidak langsung menggeser kategorinya', () => {
    // 250 ms di atas dasar 60 ms adalah gangguan yang lumrah di jaringan
    // seluler. Ia boleh terlihat, tapi tidak boleh langsung memerahkan lencana.
    const setelahGangguan = smoothLatency(60, 250);
    expect(latencyQuality(setelahGangguan)).toBe('fair');
  });

  it('lonjakan ekstrem MEMANG bergeser ke merah', () => {
    // Koneksi yang tersendat hampir sedetik bukan riak. Meredamnya sampai
    // tidak terlihat berarti menyembunyikan hal yang justru ingin diketahui.
    expect(latencyQuality(smoothLatency(60, 900))).toBe('poor');
  });

  it('memburuk yang berkelanjutan tetap terkejar', () => {
    let value = smoothLatency(null, 50);
    for (let i = 0; i < 12; i += 1) value = smoothLatency(value, 400);
    expect(latencyQuality(value)).toBe('poor');
  });

  it('membaik yang berkelanjutan juga terkejar', () => {
    let value = smoothLatency(null, 500);
    for (let i = 0; i < 12; i += 1) value = smoothLatency(value, 40);
    expect(latencyQuality(value)).toBe('good');
  });

  it('selalu bilangan bulat, supaya tampilannya tidak berkedip di desimal', () => {
    expect(Number.isInteger(smoothLatency(61, 88))).toBe(true);
  });
});
