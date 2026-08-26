import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { GITHUB_ISSUES_URL, SUPPORT_EMAIL } from '@pixelmatrix/shared';
import { Link } from '@/i18n/navigation';

/**
 * Kebijakan privasi.
 *
 * **Halaman ini wajib ada dan wajib bisa dibuka publik** — Google Play menolak
 * aplikasi yang URL kebijakan privasinya tidak bisa diakses, dan URL inilah
 * yang dimasukkan ke Play Console.
 *
 * Isinya ditulis dari apa yang BENAR-BENAR disimpan: skema Prisma di
 * `packages/db` dan izin yang benar-benar ada di AndroidManifest, bukan dari
 * templat kebijakan yang menyebut hal-hal yang tidak dilakukan aplikasi ini.
 * Kebijakan yang mengaku mengumpulkan lebih banyak dari kenyataan sama
 * menyesatkannya dengan yang mengaku lebih sedikit.
 *
 * Statis sepenuhnya, jadi tidak perlu jadi client component.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Privacy />;
}

function Privacy() {
  const t = useTranslations('privacy');

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
        <span className="hud__label">{t('updated')}</span>
      </div>

      <h1 className="pageTitle">{t('title')}</h1>

      <section className="card">
        <h2 className="card__title">{t('summaryTitle')}</h2>
        <p className="hint">{t('summary')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('androidTitle')}</h2>
        <ul className="steps">
          <li>{t('androidSolo')}</li>
          <li>{t('androidStorage')}</li>
          <li>{t('androidPermissions')}</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="card__title">{t('accountTitle')}</h2>
        <p className="hint">{t('accountIntro')}</p>
        <ul className="steps">
          <li>{t('accountUsername')}</li>
          <li>{t('accountPassword')}</li>
          <li>{t('accountEmail')}</li>
          <li>{t('accountAvatar')}</li>
          <li>{t('accountScores')}</li>
        </ul>
        <p className="hint">{t('accountWhy')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('guestTitle')}</h2>
        <p className="hint">{t('guest')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('neverTitle')}</h2>
        <ul className="steps">
          <li>{t('neverLocation')}</li>
          <li>{t('neverContacts')}</li>
          <li>{t('neverAdId')}</li>
          <li>{t('neverTracking')}</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="card__title">{t('sharingTitle')}</h2>
        <p className="hint">{t('sharing')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('deleteTitle')}</h2>
        <p className="hint">{t('delete')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('childrenTitle')}</h2>
        <p className="hint">{t('children')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('changesTitle')}</h2>
        <p className="hint">{t('changes')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('contactTitle')}</h2>
        <p className="hint">{t('contact')}</p>
        {/*
          Email hanya ditampilkan kalau memang sudah diisi. Selama `SUPPORT_EMAIL`
          kosong, satu-satunya jalur yang ditawarkan adalah GitHub — menampilkan
          `mailto:` kosong akan memberi tautan yang tidak menuju ke mana pun,
          yang lebih buruk daripada tidak ada tautan sama sekali.
        */}
        {SUPPORT_EMAIL !== '' && (
          <a className="btn btn--block" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        )}
        <a
          className="btn btn--block"
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub
        </a>
      </section>
    </main>
  );
}
