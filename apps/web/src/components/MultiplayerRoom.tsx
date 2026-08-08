'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DEFAULT_AVATAR } from '@pixelmatrix/shared';
import type { AvatarId, RoomErrorCode } from '@pixelmatrix/shared';
import { useRoom } from '@/hooks/useRoom';
import { Link } from '@/i18n/navigation';
import { readAvatar, writeAvatar } from '@/lib/avatar';
import { readNickname, writeNickname } from '@/lib/nickname';
import { gameServerUrl } from '@/lib/socket';
import { MatchView } from './MatchView';
import { RoomEntry } from './RoomEntry';
import { FullscreenButton } from './FullscreenButton';
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
  TEAM_FULL: 'errTeamFull',
  UNEVEN_TEAMS: 'errUnevenTeams',
};

export function MultiplayerRoom({ initialCode = '' }: { initialCode?: string }) {
  const t = useTranslations('room');
  const room = useRoom();
  const [nickname, setNickname] = useState('');
  // Dibaca di effect, bukan saat inisialisasi state: localStorage tidak ada
  // saat render di server.
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);

  useEffect(() => {
    setNickname(readNickname());
    setAvatar(readAvatar());
  }, []);

  const remember = useCallback((value: string) => {
    setNickname(value);
    writeNickname(value.trim());
  }, []);

  const rememberAvatar = useCallback((value: AvatarId) => {
    setAvatar(value);
    writeAvatar(value);
  }, []);

  const create = useCallback(() => {
    void room.createRoom(nickname.trim(), avatar);
  }, [room, nickname, avatar]);

  const join = useCallback(
    (code: string) => {
      void room.joinRoom(code, nickname.trim(), avatar);
    },
    [room, nickname, avatar],
  );

  // Avatar yang BENAR-BENAR dipakai tiap pemain datang dari server, bukan dari
  // pilihan lokal: server boleh menggantinya kalau sudah diambil orang lain.
  const avatars = useMemo(
    () => new Map((room.room?.players ?? []).map((player) => [player.id, player.avatar])),
    [room.room],
  );

  /**
   * Sedang di dalam match, bukan di lobby atau layar masuk.
   *
   * Dipakai untuk dua hal yang sama-sama soal ruang layar: mengunci halaman
   * setinggi layar (supaya papan tidak bisa di-scroll keluar pandangan), dan
   * menyembunyikan judul halaman — "Main Bareng Teman" berguna saat memilih,
   * tapi selama match ia cuma memakan 60 px yang seharusnya jadi papan.
   */
  const sedangMain = room.room !== null && room.room.status !== 'waiting';

  return (
    <main className={`shell${sedangMain ? ' shell--play' : ''}`}>
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
        <div className="topbar__right">
          <span className={`status status--${room.status}`}>{t(`status.${room.status}`)}</span>
          {sedangMain && <FullscreenButton />}
        </div>
      </div>

      {!sedangMain && <h1 className="pageTitle">{t('title')}</h1>}

      {/* Papan yang tiba-tiba terisi di tengah permainan terasa seperti bug
          kalau tidak dijelaskan. Pesan ini yang memberi tahu bahwa ia
          MELANJUTKAN match, bukan memulai yang baru. */}
      {room.reconnected && (
        <p className="hint hint--ok" role="status">
          {t('reconnectedNotice')}{' '}
          <button className="btn btn--small" type="button" onClick={room.acknowledgeReconnect}>
            {t('dismiss')}
          </button>
        </p>
      )}

      {room.errorCode !== null && (
        <p className="hint hint--warn" role="alert">
          {t(ERROR_LABEL[room.errorCode])}
        </p>
      )}

      {/* Alamat yang dicoba ikut ditampilkan: tanpa itu, "server tidak
          terjangkau" tidak memberi petunjuk apa pun soal apa yang salah. */}
      {/* Dibedakan dari "server tidak terjangkau": yang ini kita TAHU sementara,
          jadi pemain tidak perlu mengira ada yang rusak. */}
      {room.restarting && (
        <p className="hint hint--warn" role="status">
          {t('serverRestarting')}
        </p>
      )}

      {room.status === 'offline' && !room.restarting && (
        <p className="hint hint--warn">{t('serverOffline', { url: gameServerUrl() })}</p>
      )}

      {room.room === null ? (
        <RoomEntry
          nickname={nickname}
          onNicknameChange={remember}
          avatar={avatar}
          onAvatarChange={rememberAvatar}
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
          onAddBot={room.addBot}
          onRemoveBot={room.removeBot}
          onSetTeam={room.setTeam}
          chat={room.chat}
          onSendChat={room.sendChat}
        />
      ) : room.socket ? (
        <MatchView
          socket={room.socket}
          playerId={room.playerId}
          avatars={avatars}
          targetScore={room.room.settings.targetScore}
          timeLimitSec={room.room.settings.timeLimitSec}
          onLeave={room.leaveRoom}
          onBackToLobby={room.backToLobby}
        />
      ) : null}
    </main>
  );
}
