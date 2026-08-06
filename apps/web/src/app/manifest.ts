import type { MetadataRoute } from 'next';

/**
 * Manifest PWA — supaya teman-teman bisa "Add to Home Screen" dan langsung
 * masuk game tanpa mengetik URL atau melewati UI browser.
 *
 * Ditaruh di root `app/`, bukan di dalam `[locale]/`, karena manifest hanya
 * boleh ada satu per origin. Proxy next-intl juga sudah melewatkan path yang
 * mengandung titik, jadi file ini tidak ikut dialihkan ke prefiks locale.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pixel Matrix',
    short_name: 'Pixel Matrix',
    description: 'Game refleks warna — main solo atau rebutan satu papan bareng teman.',
    // Diarahkan ke `/`, bukan `/id`: proxy yang memutuskan locale-nya, jadi
    // pemain berbahasa Inggris tidak terkunci ke bahasa Indonesia.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Papannya persegi dan HUD-nya satu kolom; landscape di HP hanya membuat
    // papan mengecil tanpa memberi apa pun.
    orientation: 'portrait',
    background_color: '#fff6e9',
    theme_color: '#fff6e9',
    categories: ['games'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Maskable dipisah: Android memotong ikon jadi lingkaran/squircle, dan
      // versi ini isinya sudah disusutkan supaya tidak ikut terpotong.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
