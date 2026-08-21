import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_COLORS, COLOR_GLYPH, COLOR_HEX } from '@pixelmatrix/shared';
import { font, warna } from './theme';

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

/**
 * Font Android harus memuat bobot yang SAMA dengan yang diminta web.
 *
 * Ini bagian dari janji "design-nya sama persis" yang paling mudah pecah tanpa
 * terlihat: menambah satu bobot di `layout.tsx` web hanya butuh mengetik angka,
 * sementara di sisi Android ia butuh berkas .ttf baru. Tanpa test ini, teks
 * yang memakai bobot yang tidak ada akan diam-diam jatuh ke bobot lain — dan
 * gejalanya cuma "kok hurufnya agak beda", bukan sebuah error.
 */
describe('bobot font Android = bobot font web', () => {
  const LAYOUT = readFileSync(
    fileURLToPath(new URL('../../web/src/app/[locale]/layout.tsx', import.meta.url)),
    'utf8',
  );

  const berkasFont = (nama: string) =>
    fileURLToPath(new URL(`../android/app/src/main/assets/fonts/${nama}.ttf`, import.meta.url));

  /** Nama berkas yang dipakai Fredoka/Nunito untuk tiap bobot CSS. */
  const NAMA_BOBOT: Readonly<Record<string, string>> = {
    '400': 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    '800': 'ExtraBold',
  };

  /** Baca array `weight: [...]` dari pemanggilan `Fredoka({...})` / `Nunito({...})` di web. */
  function bobotWeb(keluarga: string): readonly string[] {
    const blok = LAYOUT.match(new RegExp(`${keluarga}\\(\\{([\\s\\S]*?)\\}\\)`));
    if (!blok) throw new Error(`pemanggilan ${keluarga}({...}) tidak ada di layout web`);

    const daftar = blok[1]!.match(/weight:\s*\[([^\]]+)\]/);
    if (!daftar) throw new Error(`${keluarga} di web tidak menyebut weight`);

    return [...daftar[1]!.matchAll(/'(\d+)'/g)].map((m) => m[1]!);
  }

  for (const keluarga of ['Fredoka', 'Nunito']) {
    it(`${keluarga}: tiap bobot yang diminta web punya berkas .ttf`, () => {
      const bobot = bobotWeb(keluarga);
      expect(bobot.length).toBeGreaterThan(0);

      for (const b of bobot) {
        const nama = NAMA_BOBOT[b];
        expect(nama, `bobot ${b} belum punya nama berkas`).toBeDefined();
        expect(existsSync(berkasFont(`${keluarga}-${nama}`)), `${keluarga}-${nama}.ttf`).toBe(true);
      }
    });
  }

  it('tiap nama font di tema menunjuk berkas yang benar-benar ada', () => {
    // Salah ketik satu huruf di `font.judulTebal` tidak menghasilkan error apa
    // pun di Android — teksnya cuma diam-diam memakai font sistem.
    for (const nama of Object.values(font)) {
      expect(existsSync(berkasFont(nama)), `${nama}.ttf`).toBe(true);
    }
  });
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
