import { MP_PING_EQUALIZE_CAP_MS, MP_PING_EQUALIZE_MIN_MS } from '../constants/index';

/**
 * Penyetaraan ping: memperkecil keunggulan pemain berkoneksi cepat di papan
 * rebutan.
 *
 * Masalahnya nyata dan tidak bisa diperbaiki dengan menampilkan angka ping
 * saja. Server yang otoritatif menyelesaikan rebutan menurut urutan KEDATANGAN
 * ketukan. Dua pemain yang bereaksi di milidetik yang persis sama, satu dengan
 * ping 40 ms dan satu dengan 240 ms, sampai ke server terpaut 100 ms — dan yang
 * lambat kalah setiap kali, tanpa satu pun hubungannya dengan refleksnya.
 * Di game yang seluruh isinya adalah refleks, itu bukan gangguan kecil.
 *
 * Cara yang dipakai di sini: **ketukan yang datang lebih cepat ditahan sebentar**
 * sampai kira-kira setara dengan pemain terlambat di match yang sama. Ini
 * teknik yang sama dengan delay-based netcode di game fighting, dan
 * konsekuensinya harus disebut jujur: yang pingnya bagus merasakan input yang
 * sedikit lebih lambat. Itu sebabnya penahanannya DIBATASI — lihat
 * `MP_PING_EQUALIZE_CAP_MS`.
 *
 * Alternatif yang tidak dipilih: mengurutkan rebutan menurut cap waktu dari
 * client. Itu tidak memperlambat siapa pun dan lebih adil di atas kertas, tapi
 * cap waktunya berasal dari mesin pemain — siapa pun yang mau curang tinggal
 * mengaku menekan lebih awal dan memenangkan setiap rebutan. Di room yang
 * kodenya bisa dibagikan ke siapa saja, itu bukan risiko teoretis.
 */

/**
 * Ping acuan satu match: yang TERBURUK di antara pemain yang bisa diukur.
 *
 * `null` berarti belum ada sampel (pemain baru masuk) atau memang tidak punya
 * jaringan (bot), dan keduanya tidak boleh ikut menentukan acuan: pemain baru
 * akan menyeret acuan ke 0 dan mematikan penyetaraan, sedangkan bot yang
 * dihitung 0 ms akan membuat acuannya selalu nol di room berisi bot.
 */
export function referenceLatencyMs(samples: readonly (number | null)[]): number {
  let worst = 0;
  for (const sample of samples) {
    if (sample === null) continue;
    if (sample > worst) worst = sample;
  }
  return worst;
}

/**
 * Berapa lama ketukan pemain ini ditahan supaya setara dengan `referenceMs`.
 *
 * Dibagi dua karena yang menentukan adalah perjalanan SATU ARAH: ping adalah
 * pulang-pergi, sementara yang membuat ketukan sampai lebih dulu cuma
 * perjalanan berangkatnya.
 *
 * `null` (bot, atau pemain yang pingnya belum terukur) diperlakukan sebagai
 * 0 ms. Untuk bot itu memang benar — ia berjalan di dalam proses server dan
 * tidak melewati jaringan sama sekali, jadi ia justru pihak yang paling
 * diuntungkan tanpa penyetaraan ini.
 */
export function equalizeDelayMs(
  ownLatencyMs: number | null,
  referenceMs: number,
  capMs: number = MP_PING_EQUALIZE_CAP_MS,
): number {
  const own = ownLatencyMs ?? 0;
  const selisih = (referenceMs - own) / 2;
  /*
    Selisih yang lebih kecil dari satu tick server DIBUANG, bukan dibulatkan.

    Antrean ketukan dikuras di awal tick, jadi penahanan 3 ms tetap membuat
    ketukannya menunggu tick berikutnya — sampai 50 ms. Membulatkan ke atas
    seperti itu justru memperbesar jurang yang sedang diperkecil: dua pemain
    di WiFi yang sama (45 dan 50 ms) tidak punya jurang yang berarti, tapi yang
    45 ms akan tertahan satu tick penuh dan kalah rebutan dari yang 50 ms.

    Ambangnya karena itu bukan angka pilihan, melainkan resolusi yang benar-benar
    dimiliki mekanismenya.
  */
  if (selisih < MP_PING_EQUALIZE_MIN_MS) return 0;
  return Math.min(Math.round(selisih), capMs);
}
