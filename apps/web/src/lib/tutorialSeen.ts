import { TUTORIAL_LEVELS } from '@pixelmatrix/shared';
import type { TutorialTopic } from '@pixelmatrix/shared';

/**
 * Penjelasan mekanik yang sudah pernah dilihat pemain di perangkat ini.
 *
 * Per-perangkat lewat localStorage, bukan per-akun: guest adalah cara main yang
 * sepenuhnya sah (lihat schema.prisma), dan penjelasan yang muncul berulang
 * setiap ronde untuk pemain tanpa akun jauh lebih menjengkelkan daripada
 * penjelasan yang muncul dua kali karena pindah HP.
 */
const STORAGE_KEY = 'pm.solo.tutorial.v1';

const KNOWN_TOPICS = new Set<string>(Object.keys(TUTORIAL_LEVELS));

export function readTutorialSeen(): readonly TutorialTopic[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Disaring terhadap daftar yang dikenal: isi localStorage bisa berasal dari
    // versi lama yang punya nama topik berbeda, dan nama asing yang lolos akan
    // membungkam penjelasan yang seharusnya muncul.
    return parsed.filter(
      (value): value is TutorialTopic => typeof value === 'string' && KNOWN_TOPICS.has(value),
    );
  } catch {
    // Safari mode privat, atau JSON rusak.
    return [];
  }
}

export function markTutorialSeen(topic: TutorialTopic): void {
  try {
    const next = [...new Set([...readTutorialSeen(), topic])];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Gagal menyimpan berarti penjelasannya muncul lagi ronde depan. Tidak ideal,
    // tapi bukan alasan menggagalkan permainan.
  }
}

/** Dipakai halaman pengaturan/uji untuk menampilkan ulang semua penjelasan. */
export function resetTutorialSeen(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sama seperti di atas.
  }
}
