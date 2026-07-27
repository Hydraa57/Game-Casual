import { NextResponse } from 'next/server';
import { db, hashPassword } from '@pixelmatrix/db';
import { AVATAR_IDS, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import { authError } from '@/lib/authResponse';
import { normalizeUsername, validatePassword, validateUsername } from '@/lib/credentials';
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

  const { username, password, avatar } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return authError('badRequest', 400);
  }

  const usernameProblem = validateUsername(username);
  if (usernameProblem !== null) return authError(usernameProblem, 400);

  const passwordProblem = validatePassword(password);
  if (passwordProblem !== null) return authError(passwordProblem, 400);

  const chosenAvatar =
    typeof avatar === 'string' && (AVATAR_IDS as readonly string[]).includes(avatar)
      ? avatar
      : DEFAULT_AVATAR;

  try {
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        usernameLower: normalizeUsername(username),
        passwordHash: await hashPassword(password),
        avatar: chosenAvatar,
      },
    });
    await createSession(user.id);
    return NextResponse.json({
      ok: true,
      user: { username: user.username, avatar: user.avatar, soloHighScore: user.soloHighScore },
    });
  } catch (error) {
    // Bentrok username ditangkap dari constraint database, bukan dari cek
    // "apakah sudah ada" sebelumnya: dua pendaftaran bersamaan bisa lolos
    // pemeriksaan itu berdua, dan database adalah satu-satunya tempat yang
    // benar-benar bisa memutuskan siapa yang lebih dulu.
    if (isUniqueViolation(error)) return authError('usernameTaken', 409);
    console.error('[auth] signup gagal:', error);
    return authError('badRequest', 500);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
