import { AVATAR_IDS, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';

const STORAGE_KEY = 'pm.avatar.v1';

function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

/**
 * Avatar terakhir diingat, sama seperti nickname: teman-teman biasanya memakai
 * karakter yang sama tiap kali main, dan itu bagian dari cara mereka saling
 * mengenali di papan.
 */
export function readAvatar(): AvatarId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Divalidasi, bukan dipercaya: isi localStorage bisa berasal dari versi lama
    // yang daftarnya berbeda, dan avatar tak dikenal akan ditolak server.
    return stored !== null && isAvatarId(stored) ? stored : DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function writeAvatar(avatar: AvatarId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, avatar);
  } catch {
    // Tidak apa-apa — pemain cukup memilih ulang.
  }
}
