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

    /*
      Diperiksa dari OBJEKNYA, bukan dari `'serviceWorker' in navigator`.

      Sebagian browser dalam aplikasi dan mode privasi tetap menyediakan
      propertinya tapi mengisinya `undefined`. Pemeriksaan berbasis kunci lolos
      di situ, lalu `.register()` melempar — di dalam effect, dan itu berarti
      SELURUH halaman jatuh ke error boundary hanya karena service worker yang
      memang tidak akan dipakai. Ditemukan saat menguji panel diagnosa dengan
      service worker yang sengaja dilucuti.
    */
    const sw = navigator.serviceWorker as ServiceWorkerContainer | undefined;
    if (!sw) return;

    // Kegagalan sengaja ditelan. Pendaftaran bisa gagal karena hal-hal yang
    // tidak bisa diperbaiki dari sini (mode penyamaran, storage dimatikan
    // pengguna), dan tidak satu pun di antaranya boleh menghalangi permainan.
    try {
      void sw.register('/sw.js').catch(() => {});
    } catch {
      /* browser menolak sebelum janji dibuat — tetap bukan alasan gagal main */
    }
  }, []);

  return null;
}
