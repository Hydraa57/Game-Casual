import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Rekor skor solo, disimpan di HP.
 *
 * Key-nya SAMA dengan yang dipakai versi web (`pm.solo.highscore.v1`), tapi
 * penyimpanannya terpisah dan memang harus terpisah: ini aplikasi lain di
 * perangkat lain, tidak ada jalan bagi keduanya untuk saling membaca. Namanya
 * disamakan supaya kalau suatu saat rekor disatukan lewat akun, kedua sisi
 * bicara soal angka yang sama.
 *
 * Versi di belakang key sengaja dipertahankan: begitu rekor pindah ke akun,
 * migrasinya butuh cara membedakan yang lama dari yang baru.
 */
const KUNCI = 'pm.solo.highscore.v1';

function urai(mentah: string | null): number {
  if (mentah === null) return 0;
  const angka = Number.parseInt(mentah, 10);
  return Number.isFinite(angka) && angka > 0 ? angka : 0;
}

export async function bacaRekor(): Promise<number> {
  try {
    return urai(await AsyncStorage.getItem(KUNCI));
  } catch {
    // Penyimpanan bisa gagal (disk penuh, profil terkunci). Rekornya hilang;
    // permainannya tetap jalan, dan itu yang lebih penting.
    return 0;
  }
}

/**
 * Simpan `skor` kalau ia memang mengalahkan rekor yang tersimpan.
 *
 * Perbandingannya dilakukan DI SINI, bukan di layar yang memanggil. Layar
 * memegang rekor versi ingatannya sendiri, dan ingatan itu bisa tertinggal —
 * misalnya kalau ronde berikutnya dimulai sebelum pembacaan pertama selesai.
 * Membaca ulang sebelum menulis membuat rekor yang lebih tinggi tidak mungkin
 * tertimpa oleh yang lebih rendah.
 *
 * Mengembalikan rekor yang berlaku setelah pemanggilan ini.
 */
export async function simpanRekorKalauLebihTinggi(skor: number): Promise<number> {
  try {
    const tersimpan = urai(await AsyncStorage.getItem(KUNCI));
    if (skor <= tersimpan) return tersimpan;

    await AsyncStorage.setItem(KUNCI, String(skor));
    return skor;
  } catch {
    return skor;
  }
}
