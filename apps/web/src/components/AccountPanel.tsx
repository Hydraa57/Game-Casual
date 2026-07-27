'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { AuthForm } from './AuthForm';
import { writeAvatar } from '@/lib/avatar';
import { writeNickname } from '@/lib/nickname';

interface AccountUser {
  readonly username: string;
  readonly avatar: string;
  readonly soloHighScore: number;
}

/**
 * Panel akun di landing page.
 *
 * Sengaja tidak memblokir apa pun: pemain yang belum punya akun tetap melihat
 * kedua tombol main. Akun itu tambahan, bukan gerbang — memaksa daftar dulu
 * akan membunuh cara main "buka link, langsung main" yang jadi inti game ini.
 */
export function AccountPanel() {
  const t = useTranslations('auth');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/me')
      .then((response) => response.json() as Promise<{ user: AccountUser | null }>)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => {
        // Gagal memeriksa sesi = perlakukan sebagai guest. Landing page tidak
        // boleh gagal tampil hanya karena endpoint akun bermasalah.
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((signedIn: AccountUser) => {
    setUser(signedIn);
    setShowForm(false);
    // Nama dan karakter akun langsung dipakai di lobby multiplayer, jadi
    // pemain tidak perlu mengetik ulang identitas yang sama.
    writeNickname(signedIn.username);
    writeAvatar((signedIn.avatar as AvatarId) ?? DEFAULT_AVATAR);
  }, []);

  const logout = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST' }).then(() => setUser(null));
  }, []);

  // Tidak menampilkan apa pun sampai status sesi diketahui: panel yang
  // berkedip dari "daftar" ke "halo, Budi" itu mengganggu.
  if (!loaded) return null;

  if (user !== null) {
    return (
      <div className="account">
        <span className="account__who">
          <span className="avatarMark" aria-hidden="true">
            {AVATAR_GLYPH[(user.avatar as AvatarId) ?? DEFAULT_AVATAR]}
          </span>
          <span>
            <span className="account__name">{user.username}</span>
            <span className="account__score">
              {' '}
              · {t('highScore')} {user.soloHighScore}
            </span>
          </span>
        </span>
        <button className="btn btn--small" type="button" onClick={logout}>
          {t('logout')}
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button className="btn btn--small" type="button" onClick={() => setShowForm(true)}>
        {t('title')}
      </button>
    );
  }

  return <AuthForm onSignedIn={adopt} />;
}
