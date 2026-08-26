import { describe, expect, it } from 'vitest';
import { INITIAL_SNAPSHOT, isSameSnapshot } from './hud';
import type { HudSnapshot } from './hud';

/**
 * `isSameSnapshot` adalah perbandingan field-per-field yang ditulis tangan, dan
 * kegagalannya selalu berbentuk sama: seseorang menambah field baru ke
 * `HudSnapshot` dan lupa menambahkannya ke perbandingan. Akibatnya HUD berhenti
 * ikut berubah untuk field itu — tanpa error, tanpa test merah, dan gejalanya
 * cuma "kok angkanya nyangkut".
 *
 * Test ini menutup celah itu dengan mengubah SETIAP field satu per satu.
 */
describe('isSameSnapshot mendeteksi tiap field yang berubah', () => {
  /**
   * Field yang memang sengaja TIDAK dibandingkan.
   *
   * Daftarnya harus tetap pendek dan tiap barisnya harus punya alasan — kalau
   * ada field baru yang tidak dibandingkan dan tidak ada di sini, test di bawah
   * akan gagal, dan itu memang tujuannya.
   */
  const SENGAJA_DIABAIKAN: Readonly<Record<string, string>> = {
    // Berubah tiap frame dan tidak pernah digambar. Membandingkannya membuat
    // seluruh HUD re-render 60× per detik — persis yang dihindari fungsi ini.
    elapsedMs: 'berubah tiap frame, tidak digambar',
    // Bergerak bersama `levelFraction` karena keduanya dihitung dari
    // `correctClicks` yang sama, jadi memeriksanya cuma pekerjaan ganda.
    clicksToNextLevel: 'selalu berubah bersama levelFraction',
  };

  /** Nilai lain untuk sebuah field, apa pun tipenya. */
  function ubah(nilai: unknown): unknown {
    if (typeof nilai === 'number') return nilai + 1;
    if (typeof nilai === 'boolean') return !nilai;
    if (nilai === null) return 'terisi';
    if (Array.isArray(nilai)) return [...nilai, 'blue'];
    if (typeof nilai === 'string') return `${nilai}-lain`;
    throw new Error(`belum tahu cara mengubah nilai bertipe ${typeof nilai}`);
  }

  for (const kunci of Object.keys(INITIAL_SNAPSHOT) as (keyof HudSnapshot)[]) {
    const diabaikan = kunci in SENGAJA_DIABAIKAN;

    it(`${kunci}${diabaikan ? ' (sengaja diabaikan)' : ''}`, () => {
      const berubah = {
        ...INITIAL_SNAPSHOT,
        [kunci]: ubah(INITIAL_SNAPSHOT[kunci]),
      } as HudSnapshot;

      expect(isSameSnapshot(INITIAL_SNAPSHOT, berubah)).toBe(diabaikan);
    });
  }

  it('snapshot yang identik dianggap sama', () => {
    expect(isSameSnapshot(INITIAL_SNAPSHOT, { ...INITIAL_SNAPSHOT })).toBe(true);
  });

  it('stroopInk null vs terisi terdeteksi berbeda', () => {
    // Jalur `null` punya cabangnya sendiri di `sameColors`, jadi ia diuji
    // terpisah — `ubah()` di atas hanya menyentuh arah null → terisi.
    const terisi: HudSnapshot = { ...INITIAL_SNAPSHOT, stroopInk: ['red'] };
    expect(isSameSnapshot(terisi, INITIAL_SNAPSHOT)).toBe(false);
    expect(isSameSnapshot(terisi, { ...terisi, stroopInk: ['blue'] })).toBe(false);
    expect(isSameSnapshot(terisi, { ...terisi, stroopInk: ['red'] })).toBe(true);
  });
});
