import { describe, expect, it } from 'vitest';
import { keVibrationRN } from './polaGetar';

describe('keVibrationRN', () => {
  it('angka tunggal diteruskan apa adanya', () => {
    // Satu angka berarti hal yang sama di web maupun React Native.
    expect(keVibrationRN(40)).toBe(40);
    expect(keVibrationRN(25)).toBe(25);
  });

  it('array digeser satu langkah dengan 0 di depan', () => {
    expect(keVibrationRN([50, 40, 90])).toEqual([0, 50, 40, 90]);
  });

  it('getaran PERTAMA tetap yang pertama, bukan jedanya', () => {
    /*
      Ini inti masalahnya, dan alasan berkas ini ada.

      Di React Native, angka berindeks GENAP adalah lama diam dan angka
      berindeks GANJIL adalah lama getar. Pola web [50, 40, 90] berarti "getar
      50, diam 40, getar 90"; diteruskan mentah-mentah ia jadi "diam 50, getar
      40, diam 90" — getaran 50 ms yang paling penting hilang sama sekali.
    */
    const hasil = keVibrationRN([50, 40, 90]) as number[];

    const diam = hasil.filter((_, i) => i % 2 === 0);
    const getar = hasil.filter((_, i) => i % 2 === 1);

    expect(getar).toEqual([50, 90]); // dua getaran dari pola web
    expect(diam).toEqual([0, 40]); // jeda awal nol, lalu jeda web-nya
  });

  it('array kosong tetap kosong isinya', () => {
    expect(keVibrationRN([])).toEqual([0]);
  });

  it('tidak mengubah array masukan', () => {
    const asli = [60, 50, 60];
    keVibrationRN(asli);
    expect(asli).toEqual([60, 50, 60]);
  });
});
