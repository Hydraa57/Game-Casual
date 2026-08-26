import {
  BOMB_BORDER_HEX,
  BOMB_HEX,
  COLOR_GLYPH,
  COLOR_HEX,
  GOLD_HEX,
  KIND_GLYPH,
  LIFE_HEX,
} from '@pixelmatrix/shared';
import type { Color, Pixel } from '@pixelmatrix/shared';

/**
 * `COLOR_HEX` dan kawan-kawannya menyimpan angka 0xRRGGBB; React Native butuh
 * string "#rrggbb".
 */
export function keCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function warnaPapanCss(color: Color): string {
  return keCss(COLOR_HEX[color]);
}

/**
 * Latar papan, dan alasannya tetap dalam padahal seluruh halaman sudah terang.
 *
 * Enam warna pixel game ini ditala untuk latar gelap. Diukur terhadap latar
 * terang: kuning 1,25:1, emas 1,40:1, hijau 2,14:1 — jauh di bawah 3:1 dan
 * praktis lenyap ke latarnya. Warna nila ini menjaga SEMUA warna yang bisa
 * ditap di atas 3,2:1.
 *
 * Angkanya sama persis dengan `BOARD_BACKGROUND` di web. Ia tidak diambil dari
 * `theme.ts` karena ia bukan warna chrome — ia bagian dari papan, dan mengubah
 * salah satunya tanpa yang lain berarti dua versi game punya kontras yang
 * berbeda.
 */
export const LATAR_PAPAN = '#2b1b53';

/** Garis kisi: cukup terlihat untuk memberi bentuk, cukup redup untuk tidak
 *  bersaing dengan pixelnya sendiri. */
export const GARIS_KISI = '#3f2b73';

export interface GayaPixel {
  readonly isi: string;
  readonly garis: string;
  readonly tebalGaris: number;
  readonly glyph: string;
  readonly warnaGlyph: string;
}

/**
 * Tampilan pixel menurut jenisnya.
 *
 * Pixel spesial WAJIB tidak mungkin dikira pixel biasa: bom memakai warna gelap
 * khusus dengan border merah tebal, emas dan nyawa memakai warna di luar palet
 * enam warna, dan ketiganya punya glyph sendiri. Ini soal keadilan — di layar
 * HP pemain hanya punya sepersekian detik untuk memutuskan tap atau tidak.
 */
export function gayaPixel(pixel: Pixel): GayaPixel {
  switch (pixel.kind) {
    case 'bomb':
      return {
        isi: keCss(BOMB_HEX),
        garis: keCss(BOMB_BORDER_HEX),
        tebalGaris: 3,
        glyph: KIND_GLYPH.bomb,
        warnaGlyph: keCss(BOMB_BORDER_HEX),
      };

    case 'gold':
      return {
        isi: keCss(GOLD_HEX),
        garis: 'rgba(255, 255, 255, 0.9)',
        tebalGaris: 3,
        glyph: KIND_GLYPH.gold,
        warnaGlyph: 'rgba(0, 0, 0, 0.65)',
      };

    case 'life':
      return {
        isi: keCss(LIFE_HEX),
        garis: 'rgba(255, 255, 255, 0.9)',
        tebalGaris: 3,
        glyph: KIND_GLYPH.life,
        warnaGlyph: 'rgba(0, 0, 0, 0.6)',
      };

    default:
      return {
        isi: warnaPapanCss(pixel.color),
        garis: 'rgba(0, 0, 0, 0.35)',
        tebalGaris: 2,
        glyph: COLOR_GLYPH[pixel.color],
        warnaGlyph: 'rgba(0, 0, 0, 0.6)',
      };
  }
}

/**
 * Seberapa pekat sebuah pixel digambar menurut sisa umurnya.
 *
 * Bom sengaja tidak pernah memudar sejauh pixel lain. Warnanya gelap dan hampir
 * menyatu dengan latar papan, jadi kalau ia sampai nyaris tembus pandang pemain
 * bisa menyangka selnya kosong lalu menap-nya — hukuman untuk sesuatu yang
 * tidak terlihat.
 */
export function kepekatan(pixel: Pixel, sisaRasio: number): number {
  const dasar = pixel.kind === 'bomb' ? 0.7 : 0.3;
  return dasar + (1 - dasar) * sisaRasio;
}
