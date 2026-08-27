import { Music, Sfx } from '@pixelmatrix/shared';
import type { KonteksAudio } from '@pixelmatrix/shared';

/** Safari lama hanya punya `webkitAudioContext`. */
interface AudioCapableWindow {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
}

/**
 * Menyambungkan sintesis audio bersama ke Web Audio milik peramban.
 *
 * Seluruh nada, tempo, dan peluruhannya ada di `@pixelmatrix/shared` supaya
 * versi web dan versi Android tidak mungkin berbeda bunyinya. Yang tinggal di
 * sini hanya bagian yang memang khas peramban: dari mana `AudioContext`-nya
 * datang, dan bagaimana getar dipanggil.
 */
function buatKonteks(): KonteksAudio | null {
  if (typeof window === 'undefined') return null;

  const lingkup = window as unknown as AudioCapableWindow;
  const Ctor = lingkup.AudioContext ?? lingkup.webkitAudioContext;
  if (!Ctor) return null;

  // `AudioContext` peramban memenuhi `KonteksAudio` secara struktural — antarmuka
  // itu memang disalin dari spesifikasi yang sama. Cast-nya ada karena tipe DOM
  // memakai union yang lebih sempit (`OscillatorType`, `AudioContextState`)
  // ketimbang `string` yang dipakai antarmuka bersama.
  return new Ctor() as unknown as KonteksAudio;
}

export function buatSfx(): Sfx {
  return new Sfx({
    buatKonteks,
    getar: (pola) => navigator.vibrate?.(pola as number | number[]),
  });
}

export function buatMusic(): Music {
  return new Music({
    buatKonteks,
    buatPengulang: (panggil, jedaMs) => {
      const id = window.setInterval(panggil, jedaMs);
      return () => window.clearInterval(id);
    },
  });
}
