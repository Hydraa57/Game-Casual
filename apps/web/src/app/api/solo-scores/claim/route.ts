import { NextResponse } from 'next/server';
import { db } from '@pixelmatrix/db';
import { MAX_CLAIMABLE_SOLO_SCORE } from '@pixelmatrix/shared';
import { currentUser } from '@/lib/session';

/**
 * Bawa rekor solo yang dikumpulkan sebagai guest ke akun yang baru dibuat.
 *
 * Kenapa endpoint tersendiri, bukan lewat POST /api/solo-scores biasa: yang
 * tersimpan di localStorage hanyalah ANGKA rekornya — durasi ronde dan level
 * yang dicapai tidak pernah ikut disimpan. Mengirimkannya lewat endpoint biasa
 * berarti mengarang durasi supaya lolos pemeriksaan kewajaran, lalu menuliskan
 * karangan itu sebagai satu baris SoloScore. Riwayat dan data balancing jadi
 * tercemar oleh ronde yang tidak pernah terjadi.
 *
 * Jadi klaim hanya MENAIKKAN User.soloHighScore dan tidak membuat baris
 * SoloScore sama sekali. Artinya jujur: "kami tahu rekornya, kami tidak tahu
 * ronde-nya".
 *
 * Pengamannya adalah aturan sekali-pakai — klaim hanya diterima selagi akunnya
 * belum punya skor sama sekali (soloHighScore masih 0). Setelah pemain mencetak
 * satu skor lewat jalur normal, pintu ini tertutup permanen untuk akun itu.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const prisma = db();
  // Tanpa database tidak ada yang bisa dibawa ke mana pun; rekornya tetap
  // hidup di localStorage. Bukan error.
  if (prisma === null) return NextResponse.json({ ok: true, claimed: false });

  const user = await currentUser();
  if (user === null) return NextResponse.json({ ok: true, claimed: false });

  // Akun yang sudah punya skor tidak sedang "login pertama" lagi. Menolak di
  // sini juga yang membuat klaim tidak bisa diulang-ulang.
  if (user.soloHighScore > 0) return NextResponse.json({ ok: true, claimed: false });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }

  const { score } = (body ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(score) || (score as number) <= 0) {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }

  const claimed = score as number;
  if (claimed > MAX_CLAIMABLE_SOLO_SCORE) {
    return NextResponse.json({ ok: false, error: 'implausible' }, { status: 422 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { soloHighScore: claimed } });

  return NextResponse.json({ ok: true, claimed: true, soloHighScore: claimed });
}
