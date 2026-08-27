import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferensi bunyi, disimpan di HP.
 *
 * Key-nya disamakan dengan versi web (`pm.muted`) dengan alasan yang sama
 * seperti rekor: penyimpanannya memang terpisah, tapi kalau suatu saat
 * preferensi ikut akun, kedua sisi bicara soal hal yang sama.
 */
const KUNCI_BISU = 'pm.muted';

export async function bacaBisu(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KUNCI_BISU)) === '1';
  } catch {
    // Gagal membaca preferensi bukan alasan untuk tidak bisa main.
    return false;
  }
}

export async function simpanBisu(bisu: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KUNCI_BISU, bisu ? '1' : '0');
  } catch {
    // Preferensinya hilang saat aplikasi ditutup; permainannya tetap jalan.
  }
}
