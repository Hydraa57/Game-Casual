import { defineConfig } from 'vitest/config';

/**
 * Test aplikasi Android yang TIDAK butuh Android.
 *
 * Yang diuji di sini sengaja dibatasi pada hal-hal yang bisa dibuktikan tanpa
 * emulator: kesetaraan token design dengan CSS web, dan bahwa
 * `@pixelmatrix/shared` benar-benar terbaca dari dalam aplikasi. Keduanya
 * justru jenis kesalahan yang paling mudah lolos — build Gradle tetap sukses
 * dengan warna yang salah.
 *
 * Yang membutuhkan perangkat (tata letak, sentuhan, animasi) tidak dipalsukan
 * di sini. Test yang berpura-pura menguji tampilan lebih berbahaya daripada
 * tidak ada test.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
