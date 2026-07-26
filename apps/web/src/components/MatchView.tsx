'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  BombHitPayload,
  ChaosModifier,
  ClickRejectedPayload,
  GameStartedPayload,
  MatchEndedPayload,
  Pixel,
  PixelClaimedPayload,
  PixelSpawnedPayload,
  ScoreboardEntry,
  TargetChangedPayload,
  TickPayload,
} from '@pixelmatrix/shared';
import type { RemoteController } from '@/game/createRemoteGame';
import type { GameSocket } from '@/lib/socket';

const CHAOS_LABEL: Record<ChaosModifier, string> = {
  rush: 'chaosRush',
  blackout: 'chaosBlackout',
  bombRain: 'chaosBombRain',
  shuffle: 'chaosShuffle',
};

export interface MatchViewProps {
  readonly socket: GameSocket;
  readonly playerId: string | null;
  readonly targetScore: number;
  readonly onLeave: () => void;
  /** Menutup layar hasil dan mengembalikan room ke lobby (untuk rematch). */
  readonly onBackToLobby: () => void;
}

export function MatchView({
  socket,
  playerId,
  targetScore,
  onLeave,
  onBackToLobby,
}: MatchViewProps) {
  const t = useTranslations('room');
  const boardRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RemoteController | null>(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [scoreboard, setScoreboard] = useState<readonly ScoreboardEntry[]>([]);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [chaos, setChaos] = useState<ChaosModifier | null>(null);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [result, setResult] = useState<MatchEndedPayload | null>(null);

  // Phaser menyentuh `window` saat di-import, jadi di-import dinamis di effect.
  useEffect(() => {
    let disposed = false;
    let controller: RemoteController | null = null;

    void import('@/game/createRemoteGame').then(({ createRemoteGame }) => {
      if (disposed || !boardRef.current) return;
      controller = createRemoteGame({
        parent: boardRef.current,
        onTapPixel: (pixelId) => socket.emit('game:click', { pixelId, clientTs: Date.now() }),
      });
      controllerRef.current = controller;
    });

    return () => {
      disposed = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [socket]);

  useEffect(() => {
    const scene = () => controllerRef.current?.scene;

    const onCountdown = ({ seconds }: { seconds: number }) => setCountdown(seconds);

    const onStarted = (payload: GameStartedPayload) => {
      scene()?.setTargets(payload.targetColors);
      setCountdown(null);
      setResult(null);
      setSuddenDeath(false);
      controllerRef.current?.unlockAudio();
      scene()?.beginMatch();
    };

    const onTick = (payload: TickPayload) => {
      setRemainingMs(payload.remainingMs);
      setLevel(payload.level);
      setChaos(payload.chaos);
      setScoreboard(payload.scoreboard);
      scene()?.setChaos(payload.chaos);
    };

    const onSpawned = ({ pixel }: PixelSpawnedPayload) => scene()?.spawn(pixel);
    const onExpired = ({ pixelId }: { readonly pixelId: string }) => scene()?.expire(pixelId);

    const onClaimed = (payload: PixelClaimedPayload) =>
      scene()?.claimed(
        payload.pixelId,
        payload.cell,
        payload.points,
        payload.byPlayerId === playerId,
        payload.combo,
      );

    const onRejected = ({ reason }: ClickRejectedPayload) => scene()?.rejected(reason);

    const onBomb = ({ pixelId, byPlayerId }: BombHitPayload) =>
      scene()?.bomb(pixelId, byPlayerId === playerId);

    const onShuffled = ({ pixels }: { readonly pixels: readonly Pixel[] }) =>
      scene()?.shuffle(pixels);
    const onTargetChanged = ({ colors }: TargetChangedPayload) => scene()?.setTargets(colors);
    const onSuddenDeath = () => setSuddenDeath(true);

    const onEnded = (payload: MatchEndedPayload) => {
      setResult(payload);
      scene()?.endMatch();
    };

    socket.on('game:countdown', onCountdown);
    socket.on('game:started', onStarted);
    socket.on('game:tick', onTick);
    socket.on('game:pixelSpawned', onSpawned);
    socket.on('game:pixelExpired', onExpired);
    socket.on('game:pixelClaimed', onClaimed);
    socket.on('game:clickRejected', onRejected);
    socket.on('game:bombHit', onBomb);
    socket.on('game:boardShuffled', onShuffled);
    socket.on('game:targetChanged', onTargetChanged);
    socket.on('game:suddenDeath', onSuddenDeath);
    socket.on('game:ended', onEnded);

    // Setiap `off` menyebut handler-nya. Tanpa itu, Socket.IO membuang SEMUA
    // listener untuk event tersebut — termasuk milik kode lain yang kebetulan
    // mendengarkan event yang sama.
    return () => {
      socket.off('game:countdown', onCountdown);
      socket.off('game:started', onStarted);
      socket.off('game:tick', onTick);
      socket.off('game:pixelSpawned', onSpawned);
      socket.off('game:pixelExpired', onExpired);
      socket.off('game:pixelClaimed', onClaimed);
      socket.off('game:clickRejected', onRejected);
      socket.off('game:bombHit', onBomb);
      socket.off('game:boardShuffled', onShuffled);
      socket.off('game:targetChanged', onTargetChanged);
      socket.off('game:suddenDeath', onSuddenDeath);
      socket.off('game:ended', onEnded);
    };
  }, [socket, playerId]);

  // Hasil dibersihkan lokal DAN room dikembalikan ke lobby: server menahan room
  // di `finished` sampai pemain menutup layar ini sendiri.
  const closeResult = useCallback(() => {
    setResult(null);
    onBackToLobby();
  }, [onBackToLobby]);

  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const sorted = [...scoreboard].sort((a, b) => b.score - a.score);

  return (
    <div className="match">
      <ol className="scoreboard">
        {sorted.map((entry) => (
          <li
            key={entry.playerId}
            className={`scoreboard__row${entry.playerId === playerId ? ' scoreboard__row--me' : ''}${
              entry.connected ? '' : ' scoreboard__row--gone'
            }`}
          >
            <span className="scoreboard__name">{entry.nickname}</span>
            {entry.combo >= 5 && <span className="badge">×{entry.combo}</span>}
            <span className="scoreboard__score">{entry.score}</span>
          </li>
        ))}
      </ol>

      <div className="matchbar">
        <span>
          <span className="hud__label">{t('timeLeft')}</span>{' '}
          <strong>{seconds === null ? '—' : `${seconds}s`}</strong>
        </span>
        <span>
          <span className="hud__label">{t('target')}</span> <strong>{targetScore}</strong>
        </span>
        <span>
          <span className="hud__label">{t('level')}</span> <strong>{level}</strong>
        </span>
        {chaos !== null && <span className="badge badge--chaos">{t(CHAOS_LABEL[chaos])}</span>}
      </div>

      <div className="board" ref={boardRef}>
        {countdown !== null && (
          <div className="overlay">
            <div className="overlay__score">{countdown}</div>
            <p className="overlay__hint">{t('getReady')}</p>
          </div>
        )}

        {suddenDeath && result === null && (
          <div className="overlay overlay--flash">
            <h2 className="overlay__title">{t('suddenDeath')}</h2>
            <p className="overlay__hint">{t('suddenDeathHint')}</p>
          </div>
        )}

        {result !== null && (
          <div className="overlay">
            <h2 className="overlay__title">
              {result.ranking[0]?.playerId === playerId ? t('youWin') : t('matchOver')}
            </h2>
            <ol className="results">
              {result.ranking.map((entry) => (
                <li
                  key={entry.playerId}
                  className={entry.playerId === playerId ? 'results__me' : undefined}
                >
                  <span>
                    {entry.rank}. {entry.nickname}
                  </span>
                  <span>{entry.score}</span>
                  <span className="results__detail">
                    {Math.round(entry.accuracy * 100)}% · ×{entry.bestCombo}
                  </span>
                </li>
              ))}
            </ol>
            <button className="btn btn--primary" type="button" onClick={closeResult}>
              {t('backToLobby')}
            </button>
          </div>
        )}
      </div>

      <button className="btn btn--small" type="button" onClick={onLeave}>
        {t('leaveRoom')}
      </button>
    </div>
  );
}
