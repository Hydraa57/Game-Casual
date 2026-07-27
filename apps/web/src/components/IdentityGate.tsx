'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { AuthForm } from './AuthForm';
import type { AccountUser, Identity } from '@/hooks/useIdentity';

export interface IdentityGateProps {
  readonly identity: Identity;
  readonly onChooseGuest: () => void;
  readonly onAdoptAccount: (user: AccountUser) => void;
  readonly onReset: () => void;
  /** Ditampilkan hanya setelah pemain punya identitas. */
  readonly children: React.ReactNode;
}

/**
 * Gerbang identitas: tidak ada yang bisa main sebelum melewatinya.
 *
 * Sebelumnya akun cuma panel opsional di samping tombol main, dan akibatnya
 * hampir tidak ada yang akan membuatnya — padahal riwayat permainan justru
 * yang membuat orang kembali. Sekarang pilihannya sadar dan di depan, tapi
 * "guest" tetap satu ketukan supaya janji "buka link, langsung main" tidak
 * dikhianati.
 */
export function IdentityGate({
  identity,
  onChooseGuest,
  onAdoptAccount,
  onReset,
  children,
}: IdentityGateProps) {
  const t = useTranslations('auth');
  const [showForm, setShowForm] = useState(false);

  // Jangan gambar apa pun sampai status sesi diketahui: gerbang yang muncul
  // sekejap lalu hilang untuk pemain yang sudah login itu mengganggu.
  if (identity.kind === 'loading') return null;

  if (identity.kind === 'none') {
    return (
      <section className="gate">
        <h2 className="card__title">{t('gateTitle')}</h2>

        {showForm ? (
          <>
            <AuthForm onSignedIn={onAdoptAccount} />
            <button className="btn btn--small" type="button" onClick={() => setShowForm(false)}>
              ← {t('gateBack')}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn--primary btn--block"
              type="button"
              onClick={() => setShowForm(true)}
            >
              {t('gateAccount')}
            </button>
            <p className="hint">{t('gateAccountNote')}</p>

            <div className="entry__divider">
              <span>{t('or')}</span>
            </div>

            <button className="btn btn--block" type="button" onClick={onChooseGuest}>
              {t('gateGuest')}
            </button>
            <p className="hint">{t('gateGuestNote')}</p>
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="account">
        <span className="account__who">
          {identity.kind === 'account' ? (
            <>
              <span className="avatarMark" aria-hidden="true">
                {AVATAR_GLYPH[(identity.user.avatar as AvatarId) ?? DEFAULT_AVATAR]}
              </span>
              <span>
                <span className="account__name">{identity.user.username}</span>
                <span className="account__score">
                  {' '}
                  · {t('highScore')} {identity.user.soloHighScore}
                </span>
              </span>
            </>
          ) : (
            <span>
              <span className="account__name">{t('guestLabel')}</span>
              <span className="account__score"> · {t('guestNotSaved')}</span>
            </span>
          )}
        </span>
        <button className="btn btn--small" type="button" onClick={onReset}>
          {identity.kind === 'account' ? t('logout') : t('switch')}
        </button>
      </div>

      {children}
    </>
  );
}
