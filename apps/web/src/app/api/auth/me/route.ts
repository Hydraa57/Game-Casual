import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';

/** Siapa yang sedang login; `user: null` berarti guest — bukan error. */
export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  return NextResponse.json({ ok: true, user });
}
