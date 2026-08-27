import { AudioContext } from 'react-native-audio-api';
import { Vibration } from 'react-native';
import { Music, Sfx } from '@pixelmatrix/shared';
import type { KonteksAudio } from '@pixelmatrix/shared';
import { keVibrationRN } from './polaGetar';

/**
 * Menyambungkan sintesis audio bersama ke mesin audio Android.
 *
 * Seluruh nada, tempo, dan peluruhannya ada di `@pixelmatrix/shared` — berkas
 * yang SAMA yang dipakai versi web. Yang tinggal di sini hanya bagian yang
 * memang khas platform: dari mana `AudioContext`-nya datang, cara menjadwalkan
 * pengulang, dan cara menggetarkan.
 *
 * `react-native-audio-api` mengimplementasikan spesifikasi Web Audio, jadi yang
 * dipakai di sisi bersama — osilator, gain, filter lowpass, buffer derau —
 * berjalan apa adanya. Itu yang membuat musik dan efek suaranya benar-benar
 * sama, bukan sekadar mirip.
 *
 * **Kenapa `react-native-gesture-handler` ada di dependensi padahal game ini
 * tidak memakai satu pun gesture-nya:** paket audio-api mengekspor komponen UI
 * pemutar audio (`AudioControls`) dari berkas index yang sama, dan komponen itu
 * mengimpor gesture-handler. Metro menelusuri seluruh isi index saat membundel,
 * jadi bundel gagal dibuat walau komponennya tidak pernah dirender. Itu peer
 * dependency yang lupa dideklarasikan audio-api — jangan dibuang sebagai
 * "dependensi tak terpakai".
 */
function buatKonteks(): KonteksAudio | null {
  // Cast-nya ada karena tipe pustaka memakai union yang lebih sempit
  // (`OscillatorType`, `ContextState`) ketimbang `string` di antarmuka bersama;
  // bentuk dan perilakunya sama.
  return new AudioContext() as unknown as KonteksAudio;
}

export function buatSfx(): Sfx {
  return new Sfx({
    buatKonteks,
    getar: (pola) => Vibration.vibrate(keVibrationRN(pola)),
  });
}

export function buatMusic(): Music {
  return new Music({
    buatKonteks,
    buatPengulang: (panggil, jedaMs) => {
      const id = setInterval(panggil, jedaMs);
      return () => clearInterval(id);
    },
  });
}
