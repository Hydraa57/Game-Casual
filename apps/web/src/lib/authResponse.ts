import { NextResponse } from 'next/server';

/**
 * Kode error yang boleh dilihat client.
 *
 * `invalidCredentials` sengaja tidak membedakan "username tidak ada" dari
 * "password salah". Membedakannya berarti siapa pun bisa memakai form login
 * untuk memeriksa username mana yang terdaftar.
 */
export type AuthErrorCode =
  | 'usernameLength'
  | 'usernameChars'
  | 'passwordLength'
  | 'usernameTaken'
  | 'invalidCredentials'
  | 'noDatabase'
  | 'badRequest';

export function authError(code: AuthErrorCode, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: code }, { status });
}
