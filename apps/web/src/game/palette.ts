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

/** Warna papan dalam bentuk string CSS, untuk HUD di DOM. */
export function cssColor(color: Color): string {
  return `#${COLOR_HEX[color].toString(16).padStart(6, '0')}`;
}

/**
 * Latar papan, dan alasannya tetap dalam padahal seluruh halaman sudah terang.
 *
 * Enam warna pixel game ini ditala untuk latar gelap. Diukur terhadap latar
 * terang: kuning 1,25:1, emas 1,40:1, hijau 2,14:1 — jauh di bawah 3:1 dan
 * praktis lenyap ke latarnya. Warna nila ini menjaga SEMUA warna yang bisa
 * ditap di atas 3,2:1 sekaligus terasa jauh lebih ceria daripada abu-abu tua
 * yang lama; ia sewarna dengan bingkai papan di CSS (`--board`).
 *
 * Mengubahnya berarti mengukur ulang seluruh palet papan, bukan sekadar
 * mengganti angka.
 */
export const BOARD_BACKGROUND = 0x2b1b53;

/** Garis kisi: cukup terlihat untuk memberi bentuk, cukup redup untuk tidak
 *  bersaing dengan pixelnya sendiri. */
export const GRID_LINE = 0x3f2b73;

export interface PixelStyle {
  readonly fill: number;
  readonly stroke: number;
  readonly strokeAlpha: number;
  readonly strokeWidth: number;
  readonly glyph: string;
  readonly glyphColor: string;
}

/**
 * Tampilan pixel menurut jenisnya.
 *
 * Pixel spesial WAJIB tidak mungkin dikira pixel biasa: bom memakai warna gelap
 * khusus dengan border merah tebal, emas dan nyawa memakai warna di luar palet
 * enam warna, dan ketiganya punya glyph sendiri. Ini soal keadilan — di layar HP
 * pemain hanya punya sepersekian detik untuk memutuskan tap atau tidak.
 */
export function pixelStyle(pixel: Pixel): PixelStyle {
  switch (pixel.kind) {
    case 'bomb':
      return {
        fill: BOMB_HEX,
        stroke: BOMB_BORDER_HEX,
        strokeAlpha: 1,
        strokeWidth: 4,
        glyph: KIND_GLYPH.bomb,
        glyphColor: '#e43b44',
      };

    case 'gold':
      return {
        fill: GOLD_HEX,
        stroke: 0xffffff,
        strokeAlpha: 0.9,
        strokeWidth: 4,
        glyph: KIND_GLYPH.gold,
        glyphColor: 'rgba(0,0,0,0.65)',
      };

    case 'life':
      return {
        fill: LIFE_HEX,
        stroke: 0xffffff,
        strokeAlpha: 0.9,
        strokeWidth: 4,
        glyph: KIND_GLYPH.life,
        glyphColor: 'rgba(0,0,0,0.6)',
      };

    default:
      return {
        fill: COLOR_HEX[pixel.color],
        stroke: 0x000000,
        strokeAlpha: 0.35,
        strokeWidth: 2,
        glyph: COLOR_GLYPH[pixel.color],
        glyphColor: 'rgba(0,0,0,0.6)',
      };
  }
}
