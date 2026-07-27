import { NextResponse } from 'next/server';
import { db } from '@pixelmatrix/db';

const LIMIT = 20;

export interface LeaderboardRow {
  readonly rank: number;
  readonly username: string;
  readonly avatar: string;
  readonly score: number;
}

/**
 * Papan skor solo tertinggi.
 *
 * Hanya membaca kolom `soloHighScore` yang sudah didenormalisasi di `User` —
 * bukan mengagregasi tabel `SoloScore`. Untuk daftar yang dibuka sesering ini,
 * satu index scan jauh lebih murah daripada GROUP BY seluruh riwayat.
 *
 * Yang dikirim hanya nama, avatar, dan skor. Tidak ada id internal, tidak ada
 * tanggal daftar — halaman publik tidak perlu tahu apa pun selain itu.
 */
export async function GET(): Promise<NextResponse> {
  const prisma = db();
  if (prisma === null) return NextResponse.json({ ok: true, rows: [] });

  const users = await prisma.user.findMany({
    // Pemain yang belum pernah mencetak skor tidak ditampilkan: daftar penuh
    // nol membuat papan skor terasa mati, bukan terasa baru.
    where: { soloHighScore: { gt: 0 } },
    orderBy: [{ soloHighScore: 'desc' }, { createdAt: 'asc' }],
    take: LIMIT,
    select: { username: true, avatar: true, soloHighScore: true },
  });

  const rows: LeaderboardRow[] = users.map((user, index) => ({
    rank: index + 1,
    username: user.username,
    avatar: user.avatar,
    score: user.soloHighScore,
  }));

  return NextResponse.json({ ok: true, rows });
}
