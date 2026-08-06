'use client';

import { useTranslations } from 'next-intl';
import { IdentityGate } from './IdentityGate';
import { Link } from '@/i18n/navigation';
import { useIdentity } from '@/hooks/useIdentity';

/**
 * Menu utama landing page.
 *
 * Tombol main hanya muncul SETELAH pemain memilih guest atau akun. Sebelum
 * itu yang tampil hanya gerbangnya — identitas bukan pelengkap di samping,
 * melainkan langkah pertama.
 */
export function LandingMenu() {
  const t = useTranslations('landing');
  const { identity, chooseGuest, adoptAccount, reset } = useIdentity();

  return (
    <IdentityGate
      identity={identity}
      onChooseGuest={chooseGuest}
      onAdoptAccount={adoptAccount}
      onReset={() => void reset()}
    >
      <div className="actions">
        <Link className="btn btn--primary btn--block" href="/play/solo">
          {t('playSolo')}
        </Link>
        <Link className="btn btn--grape btn--block" href="/play/room">
          {t('playMultiplayer')}
        </Link>
        <Link className="btn btn--sky btn--block" href="/leaderboard">
          {t('leaderboard')}
        </Link>
        {identity.kind === 'account' && (
          <Link className="btn btn--bubblegum btn--block" href="/profile">
            {t('profile')}
          </Link>
        )}

        {/* Paling bawah dan bergaya kecil: ini bukan tujuan utama siapa pun yang
            membuka game, tapi harus ada dan mudah ditemukan. */}
        <Link className="btn btn--small btn--block" href="/about">
          {t('about')}
        </Link>
      </div>
    </IdentityGate>
  );
}
