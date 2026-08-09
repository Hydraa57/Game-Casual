'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Satu syarat pemasangan, beserta hasil pemeriksaannya di perangkat INI.
 *
 * `null` berarti "belum bisa dijawab" (pemeriksaannya masih berjalan), bukan
 * "gagal" — membedakan keduanya penting supaya panel tidak sempat menuduh
 * sesuatu rusak selama sepersekian detik pertama.
 */
export interface InstallCheck {
  readonly id: string;
  readonly pass: boolean | null;
  /** Keterangan tambahan yang layak dibaca manusia; kosong kalau tidak ada. */
  readonly detail: string;
}

export interface InstallDiagnostics {
  readonly checks: readonly InstallCheck[];
  /** Ringkasan sebaris untuk disalin dan dikirim ke orang yang membantu. */
  readonly summary: string;
}

/**
 * Memeriksa syarat pemasangan PWA DI PERANGKAT PEMAIN.
 *
 * Ditulis setelah panduan pasang yang sudah rapi ternyata tidak menolong sama
 * sekali: pemain melapor "tombolnya tidak muncul", dan dari sisi pengembang
 * tidak ada satu pun cara untuk tahu kenapa. Manifest bisa benar, service
 * worker bisa benar, dan pemasangannya tetap tidak ditawarkan karena hal-hal
 * yang cuma ada di perangkat itu — halamannya belum dikendalikan service
 * worker, aplikasinya sudah terpasang, browsernya bukan Chrome, atau situsnya
 * dibuka lewat HTTP.
 *
 * Jadi yang dilaporkan di sini adalah KEADAAN, bukan tebakan. Semua
 * pemeriksaannya membaca API browser yang sama dengan yang dipakai Chrome
 * untuk memutuskan, dan hasilnya bisa disalin utuh sebagai satu baris teks.
 */
export function useInstallDiagnostics(canPrompt: boolean): InstallDiagnostics {
  const [checks, setChecks] = useState<readonly InstallCheck[]>([]);

  const periksa = useCallback(async (): Promise<InstallCheck[]> => {
    const hasil: InstallCheck[] = [];

    // 1. HTTPS. Pemasangan tidak pernah ditawarkan di halaman tidak aman, dan
    //    ini juga syarat service worker bisa didaftarkan sama sekali.
    hasil.push({
      id: 'secure',
      pass: window.isSecureContext,
      detail: window.location.protocol.replace(':', ''),
    });

    // 2. Manifest tertaut DAN benar-benar bisa diambil. Tautan yang ada tapi
    //    404 adalah kegagalan yang paling sulit dilihat: HTML-nya terlihat
    //    benar, dan tidak ada pesan error di mana pun.
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      hasil.push({ id: 'manifest', pass: false, detail: 'tidak tertaut' });
    } else {
      try {
        const res = await fetch(link.href, { cache: 'no-store' });
        hasil.push({ id: 'manifest', pass: res.ok, detail: `HTTP ${res.status}` });
      } catch {
        hasil.push({ id: 'manifest', pass: false, detail: 'gagal diambil' });
      }
    }

    // 3. Service worker: didukung, terdaftar, DAN mengendalikan halaman ini.
    //    Ketiganya berbeda, dan yang ketiga paling sering jadi jawabannya —
    //    di kunjungan pertama service worker sudah aktif tapi belum
    //    mengendalikan halaman yang mendaftarkannya, jadi Chrome belum
    //    menganggap situsnya memenuhi syarat sampai halaman dimuat ulang.
    //    Dibaca dari OBJEKNYA, bukan dari `'serviceWorker' in navigator`:
    //    sebagian browser dalam aplikasi menyediakan propertinya tapi
    //    mengisinya `undefined`, dan pemeriksaan berbasis kunci lolos di situ
    //    lalu melempar satu baris kemudian.
    const swApi = navigator.serviceWorker as ServiceWorkerContainer | undefined;
    if (!swApi) {
      hasil.push({ id: 'sw', pass: false, detail: 'tidak didukung browser ini' });
    } else {
      let reg: ServiceWorkerRegistration | undefined;
      try {
        reg = await swApi.getRegistration();
      } catch {
        reg = undefined;
      }
      const controlled = swApi.controller !== null;
      hasil.push({
        id: 'sw',
        pass: reg !== undefined && controlled,
        detail:
          reg === undefined
            ? 'belum terdaftar'
            : controlled
              ? (reg.active?.state ?? 'aktif')
              : 'terdaftar, belum mengendalikan halaman',
      });
    }

    // 4. Tawaran pemasangan dari browser. Ini KESIMPULAN browser-nya sendiri,
    //    bukan kesimpulan kita — dan itulah yang membuatnya berharga: kalau
    //    tiga di atas lulus tapi yang ini tidak, jawabannya ada di browsernya
    //    (Safari, Firefox, atau aplikasinya sudah terpasang), bukan di situs.
    hasil.push({ id: 'prompt', pass: canPrompt, detail: '' });

    return hasil;
  }, [canPrompt]);

  useEffect(() => {
    let batal = false;
    void periksa().then((hasil) => {
      if (!batal) setChecks(hasil);
    });
    return () => {
      batal = true;
    };
  }, [periksa]);

  /*
    Ringkasan sengaja memuat user agent: pertanyaan pertama yang selalu muncul
    adalah "browsernya apa", dan menyuruh orang mencarinya sendiri di menu
    pengaturan HP hampir selalu berujung jawaban yang salah.

    Dirakit hanya SETELAH ada hasil. Komponen client tetap dirender di server
    lebih dulu, dan `window` tidak ada di sana — merakitnya tanpa syarat akan
    menjatuhkan seluruh halaman pengaturan, bukan cuma panel ini.
  */
  const summary =
    checks.length === 0
      ? ''
      : [
          `PixelMatrix install check @ ${window.location.host}`,
          ...checks.map(
            (c) =>
              `${c.id}=${c.pass === null ? '?' : c.pass ? 'ok' : 'NO'}${c.detail ? `(${c.detail})` : ''}`,
          ),
          `ua=${navigator.userAgent}`,
        ].join(' | ');

  return { checks, summary };
}
