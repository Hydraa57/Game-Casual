import { db } from '@pixelmatrix/db';
import type { MatchEndedPayload, MatchResultEntry, RoomSettings } from '@pixelmatrix/shared';

export interface FinishedMatch {
  readonly roomCode: string;
  readonly settings: RoomSettings;
  readonly endReason: MatchEndedPayload['reason'];
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly ranking: readonly MatchResultEntry[];
}

/**
 * Simpan hasil satu match.
 *
 * Tiga sifat yang menentukan bentuk fungsi ini:
 *
 * 1. **Tanpa database ia diam saja.** `db()` mengembalikan null kalau
 *    DATABASE_URL tidak diset, dan itu keadaan yang sah — game harus tetap
 *    bisa dimainkan tanpa persistensi apa pun.
 * 2. **Kegagalannya tidak boleh menjatuhkan match.** Match sudah selesai dan
 *    pemain sudah melihat hasilnya; kalau tulisan ke DB gagal, yang hilang
 *    cuma satu baris riwayat. Melempar exception di sini akan mematikan
 *    proses server dan mengusir semua room lain yang sedang bermain.
 * 3. **Dijalankan tanpa ditunggu.** Pemanggilnya ada di jalur `finish()` yang
 *    juga menyiarkan hasil ke pemain; menunggu round-trip database di sana
 *    akan menunda layar hasil.
 */
export async function saveMatch(match: FinishedMatch): Promise<boolean> {
  const prisma = db();
  if (prisma === null) return false;

  try {
    await prisma.match.create({
      data: {
        roomCode: match.roomCode,
        settings: { ...match.settings },
        endReason: match.endReason,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
        players: {
          create: match.ranking.map((entry) => ({
            // userId tetap null sampai auth masuk (Fase 3 bagian NextAuth).
            // Guest sengaja tetap dicatat: itu cara main yang paling umum, dan
            // membuang match tanpa login berarti membuang hampir semua riwayat.
            nickname: entry.nickname,
            avatar: entry.avatar,
            score: entry.score,
            rank: entry.rank,
            accuracy: entry.accuracy,
            bestCombo: entry.bestCombo,
            knockouts: entry.knockouts,
            eliminated: entry.eliminated,
          })),
        },
      },
    });
    return true;
  } catch (error) {
    console.error('[persistence] gagal menyimpan match:', error);
    return false;
  }
}
