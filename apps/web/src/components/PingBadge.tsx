'use client';

import { useTranslations } from 'next-intl';
import { latencyQuality } from '@pixelmatrix/shared';

interface PingBadgeProps {
  readonly latencyMs: number | null;
  /** Pemain yang koneksinya sedang putus — angkanya sudah basi. */
  readonly connected?: boolean;
  /**
   * Penahanan penyetaraan ping untuk pemain ini, dalam ms. Hanya ada saat match
   * berjalan; di lobby tidak ada yang ditahan.
   */
  readonly fairDelayMs?: number;
}

/**
 * Lencana ping satu pemain.
 *
 * Menampilkan ANGKA dan WARNA sekaligus, bukan salah satunya. Warna saja tidak
 * bisa dibedakan oleh sebagian pemain buta warna — dan ini game tentang warna,
 * jadi kemungkinan itu justru lebih besar di sini daripada di aplikasi biasa.
 * Angka saja tidak berarti apa-apa bagi kebanyakan orang: "180" itu bagus atau
 * buruk? Bersama-sama, keduanya bisa dibaca siapa pun.
 *
 * Dan ia SELALU tampil, termasuk saat koneksinya bagus. Percobaan pertama
 * menyembunyikannya di scoreboard saat pingnya bagus, dengan alasan empat angka
 * hijau di samping papan cuma gangguan. Alasannya salah: lencana yang
 * muncul-hilang sendiri terbaca sebagai UI rusak, bukan sebagai "koneksimu
 * aman" — dan yang justru ingin dilihat pemain adalah pingnya. Yang bagus
 * diredupkan lewat CSS supaya tidak bersaing dengan papan.
 */
export function PingBadge({ latencyMs, connected = true, fairDelayMs = 0 }: PingBadgeProps) {
  const t = useTranslations('room');
  const quality = connected ? latencyQuality(latencyMs) : 'unknown';

  // Belum ada sampel: pemain baru masuk dan pengukuran pertama belum kembali.
  // Menampilkan "0 ms" akan berbohong, dan menampilkan "buruk" akan menuduh
  // koneksi yang belum pernah diukur.
  const label = quality === 'unknown' || latencyMs === null ? '—' : `${latencyMs}`;

  /*
    Penahanan penyetaraan masuk ke KETERANGAN, bukan ke angkanya.

    Menambahkannya ke angka ping akan berbohong soal koneksinya — pemain yang
    pingnya benar-benar 30 ms akan melihat "110 ms" dan menyimpulkan jaringannya
    bermasalah. Yang berubah bukan latensi jaringannya, melainkan kapan server
    menyelesaikan ketukannya, dan itu dua hal yang berbeda.

    Penandanya cuma titik kecil di samping angka: cukup untuk membuat orang
    bertanya, dan jawabannya ada di keterangan saat ditekan lama atau disorot.
  */
  const disetarai = connected && fairDelayMs > 0;
  const keterangan = disetarai ? t('pingEqualized', { ms: fairDelayMs }) : t('pingTitle');

  return (
    <span
      className={`ping ping--${quality}${disetarai ? ' ping--fair' : ''}`}
      title={keterangan}
      aria-label={
        quality === 'unknown' || latencyMs === null
          ? t('pingUnknown')
          : `${t('pingValue', { ms: latencyMs })}${disetarai ? `. ${keterangan}` : ''}`
      }
    >
      <span className="ping__dot" aria-hidden="true" />
      {label}
      <span className="ping__unit" aria-hidden="true">
        ms
      </span>
      {disetarai && (
        <span className="ping__fair" aria-hidden="true">
          ⏳
        </span>
      )}
    </span>
  );
}
