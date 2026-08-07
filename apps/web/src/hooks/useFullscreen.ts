'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Elemen dengan nama-nama berprefiks WebKit yang masih dipakai Safari.
 *
 * Safari di macOS baru mendukung Fullscreen API lewat nama lama, dan Safari di
 * iOS **tidak mendukungnya sama sekali** untuk elemen biasa — hanya `<video>`.
 * Itu bukan detail sepele: di iPhone, satu-satunya cara mendapatkan layar penuh
 * adalah memasang gamenya ke home screen sebagai PWA.
 */
interface WebkitFullscreen {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

export interface Fullscreen {
  /** Browsernya memang bisa. `false` di iOS Safari. */
  readonly supported: boolean;
  readonly active: boolean;
  toggle(): void;
}

/**
 * Layar penuh untuk halaman main.
 *
 * Ada karena keluhan yang sangat konkret: di HP, address bar browser memakan
 * ~100 px, halamannya jadi lebih tinggi dari layar, dan tombol di bawah papan
 * hilang tertutup — pemain harus scroll di tengah permainan yang dimainkan
 * dengan tap. Layar penuh menghapus penyebabnya, bukan gejalanya.
 *
 * Statusnya dibaca dari `document`, BUKAN disimpan sendiri saat tombol ditekan:
 * pemain bisa keluar dari layar penuh lewat tombol Escape atau gestur sistem,
 * dan tombol yang menyimpan tebakannya sendiri akan menampilkan keadaan yang
 * salah setelah itu.
 */
export function useFullscreen(): Fullscreen {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = document.documentElement as HTMLElement & WebkitFullscreen;
    const doc = document as Document & WebkitFullscreen;
    setSupported(
      typeof root.requestFullscreen === 'function' ||
        typeof root.webkitRequestFullscreen === 'function',
    );

    const sync = (): void => {
      setActive(
        document.fullscreenElement !== null || (doc.webkitFullscreenElement ?? null) !== null,
      );
    };
    sync();

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement as HTMLElement & WebkitFullscreen;
    const doc = document as Document & WebkitFullscreen;
    const sedangPenuh =
      document.fullscreenElement !== null || (doc.webkitFullscreenElement ?? null) !== null;

    // Kegagalan diabaikan dengan sengaja: browser boleh menolak permintaan
    // layar penuh (misal karena tidak datang dari gestur pemain), dan itu bukan
    // alasan untuk menjatuhkan permainan yang sedang berjalan.
    if (sedangPenuh) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    void Promise.resolve(root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.()).catch(
      () => {},
    );
  }, []);

  return { supported, active, toggle };
}
