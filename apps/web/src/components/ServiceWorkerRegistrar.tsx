'use client';

import { useEffect } from 'react';

/**
 * Mendaftarkan `/sw.js`.
 *
 * Tanpa ini seluruh berkas service worker itu tidak pernah berjalan, dan
 * akibatnya bukan cuma "tidak ada cache": Chrome di Android baru menawarkan
 * pemasangan kalau halamannya dikendalikan service worker yang punya handler
 * `fetch`. Manifest, ikon, dan HTTPS-nya sudah benar sejak lama — inilah satu
 * bagian yang hilang, dan itu sebabnya tombol pasang tidak pernah muncul.
 *
 * **Hanya di produksi.** Di `next dev`, service worker dan hot reload
 * bertengkar: modul yang sudah tersimpan disajikan ke halaman yang mengharapkan
 * versi terbaru, dan gejalanya muncul sebagai error yang menyesatkan di tempat
 * yang sama sekali tidak berhubungan. Yang bisa dipasang juga harus HTTPS, yang
 * berarti build sungguhan.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Kegagalan sengaja ditelan. Pendaftaran bisa gagal karena hal-hal yang
    // tidak bisa diperbaiki dari sini (mode penyamaran, storage dimatikan
    // pengguna), dan tidak satu pun di antaranya boleh menghalangi permainan.
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
