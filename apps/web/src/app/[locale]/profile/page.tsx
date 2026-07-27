import { getTranslations, setRequestLocale } from 'next-intl/server';
import { db } from '@pixelmatrix/db';
import { AVATAR_GLYPH, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { Link } from '@/i18n/navigation';
import { currentUser } from '@/lib/session';

const RECENT_MATCHES = 10;

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'profile' });
  const user = await currentUser();

  // Guest tidak punya profil — itu memang konsekuensi yang dipilihnya, bukan
  // error. Halaman ini menjelaskannya dan menawarkan jalan keluar.
  if (user === null) {
    return (
      <Shell back={t('back')} title={t('title')}>
        <p className="hint">{t('guestOnly')}</p>
        <Link className="btn btn--primary btn--block" href="/">
          {t('goHome')}
        </Link>
      </Shell>
    );
  }

  const prisma = db();
  const matches =
    prisma === null
      ? []
      : await prisma.matchPlayer.findMany({
          where: { userId: user.id },
          orderBy: { match: { endedAt: 'desc' } },
          take: RECENT_MATCHES,
          select: {
            id: true,
            rank: true,
            score: true,
            eliminated: true,
            match: { select: { roomCode: true, endedAt: true, players: { select: { id: true } } } },
          },
        });

  const wins = matches.filter((row) => row.rank === 1).length;

  return (
    <Shell back={t('back')} title={t('title')}>
      <div className="account">
        <span className="account__who">
          <span className="avatarMark" aria-hidden="true">
            {AVATAR_GLYPH[(user.avatar as AvatarId) ?? DEFAULT_AVATAR]}
          </span>
          <span className="account__name">{user.username}</span>
        </span>
      </div>

      <div className="hud__stats">
        <Stat label={t('soloRecord')} value={user.soloHighScore} />
        <Stat label={t('matches')} value={matches.length} />
        <Stat label={t('wins')} value={wins} />
      </div>

      <section className="card">
        <h2 className="card__title">{t('recentMatches')}</h2>
        {matches.length === 0 ? (
          <p className="hint">{t('noMatches')}</p>
        ) : (
          <ul className="playerList">
            {matches.map((row) => (
              <li key={row.id} className="playerList__item">
                <span>
                  <strong>#{row.rank}</strong> {t('ofPlayers', { count: row.match.players.length })}
                  {row.eliminated && <span className="badge"> {t('out')}</span>}
                </span>
                <span className="ready">
                  {row.score} · {row.match.roomCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({
  back,
  title,
  children,
}: {
  back: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {back}
        </Link>
      </div>
      <h1 className="pageTitle">{title}</h1>
      {children}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="hud__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}
