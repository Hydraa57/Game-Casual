import { readHighScore } from './highScore';

/**
 * Bawa rekor solo dari masa guest ke akun yang baru saja dipakai.
 *
 * Kenapa ini ada: sebelum punya akun, pemain bisa saja sudah mengumpulkan
 * rekor lumayan sebagai guest. Tanpa langkah ini, mendaftar akun justru
 * MENGHAPUS rekornya dari pandangan — profil dan leaderboard mulai dari nol
 * sementara angka lamanya cuma tersisa di localStorage. Mendaftar jadi terasa
 * seperti dihukum, padahal itu hal yang justru ingin kita dorong.
 *
 * Mengembalikan rekor baru akun kalau klaimnya berhasil, atau `null` kalau
 * tidak ada yang perlu dibawa.
 */
export async function claimGuestHighScore(accountHighScore: number): Promise<number | null> {
  const local = readHighScore();

  // Penjaga idempoten, dan sekaligus alasan kenapa ini tidak membebani setiap
  // pemuatan halaman: begitu klaimnya berhasil, rekor akun >= rekor lokal, jadi
  // percabangan ini tidak pernah mengirim request kedua. Endpoint-nya sendiri
  // juga menolak klaim ulang, tapi lebih baik tidak menanyakannya sama sekali.
  if (local <= accountHighScore) return null;

  try {
    const response = await fetch('/api/solo-scores/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: local }),
    });
    const data = (await response.json()) as { claimed?: boolean; soloHighScore?: number };
    return data.claimed === true && typeof data.soloHighScore === 'number'
      ? data.soloHighScore
      : null;
  } catch {
    // Gagal mengklaim bukan alasan untuk menahan pemain di luar game: rekornya
    // masih utuh di localStorage dan percobaan berikutnya terjadi sendiri saat
    // halaman dimuat lagi.
    return null;
  }
}
