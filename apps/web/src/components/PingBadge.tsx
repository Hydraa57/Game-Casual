'use client';

import { useTranslations } from 'next-intl';
import { latencyQuality } from '@pixelmatrix/shared';

interface PingBadgeProps {
  readonly latencyMs: number | null;
  /** Pemain yang koneksinya sedang putus — angkanya sudah basi. */
  readonly connected?: boolean;
  /**
   * Sembunyikan kalau koneksinya baik-baik saja.
   *
   * Dipakai di scoreboard SELAMA match, di mana yang berguna cuma pengecualian:
   * lencana hijau di setiap baris hanyalah empat angka yang bergerak-gerak di
   * samping papan yang sedang direbutkan. Di lobby sebaliknya — di situ orang
   * memang sedang menimbang, dan angka yang bagus pun adalah jawaban.
   */
  readonly hideWhenGood?: boolean;
}

/**
 * Lencana ping satu pemain.
 *
 * Menampilkan ANGKA dan WARNA sekaligus, bukan salah satunya. Warna saja tidak
 * bisa dibedakan oleh sebagian pemain buta warna — dan ini game tentang warna,
 * jadi kemungkinan itu justru lebih besar di sini daripada di aplikasi biasa.
 * Angka saja tidak berarti apa-apa bagi kebanyakan orang: "180" itu bagus atau
 * buruk? Bersama-sama, keduanya bisa dibaca siapa pun.
 */
export function PingBadge({ latencyMs, connected = true, hideWhenGood = false }: PingBadgeProps) {
  const t = useTranslations('room');
  const quality = connected ? latencyQuality(latencyMs) : 'unknown';

  if (hideWhenGood && (quality === 'good' || quality === 'unknown')) return null;

  // Belum ada sampel: pemain baru masuk dan pengukuran pertama belum kembali.
  // Menampilkan "0 ms" akan berbohong, dan menampilkan "buruk" akan menuduh
  // koneksi yang belum pernah diukur.
  const label = quality === 'unknown' || latencyMs === null ? '—' : `${latencyMs}`;

  return (
    <span
      className={`ping ping--${quality}`}
      title={t('pingTitle')}
      aria-label={
        quality === 'unknown' || latencyMs === null
          ? t('pingUnknown')
          : t('pingValue', { ms: latencyMs })
      }
    >
      <span className="ping__dot" aria-hidden="true" />
      {label}
      <span className="ping__unit" aria-hidden="true">
        ms
      </span>
    </span>
  );
}
