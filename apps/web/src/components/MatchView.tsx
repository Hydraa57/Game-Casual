'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AVATAR_GLYPH, isMaxCurveLevel, matchIntensity } from '@pixelmatrix/shared';
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
import { Music } from '@/game/music';
import { BoardModal } from './BoardModal';
import { ConfirmDialog } from './ConfirmDialog';
import { LevelBar } from './LevelBar';
import { PingBadge } from './PingBadge';
import { SoundControls } from './SoundControls';
import { TargetIndicator } from './TargetIndicator';
import { readMuted, writeMuted } from '@/lib/mute';
import { readMusicVolume, writeMusicVolume } from '@/lib/musicVolume';
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
  /**
   * Batas waktu room. Dioper dari `room.settings`, BUKAN diturunkan dari
   * `remainingMs`: percobaan pertama memakai `remainingMs + 1` sebagai batas,
   * yang membuat "sisa waktu / batas" selalu ≈ 1 dan tekanan waktu tidak pernah
   * aktif sama sekali. Nilai ini juga tetap benar untuk pemain yang baru
   * reconnect, karena ia datang dari state room dan bukan dari event yang
   * sudah lewat.
   */
  readonly timeLimitSec: number;
  readonly onLeave: () => void;
  /** Menutup layar hasil dan mengembalikan room ke lobby (untuk rematch). */
  readonly onBackToLobby: () => void;
}

