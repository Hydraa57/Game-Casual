import { AVATAR_IDS, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';

/**
 * Avatar yang benar-benar dipakai pemain: pilihannya kalau masih bebas, atau
 * avatar bebas pertama kalau sudah diambil orang lain di room yang sama.
 *
 * Kenapa DIGANTI dan bukan DITOLAK: ini game buat main di tongkrongan, dan
 * memaksa orang memilih ulang cuma karena temannya lebih dulu menekan tombol
 * yang sama itu gesekan yang tidak ada gunanya. Avatar yang dipakai selalu
 * dikirim balik lewat `room:state`, jadi pemain tetap melihat kebenarannya.
 *
 * Yang TIDAK boleh terjadi adalah dua pemain berbagi avatar: capnya di sel
 * papan dipakai untuk tahu siapa yang menyerobot, dan avatar kembar membuat
 * informasi itu menyesatkan, bukan cuma membingungkan.
 */
export function resolveAvatar(preferred: AvatarId, taken: readonly AvatarId[]): AvatarId {
  if (!taken.includes(preferred)) return preferred;

  const free = AVATAR_IDS.find((candidate) => !taken.includes(candidate));
  // `free` hanya undefined kalau semua avatar terpakai. Itu tidak mungkin
  // terjadi selama jumlah avatar ≥ MAX_PLAYERS_LIMIT (dijaga test), tapi
  // mengembalikan default lebih baik daripada melempar exception di jalur
  // join — pemain kehilangan keunikan avatarnya, bukan kehilangan room-nya.
  return free ?? DEFAULT_AVATAR;
}
