import { TEAM_IDS, TEAM_MATCH_SIZES } from '../constants/index';
import type { TeamId } from '../types/index';

/**
 * Aturan pembagian regu.
 *
 * Ditulis sebagai fungsi murni di `shared`, bukan sebagai method di `Room`,
 * karena keduanya dipakai di dua sisi: server memutuskan, dan lobby di client
 * harus bisa MENJELASKAN keputusan yang sama tanpa menebak-nebak. Kalau
 * aturannya cuma hidup di server, tombol "pindah regu" di client hanya bisa
 * mencoba lalu menampilkan error — dan pemain baru tahu tindakannya tidak sah
 * setelah menekannya.
 */

/** Regu lawan. Ada supaya tidak ada yang menulis `t === 'a' ? 'b' : 'a'` lagi. */
export function otherTeam(team: TeamId): TeamId {
  return team === 'a' ? 'b' : 'a';
}

/** Berapa kursi per regu di room sebesar ini. */
export function teamCapacity(maxPlayers: number): number {
  return Math.floor(maxPlayers / TEAM_IDS.length);
}

/**
 * Regu mana yang harus diisi berikutnya.
 *
 * Yang paling sedikit anggotanya; seri jatuh ke regu pertama. Dipakai saat
 * pemain masuk dan saat bot ditambahkan — keduanya lewat jalur yang sama,
 * supaya bot tidak pernah menjadi kasus khusus yang lupa diseimbangkan.
 */
export function balancedTeamFor(counts: Readonly<Record<TeamId, number>>): TeamId {
  return counts.a <= counts.b ? 'a' : 'b';
}

/**
 * Boleh tidak pemain pindah ke regu ini?
 *
 * Ditolak kalau regunya sudah penuh. Tidak ditolak kalau regu asal jadi kosong
 * — pemain boleh saja semua berkumpul di satu sisi selama di lobby; yang
 * menahan match dimulai adalah `teamsReady`, bukan larangan berpindah. Melarang
 * perpindahan yang membuat tidak seimbang terdengar rapi tapi mengunci lobby:
 * dari 2v2, tidak ada satu pun yang bisa mulai bergerak ke 1v3 lalu 2v2 lagi
 * dengan susunan berbeda tanpa ada yang keluar duluan.
 */
export function canJoinTeam(
  counts: Readonly<Record<TeamId, number>>,
  team: TeamId,
  maxPlayers: number,
): boolean {
  return counts[team] < teamCapacity(maxPlayers);
}

/** Susunan regu yang sah untuk memulai match: genap, simetris, dan tidak kosong. */
export function teamsReady(counts: Readonly<Record<TeamId, number>>): boolean {
  if (counts.a === 0 || counts.b === 0) return false;
  if (counts.a !== counts.b) return false;
  return (TEAM_MATCH_SIZES as readonly number[]).includes(counts.a + counts.b);
}

/**
 * Target skor satu regu: target per pemain dikali jumlah anggotanya.
 *
 * Dikali, bukan dipakai apa adanya. Poin seluruh anggota dijumlahkan, jadi
 * target 1000 yang sama untuk regu berempat akan tercapai kira-kira empat kali
 * lebih cepat — match 2v2 dan 4v4 akan punya panjang yang sama sekali berbeda
 * padahal host memilih angka yang sama.
 *
 * Dihitung dari jumlah anggota REGU ITU SENDIRI, bukan dari separuh jumlah
 * pemain match. Kalau di tengah match ada yang keluar dan regunya tinggal
 * bertiga melawan berempat, targetnya ikut turun — regu yang kehilangan orang
 * tidak dihukum dua kali.
 */
export function teamTargetScore(targetPerPlayer: number, memberCount: number): number {
  return targetPerPlayer * memberCount;
}