export function MatchView({
  socket,
  playerId,
  avatars,
  targetScore,
  timeLimitSec,
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
  const [stroopInk, setStroopInk] = useState<readonly Color[] | null>(null);
  const [levelFraction, setLevelFraction] = useState(0);
  const [levelRemainingMs, setLevelRemainingMs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const musicRef = useRef<Music | null>(null);
  if (musicRef.current === null && typeof window !== 'undefined') {
    musicRef.current = new Music();
  }

  useEffect(() => {
    setMuted(readMuted());
    musicRef.current?.setMuted(readMuted());
    const savedVolume = readMusicVolume();
    setVolume(savedVolume);
    musicRef.current?.setVolume(savedVolume);
    const music = musicRef.current;
    return () => music?.dispose();
  }, []);

  /**
   * Ketegangan multiplayer mengikuti skor TERTINGGI di papan, bukan skor pemain
   * ini: momen paling genting justru saat LAWAN hampir menang, dan musik yang
   * mengikuti skor sendiri akan terdengar paling tenang tepat di situ.
   */
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;

    const finished = result !== null;
    if (countdown !== null || finished) {
      music.stop();
      return;
    }
    if (scoreboard.length === 0) return;

    const top = Math.max(...scoreboard.map((entry) => entry.score));
    music.setIntensity(matchIntensity(top, targetScore, remainingMs ?? 0, timeLimitSec * 1000));
    music.start();
  }, [scoreboard, targetScore, timeLimitSec, remainingMs, countdown, result]);

  /**
   * Avatar disimpan di ref, bukan dipakai langsung sebagai dependency effect.
   *
   * Kalau ia menjadi dependency, setiap `room:state` yang masuk akan melepas
   * lalu memasang ulang SELURUH listener di tengah match — dan event yang tiba
   * di celah itu hilang.
   */
  /**
   * Level pada tick sebelumnya. Ref dan bukan state: nilainya cuma dipakai untuk
   * membandingkan di dalam handler event, dan tidak ada satu pun bagian tampilan
   * yang perlu digambar ulang karenanya.
   */
  const lastLevelRef = useRef(0);

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

      /**
       * Minta keadaan papan sekarang, bukan menunggu event berikutnya.
       *
       * Komponen ini bisa terpasang di TENGAH match — pemain yang koneksinya
       * putus lalu kembali melewatkan `game:started` dan seluruh riwayat spawn.
       * Tanpa langkah ini papannya kosong sampai pixel yang sedang hidup
       * kedaluwarsa satu per satu, dan selama itu tidak ada yang bisa ditekan.
       *
       * Diminta dari sini dan bukan didorong server begitu reconnect berhasil,
       * karena di titik ini listener-nya pasti sudah siap: potret yang dikirim
       * lebih awal akan tiba sebelum komponen ada dan hilang tanpa jejak.
       */
      socket.emit('game:requestResync', (result) => {
        if (!result.ok || result.data === null) return;
        const snapshot = result.data;
        const scene = controller?.scene;

        scene?.beginMatch();
        // Ukuran papan DULUAN, sebelum pixelnya dipasang: mengganti ukuran
        // menggambar ulang isi papan, jadi urutan terbalik berarti pixelnya
        // digambar di koordinat lama lalu langsung dibuang.
        scene?.setGridSize(snapshot.gridSize);
        scene?.setTargets(snapshot.targetColors);
        scene?.setChaos(snapshot.chaos);
        scene?.replaceBoard(snapshot.pixels);

        setCountdown(null);
        setTargetColors(snapshot.targetColors);
        setStroopInk(snapshot.stroopInk);
        setLevel(snapshot.level);
        setChaos(snapshot.chaos);
        setRemainingMs(snapshot.remainingMs);
        setSuddenDeath(snapshot.suddenDeath);
        setScoreboard(snapshot.scoreboard);
        // Tanpa baris ini, pemain yang kembali di tengah match pada level 9
        // akan mendapat spanduk "Level 9" di tick berikutnya — seolah ia baru
        // saja naik, padahal ia cuma menyusul keadaan yang sudah berjalan.
        lastLevelRef.current = snapshot.level;
      });
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
      // Sebelum apa pun yang menggambar: match ramai bermain di papan 10×10,
      // dan pixel pertama bisa datang di milidetik yang sama dengan event ini.
      scene()?.setGridSize(payload.gridSize);
      scene()?.setTargets(payload.targetColors);
      setTargetColors(payload.targetColors);
      setCountdown(null);
      setResult(null);
      setSuddenDeath(false);
      controllerRef.current?.unlockAudio();
      scene()?.beginMatch();
      // Rematch memulai dari level 1 lagi. Kalau ref-nya masih menyimpan level
      // terakhir ronde sebelumnya, kenaikan level pertama ronde ini tidak akan
      // terdeteksi sama sekali.
      lastLevelRef.current = 0;
    };

    const onTick = (payload: TickPayload) => {
      setRemainingMs(payload.remainingMs);
      // Kenaikan level di multiplayer tidak punya event tersendiri — ia hanya
      // terlihat sebagai angka yang berubah di tick. Perbandingan dengan nilai
      // sebelumnya lah yang mengubahnya menjadi momen.
      setLevelFraction(payload.levelFraction);
      setLevelRemainingMs(payload.levelRemainingMs);
      // Dibandingkan lewat ref, BUKAN di dalam updater `setLevel`.
      //
      // Versi pertama menaruh pemicunya di dalam updater, dan React memanggil
      // updater lebih dari sekali (StrictMode memanggilnya dua kali justru untuk
      // menemukan efek samping seperti ini). Akibatnya spanduk digambar dua kali
      // dan fanfare naik level berbunyi dobel — terdengar seperti bunyi yang
      // pecah, bukan seperti satu peristiwa. Updater harus murni; perbandingan
      // "berubah dari nilai sebelumnya" tempatnya di sini.
      if (payload.level > lastLevelRef.current && lastLevelRef.current > 0) {
        scene()?.levelBanner(payload.level);
      }
      lastLevelRef.current = payload.level;
      setLevel(payload.level);
      setChaos(payload.chaos);
      setScoreboard(payload.scoreboard);
      // Tick membawa warna target juga, jadi HUD tetap benar walau satu event
      // `targetChanged` hilang di jaringan.
      setTargetColors(payload.targetColors);
      setStroopInk(payload.stroopInk);
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
    const onTargetChanged = (payload: TargetChangedPayload) => {
      const { colors } = payload;
      // Tidak menunggu tick berikutnya (bisa 250 ms lagi): pada level tinggi
      // seperempat detik mengejar warna yang sudah kadaluarsa itu mahal.
      scene()?.setTargets(colors);
      scene()?.targetPulse();
      setTargetColors(colors);
      setStroopInk(payload.stroopInk);
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

  const changeVolume = useCallback((next: number) => {
    setVolume(next);
    musicRef.current?.setVolume(next);
    writeMusicVolume(next);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      controllerRef.current?.setMuted(next);
      musicRef.current?.setMuted(next);
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
      {/*
        Berempat, satu baris per pemain mendorong papan sampai 460 px dari atas
        layar dan membuat halaman lebih tinggi dari viewport — kontrol bawah
        kepotong, dan di HP yang lebih pendek papannya sendiri ikut kepotong.
        Mulai tiga pemain, daftarnya dipecah dua kolom.

        Ambangnya di TIGA, bukan empat: dua pemain masih lega satu baris penuh,
        dan memaksanya jadi dua kolom hanya membuang ruang.
      */}
      <ol className={`scoreboard${sorted.length > 2 ? ' scoreboard--grid' : ''}`}>
        {sorted.map((entry) => (
          <li
            key={entry.playerId}
            className={`scoreboard__row${entry.playerId === playerId ? ' scoreboard__row--me' : ''}${
              entry.connected ? '' : ' scoreboard__row--gone'
            }`}
          >
            <span className="scoreboard__top">
              <span className="avatarMark" aria-hidden="true">
                {AVATAR_GLYPH[entry.avatar]}
              </span>
              <span className="scoreboard__name">{entry.nickname}</span>
              <span className="scoreboard__score">{entry.score}</span>
            </span>
            <span className="scoreboard__meta">
              {/* Tingkatnya, bukan sekadar "BOT": nama botnya netral ("Bot 2"),
                  jadi lencana inilah satu-satunya tempat lawan bisa tahu ia
                  sedang berhadapan dengan yang mana. */}
              {entry.bot !== null && (
                <span className="badge badge--bot">{t(`botLevel.${entry.bot}`)}</span>
              )}
              {/* Bot tidak punya jaringan untuk diukur, jadi ia tidak pernah
                  membawa lencana ini. */}
              {entry.bot === null && (
                <PingBadge latencyMs={entry.latencyMs} connected={entry.connected} />
              )}
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
            </span>
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
        {/* Level TIDAK ditampilkan di sini: bar di bawah sudah menampilkannya
            beserta progresnya. Dua tempat untuk satu angka hanya menyempitkan
            baris ini tanpa menambah informasi apa pun. */}
        {chaos !== null && <span className="badge badge--chaos">{t(CHAOS_LABEL[chaos])}</span>}
      </div>

      {/* Warna yang harus diketuk. Tanpa baris ini permainannya tidak bisa
          dimainkan sama sekali — pemain hanya bisa menebak. Ditaruh menempel di
          atas papan supaya mata tidak perlu bolak-balik ke ujung layar. */}
      {targetColors.length > 0 && (
        <div className={`hud__target${targetImminent ? ' hud__target--warning' : ''}`}>
          <TargetIndicator colors={targetColors} ink={stroopInk} />
        </div>
      )}

      {/* Di multiplayer level naik menurut WAKTU, jadi bar ini juga memberi tahu
          kapan papan akan berubah — informasi yang sebelumnya tidak ada di mana
          pun, padahal ia berlaku sama untuk semua pemain. */}
      {targetColors.length > 0 && (
        <LevelBar
          level={level}
          fraction={levelFraction}
          remainingLabel={t('secondsToLevel', { count: Math.ceil(levelRemainingMs / 1000) })}
          // Match 300 detik menembus MAX_CURVE_LEVEL, jadi ini bukan kasus
          // teoretis: level terus naik tapi kesulitannya tidak lagi bertambah,
          // dan pemain berhak tahu bedanya.
          atMax={isMaxCurveLevel(level)}
        />
      )}

      {/* Pembungkus yang lentur: papan mengambil SISA tinggi layar,
          bukan hasil pengurangan angka tetap. Lihat catatannya di
          globals.css. */}
      <div className="boardArea">
        <div className="board">
          {/*
            Phaser diberi kotaknya SENDIRI, bukan `.board` yang berbingkai.

            Phaser mengukur elemen induknya lewat kotak-luar, termasuk bingkai
            5 px — jadi kanvasnya dibuat selebar bingkai luar lalu dipusatkan
            dengan margin yang dihitung dari ukuran itu. Hasilnya kanvas
            bergeser 5 px ke kanan: ada celah kosong di kiri dan kolom paling
            kanan papan tergunting. Kotak dalam ini persis sebesar area isi,
            jadi Phaser mengukur yang benar tanpa perlu dipaksa lewat CSS.
          */}
          <div className="board__canvas" ref={boardRef} />
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

          {/*
            Layar hasil dipindahkan KELUAR dari papan lewat portal. Isinya
            (peringkat + kontrol bunyi + tombol) lebih tinggi daripada papan,
            dan `overflow: hidden` papan memotong judul di atas serta tombolnya
            di bawah — lihat catatan di BoardModal.
          */}
          {result !== null && (
            <BoardModal>
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
              {/*
                Pengaturan bunyi hanya di layar hasil, tidak menetap di bawah
                papan. Multiplayer tidak punya jeda, jadi inilah satu-satunya
                titik di dalam match ketika pemain memang sedang berhenti —
                selebihnya diatur sekali dari menu Pengaturan di halaman awal.
              */}
              <SoundControls
                muted={muted}
                volume={volume}
                onToggleMute={toggleMute}
                onVolumeChange={changeVolume}
              />
              <button className="btn btn--primary" type="button" onClick={closeResult}>
                {t('backToLobby')}
              </button>
            </BoardModal>
          )}
        </div>
      </div>

      <div className="controls">
        {/* Keluar room SELALU dikonfirmasi, tidak seperti solo yang hanya
            bertanya saat ronde berjalan. Bedanya: di sini yang hilang bukan
            cuma skor sendiri — kursinya dilepas, dan kalau match sedang jalan
            lawan ikut kehilangan match-nya. */}
        <button className="btn btn--small" type="button" onClick={() => setConfirmLeave(true)}>
          {t('leaveRoom')}
        </button>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title={t('leaveRoomTitle')}
          body={t('leaveRoomBody')}
          confirmLabel={t('leaveRoom')}
          onConfirm={onLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}
