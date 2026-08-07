'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Event non-standar milik Chromium. Tidak ada di lib.dom, jadi diketik sendiri.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'chromium' | 'other';

export interface InstallPrompt {
  /** Sudah dibuka sebagai aplikasi terpasang — tidak ada yang perlu dipasang lagi. */
  readonly installed: boolean;
  /** Browsernya menawarkan pemasangan satu ketuk (Chromium). */
  readonly canPrompt: boolean;
  readonly platform: InstallPlatform;
  /** Munculkan dialog pasang bawaan browser. Hanya berarti kalau `canPrompt`. */
  install(): void;
}

/**
 * Memasang game ini sebagai aplikasi.
 *
 * Dua dunia yang benar-benar berbeda, dan itu yang menentukan bentuk panduannya:
 *
 * - **Chromium (Android, desktop)** memancarkan `beforeinstallprompt`. Event-nya
 *   ditahan, lalu dimunculkan lagi saat pemain menekan tombol — jadi
 *   pemasangannya benar-benar satu ketuk.
 * - **iOS Safari tidak memancarkan apa pun.** Tidak ada API, tidak ada tombol
 *   yang bisa dibuat. Satu-satunya jalan adalah pemain membuka menu Bagikan
 *   sendiri, jadi di sana yang bisa dibantu hanyalah PETUNJUKNYA — dan itu
 *   sebabnya panduan iOS di UI dibuat beranimasi, bukan sekadar daftar teks.
 *
 * Firefox juga tidak memancarkannya; ia jatuh ke `other`, yang menampilkan
 * kedua panduan sekaligus alih-alih menebak.
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('other');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // Nama milik iOS Safari; tidak ada di tipe standar Navigator.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = navigator.userAgent;
    // iPad modern melaporkan dirinya sebagai Macintosh; layar sentuhnya yang
    // membedakannya dari Mac sungguhan.
    const iOS =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setPlatform(iOS ? 'ios' : 'other');

    const onPrompt = (event: Event): void => {
      // Ditahan supaya bisa dimunculkan LAGI nanti dari tombol kita sendiri.
      // Tanpa `preventDefault`, sebagian browser menampilkan bilah pasangnya
      // sendiri dan event-nya tidak bisa dipakai ulang.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setPlatform('chromium');
    };
    const onInstalled = (): void => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    void deferred.prompt().then(() =>
      deferred.userChoice.then(({ outcome }) => {
        // Event yang sudah dipakai tidak bisa dipakai lagi. Dibuang supaya
        // tombolnya hilang alih-alih menjadi tombol yang tidak berbuat apa-apa
        // saat ditekan kedua kalinya.
        if (outcome === 'accepted') setDeferred(null);
      }),
    );
  }, [deferred]);

  return { installed, canPrompt: deferred !== null, platform, install };
}
