import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_COLORS, COLOR_GLYPH, COLOR_HEX } from '@pixelmatrix/shared';
import { warna } from './theme';

/**
 * Design Android dan design web harus tetap satu benda.
 *
 * Ini test yang menjaga janji "design-nya sama persis". Tanpanya, janji itu
 * hanya benar pada hari file `theme.ts` ditulis: siapa pun yang menyetel ulang
 * satu warna di `globals.css` — misalnya karena audit kontras menemukan
 * masalah, yang sudah terjadi TIGA KALI di proyek ini — akan meninggalkan versi
 * Android memakai warna lama tanpa satu pun tanda bahwa keduanya berpisah.
 *
 * Dibaca dari berkas CSS-nya langsung, bukan dari salinan angka di test ini.
 * Salinan di test cuma memindahkan masalahnya satu berkas ke samping.
 */
const CSS = readFileSync(
  fileURLToPath(new URL('../../web/src/app/globals.css', import.meta.url)),
  'utf8',
);

/** Ambil nilai satu variabel CSS dari blok `:root`. */
function tokenCss(nama: string): string {
  const cocok = CSS.match(new RegExp(`--${nama}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!cocok) throw new Error(`--${nama} tidak ada di globals.css`);
  return cocok[1]!.toLowerCase();
}

describe('token design Android = token design web', () => {
  // Pasangan nama: kiri kunci di `warna`, kanan nama variabel CSS-nya.
  const pasangan: readonly (readonly [keyof typeof warna, string])[] = [
    ['bg', 'bg'],
    ['surface', 'surface'],
    ['surfaceRaised', 'surface-raised'],
    ['border', 'border'],
    ['borderStrong', 'border-strong'],
    ['text', 'text'],
    ['textDim', 'text-dim'],
    ['accent', 'accent'],
    ['accentInk', 'accent-ink'],
    ['sky', 'sky'],
    ['mint', 'mint'],
    ['lemon', 'lemon'],
    ['grape', 'grape'],
    ['danger', 'danger'],
    ['bubblegum', 'bubblegum'],
    ['bubblegumInk', 'bubblegum-ink'],
    ['successInk', 'success-ink'],
  ];

  for (const [kunci, cssVar] of pasangan) {
    it(`${kunci} sama dengan --${cssVar}`, () => {
      expect(warna[kunci].toLowerCase()).toBe(tokenCss(cssVar));
    });
  }
});

describe('warna papan tidak boleh disalin', () => {
  /*
    Palet PAPAN sengaja TIDAK ada di `theme.ts`.

    Enam warna itu adalah bagian dari aturan main — server memakainya untuk
    memutuskan pixel mana yang benar — jadi ia harus datang dari
    `@pixelmatrix/shared`, bukan dari berkas tema. Test ini menjaga batas itu:
    kalau suatu hari ada yang menuliskannya ulang di `theme.ts` demi kepraktisan,
    di situlah papan Android mulai bisa berbeda warna dari papan web.
  */
  it('tema tidak memuat satu pun heksa warna papan', () => {
    const papan = ALL_COLORS.map((c) => `#${COLOR_HEX[c].toString(16).padStart(6, '0')}`);
    const temaLower = Object.values(warna).map((v) => v.toLowerCase());
    for (const hex of papan) {
      expect(temaLower).not.toContain(hex);
    }
  });

  it('enam warna papan punya glyph, dan semuanya berbeda', () => {
    // Sekaligus membuktikan `@pixelmatrix/shared` benar-benar terbaca dari
    // dalam aplikasi Android — kalau symlink pnpm-nya putus, test ini yang
    // gagal lebih dulu, bukan build Gradle yang makan lima menit.
    const glyph = ALL_COLORS.map((c) => COLOR_GLYPH[c]);
    expect(glyph).toHaveLength(6);
    expect(new Set(glyph).size).toBe(6);
  });
});
