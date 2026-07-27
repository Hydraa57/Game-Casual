import { NextResponse } from 'next/server';
import { db } from '@pixelmatrix/db';
import { BASE_POINTS, GOLD_POINT_MULTIPLIER, MAX_SPEED_BONUS } from '@pixelmatrix/shared';
import { currentUser } from '@/lib/session';

/**
 * Batas atas skor yang masuk akal per detik bermain.
 *
 * Dihitung dari kasus terbaik yang mungkin: klik emas (poin ×5) dengan speed
 * bonus penuh dan multiplier tertinggi, pada kecepatan tap manusia (~5/detik).
 * Angka di atas ini tidak mungkin dicapai dengan bermain — hanya dengan
 * mengirim skor palsu ke endpoint ini.
 *
 * Dibuat longgar dengan sengaja: menolak skor jujur karena batasnya terlalu
 * ketat jauh lebih merusak daripada meloloskan satu skor palsu di game hobi.
 */
const MAX_POINTS_PER_SECOND = (BASE_POINTS + MAX_SPEED_BONUS) * GOLD_POINT_MULTIPLIER * 2 * 5;

export async function POST(request: Request): Promise<NextResponse> {
  const prisma = db();
  if (prisma === null) {
    // Tanpa database, skor solo tetap hidup di localStorage. Bukan error.
    return NextResponse.json({ ok: true, saved: false });
  }

  const user = await currentUser();
  // Guest memang tidak menyimpan riwayat — itu inti dari pilihan "guest vs
  // akun", bukan kegagalan.
  if (user === null) return NextResponse.json({ ok: true, saved: false });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }

  const { score, durationSeconds, level } = (body ?? {}) as Record<string, unknown>;
  if (
    !Number.isInteger(score) ||
    !Number.isInteger(durationSeconds) ||
    (score as number) < 0 ||
    (durationSeconds as number) <= 0
  ) {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }

  const finalScore = score as number;
  const seconds = durationSeconds as number;

  // Skor solo dihitung di browser, jadi endpoint ini tidak bisa memverifikasi
  // apa pun secara pasti — yang bisa dilakukan hanya menolak yang mustahil.
  if (finalScore > seconds * MAX_POINTS_PER_SECOND) {
    return NextResponse.json({ ok: false, error: 'implausible' }, { status: 422 });
  }

  const levelReached =
    Number.isInteger(level) && (level as number) > 0 ? Math.min(level as number, 999) : 1;

  await prisma.soloScore.create({
    data: { userId: user.id, score: finalScore, gameDurationSeconds: seconds, levelReached },
  });

  // Rekor hanya naik, tidak pernah turun.
  if (finalScore > user.soloHighScore) {
    await prisma.user.update({ where: { id: user.id }, data: { soloHighScore: finalScore } });
  }

  return NextResponse.json({
    ok: true,
    saved: true,
    soloHighScore: Math.max(finalScore, user.soloHighScore),
  });
}
