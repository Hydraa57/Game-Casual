const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/*
  Metro di monorepo pnpm.

  Tiga penyesuaian, dan ketiganya wajib — bukan penalaan:

  1. `watchFolders` harus memuat AKAR monorepo. Tanpa itu Metro cuma mengawasi
     `apps/mobile`, dan `@pixelmatrix/shared` yang berada di luar folder itu
     tidak pernah terbaca sama sekali.
  2. `nodeModulesPaths` harus memuat node_modules akar. pnpm menaruh dependensi
     yang di-hoist di sana, bukan di dalam `apps/mobile/node_modules`.
  3. `unstable_enableSymlinks` karena seluruh cara kerja pnpm adalah symlink;
     tanpa ini Metro menolak mengikuti tautan ke `packages/shared`.

  Yang TIDAK dilakukan: menyalin `packages/shared` ke dalam aplikasi. Salinan
  berarti dua sumber kebenaran untuk aturan main, dan salinan kedua pasti
  tertinggal — itu justru alasan utama React Native dipilih di atas Flutter.
*/
const akarMonorepo = path.resolve(__dirname, '../..');

const config = {
  watchFolders: [akarMonorepo],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(akarMonorepo, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
