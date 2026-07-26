import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@pixelmatrix/shared';

const STORAGE_KEY = 'pm.nickname.v1';

/** Nickname terakhir diingat supaya teman tidak mengetik ulang setiap kali main. */
export function readNickname(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeNickname(nickname: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, nickname);
  } catch {
    // Tidak apa-apa — pemain cukup mengetik ulang.
  }
}

export function isValidNickname(nickname: string): boolean {
  const trimmed = nickname.trim();
  return (
    trimmed.length >= NICKNAME_MIN_LENGTH &&
    trimmed.length <= NICKNAME_MAX_LENGTH &&
    /^[\p{L}\p{N} _.-]+$/u.test(trimmed)
  );
}
