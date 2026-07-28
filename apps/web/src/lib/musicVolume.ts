import { DEFAULT_MUSIC_VOLUME } from '@/game/music';

/**
 * Volume musik latar, 0..1, disimpan per perangkat.
 *
 * Terpisah dari `pm.muted.v1` yang sudah ada: mematikan bunyi dan mengecilkan
 * musik adalah dua niat berbeda. Pemain yang mengecilkan musik sampai nol tetap
 * ingin mendengar SFX-nya, dan yang menekan mute ingin senyap total tanpa
 * kehilangan setelan volumenya saat dinyalakan lagi.
 */
const STORAGE_KEY = 'pm.musicVolume.v1';

export function readMusicVolume(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_MUSIC_VOLUME;

    const parsed = Number.parseFloat(raw);
    // Isi localStorage bisa berasal dari versi lain atau diubah tangan; nilai
    // di luar 0..1 yang lolos ke gain akan menghasilkan bunyi pecah.
    if (!Number.isFinite(parsed)) return DEFAULT_MUSIC_VOLUME;
    return Math.min(1, Math.max(0, parsed));
  } catch {
    // Safari mode privat.
    return DEFAULT_MUSIC_VOLUME;
  }
}

export function writeMusicVolume(volume: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.min(1, Math.max(0, volume))));
  } catch {
    // Gagal menyimpan berarti setelannya kembali ke default ronde depan.
  }
}
