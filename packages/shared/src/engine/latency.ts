/**
 * Mutu koneksi sebagai kategori, bukan angka mentah.
 *
 * Angka milidetik saja tidak memberi tahu apa pun kepada kebanyakan pemain —
 * "180" itu bagus atau buruk? Kategori inilah yang dipakai UI untuk memberi
 * warna, dan angkanya tetap ditampilkan di sebelahnya untuk yang peduli.
 */
export type LatencyQuality = 'good' | 'fair' | 'poor' | 'unknown';

/**
 * Ambangnya dipilih dari apa yang terasa di GAME INI, bukan dari patokan umum.
 *
 * Papannya rebutan dan pemenang satu pixel ditentukan oleh klik mana yang
 * sampai lebih dulu ke server. Artinya selisih latensi ADALAH selisih peluang
 * menang, dan itu jauh lebih tajam daripada di game yang tidak berebut.
 *
 * 90 ms: masih dalam jangkauan wajar dari Indonesia ke Singapura (region
 * server), dan selisih segitu jarang menentukan klik.
 * 200 ms: mulai terasa — lawan dengan koneksi bagus akan lebih sering menang
 * rebutan tanpa refleksnya lebih baik.
 */
export const LATENCY_GOOD_MAX_MS = 90;
export const LATENCY_FAIR_MAX_MS = 200;

export function latencyQuality(ms: number | null): LatencyQuality {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return 'unknown';
  if (ms <= LATENCY_GOOD_MAX_MS) return 'good';
  if (ms <= LATENCY_FAIR_MAX_MS) return 'fair';
  return 'poor';
}

/**
 * Rata-rata bergerak sederhana untuk meredam lonjakan.
 *
 * Satu paket yang kebetulan tersendat tidak boleh membuat lencana ping
 * berkedip merah lalu hijau lagi — itu terbaca sebagai UI yang rusak, bukan
 * sebagai informasi.
 *
 * Bobot 0.25 dipilih setelah diukur, bukan ditebak: dengan 0.3, satu sampel
 * 250 ms di atas dasar 60 ms sudah cukup menggeser lencana dari hijau ke merah.
 * Dengan 0.25, gangguan sebesar itu berhenti di kuning — sementara koneksi yang
 * benar-benar memburuk tetap terkejar dalam ~12 sampel (sekitar setengah menit).
 *
 * Lonjakan yang JAUH lebih besar (misal 900 ms) memang tetap menggeser ke
 * merah, dan itu perilaku yang benar: koneksi yang tersendat hampir sedetik
 * bukan riak, itu gangguan yang layak dilihat pemain lain.
 */
export const LATENCY_SMOOTHING = 0.25;

export function smoothLatency(previous: number | null, sample: number): number {
  if (previous === null || !Number.isFinite(previous)) return sample;
  return Math.round(previous * (1 - LATENCY_SMOOTHING) + sample * LATENCY_SMOOTHING);
}
