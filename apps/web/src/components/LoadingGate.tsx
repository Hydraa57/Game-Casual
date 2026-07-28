'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Berapa lama layar memuat boleh menahan pemain.
 *
 * Batas ini bukan hiasan: kalau satu chunk gagal diunduh atau jaringannya
 * menggantung, tanpa batas waktu pemain terjebak di layar memuat selamanya —
 * padahal halaman gamenya tetap meng-import modulnya sendiri saat dibuka.
 * Lewat batas ini menunya dibuka apa adanya; yang hilang cuma keuntungan
 * "sudah siap duluan".
 */
const MAX_WAIT_MS = 8000;

/**
 * Jeda sebelum layar memuat BOLEH muncul.
 *
 * Kunjungan kedua mengambil semuanya dari cache dan selesai dalam puluhan
 * milidetik. Menampilkan layar memuat untuk itu menghasilkan kedipan yang
 * justru terasa seperti gangguan — lebih buruk daripada tidak ada layar sama
 * sekali. Kalau semuanya sudah siap sebelum jeda ini habis, pemain tidak
 * pernah melihat apa pun.
 */
const SHOW_AFTER_MS = 180;

interface Task {
  readonly labelKey: 'engine' | 'multiplayer' | 'art';
  readonly run: () => Promise<unknown>;
}

/**
 * Yang benar-benar diunduh sebelum menu dibuka.
 *
 * Urutannya disengaja: mesin gamenya (Phaser, ~330 KB) paling besar dan paling
 * menentukan, jadi ia lebih dulu. Modul multiplayer berbagi chunk yang sama,
 * jadi setelahnya ia praktis gratis — tetap dihitung sebagai tugas tersendiri
 * karena ia memang pekerjaan nyata yang bisa gagal sendiri.
 */
const TASKS: readonly Task[] = [
  { labelKey: 'engine', run: () => import('@/game/createSoloGame') },
  { labelKey: 'multiplayer', run: () => import('@/game/createRemoteGame') },
  { labelKey: 'art', run: () => preloadImages(['/icon-192.png', '/icon-512.png']) },
];

function preloadImages(sources: readonly string[]): Promise<unknown> {
  return Promise.all(
    sources.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          // Gagal memuat ikon TIDAK boleh menahan menu. Keduanya diselesaikan
          // dengan resolve, bukan reject: ini pemanasan, bukan syarat.
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        }),
    ),
  );
}

/**
 * Layar memuat: unduh aset gamenya dulu, baru buka menunya.
 *
 * Barnya menampilkan pekerjaan YANG SUDAH SELESAI, bukan tebakan waktu. Ia
 * tidak pernah merayap sendiri untuk terlihat sibuk — kalau ia berhenti di
 * 33%, itu memang berarti satu dari tiga tugas selesai dan yang kedua sedang
 * berjalan. Yang bergerak sendiri hanyalah kilau di atas barnya, dan itu jujur
 * karena ia tidak mengaku sebagai kemajuan.
 */
export function LoadingGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('loading');
  const [doneCount, setDoneCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reveal = window.setTimeout(() => {
      if (!cancelled) setVisible(true);
    }, SHOW_AFTER_MS);

    const giveUp = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, MAX_WAIT_MS);

    void (async () => {
      for (const task of TASKS) {
        // Kegagalan satu tugas tidak menggagalkan sisanya: semuanya pemanasan,
        // dan halaman gamenya tetap meng-import modulnya sendiri saat dibuka.
        await task.run().catch(() => {});
        if (cancelled) return;
        setDoneCount((current) => current + 1);
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(reveal);
      window.clearTimeout(giveUp);
    };
  }, []);

  if (ready) return <>{children}</>;
  // Belum selesai, tapi juga belum cukup lama untuk pantas menampilkan apa pun.
  if (!visible) return null;

  const percent = Math.round((doneCount / TASKS.length) * 100);
  const current = TASKS[Math.min(doneCount, TASKS.length - 1)]!;

  return (
    <main className="shell loading">
      <h1 className="landing__title">{t('title')}</h1>
      <div
        className="loading__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('title')}
      >
        <div className="loading__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="loading__step">
        {t(`step.${current.labelKey}`)} · {percent}%
      </p>
    </main>
  );
}
