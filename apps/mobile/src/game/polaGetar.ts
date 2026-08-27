/**
 * Terjemahkan pola getar dari konvensi web ke konvensi React Native.
 *
 * `navigator.vibrate([50, 40, 90])` di web berarti: getar 50, diam 40, getar 90.
 * `Vibration.vibrate([50, 40, 90])` di React Native berarti: **diam** 50, getar
 * 40, diam 90. Konvensinya berlawanan.
 *
 * Array yang sama diteruskan apa adanya akan bergeser satu langkah — getaran
 * pertamanya hilang, dan yang terasa di tangan justru jeda-jedanya. Tidak ada
 * error, tidak ada peringatan; satu-satunya cara menemukannya adalah memegang
 * HP-nya. Karena itu ia dipisah ke berkas tanpa impor React Native sama sekali,
 * supaya bisa diuji.
 *
 * Yang menyesuaikan adalah sisi Android, bukan angka-angka di
 * `@pixelmatrix/shared`: angka-angka itu sudah ditala lewat playtest dan tidak
 * boleh berubah artinya tergantung platform.
 */
export function keVibrationRN(pola: number | readonly number[]): number | number[] {
  // Satu angka berarti hal yang sama di kedua platform: getar selama itu.
  if (typeof pola === 'number') return pola;

  // Nol di depan = "diam selama 0 ms", jadi getaran pertama tetap yang pertama.
  return [0, ...pola];
}
