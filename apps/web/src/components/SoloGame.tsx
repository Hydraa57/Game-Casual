'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  INITIAL_SNAPSHOT,
  pendingTutorial,
  SOLO_STARTING_LIVES,
  soloIntensity,
} from '@pixelmatrix/shared';
import type { HudSnapshot, TutorialTopic } from '@pixelmatrix/shared';
import type { SoloController } from '@/game/createSoloGame';
import { Link, useRouter } from '@/i18n/navigation';
import { readHighScore, writeHighScore } from '@/lib/highScore';
import { buatMusic } from '@/game/audio';
import type { Music } from '@pixelmatrix/shared';
import { readMusicVolume, writeMusicVolume } from '@/lib/musicVolume';
import { markTutorialSeen, readTutorialSeen } from '@/lib/tutorialSeen';
import { readMuted, writeMuted } from '@/lib/mute';
import { Hud } from './Hud';
import { BoardModal } from './BoardModal';
import { ConfirmDialog } from './ConfirmDialog';
import { FullscreenButton } from './FullscreenButton';
import { SoundControls } from './SoundControls';
import { TutorialCard } from './TutorialCard';

export function SoloGame({ startLevel }: { startLevel?: number }) {
  const t = useTranslations('solo');
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SoloController | null>(null);

  const [snapshot, setSnapshot] = useState<HudSnapshot>(INITIAL_SNAPSHOT);
  const [highScore, setHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tutorial, setTutorial] = useState<TutorialTopic | null>(null);
  const [volume, setVolume] = useState(0.6);
  const [confirmLeave, setConfirmLeave] = useState(false);

  /**
   * Penjelasan yang sudah dilihat, dipegang di ref.
   *
   * Sengaja BUKAN state: ia dibaca di dalam effect yang mengamati level, dan
   * kalau ia jadi dependency maka menandai satu penjelasan sebagai "sudah
   * dilihat" akan menjalankan effect itu lagi — lalu penjelasan yang sama
   * muncul kembali seketika.
   */
  const seenRef = useRef<readonly TutorialTopic[]>([]);

  /**
   * Musik latar hidup selama komponen ini terpasang.
   *
   * Dibuat sekali di ref, bukan per render: AudioContext itu sumber daya OS,
   * dan membuatnya berulang kali akan ditolak browser setelah beberapa kali.
   */
  const musicRef = useRef<Music | null>(null);
  if (musicRef.current === null && typeof window !== 'undefined') {
    musicRef.current = buatMusic();
  }

  useEffect(() => {
    const music = musicRef.current;
    return () => music?.dispose();
  }, []);

  /**
   * Ketegangan mengikuti keadaan permainan, dihitung di `shared` supaya bisa
   * diuji tanpa audio sama sekali.
   */
  useEffect(() => {
    musicRef.current?.setIntensity(
      soloIntensity(snapshot.level, snapshot.lives, SOLO_STARTING_LIVES),
    );
  }, [snapshot.level, snapshot.lives]);

  // Musik hanya berbunyi saat benar-benar bermain. Di layar jeda, game over,
  // dan saat kartu tutorial terbuka, ia berhenti — itu momen untuk membaca,
  // bukan momen untuk didesak.
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    if (snapshot.status === 'running' && tutorial === null) music.start();
    else music.stop();
  }, [snapshot.status, tutorial]);

  useEffect(() => {
    setHighScore(readHighScore());
    setMuted(readMuted());
    musicRef.current?.setMuted(readMuted());
    const savedVolume = readMusicVolume();
    setVolume(savedVolume);
    musicRef.current?.setVolume(savedVolume);
    seenRef.current = readTutorialSeen();
  }, []);

  /**
   * Munculkan penjelasan saat pemain baru naik ke level yang membuka mekanik.
   *
   * Papannya dibekukan lewat `pause()` yang sudah ada — jalur yang sama dengan
   * tombol pause, jadi tidak ada keadaan baru yang perlu dijaga. Tanpa
   * pembekuan ini pemain harus memilih antara membaca dan bermain, dan ia akan
   * memilih bermain lalu menutup kartunya tanpa dibaca.
   */
  useEffect(() => {
    if (snapshot.status !== 'running') return;

    const topic = pendingTutorial(snapshot.level, seenRef.current);
    if (topic === null) return;

    seenRef.current = [...seenRef.current, topic];
    markTutorialSeen(topic);
    controllerRef.current?.pause();
    setTutorial(topic);
  }, [snapshot.level, snapshot.status]);

  const changeVolume = useCallback((next: number) => {
    setVolume(next);
    musicRef.current?.setVolume(next);
    writeMusicVolume(next);
  }, []);

  const dismissTutorial = useCallback(() => {
    setTutorial(null);
    controllerRef.current?.resume();
  }, []);

  // Phaser menyentuh `window` saat di-import, jadi di-import dinamis di dalam
  // effect — dengan begitu halaman tetap bisa dirender di server.
  useEffect(() => {
    let disposed = false;
    let controller: SoloController | null = null;

    void import('@/game/createSoloGame').then(({ createSoloGame }) => {
      if (disposed || !boardRef.current) return;
      controller = createSoloGame({ parent: boardRef.current, onHud: setSnapshot, startLevel });
      // Preferensi bunyi dibaca sebelum controller ada, jadi diterapkan di sini.
      controller.setMuted(readMuted());
      controllerRef.current = controller;
    });

    return () => {
      disposed = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [startLevel]);

  // Simpan rekor begitu ronde selesai.
  useEffect(() => {
    if (snapshot.status !== 'gameOver') return;
    const previous = readHighScore();
    if (snapshot.score > previous) {
      writeHighScore(snapshot.score);
      setHighScore(snapshot.score);
      setIsNewRecord(true);
    }

    // Kirim ke akun kalau pemain login. Endpoint-nya membalas `saved: false`
    // untuk guest dan saat database tidak ada — keduanya keadaan normal, jadi
    // kegagalannya sengaja tidak ditampilkan ke pemain: rekor localStorage
    // sudah tersimpan dan ronde berikutnya tidak boleh terganggu oleh ini.
    void fetch('/api/solo-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: snapshot.score,
        durationSeconds: Math.max(1, Math.round(snapshot.elapsedMs / 1000)),
        level: snapshot.level,
      }),
    }).catch(() => {});
  }, [snapshot.status, snapshot.score, snapshot.elapsedMs, snapshot.level]);

  const start = useCallback(() => {
    setIsNewRecord(false);
    controllerRef.current?.start();
  }, []);

  const continueRound = useCallback(() => {
    setIsNewRecord(false);
    controllerRef.current?.continueRound();
  }, []);

  const togglePause = useCallback(() => {
    if (snapshot.status === 'running') controllerRef.current?.pause();
    else if (snapshot.status === 'paused') controllerRef.current?.resume();
  }, [snapshot.status]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      controllerRef.current?.setMuted(next);
      musicRef.current?.setMuted(next);
      writeMuted(next);
      return next;
    });
  }, []);

  // Kenyamanan di desktop; di HP semuanya lewat tombol.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        event.preventDefault();
        togglePause();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause]);

  const canPause = snapshot.status === 'running' || snapshot.status === 'paused';

  return (
    // `shell--play` mengunci halaman ini setinggi layar. Lihat catatannya di
    // globals.css: halaman main yang bisa di-scroll bukan sekadar tidak rapi,
    // ia menyembunyikan tombol di bawah papan tepat saat dibutuhkan.
    <main className="shell shell--play">
      <div className="topbar">
        {/* Konfirmasi HANYA saat ronde sedang berlangsung. Menanyakannya di
            layar idle atau game over cuma menambah satu ketukan untuk tindakan
            yang tidak merusak apa pun — dan konfirmasi yang muncul terus akan
            berhenti dibaca justru saat ia penting. */}
        {snapshot.status === 'running' || snapshot.status === 'paused' ? (
          <button className="btn btn--small" type="button" onClick={() => setConfirmLeave(true)}>
            ← {t('back')}
          </button>
        ) : (
          <Link className="btn btn--small" href="/">
            ← {t('back')}
          </Link>
        )}
        <div className="topbar__right">
          <div>
            <span className="hud__label">{t('highScore')}</span>
            <div className="stat__value">{highScore}</div>
          </div>
          <FullscreenButton />
        </div>
      </div>

      <Hud snapshot={snapshot} />

      {/* Baru muncul setelah checkpoint pertama, supaya awal permainan tidak ramai. */}
      {snapshot.checkpointLevel !== null && (
        <div className="metabar">
          <span>
            <span className="hud__label">{t('checkpoint')}</span> Lv {snapshot.checkpointLevel}
          </span>
          <span>
            <span className="hud__label">{t('continues')}</span>{' '}
            {'●'.repeat(snapshot.continuesLeft) || '—'}
          </span>
        </div>
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
          {snapshot.status === 'idle' && (
            <div className="overlay">
              <h2 className="overlay__title">{t('tapToStart')}</h2>
              <p className="overlay__hint">{t('tapToStartHint')}</p>
              <button className="btn btn--primary" type="button" onClick={start}>
                {t('tapToStart')}
              </button>
            </div>
          )}

          {tutorial !== null && (
            <TutorialCard topic={tutorial} level={snapshot.level} onDismiss={dismissTutorial} />
          )}

          {/* Overlay pause biasa disembunyikan saat kartu tutorial tampil: papan
              memang sedang dibekukan, tapi yang harus dibaca pemain adalah
              penjelasannya, bukan tombol "lanjut". */}
          {/* Modal (portal), bukan overlay di dalam papan: isinya memuat kontrol
              bunyi, dan di papan yang pendek judul serta slidernya terpotong. */}
          {tutorial === null && snapshot.status === 'paused' && (
            <BoardModal>
              <h2 className="overlay__title">{t('paused')}</h2>
              <button className="btn btn--primary" type="button" onClick={togglePause}>
                {t('resume')}
              </button>
              {/*
                Layar penuh dan "kembali" HARUS ada di sini.

                Modal ini menutupi seluruh layar, termasuk topbar — jadi kedua
                tombol yang biasanya di sana tidak bisa ditekan selama jeda.
                Kalau tidak dipindahkan ke dalam, satu-satunya jalan keluar dari
                ronde yang sedang berjalan adalah tombol back browser. Dan
                sebetulnya di sinilah tempatnya yang lebih pas: jeda memang momen
                orang mengubah layar penuh atau memutuskan berhenti, bukan saat
                tangannya sedang mengetuk pixel.
              */}
              <FullscreenButton withLabel />
              {/*
                Pengaturan bunyi tinggal DI SINI, tidak lagi menetap di bawah
                papan. Dua alasan, dan yang kedua yang menentukan:

                1. Ia memakan 65 px permanen dari layar yang sudah tidak cukup.
                2. Ia tidak pernah dipakai saat sedang bermain. Yang menggeser
                   volume adalah pemain yang sedang berhenti sejenak — dan di
                   situlah sekarang ia berada.
              */}
              <SoundControls
                muted={muted}
                volume={volume}
                onToggleMute={toggleMute}
                onVolumeChange={changeVolume}
              />
              {/* Paling bawah, sejauh mungkin dari "Lanjut": ini satu-satunya
                  tombol di modal ini yang membuang skor yang sedang berjalan. */}
              <button
                className="btn btn--small"
                type="button"
                onClick={() => setConfirmLeave(true)}
              >
                ← {t('backToMenu')}
              </button>
            </BoardModal>
          )}

          {/* Sama seperti jeda: skor, rekor, rincian, dan dua tombol tidak
              pernah muat di dalam papan. */}
          {snapshot.status === 'gameOver' && (
            <BoardModal>
              <h2 className="overlay__title">{t('gameOver')}</h2>
              <span className="hud__label">{t('finalScore')}</span>
              <div className="overlay__score">{snapshot.score}</div>
              {isNewRecord && <div className="overlay__record">★ {t('newRecord')}</div>}
              <div className="overlay__detail">
                <span>
                  {t('bestCombo')}: {snapshot.bestCombo}
                </span>
                <span>
                  {t('accuracy')}: {Math.round(snapshot.accuracy * 100)}%
                </span>
              </div>
              {snapshot.canContinue && snapshot.checkpointLevel !== null ? (
                <>
                  <button className="btn btn--primary" type="button" onClick={continueRound}>
                    {t('continueFrom', { level: snapshot.checkpointLevel })}
                    <span className="badge">
                      {t('continuesLeft', { count: snapshot.continuesLeft })}
                    </span>
                  </button>
                  <button className="btn btn--small" type="button" onClick={start}>
                    {t('startOver')}
                  </button>
                </>
              ) : (
                <button className="btn btn--primary" type="button" onClick={start}>
                  {t('playAgain')}
                </button>
              )}
              {/* Sama seperti modal jeda: topbar tertutup, jadi jalan pulangnya
                  harus ada di dalam. Tanpa konfirmasi — di layar ini rondenya
                  sudah habis, tidak ada apa pun yang bisa hilang. */}
              <Link className="btn btn--small" href="/">
                ← {t('backToMenu')}
              </Link>
            </BoardModal>
          )}
        </div>
      </div>

      <div className="controls">
        <button className="btn" type="button" onClick={togglePause} disabled={!canPause}>
          {snapshot.status === 'paused' ? t('resume') : t('pause')}
        </button>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title={t('leaveTitle')}
          body={t('leaveBody')}
          confirmLabel={t('leaveConfirm')}
          onConfirm={() => router.push('/')}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  );
}
