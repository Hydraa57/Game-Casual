/*
  Service worker Pixel Matrix.

  Ditulis tangan tanpa pustaka apa pun. Bukan karena antipustaka: yang
  dibutuhkan game ini cuma dua puluhan baris, dan seluruh generator PWA yang
  ada membawa konfigurasi build tambahan yang harus ikut dirawat setiap kali
  Next.js berganti versi.

  ADA DUA ALASAN berkas ini perlu ada, dan yang kedua yang bikin pemain
  mengeluh:

  1. **Aset build disimpan.** Phaser sendiri ~330 KB, dan tanpa ini ia diunduh
     ulang setiap kali aplikasi dibuka dari home screen.
  2. **Tanpa service worker yang punya handler `fetch`, Chrome di Android tidak
     pernah menawarkan "Pasang aplikasi".** Manifest, ikon, dan HTTPS-nya sudah
     benar sejak lama — yang hilang justru berkas ini, jadi `beforeinstallprompt`
     tidak pernah dipancarkan dan tombol pasang di UI tidak pernah muncul.
     Yang bisa dilakukan pemain hanyalah "tambahkan ke layar utama" yang cuma
     membuat pintasan bookmark, bukan aplikasi.

  Aturan yang menahan seluruh isinya: **jangan pernah menyimpan sesuatu yang
  bisa jadi basi dan berbahaya.** Yang disimpan hanya berkas yang isinya tidak
  mungkin berubah untuk URL yang sama.
*/

const VERSION = 'pm-v1';
const STATIC_CACHE = `${VERSION}-static`;

/**
 * Halaman cadangan saat benar-benar offline, plus ikon-ikonnya.
 *
 * Sengaja SEDIKIT. Halaman aplikasinya sendiri TIDAK ikut disimpan di sini:
 * HTML-nya dirender server dan membawa locale serta keadaan login, dan
 * menyajikan versi lama dari salah satunya jauh lebih membingungkan daripada
 * menunggu jaringan.
 */
const PRECACHE = ['/offline.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Versi baru langsung mengambil alih. Tanpa ini, perbaikan di service
      // worker baru berlaku setelah SEMUA tab game ditutup — dan pemain yang
      // membukanya sebagai aplikasi jarang benar-benar menutupnya.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Aset yang namanya sudah mengandung hash build — isinya tidak akan pernah berubah. */
function isImmutable(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Hanya GET. POST login, klaim skor, dan sejenisnya tidak boleh disentuh
  // sama sekali.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Lintas origin dilewatkan apa adanya: server game (Socket.IO) dan CDN font
  // ada di origin lain, dan menyimpan responsnya tidak ada gunanya sekaligus
  // berisiko menyajikan data basi.
  if (url.origin !== self.location.origin) return;
  // API tidak pernah disimpan. Di sinilah sesi, skor, dan papan peringkat
  // lewat — persis jenis data yang paling merusak kalau basi.
  if (url.pathname.startsWith('/api/')) return;

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            // Respons gagal tidak disimpan: menyimpan 404 berarti berkas itu
            // tetap 404 sampai versi cache berganti.
            if (response.ok) {
              const salinan = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, salinan));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigasi: jaringan DULU, halaman offline hanya kalau jaringannya gagal.
  // Urutan ini yang menjaga halaman selalu segar; cache di sini murni jaring
  // pengaman, bukan sumber utama.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  }
});
