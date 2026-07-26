import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Landing locale={locale as Locale} />;
}

function Landing({ locale }: { locale: Locale }) {
  const t = useTranslations('landing');
  const otherLocale: Locale = locale === 'id' ? 'en' : 'id';

  return (
    <main className="shell landing">
      <header>
        <h1 className="landing__title">{t('title')}</h1>
        <p className="landing__tagline">{t('tagline')}</p>
      </header>

      <p className="landing__intro">{t('intro')}</p>

      <section className="card">
        <h2 className="card__title">{t('howToTitle')}</h2>
        <ol className="steps">
          <li>{t('howTo.step1')}</li>
          <li>{t('howTo.step2')}</li>
          <li>{t('howTo.step3')}</li>
          <li>{t('howTo.step4')}</li>
        </ol>
      </section>

      <div className="actions">
        <Link className="btn btn--primary btn--block" href="/play/solo">
          {t('playSolo')}
        </Link>
        <Link className="btn btn--block" href="/play/room">
          {t('playMultiplayer')}
        </Link>
      </div>

      <Link className="btn btn--small" href="/" locale={otherLocale}>
        {t('switchLanguage')}
      </Link>
    </main>
  );
}
