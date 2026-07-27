'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, AVATAR_IDS, DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { PASSWORD_MIN, USERNAME_MAX, validatePassword, validateUsername } from '@/lib/credentials';

type Mode = 'login' | 'signup';

export interface AuthFormProps {
  /** Dipanggil setelah login/daftar berhasil, dengan data pemain dari server. */
  readonly onSignedIn: (user: { username: string; avatar: string; soloHighScore: number }) => void;
}

export function AuthForm({ onSignedIn }: AuthFormProps) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    // Divalidasi di client HANYA untuk umpan balik cepat. Server memvalidasi
    // ulang dengan aturan yang sama — apa pun yang lolos dari sini tetap
    // diperiksa di sana.
    const problem = validateUsername(username) ?? validatePassword(password);
    if (problem !== null) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'signup' ? { username, password, avatar } : { username, password },
        ),
      });
      const data = (await response.json()) as
        | { ok: true; user: { username: string; avatar: string; soloHighScore: number } }
        | { ok: false; error: string };

      if (!data.ok) {
        setError(data.error);
        return;
      }
      onSignedIn(data.user);
    } catch {
      setError('network');
    } finally {
      setBusy(false);
    }
  }, [mode, username, password, avatar, onSignedIn]);

  return (
    <form
      className="entry"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="authTabs">
        {(['login', 'signup'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`chip${mode === candidate ? ' chip--active' : ''}`}
            onClick={() => {
              setMode(candidate);
              setError(null);
            }}
          >
            {t(candidate)}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="hud__label">{t('username')}</span>
        <input
          className="input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>

      <label className="field">
        <span className="hud__label">{t('password')}</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          // Memberi tahu browser mana yang baru dan mana yang lama membuat
          // password manager menawarkan hal yang benar.
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
      </label>

      {mode === 'signup' && (
        <fieldset className="field avatarPicker">
          <legend className="hud__label">{t('avatar')}</legend>
          <div className="avatarPicker__grid">
            {AVATAR_IDS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={`avatarPicker__option${
                  candidate === avatar ? ' avatarPicker__option--active' : ''
                }`}
                aria-pressed={candidate === avatar}
                aria-label={candidate}
                onClick={() => setAvatar(candidate)}
              >
                {AVATAR_GLYPH[candidate]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error !== null && (
        <p className="hint hint--warn" role="alert">
          {t(`err.${error}`, { min: PASSWORD_MIN })}
        </p>
      )}

      <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
        {t(mode === 'signup' ? 'createAccount' : 'signIn')}
      </button>

      <p className="hint">{t('guestNote')}</p>
    </form>
  );
}
