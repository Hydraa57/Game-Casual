'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLOWED_TARGET_SCORES,
  ALLOWED_TIME_LIMITS_SEC,
  AVATAR_GLYPH,
  MAX_PLAYERS_LIMIT,
  MIN_PLAYERS_TO_START,
} from '@pixelmatrix/shared';
import type { RoomSettings, RoomState } from '@pixelmatrix/shared';

export interface RoomLobbyProps {
  readonly room: RoomState;
  readonly playerId: string | null;
  readonly busy: boolean;
  readonly onReady: (ready: boolean) => void;
  readonly onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
}

export function RoomLobby({
  room,
  playerId,
  busy,
  onReady,
  onUpdateSettings,
  onStart,
  onLeave,
}: RoomLobbyProps) {
  const t = useTranslations('room');
  const [copied, setCopied] = useState(false);

  const me = room.players.find((player) => player.id === playerId);
  const isHost = me?.isHost ?? false;
  const allReady = room.players.every((player) => player.isReady);
  const enoughPlayers = room.players.length >= MIN_PLAYERS_TO_START;

  const share = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?code=${room.roomCode}`;
    const text = t('shareText', { code: room.roomCode });

    // Di HP, share sheet bawaan jauh lebih cepat daripada copy lalu buka WhatsApp.
    if (navigator.share) {
      void navigator.share({ title: t('shareTitle'), text, url }).catch(() => {
        /* pemain membatalkan share — bukan error */
      });
      return;
    }
    void navigator.clipboard?.writeText(`${text} ${url}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [room.roomCode, t]);

  return (
    <div className="lobby">
      <div className="card lobby__code">
        <span className="hud__label">{t('roomCode')}</span>
        <div className="lobby__codeValue">{room.roomCode}</div>
        <button className="btn btn--small" type="button" onClick={share}>
          {copied ? t('copied') : t('share')}
        </button>
      </div>

      <section className="card">
        <h2 className="card__title">
          {t('players')} ({room.players.length}/{room.settings.maxPlayers})
        </h2>
        <ul className="playerList">
          {room.players.map((player) => (
            <li key={player.id} className="playerList__item">
              <span className={player.id === playerId ? 'playerList__me' : undefined}>
                {/* Avatar ditampilkan di sini supaya pemain melihat karakter
                    yang BENAR-BENAR dipakai — server bisa menggantinya kalau
                    pilihannya sudah diambil orang lain. */}
                <span className="avatarMark" aria-hidden="true">
                  {AVATAR_GLYPH[player.avatar]}
                </span>
                {player.nickname}
                {player.isHost && <span className="badge">{t('host')}</span>}
              </span>
              <span className={player.isReady ? 'ready ready--yes' : 'ready'}>
                {player.isReady ? t('ready') : t('notReady')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card__title">{t('settings')}</h2>
        {isHost ? (
          <div className="settings">
            <SettingRow
              label={t('maxPlayers')}
              options={playerOptions()}
              value={room.settings.maxPlayers}
              onChange={(maxPlayers) => onUpdateSettings({ maxPlayers })}
            />
            <SettingRow
              label={t('targetScore')}
              options={[...ALLOWED_TARGET_SCORES]}
              value={room.settings.targetScore}
              onChange={(targetScore) => onUpdateSettings({ targetScore })}
            />
            <SettingRow
              label={t('timeLimit')}
              options={[...ALLOWED_TIME_LIMITS_SEC]}
              value={room.settings.timeLimitSec}
              suffix="s"
              onChange={(timeLimitSec) => onUpdateSettings({ timeLimitSec })}
            />
          </div>
        ) : (
          <p className="hint">
            {t('settingsReadOnly', {
              players: room.settings.maxPlayers,
              score: room.settings.targetScore,
              time: room.settings.timeLimitSec,
            })}
          </p>
        )}
      </section>

      <div className="controls controls--stack">
        <button
          className={me?.isReady ? 'btn' : 'btn btn--primary'}
          type="button"
          onClick={() => onReady(!me?.isReady)}
        >
          {me?.isReady ? t('cancelReady') : t('imReady')}
        </button>

        {isHost && (
          <button
            className="btn btn--primary"
            type="button"
            onClick={onStart}
            disabled={busy || !allReady || !enoughPlayers}
          >
            {t('startMatch')}
          </button>
        )}
      </div>

      {isHost && !enoughPlayers && <p className="hint">{t('waitingForPlayers')}</p>}
      {isHost && enoughPlayers && !allReady && <p className="hint">{t('waitingForReady')}</p>}
      {!isHost && allReady && <p className="hint">{t('waitingForHost')}</p>}

      <button className="btn btn--small" type="button" onClick={onLeave}>
        {t('leaveRoom')}
      </button>
    </div>
  );
}

function playerOptions(): number[] {
  const options: number[] = [];
  for (let count = MIN_PLAYERS_TO_START; count <= MAX_PLAYERS_LIMIT; count += 1) {
    options.push(count);
  }
  return options;
}

function SettingRow({
  label,
  options,
  value,
  suffix = '',
  onChange,
}: {
  label: string;
  options: readonly number[];
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="settings__row">
      <span className="hud__label">{label}</span>
      <div className="settings__options">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={option === value ? 'chip chip--active' : 'chip'}
            onClick={() => onChange(option)}
          >
            {option}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}
