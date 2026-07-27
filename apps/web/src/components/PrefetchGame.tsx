'use client';

import { useEffect } from 'react';

interface SaveDataNavigator {
  connection?: { saveData?: boolean; effectiveType?: string };
}

/**
 * Menghangatkan bundle Phaser saat browser sedang menganggur.
 *
 * Phaser di-import dinamis di dalam effect halaman game, jadi ia TIDAK ikut
 * prefetch route bawaan Next — akibatnya ~330 KB baru mulai diunduh tepat saat
 * pemain menekan "Main Solo", atau (lebih buruk) saat countdown 3-2-1
 * multiplayer sudah berjalan.
 *
 * Dipasang di dua tempat yang sama-sama punya waktu tunggu nyata: landing page
 * (pemain sedang membaca cara main) dan lobby room (menunggu teman siap).
 *
 * Komponen ini tidak menampilkan apa pun.
 */
export function PrefetchGame({ target }: { target: 'solo' | 'remote' }) {
  useEffect(() => {
    const nav = navigator as Navigator & SaveDataNavigator;
    // Hormati Data Saver dan jaringan lambat: di 2G/3G, mengunduh 330 KB yang
    // belum tentu dipakai justru memperlambat halaman yang sedang dibaca.
    if (nav.connection?.saveData === true) return;
    const slow = /^(slow-)?2g$/.test(nav.connection?.effectiveType ?? '');
    if (slow) return;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      // Kegagalan diabaikan dengan sengaja: ini murni optimasi, dan halaman
      // game tetap meng-import modulnya sendiri saat dibuka.
      const load =
        target === 'solo' ? import('@/game/createSoloGame') : import('@/game/createRemoteGame');
      void load.catch(() => {});
    };

    // `requestIdleCallback` belum ada di Safari lama — jatuh ke timer.
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(warm, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(warm, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [target]);

  return null;
}
