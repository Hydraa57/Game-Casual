import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Berkas XML Android diperiksa di sini, bukan dibiarkan ditemukan Gradle.
 *
 * Kesalahan XML di `res/` tidak menggagalkan build sampai langkah
 * `packageReleaseResources` — **delapan menit setelah build dimulai**, setelah
 * seluruh kompilasi native dan pembuatan bundel JavaScript selesai. Padahal
 * memeriksanya butuh milidetik.
 *
 * Ini bukan test hipotetis: build pernah gagal persis karena satu komentar yang
 * menyebut variabel CSS `--bg` lengkap dengan dua tanda hubungnya.
 */
const RES = fileURLToPath(new URL('../android/app/src/main/res', import.meta.url));
const MANIFEST = fileURLToPath(
  new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
);

function kumpulkanXml(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...kumpulkanXml(jalur));
    else if (nama.endsWith('.xml')) hasil.push(jalur);
  }
  return hasil;
}

const BERKAS = [...kumpulkanXml(RES), MANIFEST];

describe('XML Android', () => {
  it('ada berkas yang diperiksa', () => {
    // Penjaga untuk test ini sendiri: kalau path-nya salah, daftar kosong akan
    // membuat seluruh test di bawah lulus tanpa memeriksa apa pun.
    expect(BERKAS.length).toBeGreaterThan(5);
  });

  for (const jalur of BERKAS) {
    const nama = jalur.slice(jalur.indexOf('android/'));

    it(`${nama}: komentarnya tidak memuat "--"`, () => {
      const isi = readFileSync(jalur, 'utf8');
      const komentar = [...isi.matchAll(/<!--([\s\S]*?)-->/g)];

      for (const cocok of komentar) {
        const baris = isi.slice(0, cocok.index).split('\n').length;
        expect(
          cocok[1]!.includes('--'),
          `Komentar di baris ${baris} memuat "--". XML melarangnya, dan aapt ` +
            `menolak seluruh berkasnya. Tulis nama variabel CSS tanpa dua tanda ` +
            `hubung di depannya.`,
        ).toBe(false);
      }
    });

    it(`${nama}: bisa diurai sebagai XML sederhana`, () => {
      const isi = readFileSync(jalur, 'utf8');

      // Bukan parser XML penuh — cuma dua kesalahan yang paling sering ditulis
      // tangan dan paling mahal ditemukan Gradle.
      expect(isi.trim().length, 'berkas kosong').toBeGreaterThan(0);

      const buka = (isi.match(/<!--/g) ?? []).length;
      const tutup = (isi.match(/-->/g) ?? []).length;
      expect(buka, 'jumlah pembuka dan penutup komentar tidak seimbang').toBe(tutup);
    });
  }
});
