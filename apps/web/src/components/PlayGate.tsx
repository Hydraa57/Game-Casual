'use client';

import { useTranslations } from 'next-intl';
import { IdentityGate } from './IdentityGate';
import { Link } from '@/i18n/navigation';
import { useIdentity } from '@/hooks/useIdentity';

/**
 * Pembungkus halaman main: game baru dirender setelah pemain punya identitas.
 *
 * Gerbangnya dipasang di sini, bukan sebagai redirect ke landing, karena
 * halaman main sering dibuka langsung — terutama `/play/room?code=` dari link
 * undangan teman. Melempar orang itu ke landing berarti kode room-nya hilang
 * dan dia harus meminta ulang.
 */
export function PlayGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');
  const { identity, chooseGuest, adoptAccount, reset } = useIdentity();

  if (identity.kind === 'loading') return null;

  if (identity.kind === 'none') {
    return (
      <main className="shell">
        <div className="topbar">
          <Link className="btn btn--small" href="/">
            ← {t('gateHome')}
          </Link>
        </div>
        <IdentityGate
          identity={identity}
          onChooseGuest={chooseGuest}
          onAdoptAccount={adoptAccount}
          onReset={() => void reset()}
        >
          {null}
        </IdentityGate>
      </main>
    );
  }

  return <>{children}</>;
}
