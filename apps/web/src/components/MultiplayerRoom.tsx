'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { RoomErrorCode } from '@pixelmatrix/shared';
import { useRoom } from '@/hooks/useRoom';
import { Link } from '@/i18n/navigation';
import { readNickname, writeNickname } from '@/lib/nickname';
import { RoomEntry } from './RoomEntry';
import { RoomLobby } from './RoomLobby';

/** Kunci terjemahan untuk setiap kode error dari server. */
const ERROR_LABEL: Record<RoomErrorCode, string> = {
  ROOM_NOT_FOUND: 'errRoomNotFound',
  ROOM_FULL: 'errRoomFull',
  GAME_IN_PROGRESS: 'errInProgress',
  NICKNAME_TAKEN: 'errNicknameTaken',
  NICKNAME_INVALID: 'errNicknameInvalid',
  NOT_HOST: 'errNotHost',
  NOT_ENOUGH_PLAYERS: 'errNotEnoughPlayers',
  NOT_IN_ROOM: 'errNotInRoom',
  RATE_LIMITED: 'errRateLimited',
  INVALID_PAYLOAD: 'errInvalidPayload',
};

export function MultiplayerRoom({ initialCode = '' }: { initialCode?: string }) {
  const t = useTranslations('room');
  const room = useRoom();
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    setNickname(readNickname());
  }, []);

  const remember = useCallback((value: string) => {
    setNickname(value);
    writeNickname(value.trim());
  }, []);

  const create = useCallback(() => {
    void room.createRoom(nickname.trim());
  }, [room, nickname]);

  const join = useCallback(
    (code: string) => {
      void room.joinRoom(code, nickname.trim());
    },
    [room, nickname],
  );

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
        <span className={`status status--${room.status}`}>{t(`status.${room.status}`)}</span>
      </div>

      <h1 className="pageTitle">{t('title')}</h1>

      {room.errorCode !== null && (
        <p className="hint hint--warn" role="alert">
          {t(ERROR_LABEL[room.errorCode])}
        </p>
      )}

      {room.status === 'offline' && <p className="hint hint--warn">{t('serverOffline')}</p>}

      {room.room === null ? (
        <RoomEntry
          nickname={nickname}
          onNicknameChange={remember}
          initialCode={initialCode}
          busy={room.busy || room.status !== 'online'}
          onCreate={create}
          onJoin={join}
        />
      ) : room.room.status === 'waiting' ? (
        <RoomLobby
          room={room.room}
          playerId={room.playerId}
          busy={room.busy}
          onReady={room.setReady}
          onUpdateSettings={room.updateSettings}
          onStart={() => void room.startMatch()}
          onLeave={room.leaveRoom}
        />
      ) : (
        // Match loop-nya dibangun di patch berikutnya; sampai saat itu status
        // non-waiting ditampilkan apa adanya supaya alur lobby tetap bisa diuji.
        <div className="card">
          <h2 className="card__title">{t('matchPending')}</h2>
          <p className="hint">{t('matchPendingHint')}</p>
          <button className="btn btn--small" type="button" onClick={room.leaveRoom}>
            {t('leaveRoom')}
          </button>
        </div>
      )}
    </main>
  );
}
