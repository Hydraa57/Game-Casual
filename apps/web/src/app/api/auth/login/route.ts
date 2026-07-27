import { NextResponse } from 'next/server';
import { db, verifyPassword } from '@pixelmatrix/db';
import { authError } from '@/lib/authResponse';
import { normalizeUsername } from '@/lib/credentials';
import { createSession } from '@/lib/session';

export async function POST(request: Request): Promise<NextResponse> {
  const prisma = db();
  if (prisma === null) return authError('noDatabase', 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authError('badRequest', 400);
  }

  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return authError('badRequest', 400);
  }

  const user = await prisma.user.findUnique({
    where: { usernameLower: normalizeUsername(username) },
  });

  // Password tetap diverifikasi terhadap hash palsu saat user tidak ada,
  // supaya lamanya respons tidak membocorkan username mana yang terdaftar.
  const stored = user?.passwordHash ?? DUMMY_HASH;
  const matches = await verifyPassword(password, stored);

  if (!user || !matches) return authError('invalidCredentials', 401);

  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    user: { username: user.username, avatar: user.avatar, soloHighScore: user.soloHighScore },
  });
}

/**
 * Hash dari password acak yang tidak pernah dipakai siapa pun.
 *
 * Gunanya hanya untuk membakar waktu scrypt yang sama saat username tidak
 * ditemukan. Tanpa ini, login dengan username asing membalas jauh lebih cepat
 * daripada username yang ada — dan itu cukup untuk memetakan siapa saja yang
 * punya akun.
 */
const DUMMY_HASH =
  '00000000000000000000000000000000:' +
  '0000000000000000000000000000000000000000000000000000000000000000' +
  '0000000000000000000000000000000000000000000000000000000000000000';
