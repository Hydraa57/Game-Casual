'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';

interface Row {
  readonly rank: number;
  readonly username: string;
  readonly avatar: string;
  readonly score: number;
}

type State =
  { status: 'loading' } | { status: 'ready'; rows: readonly Row[] } | { status: 'error' };

export function Leaderboard() {
  const t = useTranslations('leaderboard');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/leaderboard')
      .then((response) => response.json() as Promise<{ rows: Row[] }>)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', rows: data.rows });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return <p className="hint">{t('loading')}</p>;
  if (state.status === 'error') return <p className="hint hint--warn">{t('error')}</p>;

  // Daftar kosong punya dua sebab yang tidak bisa dibedakan dari sini: belum
  // ada yang mencetak skor, atau fitur akun memang belum aktif di server ini.
  // Pesannya dibuat benar untuk keduanya.
  if (state.rows.length === 0) return <p className="hint">{t('empty')}</p>;

  return (
    <ol className="leaderboard">
      {state.rows.map((row) => (
        <li key={row.username} className={`leaderboard__row leaderboard__row--${podium(row.rank)}`}>
          <span className="leaderboard__rank">{row.rank}</span>
          <span className="avatarMark" aria-hidden="true">
            {AVATAR_GLYPH[(row.avatar as AvatarId) ?? DEFAULT_AVATAR]}
          </span>
          <span className="leaderboard__name">{row.username}</span>
          <span className="leaderboard__score">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}

function podium(rank: number): string {
  return rank <= 3 ? `top${rank}` : 'rest';
}
