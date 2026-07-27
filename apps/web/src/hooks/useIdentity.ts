'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AvatarId } from '@pixelmatrix/shared';
import { writeAvatar } from '@/lib/avatar';
import { readGuestChoice, writeGuestChoice } from '@/lib/identity';
import { writeNickname } from '@/lib/nickname';

export interface AccountUser {
  readonly username: string;
  readonly avatar: string;
  readonly soloHighScore: number;
}

export type Identity =
  /** Status sesi belum diketahui — jangan gambar apa pun dulu. */
  | { readonly kind: 'loading' }
  /** Belum memilih apa-apa: gerbang harus muncul. */
  | { readonly kind: 'none' }
  | { readonly kind: 'guest' }
  | { readonly kind: 'account'; readonly user: AccountUser };

export interface UseIdentity {
  readonly identity: Identity;
  chooseGuest(): void;
  adoptAccount(user: AccountUser): void;
  /** Keluar dari akun DAN dari pilihan guest — kembali ke gerbang. */
  reset(): Promise<void>;
}

/**
 * Siapa pemain ini: guest, pemilik akun, atau belum memilih.
 *
 * Sesi akun dibaca dari server (`/api/auth/me`) sementara pilihan guest dari
 * localStorage. Akun selalu menang: kalau seseorang login, pilihan guest yang
 * pernah tersimpan tidak lagi relevan.
 */
export function useIdentity(): UseIdentity {
  const [identity, setIdentity] = useState<Identity>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const settle = (user: AccountUser | null) => {
      if (cancelled) return;
      if (user !== null) {
        // Disinkronkan di SETIAP pemuatan, bukan hanya saat baru login.
        // Pemain yang sesinya masih hidup dari kunjungan lalu tidak pernah
        // melewati jalur login, jadi tanpa ini lobby multiplayer menawarkan
        // nickname lama — dan match-nya tercatat atas nama yang berbeda dari
        // akunnya.
        syncIdentityToDevice(user);
        setIdentity({ kind: 'account', user });
        return;
      }
      setIdentity(readGuestChoice() ? { kind: 'guest' } : { kind: 'none' });
    };

    void fetch('/api/auth/me')
      .then((response) => response.json() as Promise<{ user: AccountUser | null }>)
      .then((data) => settle(data.user))
      // Endpoint akun bermasalah tidak boleh mengunci pemain di luar game.
      // Jatuh ke perilaku tanpa akun: gerbang tetap muncul, guest tetap bisa.
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
  }, []);

  const chooseGuest = useCallback(() => {
    writeGuestChoice(true);
    setIdentity({ kind: 'guest' });
  }, []);

  const adoptAccount = useCallback((user: AccountUser) => {
    // Pilihan guest dibuang: kalau nanti logout, pemain harus memilih lagi
    // dengan sadar, bukan diam-diam kembali jadi guest.
    writeGuestChoice(false);
    syncIdentityToDevice(user);
    setIdentity({ kind: 'account', user });
  }, []);

  const reset = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    writeGuestChoice(false);
    setIdentity({ kind: 'none' });
  }, []);

  return { identity, chooseGuest, adoptAccount, reset };
}

/**
 * Nama dan karakter akun menjadi identitas yang dipakai lobby multiplayer.
 *
 * Akun yang login adalah identitas yang otoritatif — kalau lobby memakai
 * nickname lain, riwayat match tidak akan cocok dengan nama di papan skor.
 */
function syncIdentityToDevice(user: AccountUser): void {
  writeNickname(user.username);
  writeAvatar(user.avatar as AvatarId);
}
