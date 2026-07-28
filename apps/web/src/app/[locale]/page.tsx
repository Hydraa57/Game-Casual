import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LandingMenu } from '@/components/LandingMenu';
import { LoadingGate } from '@/components/LoadingGate';
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
    // Aset gamenya diunduh DULU, menunya dibuka setelahnya.
    //
    // Menggantikan `PrefetchGame` di halaman ini: pemanasan saat idle memang
    // tidak menghalangi apa pun, tapi ia juga tidak menjamin apa pun — pemain
    // yang langsung menekan "Main Solo" tetap menunggu ~330 KB Phaser dengan
    // layar yang tidak menjelaskan kenapa. Di sini penantiannya dipindahkan ke
    // depan, di tempat yang memang menjelaskan dirinya.
    //
    // `PrefetchGame` tetap dipakai di lobby room, di mana menahan pemain justru
    // salah: di sana ia sedang menunggu temannya, bukan menunggu unduhan.
    <LoadingGate>
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

        <LandingMenu />

        <Link className="btn btn--small" href="/" locale={otherLocale}>
          {t('switchLanguage')}
        </Link>
      </main>
    </LoadingGate>
  );
}
