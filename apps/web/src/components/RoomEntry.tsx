'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AVATAR_GLYPH,
  AVATAR_IDS,
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
} from '@pixelmatrix/shared';
import type { AvatarId } from '@pixelmatrix/shared';
import { isValidNickname } from '@/lib/nickname';

export interface RoomEntryProps {
  readonly nickname: string;
  readonly onNicknameChange: (value: string) => void;
  readonly avatar: AvatarId;
  readonly onAvatarChange: (value: AvatarId) => void;
  readonly initialCode: string;
  readonly busy: boolean;
  readonly onCreate: () => void;
  readonly onJoin: (code: string) => void;
}

export function RoomEntry({
  nickname,
  onNicknameChange,
  avatar,
  onAvatarChange,
  initialCode,
  busy,
  onCreate,
  onJoin,
}: RoomEntryProps) {
  const t = useTranslations('room');
  const [code, setCode] = useState(initialCode);

  const nicknameOk = isValidNickname(nickname);
  const codeOk = code.trim().length >= ROOM_CODE_LENGTH;

  return (
    <div className="entry">
      <label className="field">
        <span className="hud__label">{t('nickname')}</span>
        <input
          className="input"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder={t('nicknamePlaceholder')}
          autoComplete="nickname"
          // Nama panggilan bukan kalimat — kapitalisasi otomatis di HP justru
          // mengganggu, tapi koreksi ejaan lebih mengganggu lagi.
          autoCorrect="off"
          spellCheck={false}
        />
      </label>

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
              onClick={() => onAvatarChange(candidate)}
            >
              {AVATAR_GLYPH[candidate]}
            </button>
          ))}
        </div>
        <p className="hint">{t('avatarHint')}</p>
      </fieldset>

      <button
        className="btn btn--primary btn--block"
        type="button"
        onClick={onCreate}
        disabled={busy || !nicknameOk}
      >
        {t('createRoom')}
      </button>

      <div className="entry__divider">
        <span>{t('or')}</span>
      </div>

      <label className="field">
        <span className="hud__label">{t('roomCode')}</span>
        <input
          className="input input--code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={12}
          placeholder={t('roomCodePlaceholder')}
          // Kode room dibacakan teman, jadi keyboard harus tampil apa adanya.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
        />
      </label>

      <button
        className="btn btn--block"
        type="button"
        onClick={() => onJoin(code)}
        disabled={busy || !nicknameOk || !codeOk}
      >
        {t('joinRoom')}
      </button>

      {!nicknameOk && nickname.length > 0 && <p className="hint hint--warn">{t('nicknameHint')}</p>}
    </div>
  );
}
