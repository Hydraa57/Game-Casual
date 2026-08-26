import { Vibration } from 'react-native';
import type { GameEvent } from '@pixelmatrix/shared';

/**
 * Pola getar per kejadian, disalin dari `navigator.vibrate` di `sfx.ts` web.
 *
 * Angkanya sengaja sama supaya kedua versi terasa sama di tangan. Bentuknya:
 * satu angka = getar sekali sepanjang itu; array = getar-diam-getar bergantian.
 */
const POLA = {
  /** Klik salah: singkat. Cukup untuk tahu tanpa melihat HUD. */
  salah: 40,
  /** Bom: lebih panjang dari klik salah — ia kesalahan yang paling mahal. */
  bom: [0, 50, 40, 90],
  /** Naik level: sangat singkat, dan satu-satunya kabar baik yang menggetarkan. */
  naikLevel: 25,
  /** Nyawa habis: turun sampai dasar, dan tidak ada yang menyusul. */
  kalah: [0, 90, 60, 140],
} as const;

/**
 * Getar untuk satu kejadian permainan.
 *
 * **Hanya kejadian yang benar-benar layak menggetarkan.** Menggetarkan setiap
 * klik benar akan membuat getarnya berhenti berarti apa-apa — dan menguras
 * baterai sepanjang ronde. Yang dipilih: dua kesalahan (klik salah, bom) dan
 * dua tonggak (naik level, kalah).
 *
 * Array pola React Native dimulai dari LAMA DIAM, bukan lama getar — karena itu
 * pola di atas selalu diawali 0. Salah menaruhnya membuat getaran pertamanya
 * hilang dan polanya bergeser satu langkah.
 */
export function getarUntuk(event: GameEvent): void {
  switch (event.type) {
    case 'clickRejected':
      // Hanya warna yang salah. `notFound` dan `tooLate` itu tap yang datang
      // telat sedikit — wajar di HP, dan menggetarkannya terasa seperti dimarahi
      // untuk sesuatu yang bukan kesalahan.
      if (event.reason === 'wrongColor') Vibration.vibrate(POLA.salah);
      break;

    case 'bombHit':
      Vibration.vibrate([...POLA.bom]);
      break;

    case 'levelUp':
      Vibration.vibrate(POLA.naikLevel);
      break;

    case 'gameOver':
      Vibration.vibrate([...POLA.kalah]);
      break;

    default:
      break;
  }
}
