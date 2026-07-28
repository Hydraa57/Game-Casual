import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { APP_VERSION, GITHUB_OWNER, GITHUB_PROFILE_URL, GITHUB_URL } from '@pixelmatrix/shared';
import { Link } from '@/i18n/navigation';

/**
 * Halaman "Tentang": versi, siapa yang membuat, dan tautan ke sumbernya.
 *
 * Statis sepenuhnya — tidak ada satu pun data yang berubah per pemain, jadi
 * tidak perlu jadi client component dan tidak perlu menyentuh jaringan.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <About />;
}

function About() {
  const t = useTranslations('about');

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
        <span className="hud__label">v{APP_VERSION}</span>
      </div>

      <h1 className="pageTitle">{t('title')}</h1>
      <p className="about__tagline">{t('tagline')}</p>

      <section className="card">
        <h2 className="card__title">{t('creditsTitle')}</h2>

        <div className="about__credit">
          <span className="about__role">{t('roleCreator')}</span>
          {/* rel="noreferrer" bukan cuma kebiasaan: tanpa itu, target="_blank"
              memberi halaman tujuan akses ke window.opener. */}
          <a
            className="about__link"
            href={GITHUB_PROFILE_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            @{GITHUB_OWNER}
          </a>
        </div>

        <div className="about__credit">
          <span className="about__role">{t('roleBuilt')}</span>
          <a
            className="about__link"
            href="https://claude.com/claude-code"
            target="_blank"
            rel="noreferrer noopener"
          >
            Claude Code
          </a>
        </div>

        <p className="hint">{t('creditsNote')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('sourceTitle')}</h2>
        <p className="hint">{t('sourceNote')}</p>
        <a className="btn btn--block" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
          {t('viewSource')}
        </a>
      </section>

      <section className="card">
        <h2 className="card__title">{t('techTitle')}</h2>
        <ul className="about__tech">
          <li>Next.js · React · TypeScript</li>
          <li>Phaser 3 (canvas)</li>
          <li>Socket.IO (multiplayer otoritatif)</li>
          <li>Prisma · PostgreSQL (Supabase)</li>
        </ul>
      </section>
    </main>
  );
}
