'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarId } from '@pixelmatrix/shared';
import { writeAvatar } from '@/lib/avatar';
import { claimGuestHighScore } from '@/lib/claimHighScore';
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

  // Klaim rekor berjalan asinkron dan bisa selesai setelah komponennya lepas.
  // Tanpa penjaga ini, hasilnya akan mencoba menulis state yang sudah tidak ada.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Jadikan `user` identitas aktif, lalu bawa rekor guest-nya kalau ada.
   *
   * Dipakai baik oleh sesi yang dipulihkan maupun login baru. Keduanya harus
   * lewat sini: pemain bisa saja main sebagai guest di perangkat ini SETELAH
   * akunnya dibuat di perangkat lain, jadi membatasi klaim pada momen login
   * saja akan melewatkan kasus itu.
   */
  const adopt = useCallback((user: AccountUser) => {
    // Disinkronkan di SETIAP pemuatan, bukan hanya saat baru login. Pemain yang
    // sesinya masih hidup dari kunjungan lalu tidak pernah melewati jalur
    // login, jadi tanpa ini lobby multiplayer menawarkan nickname lama — dan
    // match-nya tercatat atas nama yang berbeda dari akunnya.
    syncIdentityToDevice(user);
    setIdentity({ kind: 'account', user });

    void claimGuestHighScore(user.soloHighScore).then((soloHighScore) => {
      if (soloHighScore === null || !mounted.current) return;
      setIdentity({ kind: 'account', user: { ...user, soloHighScore } });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const settle = (user: AccountUser | null) => {
      if (cancelled) return;
      if (user !== null) {
        adopt(user);
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
  }, [adopt]);

  const chooseGuest = useCallback(() => {
    writeGuestChoice(true);
    setIdentity({ kind: 'guest' });
  }, []);

  const adoptAccount = useCallback(
    (user: AccountUser) => {
      // Pilihan guest dibuang: kalau nanti logout, pemain harus memilih lagi
      // dengan sadar, bukan diam-diam kembali jadi guest.
      writeGuestChoice(false);
      adopt(user);
    },
    [adopt],
  );

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
