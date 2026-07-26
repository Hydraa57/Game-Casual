'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { NICKNAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@pixelmatrix/shared';
import { isValidNickname } from '@/lib/nickname';

export interface RoomEntryProps {
  readonly nickname: string;
  readonly onNicknameChange: (value: string) => void;
  readonly initialCode: string;
  readonly busy: boolean;
  readonly onCreate: () => void;
  readonly onJoin: (code: string) => void;
}

export function RoomEntry({
  nickname,
  onNicknameChange,
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
