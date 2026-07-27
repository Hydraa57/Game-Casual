'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, COLOR_GLYPH } from '@pixelmatrix/shared';
import type {
  AvatarId,
  BombHitPayload,
  ChaosModifier,
  ClickRejectedPayload,
  Color,
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
import { cssColor } from '@/game/palette';
import { readMuted, writeMuted } from '@/lib/mute';
import type { GameSocket } from '@/lib/socket';

/** Waktu tempuh sebagai M:SS — "1:33" jauh lebih mudah dibandingkan daripada "93 dtk". */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const CHAOS_LABEL: Record<ChaosModifier, string> = {
  rush: 'chaosRush',
  blackout: 'chaosBlackout',
  bombRain: 'chaosBombRain',
  shuffle: 'chaosShuffle',
};

export interface MatchViewProps {
  readonly socket: GameSocket;
  readonly playerId: string | null;
  /**
   * Avatar per pemain, dari `room:state`.
   *
   * Diambil dari state room dan bukan dari payload klik supaya avatar tidak
   * ikut dikirim di jalur terpanas permainan — `game:pixelClaimed` bisa terbang
   * beberapa kali per detik ke setiap pemain.
   */
  readonly avatars: ReadonlyMap<string, AvatarId>;
  readonly targetScore: number;
  readonly onLeave: () => void;
  /** Menutup layar hasil dan mengembalikan room ke lobby (untuk rematch). */
  readonly onBackToLobby: () => void;
}

export function MatchView({
  socket,
  playerId,
  avatars,
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
  const [targetColors, setTargetColors] = useState<readonly Color[]>([]);
  const [targetImminent, setTargetImminent] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(readMuted());
  }, []);

  /**
   * Avatar disimpan di ref, bukan dipakai langsung sebagai dependency effect.
   *
   * Kalau ia menjadi dependency, setiap `room:state` yang masuk akan melepas
   * lalu memasang ulang SELURUH listener di tengah match — dan event yang tiba
   * di celah itu hilang.
   */
  const avatarsRef = useRef(avatars);
  useEffect(() => {
    avatarsRef.current = avatars;
  }, [avatars]);

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
      // Preferensi bunyi dibagi dengan solo mode: pemain yang sudah mematikan
      // bunyi di sana tidak seharusnya dikejutkan saat masuk multiplayer.
      controller.setMuted(readMuted());
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
      setTargetColors(payload.targetColors);
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
      // Tick membawa warna target juga, jadi HUD tetap benar walau satu event
      // `targetChanged` hilang di jaringan.
      setTargetColors(payload.targetColors);
      setTargetImminent(payload.targetImminent);
      scene()?.setTargets(payload.targetColors);
      scene()?.setChaos(payload.chaos);
      const mine = payload.scoreboard.find((entry) => entry.playerId === playerId);
      scene()?.setFrozen(mine?.eliminated === true || (mine?.frozenMs ?? 0) > 0);
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
        avatarsRef.current.get(payload.byPlayerId) ?? null,
      );

    const onRejected = ({ reason }: ClickRejectedPayload) => scene()?.rejected(reason);

    const onBomb = ({ pixelId, byPlayerId }: BombHitPayload) =>
      scene()?.bomb(pixelId, byPlayerId === playerId);

    const onShuffled = ({ pixels }: { readonly pixels: readonly Pixel[] }) =>
      scene()?.shuffle(pixels);
    const onTargetChanged = ({ colors }: TargetChangedPayload) => {
      // Tidak menunggu tick berikutnya (bisa 250 ms lagi): pada level tinggi
      // seperempat detik mengejar warna yang sudah kadaluarsa itu mahal.
      scene()?.setTargets(colors);
      setTargetColors(colors);
      setTargetImminent(false);
    };
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

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      controllerRef.current?.setMuted(next);
      writeMuted(next);
      return next;
    });
  }, []);

  // Hasil dibersihkan lokal DAN room dikembalikan ke lobby: server menahan room
  // di `finished` sampai pemain menutup layar ini sendiri.
  const closeResult = useCallback(() => {
    setResult(null);
    onBackToLobby();
  }, [onBackToLobby]);

  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const sorted = [...scoreboard].sort((a, b) => b.score - a.score);
  const me = scoreboard.find((entry) => entry.playerId === playerId) ?? null;
  const eliminated = me?.eliminated === true;
  // Overlay beku tidak ditampilkan untuk pemain yang sudah tereliminasi:
  // baginya hitungan mundur "hidup lagi sebentar lagi" itu bohong.
  const frozenSeconds =
    !eliminated && me !== null && me.frozenMs > 0 ? Math.ceil(me.frozenMs / 1000) : null;

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
            <span className="avatarMark" aria-hidden="true">
              {AVATAR_GLYPH[entry.avatar]}
            </span>
            <span className="scoreboard__name">{entry.nickname}</span>
            {entry.lives !== null && (
              <span
                className={`lives${entry.frozenMs > 0 || entry.eliminated ? ' lives--out' : ''}`}
                aria-label={`${entry.lives}`}
              >
                {entry.eliminated
                  ? t('eliminatedShort')
                  : entry.frozenMs > 0
                    ? t('down')
                    : '▮'.repeat(entry.lives)}
              </span>
            )}
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

      {/* Warna yang harus diketuk. Tanpa baris ini permainannya tidak bisa
          dimainkan sama sekali — pemain hanya bisa menebak. Ditaruh menempel di
          atas papan supaya mata tidak perlu bolak-balik ke ujung layar. */}
      {targetColors.length > 0 && (
        <div className={`hud__target${targetImminent ? ' hud__target--warning' : ''}`}>
          <span className="hud__swatches">
            {targetColors.map((color) => (
              <span
                key={color}
                className="hud__swatch"
                style={{ background: cssColor(color) }}
                aria-hidden="true"
              >
                {COLOR_GLYPH[color]}
              </span>
            ))}
          </span>
          <span className="hud__targetText">
            <span className="hud__label">{t('tapColor')}</span>
            <div className="stat__value">
              {targetColors.map((color) => color.toUpperCase()).join(' + ')}
            </div>
          </span>
        </div>
      )}

      <div className="board" ref={boardRef}>
        {countdown !== null && (
          <div className="overlay">
            <div className="overlay__score">{countdown}</div>
            <p className="overlay__hint">{t('getReady')}</p>
          </div>
        )}

        {/* Overlay beku menutupi papan dengan sengaja: selain memberi tahu,
            ia juga mencegah pemain terus menggeprek sel yang tidak akan
            direspons server. */}
        {/* Tereliminasi: papannya tetap terlihat supaya masih seru ditonton,
            tapi tidak ada hitungan mundur — dia tidak akan kembali. */}
        {eliminated && result === null && (
          <div className="overlay">
            <h2 className="overlay__title">{t('eliminated')}</h2>
            <p className="overlay__hint">{t('eliminatedHint')}</p>
          </div>
        )}

        {frozenSeconds !== null && result === null && (
          <div className="overlay overlay--flash">
            <h2 className="overlay__title">{t('knockedOut')}</h2>
            <div className="overlay__score">{frozenSeconds}</div>
            <p className="overlay__hint">{t('knockedOutHint')}</p>
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
            {/* Catatan waktunya, yang membuat match terasa seperti balapan dan
                bukan sekadar daftar angka. Disembunyikan saat match habis
                waktu: di situ angkanya cuma mengulang batas waktu room. */}
            {result.reason !== 'timeUp' && (
              <p className="overlay__time">
                {t('finishedIn', { time: formatDuration(result.durationMs) })}
              </p>
            )}
            <ol className="results">
              {result.ranking.map((entry) => (
                <li
                  key={entry.playerId}
                  className={entry.playerId === playerId ? 'results__me' : undefined}
                >
                  <span>
                    {entry.rank}.{' '}
                    <span className="avatarMark" aria-hidden="true">
                      {AVATAR_GLYPH[entry.avatar]}
                    </span>{' '}
                    {entry.nickname}
                  </span>
                  <span>{entry.score}</span>
                  <span className="results__detail">
                    {Math.round(entry.accuracy * 100)}% · ×{entry.bestCombo}
                    {entry.eliminated ? ` · ${t('eliminatedShort')}` : ''}
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

      <div className="controls">
        <button className="btn btn--small" type="button" onClick={toggleMute}>
          {muted ? t('muteOff') : t('muteOn')}
        </button>
        <button className="btn btn--small" type="button" onClick={onLeave}>
          {t('leaveRoom')}
        </button>
      </div>
    </div>
  );
}
