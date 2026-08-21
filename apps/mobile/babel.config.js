module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Wajib TERAKHIR. Plugin worklets menulis ulang fungsi yang berjalan di
    // thread UI (dipakai Reanimated); kalau ada plugin lain sesudahnya,
    // ia bekerja pada kode yang sudah berubah bentuk dan hasilnya gagal diam-diam
    // saat runtime, bukan saat build.
    'react-native-worklets/plugin',
  ],
};
