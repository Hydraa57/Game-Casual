import { cookies } from 'next/headers';
import { db, newSessionToken } from '@pixelmatrix/db';

const COOKIE_NAME = 'pm_session';
/** 30 hari: game tongkrongan, memaksa login ulang tiap minggu itu menyebalkan. */
const SESSION_DAYS = 30;

export interface SessionUser {
  readonly id: string;
  readonly username: string;
  readonly avatar: string;
  readonly soloHighScore: number;
}

/**
 * Buat sesi baru dan pasang cookie-nya.
 *
 * Cookie-nya `httpOnly` supaya tidak bisa dibaca JavaScript — kalau ada celah
 * XSS di halaman mana pun, token sesi tetap tidak ikut tercuri.
 */
export async function createSession(userId: string): Promise<void> {
  const prisma = db();
  if (prisma === null) return;

  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken: token, userId, expires } });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // `secure` dimatikan di dev karena localhost memakai http; di produksi
    // wajib menyala, kalau tidak token bisa dibaca di jaringan WiFi umum.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

/** Pemain yang sedang login, atau `null` untuk guest. */
export async function currentUser(): Promise<SessionUser | null> {
  const prisma = db();
  if (prisma === null) return null;

  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });
  if (!session) return null;

  // Sesi kedaluwarsa dibuang saat ditemui, bukan lewat cron: volumenya kecil
  // dan ini membuat tabelnya bersih sendiri tanpa infrastruktur tambahan.
  if (session.expires.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  return {
    id: session.user.id,
    username: session.user.username,
    avatar: session.user.avatar,
    soloHighScore: session.user.soloHighScore,
  };
}

export async function destroySession(): Promise<void> {
  const prisma = db();
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (prisma !== null && token) {
    // Dihapus dari database juga, bukan sekadar cookie-nya: kalau token-nya
    // sempat tersalin ke tempat lain, menghapus cookie saja tidak mencabutnya.
    await prisma.session.deleteMany({ where: { sessionToken: token } }).catch(() => null);
  }

  store.delete(COOKIE_NAME);
}
