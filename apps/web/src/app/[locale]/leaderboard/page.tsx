import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Leaderboard } from '@/components/Leaderboard';
import { Link } from '@/i18n/navigation';

export default async function LeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Page />;
}

function Page() {
  const t = useTranslations('leaderboard');

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
      </div>

      <h1 className="pageTitle">{t('title')}</h1>
      <p className="hint">{t('subtitle')}</p>

      <Leaderboard />
    </main>
  );
}
