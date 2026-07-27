import { NextResponse } from 'next/server';
import { signPlayerToken } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { currentUser } from '@/lib/session';

/**
 * Terbitkan token identitas berumur pendek untuk game-server.
 *
 * Cookie sesi `httpOnly` tidak bisa dibaca JavaScript — itu memang gunanya —
 * jadi client tidak bisa meneruskannya sendiri ke game-server. Endpoint ini
 * menukarnya dengan token terpisah yang boleh dibaca client, berumur satu
 * menit, dan hanya berisi identitas publik.
 *
 * `token: null` bukan error: guest memang tidak punya identitas untuk
 * dibuktikan, dan tanpa AUTH_SECRET fitur ini memang mati.
 */
export async function GET(): Promise<NextResponse> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ ok: true, token: null });

  const user = await currentUser();
  if (user === null) return NextResponse.json({ ok: true, token: null });

  const token = await signPlayerToken(
    { userId: user.id, username: user.username, avatar: user.avatar as AvatarId },
    secret,
  );
  return NextResponse.json({ ok: true, token });
}
